const Announcement = require("../models/announcement");
const User = require("../models/user");
exports.createAnnouncement = async (req, res, next) => {
  try {
    const data = req.body;

    const announcement = new Announcement(data);

    await announcement.save();

    return res.status(201).send(announcement._doc);
  } catch (err) {
    next(err);
  }
};
exports.getAnnouncementsByType = async (req, res, next) => {
  try {
    const user = req.user;
    const { type } = req.params;
    let query = { type };

    if (user && user.userType !== "admin") {
      query.$or = [
        { visibility: "all" },
        { visibility: user.userType }
      ];
    }

    const announcements = await Announcement.find(query).sort({ createdAt: -1 });
    return res.status(200).send(announcements);
  } catch (err) {
    next(err);
  }
};

exports.getAnnouncements = async (req, res, next) => {
  try {
    const user = req.user;
    let query = {};

    if (user && user.userType !== "admin") {
      query = {
        $or: [
          { visibility: "all" },
          { visibility: user.userType }
        ]
      };
    }

    const announcements = await Announcement.find(query).sort({ createdAt: -1 });
    return res.status(200).send(announcements);
  } catch (err) {
    next(err);
  }
};

exports.updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    return res.status(200).send(announcement._doc);
  } catch (err) {
    next(err);
  }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getAnnouncementsByUserType = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    // Determine visibility for this user based on their userType
    let query = {};

    if (user.userType !== "admin") {
      query = {
        $or: [
          { visibility: "all" },
          { visibility: user.userType },
        ],
      };
    }

    // Fetch announcements based on visibility
    const announcements = await Announcement.find(query).sort({ createdAt: -1 });

    return res.status(200).send(announcements);

  } catch (err) {
    next(err);
  }
};