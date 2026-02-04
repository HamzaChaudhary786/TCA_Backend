const mongoose = require("mongoose");

const chatroomSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  classroomID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
  },
  messages: [
    {
      sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      type: {
        type: String,
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  lastMsg: {
    sentBy: { type: mongoose.Types.ObjectId, ref: "User" },
    time: { type: Date },
    type: {
      type: String,
    },
    message: { type: String },
  },
});

const Chatroom = mongoose.model("Chatroom", chatroomSchema);

module.exports = Chatroom;
