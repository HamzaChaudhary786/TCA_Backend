const User = require("../models/user");
const moment = require("moment");

exports.getSystemOverviewStats = async (req, res, next) => {
    try {
        // Last 12 months including current month
        const startOfPeriod = moment().subtract(11, "months").startOf("month");

        const aggregation = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfPeriod.toDate() },
                    userType: { $in: ["student", "teacher", "parent"] },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" },
                        userType: "$userType",
                    },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Initialize the last 12 months with 0 counts
        const months = [];
        for (let i = 0; i < 12; i++) {
            const date = moment().subtract(11 - i, "months");
            months.push({
                name: date.format("MMM"),
                fullDate: date.format("YYYY-MM"),
                monthIndex: date.month() + 1, // $month is 1-indexed
                year: date.year(),
                Students: 0,
                Teachers: 0,
                Parents: 0,
            });
        }

        // Fill in the counts from aggregation
        aggregation.forEach((item) => {
            const monthData = months.find(
                (m) => m.monthIndex === item._id.month && m.year === item._id.year
            );
            if (monthData) {
                if (item._id.userType === "student") monthData.Students = item.count;
                else if (item._id.userType === "teacher") monthData.Teachers = item.count;
                else if (item._id.userType === "parent") monthData.Parents = item.count;
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
