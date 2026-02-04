const Activity = require("../models/activities");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Chat = require("../models/chat");
const User = require("../models/user");
const Chatroom = require("../models/chatroom");

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
  console.log("Sending data to DB")
  for (const roomName in messageCache) {
    if (messageCache[roomName].length > 0) {
      const chat = await Chat.findOne({ participants: { $all: roomName.split('_').slice(1) } });
      if (chat) {
        chat.messages.push(...messageCache[roomName]);
        await chat.save();
      } else {
        const members = roomName.split('_').slice(1);
        await Chat.create({ participants: members, messages: messageCache[roomName] });
      }
      messageCache[roomName] = []; // Clear the cache for the room after flushing
    }
  }
};

// Set up the interval to flush messages to the database
setInterval(flushMessagesToDB, FLUSH_INTERVAL);


io.on("connection", (socket) => {
  // when user logins in, add activity to save login time and when user logout, update its logout time
  socket.on("login", (data) => {
    try {
      const { userID, device, browser } = data;
      socket.userID = userID;
      if (!userID || !device || !browser) return;
      const activity = new Activity({
        userID,
        loginTime: new Date(),
        device,
        browser,
      });
      activity.save();
    } catch (err) {
      console.log(err);
    }
  });

  // update logout time when user disconnects for specific userID
  socket.on("disconnect", async () => {
    try {
      console.log("disconnect");

      const userID = socket.userID;

      if (userID && mongoose.Types.ObjectId.isValid(userID))
        await Activity.findOneAndUpdate(
          { userID: mongoose.Types.ObjectId(userID), logoutTime: null },
          { logoutTime: new Date() }
        );
    } catch (err) {
      console.log(err);
    }
  });
});


io.of("/one-to-one").on("connection", (socket) => {

  socket.on("join", (members) => {
    const [member1, member2] = members;
    const roomName = member1 < member2 ? `room_${member1}_${member2}` : `room_${member2}_${member1}`;

    socket.join(roomName);
    console.log(socket.id, roomName, "jonied");
  })

  socket.on("get-chats", async (members) => {

    const chat = await Chat.findOne({
      participants: { $all: members }
    }).populate("participants").populate("messages.sentBy");

    if (chat) {
      socket.emit("chat-history", chat);
    }
    else {
      socket.emit("chat-history", { participants: members, messages: [] });
    }
  })

  socket.on("message", async (data) => {
    const [member1, member2] = data?.members;
    const roomName = member1 < member2 ? `room_${member1}_${member2}` : `room_${member2}_${member1}`;
    console.log(roomName);

    // socket.join(roomName);
    // socket.emit("join-room", roomName);
    console.log("RoomName:", roomName, "Data Going: ", data);
    let msgbody = {
      sentBy: data.message.sentBy,
      time: data.message.time,
      type: data.message.type,
      message: data.message.message,
    }

    io.of("/one-to-one").to(roomName).emit("receive-message", data);

    if (!messageCache[roomName]) {
      messageCache[roomName] = [];
    }

    console.log("saving in cache");
    messageCache[roomName].push(msgbody);
  });

});

// chat socket
io.of("/chatroom").on("connection", (socket) => {
  console.log("New client connected");

  socket.on("join", (data) => {
    socket.join(data.room);
  });

  socket.on("message", (data) => {
    const newMessage = {
      sentBy: data.message.sentBy,
      time: data.message.time,
      type: data.message.type,
      message: data.message.message,
    };

    Chatroom.findByIdAndUpdate(
      data.room,
      {
        $push: { messages: newMessage },
        lastMsg: newMessage,
      },
      { new: true }
    )
      .then((chatroom) => { console.log("Data updated successfully ") })
      .catch((err) => { console.log("erri ", err) });
    console.log("data emiting count");
    io.of("/chatroom").to(data.room).emit("message", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Export the Socket.IO instance
exports.io = io;
