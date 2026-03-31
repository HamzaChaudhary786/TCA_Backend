const prisma = require("../db/prisma");

exports.addHeadAttendanceSetting = async (req, res, next) => {
    try {
        const { enableHeadAttendance } = req.body;

        // Check if setting already exists (we usually only want one setting record)
        let setting = await prisma.systemSetting.findFirst();

        if (setting) {
            setting = await prisma.systemSetting.update({
                where: { id: setting.id },
                data: { enableHeadAttendance: enableHeadAttendance }
            });
        } else {
            setting = await prisma.systemSetting.create({
                data: { enableHeadAttendance: enableHeadAttendance }
            });
        }

        res.status(201).json(setting); 
    } catch (err) {
        next(err); 
    }
};

exports.updateHeadAttendanceSetting = async (req, res, next) => {
    try {
        const { settingId, enableHeadAttendance } = req.body;

        const updatedSetting = await prisma.systemSetting.update({
            where: { id: settingId },
            data: { enableHeadAttendance: enableHeadAttendance }
        });

        res.status(200).json(updatedSetting);
    } catch (err) {
        if (err.code === "P2025") { // Prisma not found error
            return res.status(404).json({ message: "Setting not found" });
        }
        next(err);
    }
};

exports.getSettings = async (req, res, next) => {
    try {
        const setting = await prisma.systemSetting.findFirst(); 

        if (!setting) {
            return res.status(404).json({ message: "Setting not found" });
        }

        res.status(200).json({
            id: setting.id,
            attendenceSetting: {
                enableHeadAttendance: setting.enableHeadAttendance
            },
            createdAt: setting.createdAt,
            updatedAt: setting.updatedAt
        });
    } catch (err) {
        next(err); 
    }
};
