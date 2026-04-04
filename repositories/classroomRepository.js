const prisma = require('../db/prisma');

class ClassroomRepository {
    async findClassroomById(id) {
        return await prisma.classroom.findUnique({
            where: { id: id }
        });
    }

    async findClassroomByNameAndLevel(name, levelID) {
        return await prisma.classroom.findFirst({
            where: { name, levelID }
        });
    }

    async findClassroomsByStudentIds(studentIds) {
        // If studentIds is an array, find classrooms that have ANY of these students
        if (Array.isArray(studentIds)) {
            return await prisma.classroom.findMany({
                where: {
                    students: {
                        some: {
                            id: { in: studentIds }
                        }
                    }
                }
            });
        }
        // If it's a single ID
        return await prisma.classroom.findFirst({
            where: {
                students: {
                    some: {
                        id: studentIds
                    }
                }
            }
        });
    }

    async findTeacherClassroom(teacherId) {
        return await prisma.classroom.findFirst({
            where: {
                teachers: {
                    some: {
                        teacherID: teacherId
                    }
                }
            }
        });
    }

    async updateClassroomById(id, updateData) {
        // Handle relational updates if necessary, but for now direct update
        // Note: Prisma update requires specific structure for nested fields.
        // This repository method might need to be more specific or 
        // the controller needs to pass Prisma-compatible data.
        return await prisma.classroom.update({
            where: { id: id },
            data: updateData
        });
    }
}

module.exports = new ClassroomRepository();


