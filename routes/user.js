const express = require("express");
const userRouter = express.Router();
const controller = require("../controllers/user");

// update user
userRouter.put("/update", controller.updateUser);

userRouter.put("/admin/user/update-student-subject/:studentId", controller.updateStudentSubject);



// Logout route
userRouter.get("/logout", controller.logout);

// get users not in classroom
userRouter.get("/not-in-classroom/:levelID", controller.getUsersNotInClassroom);

// get admins (Super Admin only)
userRouter.get("/admins", controller.getAllAdmins);

// get users
userRouter.get("/", controller.getUsers);

// accept user
userRouter.put("/accept/:userID", controller.acceptUser);

// reject user
userRouter.delete("/reject/:userID", controller.rejectUser);

// get all students
userRouter.get("/students", controller.getAllStudents);

userRouter.get("/students-with-level/:levelId", controller.getAllStudentsWithLevel);


// get students of teacher
userRouter.get("/students-of-teacher", controller.getStudentsOfTeacher);

// get student report for teacher
userRouter.get(
  "/student-report/:studentID",
  controller.getStudentReportForTeacher
);

// get student report for admin
userRouter.get(
  "/student-reports-admin/:studentID",
  controller.getStudentReportsForAdmin
);

// get subjects of student for admin
userRouter.get("/student-subjects/:studentID", controller.getStudentSubjects);
userRouter.get("/student-subjects-with-level/:levelID", controller.getSubjectsWithLevel);
// get assignments and quizes of student of a subject for admin
userRouter.get(
  "/student-assignments-quizes/:studentID/:subjectID",
  controller.getStudentGradesForSubject
);

// get teachers for admin
userRouter.get("/admin/teachers", controller.getTeachersForAdmin);

// update user by admin
userRouter.put("/admin/user/:userID", controller.updateUserByAdmin);

// delete user by admin
userRouter.delete("/admin/user/:userID", controller.deleteUserByAdmin);

// get subjects of student for student
userRouter.get("/student/subjects", controller.getStudentSubjectsForStudent);

// get assignments and quizes of student of a subject for student
userRouter.get(
  "/student/assignments-quizes/:subjectID",
  controller.getStudentGradesForSubjectForStudent
);

userRouter.put("/update-password", controller.updatePassword);


module.exports = userRouter;
