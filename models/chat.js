const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],
    messages: [{
        sentBy:  {type: mongoose.Schema.Types.ObjectId, ref: "User"},
        message: String,
        type: {
            type: String,
            enum: ["file", "image", "video", "audio", "text"],
            default: "text"
        },
        time: { type: Date, default: Date.now }
    }]
},
    {
        timestamps: true,
    }
)

const Chats = mongoose.model("Chats", chatSchema);

module.exports = Chats
