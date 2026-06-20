const { admin, db } = require("../config/firebase");

exports.getDashboard = async function (req, res) {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [usersSnapshot, summarySnapshot, attendanceSnapshot] =
      await Promise.all([
        db.collection("users").get(),
        db.collection("dailySummary").where("date", "==", today).get(),
        db.collection("attendance").where("date", "==", today).get(),
      ]);

    const attendanceMap = {};

    attendanceSnapshot.forEach((doc) => {
      const attendance = doc.data();

      if (!attendanceMap[attendance.uid]) {
        attendanceMap[attendance.uid] = {
          timeIn: null,
          timeOut: null,
          status: "Absent",
        };
      }

      if (attendance.type === "Time-in") {
        attendanceMap[attendance.uid].timeIn = attendance.time;
        attendanceMap[attendance.uid].status = "Present";
      }

      if (attendance.type === "Time-out") {
        attendanceMap[attendance.uid].timeOut = attendance.time;
      }
    });

    const summaryMap = {};

    summarySnapshot.forEach((doc) => {
      const summary = doc.data();
      summaryMap[summary.userId] = summary;
    });

    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalNightDifferentialHours = 0;
    let totalLateMinutes = 0;
    let totalUndertimeMinutes = 0;
    let totalWorkedHours = 0;

    let present = 0;
    let absent = 0;

    const employeesToday = [];

    usersSnapshot.forEach((doc) => {
      const user = doc.data();

      const summary = summaryMap[user.uid] || {};
      const attendance = attendanceMap[user.uid] || {
        timeIn: null,
        timeOut: null,
        status: "Absent",
      };

      if (attendance.status === "Present") {
        present++;
      } else {
        absent++;
      }

      totalRegularHours += Number(summary.regularHours || 0);
      totalOvertimeHours += Number(summary.overtimeHours || 0);
      totalNightDifferentialHours += Number(summary.nightDifferentialHours || 0);
      totalLateMinutes += Number(summary.lateMinutes || 0);
      totalUndertimeMinutes += Number(summary.undertimeMinutes || 0);
      totalWorkedHours += Number(summary.totalWorkedHours || 0);

      employeesToday.push({
        uid: user.uid,
        fullName: user.fullName,
        email: user.email,
        role: user.role,

        timeIn: attendance.timeIn,
        timeOut: attendance.timeOut,
        attendanceStatus: attendance.status,

        regularHours: Number(summary.regularHours || 0),
        overtimeHours: Number(summary.overtimeHours || 0),
        nightDifferentialHours: Number(summary.nightDifferentialHours || 0),
        lateMinutes: Number(summary.lateMinutes || 0),
        undertimeMinutes: Number(summary.undertimeMinutes || 0),
        totalWorkedHours: Number(summary.totalWorkedHours || 0),

        summaryStatus: summary.status || "No Record",
      });
    });

    employeesToday.sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );

    return res.status(200).json({
      status: true,
      date: today,

      kpis: {
        totalEmployees: usersSnapshot.size,
        present,
        absent,

        regularHours: Number(totalRegularHours.toFixed(2)),
        overtimeHours: Number(totalOvertimeHours.toFixed(2)),
        nightDifferentialHours: Number(
          totalNightDifferentialHours.toFixed(2)
        ),
        lateMinutes: totalLateMinutes,
        undertimeMinutes: totalUndertimeMinutes,
        totalWorkedHours: Number(totalWorkedHours.toFixed(2)),
      },

      employeesToday,
    });
  } catch (error) {
    console.error("Error getting dashboard:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};