/* ============================================================
   PLACEMENT TEST v3 — ระบบทดสอบวัดระดับภาษาอังกฤษ (CEFR)
   ------------------------------------------------------------
   Adaptive IRT 3PL + E-Optimal Design + Bayesian Prior + RT-weighting
   - 180 questions (30 per level), adaptive from Q1
   - Start near B1 to quickly gauge level
   - Response time factors into answer correctness score
   - Smart early-termination: 4 consecutive wrong at same level → step down
   - Per-level AND per-type skill profile in results
   - Personalized learning recommendations
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Icon System (consistent with app.js) ---------- */
  const ICONS = {
    test: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 7-7"/>',
    arrowRight: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 4"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 20"/><path d="M20 20v-4h-4"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    arrowLeft: '<path d="M9 18l-6-6 6-6"/><path d="M3 12h18"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    chart: '<path d="M3 17l6-6 4 4 7-7"/><path d="M17 7h4v4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15l.8 2.2L21.5 18l-2.2.8L18.5 21l-.8-2.2L15.5 18l2.2-.8z"/>',
    award: '<circle cx="12" cy="8" r="7"/><path d="M8.2 12.4l2.6 2.6L16 9"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    lightbulb: '<path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="23" x2="14" y2="23"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0v-15A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 5 0v-15A2.5 2.5 0 0 0 14.5 2z"/>',
    cross: '<circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
    alert: '<path d="M12 3.5l9.2 16H2.8z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/>'
  };

  function svgIcon(name, cls) {
    let extra = "";
    if (typeof cls === "number") {
      extra = ` style="width:${cls}px;height:${cls}px"`;
      cls = "";
    }
    return '<span class="ico' + (cls ? " " + cls : "") + '"><svg viewBox="0 0 24 24" aria-hidden="true"' + extra + '>' + (ICONS[name] || "") + '</svg></span>';
  }

  /* ============================================================
     QUESTION BANK — 120 items (20 per CEFR level)
     difficulty: -3.5 (easiest) to +4.2 (hardest)
     discrimination: 0.8–2.2 — higher = better at distinguishing
     guessing: 0.15–0.25 — probability of guessing correctly
     category: noun / verb / adjective / adverb / phrase
     ============================================================ */
  const PLACEMENT_QUESTIONS = [
    /* --- A1 (20 items) target difficulty ≈ -3.0 to -1.5 --- */
    { level: "A1", word: "water", options: ["อาหาร", "บ้าน", "หนังสือ", "น้ำ", "แม่", "โรงเรียน"], answer: 3, difficulty: -2.8, discrimination: 1.5, guessing: 0.20, category: "noun" },
    { level: "A1", word: "big", options: ["เล็ก", "ใหญ่", "เร็ว", "ช้า", "สีแดง", "มีความสุข"], answer: 1, difficulty: -2.7, discrimination: 1.4, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "red", options: ["สีแดง", "สีน้ำเงิน", "เขียว", "เหลือง", "ใหญ่", "มีความสุข"], answer: 0, difficulty: -2.6, discrimination: 1.3, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "mother", options: ["พ่อ", "แม่", "พี่ชาย", "น้องสาว", "น้ำ", "บ้าน"], answer: 1, difficulty: -2.5, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A1", word: "house", options: ["โรงเรียน", "โรงพยาบาล", "ร้านค้า", "บ้าน", "น้ำ", "แม่"], answer: 3, difficulty: -2.4, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A1", word: "book", options: ["หนังสือ", "ปากกา", "โต๊ะ", "เก้าอี้", "น้ำ", "แม่"], answer: 0, difficulty: -2.5, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A1", word: "eat", options: ["ดื่ม", "นอน", "กิน", "เดิน", "วิ่ง", "อ่าน"], answer: 2, difficulty: -2.6, discrimination: 1.5, guessing: 0.20, category: "verb" },
    { level: "A1", word: "happy", options: ["เศร้า", "โกรธ", "มีความสุข", "เหนื่อย", "ใหญ่", "สีแดง"], answer: 2, difficulty: -2.3, discrimination: 1.2, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "run", options: ["เดิน", "วิ่ง", "นั่ง", "นอน", "กิน", "อ่าน"], answer: 1, difficulty: -2.5, discrimination: 1.4, guessing: 0.20, category: "verb" },
    { level: "A1", word: "school", options: ["บ้าน", "ตลาด", "โรงพยาบาล", "โรงเรียน", "น้ำ", "แม่"], answer: 3, difficulty: -2.2, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A1", word: "milk", options: ["น้ำ", "ชา", "กาแฟ", "นม", "แม่", "บ้าน"], answer: 3, difficulty: -2.7, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A1", word: "sleep", options: ["กิน", "เดิน", "นอน", "อ่าน", "วิ่ง", "เขียน"], answer: 2, difficulty: -2.8, discrimination: 1.5, guessing: 0.20, category: "verb" },
    { level: "A1", word: "small", options: ["ใหญ่", "เล็ก", "ยาว", "สั้น", "สีแดง", "มีความสุข"], answer: 1, difficulty: -2.6, discrimination: 1.3, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "walk", options: ["วิ่ง", "นั่ง", "ปีน", "เดิน", "กิน", "นอน"], answer: 3, difficulty: -2.4, discrimination: 1.4, guessing: 0.20, category: "verb" },
    { level: "A1", word: "read", options: ["อ่าน", "เขียน", "ฟัง", "พูด", "กิน", "วิ่ง"], answer: 0, difficulty: -2.3, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A1", word: "cold", options: ["ร้อน", "เดิน", "สูง", "หนาว", "ใหญ่", "สีแดง"], answer: 3, difficulty: -2.5, discrimination: 1.2, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "father", options: ["พ่อ", "แม่", "ปู่", "ยาย", "น้ำ", "บ้าน"], answer: 0, difficulty: -2.4, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A1", word: "two", options: ["หนึ่ง", "สอง", "สาม", "สี่", "ใหญ่", "สีแดง"], answer: 1, difficulty: -2.9, discrimination: 1.5, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "door", options: ["หนึ่ง", "บ้าน", "กำแพง", "ประตู", "น้ำ", "แม่"], answer: 3, difficulty: -2.3, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A1", word: "write", options: ["อ่าน", "เขียน", "ฟัง", "พูด", "กิน", "วิ่ง"], answer: 1, difficulty: -2.2, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A1", word: "apple", options: ["กล้วย", "ส้ม", "แอปเปิ้ล", "องุ่น", "น้ำ", "บ้าน"], answer: 2, difficulty: -2.7, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A1", word: "cat", options: ["สุนัข", "แมว", "นก", "ปลา", "น้ำ", "บ้าน"], answer: 1, difficulty: -2.8, discrimination: 1.5, guessing: 0.20, category: "noun" },
    { level: "A1", word: "dog", options: ["แมว", "สุนัข", "เสือ", "สิงโต", "นม", "พ่อ"], answer: 1, difficulty: -2.7, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A1", word: "car", options: ["จักรยาน", "รถไฟ", "รถยนต์", "เรือ", "ถนน", "บ้าน"], answer: 2, difficulty: -2.5, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A1", word: "pen", options: ["ดินสอ", "ปากกา", "ยางลบ", "ไม้บรรทัด", "หนังสือ", "โต๊ะ"], answer: 1, difficulty: -2.5, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A1", word: "look", options: ["ฟัง", "พูด", "มอง", "ชิม", "ดม", "วิ่ง"], answer: 2, difficulty: -2.4, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A1", word: "listen", options: ["อ่าน", "เขียน", "พูด", "ฟัง", "เดิน", "นอน"], answer: 3, difficulty: -2.4, discrimination: 1.4, guessing: 0.20, category: "verb" },
    { level: "A1", word: "hot", options: ["หนาว", "เย็น", "อุ่น", "ร้อน", "ใหญ่", "เล็ก"], answer: 3, difficulty: -2.6, discrimination: 1.3, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "good", options: ["เลว", "ดี", "สวย", "น่าเกลียด", "ใหญ่", "เล็ก"], answer: 1, difficulty: -2.7, discrimination: 1.4, guessing: 0.20, category: "adjective" },
    { level: "A1", word: "tree", options: ["ดอกไม้", "หญ้า", "ต้นไม้", "ใบไม้", "บ้าน", "น้ำ"], answer: 2, difficulty: -2.3, discrimination: 1.3, guessing: 0.20, category: "noun" },

    /* --- A2 (20 items) target difficulty ≈ -1.5 to -0.3 --- */
    { level: "A2", word: "doctor", options: ["ครู", "หมอ", "วิศวกร", "ชาวนา", "อากาศ", "เพื่อน"], answer: 1, difficulty: -1.4, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A2", word: "travel", options: ["เดินทาง", "ทำงาน", "เรียน", "เล่น", "จำได้", "มาถึง"], answer: 0, difficulty: -1.3, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A2", word: "study", options: ["เล่น", "เรียน", "กิน", "นอน", "เดินทาง", "จำได้"], answer: 1, difficulty: -1.2, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A2", word: "cheap", options: ["ถูก", "แพง", "ใหญ่", "ใหม่", "สบาย", "หมอ"], answer: 0, difficulty: -1.1, discrimination: 1.2, guessing: 0.20, category: "adjective" },
    { level: "A2", word: "weather", options: ["เวลา", "อากาศ", "สถานที่", "อาหาร", "หมอ", "เพื่อน"], answer: 1, difficulty: -1.0, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "friend", options: ["เพื่อน", "ครอบครัว", "เพื่อนร่วมงาน", "คนแปลกหน้า", "หมอ", "อากาศ"], answer: 0, difficulty: -1.1, discrimination: 1.2, guessing: 0.20, category: "noun" },
    { level: "A2", word: "remember", options: ["ลืม", "คิด", "จำได้", "ฟื้น", "เดินทาง", "เรียน"], answer: 2, difficulty: -1.2, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A2", word: "arrive", options: ["มาถึง", "เดินทาง", "ออกเดินทาง", "รอ", "เรียน", "จำได้"], answer: 0, difficulty: -1.0, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A2", word: "decide", options: ["คิด", "รอ", "เลือก", "ตัดสินใจ", "เดินทาง", "เรียน"], answer: 3, difficulty: -0.9, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A2", word: "believe", options: ["เกลียด", "สงสัย", "เชื่อว่า", "ไม่รู้", "เดินทาง", "เรียน"], answer: 2, difficulty: -0.8, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A2", word: "airport", options: ["สนามบิน", "ท่ารถ", "รถบัส", "ท่าเรือ", "หมอ", "อากาศ"], answer: 0, difficulty: -1.3, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "restaurant", options: ["ร้านค้า", "ตลาด", "ร้านอาหาร", "โรงแรม", "หมอ", "อากาศ"], answer: 2, difficulty: -1.4, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A2", word: "comfortable", options: ["สบาย", "รัก", "แคบ", "สกปรก", "ถูก", "หมอ"], answer: 0, difficulty: -1.0, discrimination: 1.2, guessing: 0.20, category: "adjective" },
    { level: "A2", word: "experience", options: ["ความพยายาม", "ความรู้", "ประสบการณ์", "ความทรงจำ", "หมอ", "อากาศ"], answer: 2, difficulty: -1.1, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "suggest", options: ["สั่ง", "แนะนำ", "ถาม", "ตอบ", "เดินทาง", "เรียน"], answer: 1, difficulty: -0.9, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A2", word: "improve", options: ["ดีขึ้น", "แย่ลง", "หยุด", "เริ่ม", "เดินทาง", "เรียน"], answer: 0, difficulty: -0.8, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A2", word: "population", options: ["ประชากร", "พื้นที่", "เมือง", "ชนบท", "หมอ", "อากาศ"], answer: 0, difficulty: -1.2, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "organize", options: ["จัดระเบียบ", "ทำลาย", "ลืม", "รอ", "เดินทาง", "เรียน"], answer: 0, difficulty: -0.7, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A2", word: "environment", options: ["สิ่งแวดล้อม", "เศรษฐกิจ", "สังคม", "การศึกษา", "หมอ", "อากาศ"], answer: 0, difficulty: -0.6, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "consider", options: ["มองข้าม", "หลงเหลือ", "คิดถึง", "เพิกเฉย", "เดินทาง", "เรียน"], answer: 2, difficulty: -0.7, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A2", word: "hospital", options: ["โรงเรียน", "ตลาด", "โรงพยาบาล", "สถานีตำรวจ", "หมอ", "เพื่อน"], answer: 2, difficulty: -1.3, discrimination: 1.4, guessing: 0.20, category: "noun" },
    { level: "A2", word: "museum", options: ["ห้องสมุด", "พิพิธภัณฑ์", "โรงละคร", "สวนสาธารณะ", "หมอ", "อากาศ"], answer: 1, difficulty: -1.1, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "library", options: ["ห้องเรียน", "ห้องสมุด", "โรงอาหาร", "สนามกีฬา", "หมอ", "อากาศ"], answer: 1, difficulty: -1.2, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "invent", options: ["ทำลาย", "สร้าง", "ประดิษฐ์", "ซ่อม", "เดินทาง", "เรียน"], answer: 2, difficulty: -0.9, discrimination: 1.3, guessing: 0.20, category: "verb" },
    { level: "A2", word: "borrow", options: ["ให้", "คืน", "ยืม", "ซื้อ", "เดินทาง", "เรียน"], answer: 2, difficulty: -1.0, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A2", word: "return", options: ["ไป", "มา", "คืน", "ส่ง", "เดินทาง", "เรียน"], answer: 2, difficulty: -0.8, discrimination: 1.2, guessing: 0.20, category: "verb" },
    { level: "A2", word: "dangerous", options: ["ปลอดภัย", "สวยงาม", "อันตราย", "สะอาด", "สบาย", "หมอ"], answer: 2, difficulty: -0.7, discrimination: 1.3, guessing: 0.20, category: "adjective" },
    { level: "A2", word: "expensive", options: ["ถูก", "แพง", "ใหญ่", "ใหม่", "สบาย", "หมอ"], answer: 1, difficulty: -1.1, discrimination: 1.2, guessing: 0.20, category: "adjective" },
    { level: "A2", word: "vacation", options: ["วันทำงาน", "วันหยุดพักผ่อน", "วันเกิด", "วันหยุดสุดสัปดาห์", "หมอ", "อากาศ"], answer: 1, difficulty: -0.8, discrimination: 1.3, guessing: 0.20, category: "noun" },
    { level: "A2", word: "passenger", options: ["คนขับ", "ผู้โดยสาร", "พนักงาน", "เจ้าหน้าที่", "หมอ", "อากาศ"], answer: 1, difficulty: -0.7, discrimination: 1.3, guessing: 0.20, category: "noun" },

    /* --- B1 (20 items) target difficulty ≈ -0.2 to +1.2 --- */
    { level: "B1", word: "career", options: ["เงินเดือน", "บริษัท", "การประชุม", "อาชีพ", "อุปกรณ์", "สัมภาษณ์"], answer: 3, difficulty: 0.5, discrimination: 1.5, guessing: 0.18, category: "noun" },
    { level: "B1", word: "salary", options: ["โบนัส", "ค่าใช้จ่าย", "เงินเดือน", "ภาษี", "อาชีพ", "อุปกรณ์"], answer: 2, difficulty: 0.4, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "device", options: ["โปรแกรม", "อินเทอร์เน็ต", "อุปกรณ์", "ข้อมูล", "อาชีพ", "เงินเดือน"], answer: 2, difficulty: 0.6, discrimination: 1.3, guessing: 0.18, category: "noun" },
    { level: "B1", word: "interview", options: ["สัมภาษณ์", "ประชุม", "ฝึกงาน", "อบรม", "อาชีพ", "เงินเดือน"], answer: 0, difficulty: 0.8, discrimination: 1.5, guessing: 0.18, category: "noun" },
    { level: "B1", word: "experience", options: ["การศึกษา", "ประสบการณ์", "การทำงาน", "การเล่น", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 0.3, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "suggest", options: ["สั่ง", "แนะนำ", "ถาม", "ตอบ", "ดีขึ้น", "จัดระเบียบ"], answer: 1, difficulty: 0.5, discrimination: 1.3, guessing: 0.18, category: "verb" },
    { level: "B1", word: "improve", options: ["แย่ลง", "หยุด", "ดีขึ้น", "เริ่ม", "แนะนำ", "จัดระเบียบ"], answer: 2, difficulty: 0.2, discrimination: 1.2, guessing: 0.18, category: "verb" },
    { level: "B1", word: "organize", options: ["ทำลาย", "ลืม", "รอ", "จัดระเบียบ", "แนะนำ", "ดีขึ้น"], answer: 3, difficulty: 0.7, discrimination: 1.4, guessing: 0.18, category: "verb" },
    { level: "B1", word: "opportunity", options: ["ปัญหา", "อันตราย", "รางวัล", "โอกาส", "อาชีพ", "เงินเดือน"], answer: 3, difficulty: 0.9, discrimination: 1.5, guessing: 0.18, category: "noun" },
    { level: "B1", word: "colleague", options: ["เจ้านาย", "เพื่อนร่วมงาน", "ลูกค้า", "พนักงาน", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 1.0, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "achieve", options: ["ล้มเหลว", "พยายาม", "เริ่มต้น", "สำเร็จ", "แนะนำ", "ดีขึ้น"], answer: 3, difficulty: 0.6, discrimination: 1.3, guessing: 0.18, category: "verb" },
    { level: "B1", word: "challenge", options: ["ความท้าทาย", "ง่าย", "ความสำเร็จ", "ความชำนาญ", "อาชีพ", "เงินเดือน"], answer: 0, difficulty: 0.7, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "responsible", options: ["ผิด", "รับผิดชอบ", "ไม่มีผิด", "เฉยข้าง", "มีอยู่", "จำเป็น"], answer: 1, difficulty: 0.5, discrimination: 1.3, guessing: 0.18, category: "adjective" },
    { level: "B1", word: "available", options: ["ไม่มี", "แพง", "มีอยู่", "ไกล", "รับผิดชอบ", "จำเป็น"], answer: 2, difficulty: 0.4, discrimination: 1.2, guessing: 0.18, category: "adjective" },
    { level: "B1", word: "develop", options: ["พัฒนา", "ทำลาย", "หยุด", "ลบ", "แนะนำ", "ดีขึ้น"], answer: 0, difficulty: 0.5, discrimination: 1.3, guessing: 0.18, category: "verb" },
    { level: "B1", word: "necessary", options: ["จำเป็น", "ไม่จำเป็น", "ฟังนะ", "ไม่สำคัญ", "รับผิดชอบ", "มีอยู่"], answer: 0, difficulty: 0.6, discrimination: 1.4, guessing: 0.18, category: "adjective" },
    { level: "B1", word: "influence", options: ["ผลกระทบที่ไม่ดี", "อิทธิพล", "ความล้มเหลว", "การพัฒนา", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 0.8, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "require", options: ["อยากได้", "มีข้อเสนอ", "เพิกเฉย", "ต้องการ", "แนะนำ", "ดีขึ้น"], answer: 3, difficulty: 0.7, discrimination: 1.3, guessing: 0.18, category: "verb" },
    { level: "B1", word: "provide", options: ["นำไป", "ลบออก", "ให้", "เอาไป", "แนะนำ", "ดีขึ้น"], answer: 2, difficulty: 0.6, discrimination: 1.3, guessing: 0.18, category: "verb" },
    { level: "B1", word: "increase", options: ["ลดลง", "คงที่", "หยุด", "เพิ่มขึ้น", "แนะนำ", "ดีขึ้น"], answer: 3, difficulty: 0.4, discrimination: 1.2, guessing: 0.18, category: "verb" },
    { level: "B1", word: "employee", options: ["นายจ้าง", "ลูกจ้าง/พนักงาน", "ลูกค้า", "เจ้านาย", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 0.5, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "customer", options: ["ผู้ขาย", "ผู้ผลิต", "ลูกค้า", "ผู้จัดการ", "อาชีพ", "เงินเดือน"], answer: 2, difficulty: 0.4, discrimination: 1.3, guessing: 0.18, category: "noun" },
    { level: "B1", word: "department", options: ["บริษัท", "แผนก/ฝ่าย", "สาขา", "อาคาร", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 0.6, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "promotion", options: ["การลดตำแหน่ง", "การเลื่อนขั้น/โปรโมชัน", "การลาออก", "การสัมภาษณ์", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 0.7, discrimination: 1.4, guessing: 0.18, category: "noun" },
    { level: "B1", word: "persuade", options: ["บังคับ", "ห้าม", "ชักชวน/โน้มน้าว", "ปฏิเสธ", "แนะนำ", "ดีขึ้น"], answer: 2, difficulty: 0.8, discrimination: 1.5, guessing: 0.18, category: "verb" },
    { level: "B1", word: "recognize", options: ["ลืม", "เมินเฉย", "จำได้/ยอมรับ", "ปฏิเสธ", "แนะนำ", "ดีขึ้น"], answer: 2, difficulty: 0.5, discrimination: 1.3, guessing: 0.18, category: "verb" },
    { level: "B1", word: "flexible", options: ["แข็งกระด้าง", "ยืดหยุ่น", "แน่นอน", "เปลี่ยนไม่ได้", "รับผิดชอบ", "มีอยู่"], answer: 1, difficulty: 0.6, discrimination: 1.3, guessing: 0.18, category: "adjective" },
    { level: "B1", word: "efficient", options: ["ไม่มีประสิทธิภาพ", "มีประสิทธิภาพ", "ช้า", "สิ้นเปลือง", "รับผิดชอบ", "มีอยู่"], answer: 1, difficulty: 0.7, discrimination: 1.4, guessing: 0.18, category: "adjective" },
    { level: "B1", word: "atmosphere", options: ["อากาศ", "บรรยากาศ", "สิ่งแวดล้อม", "ภูมิอากาศ", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 0.4, discrimination: 1.3, guessing: 0.18, category: "noun" },
    { level: "B1", word: "alternative", options: ["ปัญหา", "ทางเลือก", "ข้อบังคับ", "อุปสรรค", "อาชีพ", "เงินเดือน"], answer: 1, difficulty: 0.6, discrimination: 1.4, guessing: 0.18, category: "noun" },

    /* --- B2 (20 items) target difficulty ≈ +1.2 to +2.5 --- */
    { level: "B2", word: "environment", options: ["เศรษฐกิจ", "สังคม", "การศึกษา", "สิ่งแวดล้อม", "ความสำเร็จ", "รัฐบาล"], answer: 3, difficulty: 1.2, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "B2", word: "economy", options: ["วัฒนธรรม", "เศรษฐกิจ", "การเมือง", "เทคโนโลยี", "สิ่งแวดล้อม", "ความสำเร็จ"], answer: 1, difficulty: 1.3, discrimination: 1.5, guessing: 0.15, category: "noun" },
    { level: "B2", word: "achievement", options: ["ปัญหา", "อุปสรรค", "ความสำเร็จ", "ความล้มเหลว", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 2, difficulty: 1.5, discrimination: 1.4, guessing: 0.15, category: "noun" },
    { level: "B2", word: "government", options: ["บริษัท", "รัฐบาล", "มหาวิทยาลัย", "โรงพยาบาล", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 1, difficulty: 1.6, discrimination: 1.5, guessing: 0.15, category: "noun" },
    { level: "B2", word: "influence", options: ["ปัญหา", "โอกาส", "อิทธิพล", "ผลลัพธ์", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 2, difficulty: 1.4, discrimination: 1.4, guessing: 0.15, category: "noun" },
    { level: "B2", word: "contribute", options: ["มีส่วนร่วม", "ทำลาย", "หยุด", "รอ", "บรรลุผล", "แสดงให้เห็น"], answer: 0, difficulty: 1.3, discrimination: 1.5, guessing: 0.15, category: "verb" },
    { level: "B2", word: "significant", options: ["เล็กน้อย", "ชัดเจน", "ซับซ้อน", "สำคัญ", "ร่วมสมัย", "ยั่งยืน"], answer: 3, difficulty: 1.7, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "accomplish", options: ["ล้มเหลว", "เริ่ม", "บรรลุผล", "หยุด", "มีส่วนร่วม", "แสดงให้เห็น"], answer: 2, difficulty: 1.8, discrimination: 1.5, guessing: 0.15, category: "verb" },
    { level: "B2", word: "contemporary", options: ["โบราณ", "ทันสมัย", "ร่วมสมัย", "เก่า", "สำคัญ", "ยั่งยืน"], answer: 2, difficulty: 2.0, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "sustainable", options: ["ชั่วคราว", "ยั่งยืน", "รวดเร็ว", "ช้า", "สำคัญ", "ร่วมสมัย"], answer: 1, difficulty: 2.1, discrimination: 1.5, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "comprehensive", options: ["จำกัด", "ครอบคลุม", "ง่าย", "ซับซ้อน", "สำคัญ", "ร่วมสมัย"], answer: 1, difficulty: 1.9, discrimination: 1.5, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "demonstrate", options: ["แสดงให้เห็น", "ซ่อน", "ลืม", "สงสัย", "มีส่วนร่วม", "บรรลุผล"], answer: 0, difficulty: 1.6, discrimination: 1.4, guessing: 0.15, category: "verb" },
    { level: "B2", word: "substantial", options: ["เล็กน้อย", "ไม่สำคัญ", "ชั่วคราว", "มาก", "สำคัญ", "ร่วมสมัย"], answer: 3, difficulty: 1.8, discrimination: 1.5, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "implement", options: ["จัดทำ", "วางแผน", "ลงมือ", "ประเมินผล", "มีส่วนร่วม", "บรรลุผล"], answer: 0, difficulty: 1.7, discrimination: 1.4, guessing: 0.15, category: "verb" },
    { level: "B2", word: "phenomenon", options: ["เหตุการณ์", "อุบัติเหตุ", "ประดิษฐกรรม", "ปรากฏการณ์", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 3, difficulty: 2.0, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "B2", word: "consequence", options: ["สาเหตุ", "ปัญหา", "โอกาส", "ผลลัพธ์", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 3, difficulty: 1.8, discrimination: 1.5, guessing: 0.15, category: "noun" },
    { level: "B2", word: "adequate", options: ["ไม่พอ", "มากเกิน", "น้อยเกิน", "เพียงพอ", "สำคัญ", "ร่วมสมัย"], answer: 3, difficulty: 1.5, discrimination: 1.4, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "eliminate", options: ["เพิ่มขึ้น", "คงอยู่", "ขจัด", "เปลี่ยนแปลง", "มีส่วนร่วม", "บรรลุผล"], answer: 2, difficulty: 1.9, discrimination: 1.5, guessing: 0.15, category: "verb" },
    { level: "B2", word: "inevitable", options: ["หลีกเลี่ยงได้", "เป็นไปได้", "น่าสงสาร", "หลีกเลี่ยงไม่ได้", "สำคัญ", "ร่วมสมัย"], answer: 3, difficulty: 2.0, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "interpret", options: ["เขียน", "ฟัง", "พูด", "แปลความ", "มีส่วนร่วม", "บรรลุผล"], answer: 3, difficulty: 1.6, discrimination: 1.4, guessing: 0.15, category: "verb" },
    { level: "B2", word: "infrastructure", options: ["อาคาร", "โครงสร้างพื้นฐาน", "องค์กร", "ระบบ", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 1, difficulty: 1.6, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "B2", word: "perspective", options: ["ข้อเท็จจริง", "มุมมอง/ทัศนคติ", "ปัญหา", "ผลลัพธ์", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 1, difficulty: 1.5, discrimination: 1.5, guessing: 0.15, category: "noun" },
    { level: "B2", word: "evaluation", options: ["การวางแผน", "การประเมินผล", "การปฏิบัติ", "การออกแบบ", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 1, difficulty: 1.7, discrimination: 1.5, guessing: 0.15, category: "noun" },
    { level: "B2", word: "facilitate", options: ["ขัดขวาง", "อำนวยความสะดวก", "ทำลาย", "ชะลอ", "มีส่วนร่วม", "บรรลุผล"], answer: 1, difficulty: 1.8, discrimination: 1.6, guessing: 0.15, category: "verb" },
    { level: "B2", word: "anticipate", options: ["ตามหลัง", "คาดการณ์ล่วงหน้า", "ลืม", "สงสัย", "มีส่วนร่วม", "บรรลุผล"], answer: 1, difficulty: 1.9, discrimination: 1.6, guessing: 0.15, category: "verb" },
    { level: "B2", word: "alternative", options: ["หลัก", "ทางเลือกสำรอง", "บังคับ", "ข้อจำกัด", "สำคัญ", "ร่วมสมัย"], answer: 1, difficulty: 1.4, discrimination: 1.4, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "equivalent", options: ["แตกต่าง", "เทียบเท่า", "มากกว่า", "น้อยกว่า", "สำคัญ", "ร่วมสมัย"], answer: 1, difficulty: 1.6, discrimination: 1.5, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "fundamental", options: ["ผิวเผิน", "พื้นฐานสำคัญ", "ชั่วคราว", "ซับซ้อน", "สำคัญ", "ร่วมสมัย"], answer: 1, difficulty: 1.5, discrimination: 1.5, guessing: 0.15, category: "adjective" },
    { level: "B2", word: "innovation", options: ["ของเก่า", "นวัตกรรม", "ประเพณี", "การเลียนแบบ", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 1, difficulty: 1.4, discrimination: 1.4, guessing: 0.15, category: "noun" },
    { level: "B2", word: "perspective", options: ["ข้อสงสัย", "ทัศนคติ", "ความจริง", "ความฝัน", "สิ่งแวดล้อม", "เศรษฐกิจ"], answer: 1, difficulty: 1.6, discrimination: 1.5, guessing: 0.15, category: "noun" },

    /* --- C1 (20 items) target difficulty ≈ +2.3 to +3.5 --- */
    { level: "C1", word: "ambition", options: ["ความปรารถนา", "ความกล้า", "ความโกรธ", "ความฉงน", "ผลลัพธ์", "ความยืดหยุ่น"], answer: 0, difficulty: 2.3, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "C1", word: "consequence", options: ["สาเหตุ", "ผลลัพธ์", "ปัญหา", "โอกาส", "ความปรารถนา", "ความยืดหยุ่น"], answer: 1, difficulty: 2.4, discrimination: 1.7, guessing: 0.15, category: "noun" },
    { level: "C1", word: "resilience", options: ["ความอ่อนแอ", "ความแข็งแรง", "ความยืดหยุ่น", "ความเปราะบาง", "ความปรารถนา", "ผลลัพธ์"], answer: 2, difficulty: 2.5, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "C1", word: "perspective", options: ["มุมมอง", "ทัศนคติ", "ความรู้สึก", "ความเชื่อ", "ความปรารถนา", "ผลลัพธ์"], answer: 0, difficulty: 2.6, discrimination: 1.7, guessing: 0.15, category: "noun" },
    { level: "C1", word: "criticism", options: ["การยกย่อง", "การสนับสนุน", "การเพิกเฉย", "การวิจารณ์", "ความปรารถนา", "ผลลัพธ์"], answer: 3, difficulty: 2.5, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "C1", word: "demonstrate", options: ["แสดงให้เห็น", "ซ่อน", "ลืม", "สงสัย", "แย่ลง", "แกว่งไกว"], answer: 0, difficulty: 2.2, discrimination: 1.5, guessing: 0.15, category: "verb" },
    { level: "C1", word: "inevitable", options: ["หลีกเลี่ยงได้", "เป็นไปได้", "หลีกเลี่ยงไม่ได้", "น่าสงสาร", "ครอบคลุม", "ระมัดระวัง"], answer: 2, difficulty: 2.8, discrimination: 1.7, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "comprehensive", options: ["ครอบคลุม", "จำกัด", "ง่าย", "ซับซ้อน", "หลีกเลี่ยงไม่ได้", "ระมัดระวัง"], answer: 0, difficulty: 2.9, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "deteriorate", options: ["ดีขึ้น", "หยุด", "แย่ลง", "เริ่ม", "แสดงให้เห็น", "แกว่งไกว"], answer: 2, difficulty: 3.0, discrimination: 1.7, guessing: 0.15, category: "verb" },
    { level: "C1", word: "paradigm", options: ["รูปแบบความคิด", "ตัวอย่าง", "ปัญหา", "คำตอบ", "ความปรารถนา", "ผลลัพธ์"], answer: 0, difficulty: 3.1, discrimination: 1.8, guessing: 0.15, category: "noun" },
    { level: "C1", word: "fluctuate", options: ["คงที่", "เพิ่มขึ้น", "แกว่งไกว", "ลดลง", "แสดงให้เห็น", "แย่ลง"], answer: 2, difficulty: 2.6, discrimination: 1.5, guessing: 0.15, category: "verb" },
    { level: "C1", word: "hierarchy", options: ["ความสมานฉันท์", "ความเสมอภาค", "ความสามัคคี", "ระบบลำดับชั้น", "ความปรารถนา", "ผลลัพธ์"], answer: 3, difficulty: 2.8, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "C1", word: "meticulous", options: ["ประมาท", "รวดเร็ว", "สับสน", "ระมัดระวัง", "หลีกเลี่ยงไม่ได้", "ครอบคลุม"], answer: 3, difficulty: 2.9, discrimination: 1.7, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "negotiate", options: ["ตกลง", "ยอมแพ้", "เจรจา", "ถกเถียง", "แสดงให้เห็น", "แย่ลง"], answer: 2, difficulty: 2.5, discrimination: 1.5, guessing: 0.15, category: "verb" },
    { level: "C1", word: "plausible", options: ["ไม่สมเหตุสมผล", "ชัดเจน", "สมเหตุสมผล", "สับสน", "หลีกเลี่ยงไม่ได้", "ครอบคลุม"], answer: 2, difficulty: 2.7, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "reluctant", options: ["ไม่เต็มใจ", "ยินดี", "กระตือรือร้น", "เฉยเมย", "หลีกเลี่ยงไม่ได้", "ครอบคลุม"], answer: 0, difficulty: 2.6, discrimination: 1.5, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "scrutinize", options: ["มองผ่าน", "ตรวจสอบอย่างละเอียด", "คาดคะเน", "หลงเหลือ", "แสดงให้เห็น", "แย่ลง"], answer: 1, difficulty: 3.0, discrimination: 1.7, guessing: 0.15, category: "verb" },
    { level: "C1", word: "tangible", options: ["จับต้องได้", "นามธรรม", "สมมติ", "ไม่ชัดเจน", "หลีกเลี่ยงไม่ได้", "ครอบคลุม"], answer: 0, difficulty: 2.8, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "undermine", options: ["สนับสนุน", "บ่อนทำลาย", "สร้าง", "ป้องกัน", "แสดงให้เห็น", "แย่ลง"], answer: 1, difficulty: 2.7, discrimination: 1.6, guessing: 0.15, category: "verb" },
    { level: "C1", word: "vulnerable", options: ["อ่อนแอ", "แข็งแรง", "ป้องกันได้", "ไม่มีผล", "หลีกเลี่ยงไม่ได้", "ครอบคลุม"], answer: 0, difficulty: 2.5, discrimination: 1.5, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "comprehensive", options: ["จำกัด", "ครอบคลุมละเอียด", "ผิวเผิน", "ง่าย", "หลีกเลี่ยงไม่ได้", "ระมัดระวัง"], answer: 1, difficulty: 2.7, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "ambiguous", options: ["ชัดเจน", "กำกวม/คลุมเครือ", "แน่นอน", "ตรงไปตรงมา", "หลีกเลี่ยงไม่ได้", "ระมัดระวัง"], answer: 1, difficulty: 2.6, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "meticulous", options: ["สะเพร่า", "รวดเร็ว", "พิถีพิถัน/ละเอียดลออ", "สับสน", "หลีกเลี่ยงไม่ได้", "ระมัดระวัง"], answer: 2, difficulty: 2.8, discrimination: 1.7, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "ubiquitous", options: ["หาได้ยาก", "มีอยู่ทุกหนทุกแห่ง", "เฉพาะเจาะจง", "ชั่วคราว", "หลีกเลี่ยงไม่ได้", "ระมัดระวัง"], answer: 1, difficulty: 2.9, discrimination: 1.7, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "articulate", options: ["พูดไม่ชัด", "พูดจาชัดเจนฉลาด", "เงียบ", "อึกอัก", "แสดงให้เห็น", "แย่ลง"], answer: 1, difficulty: 2.7, discrimination: 1.6, guessing: 0.15, category: "adjective" },
    { level: "C1", word: "hypothesis", options: ["ข้อเท็จจริง", "สมมติฐาน", "บทสรุป", "ทฤษฎีจริง", "ความปรารถนา", "ผลลัพธ์"], answer: 1, difficulty: 2.5, discrimination: 1.6, guessing: 0.15, category: "noun" },
    { level: "C1", word: "dichotomy", options: ["ความเหมือน", "การรวมกัน", "การแบ่งเป็นสองส่วนตรงข้าม", "ความสอดคล้อง", "ความปรารถนา", "ผลลัพธ์"], answer: 2, difficulty: 3.0, discrimination: 1.8, guessing: 0.15, category: "noun" },
    { level: "C1", word: "substantiate", options: ["หักล้าง", "พิสูจน์ยืนยันด้วยหลักฐาน", "ปฏิเสธ", "สงสัย", "แสดงให้เห็น", "แย่ลง"], answer: 1, difficulty: 3.1, discrimination: 1.8, guessing: 0.15, category: "verb" },
    { level: "C1", word: "ameliorate", options: ["ทำให้แย่ลง", "ทำให้ดีขึ้น", "ทำลาย", "ละเลย", "แสดงให้เห็น", "แย่ลง"], answer: 1, difficulty: 2.9, discrimination: 1.7, guessing: 0.15, category: "verb" },
    { level: "C1", word: "perpetuate", options: ["ทำลาย", "ทำให้สิ้นสุด", "ทำให้คงอยู่ตลอดไป", "ขัดขวาง", "แสดงให้เห็น", "แย่ลง"], answer: 2, difficulty: 3.0, discrimination: 1.7, guessing: 0.15, category: "verb" },

    /* --- C2 (20 items) target difficulty ≈ +3.3 to +4.5 --- */
    { level: "C2", word: "dialect", options: ["ภาษาเขียน", "ภาษาถิ่น", "ภาษาต่างประเทศ", "ภาษาโบราณ", "ปรากฏการณ์", "ปรัชญา"], answer: 1, difficulty: 3.3, discrimination: 1.8, guessing: 0.12, category: "noun" },
    { level: "C2", word: "phenomenon", options: ["เหตุการณ์", "อุบัติเหตุ", "ปรากฏการณ์", "ประดิษฐกรรม", "ภาษาถิ่น", "ปรัชญา"], answer: 2, difficulty: 3.4, discrimination: 1.7, guessing: 0.12, category: "noun" },
    { level: "C2", word: "philosophy", options: ["จิตวิทยา", "ปรัชญา", "สังคมวิทยา", "มานุษยวิทยา", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 3.2, discrimination: 1.8, guessing: 0.12, category: "noun" },
    { level: "C2", word: "intuition", options: ["ตรรกะ", "สัญชาตญาณ", "ประสบการณ์", "ความรู้", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 3.5, discrimination: 1.7, guessing: 0.12, category: "noun" },
    { level: "C2", word: "conventional", options: ["สมัยใหม่", "ล้ำสมัย", "ตามประเพณี", "ผิดธรรมดา", "พบทุกที่", "ปฏิบัติได้จริง"], answer: 2, difficulty: 3.4, discrimination: 1.6, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "ubiquitous", options: ["หายาก", "สำคัญ", "ชั่วคราว", "พบทุกที่", "ตามประเพณี", "ปฏิบัติได้จริง"], answer: 3, difficulty: 3.8, discrimination: 1.9, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "pragmatic", options: ["อุดมคติ", "ซับซ้อน", "ปฏิบัติได้จริง", "โบราณ", "ตามประเพณี", "พบทุกที่"], answer: 2, difficulty: 3.6, discrimination: 1.8, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "eloquent", options: ["เงียบ", "สับสน", "โกรธ", "พูดคล่องแคล่ว", "ตามประเพณี", "พบทุกที่"], answer: 3, difficulty: 3.7, discrimination: 1.7, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "ephemeral", options: ["นิรันดร์", "หนักแน่น", "ชั่วคราว", "ชัดเจน", "ตามประเพณี", "พบทุกที่"], answer: 2, difficulty: 3.9, discrimination: 1.9, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "serendipity", options: ["โชคชะตา", "ความโชคดีบังเอิญ", "ความกล้า", "ความโกรธ", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 4.0, discrimination: 2.0, guessing: 0.12, category: "noun" },
    { level: "C2", word: "esoteric", options: ["เป็นทั่วไป", "ง่าย", "ซับซ้อน", "เป็นความรู้เฉพาะกลุ่ม", "ตามประเพณี", "พบทุกที่"], answer: 3, difficulty: 3.8, discrimination: 1.8, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "gregarious", options: ["ขรึม", "ขี้ขลาด", "เย่อหยิ่ง", "ชอบเข้าสังคม", "ตามประเพณี", "พบทุกที่"], answer: 3, difficulty: 3.7, discrimination: 1.7, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "laconic", options: ["ยาว", "พูดน้อย", "อ่อนแอ", "ไพเราะ", "ตามประเพณี", "พบทุกที่"], answer: 1, difficulty: 3.9, discrimination: 1.8, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "magnanimous", options: ["เมตตา", "กตัญญู", "ตระหนี่", "อิจฉา", "ตามประเพณี", "พบทุกที่"], answer: 0, difficulty: 3.8, discrimination: 1.7, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "obfuscate", options: ["ทำให้ชัดเจน", "ทำให้สับสน", "อธิบาย", "กล่าวถึง", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 4.0, discrimination: 1.9, guessing: 0.12, category: "verb" },
    { level: "C2", word: "panacea", options: ["วิธีแก้ไข", "ปัญหา", "ยารักษาทุกโรค", "ความเสี่ยง", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 2, difficulty: 3.9, discrimination: 1.8, guessing: 0.12, category: "noun" },
    { level: "C2", word: "recondite", options: ["เป็นทั่วไป", "ซับซ้อนและลึกยาก", "ชัดเจน", "ง่าย", "ตามประเพณี", "พบทุกที่"], answer: 1, difficulty: 4.1, discrimination: 1.9, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "sycophant", options: ["ผู้แกล้ง", "คนประจบประแจง", "ผู้คิด", "คนมีความรู้", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 4.0, discrimination: 1.8, guessing: 0.12, category: "noun" },
    { level: "C2", word: "vicarious", options: ["โดยตรง", "ชั่วคราว", "ถาวร", "ทางอ้อม", "ตามประเพณี", "พบทุกที่"], answer: 3, difficulty: 3.9, discrimination: 1.8, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "waning", options: ["เพิ่มขึ้น", "คงที่", "ลดลง", "แกว่งไกว", "ตามประเพณี", "พบทุกที่"], answer: 2, difficulty: 3.6, discrimination: 1.7, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "recalcitrant", options: ["ว่านอนสอนง่าย", "ดื้อดึง/ไม่ยอมเชื่อฟัง", "เชื่อง", "ยืดหยุ่น", "ตามประเพณี", "พบทุกที่"], answer: 1, difficulty: 3.8, discrimination: 1.9, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "pusillanimous", options: ["กล้าหาญ", "มั่น ฯ", "ขี้ขลาดตาขาว", "ฉลาด", "ตามประเพณี", "พบทุกที่"], answer: 2, difficulty: 4.1, discrimination: 2.0, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "obdurate", options: ["อ่อนโยน", "หัวดื้อ/ใจแข็งกระด้าง", "เมตตา", "ยืดหยุ่น", "ตามประเพณี", "พบทุกที่"], answer: 1, difficulty: 3.9, discrimination: 1.8, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "iconoclast", options: ["ผู้ศรัทธา", "ผู้ทำลายความเชื่อดั้งเดิม", "ผู้สร้าง", "ผู้ตาม", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 4.0, discrimination: 1.9, guessing: 0.12, category: "noun" },
    { level: "C2", word: "nadir", options: ["จุดสูงสุด", "จุดศูนย์กลาง", "จุดต่ำสุด", "จุดเริ่มต้น", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 2, difficulty: 3.7, discrimination: 1.8, guessing: 0.12, category: "noun" },
    { level: "C2", word: "zenith", options: ["จุดต่ำสุด", "จุดสูงสุด", "จุดสิ้นสุด", "จุดกึ่งกลาง", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 3.6, discrimination: 1.7, guessing: 0.12, category: "noun" },
    { level: "C2", word: "perfidy", options: ["ความจงรักภักดี", "การทรยศหักหลัง", "ความซื่อสัตย์", "ความช่วยเหลือ", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 4.0, discrimination: 1.9, guessing: 0.12, category: "noun" },
    { level: "C2", word: "querulous", options: ["อารมณ์ดี", "ขี้บ่น/จู้จี้ตอดเล็กตอดน้อย", "เงียบขรึม", "พอใจ", "ตามประเพณี", "พบทุกที่"], answer: 1, difficulty: 3.8, discrimination: 1.8, guessing: 0.12, category: "adjective" },
    { level: "C2", word: "vitriol", options: ["คำชมเชย", "ถ้อยคำรุนแรงเสียดสี", "คำอวยพร", "ความสุภาพ", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 1, difficulty: 4.1, discrimination: 1.9, guessing: 0.12, category: "noun" },
    { level: "C2", word: "pulchritude", options: ["ความน่าเกลียด", "ความธรรมดา", "ความงดงามเลอเลิศ", "ความมืดมน", "ภาษาถิ่น", "ปรากฏการณ์"], answer: 2, difficulty: 4.2, discrimination: 2.0, guessing: 0.12, category: "noun" },
  ];

  // CEFR ↔ Ability mapping (logit scale) — made stricter so C1/C2 require true mastery and prevent B1 users from guessing C2
  const LEVEL_ABILITY = { A1: -2.2, A2: -1.0, B1: 0.2, B2: 1.5, C1: 2.8, C2: 3.8 };
  const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const LEVEL_COUNTS = {};
  CEFR_ORDER.forEach(l => LEVEL_COUNTS[l] = { correct: 0, total: 0 });

  // Category tracking
  const CATEGORY_NAMES = {
    noun: "คำนาม", verb: "คำกริยา", adjective: "คำคุณศัพท์",
    adverb: "คำวิเศษณ์", phrase: "ประโยค/สำนวน"
  };

  /* ---------- State ---------- */
  let pAnswers = [];
  let pStarted = false;
  let pStartTime = 0;
  let pQuestionStartTime = 0;
  let pCurrentAbility = -2.2; // Start at A1 ability level
  let pAbilitySE = 1.5;
  let pAdaptiveMode = true;
  let pAnimating = false;
  let pExposureCount = {};
  let pConsecutiveWrong = 0;
  let pConsecutiveLevel = null;
  let pMaxConsecutiveWrong = 0;
  // Mount + mode: "placement" (first-run pretest) or "posttest" (end-of-course measure).
  // pMountId lets the same engine render into any container (e.g. #posttestMount).
  let pMode = "placement";
  let pMountId = "placementTest";

  /* ============================================================
     IRT 3PL Model — with guessing parameter
     P = c + (1-c) × 1/(1+exp(-a×(θ-b)))
     c = guessing probability, a = discrimination, b = difficulty
     ============================================================ */
  function irtProbability3PL(ability, difficulty, discrimination, guessing) {
    const c = guessing || 0.20;
    const x = discrimination * (ability - difficulty);
    if (x > 20) return c + (1 - c) * 0.999999;
    if (x < -20) return c;
    return c + (1 - c) / (1 + Math.exp(-x));
  }

  /* ============================================================
     Response Time Adjustment — level-aware
     Expected time scales with difficulty per level
     ============================================================ */
  function timeAdjustment(timeMs, questionLevel) {
    // Expected time per level (ms) — reflects cognitive load
    const expectedTime = {
      A1: 5000,   // Simple words — quick recognition
      A2: 7000,   // Slightly harder — some hesitation
      B1: 10000,  // Moderate — need to think
      B2: 13000,  // Complex — careful consideration
      C1: 16000,  // Advanced — deep processing
      C2: 20000   // Expert — very careful
    };
    const median = expectedTime[questionLevel] || expectedTime["B1"];
    const ratio = timeMs / median;
    const clamped = Math.max(0.3, Math.min(3.5, ratio));

    // Ultra-fast (< 1.8s) on any question: flag as possible random guessing / speed-clicking
    if (timeMs < 1800) return -0.22;

    // Fast correct answers boost; slow correct answers reduce confidence
    if (clamped < 0.4) return 0.12;        // Very fast — strong signal (but not too high to avoid gaming)
    if (clamped < 0.7) return 0.06;        // Fast — slight boost
    if (clamped < 1.1) return 0.0;         // Normal — no adjustment
    if (clamped < 1.8) return -0.06;       // Slow — slight penalty
    return -0.12;                           // Very slow — significant penalty
  }

  /* ============================================================
     Bayesian Prior — start at A1 (-2.2) with moderate uncertainty
     ============================================================ */
  function bayesianPrior(ability, answers) {
    if (answers.length === 0) return { ability: -2.2, se: 1.5 };
    const priorMean = -2.2;
    const priorVar = 1.5 * 1.5;
    const mle = estimateAbility(answers);
    const posteriorVar = 1 / (1 / priorVar + 1 / (mle.se * mle.se + 0.01));
    const posteriorMean = posteriorVar * (priorMean / priorVar + mle.ability / (mle.se * mle.se + 0.01));
    return { ability: posteriorMean, se: Math.sqrt(posteriorVar) };
  }

  /* ============================================================
     MLE via Newton-Raphson with damping for stability
     Uses 3PL likelihood
     ============================================================ */
  function estimateAbility(answers) {
    if (answers.length === 0) return { ability: 0, se: 1.5 };

    let ability = 0;
    for (let iter = 0; iter < 30; iter++) {
      let num = 0, den = 0;
      answers.forEach(ans => {
        const p = irtProbability3PL(ability, ans.difficulty, ans.discrimination, ans.guessing);
        const q = 1 - p;
        const a = ans.discrimination;
        const c = ans.guessing || 0.20;
        // Derivative of 3PL log-likelihood
        const w = a * a * p * q;
        if (w < 0.0001) return; // Skip near-zero information items
        num += a * (ans.correct - p);
        den += w;
      });
      if (den < 0.001) break;
      // Damping: limit step size to prevent overshooting
      const delta = Math.max(-1.5, Math.min(1.5, num / den));
      ability += delta;
      if (Math.abs(delta) < 0.003) break;
    }

    // Standard Error from observed information
    let info = 0;
    answers.forEach(ans => {
      const p = irtProbability3PL(ability, ans.difficulty, ans.discrimination, ans.guessing);
      const q = 1 - p;
      info += ans.discrimination * ans.discrimination * p * q;
    });
    const se = info > 0 ? Math.min(1 / Math.sqrt(info), 2.0) : 2.0;

    return { ability, se };
  }

  /* ============================================================
     Ability → CEFR with smooth interpolation
     ============================================================ */
  function abilityToCefr(ability) {
    const levels = Object.entries(LEVEL_ABILITY).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < levels.length - 1; i++) {
      const [l1, a1] = levels[i];
      const [l2, a2] = levels[i + 1];
      if (ability >= a1 && ability <= a2) {
        const t = (ability - a1) / (a2 - a1);
        return { level: l1, nextLevel: l2, progress: t };
      }
    }
    if (ability < levels[0][1]) return { level: levels[0][0], nextLevel: levels[1][0], progress: 0 };
    return { level: levels[levels.length - 1][0], nextLevel: null, progress: 1 };
  }

  /* ============================================================
     Confidence Interval
     ============================================================ */
  function computeCI(ability, se, confidence = 0.95) {
    const z = confidence >= 0.99 ? 2.576 : confidence >= 0.95 ? 1.96 : 1.645;
    return { lower: ability - z * se, upper: ability + z * se };
  }

  /* ============================================================
     E-Optimal Adaptive Question Selection
     Strategy:
     1. Build candidate pool (unanswered questions)
     2. Score each by Fisher Information at current ability
     3. Add exploration bonus for under-tested levels & categories
     4. Penalize over-exposure and recent repetition
     5. Select with small randomization (ε-greedy)
     ============================================================ */
  function selectNextQuestion(answeredIndices, currentAbility) {
    const candidates = PLACEMENT_QUESTIONS
      .map((q, i) => ({ ...q, index: i }))
      .filter(q => !answeredIndices.includes(q.index));

    if (candidates.length === 0) return null;

    // Compute Fisher Information at current ability for each candidate
    // For 3PL: Fisher Info = a² × p × q where p = irtProbability
    candidates.forEach(q => {
      const p = irtProbability3PL(currentAbility, q.difficulty, q.discrimination, q.guessing);
      q.info = q.discrimination * q.discrimination * p * (1 - p);
    });

    // Gentle upward ramp: early on, strongly discourage leaping several
    // levels above the current estimate — the allowed "reach" widens as
    // more answers come in (~2 logits at start → ~0.8 after 8 questions),
    // so difficulty increases gradually instead of jumping a level per hit.
    const nAnswered = pAnswers.length;
    const maxUpReach = Math.max(0.5, 1.5 - nAnswered * 0.1);
    candidates.forEach(q => {
      const diff = q.difficulty - currentAbility;
      if (diff > maxUpReach) q.info *= 0.25;
    });

    // Exploration bonus: levels with fewest questions get a boost
    const levelCounts = {};
    CEFR_ORDER.forEach(l => levelCounts[l] = 0);
    pAnswers.forEach(a => { if (levelCounts[a.level] !== undefined) levelCounts[a.level]++; });
    const minCount = Math.min(...Object.values(levelCounts));

    // Category coverage bonus
    const catCounts = {};
    pAnswers.forEach(a => {
      const cat = a.category || "noun";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const minCatCount = Math.min(...Object.values(catCounts), 0);

    candidates.forEach(q => {
      // Level exploration: untouched levels get a strong boost so the test
      // probes a spread of levels instead of clustering on the current one
      if (levelCounts[q.level] === 0) {
        q.info *= 1.8;
      } else if (levelCounts[q.level] <= minCount) {
        q.info *= 1.3;
      }
      // Category exploration: +30% for under-tested categories
      const cat = q.category || "noun";
      if ((catCounts[cat] || 0) <= minCatCount) {
        q.info *= 1.3;
      }
      // Exposure penalty: reduce priority of over-exposed items
      const exposure = pExposureCount[q.index] || 0;
      q.info *= Math.pow(0.55, exposure); // 45% penalty per exposure
      // Recency penalty: slightly reduce recently seen items
      if (answeredIndices.length > 0 && answeredIndices[answeredIndices.length - 1] === q.index) {
        q.info *= 0.3;
      }
    });

    candidates.sort((a, b) => b.info - a.info);

    // ε-greedy selection with adaptive exploration rate
    // Exploration rate decreases as we get more data
    const n = pAnswers.length;
    const epsilon = Math.max(0.05, 0.20 * Math.exp(-n / 20)); // Starts at 20%, decays to 5%
    if (Math.random() < epsilon && candidates.length > 1) {
      // Pick from top candidates with equal probability (already sorted)
      const topK = candidates.slice(0, Math.min(4, candidates.length));
      return topK[Math.floor(Math.random() * topK.length)];
    }
    return candidates[0];
  }

  /* ============================================================
     Smart Early Termination — requires sufficient questions answered
     and difficulty stabilization before setting level
     ============================================================ */
  function shouldTerminate() {
    const n = pAnswers.length;

    // Must answer at least 25 questions to ensure sufficient data (correct/incorrect)
    if (n < 25) return false;

    // 5 consecutive wrong at same level → terminate
    if (pMaxConsecutiveWrong >= 5) {
      return true;
    }

    // Precision target
    if (pAbilitySE < 0.25 && n >= 28) return true;

    // Max questions reached (30)
    if (n >= 30) return true;

    // Convergence: ability has stabilized over the last 10 questions
    if (n >= 28 && pAnswers.length >= 10) {
      const recent = pAnswers.slice(-10);
      const recentAbilities = recent.map(a => {
        const subset = pAnswers.slice(0, pAnswers.length - (10 - recent.indexOf(a)));
        const est = estimateAbility(subset);
        return est.ability;
      });
      const range = Math.max(...recentAbilities) - Math.min(...recentAbilities);
      if (range < 0.06) {
        return true; // Difficulty has stabilized solidly
      }
    }

    return false;
  }

  /* ---------- Scoring & Results ---------- */
  function scorePlacement(answers) {
    const est = bayesianPrior(0, answers);
    const cefr = abilityToCefr(est.ability);
    const ci = computeCI(est.ability, est.se);

    // Per-level scores
    const levelScores = {};
    answers.forEach(ans => {
      if (!levelScores[ans.level]) levelScores[ans.level] = { correct: 0, total: 0, avgTime: 0, totalTime: 0 };
      levelScores[ans.level].total++;
      if (ans.correct) levelScores[ans.level].correct++;
      levelScores[ans.level].totalTime += ans.time;
    });
    Object.keys(levelScores).forEach(l => {
      levelScores[l].avgTime = levelScores[l].totalTime / levelScores[l].total;
      levelScores[l].pct = Math.round((levelScores[l].correct / levelScores[l].total) * 100);
    });

    // Per-category scores
    const categoryScores = {};
    answers.forEach(ans => {
      const cat = ans.category || "noun";
      if (!categoryScores[cat]) categoryScores[cat] = { correct: 0, total: 0, totalTime: 0 };
      categoryScores[cat].total++;
      if (ans.correct) categoryScores[cat].correct++;
      categoryScores[cat].totalTime += ans.time;
    });
    Object.keys(categoryScores).forEach(c => {
      categoryScores[c].pct = Math.round((categoryScores[c].correct / categoryScores[c].total) * 100);
      categoryScores[c].avgTime = categoryScores[c].totalTime / categoryScores[c].total;
    });

    // Learning recommendations based on weak areas
    const recommendations = [];
    const minLevelPct = Math.min(...Object.values(levelScores).map(l => l.pct));
    Object.entries(levelScores).forEach(([level, score]) => {
      if (score.pct < 50 && score.total >= 2) {
        const lv = CEFR_LEVELS[level];
        recommendations.push({
          type: "level",
          message: `ระดับ ${level} (${lv.th}): ควรทบทวนคำศัพท์เพิ่มเติม — คะแนนเพียง ${score.pct}%`,
          color: lv.color
        });
      }
    });
    Object.entries(categoryScores).forEach(([cat, score]) => {
      if (score.pct < 50 && score.total >= 2) {
        recommendations.push({
          type: "category",
          message: `${CATEGORY_NAMES[cat] || cat}: ควรฝึกฝนเพิ่มความเข้าใจ — คะแนนเพียง ${score.pct}%`
        });
      }
    });
    if (recommendations.length === 0) {
      recommendations.push({
        type: "general",
        message: "ผลงานดียิ่งยอด! ฝึกฝนต่อเพื่อรักษาและเพิ่มระดับ"
      });
    }

    return {
      level: cefr.level,
      nextLevel: cefr.nextLevel,
      progressToNext: cefr.progress,
      ability: est.ability,
      se: est.se,
      ci,
      levelScores,
      categoryScores,
      totalCorrect: answers.filter(a => a.correct).length,
      totalQuestions: answers.length,
      avgTime: answers.reduce((sum, a) => sum + a.time, 0) / answers.length,
      maxConsecutiveWrong: pMaxConsecutiveWrong,
      recommendations
    };
  }

  /* ---------- UI Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function animateIn(el, cb) {
    if (pAnimating) return;
    pAnimating = true;
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";
    el.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
      setTimeout(() => { pAnimating = false; if (cb) cb(); }, 250);
    });
  }

  function animateOut(el, cb) {
    if (pAnimating) return;
    pAnimating = true;
    el.style.transition = "opacity 0.18s ease, transform 0.18s ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    setTimeout(() => { pAnimating = false; if (cb) cb(); }, 180);
  }

  function playSound(correct) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = correct ? "triangle" : "sawtooth";
      osc.frequency.setValueAtTime(correct ? 523 : 220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(correct ? 784 : 165, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (e) {}
  }

  function toast(msg, type) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast " + (type === "correct" ? "toast-ok" : type === "wrong" ? "toast-err" : "");
    el.setAttribute("role", "status");
    el.innerHTML = `<span class="toast-ico">${type === "correct" ? svgIcon("check", 16) : type === "wrong" ? svgIcon("cross", 16) : svgIcon("info", 16)}</span><span class="toast-msg">${msg}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => { el.classList.add("leaving"); setTimeout(() => el.remove(), 300); }, 1800);
  }

  /* ============================================================
     Mount helpers (support rendering into any container)
     ============================================================ */
  function pBox() { return $(pMountId); }

  function pTeardown() {
    const box = pBox();
    if (box && box._kh) { document.removeEventListener("keydown", box._kh); box._kh = null; }
    pMode = "placement";
    pMountId = "placementTest";
    pStarted = false;
  }

  /* ============================================================
     Render: Intro
     ============================================================ */
  function pRenderIntro() {
    const box = pBox();
    if (!box) return;

    const isPost = pMode === "posttest";
    box.innerHTML = `
      <div class="placement-intro" role="region" aria-label="Placement Test Introduction">
        <div class="placement-badge">${svgIcon("test")} ${isPost ? "Post-Test" : "Placement Test"}</div>
        <h3>${isPost ? "แบบทดสอบหลังเรียน (Post-Test)" : "ค้นหาระดับภาษาอังกฤษของคุณ"}</h3>
        <p>${isPost
          ? "ตอบคำถามชุดเดียวกับแบบวัดระดับตอนแรก เพื่อเปรียบเทียบระดับและความสามารถก่อน-หลังเรียน"
          : "ตอบคำถามไม่เกิน 30 ข้อ เพื่อประเมินคำศัพท์ตามระดับ CEFR (A1–C2)"}</p>
        <p class="placement-hint">ระบบปรับความยากตามคำตอบของคุณ</p>
        <div class="placement-features">
          <div class="feature">${svgIcon("spark")}<span>ปรับความยากอัตโนมัติ</span></div>
          <div class="feature">${svgIcon("target")}<span>คำนึงถึงเวลาที่ใช้ตอบ</span></div>
          <div class="feature">${svgIcon("clock")}<span>3–5 นาที</span></div>
        </div>
        <button class="btn btn-primary btn-lg" id="placementStart" aria-label="${isPost ? "เริ่มแบบทดสอบหลังเรียน" : "เริ่มแบบทดสอบ"}">
          ${svgIcon("play")}<span>${isPost ? "เริ่มแบบทดสอบหลังเรียน" : "เริ่มแบบทดสอบ"}</span>
        </button>
        ${isPost ? `<button class="btn btn-secondary btn-lg" id="placementCancelPost" style="margin-top:10px">${svgIcon("arrowLeft")}<span>ยกเลิก</span></button>` : ""}
        <p class="placement-note">กดปุ่มหรือ <kbd>Enter</kbd>/<kbd>Space</kbd> เพื่อเริ่ม</p>
      </div>
    `;

    const btn = $("placementStart");
    btn.focus();
    btn.onclick = () => {
      pStarted = true;
      pAnswers = [];
      pCurrentAbility = 0;
      pAbilitySE = 1.5;
      pExposureCount = {};
      pConsecutiveWrong = 0;
      pConsecutiveLevel = null;
      pMaxConsecutiveWrong = 0;
      CEFR_ORDER.forEach(l => LEVEL_COUNTS[l] = { correct: 0, total: 0 });
      pStartTime = Date.now();
      pRenderQuestion();
    };
    const cancel = $("placementCancelPost");
    if (cancel) {
      cancel.onclick = () => {
        pTeardown();
        if (window.VocabApp?.showView) window.VocabApp.showView("exam");
      };
    }
  }

  /* ============================================================
     Render: Question
     ============================================================ */
  function pRenderQuestion() {
    const box = pBox();
    if (!box) return;

    // Select question — always adaptive from Q1
    let q;
    const answered = pAnswers.map(a => a.index);
    q = selectNextQuestion(answered, pCurrentAbility);
    if (!q) { pRenderResult(); return; }

    // Progress bar shows relative to expected test length (max 30)
    const maxQ = 30;
    const progress = Math.min(100, (pAnswers.length / maxQ) * 100);
    const qNum = pAnswers.length + 1;

    const optsHtml = q.options.map((opt, i) => `
      <button class="placement-opt" data-i="${i}" tabindex="0" role="radio" aria-label="ตัวเลือก ${i+1}: ${opt}">
        <span class="opt-label">${["A","B","C","D","E","F"][i]}</span>
        <span class="opt-text">${opt}</span>
      </button>
    `).join("");

    const container = document.createElement("div");
    container.className = "placement-testing";
    container.innerHTML = `
      <div class="placement-header">
        <div class="placement-progress" role="progressbar" aria-valuenow="${Math.max(0, Math.round(progress))}" aria-valuemin="0" aria-valuemax="100">
          <div class="pp-bar"><i style="width:${progress}%"></i></div>
          <span class="pp-text">ข้อ ${qNum}</span>
        </div>
      </div>
      <div class="placement-content">
        <div class="placement-word">${q.word}</div>
        <div class="placement-question">ความหมายของคำนี้คืออะไร?</div>
        <div class="placement-opts" role="radiogroup" aria-label="ตัวเลือกคำตอบ">${optsHtml}</div>
      </div>
      <div class="placement-hint-bar">
        <kbd>1</kbd>–<kbd>6</kbd> / <kbd>A</kbd>–<kbd>F</kbd> ตอบ | <kbd>Enter</kbd> ยืนยัน
      </div>
    `;

    if (box.firstElementChild) {
      animateOut(box.firstElementChild, () => {
        box.innerHTML = "";
        box.appendChild(container);
        animateIn(container);
        setupHandlers(q);
      });
    } else {
      box.appendChild(container);
      animateIn(container);
      setupHandlers(q);
    }

    pQuestionStartTime = Date.now();
  }

  function setupHandlers(q) {
    const box = pBox();
    const opts = box.querySelectorAll(".placement-opt");

    opts.forEach(btn => {
      const handle = () => {
        if (pAnimating) return;
        const sel = parseInt(btn.dataset.i, 10);
        const correct = sel === q.answer;
        const time = Date.now() - pQuestionStartTime;

        // Visual feedback
        opts.forEach(b => {
          b.disabled = true;
          b.classList.remove("selected");
          if (parseInt(b.dataset.i, 10) === q.answer) b.classList.add("correct");
          if (parseInt(b.dataset.i, 10) === sel && !correct) b.classList.add("wrong");
        });
        btn.classList.add("selected");

        playSound(correct);
        toast(correct ? "ถูกต้อง!" : `ผิด — คำตอบ: "${q.options[q.answer]}"`, correct ? "correct" : "wrong");

        // Time-based adjustment for ability update
        const timeAdj = correct ? timeAdjustment(time, q.level) : -Math.abs(timeAdjustment(time, q.level));

        // Record — store the real index (selectNextQuestion returns a copy
        // carrying .index) so answered questions are excluded next round.
        pAnswers.push({
          index: q.index,
          selected: sel, correct, time,
          level: q.level, difficulty: q.difficulty, discrimination: q.discrimination,
          guessing: q.guessing, timeAdjustment: timeAdj,
          category: q.category
        });
        // Track exposure so a question that resurfaces is deprioritized.
        pExposureCount[q.index] = (pExposureCount[q.index] || 0) + 1;

        // Update level scores
        if (LEVEL_COUNTS[q.level]) {
          LEVEL_COUNTS[q.level].total++;
          if (correct) LEVEL_COUNTS[q.level].correct++;
        }

        // Track consecutive wrongs
        if (!correct) {
          if (pConsecutiveLevel === q.level) {
            pConsecutiveWrong++;
          } else {
            pConsecutiveLevel = q.level;
            pConsecutiveWrong = 1;
          }
          pMaxConsecutiveWrong = Math.max(pMaxConsecutiveWrong, pConsecutiveWrong);
        } else {
          pConsecutiveWrong = 0;
          pConsecutiveLevel = null;
        }

        // Update ability — Bayesian posterior (shrinks early overshoot from
        // MLE) + gradual commitment so the estimate moves smoothly instead of
        // spiking after a couple of lucky answers.
        const est = bayesianPrior(pCurrentAbility, pAnswers);
        const commit = Math.min(1, pAnswers.length / 6); // 0→100% over first 6 answers
        pCurrentAbility = pCurrentAbility + (est.ability - pCurrentAbility) * commit + timeAdj;
        pAbilitySE = est.se;

        // Next — check smart termination
        setTimeout(() => {
          if (shouldTerminate()) {
            pRenderResult();
          } else {
            pRenderQuestion();
          }
        }, 500);
      };

      btn.onclick = handle;
      btn.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handle(); } };
    });

    // Keyboard 1-4, A-D
    const kh = e => {
      if (pAnimating) return;
      const idx = "123456ABCDEF".indexOf(e.key.toUpperCase());
      if (idx >= 0 && idx < 6) { e.preventDefault(); opts[idx]?.click(); }
    };
    document.addEventListener("keydown", kh);
    box._kh = kh;
  }

  /* ============================================================
     Render: Result
     ============================================================ */
  function pRenderResult() {
    const box = pBox();
    if (!box) return;

    const res = scorePlacement(pAnswers);
    const isPost = pMode === "posttest";
    // Save progress for progress bar in cefr-selector
    try {
      const store = window.SecureStore || { load: (k, fb) => { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(e) { return fb; } }, save: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} } };
      const p = store.load("vocab_progress_v1", {}) || {};
      if (!isPost) {
        // Only the placement (pretest) writes the CEFR level + ability fields.
        window.setCefrLevel(res.level);
        p.cefrLevel = res.level;
        p.cefrProgressToNext = res.progressToNext;
        p.cefrAbility = res.ability;
        p.cefrSE = res.se;
        p.cefrLevelScores = res.levelScores;
        // Keep pretest score for before/after comparison.
        p.cefrTotalCorrect = res.totalCorrect;
        p.cefrTotalQuestions = res.totalQuestions;
        store.save("vocab_progress_v1", p);
      } else {
        // Post-test: record the result but never touch the pretest level.
        const list = store.load("vocab_posttest_v1", []) || [];
        list.unshift({
          date: new Date().toISOString().slice(0, 10),
          ts: Date.now(),
          level: res.level,
          ability: Math.round(res.ability * 100) / 100,
          se: Math.round(res.se * 100) / 100,
          progressToNext: Math.round(res.progressToNext * 100) / 100,
          totalCorrect: res.totalCorrect,
          totalQuestions: res.totalQuestions,
          timeSec: Math.round((Date.now() - pStartTime) / 1000)
        });
        store.save("vocab_posttest_v1", list.slice(0, 10));
      }
    } catch (e) {}

    // Notify CEFR system of level change (pretest only)
    if (!isPost && window.VocabApp?.onCefrLevelChange) {
      window.VocabApp.onCefrLevelChange(res.level);
    }

    const lv = CEFR_LEVELS[res.level];
    const nextLv = res.nextLevel ? CEFR_LEVELS[res.nextLevel] : null;
    const totSec = Math.round((Date.now() - pStartTime) / 1000);
    const m = Math.floor(totSec / 60), s = totSec % 60;

    const ciW = res.ci.upper - res.ci.lower;
    let confLabel, confClass;
    if (ciW < 0.7) { confLabel = "สูงมาก"; confClass = "high"; }
    else if (ciW < 1.2) { confLabel = "สูง"; confClass = "medium"; }
    else if (ciW < 1.7) { confLabel = "ปานกลาง"; confClass = "low"; }
    else { confLabel = "ต่ำ"; confClass = "very-low"; }

    // Time efficiency label
    let timeLabel = "ปกติ";
    if (res.avgTime < 5000) timeLabel = "เร็วมาก";
    else if (res.avgTime < 8000) timeLabel = "เร็ว";
    else if (res.avgTime > 15000) timeLabel = "ละเอียด";

    // Consecutive wrong warning
    let warningHtml = "";
    if (res.maxConsecutiveWrong >= 3) {
      warningHtml = `<div class="result-warning">${svgIcon("alert", 16)} ตอบผิดต่อเนื่อง ${res.maxConsecutiveWrong} ข้อ — ระดับอาจต่ำกว่าที่ประเมิน</div>`;
    }

    // Category scores HTML
    const categoryHtml = Object.entries(res.categoryScores).map(([cat, score]) => {
      const pct = score.pct;
      const catName = CATEGORY_NAMES[cat] || cat;
      return `<div class="score-card" style="--sc:${lv.color}">
        <div class="score-header"><span class="score-level">${catName}</span><span class="score-pct">${pct}%</span></div>
        <div class="score-bar"><i style="width:${pct}%"></i></div>
        <span class="score-detail">${score.correct}/${score.total}</span>
      </div>`;
    }).join("");

    // Recommendations HTML
    const recHtml = res.recommendations.map(r =>
      `<div class="recommendation ${r.type === "general" ? "rec-general" : ""}" style="${r.color ? `border-left:3px solid ${r.color}` : ''}">
        ${svgIcon("lightbulb", 16)} ${r.message}
      </div>`
    ).join("");

    // Before/after comparison block (post-test only, needs pretest data)
    let compareHtml = "";
    if (isPost) {
      try {
        const store = window.SecureStore || { load: (k, fb) => { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(e) { return fb; } }, save: () => {} };
        const p = store.load("vocab_progress_v1", {}) || {};
        const preLv = p.cefrLevel;
        if (preLv && CEFR_LEVELS[preLv]) {
          const preInfo = CEFR_LEVELS[preLv];
          const postInfo = CEFR_LEVELS[res.level] || preInfo;
          const preAb = typeof p.cefrAbility === "number" ? Number(p.cefrAbility).toFixed(2) : "—";
          const preTot = (p.cefrTotalCorrect != null ? p.cefrTotalCorrect + "/" + (p.cefrTotalQuestions != null ? p.cefrTotalQuestions : "?") : "—");
          const lvDelta = CEFR_ORDER.indexOf(res.level) - CEFR_ORDER.indexOf(preLv);
          const trend = lvDelta > 0 ? "better" : lvDelta < 0 ? "worse" : "same";
          const trendLabel = lvDelta > 0 ? "ดีขึ้น" : lvDelta < 0 ? "ลดลง" : "เท่าเดิม";
          const deltaTxt = lvDelta !== 0 ? (lvDelta > 0 ? "+" : "") + lvDelta + " ระดับ" : "ระดับเท่าเดิม";
          const abDelta = Number((res.ability - (typeof p.cefrAbility === "number" ? p.cefrAbility : 0)).toFixed(2));
          compareHtml = `
            <div class="result-scores">
              <h4>${svgIcon("chart", 16)} เปรียบเทียบก่อน-หลังเรียน</h4>
              <div class="score-grid">
                <div class="score-card" style="--sc:${preInfo.color}">
                  <div class="score-header"><span class="score-level">ก่อนเรียน ${preLv}</span></div>
                  <span class="score-detail">ความสามารถ θ = ${preAb}</span>
                  <span class="score-detail">คะแนน ${preTot}</span>
                </div>
                <div class="score-card current" style="--sc:${postInfo.color}">
                  <div class="score-header"><span class="score-level">หลังเรียน ${res.level}</span></div>
                  <span class="score-detail">ความสามารถ θ = ${Number(res.ability).toFixed(2)}</span>
                  <span class="score-detail">คะแนน ${res.totalCorrect}/${res.totalQuestions}</span>
                </div>
              </div>
              <div class="result-trend ${trend}">${svgIcon(trend === "better" ? "check" : trend === "worse" ? "alert" : "info", 16)} ${trendLabel} · ${deltaTxt} · θ ${abDelta >= 0 ? "+" : ""}${abDelta}</div>
            </div>`;
        }
      } catch (e) {}
    }

    const container = document.createElement("div");
    container.className = "placement-result";
    container.style.setProperty("--lv-color", lv.color);
    container.innerHTML = `
      <div class="result-header">
        <div class="result-badge">${svgIcon("award")} ${isPost ? "Post-Test เสร็จสิ้น" : "เสร็จสิ้น"}</div>
        <h2 class="result-level" style="color:${lv.color}">${res.level}</h2>
        <div class="result-level-name">${lv.name} · ${lv.th}</div>
        ${nextLv ? `
          <div class="result-progress">
            <div class="progress-track" style="--prog:${(res.progressToNext*100).toFixed(0)}%">
              <div class="progress-fill"></div>
            </div>
            <span class="progress-label">เข้าสู่ ${nextLv.name} (${nextLv.th}) — ${(res.progressToNext*100).toFixed(0)}%</span>
          </div>` : `<div class="result-progress maxed">ระดับสูงสุดแล้ว! ${svgIcon("award", 20)}</div>`}
      </div>

      <div class="result-confidence ${confClass}">
        <div class="confidence-meter"><div class="confidence-fill" style="width:${Math.max(0, 100 - ciW * 25)}%"></div></div>
        <div class="confidence-info">
          <span class="confidence-label">ความมั่นใจ: ${confLabel}</span>
        </div>
      </div>

      ${warningHtml}

      <div class="result-scores">
        <h4>รายละเอียดคะแนนรายระดับ</h4>
        <div class="score-grid">
          ${CEFR_ORDER.map(l => {
            const ls = res.levelScores[l] || { correct: 0, total: 0, pct: 0 };
            const c = CEFR_LEVELS[l].color;
            const cur = l === res.level;
            return `<div class="score-card ${cur ? "current" : ""}" style="--sc:${c}">
              <div class="score-header"><span class="score-level" style="color:${c}">${l}${cur ? " ←" : ""}</span><span class="score-pct">${ls.pct}%</span></div>
              <div class="score-bar"><i style="width:${ls.pct}%"></i></div>
              <span class="score-detail">${ls.correct}/${ls.total}</span>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="result-scores">
        <h4>คะแนนแยกตามประเภทคำ</h4>
        <div class="score-grid">
          ${categoryHtml}
        </div>
      </div>

      <div class="result-stats">
        <div class="stat"><span class="stat-value">${res.totalCorrect}/${res.totalQuestions}</span><span class="stat-label">ถูกต้อง</span></div>
        <div class="stat"><span class="stat-value">${m}:${s.toString().padStart(2,"0")}</span><span class="stat-label">เวลา</span></div>
        <div class="stat"><span class="stat-value">${res.avgTime ? (res.avgTime/1000).toFixed(1) : 0}s</span><span class="stat-label">เฉลี่ย/ข้อ</span></div>
        <div class="stat"><span class="stat-value">${res.avgTime < 5000 ? "เร็ว" : res.avgTime > 15000 ? "ละเอียด" : "ปกติ"}</span><span class="stat-label">จังหวะตอบ</span></div>
      </div>

      ${compareHtml}

      <div class="result-recommendations">
        <h4>${svgIcon("lightbulb", 18)} คำแนะนำ</h4>
        ${recHtml}
      </div>

      ${isPost
        ? `<p class="result-desc">ระดับหลังเรียนของคุณคือ <b style="color:${lv.color}">${res.level} (${lv.th})</b> — ระดับเดิมที่ใช้จัดการเรียนของคุณยังคงเป็นแบบก่อนเรียน</p>
          <button class="btn btn-primary btn-lg" id="placementGotoStats">${svgIcon("chart")}<span>ดูการวิเคราะห์</span></button>`
        : `<p class="result-desc">ระดับของคุณคือ <b style="color:${lv.color}">${res.level} (${lv.th})</b> — ระบบจัดแผนเรียนให้อัตโนมัติแล้ว</p>
          <button class="btn btn-primary btn-lg" id="placementGotoTasks">${svgIcon("arrowRight")}<span>ดูแผนการเรียน</span></button>`}
      <button class="btn btn-secondary" id="placementRetake">${svgIcon("refresh")}<span>${isPost ? "ทำแบบทดสอบอีกครั้ง" : "ทดสอบใหม่"}</span></button>
    `;

    // Cleanup
    if (box._kh) { document.removeEventListener("keydown", box._kh); box._kh = null; }

    if (box.firstElementChild) {
      animateOut(box.firstElementChild, () => {
        box.innerHTML = "";
        box.appendChild(container);
        animateIn(container);
        bindResultBtns();
        confetti(lv.color);
      });
    } else {
      box.appendChild(container);
      animateIn(container);
      bindResultBtns();
      confetti(lv.color);
    }
  }

  function bindResultBtns() {
    const isPost = pMode === "posttest";
    $("placementGotoTasks")?.addEventListener("click", () => {
      if (window.VocabApp?.showView) window.VocabApp.showView("tasks");
      else document.querySelector('.nav-btn[data-view="tasks"]')?.click();
    });
    $("placementGotoStats")?.addEventListener("click", () => {
      pTeardown();
      if (window.VocabApp?.showView) window.VocabApp.showView("stats");
    });
    $("placementRetake")?.addEventListener("click", () => {
      if (!confirm(isPost ? "ทำแบบทดสอบอีกครั้ง? ประวัติเดิมยังคงเก็บไว้" : "ทดสอบใหม่? ผลเดิมจะหาย")) return;
      const done = () => {
        pStarted = false; pAnswers = []; pCurrentAbility = 0; pAbilitySE = 1.5;
        pExposureCount = {}; pConsecutiveWrong = 0; pMaxConsecutiveWrong = 0;
        pRenderIntro();
      };
      if (!isPost) {
        window.setCefrLevel(null);
        if (window.VocabApp?.onCefrLevelChange) {
          window.VocabApp.onCefrLevelChange("A1");
        }
      }
      done();
    });
  }

  function confetti(color) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const colors = [color, "#6366f1", "#06b6d4", "#8b5cf6", "#22c55e"];
    for (let i = 0; i < 25; i++) {
      setTimeout(() => {
        const el = document.createElement("i");
        el.className = "confetti-piece";
        el.style.cssText = `left:${50+(Math.random()-0.5)*40}%;background:${colors[Math.floor(Math.random()*colors.length)]};--dx:${(Math.random()-0.5)*300}px;--dy:${100+Math.random()*200}px;--rot:${Math.random()*720-360}deg`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1800);
      }, i * 25);
    }
  }

  /* ---------- Init ---------- */
  function initPlacement() {
    pTeardown();
    const box = pBox();
    if (!box) return;
    if (!window.hasTakenPlacementTest()) { pStarted = false; pRenderIntro(); }
    else { box.innerHTML = ""; box.style.display = "none"; }
  }

  /* Point the engine at another container (post-test) or restore defaults. */
  function pSetMount(mountId, mode) {
    pTeardown();
    pMountId = mountId || "placementTest";
    pMode = mode || "placement";
    pStarted = false;
    pAnswers = [];
  }

  window.VocabPlacement = {
    init: initPlacement,
    render: pRenderQuestion,
    renderIntro: pRenderIntro,
    setMount: pSetMount,
    teardown: pTeardown,
    getMode: () => pMode,
    questions: PLACEMENT_QUESTIONS,
    score: scorePlacement,
    estimateAbility,
    reset: () => {
      pStarted = false; pAnswers = []; pCurrentAbility = 0; pAbilitySE = 1.5;
      pExposureCount = {}; pConsecutiveWrong = 0; pMaxConsecutiveWrong = 0;
      CEFR_ORDER.forEach(l => LEVEL_COUNTS[l] = { correct: 0, total: 0 });
    },
    setAdaptiveMode: v => { pAdaptiveMode = !!v; }
  };
})();
