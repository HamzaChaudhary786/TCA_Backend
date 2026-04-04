const prisma = require("../db/prisma");
const moment = require('moment-timezone');
const { createSpace, authorize, getMeetingParticipents } = require("../test-meet");
const userRepository = require("../repositories/userRepository");
const {
  convertToPKT,
  convertToPKTAndSubtractHours,
  convertDateStringToPKT,
  createDateTimeInPKT,
  isWeekend
} = require("../utils/timeUtils");


// exports.createClass = async (req, res) => {
//   try {
//     const {
//       title,
//       startTime,
//       endTime,
//       startEventDate,
//       endEventDate,
//       classroomID,
//       subjectID,
//       teacher,
//       selectedDays,
//       meetingUrl,
//       oneTime // Make sure to extract `oneTime` from the request body
//     } = req.body;

//     // Validate classroom
//     const classroom = await Classroom.findById(classroomID);
//     if (!classroom) {
//       return res.status(400).json({ error: 'Classroom does not exist' });
//     }

//     // Validate subject
//     const subject = await Subject.findById(subjectID);
//     if (!subject) {
//       return res.status(400).json({ error: 'Subject does not exist' });
//     }

//     // Validate event dates
//     const startDate = moment.tz(startEventDate, 'Asia/Karachi');
//     const endDate = moment.tz(endEventDate, 'Asia/Karachi');

//     if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
//       return res.status(400).json({ error: 'Invalid start or end event dates' });
//     }

//     // Validate selected days
//     if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
//       return res.status(400).json({ error: 'Please select at least one day.' });
//     }

//     const dayMap = {
//       Sunday: 0,
//       Monday: 1,
//       Tuesday: 2,
//       Wednesday: 3,
//       Thursday: 4,
//       Friday: 5,
//       Saturday: 6,
//     };

//     const selectedDayNumbers = selectedDays.map(day => dayMap[day]);
//     const events = [];
//     let currentDate = startDate.clone();
//     const isMultiDay = !moment(startDate).isSame(endDate, 'day');

//     // Loop through dates to create events on selected days
//     while (currentDate.isSameOrBefore(endDate)) {
//       if (selectedDayNumbers.includes(currentDate.day())) {
//         const dayStart = moment.tz(`${currentDate.format('YYYY-MM-DD')}T${startTime.split('T')[1]}`, 'Asia/Karachi').subtract(5, 'hours');
//         const dayEnd = moment.tz(`${currentDate.format('YYYY-MM-DD')}T${endTime.split('T')[1]}`, 'Asia/Karachi').subtract(5, 'hours');



//         // Validate that start and end times are valid
//         if (!dayStart.isValid() || !dayEnd.isValid()) {
//           return res.status(400).json({
//             error: `Invalid start or end time for ${currentDate.format('YYYY-MM-DD')}`,
//             details: { startTime, endTime, dayStart, dayEnd }
//           });
//         }

//         // Ensure end time is after start time
//         if (dayEnd.isBefore(dayStart)) {
//           return res.status(400).json({ error: 'End time cannot be before start time' });
//         }

//         console.log("startTime:", dayEnd.toDate(), "endTime:", dayStart.toDate());


//         // Check for teacher conflict
//         const teacherConflict = await Class.findOne({
//           'teacher.teacherID': teacher.teacherID,
//           startTime: { $lt: dayEnd.toDate() },
//           endTime: { $gt: dayStart.toDate() },
//         });

//         if (teacherConflict) {
//           return res.status(400).json({
//             error: `Teacher has a conflict on ${currentDate.format('YYYY-MM-DD')}`,
//           });
//         }

//         // Create event with all required fields
//         events.push({
//           title,
//           startTime: dayStart.toDate(),
//           endTime: dayEnd.toDate(),
//           classroomID,
//           subjectID,
//           teacher,
//           meetingUrl,
//           createdBy: req.user._id,
//           startEventDate, // Add startEventDate
//           endEventDate,   // Add endEventDate
//           oneTime,        // Add oneTime
//           groupID
//         });
//       }
//       currentDate.add(1, 'day');
//     }

//     if (events.length === 0) {
//       return res.status(400).json({
//         error: 'No valid classes were scheduled. Please check your selected days.',
//       });
//     }

//     // Bulk insert events into the database
//     await Class.insertMany(events);
//     res.status(201).json({ message: 'Classes created successfully', events });
//   } catch (err) {
//     console.error('Error creating class:', err);
//     res.status(500).json({ error: 'An error occurred while creating the class' });
//   }
// };



exports.createClass = async (req, res) => {
  try {
    const {
      title,
      startTime,
      endTime,
      startEventDate,
      endEventDate,
      classroomID,
      subjectID,
      teacher,
      selectedDays,
      meetingUrl,
      oneTime
    } = req.body;

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomID } });
    if (!classroom) return res.status(400).json({ error: 'Classroom does not exist' });

    const subject = await prisma.subject.findUnique({ where: { id: subjectID } });
    if (!subject) return res.status(400).json({ error: 'Subject does not exist' });

    const startDate = convertDateStringToPKT(startEventDate);
    const endDate = convertDateStringToPKT(endEventDate);

    if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
      return res.status(400).json({ error: 'Invalid start or end event dates' });
    }

    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      return res.status(400).json({ error: 'Please select at least one day.' });
    }

    const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const selectedDayNumbers = selectedDays.map(day => dayMap[day]);
    const events = [];
    const groupID = !moment(startDate).isSame(endDate, 'day') ? crypto.randomUUID() : null;

    let currentDate = startDate.clone();

    while (currentDate.isSameOrBefore(endDate)) {
      if (selectedDayNumbers.includes(currentDate.day())) {
        const dayStart = convertToPKTAndSubtractHours(currentDate, startTime, 5);
        const dayEnd = convertToPKTAndSubtractHours(currentDate, endTime, 5);

        if (!dayStart.isValid() || !dayEnd.isValid()) {
          return res.status(400).json({ error: `Invalid time for ${currentDate.format('YYYY-MM-DD')}` });
        }

        if (dayEnd.isBefore(dayStart)) {
          return res.status(400).json({ error: 'End time cannot be before start time' });
        }

        // Conflict checks
        const conflict = await prisma.class.findFirst({
          where: {
            OR: [
              { teacherID: teacher.teacherID },
              { classroomID: classroomID }
            ],
            startTime: { lt: dayEnd.toDate() },
            endTime: { gt: dayStart.toDate() },
          }
        });

        if (conflict) {
          const conflictType = conflict.teacherID === teacher.teacherID ? 'Teacher' : 'Classroom';
          return res.status(400).json({ error: `${conflictType} has a scheduling conflict on ${currentDate.format('YYYY-MM-DD')}` });
        }

        events.push({
          title,
          startTime: dayStart.toDate(),
          endTime: dayEnd.toDate(),
          classroomID,
          subjectID,
          teacherID: teacher.teacherID,
          teacherStatus: teacher.status || 'absent',
          meetingUrl: meetingUrl || "",
          createdBy: req.user.id,
          startEventDate: new Date(startEventDate),
          endEventDate: new Date(endEventDate),
          oneTime: oneTime ?? false,
          groupID
        });
      }
      currentDate.add(1, 'day');
    }

    if (events.length === 0) return res.status(400).json({ error: 'No valid class instances found' });

    await prisma.class.createMany({ data: events });
    res.status(201).json({ message: 'Classes created successfully', events });
  } catch (err) {
    next(err);
  }
};


exports.updateClass = async (req, res, next) => {
  try {
    const { classID, title, meetingUrl, teacher, subjectID, startTime, endTime, updateSeries } = req.body;

    const existingClass = await prisma.class.findUnique({ where: { id: classID } });
    if (!existingClass) return res.status(404).json({ error: "Class not found" });

    const start = convertToPKTAndSubtractHours(startTime, undefined, 5);
    const end = convertToPKTAndSubtractHours(endTime, undefined, 5);

    const updateData = {
      title: title || existingClass.title,
      meetingUrl: meetingUrl ?? existingClass.meetingUrl,
      teacherID: teacher?.teacherID || existingClass.teacherID,
      teacherStatus: teacher?.status || existingClass.teacherStatus,
      subjectID: subjectID || existingClass.subjectID,
      startTime: start.toDate(),
      endTime: end.toDate(),
    };

    if (existingClass.groupID && updateSeries) {
      const classes = await prisma.class.findMany({ where: { groupID: existingClass.groupID } });
      const updatePromises = classes.map(cls => {
         const clsStart = moment(cls.startTime);
         const clsEnd = moment(cls.endTime);
         const newStart = moment(start).set({ year: clsStart.year(), month: clsStart.month(), date: clsStart.date() });
         const newEnd = moment(end).set({ year: clsEnd.year(), month: clsEnd.month(), date: clsEnd.date() });
         
         return prisma.class.update({
           where: { id: cls.id },
           data: { ...updateData, startTime: newStart.toDate(), endTime: newEnd.toDate() }
         });
      });
      await Promise.all(updatePromises);
      return res.status(200).json({ message: "Series updated successfully" });
    } else {
      const updated = await prisma.class.update({
        where: { id: classID },
        data: updateData
      });
      return res.status(200).json({ data: updated, message: "Class updated successfully" });
    }
  } catch (err) {
    next(err);
  }
};


exports.rescheduleClass = async (req, res, next) => {
  try {
    const data = req.body;
    const classId = req.params.id;
    const classss = await prisma.class.findUnique({
      where: { id: classId },
      include: { classroom: { include: { students: true } } }
    });

    if (!classss) return res.status(404).send("Class does not exist");

    const teacherId = classss.teacherID;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (startTime < new Date()) return res.status(400).send("Class start time has passed");
    if (isWeekend(startTime)) return res.status(400).send("Class cannot hold on weekend");

    // Fetch candidate classes for conflict checking
    const candidates = await prisma.class.findMany({
      where: {
        id: { not: classId },
        OR: [
          { teacherID: teacherId },
          { classroomID: classss.classroomID }
        ]
      }
    });

    const hasConflict = candidates.some(c => {
      if (!c.oneTime) {
         // Recurring class conflict check (same day of week and overlapping time)
         if (moment(c.startTime).day() !== moment(startTime).day()) return false;
         const cStart = moment(c.startTime).format('HH:mm');
         const cEnd = moment(c.endTime).format('HH:mm');
         const sStart = moment(startTime).format('HH:mm');
         const sEnd = moment(endTime).format('HH:mm');
         return sStart < cEnd && sEnd > cStart;
      } else {
         // One-time class conflict check
         return startTime < c.endTime && endTime > c.startTime;
      }
    });

    if (hasConflict) return res.status(400).send("Conflict detected with teacher or classroom schedule");

    const updated = await prisma.class.update({
      where: { id: classId },
      data: { startTime, endTime }
    });

    return res.status(200).send(updated);
  } catch (err) {
    next(err);
  }
};

exports.cancelClass = async (req, res, next) => {
  try {
    const classs = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!classs) return res.status(404).send("Class does not exist");
    if (classs.startTime < new Date()) return res.status(400).send("Class start time has passed");

    await prisma.class.delete({ where: { id: req.params.id } });
    return res.status(200).send(classs);
  } catch (err) {
    next(err);
  }
};

exports.markTeacherPresent = async (req, res, next) => {
  try {
    const classs = await prisma.class.update({
      where: { id: req.params.id },
      data: { teacherStatus: "present" }
    });
    return res.status(200).send(classs);
  } catch (err) {
    next(err);
  }
};

exports.getClasses = async (req, res, next) => {
  try {
    const { startDate, endDate, teacherID } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0); // Start from beginning of day
    const end = endDate ? new Date(endDate) : moment(start).add(7, 'days').toDate();
    end.setHours(23, 59, 59, 999); // Include full end day

    const user = req.user;
    let where = {
      startTime: { gte: start },
      endTime: { lte: end }
    };

    if (teacherID) {
      where.teacherID = teacherID;
    } else if (user.userType === "teacher") {
      where.teacherID = user.id;
    } else if (user.userType === "student") {
      where.classroom = { students: { some: { id: user.id } } };
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        classroom: { include: { students: true } },
        subject: true,
        teacher: true
      }
    });

    return res.status(200).send(classes);
  } catch (err) {
    next(err);
  }
};




// exports.getClasses = async (req, res, next) => {
//   try {
//     const { startDate, endDate } = req.query;

//     // set end date to 1 week from start date
//     // let endDate = new Date(startDate);
//     // endDate.setDate(endDate.getDate() + 7);
//     // endDate = endDate.toISOString();
//     console.log(startDate, endDate);
//     console.log(new Date(startDate), new Date(endDate));

//     const date = moment(startDate, moment.ISO_8601, true);

//     console.log(date.isValid());

//     const userRole = req.user.userType;
//     const userId = req.user._id;

//     const pipeline = [
//       {
//         $lookup: {
//           from: "classrooms",
//           localField: "classroomID",
//           foreignField: "_id",
//           as: "classroom",
//         },
//       },
//       {
//         $unwind: "$classroom",
//       },
//       {
//         $lookup: {
//           from: "subjects",
//           localField: "subjectID",
//           foreignField: "_id",
//           as: "subjectID",
//         },
//       },
//       {
//         $unwind: "$subjectID",
//       },
//       {
//         $lookup: {
//           from: "users", // assuming "users" is the collection name for teachers
//           localField: "teacher.teacherID",
//           foreignField: "_id",
//           as: "teacher.teacherID",
//         },
//       },
//       {
//         $unwind: "$teacher.teacherID",
//       },
//       {
//         $match: {
//           $expr: {
//             $and: [
//               {
//                 $gte: [
//                   { $toDate: "$startTime" },
//                   { $toDate: new Date(startDate).toDateString() },
//                 ],
//               },
//               {
//                 $lte: [
//                   { $toDate: "$endTime" },
//                   { $toDate: new Date(endDate).toDateString() },
//                 ],
//               },
//             ],
//           },
//         },
//       },
//     ];

//     // // Match based on user role
//     if (userRole === "admin") {
//       // If user is admin, return all classes within the date range
//       pipeline.push({
//         $match: {
//           "classroom.students": { $exists: true },
//         },
//       });
//     } else if (userRole === "teacher") {
//       // If user is a teacher, return only classes of the teacher within the date range
//       pipeline.push({
//         $match: {
//           "teacher.teacherID._id": userID,
//         },
//       });
//     } else if (userRole === "student") {
//       // If user is a student, return only classes of the student within the date range
//       pipeline.push({
//         $match: {
//           "classroom.students": userID,
//         },
//       });
//     }

//     // Add any additional pipeline stages as needed

//     // Execute the pipeline
//     const result = await Class.aggregate(pipeline);

//     return res.status(200).send(result);
//   } catch (err) {
//     next(err);
//   }
// };

exports.getTodayClasses = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(new Date(startDate).toDateString());
    const end = new Date(new Date(endDate).toDateString());
    end.setHours(23, 59, 59, 999);

    const user = req.user;
    let where = {
      startTime: { gte: start },
      endTime: { lte: end }
    };

    if (user.userType === "teacher") {
      where.teacherID = user.id;
    } else if (user.userType === "student") {
      where.classroom = { students: { some: { id: user.id } } };
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        classroom: { include: { students: true } },
        subject: true,
        teacher: true
      }
    });

    return res.status(200).send(classes);
  } catch (err) {
    next(err);
  }
};



exports.submitAttendence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, classroomID, startTime } = req.body;

    const studentClass = await prisma.class.findUnique({
      where: { id },
      include: { subject: true }
    });

    if (!studentClass) return res.status(404).json({ message: "Class not found" });

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomID } });
    if (!classroom) return res.status(404).json({ message: "Classroom not found" });

    const todayStart = new Date(new Date(startTime).setHours(0,0,0,0));
    const todayEnd = new Date(new Date(startTime).setHours(23,59,59,999));

    const headAttendance = await prisma.attendance.findFirst({
      where: {
        entityId: classroomID,
        date: { gte: todayStart, lte: todayEnd }
      },
      include: { students: true }
    });

    if (!headAttendance) return res.status(400).json({ message: "No head attendance record found for today" });

    // discrepancy checks
    const absentStudentIDs = data.filter(s => !s.isPresent).map(s => s.studentID);
    const headPresentStudentIDs = headAttendance.students.filter(s => s.isPresent).map(s => s.studentID);
    const discrepancyIDs = absentStudentIDs.filter(id => headPresentStudentIDs.includes(id));

    if (discrepancyIDs.length > 0) {
       const students = await prisma.user.findMany({ where: { id: { in: discrepancyIDs } } });
       const admins = await prisma.user.findFirst({ where: { userType: 'admin' } });
       
       const notifications = students.map(s => {
          const guardianID = s.guardianId;
          const deliveredTo = [admins?.id, guardianID].filter(Boolean);
          return {
             userID: s.id,
             message: `Student ${s.name} (Roll: ${s.rollNo}) marked absent in "${studentClass.title}" but was present in head attendance.`,
             url: `/students/${s.id}`,
             deliveredTo: { connect: deliveredTo.map(id => ({ id })) }
          };
       });
       
       for (const n of notifications) {
          await prisma.notification.create({ data: n });
       }
    }

    await prisma.class.update({
      where: { id },
      data: { attendance: { deleteMany: {}, create: data.map(s => ({ studentID: s.studentID?.id || s.studentID, isPresent: s.isPresent, late: s.late || false })) } }
    });

    return res.status(200).json({ message: "Class attendance updated successfully!" });
  } catch (error) {
    next(error);
  }
};

exports.cancelAttendence = async (req, res, next) => {
  try {
    const updatedClass = await prisma.class.update({
      where: { id: req.params.id },
      data: { attendance: [] }
    });
    return res.status(200).json({ message: "Attendance cancelled successfully!" });
  } catch (error) {
    next(error);
  }
};

