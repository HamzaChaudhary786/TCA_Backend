const User = require("../models/user");
const Classroom = require("../models/classroom");
const Assignment = require("../models/assignment");
const Quiz = require("../models/quiz");
const Chatroom = require("../models/chatroom");
const mongoose = require("mongoose");
const Class = require("../models/class");

exports.getStudentReportForParent = async (req, res, next) => {
  try {

    console.log("inside function");

    const { studentID } = req.params;
    const { classroomID, subjectID, teacherID } = req.query;

    const user = await User.findById(studentID).select("-password");

    // get assignments and quizes of the student for that classroom of the teacher of the subject
    const classroom = await Classroom.findById(classroomID);
    console.log("classroom is : ", classroomID);
    const teacher = classroom.teachers.find(
      (teacher) =>
        teacher.teacher.toString() == teacherID &&
        teacher.subject.toString() == subjectID
    );

    const assignments = await Assignment.find({
      classroomID,
      subjectID: teacher.subject,
      submissions: { $elemMatch: { studentID } },
      submissions: { $elemMatch: { studentID, marks: { $exists: true } } },
    });

    const quizes = await Quiz.find({
      classroomID,
      subjectID: teacher.subject,
      // match studentID and check if teacher has graded the quiz
      submissions: { $elemMatch: { studentID, marks: { $exists: true } } },
    });

    console.log(quizes, "quizes data ");
    console.log(assignments, "assignment data ");


    const classes = await Class.find({
      classroomID,
      subjectID
    });

    let avgAssMarksPer = 0;
    let avgQuizMarksPer = 0;
    let avgAttendancePer = 0;
    if (assignments.length > 0) {
      avgAssMarksPer = (
        (assignments.reduce(
          (total, assignment) =>
            total +
            assignment.submissions.find((sub) => sub.studentID == studentID)
              .marks,
          0
        ) /
          assignments.reduce(
            (total, assignment) => total + assignment.totalMarks,
            0
          )) *
        100
      ).toFixed(0);
    }
    if (quizes.length > 0) {
      avgQuizMarksPer = (
        (quizes.reduce(
          (total, quiz) =>
            total +
            quiz.submissions.find((sub) => sub.studentID == studentID).marks,
          0
        ) /
          quizes.reduce((total, quiz) => total + quiz.totalMarks, 0)) *
        100
      ).toFixed(0);
    }

    if (classes.length > 0) {
      const totalPresent = classes.reduce((total, classs) => {
        const attendanceRecord = classs?.attendance?.find(
          (sub) => sub.studentID.toString() === studentID
        );
        // Count 'present' or 'late' as attended
        return total + ((attendanceRecord?.isPresent === true || attendanceRecord?.late === true) ? 1 : 0);
      }, 0);

      const totalClasses = classes.reduce((total, classs) => {
        const attendanceRecord = classs?.attendance?.find(
          (sub) => sub.studentID.toString() === studentID
        );
        return total + (attendanceRecord ? 1 : 1); // Count every class
      }, 0);

      const totalLate = classes.reduce((total, classs) => {
        const attendanceRecord = classs?.attendance?.find(
          (sub) => sub.studentID.toString() === studentID
        );
        return total + (attendanceRecord?.late === true ? 1 : 0);
      }, 0);

      // Calculate percentages
      avgAttendancePer = ((totalPresent / totalClasses) * 100).toFixed(0);
      avgLatePer = ((totalLate / totalClasses) * 100).toFixed(0);
    }


    res.send({
      user: user._doc,
      averageAssignmentMarks: {
        percentage: avgAssMarksPer,
        grade:
          avgAssMarksPer > 90
            ? "A"
            : avgAssMarksPer > 80
              ? "B"
              : avgAssMarksPer > 70
                ? "C"
                : avgAssMarksPer > 60
                  ? "D"
                  : "F",
      },
      averageQuizMarks: {
        percentage: avgQuizMarksPer,
        grade:
          avgQuizMarksPer > 90
            ? "A"
            : avgQuizMarksPer > 80
              ? "B"
              : avgQuizMarksPer > 70
                ? "C"
                : avgQuizMarksPer > 60
                  ? "D"
                  : "F",
      },
      avgAttendancePer,
      assignments: assignments.map((ass) => {
        return {
          totalMarks: ass.totalMarks,
          title: ass.title,
          dueDate: ass.dueDate,
          files: ass.files, // Include files
          submissions: ass.submissions.map((sub) => ({
            studentID: sub.studentID,
            feedback: sub.feedback,
            file: sub.file,
            submittedAt: sub.submittedAt,
            isLate: sub.isLate,
          })), // Include submissions data
          marksObtained: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).marks,
        };
      }),
      quizes: quizes.map((ass) => {
        return {
          totalMarks: ass.totalMarks,
          title: ass.title,
          dueDate: ass.dueDate,
          files: ass.files,
          submissions: ass.submissions.map((sub) => ({
            studentID: sub.studentID,
            feedback: sub.feedback,
            file: sub.file,
            submittedAt: sub.submittedAt,
            isLate: sub.isLate,
          })),
          marksObtained: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).marks,
        };
      }),

      attendance: classes.map((cls) => {
        const attendanceRecord = cls.attendance.find(
          (att) => att.studentID.toString() == studentID
        );
        return {
          className: cls.title,
          startTime: cls.startTime,
          endTime: cls.endTime,
          isPresent: attendanceRecord?.isPresent || false,
          isLate: attendanceRecord?.late || false,
        };
      }),
      averageAttendancePercentage: avgAttendancePer,
      averageLatePercentage: avgLatePer,
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
    console.log("Inside function");

    const { studentID } = req.params;

    // Fetch student details
    const user = await User.findById(studentID).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get all classrooms where the student is present
    const classrooms = await Classroom.find({
      students: studentID,
    });

    if (!classrooms || classrooms.length === 0) {
      return res.status(404).json({ message: "No classrooms found for student" });
    }

    let avgAssMarksPer = 0;
    let grade = "F";

    // Collect all subject and classroom IDs
    const classroomIDs = classrooms.map(classroom => classroom._id);
    const subjectIDs = classrooms.flatMap(classroom => classroom.teachers.map(teacher => teacher.subject));

    // Fetch all assignments in one database query
    const allAssignments = await Assignment.find({
      classroomID: { $in: classroomIDs },
      subjectID: { $in: subjectIDs },
      submissions: { $elemMatch: { studentID } },
    });

    // Calculate percentage and grade for the last delivered assignment
    if (allAssignments.length > 0) {
      const lastAssignment = allAssignments[allAssignments.length - 1];
      const submission = lastAssignment.submissions.find(
        (sub) => sub.studentID.toString() === studentID
      );

      if (submission && submission.marks !== undefined) {
        avgAssMarksPer = (
          (submission.marks / lastAssignment.totalMarks) * 100
        ).toFixed(0);

        grade = avgAssMarksPer > 90
          ? "A"
          : avgAssMarksPer > 80
            ? "B"
            : avgAssMarksPer > 70
              ? "C"
              : avgAssMarksPer > 60
                ? "D"
                : "F";
      }
    }

    // Send the response
    res.send({
      user: user._doc,
      lastAssignment: allAssignments.length > 0 ? {
        title: allAssignments[allAssignments.length - 1].title,
        marksObtained: allAssignments[allAssignments.length - 1].submissions.find(
          (sub) => sub.studentID.toString() == studentID
        ).marks,
        percentage: avgAssMarksPer,
        grade,
      } : null,
    });
  } catch (error) {
    next(error);
  }
};
