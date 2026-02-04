const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  url: {
    type: String,
  },
  file: {
    name: String,
    url: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  deliveredTo: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  readBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

module.exports = mongoose.model("Notification", notificationSchema);
