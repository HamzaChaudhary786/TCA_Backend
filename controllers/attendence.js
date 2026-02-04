const Class = require("../models/class");
const Attendance = require("../models/attendence"); // Import the Attendance model
const Classroom = require("../models/classroom");

exports.createAttendence = async (req, res, next) => {
    const { id } = req.params;
    const { data, date } = req.body;

    console.log(id, "class id is");

    try {
        const attendanceRecord = new Attendance({
            entityId: id,
            entityType: "classroom",
            Date: date,
            students: data.map(student => ({
                studentID: student.studentID,
                isPresent: student.isPresent,
                late: student.late,
            })),
        });

        // Check if attendance for this class and date already exists
        const existingAttendance = await Attendance.findOne({
            entityId: id,
            Date: {
                $gte: new Date(date).setHours(0, 0, 0, 0),      // Start of the day
                $lte: new Date(date).setHours(23, 59, 59, 999) // End of the day
            }
        });


        if (existingAttendance) {
            return res.status(400).json({ message: "Attendance has already been marked for today" });
        }

        await attendanceRecord.save();

        return res.status(201).json({ message: "Attendance created successfully" });
    } catch (error) {
        next(error);
    }
};

exports.updateClassroomAttendence = async (req, res, next) => {
    const { classroomID } = req.params; // Classroom ID
    const { data, date } = req.body;

    try {

        // Find the attendance record for the given class and date
        const existingAttendance = await Attendance.findOne({
            entityId: classroomID,
            Date: {
                $gte: new Date(date).setHours(0, 0, 0, 0),      // Start of the day
                $lte: new Date(date).setHours(23, 59, 59, 999), // End of the day
            },
        });

        // If attendance record doesn't exist, return a 404 error
        if (!existingAttendance) {
            return res.status(404).json({ message: "Attendance record not found for the given date" });
        }

        // Update the attendance data
        existingAttendance.students = data.map((student) => ({
            studentID: student.studentID,
            isPresent: student.isPresent,
            late: student.late,
        }));

        // Save the updated attendance record
        await existingAttendance.save();

        return res.status(200).json({ message: "Attendance updated successfully", attendance: existingAttendance });
    } catch (error) {
        next(error);
    }
};


exports.getClassroomAttendence = async (req, res, next) => {
    const { classroomID } = req.params;
    const { date } = req.query;
    // Get the start and end of today's date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        // Find attendance record within today's date range
        const attendanceRecord = await Attendance.findOne({
            entityId: classroomID,
            Date: { $gte: startOfDay, $lte: endOfDay }, // Date within today
        });

        if (!attendanceRecord) {
            return res.status(404).json({ message: "Attendance not found for today" });
        }

        return res.status(200).send(attendanceRecord); // Return the attendance record
    } catch (error) {
        next(error); // Pass errors to the error handler middleware
    }
};



exports.getOverallAttendenceOfSubjects = async (req, res, next) => {

    console.log("inside the function");

    try {
        const { studentID } = req.params;

        // Find all classes where the student has attendance records
        const classes = await Class.find({
            "attendance.studentID": studentID,
        });

        let present = 0;
        let absent = 0;
        let late = 0;

        // Calculate attendance stats
        classes.forEach((cls) => {
            const attendanceRecord = cls.attendance.find(
                (record) => record.studentID.toString() === studentID
            );

            if (attendanceRecord) {
                if (attendanceRecord.isPresent) {
                    if (attendanceRecord.late) {
                        late++;
                    }
                    present++;
                } else {
                    absent++;
                }
            }
        });

        // Prepare chart data
        const chartData = [
            { label: "Present", value: present },
            { label: "Absent", value: absent },
            { label: "Late", value: late },
        ];

        res.status(200).json(chartData);
    } catch (error) {
        console.error("Error fetching attendance stats:", error);
        next(error);
    }
};



