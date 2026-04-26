// Course Vault — optional self-hosted LAN sync + media streaming server.
//
// Endpoints:
//   GET  /health                         → { ok: true, version }
//   GET  /library                        → full snapshot { courses, files, categories }
//   POST /sync                           → merge a client snapshot, returns merged
//   GET  /folders                        → list of physical folders inside COURSES_DIR
//   GET  /folders/:folder/scan           → recursive file listing of a folder
//   GET  /stream/:folder/*               → stream a file with HTTP Range support
//
// Storage: SQLite (better-sqlite3) at $DATA_DIR/library.db.
// Files:   plain folders inside $COURSES_DIR, served via streaming.

import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createReadStream, statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.resolve("./data");
const COURSES_DIR = process.env.COURSES_DIR || path.resolve("./courses");
const VERSION = "1.0.0";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(COURSES_DIR, { recursive: true });

// ---------------- Database ----------------
const db = new Database(path.join(DATA_DIR, "library.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,           -- JSON blob of the course
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    data TEXT NOT NULL,           -- JSON blob of the file meta
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_files_course ON files(course_id);
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  -- Tombstones for deleted courses so the deletion can be propagated to
  -- every client (including ones offline at the time of deletion).
  CREATE TABLE IF NOT EXISTS deleted_courses (
    id TEXT PRIMARY KEY,
    deleted_at INTEGER NOT NULL
  );
`);

const getCoursesStmt = db.prepare("SELECT id, data, updated_at FROM courses");
const getFilesStmt = db.prepare("SELECT id, course_id, data, updated_at FROM files");
const upsertCourseStmt = db.prepare(
  "INSERT INTO courses(id, data, updated_at) VALUES(?, ?, ?) " +
  "ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at " +
  "WHERE excluded.updated_at >= courses.updated_at"
);
const upsertFileStmt = db.prepare(
  "INSERT INTO files(id, course_id, data, updated_at) VALUES(?, ?, ?, ?) " +
  "ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at " +
  "WHERE excluded.updated_at >= files.updated_at"
);
const getKvStmt = db.prepare("SELECT value, updated_at FROM kv WHERE key = ?");
const upsertKvStmt = db.prepare(
  "INSERT INTO kv(key, value, updated_at) VALUES(?, ?, ?) " +
  "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at " +
  "WHERE excluded.updated_at >= kv.updated_at"
);
const deleteCourseStmt = db.prepare("DELETE FROM courses WHERE id = ?");
const deleteFilesByCourseStmt = db.prepare("DELETE FROM files WHERE course_id = ?");
const upsertTombstoneStmt = db.prepare(
  "INSERT INTO deleted_courses(id, deleted_at) VALUES(?, ?) " +
  "ON CONFLICT(id) DO UPDATE SET deleted_at = MAX(deleted_courses.deleted_at, excluded.deleted_at)"
);
const getTombstonesStmt = db.prepare("SELECT id, deleted_at FROM deleted_courses");
const getTombstoneStmt = db.prepare("SELECT deleted_at FROM deleted_courses WHERE id = ?");

function snapshot() {
  const courses = getCoursesStmt.all().map((r) => {
    const c = JSON.parse(r.data);
    return { ...c, _updatedAt: r.updated_at };
  });
  const files = getFilesStmt.all().map((r) => {
    const f = JSON.parse(r.data);
    return { ...f, _updatedAt: r.updated_at };
  });
  const cats = getKvStmt.get("categories");
  const removed = getKvStmt.get("removedBuiltins");
  const tombstones = getTombstonesStmt.all().map((r) => ({
    id: r.id, deletedAt: r.deleted_at,
  }));
  return {
    version: 1,
    serverTime: Date.now(),
    courses,
    files,
    customCategories: cats ? JSON.parse(cats.value) : [],
    removedBuiltins: removed ? JSON.parse(removed.value) : [],
    deletedCourses: tombstones,
  };
}

// ---------------- App ----------------
const app = express();
app.use(cors());
// Allow large library payloads (no blobs, just JSON metadata).
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, version: VERSION, coursesDir: COURSES_DIR });
});

app.get("/library", (_req, res) => {
  res.json(snapshot());
});

/**
 * POST /sync — body: { courses:[], files:[], deletedCourses:[],
 *                      customCategories?, removedBuiltins?, clientTime }
 * Merges using last-write-wins via _updatedAt timestamps embedded in each row.
 * Returns the post-merge snapshot so the client can mirror it locally.
 */
app.post("/sync", (req, res) => {
  const body = req.body || {};
  const now = Date.now();

  const tx = db.transaction(() => {
    for (const c of body.courses || []) {
      if (!c?.id) continue;
      const ts = Number(c._updatedAt) || now;
      // Strip transient/non-serializable fields before persisting.
      const { _updatedAt, handle, ...clean } = c;
      void _updatedAt; void handle;
      upsertCourseStmt.run(c.id, JSON.stringify(clean), ts);
    }
    for (const f of body.files || []) {
      if (!f?.id || !f?.courseId) continue;
      const ts = Number(f._updatedAt) || now;
      const { _updatedAt, ...clean } = f;
      void _updatedAt;
      upsertFileStmt.run(f.id, f.courseId, JSON.stringify(clean), ts);
    }
    for (const cid of body.deletedCourses || []) {
      deleteCourseStmt.run(cid);
      deleteFilesByCourseStmt.run(cid);
    }
    if (Array.isArray(body.customCategories)) {
      upsertKvStmt.run("categories", JSON.stringify(body.customCategories), now);
    }
    if (Array.isArray(body.removedBuiltins)) {
      upsertKvStmt.run("removedBuiltins", JSON.stringify(body.removedBuiltins), now);
    }
  });

  try {
    tx();
    res.json(snapshot());
  } catch (err) {
    console.error("sync failed", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// ------- Folder browsing & streaming -------

function safeJoin(base, ...parts) {
  const target = path.resolve(base, ...parts);
  if (!target.startsWith(path.resolve(base))) {
    throw new Error("Path traversal blocked");
  }
  return target;
}

const VIDEO_EXT = new Set(["mp4", "mkv", "webm", "mov", "m4v", "avi"]);
const AUDIO_EXT = new Set(["mp3", "m4a", "wav", "ogg", "flac"]);
const DOC_EXT = new Set(["txt", "md", "rtf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "html", "json", "zip", "rar"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"]);

function getKind(name) {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (VIDEO_EXT.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (IMAGE_EXT.has(ext)) return "image";
  if (DOC_EXT.has(ext)) return "doc";
  return "other";
}

/**
 * GET /folders                       → top-level folders inside COURSES_DIR
 * GET /folders?parent=Foo/Bar        → direct children of Foo/Bar
 * Each entry includes a flag indicating whether it has further subdirectories,
 * so the UI can build a drill-down tree.
 */
app.get("/folders", async (req, res) => {
  try {
    const parent = typeof req.query.parent === "string" ? req.query.parent : "";
    const dir = parent ? safeJoin(COURSES_DIR, parent) : COURSES_DIR;
    const entries = await readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith(".")) continue;
      // Probe for subdirectories so the client can show a chevron.
      let hasChildren = false;
      try {
        const sub = await readdir(path.join(dir, e.name), { withFileTypes: true });
        hasChildren = sub.some((s) => s.isDirectory() && !s.name.startsWith("."));
      } catch { /* ignore unreadable */ }
      const rel = parent ? `${parent}/${e.name}` : e.name;
      out.push({ name: e.name, path: rel, hasChildren });
    }
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    res.json({ folders: out, parent });
  } catch (err) {
    res.status(404).json({ error: String(err?.message || err) });
  }
});

async function walk(absDir, relPrefix = "") {
  const out = [];
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      out.push(...await walk(abs, rel));
    } else if (e.isFile()) {
      try {
        const s = await stat(abs);
        out.push({ path: rel, name: e.name, size: s.size, kind: getKind(e.name) });
      } catch { /* skip */ }
    }
  }
  return out;
}

// Splat scan supports nested folder paths (e.g. /folders-scan/Math/Calc1/Week3)
app.get(/^\/folders-scan\/(.+)$/, async (req, res) => {
  try {
    const folder = decodeURIComponent(req.params[0]);
    const dir = safeJoin(COURSES_DIR, folder);
    const files = await walk(dir);
    files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
    res.json({ files });
  } catch (err) {
    res.status(404).json({ error: String(err?.message || err) });
  }
});

// Backwards-compatible single-segment alias.
app.get("/folders/:folder/scan", async (req, res) => {
  try {
    const dir = safeJoin(COURSES_DIR, req.params.folder);
    const files = await walk(dir);
    files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
    res.json({ files });
  } catch (err) {
    res.status(404).json({ error: String(err?.message || err) });
  }
});

const MIME = {
  mp4: "video/mp4", mkv: "video/x-matroska", webm: "video/webm", mov: "video/quicktime",
  m4v: "video/mp4", avi: "video/x-msvideo",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac",
  pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  svg: "image/svg+xml", bmp: "image/bmp",
  txt: "text/plain", md: "text/markdown", html: "text/html", json: "application/json", csv: "text/csv",
};
function mimeFor(name) {
  const ext = name.toLowerCase().split(".").pop() || "";
  return MIME[ext] || "application/octet-stream";
}

// /stream/<folder-path>/<rel/path/to/file.ext>
// Both segments are URL-encoded; folder-path itself may contain encoded "/".
// Example:
//   /stream/Math%2FCalc1/Week3/intro.mp4
app.get(/^\/stream\/([^/]+)\/(.+)$/, (req, res) => {
  try {
    const folder = decodeURIComponent(req.params[0]);
    const rel = decodeURIComponent(req.params[1]);
    const abs = safeJoin(COURSES_DIR, folder, rel);
    const stats = statSync(abs);
    if (!stats.isFile()) return res.status(404).end();

    const range = req.headers.range;
    const type = mimeFor(abs);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? Number(m[1]) : 0;
      let end = m && m[2] ? Number(m[2]) : stats.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
        res.status(416).setHeader("Content-Range", `bytes */${stats.size}`).end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      createReadStream(abs, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", String(stats.size));
      createReadStream(abs).pipe(res);
    }
  } catch (err) {
    res.status(404).json({ error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`[course-vault-server] v${VERSION} listening on :${PORT}`);
  console.log(`  data dir   : ${DATA_DIR}`);
  console.log(`  courses dir: ${COURSES_DIR}`);
  console.log(`  mode       : API-only (frontend served separately by Vite preview)`);
});