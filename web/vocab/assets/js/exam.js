/* ============================================================
   Vocab Trainer — exam.js
   Assessment Center: graded timed exam (20 words, score /10) +
   before/after (pre-test vs post-test) comparison summary shown
   in the Statistics view.
   Loads AFTER app.js / placement.js. Exposes window.VocabExam.
   ============================================================ */
(function () {
  "use strict";

  const EXAM_LEN = 20;
  const K_RESULTS = "vocab_exam_results_v1";
  const K_POST = "vocab_posttest_v1";

  const ICONS = {
    award: '<circle cx="12" cy="8" r="7"/><path d="M8.2 12.4l2.6 2.6L16 9"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    test: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 7-7"/>',
    chart: '<path d="M3 17l6-6 4 4 7-7"/><path d="M17 7h4v4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 4"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 20"/><path d="M20 20v-4h-4"/>',
    brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0v-15A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 5 0v-15A2.5 2.5 0 0 0 14.5 2z"/>',
    arrowLeft: '<path d="M9 18l-6-6 6-6"/><path d="M3 12h18"/>'
  };

  function svgIcon(name, cls) {
    let extra = "";
    if (typeof cls === "number") { extra = " style=\"width:" + cls + "px;height:" + cls + "px\""; cls = ""; }
    return '<span class="ico' + (cls ? " " + cls : "") + '"><svg viewBox="0 0 24 24" aria-hidden="true"' + extra + '>' + (ICONS[name] || "") + "</svg></span>";
  }

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function t(key, fb) {
    try {
      if (window.VocabApp && typeof window.VocabApp.t === "function") { const v = window.VocabApp.t(key); return v != null ? v : fb; }
    } catch (e) {}
    return fb != null ? fb : key;
  }

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

  function fmt(secs) {
    secs = Math.max(0, secs | 0);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ---------- CEFR level helpers ---------- */
  function order() { return window.CEFR_ORDER || ["A1", "A2", "B1", "B2", "C1", "C2"]; }
  function levelInfo(code) { return (window.CEFR_LEVELS && window.CEFR_LEVELS[code]) || { name: code, th: code, color: "#6366f1" }; }

  function effectiveLevel() {
    try {
      if (window.CefrSelector && window.CefrSelector.getEffectiveCefrLevel) {
        const lv = window.CefrSelector.getEffectiveCefrLevel();
        if (lv && window.CEFR_LEVELS && window.CEFR_LEVELS[lv]) return lv;
      }
    } catch (e) {}
    try {
      if (window.getCefrLevel) {
        const l = window.getCefrLevel();
        if (l && window.CEFR_LEVELS && window.CEFR_LEVELS[l]) return l;
      }
    } catch (e) {}
    return "A1";
  }

  function dayRangeFor(level) {
    const ord = order();
    const startMap = window.CEFR_START_DAY || { A1: 1, A2: 61, B1: 121, B2: 211, C1: 301, C2: 391 };
    const i = ord.indexOf(level);
    const start = startMap[level] || 1;
    const end = (i + 1 < ord.length && startMap[ord[i + 1]]) ? startMap[ord[i + 1]] - 1 : 480;
    return [start, end];
  }

  function poolForLevel(level) {
    let out = [];
    try {
      if (window.CefrSelector && window.CefrSelector.getItemsForLevel) {
        out = (window.CefrSelector.getItemsForLevel(level) || []).slice();
      }
    } catch (e) {}
    if (!out.length) {
      const VOCAB_DAYS = window.VOCAB_DAYS || {};
      const range = dayRangeFor(level);
      for (let d = range[0]; d <= range[1]; d++) {
        const day = VOCAB_DAYS[String(d)];
        if (!day || !day.vocabulary) continue;
        day.vocabulary.forEach(function (it) { out.push(it); });
      }
    }
    return out;
  }

  function cleanPool(pool) {
    const seen = {};
    const out = [];
    pool.forEach(function (it) {
      if (!it || !it.word || !it.th) return;
      const key = ((it.id || it.word) + "|" + it.th).toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push(it);
    });
    return out;
  }

  function pickDistractors(keep, pool, n) {
    const used = {};
    const out = [];
    used[keep.th] = 1;
    pool.forEach(function (x) {
      if (out.length >= n) return;
      if (x === keep || used[x.th]) return;
      used[x.th] = 1;
      out.push(x);
    });
    const fallback = ["อาหาร", "บ้าน", "เร็ว", "ใหญ่", "หนังสือ", "โรงเรียน", "สีแดง", "มีความสุข", "เช้า", "กลางคืน"];
    for (let i = 0; i < fallback.length && out.length < n; i++) {
      if (used[fallback[i]]) continue;
      used[fallback[i]] = 1;
      out.push({ th: fallback[i], word: "?" });
    }
    return out;
  }

  function buildExam(level) {
    const pool = cleanPool(poolForLevel(level));
    if (pool.length < 8) return null;
    const picked = shuffle(pool).slice(0, EXAM_LEN);
    return picked.map(function (it) {
      const distrs = pickDistractors(it, pool, 3);
      const opts = shuffle(distrs.concat([it])).map(function (x) { return x.th; });
      return { it: it, opts: opts, answer: opts.indexOf(it.th), answered: false };
    });
  }

  /* ---------- Graded exam state ---------- */
  let S = null; // { screen:"question"|"result", exam:{level,minutes,secs,startTs,qs,idx,results,timerId,kh}, last }
  let menuSel = { level: null, minutes: 10 };

  function playTone(correct) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = correct ? "triangle" : "sawtooth";
      o.frequency.setValueAtTime(correct ? 587 : 196, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(correct ? 880 : 147, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }

  function toast(msg, type) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast" + (type === "err" ? " toast-err" : "");
    el.setAttribute("role", "status");
    el.innerHTML = '<span class="toast-ico">' + svgIcon(type === "err" ? "clock" : "check", 16) + '</span><span class="toast-msg">' + esc(msg) + "</span>";
    wrap.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("in"); });
    setTimeout(function () { el.classList.add("leaving"); setTimeout(function () { el.remove(); }, 300); }, 2000);
  }

  function startExam(level, minutes) {
    const qs = buildExam(level);
    if (!qs) {
      toast(t("exam.notEnough", "คำศัพท์ในระดับนี้ไม่พอสำหรับการสอบ (ต้องการ 8+ คำ)"), "err");
      return;
    }
    const ex = {
      level: level,
      minutes: minutes || 10,
      secs: (minutes || 10) * 60,
      startTs: Date.now(),
      qs: qs,
      idx: 0,
      results: [],
      timerId: null,
      kh: null
    };
    S = { screen: "question", exam: ex, last: null };
    renderQuestion();
    startTimer();
  }

  function startTimer() {
    const ex = S && S.exam;
    if (!ex) return;
    stopTimer();
    ex.timerId = setInterval(function () {
      ex.secs--;
      if (ex.timerEl) ex.timerEl.textContent = fmt(ex.secs);
      if (ex.secs <= 0) finishExam();
    }, 1000);
  }

  function stopTimer() {
    const ex = S && S.exam;
    if (ex && ex.timerId) { clearInterval(ex.timerId); ex.timerId = null; }
  }

  function removeKeys() {
    const ex = S && S.exam;
    if (ex && ex.kh) { document.removeEventListener("keydown", ex.kh); ex.kh = null; }
  }

  /* ---------- Screens ---------- */
  function render() {
    const mount = $("posttestMount");
    if (mount && mount.style.display !== "none") {
      // A post-test/old result is showing — abandon and show the menu.
      try { if (window.VocabPlacement && window.VocabPlacement.teardown) window.VocabPlacement.teardown(); } catch (e) {}
      mount.style.display = "none";
      mount.innerHTML = "";
    }
    const panel = $("examPanel");
    if (!panel) return;
    if (S && S.screen === "question") { renderQuestion(); return; }
    if (S && S.screen === "result") { renderResult(); return; }
    renderMenu();
  }

  function renderMenu() {
    const panel = $("examPanel");
    if (!panel) return;
    const ord = order();
    const cur = menuSel.level || effectiveLevel();
    const mins = menuSel.minutes || 10;
    const post = (store().load(K_POST, []) || [])[0];

    const levelsHtml = ord.map(function (l) {
      return '<button class="chip' + (l === cur ? " active" : "") + '" data-code="' + l + '">' + l + "</button>";
    }).join("");
    const minsHtml = [5, 10, 15].map(function (m) {
      return '<button class="chip' + (m === mins ? " active" : "") + '" data-min="' + m + '">' + m + " นาที</button>";
    }).join("");

    panel.innerHTML = `
      <div class="exam-menu" role="region" aria-label="Test Center">
        <div class="placement-badge">${svgIcon("award")} ${esc(t("exam.heading", "Assessment Center"))}</div>
        <h3 class="exam-menu-title">${esc(t("exam.graded", "Graded Timed Exam"))}</h3>
        <p class="exam-menu-sub">${esc(t("exam.gradedHint", "20 words from your CEFR level, answered under a time limit — score out of 10."))}</p>
        <div class="exam-field">
          <span class="field-label">${esc(t("exam.level", "Level"))}</span>
          <div class="chip-group" id="examLevels">${levelsHtml}</div>
        </div>
        <div class="exam-field">
          <span class="field-label">${esc(t("exam.time", "Time limit"))}</span>
          <div class="chip-group" id="examMins">${minsHtml}</div>
        </div>
        <button class="btn btn-accent btn-lg" id="examStart">${svgIcon("play")} ${esc(t("exam.startBtn", "Start Exam"))}</button>

        <hr class="exam-divider">

        <div class="placement-badge ghost">${svgIcon("test")} ${esc(t("exam.post", "Post-Test"))}</div>
        <h3 class="exam-menu-title">${esc(t("exam.postTitle", "แบบทดสอบหลังเรียน"))}</h3>
        <p class="exam-menu-sub">${esc(t("exam.postHint", "ชุดข้อเดียวกับแบบวัดระดับตอนเริ่มต้น เพื่อเปรียบเทียบระดับก่อน-หลังเรียน"))}</p>
        <div id="postTestRecent" class="exam-recent">
          ${post ? '<span>' + esc(t("exam.lastPost", "Post-Test ล่าสุด:")) + ' <b>' + esc(post.level || "") + "</b> · " + esc((post.totalCorrect || 0) + "/" + (post.totalQuestions || "?")) + "</span>" : ""}
        </div>
        <button class="btn btn-primary btn-lg" id="postStart">${svgIcon("play")} ${esc(t("exam.startPost", "เริ่มแบบทดสอบหลังเรียน"))}</button>
      </div>`;

    const lvlBox = $("examLevels");
    if (lvlBox) lvlBox.querySelectorAll(".chip").forEach(function (b) {
      b.onclick = function () {
        menuSel.level = b.dataset.code;
        lvlBox.querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("active", x === b); });
      };
    });
    const minBox = $("examMins");
    if (minBox) minBox.querySelectorAll(".chip").forEach(function (b) {
      b.onclick = function () {
        menuSel.minutes = Number(b.dataset.min) || 10;
        minBox.querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("active", x === b); });
      };
    });
    const start = $("examStart");
    if (start) start.onclick = function () { startExam(menuSel.level || cur, menuSel.minutes); };
    const postStart = $("postStart");
    if (postStart) postStart.onclick = goPostTest;
  }

  function renderQuestion() {
    const panel = $("examPanel");
    if (!panel) return;
    const ex = S.exam;
    const q = ex.qs[ex.idx];
    if (!q) { finishExam(); return; }
    const num = ex.idx + 1;
    const total = ex.qs.length;
    const pct = Math.round((ex.idx / total) * 100);

    const optsHtml = q.opts.map(function (opt, i) {
      return '<button class="placement-opt" data-i="' + i + '" tabindex="0" role="radio" aria-label="ตัวเลือก ' + (i + 1) + ": " + esc(opt) + '">' +
        '<span class="opt-label">' + ["A", "B", "C", "D"][i] + '</span><span class="opt-text">' + esc(opt) + "</span></button>";
    }).join("");

    panel.innerHTML = `
      <div class="exam-running" role="region" aria-label="Exam question ${num}">
        <div class="exam-top">
          <span class="exam-counter">${esc(t("exam.question", "คำถาม"))} ${num}/${total} · ${esc(ex.level)}</span>
          <span class="exam-timer" id="examTimer">${fmt(ex.secs)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" id="examProgress" style="width:${pct}%"></div></div>
        <div class="placement-content">
          <div class="placement-word">${esc(q.it.word)}${q.it.pos ? ' <span class="exam-pos">' + esc(q.it.pos) + "</span>" : ""}</div>
          <div class="placement-question">${esc(t("exam.meaningQ", "ความหมายของคำนี้คืออะไร?"))}</div>
          <div class="placement-opts" role="radiogroup" aria-label="ตัวเลือกคำตอบ">${optsHtml}</div>
        </div>
        <p class="exam-hint"><kbd>1</kbd>–<kbd>4</kbd> / <kbd>A</kbd>–<kbd>D</kbd> เลือกคำตอบ · เหลือ ${fmt(ex.secs)} นาที</p>
      </div>`;

    ex.timerEl = $("examTimer");
    const opts = panel.querySelectorAll(".placement-opt");
    opts.forEach(function (btn) {
      const handle = function () { submitAnswer(q, parseInt(btn.dataset.i, 10), opts); };
      btn.onclick = handle;
      btn.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handle(); } };
    });
    removeKeys();
    const kh = function (e) {
      const idx = "1234ABCD".indexOf(e.key.toUpperCase());
      if (idx >= 0 && opts[idx]) { e.preventDefault(); opts[idx].click(); }
    };
    document.addEventListener("keydown", kh);
    ex.kh = kh;
  }

  function submitAnswer(q, chosen, opts) {
    const ex = S && S.exam;
    if (!ex || q.answered) return;
    q.answered = true;
    const correct = chosen === q.answer;
    ex.results.push({ word: q.it.word, th: q.it.th, correct: correct });
    opts.forEach(function (b) {
      b.disabled = true;
      b.classList.remove("selected");
      if (parseInt(b.dataset.i, 10) === q.answer) b.classList.add("correct");
      if (parseInt(b.dataset.i, 10) === chosen && !correct) b.classList.add("wrong");
    });
    opts[chosen].classList.add("selected");
    playTone(correct);
    setTimeout(function () {
      if (!S || S.screen !== "question") return;
      if (ex.idx + 1 >= ex.qs.length) finishExam();
      else { ex.idx++; renderQuestion(); }
    }, 450);
  }

  function gradeOf(pct) {
    if (pct >= 90) return { cls: "grade-a", label: t("exam.gradeA", "Excellent") };
    if (pct >= 80) return { cls: "grade-b", label: t("exam.gradeB", "Very good") };
    if (pct >= 70) return { cls: "grade-c", label: t("exam.gradeC", "Pass") };
    if (pct >= 60) return { cls: "grade-d", label: t("exam.gradeD", "Fair") };
    return { cls: "grade-f", label: t("exam.gradeF", "Keep practising") };
  }

  function finishExam() {
    const ex = S && S.exam;
    if (!ex || ex.done) return;
    ex.done = true;
    stopTimer();
    removeKeys();
    const correct = ex.results.filter(function (r) { return r.correct; }).length;
    const total = ex.qs.length;
    const score10 = Math.round((correct / total) * 10);
    const pct = Math.round((correct / total) * 100);
    const elapsed = Math.min(Math.round((Date.now() - ex.startTs) / 1000), ex.minutes * 60);
    const rec = {
      date: todayISO(),
      ts: Date.now(),
      level: ex.level,
      minutes: ex.minutes,
      correct: correct,
      total: total,
      score10: score10,
      pct: pct,
      elapsed: elapsed,
      timedOut: ex.secs <= 0
    };
    try {
      const list = store().load(K_RESULTS, []) || [];
      list.unshift(rec);
      store().save(K_RESULTS, list.slice(0, 20));
    } catch (e) {}
    S.last = rec;
    S.screen = "result";
    renderResult();
  }

  function renderResult() {
    const panel = $("examPanel");
    if (!panel || !S.last) return;
    const rec = S.last;
    const grade = gradeOf(rec.pct);
    const list = store().load(K_RESULTS, []) || [];
    const hist = list.slice(0, 5).map(function (r) {
      return '<div class="exam-hist-row"><span>' + esc(r.date) + " · " + esc(r.level) + "</span><span>ถูก " + esc(r.correct + "/" + r.total) + "</span><b>" + esc(r.score10) + "/10</b></div>";
    }).join("");

    panel.innerHTML = `
      <div class="exam-result" role="region" aria-label="Exam result">
        <div class="placement-badge">${svgIcon("award")} ${esc(t("exam.resultTitle", "Exam result"))}</div>
        <div class="exam-score-row"><span class="exam-score-big">${rec.score10}</span><span class="exam-score-max">/10</span></div>
        <div class="exam-meta">${rec.pct}% · ${esc(t("exam.correctCount", "ถูก"))} ${esc(rec.correct + "/" + rec.total)} · ${esc(t("exam.levelLabel", "ระดับ"))} ${esc(rec.level)}</div>
        <div class="exam-grade ${grade.cls}">${esc(grade.label)}</div>
        <div class="exam-submeta">${esc(t("exam.elapsed", "ใช้เวลา"))} ${fmt(rec.elapsed)}${rec.timedOut ? " · " + esc(t("exam.timedOut", "หมดเวลา")) : ""}</div>
        <div class="btn-row">
          <button class="btn btn-accent" id="examAgain">${svgIcon("refresh")} ${esc(t("exam.again", "สอบอีกครั้ง"))}</button>
          <button class="btn btn-secondary" id="examMenuBtn">${svgIcon("arrowLeft")} ${esc(t("exam.menu", "เมนูทดสอบ"))}</button>
        </div>
      </div>
      ${hist ? '<div class="exam-history"><h4>' + esc(t("exam.history", "ประวัติการสอบ")) + "</h4>" + hist + "</div>" : ""}`;

    const again = $("examAgain");
    if (again) again.onclick = function () { startExam(S.last.level, S.last.minutes); };
    const menuBtn = $("examMenuBtn");
    if (menuBtn) menuBtn.onclick = function () { S = null; renderMenu(); };
  }

  /* ---------- Post-test entry (reuses placement.js engine) ---------- */
  function goPostTest() {
    if (!(window.hasTakenPlacementTest && window.hasTakenPlacementTest())) {
      toast(t("exam.needsPretest", "กรุณาทำแบบทดสอบวัดระดับก่อนเรียนเสียก่อน"), "err");
      if (window.VocabApp && window.VocabApp.showView) window.VocabApp.showView("home");
      return;
    }
    if (!window.VocabPlacement) return;
    const mount = $("posttestMount");
    const panel = $("examPanel");
    if (!mount) return;

    const examView = $("view-exam");
    const examActive = examView && examView.classList.contains("active");

    window.VocabPlacement.setMount("posttestMount", "posttest");
    mount.style.display = "none";
    mount.innerHTML = "";
    window.VocabPlacement.renderIntro();

    if (!examActive && window.VocabApp && window.VocabApp.showView) {
      window.VocabApp.showView("exam");
    }
    if (panel) panel.innerHTML = "";
    mount.style.display = "block";
    if (mount.firstElementChild && typeof mount.firstElementChild.classList.add === "function") {
      mount.firstElementChild.classList.add("in");
    }
  }

  /* Auto-submit any running exam when the user leaves the view. */
  function pause() {
    if (S && S.screen === "question") finishExam();
  }

  /* ---------- Summary used by the Statistics view ---------- */
  function renderSummary() {
    const box = $("assessmentsBox");
    if (!box) return;
    const results = store().load(K_RESULTS, []) || [];
    const posts = store().load(K_POST, []) || [];
    const latest = results[0];
    const post = posts[0];
    const progress = store().load("vocab_progress_v1", {}) || {};
    const hasCefr = !!window.getCefrLevel && !!window.getCefrLevel();

    let examHtml;
    if (latest) {
      const grade = gradeOf(latest.pct);
      examHtml =
        '<div class="assess-big">' + latest.score10 + '<span>/10</span></div>' +
        '<div class="assess-meta">' + latest.pct + "% · ถูก " + latest.correct + "/" + latest.total + " · " + latest.level + " · " + latest.date + "</div>" +
        '<div class="assess-grade ' + grade.cls + '">' + esc(grade.label) + "</div>";
    } else {
      examHtml = '<div class="assess-meta">' + esc(t("exam.noGraded", "ยังไม่มีการสอบเก็บคะแนน")) + "</div>";
    }

    let postHtml;
    if (!hasCefr) {
      postHtml = '<div class="assess-meta">' + esc(t("exam.needsPretest", "ทำแบบทดสอบวัดระดับก่อนเรียนก่อน")) + "</div>";
    } else if (post) {
      const preLv = progress.cefrLevel;
      const postLv = post.level;
      const lvDelta = preLv && window.CEFR_ORDER ? order().indexOf(postLv) - order().indexOf(preLv) : 0;
      const up = lvDelta > 0, down = lvDelta < 0;
      postHtml =
        '<div class="assess-big sm">ก่อน ' + esc(preLv || "—") + " → หลัง <b> " + esc(postLv || "—") + "</b></div>" +
        '<div class="assess-meta">' + esc(t("exam.postScore", "คะแนนแบบวัดระดับ")) + ": " + esc((post.totalCorrect || 0) + "/" + (post.totalQuestions || "?")) + " · " + esc(post.date) + "</div>" +
        '<div class="assess-delta ' + (up ? "delta-up" : down ? "delta-down" : "delta-same") + '">' +
        (up ? "▲ " + esc(t("exam.better", "ดีขึ้น")) : down ? "▼ " + esc(t("exam.worse", "ลดลง")) : "‑ " + esc(t("exam.same", "เท่าเดิม"))) +
        (up ? " (" + lvDelta + ")" : "") + "</div>";
    } else {
      postHtml = '<div class="assess-meta">' + esc(t("exam.noPost", "ยังไม่ทำแบบทดสอบหลังเรียน")) + "</div>";
    }

    box.innerHTML =
      '<div class="assess-grid">' +
      '<div class="assess-card"><div class="assess-head">' + svgIcon("award") + "<span>" + esc(t("exam.graded", "Graded Timed Exam")) + "</span></div>" +
      examHtml +
      (latest ? '<button class="btn btn-sm" id="assessGoGraded">' + esc(t("exam.again", "สอบอีกครั้ง")) + "</button>"
              : '<button class="btn btn-sm btn-accent" id="assessGoGraded">' + esc(t("exam.startBtn", "เริ่มสอบ")) + "</button>") +
      "</div>" +
      '<div class="assess-card"><div class="assess-head">' + svgIcon("test") + "<span>" + esc(t("exam.post", "Post-Test")) + "</span></div>" +
      postHtml +
      (post || !hasCefr
        ? '<button class="btn btn-sm" id="assessGoPost" disabled>' + esc(t("exam.startPost", "เริ่มแบบทดสอบหลังเรียน")) + "</button>"
        : '<button class="btn btn-sm btn-accent" id="assessGoPost">' + esc(t("exam.startPost", "เริ่มแบบทดสอบหลังเรียน")) + "</button>") +
      "</div>" +
      "</div>";

    const goGraded = $("assessGoGraded");
    if (goGraded && !goGraded.disabled) {
      goGraded.onclick = function () { if (window.VocabApp && window.VocabApp.showView) window.VocabApp.showView("exam"); };
    }
    const goPost = $("assessGoPost");
    if (goPost && !goPost.disabled) {
      goPost.onclick = goPostTest;
    }
  }

  /* ---------- Public API ---------- */
  window.VocabExam = {
    render: render,
    renderSummary: renderSummary,
    pause: pause,
    goPostTest: goPostTest,
    preview: function () { return { len: EXAM_LEN, results: (store().load(K_RESULTS, []) || []).length }; }
  };
})();