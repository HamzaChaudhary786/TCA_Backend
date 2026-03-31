const prisma = require("../db/prisma");

exports.getUserChatrooms = async (req, res, next) => {
  try {
    const chatrooms = await prisma.chatRoom.findMany({
      where: {
        participants: { some: { id: req.user.id } }
      },
      include: { participants: true }
    });
    const formattedChatrooms = chatrooms.map(c => {
      let chatName = c.name;
      if (!chatName && c.participants.length >= 2) {
        const otherPerson = c.participants.find(p => p.id !== req.user.id);
        if (otherPerson) chatName = otherPerson.name;
      }
      return {
        ...c,
        name: chatName || c.name || "Direct Chat",
        lastMsg: {
          message: c.lastMsgText,
          time: c.lastMsgTime,
          type: c.lastMsgType,
          sentBy: c.lastMsgSentBy
        }
      };
    });

    res.status(200).json(formattedChatrooms);
  } catch (error) {
    next(error);
  }
};

exports.getChatroomsForAdmin = async (req, res, next) => {
  try {
    const chatrooms = await prisma.chatRoom.findMany({
      include: { participants: true }
    });
    const formattedChatrooms = chatrooms.map(c => {
      let chatName = c.name;
      if (!chatName && c.participants.length >= 2) {
        // Admin doesn't have req.user.id in the chatroom usually, so we pick the first two users
        chatName = `${c.participants[0]?.name} & ${c.participants[1]?.name}`;
      }
      return {
        ...c,
        name: chatName || c.name || "Direct Chat",
        lastMsg: {
          message: c.lastMsgText,
          time: c.lastMsgTime,
          type: c.lastMsgType,
          sentBy: c.lastMsgSentBy
        }
      };
    });
    res.status(200).json(formattedChatrooms);
  } catch (error) {
    next(error);
  }
};

exports.getChatroomForAdmin = async (req, res, next) => {
  try {
    const chatroom = await prisma.chatRoom.findUnique({
      where: { id: req.params.chatroomId },
      include: {
        participants: true,
        messages: { include: { sentBy: true } }
      }
    });
    res.status(200).json(chatroom);
  } catch (error) {
    next(error);
  }
};

exports.getTeacherForChats = async (req, res, next) => {
  try {
    const chats = await prisma.user.findMany({
      where: { userType: "teacher" }
    });
    res.status(200).json(chats);
  } catch (error) {
    next(error);
  }
};

exports.getParentsForChats = async (req, res, next) => {
  try {
    const chats = await prisma.user.findMany({
      where: { userType: "parent" }
    });
    res.status(200).json(chats);
  } catch (error) {
    next(error);
  }
};

exports.getStudentsForChats = async (req, res, next) => {
  try {
    const chats = await prisma.user.findMany({
      where: { userType: "student" }
    });
    res.status(200).json(chats);
  } catch (error) {
    next(error);
  }
};

exports.getChatroom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const chatroom = await prisma.chatRoom.findFirst({
      where: {
        id: req.params.chatroomId,
        participants: { some: { id: userId } }
      },
      include: {
        participants: true,
        messages: { include: { sentBy: true }, orderBy: { time: 'asc' } }
      }
    });

    res.status(200).json(chatroom);
  } catch (error) {
    next(error);
  }
};

exports.createMessage = async (req, res, next) => {
  try {
    const { receiverId, message, type = "text" } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !message) {
      return res.status(400).json({ message: "Teacher ID and message string are required" });
    }

    // 1. Find if a chat room already exists between these EXACT two users
    const validChatrooms = await prisma.chatRoom.findMany({
      where: {
        AND: [
          { participants: { some: { id: senderId } } },
          { participants: { some: { id: receiverId } } }
        ]
      },
      include: { participants: true }
    });

    // We only want the direct 1:1 chatroom (2 participants)
    let chatroom = validChatrooms.find(c => c.participants.length === 2);

    // 2. If it does not exist, create a new chatroom
    if (!chatroom) {
      chatroom = await prisma.chatRoom.create({
        data: {
          participants: {
             connect: [{ id: senderId }, { id: receiverId }]
          }
        }
      });
    }

    // 3. Create the message
    const msgData = {
      chatRoomID: chatroom.id,
      senderID: senderId,
      message,
      type
    };
    
    const createdMessage = await prisma.chatRoomMessage.create({
      data: msgData
    });

    // 4. Update Chatroom Last Message properties
    await prisma.chatRoom.update({
      where: { id: chatroom.id },
      data: {
        lastMsgID: createdMessage.id,
        lastMsgSentBy: senderId,
        lastMsgTime: new Date(),
        lastMsgType: type,
        lastMsgText: message
      }
    });

    res.status(200).json({ success: true, message: "Quick Message Sent!", data: createdMessage });
  } catch (error) {
    console.error("CREATE MESSAGE ERROR:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      stack: error.stack,
      name: error.name
    });
  }
};
