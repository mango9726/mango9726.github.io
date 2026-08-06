

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
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9h18"/><path d="M8 2.5v4M16 2.5v4"/>',
    book: '<path d="M12 6c-2-2-5-2-7 0v13c2-2 5-2 7 0 2-2 5-2 7 0V6c-2-2-5-2-7 0z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    cards: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3.5h11a2 2 0 0 1 2 2v11"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    pen: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    pencil: '<path d="M3 21l3.5-1L18 8.5 15.5 6 4 17.5z"/><path d="M14 6l3 3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6L16 9"/>',
    cross: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    puzzle: '<path d="M9 4.5a1.6 1.6 0 0 1 3.2 0c0 .5-.3 1 0 1.3.4.4 1.8.2 2.3.2h1.7c.6 0 1 .4 1 1v1.8c0 .5-.2 1.9.2 2.3.3.3.8 0 1.3 0a1.6 1.6 0 0 1 0 3.2c-.5 0-1-.3-1.3 0-.4.4-.2 1.8-.2 2.3v1.7c0 .6-.4 1-1 1h-1.8c-.5 0-1.9.2-2.3-.2-.3-.3 0-.8 0-1.3a1.6 1.6 0 0 0-3.2 0c0 .5.3 1 0 1.3-.4.4-1.8.2-2.3.2H4.6c-.6 0-1-.4-1-1v-1.7c0-.5.2-1.9-.2-2.3-.3-.3-.8 0-1.3 0a1.6 1.6 0 0 1 0-3.2c.5 0 1 .3 1.3 0 .4-.4.2-1.8.2-2.3V8c0-.6.4-1 1-1h1.7c.5 0 1.9.2 2.3-.2.3-.3 0-.8 0-1.3z"/>',
    speaker: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.15-1.5l2-1.5-2-3.5-2.3 1a7 7 0 0 0-2.6-1.5L13.45 2h-2.9l-.55 2.5a7 7 0 0 0-2.6 1.5L5 4.5l-2 3.5 2 1.5A7 7 0 0 0 3.6 13l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 2.6 1.5l.55 2.5h2.9l.55-2.5a7 7 0 0 0 2.6-1.5l2.3 1 2-3.5-2-1.5c.1-.5.15-1 .15-1.5z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15l.8 2.2L21.5 18l-2.2.8L18.5 21l-.8-2.2L15.5 18l2.2-.8z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
    flame: '<path d="M12 3c3 3.5 4.5 6 4.5 9a4.5 4.5 0 0 1-9 0c0-1.6.8-2.9 1.7-3.9.2 1 .9 1.7 1.8 1.7 1.2 0 2-1.2 1.3-2.6C11.5 5.7 12 4.2 12 3z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5"/><path d="M12 8h.01"/>',
    volume: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    volumeLow: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>',
    volumeX: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    musicX: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M3 21L21 3"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    bellOff: '<path d="M8.7 3A6 6 0 0 1 19 8c0 7 3 9 3 9H8.4"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M2 2l20 20"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.2"/><path d="M6 9.5h.01M9.5 9.5h.01M13.5 9.5h.01M17 9.5h.01M7.5 13h9"/>',
    brain: '<path d="M12 5.5a2.2 2.2 0 0 0-2.2 2.2 2.2 2.2 0 0 0-2 3.1A2.2 2.2 0 0 0 7.5 16 2.2 2.2 0 0 0 9.6 19c.9 0 1.6-.5 2-1.3h.8c.4.8 1.1 1.3 2 1.3a2.2 2.2 0 0 0 2.1-3 2.2 2.2 0 0 0-1-3.1A2.2 2.2 0 0 0 17 7.7 2.2 2.2 0 0 0 14.8 5.5c-.9 0-1.6.5-2 1.3v.4c-.4-.8-1.1-1.3-2-1.3z"/>',
    upload: '<path d="M12 21V9"/><path d="M7 13l5-5 5 5"/><path d="M4 5h16"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
    file: '<path d="M6 2h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v5h5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7"/><rect x="8" y="13" width="8" height="6"/>',
    bulb: '<path d="M9.5 18h5"/><path d="M10 21h4"/><path d="M8.5 14.5a5.5 5.5 0 1 1 7 0c-.7.6-1 1.2-1 2h-5c0-.8-.3-1.4-1-2z"/>',
    chart: '<path d="M4 20V11"/><path d="M10 20V4"/><path d="M16 20v-6"/><path d="M3 20h18"/>',
    trending: '<path d="M3 17l6-6 4 4 7-7"/><path d="M17 7h4v4"/>',
    link: '<path d="M9.5 14.5l5-5"/><path d="M11 6.5l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 17.5l-1 1a4 4 0 0 1-6-6l1-1"/>',
    heart: '<path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z"/>',
    trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/>',
    party: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 14l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
    frown: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15.5a4 4 0 0 1 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
    alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    leaf: '<path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14a6 6 0 0 1-1-1z"/><path d="M5 19c3-4 6-6 10-7"/>',
    wave: '<path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    quill: '<path d="M4 20c8-2 14-8 16-16C12 4 6 10 4 20z"/><path d="M4 20l3-7"/>',
    shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
    medal: '<circle cx="12" cy="14" r="5"/><path d="M9 3l3 6 3-6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    id: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8h20"/><path d="M6 12h.01M10 12h4"/>',
    provider: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    status: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
    sync: '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'
  };
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
  const STRINGS = {
    th: {
      "app.sub": "เรียนรู้คำศัพท์ภาษาอังกฤษระดับ B1",
      "nav.home": "หน้าแรก", "nav.tasks": "ภารกิจรายวัน", "nav.browse": "รายการคำศัพท์", "nav.stats": "สถิติ", "tasks.heading": "ภารกิจรายวัน — ทบทวนแบบห่างกัน",
      "nav.achievements": "ความสำเร็จ", "nav.games": "เกม", "nav.settings": "ตั้งค่า",
      "nav.cards": "การ์ดทบทวน", "nav.quiz": "ควิซ", "nav.pron": "การออกเสียง",
      "nav.fill": "เติมคำในช่องว่าง", "nav.match": "จับคู่การ์ด", "nav.tf": "ถูก / ผิด",
      "nav.hang": "แขวนคอ", "nav.build": "เรียบเรียงประโยค", "nav.cloze": "เติมช่องว่าง", "nav.listen": "ฟังและพิมพ์",
      "streak.days": "วันติดต่อกัน",
      "profile.title": "ดูความสำเร็จของคุณ",
      "hero.greet": "สวัสดีวันนี้!", "hero.title": "พร้อมที่จะเพิ่มคำศัพท์ไหม?",
      "hero.morning": "สวัสดีตอนเช้า", "hero.afternoon": "สวัสดีตอนบ่าย", "hero.evening": "สวัสดีตอนเย็น",
      "ach.unlocked": "ความสำเร็จปลดล็อก!", "reward.unlocked": "ปลดล็อก:",
      "hero.date": "", "btn.startCards": "เริ่มทบทวนการ์ด", "btn.homeQuiz": "ทำควิซ",
      "stat.total": "คำทั้งหมด", "stat.mastered": "จำได้แล้ว", "stat.due": "ครบกำหนดทบทวน", "stat.days": "วันที่เรียน", "stat.acc": "ความแม่นยำ (7 วัน)",
      "quest.heading": "ภารกิจรายวัน", "quest.claim": "รับรางวัล", "quest.reward": "+50 XP",
      "memory.heading": "ความทรงจำ", "memory.hint": "คำที่คุณเรียนไป รอดอยู่ในสมองกี่เปอร์เซ็นต์ในตอนนี้",
      "memory.retained": "จำได้", "memory.smart": "ทบทวนฉลาด ๆ",
      "boss.heading": "Boss Rush", "boss.hint": "ทวน 12 คำที่คุณจำได้แย่ที่สุด — ตอบภายใน 30 วินาทีต่อคำ ทำได้ Perfect รับโบนัส +25 XP",
      "boss.start": "เริ่ม Boss Rush", "boss.close": "ออก", "boss.ask": "คุณจำความหมายนี้ได้ไหม?",
      "boss.know": "จำได้", "boss.forgot": "ยังไม่แน่", "boss.result": "สรุปผล Boss Rush", "boss.again": "ลองอีกครั้ง", "boss.tag": "Lv 20",
      "chart.study": "กิจกรรมการเรียน", "chart.legendArea": "คำที่เรียน", "chart.legendAcc": "ความแม่นยำ",
      "mastery.heading": "ความเชี่ยวชาญตามประเภท", "heatmap.heading": "แผนที่ความเคลื่อนไหว", "heatmap.hint": "การเรียนรายวันใน 12 สัปดาห์ที่ผ่านมา",
      "learned.heading": "คำที่เรียนไป", "learned.legend": "จำนวนคำสะสมที่เรียนไป",
      "dailyProgress.heading": "ความก้าวหน้ารายวัน",
      "ach.heading": "ความสำเร็จ", "ach.count": "ปลดล็อกแล้ว", "ach.level": "เลเวล", "ach.total": "รวม",
      "ach.hint": "ความสำเร็จจะปลดล็อกเองเมื่อคุณเรียนมากขึ้น — ที่ยังล็อกจะแสดงเป็น ??? จนกว่าจะได้",
      "reward.heading": "รางวัลตามเลเวล", "reward.hint": "เลเวลที่สูงขึ้นจะปลดล็อกธีมสี พลังบูส ฉายา และโหมดพิเศษ — ของที่ล็อกอยู่จะเปิดเมื่อถึงเลเวลนั้น",
      "settings.title": "ตั้งค่า", "settings.dark": "โหมดมืด", "settings.themeColor": "สีธีม",
      "settings.sound": "เสียงและเอฟเฟกต์", "settings.music": "เพลงพื้นหลัง", "settings.pageMusic": "เพลงหน้าเว็บ",
      "settings.gameMusic": "เพลงในเกม", "settings.volume": "ระดับเสียงเพลง", "settings.effects": "ความเข้มของเอฟเฟกต์",
      "settings.day": "วันเรียนปัจจุบัน (ตามแผน)", "settings.autoDay": "ตั้งวันอัตโนมัติจากปฏิทิน",
      "settings.reset": "ล้างความก้าวหน้าทั้งหมด (รีเซ็ตการทบทวน)", "settings.language": "ภาษา",
      "settings.showPlayer": "แสดงเครื่องเล่นเพลง", "settings.reminder": "แจ้งเตือนรายวัน",
      "settings.on": "เปิด", "settings.off": "ปิด", "settings.reminderHint": "แจ้งเตือนขณะแอปเปิดอยู่ (ไม่ต้องมีเซิร์ฟเวอร์) การแจ้งเตือนแบบพื้นหลังจริงต้องใช้ backend",
      "settings.backup": "สำรอง / นำเข้า (ย้ายไปอุปกรณ์อื่น)", "settings.backupHint": "ความก้าวหน้าเก็บในอุปกรณ์นี้เท่านั้น เพื่อย้ายไปอุปกรณ์หรือเบราว์เซอร์อื่น ให้ 'ส่งออก' จากเครื่องเดิมแล้ว 'นำเข้า' ที่เครื่องใหม่",
      "settings.export": "ดาวน์โหลดไฟล์สำรอง", "settings.copy": "คัดลอกโค้ดสำรอง", "settings.import": "นำเข้าจากโค้ดด้านบน",
      "settings.chooseFile": "เลือกไฟล์สำรอง", "settings.importStatus": "", "settings.tip": "💡 เพิ่มคำใหม่ทุกวันโดยบอก Claude ว่า: \"Day N, [หัวข้อหรือ random]\" — จะปรากฏที่นี่อัตโนมัติ",
      "detail.syn": "คำไวพจน์", "detail.ant": "คำตรงข้าม", "detail.examples": "ตัวอย่างประโยค", "detail.note": "หมายเหตุ", "detail.progress": "ความก้าวหน้าของคุณ", "detail.pron": "ฝึกออกเสียง",
      "mq.title": "ภารกิจรายวัน", "mq.claim": "รับ +50 XP",
      "stats.heading": "สถิติ", "stats.weekly": "กราฟความก้าวหน้ารายสัปดาห์", "stats.weak": "จุดที่คุณมักพลาด",
      "stats.review": "ทบทวน", "stats.weakHint": "เรียงจากคำที่จำได้แย่ที่สุด — กดทบทวนเพื่อซ่อม",
      "notif.granted": "เปิดแจ้งเตือนแล้ว จะเตือนคุณทำภารกิจรายวัน", "notif.denied": "ไม่อนุญาตแจ้งเตือน แจ้งเตือนจะไม่ปรากฏ",
      "cfg.review": "ตั้งค่าทบทวน", "cfg.quiz": "ตั้งค่าควิซ", "cfg.pron": "ทดสอบการออกเสียง",
      "cfg.fill": "เติมคำในช่องว่าง", "cfg.match": "จับคู่การ์ด", "cfg.tf": "ควิซถูก / ผิด",
      "cfg.hang": "แขวนคอ", "cfg.build": "เรียบเรียงประโยค", "cfg.cloze": "เติมช่องว่าง (Cloze)", "cfg.listen": "ฟังและพิมพ์",
      "btn.startHang": "เริ่มแขวนคอ", "btn.startBuild": "เริ่มเรียบเรียงประโยค", "btn.startCloze": "เริ่ม Cloze", "btn.startListen": "เริ่มฟังและพิมพ์",
      "zone.wordsLeft": "คำที่เหลือ", "build.hint": "แตะคำด้านล่างเพื่อนำไปไว้ในประโยค · แตะคำในประโยคเพื่อเอาลง",
      "label.type": "ประเภท", "label.day": "วัน", "label.mode": "โหมด", "label.format": "รูปแบบคำถาม", "label.search": "ค้นหา",
      "label.count": "จำนวนคำถาม", "label.direction": "ทิศทาง", "label.pairs": "จำนวนคู่",
      "label.time": "เวลารวม", "btn.startLearning": "เริ่มเรียน", "btn.startQuiz": "เริ่มควิซ",
      "btn.startPron": "เริ่มทดสอบการออกเสียง", "btn.startFill": "เริ่มเติมคำในช่องว่าง",
      "btn.startMatch": "เริ่มจับคู่การ์ด", "btn.startTf": "เริ่มควิซ", "next.question": "คำถามถัดไป →",
      "reveal.tip": "แตะเพื่อเปิดคำแปล · แตะ ℹ️ เพื่อดูรายละเอียด", "correct.answer": "คำตอบที่ถูก: ",
      "memorize": "จดจำการ์ด", "flip.over": "การ์ดจะคว่ำใน", "tap.say": "แตะ แล้วพูดคำนี้",
      "listen.sample": "ฟังตัวอย่าง", "listen.slow": "ฟังช้าๆ", "skip": "ข้าม", "check.answer": "ตรวจคำตอบ",
      "browse.hint": "💡 คลิกการ์ดเพื่อดูรายละเอียดคำ · แตะลำโพงเพื่อฟังเสียง", "search.placeholder": "พิมพ์คำหรือความหมาย…",
      "browse.hideAll": "ซ่อนความหมายทั้งหมด", "browse.showAll": "แสดงความหมายทั้งหมด", "browse.hideWord": "ซ่อนความหมายคำนี้", "browse.showWord": "แสดงความหมายคำนี้",
      "tasks.hint": "ระบบจะนำคำของวันก่อนๆ กลับมาทบทวนในช่วงห่างที่เพิ่มขึ้น (เช่น วันที่ 1 กลับมาวันที่ 2, 4, 7, 14 …) ยิ่งคุณทบทวนบ่อย คำจะกลับมาห่างขึ้น จนจำได้แน่น",
      "tasks.today": "", "grade.again": "ยังไม่ไหว", "grade.hard": "ยาก", "grade.good": "ดี", "grade.easy": "ง่าย",
      "stats.weakEmpty": "ยังไม่มีจุดอ่อน — เรียนต่อไป!",
      "lu.kicker": "เลเวลอัพ!", "lu.title": "เลเวลอัพ!", "lu.sub": "แข็งแกร่งขึ้นทุกวัน — คำศัพท์ของคุณกำลังเลเวลอัพ", "lu.continue": "ต่อไป", "lu.rewards": "ปลดล็อกรางวัล", "footer.built": "สร้างเพื่อการเรียน",
      "info.learned": "คำที่เรียนไป:", "info.mastered": "จำได้แล้ว (กล่อง 4+):", "info.days": "จำนวนวันในระบบ:", "info.total": "คำศัพท์ทั้งหมด:",
      "settings.toggleTheme": "สลับธีม",
      "lang.th": "ไทย", "lang.en": "อังกฤษ",
      "auth.loginTitle": "เข้าสู่ระบบ", "auth.loginSub": "เข้าสู่ระบบเพื่อบันทึกความคืบหน้าของคุณ",
      "auth.loginSubStatic": "เข้าสู่ระบบเพื่อบันทึกความคืบหน้า (เก็บในเครื่องนี้)",
      "auth.registerTitle": "สมัครบัญชีใหม่", "auth.registerSub": "สร้างบัญชีเพื่อบันทึกความคืบหน้าและใช้ได้ทุกเครื่อง",
      "auth.registerSubStatic": "สร้างบัญชีเพื่อบันทึกความคืบหน้า (เก็บในเครื่องนี้)",
      "auth.username": "Username", "auth.password": "Password",
      "auth.usernamePlaceholder": "อย่างน้อย 3 ตัวอักษร", "auth.passwordPlaceholder": "อย่างน้อย 4 ตัวอักษร",
      "auth.loginButton": "เข้าสู่ระบบ", "auth.registerButton": "สมัครบัญชี",
      "auth.noAccount": "ยังไม่มีบัญชี?", "auth.hasAccount": "มีบัญชีแล้ว?",
      "auth.registerLink": "สมัครบัญชีใหม่", "auth.loginLink": "เข้าสู่ระบบ",
      "auth.fillBoth": "กรุณากรอก username และ password", "auth.processing": "กำลังดำเนินการ...",
      "auth.remember": "จดจำการเข้าสู่ระบบ (เก็บไว้ในเครื่องนี้)",
      "auth.googleButton": "เข้าสู่ระบบด้วย Google", "auth.orDivider": "หรือ",
      "auth.redirectingToGoogle": "กำลังไปที่หน้า Google...",
      "auth.googleAccountCreated": "บัญชีถูกสร้างแล้ว!",
      "auth.googleCredentialHint": "บัญชีใหม่ถูกสร้างขึ้นโดยเชื่อมกับ Google ของคุณ บันทึกรหัสผ่านนี้ไว้เพื่อเข้าสู่ระบบด้วยวิธีปกติ:",
      "auth.googlePasswordWarning": "⚠️ รหัสผ่านนี้แสดงเพียงครั้งเดียว — กรุณาบันทึกไว้หรือเปลี่ยนรหัสผ่านหลังจากเข้าสู่ระบบครั้งแรก",
      "auth.loginSubFirebase": "เข้าสู่ระบบเพื่อ sync ข้ามเครื่อง (Firebase)", "auth.registerSubFirebase": "สร้างบัญชีเพื่อ sync ข้ามเครื่อง (Firebase)",
      "auth.syncFirebase": "Firebase (sync ข้ามเครื่อง)", "auth.provider": "ผู้ให้บริการ",
      "auth.member": "สมาชิก Vocab Trainer", "auth.userId": "User ID",
      "auth.status": "สถานะ", "auth.sync": "การซิงค์ข้อมูล", "auth.syncAuto": "อัตโนมัติ", "auth.syncLocal": "เก็บในเครื่องนี้",
      "auth.logout": "ออกจากระบบ", "auth.logoutConfirm": "ออกจากระบบ?\nข้อมูลในเครื่องนี้จะยังอยู่ แต่จะไม่ sync กับ server อีก",
      "auth.guestHint": "เข้าสู่ระบบเพื่อบันทึกความคืบหน้าและซิงค์ข้อมูล",
      "auth.signedInAs": "ล็อกอินแล้วในชื่อ {user}",
      "auth.forgotPassword": "ลืมรหัสผ่าน?",
      "auth.terms": "ข้อกำหนดการใช้งาน", "auth.privacy": "นโยบายความเป็นส่วนตัว", "auth.help": "ความช่วยเหลือ",
      "auth.termsMsg": "หน้าข้อกำหนดการใช้งาน — กำลังเตรียมการ", "auth.privacyMsg": "หน้านโยบายความเป็นส่วนตัว — กำลังเตรียมการ", "auth.helpMsg": "หน้าความช่วยเหลือ — กำลังเตรียมการ",
      "auth.socialNotSupported": "การเข้าสู่ระบบผ่านโซเชียลต้องการการเชื่อมต่อ Firebase",
      "auth.enterEmailFirst": "กรุณากรอก username หรืออีเมลก่อน",
      "auth.resetSent": "หากบัญชีนี้มีอยู่ จะส่งลิงก์รีเซ็ตรหัสผ่านไปแล้ว",
      "auth.sending": "กำลังส่ง...",
      "auth.level": "เลเวล", "auth.wordsLearned": "คำศัพท์ที่เรียน",
      "auth.provider": "ผู้ให้บริการ", "auth.status": "สถานะ", "auth.sync": "การซิงค์ข้อมูล",
      "settings.close": "ปิด"
    },
    en: {
      "app.sub": "Learn B1-level English vocabulary",
      "nav.home": "Home", "nav.tasks": "Daily Tasks", "nav.browse": "Word List", "nav.stats": "Statistics", "tasks.heading": "Daily Tasks — Spaced Review",
      "nav.achievements": "Achievements", "nav.games": "Games", "nav.settings": "Settings",
      "nav.cards": "Flashcards", "nav.quiz": "Quiz", "nav.pron": "Pronunciation",
      "nav.fill": "Fill-in-the-Blank", "nav.match": "Card Match", "nav.tf": "True / False",
      "nav.hang": "Hangman", "nav.build": "Sentence Builder", "nav.cloze": "Cloze", "nav.listen": "Listen & Type",
      "streak.days": "day streak",
      "profile.title": "View your achievements",
      "hero.greet": "Good day!", "hero.title": "Ready to grow your vocabulary?",
      "hero.morning": "Good morning", "hero.afternoon": "Good afternoon", "hero.evening": "Good evening",
      "ach.unlocked": "Achievement Unlocked!", "reward.unlocked": "Unlocked:",
      "hero.date": "", "btn.startCards": "Start Flashcard Review", "btn.homeQuiz": "Take a Quiz",
      "stat.total": "Total words", "stat.mastered": "Mastered", "stat.due": "Due for review", "stat.days": "Days studied", "stat.acc": "Accuracy (7d)",
      "quest.heading": "Daily Quests", "quest.claim": "Claim Reward", "quest.reward": "+50 XP",
      "memory.heading": "Memory Strength", "memory.hint": "How much you're retaining right now, across the words you've learned.",
      "memory.retained": "retained", "memory.smart": "Smart Review",
      "boss.heading": "Boss Rush", "boss.hint": "Review 12 of your weakest words — answer within 30s each; a Perfect run earns a +25 XP bonus",
      "boss.start": "Start Boss Rush", "boss.close": "Close", "boss.ask": "Do you remember this meaning?",
      "boss.know": "I remember", "boss.forgot": "Not sure", "boss.result": "Boss Rush Results", "boss.again": "Try Again", "boss.tag": "Lv 20",
      "chart.study": "Study Activity", "chart.legendArea": "Words studied", "chart.legendAcc": "Accuracy",
      "mastery.heading": "Mastery by Type", "heatmap.heading": "Activity Heatmap", "heatmap.hint": "Your daily study over the last 12 weeks",
      "learned.heading": "Words Learned", "learned.legend": "Cumulative words learned",
      "dailyProgress.heading": "Daily Progress",
      "ach.heading": "Achievements", "ach.count": "Unlocked", "ach.level": "Level", "ach.total": "Total",
      "ach.hint": "Achievements unlock automatically as you study more — locked ones show as ??? until earned",
      "reward.heading": "Level Rewards", "reward.hint": "Higher levels unlock color themes, XP boosts, titles, and special modes — locked ones open once you reach that level",
      "settings.title": "Settings", "settings.dark": "Dark mode", "settings.themeColor": "Theme color",
      "settings.sound": "Sound & effects", "settings.music": "Background music", "settings.pageMusic": "Page music",
      "settings.gameMusic": "Game music", "settings.volume": "Music volume", "settings.effects": "Effects intensity", "settings.reduced": "Reduced",
      "settings.day": "Current study day (per plan)", "settings.autoDay": "Auto-set day from calendar",
      "settings.reset": "Clear all progress (reset reviews)", "settings.language": "Language",
      "settings.showPlayer": "Show music player", "settings.reminder": "Daily reminder",
      "settings.on": "On", "settings.off": "Off", "settings.reminderHint": "Fires while the app is open (no server needed). True background push would require a backend.",
      "settings.backup": "Backup / Restore (move to another device)", "settings.backupHint": "Progress is stored only on this device. To move to another device or browser, 'Export' from the old one and 'Import' on the new one.",
      "settings.export": "Download Backup File", "settings.copy": "Copy Backup Code", "settings.import": "Import from Code Above",
      "settings.chooseFile": "Choose Backup File", "settings.importStatus": "", "settings.tip": "💡 Add new words daily by telling Claude: \"Day N, [topic or random]\" — they'll appear here automatically",
      "detail.syn": "Synonyms", "detail.ant": "Antonyms", "detail.examples": "Example sentences", "detail.note": "Note", "detail.progress": "Your Progress", "detail.pron": "Pronunciation Practice",
      "mq.title": "Daily Quests", "mq.claim": "Claim +50 XP",
      "stats.heading": "Statistics", "stats.weekly": "Weekly progress", "stats.weak": "Weak spots",
      "stats.review": "Review", "stats.weakHint": "Sorted weakest-first — tap Review to drill them",
      "notif.granted": "Notifications enabled — we'll remind you to do your Daily Quests", "notif.denied": "Notifications blocked — reminders won't appear",
      "cfg.review": "Review Settings", "cfg.quiz": "Quiz Settings", "cfg.pron": "Pronunciation Test",
      "cfg.fill": "Fill-in-the-Blank", "cfg.match": "Card Match", "cfg.tf": "True / False Quiz",
      "cfg.hang": "Hangman", "cfg.build": "Sentence Builder", "cfg.cloze": "Cloze (Fill in the Blank)", "cfg.listen": "Listen & Type",
      "btn.startHang": "Start Hangman", "btn.startBuild": "Start Sentence Builder", "btn.startCloze": "Start Cloze", "btn.startListen": "Start Listen & Type",
      "zone.wordsLeft": "Words left", "build.hint": "Tap a word below to place it in the sentence · tap a word in the sentence to take it back down",
      "label.type": "Type", "label.day": "Day", "label.mode": "Mode", "label.format": "Question format", "label.search": "Search",
      "label.count": "Number of questions", "label.direction": "Direction", "label.pairs": "Number of pairs",
      "label.time": "Total time", "btn.startLearning": "Start Learning", "btn.startQuiz": "Start Quiz",
      "btn.startPron": "Start Pronunciation Test", "btn.startFill": "Start Fill-in-the-Blank",
      "btn.startMatch": "Start Card Match", "btn.startTf": "Start Quiz", "next.question": "Next Question →",
      "reveal.tip": "Tap to reveal the translation · tap ℹ️ for details", "correct.answer": "Correct answer: ",
      "memorize": "Memorize the cards", "flip.over": "They'll flip over in", "tap.say": "Tap, then say this word",
      "listen.sample": "Listen to sample", "listen.slow": "Listen slowly", "skip": "Skip", "check.answer": "Check Answer",
      "browse.hint": "💡 Click a card to see word details · tap the speaker to hear it", "search.placeholder": "Type a word or its meaning…",
      "browse.hideAll": "Hide all meanings", "browse.showAll": "Show all meanings", "browse.hideWord": "Hide this word's meaning", "browse.showWord": "Show this word's meaning",
      "tasks.hint": "The system brings back previous days' words at increasing intervals (e.g., Day 1 recurs on days 2, 4, 7, 14 …). The more often you review, the less frequently a word returns, until it's locked in.",
      "tasks.today": "", "grade.again": "Again", "grade.hard": "Hard", "grade.good": "Good", "grade.easy": "Easy",
      "stats.weakEmpty": "No weak spots yet — keep studying!",
      "lu.kicker": "LEVEL UP!", "lu.title": "Level Up!", "lu.sub": "Getting stronger every day — your vocabulary is leveling up", "lu.continue": "Continue", "lu.rewards": "Rewards Unlocked", "footer.built": "Built for learning",
      "info.learned": "Words learned:", "info.mastered": "Mastered (box 4+):", "info.days": "Total days in system:", "info.total": "Total vocabulary:",
      "settings.toggleTheme": "Toggle Theme",
      "lang.th": "ไทย", "lang.en": "English",
      "auth.loginTitle": "Login", "auth.loginSub": "Sign in to save your progress",
      "auth.loginSubStatic": "Sign in to save your progress (stored on this device)",
      "auth.registerTitle": "Create Account", "auth.registerSub": "Create an account to save progress and use across devices",
      "auth.registerSubStatic": "Create an account to save progress (stored on this device)",
      "auth.username": "Username", "auth.password": "Password",
      "auth.usernamePlaceholder": "At least 3 characters", "auth.passwordPlaceholder": "At least 4 characters",
      "auth.loginButton": "Login", "auth.registerButton": "Sign Up",
      "auth.noAccount": "Don't have an account?", "auth.hasAccount": "Already have an account?",
      "auth.registerLink": "Sign up", "auth.loginLink": "Login",
      "auth.fillBoth": "Please enter username and password", "auth.processing": "Processing...",
      "auth.remember": "Remember me (keep me logged in on this device)",
      "auth.googleButton": "Sign in with Google", "auth.orDivider": "or",
      "auth.redirectingToGoogle": "Redirecting to Google...",
      "auth.googleAccountCreated": "Account created!",
      "auth.googleCredentialHint": "A new account was created linked to your Google. Save this password for normal login:",
      "auth.googlePasswordWarning": "⚠️ This password is shown only once — please save it or change it after your first login",
      "auth.loginSubFirebase": "Sign in to sync across devices (Firebase)", "auth.registerSubFirebase": "Create an account to sync across devices (Firebase)",
      "auth.syncFirebase": "Firebase (cross-device sync)", "auth.provider": "Provider",
      "auth.member": "Vocab Trainer Member", "auth.userId": "User ID",
      "auth.status": "Status", "auth.sync": "Data Sync", "auth.syncAuto": "Automatic", "auth.syncLocal": "This device only",
      "auth.logout": "Log Out", "auth.logoutConfirm": "Log out?\nLocal data will remain but won't sync with the server anymore",
      "auth.guestHint": "Sign in to save progress and sync across devices",
      "auth.signedInAs": "Signed in as {user}",
      "auth.forgotPassword": "Forgot password?",
      "auth.terms": "Terms", "auth.privacy": "Privacy", "auth.help": "Help",
      "auth.termsMsg": "Terms of Service — coming soon", "auth.privacyMsg": "Privacy Policy — coming soon", "auth.helpMsg": "Help Center — coming soon",
      "auth.socialNotSupported": "Social login requires Firebase configuration",
      "auth.enterEmailFirst": "Enter your username or email first",
      "auth.resetSent": "If that account exists, a reset link has been sent.",
      "auth.sending": "Sending...",
      "auth.level": "Level", "auth.wordsLearned": "Words Learned",
      "auth.provider": "Provider", "auth.status": "Status", "auth.sync": "Data Sync",
      "settings.close": "Close"
    }
  };
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
          const raw = localStorage.getItem(lsKey);
          if (raw == null) return;
          chain = chain.then(function () {
            return decryptString(raw).then(function (plain) {
              cache[lsKey] = plain;
            }, function () {
              cache[lsKey] = raw; // legacy plaintext → re-encrypted on flush
            });
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
    const ready = bootstrap();
    return { get ready() { return ready; }, get available() { return available; }, load: load, save: save, flush: flush };
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

  let progress, settings, reviews, history, learned, game;
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
    if (settings.showMiniPlayer == null) settings.showMiniPlayer = true;
    if (!settings.reminder) settings.reminder = { on: false, time: "20:00" };
    if (settings.hideAllMeanings == null) settings.hideAllMeanings = false;
    if (!settings.hiddenMeanings || typeof settings.hiddenMeanings !== "object") settings.hiddenMeanings = {};
    // Gate the mini-player boot flag on the user's preference (read by mini-player.js init).
    window.MINI_PLAYER_ENABLED = settings.showMiniPlayer !== false;
    reviews = load(K_REVIEWS, {});
    history = load(K_HISTORY, {});
    learned = load(K_LEARNED, {});
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
  function getAllItems() {
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
    return items;
  }

  let ITEMS = getAllItems();
  function itemsForDay(dayNum) { return ITEMS.filter(function (i) { return String(i.day) === String(dayNum); }); }

  /* ---------- Progress (per-item SM-2 spaced repetition) ----------
     Each item stores: ease (>=1.3), interval (days), reps, lapses, due,
     lastReview, seen. Legacy Leitner progress ({box,...}) is migrated on load. */
  const DEFAULT_EASE = 2.5;
  const MIN_EASE = 1.3;
  const GRADE = { again: 1, hard: 3, good: 4, easy: 5 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function daysSince(dateStr) {
    if (!dateStr) return 0;
    const diff = Math.floor((new Date(todayStr() + "T00:00:00") - new Date(dateStr + "T00:00:00")) / 86400000);
    return diff;
  }

  function getP(id) {
    return progress[id] || { ease: DEFAULT_EASE, interval: 0, reps: 0, lapses: 0, due: todayStr(), lastReview: "", seen: 0 };
  }
  function isDue(item) { return getP(item.id).due <= todayStr(); }
  function isMastered(item) { const p = getP(item.id); return (p.interval || 0) >= 21 || (p.reps || 0) >= 4; }

  /** Migrate legacy Leitner {box} records to the SM-2 shape once. */
  function migrateProgress() {
    let changed = false;
    ITEMS.forEach(function (it) {
      const p = progress[it.id];
      if (!p || p.box == null || p.ease != null) return;
      const box = clamp(p.box || 1, 1, 5);
      progress[it.id] = {
        ease: DEFAULT_EASE,
        interval: BOX_INTERVAL[box] || 0,
        reps: Math.max(0, box - 1),
        lapses: p.lapses || 0,
        due: p.due || todayStr(),
        lastReview: p.due ? addDays(p.due, -(BOX_INTERVAL[box] || 0)) : "",
        seen: p.seen || 0
      };
      changed = true;
    });
    if (changed) save(K_PROGRESS, progress);
  }

  /** Predicted retention right now (0-100%) via a simple Ebbinghaus curve. */
  function predictRetention(item) {
    const p = getP(item.id);
    const iv = p.interval || 0;
    if (iv <= 0) return 0;
    const elapsed = Math.max(0, daysSince(p.lastReview || addDays(p.due, -iv)));
    const r = Math.exp(-elapsed / (iv * 1.3));
    return Math.round(clamp(r, 0, 1) * 100);
  }

  /** SM-2 grade: q in {Again=1, Hard=3, Good=4, Easy=5}. */
  function gradeAnswer(item, q) {
    if (!item) return;
    const p = getP(item.id);
    const wasNew = !p.seen;
    const wasMasteredBefore = isMastered(item);
    p.seen = (p.seen || 0) + 1;
    q = clamp(q | 0, 0, 5);
    if (q < 3) {
      p.reps = 0;
      p.interval = 0;
      p.lapses = (p.lapses || 0) + 1;
      p.ease = Math.max(MIN_EASE, (p.ease || DEFAULT_EASE) - 0.2);
      p.due = todayStr();
    } else {
      if (p.reps == null || p.reps === 0) p.interval = 1;
      else if (p.reps === 1) p.interval = 6;
      else p.interval = Math.round((p.interval || 1) * (p.ease || DEFAULT_EASE));
      if (p.interval < 1) p.interval = 1;
      p.ease = Math.max(MIN_EASE, (p.ease || DEFAULT_EASE) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
      p.reps = (p.reps || 0) + 1;
      p.lastReview = todayStr();
      p.due = addDays(todayStr(), p.interval);
    }
    progress[item.id] = p;
    save(K_PROGRESS, progress);
    const t = todayStr();
    if (!history[t]) history[t] = { answered: 0, correct: 0 };
    history[t].answered++;
    if (q >= 3) history[t].correct++;
    save(K_HISTORY, history);
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
    const ease = p.ease || DEFAULT_EASE;
    let iv;
    if (q < 3) return 0;
    if (p.reps == null || p.reps === 0) iv = 1;
    else if (p.reps === 1) iv = 6;
    else iv = Math.round((p.interval || 1) * ease);
    if (iv < 1) iv = 1;
    if (q === GRADE.hard) iv = Math.max(1, Math.round(iv * 0.85));
    else if (q === GRADE.easy) iv = Math.round(iv * 1.3) + 1;
    return iv;
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
    s.streak = (s.last === y) ? (s.streak + 1) : 1;
    s.last = t;
    save(K_STREAK, s);
  }

  /* ============================================================
     GAMIFICATION — XP · Level · Rank · Achievements
     ต่อยอดจาก streak / history / learned / progress ที่มีอยู่แล้ว
     ไม่เพิ่ม dependency: เก็บใน localStorage ผ่าน K_GAME
     ============================================================ */
  const K_GAME = "vocab_game_v1";
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
    elc.innerHTML = '<span class="combo-flame">🔥</span><span class="combo-num">Combo ×' + combo + '</span><span class="combo-mult">×' + multTxt + ' XP</span>';
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
    return 1 + b;
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
    game.xp = (game.xp || 0) + Math.round(n * currentXpBoost());
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
        box.innerHTML = '<p class="lu-rw-head">🎁 ' + t("lu.rewards") + "</p>" + gained.map(function (r) {
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
      if (pct > 0) { boostEl.textContent = "✦ +" + pct + "% XP"; boostEl.hidden = false; }
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
      const swatch = (r.type === "theme" && ACCENT_SWATCH[r.accent])
        ? '<span class="reward-swatch">' + ACCENT_SWATCH[r.accent].map(function (c) {
            return '<i class="rw-dot" data-bg="' + c + '"></i>';
          }).join("") + "</span>"
        : "";
      const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2"/><rect x="4.5" y="10" width="15" height="10" rx="2.2"/><circle cx="12" cy="15" r="1.6"/></svg>';
      return '<div class="reward-card ' + (got ? "unlocked" : "locked") + '">' +
        '<div class="reward-ico">' + (got ? svgIcon(r.icon, "ico") : '<span class="ico">' + LOCK + "</span>") + "</div>" +
        '<div class="reward-lvl">Lv ' + r.level + "</div>" +
        '<div class="reward-name">' + (got ? r.name : "???") + "</div>" +
        '<div class="reward-desc">' + (got ? r.desc : "Reach level " + r.level + " to unlock") + "</div>" +
        swatch +
        "</div>";
    }).join("");
    applyInlineStyles(rail);
  }

  /* --- Toast แจ้งว่ารางวัลปลดล็อก (แสดงทีละรายการ) --- */
  function rewardToast(r) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast reward-toast";
    el.innerHTML = '<span class="toast-ico">' + svgIcon(r.icon, "ico sm") + "</span>" +
      '<span class="toast-msg"><b>🎁 ' + t("reward.unlocked") + '</b> ' + r.name + "</span>";
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
    renderWeakSpots();
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
    const weak = seen.map(function (i) { return { i: i, r: predictRetention(i) }; })
      .sort(function (a, b) { return a.r - b.r; }).slice(0, 12);
    if (!weak.length) {
      box.innerHTML = '<p class="hint">' + t("stats.weakEmpty") + "</p>";
      return;
    }
    box.innerHTML = weak.map(function (w) {
      const badge = w.i.type === "vocab" ? "VOCAB" : w.i.type === "collocation" ? "COLLOCATION" : "IDIOM";
      return '<div class="weak-row">' +
        '<span class="weak-badge">' + badge + "</span>" +
        '<span class="weak-word">' + esc(w.i.word) + "</span>" +
        '<span class="weak-pct" data-color="hsl(' + Math.round(w.r / 100 * 130) + ',68%,46%)">' + w.r + "%</span>" +
        "</div>";
    }).join("") +
      '<button class="btn btn-primary weak-review" id="weakReview">' + t("stats.review") + "</button>";
    applyInlineStyles(box);
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
    if (rw) rw.textContent = game.questsClaimed ? "Claimed ✓" : "+" + QUEST_REWARD + " XP";
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
    awardXp(15, "daily-task"); // ทำ Daily Task เสร็จ +15 XP
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
  function soundOn() { return settings.sound !== false; }
  // Effects intensity (user setting, layered on top of the OS reduced-motion flag):
  //  fxSpectacle -> confetti + glow; fxSubtle -> ring flash + ripple + count-up + chart line.
  function fxSpectacle() { return !REDUCED_MOTION && settings.effects === "full"; }
  function fxSubtle() { return !REDUCED_MOTION && settings.effects !== "off"; }

  /* --- Web Audio chime (no audio files needed) --- */
  let audioCtx = null;
  function playTone(kind) {
    if (!soundOn()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
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
      // Sound only for actual buttons; ripple still fires on every interactive element
      if (soundOn() && el.matches("button, .btn")) playClick();
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
  function toast(msg, type) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast " + (type || "info");
    t.textContent = msg;
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
    var gameViews = ["cards","quiz","pron","fill","match","tf","hang","build","cloze","listen"];
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
    listenCount: [["10", "10"], ["20", "20"], ["all", "All"]]
  };
  const CHIP_DEFAULT = { cardFilterType: "all", cardMode: "all", quizMode: "meaning", quizCount: "10", quizType: "all", browseType: "all", pronCount: "10", pronType: "vocab", fillDir: "th2en", fillType: "all", fillCount: "10", matchType: "all", matchSize: "8", tfType: "all", tfCount: "10", tfTime: "60", hangType: "vocab", hangCount: "10", buildType: "all", buildCount: "10", clozeType: "all", clozeCount: "10", listenType: "all", listenCount: "10" };
  function populateDayChips() {
    const days = Object.keys(VOCAB_DAYS).sort((a, b) => a - b);
    [["cardFilterDay", "all"], ["browseDay", "all"]].forEach(function (p) {
      const c = $(p[0]); if (!c) return;
      const cur = chipValue(c) || p[1];
      const opts = [{ value: "all", label: "Every day" }].concat(
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
  function buildHeatmap() {
    const box = $("heatmap");
    if (!box) return;
    const series = getHistorySeries(84); // ~12 weeks
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
    const day = chipValue($("cardFilterDay"));
    const mode = chipValue($("cardMode"));
    let list = ITEMS.slice();
    if (type !== "all") list = list.filter(function (i) { return i.type === type; });
    if (day !== "all") list = list.filter(function (i) { return String(i.day) === day; });
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
    if (item.note) { note.textContent = "⚠️ " + item.note; note.classList.remove("hidden"); }
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
    let list = ITEMS.slice();
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
    launchQuiz(items, "sentence", function () { recordReview(dayNum); }, retView || "tasks", true);
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
      distractItems = pickDistractors(item, ITEMS, 14).filter(function (i) { return i.th && i.th.trim() && i.th !== item.th; });
      if (distractItems.length < 3) distractItems = ITEMS.filter(function (i) { return i.th && i.th.trim() && i.th !== item.th; });
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
    $("tasksToday").textContent = "Today is Day " + cp + " of the 120-day plan";
    const list = $("tasksList");
    list.innerHTML = "";

    // งานใหม่: ถ้ามีคำสำหรับวันนี้
    if (VOCAB_DAYS[String(cp)]) {
      const nc = taskCard(
        svgIcon("sparkle") + "Learn new words",
        "Day " + cp + " · " + (VOCAB_DAYS[String(cp)].topic || ""),
        "New-word quiz",
        function () { launchQuizForDay(cp, "tasks"); },
        "Word count: " + itemsForDay(cp).length + " items"
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
        const meta = "Reviewed " + (r.done || 0) + " times · Next: Day " + r.nextDue;
        const rc = taskCard(
          svgIcon("refresh") + "Review",
          "Day " + d + " · " + (VOCAB_DAYS[String(d)].topic || ""),
          "Take a quiz",
          function () { launchQuizForDay(d, "tasks"); },
          meta
        );
        rc.style.animationDelay = (k * 60) + "ms"; k++;
        list.appendChild(rc);
      }
    });

    if (dueCount === 0 && !VOCAB_DAYS[String(cp)]) {
      list.appendChild(el("p", "hint", "Nothing to do today ✅ If you haven't added words for Day " + cp + " yet, tell Claude: \"Day " + cp + ", [topic or random]\" to add new words"));
    } else if (dueCount === 0) {
      list.appendChild(el("p", "hint", "Nothing to review today — you've finished the new words. Take a break! 🎉"));
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

    const tb = $("browseToggleMeanings");
    if (tb) tb.innerHTML = svgIcon(settings.hideAllMeanings ? "eyeOff" : "eye") + " <span>" + t(settings.hideAllMeanings ? "browse.showAll" : "browse.hideAll") + "</span>";

    const box = $("browseList");
    if (!list.length) {
      box.innerHTML = '<p class="hint">' + svgIcon("info", "ico sm") + " No words match your search</p>";
      return;
    }
    const parts = [];
    list.forEach(function (i, idx) {
      const tlabel = i.type === "vocab" ? "VOCAB" : i.type === "collocation" ? "COLLOC" : "IDIOM";
      const tcls = i.type === "vocab" ? "t-vocab" : i.type === "collocation" ? "t-collocation" : "t-idiom";
      const ticon = i.type === "vocab" ? "book" : i.type === "collocation" ? "link" : "bulb";
      const hidden = settings.hideAllMeanings || !!settings.hiddenMeanings[i.id];
      parts.push(
        '<div class="browse-card" style="animation-delay:' + (idx * 35) + 'ms" data-browse-id="' + i.id + '">' +
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
    box.innerHTML = parts.join("");
    // Event delegation — one listener instead of per-card closures
    box.onclick = function (e) {
      const card = e.target.closest("[data-browse-id]");
      if (!card) return;
      const item = ITEMS.find(function (it) { return it.id === card.dataset.browseId; });
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
        renderBrowse();
      }
      const speakBtn = e.target.closest("[data-browse-speak]");
      if (speakBtn) { e.stopPropagation(); const it = ITEMS.find(function (x) { return x.id === speakBtn.dataset.browseSpeak; }); if (it) speak(it.word); }
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
    if (br) br.textContent = perfect ? "💥 ชนะบอส! +25 XP โบนัส" : "บอสพ่ายแพ้ไปแล้ว — มาอีกครั้ง!";
    if (pc) {
      pc.classList.remove("hidden");
      const fb = $("bossFeedback");
      if (fb) fb.textContent = perfect ? "🔥 Perfect run! ทุกคำตอบถูกภายในเวลา" : "เยี่ยม! ทวนคำอ่อนที่สุดไป " + total + " คำ"; fb.className = "boss-feedback " + (perfect ? "ok" : "");
    }
  }
  function closeBossRush() {
    if (bossTimer) { clearInterval(bossTimer); bossTimer = null; }
    bossActive = false;
    showView("home");
  }

  function renderSettings() {
    $("settingsTitle").innerHTML = svgIcon("gear") + t("settings.title");
    const ids = Object.keys(progress);
    let learned = 0, mastered = 0;
    ids.forEach(function (id) { if (progress[id].box >= 2) learned++; if (progress[id].box >= 4) mastered++; });
    $("settingsInfo").textContent =
      t("info.learned") + " " + learned + " words\n" +
      t("info.mastered") + " " + mastered + " words\n" +
      t("info.days") + " " + Object.keys(VOCAB_DAYS).length + " days\n" +
      t("info.total") + " " + ITEMS.length + " entries";
    $("planDayLabel").textContent = "Day " + (settings.planDayOverride || computePlanDay());
    const sb = $("settingsSound");
    if (sb) sb.innerHTML = (soundOn() ? svgIcon("volume") : svgIcon("volumeX")) + " " + (soundOn() ? t("settings.on") : t("settings.off"));
    const pb = $("settingsPlayer");
    if (pb) pb.innerHTML = (settings.showMiniPlayer ? svgIcon("music") : svgIcon("musicX")) + " " + (settings.showMiniPlayer ? t("settings.on") : t("settings.off"));
    const mb = $("settingsMusic");
    if (mb) mb.innerHTML = (settings.music ? svgIcon("volume") : svgIcon("volumeX")) + " " + (settings.music ? t("settings.on") : t("settings.off"));
    const rb = $("settingsReminder");
    if (rb) rb.innerHTML = (settings.reminder.on ? svgIcon("bell") : svgIcon("bellOff")) + " " + (settings.reminder.on ? t("settings.on") : t("settings.off"));
    const rt = $("reminderTime");
    if (rt) rt.value = settings.reminder.time || "20:00";
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
    // Effects intensity: Off / Reduced / Full (gates the confetti + glow spectacle).
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
    const cur = document.querySelector(".view.active");
    const name = cur ? cur.id.replace("view-", "") : "home";
    if (name === "home") renderHome();
    else if (name === "browse") renderBrowse();
    else if (name === "tasks") renderTasks();
    else if (name === "achievements") renderAchievements();
    else if (name === "stats") renderStats();
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
      else if (window.MiniMusicPlayer) window.MiniMusicPlayer.init({ autoStart: true });
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
        reviews: load(K_REVIEWS, {})
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
      catch (err) { backupStatus("❌ This file is not a valid backup", false); return; }
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
    if (item.note) { note.textContent = "⚠️ " + item.note; note.classList.remove("hidden"); }
    else note.classList.add("hidden");

    // progress + memory strength
    const p = getP(item.id);
    const ret = predictRetention(item);
    const level = isMastered(item) ? "Mastered" : ((p.reps || 0) > 0 ? "Learning" : "New");
    $("detailProgress").innerHTML =
      "<div class=\"dp-label\">" + level + " · Memory strength <b>" + ret + "%</b></div>" +
      "<div class=\"dp-bar\"><div class=\"dp-fill\" data-w=\"" + ret + "%\"></div></div>";
    applyInlineStyles($("detailProgress"));

    // meta
    const nextDue = p.due && p.due > todayStr() ? p.due : "Ready to review";
    $("detailMeta").innerHTML =
      "Seen: <b>" + (p.seen || 0) + "</b> · Streak: <b>" + (p.reps || 0) + "</b> correct · Forgotten: <b>" + (p.lapses || 0) + "</b><br>" +
      "Next review: <b>" + esc(nextDue) + "</b> · Ease: <b>" + (p.ease || DEFAULT_EASE).toFixed(2) + "</b> · From <b>Day " + item.day + "</b>" + (item.topic ? " (" + esc(item.topic) + ")" : "");

    // mnemonic / memory aid
    const mnem = $("detailMnemonic");
    const tip = syllableTip(item);
    let mhtml = "";
    if (item.note) mhtml += "<div class=\"mnem-note\">⚠️ " + esc(item.note) + "</div>";
    if (tip) mhtml += "<div class=\"mnem-tip\"><span class=\"mnem-label\">Break it into syllables</span><b>" + esc(tip) + "</b></div>";
    mhtml += "<div class=\"mnem-tip\"><span class=\"mnem-label\">Why it matters</span>Part of <b>Day " + item.day + "</b>" + (item.topic ? " — " + esc(item.topic) : "") + ". Review it on schedule to lock it in.</div>";
    if (mhtml) { mnem.innerHTML = mhtml; mnem.classList.remove("hidden"); }
    else mnem.classList.add("hidden");

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

    // actions
    $("detailSpeak").onclick = function () { speak(item.word); };
    $("detailSlow").onclick = function () { speak(item.word, 0.6); };

    // pronunciation practice inside modal
    const pbox = $("pronResult");
    pbox.className = "pron-feedback hidden"; pbox.innerHTML = "";
    $("detailPron").textContent = "Tap, then say this word";
    attachMic($("detailPron"), null, pbox, function () { return item.word; }, function (result) {
      recordAnswer(item, result.score >= 70);
    });

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
            ? "⚠️ Microphone permission denied — allow it in your browser and try again"
            : err === "no-speech" ? "🤫 No sound detected — speak louder and tap again"
            : "Error (" + err + ") — please try again";
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
    let list = ITEMS.slice();
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
    const fb = $("pronFeedback"); fb.className = "pron-feedback hidden"; fb.innerHTML = "";
    $("pronNext").classList.add("hidden");

    $("pronSpeak").onclick = function () { speak(item.word); };
    $("pronSlow").onclick = function () { speak(item.word, 0.6); };

    let recorded = false;
    $("pronRecordLabel").textContent = "Tap, then say this word";
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
    let list = ITEMS.slice();
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
    let pool = ITEMS.slice().filter(function (i) {
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
    let list = ITEMS.slice().filter(function (i) {
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
      note: timeUp ? "⏰ Time's up! Counting only answered questions" : "",
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
    let list = ITEMS.slice().filter(function (i) { return i.word && i.word.trim() && i.type === "vocab"; });
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
    let list = ITEMS.slice().filter(function (i) { return i.exEn && i.exEn.trim(); });
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
    let list = ITEMS.slice().filter(function (i) { return i.exEn && i.exEn.trim() && i.word && i.word.trim(); });
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
    let list = ITEMS.slice().filter(function (i) { return i.word && i.word.trim(); });
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
  async function init() {
    await SecureStore.ready;
    loadInitialState();
    applyTheme();
    // Inject inline SVG icons into every [data-icon] placeholder
    document.querySelectorAll("[data-icon]").forEach(function (node) {
      node.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[node.dataset.icon] || "") + "</svg>";
    });
    applyI18n();
    // อัปเดตปุ่ม login ใน sidebar ด้วยภาษาที่ถูกต้อง (หลัง settings ถูก init แล้ว)
    if (window.VocabAuth && window.VocabAuth.updateSidebarAuthBtn) {
      try { window.VocabAuth.updateSidebarAuthBtn(); } catch (e) {}
    }
    initChips();
    // Defer heavy rendering (charts, heatmap, mastery donut, memory gauge,
    // daily progress bars) to the next animation frame so the browser can
    // paint the initial UI (icons, text, layout) first — this makes the
    // page feel instantly responsive instead of blocking on renderHome().
    requestAnimationFrame(function () {
      renderHome();
      renderProfileChip(); // sidebar profile chip (เลเวล / rank / XP)
      applyRewards();      // โชว์ธีมสี/accent + ฉายา ตามเลเวลที่มี
      renderRewards();     // แถวรางวัลตามเลเวลในหน้า Achievements
      updateBossRushBtn(); // โชว์ปุ่ม Boss Rush ถาปลดล็อก (L20)
      renderSettings();
      initInteractionFX();
      // Music is owned by the mini-player overlay (mini-player.js). It calls
      // window.VocabMusic.pause() on init, so we skip the built-in looping
      // player to avoid two tracks playing at once.
      if (!window.MINI_PLAYER_ENABLED) initMusic();
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
      b.onclick = function () { showView(b.dataset.view); };
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

    $("browseSearch").oninput = renderBrowse;
    $("browseToggleMeanings").onclick = function () {
      settings.hideAllMeanings = !settings.hideAllMeanings;
      save(K_SETTINGS, settings);
      renderBrowse();
    };

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
      confirmDialog("Reset all progress? (Your words won't be deleted, but review status will be cleared)", "Reset progress").then(function (ok) {
      if (ok) {
        progress = {}; reviews = {}; save(K_PROGRESS, progress); save(K_REVIEWS, reviews);
        renderSettings(); renderHome();
        toast("Reset complete", "ok");
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

    // Register the service worker for offline use + installability.
    if ("serviceWorker" in navigator) {
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

  /* Expose i18n API so other modules (auth.js, etc.) can use the shared
     translation system without duplicating string tables. */
  window.VocabApp = { t: t, applyI18n: applyI18n, setLang: setLang };
})();
