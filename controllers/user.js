const passport = require("passport");
const prisma = require("../db/prisma");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const userRepository = require("../repositories/userRepository");

exports.register = async (req, res, next) => {
  try {
    const data = req.body;
    if (data.email) data.email = data.email.trim().toLowerCase();
    if (data.guardianEmail) data.guardianEmail = data.guardianEmail.trim().toLowerCase();

    // Check if the user already exists
    const foundUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (foundUser) {
      return res.status(401).send("User already exists");
    }

    // Validate userType
    if (["student", "teacher", "parent", "admin", "super_admin"].indexOf(data.userType) === -1) {
      return res.status(400).send("Invalid user type");
    }

    // Validate required fields
    if (!data.name || !data.email || !data.password || !data.userType || !data.phoneNumber) {
      return res.status(400).send("All fields are required");
    }

    // Additional validations for student
    if (data.userType === "student") {
      if (!data.levelID) {
        return res.status(400).send("Level is required");
      }
      if (!data.guardianName || !data.guardianEmail || !data.guardianPhoneNumber) {
        return res.status(400).send("Guardian details are required");
      }
    }

    // Hash student password
    const plainPassword = data.password;
    data["password"] = bcrypt.hashSync(data.password, 8);

    // Prisma create data (mapping nested subscription fields)
    const createData = {
      ...data,
      subscriptionActive: data.subscription?.isActive ?? false,
      subscriptionExpiresAt: data.subscription?.expiresAt ? new Date(data.subscription.expiresAt) : null,
    };
    delete createData.subscription; // Remove mongo-style nested object

    // Save user data
    let user = await prisma.user.create({ data: createData });

    // Create parent account for student
    if (data.userType === "student") {
      let parent = await prisma.user.findUnique({ where: { email: data.guardianEmail } });

      if (parent && parent.userType !== "parent") {
        return res.status(400).send(`The guardian email ${data.guardianEmail} is already registered as a ${parent.userType}. Please use a different email or contact support.`);
      }

      // If the guardian does not exist, create a new one
      if (!parent) {
        const parentData = {
          name: data.guardianName,
          email: data.guardianEmail,
          password: bcrypt.hashSync(plainPassword, 8), // Hash the plain password for parent
          userType: "parent",
          phoneNumber: data.guardianPhoneNumber,
        };
        parent = await prisma.user.create({ data: parentData });
      }

      // Update student's guardianId with the parent's ID
      user = await prisma.user.update({
        where: { id: user.id },
        data: { guardianId: parent.id }
      });
    }

    res.send({ ...user, password: undefined });
  } catch (err) {
    // Unique constraint error in Prisma (P2002)
    if (err.code === 'P2002') {
      const field = err.meta.target[0];
      return res.status(400).send(`${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`);
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  passport.authenticate("local", async function (err, foundUser, info) {
    if (err) {
      return res.status(500).send({ message: "Internal Server Error" });
    }

    if (!foundUser) {
      return res.status(400).send({ message: info.message });
    }

    try {
      // Fetch level details if the user exists
      let levelName = null;
      if (foundUser.levelID) {
        const level = await prisma.level.findUnique({ where: { id: foundUser.levelID } });
        levelName = level ? level.name : null;
      }

      // --- 1. INDIVIDUAL BLOCK CHECK ---
      if (foundUser.isBlocked) {
        return res.status(403).send({ message: "Your account has been blocked. Please contact the administrator." });
      }

      // --- 2. DYNAMIC SUBSCRIPTION & ORGANIZATION FEE CHECK ---
      if (foundUser.userType !== 'super_admin') {
        let organization = foundUser;

        if (foundUser.userType !== 'admin') {
          // In a single-tenant system, the organization is the 'admin' user
          organization = await prisma.user.findFirst({ where: { userType: 'admin' } });
        }

        if (!organization) {
          // This should not happen in a configured system
          return res.status(403).send({ message: "Organization setup incomplete. Please contact support." });
        }

        const isSubscriptionExpired = organization.subscriptionExpiresAt &&
          new Date(organization.subscriptionExpiresAt) < new Date();
        
        const isFeesPaid = organization.feesPaid;

        if (isSubscriptionExpired || !isFeesPaid) {
          const msg = foundUser.userType === 'admin'
            ? "Your organization's subscription has expired or fees are unpaid. Please contact support."
            : "The school/organization access is currently suspended due to unpaid fees. Please contact your administrator.";
          return res.status(403).send({ message: msg });
        }
      }

      // --- STUDENT FEE CHECK ---
      if (foundUser.userType === 'student') {
        const overdueFee = await prisma.fee.findFirst({
          where: {
            studentID: foundUser.id,
            status: 'unpaid',
            dueDate: { lt: new Date() }
          }
        });

        if (overdueFee) {
          return res.status(403).send({ 
            message: "Access Denied: You have unpaid fees. Please contact the administrator or check your parent portal.",
            feeStatus: "unpaid"
          });
        }
      }

      // Attempt to log in the user
      req.logIn(foundUser, function (err) {
        if (err) {
          return res.status(500).send({ message: "Failed to log in user" });
        }

        return res.send({
          ...foundUser,
          levelName,
        });
      });
    } catch (fetchError) {
      return res.status(500).send({ message: "Failed to fetch user data" });
    }
  })(req, res, next);
};


exports.logout = (req, res, next) => {
  try {
    req.logout((err) => {
      if (err) {
        next(err);
      }
    });
    res.send("Logged out");
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { 
      name, profilePic, bio, dob, phoneNumber, gender, 
      experience, qualification, cv, 
      guardianName, guardianPhoneNumber 
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (profilePic !== undefined) updateData.profilePic = profilePic;
    if (bio !== undefined) updateData.bio = bio;
    if (dob !== undefined) updateData.dob = dob ? new Date(dob) : null;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (gender !== undefined) updateData.gender = gender;
    if (experience !== undefined) updateData.experience = experience;
    if (qualification !== undefined) updateData.qualification = qualification;
    if (cv !== undefined) updateData.cv = cv;
    if (guardianName !== undefined) updateData.guardianName = guardianName;
    if (guardianPhoneNumber !== undefined) updateData.guardianPhoneNumber = guardianPhoneNumber;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    return res.status(200).send(user);
  } catch (err) {
    next(err);
  }
};





exports.updateStudentSubject = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const user = await prisma.user.update({
      where: { id: studentId },
      data: { subjects: req.body }
    });

    return res.status(200).send(user);
  } catch (err) {
    next(err);
  }
};


exports.bulkUpdateStudentSubjects = async (req, res, next) => {
  try {
    const { levelId, classroomId, subjectIds } = req.body;

    if (!levelId) {
      return res.status(400).send({ message: "levelId is required." });
    }

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).send({ message: "An array of subjectIds is required." });
    }

    let filter = { userType: "student", levelID: levelId };

    if (classroomId) {
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId },
        include: { students: { select: { id: true } } }
      });
      if (!classroom) {
        return res.status(404).send({ message: "Classroom not found." });
      }
      filter.id = { in: classroom.students.map(s => s.id) };
    }

    const result = await prisma.user.updateMany({
      where: filter,
      data: { subjects: subjectIds }
    });

    return res.status(200).send({
      success: true,
      message: `${result.count} students updated successfully.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.getUsersNotInClassroom = async (req, res, next) => {
  try {
    const { levelID } = req.params;

    const classroomsWithLevel = await prisma.classroom.findMany({
      where: { levelID },
      include: {
        students: { select: { id: true } },
        teachers: { select: { teacherID: true } }
      }
    });

    const usersInClassroom = classroomsWithLevel.reduce((acc, classroom) => {
      acc.push(...classroom.students.map(s => s.id));
      acc.push(...classroom.teachers.map(t => t.teacherID));
      return acc;
    }, []);

    const usersNotInClassroom = await prisma.user.findMany({
      where: {
        id: { notIn: usersInClassroom },
        userType: { not: 'admin' },
        OR: [
          { userType: { not: 'student' } },
          { userType: 'student', levelID: levelID }
        ]
      }
    });

    const result = {
      students: usersNotInClassroom.filter(user => user.userType === "student"),
      teachers: usersNotInClassroom.filter(user => user.userType === "teacher"),
    };
    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getAllStudents = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ where: { userType: "student" } });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.getAllStudentsWithLevel = async (req, res, next) => {
  try {
    const { levelId } = req.params;
    if (!levelId) return res.status(400).send({ message: "Level Id is required." });

    const students = await prisma.user.findMany({
      where: {
        userType: "student",
        levelID: levelId
      }
    });

    res.send(students);
  } catch (error) {
    next(error);
  }
};





exports.getAllAdmins = async (req, res, next) => {
  try {
    if (req.user.userType !== 'super_admin') {
      return res.status(403).send({ message: "Access denied. Super Admin only." });
    }
    const admins = await prisma.user.findMany({ where: { userType: "admin" } });
    res.send(admins);
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { userType: { not: "admin" } }
    });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.acceptUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await prisma.user.update({
      where: { id: userID },
      data: { isAccepted: true }
    });
    res.send(user);
  } catch (error) {
    next(error);
  }
};

exports.rejectUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await prisma.user.delete({ where: { id: userID } });
    res.send(user);
  } catch (error) {
    next(error);
  }
};

exports.getStudentsOfTeacher = async (req, res, next) => {
  try {
    const teacherID = req.user.id;

    const classrooms = await prisma.classroom.findMany({
      where: {
        teachers: {
          some: { teacherID: teacherID }
        }
      },
      include: {
        students: true,
        teachers: {
          include: { subject: true }
        }
      }
    });

    const studentList = [];

    // Get all class sessions for these classrooms to avoid N+1 queries
    const classroomIds = classrooms.map(c => c.id);
    const allClassSessions = await prisma.class.findMany({
      where: { classroomID: { in: classroomIds } },
      include: { attendance: true }
    });

    for (const clas of classrooms) {
      const teacherInfo = clas.teachers.find(t => t.teacherID === teacherID);
      const subjectID = teacherInfo.subjectID;

      for (const student of clas.students) {
        // Only include students taking the specific subject taught by this teacher
        if (!student.subjects.includes(subjectID)) {
          continue;
        }

        // Calculate attendance from pre-fetched data
        const relevantClasses = allClassSessions.filter(c =>
          c.classroomID === clas.id && c.subjectID === subjectID
        );

        let totalMarked = 0;
        let presentCount = 0;

        relevantClasses.forEach(c => {
          const record = c.attendance.find(a => a.studentID === student.id);
          if (record) {
            totalMarked++;
            if (record.isPresent || record.late) presentCount++;
          }
        });

        const avgAttendancePer = totalMarked > 0 ? (presentCount / totalMarked) * 100 : 0;

        studentList.push({
          ...student,
          classroom: { id: clas.id, name: clas.name },
          subject: { id: subjectID, name: teacherInfo.subject.name },
          avgAttendancePer: avgAttendancePer.toFixed(2),
        });
      }
    }

    res.send(studentList);
  } catch (error) {
    next(error);
  }
};




exports.getStudentReportForTeacher = async (req, res, next) => {
  try {
    const { studentID } = req.params;
    const { classroomID, subjectID } = req.query;

    if (!studentID || !classroomID || !subjectID) {
      return res.status(400).send("Student, classroom, and subject IDs are required");
    }

    const user = await prisma.user.findUnique({
      where: { id: studentID }
    });
    if (!user) return res.status(404).send("Student not found");

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomID } });
    if (!classroom) return res.status(404).send("Classroom not found");

    // Fetch classes with attendance for the specific student
    const classes = await prisma.class.findMany({
      where: {
        classroomID: classroomID,
        subjectID: subjectID,
      },
      include: {
        attendance: {
          where: { studentID: studentID }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    const assignments = await prisma.assignment.findMany({
      where: { classroomID, subjectID },
      include: {
        subject: true,
        submissions: { where: { studentID: studentID } }
      }
    });

    const quizes = await prisma.quiz.findMany({
      where: { classroomID, subjectID },
      include: {
        subject: true,
        submissions: { where: { studentID: studentID } }
      }
    });

    let presentCount = 0;
    let totalAttendanceRecords = 0;

    const uniqueClasses = classes; // Already sorted and filtered unique sessions in this context

    uniqueClasses.forEach((item) => {
      if (item.attendance && item.attendance.length > 0) {
        totalAttendanceRecords++;
        if (item.attendance[0].isPresent || item.attendance[0].late) {
          presentCount++;
        }
      }
    });

    const avgAttendancePer = totalAttendanceRecords > 0 ? (presentCount / totalAttendanceRecords) * 100 : 0;

    const gradedAssignments = assignments.filter(ass =>
      ass.submissions.length > 0 && typeof ass.submissions[0].marks !== 'undefined'
    );

    let avgAssMarksPer = 0;
    if (gradedAssignments.length > 0) {
      let totalObtained = 0;
      let totalMax = 0;
      gradedAssignments.forEach(ass => {
        totalObtained += ass.submissions[0].marks || 0;
        totalMax += ass.totalMarks;
      });
      avgAssMarksPer = ((totalObtained / totalMax) * 100).toFixed(0);
    }

    const gradedQuizzes = quizes.filter(q =>
      q.submissions.length > 0 && typeof q.submissions[0].marks !== 'undefined'
    );

    let avgQuizMarksPer = 0;
    if (gradedQuizzes.length > 0) {
      let totalObtained = 0;
      let totalMax = 0;
      gradedQuizzes.forEach(q => {
        totalObtained += q.submissions[0].marks || 0;
        totalMax += q.totalMarks;
      });
      avgQuizMarksPer = ((totalObtained / totalMax) * 100).toFixed(0);
    }

    const calculateGrade = (per) => {
      if (per >= 90) return "A";
      if (per >= 80) return "B";
      if (per >= 70) return "C";
      if (per >= 60) return "D";
      if (per >= 50) return "E";
      return "F";
    };

    res.send({
      user: user,
      averageAssignmentMarks: {
        percentage: avgAssMarksPer,
        grade: calculateGrade(avgAssMarksPer),
      },
      averageQuizMarks: {
        percentage: avgQuizMarksPer,
        grade: calculateGrade(avgQuizMarksPer),
      },
      assignments: assignments.map((ass) => {
        const submission = ass.submissions[0];
        return {
          title: ass.title,
          subject: ass.subject?.name || "Subject",
          totalMarks: ass.totalMarks,
          obtainedMarks: submission?.marks,
          feedback: submission?.feedback || "",
          grade: submission?.grade,
          dueDate: ass.dueDate,
          isSubmitted: !!submission,
        };
      }),
      quizes: quizes.map((ass) => {
        const submission = ass.submissions[0];
        return {
          title: ass.title,
          subject: ass.subject?.name || "Subject",
          totalMarks: ass.totalMarks,
          obtainedMarks: submission?.marks,
          feedback: submission?.feedback || "",
          grade: submission?.grade,
          dueDate: ass.dueDate,
          isSubmitted: !!submission,
        };
      }),
      attendance: {
        classes: uniqueClasses.map(c => ({
          matchedAttendance: c.attendance,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          type: "session"
        })),
        avgAttendancePer
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getStudentGradesForSubject = async (req, res, next) => {
  try {
    const { subjectID, studentID } = req.params;

    const calculateGrade = (per) => {
      if (typeof per !== 'number' || isNaN(per)) return "-";
      if (per >= 90) return "A";
      if (per >= 80) return "B";
      if (per >= 70) return "C";
      if (per >= 60) return "D";
      if (per >= 50) return "E";
      return "F";
    };

    // Find classrooms the student is in
    const userClassrooms = await prisma.classroom.findMany({
      where: { students: { some: { id: studentID } } },
      select: { id: true }
    });
    const classroomIds = userClassrooms.map(c => c.id);

    // Fetch assignments for these classrooms and this subject
    const assignments = await prisma.assignment.findMany({
      where: {
        subjectID: subjectID,
        classroomID: { in: classroomIds }
      },
      include: {
        submissions: { where: { studentID: studentID } }
      }
    });

    // Fetch quizzes for these classrooms and this subject
    const quizzes = await prisma.quiz.findMany({
      where: {
        subjectID: subjectID,
        classroomID: { in: classroomIds }
      },
      include: {
        submissions: { where: { studentID: studentID } }
      }
    });

    const studentAssignments = assignments.map(ass => {
      const submission = ass.submissions[0];
      const isGraded = typeof submission?.marks !== 'undefined' && submission?.marks !== null;
      let grade = submission?.grade;
      if (!grade && isGraded) {
        grade = calculateGrade((submission.marks / ass.totalMarks) * 100);
      }
      return {
        id: ass.id,
        title: ass.title,
        totalMarks: ass.totalMarks,
        obtainedMarks: submission?.marks,
        feedback: submission?.feedback || "",
        grade: grade || "-",
        deadline: ass.dueDate,
        isSubmitted: !!submission,
        submittedAt: submission?.submittedAt,
        isGraded: isGraded
      };
    });

    const studentQuizzes = quizzes.map(q => {
      const submission = q.submissions[0];
      const isGraded = typeof submission?.marks !== 'undefined' && submission?.marks !== null;
      let grade = submission?.grade;
      if (!grade && isGraded) {
        grade = calculateGrade((submission.marks / q.totalMarks) * 100);
      }
      return {
        id: q.id,
        title: q.title,
        totalMarks: q.totalMarks,
        obtainedMarks: submission?.marks,
        feedback: submission?.feedback || "",
        grade: grade || "-",
        deadline: q.dueDate,
        isSubmitted: !!submission,
        submittedAt: submission?.submittedAt,
        isGraded: isGraded
      };
    });

    // Fetch classes (sessions) to calculate attendance
    const classes = await prisma.class.findMany({
      where: {
        subjectID: subjectID,
        classroomID: { in: classroomIds },
        attendance: { some: { studentID: studentID } }
      },
      include: {
        attendance: { where: { studentID: studentID } }
      }
    });

    const formattedClasses = classes.map(c => ({
      matchedAttendance: c.attendance,
      title: c.title,
      startTime: c.startTime,
      endTime: c.endTime
    }));

    let totalAttendanceRecords = 0;
    if (formattedClasses.length > 0) {
      formattedClasses.forEach((item) => {
        if (item.matchedAttendance && item.matchedAttendance.length > 0) {
          totalAttendanceRecords++;
          if (item.matchedAttendance[0].late) {
            lateCount++;
          } else if (item.matchedAttendance[0].isPresent) {
            presentCount++
          } else {
            absentCount++;
          }
        }
      });
      avgAttendancePer = totalAttendanceRecords > 0 ? ((presentCount + lateCount) / totalAttendanceRecords) * 100 : 0;
    }

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

    res.send({
      quizes: {
        data: studentQuizzes,
        avgMarksPer: quizStats.percentage,
        avgGrade: quizStats.grade,
      },
      assignments: {
        data: studentAssignments,
        avgMarksPer: assStats.percentage,
        avgGrade: assStats.grade,
      },
      attendance: { classes: formattedClasses, avgAttendancePer, presentCount, absentCount, lateCount }
    });
  } catch (err) {
    next(err);
  }
};



exports.getStudentSubjects = async (req, res, next) => {
  try {
    const { studentID } = req.params;
    console.log("getStudentSubjects hit for studentID:", studentID);

    if (!studentID || studentID === "undefined" || studentID === "null") {
      console.log("Invalid studentID received");
      return res.status(400).send("Invalid student ID");
    }

    const student = await prisma.user.findUnique({ where: { id: studentID } });
    if (!student) {
      console.log("Student not found for ID:", studentID);
      return res.status(404).send("Student not found");
    }

    console.log("Student found:", student.name, "Subjects:", student.subjects);

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
            const studentSubjects = student.subjects || [];
            if (studentSubjects.includes(teacher.subject.id)) {
              result.push({
                subject: teacher.subject,
                teacher: teacher.teacher.name,
                teacherId: teacher.teacher.id,
              });
            }
          }
        });
      }
      return result;
    }, []);

    const classes = await prisma.class.findMany({
      where: { attendance: { some: { studentID: studentID } } },
      include: { attendance: { where: { studentID: studentID } } },
      orderBy: { startTime: 'asc' }
    });

    const uniqueSubjectsMap = new Map();

    subjects.forEach((item) => {
      if (!item.subject || !item.subject.id) return;

      const subjectIdStr = item.subject.id;
      const uniqueKey = `${subjectIdStr}-${item.teacher}`;

      if (!uniqueSubjectsMap.has(uniqueKey)) {
        const subjectClasses = classes.filter(cls =>
          cls.subjectID === subjectIdStr
        );

        let avgAttendancePer = 0;

        if (subjectClasses.length > 0) {
          let totalAttended = 0;
          let totalClasses = 0;

          subjectClasses.forEach(cls => {
            const attendanceRecord = cls.attendance[0];
            if (attendanceRecord) {
              totalClasses++;
              if (attendanceRecord.isPresent || attendanceRecord.late) {
                totalAttended++;
              }
            }
          });

          if (totalClasses > 0) {
            avgAttendancePer = ((totalAttended / totalClasses) * 100).toFixed(0);
          }
        }

        uniqueSubjectsMap.set(uniqueKey, {
          id: item.subject.id,
          name: item.subject.name,
          teacher: item.teacher,
          teacherId: item.teacherId,
          avgAttendancePer
        });
      }
    });

    const uniqueSubjectsList = Array.from(uniqueSubjectsMap.values());
    res.send({ subjects: uniqueSubjectsList, assignedSubjects: student.subjects });
  } catch (err) {
    next(err);
  }
};






exports.getSubjectsWithLevel = async (req, res, next) => {
  try {
    const { levelID } = req.params;

    const level = await prisma.level.findUnique({ where: { id: levelID } });
    if (!level) return res.status(404).json({ message: "Level not found" });

    const subjects = await prisma.subject.findMany({ where: { levelID } });

    res.status(200).send({
      levelName: level.name,
      subjects: subjects.map(s => ({ id: s.id, subjectName: s.name })),
    });
  } catch (err) {
    next(err);
  }
};


exports.getTeachersForAdmin = async (req, res, next) => {
  try {
    const teachers = await prisma.user.findMany({ where: { userType: "teacher" } });
    const classrooms = await prisma.classroom.findMany({
      include: {
        teachers: {
          include: {
            subject: true,
            teacher: true
          }
        }
      }
    });

    const classes = await prisma.class.findMany({
      include: { attendance: true }
    });

    const teacherIds = teachers.map(t => t.id);
    const assignments = await prisma.assignment.findMany({
      where: {
        createdBy: { in: teacherIds },
        submissions: { some: { marks: { not: null } } }
      },
      include: { submissions: true }
    });

    const quizes = await prisma.quiz.findMany({
      where: {
        createdBy: { in: teacherIds },
        submissions: { some: { marks: { not: null } } }
      },
      include: { submissions: true }
    });

    const calculateAvgPerf = (items) => {
      items = items.map(item => {
        const totalObtained = item.submissions.reduce((sum, s) => sum + (s.marks || 0), 0);
        const totalMax = item.totalMarks * item.submissions.length;
        const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
        return { ...item, avgPercentage: percentage };
      });
      return items;
    };

    const processedAssignments = calculateAvgPerf(assignments);
    const processedQuizzes = calculateAvgPerf(quizes);

    const result = {};

    classrooms.forEach(classroom => {
      classroom.teachers.forEach(ct => {
        const tId = ct.teacherID;
        if (!result[tId]) result[tId] = [];

        const teacherClasses = classes.filter(c => c.teacherID === tId && c.classroomID === classroom.id);
        const presentCount = teacherClasses.filter(c => c.teacherStatus === 'present').length;

        const teacherAssignments = processedAssignments.filter(a => a.createdBy === tId && a.classroomID === classroom.id);
        const assAvg = teacherAssignments.length > 0
          ? teacherAssignments.reduce((acc, a) => acc + a.avgPercentage, 0) / teacherAssignments.length
          : 0;

        const teacherQuizzes = processedQuizzes.filter(q => q.createdBy === tId && q.classroomID === classroom.id);
        const quizAvg = teacherQuizzes.length > 0
          ? teacherQuizzes.reduce((acc, q) => acc + q.avgPercentage, 0) / teacherQuizzes.length
          : 0;

        result[tId].push({
          attendence: {
            classData: teacherClasses,
            attendnececount: { presents: presentCount }
          },
          assignments: {
            count: teacherAssignments.length,
            percentage: assAvg.toFixed(2),
            grade: assAvg > 90 ? "A" : "B",
          },
          quizes: {
            count: teacherQuizzes.length,
            percentage: quizAvg.toFixed(2),
            grade: quizAvg > 90 ? "A" : "B",
          },
          subject: ct.subject,
          teacher: ct.teacher,
          classroomName: classroom.name
        });
      });
    });

    res.send(result);
  } catch (err) {
    next(err);
  }
};

// fazool function he yeh
exports.getStudentReportsForAdmin = async (req, res, next) => {
  try {
    const { studentID } = req.params;
    const student = await prisma.user.findUnique({ where: { id: studentID } });
    if (!student) return res.status(404).send("Student not found");

    const classrooms = await prisma.classroom.findMany({
      where: { students: { some: { id: studentID } } },
      include: {
        assignments: {
          include: { submissions: { where: { studentID } } }
        },
        quizzes: {
          include: { submissions: { where: { studentID } } }
        }
      }
    });

    const activities = await prisma.activity.findMany({ where: { userID: studentID } });

    res.send({ classrooms, activities });
  } catch (err) {
    next(err);
  }
};

// update user by admin
exports.updateUserByAdmin = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const { 
      name, email, rollNo, phoneNumber, gender, 
      guardianName, guardianEmail, guardianPhoneNumber, 
      referenceNo, levelID, userType, profilePic, bio, password 
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (rollNo !== undefined) data.rollNo = rollNo;
    if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
    if (gender !== undefined) data.gender = gender;
    if (guardianName !== undefined) data.guardianName = guardianName;
    if (guardianEmail !== undefined) data.guardianEmail = guardianEmail;
    if (guardianPhoneNumber !== undefined) data.guardianPhoneNumber = guardianPhoneNumber;
    if (referenceNo !== undefined) data.referenceNo = referenceNo;
    if (profilePic !== undefined) data.profilePic = profilePic;
    if (bio !== undefined) data.bio = bio;
    
    // Hash password if provided and not empty
    if (password && password.trim() !== "") {
      data.password = await bcrypt.hash(password, 10);
    }
    
    // Prisma relation IDs should be null if empty string
    if (levelID !== undefined) data.levelID = levelID === "" ? null : levelID;
    
    // Normalize userType if provided
    if (userType !== undefined) data.userType = userType.toLowerCase();

    const user = await prisma.user.update({
      where: { id: userID },
      data: data
    });
    res.send(user);
  } catch (err) {
    next(err);
  }
};

// delete user by admin
exports.deleteUserByAdmin = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await prisma.user.delete({ where: { id: userID } });
    res.send(user);
  } catch (err) {
    next(err);
  }
};

// subscribe to notifications
exports.subscribeToNotifications = async (req, res, next) => {
  try {
    const currUser = req.user;
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).send("fcmToken is required");

    let device = await prisma.device.findUnique({
      where: { fcmToken: fcmToken }
    });

    if (device && device.userID === currUser.id) {
      return res.status(200).send(device);
    }

    device = await prisma.device.upsert({
      where: { fcmToken: fcmToken },
      update: { userID: currUser.id },
      create: { fcmToken, userID: currUser.id }
    });

    return res.status(200).send(device);
  } catch (err) {
    next(err);
  }
};

exports.getStudentSubjectsForStudent = async (req, res, next) => {
  try {
    const studentID = req.user.id;
    const classrooms = await prisma.classroom.findMany({
      where: { students: { some: { id: studentID } } },
      include: {
        teachers: {
          include: {
            subject: true,
            teacher: { select: { name: true } }
          }
        }
      }
    });

    const subjects = classrooms.reduce((result, classroom) => {
      classroom.teachers.forEach((ct) => {
        if (ct.subject) {
          result.push({
            subject: ct.subject,
            teacher: ct.teacher.name,
          });
        }
      });
      return result;
    }, []);

    res.send(subjects);
  } catch (err) {
    next(err);
  }
};

exports.getStudentGradesForSubjectForStudent = async (req, res, next) => {
  try {
    const { subjectID } = req.params;
    const studentID = req.user.id;

    const classrooms = await prisma.classroom.findMany({
      where: { students: { some: { id: studentID } } },
      include: {
        assignments: {
          where: { subjectID: subjectID },
          include: { submissions: { where: { studentID: studentID } } }
        },
        quizzes: {
          where: { subjectID: subjectID },
          include: { submissions: { where: { studentID: studentID } } }
        }
      }
    });

    const studentAssignments = [];
    const studentQuizzes = [];

    classrooms.forEach(classroom => {
      classroom.assignments.forEach(ass => {
        const sub = ass.submissions[0];
        studentAssignments.push({
          id: ass.id,
          title: ass.title,
          totalMarks: ass.totalMarks,
          obtainedMarks: sub?.marks,
          feedback: sub?.feedback || "",
          grade: sub?.grade,
          deadline: ass.dueDate,
          isSubmitted: !!sub,
          submittedAt: sub?.submittedAt
        });
      });
      classroom.quizzes.forEach(q => {
        const sub = q.submissions[0];
        studentQuizzes.push({
          id: q.id,
          title: q.title,
          totalMarks: q.totalMarks,
          obtainedMarks: sub?.marks,
          feedback: sub?.feedback || "",
          grade: sub?.grade,
          deadline: q.dueDate,
          isSubmitted: !!sub,
          submittedAt: sub?.submittedAt
        });
      });
    });

    const classes = await prisma.class.findMany({
      where: {
        subjectID: subjectID,
        classroom: { students: { some: { id: studentID } } }
      },
      include: { attendance: { where: { studentID: studentID } } },
      orderBy: { startTime: 'asc' }
    });

    let presentCount = 0, absentCount = 0, lateCount = 0;
    let totalAttendanceRecords = 0;
    classes.forEach((c) => {
      if (c.attendance.length > 0) {
        totalAttendanceRecords++;
        if (c.attendance[0].late) lateCount++;
        else if (c.attendance[0].isPresent) presentCount++;
        else absentCount++;
      }
    });

    const avgAttendencePer = totalAttendanceRecords > 0 ? ((presentCount + lateCount) / totalAttendanceRecords) * 100 : 0;

    const calculateGrade = (per) => {
      if (per >= 90) return "A";
      if (per >= 80) return "B";
      if (per >= 70) return "C";
      if (per >= 60) return "D";
      if (per >= 50) return "E";
      return "F";
    };

    const calculateAvg = (items) => {
      const graded = items.filter(item => typeof item.obtainedMarks !== 'undefined' && item.obtainedMarks !== null);
      if (graded.length === 0) return { percentage: 0, grade: "F" };
      const totalObtained = graded.reduce((sum, item) => sum + item.obtainedMarks, 0);
      const totalMax = graded.reduce((sum, item) => sum + item.totalMarks, 0);
      const per = (totalObtained / totalMax) * 100;
      return { percentage: per.toFixed(0), grade: calculateGrade(per) };
    };

    const assStats = calculateAvg(studentAssignments);
    const quizStats = calculateAvg(studentQuizzes);

    res.send({
      quizes: {
        data: studentQuizzes,
        avgMarksPer: quizStats.percentage,
        avgGrade: quizStats.grade,
      },
      assignments: {
        data: studentAssignments,
        avgMarksPer: assStats.percentage,
        avgGrade: assStats.grade,
      },
      attendance: {
        classes: classes.map(c => ({
          matchedAttendance: c.attendance,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          type: "session"
        })),
        avgAttendencePer, presentCount, absentCount, lateCount
      }
    });
  } catch (err) {
    next(err);
  }
};




exports.updatePassword = async (req, res, next) => {
  try {
    const { password } = req.body;


    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = req.user?.id || req.user?._id;
    console.log(userId, "user id in update password controller");

    // Update only the password field in the database

    const user = await userRepository.findUserAndUpdatePasswordById(userId, hashedPassword);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.status(200).send({ message: "Password updated successfully!" });
  } catch (err) {
    console.error("Error updating password:", err);
    next(err);
  }
};
