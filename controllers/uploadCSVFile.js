const fs = require("fs");
const csv = require("csv-parser");
const User = require("../models/user");
const Level = require("../models/level");
const Classroom = require("../models/classroom");
const Subject = require("../models/subject");
const mongoose = require("mongoose");

// Function to determine CSV type
const determineCSVType = (headers) => {
    if (headers.includes("Roll Number") && headers.includes("Student Name")) {
        return "student";
    }
    if (headers.includes("Teacher Name") && headers.includes("Teacher Email")) {
        return "teacher";
    }
    if (headers.includes("classroom_name") && headers.includes("level_name")) {
        return "classroom";
    }
    if (headers.includes("Subject Name") && headers.includes("Level Name")) {
        return "subject";
    }
    return null;
};

// Unified CSV Import Function
exports.addCSVFile = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }

    const results = [];
    let fileType = null;

    // Read CSV file
    const stream = fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("headers", (headers) => {
            fileType = determineCSVType(headers);
        })
        .on("data", (data) => results.push(data))
        .on("end", async () => {
            if (!fileType) {
                return res.status(400).send("Invalid CSV format.");
            }

            try {
                let processResult;
                if (fileType === "student") {

                    const validationErrors = await validateStudentData(results); // Call the pre-validation function
                    if (validationErrors.length > 0) {
                        return res.status(400).json({
                            success: false,
                            errors: validationErrors
                        });
                    }
                    processResult = await processStudentCSV(results);
                } else if (fileType === "teacher") {
                    processResult = await processTeacherCSV(results);
                } else if (fileType === "classroom") {

                    const validationErrors = await validateClassroomData(results); // Call the pre-validation function
                    if (validationErrors.length > 0) {
                        return res.status(400).json({
                            success: false,
                            errors: validationErrors
                        });
                    }
                    processResult = await processClassroomCSV(results, req.user);
                } else if (fileType === "subject") {
                    processResult = await processSubjectCSV(results);
                }

                if (processResult && processResult.success === false) {
                    return res.status(400).json({ success: false, errors: processResult.errors });
                }

                res.send("CSV file processed successfully.");
            } catch (error) {
                console.error("Error processing CSV:", error);
                res.status(500).send("Error processing CSV file.");
            }
        });

    stream.on("error", (error) => {
        console.error("CSV Stream Error:", error);
        res.status(500).send("Error reading CSV file.");
    });
};

// Function to process Subject CSV


const processSubjectCSV = async (results) => {
    let errors = []; // Array to collect error messages

    try {
        for (const row of results) {
            try {
                let { ["Subject Name"]: subjectName, ["Level Name"]: levelName } = row;

                // Validate required fields
                if (!subjectName || !levelName) {
                    const errMsg = `Skipping row due to missing required fields: ${JSON.stringify(row)}`;
                    console.warn(errMsg);
                    errors.push(errMsg);
                    continue;
                }

                // Normalize input data
                subjectName = subjectName.trim().replace(/\s+/g, ' '); // Remove extra spaces between words
                levelName = levelName.trim().replace(/\s+/g, ' '); // Remove extra spaces & convert to lowercase



                console.log(`Processing Subject: ${subjectName} for Level: ${levelName}`);

                // Check if Level exists or create it
                let level = await Level.findOne({ name: levelName });
                if (!level) {
                    console.log(`Creating new level: ${levelName}`);
                    level = new Level({ name: levelName });
                    await level.save();
                    console.log(`Level created successfully: ${levelName}`);
                }
                const levelID = level._id;

                // Check if the combination of Subject and Level already exists
                const existingSubject = await Subject.findOne({ name: subjectName, levelID: levelID });
                if (existingSubject) {
                    const errMsg = `Skipping: Subject '${subjectName}' already exists in level '${levelName}'.`;
                    console.warn(errMsg);
                    continue;
                }

                console.log(`Adding new subject: ${subjectName} under level: ${levelName}`);

                // Insert new subject
                const newSubject = new Subject({
                    name: subjectName,
                    levelID: levelID,
                });
                await newSubject.save();
                console.log(`✅ Subject added: ${subjectName} for Level: ${levelName}`);
            } catch (error) {
                const errMsg = `Error processing row ${JSON.stringify(row)}: ${error.message}`;
                console.error(errMsg);
                errors.push(errMsg);
                continue;
            }
        }
    } catch (error) {
        const errMsg = `Fatal error processing CSV: ${error.message}`;
        console.error(errMsg);
        errors.push(errMsg);
    }

    return errors.length > 0
        ? { success: false, errors }
        : { success: true, message: "Subject CSV processed successfully" };
};


const validateStudentData = async (results) => {
    for (let i = 0; i < results.length; i++) {
        const row = results[i];

        let {
            ["Roll Number"]: RollNo,
            ["Student Name"]: Name,
            Gender,
            ["Guardian Name"]: FatherName,
            ["Level Name"]: LevelName,
        } = row;

        // Validate required fields and return immediately on first missing field
        if (!RollNo || RollNo.trim() === "") {
            return [`Row ${i + 2}: Roll Number is missing`];
        }
        if (!Name) {
            return [`Row ${i + 2}: Student Name is missing`];
        }
        if (!LevelName) {
            return [`Row ${i + 2}: Level Name is missing`];
        }
        if (!FatherName) {
            return [`Row ${i + 2}: Guardian Name is missing`];
        }
        if (!Gender) {
            return [`Row ${i + 2}: Gender is missing`];
        }
        // Normalize level name
        const levelName = LevelName.replace(/\s+/g, ' ').trim();

        try {
            // Validate level
            const level = await Level.findOne({ name: levelName });
            if (!level) {
                return [`Row ${i + 2}: Level '${levelName}' does not exist.`];
            }
        } catch (error) {
            console.error(`❌ Error validating row ${i + 2}:`, error);
            return [`Row ${i + 2}: Error during validation.`];
        }
    }

    return []; // Return empty array if no errors
};


// Function to process Student CSV
const processStudentCSV = async (results) => {
    let errors = []; // Array to collect errors
    let i = 1;

    for (const row of results) {
        i++;
        try {
            const {
                ["Roll Number"]: RollNo,
                ["Student Phone"]: StudentPhone,
                ["Card Number"]: CardNumber,
                ["Student Name"]: Name,
                ["Student Email"]: Email,
                Gender,
                ["Guardian Name"]: FatherName,
                ["Level Name"]: LevelName,
                ["Guardian Email"]: GuardianEmail,
                ["Guardian Phone"]: GuardianPhone,
            } = row;

            const rollNumberString = RollNo.trim();
            let levelNames = LevelName.split(",").map(name => name.trim().replace(/\s+/g, ' '));

            // Fetch Level
            let level = await Level.findOne({ name: levelNames });
            const levelID = level._id;

            // Default email values if empty
            const studentEmail = Email && Email.trim() !== "" ? Email : `${rollNumberString}@educativecloud.com`;
            const guardianEmail = GuardianEmail && GuardianEmail.trim() !== "" ? GuardianEmail : `${rollNumberString}.guardian@educativecloud.com`;
            const generatedReferenceNo = (CardNumber && CardNumber !== '0')
                ? CardNumber
                : `${Date.now()}${Math.floor(Math.random() * 1000)}`;

            // Upsert Student
            await User.findOneAndUpdate(
                {
                    $or: [{ email: studentEmail }, { rollNo: rollNumberString }]
                },
                {
                    name: Name,
                    email: studentEmail,
                    rollNo: rollNumberString,
                    levelID: levelID,
                    phoneNumber: StudentPhone || "000000",
                    userType: "student",
                    gender: Gender || "Not specified",
                    guardianName: FatherName,
                    isAccepted: true,
                    guardianEmail: guardianEmail,
                    guardianPhoneNumber: GuardianPhone || "000000",
                    password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                    referenceNo: generatedReferenceNo,
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                }
            );

            // Upsert Parent
            await User.findOneAndUpdate(
                { email: guardianEmail, userType: "parent" },
                {
                    name: FatherName,
                    email: guardianEmail,
                    phoneNumber: GuardianPhone || "000000",
                    userType: "parent",
                    isAccepted: true,
                    password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                    rollNo: `${rollNumberString}-Parent`,
                    referenceNo: `${generatedReferenceNo}786`,
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                }
            );
        } catch (error) {
            console.error("Error processing row:", row, error);
            errors.push(`Error processing row: ${JSON.stringify(row)}, Error: ${error.message}`);
            continue;
        }
    }

    return errors.length > 0 ? { success: false, errors } : { success: true, message: "CSV processed successfully" };
};


// Function to process Teacher CSV
const processTeacherCSV = async (results) => {
    let errors = []; // Array to collect errors

    for (const row of results) {
        try {
            const {
                ["Teacher Phone"]: TeacherPhone,
                ["Teacher Name"]: Name,
                ["Teacher Email"]: Email,
                ["Teacher Employee ID"]: TeacherEmployeeID
            } = row;

            // Ensure required fields are present
            if (!Email || !Name) {
                const errorMsg = `Skipping row due to missing required fields: ${JSON.stringify(row)}`;
                console.warn(errorMsg);
                errors.push(errorMsg);
                continue;
            }

            console.log(`Processing Teacher: ${Name}, Email: ${Email}`);

            // Check if the teacher already exists
            const teacherExists = await User.findOne({ email: Email });
            if (teacherExists) {
                const errorMsg = `Skipping row as teacher already exists: ${JSON.stringify(row)}`;
                console.warn(errorMsg);
                continue;
            }

            const generatedRollNo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

            // Create and save new teacher
            const newTeacher = new User({
                name: Name,
                email: Email,
                referenceNo: TeacherEmployeeID,
                phoneNumber: TeacherPhone || "000000",
                isAccepted: true,
                gender: "not specified",
                userType: "teacher",
                password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
                rollNo: generatedRollNo,
            });

            await newTeacher.save();
            console.log(`Teacher added successfully: ${Name}`);

        } catch (error) {
            const errorMsg = `Error processing teacher CSV row: ${JSON.stringify(row)}, Error: ${error.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue;
        }
    }

    return errors.length > 0
        ? { success: false, errors }
        : { success: true, message: "Teacher CSV processed successfully" };
};



const validateClassroomData = async (results) => {
    for (let i = 0; i < results.length; i++) {
        const row = results[i];
        let { classroom_name, level_name, student_email, teacher_email, subject_name, type } = row;

        // Check for missing required fields
        if (!classroom_name || !level_name || !student_email) {
            let errorMessage = `Row ${i + 2}: Missing required fields - `;

            if (!classroom_name) {
                errorMessage += "classroom_name, ";
            }
            if (!level_name) {
                errorMessage += "level_name, ";
            }
            if (!student_email) {
                errorMessage += "student_email, ";
            }

            // Remove the last comma and space
            errorMessage = errorMessage.trim().replace(/,$/, "");

            return [errorMessage];
        }

        if (!teacher_email) {
            console.warn(`⚠️ Row ${i + 2}: Teacher Email Missing `,)
        }
        if (!subject_name) {
            console.warn(`⚠️ Row ${i + 2}: Subject Name Missing  - `,)

        }
        if (!type) {
            console.warn(`⚠️ Row ${i + 2}: Type Name Missing  - `,)

        }



        const levelName = level_name.replace(/\s+/g, ' ').trim();
        const subjectName = subject_name.replace(/\s+/g, ' ').trim();

        try {
            // Validate level
            const level = await Level.findOne({ name: levelName });
            if (!level) {
                return [`Row ${i + 1}: Level '${levelName}' does not exist.`];
            }

            student_email = `${student_email}@educativecloud.com`;

            // Validate student
            const student = await User.findOne({ email: student_email, userType: "student" });
            if (!student) {
                return [`Row ${i + 1}: Student with email '${student_email}' does not exist.`];
            }

            // Validate teacher
            if (teacher_email) {
                const teacher = await User.findOne({ email: teacher_email, userType: "teacher" });
                if (!teacher) {
                    return [`Row ${i + 1}: Teacher with email '${teacher_email}' does not exist.`];
                }
            }

            // Validate subject
            if (subjectName && level) {
                const subject = await Subject.findOne({ name: subjectName, levelID: level._id });
                if (!subject) {
                    return [
                        `Row ${i + 1}: Subject '${subjectName}' does not exist for Level '${levelName}'.`
                    ];
                }
            }
        } catch (error) {
            console.error(`❌ Error validating row ${i + 1}:`, error);
            return [`Row ${i + 1}: Error during validation.`];
        }
    }

    return []; // Return an empty array if no errors
};



const processClassroomCSV = async (results, currUser) => {
    let errors = [];
    let i = 1;
    for (const row of results) {
        try {
            let { classroom_name, level_name, student_email, teacher_email, subject_name, type } = row;


            let level;


            let levelName = level_name.replace(/\s+/g, ' ').trim();
            let subjectName = subject_name.replace(/\s+/g, ' ').trim();

            try {
                level = await Level.findOne({ name: levelName });


                if (!level) {
                    console.error(`❌ Error: Level '${levelName}' does not exist.`);
                    errors.push(`Row ${i}: Level '${levelName}' not found.`);
                    return false;
                }
            } catch (error) {
                console.error(`❌ Error finding/saving level (${level_name}):`, error);
                return false;
            }

            let classroom;
            try {
                classroom = await Classroom.findOne({ name: classroom_name, levelID: level._id });
                if (!classroom) {
                    classroom = new Classroom({
                        name: classroom_name,
                        levelID: level._id,
                        students: [],
                        teachers: [],
                        createdBy: currUser?._id,
                    });
                    await classroom.save();
                    console.log(`✅ Created new classroom: ${classroom_name}`);
                }
            } catch (error) {
                console.error(`❌ Error finding/saving classroom (${classroom_name}):`, error);
                continue;
            }

            student_email = `${student_email}@educativecloud.com`;
            let student;
            try {
                student = await User.findOne({ email: student_email, userType: "student" });
                if (!student) {
                    console.error(`❌ Error: Student with email '${student_email}' does not exist.`);
                    errors.push(`Row ${i}: Student '${student_email}' not found.`);
                    continue;
                }
            } catch (error) {
                console.error(`❌ Error finding/saving student (${student_email}):`, error);
                continue;
            }

            if (!classroom.students.includes(student._id)) {
                classroom.students.push(student._id);
            }

            if (teacher_email && subject_name && type) {
                console.log(`ℹ️ Processing teacher-subject assignment for: ${teacher_email} - ${subject_name}`);

                let teacher;



                try {
                    teacher = await User.findOne({ email: teacher_email, userType: "teacher" });
                    if (!teacher) {
                        console.error(`Error: Teacher with email '${teacher_email}' does not exist.`);
                        errors.push(`Row ${i}: Teacher '${teacher_email}' not found.`);
                        continue;
                    }
                } catch (error) {
                    console.error(`❌ Error finding/saving teacher (${teacher_email}):`, error);
                    continue;
                }

                let subject;

                try {
                    subject = await Subject.findOne({ name: subjectName, levelID: level._id });


                } catch (error) {
                    if (error.code === 11000) {
                        console.warn(`❌ Skipping duplicate subject: ${subject_name}`);
                    } else {
                        console.error(`❌ Error finding/saving subject (${subject_name}):`, error);
                    }
                    continue;
                }

                const teacherExistsInClassroom = classroom.teachers.some(
                    (t) =>
                        t.teacher.toString() === teacher._id.toString() &&
                        t.subject.toString() === subject._id.toString() &&
                        t.type === type
                );

                if (!teacherExistsInClassroom) {
                    classroom.teachers.push({
                        teacher: new mongoose.Types.ObjectId(teacher._id),
                        subject: new mongoose.Types.ObjectId(subject._id),
                        type: type,
                    });
                    console.log(`✅ Assigned Teacher: ${teacher.email} to Subject: ${subject.name} in Classroom: ${classroom.name}`);
                } else {
                    console.warn(`❌ Skipping duplicate teacher assignment: ${teacher_email} - ${subject_name}`);
                }
            }

            try {
                await classroom.save();
            } catch (error) {
                console.error(`❌ Error saving classroom (${classroom_name}):`, error);
            }
        } catch (error) {
            console.error("❌ Fatal error processing row:", error);
        }
    }
    return errors.length > 0 ? { success: false, errors } : { success: true, message: "Classroom CSV processed successfully" };

};





