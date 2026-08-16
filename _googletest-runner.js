/* Runner: verify the sidebar shows the Google profile after the login flow. */
(function () {
  document.title = "RUNNER_ALIVE";
  var qs;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = { get: function () { return null; } }; }
  var scenario = qs.get("scenario") || "redirect";
  var out = document.getElementById("googletest-out");
  var log = [];
  var pageErrors = [];
  window.onerror = function (msg, src, ln) { pageErrors.push(String(msg) + " @" + (src || "") + ":" + ln); return false; };

  function report(name, ok, detail) {
    log.push((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  }
  function dump() {
    if (!out) return;
    var body = log.join("\n");
    if (pageErrors.length) body += "\n\nPAGE_ERRORS:\n" + pageErrors.join("\n");
    out.textContent = body;
    document.title = log.some(function (l) { return l.indexOf("FAIL") === 0; }) ? "GOOGLETEST_FAIL" : "GOOGLETEST_PASS";
  }
  function waitFor(cond, ms) {
    return new Promise(function (res, rej) {
      var t0 = Date.now();
      (function poll() {
        var ok = false;
        try { ok = cond(); } catch (e) {}
        if (ok) return res(true);
        if (Date.now() - t0 > ms) return rej(new Error("timeout"));
        setTimeout(poll, 50);
      })();
    });
  }

  function safeUser() {
    try { return window.VocabAuth && window.VocabAuth.getUser ? window.VocabAuth.getUser() : null; } catch (e) { return "THROW:" + e.message; }
  }
  function safeToken() {
    try { return window.VocabAuth && window.VocabAuth.getToken ? window.VocabAuth.getToken() : null; } catch (e) { return "THROW:" + e.message; }
  }

  function toastTexts() {
    var wrap = document.getElementById("toastWrap");
    if (!wrap) return [];
    return [].map.call(wrap.querySelectorAll(".toast"), function (t) { return t.textContent; });
  }

  function run() {
    var b0 = document.getElementById("sidebarAuthBtn");
    var u0 = safeUser();
    var tok0 = safeToken();
    report("S0(sync)", true, "FIREBASE_CONFIGURED=" + window.FIREBASE_CONFIGURED +
      " | firebaseAuth=" + (window.firebaseAuth ? "yes" : "no") +
      " | firebaseDb=" + (window.firebaseDb ? "yes" : "no") +
      " | user=" + JSON.stringify(u0) +
      " | token=" + (tok0 ? "set" : "null") +
      " | btn=" + (b0 ? JSON.stringify(b0.textContent.trim()) : "missing") +
      " | btnClass=" + (b0 ? b0.className : "n/a"));

    var chain;
    if (scenario === "reject") {
      chain = Promise.resolve().then(function () {
        report("reject shows error toast", /unauthorized|Domain|โดเมน/i.test(window.__toastSeen), JSON.stringify(window.__toastSeen) + " | VocabApp=" + (window.VocabApp ? "yes" : "no"));
      });
    } else {
      chain = Promise.resolve();
    }

    chain
      .then(function () { dump(); })
      .then(function () { return waitFor(function () {
        var b = document.getElementById("sidebarAuthBtn");
        return b && b.classList.contains("logged-in") && /TestGoogle/.test(b.textContent);
      }, 8000); })
      .then(function () {
        var b = document.getElementById("sidebarAuthBtn");
        report("sidebar shows Google profile", /TestGoogle/.test(b.textContent), b.textContent.trim());
        report("button has logged-in class", b.classList.contains("logged-in"), b.className);
        var u = safeUser();
        report("user provider is google", u && u.provider === "google", JSON.stringify(u));
        b.click();
        return waitFor(function () {
          var m = document.getElementById("profileModal");
          return m && /TestGoogle/.test(m.textContent || "");
        }, 4000);
      })
      .then(function () {
        var m = document.getElementById("profileModal");
        report("profile modal opens with Google name", !!m && /TestGoogle/.test(m.textContent), m ? "modal found" : "no modal");
        report("profile modal has logout button", !!m && !!m.querySelector("#profileLogout"), "logout " + (m && m.querySelector("#profileLogout") ? "found" : "missing"));
      })
      .catch(function (e) { report(scenario + " run", false, String(e && e.message || e)); })
      .then(dump);
  }
  run();
})();