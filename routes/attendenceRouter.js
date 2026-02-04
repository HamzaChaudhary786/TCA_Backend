const express = require("express");
const authRouter = express.Router();
const controller = require("../controllers/attendence");

// Create Head Attendence
authRouter.post("/add-classroom-attendence/:id", controller.createAttendence);
authRouter.get("/get-attandence/:classroomID", controller.getClassroomAttendence);
authRouter.put("/update-attandence/:classroomID", controller.updateClassroomAttendence);


// get all subjects attendence of student


authRouter.get("/student-all-subjects-attendence/:studentID", controller.getOverallAttendenceOfSubjects);








module.exports = authRouter;
