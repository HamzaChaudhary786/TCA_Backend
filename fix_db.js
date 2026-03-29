const mongoose = require("mongoose");
require("dotenv").config();
const Feedback = require("./models/feedback");

async function fixData() {
    try {
        await mongoose.connect(process.env.MONGO_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to DB");

        const aminaID = "697c964e8cef931d30d8795a";
        const maryamID = "69832453885c8e4874bb3b17";

        // Fix feedbacks with undefined teacherID
        const f2 = await Feedback.findById("69a85dd03d7aaa344c7f2c14");
        if (f2 && !f2.teacherID) {
            f2.teacherID = aminaID;
            await f2.save();
            console.log("Fixed Feedback 2 (Amina)");
        }

        const f3 = await Feedback.findById("69aa683f47df971d b0a0ba7b".replace(" ", "")); // Clean space if any
        if (f3 && !f3.teacherID) {
            f3.teacherID = aminaID;
            await f3.save();
            console.log("Fixed Feedback 3 (Amina)");
        }

        const f4 = await Feedback.findById("69aa6dbea3b3573a28990053");
        if (f4 && !f4.teacherID) {
            f4.teacherID = maryamID;
            await f4.save();
            console.log("Fixed Feedback 4 (Maryam)");
        }

        console.log("Fix complete.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixData();
