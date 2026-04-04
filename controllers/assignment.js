const prisma = require("../db/prisma");

// Shared Gemini helper with retry + backoff for 429 rate-limit errors
async function geminiGenerate(model, parts, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes("429");
      if (isRateLimit && attempt < retries) {
        const delay = attempt * 3000;
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

exports.createAssignment = async (req, res, next) => {
  const { title, text, totalMarks, dueDate, files, classroomID, subjectID } = req.body;
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomID },
      include: { teachers: true, students: true }
    });
    if (!classroom) return res.status(404).send();

    if (new Date() > new Date(dueDate)) return res.status(400).send("Due date should be greater than current date");

    const isTeacher = classroom.teachers.find(tea => tea.teacherID === req.user.id);
    if (!isTeacher) return res.status(403).send();

    const createdBy = req.user.id;
    const assignment = await prisma.assignment.create({
      data: {
        title,
        text,
        totalMarks: parseInt(totalMarks) || 0,
        dueDate: new Date(dueDate),
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
          message: `New assignment created: ${title}`,
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
          message: `New assignment created for your child: ${title}`,
          subjectName: subject ? subject.name : "Subject",
          classroomName: classroom.name,
          deliveredTo: { connect: guardianIds.map(id => ({ id })) }
        }
      });
    }

    res.status(201).send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.editAssignment = async (req, res, next) => {
  const { title, text, totalMarks, dueDate, files, subjectID, classroomID } = req.body;
  const { id } = req.params;
  try {
    if (dueDate && new Date() > new Date(dueDate)) return res.status(400).json({ message: "Due date should be greater than current date" });

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (assignment.createdBy !== req.user.id) return res.status(403).json({ message: "Unauthorized to edit this assignment" });

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        title: title || undefined,
        text: text || undefined,
        totalMarks: (totalMarks !== undefined && totalMarks !== "") ? (parseInt(totalMarks) || 0) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        subjectID: subjectID || undefined,
        classroomID: classroomID || undefined,
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

exports.deleteAssignment = async (req, res, next) => {
  const { id } = req.params;
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).send();
    if (assignment.createdBy !== req.user.id) return res.status(403).send();

    await prisma.$transaction([
      prisma.file.deleteMany({ where: { assignmentID: id } }),
      prisma.assignmentSubmission.deleteMany({ where: { assignmentID: id } }),
      prisma.assignment.delete({ where: { id } })
    ]);

    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroom = async (req, res, next) => {
  const { classroomID } = req.params;
  try {
    const assignments = await prisma.assignment.findMany({ 
      where: { classroomID },
      include: { files: true }
    });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroomOfTeacher = async (req, res, next) => {
  const { classroomID } = req.params;
  const createdBy = req.user.id;
  try {
    const assignments = await prisma.assignment.findMany({ 
      where: { classroomID, createdBy },
      include: { files: true }
    });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsOfTeacher = async (req, res, next) => {
  const createdBy = req.user.id;
  try {
    const assignments = await prisma.assignment.findMany({
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

    const result = assignments.map(a => ({
        ...a,
        classroomID: a.classroom,
        subjectID: a.subject,
        creator: a.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};


exports.getAssignmentById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const assignment = await prisma.assignment.findUnique({ 
      where: { id },
      include: { files: true }
    });
    if (!assignment) return res.status(404).send();
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.submitAssignment = async (req, res, next) => {
  const { id } = req.params;
  const { file } = req.body;
  const studentID = req.user.id;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { classroom: true, subject: true }
    });
    if (!assignment) return res.status(404).send();

    const isStudent = await prisma.classroom.findFirst({
        where: { id: assignment.classroomID, students: { some: { id: studentID } } }
    });
    if (!isStudent) return res.status(403).send();

    const alreadySubmitted = await prisma.assignmentSubmission.findFirst({
        where: { assignmentID: id, studentID }
    });
    if (alreadySubmitted) return res.status(400).send("Already submitted");

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentID: id,
        studentID,
        file,
        isLate: new Date() > assignment.dueDate
      }
    });

    // Notifications
    const student = req.user;
    const recipients = [assignment.createdBy, student.guardianId].filter(Boolean);
    
    await prisma.notification.create({
      data: {
        userID: studentID,
        message: `${student.name} submitted an assignment`,
        subjectName: assignment.subject.name,
        classroomName: assignment.classroom.name,
        deliveredTo: { connect: recipients.map(rid => ({ id: rid })) }
      }
    });

    res.status(201).send(submission);
  } catch (error) {
    next(error);
  }
};
exports.gradeAssignments = async (req, res, next) => {
  const { id } = req.params;
  const { submissions } = req.body;

  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).send("Assignment not found");
    if (assignment.createdBy !== req.user.id) return res.status(403).send("Unauthorized to grade this assignment");

    const invalidMarks = submissions.find(s => s.marks > assignment.totalMarks);
    if (invalidMarks) return res.status(400).send("Invalid marks: Marks exceed total marks");

    for (const s of submissions) {
        const existing = await prisma.assignmentSubmission.findFirst({ where: { assignmentID: id, studentID: s.studentID } });
        if (existing) {
            await prisma.assignmentSubmission.update({ 
                where: { id: existing.id }, 
                data: { feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        } else {
            await prisma.assignmentSubmission.create({ 
                data: { assignmentID: id, studentID: s.studentID, feedback: s.feedback || "", grade: s.grade || "", marks: s.marks ? parseInt(s.marks) : 0 } 
            });
        }
    }

    res.send({ message: "Graded successfully" });
  } catch (error) {
    next(error);
  }
};


exports.getStudentAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentID = req.user.id;
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).send();

    const submission = await prisma.assignmentSubmission.findFirst({
        where: { assignmentID: id, studentID }
    });
    if (!submission) return res.status(404).send();
    res.send({ totalMarks: assignment.totalMarks, submission });
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsOfStudent = async (req, res, next) => {
  try {
    const studentID = req.user.id;

    const assignments = await prisma.assignment.findMany({
      where: { classroom: { students: { some: { id: studentID } } } },
      include: {
          subject: true,
          classroom: true,
          creator: true,
          files: true,
          submissions: { where: { studentID } }
      }
    });

    const result = assignments.map(a => ({
        ...a,
        isSubmitted: a.submissions.length > 0,
        classroomID: a.classroom,
        subjectID: a.subject,
        creator: a.creator
    }));

    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentForGrading = async (req, res, next) => {
  try {
    const teacherID = req.user.id;
    const { assignmentID } = req.params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentID },
      include: {
          submissions: { include: { student: true } },
          classroom: { include: { students: true } },
          files: true
      }
    });
    if (!assignment || assignment.createdBy !== teacherID) return res.status(404).send();

    const students = assignment.classroom.students.filter(student => 
      student.subjects.includes(assignment.subjectID)
    );
    const submissions = students.map(student => {
        const sub = assignment.submissions.find(s => s.studentID === student.id);
        return sub ? { submission: sub, studentID: student } : { studentID: student };
    });

    res.send({ ...assignment, submissions });
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
    const { assignmentID } = req.params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentID },
      include: { submissions: { include: { student: true } } }
    });

    if (!assignment || assignment.createdBy !== teacherID)
      return res.status(404).json({ message: "Assignment not found or unauthorized" });

    const submissions = assignment.submissions.filter(s => s.file);

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

    // Step 2: Use Gemini AI to analyze unique submissions for content-level similarity
    const submissionList = submissions.map((s, i) => (
      `Student ${i + 1}: ${s.student?.name || "Unknown"} (ID: ${s.studentID})\nFile URL: ${s.file}\nSubmitted at: ${s.submittedAt}`
    )).join("\n\n");

    const prompt = `You are an academic plagiarism detector. Analyze the following assignment submissions for the assignment titled "${assignment.title}".

Submissions:
${submissionList}

INSTRUCTIONS:
1. Compare each pair of student submissions for potential plagiarism or academic dishonesty.
2. Consider: similar file naming patterns, submission timing (submitted very close together), and any other signals available.
3. For each suspicious pair, provide a similarity score (0-100) and detailed reasoning.
4. Only flag pairs where you have genuine reason to believe plagiarism may have occurred.

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
        aiResults = (parsed.results || []).map(r => {
          const subA = submissions.find(s => s.student?.name === r.studentAName);
          const subB = submissions.find(s => s.student?.name === r.studentBName);
          return {
            studentA: { id: subA?.studentID, name: r.studentAName || "Unknown", file: subA?.file },
            studentB: { id: subB?.studentID, name: r.studentBName || "Unknown", file: subB?.file },
            similarity: r.similarity,
            riskLevel: r.riskLevel,
            reasoning: r.reasoning,
            type: "ai_analysis"
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
  const { assignmentID, studentID } = req.params;
  console.log(`[AI-CHECK-DEBUG] Controller hit for assignmentID: ${assignmentID}, studentID: ${studentID}`);
  try {
    const axios = require("axios");
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const teacherID = req.user.id;
    const { assignmentID, studentID } = req.params;

    // Fetch the assignment with all submissions
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentID },
      include: { submissions: { include: { student: true } } }
    });

    if (!assignment)
      return res.status(404).json({ message: `Assignment with ID ${assignmentID} not found.` });
    
    if (assignment.createdBy !== teacherID)
      return res.status(403).json({ message: "You are not authorized to check plagiarism for this assignment." });

    const targetSubmission = assignment.submissions.find(s => s.studentID === studentID);
    if (!targetSubmission)
      return res.status(404).json({ message: `Student submission for student ${studentID} not found in this assignment.` });
    
    if (!targetSubmission.file)
      return res.status(404).json({ message: "This student hasn't submitted a file yet." });

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

    // Fetch other student submissions as text for comparison
    const otherSubmissionsText = [];
    for (const sub of assignment.submissions) {
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
        otherSubmissionsText.push({ name: sub.student?.name || "Unknown", content: "[File submitted but content comparing text-only files for peers]" });
      }
    }

    // Prepare multimodal parts for Gemini
    const otherSection = otherSubmissionsText.length > 0
      ? `\n\n## OTHER STUDENT SUBMISSIONS (TEXT ONLY) FOR COMPARISON:\n${otherSubmissionsText.map((s, i) => `--- Student ${i + 1}: ${s.name} ---\n${s.content}`).join("\n\n")}`
      : "\n\n## OTHER STUDENT SUBMISSIONS: None available for comparison.";

    const prompt = `You are an expert academic integrity analyst for the assignment titled "${assignment.title}".
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
      assignmentTitle: assignment.title,
      fileUrl: targetSubmission.file,
      analysis,
      filePreview: isText ? fileTextFallback.substring(0, 300) : `Document (${filename}) received and analyzed by AI.`
    });
  } catch (error) {
    next(error);
  }
};
