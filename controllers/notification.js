const prisma = require("../db/prisma");

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        deliveredTo: { some: { id: req.user.id } }
      },
      include: {
        user: true,
        readBy: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(
      notifications.map((not) => {
        const isRead = not.readBy.some(readUser => readUser.id === req.user.id);
        return {
          ...not,
          deliveredTo: undefined,
          readBy: undefined,
          isRead: isRead
        };
      })
    );
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.marksNotificationAsRead = async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
      include: { deliveredTo: true, readBy: true }
    });

    if (!notification) return res.status(404).json("Notification not found");

    const isDelivered = notification.deliveredTo.some(u => u.id === req.user.id);
    if (!isDelivered) return res.status(403).json("You can't read this notification");

    const alreadyRead = notification.readBy.some(u => u.id === req.user.id);
    if (!alreadyRead) {
      await prisma.notification.update({
        where: { id: req.params.id },
        data: {
          readBy: { connect: { id: req.user.id } }
        }
      });
    }

    res.status(200).json("Notification marked as read");
  } catch (err) {
    res.status(500).json(err);
  }
};
