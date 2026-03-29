const mongoose = require("mongoose");
const Classroom = require("../models/classroom");
const Quiz = require("../models/quiz");
const Notification = require("../models/notification");
const User = require("../models/user");
const Subject = require("../models/subject");



exports.createQuiz = async (req, res, next) => {
  const {
    title,
    text,
    totalMarks,
    dueDate,
    files,
    canSubmitAfterTime,
    classroomID,
    subjectID,
  } = req.body;
  const createdBy = req.user._id;
  try {
    //check if classroom exists and teacher is part of that classroom
    const classroom = await Classroom.findById(classroomID);
    if (!classroom) {
      return res.status(404).json({ message: "Classroom not found" });
    }

    if (new Date() > new Date(dueDate)) {
      return res
        .status(400)
        .json({ message: "Due date should be greater than current date" });
    }

    const isTeacher = classroom.teachers.find(
      (tea) => tea.teacher.toString() == req.user._id.toString()
    );
    if (!isTeacher) {
      return res.status(403).json({ message: "You are not a teacher in this classroom" });
    }

    const quiz = new Quiz({
      title,
      text,
      totalMarks,
      dueDate,
      files,
      canSubmitAfterTime,
      createdBy,
      classroomID,
      subjectID,
    });
    await quiz.save();

    // Create notifications for students and parents
    const students = await User.find({ _id: { $in: classroom.students } });
    const studentIds = students.map((s) => s._id);

    // Collect all unique guardian emails and IDs
    const guardianIds = new Set();
    const guardianEmails = new Set();

    students.forEach(s => {
      if (s.guardianId) guardianIds.add(s.guardianId.toString());
      if (s.guardianEmail) guardianEmails.add(s.guardianEmail);
    });

    // Find parent users who match the emails if they aren't already in the IDs set
    if (guardianEmails.size > 0) {
      const parentUsers = await User.find({ email: { $in: Array.from(guardianEmails) }, userType: "parent" });
      parentUsers.forEach(p => guardianIds.add(p._id.toString()));
    }

    const parentIdsArray = Array.from(guardianIds).map(id => mongoose.Types.ObjectId(id));
    const subject = await Subject.findById(subjectID);

    if (studentIds.length > 0) {
      await Notification.create({
        userID: createdBy,
        deliveredTo: studentIds,
        message: `New quiz created: ${title}`,
        subjectName: subject ? subject.name : "Subject",
        classroomName: classroom.name,
      });
    }

    if (parentIdsArray.length > 0) {
      await Notification.create({
        userID: createdBy,
        deliveredTo: parentIdsArray,
        message: `New quiz created for your child: ${title}`,
        subjectName: subject ? subject.name : "Subject",
        classroomName: classroom.name,
      });
    }

    res.status(201).send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.editQuiz = async (req, res, next) => {
  const { title, text, totalMarks, subjectID, dueDate, files, canSubmitAfterTime } = req.body;
  const { id } = req.params;

  try {
    if (dueDate) {
      if (new Date() > new Date(dueDate)) {
        return res
          .status(400)
          .json({ message: "Due date should be greater than current date" });
      }
    }

    // check if quiz exists and teacher who created quiz is editing it
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to edit this quiz" });
    }

    quiz.title = title ? title : quiz.title;
    quiz.text = text ? text : quiz.text;
    quiz.totalMarks = totalMarks ? totalMarks : quiz.totalMarks;
    quiz.subjectID = subjectID ? subjectID : quiz.subjectID;
    quiz.dueDate = dueDate ? dueDate : quiz.dueDate;
    quiz.files = files ? files : quiz.files;
    quiz.canSubmitAfterTime = canSubmitAfterTime
      ? canSubmitAfterTime
      : quiz.canSubmitAfterTime;
    await quiz.save();
    res.status(200).send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.deleteQuiz = async (req, res, next) => {
  const { id } = req.params;
  try {
    // check if quiz exists and teacher who created quiz is deleting it

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).send();
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send();
    }
    await quiz.remove();
    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.submitQuiz = async (req, res, next) => {
  const { id } = req.params;
  const { file } = req.body;
  try {
    //check if quiz exists and student is part of that classroom

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).send();
    }
    const classroom = await Classroom.findById(quiz.classroomID);
    if (!classroom) {
      return res.status(404).send();
    }
    const isStudent = classroom.students.find(
      (stu) => stu.toString() == req.user._id.toString()
    );
    if (!isStudent) {
      return res.status(403).send();
    }

    //check if quiz is still open for submission
    if (!quiz.canSubmitAfterTime) {
      const now = new Date();
      if (now > quiz.dueDate) {
        return res.status(403).send("Can't submit after due date");
      }
    }

    //check if already submitted
    const isSubmitted = quiz.submissions.find(
      (sub) => sub.studentID.toString() == req.user._id.toString()
    );
    if (isSubmitted) {
      return res.status(403).send("Already submitted");
    }

    const submission = {
      studentID: req.user._id,
      file,
      isLate: new Date() > quiz.dueDate,
    };
    quiz.submissions.push(submission);
    await quiz.save();

    // Create notifications for teacher and parent
    let recipients = [quiz.createdBy];
    if (req.user.guardianId) {
      recipients.push(req.user.guardianId);
    } else if (req.user.guardianEmail) {
      const parent = await User.findOne({ email: req.user.guardianEmail, userType: "parent" });
      if (parent) recipients.push(parent._id);
    }

    const populatedQuiz = await Quiz.findById(id).populate("subjectID classroomID");
    await Notification.create({
      userID: req.user._id,
      deliveredTo: recipients,
      message: `${req.user.name} submitted a quiz`,
      subjectName: populatedQuiz.subjectID.name,
      classroomName: populatedQuiz.classroomID.name,
      file: {
        name: file.split("/").pop() || "quiz",
        url: file
      }
    });

    res.status(201).send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.gradeQuizes = async (req, res, next) => {
  //grade multiple quizes
  const { id } = req.params;
  const { submissions } = req.body;
  try {
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).send();
    }

    //check if submissions has marks greater than total marks
    const invalidMarks = submissions.find((s) => s.marks > quiz.totalMarks);
    if (invalidMarks) {
      return res.status(400).send("Invalid marks");
    }

    // check if teacher who created quiz is grading it
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send();
    }

    // find submission in quiz and update only marks, feedback and grade
    // const updatedSubmissions = quiz.submissions.map((submission) => {
    //   const newSubmission = submissions.find(
    //     (s) => s.studentID.toString() == submission.studentID.toString()
    //   );

    //   if (newSubmission) {
    //     submission.marks = newSubmission.marks;
    //     submission.feedback = newSubmission.feedback
    //       ? newSubmission.feedback
    //       : "";
    //     submission.grade = "A";
    //   }
    //   return submission;
    // });

    // quiz.submissions = updatedSubmissions;

    // Update submissions: support students who haven't submitted yet
    submissions.forEach((updatedSubmission) => {
      const existingSubmission = quiz.submissions.find(
        (s) => s.studentID.toString() === updatedSubmission.studentID.toString()
      );

      if (existingSubmission) {
        // Update existing submission
        existingSubmission.feedback = updatedSubmission.feedback !== undefined ? updatedSubmission.feedback : existingSubmission.feedback;
        existingSubmission.grade = updatedSubmission.grade !== undefined ? updatedSubmission.grade : existingSubmission.grade;
        existingSubmission.marks = updatedSubmission.marks !== undefined ? updatedSubmission.marks : existingSubmission.marks;
      } else {
        // Create new entry for students who haven't submitted
        quiz.submissions.push({
          studentID: updatedSubmission.studentID,
          feedback: updatedSubmission.feedback || "",
          grade: updatedSubmission.grade || "",
          marks: updatedSubmission.marks !== undefined ? updatedSubmission.marks : 0,
        });
      }
    });

    await quiz.save();
    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.getQuizesOfClassroom = async (req, res, next) => {
  const { classroomID } = req.params;
  try {
    const quiz = await Quiz.find({ classroomID });
    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.getQuizesOfClassroomOfTeacher = async (req, res, next) => {
  const { classroomID } = req.params;
  const createdBy = req.user._id;
  try {
    const quizes = await Quiz.find({ classroomID, createdBy });
    res.send(quizes);
  } catch (error) {
    next(error);
  }
};

exports.getAllQuizesOfTeacher = async (req, res, next) => {
  const createdBy = req.user._id;

  try {
    const quizes = await Quiz.find({ createdBy })
      .populate({
        path: "createdBy",
        select: "name email", // Teacher info
        model: "User",
      })
      .populate({
        path: "subjectID",
        select: "name", // Subject name
        model: "Subject",
      })
      .populate({
        path: "classroomID",
        model: "Classroom",
        populate: [
          {
            path: "students",
            select: "name email levelID subjects",
            model: "User",
          },
          {
            path: "teachers.teacher",
            select: "name email",
            model: "User",
          },
          {
            path: "teachers.subject",
            select: "name",
            model: "Subject",
          },
          {
            path: "levelID",
            model: "Level",
          }
        ],
      });

    res.send(quizes);
  } catch (error) {
    next(error);
  }
};


exports.getQuizById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).send();
    }
    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.getStudentQuiz = async (req, res, next) => {
  const { id } = req.params;
  const studentID = req.user._id;
  try {
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).send();
    }
    const submission = quiz.submissions.find(
      (sub) => sub.studentID.toString() == studentID.toString()
    );
    if (!submission) {
      return res.status(404).send();
    }
    res.send({ totalMarks: quiz.totalMarks, submission });
  } catch (error) {
    next(error);
  }
};

exports.getAllQuizzesOfStudent = async (req, res, next) => {
  try {
    const studentID = req.user._id;

    // get all classrooms of student and then get all assignments of those classrooms
    const classrooms = await Classroom.find({ students: studentID });
    const classroomIDs = classrooms.map((c) => c._id);
    const quizzes = await Quiz.find({
      classroomID: { $in: classroomIDs },
    }).populate("subjectID").populate("classroomID").populate("createdBy");

    // check if user has submitted the assignment and add isSubmitted to each assignment
    const quizzesWithSubmission = quizzes.map((assignment) => {
      const submission = assignment.submissions.find(
        (s) => s.studentID.toString() == studentID.toString()
      );
      if (submission) {
        return { ...assignment._doc, isSubmitted: true };
      }
      return { ...assignment._doc, isSubmitted: false };
    });

    res.send(quizzesWithSubmission);
  } catch (error) {
    next(error);
  }
};

exports.getQuizForGrading = async (req, res, next) => {
  try {
    const teacherID = req.user._id;
    const { quizID } = req.params;

    // return all submission of assignment based on students in classroomID
    const quiz = await Quiz.findOne({
      _id: quizID,
      createdBy: teacherID,
    }).populate("submissions.studentID");
    if (!quiz) {
      return res.status(404).send();
    }
    const classroomID = quiz.classroomID;
    const classroom = await Classroom.findById(classroomID).populate({
      path: "students",
      select: "name email profilePic levelID subjects"
    });
    if (!classroom) {
      return res.status(404).send();
    }

    // Filter students: include if they are enrolled in the subject, or if they have no subjects assigned (fallback to all students in classroom)
    const students = classroom.students.filter(student => {
      if (!student.subjects || student.subjects.length === 0) return true;
      return student.subjects.some(sub => sub.toString() === quiz.subjectID.toString());
    });

    // return all students of classroom and check if they have submitted the quiz
    const submissions = students.map((studentID) => {
      const submission = quiz.submissions.find(
        (s) => s.studentID._id.toString() == studentID._id.toString()
      );
      if (submission) {
        return { submission: { ...submission._doc }, studentID };
      }
      return { studentID };
    });

    res.send({ ...quiz._doc, submissions });
  } catch (error) {
    next(error);
  }
};
