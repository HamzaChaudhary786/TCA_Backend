// classroomRepository.js
const Classroom = require('../models/classroom');
const Subject = require('../models/subject');
const Level = require('../models/level');

class ClassroomRepository {
    async findClassroomById(id) {
        return await Classroom.findById(id);
    }

    async findClassroomByNameAndLevel(name, levelID) {
        return await Classroom.findOne({ name, levelID });
    }

    async findClassroomsByStudentIds(studentIds) {
        return await Classroom.findOne({ students: studentIds });
    }

    async findTeacherClassroom(teacherId) {
        return await Classroom.findOne({ "teachers.teacher": teacherId });
    }

    async updateClassroomById(id, updateData) {
        return await Classroom.findByIdAndUpdate(id, updateData, { new: true });
    }




}

module.exports = new ClassroomRepository();


