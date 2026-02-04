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
    const announcements = await Announcement.find({ type: req.params.type })

    return res.status(200).send(announcements);
  } catch (err) { }
};
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find()

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
    // Get the userType of the logged-in user
    const userId = req.user._id;  // Assuming you have userId from the session or JWT token

    console.log(userId, "current user");

    const user = await User.findById(userId);

    console.log(user, "all user data");


    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // Determine visibility for this user based on their userType
    let visibilityFilter = 'all';  // Default to 'all' in case something goes wrong

    if (user.userType === 'student') {
      visibilityFilter = 'student';
    } else if (user.userType === 'parent') {
      visibilityFilter = 'parent';
    } else if (user.userType === 'teacher') {
      visibilityFilter = 'teacher';
    }

    // Fetch announcements based on visibility
    const announcements = await Announcement.find({
      $or: [
        { visibility: 'all' }, // Visible to everyone
        { visibility: visibilityFilter }, // Visible based on the user's type
      ],
    }).sort({ createdAt: -1 });

    return res.status(200).send(announcements);

  } catch (err) {
    next(err);
  }
};