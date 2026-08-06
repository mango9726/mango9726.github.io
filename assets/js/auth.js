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
  const API_BASE = isGitHubPages ? "" : (window.location.port === "8000" ? "http://localhost:3001" : "");

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
    await window.firebaseAuth.signInWithRedirect(provider);
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
        setToken("firebase:" + user.uid);
        setUser({ username: user.displayName || user.email || "Google User", userId: user.uid, provider: "google" });
        // Sync กับ backend เพื่อสร้างบัญชี locally ที่ login ด้วย username/password ได้
        syncGoogleWithBackend(user);
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[firebase] redirect result error:", e.message || e.code);
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
        '<p class="google-credential-warning">' + esc(t("auth.googlePasswordWarning")) + '</p>' +
        '<button class="btn btn-primary btn-sm" id="googleCredentialOk">' + esc(t("auth.ok")) + '</button>' +
      '</div>';
    document.body.appendChild(toast);

    document.getElementById("googleCredentialOk").onclick = function () {
      toast.classList.add("hidden");
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    };
  }

  // --- แปลง error code ของ Firebase เป็นข้อความภาษาไทย ---
  function firebaseErrorMessage(err) {
    const code = err && err.code;
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
      "auth/unauthorized-domain": "⚠️ Domain นี้ยังไม่ได้เพิ่มใน Firebase Authorized domains\nไปที่ Firebase Console → Authentication → Settings → Authorized domains → เพิ่ม domain นี้",
      "auth/popup-closed-by-user": "ปิดหน้าต่างล็อกอินก่อนเสร็จ — ลองอีกครั้ง",
      "auth/popup-blocked": "เบราว์เซอร์บล็อก popup — อนุญาต popup แล้วลองอีกครั้ง"
    };
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
        return doc.data().data || {};
      }
      return {};
    } catch (e) {
      console.warn("[firebase] fetchData error:", e.message);
      return null;
    }
  }

  // --- Firebase Firestore: บันทึกข้อมูล ---
  let firebaseSyncTimer = null;
  async function firebaseSaveData(data) {
    const user = getUser();
    if (!user) return;
    // debounce 2 วินาที
    if (firebaseSyncTimer) clearTimeout(firebaseSyncTimer);
    return new Promise(function (resolve) {
      firebaseSyncTimer = setTimeout(async function () {
        try {
          await window.firebaseDb.collection("vocab_data").doc(user.userId).set({
            data: data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            username: user.username
          }, { merge: true });
          resolve(true);
        } catch (e) {
          console.warn("[firebase] saveData error:", e.message);
          resolve(false);
        }
      }, 2000);
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
    if (backendOnline !== null) return backendOnline;
    if (backendCheckPromise) return backendCheckPromise;
    backendCheckPromise = (async function () {
      try {
        const res = await fetch(API_BASE + "/api/me", {
          headers: { "Authorization": "Bearer ping" }
        });
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
    if (_remember) localStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.setItem(TOKEN_KEY, token);
  }
  function setUser(user) {
    const str = JSON.stringify(user);
    if (_remember) localStorage.setItem(USER_KEY, str);
    else sessionStorage.setItem(USER_KEY, str);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }
  function getUser() {
    const str = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    try { return JSON.parse(str || "null"); }
    catch (e) { return null; }
  }
  function isLoggedIn() { return !!getToken(); }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  /* ============================================================
     สมัครบัญชี — Firebase > Backend > Static
     ============================================================ */
  async function register(username, password, remember) {
    _remember = remember !== false;

    // 1. Firebase mode
    if (isFirebaseMode()) {
      return firebaseRegister(username, password);
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
    return { token, username, userId: user.userId };
  }

  /* ============================================================
     Sync backend data → local SecureStore (per-user isolation)
     ============================================================ */
  const SYNC_KEYS = [
    "vocab_progress_v1", "vocab_settings_v1", "vocab_streak_v1",
    "vocab_reviews_v1", "vocab_history_v1", "vocab_learned_v1", "vocab_game_v1"
  ];

  async function syncBackendDataToLocal(userId) {
    if (!userId) return;
    try {
      const data = await fetchData();
      if (!data || Object.keys(data).length === 0) return;
      SYNC_KEYS.forEach(function (key) {
        if (data[key] != null) {
          try { SecureStore.save(key, JSON.parse(data[key])); } catch (e) {}
        }
      });
    } catch (e) {
      console.warn("[auth] syncBackendDataToLocal failed:", e.message);
    }
  }

  /* ============================================================
     ออกจากระบบ
     ============================================================ */
  async function logout() {
    // Firebase logout
    if (isFirebaseMode()) {
      await firebaseLogout();
      clearUserDataFromLocal();
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

    // GitHub mock login (UI only — no backend support)
    const githubBtnEl = overlay.querySelector("#authGithub");
    if (githubBtnEl) {
      githubBtnEl.onclick = async function () {
        githubBtnEl.disabled = true;
        error.classList.add("hidden");
        submit.classList.add("loading");
        try {
          await new Promise(function (resolve) { setTimeout(resolve, 1200); });
          error.textContent = t("auth.socialNotSupported") || "Social login requires Firebase configuration";
          error.classList.remove("hidden");
          error.style.color = "var(--bad)";
        } catch (e) {
          error.textContent = e.message;
          error.classList.remove("hidden");
        }
        submit.classList.remove("loading");
        githubBtnEl.disabled = false;
      };
    }

    // Apple mock login (UI only)
    const appleBtnEl = overlay.querySelector("#authApple");
    if (appleBtnEl) {
      appleBtnEl.onclick = async function () {
        appleBtnEl.disabled = true;
        error.classList.add("hidden");
        submit.classList.add("loading");
        try {
          await new Promise(function (resolve) { setTimeout(resolve, 1200); });
          error.textContent = t("auth.socialNotSupported") || "Social login requires Firebase configuration";
          error.classList.remove("hidden");
          error.style.color = "var(--bad)";
        } catch (e) {
          error.textContent = e.message;
          error.classList.remove("hidden");
        }
        submit.classList.remove("loading");
        appleBtnEl.disabled = false;
      };
    }

    // Forgot password handler
    if (forgotLink) {
      forgotLink.onclick = function (e) {
        e.preventDefault();
        if (mode === "register") return;
        const email = userInput.value.trim();
        if (!email) {
          error.textContent = t("auth.enterEmailFirst") || "Enter your username or email first";
          error.classList.remove("hidden");
          return;
        }
        submit.classList.add("loading");
        submit.querySelector(".btn-text").textContent = t("auth.sending") || "Sending...";
        error.classList.add("hidden");
        // Simulate sending (no backend email service)
        setTimeout(function () {
          submit.classList.remove("loading");
          submit.querySelector(".btn-text").textContent = t("auth.loginButton");
          error.textContent = t("auth.resetSent") || "If that account exists, a reset link has been sent.";
          error.classList.remove("hidden");
          error.style.color = "var(--good)";
          setTimeout(function () { error.classList.add("hidden"); }, 4000);
        }, 1500);
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

  // --- อัปเดต sidebar auth button ---
  function updateSidebarAuthBtn() {
    const user = getUser();
    const btn = document.getElementById("sidebarAuthBtn");
    if (!btn) return;

    if (user) {
      btn.classList.add("logged-in");
      btn.innerHTML =
        '<span class="auth-avatar">' + user.username.charAt(0).toUpperCase() + "</span> " +
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

  // --- Profile Modal — modern card design ---
  function showProfileModal() {
    const user = getUser();
    if (!user) return;

    const firebaseOn = isFirebaseMode();
    const staticMode = isStaticMode();
    let syncLabel;
    if (firebaseOn) syncLabel = t("auth.syncFirebase");
    else if (staticMode) syncLabel = t("auth.syncLocal");
    else syncLabel = t("auth.syncAuto");

    const providerLabel = user.provider === "google" ? "Google" : (user.provider === "email" ? "Email" : "—");

    // Gather stats from app state if available
    const stats = window.VocabApp && window.VocabApp.getStats ? window.VocabApp.getStats() : null;
    const learnedCount = stats ? stats.learned || 0 : 0;
    const streak = stats ? stats.streak || 0 : 0;
    const level = stats ? stats.level || 1 : 1;

    const overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.id = "profileModal";
    overlay.innerHTML = `
      <div class="profile-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
        <div class="profile-hero">
          <div class="profile-avatar">${esc(user.username.charAt(0).toUpperCase())}</div>
          <h2 id="profileTitle" class="profile-name">${esc(user.username)}</h2>
          <p class="profile-sub">${esc(t("auth.member"))}</p>
          <button class="profile-hero-close" id="profileClose" title="${esc(t("settings.close"))}" aria-label="Close"><span class="ico" data-icon="close"></span></button>
        </div>
        <div class="profile-body">
          <div class="profile-stats">
            <div class="profile-stat">
              <div class="profile-stat-num">${level}</div>
              <div class="profile-stat-label">${esc(t("auth.level"))}</div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat-num">${learnedCount}</div>
              <div class="profile-stat-label">${esc(t("auth.wordsLearned"))}</div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat-num">${streak}</div>
              <div class="profile-stat-label">${esc(t("streak.days"))}</div>
            </div>
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
              <span class="profile-value profile-status">✓ ออนไลน์</span>
            </div>
            <div class="profile-row">
              <span class="profile-label"><span class="ico" data-icon="sync"></span> ${esc(t("auth.sync"))}</span>
              <span class="profile-value">${esc(syncLabel)}</span>
            </div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-bad" id="profileLogout">${esc(t("auth.logout"))}</button>
            <button class="btn btn-primary" id="profileDone">${esc(t("settings.close"))}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });

    overlay.querySelector("#profileClose").onclick = function () { closeProfileModal(); };
    overlay.querySelector("#profileDone").onclick = function () { closeProfileModal(); };
    overlay.querySelector("#profileLogout").onclick = function () {
      if (confirm(t("auth.logoutConfirm") || "ออกจากระบบ?")) {
        logout();
      }
    };
    overlay.onclick = function (e) { if (e.target === overlay) closeProfileModal(); };

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeProfileModal() {
    const overlay = document.getElementById("profileModal");
    if (overlay) {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    }
  }

  // --- Expose API ---
  window.VocabAuth = {
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    getUser: getUser,
    register: register,
    login: login,
    logout: logout,
    fetchData: fetchData,
    saveData: saveData,
    verifyToken: verifyToken,
    updateSidebarAuthBtn: updateSidebarAuthBtn,
    createAuthModal: createAuthModal,
    isStaticMode: isStaticMode,
    isFirebaseMode: isFirebaseMode,
    signInWithGoogle: signInWithGoogle,
    firebaseCheckRedirectResult: firebaseCheckRedirectResult,
    t: t
  };

  // --- Auto-init UI ---
  function initAuthUI() {
    try { updateSidebarAuthBtn(); } catch (e) { console.warn("[auth] updateSidebarAuthBtn:", e); }

    // ถ้า Firebase mode — ใช้ onAuthStateChanged เป็นหลัก (เชื่อถือได้กว่า getRedirectResult)
    if (isFirebaseMode()) {
      // ตรวจสอบ redirect result ก่อน (มาจาก Google Sign-in แบบ redirect)
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

        // ใช้ onAuthStateChanged ตรวจสอบสถานะล็อกอิน (ทำงานเสมอ ไม่พลาด)
        window.firebaseAuth.onAuthStateChanged(function (user) {
          if (user) {
            const displayName = user.displayName || user.email || "User";
            setToken("firebase:" + user.uid);
            setUser({ username: displayName, userId: user.uid, provider: "google" });
            console.log("[firebase] onAuthStateChanged: ล็อกอินแล้ว —", displayName);
            // Sync กับ backend เพื่อสร้าง local account
            syncGoogleWithBackend(user);
            updateSidebarAuthBtn();
          } else {
            console.log("[firebase] onAuthStateChanged: ยังไม่ล็อกอิน");
          }
        });
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