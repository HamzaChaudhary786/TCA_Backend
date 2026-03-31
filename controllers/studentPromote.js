const prisma = require("../db/prisma");

const createStudentPromotion = async (req, res) => {
  try {
    const {
      sourceClassroom,
      sourceLevel,
      targetClassroom,
      targetLevel,
      promotorDescription,
      students
    } = req.body;

    const currUser = req.user;

    const srcClassroom = await prisma.classroom.findUnique({
      where: { id: sourceClassroom },
      include: { students: true }
    });
    const tgtClassroom = await prisma.classroom.findUnique({
      where: { id: targetClassroom },
      include: { students: true }
    });

    if (!srcClassroom || !tgtClassroom) {
      return res.status(404).json({ success: false, message: 'Source or target classroom not found' });
    }

    const studentIds = students.map(s => s.id);

    // 1. Wrap the entire promotion process in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Gather & Archive Data for each student
      for (const student of students) {
        // Get attendance
        const attendanceRecords = await tx.attendanceRecord.findMany({
          where: { studentID: student.id, attendance: { entityId: sourceClassroom } },
          include: { attendance: true }
        });

        // Get assignments
        const submissions = await tx.assignmentSubmission.findMany({
          where: { studentID: student.id, assignment: { classroomID: sourceClassroom } },
          include: { assignment: true }
        });

        // Get quizzes
        const quizSubmissions = await tx.quizSubmission.findMany({
          where: { studentID: student.id, quiz: { classroomID: sourceClassroom } },
          include: { quiz: true }
        });

        // Get Scheduled Classes and Attendance
        const classAttendances = await tx.classAttendance.findMany({
          where: { studentID: student.id, class: { classroomID: sourceClassroom } },
          include: { class: true }
        });

        // Prepare archive document (Mapping to Prisma schema for ArchivedReport)
        await tx.archivedReport.create({
          data: {
            studentID: student.id,
            sourceClassroomID: sourceClassroom,
            targetClassroomID: targetClassroom,
            promotionDate: new Date(),
            attendance: {
              create: attendanceRecords.map(ar => ({
                date: ar.attendance.date,
                isPresent: ar.isPresent,
                late: ar.late
              }))
            },
            assignments: {
              create: submissions.map(s => ({
                assignmentID: s.assignmentID,
                title: s.assignment.title,
                totalMarks: s.assignment.totalMarks,
                obtainedMarks: s.marks || 0,
                grade: s.grade || "",
                feedback: s.feedback || "",
                submittedAt: s.submittedAt || new Date()
              }))
            },
            quizzes: {
              create: quizSubmissions.map(s => ({
                quizID: s.quizID,
                title: s.quiz.title,
                totalMarks: s.quiz.totalMarks,
                obtainedMarks: s.marks || 0,
                grade: s.grade || "",
                feedback: s.feedback || "",
                submittedAt: s.submittedAt || new Date()
              }))
            },
            scheduledClasses: { // Fixed field name (was 'classes')
              create: classAttendances.map(ca => ({
                classID: ca.classID,
                title: ca.class.title,
                startTime: ca.class.startTime,
                endTime: ca.class.endTime,
                subjectID: ca.class.subjectID,
                isPresent: ca.isPresent,
                late: ca.late
              }))
            }
          }
        });
      }

      // 2. Cleanup Data from Source Classroom
      await tx.attendanceRecord.deleteMany({
        where: { studentID: { in: studentIds }, attendance: { entityId: sourceClassroom } }
      });
      await tx.assignmentSubmission.deleteMany({
        where: { studentID: { in: studentIds }, assignment: { classroomID: sourceClassroom } }
      });
      await tx.quizSubmission.deleteMany({
        where: { studentID: { in: studentIds }, quiz: { classroomID: sourceClassroom } }
      });
      await tx.classAttendance.deleteMany({
        where: { studentID: { in: studentIds }, class: { classroomID: sourceClassroom } }
      });

      // 3. Move Students between classrooms and update levels
      await tx.classroom.update({
        where: { id: sourceClassroom },
        data: { students: { disconnect: studentIds.map(id => ({ id })) } }
      });
      await tx.classroom.update({
        where: { id: targetClassroom },
        data: { students: { connect: studentIds.map(id => ({ id })) } }
      });
      await tx.user.updateMany({
        where: { id: { in: studentIds } },
        data: { levelID: targetLevel }
      });

      // 4. Save Promotion Record with PromotedStudent details
      return await tx.studentPromote.create({
        data: {
          sourceClassroomID: sourceClassroom,
          sourceLevelID: sourceLevel,
          targetClassroomID: targetClassroom,
          targetLevelID: targetLevel,
          promotorName: currUser?.name || "Unknown",
          promotorDate: new Date(),
          promotorDescription,
          isApproved: true,
          students: {
            create: students.map(s => ({
              userID: s.id,
              name: s.name,
              rollNo: s.rollNo || ""
            }))
          }
        }
      });
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = createStudentPromotion;
