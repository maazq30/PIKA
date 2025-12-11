// main.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { GridFSBucket, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

let gfsBucket; // will hold GridFSBucket instance

mongoose
  .connect(uri)
  .then(() => {
    console.log("✅ MongoDB Connected");

    // create GridFSBucket from native driver db
    gfsBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// multer-gridfs-storage setup
const storage = new GridFsStorage({
  url: uri,
  file: (req, file) => {
    return {
      bucketName: "uploads",
      filename: `${Date.now()}-${file.originalname}`,
    };
  },
});
const upload = multer({ storage });

// --- Routes ---

// list users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    console.error("GET /users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// get user by id
app.get("/users/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.error("GET /users/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// create user (accepts multipart/form-data with optional file)
app.post("/users", upload.single("file"), async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    const payload = { name };

    if (req.file) {
      // multer-gridfs-storage puts file metadata on req.file
      payload.documentField = req.file._id;
 // GridFS file _id
      payload.documentFilename = req.file.filename;
    }

    const newUser = await User.create(payload);
    res.status(201).json(newUser);
  } catch (err) {
    console.error("POST /users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// update user (name only)
app.put("/users/:id", async (req, res) => {
  const id = req.params.id;
  const { name } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(id, { name }, { new: true });
    if (!updatedUser) return res.status(404).json({ error: "User not found" });
    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("PUT /users/:id error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// delete user and attached GridFS file (if exists)
app.delete("/users/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });

    // If they had an uploaded file, try to delete it from GridFS
    if (deletedUser.documentField && gfsBucket) {
      try {
        await gfsBucket.delete(new ObjectId(deletedUser.documentField));
      } catch (err) {
        // log but don't fail the whole request
        console.warn("Failed to delete file from GridFS:", err.message || err);
      }
    }

    res.status(200).json(deletedUser);
  } catch (err) {
    console.error("DELETE /users/:id error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Serve files from GridFS by id
app.get("/files/:id", async (req, res) => {
  const fileId = req.params.id;
  if (!gfsBucket) {
    return res.status(503).json({ error: "GridFS not ready" });
  }

  try {
    const _id = new ObjectId(fileId);

    // Find the file info first to set headers
    const filesColl = mongoose.connection.db.collection("uploads.files");
    const fileDoc = await filesColl.findOne({ _id });

    if (!fileDoc) return res.status(404).json({ error: "File not found" });

    res.setHeader("Content-Disposition", `attachment; filename="${fileDoc.filename}"`);
    res.setHeader("Content-Type", fileDoc.contentType || "application/octet-stream");

    const downloadStream = gfsBucket.openDownloadStream(_id);
    downloadStream.on("error", (err) => {
      console.error("GridFS download error:", err);
      res.status(500).end();
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error("GET /files/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
