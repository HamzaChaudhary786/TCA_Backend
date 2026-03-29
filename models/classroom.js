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

// Indexes to speed classroom lookups
classroomSchema.index({ name: 1, levelID: 1 }, { unique: true });
classroomSchema.index({ levelID: 1 });
classroomSchema.index({ students: 1 });
classroomSchema.index({ "teachers.teacher": 1 });

const Classroom = mongoose.model("Classroom", classroomSchema);

module.exports = Classroom;
