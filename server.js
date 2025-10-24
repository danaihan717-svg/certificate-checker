// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = __dirname;
const COURSES_FILE = path.join(DATA_DIR, "courses.json");
const CERTS_FILE = path.join(DATA_DIR, "certificates.json");

// Simple users store — в реале хранить пароли хешами в БД
const users = [
  { login: "admin", password: "admin2025", role: "admin" },
  { login: "editor", password: "editor2025", role: "editor" }
];

// sessions token -> { login, role, created }
const sessions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Ensure files exist
function ensure(fp, init = "[]") {
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, init, "utf8");
}
ensure(COURSES_FILE, "[]");
ensure(CERTS_FILE, "[]");

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8") || "[]");
  } catch {
    return [];
  }
}
function writeJson(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf8");
}
function genToken() {
  return crypto.randomBytes(24).toString("hex");
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "No token" });
  const token = h.slice(7);
  const s = sessions.get(token);
  if (!s) return res.status(401).json({ success: false, message: "Invalid token" });
  req.user = s; // { login, role }
  next();
}

// ---------- Auth ----------
app.post("/api/login", (req, res) => {
  const { login, password } = req.body || {};
  const u = users.find(x => x.login === login && x.password === password);
  if (!u) return res.status(401).json({ success: false, message: "Invalid credentials" });
  const token = genToken();
  sessions.set(token, { login: u.login, role: u.role, created: Date.now() });
  res.json({ success: true, role: u.role, token });
});

app.post("/api/logout", authMiddleware, (req, res) => {
  const token = req.headers.authorization.slice(7);
  sessions.delete(token);
  res.json({ success: true });
});

// ---------- Courses (admin) ----------
app.get("/api/courses", (req, res) => {
  const courses = readJson(COURSES_FILE);
  res.json(courses);
});

// Add course (admin only) — course must include title {ru,kk,en}, format {ru,kk,en}, hours, date, org {ru,kk,en}
app.post("/api/courses", authMiddleware, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Forbidden" });

  const body = req.body || {};
  const { title, format, hours, date, org } = body;

  if (!title || !(title.ru || title.kk || title.en) || !format || !(format.ru || format.kk || format.en) || !hours || !date || !org || !(org.ru || org.kk || org.en)) {
    return res.status(400).json({ success: false, message: "Missing required course fields" });
  }

  const courses = readJson(COURSES_FILE);
  const id = (courses.length ? Math.max(...courses.map(c => c.id || 0)) + 1 : 1);
  const newCourse = { id, title, format, hours, date, org };
  courses.push(newCourse);
  writeJson(COURSES_FILE, courses);
  res.json({ success: true, course: newCourse });
});

app.delete("/api/courses/:id", authMiddleware, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Forbidden" });
  const id = Number(req.params.id);
  let courses = readJson(COURSES_FILE);
  const before = courses.length;
  courses = courses.filter(c => Number(c.id) !== id);
  if (courses.length === before) return res.status(404).json({ success: false, message: "Not found" });
  writeJson(COURSES_FILE, courses);
  res.json({ success: true });
});

// ---------- Certificates ----------
// admin/editor list (protected)
app.get("/api/certificates", authMiddleware, (req, res) => {
  if (!["admin", "editor"].includes(req.user.role)) return res.status(403).json({ success: false, message: "Forbidden" });
  const certs = readJson(CERTS_FILE);
  // attach course brief
  const courses = readJson(COURSES_FILE);
  const resArr = certs.map(c => ({ ...c, course: courses.find(cc => Number(cc.id) === Number(c.courseId)) || null }));
  res.json(resArr);
});

// add certificate (editor/admin) — editor must supply courseId (existing)
app.post("/api/certificates", authMiddleware, (req, res) => {
  if (!["admin", "editor"].includes(req.user.role)) return res.status(403).json({ success: false, message: "Forbidden" });
  const body = req.body || {};
  const { number, fio, courseId } = body;

  // Validate number format: 4digits-4digits e.g. 0001-2025
  if (!number || !/^\d{4}-\d{4}$/.test(number)) {
    return res.status(400).json({ success: false, message: "Invalid number format. Use 0001-2025" });
  }
  if (!fio || !courseId) return res.status(400).json({ success: false, message: "Missing fields" });

  const courses = readJson(COURSES_FILE);
  const course = courses.find(cc => Number(cc.id) === Number(courseId));
  if (!course) return res.status(400).json({ success: false, message: "Course not found" });

  const certs = readJson(CERTS_FILE);
  if (certs.some(c => String(c.number) === String(number))) {
    return res.status(400).json({ success: false, message: "Certificate number already exists" });
  }

  const newCert = {
    number: String(number),
    fio,
    courseId: Number(courseId),
    createdBy: req.user.login,
    createdAt: new Date().toISOString()
  };
  certs.push(newCert);
  writeJson(CERTS_FILE, certs);
  res.json({ success: true, certificate: newCert });
});

// delete certificate (admin only)
app.delete("/api/certificates/:number", authMiddleware, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Forbidden" });
  const number = req.params.number;
  let certs = readJson(CERTS_FILE);
  const before = certs.length;
  certs = certs.filter(c => String(c.number) !== String(number));
  if (certs.length === before) return res.status(404).json({ success: false, message: "Not found" });
  writeJson(CERTS_FILE, certs);
  res.json({ success: true });
});

// search (admin/editor) by q in number or fio
app.get("/api/search", authMiddleware, (req, res) => {
  if (!["admin", "editor"].includes(req.user.role)) return res.status(403).json({ success: false, message: "Forbidden" });
  const q = String(req.query.q || "").toLowerCase();
  const certs = readJson(CERTS_FILE);
  const courses = readJson(COURSES_FILE);
  const filtered = certs.filter(c => String(c.number).toLowerCase().includes(q) || (c.fio||"").toLowerCase().includes(q))
    .map(c => ({ ...c, course: courses.find(cc => Number(cc.id) === Number(c.courseId)) || null }));
  res.json(filtered);
});

// public check by number (user-facing) — returns certificate + course with translations
app.get("/api/check/:number", (req, res) => {
  const number = req.params.number;
  if (!/^\d{4}-\d{4}$/.test(number)) {
    return res.status(400).json({ success: false, message: "Bad number format" });
  }
  const certs = readJson(CERTS_FILE);
  const cert = certs.find(c => String(c.number) === String(number));
  if (!cert) return res.status(404).json({ success: false, message: "Not found" });
  const courses = readJson(COURSES_FILE);
  const course = courses.find(cc => Number(cc.id) === Number(cert.courseId)) || null;
  res.json({ success: true, certificate: cert, course });
});

// Start
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
