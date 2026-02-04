const Subject = require("../models/subject");
const Classroom = require("../models/classroom");
const Class = require("../models/class");
const Notification = require("../models/notification");
const Attendance = require("../models/attendence");
const User = require("../models/user");
const mongoose = require("mongoose");
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
//     const groupID = isMultiDay ? new mongoose.Types.ObjectId() : null;
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

    const classroom = await Classroom.findById(classroomID);
    if (!classroom) {
      return res.status(400).json({ error: 'Classroom does not exist' });
    }

    const subject = await Subject.findById(subjectID);
    if (!subject) {
      return res.status(400).json({ error: 'Subject does not exist' });
    }

    const startDate = convertDateStringToPKT(startEventDate);
    const endDate = convertDateStringToPKT(endEventDate);

    if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
      return res.status(400).json({ error: 'Invalid start or end event dates' });
    }

    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      return res.status(400).json({ error: 'Please select at least one day.' });
    }

    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const selectedDayNumbers = selectedDays.map(day => dayMap[day]);
    const events = [];
    const groupID = !moment(startDate).isSame(endDate, 'day') ? new mongoose.Types.ObjectId() : null;

    let currentDate = startDate.clone();

    while (currentDate.isSameOrBefore(endDate)) {
      if (selectedDayNumbers.includes(currentDate.day())) {
        const dayStart = convertToPKTAndSubtractHours(currentDate, startTime, 5);
        const dayEnd = convertToPKTAndSubtractHours(currentDate, endTime, 5);

        if (!dayStart.isValid() || !dayEnd.isValid()) {
          return res.status(400).json({
            error: `Invalid time for ${currentDate.format('YYYY-MM-DD')}`,
            details: { startTime, endTime }
          });
        }

        if (dayEnd.isBefore(dayStart)) {
          return res.status(400).json({ error: 'End time cannot be before start time' });
        }

        const dateStr = currentDate.format('YYYY-MM-DD');

        // Check for teacher conflict
        const teacherConflict = await Class.findOne({
          'teacher.teacherID': teacher.teacherID,
          startTime: { $lt: dayEnd.toDate() },
          endTime: { $gt: dayStart.toDate() },
        });

        if (teacherConflict) {
          return res.status(400).json({ error: `Teacher has a scheduling conflict on ${dateStr}` });
        }

        // Check for classroom conflict
        const classroomConflict = await Class.findOne({
          classroomID,
          startTime: { $lt: dayEnd.toDate() },
          endTime: { $gt: dayStart.toDate() },
        });

        if (classroomConflict) {
          return res.status(400).json({ error: `Classroom is already booked on ${dateStr}` });
        }

        // Prevent duplicate class with same title, teacher, time, classroom
        const duplicateClass = await Class.findOne({
          title,
          'teacher.teacherID': teacher.teacherID,
          classroomID,
          startTime: dayStart.toDate(),
          endTime: dayEnd.toDate(),
        });

        if (duplicateClass) {
          return res.status(400).json({ error: `Duplicate class already exists on ${dateStr}` });
        }

        events.push({
          title,
          startTime: dayStart.toDate(),
          endTime: dayEnd.toDate(),
          classroomID,
          subjectID,
          teacher,
          meetingUrl,
          createdBy: req.user._id,
          startEventDate,
          endEventDate,
          oneTime,
          groupID
        });
      }

      currentDate.add(1, 'day');
    }

    if (events.length === 0) {
      return res.status(400).json({ error: 'No valid class instances found for the selected days' });
    }

    await Class.insertMany(events);
    res.status(201).json({ message: 'Classes created successfully', events });

  } catch (err) {
    console.error('Error creating class:', err);
    res.status(500).json({ error: 'An error occurred while creating the class' });
  }
};


exports.updateClass = async (req, res, next) => {
  try {
    const {
      classID,
      title,
      meetingUrl,
      teacher,
      subjectID,
      startTime,
      endTime,
      startEventDate,
      endEventDate,
      updateSeries, // boolean value true / false
    } = req.body;

    // Validate class
    const existingClass = await Class.findById(classID);
    if (!existingClass) {
      return res.status(404).json({ error: "Class not found" });
    }

    // Validate subject if provided
    if (subjectID) {
      const subject = await Subject.findById(subjectID);
      if (!subject) {
        return res.status(400).json({ error: 'Subject does not exist' });
      }
    }

    console.log(startTime, "start time");
    console.log(endTime, "end time");


    const start = convertToPKTAndSubtractHours(startTime, undefined, 5);  // Convert to PKT timezone
    const end = convertToPKTAndSubtractHours(endTime, undefined, 5);  // Convert to PKT timezone

    console.log(start, "start");
    console.log(end, "end");


    const startDate = convertDateStringToPKT(startEventDate);  // Convert to PKT timezone
    const endDate = convertDateStringToPKT(endEventDate);  // Convert to PKT timezone

    const updatedStartTime = start.set({
      year: startDate.year(),
      month: startDate.month(),
      date: startDate.date(),
    }).toISOString();

    const updatedEndTime = end.set({
      year: startDate.year(),
      month: startDate.month(),
      date: startDate.date(),
    }).toISOString();

    // Prepare update object
    const updateObj = {};

    // Update basic fields if provided
    if (title) updateObj.title = title;
    if (meetingUrl !== undefined) updateObj.meetingUrl = meetingUrl;
    if (teacher) updateObj.teacher = teacher;
    if (subjectID) updateObj.subjectID = subjectID;

    // Ensure required fields are maintained
    updateObj.oneTime = existingClass.oneTime;
    updateObj.createdBy = existingClass.createdBy;
    updateObj.classroomID = existingClass.classroomID;

    // Update time-related fields
    updateObj.startTime = updatedStartTime;
    updateObj.endTime = updatedEndTime;
    updateObj.startEventDate = startDate.toISOString();
    updateObj.endEventDate = endDate.toISOString();

    // Handle group updates
    if (existingClass.groupID) {
      if (updateSeries) {
        const existingClasses = await Class.find({ groupID: existingClass.groupID });

        // Update all classes in the series
        const updatePromises = existingClasses.map(async (cls) => {
          try {
            const clsStart = convertToPKT(cls.startTime);
            const clsEnd = convertToPKT(cls.endTime);

            // Extract date parts
            const startDateOnly = clsStart.format('YYYY-MM-DD');
            const endDateOnly = clsEnd.format('YYYY-MM-DD');

            // Use the new time values (from 'start' and 'end') with the existing date for each class
            const newStartTime = createDateTimeInPKT(startDateOnly, convertToPKT(start).format('HH:mm:ss'));
            const newEndTime = createDateTimeInPKT(endDateOnly, convertToPKT(end).format('HH:mm:ss'));

            // Prepare update object for series
            const seriesUpdateObj = {
              startTime: new Date(newStartTime),
              endTime: new Date(newEndTime),
            };

            // Add other fields to all classes in series
            if (title) seriesUpdateObj.title = title;
            if (meetingUrl !== undefined) seriesUpdateObj.meetingUrl = meetingUrl;
            if (teacher) seriesUpdateObj.teacher = teacher;
            if (subjectID) seriesUpdateObj.subjectID = subjectID;

            // Maintain required fields
            seriesUpdateObj.oneTime = cls.oneTime;
            seriesUpdateObj.createdBy = cls.createdBy;
            seriesUpdateObj.classroomID = cls.classroomID;

            const result = await Class.updateOne({ _id: cls._id }, seriesUpdateObj);

            // Return success result with class info for tracking
            return {
              success: true,
              classId: cls._id,
              result: result
            };
          } catch (error) {
            // Return error result for this specific class
            return {
              success: false,
              classId: cls._id,
              error: error.message
            };
          }
        });

        // Wait for all updates to complete
        const updateResults = await Promise.all(updatePromises);

        // Analyze results
        const successfulUpdates = updateResults.filter(result => result.success);
        const failedUpdates = updateResults.filter(result => !result.success);

        if (failedUpdates.length === 0) {
          // All updates succeeded
          return res.status(200).json({
            message: "All classes in series updated successfully",
            totalClasses: updateResults.length,
            updatedClasses: successfulUpdates.length
          });
        } else if (successfulUpdates.length > 0) {
          // Partial success - some updates failed
          return res.status(200).json({
            message: "Classes updated with some errors",
            totalClasses: updateResults.length,
            successfulUpdates: successfulUpdates.length,
            failedUpdates: failedUpdates.length,
            failedClassIds: failedUpdates.map(f => f.classId),
            errors: failedUpdates.map(f => ({ classId: f.classId, error: f.error }))
          });
        } else {
          // All updates failed
          return res.status(500).json({
            error: "Failed to update any classes in the series",
            totalClasses: updateResults.length,
            errors: failedUpdates.map(f => ({ classId: f.classId, error: f.error }))
          });
        }
      } else {
        // Update only the current class
        await Class.updateOne({ _id: classID }, updateObj);
        return res.status(200).json({ message: "Single class updated successfully" });
      }
    } else {
      // Update single class (no groupID)
      const updatedClass = await Class.findOneAndUpdate(
        { _id: classID },
        updateObj,
        { new: true }
      ).populate('subjectID').populate('teacher.teacherID');
      return res.status(200).json({
        data: updatedClass,
        message: "Class updated successfully"
      });
    }
  } catch (err) {
    console.error("Error updating class:", err.message, err.stack);
    return res.status(500).json({ error: "An error occurred while updating the class" });
  }
};


exports.rescheduleClass = async (req, res, next) => {
  try {
    const data = req.body;

    const classss = await Class.findById(req.params.id).populate("classroomID");

    if (!classss) {
      return res.status(404).send("Class does not exist");
    }

    const teacher = classss.teacher.teacherID;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    // check if class start time has passed
    if (startTime < new Date()) {
      return res.status(400).send("Class start time has passed");
    }

    // check if start time is on weekend
    if (isWeekend(startTime)) {
      return res.status(400).send("Class cannot hold on weekend");
    }

    const teacherHasClass = await Class.findOne({
      _id: { $ne: req.params.id },
      "teacher.teacherID": teacher,
      $expr: {
        $cond: {
          if: { $eq: ["$oneTime", false] },
          then: {
            $and: [
              {
                $or: [
                  { $gt: [{ $hour: "$endTime" }, { $hour: startTime }] },
                  {
                    $and: [
                      { $eq: [{ $hour: "$endTime" }, { $hour: startTime }] },
                      {
                        $gt: [{ $minute: "$endTime" }, { $minute: startTime }],
                      },
                    ],
                  },
                ],
              },
              {
                $or: [
                  { $lt: [{ $hour: "$startTime" }, { $hour: endTime }] },
                  {
                    $and: [
                      { $eq: [{ $hour: "$startTime" }, { $hour: endTime }] },
                      {
                        $lt: [{ $minute: "$startTime" }, { $minute: endTime }],
                      },
                    ],
                  },
                ],
              },
              {
                $eq: [{ $dayOfWeek: "$startTime" }, { $dayOfWeek: startTime }],
              },
            ],
          },
          else: {
            $and: [
              { $lt: ["$startTime", endTime] },
              { $gt: ["$endTime", startTime] },
            ],
          },
        },
      },
    });
    if (teacherHasClass) {
      return res.status(400).send("Teacher already has a class at this time");
    }

    // check if students of classroomID have class at this time
    const students = classss.classroomID.students;
    const studentsHasClass = await Class.aggregate([
      {
        $lookup: {
          from: "classrooms", // Replace with the actual name of the classrooms collection
          localField: "classroomID",
          foreignField: "_id",
          as: "classroom",
        },
      },
      {
        $match: {
          _id: { $ne: mongoose.Types.ObjectId(req.params.id) },
          "classroom.students": { $in: students },
          $expr: {
            $cond: {
              if: { $eq: ["$oneTime", false] },
              then: {
                $and: [
                  {
                    $or: [
                      { $gt: [{ $hour: "$endTime" }, { $hour: startTime }] },
                      {
                        $and: [
                          {
                            $eq: [{ $hour: "$endTime" }, { $hour: startTime }],
                          },
                          {
                            $gt: [
                              { $minute: "$endTime" },
                              { $minute: startTime },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    $or: [
                      { $lt: [{ $hour: "$startTime" }, { $hour: endTime }] },
                      {
                        $and: [
                          {
                            $eq: [{ $hour: "$startTime" }, { $hour: endTime }],
                          },
                          {
                            $lt: [
                              { $minute: "$startTime" },
                              { $minute: endTime },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    $eq: [
                      { $dayOfWeek: "$startTime" },
                      { $dayOfWeek: startTime },
                    ],
                  },
                ],
              },
              else: {
                $and: [
                  { $lt: ["$startTime", endTime] },
                  { $gt: ["$endTime", startTime] },
                ],
              },
            },
          },
        },
      },
    ]);

    if (studentsHasClass.length > 0) {
      return res.status(400).send("Students already have a class at this time");
    }

    classss.startTime = startTime;
    classss.endTime = endTime;

    await classss.save();

    return res.status(200).send(classss._doc);
  } catch (err) {
    next(err);
  }
};

exports.cancelClass = async (req, res, next) => {
  try {
    // find class by id

    const classs = await Class.findById(req.params.id);
    if (!classs) {
      return res.status(404).send("Class does not exist");
    }
    // check if class start time has passed
    if (classs.startTime < new Date()) {
      return res.status(400).send("Class start time has passed");
    }

    // delete class
    await classs.remove();
    return res.status(200).send(classs._doc);
  } catch (err) {
    next(err);
  }
};

exports.markTeacherPresent = async (req, res, next) => {
  try {

    // find class by id
    const classs = await Class.findByIdAndUpdate(req.params.id, { $set: { "teacher.status": "present" } }, { new: true });

    if (!classs) {
      return res.status(404).send("Class does not exist");
    }

    return res.status(200).send(classs._doc);
  } catch (err) {
    next(err);
  }
};

exports.getClasses = async (req, res, next) => {
  try {
    const { startDate, endDate, teacherID } = req.query;

    // Parse startDate and endDate
    console.log("Start Date:", startDate);
    console.log("End Date:", endDate);

    // Validate dates and convert them to Date objects
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    if (!endDate) {
      end.setDate(start.getDate() + 7); // Default to 1 week from start if no end date
    }

    console.log("Parsed Start Date:", start);
    console.log("Parsed End Date:", end);

    // Ensure teacherID is passed correctly, and parse the user ID for filtering
    const userRole = req.user.userType;
    const userId = req.user._id;
    const userID = mongoose.Types.ObjectId(userId); // Replace userId with the actual user ID

    // Initialize the aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: "classrooms",
          localField: "classroomID",
          foreignField: "_id",
          as: "classroom",
        },
      },
      {
        $unwind: "$classroom",
      },
      {
        $lookup: {
          from: "subjects",
          localField: "subjectID",
          foreignField: "_id",
          as: "subjectID",
        },
      },
      {
        $unwind: "$subjectID",
      },
      {
        $lookup: {
          from: "users", // assuming "users" is the collection name for teachers
          localField: "teacher.teacherID",
          foreignField: "_id",
          as: "teacher.teacherID",
        },
      },
      {
        $unwind: "$teacher.teacherID",
      },
      {
        $match: {
          $expr: {
            $and: [
              { $gte: ["$startTime", start] },
              { $lte: ["$endTime", end] },
            ],
          },
        },
      },
    ];

    // Apply filtering based on the teacherID if provided
    if (teacherID && teacherID !== '') {
      // Filter by specific teacher if teacherID is provided
      pipeline.push({
        $match: { "teacher.teacherID._id": mongoose.Types.ObjectId(teacherID) },
      });
    } else if (userRole === "admin") {
      // Admin sees all classes
      pipeline.push({
        $match: { "classroom.students": { $exists: true } },
      });
    } else if (userRole === "teacher") {
      // Teacher sees their own classes
      pipeline.push({
        $match: { "teacher.teacherID._id": userID },
      });
    } else if (userRole === "student") {
      // Student sees only their enrolled classes
      pipeline.push({
        $match: { "classroom.students": userID },
      });
    }

    // Execute the aggregation pipeline
    const result = await Class.aggregate(pipeline);

    return res.status(200).send(result);
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
//     const userID = mongoose.Types.ObjectId(userId); // Replace userId with the actual user ID
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

    // set end date to 1 week from start date
    // let endDate = new Date(startDate);
    // endDate.setDate(endDate.getDate() + 7);
    // endDate = endDate.toISOString();
    console.log(startDate, endDate);
    console.log(new Date(startDate), new Date(endDate));

    const date = moment(startDate, moment.ISO_8601, true);

    console.log(date.isValid());

    const userRole = req.user.userType;
    const userId = req.user._id;
    const userID = mongoose.Types.ObjectId(userId); // Replace userId with the actual user ID
    const pipeline = [
      {
        $lookup: {
          from: "classrooms",
          localField: "classroomID",
          foreignField: "_id",
          as: "classroom",
        },
      },
      {
        $unwind: "$classroom",
      },
      {
        $lookup: {
          from: "subjects",
          localField: "subjectID",
          foreignField: "_id",
          as: "subjectID",
        },
      },
      {
        $unwind: "$subjectID",
      },
      {
        $lookup: {
          from: "users", // assuming "users" is the collection name for teachers
          localField: "teacher.teacherID",
          foreignField: "_id",
          as: "teacher.teacherID",
        },
      },
      {
        $unwind: "$teacher.teacherID",
      },
      {
        $lookup: {
          from: "users",
          localField: "classroom.students",
          foreignField: "_id",
          as: "classroom.studentdetails",
        },
      },
      // {
      //   $unwind: "$classroom.studentdetails",
      // },
      {
        $match: {
          $expr: {
            $and: [
              {
                $gte: [
                  { $toDate: "$startTime" },
                  { $toDate: new Date(startDate).toDateString() },
                ],
              },
              {
                $lte: [
                  { $toDate: "$endTime" },
                  { $toDate: new Date(endDate).toDateString() },
                ],
              },
            ],
          },
        },
      },
    ];

    // // Match based on user role
    if (userRole === "admin") {
      // If user is admin, return all classes within the date range
      pipeline.push({
        $match: {
          "classroom.students": { $exists: true },
        },
      });
    } else if (userRole === "teacher") {
      // If user is a teacher, return only classes of the teacher within the date range
      pipeline.push({
        $match: {
          "teacher.teacherID._id": userID,
        },
      });
    } else if (userRole === "student") {
      // If user is a student, return only classes of the student within the date range
      pipeline.push({
        $match: {
          "classroom.students": userID,
        },
      });
    }

    // Add any additional pipeline stages as needed

    // Execute the pipeline
    const result = await Class.aggregate(pipeline);

    return res.status(200).send(result);
  } catch (err) {
    next(err);
  }
};



exports.submitAttendence = async (req, res, next) => {
  try {





    const { id } = req.params; // Class ID
    const { data, classroomID, startTime } = req.body; // Attendance data submitted by the teacher

    // Fetch the class details
    const studentClass = await Class.findById(id).populate('subjectID');


    if (!studentClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Update attendance for the class
    await Class.findByIdAndUpdate(id, { attendance: data }, { new: true });


    // const settings = await Setting.findOne()

    // if (!settings) {
    //   console.log("No settings found.");
    //   return;
    // }

    const classroom = await Classroom.findById(classroomID);

    if (!classroom) {
      return res.status(404).json({ message: "Classroom not found" });
    }

    const studentIds = data.map(student => student.studentID);
    const studentRecords = await userRepository.getStudentRecordsByIds(studentIds);


    const studentData = studentRecords.map(student => ({
      studentID: student._id.toString(),
      rollNOS: Number(student.rollNo),  // Convert to Number for type consistency
      employeeName: student.name
    }));


    // Check if there is a teacher with type "head"
    // const isHeadTeacher = classroom.teachers.some(item => item.type === "head");

    // if (isHeadTeacher) {
    const todayStart = new Date(startTime).setHours(0, 0, 0, 0); // Start of the day (00:00:00)
    const todayEnd = new Date(startTime).setHours(23, 59, 59, 999); // End of the day (23:59:59)

    // Fetch today's head attendance record
    const headAttendance = await Attendance.findOne({
      entityId: classroomID,
      Date: { $gte: todayStart, $lt: todayEnd },
    });

    if (!headAttendance) {
      return res.status(400).json({ message: "No head attendance record found for today" });
    }

    // Compare attendance between head and teacher
    const absentStudents = data
      .filter(student => !student.isPresent)
      .map(student => student.studentID.toString());

    const headPresentStudents = headAttendance.students
      .filter(student => student.isPresent)
      .map(student => student.studentID.toString());

    const discrepancyStudents = absentStudents.filter(student =>
      headPresentStudents.includes(student)
    );

    if (discrepancyStudents.length > 0) {
      // Construct the detailed message for the admin notification
      const classTitle = studentClass.title;
      const subjectName = studentClass.subjectID.name; // Assuming subjectID has a 'name' field

      const admins = await User.findOne({ userType: "admin" });

      // Fetch students and their guardians
      const students = await User.find({
        _id: { $in: discrepancyStudents },
      });

      // Create a map of student roll numbers and extract guardian IDs
      const studentMap = students.reduce((map, student) => {
        map[student._id.toString()] = { name: student.name, rollNo: student.rollNo || "N/A" };
        return map;
      }, {});

      // Extract guardian IDs from the student records
      const guardianIds = students
        .filter(student => student.guardianId) // Ensure the student has a guardianId
        .map(student => student.guardianId.toString());

      // Combine admin ID with unique guardian IDs
      const deliveredTo = [admins?._id, ...new Set(guardianIds)]; // Use `Set` to avoid duplicate IDs

      // Generate notifications using the lookup map
      const notifications = discrepancyStudents.map(studentID => {
        const studentInfo = studentMap[studentID] || { name: "Unknown Student", rollNo: "N/A" };
        return {
          userID: studentID, // Admin's User ID
          message: `Student ${studentInfo.name} (Roll No: ${studentInfo.rollNo}) is marked absent in the class "${classTitle}" for the subject "${subjectName}" but was present earlier in the head attendance.`,
          url: `/students/${studentID}`, // URL to the student's page
          deliveredTo: deliveredTo, // Deliver to admin and guardians
        };
      });

      // Send notifications
      await Notification.insertMany(notifications);
    }
    // }

    // Fetch today's start date (ensure it is in UTC)


    return res.status(200).json({ message: "Class attendance updated successfully!" });
  } catch (error) {
    console.error("Error occurred:", error.message);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

