const mongoose = require("mongoose");

exports.checkSubscription = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: "Unauthorized: User not found" });
        }

        // Allow super_admin access regardless of subscription
        if (user.userType === "super_admin") {
            return next();
        }

        // Check if subscription exists
        if (!user.subscription) {
            return res.status(403).json({ message: "Access denied: No subscription record found." });
        }

        // Check if subscription is active
        /* 
          Note: We can rely on isActive flag OR check expiresAt.
          If isActive is manually managed, we check that.
          If we want auto-expiry based on date, we check expiresAt.
          Let's check both or prioritize date. 
          The user request said: "if admin and other users paid fees monthly then access other wise notify your subscription expired"
        */

        const now = new Date();
        const expiresAt = user.subscription.expiresAt ? new Date(user.subscription.expiresAt) : null;

        if (user.subscription.isActive === false) {
            return res.status(403).json({ message: "Access denied: Subscription is inactive. Please renew." });
        }

        if (expiresAt && expiresAt < now) {
            return res.status(403).json({ message: "Access denied: Subscription expired. Please renew." });
        }

        // If active and not expired (or no expiration date set but active is true)
        next();

    } catch (error) {
        console.error("Subscription check error:", error);
        res.status(500).json({ message: "Internal server error during subscription validation" });
    }
};
