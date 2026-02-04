const sql = require('mssql');
const moment = require('moment');
const mongoose = require('mongoose');
require('dotenv').config();

// Import Models with correct paths
const User = require('../models/user.js');
const Classroom = require('../models/classroom.js');
const Attendance = require('../models/attendence.js');

// Import socket from your existing socket setup
const { io } = require('../utils/socket');

// MSSQL Configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    port: Number(process.env.DB_PORT),
    connectionTimeout: 30000,
    requestTimeout: 30000
};

// MSSQL Connection Pool
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log("Connected to MSSQL Database");
        return pool;
    })
    .catch(err => {
        console.error("MSSQL Connection Failed:", err.message);
        // Don't exit process here since main server is running
        return null;
    });

// Get today's attendance data from SQL
async function fetchTodayAttendance() {
    try {
        const pool = await poolPromise;
        if (!pool) {
            console.log("MSSQL pool not available");
            return [];
        }

        const todayStart = moment().startOf('day').valueOf();
        const todayEnd = moment().endOf('day').valueOf();

        const query = `
            SELECT PersonID, PersonName, PerSonCardNo, AttendanceDateTime, AttendanceUtcTime
            FROM AttendanceRecordInfo
            WHERE AttendanceDateTime BETWEEN @todayStart AND @todayEnd
            ORDER BY AttendanceDateTime DESC;
        `;

        const result = await pool.request()
            .input('todayStart', sql.BigInt, todayStart)
            .input('todayEnd', sql.BigInt, todayEnd)
            .query(query);

        const uniqueRecords = {};
        const formattedData = result.recordset.reduce((acc, record) => {
            const rollNO = record.PersonID || "0000";
            const attendanceDate = record.AttendanceDateTime
                ? moment(parseInt(record.AttendanceDateTime)).format('YYYY-MM-DD')
                : null;

            if (attendanceDate) {
                const uniqueKey = `${rollNO}-${attendanceDate}`;
                if (!uniqueRecords[uniqueKey]) {
                    uniqueRecords[uniqueKey] = {
                        rollNO,
                        name: record.PersonName,
                        AttendanceDateTime: moment(parseInt(record.AttendanceDateTime)).format('YYYY-MM-DD HH:mm:ss'),
                    };
                    acc.push(uniqueRecords[uniqueKey]);
                }
            }
            return acc;
        }, []);

        return formattedData;
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return [];
    }
}

// Main function - Process attendance data
async function processAttendanceData() {
    try {
        // Step 1: Get attendance data from SQL
        const attendanceData = await fetchTodayAttendance();
        console.log(`Found ${attendanceData.length} attendance records`);

        if (attendanceData.length === 0) {
            return;
        }

        // Step 2: Get all classrooms with students
        const classrooms = await Classroom.find().populate('students');

        if (!classrooms || classrooms.length === 0) {
            console.log("No classrooms found");
            return;
        }

        let processedCount = 0;

        // Step 3: Process each rollNo from attendanceData
        for (const attendanceRecord of attendanceData) {
            const { rollNO } = attendanceRecord;

            // Step 4: Find which classroom this student belongs to
            for (const classroom of classrooms) {
                const student = classroom.students.find(s => s.rollNo === rollNO);

                if (student) {
                    // Step 5: Found student in this classroom, now save attendance
                    const saved = await saveStudentAttendance(classroom._id, student._id, rollNO);
                    if (saved) processedCount++;
                    break; // Student found, no need to check other classrooms
                }
            }
        }

        // Emit update via Socket.IO to your existing socket setup
        if (io) {
            io.emit('attendanceUpdated', {
                timestamp: new Date(),
                recordsProcessed: attendanceData.length,
                studentsUpdated: processedCount
            });
        }

        console.log(`Attendance processing completed: ${processedCount}/${attendanceData.length} students processed`);
        return attendanceData;

    } catch (error) {
        console.error('Error processing attendance:', error);
    }
}

// Save student attendance (no duplicates)
async function saveStudentAttendance(classroomId, studentId, rollNo) {
    try {
        const today = moment().startOf('day').toDate();

        // Check if attendance already exists for this classroom today
        let attendance = await Attendance.findOne({
            entityId: classroomId,
            entityType: "classroom",
            Date: {
                $gte: today,
                $lt: moment(today).endOf('day').toDate()
            }
        });

        if (attendance) {
            // Check if student already marked present
            const existingStudent = attendance.students.find(s =>
                s.studentID.toString() === studentId.toString()
            );

            if (!existingStudent) {
                // Add student to existing attendance record
                attendance.students.push({
                    studentID: studentId,
                    isPresent: true,
                    late: false
                });
                await attendance.save();
                console.log(`Added student ${rollNo} to existing attendance`);
                return true;
            } else if (!existingStudent.isPresent) {
                // Update existing student record to present
                existingStudent.isPresent = true;
                await attendance.save();
                console.log(`Updated student ${rollNo} attendance to present`);
                return true;
            }
            // Student already marked present, no change needed
            return false;
        } else {
            // Create new attendance record for this classroom
            attendance = new Attendance({
                entityId: classroomId,
                entityType: "classroom",
                Date: today,
                students: [{
                    studentID: studentId,
                    isPresent: true,
                    late: false
                }]
            });
            await attendance.save();
            console.log(`Created new attendance record for student ${rollNo}`);
            return true;
        }

    } catch (error) {
        console.error(`Error saving attendance for rollNo ${rollNo}:`, error);
        return false;
    }
}

// Initialize attendance processing
async function initializeAttendanceProcessing() {
    try {
        console.log("Initializing attendance processing system...");
        
        // Wait a bit for main server to be ready
        setTimeout(async () => {
            // Process immediately on start
            await processAttendanceData();
            
            // Process every 2 seconds
            setInterval(processAttendanceData, 60 * 1000);
            
            console.log('Attendance processing started - running every 2 seconds');
        }, 5000); // Wait 5 seconds after main server starts

    } catch (error) {
        console.error("Failed to initialize attendance processing:", error);
    }
}

// Export the initialization function
module.exports = {
    initializeAttendanceProcessing,
    processAttendanceData,
    fetchTodayAttendance
};