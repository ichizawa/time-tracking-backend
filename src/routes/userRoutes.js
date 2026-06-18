const express = require("express");
const router = express.Router();

router.post("/timeIn", require("../controllers/attendanceController").punchIn);
router.post("/timeOut", require("../controllers/attendanceController").punchOut);

module.exports = router;