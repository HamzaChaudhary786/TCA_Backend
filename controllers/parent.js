const prisma = require("../db/prisma");
const moment = require("moment");

exports.getStudentReportForParent = async (req, res, next) => {
  try {
    const { studentID } = req.params;
    const { classroomID, subjectID, teacherID } = req.query;

    const calculateGrade = (per) => {
      if (typeof per !== 'number' || isNaN(per)) return "-";
      if (per >= 90) return "A";
      if (per >= 80) return "B";
      if (per >= 70) return "C";
      if (per >= 60) return "D";
      if (per >= 50) return "E";
      return "F";
    };

    const user = await prisma.user.findUnique({
      where: { id: studentID },
      select: {
        id: true, name: true, email: true, userType: true, profilePic: true, rollNo: true,
        // include other relevant fields, excluding password
      }
    });

    if (!user) return res.status(404).send({ message: "Student not found" });

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomID }
    });
    if (!classroom) return res.status(404).send({ message: "Classroom not found" });

    const assignments = await prisma.assignment.findMany({
      where: { classroomID, subjectID },
      include: { submissions: true }
    });

    const quizes = await prisma.quiz.findMany({
      where: { classroomID, subjectID },
      include: { submissions: true }
    });

    const classFilter = { classroomID, subjectID };
    if (teacherID) {
      classFilter.teacherID = teacherID;
    }

    const classes = await prisma.class.findMany({
      where: classFilter,
      orderBy: { startTime: 'asc' },
      include: { attendance: true }
    });

    const mapDeliverable = (item) => {
      const sub = item.submissions.find(s => s.studentID === studentID);
      const isGraded = typeof sub?.marks !== 'undefined' && sub?.marks !== null;
      let grade = sub?.grade;
      if (!grade && isGraded) {
        grade = calculateGrade((sub.marks / item.totalMarks) * 100);
      }
      return {
        id: item.id,
        title: item.title,
        totalMarks: item.totalMarks,
        obtainedMarks: sub?.marks,
        feedback: sub?.feedback || "",
        grade: grade || "-",
        deadline: item.dueDate,
        isSubmitted: !!sub,
        submittedAt: sub?.submittedAt,
        isGraded: isGraded
      };
    };

    const studentAssignments = assignments.map(mapDeliverable);
    const studentQuizzes = quizes.map(mapDeliverable);

    const calculateAvg = (items) => {
      const graded = items.filter(item => item.isGraded);
      if (graded.length === 0) return { percentage: 0, grade: "F" };
      const totalObtained = graded.reduce((sum, item) => sum + (item.obtainedMarks || 0), 0);
      const totalMax = graded.reduce((sum, item) => sum + (item.totalMarks || 1), 0);
      const per = (totalObtained / totalMax) * 100;
      return { percentage: per.toFixed(0), grade: calculateGrade(per) };
    };

    const assStats = calculateAvg(studentAssignments);
    const quizStats = calculateAvg(studentQuizzes);

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    // Deduplicate sessions by startTime locally to ensure "one time" display
    const sessionMap = new Map();
    classes.forEach((cls) => {
      const timeKey = moment(cls.startTime).format("YYYY-MM-DD HH:mm");
      const existing = sessionMap.get(timeKey);
      const studentMatch = cls.attendance?.find(a => a.studentID === studentID);
      const hasAttendance = !!studentMatch;

      if (!existing || (!existing.hasData && hasAttendance)) {
        sessionMap.set(timeKey, {
          className: cls.title,
          startTime: cls.startTime,
          endTime: cls.endTime,
          isPresent: studentMatch?.isPresent || false,
          late: studentMatch?.late || false,
          type: "session",
          hasData: hasAttendance
        });
      }
    });

    const mergedAttendance = Array.from(sessionMap.values());
    const totalAttendanceRecords = mergedAttendance.length;

    mergedAttendance.forEach((record) => {
      if (record.late) lateCount++;
      else if (record.isPresent) presentCount++;
      else absentCount++;
    });

    const avgAttendancePer = totalAttendanceRecords > 0 ? ((presentCount + lateCount) / totalAttendanceRecords) * 100 : 0;

    res.send({
      user: user,
      averageAssignmentMarks: {
        percentage: assStats.percentage,
        grade: assStats.grade,
      },
      averageQuizMarks: {
        percentage: quizStats.percentage,
        grade: quizStats.grade,
      },
      avgAttendancePer,
      assignments: studentAssignments,
      quizes: studentQuizzes,
      attendance: mergedAttendance,
      averageAttendancePercentage: avgAttendancePer.toFixed(0),
      presentCount,
      absentCount,
      lateCount
    });
  } catch (error) {
    next(error);
  }
};

exports.getParentChats = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const classrooms = await prisma.classroom.findMany({
      where: {
        students: { some: { id: studentID } }
      },
      include: {
        teachers: true
      }
    });

    const chatrooms = [];

    for (const classroom of classrooms) {
      for (const teac of classroom.teachers) {
        
        // Find existing chat that involves both the teacher and the parent (req.user.id)
        // Wait, chatroom model logic here. Let's find one that has both participants
        const foundChats = await prisma.chatRoom.findMany({
          where: {
            AND: [
              { participants: { some: { id: teac.teacherID } } },
              { participants: { some: { id: req.user.id } } }
            ]
          },
          include: {
            participants: { select: { id: true, name: true, profilePic: true } }
          }
        });

        // Filter for exactly those two? Or just anyone that has both is fine.
        let foundChat = foundChats.find(c => c.participants.length === 2);

        if (!foundChat) {
          // Create chat room
          const newChatroom = await prisma.chatRoom.create({
            data: {
              participants: {
                connect: [{ id: teac.teacherID }, { id: req.user.id }]
              }
            },
            include: {
              participants: { select: { id: true, name: true, profilePic: true } }
            }
          });
          chatrooms.push(newChatroom);
        } else {
          chatrooms.push(foundChat);
        }
      }
    }

    return res.send(chatrooms);
  } catch (err) {
    next(err);
  }
};

exports.getChildrenOfParent = async (req, res, next) => {
  try {
    const { email } = req.params;

    const parent = await prisma.user.findUnique({
      where: { email },
    });

    if (!parent) return next({ message: "User not found" });

    const children = await prisma.user.findMany({
      where: { guardianEmail: parent.email },
      select: {
        id: true, name: true, email: true, profilePic: true, userType: true, guardianName: true, rollNo: true
      }
    });

    res.send(children);
  } catch (error) {
    next(error);
  }
};

exports.getChilSubjects = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const classrooms = await prisma.classroom.findMany({
      where: { students: { some: { id: studentID } } },
      include: {
        teachers: {
          include: { subject: true, teacher: true }
        }
      }
    });

    const subjects = classrooms.reduce((result, classroom) => {
      if (classroom.teachers && classroom.teachers.length > 0) {
        classroom.teachers.forEach((teacher) => {
          if (teacher.subject) {
            result.push({
              subject: teacher.subject,
              teacher: teacher.teacher,
              classroom: classroom,
            });
          }
        });
      }
      return result;
    }, []);

    const classes = await prisma.class.findMany({
      where: {
        attendance: { some: { studentID } }
      },
      include: { attendance: true }
    });

    const attendanceMap = new Map();

    classes.forEach((cls) => {
      const subjectID = cls.subjectID;

      if (!attendanceMap.has(subjectID)) {
        attendanceMap.set(subjectID, { totalClasses: 0, presentClasses: 0 });
      }

      const attendanceData = attendanceMap.get(subjectID);
      cls.attendance.forEach((record) => {
        if (record.studentID === studentID) {
          attendanceData.totalClasses++;
          if (record.isPresent) {
            attendanceData.presentClasses++;
          }
        }
      });
    });

    attendanceMap.forEach((data, subjectID) => {
      data.avgAttendancePer = data.totalClasses > 0 ? ((data.presentClasses / data.totalClasses) * 100).toFixed(0) : "0";
    });

    const newarr = subjects.map((item) => {
      const subjectData = attendanceMap.get(item.subject.id);
      if (subjectData) {
        return { ...item, avgAttendancePer: subjectData.avgAttendancePer };
      } else {
        return { ...item, avgAttendancePer: "0" };
      }
    });

    res.send({ subjects: newarr });
  } catch (err) {
    next(err);
  }
};


exports.getStudentLastDeliveredAssignmentReport = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: studentID },
      select: {
        id: true, name: true, email: true, profilePic: true, rollNo: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    const classrooms = await prisma.classroom.findMany({
      where: { students: { some: { id: studentID } } },
      select: { id: true }
    });
    
    if (!classrooms || classrooms.length === 0) {
      return res.status(200).json({ 
        message: "No classrooms found for student", 
        user, 
        lastAssignment: null 
      });
    }

    const classroomIDs = classrooms.map(c => c.id);

    const [assignments, quizzes] = await Promise.all([
      prisma.assignment.findMany({
        where: {
          classroomID: { in: classroomIDs },
          submissions: { some: { studentID, marks: { not: null } } }
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { submissions: true }
      }),
      prisma.quiz.findMany({
        where: {
          classroomID: { in: classroomIDs },
          submissions: { some: { studentID, marks: { not: null } } }
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { submissions: true }
      })
    ]);

    const deliverables = [
      ...assignments.map(a => ({ ...a, type: "Assignment" })),
      ...quizzes.map(q => ({ ...q, type: "Quiz" }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let lastDeliverable = null;
    if (deliverables.length > 0) {
      const item = deliverables[0];
      const submission = item.submissions.find(s => s.studentID === studentID);

      const percentage = item.totalMarks > 0 ? ((submission.marks / item.totalMarks) * 100).toFixed(0) : 0;
      const grade = percentage >= 90 ? "A" : percentage >= 80 ? "B" : percentage >= 70 ? "C" : percentage >= 60 ? "D" : percentage >= 50 ? "E" : "F";

      lastDeliverable = {
        title: item.title,
        type: item.type,
        marksObtained: submission.marks,
        percentage,
        grade
      };
    }

    res.send({
      user: user,
      lastAssignment: lastDeliverable,
    });
  } catch (error) {
    next(error);
  }
};

exports.getChildAssignments = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const classrooms = await prisma.classroom.findMany({
      where: { students: { some: { id: studentID } } },
      select: { id: true }
    });
    
    if (!classrooms || classrooms.length === 0) {
      return res.status(200).json({ 
        message: "No classrooms found for student",
        assignments: [],
        quizzes: []
      });
    }

    const classroomIDs = classrooms.map(c => c.id);

    const [assignments, quizzes] = await Promise.all([
      prisma.assignment.findMany({
        where: { classroomID: { in: classroomIDs } },
        include: { subject: true, classroom: true, submissions: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.quiz.findMany({
        where: { classroomID: { in: classroomIDs } },
        include: { subject: true, classroom: true, submissions: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const mapItem = (item) => {
      const sub = item.submissions.find(s => s.studentID === studentID);
      const isGraded = typeof sub?.marks !== 'undefined' && sub?.marks !== null;
      // remove submissions array from output to match previous format if desired
      const out = { ...item };
      delete out.submissions;
      return {
        ...out,
        isSubmitted: !!sub,
        isGraded: isGraded,
        obtainedMarks: sub?.marks,
        grade: sub?.grade,
        feedback: sub?.feedback
      };
    };

    res.status(200).json({
      assignments: assignments.map(mapItem),
      quizzes: quizzes.map(mapItem)
    });
  } catch (error) {
    next(error);
  }
};
