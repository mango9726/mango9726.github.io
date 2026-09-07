(function () {
  /* Theme-verification harness — dumps computed CSS variable values + sample
     element styles for the active accent/view so results can be checked
     without a human looking at screenshots. Dev-only. */
  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function cssvar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function elval(sel, prop) {
    var el = document.querySelector(sel);
    if (!el) return "MISSING";
    return getComputedStyle(el).getPropertyValue(prop).trim();
  }
  function ready(cb) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.VocabApp && window.VocabApp.showView) { clearInterval(iv); cb(); }
      else if (tries > 400) { clearInterval(iv); cb(); }
    }, 50);
  }
  ready(function () {
    var view = param("view");
    var hash = (location.hash || "").replace(/^#/, "");
    if (!view) view = hash || "home";
    var accent = param("accent");
    if (accent) {
      document.documentElement.setAttribute("data-accent", accent);
      try {
        var s = JSON.parse(localStorage.getItem("vocab_settings_v1") || "{}");
        s.accent = accent;
        localStorage.setItem("vocab_settings_v1", JSON.stringify(s));
      } catch (e) {}
      try {
        var live = window.VocabApp.getSettingsState ? window.VocabApp.getSettingsState() : null;
        if (live) live.accent = accent;
      } catch (e) {}
    }
    var theme = param("theme");
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
      try {
        var live2 = window.VocabApp.getSettingsState ? window.VocabApp.getSettingsState() : null;
        if (live2) live2.theme = theme;
      } catch (e) {}
    }
    try { if (window.VocabApp.setLang) window.VocabApp.setLang("th"); } catch (e) {}
    window.setTimeout(function () {
      try { window.VocabApp.showView(view); } catch (e) { console.error(e); }
      /* re-assert accent/theme after view render (renderers may call applyAccent/applyTheme) */
      window.setTimeout(function () {
        if (accent) document.documentElement.setAttribute("data-accent", accent);
        if (theme) document.documentElement.setAttribute("data-theme", theme);
        window.setTimeout(function () {
        var out = {
          accent: document.documentElement.getAttribute("data-accent") || "(none=aurora)",
          view: view,
          primary: cssvar("--primary"),
          accentC: cssvar("--accent"),
          grad: cssvar("--grad"),
          grad2: cssvar("--grad2"),
          bgGrad: cssvar("--bg-grad"),
          glowA: cssvar("--glow-a"),
          glowB: cssvar("--glow-b"),
          glowC: cssvar("--glow-c")
        };
        out.btnAccentBg = elval(".btn-accent", "background-image");
        out.statAccentNumBg = elval(".stat-card.accent .stat-num", "background-image");
        out.progressFillBg = elval(".progress-fill", "background-image");
        out.examGradeBBg = elval(".exam-grade.grade-b", "background-color");
        out.examGradeBColor = elval(".exam-grade.grade-b", "color");
        out.examGradeCBg = elval(".exam-grade.grade-c", "background-color");
        out.examGradeCColor = elval(".exam-grade.grade-c", "color");
        out.assessGradeBBg = elval(".assess-grade.grade-b", "background-color");
        out.assessGradeCBg = elval(".assess-grade.grade-c", "background-color");
        out.adminHeroBg = elval(".admin-hero", "background-image");
        var pre = document.createElement("pre");
        pre.id = "verifyDump";
        pre.textContent = JSON.stringify(out, null, 1);
        document.body.appendChild(pre);
      }, 1000);
      });
    }, 250);
  });
})();