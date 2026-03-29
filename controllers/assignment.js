const mongoose = require("mongoose");
const Assignment = require("../models/assignment");
const Classroom = require("../models/classroom");
const Notification = require("../models/notification");
const User = require("../models/user");
const Subject = require("../models/subject");



exports.createAssignment = async (req, res, next) => {
  const { title, text, totalMarks, dueDate, files, classroomID, subjectID } =
    req.body;
  try {
    //check if classroom exists and teacher is part of that classroom
    const classroom = await Classroom.findById(classroomID);
    if (!classroom) {
      return res.status(404).send();
    }

    // check if dueDate is greater than current date
    if (new Date() > new Date(dueDate)) {
      return res
        .status(400)
        .send("Due date should be greater than current date");
    }

    const isTeacher = classroom.teachers.find(
      (tea) => tea.teacher.toString() == req.user._id.toString()
    );
    if (!isTeacher) {
      return res.status(403).send();
    }

    // check if teacher is assigned that subject in that classroom
    // const isSubjectTeacher = classroom.teachers.find(
    //   (tea) =>
    //     tea.teacher.toString() == req.user._id.toString() &&
    //     tea.subject.toString() == subjectID
    // );

    // if (!isSubjectTeacher) {
    //   return res.status(403).send();
    // }

    const createdBy = req.user._id;
    const assignment = new Assignment({
      title,
      text,
      totalMarks,
      dueDate,
      files,
      createdBy,
      classroomID,
      subjectID,
    });
    await assignment.save();

    // Create notifications for students and parents
    const students = await User.find({ _id: { $in: classroom.students } });
    const studentIds = students.map((s) => s._id);

    // Collect all unique guardian emails and IDs
    const guardianIds = new Set();
    const guardianEmails = new Set();

    students.forEach(s => {
      if (s.guardianId) guardianIds.add(s.guardianId.toString());
      if (s.guardianEmail) guardianEmails.add(s.guardianEmail);
    });

    // Find parent users who match the emails if they aren't already in the IDs set
    if (guardianEmails.size > 0) {
      const parentUsers = await User.find({ email: { $in: Array.from(guardianEmails) }, userType: "parent" });
      parentUsers.forEach(p => guardianIds.add(p._id.toString()));
    }

    const parentIdsArray = Array.from(guardianIds).map(id => mongoose.Types.ObjectId(id));
    const subject = await Subject.findById(subjectID);

    if (studentIds.length > 0) {
      await Notification.create({
        userID: createdBy,
        deliveredTo: studentIds,
        message: `New assignment created: ${title}`,
        subjectName: subject ? subject.name : "Subject",
        classroomName: classroom.name,
      });
    }

    if (parentIdsArray.length > 0) {
      await Notification.create({
        userID: createdBy,
        deliveredTo: parentIdsArray,
        message: `New assignment created for your child: ${title}`,
        subjectName: subject ? subject.name : "Subject",
        classroomName: classroom.name,
      });
    }

    res.status(201).send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.editAssignment = async (req, res, next) => {

  console.log("i am working inside controller");

  const { title, text, totalMarks, dueDate, files, subjectID, classroomID } = req.body;
  const { id } = req.params;
  try {
    // check if dueDate is greater than current date
    if (dueDate) {
      if (new Date() > new Date(dueDate)) {
        return res
          .status(400)
          .json({ message: "Due date should be greater than current date" });
      }
    }

    // check if assignment exists and teacher who created assignment is editing it
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to edit this assignment" });
    }

    // Validate classroom if provided
    if (classroomID) {
      const classroom = await Classroom.findById(classroomID);
      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }
    }

    //if title or totalMarks or dueDate or files is not provided, use the old value
    assignment.title = title ? title : assignment.title;
    assignment.text = text ? text : assignment.text;
    assignment.subjectID = subjectID ? subjectID : assignment.subjectID;
    assignment.classroomID = classroomID ? classroomID : assignment.classroomID;
    assignment.totalMarks = totalMarks ? totalMarks : assignment.totalMarks;
    assignment.dueDate = dueDate ? dueDate : assignment.dueDate;
    assignment.files = files ? files : assignment.files;

    await assignment.save();
    res.status(200).send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  const { id } = req.params;
  try {
    //check if assignment exists and teacher who created assignment is deleting it

    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).send();
    }
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send();
    }
    await assignment.remove();
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroom = async (req, res, next) => {
  const { classroomID } = req.params;
  try {
    const assignments = await Assignment.find({ classroomID });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroomOfTeacher = async (req, res, next) => {
  const { classroomID } = req.params;
  const createdBy = req.user._id;
  try {
    const assignments = await Assignment.find({ classroomID, createdBy });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsOfTeacher = async (req, res, next) => {
  const createdBy = req.user._id;
  try {
    const assignments = await Assignment.find({ createdBy })
      .populate({
        path: "createdBy",
        select: "name email", // Teacher info
        model: "User",
      })
      .populate({
        path: "subjectID",
        select: "name", // Subject name
        model: "Subject",
      })
      .populate({
        path: "classroomID",
        model: "Classroom",
        populate: [
          {
            path: "students",
            select: "name email levelID subjects",
            model: "User",
          },
          {
            path: "teachers.teacher",
            select: "name email",
            model: "User",
          },
          {
            path: "teachers.subject",
            select: "name",
            model: "Subject",
          },
          {
            path: "levelID",
            model: "Level",
          }
        ],
      });

    res.send(assignments);
  } catch (error) {
    next(error);
  }
};


exports.getAssignmentById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).send();
    }
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.submitAssignment = async (req, res, next) => {
  const { id } = req.params;
  const { file } = req.body;
  const studentID = req.user._id;

  try {
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).send();
    }

    //check if user is part of that classroom
    const classroomID = assignment.classroomID;
    const classroom = await Classroom.findById(classroomID);
    if (!classroom) {
      return res.status(404).send();
    }
    const isStudent = classroom.students.includes(studentID);
    if (!isStudent) {
      return res.status(403).send();
    }

    //check if already submitted
    const alreadySubmitted = assignment.submissions.find(
      (s) => s.studentID.toString() == studentID
    );
    if (alreadySubmitted) {
      return res.status(400).send("Already submitted");
    }

    const submission = {
      studentID,
      file,
      isLate: new Date() > assignment.dueDate,
    };
    assignment.submissions.push(submission);
    await assignment.save();

    // Create notifications for teacher and parent
    let recipients = [assignment.createdBy];
    if (req.user.guardianId) {
      recipients.push(req.user.guardianId);
    } else if (req.user.guardianEmail) {
      const parent = await User.findOne({ email: req.user.guardianEmail, userType: "parent" });
      if (parent) recipients.push(parent._id);
    }

    const populatedAssignment = await Assignment.findById(id).populate("subjectID classroomID");
    await Notification.create({
      userID: studentID,
      deliveredTo: recipients,
      message: `${req.user.name} submitted an assignment`,
      subjectName: populatedAssignment.subjectID.name,
      classroomName: populatedAssignment.classroomID.name,
      file: {
        name: file.split("/").pop() || "assignment",
        url: file
      }
    });

    res.status(201).send(assignment);
  } catch (error) {
    next(error);
  }
};
exports.gradeAssignments = async (req, res, next) => {
  const { id } = req.params;
  const { submissions } = req.body;

  try {
    // Find the assignment by ID
    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).send("Assignment not found");
    }

    // Check if the teacher grading the assignment is the one who created it
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send("Unauthorized to grade this assignment");
    }

    // Validate marks: Ensure no submission exceeds total marks
    const invalidMarks = submissions.find((s) => s.marks > assignment.totalMarks);
    if (invalidMarks) {
      return res.status(400).send("Invalid marks: Marks exceed total marks");
    }

    // Update submissions: support students who haven't submitted yet
    submissions.forEach((updatedSubmission) => {
      const existingSubmission = assignment.submissions.find(
        (s) => s.studentID.toString() === updatedSubmission.studentID.toString()
      );

      if (existingSubmission) {
        // Update existing submission
        existingSubmission.feedback = updatedSubmission.feedback !== undefined ? updatedSubmission.feedback : existingSubmission.feedback;
        existingSubmission.grade = updatedSubmission.grade !== undefined ? updatedSubmission.grade : existingSubmission.grade;
        existingSubmission.marks = updatedSubmission.marks !== undefined ? updatedSubmission.marks : existingSubmission.marks;
      } else {
        // Create new entry for students who haven't submitted
        assignment.submissions.push({
          studentID: updatedSubmission.studentID,
          feedback: updatedSubmission.feedback || "",
          grade: updatedSubmission.grade || "",
          marks: updatedSubmission.marks !== undefined ? updatedSubmission.marks : 0,
        });
      }
    });

    // Save the updated assignment
    await assignment.save();
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};


exports.getStudentAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentID = req.user._id;
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).send();
    }
    const submission = assignment.submissions.find(
      (s) => s.studentID.toString() == studentID.toString()
    );
    if (!submission) {
      return res.status(404).send();
    }
    res.send({ totalMarks: assignment.totalMarks, submission });
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsOfStudent = async (req, res, next) => {
  try {
    const studentID = req.user._id;

    // get all classrooms of student and then get all assignments of those classrooms
    const classrooms = await Classroom.find({ students: studentID });
    const classroomIDs = classrooms.map((c) => c._id);
    const assignments = await Assignment.find({
      classroomID: { $in: classroomIDs },
    }).populate("subjectID").populate("classroomID").populate("createdBy");

    // check if user has submitted the assignment and add isSubmitted to each assignment
    const assignmentsWithSubmission = assignments.map((assignment) => {
      const submission = assignment.submissions.find(
        (s) => s.studentID.toString() == studentID.toString()
      );
      if (submission) {
        return { ...assignment._doc, isSubmitted: true };
      }
      return { ...assignment._doc, isSubmitted: false };
    });

    res.send(assignmentsWithSubmission);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentForGrading = async (req, res, next) => {
  try {
    const teacherID = req.user._id;
    const { assignmentID } = req.params;

    // return all submission of assignment based on students in classroomID
    const assignment = await Assignment.findOne({
      _id: assignmentID,
      createdBy: teacherID,
    }).populate("submissions.studentID");
    if (!assignment) {
      return res.status(404).send();
    }
    const classroomID = assignment.classroomID;
    const classroom = await Classroom.findById(classroomID).populate({
      path: "students",
      select: "name email profilePic levelID subjects"
    });
    if (!classroom) {
      return res.status(404).send();
    }

    // Filter students: include if they are enrolled in the subject, or if they have no subjects assigned (fallback to all students in classroom)
    const students = classroom.students.filter(student => {
      if (!student.subjects || student.subjects.length === 0) return true;
      return student.subjects.some(sub => sub.toString() === assignment.subjectID.toString());
    });

    // return all students of classroom and check if they have submitted the assignment
    const submissions = students.map((studentID) => {
      const submission = assignment.submissions.find(
        (s) => s.studentID._id.toString() == studentID._id.toString()
      );

      if (submission) {
        return { submission: { ...submission._doc }, studentID };
      }
      return { studentID };
    });

    // send assingment and submissions without submissions in assignment
    res.send({ ...assignment._doc, submissions });
  } catch (error) {
    next(error);
  }
};
