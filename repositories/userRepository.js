const User = require('../models/user');


class UserRepository {

    async findUserAndUpdatePasswordById(id, hashedPassword) {
        return await User.findByIdAndUpdate(
            id,
            {
                password: hashedPassword,
                isFirstLogin: false
            },
            { new: true }
        );
    }
    async getStudentRecordsByIds(studentIds) {
        return await User.find({ _id: { $in: studentIds } });
    }

}

module.exports = new UserRepository();
