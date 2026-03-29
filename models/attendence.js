const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    entityId: {
        type: mongoose.Schema.Types.ObjectId, //Classroom Id
        refPath: "entityType",
        required: true,
    },
    entityType: {
        type: String,
        enum: ["classroom"], // Ensures valid types
        required: true,
    },
    Date: {
        type: Date,
        default: Date.now,
        required: true,
    },
    students: [
        {
            studentID: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            isPresent: {
                type: Boolean,
                required: true,
            },
            late: {
                type: Boolean,
                default: false,
            },
        },
    ],
});

// Ensure one attendance document per entity/day and speed lookups
attendanceSchema.index({ entityId: 1, Date: 1 }, { unique: true });
attendanceSchema.index({ "students.studentID": 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;
