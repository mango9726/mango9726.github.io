# Vocab Trainer

แอปฝึกคำศัพท์ภาษาอังกฤษระดับ B1 — Flashcards + SRS (Spaced Repetition) + Quiz + เกมฝึกคำศัพท์ 10 โหมด + ระบบบัญชีผู้ใช้ (Login/Register/Sync)

## วิธีเริ่มใช้งาน

รันไฟล์ **`start.bat`** แล้วเลือกโหมด:

| โหมด | พอร์ต | ฟีเจอร์ |
|------|-------|---------|
| **1. With User Accounts** | `http://localhost:3001` | Login/Register + Sync ข้อมูลกับ server (Node.js + Express) |
| **2. Static Only** | `http://localhost:8000` | ไม่มี backend — บันทึกความคืบหน้าในเครื่องเท่านั้น |

> 💡 **แนะนำโหมด 1** เพื่อใช้ระบบ Login/Register และ Sync ข้อมูลข้ามเครื่อง

## โครงสร้างโปรเจกต์

```
vocab/
├── index.html              # หน้าเว็บหลัก (SPA)
├── start.bat               # ตัวรัน server (เลือกโหมด 1 หรือ 2)
├── manifest.webmanifest    # PWA manifest
├── service-worker.js       # Service worker (offline + installable)
├── offline.html            # หน้า offline fallback
├── README.md               # เอกสารนี้
├── assets/
│   ├── css/
│   │   └── style.css       # รวม CSS ทั้งหมด (รวม mini-player.css แล้ว)
│   ├── js/
│   │   ├── vocab-data.js   # ข้อมูลคำศัพท์ (VOCAB_DAYS)
│   │   ├── app.js          # ตัวหลัก: เกม, SRS, i18n, UI (รวม flags.js แล้ว)
│   │   ├── mini-player.js  # เครื่องเล่นเพลงลอย
│   │   ├── boot.js         # Boot mini-player
│   │   └── auth.js         # ระบบ Login/Register/Sync
│   ├── audio/              # เสียงเอฟเฟกต์
│   ├── img/                # ไอคอน/รูปภาพ
│   └── music/              # เพลงพื้นหลัง (onpage/ingame)
├── server/
│   ├── server.js           # Backend: Express + JWT + bcrypt
│   ├── package.json        # Dependencies
│   └── vocab-db.json       # ฐานข้อมูลผู้ใช้ (JSON file)
├── docs/
│   ├── DEPLOY.md           # คู่มือ deploy
│   └── MINI_PLAYER_GUIDE.md # คู่มือ mini-player
└── tools/
    └── gen_icons.py        # สคริปต์สร้างไอคอน
```

## ฟีเจอร์หลัก

- **Flashcards** — SRS (SM-2) เกรด Again/Hard/Good/Easy
- **Quiz** — Word→Meaning / Sentence→Thai
- **Daily Tasks** — ทบทวนแบบห่างกัน (spaced review)
- **เกม 10 โหมด** — Pronunciation, Fill-in-the-Blank, Card Match, True/False, Hangman, Sentence Builder, Cloze, Listen & Type, Boss Rush
- **Gamification** — XP, Level, Rank, Achievements, Daily Quests, Streak
- **ระบบบัญชี** — สมัคร/เข้าสู่ระบบ/ออกจากระบบ + Sync ข้อมูลกับ server
- **PWA** — ติดตั้งเป็นแอปได้, ใช้งาน offline
- **i18n** — ไทย / English
- **Backup/Restore** — ย้ายข้อมูลข้ามเครื่อง

## การ deploy

### วิธีที่ 1: GitHub Pages + Firebase (แนะนำ — Google Login + sync ข้ามเครื่อง)

**ขั้นตอนติดตั้ง Firebase:**

1. ไป https://console.firebase.google.com → สร้าง project ใหม่ (ฟรี)
2. เปิด **Authentication** → Sign-in method → เปิด **Google** และ **Email/Password**
3. สร้าง **Firestore Database** (เลือก "Start in test mode")
4. ไป **Project Settings** → General → Your apps → เพิ่ม Web app (คลิกไอคอน `</>`)
5. คัดลอก Firebase config (apiKey, authDomain, projectId, ฯลฯ)
6. เปิดไฟล์ `web/vocab/assets/js/firebase-config.js` แล้ววาง config ของคุณแทนค่า placeholder
7. ใน **Authentication** → Settings → Authorized domains → เพิ่ม domain ของ GitHub Pages (เช่น `username.github.io`)

**Deploy ขึ้น GitHub Pages:**

```bash
# ใน repo root:
git subtree push --prefix web/vocab origin gh-pages
```

หลัง deploy แล้ว:
- ✅ **Google Login** คลิกปุ่ม → ล็อกอินด้วย Google ได้เลย
- ✅ **Email/Password** สมัคร/ล็อกอินได้
- ✅ **Sync ข้ามเครื่อง** ข้อมูลเก็บใน Firestore — เปิดเครื่องไหนก็เห็นข้อมูลเดียวกัน
- ✅ **จดจำการเข้าสู่ระบบ** เลือกได้ว่าจะจำหรือไม่

> 💡 **ฟรี tier:** 1GB storage, 50K reads/day, 20K writes/day — เพียงพอสำหรับแอปเล็กๆ

### วิธีที่ 2: GitHub Pages ไม่มี Firebase (localStorage only)

ถ้ายังไม่ได้ตั้งค่า Firebase ระบบจะใช้ localStorage อัตโนมัติ:
- สมัคร/ล็อกอินได้ (เก็บในเครื่อง)
- รหัสผ่านถูก hash ด้วย SHA-256
- ไม่มี sync ข้ามเครื่อง

### วิธีที่ 3: Local server (มี backend เต็มรูปแบบ)

รัน `start.bat` แล้วเลือก **1** (With User Accounts) — จะมี login/register/sync ผ่าน backend บนพอร์ต 3001

## หมายเหตุ

- ข้อมูลความคืบหน้าเก็บใน `localStorage` (เข้ารหัส AES-GCM ผ่าน IndexedDB)
- เมื่อล็อกอิน ข้อมูลจะ sync ไปยัง server อัตโนมัติ (debounce 2 วินาที)
- เพิ่มคำศัพท์ใหม่รายวันโดยบอก Claude: `"Day N, [หัวข้อหรือ random]"`
- บน GitHub Pages + Firebase: Google Login + sync ข้ามเครื่องได้ (Firestore)
- บน GitHub Pages ไม่มี Firebase: ใช้ localStorage (สมัคร/ล็อกอินได้ แต่ไม่ sync ข้ามเครื่อง)
- บน Local server (พอร์ต 3001): ระบบ login/register/sync แบบเต็มรูปแบบ (sync ข้ามเครื่องได้)
- ระบบเลือกโหมดอัตโนมัติ: Firebase > Backend > localStorage
