const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  oneTime: {
    type: Boolean,
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
  startEventDate: {
    type: Date,
    required: true,
  },
  endEventDate: {
    type: Date,
    required: true,
  },
  groupID: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  teacher: {
    teacherID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      required: true,
      enum: ["present", "absent", "leave"],
    },
  },
  meetingUrl: {
    type: String,
  },
  attendance: [
    {
      studentID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      isPresent: {
        type: Boolean,
      },
      late: {
        type: Boolean
      }
    },
  ],
});

const Class = mongoose.model("Class", classSchema);

module.exports = Class;
