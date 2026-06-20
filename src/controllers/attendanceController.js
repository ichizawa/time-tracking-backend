const { admin, db, FieldValue } = require("../config/firebase");
const {
  calculateNightDifferential,
} = require("../helpers/calculateNightDifferential");
const { computeHours } = require("../helpers/computeHours");
const { format24Hour } = require("../helpers/format24Hours");

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

    const summaryRef = db.collection("dailysummary").doc(`${uid}_${date}`);

    const summaryDoc = await summaryRef.get();

    if (!summaryDoc.exists) {
      await summaryRef.set({
        userId: uid,
        date,

        timeIn: timestamp,
        timeOut: null,

        totalWorkedHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        nightDifferentialHours: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,

        status: "Active",

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

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

    await summaryRef.update({
      timeOut: timestamp,

      totalWorkedHours,
      regularHours,
      overtimeHours,
      nightDifferentialHours,
      lateMinutes,
      undertimeMinutes,

      status: "Completed",

      computedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

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
      timeIn: format24Hour(attendanceMap[summary.date]?.timeIn) || null,
      timeOut: format24Hour(attendanceMap[summary.date]?.timeOut) || null,
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

exports.viewAllAttendance = async function (req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
      });
    }

    await admin.verifyIdToken(token);

    const usersSnapshot = await db.collection("users").get();
    // console.log("Users count:", usersSnapshot.size);
    const summarySnapshot = await db.collection("dailysummary").get();
    // console.log("Summary count:", summarySnapshot.size);
    const attendanceSnapshot = await db.collection("attendance").get();

    const usersMap = {};

    usersSnapshot.forEach((doc) => {
      const user = doc.data();
      usersMap[user.uid] = user;
    });

    const attendanceMap = {};

    attendanceSnapshot.forEach((doc) => {
      const attendance = doc.data();

      const key = `${attendance.uid}_${attendance.date}`;

      if (!attendanceMap[key]) {
        attendanceMap[key] = {
          timeIn: null,
          timeOut: null,
        };
      }

      if (attendance.type === "Time-in") {
        attendanceMap[key].timeIn = attendance.time;
      }

      if (attendance.type === "Time-out") {
        attendanceMap[key].timeOut = attendance.time;
      }
    });

    const timesheets = [];

    summarySnapshot.forEach((doc) => {
      const summary = doc.data();

      const user = usersMap[summary.userId];

      if (!user) return;

      const attendance =
        attendanceMap[`${summary.userId}_${summary.date}`] || {};

      timesheets.push({
        id: doc.id,

        uid: user.uid,
        employee: user.fullName,
        email: user.email,
        role: user.role,

        date: summary.date,

        clockIn: format24Hour(attendance.timeIn) || null,
        clockOut: format24Hour(attendance.timeOut) || null,

        totalHours: summary.totalWorkedHours,
        regularHours: summary.regularHours,
        overtime: summary.overtimeHours,
        lateMinutes: summary.lateMinutes,
        undertimeMinutes: summary.undertimeMinutes,
        nightDifferentialHours: summary.nightDifferentialHours,

        status: summary.totalWorkedHours > 0 ? "complete" : "absent",
      });
    });

    return res.status(200).json({
      status: true,
      body: timesheets,
      message: "All Attendance fetched successfully",
    });
  } catch (error) {
    console.error("Failed fetching All Attendance:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.weeklyReport = async function (req, res) {
  try {
    const now = new Date();
    const day = now.getDay();

    const start = new Date(now);
    start.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startDate = start.toLocaleDateString("en-CA");
    const endDate = end.toLocaleDateString("en-CA");

    // Get this week's attendance summaries
    const attendanceSnap = await db
      .collection("dailysummary")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    const weeklySummaries = {};

    attendanceSnap.forEach((doc) => {
      const data = doc.data();
      const uid = data.uid || data.userId;

      if (!weeklySummaries[uid]) {
        weeklySummaries[uid] = {
          uid,
          regularHours: 0,
          overtimeHours: 0,
          nightDifferentialHours: 0,
          lateMinutes: 0,
          undertimeMinutes: 0,
          totalWorkedHours: 0,
          daysWorked: 0,
        };
      }

      weeklySummaries[uid].regularHours += data.regularHours || 0;
      weeklySummaries[uid].overtimeHours += data.overtimeHours || 0;
      weeklySummaries[uid].nightDifferentialHours += data.nightDifferentialHours || 0;
      weeklySummaries[uid].lateMinutes += data.lateMinutes || 0;
      weeklySummaries[uid].undertimeMinutes += data.undertimeMinutes || 0;
      weeklySummaries[uid].totalWorkedHours += data.totalWorkedHours || 0;
      weeklySummaries[uid].daysWorked += 1;
    });

    // Get all users
    const userSnap = await db.collection("users").get();

    const usersMap = {};

    userSnap.forEach((doc) => {
      const user = doc.data();

      usersMap[doc.id] = {
        fullName: user.fullName || "",
        email: user.email || "",
        role: user.role || "",
      };
    });

    // Merge user info with weekly summary
    const result = Object.values(weeklySummaries).map((summary) => ({
      ...summary,
      fullName: usersMap[summary.uid]?.fullName || "Unknown User",
      email: usersMap[summary.uid]?.email || "",
      role: usersMap[summary.uid]?.role || "",
    }));

    return res.json({
      status: true,
      body: result,
    });
  } catch (error) {
    console.error("Weekly summary error:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.dailyReport = async function (req, res) {
  try {
    const today = new Date().toLocaleDateString("en-CA");

    // Daily Summary
    const summarySnap = await db
      .collection("dailysummary")
      .where("date", "==", today)
      .get();

    // Attendance Records
    const attendanceSnap = await db
      .collection("attendance")
      .where("date", "==", today)
      .get();

    // Users
    const usersSnap = await db.collection("users").get();

    const usersMap = {};

    usersSnap.forEach((doc) => {
      const user = doc.data();

      usersMap[doc.id] = {
        fullName: user.fullName || "",
        email: user.email || "",
        role: user.role || "",
      };
    });

    // Group attendance by user
    const attendanceMap = {};

    attendanceSnap.forEach((doc) => {
      const attendance = doc.data();
      const uid = attendance.uid;

      if (!attendanceMap[uid]) {
        attendanceMap[uid] = {
          timeIn: null,
          timeOut: null,
        };
      }

      if (attendance.type === "Time-in") {
        attendanceMap[uid].timeIn = attendance.time;
      }

      if (attendance.type === "Time-out") {
        attendanceMap[uid].timeOut = attendance.time;
      }
    });

    const result = [];

    summarySnap.forEach((doc) => {
      const summary = doc.data();
      const uid = summary.uid || summary.userId;

      result.push({
        uid,
        date: summary.date,

        fullName: usersMap[uid]?.fullName || "Unknown User",
        email: usersMap[uid]?.email || "",
        role: usersMap[uid]?.role || "",

        timeIn: format24Hour(attendanceMap[uid]?.timeIn) || null,
        timeOut: format24Hour(attendanceMap[uid]?.timeOut) || null,

        regularHours: summary.regularHours || 0,
        overtimeHours: summary.overtimeHours || 0,
        nightDifferentialHours: summary.nightDifferentialHours || 0,
        lateMinutes: summary.lateMinutes || 0,
        undertimeMinutes: summary.undertimeMinutes || 0,
        totalWorkedHours: summary.totalWorkedHours || 0,
      });
    });

    return res.status(200).json({
      status: true,
      body: result,
      message: "Daily report fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching daily report:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.updateAttendance = async function (req, res) {
  try {
    const {
      id,
      uid,
      date,
      clockIn,
      clockOut,
      totalHours,
      regularHours,
      overtime,
      lateMinutes,
      undertimeMinutes,
      nightDifferentialHours,
      status,
    } = req.body;

    if (!id || !uid || !date) {
      return res.status(400).json({
        status: false,
        message: "id, uid and date are required",
      });
    }

    const batch = db.batch();

    const summaryRef = db.collection("dailysummary").doc(id);

    batch.set(
      summaryRef,
      {
        userId: uid,
        date,

        totalWorkedHours: Number(totalHours) || 0,
        regularHours: Number(regularHours) || 0,
        overtimeHours: Number(overtime) || 0,

        lateMinutes: Number(lateMinutes) || 0,
        undertimeMinutes: Number(undertimeMinutes) || 0,

        nightDifferentialHours:
          Number(nightDifferentialHours) || 0,

        status,

        computedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const attendanceSnap = await db
      .collection("attendance")
      .where("uid", "==", uid)
      .where("date", "==", date)
      .get();

    attendanceSnap.forEach((doc) => {
      const attendance = doc.data();

      if (attendance.type === "Time-in" && clockIn) {
        const timeInISO = new Date(
          `${date}T${clockIn}:00`
        ).toISOString();

        batch.update(doc.ref, {
          time: timeInISO,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (attendance.type === "Time-out" && clockOut) {
        const timeOutISO = new Date(
          `${date}T${clockOut}:00`
        ).toISOString();

        batch.update(doc.ref, {
          time: timeOutISO,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    await batch.commit();

    return res.status(200).json({
      status: true,
      message: "Attendance updated successfully",
    });
  } catch (error) {
    console.error("Error updating attendance:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};