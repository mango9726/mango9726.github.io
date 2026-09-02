/* ============================================================
   vocab-fsrs.js — FSRS-5 spaced-repetition scheduler (pure JS).
   Port of the official ts-fsrs FSRS-5 algorithm (MIT, open-spaced-repetition).
   No DOM, no storage — pure functions so it can be unit-tested and reused.
   Exposes window.VocabSRS (and module.exports in Node).

   Memory state = { stability (S), difficulty (D), reps, lapses }.
   Grades map from the app's 5-point scale to FSRS 1..4:
     app {again:1, hard:3, good:4, easy:5}  ->  fsrs {Again:1, Hard:2, Good:3, Easy:4}
   ============================================================ */
(function (root) {
  "use strict";

  /* --- FSRS-5 default parameters (from awesome-fsrs wiki / ts-fsrs) --- */
  var W = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
    2.9898, 0.51655, 0.6621
  ];
  var DECAY = 0.5; // FSRS5_DEFAULT_DECAY
  var S_MIN = 0.001, S_MAX = 36500.0;
  var REQUEST_RETENTION = 0.9;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function roundTo(v, p) { var m = Math.pow(10, p); return Math.round(v * m) / m; }

  /* factor such that R(0) < 1 and interval(stability) = stability at R=0.9 */
  var FACTOR = Math.exp(Math.log(0.9) / DECAY) - 1; // e^(ln0.9/decay) - 1
  var INTERVAL_MODIFIER = (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1) / FACTOR;

  /* --- Core helpers (mirror ts-fsrs) --- */
  function init_stability(g) { return Math.max(W[g - 1], 0.1); }

  function init_difficulty(g) {
    return roundTo(W[4] - Math.exp((g - 1) * W[5]) + 1, 8);
  }

  function linear_damping(delta_d, old_d) {
    return roundTo((delta_d * (10 - old_d)) / 9, 8);
  }

  function mean_reversion(init, current) {
    return roundTo(W[7] * init + (1 - W[7]) * current, 8);
  }

  function next_difficulty(d, g) {
    var delta_d = -W[6] * (g - 3);
    var next_d = d + linear_damping(delta_d, d);
    return clamp(mean_reversion(init_difficulty(4), next_d), 1, 10);
  }

  function next_recall_stability(d, s, r, g) {
    var hard_penalty = (g === 2) ? W[15] : 1;
    var easy_bound = (g === 4) ? W[16] : 1;
    return clamp(
      s * (1 +
        Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) *
        (Math.exp((1 - r) * W[10]) - 1) * hard_penalty * easy_bound),
      S_MIN, S_MAX
    );
  }

  function next_forget_stability(d, s, r) {
    return clamp(
      W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) *
      Math.exp((1 - r) * W[14]),
      S_MIN, S_MAX
    );
  }

  /* R(t,S) — probability of recall after t days. */
  function forgetting_curve(t, s) {
    if (s <= 0) return 0;
    return Math.pow(1 + (FACTOR * t) / s, DECAY);
  }

  /* Interval in days for a given stability at the requested retention. */
  function interval_for_stability(s) {
    return Math.max(1, Math.round(s * INTERVAL_MODIFIER));
  }

  /* --- Public API --- */

  /* Next memory state given current state (null for a new card), elapsed
     days t since last review, and FSRS grade g (1=Again..4=Easy). */
  function next_state(state, t, g) {
    var d = (state && state.difficulty) || 0;
    var s = (state && state.stability) || 0;
    g = clamp(g | 0, 1, 4);
    t = Math.max(0, t | 0);
    if (!state || (d === 0 && s === 0)) {
      return { difficulty: clamp(init_difficulty(g), 1, 10), stability: init_stability(g) };
    }
    if (d < 1 || s < S_MIN) {
      return { difficulty: clamp(init_difficulty(g), 1, 10), stability: init_stability(g) };
    }
    var r = forgetting_curve(t, s);
    var new_s;
    if (g === 1) { // Again -> forget
      var s_after_fail = next_forget_stability(d, s, r);
      new_s = clamp(s_after_fail, S_MIN, s); // no short-term steps in this app
    } else {
      new_s = next_recall_stability(d, s, r, g);
    }
    return { difficulty: roundTo(next_difficulty(d, g), 8), stability: roundTo(new_s, 8) };
  }

  /* Stability for a fresh card graded g. */
  function init_state(g) {
    g = clamp(g | 0, 1, 4);
    return { difficulty: clamp(init_difficulty(g), 1, 10), stability: init_stability(g) };
  }

  /* Convenience: full review. Takes app q (1/3/4/5) + current memory state
     + elapsed days. Returns { state, interval, retention }. */
  function review(memory, t, appQ) {
    var g = appQ === 1 ? 1 : appQ === 3 ? 2 : appQ === 4 ? 3 : 4;
    var ns = next_state(memory, t, g);
    var ivl = interval_for_stability(ns.stability);
    var ret = roundTo(forgetting_curve(0, ns.stability), 4);
    return { state: ns, interval: ivl, retention: ret, grade: g };
  }

  /* Predicted retention 0..1 for a stored memory state after t days. */
  function retention(t, memory) {
    var s = (memory && memory.stability) || 0;
    if (s <= 0) return 0;
    return clamp(forgetting_curve(Math.max(0, t | 0), s), 0, 1);
  }

  /* Map app q (1/3/4/5) to FSRS grade (1..4). */
  function appToFsrs(q) { return q === 1 ? 1 : q === 3 ? 2 : q === 4 ? 3 : 4; }

  var VocabSRS = {
    W: W,
    DECAY: DECAY,
    REQUEST_RETENTION: REQUEST_RETENTION,
    next_state: next_state,
    init_state: init_state,
    review: review,
    retention: retention,
    forgetting_curve: forgetting_curve,
    interval_for_stability: interval_for_stability,
    appToFsrs: appToFsrs,
    clamp: clamp
  };

  root.VocabSRS = VocabSRS;
  if (typeof module !== "undefined" && module.exports) module.exports = VocabSRS;
})(typeof window !== "undefined" ? window : globalThis);