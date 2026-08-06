# DEVELOPMENT_WORKFLOW.md

> **Persistent Developer Workflow & Task Tracker** for the Vocab Trainer web app.
> Claude reads this file at the start of every coding session and updates the
> **Dynamic Task Board** immediately after any change. Keep it clean and current.

---

## 1. Project Overview

**What it is**
A browser-based **English vocabulary trainer** (B1 level, with a Thai-language UI) called
*Vocab Trainer*. It helps you learn words through spaced repetition (Leitner/SRS) plus a
suite of study modes and mini-games: Flashcards, Quiz, Pronunciation (mic), Fill-in-the-Blank,
Card Match, True/False (timed), Hangman, Sentence Builder, Cloze, and Listen & Type. It also
has Daily Tasks, a Browse/Search view, theme + sound + music settings, and a backup/restore
system. Most recently, an in-game **Spotify-style Mini Music Player** overlay was added.

**Tech stack**
- **Vanilla HTML5 + CSS3 + JavaScript** (ES5/ES6). **No framework, no bundler, no transpile.**
- **No backend, no database.** All progress lives in the browser via `localStorage`.
- **Audio:** HTML5 `<audio>` for music + the Web Audio API for UI sound effects (no files needed).
- **Icons:** inline SVG icon set (no icon library).
- **Fonts:** Google Fonts — *Inter* + *Noto Sans Thai*.
- **Served as a static site** by Python's `http.server` (no Node.js in the toolchain).
- **No package manager, no build step, no automated tests** (yet — see Backlog).

**Project structure**
```
codex/                         ← repository root
├─ CLAUDE.md                   ← project memory / standing instructions
├─ README.md                   ← original project readme
├─ WORKFLOW.md                 ← knowledge-base day-to-day routine
├─ notes/                      ← markdown knowledge base
├─ web/vocab/                  ← ★ THE WEB APP (this is what you run) ★
│  ├─ index.html               ← entry point (loads the scripts below, in order)
│  ├─ vocab-data.js            ← word/collocation/idiom data
│  ├─ app.js                   ← all UI + game logic (one big IIFE)
│  ├─ style.css                ← app styles (uses --accent/--panel/--text tokens, light+dark)
│  ├─ mini-player.js           ← Spotify-style music overlay (manager + UI)
│  ├─ mini-player.css          ← music overlay styles (clean white & blue, decoupled from host theme)
│  ├─ MINI_PLAYER_GUIDE.md     ← how to integrate / hook up the player
│  ├─ start-server.bat         ← Windows launcher (python -m http.server 8000)
│  ├─ button sound.mp3         ← UI click sound
│  └─ song/
│     ├─ onpage/               ← background "on-page" music (10 tracks)
│     └─ ingame/               ← "in-game" music (8 tracks)
└─ .claude/                    ← Claude Code session settings
```

**Main entry point:** `web/vocab/index.html` → `vocab-data.js` → `app.js` → `mini-player.js`.
The app is a single page; "views" (Home, Games, Settings, …) are sections toggled by JS, not
separate routes.

---

## 2. Quick Start Commands

> ⚠️ **Always open the site over `http://`, never `file://`.** The microphone prompt,
> audio autoplay, and reliable `localStorage` all require a real origin. Double-clicking
> `index.html` will mostly work but the mic prompt re-appears every time.

**Prerequisites**
- Python 3.x (this machine has **3.14**). No Node.js required.
- A modern browser — **Chrome or Edge** recommended (mic + autoplay behave best).

**Run the dev server**
```bash
# Windows (double-click also works):
cd web/vocab
start-server.bat
# → serves http://localhost:8000

# Any OS / manual:
cd web/vocab
python -m http.server 8000
# → open http://localhost:8000 in your browser
```

**Build** — none. It's static; what you see in `web/vocab/` is what ships.

**Test** — none configured yet (see Backlog).

**Deploy** — copy the `web/vocab/` folder to any static host (GitHub Pages, Netlify,
Cloudflare Pages, an S3 bucket, etc.). No build step. If you move it to a sub-path,
update asset/script paths accordingly.

**Lint / format** — none configured.

---

## 3. Daily Warm-up Checklist

Do this every time you (or Claude) start work on the project:

- [ ] **1. Sync & check git.** At the repo root: `git status`, then `git pull`
      (current branch is `master`; PRs target `main`).
- [ ] **2. Verify tooling.** `python --version` (needs 3.x). No `npm install` needed.
- [ ] **3. Start the server.** `cd web/vocab && start-server.bat`
      (or `python -m http.server 8000`).
- [ ] **4. Open it.** Browse to `http://localhost:8000` in Chrome/Edge; allow the
      microphone once when prompted.
- [ ] **5. Read the state.** *(Claude does this automatically.)* You: skim the
      **Dynamic Task Board** below to see what's next.
- [ ] **6. Smoke test.** Nav works, a study mode loads, and the **Music** tab
      (bottom-right) expands and plays a track.
- [ ] **7. Pick a task.** Start the top **In Progress** item, or pull the next
      **Backlog** item. Mark it `[/]` before you begin.

---

## 4. Dynamic Task Board

> Legend: `[ ]` Backlog · `[/]` In Progress · `[x]` Done (stamped YYYY-MM-DD).
> Keep tasks small and move them the moment their status changes.

### Backlog (upcoming features / fixes / tech debt)
- [ ] Add automated tests (unit for `AudioController`, plus an e2e smoke test of the app). No framework exists yet.
- [ ] Per-track album-art / cover images in the mini-player queue + header.
- [x] **Modern auth system UI** — redesigned login/register modal with glassmorphism gradient hero, social login buttons (Google/GitHub/Apple), password visibility toggle, password strength indicator, loading spinner, forgot password flow, terms/privacy/help links, modern profile modal with stats cards, improved sidebar auth button — 2026-08-06
- [ ] Mini-player mobile bottom-sheet layout (currently docked bottom-right).
- [ ] "Shuffle" and "Repeat" modes for the mini-player.
- [ ] Settings toggle to show / hide the mini-player overlay.
- [ ] Export / import mini-player playlist configuration (beyond the built-in app backup).
- [ ] Add richer per-word data: synonyms/antonyms, example audio, topic tags (feeds mnemonics + SRS).
- [ ] Reduce `app.js` size / split into modules (it is one ~130 KB IIFE today).

### In Progress (current focus)
- [ ] *(none — pick the next Backlog item or a Level Rewards follow-up)*

### Done (recently completed)
- [x] **Day 3 vocabulary (Random topic)** — เพิ่ม 8 คำศัพท์ (summarize, benefit, consume, borrow, interfere, restrict, obtain, permit) + 5 collocations (take a risk, give up, run out of, in charge of, bring up) + 1 idiom (piece of cake) ใน `vocab-data.js` — 2026-07-27
- [x] **Combo float visibility fix** — คอมโบ (`#comboFloat`) เดิมวางตำแหน่งอิง `top` ของการ์ด → ถ้าการ์ดเลื่อนจนขอบบนหลุดจอ `getBoundingClientRect().top` ติดลบ คอมโบเลยไปอยู่นอกจอด้านบน (มองไม่เห็น); แถม keyframes `comboPop` เขียนทับ `transform` เป็น `translate(-50%, -12px)` ล็อกตำแหน่ง → เปลี่ยนเป็นคำนวณตำแหน่งแนวตั้งที่ **clamp อยู่ในจอเสมอ** (กลางการ์ดถ้าอยู่ในจอ มิฉะนั้นกลางจอ upper-third), ปรับ base + keyframes ให้รักษาการจัดกึ่งกลาง `translate(-50%, -50%)`, ขยับ z-index 240→260, และเลื่อนมาทางซ้ายเป็น `left: 34%` — 2026-07-19
- [x] **Security hardening: CSP + XSS defenses + encrypted local storage** — เพิ่ม **Content-Security-Policy** เข้ม (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`; อนุญาตเฉพาะ Google Fonts) + `referrer no-referrer` ใน `index.html`; ย้าย inline `<script>`/`style=` ออกเป็นไฟล์แยก (`flags.js`, `boot.js`, class `.pron-file-warn`) เพื่อให้ CSP ไม่ต้องเปิด `unsafe-inline`; เพิ่ม **frame-busting guard** + `esc()` HTML-escape ครอบทุกจุดที่ข้อมูลไดนามิกเข้า `innerHTML`/`el()` (browse card, detail modal, WotD, ผลควิซ); เพิ่ม **`SecureStore`** — เข้ารหัส localStorage ด้วย **AES-GCM (คีย์ non-extractable ใน IndexedDB)**, in-memory cache ให้ `load`/`save` คง sync (ไม่แตะ call site เดิม 46 จุด), auto-migrate ข้อมูล plaintext เดิม, flush ตอน `pagehide`/`visibilitychange`; mini-player เขียน alias ผ่าน `SecureStore`; ขยับ SW `VERSION`→v2 + เพิ่มไฟล์ใหม่ใน SHELL — 2026-07-19
- [x] **Security review (authorized) + XSS/integrity hardening** — ทำ Security Review เชิงรุกบนโค้ดทั้งหมด (`app.js`, `mini-player.js`, `index.html`, `service-worker.js`); สรุป: CSP แน่น (`script-src 'self'`, `frame-ancestors 'none' ฯลฯ) + frame-busting + `esc()` ครอบส่วนใหญ่ → **ไม่พบช่องโหว่ระดับสูง**; แพตช์ 3 จุดระดับ Low เป็น defense-in-depth: (1) escape transcript จาก SpeechRecognition ก่อนใส่ `innerHTML` ใน `renderPronFeedback` (`app.js:3269`, ป้องกัน reflected-XSS จาก input เสียง), (2) escape `word` ใน `renderWeakSpots` (`app.js:1158`, ป้องกัน stored-XSS เผื่อ data กลายเป็น untrusted), (3) เพิ่ม `isValidBackup()` schema validation ให้ backup import (`app.js:2968`, ปฏิเสธไฟล์ผิดรูป + sanitize scalar fields เช่น `reminder.time` ป้องกัน crash/ข้อมูลเพี้ยน) — `node --check` ผ่าน — 2026-07-19
- [x] **Fix + enrich Daily Quests** — พบบั๊ก: `renderHome()` ไม่เคยเรียก `renderDailyQuests()` เลย ทำให้แผง Daily Quest ว่างเปล่าตอนโหลด (เรนเดอร์เฉพาะตอนกด Claim) → เพิ่มการเรียกใน `renderHome()` ให้โชว์เป้าหมายทุกครั้งที่เปิด Home; เพิ่ม **quest pool หมุนเวียนรายวัน** (correct / accuracy / master3) เลือก 1 อันต่อวันแบบ deterministic จากวันที่ ผ่าน `daySeed()` ให้เป้าหมายรายวันไม่จำเจ (คง 3 หลัก + โบนัสคอมโบ×5 ที่ L14) — 2026-07-18
- [x] **Redesign Daily Quest UI + floating mini widget** — เพิ่ม CSS ทั้งหมดที่ขาดหาย (ก่อนหน้านี้เควสต์ไม่มีสไตล์เลย แสดงแบบดิบ): แต่ละเควสต์เป็นการ์ดมีวงกลมเช็ค + แถบความคืบหน้าไล่ระดับสีเมื่อเสร็จ + นับคืบหน้า; เพิ่ม **widget ลอย Daily Quest** มุมซ้ายล่าง (หลบ mini-player ขวาล่าง) โชว์เมื่ออยู่นอกหน้า Home ซ่อนเมื่ออยู่ Home, คลิกเพื่อขยาย/พับ, อัปเดตสดทุกครั้งที่ได้ XP (`renderMiniQuests` พร้อม guard `hidden`), ปุ่ม Claim ซิงก์กับแผงหลัก — 2026-07-18
- [x] **i18n: EN/TH language switcher** — เพิ่มระบบ `STRINGS` + `t()` + `applyI18n()` + ปุ่มสลับภาษา (TH|EN) ใน Settings (`settings.lang`, ค่าเริ่มต้น **ไทย**); แปะ `data-i18n` ครอบคลุม chrome ทั้งหมด (nav, headings, buttons, settings, hints, toasts, level-up overlay, mini-quest, detail modal) + wrap สตริง dynamic (greeting, settings labels, achievement/reward toasts, lu-rewards) ด้วย `t()`; `setLang()` re-render หน้าปัจจุบัน + chrome ถาวร — 2026-07-18
- [x] **i18n: Auth system EN/TH localization** — ทำให้ login/register modal รองรับทั้งไทยและอังกฤษ: เปิด `window.VocabApp` API จาก `app.js` ให้ `auth.js` ใช้ `t()` ร่วมกัน, ลบ duplicate `t()` ใน `auth.js`, เพิ่ม `vocab-lang-changed` custom event ให้ auth modal อัปเดตภาษาแบบเรียลไทม์, ส่ง `lang` parameter ไป server เพื่อให้ error message เป็นภาษาที่ถูกต้อง, เพิ่ม English error messages ใน `server.js` — 2026-08-03
- [x] **Frontend auth UX overhaul** — ย้ายปุ่มล็อกอินจาก hero section มาอยู่ใน sidebar top bar (`#sidebarAuthBtn`), ปรับปรุง CSS `.btn-auth`, `updateSidebarAuthBtn()` แสดงสถานะล็อกอิน/ยังไม่ล็อกอิน, `initAuthUI()` ตั้งค่า click handler เชื่อม `createAuthModal()`/`showProfileModal()` — 2026-08-03
- [x] **Mini-player upgrades** — ปกอัลบั้มแบบไล่ระดับสี (deterministic gradient จากชื่อเพลง, ไม่ต้องมีรูป), ปุ่ม **Shuffle** + **Repeat** (off→all→one) พร้อม logic ใน `AudioController`, toggle **ซ่อนเครื่องเล่น** ใน Settings (`settings.showMiniPlayer` gates `window.MINI_PLAYER_ENABLED`), และ **mobile bottom-sheet** (`@media max-width:640px`) — 2026-07-18
- [x] **Daily reminders (PWA Notification)** — แถว "Daily reminder" ใน Settings (toggle + `<input type="time">`), ขอสิทธิ์ `Notification.requestPermission()`, และ `startReminderScheduler()` ยิงแจ้งเตือนวันละครั้งตอนถึงเวลา **ขณะแอปเปิด** (ไม่ต้องมีเซิร์ฟเวอร์; push แบบพื้นหลังจริงต้องใช้ backend) — 2026-07-18
- [x] **Analytics: Statistics view** — เพิ่มหน้า **Statistics** (nav + section) มีการ์ดสรุป (คำที่ตอบ/ความแม่นยำ/streak/จำได้), **กราฟความก้าวหน้ารายสัปดาห์** (SVG 84 วัน จาก `history`, สีตามความแม่นยำ), และ **Weak spots** (เรียง weakest-first ตาม `predictRetention`) พร้อมปุ่ม **Review** ที่เปิดเซสชัน Flashcards ของคำเหล่านั้น (`reviewWeakSpots`) — 2026-07-18

- [x] **Upgrade: Installable PWA** — `favicon.svg` + PNG icons (192/512/maskable/apple), `manifest.webmanifest`, offline `service-worker.js` (app-shell precache + runtime music LRU + offline fallback), Install button via `beforeinstallprompt` — 2026-07-17
- [x] **Upgrade: Accessibility & UX** — skip link, `:focus-visible` rings, ARIA (`nav aria-current`, `inert`+`aria-hidden` on inactive views, `aria-live` feedback, labels on every icon button), focus trap + keyboard-shortcuts help, `prefers-reduced-motion`, contrast pass, `lang="th"` on translations, mobile sidebar drawer, OS theme detection — 2026-07-17
- [x] **Upgrade: Smarter memorization** — SM-2 scheduler (backward-compatible migration from Leitner boxes), Again/Hard/Good/Easy grading, forgetting-curve **Memory Strength** gauge + dashboard curve, weakest-first **Smart Review**, POS+similarity quiz distractors, mnemonic/syllable-split aids — 2026-07-17
- [x] **Upgrade: Aurora Glass design** — blue→violet→cyan token system, animated aurora-mesh background, elevated frosted-glass panels with glow, memory-strength gauge + forgetting-curve, smoother view transitions — 2026-07-17
- [x] Implement Spotify-style Mini Music Player overlay (`mini-player.js` + `mini-player.css` + `MINI_PLAYER_GUIDE.md`) — 2026-07-16
- [x] Fix no-audio bug: expose full song paths (`song/onpage/…`, `song/ingame/…`) instead of bare filenames — 2026-07-16
- [x] Redesign player UI to liquid-glass, match original theme colors, remove bloom/glow — 2026-07-16
- [x] Redesign mini-player UI to clean white & blue theme (solid white panel + blue accents), decoupled from host dark/light mode — 2026-07-17
- [x] Modernize mini-player layout/UI: rounded card (24px), larger glowing album-art, taller glowing progress bar, refined ghost transport buttons, blue accent-bar queue, mount/blur/pulse animations — 2026-07-17
- [x] Modernize whole Vocab Trainer UI to white & blue: indigo → blue palette (--primary #3b82f6, blue gradients), solid-white panels, larger radii (20px), blue-tinted shadows, blue heatmap/charts/accents — 2026-07-17
- [x] Fuse on-page + in-game songs into one library/queue; rewire Settings song selects — 2026-07-16
- [x] Hand music control from the built-in looping player to the mini-player (no double audio) — 2026-07-16
- [x] Set up Developer Workflow & Task Tracker (`DEVELOPMENT_WORKFLOW.md`, `.clauderules`) — 2026-07-16
- [x] Fix systemic CSS typo `rgba(r,g,b),a)` → `rgba(r,g,b,a)` (a stray `)` closed the colour early, invalidating the whole declaration so the browser dropped it) — restored the **VOCAB chip bg**, **every button's glow shadow**, **heatmap** level colours (cells relied solely on these classes), text-selection + word-of-day hover border — 2026-07-17
- [x] Daily Tasks: task-card icons (e.g. the ✨ before "Learn new words") were invisible — they sat inside `.task-badge`, which uses `background-clip:text` + `color:transparent` for the gradient title, and the icon rule painted it `#fff` (white-on-white panel). Changed `.task-badge .ico` to `var(--primary)` so icons show on light + dark — 2026-07-17
- [x] Original vocab trainer: all game modes + SRS + daily tasks + backup/restore — (see git history)
- [x] Per-answer spectacle — **both** correct & wrong now fire a session-centred confetti burst (correct: 32 rainbow win-style; wrong: 28 red-themed) + a soft radial **glow pulse** (`fxGlow` good/bad) over the live session + badge `fbPop`/`shake` + ring flash + haptic; wired through shared `setFeedback` so all modes get it; respects `prefers-reduced-motion` — 2026-07-17
- [x] **Gamification: XP · Level · Rank · Achievements** — sidebar **profile chip** (เลเวล + rank + animated XP bar) always visible; new **Achievements view** (trophy nav, scaffold already existed) with 21 achievements (locked = mystery `???` + padlock, unlocked = colored + unlock date + progress bar for goal-based ones); **level-up celebration overlay** (confetti + chime + glow) and **achievement-unlock toasts**; XP earned from answers (Good/Easy/Hard/Wrong), new words, first-time mastery, daily tasks, perfect-game finishes; rank tiers ผู้เริ่มต้น→…→ปรมาจารย์คำ; all computed from existing `streak`/`history`/`learned`/`progress` — no new deps, backward-compatible (`vocab_game_v1`) — 2026-07-18
- [x] **Level Rewards & Unlocks** — made the level number *mean* something: `LEVEL_REWARDS` table (L3–L25) unlocking real, verified rewards — 5 **accent presets** (Sunset/Forest/Ocean/Neon/Mono, pure CSS `data-accent` overrides, light+dark) selectable in Settings; permanent **XP boosts** (+5% @L8, +10% @L18 → max +15%, applied in `awardXp`); cosmetic **titles** (Wanderer/Lexicon Keeper/Wordweaver) shown on the profile chip; a **4th Daily Quest** (×5 combo) @L14; and **Boss Rush** @L20 (timed weakest-words gauntlet, +25 XP perfect bonus). New **Rewards rail** in the Achievements view + reward rows inside the level-up overlay + unlock toasts. Backward-compatible (new fields defaulted). Verified: `node --check` clean, ID/class cross-check, reward-logic harness all pass — 2026-07-18
- [x] Persist mini-player volume + last-played track across sessions via `localStorage` — 2026-07-16
- [x] Add a "now playing" indicator on the collapsed hot-zone (track name marquee) — 2026-07-16
- [x] **Fix: reward/theme colors + progress bars invisible (strict CSP blocked inline `style=`)** — ความสีธีทรางวัล (จุดสี accent ใน Settings + แถวรางวัลในหน้า Achievements) หายไป เพราะ CSP `style-src 'self'` (ไม่มี `'unsafe-inline'`) บล็อก attribute `style="..."` ทุกจุด → จุดสี/แถบความคืบหน้า/สี weak-spot ไม่มีสี; เปลี่ยนทุกจุด (reward swatch, accent swatch, ach-progress, weak-pct, quest-bar ×2, memory-strength segments) มาใช้ `data-bg`/`data-w`/`data-color` + helper `applyInlineStyles()` ที่เซ็ตผ่าน `.style` property (CSP ไม่บล็อก) แทน inline attribute, และเปลี่ยน `style=` ของ kb-row มาเป็นคลาส `.kb-actions`; คง CSP เข้มไว้เหมือนเดิม, `node --check` ผ่าน — 2026-07-19
- [x] **Add `th` (ความหมายภาษาไทย) ให้ collocation + เคลียร์ inline style ที่เหลือ** — เพิ่มฟิลด์ `th` ให้ collocation ทุกตัวใน `vocab-data.js` (ตัดสินใจ, พักเบรก, ให้ความสนใจ, รักษาคำสัญญา, เข้ากับได้ดี, ก้าวหน้า, รับผิดชอบ, กำจัด, คอยติดต่อกัน, แวะไปเยี่ยม) + map `c.th` ใน `getAllItems()` (เดิมเซ็ต `th:""`); ตอนนี้ความหมายโชว์ใน Detail / Flashcard / Browse ตรงๆ (ก่อนหน้านี้โชว์ fallback "See example usage below" และใน Browse ไม่โชว์ความหมายเลย); เพิ่มเติมแก้ inline `style=` ที่ตกหล่นรอบแรก (เขียนแบบ escape `style=\"...\"` ใน string): แถบ Memory-strength ใน detail (`dp-fill` width), สีไอคอนคะแนน pronunciation, และ margin ของ result modal (ย้ายเป็นคลาส `.mt-10`/`.mt-14`); ตรวจสอบไม่มี inline `style=` เหลือใน JS เลย, `node --check` ผ่าน — 2026-07-19
- [x] **Make collocation meaning visible in Word List (Browse)** — ความหมายมีใน DOM แล้ว (data ถูกต้อง ผ่าน Node ตรวจสอบ) แต่ `.bc-th` ใช้ `background-clip:text; color:transparent` (gradient text) แบบเดียวกับที่เคยทำไอคอน `.task-badge` หาย → ถ้าเบราว์เซอร์เพนต์ gradient-clip ไม่ได้ ตัวหนังสือจะโปร่งใส = มองไม่เห็น; เปลี่ยน `.bc-th` เป็นสีตายตัว `var(--primary-d)` (อ่านง่ายทั้ง light/dark) แทนกลวิธี gradient-clip, ความหมายคำศัพท์/collocation/idiom จะแสดงชัดเจนใน Word List ทุกรายการ — 2026-07-19
- [x] **Fix ไอคอนหายใน Settings (Show music player + Daily reminder)** — ไอคอนสองอันนี้หายเพราะ `ICONS` map ไม่มี `music`/`musicX` (ใช้ในปุ่ม `#settingsPlayer`) และ `bell`/`bellOff` (ใช้ในปุ่ม `#settingsReminder`); `svgIcon()` ถ้าชื่อไม่มีใน `ICONS` จะคืน `<svg>` ว่าง → มองไม่เห็น (แถว Background music ใช้ `volume`/`volumeX` ที่มีอยู่เลยไม่พัง); เพิ่ม 4 ไอคอน (Feather-style, stroke-based ตาม `.ico svg { fill:none; stroke:currentColor }`) ลงใน `ICONS`; ตรวจสอบด้วย Node ว่า `svgIcon()` ทุกชื่อ + `data-icon` ทุกตัวใน HTML มีครบใน `ICONS` แล้ว (none missing), `node --check` ผ่าน — 2026-07-19
- [x] **เพิ่มปุ่ม เปิด/ปิด การแสดงความหมายใน Word List (2 โหมด)** — เพิ่ม (1) ปุ่มกลาง **Hide all meanings / Show all meanings** ในแถบควบคุม Browse (`#browseToggleMeanings`, เก็บสถานะใน `settings.hideAllMeanings`) และ (2) ไอคอนตา (**eye/eyeOff**) บนการ์ดแต่ละคำ ให้ซ่อน/แสดงความหมายเป็นรายคำได้ (`settings.hiddenMeanings` เป็น map ของ id); ความหมาย (`bc-th`) โชว์ก็ต่อเมื่อ `!hideAllMeanings && !hiddenMeanings[id]`; ตอนเปิด "ซ่อนทั้งหมด" จะซ่อนไอคอนตารายคำเพื่อไม่ให้สับสน (คลิกปุ่มกลางเพื่อแสดงกลับ); เพิ่มไอคอน `eyeOff` ใน `ICONS`, เพิ่ม string i18n (th/en) `browse.hideAll/showAll/hideWord/showWord`, เพิ่ม CSS `.bc-eye`, ผูก handler ใน `init()`; ทั้งสองโหมดเซฟลง `K_SETTINGS` 持久化; `node --check` ผ่าน — 2026-07-19
- [x] **Mini-player ตามโหมดมืด (theme-aware)** — ก่อนหน้านี้ mini-player ถูกออกแบบมา **decoupled** จากธีม host (CSS comment "hard-coded so it never inherits a dark host theme") → เปลี่ยนโหมดมืดแล้วตัวเล่นเพลงยังคงพื้นหลังขาว; ทำเป็น theme-aware ด้วย CSS ล้วน: เพิ่ม block `html[data-theme="dark"] .mmp { … }` ที่ redefine ตัวแปร `--mmp-*` ทั้งหมดเป็นโทนมืด (panel slate-800, text slate-200, accent ฟ้า) + override จุดสีตายตัว 2 จุด (`.mmp-rename-input` bg, `.mmp-slider-thumb` bg); เพราะ `applyTheme()` ตั้ง `data-theme` บน `<html>` อยู่แล้วและ selector นี้ specificity สูงกว่า `.mmp` เลยอัปเดตสดโดยไม่ต้อง JS เพิ่ม; แก้คอมเมนต์หัวไฟล์ที่เคยบอกว่า "decoupled" ให้ตรงความจริง; ตรวจสอบ brace สมดุล (127/127) — 2026-07-19
- [x] **Hangman: ตัด collocation + idiom ออก** — เกม Hangman เดิมดึงจาก `ITEMS` (vocab+collocation+idiom) ทำให้คำที่มีช่องวาง (phrase) หลุดเข้ามาได้; เปลี่ยน `startHang()` กรองเหลือเฉพาะ `i.type === "vocab"` (+ ป้องกันชิปหลุด), ยุบชิป `#hangType` ให้เหลือแค่ `[["vocab","Vocab"]]` และเปลี่ยน `CHIP_DEFAULT.hangType` เป็น `"vocab"` ให้ UI ตรงความจริง (ไม่มีปุ่ม Collocations/Idioms อีกต่อไป); `node --check` ผ่าน — 2026-07-20
- [x] **Fill-in-the-Blank: คำตอบกว้างขึ้น** — เดิมเช็ค `typed === normText(answer)` เป๊ะทุกตัว; แต่ `normText` ลบ `/` ทิ้ง ทำให้ความหมายไทยที่คั่น ` / ` (เช่น "บรรลุผล / ทำสำเร็จ") กลายเป็นต้องพิมพ์ความหมายครบคู่ถึงจะถูก; เพิ่ม `acceptAnswer()` ที่แตกคำตอบตาม ` / | · , ` แล้วรับคำตอบใดก็ได้ในชุด (และรับทั้งประโยคเต็มด้วย) ใช้แทนใน `checkFill()`; `node --check` ผ่าน — 2026-07-20
- [x] **Fix localhost not accessible** — `web/vocab/server/server.js` และ `package.json` หาย → สร้างใหม่ (Express + CORS + static file serving + JWT auth + vocab-db.json persistence); อัปเดต `start.bat` ให้ kill process เก่าบนพอร์ต 3001 ก่อนเริ่ม และเปิดเบราว์เซอร์อัตโนมัติ; เพิ่ม `express.static` ใน `server.js` เพื่อ serve `web/vocab/` บนพอร์ต 3001 — 2026-08-05
- [x] **GitHub Pages deployment fixes** — อัปเดต CSP `connect-src` ให้ไม่บล็อก GitHub Pages (ลบ `http://localhost:3001` ออก); แก้ `start-server.bat` → `start.bat` ใน `index.html`; ลบ `flags.js` ที่ไม่มีอยู่ออกจาก service worker precache; อัปเดต `auth.js` `API_BASE` ให้ตรวจจับ GitHub Pages และ fallback เป็น localStorage-only; อัปเดต `README.md` เพิ่มคำแนะนำ deploy — 2026-08-05
```
