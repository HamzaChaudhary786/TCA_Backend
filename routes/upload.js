const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../controllers/upload');

// Set up Multer for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define the route
router.post('/', upload.single('file'), uploadFile);

module.exports = router;
