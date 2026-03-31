const prisma = require("../db/prisma");

exports.createLevel = async (req, res, next) => {
  try {
    const data = req.body;
    const found = await prisma.level.findUnique({ where: { name: data.name } });
    if (found) return res.status(400).send("Level already exists");

    const level = await prisma.level.create({ data });
    res.status(201).send(level);
  } catch (err) {
    next(err);
  }
};

exports.getLevels = async (req, res, next) => {
  try {
    const levels = await prisma.level.findMany();
    res.status(200).send(levels);
  } catch (err) {
    next(err);
  }
};

exports.updateLevel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const level = await prisma.level.update({
      where: { id },
      data: req.body
    });
    res.status(200).send(level);
  } catch (err) {
    next(err);
  }
};

exports.deleteLevel = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.level.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
