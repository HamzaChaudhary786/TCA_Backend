const prisma = require("../db/prisma");

exports.createAttendence = async (req, res, next) => {
    const { id } = req.params;
    const { data, date } = req.body;

    try {
        const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
        const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                entityId: id,
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        if (existingAttendance) {
            return res.status(400).json({ message: "Attendance has already been marked for today" });
        }

        await prisma.attendance.create({
            data: {
                entityId: id,
                entityType: "classroom",
                date: new Date(date),
                students: {
                    create: data.map(student => ({
                        studentID: student.studentID,
                        isPresent: student.isPresent,
                        late: student.late || false,
                    }))
                }
            }
        });

        return res.status(201).json({ message: "Attendance created successfully" });
    } catch (error) {
        next(error);
    }
};

exports.updateClassroomAttendence = async (req, res, next) => {
    const { classroomID } = req.params;
    const { data, date } = req.body;

    try {
        const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
        const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                entityId: classroomID,
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        if (!existingAttendance) {
            return res.status(404).json({ message: "Attendance record not found for the given date" });
        }

        await prisma.$transaction([
            prisma.attendanceRecord.deleteMany({ where: { attendanceID: existingAttendance.id } }),
            prisma.attendanceRecord.createMany({
                data: data.map(student => ({
                    attendanceID: existingAttendance.id,
                    studentID: student.studentID,
                    isPresent: student.isPresent,
                    late: student.late || false,
                }))
            })
        ]);

        return res.status(200).json({ message: "Attendance updated successfully" });
    } catch (error) {
        next(error);
    }
};

exports.getClassroomAttendence = async (req, res, next) => {
    const { classroomID } = req.params;
    const { date } = req.query;
    const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

    try {
        const attendanceRecord = await prisma.attendance.findFirst({
            where: {
                entityId: classroomID,
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: { students: true }
        });

        if (!attendanceRecord) {
            return res.status(404).json({ message: "Attendance not found for today" });
        }

        return res.status(200).send(attendanceRecord);
    } catch (error) {
        next(error);
    }
};

exports.getOverallAttendenceOfSubjects = async (req, res, next) => {
    try {
        const { studentID } = req.params;

        const classAttendances = await prisma.classAttendance.findMany({
            where: { studentID },
        });

        let present = 0;
        let absent = 0;
        let late = 0;

        classAttendances.forEach((record) => {
            if (record.isPresent) {
                if (record.late) late++;
                present++;
            } else {
                absent++;
            }
        });

        const chartData = [
            { label: "Present", value: present },
            { label: "Absent", value: absent },
            { label: "Late", value: late },
        ];

        res.status(200).json(chartData);
    } catch (error) {
        next(error);
    }
};



