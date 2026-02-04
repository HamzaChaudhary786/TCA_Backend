const { addHeadAttendanceSetting, updateHeadAttendanceSetting, getSettings } = require("../controllers/settingsController");

const router = require("express").Router();


router.post("/add-head-attendence-setting", addHeadAttendanceSetting);
router.put("/update-head-attendence-setting", updateHeadAttendanceSetting);
router.get("/get-head-attendence-setting", getSettings);




module.exports = router;
