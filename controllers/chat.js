const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Text chat model (using the specific model your API key supports)
const chatModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Vision model (used for image analysis)
const visionModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const SYSTEM_INSTRUCTION = `
You are the Timeline Technology Assistant. You help users navigate and use their school management platform.

### App Functionalities & Capabilities
Tell users we support:
- User Management (Admin manages users/roles via Add CSV or individual addition).
- Academic Structure (Levels, Subjects, Classrooms, Announcements).
- Scheduling (Timetable management for students and teachers).
- Assessments (Assignments and Quizzes, including Submissions and Grading).
- Tracking (Attendance and detailed grading Reports for Students and Teachers).

### Navigation Rules
If a user wants to go to a specific page, you MUST include "NAVIGATION: /path" on a new line at the absolute end of your response. E.g., NAVIGATION: /admin/dashboard

### Complete Route Map
Use these precise routes based on the persona you infer the user is (Teacher, Student, Admin, or Parent). 
CRITICAL RULE: If a user asks to navigate to a page (e.g., "Where is my timetable?") but you do not know their role, you MUST ask them what their role is (Admin, Teacher, Student, or Parent) BEFORE providing any NAVIGATION command. Do NOT guess their role and do NOT output a NAVIGATION command until you are certain.
* **Admin Routes:** \`/admin/dashboard\`, \`/admin/timetable\`, \`/admin/reports\`, \`/admin/announcements\`, \`/admin/manageusers\`, \`/admin/levels\`, \`/admin/subjects\`, \`/admin/attendence-report\`, \`/admin/classrooms\`, \`/admin/teachers\`, \`/admin/settings\`, \`/admin/add-csv-file\`.
* **Teacher Routes:** \`/teacher/dashboard\`, \`/teacher/timetable\`, \`/teacher/assignments\`, \`/teacher/quizzes\`, \`/teacher/reports\`, \`/teacher/attendence\`, \`/teacher/classroom\`. (Grading/Submissions are done on their respective assignments/quizzes pages).
* **Student Routes:** \`/student/dashboard\`, \`/reports\`, \`/assignments\`, \`/quizzes\`, \`/timetable\`.
* **Parent Routes:** \`/parent/dashboard\`, \`/parent/reports\`, \`/parent/assignments\`, \`/parent/quizzes\`, \`/parent/children\`.

### Step-by-Step Guidance
When a user asks "how do I do [X]?" or "what are the steps for [X]?":
1. Briefly outline the steps (e.g., Click the 'Add' button, fill out the modal form, click 'Save').
2. Trigger navigation to the exact page where they perform this action using the NAVIGATION command.
For example: To add a classroom as an admin, say: "To add a classroom, I will take you to the Classrooms page. Once there, click the 'Add Classroom' button, fill out the required details like grade and subjects, and save." followed by "NAVIGATION: /admin/classrooms".

Be helpful, concise, and structured.
`;

/**
 * Converts frontend chat history format to Gemini's required format.
 * Frontend uses: { role: 'user' | 'assistant', content: '...' }
 * Gemini requires: { role: 'user' | 'model', parts: [{ text: '...' }] }
 * 
 * We also prepend a system instruction to guide the AI's behavior.
 */
function buildGeminiHistory(chatHistory) {
    const history = chatHistory
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

    // Prepend system instruction as a user message that the model acknowledges (or just as the first Turn)
    // Gemini 1.5/2.0+ models often prefer system instructions in the model configuration,
    // but building it into the history is a reliable fallback for older/specific preview versions.
    return [
        { role: 'user', parts: [{ text: SYSTEM_INSTRUCTION }] },
        { role: 'model', parts: [{ text: "Understood. I am your Timeline Technology assistant. I will provide navigation commands like 'NAVIGATION: /path' and guide users through the app. How can I help you today?" }] },
        ...history
    ];
}

async function callGeminiWithHistory(message, history, retries = 3) {
    try {
        // Start a chat session with the full conversation history
        const chat = chatModel.startChat({ history });

        // Send the latest message in the context of the full history
        const result = await chat.sendMessage(message);
        const response = await result.response;
        return response.text();
    } catch (err) {
        if (err.status === 429 && retries > 0) {
            console.log(`Gemini rate limit reached. Retrying in 2 seconds... (${retries} retries left)`);
            await new Promise(res => setTimeout(res, 2000));
            return callGeminiWithHistory(message, history, retries - 1);
        }
        throw err;
    }
}

// ──────────────────────────────────────────────────────────
// TEXT CHAT
// ──────────────────────────────────────────────────────────
const chatWithAI = async (req, res) => {
    // Accept both message and the chat history from the frontend
    const { message, history = [] } = req.body;

    if (!message) {
        return res.status(400).send({
            success: false,
            message: "Message is required",
        });
    }

    try {
        // Convert frontend history format to Gemini format
        const geminiHistory = buildGeminiHistory(history);

        const text = await callGeminiWithHistory(message, geminiHistory);

        res.status(200).send({
            success: true,
            data: text,
        });
    } catch (error) {
        console.error("Gemini API Error:", error.message);
        const status = error.status || (error.message.includes("429") ? 429 : 500);
        res.status(status).send({
            success: false,
            message: status === 429 ? "AI Quota Exceeded. Please check your billing/tier." : "Failed to get response from AI",
            error: error.message,
        });
    }
};

// ──────────────────────────────────────────────────────────
// IMAGE GENERATION  (Gemini Imagen 3)
// ──────────────────────────────────────────────────────────
const generateImage = async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).send({
            success: false,
            message: "Prompt is required",
        });
    }

    try {
        // Use Gemini 2.0 Flash to generate an image via the experimental API
        const imageModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const result = await imageModel.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["Text", "Image"] }
        });

        const response = result.response;
        const parts = response.candidates[0].content.parts;

        // Find the image part
        const imagePart = parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith("image/"));

        if (!imagePart) {
            // Model returned text only – pass it back so the client can show it
            const textPart = parts.find(p => p.text);
            return res.status(200).send({
                success: true,
                type: "text",
                data: textPart ? textPart.text : "Image could not be generated for this prompt.",
            });
        }

        res.status(200).send({
            success: true,
            type: "image",
            mimeType: imagePart.inlineData.mimeType,
            data: imagePart.inlineData.data, // base64 string
        });
    } catch (error) {
        console.error("Gemini Image Generation Error:", error.message);
        const status = error.status || 500;
        res.status(status).send({
            success: false,
            message: "Failed to generate image",
            error: error.message,
        });
    }
};

// ──────────────────────────────────────────────────────────
// IMAGE ANALYSIS  (Gemini Vision – multimodal)
// ──────────────────────────────────────────────────────────
const analyzeImage = async (req, res) => {
    const prompt = req.body.prompt || "Describe this image in detail.";

    if (!req.file) {
        return res.status(400).send({
            success: false,
            message: "Image file is required",
        });
    }

    try {
        const base64Data = req.file.buffer.toString("base64");
        const mimeType = req.file.mimetype; // e.g. "image/jpeg"

        const result = await visionModel.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType,
                },
            },
            prompt,
        ]);

        const response = await result.response;
        const text = response.text();

        res.status(200).send({
            success: true,
            data: text,
        });
    } catch (error) {
        console.error("Gemini Vision Error:", error.message);
        const status = error.status || 500;
        res.status(status).send({
            success: false,
            message: "Failed to analyze image",
            error: error.message,
        });
    }
};

module.exports = {
    chatWithAI,
    generateImage,
    analyzeImage,
};
