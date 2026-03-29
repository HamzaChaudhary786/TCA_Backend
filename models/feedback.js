const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  accepted: {
    type: Boolean,
    default: false,
  },
  teacherID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

// Index for feedback lookup by user and creation time
feedbackSchema.index({ userID: 1, createdAt: -1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
