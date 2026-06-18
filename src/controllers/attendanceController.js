const { admin, db, FieldValue } = require("../config/firebase");
const { computeHours } = require("../helpers/computeHours");

exports.punchIn = async function (req, res) {
    try {
        const { user_id, date, time_in, status } = req.body;

        const getAuth = req.headers.authorization;
        const token = authHeader?.split(" ")[1];

        const decoded = await admin.verifyIdToken(token);
        const uid = decoded.uid;

        const existing = await db.collection("attendance")
            .where("uid", "==", uid)
            .where("date", "==", date)
            .limit(1)
            .get();

        if (!existing.empty) {
            return res.status(400).json({
                status: false,
                message: "Already clocked in today"
            });
        }

        await db.collection("users").doc(uid).update({
            isActive: true
        });

        await db.collection("attendance").add({
            uid,
            date,
            time_in,
            time_out: null,
            status: "Active",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error punching in:", error.message);
        return res.status(500).json({ status: false, message: "Internal server error" });
    }
}

exports.punchOut = async function (req, res) {
    try {
        const { date, time_out } = req.body;

        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];

        const decoded = await admin.auth().verifyIdToken(token);
        const uid = decoded.uid;

        const existingSnap = await db.collection("attendance")
            .where("uid", "==", uid)
            .where("date", "==", date)
            .limit(1)
            .get();

        if (existingSnap.empty) {
            return res.status(400).json({
                status: false,
                message: "Not clocked in today"
            });
        }

        const attendanceDoc = existingSnap.docs[0];
        const attendanceData = attendanceDoc.data();

        const { totalWorkedHours } = computeHours(attendanceData.time_in, time_out);

        await attendanceDoc.ref.update({
            time_out,
            status: "Completed",
            updatedAt: FieldValue.serverTimestamp()
        });

        const regularHours = Math.min(8, totalWorkedHours);
        const overtimeHours = totalWorkedHours > 8 ? totalWorkedHours - 8 : 0;

        const summaryRef = db.collection("dailysummary")
            .doc(`${uid}_${date}`);

        await summaryRef.set({
            userId: uid,
            date,
            regularHours,
            overtimeHours,
            nightDifferentialHours: 0,
            lateMinutes: 0,
            undertimeMinutes: 0,
            totalWorkedHours,
            computedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        await db.collection("users").doc(uid).update({
            isActive: false
        });

        return res.json({
            status: true,
            message: "Punch out successful",
            data: {
                totalWorkedHours,
                regularHours,
                overtimeHours
            }
        });

    } catch (error) {
        console.error("Error punching out:", error.message);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
};