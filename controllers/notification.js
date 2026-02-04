const Notification = require("../models/notification")

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      deliveredTo: req.user._id,
    })
      .populate("sentBy")
      .sort({ createdAt: -1 });

    res.status(200).json(
      notifications.map((not) => {
        return {
          ...not._doc,
          deliveredTo: undefined,
          readBy: undefined,
          isRead: not.readBy.includes(req.user._id),
        };
      })
    );
  } catch (err) {
    res.status(500).json(err);
  }
};
exports.marksNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json("Notification not found");
    }

    if (!notification.deliveredTo.includes(req.user._id)) {
      return res.status(403).json("You can't read this notification");
    }

    if (!notification.readBy.includes(req.user._id)) {
      notification.readBy.push(req.user._id);
      await notification.save();
    }

    res.status(200).json("Notification marked as read");
  } catch (err) {
    res.status(500).json(err);
  }
};
