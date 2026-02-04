const Level = require('../models/level');


class LevelRepository {

    async findLevelById(levelId) {
        return await Level.findById(levelId);
    }
}

module.exports = new LevelRepository();
