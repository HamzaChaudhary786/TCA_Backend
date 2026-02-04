// models/StudentPromote.js

const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // assuming your student is a User model
        required: true
    },
    name: {
        type: String,
        required: true
    },
    rollNo: {
        type: String,
        required: true
    }
}, { _id: false });

const studentPromoteSchema = new mongoose.Schema({
    sourceClassroom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
        required: true
    },
    sourceLevel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Level',
        required: true
    },
    targetClassroom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
        required: true
    },
    targetLevel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Level',
        required: true
    },
    promotorName: {
        type: String,
        required: true
    },
    promotorDate: {
        type: Date,
        default: Date.now
    },
    promotorDescription: {
        type: String
    },
    approvalName: {
        type: String
    },
    approvalDescription: {
        type: String
    },
    approvalDate: {
        type: Date
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    students: [studentSchema]
}, {
    timestamps: true
});



const StudentPromote = mongoose.model("StudentPromote", studentPromoteSchema);

module.exports = StudentPromote;