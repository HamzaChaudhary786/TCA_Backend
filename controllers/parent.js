const User = require("../models/user");
const Classroom = require("../models/classroom");
const Assignment = require("../models/assignment");
const Quiz = require("../models/quiz");
const Chatroom = require("../models/chatroom");
const mongoose = require("mongoose");
const Class = require("../models/class");
const Attendance = require("../models/attendence");
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

    const user = await User.findById(studentID).select("-password");
    const classroom = await Classroom.findById(classroomID);
    if (!classroom) return res.status(404).send("Classroom not found");

    const assignments = await Assignment.find({ classroomID, subjectID });
    const quizes = await Quiz.find({ classroomID, subjectID });
    const classFilter = { classroomID, subjectID };
    if (teacherID) {
      classFilter["teacher.teacherID"] = teacherID;
    }
    const classes = await Class.find(classFilter).sort({ startTime: 1 });

    const mapDeliverable = (item) => {
      const sub = item.submissions.find(s => s.studentID.toString() === studentID.toString());
      const isGraded = typeof sub?.marks !== 'undefined' && sub?.marks !== null;
      let grade = sub?.grade;
      if (!grade && isGraded) {
        grade = calculateGrade((sub.marks / item.totalMarks) * 100);
      }
      return {
        _id: item._id,
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
    // Using a more robust key (YYYY-MM-DD HH:mm) to handle millisecond differences
    const sessionMap = new Map();
    classes.forEach((cls) => {
      const timeKey = moment(cls.startTime).format("YYYY-MM-DD HH:mm");
      // If we have multiple documents for same time, prefer the one with more student attendance records
      const existing = sessionMap.get(timeKey);
      const studentMatch = cls.attendance?.find(a => a.studentID.toString() === studentID.toString());
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
      user: user._doc,
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

    const classrooms = await Classroom.find({ students: studentID });

    const chatrooms = [];

    // Use for...of loop instead of map to allow proper use of async/await
    for (const classroom of classrooms) {
      for (const teac of classroom.teachers) {
        // Check if the chatroom already exists
        const foundChat = await Chatroom.findOne({
          participants: {
            $all: [teac.teacher, req.user._id].map((id) =>
              mongoose.Types.ObjectId(id)
            ),
          },
        });

        if (!foundChat) {
          // Create a new chatroom if not found
          const chatroom = new Chatroom({
            participants: [teac.teacher, req.user._id].map((id) =>
              mongoose.Types.ObjectId(id)
            ),
            messages: [],
          });
          await chatroom.save();
          chatrooms.push(chatroom);
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

    const parent = await User.findOne({ email }).select("-password");

    if (!parent) next({ message: "User not found" });

    const children = await User.find({ guardianEmail: parent.email }).select(
      "-password"
    );

    res.send(children);
  } catch (error) {
    next(error);
  }
};

exports.getChilSubjects = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    // Fetch classrooms and populate teachers' subjects and details
    const classrooms = await Classroom.find({ students: studentID })
      .populate("teachers.subject")
      .populate("teachers.teacher");

    // Extract unique subjects, teachers, and classrooms from the data
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

    // Fetch all classes where the student has attendance records
    const classes = await Class.find({
      attendance: { $elemMatch: { studentID: studentID } },
    });

    // Create a map to track aggregated attendance per subject
    const attendanceMap = new Map();

    // Aggregate attendance records by subject and calculate percentage
    classes.forEach((cls) => {
      const subjectID = cls.subjectID.toString();

      // Initialize attendance data for this subject if not already present
      if (!attendanceMap.has(subjectID)) {
        attendanceMap.set(subjectID, { totalClasses: 0, presentClasses: 0 });
      }

      // Update the aggregated attendance data for the subject
      const attendanceData = attendanceMap.get(subjectID);
      cls.attendance.forEach((record) => {
        if (record.studentID.toString() === studentID.toString()) {
          attendanceData.totalClasses++;
          if (record.isPresent) {
            attendanceData.presentClasses++;
          }
        }
      });
    });

    // Calculate attendance percentage and store in the map
    attendanceMap.forEach((data, subjectID) => {
      data.avgAttendancePer = (
        (data.presentClasses / data.totalClasses) * 100
      ).toFixed(0);
    });

    // Merge attendance data with subjects, avoiding duplication
    const newarr = subjects.map((item) => {
      const subjectData = attendanceMap.get(item.subject._id.toString());
      if (subjectData) {
        // Subject found in attendance records; merge the data
        return { ...item, avgAttendancePer: subjectData.avgAttendancePer };
      } else {
        // Subject not found in attendance records; return as is
        return item;
      }
    });

    // Send the processed subjects as the response
    res.send({ subjects: newarr });
  } catch (err) {
    next(err);
  }
};


exports.getParentChats;







exports.getStudentLastDeliveredAssignmentReport = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    // Fetch student details
    const user = await User.findById(studentID).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get all classrooms where the student is present
    const classrooms = await Classroom.find({ students: studentID });
    if (!classrooms || classrooms.length === 0) {
      return res.status(404).json({ message: "No classrooms found for student" });
    }

    const classroomIDs = classrooms.map(c => c._id);

    // Fetch assignments and quizzes where the student has a GRADED submission
    const [assignments, quizzes] = await Promise.all([
      Assignment.find({
        classroomID: { $in: classroomIDs },
        submissions: { $elemMatch: { studentID, marks: { $exists: true } } }
      }).sort({ createdAt: -1 }).limit(1),
      Quiz.find({
        classroomID: { $in: classroomIDs },
        submissions: { $elemMatch: { studentID, marks: { $exists: true } } }
      }).sort({ createdAt: -1 }).limit(1)
    ]);

    // Combine and find the actual latest one
    const deliverables = [
      ...assignments.map(a => ({ ...a._doc, type: "Assignment" })),
      ...quizzes.map(q => ({ ...q._doc, type: "Quiz" }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let lastDeliverable = null;
    if (deliverables.length > 0) {
      const item = deliverables[0];
      const submission = item.submissions.find(s => s.studentID.toString() === studentID);

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
      user: user._doc,
      lastAssignment: lastDeliverable,
    });
  } catch (error) {
    next(error);
  }
};




// ... existing code above ...

// Removed duplicate function definition

// ADD THIS AT THE BOTTOM ↓
exports.getChildAssignments = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const classrooms = await Classroom.find({ students: studentID });
    if (!classrooms || classrooms.length === 0) {
      return res.status(404).json({ message: "No classrooms found for student" });
    }

    const classroomIDs = classrooms.map((classroom) => classroom._id);

    const [assignments, quizzes] = await Promise.all([
      Assignment.find({ classroomID: { $in: classroomIDs } }).populate("subjectID").populate("classroomID").sort({ createdAt: -1 }),
      Quiz.find({ classroomID: { $in: classroomIDs } }).populate("subjectID").populate("classroomID").sort({ createdAt: -1 })
    ]);

    const mapItem = (item) => {
      const sub = item.submissions.find(s => s.studentID.toString() === studentID.toString());
      const isGraded = typeof sub?.marks !== 'undefined' && sub?.marks !== null;
      return {
        ...item._doc,
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
