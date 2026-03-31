const prisma = require("../db/prisma");

exports.createAnnouncement = async (req, res, next) => {
  try {
    const { time, ...data } = req.body;
    const announcement = await prisma.announcement.create({ data });
    return res.status(201).send(announcement);
  } catch (err) {
    next(err);
  }
};
exports.getAnnouncementsByType = async (req, res, next) => {
  try {
    const user = req.user;
    const { type } = req.params;
    let where = { type };

    if (user && user.userType !== "admin") {
      where.OR = [
        { visibility: "all" },
        { visibility: user.userType }
      ];
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).send(announcements);
  } catch (err) {
    next(err);
  }
};

exports.getAnnouncements = async (req, res, next) => {
  try {
    const user = req.user;
    let where = {};

    if (user && user.userType !== "admin") {
      where.OR = [
        { visibility: "all" },
        { visibility: user.userType }
      ];
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).send(announcements);
  } catch (err) {
    next(err);
  }
};

exports.updateAnnouncement = async (req, res, next) => {
  try {
    const { time, ...data } = req.body;
    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data
    });
    return res.status(200).send(announcement);
  } catch (err) {
    next(err);
  }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getAnnouncementsByUserType = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).send({ message: "Unauthorized" });

    let where = {};
    if (user.userType !== "admin") {
      where.OR = [
        { visibility: "all" },
        { visibility: user.userType },
      ];
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).send(announcements);
  } catch (err) {
    next(err);
  }
};