const prisma = require("../db/prisma");

exports.createQuiz = async (req, res, next) => {
  const { title, text, totalMarks, dueDate, files, canSubmitAfterTime, classroomID, subjectID } = req.body;
  const createdBy = req.user.id;
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomID },
      include: { teachers: true, students: true }
    });
    if (!classroom) return res.status(404).json({ message: "Classroom not found" });

    if (new Date() > new Date(dueDate)) return res.status(400).json({ message: "Due date should be greater than current date" });

    const isTeacher = classroom.teachers.find(tea => tea.teacherID === createdBy);
    if (!isTeacher) return res.status(403).json({ message: "You are not a teacher in this classroom" });

    const quiz = await prisma.quiz.create({
      data: {
        title,
        text,
        totalMarks: parseInt(totalMarks) || 0,
        dueDate: new Date(dueDate),
        canSubmitAfterTime: canSubmitAfterTime === 'true' || canSubmitAfterTime === true,
        createdBy,
        classroomID,
        subjectID,
        files: {
          create: (files || []).map(f => ({
            name: typeof f === 'string' ? f.split('/').pop() : f.name,
            url: typeof f === 'string' ? f : f.url
          }))
        }
      }
    });

    // Notifications
    const studentIds = classroom.students.map(s => s.id);
    const guardianIds = classroom.students.map(s => s.guardianId).filter(Boolean);
    const subject = await prisma.subject.findUnique({ where: { id: subjectID } });

    if (studentIds.length > 0) {
      await prisma.notification.create({
        data: {
          userID: createdBy,
          message: `New quiz created: ${title}`,
          subjectName: subject ? subject.name : "Subject",
          classroomName: classroom.name,
          deliveredTo: { connect: studentIds.map(id => ({ id })) }
        }
      });
    }

    if (guardianIds.length > 0) {
      await prisma.notification.create({
        data: {
          userID: createdBy,
          message: `New quiz created for your child: ${title}`,
          subjectName: subject ? subject.name : "Subject",
          classroomName: classroom.name,
          deliveredTo: { connect: guardianIds.map(id => ({ id })) }
        }
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
    if (dueDate && new Date() > new Date(dueDate)) return res.status(400).json({ message: "Due date should be greater than current date" });

    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (quiz.createdBy !== req.user.id) return res.status(403).json({ message: "Unauthorized to edit this quiz" });

    const updated = await prisma.quiz.update({
      where: { id },
      data: {
        title: title || undefined,
        text: text || undefined,
        totalMarks: (totalMarks !== undefined && totalMarks !== "") ? (parseInt(totalMarks) || 0) : undefined,
        subjectID: subjectID || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        canSubmitAfterTime: canSubmitAfterTime !== undefined ? (canSubmitAfterTime === 'true' || canSubmitAfterTime === true) : undefined,
        files: files ? {
          deleteMany: {},
          create: files.map(f => ({
            name: typeof f === 'string' ? f.split('/').pop() : f.name,
            url: typeof f === 'string' ? f : f.url
          }))
        } : undefined
      }
    });
    res.status(200).send(updated);
  } catch (error) {
    next(error);
  }
};

exports.deleteQuiz = async (req, res, next) => {
  const { id } = req.params;
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).send();
    if (quiz.createdBy !== req.user.id) return res.status(403).send();

    await prisma.$transaction([
      prisma.file.deleteMany({ where: { quizID: id } }),
      prisma.quizSubmission.deleteMany({ where: { quizID: id } }),
      prisma.quiz.delete({ where: { id } })
    ]);

    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.submitQuiz = async (req, res, next) => {
  const { id } = req.params;
  const { file } = req.body;
  const studentID = req.user.id;
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: { subject: true, classroom: true }
    });
    if (!quiz) return res.status(404).send();

    if (!quiz.canSubmitAfterTime && new Date() > quiz.dueDate) return res.status(403).send("Can't submit after due date");

    const isStudent = await prisma.classroom.findFirst({
        where: { id: quiz.classroomID, students: { some: { id: studentID } } }
    });
    if (!isStudent) return res.status(403).send();

    const alreadySubmitted = await prisma.quizSubmission.findFirst({
        where: { quizID: id, studentID }
    });
    if (alreadySubmitted) return res.status(403).send("Already submitted");

    const submission = await prisma.quizSubmission.create({
      data: {
        quizID: id,
        studentID,
        file,
        isLate: new Date() > quiz.dueDate
      }
    });

    // Notifications
    const student = req.user;
    const recipients = [quiz.createdBy, student.guardianId].filter(Boolean);

    await prisma.notification.create({
      data: {
        userID: studentID,
        message: `${student.name} submitted a quiz`,
        subjectName: quiz.subject.name,
        classroomName: quiz.classroom.name,
        deliveredTo: { connect: recipients.map(rid => ({ id: rid })) }
      }
    });

    res.status(201).send(submission);
  } catch (error) {
    next(error);
  }
};

exports.gradeQuizes = async (req, res, next) => {
  const { id } = req.params;
  const { submissions } = req.body;
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).send();
    if (quiz.createdBy !== req.user.id) return res.status(403).send();

    const invalidMarks = submissions.find(s => s.marks > quiz.totalMarks);
    if (invalidMarks) return res.status(400).send("Invalid marks");

    for (const s of submissions) {
        const existing = await prisma.quizSubmission.findFirst({ where: { quizID: id, studentID: s.studentID } });
        if (existing) {
            await prisma.quizSubmission.update({ 
                where: { id: existing.id }, 
                data: { feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        } else {
            await prisma.quizSubmission.create({ 
                data: { quizID: id, studentID: s.studentID, feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        }
    }

    res.send({ message: "Graded successfully" });
  } catch (error) {
    next(error);
  }
};

exports.getQuizesOfClassroom = async (req, res, next) => {
  const { classroomID } = req.params;
  try {
    const quizzes = await prisma.quiz.findMany({ where: { classroomID } });
    res.send(quizzes);
  } catch (error) {
    next(error);
  }
};

exports.getQuizesOfClassroomOfTeacher = async (req, res, next) => {
  const { classroomID } = req.params;
  const createdBy = req.user.id;
  try {
    const quizes = await prisma.quiz.findMany({ where: { classroomID, createdBy } });
    res.send(quizes);
  } catch (error) {
    next(error);
  }
};

exports.getAllQuizesOfTeacher = async (req, res, next) => {
  const createdBy = req.user.id;
  try {
    const quizes = await prisma.quiz.findMany({
      where: { createdBy },
      include: {
        creator: true,
        subject: true,
        submissions: true,
        classroom: {
          include: {
            students: true,
            teachers: { include: { teacher: true, subject: true } },
          }
        }
      }
    });

    const result = quizes.map(q => ({
        ...q,
        classroomID: q.classroom,
        subjectID: q.subject,
        creator: q.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};


exports.getQuizById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).send();
    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.getStudentQuiz = async (req, res, next) => {
  const { id } = req.params;
  const studentID = req.user.id;
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).send();

    const submission = await prisma.quizSubmission.findFirst({
        where: { quizID: id, studentID }
    });
    if (!submission) return res.status(404).send();
    res.send({ totalMarks: quiz.totalMarks, submission });
  } catch (error) {
    next(error);
  }
};

exports.getAllQuizzesOfStudent = async (req, res, next) => {
  try {
    const studentID = req.user.id;
    const quizzes = await prisma.quiz.findMany({
      where: { classroom: { students: { some: { id: studentID } } } },
      include: {
          subject: true,
          classroom: true,
          creator: true,
          files: true,
          submissions: { where: { studentID } }
      }
    });

    const result = quizzes.map(q => ({
        ...q,
        isSubmitted: q.submissions.length > 0,
        classroomID: q.classroom,
        subjectID: q.subject,
        creator: q.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getQuizForGrading = async (req, res, next) => {
  try {
    const teacherID = req.user.id;
    const { quizID } = req.params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizID },
      include: {
          submissions: { include: { student: true } },
          classroom: { include: { students: true } }
      }
    });
    if (!quiz || quiz.createdBy !== teacherID) return res.status(404).send();

    const students = quiz.classroom.students.filter(student => 
      student.subjects.includes(quiz.subjectID)
    );
    const submissions = students.map(student => {
        const sub = quiz.submissions.find(s => s.studentID === student.id);
        return sub ? { submission: sub, studentID: student } : { studentID: student };
    });

    res.send({ ...quiz, submissions });
  } catch (error) {
    next(error);
  }
};
