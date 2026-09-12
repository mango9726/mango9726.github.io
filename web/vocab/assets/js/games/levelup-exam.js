/* ============================================================
   Vocab Trainer — levelup-exam.js
   Level-Up Exam (แบบทดสอบเลื่อนระดับ): แสดงเมื่อเรียนครบทุกวัน
   ของระดับปัจจุบัน มีข้อสอบหลากรูปแบบ ถ้าผ่าน ≥ 80% จะเลื่อน
   ระดับไปยังถัดไปโดยอัตโนมัติ (reset แผนเรียนใหม่).
   Loads AFTER app.js / exam.js. Exposes window.LevelUpExam.
   ============================================================ */
(function () {
  "use strict";

  const PASS_PCT = 80;
  const Q_PER_TYPE = 5; // กี่ข้อต่อรูปแบบ
  const K_RESULTS = "vocab_levelup_results_v1";

  const ICONS = {
    award: '<circle cx="12" cy="12" r="8"/><path d="M8 13.5a4 4 0 0 0 4 2 4 4 0 0 0 4-2"/><path d="M12 9a3 3 0 1 1 0 6z"/><path d="M8 3a3 3 0 0 0-2 5.2A7 7 0 0 0 6 12h2M16 3a3 3 0 0 1 2 5.2A7 7 0 0 1 18 12h-2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6L16 9"/>',
    cross: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 20"/><path d="M20 20v-4h-4"/>',
    arrowLeft: '<path d="M9 18l-6-6 6-6"/><path d="M3 12h18"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15l.8 2.2L21.5 18l-2.2.8L18.5 21l-.8-2.2L15.5 18l2.2-.8z"/>',
    medal: '<circle cx="12" cy="14" r="5"/><path d="M9 3l3 6 3-6"/>'
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

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ---------- helpers ---------- */
  function currentLevel() {
    try {
      if (window.CefrSelector && window.CefrSelector.getEffectiveCefrLevel) {
        const lv = window.CefrSelector.getEffectiveCefrLevel();
        if (lv && window.CEFR_LEVELS && window.CEFR_LEVELS[lv]) return lv;
      }
    } catch (e) {}
    try { if (window.getCefrLevel) { const l = window.getCefrLevel(); if (l) return l; } } catch (e) {}
    return "A1";
  }

  function nextLevel() {
    try { if (window.VocabApp && typeof window.VocabApp.nextLevel === "function") return window.VocabApp.nextLevel(); } catch (e) {}
    return null;
  }

  function levelInfo(code) { return (window.CEFR_LEVELS && window.CEFR_LEVELS[code]) || { name: code, th: code, color: "#6366f1" }; }

  /* collect all items for the current level (vocab + collocation + idiom) */
  function collectItems() {
    let out = [];
    try {
      if (window.CefrSelector && window.CefrSelector.getItemsForLevel) {
        out = (window.CefrSelector.getItemsForLevel(currentLevel()) || []).slice();
      }
    } catch (e) {}
    if (!out.length && window.VOCAB_DAYS) {
      const range = window.CEFR_START_DAY;
      const nextStart = range[nextLevel()] || 361;
      const start = range[currentLevel()] || 1;
      for (let d = start; d < nextStart; d++) {
        const day = window.VOCAB_DAYS[String(d)];
        if (!day) continue;
        (day.vocabulary || []).forEach((it) => out.push(Object.assign({}, it, { type: "vocab", word: it.word, th: it.th })));
        (day.collocations || []).forEach((it) => out.push(Object.assign({}, it, { type: "collocation", word: it.phrase, pos: "collocation" })));
        if (day.idiom) out.push(Object.assign({}, day.idiom, { type: "idiom", word: day.idiom.phrase, th: day.idiom.meaning, pos: "idiom" }));
      }
    }
    return out;
  }

  function uniqueBy(arr, key) {
    const seen = {}, out = [];
    arr.forEach(function (x) { const k = x[key]; if (k != null && k !== "" && !seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
  }

  /* ---------- question builders (4 formats) ---------- */
  function makeOptions(correctVal, candidateObjs, valueFn) {
    const correct = String(correctVal);
    const seen = {};
    const opts = [{ text: correct, ans: true }];
    shuffle(candidateObjs || []).forEach(function (x) {
      if (opts.length >= 4) return;
      const v = valueFn(x);
      if (v == null) return;
      const s = String(v);
      if (s === correct || seen[s]) return;
      seen[s] = 1;
      opts.push({ text: s, ans: false });
    });
    while (opts.length < 4) opts.push({ text: "———", ans: false });
    const shuffled = shuffle(opts);
    return { opts: shuffled.map(function (o) { return o.text; }), answer: shuffled.findIndex(function (o) { return o.ans; }) };
  }

  // 1) word -> Thai meaning
  function qMeaning(items) {
    const vocab = items.filter((i) => i.type === "vocab" && i.word && i.th);
    return shuffle(vocab).slice(0, Q_PER_TYPE).map(function (it) {
      const p = makeOptions(it.th, vocab.filter((x) => x !== it), (x) => x.th);
      return { kind: "meaning", it: it, opts: p.opts, answer: p.answer };
    });
  }

  // 2) Thai meaning -> word
  function qReverse(items) {
    const vocab = items.filter((i) => i.type === "vocab" && i.word && i.th);
    return shuffle(vocab).slice(0, Q_PER_TYPE).map(function (it) {
      const p = makeOptions(it.word, vocab.filter((x) => x !== it), (x) => x.word);
      return { kind: "reverse", it: it, opts: p.opts, answer: p.answer };
    });
  }

  // 3) fill-in-the-blank: exEn with word blanked, choose the word
  function qFill(items) {
    const vocab = items.filter((i) => i.type === "vocab" && i.word && i.exEn);
    const eligible = vocab.filter(function (i) {
      const w = (i.word || "").toLowerCase();
      return w && i.exEn.toLowerCase().indexOf(w) !== -1;
    });
    return shuffle(eligible).slice(0, Q_PER_TYPE).map(function (it) {
      const p = makeOptions(it.word, vocab.filter((x) => x !== it), (x) => x.word);
      const sent = blankSentence(it.exEn, it.word);
      return { kind: "fill", it: it, sentence: sent, opts: p.opts, answer: p.answer };
    });
  }

  function blankSentence(sentence, word) {
    const escW = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return sentence.replace(new RegExp("\\b" + escW + "\\b", "gi"), "______");
  }

  // 4) phrase (collocation/idiom) -> Thai meaning
  function qPhrase(items) {
    const ph = items.filter((i) => (i.type === "collocation" || i.type === "idiom") && i.word && i.th);
    return shuffle(ph).slice(0, Q_PER_TYPE).map(function (it) {
      const p = makeOptions(it.th, ph.filter((x) => x !== it), (x) => x.th);
      return { kind: "phrase", it: it, opts: p.opts, answer: p.answer };
    });
  }

  function buildQuestions() {
    const items = uniqueBy(collectItems(), "word");
    const all = [].concat(qMeaning(items), qReverse(items), qFill(items), qPhrase(items));
    const filtered = all.filter((q) => q !== null && q.opts && q.answer >= 0 && q.opts.length === 4);
    return shuffle(filtered);
  }

  /* ---------- state ---------- */
  let S = null; // { level, fromLevel, qs, idx, results }

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
    try { if (window.VocabApp && typeof window.VocabApp.toast === "function") { window.VocabApp.toast(msg, type === "err" ? "err" : "ok"); return; } } catch (e) {}
    if (window.VocabExam && window.VocabExam._toast) { window.VocabExam._toast(msg, type); }
  }

  function mount() { return $("levelupMount"); }

  /* ---------- public entry ---------- */
  function start() {
    if (!nextLevel()) {
      toast(t("levelup.max", "คุณเรียนครบระดับสูงสุดแล้ว!") ,"warn");
      return;
    }
    if (!(window.VocabApp && typeof window.VocabApp.allPlanDaysDone === "function" && window.VocabApp.allPlanDaysDone())) {
      toast(t("levelup.notReady", "ต้องเรียนครบทุกวันของแผนก่อน"), "err");
      return;
    }
    const qs = buildQuestions();
    if (qs.length < 8) {
      toast(t("levelup.notEnough", "คำศัพท์ในระดับนี้ไม่พอสำหรับแบบทดสอบเลื่อนระดับ"), "err");
      return;
    }
    S = { level: currentLevel(), fromLevel: currentLevel(), qs: qs, idx: 0, results: [] };
    showMount();
    renderQuestion();
  }

  function showMount() {
    const m = mount();
    if (!m) return;
    // เข้าสู่หน้า Test Center (view-exam) ก่อน แล้วค่อยซ่อน panel หลักของ exam/posttest
    try { if (window.VocabApp && typeof window.VocabApp.showView === "function") window.VocabApp.showView("exam"); } catch (e) {}
    const panel = $("examPanel"); if (panel) panel.style.display = "none";
    const post = $("posttestMount"); if (post) post.style.display = "none";
    m.style.display = "block";
  }

  function restoreViews() {
    const panel = $("examPanel"); if (panel) panel.style.display = "";
    const post = $("posttestMount"); if (post && post.innerHTML === "") post.style.display = "none";
    const m = mount(); if (m) { m.style.display = "none"; m.innerHTML = ""; }
    try { if (window.VocabExam && typeof window.VocabExam.render === "function") window.VocabExam.render(); } catch (e) {}
  }

  /* ---------- screens ---------- */
  function renderQuestion() {
    const m = mount();
    if (!m || !S) return;
    const q = S.qs[S.idx];
    if (!q) { finish(); return; }

    const Q_KIND_LABEL = {
      meaning: t("levelup.kindMeaning", "เลือกความหมาย"),
      reverse: t("levelup.kindReverse", "เลือกคำจากความหมาย"),
      fill: t("levelup.kindFill", "เติมคำในประโยค"),
      phrase: t("levelup.kindPhrase", "ความหมายของคำผสม/สำนวน")
    };

    const optsHtml = q.opts.map(function (opt, i) {
      return '<button class="placement-opt" data-i="' + i + '" tabindex="0" role="radio" aria-label="ตัวเลือก ' + (i + 1) + '">' +
        '<span class="opt-label">' + ["A", "B", "C", "D"][i] + '</span><span class="opt-text">' + esc(opt) + "</span></button>";
    }).join("");

    m.innerHTML = `
      <div class="exam-running" role="region" aria-label="Level-Up exam question ${S.idx + 1}">
        <div class="exam-top">
          <span class="exam-counter">${svgIcon("medal", 16)} ${esc(t("levelup.title", "แบบทดสอบเลื่อนระดับ"))} · ${esc(t("levelup.stage", "ข้อ"))} ${S.idx + 1}/${S.qs.length} · ${esc(Q_KIND_LABEL[q.kind] || "")}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(S.idx / S.qs.length * 100)}%"></div></div>
        <div class="placement-content">
          ${q.kind === "fill"
            ? '<div class="placement-question placement-fill-head">' + esc(t("levelup.qFill", "เลือกคำที่หายไปในประโยค")) + "</div>"
            : '<div class="placement-word">' + esc(q.it.word) + (q.it.pos ? ' <span class="exam-pos">' + esc(q.it.pos) + "</span>" : "") + "</div>"}
          ${q.kind === "meaning"
            ? '<div class="placement-question">' + esc(t("levelup.qMeaning", "ความหมายของคำนี้คืออะไร?")) + "</div>"
            : ""}
          ${q.kind === "reverse"
            ? '<div class="placement-question">' + esc(t("levelup.qReverse", "คำใดตรงกับความหมายนี้?")) + " — <b>" + esc(q.it.th) + "</b></div>"
            : ""}
          ${q.kind === "phrase"
            ? '<div class="placement-question">' + esc(t("levelup.qPhrase", "ความหมายของคำผสม/สำนวนนี้คืออะไร?")) + "</div>"
            : ""}
          ${q.kind === "fill" ? '<div class="placement-sentence">' + esc(q.sentence) + "</div>" : ""}
          <div class="placement-opts" role="radiogroup" aria-label="ตัวเลือกคำตอบ">${optsHtml}</div>
        </div>
      </div>`;

    const opts = m.querySelectorAll(".placement-opt");
    opts.forEach(function (btn) {
      const handle = function () { submitAnswer(q, parseInt(btn.dataset.i, 10), opts); };
      btn.onclick = handle;
    });
  }

  function submitAnswer(q, chosen, opts) {
    if (!S || q.answered) return;
    q.answered = true;
    const correct = chosen === q.answer;
    S.results.push({ word: q.it.word, correct: correct });
    opts.forEach(function (b) {
      b.disabled = true;
      if (parseInt(b.dataset.i, 10) === q.answer) b.classList.add("correct");
      if (parseInt(b.dataset.i, 10) === chosen && !correct) b.classList.add("wrong");
    });
    playTone(correct);
    setTimeout(function () {
      if (!S) return;
      if (S.idx + 1 >= S.qs.length) { finish(); }
      else { S.idx++; renderQuestion(); }
    }, 500);
  }

  function parsePct(correct, total) { return Math.round(correct / total * 100); }

  function finish() {
    if (!S) return;
    const correct = S.results.filter((r) => r.correct).length;
    const total = S.qs.length;
    const pct = parsePct(correct, total);
    const passed = pct >= PASS_PCT;
    const from = S.level;
    const to = nextLevel();

    // บันทึกผล (เก็บ 10 ล่าสุด)
    const rec = { date: todayISO(), ts: Date.now(), fromLevel: from, toLevel: to, correct: correct, total: total, pct: pct, passed: passed };
    try {
      const list = store().load(K_RESULTS, []) || [];
      list.unshift(rec);
      store().save(K_RESULTS, list.slice(0, 10));
    } catch (e) {}

    const passedLocal = { res: rec };
    if (window.VocabApp && typeof window.VocabApp.awardXp === "function") {
      try { window.VocabApp.awardXp(passed ? 100 : 20, "levelup"); } catch (e) {}
    }
    renderResult(passedLocal.res);
  }

  function gradeOf(pct) {
    if (pct >= 90) return { cls: "grade-a", label: t("levelup.gradeA", "Excellent") };
    if (pct >= 80) return { cls: "grade-b", label: t("levelup.gradeB", "Very good") };
    if (pct >= 70) return { cls: "grade-c", label: t("levelup.gradeC", "Pass") };
    return { cls: "grade-d", label: t("levelup.gradeD", "Keep practising") };
  }

  function renderResult(rec) {
    const m = mount();
    if (!m) return;
    const passed = rec.passed;
    const toLv = nextLevel();
    const toName = toLv ? levelInfo(toLv).th + " (" + toLv + ")" : "";
    const grade = gradeOf(rec.pct);

    m.innerHTML = `
      <div class="exam-result" role="region" aria-label="Level-Up exam result">
        <div class="placement-badge">${svgIcon(passed ? "sparkle" : "cross")} ${esc(t("levelup.resultTitle", "ผลแบบทดสอบเลื่อนระดับ"))}</div>
        <div class="exam-score-row"><span class="exam-score-big">${rec.pct}%</span></div>
        <div class="exam-meta">${esc(t("levelup.correctCount", "ถูก"))} ${rec.correct}/${rec.total} · ต้องการ ≥ ${PASS_PCT}%</div>
        <div class="exam-grade ${passed ? "grade-b" : "grade-f"}">${passed
          ? esc(t("levelup.passed", "ผ่าน! พร้อมเลื่อนระดับ")) + (toLv ? " → " + esc(toName) : "")
          : esc(t("levelup.failed", "ยังไม่ผ่านเกณฑ์ — ลองอีกครั้ง"))}</div>
        <div class="btn-row">
          ${passed && toLv
            ? '<button class="btn btn-accent" id="lupAdvance">' + svgIcon("medal") + " " + esc(t("levelup.advance", "เลื่อนระดับเลย!")) + "</button>"
            : '<button class="btn btn-accent" id="lupRetry">' + svgIcon("refresh") + " " + esc(t("levelup.retry", "ลองอีกครั้ง")) + "</button>"}
          <button class="btn btn-secondary" id="lupExit">${svgIcon("arrowLeft")} ${esc(t("levelup.exit", "กลับ"))}</button>
        </div>
      </div>
      <div class="exam-history"><h4>${esc(t("levelup.history", "ประวัติแบบทดสอบเลื่อนระดับ"))}</h4>
        ${(store().load(K_RESULTS, []) || []).slice(0, 5).map((r) =>
          '<div class="exam-hist-row"><span>' + esc(r.date + " · " + r.fromLevel + "→" + (r.toLevel || "—")) + "</span><span>ถูก " + r.correct + "/" + r.total + " · " + r.pct + "%</span><b>" + (r.passed ? "ผ่าน" : "ไม่ผ่าน") + "</b></div>"
        ).join("") || '<div class="exam-hist-row">—</div>'}
      </div>`;

    const adv = $("lupAdvance");
    if (adv) adv.onclick = function () { advanceAndReload(rec); };
    const retry = $("lupRetry");
    if (retry) retry.onclick = function () { S = null; start(); };
    const exit = $("lupExit");
    if (exit) exit.onclick = function () { S = null; restoreViews(); };
  }

  function advanceAndReload() {
    const toLv = nextLevel();
    if (!toLv) return;
    try { if (window.VocabApp && typeof window.VocabApp.promoteLevel === "function") window.VocabApp.promoteLevel(toLv); } catch (e) {}
    toast(t("levelup.promoted", "ยินดีด้วย! เลื่อนระดับเป็น " + toLv + " แล้ว").replace("{lv}", toLv), "ok");
    S = null;
    restoreViews();
    try {
      if (window.VocabApp && typeof window.VocabApp.showView === "function") window.VocabApp.showView("tasks");
    } catch (e) {}
    setTimeout(function () {
      try {
        if (window.VocabApp && typeof window.VocabApp.refreshViews === "function") window.VocabApp.refreshViews();
      } catch (e) {}
    }, 120);
  }

  /* clean up when leaving the view elsewhere */
  function pause() {
  }

  window.LevelUpExam = {
    start: start,
    pause: pause,
    available: function () {
      try { return !!(window.VocabApp && window.VocabApp.nextLevel && window.VocabApp.nextLevel() && window.VocabApp.allPlanDaysDone && window.VocabApp.allPlanDaysDone()); } catch (e) { return false; }
    }
  };
})();