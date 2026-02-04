const assignmentController = require("../controllers/assignment");
const assignmentRouter = require("express").Router();

assignmentRouter.post("/", assignmentController.createAssignment);
assignmentRouter.put("/:id", assignmentController.editAssignment);
//delete assignment
assignmentRouter.delete("/:id", assignmentController.deleteAssignment);
//get assignments of classroom
assignmentRouter.get(
  "/all/classroom/:classroomID",
  assignmentController.getAssignmentsOfClassroom
);
//get assignments of classroom of teacher
assignmentRouter.get(
  "/all/teacher/classroom/:classroomID",
  assignmentController.getAssignmentsOfClassroomOfTeacher
);
//get all assignments of teacher
assignmentRouter.get(
  "/all/teacher",
  assignmentController.getAllAssignmentsOfTeacher
);
// get all assignments of student
assignmentRouter.get(
  "/all/student",
  assignmentController.getAllAssignmentsOfStudent
);
//get assignment by id
assignmentRouter.get("/:id", assignmentController.getAssignmentById);
//submit assignment
assignmentRouter.post("/submit/:id", assignmentController.submitAssignment);
//grade assignments
assignmentRouter.post("/grade/:id", assignmentController.gradeAssignments);
// get assignment of student
assignmentRouter.get("/single/:id", assignmentController.getAssignmentById);

// get assignment for grading
assignmentRouter.get(
  "/submissions/:assignmentID",
  assignmentController.getAssignmentForGrading
);

module.exports = assignmentRouter;
