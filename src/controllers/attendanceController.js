const { admin, db, FieldValue } = require("../config/firebase");
const {
  calculateNightDifferential,
} = require("../helpers/calculateNightDifferential");
const { computeHours } = require("../helpers/computeHours");

exports.punchIn = async function (req, res) {
  try {
    const { timestamp } = req.body;

    const date = new Date(timestamp).toLocaleDateString("en-CA");

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    const decoded = await admin.verifyIdToken(token);
    const uid = decoded.uid;

    const existing = await db
      .collection("attendance")
      .where("uid", "==", uid)
      .where("date", "==", date)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        status: false,
        message: "Already clocked in today",
      });
    }

    await db.collection("users").doc(uid).update({
      isActive: true,
    });

    await db.collection("attendance").add({
      uid,
      date,
      time: timestamp,
      timestamp: FieldValue.serverTimestamp(),
      status: "Active",
      type: "Time-in",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      status: true,
      message: "Punched in successfully",
    });
  } catch (error) {
    console.error("Error punching in:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.punchOut = async function (req, res) {
  try {
    const { timestamp } = req.body;

    const date = new Date(timestamp).toLocaleDateString("en-CA");

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    const decoded = await admin.verifyIdToken(token);
    const uid = decoded.uid;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();

    const attendanceSnap = await db
      .collection("attendance")
      .where("uid", "==", uid)
      .where("date", "==", date)
      .where("type", "==", "Time-in")
      .limit(1)
      .get();

    if (attendanceSnap.empty) {
      return res.status(400).json({
        status: false,
        message: "No time-in record found",
      });
    }

    const attendanceData = attendanceSnap.docs[0].data();

    const timeIn = attendanceData.time;
    const timeOut = timestamp;

    const actualIn = new Date(timeIn);
    const actualOut = new Date(timeOut);

    const schedule = userData.schedule || {
      start: "09:00",
      end: "18:00",
    };

    const [startHour, startMinute] = schedule.start.split(":").map(Number);

    const [endHour, endMinute] = schedule.end.split(":").map(Number);

    const shiftStart = new Date(actualIn);
    shiftStart.setHours(startHour, startMinute, 0, 0);

    const shiftEnd = new Date(actualIn);
    shiftEnd.setHours(endHour, endMinute, 0, 0);

    const shiftHours =
      (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

    const lateMinutes =
      actualIn > shiftStart
        ? Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60))
        : 0;

    const undertimeMinutes =
      actualOut < shiftEnd
        ? Math.floor((shiftEnd.getTime() - actualOut.getTime()) / (1000 * 60))
        : 0;

    const { totalWorkedHours } = computeHours(timeIn, timeOut);

    const regularHours = Math.min(totalWorkedHours, shiftHours);

    const overtimeHours =
      totalWorkedHours > shiftHours
        ? Number((totalWorkedHours - shiftHours).toFixed(2))
        : 0;

    const nightDifferentialHours = calculateNightDifferential(timeIn, timeOut);

    await db.collection("attendance").add({
      uid,
      date,
      time: timestamp,
      timestamp: FieldValue.serverTimestamp(),
      status: "Inactive",
      type: "Time-out",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const summaryRef = db.collection("dailysummary").doc(`${uid}_${date}`);

    await summaryRef.set(
      {
        userId: uid,
        date,
        totalWorkedHours,
        regularHours,
        overtimeHours,
        nightDifferentialHours,
        lateMinutes,
        undertimeMinutes,
        computedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await db.collection("users").doc(uid).update({
      isActive: false,
    });

    return res.status(200).json({
      status: true,
      message: "Punch out successful",
      data: {
        totalWorkedHours,
        regularHours,
        overtimeHours,
        nightDifferentialHours,
        lateMinutes,
        undertimeMinutes,
      },
    });
  } catch (error) {
    console.error("Error punching out:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.thisWeek = async function (req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { uid } = await admin.verifyIdToken(token);

    // Get week range (Mon–Sun)
    const now = new Date();
    const day = now.getDay();

    const start = new Date(now);
    start.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startDate = start.toLocaleDateString("en-CA");
    const endDate = end.toLocaleDateString("en-CA");

    const snap = await db
      .collection("dailysummary")
      .where("userId", "==", uid)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    const weeklySummary = snap.docs.reduce(
      (acc, doc) => {
        const d = doc.data();

        acc.regularHours += d.regularHours || 0;
        acc.overtimeHours += d.overtimeHours || 0;
        acc.nightDifferentialHours += d.nightDifferentialHours || 0;
        acc.lateMinutes += d.lateMinutes || 0;
        acc.undertimeMinutes += d.undertimeMinutes || 0;
        acc.totalWorkedHours += d.totalWorkedHours || 0;
        acc.daysWorked += 1;

        return acc;
      },
      {
        regularHours: 0,
        overtimeHours: 0,
        nightDifferentialHours: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        totalWorkedHours: 0,
        daysWorked: 0,
      },
    );

    return res.json({
      status: true,
      body: weeklySummary,
    });
  } catch (error) {
    console.error("Weekly summary error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.recentAttendance = async function (req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    const { uid } = await admin.verifyIdToken(token);

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const summarySnap = await db
      .collection("dailysummary")
      .where("userId", "==", uid)
      .orderBy("date", "desc")
      .get();

    const allSummaries = summarySnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const total = allSummaries.length;
    const totalPages = Math.ceil(total / limit);

    const start = (page - 1) * limit;
    const end = start + limit;

    const summaries = allSummaries.slice(start, end);

    const dates = summaries.map((item) => item.date);

    const attendanceSnap = await db
      .collection("attendance")
      .where("uid", "==", uid)
      .get();

    const attendanceMap = {};

    attendanceSnap.forEach((doc) => {
      const data = doc.data();

      if (!dates.includes(data.date)) return;

      if (!attendanceMap[data.date]) {
        attendanceMap[data.date] = {
          timeIn: null,
          timeOut: null,
        };
      }

      if (data.type === "Time-in") {
        attendanceMap[data.date].timeIn = data.time;
      }

      if (data.type === "Time-out") {
        attendanceMap[data.date].timeOut = data.time;
      }
    });

    const attendanceHistory = summaries.map((summary) => ({
      date: summary.date,
      timeIn: attendanceMap[summary.date]?.timeIn || null,
      timeOut: attendanceMap[summary.date]?.timeOut || null,
      regularHours: summary.regularHours || 0,
      overtimeHours: summary.overtimeHours || 0,
      lateMinutes: summary.lateMinutes || 0,
      undertimeMinutes: summary.undertimeMinutes || 0,
    }));

    return res.status(200).json({
      status: true,
      body: attendanceHistory,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      message: "Recent Attendance fetched successfully",
    });
  } catch (error) {
    console.error("Failed fetching Recent Attendance:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
