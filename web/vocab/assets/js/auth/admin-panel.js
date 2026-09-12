/* ============================================================
   Vocab Trainer — admin-panel.js
   Admin Control Center (icon-based, tabbed). Replaces the old
   emoji-only auth.js admin modal. Many actions for testing the
   app: change your CEFR level, set XP/streak, seed word progress,
   write exam/post-test history, and hard data resets.
   Loads AFTER app.js / cefr-selector.js / placement.js.
   Exposes window.AdminPanel.show().
   ============================================================ */
(function () {
  "use strict";

  var ICONS = {
    award: '<circle cx="12" cy="8" r="7"/><path d="M8.2 12.4l2.6 2.6L16 9"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    flame: '<path d="M12 3c3 3.5 4.5 6 4.5 9a4.5 4.5 0 0 1-9 0c0-1.6.8-2.9 1.7-3.9.2 1 .9 1.7 1.8 1.7 1.2 0 2-1.2 1.3-2.6C11.5 5.7 12 4.2 12 3z"/>',
    chart: '<path d="M4 20V11"/><path d="M10 20V4"/><path d="M16 20v-6"/><path d="M3 20h18"/>',
    book: '<path d="M12 6c-2-2-5-2-7 0v13c2-2 5-2 7 0 2-2 5-2 7 0V6c-2-2-5-2-7 0z"/>',
    file: '<path d="M6 2h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v5h5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6L16 9"/>',
    trash: '<path d="M4 6h16"/><path d="M9 6V4h6v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    tag: '<path d="M3 4h8l10 10-7 7L4 11V4z"/><circle cx="8" cy="8" r="1.6"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    test: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
  };

  function svgIcon(name, cls) {
    return '<span class="ico' + (cls ? " " + cls : "") + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg></span>";
  }

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function app() { return window.VocabApp; }
  function store() {
    return window.SecureStore || {
      load: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
      save: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function toast(msg, kind, icon) {
    if (app() && app().toast) { try { app().toast(msg, kind || "ok", icon || "award"); return; } catch (e) {} }
    try { alert(msg); } catch (e) {}
  }

  var abbr = { A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2" };
  var LEVEL_NAMES = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper-Intermediate", C1: "Advanced", C2: "Expert" };

  /* ---------- state ---------- */
  var K_SETTINGS = "vocab_settings_v1";
  var K_PROGRESS = "vocab_progress_v1";
  var K_GAME = "vocab_game_v1";
  var K_STREAK = "vocab_streak_v1";
  var K_EXAM = "vocab_exam_results_v1";
  var K_POST = "vocab_posttest_v1";
  var currentTab = "level";
  var overlay = null;

  function getItems() {
    try { return window.VocabItems && window.VocabItems.getAll ? window.VocabItems.getAll() : []; } catch (e) { return []; }
  }
  function getFiltered() {
    try { return window.VocabItems && window.VocabItems.getFiltered ? window.VocabItems.getFiltered() : []; } catch (e) { return []; }
  }
  function getProgress() {
    try {
      const g = app().getProgress ? app().getProgress() : {};
      return g || {};
    } catch (e) { return {}; }
  }
  function setProgress(p) {
    try { store().save(K_PROGRESS, p); } catch (e) {}
    try { if (app().commit) app().commit(); } catch (e) {}
  }

  function open() {
    if (overlay && overlay.parentNode) { switchTab(currentTab); return; }
    overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.id = "adminModal";
    overlay.innerHTML = adminShell();
    document.body.appendChild(overlay);
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const IC = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[n.dataset.icon] || "") + "</svg>";
    });
    overlay.querySelector("#adminClose").onclick = close;
    overlay.querySelector("#adminCloseBtn").onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    overlay.querySelectorAll(".admin-tab").forEach(function (btn) {
      btn.onclick = function () { switchTab(btn.dataset.tab); };
    });
    switchTab(currentTab);
    requestAnimationFrame(function () { overlay.classList.add("open"); });
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("open");
    var el = overlay;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    overlay = null;
  }

  function adminShell() {
    return (
      '<div class="auth-modal admin-modal" role="dialog" aria-modal="true">' +
        '<div class="auth-hero admin-hero">' +
          '<div class="auth-hero-icon"><span class="ico" data-icon="shield"></span></div>' +
          '<h2>' + esc(txt("admin.title", "Admin Control Center")) + "</h2>" +
          "<p>" + esc(txt("admin.sub", "ผู้ดูแลระบบ: mango9726 — สายเทสต์เต็มพิกัด")) + "</p>" +
          '<button class="auth-hero-close" id="adminClose" aria-label="Close"><span class="ico" data-icon="close"></span></button>' +
        "</div>" +
        '<div class="admin-tabs">' +
          tab("level", "award", txt("admin.tabLevel", "ระดับ", "Level")) +
          tab("player", "bolt", txt("admin.tabPlayer", "ผู้เล่น", "Player")) +
          tab("words", "book", txt("admin.tabWords", "คำศัพท์", "Words")) +
          tab("exam", "test", txt("admin.tabExam", "สอบ", "Exam")) +
          tab("data", "file", txt("admin.tabData", "ข้อมูล", "Data")) +
        "</div>" +
        '<div class="auth-body admin-body" id="adminTabBody" style="padding:20px;"></div>' +
        '<div style="padding:0 20px 18px;"><button class="btn admin-close" id="adminCloseBtn" style="width:100%;">' + svgIcon("close") + " " + esc(txt("admin.close", "ปิดหน้าต่าง", "Close")) + "</button></div>" +
      "</div>"
    );
  }

  function tab(key, icon, label) {
    return '<button class="admin-tab' + (key === currentTab ? " active" : "") + '" data-tab="' + key + '" role="tab">' + svgIcon(icon) + "<span>" + label + "</span></button>";
  }

  function txt(en, th, enFallback) {
    try {
      const s = store().load(K_SETTINGS, {}) || {};
      return s.lang === "th" ? (th != null ? th : en) : (enFallback || en);
    } catch (e) { return en; }
  }

  function switchTab(tab) {
    currentTab = tab;
    overlay.querySelectorAll(".admin-tab").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === tab); });
    const body = $("adminTabBody");
    if (!body) return;
    body.className = "auth-body admin-body" + (["words", "exam"].indexOf(tab) >= 0 ? " admin-scroll" : "");
    if (tab === "level") body.innerHTML = tabLevel();
    else if (tab === "player") body.innerHTML = tabPlayer();
    else if (tab === "words") body.innerHTML = tabWords();
    else if (tab === "exam") body.innerHTML = tabExam();
    else body.innerHTML = tabData();
    wireTab(tab);
  }

  function rescan() {
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const IC = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[n.dataset.icon] || "") + "</svg>";
    });
  }

  /* ---------- Level tab ---------- */
  function tabLevel() {
    const lvl = (app().currentCefrLevel ? app().currentCefrLevel() : "A1") || "A1";
    const name = LEVEL_NAMES[lvl] || lvl;
    const chips = Object.keys(abbr).map(function (l) {
      return '<button class="admin-chip' + (l === lvl ? " active" : "") + '" data-lvl="' + l + '">' + l + '<span class="admin-chip-name">' + LEVEL_NAMES[l] + "</span></button>";
    }).join("");
    return (
      '<div class="admin-sec">' +
        '<div class="admin-sec-title">' + svgIcon("award") + " " + esc(txt("admin.levelTitle", "เปลี่ยนระดับตัวเอง (CEFR)", "Change your CEFR level")) + "</div>" +
        '<div class="admin-chip-grid" id="adminLvlChips">' + chips + "</div>" +
        '<p class="admin-hint">' + esc(txt("admin.levelHint", "ระดับปัจจุบัน: " + lvl + " – " + name + "  · กดเพื่อสลับ ระบบจะโหลดคำศัพท์ทั้งระดับใหม่ทันที", "Current: " + lvl + " (" + name + "). Click a level to switch immediately — the word pool reloads.")) + "</p>" +
        '<div class="admin-actions">' +
          '<button class="btn btn-primary" id="adminLvlApply" style="width:100%;">' + svgIcon("check") + " " + esc(txt("admin.lvlApply", "ใช้ระดับนี้ทันที", "Apply this level")) + "</button>" +
          (lvl && lvl !== "A1" ? '<button class="btn" id="adminLvlClear" style="width:100%;">' + svgIcon("refresh") + " " + esc(txt("admin.lvlClear", "กลับไปใช้ระดับจากแบบวัด (Placement)", "Revert to placement-test level")) + "</button>" : "") +
        "</div>" +
      "</div>"
    );
  }
  function wireTabLevel() {
    let sel = null;
    const box = $("adminLvlChips");
    if (!box) return;
    box.querySelectorAll(".admin-chip").forEach(function (b) {
      b.onclick = function () {
        sel = b.dataset.lvl;
        box.querySelectorAll(".admin-chip").forEach(function (x) { x.classList.toggle("active", x === b); });
      };
    });
    const apply = $("adminLvlApply");
    if (apply) apply.onclick = function () {
      const lvl = sel || (box.querySelector(".admin-chip.active") || {}).dataset.lvl;
      if (!lvl) return;
      try {
        if (window.CefrSelector && window.CefrSelector.setSelectedCefrLevelExposed) window.CefrSelector.setSelectedCefrLevelExposed(lvl);
        else if (window.CefrSelector && window.CefrSelector.setSelectedCefrLevel) window.CefrSelector.setSelectedCefrLevel(lvl);
        if (app().onCefrLevelChange) {
          const s = store().load(K_SETTINGS, {}) || {};
          s.selectedCefrLevel = lvl;
          store().save(K_SETTINGS, s);
          app().onCefrLevelChange(lvl);
        }
        if (app().refreshViews) app().refreshViews();
      } catch (e) { console.warn("[admin] set level:", e); }
      toast(txt("admin.levelOk", "เปลี่ยนระดับเป็น " + lvl + " เรียบร้อย!", "Level set to " + lvl + "!"), "ok", "award");
      close();
    };
    const clr = $("adminLvlClear");
    if (clr) clr.onclick = function () {
      try {
        const s = store().load(K_SETTINGS, {}) || {};
        s.selectedCefrLevel = null;
        store().save(K_SETTINGS, s);
        if (window.CefrSelector && window.CefrSelector.clearSelectedCefrLevel) window.CefrSelector.clearSelectedCefrLevel();
        if (app().refreshViews) app().refreshViews();
      } catch (e) {}
      toast(txt("admin.levelRevert", "กลับไปใช้ระดับจากแบบวัดแล้ว", "Reverted to placement-test level"), "ok", "refresh");
      close();
    };
  }

  /* ---------- Player tab ---------- */
  function tabPlayer() {
    const g = (app().getGame && app().getGame()) || {};
    return (
      '<div class="admin-sec">' +
        '<div class="admin-sec-title">' + svgIcon("bolt") + " " + esc(txt("admin.playerTitle", "ปรับค่า XP / Streak", "Edit XP / streak")) + "</div>" +
        '<div class="admin-grid">' +
          '<label class="admin-field"><span>' + esc(txt("admin.xpLabel", "XP", "XP")) + '</span><input type="number" id="adminXp" value="' + (g.xp || 0) + '" min="0" step="100"></label>' +
          '<label class="admin-field"><span>' + esc(txt("admin.streakLabel", "Streak (วัน)", "Streak (days)")) + '</span><input type="number" id="adminStreak" value="' + (currentStreak() || 0) + '" min="0" step="1"></label>' +
        "</div>" +
        '<div class="admin-actions">' +
          '<button class="btn btn-primary" id="adminXpAdd" style="flex:1;">' + svgIcon("bolt") + " +" + esc(txt("admin.addXp", "เพิ่ม 1,000 XP", "+1,000 XP")) + "</button>" +
          '<button class="btn" id="adminXpApply" style="flex:1;">' + svgIcon("check") + " " + esc(txt("admin.applyXp", "ใช้ค่า XP", "Set XP")) + "</button>" +
          '<button class="btn" id="adminStreakMax" style="flex:1;">' + svgIcon("flame") + " " + esc(txt("admin.streakMax", "Streak 365", "Streak 365")) + "</button>" +
        "</div>" +
        '<p class="admin-hint">' + esc(txt("admin.playerHint", "แก้ XP ระดับ/ฉายาก็จะเปลี่ยนตาม; ตั้ง streak 365 เพื่อทดสอบ badge ไฟ", "Change XP (level/title follow); set streak to 365 to test the flame badge.")) + "</p>" +
      "</div>"
    );
  }
  function currentStreak() {
    try { return (store().load(K_STREAK, { streak: 0 }) || {}).streak || 0; } catch (e) { return 0; }
  }
  function wireTabPlayer() {
    const add = $("adminXpAdd");
    if (add) add.onclick = function () { try { app().awardXp(1000); } catch (e) {} toast(txt("admin.okXp", "เพิ่ม 1,000 XP เรียบร้อย!", "+1,000 XP added!"), "ok", "bolt"); rescan(); };
    const apply = $("adminXpApply");
    if (apply) apply.onclick = function () {
      const v = Number(($("adminXp") || {}).value);
      if (isNaN(v)) return;
      try { app().setXp(v); } catch (e) {}
      toast(txt("admin.okXpSet", "ตั้งค่า XP = " + v + " เรียบร้อย!", "XP set to " + v + "!"), "ok", "bolt");
    };
    const mx = $("adminStreakMax");
    if (mx) mx.onclick = function () {
      try {
        const s = store().load(K_STREAK, { streak: 0, last: "" }) || {};
        s.streak = 365;
        store().save(K_STREAK, s);
      } catch (e) {}
      toast(txt("admin.okStreak", "ตั้ง Streak = 365 วัน เรียบร้อย!", "Streak set to 365!"), "ok", "flame");
      rescan();
    };
  }

  /* ---------- Words / progress tab ---------- */
  function tabWords() {
    const all = getItems();
    const filt = getFiltered();
    const prog = getProgress();
    const seen = all.filter(function (i) { return (prog[i.id] || {}).seen > 0; }).length;
    const mastered = all.filter(function (i) { var p = prog[i.id] || {}; return (p.st || 0) >= 21 || (p.reps || 0) >= 4; }).length;
    return (
      '<div class="admin-sec">' +
        '<div class="admin-sec-title">' + svgIcon("book") + " " + esc(txt("admin.wordsTitle", "จัดการความคืบหน้าคำศัพท์", "Manage word progress")) + "</div>" +
        '<div class="admin-stats"><span>' + esc(txt("admin.total", "ทั้งหมด", "All")) + ': <b>' + all.length + "</b></span>" +
        "<span>" + esc(txt("admin.filtered", "ระดับนี้", "In level")) + ': <b>' + filt.length + "</b></span>" +
        "<span>" + esc(txt("admin.seen", "เริ่มเรียนแล้ว", "Seen")) + ': <b>' + seen + "</b></span>" +
        "<span>" + esc(txt("admin.mastered", "Mastered", "Mastered")) + ': <b>' + mastered + "</b></span></div>" +
        '<div class="admin-actions">' +
          '<button class="btn btn-primary" id="adminMasterAll" style="width:100%;">' + svgIcon("layers") + " " + esc(txt("admin.masterAll", "จำคำศัพท์ทั้งหมดระดับนี้ 100% (Master All)", "Master every word in this level")) + "</button>" +
          '<button class="btn" id="adminSeedSeen" style="width:100%;">' + svgIcon("check") + " " + esc(txt("admin.seedSeen", "เซ็ตคำในระดับนี้ให้ 'เริ่มเรียนแล้ว' (due วันนี้)", "Mark all level words as seen (due today)")) + "</button>" +
          '<button class="btn" id="adminRestartLevel" style="width:100%;">' + svgIcon("refresh") + " " + esc(txt("admin.restartLevel", "รีเซ็ตความคืบหน้าของระดับนี้ (เริ่มใหม่)", "Reset this level's progress (fresh)")) + "</button>" +
        "</div>" +
        '<p class="admin-hint">' + esc(txt("admin.wordsHint", "อัปเดตเฉพาะระดับที่กำลังใช้อยู่ — เหมาะสำหรับทดสอบ due forecast / การ์ดรีมายเดอร์", "Applies to the current level — handy for testing due forecast / reminder cards.")) + "</p>" +
      "</div>"
    );
  }
  function wireTabWords() {
    const all = getFiltered();
    const ma = $("adminMasterAll");
    if (ma) ma.onclick = function () {
      const prog = getProgress();
      all.forEach(function (i) {
        const p = prog[i.id] = prog[i.id] || {};
        p.st = 999; p.d = 999; p.reps = 99; p.lapses = 0; p.seen = 1; p.lastReview = todayISO();
        p.due = todayISO();
      });
      setProgress(prog);
      if (app().refreshViews) app().refreshViews();
      toast(txt("admin.okMaster", "Master ทั้งหมดแล้ว (" + all.length + " คำ)", "All mastered (" + all.length + " words)"), "ok", "layers");
      rescan();
    };
    const sd = $("adminSeedSeen");
    if (sd) sd.onclick = function () {
      const prog = getProgress();
      all.forEach(function (i) {
        const p = prog[i.id] = prog[i.id] || {};
        if (!p.seen) { p.seen = 1; p.st = 2; p.d = 1; p.reps = 1; }
        p.due = p.due || todayISO();
      });
      setProgress(prog);
      if (app().refreshViews) app().refreshViews();
      toast(txt("admin.okSeed", "เซ็ต 'seen' ให้ " + all.length + " คำแล้ว", "Marked " + all.length + " words as seen"), "ok", "check");
      rescan();
    };
    const rs = $("adminRestartLevel");
    if (rs) rs.onclick = function () {
      if (confirm(txt("admin.confirmRestart", "รีเซ็ตความคืบหน้าของระดับนี้ (" + all.length + " คำ)?", "Reset this level (" + all.length + " words)?"))) {
        const prog = getProgress();
        all.forEach(function (i) { delete prog[i.id]; });
        setProgress(prog);
        if (app().refreshViews) app().refreshViews();
        toast(txt("admin.okRestart", "รีเซ็ตความคืบหน้าระดับนี้แล้ว", "Level progress reset"), "ok", "refresh");
        rescan();
        switchTab("words");
      }
    };
  }

  /* ---------- Exam tab ---------- */
  function tabExam() {
    const ex = store().load(K_EXAM, []) || [];
    const po = store().load(K_POST, []) || [];
    return (
      '<div class="admin-sec">' +
        '<div class="admin-sec-title">' + svgIcon("test") + " " + esc(txt("admin.examTitle", "ข้อมูลการสอบ (ทดสอบหน้า Exam)", "Exam data (for the Exam view)")) + "</div>" +
        '<div class="admin-stats"><span>' + esc(txt("admin.examCount", "ผลสอบ (Timed Exam)", "Timed exam results")) + ': <b>' + ex.length + "</b></span>" +
        "<span>" + esc(txt("admin.postCount", "Post-Test", "Post-Test")) + ': <b>' + po.length + "</b></span></div>" +
        '<div class="admin-actions">' +
          '<button class="btn btn-primary" id="adminSeedExam" style="width:100%;">' + svgIcon("test") + " " + esc(txt("admin.seedExam", "เพิ่มผลสอบตัวอย่าง 3 รายการ", "Seed 3 sample exam results")) + "</button>" +
          '<button class="btn btn-primary" id="adminSeedPost" style="width:100%;">' + svgIcon("play") + " " + esc(txt("admin.seedPost", "เพิ่มผล Post-Test ตัวอย่าง", "Seed a sample post-test")) + "</button>" +
          '<button class="btn btn-bad" id="adminClearExam" style="width:100%;">' + svgIcon("trash") + " " + esc(txt("admin.clearExam", "ล้างข้อมูลสอบทั้งหมด", "Clear all exam data")) + "</button>" +
        "</div>" +
        '<p class="admin-hint">' + esc(txt("admin.examHint", "เติมผลให้หน้า Stats (คะแนนสอบ/grade) แสดงค่าจริงก่อนไปรายงาน", "Populate Stats scores before capturing screenshots for the report.")) + "</p>" +
      "</div>"
    );
  }
  function wireTabExam() {
    const se = $("adminSeedExam");
    if (se) se.onclick = function () {
      const lvl = (app().currentCefrLevel ? app().currentCefrLevel() : "B1") || "B1";
      const now = Date.now();
      const list = [
        { date: todayISO(), ts: now, level: lvl, minutes: 10, correct: 16, total: 20, score10: 8, pct: 80, elapsed: 400, timedOut: false },
        { date: todayISO(), ts: now - 86400000, level: lvl, minutes: 10, correct: 13, total: 20, score10: 7, pct: 65, elapsed: 470, timedOut: false },
        { date: todayISO(), ts: now - 172800000, level: lvl, minutes: 5, correct: 9, total: 20, score10: 5, pct: 45, elapsed: 300, timedOut: true }
      ];
      try { store().save(K_EXAM, list); } catch (e) {}
      if (app().refreshViews) app().refreshViews();
      toast(txt("admin.okExam", "เพิ่มผลสอบ 3 รายการแล้ว", "3 exam results added"), "ok", "test");
      rescan();
    };
    const sp = $("adminSeedPost");
    if (sp) sp.onclick = function () {
      const lvl = (app().currentCefrLevel ? app().currentCefrLevel() : "B1") || "B1";
      const list = [{ date: todayISO(), ts: Date.now(), level: lvl, ability: 0.18, se: 0.44, progressToNext: 0.5, totalCorrect: 21, totalQuestions: 27, timeSec: 284 }];
      try { store().save(K_POST, list); } catch (e) {}
      if (app().refreshViews) app().refreshViews();
      toast(txt("admin.okPost", "เพิ่ม Post-Test ตัวอย่างแล้ว", "Sample post-test added"), "ok", "play");
      rescan();
    };
    const cl = $("adminClearExam");
    if (cl) cl.onclick = function () {
      try { store().save(K_EXAM, []); store().save(K_POST, []); } catch (e) {}
      if (app().refreshViews) app().refreshViews();
      toast(txt("admin.okClearExam", "ล้างข้อมูลสอบทั้งหมดแล้ว", "Cleared all exam data"), "ok", "trash");
      rescan();
    };
  }

  /* ---------- Data tab ---------- */
  function tabData() {
    return (
      '<div class="admin-sec">' +
        '<div class="admin-sec-title">' + svgIcon("file") + " " + esc(txt("admin.dataTitle", "ไฟล์ข้อมูล / ตัวทดสอบ", "Data & test mode")) + "</div>" +
        '<div class="admin-actions">' +
          '<button class="btn btn-bad" id="adminResetProgress" style="width:100%;">' + svgIcon("chart") + " " + esc(txt("admin.resetProgress", "ล้างความคืบหน้าเรียน (ไม่ลบการตั้งค่า)", "Clear learning progress (keep settings)")) + "</button>" +
          '<button class="btn btn-bad" id="adminHardReset" style="width:100%;">' + svgIcon("trash") + " " + esc(txt("admin.hardReset", "ล้างข้อมูลทั้งหมดแบบถาวร (Hard Reset)", "Hard reset — wipe everything")) + "</button>" +
        "</div>" +
        '<p class="admin-hint">' + esc(txt("admin.dataHint", "ใช้ทดสอบไม่ได้ จะกดล้างข้อมูลก็ได้ — ระวัง hard reset ลบทุกอย่าง", "Use for testing. Hard reset wipes all local data.")) + "</p>" +
      "</div>"
    );
  }
  function wireTabData() {
    const rp = $("adminResetProgress");
    if (rp) rp.onclick = function () {
      if (confirm(txt("admin.confirmProgress", "ล้างความคืบหน้าเรียนทั้งหมดจริงหรือ? (ระดับ/การตั้งค่าคงเดิม)", "Clear all learning progress? (level/settings kept)"))) {
        try { app().resetProgressData(); } catch (e) {}
        toast(txt("admin.okProgress", "ล้างความคืบหน้าเรียนแล้ว", "Learning progress cleared"), "ok", "chart");
        location.reload();
      }
    };
    const hr = $("adminHardReset");
    if (hr) hr.onclick = function () {
      if (confirm(txt("admin.confirmHard", "ล้างข้อมูลทั้งหมดแบบถาวร? นี้ลบทุกอย่าง ไม่สามารถกู้คืนได้!", "Hard reset — this deletes ALL data permanently. Continue?"))) {
        try { app().resetAllData(); } catch (e) {}
      }
    };
  }

  function wireTab(tab) {
    if (tab === "level") wireTabLevel();
    else if (tab === "player") wireTabPlayer();
    else if (tab === "words") wireTabWords();
    else if (tab === "exam") wireTabExam();
    else wireTabData();
  }

  window.AdminPanel = { show: open, close: close };
  if (window.VocabAuth && typeof window.VocabAuth.setAdminPanel === "function") {
    try { window.VocabAuth.setAdminPanel(open); } catch (e) {}
  }
})();