const { Server } = require("socket.io");
const prisma = require("../db/prisma");

// Create a Socket.IO instance
const io = new Server({
  cors: {
    origin: process.env.CLIENT_BASE_URL,
    methods: ["GET", "POST"],
  },
});

const messageCache = {}; // Local cache for messages
const FLUSH_INTERVAL = 15000;

const flushMessagesToDB = async () => {
  for (const roomName in messageCache) {
    if (messageCache[roomName].length > 0) {
      const messagesToFlush = messageCache[roomName];
      messageCache[roomName] = []; // Clear the cache for the room after flushing
      
      const members = roomName.split('_').slice(1);
      
      try {
        let chat = await prisma.chat.findFirst({
          where: {
            AND: members.map(m => ({
              participants: { some: { id: m } }
            }))
          }
        });

        if (!chat) {
          chat = await prisma.chat.create({
             data: {
               participants: { connect: members.map(m => ({ id: m })) }
             }
          });
        }

        await prisma.chatMessage.createMany({
          data: messagesToFlush.map(msg => ({
            chatID: chat.id,
            senderID: msg.sentBy,
            time: msg.time ? new Date(msg.time) : new Date(),
            type: msg.type || "text",
            message: msg.message
          }))
        });
      } catch (err) {
        console.error("Error flushing messages", err);
        // Put back in cache if failed
        if (!messageCache[roomName]) messageCache[roomName] = [];
        messageCache[roomName].push(...messagesToFlush);
      }
    }
  }
};

// Set up the interval to flush messages to the database
setInterval(flushMessagesToDB, FLUSH_INTERVAL);


io.on("connection", (socket) => {
  // when user logins in, add activity to save login time and when user logout, update its logout time
  socket.on("login", async (data) => {
    try {
      const { userID, device, browser } = data;
      socket.userID = userID;
      if (!userID || !device || !browser) return;
      await prisma.activity.create({
        data: {
          userID,
          loginTime: new Date(),
          device,
          browser,
        }
      });
    } catch (err) {
      console.error(err);
    }
  });

  // update logout time when user disconnects for specific userID
  socket.on("disconnect", async () => {
    try {
      const userID = socket.userID;
      if (userID) {
         const activity = await prisma.activity.findFirst({
           where: { userID, logoutTime: null },
           orderBy: { loginTime: 'desc' }
         });

         if (activity) {
            await prisma.activity.update({
              where: { id: activity.id },
              data: { logoutTime: new Date() }
            });
         }
      }
    } catch (err) {
      console.error(err);
    }
  });
});


io.of("/one-to-one").on("connection", (socket) => {

  socket.on("join", (members) => {
    const [member1, member2] = members;
    const roomName = member1 < member2 ? `room_${member1}_${member2}` : `room_${member2}_${member1}`;

    socket.join(roomName);
  })

  socket.on("get-chats", async (members) => {
    try {
      const chat = await prisma.chatRoom.findFirst({
        where: {
          AND: members.map(m => ({
            participants: { some: { id: m } }
          })),
          classroomID: null // 1:1 chats don't have a classroomID usually
        },
        include: {
          participants: true,
          messages: {
            include: { sentBy: true },
            orderBy: { time: 'asc' }
          }
        }
      });

      if (chat) {
        socket.emit("chat-history", chat);
      } else {
        socket.emit("chat-history", { participants: [], messages: [] });
      }
    } catch (err) {
      console.error("Error getting chats", err);
    }
  })

  socket.on("message", async (data) => {
    try {
      const [member1, member2] = data?.members;
      const roomName = member1 < member2 ? `room_${member1}_${member2}` : `room_${member2}_${member1}`;

      // 1. Find or create the chatRoom
      let chatroom = await prisma.chatRoom.findFirst({
        where: {
          AND: data.members.map(m => ({
            participants: { some: { id: m } }
          })),
          classroomID: null
        }
      });

      if (!chatroom) {
        chatroom = await prisma.chatRoom.create({
          data: {
            participants: { connect: data.members.map(m => ({ id: m })) }
          }
        });
      }

      // 2. Create the message
      const newMessage = await prisma.chatRoomMessage.create({
        data: {
          chatRoomID: chatroom.id,
          senderID: data.message.sentBy,
          message: data.message.message,
          type: data.message.type || "text",
          time: data.message.time ? new Date(data.message.time) : new Date()
        }
      });

      // 3. Update Chatroom Last Message
      await prisma.chatRoom.update({
        where: { id: chatroom.id },
        data: {
          lastMsgSentBy: newMessage.senderID,
          lastMsgTime: newMessage.time,
          lastMsgType: newMessage.type,
          lastMsgText: newMessage.message
        }
      });

      // Standardize blast to "message" for both namespaces
      io.of("/one-to-one").to(roomName).emit("message", data);
    } catch (err) {
      console.error("Error in 1:1 message socket:", err);
    }
  });

});

// chat socket
io.of("/chatroom").on("connection", (socket) => {

  socket.on("join", (data) => {
    socket.join(data.room);
  });

  socket.on("message", async (data) => {
    try {
      const newMessage = {
        sentBy: data.message.sentBy,
        time: data.message.time,
        type: data.message.type,
        message: data.message.message,
      };

      const msgData = {
        chatRoomID: data.room,
        senderID: newMessage.sentBy,
        type: newMessage.type || "text",
        message: newMessage.message,
        time: newMessage.time ? new Date(newMessage.time) : new Date()
      };

      await prisma.chatRoomMessage.create({ data: msgData });
      await prisma.chatRoom.update({
        where: { id: data.room },
        data: {
          lastMsgSentBy: msgData.senderID,
          lastMsgTime: msgData.time,
          lastMsgType: msgData.type,
          lastMsgText: msgData.message
        }
      });

      io.of("/chatroom").to(data.room).emit("message", data);
    } catch (err) {
      console.error("Error sending chatroom message", err);
    }
  });

});

// Export the Socket.IO instance
exports.io = io;
