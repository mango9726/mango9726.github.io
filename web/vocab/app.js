/* ============================================================
   Vocab Trainer — app.js
   ระบบ: Flashcards + SRS (Leitner) + Quiz + Browse + Daily Tasks
   เก็บความคืบหน้าใน localStorage
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Storage keys ---------- */
  const K_PROGRESS = "vocab_progress_v1";
  const K_SETTINGS = "vocab_settings_v1";
  const K_STREAK = "vocab_streak_v1";
  const K_REVIEWS = "vocab_reviews_v1";

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

  /* ---------- Storage load/save ---------- */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  let progress = load(K_PROGRESS, {});
  let settings = load(K_SETTINGS, { theme: "light" });
  let reviews = load(K_REVIEWS, {});

  /* ---------- Build flat item list ---------- */
  function getAllItems() {
    const items = [];
    Object.keys(VOCAB_DAYS).sort((a, b) => a - b).forEach(function (dayKey) {
      const d = VOCAB_DAYS[dayKey];
      (d.vocabulary || []).forEach(function (v, i) {
        items.push({ id: d.day + "-v-" + i, type: "vocab", day: d.day, topic: d.topic, word: v.word, phonetic: v.phonetic, pos: v.pos, th: v.th, exEn: v.exEn, exTh: v.exTh, note: "" });
      });
      (d.collocations || []).forEach(function (c, i) {
        items.push({ id: d.day + "-c-" + i, type: "collocation", day: d.day, topic: d.topic, word: c.phrase, pos: "collocation", th: "", exEn: c.exEn, exTh: c.exTh, note: c.note });
      });
      if (d.idiom) {
        items.push({ id: d.day + "-i-0", type: "idiom", day: d.day, topic: d.topic, word: d.idiom.phrase, pos: "idiom", th: d.idiom.meaning, exEn: d.idiom.exEn, exTh: d.idiom.exTh, note: "" });
      }
    });
    return items;
  }

  let ITEMS = getAllItems();
  function itemsForDay(dayNum) { return ITEMS.filter(function (i) { return String(i.day) === String(dayNum); }); }

  /* ---------- Progress (per-item SRS) ---------- */
  function getP(id) {
    return progress[id] || { box: 1, due: todayStr(), reps: 0, lapses: 0, seen: 0 };
  }
  function isDue(item) { return getP(item.id).due <= todayStr(); }
  function isMastered(item) { return getP(item.id).box >= 4; }

  function recordAnswer(item, correct) {
    const p = getP(item.id);
    p.seen = (p.seen || 0) + 1;
    if (correct) {
      p.box = Math.min(5, (p.box || 1) + 1);
      p.reps = (p.reps || 0) + 1;
      p.due = addDays(todayStr(), BOX_INTERVAL[p.box]);
    } else {
      p.box = 1;
      p.lapses = (p.lapses || 0) + 1;
      p.due = todayStr();
    }
    progress[item.id] = p;
    save(K_PROGRESS, progress);
    bumpStreak();
  }

  /* ---------- Streak ---------- */
  function bumpStreak() {
    const s = load(K_STREAK, { streak: 0, last: "" });
    const t = todayStr();
    if (s.last === t) return;
    const y = addDays(t, -1);
    s.streak = (s.last === y) ? (s.streak + 1) : 1;
    s.last = t;
    save(K_STREAK, s);
  }

  /* ---------- Plan day (วันของแผน 120 วัน) ----------
     คำนวณอัตโนมัติจากวันที่ของ Day 1 ในข้อมูล
     ถ้าผู้ใช้ปรับเองจะเก็บใน settings.planDayOverride              */
  function day1Date() { return VOCAB_DAYS["1"] ? VOCAB_DAYS["1"].date : null; }
  function computePlanDay() {
    const d1 = day1Date();
    if (!d1) return 1;
    const diff = Math.floor((new Date(todayStr() + "T00:00:00") - new Date(d1 + "T00:00:00")) / 86400000);
    return Math.max(1, diff + 1);
  }
  function currentPlanDay() { return settings.planDayOverride ? settings.planDayOverride : computePlanDay(); }

  /* ---------- Daily Tasks review state ---------- */
  function getReview(d) { return reviews[d] || { done: 0, nextDue: Number(d) + 1 }; }
  function recordReview(d) {
    const r = getReview(d);
    r.done = (r.done || 0) + 1;
    const gap = (r.done - 1) < GAPS.length ? GAPS[r.done - 1] : 15;
    r.nextDue = currentPlanDay() + gap;
    reviews[d] = r;
    save(K_REVIEWS, reviews);
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

  /* ---------- View switching ---------- */
  function showView(name) {
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
      b.classList.toggle("active", b.dataset.view === name);
    });
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("active", v.id === "view-" + name);
    });
    if (name === "home") renderHome();
    if (name === "browse") renderBrowse();
    if (name === "settings") renderSettings();
    if (name === "tasks") renderTasks();
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
  const CHIP_DEFS = {
    cardFilterType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    cardMode: [["all", "ทั้งหมด"], ["due", "เฉพาะที่ถึงกำหนด"], ["random", "สุ่ม"]],
    quizMode: [["meaning", "คำ → ความหมาย"], ["sentence", "ประโยค → แปลไทย"]],
    quizCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]],
    quizType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    browseType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    pronCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]],
    pronType: [["vocab", "คำศัพท์"], ["idiom", "Idioms"], ["collocation", "Collocations"], ["all", "ทั้งหมด"]],
    fillDir: [["th2en", "แปล → คำ"], ["en2th", "คำ → แปล"]],
    fillType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    fillCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]],
    matchType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    matchSize: [["6", "6 คู่"], ["8", "8 คู่"], ["10", "10 คู่"]],
    tfType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    tfCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]],
    tfTime: [["30", "30 วิ"], ["60", "60 วิ"], ["120", "120 วิ"]],
    hangType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    hangCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]],
    buildType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    buildCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]],
    clozeType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    clozeCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]],
    listenType: [["all", "ทั้งหมด"], ["vocab", "คำศัพท์"], ["collocation", "Collocations"], ["idiom", "Idioms"]],
    listenCount: [["10", "10"], ["20", "20"], ["all", "ทั้งหมด"]]
  };
  const CHIP_DEFAULT = { cardFilterType: "all", cardMode: "all", quizMode: "meaning", quizCount: "10", quizType: "all", browseType: "all", pronCount: "10", pronType: "vocab", fillDir: "th2en", fillType: "all", fillCount: "10", matchType: "all", matchSize: "8", tfType: "all", tfCount: "10", tfTime: "60", hangType: "all", hangCount: "10", buildType: "all", buildCount: "10", clozeType: "all", clozeCount: "10", listenType: "all", listenCount: "10" };
  function populateDayChips() {
    const days = Object.keys(VOCAB_DAYS).sort((a, b) => a - b);
    [["cardFilterDay", "all"], ["browseDay", "all"]].forEach(function (p) {
      const c = $(p[0]); if (!c) return;
      const cur = chipValue(c) || p[1];
      const opts = [{ value: "all", label: "ทุกวัน" }].concat(
        days.map(function (d) { return { value: d, label: "Day " + d }; })
      );
      buildChips(c, opts, cur, p[0] === "browseDay" ? renderBrowse : null);
    });
  }
  function initChips() {
    Object.keys(CHIP_DEFS).forEach(function (id) {
      const c = $(id); if (!c) return;
      const onSel = (id === "browseType") ? renderBrowse : null;
      buildChips(c, CHIP_DEFS[id].map(function (o) { return { value: o[0], label: o[1] }; }), CHIP_DEFAULT[id] || "all", onSel);
    });
    populateDayChips();
  }

  /* ============================================================
     HOME
     ============================================================ */
  function renderHome() {
    const total = ITEMS.length;
    const mastered = ITEMS.filter(isMastered).length;
    const due = ITEMS.filter(isDue).length;
    const days = Object.keys(VOCAB_DAYS).length;
    $("statTotal").textContent = total;
    $("statMastered").textContent = mastered;
    $("statDue").textContent = due;
    $("statDays").textContent = days;

    const s = load(K_STREAK, { streak: 0 });
    $("streak").textContent = s.streak || 0;

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
  }

  /* ============================================================
     FLASHCARDS
     ============================================================ */
  let cardQueue = [], cardIdx = 0;
  function startCards() {
    const type = chipValue($("cardFilterType"));
    const day = chipValue($("cardFilterDay"));
    const mode = chipValue($("cardMode"));
    let list = ITEMS.slice();
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (day !== "all") list = list.filter(function (i) { return String(i.day) === day; });
    if (mode === "due") list = list.filter(isDue);
    if (mode === "random") list = shuffle(list);
    if (!list.length) { alert("ไม่มีคำในเงื่อนไขนี้ คลายเงื่อนไขดูนะ"); return; }

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
    $("cardTh").textContent = item.th || (item.type === "collocation" ? "ดูประโยคตัวอย่างด้านล่าง" : "");
    $("cardExEn").textContent = item.exEn;
    $("cardExTh").textContent = item.exTh;
    const note = $("cardNote");
    if (item.note) { note.textContent = "⚠️ " + item.note; note.classList.remove("hidden"); }
    else note.classList.add("hidden");

    flip.onclick = function () { flip.classList.toggle("flipped"); };
    $("cardSpeak").onclick = function (e) { e.stopPropagation(); speak(item.word); };
    $("cardInfo").onclick = function (e) { e.stopPropagation(); openDetail(item); };
  }

  function cardAnswer(correct) {
    recordAnswer(cardQueue[cardIdx], correct);
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
    const r = $("cardResult");
    r.classList.remove("hidden");
    r.innerHTML = "<h2>🎉 ทบทวนจบแล้ว!</h2><p class=\"big\">" + cardQueue.length + " คำ</p><p>คำที่ตอบถูกจะถูกเลื่อนขึ้นกล่องถัดไป (ทบทวนห่างขึ้น) คำที่ผิดจะกลับมาวันนี้</p><button class=\"btn btn-primary\" id=\"cardBack\">กลับหน้าแรก</button>";
    $("cardBack").onclick = function () { showView("home"); };
  }

  /* ============================================================
     QUIZ  (รองรับทั้งแบบทดสอบทั่วไป และแบบทบทวนรายวัน)
     ============================================================ */
  let quizQueue = [], quizIdx = 0, quizScore = 0, quizMode = "meaning";
  let quizOnEnd = null, quizReturnView = "home";

  function startQuiz() {
    const type = chipValue($("quizType"));
    const mode = chipValue($("quizMode"));
    let count = chipValue($("quizCount"));
    let list = ITEMS.slice();
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (mode === "meaning") list = list.filter(function (i) { return i.th && i.th.trim(); });
    if (!list.length) { alert("ไม่มีคำสำหรับรูปแบบนี้ ลองเปลี่ยนรูปแบบหรือประเภท"); return; }
    list = shuffle(list);
    if (count !== "all") { count = parseInt(count, 10); if (list.length > count) list = list.slice(0, count); }
    launchQuiz(list, mode, null, "home", false);
  }

  /* เริ่มข้อสอบจากรายการคำที่กำหนด (ใช้กับ Daily Tasks) */
  function launchQuizForDay(dayNum, retView) {
    const items = itemsForDay(dayNum);
    if (!items.length) { alert("ไม่มีคำสำหรับ Day นี้"); return; }
    showView("quiz"); // UI ข้อสอบอยู่ในหน้า quiz
    launchQuiz(items, "sentence", function () { recordReview(dayNum); }, retView || "tasks", true);
  }

  function launchQuiz(items, mode, onEnd, retView, useCount) {
    let list = shuffle(items);
    if (useCount) {
      let c = chipValue($("quizCount"));
      if (c && c !== "all") { c = parseInt(c, 10); if (list.length > c) list = list.slice(0, c); }
    }
    if (!list.length) { alert("ไม่มีคำให้ทำข้อสอบ"); return; }
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
    $("quizCounter").textContent = "ข้อ " + (quizIdx + 1) + " / " + total;
    $("quizProgress").style.width = (quizIdx / total) * 100 + "%";
    const fb = $("quizFeedback"); fb.className = "quiz-feedback hidden"; fb.textContent = "";
    $("quizNext").classList.add("hidden");

    let promptText, answerOpt, distractItems;
    if (quizMode === "meaning") {
      promptText = item.word + (item.pos ? " (" + item.pos + ")" : "");
      answerOpt = { text: item.th, item: item };
      distractItems = ITEMS.filter(function (i) { return i.th && i.th.trim() && i.th !== item.th; });
    } else {
      promptText = item.exEn;
      answerOpt = { text: item.exTh, item: item };
      distractItems = ITEMS.filter(function (i) { return i.exTh && i.exTh.trim() && i.exTh !== item.exTh; });
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
      fb.textContent = "✅ ถูกต้อง!";
      fb.style.color = "var(--good)";
    } else {
      btn.classList.add("wrong");
      opts.forEach(function (o) { if (o._opt.text === answer.text) o.classList.add("correct"); });
      fb.textContent = "❌ คำตอบที่ถูกคือ: " + answer.text;
      fb.style.color = "var(--bad)";
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
    const r = $("quizResult");
    r.classList.remove("hidden");
    const pct = Math.round((quizScore / quizQueue.length) * 100);
    let html = "<h2>📝 ผลคะแนน</h2><p class=\"big\">" + quizScore + " / " + quizQueue.length + "</p><p>ความแม่นยำ " + pct + "%</p>";
    if (quizOnEnd) { try { quizOnEnd(); } catch (e) {} }
    if (quizReturnView === "tasks") {
      html += "<p style=\"margin-top:10px\">✅ บันทึกการทบทวนเรียบร้อย ครั่งหน้าจะเว้นระยะห่างขึ้น</p>";
      html += "<button class=\"btn btn-primary\" id=\"quizBack\">กลับรายการ Daily Tasks</button>";
    } else {
      html += "<p style=\"margin-top:10px\">คำที่ผิดจะถูกนำกลับมาทบทวนเร็วขึ้นอัตโนมัติ</p>";
      html += "<button class=\"btn btn-primary\" id=\"quizBack\">กลับหน้าแรก</button>";
    }
    r.innerHTML = html;
    $("quizBack").onclick = function () { showView(quizReturnView); };
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
    $("tasksToday").textContent = "วันนี้คือ Day " + cp + " ของแผน 120 วัน";
    const list = $("tasksList");
    list.innerHTML = "";

    // งานใหม่: ถ้ามีคำสำหรับวันนี้
    if (VOCAB_DAYS[String(cp)]) {
      const nc = taskCard(
        "🆕 เรียนคำใหม่",
        "Day " + cp + " · " + (VOCAB_DAYS[String(cp)].topic || ""),
        "แบบทดสอบคำใหม่",
        function () { launchQuizForDay(cp, "tasks"); },
        "จำนวนคำ: " + itemsForDay(cp).length + " รายการ"
      );
      nc.style.animationDelay = "0ms";
      list.appendChild(nc);
    }

    // งานทบทวน: วันก่อนหน้าที่ถึงกำหนด
    let dueCount = 0, k = 0;
    Object.keys(VOCAB_DAYS).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
      if (d >= cp) return; // เฉพาะวันที่ผ่านมา
      const r = getReview(d);
      if (r.nextDue <= cp) {
        dueCount++;
        const meta = "ทบทวนไปแล้ว " + (r.done || 0) + " ครั้ง · ครั่งหน้า: Day " + r.nextDue;
        const rc = taskCard(
          "🔁 ทบทวน",
          "Day " + d + " · " + (VOCAB_DAYS[String(d)].topic || ""),
          "ทำแบบทดสอบ",
          function () { launchQuizForDay(d, "tasks"); },
          meta
        );
        rc.style.animationDelay = (k * 60) + "ms"; k++;
        list.appendChild(rc);
      }
    });

    if (dueCount === 0 && !VOCAB_DAYS[String(cp)]) {
      list.appendChild(el("p", "hint", "ยังไม่มีงานให้ทำวันนี้ ✅ ถ้ายังไม่ได้เพิ่มคำสำหรับ Day " + cp + " บอก Claude: \"Day " + cp + ", [หัวข้อ หรือ random]\" เพื่อเพิ่มคำใหม่"));
    } else if (dueCount === 0) {
      list.appendChild(el("p", "hint", "ไม่มีคำที่ต้องทบทวนวันนี้ — ทำคำใหม่ให้เรียบร้อยแล้ว พักผ่อนได้! 🎉"));
    }
  }

  /* ============================================================
     BROWSE
     ============================================================ */
  function renderBrowse() {
    const q = $("browseSearch").value.trim().toLowerCase();
    const type = chipValue($("browseType"));
    const day = chipValue($("browseDay"));
    let list = ITEMS.slice();
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (day !== "all") list = list.filter(function (i) { return String(i.day) === day; });
    if (q) list = list.filter(function (i) {
      return (i.word + " " + i.th + " " + i.exEn + " " + i.exTh).toLowerCase().indexOf(q) !== -1;
    });

    const box = $("browseList");
    box.innerHTML = "";
    if (!list.length) { box.appendChild(el("p", "hint", "ไม่พบคำที่ตรงกับการค้นหา")); return; }
    list.forEach(function (i, idx) {
      const card = el("div", "browse-card");
      card.style.animationDelay = (idx * 35) + "ms";
      const head = el("div", "bc-head");
      const left = el("div");
      left.appendChild(el("div", "bc-word", i.word));
      if (i.phonetic) left.appendChild(el("div", "bc-pos", "/ " + i.phonetic + " /"));
      if (i.pos) left.appendChild(el("div", "bc-pos", i.pos));
      head.appendChild(left);
      const tlabel = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOC" : "IDIOM";
      const tcls = i.type === "vocab" ? "t-vocab" : i.type === "collocation" ? "t-collocation" : "t-idiom";
      const right = el("div", "bc-head-right");
      const spk = el("button", "bc-speak", "🔊");
      spk.title = "ฟังเสียง";
      spk.onclick = function (e) { e.stopPropagation(); speak(i.word); };
      right.appendChild(el("span", "bc-type " + tcls, tlabel));
      right.appendChild(spk);
      head.appendChild(right);
      card.appendChild(head);
      card.onclick = function () { openDetail(i); };
      if (i.th) card.appendChild(el("div", "bc-th", i.th));
      const ex = el("div", "bc-ex");
      ex.innerHTML = "<div>" + i.exEn + "</div><div>" + i.exTh + "</div>";
      card.appendChild(ex);
      if (i.note) card.appendChild(el("div", "bc-note", "⚠️ " + i.note));
      card.appendChild(el("div", "bc-day", "Day " + i.day + " · " + (i.topic || "")));
      box.appendChild(card);
    });
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", settings.theme);
    $("themeToggle").textContent = settings.theme === "dark" ? "☀️" : "🌙";
  }
  function toggleTheme() {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    save(K_SETTINGS, settings); applyTheme();
  }
  function renderSettings() {
    const ids = Object.keys(progress);
    let learned = 0, mastered = 0;
    ids.forEach(function (id) { if (progress[id].box >= 2) learned++; if (progress[id].box >= 4) mastered++; });
    $("settingsInfo").textContent =
      "คำที่เรียนไปแล้ว: " + learned + " คำ\n" +
      "ชำนาญ (กล่อง 4+): " + mastered + " คำ\n" +
      "จำนวนวันทั้งหมดในระบบ: " + Object.keys(VOCAB_DAYS).length + " วัน\n" +
      "คำศัพท์รวม: " + ITEMS.length + " รายการ";
    $("planDayLabel").textContent = "Day " + (settings.planDayOverride || computePlanDay());
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
        reviews: load(K_REVIEWS, {})
      }
    };
  }

  function backupStatus(msg, ok) {
    const s = $("backupStatus");
    if (!s) return;
    s.textContent = msg;
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
    backupStatus("✅ ดาวน์โหลดไฟล์สำรองแล้ว — เก็บไว้แล้วนำไป 'เลือกไฟล์สำรอง' ที่เครื่องใหม่ได้เลย", true);
  }

  function exportCopy() {
    const json = JSON.stringify(collectBackup());
    const ta = $("backupCode");
    if (ta) ta.value = json;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(
        function () { backupStatus("✅ คัดลอกโค้ดสำรองแล้ว — วางในช่องข้อความที่เครื่องใหม่แล้วกด 'นำเข้า'", true); },
        function () { backupStatus("คัดลอกอัตโนมัติไม่ได้ — เลือกข้อความในช่องแล้วก๊อปเองได้เลย", false); }
      );
    } else {
      if (ta) { ta.focus(); ta.select(); }
      backupStatus("เลือกข้อความในช่องด้านบนแล้วกด Ctrl+C เพื่อคัดลอก", false);
    }
  }

  function applyBackup(obj) {
    if (!obj || obj.app !== "vocab-trainer" || !obj.data) {
      backupStatus("❌ ไฟล์/โค้ดไม่ถูกต้อง — ต้องเป็นไฟล์สำรองที่ส่งออกจากแอปนี้เท่านั้น", false);
      return false;
    }
    const d = obj.data;
    if (d.progress) { progress = d.progress; save(K_PROGRESS, progress); }
    if (d.reviews) { reviews = d.reviews; save(K_REVIEWS, reviews); }
    if (d.settings) { settings = d.settings; save(K_SETTINGS, settings); }
    if (d.streak) { save(K_STREAK, d.streak); }
    applyTheme();
    renderSettings();
    renderHome();
    populateDayChips();
    backupStatus("✅ นำเข้าข้อมูลสำเร็จ! ความคืบหน้าทั้งหมดถูกกู้คืนแล้ว", true);
    return true;
  }

  function importFromCode() {
    const ta = $("backupCode");
    const txt = ta ? ta.value.trim() : "";
    if (!txt) { backupStatus("กรุณาวางโค้ดสำรองในช่องข้อความก่อน", false); return; }
    let obj;
    try { obj = JSON.parse(txt); }
    catch (e) { backupStatus("❌ อ่านโค้ดไม่ได้ — โค้ดอาจไม่ครบหรือผิดรูปแบบ", false); return; }
    if (confirm("นำเข้าข้อมูลนี้? ความคืบหน้าปัจจุบันในเครื่องนี้จะถูกแทนที่")) applyBackup(obj);
  }

  function importFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      let obj;
      try { obj = JSON.parse(e.target.result); }
      catch (err) { backupStatus("❌ ไฟล์นี้ไม่ใช่ไฟล์สำรองที่ถูกต้อง", false); return; }
      if (confirm("นำเข้าข้อมูลจากไฟล์นี้? ความคืบหน้าปัจจุบันในเครื่องนี้จะถูกแทนที่")) applyBackup(obj);
    };
    reader.onerror = function () { backupStatus("❌ อ่านไฟล์ไม่สำเร็จ", false); };
    reader.readAsText(file);
  }

  /* ============================================================
     WORD DETAIL MODAL
     ============================================================ */
  const BOX_NAMES = { 1: "เพิ่งเริ่ม", 2: "กำลังจำ", 3: "จำได้ดี", 4: "ชำนาญ", 5: "แม่นยำมาก" };

  function openDetail(item) {
    if (!item) return;
    const tlabel = item.type === "vocab" ? "VOCAB" : item.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("detailType").textContent = tlabel;
    $("detailWord").textContent = item.word;

    const ph = $("detailPhonetic");
    if (item.phonetic) { ph.textContent = "/ " + item.phonetic + " /"; ph.classList.remove("hidden"); }
    else ph.classList.add("hidden");

    $("detailPos").textContent = item.pos || "";
    $("detailTh").textContent = item.th || (item.type === "collocation" ? "ดูตัวอย่างการใช้ด้านล่าง" : "");

    $("detailExEn").textContent = item.exEn || "";
    $("detailExTh").textContent = item.exTh || "";

    const note = $("detailNote");
    if (item.note) { note.textContent = "⚠️ " + item.note; note.classList.remove("hidden"); }
    else note.classList.add("hidden");

    // progress
    const p = getP(item.id);
    const box = Math.min(5, Math.max(1, p.box || 1));
    const pct = (box / 5) * 100;
    $("detailProgress").innerHTML =
      "<div class=\"dp-label\">กล่องที่ " + box + "/5 · " + (BOX_NAMES[box] || "") + "</div>" +
      "<div class=\"dp-bar\"><div class=\"dp-fill\" style=\"width:" + pct + "%\"></div></div>";

    // meta
    const nextDue = p.due && p.due > todayStr() ? p.due : "พร้อมทบทวนแล้ว";
    $("detailMeta").innerHTML =
      "เห็นคำนี้แล้ว: <b>" + (p.seen || 0) + "</b> ครั้ง · ตอบถูกติดต่อกัน: <b>" + (p.reps || 0) + "</b> ครั้ง · เคยลืม: <b>" + (p.lapses || 0) + "</b> ครั้ง<br>" +
      "ทบทวนครั้งถัดไป: <b>" + nextDue + "</b> · มาจาก <b>Day " + item.day + "</b>" + (item.topic ? " (" + item.topic + ")" : "");

    // related words (same day)
    const rel = ITEMS.filter(function (i) { return i.day === item.day && i.id !== item.id; });
    const rc = $("detailRelated");
    if (rel.length) {
      let html = "<h3>🔗 คำอื่นใน Day " + item.day + "</h3><div class=\"rel-wrap\">";
      rel.forEach(function (r) { html += "<button class=\"rel-chip\" data-id=\"" + r.id + "\">" + r.word + "</button>"; });
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

    // actions
    $("detailSpeak").onclick = function () { speak(item.word); };
    $("detailSlow").onclick = function () { speak(item.word, 0.6); };

    // pronunciation practice inside modal
    const pbox = $("pronResult");
    pbox.className = "pron-feedback hidden"; pbox.innerHTML = "";
    $("detailPron").textContent = "🎤 แตะแล้วพูดคำนี้";
    attachMic($("detailPron"), null, pbox, function () { return item.word; }, function (result) {
      recordAnswer(item, result.score >= 70);
    });

    const ov = $("detailModal");
    ov.classList.add("open");
    ov.setAttribute("aria-hidden", "false");
    speak(item.word); // ออกเสียงทันทีเมื่อเปิด
  }

  function closeDetail() {
    const ov = $("detailModal");
    ov.classList.remove("open");
    ov.setAttribute("aria-hidden", "true");
    try { window.speechSynthesis.cancel(); } catch (e) {}
    stopRecognition();
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
    // เลือก candidate ที่ใกล้เคียงที่สุด
    let best = { score: -1 };
    (heardCandidates || []).forEach(function (h) {
      const hc = String(h).toLowerCase().replace(/[^a-z]/g, "");
      const res = alignMismatch(cleaned, hc);
      const maxLen = Math.max(cleaned.length, hc.length) || 1;
      const score = Math.round((1 - res.distance / maxLen) * 100);
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
    const scoreCls = result.score >= 80 ? "score-good" : result.score >= 55 ? "score-mid" : "score-bad";
    const emoji = result.score >= 80 ? "🎉 เยี่ยมมาก!" : result.score >= 55 ? "👍 ใกล้แล้ว" : "💪 ลองใหม่อีกครั้ง";
    let sylHtml = "";
    result.syllables.forEach(function (s, idx) {
      if (idx > 0) sylHtml += "<span class=\"syl-sep\">·</span>";
      sylHtml += "<span class=\"syl " + (s.wrong ? "syl-bad" : "syl-ok") + "\">" + s.text + "</span>";
    });
    const wrongCount = result.syllables.filter(function (s) { return s.wrong; }).length;
    let tip;
    if (result.score >= 80) tip = "ออกเสียงได้ชัดเจนมาก 👏";
    else if (wrongCount) tip = "โฟกัสที่พยางค์สีแดง (มีเส้นหยัก) แล้วกดฟังตัวอย่างช้าๆ อีกครั้ง";
    else tip = "เกือบถูกทั้งหมด ลองพูดให้ชัดขึ้นอีกนิด";

    box.innerHTML =
      "<div class=\"pron-score\"><span class=\"score-num " + scoreCls + "\">" + result.score + "%</span> <span>" + emoji + "</span></div>" +
      "<div class=\"pron-syllables\">" + sylHtml + "</div>" +
      "<div class=\"pron-heard\">ระบบได้ยินว่า: <b>" + (result.heard ? result.heard : "— ไม่ชัด —") + "</b></div>" +
      "<div class=\"pron-tip\">💡 " + tip + "</div>";
    box.classList.remove("hidden");
  }

  /* --- ปุ่มไมค์ทั่วไป: ผูกกับปุ่ม + กล่อง feedback + คำเป้าหมาย --- */
  function attachMic(btn, labelEl, box, getWord, onScored) {
    if (!speechRecSupported()) {
      btn.disabled = true;
      if (labelEl) labelEl.textContent = "เบราว์เซอร์นี้ไม่รองรับ (ใช้ Chrome/Edge)";
      else btn.textContent = "🎤 ไม่รองรับ (ใช้ Chrome/Edge)";
      return;
    }
    btn.onclick = function () {
      const word = getWord();
      if (!word) return;
      recognizeOnce({
        onstart: function () {
          btn.classList.add("recording");
          if (labelEl) labelEl.textContent = "กำลังฟัง... พูดเลย!";
          else btn.textContent = "🔴 กำลังฟัง...";
        },
        onresult: function (alts) {
          const result = scorePronunciation(word, alts);
          renderPronFeedback(box, word, result);
          if (onScored) onScored(result);
        },
        onerror: function (err) {
          box.classList.remove("hidden");
          const msg = err === "not-allowed" || err === "service-not-allowed"
            ? "⚠️ ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน — อนุญาตในเบราว์เซอร์แล้วลองใหม่"
            : err === "no-speech" ? "🤫 ไม่ได้ยินเสียง ลองพูดดังขึ้นแล้วกดใหม่"
            : "เกิดข้อผิดพลาด (" + err + ") ลองใหม่อีกครั้ง";
          box.innerHTML = "<div class=\"pron-tip\">" + msg + "</div>";
        },
        onend: function () {
          btn.classList.remove("recording");
          if (labelEl) labelEl.textContent = "แตะเพื่อพูดอีกครั้ง";
          else btn.textContent = "🎤 พูดอีกครั้ง";
        }
      });
    };
  }

  /* ============================================================
     PRONUNCIATION TEST (หน้าทดสอบเสียง)
     ============================================================ */
  let pronQueue = [], pronIdx = 0, pronScores = [];

  function startPron() {
    if (!speechRecSupported()) {
      alert("เบราว์เซอร์นี้ไม่รองรับการจับเสียง กรุณาใช้ Google Chrome หรือ Microsoft Edge และต่ออินเทอร์เน็ต");
      return;
    }
    const type = chipValue($("pronType"));
    let count = chipValue($("pronCount"));
    let list = ITEMS.slice();
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (!list.length) { alert("ไม่มีคำสำหรับประเภทนี้"); return; }
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
    $("pronCounter").textContent = "ข้อ " + (pronIdx + 1) + " / " + total;
    $("pronProgress").style.width = (pronIdx / total) * 100 + "%";
    const badge = item.type === "vocab" ? "VOCAB" : item.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("pronBadge").textContent = badge;
    $("pronWord").textContent = item.word;
    $("pronPhon").textContent = item.phonetic ? "/ " + item.phonetic + " /" : "";
    const fb = $("pronFeedback"); fb.className = "pron-feedback hidden"; fb.innerHTML = "";
    $("pronNext").classList.add("hidden");

    $("pronSpeak").onclick = function () { speak(item.word); };
    $("pronSlow").onclick = function () { speak(item.word, 0.6); };

    let recorded = false;
    $("pronRecordLabel").textContent = "แตะแล้วพูดคำนี้";
    attachMic($("pronRecord"), $("pronRecordLabel"), fb, function () { return item.word; }, function (result) {
      if (!recorded) { pronScores.push(result.score); recorded = true; }
      else { pronScores[pronScores.length - 1] = Math.max(pronScores[pronScores.length - 1], result.score); }
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
    const r = $("pronResult2");
    r.classList.remove("hidden");
    const avg = pronScores.length ? Math.round(pronScores.reduce(function (a, b) { return a + b; }, 0) / pronScores.length) : 0;
    r.innerHTML =
      "<h2>🎤 ผลการออกเสียง</h2><p class=\"big\">" + avg + "%</p>" +
      "<p>คะแนนเฉลี่ยจาก " + pronScores.length + " คำ</p>" +
      "<p style=\"margin-top:10px\">คำที่ออกเสียงได้ ≥ 70% จะถูกนับว่าจำได้ในระบบทบทวน</p>" +
      "<button class=\"btn btn-primary\" id=\"pronBack\">กลับหน้าแรก</button>";
    $("pronBack").onclick = function () { showView("home"); };
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

  function startFill() {
    const dir = chipValue($("fillDir"));
    const type = chipValue($("fillType"));
    const cnt = chipValue($("fillCount"));
    let list = ITEMS.slice();
    list = list.filter(function (i) {
      if (type !== "all" && i.type !== type) return false;
      if (dir === "th2en") return !!(i.word && i.word.trim());
      return !!(i.th && i.th.trim());
    });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { alert("ไม่มีคำในเงื่อนไขนี้ ลองเปลี่ยนประเภทหรือทิศทาง"); return; }

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
    $("fillCounter").textContent = "ข้อ " + (fillIdx + 1) + " / " + total;
    $("fillProgress").style.width = (fillIdx / total) * 100 + "%";
    $("fillBadge").textContent = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("fillPrompt").textContent = fillPromptText(i, dir);
    const inp = $("fillInput");
    inp.value = ""; inp.disabled = false;
    inp.placeholder = (dir === "th2en") ? "พิมพ์คำศัพท์ภาษาอังกฤษ..." : "พิมพ์ความหมายภาษาไทย...";
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
    const ok = typed === normText(fillAnswerText(i, dir));
    const fb = $("fillFeedback");
    if (ok) {
      fillScore++;
      fb.textContent = "✅ ถูกต้อง!";
      fb.style.color = "var(--good)";
    } else {
      fb.textContent = "❌ คำตอบที่ถูกคือ: " + fillAnswerText(i, dir);
      fb.style.color = "var(--bad)";
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
    const r = $("fillResult");
    r.classList.remove("hidden");
    const total = fillQueue.length;
    const pct = total ? Math.round((fillScore / total) * 100) : 0;
    let html = "<h2>✏️ ผลการเติมคำ</h2><p class=\"big\">" + fillScore + " / " + total + "</p><p>ความแม่นยำ " + pct + "%</p>";
    if (fillMissed.length) {
      html += "<h3 style=\"margin-top:14px\">คำที่ยังไม่ได้ (" + fillMissed.length + ")</h3><div class=\"missed-list\">";
      fillMissed.forEach(function (m) {
        html += "<div class=\"missed-item\"><b>" + m.word + "</b> — " + (m.th || "") +
          "<br><span class=\"muted\">เฉลย: " + m.answer + "</span></div>";
      });
      html += "</div>";
    } else {
      html += "<p style=\"margin-top:10px\">🎉 เติมได้ครบทุกข้อ!</p>";
    }
    html += "<button class=\"btn btn-primary\" id=\"fillBack\">กลับหน้าแรก</button>";
    r.innerHTML = html;
    $("fillBack").onclick = function () { showView("home"); };
  }

  /* ============================================================
     CARD MATCH (MEMORY)
     ============================================================ */
  let matchPairs = [], matchFlipped = [], matchBusy = false, matchMatched = 0;
  let matchStartTime = 0, matchTimerId = null, matchFlips = 0;

  function startMatch() {
    const type = chipValue($("matchType"));
    const size = parseInt(chipValue($("matchSize")), 10) || 8;
    let pool = ITEMS.slice().filter(function (i) {
      if (type !== "all" && i.type !== type) return false;
      const hint = (i.type === "vocab") ? i.th : (i.th || i.exTh || i.note);
      return !!(i.word && hint && hint.trim());
    });
    pool = shuffle(pool);
    if (pool.length > size) pool = pool.slice(0, size);
    if (!pool.length) { alert("ไม่มีคำในเงื่อนไขนี้ ลองเปลี่ยนประเภท"); return; }

    matchPairs = pool;
    matchFlipped = []; matchBusy = false; matchMatched = 0; matchFlips = 0;
    $("matchControls").classList.add("hidden");
    $("matchResult").classList.add("hidden");
    $("matchSession").classList.remove("hidden");

    const cards = [];
    pool.forEach(function (i) {
      const hint = (i.type === "vocab") ? i.th : (i.th || i.exTh || i.note);
      cards.push({ pairId: i.id, side: "word", text: i.word, item: i });
      cards.push({ pairId: i.id, side: "hint", text: hint, item: i });
    });
    shuffle(cards);

    const grid = $("matchGrid");
    grid.innerHTML = "";
    cards.forEach(function (c) {
      const card = el("div", "match-card");
      card.dataset.pair = c.pairId;
      card.dataset.side = c.side;
      card.innerHTML = "<div class=\"match-inner\"><div class=\"match-face match-front\">?</div><div class=\"match-face match-back\"></div></div>";
      card.querySelector(".match-back").textContent = c.text;
      card._card = c;
      card.onclick = function () { flipMatchCard(card); };
      grid.appendChild(card);
    });

    matchStartTime = Date.now();
    updateMatchStatus();
    updateMatchTimer();
    if (matchTimerId) clearInterval(matchTimerId);
    matchTimerId = setInterval(updateMatchTimer, 1000);
  }

  function updateMatchStatus() {
    $("matchStatus").textContent = "คู่ที่จับได้: " + matchMatched + " / " + matchPairs.length;
  }
  function updateMatchTimer() {
    const s = Math.floor((Date.now() - matchStartTime) / 1000);
    const m = Math.floor(s / 60), sec = s % 60;
    $("matchTimer").textContent = "⏱️ " + m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function flipMatchCard(card) {
    if (matchBusy) return;
    if (card.classList.contains("matched")) return;
    if (card.classList.contains("flipped")) return;
    card.classList.add("flipped");
    matchFlipped.push(card);
    if (matchFlipped.length === 2) {
      matchFlips++;
      matchBusy = true;
      const a = matchFlipped[0], b = matchFlipped[1];
      if (a.dataset.pair === b.dataset.pair && a.dataset.side !== b.dataset.side) {
        setTimeout(function () {
          a.classList.add("matched"); b.classList.add("matched");
          matchFlipped = []; matchBusy = false; matchMatched++;
          updateMatchStatus();
          recordAnswer(a._card.item, true);
          if (matchMatched >= matchPairs.length) endMatch();
        }, 450);
      } else {
        setTimeout(function () {
          a.classList.remove("flipped"); b.classList.remove("flipped");
          matchFlipped = []; matchBusy = false;
        }, 800);
      }
    }
  }

  function endMatch() {
    if (matchTimerId) { clearInterval(matchTimerId); matchTimerId = null; }
    $("matchSession").classList.add("hidden");
    const r = $("matchResult");
    r.classList.remove("hidden");
    const s = Math.floor((Date.now() - matchStartTime) / 1000);
    const m = Math.floor(s / 60), sec = s % 60;
    r.innerHTML =
      "<h2>🎴 จับคู่สำเร็จ!</h2>" +
      "<p class=\"big\">" + matchPairs.length + " คู่</p>" +
      "<p>ใช้เวลา " + m + ":" + (sec < 10 ? "0" : "") + sec + " · พลิกไป " + matchFlips + " ครั้ง</p>" +
      "<button class=\"btn btn-primary\" id=\"matchBack\">กลับหน้าแรก</button>";
    $("matchBack").onclick = function () { showView("home"); };
  }

  /* ============================================================
     TRUE / FALSE (TIMED)
     ============================================================ */
  let tfQueue = [], tfIdx = 0, tfScore = 0, tfMissed = [], tfTimeLeft = 0, tfTotalTime = 0, tfTimerId = null, tfAnswered = 0;

  function startTf() {
    const type = chipValue($("tfType"));
    const cnt = chipValue($("tfCount"));
    let list = ITEMS.slice().filter(function (i) {
      if (type !== "all" && i.type !== type) return false;
      return !!(i.word && i.th && i.th.trim());
    });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { alert("ไม่มีคำในเงื่อนไขนี้"); return; }

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
    $("tfCounter").textContent = "ข้อ " + (tfIdx + 1) + " / " + total;
    $("tfProgress").style.width = (tfIdx / total) * 100 + "%";
    $("tfBadge").textContent = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOCATION" : "IDIOM";
    $("tfWord").textContent = i.word;
    $("tfSpeak").onclick = function () { speak(i.word); };

    const isTrue = Math.random() < 0.5;
    const pool = ITEMS.filter(function (x) { return x.th && x.th.trim() && x.th !== i.th; }).map(function (x) { return x.th; });
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
      fb.textContent = "✅ ถูกต้อง!";
      fb.style.color = "var(--good)";
    } else {
      fb.textContent = "❌ คำตอบที่ถูกคือ: " + (correct ? "จริง" : "เท็จ") + " (" + i.th + ")";
      fb.style.color = "var(--bad)";
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
    const r = $("tfResult");
    r.classList.remove("hidden");
    const total = tfQueue.length;
    const answered = tfAnswered;
    const pct = answered ? Math.round((tfScore / answered) * 100) : 0;
    let html = "<h2>⏱️ ผลจริง/เท็จ</h2>";
    if (timeUp) html += "<p class=\"hint\">⏰ หมดเวลา! นับคะแนนเฉพาะข้อที่ตอบแล้ว</p>";
    html += "<p class=\"big\">" + tfScore + " / " + answered + "</p><p>ความแม่นยำ " + pct + "% (จาก " + total + " ข้อ)</p>";
    if (tfMissed.length) {
      html += "<h3 style=\"margin-top:14px\">คำที่ผิด (" + tfMissed.length + ")</h3><div class=\"missed-list\">";
      tfMissed.forEach(function (m) {
        html += "<div class=\"missed-item\"><b>" + m.word + "</b> — " + m.th + "</div>";
      });
      html += "</div>";
    }
    html += "<button class=\"btn btn-primary\" id=\"tfBack\">กลับหน้าแรก</button>";
    r.innerHTML = html;
    $("tfBack").onclick = function () { showView("home"); };
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
    matchFlipped = []; matchBusy = false;
    $("matchControls").classList.remove("hidden");
    $("matchSession").classList.add("hidden");
    $("matchResult").classList.add("hidden");
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
    const type = chipValue($("hangType"));
    const cnt = chipValue($("hangCount"));
    let list = ITEMS.slice().filter(function (i) { return i.word && i.word.trim(); });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { alert("ไม่มีคำในเงื่อนไขนี้"); return; }
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
    for (let k = 0; k < HANG_MAX; k++) s += (k < n) ? "❤️" : "🖤";
    $("hangLives").textContent = s;
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
    $("hangCounter").textContent = "ข้อ " + (hangIdx + 1) + " / " + total;
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
      msg.textContent = "🎉 ถูกต้อง! คำคือ: " + i.word;
      msg.style.color = "var(--good)";
      const fig = $("hangFigure"); if (fig) fig.classList.add("win");
    } else {
      msg.textContent = "💀 คำที่ถูกคือ: " + i.word;
      msg.style.color = "var(--bad)";
      hangMissed.push({ word: i.word, th: i.th });
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
    msg.textContent = "ข้าม — คำคือ: " + i.word; msg.style.color = "var(--muted)";
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
    const r = $("hangResult");
    r.classList.remove("hidden");
    const total = hangQueue.length;
    const pct = total ? Math.round((hangScore / total) * 100) : 0;
    let html = "<h2>🎯 ผลแขวนคอ</h2><p class=\"big\">" + hangScore + " / " + total + "</p><p>เดาถูก " + pct + "%</p>";
    if (hangMissed.length) {
      html += "<h3 style=\"margin-top:14px\">คำที่ไม่ได้ (" + hangMissed.length + ")</h3><div class=\"missed-list\">";
      hangMissed.forEach(function (m) { html += "<div class=\"missed-item\"><b>" + m.word + "</b> — " + (m.th || "") + "</div>"; });
      html += "</div>";
    } else {
      html += "<p style=\"margin-top:10px\">🏆 เก่งมาก! เดาทุกคำ!</p>";
    }
    html += "<button class=\"btn btn-primary\" id=\"hangBack\">กลับหน้าแรก</button>";
    r.innerHTML = html;
    $("hangBack").onclick = function () { showView("home"); };
  }

  /* ============================================================
     SENTENCE BUILDER
     ============================================================ */
  let buildQueue = [], buildIdx = 0, buildScore = 0, buildMissed = [], buildTiles = [], buildSelected = null;

  function startBuild() {
    const type = chipValue($("buildType"));
    const cnt = chipValue($("buildCount"));
    let list = ITEMS.slice().filter(function (i) { return i.exEn && i.exEn.trim(); });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { alert("ไม่มีประโยคในเงื่อนไขนี้"); return; }
    buildQueue = list; buildIdx = 0; buildScore = 0; buildMissed = []; buildSelected = null;
    $("buildControls").classList.add("hidden");
    $("buildResult").classList.add("hidden");
    $("buildSession").classList.remove("hidden");
    showBuild();
  }
  function buildWords(s) { return s.trim().split(/\s+/); }
  function showBuild() {
    const i = buildQueue[buildIdx];
    const total = buildQueue.length;
    $("buildCounter").textContent = "ข้อ " + (buildIdx + 1) + " / " + total;
    $("buildProgress").style.width = (buildIdx / total) * 100 + "%";
    buildTiles = shuffle(buildWords(i.exEn));
    renderBuildTiles();
    const fb = $("buildFeedback"); fb.className = "build-feedback hidden"; fb.textContent = "";
    $("buildCheck").disabled = false; $("buildSkip").disabled = false;
  }
  function renderBuildTiles() {
    const box = $("buildTiles");
    box.innerHTML = "";
    buildTiles.forEach(function (w, idx) {
      const t = el("button", "build-tile", w);
      t.type = "button";
      t.dataset.idx = idx;
      t.onclick = function () { selectBuildTile(idx, t); };
      box.appendChild(t);
    });
  }
  function selectBuildTile(idx, tile) {
    if (buildSelected === null) {
      buildSelected = idx; tile.classList.add("selected");
    } else if (buildSelected === idx) {
      tile.classList.remove("selected"); buildSelected = null;
    } else {
      const a = buildSelected, b = idx, tmp = buildTiles[a];
      buildTiles[a] = buildTiles[b]; buildTiles[b] = tmp;
      buildSelected = null;
      renderBuildTiles();
    }
  }
  function checkBuild() {
    if ($("buildCheck").disabled) return;
    const i = buildQueue[buildIdx];
    const correct = buildWords(i.exEn);
    const ok = correct.length === buildTiles.length && correct.every(function (w, k) { return w === buildTiles[k]; });
    const fb = $("buildFeedback");
    if (ok) {
      buildScore++;
      fb.textContent = "✅ ถูกต้อง! " + i.exEn;
      fb.style.color = "var(--good)";
    } else {
      fb.textContent = "❌ ถูกต้องคือ: " + i.exEn;
      fb.style.color = "var(--bad)";
      buildMissed.push({ word: i.word, exEn: i.exEn });
    }
    fb.className = "build-feedback";
    const tilesEl = $("buildTiles");
    Array.prototype.forEach.call(tilesEl.children, function (t, k) {
      t.classList.remove("correct"); t.classList.remove("wrong");
      if (correct[k] !== undefined && buildTiles[k] === correct[k]) t.classList.add("correct");
      else t.classList.add("wrong");
    });
    recordAnswer(i, ok);
    $("buildCheck").disabled = true; $("buildSkip").disabled = true; buildSelected = null;
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
    const r = $("buildResult");
    r.classList.remove("hidden");
    const total = buildQueue.length;
    const pct = total ? Math.round((buildScore / total) * 100) : 0;
    let html = "<h2>🧩 ผลเรียงประโยค</h2><p class=\"big\">" + buildScore + " / " + total + "</p><p>เรียงถูก " + pct + "%</p>";
    if (buildMissed.length) {
      html += "<h3 style=\"margin-top:14px\">ประโยคที่ยังไม่ได้ (" + buildMissed.length + ")</h3><div class=\"missed-list\">";
      buildMissed.forEach(function (m) { html += "<div class=\"missed-item\"><b>" + (m.word || "") + "</b><br>" + m.exEn + "</div>"; });
      html += "</div>";
    } else {
      html += "<p style=\"margin-top:10px\">🎉 เรียงได้ครบทุกประโยค!</p>";
    }
    html += "<button class=\"btn btn-primary\" id=\"buildBack\">กลับหน้าแรก</button>";
    r.innerHTML = html;
    $("buildBack").onclick = function () { showView("home"); };
  }

  /* ============================================================
     CLOZE (sentence completion)
     ============================================================ */
  let clozeQueue = [], clozeIdx = 0, clozeScore = 0, clozeMissed = [], clozeAnswered = 0;

  function startCloze() {
    const type = chipValue($("clozeType"));
    const cnt = chipValue($("clozeCount"));
    let list = ITEMS.slice().filter(function (i) { return i.exEn && i.exEn.trim() && i.word && i.word.trim(); });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { alert("ไม่มีประโยคในเงื่อนไขนี้"); return; }
    clozeQueue = list; clozeIdx = 0; clozeScore = 0; clozeMissed = []; clozeAnswered = 0;
    $("clozeControls").classList.add("hidden");
    $("clozeResult").classList.add("hidden");
    $("clozeSession").classList.remove("hidden");
    showCloze();
  }
  function showCloze() {
    const i = clozeQueue[clozeIdx];
    const total = clozeQueue.length;
    $("clozeCounter").textContent = "ข้อ " + (clozeIdx + 1) + " / " + total;
    $("clozeProgress").style.width = (clozeIdx / total) * 100 + "%";
    const target = i.word;
    const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    $("clozeSentence").textContent = i.exEn.replace(re, "_____");
    const pool = ITEMS.filter(function (x) { return x.type === i.type && x.word && x.word !== target; }).map(function (x) { return x.word; });
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
      fb.textContent = "✅ ถูกต้อง!"; fb.style.color = "var(--good)";
    } else {
      btn.classList.add("wrong");
      opts.forEach(function (o) { if (o.textContent === correct) o.classList.add("correct"); });
      fb.textContent = "❌ คำที่ถูกคือ: " + correct; fb.style.color = "var(--bad)";
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
    const r = $("clozeResult");
    r.classList.remove("hidden");
    const total = clozeQueue.length;
    const pct = total ? Math.round((clozeScore / total) * 100) : 0;
    let html = "<h2>✍️ ผลเติมช่อง</h2><p class=\"big\">" + clozeScore + " / " + total + "</p><p>ถูกต้อง " + pct + "%</p>";
    if (clozeMissed.length) {
      html += "<h3 style=\"margin-top:14px\">คำที่ผิด (" + clozeMissed.length + ")</h3><div class=\"missed-list\">";
      clozeMissed.forEach(function (m) { html += "<div class=\"missed-item\"><b>" + m.word + "</b><br>" + m.exEn + "</div>"; });
      html += "</div>";
    }
    html += "<button class=\"btn btn-primary\" id=\"clozeBack\">กลับหน้าแรก</button>";
    r.innerHTML = html;
    $("clozeBack").onclick = function () { showView("home"); };
  }

  /* ============================================================
     LISTEN & TYPE
     ============================================================ */
  let listenQueue = [], listenIdx = 0, listenScore = 0, listenMissed = [];

  function startListen() {
    const type = chipValue($("listenType"));
    const cnt = chipValue($("listenCount"));
    let list = ITEMS.slice().filter(function (i) { return i.word && i.word.trim(); });
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    list = shuffle(list);
    if (cnt !== "all") { const n = parseInt(cnt, 10); if (list.length > n) list = list.slice(0, n); }
    if (!list.length) { alert("ไม่มีคำในเงื่อนไขนี้"); return; }
    listenQueue = list; listenIdx = 0; listenScore = 0; listenMissed = [];
    $("listenControls").classList.add("hidden");
    $("listenResult").classList.add("hidden");
    $("listenSession").classList.remove("hidden");
    showListen();
  }
  function showListen() {
    const i = listenQueue[listenIdx];
    const total = listenQueue.length;
    $("listenCounter").textContent = "ข้อ " + (listenIdx + 1) + " / " + total;
    $("listenProgress").style.width = (listenIdx / total) * 100 + "%";
    $("listenPos").textContent = i.pos ? "(" + i.pos + ")" : "";
    const inp = $("listenInput");
    inp.value = ""; inp.disabled = false; inp.placeholder = "พิมพ์คำที่ได้ยิน...";
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
      fb.textContent = "✅ ถูกต้อง!"; fb.style.color = "var(--good)";
    } else {
      fb.textContent = "❌ คำที่ถูกคือ: " + i.word; fb.style.color = "var(--bad)";
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
    const r = $("listenResult");
    r.classList.remove("hidden");
    const total = listenQueue.length;
    const pct = total ? Math.round((listenScore / total) * 100) : 0;
    let html = "<h2>🔊 ผลฟังพิมพ์</h2><p class=\"big\">" + listenScore + " / " + total + "</p><p>ถูกต้อง " + pct + "%</p>";
    if (listenMissed.length) {
      html += "<h3 style=\"margin-top:14px\">คำที่ยังไม่ได้ (" + listenMissed.length + ")</h3><div class=\"missed-list\">";
      listenMissed.forEach(function (m) { html += "<div class=\"missed-item\"><b>" + m.word + "</b> — " + (m.th || "") + "</div>"; });
      html += "</div>";
    } else {
      html += "<p style=\"margin-top:10px\">🎉 พิมพ์ถูกทุกคำ!</p>";
    }
    html += "<button class=\"btn btn-primary\" id=\"listenBack\">กลับหน้าแรก</button>";
    r.innerHTML = html;
    $("listenBack").onclick = function () { showView("home"); };
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
    buildSelected = null;
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
  function init() {
    applyTheme();
    initChips();
    renderHome();
    renderSettings();

    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.onclick = function () { showView(b.dataset.view); };
    });
    $("themeToggle").onclick = toggleTheme;
    $("settingsTheme").onclick = toggleTheme;
    $("homeCards").onclick = function () { showView("cards"); };
    $("homeQuiz").onclick = function () { showView("quiz"); };
    $("homeFill").onclick = function () { showView("fill"); };
    $("homeMatch").onclick = function () { showView("match"); };
    $("homeTf").onclick = function () { showView("tf"); };
    $("homeHang").onclick = function () { showView("hang"); };
    $("homeBuild").onclick = function () { showView("build"); };
    $("homeCloze").onclick = function () { showView("cloze"); };
    $("homeListen").onclick = function () { showView("listen"); };

    $("startCards").onclick = startCards;
    $("btnKnow").onclick = function () { cardAnswer(true); };
    $("btnDontKnow").onclick = function () { cardAnswer(false); };

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

    $("browseSearch").oninput = renderBrowse;

    // Plan-day override controls
    function tasksActive() { return $("view-tasks").classList.contains("active"); }
    $("planDayMinus").onclick = function () {
      let base = settings.planDayOverride || computePlanDay();
      base = Math.max(1, base - 1); settings.planDayOverride = base;
      save(K_SETTINGS, settings); renderSettings(); if (tasksActive()) renderTasks();
    };
    $("planDayPlus").onclick = function () {
      let base = settings.planDayOverride || computePlanDay();
      base = base + 1; settings.planDayOverride = base;
      save(K_SETTINGS, settings); renderSettings(); if (tasksActive()) renderTasks();
    };
    $("planDayAuto").onclick = function () {
      delete settings.planDayOverride;
      save(K_SETTINGS, settings); renderSettings(); if (tasksActive()) renderTasks();
    };

    $("resetProgress").onclick = function () {
      if (confirm("รีเซ็ตความคืบหน้าทั้งหมด? (คำศัพท์จะไม่หายไป แต่สถานะการทบทวนจะล้าง)")) {
        progress = {}; reviews = {}; save(K_PROGRESS, progress); save(K_REVIEWS, reviews);
        renderSettings(); renderHome();
        alert("รีเซ็ตเรียบร้อย");
      }
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
