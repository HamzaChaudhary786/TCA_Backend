const express = require("express");
const router = express.Router();
const feeController = require("../controllers/feeController");
const { checkLoggedIn } = require("../middlewares/checkLoggedIn");

// Only Admin can generate and update fees
router.post("/generate", checkLoggedIn, feeController.generateFees);
router.put("/:feeID", checkLoggedIn, feeController.updateFeeStatus);
router.delete("/:feeID", checkLoggedIn, feeController.deleteFee);

// Retrieve fees
router.get("/all", checkLoggedIn, feeController.getAllFees);
router.get("/student/:studentID", checkLoggedIn, feeController.getStudentFees);

module.exports = router;
