const express = require("express");
const router = express.Router();
const createStudentPromotion = require('../controllers/studentPromote');

router.post('/student-promote', createStudentPromotion);

module.exports = router;
