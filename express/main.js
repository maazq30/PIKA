// Load env vars first (for local dev; on Render, env vars come from the dashboard)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Get Mongo URI from env
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

// Connect to MongoDB, then start server
mongoose
  .connect(uri)
  .then(() => {
    console.log("✅ MongoDB Connected");

    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Routes
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    console.error("GET /users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/users/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("GET /users/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/users", async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    const newUser = await User.create({ name });
    res.status(201).json(newUser);
  } catch (err) {
    console.error("POST /users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/users/:id", async (req, res) => {
  const id = req.params.id;
  const { name } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );

  if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("PUT /users/:id error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete("/users/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(deletedUser);
  } catch (err) {
    console.error("DELETE /users/:id error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});
