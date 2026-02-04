const io = require("socket.io-client");
const socket = io("http://localhost:4000"); // Replace with your server URL

// Connect event
socket.on("connect", () => {
  console.log("Connected to the server");

  // Emit a custom event
  socket.emit("test-event", { message: "Hello, server!" });
});

// Receive events from the server
socket.on("server-message", (data) => {
  console.log("Server says:", data.message);

  // Disconnect after receiving a message
  socket.disconnect();
});

// Disconnect event
socket.on("disconnect", () => {
  console.log("Disconnected from the server");
});
