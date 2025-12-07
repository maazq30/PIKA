const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  }
},
{
    collection: "DIN", // 👈 use this exact collection name
  });

module.exports = mongoose.model("User", userSchema);
