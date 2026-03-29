const Feedback = require("../models/feedback");

exports.getUserFeedbacks = async (req, res, next) => {
  try {
    const { userID } = req.params;
    console.log("--- DEBUG FEEDBACK GET ---");
    console.log("Fetching feedbacks for teacherID:", userID);

    const feedbacks = await Feedback.find({ teacherID: userID }).populate(
      "userID",
      "name email"
    );

    console.log("Found feedbacks:", feedbacks.length);
    console.log("--------------------------");
    res.status(200).json({ feedbacks });
  } catch (err) {
    next(err);
  }
};

exports.addFeedback = async (req, res, next) => {
  try {
    const { message, teacherID } = req.body;
    console.log("--- DEBUG FEEDBACK ADD ---");
    console.log("Adding feedback for teacherID:", teacherID);
    console.log("Message:", message);

    const feedback = new Feedback({ userID: req.user._id, message, teacherID });
    await feedback.save();

    console.log("Feedback saved.");
    console.log("--------------------------");
    res.status(201).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.acceptFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    console.log("--- DEBUG FEEDBACK ACCEPT ---");
    console.log("feedbackID:", feedbackID);
    const feedback = await Feedback.findById(feedbackID);
    if (!feedback) {
      console.log("Feedback not found");
      return res.status(404).json({ message: "Feedback not found" });
    }
    feedback.accepted = true;
    await feedback.save();
    console.log("Feedback accepted success");
    console.log("----------------------------");
    res.status(200).json({ feedback });
  } catch (err) {
    console.error("Error in acceptFeedback:", err);
    next(err);
  }
};

exports.rejectFeedback = async (req, res, next) => {
  try {
    const { feedbackID } = req.params;
    console.log("--- DEBUG FEEDBACK REJECT ---");
    console.log("feedbackID:", feedbackID);
    const feedback = await Feedback.findById(feedbackID);
    if (!feedback) {
      console.log("Feedback not found");
      return res.status(404).json({ message: "Feedback not found" });
    }
    feedback.accepted = false;
    await feedback.save();
    console.log("Feedback rejected success");
    console.log("----------------------------");
    res.status(200).json({ feedback });
  } catch (err) {
    console.error("Error in rejectFeedback:", err);
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
