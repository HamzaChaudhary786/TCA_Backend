const prisma = require("../db/prisma");
const moment = require("moment");

exports.getSystemOverviewStats = async (req, res, next) => {
    try {
        // Last 12 months including current month
        const startOfPeriod = moment().subtract(11, "months").startOf("month");

        const users = await prisma.user.findMany({
            where: {
                createdAt: { gte: startOfPeriod.toDate() },
                userType: { in: ["student", "teacher", "parent"] }
            },
            select: { createdAt: true, userType: true }
        });

        // Initialize the last 12 months with 0 counts
        const months = Array.from({ length: 12 }, (_, i) => {
            const date = moment().subtract(11 - i, "months");
            return {
                name: date.format("MMM"),
                monthIndex: date.month() + 1,
                year: date.year(),
                Students: 0,
                Teachers: 0,
                Parents: 0,
            };
        });

        // Fill in the counts from memory
        users.forEach((user) => {
            const date = moment(user.createdAt);
            const mIndex = date.month() + 1;
            const mYear = date.year();
            
            const monthData = months.find(m => m.monthIndex === mIndex && m.year === mYear);
            if (monthData) {
                if (user.userType === "student") monthData.Students++;
                else if (user.userType === "teacher") monthData.Teachers++;
                else if (user.userType === "parent") monthData.Parents++;
            }
        });

        // Clean up helper fields before sending
        const result = months.map(({ name, Students, Teachers, Parents }) => ({
            name,
            Students,
            Teachers,
            Parents,
        }));

        res.status(200).send(result);
    } catch (error) {
        next(error);
    }
};
