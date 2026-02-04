const User = require("../models/user");
const mongoose = require("mongoose");

exports.extendSubscription = async (req, res, next) => {
    try {
        const { userId, months } = req.body;

        if (!userId || !months) {
            return res.status(400).send({ message: "User ID and months are required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }

        // Calculate new expiry date
        let newExpiry = new Date();
        if (user.subscription && user.subscription.expiresAt && new Date(user.subscription.expiresAt) > newExpiry) {
            newExpiry = new Date(user.subscription.expiresAt);
        }

        newExpiry.setMonth(newExpiry.getMonth() + parseInt(months));

        user.subscription = {
            isActive: true,
            expiresAt: newExpiry
        };

        // If we want to sync with feesPaid (deprecated check but good for backward compat)
        user.feesPaid = true;

        await user.save();

        res.send({
            message: "Subscription extended successfully",
            subscription: user.subscription
        });

    } catch (error) {
        next(error);
    }
};

exports.getSubscriptionStatus = async (req, res, next) => {
    try {
        const user = req.user; // From middleware
        res.send({
            subscription: user.subscription,
            isExpired: user.subscription.expiresAt ? new Date(user.subscription.expiresAt) < new Date() : true
        });
    } catch (error) {
        next(error);
    }
};
