const announcementRouter = require("express").Router();
const announcementController = require("../controllers/announcement");

announcementRouter.post("/", announcementController.createAnnouncement);
announcementRouter.get("/", announcementController.getAnnouncements);
announcementRouter.get("/:type", announcementController.getAnnouncementsByType);
announcementRouter.put("/:id", announcementController.updateAnnouncement);
announcementRouter.delete("/:id", announcementController.deleteAnnouncement);

module.exports = announcementRouter;
