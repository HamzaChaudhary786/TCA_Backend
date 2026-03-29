const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/user");

async function debug() {
    try {
        await mongoose.connect(process.env.MONGO_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });
        const admins = await User.find({ userType: "admin" }).select("name email");
        console.log("Admins:", JSON.stringify(admins, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
