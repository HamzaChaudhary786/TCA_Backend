const prisma = require("../db/prisma");


exports.createSubject = async (req, res, next) => {
  try {
    const data = req.body;
    const found = await prisma.subject.findFirst({
      where: { name: data.name, levelID: data.levelID }
    });
    if (found) return res.status(400).send("Subject already exists");

    const subject = await prisma.subject.create({ data });
    res.status(201).send(subject);
  } catch (err) {
    next(err);
  }
};

exports.getSubjects = async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: { level: { select: { name: true } } }
    });

    const formatted = subjects.map(s => ({
      ...s,
      levelName: s.level ? s.level.name : "Unknown Level",
    }));

    res.status(200).send(formatted);
  } catch (err) {
    next(err);
  }
};


exports.getSubjectsOfLevel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subjects = await prisma.subject.findMany({ where: { levelID: id } });
    res.status(200).send(subjects);
  } catch (err) {
    next(err);
  }
};

exports.updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subject = await prisma.subject.update({
      where: { id },
      data: req.body
    });
    res.status(200).send(subject);
  } catch (err) {
    next(err);
  }
};

exports.deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.subject.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getTeacherSubjects = async (req, res, next) => {
  try {
    const { teacherId } = req.params;

    const classrooms = await prisma.classroom.findMany({
      where: { teachers: { some: { teacherID: teacherId } } },
      include: { level: true, teachers: { include: { subject: true } } }
    });

    if (classrooms.length === 0) return res.status(404).json({ message: "Teacher not found in any classroom." });

    const subjects = [];
    const addedSubjectIds = new Set();

    for (const classroom of classrooms) {
      const teacherEntries = classroom.teachers.filter(t => t.teacherID === teacherId);
      for (const entry of teacherEntries) {
        if (entry.subject && !addedSubjectIds.has(entry.subject.id)) {
          subjects.push({
            name: `${classroom.level?.name || " "} - ${entry.subject.name}`,
            classroomId: classroom.id,
            id: entry.subject.id,
          });
          addedSubjectIds.add(entry.subject.id);
        }
      }
    }

    if (subjects.length === 0) return res.status(404).json({ message: "No subjects found for the given teacher." });
    return res.status(200).json(subjects);
  } catch (err) {
    next(err);
  }
};


exports.getTeacherSubjectsOfClassrooms = async (req, res, next) => {
  try {
    const { classroomIDs } = req.body;
    const teacherId = req.user.id;

    if (!Array.isArray(classroomIDs) || classroomIDs.length === 0) return res.status(400).json({ message: "Classroom IDs are required." });

    const classrooms = await prisma.classroom.findMany({
      where: { id: { in: classroomIDs } },
      include: { level: true, teachers: { include: { subject: true } } }
    });

    const allSubjects = [];
    classrooms.forEach(classroom => {
      const teacherSubjects = classroom.teachers.filter(t => t.teacherID === teacherId);
      teacherSubjects.forEach(entry => {
        allSubjects.push({
          classroomId: classroom.id,
          levelName: classroom.level?.name || "",
          subjectId: entry.subjectID,
          subjectName: entry.subject.name,
          type: entry.type,
        });
      });
    });

    return res.status(200).json({ subjects: allSubjects });
  } catch (err) {
    next(err);
  }
};




exports.getSubjectOfStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!studentId || studentId === "undefined") return res.status(400).json({ message: "Invalid student ID" });

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { subjects: true }
    });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const subjects = await prisma.subject.findMany({
      where: { id: { in: student.subjects } },
      select: { id: true, name: true }
    });

    res.status(200).send({ subjects: subjects.map(s => ({ id: s.id, name: s.name })) });
  } catch (err) {
    next(err);
  }
};
