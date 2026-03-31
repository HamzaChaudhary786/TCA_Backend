const prisma = require('../db/prisma');


class SubjectRepository {


    async findSubjectById(subjectId) {
        return await prisma.subject.findUnique({
            where: { id: subjectId }
        });
    }
}

module.exports = new SubjectRepository();
