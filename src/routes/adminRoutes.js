const express = require("express");
const router = express.Router();

router.get("/get-all-users", require("../controllers/UsersController").viewAllUsers);
router.get("/get-all-attendance", require("../controllers/attendanceController").viewAllAttendance);
router.get("/daily-report", require("../controllers/attendanceController").dailyReport);
router.get("/weekly-report", require("../controllers/attendanceController").weeklyReport);

router.put("/update-attendance", require("../controllers/attendanceController").updateAttendance);

router.get("/dashboard", require("../controllers/adminDashboardController").getDashboard);

module.exports = router;