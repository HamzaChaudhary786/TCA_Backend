const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    required: true,
    enum: ["annoouncement", "quote"],
  },
  visibility: {
    type: String,
    required: true,
    enum: ["parent", "teacher", "student", "all"],
  },
},
  { timestamps: true }
);

// Indexes for common announcement filters
announcementSchema.index({ visibility: 1 });
announcementSchema.index({ date: -1 });

const Announcement = mongoose.model("Announcement", announcementSchema);

module.exports = Announcement;
