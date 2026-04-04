const quizController = require("../controllers/quiz");
const quizRouter = require("express").Router();

quizRouter.post("/", quizController.createQuiz);

// get quizes of classroom
quizRouter.get(
  "/all/classroom/:classroomID",
  quizController.getQuizesOfClassroom
);
// get quizes of classroom of teacher
quizRouter.get(
  "/all/teacher/classroom/:classroomID",
  quizController.getQuizesOfClassroomOfTeacher
);
// get all quizes of teacher
quizRouter.get("/all/teacher", quizController.getAllQuizesOfTeacher);
// get all quizes of student
quizRouter.get("/all/student", quizController.getAllQuizzesOfStudent);

// get quiz for grading
quizRouter.get("/submissions/:quizID", quizController.getQuizForGrading);

// check plagiarism for a quiz
quizRouter.get("/check-plagiarism/:quizID", quizController.checkPlagiarism);
// check single student submission for AI + plagiarism
quizRouter.get("/check-submission/:quizID/:studentID", quizController.checkSingleSubmission);

// specific routes before generic :id
quizRouter.post("/submit/:id", quizController.submitQuiz);
quizRouter.post("/grade/:id", quizController.gradeQuizes);
quizRouter.get("/single/:id", quizController.getQuizById);

// generic :id routes at the bottom
quizRouter.put("/:id", quizController.editQuiz);
quizRouter.delete("/:id", quizController.deleteQuiz);
quizRouter.get("/:id", quizController.getQuizById);

module.exports = quizRouter;
