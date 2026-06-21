const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// const serviceAccount = require("./timetracker-test-8746c-firebase-adminsdk-fbsvc-3febcd410b.json");

// const app = initializeApp({
//   credential: cert(serviceAccount),
// });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);
const admin = getAuth(app);

module.exports = { db, admin, FieldValue };