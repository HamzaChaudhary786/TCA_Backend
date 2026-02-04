const mongoose = require("mongoose");

const levelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
});

const Level = mongoose.model("Level", levelSchema);

module.exports = Level;
