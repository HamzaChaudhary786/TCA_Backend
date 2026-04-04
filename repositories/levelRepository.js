const prisma = require('../db/prisma');

class LevelRepository {
    async findLevelById(levelId) {
        return await prisma.level.findUnique({
            where: { id: levelId }
        });
    }
}

module.exports = new LevelRepository();
