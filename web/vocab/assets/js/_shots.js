(function () {
  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
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
    var view = param("view") || "home";
    var lang = param("lang") === "en" ? "en" : "th";
    try { if (window.VocabApp.setLang) window.VocabApp.setLang(lang); } catch (e) {}
    window.setTimeout(function () {
      try { window.VocabApp.showView(view); } catch (e) { console.error(e); }
      window.setTimeout(function () {
        var t = document.createElement("div");
        t.id = "shotDone";
        t.style.display = "none";
        document.body.appendChild(t);
      }, 700);
    }, 250);
  });
})();