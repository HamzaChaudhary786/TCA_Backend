const prisma = require('../db/prisma');

class UserRepository {
    async findUserAndUpdatePasswordById(id, hashedPassword) {
        return await prisma.user.update({
            where: { id: id },
            data: {
                password: hashedPassword,
                isFirstLogin: false
            }
        });
    }

    async getStudentRecordsByIds(studentIds) {
        return await prisma.user.findMany({
            where: { id: { in: studentIds } }
        });
    }
}

module.exports = new UserRepository();
