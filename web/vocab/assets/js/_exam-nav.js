(function () {
  /* Exam screenshot harness — navigate to a view based on location.hash. */
  var target = (location.hash || "#exam").slice(1);
  function qp(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  var accent = qp("accent");
  window.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      if (accent) {
        try {
          document.documentElement.setAttribute("data-accent", accent);
          var s = JSON.parse(localStorage.getItem("vocab_settings_v1") || "{}");
          s.accent = accent;
          localStorage.setItem("vocab_settings_v1", JSON.stringify(s));
        } catch (e) { /* ignore */ }
      }
      try {
        if (window.VocabApp && window.VocabApp.showView) {
          window.VocabApp.showView(target);
        }
      } catch (e) { /* ignore */ }
    }, 900);
  });
})();