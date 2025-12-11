// main.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { GridFSBucket, ObjectId } = require("mongodb");
const User = require("./models/User");

const app = express();
const port = process.env.PORT || 3000;

// === CORS ===
// Allow dev origin (http://localhost:5173) by default, or set ALLOWED_ORIGIN env var
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Parse JSON bodies (for non-multipart routes)
app.use(express.json());

// === MongoDB / GridFS connection ===
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

let gfsBucket;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ MongoDB Connected");

    // Create GridFS bucket (named 'uploads' to match multer-gridfs-storage)
    gfsBucket = new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });

    app.listen(port, () => {
      console.log(`🚀 Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// === multer-gridfs-storage setup ===
const storage = new GridFsStorage({
  url: uri,
  file: (req, file) => {
    return {
      bucketName: "uploads",
      filename: `${Date.now()}-${file.originalname}`,
      metadata: {
        originalname: file.originalname,
        uploadedBy: req.body?.name || null,
      },
      contentType: file.mimetype,
    };
  },
});
const upload = multer({ storage });

// === Routes ===

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// List users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    return res.status(200).json(users);
  } catch (err) {
    console.error("GET /users error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Get single user
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.status(200).json(user);
  } catch (err) {
    console.error("GET /users/:id error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Create user (multipart/form-data; optional file)
app.post("/users", upload.single("file"), async (req, res) => {
  // Debug logs to see what's arriving
  console.log("POST /users - req.body:", req.body);
  if (req.file) {
    console.log("POST /users - req.file:", {
      _id: req.file._id,
      id: req.file.id,
      filename: req.file.filename,
      contentType: req.file.contentType,
      size: req.file.size,
    });
  } else {
    console.log("POST /users - no file uploaded");
  }

  const { name } = req.body;
  if (!name || !name.trim()) {
    // If a file was uploaded, delete it to avoid orphans
    if (req.file && gfsBucket) {
      try {
        const fid = req.file._id || req.file.id;
        await gfsBucket.delete(new ObjectId(String(fid)));
        console.log("Deleted uploaded file due to missing name");
      } catch (delErr) {
        console.warn("Failed to delete file after missing name:", delErr);
      }
    }
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    const payload = { name: name.trim() };

    if (req.file) {
      // multer-gridfs-storage sometimes exposes _id (ObjectId) or id (string).
      payload.documentField = req.file._id || req.file.id;
      payload.documentFilename = req.file.filename || null;
    }

    const newUser = await User.create(payload);
    return res.status(201).json(newUser);
  } catch (err) {
    console.error("POST /users error while creating user:", err && err.stack ? err.stack : err);

    // cleanup: delete uploaded file if present
    if (req.file && gfsBucket) {
      try {
        const fid = req.file._id || req.file.id;
        await gfsBucket.delete(new ObjectId(String(fid)));
        console.log("Deleted uploaded file because user creation failed");
      } catch (delErr) {
        console.warn("Failed to delete GridFS file after user create failure:", delErr);
      }
    }

    return res.status(500).json({ error: err?.message || "Server error while creating user" });
  }
});

// Update user (name only)
app.put("/users/:id", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ error: "User not found" });
    return res.status(200).json(updatedUser);
  } catch (err) {
    console.error("PUT /users/:id error:", err);
    return res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user and their file (if any)
app.delete("/users/:id", async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });

    if (deletedUser.documentField && gfsBucket) {
      try {
        const fid = deletedUser.documentField;
        await gfsBucket.delete(new ObjectId(String(fid)));
        console.log("Deleted user's GridFS file:", fid);
      } catch (err) {
        console.warn("Failed to delete file from GridFS:", err);
      }
    }

    return res.status(200).json(deletedUser);
  } catch (err) {
    console.error("DELETE /users/:id error:", err);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

// Serve files from GridFS by id
app.get("/files/:id", async (req, res) => {
  if (!gfsBucket) return res.status(503).json({ error: "GridFS not ready" });

  try {
    const fileId = req.params.id;
    const _id = new ObjectId(String(fileId));

    const filesColl = mongoose.connection.db.collection("uploads.files");
    const fileDoc = await filesColl.findOne({ _id });
    if (!fileDoc) return res.status(404).json({ error: "File not found" });

    // For inline preview (remove Content-Disposition), or use attachment to force download
    res.setHeader("Content-Disposition", `attachment; filename="${fileDoc.filename}"`);
    res.setHeader("Content-Type", fileDoc.contentType || "application/octet-stream");

    const downloadStream = gfsBucket.openDownloadStream(_id);
    downloadStream.on("error", (err) => {
      console.error("GridFS download error:", err);
      // stream error — send 500
      if (!res.headersSent) res.status(500).end();
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error("GET /files/:id error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Generic error handler (returns JSON)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || "Server error" });
  } else {
    next(err);
  }
});
