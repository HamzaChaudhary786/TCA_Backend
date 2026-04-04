const assignmentController = require("../controllers/assignment");
const assignmentRouter = require("express").Router();

assignmentRouter.post("/", assignmentController.createAssignment);

// DIAGNOSTIC: Move single submission check to top to rule out route shadowing
assignmentRouter.get("/check-submission/:assignmentID/:studentID", assignmentController.checkSingleSubmission);

// get assignments of classroom
assignmentRouter.get(
  "/all/classroom/:classroomID",
  assignmentController.getAssignmentsOfClassroom
);
// get assignments of classroom of teacher
assignmentRouter.get(
  "/all/teacher/classroom/:classroomID",
  assignmentController.getAssignmentsOfClassroomOfTeacher
);
// get all assignments of teacher
assignmentRouter.get(
  "/all/teacher",
  assignmentController.getAllAssignmentsOfTeacher
);
// get all assignments of student
assignmentRouter.get(
  "/all/student",
  assignmentController.getAllAssignmentsOfStudent
);

// get assignment for grading
assignmentRouter.get(
  "/submissions/:assignmentID",
  assignmentController.getAssignmentForGrading
);

// check plagiarism for an assignment
assignmentRouter.get("/check-plagiarism/:assignmentID", assignmentController.checkPlagiarism);
// check single student submission for AI + plagiarism

// specific routes before generic :id
assignmentRouter.post("/submit/:id", assignmentController.submitAssignment);
assignmentRouter.post("/grade/:id", assignmentController.gradeAssignments);
assignmentRouter.get("/single/:id", assignmentController.getAssignmentById);

// generic :id routes at the bottom
assignmentRouter.put("/:id", assignmentController.editAssignment);
assignmentRouter.delete("/:id", assignmentController.deleteAssignment);
assignmentRouter.get("/:id", assignmentController.getAssignmentById);

module.exports = assignmentRouter;
