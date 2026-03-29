const mongoose = require("mongoose");

const archivedReportSchema = new mongoose.Schema({
    studentID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    sourceClassroomID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Classroom",
        required: true,
    },
    targetClassroomID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Classroom",
        required: true,
    },
    promotionDate: {
        type: Date,
        default: Date.now,
    },
    attendanceRecords: [
        {
            date: Date,
            isPresent: Boolean,
            late: Boolean,
        }
    ],
    assignments: [
        {
            assignmentID: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Assignment",
            },
            title: String,
            totalMarks: Number,
            obtainedMarks: Number,
            grade: String,
            feedback: String,
            submittedAt: Date,
        }
    ],
    quizzes: [
        {
            quizID: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Quiz",
            },
            title: String,
            totalMarks: Number,
            obtainedMarks: Number,
            grade: String,
            feedback: String,
            submittedAt: Date,
        }
    ],
    scheduleClasses: [
        {
            classID: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Class",
            },
            title: String,
            startTime: Date,
            endTime: Date,
            subjectID: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Subject",
            },
            isPresent: Boolean,
            late: Boolean,
        }
    ],
}, { timestamps: true });

// Index for fast lookups by student or classroom
archivedReportSchema.index({ studentID: 1 });
archivedReportSchema.index({ sourceClassroomID: 1 });

const ArchivedReport = mongoose.model("ArchivedReport", archivedReportSchema);

module.exports = ArchivedReport;
