const axios = require("axios")
const mongoose = require("mongoose");
const User = require("../../models/user");
const Class = require("../../models/class");
const Assignment = require("../../models/assignment");
const Quiz = require("../../models/quiz")
const url = "https://graph.facebook.com/v23.0/678020068725286/messages";

const WHATSAPP_ACCESS_TOKEN =
    "EAAUCGLXYi5wBOZCIAZBuXaqxz8vSwck2TC2AZAyszj3jPqN68z3ZCe6nCkrEvu9uJJBbvBNsaYQefWmWlN5eQZChMRTLhgwUl0mZC06J0b5VAKuh3aDbRnjxD6nc6j5BxbXIbYDaEk0ZChVvhH2ODTSPxo1YO4vRN8ozCT4uTgWXpv5QGnNdoQ7FJ67RqHLObeU";

const WEBHOOK_VERIFY_TOKEN = "EAAUCGLXYi5wBOZCIAZEAAUCGLXYi5wBOZCIAZ";

exports.getWebHook = async (req, res) => {
    console.log("webhook endpoint hit", req.query);
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const token = req.query["hub.verify_token"];

    if (mode && token === WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
};

exports.createWebHook = async (req, res) => {
    console.log("Webhook triggered: createWebHook");

    const { entry } = req.body;
    if (!entry?.length) return res.status(400).send("Invalid Request: Missing entry");

    const changes = entry[0].changes;
    if (!changes?.length) return res.status(400).send("Invalid Request: Missing changes");

    const value = changes[0].value;
    const statuses = value.statuses || null;
    const messages = value.messages || null;

    // const User = req.clientInfo.tenantDB.models.User;
    // const Class = req.clientInfo.tenantDB.models.Class;
    // const Assignment = req.clientInfo.tenantDB.models.Assignment;
    // const Quiz = req.clientInfo.tenantDB.models.Quiz;

    try {
        if (statuses) {
            console.log(`MESSAGE STATUS UPDATED:\nID: ${statuses[0].id}\nSTATUS: ${statuses[0].status}`);
            return res.status(200).send("Status handled");
        }

        if (!messages?.length) return res.status(200).send("No messages to process");

        const msg = messages[0];

        console.log(msg, "parent send message of response");

        const from = msg.from;
        const messageId = msg?.id;
        if (msg.type === "text" && msg.text?.body) {
            const text = msg.text.body.trim().toLowerCase();

            // Case 1: If it's an email, search by email
            if (text.includes("@")) {
                const email = text;
                const students = await User.find({ userType: "student", guardianEmail: email }).populate("levelID", "name");

                if (students.length > 0) {
                    await replyStudentList(from, students, messageId);
                } else {
                    await sendMessage(from, "No students found for this email.");
                }

                return res.status(200).send("Text message (email) processed");
            }



            // Case 2: If it's a greeting like 'hi' or 'hello', search by guardianPhoneNumber
            const greetings = ["hi", "hello", "hey"];
            if (greetings.includes(text)) {
                const students = await User.find({ userType: "student", guardianPhoneNumber: from }).populate("levelID", "name");

                console.log(students, "hahahhahahahah");


                if (students.length > 0) {
                    await replyStudentList(from, students, messageId);
                } else {
                    await sendMessage(from, "No students found for this phone number.");
                }

                return res.status(200).send("Text message (phone) processed");
            }

            // Optional: handle unrecognized messages
            await sendMessage(from, "Please enter a valid email or type 'hi' to fetch students by phone number.");
            return res.status(200).send("Unrecognized text processed");
        }


        if (msg.type === "interactive") {
            const interactive = msg.interactive;

            if (interactive.type === "list_reply") {
                const studentID = interactive.list_reply.id;

                // Step 2: Respond with 3 options: Attendance, Assignments, Quizzes
                await replyStudentOptions(from, studentID, messageId);
                return res.status(200).send("Student selected, showing options");
            }

            if (interactive.type === "button_reply") {
                const [action, studentID] = interactive.button_reply.id.split(":");

                if (action === "attendance") {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                    const data = await Class.aggregate([
                        {
                            $match: {
                                "attendance.studentID": new mongoose.Types.ObjectId(studentID),
                                startTime: { $gte: thirtyDaysAgo }, // or use startEventDate if that's more appropriate
                            },
                        },
                        { $unwind: "$attendance" },
                        {
                            $match: {
                                "attendance.studentID": new mongoose.Types.ObjectId(studentID),
                            },
                        },
                        {
                            $group: {
                                _id: "$subjectID",
                                totalClasses: { $sum: 1 },
                                presentCount: {
                                    $sum: {
                                        $cond: [{ $eq: ["$attendance.isPresent", true] }, 1, 0],
                                    },
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: "subjects",
                                localField: "_id",
                                foreignField: "_id",
                                as: "subjectInfo",
                            },
                        },
                        { $unwind: "$subjectInfo" },
                        {
                            $project: {
                                _id: 0,
                                subjectId: "$_id",
                                subjectName: "$subjectInfo.name",
                                totalClasses: 1,
                                presentCount: 1,
                                attendancePercentage: {
                                    $cond: [
                                        { $eq: ["$totalClasses", 0] },
                                        0,
                                        {
                                            $multiply: [
                                                { $divide: ["$presentCount", "$totalClasses"] },
                                                100,
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    ]);


                    if (data.length === 0) {
                        await sendMessage(from, "No attendance data found for this student in the last 30 days.");
                    } else {
                        const today = new Date();
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(today.getDate() - 30);

                        const formatDate = (date) => {
                            return date.toISOString().split("T")[0]; // YYYY-MM-DD format
                        };

                        const summary = data
                            .map(
                                (s, index) =>
                                    `📘 *${s.subjectName}*\n📅 Total Classes: ${s.totalClasses}\n✅ Present: ${s.presentCount}\n📊 Attendance: *${s.attendancePercentage.toFixed(1)}%*`
                            )
                            .join("\n\n");

                        const message = `📅 *Attendance Report*\n🧑‍🎓 *Last 30 Days Summary*\n\n📆 From: *${formatDate(thirtyDaysAgo)}*\n📆 To: *${formatDate(today)}*\n\n${summary}`;

                        await sendMessage(from, message);
                    }


                    return res.status(200).send("Attendance data sent");
                }

                if (action === "assignment") {
                    const fiveDaysAgo = new Date();
                    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

                    const data = await Assignment.aggregate([
                        {
                            $match: {
                                "submissions.studentID": new mongoose.Types.ObjectId(studentID),
                                "submissions.submittedAt": { $gte: fiveDaysAgo },
                            },
                        },
                        { $unwind: "$submissions" },
                        {
                            $match: {
                                "submissions.studentID": new mongoose.Types.ObjectId(studentID),
                                "submissions.submittedAt": { $gte: fiveDaysAgo },
                            },
                        },
                        {
                            $lookup: {
                                from: "subjects",
                                localField: "subjectID",
                                foreignField: "_id",
                                as: "subjectInfo",
                            },
                        },
                        { $unwind: "$subjectInfo" },
                        {
                            $project: {
                                _id: 0,
                                title: 1,
                                dueDate: 1,
                                totalMarks: 1,
                                subjectName: "$subjectInfo.name",
                                marksObtained: "$submissions.marks",
                                grade: "$submissions.grade",
                                feedback: "$submissions.feedback",
                                isLate: "$submissions.isLate",
                                submittedAt: "$submissions.submittedAt",
                            },
                        },
                    ]);

                    if (data.length === 0) {
                        await sendMessage(from, "No assignments submitted by this student in the last 5 days.");
                    } else {
                        const formatDate = (date) => new Date(date).toLocaleDateString();

                        const summary = data
                            .map((a) =>
                                `📚 *${a.title}* (${a.subjectName})\n📆 Due: ${formatDate(a.dueDate)}\n📥 Submitted: ${formatDate(a.submittedAt)}\n✅ Marks: ${a.marksObtained}/${a.totalMarks}\n📝 Grade: ${a.grade || "N/A"}\n${a.isLate ? "⏰ *Late Submission*" : ""}\n${a.feedback ? "💬 Feedback: " + a.feedback : ""}`
                            )
                            .join("\n\n");

                        const today = new Date();
                        const message = `📂 *Assignment Summary (Last 5 Days)*\n🗓️ ${fiveDaysAgo.toISOString().split("T")[0]} ➡️ ${today.toISOString().split("T")[0]}\n\n${summary}`;

                        await sendMessage(from, message);
                    }

                    return res.status(200).send("Assignment data sent");
                }



                if (action === "quiz") {
                    const fiveDaysAgo = new Date();
                    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

                    const data = await Quiz.aggregate([
                        {
                            $match: {
                                "submissions.studentID": new mongoose.Types.ObjectId(studentID),
                                "submissions.submittedAt": { $gte: fiveDaysAgo },
                            },
                        },
                        { $unwind: "$submissions" },
                        {
                            $match: {
                                "submissions.studentID": new mongoose.Types.ObjectId(studentID),
                                "submissions.submittedAt": { $gte: fiveDaysAgo },
                            },
                        },
                        {
                            $lookup: {
                                from: "subjects",
                                localField: "subjectID",
                                foreignField: "_id",
                                as: "subjectInfo",
                            },
                        },
                        { $unwind: "$subjectInfo" },
                        {
                            $project: {
                                _id: 0,
                                title: 1,
                                dueDate: 1,
                                totalMarks: 1,
                                subjectName: "$subjectInfo.name",
                                marksObtained: "$submissions.marks",
                                grade: "$submissions.grade",
                                feedback: "$submissions.feedback",
                                isLate: "$submissions.isLate",
                                submittedAt: "$submissions.submittedAt",
                            },
                        },
                    ]);

                    if (data.length === 0) {
                        await sendMessage(from, "No quiz submitted by this student in the last 5 days.");
                    } else {
                        const formatDate = (date) => new Date(date).toLocaleDateString();

                        const summary = data
                            .map((a) =>
                                `📚 *${a.title}* (${a.subjectName})\n📆 Due: ${formatDate(a.dueDate)}\n📥 Submitted: ${formatDate(a.submittedAt)}\n✅ Marks: ${a.marksObtained}/${a.totalMarks}\n📝 Grade: ${a.grade || "N/A"}\n${a.isLate ? "⏰ *Late Submission*" : ""}\n${a.feedback ? "💬 Feedback: " + a.feedback : ""}`
                            )
                            .join("\n\n");

                        const today = new Date();
                        const message = `📂 *Quiz Summary (Last 5 Days)*\n🗓️ ${fiveDaysAgo.toISOString().split("T")[0]} ➡️ ${today.toISOString().split("T")[0]}\n\n${summary}`;

                        await sendMessage(from, message);
                    }

                    return res.status(200).send("Quiz data sent");
                }
            }
        }

        console.log("Unhandled message type:", JSON.stringify(msg, null, 2));
        return res.status(200).send("Message type not handled");
    } catch (err) {
        console.error("Webhook error:", err);
        await sendMessage(messages?.[0]?.from, "❌ An error occurred while processing your request.");
        return res.status(500).send("Internal Server Error");
    }
};

async function replyStudentList(to, students, messageId) {


    if (!to || !Array.isArray(students) || students.length === 0) {
        console.warn("Invalid input: 'to' or 'students' is missing or empty.");
        return;
    }

    try {
        const rows = students.map((student) => ({
            id: `${student._id}`,
            title: student.name,
            description: student.levelID?.name ? `Level: ${student.levelID.name}` : "No level assigned",
        }));

        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive: {
                type: "list",
                body: {
                    text: `Found ${students.length} student(s) linked to this parent. Please select one:`,
                },
                footer: {
                    text: "Tap a student to view more details.",
                },
                action: {
                    button: "View Students",
                    sections: [
                        {
                            title: "Linked Students",
                            rows,
                        },
                    ],
                },
            },
        };

        if (messageId) {
            payload.context = { message_id: messageId };
        }

        const headers = {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        };

        await axios.post(url, payload, { headers });

        console.log(`✅ List message sent to ${to} with ${students.length} student(s).`);
    } catch (error) {
        console.error("❌ Failed to send list message:", error.response?.data || error.message);
    }
}

async function sendMessage(to, body) {
    if (!to || !body) {
        console.warn("sendMessage: Missing 'to' or 'body' parameter.");
        return;
    }

    const headers = {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
    };

    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
    };

    try {
        await axios.post(url, payload, { headers });
        console.log(`✅ Text message sent to ${to}`);
    } catch (error) {
        console.error("❌ Error sending message:", error.response?.data || error.message);
    }
}



async function replyStudentOptions(to, studentID, messageId) {
    const headers = {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
    };

    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: "Please choose what you'd like to view for the student:",
            },
            action: {
                buttons: [
                    {
                        type: "reply",
                        reply: {
                            id: `attendance:${studentID}`,
                            title: "📊 Attendance",
                        },
                    },
                    {
                        type: "reply",
                        reply: {
                            id: `assignment:${studentID}`,
                            title: "📂 Assignments",
                        },
                    },
                    {
                        type: "reply",
                        reply: {
                            id: `quiz:${studentID}`,
                            title: "📝 Quizzes",
                        },
                    },
                ],
            },
        },
    };

    if (messageId) {
        payload.context = { message_id: messageId };
    }

    try {
        await axios.post(url, payload, { headers });
        console.log(`✅ Student options sent to ${to}`);
    } catch (error) {
        console.error("❌ Failed to send student options:", error.response?.data || error.message);
    }
}






exports.sendAdminBroadcast = async (req, res) => {
    try {
        const message = req.body.message || "🏫 Today school is OFF due to weather conditions.";

        const User = req.clientInfo.tenantDB.models.User;

        const guardians = await User.find({ userType: "student" }).select("guardianPhoneNumber");

        const uniquePhones = [...new Set(guardians.map((g) => g.guardianPhoneNumber).filter(Boolean))];

        if (uniquePhones.length === 0) {
            return res.status(404).send("No guardians found.");
        }

        for (const phone of uniquePhones) {
            await sendMessage(phone, message); // Reuse your existing function
        }

        res.status(200).send(`Message sent to ${uniquePhones.length} guardians.`);
    } catch (err) {
        console.error("Broadcast Error:", err);
        res.status(500).send("Failed to send broadcast message.");
    }
};





