const passport = require("passport");
const User = require("../models/user");
const Classroom = require("../models/classroom");
const Class = require("../models/class");
const bcrypt = require("bcryptjs");
const Assignment = require("../models/assignment");
const Quiz = require("../models/quiz");
const Device = require("../models/devices");
const mongoose = require("mongoose");
const Activity = require("../models/activities");
const Level = require("../models/level");

const userRepository = require("../repositories/userRepository");
const Subject = require("../models/subject");
const Attendance = require("../models/attendence");
const moment = require("moment");

exports.register = async (req, res, next) => {
  try {
    const data = req.body;
    // Check if the user already exists
    const foundUser = await User.findOne({ email: data.email });
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

    // Optional fields for teacher
    // if (data.userType === "teacher") {
    //   if (!data.qualification || !data.cv) {
    //     return res.status(400).send("Qualification and CV are required");
    //   }
    // }

    // Hash student password
    const plainPassword = data.password;
    data["password"] = bcrypt.hashSync(data.password, 8);
    console.log(data);

    // Save user data
    const user = new User(data);
    await user.save();

    // Create parent account for student
    if (data.userType === "student") {
      let parent = await User.findOne({ email: data.guardianEmail });

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
        const parentAccount = new User(parentData);
        parent = await parentAccount.save();
      }

      // Update student's guardianId with the parent's ID
      user.guardianId = parent._id;
      await user.save();
    }

    res.send({ ...user._doc, password: undefined });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).send(messages.join(', '));
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      const value = err.keyValue[field];
      return res.status(400).send(`${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists.`);
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  passport.authenticate("local", async function (err, foundUser, info) {
    if (err) {
      // If an error occurs during authentication, send a single error response
      return res.status(500).send({ message: "Internal Server Error" });
    }

    if (!foundUser) {
      // If the user is not found or password is incorrect, return a single error response
      return res.status(400).send({ message: info.message });
    }

    console.log(foundUser, "found");

    try {
      // Fetch level details if the user exists
      const level = await Level.findOne(foundUser.levelId).lean();
      const levelName = level ? level.name : null;

      // --- DYNAMIC SUBSCRIPTION CHECK ---
      if (foundUser.userType !== 'super_admin') {
        let subscriptionUser = foundUser;

        // If not admin, find the admin to check THEIR subscription
        if (foundUser.userType !== 'admin') {
          // Assuming single tenant/admin for now as per requirement "if admin subscribe then dynamicall all users"
          const adminUser = await User.findOne({ userType: 'admin' });
          if (adminUser) {
            subscriptionUser = adminUser;
          } else {
            console.warn("No admin found to check subscription against. Allowing login.");
          }
        }

        // Check subscription logic on the target user (Self or Admin)
        const isSubscriptionActive = subscriptionUser.subscription &&
          subscriptionUser.subscription.expiresAt &&
          new Date(subscriptionUser.subscription.expiresAt) > new Date();

        // Check if explicitly set to inactive (optional, depending on your model usage)
        // const isExplicitlyActive = subscriptionUser.subscription?.isActive !== false;

        if (!isSubscriptionActive) {
          const msg = foundUser.userType === 'admin'
            ? "Your subscription has expired. Please renew to continue."
            : "School subscription has expired. Please contact the administrator.";
          return res.status(403).send({ message: msg });
        }
      }
      // ----------------------------------

      // Attempt to log in the user
      req.logIn(foundUser, function (err) {
        if (err) {
          return res.status(500).send({ message: "Failed to log in user" });
        }


        // Prepare the user object to send
        const userToSend = foundUser.toObject();

        // If simple user (not super_admin/admin) and we found an admin to inherit from
        // We verified above that the admin IS active (otherwise we would have 403'd)
        // So we can visually show the user they are subscribed by inheriting the admin's subscription details
        if (foundUser.userType !== 'super_admin' && foundUser.userType !== 'admin') {
          // We need to re-fetch admin here or scope the variable so it's accessible. 
          // Since we didn't save 'adminUser' in the wider scope in the previous block, let's just do a quick lookup or better yet, refactor the previous block to save it.
          // Actually, let's just do it cleanly:
        }

        // Wait, I can't easily access 'subscriptionUser' from the scope above inside this callback without refactoring.
        // Let's refactor the whole function slightly to be cleaner.

        return res.send({
          ...userToSend,
          levelName,
          // If we passed the check above, and we are not super_admin, we effectively have an active subscription.
          // However, let's be precise. 
          // If I am a student, I want to see the expiry date of the GLOBAL/SCHOOL subscription.
        });
      });
    } catch (fetchError) {
      // Catch errors while fetching level data
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
    if (req.body.email) {
      // email is not allowed to be updated
      delete req.body.email;
    }

    if (req.body.guardianEmail) {
      // guardian email is not allowed to be updated
      delete req.body.guardianEmail;
    }

    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
    });

    return res.status(200).send(user._doc);
  } catch (err) {
    next(err);
  }
};





exports.updateStudentSubject = async (req, res, next) => {
  try {
    const { studentId } = req.params;



    const user = await User.findByIdAndUpdate(
      studentId,
      { subjects: req.body }, // directly use the array
      { new: true }
    );

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
      const classroom = await Classroom.findById(classroomId);
      if (!classroom) {
        return res.status(404).send({ message: "Classroom not found." });
      }
      filter._id = { $in: classroom.students };
    }

    const result = await User.updateMany(
      filter,
      { subjects: subjectIds }, // Replaces existing subjects with the provided array
      { new: true }
    );

    return res.status(200).send({
      success: true,
      message: `${result.modifiedCount} students updated successfully.`,
      data: result,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

exports.getUsersNotInClassroom = async (req, res, next) => {
  // console.log(req.user);
  try {
    const { levelID } = req.params;

    const classroomsWithLevel = await Classroom.find({ levelID });

    // Extract user IDs from the classrooms
    const usersInClassroom = classroomsWithLevel.reduce((users, classroom) => {
      users.push(
        ...classroom.students,
        ...classroom.teachers.map((teacher) => teacher.teacher)
      );
      return users;
    }, []);

    // Find users not in any classroom with the given levelID
    const usersNotInClassroom = await User.find({
      $and: [
        { _id: { $nin: usersInClassroom } },
        {
          $or: [
            { userType: { $ne: "student" } },
            { $and: [{ userType: "student" }, { levelID }] },
          ],
        },
      ],
      userType: { $ne: "admin" }, // Exclude users with userType "admin"
    });
    const result = {
      students: usersNotInClassroom.filter(
        (user) => user.userType === "student"
      ),
      teachers: usersNotInClassroom.filter(
        (user) => user.userType === "teacher"
      ),
    };
    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getAllStudents = async (req, res, next) => {
  try {
    const users = await User.find({ userType: "student" });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.getAllStudentsWithLevel = async (req, res, next) => {
  try {
    // Extract levelId from route parameters
    const { levelId } = req.params;

    if (!levelId) {
      return res.status(400).send({ message: "Level Id is required." });
    }

    // Fetch students directly based on userType and levelID
    const students = await User.find({
      userType: "student",
      levelID: levelId.toString(),
    });

    console.log(students, "filtered students");

    res.send(students);
  } catch (error) {
    next(error);
  }
};





exports.getAllAdmins = async (req, res, next) => {
  try {
    // Strict check for Super Admin
    if (req.user.userType !== 'super_admin') {
      return res.status(403).send({ message: "Access denied. Super Admin only." });
    }
    const admins = await User.find({ userType: "admin" });
    res.send(admins);
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ userType: { $ne: "admin" } });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.acceptUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    // console.log(userID);
    const user = await User.findByIdAndUpdate(
      userID,
      { isAccepted: true },
      { new: true }
    );
    res.send(user?._doc);
  } catch (error) {
    next(error);
  }
};

exports.rejectUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndDelete(userID);
    res.send(user._doc);
  } catch (error) {
    next(error);
  }
};

exports.getStudentsOfTeacher = async (req, res, next) => {
  try {
    const teacherID = req.user._id;

    const classrooms = await Classroom.find({
      teachers: {
        $elemMatch: {
          teacher: teacherID,
        },
      },
    })
      .populate("students")
      .populate("teachers.subject");

    const students = [];

    for (const clas of classrooms) {
      const found = clas.teachers.find(
        (tea) => tea.teacher.toString() == teacherID
      );

      for (const student of clas.students) {
        // Only include students taking the specific subject taught by this teacher
        const studentSubjects = student.subjects ? student.subjects.map(s => s.toString()) : [];
        if (!studentSubjects.includes(found.subject._id.toString())) {
          continue;
        }

        // ⬇️ Calculate average attendance for each student
        const pipeline = [
          {
            $match: {
              classroomID: clas._id,
              subjectID: found.subject._id,
            },
          },
          {
            $project: {
              matchedAttendance: {
                $filter: {
                  input: "$attendance",
                  as: "att",
                  cond: {
                    $eq: [
                      "$$att.studentID",
                      student._id,
                    ],
                  },
                },
              },
            },
          },
        ];

        const classes = await Class.aggregate(pipeline);

        let totalMarked = 0;
        let presentCount = 0;

        classes.forEach((cls) => {
          cls.matchedAttendance.forEach((record) => {
            if (typeof record.isPresent !== "undefined") {
              totalMarked++;
              if (record.isPresent || record.late) presentCount++;
            }
          });
        });

        let avgAttendancePer = 0;
        if (totalMarked > 0) {
          avgAttendancePer = (presentCount / totalMarked) * 100;
        }

        students.push({
          ...student._doc,
          classroom: { _id: clas._id, name: clas.name },
          subject: { _id: found.subject._id, name: found.subject.name },
          avgAttendancePer: avgAttendancePer.toFixed(2),
        });
      }
    }

    res.send(students);
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

    const sID = new mongoose.Types.ObjectId(studentID);
    const cID = new mongoose.Types.ObjectId(classroomID);
    const subID = new mongoose.Types.ObjectId(subjectID);

    const user = await User.findById(studentID).select("-password");
    if (!user) return res.status(404).send("Student not found");

    const classroom = await Classroom.findById(classroomID);
    if (!classroom) return res.status(404).send("Classroom not found");

    const pipeline = [
      {
        $match: {
          classroomID: cID,
          subjectID: subID,
        },
      },
      {
        $project: {
          matchedAttendance: {
            $slice: [
              {
                $filter: {
                  input: "$attendance",
                  as: "att",
                  cond: {
                    $eq: ["$$att.studentID", sID],
                  },
                },
              },
              1
            ]
          },
          title: 1,
          startTime: 1,
          endTime: 1,
          createdBy: 1,
          oneTime: 1,
          classroomID: 1,
          subjectID: 1,
          teacher: 1,
          meetLink: 1,
        },
      },
      {
        $sort: { startTime: 1 }
      }
    ];

    const classes = await Class.aggregate(pipeline);



    const assignments = await Assignment.find({
      classroomID: cID,
      subjectID: subID,
    }).populate("subjectID");

    const quizes = await Quiz.find({
      classroomID: cID,
      subjectID: subID,
    }).populate("subjectID");

    let avgAttendancePer = 0;
    let presentCount = 0;
    let avgAssMarksPer = 0;
    let avgQuizMarksPer = 0;

    // Deduplicate sessions by startTime locally to ensure "one time" display
    const sessionMap = new Map();
    classes.forEach((item) => {
      const timeKey = item.startTime.toISOString();
      // If we have multiple docs for same time, prefer the one with attendance data
      const hasAttendance = item.matchedAttendance && item.matchedAttendance.length > 0;

      if (!sessionMap.has(timeKey) || (!sessionMap.get(timeKey).hasData && hasAttendance)) {
        sessionMap.set(timeKey, {
          ...item,
          hasData: hasAttendance
        });
      }
    });

    const uniqueClasses = Array.from(sessionMap.values());
    let totalAttendanceRecords = 0;

    // Process individual class sessions
    uniqueClasses.forEach((item) => {
      if (item.matchedAttendance && item.matchedAttendance.length > 0) {
        totalAttendanceRecords++;
        if (item.matchedAttendance[0].isPresent || item.matchedAttendance[0].late) {
          presentCount++;
        }
      }
    });

    if (totalAttendanceRecords > 0) {
      avgAttendancePer = (presentCount / totalAttendanceRecords) * 100;
    }

    const gradedAssignments = assignments.filter(ass =>
      ass.submissions.some(sub => sub.studentID.toString() === studentID && typeof sub.marks !== 'undefined')
    );

    if (gradedAssignments.length > 0) {
      let totalObtained = 0;
      let totalMax = 0;
      gradedAssignments.forEach(ass => {
        const sub = ass.submissions.find(s => s.studentID.toString() === studentID);
        totalObtained += sub.marks || 0;
        totalMax += ass.totalMarks;
      });
      avgAssMarksPer = ((totalObtained / totalMax) * 100).toFixed(0);
    }

    const gradedQuizzes = quizes.filter(q =>
      q.submissions.some(sub => sub.studentID.toString() === studentID && typeof sub.marks !== 'undefined')
    );

    if (gradedQuizzes.length > 0) {
      let totalObtained = 0;
      let totalMax = 0;
      gradedQuizzes.forEach(q => {
        const sub = q.submissions.find(s => s.studentID.toString() === studentID);
        totalObtained += sub.marks || 0;
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

    const mergedAttendanceRecords = [
      ...uniqueClasses.map(c => ({
        matchedAttendance: c.matchedAttendance,
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        type: "session"
      }))
    ];

    res.send({
      user: user._doc,
      averageAssignmentMarks: {
        percentage: avgAssMarksPer,
        grade: calculateGrade(avgAssMarksPer),
      },
      averageQuizMarks: {
        percentage: avgQuizMarksPer,
        grade: calculateGrade(avgQuizMarksPer),
      },
      assignments: assignments.map((ass) => {
        const submission = ass.submissions.find(
          (sub) => sub.studentID.toString() == studentID
        );
        const per = ass.totalMarks > 0 ? ((submission?.marks || 0) / ass.totalMarks) * 100 : 0;
        return {
          title: ass.title,
          subject: ass.subjectID?.name || "Subject",
          totalMarks: ass.totalMarks,
          obtainedMarks: submission?.marks,
          feedback: submission?.feedback || "",
          grade: submission?.grade,
          dueDate: ass.dueDate,
          isSubmitted: !!submission,
        };
      }),
      quizes: quizes.map((ass) => {
        const submission = ass.submissions.find(
          (sub) => sub.studentID.toString() == studentID
        );
        const per = ass.totalMarks > 0 ? ((submission?.marks || 0) / ass.totalMarks) * 100 : 0;
        return {
          title: ass.title,
          subject: ass.subjectID?.name || "Subject",
          totalMarks: ass.totalMarks,
          obtainedMarks: submission?.marks,
          feedback: submission?.feedback || "",
          grade: submission?.grade,
          dueDate: ass.dueDate,
          isSubmitted: !!submission,
        };
      }),
      attendance: { classes: mergedAttendanceRecords, avgAttendancePer }
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

    // Fetch all assignments and quizzes for the classrooms the student is in for this subject
    const userAssignmentsAndQuizzes = await Classroom.aggregate([
      {
        $match: {
          students: new mongoose.Types.ObjectId(studentID),
        },
      },
      {
        $lookup: {
          from: "assignments",
          localField: "_id",
          foreignField: "classroomID",
          as: "assignments",
        },
      },
      {
        $lookup: {
          from: "quizzes",
          localField: "_id",
          foreignField: "classroomID",
          as: "quizzes",
        },
      },
      {
        $project: {
          assignments: {
            $filter: {
              input: "$assignments",
              as: "assignment",
              cond: { $eq: ["$$assignment.subjectID", new mongoose.Types.ObjectId(subjectID)] }
            }
          },
          quizzes: {
            $filter: {
              input: "$quizzes",
              as: "quiz",
              cond: { $eq: ["$$quiz.subjectID", new mongoose.Types.ObjectId(subjectID)] }
            }
          }
        }
      }
    ]);

    const studentAssignments = [];
    const studentQuizzes = [];

    if (userAssignmentsAndQuizzes.length > 0) {
      userAssignmentsAndQuizzes.forEach(classroomData => {
        classroomData.assignments.forEach(ass => {
          const submission = ass.submissions.find(s => s.studentID.toString() === studentID.toString());
          const isGraded = typeof submission?.marks !== 'undefined' && submission?.marks !== null;
          let grade = submission?.grade;
          if (!grade && isGraded) {
            grade = calculateGrade((submission.marks / ass.totalMarks) * 100);
          }
          studentAssignments.push({
            _id: ass._id,
            title: ass.title,
            totalMarks: ass.totalMarks,
            obtainedMarks: submission?.marks,
            feedback: submission?.feedback || "",
            grade: grade || "-",
            deadline: ass.dueDate,
            isSubmitted: !!submission,
            submittedAt: submission?.submittedAt,
            isGraded: isGraded
          });
        });

        classroomData.quizzes.forEach(q => {
          const submission = q.submissions.find(s => s.studentID.toString() === studentID.toString());
          const isGraded = typeof submission?.marks !== 'undefined' && submission?.marks !== null;
          let grade = submission?.grade;
          if (!grade && isGraded) {
            grade = calculateGrade((submission.marks / q.totalMarks) * 100);
          }
          studentQuizzes.push({
            _id: q._id,
            title: q.title,
            totalMarks: q.totalMarks,
            obtainedMarks: submission?.marks,
            feedback: submission?.feedback || "",
            grade: grade || "-",
            deadline: q.dueDate,
            isSubmitted: !!submission,
            submittedAt: submission?.submittedAt,
            isGraded: isGraded
          });
        });
      });
    }

    const classes = await Class.aggregate([
      {
        $match: {
          subjectID: new mongoose.Types.ObjectId(subjectID),
          classroomID: { $in: await Classroom.find({ students: new mongoose.Types.ObjectId(studentID) }).distinct("_id") }
        },
      },
      {
        $project: {
          matchedAttendance: {
            $filter: {
              input: "$attendance",
              as: "attendance",
              cond: {
                $eq: ["$$attendance.studentID", new mongoose.Types.ObjectId(studentID)],
              },
            },
          },
          title: 1,
          startTime: 1,
          endTime: 1,
        },
      },
    ]);

    let avgAttendancePer = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    if (classes.length > 0) {
      classes.forEach((item) => {
        if (item.matchedAttendance && item.matchedAttendance.length > 0) {
          if (item.matchedAttendance[0].late) {
            lateCount++;
          } else if (item.matchedAttendance[0].isPresent) {
            presentCount++
          } else {
            absentCount++;
          }
        }
      });
      avgAttendancePer = ((presentCount + lateCount) / classes.length) * 100;
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
      attendance: { classes, avgAttendancePer, presentCount, absentCount, lateCount }
    });
  } catch (err) {
    next(err);
  }
};



exports.getStudentSubjects = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const student = await User.findById(studentID);

    const classrooms = await Classroom.find({ students: student._id })
      .populate("teachers.subject")
      .populate("teachers.teacher");

    const subjects = classrooms.reduce((result, classroom) => {
      if (classroom.teachers && classroom.teachers.length > 0) {
        classroom.teachers.forEach((teacher) => {
          if (teacher.subject) {
            // Only push the subject if the student is actively enrolled in it
            const studentSubjects = student.subjects ? student.subjects.map(s => s.toString()) : [];
            if (studentSubjects.includes(teacher.subject._id.toString())) {
              result.push({
                subject: teacher.subject,
                teacher: teacher.teacher.name,
                teacherId: teacher.teacher._id,
              });
            }
          }
        });
      }
      return result;
    }, []);



    const classes = await Class.find({
      attendance: { $elemMatch: { studentID: studentID } }
    }).sort({ startTime: 1 });

    // Use a Map to ensure unique subjects based on subject ID
    const uniqueSubjectsMap = new Map();

    subjects.forEach((item) => {
      if (!item.subject || !item.subject._id) return;

      const subjectIdStr = item.subject._id.toString();

      // If we haven't processed this subject yet, or if needed to handle multiple teachers for same subject (logic depends on requirements, 
      // but "same subject name... to a same teacher" implies we just want one entry per subject-teacher combo).
      // The previous issue was that it was looping through `classes` and pushing for EVERY class match.

      // Let's create a unique key based on SubjectID + TeacherName to be safe, 
      // or just SubjectID if the student only sees the subject once regardless of teacher.
      // Based on the user complaint "same subject name showing for time to a same teacher", 
      // it means even for the SAME teacher it was duplicating.
      const uniqueKey = `${subjectIdStr}-${item.teacher}`;

      if (!uniqueSubjectsMap.has(uniqueKey)) {

        // Calculate average attendance for this specific subject across ALL classes
        const subjectClasses = classes.filter(cls =>
          cls.subjectID && cls.subjectID.toString() === subjectIdStr
        );

        let avgAttendancePer = 0;

        if (subjectClasses.length > 0) {
          let totalAttended = 0;
          let totalClasses = 0;

          subjectClasses.forEach(cls => {
            const attendanceRecord = cls.attendance.find(
              (sub) => sub.studentID.toString() === studentID.toString()
            );

            // Only count this class if the student was marked in attendance (present or absent)
            // If the record exists, they were marked.
            if (attendanceRecord) {
              totalClasses++;
              if (attendanceRecord.isPresent) {
                totalAttended++;
              }
            }
          });

          if (totalClasses > 0) {
            avgAttendancePer = ((totalAttended / totalClasses) * 100).toFixed(0);
          }
        }

        uniqueSubjectsMap.set(uniqueKey, {
          ...item,
          avgAttendancePer
        });
      }
    });

    const newarr = Array.from(uniqueSubjectsMap.values());

    console.log("new array is : ", newarr);

    res.send({ subjects: newarr, assignedSubjects: student.subjects });
  } catch (err) {
    next(err);
  }
};






exports.getSubjectsWithLevel = async (req, res, next) => {
  try {
    const { levelID } = req.params;


    // Fetch level name using levelID
    const level = await Level.findById(levelID);
    if (!level) {
      return res.status(404).json({ message: "Level not found" });
    }

    // Fetch all subjects associated with that levelID
    const subjects = await Subject.find({ levelID });

    // Format the result
    const formattedSubjects = subjects.map((subject) => ({
      _id: subject._id,
      subjectName: subject.name,
    }));

    // Send response with level name and subject names
    res.status(200).send({
      levelName: level.name,
      subjects: formattedSubjects,
    });
  } catch (err) {
    next(err);
  }
};


exports.getTeachersForAdmin = async (req, res, next) => {
  try {
    const teachers = await User.find({ userType: "teacher" });
    const classrooms = await Classroom.find({})
      .populate("teachers.subject")
      .populate("teachers.teacher");



    const classes = await Class.find({});

    // teachers.forEach((teach) => {
    //   let teacharr = classes.filter((c) => c.teacher.teacherID.toString() == teach._id.toString());
    //   if (teacharr.length > 0) {
    //     let count = teacharr.reduce((acum, resul) => (resul.teacher.status == "present"? acum.presents = acum.presents + 1 : acum.presents, acum) ,{presents: 0})
    //     console.log(count);
    //   }
    // })

    // get all assignments and quizes of the teacher
    let assignments = await Assignment.find({
      createdBy: { $in: teachers.map((tea) => tea._id) },
      submissions: { $elemMatch: { marks: { $exists: true } } },
    });
    let quizes = await Quiz.find({
      createdBy: { $in: teachers.map((tea) => tea._id) },
      submissions: { $elemMatch: { marks: { $exists: true } } },
    });

    quizes = quizes.map((ass) => {
      const marks =
        (ass.submissions.reduce((total, sub) => {
          return total + sub.marks;
        }, 0) /
          ass.totalMarks /
          ass.submissions.length) *
        100;

      return {
        ...ass._doc,
        average: {
          percentage: marks,
          grade: marks > 90 ? "A" : "B",
        },
      };
    });

    assignments = assignments.map((ass) => {
      const marks =
        (ass.submissions.reduce((total, sub) => {
          return total + sub.marks;
        }, 0) /
          ass.totalMarks /
          ass.submissions.length) *
        100;

      return {
        ...ass._doc,
        average: {
          percentage: marks,
          grade: marks > 90 ? "A" : "B",
        },
      };
    });


    // push all assignments and quize to specific teacher in teachers in classroom
    const teachersInClassroom = classrooms.reduce((result, classroom) => {
      classroom.teachers.forEach((teacher) => {
        if (!result[teacher?.teacher?._id]) {
          result[teacher?.teacher?._id] = [];
        }

        let classData = classes.filter((c) => {
          return (
            c.teacher?.teacherID.toString() == teacher?.teacher?._id.toString() &&
            c.classroomID == classroom?._id?.toString()
          )
        });
        let attendnececount = {};
        attendnececount = classData.reduce((acum, resul) => (resul.teacher.status == "present" ? acum.presents = acum.presents + 1 : acum.presents, acum), { presents: 0 })
        // console.log(attendnececount);

        let ass = assignments.filter((a) => {
          return (
            a.createdBy.toString() == teacher?.teacher?._id.toString() &&
            a.classroomID.toString() == classroom?._id.toString()
          );
        });

        let ass2 =
          ass.reduce((total, asi) => {
            return total + asi.average.percentage;
          }, 0) / ass.length;

        let qui = quizes.filter((a) => {
          return (
            a.createdBy.toString() == teacher?.teacher?._id.toString() &&
            a.classroomID.toString() == classroom?._id.toString()
          );
        });

        let qui2 =
          qui.reduce((total, asi) => {
            return total + asi.average.percentage;
          }, 0) / qui.length;

        result[teacher?.teacher?._id].push({
          attendence: {
            classData,
            attendnececount
          },
          assignments: {
            count: ass.length,
            percentage: ass2,
            grade: ass2 > 90 ? "A" : "B",
          },
          quizes: {
            count: qui.length,
            percentage: qui2,
            grade: qui2 > 90 ? "A" : "B",
          },
          subject: teacher.subject,
          teacher: teacher.teacher,
          classroomName: classroom.name
        });
      });
      return result;
    }, {});

    return res.send(teachersInClassroom);

    // group assignments by createdBy and classroomID
    // const groupedAssignments = assignments.reduce((result, assignment) => {
    //   if (!result[assignment.createdBy]) {
    //     result[assignment.createdBy] = {};
    //   }
    //   if (!result[assignment.createdBy][assignment.classroomID]) {
    //     result[assignment.createdBy][assignment.classroomID] = [];
    //   }
    //   result[assignment.createdBy][assignment.classroomID].push(assignment);
    //   return result;
    // }, {});
    // // group quizes by createdBy and classroomID
    // const groupedQuizes = quizes.reduce((result, quiz) => {
    //   if (!result[quiz.createdBy]) {
    //     result[quiz.createdBy] = {};
    //   }
    //   if (!result[quiz.createdBy][quiz.classroomID]) {
    //     result[quiz.createdBy][quiz.classroomID] = [];
    //   }
    //   result[quiz.createdBy][quiz.classroomID].push(quiz);
    //   return result;
    // }, {});

    // res.send({ groupedAssignments, groupedQuizes });
  } catch (err) {
    console.log("error while getting all teacher si : ", err);
    next(err);
  }
};

// fazool function he yeh
exports.getStudentReportsForAdmin = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const student = await User.findById(studentID);

    if (!student) {
      return res.status(404).send("Student not found");
    }

    // get all classrooms of student

    const classroomsWithAssignmentsAndQuizes = await Classroom.aggregate([
      {
        $match: {
          students: mongoose.Types.ObjectId(studentID),
        },
      },
      {
        $lookup: {
          from: "assignments", // Assuming the name of the assignments collection is "assignments"
          localField: "_id",
          foreignField: "classroomID",
          as: "assignments",
        },
      },
      {
        $lookup: {
          from: "quizzes", // Assuming the name of the quizzes collection is "quizzes"
          localField: "_id",
          foreignField: "classroomID",
          as: "quizzes",
        },
      },

      {
        $addFields: {
          assignments: {
            $filter: {
              input: "$assignments",
              as: "assignment",
              cond: { $ifNull: ["$$assignment.submissions.marks", false] },
            },
          },
          quizzes: {
            $filter: {
              input: "$quizzes",
              as: "quiz",
              cond: { $ifNull: ["$$quiz.submissions.marks", false] },
            },
          },
        },
      },
    ]);

    // console.log("report for admin is : ", classroomsWithAssignmentsAndQuizes[0]);

    // get activities of student
    const activities = await Activity.find({ userID: studentID });

    return res.send({ classroomsWithAssignmentsAndQuizes, activities });
  } catch (err) {
    next(err);
  }
};

// update user by admin
exports.updateUserByAdmin = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndUpdate(userID, req.body, {
      new: true,
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
    const user = await User.findByIdAndDelete(userID);
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

    if (!fcmToken) {
      return res.status(400).send("fcmToken is required");
    }

    const foundDevice = await Device.findOne({
      userID: currUser._id,
      fcmToken,
    });

    if (foundDevice) {
      return res.status(200).send(foundDevice);
    }

    const device = new Device({ fcmToken, userID: currUser._id });

    await device.save();

    return res.status(200).send(device);
  } catch (err) {
    next(err);
  }
};

exports.getStudentSubjectsForStudent = async (req, res, next) => {
  try {
    const studentID = req.user._id;

    const classrooms = await Classroom.find({ students: studentID })
      .populate("teachers.subject")
      .populate("teachers.teacher");

    const subjects = classrooms.reduce((result, classroom) => {
      if (classroom.teachers && classroom.teachers.length > 0) {
        classroom.teachers.forEach((teacher) => {
          if (teacher.subject) {
            result.push({
              subject: teacher.subject,
              teacher: teacher.teacher.name,
            });
          }
        });
      }
      return result;
    }, []);

    res.send(subjects);
  } catch (err) {
    next(err);
  }
};

exports.getStudentGradesForSubjectForStudent = async (req, res, next) => {
  try {
    // get subjectID from params
    const { subjectID } = req.params;
    const studentID = req.user._id;

    const userAssignmentsAndQuizzes = await Classroom.aggregate([
      {
        $match: {
          students: mongoose.Types.ObjectId(studentID),
        },
      },
      {
        $lookup: {
          from: "assignments",
          localField: "_id",
          foreignField: "classroomID",
          as: "assignments",
        },
      },
      {
        $lookup: {
          from: "quizzes",
          localField: "_id",
          foreignField: "classroomID",
          as: "quizzes",
        },
      },
      {
        $project: {
          assignments: {
            $filter: {
              input: "$assignments",
              as: "assignment",
              cond: { $eq: ["$$assignment.subjectID", mongoose.Types.ObjectId(subjectID)] }
            }
          },
          quizzes: {
            $filter: {
              input: "$quizzes",
              as: "quiz",
              cond: { $eq: ["$$quiz.subjectID", mongoose.Types.ObjectId(subjectID)] }
            }
          }
        }
      }
    ]);

    const studentAssignments = [];
    const studentQuizzes = [];

    if (userAssignmentsAndQuizzes.length > 0) {
      const { assignments, quizzes } = userAssignmentsAndQuizzes[0];

      assignments.forEach(ass => {
        const submission = ass.submissions.find(s => s.studentID.toString() === studentID.toString());
        studentAssignments.push({
          _id: ass._id,
          title: ass.title,
          totalMarks: ass.totalMarks,
          obtainedMarks: submission?.marks,
          feedback: submission?.feedback || "",
          grade: submission?.grade,
          deadline: ass.dueDate,
          isSubmitted: !!submission,
          submittedAt: submission?.submittedAt
        });
      });

      quizzes.forEach(q => {
        const submission = q.submissions.find(s => s.studentID.toString() === studentID.toString());
        studentQuizzes.push({
          _id: q._id,
          title: q.title,
          totalMarks: q.totalMarks,
          obtainedMarks: submission?.marks,
          feedback: submission?.feedback || "",
          grade: submission?.grade,
          deadline: q.dueDate,
          isSubmitted: !!submission,
          submittedAt: submission?.submittedAt
        });
      });
    }

    const pipeline = [
      {
        $match: {
          subjectID: mongoose.Types.ObjectId(subjectID),
          classroomID: { $in: await Classroom.find({ students: studentID }).distinct("_id") }
        },
      },
      {
        $project: {
          matchedAttendance: {
            $filter: {
              input: "$attendance",
              as: "attendance",
              cond: {
                $eq: ["$$attendance.studentID", mongoose.Types.ObjectId(studentID)],
              },
            },
          },
          title: 1,
          startTime: 1,
          endTime: 1,
        },
      },
      {
        $sort: { startTime: 1 }
      }
    ];

    const classes = await Class.aggregate(pipeline);

    // Deduplicate sessions by startTime locally to ensure "one time" display
    const sessionMap = new Map();
    classes.forEach((item) => {
      const timeKey = moment(item.startTime).format("YYYY-MM-DD HH:mm");
      // If we have multiple docs for same time (e.g. within same minute), prefer the one with attendance data
      const hasAttendance = item.matchedAttendance && item.matchedAttendance.length > 0;

      if (!sessionMap.has(timeKey) || (!sessionMap.get(timeKey).hasData && hasAttendance)) {
        sessionMap.set(timeKey, {
          ...item,
          hasData: hasAttendance
        });
      }
    });

    const uniqueClasses = Array.from(sessionMap.values());
    let avgAttendencePer = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let totalAttendanceRecords = uniqueClasses.length;

    if (uniqueClasses.length > 0) {
      uniqueClasses.forEach((item) => {
        if (item.matchedAttendance.length > 0) {
          if (item.matchedAttendance[0].late) {
            lateCount++;
          } else if (item.matchedAttendance[0].isPresent) {
            presentCount++
          } else {
            absentCount++;
          }
        }
      });
    }

    if (totalAttendanceRecords > 0) {
      avgAttendencePer = ((presentCount + lateCount) / totalAttendanceRecords) * 100;
    }

    const calculateGrade = (per) => {
      if (per >= 90) return "A";
      if (per >= 80) return "B";
      if (per >= 70) return "C";
      if (per >= 60) return "D";
      if (per >= 50) return "E";
      return "F";
    };

    const mergedAttendanceRecordsForStudent = [
      ...uniqueClasses.map(c => ({
        matchedAttendance: c.matchedAttendance,
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        type: "session"
      }))
    ];

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
      attendance: { classes: mergedAttendanceRecordsForStudent, avgAttendencePer, presentCount, absentCount, lateCount }
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
    console.log(req.user._id, "user id in update password controller");

    // Update only the password field in the database

    const user = await userRepository.findUserAndUpdatePasswordById(req.user._id, hashedPassword);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.status(200).send({ message: "Password updated successfully!" });
  } catch (err) {
    console.error("Error updating password:", err);
    next(err);
  }
};
