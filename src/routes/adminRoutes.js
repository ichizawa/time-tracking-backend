const express = require("express");
const router = express.Router();

router.get("/get-all-users", require("../controllers/UsersController").viewAllUsers);
router.get("/get-all-attendance", require("../controllers/attendanceController").viewAllAttendance);

module.exports = router;