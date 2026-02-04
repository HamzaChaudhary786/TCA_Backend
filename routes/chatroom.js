const chatroomController = require("../controllers/chatroom");
const chatroomRouter = require("express").Router();

chatroomRouter.get("/", chatroomController.getUserChatrooms);
chatroomRouter.get("/admin", chatroomController.getChatroomsForAdmin);
chatroomRouter.get("/chat/parents", chatroomController.getParentsForChats);
chatroomRouter.get("/chat/teachers", chatroomController.getTeacherForChats);
chatroomRouter.get("/admin/:chatroomId", chatroomController.getChatroomForAdmin);
chatroomRouter.get("/:chatroomId", chatroomController.getChatroom);

module.exports = chatroomRouter;
