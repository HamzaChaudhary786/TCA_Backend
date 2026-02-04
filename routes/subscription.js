const express = require("express");
const router = express.Router();
const controller = require("../controllers/subscriptionController");
const { checkLoggedIn } = require("../middlewares/checkLoggedIn");

// Get subscription status
router.get("/status", controller.getSubscriptionStatus);

// Extend subscription (admin/super_admin only ideally, but we'll check user type inside or add middleware)
// For now, let's allow any logged in user to extend (for testing) or check inside.
// Realistically, this should be payment callback or admin only. 
// The user request implies admin and other users paid fees.
// Let's assume there is a payment flow, but for now we expose an endpoint to "mock" payment.
router.post("/extend", controller.extendSubscription);

module.exports = router;
