exports.getUserActivities = async (req, res) => {
  const { userID } = req.params;
  const activities = await Activity.find({ userID });
  res.status(200).json({ activities });
};
