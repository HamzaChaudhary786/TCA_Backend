const prisma = require("../db/prisma");
const classroomRepository = require("../repositories/classroomRepository");
const levelRepository = require("../repositories/levelRepository");
const subjectRepository = require("../repositories/subjectRepository");

exports.createClassroom = async (req, res, next) => {
  try {
    const data = req.body;
    const { headTeacher, students, teachers, levelID, name } = data;

    if (!name || !students || !teachers || students.length < 1 || teachers.length < 1) {
      return res.status(400).send("All fields are required");
    }

    const currUser = req.user;

    const classroomFound = await prisma.classroom.findFirst({
      where: { name, levelID }
    });
    if (classroomFound) return res.status(400).send("Classroom already exists");

    let finalTeachers = teachers;
    let subject = null;

    if (currUser.userType === "teacher") {
      if (!data.subject) return res.status(400).send("Subject is required");
      subject = await prisma.subject.findUnique({ where: { id: data.subject } });
      if (!subject) return res.status(400).send("Subject does not exist");

      finalTeachers = [{
        teacherID: currUser.id,
        subjectID: data.subject,
        type: "teacher"
      }];
    } else {
      if (!levelID) return res.status(400).send("Level is required");
      const level = await prisma.level.findUnique({ where: { id: levelID } });
      if (!level) return res.status(400).send("Level does not exist");

      finalTeachers = teachers.map(t => ({
        teacherID: t.teacher,
        subjectID: t.subject,
        type: t.type || (t.teacher === headTeacher ? "head" : "teacher")
      }));
    }

    const classroom = await prisma.classroom.create({
      data: {
        name,
        levelID,
        createdBy: currUser.id,
        students: {
          connect: students.map(id => ({ id }))
        },
        teachers: {
          create: finalTeachers
        }
      },
      include: { teachers: { include: { subject: true } } }
    });

    // Create Chatrooms
    for (const ct of classroom.teachers) {
      const chatname = `${name} - ${ct.subject.name}`;
      await prisma.chatRoom.create({
        data: {
          name: chatname,
          classroomID: classroom.id,
          participants: {
            connect: [...students.map(id => ({ id })), { id: ct.teacherID }]
          }
        }
      });
    }

    return res.status(201).send(classroom);
  } catch (err) {
    next(err);
  }
};
exports.getClassrooms = async (req, res, next) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      include: {
        creator: true,
        level: true,
        students: true,
        teachers: {
          include: {
            teacher: true,
            subject: true
          }
        },
        classes: true
      }
    });

    res.status(200).json(classrooms);
  } catch (err) {
    next(err);
  }
};

exports.getClassroomById = async (req, res, next) => {
  try {
    const classroom = await prisma.classroom.findUnique({ where: { id: req.params.id } });
    if (!classroom) return res.status(404).send("Classroom not found");
    return res.status(200).send(classroom);
  } catch (err) {
    next(err);
  }
};
// exports.updateClassroom = async (req, res, next) => {
//   // try {
//   //   const { name, students, teachers } = req.body;
//   //   // update only if current user is admin or if the classroom was created by the current user
//   //   const currUser = req.user;
//   //   const classroom = await Classroom.findById(req.params.id);
//   //   if (
//   //     (currUser.userType != "admin" && classroom.createdBy != currUser._id) ||
//   //     (currUser.userType == "teacher" && teachers)
//   //   ) {
//   //     return res.status(401).send("Unauthorized");
//   //   }

//   //   if (name) {
//   //     // check if same name classroom exists in the same level
//   //     const classroomFound = await Classroom.findOne({
//   //       name: name,
//   //       _id: { $ne: req.params.id },
//   //       levelID: classroom.levelID,
//   //     });
//   //     if (classroomFound) {
//   //       return res.status(400).send("Classroom already exists");
//   //     }
//   //   }

//   //   classroom.name = name;

//   //   const chatrooms = await Chatroom.find({ classroomID: req.params.id });

//   //   // check all chatrooms and delete the ones that are not in the new list of teachers

//   //   chatrooms.forEach(async (chatroom) => {
//   //     // find if chatroom has participants that are not in the new list of teachers
//   //     if (
//   //       chatroom.participants.some(
//   //         (participant) =>
//   //           !teachers.some((teacher) => teacher.teacher == participant)
//   //       )
//   //     ) {
//   //       await Chatroom.findByIdAndDelete(chatroom._id);
//   //     }

//   //     // remove the students that are not in the new list of students
//   //     chatroom.participants = chatroom.participants.filter((participant) =>
//   //       students.includes(participant)
//   //     );
//   //     await chatroom.save();
//   //   });
//   //   await classroom.save();

//   //   return res.status(200).send(classroom);
//   // } catch (err) {
//   //   next(err);
//   // }

//   try {
//     const data = req.body;

//     if (
//       !data.name ||
//       !data.students ||
//       !data.teachers ||
//       data.students.length < 1 ||
//       data.teachers.length < 1
//     ) {
//       return res.status(400).send("All fields are required");
//     }

//     const currUser = req.user;

//     const classroom = await Classroom.findById(req.params.id);

//     //check if same name classroom exists in the same level
//     const classroomFound = await Classroom.findOne({
//       name: data.name,
//       _id: { $ne: req.params.id },
//       levelID: data.levelID,
//     });
//     if (classroomFound) {
//       return res.status(400).send("Classroom already exists");
//     }

//     const teachers = data.teachers;
//     const students = data.students;

//     let subject;
//     let level;

//     //check if user is a teacher
//     if (currUser.userType == "teacher") {
//       if (!data.subject) {
//         return res.status(400).send("Subject is required");
//       }
//       //check if subject exists
//       subject = await Subject.findOne({ _id: data.subject });

//       if (!subject) {
//         return res.status(400).send("Subject does not exist");
//       }

//       data.teachers = [
//         {
//           teacher: currUser._id,
//           subject: data.subject,
//         },
//       ];
//     } else {
//       if (!data.levelID) {
//         return res.status(400).send("Level is required");
//       }

//       // check if level exists
//       level = await Level.findOne({ _id: data.levelID });
//       if (!level) {
//         return res.status(400).send("Level does not exist");
//       }

//       for (let i = 0; i < students.length; i++) {
//         const student = students[i];
//         const classroom = await Classroom.findOne({
//           students: student,
//           _id: { $ne: req.params.id },
//         });
//         if (classroom) {
//           return res
//             .status(400)
//             .send("Student is already in another classroom");
//         }
//       }
//       //check if teacher is already in another classroom

//       for (let i = 0; i < teachers.length; i++) {
//         const teacher = teachers[i].teacher;
//         const classroom = await Classroom.findOne({
//           "teachers.teacher": teacher,
//           _id: { $ne: req.params.id },
//         });
//         if (classroom) {
//           return res
//             .status(400)
//             .send("Teacher is already in another classroom");
//         }
//       }
//     }

//     // create new chatrooms for teachers which were not in previous classroom
//     await teachers.map(async (tea) => {
//       if (
//         !classroom.teachers.find(
//           (teac) => teac.teacher.toString() == tea.teacher.toString()
//         )
//       ) {
//         const chatname = `${data.name} ${currUser.userType == "teacher"
//           ? " - " + subject.name
//           : (await Subject.findOne({ _id: tea.subject })).name
//           }`;

//         await Chatroom.create({
//           participants: [...students, tea.teacher],
//           name: chatname,
//           messages: [],
//           classroomID: classroom._id,
//         });
//       }
//     });

//     // delete chatrooms which has teacher as participants whihc are not in the new list of teachers
//     const chatrooms = await Chatroom.find({ classroomID: req.params.id });

//     chatrooms.forEach(async (chatroom) => {
//       // find if chatroom has participants that are not in the new list of teachers
//       if (
//         chatroom.participants.some(
//           (participant) =>
//             !teachers.some((teacher) => teacher.teacher == participant)
//         )
//       ) {
//         await Chatroom.findByIdAndDelete(chatroom._id);
//       }

//       // remove the students that are not in the new list of students
//       chatroom.participants = chatroom.participants.filter((participant) =>
//         students.includes(participant)
//       );
//       await chatroom.save();
//     });

//     classroom.name = data.name;
//     classroom.levelID = data.levelID;
//     classroom.students = data.students;
//     classroom.teachers = data.teachers;

//     await classroom.save();

//     await teachers.map(async (tea) => {
//       const chatname = `${data.name} ${currUser.userType == "teacher"
//         ? " - " + subject.name
//         : (await Subject.findOne({ _id: tea.subject })).name
//         }`;

//       await Chatroom.create({
//         participants: [...students, tea.teacher],
//         name: chatname,
//         messages: [],
//         classroomID: classroom._id,
//       });
//     });

//     return res.status(201).send(classroom._doc);
//   } catch (err) {
//     next(err);
//   }
// };
exports.deleteClassroom = async (req, res, next) => {
  try {
    const currUser = req.user;
    const classroomID = req.params.id;

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomID } });
    if (!classroom) return res.status(404).send({ message: "Classroom not found" });

    if (currUser.userType !== "admin" && classroom.createdBy !== currUser.id) {
      return res.status(401).send("Unauthorized");
    }

    // Prisma handles related deletions better with transactions or sequential calls
    await prisma.$transaction([
      // 1. Delete AttendanceRecords (Grandchild of Classroom via Attendance)
      prisma.attendanceRecord.deleteMany({
        where: { attendance: { entityId: classroomID, entityType: "classroom" } }
      }),
      // 2. Delete Attendance (Child of Classroom)
      prisma.attendance.deleteMany({ where: { entityId: classroomID, entityType: "classroom" } }),

      // 3. Delete ClassAttendance (Grandchild of Classroom via Class)
      prisma.classAttendance.deleteMany({
        where: { class: { classroomID } }
      }),
      // 4. Delete Classes (Child of Classroom)
      prisma.class.deleteMany({ where: { classroomID } }),

      // 5. Delete ChatRoomMessage (Grandchild of Classroom via ChatRoom)
      prisma.chatRoomMessage.deleteMany({
        where: { chatRoom: { classroomID } }
      }),
      // 6. Delete ChatRooms (Child of Classroom)
      prisma.chatRoom.deleteMany({ where: { classroomID } }),

      // 7. Delete AssignmentSubmissions (Grandchild of Classroom via Assignment)
      prisma.assignmentSubmission.deleteMany({
        where: { assignment: { classroomID } }
      }),
      // 8. Delete Files (Grandchild of Classroom via Assignment or Quiz)
      prisma.file.deleteMany({
        where: { OR: [{ assignment: { classroomID } }, { quiz: { classroomID } }] }
      }),
      // 9. Delete Assignments (Child of Classroom)
      prisma.assignment.deleteMany({ where: { classroomID } }),

      // 10. Delete QuizSubmissions (Grandchild of Classroom via Quiz)
      prisma.quizSubmission.deleteMany({
        where: { quiz: { classroomID } }
      }),
      // 11. Delete Quizzes (Child of Classroom)
      prisma.quiz.deleteMany({ where: { classroomID } }),

      // 12. Delete ClassroomTeachers (Child of Classroom)
      prisma.classroomTeacher.deleteMany({ where: { classroomID } }),

      // 13. Delete PromotedStudent (Grandchild of Classroom via StudentPromote)
      prisma.promotedStudent.deleteMany({
        where: { promotion: { OR: [{ sourceClassroomID: classroomID }, { targetClassroomID: classroomID }] } }
      }),
      // 14. Delete StudentPromote (Child of Classroom)
      prisma.studentPromote.deleteMany({
        where: { OR: [{ sourceClassroomID: classroomID }, { targetClassroomID: classroomID }] }
      }),

      // 15. Delete ArchivedReport Children
      prisma.archivedAttendance.deleteMany({ where: { report: { OR: [{ sourceClassroomID: classroomID }, { targetClassroomID: classroomID }] } } }),
      prisma.archivedAssignment.deleteMany({ where: { report: { OR: [{ sourceClassroomID: classroomID }, { targetClassroomID: classroomID }] } } }),
      prisma.archivedQuiz.deleteMany({ where: { report: { OR: [{ sourceClassroomID: classroomID }, { targetClassroomID: classroomID }] } } }),
      prisma.archivedClass.deleteMany({ where: { report: { OR: [{ sourceClassroomID: classroomID }, { targetClassroomID: classroomID }] } } }),
      // 16. Delete ArchivedReport
      prisma.archivedReport.deleteMany({
        where: { OR: [{ sourceClassroomID: classroomID }, { targetClassroomID: classroomID }] }
      }),

      // 17. Finally, delete the Classroom itself
      prisma.classroom.delete({ where: { id: classroomID } })
    ]);

    return res.status(204).send({ message: "Classroom deleted successfully" });
  } catch (err) {
    next(err);
  }
};

exports.getClassroomsOfTeacher = async (req, res, next) => {
  try {
    const teacherID = req.user.id;

    const classrooms = await prisma.classroom.findMany({
      where: {
        teachers: { some: { teacherID: teacherID } }
      },
      include: {
        creator: { select: { id: true, name: true, email: true, userType: true } },
        classes: true,
        students: { select: { id: true, name: true, email: true, rollNo: true, subjects: true, profilePic: true } },
        level: true,
        teachers: true
      }
    });

    // Formatting to match frontend expectations if necessary
    const formatted = classrooms.map(c => ({
      ...c,
      levelName: c.level?.name || "",
      studentDetails: c.students,
    }));

    return res.status(200).send(formatted);
  } catch (err) {
    next(err);
  }
};




// updateClassroom.js

exports.updateClassroom = async (req, res, next) => {
  try {
    const data = req.body;
    const classroomId = req.params.id;
    const { headTeacher, students, teachers, levelID, name } = data;

    if (!name || !students || !teachers || students.length < 1 || teachers.length < 1) {
      return res.status(400).send("All fields are required");
    }

    const currUser = req.user;
    const existingClassroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!existingClassroom) return res.status(404).send("Classroom not found");

    const classroomFound = await prisma.classroom.findFirst({
      where: { name, levelID, id: { not: classroomId } }
    });
    if (classroomFound) return res.status(400).send("Classroom with same name exists in this level");

    let finalTeachers = teachers;
    if (currUser.userType === "teacher") {
      finalTeachers = [{
        teacherID: currUser.id,
        subjectID: data.subject,
        type: "teacher"
      }];
    } else {
      finalTeachers = teachers.map(t => ({
        teacherID: t.teacher,
        subjectID: t.subject,
        type: t.type || (t.teacher === headTeacher ? "head" : "teacher")
      }));
    }

    const updatedClassroom = await prisma.classroom.update({
      where: { id: classroomId },
      data: {
        name,
        levelID,
        students: {
          set: students.map(id => ({ id }))
        },
        teachers: {
          deleteMany: {},
          create: finalTeachers
        }
      }
    });

    return res.status(200).send(updatedClassroom);
  } catch (err) {
    next(err);
  }
};





exports.getAllClassrooms = async (req, res) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      include: {
        level: true,
        students: true,
        teachers: {
          include: {
            teacher: true,
            subject: true
          }
        },
        creator: true
      }
    });

    const transformed = classrooms.map(c => ({
      id: c.id,
      name: c.name,
      levelID: c.levelID,
      level: c.level,
      students: c.students,
      teachers: c.teachers.map(t => ({
        type: t.type,
        teacher: t.teacher,
        subject: t.subject
      })),
      createdBy: c.creator
    }));

    res.status(200).json({
      success: true,
      message: "Classrooms fetched successfully",
      data: transformed,
      count: transformed.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};





// exports.getStudentAttendanceReport = async (req, res) => {
//   try {
//     const { classroomId, subjectId, startDate, endDate } = req.query;

//     // Validate required fields
//     if (!classroomId || !subjectId || !startDate || !endDate) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: classroomId, subjectId, startDate, endDate"
//       });
//     }

//     // Convert input dates to Date objects
//     const startDateObj = new Date(startDate);
//     const endDateObj = new Date(endDate);
//     endDateObj.setHours(23, 59, 59, 999); // Include entire end day

//     // Find classroom and populate students
//     const classroom = await Classroom.findById(classroomId).populate('students');
//     if (!classroom) {
//       return res.status(404).json({
//         success: false,
//         message: "Classroom not found"
//       });
//     }

//     // Find all classes in the range with the given subject
//     const classes = await Class.find({
//       classroomID: classroomId,
//       subjectID: subjectId,
//       startEventDate: { $gte: startDateObj, $lte: endDateObj }
//     }).populate('subjectID', 'name');

//     if (!classes.length) {
//       return res.status(200).json({
//         success: true,
//         message: "No classes found in the selected date range.",
//         data: []
//       });
//     }

//     const responseData = [];

//     // Process each class separately
//     for (const classItem of classes) {
//       const rawDate = new Date(classItem.startEventDate);
//       const dateKey = rawDate.toISOString().split('T')[0]; // "YYYY-MM-DD"

//       // Log class date for debug purposes
//       console.log(`[${classItem.title}] Class Date: ${dateKey}`);

//       // Only process students who have attendance records for this specific class
//       if (classItem.attendance && classItem.attendance.length > 0) {
//         for (const attendanceRecord of classItem.attendance) {
//           // Find student details
//           const student = classroom.students.find(
//             s => s._id.toString() === attendanceRecord.studentID.toString()
//           );

//           if (student) {
//             let status = 'absent';

//             // Determine status based on attendance record
//             if (attendanceRecord.isPresent) {
//               status = attendanceRecord.late ? 'present-late' : 'present';
//             } else {
//               status = 'absent';
//             }

//             responseData.push({
//               studentId: student._id,
//               studentName: student.name,
//               rollNo: student.rollNo || 'N/A',
//               classroomName: classroom.name,
//               subjectId: classItem.subjectID._id,
//               subjectName: classItem.subjectID.name,
//               date: dateKey,
//               status,
//               classId: classItem._id,
//               classTitle: classItem.title
//             });
//           }
//         }
//       }
//     }

//     // Sort by date, then by class title, then by student name
//     responseData.sort((a, b) => {
//       if (a.date === b.date) {
//         if (a.classTitle === b.classTitle) {
//           return a.studentName.localeCompare(b.studentName);
//         }
//         return a.classTitle.localeCompare(b.classTitle);
//       }
//       return new Date(a.date) - new Date(b.date);
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Student attendance report generated successfully",
//       data: responseData,
//       summary: {
//         totalRecords: responseData.length,
//         totalClasses: classes.length,
//         totalStudents: classroom.students.length,
//         dateRange: {
//           from: startDate,
//           to: endDate
//         }
//       }
//     });

//   } catch (error) {
//     console.error("Error generating attendance report:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error while generating attendance report",
//       error: error.message
//     });
//   }
// };



exports.getStudentAttendanceReport = async (req, res) => {
  try {
    const { classroomId, subjectId, startDate, endDate } = req.query;

    // Validate required fields
    if (!classroomId || !subjectId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: classroomId, subjectId, startDate, endDate"
      });
    }

    // Convert input dates to Date objects
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999); // Include entire end day

    // Find classroom and include students
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { students: true }
    });
    
    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: "Classroom not found"
      });
    }

    // Find all classes in the range with the given subject
    const classes = await prisma.class.findMany({
      where: {
        classroomID: classroomId,
        subjectID: subjectId,
        startTime: { gte: startDateObj, lte: endDateObj }
      },
      include: { 
        subject: true,
        attendance: true
      }
    });

    if (!classes.length) {
      return res.status(200).json({
        success: true,
        message: "No classes found in the selected date range.",
        data: []
      });
    }

    const responseData = [];

    // Process each class separately
    for (const classItem of classes) {
      const rawDate = new Date(classItem.startTime);
      const dateKey = rawDate.toISOString().split('T')[0]; // "YYYY-MM-DD"

      // Filter students who are enrolled in this subject (based on student.subjects array)
      const enrolledStudents = classroom.students.filter(student =>
        student.subjects && student.subjects.includes(subjectId)
      );

      // Process only enrolled students
      for (const student of enrolledStudents) {
        let status = 'absent'; // Default status

        // Check if student has attendance record for this class
        if (classItem.attendance && classItem.attendance.length > 0) {
          const attendanceRecord = classItem.attendance.find(
            att => att.studentID === student.id
          );

          if (attendanceRecord) {
            // Determine status based on attendance record
            if (attendanceRecord.isPresent) {
              status = attendanceRecord.late ? 'present-late' : 'present';
            } else {
              status = 'absent';
            }
          }
        }

        responseData.push({
          studentId: student.id,
          studentName: student.name,
          rollNo: student.rollNo || 'N/A',
          classroomName: classroom.name,
          subjectId: classItem.subjectID,
          subjectName: classItem.subject?.name || 'Subject',
          date: dateKey,
          status,
          classId: classItem.id,
          classTitle: classItem.title
        });
      }
    }

    // Sort by date, then by class title, then by student name
    responseData.sort((a, b) => {
      if (a.date === b.date) {
        if (a.classTitle === b.classTitle) {
          return a.studentName.localeCompare(b.studentName);
        }
        return a.classTitle.localeCompare(b.classTitle);
      }
      return new Date(a.date) - new Date(b.date);
    });

    return res.status(200).json({
      success: true,
      message: "Student attendance report generated successfully",
      data: responseData,
      summary: {
        totalRecords: responseData.length,
        totalClasses: classes.length,
        totalStudents: classroom.students.length,
        enrolledStudents: responseData.length > 0 ?
          [...new Set(responseData.map(record => record.studentId))].length : 0,
        dateRange: {
          from: startDate,
          to: endDate
        }
      }
    });

  } catch (error) {
    console.error("Error generating attendance report:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while generating attendance report",
      error: error.message
    });
  }
};
