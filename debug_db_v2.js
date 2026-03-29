const mongoose = require("mongoose");
require("dotenv").config();
const Feedback = require("./models/feedback");
const User = require("./models/user");

async function debug() {
    try {
        await mongoose.connect(process.env.MONGO_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to DB");

        const feedbacks = await Feedback.find({}).populate("teacherID", "name").populate("userID", "name");
        console.log(`\nTotal Feedbacks: ${feedbacks.length}`);

        feedbacks.forEach((f, i) => {
            console.log(`Feedback ${i + 1}:`);
            console.log(`  _id: ${f._id}`);
            console.log(`  Student: ${f.userID?.name || "Unknown"} (${f.userID?._id || "N/A"})`);
            console.log(`  Teacher: ${f.teacherID?.name || "N/A"} (${f.teacherID?._id || "N/A"})`);
            console.log(`  Message: ${f.message}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
