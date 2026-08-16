/* Seed: mock Firebase BEFORE firebase-config.js runs (sync script at top of body). */
(function () {
  var qs;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = { get: function () { return null; } }; }
  var sc = qs.get("scenario") || "redirect";

  // Guest-session marker → resetGuestDataIfNewSession() จะไม่ล้าง localStorage
  try { sessionStorage.setItem("vocab_guest_session", "1"); } catch (e) {}
  try { localStorage.clear(); } catch (e) {}

  var FAKE_USER = { uid: "g-12345", displayName: "TestGoogle", email: "tg@example.com", providerData: [{ providerId: "google.com" }] };

  window.__mockLog = { getRedirectResult: 0, onAuthStateChanged: 0, observerCb: false };
  window.__toastSeen = "";
  try {
    if (typeof MutationObserver !== "undefined" && document.body) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            if (n && n.nodeType === 1 && n.classList && n.classList.contains("toast")) {
              window.__toastSeen = (window.__toastSeen ? window.__toastSeen + " | " : "") + n.textContent;
            }
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  } catch (e) {}
  function makeAuth() {
    var auth = {
      onAuthStateChanged: function (cb) {
        window.__mockLog.onAuthStateChanged++;
        if (sc === "observer") {
          setTimeout(function () { window.__mockLog.observerCb = true; cb(FAKE_USER); }, 0);
        }
        return function () {};
      },
      getRedirectResult: function () {
        window.__mockLog.getRedirectResult++;
        if (sc === "redirect") return Promise.resolve({ user: FAKE_USER });
        if (sc === "reject") return Promise.reject({ code: "auth/unauthorized-domain", message: "auth/unauthorized-domain" });
        return Promise.resolve(null);
      },
      signInWithRedirect: function () { return Promise.resolve(); },
      signInWithPopup: function () { return Promise.resolve({ user: FAKE_USER }); },
      signInWithEmailAndPassword: function () { return Promise.resolve({ user: FAKE_USER }); },
      createUserWithEmailAndPassword: function () { return Promise.resolve({ user: FAKE_USER }); },
      sendPasswordResetEmail: function () { return Promise.resolve(); },
      sendEmailVerification: function () { return Promise.resolve(); },
      currentUser: null
    };
    return auth;
  }
  function makeDb() {
    return {
      enablePersistence: function () { return Promise.resolve(); },
      collection: function () {
        return {
          doc: function () {
            return {
              get: function () { return Promise.resolve({ exists: false, data: function () { return null; } }); },
              set: function () { return Promise.resolve(); },
              update: function () { return Promise.resolve(); }
            };
          }
        };
      }
    };
  }

  function mockAuth() { return window.__mockAuth; }
  mockAuth.GoogleAuthProvider = function () { this.setCustomParameters = function () {}; };

  window.__mockAuth = makeAuth();
  window.firebase = {
    initializeApp: function () {},
    auth: mockAuth,
    firestore: function () { return makeDb(); },
    GoogleAuthProvider: mockAuth.GoogleAuthProvider
  };
  window.FIREBASE_CONFIGURED = true;
})();