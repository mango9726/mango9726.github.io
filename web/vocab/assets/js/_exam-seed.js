(function () {
  /* Exam feature screenshot harness seed — runs BEFORE the app scripts.
     Extends _shots-seed.js: placement result + exam results + post-test
     + seen progress using the per-level REMAPPED id scheme ("1-v-0"..). */
  try {
    var today = new Date();
    function addDaysStr(d, n) {
      var x = new Date(d.getTime() + n * 86400000);
      return x.toISOString().slice(0, 10);
    }

    var p = {};
    try { p = JSON.parse(localStorage.getItem("vocab_progress_v1") || "{}"); } catch (e) {}

    for (var day = 1; day <= 80; day++) {
      for (var v = 0; v < 10; v++) {
        var id = day + "-vocab-" + v;
        if (p[id]) continue;
        var dueShift = ((day + v) % 5) - 2;
        p[id] = {
          st: 2 + ((day + v) % 7),
          d: 1 + ((day + v) % 6),
          reps: 1 + ((day + v) % 5),
          lapses: (day + v) % 6 === 0 ? 2 : 0,
          due: addDaysStr(today, dueShift),
          lastReview: addDaysStr(today, -3),
          seen: 1
        };
      }
    }
    p.cefrLevel = "B1";
    p.cefrAbility = -0.42;
    p.cefrSE = 0.48;
    p.cefrProgressToNext = 0.35;
    p.cefrTotalCorrect = 18;
    p.cefrTotalQuestions = 24;
    localStorage.setItem("vocab_progress_v1", JSON.stringify(p));

    localStorage.setItem("vocab_exam_results_v1", JSON.stringify([
      { date: "2026-09-04", ts: 1725200000000, level: "B1", minutes: 10, correct: 14, total: 20, score10: 7, pct: 70, elapsed: 452, timedOut: false },
      { date: "2026-09-01", ts: 1724940000000, level: "B1", minutes: 10, correct: 11, total: 20, score10: 6, pct: 55, elapsed: 503, timedOut: false },
      { date: "2026-08-28", ts: 1724710000000, level: "B2", minutes: 10, correct: 9, total: 20, score10: 5, pct: 45, elapsed: 548, timedOut: true }
    ]));

    localStorage.setItem("vocab_posttest_v1", JSON.stringify([
      { date: "2026-09-06", ts: 1725580000000, level: "B2", ability: 0.18, se: 0.44, progressToNext: 0.5, totalCorrect: 21, totalQuestions: 27, timeSec: 284 }
    ]));
  } catch (e) {
    /* ignore */
  }
})();