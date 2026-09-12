# Vocab Trainer

แอปฝึกคำศัพท์ภาษาอังกฤษครอบคลุมระดับ **CEFR A1–C2** — Flashcards + SRS (Spaced Repetition แบบ FSRS-5) + Quiz + เกมฝึกคำศัพท์ 10+ โหมด + ระบบบัญชีผู้ใช้ (Login/Register/Sync) + เครื่องเล่นเพลง Lo-Fi ในตัว

ทำให้เป็น **Static site 100%** — ไม่มี backend, ไม่มี build step, deploy ไป GitHub Pages ได้ทันที

## วิธีเริ่มใช้งาน (รันในเครื่อง)

เปิดโฟลเดอร์ `web/vocab` แล้วรันคำสั่ง:

```bash
python -m http.server 8000
```

เปิดเบราว์เซอร์ (Chrome/Edge แนะนำ) ไปที่ **http://localhost:8000**

> 💡 *อย่าเปิด `index.html` โดยการดับเบิลคลิก (protocol `file://`) — ไมโครโฟนจะขออนุญาตใหม่ทุกครั้ง ควรใช้ `http://localhost` เสมอ*

## โครงสร้างโปรเจกต์

```
vocab/
├── index.html              # หน้าเว็บหลัก (SPA) — รวมทุกหน้าจอ
├── README.md               # เอกสารนี้
├── file-guide.txt          # อธิบายหน้าที่ทุกไฟล์ แบบเข้าใจง่าย
├── assets/
│   ├── css/
│   │   └── style.css       # ชุดหน้าตาของแอป (รวม CSS ทั้งหมด)
│   ├── js/
│   │   ├── core/           # เครื่องยนต์หลัก (โหลดก่อนหมด)
│   │   │   ├── app.js          # ตัวหลัก: เกม, SRS, UI, ระบบทั้งหมด
│   │   │   ├── i18n.js         # ข้อความภาษาไทย/อังกฤษ + ไอคอน
│   │   │   ├── cefr-levels.js  # นิยามระดับ CEFR A1–C2
│   │   │   ├── cefr-selector.js# ตัวเลือกระดับ + กรองคำศัพท์
│   │   │   ├── fsrs-scheduler.js # อัลกอริทึม FSRS-5 (spaced repetition)
│   │   │   ├── csv-tools.js    # เครื่องมือ CSV (นำเข้า/ส่งออก)
│   │   │   └── boot.js         # Boot mini-player
│   │   ├── data/           # ข้อมูลคำศัพท์
│   │   │   ├── cefr-main.js    # ข้อมูลหลัก + getThaiMeaning
│   │   │   ├── levels/         # แผนรายวันแต่ละระดับ (A1–C2)
│   │   │   ├── extras/         # คำเสริม / collocations / idioms
│   │   │   └── examples/       # ตัวอย่างประโยคแต่ละระดับ
│   │   ├── games/          # เกม/แบบทดสอบแยกโมดูล
│   │   │   ├── placement.js    # Placement Test (วัดระดับ)
│   │   │   ├── exam.js         # Test Center (ข้อสอบจับเวลา)
│   │   │   └── levelup-exam.js # Level-Up Exam
│   │   ├── ui/             # วิดเจ็ต UI
│   │   │   └── mini-player.js  # เครื่องเล่นเพลงลอย
│   │   └── auth/           # ระบบผู้ใช้
│   │       ├── firebase-config.js # config Firebase (Email/Password)
│   │       ├── auth.js          # Login/Register/Sync
│   │       └── admin-panel.js   # Admin Control Center
│   ├── audio/              # เสียงเอฟเฟกต์
│   ├── img/                # ไอคอน/รูปภาพ
│   └── music/              # เพลงพื้นหลัง (onpage/ingame)
```

> มี `file-guide.txt` อยู่ในโฟลเดอร์นี้ — เปิดอ่านได้เลยว่าหน้าที่ของแต่ละไฟล์คืออะไร

## ฟีเจอร์หลัก

- **Flashcards** — SRS (FSRS-5) เกรด Again/Hard/Good/Easy
- **Quiz** — Word→Meaning / Sentence→Thai
- **Daily Tasks** — ทบทวนแบบห่างกัน (spaced review)
- **เกม 10+ โหมด** — Pronunciation, Fill-in-the-Blank, Card Match, True/False, Hangman, Sentence Builder, Cloze, Listen & Type, Boss Rush
- **Gamification** — XP, Level, Rank, Achievements, Daily Quests, Streak
- **ระบบบัญชี** — สมัคร/เข้าสู่ระบบ/ออกจากระบบ + Sync ข้อมูลผ่าน Firebase
- **i18n** — ไทย / English
- **เครื่องเล่นเพลง Lo-Fi** — Spotify-style overlay (Favorites / History / Stations)

## การ deploy

### วิธีที่ 1: GitHub Pages + Firebase (แนะนำ — Email/Password + sync ข้ามเครื่อง)

**ขั้นตอนติดตั้ง Firebase:**

1. ไป https://console.firebase.google.com → สร้าง project ใหม่ (ฟรี)
2. เปิด **Authentication** → Sign-in method → เปิด **Email/Password**
3. สร้าง **Firestore Database** (เลือก "Start in test mode")
4. ไป **Project Settings** → General → Your apps → เพิ่ม Web app (คลิกไอคอน `</>`)
5. คัดลอก Firebase config (apiKey, authDomain, projectId, ฯลฯ)
6. เปิดไฟล์ `web/vocab/assets/js/auth/firebase-config.js` แล้ววาง config ของคุณแทนค่า placeholder
7. ใน **Authentication** → Settings → Authorized domains → เพิ่ม domain ของ GitHub Pages (เช่น `username.github.io`)

**Deploy ขึ้น GitHub Pages:**

```bash
# ใน repo root:
git subtree push --prefix web/vocab origin gh-pages
```

หลัง deploy แล้ว:
- ✅ **Email/Password** สมัคร/ล็อกอินได้
- ✅ **Sync ข้ามเครื่อง** ข้อมูลเก็บใน Firestore — เปิดเครื่องไหนก็เห็นข้อมูลเดียวกัน
- ✅ **จดจำการเข้าสู่ระบบ** เลือกได้ว่าจะจำหรือไม่

> 💡 **ฟรี tier:** 1GB storage, 50K reads/day, 20K writes/day — เพียงพอสำหรับแอปเล็กๆ

### วิธีที่ 2: GitHub Pages ไม่มี Firebase (localStorage only)

ถ้ายังไม่ได้ตั้งค่า Firebase ระบบจะใช้ localStorage อัตโนมัติ:
- สมัคร/ล็อกอินได้ (เก็บในเครื่อง)
- รหัสผ่านถูก hash ด้วย SHA-256
- ไม่มี sync ข้ามเครื่อง

## หมายเหตุ

- ข้อมูลความคืบหน้าเก็บใน `localStorage` (เข้ารหัส AES-GCM ผ่าน IndexedDB — SecureStore)
- เมื่อล็อกอิน ข้อมูลจะ sync ไปยัง Firebase อัตโนมัติ (debounce 2 วินาที) — เก็บใน Firestore
- เพิ่มคำศัพท์ใหม่รายวันโดยบอก Claude: `"Day N, [หัวข้อหรือ random]"`
- บน GitHub Pages + Firebase: Email/Password + sync ข้ามเครื่องได้ (Firestore)
- บน GitHub Pages ไม่มี Firebase: ใช้ localStorage (สมัคร/ล็อกอินได้ แต่ไม่ sync ข้ามเครื่อง)
- ระบบเลือกโหมดอัตโนมัติ: Firebase > localStorage