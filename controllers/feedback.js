const prisma = require("../db/prisma");

exports.getUserFeedbacks = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const feedbacks = await prisma.feedback.findMany({
      where: { teacherID: userID },
      include: {
        submitter: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(200).json({ feedbacks });
  } catch (err) {
    next(err);
  }
};

exports.addFeedback = async (req, res, next) => {
  try {
    const { message, teacherID } = req.body;
    const feedback = await prisma.feedback.create({
      data: {
        userID: req.user.id,
        message,
        teacherID
      }
    });

    res.status(201).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.acceptFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    const feedback = await prisma.feedback.update({
      where: { id: feedbackID },
      data: { accepted: true }
    });
    res.status(200).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.rejectFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    const feedback = await prisma.feedback.update({
      where: { id: feedbackID },
      data: { accepted: false }
    });
    res.status(200).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.deleteFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    await prisma.feedback.delete({ where: { id: feedbackID } });
    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (err) {
    next(err);
  }
};
