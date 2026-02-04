const notificationController = require("../controllers/notification");
const notificationRouter = require("express").Router();

notificationRouter.get("/", notificationController.getNotifications);
notificationRouter.put("/:id", notificationController.marksNotificationAsRead);

module.exports = notificationRouter;
