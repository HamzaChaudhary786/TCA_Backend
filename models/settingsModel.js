
const mongoose = require("mongoose");

// Nested Schema for AttendanceSettingMode
const AttendanceSettingSchema = new mongoose.Schema({
  enableHeadAttendance: {
    type: Boolean,
    required: true,
    default: false,
  },
});



// Main Schema for AttendanceSetting
const Settings = new mongoose.Schema({
  attendenceSetting: {
    type: AttendanceSettingSchema,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Setting = mongoose.model("Setting", Settings);

module.exports = Setting;