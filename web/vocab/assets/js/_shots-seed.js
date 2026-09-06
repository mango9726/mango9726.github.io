(function () {
  /* Screenshot harness seed — runs BEFORE the app scripts (non-deferred, CSP-safe).
     Uses plaintext localStorage; SecureStore treats it as legacy and re-encrypts. */
  try {
    var today = new Date();
    function addDaysStr(d, n) {
      var x = new Date(d.getTime() + n * 86400000);
      return x.toISOString().slice(0, 10);
    }

    localStorage.setItem("vocab_settings_v1", JSON.stringify({
      lang: "th",
      planStartDate: "2026-08-25",
      reviewGoal: 20
    }));
    localStorage.setItem("vocab_streak_v1", JSON.stringify({ streak: 7, last: addDaysStr(today, -1) }));
    localStorage.setItem("vocab_game_v1", JSON.stringify({
      xp: 5210,
      achievements: {
        "first-step": true, "sharp-10": true, "sharp-100": true, "first-master": true,
        "scholar": true, "bookworm": true, "polyglot": true, "on-fire": true,
        "unstoppable": true, "explorer": true, "all-types": true, "linguist-title": true
      },
      modesUsed: ["cards", "quiz", "match", "fill", "tf", "hang", "build", "cloze", "listen", "pron"],
      typesTouched: ["vocab", "collocation", "idiom"],
      perfectGames: 3,
      dailyAnswered: {},
      modeStats: {}
    }));

    var history = {}, learned = {}, dailyCounts = {};
    for (var i = 1; i <= 100; i++) {
      var dt = addDaysStr(today, -i);
      var wob = ((i * 7) % 5) - 2;                       // weekend-ish ups and downs
      var ans = Math.max(6, 18 + wob * 6 + ((i * 13) % 9));
      if ((i * 3) % 17 === 0) ans = 0;                    // occasional off day
      var acc = 0.68 + ((i * 11) % 20) / 100;             // 68%–88% accuracy
      if (ans === 0) { history[dt] = { answered: 0, correct: 0 }; }
      else { history[dt] = { answered: ans, correct: Math.round(ans * acc) }; }
      learned[dt] = ans === 0 ? 0 : 4 + ((i * 5) % 14);
      dailyCounts[dt] = ans;
    }
    dailyCounts[addDaysStr(today, 0)] = 6;
    var g = localStorage.getItem("vocab_game_v1");
    var gameObj = JSON.parse(g);
    gameObj.dailyAnswered = dailyCounts;
    for (var d7 = 6; d7 >= 0; d7--) {
      var dt7 = addDaysStr(today, -d7);
      gameObj.modeStats[dt7] = {
        cards: { a: 10 + d7 * 2, c: 8 + d7 },
        quiz: { a: 8 + d7, c: 6 + d7 },
        match: { a: 6 + d7, c: 5 + d7 },
        fill: { a: 7 + d7, c: 6 + d7 }
      };
    }
    localStorage.setItem("vocab_game_v1", JSON.stringify(gameObj));
    localStorage.setItem("vocab_history_v1", JSON.stringify(history));
    localStorage.setItem("vocab_learned_v1", JSON.stringify(learned));

    var progress = {};
    for (var day = 121; day <= 160; day++) {
      for (var v = 0; v < 10; v++) {
        var id = String(day) + "-v-" + v;
        var gv = (day * 7 + v * 13) % 9;
        var stPool = [0.8, 1.4, 2.3, 3.8, 5.6, 8.5, 13, 21, 32];
        var st = stPool[gv];
        var reps = [0, 1, 2, 3, 4, 5, 6, 7, 3][(gv + v) % 9];
        var lapses = ((gv + v) % 5 === 0) ? 2 : (((gv + v) % 4 === 0) ? 1 : 0);
        var dueShift = (gv % 5) - 2;                 // -2..+2 → บางคำ overdue/today/beyond
        var lastShift = (gv % 4 === 0) ? 30 : 3 + ((gv + v) % 18);
        progress[id] = {
          st: Math.round(st * 10) / 10,
          d: 1 + gv,
          reps: reps,
          lapses: lapses,
          due: addDaysStr(today, dueShift),
          lastReview: addDaysStr(today, -lastShift),
          seen: 1
        };
      }
    }
    localStorage.setItem("vocab_progress_v1", JSON.stringify(progress));

    var reviews = {};
    for (var rd = 1; rd <= 10; rd++) {
      reviews[rd] = { done: 1 + (rd % 3), nextDue: rd + [2, 4, 7][rd % 3] };
    }
    localStorage.setItem("vocab_reviews_v1", JSON.stringify(reviews));
  } catch (e) {
    /* ignore — screenshots still render with default state */
  }
})();