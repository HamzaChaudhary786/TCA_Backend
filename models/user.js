const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  subjects: {
    type: [String],
    default: [],
  },
  password: {
    type: String,
    required: true,
  },
  profilePic: {
    type: String,
  },
  bio: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  dob: {
    type: Date,
  },
  userType: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
  },
  levelID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Level",
  },
  guardianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  guardianName: {
    type: String,
  },
  guardianEmail: {
    type: String,
  },
  guardianPhoneNumber: {
    type: String,
  },
  experience: {
    type: String,
  },
  qualification: {
    type: String,
  },
  cv: {
    type: String,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  feesPaid: {
    type: Boolean,
    default: true,
  },
  isAccepted: {
    type: Boolean,
    default: false,
  },
  rollNo: {
    type: String,
    unique: true,
    sparse: true,

  },
  referenceNo: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  gender: {
    type: String,
    required: function () {
      return this.userType === "student"; // Required only for students
    },
  },
  isFirstLogin: { type: Boolean, default: true },
  subscription: {
    isActive: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
    },
  },


});

const User = mongoose.model("User", userSchema);

module.exports = User;
