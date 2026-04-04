const prisma = require("../db/prisma");
const { sendMessage } = require("./whatsapp/whatsapp");
const { normalizePhoneNumber } = require("../utils/whatsappUtils");

exports.generateFees = async (req, res, next) => {
    try {
        const { levelID, classroomID, amount, month, year, type, dueDate, description } = req.body;

        if (!amount || !year || !type || !dueDate) {
            return res.status(400).json({ message: "Amount, year, type, and due date are required." });
        }

        let studentFilter = { userType: "student" };
        if (levelID) studentFilter.levelID = levelID;
        
        if (classroomID) {
            const classroom = await prisma.classroom.findUnique({
                where: { id: classroomID },
                include: { students: { select: { id: true } } }
            });
            if (classroom) {
                studentFilter.id = { in: classroom.students.map(s => s.id) };
            }
        }

        const students = await prisma.user.findMany({
            where: studentFilter,
            select: { id: true, name: true, guardianPhoneNumber: true }
        });

        if (students.length === 0) {
            return res.status(404).json({ message: "No students found for the selected criteria." });
        }

        const feeRecords = students.map(student => ({
            studentID: student.id,
            amount: parseFloat(amount),
            month: month ? parseInt(month) : null,
            year: parseInt(year),
            type,
            dueDate: new Date(dueDate),
            description,
            status: "unpaid"
        }));

        await prisma.fee.createMany({
            data: feeRecords
        });

        // WhatsApp Notification logic
        const monthName = month ? new Array(12).fill(null).map((_, i) => new Date(0, i).toLocaleString('en-US', { month: 'long' }))[month - 1] : "";
        const billingPeriod = month ? `${monthName} ${year}` : `${year}`;
        
        console.info(`📢 Starting WhatsApp notifications for ${students.length} students...`);

        const notifications = students.map(async (student) => {
            if (student.guardianPhoneNumber) {
                const normalizedPhone = normalizePhoneNumber(student.guardianPhoneNumber);
                const message = `🔔 *Fee Notification*\n\nDear Parent,\n\nMonthly fee for *${student.name}* for ${billingPeriod} has been generated.\n\n*Amount:* ${amount}\n*Due Date:* ${new Date(dueDate).toLocaleDateString()}\n\nPlease pay at your earliest convenience to avoid login interruption.\n\nThank you,\nTimeline Academy`;
                
                try {
                    await sendMessage(normalizedPhone, message);
                    console.info(`✅ Fee notification sent to ${student.name} (${normalizedPhone})`);
                } catch (err) {
                    console.error(`❌ Failed to send fee notification to ${student.name}:`, err.message);
                }
            } else {
                console.warn(`⚠️ Skipped notification for ${student.name}: No guardian phone number.`);
            }
        });

        // Use Promise.allSettled so one failure doesn't block others, but we wait for all to finish
        await Promise.allSettled(notifications);

        res.status(201).json({
            success: true,
            message: `Fees generated for ${students.length} students.`,
            count: students.length
        });

    } catch (error) {
        next(error);
    }
};

exports.getStudentFees = async (req, res, next) => {
    try {
        const { studentID } = req.params;
        const fees = await prisma.fee.findMany({
            where: { studentID },
            orderBy: { createdAt: 'desc' }
        });
        res.json(fees);
    } catch (error) {
        next(error);
    }
};

exports.getAllFees = async (req, res, next) => {
    try {
        const fees = await prisma.fee.findMany({
            include: {
                student: {
                    select: { name: true, rollNo: true, level: { select: { name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(fees);
    } catch (error) {
        next(error);
    }
};

exports.updateFeeStatus = async (req, res, next) => {
    try {
        const { feeID } = req.params;
        const { status, paidAt } = req.body;

        const updatedFee = await prisma.fee.update({
            where: { id: feeID },
            data: {
                status,
                paidAt: status === "paid" ? (paidAt ? new Date(paidAt) : new Date()) : null
            }
        });

        res.json({
            success: true,
            message: "Fee status updated successfully.",
            fee: updatedFee
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteFee = async (req, res, next) => {
    try {
        const { feeID } = req.params;
        await prisma.fee.delete({ where: { id: feeID } });
        res.json({ success: true, message: "Fee record deleted." });
    } catch (error) {
        next(error);
    }
};
