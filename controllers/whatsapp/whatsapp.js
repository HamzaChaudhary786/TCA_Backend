const axios = require("axios");
const prisma = require("../../db/prisma");

const WA_URL = "https://graph.facebook.com/v22.0/1059127047279632/messages";
const WHATSAPP_ACCESS_TOKEN = "EAAMjfiduOfMBQx7ZAcZC0gg9ZBFvkSVd1W0ut7ZCUYFPvRO0ciKTNbeeSwnuu0b8ZAZBG7529nZBN8ZCa4QXP7ZCJzbvqymbeDotXIj6dZCbAVqZCN0RoOkHlmFTX4vPryBqg1d6u3wpTX3BlQ8WySeVQL1o086kEu4hm8vUJ82mEExLxdvdapfgdZCreADUZBbTTBAZDZD";
const WEBHOOK_VERIFY_TOKEN = "myverifytoken";

// ─────────────────────────────────────────────
// Simple in-memory cache (5 min TTL)
// ─────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
    return entry.data;
}
function cacheSet(key, data) {
    _cache.set(key, { data, ts: Date.now() });
}

// ─────────────────────────────────────────────
// Shared Axios headers
// ─────────────────────────────────────────────
const WA_HEADERS = {
    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
};

// ─────────────────────────────────────────────
// GET - Webhook verification
// ─────────────────────────────────────────────
exports.getWebHook = (req, res) => {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const token = req.query["hub.verify_token"];
    return mode && token === WEBHOOK_VERIFY_TOKEN
        ? res.status(200).send(challenge)
        : res.sendStatus(403);
};

// ─────────────────────────────────────────────
// POST - Webhook handler
// ─────────────────────────────────────────────
exports.createWebHook = (req, res) => {
    const entry = req.body?.entry;
    if (!entry?.length) return res.status(400).send("Invalid Request");

    const value = entry[0]?.changes?.[0]?.value;
    if (!value) return res.status(400).send("Invalid Request");

    // ✅ Respond to Meta immediately — prevents retries & timeouts
    res.status(200).send("EVENT_RECEIVED");

    // Process asynchronously
    (async () => {
        try {
            if (value.statuses) return; // Ignore delivery/read receipts

            const messages = value.messages;
            if (!messages?.length) return;

            const msg = messages[0];
            const from = msg.from;
            const messageId = msg.id;

            // ── TEXT MESSAGES ──────────────────────────────
            if (msg.type === "text" && msg.text?.body) {
                const text = msg.text.body.trim().toLowerCase();

                // Email lookup
                if (text.includes("@")) {
                    const cacheKey = `email:${text}`;
                    let students = cacheGet(cacheKey);

                    if (!students) {
                        students = await prisma.user.findMany({
                            where: { userType: "student", guardianEmail: text },
                            include: { level: { select: { name: true } } }
                        });
                        // Map structure for compatibility
                        students = students.map(s => ({ ...s, id: s.id, levelID: s.level ? { name: s.level.name } : null }));
                        cacheSet(cacheKey, students);
                    }

                    return students.length > 0
                        ? replyStudentList(from, students, messageId)
                        : sendMessage(from, formatNotFound("email"));
                }

                // Greeting → phone lookup
                const greetings = ["hi", "hello", "hey", "menu", "start", "help"];
                if (greetings.includes(text)) {
                    const cacheKey = `phone:${from}`;
                    let students = cacheGet(cacheKey);

                    if (!students) {
                        students = await prisma.user.findMany({
                            where: { userType: "student", guardianPhoneNumber: from },
                            include: { level: { select: { name: true } } }
                        });
                        // Map structure for compatibility
                        students = students.map(s => ({ ...s, id: s.id, levelID: s.level ? { name: s.level.name } : null }));
                        cacheSet(cacheKey, students);
                    }

                    return students.length > 0
                        ? replyStudentList(from, students, messageId)
                        : sendMessage(from, formatNotFound("phone"));
                }

                // Unrecognized
                return sendMessage(from, formatHelp());
            }

            // ── INTERACTIVE MESSAGES ───────────────────────
            if (msg.type === "interactive") {
                const interactive = msg.interactive;

                // Student selected from list
                if (interactive.type === "list_reply") {
                    const studentID = interactive.list_reply.id;
                    return replyStudentOptions(from, studentID, messageId);
                }

                // Action button pressed
                if (interactive.type === "button_reply") {
                    const [action, studentID] = interactive.button_reply.id.split(":");

                    if (action === "attendance") {
                        await handleAttendance(from, studentID);
                    } else if (action === "assignment") {
                        await handleAssignments(from, studentID);
                    } else if (action === "quiz") {
                        await handleQuizzes(from, studentID);
                    }
                    return;
                }
            }
        } catch (err) {
            console.error("❌ Webhook error:", err);
            sendMessage(
                entry[0]?.changes?.[0]?.value?.messages?.[0]?.from,
                "⚠️ Something went wrong. Please try again later."
            );
        }
    })();
};

// ─────────────────────────────────────────────
// ATTENDANCE handler
// ─────────────────────────────────────────────
async function handleAttendance(from, studentID) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const records = await prisma.classAttendance.findMany({
        where: {
            studentID: studentID,
            class: { startTime: { gte: thirtyDaysAgo } }
        },
        include: {
            class: {
                include: { subject: true }
            }
        }
    });

    const subjectMap = new Map();
    for (const record of records) {
        if (!record.class || !record.class.subject) continue;
        const subjectName = record.class.subject.name;
        if (!subjectMap.has(subjectName)) {
            subjectMap.set(subjectName, { totalClasses: 0, presentCount: 0 });
        }
        const s = subjectMap.get(subjectName);
        s.totalClasses++;
        if (record.isPresent) s.presentCount++;
    }

    const data = Array.from(subjectMap.entries()).map(([name, stats]) => ({
        subjectName: name,
        totalClasses: stats.totalClasses,
        presentCount: stats.presentCount,
        attendancePercentage: stats.totalClasses === 0 ? 0 : (stats.presentCount / stats.totalClasses) * 100
    }));

    if (!data.length) {
        return sendMessage(from, "📭 No attendance data found for the last 30 days.");
    }

    const fmtDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const today = new Date();

    const rows = data.map((s) => {
        const pct = s.attendancePercentage.toFixed(1);
        const bar = attendanceBar(parseFloat(pct));
        const status = parseFloat(pct) >= 75 ? "✅" : parseFloat(pct) >= 50 ? "⚠️" : "❌";
        return `${status} *${s.subjectName}*\n` +
               `   ${bar} ${pct}%\n` +
               `   Present: ${s.presentCount} / ${s.totalClasses} classes`;
    }).join("\n\n");

    const message =
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *ATTENDANCE REPORT*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 ${fmtDate(thirtyDaysAgo)} → ${fmtDate(today)}\n\n` +
        `${rows}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ ≥75%  ⚠️ 50–74%  ❌ <50%`;

    sendMessage(from, message);
}

// ─────────────────────────────────────────────
// ASSIGNMENTS handler
// ─────────────────────────────────────────────
async function handleAssignments(from, studentID) {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const data = await getSubmissionData("assignment", studentID, fiveDaysAgo);

    if (!data.length) {
        return sendMessage(from, "📭 No assignments submitted in the last 5 days.");
    }

    const today = new Date();
    const rows = data.map((a) => formatSubmissionRow(a, "📝")).join("\n\n");

    const message =
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📂 *ASSIGNMENTS — LAST 5 DAYS*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 ${fmtShort(fiveDaysAgo)} → ${fmtShort(today)}\n\n` +
        `${rows}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`;

    sendMessage(from, message);
}

// ─────────────────────────────────────────────
// QUIZZES handler
// ─────────────────────────────────────────────
async function handleQuizzes(from, studentID) {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const data = await getSubmissionData("quiz", studentID, fiveDaysAgo);

    if (!data.length) {
        return sendMessage(from, "📭 No quizzes submitted in the last 5 days.");
    }

    const today = new Date();
    const rows = data.map((a) => formatSubmissionRow(a, "📋")).join("\n\n");

    const message =
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *QUIZZES — LAST 5 DAYS*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 ${fmtShort(fiveDaysAgo)} → ${fmtShort(today)}\n\n` +
        `${rows}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`;

    sendMessage(from, message);
}

// ─────────────────────────────────────────────
// Shared aggregation for Assignment / Quiz
// ─────────────────────────────────────────────
async function getSubmissionData(modelName, studentID, sinceDate) {
    const items = await prisma[modelName].findMany({
        where: {
            submissions: { some: { studentID: studentID, submittedAt: { gte: sinceDate } } }
        },
        include: {
            subject: true,
            submissions: { where: { studentID: studentID, submittedAt: { gte: sinceDate } } }
        }
    });

    return items.map(item => {
        const sub = item.submissions[0];
        return {
            title: item.title,
            dueDate: item.dueDate,
            totalMarks: item.totalMarks,
            subjectName: item.subject?.name,
            marksObtained: sub?.marks,
            grade: sub?.grade,
            feedback: sub?.feedback,
            isLate: sub?.isLate,
            submittedAt: sub?.submittedAt
        };
    });
}

// ─────────────────────────────────────────────
// WhatsApp message senders
// ─────────────────────────────────────────────
async function sendMessage(to, body) {
    if (!to || !body) return console.warn("sendMessage: missing params");

    try {
        await axios.post(WA_URL, {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body },
        }, { headers: WA_HEADERS });
    } catch (err) {
        console.error("❌ sendMessage failed:", err.response?.data || err.message);
    }
}

async function replyStudentList(to, students, messageId) {
    if (!to || !students?.length) return;

    const rows = students.slice(0, 10).map((s) => ({
        id: `${s._id}`,
        title: s.name,
        description: s.levelID?.name ? `🎓 Level: ${s.levelID.name}` : "Level not assigned",
    }));

    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "list",
            header: { type: "text", text: "👨‍👩‍👧 Student Portal" },
            body: {
                text: `We found *${students.length}* student(s) linked to your account.\n\nPlease select a student to continue:`,
            },
            footer: { text: "📲 Tap a name to view their report" },
            action: {
                button: "📋 View Students",
                sections: [{ title: "Linked Students", rows }],
            },
        },
    };

    if (messageId) payload.context = { message_id: messageId };

    try {
        await axios.post(WA_URL, payload, { headers: WA_HEADERS });
    } catch (err) {
        console.error("❌ replyStudentList failed:", err.response?.data || err.message);
    }
}

async function replyStudentOptions(to, studentID, messageId) {
    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            header: { type: "text", text: "📚 Student Dashboard" },
            body: {
                text: "What would you like to check?\n\nChoose a report from the options below:",
            },
            footer: { text: "Select a category to get the latest data" },
            action: {
                buttons: [
                    { type: "reply", reply: { id: `attendance:${studentID}`, title: "📊 Attendance" } },
                    { type: "reply", reply: { id: `assignment:${studentID}`, title: "📂 Assignments" } },
                    { type: "reply", reply: { id: `quiz:${studentID}`, title: "📝 Quizzes" } },
                ],
            },
        },
    };

    if (messageId) payload.context = { message_id: messageId };

    try {
        await axios.post(WA_URL, payload, { headers: WA_HEADERS });
    } catch (err) {
        console.error("❌ replyStudentOptions failed:", err.response?.data || err.message);
    }
}

// ─────────────────────────────────────────────
// Admin Broadcast
// ─────────────────────────────────────────────
exports.sendAdminBroadcast = async (req, res) => {
    try {
        const message = req.body.message || "🏫 School is OFF today due to weather conditions. Stay safe!";

        const guardians = await prisma.user.findMany({
            where: { userType: "student" },
            select: { guardianPhoneNumber: true }
        });

        const uniquePhones = [...new Set(guardians.map((g) => g.guardianPhoneNumber).filter(Boolean))];

        if (!uniquePhones.length) return res.status(404).send("No guardians found.");

        // Send in parallel batches of 10 to avoid rate limits
        const BATCH = 10;
        for (let i = 0; i < uniquePhones.length; i += BATCH) {
            const batch = uniquePhones.slice(i, i + BATCH);
            await Promise.all(batch.map((phone) => sendMessage(phone, message)));
        }

        res.status(200).json({ success: true, sent: uniquePhones.length });
    } catch (err) {
        console.error("❌ Broadcast Error:", err);
        res.status(500).json({ success: false, message: "Broadcast failed." });
    }
};

// ─────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────
function fmtShort(date) {
    return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function attendanceBar(pct) {
    const filled = Math.round(pct / 10);
    return "▓".repeat(filled) + "░".repeat(10 - filled);
}

function formatSubmissionRow(a, icon) {
    const scorePercent = a.totalMarks ? ((a.marksObtained / a.totalMarks) * 100).toFixed(0) : null;
    const gradeLabel = a.grade ? ` | Grade: *${a.grade}*` : "";
    const lateTag = a.isLate ? "\n   ⏰ _Late submission_" : "";
    const feedbackLine = a.feedback ? `\n   💬 _${a.feedback}_` : "";

    return (
        `${icon} *${a.title}*\n` +
        `   📚 ${a.subjectName}\n` +
        `   📅 Due: ${fmtShort(a.dueDate)}  •  Submitted: ${fmtShort(a.submittedAt)}\n` +
        `   ✅ Score: *${a.marksObtained}/${a.totalMarks}*${scorePercent ? ` (${scorePercent}%)` : ""}${gradeLabel}` +
        lateTag +
        feedbackLine
    );
}

function formatNotFound(type) {
    return (
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔍 *No Students Found*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        (type === "email"
            ? `No students are linked to this email address.\n\nPlease check the email and try again, or contact your school administrator.`
            : `No students are linked to this phone number.\n\nTry sending your registered email address instead.`) +
        `\n\n_Type *help* to see all options_`
    );
}

function formatHelp() {
    return (
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏫 *School Parent Portal*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `How to get started:\n\n` +
        `👋 Type *hi* — Find students by your phone number\n` +
        `📧 Send your *email* — Find students by email address\n\n` +
        `_Example: hello@gmail.com_\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
}