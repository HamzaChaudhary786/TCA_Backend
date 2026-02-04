const mongoose = require("mongoose");

const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  levelID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Level",
  },
  students: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  teachers: [
    {
      teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
      type: {
        type: String,
        enum: ["head", "teacher"], // Ensures valid types
        default: "teacher",       // Default is a regular teacher
      },
    },
  ],

 
});

const Classroom = mongoose.model("Classroom", classroomSchema);

module.exports = Classroom;
