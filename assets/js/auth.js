/* ============================================================
   Vocab Trainer — Auth System
   ระบบบัญชีผู้ใช้: สมัคร / เข้าสู่ระบบ / sync ข้อมูลกับ server
   ============================================================ */
(function () {
  "use strict";

  // URL ของ backend API — เปลี่ยนตาม server ที่รัน
  // ถ้ารัน backend ที่พอร์ต 3001 และเว็บที่พอร์ต 8000 ใช้ค่านี้
  // ถ้ารันรวม (backend serve เว็บด้วย) ใช้ "" (ค่าว่าง = same origin)
  const API_BASE = window.location.port === "8000" ? "http://localhost:3001" : "";

  // ภาษาปัจจุบัน (อ่านจาก localStorage โดยตรง เพราะ auth.js โหลดก่อน app.js เสมอ)
  function getCurrentLang() {
    try {
      const s = JSON.parse(localStorage.getItem("vocab_settings_v1") || "{}");
      return s.lang === "en" ? "en" : "th";
    } catch (e) { return "th"; }
  }

  const TOKEN_KEY = "vocab_auth_token";
  const USER_KEY = "vocab_auth_user";

  // --- ตรวจสอบว่าล็อกอินอยู่หรือไม่ ---
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch (e) { return null; }
  }
  function isLoggedIn() { return !!getToken(); }

  // --- สมัครบัญชี ---
  async function register(username, password) {
    const lang = getCurrentLang();
    const res = await fetch(API_BASE + "/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, lang })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "สมัครไม่สำเร็จ");
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, userId: data.userId }));
    return data;
  }

  // --- เข้าสู่ระบบ ---
  async function login(username, password) {
    const lang = getCurrentLang();
    const res = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, lang })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, userId: data.userId }));
    return data;
  }

  // --- ออกจากระบบ ---
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.reload();
  }

  // --- ดึงข้อมูลจาก server ---
  async function fetchData() {
    const token = getToken();
    if (!token) return null;
    const res = await fetch(API_BASE + "/api/data", {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) {
      if (res.status === 401) logout(); // token หมดอายุ
      return null;
    }
    const data = await res.json();
    return data.data;
  }

  // --- บันทึกข้อมูลขึ้น server ---
  let syncTimer = null;
  async function saveData(data) {
    const token = getToken();
    if (!token) return; // ไม่ได้ล็อกอิน = ใช้ localStorage ปกติ

    // debounce: รอ 2 วินาทีก่อนส่ง (กัน spam)
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

  // --- ตรวจสอบ token กับ server ---
  async function verifyToken() {
    const token = getToken();
    if (!token) return false;
    try {
      const res = await fetch(API_BASE + "/api/me", {
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) { logout(); return false; }
      const data = await res.json();
      localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, userId: data.userId }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- สร้าง UI: โมดอล login/register ---
  function createAuthModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay auth-overlay";
    overlay.id = "authModal";
    overlay.innerHTML = `
      <div class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button class="modal-close" id="authClose" title="${esc(t("settings.close"))}"><span class="ico" data-icon="close"></span></button>
        <h2 id="authTitle" class="auth-title">${esc(t("auth.loginTitle"))}</h2>
        <p class="auth-sub" id="authSub">${esc(t("auth.loginSub"))}</p>
        <div class="auth-form">
          <div class="auth-field">
            <label class="auth-label" for="authUser">${esc(t("auth.username"))}</label>
            <input type="text" id="authUser" class="auth-input" placeholder="${esc(t("auth.usernamePlaceholder"))}" autocomplete="username" />
          </div>
          <div class="auth-field">
            <label class="auth-label" for="authPass">${esc(t("auth.password"))}</label>
            <input type="password" id="authPass" class="auth-input" placeholder="${esc(t("auth.passwordPlaceholder"))}" autocomplete="current-password" />
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

    let mode = "login"; // or "register"

    const title = overlay.querySelector("#authTitle");
    const sub = overlay.querySelector("#authSub");
    const submit = overlay.querySelector("#authSubmit");
    const toggleText = overlay.querySelector("#authToggleText");
    const toggle = overlay.querySelector("#authToggle");
    const error = overlay.querySelector("#authError");
    const userInput = overlay.querySelector("#authUser");
    const passInput = overlay.querySelector("#authPass");

    function setMode(m) {
      mode = m;
      if (m === "login") {
        title.textContent = t("auth.loginTitle");
        sub.textContent = t("auth.loginSub");
        submit.textContent = t("auth.loginButton");
        toggleText.innerHTML = esc(t("auth.noAccount")) + ' <a href="#" id="authToggle">' + esc(t("auth.registerLink")) + '</a>';
      } else {
        title.textContent = t("auth.registerTitle");
        sub.textContent = t("auth.registerSub");
        submit.textContent = t("auth.registerButton");
        toggleText.innerHTML = esc(t("auth.hasAccount")) + ' <a href="#" id="authToggle">' + esc(t("auth.loginLink")) + '</a>';
      }
      error.classList.add("hidden");
      // re-bind toggle
      const newToggle = overlay.querySelector("#authToggle");
      if (newToggle) newToggle.onclick = function (e) { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); };
      // re-inject icons in newly created toggle link
      overlay.querySelectorAll("[data-icon]").forEach(function (n) {
        const ICONS = window.VOCAB_ICONS || {};
        n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
      });
    }

    toggle.onclick = function (e) { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); };

    overlay.querySelector("#authClose").onclick = function () { closeAuthModal(); };
    overlay.onclick = function (e) { if (e.target === overlay) closeAuthModal(); };

    async function handleSubmit() {
      const username = userInput.value.trim();
      const password = passInput.value;
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
          await register(username, password);
        } else {
          await login(username, password);
        }
        closeAuthModal();
        // รีโหลดเพื่อ sync ข้อมูลจาก server
        location.reload();
      } catch (e) {
        error.textContent = e.message;
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

  // --- ฟังก์ชันช่วยดึงภาษา (ใช้ VocabApp ร่วม) ---
  function t(key) {
    try {
      if (typeof window.VocabApp !== "undefined" && window.VocabApp && window.VocabApp.t) {
        return window.VocabApp.t(key);
      }
    } catch (e) { /* settings อาจยังไม่พร้อม — คืน key ไปก่อน */ }
    // Fallback ถ้ายังโหลด app.js ไม่ครบ หรือ settings ยังไม่ init
    return key;
  }

  function esc(s) {
    var A = String.fromCharCode(38); // &
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

  // --- อัปเดต sidebar auth button ตามสถานะล็อกอิน ---
  function updateSidebarAuthBtn() {
    const user = getUser();
    const btn = document.getElementById("sidebarAuthBtn");
    if (!btn) return;

    if (user) {
      // ล็อกอินแล้ว — แสดงอักษรย่อ + username
      btn.classList.add("logged-in");
      btn.innerHTML =
        '<span class="auth-avatar">' + user.username.charAt(0).toUpperCase() + "</span> " +
        esc(user.username);
      btn.title = "ดูโปรไฟล์ (" + user.username + ")";
      btn.setAttribute("aria-label", "ดูโปรไฟล์ (" + user.username + ")");
    } else {
      // ยังไม่ล็อกอิน — แสดงปุ่ม login
      btn.classList.remove("logged-in");
      btn.innerHTML =
        '<span class="ico" data-icon="lock"></span> ' + esc(t("auth.loginTitle"));
      btn.title = "เข้าสู่ระบบ / สมัครบัญชี";
      btn.setAttribute("aria-label", "เข้าสู่ระบบ / สมัครบัญชี");
    }
  }

  // --- รอฟังการเปลี่ยนภาษาจาก app.js ---
  function onLanguageChanged() {
    // อัปเดต auth modal หากเปิดอยู่ — ปิดแล้วเปิดใหม่เพื่อ re-render ด้วยภาษาใหม่
    const authOverlay = document.getElementById("authModal");
    if (authOverlay && authOverlay.classList.contains("open")) {
      closeAuthModal();
      createAuthModal();
    }
    // อัปเดต profile modal หากเปิดอยู่
    const profileOverlay = document.getElementById("profileModal");
    if (profileOverlay && profileOverlay.classList.contains("open")) {
      closeProfileModal();
      showProfileModal();
    }
    // อัปเดต sidebar auth button
    updateSidebarAuthBtn();
  }

  // ฟัง custom event จาก setLang() ใน app.js
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      document.addEventListener("vocab-lang-changed", onLanguageChanged);
    });
  } else {
    document.addEventListener("vocab-lang-changed", onLanguageChanged);
  }

  // --- หน้า Profile Modal ---
  function showProfileModal() {
    const user = getUser();
    if (!user) return;

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
            <span class="profile-value">#${user.userId || "-"}</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">${esc(t("auth.status"))}</span>
            <span class="profile-value profile-status">✓ ออนไลน์</span>
          </div>
          <div class="profile-row">
            <span class="profile-label">${esc(t("auth.sync"))}</span>
            <span class="profile-value">${esc(t("auth.syncAuto"))}</span>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-bad" id="profileLogout">${esc(t("auth.logout"))}</button>
          <button class="btn btn-primary" id="profileDone">${esc(t("settings.close"))}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // inject icons
    overlay.querySelectorAll("[data-icon]").forEach(function (n) {
      const ICONS = window.VOCAB_ICONS || {};
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n.dataset.icon] || "") + "</svg>";
    });

    overlay.querySelector("#profileClose").onclick = function () { closeProfileModal(); };
    overlay.querySelector("#profileDone").onclick = function () { closeProfileModal(); };
    overlay.querySelector("#profileLogout").onclick = function () {
      if (confirm(t("auth.logoutConfirm") || "ออกจากระบบ?\nข้อมูลในเครื่องนี้จะยังอยู่ แต่จะไม่ sync กับ server อีก")) {
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
    t: t
  };

  // --- Auto-init UI เมื่อ DOM พร้อม ---
  function initAuthUI() {
    // ห่อด้วย try-catch เผื่อ t() หรือ updateSidebarAuthBtn() มีปัญหา
    // (เช่น settings ยังไม่ init ตอน auth.js โหลด) — ปุ่ม login ต้องทำงานได้เสมอ
    try { updateSidebarAuthBtn(); } catch (e) { console.warn("[auth] updateSidebarAuthBtn:", e); }

    // Wire up sidebar auth button — ต้องแนบไว้เสมอ แม้ updateSidebarAuthBtn จะ fail
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