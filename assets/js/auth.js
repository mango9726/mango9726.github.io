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

  // --- Google Sign-in (popup + fallback redirect) ---
  async function signInWithGoogle() {
    if (!isFirebaseMode()) throw new Error("Firebase not configured");
    const provider = window.googleProvider || new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    // ฟังก์ชันบันทึก user หลังล็อกอินสำเร็จ
    function handleAuthResult(user) {
      setToken("firebase:" + user.uid);
      setUser({ username: user.displayName || user.email || "Google User", userId: user.uid, provider: "google" });
      return { token: "firebase:" + user.uid, username: user.displayName || user.email, userId: user.uid };
    }

    try {
      // 1. ลอง popup ก่อน
      const result = await window.firebaseAuth.signInWithPopup(provider);
      return handleAuthResult(result.user);
    } catch (err) {
      const code = err && err.code;

      // popup ถูกปิดโดยผู้ใช้ — ไม่ใช่ error ร้ายแรง
      if (code === "auth/popup-closed-by-user") {
        // ลองใช้ redirect แทน (เปิดหน้า Google แทน popup)
        console.log("[firebase] popup ปิดโดยผู้ใช้ — ลอง redirect แทน");
        await window.firebaseAuth.signInWithRedirect(provider);
        // หลัง redirect กลับมา จะได้ผลลัพธ์ในหน้าใหม่
        return { redirecting: true };
      }

      // popup โดนบล็อก (browser popup blocker) — ใช้ redirect แทน
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        console.log("[firebase] popup ถูกบล็อก — ใช้ redirect แทน");
        await window.firebaseAuth.signInWithRedirect(provider);
        return { redirecting: true };
      }

      // domain ยังไม่ถูกรับรอง
      if (code === "auth/unauthorized-domain") {
        throw new Error("⚠️ Domain นี้ยังไม่ได้เพิ่มใน Firebase Authorized domains\nไปที่ Firebase Console → Authentication → Settings → Authorized domains → เพิ่ม domain นี้");
      }

      // error อื่น ๆ
      throw err;
    }
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
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[firebase] redirect result error:", e.message || e.code);
      return false;
    }
  }

  // --- Firebase email/password register ---
  async function firebaseRegister(username, password) {
    // ใช้ username เป็น email ถ้าไม่มี @ ให้เติม @vocab.app
    const email = username.indexOf("@") !== -1 ? username : username + "@vocab.app";
    const cred = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
    // อัปเดต display name
    await cred.user.updateProfile({ displayName: username });
    setToken("firebase:" + cred.user.uid);
    setUser({ username: username, userId: cred.user.uid, provider: "email" });
    return { token: "firebase:" + cred.user.uid, username: username, userId: cred.user.uid };
  }

  // --- Firebase email/password login ---
  async function firebaseLogin(username, password) {
    const email = username.indexOf("@") !== -1 ? username : username + "@vocab.app";
    const cred = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
    const displayName = cred.user.displayName || username;
    setToken("firebase:" + cred.user.uid);
    setUser({ username: displayName, userId: cred.user.uid, provider: "email" });
    return { token: "firebase:" + cred.user.uid, username: displayName, userId: cred.user.uid };
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
     ออกจากระบบ
     ============================================================ */
  async function logout() {
    // Firebase logout
    if (isFirebaseMode()) {
      await firebaseLogout();
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
    clearAuth();
    location.reload();
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
     UI: โมดอล login/register
     ============================================================ */
  function createAuthModal() {
    const firebaseOn = isFirebaseMode();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay auth-overlay";
    overlay.id = "authModal";

    // Google Sign-in button (เฉพาะ Firebase mode)
    const googleBtn = firebaseOn ? `
      <button class="btn btn-google" id="authGoogle">
        <svg class="google-logo" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
        <span>${esc(t("auth.googleButton"))}</span>
      </button>
      <div class="auth-divider"><span>${esc(t("auth.orDivider"))}</span></div>
    ` : "";

    overlay.innerHTML = `
      <div class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button class="modal-close" id="authClose" title="${esc(t("settings.close"))}"><span class="ico" data-icon="close"></span></button>
        <h2 id="authTitle" class="auth-title">${esc(t("auth.loginTitle"))}</h2>
        <p class="auth-sub" id="authSub">${esc(getAuthSubText("login"))}</p>
        <div class="auth-form">
          ${googleBtn}
          <div class="auth-field">
            <label class="auth-label" for="authUser">${esc(t("auth.username"))}</label>
            <input type="text" id="authUser" class="auth-input" placeholder="${esc(t("auth.usernamePlaceholder"))}" autocomplete="username" />
          </div>
          <div class="auth-field">
            <label class="auth-label" for="authPass">${esc(t("auth.password"))}</label>
            <input type="password" id="authPass" class="auth-input" placeholder="${esc(t("auth.passwordPlaceholder"))}" autocomplete="current-password" />
          </div>
          <div class="auth-field auth-remember-field">
            <label class="auth-remember">
              <input type="checkbox" id="authRemember" checked />
              <span>${esc(t("auth.remember"))}</span>
            </label>
          </div>
          <p class="auth-error hidden" id="authError"></p>
          <button class="btn btn-primary auth-submit" id="authSubmit">${esc(t("auth.loginButton"))}</button>
          <p class="auth-toggle-text" id="authToggleText">
            ${esc(t("auth.noAccount"))} <a href="#" id="authToggle">${esc(t("auth.registerLink"))}</a>
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // inject icons
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });

    let mode = "login";
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
        submit.textContent = t("auth.loginButton");
        toggleText.innerHTML = esc(t("auth.noAccount")) + ' <a href="#" id="authToggle">' + esc(t("auth.registerLink")) + '</a>';
      } else {
        title.textContent = t("auth.registerTitle");
        sub.textContent = getAuthSubText("register");
        submit.textContent = t("auth.registerButton");
        toggleText.innerHTML = esc(t("auth.hasAccount")) + ' <a href="#" id="authToggle">' + esc(t("auth.loginLink")) + '</a>';
      }
      error.classList.add("hidden");
      const newToggle = overlay.querySelector("#authToggle");
      if (newToggle) newToggle.onclick = function (e) { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); };
      overlay.querySelectorAll("[data-icon]").forEach(function (n) {
        const ICONS = window.VOCAB_ICONS || {};
        n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
      });
    }

    toggle.onclick = function (e) { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); };
    overlay.querySelector("#authClose").onclick = function () { closeAuthModal(); };
    overlay.onclick = function (e) { if (e.target === overlay) closeAuthModal(); };

    // Google Sign-in handler
    if (googleBtnEl) {
      googleBtnEl.onclick = async function () {
        googleBtnEl.disabled = true;
        error.classList.add("hidden");
        try {
          const result = await signInWithGoogle();
          if (result && result.redirecting) {
            // กำลัง redirect ไปหน้า Google — ไม่ต้องทำอะไร
            // หลัง redirect กลับมา firebaseCheckRedirectResult จะทำงาน
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

    async function handleSubmit() {
      const username = userInput.value.trim();
      const password = passInput.value;
      const remember = rememberInput ? rememberInput.checked : true;
      if (!username || !password) {
        error.textContent = t("auth.fillBoth");
        error.classList.remove("hidden");
        return;
      }
      submit.disabled = true;
      submit.textContent = t("auth.processing");
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
        submit.disabled = false;
        submit.textContent = mode === "register" ? t("auth.registerButton") : t("auth.loginButton");
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

  // --- Profile Modal ---
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

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay auth-overlay";
    overlay.id = "profileModal";
    overlay.innerHTML = `
      <div class="modal auth-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
        <button class="modal-close" id="profileClose" title="${esc(t("settings.close"))}"><span class="ico" data-icon="close"></span></button>
        <div class="profile-hero">
          <div class="profile-avatar">${esc(user.username.charAt(0).toUpperCase())}</div>
          <h2 id="profileTitle" class="profile-name">${esc(user.username)}</h2>
          <p class="profile-sub">${esc(t("auth.member"))}</p>
        </div>
        <div class="profile-info">
          <div class="profile-row">
            <span class="profile-label">${esc(t("auth.username"))}</span>
            <span class="profile-value">${esc(user.username)}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">${esc(t("auth.userId"))}</span>
            <span class="profile-value">#${(user.userId || "-").substring(0, 12)}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">${esc(t("auth.provider"))}</span>
            <span class="profile-value">${esc(providerLabel)}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">${esc(t("auth.status"))}</span>
            <span class="profile-value profile-status">✓ ออนไลน์</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">${esc(t("auth.sync"))}</span>
            <span class="profile-value">${esc(syncLabel)}</span>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-bad" id="profileLogout">${esc(t("auth.logout"))}</button>
          <button class="btn btn-primary" id="profileDone">${esc(t("settings.close"))}</button>
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

    // ถ้า Firebase mode ตรวจสอบผลลัพธ์จาก redirect ก่อน
    (async function () {
      if (isFirebaseMode()) {
        // ตรวจสอบ redirect result (มาจาก Google Sign-in แบบ redirect)
        const redirectOk = await firebaseCheckRedirectResult();
        if (redirectOk) {
          updateSidebarAuthBtn();
          // รีโหลดเพื่อ sync ข้อมูล
          location.reload();
          return;
        }

        // ตรวจสอบ onAuthStateChanged (ล็อกอินปกติ)
        if (isLoggedIn()) {
          firebaseVerifyToken().then(function (ok) {
            if (ok) updateSidebarAuthBtn();
          });
        }
      }
    })();

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