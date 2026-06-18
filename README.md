# Express.js + Firestore Backend API

A simple and scalable REST API built with Express.js and Firebase Firestore using Firebase Admin SDK.

---

## Features

- Express.js REST API
- Firebase Firestore integration
- Firebase Admin SDK authentication
- Full CRUD operations
- Firebase ID token verification (Auth-ready)
- CORS enabled for frontend integration
- Environment variables support
- Modular project structure

---

## Tech Stack

- Node.js
- Express.js
- Firebase Admin SDK
- Firestore Database
- dotenv
- cors

---

## Project Structure
backend/
│
├── src/
│ ├── config/
│ │ └── firebase.js
│ │
│ ├── controllers/
│ │ └── userController.js
│ │
│ ├── routes/
│ │ └── userRoutes.js
│ │
│ ├── middleware/
│ │ └── auth.js
│ │
│ ├── app.js
│ └── server.js
│
├── firebase-service-account.json
├── .env
├── package.json
└── README.md


---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/your-repo.git
cd backend
2. Install dependencies
npm install
3. Setup Firebase
Go to Firebase Console: https://console.firebase.google.com
Create a project
Enable Firestore Database
Go to Project Settings → Service Accounts
Generate a new private key
Download JSON file and place it in the root:
firebase-service-account.json
4. Setup environment variables

Create a .env file:

PORT=5000
5. Run the server
Development
npm run dev
Production
npm start
API Base URL
http://localhost:5000/api/users
```

## Firestore Setup
```javascript
const admin = require("firebase-admin");
const serviceAccount = require("../../firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { admin, db };
```

## Example Firestore Structure
```
users
 ├── userId123
 │    ├── name: "John Doe"
 │    ├── email: "john@example.com"
 │    ├── createdAt
```

## Testing Tools
- Postman
- Insomnia
- Thunder Client (VS Code)
- Frontend (React / Next.js)

## CORS Setup
```javascript
const cors = require("cors");

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
}));
```

## Run Server
```bash
npm run dev
```

### Server runs on:

http://localhost:5000