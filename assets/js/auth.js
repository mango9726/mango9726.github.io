/* ============================================================
   Vocab Trainer — Auth System
   ระบบบัญชีผู้ใช้: สมัคร / เข้าสู่ระบบ / sync ข้อมูล
   รองรับ 3 โหมด (เรียงตามลำดับความสามารถ):
     1. Firebase mode (แนะนำ) — Google Login + Firestore sync ข้ามเครื่อง
     2. Backend mode (มี server) — sync ข้ามเครื่องผ่าน server.js
     3. Static mode (GitHub Pages ไม่มี Firebase) — เก็บใน localStorage
   ============================================================ */
(function () {
  "use strict";

  // URL ของ backend API
  const isGitHubPages = window.location.hostname.endsWith(".github.io") || window.location.hostname === "github.io";
  const API_BASE = "";

  /* ============================================================
     FIREBASE MODE — Google Login + Firestore sync ข้ามเครื่อง
     (ต้องตั้งค่าใน firebase-config.js ก่อน)
     ============================================================ */
  function isFirebaseMode() {
    return !!(window.FIREBASE_CONFIGURED && window.firebaseAuth && window.firebaseDb);
  }

  // --- Google Sign-in (ใช้ redirect เป็นหลัก — เสถียรบน static host) ---
  async function signInWithGoogle() {
    if (!isFirebaseMode()) throw new Error("Firebase not configured");
    const provider = window.googleProvider || new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    // ใช้ redirect เสมอ (เปิดหน้า Google เต็มหน้า — ทำงานได้ทุกที่)
    console.log("[firebase] เริ่ม Google Sign-in แบบ redirect");
    // ตั้งธงก่อน redirect เพื่อตรวจจับกรณี "กลับมาจาก Google แต่ไม่มี session"
    // (เก็บ timestamp ไว้ด้วย เพื่อแยก "เพิ่งลองจริง" ออกจาก "ธงค้างจากการลองก่อนหน้า")
    try { sessionStorage.setItem("vocab_oauth_pending", JSON.stringify({ t: Date.now() })); } catch (e) {}
    try {
      await window.firebaseAuth.signInWithRedirect(provider);
    } catch (e) {
      // redirect ไม่สำเร็จ (เช่น domain ไม่ผ่าน) — ล้างธง ไม่ให้แจ้งเตือนซ้ำตอนเปิดเว็บ
      try { sessionStorage.removeItem("vocab_oauth_pending"); } catch (e2) {}
      throw e;
    }
    // หลัง redirect กลับมา firebaseCheckRedirectResult จะทำงาน
    return { redirecting: true };
  }

  // --- ตรวจสอบผลลัพธ์จาก redirect (เรียกตอนเริ่มแอป) ---
  async function firebaseCheckRedirectResult() {
    if (!isFirebaseMode()) return false;
    try {
      const result = await window.firebaseAuth.getRedirectResult();
      if (result && result.user) {
        const user = result.user;
        try { sessionStorage.removeItem("vocab_oauth_pending"); } catch (e) {}
        setToken("firebase:" + user.uid);
        setUser({ username: user.displayName || user.email || "Google User", userId: user.uid, provider: "google" });
        // Sync กับ backend เพื่อสร้างบัญชี locally ที่ login ด้วย username/password ได้
        syncGoogleWithBackend(user);
        return true;
      }
      return false;
    } catch (e) {
      try { sessionStorage.removeItem("vocab_oauth_pending"); } catch (e2) {}
      console.warn("[firebase] redirect result error:", e.message || e.code);
      if (window.VocabApp && window.VocabApp.toast) {
        try {
          window.VocabApp.toast(firebaseErrorMessage(e), "err", "alert");
        } catch (err2) {
          console.warn("[firebase] redirect error toast failed:", err2);
        }
      }
      return false;
    }
  }

  // --- Sync บัญชี Google กับ backend เพื่อสร้าง local account ---
  // หลังจากล็อกอินผ่าน Google สำเร็จ จะสร้างบัญชีใน server ด้วย
  // ทำให้สามารถล็อกอินด้วย username/password ได้ด้วย
  async function syncGoogleWithBackend(user) {
    if (!user) return;
    // ถ้าไม่มี backend หรืออยู่ใน static mode ให้ข้าม
    if (isGitHubPages || !(await isBackendAvailable())) return;

    try {
      const res = await fetch(API_BASE + "/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleUid: user.uid,
          displayName: user.displayName || user.email || "Google User",
          email: user.email || ""
        })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Google sync failed");

      // ใช้ backend token แทน firebase token เพื่อให้ login ด้วย username/password ได้
      setToken(data.token);
      setUser({
        username: data.username,
        userId: data.userId,
        provider: "google",
        googleUid: user.uid
      });

      // ถ้าเป็นบัญชีใหม่ แสดงรหัสผ่านอัตโนมัติให้ผู้ใช้บันทึก
      if (data.isNew && data.autoPassword) {
        showGoogleCredentialToast(data.username, data.autoPassword);
      }

      console.log("[auth] Google account synced with backend:", data.username);
    } catch (e) {
      console.warn("[auth] Google sync with backend failed:", e.message);
      // ไม่ fail — ผู้ใช้ยังล็อกอินผ่าน Firebase ได้ตามปกติ
    }
  }

  // --- แสดง toast แจ้งรหัสผ่านอัตโนมัติหลัง Google สมัครใหม่ ---
  function showGoogleCredentialToast(username, autoPassword) {
    const existing = document.getElementById("googleCredentialToast");
    if (existing) existing.parentNode.removeChild(existing);

    const toast = document.createElement("div");
    toast.id = "googleCredentialToast";
    toast.className = "google-credential-toast";
    toast.innerHTML =
      '<div class="google-credential-toast-content">' +
        '<strong>' + esc(t("auth.googleAccountCreated")) + '</strong>' +
        '<p>' + t("auth.googleCredentialHint") + '</p>' +
        '<div class="google-credential-fields">' +
          '<label>' + esc(t("auth.username")) + ': <strong>' + esc(username) + '</strong></label>' +
          '<label>' + esc(t("auth.password")) + ': <strong>' + esc(autoPassword) + '</strong></label>' +
        '</div>' +
        '<p class="google-credential-warning"><span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg></span> ' + esc(t("auth.googlePasswordWarning")) + '</p>' +
        '<button class="btn btn-primary btn-sm" id="googleCredentialOk">' + esc(t("auth.ok")) + '</button>' +
      '</div>';
    document.body.appendChild(toast);

    document.getElementById("googleCredentialOk").onclick = function () {
      toast.classList.add("hidden");
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    };
  }

  // --- Modal พรอมต์ 1 ช่อง input (ใช้กับ social login / เปลี่ยนข้อมูล) ---
  // คืน Promise<string|null> — null เมื่อยกเลิก.
  function showPromptModal(title, label, placeholder, confirmLabel, inputType) {
    if (window.__VOCAB_TEST_PROMPT__) {
      const v = window.__VOCAB_TEST_PROMPT__;
      return Promise.resolve(typeof v === "string" && v.length ? v : null);
    }
    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.className = "auth-overlay";
      overlay.id = "promptModal";
      overlay.innerHTML =
        '<div class="auth-modal" role="dialog" aria-modal="true">' +
          '<div class="auth-hero">' +
            '<div class="auth-hero-icon"><span class="ico" data-icon="lock"></span></div>' +
            '<h2>' + esc(title) + '</h2>' +
            '<button class="auth-hero-close" id="promptClose" title="' + esc(t("settings.close")) + '"><span class="ico" data-icon="close"></span></button>' +
          '</div>' +
          '<div class="auth-body">' +
            '<div class="auth-field">' +
              '<label class="auth-label" for="promptInput">' + esc(label) + '</label>' +
              '<div class="auth-input-wrap">' +
                '<input type="' + (inputType || "text") + '" id="promptInput" class="auth-input" placeholder="' + esc(placeholder || "") + '" />' +
              '</div>' +
            '</div>' +
            '<p class="auth-error hidden" id="promptError"></p>' +
            '<button class="btn btn-primary auth-submit" id="promptOk">' +
              '<span class="btn-text">' + esc(confirmLabel || t("auth.ok")) + '</span>' +
              '<span class="spinner" aria-hidden="true"></span>' +
            '</button>' +
            '<button class="btn auth-submit" id="promptCancel" style="margin-top:8px">' + esc(t("auth.cancel")) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelectorAll("[data-icon]").forEach(function (n) {
        const ICONS = window.VOCAB_ICONS || {};
        n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
      });
      const input = overlay.querySelector("#promptInput");
      const errorEl = overlay.querySelector("#promptError");
      const okBtn = overlay.querySelector("#promptOk");
      function close(val) {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
        resolve(val);
      }
      overlay.querySelector("#promptClose").onclick = function () { close(null); };
      overlay.querySelector("#promptCancel").onclick = function () { close(null); };
      overlay.onclick = function (e) { if (e.target === overlay) close(null); };
      okBtn.onclick = function () {
        const v = input.value.trim();
        if (!v) {
          errorEl.textContent = t("auth.fillField");
          errorEl.classList.remove("hidden");
          return;
        }
        close(v);
      };
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") okBtn.click(); });
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      setTimeout(function () { input.focus(); }, 100);
    });
  }

  // --- สร้าง/ลิงก์บัญชีจาก GitHub ผ่าน backend (เช่น flow Google) ---
  async function signInWithGithub() {
    if (!(await isBackendAvailable())) {
      throw new Error(t("auth.socialRequiresBackend"));
    }
    const gh = await showPromptModal(t("auth.githubPromptTitle"), t("auth.githubUsername"), t("auth.githubUsernamePlaceholder"), t("auth.continue"));
    if (!gh) return null;
    const res = await fetch(API_BASE + "/api/auth/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubId: gh, displayName: gh, email: "" })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || "GitHub sync failed");
    setToken(data.token);
    setUser({ username: data.username, userId: data.userId, provider: "github", githubId: gh });
    if (data.isNew && data.autoPassword) {
      showGoogleCredentialToast(data.username, data.autoPassword);
    }
    return { username: data.username, userId: data.userId, isNew: data.isNew };
  }

  // --- สร้าง/ลิงก์บัญชีจาก Apple ID ผ่าน backend ---
  async function signInWithApple() {
    if (!(await isBackendAvailable())) {
      throw new Error(t("auth.socialRequiresBackend"));
    }
    const appleId = await showPromptModal(t("auth.applePromptTitle"), t("auth.appleEmail"), t("auth.appleEmailPlaceholder"), t("auth.continue"), "email");
    if (!appleId) return null;
    const res = await fetch(API_BASE + "/api/auth/apple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appleId: appleId, displayName: appleId, email: appleId })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || "Apple sync failed");
    setToken(data.token);
    setUser({ username: data.username, userId: data.userId, provider: "apple", appleId: appleId });
    if (data.isNew && data.autoPassword) {
      showGoogleCredentialToast(data.username, data.autoPassword);
    }
    return { username: data.username, userId: data.userId, isNew: data.isNew };
  }

  // --- ลืมรหัสผ่าน: Firebase > Backend (reset code) > Static (ไม่รองรับ) ---
  async function forgotPassword(username) {
    if (!username) throw new Error(t("auth.fillField"));
    // 1. Firebase mode — ส่งอีเมลรีเซ็ตจริง
    if (isFirebaseMode()) {
      const email = username.indexOf("@") !== -1 ? username : username + "@vocab.app";
      await window.firebaseAuth.sendPasswordResetEmail(email);
      return { mode: "firebase" };
    }
    // 2. Backend mode — ขอรหัสรีเซ็ต (ไม่ต้องมีอีเมลจริง)
    if (await isBackendAvailable()) {
      const res = await fetch(API_BASE + "/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      if (data.resetCode) {
        // backend นี้ส่งรหัสมาใน response (เหมือนอีเมล) — แสดงให้ผู้ใช้กรอกขั้นต่อไป
        return { mode: "backend", username: username, resetCode: data.resetCode };
      }
      return { mode: "backend", username: username, resetCode: null };
    }
    // 3. Static mode — รีเซ็ตได้ทันทีโดยตั้งรหัสใหม่ (ไม่มีอีเมล/secret)
    return { mode: "static", username: username };
  }

  async function resetPasswordWithCode(username, resetCode, newPassword) {
    const res = await fetch(API_BASE + "/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, resetCode, newPassword })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
    return data;
  }

  // --- เปลี่ยนรหัสผ่าน: Firebase > Backend > Static ---
  async function changePassword(currentPassword, newPassword) {
    if (!currentPassword || !newPassword) throw new Error(t("auth.fillField"));
    if (newPassword.length < 4) throw new Error(t("auth.passwordTooShort"));
    const user = getUser();
    if (!user) throw new Error(t("auth.notLoggedIn"));

    // 1. Firebase mode
    if (isFirebaseMode()) {
      const cur = window.firebaseAuth.currentUser;
      if (!cur) throw new Error(t("auth.notLoggedIn"));
      // ต้องยืนยันตัวตนใหม่ก่อนเปลี่ยน (recent login)
      try {
        const email = cur.email || (user.username.indexOf("@") !== -1 ? user.username : user.username + "@vocab.app");
        const cred = firebase.auth.EmailAuthProvider.credential(email, currentPassword);
        await cur.reauthenticateWithCredential(cred);
      } catch (e) {
        throw new Error(firebaseErrorMessage(e) || t("auth.wrongCurrentPassword"));
      }
      await cur.updatePassword(newPassword);
      return true;
    }

    // 2. Backend mode
    if (await isBackendAvailable()) {
      const res = await fetch(API_BASE + "/api/auth/change-password", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + getToken(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || t("auth.changeFailed"));
      return true;
    }

    // 3. Static mode — ยืนยัน hash เดิมแล้วตั้งค่าใหม่
    const users = getStaticUsers();
    const u = users[user.username];
    if (!u) throw new Error(t("auth.userNotFound"));
    const curHash = await hashPassword(currentPassword);
    if (u.passwordHash !== curHash) throw new Error(t("auth.wrongCurrentPassword"));
    u.passwordHash = await hashPassword(newPassword);
    saveStaticUsers(users);
    return true;
  }

  // --- เปลี่ยนอีเมล: Firebase > Backend (Static ไม่มีอีเมล) ---
  async function changeEmail(newEmail) {
    if (!newEmail || newEmail.indexOf("@") === -1) throw new Error(t("auth.invalidEmail"));
    if (isFirebaseMode()) {
      const cur = window.firebaseAuth.currentUser;
      if (!cur) throw new Error(t("auth.notLoggedIn"));
      await cur.updateEmail(newEmail);
      const user = getUser();
      if (user) { user.email = newEmail; setUser(user); }
      return true;
    }
    if (await isBackendAvailable()) {
      const res = await fetch(API_BASE + "/api/auth/change-email", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + getToken(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ newEmail })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || t("auth.changeFailed"));
      const user = getUser();
      if (user) { user.email = newEmail; setUser(user); }
      return true;
    }
    throw new Error(t("auth.emailNotSupported"));
  }

  // --- ส่งอีเมลยืนยัน (Firebase เท่านั้น) ---
  async function verifyEmail() {
    if (!isFirebaseMode()) throw new Error(t("auth.emailVerifyFirebaseOnly"));
    const cur = window.firebaseAuth.currentUser;
    if (!cur) throw new Error(t("auth.notLoggedIn"));
    await cur.sendEmailVerification();
    return true;
  }

  // --- เปลี่ยน username ใน static mode (re-key users/tokens map) ---
  async function changeUsername(newUsername) {
    if (!newUsername) throw new Error(t("auth.fillField"));
    if (newUsername.length < 3) throw new Error(t("auth.nameTooShort"));
    const user = getUser();
    if (!user) throw new Error(t("auth.notLoggedIn"));
    if (newUsername === user.username) return true;

    // Static mode เท่านั้น
    if (isStaticMode()) {
      const users = getStaticUsers();
      if (users[newUsername]) throw new Error(t("auth.usernameTaken"));
      const tokens = getStaticTokens();
      // re-key users map
      users[newUsername] = users[user.username];
      delete users[user.username];
      // re-key tokens ที่เป็นของ user นี้
      Object.keys(tokens).forEach(function (tok) {
        if (tokens[tok].username === user.username) tokens[tok].username = newUsername;
      });
      saveStaticUsers(users);
      saveStaticTokens(tokens);
      user.username = newUsername;
      setUser(user);
      return true;
    }

    // Backend/Firebase mode ยังไม่มี endpoint — แสดงข้อความ
    throw new Error(t("auth.usernameChangeUnsupported"));
  }

  // --- แปลง error code ของ Firebase เป็นข้อความภาษาไทย ---
  function firebaseErrorMessage(err) {
    const map = {
      "auth/email-already-in-use": "อีเมลนี้ถูกใช้แล้ว — ลองเข้าสู่ระบบแทน หรือใช้อีเมลอื่น",
      "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
      "auth/weak-password": "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)",
      "auth/user-not-found": "ไม่พบผู้ใช้นี้ — ตรวจสอบอีเมลหรือสมัครบัญชีใหม่",
      "auth/wrong-password": "รหัสผ่านไม่ถูกต้อง",
      "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      "auth/too-many-requests": "ลองหลายครั้งเกินไป — รอสักครู่แล้วลองใหม่",
      "auth/network-request-failed": "เครือข่ายขัดข้อง — ตรวจสอบอินเทอร์เน็ต",
      "auth/operation-not-allowed": "ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Console → Authentication → Sign-in method",
      "auth/unauthorized-domain": "Domain นี้ยังไม่ได้เพิ่มใน Firebase Authorized domains\nไปที่ Firebase Console → Authentication → Settings → Authorized domains → เพิ่ม domain นี้",
      "auth/popup-closed-by-user": "ปิดหน้าต่างล็อกอินก่อนเสร็จ — ลองอีกครั้ง",
      "auth/popup-blocked": "เบราว์เซอร์บล็อก popup — อนุญาต popup แล้วลองอีกครั้ง"
    };
    const code = err && err.code;
    return map[code] || (err && err.message) || "เกิดข้อผิดพลาด กรุณาลองใหม่";
  }

  // --- Firebase email/password register ---
  async function firebaseRegister(username, password) {
    // ใช้ username เป็น email ถ้าไม่มี @ ให้เติม @vocab.app
    const email = username.indexOf("@") !== -1 ? username : username + "@vocab.app";
    try {
      const cred = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
      // อัปเดต display name
      await cred.user.updateProfile({ displayName: username });
      setToken("firebase:" + cred.user.uid);
      setUser({ username: username, userId: cred.user.uid, provider: "email" });
      return { token: "firebase:" + cred.user.uid, username: username, userId: cred.user.uid };
    } catch (err) {
      throw new Error(firebaseErrorMessage(err));
    }
  }

  // --- Firebase email/password login ---
  async function firebaseLogin(username, password) {
    const email = username.indexOf("@") !== -1 ? username : username + "@vocab.app";
    try {
      const cred = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
      const displayName = cred.user.displayName || username;
      setToken("firebase:" + cred.user.uid);
      setUser({ username: displayName, userId: cred.user.uid, provider: "email" });
      return { token: "firebase:" + cred.user.uid, username: displayName, userId: cred.user.uid };
    } catch (err) {
      throw new Error(firebaseErrorMessage(err));
    }
  }

  // --- Firebase Firestore: ดึงข้อมูล ---
  async function firebaseFetchData() {
    const user = getUser();
    if (!user) return null;
    try {
      const doc = await window.firebaseDb.collection("vocab_data").doc(user.userId).get();
      if (doc.exists) {
        const d = doc.data();
        return { data: d.data || {}, syncMeta: d.syncMeta || {} };
      }
      return { data: {}, syncMeta: {} };
    } catch (e) {
      console.warn("[firebase] fetchData error:", e.message);
      return null;
    }
  }

  // --- Firebase Firestore: weekly leaderboard (all users) ---
  async function fetchLeaderboard() {
    if (!isFirebaseMode()) return null;
    try {
      const snap = await window.firebaseDb.collection("vocab_data").get();
      const me = getUser();
      const rows = [];
      snap.forEach(function (doc) {
        const d = doc.data();
        if (!d || !d.username) return;
        rows.push({
          username: d.username,
          userId: doc.id,
          weeklyXp: d.weeklyXp || 0,
          totalXp: d.totalXp || 0,
          isMe: !!me && me.userId === doc.id
        });
      });
      rows.sort(function (a, b) { return b.weeklyXp - a.weeklyXp; });
      return rows;
    } catch (e) {
      console.warn("[firebase] fetchLeaderboard error:", e.message);
      return null;
    }
  }

  // --- Firebase Firestore: บันทึกข้อมูล ---
  let firebaseSyncTimer = null;
  const SYNC_META_KEY = "vocab_sync_meta_v1";
  const LAST_SYNC_KEY = "vocab_last_sync_v1";

  function setLastSyncTime(ts) {
    try { SecureStore.save(LAST_SYNC_KEY, ts || Date.now()); } catch (e) {}
  }
  function getLastSyncTime() {
    try { return SecureStore.load(LAST_SYNC_KEY, 0) || 0; } catch (e) { return 0; }
  }

  /** Sum of XP earned in the trailing 7 days from a vocab_game_v1 JSON string. */
  function weeklyXpFromGame(gameJson) {
    try {
      const g = JSON.parse(gameJson || "{}");
      const byDay = g.xpByDay || {};
      const today = new Date();
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        sum += (byDay[k] || 0);
      }
      return sum;
    } catch (e) { return 0; }
  }

  async function firebaseSaveData(data, immediate) {
    const user = getUser();
    if (!user) return;
    // Stamp per-key sync metadata before sending (used for conflict resolution on pull).
    const now = Date.now();
    const metaPaths = {};
    try {
      const localMeta = SecureStore.load(SYNC_META_KEY, {}) || {};
      Object.keys(data || {}).forEach(function (k) {
        localMeta[k] = now;
        metaPaths["syncMeta." + k] = now;
      });
      SecureStore.save(SYNC_META_KEY, localMeta);
    } catch (e) {}
    // debounce 2 วินาที (ยกเว้น immediate force-sync)
    if (firebaseSyncTimer) clearTimeout(firebaseSyncTimer);
    return new Promise(function (resolve) {
      const run = async function () {
        try {
          await window.firebaseDb.collection("vocab_data").doc(user.userId).set(Object.assign({
            data: data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            username: user.username,
            weeklyXp: weeklyXpFromGame(data.vocab_game_v1),
            totalXp: parseInt((JSON.parse(data.vocab_game_v1 || "{}").xp || 0), 10)
          }, metaPaths), { merge: true });
          setLastSyncTime(now);
          resolve(true);
        } catch (e) {
          console.warn("[firebase] saveData error:", e.message);
          resolve(false);
        }
      };
      if (immediate) { run(); }
      else { firebaseSyncTimer = setTimeout(run, 2000); }
    });
  }

  // --- Firebase: ตรวจสอบสถานะล็อกอิน ---
  async function firebaseVerifyToken() {
    if (!isFirebaseMode()) return false;
    return new Promise(function (resolve) {
      const unsub = window.firebaseAuth.onAuthStateChanged(function (user) {
        unsub();
        if (user) {
          const displayName = user.displayName || user.email || "User";
          setToken("firebase:" + user.uid);
          setUser({ username: displayName, userId: user.uid, provider: user.providerData && user.providerData[0] ? user.providerData[0].providerId : "email" });
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  // --- Firebase: ออกจากระบบ ---
  async function firebaseLogout() {
    try { await window.firebaseAuth.signOut(); } catch (e) {}
    clearAuth();
  }

  /* ============================================================
     STATIC MODE — เก็บบัญชีใน localStorage เมื่อไม่มี backend
     ============================================================ */
  const STATIC_USERS_KEY = "vocab_static_users_v1";
  const STATIC_TOKENS_KEY = "vocab_static_tokens_v1";
  const STATIC_DATA_PREFIX = "vocab_static_data_";

  let backendOnline = null;
  let backendCheckPromise = null;

  async function isBackendAvailable() {
    if (isGitHubPages) return false;
    if (window.location.port === "8000" || window.location.protocol === "file:") return false;
    if (window.location.port === "3001") return true;
    if (backendOnline !== null) return backendOnline;
    if (backendCheckPromise) return backendCheckPromise;
    backendCheckPromise = (async function () {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, 1500);
        const res = await fetch(API_BASE + "/api/me", {
          headers: { "Authorization": "Bearer ping" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const ct = res.headers.get("content-type") || "";
        // ต้องเป็น JSON response (ไม่ใช่ HTML fallback จาก static host)
        backendOnline = ct.indexOf("application/json") !== -1 && (res.status === 401 || res.ok);
      } catch (e) {
        backendOnline = false;
      }
      backendCheckPromise = null;
      return backendOnline;
    })();
    return backendCheckPromise;
  }

  // ตรวจสอบว่า response เป็น JSON จริง หรือ HTML (static host fallback)
  async function safeJson(res) {
    try {
      const text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      throw new Error("backend unavailable — server returned non-JSON response");
    }
  }

  function isStaticMode() {
    if (isFirebaseMode()) return false;
    if (isGitHubPages) return true;
    // Port 8000 (python static server) / file:// are always static — the backend
    // probe short-circuits there without setting backendOnline, so check explicitly.
    if (window.location.port === "8000" || window.location.protocol === "file:") return true;
    if (backendOnline === false) return true;
    return false;
  }

  // --- Hash รหัสผ่านด้วย SHA-256 ---
  async function hashPassword(password) {
    if (!window.crypto || !crypto.subtle) {
      let h = 0;
      for (let i = 0; i < password.length; i++) {
        h = ((h << 5) - h) + password.charCodeAt(i);
        h |= 0;
      }
      return "fallback_" + h;
    }
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function genToken() {
    if (window.crypto && crypto.getRandomValues) {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      return Array.from(arr).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    }
    return "tok_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  }

  function genUserId() {
    if (window.crypto && crypto.getRandomValues) {
      const arr = new Uint8Array(8);
      crypto.getRandomValues(arr);
      return "u_" + Array.from(arr).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    }
    return "u_" + Date.now().toString(36);
  }

  function getStaticUsers() {
    try { return JSON.parse(localStorage.getItem(STATIC_USERS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveStaticUsers(users) {
    try { localStorage.setItem(STATIC_USERS_KEY, JSON.stringify(users)); }
    catch (e) { console.warn("[auth] บันทึก users ไม่สำเร็จ:", e); }
  }
  function getStaticTokens() {
    try { return JSON.parse(localStorage.getItem(STATIC_TOKENS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveStaticTokens(tokens) {
    try { localStorage.setItem(STATIC_TOKENS_KEY, JSON.stringify(tokens)); }
    catch (e) { console.warn("[auth] บันทึก tokens ไม่สำเร็จ:", e); }
  }

  // --- ภาษาปัจจุบัน ---
  function getCurrentLang() {
    try {
      const s = JSON.parse(localStorage.getItem("vocab_settings_v1") || "{}");
      return s.lang === "en" ? "en" : "th";
    } catch (e) { return "th"; }
  }

  /* ============================================================
     TOKEN / USER STORAGE
     ============================================================ */
  const TOKEN_KEY = "vocab_auth_token";
  const USER_KEY = "vocab_auth_user";
  let _remember = true;

  function setToken(token) {
    // SecureStore encrypts all vocab_* keys at rest — route through it so the
    // value stays readable after the ciphertext flush (raw localStorage would
    // be re-encrypted and then fail JSON.parse in getToken/getUser).
    if (_remember) {
      if (window.SecureStore) window.SecureStore.save(TOKEN_KEY, token);
      else localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  }
  function setUser(user) {
    // Preserve profile customization (avatar/banner/bio) across re-logins.
    if (user && !user.profile) {
      try {
        const prev = getUser();
        if (prev && prev.profile) user.profile = prev.profile;
      } catch (e) {}
    }
    if (_remember) {
      if (window.SecureStore) window.SecureStore.save(USER_KEY, user);
      else localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  function getToken() {
    if (_remember && window.SecureStore) {
      const t = window.SecureStore.load(TOKEN_KEY, null);
      if (t != null) return String(t);
    }
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }
  function getUser() {
    if (_remember && window.SecureStore) {
      const u = window.SecureStore.load(USER_KEY, null);
      if (u) return u;
    }
    const str = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    try { return JSON.parse(str || "null"); }
    catch (e) { return null; }
  }
  function isLoggedIn() { return !!getToken(); }

  function clearAuth() {
    if (window.SecureStore) {
      try { window.SecureStore.remove(TOKEN_KEY); } catch (e) {}
      try { window.SecureStore.remove(USER_KEY); } catch (e) {}
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  /* ============================================================
     GUEST SESSION ISOLATION
     ผู้ใช้ที่ยังไม่ล็อกอิน (guest) ทำงานใน "session" หนึ่ง ๆ เท่านั้น —
     เมื่อเปิดเว็บมาใน session ใหม่ (ปิด tab/เบราว์เซอร์แล้วกลับมา)
     ข้อมูลทั้งหมดจะถูกรีเซ็ตให้เป็นค่าเริ่มต้น แต่ F5/reload ใน session
     เดียวกันยังคงข้อมูลไว้ (ตามข้อตกลง "รีเซ็ตเฉพาะ session ใหม่")
     ============================================================ */
  const GUEST_SESSION_KEY = "vocab_guest_session";

  function setGuestSessionMarker() {
    try { sessionStorage.setItem(GUEST_SESSION_KEY, "1"); } catch (e) {}
  }
  function clearGuestSessionMarker() {
    try { sessionStorage.removeItem(GUEST_SESSION_KEY); } catch (e) {}
  }

  /** ล้างข้อมูล guest ทั้งหมด ยกเว้นบัญชี/auth และข้อมูลสำรองของบัญชี. */
  function clearGuestData() {
    const protectedKeys = {
      "vocab_auth_token": 1,
      "vocab_auth_user": 1,
      "vocab_static_users_v1": 1,
      "vocab_static_tokens_v1": 1
    };
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf("vocab_") !== 0) return;
        if (protectedKeys[k]) return;
        if (k.indexOf(STATIC_DATA_PREFIX) === 0) return; // ข้อมูลสำรองของบัญชี
        if (window.SecureStore && window.SecureStore.remove) window.SecureStore.remove(k);
        else localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  /**
   * ถ้ายังไม่ล็อกอินและเป็น session ใหม่ → ล้างข้อมูล guest (รีเซ็ตทุกอย่าง).
   * ถ้าล็อกอินอยู่ หรือเป็น session เดิม → ไม่แตะข้อมูล.
   * เรียกจาก app.js init ก่อน loadInitialState() เพื่อให้ UI โหลดค่าเริ่มต้น.
   */
  function resetGuestDataIfNewSession() {
    if (isLoggedIn()) {
      setGuestSessionMarker();
      return;
    }
    let isNewSession = true;
    try { isNewSession = !sessionStorage.getItem(GUEST_SESSION_KEY); } catch (e) { isNewSession = true; }
    if (!isNewSession) return; // session เดิม → เก็บข้อมูลไว้
    clearGuestData();
    setGuestSessionMarker();
  }

  /** รวมข้อมูลท้องถิ่นปัจจุบัน (SYNC_KEYS + ข้อมูลเสริม) ไว้สำหรับอัปโหลดเข้าบัญชี. */
  function buildLocalPayload() {
    const payload = {};
    SYNC_KEYS.forEach(function (k) {
      try { payload[k] = JSON.stringify(SecureStore.load(k, null)); } catch (e) {}
    });
    return payload;
  }

  /**
   * อัปโหลดข้อมูล guest/ท้องถิ่นทั้งหมดไปยังบัญชี (Firebase > Backend > Static).
   * ใช้ตอนสมัครบัญชี/ล็อกอิน เพื่อให้ "สร้างบัญชีใหม่ = เซฟทุกอย่าง" และ
   * ล็อกเอาต์แล้วข้อมูลยังกู้คืนได้.
   */
  async function pushLocalDataToAccount() {
    const user = getUser();
    if (!user || !user.userId) return false;
    const payload = buildLocalPayload();
    if (isFirebaseMode()) {
      if (firebaseSyncTimer) clearTimeout(firebaseSyncTimer);
      return firebaseSaveData(payload, true);
    }
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(API_BASE + "/api/data", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + getToken(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ data: payload })
        });
        return res.ok;
      } catch (e) { return false; }
    }
    try {
      localStorage.setItem(STATIC_DATA_PREFIX + user.userId, JSON.stringify(payload));
      return true;
    } catch (e) { return false; }
  }

  /* ============================================================
     สมัครบัญชี — Firebase > Backend > Static
     ============================================================ */
  async function register(username, password, remember) {
    _remember = remember !== false;

    // 1. Firebase mode
    if (isFirebaseMode()) {
      const fb = await firebaseRegister(username, password);
      // สร้างบัญชีใหม่ = เซฟทุกอย่าง: push ข้อมูล guest ไปยังบัญชีทันที
      await pushLocalDataToAccount();
      return fb;
    }

    // 2. Backend mode
    if (await isBackendAvailable()) {
      const lang = getCurrentLang();
      const res = await fetch(API_BASE + "/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, lang })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "สมัครไม่สำเร็จ");
      setToken(data.token);
      setUser({ username: data.username, userId: data.userId });
      // Sync backend data → local SecureStore so the app can load it immediately
      await syncBackendDataToLocal(data.userId);
      // สร้างบัญชีใหม่ = เซฟทุกอย่าง: push ข้อมูล guest ไปยังบัญชีทันที
      await pushLocalDataToAccount();
      return data;
    }

    // 3. Static mode
    const users = getStaticUsers();
    if (users[username]) throw new Error("username already exists");
    if (username.length < 3) throw new Error("username must be at least 3 characters");
    if (password.length < 4) throw new Error("password must be at least 4 characters");
    const userId = genUserId();
    const passwordHash = await hashPassword(password);
    users[username] = { userId, passwordHash, lang: getCurrentLang(), created: Date.now() };
    saveStaticUsers(users);
    const token = genToken();
    const tokens = getStaticTokens();
    tokens[token] = { username, userId, created: Date.now() };
    saveStaticTokens(tokens);
    setToken(token);
    setUser({ username, userId });
    // สร้างบัญชีใหม่ = เซฟทุกอย่าง: push ข้อมูล guest ไปยังบัญชีทันที
    await pushLocalDataToAccount();
    // Initialize CEFR system for new user
    if (window.CefrSelector && window.CefrSelector.onLogin) {
      window.CefrSelector.onLogin();
    }
    return { token, username, userId };
  }

  /* ============================================================
     เข้าสู่ระบบ — Firebase > Backend > Static
     ============================================================ */
  async function login(username, password, remember) {
    _remember = remember !== false;

    // 1. Firebase mode
    if (isFirebaseMode()) {
      return firebaseLogin(username, password);
    }

    // 2. Backend mode
    if (await isBackendAvailable()) {
      const lang = getCurrentLang();
      const res = await fetch(API_BASE + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, lang })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      setToken(data.token);
      setUser({ username: data.username, userId: data.userId });
      // Sync backend data → local SecureStore so the app can load it immediately
      await syncBackendDataToLocal(data.userId);
      return data;
    }

    // 3. Static mode
    const users = getStaticUsers();
    const user = users[username];
    if (!user) throw new Error("invalid username or password");
    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) throw new Error("invalid username or password");
    const token = genToken();
    const tokens = getStaticTokens();
    tokens[token] = { username, userId: user.userId, created: Date.now() };
    saveStaticTokens(tokens);
    setToken(token);
    setUser({ username, userId: user.userId });
    // ข้อมูลบัญชีถูกเก็บไว้ใน localStorage (vocab_static_data_<userId>) — ดึงกลับมา
    await syncBackendDataToLocal(user.userId);
    // Initialize CEFR system on login
    if (window.CefrSelector && window.CefrSelector.onLogin) {
      window.CefrSelector.onLogin();
    }
    return { token, username, userId: user.userId };
  }

  /* ============================================================
     Sync backend data → local SecureStore (per-user isolation)
     ============================================================ */
  const SYNC_KEYS = [
    "vocab_progress_v1", "vocab_settings_v1", "vocab_streak_v1",
    "vocab_reviews_v1", "vocab_history_v1", "vocab_learned_v1", "vocab_game_v1"
  ];

  async function syncBackendDataToLocal(userId, opts) {
    if (!userId) return false;
    try {
      const res = await fetchData();
      // Firebase returns {data, syncMeta}; other modes return a flat key->JSON map.
      const data = res && res.data ? res.data : res;
      const remoteMeta = (res && res.syncMeta) || {};
      if (!data || Object.keys(data).length === 0) { setLastSyncTime(); return false; }
      let localMeta = {};
      try { localMeta = SecureStore.load(SYNC_META_KEY, {}) || {}; } catch (e) {}
      let changed = false;
      SYNC_KEYS.forEach(function (key) {
        if (data[key] == null) return;
        const remoteT = remoteMeta[key] || 0;
        const localT = localMeta[key] || 0;
        // Newer-wins per key; if local is newer keep local (it'll be pushed next save).
        if (remoteT >= localT) {
          try { SecureStore.save(key, JSON.parse(data[key])); } catch (e) {}
          localMeta[key] = remoteT;
          changed = true;
        }
      });
      if (changed) {
        try { SecureStore.save(SYNC_META_KEY, localMeta); } catch (e) {}
      }
      setLastSyncTime();
      if (changed && opts && opts.notify) {
        try { window.dispatchEvent(new Event("vocab:synced")); } catch (e) {}
      }
      return changed;
    } catch (e) {
      console.warn("[auth] syncBackendDataToLocal failed:", e.message);
      return false;
    }
  }

  /** Force a full pull+merge then push local state back to the cloud. */
  async function syncNow() {
    const user = getUser();
    if (!user) return false;
    const changed = await syncBackendDataToLocal(user.userId, { notify: true });
    if (isLoggedIn()) {
      const payload = {};
      SYNC_KEYS.forEach(function (k) {
        try { payload[k] = JSON.stringify(SecureStore.load(k, null)); } catch (e) {}
      });
      if (isFirebaseMode()) {
        if (firebaseSyncTimer) clearTimeout(firebaseSyncTimer);
        await firebaseSaveData(payload, true);
      } else {
        await saveData(payload);
      }
    }
    return changed;
  }

  /* ============================================================
     ออกจากระบบ
     ============================================================ */
  async function logout() {
    // เซฟข้อมูลปัจจุบันเข้าบัญชีก่อนออกระบบ — ข้อมูลจะถูกเก็บไว้ (vocab_static_data_<userId>
    // สำหรับ static mode หรือ server สำหรับ backend/firebase) และกู้คืนได้เมื่อล็อกอินใหม่
    try { await pushLocalDataToAccount(); } catch (e) { console.warn("[auth] logout push failed:", e.message); }

    // Firebase logout
    if (isFirebaseMode()) {
      await firebaseLogout();
      clearUserDataFromLocal();
      clearGuestSessionMarker();
      // Reset CEFR system on logout
      if (window.CefrSelector && window.CefrSelector.onLogout) {
        window.CefrSelector.onLogout();
      }
      location.reload();
      return;
    }

    // Static tokens cleanup
    const token = getToken();
    if (token) {
      const tokens = getStaticTokens();
      if (tokens[token]) {
        delete tokens[token];
        saveStaticTokens(tokens);
      }
    }
    clearUserDataFromLocal();
    clearAuth();
    clearGuestSessionMarker();
    // Reset CEFR system on logout
    if (window.CefrSelector && window.CefrSelector.onLogout) {
      window.CefrSelector.onLogout();
    }
    location.reload();
  }

  /* ============================================================
     Clear user-specific data from local storage on logout
     ============================================================ */
  function clearUserDataFromLocal() {
    SYNC_KEYS.forEach(function (key) {
      try { SecureStore.remove(key); } catch (e) {}
    });
  }

  /* ============================================================
     ดึงข้อมูล — Firebase > Backend > Static
     ============================================================ */
  async function fetchData() {
    const token = getToken();
    if (!token) return null;

    // 1. Firebase mode
    if (isFirebaseMode()) {
      return firebaseFetchData();
    }

    // 2. Backend mode
    if (await isBackendAvailable()) {
      const res = await fetch(API_BASE + "/api/data", {
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) {
        if (res.status === 401) logout();
        return null;
      }
      const data = await safeJson(res);
      return data.data;
    }

    // 3. Static mode
    const user = getUser();
    if (!user) return null;
    try {
      return JSON.parse(localStorage.getItem(STATIC_DATA_PREFIX + user.userId) || "{}");
    } catch (e) { return null; }
  }

  /* ============================================================
     บันทึกข้อมูล — Firebase > Backend > Static
     ============================================================ */
  let syncTimer = null;
  async function saveData(data) {
    const token = getToken();
    if (!token) return;

    // 1. Firebase mode
    if (isFirebaseMode()) {
      return firebaseSaveData(data);
    }

    // 2. Backend mode
    if (await isBackendAvailable()) {
      if (syncTimer) clearTimeout(syncTimer);
      return new Promise(function (resolve) {
        syncTimer = setTimeout(async function () {
          try {
            const res = await fetch(API_BASE + "/api/data", {
              method: "POST",
              headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ data })
            });
            if (res.status === 401) logout();
            resolve(res.ok);
          } catch (e) {
            console.warn("[auth] sync ไม่สำเร็จ:", e.message);
            resolve(false);
          }
        }, 2000);
      });
    }

    // 3. Static mode
    const user = getUser();
    if (!user) return;
    try {
      localStorage.setItem(STATIC_DATA_PREFIX + user.userId, JSON.stringify(data));
    } catch (e) {
      console.warn("[auth] static save ไม่สำเร็จ:", e.message);
    }
  }

  /* ============================================================
     ตรวจสอบ token — Firebase > Backend > Static
     ============================================================ */
  async function verifyToken() {
    const token = getToken();
    if (!token) return false;

    // 1. Firebase mode
    if (isFirebaseMode()) {
      return firebaseVerifyToken();
    }

    // 2. Backend mode
    if (await isBackendAvailable()) {
      try {
        const res = await fetch(API_BASE + "/api/me", {
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) { logout(); return false; }
        const data = await safeJson(res);
        setUser({ username: data.username, userId: data.userId });
        // Sync backend data → local SecureStore on token verification
        syncBackendDataToLocal(data.userId);
        return true;
      } catch (e) {
        return false;
      }
    }

    // 3. Static mode
    const tokens = getStaticTokens();
    if (!tokens[token]) {
      logout();
      return false;
    }
    const t = tokens[token];
    setUser({ username: t.username, userId: t.userId });
    return true;
  }

  /* ============================================================
     UI: โมดอล login/register — modern glassmorphism design
     ============================================================ */
  function createAuthModal() {
    const firebaseOn = isFirebaseMode();
    const overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.id = "authModal";

    // Social login buttons
    const googleBtn = firebaseOn ? `
      <button class="btn-social" id="authGoogle">
        <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        <span>${esc(t("auth.googleButton"))}</span>
      </button>` : "";

    const githubBtn = `
      <button class="btn-social" id="authGithub">
        <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        <span>GitHub</span>
      </button>`;

    const appleBtn = `
      <button class="btn-social" id="authApple">
        <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
        <span>Apple</span>
      </button>`;

    let mode = "login";
    overlay.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <div class="auth-hero">
          <div class="auth-hero-icon"><span class="ico" data-icon="lock"></span></div>
          <h2 id="authTitle">${esc(t("auth.loginTitle"))}</h2>
          <p id="authSub">${esc(getAuthSubText("login"))}</p>
          <button class="auth-hero-close" id="authClose" title="${esc(t("settings.close"))}" aria-label="Close"><span class="ico" data-icon="close"></span></button>
        </div>
        <div class="auth-body">
          <div class="auth-social">
            ${googleBtn}
            ${githubBtn}
            ${appleBtn}
          </div>
          <div class="auth-divider"><span>${esc(t("auth.orDivider"))}</span></div>
          <div class="auth-form">
            <div class="auth-field">
              <label class="auth-label" for="authUser">${esc(t("auth.username"))}</label>
              <div class="auth-input-wrap">
                <span class="auth-input-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
                <input type="text" id="authUser" class="auth-input" placeholder="${esc(t("auth.usernamePlaceholder"))}" autocomplete="username" />
              </div>
            </div>
            <div class="auth-field">
              <label class="auth-label" for="authPass">${esc(t("auth.password"))}</label>
              <div class="auth-input-wrap">
                <span class="auth-input-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
                <input type="password" id="authPass" class="auth-input" placeholder="${esc(t("auth.passwordPlaceholder"))}" autocomplete="current-password" />
                <button type="button" class="auth-toggle-pwd" id="authTogglePwd" aria-label="Toggle password visibility">
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div class="auth-pwd-strength" id="authPwdStrength">
                <div class="auth-pwd-strength-bar" data-index="0"></div>
                <div class="auth-pwd-strength-bar" data-index="1"></div>
                <div class="auth-pwd-strength-bar" data-index="2"></div>
                <div class="auth-pwd-strength-bar" data-index="3"></div>
              </div>
            </div>
            <div class="auth-options">
              <label class="auth-remember">
                <input type="checkbox" id="authRemember" checked />
                <span>${esc(t("auth.remember"))}</span>
              </label>
              <a href="#" class="auth-forgot" id="authForgot">${esc(t("auth.forgotPassword"))}</a>
            </div>
            <p class="auth-error hidden" id="authError"></p>
            <button class="btn btn-primary auth-submit" id="authSubmit">
              <span class="btn-text">${esc(mode === "register" ? t("auth.registerButton") : t("auth.loginButton"))}</span>
              <span class="spinner" aria-hidden="true"></span>
            </button>
            <p class="auth-toggle-text" id="authToggleText">
              ${esc(t("auth.noAccount"))} <a href="#" id="authToggle">${esc(t("auth.registerLink"))}</a>
            </p>
          </div>
          <div class="auth-footer">
            <a href="#" id="authTerms">${esc(t("auth.terms"))}</a>
            <span class="auth-sep">·</span>
            <a href="#" id="authPrivacy">${esc(t("auth.privacy"))}</a>
            <span class="auth-sep">·</span>
            <a href="#" id="authHelp">${esc(t("auth.help"))}</a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // inject icons
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });

    const title = overlay.querySelector("#authTitle");
    const sub = overlay.querySelector("#authSub");
    const submit = overlay.querySelector("#authSubmit");
    const toggleText = overlay.querySelector("#authToggleText");
    const toggle = overlay.querySelector("#authToggle");
    const error = overlay.querySelector("#authError");
    const userInput = overlay.querySelector("#authUser");
    const passInput = overlay.querySelector("#authPass");
    const rememberInput = overlay.querySelector("#authRemember");
    const googleBtnEl = overlay.querySelector("#authGoogle");
    const pwdToggle = overlay.querySelector("#authTogglePwd");
    const pwdStrength = overlay.querySelector("#authPwdStrength");
    const pwdBars = pwdStrength ? pwdStrength.querySelectorAll(".auth-pwd-strength-bar") : [];
    const forgotLink = overlay.querySelector("#authForgot");
    const termsLink = overlay.querySelector("#authTerms");
    const privacyLink = overlay.querySelector("#authPrivacy");
    const helpLink = overlay.querySelector("#authHelp");

    function getAuthSubText(m) {
      if (isFirebaseMode()) return m === "login" ? t("auth.loginSubFirebase") : t("auth.registerSubFirebase");
      if (isStaticMode()) return m === "login" ? t("auth.loginSubStatic") : t("auth.registerSubStatic");
      return m === "login" ? t("auth.loginSub") : t("auth.registerSub");
    }

    function setMode(m) {
      mode = m;
      if (m === "login") {
        title.textContent = t("auth.loginTitle");
        sub.textContent = getAuthSubText("login");
        submit.querySelector(".btn-text").textContent = t("auth.loginButton");
        toggleText.innerHTML = esc(t("auth.noAccount")) + ' <a href="#" id="authToggle">' + esc(t("auth.registerLink")) + '</a>';
      } else {
        title.textContent = t("auth.registerTitle");
        sub.textContent = getAuthSubText("register");
        submit.querySelector(".btn-text").textContent = t("auth.registerButton");
        toggleText.innerHTML = esc(t("auth.hasAccount")) + ' <a href="#" id="authToggle">' + esc(t("auth.loginLink")) + '</a>';
      }
      error.classList.add("hidden");
      pwdStrength.style.display = m === "register" ? "flex" : "none";
      resetPwdStrength();
      const newToggle = overlay.querySelector("#authToggle");
      if (newToggle) newToggle.onclick = function (e) { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); };
      overlay.querySelectorAll("[data-icon]").forEach(function (n) {
        const ICONS = window.VOCAB_ICONS || {};
        n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
      });
    }

    function resetPwdStrength() {
      pwdBars.forEach(function (b) { b.className = "auth-pwd-strength-bar"; });
    }

    function updatePwdStrength(pwd) {
      if (pwd.length === 0) { resetPwdStrength(); return; }
      let score = 0;
      if (pwd.length >= 6) score++;
      if (pwd.length >= 10) score++;
      if (/[A-Z]/.test(pwd)) score++;
      if (/[0-9]/.test(pwd)) score++;
      if (/[^A-Za-z0-9]/.test(pwd)) score++;
      const levels = ["weak", "weak", "medium", "strong", "strong"];
      pwdBars.forEach(function (b, i) {
        b.className = "auth-pwd-strength-bar" + (i <= score ? " " + levels[Math.min(score, 4)] : "");
      });
    }

    toggle.onclick = function (e) { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); };
    overlay.querySelector("#authClose").onclick = function () { closeAuthModal(); };
    overlay.onclick = function (e) { if (e.target === overlay) closeAuthModal(); };

    // Password visibility toggle
    if (pwdToggle) {
      pwdToggle.onclick = function () {
        const isPassword = passInput.type === "password";
        passInput.type = isPassword ? "text" : "password";
        pwdToggle.querySelector("svg").innerHTML = isPassword
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>'
          : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
      };
    }

    // Password strength indicator (register mode only)
    if (passInput && pwdStrength) {
      pwdStrength.style.display = "none";
      passInput.addEventListener("input", function () {
        updatePwdStrength(passInput.value);
      });
    }

    // Google Sign-in handler
    if (googleBtnEl) {
      googleBtnEl.onclick = async function () {
        googleBtnEl.disabled = true;
        error.classList.add("hidden");
        try {
          const result = await signInWithGoogle();
          if (result && result.redirecting) {
            error.textContent = t("auth.redirectingToGoogle") || "กำลังไปที่หน้า Google...";
            error.classList.remove("hidden");
            error.style.color = "var(--primary)";
          } else {
            closeAuthModal();
            location.reload();
          }
        } catch (e) {
          error.textContent = e.message;
          error.classList.remove("hidden");
          error.style.color = "";
          googleBtnEl.disabled = false;
        }
      };
    }

    // GitHub login — ผ่าน backend (เช่น flow Google: สร้าง account + แสดงรหัสผ่านอัตโนมัติ)
    const githubBtnEl = overlay.querySelector("#authGithub");
    if (githubBtnEl) {
      githubBtnEl.onclick = async function () {
        githubBtnEl.disabled = true;
        error.classList.add("hidden");
        try {
          const result = await signInWithGithub();
          if (result) {
            closeAuthModal();
            location.reload();
          } else {
            githubBtnEl.disabled = false;
          }
        } catch (e) {
          error.textContent = e.message || e.code || "เกิดข้อผิดพลาด";
          error.classList.remove("hidden");
          error.style.color = "";
          githubBtnEl.disabled = false;
        }
      };
    }

    // Apple login — ผ่าน backend
    const appleBtnEl = overlay.querySelector("#authApple");
    if (appleBtnEl) {
      appleBtnEl.onclick = async function () {
        appleBtnEl.disabled = true;
        error.classList.add("hidden");
        try {
          const result = await signInWithApple();
          if (result) {
            closeAuthModal();
            location.reload();
          } else {
            appleBtnEl.disabled = false;
          }
        } catch (e) {
          error.textContent = e.message || e.code || "เกิดข้อผิดพลาด";
          error.classList.remove("hidden");
          error.style.color = "";
          appleBtnEl.disabled = false;
        }
      };
    }

    // Forgot password handler — จริง (Firebase: ส่งอีเมล / backend: ขอ reset code / static: ตั้งใหม่เลย)
    if (forgotLink) {
      forgotLink.onclick = async function (e) {
        e.preventDefault();
        if (mode === "register") return;
        const username = userInput.value.trim();
        if (!username) {
          error.textContent = t("auth.enterEmailFirst") || "Enter your username or email first";
          error.classList.remove("hidden");
          return;
        }
        submit.classList.add("loading");
        submit.querySelector(".btn-text").textContent = t("auth.sending") || "Sending...";
        error.classList.add("hidden");
        try {
          const result = await forgotPassword(username);
          if (result.mode === "firebase") {
            error.textContent = t("auth.resetSent") || "If that account exists, a reset link has been sent.";
            error.classList.remove("hidden");
            error.style.color = "var(--good)";
            setTimeout(function () { error.classList.add("hidden"); }, 5000);
          } else if (result.mode === "backend" && result.resetCode) {
            // backend ส่งรหัสมา — เปิด modal ให้กรอกรหัส + รหัสใหม่
            error.classList.add("hidden");
            showResetCodeModal(result.username, result.resetCode);
          } else if (result.mode === "backend") {
            error.textContent = t("auth.resetSent") || "If that account exists, a reset link has been sent.";
            error.classList.remove("hidden");
            error.style.color = "var(--good)";
            setTimeout(function () { error.classList.add("hidden"); }, 5000);
          } else {
            // Static mode — ให้ตั้งรหัสใหม่ทันที
            error.classList.add("hidden");
            showStaticResetModal(result.username);
          }
        } catch (e) {
          error.textContent = e.message || "เกิดข้อผิดพลาด";
          error.classList.remove("hidden");
          error.style.color = "";
        }
        submit.classList.remove("loading");
        submit.querySelector(".btn-text").textContent = t("auth.loginButton");
      };
    }

    // Terms / Privacy / Help links (open in new tab or show toast)
    function handleLink(e, msg) {
      e.preventDefault();
      error.textContent = msg;
      error.classList.remove("hidden");
      error.style.color = "var(--primary)";
      setTimeout(function () { error.classList.add("hidden"); }, 3000);
    }
    if (termsLink) termsLink.onclick = function (e) { handleLink(e, t("auth.termsMsg") || "Terms of Service — coming soon"); };
    if (privacyLink) privacyLink.onclick = function (e) { handleLink(e, t("auth.privacyMsg") || "Privacy Policy — coming soon"); };
    if (helpLink) helpLink.onclick = function (e) { handleLink(e, t("auth.helpMsg") || "Help Center — coming soon"); };

    async function handleSubmit() {
      const username = userInput.value.trim();
      const password = passInput.value;
      const remember = rememberInput ? rememberInput.checked : true;
      if (!username || !password) {
        error.textContent = t("auth.fillBoth");
        error.classList.remove("hidden");
        error.style.color = "";
        return;
      }
      submit.classList.add("loading");
      submit.querySelector(".btn-text").textContent = t("auth.processing");
      error.classList.add("hidden");

      try {
        if (mode === "register") {
          await register(username, password, remember);
        } else {
          await login(username, password, remember);
        }
        closeAuthModal();
        location.reload();
      } catch (e) {
        error.textContent = e.message || e.code || "เกิดข้อผิดพลาด";
        error.classList.remove("hidden");
        error.style.color = "";
        submit.classList.remove("loading");
        submit.querySelector(".btn-text").textContent = mode === "register" ? t("auth.registerButton") : t("auth.loginButton");
      }
    }

    submit.onclick = handleSubmit;
    passInput.addEventListener("keydown", function (e) { if (e.key === "Enter") handleSubmit(); });
    userInput.addEventListener("keydown", function (e) { if (e.key === "Enter") passInput.focus(); });

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(function () { userInput.focus(); }, 100);
  }

  // --- ฟังก์ชันช่วยดึงภาษา ---
  function t(key) {
    try {
      if (typeof window.VocabApp !== "undefined" && window.VocabApp && window.VocabApp.t) {
        return window.VocabApp.t(key);
      }
    } catch (e) { }
    return key;
  }

  function esc(s) {
    var A = String.fromCharCode(38);
    return String(s == null ? "" : s)
      .replace(/&/g, A + "amp;")
      .replace(/</g, A + "lt;")
      .replace(/>/g, A + "gt;")
      .replace(/"/g, A + "quot;")
      .replace(/'/g, A + "#39;");
  }

  function closeAuthModal() {
    const overlay = document.getElementById("authModal");
    if (overlay) {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    }
  }

  // --- Modal กรอกรหัสยืนยัน + รหัสผ่านใหม่ (backend reset flow) ---
  function showResetCodeModal(username, resetCode) {
    const overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.id = "resetCodeModal";
    overlay.innerHTML =
      '<div class="auth-modal" role="dialog" aria-modal="true">' +
        '<div class="auth-hero">' +
          '<div class="auth-hero-icon"><span class="ico" data-icon="lock"></span></div>' +
          '<h2>' + esc(t("auth.resetTitle")) + '</h2>' +
          '<button class="auth-hero-close" id="resetClose" title="' + esc(t("settings.close")) + '"><span class="ico" data-icon="close"></span></button>' +
        '</div>' +
        '<div class="auth-body">' +
          '<p class="reset-code-hint">' + esc(t("auth.resetCodeHint")) + '</p>' +
          '<div class="reset-code-box">' + esc(resetCode) + '</div>' +
          '<div class="auth-field">' +
            '<label class="auth-label" for="resetCodeInput">' + esc(t("auth.resetCode")) + '</label>' +
            '<div class="auth-input-wrap"><input type="text" id="resetCodeInput" class="auth-input" placeholder="ABC123" /></div>' +
          '</div>' +
          '<div class="auth-field">' +
            '<label class="auth-label" for="resetNewPass">' + esc(t("auth.newPassword")) + '</label>' +
            '<div class="auth-input-wrap"><input type="password" id="resetNewPass" class="auth-input" /></div>' +
          '</div>' +
          '<p class="auth-error hidden" id="resetError"></p>' +
          '<button class="btn btn-primary auth-submit" id="resetSubmit">' +
            '<span class="btn-text">' + esc(t("auth.resetPassword")) + '</span><span class="spinner" aria-hidden="true"></span>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });
    const errorEl = overlay.querySelector("#resetError");
    const codeIn = overlay.querySelector("#resetCodeInput");
    const passIn = overlay.querySelector("#resetNewPass");
    const btn = overlay.querySelector("#resetSubmit");
    function close() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    }
    overlay.querySelector("#resetClose").onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    btn.onclick = async function () {
      const code = codeIn.value.trim();
      const np = passIn.value;
      if (!code || !np) {
        errorEl.textContent = t("auth.fillField");
        errorEl.classList.remove("hidden");
        return;
      }
      if (np.length < 4) {
        errorEl.textContent = t("auth.passwordTooShort");
        errorEl.classList.remove("hidden");
        return;
      }
      btn.classList.add("loading");
      errorEl.classList.add("hidden");
      try {
        await resetPasswordWithCode(username, code, np);
        if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.resetDone"), "ok", "check");
        close();
      } catch (e) {
        errorEl.textContent = e.message || "เกิดข้อผิดพลาด";
        errorEl.classList.remove("hidden");
        btn.classList.remove("loading");
      }
    };
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(function () { codeIn.focus(); }, 100);
  }

  // --- Modal ตั้งรหัสผ่านใหม่ทันที (static mode ไม่มี secret) ---
  function showStaticResetModal(username) {
    const overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.id = "staticResetModal";
    overlay.innerHTML =
      '<div class="auth-modal" role="dialog" aria-modal="true">' +
        '<div class="auth-hero">' +
          '<div class="auth-hero-icon"><span class="ico" data-icon="lock"></span></div>' +
          '<h2>' + esc(t("auth.resetTitle")) + '</h2>' +
          '<button class="auth-hero-close" id="sResetClose" title="' + esc(t("settings.close")) + '"><span class="ico" data-icon="close"></span></button>' +
        '</div>' +
        '<div class="auth-body">' +
          '<p class="reset-code-hint">' + esc(t("auth.staticResetHint")) + '</p>' +
          '<div class="auth-field">' +
            '<label class="auth-label" for="sResetPass">' + esc(t("auth.newPassword")) + '</label>' +
            '<div class="auth-input-wrap"><input type="password" id="sResetPass" class="auth-input" /></div>' +
          '</div>' +
          '<p class="auth-error hidden" id="sResetError"></p>' +
          '<button class="btn btn-primary auth-submit" id="sResetSubmit">' +
            '<span class="btn-text">' + esc(t("auth.resetPassword")) + '</span><span class="spinner" aria-hidden="true"></span>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });
    const errorEl = overlay.querySelector("#sResetError");
    const passIn = overlay.querySelector("#sResetPass");
    const btn = overlay.querySelector("#sResetSubmit");
    function close() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    }
    overlay.querySelector("#sResetClose").onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    btn.onclick = async function () {
      const np = passIn.value;
      if (np.length < 4) {
        errorEl.textContent = t("auth.passwordTooShort");
        errorEl.classList.remove("hidden");
        return;
      }
      btn.classList.add("loading");
      errorEl.classList.add("hidden");
      try {
        const users = getStaticUsers();
        const u = users[username];
        if (!u) throw new Error(t("auth.userNotFound"));
        u.passwordHash = await hashPassword(np);
        saveStaticUsers(users);
        if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.resetDone"), "ok", "check");
        close();
      } catch (e) {
        errorEl.textContent = e.message || "เกิดข้อผิดพลาด";
        errorEl.classList.remove("hidden");
        btn.classList.remove("loading");
      }
    };
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(function () { passIn.focus(); }, 100);
  }

  // --- อัปเดต sidebar auth button ---
  function updateSidebarAuthBtn() {
    const user = getUser();
    const btn = document.getElementById("sidebarAuthBtn");
    if (!btn) return;

    if (user) {
      btn.classList.add("logged-in");
      const prof = user.profile || {};
      const emoji = prof.avatar || "";
      btn.innerHTML =
        '<span class="auth-avatar">' + (emoji || user.username.charAt(0).toUpperCase()) + "</span> " +
        esc(user.username);
      btn.title = "ดูโปรไฟล์ (" + user.username + ")";
      btn.setAttribute("aria-label", "ดูโปรไฟล์ (" + user.username + ")");
    } else {
      btn.classList.remove("logged-in");
      btn.innerHTML =
        '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span> ' + esc(t("auth.loginTitle"));
      btn.title = "เข้าสู่ระบบ / สมัครบัญชี";
      btn.setAttribute("aria-label", "เข้าสู่ระบบ / สมัครบัญชี");
    }
  }

  // --- รอฟังการเปลี่ยนภาษา ---
  function onLanguageChanged() {
    const authOverlay = document.getElementById("authModal");
    if (authOverlay && authOverlay.classList.contains("open")) {
      closeAuthModal();
      createAuthModal();
    }
    const profileOverlay = document.getElementById("profileModal");
    if (profileOverlay && profileOverlay.classList.contains("open")) {
      closeProfileModal();
      showProfileModal();
    }
    updateSidebarAuthBtn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      document.addEventListener("vocab-lang-changed", onLanguageChanged);
    });
  } else {
    document.addEventListener("vocab-lang-changed", onLanguageChanged);
  }

  // --- Profile Modal — big-site style with editable profile ---
  const PROFILE_GRADIENTS = ["sunset", "forest", "ocean", "neon", "aurora", "gold", "candy", "midnight"];
  const PROFILE_AVATARS = ["🦊", "🐼", "🐯", "🦁", "🐸", "🐙", "🦄", "🐨", "🐳", "🦋", "🐝", "🦉", "🐢", "🐬", "🦜", "🐺", "🦖", "🐱", "🐶", "🐭", "🐰", "🐵", "🐷", "🦈"];

  function profileDefaults() {
    return { bio: "", avatar: "", avatarBg: "aurora", banner: "sunset" };
  }
  function getProfile() {
    const u = getUser();
    return Object.assign(profileDefaults(), (u && u.profile) || {});
  }
  function setGrad(el, prefix, id) {
    if (!el) return;
    PROFILE_GRADIENTS.forEach(function (g) { el.classList.remove(prefix + g); });
    el.classList.add(prefix + (PROFILE_GRADIENTS.indexOf(id) > -1 ? id : "sunset"));
  }

  function showProfileModal(editMode) {
    const user = getUser();
    if (!user) return;
    closeProfileModal(true);

    const firebaseOn = isFirebaseMode();
    const staticMode = isStaticMode();
    let syncLabel;
    if (firebaseOn) syncLabel = t("auth.syncFirebase");
    else if (staticMode) syncLabel = t("auth.syncLocal");
    else syncLabel = t("auth.syncAuto");

    const providerLabel = user.provider === "google" ? "Google" : (user.provider === "email" ? "Email" : "—");

    const stats = window.VocabApp && window.VocabApp.getStats ? window.VocabApp.getStats() : null;
    const learnedCount = stats ? stats.wordsLearned || 0 : 0;
    const mastered = stats ? stats.mastered || 0 : 0;
    const streak = stats ? stats.streak || 0 : 0;
    const level = stats ? stats.level || 1 : 1;
    const rank = stats ? stats.rank || "" : "";
    const ach = stats ? stats.achievements || 0 : 0;
    const pct = stats ? (stats.pct || 0) : 0;
    const inLevel = stats ? stats.inLevel || 0 : 0;
    const need = stats ? stats.need || 100 : 100;

    const prof = getProfile();
    const avatarGlyph = prof.avatar || user.username.charAt(0).toUpperCase();

    const overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.id = "profileModal";
    overlay.innerHTML = `
      <div class="profile-modal auth-modal pp-modal" role="dialog" aria-modal="true" aria-labelledby="ppName">
        <div class="profile-hero pp-banner" id="ppBanner">
          <div class="profile-avatar pp-avatar" id="ppAvatar">${esc(avatarGlyph)}</div>
          <h2 class="profile-name" id="ppName" aria-label="profile name">${esc(user.username)}</h2>
          <p class="profile-badge" id="ppRank">${esc(rank ? t("auth.levelProgress").replace("{l}", level).replace("{rank}", rank) : (t("auth.member")))}</p>
          <p class="profile-sub" id="ppBio">${esc(prof.bio || t("auth.member"))}</p>
          <button class="profile-hero-close" id="profileClose" title="${esc(t("settings.close"))}" aria-label="Close"><span class="ico" data-icon="close"></span></button>
        </div>
        <div class="profile-body">
          <div id="ppView">
            <div class="profile-xp">
              <div class="profile-xp-label"><span class="ico" data-icon="bolt"></span> ${level} · ${esc(rank)}</div>
              <div class="profile-xp-bar"><span class="profile-xp-fill" id="ppXpFill"></span></div>
              <div class="profile-xp-text">${inLevel} / ${need} XP · ${pct}%</div>
            </div>
            <div class="profile-stats">
              <div class="profile-stat"><div class="profile-stat-num">${learnedCount}</div><div class="profile-stat-label">${esc(t("auth.wordsLearned"))}</div></div>
              <div class="profile-stat"><div class="profile-stat-num">${mastered}</div><div class="profile-stat-label">${esc(t("auth.masteredWords"))}</div></div>
              <div class="profile-stat"><div class="profile-stat-num">${streak}</div><div class="profile-stat-label">${esc(t("streak.days"))}</div></div>
              <div class="profile-stat"><div class="profile-stat-num">${ach}</div><div class="profile-stat-label">${esc(t("auth.achievementsCount"))}</div></div>
            </div>
            <div class="profile-info">
              <div class="profile-row">
                <span class="profile-label"><span class="ico" data-icon="user"></span> ${esc(t("auth.username"))}</span>
                <span class="profile-value">${esc(user.username)}</span>
              </div>
              <div class="profile-row">
                <span class="profile-label"><span class="ico" data-icon="id"></span> ${esc(t("auth.userId"))}</span>
                <span class="profile-value">#${(user.userId || "-").substring(0, 12)}</span>
              </div>
              <div class="profile-row">
                <span class="profile-label"><span class="ico" data-icon="provider"></span> ${esc(t("auth.provider"))}</span>
                <span class="profile-value">${esc(providerLabel)}</span>
              </div>
              <div class="profile-row">
                <span class="profile-label"><span class="ico" data-icon="status"></span> ${esc(t("auth.status"))}</span>
                <span class="profile-value profile-status"><span class="ico" data-icon="status"></span> ออนไลน์</span>
              </div>
              <div class="profile-row">
                <span class="profile-label"><span class="ico" data-icon="sync"></span> ${esc(t("auth.sync"))}</span>
                <span class="profile-value">${esc(syncLabel)}</span>
              </div>
            </div>
            <div class="profile-account">
              <div class="profile-account-title"><span class="ico" data-icon="lock"></span> ${esc(t("auth.account"))}</div>
              <button class="btn btn-sm" id="profileChangePassword">${esc(t("auth.changePassword"))}</button>
              ${staticMode ? '<button class="btn btn-sm" id="profileChangeUsername">' + esc(t("auth.changeUsername")) + '</button>' : ""}
              ${firebaseOn || !staticMode ? '<button class="btn btn-sm" id="profileChangeEmail">' + esc(t("auth.changeEmail")) + '</button>' : ""}
              ${firebaseOn ? '<button class="btn btn-sm" id="profileVerifyEmail">' + esc(t("auth.verifyEmail")) + '</button>' : ""}
            </div>
            <div class="profile-actions">
              <button class="btn btn-primary" id="profileEdit">${esc(t("auth.editProfile"))}</button>
              <button class="btn btn-bad" id="profileLogout">${esc(t("auth.logout"))}</button>
              <button class="btn" id="profileDone">${esc(t("settings.close"))}</button>
            </div>
          </div>
          <div id="ppEdit" hidden>
            <div class="pp-section">
              <label class="pp-label" for="ppNameInput">${esc(t("auth.displayName"))}</label>
              <input class="auth-input" type="text" id="ppNameInput" maxlength="24" value="${esc(user.username)}" />
            </div>
            <div class="pp-section">
              <label class="pp-label" for="ppBioInput">${esc(t("auth.bio"))}</label>
              <input class="auth-input" type="text" id="ppBioInput" maxlength="80" placeholder="${esc(t("auth.bioPlaceholder"))}" value="${esc(prof.bio)}" />
            </div>
            <div class="pp-section">
              <div class="pp-label">${esc(t("auth.chooseAvatar"))}</div>
              <div class="pp-avatars" id="ppAvatarGrid">
                ${PROFILE_AVATARS.map(function (a) {
                  return '<button type="button" class="pp-av" data-av="' + a + '">' + a + "</button>";
                }).join("")}
              </div>
              <div class="pp-label pp-sub-label">${esc(t("auth.avatarStyle"))}</div>
              <div class="pp-swatches" id="ppAvatarBg">
                ${PROFILE_GRADIENTS.map(function (g) { return '<button type="button" class="pp-swatch" data-g="' + g + '"></button>'; }).join("")}
              </div>
            </div>
            <div class="pp-section">
              <div class="pp-label">${esc(t("auth.chooseBanner"))}</div>
              <div class="pp-swatches pp-banner-row" id="ppBannerRow">
                ${PROFILE_GRADIENTS.map(function (g) { return '<button type="button" class="pp-swatch" data-g="' + g + '"></button>'; }).join("")}
              </div>
            </div>
            <div class="profile-actions">
              <button class="btn btn-primary" id="ppSave">${esc(t("auth.saveChanges"))}</button>
              <button class="btn" id="ppCancel">${esc(t("auth.cancel"))}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // icons
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });

    // gradient application
    setGrad(overlay.querySelector("#ppBanner"), "pp-banner-", prof.banner);
    setGrad(overlay.querySelector("#ppAvatar"), "pp-av-", prof.avatarBg);
    overlay.querySelectorAll(".pp-swatch").forEach(function (n) {
      setGrad(n, "pp-swatch-", n.dataset.g);
    });
    overlay.querySelector("#ppAvatarGrid").querySelectorAll(".pp-av").forEach(function (n) {
      if (n.dataset.av === prof.avatar) n.classList.add("sel");
    });
    overlay.querySelector("#ppAvatarBg").querySelectorAll(".pp-swatch").forEach(function (n) {
      if (n.dataset.g === prof.avatarBg) n.classList.add("sel");
    });
    overlay.querySelector("#ppBannerRow").querySelectorAll(".pp-swatch").forEach(function (n) {
      if (n.dataset.g === prof.banner) n.classList.add("sel");
    });
    const fill = overlay.querySelector("#ppXpFill");
    if (fill) fill.style.width = (pct || 0) + "%";

    function applyPreview() {
      const nameIn = overlay.querySelector("#ppNameInput");
      const bioIn = overlay.querySelector("#ppBioInput");
      const selAv = overlay.querySelector("#ppAvatarGrid .pp-av.sel");
      const selBg = overlay.querySelector("#ppAvatarBg .pp-swatch.sel");
      const selBanner = overlay.querySelector("#ppBannerRow .pp-swatch.sel");
      const nm = overlay.querySelector("#ppName");
      const bioEl = overlay.querySelector("#ppBio");
      const av = overlay.querySelector("#ppAvatar");
      if (nm) nm.textContent = nameIn.value.trim() || user.username;
      if (bioEl) bioEl.textContent = bioIn.value.trim() || t("auth.member");
      if (av && selAv) av.textContent = selAv.dataset.av;
      if (av && selBg) setGrad(av, "pp-av-", selBg.dataset.g);
      const banner = overlay.querySelector("#ppBanner");
      if (banner && selBanner) setGrad(banner, "pp-banner-", selBanner.dataset.g);
    }
    overlay.querySelectorAll(".pp-av").forEach(function (n) {
      n.onclick = function () {
        overlay.querySelectorAll(".pp-av").forEach(function (x) { x.classList.remove("sel"); });
        n.classList.add("sel");
        applyPreview();
      };
    });
    overlay.querySelectorAll(".pp-swatch").forEach(function (n) {
      n.onclick = function () {
        const row = n.parentNode;
        row.querySelectorAll(".pp-swatch").forEach(function (x) { x.classList.remove("sel"); });
        n.classList.add("sel");
        applyPreview();
      };
    });

    overlay.querySelector("#profileClose").onclick = function () { closeProfileModal(); };
    overlay.querySelector("#profileDone").onclick = function () { closeProfileModal(); };
    // --- บัญชี: เปลี่ยนรหัสผ่าน / username / email / ยืนยันอีเมล ---
    const pwBtn = overlay.querySelector("#profileChangePassword");
    if (pwBtn) {
      pwBtn.onclick = async function () {
        closeProfileModal();
        try {
          const cur = await showPromptModal(t("auth.changePassword"), t("auth.currentPassword"), t("auth.passwordPlaceholder"), t("auth.continue"), "password");
          if (!cur) return;
          const np = await showPromptModal(t("auth.changePassword"), t("auth.newPassword"), t("auth.passwordPlaceholder"), t("auth.continue"), "password");
          if (!np) return;
          await changePassword(cur, np);
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.passwordChanged"), "ok", "check");
        } catch (e) {
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(e.message || "เกิดข้อผิดพลาด", "err", "alert");
        }
      };
    }
    const unBtn = overlay.querySelector("#profileChangeUsername");
    if (unBtn) {
      unBtn.onclick = async function () {
        closeProfileModal();
        try {
          const nu = await showPromptModal(t("auth.changeUsername"), t("auth.newUsername"), t("auth.usernamePlaceholder"), t("auth.continue"));
          if (!nu) return;
          await changeUsername(nu);
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.usernameChanged"), "ok", "check");
          updateSidebarAuthBtn();
        } catch (e) {
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(e.message || "เกิดข้อผิดพลาด", "err", "alert");
        }
      };
    }
    const emBtn = overlay.querySelector("#profileChangeEmail");
    if (emBtn) {
      emBtn.onclick = async function () {
        closeProfileModal();
        try {
          const ne = await showPromptModal(t("auth.changeEmail"), t("auth.newEmail"), "name@example.com", t("auth.continue"), "email");
          if (!ne) return;
          await changeEmail(ne);
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.emailChanged"), "ok", "check");
        } catch (e) {
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(e.message || "เกิดข้อผิดพลาด", "err", "alert");
        }
      };
    }
    const veBtn = overlay.querySelector("#profileVerifyEmail");
    if (veBtn) {
      veBtn.onclick = async function () {
        try {
          await verifyEmail();
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.verifyEmailSent"), "ok", "check");
        } catch (e) {
          if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(e.message || "เกิดข้อผิดพลาด", "err", "alert");
        }
      };
    }
    overlay.querySelector("#profileEdit").onclick = function () {
      overlay.querySelector("#ppView").hidden = true;
      overlay.querySelector("#ppEdit").hidden = false;
    };
    overlay.querySelector("#ppCancel").onclick = function () {
      overlay.querySelector("#ppEdit").hidden = true;
      overlay.querySelector("#ppView").hidden = false;
    };
    overlay.querySelector("#ppSave").onclick = function () {
      const nameIn = overlay.querySelector("#ppNameInput");
      const bioIn = overlay.querySelector("#ppBioInput");
      const selAv = overlay.querySelector("#ppAvatarGrid .pp-av.sel");
      const selBg = overlay.querySelector("#ppAvatarBg .pp-swatch.sel");
      const selBanner = overlay.querySelector("#ppBannerRow .pp-swatch.sel");
      const newName = (nameIn.value || "").trim();
      if (newName.length < 3) {
        if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.nameTooShort"), "err", "alert");
        nameIn.focus();
        return;
      }
      const prof2 = {
        bio: (bioIn.value || "").trim(),
        avatar: selAv ? selAv.dataset.av : "",
        avatarBg: selBg ? selBg.dataset.g : "aurora",
        banner: selBanner ? selBanner.dataset.g : "sunset"
      };
      user.username = newName;
      user.profile = prof2;
      setUser(user);
      updateSidebarAuthBtn();
      if (window.VocabApp && window.VocabApp.toast) window.VocabApp.toast(t("auth.profileSaved"), "ok", "check");
      overlay.querySelector("#ppEdit").hidden = true;
      overlay.querySelector("#ppView").hidden = false;
      overlay.querySelector("#ppName").textContent = newName;
      overlay.querySelector("#ppBio").textContent = prof2.bio || t("auth.member");
      overlay.querySelector("#ppAvatar").textContent = prof2.avatar || newName.charAt(0).toUpperCase();
    };
    overlay.querySelector("#profileLogout").onclick = function () {
      if (confirm(t("auth.logoutConfirm") || "ออกจากระบบ?")) {
        logout();
      }
    };
    overlay.onclick = function (e) { if (e.target === overlay) closeProfileModal(); };

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeProfileModal(instant) {
    const overlay = document.getElementById("profileModal");
    if (overlay) {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      const t = instant ? 0 : 300;
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, t);
    }
  }

  // --- Expose API ---
  window.VocabAuth = {
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    getUser: getUser,
    getLastSyncTime: getLastSyncTime,
    syncNow: syncNow,
    fetchLeaderboard: fetchLeaderboard,
    register: register,
    login: login,
    logout: logout,
    fetchData: fetchData,
    saveData: saveData,
    verifyToken: verifyToken,
    updateSidebarAuthBtn: updateSidebarAuthBtn,
    createAuthModal: createAuthModal,
    showProfileModal: showProfileModal,
    getProfile: getProfile,
    isStaticMode: isStaticMode,
    isFirebaseMode: isFirebaseMode,
    signInWithGoogle: signInWithGoogle,
    firebaseCheckRedirectResult: firebaseCheckRedirectResult,
    resetGuestDataIfNewSession: resetGuestDataIfNewSession,
    signInWithGithub: signInWithGithub,
    signInWithApple: signInWithApple,
    forgotPassword: forgotPassword,
    resetPasswordWithCode: resetPasswordWithCode,
    changePassword: changePassword,
    changeEmail: changeEmail,
    changeUsername: changeUsername,
    verifyEmail: verifyEmail,
    t: t
  };

  // --- Auto-init UI ---
  function initAuthUI() {
    try { updateSidebarAuthBtn(); } catch (e) { console.warn("[auth] updateSidebarAuthBtn:", e); }

    // ถ้า Firebase mode — ใช้ onAuthStateChanged เป็นหลัก (เชื่อถือได้กว่า getRedirectResult)
    if (isFirebaseMode()) {
      // ลงทะเบียน listener ทันที (ไม่รอ getRedirectResult) เพื่อไม่พลาด session
      // ที่ Firebase persist ไว้แล้วแม้ getRedirectResult จะค้างหรือตอบ null
      window.firebaseAuth.onAuthStateChanged(function (user) {
        if (user) {
          const displayName = user.displayName || user.email || "User";
          setToken("firebase:" + user.uid);
          setUser({ username: displayName, userId: user.uid, provider: "google" });
          console.log("[firebase] onAuthStateChanged: ล็อกอินแล้ว —", displayName);
          try { sessionStorage.removeItem("vocab_oauth_pending"); } catch (e) {}
          // Pull latest cloud data on every app open (B2) — merge per key, then notify app.
          syncBackendDataToLocal(user.uid, { notify: true });
          // Sync กับ backend เพื่อสร้าง local account
          syncGoogleWithBackend(user);
          updateSidebarAuthBtn();
        } else {
          console.log("[firebase] onAuthStateChanged: ยังไม่ล็อกอิน");
        }
      });

      // ตรวจสอบ redirect result (มาจาก Google Sign-in แบบ redirect)
      firebaseCheckRedirectResult().then(function (redirectOk) {
        if (redirectOk) {
          console.log("[firebase] redirect login สำเร็จ");
          updateSidebarAuthBtn();
          // ไม่รีโหลดทันที — sync กับ backend ก่อนเพื่อสร้าง local account
          const user = getUser();
          if (user && user.provider === "google") {
            syncGoogleWithBackend({ uid: user.userId, displayName: user.username, email: "" })
              .then(function () {
                updateSidebarAuthBtn();
              });
          }
          return;
        }

        // Redirect กลับมาแล้วแต่ไม่มี session — แจ้งผู้ใช้ (เฉพาะเมื่อมี redirect ที่ค้างอยู่จริง)
        // กัน false-positive สองกรณี: (1) getRedirectResult() อาจตอบ null ก่อนที่
        // onAuthStateChanged จะยืนยัน session ใหม่ (ล็อกอินเพิ่งสำเร็จไปแป๊บเดียว), และ
        // (2) ธง vocab_oauth_pending ที่ค้างจากครั้งก่อน (ผู้ใช้กดลองหลายครั้ง)
        let pending = false;
        let pendingAt = -Infinity;
        try {
          const raw = sessionStorage.getItem("vocab_oauth_pending");
          pending = !!raw;
          try {
            const parsed = JSON.parse(raw || "{}");
            if (parsed && typeof parsed.t === "number") { pendingAt = parsed.t; }
          } catch (e2) { pendingAt = -Infinity; }
        } catch (e) { pending = false; }
        if (pending) {
          // flag ที่ parse ไม่ได้ (เช่น "1" จากโค้ดเก่า) หรือไม่มี timestamp → ถือว่าเก่าเสมอ
          const isFresh = pendingAt > 0 && Date.now() - pendingAt < 60000; // ภายใน 60 วิ ถือว่าเพิ่งลองจริง
          if (!isFresh) {
            // ธงค้างจากการลองเก่า — ล้างออกเงียบ ๆ อย่าแจ้งเตือนซ้ำตอนเปิดเว็บปกติ
            try { sessionStorage.removeItem("vocab_oauth_pending"); } catch (e) {}
            return;
          }
          // ลองอีกครั้งหลัง onAuthStateChanged น่าจะยืนยันเสร็จ (กัน race) แล้วค่อยตัดสิน
          setTimeout(function () {
            if (getUser()) return; // ล็อกอินสำเร็จไปแล้ว — ไม่แจ้งเตือน
            try { sessionStorage.removeItem("vocab_oauth_pending"); } catch (e) {}
            console.warn("[firebase] redirect กลับมาแต่ไม่มี session — hostname:", window.location.hostname, "href:", window.location.href);
            if (window.VocabApp && window.VocabApp.toast) {
              try {
                window.VocabApp.toast(t("auth.googleRedirectEmpty"), "err", "alert");
              } catch (err2) {
                console.warn("[firebase] redirect-empty toast failed:", err2);
              }
            }
          }, 1500);
        }
      });
    }

    // Backend mode — verify token and sync data on app startup
    if (!isStaticMode() && !isFirebaseMode()) {
      verifyToken().then(function (valid) {
        if (valid) {
          const user = getUser();
          if (user && user.userId) {
            syncBackendDataToLocal(user.userId);
          }
        }
      });
    }

    const sidebarAuthBtn = document.getElementById("sidebarAuthBtn");
    if (sidebarAuthBtn) {
      sidebarAuthBtn.onclick = function () {
        const user = getUser();
        if (user) {
          showProfileModal();
        } else {
          createAuthModal();
        }
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthUI);
  } else {
    initAuthUI();
  }
})();