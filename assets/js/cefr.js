/* ============================================================
   CEFR LEVELS — กำหนดระดับภาษาของแต่ละวัน (A1-A2: 60 วัน, B1-C2: 90 วัน)
   ------------------------------------------------------------
   A1 Beginner        : Day 1–60 (60 days, 600 words)
   A2 Elementary      : Day 61–120 (60 days, 600 words)
   B1 Intermediate    : Day 121–210 (90 days, 900 words)
   B2 Upper-Int.      : Day 211–300 (90 days, 900 words)
   C1 Advanced        : Day 301–390 (90 days, 900 words)
   C2 Expert          : Day 391–480 (90 days, 900 words)
   ============================================================ */

const CEFR_LEVELS = {
  A1: { name: "Beginner",       th: "ผู้เริ่มต้น",     color: "#22c55e", order: 0 },
  A2: { name: "Elementary",     th: "ระดับประถม",      color: "#84cc16", order: 1 },
  B1: { name: "Intermediate",   th: "ระดับกลาง",       color: "#eab308", order: 2 },
  B2: { name: "Upper-Int.",     th: "ระดับกลางสูง",    color: "#f97316", order: 3 },
  C1: { name: "Advanced",       th: "ระดับสูง",         color: "#ef4444", order: 4 },
  C2: { name: "Expert",         th: "ระดับเชี่ยวชาญ",  color: "#8b5cf6", order: 5 }
};

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

window.CEFR_LEVELS = CEFR_LEVELS;
window.CEFR_ORDER = CEFR_ORDER;

/* Map day number -> CEFR level */
function cefrLevelForDay(day) {
  const n = Number(day);
  if (n >= 391 && n <= 480) return "C2";
  if (n >= 301 && n <= 390) return "C1";
  if (n >= 211 && n <= 300) return "B2";
  if (n >= 121 && n <= 210) return "B1";
  if (n >= 61 && n <= 120) return "A2";
  if (n >= 1 && n <= 60) return "A1";
  return null;
}

/* First day of each CEFR level with actual vocabulary */
const CEFR_START_DAY = { A1: 1, A2: 61, B1: 121, B2: 211, C1: 301, C2: 391 };
/* Last day of each CEFR level */
const CEFR_END_DAY = { A1: 60, A2: 120, B1: 210, B2: 300, C1: 390, C2: 480 };
const CEFR_PROGRESS_PATH = { from: "A1", to: "A2", startDay: 1, endDay: 60, totalDays: 60 };

window.CEFR_START_DAY = CEFR_START_DAY;
window.CEFR_END_DAY = CEFR_END_DAY;
window.CEFR_PROGRESS_PATH = CEFR_PROGRESS_PATH;

/* All days belonging to a CEFR level (sorted ascending) that have vocabulary */
function cefrDaysForLevel(level) {
  const days = [];
  Object.keys(VOCAB_DAYS).forEach(function (k) {
    if (cefrLevelForDay(k) === level) {
      const dData = VOCAB_DAYS[k];
      if (dData && dData.vocabulary && dData.vocabulary.length > 0) {
        days.push(Number(k));
      }
    }
  });
  return days.sort(function (a, b) { return a - b; });
}

/* Storage helper — ใช้ SecureStore ถ้าพร้อม (โหลดหลัง app.js) */
function cefrStorage() {
  return (window.SecureStore && typeof window.SecureStore.load === "function")
    ? window.SecureStore
    : { load: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
        save: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
}

/* Get user's stored CEFR level */
function getCefrLevel() {
  try {
    const p = cefrStorage().load("vocab_progress_v1", {});
    return (p && p.cefrLevel) || null;
  } catch (e) { return null; }
}

/* Store user's CEFR level */
function setCefrLevel(level) {
  try {
    const store = cefrStorage();
    const p = store.load("vocab_progress_v1", {}) || {};
    p.cefrLevel = level;
    store.save("vocab_progress_v1", p);
  } catch (e) {}
}

/* True if the user has completed the placement test */
function hasTakenPlacementTest() {
  return getCefrLevel() !== null;
}

window.cefrLevelForDay = cefrLevelForDay;
window.cefrDaysForLevel = cefrDaysForLevel;
window.getCefrLevel = getCefrLevel;
window.setCefrLevel = setCefrLevel;
window.hasTakenPlacementTest = hasTakenPlacementTest;