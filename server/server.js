/* ============================================================
   Vocab Trainer — Auth Server (port 3001)
   Serves a simple API for login/register/data sync.
   Data is persisted to vocab-db.json so it survives restarts.
   Run:  cd server && npm install && npm start
   ============================================================ */
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

const DB_FILE = path.join(__dirname, "vocab-db.json");

app.use(cors({ origin: ["http://localhost:8000", "http://127.0.0.1:8000"] }));
app.use(express.json());

// Serve static files from web/vocab/ (parent of server/)
app.use(express.static(path.join(__dirname, "..")));

// --- Persistent storage ---
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    }
  } catch (e) {
    console.warn("[server] Failed to load DB, starting fresh:", e.message);
  }
  return { users: {}, tokens: {}, userData: {} };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("[server] Failed to save DB:", e.message);
  }
}

let db = loadDB();

function hash(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}
function genToken() {
  return crypto.randomBytes(32).toString("hex");
}
function makeUserId() {
  return "u_" + crypto.randomBytes(8).toString("hex");
}

// --- POST /api/auth/google ---
// Create or link a local account for a Google user.
// Returns a regular auth token (not "firebase:" prefixed) so the
// user can also log in with username/password later.
app.post("/api/auth/google", (req, res) => {
  const { googleUid, displayName, email } = req.body;
  if (!googleUid || !displayName) {
    return res.status(400).json({ error: "googleUid and displayName required" });
  }

  // Check if user already linked to this Google UID
  const existingUser = Object.values(db.users).find(function (u) {
    return u.googleUid === googleUid;
  });
  if (existingUser) {
    const token = genToken();
    db.tokens[token] = { username: existingUser.username, userId: existingUser.userId };
    saveDB(db);
    return res.json({ token, username: existingUser.username, userId: existingUser.userId, isNew: false });
  }

  // Check if username already taken — append number if so
  let username = displayName;
  let counter = 1;
  while (db.users[username]) {
    username = displayName + counter;
    counter++;
  }

  // Auto-generate a password the user can change later
  const autoPassword = genToken().slice(0, 12);
  const id = makeUserId();
  db.users[username] = {
    userId: id,
    passwordHash: hash(autoPassword),
    googleUid: googleUid,
    email: email || "",
    lang: "th",
    created: Date.now()
  };
  db.userData[id] = {};

  const token = genToken();
  db.tokens[token] = { username, userId: id };
  saveDB(db);

  res.json({ token, username, userId: id, autoPassword, isNew: true });
});

// --- POST /api/register ---
app.post("/api/register", (req, res) => {
  const { username, password, lang } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  if (db.users[username]) {
    return res.status(409).json({ error: "username already exists" });
  }
  const id = makeUserId();
  db.users[username] = { userId: id, passwordHash: hash(password), lang: lang || "th" };
  db.userData[id] = {};
  const token = genToken();
  db.tokens[token] = { username, userId: id };
  saveDB(db);
  res.json({ token, username, userId: id });
});

// --- POST /api/login ---
app.post("/api/login", (req, res) => {
  const { username, password, lang } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  const user = db.users[username];
  if (!user || user.passwordHash !== hash(password)) {
    return res.status(401).json({ error: "invalid username or password" });
  }
  const token = genToken();
  db.tokens[token] = { username, userId: user.userId };
  saveDB(db);
  res.json({ token, username, userId: user.userId });
});

// --- GET /api/me ---
app.get("/api/me", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "no token" });
  }
  const t = db.tokens[auth.slice(7)];
  if (!t) return res.status(401).json({ error: "invalid token" });
  res.json({ username: t.username, userId: t.userId });
});

// --- GET /api/data ---
app.get("/api/data", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "no token" });
  }
  const t = db.tokens[auth.slice(7)];
  if (!t) return res.status(401).json({ error: "invalid token" });
  const data = db.userData[t.userId] || {};
  res.json({ data });
});

// --- POST /api/data ---
app.post("/api/data", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "no token" });
  }
  const t = db.tokens[auth.slice(7)];
  if (!t) return res.status(401).json({ error: "invalid token" });
  const { data } = req.body;
  if (data && typeof data === "object") {
    db.userData[t.userId] = data;
    saveDB(db);
  }
  res.json({ ok: true });
});

// --- POST /api/auth/github ---
app.post("/api/auth/github", (req, res) => {
  const { githubId, displayName, email } = req.body;
  if (!githubId || !displayName) {
    return res.status(400).json({ error: "githubId and displayName required" });
  }
  const existingUser = Object.values(db.users).find(u => u.githubId === githubId);
  if (existingUser) {
    const token = genToken();
    db.tokens[token] = { username: existingUser.username, userId: existingUser.userId };
    saveDB(db);
    return res.json({ token, username: existingUser.username, userId: existingUser.userId, isNew: false });
  }
  let username = displayName;
  let counter = 1;
  while (db.users[username]) {
    username = displayName + counter;
    counter++;
  }
  const autoPassword = genToken().slice(0, 12);
  const id = makeUserId();
  db.users[username] = {
    userId: id,
    passwordHash: hash(autoPassword),
    githubId: githubId,
    email: email || "",
    lang: "th",
    created: Date.now()
  };
  db.userData[id] = {};
  const token = genToken();
  db.tokens[token] = { username, userId: id };
  saveDB(db);
  res.json({ token, username, userId: id, autoPassword, isNew: true });
});

// --- POST /api/auth/apple ---
app.post("/api/auth/apple", (req, res) => {
  const { appleId, displayName, email } = req.body;
  if (!appleId || !displayName) {
    return res.status(400).json({ error: "appleId and displayName required" });
  }
  const existingUser = Object.values(db.users).find(u => u.appleId === appleId);
  if (existingUser) {
    const token = genToken();
    db.tokens[token] = { username: existingUser.username, userId: existingUser.userId };
    saveDB(db);
    return res.json({ token, username: existingUser.username, userId: existingUser.userId, isNew: false });
  }
  let username = displayName;
  let counter = 1;
  while (db.users[username]) {
    username = displayName + counter;
    counter++;
  }
  const autoPassword = genToken().slice(0, 12);
  const id = makeUserId();
  db.users[username] = {
    userId: id,
    passwordHash: hash(autoPassword),
    appleId: appleId,
    email: email || "",
    lang: "th",
    created: Date.now()
  };
  db.userData[id] = {};
  const token = genToken();
  db.tokens[token] = { username, userId: id };
  saveDB(db);
  res.json({ token, username, userId: id, autoPassword, isNew: true });
});

// --- POST /api/auth/forgot-password ---
app.post("/api/auth/forgot-password", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username required" });
  }
  const user = db.users[username];
  if (!user) {
    return res.json({ ok: true, message: "If account exists, reset instructions sent." });
  }
  const resetCode = crypto.randomBytes(3).toString("hex").toUpperCase();
  user.resetCode = resetCode;
  saveDB(db);
  res.json({ ok: true, message: "Reset code generated", resetCode });
});

// --- POST /api/auth/reset-password ---
app.post("/api/auth/reset-password", (req, res) => {
  const { username, resetCode, newPassword } = req.body;
  if (!username || !resetCode || !newPassword) {
    return res.status(400).json({ error: "All fields required" });
  }
  const user = db.users[username];
  if (!user || user.resetCode !== resetCode) {
    return res.status(400).json({ error: "Invalid reset code or username" });
  }
  user.passwordHash = hash(newPassword);
  delete user.resetCode;
  saveDB(db);
  res.json({ ok: true, message: "Password successfully reset" });
});

app.listen(PORT, () => {
  console.log(`Vocab auth server running on http://localhost:${PORT}`);
});
