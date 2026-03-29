const express = require("express");
const router = express.Router();
const statsController = require("../controllers/stats");
const { checkLoggedIn } = require("../middlewares/checkLoggedIn");

router.get("/system-overview", checkLoggedIn, statsController.getSystemOverviewStats);

module.exports = router;
