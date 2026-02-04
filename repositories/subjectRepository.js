

const Subject = require('../models/subject');


class SubjectRepository {


    async findSubjectById(subjectId) {
        return await Subject.findById(subjectId);
    }
}

module.exports = new SubjectRepository();
