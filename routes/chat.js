const express = require("express");
const router = express.Router();
const multer = require("multer");
const { chatWithAI, generateImage, analyzeImage } = require("../controllers/chat");
const { checkLoggedIn } = require("../middlewares/checkLoggedIn");

// Memory storage so we can read buffer directly (no disk writes)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"), false);
        }
    },
});

// Text chat (existing)
router.post("/", checkLoggedIn, chatWithAI);

// Image generation
router.post("/generate-image", checkLoggedIn, generateImage);

// Image analysis (vision)
router.post("/analyze-image", checkLoggedIn, upload.single("image"), analyzeImage);

module.exports = router;
