const prisma = require("../db/prisma");

exports.extendSubscription = async (req, res, next) => {
    try {
        const { userId, months } = req.body;

        if (!userId || !months) {
            return res.status(400).send({ message: "User ID and months are required" });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }

        // Calculate new expiry date
        let newExpiry = new Date();
        if (user.subscriptionActive && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > newExpiry) {
            newExpiry = new Date(user.subscriptionExpiresAt);
        }

        newExpiry.setMonth(newExpiry.getMonth() + parseInt(months));

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                subscriptionActive: true,
                subscriptionExpiresAt: newExpiry,
                feesPaid: true
            }
        });

        res.send({
            message: "Subscription extended successfully",
            subscription: {
                isActive: updatedUser.subscriptionActive,
                expiresAt: updatedUser.subscriptionExpiresAt
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getSubscriptionStatus = async (req, res, next) => {
    try {
        const user = req.user; // From middleware
        res.send({
            subscription: {
                isActive: user.subscriptionActive,
                expiresAt: user.subscriptionExpiresAt
            },
            isExpired: user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) < new Date() : true
        });
    } catch (error) {
        next(error);
    }
};
