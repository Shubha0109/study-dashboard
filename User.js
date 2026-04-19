const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  goal: { type: Number, default: 120 },

  studyData: [
    {
      subject: String,
      time: Number,
      date: String
    }
  ]
});

module.exports = mongoose.model("User", userSchema);