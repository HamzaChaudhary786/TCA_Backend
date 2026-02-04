
const Setting = require("../models/settingsModel");

exports.addHeadAttendanceSetting = async (req, res, next) => {
    try {
        const { enableHeadAttendance } = req.body;

        // Create a new attendance setting
        const newSetting = new Setting({
            attendenceSetting: {
                enableHeadAttendance: enableHeadAttendance, // Set the initial value
            },
        });

        // Save the setting to the database
        const savedSetting = await newSetting.save();

        res.status(201).json(savedSetting); // Respond with the created setting
    } catch (err) {
        next(err); // Pass error to middleware
    }
};



exports.updateHeadAttendanceSetting = async (req, res, next) => {
    try {
        const { settingId, enableHeadAttendance } = req.body;

        // Find the setting by ID and update it
        const updatedSetting = await Setting.findByIdAndUpdate(
            settingId,
            {
                $set: {
                    "attendenceSetting.enableHeadAttendance": enableHeadAttendance, // Update nested field
                    updatedAt: Date.now(),
                },
            },
            { new: true } // Return the updated document
        );

        if (!updatedSetting) {
            return res.status(404).json({ message: "Setting not found" });
        }

        res.status(200).json(updatedSetting); // Respond with updated setting
    } catch (err) {
        next(err); // Pass error to middleware
    }
};

exports.getSettings = async (req, res, next) => {
    try {
        console.log("run inside function");

        // Use the compiled model
        const setting = await Setting.findOne(); // Fetch first document

        console.log(setting, "setting");


        // Check if no data is found
        if (!setting) {
            return res.status(404).json({ message: "Setting not found" });
        }

        // Return the setting object
        res.status(200).json(setting);
    } catch (err) {
        next(err); // Pass error to middleware
    }
};


