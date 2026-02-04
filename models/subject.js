const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  levelID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Level",
  },
});

subjectSchema.index({ name: 1, levelID: 1 }, { unique: true });
const Subject = mongoose.model("Subject", subjectSchema);

module.exports = Subject;
