const quizController = require("../controllers/quiz");
const quizRouter = require("express").Router();

quizRouter.post("/", quizController.createQuiz);
quizRouter.put("/:id", quizController.editQuiz);
//delete quiz
quizRouter.delete("/:id", quizController.deleteQuiz);
//get quizes of classroom
quizRouter.get(
  "/all/classroom/:classroomID",
  quizController.getQuizesOfClassroom
);
//get quizes of classroom of teacher
quizRouter.get(
  "/all/teacher/classroom/:classroomID",
  quizController.getQuizesOfClassroomOfTeacher
);
//get all quizes of teacher
quizRouter.get("/all/teacher", quizController.getAllQuizesOfTeacher);
// get all quizes of student
quizRouter.get("/all/student", quizController.getAllQuizzesOfStudent);
//get quiz by id
quizRouter.get("/:id", quizController.getQuizById);
//submit quiz
quizRouter.post("/submit/:id", quizController.submitQuiz);
//grade quizes
quizRouter.post("/grade/:id", quizController.gradeQuizes);
// get quiz of student
quizRouter.get("/single/:id", quizController.getQuizById);

// get quiz for grading
quizRouter.get("/submissions/:quizID", quizController.getQuizForGrading);

module.exports = quizRouter;
