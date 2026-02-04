const User = require("../models/user");
const Chatroom = require("../models/chatroom");

exports.getUserChatrooms = async (req, res, next) => {
  try {
    const chatrooms = await Chatroom.find({
      participants: req.user._id,
    }).populate("participants");
    res.status(200).json(chatrooms);
  } catch (error) {
    next(error);
  }
};

exports.getChatroomsForAdmin = async (req, res, next) => {
  try {
    const chatrooms = await Chatroom.find({}).populate("participants");
    res.status(200).json(chatrooms);
  } catch (error) {
    next(error);
  }
};

exports.getChatroomForAdmin = async (req, res, next) => {
  try {
    const chatrooms = await Chatroom.find({_id: req.params.chatroomId}).populate("participants").populate("messages.sentBy");
    res.status(200).json(chatrooms);
  } catch (error) {
    next(error);
  }
};

exports.getTeacherForChats = async (req, res, next) => {
  try {
    const chats = await User.find({ userType: "teacher" });
    res.status(200).json(chats);
  } catch (error) {
    next(error);
  }
};

exports.getParentsForChats = async (req, res, next) => {
  try {
    const chats = await User.find({ userType: "parent" });
    res.status(200).json(chats);
  } catch (error) {
    next(error);
  }
};

exports.getChatroom = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const chatroom = await Chatroom.findOne({
      _id: req.params.chatroomId,
      participants: userId,
    }).populate("participants").populate("messages.sentBy");

    res.status(200).json(chatroom);
  } catch (error) {
    next(error);
  }
};
