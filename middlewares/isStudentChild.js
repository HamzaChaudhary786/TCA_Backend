const User = require("../models/user");

exports.isStudentChild = async (req, res, next) => {
  try {
    const studentID = req.params.studentID;

    const foundUser = await User.findOne({
      _id: studentID,
      guardianEmail: req.user.email,
    });
    if (!foundUser) {
      return res.status(400).json({ message: "Student does not exist" });
    }

    next();
  } catch (err) {
    next(err);
  }
};
