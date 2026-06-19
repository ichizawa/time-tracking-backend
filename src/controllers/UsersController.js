const { admin, db } = require("../config/firebase");

exports.userDetails = async function (req, res) {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Unauthorized, no token provided",
            });
        }

        const { uid } = await admin.verifyIdToken(token);

        const userDoc = await db
            .collection("users")
            .doc(uid)
            .get();

        const attendanceDoc = await db
            .collection("attendance")
            .where("uid", "==", uid)
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();

        const today = new Date().toLocaleDateString("en-CA");

        const attendanceSnap = await db
            .collection("attendance")
            .where("uid", "==", uid)
            .where("date", "==", today)
            .get();

        let timeInRecord = null;
        let timeOutRecord = null;

        attendanceSnap.forEach(doc => {
            const data = doc.data();

            if (data.type === "Time-in") {
                timeInRecord = data;
            }

            if (data.type === "Time-out") {
                timeOutRecord = data;
            }
        });

        const summaryDoc = await db
            .collection("dailysummary")
            .doc(`${uid}_${today}`)
            .get();

        return res.status(200).json({
            status: true,
            body: {
                ...userDoc.data(),

                timeInRecord,
                timeOutRecord,

                latestAttendance:
                    attendanceDoc.docs[0]?.data() || null,

                dailySummary:
                    summaryDoc.exists
                        ? summaryDoc.data()
                        : null,
            },
            message: "User details fetched successfully",
        });

    } catch (error) {
        console.error("Error getting user details", error);

        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
};