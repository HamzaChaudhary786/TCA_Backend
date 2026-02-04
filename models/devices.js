const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  fcmToken: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Device", deviceSchema);
