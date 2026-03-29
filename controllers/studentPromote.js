const StudentPromote = require('../models/studentPromote');
const Classroom = require('../models/classroom');
const Attendance = require('../models/attendence');
const Assignment = require('../models/assignment');
const Quiz = require('../models/quiz');
const Class = require('../models/class');
const ArchivedReport = require('../models/archivedReport');
const User = require('../models/user');

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

    // Validate Classrooms
    const srcClassroom = await Classroom.findById(sourceClassroom);
    const tgtClassroom = await Classroom.findById(targetClassroom);

    if (!srcClassroom || !tgtClassroom) {
      return res.status(404).json({ success: false, message: 'Source or target classroom not found' });
    }

    const studentIds = students.map(s => s.id);

    // 1. Gather & Archive Data for each student
    const archivedReports = [];
    for (const student of students) {
      // Get attendance records for this student in the source classroom
      const attendances = await Attendance.find({ entityId: sourceClassroom, entityType: "classroom", "students.studentID": student.id });

      const studentAttendance = attendances.map(att => {
        const record = att.students.find(s => s.studentID.toString() === student.id.toString());
        return {
          date: att.Date,
          isPresent: record ? record.isPresent : false,
          late: record ? record.late : false,
        };
      }).filter(a => a !== null);

      // Get assignments
      const assignments = await Assignment.find({ classroomID: sourceClassroom, "submissions.studentID": student.id });
      const studentAssignments = assignments.map(asn => {
        const sub = asn.submissions.find(s => s.studentID.toString() === student.id.toString());
        return {
          assignmentID: asn._id,
          title: asn.title,
          totalMarks: asn.totalMarks,
          obtainedMarks: sub ? sub.marks : null,
          grade: sub ? sub.grade : null,
          feedback: sub ? sub.feedback : null,
          submittedAt: sub ? sub.submittedAt : null,
        };
      });

      // Get quizzes
      const quizzes = await Quiz.find({ classroomID: sourceClassroom, "submissions.studentID": student.id });
      const studentQuizzes = quizzes.map(qz => {
        const sub = qz.submissions.find(s => s.studentID.toString() === student.id.toString());
        return {
          quizID: qz._id,
          title: qz.title,
          totalMarks: qz.totalMarks,
          obtainedMarks: sub ? sub.marks : null,
          grade: sub ? sub.grade : null,
          feedback: sub ? sub.feedback : null,
          submittedAt: sub ? sub.submittedAt : null,
        };
      });

      // Get Scheduled Classes and Attendance
      const classes = await Class.find({ classroomID: sourceClassroom, "attendance.studentID": student.id });
      const studentScheduleClasses = classes.map(cls => {
        const att = cls.attendance.find(s => s.studentID.toString() === student.id.toString());
        return {
          classID: cls._id,
          title: cls.title,
          startTime: cls.startTime,
          endTime: cls.endTime,
          subjectID: cls.subjectID,
          isPresent: att ? att.isPresent : false,
          late: att ? att.late : false,
        };
      });

      // Prepare archive document
      archivedReports.push({
        studentID: student.id,
        sourceClassroomID: sourceClassroom,
        targetClassroomID: targetClassroom,
        promotionDate: new Date(),
        attendanceRecords: studentAttendance,
        assignments: studentAssignments,
        quizzes: studentQuizzes,
        scheduleClasses: studentScheduleClasses,
      });
    }

    // Insert all archived reports
    await ArchivedReport.insertMany(archivedReports);

    // 2. Cleanup Data from Source Classroom (pull student from submissions/attendance)
    await Attendance.updateMany(
      { entityId: sourceClassroom, entityType: "classroom" },
      { $pull: { students: { studentID: { $in: studentIds } } } }
    );

    await Assignment.updateMany(
      { classroomID: sourceClassroom },
      { $pull: { submissions: { studentID: { $in: studentIds } } } }
    );

    await Quiz.updateMany(
      { classroomID: sourceClassroom },
      { $pull: { submissions: { studentID: { $in: studentIds } } } }
    );

    await Class.updateMany(
      { classroomID: sourceClassroom },
      { $pull: { attendance: { studentID: { $in: studentIds } } } }
    );

    // 3. Move Students between classrooms
    srcClassroom.students = srcClassroom.students.filter(id => !studentIds.includes(id.toString()));
    await srcClassroom.save();

    // Prevent duplicates in target classroom
    const existingTargetStudents = tgtClassroom.students.map(id => id.toString());
    const newStudentsToAdd = studentIds.filter(id => !existingTargetStudents.includes(id.toString()));
    tgtClassroom.students.push(...newStudentsToAdd);
    await tgtClassroom.save();

    // Update the students' level details in the User collection
    await User.updateMany({ _id: { $in: studentIds } }, { levelID: targetLevel });

    // 4. Save Promotion Record
    const newPromotion = new StudentPromote({
      sourceClassroom,
      sourceLevel,
      targetClassroom,
      targetLevel,
      promotorName: currUser?.name || "Unknown",
      promotorDate: new Date(),
      promotorDescription,
      isApproved: true, // Marking it approved directly
      students
    });

    const savedPromotion = await newPromotion.save();

    res.status(201).json({ success: true, data: savedPromotion });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = createStudentPromotion;
