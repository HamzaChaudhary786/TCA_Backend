const prisma = require("../db/prisma");

exports.createAssignment = async (req, res, next) => {
  const { title, text, totalMarks, dueDate, files, classroomID, subjectID } = req.body;
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomID },
      include: { teachers: true, students: true }
    });
    if (!classroom) return res.status(404).send();

    if (new Date() > new Date(dueDate)) return res.status(400).send("Due date should be greater than current date");

    const isTeacher = classroom.teachers.find(tea => tea.teacherID === req.user.id);
    if (!isTeacher) return res.status(403).send();

    const createdBy = req.user.id;
    const assignment = await prisma.assignment.create({
      data: {
        title,
        text,
        totalMarks: parseInt(totalMarks) || 0,
        dueDate: new Date(dueDate),
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
          message: `New assignment created: ${title}`,
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
          message: `New assignment created for your child: ${title}`,
          subjectName: subject ? subject.name : "Subject",
          classroomName: classroom.name,
          deliveredTo: { connect: guardianIds.map(id => ({ id })) }
        }
      });
    }

    res.status(201).send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.editAssignment = async (req, res, next) => {
  const { title, text, totalMarks, dueDate, files, subjectID, classroomID } = req.body;
  const { id } = req.params;
  try {
    if (dueDate && new Date() > new Date(dueDate)) return res.status(400).json({ message: "Due date should be greater than current date" });

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (assignment.createdBy !== req.user.id) return res.status(403).json({ message: "Unauthorized to edit this assignment" });

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        title: title || undefined,
        text: text || undefined,
        totalMarks: (totalMarks !== undefined && totalMarks !== "") ? (parseInt(totalMarks) || 0) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        subjectID: subjectID || undefined,
        classroomID: classroomID || undefined,
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

exports.deleteAssignment = async (req, res, next) => {
  const { id } = req.params;
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).send();
    if (assignment.createdBy !== req.user.id) return res.status(403).send();

    await prisma.$transaction([
      prisma.file.deleteMany({ where: { assignmentID: id } }),
      prisma.assignmentSubmission.deleteMany({ where: { assignmentID: id } }),
      prisma.assignment.delete({ where: { id } })
    ]);

    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroom = async (req, res, next) => {
  const { classroomID } = req.params;
  try {
    const assignments = await prisma.assignment.findMany({ where: { classroomID } });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroomOfTeacher = async (req, res, next) => {
  const { classroomID } = req.params;
  const createdBy = req.user.id;
  try {
    const assignments = await prisma.assignment.findMany({ where: { classroomID, createdBy } });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsOfTeacher = async (req, res, next) => {
  const createdBy = req.user.id;
  try {
    const assignments = await prisma.assignment.findMany({
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

    const result = assignments.map(a => ({
        ...a,
        classroomID: a.classroom,
        subjectID: a.subject,
        creator: a.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};


exports.getAssignmentById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).send();
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.submitAssignment = async (req, res, next) => {
  const { id } = req.params;
  const { file } = req.body;
  const studentID = req.user.id;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { classroom: true, subject: true }
    });
    if (!assignment) return res.status(404).send();

    const isStudent = await prisma.classroom.findFirst({
        where: { id: assignment.classroomID, students: { some: { id: studentID } } }
    });
    if (!isStudent) return res.status(403).send();

    const alreadySubmitted = await prisma.assignmentSubmission.findFirst({
        where: { assignmentID: id, studentID }
    });
    if (alreadySubmitted) return res.status(400).send("Already submitted");

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentID: id,
        studentID,
        file,
        isLate: new Date() > assignment.dueDate
      }
    });

    // Notifications
    const student = req.user;
    const recipients = [assignment.createdBy, student.guardianId].filter(Boolean);
    
    await prisma.notification.create({
      data: {
        userID: studentID,
        message: `${student.name} submitted an assignment`,
        subjectName: assignment.subject.name,
        classroomName: assignment.classroom.name,
        deliveredTo: { connect: recipients.map(rid => ({ id: rid })) }
      }
    });

    res.status(201).send(submission);
  } catch (error) {
    next(error);
  }
};
exports.gradeAssignments = async (req, res, next) => {
  const { id } = req.params;
  const { submissions } = req.body;

  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).send("Assignment not found");
    if (assignment.createdBy !== req.user.id) return res.status(403).send("Unauthorized to grade this assignment");

    const invalidMarks = submissions.find(s => s.marks > assignment.totalMarks);
    if (invalidMarks) return res.status(400).send("Invalid marks: Marks exceed total marks");

    for (const s of submissions) {
        const existing = await prisma.assignmentSubmission.findFirst({ where: { assignmentID: id, studentID: s.studentID } });
        if (existing) {
            await prisma.assignmentSubmission.update({ 
                where: { id: existing.id }, 
                data: { feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        } else {
            await prisma.assignmentSubmission.create({ 
                data: { assignmentID: id, studentID: s.studentID, feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        }
    }

    res.send({ message: "Graded successfully" });
  } catch (error) {
    next(error);
  }
};


exports.getStudentAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentID = req.user.id;
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).send();

    const submission = await prisma.assignmentSubmission.findFirst({
        where: { assignmentID: id, studentID }
    });
    if (!submission) return res.status(404).send();
    res.send({ totalMarks: assignment.totalMarks, submission });
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsOfStudent = async (req, res, next) => {
  try {
    const studentID = req.user.id;

    const assignments = await prisma.assignment.findMany({
      where: { classroom: { students: { some: { id: studentID } } } },
      include: {
          subject: true,
          classroom: true,
          creator: true,
          files: true,
          submissions: { where: { studentID } }
      }
    });

    const result = assignments.map(a => ({
        ...a,
        isSubmitted: a.submissions.length > 0,
        classroomID: a.classroom,
        subjectID: a.subject,
        creator: a.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentForGrading = async (req, res, next) => {
  try {
    const teacherID = req.user.id;
    const { assignmentID } = req.params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentID },
      include: {
          submissions: { include: { student: true } },
          classroom: { include: { students: true } }
      }
    });
    if (!assignment || assignment.createdBy !== teacherID) return res.status(404).send();

    const students = assignment.classroom.students.filter(student => 
      student.subjects.includes(assignment.subjectID)
    );
    const submissions = students.map(student => {
        const sub = assignment.submissions.find(s => s.studentID === student.id);
        return sub ? { submission: sub, studentID: student } : { studentID: student };
    });

    res.send({ ...assignment, submissions });
  } catch (error) {
    next(error);
  }
};
