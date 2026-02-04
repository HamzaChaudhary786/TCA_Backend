const StudentPromote = require('../models/studentPromote');

const createStudentPromotion = async (req, res) => {
  try {
    const {
      sourceClassroom,
      sourceLevel,
      targetClassroom,
      targetLevel,
      promotorDescription,
      students
    } = req.body;

    const currUser = req.user;

    const newPromotion = new StudentPromote({
      sourceClassroom,
      sourceLevel,
      targetClassroom,
      targetLevel,
      promotorName: currUser?.name || "Unknown",
      promotorDate: new Date(),
      promotorDescription,
      isApproved: false, // default false
      students
    });

    const savedPromotion = await newPromotion.save();
    res.status(201).json({ success: true, data: savedPromotion });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = createStudentPromotion;
