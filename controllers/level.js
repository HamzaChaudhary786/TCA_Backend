const Level = require("../models/level");

exports.createLevel = async (req, res, next) => {
  try {
    const data = req.body;

    const found = await Level.findOne({ name: data.name });

    if (found) {
      return res.status(400).send("Level already exists");
    }

    const level = new Level(data);
    await level.save();
    res.status(201).send(level._doc);
  } catch (err) {
    next(err);
  }
};

exports.getLevels = async (req, res, next) => {
  try {
    const levels = await Level.find();
    res.status(200).send(levels);
  } catch (err) {
    next(err);
  }
};

exports.updateLevel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const level = await Level.findByIdAndUpdate(id, data, {
      new: true,
    });
    res.status(200).send(level._doc);
  } catch (err) {
    next(err);
  }
};

exports.deleteLevel = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Level.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
