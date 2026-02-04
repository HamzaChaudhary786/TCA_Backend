const Classroom = require("../models/classroom");
const Subject = require("../models/subject");
const Class = require("../models/class");
const Chatroom = require("../models/chatroom");
const Level = require("../models/level");
const classroomRepository = require("../repositories/classroomRepository");
const levelRepository = require("../repositories/levelRepository");
const subjectRepository = require("../repositories/subjectRepository");
const Attendance = require("../models/attendence");

exports.createClassroom = async (req, res, next) => {
  try {
    const data = req.body;

    const { headTeacher } = data;


    if (
      !data.name ||
      !data.students ||
      !data.teachers ||
      data.students.length < 1 ||
      data.teachers.length < 1
    ) {
      return res.status(400).send("All fields are required");
    }

    const currUser = req.user;

    //check if same name classroom exists in the same level
    const classroomFound = await Classroom.findOne({
      name: data.name,
      levelID: data.levelID,
    });
    if (classroomFound) {
      return res.status(400).send("Classroom already exists");
    }

    const teachers = data.teachers;
    const students = data.students;

    let subject;
    let level;

    //check if user is a teacher
    if (currUser.userType == "teacher") {
      if (!data.subject) {
        return res.status(400).send("Subject is required");
      }
      //check if subject exists
      subject = await Subject.findOne({ _id: data.subject });

      if (!subject) {
        return res.status(400).send("Subject does not exist");
      }

      data.teachers = [
        {
          teacher: currUser._id,
          subject: data.subject,
        },
      ];
    } else {
      if (!data.levelID) {
        return res.status(400).send("Level is required");
      }

      // check if level exists
      level = await Level.findOne({ _id: data.levelID });
      if (!level) {
        return res.status(400).send("Level does not exist");
      }

      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const classroom = await Classroom.findOne({ students: student });
        // if (classroom) {
        //   return res
        //     .status(400)
        //     .send("Student is already in another classroom");
        // }
      }
      //check if teacher is already in another classroom

      for (let i = 0; i < teachers.length; i++) {
        const teacher = teachers[i].teacher;
        if (!teachers[i].subject) {
          console.log("here in array loop")
          return res.status(400).send("Subject is required");
        }
        const classroom = await Classroom.findOne({
          "teachers.teacher": teacher,
        });
        // if (classroom) {
        //   return res
        //     .status(400)
        //     .send("Teacher is already in another classroom");
        // }
      }
    }

    if (headTeacher) {
      data.teachers = data.teachers.map((teacher) => ({
        ...teacher,
        type: teacher.teacher === headTeacher ? "head" : "teacher",
      }));
    }

    const classroom = new Classroom({ ...data, createdBy: currUser._id });

    await classroom.save();

    await teachers.map(async (tea) => {
      const chatname = `${data.name} ${currUser.userType == "teacher"
        ? " - " + subject.name
        : (await Subject.findOne({ _id: tea.subject })).name
        }`;

      await Chatroom.create({
        participants: [...students, tea.teacher],
        name: chatname,
        messages: [],
        classroomID: classroom._id,
      });
    });

    return res.status(201).send(classroom._doc);
  } catch (err) {
    next(err);
  }
};
exports.getClassrooms = async (req, res, next) => {
  try {
    const classroomsWithClasses = await Classroom.aggregate([
      // Lookup to populate createdBy details
      {
        $lookup: {
          from: "users", // Name of the users collection
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ["$createdBy", 0] }, // Extract single createdBy object
        },
      },
      // Lookup to populate level details
      {
        $lookup: {
          from: "levels", // Name of the levels collection
          localField: "levelID",
          foreignField: "_id",
          as: "level",
        },
      },
      {
        $addFields: {
          level: { $arrayElemAt: ["$level", 0] }, // Extract single level object
        },
      },
      // Lookup to populate student details
      {
        $lookup: {
          from: "users", // Name of the users collection
          localField: "students",
          foreignField: "_id",
          as: "students",
        },
      },
      // Lookup to populate teacher details
      {
        $lookup: {
          from: "users", // Name of the users collection
          localField: "teachers.teacher",
          foreignField: "_id",
          as: "teacherDetails",
        },
      },
      {
        $lookup: {
          from: "classes", // Assuming the name of the classes collection is "classes"
          localField: "_id",
          foreignField: "classroomID",
          as: "classes",
        },
      },
      {
        $lookup: {
          from: "subjects", // Name of the subjects collection
          localField: "teachers.subject",
          foreignField: "_id",
          as: "subjectDetails",
        },
      },
      // Format teachers array with populated fields
      {
        $addFields: {
          teachers: {
            $map: {
              input: "$teachers",
              as: "teacher",
              in: {
                type: "$$teacher.type",
                teacher: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$teacherDetails",
                        as: "teacherDetail",
                        cond: { $eq: ["$$teacherDetail._id", "$$teacher.teacher"] },
                      },
                    },
                    0,
                  ],
                },
                subject: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$subjectDetails",
                        as: "subjectDetail",
                        cond: { $eq: ["$$subjectDetail._id", "$$teacher.subject"] },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      // Cleanup fields (optional: remove unnecessary arrays)
      {
        $project: {
          teacherDetails: 0,
          subjectDetails: 0,
        },
      },
    ]);

    res.status(200).json(classroomsWithClasses);
  } catch (err) {
    next(err);
  }
};

exports.getClassroomById = async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

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

    // Fetch the classroom
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).send({ message: "Classroom not found" });
    }

    // Convert ObjectId to string for proper comparison
    const createdBy = String(classroom.createdBy);
    const currUserId = String(currUser._id);

    // Authorization check
    if (currUser.userType !== "admin" && createdBy !== currUserId) {
      return res.status(401).send("Unauthorized");
    }

    // If an admin created the classroom, only admin can delete it
    if (createdBy !== currUserId && currUser.userType !== "admin") {
      return res.status(401).send("Unauthorized");
    }

    // Delete all classes in the classroom
    await Class.deleteMany({ classroomID: req.params.id });

    // Delete the classroom
    await Classroom.findByIdAndDelete(req.params.id);

    // Delete the chatroom
    await Chatroom.deleteMany({ classroomID: req.params.id });

    return res.status(204).send({ message: "Classroom deleted successfully" });
  } catch (err) {
    next(err);
  }
};

exports.getClassroomsOfTeacher = async (req, res, next) => {
  try {
    const teacherID = req.user._id;

    const classroomsWithClasses = await Classroom.aggregate([
      {
        $lookup: {
          from: "users", // Collection where user data (teachers and students) is stored
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $addFields: {
          createdBy: {
            $cond: {
              if: { $isArray: "$createdBy" },
              then: {
                $mergeObjects: [
                  { $arrayElemAt: ["$createdBy", 0] },
                  { password: undefined }, // Exclude the password field
                ],
              },
              else: null,
            },
          },
        },
      },
      {
        $match: {
          "teachers.teacher": teacherID,
        },
      },
      {
        $lookup: {
          from: "classes", // Assuming the name of the classes collection is "classes"
          localField: "_id",
          foreignField: "classroomID",
          as: "classes",
        },
      },
      {
        $lookup: {
          from: "users", // Assuming students' details are in the "users" collection
          localField: "students",
          foreignField: "_id",
          as: "studentDetails", // Populate student details here
        },
      },
      {
        $lookup: {
          from: "levels", // Reference the levels collection
          localField: "levelID", // Match classroom's levelID with levels collection
          foreignField: "_id", // Match with levels' _id
          as: "levelDetails", // Populate level details
        },
      },
      {
        $addFields: {
          levelName: {
            $cond: {
              if: { $gt: [{ $size: "$levelDetails" }, 0] }, // Check if levelDetails array is not empty
              then: { $arrayElemAt: ["$levelDetails.name", 0] }, // Extract the level name
              else: "", // Set an empty string if no levelID
            },
          },
        },
      },
      {
        $project: {
          "createdBy.password": 0, // Exclude sensitive fields
          "studentDetails.password": 0,
          levelDetails: 0, // Exclude levelDetails array as we already have levelName
        },
      },
    ]);

    return res.status(200).send(classroomsWithClasses);
  } catch (err) {
    next(err);
  }
};




// updateClassroom.js

exports.updateClassroom = async (req, res, next) => {
  try {
    const data = req.body;
    const classroomId = req.params.id;

    if (!data.name || !data.students || !data.teachers || data.students.length < 1 || data.teachers.length < 1) {
      return res.status(400).send("All fields are required");
    }

    const currUser = req.user;
    const existingClassroom = await classroomRepository.findClassroomById(classroomId);

    if (!existingClassroom) {
      return res.status(404).send("Classroom not found");
    }

    const classroomFound = await classroomRepository.findClassroomByNameAndLevel(data.name, data.levelID);
    if (classroomFound && classroomFound._id.toString() !== classroomId) {
      return res.status(400).send("Classroom with the same name already exists in the same level");
    }

    let subject;
    let level;

    if (currUser.userType === "teacher") {
      if (!data.subject) {
        return res.status(400).send("Subject is required");
      }
      subject = await subjectRepository.findSubjectById(data.subject);
      if (!subject) {
        return res.status(400).send("Subject does not exist");
      }

      data.teachers = [
        {
          teacher: currUser._id,
          subject: data.subject,
        },
      ];
    } else {
      if (!data.levelID) {
        return res.status(400).send("Level is required");
      }
      level = await levelRepository.findLevelById(data.levelID);
      if (!level) {
        return res.status(400).send("Level does not exist");
      }

      const studentIds = data?.students?.map(student => student._id); // Assuming `student` has an `_id` property
      const studentClassrooms = await classroomRepository.findClassroomsByStudentIds(studentIds);

      for (const student of data.students) {
        const studentClassroom = studentClassrooms?.find(classroom => classroom.studentId.toString() === student._id.toString());
        if (studentClassroom && studentClassroom._id.toString() !== classroomId) {
          return res.status(400).send("Student is already in another classroom");
        }
      }

      // for (const teacher of data.teachers) {
      //   const teacherClassroom = await classroomRepository.findTeacherClassroom(teacher.teacher);
      //   if (teacherClassroom && teacherClassroom._id.toString() !== classroomId) {
      //     return res.status(400).send("Teacher is already in another classroom");
      //   }

      //   if (!teacher.subject) {
      //     return res.status(400).send("Subject is required for each teacher");
      //   }
      // }
    }

    if (data.headTeacher) {
      data.teachers = data.teachers.map(teacher => ({
        ...teacher,
        type: teacher.teacher === data.headTeacher ? "head" : "teacher",
      }));
    }

    const updatedClassroom = await classroomRepository.updateClassroomById(classroomId, data);

    return res.status(200).send(updatedClassroom);
  } catch (err) {
    next(err);
  }
};





exports.getAllClassrooms = async (req, res) => {
  try {
    const classrooms = await Classroom.find()
      .populate({
        path: "levelID",
        select: "name", // Only get the name field from Level
      })
      .populate({
        path: "students",
        select: "name rollNo email gender phoneNumber subjects", // Select specific student fields
      })
      .populate({
        path: "teachers.teacher",
        select: "name email phoneNumber", // Select specific teacher fields
      })
      .populate({
        path: "teachers.subject",
        select: "name levelID", // Select specific subject fields
      })
      .populate({
        path: "createdBy",
        select: "name email userType", // Select specific admin/creator fields
      })
      .lean(); // Use lean() for better performance since we're only reading

    // Transform the data to match your frontend structure
    const transformedClassrooms = classrooms.map(classroom => ({
      _id: classroom._id,
      name: classroom.name,
      levelID: classroom.levelID?._id,
      level: classroom.levelID ? {
        _id: classroom.levelID._id,
        name: classroom.levelID.name
      } : null,
      students: classroom.students.map(student => ({
        _id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        email: student.email,
        gender: student.gender,
        phoneNumber: student.phoneNumber,
        subjectIDs: student.subjects || []
      })),
      teachers: classroom.teachers.map(teacherObj => ({
        type: teacherObj.type,
        teacher: {
          _id: teacherObj.teacher._id,
          name: teacherObj.teacher.name,
          email: teacherObj.teacher.email,
          phoneNumber: teacherObj.teacher.phoneNumber
        },
        subject: teacherObj.subject ? {
          _id: teacherObj.subject._id,
          name: teacherObj.subject.name,
          levelID: teacherObj.subject.levelID
        } : null
      })),
      createdBy: classroom.createdBy ? {
        _id: classroom.createdBy._id,
        name: classroom.createdBy.name,
        email: classroom.createdBy.email,
        userType: classroom.createdBy.userType
      } : null
    }));

    res.status(200).json({
      success: true,
      message: "Classrooms fetched successfully",
      data: transformedClassrooms,
      count: transformedClassrooms.length
    });

  } catch (error) {
    console.error("Error fetching classrooms:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch classrooms",
      error: error.message
    });
  }
}





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

    // Find classroom and populate students
    const classroom = await Classroom.findById(classroomId).populate('students');
    if (!classroom) {
      return res.status(404).json({
        success: false,
        message: "Classroom not found"
      });
    }

    // Find all classes in the range with the given subject
    const classes = await Class.find({
      classroomID: classroomId,
      subjectID: subjectId,
      startEventDate: { $gte: startDateObj, $lte: endDateObj }
    }).populate('subjectID', 'name');

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

      // Log class date for debug purposes
      console.log(`[${classItem.title}] Class Date: ${dateKey}`);

      // Filter students who are enrolled in this subject
      const enrolledStudents = classroom.students.filter(student =>
        student.subjects && student.subjects.includes(subjectId)
      );

      console.log(`Class: ${classItem.title}, Total students in classroom: ${classroom.students.length}, Enrolled in subject: ${enrolledStudents.length}`);

      // Process only enrolled students
      for (const student of enrolledStudents) {
        let status = 'absent'; // Default status

        // Check if student has attendance record for this class
        if (classItem.attendance && classItem.attendance.length > 0) {
          const attendanceRecord = classItem.attendance.find(
            att => att.studentID.toString() === student._id.toString()
          );

          if (attendanceRecord) {
            // Determine status based on attendance record
            if (attendanceRecord.isPresent) {
              status = attendanceRecord.late ? 'present-late' : 'present';
            } else {
              status = 'absent';
            }
          }
          // If no attendance record found, status remains 'absent'
        }

        responseData.push({
          studentId: student._id,
          studentName: student.name,
          rollNo: student.rollNo || 'N/A',
          classroomName: classroom.name,
          subjectId: classItem.subjectID._id,
          subjectName: classItem.subjectID.name,
          date: dateKey,
          status,
          classId: classItem._id,
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
