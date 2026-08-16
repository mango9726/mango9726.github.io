/* Test runner — runs after the app's deferred scripts (last defer in _plantest.html). */
(function () {
  var qs;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = { get: function () { return null; } }; }
  var scenario = qs.get("scenario") || "b1";
  var out = document.getElementById("plantest-out");
  var log = [];
  function report(name, ok, detail) {
    log.push((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  }
  function dump() {
    if (!out) return;
    out.textContent = log.join("\n");
    document.title = log.some(function (l) { return l.indexOf("FAIL") === 0; }) ? "PLANTEST_FAIL" : "PLANTEST_PASS";
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
  function taskTitles() {
    return Array.prototype.map.call(document.querySelectorAll("#tasksList .task-card .task-title"), function (el) { return el.textContent; });
  }
  function run() {
    // รอให้ init จบจริง (initCefrSystem ตั้ง window.CURRENT_CEFR_LEVEL)
    return waitFor(function () { return window.VocabApp && window.CURRENT_CEFR_LEVEL && document.getElementById("tasksToday"); }, 20000)
      .then(function () {
        window.VocabApp.showView("tasks");
        return waitFor(function () { return document.getElementById("tasksList") && document.getElementById("tasksList").children.length > 0; }, 10000);
      })
      .then(function () {
        var today = document.getElementById("tasksToday").textContent || "";
        var titles = taskTitles();
        var firstNew = titles[0] || "";

        if (scenario === "b1") {
          report("tasksToday mentions B1", /B1|Intermediate/i.test(today), today);
          report("tasksToday is Day 1", /Day 1\b/.test(today), today);
          report("new-word card is B1 Day 1", /B1 Intermediate \(Day 1\)/.test(firstNew), firstNew);
          report("no review cards yet (fresh plan)", titles.length === 1, JSON.stringify(titles));
        } else if (scenario === "b1-day4") {
          report("tasksToday is Day 4", /Day 4\b/.test(today), today);
          report("new-word card is B1 Day 4", /B1 Intermediate \(Day 4\)/.test(firstNew), firstNew);
          report("has review cards for earlier days", titles.length >= 2 && /^Day 1\b/.test(titles[1]), JSON.stringify(titles));
        } else if (scenario === "change-level") {
          report("initial level is B1 Day 1", /B1|Intermediate/.test(today) && /Day 1\b/.test(today), today);
          // จำลองระดับเปลี่ยนจริง: เขียนผลลง progress ก่อน แล้ว notify (ผู้ใช้ guest ใช้ placement result)
          if (window.setCefrLevel) window.setCefrLevel("C2");
          window.VocabApp.onCefrLevelChange("C2");
          window.VocabApp.showView("tasks");
          return waitFor(function () {
            var t = (document.getElementById("tasksToday") || {}).textContent || "";
            return /C2|Expert/.test(t) && /Day 1\b/.test(t);
          }, 10000).then(function () {
            var t2 = document.getElementById("tasksToday").textContent || "";
            var titles2 = taskTitles();
            report("after level change to C2 -> Day 1", /C2|Expert/.test(t2) && /Day 1\b/.test(t2), t2);
            report("new-word card is C2 Day 1", /C2 Expert \(Day 1\)/.test(titles2[0] || ""), titles2[0] || "");
          });
        } else if (scenario === "a1") {
          report("default level is A1", /A1|Beginner/.test(today), today);
          report("new-word card is A1", /A1 Beginner \(Day /.test(firstNew), firstNew);
        }
      })
      .catch(function (e) { report(scenario + " run", false, String(e && e.message || e)); })
      .then(dump);
  }
  run();
})();