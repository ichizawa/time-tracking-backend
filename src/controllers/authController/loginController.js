const { admin, db } = require("../../config/firebase");

exports.login = async function (req, res) {
  try {
    const authHeaders = req.headers.authorization;

    if(!authHeaders) return res.status(401).json({ message: "Unauthorized, no token provided" });

    const token = authHeaders.split(" ")[1];
    const decodedToken = await admin.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();

    return res.status(200).json({ status: true, body: userDoc.data(), message: "Login successful" });
  } catch (error) {
    console.error("Error logging in", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
