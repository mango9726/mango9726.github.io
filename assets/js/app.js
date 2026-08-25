

/* ============================================================
   Vocab Trainer — app.js
   ระบบ: Flashcards + SRS (Leitner) + Quiz + Browse + Daily Tasks
   เก็บความคืบหน้าใน localStorage
   ============================================================ */
(function () {
  "use strict";

  /* Boot flag: tell app.js to hand music control to the mini-player overlay
     instead of starting the built-in looping player. (Was flags.js — inlined.) */
  window.MINI_PLAYER_ENABLED = true;

  /* ---------- Security: clickjacking guard + HTML escaping ---------- */
  // Refuse to run inside a cross-origin frame (meta CSP cannot enforce
  // frame-ancestors, so this is the defense-in-depth fallback).
  if (window.self !== window.top) {
    try { window.top.location = window.self.location; }
    catch (e) { document.documentElement.innerHTML = ""; throw new Error("Refused to run inside a frame"); }
  }
  // Escape untrusted text before assigning it to innerHTML / el(...).
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- Inline SVG icon set (crisp, monochrome, theme-aware) ---------- */
  const ICONS = window.VOCAB_ICONS;
  // Expose icons for auth.js and other modules
  window.VOCAB_ICONS = ICONS;
  /** Return an <svg> icon wrapped in a sizing <span>, for use in innerHTML strings. */
  function svgIcon(name, cls) {
    return '<span class="ico' + (cls ? " " + cls : "") + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg></span>";
  }

  /* Apply dynamic colors/widths via the JS style property (NOT inline
     style= attributes). The strict CSP (style-src 'self', no 'unsafe-inline')
     blocks inline style attributes, which would otherwise leave swatch dots,
     progress bars and weak-spot colors invisible. data-* attributes are not
     subject to CSP, and setting .style from JS is always allowed. */
  function applyInlineStyles(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll("[data-bg]"), function (n) {
      n.style.background = n.getAttribute("data-bg");
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-w]"), function (n) {
      n.style.width = n.getAttribute("data-w");
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-color]"), function (n) {
      n.style.color = n.getAttribute("data-color");
    });
  }

  /* ---------- i18n: EN / TH string tables ---------- */
  const STRINGS = window.VOCAB_STRINGS;
  function t(key) {
    const lang = (settings && settings.lang) || "en";
    const tbl = STRINGS[lang] || STRINGS.en;
    return (tbl && tbl[key] != null) ? tbl[key] : (STRINGS.en[key] != null ? STRINGS.en[key] : key);
  }
  function applyI18n() {
    document.documentElement.lang = settings.lang === "th" ? "th" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      const k = n.getAttribute("data-i18n");
      if (k) n.textContent = t(k);
    });
  }

  /* ---------- Storage keys ---------- */
  const K_PROGRESS = "vocab_progress_v1";
  const K_SETTINGS = "vocab_settings_v1";
  const K_STREAK = "vocab_streak_v1";
  const K_REVIEWS = "vocab_reviews_v1";
  const K_HISTORY = "vocab_history_v1";
  const K_LEARNED = "vocab_learned_v1";
  const K_STORY_READ = "vocab_stories_read_v1";
  const K_STORY_WORDS = "vocab_story_words_v1";

  /* ---------- SRS (Leitner boxes) สำหรับไพ่/quiz รายตัว ---------- */
  const BOX_INTERVAL = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 15 };

  /* ---------- ช่วงห่างของ Daily Tasks (วันที่เว้นระหว่างการทบทวนแต่ละครั้ง)
     ทบทวนครั้งที่ 1 → เว้น 2 วัน, ครั้งที่ 2 → 4, ครั้งที่ 3 → 7, หลังจากนั้น → 15
     ตัวอย่าง Day 1 จะถูกเรียกทบทวนในวันที่ 2, 4, 8(≈7), 15(≈14) … ---------- */
  const GAPS = [2, 4, 7, 15];

  /* ---------- Date helpers ---------- */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- SecureStore: encrypt localStorage at rest ----------
     • AES-GCM key (non-extractable) lives in IndexedDB — not readable from devtools.
     • On disk every value is ciphertext (v1:<iv+ciphertext base64>); only the
       in-memory cache holds plaintext, so LocalStorage inspectors see ciphertext.
     • load/save stay SYNCHRONOUS (backed by the in-memory cache) — callers unchanged.
     • Legacy plaintext entries are auto-migrated to ciphertext on first run.
     • Degrades to plaintext localStorage if Web Crypto / IndexedDB are unavailable. */
  const SecureStore = (function () {
    const DB_NAME = "vocab_secure_db", STORE = "keys", KEY_ID = "main";
    const IV_LEN = 12, PREFIX = "v1:";
    const enc = new TextEncoder(), dec = new TextDecoder();
    const cache = Object.create(null); // key -> plaintext JSON string
    let key = null, available = false, flushing = false, flushTimer = null, needsFlush = false;

    function b64FromBytes(bytes) {
      const b = new Uint8Array(bytes); let bin = "";
      for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
      return btoa(bin);
    }
    function bytesFromB64(str) {
      const bin = atob(str), b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      return b;
    }
    function openDB() {
      return new Promise(function (res, rej) {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error || new Error("idb open failed")); };
      });
    }
    function idbGet(db, id) {
      return new Promise(function (res, rej) {
        const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
        tx.onsuccess = function () { res(tx.result); };
        tx.onerror = function () { rej(tx.error); };
      });
    }
    function idbPut(db, id, val) {
      return new Promise(function (res, rej) {
        const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(val, id);
        tx.onsuccess = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    }
    function encryptString(plain) {
      const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(plain))
        .then(function (ct) {
          const out = new Uint8Array(IV_LEN + ct.byteLength);
          out.set(iv, 0); out.set(new Uint8Array(ct), IV_LEN);
          return PREFIX + b64FromBytes(out);
        });
    }
    function decryptString(cipher) {
      if (typeof cipher !== "string" || cipher.indexOf(PREFIX) !== 0) throw new Error("not our ciphertext");
      const bytes = bytesFromB64(cipher.slice(PREFIX.length));
      const iv = bytes.subarray(0, IV_LEN), data = bytes.subarray(IV_LEN);
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data)
        .then(function (pt) { return dec.decode(pt); });
    }
    function bootstrap() {
      if (!crypto || !crypto.subtle || !window.indexedDB || typeof btoa !== "function") {
        available = false; return Promise.resolve();
      }
      return openDB().then(function (db) {
        return idbGet(db, KEY_ID).then(function (k) {
          if (!k) {
            // generateKey returns a Promise — ต้อง await ก่อนเก็บลง IndexedDB
            return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
              .then(function (generatedKey) {
                return idbPut(db, KEY_ID, generatedKey).then(function () { return generatedKey; });
              });
          }
          return k;
        });
      }).then(function (k) {
        key = k; available = true;
        let chain = Promise.resolve();
        Object.keys(localStorage).forEach(function (lsKey) {
          if (lsKey.indexOf("vocab_") !== 0) return; // only our own keys — leave firestore etc. untouched
          const raw = localStorage.getItem(lsKey);
          if (raw == null) return;
          chain = chain.then(function () {
            try {
              return decryptString(raw).then(function (plain) {
                cache[lsKey] = plain;
              }, function () {
                cache[lsKey] = raw; // legacy plaintext → re-encrypted on flush
              });
            } catch (e) {
              cache[lsKey] = raw; // not our ciphertext → keep as-is (e.g. firestore)
            }
          });
        });
        return chain.then(flush);
      }).catch(function (e) {
        available = false;
        console.warn("[SecureStore] encryption unavailable, using plaintext localStorage:", e && e.message);
      });
    }
    function load(k, fallback) {
      if (available) {
        if (Object.prototype.hasOwnProperty.call(cache, k)) {
          try { return JSON.parse(cache[k]); } catch (e) { return fallback; }
        }
        return fallback;
      }
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    }
    function save(k, val) {
      let str = null;
      try { str = JSON.stringify(val); } catch (e) { return; }
      if (str == null) return;
      if (available) { cache[k] = str; scheduleFlush(); }
      else { try { localStorage.setItem(k, str); } catch (e) {} }
    }
    function scheduleFlush() {
      if (!available) return;
      needsFlush = true;
      if (flushing || flushTimer) return;
      flushTimer = setTimeout(flush, 300);
    }
    function flush() {
      if (!available) return Promise.resolve();
      flushing = true; flushTimer = null; needsFlush = false;
      return Object.keys(cache).reduce(function (p, k) {
        return p.then(function () {
          return encryptString(cache[k]).then(function (cipher) {
            try { localStorage.setItem(k, cipher); } catch (e) {}
          }, function () {});
        });
      }, Promise.resolve()).then(function () {
        flushing = false;
        if (needsFlush) scheduleFlush(); // writes landed during this flush
      });
    }
    if (window.addEventListener) {
      window.addEventListener("pagehide", function () { if (available) flush(); });
      if (document.addEventListener) document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden" && available) flush();
      });
    }
    function remove(k) {
      delete cache[k];
      try { localStorage.removeItem(k); } catch (e) {}
      if (available) scheduleFlush();
    }
    function clear() {
      Object.keys(cache).forEach(function (k) { delete cache[k]; });
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf("vocab_") === 0) localStorage.removeItem(k);
        });
      } catch (e) {}
      if (available) scheduleFlush();
    }
    const ready = bootstrap();
    return { get ready() { return ready; }, get available() { return available; }, load: load, save: save, remove: remove, clear: clear, flush: flush };
  })();
  window.SecureStore = SecureStore;

  /* ---------- Storage load/save (delegates to SecureStore) ---------- */
  function load(key, fallback) { return SecureStore.load(key, fallback); }
  function save(key, val) {
    SecureStore.save(key, val);
    // Sync to server if logged in (debounced in auth.js — waits 2s before sending)
    if (window.VocabAuth && window.VocabAuth.isLoggedIn() && progress !== undefined) {
      try {
        window.VocabAuth.saveData({
          vocab_progress_v1: JSON.stringify(progress),
          vocab_settings_v1: JSON.stringify(settings),
          vocab_streak_v1: JSON.stringify(load(K_STREAK, {})),
          vocab_reviews_v1: JSON.stringify(reviews),
          vocab_history_v1: JSON.stringify(history),
          vocab_learned_v1: JSON.stringify(learned),
          vocab_game_v1: JSON.stringify(game)
        });
      } catch (e) {}
    }
  }

  let progress, settings, reviews, history, learned, game, storyRead, storyWords;
  function loadInitialState() {
    progress = load(K_PROGRESS, {});
    settings = load(K_SETTINGS, { theme: "light", accent: "aurora" });
    if (settings.music == null) settings.music = true;
    if (settings.musicVol == null) settings.musicVol = 0.5;
    if (settings.pageSong == null) settings.pageSong = 0;
    if (settings.gameSong == null) settings.gameSong = 0;
    if (settings.effects == null) settings.effects = "full"; // "off" | "reduced" | "full"
    if (!settings.accent) settings.accent = "aurora";
    if (settings.lang !== "en" && settings.lang !== "th") settings.lang = "en";
    if (settings.streakFreeze == null) settings.streakFreeze = false;
    if (!settings.reviewGoal) settings.reviewGoal = 20;
    if (!settings.xpBoost) settings.xpBoost = 1;
    if (!settings.reminder) settings.reminder = { on: false, time: "20:00" };
    if (settings.hideAllMeanings == null) settings.hideAllMeanings = false;
    if (!settings.hiddenMeanings || typeof settings.hiddenMeanings !== "object") settings.hiddenMeanings = {};
    if (!settings.studiedDays || !Array.isArray(settings.studiedDays)) settings.studiedDays = [];
    if (!settings.dayDone || typeof settings.dayDone !== "object") settings.dayDone = {};
    // Gate the mini-player boot flag on the user's preference (read by mini-player.js init).
    window.MINI_PLAYER_ENABLED = settings.showMiniPlayer !== false;
    reviews = load(K_REVIEWS, {});
    history = load(K_HISTORY, {});
    learned = load(K_LEARNED, {});
    storyRead = load(K_STORY_READ, {});
    storyWords = load(K_STORY_WORDS, {});
    game = load(K_GAME, {
      xp: 0, achievements: {}, modesUsed: [], typesTouched: [],
      perfectGames: 0, dailyAnswered: {}, lastLevelUp: 0,
      nightOwl: false, earlyBird: false, _quizPerfect: 0,
      combo: 0, bestCombo: 0, dailyMastered: {}, dailyModes: {},
      dailyCombo: {}, questDate: "", questsClaimed: false
    });
    migrateProgress();
  }

  /* ---------- Build flat item list ---------- */
  function getCustomWords() {
    try {
      return (window.SecureStore ? window.SecureStore.load("vocab_custom_words_v1", []) : JSON.parse(localStorage.getItem("vocab_custom_words_v1") || "[]")) || [];
    } catch (e) { return []; }
  }

  let cachedAllItems = null;
  function getAllItems() {
    if (cachedAllItems) return cachedAllItems;
    const items = [];
    Object.keys(VOCAB_DAYS).sort((a, b) => a - b).forEach(function (dayKey) {
      const d = VOCAB_DAYS[dayKey];
      (d.vocabulary || []).forEach(function (v, i) {
        items.push({ id: d.day + "-v-" + i, type: "vocab", day: d.day, topic: d.topic, word: v.word, phonetic: v.phonetic, pos: v.pos, th: v.th, exEn: v.exEn, exTh: v.exTh, note: "" });
      });
      (d.collocations || []).forEach(function (c, i) {
        items.push({ id: d.day + "-c-" + i, type: "collocation", day: d.day, topic: d.topic, word: c.phrase, pos: "collocation", th: c.th || "", phonetic: c.phonetic || "", exEn: c.exEn, exTh: c.exTh, note: c.note });
      });
      if (d.idiom) {
        items.push({ id: d.day + "-i-0", type: "idiom", day: d.day, topic: d.topic, word: d.idiom.phrase, pos: "idiom", th: d.idiom.meaning, exEn: d.idiom.exEn, exTh: d.idiom.exTh, note: "" });
      }
    });
    getCustomWords().forEach(function (cw, idx) {
      items.push({
        id: "custom-" + idx + "-" + (cw.word || "word").replace(/\s+/g, "_"),
        type: cw.type || "vocab",
        day: cw.day || 1,
        topic: "Custom Vocabulary",
        word: cw.word,
        phonetic: cw.phonetic || "",
        pos: cw.pos || "noun",
        th: cw.th,
        exEn: cw.exEn || "",
        exTh: cw.exTh || "",
        note: cw.note || "Custom word"
      });
    });
    cachedAllItems = items;
    return cachedAllItems;
  }

  function saveCustomWord(cw) {
    let custom = getCustomWords();
    custom.push(cw);
    if (window.SecureStore) window.SecureStore.save("vocab_custom_words_v1", custom);
    else localStorage.setItem("vocab_custom_words_v1", JSON.stringify(custom));
    cachedAllItems = null;
    ALL_ITEMS = getAllItems();
    ITEMS = window.CefrSelector?.getFilteredItems ? window.CefrSelector.getFilteredItems() : ALL_ITEMS;
    cachedBrowseKey = "";
    renderBrowse(true);
    toast("เพิ่มคำศัพท์ส่วนตัวสำเร็จ!", "ok");
  }

  /** Parse & import custom words from CSV text (via pure VocabCSV). Returns {ok, added, skipped}. */
  function importCustomWordsCsv(text) {
    const res = (window.VocabCSV ? window.VocabCSV.parseImport(text, getCustomWords()) : { ok: false, error: "unavailable", toAdd: [] });
    if (!res.ok) return { ok: false, added: 0, skipped: 0, error: res.error };
    if (res.added > 0) {
      const merged = getCustomWords().concat(res.toAdd);
      if (window.SecureStore) window.SecureStore.save("vocab_custom_words_v1", merged);
      else localStorage.setItem("vocab_custom_words_v1", JSON.stringify(merged));
    }
    return { ok: true, added: res.added, skipped: res.skipped };
  }

  // Original full item list (never filtered)
  let ALL_ITEMS = getAllItems();
  // Current item list (filtered by CEFR level if active)
  let ITEMS = ALL_ITEMS;

  function itemsForDay(dayNum) { return ITEMS.filter(function (i) { return String(i.day) === String(dayNum); }); }

  // Getter for current items (used by games)
  function getCurrentItems() { return ITEMS; }
  // Getter for all items (used by browse, stats, etc.)
  function getAllItemsList() { return ALL_ITEMS; }

  // Expose globally for other modules
  window.VocabItems = {
    getCurrent: getCurrentItems,
    getAll: getAllItemsList,
    setFiltered: function(filteredItems) { ITEMS = filteredItems; },
    resetFilter: function() { ITEMS = ALL_ITEMS; }
  };

  /* ---------- Progress (per-item FSRS-5 spaced repetition) ----------
     Each item stores: st (stability, days), d (difficulty 1..10), reps,
     lapses, due, lastReview, seen. Legacy Leitner {box} and SM-2
     {ease, interval} progress is migrated to FSRS shape on load. */
  const GRADE = { again: 1, hard: 3, good: 4, easy: 5 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function daysSince(dateStr) {
    if (!dateStr) return 0;
    const diff = Math.floor((new Date(todayStr() + "T00:00:00") - new Date(dateStr + "T00:00:00")) / 86400000);
    return diff;
  }

  /** Map an SM-2 ease value to a rough FSRS difficulty (used for migration only). */
  function easeToDifficulty(ease) {
    return clamp(Math.round((11 - (ease || 2.5) * 2.4) * 10) / 10, 1, 10);
  }

  function getP(id) {
    return progress[id] || { st: 0, d: 5, reps: 0, lapses: 0, due: todayStr(), lastReview: "", seen: 0 };
  }
  function isDue(item) { return getP(item.id).due <= todayStr(); }
  function isMastered(item) { const p = getP(item.id); return (p.st || 0) >= 21 || (p.reps || 0) >= 4; }

  /** Migrate legacy progress (Leitner {box} or SM-2 {ease,interval}) to the FSRS shape once. */
  function migrateProgress() {
    let changed = false;
    ITEMS.forEach(function (it) {
      const p = progress[it.id];
      if (!p) return;
      let rec = null;
      if (p.st != null && p.d != null) return; // already FSRS
      if (p.box != null && p.ease == null) {
        const box = clamp(p.box || 1, 1, 5);
        const iv = BOX_INTERVAL[box] || 0;
        rec = {
          st: iv,
          d: 5,
          reps: Math.max(0, box - 1),
          lapses: p.lapses || 0,
          due: p.due || todayStr(),
          lastReview: p.due ? addDays(p.due, -iv) : "",
          seen: p.seen || 0
        };
      } else if (p.ease != null) {
        rec = {
          st: p.interval || 0,
          d: easeToDifficulty(p.ease),
          reps: p.reps || 0,
          lapses: p.lapses || 0,
          due: p.due || todayStr(),
          lastReview: p.lastReview || (p.due ? addDays(p.due, -(p.interval || 0)) : ""),
          seen: p.seen || 0
        };
      }
      if (rec) { progress[it.id] = rec; changed = true; }
    });
    if (changed) save(K_PROGRESS, progress);
  }

  /** Predicted retention right now (0-100%) via the FSRS forgetting curve. */
  function predictRetention(item) {
    const p = getP(item.id);
    if (!p.st || p.st <= 0) return 0;
    const elapsed = Math.max(0, daysSince(p.lastReview || ""));
    return Math.round(clamp(VocabSRS.retention(elapsed, { stability: p.st }) * 100, 0, 100));
  }

  /** FSRS-5 grade: q in {Again=1, Hard=3, Good=4, Easy=5}. */
  function gradeAnswer(item, q) {
    if (!item) return;
    const p = getP(item.id);
    const wasNew = !p.seen;
    const wasMasteredBefore = isMastered(item);
    p.seen = (p.seen || 0) + 1;
    q = clamp(q | 0, 0, 5);
    const mem = (p.st || 0) > 0 && p.d ? { stability: p.st, difficulty: p.d } : null;
    const elapsed = Math.max(0, daysSince(p.lastReview || ""));
    const res = VocabSRS.review(mem, elapsed, q);
    p.st = res.state.stability;
    p.d = res.state.difficulty;
    if (q < 3) {
      p.reps = 0;
      p.lapses = (p.lapses || 0) + 1;
      p.due = todayStr();
    } else {
      p.reps = (p.reps || 0) + 1;
      p.lastReview = todayStr();
      p.due = addDays(todayStr(), res.interval);
    }
    progress[item.id] = p;
    save(K_PROGRESS, progress);
    const t = todayStr();
    if (!history[t]) history[t] = { answered: 0, correct: 0 };
    history[t].answered++;
    if (q >= 3) history[t].correct++;
    save(K_HISTORY, history);
    // Per-mode accuracy tracking (modeStats[date][mode] = {a, c})
    const _mode = currentMode || "cards";
    if (!game.modeStats) game.modeStats = {};
    if (!game.modeStats[t]) game.modeStats[t] = {};
    if (!game.modeStats[t][_mode]) game.modeStats[t][_mode] = { a: 0, c: 0 };
    game.modeStats[t][_mode].a++;
    if (q >= 3) game.modeStats[t][_mode].c++;
    if (wasNew) {
      learned[t] = (learned[t] || 0) + 1;
      save(K_LEARNED, learned);
    }
    bumpStreak();

    /* --- Gamification: ให้ XP ตามเกรด + ติดตามโหมด/ประเภท/เวลา --- */
    let xp = q >= 3 ? (q === GRADE.easy ? 7 : q === GRADE.hard ? 3 : 5) : 1;
    if (wasNew) xp += 10;
    const nowMastered = isMastered(item);
    if (nowMastered && !wasMasteredBefore) xp += 25;
    // Combo (ตอบถูกติดต่อกัน)
    if (q >= 3) {
      game.combo = (game.combo || 0) + 1;
      if (game.combo > (game.bestCombo || 0)) game.bestCombo = game.combo;
      const tc = todayStr();
      if (!game.dailyCombo) game.dailyCombo = {};
      if (game.combo > (game.dailyCombo[tc] || 0)) game.dailyCombo[tc] = game.combo;
    } else {
      game.combo = 0;
    }
    const mult = comboMultiplier(game.combo);
    if (mult > 1) xp = Math.round(xp * mult);
    if (currentMode && game.modesUsed.indexOf(currentMode) === -1) game.modesUsed.push(currentMode);
    if (q >= 3 && item.type && game.typesTouched.indexOf(item.type) === -1) game.typesTouched.push(item.type);
    const td = todayStr();
    game.dailyAnswered[td] = (game.dailyAnswered[td] || 0) + 1;
    if (nowMastered && !wasMasteredBefore) game.dailyMastered[td] = (game.dailyMastered[td] || 0) + 1;
    if (currentMode) {
      game.dailyModes[td] = game.dailyModes[td] || [];
      if (game.dailyModes[td].indexOf(currentMode) === -1) game.dailyModes[td].push(currentMode);
    }
    const hr = new Date().getHours();
    if (hr >= 22 || hr < 5) game.nightOwl = true;
    if (hr < 6) game.earlyBird = true;
    saveGame();
    if (q >= 3) showCombo(game.combo, mult); else hideCombo();
    awardXp(xp, "answer");
  }

  /** Backward-compatible wrapper — keeps every legacy game mode working. */
  function recordAnswer(item, correct) {
    gradeAnswer(item, correct ? GRADE.good : GRADE.again);
  }

  /** Preview of the next interval (days) for a given grade, for button hints. */
  function previewInterval(item, q) {
    const p = getP(item.id);
    if (q < 3) return 0;
    const mem = (p.st || 0) > 0 && p.d ? { stability: p.st, difficulty: p.d } : null;
    const elapsed = Math.max(0, daysSince(p.lastReview || ""));
    const res = VocabSRS.review(mem, elapsed, q);
    return res.interval;
  }

  /** Due items sorted weakest-first, interleaved by type for variety. */
  function dueQueue() {
    const due = ITEMS.filter(isDue);
    due.sort(function (a, b) { return predictRetention(a) - predictRetention(b); });
    const byType = { vocab: [], collocation: [], idiom: [] };
    due.forEach(function (i) { (byType[i.type] || byType.vocab).push(i); });
    const out = []; let added = true;
    while (added) {
      added = false;
      ["vocab", "collocation", "idiom"].forEach(function (t) {
        if (byType[t] && byType[t].length) { out.push(byType[t].shift()); added = true; }
      });
    }
    return out;
  }

  /** Normalized similarity (0-1) between two strings (Levenshtein-based). */
  function similarity(a, b) {
    a = (a || "").toLowerCase(); b = (b || "").toLowerCase();
    const m = a.length, n = b.length;
    if (!m && !n) return 1;
    const dp = [];
    for (let i = 0; i <= m; i++) { dp.push([i]); }
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - dp[m][n] / Math.max(1, Math.max(m, n));
  }

  /** Pick the k hardest-to-distinguish distractors (same POS + similar key). */
  function pickDistractors(item, pool, k) {
    const key = item.word || item.phrase || "";
    const cands = pool.filter(function (i) { return i.id !== item.id && (i.th && item.th); });
    cands.sort(function (a, b) {
      const sa = (a.pos === item.pos ? 0.5 : 0) + similarity(a.word || a.phrase || "", key) * 0.5;
      const sb = (b.pos === item.pos ? 0.5 : 0) + similarity(b.word || b.phrase || "", key) * 0.5;
      return sb - sa;
    });
    return cands.slice(0, k || 3);
  }

  /** Auto mnemonic: split the phonetic into syllable dots (e.g. ac·com·plish). */
  function syllableTip(item) {
    if (item.tip) return item.tip;
    if (!item.phonetic) return "";
    return item.phonetic.split(/[.ˈˌ]/).filter(Boolean).map(function (s) { return s.trim(); }).join("·");
  }

  /* ---------- Streak ---------- */
  function bumpStreak() {
    const s = load(K_STREAK, { streak: 0, last: "" });
    const t = todayStr();
    if (s.last === t) return;
    const y = addDays(t, -1);
    const y2 = addDays(t, -2);
    if (s.last === y) {
      s.streak = s.streak + 1;
    } else if (settings.streakFreeze && s.last === y2) {
      // Streak Freeze is a purchasable item — consume one charge when used.
      if ((game.streakFreezes || 0) > 0) {
        game.streakFreezes = (game.streakFreezes || 0) - 1;
        s.streak = s.streak + 1;
        toast(t("sf.used"), "ok", "shield");
        saveGame();
      } else {
        settings.streakFreeze = false;
        save(K_SETTINGS, settings);
        s.streak = 1;
      }
    } else {
      s.streak = 1;
    }
    s.last = t;
    save(K_STREAK, s);
  }

  /* ============================================================
     GAMIFICATION — XP · Level · Rank · Achievements
     ต่อยอดจาก streak / history / learned / progress ที่มีอยู่แล้ว
     ไม่เพิ่ม dependency: เก็บใน localStorage ผ่าน K_GAME
     ============================================================ */
  const K_GAME = "vocab_game_v1";
  const SF_COST = 500; // XP per Streak Freeze charge
  game = load(K_GAME, {
    xp: 0, achievements: {}, modesUsed: [], typesTouched: [],
    perfectGames: 0, dailyAnswered: {}, lastLevelUp: 0,
    nightOwl: false, earlyBird: false, _quizPerfect: 0,
    combo: 0, bestCombo: 0, dailyMastered: {}, dailyModes: {},
    dailyCombo: {},
    questDate: "", questsClaimed: false
  });
  if (!game.achievements) game.achievements = {};
  if (!game.modesUsed) game.modesUsed = [];
  if (!game.typesTouched) game.typesTouched = [];
  if (!game.dailyAnswered) game.dailyAnswered = {};
  if (game.perfectGames == null) game.perfectGames = 0;
  if (game.lastLevelUp == null) game.lastLevelUp = 0;
  if (game.xp == null) game.xp = 0;
  if (game.streakFreezes == null) game.streakFreezes = 0;
  if (game._quizPerfect == null) game._quizPerfect = 0;
  if (game.combo == null) game.combo = 0;
  if (game.bestCombo == null) game.bestCombo = 0;
  if (!game.dailyMastered) game.dailyMastered = {};
  if (!game.dailyModes) game.dailyModes = {};
  if (!game.dailyCombo) game.dailyCombo = {};
  let currentMode = ""; // โหมดเกมปัจจุบัน (เซ็ตตอน startXxx) — สำหรับความหลากหลาย

  function saveGame() { save(K_GAME, game); }

  /* --- Level curve: XP สะสมที่ต้องถึงเพื่อ "อยู่" เลเวล L (L>=1 เริ่มที่ 0) --- */
  function xpForLevel(L) {
    let t = 0;
    for (let i = 1; i < L; i++) t += 100 + (i - 1) * 50; // L2=100, L3=250, L4=450, L5=700 …
    return t;
  }
  function levelFromXp(xp) {
    let L = 1;
    while (xpForLevel(L + 1) <= xp) L++;
    return L;
  }
  function rankForLevel(L) {
    if (L >= 100) return "Word Sage";
    if (L >= 75) return "Lexicographer";
    if (L >= 50) return "Polyglot";
    if (L >= 35) return "Wordsmith";
    if (L >= 20) return "Linguist";
    if (L >= 10) return "Scholar";
    if (L >= 5) return "Apprentice";
    return "Newcomer";
  }
  /** Progress ภายในเลเวลปัจจุบัน */
  function levelProgress(xp) {
    const L = levelFromXp(xp);
    const base = xpForLevel(L);
    const next = xpForLevel(L + 1);
    return {
      level: L, rank: rankForLevel(L),
      inLevel: xp - base, need: next - base,
      pct: next > base ? Math.round((xp - base) / (next - base) * 100) : 100
    };
  }

  /* --- Combo: ตอบถูกติดต่อกัน → คูณ XP --- */
  function comboMultiplier(combo) {
    if (combo >= 10) return 3;
    if (combo >= 5) return 2;
    if (combo >= 2) return 1.5;
    return 1;
  }
  let comboTimer = null;
  function showCombo(combo, mult) {
    if (combo < 2 || !fxSubtle()) { hideCombo(); return; }
    let elc = $("comboFloat");
    if (!elc) {
      elc = document.createElement("div");
      elc.id = "comboFloat";
      elc.className = "combo-float";
      document.body.appendChild(elc);
    }
    // Position always on-screen: centre of the active card if it's fully
    // visible, otherwise the upper-third of the viewport. (Previously this
    // used the card's top edge, which scrolled off-screen and hid the combo.)
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = activeSessionEl();
    const rect = r ? r.getBoundingClientRect() : null;
    let cy = vh * 0.32;
    if (rect && rect.top >= 0 && rect.bottom <= vh) cy = rect.top + rect.height * 0.30;
    cy = Math.max(64, Math.min(vh - 64, cy));
    elc.style.top = cy + "px";
    const multTxt = (mult % 1 === 0) ? mult : mult.toFixed(1);
    elc.innerHTML = '<span class="combo-flame">' + svgIcon("flame", "ico sm") + '</span><span class="combo-num">Combo ×' + combo + '</span><span class="combo-mult">×' + multTxt + ' XP</span>';
    elc.classList.remove("show"); void elc.offsetWidth; elc.classList.add("show");
    clearTimeout(comboTimer);
    comboTimer = setTimeout(function () { elc.classList.remove("show"); }, 1400);
  }
  function hideCombo() { const elc = $("comboFloat"); if (elc) elc.classList.remove("show"); }

  /* --- Aggregates นับจากข้อมูลที่มีอยู่ --- */
  function totalAnswered() { let n = 0; for (const t in history) n += (history[t].answered || 0); return n; }
  function totalCorrect() { let n = 0; for (const t in history) n += (history[t].correct || 0); return n; }
  function totalLearned() { let n = 0; for (const t in learned) n += (learned[t] || 0); return n; }
  function masteredCount() { let n = 0; ITEMS.forEach(function (it) { if (isMastered(it)) n++; }); return n; }
  function currentStreak() { return (load(K_STREAK, { streak: 0 })).streak || 0; }
  function dailyAnsweredToday() { const t = todayStr(); return game.dailyAnswered[t] || 0; }

  /* --- รายการ Achievement (คำนวณจากข้อมูลที่มี) --- */
  const ACHIEVEMENTS = [
    // Getting Started
    { id: "first-step", name: "First Step", desc: "Answer your first question", icon: "sparkle", cat: "Getting Started",
      check: function () { return totalAnswered() >= 1; } },
    { id: "sharp-10", name: "Keen Eye", desc: "Get 10 answers correct", icon: "check", cat: "Getting Started",
      check: function () { return totalCorrect() >= 10; } },
    { id: "sharp-100", name: "Century", desc: "Get 100 answers correct", icon: "trophy", cat: "Getting Started",
      check: function () { return totalCorrect() >= 100; } },
    // Mastery
    { id: "first-master", name: "First Master", desc: "Master your first word", icon: "bulb", cat: "Mastery",
      check: function () { return masteredCount() >= 1; } },
    { id: "scholar", name: "Scholar", desc: "Master 25 words", icon: "book", cat: "Mastery", goal: 25,
      check: function (c) { return masteredCount() >= (c.goal || 25); } },
    { id: "bookworm", name: "Bookworm", desc: "Learn 50 new words", icon: "eye", cat: "Mastery", goal: 50,
      check: function (c) { return totalLearned() >= (c.goal || 50); } },
    { id: "polyglot", name: "Word Master", desc: "Master 100 words", icon: "brain", cat: "Mastery", goal: 100,
      check: function (c) { return masteredCount() >= (c.goal || 100); } },
    // Streaks
    { id: "on-fire", name: "On Fire", desc: "Study 3 days in a row", icon: "flame", cat: "Streaks",
      check: function () { return currentStreak() >= 3; } },
    { id: "unstoppable", name: "Unstoppable", desc: "Study 7 days in a row", icon: "flame", cat: "Streaks",
      check: function () { return currentStreak() >= 7; } },
    { id: "centurion", name: "Centurion", desc: "Study 30 days in a row", icon: "flame", cat: "Streaks",
      check: function () { return currentStreak() >= 30; } },
    { id: "legend", name: "Legend", desc: "Study 100 days in a row", icon: "flame", cat: "Streaks",
      check: function () { return currentStreak() >= 100; } },
    // Variety
    { id: "explorer", name: "Explorer", desc: "Play all 10 game modes", icon: "grid", cat: "Variety",
      check: function () { return game.modesUsed.length >= 10; } },
    { id: "all-types", name: "Full Set", desc: "Study all 3 types (vocab · collocation · idiom)", icon: "cards", cat: "Variety",
      check: function () { return game.typesTouched.length >= 3; } },
    // Perfection
    { id: "sharpshooter", name: "Quiz Ace", desc: "Score a perfect 10/10 on a Quiz", icon: "target", cat: "Perfection",
      check: function () { return (game._quizPerfect || 0) >= 1; } },
    { id: "perfectionist", name: "Perfectionist", desc: "Finish 3 games with a perfect score", icon: "party", cat: "Perfection",
      check: function () { return game.perfectGames >= 3; } },
    { id: "marathon", name: "Marathon", desc: "Answer 200 questions in a single day", icon: "trending", cat: "Perfection",
      check: function () { return dailyAnsweredToday() >= 200; } },
    // Time
    { id: "night-owl", name: "Night Owl", desc: "Study after midnight", icon: "moon", cat: "Time",
      check: function () { return !!game.nightOwl; } },
    { id: "early-bird", name: "Early Bird", desc: "Study before 6 AM", icon: "sun", cat: "Time",
      check: function () { return !!game.earlyBird; } },
    // Levels
    { id: "lingua", name: "Double Digits", desc: "Reach level 10", icon: "trophy", cat: "Levels",
      check: function () { return levelFromXp(game.xp) >= 10; } },
    { id: "grandmaster", name: "Grandmaster", desc: "Reach level 25", icon: "party", cat: "Levels",
      check: function () { return levelFromXp(game.xp) >= 25; } },
    { id: "word-sage", name: "Word Sovereign", desc: "Reach level 50", icon: "sparkle", cat: "Levels",
      check: function () { return levelFromXp(game.xp) >= 50; } }
  ];

  /* --- ตารางรางวัลตามเลเวล (ปลดล็อกของจริง — ไม่หลอก) ---
     type: theme | xpboost | title | quest | challenge
     aurora (default) ไม่ใส่ในตาราง เพราะปลดล็อกตั้งแต่ L1 --- */
  const LEVEL_REWARDS = [
    { level: 3,  id: "title-wanderer", type: "title", name: "Wanderer",
      icon: "compass", desc: "Profile title badge" },
    { level: 5,  id: "theme-sunset", type: "theme", accent: "sunset", name: "Sunset",
      icon: "sun", desc: "Orange–pink–amber color theme, pick in Settings" },
    { level: 8,  id: "boost-5", type: "xpboost", value: 0.05, name: "+5% XP",
      icon: "chart", desc: "Permanent +5% XP on every answer" },
    { level: 10, id: "theme-forest", type: "theme", accent: "forest", name: "Forest",
      icon: "leaf", desc: "Green color theme, pick in Settings" },
    { level: 12, id: "title-keeper", type: "title", name: "Lexicon Keeper",
      icon: "shield", desc: "Profile title badge" },
    { level: 14, id: "quest-bonus", type: "quest", name: "Daily Quest +1",
      icon: "list", desc: "Adds a 4th daily goal (combo ×5)" },
    { level: 15, id: "theme-ocean", type: "theme", accent: "ocean", name: "Ocean",
      icon: "wave", desc: "Blue–cyan color theme, pick in Settings" },
    { level: 18, id: "boost-10", type: "xpboost", value: 0.10, name: "+10% XP",
      icon: "chart", desc: "Permanent bonus up to +15% total XP" },
    { level: 20, id: "theme-neon", type: "theme", accent: "neon", name: "Neon",
      icon: "bolt", desc: "Magenta–cyan theme + unlocks Boss Rush", challenge: "boss-rush" },
    { level: 22, id: "title-weaver", type: "title", name: "Wordweaver",
      icon: "quill", desc: "Profile title badge" },
    { level: 25, id: "theme-mono", type: "theme", accent: "mono", name: "Mono",
      icon: "circle", desc: "Grayscale color theme, pick in Settings" }
  ];
  const ACCENT_IDS = ["aurora", "sunset", "forest", "ocean", "neon", "mono"];
  const ACCENT_SWATCH = {
    aurora: ["#6366f1", "#06b6d4", "#8b5cf6"], sunset: ["#f97316", "#fb7185", "#f59e0b"],
    forest: ["#16a34a", "#10b981", "#65a30d"], ocean: ["#0ea5e9", "#06b6d4", "#3b82f6"],
    neon: ["#d946ef", "#22d3ee", "#8b5cf6"], mono: ["#475569", "#64748b", "#334155"]
  };
  const ACCENT_LABELS = {
    aurora: "Aurora", sunset: "Sunset", forest: "Forest", ocean: "Ocean", neon: "Neon", mono: "Mono"
  };

  function currentLevel() { return levelFromXp(game.xp); }
  function unlockedRewards() { return LEVEL_REWARDS.filter(function (r) { return r.level <= currentLevel(); }); }
  function currentXpBoost() {
    let b = 0;
    unlockedRewards().forEach(function (r) { if (r.type === "xpboost") b += (r.value || 0); });
    // Manual XP boost setting (settings.xpBoost = 2 | 3 | 1)
    if (settings.xpBoost && settings.xpBoost > 1) b += (settings.xpBoost - 1);
    // Automatic double-XP weekend (Sat & Sun)
    if (isDoubleXpWeekend()) b += 1;
    return 1 + b;
  }
  function isDoubleXpWeekend() {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  }
  function isAccentUnlocked(id) {
    const r = LEVEL_REWARDS.filter(function (x) { return x.type === "theme" && x.accent === id; })[0];
    return !r || r.level <= currentLevel(); // aurora (ไม่มีในตาราง) ปลดล็อกตั้งแต่ต้น
  }
  function applyAccent() {
    const id = isAccentUnlocked(settings.accent) ? settings.accent : "aurora";
    document.documentElement.setAttribute("data-accent", id);
  }
  function highestTitle() {
    let t = null;
    unlockedRewards().forEach(function (r) { if (r.type === "title") t = r; });
    return t;
  }
  function applyRewards() {
    applyAccent();
    const t = highestTitle();
    game.title = t ? t.id : "";
    saveGame();
  }
  function newlyUnlocked(before, after) {
    return LEVEL_REWARDS.filter(function (r) { return r.level > before && r.level <= after; });
  }
  function isChallengeUnlocked(id) { return unlockedRewards().some(function (r) { return r.challenge === id; }); }
  function hasBonusQuest() { return unlockedRewards().some(function (r) { return r.type === "quest"; }); }

  /* --- ให้ XP + เช็คเลเวล/achievement --- */
  function awardXp(n, reason) {
    if (!n) return;
    const before = levelFromXp(game.xp);
    // รางวัล XP boost ถาวร (คูณตามที่ปลดล็อกไว้)
    const gained = Math.round(n * currentXpBoost());
    game.xp = (game.xp || 0) + gained;
    // Weekly XP tracking (for the Firestore leaderboard) — xp earned per day
    if (!game.xpByDay) game.xpByDay = {};
    const wd = todayStr();
    game.xpByDay[wd] = (game.xpByDay[wd] || 0) + gained;
    saveGame();
    renderProfileChip();
    renderMiniQuests();         // อัปเดต widget ลอยสดๆ (ข้ามถ้าซ่อน)
    const after = levelFromXp(game.xp);
    if (after > before) {
      const news = newlyUnlocked(before, after);
      applyRewards();            // อัพเดตฉายา/accent ที่อาจปลดล็อกใหม่
      renderRewards();           // รีเฟรชแถวรางวัลในหน้า Achievements
      renderAccentSwatches();    // swatch ใหม่ที่อาจปลดล็อก
      updateBossRushBtn();       // โชว์ปุ่ม Boss Rush ถ้าถึง L20
      if (!game.seenRewards) game.seenRewards = {};
      news.forEach(function (r) { game.seenRewards[r.id] = todayStr(); });
      saveGame();
      checkLevelUp(after);       // overlay จะโชว์รางวัลที่เพิ่งปลดล็อก
      if (news.length) rewardToast(news[0]); // toast รายการแรก (ที่เหลือโชว์ใน overlay)
    }
    checkAchievements();
    homeDirty = true;
  }

  /* --- Level-up overlay --- */
  function checkLevelUp(after) {
    const prev = game.lastLevelUp || 0;
    if (after <= prev) return;
    game.lastLevelUp = after; saveGame();
    showLevelUp(after, prev);
  }
  function showLevelUp(L, prev) {
    const ov = $("levelUpOverlay");
    if (!ov) return;
    const rk = ov.querySelector(".lu-rank");
    const lv = ov.querySelector(".lu-level");
    if (lv) lv.textContent = L;
    if (rk) rk.textContent = rankForLevel(L);
    // แสดงรางวัลที่เพิ่งปลดล็อกในช่วงเลเวลที่ข้ามมา
    const box = $("luRewards");
    if (box) {
      const gained = newlyUnlocked(prev == null ? L - 1 : prev, L);
      if (gained.length) {
        box.innerHTML = '<p class="lu-rw-head">' + svgIcon("gift", "ico sm") + " " + t("lu.rewards") + "</p>" + gained.map(function (r) {
          return '<div class="lu-reward">' + svgIcon(r.icon, "ico") +
            '<span class="lu-rw-name">' + r.name + "</span></div>";
        }).join("");
        box.hidden = false;
      } else { box.hidden = true; box.innerHTML = ""; }
    }
    ov.classList.add("show");
    if (fxSpectacle()) burstConfetti(window.innerWidth / 2, window.innerHeight * 0.38, 64);
    playTone("correct");
    try { if (navigator.vibrate) navigator.vibrate([0, 30, 45, 30]); } catch (e) {}
    const close = function () { ov.classList.remove("show"); };
    ov.onclick = function (e) { if (e.target === ov || e.target.closest(".lu-close")) close(); };
    clearTimeout(ov._t);
    if (!fxSubtle()) ov._t = setTimeout(close, 2600); // reduced-motion: ปิดอัตโนมัติ
  }

  /* --- Achievement unlock: หาใหม่ → คิว toast --- */
  let achToastQueue = [];
  let achToastBusy = false;
  function checkAchievements() {
    ACHIEVEMENTS.forEach(function (a) {
      if (game.achievements[a.id]) return;
      if (a.check(a)) {
        game.achievements[a.id] = todayStr();
        saveGame();
        achToastQueue.push(a);
      }
    });
    if (!achToastBusy) drainAchToasts();
  }
  function drainAchToasts() {
    if (!achToastQueue.length) { achToastBusy = false; return; }
    achToastBusy = true;
    const a = achToastQueue.shift();
    achievementToast(a);
    setTimeout(drainAchToasts, 2600);
  }
  function achievementToast(a) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    playFx("unlock");
    const el = document.createElement("div");
    el.className = "toast ach-toast";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="ach-toast-ico">' + svgIcon(a.icon, "ico") + "</div>" +
      '<div class="ach-toast-body"><span class="ach-toast-kicker">' + t("ach.unlocked") + "</span>" +
      '<strong class="ach-toast-name">' + a.name + "</strong>" +
      '<span class="ach-toast-desc">' + a.desc + "</span></div>";
    wrap.appendChild(el);
    if (fxSpectacle()) {
      const r = el.getBoundingClientRect();
      burstConfetti(r.left + 44, r.top + 30, 18, ["#f59e0b", "#ec4899", "#8b5cf6", "#22c55e"]);
    }
    requestAnimationFrame(function () { el.classList.add("in"); });
    setTimeout(function () {
      el.classList.add("leaving");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 4200);
  }

  /* --- Sidebar profile chip (เสมอมองเห็น) --- */
  function renderProfileChip() {
    const chip = $("profileChip");
    if (!chip) return;
    const info = levelProgress(game.xp);
    const lv = chip.querySelector(".pc-level");
    const rk = chip.querySelector(".pc-rank");
    const fill = chip.querySelector(".pc-xp-fill");
    const txt = chip.querySelector(".pc-xp-text");
    if (lv) lv.textContent = info.level;
    if (rk) rk.textContent = info.rank;
    if (fill) fill.style.width = info.pct + "%";
    if (txt) txt.textContent = info.inLevel + " / " + info.need + " XP";
    // ฉายา (title) + แบดจ์ XP boost ที่ปลดล็อกแล้ว
    const titleEl = chip.querySelector(".pc-title");
    if (titleEl) {
      const t = highestTitle();
      if (t) { titleEl.textContent = t.name; titleEl.hidden = false; }
      else { titleEl.hidden = true; titleEl.textContent = ""; }
    }
    const boostEl = chip.querySelector(".pc-boost");
    if (boostEl) {
      const pct = Math.round((currentXpBoost() - 1) * 100);
      if (pct > 0) { boostEl.innerHTML = svgIcon("sparkle", "ico sm") + " +" + pct + "% XP"; boostEl.hidden = false; }
      else { boostEl.hidden = true; boostEl.textContent = ""; }
    }
    const t2 = highestTitle();
    chip.setAttribute("title", "Level " + info.level + " · " + info.rank +
      (t2 ? " · " + t2.name : "") + " · " + game.xp + " XP total");
  }

  /* --- แถวรางวัลตามเลเวล (หน้า Achievements) --- */
  function renderRewards() {
    const rail = $("rewardRail");
    if (!rail) return;
    const lv = currentLevel();
    rail.innerHTML = LEVEL_REWARDS.map(function (r) {
      const got = r.level <= lv;
      const isTheme = r.type === "theme";
      const isActiveTheme = isTheme && settings.accent === r.accent;
      const swatch = (isTheme && ACCENT_SWATCH[r.accent])
        ? '<span class="reward-swatch">' + ACCENT_SWATCH[r.accent].map(function (c) {
            return '<i class="rw-dot" data-bg="' + c + '"></i>';
          }).join("") + "</span>"
        : "";
      const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2"/><rect x="4.5" y="10" width="15" height="10" rx="2.2"/><circle cx="12" cy="12" r="1.6"/></svg>';
      
      const themeClass = isTheme && got ? " theme-card" + (isActiveTheme ? " active-theme" : "") : "";
      const dataAttr = isTheme && got ? ' data-accent="' + r.accent + '" style="cursor:pointer;" title="คลิกเพื่อใช้งานธีมนี้"' : '';

      return '<div class="reward-card ' + (got ? "unlocked" : "locked") + themeClass + '"' + dataAttr + '>' +
        '<div class="reward-ico">' + (got ? svgIcon(r.icon, "ico") : '<span class="ico">' + LOCK + "</span>") + "</div>" +
        '<div class="reward-lvl">Lv ' + r.level + (isActiveTheme ? ' <span class="active-pill" style="color:var(--primary);font-weight:700;">' + svgIcon("tick", "ico sm") + ' Active</span>' : '') + "</div>" +
        '<div class="reward-name">' + (got ? r.name : "???") + "</div>" +
        '<div class="reward-desc">' + (got ? (isTheme ? svgIcon("sparkle", "ico sm") + " คลิกเพื่อเปลี่ยนธีมสีนี้ทันที" : r.desc) : "Reach level " + r.level + " to unlock") + "</div>" +
        swatch +
        "</div>";
    }).join("");
    applyInlineStyles(rail);

    rail.querySelectorAll(".theme-card").forEach(function (card) {
      card.onclick = function () {
        const acc = card.dataset.accent;
        if (!acc) return;
        settings.accent = acc;
        save(K_SETTINGS, settings);
        applyAccent();
        toast("เปลี่ยนธีมเป็น " + (card.querySelector(".reward-name")?.textContent || acc) + " แล้ว!", "ok");
        renderRewards();
        const accBox = $("accentSwatches");
        if (accBox && typeof renderAccentSwatches === "function") renderAccentSwatches();
      };
    });
  }

  /* --- Toast แจ้งว่ารางวัลปลดล็อก (แสดงทีละรายการ) --- */
  function rewardToast(r) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast reward-toast";
    el.innerHTML = '<span class="toast-ico">' + svgIcon(r.icon, "ico sm") + "</span>" +
      '<span class="toast-msg"><b>' + svgIcon("gift", "ico sm") + " " + t("reward.unlocked") + '</b> ' + r.name + "</span>";
    wrap.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () { el.classList.remove("show"); }, 3600);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  /* --- Progress ของ achievement ที่มีเป้าหมาย --- */
  function achProgressCur(a) {
    if (a.id === "scholar" || a.id === "polyglot") return Math.min(masteredCount(), a.goal);
    if (a.id === "bookworm") return Math.min(totalLearned(), a.goal);
    return 0;
  }

  /* --- หน้า Achievements --- */
  function renderAchievements() {
    const view = $("view-achievements");
    if (!view) return;
    const total = ACHIEVEMENTS.length;
    const unlocked = ACHIEVEMENTS.filter(function (a) { return game.achievements[a.id]; }).length;
    const info = levelProgress(game.xp);
    const head = view.querySelector(".ach-head");
    if (head) {
      const c = head.querySelector(".ach-count");
      const l = $("achLvl");
      const x = $("achXp");
      if (c) c.textContent = "Unlocked " + unlocked + " / " + total;
      if (l) l.textContent = "Level " + info.level + " · " + info.rank;
      if (x) x.textContent = game.xp + " XP total";
    }
    renderRewards();
    const grid = view.querySelector(".ach-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const cats = [];
    ACHIEVEMENTS.forEach(function (a) { if (cats.indexOf(a.cat) === -1) cats.push(a.cat); });
    const LOCK = '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2"/><rect x="4.5" y="10" width="15" height="10" rx="2.2"/><circle cx="12" cy="15" r="1.6"/></svg></span>';
    cats.forEach(function (cat) {
      const sec = el("div", "ach-cat");
      sec.appendChild(el("h3", "ach-cat-title", cat));
      const g = el("div", "ach-grid-inner");
      ACHIEVEMENTS.filter(function (a) { return a.cat === cat; }).forEach(function (a) {
        const got = !!game.achievements[a.id];
        const card = el("div", "ach-card " + (got ? "unlocked" : "locked"));
        let prog = "";
        if (!got && a.goal) {
          const cur = achProgressCur(a);
          prog = '<div class="ach-progress"><span data-w="' + Math.round(cur / a.goal * 100) + '%"></span></div>' +
                 '<span class="ach-prog-text">' + cur + " / " + a.goal + "</span>";
        }
        card.innerHTML =
          '<div class="ach-ico">' + (got ? svgIcon(a.icon, "ico") : LOCK) + "</div>" +
          '<div class="ach-name">' + (got ? a.name : "???") + "</div>" +
          '<div class="ach-desc">' + (got ? a.desc : "Locked") + "</div>" +
          prog +
          (got ? '<div class="ach-date">' + game.achievements[a.id] + "</div>" : "");
        applyInlineStyles(card);
        g.appendChild(card);
      });
      sec.appendChild(g);
      grid.appendChild(sec);
    });
  }

  /* ---------- Statistics view: progress chart + weak spots ---------- */
  function renderStats() {
    const sc = $("statCards");
    if (sc) {
      const totA = totalAnswered(), totC = totalCorrect();
      const acc = totA ? Math.round(totC / totA * 100) : 0;
      const streak = (load(K_STREAK, {})).streak || 0;
      const cards = [
        { n: totA, l: t("stat.total") },
        { n: acc + "%", l: t("stat.acc") },
        { n: streak, l: t("streak.days") },
        { n: masteredCount(), l: t("stat.mastered") }
      ];
      sc.innerHTML = cards.map(function (c) {
        return '<div class="stat-card"><span class="stat-num">' + c.n + '</span><span class="stat-label">' + c.l + "</span></div>";
      }).join("");
    }
    renderWeeklyChart();
    renderAnalytics();
    renderWeakSpots();
    renderLeaderboard();
    const ec = $("exportCsv");
    if (ec) ec.onclick = exportCSV;
  }

  /** Weekly leaderboard from Firestore (competing with real users). */
  function renderLeaderboard() {
    const panel = $("leaderboardPanel");
    const box = $("leaderboardBox");
    if (!panel || !box) return;
    const loggedInCloud = window.VocabAuth && window.VocabAuth.isLoggedIn && window.VocabAuth.isLoggedIn();
    if (!loggedInCloud) { panel.style.display = "none"; return; }
    panel.style.display = "";
    box.innerHTML = '<p class="hint">' + t("lb.loading") + "</p>";
    if (window.VocabAuth.fetchLeaderboard) {
      window.VocabAuth.fetchLeaderboard().then(function (rows) {
        if (!rows || !rows.length) { box.innerHTML = '<p class="hint">' + t("lb.empty") + "</p>"; return; }
        const top = rows.slice(0, 10);
        const meRank = rows.findIndex(function (r) { return r.isMe; });
        const html = top.map(function (r, i) {
          return '<div class="lb-row' + (r.isMe ? " is-me" : "") + '">' +
            '<span class="lb-rank">' + (i + 1) + "</span>" +
            '<span class="lb-name">' + esc(r.username) + (r.isMe ? " (you)" : "") + "</span>" +
            '<span class="lb-xp">' + r.weeklyXp + " XP</span>" +
            "</div>";
        }).join("");
        box.innerHTML = html +
          (meRank >= 10
            ? '<div class="lb-me">…</div><div class="lb-row is-me"><span class="lb-rank">' + (meRank + 1) + '</span><span class="lb-name">' + esc((window.VocabAuth.getUser() || {}).username) + " (you)</span><span class=\"lb-xp\">" + rows[meRank].weeklyXp + " XP</span></div>"
            : "");
      }).catch(function () { box.innerHTML = '<p class="hint">' + t("lb.err") + "</p>"; });
    }
  }

  /** Dashboard analytics: FSRS-based retention, due load, 30-day trend. */
  function renderAnalytics() {
    const box = $("analyticsGrid");
    if (!box) return;
    const seen = ITEMS.filter(function (i) { return (getP(i.id).seen || 0) > 0; });
    const dueNow = ITEMS.filter(isDue);
    const lapses = seen.reduce(function (s, i) { return s + (getP(i.id).lapses || 0); }, 0);

    // Weighted mean predicted retention over all seen cards (today).
    let wSum = 0, wAcc = 0;
    seen.forEach(function (i) {
      const p = getP(i.id);
      const w = Math.min(p.st || 0, 21) + 1;
      wSum += w; wAcc += w * predictRetention(i);
    });
    const avgRet = wSum ? Math.round(wAcc / wSum) : 0;

    // 30-day answer + accuracy trend (last 7 vs previous 7).
    const last7 = answersInWindow(7), prev7 = answersInWindow(14, 7);
    const trend = last7.answered > 0 && prev7.answered > 0
      ? Math.round((last7.answered - prev7.answered) / prev7.answered * 100)
      : (last7.answered > 0 ? 100 : 0);

    const cards = [
      { v: avgRet + "%", l: t("stats.retNow"), sub: seen.length + " " + t("stats.cards") },
      { v: dueNow.length, l: t("stats.dueToday"), sub: dueNow.length ? t("stats.ready") : t("stats.allDone") },
      { v: (last7.answered ? Math.round(last7.correct / last7.answered * 100) : 0) + "%", l: t("stats.acc7"), sub: (trend >= 0 ? "+" : "") + trend + "% vs prev" },
      { v: lapses, l: t("stats.lapses"), sub: t("stats.lapsesHint") }
    ];
    box.innerHTML = cards.map(function (c) {
      return '<div class="analytics-cell"><span class="analytics-num">' + c.v + '</span>' +
        '<span class="analytics-label">' + c.l + "</span>" +
        (c.sub ? '<span class="analytics-sub">' + c.sub + "</span>" : "") + "</div>";
    }).join("");
    renderModeStats();
  }

  /** Render per-mode accuracy for the last 7 days from game.modeStats. */
  function renderModeStats() {
    const wrap = $("modeStatsBox");
    if (!wrap) return;
    const agg = {};
    const days = 7;
    for (let i = 0; i < days; i++) {
      const d = addDays(todayStr(), -i);
      const ms = (game.modeStats || {})[d];
      if (!ms) continue;
      Object.keys(ms).forEach(function (m) {
        if (!agg[m]) agg[m] = { a: 0, c: 0 };
        agg[m].a += ms[m].a || 0;
        agg[m].c += ms[m].c || 0;
      });
    }
    const modes = Object.keys(agg).sort(function (x, y) { return (agg[y].a - agg[x].a); });
    if (!modes.length) { wrap.innerHTML = ""; return; }
    const html = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><span class="ico ico-tile sm" data-icon="activity"></span><strong style="font-size:.9rem;">' + t("stats.modeAcc") + '</strong><span style="font-size:.75rem;opacity:.6;"> · 7 ' + t("stats.days") + '</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + modes.map(function (m) {
        const pct = agg[m].a ? Math.round(agg[m].c / agg[m].a * 100) : 0;
        return '<span class="chip" style="padding:6px 10px;font-size:.8rem;">' + t("mode." + m) + " · " + pct + "% (" + agg[m].c + "/" + agg[m].a + ")</span>";
      }).join("") + "</div>";
    wrap.innerHTML = html;
  }

  /** Count answers (and correct) in the last `days` days, ending `endAgo` days ago. */
  function answersInWindow(days, endAgo) {
    let answered = 0, correct = 0;
    const end = endAgo || 0;
    for (let i = end; i < end + days; i++) {
      const d = addDays(todayStr(), -i);
      const h = history[d] || { answered: 0, correct: 0 };
      answered += h.answered || 0; correct += h.correct || 0;
    }
    return { answered: answered, correct: correct };
  }

  /** Export word progress + review history to a downloadable CSV file. */
  function exportCSV() {
    const rows = [["id", "word", "type", "cefr", "day", "seen", "stability", "difficulty", "reps", "lapses", "due", "last_review", "retention_pct"]];
    ITEMS.forEach(function (i) {
      const p = getP(i.id);
      rows.push([
        String(i.id), String(i.word), String(i.type || ""), String(i.cefr || ""),
        String(i.day || ""), String(p.seen || 0), (p.st || 0).toFixed(2), (p.d || 0).toFixed(2),
        String(p.reps || 0), String(p.lapses || 0), p.due || "", p.lastReview || "",
        String(predictRetention(i))
      ]);
    });
    const histRows = [["date", "answered", "correct"]];
    Object.keys(history).sort().forEach(function (d) {
      histRows.push([d, String(history[d].answered || 0), String(history[d].correct || 0)]);
    });
    const csv = rows.map(function (r) {
      return r.map(function (c) { return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(",");
    }).join("\n") + "\n\n# Review history\n" +
      histRows.map(function (r) { return r.join(","); }).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocab-progress-" + todayStr() + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast(t("stats.exported"));
  }

  function renderWeeklyChart() {
    const wrap = $("weeklyChart");
    if (!wrap) return;
    const DAYS = 84; // 12 weeks
    const dates = [];
    for (let i = DAYS - 1; i >= 0; i--) dates.push(addDays(todayStr(), -i));
    const data = dates.map(function (d) {
      const h = history[d] || { answered: 0, correct: 0 };
      return { d: d, a: h.answered || 0, c: h.correct || 0 };
    });
    const max = Math.max(1, data.reduce(function (m, x) { return Math.max(m, x.a); }, 0));
    const W = DAYS * 7 + 8, H = 150, pad = 6, bw = 5, gap = 2;
    const bars = data.map(function (x, i) {
      const h = Math.round((x.a / max) * (H - pad * 2));
      const y = H - pad - h;
      const acc = x.a ? x.c / x.a : 1;
      const col = x.a === 0 ? "var(--border)" : "hsl(" + Math.round(acc * 130) + ",70%,52%)";
      return '<rect x="' + (4 + i * (bw + gap)) + '" y="' + y + '" width="' + bw + '" height="' + Math.max(h, x.a ? 2 : 1) + '" rx="2" fill="' + col + '"><title>' + x.d + ": " + x.a + " answered</title></rect>";
    }).join("");
    wrap.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" class="weekly-svg" role="img" aria-label="Words studied over the last 12 weeks">' + bars + "</svg>";
  }

  function renderWeakSpots() {
    const box = $("weakList");
    if (!box) return;
    const seen = ITEMS.filter(function (i) { return (getP(i.id).seen || 0) > 0; });
    const weak = seen.map(function (i) {
      const p = getP(i.id);
      const ret = predictRetention(i);
      const overdue = p.due ? Math.max(0, daysSince(p.due)) : 0;
      const score = (100 - ret) * 2 + (p.lapses || 0) * 3 + overdue;
      return { i: i, r: ret, lapses: p.lapses || 0, overdue: overdue, score: score };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, 15);
    if (!weak.length) {
      box.innerHTML = '<p class="hint">' + t("stats.weakEmpty") + "</p>";
      return;
    }
    box.innerHTML = weak.map(function (w) {
      const badge = w.i.type === "vocab" ? "VOCAB" : w.i.type === "collocation" ? "COLLOCATION" : "IDIOM";
      let meta = "";
      if (w.lapses > 0) meta += '<span class="weak-lapses">' + t("stats.weakLapses").replace("{n}", w.lapses) + "</span>";
      if (w.overdue > 0) meta += '<span class="weak-overdue">' + t("stats.weakOverdue").replace("{n}", w.overdue) + "</span>";
      return '<div class="weak-row" data-id="' + w.i.id + '" role="button" tabindex="0">' +
        '<span class="weak-badge">' + badge + "</span>" +
        '<span class="weak-word">' + esc(w.i.word) + "</span>" +
        meta +
        '<span class="weak-pct" data-color="hsl(' + Math.round(w.r / 100 * 130) + ',68%,46%)">' + w.r + "%</span>" +
        "</div>";
    }).join("") +
      '<button class="btn btn-primary weak-review" id="weakReview">' + t("stats.review") + "</button>";
    applyInlineStyles(box);
    box.querySelectorAll(".weak-row").forEach(function (row) {
      row.onclick = function () {
        const it = ITEMS.find(function (x) { return String(x.id) === row.dataset.id; });
        if (it) openDetail(it);
      };
    });
    const rb = $("weakReview");
    if (rb) rb.onclick = function () { reviewWeakSpots(weak.map(function (w) { return w.i; })); };
  }

  /* Launch a flashcard review session over a custom item list. */
  function reviewWeakSpots(list) {
    const items = list || [];
    if (!items.length) { toast(t("stats.weakEmpty"), "err"); return; }
    cardQueue = items.slice(); cardIdx = 0; currentMode = "cards";
    showView("cards");
    $("cardControls").classList.add("hidden");
    $("cardResult").classList.add("hidden");
    $("cardSession").classList.remove("hidden");
    if (typeof showCard === "function") showCard();
  }

  /* --- เรียกเมื่อจบเกม (จาก renderResult) --- */
  function recordSessionStart(mode) {
    game._sessionMode = mode;
    saveGame();
  }
  function recordSessionEnd(mode, score, total) {    if (mode && game.modesUsed.indexOf(mode) === -1) { game.modesUsed.push(mode); saveGame(); }
    if (score != null && total > 0 && score === total) {
      game.perfectGames = (game.perfectGames || 0) + 1;
      if (mode === "quiz" && total >= 10) game._quizPerfect = (game._quizPerfect || 0) + 1;
      saveGame();
      awardXp(20, "perfect:" + mode);
    }
    checkAchievements(); // คืบหน้าโหมด/ประเภท อาจปลดล็อก achievement (เช่น นักสำรวจ)
  }

  /* --- Daily Quests: เป้าหมายรายวัน (คอร์ + หมุนเวียน + รางวัล L14) --- */
  const QUEST_REWARD = 50;
  // เควสต์หมุนเวียนรายวัน — เลือก 1 อันต่อวัน แบบ deterministic จากวันที่ (ไม่จำเจ)
  const QUEST_POOL = [
    { id: "correct", label: "Get 15 answers correct today", target: 15,
      cur: function () { const h = history[todayStr()] || {}; return h.correct || 0; } },
    { id: "accuracy", label: "Hit 80% accuracy (10+ answers)", target: 80,
      cur: function () { const h = history[todayStr()] || {}; const a = h.answered || 0; return a >= 10 ? Math.round((h.correct || 0) / a * 100) : 0; } },
    { id: "master3", label: "Master 3 words today", target: 3,
      cur: function () { return game.dailyMastered[todayStr()] || 0; } }
  ];
  function daySeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }
  function questDefs() {
    const defs = [
      { id: "ans", label: "Answer 20 questions", target: 20, cur: function () { return dailyAnsweredToday(); } },
      { id: "master", label: "Master 2 words", target: 2, cur: function () { return game.dailyMastered[todayStr()] || 0; } },
      { id: "modes", label: "Play 3 game modes", target: 3, cur: function () { const m = game.dailyModes[todayStr()]; return m ? m.length : 0; } }
    ];
    // เควสต์หมุนเวียน 1 อันต่อวัน (เป้าหมายรายวันไม่ซ้ำจำเจ)
    const rot = QUEST_POOL[daySeed(todayStr()) % QUEST_POOL.length];
    if (rot) defs.push(rot);
    // รางวัล "Daily Quest +1" (L14): คอมโบ ×5 ในวันเดียว
    if (hasBonusQuest()) {
      defs.push({
        id: "combo", label: "Reach a ×5 combo in one day", target: 5,
        cur: function () { return Math.min(game.dailyCombo[todayStr()] || 0, 5); }
      });
    }
    return defs;
  }
  function ensureDailyQuests() {
    const t = todayStr();
    if (game.questDate !== t) { game.questDate = t; game.questsClaimed = false; saveGame(); }
  }
  function allQuestsDone() {
    ensureDailyQuests();
    return questDefs().every(function (q) { return q.cur() >= q.target; });
  }
  function renderDailyQuests() {
    const panel = $("questPanel"); if (!panel) return;
    ensureDailyQuests();
    const list = $("questList"); if (!list) return;
    const defs = questDefs();
    list.innerHTML = "";
    defs.forEach(function (q) {
      const done = q.cur() >= q.target;
      const cur = Math.min(q.cur(), q.target);
      const pct = Math.round(cur / q.target * 100);
      const row = el("div", "quest-row" + (done ? " done" : ""));
      row.innerHTML =
        '<span class="quest-check">' + (done ? svgIcon("check", "ico sm") : "") + "</span>" +
        '<span class="quest-label">' + q.label + "</span>" +
        '<span class="quest-prog"><span class="quest-bar"><span data-w="' + pct + '%"></span></span></span>' +
        '<span class="quest-count">' + cur + " / " + q.target + "</span>";
      applyInlineStyles(row);
      list.appendChild(row);
    });
    const claim = $("questClaim");
    if (claim) claim.hidden = !(defs.every(function (q) { return q.cur() >= q.target; }) && !game.questsClaimed);
    const rw = $("questReward");
    if (rw) rw.innerHTML = game.questsClaimed ? svgIcon("tick", "ico sm") + " Claimed" : "+" + QUEST_REWARD + " XP";
    renderMiniQuests(); // ซิงก์กับ widget ลอย
  }
  /* --- Widget ลอย Daily Quest (โชว์ตอนอยู่นอกหน้า Home) --- */
  function renderMiniQuests() {
    const box = $("miniQuest");
    if (!box || box.hidden) return; // ข้ามถ้าซ่อน (อยู่หน้า Home หรือยังไม่เปิด)
    ensureDailyQuests();
    const defs = questDefs();
    const list = $("mqList");
    if (list) {
      list.innerHTML = "";
      defs.forEach(function (q) {
        const done = q.cur() >= q.target;
        const cur = Math.min(q.cur(), q.target);
        const pct = Math.round(cur / q.target * 100);
        const row = el("div", "quest-row" + (done ? " done" : ""));
        row.innerHTML =
          '<span class="quest-check">' + (done ? svgIcon("check", "ico sm") : "") + "</span>" +
          '<span class="quest-label">' + q.label + "</span>" +
          '<span class="quest-prog"><span class="quest-bar"><span data-w="' + pct + '%"></span></span></span>' +
          '<span class="quest-count">' + cur + " / " + q.target + "</span>";
        applyInlineStyles(row);
        list.appendChild(row);
      });
    }
    const doneN = defs.filter(function (q) { return q.cur() >= q.target; }).length;
    const prog = $("mqProg"); if (prog) prog.textContent = doneN + "/" + defs.length;
    const claim = $("mqClaim");
    if (claim) claim.hidden = !(defs.every(function (q) { return q.cur() >= q.target; }) && !game.questsClaimed);
  }
  function updateMiniQuest(name) {
    const box = $("miniQuest"); if (!box) return;
    box.hidden = (name === "home"); // ซ่อนบนหน้า Home (มีแผงใหญ่อยู่แล้ว)
    if (!box.hidden) renderMiniQuests();
  }
  function claimDailyQuests() {
    ensureDailyQuests();
    if (game.questsClaimed || !allQuestsDone()) return;
    game.questsClaimed = true; saveGame();
    awardXp(QUEST_REWARD, "daily-quest");
    toast("Daily Quests complete! +" + QUEST_REWARD + " XP", "ok");
    renderDailyQuests();
  }

  /* ---------- Plan day (วันของแผนตามระดับ CEFR ปัจจุบัน) ----------
     แผนเรียนอิงตามระดับที่ผู้ใช้ได้จาก Placement Test หรือเลือกเอง:
     Day 1 ของแผน = วันแรกของระดับนั้น (เช่น B1 → คำศัพท์วันแรกของ B1)
     วันนับแบบสัมพัทธ์ 1..maxDays ของระดับ (ITEMS ถูกกรอง+remap เป็น Day 1..N)
     วันเริ่มต้นแผนเก็บใน settings.planStartDate (ตั้งเมื่อเปลี่ยนระดับ)
     ถ้าผู้ใช้ปรับเองจะเก็บใน settings.planDayOverride              */
  function currentCefrLevel() {
    if (window.CefrSelector && window.CefrSelector.getEffectiveCefrLevel) {
      try { return window.CefrSelector.getEffectiveCefrLevel(); } catch (e) {}
    }
    return (window.getCefrLevel && window.getCefrLevel()) || "A1";
  }
  function planMaxDays() {
    // จำนวนวันจริงของระดับปัจจุบัน (นับจากวันสัมพัทธ์ใน ITEMS ที่กรองแล้ว)
    const set = {};
    ITEMS.forEach(function (i) { set[Number(i.day)] = true; });
    const keys = Object.keys(set).map(Number).filter(function (n) { return n >= 1 && n <= 480; });
    if (keys.length) return Math.max.apply(null, keys);
    const lv = currentCefrLevel();
    const days = (window.cefrDaysForLevel && window.cefrDaysForLevel(lv)) || [];
    return days.length || 60;
  }
  function day1Date() { return VOCAB_DAYS["1"] ? VOCAB_DAYS["1"].date : null; }
  function computePlanDay() {
    const maxDays = planMaxDays();
    // ถ้ามีวันเริ่มต้นแผน (ตั้งเมื่อทำ Placement Test / เปลี่ยนระดับ) → นับจากวันนั้น
    const base = settings.planStartDate || day1Date();
    if (base) {
      const diff = Math.floor((new Date(todayStr() + "T00:00:00") - new Date(base + "T00:00:00")) / 86400000);
      return Math.max(1, Math.min(1 + Math.max(0, diff), maxDays));
    }
    return 1;
  }
  function currentPlanDay() { return settings.planDayOverride ? settings.planDayOverride : computePlanDay(); }

  /* ---------- CEFR Level Panel (Home) ---------- */
  function renderCEFRBadges() {
    const box = $("cefrBadges");
    if (!box) return;
    const userLevel = window.getCefrLevel ? window.getCefrLevel() : null;
    if (!userLevel) { box.innerHTML = ""; return; }

    let html = "";
    CEFR_ORDER.forEach(function (lv) {
      const info = CEFR_LEVELS[lv];
      const active = lv === userLevel;
      // ถ้าเป็น A1 → Progress Path ครอบวันเดียวกันกับระดับ A1 อยู่แล้ว จึงไม่ต้องบวกซ้ำ
      let extraDays = 0;
      const totalWords = cefrDaysForLevel(lv).reduce(function (sum, d) {
        const dayData = VOCAB_DAYS[String(d)];
        return sum + (dayData ? (dayData.vocabulary || []).length : 0);
      }, 0) + extraDays;
      html += '<button class="cefr-badge' + (active ? " active" : "") + '" style="--lv-color:' + info.color + '">' +
                '<span class="cb-level">' + lv + '</span>' +
                '<span class="cb-name">' + (settings.lang === "th" ? info.th : info.name) + " · " + totalWords + " " + t("stories.wordsCount") + "</span>" +
              "</button>";
    });
    box.innerHTML = html;

    // แสดงข้อความ Progress Path สำหรับผู้ใช้ที่ได้ A1
    if (userLevel === "A1" && window.CEFR_PROGRESS_PATH) {
      const pp = document.createElement("p");
      pp.className = "hint placement-hint";
      pp.textContent = (settings.lang === "th"
        ? "คุณอยู่ระดับ A1 — ระบบได้จัดแผนเรียน 60 วัน (Day "
        : "You are at A1 — a 60-day study plan (Day ") +
        CEFR_PROGRESS_PATH.startDay + "–" + CEFR_PROGRESS_PATH.endDay +
        (settings.lang === "th" ? ") เพื่อพัฒนาสู่ระดับ A2" : ") is set to advance you toward A2");
      box.appendChild(pp);
    }

    // คลิก badge → กรอง Browse ให้ดูเฉพาะระดับนั้น (sync กับ chip เพื่อให้ Browse กรองถูกต้อง)
    box.querySelectorAll(".cefr-badge").forEach(function (el) {
      el.onclick = function () {
        const lv = el.querySelector(".cb-level").textContent;
        settings.cefrFilter = lv;
        save(K_SETTINGS, settings);
        const chip = $("browseCefrLevel");
        if (chip) {
          setChipValue(chip, lv);
          if (chipValue(chip) === lv) {
            cachedBrowseKey = "";
            browsePage = 1;
            populateDayChips();
          }
        }
        showView("browse");
        renderBrowse(true);
      };
    });
  }

  /* ---------- Daily Tasks review state ---------- */
  function getReview(d) { return reviews[d] || { done: 0, nextDue: Number(d) + 1 }; }
  function recordReview(d) {
    const r = getReview(d);
    r.done = (r.done || 0) + 1;
    const gap = (r.done - 1) < GAPS.length ? GAPS[r.done - 1] : 15;
    r.nextDue = currentPlanDay() + gap;
    reviews[d] = r;
    save(K_REVIEWS, reviews);
    awardXp(15, "daily-task"); // ทำ Daily Task เสร็จ +15 XP
  }

  /* ---------- "Mark today as done" (เรียนเสร็จแล้ว) ----------
     ผู้ใช้กดปุ่มบอกว่าเรียนวันนี้เสร็จแล้ว → จองวันนี้ว่าเรียนแล้ว,
     พาคำของวันนี้เข้าสู่รอบทบทวน (FSRS seen) และบันทึกทบทวนวันนี้
     เพื่อให้คำวันนี้กลับมาทบทวนในวันถัดไปตาม GAPS. */
  function isDayDone() {
    return settings.dayDone && settings.dayDone[currentPlanDay()] === todayStr();
  }
  function markDayDone() {
    const cp = currentPlanDay();
    const items = itemsForDay(cp);
    if (!items.length) { toast(t("tasks.noneToMark"), "err"); return; }
    settings.dayDone[cp] = todayStr();
    save(K_SETTINGS, settings);
    // พาคำของวันนี้เข้ารอบทบทวน (ไม่บังคับให้ตอบถูก): ตั้ง FSRS ว่าเห็นแล้ว + due วันถัดไป
    let seeded = 0;
    items.forEach(function (item) {
      const p = getP(item.id);
      if (!p.seen) {
        p.seen = (p.seen || 0) + 1;
        p.lastReview = todayStr();
        p.due = addDays(todayStr(), 1);
        p.st = p.st || 0; p.d = p.d || 5; p.reps = p.reps || 0; p.lapses = p.lapses || 0;
        progress[item.id] = p;
        seeded++;
      }
    });
    if (seeded) save(K_PROGRESS, progress);
    recordReview(cp); // นับทบทวนวันนี้ → คำวันนี้จะกลับมาอีกครั้งตาม GAPS
    bumpStreak();
    toast(t("tasks.doneToast").replace("{n}", items.length), "ok", "check");
    if (tasksViewActive()) renderTasks();
    homeDirty = true;
  }
  function unmarkDayDone() {
    delete settings.dayDone[currentPlanDay()];
    save(K_SETTINGS, settings);
    toast(t("tasks.unmarkedToast"), "ok", "refresh");
    if (tasksViewActive()) renderTasks();
    homeDirty = true;
  }
  function tasksViewActive() {
    const t = $("view-tasks");
    return t && t.classList.contains("active");
  }

  /* ---------- Speech ---------- */
  function speak(text, rate) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = rate || 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- DOM helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ============================================================
     CORRECT / WRONG FEEDBACK EFFECTS
     เสียง + confetti + วงแหวนกระพริบ + สั่น (haptic)
     ============================================================ */
  const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function soundOn() { return !!settings && settings.sound !== false; }
  // Effects intensity (user setting, layered on top of the OS reduced-motion flag):
  //  fxSpectacle -> confetti + glow; fxSubtle -> ring flash + ripple + count-up + chart line.
  function fxSpectacle() { return !REDUCED_MOTION && settings.effects === "full"; }
  function fxSubtle() { return !REDUCED_MOTION && settings.effects !== "off"; }

  /* --- Web Audio chime (no audio files needed) --- */
  let audioCtx = null;
  function playTone(kind) {
    if (!soundOn()) return;
    // Route the standard correct/wrong answer feedback through the soft modern
    // sound engine so it matches the rest of the UI (and survives the autoplay
    // resume race that could otherwise swallow the first sounds).
    if (kind === "correct" || kind === "wrong") { playFx(kind); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      const go = function () {
        const notes = kind === "correct" ? [523.25, 659.25, 783.99] : [329.63, 220.0];
        const type = kind === "correct" ? "triangle" : "sawtooth";
        const t0 = audioCtx.currentTime;
        notes.forEach(function (f, idx) {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = type; o.frequency.value = f;
          o.connect(g); g.connect(audioCtx.destination);
          const st = t0 + idx * (kind === "correct" ? 0.085 : 0.12);
          const dur = kind === "correct" ? 0.2 : 0.22;
          g.gain.setValueAtTime(0.0001, st);
          g.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.16 : 0.13, st + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
          o.start(st); o.stop(st + dur + 0.02);
        });
      };
      if (audioCtx.state === "suspended") {
        const p = audioCtx.resume();
        if (p && p.then) p.then(go).catch(go); else go();
      } else {
        go();
      }
    } catch (e) {}
  }

  /* --- Button press sound: plays button sound.mp3, falls back to a synth click --- */
  let btnAudio = null;
  const BTN_SOUND_SRC = "assets/audio/ui/button sound.mp3";
  function playClickSynth() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t0 = audioCtx.currentTime;
      const o1 = audioCtx.createOscillator(); const g1 = audioCtx.createGain();
      o1.type = "triangle"; o1.frequency.setValueAtTime(1400, t0); o1.frequency.exponentialRampToValueAtTime(620, t0 + 0.03);
      o1.connect(g1); g1.connect(audioCtx.destination);
      g1.gain.setValueAtTime(0.0001, t0); g1.gain.exponentialRampToValueAtTime(0.14, t0 + 0.004); g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      o1.start(t0); o1.stop(t0 + 0.07);
      const o2 = audioCtx.createOscillator(); const g2 = audioCtx.createGain();
      o2.type = "sine"; o2.frequency.setValueAtTime(320, t0); o2.frequency.exponentialRampToValueAtTime(180, t0 + 0.04);
      o2.connect(g2); g2.connect(audioCtx.destination);
      g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(0.08, t0 + 0.005); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      o2.start(t0); o2.stop(t0 + 0.08);
    } catch (e) {}
  }
  function playClick() {
    if (!soundOn()) return;
    if (btnAudio === null) {
      try { btnAudio = new Audio(BTN_SOUND_SRC); btnAudio.preload = "auto"; } catch (e) { btnAudio = false; }
    }
    if (btnAudio) {
      try {
        btnAudio.currentTime = 0;
        const pr = btnAudio.play();
        if (pr && pr.catch) pr.catch(function () { playClickSynth(); });
        return;
      } catch (e) { /* file missing/unplayable — fall back below */ }
    }
    playClickSynth();
  }

  /* --- Soft modern UI sounds (synthesized via Web Audio, no files) ---
     Every recipe is short, gentle and low-volume so nothing is harsh.
     steps: { f, f2?, t, dur, vol, type? } tones and/or { noise, noiseVol?, filter? } */
  const FX_RECIPES = {
    // view switch: soft downward glide
    nav:  [ { f: 700, f2: 470, t: 0, dur: 0.13, vol: 0.045, type: "sine" } ],
    // modal open: gentle rising blip
    open: [ { f: 470, f2: 640, t: 0, dur: 0.09, vol: 0.05, type: "sine" } ],
    // modal close: soft settling blip
    close:[ { f: 640, f2: 470, t: 0, dur: 0.08, vol: 0.04, type: "sine" } ],
    // switches / toggles
    toggle:[ { f: 940, f2: 700, t: 0, dur: 0.045, vol: 0.04, type: "triangle" } ],
    "toast-info": [ { f: 880, t: 0, dur: 0.13, vol: 0.035, type: "sine" } ],
    "toast-ok":   [ { f: 660, t: 0, dur: 0.1, vol: 0.05, type: "sine" }, { f: 880, t: 0.09, dur: 0.16, vol: 0.05, type: "sine" } ],
    "toast-warn": [ { f: 560, t: 0, dur: 0.1, vol: 0.045, type: "sine" }, { f: 500, t: 0.1, dur: 0.14, vol: 0.04, type: "sine" } ],
    "toast-err":  [ { f: 450, f2: 370, t: 0, dur: 0.16, vol: 0.05, type: "sine" } ],
    // flashcard flip: quick papery sweep
    flip: [ { f: 520, f2: 900, t: 0, dur: 0.05, vol: 0.045, type: "triangle" }, { noise: 0.06, noiseVol: 0.025, filter: 2600 } ],
    // book page turn: softer, longer rustle
    page: [ { f: 420, f2: 700, t: 0, dur: 0.12, vol: 0.04, type: "triangle" }, { noise: 0.13, noiseVol: 0.03, filter: 2000 } ],
    // day studied: gentle two-note confirmation
    mark: [ { f: 740, t: 0, dur: 0.08, vol: 0.05, type: "sine" }, { f: 990, t: 0.07, dur: 0.12, vol: 0.045, type: "sine" } ],
    // theme change: soft bell
    chime:[ { f: 1046, t: 0, dur: 0.3, vol: 0.045, type: "sine" } ],
    // achievement unlock: gentle rising arpeggio
    unlock:[ { f: 523, t: 0, dur: 0.11, vol: 0.05, type: "sine" },
             { f: 659, t: 0.1, dur: 0.11, vol: 0.05, type: "sine" },
             { f: 784, t: 0.2, dur: 0.11, vol: 0.05, type: "sine" },
             { f: 1046, t: 0.3, dur: 0.22, vol: 0.045, type: "sine" } ],
    // quiz answer: soft, distinct two-note confirm
    correct: [ { f: 523.25, t: 0, dur: 0.16, vol: 0.06, type: "sine" },
               { f: 783.99, t: 0.09, dur: 0.22, vol: 0.06, type: "sine" } ],
    // quiz answer: gentle low double-tap (never harsh)
    wrong:  [ { f: 329.63, t: 0, dur: 0.16, vol: 0.055, type: "sine" },
              { f: 246.94, t: 0.12, dur: 0.22, vol: 0.05, type: "sine" } ]
  };
  function playFx(name) {
    if (!soundOn()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      const steps = FX_RECIPES[name];
      if (!steps) return;
      const go = function () {
        const t0 = audioCtx.currentTime;
        steps.forEach(function (s) {
          if (s.noise) {
            const nDur = s.noise, nVol = s.noiseVol || 0.03, cf = s.filter || 2200;
            const n = Math.floor(audioCtx.sampleRate * nDur);
            const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
            const src = audioCtx.createBufferSource(); src.buffer = buf;
            const bp = audioCtx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = cf; bp.Q.value = 0.8;
            const g = audioCtx.createGain();
            src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(nVol, t0 + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + nDur);
            src.start(t0); src.stop(t0 + nDur + 0.02);
            return;
          }
          const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
          o.type = s.type || "sine";
          o.frequency.setValueAtTime(s.f, t0 + s.t);
          if (s.f2 && s.f2 !== s.f) o.frequency.exponentialRampToValueAtTime(s.f2, t0 + s.t + s.dur);
          o.connect(g); g.connect(audioCtx.destination);
          g.gain.setValueAtTime(0.0001, t0 + s.t);
          g.gain.exponentialRampToValueAtTime(s.vol, t0 + s.t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + s.t + s.dur);
          o.start(t0 + s.t); o.stop(t0 + s.t + s.dur + 0.03);
        });
      };
      if (audioCtx.state === "suspended") {
        const p = audioCtx.resume();
        if (p && p.then) p.then(go).catch(go); else go();
      } else {
        go();
      }
    } catch (e) {}
  }

  /* ============================================================
     MUSIC SYSTEM  (background "on page" + "in game" songs)
     ============================================================ */
  const PAGE_SONGS = [
    "alex-morgan-jazz-restaurant-music-556244.mp3",
    "alex-morgan-late-night-jazz-midnight-club-music-564261.mp3",
    "alex-morgan-lofi-jazz-retro-coffee-shop-560042.mp3",
    "alex-morgan-lofi-jazz-soulful-midnight-club-560063.mp3",
    "alex-morgan-lofi-jazz-study-music-564256.mp3",
    "alex-morgan-smooth-jazz-lounge-relaxing-evening-537465.mp3",
    "alex-morgan-sultry-jazz-sunny-cafe-music-564254.mp3",
    "alex-morgan-trumpet-jazz-study-music-564260.mp3",
    "atlasaudio-jazz-519632.mp3",
    "lofiroomcafe-cafe-calma-lofi-chill-for-cozy-moments-352430.mp3"
  ];
  const GAME_SONGS = [
    "ingamesong1.mp3", "ingamesong2.mp3", "ingamesong3.mp3", "ingamesong4.mp3",
    "ingamesong5.mp3", "ingamesong6.mp3", "ingamesong7.mp3", "ingamesong8.mp3"
  ];

  // Expose the song lists + a control hook so the mini-player overlay
  // (mini-player.js) can reuse the exact same tracks and take over music
  // cleanly. `musicPlay`/`musicStop` are hoisted function declarations, so
  // referencing them here is safe; `musicAudio` is only touched at call time.
  // NOTE: expose FULL paths (the built-in player builds "assets/music/<mode>/" itself,
  // but the mini-player needs ready-to-load URLs).
  window.VOCAB_MUSIC = {
    onpage: PAGE_SONGS.map(function (n) { return "assets/music/onpage/" + n; }),
    ingame: GAME_SONGS.map(function (n) { return "assets/music/ingame/" + n; })
  };
  window.VocabMusic = {
    play: musicPlay,
    pause: musicStop,
    isPlaying: function () { return !!(musicAudio && !musicAudio.paused); }
  };
  function songLabel(name) {
    if (/^ingamesong/i.test(name)) {
      const n = name.replace(/[^0-9]/g, "") || "1";
      return "Game Track " + n;
    }
    return name.replace(/\.mp3$/i, "")
      .replace(/-\d{4,}$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ").trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  let musicAudio = null;
  let musicMode = "onpage";
  function musicSrc() {
    const list = musicMode === "ingame" ? GAME_SONGS : PAGE_SONGS;
    const i = musicMode === "ingame" ? (settings.gameSong | 0) : (settings.pageSong | 0);
    return "assets/music/" + musicMode + "/" + (list[i] || list[0]);
  }
  function musicPlay() {
    if (!settings.music) return;
    const a = musicAudio || (musicAudio = new Audio());
    a.loop = true;
    a.volume = settings.musicVol != null ? settings.musicVol : 0.5;
    const src = musicSrc();
    if (a.dataset.src !== src) { a.src = src; a.dataset.src = src; a.load(); }
    const p = a.play();
    if (p && p.catch) p.catch(function () {});
  }
  function musicStop() { if (musicAudio) musicAudio.pause(); }
  function musicSetMode(mode) {
    if (mode === musicMode) return;
    musicMode = mode;
    if (settings.music) musicPlay();
  }
  function musicRefresh() {
    if (!settings.music || !musicAudio) return;
    const src = musicSrc();
    if (musicAudio.dataset.src !== src) {
      musicAudio.src = src; musicAudio.dataset.src = src; musicAudio.load();
      musicAudio.play().catch(function () {});
    }
    musicAudio.volume = settings.musicVol != null ? settings.musicVol : 0.5;
  }
  function updateMusicContext() {
    const inGame = !!document.querySelector(".view.active .session:not(.hidden)");
    musicSetMode(inGame ? "ingame" : "onpage");
  }
  function initMusic() {
    updateMusicContext();
    if (settings.music) {
      musicPlay();
      // Browsers block autoplay until a user gesture — start on first interaction
      const kick = function () {
        if (!(musicAudio && !musicAudio.paused)) musicPlay();
        document.removeEventListener("pointerdown", kick);
        document.removeEventListener("keydown", kick);
      };
      document.addEventListener("pointerdown", kick, { once: true });
      document.addEventListener("keydown", kick, { once: true });
    }
    const cont = document.querySelector(".container");
    if (cont && "MutationObserver" in window) {
      let raf = 0;
      const obs = new MutationObserver(function () {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; updateMusicContext(); });
      });
      obs.observe(cont, { attributes: true, subtree: true, attributeFilter: ["class"] });
    }
  }

  /* --- Confetti burst centred on a point --- */
  const CONFETTI_COLORS = ["#4f46e5", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
  const WRONG_COLORS = ["#ef4444", "#dc2626", "#f87171", "#b91c1c", "#fca5a5"];
  function burstConfetti(x, y, count, colors) {
    if (!fxSpectacle()) return;
    const n = count || 32;
    const palette = colors || CONFETTI_COLORS;
    const wrap = document.createElement("div");
    wrap.className = "confetti-burst";
    wrap.style.left = x + "px";
    wrap.style.top = y + "px";
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      const ang = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 150;
      p.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
      p.style.setProperty("--dy", (Math.sin(ang) * dist - 40).toFixed(1) + "px");
      p.style.setProperty("--rot", Math.floor(Math.random() * 720 - 360) + "deg");
      p.style.setProperty("--delay", Math.floor(Math.random() * 70) + "ms");
      p.style.background = palette[i % palette.length];
      if (i % 3 === 0) p.style.borderRadius = "50%";
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 1200);
  }

  /* --- Soft radial glow pulse over the live session on an answer --- */
  function flashGlow(kind) {
    if (!fxSpectacle()) return;
    const el = activeSessionEl();
    if (!el) return;
    const prevPos = el.style.position;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    const ov = document.createElement("div");
    ov.className = "fx-glow " + (kind === "correct" ? "good" : "bad");
    el.appendChild(ov);
    setTimeout(function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (prevPos === "" && getComputedStyle(el).position === "relative") el.style.position = "";
    }, 760);
  }

  /* --- Momentary ring / shake on a container --- */
  function flashElement(el, kind) {
    if (!el || !fxSubtle()) return;
    const cls = kind === "correct" ? "flash-correct" : "flash-wrong";
    el.classList.remove(cls);
    void el.offsetWidth; // restart animation
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 700);
  }

  /* --- Material-style ripple + global click sound on press --- */
  const RIPPLE_SEL = "button, .btn, .chip, .nav-btn, .nav-sub-btn, .bc-speak, .speak-btn, .rel-chip, .browse-card, .task-card, .quiz-opt, .hang-key, .build-tile, .info-btn, .icon-btn";
  function createRipple(e) {
    if (!fxSubtle()) return;
    const el = e.currentTarget;
    if (!el || el.disabled) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const rip = document.createElement("span");
    rip.className = "ripple";
    rip.style.width = rip.style.height = size + "px";
    const cx = (e.clientX || 0) ? e.clientX : rect.left + rect.width / 2;
    const cy = (e.clientY || 0) ? e.clientY : rect.top + rect.height / 2;
    rip.style.left = (cx - rect.left - size / 2) + "px";
    rip.style.top = (cy - rect.top - size / 2) + "px";
    el.appendChild(rip);
    rip.addEventListener("animationend", function () { if (rip.parentNode) rip.remove(); });
    setTimeout(function () { if (rip.parentNode) rip.remove(); }, 700);
  }
  function initInteractionFX() {
    document.addEventListener("click", function (e) {
      const el = e.target.closest && e.target.closest(RIPPLE_SEL);
      if (!el || el.disabled) return;
      // Sound only for actual buttons (quiz-opt has its own correct/wrong tone)
      if (soundOn() && el.matches("button, .btn") && !el.matches(".quiz-opt")) playClick();
      createRipple({ currentTarget: el, clientX: e.clientX, clientY: e.clientY });
    }, true);
  }

  function activeSessionEl() {
    return document.querySelector(".view.active .session:not(.hidden)");
  }

  /**
   * Fire a "win" celebration: chime + haptics + flash ring + confetti burst
   * centred on the anchor element (defaults to the live session).
   */
  function celebrate(anchor) {
    playTone("correct");
    try { if (navigator.vibrate) navigator.vibrate(24); } catch (e) {}
    const el = anchor || activeSessionEl();
    flashElement(el, "correct");
    const target = el || document.body;
    const r = target.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + Math.min(Math.max(r.height / 2, 80), 180);
    burstConfetti(cx, cy);
  }

  /* ---------- Toast notifications (non-blocking) ---------- */
  /**
   * Show a transient toast. type: "info" | "ok" | "err".
   * Replaces native alert() for non-blocking notices.
   */
  function toast(msg, type, icon) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    if (type === "ok") playFx("toast-ok");
    else if (type === "err") playFx("toast-err");
    else if (type === "warn") playFx("toast-warn");
    else playFx("toast-info");
    const t = document.createElement("div");
    t.className = "toast " + (type || "info");
    if (icon) t.innerHTML = '<span class="toast-ico">' + svgIcon(icon, "ico sm") + "</span>" + esc(msg);
    else t.textContent = msg;
    wrap.appendChild(t);
    const remove = function () {
      t.classList.add("leaving");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    };
    t.addEventListener("click", remove);
    setTimeout(remove, 3400);
  }

  /* ---------- Custom confirm dialog (promise-based) ---------- */
  /**
   * Promise-based replacement for native confirm(). Resolves true/false.
   * Falls back to native confirm if the overlay element is missing.
   */
  function confirmDialog(msg, title) {
    return new Promise(function (resolve) {
      const ov = $("confirmOverlay");
      if (!ov) { resolve(window.confirm(msg)); return; }
      ov.innerHTML =
        '<div class="confirm-box" role="document">' +
        '<div class="confirm-title" id="confirmTitle">' + (title || "Please confirm") + '</div>' +
        '<div class="confirm-msg" id="confirmMsg">' + msg + '</div>' +
        '<div class="confirm-actions">' +
        '<button class="btn" id="confirmCancel">Cancel</button>' +
        '<button class="btn btn-primary" id="confirmOk">Confirm</button>' +
        '</div></div>';
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
      const okBtn = $("confirmOk"), cancelBtn = $("confirmCancel");
      let done = false;
      function finish(val) {
        if (done) return; done = true;
        ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
        document.removeEventListener("keydown", onKey);
        setTimeout(function () { ov.innerHTML = ""; }, 250);
        resolve(val);
      }
      function onKey(e) { if (e.key === "Escape") finish(false); }
      okBtn.onclick = function () { finish(true); };
      cancelBtn.onclick = function () { finish(false); };
      ov.onclick = function (e) { if (e.target === ov) finish(false); };
      document.addEventListener("keydown", onKey);
      okBtn.focus();
    });
  }

  /* ---------- Unified result screen (dedupes the end-X builders) ---------- */
  /**
   * Render a standard result panel. misses shown as a list if provided.
   * opts: { id, title, big, sub, note, missed[], missedHeader, missedHTML, emptyMsg, backLabel, backView }
   */
  function renderResult(opts) {
    const r = $(opts.id);
    r.classList.remove("hidden");
    let html = "<h2>" + (opts.icon ? svgIcon(opts.icon, "ico res-ico") : "") + opts.title + "</h2>";
    if (opts.big != null) html += "<p class=\"big\">" + opts.big + "</p>";
    if (opts.sub) html += "<p>" + opts.sub + "</p>";
    if (opts.note) html += "<p class=\"mt-10\">" + opts.note + "</p>";
    if (opts.missed && opts.missed.length) {
      html += "<h3 class=\"mt-14\">" + (opts.missedHeader || "Missed") + " (" + opts.missed.length + ")</h3>" +
        "<div class=\"missed-list\">" + (opts.missedHTML || "") + "</div>";
    } else if (opts.emptyMsg) {
      html += "<p class=\"mt-10\">" + opts.emptyMsg + "</p>";
    }
    const backId = opts.id + "Back";
    html += "<button class=\"btn btn-primary\" id=\"" + backId + "\">" + (opts.backLabel || "Back to Home") + "</button>";
    r.innerHTML = html;
    $(backId).onclick = function () { showView(opts.backView || "home"); };
    if (opts.mode) recordSessionEnd(opts.mode, opts.score, opts.total); // โหมด + perfect-game XP
    if (opts.celebrate) {
      // wait a frame so the panel is laid out before measuring for the confetti burst
      requestAnimationFrame(function () {
        const r2 = r.getBoundingClientRect();
        burstConfetti(r2.left + r2.width / 2, r2.top + Math.min(Math.max(r2.height / 2, 90), 220));
      });
    }
  }

  /* ---------- Correct / wrong feedback badge (replaces ✅ / ❌ emoji) ---------- */
  function fbIcon(kind) {
    const path = kind === "correct"
      ? '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6L16 9"/>'
      : '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>';
    return '<span class="fb-badge ' + kind + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg></span>';
  }
  /** Render a correct/wrong feedback line with a circular icon + safe text. */
  function setFeedback(fb, kind, text) {
    fb.innerHTML = fbIcon(kind);
    fb.appendChild(document.createTextNode(text));
    fb.style.color = kind === "correct" ? "var(--good)" : "var(--bad)";
    // Per-answer reaction: chime + flash ring + soft glow + haptic + spectacle.
    playTone(kind);
    try { if (navigator.vibrate) navigator.vibrate(kind === "correct" ? 24 : [0, 35, 25, 35]); } catch (e) {}
    const sess = activeSessionEl();
    flashElement(sess, kind);
    flashGlow(kind);
    // Punchy badge animation so every answer feels alive.
    const badge = fb.querySelector(".fb-badge");
    if (badge && fxSubtle()) {
      badge.style.animation = kind === "correct"
        ? "fbPop .5s cubic-bezier(.2,.9,.3,1.3) both"
        : "shake .45s ease both";
    }
    // Spectacular burst centred on the live session, win-style (red-themed on wrong).
    const isCorrect = kind === "correct";
    const palette = isCorrect ? null : WRONG_COLORS;
    const count = isCorrect ? 32 : 28;
    if (sess && fxSpectacle()) {
      const r = sess.getBoundingClientRect();
      burstConfetti(r.left + r.width / 2, r.top + Math.min(Math.max(r.height / 2, 80), 180), count, palette);
    } else {
      const br = fb.getBoundingClientRect();
      burstConfetti(br.left + br.width / 2, br.top + br.height / 2, count, palette);
    }
  }

  /* ---------- View switching ---------- */
  /**
   * Switch to a view by name: stops any running session/timers, syncs the
   * active nav state, and lazily (re)renders the destination view.
   */
  function showView(name) {
    // ตรวจสอบว่าผู้ใช้ทำ Placement Test หรือเลือกระดับหรือยัง ก่อนเข้าหน้าเรียน/ดูคำศัพท์
    var restrictedViews = ["browse", "cards", "quiz", "pron", "fill", "match", "tf", "hang", "build", "cloze", "listen"];
    if (restrictedViews.indexOf(name) !== -1 && name !== "home") {
      const hasTest = window.hasTakenPlacementTest && window.hasTakenPlacementTest();
      let hasSelected = false;
      try {
        const s = window.SecureStore ? window.SecureStore.load("vocab_settings_v1", {}) : JSON.parse(localStorage.getItem("vocab_settings_v1") || "{}");
        hasSelected = !!(s && s.selectedCefrLevel);
      } catch (e) {}
      if (!hasTest && !hasSelected) {
        toast("กรุณาทำแบบทดสอบวัดระดับหรือเลือกระดับภาษาก่อนเริ่มเรียน", "err");
        showView("home");
        const pTest = $("placementTest");
        if (pTest) pTest.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }

    // รีเซ็ตสถานะ session เก่าเมื่อเปลี่ยนหน้า
    stopRecognition();
    stopGameTimers();
    ["quizSession", "cardSession", "quizResult", "cardResult", "pronSession", "pronResult2",
     "fillSession", "fillResult", "matchSession", "matchResult", "tfSession", "tfResult",
     "hangSession", "hangResult", "buildSession", "buildResult", "clozeSession", "clozeResult", "listenSession", "listenResult"].forEach(function (id) {
      const e = $(id); if (e) e.classList.add("hidden");
    });
    ["quizControls", "cardControls", "pronControls"].forEach(function (id) {
      const e = $(id); if (e) e.classList.remove("hidden");
    });

    document.querySelectorAll(".nav-btn").forEach(function (b) {
      const on = b.dataset.view === name;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    document.querySelectorAll(".nav-sub-btn").forEach(function (b) {
      const on = b.dataset.view === name;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var gameViews = ["cards","quiz","pron","fill","match","tf","hang","build","cloze","listen","dictation"];
    if (gameViews.indexOf(name) !== -1) {
      $("navGamesSub").classList.add("open");
      $("navGames").setAttribute("aria-expanded", "true");
    }
    document.querySelectorAll(".view").forEach(function (v) {
      const on = v.id === "view-" + name;
      v.classList.toggle("active", on);
      if (on) { v.removeAttribute("inert"); v.setAttribute("aria-hidden", "false"); v.setAttribute("tabindex", "-1"); }
      else { v.setAttribute("inert", ""); v.setAttribute("aria-hidden", "true"); }
    });
    stopReminderScheduler();
    if (name === "home") renderHome();
    if (name === "browse") renderBrowse();
    if (name === "settings") renderSettings();
    if (name === "tasks") renderTasks();
    if (name === "achievements") renderAchievements();
    if (name === "stats") renderStats();
    if (name === "aichat") renderAiChat();
    if (name === "stories") renderStories();
    if (name === "dictation") renderDictationQuiz();
    updateMiniQuest(name); // ซ่อนwidgetบนHome / โชว์+เรนเดอร์บนหน้าอื่น
    if (name === "fill") resetFill();
    if (name === "match") resetMatch();
    if (name === "tf") resetTf();
    if (name === "hang") resetHang();
    if (name === "build") resetBuild();
    if (name === "cloze") resetCloze();
    if (name === "listen") resetListen();
  }

  /* ---------- Clickable chip selectors (แทน <select>) ---------- */
  function buildChips(container, options, initial, onSelect) {
    container.innerHTML = "";
    options.forEach(function (opt) {
      const b = el("button", "chip", opt.label);
      b.type = "button";
      b.dataset.value = opt.value;
      if (opt.value === initial) b.classList.add("active");
      b.onclick = function () {
        container.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
        b.classList.add("active");
        if (onSelect) onSelect();
      };
      container.appendChild(b);
    });
  }
  function chipValue(container) {
    const a = container.querySelector(".chip.active");
    return a ? a.dataset.value : "";
  }
  function setChipValue(container, value) {
    container.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("active", c.dataset.value === String(value));
    });
  }
  const CHIP_DEFS = {
    cardFilterType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    cardMode: [["all", "All"], ["due", "Due only"], ["random", "Random"]],
    quizMode: [["meaning", "Word → Meaning"], ["sentence", "Sentence → Thai"]],
    quizCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    quizType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    browseType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    pronCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    pronType: [["vocab", "Vocab"], ["idiom", "Idioms"], ["collocation", "Collocations"], ["all", "All"]],
    fillDir: [["th2en", "Thai → Word"], ["en2th", "Word → Thai"]],
    fillType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    fillCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    matchType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    matchSize: [["6", "6 pairs"], ["8", "8 pairs"], ["10", "10 pairs"]],
    tfType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    tfCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    tfTime: [["30", "30s"], ["60", "60s"], ["120", "120s"]],
    hangType: [["vocab", "Vocab"]],
    hangCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    buildType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    buildCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    clozeType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    clozeCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    listenType: [["all", "All"], ["vocab", "Vocab"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    listenCount: [["10", "10"], ["20", "20"], ["all", "All"]],
    browseCefrLevel: [["all", "All Levels"], ["A1", "A1"], ["A2", "A2"], ["B1", "B1"], ["B2", "B2"], ["C1", "C1"], ["C2", "C2"]]
  };
  const CHIP_DEFAULT = { cardFilterType: "all", cardMode: "all", quizMode: "meaning", quizCount: "10", quizType: "all", browseType: "all", pronCount: "10", pronType: "vocab", fillDir: "th2en", fillType: "all", fillCount: "10", matchType: "all", matchSize: "8", tfType: "all", tfCount: "10", tfTime: "60", hangType: "vocab", hangCount: "10", buildType: "all", buildCount: "10", clozeType: "all", clozeCount: "10", listenType: "all", listenCount: "10", browseCefrLevel: "A1" };
  function populateDayChips() {
    const cefrFilter = (document.getElementById("browseCefrLevel") ? chipValue($("browseCefrLevel")) : "all") || "all";
    let allowedDays = [];
    if (cefrFilter !== "all" && window.cefrDaysForLevel) {
      allowedDays = window.cefrDaysForLevel(cefrFilter);
    } else {
      allowedDays = Object.keys(VOCAB_DAYS).map(Number).filter(function (d) { return d >= 1 && d <= 480; }).sort(function (a, b) { return a - b; });
    }

    const c = $("browseDay"); if (!c) return;
    const cur = chipValue(c) || "all";
    const opts = [{ value: "all", label: "Every day" }].concat(
      allowedDays.map(function (d, index) {
        const dayNum = cefrFilter !== "all" ? (index + 1) : d;
        return { value: String(dayNum), label: "Day " + dayNum };
      })
    );
    buildChips(c, opts, cur, function () { cachedBrowseKey = ""; browsePage = 1; renderBrowse(true); });
    renderDayTracker();
  }
  function renderDayTracker() {
    const chipsEl = $("dayTrackerChips");
    const sumEl = $("dayTrackerSummary");
    const fillEl = $("dayTrackerFill");
    if (!chipsEl || !sumEl) return;
    const cefrFilter = (document.getElementById("browseCefrLevel") ? chipValue($("browseCefrLevel")) : "all") || "all";
    let allowedDays = [];
    if (cefrFilter !== "all" && window.cefrDaysForLevel) {
      allowedDays = window.cefrDaysForLevel(cefrFilter);
    } else {
      allowedDays = Object.keys(VOCAB_DAYS).map(Number).filter(function (d) { return d >= 1 && d <= 480; }).sort(function (a, b) { return a - b; });
    }
    const studied = settings.studiedDays || [];
    const set = {};
    studied.forEach(function (d) { set[String(d)] = true; });

    chipsEl.innerHTML = "";
    allowedDays.forEach(function (actualDay, index) {
      const dayNum = cefrFilter !== "all" ? (index + 1) : actualDay;
      const done = !!set[String(actualDay)];
      const b = el("button", "chip dt-day" + (done ? " done" : ""), "Day " + dayNum + (done ? " " + svgIcon("tick", "ico sm") : ""));
      b.type = "button";
      b.title = done ? t("browse.unmarkStudied") : t("browse.markStudied");
      b.dataset.day = String(actualDay);
      b.onclick = function () {
        const arr = settings.studiedDays || (settings.studiedDays = []);
        const key = String(actualDay);
        const i = arr.indexOf(key);
        if (i >= 0) { arr.splice(i, 1); }
        else { arr.push(key); }
        save(K_SETTINGS, settings);
        renderDayTracker();
      };
      chipsEl.appendChild(b);
    });

    const total = allowedDays.length;
    const done = allowedDays.filter(function (d) { return set[String(d)]; }).length;
    const remaining = total - done;
    sumEl.textContent = t("browse.studied") + " " + done + " / " + total + " · " + t("browse.remaining") + " " + remaining + " " + t("browse.daysToFinish");
    if (fillEl) fillEl.style.width = total ? Math.round((done / total) * 100) + "%" : "0%";
  }
  function initChips() {
    Object.keys(CHIP_DEFS).forEach(function (id) {
      const c = $(id); if (!c) return;
      const onSel = (id === "browseType" || id === "browseCefrLevel") ? function () {
        if (id === "browseCefrLevel") populateDayChips();
        cachedBrowseKey = "";
        browsePage = 1;
        renderBrowse(true);
      } : null;
      buildChips(c, CHIP_DEFS[id].map(function (o) { return { value: o[0], label: o[1] }; }), CHIP_DEFAULT[id] || "all", onSel);
    });
    populateDayChips();
  }

  /* ============================================================
     WORD SOURCE SELECTOR (per-game level + day-range picker)
     ให้ผู้ใช้เลือก CEFR level + ช่วงวันคำศัพท์สำหรับแต่ละเกม
     โดยไม่ต้องกดเลือกทีละวัน — ใช้ preset และช่วงจาก/ถึง
     ============================================================ */
  const GAME_KEYS = ["cards", "quiz", "pron", "fill", "match", "tf", "hang", "build", "cloze", "listen"];
  const GAME_SOURCE_LEVELS = [["current", "src.current"], ["all", "src.allLevels"], ["A1", "A1"], ["A2", "A2"], ["B1", "B1"], ["B2", "B2"], ["C1", "C1"], ["C2", "C2"]];
  const GAME_SOURCE_PRESETS = [["all", "src.allDays"], ["day1", "src.day1"], ["week", "src.week"], ["month", "src.month"], ["custom", "src.custom"]];
  function gameSourceDefault() { return { level: "current", preset: "all", from: 1, to: 60 }; }
  function getGameSource(gameKey) {
    const def = gameSourceDefault();
    const s = (settings.gameSources && settings.gameSources[gameKey]) || {};
    return { level: s.level || def.level, preset: s.preset || def.preset, from: s.from || def.from, to: s.to || def.to };
  }
  function setGameSource(gameKey, patch) {
    if (!settings.gameSources || typeof settings.gameSources !== "object") settings.gameSources = {};
    settings.gameSources[gameKey] = Object.assign({}, getGameSource(gameKey), patch);
    save(K_SETTINGS, settings);
  }
  function gameSourceMaxDay(level) {
    if (level === "all") return 480;
    if (level === "A1" || level === "A2") return 60;
    if (level === "B1" || level === "B2" || level === "C1" || level === "C2") return 90;
    if (level === "current") {
      const lvl = currentCefrLevel();
      return (lvl === "A1" || lvl === "A2") ? 60 : 90;
    }
    return 480;
  }
  function gameSourceBase(level) {
    if (level === "current") return ITEMS;
    if (level === "all") return ALL_ITEMS;
    if (window.CefrSelector && window.CefrSelector.getItemsForLevel) return window.CefrSelector.getItemsForLevel(level);
    return ITEMS;
  }
  function getGameSourceItems(gameKey) {
    const src = getGameSource(gameKey);
    const max = gameSourceMaxDay(src.level);
    let from = clamp(parseInt(src.from, 10) || 1, 1, max);
    let to = clamp(parseInt(src.to, 10) || max, 1, max);
    if (to < from) to = from;
    return gameSourceBase(src.level).filter(function (i) {
      const d = Number(i.day);
      return d >= from && d <= to;
    });
  }
  function updateSourceCount(gameKey) {
    const n = getGameSourceItems(gameKey).length;
    const elc = $("srcCount-" + gameKey);
    if (elc) elc.textContent = t("src.words").replace("{n}", n);
  }
  function syncSourceRangeInputs(gameKey) {
    const src = getGameSource(gameKey);
    const max = gameSourceMaxDay(src.level);
    const fromEl = $("srcFrom-" + gameKey), toEl = $("srcTo-" + gameKey);
    if (fromEl) { fromEl.max = max; fromEl.value = clamp(src.from || 1, 1, max); }
    if (toEl) { toEl.max = max; toEl.value = clamp(src.to || max, 1, max); }
    const rangeEl = $("srcRange-" + gameKey);
    if (rangeEl) rangeEl.classList.toggle("hidden", src.preset !== "custom");
  }
  function onGameSourceChange(gameKey) {
    const level = chipValue($("srcLevel-" + gameKey)) || "current";
    const preset = chipValue($("srcDays-" + gameKey)) || "all";
    const max = gameSourceMaxDay(level);
    let from = 1, to = max;
    if (preset === "day1") { from = 1; to = 1; }
    else if (preset === "week") { from = 1; to = Math.min(7, max); }
    else if (preset === "month") { from = 1; to = Math.min(30, max); }
    else if (preset === "custom") {
      from = clamp(parseInt($("srcFrom-" + gameKey).value, 10) || 1, 1, max);
      to = clamp(parseInt($("srcTo-" + gameKey).value, 10) || max, 1, max);
      if (to < from) to = from;
    }
    setGameSource(gameKey, { level: level, preset: preset, from: from, to: to });
    syncSourceRangeInputs(gameKey);
    updateSourceCount(gameKey);
  }
  function mountGameSource(gameKey) {
    const controls = document.querySelector("#" + gameKey + "Controls .controls");
    if (!controls) return;
    let field = $("srcField-" + gameKey);
    if (!field) {
      field = el("div", "field src-field");
      field.id = "srcField-" + gameKey;
      field.innerHTML =
        '<span class="field-label" data-i18n="label.source">Word source</span>' +
        '<div class="chip-group" id="srcLevel-' + gameKey + '"></div>' +
        '<div class="chip-group" id="srcDays-' + gameKey + '"></div>' +
        '<div class="src-range" id="srcRange-' + gameKey + '">' +
          '<span class="src-range-lbl" data-i18n="src.from">From</span>' +
          '<input type="number" id="srcFrom-' + gameKey + '" min="1">' +
          '<span class="src-range-lbl" data-i18n="src.to">To</span>' +
          '<input type="number" id="srcTo-' + gameKey + '" min="1">' +
        '</div>' +
        '<span class="src-count" id="srcCount-' + gameKey + '"></span>';
      controls.appendChild(field);
      const fromEl = $("srcFrom-" + gameKey), toEl = $("srcTo-" + gameKey);
      if (fromEl) fromEl.oninput = function () { onGameSourceChange(gameKey); };
      if (toEl) toEl.oninput = function () { onGameSourceChange(gameKey); };
    }
    const src = getGameSource(gameKey);
    buildChips($("srcLevel-" + gameKey), GAME_SOURCE_LEVELS.map(function (o) { return { value: o[0], label: t(o[1]) }; }), src.level, function () { onGameSourceChange(gameKey); });
    buildChips($("srcDays-" + gameKey), GAME_SOURCE_PRESETS.map(function (o) { return { value: o[0], label: t(o[1]) }; }), src.preset, function () { onGameSourceChange(gameKey); });
    syncSourceRangeInputs(gameKey);
    updateSourceCount(gameKey);
  }
  function initGameSources() { GAME_KEYS.forEach(mountGameSource); }

  /* ============================================================
     DASHBOARD ANALYTICS  (history series, mastery, count-up)
     ============================================================ */
  let chartRangeDays = 14;

  /** Last `days` days as {date, answered, correct, accuracy}, gaps filled with 0. */
  function getHistorySeries(days) {
    const out = [];
    const today = todayStr();
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const h = history[d] || { answered: 0, correct: 0 };
      out.push({
        date: d,
        answered: h.answered,
        correct: h.correct,
        accuracy: h.answered ? Math.round((h.correct / h.answered) * 100) : 0
      });
    }
    return out;
  }

  /** Last `days` days as {date, learned, cumulative}, gaps filled with 0 (cumulative words learned). */
  function getLearnedSeries(days) {
    const out = [];
    const today = todayStr();
    let run = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const n = learned[d] || 0;
      run += n;
      out.push({ date: d, learned: n, cumulative: run });
    }
    return out;
  }

  /** Counts per item type: { type: { total, mastered } }. */
  function masteryByType() {
    const types = ["vocab", "collocation", "idiom"];
    const res = {};
    types.forEach(function (t) {
      const list = ITEMS.filter(function (i) { return i.type === t; });
      res[t] = { total: list.length, mastered: list.filter(isMastered).length };
    });
    return res;
  }

  /** Overall accuracy (0-100) across the last `days` days. */
  function accuracyLast(days) {
    const s = getHistorySeries(days);
    let a = 0, c = 0;
    s.forEach(function (r) { a += r.answered; c += r.correct; });
    return a ? Math.round((c / a) * 100) : 0;
  }

  /** Animated number count-up. Respects reduced-motion. */
  function animateCount(node, to, dur) {
    if (!node) return;
    if (!fxSubtle() || to === 0) { node.textContent = to; return; }
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / (dur || 900));
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(to * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  let homeDirty = true;

  /** Due forecast: count of items due today / tomorrow / next 7 days from FSRS due dates. */
  function dueInDays(nDays) {
    const today = todayStr();
    const maxDate = addDays(today, nDays);
    let count = 0, wCount = 0;
    ITEMS.forEach(function (i) {
      const p = getP(i.id);
      if (!p.seen || !p.due) return;
      if (p.due <= maxDate && p.due >= today) {
        count++;
        wCount += (100 - (predictRetention(i) || 0)) / 100; // weighted by how overdue-forgotten
      }
    });
    return { count: count, weight: Math.round(wCount) };
  }

  function renderDueForecast() {
    const wrap = $("dueForecast");
    const panel = $("dueForecastPanel");
    if (!wrap || !panel) return;
    const seen = ITEMS.filter(function (i) { return (getP(i.id).seen || 0) > 0; });
    const today = dueInDays(0);
    const tomorrow = dueInDays(1);
    const week = dueInDays(7);
    if (seen.length === 0) { panel.style.display = "none"; return; }
    panel.style.display = "";
    const cards = [
      { v: today.count, l: t("due.today"), sub: today.count ? t("due.todayHint") : t("stats.allDone") },
      { v: tomorrow.count, l: t("due.tomorrow"), sub: tomorrow.count ? t("due.tomorrowHint") : t("due.none") },
      { v: week.count, l: t("due.week"), sub: t("due.weekHint").replace("{n}", week.count) }
    ];
    wrap.innerHTML = cards.map(function (c) {
      return '<div class="analytics-cell"><span class="analytics-num">' + c.v + '</span>' +
        '<span class="analytics-label">' + c.l + "</span>" +
        '<span class="analytics-sub">' + c.sub + "</span></div>";
    }).join("");

    // Daily review goal progress bar (game.dailyAnswered[today])
    const done = game.dailyAnswered[todayStr()] || 0;
    const goal = settings.reviewGoal || 20;
    const pct = Math.min(100, Math.round((done / goal) * 100));
    wrap.insertAdjacentHTML("beforeend",
      '<div class="goal-wrap"><div class="goal-label">' + t("due.goal").replace("{d}", done).replace("{g}", goal) + '</div>' +
      '<div class="goal-bar"><div class="goal-fill" style="width:' + pct + '%"></div></div>' +
      (done >= goal ? '<div class="goal-done">' + t("due.goalDone") + '</div>' : "") + "</div>");

    renderStorySuggestion();
  }

  /** Weakest items by retention/lapses/overdue (shared by weak-spots panel + story suggestions). */
  function getWeakWords(max) {
    const seen = ITEMS.filter(function (i) { return (getP(i.id).seen || 0) > 0; });
    return seen.map(function (i) {
      const p = getP(i.id);
      const ret = predictRetention(i);
      const overdue = p.due ? Math.max(0, daysSince(p.due)) : 0;
      const score = (100 - ret) * 2 + (p.lapses || 0) * 3 + overdue;
      return { i: i, r: ret, lapses: p.lapses || 0, overdue: overdue, score: score };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, max || 15).map(function (w) { return w.i; });
  }

  /** Recommend stories whose CEFR target set overlaps the user's weak words. */
  function renderStorySuggestion() {
    const panel = $("storySuggestPanel");
    const box = $("storySuggestBox");
    if (!panel || !box) return;
    const weak = getWeakWords(20);
    if (weak.length < 3) { panel.style.display = "none"; return; }
    const weakSet = {};
    weak.forEach(function (i) { weakSet[i.word.toLowerCase()] = 1; });
    const scored = ALL_STORIES.map(function (s) {
      const target = storyTargetSet(s.level);
      let hits = 0;
      Object.keys(weakSet).forEach(function (w) { if (target[w]) hits++; });
      return { s: s, hits: hits };
    }).filter(function (x) { return x.hits > 0; }).sort(function (a, b) { return b.hits - a.hits; }).slice(0, 3);
    if (!scored.length) { panel.style.display = "none"; return; }
    panel.style.display = "";
    box.innerHTML = scored.map(function (x) {
      return '<button class="chip story-suggest-chip" data-story="' + x.s.id + '">' +
        esc(x.s.title) + " (" + x.s.level + ") · " + x.hits + " " + t("stories.suggestHits") + "</button>";
    }).join("");
    box.querySelectorAll(".story-suggest-chip").forEach(function (btn) {
      btn.onclick = function () {
        const s = ALL_STORIES.find(function (y) { return y.id === btn.dataset.story; });
        if (s) { showView("stories"); if (typeof openStory === "function") openStory(s); }
      };
    });
  }

  /* ============================================================
     HOME  (cached — skips rebuild if nothing changed since last visit)
     ============================================================ */
  function renderHome() {
    if (!homeDirty) return;
    homeDirty = false;
    // ---- Hero greeting + date + streak ----
    const now = new Date();
    const hr = now.getHours();
    const greet = hr < 12 ? t("hero.morning") : hr < 18 ? t("hero.afternoon") : t("hero.evening");
    const dateStr = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    if ($("heroGreeting")) $("heroGreeting").textContent = greet + "!";
    if ($("heroDate")) $("heroDate").textContent = dateStr;
    const s = load(K_STREAK, { streak: 0 });
    if ($("streakPill")) $("streakPill").textContent = s.streak || 0;
    if ($("streak")) $("streak").textContent = s.streak || 0;

    // ---- Animated stat cards ----
    const total = ITEMS.length;
    const mastered = ITEMS.filter(isMastered).length;
    const due = ITEMS.filter(isDue).length;
    const days = Object.keys(VOCAB_DAYS).length;
    animateCount($("statTotal"), total);
    animateCount($("statMastered"), mastered);
    animateCount($("statDue"), due);
    animateCount($("statDays"), days);
    animateCount($("statAcc"), accuracyLast(7));

    populateWordOfDay();
    buildChart(chartRangeDays);
    buildLearnedChart(learnedRangeDays);
    buildHeatmap();
    buildMastery();
    buildMemoryStrength();
    renderDueForecast();

    // ---- Daily progress (per-day mastery bars) ----
    const dp = $("dayProgress");
    dp.innerHTML = "";
    Object.keys(VOCAB_DAYS).sort((a, b) => a - b).forEach(function (d, idx) {
      const dayItems = ITEMS.filter(function (it) { return String(it.day) === String(d); });
      const m = dayItems.filter(isMastered).length;
      const pct = dayItems.length ? Math.round((m / dayItems.length) * 100) : 0;
      const row = el("div", "day-row");
      row.style.animationDelay = (idx * 60) + "ms";
      row.appendChild(el("span", "day-name", "Day " + d));
      const bar = el("div", "day-mini-bar");
      const fill = el("div", "day-mini-fill");
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("span", "day-pct", pct + "%"));
      dp.appendChild(row);
    });
    renderDailyQuests(); // โชว์เป้าหมายรายวันทุกครั้งที่เปิด Home (แก้ panel ว่างเปล่าตอนโหลด)
  }

  /* ---------- Memory Strength gauge + retention distribution ---------- */
  function buildMemoryStrength() {
    const learned = ITEMS.filter(function (i) { return (getP(i.id).reps || 0) > 0; });
    const avg = learned.length
      ? Math.round(learned.reduce(function (s, i) { return s + predictRetention(i); }, 0) / learned.length)
      : 0;
    const g = $("msPct"); if (g) g.textContent = avg + "%";
    const gauge = $("msGauge"); if (gauge) gauge.style.setProperty("--val", avg + "%");

    // Retention distribution (replaces the old forgetting-curve line graph):
    // bucket every learned word by current predicted retention and show the
    // Strong / Medium / Weak mix as a single stacked bar + a count legend.
    const dist = $("msDist");
    if (dist) {
      const buckets = { strong: 0, medium: 0, weak: 0 };
      learned.forEach(function (i) {
        const r = predictRetention(i);
        if (r >= 75) buckets.strong++;
        else if (r >= 40) buckets.medium++;
        else buckets.weak++;
      });
      const total = learned.length;
      const pct = function (n) { return total ? (n / total) * 100 : 0; };
      const bar = $("msBar"), legend = $("msLegend");
      if (bar) {
        bar.innerHTML = total
          ? '<i class="seg s-strong" data-w="' + pct(buckets.strong) + '%"></i>' +
            '<i class="seg s-medium" data-w="' + pct(buckets.medium) + '%"></i>' +
            '<i class="seg s-weak" data-w="' + pct(buckets.weak) + '%"></i>'
          : "";
        applyInlineStyles(bar);
      }
      if (legend) {
        legend.innerHTML = total
          ? '<span><i class="dot s-strong"></i><b>' + buckets.strong + '</b> Strong</span>' +
            '<span><i class="dot s-medium"></i><b>' + buckets.medium + '</b> Medium</span>' +
            '<span><i class="dot s-weak"></i><b>' + buckets.weak + '</b> Weak</span>'
          : "";
      }
      dist.classList.toggle("is-empty", total === 0);
    }
    const sc = $("smartCount"); if (sc) sc.textContent = dueQueue().length + " due";
  }

  /* ---------- Smart Review (weakest due words first) ---------- */
  function startSmartReview() {
    const q = dueQueue();
    if (!q.length) { toast("Nothing due right now — nice work! Try a random review instead", "ok"); return; }
    showView("cards");
    cardQueue = q.slice(0, 30);
    cardIdx = 0;
    $("cardControls").classList.add("hidden");
    $("cardResult").classList.add("hidden");
    $("cardSession").classList.remove("hidden");
    showCard();
  }

  /* ---------- Word of the Day ---------- */
  function populateWordOfDay() {
    const box = $("wotd");
    if (!box) return;
    const dueItems = ITEMS.filter(isDue);
    const pool = dueItems.length ? dueItems : ITEMS;
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    if (!pick) { box.style.display = "none"; return; }
    const tlabel = pick.type === "vocab" ? "VOCAB" : pick.type === "collocation" ? "COLLOCATION" : "IDIOM";
    const th = pick.th || (pick.type === "collocation" ? "See example below" : "");
    box.innerHTML =
      '<div class="wotd-label"><span class="ico ico-tile sm" data-icon="sparkle"></span>Word of the Day</div>' +
      '<div class="wotd-badge">' + tlabel + '</div>' +
      '<div class="wotd-word">' + esc(pick.word) + '</div>' +
      '<div class="wotd-th" lang="th">' + esc(th) + '</div>' +
      '<button class="btn btn-sm wotd-btn">View details <span class="ico" data-icon="info"></span></button>';
    // re-inject icon
    box.querySelectorAll("[data-icon]").forEach(function (n) {
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });
    box.onclick = function () { openDetail(pick); };
  }

  /* ---------- Study activity chart (pure SVG area + line) ---------- */
  function buildChart(days) {
    const wrap = $("chartWrap");
    if (!wrap) return;
    const data = getHistorySeries(days);
    const W = 560, H = 200, padL = 10, padR = 10, padT = 18, padB = 24;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const maxAns = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.answered; })));
    const xAt = function (i) { return padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW); };
    const yAt = function (v) { return padT + innerH - (v / maxAns) * innerH; };
    const fmt = function (d) { const p = d.split("-"); return p[2] + "/" + p[1]; };

    let grid = "";
    [0.25, 0.5, 0.75].forEach(function (g) {
      const gy = (padT + innerH * g).toFixed(1);
      grid += '<line class="chart-grid" x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '"/>';
    });

    let line = "", area = "M " + xAt(0).toFixed(1) + " " + (padT + innerH).toFixed(1);
    data.forEach(function (d, i) {
      const px = xAt(i).toFixed(1), py = yAt(d.answered).toFixed(1);
      line += (i === 0 ? "M " : " L ") + px + " " + py;
      area += " L " + px + " " + py;
    });
    area += " L " + xAt(data.length - 1).toFixed(1) + " " + (padT + innerH).toFixed(1) + " Z";

    // Accuracy line: skip no-study days so the dashed line doesn't plunge to
    // 0% (accuracy is undefined, not 0%, on rest days). Break the path instead.
    let accLine = "", accOpen = false;
    data.forEach(function (d, i) {
      const px = xAt(i).toFixed(1), py = (padT + innerH - (d.accuracy / 100) * innerH).toFixed(1);
      if (d.answered > 0) {
        accLine += (accOpen ? " L " : "M ") + px + " " + py;
        accOpen = true;
      } else {
        accOpen = false; // gap on rest days
      }
    });

    let dots = "";
    data.forEach(function (d, i) {
      dots += '<circle class="chart-dot" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(d.answered).toFixed(1) + '" r="3.4" data-i="' + i + '"></circle>';
    });

    const lab = function (i) { return '<text class="chart-x" x="' + xAt(i).toFixed(1) + '" y="' + (H - 6) + '">' + fmt(data[i].date) + '</text>'; };
    const xlabels = lab(0) + lab(Math.floor((data.length - 1) / 2)) + lab(data.length - 1);

    wrap.innerHTML =
      '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Study activity over ' + days + ' days">' +
        '<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="var(--primary)" stop-opacity="0.38"/>' +
          '<stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        grid +
        '<path class="chart-area" d="' + area + '" fill="url(#chartGrad)"/>' +
        '<path class="chart-acc" d="' + accLine + '" fill="none"/>' +
        '<path class="chart-line" d="' + line + '" fill="none"/>' +
        dots + xlabels +
      '</svg>' +
      '<div class="chart-tip" id="chartTip"></div>';

    // animate the volume line drawing itself in
    const lineEl = wrap.querySelector(".chart-line");
    if (lineEl && fxSubtle() && lineEl.getTotalLength) {
      const len = lineEl.getTotalLength();
      lineEl.style.strokeDasharray = len;
      lineEl.style.strokeDashoffset = len;
      requestAnimationFrame(function () {
        lineEl.style.transition = "stroke-dashoffset 0.95s cubic-bezier(.2,.8,.2,1)";
        lineEl.style.strokeDashoffset = "0";
      });
    }

    const tip = wrap.querySelector("#chartTip");
    wrap.querySelectorAll(".chart-dot").forEach(function (dot) {
      dot.addEventListener("mouseenter", function () {
        const d = data[+dot.dataset.i];
        tip.innerHTML = "<b>" + fmt(d.date) + "</b><br>" + (d.answered ? d.answered + " studied · " + d.accuracy + "%" : "No study");
        const r = dot.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
        tip.style.left = (r.left - wr.left + r.width / 2) + "px";
        tip.style.top = (r.top - wr.top) + "px";
        tip.style.opacity = "1";
      });
      dot.addEventListener("mouseleave", function () { tip.style.opacity = "0"; });
    });

    // range chips
    const cr = $("chartRange");
    if (cr) {
      buildChips(cr, [{ value: "7", label: "7d" }, { value: "14", label: "14d" }, { value: "30", label: "30d" }],
        String(chartRangeDays), function () {
          chartRangeDays = parseInt(chipValue(cr), 10) || 14;
          buildChart(chartRangeDays);
        });
    }
  }

  /* ---------- Words-learned (cumulative) chart ---------- */
  let learnedRangeDays = 30;
  function buildLearnedChart(days) {
    const wrap = $("learnedWrap");
    if (!wrap) return;
    const data = getLearnedSeries(days);
    const W = 560, H = 200, padL = 10, padR = 10, padT = 18, padB = 24;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const maxC = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.cumulative; })));
    const xAt = function (i) { return padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW); };
    const yAt = function (v) { return padT + innerH - (v / maxC) * innerH; };
    const fmt = function (d) { const p = d.split("-"); return p[2] + "/" + p[1]; };

    let grid = "";
    [0.25, 0.5, 0.75].forEach(function (g) {
      const gy = (padT + innerH * g).toFixed(1);
      grid += '<line class="chart-grid" x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '"/>';
    });

    let line = "", area = "M " + xAt(0).toFixed(1) + " " + (padT + innerH).toFixed(1);
    data.forEach(function (d, i) {
      const px = xAt(i).toFixed(1), py = yAt(d.cumulative).toFixed(1);
      line += (i === 0 ? "M " : " L ") + px + " " + py;
      area += " L " + px + " " + py;
    });
    area += " L " + xAt(data.length - 1).toFixed(1) + " " + (padT + innerH).toFixed(1) + " Z";

    let dots = "";
    data.forEach(function (d, i) {
      dots += '<circle class="chart-dot" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(d.cumulative).toFixed(1) + '" r="3.4" data-i="' + i + '"></circle>';
    });

    const lab = function (i) { return '<text class="chart-x" x="' + xAt(i).toFixed(1) + '" y="' + (H - 6) + '">' + fmt(data[i].date) + '</text>'; };
    const xlabels = lab(0) + lab(Math.floor((data.length - 1) / 2)) + lab(data.length - 1);

    wrap.innerHTML =
      '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Words learned over ' + days + ' days">' +
        '<defs><linearGradient id="learnedGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="var(--accent2)" stop-opacity="0.38"/>' +
          '<stop offset="100%" stop-color="var(--accent2)" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        grid +
        '<path class="chart-area" d="' + area + '" fill="url(#learnedGrad)"/>' +
        '<path class="chart-line" d="' + line + '" fill="none"/>' +
        dots + xlabels +
      '</svg>' +
      '<div class="chart-tip" id="learnedTip"></div>';

    const lineEl = wrap.querySelector(".chart-line");
    if (lineEl && fxSubtle() && lineEl.getTotalLength) {
      const len = lineEl.getTotalLength();
      lineEl.style.strokeDasharray = len;
      lineEl.style.strokeDashoffset = len;
      requestAnimationFrame(function () {
        lineEl.style.transition = "stroke-dashoffset 0.95s cubic-bezier(.2,.8,.2,1)";
        lineEl.style.strokeDashoffset = "0";
      });
    }

    const tip = wrap.querySelector("#learnedTip");
    wrap.querySelectorAll(".chart-dot").forEach(function (dot) {
      dot.addEventListener("mouseenter", function () {
        const d = data[+dot.dataset.i];
        tip.innerHTML = "<b>" + fmt(d.date) + "</b><br>" + d.learned + " new · " + d.cumulative + " total learned";
        const r = dot.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
        tip.style.left = (r.left - wr.left + r.width / 2) + "px";
        tip.style.top = (r.top - wr.top) + "px";
        tip.style.opacity = "1";
      });
      dot.addEventListener("mouseleave", function () { tip.style.opacity = "0"; });
    });

    const lr = $("learnedRange");
    if (lr) {
      buildChips(lr, [{ value: "7", label: "7d" }, { value: "14", label: "14d" }, { value: "30", label: "30d" }, { value: "90", label: "90d" }],
        String(learnedRangeDays), function () {
          learnedRangeDays = parseInt(chipValue(lr), 10) || 30;
          buildLearnedChart(learnedRangeDays);
        });
    }
  }

  /* ---------- Activity heatmap (GitHub-style) ---------- */
  let heatmapRangeDays = 84;
  function buildHeatmap() {
    const box = $("heatmap");
    if (!box) return;
    const series = getHistorySeries(heatmapRangeDays);
    const maxAns = Math.max(1, Math.max.apply(null, series.map(function (d) { return d.answered; })));
    let cells = "";
    series.forEach(function (d) {
      let lvl = 0;
      if (d.answered > 0) {
        const r = d.answered / maxAns;
        lvl = r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
      }
      cells += '<span class="hm-cell lvl-' + lvl + '" data-date="' + d.date + '" data-count="' + d.answered + '"></span>';
    });
    box.innerHTML =
      '<div class="hm-grid">' + cells + '</div>' +
      '<div class="hm-legend">Less' +
        '<span class="hm-cell lvl-0"></span><span class="hm-cell lvl-1"></span>' +
        '<span class="hm-cell lvl-2"></span><span class="hm-cell lvl-3"></span>' +
        '<span class="hm-cell lvl-4"></span>More' +
      '</div>' +
      '<div class="chart-tip" id="heatmapTip"></div>';

    const tip = box.querySelector("#heatmapTip");
    box.querySelectorAll(".hm-cell").forEach(function (c) {
      c.addEventListener("mouseenter", function () {
        tip.innerHTML = "<b>" + c.dataset.date + "</b><br>" + c.dataset.count + " studied";
        const r = c.getBoundingClientRect(), wr = box.getBoundingClientRect();
        tip.style.left = (r.left - wr.left + r.width / 2) + "px";
        tip.style.top = (r.top - wr.top) + "px";
        tip.style.opacity = "1";
      });
      c.addEventListener("mouseleave", function () { tip.style.opacity = "0"; });
    });

    // Range switcher (12W / 6M / 1Y)
    const rangeBox = $("heatmapRange");
    if (rangeBox) {
      rangeBox.querySelectorAll(".chip").forEach(function (b) {
        b.classList.toggle("active", String(b.dataset.range) === String(heatmapRangeDays));
        b.onclick = function () {
          heatmapRangeDays = parseInt(b.dataset.range, 10) || 84;
          buildHeatmap();
        };
      });
    }
  }

  /* ---------- Mastery by type (SVG donut) ---------- */
  function buildMastery() {
    const box = $("mastery");
    if (!box) return;
    const m = masteryByType();
    const total = m.vocab.total + m.collocation.total + m.idiom.total;
    const segs = [
      { label: "Vocab", val: m.vocab.total, cls: "seg-vocab" },
      { label: "Collocations", val: m.collocation.total, cls: "seg-colloc" },
      { label: "Idioms", val: m.idiom.total, cls: "seg-idiom" }
    ];
    const R = 54, cx = 70, cy = 70, C = 2 * Math.PI * R;
    let offset = 0, arcs = "";
    segs.forEach(function (sg) {
      const frac = total ? sg.val / total : 0;
      const len = frac * C;
      arcs += '<circle class="donut-seg ' + sg.cls + '" cx="' + cx + '" cy="' + cy + '" r="' + R +
        '" fill="none" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) +
        '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 ' + cx + " " + cy + ')"/>';
      offset += len;
    });
    const masteredTotal = m.vocab.mastered + m.collocation.mastered + m.idiom.mastered;
    let legend = "";
    segs.forEach(function (sg) {
      legend += '<div class="leg-row"><span class="leg-dot ' + sg.cls + '"></span>' +
        '<span class="leg-label">' + sg.label + '</span><span class="leg-val">' + sg.val + '</span></div>';
    });
    box.innerHTML =
      '<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140">' +
        '<circle class="donut-bg" cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke-width="16"/>' +
        arcs +
        '<text class="donut-center" x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" dominant-baseline="central">' + masteredTotal + '</text>' +
        '<text class="donut-sub" x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" dominant-baseline="central">mastered</text>' +
      '</svg></div>' +
      '<div class="legend">' + legend + '</div>';
  }

  /* ============================================================
     FLASHCARDS
     ============================================================ */
  let cardQueue = [], cardIdx = 0;
  function startCards() {
    currentMode = "cards";
    const type = chipValue($("cardFilterType"));
    const mode = chipValue($("cardMode"));
    let list = getGameSourceItems("cards");
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (mode === "due") list = list.filter(isDue);
    if (mode === "random") list = shuffle(list);
    if (!list.length) { toast("No words match these filters — try loosening them", "err"); return; }

    cardQueue = list; cardIdx = 0;
    $("cardControls").classList.add("hidden");
    $("cardResult").classList.add("hidden");
    $("cardSession").classList.remove("hidden");
    showCard();
  }

  function showCard() {
    const item = cardQueue[cardIdx];
    const total = cardQueue.length;
    $("cardCounter").textContent = (cardIdx + 1) + " / " + total;
    $("cardProgress").style.width = (cardIdx / total) * 100 + "%";

    const flip = $("flipCard");
    flip.classList.remove("flipped");
    const badge = item.type === "vocab" ? "VOCAB" : item.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("cardBadge").textContent = badge;
    $("cardWord").textContent = item.word;
    $("cardPos").textContent = item.pos || "";
    $("cardTh").textContent = item.th || (item.type === "collocation" ? "See example sentence below" : "");
    $("cardExEn").textContent = item.exEn;
    $("cardExTh").textContent = item.exTh;
    $("cardTh").setAttribute("lang", "th");
    $("cardExTh").setAttribute("lang", "th");
    const note = $("cardNote");
    if (item.note) { note.innerHTML = svgIcon("alert", "ico sm") + " " + esc(item.note); note.classList.remove("hidden"); }
    else note.classList.add("hidden");

    document.querySelectorAll("#cardGradeRow .g-hint").forEach(function (s) {
      const q = parseInt(s.dataset.qhint, 10);
      const iv = previewInterval(item, q);
      s.textContent = iv <= 0 ? "now" : iv + "d";
    });

    flip.onclick = function () { flip.classList.toggle("flipped"); };
    $("cardSpeak").onclick = function (e) { e.stopPropagation(); speak(item.word); };
    $("cardInfo").onclick = function (e) { e.stopPropagation(); openDetail(item); };
  }

  function cardGrade(q) {
    gradeAnswer(cardQueue[cardIdx], q);
    cardIdx++;
    if (cardIdx >= cardQueue.length) {
      $("cardProgress").style.width = "100%";
      endCards();
    } else {
      showCard();
    }
  }

  function endCards() {
    $("cardSession").classList.add("hidden");
    renderResult({
      id: "cardResult",
      title: "Review complete!",
      icon: cardQueue.length ? "party" : "book",
      big: cardQueue.length + " words",
      sub: "Rate each word Again · Hard · Good · Easy — easier ratings return less often, Again brings it back soon.",
      mode: "cards",
      backView: "home",
      celebrate: cardQueue.length > 0
    });
  }

  /* ============================================================
     QUIZ  (รองรับทั้งแบบทดสอบทั่วไป และแบบทบทวนรายวัน)
     ============================================================ */
  let quizQueue = [], quizIdx = 0, quizScore = 0, quizMode = "meaning";
  let quizOnEnd = null, quizReturnView = "home";

  function startQuiz() {
    currentMode = "quiz";
    const type = chipValue($("quizType"));
    const mode = chipValue($("quizMode"));
    let count = chipValue($("quizCount"));
    let list = getGameSourceItems("quiz");
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (mode === "meaning") list = list.filter(function (i) { return i.th && i.th.trim(); });
    if (!list.length) { toast("No words for this format — try a different format or type", "err"); return; }
    list = shuffle(list);
    if (count !== "all") { count = parseInt(count, 10); if (list.length > count) list = list.slice(0, count); }
    launchQuiz(list, mode, null, "home", false);
  }

  /* เริ่มข้อสอบจากรายการคำที่กำหนด (ใช้กับ Daily Tasks) */
  function launchQuizForDay(dayNum, retView) {
    const items = itemsForDay(dayNum);
    if (!items.length) { toast("No words for this Day", "err"); return; }
    showView("quiz"); // UI ข้อสอบอยู่ในหน้า quiz
    launchQuiz(items, "sentence", function () {
      recordReview(dayNum);
      // ถ้าทำ quiz ของวันนี้เสร็จ → ถือว่าเรียนวันนี้เสร็จแล้วโดยอัตโนมัติ
      if (dayNum === currentPlanDay() && !isDayDone()) {
        settings.dayDone[dayNum] = todayStr();
        save(K_SETTINGS, settings);
        if (tasksViewActive()) renderTasks();
      }
    }, retView || "tasks", true);
  }

  function launchQuiz(items, mode, onEnd, retView, useCount) {
    let list = shuffle(items);
    if (useCount) {
      let c = chipValue($("quizCount"));
      if (c && c !== "all") { c = parseInt(c, 10); if (list.length > c) list = list.slice(0, c); }
    }
    if (!list.length) { toast("No words available for a quiz", "err"); return; }
    quizQueue = list; quizIdx = 0; quizScore = 0; quizMode = mode;
    quizOnEnd = onEnd || null; quizReturnView = retView || "home";
    $("quizControls").classList.add("hidden");
    $("cardControls").classList.add("hidden");
    $("quizResult").classList.add("hidden");
    $("quizSession").classList.remove("hidden");
    showQuiz();
  }

  function showQuiz() {
    const item = quizQueue[quizIdx];
    const total = quizQueue.length;
    $("quizCounter").textContent = "Question " + (quizIdx + 1) + " / " + total;
    $("quizProgress").style.width = (quizIdx / total) * 100 + "%";
    const fb = $("quizFeedback"); fb.className = "quiz-feedback hidden"; fb.textContent = "";
    $("quizNext").classList.add("hidden");

    let promptText, answerOpt, distractItems;
    if (quizMode === "meaning") {
      promptText = item.word + (item.pos ? " (" + item.pos + ")" : "");
      answerOpt = { text: item.th, item: item };
      // Harder, more meaningful distractors: same part-of-speech + similar spelling.
      distractItems = pickDistractors(item, getGameSourceItems("quiz"), 14).filter(function (i) { return i.th && i.th.trim() && i.th !== item.th; });
      if (distractItems.length < 3) distractItems = getGameSourceItems("quiz").filter(function (i) { return i.th && i.th.trim() && i.th !== item.th; });
    } else {
      promptText = item.exEn;
      answerOpt = { text: item.exTh, item: item };
      distractItems = getGameSourceItems("quiz").filter(function (i) { return i.exTh && i.exTh.trim() && i.exTh !== item.exTh; });
    }

    $("quizPrompt").textContent = promptText;
    $("quizSpeak").onclick = function () { speak(quizMode === "meaning" ? item.word : item.exEn); };

    const distractOpts = shuffle(distractItems).slice(0, 3).map(function (d) {
      return { text: quizMode === "meaning" ? d.th : d.exTh, item: d };
    });
    const opts = shuffle([answerOpt].concat(distractOpts));
    const box = $("quizOptions");
    box.innerHTML = "";
    opts.forEach(function (o) {
      const b = el("button", "quiz-opt", o.text);
      b._opt = o;
      b.setAttribute("lang", "th");
      b.onclick = function () { chooseQuiz(o, answerOpt, b); };
      box.appendChild(b);
    });
  }

  function chooseQuiz(chosen, answer, btn) {
    const opts = $("quizOptions").querySelectorAll(".quiz-opt");
    opts.forEach(function (o) { o.disabled = true; });
    const fb = $("quizFeedback");
    const correct = chosen.text === answer.text;
    if (correct) {
      btn.classList.add("correct");
      quizScore++;
      setFeedback(fb, "correct", "Correct!");
    } else {
      btn.classList.add("wrong");
      opts.forEach(function (o) { if (o._opt.text === answer.text) o.classList.add("correct"); });
      setFeedback(fb, "wrong", "Correct answer: " + answer.text);
    }
    fb.className = "quiz-feedback";
    // เปิดเผยความหมายของแต่ละตัวเลือก (คำอังกฤษที่ตัวเลือกนั้นแปลมา)
    opts.forEach(function (o) {
      const it = o._opt.item;
      const d = el("span", "quiz-opt-detail");
      d.textContent = (quizMode === "meaning")
        ? "→ " + it.word + (it.pos ? " (" + it.pos + ")" : "")
        : "→ " + it.exEn;
      o.appendChild(d);
      o.classList.add("revealed");
    });
    const item = quizQueue[quizIdx];
    recordAnswer(item, correct);
    $("quizProgress").style.width = ((quizIdx + 1) / quizQueue.length) * 100 + "%";
    $("quizNext").classList.remove("hidden");
  }

  function nextQuiz() {
    quizIdx++;
    if (quizIdx >= quizQueue.length) endQuiz();
    else showQuiz();
  }

  function endQuiz() {
    $("quizSession").classList.add("hidden");
    const pct = Math.round((quizScore / quizQueue.length) * 100);
    if (quizOnEnd) { try { quizOnEnd(); } catch (e) {} }
    const isTasks = quizReturnView === "tasks";
    renderResult({
      id: "quizResult",
      title: "Score",
      icon: quizScore === quizQueue.length ? "trophy" : "chart",
      big: quizScore + " / " + quizQueue.length,
      sub: "Accuracy " + pct + "%",
      note: isTasks ? "Review saved — next round will be spaced further apart" : "Wrong answers return for review sooner, automatically",
      backLabel: isTasks ? "Back to Daily Tasks" : "Back to Home",
      backView: isTasks ? "tasks" : "home",
      mode: "quiz", score: quizScore, total: quizQueue.length,
      celebrate: quizQueue.length > 0 && quizScore === quizQueue.length
    });
  }

  /* ============================================================
     DAILY TASKS
     ============================================================ */
  function taskCard(badge, title, btnLabel, onClick, meta) {
    const card = el("div", "task-card");
    const left = el("div");
    left.appendChild(el("div", "task-badge", badge));
    left.appendChild(el("div", "task-title", title));
    if (meta) left.appendChild(el("div", "task-meta", meta));
    card.appendChild(left);
    const btn = el("button", "btn btn-primary", btnLabel);
    btn.onclick = onClick;
    card.appendChild(btn);
    return card;
  }

  function renderTasks() {
    const cp = currentPlanDay();
    const lv = currentCefrLevel();
    const lvName = (window.CEFR_LEVELS && window.CEFR_LEVELS[lv])
      ? (settings.lang === "th" ? window.CEFR_LEVELS[lv].th : window.CEFR_LEVELS[lv].name)
      : lv;
    $("tasksToday").textContent = settings.lang === "th"
      ? "วันนี้คือ Day " + cp + " ของแผนระดับ " + lvName + " (" + planMaxDays() + " วัน)"
      : "Today is Day " + cp + " of your " + lvName + " plan (" + planMaxDays() + " days)";
    const list = $("tasksList");
    list.innerHTML = "";

    // การ์ด "เรียนเสร็จแล้ววันนี้" — กดบอกว่าระบบได้เรียนวันนี้ครบแล้ว
    const todayDone = isDayDone();
    const todayItems = itemsForDay(cp);
    const doneCard = el("div", "task-card task-done-card" + (todayDone ? " done" : ""));
    if (todayDone) {
      doneCard.appendChild(el("div", "task-badge", svgIcon("check") + " " + t("tasks.doneBadge")));
      doneCard.appendChild(el("div", "task-title", t("tasks.doneTitle")));
      doneCard.appendChild(el("div", "task-meta", t("tasks.doneMeta")));
      const undoBtn = el("button", "btn", svgIcon("refresh", "ico sm") + " " + t("tasks.undoDone"));
      undoBtn.onclick = function () { unmarkDayDone(); };
      doneCard.appendChild(undoBtn);
    } else {
      doneCard.appendChild(el("div", "task-badge", svgIcon("sparkle") + " " + t("tasks.markDone")));
      doneCard.appendChild(el("div", "task-title", t("tasks.markDoneHint")));
      doneCard.appendChild(el("div", "task-meta", t("tasks.markDoneMeta")));
      const btn = el("button", "btn btn-primary", svgIcon("check", "ico sm") + " " + t("tasks.markDoneBtn"));
      btn.onclick = function () { markDayDone(); };
      doneCard.appendChild(btn);
    }
    doneCard.style.animationDelay = "0ms";
    list.appendChild(doneCard);

    // งานใหม่: ถ้ามีคำสำหรับวันนี้ (ในระดับปัจจุบัน — ใช้ ITEMS ที่กรอง+remap แล้ว)
    if (todayItems.length) {
      const topic = (todayItems[0] && todayItems[0].topic) || "";
      const nc = taskCard(
        svgIcon("sparkle") + "Learn new words",
        "Day " + cp + " · " + topic,
        "New-word quiz",
        function () { launchQuizForDay(cp, "tasks"); },
        "Word count: " + todayItems.length + " items"
      );
      nc.style.animationDelay = "0ms";
      list.appendChild(nc);
    }

    // งานทบทวน: วันก่อนหน้าในระดับเดียวกันที่ถึงกำหนด
    const daySet = {};
    ITEMS.forEach(function (i) { daySet[Number(i.day)] = true; });
    let dueCount = 0, k = 0;
    Object.keys(daySet).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
      if (d >= cp) return; // เฉพาะวันที่ผ่านมา
      const r = getReview(d);
      if (r.nextDue <= cp) {
        dueCount++;
        const dayItems = itemsForDay(d);
        const topic = (dayItems[0] && dayItems[0].topic) || "";
        const meta = "Reviewed " + (r.done || 0) + " times · Next: Day " + r.nextDue;
        const rc = taskCard(
          svgIcon("refresh") + "Review",
          "Day " + d + " · " + topic,
          "Take a quiz",
          function () { launchQuizForDay(d, "tasks"); },
          meta
        );
        rc.style.animationDelay = (k * 60) + "ms"; k++;
        list.appendChild(rc);
      }
    });

    if (dueCount === 0 && !todayItems.length) {
      list.appendChild(el("p", "hint", svgIcon("check", "ico sm") + " Nothing to do today If you haven't added words for Day " + cp + " yet, tell Claude: \"Day " + cp + ", [topic or random]\" to add new words"));
    } else if (dueCount === 0) {
      list.appendChild(el("p", "hint", svgIcon("party", "ico sm") + " Nothing to review today — you've finished the new words. Take a break!"));
    }
  }

  /* ============================================================
     BROWSE
     ============================================================ */
  let browsePage = 1;
  const BROWSE_PAGE_SIZE = 30;
  let cachedBrowseKey = "";
  let cachedBaseList = [];
  let browseSearchTimer = null;

  function renderBrowse(resetPage) {
    const q = $("browseSearch").value.trim().toLowerCase();
    const type = chipValue($("browseType"));
    const day = chipValue($("browseDay"));
    const cefrFilter = chipValue($("browseCefrLevel")) || "all";

    const filterKey = cefrFilter + "|" + type + "|" + day;
    if (filterKey !== cachedBrowseKey || !cachedBaseList.length) {
      cachedBrowseKey = filterKey;
      let list = ALL_ITEMS.slice();
      if (cefrFilter !== "all" && window.cefrDaysForLevel) {
        const days = window.cefrDaysForLevel(cefrFilter);
        const dayList = days.map(Number).sort((a, b) => a - b);
        const dayMap = {};
        dayList.forEach((origDay, index) => { dayMap[origDay] = index + 1; });
        const daySet = new Set(dayList.map(String));
        list = list.filter(item => daySet.has(String(item.day))).map(item => {
          const origDay = Number(item.day);
          return { ...item, day: dayMap[origDay] || origDay };
        });
      }

      if (type !== "all") list = list.filter(function (i) { return i.type === type; });
      if (day !== "all") list = list.filter(function (i) { return String(i.day) === day; });
      cachedBaseList = list;
      if (resetPage !== false) browsePage = 1;
    }

    let list = cachedBaseList;
    if (q) {
      list = list.filter(function (i) {
        return (i.word + " " + i.th + " " + i.exEn + " " + i.exTh).toLowerCase().indexOf(q) !== -1;
      });
    }

    const tb = $("browseToggleMeanings");
    if (tb) tb.innerHTML = svgIcon(settings.hideAllMeanings ? "eyeOff" : "eye") + " <span>" + t(settings.hideAllMeanings ? "browse.showAll" : "browse.hideAll") + "</span>";

    const box = $("browseList");
    if (!list.length) {
      box.innerHTML = '<p class="hint">' + svgIcon("info", "ico sm") + " No words match your search</p>";
      return;
    }

    const paginatedList = list.slice(0, browsePage * BROWSE_PAGE_SIZE);
    const parts = [];
    paginatedList.forEach(function (i) {
      const tlabel = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOC" : "IDIOM";
      const tcls = i.type === "vocab" ? "t-vocab" : i.type === "collocation" ? "t-collocation" : "t-idiom";
      const ticon = i.type === "vocab" ? "book" : i.type === "collocation" ? "link" : "bulb";
      const hidden = settings.hideAllMeanings || !!settings.hiddenMeanings[i.id];
      parts.push(
        '<div class="browse-card" data-browse-id="' + i.id + '">' +
        '<div class="bc-head"><div>' +
        '<div class="bc-word">' + esc(i.word) + '</div>' +
        (i.phonetic ? '<div class="bc-pos">/ ' + esc(i.phonetic) + ' /</div>' : '') +
        (i.pos ? '<div class="bc-pos">' + esc(i.pos) + '</div>' : '') +
        '</div><div class="bc-head-right">' +
        '<span class="bc-type ' + tcls + '">' + svgIcon(ticon, "ico") + '<span class="bc-type-text">' + tlabel + '</span></span>' +
        (!settings.hideAllMeanings ? '<button class="bc-eye" title="' + (hidden ? t("browse.showWord") : t("browse.hideWord")) + '" aria-label="' + (hidden ? t("browse.showWord") : t("browse.hideWord")) + '" data-browse-eye="' + i.id + '">' + svgIcon(hidden ? "eyeOff" : "eye") + '</button>' : '') +
        '<button class="bc-speak" title="Listen" data-browse-speak="' + i.id + '">' + svgIcon("speaker") + '</button>' +
        '</div></div>' +
        (i.th && !hidden ? '<div class="bc-th">' + esc(i.th) + '</div>' : '') +
        '<div class="bc-ex"><div>' + esc(i.exEn) + '</div><div>' + esc(i.exTh) + '</div></div>' +
        (i.note ? '<div class="bc-note">&#9888; ' + esc(i.note) + '</div>' : '') +
        '<div class="bc-day">Day ' + i.day + ' &middot; ' + esc(i.topic || "") + '</div>' +
        '</div>'
      );
    });

    if (paginatedList.length < list.length) {
      parts.push('<div style="grid-column:1/-1;text-align:center;padding:24px;"><button class="btn btn-primary btn-lg" id="loadMoreBrowse">Load More (' + paginatedList.length + ' / ' + list.length + ') ' + svgIcon("download", "ico sm") + '</button></div>');
    }

    box.innerHTML = parts.join("");

    const loadMoreBtn = $("loadMoreBrowse");
    if (loadMoreBtn) {
      loadMoreBtn.onclick = function () {
        browsePage++;
        renderBrowse(false);
      };
    }
    // Event delegation — one listener instead of per-card closures
    box.onclick = function (e) {
      const card = e.target.closest("[data-browse-id]");
      if (!card) return;
      const item = list.find(function (it) { return it.id === card.dataset.browseId; }) || ALL_ITEMS.find(function (it) { return it.id === card.dataset.browseId; });
      if (item) openDetail(item);
    };
    box.onfocusin = function (e) {
      const eyeBtn = e.target.closest("[data-browse-eye]");
      if (eyeBtn) {
        e.stopPropagation();
        const id = eyeBtn.dataset.browseEye;
        if (settings.hideAllMeanings) return;
        if (settings.hiddenMeanings[id]) delete settings.hiddenMeanings[id];
        else settings.hiddenMeanings[id] = true;
        save(K_SETTINGS, settings);
        renderBrowse(false);
      }
      const speakBtn = e.target.closest("[data-browse-speak]");
      if (speakBtn) { e.stopPropagation(); const it = list.find(function (x) { return x.id === speakBtn.dataset.browseSpeak; }) || ALL_ITEMS.find(function (x) { return x.id === speakBtn.dataset.browseSpeak; }); if (it) speak(it.word); }
    };
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", settings.theme);
    $("themeToggle").innerHTML = settings.theme === "dark" ? svgIcon("sun") : svgIcon("moon");
  }
  function toggleTheme() {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    save(K_SETTINGS, settings); applyTheme();
  }
  /* ============================================================
     BOSS RUSH — ปลดล็อกที่ L20 (ทวนคำอ่อนที่สุด จับเวลา)
     ใช้ใหม่: หน้า #view-bossrush (โหมดเบาๆ ไม่แย่ง UI ควิซหลัก)
     ============================================================ */
  let bossActive = false, bossItems = [], bossIdx = 0, bossScore = 0, bossTimer = null, bossTimeLeft = 0;
  const BOSS_TIME = 30, BOSS_COUNT = 12;
  function updateBossRushBtn() {
    const b = $("bossRushBtn");
    if (!b) return;
    b.hidden = !isChallengeUnlocked("boss-rush");
  }
  function startBossRush() {
    if (!isChallengeUnlocked("boss-rush")) return;
    if (bossActive) return;
    bossActive = true;
    // 12 คำที่จำได้แย่ที่สุด (ถ้ายังไม่เคยทบทวนเลย ให้คำแรกๆ ไปก่อน)
    let due = ITEMS.filter(isDue);
    let list = due.length ? due : ITEMS.slice();
    list.sort(function (a, b) { return predictRetention(a) - predictRetention(b); });
    bossItems = list.slice(0, BOSS_COUNT);
    if (bossItems.length < 1) { toast("No words to challenge yet", "err"); bossActive = false; return; }
    bossIdx = 0; bossScore = 0;
    currentMode = "boss";
    showView("bossrush");
    recordSessionStart("boss");
    nextBossWord();
  }
  function nextBossWord() {
    if (bossTimer) { clearInterval(bossTimer); bossTimer = null; }
    if (bossIdx >= bossItems.length) { endBossRush(); return; }
    const item = bossItems[bossIdx];
    const w = $("bossWord"), p = $("bossPrompt"), cnt = $("bossCounter"), prog = $("bossProgress");
    if (w) w.textContent = item.word + (item.pos ? " (" + item.pos + ")" : "");
    if (p) p.textContent = item.exEn || "";
    if (cnt) cnt.textContent = "Boss " + (bossIdx + 1) + " / " + bossItems.length;
    if (prog) prog.style.width = (bossIdx / bossItems.length) * 100 + "%";
    bossTimeLeft = BOSS_TIME;
    updateBossTimer();
    bossTimer = setInterval(function () {
      bossTimeLeft--;
      updateBossTimer();
      if (bossTimeLeft <= 0) {
        clearInterval(bossTimer); bossTimer = null;
        gradeAnswer(item, false); // หมดเวลา = พลาด
        bossIdx++;
        nextBossWord();
      }
    }, 1000);
  }
  function updateBossTimer() {
    const f = $("bossTimeFill"), t = $("bossTimeText");
    const pct = Math.max(0, Math.round(bossTimeLeft / BOSS_TIME * 100));
    if (f) f.style.width = pct + "%";
    if (t) t.textContent = bossTimeLeft + "s";
  }
  function bossAnswer(correct) {
    if (!bossActive) return;
    const item = bossItems[bossIdx];
    if (bossTimer) { clearInterval(bossTimer); bossTimer = null; }
    if (correct) bossScore++;
    gradeAnswer(item, correct);
    bossIdx++;
    nextBossWord();
  }
  function endBossRush() {
    bossActive = false;
    if (bossTimer) { clearInterval(bossTimer); bossTimer = null; }
    const total = bossItems.length;
    const perfect = bossScore === total;
    recordSessionEnd("boss", bossScore, total);
    if (perfect) awardXp(25, "boss-perfect");
    const sc = $("bossScore"), pc = $("bossResultPanel"), br = $("bossRun");
    if (sc) sc.textContent = bossScore + " / " + total;
    if (br) br.innerHTML = perfect ? svgIcon("bolt", "ico sm") + " ชนะบอส! +25 XP โบนัส" : "บอสพ่ายแพ้ไปแล้ว — มาอีกครั้ง!";
    if (pc) {
      pc.classList.remove("hidden");
      const fb = $("bossFeedback");
      if (fb) fb.innerHTML = perfect ? svgIcon("flame", "ico sm") + " Perfect run! ทุกคำตอบถูกภายในเวลา" : "เยี่ยม! ทวนคำอ่อนที่สุดไป " + total + " คำ"; fb.className = "boss-feedback " + (perfect ? "ok" : "");
    }
  }
  function closeBossRush() {
    if (bossTimer) { clearInterval(bossTimer); bossTimer = null; }
    bossActive = false;
    showView("home");
  }

  function formatClockTime(ts) {
    try {
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return hh + ":" + mm;
    } catch (e) { return ""; }
  }

  function renderSettings() {
    $("settingsTitle").innerHTML = svgIcon("gear") + t("settings.title");
    const ids = Object.keys(progress);
    let learned = 0, mastered = 0;
    ids.forEach(function (id) { const p = progress[id]; if ((p.reps || 0) > 0) learned++; if ((p.st || 0) >= 21 || (p.reps || 0) >= 4) mastered++; });
    $("settingsInfo").textContent =
      t("info.learned") + " " + learned + " words\n" +
      t("info.mastered") + " " + mastered + " words\n" +
      t("info.days") + " " + Object.keys(VOCAB_DAYS).length + " days\n" +
      t("info.total") + " " + ITEMS.length + " entries";
    $("planDayLabel").textContent = "Day " + (settings.planDayOverride || computePlanDay()) + " / " + planMaxDays() + " · " + currentCefrLevel() + " plan";
    // Cloud sync row (only when logged in to a cloud account)
    const syncRow = $("syncRow");
    const syncBtn = $("syncNowBtn");
    const syncStatus = $("syncStatus");
    const loggedInCloud = window.VocabAuth && window.VocabAuth.isLoggedIn && window.VocabAuth.isLoggedIn();
    if (syncRow) syncRow.style.display = loggedInCloud ? "" : "none";
    if (syncStatus && syncStatus.textContent === "" && window.VocabAuth && window.VocabAuth.getLastSyncTime) {
      const ls = window.VocabAuth.getLastSyncTime();
      if (ls) syncStatus.textContent = t("settings.lastSync").replace("{t}", formatClockTime(ls));
    }
    if (syncBtn) {
      syncBtn.onclick = async function () {
        if (!syncStatus) return;
        const prev = syncStatus.innerHTML;
        syncStatus.textContent = t("settings.syncing");
        syncStatus.classList.add("syncing");
        try {
          if (window.VocabAuth && window.VocabAuth.syncNow) {
            await window.VocabAuth.syncNow();
          }
          if (window.VocabAuth && window.VocabAuth.getLastSyncTime) {
            const ls = window.VocabAuth.getLastSyncTime();
            syncStatus.innerHTML = ls ? t("settings.lastSync").replace("{t}", formatClockTime(ls)) : t("settings.syncedNone");
          }
        } catch (e) {
          syncStatus.innerHTML = t("settings.syncErr");
        } finally {
          syncStatus.classList.remove("syncing");
        }
      };
    }
    const sb = $("settingsSound");
    if (sb) sb.innerHTML = (soundOn() ? svgIcon("volume") : svgIcon("volumeX")) + " " + (soundOn() ? t("settings.on") : t("settings.off"));
    const pb = $("settingsPlayer");
    if (pb) pb.innerHTML = (settings.showMiniPlayer ? svgIcon("music") : svgIcon("musicX")) + " " + (settings.showMiniPlayer ? t("settings.on") : t("settings.off"));
    const mb = $("settingsMusic");
    if (mb) mb.innerHTML = (settings.music ? svgIcon("volume") : svgIcon("volumeX")) + " " + (settings.music ? t("settings.on") : t("settings.off"));
    const rb = $("settingsReminder");
    if (rb) rb.innerHTML = (settings.reminder.on ? svgIcon("bell") : svgIcon("bellOff")) + " " + (settings.reminder.on ? t("settings.on") : t("settings.off"));
    const sf = $("settingsStreakFreeze");
    if (sf) {
      sf.innerHTML = (settings.streakFreeze ? svgIcon("check") : "") + " " + (settings.streakFreeze ? t("settings.on") : t("settings.off"));
      sf.className = "btn btn-sm " + (settings.streakFreeze ? "btn-primary" : "");
      sf.onclick = function () {
        settings.streakFreeze = !settings.streakFreeze;
        save(K_SETTINGS, settings);
        renderSettings();
      };
    }
    const sfCount = $("sfCount");
    if (sfCount) sfCount.textContent = t("sf.owned").replace("{n}", game.streakFreezes || 0);
    const buySf = $("buyStreakFreeze");
    if (buySf) {
      buySf.disabled = (game.streakFreezes || 0) >= 5;
      buySf.onclick = function () {
        const cost = SF_COST;
        if ((game.xp || 0) < cost) { toast(t("sf.noXp"), "err"); return; }
        game.xp = (game.xp || 0) - cost;
        game.streakFreezes = (game.streakFreezes || 0) + 1;
        settings.streakFreeze = true;
        saveGame();
        save(K_SETTINGS, settings);
        toast(t("sf.bought"), "ok");
        renderSettings();
        renderProfileChip();
        renderMiniQuests();
      };
    }
    const xb = $("settingsXpBoost");
    if (xb) {
      xb.value = String(settings.xpBoost || 1);
      xb.onchange = function () {
        settings.xpBoost = parseInt(xb.value, 10) || 1;
        save(K_SETTINGS, settings);
        renderSettings();
      };
    }
    const xh = $("xpBoostHint");
    if (xh) {
      xh.textContent = isDoubleXpWeekend()
        ? t("settings.xpWeekend") + " · " + t("settings.xpTotal").replace("{x}", Math.round(currentXpBoost() * 100) / 100)
        : t("settings.xpTotal").replace("{x}", Math.round(currentXpBoost() * 100) / 100);
    }
    const rg = $("settingsReviewGoal");
    if (rg) {
      rg.value = settings.reviewGoal || 20;
      rg.onchange = function () {
        let v = parseInt(rg.value, 10);
        if (isNaN(v)) v = 20;
        v = Math.max(5, Math.min(200, v));
        settings.reviewGoal = v;
        rg.value = v;
        save(K_SETTINGS, settings);
      };
    }
    const ps = $("settingsPageSong");
    if (ps) ps.innerHTML = PAGE_SONGS.map(function (n, i) {
      return '<option value="' + i + '"' + (i === (settings.pageSong | 0) ? " selected" : "") + ">" + songLabel(n) + "</option>";
    }).join("");
    const gs = $("settingsGameSong");
    if (gs) gs.innerHTML = GAME_SONGS.map(function (n, i) {
      return '<option value="' + i + '"' + (i === (settings.gameSong | 0) ? " selected" : "") + ">" + songLabel(n) + "</option>";
    }).join("");
    const mv = $("settingsMusicVol");
    if (mv) mv.value = Math.round((settings.musicVol != null ? settings.musicVol : 0.5) * 100);
    // Language: TH | EN segmented control.
    const lc = $("settingsLang");
    if (lc) buildChips(lc, [
      { label: t("lang.th"), value: "th" },
      { label: t("lang.en"), value: "en" }
    ], settings.lang, function () {
      settings.lang = chipValue($("settingsLang")) || "th";
      save(K_SETTINGS, settings);
      setLang(settings.lang);
    });

    const ec = $("settingsEffects");
    if (ec) buildChips(ec, [
      { label: t("settings.off"), value: "off" },
      { label: t("settings.reduced") || "Reduced", value: "reduced" },
      { label: "Full", value: "full" }
    ], settings.effects, function () {
      settings.effects = chipValue($("settingsEffects"));
      save(K_SETTINGS, settings);
      renderSettings();
    });
    renderAccentSwatches();
  }

  /* Re-render the visible view + persistent chrome after a language change. */
  function setLang(lang) {
    settings.lang = (lang === "en") ? "en" : "th";
    document.documentElement.lang = settings.lang;
    applyI18n();
    initGameSources();
    const cur = document.querySelector(".view.active");
    const name = cur ? cur.id.replace("view-", "") : "home";
    if (name === "home") renderHome();
    else if (name === "browse") renderBrowse();
    else if (name === "tasks") renderTasks();
    else if (name === "achievements") renderAchievements();
    else if (name === "stats") renderStats();
    renderCEFRBadges();
    renderProfileChip();
    renderDailyQuests();
    renderMiniQuests();
    if (name === "settings") renderSettings();
    if (window.MiniMusicPlayer && window.MiniMusicPlayer.refresh) window.MiniMusicPlayer.refresh();
    // Notify other modules (e.g. auth.js) that the language changed
    document.dispatchEvent(new CustomEvent("vocab-lang-changed"));
  }

  /* Show / hide the mini-player overlay based on settings.showMiniPlayer. */
  function applyMiniPlayerVisibility() {
    const root = document.querySelector(".mmp");
    if (settings.showMiniPlayer) {
      if (root) root.style.display = "";
      else if (window.MiniMusicPlayer) window.MiniMusicPlayer.init({ autoStart: false });
    } else if (root) {
      root.style.display = "none";
    }
  }

  let reminderInterval = null;

  /* Daily reminder: fire a notification once/day at the chosen time (app open). */
  function startReminderScheduler() {
    if (reminderInterval) return; // already running
    if (!("Notification" in window)) return;
    reminderInterval = setInterval(function () {
      const r = settings.reminder;
      if (!r || !r.on || Notification.permission !== "granted") return;
      const now = new Date();
      const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      if (hhmm < r.time) return;
      const today = todayStr();
      if (localStorage.getItem("vocab_reminder_" + today) === "1") return;
      localStorage.setItem("vocab_reminder_" + today, "1");
      const reg = navigator.serviceWorker && navigator.serviceWorker.controller;
      const body = t("mq.title") + " — " + t("quest.claim");
      const fire = function () { new Notification(t("settings.reminder"), { body: body }); };
      if (reg) { reg.showNotification(t("settings.reminder"), { body: body }).catch(fire); }
      else fire();
    }, 60000);
  }

  function stopReminderScheduler() {
    if (reminderInterval) { clearInterval(reminderInterval); reminderInterval = null; }
  }

  /* --- เลือกธีมสี (accent presets) — โชว์เฉพาะที่ปลดล็อก --- */
  function renderAccentSwatches() {
    const box = $("accentSwatches");
    if (!box) return;
    const lv = currentLevel();
    box.innerHTML = ACCENT_IDS.map(function (id) {
      const unlocked = isAccentUnlocked(id);
      const sel = settings.accent === id ? " selected" : "";
      const sw = (ACCENT_SWATCH[id] || []).map(function (c) {
        return '<i class="ac-dot" data-bg="' + c + '"></i>';
      }).join("");
      const lock = unlocked ? "" : '<span class="sw-lock">' + svgIcon("lock", "ico sm") + "</span>";
      const meta = unlocked ? ACCENT_LABELS[id] : "Lv " + (LEVEL_REWARDS.filter(function (r) {
        return r.type === "theme" && r.accent === id;
      })[0] || {}).level;
      return '<button class="accent-swatch' + sel + (unlocked ? "" : " locked") + '" data-accent="' + id + '"' +
        ' title="' + meta + '" aria-label="' + meta + '"' + (unlocked ? "" : " disabled") + ">" +
        '<span class="sw-dots">' + sw + "</span>" +
        '<span class="sw-name">' + meta + "</span>" + lock + "</button>";
    }).join("");
    applyInlineStyles(box);
    Array.prototype.forEach.call(box.querySelectorAll(".accent-swatch"), function (b) {
      b.onclick = function () {
        if (b.classList.contains("locked")) return;
        settings.accent = b.dataset.accent;
        save(K_SETTINGS, settings);
        applyAccent();
        renderAccentSwatches();
      };
    });
  }

  /* ============================================================
     BACKUP / RESTORE  (สำรอง–กู้คืน ย้ายเครื่อง)
     ============================================================ */
  function collectBackup() {
    return {
      app: "vocab-trainer",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        progress: load(K_PROGRESS, {}),
        settings: load(K_SETTINGS, {}),
        streak: load(K_STREAK, { streak: 0, last: "" }),
        reviews: load(K_REVIEWS, {}),
        storyRead: load(K_STORY_READ, {}),
        storyWords: load(K_STORY_WORDS, {})
      }
    };
  }

  function backupStatus(msg, ok) {
    const s = $("backupStatus");
    if (!s) return;
    s.innerHTML = svgIcon(ok ? "check" : "cross") + msg;
    s.className = "backup-status " + (ok ? "ok" : "err");
  }

  function exportFile() {
    const json = JSON.stringify(collectBackup(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    a.href = url;
    a.download = "vocab-backup-" + stamp + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    backupStatus("Backup file downloaded — keep it, then use 'Choose Backup File' on your new device", true);
  }

  function exportCopy() {
    const json = JSON.stringify(collectBackup());
    const ta = $("backupCode");
    if (ta) ta.value = json;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(
        function () { backupStatus("Backup code copied — paste it in the box on your new device and click 'Import'", true); },
        function () { backupStatus("Couldn't copy automatically — select the text in the box and copy it yourself", false); }
      );
    } else {
      if (ta) { ta.focus(); ta.select(); }
      backupStatus("Select the text in the box above and press Ctrl+C to copy", false);
    }
  }

  /* --- Backup schema validation (defense-in-depth) ---
     Rejects malformed/crafted backups and sanitises scalar fields so a
     hostile file can't crash rendering (e.g. settings as a number) or inject
     unexpected values. Data is never code-executed (CSP + textContent), so
     this is about integrity, not XSS. */
  function isObj(v) { return v != null && typeof v === "object" && !Array.isArray(v); }
  function isValidBackup(obj) {
    if (!obj || obj.app !== "vocab-trainer" || !isObj(obj.data)) return false;
    const d = obj.data;
    if (d.progress != null && !isObj(d.progress)) return false;
    if (d.reviews != null && !isObj(d.reviews)) return false;
    if (d.streak != null && !isObj(d.streak)) return false;
    if (d.settings != null) {
      if (!isObj(d.settings)) return false;
      const s = d.settings;
      if (s.lang != null && s.lang !== "en" && s.lang !== "th") s.lang = "en";
      if (s.theme !== "light" && s.theme !== "dark") s.theme = "light";
      if (typeof s.sound !== "boolean" && s.sound != null) s.sound = true;
      if (typeof s.music !== "boolean" && s.music != null) s.music = true;
      if (s.reminder != null && isObj(s.reminder)) {
        if (typeof s.reminder.on !== "boolean") s.reminder.on = false;
        if (typeof s.reminder.time !== "string" || !/^\d{2}:\d{2}$/.test(s.reminder.time)) s.reminder.time = "20:00";
      }
    }
    return true;
  }
  function applyBackup(obj) {
    if (!isValidBackup(obj)) {
      backupStatus("File/code is invalid — it must be a backup exported from this app", false);
      return false;
    }
    const d = obj.data;
    if (d.progress) { progress = d.progress; save(K_PROGRESS, progress); }
    if (d.reviews) { reviews = d.reviews; save(K_REVIEWS, reviews); }
    if (d.settings) { settings = d.settings; save(K_SETTINGS, settings); }
    if (d.streak) { save(K_STREAK, d.streak); }
    if (d.storyRead) { storyRead = d.storyRead; save(K_STORY_READ, storyRead); }
    if (d.storyWords) { storyWords = d.storyWords; save(K_STORY_WORDS, storyWords); }
    applyTheme();
    renderSettings();
    renderHome();
    populateDayChips();
    backupStatus("Import successful! All progress has been restored", true);
    return true;
  }

  function importFromCode() {
    const ta = $("backupCode");
    const txt = ta ? ta.value.trim() : "";
    if (!txt) { backupStatus("Please paste a backup code in the box first", false); return; }
    let obj;
    try { obj = JSON.parse(txt); }
    catch (e) { backupStatus("Couldn't read the code — it may be incomplete or malformed", false); return; }
    confirmDialog("Import this data? Your current progress on this device will be replaced", "Import backup").then(function (ok) {
      if (ok) applyBackup(obj);
    });
  }

  function importFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      let obj;
      try { obj = JSON.parse(e.target.result); }
      catch (err) { backupStatus("This file is not a valid backup", false); return; }
      confirmDialog("Import data from this file? Your current progress on this device will be replaced", "Import backup").then(function (ok) {
        if (ok) applyBackup(obj);
      });
    };
    reader.onerror = function () { backupStatus("Couldn't read the file", false); };
    reader.readAsText(file);
  }

  /* ============================================================
     WORD DETAIL MODAL
     ============================================================ */
  let detailLastFocus = null;

  /** Keep Tab focus inside the open modal. */
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const ov = $("detailModal");
    const f = ov.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openDetail(item) {
    if (!item) return;
    const tlabel = item.type === "vocab" ? "VOCAB" : item.type === "collocation" ? "COLLOCATION" : "IDIOM";
    const ticon = item.type === "vocab" ? "book" : item.type === "collocation" ? "link" : "bulb";
    $("detailType").innerHTML = svgIcon(ticon, "ico") + "<span>" + tlabel + "</span>";
    $("detailWord").textContent = item.word;

    const ph = $("detailPhonetic");
    if (item.phonetic) { ph.textContent = "/ " + item.phonetic + " /"; ph.classList.remove("hidden"); }
    else ph.classList.add("hidden");

    $("detailPos").textContent = item.pos || "";
    $("detailTh").textContent = item.th || (item.type === "collocation" ? "See example usage below" : "");

    $("detailExEn").textContent = item.exEn || "";
    $("detailExTh").textContent = item.exTh || "";
    $("detailTh").setAttribute("lang", "th");
    $("detailExTh").setAttribute("lang", "th");

    const note = $("detailNote");
    if (item.note) { note.innerHTML = svgIcon("alert", "ico sm") + " " + esc(item.note); note.classList.remove("hidden"); }
    else note.classList.add("hidden");

    // progress + memory strength
    const p = getP(item.id);
    const ret = predictRetention(item);
    const level = isMastered(item) ? "Mastered" : ((p.reps || 0) > 0 ? "Learning" : "New");
    $("detailProgress").innerHTML =
      "<div class=\"dp-label\">" + level + " · You remember <b>" + ret + "%</b></div>" +
      "<div class=\"dp-bar\"><div class=\"dp-fill\" data-w=\"" + ret + "%\"></div></div>";
    applyInlineStyles($("detailProgress"));

    // meta
    const nextDue = p.due && p.due > todayStr() ? p.due : "Ready to review";
    const pronBest = (game.pronBest || {})[String(item.id || item.word)] || 0;
    $("detailMeta").innerHTML =
      "Seen: <b>" + (p.seen || 0) + "</b> · Streak: <b>" + (p.reps || 0) + "</b> correct · Forgotten: <b>" + (p.lapses || 0) + "</b>" +
      (pronBest ? " · Pron best: <b>" + pronBest + "%</b>" : "") + "<br>" +
      "Next review: <b>" + esc(nextDue) + "</b> · Memorized: <b>" + (p.st || 0).toFixed(1) + "d</b> · From <b>Day " + item.day + "</b>" + (item.topic ? " (" + esc(item.topic) + ")" : "");

    // mnemonic / memory aid
    const mnem = $("detailMnemonic");
    const tip = syllableTip(item);
    let mhtml = "";
    if (item.note) mhtml += "<div class=\"mnem-note\">" + svgIcon("alert", "ico sm") + " " + esc(item.note) + "</div>";
    if (tip) mhtml += "<div class=\"mnem-tip\"><span class=\"mnem-label\">Break it into syllables</span><b>" + esc(tip) + "</b></div>";
    mhtml += "<div class=\"mnem-tip\"><span class=\"mnem-label\">Why it matters</span>Part of <b>Day " + item.day + "</b>" + (item.topic ? " — " + esc(item.topic) : "") + ". Review it on schedule to lock it in.</div>";
    if (mhtml) { mnem.innerHTML = mhtml; mnem.classList.remove("hidden"); }
    else mnem.classList.add("hidden");

    // Word family & root explorer
    const famSec = $("detailFamilySection");
    const famDiv = $("detailFamily");
    if (famSec && famDiv) {
      const base = item.word.replace(/(s|es|ed|ing|ly)$/, "");
      const family = [
        item.word + " (" + (item.pos || "word") + ") — Primary form",
        base + " (Root word / รากศัพท์)",
        base + "ly (Adverb form)",
        base + "tion / ment / ness (Noun form)",
        base + "ive / able / ful (Adjective form)"
      ];
      famDiv.innerHTML = family.map(function (f) { return '<div style="margin-bottom:4px;">• <b>' + esc(f) + '</b></div>'; }).join("");
      famSec.classList.remove("hidden");
    }

    // related words (same day)
    const rel = ITEMS.filter(function (i) { return i.day === item.day && i.id !== item.id; });
    const rc = $("detailRelated");
    if (rel.length) {
      let html = "<h3>" + svgIcon("link", "ico sm") + " Other words from Day " + item.day + "</h3><div class=\"rel-wrap\">";
      rel.forEach(function (r) { html += "<button class=\"rel-chip\" data-id=\"" + r.id + "\">" + esc(r.word) + "</button>"; });
      html += "</div>";
      rc.innerHTML = html;
      rc.querySelectorAll(".rel-chip").forEach(function (b) {
        b.onclick = function () {
          const target = ITEMS.filter(function (i) { return i.id === b.dataset.id; })[0];
          openDetail(target);
        };
      });
      rc.classList.remove("hidden");
    } else {
      rc.innerHTML = ""; rc.classList.add("hidden");
    }

    // user personal notes / mnemonic
    const notesMap = load("vocab_notes_v1", {});
    const userNoteInput = $("detailUserNote");
    if (userNoteInput) {
      userNoteInput.value = notesMap[item.id] || "";
      userNoteInput.oninput = function () {
        notesMap[item.id] = userNoteInput.value;
        save("vocab_notes_v1", notesMap);
      };
    }

    // actions
    $("detailSpeak").onclick = function () { speak(item.word); };
    $("detailSlow").onclick = function () { speak(item.word, 0.6); };

    // pronunciation practice inside modal
    const pbox = $("pronResult");
    pbox.className = "pron-feedback hidden"; pbox.innerHTML = "";
    $("detailPron").textContent = currentLang() === "th" ? "แตะ แล้วพูดคำนี้" : "Tap, then say this word";
    attachMic($("detailPron"), null, pbox, function () { return item.word; }, function (result) {
      recordAnswer(item, result.score >= 70);
    });

    const sbtn = $("detailSentencePron");
    if (sbtn) {
      if (item.exEn) {
        sbtn.style.display = "";
        sbtn.textContent = currentLang() === "th" ? "พูดประโยคตัวอย่าง" : "Speak Example Sentence";
        attachMic(sbtn, null, pbox, function () { return item.exEn; }, function (result) {
          recordAnswer(item, result.score >= 70);
        });
      } else {
        sbtn.style.display = "none";
      }
    }

    detailLastFocus = document.activeElement;
    const ov = $("detailModal");
    ov.classList.add("open");
    ov.setAttribute("aria-hidden", "false");
    ov.addEventListener("keydown", trapFocus);
    speak(item.word); // ออกเสียงทันทีเมื่อเปิด
    $("detailClose").focus();
  }

  function closeDetail() {
    const ov = $("detailModal");
    ov.classList.remove("open");
    ov.setAttribute("aria-hidden", "true");
    ov.removeEventListener("keydown", trapFocus);
    try { window.speechSynthesis.cancel(); } catch (e) {}
    stopRecognition();
    if (detailLastFocus && detailLastFocus.focus) detailLastFocus.focus();
  }

  /* ============================================================
     PRONUNCIATION ENGINE  (ฝึกออกเสียง + ให้คะแนน + เช็คพยางค์)
     ============================================================ */

  function speechRecSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /* --- แยกคำเป็นพยางค์โดยประมาณ (อิงกลุ่มสระ) --- */
  function syllabifyWord(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return [];
    const isV = function (c) { return "aeiouy".indexOf(c) !== -1; };
    // ชิ้นละ 1 กลุ่มสระ
    const groups = [];
    let i = 0;
    while (i < w.length) {
      let chunk = "";
      while (i < w.length && !isV(w[i])) { chunk += w[i]; i++; }      // พยัญชนะต้น
      while (i < w.length && isV(w[i])) { chunk += w[i]; i++; }        // สระ
      // พยัญชนะท้าย: เก็บไว้ถ้าไม่มีสระตามหลัง (พยางค์สุดท้าย/คลัสเตอร์)
      let cons = "";
      while (i < w.length && !isV(w[i])) { cons += w[i]; i++; }
      if (i >= w.length) { chunk += cons; }        // ท้ายคำ → รวมทั้งหมด
      else if (cons.length > 1) { chunk += cons.slice(0, cons.length - 1); i -= 1; } // แบ่งคลัสเตอร์
      // ถ้า cons=1 ปล่อยให้ไปเป็นต้นพยางค์ถัดไป
      if (chunk) groups.push(chunk);
    }
    return groups.length ? groups : [w];
  }

  /* --- แยกทั้งวลี → พยางค์ พร้อม index บนสตริงตัวอักษรล้วน --- */
  function buildSyllables(phrase) {
    const words = phrase.split(/\s+/).filter(Boolean);
    let cleaned = "";
    const sylls = [];
    words.forEach(function (word, wi) {
      const parts = syllabifyWord(word);
      parts.forEach(function (p) {
        const start = cleaned.length;
        cleaned += p;
        sylls.push({ text: p, start: start, end: cleaned.length, wordIdx: wi });
      });
    });
    return { cleaned: cleaned, sylls: sylls };
  }

  /* --- Levenshtein + หา index ที่ผิดบนคำเป้าหมาย --- */
  function alignMismatch(target, heard) {
    const a = target, b = heard, n = a.length, m = b.length;
    const dp = [];
    for (let i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); dp[i][0] = i; }
    for (let j = 0; j <= m; j++) dp[0][j] = j;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    const bad = {};
    let i = n, j = m;
    while (i > 0 && j > 0) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + cost) { if (cost) bad[i - 1] = 1; i--; j--; }
      else if (dp[i][j] === dp[i - 1][j] + 1) { bad[i - 1] = 1; i--; }
      else { j--; }
    }
    while (i > 0) { bad[i - 1] = 1; i--; }
    return { distance: dp[n][m], bad: bad };
  }

  /* --- ประเมินผลการออกเสียง: เทียบ target กับข้อความที่ได้ยิน --- */
  function scorePronunciation(target, heardCandidates) {
    const built = buildSyllables(target);
    const cleaned = built.cleaned;
    const syllCount = built.sylls.length || 1;
    // เลือก candidate ที่ใกล้เคียงที่สุด
    let best = { score: -1 };
    (heardCandidates || []).forEach(function (h) {
      const hc = String(h).toLowerCase().replace(/[^a-z]/g, "");
      if (!hc) return;
      const res = alignMismatch(cleaned, hc);
      const maxLen = Math.max(cleaned.length, hc.length) || 1;
      let score = (1 - res.distance / maxLen) * 100;
      // Exact match → perfect; otherwise curve up so small slips don't tank the score
      if (hc === cleaned) score = 100;
      else score = Math.round(Math.pow(score / 100, 0.7) * 100);
      // Penalize syllable-count mismatch (a dropped/added syllable matters more)
      const hSylls = estimateSyllables(hc);
      const syllDiff = Math.abs(hSylls - syllCount);
      if (syllDiff > 0) score -= Math.min(25, syllDiff * 8);
      score = Math.max(0, Math.round(score));
      if (score > best.score) best = { score: score, bad: res.bad, heard: String(h) };
    });
    if (best.score < 0) best = { score: 0, bad: {}, heard: "" };
    // ทำเครื่องหมายพยางค์ที่ผิด
    const sylResult = built.sylls.map(function (s) {
      let wrong = false;
      for (let k = s.start; k < s.end; k++) { if (best.bad[k]) { wrong = true; break; } }
      return { text: s.text, wrong: wrong };
    });
    return { score: Math.max(0, Math.min(100, best.score)), heard: best.heard, syllables: sylResult };
  }

  /** Rough vowel-group syllable counter for a lower-cased a-z string. */
  function estimateSyllables(str) {
    if (!str) return 0;
    const groups = (str.match(/[aeiouy]+/g) || []);
    let n = groups.length;
    // "e" silent endings often over-count in English ("make" → 1)
    if (n > 1 && /e$/.test(str)) n--;
    return Math.max(1, n);
  }

  /* --- จับเสียงจากไมค์ครั้งเดียว --- */
  let activeRec = null;
  function stopRecognition() {
    if (activeRec) { try { activeRec.abort(); } catch (e) {} activeRec = null; }
  }
  function recognizeOnce(handlers) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { handlers.onerror && handlers.onerror("unsupported"); return; }
    stopRecognition();
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.onstart = function () { handlers.onstart && handlers.onstart(); };
    rec.onresult = function (e) {
      const alts = [];
      const r = e.results[0];
      for (let i = 0; i < r.length; i++) alts.push(r[i].transcript);
      handlers.onresult && handlers.onresult(alts);
    };
    rec.onerror = function (e) { handlers.onerror && handlers.onerror(e.error || "error"); };
    rec.onend = function () { activeRec = null; handlers.onend && handlers.onend(); };
    activeRec = rec;
    try { rec.start(); } catch (e) { handlers.onerror && handlers.onerror("start-failed"); }
  }

  /* --- แสดงผลคะแนนออกเสียงลงกล่อง feedback --- */
  function renderPronFeedback(box, target, result) {
    const scoreState = result.score >= 80 ? "good" : result.score >= 55 ? "mid" : "bad";
    const scoreCls = "score-" + scoreState;
    const scoreIcon = scoreState === "good" ? "check" : scoreState === "mid" ? "alert" : "cross";
    const scoreColor = scoreState === "good" ? "var(--good)" : scoreState === "mid" ? "var(--accent)" : "var(--bad)";
    const label = result.score >= 80 ? "Excellent!" : result.score >= 55 ? "Almost!" : "Try again";
    let sylHtml = "";
    result.syllables.forEach(function (s, idx) {
      if (idx > 0) sylHtml += "<span class=\"syl-sep\">·</span>";
      sylHtml += "<span class=\"syl " + (s.wrong ? "syl-bad" : "syl-ok") + "\">" + s.text + "</span>";
    });
    const wrongCount = result.syllables.filter(function (s) { return s.wrong; }).length;
    let tip;
    if (result.score >= 80) tip = "Very clear pronunciation";
    else if (wrongCount) tip = "Focus on the red syllables (wavy underline) and listen to the slow sample again";
    else tip = "Almost perfect — try speaking a bit more clearly";

    box.innerHTML =
      "<div class=\"pron-score\"><span class=\"score-num " + scoreCls + "\">" + result.score + "%</span> " +
        "<span class=\"pron-score-ico\" data-color=\"" + scoreColor + "\">" + svgIcon(scoreIcon, "ico sm") + "</span> " +
        "<span>" + label + "</span></div>" +
      "<div class=\"pron-syllables\">" + sylHtml + "</div>" +
      "<div class=\"pron-heard\">The system heard: <b>" + (result.heard ? esc(result.heard) : "— unclear —") + "</b></div>" +
      "<div class=\"pron-tip\">" + svgIcon("bulb", "ico sm") + " " + tip + "</div>";
    applyInlineStyles(box);
    box.classList.remove("hidden");
  }

  /* --- ปุ่มไมค์ทั่วไป: ผูกกับปุ่ม + กล่อง feedback + คำเป้าหมาย --- */
  function attachMic(btn, labelEl, box, getWord, onScored) {
    if (!speechRecSupported()) {
      btn.disabled = true;
      if (labelEl) labelEl.textContent = "Browser not supported (use Chrome/Edge)";
      else btn.textContent = " Mic not supported (use Chrome/Edge)";
      return;
    }
    btn.onclick = function () {
      const word = getWord();
      if (!word) return;
      recognizeOnce({
        onstart: function () {
          btn.classList.add("recording");
          if (labelEl) labelEl.textContent = "Listening... speak now!";
          else btn.textContent = "Listening...";
        },
        onresult: function (alts) {
          const result = scorePronunciation(word, alts);
          renderPronFeedback(box, word, result);
          if (onScored) onScored(result);
        },
        onerror: function (err) {
          box.classList.remove("hidden");
          const msg = err === "not-allowed" || err === "service-not-allowed"
            ? svgIcon("alert", "ico sm") + " Microphone permission denied — allow it in your browser and try again"
            : err === "no-speech" ? svgIcon("volumeX", "ico sm") + " No sound detected — speak louder and tap again"
            : "Error (" + esc(err) + ") — please try again";
          box.innerHTML = "<div class=\"pron-tip\">" + msg + "</div>";
        },
        onend: function () {
          btn.classList.remove("recording");
          if (labelEl) labelEl.textContent = "Tap to speak again";
          else btn.textContent = "Speak again";
        }
      });
    };
  }

  /* ============================================================
     PRONUNCIATION TEST (หน้าทดสอบเสียง)
     ============================================================ */
  let pronQueue = [], pronIdx = 0, pronScores = [];

  function startPron() {
    currentMode = "pron";
    if (!speechRecSupported()) {
      toast("This browser doesn't support speech recognition. Please use Google Chrome or Microsoft Edge and stay online", "err");
      return;
    }
    const type = chipValue($("pronType"));
    let count = chipValue($("pronCount"));
    let list = getGameSourceItems("pron");
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (!list.length) { toast("No words for this type", "err"); return; }
    list = shuffle(list);
    if (count !== "all") { count = parseInt(count, 10); if (list.length > count) list = list.slice(0, count); }
    pronQueue = list; pronIdx = 0; pronScores = [];
    $("pronControls").classList.add("hidden");
    $("pronResult2").classList.add("hidden");
    $("pronSession").classList.remove("hidden");
    showPron();
  }

  function showPron() {
    const item = pronQueue[pronIdx];
    const total = pronQueue.length;
    $("pronCounter").textContent = "Question " + (pronIdx + 1) + " / " + total;
    $("pronProgress").style.width = (pronIdx / total) * 100 + "%";
    const badge = item.type === "vocab" ? "VOCAB" : item.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("pronBadge").textContent = badge;
    $("pronWord").textContent = item.word;
    $("pronPhon").textContent = item.phonetic ? "/ " + item.phonetic + " /" : "";
    const best = (game.pronBest || {})[String(item.id || item.word)] || 0;
    $("pronBestLabel").textContent = best ? "Best: " + best + "%" : "";
    $("pronBestLabel").style.display = best ? "" : "none";
    const fb = $("pronFeedback"); fb.className = "pron-feedback hidden"; fb.innerHTML = "";
    $("pronNext").classList.add("hidden");

    $("pronSpeak").onclick = function () { speak(item.word); };
    $("pronSlow").onclick = function () { speak(item.word, 0.6); };

    let recorded = false;
    $("pronRecordLabel").textContent = "Tap, then say this word";
    attachMic($("pronRecord"), $("pronRecordLabel"), fb, function () { return item.word; }, function (result) {
      if (!recorded) { pronScores.push(result.score); recorded = true; }
      else { pronScores[pronScores.length - 1] = Math.max(pronScores[pronScores.length - 1], result.score); }
      if (!game.pronBest) game.pronBest = {};
      const _k = String(item.id || item.word);
      game.pronBest[_k] = Math.max(game.pronBest[_k] || 0, Math.round(result.score));
      saveGame();
      $("pronNext").classList.remove("hidden");
      recordAnswer(item, result.score >= 70);
    });
  }

  function nextPron() {
    stopRecognition();
    pronIdx++;
    if (pronIdx >= pronQueue.length) endPron();
    else showPron();
  }

  function endPron() {
    $("pronSession").classList.add("hidden");
    const avg = pronScores.length ? Math.round(pronScores.reduce(function (a, b) { return a + b; }, 0) / pronScores.length) : 0;
    renderResult({
      id: "pronResult2",
      title: "Pronunciation Results",
      icon: avg >= 70 ? "trophy" : "mic",
      big: avg + "%",
      sub: "Average score across " + pronScores.length + " words",
      note: "Words pronounced at ≥ 70% count as 'remembered' in the review system",
      mode: "pron", score: avg, total: 100,
      backView: "home",
      celebrate: pronScores.length > 0 && avg >= 70
    });
  }

  /* ============================================================
     STOP GAME TIMERS
     ============================================================ */
  function stopGameTimers() {
    if (matchTimerId) { clearInterval(matchTimerId); matchTimerId = null; }
    if (tfTimerId) { clearInterval(tfTimerId); tfTimerId = null; }
  }

  /* ============================================================
     FILL-IN-THE-BLANK
     ============================================================ */
  let fillQueue = [], fillIdx = 0, fillScore = 0, fillMissed = [];

  function normText(s) {
    return (s || "").toString()
      .toLowerCase()
      .replace(/[.,!?;:'"()\[\]{}\/]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Lenient answer check for Fill-in-the-Blank: accept the full answer OR any
     one of its slash/pipe/dot/comma-separated alternatives (e.g. a Thai meaning
     written as "บรรลุผล / ทำสำเร็จ" — either translation should count). */
  function acceptAnswer(typed, expected) {
    const t = normText(typed);
    if (!t) return false;
    const cands = (expected || "").split(/\s*[\/|·,]\s*/).map(function (x) { return normText(x); });
    cands.push(normText(expected)); // the whole answer (incl. all alternatives) also accepted
    return cands.indexOf(t) >= 0;
  }

  function startFill() {
    currentMode = "fill";
    const dir = chipValue($("fillDir"));
    const type = chipValue($("fillType"));
    const cnt = chipValue($("fillCount"));
    let list = getGameSourceItems("fill");
    list = list.filter(function (i) {
      if (type !== "all" && i.type !== type) return false;
      if (dir === "th2en") return !!(i.word && i.word.trim());
      return !!(i.th && i.th.trim());
    });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { toast("No words match these conditions — try a different type or direction", "err"); return; }

    fillQueue = list; fillIdx = 0; fillScore = 0; fillMissed = [];
    $("fillControls").classList.add("hidden");
    $("fillResult").classList.add("hidden");
    $("fillSession").classList.remove("hidden");
    showFill();
  }

  function fillPromptText(i, dir) {
    if (dir === "th2en") {
      if (i.type === "vocab") return i.th || i.exTh;
      if (i.type === "collocation") return (i.note ? i.note + " — " : "") + i.exTh;
      return i.th || i.exTh; // idiom meaning
    }
    return i.word; // en2th: show English, type Thai
  }
  function fillAnswerText(i, dir) {
    return (dir === "th2en") ? i.word : i.th;
  }

  function showFill() {
    const i = fillQueue[fillIdx];
    const total = fillQueue.length;
    const dir = chipValue($("fillDir"));
    $("fillCounter").textContent = "Question " + (fillIdx + 1) + " / " + total;
    $("fillProgress").style.width = (fillIdx / total) * 100 + "%";
    $("fillBadge").textContent = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("fillPrompt").textContent = fillPromptText(i, dir);
    const inp = $("fillInput");
    inp.value = ""; inp.disabled = false;
    inp.placeholder = (dir === "th2en") ? "Type the English word..." : "Type the Thai meaning...";
    const fb = $("fillFeedback"); fb.className = "fill-feedback hidden"; fb.textContent = "";
    $("fillCheck").disabled = false; $("fillSkip").disabled = false;
    inp.focus();
    $("fillSpeak").onclick = function () { speak(i.word); };
  }

  function checkFill() {
    if ($("fillCheck").disabled) return;
    const i = fillQueue[fillIdx];
    const dir = chipValue($("fillDir"));
    const typed = normText($("fillInput").value);
    if (!typed) { $("fillInput").focus(); return; }
    const ok = acceptAnswer(typed, fillAnswerText(i, dir));
    const fb = $("fillFeedback");
    if (ok) {
      fillScore++;
      setFeedback(fb, "correct", "Correct!");
    } else {
      setFeedback(fb, "wrong", "Correct answer: " + fillAnswerText(i, dir));
      fillMissed.push({ word: i.word, th: i.th, answer: fillAnswerText(i, dir) });
    }
    fb.className = "fill-feedback";
    recordAnswer(i, ok);
    $("fillInput").disabled = true;
    $("fillCheck").disabled = true;
    $("fillSkip").disabled = true;
    setTimeout(nextFill, ok ? 700 : 1500);
  }

  function skipFill() {
    if ($("fillSkip").disabled) return;
    const i = fillQueue[fillIdx];
    fillMissed.push({ word: i.word, th: i.th, answer: fillAnswerText(i, chipValue($("fillDir"))), skipped: true });
    nextFill();
  }

  function nextFill() {
    fillIdx++;
    if (fillIdx >= fillQueue.length) endFill();
    else showFill();
  }

  function endFill() {
    $("fillSession").classList.add("hidden");
    const total = fillQueue.length;
    const pct = total ? Math.round((fillScore / total) * 100) : 0;
    let missedHTML = "";
    if (fillMissed.length) {
      missedHTML = fillMissed.map(function (m) {
        return "<div class=\"missed-item\"><b>" + m.word + "</b> — " + (m.th || "") +
          "<br><span class=\"muted\">Answer: " + m.answer + "</span></div>";
      }).join("");
    }
    renderResult({
      id: "fillResult",
      title: "Fill-in-the-Blank Results",
      icon: fillScore === total ? "trophy" : "pencil",
      big: fillScore + " / " + total,
      sub: "Accuracy " + pct + "%",
      missed: fillMissed,
      missedHeader: "Missed",
      missedHTML: missedHTML,
      emptyMsg: svgIcon("party", "ico sm") + " You filled in every item!",
      mode: "fill", score: fillScore, total: total,
      backView: "home",
      celebrate: total > 0 && fillScore === total
    });
  }

  /* ============================================================
     CARD MATCH (MEMORY)
     ============================================================ */
  let matchPairs = [], matchSelected = [], matchBusy = false, matchMatched = 0;
  let matchStartTime = 0, matchTimerId = null, matchFlips = 0, matchLive = false;

  function startMatch() {
    currentMode = "match";
    const type = chipValue($("matchType"));
    const size = parseInt(chipValue($("matchSize")), 10) || 8;
    let pool = getGameSourceItems("match").filter(function (i) {
      if (type !== "all" && i.type !== type) return false;
      const hint = (i.type === "vocab") ? i.th : (i.th || i.exTh || i.note);
      return !!(i.word && hint && hint.trim());
    });
    pool = shuffle(pool);
    if (pool.length > size) pool = pool.slice(0, size);
    if (!pool.length) { toast("No words match these conditions — try a different type", "err"); return; }

    matchPairs = pool;
    matchSelected = []; matchBusy = false; matchMatched = 0; matchFlips = 0; matchLive = false;
    $("matchControls").classList.add("hidden");
    $("matchResult").classList.add("hidden");
    $("matchSession").classList.remove("hidden");
    $("matchProgress").style.width = "0%";

    const cards = [];
    pool.forEach(function (i) {
      const hint = (i.type === "vocab") ? i.th : (i.th || i.exTh || i.note);
      cards.push({ pairId: i.id, side: "word", text: i.word, item: i, t: i.type });
      cards.push({ pairId: i.id, side: "hint", text: hint, item: i, t: i.type });
    });
    // IMPORTANT: shuffle() returns a NEW array — must assign it back,
    // otherwise the cards stay in word→hint→word→hint order every game.
    const sorted = shuffle(cards);
    const grid = $("matchGrid");
    grid.innerHTML = "";
    const tLabel = { vocab: "VOCAB", collocation: "COLLOC", idiom: "IDIOM" };
    sorted.forEach(function (c) {
      const card = el("div", "match-card peek");
      card.dataset.pair = c.pairId;
      card.dataset.side = c.side;
      card.innerHTML =
        '<div class="match-inner">' +
          '<div class="match-face match-front"></div>' +
          '<div class="match-face match-back"><span class="match-type">' + (tLabel[c.t] || "WORD") + '</span><span class="match-text"></span></div>' +
        '</div>';
      card.querySelector(".match-text").textContent = c.text;
      card._card = c;
      card.onclick = function () { selectMatchCard(card); };
      grid.appendChild(card);
    });

    // Show all cards face-up from the start — just tap two to match.
    grid.querySelectorAll(".match-card").forEach(function (c) { c.classList.add("flipped"); });

    updateMatchStatus();
    updateMatchMoves();
    matchLive = true;
    matchStartTime = Date.now();
    updateMatchTimer();
    if (matchTimerId) clearInterval(matchTimerId);
    matchTimerId = setInterval(updateMatchTimer, 1000);
    // Hide the old flip-remember overlay (no longer used).
    const mPeekEl = $("matchPeek");
    if (mPeekEl) mPeekEl.classList.add("hidden");
  }

  function updateMatchStatus() {
    $("matchCount").textContent = matchMatched + " / " + matchPairs.length;
    $("matchProgress").style.width = (matchPairs.length ? (matchMatched / matchPairs.length) * 100 : 0) + "%";
  }
  function updateMatchMoves() { $("matchMovesNum").textContent = matchFlips; }
  function updateMatchTimer() {
    const s = Math.floor((Date.now() - matchStartTime) / 1000);
    const m = Math.floor(s / 60), sec = s % 60;
    $("matchTime").textContent = m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function selectMatchCard(card) {
    if (!matchLive || matchBusy) return;
    if (card.classList.contains("matched")) return;
    if (card.classList.contains("selected")) return;
    card.classList.add("selected");
    matchSelected.push(card);
    if (matchSelected.length === 2) {
      matchFlips++; updateMatchMoves();
      matchBusy = true;
      const a = matchSelected[0], b = matchSelected[1];
      if (a.dataset.pair === b.dataset.pair && a.dataset.side !== b.dataset.side) {
        setTimeout(function () {
          a.classList.add("matched", "just-matched"); b.classList.add("matched", "just-matched");
          a.classList.remove("selected"); b.classList.remove("selected");
          matchSelected = []; matchBusy = false; matchMatched++;
          updateMatchStatus();
          recordAnswer(a._card.item, true);
          playTone("correct");
          try { if (navigator.vibrate) navigator.vibrate(16); } catch (e) {}
          flashElement(a, "correct"); flashElement(b, "correct");
          const r = a.getBoundingClientRect();
          burstConfetti(r.left + r.width / 2, r.top + r.height / 2);
          setTimeout(function () { a.classList.remove("just-matched"); b.classList.remove("just-matched"); }, 650);
          if (matchMatched >= matchPairs.length) endMatch();
        }, 420);
      } else {
        a.classList.add("wrong"); b.classList.add("wrong");
        playTone("wrong");
        try { if (navigator.vibrate) navigator.vibrate([0, 30, 20, 30]); } catch (e) {}
        setTimeout(function () {
          // Keep cards face-up — just deselect them after the wrong shake.
          a.classList.remove("selected", "wrong"); b.classList.remove("selected", "wrong");
          matchSelected = []; matchBusy = false;
        }, 850);
      }
    }
  }

  function endMatch() {
    if (matchTimerId) { clearInterval(matchTimerId); matchTimerId = null; }
    $("matchSession").classList.add("hidden");
    const s = Math.floor((Date.now() - matchStartTime) / 1000);
    const m = Math.floor(s / 60), sec = s % 60;
    renderResult({
      id: "matchResult",
      title: "Match Complete!",
      icon: "cards",
      big: matchPairs.length + " pairs",
      sub: "Time: " + m + ":" + (sec < 10 ? "0" : "") + sec + " · Moves: " + matchFlips,
      mode: "match",
      backView: "home",
      celebrate: matchPairs.length > 0
    });
  }

  /* ============================================================
     TRUE / FALSE (TIMED)
     ============================================================ */
  let tfQueue = [], tfIdx = 0, tfScore = 0, tfMissed = [], tfTimeLeft = 0, tfTotalTime = 0, tfTimerId = null, tfAnswered = 0;

  function startTf() {
    currentMode = "tf";
    const type = chipValue($("tfType"));
    const cnt = chipValue($("tfCount"));
    let list = getGameSourceItems("tf").filter(function (i) {
      if (type !== "all" && i.type !== type) return false;
      return !!(i.word && i.th && i.th.trim());
    });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { toast("No words match these conditions", "err"); return; }

    tfQueue = list; tfIdx = 0; tfScore = 0; tfMissed = []; tfAnswered = 0;
    tfTotalTime = parseInt(chipValue($("tfTime")), 10) || 60;
    tfTimeLeft = tfTotalTime;
    $("tfControls").classList.add("hidden");
    $("tfResult").classList.add("hidden");
    $("tfSession").classList.remove("hidden");
    updateTfTimer();
    if (tfTimerId) clearInterval(tfTimerId);
    tfTimerId = setInterval(tickTf, 1000);
    showTf();
  }

  function updateTfTimer() {
    const m = Math.floor(tfTimeLeft / 60), sec = tfTimeLeft % 60;
    $("tfTimeText").textContent = m + ":" + (sec < 10 ? "0" : "") + sec;
    const pct = tfTotalTime ? (tfTimeLeft / tfTotalTime) * 100 : 0;
    $("tfTimeFill").style.width = pct + "%";
    $("tfTimeFill").style.background = pct < 25 ? "var(--bad)" : (pct < 50 ? "var(--accent)" : "var(--primary)");
  }
  function tickTf() {
    tfTimeLeft--;
    updateTfTimer();
    if (tfTimeLeft <= 0) { clearInterval(tfTimerId); tfTimerId = null; endTf(true); }
  }

  function showTf() {
    const i = tfQueue[tfIdx];
    const total = tfQueue.length;
    $("tfCounter").textContent = "Question " + (tfIdx + 1) + " / " + total;
    $("tfProgress").style.width = (tfIdx / total) * 100 + "%";
    $("tfBadge").textContent = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("tfWord").textContent = i.word;
    $("tfSpeak").onclick = function () { speak(i.word); };

    const isTrue = Math.random() < 0.5;
    const pool = getGameSourceItems("tf").filter(function (x) { return x.th && x.th.trim() && x.th !== i.th; }).map(function (x) { return x.th; });
    let statement, correctBool;
    if (isTrue || pool.length === 0) {
      // กรณีไม่มีคำอื่นให้ยืมความหมาย (ข้อมูลน้อย) ให้ตกหล่นมาเป็น "จริง" เพื่อไม่ให้เกิดข้อที่ตอบอะไรก็ผิด
      statement = i.th;
      correctBool = true;
    } else {
      statement = pool[Math.floor(Math.random() * pool.length)];
      correctBool = false;
    }
    $("tfStatement").textContent = statement;
    $("tfStatement").dataset.correct = correctBool ? "1" : "0";
    const fb = $("tfFeedback"); fb.className = "quiz-feedback hidden"; fb.textContent = "";
    $("tfTrue").disabled = false; $("tfFalse").disabled = false;
  }

  function answerTf(userSaysTrue) {
    if ($("tfTrue").disabled) return;
    const i = tfQueue[tfIdx];
    const correct = $("tfStatement").dataset.correct === "1";
    const ok = (userSaysTrue === correct);
    const fb = $("tfFeedback");
    tfAnswered++;
    if (ok) {
      tfScore++;
      setFeedback(fb, "correct", "Correct!");
    } else {
      setFeedback(fb, "wrong", "Correct answer: " + (correct ? "True" : "False") + " (" + i.th + ")");
      tfMissed.push({ word: i.word, th: i.th });
    }
    fb.className = "quiz-feedback";
    recordAnswer(i, ok);
    $("tfTrue").disabled = true; $("tfFalse").disabled = true;
    setTimeout(nextTf, 900);
  }

  function nextTf() {
    tfIdx++;
    if (tfIdx >= tfQueue.length) endTf(false);
    else showTf();
  }

  function endTf(timeUp) {
    if (tfTimerId) { clearInterval(tfTimerId); tfTimerId = null; }
    $("tfSession").classList.add("hidden");
    const total = tfQueue.length;
    const answered = tfAnswered;
    const pct = answered ? Math.round((tfScore / answered) * 100) : 0;
    let missedHTML = tfMissed.map(function (m) {
      return "<div class=\"missed-item\"><b>" + m.word + "</b> — " + m.th + "</div>";
    }).join("");
    renderResult({
      id: "tfResult",
      title: "True / False Results",
      icon: tfScore === answered ? "trophy" : "clock",
      big: tfScore + " / " + answered,
      sub: "Accuracy " + pct + "% (of " + total + " questions)",
      note: timeUp ? svgIcon("clock", "ico sm") + " Time's up! Counting only answered questions" : "",
      missed: tfMissed,
      missedHeader: "Wrong",
      missedHTML: missedHTML,
      mode: "tf", score: tfScore, total: answered,
      backView: "home",
      celebrate: answered > 0 && tfScore === answered
    });
  }

  /* ============================================================
     GAME RESETS (เรียกตอนเข้าหน้า)
     ============================================================ */
  function resetFill() {
    $("fillControls").classList.remove("hidden");
    $("fillSession").classList.add("hidden");
    $("fillResult").classList.add("hidden");
  }
  function resetMatch() {
    if (matchTimerId) { clearInterval(matchTimerId); matchTimerId = null; }
    matchSelected = []; matchBusy = false; matchLive = false;
    $("matchControls").classList.remove("hidden");
    $("matchSession").classList.add("hidden");
    $("matchResult").classList.add("hidden");
    $("matchPeek").classList.add("hidden");
    $("matchGrid").innerHTML = "";
  }
  function resetTf() {
    if (tfTimerId) { clearInterval(tfTimerId); tfTimerId = null; }
    $("tfControls").classList.remove("hidden");
    $("tfSession").classList.add("hidden");
    $("tfResult").classList.add("hidden");
  }

  /* ============================================================
     HANGMAN
     ============================================================ */
  let hangQueue = [], hangIdx = 0, hangScore = 0, hangMissed = [];
  const HANG_MAX = 6;

  function startHang() {
    currentMode = "hang";
    const type = chipValue($("hangType"));
    const cnt = chipValue($("hangCount"));
    let list = getGameSourceItems("hang").filter(function (i) { return i.word && i.word.trim() && i.type === "vocab"; });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { toast("No words match these conditions", "err"); return; }
    hangQueue = list; hangIdx = 0; hangScore = 0; hangMissed = [];
    $("hangControls").classList.add("hidden");
    $("hangResult").classList.add("hidden");
    $("hangSession").classList.remove("hidden");
    showHang();
  }

  function hangDisplay(word, guessed) {
    return word.split("").map(function (ch) {
      if (/[a-zA-Z]/.test(ch)) return guessed.indexOf(ch.toLowerCase()) >= 0 ? ch : "_";
      return ch;
    }).join(" ");
  }
  function renderHangLives(n) {
    let s = "";
    for (let k = 0; k < HANG_MAX; k++) {
      s += '<span class="life ' + (k < n ? "life-on" : "life-off") + '">' + svgIcon("heart", "ico sm") + "</span>";
    }
    $("hangLives").innerHTML = s;
  }
  function renderHangKeyboard() {
    const kb = $("hangKeyboard");
    kb.innerHTML = "";
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(function (L) {
      const b = el("button", "hang-key", L);
      b.type = "button";
      b.onclick = function () { guessHang(L, b); };
      kb.appendChild(b);
    });
  }
  function showHang() {
    const i = hangQueue[hangIdx];
    const total = hangQueue.length;
    $("hangCounter").textContent = "Question " + (hangIdx + 1) + " / " + total;
    $("hangBadge").textContent = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("hangTh").textContent = i.th || (i.type === "collocation" ? ((i.note ? i.note + " — " : "") + i.exTh) : i.exTh);
    $("hangPos").textContent = i.pos || "";
    i._guessed = []; i._lives = HANG_MAX;
    const fig = $("hangFigure");
    if (fig) { fig.classList.remove("win"); fig.querySelectorAll(".hf-part").forEach(function (p) { p.classList.remove("show"); }); }
    $("hangWord").textContent = hangDisplay(i.word, []);
    renderHangLives(i._lives);
    renderHangKeyboard();
    const msg = $("hangMsg"); msg.className = "hang-msg hidden"; msg.textContent = "";
    $("hangSkip").disabled = false;
  }
  function guessHang(L, btn) {
    if (btn.disabled) return;
    const i = hangQueue[hangIdx];
    btn.disabled = true;
    const lower = L.toLowerCase();
    if (i.word.toLowerCase().indexOf(lower) >= 0) {
      i._guessed.push(lower);
      $("hangWord").textContent = hangDisplay(i.word, i._guessed);
      const letters = i.word.toLowerCase().split("").filter(function (c) { return /[a-z]/.test(c); });
      if (letters.every(function (c) { return i._guessed.indexOf(c) >= 0; })) hangWin(i, true);
    } else {
      i._lives--;
      renderHangLives(i._lives);
      btn.classList.add("wrong");
      const fig = $("hangFigure");
      if (fig) { const stage = HANG_MAX - i._lives; const part = fig.querySelector('.hf-part[data-part="' + stage + '"]'); if (part) part.classList.add("show"); }
      if (i._lives <= 0) hangWin(i, false);
    }
  }
  function hangWin(i, won) {
    const msg = $("hangMsg");
    msg.className = "hang-msg";
    if (won) {
      hangScore++;
      msg.innerHTML = svgIcon("check") + " Correct! The word was: " + esc(i.word);
      msg.style.color = "var(--good)";
      const fig = $("hangFigure"); if (fig) fig.classList.add("win");
      celebrate($("hangSession"));
    } else {
      msg.innerHTML = svgIcon("cross") + " The word was: " + esc(i.word);
      msg.style.color = "var(--bad)";
      hangMissed.push({ word: i.word, th: i.th });
      playTone("wrong");
      try { if (navigator.vibrate) navigator.vibrate([0, 35, 25, 35]); } catch (e) {}
      flashElement($("hangSession"), "wrong");
    }
    Array.prototype.forEach.call($("hangKeyboard").children, function (b) { b.disabled = true; });
    $("hangSkip").disabled = true;
    recordAnswer(i, won);
    setTimeout(nextHang, 1400);
  }
  function skipHang() {
    if ($("hangSkip").disabled) return;
    const i = hangQueue[hangIdx];
    hangMissed.push({ word: i.word, th: i.th, skipped: true });
    const msg = $("hangMsg"); msg.className = "hang-msg";
    msg.textContent = "Skipped — the word was: " + i.word; msg.style.color = "var(--muted)";
    Array.prototype.forEach.call($("hangKeyboard").children, function (b) { b.disabled = true; });
    $("hangSkip").disabled = true;
    setTimeout(nextHang, 1000);
  }
  function nextHang() {
    hangIdx++;
    if (hangIdx >= hangQueue.length) endHang();
    else showHang();
  }
  function endHang() {
    $("hangSession").classList.add("hidden");
    const total = hangQueue.length;
    const pct = total ? Math.round((hangScore / total) * 100) : 0;
    let missedHTML = hangMissed.map(function (m) {
      return "<div class=\"missed-item\"><b>" + m.word + "</b> — " + (m.th || "") + "</div>";
    }).join("");
    renderResult({
      id: "hangResult",
      title: "Hangman Results",
      icon: "target",
      big: hangScore + " / " + total,
      sub: "Guessed right: " + pct + "%",
      missed: hangMissed,
      missedHeader: "Missed",
      missedHTML: missedHTML,
      emptyMsg: svgIcon("trophy", "ico sm") + " Awesome! You got every word!",
      mode: "hang", score: hangScore, total: total,
      backView: "home",
      celebrate: false
    });
  }

  /* ============================================================
     SENTENCE BUILDER
     ============================================================ */
  let buildQueue = [], buildIdx = 0, buildScore = 0, buildMissed = [], buildBank = [], buildSentence = [];

  function startBuild() {
    currentMode = "build";
    const type = chipValue($("buildType"));
    const cnt = chipValue($("buildCount"));
    let list = getGameSourceItems("build").filter(function (i) { return i.exEn && i.exEn.trim(); });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { toast("No sentences match these conditions", "err"); return; }
    buildQueue = list; buildIdx = 0; buildScore = 0; buildMissed = [];
    $("buildControls").classList.add("hidden");
    $("buildResult").classList.add("hidden");
    $("buildSession").classList.remove("hidden");
    showBuild();
  }
  function buildWords(s) { return s.trim().split(/\s+/); }
  function showBuild() {
    const i = buildQueue[buildIdx];
    const total = buildQueue.length;
    $("buildCounter").textContent = "Question " + (buildIdx + 1) + " / " + total;
    $("buildProgress").style.width = (buildIdx / total) * 100 + "%";
    buildBank = shuffle(buildWords(i.exEn));
    buildSentence = [];
    renderBuild();
    const fb = $("buildFeedback"); fb.className = "build-feedback hidden"; fb.textContent = "";
    $("buildCheck").disabled = false; $("buildSkip").disabled = false;
  }
  function renderBuild() {
    const bank = $("buildBank");
    bank.innerHTML = "";
    buildBank.forEach(function (w, idx) {
      const t = el("button", "build-tile", w);
      t.type = "button";
      t.dataset.idx = idx;
      t.onclick = function () { placeBuildWord(idx); };
      bank.appendChild(t);
    });
    const sentence = $("buildSentence");
    sentence.innerHTML = "";
    buildSentence.forEach(function (w, idx) {
      const t = el("button", "build-tile build-placed", w);
      t.type = "button";
      t.dataset.idx = idx;
      t.onclick = function () { unplaceBuildWord(idx); };
      sentence.appendChild(t);
    });
  }
  function placeBuildWord(idx) {
    if ($("buildCheck").disabled) return;
    if (idx < 0 || idx >= buildBank.length) return;
    buildSentence.push(buildBank.splice(idx, 1)[0]);
    renderBuild();
  }
  function unplaceBuildWord(idx) {
    if ($("buildCheck").disabled) return;
    if (idx < 0 || idx >= buildSentence.length) return;
    buildBank.push(buildSentence.splice(idx, 1)[0]);
    renderBuild();
  }
  function checkBuild() {
    if ($("buildCheck").disabled) return;
    const i = buildQueue[buildIdx];
    const correct = buildWords(i.exEn);
    const ok = correct.length === buildSentence.length && correct.every(function (w, k) { return w === buildSentence[k]; });
    const fb = $("buildFeedback");
    if (ok) {
      buildScore++;
      setFeedback(fb, "correct", "Correct! " + i.exEn);
    } else {
      setFeedback(fb, "wrong", "Correct sentence: " + i.exEn);
      buildMissed.push({ word: i.word, exEn: i.exEn });
    }
    fb.className = "build-feedback";
    const tilesEl = $("buildSentence");
    Array.prototype.forEach.call(tilesEl.children, function (t, k) {
      t.classList.remove("correct"); t.classList.remove("wrong");
      if (correct[k] !== undefined && buildSentence[k] === correct[k]) t.classList.add("correct");
      else t.classList.add("wrong");
    });
    recordAnswer(i, ok);
    $("buildCheck").disabled = true; $("buildSkip").disabled = true;
    setTimeout(nextBuild, ok ? 1000 : 1800);
  }
  function skipBuild() {
    if ($("buildSkip").disabled) return;
    const i = buildQueue[buildIdx];
    buildMissed.push({ word: i.word, exEn: i.exEn, skipped: true });
    nextBuild();
  }
  function nextBuild() {
    buildIdx++;
    if (buildIdx >= buildQueue.length) endBuild();
    else showBuild();
  }
  function endBuild() {
    $("buildSession").classList.add("hidden");
    const total = buildQueue.length;
    const pct = total ? Math.round((buildScore / total) * 100) : 0;
    let missedHTML = buildMissed.map(function (m) {
      return "<div class=\"missed-item\"><b>" + (m.word || "") + "</b><br>" + m.exEn + "</div>";
    }).join("");
    renderResult({
      id: "buildResult",
      title: "Sentence Builder Results",
      icon: buildScore === total ? "trophy" : "puzzle",
      big: buildScore + " / " + total,
      sub: "Correct order: " + pct + "%",
      missed: buildMissed,
      missedHeader: "Unsolved",
      missedHTML: missedHTML,
      emptyMsg: svgIcon("party", "ico sm") + " You arranged every sentence!",
      mode: "build", score: buildScore, total: total,
      backView: "home",
      celebrate: total > 0 && buildScore === total
    });
  }

  /* ============================================================
     CLOZE (sentence completion)
     ============================================================ */
  let clozeQueue = [], clozeIdx = 0, clozeScore = 0, clozeMissed = [], clozeAnswered = 0;

  function startCloze() {
    currentMode = "cloze";
    const type = chipValue($("clozeType"));
    const cnt = chipValue($("clozeCount"));
    let list = getGameSourceItems("cloze").filter(function (i) { return i.exEn && i.exEn.trim() && i.word && i.word.trim(); });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { toast("No sentences match these conditions", "err"); return; }
    clozeQueue = list; clozeIdx = 0; clozeScore = 0; clozeMissed = []; clozeAnswered = 0;
    $("clozeControls").classList.add("hidden");
    $("clozeResult").classList.add("hidden");
    $("clozeSession").classList.remove("hidden");
    showCloze();
  }
  function showCloze() {
    const i = clozeQueue[clozeIdx];
    const total = clozeQueue.length;
    $("clozeCounter").textContent = "Question " + (clozeIdx + 1) + " / " + total;
    $("clozeProgress").style.width = (clozeIdx / total) * 100 + "%";
    const target = i.word;
    const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    $("clozeSentence").textContent = i.exEn.replace(re, "_____");
    const pool = getGameSourceItems("cloze").filter(function (x) { return x.type === i.type && x.word && x.word !== target; }).map(function (x) { return x.word; });
    const opts = shuffle([target].concat(shuffle(pool).slice(0, 3)));
    const box = $("clozeOptions");
    box.innerHTML = "";
    opts.forEach(function (o) {
      const b = el("button", "quiz-opt", o);
      b.onclick = function () { chooseCloze(o, target, b); };
      box.appendChild(b);
    });
    const fb = $("clozeFeedback"); fb.className = "quiz-feedback hidden"; fb.textContent = "";
    $("clozeNext").classList.add("hidden");
  }
  function chooseCloze(chosen, correct, btn) {
    const opts = $("clozeOptions").querySelectorAll(".quiz-opt");
    opts.forEach(function (o) { o.disabled = true; });
    const fb = $("clozeFeedback");
    const ok = (chosen === correct);
    clozeAnswered++;
    if (ok) {
      clozeScore++; btn.classList.add("correct");
      setFeedback(fb, "correct", "Correct!");
    } else {
      btn.classList.add("wrong");
      opts.forEach(function (o) { if (o.textContent === correct) o.classList.add("correct"); });
      setFeedback(fb, "wrong", "Correct word: " + correct);
      clozeMissed.push({ word: clozeQueue[clozeIdx].word, exEn: clozeQueue[clozeIdx].exEn });
    }
    fb.className = "quiz-feedback";
    recordAnswer(clozeQueue[clozeIdx], ok);
    $("clozeProgress").style.width = ((clozeIdx + 1) / clozeQueue.length) * 100 + "%";
    $("clozeNext").classList.remove("hidden");
  }
  function nextCloze() {
    clozeIdx++;
    if (clozeIdx >= clozeQueue.length) endCloze();
    else showCloze();
  }
  function endCloze() {
    $("clozeSession").classList.add("hidden");
    const total = clozeQueue.length;
    const pct = total ? Math.round((clozeScore / total) * 100) : 0;
    let missedHTML = clozeMissed.map(function (m) {
      return "<div class=\"missed-item\"><b>" + m.word + "</b><br>" + m.exEn + "</div>";
    }).join("");
    renderResult({
      id: "clozeResult",
      title: "Cloze Results",
      icon: clozeScore === total ? "trophy" : "pencil",
      big: clozeScore + " / " + total,
      sub: "Correct " + pct + "%",
      missed: clozeMissed,
      missedHeader: "Wrong",
      missedHTML: missedHTML,
      emptyMsg: svgIcon("party", "ico sm") + " You got every word!",
      mode: "cloze", score: clozeScore, total: total,
      backView: "home",
      celebrate: total > 0 && clozeScore === total
    });
  }

  /* ============================================================
     LISTEN & TYPE
     ============================================================ */
  let listenQueue = [], listenIdx = 0, listenScore = 0, listenMissed = [];

  function startListen() {
    currentMode = "listen";
    const type = chipValue($("listenType"));
    const cnt = chipValue($("listenCount"));
    let list = getGameSourceItems("listen").filter(function (i) { return i.word && i.word.trim(); });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { toast("No words match these conditions", "err"); return; }
    listenQueue = list; listenIdx = 0; listenScore = 0; listenMissed = [];
    $("listenControls").classList.add("hidden");
    $("listenResult").classList.add("hidden");
    $("listenSession").classList.remove("hidden");
    showListen();
  }
  function showListen() {
    const i = listenQueue[listenIdx];
    const total = listenQueue.length;
    $("listenCounter").textContent = "Question " + (listenIdx + 1) + " / " + total;
    $("listenProgress").style.width = (listenIdx / total) * 100 + "%";
    $("listenPos").textContent = i.pos ? "(" + i.pos + ")" : "";
    const inp = $("listenInput");
    inp.value = ""; inp.disabled = false; inp.placeholder = "Type what you hear...";
    const fb = $("listenFeedback"); fb.className = "fill-feedback hidden"; fb.textContent = "";
    $("listenCheck").disabled = false; $("listenSkip").disabled = false;
    inp.focus();
    speak(i.word);
    $("listenSpeak").onclick = function () { speak(i.word); };
  }
  function checkListen() {
    if ($("listenCheck").disabled) return;
    const i = listenQueue[listenIdx];
    const typed = normText($("listenInput").value);
    if (!typed) { $("listenInput").focus(); return; }
    const ok = typed === normText(i.word);
    const fb = $("listenFeedback");
    if (ok) {
      listenScore++;
      setFeedback(fb, "correct", "Correct!");
    } else {
      setFeedback(fb, "wrong", "Correct word: " + i.word);
      listenMissed.push({ word: i.word, th: i.th });
    }
    fb.className = "fill-feedback";
    recordAnswer(i, ok);
    $("listenInput").disabled = true;
    $("listenCheck").disabled = true; $("listenSkip").disabled = true;
    setTimeout(nextListen, ok ? 700 : 1400);
  }
  function skipListen() {
    if ($("listenSkip").disabled) return;
    const i = listenQueue[listenIdx];
    listenMissed.push({ word: i.word, th: i.th, skipped: true });
    nextListen();
  }
  function nextListen() {
    listenIdx++;
    if (listenIdx >= listenQueue.length) endListen();
    else showListen();
  }
  function endListen() {
    $("listenSession").classList.add("hidden");
    const total = listenQueue.length;
    const pct = total ? Math.round((listenScore / total) * 100) : 0;
    let missedHTML = listenMissed.map(function (m) {
      return "<div class=\"missed-item\"><b>" + m.word + "</b> — " + (m.th || "") + "</div>";
    }).join("");
    renderResult({
      id: "listenResult",
      title: "Listen &amp; Type Results",
      icon: listenScore === total ? "trophy" : "volume",
      big: listenScore + " / " + total,
      sub: "Correct " + pct + "%",
      missed: listenMissed,
      missedHeader: "Missed",
      missedHTML: missedHTML,
      emptyMsg: svgIcon("party", "ico sm") + " You typed every word correctly!",
      mode: "listen", score: listenScore, total: total,
      backView: "home",
      celebrate: total > 0 && listenScore === total
    });
  }

  /* ============================================================
     NEW-GAME RESETS (เรียกตอนเข้าหน้า)
     ============================================================ */
  function resetHang() {
    $("hangControls").classList.remove("hidden");
    $("hangSession").classList.add("hidden");
    $("hangResult").classList.add("hidden");
  }
  function resetBuild() {
    $("buildControls").classList.remove("hidden");
    $("buildSession").classList.add("hidden");
    $("buildResult").classList.add("hidden");
  }
  function resetCloze() {
    $("clozeControls").classList.remove("hidden");
    $("clozeSession").classList.add("hidden");
    $("clozeResult").classList.add("hidden");
  }
  function resetListen() {
    $("listenControls").classList.remove("hidden");
    $("listenSession").classList.add("hidden");
    $("listenResult").classList.add("hidden");
  }

  /* ============================================================
     INIT
     ============================================================ */
  // Global error handler for debugging
  window.addEventListener("error", function (e) {
    console.error("[Global Error]", e.message, "at", e.filename, ":", e.lineno, ":", e.colno);
  });
  window.addEventListener("unhandledrejection", function (e) {
    console.error("[Unhandled Rejection]", e.reason);
  });

  async function init() {
    try {
      await SecureStore.ready;
    } catch (e) {
      console.warn("[init] SecureStore.ready failed:", e);
    }
    // Guest session isolation: ถ้าไม่ล็อกอินและมา session ใหม่ → ล้างข้อมูล guest ทุกอย่าง
    // (ต้องเรียกก่อน loadInitialState เพื่อให้ UI โหลดค่าเริ่มต้น)
    try {
      if (window.VocabAuth && window.VocabAuth.resetGuestDataIfNewSession) {
        window.VocabAuth.resetGuestDataIfNewSession();
      }
    } catch (e) {
      console.warn("[init] resetGuestDataIfNewSession failed:", e);
    }
    try {
      loadInitialState();
    } catch (e) {
      console.error("[init] loadInitialState failed:", e);
    }
    // Initialize CEFR level system (must be after loadInitialState so VOCAB_DAYS and ITEMS exist)
    try {
      if (window.CefrSelector && window.CefrSelector.initCefrSystem) {
        window.CefrSelector.initCefrSystem();
      }
    } catch (e) {
      console.error("[init] CefrSelector.initCefrSystem failed:", e);
    }
    try { applyTheme(); } catch (e) { console.error("[init] applyTheme failed:", e); }
    // Inject inline SVG icons into every [data-icon] placeholder
    try {
      document.querySelectorAll("[data-icon]").forEach(function (node) {
        node.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[node.dataset.icon] || "") + "</svg>";
      });
    } catch (e) { console.error("[init] SVG injection failed:", e); }
    try { applyI18n(); } catch (e) { console.error("[init] applyI18n failed:", e); }
    // อัปเดตปุ่ม login ใน sidebar ด้วยภาษาที่ถูกต้อง (หลัง settings ถูก init แล้ว)
    if (window.VocabAuth && window.VocabAuth.updateSidebarAuthBtn) {
      try { window.VocabAuth.updateSidebarAuthBtn(); } catch (e) { console.error("[init] updateSidebarAuthBtn failed:", e); }
    }
    try { initChips(); } catch (e) { console.error("[init] initChips failed:", e); }
    try { initGameSources(); } catch (e) { console.error("[init] initGameSources failed:", e); }
    try { applyI18n(); } catch (e) { console.error("[init] applyI18n (after game sources) failed:", e); }
    // Defer heavy rendering (charts, heatmap, mastery donut, memory gauge,
    // daily progress bars) to the next animation frame so the browser can
    // paint the initial UI (icons, text, layout) first — this makes the
    // page feel instantly responsive instead of blocking on renderHome().
    requestAnimationFrame(function () {
      try { renderHome(); } catch (e) { console.error("[init] renderHome failed:", e); }
      try { renderProfileChip(); } catch (e) { console.error("[init] renderProfileChip failed:", e); }
      try { applyRewards(); } catch (e) { console.error("[init] applyRewards failed:", e); }
      try { renderRewards(); } catch (e) { console.error("[init] renderRewards failed:", e); }
      try { updateBossRushBtn(); } catch (e) { console.error("[init] updateBossRushBtn failed:", e); }
      try { renderSettings(); } catch (e) { console.error("[init] renderSettings failed:", e); }
      try { initInteractionFX(); } catch (e) { console.error("[init] initInteractionFX failed:", e); }
      // Placement Test (เฉพาะผู้ใช้ใหม่ที่ยังไม่เคยทำ)
      try {
        if (window.VocabPlacement && window.VocabPlacement.init) {
          window.VocabPlacement.init();
        }
      } catch (e) { console.error("[init] VocabPlacement.init failed:", e); }
      // CEFR Level Panel (แสดงระดับของผู้ใช้บนหน้า Home)
      try { renderCEFRBadges(); } catch (e) { console.error("[init] renderCEFRBadges failed:", e); }
      // Music is owned by the mini-player overlay (mini-player.js). It calls
      // window.VocabMusic.pause() on init, so we skip the built-in looping
      // player to avoid two tracks playing at once.
      try {
        if (!window.MINI_PLAYER_ENABLED) initMusic();
      } catch (e) { console.error("[init] initMusic failed:", e); }
    });

    // Cloud sync completed (pull from Firebase on login/app-open or manual Sync Now).
    // Reload in-memory state so the fresh cloud data is reflected without a page reload.
    window.addEventListener("vocab:synced", function () {
      if (currentMode) return; // mid-session — skip reload, next save will push merged state
      try {
        loadInitialState();
        cachedAllItems = null;
        ALL_ITEMS = getAllItems();
        ITEMS = window.CefrSelector?.getFilteredItems ? window.CefrSelector.getFilteredItems() : ALL_ITEMS;
        cachedBrowseKey = "";
        if (window.CefrSelector && window.CefrSelector.initCefrSystem) window.CefrSelector.initCefrSystem();
        applyTheme();
        applyI18n();
        renderHome();
        renderProfileChip();
        applyRewards();
        renderRewards();
        updateBossRushBtn();
        renderSettings();
        renderCEFRBadges();
        if (window.VocabAuth && window.VocabAuth.updateSidebarAuthBtn) window.VocabAuth.updateSidebarAuthBtn();
        console.log("[app] vocab:synced — state reloaded");
      } catch (e) {
        console.error("[app] reload after sync failed:", e);
      }
    });

    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.onclick = function () { showView(b.dataset.view); };
    });
    $("navGames").onclick = function () {
      const sub = $("navGamesSub");
      const open = sub.classList.toggle("open");
      this.setAttribute("aria-expanded", open ? "true" : "false");
    };
    document.querySelectorAll(".nav-sub-btn").forEach(function (b) {
      b.onclick = function () {
        showView(b.dataset.view);
        const sub = $("navGamesSub");
        if (sub) sub.classList.remove("open");
        const ng = $("navGames");
        if (ng) ng.setAttribute("aria-expanded", "false");
      };
    });

    document.addEventListener("click", function (e) {
      const sub = $("navGamesSub");
      const ng = $("navGames");
      if (sub && sub.classList.contains("open") && !sub.contains(e.target) && !ng.contains(e.target)) {
        sub.classList.remove("open");
        if (ng) ng.setAttribute("aria-expanded", "false");
      }
    });
    const pc = $("profileChip");
    if (pc) pc.onclick = function () { showView("achievements"); };
    // Keep the Memory Strength forgetting-curve undistorted. Its viewBox is sized to the
    // panel's pixel width (preserveAspectRatio="none" + 1:1 mapping), so re-measure when the
    // layout changes — but only while the Home/dashboard view is actually visible.
    let msResizeT;
    window.addEventListener("resize", function () {
      if (!($("view-home") && $("view-home").classList.contains("active"))) return;
      clearTimeout(msResizeT);
      msResizeT = setTimeout(buildMemoryStrength, 150);
    });
    $("themeToggle").onclick = toggleTheme;
    $("settingsTheme").onclick = toggleTheme;
    $("settingsSound").onclick = function () {
      settings.sound = (settings.sound === false) ? true : false;
      save(K_SETTINGS, settings);
      renderSettings();
      if (settings.sound) playTone("correct");
    };
    $("settingsMusic").onclick = function () {
      if (window.MiniMusicPlayer) {
        const playing = window.MiniMusicPlayer.getState().playing;
        if (playing) window.MiniMusicPlayer.pause(); else window.MiniMusicPlayer.play();
        settings.music = !playing;            // keep the toggle label in sync
      } else {
        settings.music = !settings.music;
        if (settings.music) musicPlay(); else musicStop();
      }
      save(K_SETTINGS, settings);
      renderSettings();
    };
    $("settingsPlayer").onclick = function () {
      settings.showMiniPlayer = !settings.showMiniPlayer;
      save(K_SETTINGS, settings);
      applyMiniPlayerVisibility();
      renderSettings();
    };
    $("settingsReminder").onclick = function () {
      settings.reminder.on = !settings.reminder.on;
      if (settings.reminder.on && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then(function () { renderSettings(); });
      }
      save(K_SETTINGS, settings);
      renderSettings();
      if (settings.reminder.on) toast(t("notif.granted"), "ok");
      else if ("Notification" in window && Notification.permission === "denied") toast(t("notif.denied"), "warn");
    };
    $("reminderTime").onchange = function () {
      settings.reminder.time = this.value || "20:00";
      save(K_SETTINGS, settings);
    };
    $("settingsPageSong").onchange = function () {
      settings.pageSong = +this.value; save(K_SETTINGS, settings);
      if (window.MiniMusicPlayer) {
        // The mini-player fuses all songs into one library (page songs first).
        window.MiniMusicPlayer.loadTrack(+this.value);
      } else if (settings.music && musicMode === "onpage") {
        musicRefresh();
      }
    };
    $("settingsGameSong").onchange = function () {
      settings.gameSong = +this.value; save(K_SETTINGS, settings);
      if (window.MiniMusicPlayer) {
        // Game songs follow the page songs in the fused library.
        window.MiniMusicPlayer.loadTrack(PAGE_SONGS.length + (+this.value));
      } else if (settings.music && musicMode === "ingame") {
        musicRefresh();
      }
    };
    $("settingsMusicVol").oninput = function () {
      const v = +this.value / 100;
      settings.musicVol = v; save(K_SETTINGS, settings);
      if (window.MiniMusicPlayer) window.MiniMusicPlayer.setVolume(v);
      else if (musicAudio) musicAudio.volume = v;
    };
    $("homeCards").onclick = function () { showView("cards"); };
    $("homeQuiz").onclick = function () { showView("quiz"); };
    $("homeSmart").onclick = startSmartReview;
    $("homeFill").onclick = function () { showView("fill"); };
    $("homeMatch").onclick = function () { showView("match"); };
    $("homeTf").onclick = function () { showView("tf"); };
    $("homeHang").onclick = function () { showView("hang"); };
    $("homeBuild").onclick = function () { showView("build"); };
    $("homeCloze").onclick = function () { showView("cloze"); };
    $("homeListen").onclick = function () { showView("listen"); };

    // Boss Rush (ปลดล็อกที่ L20)
    $("bossRushBtn").onclick = startBossRush;
    $("bossClose").onclick = closeBossRush;
    $("bossKnow").onclick = function () { bossAnswer(true); };
    $("bossForgot").onclick = function () { bossAnswer(false); };
    $("bossAgain").onclick = startBossRush;

    // Floating mini Daily Quest widget
    $("mqToggle").onclick = function () {
      const mq = $("miniQuest"); if (!mq) return;
      const open = mq.classList.toggle("open");
      this.setAttribute("aria-expanded", open ? "true" : "false");
    };
    $("mqClaim").onclick = function () { claimDailyQuests(); };

    $("startCards").onclick = startCards;
    document.querySelectorAll("#cardGradeRow .btn-grade").forEach(function (b) {
      b.onclick = function () { cardGrade(parseInt(b.dataset.q, 10)); };
    });

    $("startQuiz").onclick = startQuiz;
    $("quizNext").onclick = nextQuiz;

    $("startPron").onclick = startPron;
    $("pronNext").onclick = nextPron;

    $("startFill").onclick = startFill;
    $("fillCheck").onclick = checkFill;
    $("fillSkip").onclick = skipFill;
    $("fillInput").addEventListener("keydown", function (e) { if (e.key === "Enter") checkFill(); });

    $("startMatch").onclick = startMatch;

    $("startTf").onclick = startTf;
    $("tfTrue").onclick = function () { answerTf(true); };
    $("tfFalse").onclick = function () { answerTf(false); };

    $("startHang").onclick = startHang;
    $("hangSkip").onclick = skipHang;
    $("startBuild").onclick = startBuild;
    $("buildCheck").onclick = checkBuild;
    $("buildSkip").onclick = skipBuild;
    $("startCloze").onclick = startCloze;
    $("clozeNext").onclick = nextCloze;
    $("startListen").onclick = startListen;
    $("listenCheck").onclick = checkListen;
    $("listenSkip").onclick = skipListen;
    $("listenInput").addEventListener("keydown", function (e) { if (e.key === "Enter") checkListen(); });

    $("browseSearch").oninput = function () {
      if (browseSearchTimer) clearTimeout(browseSearchTimer);
      browseSearchTimer = setTimeout(function () {
        browsePage = 1;
        renderBrowse(false);
      }, 150);
    };
    $("browseToggleMeanings").onclick = function () {
      settings.hideAllMeanings = !settings.hideAllMeanings;
      save(K_SETTINGS, settings);
      renderBrowse(false);
    };

    $("openCustomWordModal")?.addEventListener("click", function () {
      const modal = $("customWordModal");
      if (!modal) return;
      modal.removeAttribute("aria-hidden");
      modal.classList.add("open", "show");
      modal.querySelectorAll("[data-icon]").forEach(function (n) {
        n.innerHTML = svgIcon(n.dataset.icon);
      });
      $("cwWord")?.focus();
    });
    $("cwClose")?.addEventListener("click", function () {
      const modal = $("customWordModal");
      if (modal) {
        modal.classList.remove("open", "show");
        modal.setAttribute("aria-hidden", "true");
      }
    });
    $("cwImportCsv")?.addEventListener("click", function () {
      const zone = $("cwCsvZone");
      if (zone) zone.hidden = !zone.hidden;
    });
    $("cwCsvFile")?.addEventListener("change", function () {
      const file = $("cwCsvFile").files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        const result = importCustomWordsCsv(evt.target.result);
        const status = $("cwCsvStatus");
        if (status) {
          status.textContent = result.ok
            ? t("cw.importOk").replace("{n}", result.added).replace("{d}", result.skipped)
            : t("cw.importErr").replace("{msg}", result.error || "");
          status.style.color = result.ok ? "var(--good)" : "var(--bad)";
        }
        if (result.ok && result.added > 0) {
          cachedAllItems = null;
          ALL_ITEMS = getAllItems();
          ITEMS = window.CefrSelector?.getFilteredItems ? window.CefrSelector.getFilteredItems() : ALL_ITEMS;
          cachedBrowseKey = "";
          renderBrowse(true);
        }
      };
      reader.readAsText(file);
    });
    $("cwCancel")?.addEventListener("click", function () {
      const modal = $("customWordModal");
      if (modal) {
        modal.classList.remove("open", "show");
        modal.setAttribute("aria-hidden", "true");
      }
    });
    $("cwSave")?.addEventListener("click", function () {
      const word = $("cwWord").value.trim();
      const type = $("cwType").value;
      const pos = $("cwPos").value.trim();
      const th = $("cwTh").value.trim();
      const exEn = $("cwExEn").value.trim();
      const exTh = $("cwExTh").value.trim();
      if (!word || !th) {
        toast("กรุณากรอกคำศัพท์และความหมาย", "err");
        return;
      }
      saveCustomWord({ word, type, pos, th, exEn, exTh, day: 1 });
      $("cwWord").value = "";
      $("cwPos").value = "";
      $("cwTh").value = "";
      $("cwExEn").value = "";
      $("cwExTh").value = "";
      const modal = $("customWordModal");
      if (modal) {
        modal.classList.remove("open", "show");
        modal.setAttribute("aria-hidden", "true");
      }
    });

    // Plan-day override controls
    function tasksActive() { return $("view-tasks").classList.contains("active"); }
    $("planDayMinus").onclick = function () {
      let base = settings.planDayOverride || computePlanDay();
      base = Math.max(1, base - 1); settings.planDayOverride = base;
      save(K_SETTINGS, settings); renderSettings(); if (tasksActive()) renderTasks();
    };
    $("planDayPlus").onclick = function () {
      let base = settings.planDayOverride || computePlanDay();
      base = Math.min(planMaxDays(), base + 1); settings.planDayOverride = base;
      save(K_SETTINGS, settings); renderSettings(); if (tasksActive()) renderTasks();
    };
    $("planDayAuto").onclick = function () {
      delete settings.planDayOverride;
      save(K_SETTINGS, settings); renderSettings(); if (tasksActive()) renderTasks();
    };

    $("resetProgress").onclick = function () {
      confirmDialog("Reset all progress? (Your words won't be deleted, but review status will be cleared)", "Reset progress").then(function (ok) {
      if (ok) {
        progress = {}; reviews = {}; save(K_PROGRESS, progress); save(K_REVIEWS, reviews);
        renderSettings(); renderHome();
        toast("Reset complete", "ok");
      }
    });
    };

    // --- Clear All Data — wipes every vocab_ key from localStorage ---
    $("clearAllData").onclick = function () {
      confirmDialog(svgIcon("alert", "ico sm") + " This will delete ALL your data: progress, settings, streak, achievements, and all preferences. The app will be like it was just opened for the first time. Are you sure?", "Clear All Data").then(function (ok) {
        if (ok) {
          Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf("vocab_") === 0) localStorage.removeItem(k);
          });
          // Also clear SecureStore (IndexedDB) if available
          if (window.SecureStore && window.SecureStore.clear) {
            try { window.SecureStore.clear(); } catch (e) {}
          }
          toast("All data cleared — reload to start fresh", "ok");
          setTimeout(function () { location.reload(); }, 1200);
        }
      });
    };

    // Warn if opened from file:// (mic permission won't persist)
    if (location.protocol === "file:" && $("pronFileWarn")) {
      $("pronFileWarn").style.display = "block";
    }

    // Backup / restore
    $("exportFile").onclick = exportFile;
    $("exportCopy").onclick = exportCopy;
    $("importCode").onclick = importFromCode;
    $("importFile").onchange = function (e) { importFromFile(e.target.files && e.target.files[0]); e.target.value = ""; };

    // Word detail modal close handlers
    $("detailClose").onclick = closeDetail;
    $("detailClose2").onclick = closeDetail;
    $("detailModal").onclick = function (e) { if (e.target === $("detailModal")) closeDetail(); };
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && $("detailModal").classList.contains("open")) closeDetail();
    });

    initPWA();
    initA11y();
    startReminderScheduler();
    const hb = $("helpBtn"); if (hb) hb.onclick = showHelp;
  }

  /* ============================================================
     PWA — service worker, install prompt, OS theme
     ============================================================ */
  function initPWA() {
    // Honor the OS color scheme on the very first load (no saved setting yet).
    try {
      if (localStorage.getItem(K_SETTINGS) == null) {
        const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        settings.theme = dark ? "dark" : "light";
        save(K_SETTINGS, settings);
        applyTheme();
      }
    } catch (e) {}

    // Register the service worker for offline use + installability (skip on file://).
    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("service-worker.js").then(function (reg) {
          if (!reg) return;
          const onUpdate = function () { toast("A new version is available — reload to refresh", "ok"); };
          if (reg.waiting) onUpdate();
          reg.addEventListener("updatefound", function () {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", function () {
              if (installing.state === "installed" && navigator.serviceWorker.controller) onUpdate();
            });
          });
        }).catch(function () {});
      });
    }

    // Capture the install prompt and reveal the Install button when eligible.
    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      const btn = $("installBtn");
      if (btn) btn.hidden = false;
    });
    window.addEventListener("appinstalled", function () {
      const btn = $("installBtn");
      if (btn) btn.hidden = true;
      toast("Vocab Trainer installed — open it from your home screen", "ok");
    });
    const ib = $("installBtn");
    if (ib) ib.onclick = function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; ib.hidden = true; }).catch(function () {});
    };
  }

  /* ============================================================
     A11y — mobile drawer, keyboard shortcuts, help dialog
     ============================================================ */
  function trapIn(ov, e) {
    if (e.key !== "Tab") return;
    const f = ov.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function showHelp() {
    const ov = $("kbHelp");
    if (!ov) return;
    const rows = [
      ["Home", "1"], ["Daily Tasks", "2"], ["Word List", "3"],
      ["Open Games menu", "4"], ["Settings", "5"],
      ["Flip / reveal card", "Space"], ["Close dialog", "Esc"]
    ];
    let html = '<div class="kb-help-box" role="document"><h2><svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2.2"/><path d="M6 9.5h.01M9.5 9.5h.01M13.5 9.5h.01M17 9.5h.01M7.5 13h9"/></svg> Keyboard Shortcuts</h2>';
    rows.forEach(function (r) {
      const keys = r[1].split(" ").map(function (k) { return '<kbd class="kb-key">' + k + "</kbd>"; }).join(" ");
      html += '<div class="kb-row"><span>' + r[0] + '</span><span class="kb-keys">' + keys + "</span></div>";
    });
    html += '<div class="kb-row kb-actions"><button class="btn btn-primary" id="kbClose">Got it</button></div></div>';
    ov.innerHTML = html;
    const close = function () {
      ov.classList.remove("open"); ov.setAttribute("aria-hidden", "true");
      if (ov._last && ov._last.focus) ov._last.focus();
    };
    ov._last = document.activeElement;
    ov.classList.add("open"); ov.setAttribute("aria-hidden", "false");
    ov.onkeydown = function (e) { trapIn(ov, e); if (e.key === "Escape") close(); };
    ov.onclick = function (e) { if (e.target === ov) close(); };
    $("kbClose").onclick = close;
    $("kbClose").focus();
  }

  function initA11y() {
    // Mobile drawer
    const mt = $("menuToggle"), sc = $("scrim");
    function closeMenu() {
      const s = $("sidebarNav"); if (s) s.classList.remove("open");
      if (mt) mt.setAttribute("aria-expanded", "false");
      if (sc) sc.classList.remove("show");
    }
    function openMenu() {
      const s = $("sidebarNav"); if (s) s.classList.add("open");
      if (mt) mt.setAttribute("aria-expanded", "true");
      if (sc) sc.classList.add("show");
    }
    if (mt) mt.onclick = function () { $("sidebarNav").classList.contains("open") ? closeMenu() : openMenu(); };
    if (sc) sc.onclick = closeMenu;
    document.querySelectorAll(".nav-btn, .nav-sub-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        if (window.matchMedia && window.matchMedia("(max-width: 860px)").matches) closeMenu();
      });
    });

    // Global keyboard shortcuts (ignore while typing or a dialog is open)
    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ($("detailModal").classList.contains("open") || $("kbHelp").classList.contains("open")) return;
      const map = { "1": "home", "2": "tasks", "3": "browse", "4": "_games", "5": "settings" };
      if (map[e.key]) {
        if (map[e.key] === "_games") { const sg = $("navGames"); if (sg) sg.click(); }
        else showView(map[e.key]);
        return;
      }
      if (e.key === " " && $("cardSession") && !$("cardSession").classList.contains("hidden")) {
        e.preventDefault(); const fc = $("flipCard"); if (fc) fc.click();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  /* ============================================================
     GRADED READERS & STORIES (300 Articles across A1–C2, 50 per level)
     ============================================================ */
  function generateAllStories() {
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const levelTopics = {
      "A1": [
        "A Sunny Morning", "My Little Dog", "Breakfast with Family", "Going to the Park", "My Best Friend",
        "My School Bag", "The Red Apple", "A Walk in the Rain", "My Bedroom", "Helping Mother",
        "My Father's Car", "A Glass of Water", "Playing with Toys", "The Green Tree", "A Happy Cat",
        "My New Shoes", "Reading a Book", "Writing My Name", "Listening to Music", "The Blue Sky",
        "A Warm Blanket", "Drinking Fresh Milk", "Eating Sweet Fruit", "The Small Bird", "Running in the Yard",
        "Opening the Door", "Cleaning the Table", "Wearing a Coat", "The Yellow Flower", "A Cute Rabbit",
        "Looking at Pictures", "Sleeping at Night", "Waking Up Early", "Washing Hands", "Brushing Teeth",
        "Eating Dinner", "Watching the Stars", "Holding an Umbrella", "Walking Home", "A Good Day",
        "My Toy Train", "Drawing a House", "Singing a Song", "Sitting on the Chair", "Eating Rice",
        "Drinking Orange Juice", "A Big Ball", "My Smiling Face", "Saying Hello", "Going to Sleep"
      ],
      "A2": [
        "Visiting the Library", "Going to the City", "A Trip to the Park", "Shopping for Groceries", "Meeting an Old Friend",
        "A Busy Afternoon", "Cooking Dinner Together", "A Visit to the Doctor", "Learning English Online", "Listening to the Radio",
        "A Weekend in the Country", "Buying a New Phone", "Planning a Summer Vacation", "Taking the City Bus", "Waiting for the Train",
        "A Sunny Beach Day", "Visiting a Local Museum", "An Exciting Football Match", "My Favorite Hobby", "Trying a New Restaurant",
        "A Wonderful Birthday Party", "Making a Chocolate Cake", "A Quiet Rainy Sunday", "Cleaning the Whole House", "Gardening in Spring",
        "A Long Walk in the Woods", "Watching a Comedy Movie", "Writing an Email to a Friend", "Helping a Kind Neighbor", "Finding Lost Keys",
        "Looking at Old Photographs", "Choosing a Birthday Gift", "An Unexpected Phone Call", "A Delicious Lunch", "Reading the Daily Newspaper",
        "Checking the Weather Forecast", "Planting Colorful Flowers", "Painting a Watercolor Picture", "Singing at a Concert", "Dancing at a Wedding",
        "Visiting Grandparents", "A Trip to the Local Zoo", "Seeing Wild Animals", "Crossing the Stone Bridge", "A Boat on the River",
        "Climbing the Green Hill", "A Cold Winter Morning", "Enjoying the Spring Breeze", "An Autumn Evening", "Looking Forward to Tomorrow"
      ],
      "B1": [
        "Pursuing Career Goals", "The Importance of Continuous Learning", "Balancing Work and Life", "Overcoming Personal Challenges", "The Benefits of Traveling",
        "Adapting to New Environments", "Healthy Eating Habits", "The Role of Technology in Education", "Effective Time Management", "Building Meaningful Relationships",
        "Managing Stress in Daily Life", "The Value of Financial Literacy", "Exploring New Creative Hobbies", "The Impact of Social Media on Youth", "Community Volunteer Work",
        "Understanding Different Cultural Norms", "The Art of Public Speaking", "Setting Achievable Life Targets", "The Significance of Teamwork", "Coping with Unexpected Uncertainty",
        "The Benefits of Regular Physical Exercise", "Mindfulness and Mental Health", "The Future of Remote Working", "Discovering Local History", "The Power of Positive Thinking",
        "Conserving Natural Resources", "Learning a Second Language", "The Influence of Music on Mood", "Creative Problem Solving Strategies", "The Experience of Moving Abroad",
        "Navigating Career Transitions", "The Art of Negotiation", "Designing a Sustainable Daily Routine", "The Joy of Reading Novels", "Overcoming the Fear of Failure",
        "The Value of Constructive Feedback", "Cultivating Daily Gratitude", "The Ethics of Modern Consumerism", "Exploring Culinary Arts", "The Science of Quality Sleep",
        "Understanding Economic Trends", "The Evolution of Digital Communication", "Embracing Lifelong Curiosity", "The Importance of Civic Duty", "Balancing Ambition and Contentment",
        "The Benefits of Journaling", "Adapting to Industry Changes", "The Significance of Professional Mentorship", "Building Personal Resilience", "Reflecting on Meaningful Life Lessons"
      ],
      "B2": [
        "Navigating Modern Technological Disruptions", "The Complexities of Globalization", "Analyzing Economic Indicators", "Psychological Dimensions of Motivation", "Environmental Sustainability Initiatives",
        "The Evolution of Higher Education", "Media Literacy in the Digital Age", "Urban Planning and Smart Cities", "Cultural Preservation vs. Modernization", "The Economics of Renewable Energy",
        "Cross-Cultural Communication Strategies", "Corporate Social Responsibility", "The Psychology of Decision Making", "Advancements in Biotechnology", "The Impact of Artificial Intelligence",
        "Public Policy and Social Welfare", "The Philosophy of Existentialism", "Globalization of Financial Markets", "The Sociology of Consumer Behavior", "Innovations in Public Transport",
        "The Ethics of Genetic Engineering", "Demographic Shifts and Aging Societies", "The Role of Journalism in Democracy", "Behavioral Economics Insights", "The Future of Space Exploration",
        "Biodiversity Conservation Efforts", "The Architecture of Modern Workplaces", "Global Supply Chain Vulnerabilities", "The Art of Strategic Management", "Intellectual Property in the Digital Era",
        "The Psychology of Creativity", "Renewable Energy Transition Challenges", "The Impact of Automation on Labor", "Diplomacy in the 21st Century", "The Sociology of Work and Leisure",
        "Advancements in Medical Diagnostics", "The Economics of Healthcare Systems", "Cultural Identity in a Multicultural World", "The Dynamics of Innovation Clusters", "Cybersecurity and Privacy Rights",
        "The Philosophy of Science", "Macroeconomic Monetary Policies", "Urbanization and Quality of Life", "The Science of Climate Modeling", "Corporate Governance and Ethics",
        "The Evolution of Consumer Preferences", "Philanthropy and Social Impact", "The Globalization of Higher Learning", "Cognitive Biases in Leadership", "Strategic Foresight and Long-term Planning"
      ],
      "C1": [
        "Epistemological Foundations of Knowledge", "Socio-Economic Paradigms of Late Capitalism", "Technological Singularity and Human Agency", "Neurocognitive Correlates of Aesthetic Experience", "Planetary Boundaries and Anthropocene Realities",
        "Geopolitical Realignments in Multipolar Orders", "Hermeneutic Approaches to Literary Criticism", "Bioethical Dilemmas in Synthetic Biology", "Institutional Economics and Market Failures", "Quantum Computing and Cryptographic Security",
        "Phenomenological Perspectives on Consciousness", "Comparative Analysis of Governance Models", "Epistemic Injustice in Institutional Frameworks", "Evolutionary Dynamics of Complex Systems", "Aesthetics of the Contemporary Avant-Garde",
        "Transnational Migration and Citizenship", "Computational Social Science Methodologies", "Theoretically Grounded Pedagogical Reforms", "Sociological Implications of Algorithmic Bias", "Macro-Prudential Regulation of Financial Stability",
        "Ecological Economics and Degrowth Models", "Philosophy of Mind and Artificial Sentience", "Critical Discourse Analysis of Political Rhetoric", "Urban Resilience in the Face of Climate Shocks", "Epistemology of Scientific Discovery",
        "Structural Determinants of Global Health", "The Semiotics of Visual Culture", "Behavioral Insights in Public Administration", "Ontological Status of Virtual Realities", "Transdisciplinary Approaches to Sustainability",
        "Comparative Constitutional Law Dynamics", "The Political Economy of Global Trade", "Neuroaesthetics and Creative Cognition", "Ethics of Autonomous Weapon Systems", "Social Stratification in Digital Economies",
        "The Philosophy of Language and Meaning", "Climatology and Policy Interventions", "Institutional Resilience and Crises", "The Sociology of Knowledge Production", "Historical Materialism in the 21st Century",
        "Complex Adaptive Systems in Biology", "The Ethics of Intergenerational Justice", "Epistemic Authority in Expert Systems", "Aesthetic Theory in Postmodernity", "Spatial Analysis of Economic Disparities",
        "The Philosophy of Technology and Alienation", "Comparative Political Economy Analysis", "Transnational Governance Mechanisms", "Hermeneutics of Legal Interpretation", "Futures Studies and Anticipatory Governance"
      ],
      "C2": [
        "Ontological Inquiries into Ultimate Reality", "Metatheoretical Synthesis of Social Sciences", "Esoteric Epistemologies in the Post-Truth Era", "Deconstructive Readings of Canonical Texts", "Cosmological Paradigms and Multiverse Theories",
        "Transcendental Phenomenology of Intersubjectivity", "Dialectical Materialism and Historical Teleology", "Advanced Topological Data Analysis in Cognition", "Post-Humanist Critiques of Subjectivity", "Axiological Foundations of Global Ethics",
        "Hermeneutic Circles in Psychoanalytic Theory", "Non-Linear Dynamics in Societal Collapse", "Epistemic Relativism and Scientific Realism", "Ontological Turn in Contemporary Anthropology", "Semiotics of Transcendent Discourse",
        "Biopolitical Control in Surveillance Societies", "Philosophy of Mathematics and Formal Systems", "Phenomenology of Temporal Experience", "Critical Theory and Late Capitalist Critique", "Metaphysics of Presence in Contemporary Thought",
        "Comparative Epistemology of Eastern and Western Traditions", "Structuralism and Post-Structuralist Ruptures", "Ontology of Virtual and Augmented Realities", "Aesthetics of the Sublime in Modern Art", "Hermeneutics of Suspicion in Social Inquiry",
        "Epistemological Implications of Quantum Entanglement", "Socio-Legal Dimensions of Global Justice", "Transcendental Idealism and Modern Logic", "The Architecture of Abstract Thought Systems", "Philosophy of History and Eschatological Visions",
        "Phenomenological Sociology of Everyday Life", "Ontological Security in Geopolitical Discourses", "Metatheory of Complex Adaptive Organizations", "Epistemic Warrant and Justified True Belief", "Deconstruction of Binary Oppositions in Discourse",
        "Advanced Hermeneutics of Sacred Texts", "Sociological Imagination in Macro-Historical Analysis", "Philosophy of Science and Paradigm Shifts", "Ontological Commitments in Formal Ontology", "Critical Realism and Social Stratification",
        "Epistemological Critiques of Positivism", "Phenomenology of Embodied Cognition", "Metaphysics of Causality in Modern Physics", "Dialectics of Enlightenment in the Digital Age", "Transcendental Pragmatics of Discourse Ethics",
        "Ontological Foundations of Artificial General Intelligence", "Hermeneutic Horizon in Cross-Cultural Translation", "Epistemic Virtues in Scientific Inquiry", "Structural Homologies in Myth and Science", "The Ultimate Synthesis of Human Knowledge"
      ]
    };

    const stories = [];
    levels.forEach(function (lvl) {
      const topics = levelTopics[lvl] || [];
      topics.forEach(function (topic, idx) {
        const sId = "story-" + lvl.toLowerCase() + "-" + (idx + 1);
        stories.push({
          id: sId,
          level: lvl,
          title: topic,
          text: getArticleText(lvl, topic, idx + 1),
          thText: getArticleThai(lvl, topic, idx + 1)
        });
      });
    });
    return stories;
  }

  function getArticleText(lvl, topic, n) {
    const t = topic.toLowerCase();
    if (lvl === "A1") {
      return "Every day is full of small moments: the morning sun, a warm meal, time with family and friends. " + t + " is part of that simple daily life. When we notice these little things, the day feels brighter. Learning English helps us talk about our world and share it with more people.";
    } else if (lvl === "A2") {
      return "Life is made of small everyday things: a trip to the market, a chat with a friend, a meal at home. " + t + " is one of those things. When we stop and pay attention, an ordinary day feels richer. Trying something new, meeting someone, or learning one more word in English can turn a routine day into a good one.";
    } else if (lvl === "B1") {
      return "People talk about " + t + " more often than we might think. It comes up in everyday choices: how we spend our time, how we balance work and rest, and how we talk to the people around us. There is no single right answer, but a little planning and a calm mind usually help. Learning to handle it well is part of growing, both in life and in language.";
    } else if (lvl === "B2") {
      return "Daily life keeps bringing us back to " + t + ", even when we do not notice. It shows up in the routines we follow, the decisions we make, and the way we adapt when things change. Taking a closer look helps us see the habits and pressures behind it. With honest reflection and steady effort, we can turn even an ordinary concern into a chance to improve.";
    } else if (lvl === "C1") {
      return "It is easy to treat " + t + " as a distant idea, yet it shapes how people actually live and work. It influences choices, habits, and the way institutions and individuals respond to change. Understanding it means looking past surface impressions and noticing the patterns underneath. Such thinking is demanding, but it is also what makes daily experience clearer and more meaningful.";
    } else {
      return "It is easy to see " + t + " as something far from ordinary life, but it is closer than it looks. It shapes routines, expectations, and the quiet assumptions people rarely stop to question. A serious look at it means moving beyond slogans and examining the structures that hold it together. This kind of reflection is uncomfortable, yet it is precisely what turns daily experience into real understanding.";
    }
  }

  function getArticleThai(lvl, topic, n) {
    if (lvl === "A1") {
      return "ทุกๆ วันเต็มไปด้วยช่วงเวลาสำคัญเล็กๆ น้อยๆ เช่น แสงแดดยามเช้า อาหารอุ่นๆ และเวลากับครอบครัวและเพื่อนฝูง " + topic + " เป็นส่วนหนึ่งของชีวิตประจำวันอันเรียบง่ายนั้น เมื่อเราสังเกตเห็นสิ่งเล็กๆ เหล่านี้ วันของเราก็สดใสขึ้น การเรียนภาษาอังกฤษช่วยให้เราพูดคุยเกี่ยวกับโลกของเราและแบ่งปันกับผู้คนมากขึ้น";
    } else if (lvl === "A2") {
      return "ชีวิตประกอบด้วยสิ่งเล็กๆ ในชีวิตประจำวัน เช่น การไปตลาด การพูดคุยกับเพื่อน และการทานอาหารที่บ้าน " + topic + " ก็เป็นหนึ่งในสิ่งเหล่านั้น เมื่อเราหยุดและใส่ใจ วันธรรมดาๆ ก็ดูมีคุณค่ามากขึ้น การลองสิ่งใหม่ๆ เจอคนใหม่ๆ หรือเรียนรู้คำศัพท์ภาษาอังกฤษเพิ่มอีกหนึ่งคำ ก็ทำให้วันซ้ำซากกลายเป็นวันที่ดีได้";
    } else if (lvl === "B1") {
      return "ผู้คนพูดถึง " + topic + " บ่อยกว่าที่เราคิด มันปรากฏขึ้นในการตัดสินใจในชีวิตประจำวัน เช่น วิธีใช้เวลา วิธีถ่วงดุลระหว่างงานกับเวลาพัก และวิธีพูดคุยกับคนรอบข้าง ไม่มีคำตอบเดียวที่ถูกต้อง แต่การวางแผนเล็กๆ น้อยๆ และจิตใจที่สงบมักช่วยได้ การเรียนรู้ที่จะรับมือกับมันได้ดีเป็นส่วนหนึ่งของการเติบโต ทั้งในชีวิตและในภาษา";
    } else if (lvl === "B2") {
      return "ชีวิตประจำวันพาเรากลับมาสู่ " + topic + " อยู่เสมอ แม้บางครั้งเราไม่ทันสังเกต มันปรากฏในกิจวัตรที่เราทำ การตัดสินใจที่เราเลือก และวิธีที่เราปรับตัวเมื่อสิ่งต่างๆ เปลี่ยนไป การมองให้ลึกลงไปช่วยให้เราเห็นนิสัยและแรงกดดันที่อยู่เบื้องหลัง ด้วยการไตร่ตรองอย่างจริงใจและความพยายามอย่างต่อเนื่อง เราสามารถเปลี่ยนแม้แต่ความกังวลธรรมดาๆ ให้เป็นโอกาสในการพัฒนาตนเอง";
    } else if (lvl === "C1") {
      return "เราอาจมองว่า " + topic + " เป็นแนวคิดที่ไกลตัว แต่จริงๆ แล้วมันหล่อหลอมการดำเนินชีวิตและการทำงานของผู้คนทุกวัน มันมีอิทธิพลต่อทางเลือก นิสัย และวิธีที่องค์กรและปัจเจกบุคคลตอบสนองต่อการเปลี่ยนแปลง การจะเข้าใจมันต้องมองข้ามภาพภายนอกและสังเกตแบบแผนที่ซ่อนอยู่เบื้องหลัง การคิดแบบนี้ต้องใช้ความพยายาม แต่ก็ทำให้ประสบการณ์ในชีวิตประจำวันชัดเจนและมีความหมายมากขึ้น";
    } else {
      return "เรามักมองว่า " + topic + " เป็นสิ่งที่ไกลจากชีวิตธรรมดา แต่จริงๆ แล้วมันอยู่ใกล้กว่าที่คิด มันหล่อหลอมกิจวัตร ความคาดหวัง และสมมติฐานเงียบๆ ที่ผู้คนไม่ค่อยหยุดตั้งคำถาม การมองอย่างจริงจังหมายถึงการก้าวข้ามคำขวัญและพิจารณาโครงสร้างที่ยึดมันไว้ด้วยกัน การไตร่ตรองแบบนี้อาจไม่สบายใจ แต่ก็คือสิ่งที่เปลี่ยนประสบการณ์ในชีวิตประจำวันให้กลายเป็นความเข้าใจที่แท้จริง";
    }
  }

  const COMMON_TH_DICT = {
    "this": { th: "นี้ / นี่", pos: "pronoun", phonetic: "ðɪs" },
    "is": { th: "คือ / เป็น / อยู่", pos: "verb", phonetic: "ɪz" },
    "a": { th: "หนึ่ง / อัน / ตัว", pos: "determiner", phonetic: "ə" },
    "short": { th: "สั้น / ต่ำ", pos: "adjective", phonetic: "ʃɔːrt" },
    "story": { th: "เรื่องเล่า / นิทาน", pos: "noun", phonetic: "ˈstɔːri" },
    "about": { th: "เกี่ยวกับ", pos: "preposition", phonetic: "əˈbaʊt" },
    "every": { th: "ทุกๆ", pos: "adjective", phonetic: "ˈevri" },
    "day": { th: "วัน", pos: "noun", phonetic: "deɪ" },
    "we": { th: "พวกเรา", pos: "pronoun", phonetic: "wiː" },
    "learn": { th: "เรียนรู้", pos: "verb", phonetic: "lɜːrn" },
    "new": { th: "ใหม่", pos: "adjective", phonetic: "nuː" },
    "things": { th: "สิ่งของ / เรื่องราว", pos: "noun", phonetic: "θɪŋz" },
    "practice": { th: "ฝึกฝน", pos: "verb/noun", phonetic: "ˈpræktɪs" },
    "english": { th: "ภาษาอังกฤษ", pos: "noun", phonetic: "ˈɪŋɡlɪʃ" },
    "vocabulary": { th: "คำศัพท์", pos: "noun", phonetic: "vəˈkæbjuleri" },
    "the": { th: "(คำนำหน้านามชี้เฉพาะ)", pos: "article", phonetic: "ðiː" },
    "sun": { th: "ดวงอาทิตย์", pos: "noun", phonetic: "sʌn" },
    "shines": { th: "ส่องแสง", pos: "verb", phonetic: "ʃaɪnz" },
    "brightly": { th: "อย่างสว่างสดใส", pos: "adverb", phonetic: "ˈbraɪtli" },
    "and": { th: "และ", pos: "conjunction", phonetic: "ænd" },
    "people": { th: "ผู้คน", pos: "noun", phonetic: "ˈpiːpl" },
    "are": { th: "คือ / เป็น / อยู่", pos: "verb", phonetic: "ɑːr" },
    "happy": { th: "มีความสุข", pos: "adjective", phonetic: "ˈhæpi" },
    "read": { th: "อ่าน", pos: "verb", phonetic: "riːd" },
    "books": { th: "หนังสือ", pos: "noun", phonetic: "bʊks" },
    "talk": { th: "พูดคุย", pos: "verb", phonetic: "tɔːk" },
    "with": { th: "กับ", pos: "preposition", phonetic: "wɪð" },
    "friends": { th: "เพื่อน", pos: "noun", phonetic: "frendz" },
    "enjoy": { th: "เพลิดเพลิน", pos: "verb", phonetic: "ɪnˈdʒɔɪ" },
    "our": { th: "ของพวกเรา", pos: "pronoun", phonetic: "ˈaʊər" },
    "simple": { th: "เรียบง่าย", pos: "adjective", phonetic: "ˈsɪmpl" },
    "daily": { th: "ประจำวัน", pos: "adjective", phonetic: "ˈdeɪli" },
    "life": { th: "ชีวิต", pos: "noun", phonetic: "laɪf" },
    "learning": { th: "การเรียนรู้", pos: "noun", phonetic: "ˈlɜːrnɪŋ" },
    "wonderful": { th: "ยอดเยี่ยม", pos: "adjective", phonetic: "ˈwʌndərfʊl" },
    "helps": { th: "ช่วยเหลือ", pos: "verb", phonetic: "helps" },
    "us": { th: "พวกเรา (กรรม)", pos: "pronoun", phonetic: "ʌs" },
    "grow": { th: "เติบโต", pos: "verb", phonetic: "ɡroʊ" },
    "single": { th: "เดี่ยว / แต่ละ", pos: "adjective", phonetic: "ˈsɪŋɡl" },
    "today": { th: "วันนี้", pos: "noun/adverb", phonetic: "təˈdeɪ" },
    "explore": { th: "สำรวจ", pos: "verb", phonetic: "ɪkˈsplɔːr" },
    "fascinating": { th: "น่าหลงใหล", pos: "adjective", phonetic: "ˈfæsɪneɪtɪŋ" },
    "theme": { th: "หัวข้อ / ธีม", pos: "noun", phonetic: "θiːm" },
    "presents": { th: "นำเสนอ", pos: "verb", phonetic: "prɪˈzents" },
    "various": { th: "หลากหลาย", pos: "adjective", phonetic: "ˈveriəs" },
    "opportunities": { th: "โอกาส", pos: "noun", phonetic: "ˌɑːpərˈtuːnətiz" },
    "discover": { th: "ค้นพบ", pos: "verb", phonetic: "dɪˈskʌvər" },
    "places": { th: "สถานที่", pos: "noun", phonetic: "ˈpleɪsɪz" },
    "meet": { th: "พบปะ", pos: "verb", phonetic: "miːt" },
    "interesting": { th: "น่าสนใจ", pos: "adjective", phonetic: "ˈɪntrəstɪŋ" },
    "gain": { th: "ได้รับ", pos: "verb", phonetic: "ɡeɪn" },
    "valuable": { th: "มีค่า", pos: "adjective", phonetic: "ˈvæljuəbl" },
    "experiences": { th: "ประสบการณ์", pos: "noun", phonetic: "ɪkˈspɪriənsɪz" },
    "through": { th: "ผ่าน", pos: "preposition", phonetic: "θruː" },
    "consistent": { th: "สม่ำเสมอ", pos: "adjective", phonetic: "kənˈsɪstənt" },
    "curiosity": { th: "ความอยากรู้อยากเห็น", pos: "noun", phonetic: "ˌkjʊriˈɑːsəti" },
    "build": { th: "สร้าง", pos: "verb", phonetic: "bɪld" },
    "confidence": { th: "ความมั่นใจ", pos: "noun", phonetic: "ˈkɑːnfɪdəns" },
    "improve": { th: "พัฒนา", pos: "verb", phonetic: "ɪmˈpruːv" },
    "skills": { th: "ทักษะ", pos: "noun", phonetic: "skɪlz" },
    "prepare": { th: "เตรียมตัว", pos: "verb", phonetic: "prɪˈper" },
    "exciting": { th: "น่าตื่นเต้น", pos: "adjective", phonetic: "ɪkˈsaɪtɪŋ" },
    "adventures": { th: "การผจญภัย", pos: "noun", phonetic: "ədˈventʃərz" },
    "ahead": { th: "ข้างหน้า", pos: "adverb", phonetic: "əˈhed" },
    "when": { th: "เมื่อ", pos: "conjunction", phonetic: "wen" },
    "considering": { th: "การพิจารณา", pos: "preposition", phonetic: "kənˈsɪdərɪŋ" },
    "individuals": { th: "บุคคล", pos: "noun", phonetic: "ˌɪndɪˈvɪdʒuəlz" },
    "often": { th: "บ่อยครั้ง", pos: "adverb", phonetic: "ˈɔːfn" },
    "encounter": { th: "เผชิญหน้า", pos: "verb", phonetic: "ɪnˈkaʊntər" },
    "diverse": { th: "หลากหลาย", pos: "adjective", phonetic: "daɪˈvɜːrs" },
    "perspectives": { th: "มุมมอง", pos: "noun", phonetic: "pərˈspektɪvz" },
    "challenges": { th: "ความท้าทาย", pos: "noun", phonetic: "ˈtʃælɪndʒɪz" },
    "balancing": { th: "การสร้างความสมดุล", pos: "noun", phonetic: "ˈbælənsɪŋ" },
    "personal": { th: "ส่วนตัว", pos: "adjective", phonetic: "ˈpɜːrsənl" },
    "ambition": { th: "ความทะเยอทะยาน", pos: "noun", phonetic: "æmˈbɪʃn" },
    "responsibilities": { th: "ความรับผิดชอบ", pos: "noun", phonetic: "rɪˌspɑːnsəˈbɪlətiz" },
    "requires": { th: "ต้องการ", pos: "verb", phonetic: "rɪˈkwaɪərz" },
    "dedication": { th: "ความทุ่มเท", pos: "noun", phonetic: "ˌdedɪˈkeɪʃn" },
    "strategic": { th: "เชิงกลยุทธ์", pos: "adjective", phonetic: "strəˈtiːdʒɪk" },
    "planning": { th: "การวางแผน", pos: "noun", phonetic: "ˈplænɪŋ" },
    "continuous": { th: "อย่างต่อเนื่อง", pos: "adjective", phonetic: "kənˈtɪnjuəs" },
    "self-reflection": { th: "การไตร่ตรองตนเอง", pos: "noun", phonetic: "ˌself rɪˈflekʃn" },
    "embracing": { th: "การเปิดรับ", pos: "verb", phonetic: "ɪmˈbreɪsɪŋ" },
    "maintaining": { th: "การรักษา", pos: "verb", phonetic: "meɪnˈteɪnɪŋ" },
    "positive": { th: "เชิงบวก", pos: "adjective", phonetic: "ˈpɑːzətɪv" },
    "mindset": { th: "กรอบความคิด", pos: "noun", phonetic: "ˈmaɪndset" },
    "achieve": { th: "บรรลุ", pos: "verb", phonetic: "əˈtʃiːv" },
    "meaningful": { th: "มีความหมาย", pos: "adjective", phonetic: "ˈmiːnɪŋfʊl" },
    "progress": { th: "ความก้าวหน้า", pos: "noun", phonetic: "ˈprɑːɡres" },
    "fulfillment": { th: "ความสมบูรณ์ในชีวิต", pos: "noun", phonetic: "fʊlˈfɪlmənt" },
    "complexities": { th: "ความซับซ้อน", pos: "noun", phonetic: "kəmˈpleksətiz" },
    "surrounding": { th: "รอบๆ", pos: "adjective", phonetic: "səˈraʊndɪŋ" },
    "demand": { th: "เรียกร้อง", pos: "verb/noun", phonetic: "dɪˈmænd" },
    "rigorous": { th: "อย่างเข้มงวด", pos: "adjective", phonetic: "ˈrɪɡərəs" },
    "analysis": { th: "การวิเคราะห์", pos: "noun", phonetic: "əˈnæləsɪs" },
    "comprehensive": { th: "ครอบคลุม", pos: "adjective", phonetic: "ˌkɑːmprɪˈhensɪv" },
    "understanding": { th: "ความเข้าใจ", pos: "noun", phonetic: "ˌʌndərˈstændɪŋ" },
    "modern": { th: "สมัยใหม่", pos: "adjective", phonetic: "ˈmɑːdərn" },
    "society": { th: "สังคม", pos: "noun", phonetic: "səˈsaɪəti" },
    "navigates": { th: "นำทาง", pos: "verb", phonetic: "ˈnævɪɡeɪts" },
    "rapid": { th: "รวดเร็ว", pos: "adjective", phonetic: "ˈræpɪd" },
    "transformations": { th: "การเปลี่ยนแปลง", pos: "noun", phonetic: "ˌtrænsfərˈmeɪʃnz" },
    "across": { th: "ข้าม / ทั่ว", pos: "preposition", phonetic: "əˈkrɔːs" },
    "technological": { th: "เชิงเทคโนโลยี", pos: "adjective", phonetic: "ˌteknəˈlɑːdʒɪkl" },
    "economic": { th: "ทางเศรษฐกิจ", pos: "adjective", phonetic: "ˌiːkəˈnɑːmɪk" },
    "cultural": { th: "ทางวัฒนธรรม", pos: "adjective", phonetic: "ˈkʌltʃərəl" },
    "domains": { th: "โดเมน / ด้าน", pos: "noun", phonetic: "doʊˈmeɪnz" },
    "stakeholders": { th: "ผู้มีส่วนเกี่ยวข้อง", pos: "noun", phonetic: "ˈsteɪkhoʊldərz" },
    "must": { th: "ต้อง", pos: "verb", phonetic: "mʌst" },
    "evaluate": { th: "ประเมิน", pos: "verb", phonetic: "ɪˈvæljueɪt" },
    "systemic": { th: "เชิงระบบ", pos: "adjective", phonetic: "sɪˈstemɪk" },
    "impacts": { th: "ผลกระทบ", pos: "noun", phonetic: "ˈɪmpækts" },
    "foster": { th: "ส่งเสริม", pos: "verb", phonetic: "ˈfɑːstər" },
    "collaborative": { th: "แบบร่วมมือ", pos: "adjective", phonetic: "kəˈlæbərətɪv" },
    "innovations": { th: "นวัตกรรม", pos: "noun", phonetic: "ˌɪnəˈveɪʃnz" },
    "implement": { th: "ดำเนินการ", pos: "verb", phonetic: "ˈɪmplɪment" },
    "sustainable": { th: "ยั่งยืน", pos: "adjective", phonetic: "səˈsteɪnəbl" },
    "strategies": { th: "กลยุทธ์", pos: "noun", phonetic: "ˈstrætədʒiz" },
    "address": { th: "จัดการ / แก้ไข", pos: "verb", phonetic: "əˈdres" },
    "contemporary": { th: "ร่วมสมัย", pos: "adjective", phonetic: "kənˈtempəreri" },
    "effectively": { th: "อย่างมีประสิทธิภาพ", pos: "adverb", phonetic: "ɪˈfektɪvli" },
    "in-depth": { th: "เชิงลึก", pos: "adjective", phonetic: "ɪn depθ" },
    "examination": { th: "การตรวจสอบ", pos: "noun", phonetic: "ɪɡˌzæmɪˈneɪʃn" },
    "reveals": { th: "เผยให้เห็น", pos: "verb", phonetic: "rɪˈviːlz" },
    "profound": { th: "ลึกซึ้ง", pos: "adjective", phonetic: "prəˈfaʊnd" },
    "epistemological": { th: "ทางญาณวิทยา", pos: "adjective", phonetic: "ɪˌpɪstɪməˈlɑːdʒɪkl" },
    "structural": { th: "เชิงโครงสร้าง", pos: "adjective", phonetic: "ˈstrʌktʃərəl" },
    "dynamics": { th: "พลวัต", pos: "noun", phonetic: "daɪˈnæmɪks" },
    "paradigms": { th: "กระบวนทัศน์", pos: "noun", phonetic: "ˈpærədaɪmz" },
    "necessitate": { th: "เรียกร้อง", pos: "verb", phonetic: "nəˈsesɪteɪt" },
    "critical": { th: "เชิงวิพากษ์", pos: "adjective", phonetic: "ˈkrɪtɪkl" },
    "discourse": { th: "การอภิปราย", pos: "noun", phonetic: "ˈdɪskɔːrs" },
    "sophisticated": { th: "ซับซ้อน / ละเมียดละไม", pos: "adjective", phonetic: "səˈfɪstɪkeɪtɪd" },
    "methodological": { th: "ระเบียบวิธี", pos: "adjective", phonetic: "ˌmeθədəˈlɑːdʒɪkl" },
    "frameworks": { th: "กรอบ", pos: "noun", phonetic: "ˈfreɪmwɜːrks" },
    "nuanced": { th: "มีความละเมียดละไม", pos: "adjective", phonetic: "ˈnuːɑːnst" },
    "interdisciplinary": { th: "ข้ามสาขาวิชา", pos: "adjective", phonetic: "ˌɪntərdɪsəˈplɪneri" },
    "inquiry": { th: "การสอบถาม", pos: "noun", phonetic: "ɪnˈkwaɪri" },
    "intellectual": { th: "ทางปัญญา", pos: "adjective", phonetic: "ˌɪntəˈlektʃuəl" },
    "rigor": { th: "ความเข้มงวด", pos: "noun", phonetic: "ˈrɪɡər" },
    "foresight": { th: "การมองการณ์ไกล", pos: "noun", phonetic: "ˈfɔːrsaɪt" },
    "remain": { th: "คงอยู่", pos: "verb", phonetic: "rɪˈmeɪn" },
    "paramount": { th: "สำคัญที่สุด", pos: "adjective", phonetic: "ˈpærəmaʊnt" },
    "multifaceted": { th: "หลากหลายมิติ", pos: "adjective", phonetic: "ˌʌltiˈfæsɪtɪd" },
    "global": { th: "ระดับโลก", pos: "adjective", phonetic: "ˈɡloʊbl" },
    "phenomena": { th: "ปรากฏการณ์", pos: "noun", phonetic: "fəˈnɑːmənə" },
    "institutional": { th: "สถาบัน", pos: "adjective", phonetic: "ˌɪnstɪˈtuːʃənl" },
    "evolution": { th: "วิวัฒนาการ", pos: "noun", phonetic: "ˌevəˈluːʃn" },
    "ontological": { th: "เชิงอภิปรัชญา", pos: "adjective", phonetic: "ˌɑːntəˈlɑːdʒɪkl" },
    "metatheoretical": { th: "เมทาทฤษฎี", pos: "adjective", phonetic: "ˌmetəˌθiːəˈretɪkl" },
    "unveils": { th: "เผยให้เห็น", pos: "verb", phonetic: "ʌnˈveɪlz" },
    "intricate": { th: "ซับซ้อน", pos: "adjective", phonetic: "ˈɪntrɪkət" },
    "webs": { th: "เครือข่าย", pos: "noun", phonetic: "webz" },
    "conceptual": { th: "เชิงแนวคิด", pos: "adjective", phonetic: "kənˈseptʃuəl" },
    "presuppositions": { th: "ข้อสมมติฐาน", pos: "noun", phonetic: "ˌpriːsʌpəˈzɪʃnz" },
    "transcendental": { th: "เหนือประสบการณ์", pos: "adjective", phonetic: "ˌtrænsenˈdentl" },
    "reflection": { th: "การสะท้อน", pos: "noun", phonetic: "rɪˈflekʃn" },
    "deconstructive": { th: "แบบรื้อสร้าง", pos: "adjective", phonetic: "ˌdiːkənˈstrʌktɪv" },
    "challenge": { th: "ท้าทาย", pos: "verb/noun", phonetic: "ˈtʃælɪndʒ" },
    "foundational": { th: "รากฐาน", pos: "adjective", phonetic: "faʊnˈdeɪʃnl" },
    "dogmas": { th: "หลักคำสอน", pos: "noun", phonetic: "ˈdɔːɡməz" },
    "compelling": { th: "น่าสนใจ / บังคับ", pos: "adjective", phonetic: "kəmˈpelɪŋ" },
    "radical": { th: "รากฐาน / หัวรุนแรง", pos: "adjective", phonetic: "ˈrædɪkl" },
    "reconfiguration": { th: "การกำหนดค่าใหม่", pos: "noun", phonetic: "riːkənˌfɪɡəˈreɪʃn" },
    "theoretical": { th: "ทางทฤษฎี", pos: "adjective", phonetic: "ˌθiːəˈretɪkl" },
    "intersubjective": { th: "ระหว่างอัตวิสัย", pos: "adjective", phonetic: "ˌɪntərˈsʌbdʒektɪv" },
    "realities": { th: "ความเป็นจริง", pos: "noun", phonetic: "riˈælətiz" },
    "limits": { th: "ขีดจำกัด", pos: "noun", phonetic: "ˈlɪmɪts" },
    "human": { th: "มนุษย์", pos: "noun/adjective", phonetic: "ˈhjuːmən" },
    "cognition": { th: "การรับรู้", pos: "noun", phonetic: "kɑːɡˈnɪʃn" },
    "to": { th: "ไปยัง / เพื่อ", pos: "preposition", phonetic: "tuː" },
    "in": { th: "ใน", pos: "preposition", phonetic: "ɪn" },
    "on": { th: "บน", pos: "preposition", phonetic: "ɑːn" },
    "at": { th: "ที่", pos: "preposition", phonetic: "æt" },
    "for": { th: "สำหรับ", pos: "preposition", phonetic: "fɔːr" },
    "of": { th: "ของ", pos: "preposition", phonetic: "ʌv" },
    "by": { th: "โดย", pos: "preposition", phonetic: "baɪ" },
    "from": { th: "จาก", pos: "preposition", phonetic: "frʌm" },
    "as": { th: "ในฐานะ / เป็น", pos: "conjunction", phonetic: "æz" },
    "that": { th: "ว่า / ที่ / นั้น", pos: "pronoun/conjunction", phonetic: "ðæt" },
    "it": { th: "มัน", pos: "pronoun", phonetic: "ɪt" },
    "they": { th: "พวกเขา", pos: "pronoun", phonetic: "ðeɪ" },
    "he": { th: "เขา", pos: "pronoun", phonetic: "hiː" },
    "she": { th: "เธอ", pos: "pronoun", phonetic: "ʃiː" },
    "her": { th: "ของเธอ", pos: "pronoun", phonetic: "hɜːr" },
    "his": { th: "ของเขา", pos: "pronoun", phonetic: "hɪz" },
    "their": { th: "ของพวกเขา", pos: "pronoun", phonetic: "ðer" },
    "your": { th: "ของคุณ", pos: "pronoun", phonetic: "jʊr" },
    "my": { th: "ของฉัน", pos: "pronoun", phonetic: "maɪ" },
    "i": { th: "ฉัน", pos: "pronoun", phonetic: "aɪ" },
    "you": { th: "คุณ", pos: "pronoun", phonetic: "juː" },
    "be": { th: "เป็น / อยู่ / คือ", pos: "verb", phonetic: "biː" },
    "have": { th: "มี", pos: "verb", phonetic: "hæv" },
    "do": { th: "ทำ", pos: "verb", phonetic: "duː" },
    "say": { th: "พูด", pos: "verb", phonetic: "seɪ" },
    "get": { th: "ได้รับ", pos: "verb", phonetic: "ɡet" },
    "make": { th: "ทำ / สร้าง", pos: "verb", phonetic: "meɪk" },
    "go": { th: "ไป", pos: "verb", phonetic: "ɡoʊ" },
    "know": { th: "รู้", pos: "verb", phonetic: "noʊ" },
    "take": { th: "เอา / พา", pos: "verb", phonetic: "teɪk" },
    "see": { th: "เห็น", pos: "verb", phonetic: "siː" },
    "come": { th: "มา", pos: "verb", phonetic: "kʌm" },
    "think": { th: "คิด", pos: "verb", phonetic: "θɪŋk" },
    "look": { th: "มอง", pos: "verb", phonetic: "lʊk" },
    "want": { th: "ต้องการ", pos: "verb", phonetic: "wɑːnt" },
    "give": { th: "ให้", pos: "verb", phonetic: "ɡɪv" },
    "use": { th: "ใช้", pos: "verb", phonetic: "juːz" },
    "find": { th: "หา / พบ", pos: "verb", phonetic: "faɪnd" },
    "tell": { th: "บอก", pos: "verb", phonetic: "tel" },
    "ask": { th: "ถาม", pos: "verb", phonetic: "æsk" },
    "work": { th: "ทำงาน", pos: "verb/noun", phonetic: "wɜːrk" },
    "seem": { th: "ดูเหมือน", pos: "verb", phonetic: "siːm" },
    "feel": { th: "รู้สึก", pos: "verb", phonetic: "fiːl" },
    "try": { th: "พยายาม", pos: "verb", phonetic: "traɪ" },
    "leave": { th: "ออกจาก", pos: "verb", phonetic: "liːv" },
    "call": { th: "เรียก", pos: "verb", phonetic: "kɔːl" }
  };

  function guessPartOfSpeech(w) {
    if (w.endsWith("ly")) return "adverb";
    if (w.endsWith("ing") || w.endsWith("ed")) return "verb";
    if (w.endsWith("ion") || w.endsWith("ment") || w.endsWith("ness") || w.endsWith("ity") || w.endsWith("s") || w.endsWith("es")) return "noun";
    if (w.endsWith("ive") || w.endsWith("ous") || w.endsWith("ful") || w.endsWith("less") || w.endsWith("able")) return "adjective";
    return "word";
  }

  function getPosThai(pos) {
    if (pos === "noun") return "คำนาม (Noun)";
    if (pos === "verb") return "คำกริยา (Verb)";
    if (pos === "adjective") return "คำคุณศัพท์ (Adjective)";
    if (pos === "adverb") return "คำกริยาวิเศษณ์ (Adverb)";
    if (pos === "pronoun") return "คำสรรพนาม (Pronoun)";
    if (pos === "preposition") return "คำบุพบท (Preposition)";
    if (pos === "conjunction") return "คำสันธาน (Conjunction)";
    return "คำศัพท์ภาษาอังกฤษ";
  }

  const ALL_STORIES = generateAllStories();
  let currentActiveLevelFilter = "All";
  let currentGenreFilter = "All";
  let currentStory = null;
  let currentStoryScrollHandler = null;

  /* ---------- Curated stories: fairy tales (นิทาน) + ghost stories (เรื่องผี) ----------
     Long stories carry `pages`/`thPages` arrays rendered with the page-flip book reader. */
  const CURATED_STORIES = [
    {
      id: "cur-fairy-boy-cried-wolf", level: "A1", genre: "fairy",
      title: "The Boy Who Cried Wolf",
      pages: [
        "A young shepherd watched his sheep on a green hill. He was bored, so he shouted, 'Wolf! Wolf! The wolf is coming!' The villagers ran to help him. But there was no wolf. They were not happy.",
        "The boy played the same trick again the next day. The villagers ran again, but again there was no wolf. 'Do not lie,' they said. The boy only laughed.",
        "Then one day a real wolf came. The boy shouted, 'Wolf! Wolf! Help!' But this time nobody came. The wolf frightened the sheep, and the boy learned a hard lesson: nobody believes a liar, even when he tells the truth."
      ],
      thPages: [
        "เด็กเลี้ยงแกะหนุ่มเฝ้าดูแลแกะบนเนินเขาสีเขียว เขารู้สึกเบื่อจึงตะโกนว่า 'หมาป่า! หมาป่า! หมาป่ากำลังมา!' ชาวบ้านวิ่งมาช่วยเขา แต่ไม่มีหมาป่าเลย พวกเขาไม่พอใจ",
        "เด็กเล่นกลอุบายเดิมอีกครั้งในวันถัดมา ชาวบ้านวิ่งมาอีก แต่ก็ยังไม่มีหมาป่า 'อย่าโกหก' พวกเขากล่าว เด็กหัวเราะเท่านั้น",
        "แล้ววันหนึ่งหมาป่าตัวจริงก็มา เด็กตะโกนว่า 'หมาป่า! หมาป่า! ช่วยด้วย!' แต่คราวนี้ไม่มีใครมา หมาป่าทำให้แกะตกใจ และเด็กได้เรียนรู้บทเรียนอันยากลำบาก: ไม่มีใครเชื่อคนโกหก แม้เขาจะพูดความจริง"
      ]
    },
    {
      id: "cur-fairy-tortoise-hare", level: "A1", genre: "fairy",
      title: "The Tortoise and the Hare",
      pages: [
        "A fast hare laughed at a slow tortoise. 'You're so slow!' he said. The tortoise just smiled and said, 'Let's have a race, then.' The hare laughed loudly and agreed.",
        "The race started. The hare ran fast and was soon way ahead. He was sure he would win, so he stopped to rest under a big tree and fell asleep.",
        "The tortoise kept walking, slowly but steadily, and never stopped. When the hare woke up, the tortoise was almost at the finish line. The slow and steady tortoise won the race."
      ],
      thPages: [
        "กระต่ายที่วิ่งเร็วหัวเราะเยาะเต่าที่เชื่องช้า 'เจ้าเชื่องช้าจัง!' มันพูด เต่ายิ้มแล้วตอบว่า 'งั้นมาแข่งกันเถอะ' กระต่ายหัวเราะเสียงดังแล้วตกลง",
        "การแข่งขันเริ่มขึ้น กระต่ายวิ่งเร็วมากและนำหน้าไปไกล มันมั่นใจว่าจะชนะ จึงแวะพักใต้ต้นไม้ใหญ่แล้วหลับไป",
        "เต่าเดินต่อไปเรื่อยๆ ช้าๆ แต่สม่ำเสมอ และไม่เคยหยุด เมื่อกระต่ายตื่นขึ้น เต่าก็เกือบถึงเส้นชัยแล้ว เต่าที่ช้าแต่สม่ำเสมอจึงชนะการแข่งขัน"
      ]
    },
    {
      id: "cur-fairy-lion-mouse", level: "A1", genre: "fairy",
      title: "The Lion and the Mouse",
      pages: [
        "A lion was sleeping in the forest when a little mouse ran right over his nose. The lion woke up and caught him. 'Please let me go,' said the mouse. 'One day I'll help you.' The lion laughed at the idea but let him go.",
        "Later, the lion got caught in a hunter's net. He roared and struggled, but he couldn't escape. The little mouse heard his roar and came running. He chewed through the net with his sharp teeth.",
        "The lion was free. 'Thank you, little mouse,' he said. 'You saved my life.' From that day on, the lion and the mouse were friends. Even the smallest friend can be a huge help."
      ],
      thPages: [
        "สิงโตกำลังนอนหลับอยู่ในป่าเมื่อหนูตัวเล็กวิ่งข้ามจมูกของมันพอดี สิงโตตื่นขึ้นและจับหนูได้ 'ได้โปรดปล่อยฉันเถอะ' หนูพูด 'สักวันหนึ่งฉันจะช่วยคุณ' สิงโตหัวเราะกับความคิดนั้นแต่ก็ปล่อยหนูไป",
        "ต่อมา สิงโตติดตาข่ายของนายพราน มันคำรามและดิ้นรน แต่ก็หนีไม่พ้น หนูตัวเล็กได้ยินเสียงคำรามของสิงโตจึงวิ่งมา มันแทะตาข่ายด้วยฟันอันแหลมคม",
        "สิงโตเป็นอิสระ 'ขอบใจมากนะหนูน้อย' มันพูด 'เจ้าช่วยชีวิตฉันไว้' ตั้งแต่วันนั้นเป็นต้นมา สิงโตกับหนูก็เป็นเพื่อนกัน แม้แต่เพื่อนที่ตัวเล็กที่สุดก็ช่วยได้มหาศาล"
      ]
    },
    {
      id: "cur-fairy-cinderella", level: "A2", genre: "fairy",
      title: "Cinderella",
      pages: [
        "Cinderella lived with her cruel stepmother and two stepsisters. They made her do all the housework while they wore beautiful clothes. Cinderella was kind, but she was sad and tired.",
        "One day the king invited every young woman to a grand ball at the palace. The stepsisters were thrilled, but they told Cinderella she couldn't go. She had no dress and far too much work to do.",
        "Suddenly a kind fairy appeared. She waved her magic wand and turned a pumpkin into a golden carriage. She gave Cinderella a beautiful glass slipper, and she smiled: 'But you must leave the ball before midnight.'",
        "At the ball, Cinderella danced with the prince all night. She was the most beautiful woman there. But at midnight the clock began to strike, and she ran away, losing one glass slipper on the stairs.",
        "The prince searched the whole kingdom for the girl who fit the slipper. It fitted only Cinderella. The prince married her, and they lived happily ever after."
      ],
      thPages: [
        "ซินเดอเรลล่าอาศัยอยู่กับแม่เลี้ยงที่โหดร้ายและพี่สาวเลี้ยงสองคน พวกเธอบังคับให้เธอทำงานบ้านทั้งหมด ขณะที่ตัวเองสวมเสื้อผ้าสวยๆ ซินเดอเรลล่าเป็นคนใจดี แต่เธอเศร้าและเหนื่อยมาก",
        "วันหนึ่งกษัตริย์เชิญหญิงสาวทุกคนไปงานบอลใหญ่ที่พระราชวัง พี่สาวเลี้ยงดีใจสุดขีด แต่พวกเธอบอกว่าซินเดอเรลล่าไปไม่ได้ เพราะเธอไม่มีชุดและมีงานล้นมือ",
        "ทันใดนั้นนางฟ้าผู้ใจดีก็ปรากฏตัว นางโบกไม้กายสิทธิ์เปลี่ยนฟักทองเป็นรถม้าสีทอง และมอบรองเท้าแก้วแสนสวยให้ซินเดอเรลล่าพร้อมกับยิ้มว่า 'แต่เจ้าต้องกลับก่อนเที่ยงคืน'",
        "ในงานบอล ซินเดอเรลล่าเต้นรำกับเจ้าชายตลอดทั้งคืน เธอสวยที่สุดในงาน แต่เมื่อเที่ยงคืนนาฬิกาเริ่มตี เธอจึงวิ่งหนีไป และทำรองเท้าแก้วหายหนึ่งข้างบนบันได",
        "เจ้าชายค้นหาทั่วราชอาณาจักรเพื่อหาหญิงสาวที่ใส่รองเท้าแก้วได้ รองเท้าเข้ากับซินเดอเรลล่าเท่านั้น เจ้าชายแต่งงานกับเธอ และทั้งสองก็ใช้ชีวิตอย่างมีความสุขตลอดไป"
      ]
    },
    {
      id: "cur-ghost-haunted-house", level: "A2", genre: "ghost",
      title: "The Haunted House",
      pages: [
        "At the end of the village road stood an old, empty house. Nobody had lived there for years. People said strange things happened at night: lights turned on by themselves, and cold whispers in the dark.",
        "A curious boy named Tom wanted to see for himself. One evening he pushed open the creaking door and stepped inside. Dust covered everything, and the air was freezing cold.",
        "Suddenly a soft voice whispered, 'Please... find my key...' Tom looked around and found a rusty key on the floor. He placed it on the old table. A warm light filled the room, and the voice said, 'Thank you.' The house was calm from that night on."
      ],
      thPages: [
        "ที่ปลายถนนหมู่บ้านมีบ้านเก่าและว่างเปล่าตั้งอยู่ ไม่มีใครอาศัยมาหลายปี ผู้คนเล่าว่ามีสิ่งแปลกประหลาดเกิดขึ้นในตอนกลางคืน: ไฟเปิดขึ้นเอง และเสียงกระซิบหนาวเย็นในความมืด",
        "เด็กชายผู้อยากรู้อยากเห็นชื่อทอมอยากพิสูจน์ด้วยตัวเอง เย็นวันหนึ่งเขาผลักประตูที่ลั่นดังเอี๊ยดแล้วก้าวเข้าไปข้างใน ฝุ่นปกคลุมทุกสิ่ง และอากาศเย็นเยือก",
        "ทันใดนั้นเสียงแผ่วเบาก็กระซิบว่า 'ช่วย... หากุญแจของฉันให้เจอ...' ทอมมองไปรอบๆ และพบกุญแจสนิมบนพื้น เขาวางไว้บนโต๊ะเก่า แสงอบอุ่นสว่างเต็มห้อง และเสียงนั้นพูดว่า 'ขอบใจ' บ้านก็สงบตั้งแต่วันนั้นเป็นต้นมา"
      ]
    },
    {
      id: "cur-ghost-vanishing", level: "B1", genre: "ghost",
      title: "The Vanishing Hitchhiker",
      pages: [
        "It was a dark, rainy night on the highway. A young driver named Dan saw a woman standing by the road in a white coat. She looked cold and tired, so he pulled over and offered her a ride.",
        "She got in and thanked him quietly. Dan asked where she was going, but she only pointed ahead. 'Do you live around here?' he asked. She didn't answer. Dan felt a strange chill.",
        "When they reached the next town, the woman said, 'Turn left at the old church, please.' Dan did, and when he looked again, she was gone. The door was still closed, and the seat beside him was empty.",
        "Frightened, Dan went to the church and told the priest. The priest sighed. 'She was my daughter,' he said. 'She disappeared on this road twenty years ago, on a rainy night just like this. You're the third person to bring her home.'"
      ],
      thPages: [
        "เป็นคืนที่มืดและฝนตกบนทางหลวง คนขับหนุ่มชื่อแดนเห็นหญิงสาวยืนอยู่ข้างถนนในเสื้อคลุมสีขาว เธอดูหนาวและเหนื่อย เขาจึงจอดข้างทางและชวนเธอขึ้นรถ",
        "เธอขึ้นรถและขอบคุณอย่างเงียบๆ แดนถามว่าเธอจะไปไหน แต่เธอเพียงชี้ไปข้างหน้า 'คุณอยู่แถวนี้หรือ?' เขาถาม เธอไม่ตอบ แดนรู้สึกหนาวเยือกแปลกๆ",
        "เมื่อถึงเมืองถัดไป หญิงสาวพูดว่า 'เลี้ยวซ้ายที่โบสถ์เก่าได้โปรด' แดนทำตาม และเมื่อเขามองอีกครั้ง เธอก็หายไปแล้ว ประตูยังปิดอยู่ และที่นั่งข้างๆ เขาว่างเปล่า",
        "แดนตกใจจึงไปที่โบสถ์และเล่าให้บาทหลวงฟัง บาทหลวงถอนหายใจ 'เธอคือลูกสาวของฉัน' เขากล่าว 'เธอหายไปบนถนนสายนี้เมื่อยี่สิบปีก่อน ในคืนที่ฝนตกแบบนี้ คุณเป็นคนที่สามที่พาเธอกลับบ้าน'"
      ]
    },
    {
      id: "cur-ghost-tell-tale", level: "B1", genre: "ghost",
      title: "The Tell-Tale Heart",
      pages: [
        "I loved the old man. He had done nothing wrong. But his eye was pale blue, like the eye of a vulture, and it made my blood run cold. At last I decided to take the old man's life and free myself of that eye forever.",
        "Every night for a week I opened his door, very slowly, and shone a single ray of light onto that vulture eye. When it was closed, I left. But on the eighth night, the eye was open. My rage and fear grew. I heard a low, dull sound — the beating of his heart.",
        "I rushed at him and smothered him in one moment. The beating stopped. I hid his body beneath the floorboards and cleaned every trace of blood. 'Who would suspect anything?' I thought. I was calm and clever.",
        "Then the police came. I smiled and invited them in. I was sure of my plan. But soon I began to hear a faint sound — a low, dull beating. It grew louder and louder under the floor. The officers chatted calmly, but I could not stand it.",
        "I tore up the boards and shouted, 'I admit the deed! It is the beating of his hideous heart!' The sound had come from my own guilt, and it had betrayed me."
      ],
      thPages: [
        "ฉันรักชายชราคนนั้น เขาไม่ได้ทำผิดอะไร แต่ดวงตาของเขาสีฟ้าจางเหมือนตาของนกแร้ง และมันทำให้เลือดของฉันเย็นฉ่ำ ในที่สุดฉันตัดสินใจจะเอาชีวิตชายชราเพื่อปลดปล่อยตัวเองจากตานั้นให้สิ้นซาก",
        "ทุกคืนเป็นเวลาหนึ่งสัปดาห์ ฉันเปิดประตูห้องเขาอย่างช้าๆ และส่องแสงเพียงเส้นเดียวไปที่ตานกแร้งนั้น เมื่อมันหลับตาฉันก็จากไป แต่ในคืนที่แปด ตานั้นเปิดอยู่ ความโกรธและความกลัวของฉันเพิ่มขึ้น ฉันได้ยินเสียงทึบต่ำ — เสียงหัวใจเต้นของเขา",
        "ฉันพุ่งเข้าไปหาเขาและกดปิดปากเขาในชั่วพริบตา เสียงเต้นหยุดลง ฉันซ่อนศพของเขาไว้ใต้พื้นไม้และล้างร่องรอยเลือดทุกจุด 'ใครจะมาสงสัย' ฉันคิด ฉันสงบและฉลาด",
        "แล้วตำรวจก็มา ฉันยิ้มและเชิญพวกเขาเข้ามา ฉันมั่นใจในแผนของฉัน แต่ไม่นานฉันก็เริ่มได้ยินเสียงอู้อี้ — เสียงเต้นทึบต่ำ มันดังขึ้นเรื่อยๆ ใต้พื้น เจ้าหน้าที่พูดคุยอย่างสงบ แต่ฉันทนไม่ไหว",
        "ฉันฉีกแผ่นไม้ขึ้นและตะโกนว่า 'ฉันยอมรับว่าทำลงไป! มันคือเสียงหัวใจอันน่ากลัวของเขา!' เสียงนั้นมาจากความผิดของฉันเอง และมันทรยศฉัน"
      ]
    },
    {
      id: "cur-ghost-whisper-walls", level: "B2", genre: "ghost",
      title: "The Whispers Behind the Wall",
      pages: [
        "Maya moved into an old apartment in the city center. The rent was cheap, and the room was beautiful. There was only one strange thing: every night at exactly three in the morning, she heard soft whispers coming from behind the wall.",
        "At first she thought it was the neighbors. But the wall led to a narrow, empty hallway. Maya pressed her ear to the plaster and listened. The whispers spoke her name. 'Maya... Maya... come closer...'",
        "She asked the landlord about the wall. His face turned pale. 'Nobody has lived in that room for years,' he said quietly. 'They bricked it up after the accident.' He refused to say anything more.",
        "That night, Maya couldn't sleep. At three o'clock the whispers returned. This time, she felt a cold wind through the cracks, and she saw a thin line of light glowing between the bricks. Her hands trembled as she touched the wall.",
        "The next morning, a worker came to tear down the wall. Behind it, they found an old diary and a silver locket. The diary's last page read: 'If you can hear me, I am still here. Please let me out.' Maya opened the locket — inside was a photo of a woman who looked exactly like her."
      ],
      thPages: [
        "มายาย้ายเข้าไปในอพาร์ตเมนต์เก่าใจกลางเมือง ค่าเช่าถูกและห้องก็สวยงาม มีเพียงสิ่งแปลกประหลาดอย่างเดียว: ทุกคืนตอนตีสามพอดี เธอได้ยินเสียงกระซิบแผ่วเบามาจากหลังกำแพง",
        "ตอนแรกเธอคิดว่าเป็นเพื่อนบ้าน แต่กำแพงนั้นอยู่ติดกับทางเดินแคบๆ ที่ว่างเปล่า มายาแนบหูเข้ากับปูนแล้วฟัง เสียงกระซิบเรียกชื่อเธอ 'มายา... มายา... เข้ามาใกล้ๆ...'",
        "เธอถามเจ้าของบ้านเกี่ยวกับกำแพงนั้น ใบหน้าของเขาซีด 'ไม่มีใครอาศัยในห้องนั้นมาหลายปีแล้ว' เขาพูดเบาๆ 'พวกเขาปิดด้วยอิฐหลังเกิดอุบัติเหตุ' เขาปฏิเสธที่จะพูดอะไรอีก",
        "คืนนั้นมายานอนไม่หลับ ตีสามเสียงกระซิบก็กลับมา คราวนี้เธอรู้สึกถึงลมหนาวพัดผ่านรอยแตก และเห็นเส้นแสงบางๆ เรืองแสงระหว่างก้อนอิฐ มือของเธอสั่นเทาเมื่อสัมผัสกำแพง",
        "เช้าวันถัดมา คนงานมาเพื่อทลายกำแพง หลังกำแพงพวกเขาพบสมุดบันทึกเก่าและสร้อยเงินจี้ หน้าสุดท้ายของบันทึกเขียนว่า 'ถ้าคุณได้ยินฉัน ฉันยังอยู่ที่นี่ ได้โปรดปล่อยฉันออกมา' มายาเปิดจี้ — ข้างในมีรูปผู้หญิงที่หน้าตาเหมือนเธอเป๊ะ"
      ]
    },
    {
      id: "cur-fairy-three-little-pigs", level: "A1", genre: "fairy",
      title: "The Three Little Pigs",
      pages: [
        "Three little pigs left their mother's house to build homes of their own. The first pig was lazy. He built his house quickly from straw. The second pig was a little more careful, so he built his house from sticks.",
        "The third pig worked the hardest. He built his house from strong red bricks, one by one. He didn't stop until the walls were thick and the roof was firm.",
        "One day a big bad wolf came to the straw house. He knocked and said, 'Little pig, little pig, let me come in!' The pig refused, so the wolf blew the house down. The pig ran to his brother's stick house.",
        "The wolf followed and blew the stick house down too. Both pigs ran as fast as they could to their brother's brick house. The wolf knocked, but the third pig said, 'No, you can't come in!'",
        "The wolf huffed and puffed, but the brick house didn't move. So he climbed onto the roof to come down the chimney. The pigs put a big pot of boiling water in the fireplace.",
        "The wolf came down the chimney and fell straight into the hot pot. He howled, jumped out, and ran away forever. The three little pigs lived safely and happily in their strong brick house."
      ],
      thPages: [
        "ลูกหมูสามตัวออกจากบ้านแม่เพื่อสร้างบ้านของตัวเอง ตัวแรกขี้เกียจ เขาสร้างบ้านจากฟางอย่างรวดเร็ว ตัวที่สองระมัดระวังขึ้นอีกนิด จึงสร้างบ้านจากไม้",
        "ตัวที่สามขยันที่สุด เขาสร้างบ้านจากอิฐแดงที่แข็งแรงทีละก้อน เขาไม่ยอมหยุดจนกว่าผนังจะหนาและหลังคาจะมั่นคง",
        "วันหนึ่งหมาป่าใจร้ายมาที่บ้านฟาง มันเคาะแล้วพูดว่า 'หมูน้อย หมูน้อย ให้ฉันเข้าไปหน่อย!' หมูปฏิเสธ หมาป่าจึงเป่าบ้านพังทลาย หมูวิ่งไปหาพี่ที่บ้านไม้",
        "หมาป่าตามไปและเป่าบ้านไม้พังเช่นกัน หมูสองตัววิ่งเร็วที่สุดเท่าที่จะทำได้ไปที่บ้านอิฐของพี่ชาย หมาป่าเคาะประตู แต่ตัวที่สามพูดว่า 'ไม่ เจ้าเข้าไม่ได้!'",
        "หมาป่าพ่นลมอย่างหนัก แต่บ้านอิฐไม่ขยับ มันจึงปีนขึ้นไปบนหลังคาเพื่อลงมาทางปล่องไฟ หมูทั้งสามวางหม้อน้ำเดือดใบใหญ่ไว้ในเตาผิง",
        "หมาป่าลงมาทางปล่องไฟและตกลงไปในหม้อน้ำเดือดพอดี มันร้องโหยหวน กระโดดออกมาและวิ่งหนีไปตลอดกาล ลูกหมูสามตัวอาศัยอย่างปลอดภัยและมีความสุขในบ้านอิฐที่แข็งแรง"
      ]
    },
    {
      id: "cur-fairy-goldilocks", level: "A1", genre: "fairy",
      title: "Goldilocks and the Three Bears",
      pages: [
        "Once there was a little girl with golden hair. Everyone called her Goldilocks. One morning she walked into the forest and found a small cottage. The door was open, so she went inside.",
        "There were three bowls of porridge on the table. She tasted the first bowl, but it was too hot. She tasted the second bowl, but it was too cold. The third bowl was just right, so she ate it all.",
        "Then she saw three chairs. The first chair was too big, and the second chair was too wide. The third chair was just right, but it broke under her!",
        "Goldilocks was tired, so she went upstairs. There were three beds. The first was too hard and the second was too soft. The third bed was just right, and she fell asleep at once.",
        "Soon the three bears came home. 'Someone ate my porridge!' said the big bear. 'Someone ate my porridge!' said the middle bear. 'Someone ate mine too!' cried the little bear.",
        "The little bear found Goldilocks sleeping in his bed. She woke up, saw the three bears, and jumped out of the window. She ran all the way home and never went back to the cottage again."
      ],
      thPages: [
        "กาลครั้งหนึ่งมีเด็กหญิงผมทองตัวน้อย ทุกคนเรียกเธอว่าโกลดิล็อกส์ เช้าวันหนึ่งเธอเดินเข้าไปในป่าและพบกระท่อมเล็กๆ ประตูเปิดอยู่ เธอจึงเดินเข้าไป",
        "บนโต๊ะมีโจ๊กสามชาม เธอชิมชามแรก แต่มันร้อนเกินไป เธอชิมชามที่สอง แต่มันเย็นเกินไป ชามที่สามพอดี เธอจึงกินหมด",
        "แล้วเธอก็เห็นเก้าอี้สามตัว ตัวแรกใหญ่เกินไป ตัวที่สองกว้างเกินไป ตัวที่สามพอดี แต่มันหักอยู่ใต้ตัวเธอ!",
        "โกลดิล็อกส์เหนื่อยจึงเดินขึ้นไปชั้นบน มีเตียงสามเตียง เตียงแรกแข็งเกินไป เตียงที่สองนุ่มเกินไป เตียงที่สามพอดี และเธอก็หลับไปทันที",
        "ในไม่ช้าหมีสามตัวก็กลับมาบ้าน 'มีคนกินโจ๊กของฉัน!' หมีตัวใหญ่กล่าว 'มีคนกินโจ๊กของฉัน!' หมีตัวกลางกล่าว 'มีคนกินของฉันด้วย!' หมีตัวเล็กร้องขึ้น",
        "หมีตัวเล็กพบโกลดิล็อกส์กำลังนอนหลับบนเตียงของมัน เธอตื่นขึ้น เห็นหมีสามตัว และกระโดดออกจากหน้าต่าง เธอวิ่งกลับบ้านตลอดทางและไม่กลับไปที่กระท่อมอีกเลย"
      ]
    },
    {
      id: "cur-fairy-jack-beanstalk", level: "A2", genre: "fairy",
      title: "Jack and the Beanstalk",
      pages: [
        "Jack lived with his mother in a tiny house. They were very poor, and one day they had no food left. His mother sent Jack to the market to sell their old cow.",
        "On the way, Jack met an old man. The man offered him five magic beans for the cow. Jack agreed and ran home, excited about his treasure.",
        "His mother was furious. 'Beans?! You sold our cow for beans?' She threw them out of the window. That night, a giant beanstalk grew all the way up into the clouds.",
        "Jack climbed the beanstalk the next morning. At the top, he found a giant castle in the sky. He hid behind a door and watched a huge giant count his golden coins.",
        "When the giant fell asleep, Jack grabbed a bag of gold coins and climbed back down. He and his mother were rich. But Jack wanted to explore the castle again, so he climbed up once more.",
        "This time he took a magic hen that laid golden eggs and a magic harp that sang by itself. The giant chased him, but Jack chopped down the beanstalk. The giant fell, and Jack lived happily with his mother forever."
      ],
      thPages: [
        "แจ็คอาศัยอยู่กับแม่ในบ้านหลังเล็ก พวกเขายากจนมาก และวันหนึ่งไม่มีอาหารเหลือเลย แม่จึงส่งแจ็คไปตลาดเพื่อขายวัวแก่ของพวกเขา",
        "ระหว่างทาง แจ็คพบชายชราคนหนึ่ง ชายคนนั้นเสนอถั่ววิเศษห้าเมล็ดแลกกับวัว แจ็คตกลงและวิ่งกลับบ้านอย่างตื่นเต้นกับสมบัติของเขา",
        "แม่ของเขาโกรธมาก 'ถั่ว?! เจ้าขายวัวแลกกับถั่วเหรอ?' เธอโยนถั่วออกไปนอกหน้าต่าง คืนนั้นต้นถั่ววิเศษยักษ์ก็งอกขึ้นไปถึงเมฆ",
        "เช้าวันรุ่งขึ้นแจ็คปีนต้นถั่ว บนยอดเขาเห็นปราสาทยักษ์กลางท้องฟ้า เขาซ่อนอยู่หลังประตูและดูยักษ์ตัวมหึมานับเหรียญทองของมัน",
        "เมื่อยักษ์หลับ แจ็คคว้ากระสอบเหรียญทองและปีนลงมา เขากับแม่กลายเป็นคนรวย แต่แจ็คอยากสำรวจปราสาทอีกครั้ง จึงปีนขึ้นไปอีก",
        "คราวนี้เขาเอาไก่วิเศษที่ออกไข่ทองคำและพิณวิเศษที่ร้องเพลงได้เอง ยักษ์ไล่ตามเขา แต่แจ็คตัดต้นถั่วทิ้ง ยักษ์ตกลงมา และแจ็คก็อยู่กับแม่อย่างมีความสุขตลอดไป"
      ]
    },
    {
      id: "cur-fairy-red-riding-hood", level: "A2", genre: "fairy",
      title: "Little Red Riding Hood",
      pages: [
        "Once there was a sweet little girl who always wore a red riding hood. Everyone in the village called her Little Red Riding Hood. One day her mother packed a basket of cakes and said, 'Take these to Grandma. She is sick.'",
        "Little Red Riding Hood skipped through the forest. On the way she met a big wolf. 'Where are you going, little girl?' asked the wolf. 'To my grandmother's house,' she answered. The wolf smiled and ran ahead.",
        "The wolf reached Grandma's house first. He knocked, and the old woman opened the door. The wolf frightened her, locked her in a cupboard, put on her clothes, and climbed into her bed.",
        "When Little Red Riding Hood arrived, she noticed something strange. 'Grandma, what big eyes you have!' she said. 'The better to see you with,' replied the wolf. 'Grandma, what big ears you have!' 'The better to hear you with.'",
        "'And what a big mouth you have!' she said. 'The better to eat you with!' roared the wolf, and he jumped out of bed. But a brave hunter heard the noise, ran in, and chased the wolf away.",
        "The hunter freed Grandma from the cupboard. Little Red Riding Hood and her grandmother hugged each other. The little girl promised never to talk to strangers in the forest again, and they shared the cakes happily."
      ],
      thPages: [
        "กาลครั้งหนึ่งมีเด็กหญิงตัวน้อยน่ารักที่สวมหมวกคลุมสีแดงเสมอ ทุกคนในหมู่บ้านเรียกเธอว่าหนูน้อยหมวกแดง วันหนึ่งแม่ห่อตะกร้าเค้กแล้วพูดว่า 'เอาไปให้คุณยาย เธอไม่สบาย'",
        "หนูน้อยหมวกแดงเดินกระโดดผ่านป่าไปเรื่อยๆ ระหว่างทางเธอพบหมาป่าตัวใหญ่ 'เจ้าจะไปไหนหนูน้อย?' หมาป่าถาม 'ไปบ้านคุณยาย' เธอตอบ หมาป่ายิ้มและวิ่งนำหน้าไปก่อน",
        "หมาป่าไปถึงบ้านคุณยายก่อน มันเคาะประตู และหญิงชราก็เปิดประตูให้ หมาป่าทำให้เธอตกใจ ล็อกเธอไว้ในตู้ สวมเสื้อผ้าของเธอ แล้วปีนขึ้นไปบนเตียง",
        "เมื่อหนูน้อยหมวกแดงมาถึง เธอสังเกตเห็นบางอย่างแปลกๆ 'คุณยายตาโตจัง!' เธอกล่าว 'ก็เพื่อที่จะได้มองเห็นเธอชัดๆ' หมาป่าตอบ 'คุณยายหูใหญ่จัง!' 'ก็เพื่อที่จะได้ยินเธอชัดๆ'",
        "'แล้วปากใหญ่จัง!' เธอกล่าว 'ก็เพื่อที่จะได้กินเธอ!' หมาป่าคำรามและกระโดดลงจากเตียง แต่พรานผู้กล้าหาญได้ยินเสียงจึงวิ่งเข้ามาและไล่หมาป่าไป",
        "พรานช่วยคุณยายออกจากตู้ หนูน้อยหมวกแดงและคุณยายกอดกันแน่น เธอสัญญาว่าจะไม่คุยกับคนแปลกหน้าในป่าอีก และพวกเขาก็กินเค้กอย่างมีความสุข"
      ]
    },
    {
      id: "cur-fairy-ugly-duckling", level: "A2", genre: "fairy",
      title: "The Ugly Duckling",
      pages: [
        "By an old farmhouse, a mother duck sat on her nest. At last the eggs began to crack, and out came six pretty yellow ducklings. But one egg was bigger than the rest, and it took much longer to hatch.",
        "When the big egg finally opened, out came a strange duckling. He was grey and clumsy, and he looked different from his brothers and sisters. 'Look at him!' said the other ducks. 'He's so ugly!'",
        "Everywhere the poor duckling went, the other birds laughed at him. Even his own brothers didn't want to play with him. He was very sad, and one night he flew away to live alone in the marsh.",
        "Winter came. The marsh froze, and the ugly duckling was cold and hungry. But he didn't give up. He survived the cold season, and in the spring he stretched his wings and flew into the air.",
        "He landed on a beautiful lake where three white swans swam. They swam toward him, and he lowered his head, ashamed. But then he saw his own reflection in the water — he was a graceful swan!",
        "The other swans welcomed him with open wings. He had never dreamed he could be so beautiful. 'It doesn't matter if you are born in a duck yard,' he thought. 'What matters is what you become inside.' And he was the happiest swan of all."
      ],
      thPages: [
        "ข้างบ้านไร่เก่า เป็ดแม่นั่งกกไข่อยู่บนรัง ในที่สุดไข่ก็เริ่มแตก และลูกเป็ดสีเหลืองน่ารักหกตัวก็ออกมา แต่มีไข่ใบหนึ่งใหญ่กว่าใบอื่น และใช้เวลาฟักนานกว่ามาก",
        "เมื่อไข่ใหญ่ใบนั้นฟักออกมา ลูกเป็ดตัวแปลกๆ ก็ออกมา เขาสีเทาและงุ่มง่าม ดูแตกต่างจากพี่น้อง 'ดูมันสิ!' เป็ดตัวอื่นพูด 'มันน่าเกลียดจัง!'",
        "ลูกเป็ดผู้น่าสงสารไปที่ไหน นกตัวอื่นก็หัวเราะเยาะ แม้แต่พี่น้องของเขาเองก็ไม่อยากเล่นด้วย เขาเศร้ามาก และคืนหนึ่งเขาก็บินหนีไปอยู่ตามลำพังในหนองน้ำ",
        "ฤดูหนาวมาถึง หนองน้ำแข็งตัว ลูกเป็ดตัวนั้นหนาวและหิว แต่เขาไม่ยอมแพ้ เขารอดชีวิตผ่านฤดูหนาวมาได้ และในฤดูใบไม้ผลิเขาก็ยืดปีกและบินขึ้นสู่อากาศ",
        "เขาลงจอดที่ทะเลสาบสวยงามซึ่งมีหงส์ขาวสามตัวว่ายอยู่ พวกมันว่ายเข้ามาหาเขา และเขาก็ก้มหน้าลงด้วยความละอาย แต่แล้วเขาก็เห็นเงาสะท้อนของตัวเองในน้ำ — เขาคือหงส์ที่สง่างาม!",
        "หงส์ตัวอื่นต้อนรับเขาด้วยปีกที่กางออก เขาไม่เคยฝันว่าตัวเองจะสวยได้ขนาดนี้ 'ไม่สำคัญว่าคุณจะเกิดในเล้าเป็ด' เขาคิด 'สิ่งที่สำคัญคือสิ่งที่คุณเป็นอยู่ภายใน' และเขาก็เป็นหงส์ที่มีความสุขที่สุด"
      ]
    },
    {
      id: "cur-ghost-monkeys-paw", level: "B1", genre: "ghost",
      title: "The Monkey's Paw",
      pages: [
        "Outside a cold English village, the White family sat by the fire. A visitor named Sergeant-Major Morris arrived and told them a strange story about a monkey's paw that could grant three wishes to its owner.",
        "Morris threw the dried paw onto the fire, but Mr. White grabbed it. 'I'll keep it,' he said. 'How do I use it?' Morris warned him seriously. 'Be careful what you wish for. I've seen things happen that I regret.'",
        "That night, Mr. White wished for two hundred pounds. The next morning, his son Herbert went to work. A while later, a stranger came to the door with sad news: Herbert had been caught in the machinery and had died.",
        "The stranger handed Mr. White two hundred pounds as compensation. The family was heartbroken. Weeks passed, and Mrs. White couldn't bear the loss. 'The paw! Wish for Herbert to come back!' she begged.",
        "Reluctantly, Mr. White wished for his son to be alive again. That night, a terrible knocking came at the door. Something outside called Herbert's name in a low, hollow voice.",
        "Mrs. White rushed to unlock the door, but Mr. White was terrified. The knocking grew louder. He found the paw, and with a shaking hand, he made a final wish. The knocking stopped. When Mrs. White opened the door, the street was empty."
      ],
      thPages: [
        "นอกหมู่บ้านอังกฤษที่หนาวเย็น ครอบครัวไวท์นั่งอยู่ริมกองไฟ แขกคนหนึ่งชื่อจ่าเมเจอร์มอร์ริสมาถึงและเล่าเรื่องแปลกประหลาดเกี่ยวกับอุ้งตีนลิงที่สามารถให้พรสามข้อแก่เจ้าของได้",
        "มอร์ริสโยนอุ้งตีนลิงแห้งนั้นลงในกองไฟ แต่คุณไวท์คว้าไว้ 'ฉันจะเก็บไว้' เขาพูด 'ใช้ยังไง?' มอร์ริสเตือนเขาอย่างจริงจัง 'ระวังสิ่งที่เจ้าขอ ฉันเคยเห็นเรื่องที่ฉันเสียใจ'",
        "คืนนั้นคุณไวท์ขอเงินสองร้อยปอนด์ เช้าวันรุ่งขึ้นเฮอร์เบิร์ตลูกชายไปทำงาน ต่อมาคนแปลกหน้ามาที่ประตูพร้อมข่าวเศร้า: เฮอร์เบิร์ตถูกเครื่องจักรเกี่ยวและเสียชีวิต",
        "คนแปลกหน้าส่งเงินสองร้อยปอนด์ให้คุณไวท์เป็นค่าชดเชย ครอบครัวเสียใจมาก หลายสัปดาห์ผ่านไป คุณนายไวท์ทนการสูญเสียนี้ไม่ไหว 'อุ้งตีนลิง! ขอให้เฮอร์เบิร์ตกลับมา!' เธอวิงวอน",
        "อย่างไม่เต็มใจ คุณไวท์ขอให้ลูกชายกลับมามีชีวิตอีกครั้ง คืนนั้นเสียงเคาะประตูอันน่ากลัวก็ดังขึ้น มีบางอย่างนอกประตูเรียกชื่อเฮอร์เบิร์ตด้วยเสียงทุ้มและก้อง",
        "คุณนายไวท์รีบวิ่งไปปลดล็อกประตู แต่คุณไวท์ตกใจมาก เสียงเคาะดังขึ้นเรื่อยๆ เขาหาอุ้งตีนลิงเจอ และด้วยมือที่สั่นเทา เขาก็ขอพรสุดท้าย เสียงเคาะหยุดลง เมื่อคุณนายไวท์เปิดประตู ถนนก็ว่างเปล่า"
      ]
    },
    {
      id: "cur-ghost-sleepy-hollow", level: "B1", genre: "ghost",
      title: "The Legend of Sleepy Hollow",
      pages: ["In a quiet valley called Sleepy Hollow lived a young schoolmaster named Ichabod Crane. He was tall and thin, and he loved ghost stories. The villagers told a terrible tale about a Headless Horseman who rode at night.",
        "Ichabod fell in love with Katrina Van Tassel, the daughter of a rich farmer. But another young man, Brom Bones, also wanted to marry Katrina, and he was jealous of the schoolmaster.",
        "One autumn evening, the Van Tassels threw a big party. Ichabod danced with Katrina all night, while Brom watched from the corner, angry. When the party ended, Ichabod stayed behind to talk with Katrina.",
        "It was late when Ichabod rode home alone. The road was dark, and strange sounds filled the air. Suddenly, he saw a huge horseman riding behind him. The rider had no head!",
        "Ichabod urged his horse to go faster, but the horseman kept coming. They raced toward a wooden bridge. The legend said the ghost couldn't cross the bridge, so Ichabod galloped across it. Then the horseman threw his head at him!",
        "The next morning, they found Ichabod's horse without its rider. His hat lay near the bridge, next to a smashed pumpkin. Nobody ever saw Ichabod Crane again, and some said he'd married a rich widow far away. Brom Bones married Katrina, and he always laughed whenever the story was told."],
      thPages: ["ในหุบเขาอันเงียบสงบชื่อสลีปปี้ฮอลโลว์มีครูหนุ่มชื่ออิคาบ็อด เครนอาศัยอยู่ เขาสูงผอมและชอบเรื่องผีมาก ชาวบ้านเล่าตำนานน่ากลัวเกี่ยวกับอัศวินไม่มีหัวที่ขี่ม้าออกมาในตอนกลางคืน",
        "อิคาบ็อดตกหลุมรักคาทริน่า แวน ทาสเซล ลูกสาวของชาวนาผู้มั่งคั่ง แต่ชายหนุ่มอีกคนชื่อบรอม โบนส์ก็อยากได้คาทริน่าเหมือนกัน เขาอิจฉาครูหนุ่มคนนี้มาก",
        "เย็นวันหนึ่งในฤดูใบไม้ร่วง ครอบครัวแวนทาสเซลจัดงานเลี้ยงใหญ่ อิคาบ็อดเต้นรำกับคาทริน่าทั้งคืน ส่วนบรอมก็นั่งมองอยู่ที่มุมห้องด้วยความหงุดหงิด เมื่องานเลิก อิคาบ็อดก็อยู่ต่อเพื่อคุยกับคาทริน่าคนเดียว",
        "กว่าจะได้กลับบ้านก็ดึกมากแล้ว อิคาบ็อดขี่ม้ากลับเพียงลำพัง ถนนมืดสนิทและเต็มไปด้วยเสียงแปลกๆ ทันใดนั้นเขาก็เห็นคนขี่ม้าตัวใหญ่ตามมาข้างหลัง คนขี่ม้าคนนั้นไม่มีหัว!",
        "อิคาบ็อดเร่งม้าให้เร็วขึ้น แต่คนขี่ม้าก็ยังตามมาไม่ลดละ พวกเขาแข่งกันไปที่สะพานไม้ ตำนานบอกว่าผีข้ามสะพานไม่ได้ อิคาบ็อดจึงควบม้าข้ามไป แล้วทันใดนั้นคนขี่ม้าก็โยนหัวของตัวเองมาใส่!",
        "เช้าวันรุ่งขึ้น พวกเขาพบม้าของอิคาบ็อดแต่ไม่มีคนขี่ หมวกของเขาวางอยู่ใกล้สะพาน ข้างๆ ฟักทองที่แตกเป็นเสี่ยง ไม่มีใครเห็นอิคาบ็อด เครนอีกเลย บางคนบอกว่าเขาแต่งงานกับแม่ม่ายรวยที่อยู่ไกลออกไป ส่วนบรอม โบนส์แต่งงานกับคาทริน่า และเขามักจะหัวเราะทุกครั้งที่มีคนเล่าเรื่องนี้"]
    },
    {
      id: "cur-ghost-black-cat", level: "B2", genre: "ghost",
      title: "The Black Cat",
      pages: ["I will not try to explain these events. I say only that I am not mad and that I saw everything with my own eyes. I was a gentle man who loved animals, and my wife and I kept many pets, including a black cat named Pluto.",
        "But my temper began to change. I grew gloomy and irritable, and I drank too much. One night, blinded by anger, I grabbed the cat and cut out one of its eyes. The next morning I wept, but the damage was done.",
        "The cat avoided me, and my shame slowly turned to bitterness. One evening, in a rage, I grabbed poor Pluto by the neck and hanged him from a tree. That very night my house burned down, and only one wall was left standing.",
        "On that wall, drawn in the ashes, was the image of a giant cat with a rope around its neck. I shuddered, but I told myself it was only a coincidence. I needed another pet, and soon I found a black cat in a tavern — the image of Pluto, except for one white spot on its chest.",
        "The new cat followed me everywhere. The white spot slowly changed shape until it looked like a gallows. I began to fear and hate the creature, yet I could not bring myself to harm it. My wife, however, loved it.",
        "One day we went down to the cellar. The cat startled me, and I raised an axe. My wife tried to stop me, and in my madness I struck her instead. She fell dead on the spot. I hid her body inside the wall and finished my work in peace.",
        "The police searched the house but found nothing. I grew confident, and on the fourth day I led them into the cellar myself. I tapped the wall, boasting of how strongly it was built. A terrible cry answered — and when the bricks fell, there stood the cat, sitting on my wife's head."],
      thPages: ["ฉันจะไม่พยายามอธิบายเหตุการณ์เหล่านี้ ขอเพียงบอกว่าฉันไม่ได้บ้า และฉันเห็นทุกอย่างด้วยตาของตัวเอง ฉันเคยเป็นคนอ่อนโยนที่รักสัตว์ ฉันกับภรรยาเลี้ยงสัตว์ไว้หลายชนิด รวมถึงแมวดำตัวหนึ่งชื่อพลูโต",
        "แต่นิสัยของฉันเริ่มเปลี่ยนไป ฉันหงุดหงิดง่าย ฉุนเฉียวง่าย และดื่มเกินขนาด คืนหนึ่ง ด้วยความโกรธที่บดบังสติ ฉันคว้าแมวมาแล้วตัดตาของมันออกหนึ่งข้าง เช้าวันรุ่งขึ้นฉันร้องไห้ แต่สิ่งที่ทำลงไปก็แก้ไขไม่ได้แล้ว",
        "แมวพยายามหลบฉัน และความอับอายก็กลายเป็นความขมขื่น เย็นวันหนึ่ง ด้วยความเดือดดาล ฉันจับพลูโตผู้น่าสงสารที่คอแล้วแขวนมันไว้กับต้นไม้ คืนนั้นเองบ้านของฉันก็ถูกไฟไหม้ เหลือเพียงกำแพงด้านเดียวที่ยังตั้งอยู่",
        "บนกำแพงนั้น กลางขี้เถ้า มีภาพแมวยักษ์ที่มีเชือกคล้องคอ ฉันสั่นสะท้าน แต่บอกตัวเองว่ามันเป็นแค่เรื่องบังเอิญ ฉันอยากได้สัตว์เลี้ยงตัวใหม่ และไม่นานฉันก็พบแมวดำตัวหนึ่งในโรงเหล้า — เหมือนพลูโตทุกอย่าง ยกเว้นจุดขาวจุดเดียวบนหน้าอก",
        "แมวตัวใหม่ตามฉันไปทุกหนทุกแห่ง จุดขาวค่อยๆ เปลี่ยนรูปร่างจนดูเหมือนตะแลงแกง ฉันเริ่มกลัวและเกลียดมัน แต่ก็ทำร้ายมันไม่ลง ส่วนภรรยาของฉันกลับรักมันมาก",
        "วันหนึ่งเราลงไปที่ห้องใต้ดิน แมวทำให้ฉันสะดุ้ง ฉันจึงยกขวานขึ้น ภรรยาพยายามเข้ามาห้าม และด้วยความวิกลจริต ฉันกลับฟาดลงไปที่เธอแทน เธอล้มลงสิ้นใจทันที ฉันซ่อนร่างของเธอไว้ในกำแพง แล้วก็ทำงานต่ออย่างใจเย็น",
        "ตำรวจค้นบ้านแต่ไม่พบอะไร ฉันเริ่มมั่นใจขึ้นเรื่อยๆ และในวันที่สี่ฉันก็พาพวกเขาลงไปที่ห้องใต้ดินด้วยตัวเอง ฉันเคาะกำแพง อวดว่ามันแข็งแรงแค่ไหน ทันใดนั้นเสียงร้องอันน่าสยดสยองก็ตอบกลับมา — และเมื่ออิฐร่วงลงมา แมวตัวนั้นก็ยืนอยู่บนหัวของภรรยาฉัน"]
    },
    {
      id: "cur-adv-robinson-crusoe", level: "B1", genre: "adventure",
      title: "Robinson Crusoe",
      pages: ["My name is Robinson Crusoe. I was born in England, and I always dreamed of the sea. My father begged me to stay home, but I wouldn't listen. I sailed away at nineteen, and I've never regretted my love of adventure.",
        "My first voyages were dangerous, but the greatest test came when a terrible storm sank our ship near a wild island. Every man on board was lost except me. The waves threw me onto the sand, and when I opened my eyes, I was alone.",
        "I swam out to the broken ship and pulled out food, tools, guns, and rope. I carried them to the shore and built a strong shelter inside a cave. I made a calendar by cutting marks into a wooden post so I wouldn't lose track of the days.",
        "Months passed, and the island became my home. I learned to grow corn, to catch fish, and to make pots. I kept a few goats for milk and meat. I was no longer afraid. I worked hard every day and thanked God for saving my life.",
        "I lived there quietly for many years. Then one day I saw a footprint in the sand. It wasn't my own. I hid in fear, certain that strangers had come to the island, and I prepared my guns and my walls.",
        "One morning I watched a group of men drag two poor prisoners to the beach. One escaped and ran toward me. I rescued him, gave him a name — Friday — and taught him to speak. He was loyal and brave, and we became the best of friends.",
        "After twenty-eight years on the island, a ship full of mutineers arrived. Friday and I freed its captain, defeated the mutineers, and took the ship. We sailed for England, where I returned a wealthy man with my faithful friend Friday."],
      thPages: ["ฉันชื่อโรบินสัน ครูโซ เกิดที่อังกฤษและใฝ่ฝันถึงทะเลมาตลอด พ่อขอร้องให้ฉันอยู่บ้านแต่ฉันไม่ยอมฟัง ฉันออกเรือตั้งแต่อายุสิบเก้า และฉันไม่เคยเสียใจที่รักการผจญภัย",
        "การเดินทางครั้งแรกของฉันอันตราย แต่บททดสอบที่ยิ่งใหญ่ที่สุดเกิดขึ้นเมื่อพายุร้ายจมเรือของเราใกล้เกาะร้าง ลูกเรือทุกคนจมน้ำตายยกเว้นฉัน คลื่นซัดฉันขึ้นฝั่ง และเมื่อฉันลืมตาขึ้นมา ฉันก็อยู่เพียงลำพัง",
        "ฉันว่ายไปที่เรือที่แตกและดึงอาหาร เครื่องมือ ปืน และเชือกขึ้นมา ฉันขนมันไปที่ฝั่งและสร้างที่พักพิงแข็งแรงในถ้ำ ฉันทำปฏิทินด้วยการขีดรอยบนเสาไม้ เพื่อไม่ให้ตัวเองลืมว่านี่ผ่านไปกี่วัน",
        "หลายเดือนผ่านไป เกาะแห่งนี้ก็กลายเป็นบ้านของฉัน ฉันเรียนรู้ที่จะปลูกข้าวโพด จับปลา และทำหม้อ ฉันเลี้ยงแพะไว้ไม่กี่ตัวเพื่อกินนมและเนื้อ ฉันไม่กลัวอีกต่อไป ฉันทำงานหนักทุกวันและขอบคุณพระเจ้าที่ช่วยชีวิตฉัน",
        "ฉันใช้ชีวิตอยู่ที่นั่นอย่างสงบหลายปี แล้ววันหนึ่งฉันเห็นรอยเท้าบนทราย มันไม่ใช่รอยเท้าของฉัน ฉันซ่อนตัวด้วยความกลัว แน่ใจว่ามีคนแปลกหน้ามาที่เกาะ และฉันก็เตรียมปืนและเสริมกำแพงให้แข็งแรง",
        "เช้าวันหนึ่งฉันเห็นกลุ่มคนลากนักโทษผู้น่าสงสารสองคนมาที่ชายหาด คนหนึ่งหนีออกมาและวิ่งมาหาฉัน ฉันช่วยเขาไว้ ตั้งชื่อเขาว่า 'ฟรายเดย์' และสอนให้เขาพูด เขาเป็นคนซื่อสัตย์และกล้าหาญ และเราก็กลายเป็นเพื่อนสนิทกัน",
        "หลังจากอยู่บนเกาะยี่สิบแปดปี เรือที่เต็มไปด้วยพวกกบฏก็มาถึง ฟรายเดย์กับฉันช่วยกัปตันของเรือ เอาชนะพวกกบฏ และยึดเรือได้ เราออกเรือกลับอังกฤษ ซึ่งฉันกลับมาเป็นคนร่ำรวยพร้อมกับเพื่อนผู้ซื่อสัตย์ของฉัน ฟรายเดย์"]
    },
    {
      id: "cur-adv-treasure-island", level: "B1", genre: "adventure",
      title: "Treasure Island",
      pages: ["I'm Jim Hawkins, and I must tell you the story of the gold. It began when an old sailor named Billy Bones came to my mother's inn. He paid us well to keep quiet, but he drank too much and talked far too much about the sea.",
        "Billy feared a one-legged man more than anything. One night, blind Pew came with a black spot — a signal of death. Billy was struck down, and before he died, he gave me his old sea chest. Inside lay a map of an island, with a cross marking buried treasure.",
        "Dr. Livesey and Squire Trelawney read the map and planned a voyage. The squire bought a fine ship called the Hispaniola and hired a crew. But the cook he hired was a clever man named Long John Silver, who smiled and seemed kind to everyone.",
        "We sailed for weeks. Then, one night, I climbed into the apple barrel to hide and overheard Silver talking to the sailors. He was a pirate! He planned to steal the treasure and kill us all when we reached the island.",
        "When we landed, I warned the captain. The pirates attacked, and we fought behind a wooden stockade in the forest. Silver tried to bargain and even switched sides, but I could see the greed in his eyes.",
        "I slipped away and found a man living alone on the island. His name was Ben Gunn, and he'd been marooned there for three years. He told me he'd already found the treasure and moved it to his cave!",
        "Silver led us to the empty hole where the gold should have been. Thanks to Ben Gunn, we loaded the treasure onto the ship and sailed home. We left Silver on the island, but I'll never forget the adventure."],
      thPages: ["ฉันคือจิม ฮอว์กินส์ และฉันต้องเล่าเรื่องทองคำให้ฟัง เรื่องเริ่มขึ้นเมื่อกะลาสีแก่ชื่อบิลลี่ โบนส์มาพักที่โรงแรมของแม่ฉัน เขาจ่ายเงินดีๆ เพื่อให้เราเงียบๆ แต่เขาดื่มจัดและพูดถึงทะเลมากเกินไป",
        "บิลลี่กลัวชายขาเดียวมากกว่าสิ่งใด คืนหนึ่งพิวตาบอดมาพร้อมจุดดำ — สัญญาณแห่งความตาย บิลลี่ถูกเล่นงาน และก่อนจะตาย เขามอบหีบสมบัติเก่าแก่ของเขาให้ฉัน ข้างในมีแผนที่เกาะหนึ่ง ซึ่งมีเครื่องหมายกากบาทบอกตำแหน่งสมบัติที่ฝังไว้",
        "ดร.ไลฟ์ซีย์และสุภาพบุรุษเทรลอว์นีย์อ่านแผนที่และวางแผนการเดินทาง เทรลอว์นีย์ซื้อเรือสวยงามชื่อฮิสปานิโอลาและจ้างลูกเรือ แต่พ่อครัวที่เขาจ้างเป็นคนฉลาดชื่อลองจอห์นซิลเวอร์ ซึ่งยิ้มแย้มและทำท่าทางใจดีกับทุกคน",
        "เราแล่นเรืออยู่หลายสัปดาห์ แล้วคืนหนึ่งฉันปีนเข้าไปในถังแอปเปิลเพื่อซ่อนตัว และได้ยินซิลเวอร์คุยกับกะลาสี เขาคือโจรสลัด! เขาวางแผนจะขโมยสมบัติและฆ่าพวกเราทุกคนเมื่อไปถึงเกาะ",
        "เมื่อเราขึ้นฝั่ง ฉันเตือนกัปตัน พวกโจรสลัดโจมตี และเราสู้หลังกำแพงไม้ในป่า ซิลเวอร์พยายามต่อรองและถึงกับเปลี่ยนข้าง แต่ฉันเห็นความโลภในดวงตาของเขา",
        "ฉันหนีออกไปและพบชายคนหนึ่งอาศัยอยู่คนเดียวบนเกาะ ชื่อของเขาคือเบน กันน์ และเขาถูกทอดทิ้งอยู่บนเกาะมาสามปี เขาบอกฉันว่าเขาหาสมบัติเจอแล้ว และย้ายมันไปซ่อนไว้ในถ้ำของเขา!",
        "ซิลเวอร์พาพวกเราไปที่หลุมว่างเปล่าที่สมบัติควรจะอยู่ ต้องขอบคุณเบน กันน์ เราขนสมบัติขึ้นเรือและแล่นกลับบ้าน เราทิ้งซิลเวอร์ไว้บนเกาะ แต่ฉันจะไม่มีวันลืมการผจญภัยครั้งนี้"]
    },
    {
      id: "cur-adv-around-world-80", level: "B2", genre: "adventure",
      title: "Around the World in Eighty Days",
      pages: ["In 1872, a very exact gentleman named Phileas Fogg lived in London. He had no friends and no adventure in his heart, until one evening at his club he made a bold bet. He wagered twenty thousand pounds that he could circle the globe in eighty days.",
        "That same night, Fogg hired a new servant named Jean Passepartout. 'We're leaving in ten minutes,' said Fogg. 'Around the world!' Passepartout cried in surprise. He packed one small bag, and the two men caught the first train to Paris.",
        "A detective named Fix followed them. He believed Fogg was a bank robber, because twenty thousand pounds had just been stolen from the Bank of England. Fix planned to arrest Fogg the moment he set foot on British soil again.",
        "The pair crossed Europe by train and sailed to India, where Fogg bought an elephant to cross the jungle. On the way, they rescued a beautiful Indian woman named Aouda from a terrible ceremony, and Fogg agreed to take her with them.",
        "From Calcutta they took a steamer to Hong Kong and then to Japan. Passepartout was separated from his master for a time, but they reunited and crossed the Pacific to America, where they raced across the plains by train, even swinging the car onto the track when a bridge broke.",
        "At last they reached New York and boarded a fast steamer for Liverpool. Fix arrested Fogg just before the ship docked — but the thief was already caught elsewhere, and Fogg was set free. Even so, they had lost the race; it was December 21st, a day late.",
        "Then Passepartout realized the truth: by traveling east, they had gained a whole day. It was actually Saturday, not Sunday! Fogg rushed to his club and arrived at exactly the final second. He won the bet and married the lovely Aouda."],
      thPages: ["ในปี ค.ศ. 1872 สุภาพบุรุษผู้เคร่งครัดชื่อไพล์ส ฟอกก์อาศัยอยู่ในลอนดอน เขาไม่มีเพื่อนและไม่มีใจรักการผจญภัย จนกระทั่งเย็นวันหนึ่งที่คลับ เขากล้าทำเดิมพัน เขาพนันเงินสองหมื่นปอนด์ว่าเขาจะวนรอบโลกให้ได้ภายในแปดสิบวัน",
        "คืนนั้นเอง ฟอกก์จ้างคนรับใช้คนใหม่ชื่อฌอง ปาสปาร์ตู 'เราออกเดินทางในสิบนาที' ฟอกก์พูด 'รอบโลก!' ปาสปาร์ตูร้องด้วยความประหลาดใจ เขาแพ็คกระเป๋าใบเล็กๆ หนึ่งใบ แล้วชายสองคนก็ขึ้นรถไฟขบวนแรกไปปารีส",
        "นักสืบชื่อฟิกซ์ตามพวกเขามา เขาเชื่อว่าฟอกก์คือโจรปล้นธนาคาร เพราะเงินสองหมื่นปอนด์เพิ่งถูกขโมยไปจากธนาคารแห่งอังกฤษ ฟิกซ์วางแผนจะจับกุมฟอกก์ทันทีที่เขาก้าวเท้าลงบนแผ่นดินอังกฤษอีกครั้ง",
        "ทั้งสองเดินทางข้ามยุโรปด้วยรถไฟและล่องเรือไปอินเดีย ซึ่งฟอกก์ซื้อช้างตัวหนึ่งไว้ข้ามป่า ระหว่างทาง พวกเขาช่วยหญิงสาวชาวอินเดียผู้งดงามชื่ออาอุดาจากพิธีกรรมอันน่าสยดสยอง และฟอกก์ก็ตกลงพาเธอไปด้วย",
        "จากกัลกัตตา พวกเขานั่งเรือกลไฟไปฮ่องกงแล้วต่อไปญี่ปุ่น ปาสปาร์ตูพลัดหลงจากเจ้านายอยู่พักหนึ่ง แต่ทั้งคู่ก็กลับมาพบกันและข้ามมหาสมุทรแปซิฟิกไปอเมริกา ซึ่งพวกเขาแข่งกันด้วยรถไฟข้ามทุ่งกว้าง ถึงขั้นยกตู้รถไฟกลับขึ้นรางเมื่อสะพานหัก",
        "ในที่สุดพวกเขาก็ถึงนิวยอร์กและขึ้นเรือกลไฟเร็วไปลิเวอร์พูล ฟิกซ์จับกุมฟอกก์ก่อนที่เรือจะเทียบท่า — แต่โจรตัวจริงถูกจับได้ที่อื่นแล้ว และฟอกก์ก็ได้รับการปล่อยตัว ถึงอย่างนั้น พวกเขาก็แพ้การแข่งขัน นี่คือวันที่ 21 ธันวาคม ช้ากว่ากำหนดหนึ่งวัน",
        "แล้วปาสปาร์ตูก็ตระหนักถึงความจริง: เพราะเดินทางไปทางทิศตะวันออก พวกเขาจึงได้เวลามาเพิ่มอีกหนึ่งวันเต็ม ที่จริงแล้ววันนี้คือวันเสาร์ ไม่ใช่วันอาทิตย์! ฟอกก์รีบวิ่งไปที่คลับและมาถึงในวินาทีสุดท้ายพอดี เขาชนะเดิมพันและได้แต่งงานกับอาอุดาผู้งดงาม"]
    },
    {
      id: "cur-adv-20000-leagues", level: "B2", genre: "adventure",
      title: "Twenty Thousand Leagues Under the Sea",
      pages: ["In 1866, sailors around the world reported a strange creature in the ocean — a giant animal that moved faster than any whale. Professor Aronnax, a famous scientist, boarded a warship to hunt it down, sure it was a huge narwhal.",
        "After weeks at sea, the creature attacked. The professor, his servant Conseil, and the harpooner Ned Land were thrown into the water. The creature, they soon discovered, was not an animal at all. It was a submarine made of steel!",
        "The ship's commander opened a door and welcomed them inside. His name was Captain Nemo. 'You will never leave this ship,' he said calmly. 'But you will see wonders that no man has ever seen.'",
        "For months they sailed beneath every ocean. Nemo showed the professor forests of coral, sunken ships full of gold, and the lost city of Atlantis beneath the waves. They walked on the sea floor in heavy diving suits.",
        "One day the submarine was trapped under ice at the South Pole. The crew worked for hours to cut the ice, and just when the air ran out, they broke free and surfaced with a great roar.",
        "Then a school of giant squid attacked the ship. The crew fought the monsters on deck with axes while Ned hurled his harpoon. One man was dragged into the water, and Nemo wept over his loss.",
        "Nemo's heart grew darker, and his mysterious past filled the professor with fear. When a whirlpool — the Maelstrom — pulled the ship into its spinning grip, the three men escaped in a small boat and were rescued by fishermen. Captain Nemo and his submarine were never seen again."],
      thPages: ["ในปี ค.ศ. 1866 กะลาสีทั่วโลกเริ่มรายงานว่ามีสิ่งมีชีวิตประหลาดอยู่ในมหาสมุทร — สัตว์ยักษ์ที่ว่ายเร็วกว่าปลาวาฬทุกชนิด ศาสตราจารย์อารอนแนกซ์ นักวิทยาศาสตร์ชื่อดัง ขึ้นเรือรบเพื่อตามล่ามัน โดยเชื่อมั่นว่ามันคือนาร์วาลยักษ์",
        "หลังอยู่กลางทะเลหลายสัปดาห์ สิ่งมีชีวิตนั้นก็โจมตีเรือ ศาสตราจารย์ คนรับใช้คอนเซย์ และคนฉมวกเน็ด แลนด์ ถูกซัดลงน้ำ สิ่งที่พวกเขาค้นพบไม่ใช่สัตว์เลยสักนิด มันคือเรือดำน้ำที่สร้างจากเหล็กกล้า!",
        "ผู้บัญชาการเรือเปิดประตูและเชิญพวกเขาเข้าไปข้างใน ชื่อของเขาคือกัปตันนีโม 'คุณจะไม่มีวันออกจากเรือลำนี้' เขาพูดอย่างสงบ 'แต่คุณจะได้เห็นสิ่งมหัศจรรย์ที่ไม่มีมนุษย์คนไหนเคยเห็น'",
        "เป็นเวลาหลายเดือนที่พวกเขาแล่นอยู่ใต้มหาสมุทรทุกแห่ง นีโมพาศาสตราจารย์ชมป่าปะการัง เรือจมที่เต็มไปด้วยทองคำ และเมืองแอตแลนติสที่จมอยู่ใต้คลื่น พวกเขาเดินบนพื้นทะเลในชุดดำน้ำหนักๆ",
        "วันหนึ่งเรือดำน้ำติดอยู่ใต้แผ่นน้ำแข็งที่ขั้วโลกใต้ ลูกเรือทำงานหลายชั่วโมงเพื่อตัดน้ำแข็ง และเมื่ออากาศใกล้จะหมดพอดี พวกเขาก็หลุดออกมาและโผล่ขึ้นสู่ผิวน้ำพร้อมเสียงคำรามอันยิ่งใหญ่",
        "แล้วปลาหมึกยักษ์ทั้งฝูงก็โจมตีเรือ ลูกเรือต่อสู้กับสัตว์ประหลาดบนดาดฟ้าด้วยขวาน ขณะที่เน็ดขว้างฉมวก ชายคนหนึ่งถูกฉุดลงน้ำ และนีโมก็ร้องไห้คร่ำครวญกับการสูญเสียครั้งนั้น",
        "จิตใจของนีโมเริ่มมืดมนลง และอดีตลึกลับของเขาทำให้ศาสตราจารย์รู้สึกหวาดกลัว เมื่อวังวนขนาดยักษ์ — มาเอลสตรอม — ดูดเรือเข้าไปในเกลียวหมุนของมัน ชายสามคนก็หนีออกมาในเรือเล็กและได้รับการช่วยเหลือจากชาวประมง กัปตันนีโมและเรือดำน้ำของเขาไม่เคยปรากฏให้เห็นอีกเลย"]
    },
    {
      id: "cur-adv-jungle-book", level: "A2", genre: "adventure",
      title: "The Jungle Book",
      pages: ["Deep in the Indian jungle, a wolf family found a tiny baby in the bushes. He wasn't afraid at all, and he smiled at the wolves. They adopted him and named him Mowgli, the little frog, and he grew up strong and clever.",
        "The great bear Baloo taught Mowgli the Law of the Jungle. 'Be careful of Man,' Baloo warned. 'And never trust the Bandar-log — the monkey people.' But Mowgli loved playing in the trees with the noisy monkeys.",
        "One day the monkeys stole Mowgli and carried him to their ruined city. The panther Bagheera and Baloo went to find Kaa, the giant python. Kaa hypnotized the monkeys with his slow dance, and Mowgli was free.",
        "Mowgli returned to his wolf family, but the fierce tiger Shere Khan wanted to kill him. 'Man-cub, I'll eat you!' the tiger snarled. Mowgli grew braver and began to learn the secret ways of the jungle.",
        "The wolves argued about whether to keep Mowgli. So the boy went to the village to get fire — the Red Flower, as the animals called it. He carried it back into the jungle, burning a branch, ready to fight Shere Khan.",
        "With the burning branch, Mowgli drove the tiger into his own trap, and Shere Khan was destroyed. The jungle roared with joy. But Mowgli belonged to two worlds, and one day he walked into the village of men."],
      thPages: ["ลึกเข้าไปในป่าของอินเดีย ครอบครัวหมาป่าพบทารกตัวน้อยในพุ่มไม้ เขาไม่กลัวเลยสักนิดและยิ้มให้หมาป่า พวกมันรับเลี้ยงเขาและตั้งชื่อเขาว่ามาวกลี เจ้ากบน้อย และเขาก็เติบโตขึ้นอย่างแข็งแรงและฉลาด",
        "หมีใหญ่บาเลาสอนกฎแห่งป่าให้มาวกลี 'ระวังมนุษย์' บาเลาเตือน 'และอย่าไว้ใจบันดาร์-ล็อก — พวกมนุษย์ลิง' แต่มาวกลีชอบปีนต้นไม้เล่นกับลิงที่ส่งเสียงดัง",
        "วันหนึ่งลิงขโมยมาวกลีและพาเขาไปที่เมืองปรักหักพังของพวกมัน เสือดำบากีรากับบาเลาจึงไปหาคาร์ เจ้างูหลามยักษ์ คาร์สะกดจิตลิงทั้งฝูงด้วยการร่ายรำช้าๆ และมาวกลีก็เป็นอิสระ",
        "มาวกลีกลับไปหาครอบครัวหมาป่า แต่เสือโคร่งเชียร์ข่านต้องการฆ่าเขา 'เจ้าลูกมนุษย์ ฉันจะกินเจ้า!' เสือคำราม มาวกลีค่อยๆ กล้าหาญขึ้น และเริ่มเรียนรู้วิถีลับของป่า",
        "หมาป่าเถียงกันว่าจะเก็บมาวกลีไว้ดีหรือไม่ ดังนั้นเด็กชายจึงไปที่หมู่บ้านเพื่อเอาไฟ — ดอกไม้แดง ตามที่สัตว์ทั้งหลายเรียกมัน เขาแบกไฟกลับเข้าป่า พร้อมกับเผากิ่งไม้ เตรียมสู้กับเชียร์ข่าน",
        "ด้วยกิ่งไม้ที่ลุกไหม้ มาวกลีไล่เสือเข้าไปในกับดักของมันเอง และเชียร์ข่านก็พ่ายแพ้ ทั้งป่าคำรามด้วยความยินดี แต่หัวใจของมาวกลีผูกพันกับสองโลก และวันหนึ่งเขาก็เดินเข้าไปในหมู่บ้านมนุษย์"]
    },
    {
      id: "cur-sf-time-machine", level: "B2", genre: "scifi",
      title: "The Time Machine",
      pages: ["A brilliant inventor gathered his friends around a small machine of ivory and glass. 'I've built a machine that travels in time,' he said. 'I'll test it tonight.' He pressed a lever, and the machine vanished.",
        "He returned a week later, pale and shaken. 'Listen,' he said, and told them his story. He had set the machine's dial far into the future and watched the sun spin and the seasons fly past like a blur of days.",
        "He landed in the year 802,701. The world was a peaceful garden, and gentle little people called the Eloi lived there. They fed him fruit and flowers, but they were weak and seemed to have no cares at all.",
        "Then the Time Traveller noticed that his machine was gone. Someone had dragged it inside a tall bronze statue. He searched everywhere, and at last he learned the truth: below the earth lived the Morlocks, pale creatures of the dark who ate the Eloi at night.",
        "A brave Eloi woman named Weena became his friend. Together they explored the dark underworld, where the Morlocks kept the machines running. He found his machine but couldn't free it, and the creatures attacked him.",
        "He escaped by climbing into a thick forest, where the trees caught fire. Weena was lost in the flames, and he returned alone. With a heavy heart, he found the machine at last and fled forward in time to escape the Morlocks.",
        "He sped millions of years ahead and saw a dying red sun over a lifeless shore. Filled with dread, he returned to his own time. 'I'll go back again,' he told his friends. He stepped into the machine and never came home."],
      thPages: ["นักประดิษฐ์อัจฉริยะเรียกเพื่อนๆ มาล้อมรอบเครื่องจักรเล็กๆ ที่ทำจากงาช้างและแก้ว 'ฉันสร้างเครื่องจักรที่เดินทางข้ามเวลาได้' เขาบอก 'คืนนี้ฉันจะลองดู' เขากดคันโยก และเครื่องจักรก็หายไป",
        "เขากลับมาอีกหนึ่งสัปดาห์ต่อมา หน้าซีดและสั่นเทา 'ฟังนะ' เขาบอก แล้วเล่าเรื่องราวของเขา เขาหมุนหน้าปัดเครื่องจักรไปไกลในอนาคต และเฝ้าดูดวงอาทิตย์หมุนวนและฤดูกาลผ่านไปราวกับวันเวลาที่เลือนราง",
        "เขาลงจอดในปี 802,701 โลกเป็นสวนอันสงบสุข และผู้คนตัวเล็กๆ ผู้อ่อนโยนที่เรียกว่าชาวเอลอยอาศัยอยู่ที่นั่น พวกเขาให้ผลไม้และดอกไม้แก่เขา แต่พวกเขาอ่อนแอและดูเหมือนไม่มีความกังวลใดๆ เลย",
        "แล้วนักเดินทางเวลาก็สังเกตเห็นว่าเครื่องจักรของเขาหายไป มีคนลากมันเข้าไปในรูปปั้นทองสัมฤทธิ์สูง เขาค้นหาทุกหนทุกแห่ง และในที่สุดก็รู้ความจริง: ใต้พื้นดินอาศัยมอร์ล็อกส์ สิ่งมีชีวิตสีซีดแห่งความมืดที่กินชาวเอลอยในตอนกลางคืน",
        "หญิงสาวเอลอยผู้กล้าหาญชื่อวีน่ากลายเป็นเพื่อนของเขา พวกเขาสำรวจโลกใต้ดินอันมืดมิดด้วยกัน ที่ซึ่งมอร์ล็อกส์คอยดูแลเดินเครื่องจักร เขาพบเครื่องจักรของเขาแต่เอาออกมาไม่ได้ และสิ่งมีชีวิตเหล่านั้นก็โจมตีเขา",
        "เขาหนีด้วยการปีนขึ้นไปในป่าทึบ ที่ซึ่งต้นไม้ลุกไหม้ วีน่าหายไปในเปลวเพลิง และเขากลับมาคนเดียว ด้วยหัวใจที่หนักอึ้ง ในที่สุดเขาก็พบเครื่องจักรและหนีไปข้างหน้าในเวลาเพื่อให้พ้นจากมอร์ล็อกส์",
        "เขาพุ่งไปหลายล้านปีข้างหน้าและเห็นดวงอาทิตย์สีแดงที่กำลังจะตายเหนือชายฝั่งที่ไร้ชีวิต ด้วยความหวาดกลัว เขาจึงกลับมาสู่ยุคของตัวเอง 'ฉันจะกลับไปอีก' เขาบอกเพื่อนๆ เขาก้าวเข้าไปในเครื่องจักรและไม่เคยกลับบ้านอีกเลย"]
    },
    {
      id: "cur-sf-war-of-worlds", level: "B2", genre: "scifi",
      title: "The War of the Worlds",
      pages: ["No one believed that another world could be watching us. But that night, astronomers saw a burst of fire on Mars, and a strange object fell from the sky into the fields near London. People rushed out to stare at the great metal cylinder.",
        "When the top of the cylinder unscrewed, a gray creature crawled out. It had huge dark eyes and long tentacles. It was a Martian — and more followed. They brought terrible machines and an unknown weapon.",
        "The Martians pointed a box of mirrors at the crowd, and a beam of heat flashed out. Men and women burst into flame and fell. The Martian war machines — towering tripods — strode across the countryside, leaving destruction behind.",
        "I was one of the survivors. I fled the burning roads and hid with my wife in a cellar while the thunder of the tripods shook the earth. For days I crept through ruined villages, hungry and terrified, looking for a way out.",
        "I met an artilleryman who had a wild plan to live underground and rebuild civilization. But I couldn't share his hope. The red weed covered the land, and the Martians seemed unstoppable, drinking the blood of men.",
        "I hid inside a half-broken house and watched through a crack as a Martian crawled toward me. For hours I stayed frozen, and I felt my reason slipping away. But the Martian didn't see me — it fell beside the house, motionless.",
        "The truth was simple and wonderful. On Earth, the Martians had no defense against our smallest enemies. The invisible bacteria of our world destroyed them, one by one. The mighty invaders fell, and the red weed withered away. Humanity was saved by the humblest of creatures."],
      thPages: ["ไม่มีใครเชื่อว่าโลกอื่นจะเฝ้าดูเรา แต่คืนนั้น นักดาราศาสตร์เห็นแสงวาบระเบิดบนดาวอังคาร และวัตถุประหลาดตกลงมาจากท้องฟ้าลงสู่ทุ่งนาใกล้ลอนดอน ผู้คนวิ่งออกไปจ้องดูกระบอกโลหะขนาดใหญ่",
        "เมื่อฝาโลหะคลายเกลียวออก สิ่งมีชีวิตสีเทาก็คลานออกมา มันมีดวงตาสีเข้มขนาดใหญ่และหนวดยาว มันคือมนุษย์ดาวอังคาร — และมีตัวอื่นตามมาอีก พวกมันนำเครื่องจักรอันน่ากลัวและอาวุธประหลาดที่ไม่เคยเห็นมาก่อนมาด้วย",
        "มนุษย์ดาวอังคารชี้กล่องกระจกไปที่ฝูงชน และลำแสงความร้อนก็พุ่งออกมา ชายและหญิงลุกเป็นไฟแล้วล้มลง เครื่องจักรสงครามของดาวอังคาร — หุ่นสามขาสูงตระหง่าน — ก้าวย่างข้ามชนบท ทิ้งความหายนะไว้เบื้องหลัง",
        "ฉันเป็นหนึ่งในผู้รอดชีวิต ฉันหนีจากถนนที่ลุกไหม้และซ่อนตัวกับภรรยาในห้องใต้ดิน ขณะที่เสียงคำรามของหุ่นสามขาสะเทือนแผ่นดิน หลายวันผ่านไป ฉันคืบคลานผ่านหมู่บ้านที่พังทลาย หิวโหยและหวาดกลัว มองหาหนทางหนี",
        "ฉันพบนายทหารปืนใหญ่คนหนึ่งที่มีแผนบ้าคลั่งที่จะอาศัยอยู่ใต้ดินและสร้างอารยธรรมขึ้นใหม่ แต่ฉันแบ่งปันความหวังของเขาไม่ได้ วัชพืชสีแดงปกคลุมแผ่นดิน และมนุษย์ดาวอังคารดูเหมือนหยุดไม่ได้ พวกมันดื่มเลือดของมนุษย์",
        "ฉันซ่อนตัวในบ้านครึ่งพังและมองผ่านรอยแตก ขณะที่มนุษย์ดาวอังคารคลานเข้ามาหาฉัน ฉันแข็งทื่ออยู่หลายชั่วโมง และรู้สึกว่าสติกำลังจะหลุดลอย แต่มันไม่เห็นฉัน — มันล้มลงข้างบ้าน ไม่ไหวติง",
        "ความจริงนั้นเรียบง่ายและมหัศจรรย์ บนโลก มนุษย์ดาวอังคารไม่มีทางต้านทานศัตรูที่เล็กที่สุดของเรา แบคทีเรียที่มองไม่เห็นของโลกเราทำลายพวกมันทีละตัว ผู้รุกรานผู้ยิ่งใหญ่ล้มลง และวัชพืชสีแดงก็เหี่ยวเฉา มนุษยชาติได้รับความรอดจากสิ่งมีชีวิตที่ต่ำต้อยที่สุด"]
    },
    {
      id: "cur-sf-center-earth", level: "B2", genre: "scifi",
      title: "Journey to the Center of the Earth",
      pages: ["My uncle, Professor Lidenbrock, was a famous scientist in Hamburg. One day he found an old book with a strange message written in secret letters. 'Decode it,' he ordered me, 'and we'll make history.'",
        "Together we cracked the code. The message was from an ancient explorer named Arne Saknussemm, who claimed he had reached the center of the Earth through a volcano in Iceland. My uncle was overjoyed. 'We leave tomorrow!' he shouted.",
        "We traveled to Iceland, hired a guide named Hans, and climbed the mountain Sneffels. At the summit we found a dark crater and a narrow chimney leading down. My uncle lowered himself first, and we followed into the darkness.",
        "Down, down we went for days. The walls grew warm, and strange lights glowed in the rock. At last we reached a vast underground sea, and we built a raft of wood to sail across its still, silent water.",
        "The sea was full of wonders — ancient fish, forests of giant mushrooms, and creatures that had vanished from the world above. Then a great storm rose, and lightning flashed across the underground sky as our raft was tossed like a leaf.",
        "The storm carried us to a strange shore where we found the bones of ancient monsters and Saknussemm's name carved on a stone. We followed his path and came to a narrow passage we couldn't pass. So my uncle lit a charge of gunpowder and blasted the rock.",
        "The explosion opened a tunnel behind us, and a river of fire — flowing lava — swept us upward. With a deafening roar, the volcano erupted, and we were thrown out onto the green slopes of Italy. We had crossed the entire Earth and returned to the surface!"],
      thPages: ["ลุงของฉัน ศาสตราจารย์ลีเดนบร็อก เป็นนักวิทยาศาสตร์ชื่อดังในฮัมบูร์ก วันหนึ่งเขาพบหนังสือเก่าที่มีข้อความแปลกประหลาดเขียนด้วยตัวอักษรลับ 'ถอดรหัสมัน' เขาสั่งฉัน 'แล้วเราจะสร้างประวัติศาสตร์'",
        "เราร่วมกันไขรหัสได้สำเร็จ ข้อความนั้นมาจากนักสำรวจโบราณชื่ออาร์น ซัคนุสเซมม์ ที่อ้างว่าเขาไปถึงใจกลางโลกผ่านภูเขาไฟในไอซ์แลนด์ ลุงของฉันดีใจมาก 'เราออกเดินทางพรุ่งนี้!' เขาตะโกน",
        "เราเดินทางไปไอซ์แลนด์ จ้างไกด์ชื่อฮันส์ และปีนภูเขาสเนฟเฟลส์ บนยอดเขาเราพบปล่องภูเขาไฟอันมืดมิดและช่องแคบที่ทอดลงไปข้างใต้ ลุงของฉันหย่อนตัวเองลงไปก่อน แล้วเราก็ตามลงไปในความมืด",
        "เราค่อยๆ ลงไปเป็นเวลาหลายวัน กำแพงเริ่มอุ่นขึ้น และแสงประหลาดเรืองรองอยู่ในหิน ในที่สุดเราก็ถึงทะเลใต้ดินอันกว้างใหญ่ และเราก็สร้างแพไม้เพื่อแล่นข้ามผืนน้ำที่นิ่งสงบและเงียบงัน",
        "ทะเลนั้นเต็มไปด้วยสิ่งมหัศจรรย์ — ปลาโบราณ ป่าเห็ดยักษ์ และสิ่งมีชีวิตที่สูญพันธุ์ไปจากโลกข้างบนแล้ว แล้วพายุใหญ่ก็ก่อตัวขึ้น และฟ้าแลบวาบข้ามท้องฟ้าใต้ดิน ขณะที่แพของเราถูกซัดราวกับใบไม้",
        "พายุพาเราไปที่ชายฝั่งประหลาด ที่ซึ่งเราพบกระดูกของสัตว์ประหลาดโบราณและชื่อของซัคนุสเซมม์ที่แกะสลักบนหิน เราตามเส้นทางของเขาและมาถึงทางเดินแคบที่เราเข้าไปไม่ได้ ลุงของฉันจึงจุดชนวนดินระเบิดเพื่อทลายหินออก",
        "การระเบิดเปิดอุโมงค์ที่อยู่ข้างหลังเรา และแม่น้ำแห่งไฟ — ลาวาที่ไหล — พัดพาเราขึ้นไป ด้วยเสียงคำรามกึกก้อง ภูเขาไฟก็ปะทุ และเราถูกเหวี่ยงออกไปบนเนินเขาสีเขียวของอิตาลี เราข้ามโลกทั้งใบและกลับสู่ผิวน้ำ!"]
    },
    {
      id: "cur-sf-frankenstein", level: "B2", genre: "scifi",
      title: "Frankenstein",
      pages: ["A ship trapped in Arctic ice found a man near death on a floating block. His name was Victor Frankenstein, and he told the captain his terrible story — a warning that he begged the world to hear.",
        "Victor had been a brilliant student who loved science. He became obsessed with the secret of life itself. After years of secret work, he gathered the parts of dead bodies and used electricity to give a new being the spark of life.",
        "When the creature opened its yellow eyes, Victor was filled with horror. He fled his own creation. The lonely monster wandered the world, learning to speak and read, but every human who saw it screamed and drove it away.",
        "The creature found Victor at last. 'I'm miserable,' it said. 'You made me. You owe me a mate.' Victor refused at first, but the monster threatened his family, and he agreed to build a female companion.",
        "But as Victor worked, doubt filled his heart. What if the two monsters had children? What if they destroyed the world? In a fit of fear, he tore the new creature apart. The monster watched, and rage filled its heart.",
        "The monster killed Victor's brother, then his best friend, and finally his beloved bride Elizabeth on their wedding night. 'You destroyed my hope,' it said. 'Now you'll know my loneliness.' Victor swore to hunt it to the ends of the Earth.",
        "Victor chased the monster across frozen wastes until his health gave out. On the ship, he died. The monster appeared at his coffin, wept, and promised to end its own life. It leapt onto the ice and vanished into the darkness forever."],
      thPages: ["เรือที่ติดอยู่ในน้ำแข็งอาร์กติกพบชายคนหนึ่งใกล้ตายบนก้อนน้ำแข็งที่ลอยอยู่ ชื่อของเขาคือวิกเตอร์ แฟรงเกนสไตน์ และเขาเล่าเรื่องราวอันน่าสยดสยองของเขาให้กัปตันฟัง — คำเตือนที่เขาวิงวอนให้โลกได้ยิน",
        "วิกเตอร์เคยเป็นนักเรียนที่เก่งกาจผู้หลงใหลวิทยาศาสตร์ เขากลายเป็นคนหมกมุ่นกับความลับของชีวิต หลังจากทำงานอย่างลับๆ มาหลายปี เขารวบรวมชิ้นส่วนของศพและใช้ไฟฟ้าเพื่อมอบประกายแห่งชีวิตให้กับสิ่งมีชีวิตใหม่",
        "เมื่อสิ่งมีชีวิตนั้นลืมตาสีเหลือง วิกเตอร์เต็มไปด้วยความสยดสยอง เขาหนีจากสิ่งที่เขาสร้างขึ้น สัตว์ประหลาดผู้โดดเดี่ยวเร่ร่อนไปทั่วโลก เรียนรู้ที่จะพูดและอ่าน แต่ทุกมนุษย์ที่เห็นมันก็กรีดร้องและไล่มันไป",
        "ในที่สุดสิ่งมีชีวิตนั้นก็พบวิกเตอร์ 'ฉันทุกข์ทรมาน' มันพูด 'คุณสร้างฉันขึ้นมา คุณต้องมอบคู่ครองให้ฉัน' วิกเตอร์ปฏิเสธในตอนแรก แต่สัตว์ประหลาดข่มขู่ครอบครัวของเขา และเขาก็ตกลงที่จะสร้างคู่หูหญิงให้มัน",
        "แต่ขณะที่วิกเตอร์ทำงาน ความสงสัยก็เกาะกุมหัวใจของเขา จะเกิดอะไรขึ้นถ้าสัตว์ประหลาดสองตัวมีลูก? จะเกิดอะไรขึ้นถ้าพวกมันทำลายโลก? ด้วยความกลัว เขาจึงฉีกสิ่งมีชีวิตตัวใหม่ออกจากกัน สัตว์ประหลาดเฝ้าดู และความโกรธก็เกาะกุมหัวใจของมัน",
        "สัตว์ประหลาดฆ่าน้องชายของวิกเตอร์ แล้วก็เพื่อนสนิทของเขา และในที่สุดก็ฆ่าเอลิซาเบธเจ้าสาวผู้เป็นที่รักของเขาในคืนแต่งงาน 'คุณทำลายความหวังของฉัน' มันพูด 'ตอนนี้คุณจะรู้จักความโดดเดี่ยวของฉัน' วิกเตอร์สาบานว่าจะไล่ล่ามันจนสุดขอบโลก",
        "วิกเตอร์ไล่ตามสัตว์ประหลาดข้ามทุ่งน้ำแข็งจนสุขภาพของเขาทรุดโทรม บนเรือ เขาเสียชีวิต สัตว์ประหลาดปรากฏตัวที่โลงศพของเขา ร้องไห้ และสัญญาว่าจะยุติชีวิตของตัวเอง มันกระโดดขึ้นไปบนน้ำแข็งและหายไปในความมืดตลอดกาล"]
    },
    {
      id: "cur-mys-hound-baskerville", level: "B2", genre: "mystery",
      title: "The Hound of the Baskervilles",
      pages: ["In the misty moors of Devonshire, a great dog was said to haunt the Baskerville family. Legend told how Sir Hugo Baskerville was killed by a monstrous hound after a wicked crime, and his descendants were cursed from that day on.",
        "A hundred years later, Sir Charles Baskerville was found dead near his manor, his face twisted with terror. The only clue was a set of huge footprints — like those of a giant hound — leading away from his body.",
        "Dr. Mortimer brought the case to Sherlock Holmes. 'Keep my heir, Sir Henry, safe,' he begged. 'He arrives from America tomorrow.' Holmes sent his friend Dr. Watson to the manor to guard the young man and watch everyone closely.",
        "At Baskerville Hall, Watson met the strange butler Barrymore and his wife. One night he saw Barrymore signal with a candle from a window, and he discovered that the butler's brother was a dangerous convict hiding on the moors.",
        "Watson also met the naturalist Stapleton, who lived across the moor with his sister. A strange fog often rose from the bog, and Watson heard a sound like a great hound howling in the night. Stapleton warned him to stay away from the Grimpen Mire.",
        "Then Sherlock Holmes himself appeared, hidden on the moors. He had guessed the truth: Stapleton was a Baskerville in disguise, and he planned to kill the heir. The 'hound' was a huge, glowing dog he kept in the marsh, ready to be set loose.",
        "In the fog, the giant hound attacked Sir Henry. Holmes and Watson shot it as it leaped, and its glow faded. Stapleton fled into the bog and drowned in the mire. The curse of the Baskervilles was ended, and Sir Henry was safe."],
      thPages: ["ในทุ่งหมอกของเดวอนเชียร์ ว่ากันว่าสุนัขยักษ์สิงสถิตตระกูลแบสเกอร์วิลล์ ตำนานเล่าว่าเซอร์ฮูโก แบสเกอร์วิลล์ถูกสุนัขปีศาจฆ่าตายหลังก่ออาชญากรรมชั่วร้าย และลูกหลานของเขาถูกสาปตั้งแต่วันนั้นเป็นต้นมา",
        "ร้อยปีต่อมา เซอร์ชาร์ลส์ แบสเกอร์วิลล์ถูกพบเสียชีวิตใกล้คฤหาสน์ของเขา ใบหน้าบิดเบี้ยวด้วยความสยดสยอง เบาะแสเดียวคือรอยเท้าขนาดมหึมา — เหมือนรอยของสุนัขยักษ์ — ทอดออกไปจากร่างของเขา",
        "ดร.มอร์ติเมอร์นำคดีนี้มาหาเชอร์ล็อก โฮมส์ 'ช่วยดูแลทายาทของฉัน เซอร์เฮนรี ให้ปลอดภัยด้วย' เขาวิงวอน 'พรุ่งนี้เขาจะมาถึงจากอเมริกา' โฮมส์ส่งเพื่อนของเขา ดร.วัตสัน ไปที่คฤหาสน์เพื่อคุ้มครองชายหนุ่มและเฝ้าดูทุกคนอย่างใกล้ชิด",
        "ที่แบสเกอร์วิลล์ฮอลล์ วัตสันพบพ่อบ้านสุดลึกลับชื่อแบร์รีมอร์กับภรรยาของเขา คืนหนึ่งเขาเห็นแบร์รีมอร์ส่งสัญญาณด้วยเทียนจากหน้าต่าง และเขาค้นพบว่าน้องชายของพ่อบ้านคืออาชญากรอันตรายที่ซ่อนตัวอยู่บนทุ่ง",
        "วัตสันยังได้พบกับสเตเปิลตัน นักธรรมชาติวิทยา ที่อาศัยอยู่อีกฟากของทุ่งกับน้องสาวของเขา หมอกแปลกๆ มักลอยขึ้นจากหนองบึง และวัตสันได้ยินเสียงเหมือนสุนัขตัวใหญ่หอนในยามค่ำคืน สเตเปิลตันเตือนให้เขาอยู่ให้ห่างจากหนองกริมเพน",
        "แล้วเชอร์ล็อก โฮมส์เองก็ปรากฏตัว ซ่อนตัวอยู่บนทุ่ง เขารู้ความจริงแล้ว: สเตเปิลตันคือแบสเกอร์วิลล์ที่ปลอมตัว และเขาวางแผนจะฆ่าทายาท 'สุนัข' ที่ว่านั้นคือสุนัขตัวใหญ่เรืองแสงที่เขาเลี้ยงไว้ในหนอง พร้อมที่จะปล่อยออกมา",
        "ในหมอก สุนัขยักษ์โจมตีเซอร์เฮนรี โฮมส์และวัตสันยิงมันขณะที่มันกระโดด และแสงเรืองของมันก็มอดลง สเตเปิลตันหนีเข้าไปในหนองและจมน้ำตาย คำสาปของตระกูลแบสเกอร์วิลล์ก็สิ้นสุดลง และเซอร์เฮนรีก็ปลอดภัย"]
    },
    {
      id: "cur-mys-rue-morgue", level: "B2", genre: "mystery",
      title: "The Murders in the Rue Morgue",
      pages: ["In Paris, a terrible crime shook the city. In a locked room on the fourth floor of the Rue Morgue, the bodies of a mother and daughter were found. The mother's throat was cut, and the daughter had been strangled and thrown up the chimney.",
        "The door was locked from inside, and the windows were firmly shut. Money lay scattered on the floor, but nothing was stolen. People said the daughter had a voice too loud for a woman, and witnesses argued about a foreign language they had heard.",
        "The police were lost. But the great detective Auguste Dupin read the newspaper and saw the truth in the details. He noticed that the windows opened in a strange way, and that the daughter was wedged into the chimney with terrible force.",
        "Dupin examined the room himself. He found hairs on the mother's hand that were not human, and marks on the throat that no human hands could have made. 'This was no murder by a man,' he said quietly.",
        "The answer was a wild creature. A sailor had brought a huge orangutan back from Borneo. It had escaped, climbed into the window, and killed the women in a blind frenzy. The voices the witnesses heard were the cries of the beast.",
        "Dupin found the sailor through an advertisement and told him the whole story. The man was grateful to escape blame, and he told Dupin everything. The mystery of the Rue Morgue was solved by careful thought — and the police never understood a single step."],
      thPages: ["ในปารีส อาชญากรรมอันน่าสยดสยองสั่นสะเทือนทั้งเมือง ในห้องที่ถูกล็อกบนชั้นสี่ของถนนรูมอร์ก พบศพของแม่และลูกสาว ร่างของแม่ถูกเฉือนคอ และลูกสาวถูกรัดคอแล้วถูกโยนขึ้นไปในปล่องไฟ",
        "ประตูถูกล็อกจากด้านใน และหน้าต่างก็ปิดสนิท เงินกระจายอยู่บนพื้น แต่ไม่มีอะไรถูกขโมย ผู้คนกล่าวว่าลูกสาวมีเสียงดังเกินกว่าเสียงผู้หญิงปกติ และพยานเถียงกันเรื่องภาษาต่างประเทศที่พวกเขาได้ยิน",
        "ตำรวจงงไปหมด แต่ยอดนักสืบออกุสต์ ดูแปงอ่านหนังสือพิมพ์และเห็นความจริงในรายละเอียด เขาสังเกตว่าหน้าต่างเปิดได้แปลกๆ และลูกสาวถูกอัดเข้าไปในปล่องไฟด้วยแรงมหาศาล",
        "ดูแปงตรวจห้องด้วยตัวเอง เขาพบเส้นผมบนมือของแม่ที่ไม่ใช่ผมของมนุษย์ และรอยบนคอที่มือมนุษย์ทำไม่ได้ 'นี่ไม่ใช่การฆาตกรรมโดยมนุษย์' เขาพูดเสียงเบา",
        "คำตอบคือสัตว์ป่า กะลาสีคนหนึ่งนำอุรังอุตังตัวใหญ่กลับมาจากเกาะบอร์เนียว มันหนีออกมา ปีนเข้าไปในหน้าต่าง และฆ่าผู้หญิงทั้งสองด้วยความคลั่งไร้สติ เสียงที่พยานได้ยินคือเสียงร้องของสัตว์ร้าย",
        "ดูแปงหากะลาสีคนนั้นเจอด้วยการลงโฆษณา และเล่าเรื่องทั้งหมดให้เขาฟัง ชายคนนั้นโล่งใจที่ไม่ถูกกล่าวหา และเล่าทุกอย่างให้ดูแปงฟัง ปริศนาของถนนรูมอร์กถูกไขด้วยการคิดอย่างรอบคอบ — และตำรวจไม่เคยเข้าใจเลยสักก้าวเดียว"]
    },
    {
      id: "cur-cls-christmas-carol", level: "A2", genre: "classic",
      title: "A Christmas Carol",
      pages: ["Ebenezer Scrooge was the meanest man in London. He loved money, hated Christmas, and never gave a penny to the poor. 'Bah! Humbug!' he'd snap at anyone who wished him a merry Christmas.",
        "One Christmas Eve, the ghost of his old partner, Jacob Marley, appeared wrapped in heavy chains. 'I wore these chains because I was greedy,' Marley moaned. 'Tonight three spirits will visit you. Listen to them, or you'll suffer just like me.'",
        "The Ghost of Christmas Past showed Scrooge his boyhood — happy days he'd long forgotten. It showed him the woman he'd once loved, who had left him because his heart had grown so cold. Scrooge wept to see what he'd become.",
        "The Ghost of Christmas Present showed him the home of Bob Cratchit, his poor clerk, where the family enjoyed a simple feast together. Bob's little son, Tiny Tim, was ill. 'Will the boy live?' Scrooge asked. 'If nothing changes,' said the ghost, 'he will die.'",
        "The Ghost of Christmas Yet to Come showed Scrooge a grave with his own name on it — and greedy men who were glad he was dead. Scrooge fell to his knees. 'I'll change!' he cried. 'I promise to keep Christmas in my heart, all year long!'",
        "Scrooge woke up in his own bed, laughing with joy. He sent a huge turkey to the Cratchits, gave money to the poor, and walked through the streets wishing everyone a merry Christmas.",
        "From that day on, Scrooge kept his promise. He helped Tiny Tim, who lived, and became like a second father to him. And the people of London said that no one kept Christmas quite as well as Scrooge."],
      thPages: ["เอ็บเบเนเซอร์ สครูจเป็นคนใจร้ายที่สุดในลอนดอน เขารักเงิน เกลียดคริสต์มาส และไม่เคยยอมช่วยคนจนสักบาท 'บาห์! ฮัมบั๊ก!' เขาโมโหใส่ใครก็ตามที่อวยพรคริสต์มาสให้เขา",
        "คืนก่อนวันคริสต์มาส ผีของเจค็อบ มาร์ลีย์หุ้นส่วนเก่าของเขาปรากฏตัวขึ้น พร้อมโซ่หนักคล้องตัว 'ฉันสวมโซ่นี้เพราะความโลภของฉันเอง' มาร์ลีย์ครวญคราง 'คืนนี้วิญญาณสามตนจะมาเยือนคุณ ฟังพวกมันไว้ ไม่งั้นคุณจะเจ็บปวดเหมือนฉัน'",
        "ผีคริสต์มาสอดีตพาสครูจไปดูวัยเด็กของเขา — วันที่สดใสที่เขาลืมไปหมดแล้ว มันพาเขาไปดูผู้หญิงที่เขาเคยรัก ผู้ซึ่งจากไปเพราะหัวใจของเขาเย็นชาเกินไป สครูจร้องไห้เมื่อเห็นว่าตัวเองกลายเป็นคนแบบไหน",
        "ผีคริสต์มาสปัจจุบันพาเขาดูบ้านของบ็อบ แครทชิต เสมียนยากจนของเขา ที่ซึ่งทั้งครอบครัวนั่งกินอาหารง่ายๆ ร่วมกันอย่างอบอุ่น ทิมน้อยลูกชายตัวเล็กของบ็อบกำลังป่วย สครูจถามว่า 'เด็กคนนั้นจะรอดไหม?' ผีตอบว่า 'ถ้าไม่มีอะไรเปลี่ยน เขาจะต้องตาย'",
        "ผีคริสต์มาสที่ยังมาไม่ถึงพาเขาดูหลุมศพที่มีชื่อของเขาอยู่บนนั้น และพวกคนโลภที่ดีใจที่เขาตายไปแล้ว สครูจคุกเข่าลง 'ฉันจะเปลี่ยน!' เขาร้องไห้ 'ฉันสัญญาว่าจะเก็บคริสต์มาสไว้ในหัวใจตลอดทั้งปี!'",
        "สครูจตื่นขึ้นบนเตียงของตัวเอง หัวเราะอย่างมีความสุข เขาส่งไก่งวงตัวใหญ่ไปให้ครอบครัวแครทชิต แจกเงินให้คนยากจน แล้วเดินไปตามถนนอวยพรคริสต์มาสทุกคนที่เจอ",
        "ตั้งแต่วันนั้นมา สครูจก็รักษาสัญญา เขาช่วยทิมน้อยไว้ และทิมก็รอดชีวิต เขาเป็นเหมือนพ่อคนที่สองของทิม และชาวลอนดอนพูดเป็นเสียงเดียวกันว่า ไม่มีใครรู้จักวิธีเฉลิมฉลองคริสต์มาสได้ดีเท่าสครูจ"]
    },
    {
      id: "cur-cls-alice-wonderland", level: "A2", genre: "classic",
      title: "Alice in Wonderland",
      pages: ["Alice was sitting by the river with her sister when a white rabbit ran past, pulling a watch out of his pocket. 'I'm late!' he cried. Alice chased him down a rabbit hole and fell — fell slowly — down into a strange new world.",
        "She landed in a hall full of doors. On a table sat a bottle marked 'Drink me' and a cake marked 'Eat me.' When she drank, she shrank. When she ate, she grew taller than the house. Nothing made sense, but everything felt wonderful.",
        "Alice cried so much that she ended up swimming in a pool of her own tears. Then she joined a silly race with birds and animals, and everyone came out soaking wet and tired. 'Curiouser and curiouser,' she told herself.",
        "She met the White Rabbit again, who mistook her for his servant, and a blue caterpillar who smoked a hookah. 'Who are you?' the caterpillar asked. Alice sighed. 'I hardly know anymore — I keep changing all the time today!'",
        "At a long table she found the Mad Hatter, the March Hare, and a sleepy dormouse having tea. They asked her riddles and shuffled around the table, shouting, 'No room! No room!' Alice left them and wandered into a beautiful garden.",
        "In the garden she met the Queen of Hearts, who shouted, 'Off with their heads!' at the tiniest mistake. Alice played croquet with flamingos and hedgehogs, but the Queen wanted to behead even the players she didn't like.",
        "Then Alice was called to a trial about some stolen tarts. When the Queen ordered her head cut off, Alice cried, 'You're nothing but a pack of cards!' The cards flew up into the air — and Alice woke up on the riverbank. It had all been a dream."],
      thPages: ["อลิซกำลังนั่งอยู่ริมแม่น้ำกับพี่สาว ทันใดนั้นกระต่ายขาวตัวหนึ่งวิ่งผ่านมา คุ้ยหยิบนาฬิกาออกจากกระเป๋า 'ฉันสายแล้ว!' มันร้อง อลิซไล่ตามมันลงไปในโพรงกระต่าย แล้วก็ตกลงไปเรื่อยๆ ช้าๆ จนถึงโลกใหม่ที่แปลกประหลาด",
        "เธอตกลงไปในห้องโถงที่เต็มไปด้วยประตู บนโต๊ะมีขวดติดฉลากว่า 'ดื่มฉัน' และเค้กติดฉลากว่า 'กินฉัน' พอเธอดื่ม เธอก็หดเล็กลง พอเธอกิน เธอก็ตัวสูงจนใหญ่กว่าบ้าน ไม่มีอะไรสมเหตุสมผล แต่ทุกอย่างกลับวิเศษไปหมด",
        "อลิซร้องไห้หนักมากจนต้องว่ายอยู่ในแอ่งน้ำตาของตัวเอง แล้วเธอก็ไปร่วมแข่งวิ่งแปลกๆ กับนกและสัตว์ต่างๆ จนทุกคนเปียกปอนและเหนื่อยอ่อน 'แปลกขึ้นทุกที' เธอบอกตัวเอง",
        "เธอได้เจอกระต่ายขาวอีกครั้ง ซึ่งเข้าใจว่าเธอเป็นคนรับใช้ของมัน และหนอนผีเสื้อสีน้ำเงินที่กำลังสูบไปป์น้ำ 'เธอเป็นใคร?' หนอนถาม อลิซถอนหายใจ 'ฉันแทบไม่รู้ตัวเองแล้ว — วันนี้ฉันเปลี่ยนไปตลอด!'",
        "ที่โต๊ะยาว เธอเจอคนบ้าฮัทเตอร์ กระต่ายมีนาคม และดอร์เมาส์ง่วงนอนกำลังจัดงานน้ำชา พวกเขาถามปริศนาให้เธอเดา แล้วก็ผลัดกันย้ายที่นั่งรอบโต๊ะพร้อมตะโกนว่า 'ไม่มีที่! ไม่มีที่!' อลิซจึงจากมาแล้วเดินเข้าไปในสวนสวย",
        "ในสวนเธอเจอราชินีหัวใจ ผู้สั่ง 'ตัดหัวมันซะ!' กับทุกความผิดพลาดเล็กๆ น้อยๆ อลิซเล่นครอกเกต์กับฟลามิงโกและเม่น แต่ราชินีถึงกับอยากตัดหัวนักกีฬาที่เธอไม่ชอบใจด้วย",
        "แล้วอลิซก็ถูกเรียกไปร่วมพิจารณาคดีเกี่ยวกับทาร์ตที่ถูกขโมย เมื่อราชินีสั่งตัดหัวเธอ อลิซร้องว่า 'คุณก็แค่สำรับไพ่!' ไพ่ทั้งสำรับปลิวว่อนขึ้นไปในอากาศ — แล้วอลิซก็ตื่นขึ้นที่ริมแม่น้ำ ปรากฏว่าทั้งหมดเป็นเพียงความฝัน"]
    },
    {
      id: "cur-cls-little-prince", level: "B1", genre: "classic",
      title: "The Little Prince",
      pages: ["A pilot once crashed his plane in the desert. While he was fixing it, a small boy appeared and asked him to draw a sheep. The boy was the Little Prince, and he came from a tiny planet no bigger than a house.",
        "The Little Prince told the pilot about his planet, where a beautiful rose grew. He loved her dearly, but she was proud and vain. One day he grew tired of her and set off to see the wide world — and to learn what having friends really meant.",
        "He visited other planets. On one lived a king who ruled over nothing at all. On another lived a vain man who wanted everyone to admire him. A third belonged to a businessman who counted the stars and called them his fortune.",
        "On the next planet lived a lamplighter, who lit his lamp again and again because his planet spun faster and faster. 'He's the only one who isn't ridiculous,' thought the prince, 'because he cares about his duty.'",
        "At last the Little Prince reached Earth. He walked through a garden full of roses and felt sad, because his own rose had told him she was the only one of her kind. But a fox taught him a secret: 'It's the time you spend on your rose that makes her so important.'",
        "'You become responsible, forever, for what you've tamed,' said the fox. 'What's essential is invisible to the eye.' The Little Prince understood. He went back to his rose in his heart, ready to love and to be loved.",
        "At last the Little Prince left the pilot, saying he was going home to his planet and his rose. The pilot never saw him again, but every night he listened to the stars — as if they were a million little bells, laughing."],
      thPages: ["ครั้งหนึ่งนักบินคนหนึ่งตกเครื่องบินกลางทะเลทราย ตอนที่เขากำลังซ่อมเครื่องอยู่ ก็มีเด็กชายตัวเล็กๆ โผล่มาและขอให้เขาวาดรูปแกะให้หน่อย เด็กชายคนนั้นคือเจ้าชายน้อย เขามาจากดาวดวงจิ๋วที่ใหญ่ไม่เกินบ้านหลังหนึ่ง",
        "เจ้าชายน้อยเล่าให้นักบินฟังถึงดาวของเขา ที่มีกุหลาบแสนสวยงอกอยู่ เขารักเธอมาก แต่เธอช่างหยิ่งและขี้อวด วันหนึ่งเขาเบื่อเธอเข้าแล้ว จึงออกเดินทางไปดูโลกกว้าง และเรียนรู้ว่าการมีเพื่อนนั้นหมายความว่าอย่างไร",
        "เขาไปเยือนดาวดวงอื่นๆ ดวงหนึ่งมีกษัตริย์ที่ปกครองสิ่งที่ไม่มีจริง อีกดวงมีคนขี้โอ่ที่อยากให้ทุกคนชื่นชมเขา ดวงที่สามเป็นของนักธุรกิจที่นับดาวและเรียกมันว่าความมั่งคั่งของตัวเอง",
        "บนดาวดวงถัดไปมีคนจุดตะเกียง คอยจุดตะเกียงซ้ำแล้วซ้ำเล่าเพราะดาวของเขาหมุนเร็วขึ้นเรื่อยๆ 'เขาเป็นคนเดียวที่ไม่น่าขำ' เจ้าชายน้อยคิด 'เพราะเขารักหน้าที่ของตัวเอง'",
        "ในที่สุดเจ้าชายน้อยก็มาถึงโลก เขาเดินผ่านสวนที่เต็มไปด้วยกุหลาบแล้วรู้สึกเศร้า เพราะกุหลาบของเขาเองเคยบอกว่าเธอเป็นหนึ่งเดียวในสายพันธุ์ แต่สุนัขจิ้งจอกสอนความลับให้เขา 'เวลาที่เธอใช้กับกุหลาบของเธอต่างหาก ที่ทำให้เธอสำคัญ'",
        "'เธอต้องรับผิดชอบไปตลอดกาล สำหรับสิ่งที่เธอผูกพัน' จิ้งจอกกล่าว 'สิ่งที่สำคัญจริงๆ มองไม่เห็นด้วยตา' เจ้าชายน้อยเข้าใจ เขากลับหากุหลาบของเขาในหัวใจ พร้อมที่จะรักและถูกรัก",
        "ในที่สุดเจ้าชายน้อยก็ลาจากนักบินไป โดยบอกว่าเขาจะกลับดาวของเขา กลับหากุหลาบของเขา นักบินไม่เห็นเขาอีกเลย แต่ทุกคืนเขาจะเงยหน้าฟังดวงดาว ราวกับว่ามันเป็นระฆังเล็กๆ นับล้านใบที่กำลังหัวเราะ"]
    },
    {
      id: "cur-cls-wizard-oz", level: "A2", genre: "classic",
      title: "The Wizard of Oz",
      pages: ["Dorothy lived on a gray farm in Kansas with her dog, Toto. One day a huge cyclone lifted the little house into the air and carried it far, far away, to a strange and beautiful land full of colors.",
        "The house landed in Munchkin Country and squashed the Wicked Witch of the East. A good witch gave Dorothy a pair of silver shoes and said, 'Follow the yellow brick road to the Emerald City. The great Wizard of Oz can send you home.'",
        "On the way, Dorothy met a scarecrow who wanted a brain, a tin man who wanted a heart, and a cowardly lion who wanted courage. She invited them all to come and see the Wizard with her.",
        "After many dangers, they reached the Emerald City, where everything sparkled green. But the Wizard appeared as a giant head and turned them down. 'Bring me the Wicked Witch of the West's broom,' he demanded, 'and then I'll help you.'",
        "The Witch captured them and sent flying monkeys to attack. But Dorothy threw water on the Witch by accident — and the wicked woman melted away. The Munchkins were free, and Dorothy carried the Witch's golden broom back to the city.",
        "It turned out the Wizard was just a small, ordinary man hiding behind a curtain. Still, he gave the Scarecrow a brain made of bran, the Tin Man a silk heart, and the Lion a potion of courage. 'You always had these inside you,' he told them.",
        "The Wizard floated away in his balloon without Dorothy. But the good witch told her to click her silver shoes three times and say, 'There's no place like home.' The shoes carried her back to Kansas, where she hugged Aunt Em and Toto — safe at last."],
      thPages: ["โดโรธีอาศัยอยู่กับโตโต้ สุนัขของเธอ ในฟาร์มสีเทาแห่งหนึ่งที่แคนซัส วันหนึ่งพายุไซโคลนลูกยักษ์พัดบ้านหลังเล็กของเธอลอยขึ้นฟ้า แล้วพาไปไกลแสนไกล จนถึงดินแดนแห่งสีสันที่แปลกตาและสวยงาม",
        "บ้านไปตกลงที่เมืองมันช์กินส์ ลงไปทับแม่มดชั่วแห่งตะวันออก แม่มดใจดีมอบรองเท้าเงินคู่หนึ่งให้โดโรธี แล้วบอกว่า 'เดินตามถนนอิฐเหลืองไปจนถึงเมืองมรกต มหาจอมเวทแห่งออซจะส่งเธอกลับบ้านเอง'",
        "ระหว่างทาง โดโรธีเจอหุ่นไล่กาที่อยากได้สมอง มนุษย์ดีบุกที่อยากได้หัวใจ และสิงโตขี้ขลาดที่อยากได้ความกล้า เธอชวนพวกเขาทุกคนไปพบจอมเวทด้วยกัน",
        "หลังผ่านอันตรายมากมาย พวกเขาก็มาถึงเมืองมรกต ที่ซึ่งทุกอย่างเปล่งประกายเป็นสีเขียว แต่จอมเวทกลับโผล่มาเป็นแค่หัวยักษ์ แล้วปฏิเสธคำขอ 'ไปเอาไม้กวาดของแม่มดชั่วแห่งตะวันตกมา' เขาสั่ง 'แล้วฉันจะช่วยพวกเจ้า'",
        "แม่มดจับพวกเขาไว้แล้วปล่อยลิงบินมาโจมตี แต่โดโรธีเผลอสาดน้ำใส่แม่มดโดยไม่ได้ตั้งใจ หญิงชั่วร้ายนั้นก็ละลายหายไป มันช์กินส์เป็นอิสระ และโดโรธีก็นำไม้กวาดทองคำของแม่มดกลับไปที่เมือง",
        "ที่แท้จอมเวทก็เป็นแค่ชายตัวเล็กๆ ธรรมดาๆ ที่ซ่อนอยู่หลังม่านนั่นเอง ถึงอย่างนั้น เขาก็มอบสมองจากรำข้าวให้หุ่นไล่กา หัวใจผ้าไหมให้มนุษย์ดีบุก และยาน้ำแห่งความกล้าให้สิงโต 'พวกเจ้าครอบครองสิ่งเหล่านี้อยู่ในตัวมาอยู่แล้ว' เขาบอกพวกเขา",
        "จอมเวทบินจากไปในบอลลูนโดยไม่พาโดโรธี แต่แม่มดใจดีบอกให้เธอคลิกส้นรองเท้าเงินสามครั้งแล้วพูดว่า 'ไม่มีที่ไหนเหมือนบ้าน' รองเท้าพาเธอกลับถึงแคนซัส ที่ซึ่งเธอโผเข้ากอดป้าอีเอ็มและโตโต้ — ปลอดภัยในที่สุด"]
    },
    {
      id: "cur-fairy-snow-white", level: "A1", genre: "fairy",
      title: "Snow White",
      pages: ["A queen had a beautiful little daughter named Snow White, with skin as white as snow. When the queen died, the king married a proud new queen who owned a magic mirror. Every day she asked, 'Mirror, mirror, who is the fairest of them all?'",
        "For years the mirror answered, 'You, my queen, are the fairest of all.' But one day it said, 'Snow White is fairer than you.' The queen was furious, and she ordered a huntsman to take Snow White into the forest and kill her.",
        "The huntsman couldn't hurt such a kind girl. 'Run away, and never come back!' he cried. Snow White ran deep into the forest, where she found a tiny cottage with seven little chairs and seven little beds. It belonged to seven dwarfs.",
        "When the dwarfs came home, they loved Snow White at once and let her stay. 'But be careful,' they warned her. 'Your stepmother might find you.' Every morning they kissed her goodbye and went off to dig for gold.",
        "The evil queen learned the truth and came to the cottage dressed as an old woman. She offered Snow White a beautiful red apple, and one bite sent the girl into a deep sleep that looked like death.",
        "The dwarfs found her and laid her in a glass coffin on a hill, too sad for words. One day a handsome prince saw her and kissed her. The spell broke, and Snow White opened her eyes.",
        "The prince took her to his castle, and they were married with great joy. The wicked queen was never seen again, and Snow White and her seven dwarf friends lived happily together forever."],
      thPages: ["ราชินีองค์หนึ่งมีลูกสาวที่สวยงามชื่อสโนว์ไวท์ ผิวขาวราวกับหิมะ พอราชินีสิ้นพระชนม์ กษัตริย์ก็อภิเษกกับราชินีองค์ใหม่ที่หยิ่งยโสและมีกระจกวิเศษ ทุกวันเธอจะถามว่า 'กระจก กระจก ใครสวยที่สุดในโลก?'",
        "หลายปีที่กระจกตอบว่า 'ท่านราชินี ท่านสวยที่สุด' แต่วันหนึ่งมันกลับพูดว่า 'สโนว์ไวท์สวยกว่าท่าน' ราชินีโกรธจัด จึงสั่งนายพรานให้พาสโนว์ไวท์เข้าไปในป่าแล้วฆ่าเธอเสีย",
        "นายพรานทำใจทำร้ายเด็กใจดีแบบนี้ไม่ได้ 'หนีไปเถอะ แล้วอย่ากลับมาอีก!' เขาร้อง สโนว์ไวท์วิ่งเข้าไปลึกในป่า แล้วพบกระท่อมหลังเล็กที่มีเก้าอี้เล็กๆ เจ็ดตัวกับเตียงเล็กๆ เจ็ดเตียง มันเป็นบ้านของคนแคระทั้งเจ็ด",
        "พอคนแคระกลับบ้าน พวกเขาก็รักสโนว์ไวท์ทันทีและยอมให้เธออยู่ด้วย 'แต่ระวังนะ' พวกเขาเตือน 'แม่เลี้ยงของเธออาจตามหาเธอเจอ' ทุกเช้าพวกเขาจะจูบเธอลา แล้วออกไปขุดทอง",
        "ราชินีชั่วร้ายรู้ความจริง จึงมาที่กระท่อมโดยปลอมตัวเป็นหญิงชรา เธอยื่นแอปเปิลแดงสวยงามให้สโนว์ไวท์ และแค่คำกัดเดียวก็ทำให้เด็กสาวหลับลึก ราวกับตายไปแล้ว",
        "คนแคระพบเธอและวางเธอไว้ในโลงแก้วบนเนินเขา เศร้าเกินกว่าจะพูดอะไรได้ วันหนึ่งเจ้าชายรูปงามมาเห็นเธอและจูบเธอ เสน่ห์สลาย และสโนว์ไวท์ก็ลืมตาขึ้น",
        "เจ้าชายพาเธอไปยังปราสาทของเขา และทั้งคู่ก็แต่งงานกันอย่างมีความสุขยิ่งนัก ราชินีชั่วร้ายไม่ปรากฏตัวอีกเลย และสโนว์ไวท์กับเพื่อนคนแคระทั้งเจ็ดก็อยู่ร่วมกันอย่างมีความสุขตลอดไป"]
    },
    {
      id: "cur-fairy-beauty-beast", level: "A2", genre: "fairy",
      title: "Beauty and the Beast",
      pages: ["A rich merchant lost all his money, and his family had to move into a small cottage. His youngest daughter, Beauty, was kind and good, and she loved her father far more than the fine dresses she no longer had.",
        "One winter, the merchant lost his way in a dark forest. He found a great castle, empty and strange, and slept there. In the garden he picked a single rose for Beauty. A terrible Beast appeared and roared, 'You've stolen my rose! You must pay with your life!'",
        "'Please spare me, for my daughter's sake,' begged the merchant. The Beast agreed, on one condition: someone had to come to the castle in his place. When Beauty heard the story, she said, 'Father, I'll go to the Beast myself.'",
        "At the castle, Beauty expected a monster. Instead, the Beast was gentle and gave her everything she wished for. Every evening he asked, 'Beauty, will you marry me?' And every time she answered, 'No, Beast.' But she grew fond of his kindness.",
        "One day a magic mirror showed Beauty her father, who was ill. She begged the Beast to let her visit home. 'Go,' he said sadly, 'but if you don't come back in seven days, I will die.' Beauty hurried home to her father.",
        "Her sisters talked her into staying longer. Then one night Beauty dreamed of the Beast, dying in his garden. She rushed back to the castle and found him weak beside the rose. 'I couldn't live without you,' he whispered.",
        "Beauty wept. 'I love you, Beast,' she said. 'You'll be my husband.' The spell broke, and the Beast became a handsome prince. They married and lived happily, and Beauty learned that true beauty is found in the heart."],
      thPages: ["พ่อค้าผู้ร่ำรวยคนหนึ่งเสียทรัพย์สินไปหมด ครอบครัวของเขาจึงต้องย้ายไปอาศัยในกระท่อมเล็กๆ ลูกสาวคนเล็กชื่อบิวตี้เป็นคนใจดีและดีงาม เธอรักพ่อมากกว่าชุดสวยๆ ที่เธอไม่มีแล้วเสียอีก",
        "ฤดูหนาวปีหนึ่ง พ่อค้าหลงทางในป่ามืดทึบ เขาไปพบปราสาทใหญ่ที่ว่างเปล่าและประหลาด แล้วนอนพักอยู่ที่นั่น ในสวน เขาเด็ดกุหลาบดอกเดียวเพื่อบิวตี้ ทันใดนั้นสัตว์ร้ายที่น่าสะพรึงกลัวก็ปรากฏตัวและคำราม 'เจ้าขโมยกุหลาบของฉัน! เจ้าต้องชดใช้ด้วยชีวิต!'",
        "'ได้โปรดไว้ชีวิตฉันเถอะ เพื่อลูกสาวของฉัน' พ่อค้าวิงวอน สัตว์ร้ายยอม โดยมีเงื่อนไขเดียว: ต้องมีใครสักคนมาแทนเขาที่ปราสาท พอบิวตี้ฟังเรื่องราวจบ เธอก็พูดว่า 'พ่อ หนูจะไปหาสัตว์ร้ายเอง'",
        "ที่ปราสาท บิวตี้คิดว่าจะต้องเจอสัตว์ประหลาด แต่กลับไม่ใช่เลย สัตว์ร้ายอ่อนโยนและให้ทุกสิ่งที่เธอปรารถนา ทุกเย็นมันจะถามว่า 'บิวตี้ เจ้าจะแต่งงานกับฉันไหม?' และทุกครั้งเธอก็ตอบว่า 'ไม่ สัตว์ร้าย' แต่เธอเริ่มชอบใจในความใจดีของมันมากขึ้นเรื่อยๆ",
        "วันหนึ่งกระจกวิเศษเผยให้บิวตี้เห็นพ่อของเธอที่กำลังป่วย เธอวิงวอนให้สัตว์ร้ายปล่อยเธอกลับบ้าน 'ไปเถอะ' มันพูดอย่างเศร้าใจ 'แต่ถ้าเจ้าไม่กลับมาภายในเจ็ดวัน ฉันจะตาย' บิวตี้รีบกลับบ้านไปหาพ่อ",
        "พี่สาวของเธอชักชวนให้อยู่ต่ออีกหน่อย แล้วคืนหนึ่งบิวตี้ฝันเห็นสัตว์ร้ายกำลังจะตายอยู่ในสวนของมัน เธอรีบวิ่งกลับปราสาททันที แล้วพบว่ามันอ่อนแรงอยู่ข้างกุหลาบ 'ฉันอยู่ไม่ได้ถ้าไม่มีเจ้า' มันกระซิบ",
        "บิวตี้น้ำตาไหล 'ฉันรักคุณ สัตว์ร้าย' เธอพูด 'คุณจะเป็นสามีของฉัน' เสน่ห์สลาย สัตว์ร้ายกลายเป็นเจ้าชายรูปงาม ทั้งคู่แต่งงานกันและใช้ชีวิตอย่างมีความสุข บิวตี้เรียนรู้ว่าความงามที่แท้จริงนั้นอยู่ที่หัวใจ"]
    },
    {
      id: "cur-ghost-fall-house-usher", level: "B2", genre: "ghost",
      title: "The Fall of the House of Usher",
      pages: ["One dull autumn day, I rode toward the House of Usher. Even from afar, the ancient mansion filled me with dread. Its walls were black with damp, and a crack ran from the roof all the way down to the dark water below.",
        "My friend Roderick Usher awaited me. He was pale and nervous, and there was a haunted look in his eyes. 'I am sick,' he said. 'My senses are too sharp. Every sound is a torture.' He feared the darkness and his own family curse.",
        "Roderick lived with his twin sister Madeline, who was wasting away from a strange illness. 'When she dies, I shall be the last of the Ushers,' he whispered. Her illness filled him with a nameless terror.",
        "One evening Madeline fell into a deathlike trance, and Roderick believed she had died. We carried her to a vault beneath the house and shut the iron door. He wanted to keep her one last time, even in death.",
        "That night a storm raged. Strange sounds echoed through the halls, and Roderick grew wilder. 'I know what I heard!' he screamed. 'I buried her alive — and now she is knocking!' The door burst open, and Madeline stood there, covered in blood.",
        "She fell upon her brother, and they died together in each other's arms. I fled the house in terror. Behind me, the great crack widened, and the entire House of Usher sank into the dark tarn, swallowed by the earth forever."],
      thPages: ["วันหนึ่งในฤดูใบไม้ร่วงที่มืดครึ้ม ฉันขี่ม้ามุ่งหน้าไปยังคฤหาสน์อัสเชอร์ แม้แต่จากที่ไกล ตัวคฤหาสน์โบราณก็ทำให้ฉันรู้สึกหวาดกลัว กำแพงดำคล้ำไปด้วยความชื้น และมีรอยร้าวทอดยาวจากหลังคาลงไปถึงผืนน้ำมืดเบื้องล่าง",
        "โรเดอริค อัสเชอร์ เพื่อนของฉัน รอฉันอยู่ เขาหน้าซีดและกระสับกระส่าย แววตาหลอนลึก 'ฉันป่วย' เขากล่าว 'ประสาทสัมผัสของฉันไวเกินไป ทุกเสียงคือการทรมาน' เขากลัวทั้งความมืดและคำสาปของตระกูลตัวเอง",
        "โรเดอริคอาศัยอยู่กับแมเดอลีนน้องสาวฝาแฝด ซึ่งกำลังร่วงโรยจากอาการป่วยประหลาด 'เมื่อเธอตาย ฉันจะเป็นคนสุดท้ายของตระกูลอัสเชอร์' เขากระซิบ ความเจ็บป่วยของเธอทำให้เขาหวาดกลัวอย่างอธิบายไม่ถูก",
        "เย็นวันหนึ่งแมเดอลีนตกอยู่ในภวังค์ที่ดูราวกับตาย และโรเดอริคเชื่อว่าเธอเสียชีวิตแล้ว เราอุ้มเธอไปที่ห้องใต้ดินของบ้านแล้วปิดประตูเหล็ก เขาอยากเก็บเธอไว้ให้ได้อีกสักครั้ง แม้แต่ในความตาย",
        "คืนนั้นพายุโหมกระหน่ำ เสียงประหลาดก้องสะท้อนไปทั่วโถง และโรเดอริคก็ยิ่งบ้าคลั่ง 'ฉันรู้ว่าฉันได้ยินอะไร!' เขากรีดร้อง 'ฉันฝังเธอทั้งเป็น — และตอนนี้เธอกำลังเคาะประตู!' ประตูบานใหญ่เปิดออกอย่างแรง และแมเดอลีนยืนอยู่ตรงนั้น ทั้งร่างเปื้อนเลือด",
        "เธอซบลงบนตัวพี่ชาย และทั้งสองก็ตายไปด้วยกันในอ้อมกอดของกันและกัน ฉันหนีออกจากบ้านด้วยความสยดสยอง ข้างหลังฉัน รอยร้าวขยายกว้างขึ้นเรื่อยๆ จนคฤหาสน์อัสเชอร์ทั้งหลังจมลงสู่บึงน้ำมืด ถูกแผ่นดินกลืนหายไปตลอดกาล"]
    },
    {
      id: "cur-ghost-dracula", level: "B2", genre: "ghost",
      title: "Dracula",
      pages: ["A young English lawyer named Jonathan Harker traveled to a distant castle in Transylvania to meet his client, Count Dracula. The mountains were wild, and the local people crossed themselves in fear whenever they heard the Count's name.",
        "Inside the castle, Jonathan found the Count strange and pale. Dracula never ate, and he never appeared in daylight. He slept in a coffin filled with earth, and his reflection did not show in the mirror. At last Jonathan understood: this was not a man.",
        "One night the Count crawled down the castle wall like a great bat. Jonathan discovered three pale women in a hidden room and barely escaped with his life. He fled the castle, leaving it to his friend, the ship's doctor Van Helsing, to learn the truth later.",
        "Back in England, Jonathan's wife Mina and her friend Lucy were in danger. Lucy grew pale and weak, with two small marks on her neck. Van Helsing realized at once: a vampire was feeding on her, night after night.",
        "They tried to save Lucy with garlic and silver, but the vampire returned each night. At last Lucy died and rose again as a creature of the night. Van Helsing and his friends drove a stake through her heart, freeing her soul, and swore to destroy the vampire.",
        "They learned that Dracula had fled to London and bought a house there. Following his boxes of earth, they hunted him across the city. Van Helsing found the lair and cleansed the boxes, destroying the vampire's refuge, while Dracula slipped away to the sea.",
        "The chase led them to Transylvania, where they cornered Dracula at his castle at sunset. Jonathan struck with his knife, and Van Helsing cut the Count's throat. The vampire turned to dust, and Mina was freed. The curse was broken forever."],
      thPages: ["ทนายหนุ่มชาวอังกฤษชื่อโจนาธาน ฮาร์เกอร์ เดินทางไปปราสาทอันห่างไกลในทรานซิลเวเนียเพื่อพบลูกความของเขา เคาท์แดรกคูลา ภูเขาที่นั่นดุร้ายและเปลี่ยว และชาวบ้านต่างทำเครื่องหมายกางเขนด้วยความกลัวเมื่อได้ยินชื่อของเคาท์",
        "ในปราสาท โจนาธานพบว่าเคาท์มีท่าทางแปลกและหน้าซีด แดรกคูลาไม่เคยกินอะไรเลยและไม่เคยออกมาในตอนกลางวัน เขานอนในโลงศพที่เต็มไปด้วยดิน และไม่มีเงาสะท้อนของเขาในกระจก ในที่สุดโจนาธานก็รู้ว่าเขาไม่ใช่มนุษย์",
        "คืนหนึ่งเคาท์คลานลงมาจากกำแพงปราสาทราวกับค้างคาวยักษ์ โจนาธานพบผู้หญิงหน้าซีดสามคนในห้องลับ และแทบเอาชีวิตไม่รอด เขาหนีออกจากปราสาท ปล่อยให้เพื่อนของเขา แวน เฮลซิง แพทย์ประจำเรือ ค้นหาความจริงทีหลัง",
        "กลับมาที่อังกฤษ มีนา ภรรยาของโจนาธาน และลูซี่ เพื่อนของเธอ กำลังตกอยู่ในอันตราย ลูซี่เริ่มหน้าซีดและอ่อนแอลง มีรอยเล็กๆ สองรอยที่คอของเธอ แวน เฮลซิงเข้าใจทันที: มีแวมไพร์กำลังดูดเลือดเธออยู่ทุกคืน",
        "พวกเขาพยายามช่วยลูซี่ด้วยกระเทียมและเครื่องเงิน แต่แวมไพร์ก็กลับมาทุกคืน ในที่สุดลูซี่ก็ตายและฟื้นขึ้นมาเป็นสิ่งมีชีวิตแห่งรัตติกาล แวน เฮลซิงและเพื่อนๆ ใช้หลักปักที่หัวใจของเธอเพื่อปลดปล่อยวิญญาณ แล้วก็สาบานว่าจะทำลายแวมไพร์ให้สิ้นซาก",
        "พวกเขารู้ว่าแดรกคูลาหนีไปลอนดอนและซื้อบ้านไว้ที่นั่น พวกเขาตามหากล่องดินของมันไปทั่วเมือง แวน เฮลซิงพบที่ซ่อนและชำระกล่องทั้งหมด ทำลายที่หลบภัยของแวมไพร์ ขณะที่แดรกคูลาหลุดรอดหนีไปทางทะเล",
        "การไล่ล่าพาพวกเขากลับไปที่ทรานซิลเวเนีย ที่ซึ่งพวกเขาต้อนแดรกคูลาให้จนมุมที่ปราสาทของมันในยามตะวันตกดิน โจนาธานแทงมันด้วยมีด และแวน เฮลซิงก็เฉือนคอเคาท์ แวมไพร์กลายเป็นฝุ่นธุลี มินาเป็นอิสระ และคำสาปก็ถูกทำลายตลอดกาล"]
    },
    {
      id: "cur-adv-gulliver", level: "B1", genre: "adventure",
      title: "Gulliver's Travels",
      pages: ["I'm Lemuel Gulliver, a ship's surgeon. My life has been full of strange journeys, but none stranger than my first voyage to the land of Lilliput, where the people were no taller than my thumb.",
        "After my ship was wrecked, I woke up on the shore. I couldn't move! Hundreds of tiny ropes held me to the ground, and a crowd of little people climbed over my body with spears and ladders.",
        "They fed me and built a great wooden platform to carry me to their city. I was their prisoner, but they treated me kindly. I learned their language and promised to obey their laws.",
        "The king of Lilliput asked me to help his army fight the neighboring land of Blefuscu. I crossed the channel, tied their whole fleet with one rope, and pulled the ships to Lilliput. The king was delighted.",
        "But the king wanted me to destroy Blefuscu forever, and I refused. I wouldn't help him enslave an entire nation. From that moment, the king and his court plotted against me, and my life was in danger.",
        "I escaped to Blefuscu, where I found a small boat and sailed away. A passing ship rescued me and carried me home to England, where I told my friends the most amazing story they had ever heard."],
      thPages: ["ฉันคือเลมูเอล กัลลิเวอร์ ศัลยแพทย์ประจำเรือ ชีวิตของฉันเต็มไปด้วยการเดินทางแปลกประหลาด แต่ไม่มีครั้งไหนแปลกไปกว่าการเดินทางครั้งแรกสู่ดินแดนลิลลิพุต ที่ซึ่งผู้คนตัวเล็กไม่สูงไปกว่านิ้วหัวแม่มือของฉัน",
        "หลังจากเรือของฉันอับปาง ฉันตื่นขึ้นมาบนชายฝั่ง ขยับไม่ได้เลย! เชือกเส้นเล็กๆ นับร้อยมัดฉันแน่นกับพื้น และฝูงคนตัวเล็กปีนขึ้นมาบนตัวฉันพร้อมหอกและบันได",
        "พวกเขาเลี้ยงอาหารฉันและสร้างแท่นไม้ขนาดใหญ่เพื่อขนฉันไปยังเมืองของพวกเขา ฉันเป็นนักโทษของพวกเขา แต่พวกเขาปฏิบัติกับฉันดีมาก ฉันเรียนรู้ภาษาของพวกเขาและสัญญาว่าจะเชื่อฟังกฎหมาย",
        "กษัตริย์แห่งลิลลิพุตขอให้ฉันช่วยกองทัพของเขาสู้กับดินแดนเพื่อนบ้านเบลฟุสคู ฉันข้ามช่องแคบ ผูกกองเรือทั้งหมดของพวกเขาด้วยเชือกเส้นเดียว แล้วลากเรือทั้งหมดมาที่ลิลลิพุต กษัตริย์พอใจมาก",
        "แต่กษัตริย์ต้องการให้ฉันทำลายเบลฟุสคูให้สิ้นซาก และฉันปฏิเสธ ฉันจะไม่ช่วยเขาทำให้คนทั้งชาติตกเป็นทาส ตั้งแต่นั้นมา กษัตริย์และข้าราชสำนักก็วางแผนร้ายต่อฉัน และชีวิตของฉันก็ตกอยู่ในอันตราย",
        "ฉันหนีไปเบลฟุสคู ซึ่งฉันพบเรือเล็กและแล่นจากไป เรือที่แล่นผ่านช่วยฉันไว้และพาฉันกลับบ้านที่อังกฤษ ซึ่งฉันได้เล่าเรื่องสุดอัศจรรย์ที่สุดเท่าที่เพื่อนๆ เคยได้ยินมา"]
    },
    {
      id: "cur-adv-monkey-temple", level: "B1", genre: "adventure",
      title: "The Lost Temple of the Monkey God",
      pages: ["Dr. Elena Rivera was a young archaeologist who had spent ten years hunting for the lost Monkey Temple of the Amazon. An old map, passed down in her family, showed its secret location high in the green mountains.",
        "She gathered a small team: Marcos, a brave guide, and Lena, a botanist who knew every plant in the jungle. They paddled upriver for days, past howling monkeys and giant trees, until the river turned to rocks.",
        "Deep in the forest they found a stone wall covered in moss. Behind it lay a hidden staircase that led down into the earth. Torches in hand, they descended into a cool, dark hall carved with golden monkeys.",
        "At the center of the hall stood a great stone altar, and on it rested a box of solid gold. Lena gasped. 'We found it!' she whispered. But the floor began to tremble, and the walls started to close in.",
        "A trap! The ancient builders had guarded their treasure well. Marcos spotted a small hole in the altar, shaped like a monkey's head. Elena pressed it, and the walls stopped moving. The treasure was theirs.",
        "They carried the golden box to the surface and shared its wealth with the nearby village, which had protected the secret for generations. Elena kept only one golden monkey, a memento of the greatest adventure of her life."],
      thPages: ["ดร.เอเลน่า ริเวร่าเป็นนักโบราณคดีสาวที่ใช้เวลาสิบปีตามล่าวัดลิงแห่งอเมซอนที่สูญหาย แผนที่เก่าที่สืบทอดกันมาในครอบครัวของเธอ เผยตำแหน่งลับของมันบนเทือกเขาสีเขียวสูงตระหง่าน",
        "เธอจัดตั้งทีมเล็กๆ: มาร์คอส ไกด์ผู้กล้าหาญ และลีน่า นักพฤกษศาสตร์ที่รู้จักต้นไม้ทุกชนิดในป่า พวกเขาพายเรือทวนน้ำขึ้นไปหลายวัน ผ่านลิงที่หอนโหยหวนและต้นไม้ยักษ์ จนแม่น้ำเต็มไปด้วยโขดหิน",
        "ลึกเข้าไปในป่า พวกเขาพบกำแพงหินที่ปกคลุมไปด้วยมอส ด้านหลังมีบันไดลับทอดลงใต้ดิน ถือคบเพลิงไว้ในมือ พวกเขาลงไปในห้องโถงที่เย็นและมืด ซึ่งสลักเป็นรูปลิงทองคำ",
        "กลางห้องโถงมีแท่นหินใหญ่ และบนนั้นมีกล่องทองคำบริสุทธิ์วางอยู่ ลีน่าอ้าปากค้าง 'เราพบมันแล้ว!' เธอกระซิบ แต่แล้วพื้นก็เริ่มสั่น และกำแพงก็เริ่มเคลื่อนเข้ามาหาพวกเขา",
        "กับดัก! ผู้สร้างโบราณวางกับดักไว้ป้องกันสมบัติของตน มาร์คอสสังเกตเห็นรูเล็กๆ บนแท่นหิน รูปทรงคล้ายหัวลิง เอเลน่ากดมัน กำแพงก็หยุดเคลื่อน และสมบัติก็เป็นของพวกเขา",
        "พวกเขาขนกล่องทองคำขึ้นสู่ผิวน้ำและแบ่งสมบัติให้หมู่บ้านใกล้เคียง ซึ่งปกป้องความลับนี้มาหลายชั่วอายุคน เอเลน่าเก็บลิงทองคำไว้หนึ่งตัวเป็นของที่ระลึกของการผจญภัยที่ยิ่งใหญ่ที่สุดในชีวิตของเธอ"]
    },
    {
      id: "cur-adv-sky-sailors", level: "B1", genre: "adventure",
      title: "The Sky Sailors",
      pages: ["In 1889, the airship Aurora drifted over the clouds with its brave crew: Captain Reyes, the engineer Sofia, and the young navigator Tomas. They were mapping the unknown winds of the Atlantic.",
        "One evening a wild storm seized the airship. Lightning struck the rudder, and the engines failed. The Aurora fell through the clouds and crashed onto a plateau hidden high above the ocean, a place no map had ever shown.",
        "The crew found the plateau full of wonders: purple flowers, giant birds, and a great stone tower built by an ancient people. Inside the tower, paintings told the story of a civilization that once ruled the sky.",
        "The paintings showed a secret: the ancients had learned to fill a great balloon with hot air to cross the mountains. Sofia studied the drawings and rebuilt the balloon with the airship's canvas and ropes.",
        "The three friends gathered food and water, filled the great balloon, and rose into the sky just as the storm returned. Below them, the hidden plateau vanished into the clouds forever.",
        "They sailed back to civilization, where their story of the floating island amazed the world. Captain Reyes wrote it all in his journal, and from that day, no one doubted the courage of the Sky Sailors."],
      thPages: ["ในปี ค.ศ. 1889 เรือเหาะออโรร่าลอยเหนือเมฆพร้อมลูกเรือผู้กล้าหาญ: กัปตันเรเยส วิศวกรโซเฟีย และโทมัสผู้นำทางหนุ่ม พวกเขากำลังสำรวจลมที่ไม่เคยรู้จักของมหาสมุทรแอตแลนติก",
        "เย็นวันหนึ่งพายุร้ายก็โจมตีเรือเหาะ ฟ้าผ่าลงที่หางเสือ และเครื่องยนต์ก็ขัดข้อง ออโรร่าตกลงผ่านเมฆและชนบนที่ราบสูงที่ซ่อนตัวอยู่เหนือมหาสมุทร สถานที่ที่ไม่ปรากฏบนแผนที่ใดเลย",
        "ลูกเรือพบว่าที่ราบสูงเต็มไปด้วยสิ่งมหัศจรรย์: ดอกไม้สีม่วง นกยักษ์ และหอคอยหินใหญ่ที่สร้างโดยคนโบราณ ภายในหอคอย ภาพวาดบนผนังเล่าเรื่องราวของอารยธรรมที่เคยครองท้องฟ้า",
        "ภาพวาดเผยความลับ: คนโบราณเรียนรู้ที่จะเติมบอลลูนใหญ่ด้วยลมร้อนเพื่อข้ามภูเขา โซเฟียศึกษาแบบภาพวาดแล้วสร้างบอลลูนขึ้นใหม่ด้วยผ้าใบและเชือกของเรือเหาะ",
        "เพื่อนสามคนเก็บอาหารและน้ำ เติมลมร้อนใส่บอลลูนใหญ่ แล้วลอยขึ้นสู่ท้องฟ้าพอดีกับที่พายุหวนกลับมา เบื้องล่าง ที่ราบสูงลับตาก็หายไปในหมู่เมฆตลอดกาล",
        "พวกเขาแล่นกลับสู่อารยธรรม ซึ่งเรื่องราวของเกาะลอยฟ้าทำให้คนทั้งโลกตะลึง กัปตันเรเยสจดเรื่องราวทั้งหมดลงในสมุดบันทึก และตั้งแต่วันนั้น ไม่มีใครสงสัยความกล้าหาญของนักบินนภา"]
    },
    {
      id: "cur-adv-volcano-island", level: "B1", genre: "adventure",
      title: "The Secret Volcano Island",
      pages: ["Professor Aldo Bruno believed that an island of fire rose and sank in the southern ocean. His students laughed at the idea, but the government sent a ship to search, and Aldo went along as a guest.",
        "After three weeks at sea, a sailor saw smoke on the horizon. There, rising from the waves, was a black volcanic island covered in green forests. Aldo cried out with joy. 'There she is! I was right!'",
        "The crew anchored the ship and explored the island. They found hot springs, caves full of glowing crystals, and strange birds that sang like flutes. But at the mountain's heart, something rumbled like thunder.",
        "Aldo studied the rocks and saw the truth. The volcano was waking up. 'We have to leave!' he shouted. 'The mountain is about to explode!' The crew raced back to the ship, but the sea was already boiling.",
        "They launched the lifeboats just as the volcano erupted. Fire and smoke filled the sky, and the whole island began to sink into the waves. The ship was lost, but every sailor was saved.",
        "Back home, Aldo published his discovery. The island he had dreamed of had risen from the sea, and he had seen it with his own eyes. His students honored him, and his name entered the history of great explorers."],
      thPages: ["ศาสตราจารย์อัลโด บรูโนเชื่อว่ามีเกาะไฟโผล่ขึ้นมาและจมลงในมหาสมุทรทางใต้ ลูกศิษย์ของเขาหัวเราะเยาะความคิดนั้น แต่รัฐบาลส่งเรือออกค้นหา และอัลโดก็ขอร่วมเดินทางไปด้วย",
        "หลังจากอยู่กลางทะเลสามสัปดาห์ กะลาสีคนหนึ่งเห็นควันบนขอบฟ้า ที่นั่น เกาะภูเขาไฟสีดำที่ปกคลุมด้วยป่าเขียวขจีโผล่พ้นคลื่นขึ้นมา อัลโดร้องด้วยความดีใจ 'มันอยู่ที่นั่น! ฉันพูดถูก!'",
        "ลูกเรือทอดสมอแล้วขึ้นสำรวจเกาะ พวกเขาพบน้ำพุร้อน ถ้ำที่เต็มไปด้วยคริสตัลเรืองแสง และนกแปลกๆ ที่ร้องเหมือนเสียงขลุ่ย แต่ที่ใจกลางภูเขา มีเสียงบางอย่างคำรามราวกับฟ้าร้อง",
        "อัลโดศึกษาหินและเห็นความจริง ภูเขาไฟกำลังตื่นขึ้น 'เราต้องหนีออกไป!' เขาตะโกน 'ภูเขากำลังจะระเบิด!' ลูกเรือวิ่งกลับไปที่เรือ แต่ทะเลเดือดพล่านไปหมดแล้ว",
        "พวกเขาปล่อยเรือชูชีพลงน้ำพอดีกับที่ภูเขาไฟปะทุ ไฟและควันเต็มท้องฟ้า และทั้งเกาะเริ่มจมลงสู่คลื่น เรือหลักจมสูญหายไป แต่กะลาสีทุกคนรอดชีวิต",
        "เมื่อกลับถึงบ้าน อัลโดตีพิมพ์การค้นพบของเขา เกาะที่เขาเคยฝันถึงได้โผล่ขึ้นมาจากทะเล และเขาได้เห็นมันด้วยตาตัวเอง ลูกศิษย์ยกย่องเขา และชื่อของเขาถูกจารึกไว้ในประวัติศาสตร์ของนักสำรวจผู้ยิ่งใหญ่"]
    },
    {
      id: "cur-sf-martian-encounter", level: "B2", genre: "scifi",
      title: "The Martian Encounter",
      pages: [
        "Dr. Amara Okafor ran the first research station on Mars. For two years she had studied the red sand and the empty sky. Then one morning, the radar detected something moving beneath the surface.",
        "The sensors showed a shape, huge and silent, traveling under the ice near the great canyon. Amara and her crew drove their rover to investigate, hearts racing with wonder and fear.",
        "They found a door of dark metal buried in the ground. It opened by itself, and a soft blue light rose from below. 'This is not ours,' Amara whispered. 'This was here long before we came.'",
        "Inside, they found a chamber covered in glowing symbols. A gentle voice spoke in perfect English. 'We are the builders of this place. We left a gift for those who would come after us.'",
        "The gift was a crystal that held the knowledge of an entire civilization — the secrets of clean energy, of healing, and of reaching the stars. Amara understood: the Martians had vanished long ago, but they had chosen to help us.",
        "Amara carried the crystal back to Earth, where it changed the world. She never stopped wondering who the Martians were, but she knew one thing for certain: somewhere among the stars, a great people were watching over us."
      ],
      thPages: [
        "ดร.อามาร่า โอกาโฟร์เป็นผู้นำสถานีวิจัยแห่งแรกบนดาวอังคาร สองปีที่เธอศึกษาทรายสีแดงและท้องฟ้าที่ว่างเปล่า แล้วเช้าวันหนึ่ง เรดาร์ตรวจจับบางอย่างเคลื่อนที่อยู่ใต้ผิวดิน",
        "เซนเซอร์แสดงรูปร่าง ใหญ่และเงียบ เคลื่อนที่ใต้ชั้นน้ำแข็งใกล้หุบเขายักษ์ อามาร่าและลูกเรือขับรถสำรวจไปตรวจสอบ หัวใจเต้นแรงด้วยความประหลาดใจและความกลัว",
        "พวกเขาพบประตูโลหะมืดฝังอยู่ในพื้นดิน มันเปิดเอง และแสงสีฟ้าอ่อนลอยขึ้นมาจากด้านล่าง 'นี่ไม่ใช่ของเรา' อามาร่ากระซิบ 'สิ่งนี้อยู่ที่นี่นานก่อนที่เราจะมา'",
        "ข้างใน พวกเขาพบห้องที่ปกคลุมด้วยสัญลักษณ์เรืองแสง เสียงอ่อนโยนพูดภาษาอังกฤษสำเนียงสมบูรณ์ 'เราเป็นผู้สร้างสถานที่นี้ เราฝากของขวัญไว้ให้ผู้ที่มาทีหลัง'",
        "ของขวัญนั้นคือคริสตัลที่เก็บความรู้ของอารยธรรมทั้งมวล — ความลับของพลังงานสะอาด การเยียวยา และการไปถึงดวงดาว อามาร่าเข้าใจ: ชาวอังคารหายไปนานแล้ว แต่พวกเขาเลือกที่จะช่วยเรา",
        "อามาร่าอุ้มคริสตัลกลับโลก ที่ซึ่งมันเปลี่ยนโลกทั้งใบ เธอไม่เคยหยุดสงสัยว่าชาวอังคารเป็นใคร แต่เธอรู้สิ่งหนึ่งแน่นอน: ที่ไหนสักแห่งท่ามกลางดวงดาว ผู้คนผู้ยิ่งใหญ่กำลังเฝ้าดูเราอยู่"
      ]
    },
    {
      id: "cur-sf-time-paradox", level: "B2", genre: "scifi",
      title: "The Time Paradox",
      pages: ["Professor Liu Wei had spent thirty years building a machine that could send letters into the past. His goal was simple: to warn his younger self not to trust the man who would betray him.",
        "He typed the warning and pressed send. Nothing happened at first. But when he returned to his office the next morning, he found a reply on the machine — written in his own hand, dated thirty years ago.",
        "The letter wasn't what he expected. It said: 'Don't change the past. Your betrayal made you strong. The man you fear becomes your greatest teacher. Let him come.'",
        "Confused and angry, Liu Wei ignored the letter and sent another warning. This time, the reply came faster. 'You've already tried this before. In every version of time, you send the same warning. And in every version, you fail.'",
        "Liu Wei sat down, shaken. He realized that his machine wasn't sending messages across time — it was sending them to himself, over and over, in an endless loop. There was only one way to break the circle: forgive.",
        "He deleted the warning, wrote a letter of thanks to the man who had betrayed him, and sent it. The reply that came back was full of tears and peace. Time hadn't changed, but Liu Wei had — and that was enough."],
      thPages: ["ศาสตราจารย์หลิว เว่ยใช้เวลาสามสิบปีสร้างเครื่องจักรที่สามารถส่งจดหมายไปยังอดีตได้ เป้าหมายของเขานั้นง่ายดาย: เตือนตัวเขาในวัยหนุ่มไม่ให้ไว้ใจชายที่จะทรยศเขา",
        "เขาพิมพ์คำเตือนแล้วกดปุ่มส่ง ตอนแรกไม่มีอะไรเกิดขึ้น แต่เมื่อเขากลับมาที่ห้องทำงานในเช้าวันรุ่งขึ้น เขาก็พบจดหมายตอบกลับบนเครื่องจักร — เขียนด้วยลายมือของเขาเอง ลงวันที่สามสิบปีก่อน",
        "จดหมายไม่ตรงกับที่เขาคาดไว้ มันเขียนว่า 'อย่าเปลี่ยนอดีต การทรยศทำให้คุณแข็งแกร่ง ชายที่คุณกลัวจะกลายเป็นครูที่ดีที่สุดของคุณ ปล่อยให้เขามาเถิด'",
        "หลิว เว่ยสับสนและโกรธ เขาไม่สนใจจดหมายฉบับนั้นและส่งคำเตือนอีกครั้ง คราวนี้ คำตอบกลับมาเร็วขึ้น 'คุณเคยลองทำแบบนี้มาก่อนแล้ว ในทุกห้วงเวลา คุณส่งคำเตือนเดียวกัน และในทุกห้วงเวลา คุณล้มเหลว'",
        "หลิว เว่ยนั่งลง ตัวสั่นเทา เขาตระหนักว่าเครื่องจักรของเขาไม่ได้ส่งข้อความข้ามเวลา — มันส่งข้อความถึงตัวเขาเอง ซ้ำแล้วซ้ำเล่า ในวงวนที่ไม่มีวันจบ มีเพียงวิธีเดียวที่จะทำลายวงจรนี้: ให้อภัย",
        "เขาลบคำเตือน เขียนจดหมายขอบคุณชายที่ทรยศเขา แล้วส่งออกไป จดหมายตอบกลับที่มาถึงเต็มไปด้วยน้ำตาและความสงบ เวลาไม่ได้เปลี่ยน แต่หลิว เว่ยเปลี่ยน — และนั่นก็เพียงพอแล้ว"]
    },
    {
      id: "cur-sf-silent-station", level: "B2", genre: "scifi",
      title: "The Silent Station",
      pages: ["Deep under the frozen sea of Europa, the research station Aquarius hummed with life. Twenty scientists studied the strange ocean below the ice, but they had stopped answering Earth for three days.",
        "Commander Imani Cole traveled from Mars to find out why. The station was silent when she arrived. The lights were on, the machines were running, but there was no sign of the crew.",
        "In the lab she found a note: 'Follow the bubbles. They aren't gas. They're messages.' Imani walked to the ice window and watched. Bubbles rose from the dark water below, arranging themselves into shapes.",
        "The bubbles formed words: 'We went below. The ocean is alive. It sings to us, and we can't resist.' Imani's blood ran cold. The crew had walked into the water, one by one, drawn by a voice from the deep.",
        "Imani felt the song then — a gentle hum that filled her mind with peace and belonging. Her hand moved toward the lock. But she stopped, shook herself, and sealed the station with an emergency wall.",
        "She reported the truth to Earth and stayed to guard the station. The ocean below was alive, and its song was beautiful beyond words. Imani listened to it every night, and she remembered the crew who had gone where no human should go."],
      thPages: ["ลึกลงไปใต้ทะเลน้ำแข็งของดวงจันทร์ยูโรปา สถานีวิจัยอควอเรียสยังคงเต็มไปด้วยเสียงชีวิตชีวา นักวิทยาศาสตร์ยี่สิบคนศึกษามหาสมุทรประหลาดใต้แผ่นน้ำแข็ง แต่พวกเขาหยุดติดต่อกับโลกมานานสามวันแล้ว",
        "ผู้บัญชาการอิมาอานี โคลเดินทางจากดาวอังคารเพื่อมาหาสาเหตุ สถานีเงียบงันเมื่อเธอมาถึง ไฟยังสว่าง เครื่องจักรยังทำงาน แต่ไม่พบวี่แววของลูกเรือแม้แต่คนเดียว",
        "ในห้องแล็บ เธอพบข้อความหนึ่ง: 'ตามฟองอากาศไป พวกมันไม่ใช่แก๊ส พวกมันคือข้อความ' อิมาอานีเดินไปที่หน้าต่างน้ำแข็งและเฝ้าดู ฟองอากาศลอยขึ้นจากน้ำมืดเบื้องล่าง เรียงตัวกันเป็นรูปร่าง",
        "ฟองอากาศก่อตัวเป็นคำ: 'เราลงไปข้างล่าง มหาสมุทรมีชีวิต มันร้องเพลงให้เรา และเราต้านทานไม่ได้' เลือดของอิมาอานีเย็นฉ่ำ ลูกเรือต่างเดินลงไปในน้ำ ทีละคน ถูกดึงดูดด้วยเสียงจากห้วงลึก",
        "อิมาอานีรู้สึกถึงเพลงนั้น — เสียงก้องเบาๆ ที่เติมเต็มจิตใจของเธอด้วยความสงบและความรู้สึกเป็นส่วนหนึ่ง มือของเธอค่อยๆ ขยับไปที่ล็อก แต่เธอหยุด สลัดสติกลับมา แล้วผนึกสถานีด้วยกำแพงฉุกเฉิน",
        "เธอรายงานความจริงสู่โลกและอยู่เฝ้าสถานี มหาสมุทรเบื้องล่างมีชีวิต และเพลงของมันสวยงามเกินคำบรรยาย อิมาอานีฟังมันทุกคืน และเธอคิดถึงลูกเรือที่จากไปยังที่ที่มนุษย์ไม่ควรไป"]
    },
    {
      id: "cur-sf-solar-sail", level: "B2", genre: "scifi",
      title: "The Solar Sail",
      pages: ["The ship Satori carried no fuel. Its great silver sail, as wide as a city, caught the light of the sun and pushed the crew gently toward the stars. Captain Reiko Tanaka commanded the longest journey humans had ever attempted.",
        "The goal was a planet called Haven, orbiting a star forty light-years away. The crew slept in cold sleep, waking for only a few weeks each year to check the ship and watch the stars slide past.",
        "In her waking time, Reiko studied the messages from Earth. Her daughter, grown now, sent recordings of the ocean. Reiko listened to the waves and felt the years stretching like a long, quiet river.",
        "Then the signal came. The sail had torn, just a small rip, but the ship's course was drifting. Reiko had to repair it while wearing a suit, floating in the endless light between the sun and the dark.",
        "She fixed the tear with trembling hands, and the ship steadied. Below her, Earth shrank to a dot. Ahead, the star of Haven grew brighter with every passing year, a promise written in light.",
        "At last the crew woke for good. Haven filled the window with green and blue. Reiko smiled. 'We're home,' she said. And behind her, a small flag with her daughter's drawing of the ocean floated in the gentle light."],
      thPages: ["เรือซาโตริไม่บรรทุกเชื้อเพลิง ใบเรือสีเงินขนาดใหญ่ กว้างเท่าเมือง รับแสงของดวงอาทิตย์และพาเรือมุ่งหน้าสู่ดวงดาวอย่างนุ่มนวล กัปตันเรย์โกะ ทานากะนำการเดินทางที่ยาวนานที่สุดเท่าที่มนุษย์เคยพยายามมา",
        "เป้าหมายคือดาวเคราะห์ชื่อเฮเวน โคจรรอบดาวฤกษ์ที่อยู่ห่างออกไปสี่สิบปีแสง ลูกเรือหลับในสภาวะเย็นจัด ตื่นเพียงไม่กี่สัปดาห์ต่อปีเพื่อตรวจเรือและเฝ้าดูดวงดาวเคลื่อนผ่าน",
        "ในช่วงที่ตื่นขึ้น เรย์โกะศึกษาข้อความจากโลก ลูกสาวของเธอ ซึ่งโตแล้ว ส่งเสียงบันทึกของมหาสมุทรมาให้ เรย์โกะฟังคลื่นและรู้สึกว่าหลายปีเหยียดยาวไปราวกับแม่น้ำสายเงียบสงบ",
        "แล้วสัญญาณก็มา ใบเรือฉีกขาด เป็นเพียงรอยฉีกเล็กๆ แต่เรือเริ่มเบี่ยงออกจากเส้นทาง เรย์โกะต้องซ่อมมันขณะสวมชุดอวกาศ ลอยอยู่ท่ามกลางแสงอันไม่มีที่สิ้นสุดระหว่างดวงอาทิตย์กับความมืด",
        "เธอซ่อมรอยฉีกด้วยมือที่สั่น และเรือก็ทรงตัวได้ เบื้องล่างของเธอ โลกเล็กลงจนเป็นจุด ข้างหน้า ดาวของเฮเวนสว่างขึ้นทุกปีที่ผ่านไป เป็นคำสัญญาที่เขียนด้วยแสง",
        "ในที่สุดลูกเรือก็ตื่นขึ้นถาวร เฮเวนเต็มหน้าต่างด้วยสีเขียวและสีฟ้า เรย์โกะยิ้ม 'เราถึงบ้านแล้ว' เธอพูด และข้างหลังเธอ ธงผืนเล็กที่ประดับภาพวาดมหาสมุทรของลูกสาว ลอยอยู่ในแสงอันอ่อนโยน"]
    },
    {
      id: "cur-mys-northguard-murders", level: "B2", genre: "mystery",
      title: "The Northguard Murders",
      pages: ["The village of Northguard was quiet and perfect, until the day the baker was found dead in his own oven room. The door was locked from inside, and the only key lay beside his cold body.",
        "Inspector Vera Stone arrived from the city. She spoke to everyone: the jealous blacksmith, the silent innkeeper, and the baker's pretty young wife, who wept at the door and seemed to know nothing.",
        "Vera noticed something odd: the baker's hands were clean, but he had worked with flour all his life. A baker who touches flour never has clean hands. 'He didn't knead dough that morning,' she said softly.",
        "She studied the oven and found a hidden door behind it, leading to a small tunnel. The tunnel opened into the inn's cellar. The silent innkeeper went pale when Vera held up the key.",
        "The truth came out at last. The innkeeper had owed the baker a great debt, and the baker had threatened to expose him. They'd argued, and the innkeeper had struck him, then locked the door to hide his crime.",
        "Vera took the innkeeper away in handcuffs. The village breathed again, and people whispered that Inspector Vera Stone saw what others couldn't see. Peace returned to Northguard, and justice had found its voice."],
      thPages: ["หมู่บ้านนอร์ธการ์ดเงียบสงบและสมบูรณ์แบบ จนกระทั่งวันหนึ่งคนทำขนมปังถูกพบเสียชีวิตในห้องเตาอบของตัวเอง ประตูล็อกจากด้านใน และกุญแจเพียงดอกเดียววางอยู่ข้างร่างที่เย็นเฉียบของเขา",
        "สารวัตรเวร่า สโตนมาจากเมือง เธอพูดคุยกับทุกคน: ช่างตีเหล็กที่อิจฉา เจ้าของโรงแรมที่เงียบขรึม และภรรยาสาวสวยของคนทำขนมปังผู้ร้องไห้อยู่หน้าประตูและดูเหมือนไม่รู้เรื่องอะไรเลย",
        "เวร่าสังเกตเห็นบางอย่างที่แปลก: มือของคนทำขนมปังสะอาด แต่เขาคลุกคลีกับแป้งมาตลอดชีวิต คนทำขนมปังที่คลุกแป้งไม่มีทางมีมือสะอาด 'เช้านั้นเขาไม่ได้นวดแป้ง' เธอพูดเบาๆ",
        "เธอตรวจดูเตาอบและพบประตูลับที่ซ่อนอยู่ด้านหลัง มันนำไปสู่อุโมงค์เล็ก อุโมงค์ทอดเข้าไปในห้องใต้ดินของโรงแรม เจ้าของโรงแรมที่เงียบขรึมหน้าซีดเมื่อเวร่าชูกุญแจขึ้น",
        "ความจริงถูกเปิดเผยในที่สุด เจ้าของโรงแรมติดหนี้คนทำขนมปังจำนวนมาก และคนทำขนมปังข่มขู่จะเปิดโปงความลับของเขา พวกเขาทะเลาะกัน และเจ้าของโรงแรมก็ทำร้ายเขา แล้วล็อกประตูเพื่อปกปิดความผิด",
        "เวร่าควบคุมตัวเจ้าของโรงแรมไปพร้อมกุญแจมือ หมู่บ้านหายใจได้อีกครั้ง และผู้คนกระซิบว่าสารวัตรเวร่า สโตนมองเห็นสิ่งที่คนอื่นมองไม่เห็น ความสงบกลับคืนสู่นอร์ธการ์ด และความยุติธรรมได้พบเสียงของมัน"]
    },
    {
      id: "cur-mys-orchid-mystery", level: "B1", genre: "mystery",
      title: "The Mystery of the Blue Orchid",
      pages: ["The Blue Orchid was the most famous painting in the museum. Then one morning, it was gone. The glass was broken, the frame was empty, and the guard swore he had seen no one all night.",
        "Detective Liu Xinyi examined the room. The floor was wet near the window, and a single green leaf lay on the carpet. 'A thief who leaves a leaf,' she murmured, 'has a gardener's heart.'",
        "She visited the museum's head gardener, an old man who loved orchids more than people. His greenhouse was full of rare flowers, and in the corner stood a pot with a young blue orchid.",
        "Xinyi smiled. The painting was worth millions, but the thief had stolen nothing else. 'You didn't want the money,' she said. 'You wanted the painting because you love its subject.'",
        "The old gardener bowed his head. 'I tended that orchid in the painting for forty years,' he said. 'When they sold it, I just wanted to see it once more.' Xinyi found the painting hidden behind his orchids.",
        "The gardener returned the painting with a gentle smile, and the museum gave him a small copy. The Blue Orchid hung safely again, and Xinyi learned that even a thief could act from love."],
      thPages: ["ภาพวาดบลูออร์คิดเป็นภาพที่โด่งดังที่สุดในพิพิธภัณฑ์ แล้วเช้าวันหนึ่ง มันก็หายไป กระจกแตก กรอบว่างเปล่า และยามยืนยันว่าเขาไม่เห็นใครตลอดทั้งคืน",
        "นักสืบหลิว ซินอี้ตรวจห้อง พื้นเปียกใกล้หน้าต่าง และใบไม้สีเขียวใบหนึ่งวางอยู่บนพรม 'ขโมยที่ทิ้งใบไม้ไว้แบบนี้' เธอพึมพำ 'ต้องมีหัวใจเป็นคนสวน'",
        "เธอไปพบหัวหน้าคนสวนของพิพิธภัณฑ์ ชายแก่ที่รักกล้วยไม้มากกว่ามนุษย์ เรือนกระจกของเขาเต็มไปด้วยดอกไม้หายาก และที่มุมเรือนกระจกมีกล้วยไม้สีน้ำเงินต้นเล็กๆ อยู่ในกระถาง",
        "ซินอี้ยิ้ม ภาพวาดมีค่าหลายล้าน แต่ขโมยกลับไม่ได้แตะต้องสิ่งอื่น 'คุณไม่ได้ต้องการเงิน' เธอพูด 'คุณต้องการภาพวาดเพราะคุณรักสิ่งที่มันวาด'",
        "คนสวนแก่ก้มศีรษะ 'ฉันดูแลกล้วยไม้ในภาพวาดนั้นมาสี่สิบปี' เขาพูด 'เมื่อพวกเขาขายมัน ฉันแค่อยากเห็นมันอีกครั้ง' ซินอี้พบภาพวาดที่ซ่อนอยู่หลังกล้วยไม้ของเขา",
        "คนสวนคืนภาพวาดด้วยรอยยิ้มอ่อนโยน และพิพิธภัณฑ์มอบสำเนาเล็กๆ ให้เขา ภาพบลูออร์คิดกลับมาแขวนอย่างปลอดภัยอีกครั้ง และซินอี้เรียนรู้ว่าแม้แต่ขโมยก็อาจทำสิ่งต่างๆ ด้วยความรักได้"]
    },
    {
      id: "cur-mys-clockmaker-alibi", level: "B2", genre: "mystery",
      title: "The Clockmaker's Alibi",
      pages: ["The old clockmaker, Mr. Hargrove, was found dead in his shop at midnight, a broken watch still in his hand. The police suspected his rival, Mr. Grant, who had been seen arguing with him that very evening.",
        "Grant had a perfect alibi. 'I was at the theater,' he said. 'I have the ticket and the program. I was there from seven to eleven.' The police believed him, but Inspector Alice Nguyen didn't.",
        "Alice studied the broken watch in the clockmaker's hand. It had stopped at exactly nine-fifteen. 'A clockmaker grips the time of his death,' she said. 'He couldn't reach a pen, so he froze the clock.'",
        "She went to the theater and checked the program. The show had run from seven to eleven, but the second act, she learned, was nearly an hour long. Grant could easily have slipped out and returned.",
        "Alice returned to the shop and opened the wall clock. Inside, she found a tiny note in the clockmaker's hand: 'Grant came at nine. He took the jewels.' The watch had stopped when Hargrove's hand fell.",
        "Grant broke down when Alice showed him the note. He had stolen the jewels and killed the old man. The clock, faithful to the end, had told the truth. Justice, Alice thought, keeps perfect time."],
      thPages: ["ช่างทำนาฬิกาแก่ คุณฮาร์โกรฟ ถูกพบเสียชีวิตในร้านของเขาเวลาเที่ยงคืน นาฬิกาที่เสียยังถูกกำอยู่ในมือ ตำรวจสงสัยคู่แข่งของเขาอย่างคุณแกรนท์ ผู้ที่ถูกพบเห็นทะเลาะกับเขาในเย็นวันนั้นเอง",
        "แกรนท์มีข้อแก้ตัวที่ไม่มีที่ติ 'ผมอยู่ที่โรงละคร' เขาพูด 'ผมมีตั๋วและใบรายการการแสดง ผมอยู่ที่นั่นตั้งแต่เจ็ดโมงถึงห้าทุ่ม' ตำรวจเชื่อเขา แต่สารวัตรอลิซ เหงียนไม่เชื่อเขา",
        "อลิซตรวจดูนาฬิกาที่พังในมือของช่างทำนาฬิกา เข็มนาฬิกาหยุดอยู่ที่เก้าโมงสิบห้านาทีพอดี 'ช่างทำนาฬิกาย่อมบันทึกเวลาที่ตัวเองตาย' เธอพูด 'เขาเอื้อมปากกาไม่ถึง จึงหยุดนาฬิกาไว้'",
        "เธอไปที่โรงละครและตรวจใบรายการการแสดง ละครแสดงตั้งแต่เจ็ดถึงห้าทุ่ม แต่เธอพบว่าองก์ที่สองยาวเกือบหนึ่งชั่วโมง แกรนท์จึงสามารถแอบออกไปแล้วกลับมาได้อย่างง่ายดาย",
        "อลิซกลับไปที่ร้านและเปิดฝานาฬิกาแขวน ข้างใน เธอพบกระดาษข้อความเล็กๆ ในลายมือของช่างทำนาฬิกา: 'แกรนท์มาตอนเก้าโมง เขาเอาอัญมณีไป' นาฬิกาจึงหยุดเมื่อมือของฮาร์โกรฟร่วงลง",
        "แกรนท์สลายเมื่ออลิซยื่นข้อความให้ดู เขาได้ขโมยอัญมณีและฆ่าชายชรา นาฬิกา ผู้ซื่อสัตย์จนถึงที่สุด ได้บอกความจริง ความยุติธรรม อลิซคิดในใจ ไว้เวลาได้แม่นยำเสมอ"]
    },
    {
      id: "cur-cls-great-gatsby", level: "B2", genre: "classic",
      title: "The Great Gatsby",
      pages: ["In the summer of 1922, I moved to New York and rented a small house next to a grand mansion. Every weekend, music and light spilled out of that place, and thousands of guests came to its famous parties.",
        "The mansion belonged to a mysterious man named Jay Gatsby. Nobody knew where his money came from, but everybody loved his champagne. I got invited to one party, and at last I met the host himself — young, charming, and strangely sad.",
        "Gatsby took me aside and told me his secret. Years ago, he'd loved a girl named Daisy, but she'd married a rich man named Tom Buchanan. Gatsby had built his whole fortune for one reason only: to win her back.",
        "He arranged for me to invite Daisy to tea at my house. When she arrived, Gatsby was so nervous he almost left. But once they talked, the old love came rushing back. For a while, Gatsby was the happiest man in the world.",
        "Daisy's husband, Tom, grew jealous, and one night the truth exploded. Daisy realized she couldn't leave Tom's world of safety for Gatsby's world of dreams. Driving too fast and too upset, she struck and killed a woman.",
        "Tom told the dead woman's husband that Gatsby had been behind the wheel. The man, mad with grief, shot Gatsby dead in his own pool. I arranged the funeral, but almost nobody came. He'd lived a dream, and the dream had cost him everything."],
      thPages: ["ในฤดูร้อนปี 1922 ฉันย้ายมาอยู่นิวยอร์กและเช่าบ้านหลังเล็กข้างคฤหาสน์ใหญ่โต ทุกสุดสัปดาห์ เสียงดนตรีกับแสงไฟจะสาดส่องออกมาจากคฤหาสน์หลังนั้น และแขกนับพันก็หลั่งไหลมาร่วมงานปาร์ตี้ชื่อดังของมัน",
        "คฤหาสน์หลังนั้นเป็นของชายลึกลับนามว่าเจย์ แกตส์บี้ ไม่มีใครรู้ว่าเงินของเขามาจากไหน แต่ทุกคนต่างชื่นชอบแชมเปญของเขา ฉันได้รับเชิญไปงานปาร์ตี้งานหนึ่ง และในที่สุดก็ได้พบเจ้าภาพตัวจริง — หนุ่มหล่อ มีเสน่ห์ แต่เศร้าอย่างบอกไม่ถูก",
        "แกตส์บี้พาฉันออกไปข้างๆ แล้วเล่าความลับให้ฟัง หลายปีก่อน เขาเคยรักสาวชื่อเดซี่ แต่เธอกลับไปแต่งงานกับเศรษฐีอย่างทอม บูคานัน แกตส์บี้สร้างโชคลาภทั้งหมดขึ้นมาด้วยเหตุผลเดียวเท่านั้น: เพื่อชนะใจเธอกลับมา",
        "เขาจัดให้ฉันเชิญเดซี่มาดื่มน้ำชาที่บ้านฉัน พอเธอมาถึง แกตส์บี้ประหม่าจนเกือบจะหนีออกไป แต่เมื่อทั้งคู่ได้คุยกัน ความรักเก่าก็พุ่งกลับมาอย่างเต็มเปี่ยม ชั่วครู่หนึ่ง แกตส์บี้คือคนที่มีความสุขที่สุดในโลก",
        "ทอมสามีของเดซี่เริ่มกินใจ แกตส์บี้จนทนไม่ไหว และคืนหนึ่งความจริงก็ระเบิดออกมา เดซี่ตระหนักได้ว่าเธอไม่สามารถทิ้งโลกที่ปลอดภัยของทอมเพื่อโลกแห่งความฝันของแกตส์บี้ได้ เธอขับรถเร็วเกินไปและหัวใจวุ่นวายเกินไป จนชนหญิงคนหนึ่งเสียชีวิต",
        "ทอมบอกสามีของหญิงที่ตายว่าแกตส์บี้เป็นคนขับ ชายคนนั้นคลุ้มคลั่งด้วยความเศร้าโศก ยิงแกตส์บี้เสียชีวิตในสระว่ายน้ำของเขาเอง ฉันเป็นคนจัดงานศพให้ แต่แทบไม่มีใครมา เขาใช้ชีวิตอยู่ในความฝัน และความฝันนั่นเองที่พรากทุกอย่างจากเขา"]
    },
    {
      id: "cur-cls-oliver-twist", level: "B2", genre: "classic",
      title: "Oliver Twist",
      pages: ["In a cold, grim workhouse in London, a poor boy named Oliver Twist was born and grew up. The workhouse gave him little food and no kindness at all, and when he dared to ask for more, the masters were horrified.",
        "Oliver was sold to a cruel undertaker, who beat him and starved him. One night he ran away to London — hungry, alone, and hoping to find a better life among the busy streets.",
        "In London, a boy called the Artful Dodger took Oliver under his wing and led him to the house of an old criminal named Fagin. Fagin taught the boys to pick pockets, and Oliver, innocent as he was, became one of them.",
        "Oliver was caught on his very first job and taken to court. A kind gentleman named Mr. Brownlow believed in him and brought him home. For the first time in his life, Oliver knew what warmth and love felt like.",
        "But Fagin's men dragged Oliver back into their world and forced him to help rob a great house. Oliver was shot and left behind, but the people of the house — the Maylies — nursed him back to health.",
        "In the end, the criminals were caught and the truth came out. Oliver wasn't an orphan at all — he was the son of a good family. Mr. Brownlow and the Maylies adopted him, and Oliver Twist, who had known only suffering, finally found a happy home."],
      thPages: ["ในสถานสงเคราะห์เย็นเยือกแห่งหนึ่งในลอนดอน เด็กชายยากจนชื่อโอลิเวอร์ ทวิสต์ถือกำเนิดและเติบโตขึ้นมา สถานสงเคราะห์ให้อาหารเพียงน้อยนิดและไม่มีความเมตตาใดๆ เลย พอเขากล้าขออาหารเพิ่ม ผู้ดูแลถึงกับตกตะลึง",
        "โอลิเวอร์ถูกขายให้กับสัปเหร่อใจโหดที่ทุบตีและข่มเหงเขา คืนหนึ่งเขาหนีไปลอนดอน ตัวหิวโหยและเดียวดาย หวังว่าจะได้พบชีวิตที่ดีกว่าท่ามกลางถนนที่วุ่นวาย",
        "ในลอนดอน เด็กชายที่ชื่อว่าจอมเจ้าเล่ห์ดอดเจอร์รับโอลิเวอร์ไว้ใต้ปีก แล้วพาไปที่บ้านของอาชญากรชรานามเฟกิน เฟกินสอนเด็กๆ ให้ล้วงกระเป๋า และโอลิเวอร์ผู้ไร้เดียงสา ก็กลายเป็นหนึ่งในพวกเขาโดยไม่รู้ตัว",
        "โอลิเวอร์ถูกจับได้ตั้งแต่ภารกิจแรก แล้วถูกนำตัวขึ้นศาล สุภาพบุรุษใจดีนามมิสเตอร์บราวน์โลว์เชื่อมั่นในตัวเขา และพาเขากลับบ้าน เป็นครั้งแรกในชีวิตที่โอลิเวอร์ได้รู้จักว่าความอบอุ่นและความรักเป็นอย่างไร",
        "แต่ลูกน้องของเฟกินลากโอลิเวอร์กลับเข้าสู่โลกของพวกเขา และบังคับให้เขาช่วยกันปล้นคฤหาสน์หลังใหญ่ โอลิเวอร์ถูกยิงและถูกทิ้งไว้ข้างหลัง แต่ผู้คนในบ้านนั้น — ครอบครัวเมย์ลี — ช่วยกันพยาบาลจนเขาหายดี",
        "ในที่สุด เหล่าอาชญากรก็ถูกจับ และความจริงก็ถูกเปิดเผย โอลิเวอร์ไม่ใช่เด็กกำพร้าเลยแม้แต่น้อย — เขาคือลูกของครอบครัวที่ดี มิสเตอร์บราวน์โลว์และครอบครัวเมย์ลีรับเลี้ยงเขาไว้ และโอลิเวอร์ ทวิสต์ ผู้เคยรู้จักแต่ความทุกข์ ก็ได้พบกับบ้านอันอบอุ่นในที่สุด"]
    },
    {
      id: "cur-cls-moby-dick", level: "B1", genre: "classic",
      title: "Moby Dick",
      pages: ["Call me Ishmael. I went to sea to escape the sadness of the shore, and I signed on to the whaling ship Pequod. On deck I met a tattooed harpooner named Queequeg, and he became my dearest friend.",
        "The captain of the Pequod was Ahab — a tall man with a scarred face and a leg carved from whalebone. He'd lost that leg to a great white whale called Moby Dick, and revenge was burning in his heart.",
        "Ahab gathered the crew and nailed a gold coin to the mast. 'Whoever first sights the white whale,' he cried, 'shall have this coin!' The men cheered, but I could see the madness in the captain's eyes.",
        "For months we hunted whales across the wide oceans, and the sea took its toll. Men were lost, boats were smashed. But Ahab never rested. His one thought, his one dream, was the white whale.",
        "At last the lookout cried, 'There she blows!' And there was Moby Dick, white as milk, rising out of the deep. Ahab laughed and ordered the boats into the water, chasing the whale that had taken his leg.",
        "Moby Dick fought back with terrible power. It smashed the boats and dragged the Pequod down beneath the waves. All the crew drowned, and only I, Ishmael, floated on an empty coffin until a passing ship rescued me. I alone lived to tell the tale."],
      thPages: ["เรียกฉันว่าอิชมาเอลเถอะ ฉันออกทะเลเพื่อหนีความเศร้าหมองบนฝั่ง และลงประจำเรือล่าปลาวาฬชื่อเพควอด บนดาดฟ้าเรือ ฉันได้พบกับคนฉมวกที่สักเต็มตัวชื่อคิวควีก และเขาก็กลายเป็นเพื่อนรักของฉัน",
        "กัปตันของเพควอดคืออาฮับ ชายร่างสูง ใบหน้าเป็นรอยแผลเป็น และขาข้างหนึ่งแกะสลักจากกระดูกวาฬ เขาสูญเสียขาข้างนั้นให้กับวาฬขาวยักษ์นามโมบี ดิค และการแก้แค้นก็ลุกโชนอยู่ในใจเขา",
        "อาฮับรวบรวมลูกเรือ แล้วตอกเหรียญทองไว้ที่เสากระโดง 'ใครเห็นวาฬขาวเป็นคนแรก' เขาตะโกน 'คนนั้นจะได้เหรียญนี้!' ลูกเรือส่งเสียงเชียร์ แต่ฉันเห็นความบ้าคลั่งอยู่ในดวงตาของกัปตัน",
        "หลายเดือนที่เราล่าปลาวาฬข้ามมหาสมุทรอันกว้างใหญ่ และทะเลก็เก็บค่าผ่านทางเสมอ ลูกเรือสูญหาย เรือถูกชนแตก แต่อาฮับไม่เคยหยุดพัก ความคิดเดียว ความฝันเดียวของเขาคือวาฬขาว",
        "ในที่สุดคนเฝ้ายามก็ร้องขึ้นว่า 'มันพ่นน้ำแล้ว!' และโมบี ดิคก็อยู่ตรงนั้น ขาวราวกับน้ำนม ผุดขึ้นจากห้วงลึก อาฮับหัวเราะแล้วสั่งปล่อยเรือลงน้ำ ไล่ตามวาฬที่คร่าขาของเขาไป",
        "โมบี ดิคสู้กลับด้วยพลังอันน่ากลัว มันทุบเรือแตกกระจาย และลากเพควอดจมลงใต้คลื่น ลูกเรือทั้งหมดจมน้ำตาย เหลือเพียงฉัน อิชมาเอล ที่ลอยอยู่บนโลงศพเปล่า จนมีเรือแล่นผ่านมาช่วยไว้ ฉันเพียงคนเดียวที่รอดชีวิตมาเล่าเรื่องนี้"]
    },
    {
      id: "cur-cls-jane-eyre", level: "B2", genre: "classic",
      title: "Jane Eyre",
      pages: ["I am Jane Eyre, an orphan raised by an unkind aunt who treated me like an unwanted burden. At last she packed me off to a charity school, where cold walls and strict rules were my daily bread.",
        "I grew up to be a quiet, plain governess, and I found a post at the great house of Thornfield, caring for a small girl named Adele. The master of the house, Mr. Rochester, was a dark and restless man.",
        "Mr. Rochester and I talked often, and little by little I fell in love with him. He was proud and wild, but he understood me. One night he declared his love and asked me to marry him. I was filled with joy.",
        "But on our wedding day, a terrible secret came out. Mr. Rochester was already married — to a madwoman locked in the attic of Thornfield. My heart broke, and I fled the house that very night.",
        "I wandered, hungry and lost, until the Rivers family took me in. They became my kin, and when an unknown relative left me a fortune, I shared it with them. But in my heart, I still remembered Thornfield.",
        "I returned to Thornfield at last, only to find it a blackened ruin — a fire had burned it down. Mr. Rochester, blind and wounded, had tried to save his mad wife and lost everything. I found him, and I took his hand. Where there is love, I told him, there is light."],
      thPages: ["ฉันชื่อเจน ไอร์ เด็กกำพร้าที่ถูกป้าผู้ไร้เมตตาเลี้ยงดู ราวกับฉันเป็นภาระที่ไม่พึงปรารถนา ในที่สุดเธอก็ส่งฉันไปโรงเรียนการกุศล ที่ซึ่งกำแพงเย็นเฉียบและกฎเหล็กเคร่งครัดกลายเป็นชีวิตประจำวันของฉัน",
        "ฉันเติบโตเป็นผู้ปกครองที่เงียบขรึมและหน้าตาธรรมดา แล้วได้งานที่คฤหาสน์ใหญ่ธอร์นฟิลด์ ดูแลเด็กหญิงตัวน้อยชื่ออเดล เจ้าของบ้าน มิสเตอร์โรเชสเตอร์ เป็นชายที่มืดมนและไม่สงบสุขนัก",
        "มิสเตอร์โรเชสเตอร์กับฉันคุยกันบ่อยๆ และฉันก็ค่อยๆ รักเขาขึ้นมา เขาหยิ่งและดุร้าย แต่เขาเข้าใจฉัน คืนหนึ่งเขาบอกรักและขอฉันแต่งงาน ฉันเต็มไปด้วยความสุข",
        "แต่ในวันแต่งงาน ความลับอันน่ากลัวก็ถูกเปิดเผย มิสเตอร์โรเชสเตอร์แต่งงานแล้ว — กับหญิงวิกลจริตที่ถูกขังอยู่ในห้องใต้หลังคาของธอร์นฟิลด์ หัวใจฉันแตกสลาย และฉันหนีออกจากบ้านหลังนั้นในคืนเดียวกัน",
        "ฉันเร่ร่อนด้วยความหิวโหยและหลงทาง จนกระทั่งครอบครัวริเวอร์สรับฉันไว้ พวกเขากลายเป็นญาติของฉัน และเมื่อญาติที่ไม่รู้จักทิ้งมรดกไว้ให้ฉัน ฉันก็แบ่งให้พวกเขา แต่ในใจฉัน ยังคงคิดถึงธอร์นฟิลด์เสมอ",
        "ในที่สุดฉันก็กลับมาที่ธอร์นฟิลด์ ได้แต่พบว่ามันกลายเป็นซากปรักหักพังดำคล้ำ — ไฟได้เผามันจนหมดสิ้น มิสเตอร์โรเชสเตอร์ตาบอดและบาดเจ็บ เขาพยายามช่วยภรรยาที่วิกลจริตของเขาแต่กลับสูญเสียทุกอย่าง ฉันพบเขาและจับมือเขาไว้ ที่ใดมีความรัก ฉันบอกเขา ที่นั่นย่อมมีแสงสว่าง"]
    },
    {
      id: "cur-cls-peter-pan", level: "A2", genre: "classic",
      title: "Peter Pan",
      pages: ["The three Darling children — Wendy, John, and Michael — lived in London with their mother and father and their dog, Nana. One night a strange boy flew in through their window. His name was Peter Pan.",
        "Peter taught the children to fly by thinking lovely thoughts while he sprinkled them with fairy dust from his friend Tinker Bell. 'Follow me to Neverland!' he cried, and away they flew through the night sky.",
        "In Neverland, the children met the Lost Boys, the pirates of Captain Hook, and the beautiful mermaids who sang in the lagoon. Wendy became a mother to them all, telling stories by the fire.",
        "Captain Hook, who hated Peter for cutting off his hand and feeding it to a crocodile, captured the children. The crocodile, which had swallowed a clock, went tick-tock wherever it followed Hook.",
        "Peter rescued his friends from the pirate ship in a daring battle. He fought Hook himself, and Hook, who feared that ticking crocodile, fell into the sea — and the beast swallowed him whole.",
        "The children flew home to London, where their mother agreed to adopt the Lost Boys. Wendy grew up, but she never forgot Peter, who promised to return every spring. And so, in the nursery window, a boy's shadow still waited."],
      thPages: ["เด็กทั้งสามของครอบครัวดาร์ลิ่ง — เวนดี้ จอห์น และไมเคิล — อาศัยอยู่ในลอนดอนกับพ่อแม่และนานาสุนัขของพวกเขา คืนหนึ่ง มีเด็กชายแปลกหน้าคนหนึ่งบินทะลุหน้าต่างเข้ามา เขาชื่อปีเตอร์แพน",
        "ปีเตอร์สอนให้เด็กๆ บินโดยการคิดถึงเรื่องสนุกๆ ระหว่างที่โรยฝุ่นนางฟ้าจากทิงเกอร์เบลล์เพื่อนของเขาให้ 'ตามฉันมาเนเวอร์แลนด์!' เขาร้อง แล้วพวกเขาก็บินโผออกไปสู่ท้องฟ้ายามค่ำคืน",
        "ในเนเวอร์แลนด์ เด็กๆ ได้พบกับเด็กหลงทาง เหล่าโจรสลัดของกัปตันฮุค และนางเงือกสวยๆ ที่ร้องเพลงอยู่ในทะเลสาบ เวนดี้กลายเป็นแม่ของพวกเขาทุกคน คอยเล่านิทานข้างกองไฟ",
        "กัปตันฮุค ผู้เกลียดปีเตอร์ที่ตัดมือเขาทิ้งให้จระเข้กิน จับตัวเด็กๆ ไป จระเข้ที่กลืนนาฬิกาเข้าไปนั้น เดินดักดักตามฮุคไปทุกที่",
        "ปีเตอร์บุกช่วยเพื่อนๆ ของเขาจากเรือโจรสลัดด้วยการต่อสู้อันกล้าหาญ เขาสู้กับฮุคด้วยตัวเอง และฮุคผู้หวาดกลัวจระเข้ที่เดินดักดักนั้นก็พลัดตกทะเลไป — แล้วสัตว์ร้ายก็กลืนเขาทั้งเป็น",
        "เด็กๆ บินกลับบ้านที่ลอนดอน ซึ่งแม่ของพวกเขาตกลงรับเลี้ยงเด็กหลงทางทุกคน เวนดี้เติบโตขึ้น แต่เธอไม่เคยลืมปีเตอร์ ผู้สัญญาว่าจะกลับมาทุกฤดูใบไม้ผลิ และที่หน้าต่างห้องเด็กเล็ก เงาของเด็กชายคนหนึ่งก็ยังคงรออยู่"]
    },
    {
      id: "cur-fairy-snow-queen", level: "A2", genre: "fairy",
      title: "The Snow Queen",
      pages: ["In a little town lived two friends, Kai and Gerda. They were poor, but they were happy, and they shared everything — even the rose bush that grew between their two windows.",
        "One winter, a splinter from the evil mirror flew into Kai's eye and pierced his heart. He turned cold and cruel. Then the Snow Queen appeared and kissed him, and he forgot Gerda and followed her into the frozen north.",
        "Gerda refused to believe that Kai was lost. She set out in the spring, alone and determined. Along the way she met an old witch with a lovely garden, a clever crow, and a kind prince and princess who helped her on her journey.",
        "Gerda rode north through the snow on a gentle reindeer. They crossed the frozen plains and finally reached the Snow Queen's palace, where ice shone like crystal and the wind sang a lonely song.",
        "Inside the palace, Gerda found Kai — cold and still, trying to spell a word with blocks of ice. He didn't remember her. But Gerda's warm tears fell on his chest, melted the splinter in his heart, and woke him from the frozen spell.",
        "Kai and Gerda flew home on a reindeer, through spring and summer, until they reached their little town. The rose bush had bloomed, and they sat beneath it — children again, friends again. And the Snow Queen never found them again."],
      thPages: ["ในเมืองเล็กๆ แห่งหนึ่งมีเพื่อนสองคนชื่อไคกับเกอร์ดา พวกเขายากจนแต่ก็มีความสุข และแบ่งปันทุกอย่างกัน — แม้แต่ต้นกุหลาบที่งอกอยู่ระหว่างหน้าต่างสองบานของพวกเขา",
        "ฤดูหนาวปีหนึ่ง เศษกระจกวิเศษชิ้นเล็กๆ ปลิวเข้าตาไคและแทงลึกเข้าไปในหัวใจของเขา เขากลายเป็นคนเย็นชาและโหดร้าย แล้วราชินีหิมะก็ปรากฏตัวและจูบเขา เขาลืมเกอร์ดาไปสิ้น และตามเธอไปยังดินแดนทางเหนืออันหนาวเหน็บ",
        "เกอร์ดาไม่ยอมเชื่อว่าไคหายไป เธอออกเดินทางในฤดูใบไม้ผลิ อย่างโดดเดี่ยวและมุ่งมั่น ระหว่างทางเธอได้พบแม่มดแก่ที่มีสวนสวย กาฉลาดๆ ตัวหนึ่ง และเจ้าชายกับเจ้าหญิงใจดีที่ช่วยเหลือเธอตลอดทาง",
        "เกอร์ดาขี่กวางเรนเดียร์ผู้ใจดีมุ่งหน้าเหนือไปท่ามกลางหิมะ พวกเขาข้ามที่ราบน้ำแข็งอันกว้างใหญ่ และในที่สุดก็มาถึงพระราชวังของราชินีหิมะ ที่ซึ่งน้ำแข็งส่องประกายราวคริสตัล และสายลมขับขานเพลงอันโดดเดี่ยว",
        "ในพระราชวัง เกอร์ดาพบไค — ตัวเย็นเฉียบและนิ่งงัน กำลังพยายามสะกดคำด้วยก้อนน้ำแข็ง เขาจำเธอไม่ได้เลย แต่หยาดน้ำตาอันอบอุ่นของเกอร์ดาหล่นลงบนอกของเขา ละลายเศษกระจกในหัวใจ และปลุกเขาจากมนต์น้ำแข็ง",
        "ไคและเกอร์ดาบินกลับบ้านบนหลังกวางเรนเดียร์ ผ่านฤดูใบไม้ผลิและฤดูร้อน จนกระทั่งถึงเมืองเล็กๆ ของพวกเขา ต้นกุหลาบเบ่งบานแล้ว และทั้งคู่ก็นั่งลงใต้ต้นไม้นั้น — เป็นเด็กอีกครั้ง เป็นเพื่อนอีกครั้ง และราชินีหิมะก็ไม่เคยตามพวกเขาพบอีกเลย"]
    },
    {
      id: "cur-fairy-rumpelstiltskin", level: "A1", genre: "fairy",
      title: "Rumpelstiltskin",
      pages: ["A poor miller told the king a lie: 'My daughter can spin straw into gold!' The king was greedy, so he locked the girl in a tower full of straw. 'Spin this into gold by morning,' he said, 'or you'll die.'",
        "The poor girl wept. Suddenly, a strange little man appeared. 'What will you give me if I spin the gold for you?' he asked. 'My necklace,' she said. He took it, spun the straw into gold, and vanished.",
        "The king was delighted, but his greed only grew. He locked the girl in an even bigger room full of straw. This time the little man asked for her ring, and he spun the gold again while she slept.",
        "The king was amazed and promised her the throne if she could spin a whole mountain of straw. The little man appeared a third time. 'I'll help you,' he said, 'if you promise to give me your first-born child.' The girl, desperate, agreed.",
        "A year later, the girl was queen and held her first baby. The little man came back and demanded the child. The queen wept and begged. 'Very well,' said the little man. 'If you can guess my name, you may keep your child.'",
        "The queen sent messengers all over the land to gather names. At last, one messenger heard a strange voice singing in the forest: 'The queen will never guess that my name is Rumpelstiltskin!' The queen guessed the name, and the furious little man stamped his foot so hard that he vanished forever."],
      thPages: ["ช่างสีข้าวยากจนคนหนึ่งโกหกกษัตริย์ว่า 'ลูกสาวของฉันปั่นฟางให้เป็นทองคำได้!' กษัตริย์ผู้โลภจึงขังหญิงสาวไว้ในหอคอยที่เต็มไปด้วยฟาง 'ปั่นสิ่งนี้ให้เป็นทองภายในเช้า' เขาสั่ง 'ไม่งั้นเจ้าจะตาย'",
        "หญิงสาวผู้น่าสงสารร้องไห้ ทันใดนั้นชายตัวเล็กๆ แปลกหน้าก็โผล่มา 'เจ้าจะให้อะไรฉัน ถ้าฉันปั่นทองให้เจ้า?' เขาถาม 'สร้อยคอของฉัน' เธอตอบ เขารับสร้อย ปั่นฟางให้เป็นทองคำ แล้วก็หายวับไป",
        "กษัตริย์ดีใจมาก แต่ความโลภของเขากลับเพิ่มขึ้นเรื่อยๆ เขาขังหญิงสาวไว้ในห้องฟางที่ใหญ่กว่าเดิม คราวนี้ชายตัวเล็กขอแหวนของเธอ และเขาก็ปั่นทองคำให้อีกครั้งในขณะที่เธอหลับ",
        "กษัตริย์ตะลึงมาก ถึงกับสัญญาจะมอบบัลลังก์ให้เธอถ้าปั่นฟางทั้งภูเขาได้ ชายตัวเล็กโผล่มาเป็นครั้งที่สาม 'ฉันจะช่วยเจ้า' เขาว่า 'ถ้าเจ้าสัญญาว่าจะยกลูกคนแรกให้ฉัน' หญิงสาวสิ้นหวัง จึงตอบตกลง",
        "หนึ่งปีต่อมา หญิงสาวกลายเป็นราชินีและอุ้มลูกคนแรกของเธอ ชายตัวเล็กกลับมาและเรียกร้องเด็กคนนั้น ราชินีร้องไห้และอ้อนวอน 'ก็ได้' ชายตัวเล็กว่า 'ถ้าเจ้าทายชื่อฉันได้ เจ้าก็เก็บลูกไว้ได้'",
        "ราชินีส่งคนออกไปทั่วแผ่นดินเพื่อเก็บรวบรวมชื่อ ในที่สุด คนรับใช้คนหนึ่งได้ยินเสียงแปลกๆ ร้องเพลงอยู่ในป่า 'ราชินีไม่มีทางเดาได้ว่าฉันชื่อรัมเพลสติลต์สกิน!' ราชินีทายชื่อถูก แล้วชายตัวเล็กผู้เดือดดาลก็กระทืบเท้าอย่างแรงจนหายตัวไปตลอดกาล"]
    },
    {
      id: "cur-fairy-little-mermaid", level: "A2", genre: "fairy",
      title: "The Little Mermaid",
      pages: ["Far out in the deep blue sea lived the Sea King and his six beautiful daughters. The youngest mermaid was the most wonderful of them all. She loved to hear stories about the world above the waves.",
        "When she turned fifteen, she swam to the surface for the first time. She saw a ship and a handsome prince, and she fell in love with him at once. A storm broke the ship apart, and she saved the prince from drowning.",
        "The little mermaid carried the prince to the shore, where a girl from the palace found him. He never knew who had saved him, and the mermaid went back to the sea with a heavy heart.",
        "She went to the Sea Witch and traded her voice for legs. 'Every step will feel like knives,' warned the witch, 'and if the prince marries another, you'll turn into sea foam.' The mermaid agreed without a moment's hesitation.",
        "The prince loved the mermaid and took her everywhere, but he never loved her enough to marry her. Then the prince met the girl from the shore — the one he believed had saved him — and he married her.",
        "On the wedding night, the mermaid's sisters gave her a knife. 'Kill the prince, and you'll live!' they cried. But the mermaid couldn't hurt him. She threw the knife into the sea and rose toward the light, where the spirits of the air welcomed her with open arms."],
      thPages: ["ไกลออกไปในทะเลสีน้ำเงินเข้ม มีราชาแห่งท้องทะเลและลูกสาวทั้งหกคนอาศัยอยู่ นางเงือกน้อยคนสุดท้องเป็นคนที่วิเศษที่สุด เธอชอบฟังเรื่องราวเกี่ยวกับโลกเหนือคลื่นเหลือเกิน",
        "พอเธออายุครบสิบห้า เธอก็ว่ายขึ้นสู่ผิวน้ำเป็นครั้งแรก เธอเห็นเรือลำหนึ่งและเจ้าชายรูปงาม แล้วก็ตกหลุมรักเขาทันที พายุพัดเรือแตกเป็นเสี่ยงๆ และเธอก็ช่วยเจ้าชายไว้ไม่ให้จมน้ำ",
        "นางเงือกน้อยอุ้มเจ้าชายขึ้นฝั่ง ที่ซึ่งหญิงสาวจากพระราชวังมาเจอเขาเข้า เขาไม่เคยรู้เลยว่าใครช่วยเขาไว้ และนางเงือกก็กลับสู่ทะเลด้วยหัวใจที่หนักอึ้ง",
        "เธอไปหาแม่มดทะเลและแลกเสียงของเธอกับขาสองข้าง 'ทุกย่างก้าวจะเจ็บราวกับถูกมีดบาด' แม่มดเตือน 'และถ้าเจ้าชายแต่งงานกับคนอื่น เจ้าจะกลายเป็นฟองคลื่น' นางเงือกตอบตกลงโดยไม่ลังเลแม้เสี้ยววินาที",
        "เจ้าชายรักนางเงือกและพาเธอไปทุกที่ แต่เขาไม่เคยรักเธอมากพอจะแต่งงาน แล้วเจ้าชายก็ได้พบหญิงสาวจากชายฝั่ง — คนที่เขาเชื่อว่าช่วยเขาไว้ — และเขาก็แต่งงานกับเธอ",
        "คืนวันแต่งงาน พี่สาวของนางเงือกยื่นมีดให้เธอ 'ฆ่าเจ้าชายซะ แล้วเจ้าจะได้มีชีวิต!' พวกเธอร้อง แต่นางเงือกทำร้ายเขาไม่ลง เธอโยนมีดทิ้งลงทะเล แล้วลอยขึ้นสู่แสงสว่าง ที่ซึ่งวิญญาณแห่งอากาศต้อนรับเธอด้วยอ้อมแขนที่เปิดกว้าง"]
    },
    {
      id: "cur-ghost-carmilla", level: "B2", genre: "ghost",
      title: "Carmilla",
      pages: ["My name is Laura, and I live with my father in a lonely castle in the mountains of Styria. One night, a carriage crashed near our gates, and from the wreck they carried a beautiful girl, pale as moonlight, whose name was Carmilla.",
        "Carmilla was sweet and gentle, and she became my dearest companion. But there was something strange about her. She slept all day, she never ate, and she spoke of a childhood she couldn't remember.",
        "Then I fell ill. I grew weak and pale, and strange dreams filled my sleep. I dreamed of a cold kiss on my throat, and every morning I woke more tired than before. My father sent for a famous doctor, Dr. Spielberg.",
        "The doctor examined me and shook his head. 'She is losing blood,' he said darkly. 'Something is feeding on her at night.' He studied Carmilla, and his face grew grave. 'I have seen this sickness before — in a village that lost three girls.'",
        "One of Carmilla's portraits, painted long ago, showed a woman who looked exactly like her. Now the doctor was sure. Carmilla was a vampire, and she had been feeding on me just as she had fed on countless victims for centuries.",
        "The villagers surrounded the castle and found Carmilla's grave. They opened it and drove a stake through the pale figure lying inside. The next morning, the sickness left my body. I have lived to tell this story, but I will never forget the beautiful, terrible face of Carmilla."],
      thPages: ["ฉันชื่อลอร่า อาศัยอยู่กับพ่อในปราสาทอันเงียบเหงาบนภูเขาของสติเรีย คืนหนึ่งมีรถม้าชนใกล้ประตูบ้านเรา และจากซากรถ พวกเขาอุ้มหญิงสาวงดงามคนหนึ่งออกมา ผิวขาวราวแสงจันทร์ ชื่อคาร์มิลลา",
        "คาร์มิลลาเป็นคนอ่อนหวานและอ่อนโยน และกลายเป็นเพื่อนที่ฉันรักที่สุด แต่เธอมีอะไรแปลกๆ อยู่ เธอนอนทั้งวัน ไม่เคยกินข้าว และพูดถึงวัยเด็กที่เธอจำไม่ได้เลย",
        "แล้วฉันก็เริ่มป่วย ฉันอ่อนแอลง หน้าซีดลง และฝันประหลาดๆ เต็มไปหมด ฉันฝันว่ามีใครบางคนจูบเย็นๆ ที่ลำคอ และทุกเช้าตื่นขึ้นมาก็เหนื่อยล้ายิ่งกว่าเดิม พ่อจึงส่งคนไปตามหมอชื่อดัง ดร.สปีลเบิร์ก",
        "หมอตรวจฉันแล้วก็ส่ายหัว 'เด็กคนนี้เสียเลือด' เขากล่าวด้วยสีหน้าหม่น 'มีบางอย่างกำลังดูดเลือดเธอตอนกลางคืน' เขาจ้องคาร์มิลลาอยู่นาน แล้วสีหน้าก็เคร่งเครียด 'ฉันเคยเห็นโรคแบบนี้มาก่อน — ในหมู่บ้านที่เด็กสาวหายไปสามคน'",
        "ภาพเหมือนคาร์มิลลาภาพหนึ่งที่วาดไว้นานมาก เป็นภาพของผู้หญิงที่หน้าตาเหมือนเธอราวกับพิมพ์เดียวกัน คราวนี้หมอมั่นใจเต็มที่ คาร์มิลลาคือแวมไพร์ และเธอดูดเลือดฉันมาโดยตลอด เหมือนที่เธอเคยดูดเลือดเหยื่ออีกนับไม่ถ้วนตลอดหลายศตวรรษ",
        "ชาวบ้านล้อมปราสาทไว้และหาเจอหลุมศพของคาร์มิลลา พวกเขาเปิดหลุมและตอกหลักผ่านร่างซีดเผือกที่นอนอยู่ข้างใน เช้าวันรุ่งขึ้น ความเจ็บป่วยก็หายไปจากตัวฉัน ฉันรอดมาได้จนได้เล่าเรื่องนี้ แต่ฉันจะไม่มีวันลืมใบหน้าที่ทั้งงดงามและน่าสะพรึงกลัวของคาร์มิลลา"]
    },
    {
      id: "cur-ghost-whistle-lady", level: "B1", genre: "ghost",
      title: "The Whistling Lady",
      pages: ["The old train station of Millbrook had been closed for years. People said you could still hear a whistle at midnight — the whistle of a lady who waited for a train that never came.",
        "A curious reporter named Sam came to Millbrook to write about the legend. He stayed in the station house with nothing but a lantern, and at midnight he heard it: a soft, sad whistle echoing through the empty hall.",
        "Sam followed the sound to the old platform. There, under the last lamp, stood a woman in a long coat, her face hidden. 'Can I help you?' Sam asked. She didn't turn. 'I'm waiting for my husband,' she whispered.",
        "'He was a conductor on this line,' she said. 'He promised to come home on the midnight train, but it was delayed by snow, and he never returned. I've waited here every night since.'",
        "Sam checked the old records and found her story. The woman had waited for her husband for forty years, then died alone. But her love hadn't died. 'She still believes he will come,' Sam thought, and his heart ached.",
        "The next night, Sam brought a white rose and placed it on the platform. The lady smiled through her tears. 'Thank you,' she said. 'Now I can rest.' She faded like morning mist, and the station has been silent ever since."],
      thPages: ["สถานีรถไฟเก่าเมืองมิลบรูกปิดตัวมานานหลายปีแล้ว ผู้คนเล่าว่าเที่ยงคืนยังได้ยินเสียงผิวปากอยู่ — เสียงผิวปากของหญิงสาวที่รอรถไฟขบวนหนึ่งซึ่งไม่มีวันมา",
        "นักข่าวผู้อยากรู้อยากเห็นชื่อแซมเดินทางมาที่มิลบรูกเพื่อเขียนเรื่องราวเกี่ยวกับตำนานนี้ เขาพักค้างในสถานีโดยมีตะเกียงเพียงดวงเดียว พอเที่ยงคืน เขาก็ได้ยินมัน: เสียงผิวปากที่เบาและเศร้า ก้องสะท้อนไปทั่วห้องโถงอันว่างเปล่า",
        "แซมตามเสียงไปจนถึงชานชาลาเก่า ที่นั่น ใต้โคมไฟดวงสุดท้าย มีหญิงสาวคนหนึ่งในเสื้อคลุมยาวยืนอยู่ ใบหน้าถูกปิดไว้ 'ให้ฉันช่วยไหม?' แซมถาม เธอไม่หันมา 'ฉันกำลังรอสามีอยู่' เธอกระซิบ",
        "'สามีฉันเป็นพนักงานขับรถไฟบนเส้นนี้' เธอกล่าว 'เขาสัญญาว่าจะกลับบ้านด้วยรถไฟเที่ยงคืน แต่รถไฟมาช้าเพราะหิมะตก เขาจึงไม่เคยกลับมา ฉันรออยู่ที่นี่ทุกคืนตั้งแต่วันนั้น'",
        "แซมค้นบันทึกเก่าและพบเรื่องราวของเธอ หญิงสาวรอคอยสามีมาถึงสี่สิบปี แล้วก็ตายจากไปอย่างโดดเดี่ยว แต่ความรักของเธอไม่เคยตาย 'เธอยังคงเชื่อว่าเขาจะมา' แซมคิด และหัวใจของเขาก็เจ็บปวด",
        "คืนถัดมา แซมนำดอกกุหลาบขาวมาวางไว้บนชานชาลา หญิงสาวยิ้มทั้งน้ำตา 'ขอบคุณ' เธอกล่าว 'ตอนนี้ฉันได้พักเสียที' เธอจางหายไปราวกับหมอกยามเช้า และตั้งแต่นั้นมา สถานีก็เงียบสนิทตลอดมา"]
    },
    {
      id: "cur-ghost-green-door", level: "B2", genre: "ghost",
      title: "The Green Door",
      pages: [
        "Every building on Oak Street had a green door except one — Number Thirteen, whose door was painted black. Nobody in the neighborhood could remember a time when that door had been green.",
        "New neighbors, the Thomases, moved into Number Thirteen. The first night, Mr. Thomas dreamed of a green door at the end of a long hall. In the dream, someone on the other side was knocking, softly, patiently.",
        "The next night, the dream returned, clearer this time. The knocking grew louder, and a voice called his name. Mrs. Thomas begged him to forget the dream, but he could not. He began to search the house.",
        "Behind a wall in the basement, he found it: a green door, locked with a heavy iron latch. Mr. Thomas touched it, and the wood was warm. 'Who is in there?' he whispered. From behind the door came a faint answer: 'Someone who waits.'",
        "He opened the door and found a small, dusty room with a single photograph on the wall — a picture of a family standing before a green door. In the corner sat an old woman, who looked at him and smiled. 'You came,' she said.",
        "She told him the story of a house that had been built over another house, a century ago. The old family still lived below, unseen. 'You are kind,' she said. 'Tell the others. We are still here, and we are still waiting to be remembered.' Mr. Thomas painted the door green, and it has been green ever since."
      ],
      thPages: [
        "ทุกอาคารบนถนนโอ๊คมีประตูสีเขียว ยกเว้นหนึ่งหลัง — บ้านเลขที่สิบสาม ที่ประตูทาสีดำ ไม่มีใครในย่านนี้จำได้ว่าครั้งไหนประตูบานนั้นเคยเป็นสีเขียว",
        "ครอบครัวใหม่ ครอบครัวโธมัส ย้ายเข้าไปในบ้านเลขที่สิบสาม คืนแรก มิสเตอร์โธมัสฝันเห็นประตูสีเขียวที่ปลายโถงยาว ในความฝัน มีคนอีกฝั่งกำลังเคาะประตู เบาๆ อย่างอดทน",
        "คืนถัดมา ความฝันกลับมา ชัดเจนขึ้นคราวนี้ เสียงเคาะดังขึ้น และเสียงเรียกชื่อเขา มิสซิสโธมัสอ้อนวอนให้เขาลืมความฝัน แต่เขาทำไม่ได้ เขาเริ่มค้นหาทั่วบ้าน",
        "หลังกำแพงในห้องใต้ดิน เขาพบมัน: ประตูสีเขียว ล็อกด้วยสลักเหล็กหนัก มิสเตอร์โธมัสแตะมัน และไม้ก็อุ่น 'ใครอยู่ในนั้น?' เขากระซิบ จากหลังประตูมีเสียงตอบแผ่วเบา: 'คนที่กำลังรอ'",
        "เขาเปิดประตูและพบห้องเล็กๆ ที่เต็มไปด้วยฝุ่น มีรูปถ่ายใบเดียวบนผนัง — รูปของครอบครัวหนึ่งยืนอยู่หน้าประตูสีเขียว ที่มุมห้องมีหญิงชราคนหนึ่งนั่งอยู่ มองเขาและยิ้ม 'คุณมาแล้ว' เธอกล่าว",
        "เธอเล่าเรื่องของบ้านที่ถูกสร้างทับบ้านอีกหลัง เมื่อศตวรรษก่อน ครอบครัวเก่ายังคงอาศัยอยู่เบื้องล่าง ที่มองไม่เห็น 'คุณใจดี' เธอกล่าว 'บอกคนอื่นด้วย เรายังอยู่ที่นี่ และเรายังคงรอการถูกจดจำ' มิสเตอร์โธมัสทาสีประตูเป็นสีเขียว และมันก็เป็นสีเขียวตั้งแต่นั้นมา"
      ]
    },
    {
      id: "cur-ghost-pier-music", level: "B2", genre: "ghost",
      title: "The Music at the Old Pier",
      pages: ["The old pier of Harborview had stood empty for years, its wooden planks rotting in the salt wind. Local children said that on foggy nights you could hear music drifting across the water — old songs that no one played anymore.",
        "A young musician named Nina came to Harborview to rest and write new songs. On the first foggy night, she heard the music too — soft and sweet, coming from the end of the pier. She walked out onto the pier, lantern in hand.",
        "At the end of the pier, a shadowy figure played an old piano that had long been lost to the sea. The player was a woman, young and pale, who didn't seem to notice Nina. 'Your song,' Nina said softly. 'It's beautiful.'",
        "The woman looked up, surprised. 'You can hear me?' she asked. She told Nina her story: she had been a pianist on a steamship that sank in a storm eighty years ago. Every night since, she had played for the passengers who never came home.",
        "Nina listened, and her heart was moved. 'Let me play with you,' she said. She found an old guitar and played beside the ghost, song after song, until the fog began to lift and the first light touched the sea.",
        "The ghost smiled for the first time in eighty years. 'Thank you,' she said. 'Now I can rest.' She faded into the morning mist, and the piano vanished with her. But Nina wrote down every song they had played, and the music of the old pier lived on in her hands."],
      thPages: ["ท่าเรือเก่าของฮาร์เบอร์วิวร้างมานานหลายปี แผ่นไม้ผุพังไปตามสายลมทะเลเค็ม เด็กๆ ในเมืองเล่าว่าในคืนที่มีหมอก คุณจะได้ยินเสียงดนตรีลอยข้ามน้ำมา — เพลงเก่าๆ ที่ไม่มีใครเล่นอีกแล้ว",
        "นักดนตรีสาวชื่อนีน่ามาที่ฮาร์เบอร์วิวเพื่อพักผ่อนและแต่งเพลงใหม่ คืนหมอกคืนแรก เธอก็ได้ยินเสียงดนตรีนั้นเหมือนกัน นุ่มนวลและไพเราะ ดังมาจากปลายท่าเรือ เธอเดินออกไปพร้อมกับถือตะเกียงในมือ",
        "ที่ปลายท่าเรือ มีร่างพร่ามัวเล่นเปียโนเก่าตัวหนึ่งที่จมหายไปในทะเลนานแล้ว ผู้เล่นเป็นหญิงสาว หน้าตายังสาวและซีดเซียว เธอดูเหมือนไม่เห็นนีน่า 'เพลงของคุณ' นีน่าพูดเบาๆ 'เพราะมากเลย'",
        "หญิงสาวเงยหน้าขึ้นด้วยความประหลาดใจ 'คุณได้ยินฉันเหรอ?' เธอถาม แล้วก็เล่าเรื่องของเธอ: เธอเคยเป็นนักเปียโนบนเรือกลไฟที่จมลงในพายุเมื่อแปดสิบปีก่อน ทุกคืนตั้งแต่นั้นมา เธอเล่นเพลงให้ผู้โดยสารที่ไม่เคยได้กลับบ้าน",
        "นีน่าฟังเรื่องของเธอแล้วรู้สึกซาบซึ้งใจ 'ให้ฉันเล่นกับคุณ' เธอกล่าว เธอหากีตาร์เก่าๆ มาเล่นอยู่ข้างๆ ผี เพลงแล้วเพลงเล่า จนหมอกเริ่มจางลงและแสงแรกแตะผิวทะเล",
        "ผียิ้มเป็นครั้งแรกในรอบแปดสิบปี 'ขอบคุณ' เธอกล่าว 'ตอนนี้ฉันได้พักเสียที' เธอจางหายไปในหมอกยามเช้า เปียโนก็หายไปพร้อมกับเธอ แต่นีน่าจดเพลงทั้งหมดที่พวกเขาเล่นเอาไว้ และดนตรีของท่าเรือเก่าก็ยังคงมีชีวิตอยู่ในมือของเธอ"]
    },
    {
      id: "cur-classic-don-quixote", level: "B1", genre: "classic",
      title: "Don Quixote",
      pages: ["In a village in La Mancha, an old gentleman named Alonso Quijano read so many tales of knights that he went a little mad. He decided to become a knight himself, took the name Don Quixote, and rode out on his skinny horse, Rocinante.",
        "He needed a lady to protect, so he chose a farm girl named Dulcinea and promised to fight for her honor. He needed a squire too, so he talked a simple farmer, Sancho Panza, into following him with the promise of an island to rule.",
        "On the road they came upon some tall windmills. 'Those are giants!' cried Don Quixote. 'Look at their arms swinging!' He charged at one with his lance, and the spinning blade lifted him into the air and dropped him.",
        "Sancho laughed and helped him up. 'I told you they were windmills,' he said. But Don Quixote was sure an evil wizard had turned the giants into windmills just to mock him. Onward he rode, chasing adventures that existed only in his own mind.",
        "He fought a flock of sheep, mistaking them for an army, and he freed some prisoners who thanked him by stealing his donkey. Every defeat, Sancho noticed, got blamed on enchanters. Yet the old knight's heart never lost its fire.",
        "At last his friends brought him home, and the old man slept and woke as plain Alonso Quijano again. 'I was mad,' he said, 'but I was happy.' He died peacefully, and the world remembered the knight who taught us that dreams are worth dreaming — even if they come to an end."],
      thPages: ["ในหมู่บ้านแห่งหนึ่งในลามันชา สุภาพบุรุษชรานามอัลอนโซ กิฮาโนอ่านนิทานอัศวินมากมายจนสติคลั่งไปนิดหน่อย เขาตัดสินใจเป็นอัศวินเสียเอง ตั้งชื่อตัวเองว่าดอนกิโฮเต้ แล้วขี่ม้าผอมกะหร่องชื่อโรซินันเตออกเดินทาง",
        "เขาต้องการหญิงงามให้ปกป้อง จึงเลือกสาวชาวนาชื่อดุลซิเนีย และสัญญาว่าจะต่อสู้เพื่อเกียรติของเธอ เขาต้องการมหาดเล็กด้วย จึงเกลี้ยกล่อมชาวนาที่ซื่อๆ ชื่อซานโช ปานซา ให้ติดตามไป ด้วยคำสัญญาว่าจะมอบเกาะให้เป็นรางวัล",
        "ระหว่างทาง พวกเขาเจอกังหันลมสูงใหญ่ 'พวกนั้นคือยักษ์!' ดอนกิโฮเต้ร้อง 'ดูแขนของมันแกว่งสิ!' เขาควบม้าเข้าชนกังหันด้วยหอกทวน แล้วใบพัดที่หมุนอยู่ก็พาเขาลอยขึ้นไปในอากาศก่อนจะปล่อยให้ร่วงหล่นลงมา",
        "ซานโชหัวเราะแล้วช่วยเขาลุก 'ฉันบอกแล้วไงว่ามันคือกังหันลม' เขาว่า แต่ดอนกิโฮเต้กลับมั่นใจว่าพ่อมดชั่วร้ายแปลงยักษ์ให้กลายเป็นกังหันลมเพื่อล้อเลียนเขา เขาควบม้าต่อไป ไล่ล่าการผจญภัยที่มีอยู่เพียงในหัวของตัวเอง",
        "เขาสู้กับฝูงแกะ โดยเข้าใจผิดว่ามันคือกองทัพ และปลดปล่อยนักโทษกลุ่มหนึ่ง ซึ่งตอบแทนเขาด้วยการขโมยลาของเขา ทุกความพ่ายแพ้ ซานโชสังเกตว่า มักถูกโยนความผิดให้นักเวทมนตร์เสมอ แต่ไฟในใจของอัศวินชราไม่เคยดับ",
        "ในที่สุด เพื่อนๆ ก็พาเขากลับบ้าน และชายชราผู้นั้นก็นอนหลับแล้วตื่นขึ้นในฐานะอัลอนโซ กิฮาโนธรรมดาอีกครั้ง 'ฉันบ้า' เขายอมรับ 'แต่ฉันมีความสุข' เขาจากไปอย่างสงบ และโลกก็จดจำอัศวินผู้สอนเราว่าความฝันนั้นมีค่าให้ฝันเสมอ — แม้สุดท้ายมันจะจบลงก็ตาม"]
    }
  ];

  // Merge curated stories (multi-page = long book) into the main list
  (function () {
    CURATED_STORIES.forEach(function (cs) {
      const text = cs.pages.join(" ");
      const thText = cs.thPages.join(" ");
      ALL_STORIES.push({
        id: cs.id, level: cs.level, genre: cs.genre, title: cs.title,
        text: text, thText: thText,
        pages: cs.pages, thPages: cs.thPages
      });
    });
  })();

  /* -------- Graded Reader helpers (progress / saved words / quiz / SOTD) -------- */

  function storyWordCount(s) { return (s.text || "").trim().split(/\s+/).length; }
  function storyReadMins(s) { return Math.max(1, Math.round(storyWordCount(s) / 200)); }

  function isStoryRead(id) { return !!storyRead[id]; }
  function markStoryRead(id) {
    if (!storyRead[id]) {
      storyRead[id] = todayStr();
      save(K_STORY_READ, storyRead);
    }
  }

  function storyProgressFor(level) {
    const pool = ALL_STORIES.filter(function (s) { return s.level === level; });
    const done = pool.filter(function (s) { return isStoryRead(s.id); }).length;
    return { done: done, total: pool.length };
  }

  function renderStoryProgress() {
    const wrap = $("storyProgress");
    if (!wrap) return;
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const html = levels.map(function (lvl) {
      const p = storyProgressFor(lvl);
      const pct = p.total ? Math.round(p.done / p.total * 100) : 0;
      return '<div style="display:flex;align-items:center;gap:10px;margin:6px 0;font-size:12px;">' +
        '<span style="width:30px;font-weight:700;color:var(--primary);">' + lvl + "</span>" +
        '<div class="day-mini-bar" style="flex:1;"><div class="day-mini-fill" style="width:' + pct + '%;"></div></div>' +
        '<span style="width:52px;text-align:right;color:var(--muted);">' + p.done + "/" + p.total + " · " + pct + "%</span>" +
        "</div>";
    }).join("");
    wrap.style.display = "block";
    wrap.innerHTML = '<div style="font-weight:700;margin-bottom:4px;color:var(--text);">' + svgIcon("chart", "ico sm") + " " + t("stories.progressTitle") + "</div>" + html;
  }

  function storyGenre(s) { return s.genre || "article"; }

  function storyGenreLabel(g) {
    if (g === "fairy") return t("stories.genreFairy");
    if (g === "ghost") return t("stories.genreGhost");
    if (g === "adventure") return t("stories.genreAdventure");
    if (g === "scifi") return t("stories.genreScifi");
    if (g === "mystery") return t("stories.genreMystery");
    if (g === "classic") return t("stories.genreClassic");
    return t("stories.genreArticle");
  }
  function storyGenreIcon(g) {
    if (g === "fairy") return "sparkle";
    if (g === "ghost") return "moon";
    if (g === "adventure") return "compass";
    if (g === "scifi") return "bolt";
    if (g === "mystery") return "eye";
    if (g === "classic") return "quill";
    return "book";
  }

  function storyOfTheDay() {
    let pool = ALL_STORIES;
    if (currentActiveLevelFilter !== "All") pool = pool.filter(function (s) { return s.level === currentActiveLevelFilter; });
    if (currentGenreFilter !== "All") pool = pool.filter(function (s) { return storyGenre(s) === currentGenreFilter; });
    if (!pool.length) return null;
    return pool[daySeed(todayStr() + currentActiveLevelFilter + currentGenreFilter) % pool.length];
  }

  function storyLevelBadgeHtml(s) {
    const info = (window.CEFR_LEVELS && CEFR_LEVELS[s.level]) || { color: "var(--primary)", name: s.level, th: "" };
    const color = info.color;
    const name = (settings.lang === "th" && info.th) ? info.th : info.name;
    return '<div class="story-hover-badge" style="--lvl-color:' + color + ';">' + svgIcon("award", "ico sm") + " " + s.level + " · " + name + "</div>";
  }

  // Featured card for Story of the Day — spans the full grid width.
  function sotdCardHtml(s) {
    return '<div class="story-card sotd-card" data-story-id="' + s.id + '" style="padding:24px;border-radius:16px;background:var(--panel-solid);border:1px solid var(--border);">' +
      storyLevelBadgeHtml(s) +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<div class="sotd-badge">' + svgIcon("sparkle", "ico sm") + " " + t("stories.sotd") + "</div>" +
      '</div>' +
      '<div class="sotd-body">' +
      '<h4 style="font-size:20px;font-weight:700;margin-bottom:8px;">' + esc(s.title) + "</h4>" +
      '<p style="line-height:1.6;margin-bottom:16px;color:var(--muted);">' + esc(s.text) + "</p>" +
      '<div class="sotd-meta" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:16px;font-size:13px;color:var(--muted);">' +
      '<span class="sotd-genre">' + svgIcon(storyGenreIcon(s.genre), "ico sm") + " " + storyGenreLabel(s.genre) + "</span>" +
      '<span>' + svgIcon("clock", "ico sm") + " ~" + storyReadMins(s) + " " + t("stories.minutes") + "</span>" +
      (s.pages ? '<span>' + svgIcon("book", "ico sm") + " " + s.pages.length + " " + t("stories.pages") + "</span>" : "") +
      "</div>" +
      "</div>" +
      '<button class="btn btn-sm btn-primary" data-sotd-read style="padding:10px 20px;border-radius:10px;">' + t("stories.readNow") + "</button>" +
      "</div>";
  }

  /* Save a word from a story into the per-story saved list. */
  function toggleStoryWord(storyId, item) {
    if (!storyWords[storyId]) storyWords[storyId] = [];
    const arr = storyWords[storyId];
    const idx = arr.indexOf(item.id);
    if (idx === -1) arr.push(item.id);
    else arr.splice(idx, 1);
    save(K_STORY_WORDS, storyWords);
    renderStorySavedWords(storyId);
  }
  function storySavedItems(storyId) {
    const arr = storyWords[storyId] || [];
    return arr.map(function (id) {
      return ITEMS.find(function (i) { return i.id === id; }) || ALL_ITEMS.find(function (i) { return i.id === id; });
    }).filter(Boolean);
  }
  function renderStorySavedWords(storyId) {
    const panel = $("storySavedWords");
    const listBox = $("storySavedList");
    const reviewBtn = $("storyReviewSaved");
    if (!panel || !listBox) return;
    const items = storySavedItems(storyId);
    panel.classList.remove("hidden");
    if (!items.length) {
      listBox.innerHTML = '<p class="hint" style="margin:0;">' + t("stories.noSaved") + "</p>";
      if (reviewBtn) reviewBtn.classList.add("hidden");
      return;
    }
    if (reviewBtn) reviewBtn.classList.remove("hidden");
    listBox.innerHTML = items.map(function (i) {
      return '<span class="badge-sm" style="margin:3px 4px 3px 0;display:inline-flex;align-items:center;gap:5px;">' +
        esc(i.word) + '<span style="color:var(--muted);font-weight:400;">' + (i.th || "") + "</span></span>";
    }).join("");
    if (reviewBtn) reviewBtn.onclick = function () { reviewWeakSpots(items); };
  }

  /* Build a small comprehension quiz from a story. */
  function buildStoryQuiz(story) {
    const qs = [];
    const sameLevel = ALL_STORIES.filter(function (s) { return s.level === story.level && s.id !== story.id; });
    const distractors = shuffle(sameLevel).slice(0, 3).map(function (s) { return s.title; });
    qs.push({ q: t("stories.qTopic"), options: shuffle([story.title].concat(distractors)), answer: story.title });
    const target = storyTargetSet(story.level);
    const words = (story.text.match(/[a-zA-Z]+/g) || []).map(function (w) { return w.toLowerCase(); });
    const seen = {};
    const vocab = [];
    words.forEach(function (w) {
      if (seen[w] || !target[w]) return;
      seen[w] = true; vocab.push(target[w]);
    });
    shuffle(vocab).slice(0, 2).forEach(function (item) {
      const wTh = item.th || item.translation || "";
      if (!wTh) return;
      const others = Object.keys(target).map(function (k) { return target[k].th || target[k].translation || ""; }).filter(function (x) { return x && x !== wTh; });
      qs.push({ q: t("stories.qMeaning").replace("{w}", item.word), options: shuffle([wTh].concat(shuffle(others).slice(0, 3))), answer: wTh });
    });
    return qs;
  }

  function renderStoryQuiz(story) {
    const wrap = $("storyQuiz");
    const box = $("storyQuizBox");
    if (!wrap || !box) return;
    const qs = buildStoryQuiz(story);
    if (!qs.length) return;
    wrap.classList.remove("hidden");
    box.innerHTML = '<button class="btn btn-primary" id="storyQuizStart">' + t("stories.quizTitle") + " →</button>";
    $("storyQuizStart").onclick = function () {
      let qi = 0, score = 0;
      const renderQ = function () {
        if (qi >= qs.length) {
          const perfect = score === qs.length;
          awardXp(perfect ? 20 : 10, "story-quiz:" + story.id);
          toast(t("stories.quizResult").replace("{c}", score).replace("{t}", qs.length), perfect ? "ok" : "info");
          box.innerHTML = '<div style="font-size:15px;font-weight:600;color:' + (perfect ? "var(--good)" : "var(--text)") + ';">' +
            svgIcon(perfect ? "trophy" : "book", "ico sm") + " " + t("stories.quizResult").replace("{c}", score).replace("{t}", qs.length) + "</div>" +
            '<button class="btn" id="storyQuizRetry" style="margin-top:10px;">' + svgIcon("refresh", "ico sm") + " " + t("stories.quizTitle") + "</button>";
          const retry = $("storyQuizRetry");
          if (retry) retry.onclick = function () { renderStoryQuiz(story); };
          return;
        }
        const q = qs[qi];
        box.innerHTML = '<div style="font-weight:700;margin-bottom:10px;font-size:15px;color:var(--text);">' + (qi + 1) + ". " + esc(q.q) + "</div>" +
          q.options.map(function (opt) {
            return '<button class="chip story-q-opt" data-opt="' + esc(opt) + '" style="display:block;width:100%;text-align:left;margin:6px 0;">' + esc(opt) + "</button>";
          }).join("");
        box.querySelectorAll(".story-q-opt").forEach(function (btn) {
          btn.onclick = function () {
            const correct = btn.dataset.opt === q.answer;
            if (correct) score++;
            btn.classList.add(correct ? "active" : "err");
            box.querySelectorAll(".story-q-opt").forEach(function (b) {
              if (b !== btn) b.style.opacity = "0.5";
              if (b.dataset.opt === q.answer) b.classList.add("active");
            });
            setTimeout(function () { qi++; renderQ(); }, 900);
          };
        });
      };
      renderQ();
    };
  }

  function storyTargetSet(level) {
    try {
      const items = (window.CefrSelector && window.CefrSelector.getItemsForLevel) ? window.CefrSelector.getItemsForLevel(level) : [];
      const set = {};
      items.forEach(function (i) { set[i.word.toLowerCase()] = i; });
      return set;
    } catch (e) { return {}; }
  }

  /* -------- Shared story-word rendering + tooltip (used by body & book pages) -------- */
  let bookPageIdx = 0;
  let bookStory = null;

  function storyWordsHtml(text, story) {
    const target = storyTargetSet(story.level);
    const saved = storyWords[story.id] || [];
    const sentences = text.split(/([.!?]+\s+)/).map(function (part, i, arr) {
      return (i % 2 === 0) ? part + (arr[i + 1] || "") : "";
    }).filter(Boolean);
    return sentences.map(function (sentence) {
      const words = sentence.split(" ").map(function (w) {
        const clean = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
        const isTarget = target[clean] || target[clean.replace(/s$/, "")] || target[clean.replace(/ies$/, "y")] || target[clean.replace(/es$/, "")];
        const isSaved = saved.some(function (id) {
          const it = ITEMS.find(function (i) { return i.id === id; }) || ALL_ITEMS.find(function (i) { return i.id === id; });
          return it && (it.word.toLowerCase() === clean || it.word.toLowerCase() === clean.replace(/s$/, ""));
        });
        return '<span class="story-word' + (isTarget ? " target" : "") + (isSaved ? " saved" : "") + '" data-word="' + clean + '" title="Click for translation &amp; pronunciation">' + esc(w) + '</span>';
      }).join(" ");
      return '<span class="story-line">' + words + "</span>";
    }).join("");
  }

  function bindStoryWordClicks(container, story) {
    container.querySelectorAll(".story-word").forEach(function (span) {
      span.onclick = function (e) {
        e.stopPropagation();
        const cw = span.dataset.word;
        if (!cw) return;
        let found = ITEMS.find(function (i) { return i.word.toLowerCase() === cw; }) || COMMON_TH_DICT[cw];
        if (!found) {
          const stemIes = cw.replace(/ies$/, "y");
          const stemEs = cw.replace(/es$/, "");
          const stemS = cw.replace(/s$/, "");
          const stemEd = cw.replace(/ed$/, "");
          const stemIng = cw.replace(/ing$/, "");
          const stemLy = cw.replace(/ly$/, "");

          found = ITEMS.find(function (i) { return i.word.toLowerCase() === stemIes; }) || COMMON_TH_DICT[stemIes] ||
                  ITEMS.find(function (i) { return i.word.toLowerCase() === stemEs; }) || COMMON_TH_DICT[stemEs] ||
                  ITEMS.find(function (i) { return i.word.toLowerCase() === stemS; }) || COMMON_TH_DICT[stemS] ||
                  ITEMS.find(function (i) { return i.word.toLowerCase() === stemEd; }) || COMMON_TH_DICT[stemEd] ||
                  ITEMS.find(function (i) { return i.word.toLowerCase() === stemIng; }) || COMMON_TH_DICT[stemIng] ||
                  ITEMS.find(function (i) { return i.word.toLowerCase() === stemLy; }) || COMMON_TH_DICT[stemLy];
        }

        let phonetic = "—";
        let pos = "word";
        let thMeaning = "";

        if (found) {
          phonetic = found.phonetic || "—";
          pos = found.pos || "word";
          thMeaning = found.th || found.translation || found.exEn || "";
        } else {
          pos = guessPartOfSpeech(cw);
          thMeaning = "คำศัพท์: " + cw + " (" + getPosThai(pos) + ")";
        }

        try {
          if ("speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance(span.textContent.replace(/[^a-zA-Z]/g, ""));
            u.lang = "en-US";
            window.speechSynthesis.speak(u);
          }
        } catch (err) {}

        const oldTip = document.getElementById("wordTooltip");
        if (oldTip) oldTip.remove();

        const rect = span.getBoundingClientRect();
        const tip = document.createElement("div");
        tip.id = "wordTooltip";
        tip.style.cssText = "position:absolute;z-index:9999;background:var(--panel-solid);border:1px solid var(--primary);border-radius:12px;padding:12px 16px;box-shadow:0 10px 25px rgba(0,0,0,0.2);max-width:280px;font-size:14px;animation:fadeIn 0.15s ease;";

        const isSavedWord = found && found.id && (storyWords[story.id] || []).indexOf(found.id) !== -1;
        let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<strong style="font-size:16px;color:var(--primary);">' + esc(span.textContent) + '</strong>' +
          '<button id="tipClose" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--muted);padding:0 4px;">&times;</button>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">[' + esc(phonetic) + '] · <em>' + esc(pos) + '</em></div>' +
          '<div style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text);">' + esc(thMeaning) + '</div>';

        if (found && found.id) {
          html += '<button id="tipDetails" class="btn btn-sm btn-primary" style="width:100%;font-size:12px;padding:5px 8px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;">' + svgIcon("info", "ico sm") + ' <span>' + t("stories.viewDetails") + '</span></button>';
          html += '<button id="tipSave" class="btn btn-sm" style="width:100%;font-size:12px;padding:5px 8px;display:flex;align-items:center;justify-content:center;gap:6px;">' +
            svgIcon("bookmark", "ico sm") + ' <span>' + (isSavedWord ? t("stories.unsaved") : t("stories.saveWord")) + '</span></button>';
        }

        tip.innerHTML = html;

        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        let topPos = rect.bottom + scrollY + 6;
        let leftPos = rect.left + scrollX;

        if (leftPos + 280 > window.innerWidth) leftPos = window.innerWidth - 300;
        if (leftPos < 10) leftPos = 10;

        tip.style.top = topPos + "px";
        tip.style.left = leftPos + "px";

        document.body.appendChild(tip);

        const closeBtn = document.getElementById("tipClose");
        if (closeBtn) closeBtn.onclick = function () { tip.remove(); };

        const detailsBtn = document.getElementById("tipDetails");
        if (detailsBtn && found && found.id) {
          detailsBtn.onclick = function () { tip.remove(); openDetail(found); };
        }

        const saveBtn = document.getElementById("tipSave");
        if (saveBtn && found && found.id) {
          saveBtn.onclick = function () {
            toggleStoryWord(story.id, found);
            tip.remove();
            toast(t("stories.saved"), "ok", "bookmark");
            if (bookStory && bookStory.id === story.id) renderBookPage();
            else $("storyBody").innerHTML = storyWordsHtml(story.text, story);
          };
        }

        const outsideClick = function (ev) {
          if (!tip.contains(ev.target) && ev.target !== span) {
            tip.remove();
            document.removeEventListener("click", outsideClick);
          }
        };
        setTimeout(function () {
          document.addEventListener("click", outsideClick);
        }, 50);
      };
    });
  }

  /* -------- Book reader: page-by-page flip for long (multi-page) stories -------- */
  let bookMeasuredHeight = 0;

  function bookMeasureHeight() {
    const story = bookStory;
    if (!story) return 240;
    let max = 240;
    story.pages.forEach(function (pg) {
      const tmp = document.createElement("div");
      tmp.style.cssText = "position:absolute;visibility:hidden;left:-9999px;width:" + $("bookFront").offsetWidth + "px;font-size:16px;line-height:2;padding:24px 28px;";
      tmp.innerHTML = storyWordsHtml(pg, story);
      document.body.appendChild(tmp);
      max = Math.max(max, tmp.scrollHeight);
      document.body.removeChild(tmp);
    });
    return max;
  }

  function bookSheetSnap() {
    const sheet = $("bookSheet");
    sheet.style.transition = "none";
    sheet.classList.remove("flipping", "flipping-back");
    sheet.style.left = "50%";
    sheet.style.transformOrigin = "left center";
    void sheet.offsetWidth;
    sheet.style.transition = "";
  }

  function bookCoverHtml(story) {
    return '<div class="book-cover">' +
      svgIcon("book", "ico lg") +
      "<h4>" + esc(story.title) + "</h4>" +
      '<p>' + story.level + " · " + storyGenreLabel(story.genre) + "</p>" +
      "</div>";
  }

  // Two-page spread: the left half shows the cover (spread 0) or the previous page;
  // the right half (the flip sheet) shows the current page. Each flip advances one page:
  // forward turns the current right page over the spine revealing the next page underneath;
  // backward turns the current left page back revealing the previous page underneath.
  function renderBookPage() {
    const story = bookStory;
    if (!story) return;
    const front = $("bookFront");
    const back = $("bookBack");
    const left = $("bookLeft");
    const right = $("bookRight");
    const total = story.pages.length;

    if (bookPageIdx === 0) {
      left.innerHTML = bookCoverHtml(story);
    } else {
      left.innerHTML = storyWordsHtml(story.pages[bookPageIdx - 1], story);
      bindStoryWordClicks(left, story);
    }

    const currentHtml = storyWordsHtml(story.pages[bookPageIdx], story);
    front.innerHTML = currentHtml;
    back.innerHTML = currentHtml;
    bindStoryWordClicks(front, story);
    bindStoryWordClicks(back, story);
    right.innerHTML = "";

    $("bookPageNum").textContent = (bookPageIdx + 1) + " / " + total;
    const prevBtn = $("bookPrev");
    const nextBtn = $("bookNext");
    if (prevBtn) prevBtn.disabled = bookPageIdx === 0;
    if (nextBtn) nextBtn.disabled = bookPageIdx === total - 1;
    bookSheetSnap();
    const vp = $("bookViewport");
    if (vp) {
      if (!bookMeasuredHeight) bookMeasuredHeight = bookMeasureHeight();
      vp.style.height = bookMeasuredHeight + "px";
    }
    if (bookPageIdx === total - 1 && !isStoryRead(story.id)) {
      markStoryRead(story.id);
      const markBtn = $("storyMarkRead");
      if (markBtn) markBtn.style.display = "none";
      renderStoryProgress();
      renderStoryQuiz(story);
      toast(t("stories.markedRead"), "ok", "check");
    }
  }

  function bookFlip(dir) {
    const story = bookStory;
    if (!story) return;
    const total = story.pages.length;
    const target = bookPageIdx + dir;
    if (target < 0 || target >= total) return;
    const sheet = $("bookSheet");
    const front = $("bookFront");
    const back = $("bookBack");
    const left = $("bookLeft");
    const right = $("bookRight");
    const vp = $("bookViewport");
    const prevBtn = $("bookPrev");
    const nextBtn = $("bookNext");
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    bookSheetSnap();

    if (dir === 1) {
      // Forward: current right page turns over the spine to the left;
      // the next page is revealed underneath on the right.
      const turningHtml = storyWordsHtml(story.pages[bookPageIdx], story);
      front.innerHTML = turningHtml;
      back.innerHTML = turningHtml;
      bindStoryWordClicks(front, story);
      bindStoryWordClicks(back, story);
      right.innerHTML = storyWordsHtml(story.pages[target], story);
      bindStoryWordClicks(right, story);
      sheet.style.left = "50%";
      sheet.style.transformOrigin = "left center";
    } else {
      // Backward: current left page turns back over the spine to the right;
      // the previous page (or cover) is revealed underneath on the left.
      const turningHtml = (bookPageIdx === 0) ? bookCoverHtml(story) : storyWordsHtml(story.pages[bookPageIdx - 1], story);
      front.innerHTML = turningHtml;
      back.innerHTML = turningHtml;
      bindStoryWordClicks(front, story);
      bindStoryWordClicks(back, story);
      left.innerHTML = (target === 0) ? bookCoverHtml(story) : storyWordsHtml(story.pages[target - 1], story);
      if (target !== 0) bindStoryWordClicks(left, story);
      sheet.style.left = "0%";
      sheet.style.transformOrigin = "right center";
    }
    if (vp) vp.style.height = bookMeasuredHeight + "px";
    void sheet.offsetWidth;

    if (dir === 1) sheet.classList.add("flipping");
    else sheet.classList.add("flipping-back");
    setTimeout(function () {
      bookPageIdx = target;
      bookSheetSnap();
      renderBookPage();
    }, 760);
  }

  function openStory(story) {
    const list = $("storiesList");
    const reader = $("storyReader");
    const filtersContainer = $("storyFilters");
    const genreFilters = $("storyGenreFilters");
    if (!list || !reader) return;
    currentStory = story;
    list.classList.add("hidden");
    reader.classList.remove("hidden");
    if (filtersContainer) filtersContainer.classList.add("hidden");
    if (genreFilters) genreFilters.classList.add("hidden");

    $("storyTitle").textContent = story.title + " (" + story.level + ")";

    const thaiBox = $("storyThaiBox");
    const thaiText = $("storyThaiText");
    const translateBtn = $("storyTranslateBtn");
    if (thaiBox) thaiBox.classList.add("hidden");
    if (thaiText) thaiText.textContent = story.thText;
    if (translateBtn) {
      translateBtn.innerHTML = svgIcon("book", "ico sm") + t("stories.translate");
      translateBtn.onclick = function () {
        if (thaiBox.classList.contains("hidden")) {
          thaiBox.classList.remove("hidden");
          translateBtn.innerHTML = svgIcon("book", "ico sm") + t("stories.hideTranslate");
        } else {
          thaiBox.classList.add("hidden");
          translateBtn.innerHTML = svgIcon("book", "ico sm") + t("stories.translate");
        }
      };
    }

    const markBtn = $("storyMarkRead");
    if (markBtn) {
      markBtn.style.display = isStoryRead(story.id) ? "none" : "inline-flex";
      markBtn.onclick = function () {
        markStoryRead(story.id);
        markBtn.style.display = "none";
        renderStoryProgress();
        renderStoryQuiz(story);
        toast(t("stories.markedRead"), "ok", "check");
      };
    }

    const isBook = !!(story.pages && story.pages.length > 1);
    const bodyEl = $("storyBody");
    const bookEl = $("storyBook");
    if (isBook) {
      if (bodyEl) bodyEl.classList.add("hidden");
      if (bookEl) bookEl.classList.remove("hidden");
      bookStory = story;
bookPageIdx = 0;
      bookMeasuredHeight = 0;
      if (currentStoryScrollHandler) { window.removeEventListener("scroll", currentStoryScrollHandler); currentStoryScrollHandler = null; }
      renderBookPage();
      const prevBtn = $("bookPrev");
      const nextBtn = $("bookNext");
      if (prevBtn) prevBtn.onclick = function () { bookFlip(-1); };
      if (nextBtn) nextBtn.onclick = function () { bookFlip(1); };
    } else {
      if (bookEl) bookEl.classList.add("hidden");
      if (bodyEl) bodyEl.classList.remove("hidden");
      bookStory = null;
      bodyEl.innerHTML = storyWordsHtml(story.text, story);
      bindStoryWordClicks(bodyEl, story);

      // auto-mark read when scrolled to the bottom of the article
      if (currentStoryScrollHandler) window.removeEventListener("scroll", currentStoryScrollHandler);
      currentStoryScrollHandler = function () {
        const readerEl = $("storyReader");
        if (!currentStory || !readerEl || readerEl.classList.contains("hidden")) return;
        if (isStoryRead(currentStory.id)) return;
        const rect = bodyEl.getBoundingClientRect();
        if (rect.bottom <= window.innerHeight + 8) {
          markStoryRead(currentStory.id);
          if (markBtn) markBtn.style.display = "none";
          renderStoryProgress();
          renderStoryQuiz(currentStory);
          toast(t("stories.markedRead"), "ok", "check");
        }
      };
      window.addEventListener("scroll", currentStoryScrollHandler);
      setTimeout(function () { currentStoryScrollHandler(); }, 60);
    }

    renderStorySavedWords(story.id);
    if (isStoryRead(story.id)) renderStoryQuiz(story);
  }

  async function generateAiCustomStory() {
    const weak = getWeakWords();
    if (!weak || weak.length === 0) {
      toast("ยังไม่มีคำศัพท์ที่อ่อนในระบบ — ลองไปเรียนหรือตอบคำถามในโหมดต่างๆ ก่อน!", "warn", "alert-circle");
      return;
    }
    const words = weak.slice(0, 8).map(function(w) { return w.word; });
    toast("กำลังให้ AI เขียนเรื่องราวพิเศษจากคำศัพท์ที่คุณจำไม่ได้ (" + words.join(", ") + ")...", "info", "cpu");
    
    try {
      const res = await fetch("http://localhost:3001/api/ai/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: words })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate story");
      }
      
      const aiStory = {
        id: "ai_story_" + Date.now(),
        title: "AI Custom Story (Weak Words)",
        level: "Custom",
        genre: "article",
        text: data.story,
        thText: "เรื่องราวพิเศษที่สร้างขึ้นโดย AI จากคำศัพท์ที่คุณเพิ่งฝึกฝน",
        words: words
      };
      
      openStory(aiStory);
      toast("สร้างเรื่องราวสำเร็จ!", "ok", "check");
    } catch (e) {
      toast("เกิดข้อผิดพลาดในการสร้างเรื่องราว: " + e.message, "err", "alert-circle");
    }
  }

  function renderStories() {
    const list = $("storiesList");
    const reader = $("storyReader");
    const filtersContainer = $("storyFilters");
    const genreFilters = $("storyGenreFilters");
    if (!list || !reader) return;

    list.classList.remove("hidden");
    reader.classList.add("hidden");
    if (filtersContainer) filtersContainer.classList.remove("hidden");
    if (genreFilters) genreFilters.classList.remove("hidden");

    // Prepend AI Custom Story Button if not present
    let aiBtnWrap = $("aiStoryBtnWrap");
    if (!aiBtnWrap && genreFilters && genreFilters.parentNode) {
      aiBtnWrap = document.createElement("div");
      aiBtnWrap.id = "aiStoryBtnWrap";
      aiBtnWrap.style.cssText = "margin-bottom:16px;text-align:center;";
      aiBtnWrap.innerHTML = '<button id="aiStoryBtn" class="btn primary" style="background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:700;padding:12px 24px;border-radius:12px;box-shadow:0 4px 12px rgba(99,102,241,0.3);cursor:pointer;display:inline-flex;align-items:center;gap:8px;">' +
        svgIcon("sparkle", "ico") + " สร้างเรื่องราวพิเศษด้วย AI (จากคำศัพท์ที่คุณจำไม่ได้)</button>";
      genreFilters.parentNode.insertBefore(aiBtnWrap, genreFilters);
      const btn = $("aiStoryBtn");
      if (btn) btn.onclick = generateAiCustomStory;
    }

    if (genreFilters) {
      const genreOptions = [
        { v: "All", label: t("stories.genreAll") },
        { v: "fairy", label: t("stories.genreFairy") },
        { v: "ghost", label: t("stories.genreGhost") },
        { v: "adventure", label: t("stories.genreAdventure") },
        { v: "scifi", label: t("stories.genreScifi") },
        { v: "mystery", label: t("stories.genreMystery") },
        { v: "classic", label: t("stories.genreClassic") },
        { v: "article", label: t("stories.genreArticle") }
      ];
      genreFilters.innerHTML = genreOptions.map(function (g) {
        const count = (g.v === "All") ? ALL_STORIES.length : ALL_STORIES.filter(function (s) { return storyGenre(s) === g.v; }).length;
        return '<button class="chip ' + (currentGenreFilter === g.v ? "active" : "") + '" data-filter-genre="' + g.v + '">' +
          svgIcon(storyGenreIcon(g.v === "All" ? "article" : g.v), "ico sm") +
          " " + g.label + " (" + count + ")</button>";
      }).join("");
      genreFilters.querySelectorAll(".chip").forEach(function (btn) {
        btn.onclick = function () {
          currentGenreFilter = btn.dataset.filterGenre;
          renderStories();
        };
      });
    }

    if (filtersContainer) {
      const filterOptions = ["All", "A1", "A2", "B1", "B2", "C1", "C2"];
      filtersContainer.innerHTML = filterOptions.map(function (lvl) {
        const isActive = (currentActiveLevelFilter === lvl);
        const count = (lvl === "All") ? ALL_STORIES.length : ALL_STORIES.filter(function (s) { return s.level === lvl; }).length;
        return '<button class="chip ' + (isActive ? "active" : "") + '" data-filter-lvl="' + lvl + '">' + lvl + " (" + count + ")</button>";
      }).join("");

      filtersContainer.querySelectorAll(".chip").forEach(function (btn) {
        btn.onclick = function () {
          currentActiveLevelFilter = btn.dataset.filterLvl;
          renderStories();
        };
      });
    }

    renderStoryProgress();

    let filteredStories = (currentActiveLevelFilter === "All") ? ALL_STORIES : ALL_STORIES.filter(function (s) { return s.level === currentActiveLevelFilter; });
    if (currentGenreFilter !== "All") filteredStories = filteredStories.filter(function (s) { return storyGenre(s) === currentGenreFilter; });

    // Story of the Day featured card at the top of the grid (excluded from the list below)
    const sotd = storyOfTheDay();
    let html = "";
    if (sotd) html += sotdCardHtml(sotd);
    if (sotd) filteredStories = filteredStories.filter(function (s) { return s.id !== sotd.id; });

    html += filteredStories.map(function (s) {
      const wc = storyWordCount(s);
      const mins = storyReadMins(s);
      const read = isStoryRead(s.id);
      const isBook = !!(s.pages && s.pages.length > 1);
      return '<div class="story-card' + (read ? " read" : "") + '" data-story-id="' + s.id + '" style="background:var(--panel-solid);border:1px solid var(--border);border-radius:16px;padding:24px;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column;justify-content:space-between;">' +
        storyLevelBadgeHtml(s) +
        '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap;">' +
        (s.genre && s.genre !== "article"
          ? '<span class="story-genre-badge" data-genre="' + s.genre + '">' + svgIcon(storyGenreIcon(s.genre), "ico sm") + " " + storyGenreLabel(s.genre) + "</span>"
          : '<span class="story-genre-badge" data-genre="article">' + svgIcon("book", "ico sm") + " Article</span>") +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:12px;color:var(--muted);">' + (read ? svgIcon("check", "ico sm") + ' ' + t("stories.read") : (isBook ? svgIcon("book", "ico sm") + " " + s.pages.length + " " + t("stories.pages") : "")) + '</span>' +
        '</div>' +
        '</div>' +
        '<h4 style="font-size:19px;font-weight:700;margin:0 0 10px;line-height:1.4;">' + esc(s.title) + '</h4>' +
        '<p style="font-size:13.5px;color:var(--muted);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0 0 16px;">' + esc(s.text) + '</p>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--muted);border-top:1px solid var(--border);padding-top:14px;margin-top:auto;">' +
        '<span style="display:flex;align-items:center;gap:4px;">' + svgIcon("file", "ico sm") + " " + wc + " " + t("stories.wordsCount") + "</span>" +
        '<span style="display:flex;align-items:center;gap:4px;">' + svgIcon("clock", "ico sm") + " ~" + mins + " " + t("stories.minutes") + "</span>" +
        "</div>" +
        '</div>';
    }).join("");

    list.innerHTML = html;

    list.querySelectorAll(".story-card").forEach(function (card) {
      card.onclick = function () {
        const story = ALL_STORIES.find(function (s) { return s.id === card.dataset.storyId; });
        if (!story) return;
        openStory(story);
      };
    });

    const back = $("storyBack");
    if (back) {
      back.textContent = t("stories.back");
      back.onclick = function () {
        if (currentStoryScrollHandler) { window.removeEventListener("scroll", currentStoryScrollHandler); currentStoryScrollHandler = null; }
        currentStory = null;
        renderStories();
      };
    }
  }

  /* ============================================================
     DICTATION QUIZ (Feature 2) & WRITING JOURNAL (Feature 3)
     ============================================================ */
  function renderDictationQuiz() {
    const audioBtn = $("dictationAudioBtn");
    const input = $("dictationInput");
    const submit = $("dictationSubmit");
    const feedback = $("dictationFeedback");
    if (!audioBtn || !input || !submit) return;

    let currentDictWord = null;

    function nextWord() {
      input.value = "";
      if (feedback) feedback.textContent = "";
      const candidates = ITEMS;
      currentDictWord = candidates[Math.floor(Math.random() * candidates.length)];
      try {
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(currentDictWord.word);
          u.lang = "en-US";
          window.speechSynthesis.speak(u);
        }
      } catch (e) {}
    }

    audioBtn.onclick = function () {
      if (!currentDictWord) nextWord();
      else {
        try {
          if ("speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance(currentDictWord.word);
            u.lang = "en-US";
            window.speechSynthesis.speak(u);
          }
        } catch (e) {}
      }
    };

    submit.onclick = function () {
      if (!currentDictWord) { nextWord(); return; }
      const typed = input.value.trim().toLowerCase();
      if (typed === currentDictWord.word.toLowerCase()) {
        if (feedback) {
          feedback.innerHTML = '<span style="color:var(--success);">' + svgIcon("check", "ico sm") + ' Correct! The word was: <b>' + esc(currentDictWord.word) + '</b></span>';
        }
        awardXp(15);
        fireConfetti(32);
        setTimeout(nextWord, 1500);
      } else {
        if (feedback) {
          feedback.innerHTML = '<span style="color:var(--danger);">' + svgIcon("cross", "ico sm") + ' Incorrect. Try again or listen closely!</span>';
        }
      }
    };

    input.onkeydown = function (e) {
      if (e.key === "Enter") submit.click();
    };

    nextWord();
  }



  /* ============================================================
     REAL PUSH NOTIFICATIONS VIA SERVICE WORKER
     ============================================================ */
  function startReminderScheduler() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then(function (perm) {
        if (perm === "granted") {
          toast("Push notifications enabled successfully!", "ok", "bell");
        }
      });
    } else if (Notification.permission === "granted") {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(function (reg) {
          reg.showNotification("Vocab Trainer Reminder", {
            body: "Your daily vocabulary review is ready! Keep your streak alive.",
            icon: "assets/img/icon-192.png"
          });
        });
      }
    }
  }

  /* Expose i18n API so other modules (auth.js, etc.) can use the shared
     translation system without duplicating string tables. */
  window.VocabApp = {
    t: t,
    applyI18n: applyI18n,
    setLang: setLang,
    showView: showView,
    onCefrLevelChange: function(newLevel) {
      // ระดับเปลี่ยน = แผนเรียนใหม่เริ่มนับวันใหม่จากวันนี้ (Day 1 ของระดับใหม่)
      if (newLevel && settings && typeof settings === "object") {
        settings.planStartDate = todayStr();
        delete settings.planDayOverride;
        try { save(K_SETTINGS, settings); } catch (e) {}
      }
      if (window.CefrSelector && window.CefrSelector.onCefrLevelChange) {
        window.CefrSelector.onCefrLevelChange(newLevel);
      }
    },
    toast: toast,
    getStats: function () {
      try {
        const info = levelProgress(game.xp);
        const title = highestTitle();
        return {
          xp: game.xp,
          level: info.level,
          rank: info.rank,
          inLevel: info.inLevel,
          need: info.need,
          pct: info.pct,
          wordsLearned: totalLearned(),
          mastered: masteredCount(),
          streak: currentStreak(),
          achievements: Object.keys(game.achievements || {}).length,
          title: title ? title.name : ""
        };
      } catch (e) { return null; }
    }
  };
})();
