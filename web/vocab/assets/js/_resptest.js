(function () {
  function ready(cb) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.VocabApp && window.VocabApp.showView) {
        clearInterval(iv);
        cb();
      } else if (tries > 200) {
        clearInterval(iv);
        cb();
      }
    }, 50);
  }

  function collect() {
    var vw = window.innerWidth;
    var sw = document.documentElement.scrollWidth;
    var results = {
      width: vw,
      scrollWidth: sw,
      overflow: sw - vw,
      overflowers: []
    };
    var bad = {};
    var all = document.querySelectorAll("body *");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var st = window.getComputedStyle(el);
      if (st.position === "fixed" || st.position === "sticky") continue;
      if (st.display === "none" || st.visibility === "hidden") continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      var overflowX = r.right - vw;
      if (overflowX > 1) {
        var sel = el.id ? "#" + el.id : (el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : el.tagName.toLowerCase());
        if (bad[sel] === undefined || overflowX > bad[sel]) bad[sel] = Math.round(overflowX);
      }
    }
    var keys = Object.keys(bad).sort(function (a, b) { return bad[b] - bad[a]; });
    for (var j = 0; j < keys.length; j++) {
      results.overflowers.push(keys[j] + ":" + bad[keys[j]] + "px");
    }
    return results;
  }

  ready(function () {
    var views = ["home", "tasks", "browse", "achievements", "stats", "stories", "cards", "quiz", "pron", "fill", "match", "tf", "hang", "build", "cloze", "listen", "dictation", "settings"];
    var out = [];
    try { window.hasTakenPlacementTest = function () { return true; }; } catch (e) {}
    try {
      var s = window.SecureStore ? window.SecureStore.load("vocab_settings_v1", {}) : {};
      s.selectedCefrLevel = s.selectedCefrLevel || "B1";
      if (window.SecureStore) window.SecureStore.save("vocab_settings_v1", s);
    } catch (e) {}
    var step = 0;
    function next() {
      if (step >= views.length) {
        var pre = document.createElement("pre");
        pre.id = "respResults";
        pre.textContent = JSON.stringify(out);
        document.body.appendChild(pre);
        return;
      }
      var name = views[step++];
      try { window.VocabApp.showView(name); } catch (e) { out.push({ view: name, error: String(e) }); }
      setTimeout(function () {
        var r = collect();
        r.view = name;
        out.push(r);
        next();
      }, 120);
    }
    next();
  });
})();