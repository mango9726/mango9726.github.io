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

app.listen(PORT, () => {
  console.log(`Vocab auth server running on http://localhost:${PORT}`);
});
