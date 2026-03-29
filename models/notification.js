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
  subjectName: {
    type: String,
  },
  classroomName: {
    type: String,
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

// Common query patterns: notifications for a user and recent notifications
notificationSchema.index({ userID: 1, createdAt: -1 });
notificationSchema.index({ readBy: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
