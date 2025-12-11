const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  documentField: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },documentFilename: {
    type: String,
    default: null,
  },
},
{
    collection: "DIN", // 👈 use this exact collection name
  });

module.exports = mongoose.model("User", userSchema);
