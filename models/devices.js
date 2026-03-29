const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  fcmToken: {
    type: String,
    required: true,
  },
});

// Indexes for fast device lookups and to avoid duplicate tokens
deviceSchema.index({ userID: 1 });
deviceSchema.index({ fcmToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Device", deviceSchema);
