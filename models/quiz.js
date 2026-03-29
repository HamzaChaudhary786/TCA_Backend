const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  text: {
    type: String,
  },
  totalMarks: {
    type: Number,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  files: [
    {
      name: String,
      url: String,
    },
  ],
  canSubmitAfterTime: {
    type: Boolean,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  classroomID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  subjectID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  submissions: [
    {
      studentID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      feedback: {
        type: String,
      },
      grade: {
        type: String,
      },
      file: {
        type: String,
      },
      marks: {
        type: Number,
      },
      submittedAt: {
        type: Date,
        default: Date.now,
      },
      isLate: {
        type: Boolean,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for frequent quiz queries
quizSchema.index({ classroomID: 1, subjectID: 1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ dueDate: 1 });

const Quiz = mongoose.model("Quiz", quizSchema);

module.exports = Quiz;
