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
    var vh = window.innerHeight;
    var sw = document.documentElement.scrollWidth;
    var results = {
      width: vw,
      height: vh,
      scrollWidth: sw,
      overflow: sw - vw,
      overflowers: [],
      textOverflow: [],
      leftOverflow: [],
      wide: [],
      fixedOverflow: []
    };
    var all = document.querySelectorAll("body *");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      var sel = el.id ? "#" + el.id : (el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : el.tagName.toLowerCase());
      var push = function (arr, px) {
        if (arr[sel] === undefined || px > arr[sel]) arr[sel] = Math.round(px);
      };
      if (st.position === "fixed" || st.position === "sticky") {
        var fo = r.right - vw;
        if (fo > 2) push(results.fixedOverflow, fo);
        continue;
      }
      var overflowX = r.right - vw;
      if (overflowX > 1) push(results.overflowers, overflowX);
      if (r.left < -1) push(results.leftOverflow, -r.left);
      if (r.width > vw + 1) push(results.wide, r.width - vw);
      var isScrollable = st.overflowX === "auto" || st.overflowX === "scroll" || st.overflowX === "hidden";
      if (!isScrollable && el.scrollWidth > el.clientWidth + 3) {
        var sel2 = el.id ? "#" + el.id : (el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : el.tagName.toLowerCase());
        push(results.textOverflow, el.scrollWidth - el.clientWidth);
      }
    }
    var sortArr = function (obj) {
      var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
      var out = [];
      for (var j = 0; j < keys.length; j++) out.push(keys[j] + ":" + obj[keys[j]] + "px");
      return out;
    };
    results.overflowers = sortArr(results.overflowers);
    results.textOverflow = sortArr(results.textOverflow);
    results.leftOverflow = sortArr(results.leftOverflow);
    results.wide = sortArr(results.wide);
    results.fixedOverflow = sortArr(results.fixedOverflow);
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
      }, 150);
    }
    next();
  });
})();