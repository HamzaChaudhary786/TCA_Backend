const router = require("express").Router();
const { addCSVFile } = require("../controllers/uploadCSVFile");
const multer = require('multer');


const upload = multer({ dest: 'uploads/' });


router.post("/csv-file", upload.single('file'), addCSVFile);


module.exports = router;
