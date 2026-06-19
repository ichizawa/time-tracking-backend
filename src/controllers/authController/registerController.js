const { admin, db, FieldValue } = require("../../config/firebase");

exports.register = async function (req, res) {
    try {
        const { firstName, lastName, email, password, timezone, startShift, endShift } = req.body;

        if (!firstName || !lastName || !email || !password || !timezone || !startShift || !endShift) {
            return res.status(400).json({ status: false, message: "First name, last name, email, password, timezone, shift start and shift end are required" });
        }

        try {
            await admin.getUserByEmail(email);

            return res.status(400).json({ message: "Email already exists" });
        } catch (error) {
            if (error.code !== "auth/user-not-found") {
                throw error;
            }
        }

        const user = await admin.createUser({
            email,
            password,
        });

        await db.collection("users").doc(user.uid).set({
            uid: user.uid,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email,
            role: "employee",
            timezone,
            schedule: {
                start: startShift,
                end: endShift,
            },
            isActive: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return res.status(200).json({ status: true, message: "Registration successful" });
    } catch (error) {
        // console.error("Code:", error.code);
        console.error("Message:", error.message);
        // console.error(error);
        return res.status(500).json({ status: false, message: "Internal server error, please try again" });
    }
};
