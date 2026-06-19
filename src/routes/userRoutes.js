const express = require("express");
const router = express.Router();

router.post("/timeIn", require("../controllers/attendanceController").punchIn);
router.post("/timeOut", require("../controllers/attendanceController").punchOut);
router.get("/me", require("../controllers/UsersController").userDetails);
router.get("/thisWeek", require("../controllers/attendanceController").thisWeek);
router.get("/recent-attendance", require("../controllers/attendanceController").recentAttendance);

module.exports = router;