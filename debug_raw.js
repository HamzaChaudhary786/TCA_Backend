const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

async function debugRaw() {
    const client = new MongoClient(process.env.MONGO_CONNECTION);
    try {
        await client.connect();
        console.log("Connected to MongoDB Raw");
        const db = client.db(); // Uses the default DB from connection string
        const feedbacks = await db.collection("feedbacks").find({}).toArray();

        console.log(`Total Raw Feedbacks: ${feedbacks.length}`);
        feedbacks.forEach((f, i) => {
            console.log(`Feedback ${i + 1}:`);
            console.log(`  _id: ${f._id}`);
            console.log(`  teacherID: ${f.teacherID} (type: ${typeof f.teacherID})`);
            console.log(`  message: ${f.message}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

debugRaw();
