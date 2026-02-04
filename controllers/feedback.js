const Feedback = require("../models/feedback");

exports.getUserFeedbacks = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const feedbacks = await Feedback.find({ userID }).populate(
      "userID",
      "name email"
    );
    res.status(200).json({ feedbacks });
  } catch (err) {
    next(err);
  }
};

exports.addFeedback = async (req, res, next) => {
  try {
    const { message } = req.body;
    const feedback = new Feedback({ userID: req.user._id, message });
    await feedback.save();
    res.status(201).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.acceptFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    const feedback = await Feedback.findById(feedbackID);
    feedback.accepted = true;
    await feedback.save();
    res.status(200).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.rejectFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    const feedback = await Feedback.findById(feedbackID);
    feedback.accepted = false;
    await feedback.save();
    res.status(200).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.deleteFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    await Feedback.findByIdAndDelete(feedbackID);
    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (err) {
    next(err);
  }
};
