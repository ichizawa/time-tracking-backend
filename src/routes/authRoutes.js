const express = require("express");
const router = express.Router();

router.post("/login", require("../controllers/authController/loginController").login);
router.post("/register", require("../controllers/authController/registerController").register);

module.exports = router;
