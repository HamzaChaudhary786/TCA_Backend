const Subject = require("../models/subject");
const Classroom = require("../models/classroom");
const Level = require("../models/level");
const User = require("../models/user");


exports.createSubject = async (req, res, next) => {
  try {
    const data = req.body;

    const found = await Subject.findOne({
      name: data.name,
      levelID: data.levelID,
    });

    if (found) {
      return res.status(400).send("Subject already exists");
    }

    const subject = new Subject(data);
    await subject.save();
    res.status(201).send(subject._doc);
  } catch (err) {
    next(err);
  }
};

exports.getSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find()
      .populate({
        path: 'levelID', // Field in the Subject schema referring to Level
        select: 'name', // Select only the 'name' field from the Level schema
      });

    // If you want to format the output to include levelName directly in the subject objects:
    const formattedSubjects = subjects.map(subject => ({
      ...subject._doc, // Spread the existing subject fields
      levelName: subject.levelID ? subject.levelID.name : "Unknown Level", // Add levelName
    }));

    res.status(200).send(formattedSubjects);
  } catch (err) {
    next(err);
  }
};


exports.getSubjectsOfLevel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subjects = await Subject.find({ levelID: id });
    res.status(200).send(subjects);
  } catch (err) {
    next(err);
  }
};

exports.updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const subject = await Subject.findByIdAndUpdate(id, data, {
      new: true,
    });
    res.status(200).send(subject._doc);
  } catch (err) {
    next(err);
  }
};

exports.deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Subject.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getTeacherSubjects = async (req, res, next) => {
  try {
    const { teacherId } = req.params;

    console.log("Fetching subjects for teacher:", teacherId);

    const classrooms = await Classroom.find({
      "teachers.teacher": teacherId,
    }).populate("levelID");

    if (!classrooms || classrooms.length === 0) {
      return res.status(404).json({
        message: "Teacher not found in any classroom.",
      });
    }

    const subjects = [];
    const addedSubjectIds = new Set();

    for (const classroom of classrooms) {
      const teacherEntries = classroom.teachers.filter(
        (teacher) => teacher.teacher.toString() === teacherId
      );

      for (const entry of teacherEntries) {
        if (entry.subject && !addedSubjectIds.has(entry.subject.toString())) {
          const subject = await Subject.findById(entry.subject);
          if (subject) {
            subjects.push({
              name: `${classroom.levelID?.name || " "} - ${subject.name}`,
              classroomId: classroom._id,
              _id: subject._id,
            });
            addedSubjectIds.add(entry.subject.toString());
          }
        }
      }
    }

    if (subjects.length === 0) {
      return res.status(404).json({
        message: "No subjects found for the given teacher.",
      });
    }

    return res.status(200).json(subjects);
  } catch (err) {
    next(err);
  }
};


exports.getTeacherSubjectsOfClassrooms = async (req, res, next) => {
  try {
    const { classroomIDs } = req.body;
    const teacherId = req.user._id;

    if (!Array.isArray(classroomIDs) || classroomIDs.length === 0) {
      return res.status(400).json({ message: "Classroom IDs are required." });
    }

    const classrooms = await Classroom.find({ _id: { $in: classroomIDs } })
      .populate("levelID", "name")
      .populate("teachers.subject", "name");

    let allSubjects = [];

    classrooms.forEach(classroom => {
      const teacherSubjects = classroom.teachers.filter(
        (entry) => entry.teacher.toString() === teacherId.toString()
      );

      const subjects = teacherSubjects.map((entry) => ({
        classroomId: classroom._id,
        levelName: classroom.levelID?.name || "",
        subjectId: entry.subject._id,
        subjectName: entry.subject.name,
        type: entry.type, // head or teacher
      }));

      allSubjects = [...allSubjects, ...subjects];
    });

    return res.status(200).json({ subjects: allSubjects });
  } catch (err) {
    next(err);
  }
};




exports.getSubjectOfStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    if (!studentId || studentId === "undefined") {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const student = await User.findById(studentId).select("subjects");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const subjects = await Subject.find({
      _id: { $in: student.subjects },
    }).select("_id name");

    res.status(200).send({ subjects: subjects });
  } catch (err) {
    next(err);
  }
};
