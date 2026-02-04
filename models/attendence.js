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

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;
