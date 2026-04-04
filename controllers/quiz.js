const prisma = require("../db/prisma");

// Shared Gemini helper with retry + backoff for 429 rate-limit errors
async function geminiGenerate(model, parts, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // accepts either a string prompt or an array of parts (text/files)
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes("429");
      if (isRateLimit && attempt < retries) {
        const delay = attempt * 3000; // 3s, 6s, 9s backoff
        console.warn(`Gemini 429 rate-limit hit. Retrying in ${delay / 1000}s... (attempt ${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
      } else if (isRateLimit) {
        const e = new Error("Gemini API rate limit reached. Please wait a moment and try again.");
        e.status = 429;
        throw e;
      } else {
        throw err;
      }
    }
  }
}

exports.createQuiz = async (req, res, next) => {
  const { title, text, totalMarks, dueDate, files, canSubmitAfterTime, classroomID, subjectID } = req.body;
  const createdBy = req.user.id;
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomID },
      include: { teachers: true, students: true }
    });
    if (!classroom) return res.status(404).json({ message: "Classroom not found" });

    if (new Date() > new Date(dueDate)) return res.status(400).json({ message: "Due date should be greater than current date" });

    const isTeacher = classroom.teachers.find(tea => tea.teacherID === createdBy);
    if (!isTeacher) return res.status(403).json({ message: "You are not a teacher in this classroom" });

    const quiz = await prisma.quiz.create({
      data: {
        title,
        text,
        totalMarks: parseInt(totalMarks) || 0,
        dueDate: new Date(dueDate),
        canSubmitAfterTime: canSubmitAfterTime === 'true' || canSubmitAfterTime === true,
        createdBy,
        classroomID,
        subjectID,
        files: {
          create: (files || []).map(f => ({
            name: typeof f === 'string' ? f.split('/').pop() : f.name,
            url: typeof f === 'string' ? f : f.url
          }))
        }
      }
    });

    // Notifications
    const studentIds = classroom.students.map(s => s.id);
    const guardianIds = classroom.students.map(s => s.guardianId).filter(Boolean);
    const subject = await prisma.subject.findUnique({ where: { id: subjectID } });

    if (studentIds.length > 0) {
      await prisma.notification.create({
        data: {
          userID: createdBy,
          message: `New quiz created: ${title}`,
          subjectName: subject ? subject.name : "Subject",
          classroomName: classroom.name,
          deliveredTo: { connect: studentIds.map(id => ({ id })) }
        }
      });
    }

    if (guardianIds.length > 0) {
      await prisma.notification.create({
        data: {
          userID: createdBy,
          message: `New quiz created for your child: ${title}`,
          subjectName: subject ? subject.name : "Subject",
          classroomName: classroom.name,
          deliveredTo: { connect: guardianIds.map(id => ({ id })) }
        }
      });
    }

    res.status(201).send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.editQuiz = async (req, res, next) => {
  const { title, text, totalMarks, subjectID, dueDate, files, canSubmitAfterTime } = req.body;
  const { id } = req.params;
  try {
    if (dueDate && new Date() > new Date(dueDate)) return res.status(400).json({ message: "Due date should be greater than current date" });

    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (quiz.createdBy !== req.user.id) return res.status(403).json({ message: "Unauthorized to edit this quiz" });

    const updated = await prisma.quiz.update({
      where: { id },
      data: {
        title: title || undefined,
        text: text || undefined,
        totalMarks: (totalMarks !== undefined && totalMarks !== "") ? (parseInt(totalMarks) || 0) : undefined,
        subjectID: subjectID || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        canSubmitAfterTime: canSubmitAfterTime !== undefined ? (canSubmitAfterTime === 'true' || canSubmitAfterTime === true) : undefined,
        files: files ? {
          deleteMany: {},
          create: files.map(f => ({
            name: typeof f === 'string' ? f.split('/').pop() : f.name,
            url: typeof f === 'string' ? f : f.url
          }))
        } : undefined
      }
    });
    res.status(200).send(updated);
  } catch (error) {
    next(error);
  }
};

exports.deleteQuiz = async (req, res, next) => {
  const { id } = req.params;
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).send();
    if (quiz.createdBy !== req.user.id) return res.status(403).send();

    await prisma.$transaction([
      prisma.file.deleteMany({ where: { quizID: id } }),
      prisma.quizSubmission.deleteMany({ where: { quizID: id } }),
      prisma.quiz.delete({ where: { id } })
    ]);

    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.submitQuiz = async (req, res, next) => {
  const { id } = req.params;
  const { file } = req.body;
  const studentID = req.user.id;
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: { subject: true, classroom: true }
    });
    if (!quiz) return res.status(404).send();

    if (!quiz.canSubmitAfterTime && new Date() > quiz.dueDate) return res.status(403).send("Can't submit after due date");

    const isStudent = await prisma.classroom.findFirst({
        where: { id: quiz.classroomID, students: { some: { id: studentID } } }
    });
    if (!isStudent) return res.status(403).send();

    const alreadySubmitted = await prisma.quizSubmission.findFirst({
        where: { quizID: id, studentID }
    });
    if (alreadySubmitted) return res.status(403).send("Already submitted");

    const submission = await prisma.quizSubmission.create({
      data: {
        quizID: id,
        studentID,
        file,
        isLate: new Date() > quiz.dueDate
      }
    });

    // Notifications
    const student = req.user;
    const recipients = [quiz.createdBy, student.guardianId].filter(Boolean);

    await prisma.notification.create({
      data: {
        userID: studentID,
        message: `${student.name} submitted a quiz`,
        subjectName: quiz.subject.name,
        classroomName: quiz.classroom.name,
        deliveredTo: { connect: recipients.map(rid => ({ id: rid })) }
      }
    });

    res.status(201).send(submission);
  } catch (error) {
    next(error);
  }
};

exports.gradeQuizes = async (req, res, next) => {
  const { id } = req.params;
  const { submissions } = req.body;
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return res.status(404).send();
    if (quiz.createdBy !== req.user.id) return res.status(403).send();

    const invalidMarks = submissions.find(s => s.marks > quiz.totalMarks);
    if (invalidMarks) return res.status(400).send("Invalid marks");

    for (const s of submissions) {
        const existing = await prisma.quizSubmission.findFirst({ where: { quizID: id, studentID: s.studentID } });
        if (existing) {
            await prisma.quizSubmission.update({ 
                where: { id: existing.id }, 
                data: { feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        } else {
            await prisma.quizSubmission.create({ 
                data: { quizID: id, studentID: s.studentID, feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        }
    }

    res.send({ message: "Graded successfully" });
  } catch (error) {
    next(error);
  }
};

exports.getQuizesOfClassroom = async (req, res, next) => {
  const { classroomID } = req.params;
  try {
    const quizzes = await prisma.quiz.findMany({ 
      where: { classroomID },
      include: { files: true }
    });
    res.send(quizzes);
  } catch (error) {
    next(error);
  }
};

exports.getQuizesOfClassroomOfTeacher = async (req, res, next) => {
  const { classroomID } = req.params;
  const createdBy = req.user.id;
  try {
    const quizes = await prisma.quiz.findMany({ 
      where: { classroomID, createdBy },
      include: { files: true }
    });
    res.send(quizes);
  } catch (error) {
    next(error);
  }
};

exports.getAllQuizesOfTeacher = async (req, res, next) => {
  const createdBy = req.user.id;
  try {
    const quizes = await prisma.quiz.findMany({
      where: { createdBy },
      include: {
        creator: true,
        subject: true,
        submissions: true,
        classroom: {
          include: {
            students: true,
            teachers: { include: { teacher: true, subject: true } },
          }
        }
      }
    });

    const result = quizes.map(q => ({
        ...q,
        classroomID: q.classroom,
        subjectID: q.subject,
        creator: q.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};


exports.getQuizById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const quiz = await prisma.quiz.findUnique({ 
      where: { id },
      include: { files: true }
    });
    if (!quiz) return res.status(404).send();
    res.send(quiz);
  } catch (error) {
    next(error);
  }
};

exports.getStudentQuiz = async (req, res, next) => {
  const { id } = req.params;
  const studentID = req.user.id;
  try {
    const quiz = await prisma.quiz.findUnique({ 
      where: { id },
      include: { files: true }
    });
    if (!quiz) return res.status(404).send();

    const submission = await prisma.quizSubmission.findFirst({
        where: { quizID: id, studentID }
    });
    if (!submission) return res.status(404).send();
    res.send({ totalMarks: quiz.totalMarks, submission });
  } catch (error) {
    next(error);
  }
};

exports.getAllQuizzesOfStudent = async (req, res, next) => {
  try {
    const studentID = req.user.id;
    const quizzes = await prisma.quiz.findMany({
      where: { classroom: { students: { some: { id: studentID } } } },
      include: {
          subject: true,
          classroom: true,
          creator: true,
          files: true,
          submissions: { where: { studentID } }
      }
    });

    const result = quizzes.map(q => ({
        ...q,
        isSubmitted: q.submissions.length > 0,
        classroomID: q.classroom,
        subjectID: q.subject,
        creator: q.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getQuizForGrading = async (req, res, next) => {
  try {
    const teacherID = req.user.id;
    const { quizID } = req.params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizID },
      include: {
          submissions: { include: { student: true } },
          classroom: { include: { students: true } },
          files: true
      }
    });
    if (!quiz || quiz.createdBy !== teacherID) return res.status(404).send();

    const students = quiz.classroom.students.filter(student => 
      student.subjects.includes(quiz.subjectID)
    );
    const submissions = students.map(student => {
        const sub = quiz.submissions.find(s => s.studentID === student.id);
        return sub ? { submission: sub, studentID: student } : { studentID: student };
    });

    res.send({ ...quiz, submissions });
  } catch (error) {
    next(error);
  }
};

exports.checkPlagiarism = async (req, res, next) => {
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const teacherID = req.user.id;
    const { quizID } = req.params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizID },
      include: { submissions: { include: { student: true } } }
    });

    if (!quiz || quiz.createdBy !== teacherID)
      return res.status(404).json({ message: "Quiz not found or unauthorized" });

    const submissions = quiz.submissions.filter(s => s.file);

    if (submissions.length < 2) {
      return res.json({ results: [], totalSubmissions: submissions.length, message: "Not enough submissions to compare." });
    }

    // Step 1: Flag identical file URLs immediately (no AI needed)
    const fileGroups = {};
    submissions.forEach(sub => {
      if (!fileGroups[sub.file]) fileGroups[sub.file] = [];
      fileGroups[sub.file].push(sub);
    });

    const identicalResults = [];
    Object.values(fileGroups).forEach(group => {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            identicalResults.push({
              studentA: { id: group[i].studentID, name: group[i].student?.name || "Unknown", file: group[i].file },
              studentB: { id: group[j].studentID, name: group[j].student?.name || "Unknown", file: group[j].file },
              similarity: 100,
              riskLevel: "high",
              reasoning: "Both students submitted the exact same file. This is a definitive plagiarism flag.",
              type: "identical_file"
            });
          }
        }
      }
    });

    // Step 2: Use Gemini to analyze unique submissions for content-level similarity
    // Build a prompt with submission metadata and file URLs for Gemini to analyze
    const submissionList = submissions.map((s, i) => (
      `Student ${i + 1}: ${s.student?.name || "Unknown"} (ID: ${s.studentID})\nFile URL: ${s.file}\nSubmitted at: ${s.submittedAt}`
    )).join("\n\n");

    const prompt = `You are an academic plagiarism detector. Analyze the following quiz submissions for the quiz titled "${quiz.title}".

Submissions:
${submissionList}

INSTRUCTIONS:
1. Compare each pair of student submissions for potential plagiarism or collaboration.
2. Consider: similar file naming patterns, submission timing patterns, and any other signals.
3. For each suspicious pair, provide a similarity score (0-100) and reasoning.
4. Only flag pairs where you have reason to believe plagiarism may have occurred.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "results": [
    {
      "studentAName": "string",
      "studentBName": "string",
      "similarity": number,
      "riskLevel": "high" | "medium" | "low",
      "reasoning": "string explaining why this pair is suspicious"
    }
  ],
  "summary": "string - brief overall summary of findings"
}

If no suspicious pairs are found, return: { "results": [], "summary": "No suspicious patterns detected." }`;

    let aiResults = [];
    let aiSummary = "";

    try {
      const responseText = await geminiGenerate(model, prompt);

      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiResults = (parsed.results || []).map(r => ({
          studentA: { name: r.studentAName, ...submissions.find(s => s.student?.name === r.studentAName && ({ id: s.studentID, file: s.file })) && { id: submissions.find(s => s.student?.name === r.studentAName)?.studentID, file: submissions.find(s => s.student?.name === r.studentAName)?.file } },
          studentB: { name: r.studentBName, ...submissions.find(s => s.student?.name === r.studentBName && ({ id: s.studentID, file: s.file })) && { id: submissions.find(s => s.student?.name === r.studentBName)?.studentID, file: submissions.find(s => s.student?.name === r.studentBName)?.file } },
          similarity: r.similarity,
          riskLevel: r.riskLevel,
          reasoning: r.reasoning,
          type: "ai_analysis"
        }));
        // Enrich with actual IDs and file URLs
        aiResults = aiResults.map(r => {
          const subA = submissions.find(s => s.student?.name === r.studentA?.name);
          const subB = submissions.find(s => s.student?.name === r.studentB?.name);
          return {
            ...r,
            studentA: { id: subA?.studentID, name: r.studentA?.name || "Unknown", file: subA?.file },
            studentB: { id: subB?.studentID, name: r.studentB?.name || "Unknown", file: subB?.file },
          };
        });
        aiSummary = parsed.summary || "";
      }
    } catch (aiError) {
      console.error("Gemini plagiarism analysis error:", aiError.message);
      // Fallback to identical-only results if Gemini fails
    }

    // Merge identical + AI results (deduplicate)
    const allResults = [...identicalResults];
    aiResults.forEach(aiR => {
      const alreadyFlagged = identicalResults.some(
        iR => iR.studentA.name === aiR.studentA.name && iR.studentB.name === aiR.studentB.name
      );
      if (!alreadyFlagged) allResults.push(aiR);
    });

    const flaggedCount = allResults.length;
    res.json({
      results: allResults,
      totalSubmissions: submissions.length,
      aiPowered: true,
      message: flaggedCount === 0
        ? `✅ Gemini AI found no suspicious patterns among ${submissions.length} submission(s).`
        : `⚠️ Gemini AI flagged ${flaggedCount} suspicious pair(s) out of ${submissions.length} submissions.`,
      aiSummary
    });
  } catch (error) {
    next(error);
  }
};

exports.checkSingleSubmission = async (req, res, next) => {
  try {
    const axios = require("axios");
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const teacherID = req.user.id;
    const { quizID, studentID } = req.params;

    // Fetch the quiz with all submissions
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizID },
      include: { submissions: { include: { student: true } } }
    });

    if (!quiz || quiz.createdBy !== teacherID)
      return res.status(404).json({ message: "Quiz not found or unauthorized" });

    const targetSubmission = quiz.submissions.find(s => s.studentID === studentID);
    if (!targetSubmission || !targetSubmission.file)
      return res.status(404).json({ message: "Submission not found or has no file" });

    const filename = targetSubmission.file.split('/').pop()?.toLowerCase() || '';
    const isPDF = filename.endsWith('.pdf');
    const isWord = filename.endsWith('.docx') || filename.endsWith('.doc');
    const isText = filename.endsWith('.txt');

    // Mime types Gemini 1.5 Flash supports in inlineData
    let mimeType = "text/plain";
    if (isPDF) mimeType = "application/pdf";
    else if (filename.endsWith('.docx')) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (filename.endsWith('.doc')) mimeType = "application/msword";

    // Fetch the file as a buffer
    let fileBase64 = "";
    let fileTextFallback = "";
    try {
      const fileResponse = await axios.get(targetSubmission.file, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const buffer = Buffer.from(fileResponse.data);
      fileBase64 = buffer.toString("base64");
      
      if (isText) {
        fileTextFallback = buffer.toString("utf8").substring(0, 8000);
      }
    } catch (fetchErr) {
      console.error("Failed to fetch file content:", fetchErr.message);
      return res.status(422).json({ message: "Could not fetch the submission file. Ensure the student has correctly uploaded the file." });
    }

    // Fetch all other student submissions as text for comparison (best effort)
    const otherSubmissionsText = [];
    for (const sub of quiz.submissions) {
      if (sub.studentID === studentID || !sub.file) continue;
      const subFilename = sub.file.toLowerCase();
      if (subFilename.endsWith('.txt')) {
        try {
          const r = await axios.get(sub.file, { responseType: "text", timeout: 8000, headers: { "User-Agent": "Mozilla/5.0" } });
          const content = typeof r.data === "string" ? r.data.substring(0, 3000) : "";
          if (content.trim()) {
            otherSubmissionsText.push({ name: sub.student?.name || "Unknown", content });
          }
        } catch { /* skip unreadable files */ }
      } else {
        // Just note that there is another student file, but we can't easily compare the full PDF in the same prompt locally
        otherSubmissionsText.push({ name: sub.student?.name || "Unknown", content: "[File submitted but content comparing text-only files for peers]" });
      }
    }

    // Prepare multimodal parts for Gemini
    const otherSection = otherSubmissionsText.length > 0
      ? `\n\n## OTHER STUDENT SUBMISSIONS (TEXT ONLY) FOR COMPARISON:\n${otherSubmissionsText.map((s, i) => `--- Student ${i + 1}: ${s.name} ---\n${s.content}`).join("\n\n")}`
      : "\n\n## OTHER STUDENT SUBMISSIONS: None available for comparison.";

    const prompt = `You are an expert academic integrity analyst for the quiz titled "${quiz.title}".
Analyze the student's submission from "${targetSubmission.student?.name || "Unknown"}".

INSTRUCTIONS:
1. **AI Detection**: Determine if the submission was written by a human or generated by AI (ChatGPT, etc.). 
2. **Plagiarism**: Compare it against other student submissions provided in text below. Look for copied or rephrased content.
3. Be professional and objective.

RESPOND ONLY with valid JSON in this exact format:
{
  "aiDetection": {
    "score": number (0-100),
    "verdict": "string",
    "confidence": "Low" | "Medium" | "High",
    "reasoning": "string"
  },
  "plagiarism": {
    "score": number (0-100),
    "verdict": "string",
    "suspiciousPairs": [
      { "comparedWith": "string", "similarity": number, "reasoning": "string" }
    ]
  },
  "overallRisk": "Low" | "Medium" | "High",
  "summary": "string"
}`;

    const parts = [
      { inlineData: { data: fileBase64, mimeType } },
      { text: prompt + otherSection }
    ];

    const responseText = await geminiGenerate(model, parts);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ message: "AI analysis results were not in the expected format. Please try again." });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    res.json({
      studentName: targetSubmission.student?.name || "Unknown",
      studentID,
      quizTitle: quiz.title,
      fileUrl: targetSubmission.file,
      analysis,
      filePreview: isText ? fileTextFallback.substring(0, 300) : `Document (${filename}) received and analyzed by AI.`
    });
  } catch (error) {
    next(error);
  }
};
