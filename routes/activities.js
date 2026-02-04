const activitiesController = require("../controllers/activities");
const activitiesRouter = require("express").Router();

activitiesRouter.get("/:userID", activitiesController.getUserActivities);
