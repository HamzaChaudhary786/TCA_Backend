const feedbackController = require("../controllers/feedback");
const feedbackRouter = require("express").Router();

feedbackRouter.get("/:userID", feedbackController.getUserFeedbacks);
feedbackRouter.post("/", feedbackController.addFeedback);
feedbackRouter.patch("/accept/:feedbackID", feedbackController.acceptFeedback);
feedbackRouter.patch("/reject/:feedbackID", feedbackController.rejectFeedback);
feedbackRouter.delete("/:feedbackID", feedbackController.deleteFeedback);

module.exports = feedbackRouter;
