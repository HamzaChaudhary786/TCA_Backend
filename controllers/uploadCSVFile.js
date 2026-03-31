const fs = require("fs");
const csv = require("csv-parser");
const prisma = require("../db/prisma");

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
                    const validationErrors = await validateStudentData(results); 
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
                    const validationErrors = await validateClassroomData(results); 
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
    let errors = []; 

    try {
        for (const row of results) {
            try {
                let { ["Subject Name"]: subjectName, ["Level Name"]: levelName } = row;

                if (!subjectName || !levelName) {
                    const errMsg = `Skipping row due to missing required fields: ${JSON.stringify(row)}`;
                    console.warn(errMsg);
                    errors.push(errMsg);
                    continue;
                }

                subjectName = subjectName.trim().replace(/\s+/g, ' '); 
                levelName = levelName.trim().replace(/\s+/g, ' ');

                console.log(`Processing Subject: ${subjectName} for Level: ${levelName}`);

                let level = await prisma.level.findUnique({ where: { name: levelName } });
                if (!level) {
                    console.log(`Creating new level: ${levelName}`);
                    level = await prisma.level.create({ data: { name: levelName } });
                    console.log(`Level created successfully: ${levelName}`);
                }
                const levelID = level.id;

                const existingSubject = await prisma.subject.findUnique({ 
                    where: { 
                        name_levelID: { name: subjectName, levelID: levelID } 
                    } 
                });
                
                if (existingSubject) {
                    const errMsg = `Skipping: Subject '${subjectName}' already exists in level '${levelName}'.`;
                    console.warn(errMsg);
                    continue;
                }

                console.log(`Adding new subject: ${subjectName} under level: ${levelName}`);

                await prisma.subject.create({
                    data: {
                        name: subjectName,
                        levelID: levelID,
                    }
                });
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
        
        const levelName = LevelName.replace(/\s+/g, ' ').trim();

        try {
            const level = await prisma.level.findUnique({ where: { name: levelName } });
            if (!level) {
                return [`Row ${i + 2}: Level '${levelName}' does not exist.`];
            }
        } catch (error) {
            console.error(`❌ Error validating row ${i + 2}:`, error);
            return [`Row ${i + 2}: Error during validation.`];
        }
    }

    return []; 
};

// Function to process Student CSV
const processStudentCSV = async (results) => {
    let errors = []; 
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
            // Take the first level basically, since Prisma Level name is unique
            let levelNames = LevelName.split(",").map(name => name.trim().replace(/\s+/g, ' '));
            
            let level = await prisma.level.findFirst({ where: { name: { in: levelNames } } });
            if(!level) {
                errors.push(`Row ${i}: Level not found for parsing.`);
                continue;
            }
            const levelID = level.id;

            const studentEmail = Email && Email.trim() !== "" ? Email : `${rollNumberString}@educativecloud.com`;
            const guardianEmail = GuardianEmail && GuardianEmail.trim() !== "" ? GuardianEmail : `${rollNumberString}.guardian@educativecloud.com`;
            const generatedReferenceNo = (CardNumber && CardNumber !== '0')
                ? CardNumber
                : `${Date.now()}${Math.floor(Math.random() * 1000)}`;

            // Upsert Student
            const studentData = {
                name: Name,
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
            };

            await prisma.user.upsert({
                where: { email: studentEmail },
                update: studentData,
                create: {
                    ...studentData,
                    email: studentEmail
                }
            });

            // Upsert Parent
            const parentData = {
                name: FatherName,
                phoneNumber: GuardianPhone || "000000",
                userType: "parent",
                isAccepted: true,
                password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                rollNo: `${rollNumberString}-Parent`,
                referenceNo: `${generatedReferenceNo}786`,
            };

            await prisma.user.upsert({
                where: { email: guardianEmail },
                update: parentData,
                create: {
                    ...parentData,
                    email: guardianEmail
                }
            });
            
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
    let errors = []; 

    for (const row of results) {
        try {
            const {
                ["Teacher Phone"]: TeacherPhone,
                ["Teacher Name"]: Name,
                ["Teacher Email"]: Email,
                ["Teacher Employee ID"]: TeacherEmployeeID
            } = row;

            if (!Email || !Name) {
                const errorMsg = `Skipping row due to missing required fields: ${JSON.stringify(row)}`;
                console.warn(errorMsg);
                errors.push(errorMsg);
                continue;
            }

            console.log(`Processing Teacher: ${Name}, Email: ${Email}`);

            const teacherExists = await prisma.user.findUnique({ where: { email: Email } });
            if (teacherExists) {
                const errorMsg = `Skipping row as teacher already exists: ${JSON.stringify(row)}`;
                console.warn(errorMsg);
                continue;
            }

            const generatedRollNo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

            await prisma.user.create({
                data: {
                    name: Name,
                    email: Email,
                    referenceNo: TeacherEmployeeID,
                    phoneNumber: TeacherPhone || "000000",
                    isAccepted: true,
                    gender: "not specified",
                    userType: "teacher",
                    password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                    rollNo: generatedRollNo,
                }
            });

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
        const subjectName = subject_name ? subject_name.replace(/\s+/g, ' ').trim() : null;

        try {
            const level = await prisma.level.findUnique({ where: { name: levelName } });
            if (!level) {
                return [`Row ${i + 1}: Level '${levelName}' does not exist.`];
            }

            student_email = `${student_email}@educativecloud.com`;

            const student = await prisma.user.findFirst({ where: { email: student_email, userType: "student" } });
            if (!student) {
                return [`Row ${i + 1}: Student with email '${student_email}' does not exist.`];
            }

            if (teacher_email) {
                const teacher = await prisma.user.findFirst({ where: { email: teacher_email, userType: "teacher" } });
                if (!teacher) {
                    return [`Row ${i + 1}: Teacher with email '${teacher_email}' does not exist.`];
                }
            }

            if (subjectName && level) {
                const subject = await prisma.subject.findFirst({ where: { name: subjectName, levelID: level.id } });
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

    return []; 
};



const processClassroomCSV = async (results, currUser) => {
    let errors = [];
    let i = 1;
    for (const row of results) {
        try {
            let { classroom_name, level_name, student_email, teacher_email, subject_name, type } = row;

            let level;
            let levelName = level_name.replace(/\s+/g, ' ').trim();
            const subjectName = subject_name ? subject_name.replace(/\s+/g, ' ').trim() : null;

            try {
                level = await prisma.level.findUnique({ where: { name: levelName } });

                if (!level) {
                    console.error(`❌ Error: Level '${levelName}' does not exist.`);
                    errors.push(`Row ${i}: Level '${levelName}' not found.`);
                    return false;
                }
            } catch (error) {
                console.error(`❌ Error finding level (${level_name}):`, error);
                return false;
            }

            let classroom;
            try {
                classroom = await prisma.classroom.findUnique({ 
                    where: { 
                        name_levelID: { name: classroom_name, levelID: level.id } 
                    },
                    include: { students: true, teachers: true }
                });
                if (!classroom) {
                    classroom = await prisma.classroom.create({
                        data: {
                            name: classroom_name,
                            levelID: level.id,
                            createdBy: currUser?.id || null,
                        },
                        include: { students: true, teachers: true }
                    });
                    console.log(`✅ Created new classroom: ${classroom_name}`);
                }
            } catch (error) {
                console.error(`❌ Error finding/saving classroom (${classroom_name}):`, error);
                continue;
            }

            student_email = `${student_email}@educativecloud.com`;
            let student;
            try {
                student = await prisma.user.findFirst({ where: { email: student_email, userType: "student" } });
                if (!student) {
                    console.error(`❌ Error: Student with email '${student_email}' does not exist.`);
                    errors.push(`Row ${i}: Student '${student_email}' not found.`);
                    continue;
                }
            } catch (error) {
                console.error(`❌ Error finding student (${student_email}):`, error);
                continue;
            }

            if (!classroom.students.some(s => s.id === student.id)) {
                classroom = await prisma.classroom.update({
                    where: { id: classroom.id },
                    data: {
                        students: {
                            connect: { id: student.id }
                        }
                    },
                    include: { students: true, teachers: true }
                });
            }

            if (teacher_email && subject_name && type) {
                console.log(`ℹ️ Processing teacher-subject assignment for: ${teacher_email} - ${subject_name}`);

                let teacher;

                try {
                    teacher = await prisma.user.findFirst({ where: { email: teacher_email, userType: "teacher" } });
                    if (!teacher) {
                        console.error(`Error: Teacher with email '${teacher_email}' does not exist.`);
                        errors.push(`Row ${i}: Teacher '${teacher_email}' not found.`);
                        continue;
                    }
                } catch (error) {
                    console.error(`❌ Error finding teacher (${teacher_email}):`, error);
                    continue;
                }

                let subject;

                try {
                    subject = await prisma.subject.findFirst({ where: { name: subjectName, levelID: level.id } });
                    if(!subject) {
                        console.error(`❌ Subject ${subjectName} not found.`);
                        continue;
                    }

                } catch (error) {
                    console.error(`❌ Error finding subject (${subject_name}):`, error);
                    continue;
                }

                const teacherExistsInClassroom = classroom.teachers.some(
                    (t) =>
                        t.teacherID === teacher.id &&
                        t.subjectID === subject.id &&
                        t.type === type
                );

                if (!teacherExistsInClassroom) {
                    await prisma.classroomTeacher.create({
                        data: {
                            classroomID: classroom.id,
                            teacherID: teacher.id,
                            subjectID: subject.id,
                            type: type,
                        }
                    });
                    console.log(`✅ Assigned Teacher: ${teacher.email} to Subject: ${subject.name} in Classroom: ${classroom.name}`);
                } else {
                    console.warn(`❌ Skipping duplicate teacher assignment: ${teacher_email} - ${subject_name}`);
                }
            }
        } catch (error) {
            console.error("❌ Fatal error processing row:", error);
        }
    }
    return errors.length > 0 ? { success: false, errors } : { success: true, message: "Classroom CSV processed successfully" };
};





