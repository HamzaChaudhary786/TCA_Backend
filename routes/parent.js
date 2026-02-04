const parentController = require("../controllers/parent");
const { isStudentChild } = require("../middlewares/isStudentChild");
const parentRouter = require("express").Router();

// get student report for parent
parentRouter.get(
  "/student-report/:studentID",
  isStudentChild,
  parentController.getStudentReportForParent
);
parentRouter.get(
  "/student-subjects/:studentID",
  isStudentChild,
  parentController.getChilSubjects
);
parentRouter.get(
  "/chats/:studentID",
  isStudentChild,
  parentController.getParentChats
);

parentRouter.get("/children/:email", parentController.getChildrenOfParent);




parentRouter.get(
  "/student-last-delivered-assignment-report/:studentID",
  isStudentChild,
  parentController.getStudentLastDeliveredAssignmentReport
);

module.exports = parentRouter;
