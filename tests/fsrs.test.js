"use strict";
const test = require("node:test");
const assert = require("node:assert");
const VocabSRS = require("../assets/js/vocab-fsrs.js");

test("init_state: new+Good (fsrs grade 3) starts at ~3d interval", () => {
  const s = VocabSRS.init_state(3);
  assert.ok(s.stability > 0);
  const ivl = VocabSRS.interval_for_stability(s.stability);
  assert.ok(ivl >= 2 && ivl <= 5, "expected ~3d, got " + ivl);
});

test("review: good -> good spacing", () => {
  const s = VocabSRS.init_state(3);
  const r1 = VocabSRS.review(s, 0, 4); // Good
  assert.ok(r1.interval >= 1);
  const r2 = VocabSRS.review(r1.state, r1.interval, 4);
  assert.ok(r2.interval > r1.interval, "interval should grow");
});

test("review: Easy gives longer interval than Hard (new card)", () => {
  const easy = VocabSRS.review(null, 0, 5);  // Easy on a brand-new card
  const hard = VocabSRS.review(null, 0, 3);  // Hard on a brand-new card
  assert.ok(easy.interval > hard.interval, "easy=" + easy.interval + " hard=" + hard.interval);
});

test("review: Again resets reps and drops stability", () => {
  const s = VocabSRS.init_state(3);
  let st = VocabSRS.review(s, 10, 4); // established
  assert.ok(st.state.stability > 1);
  const again = VocabSRS.review(st.state, 10, 1);
  assert.ok(again.state.stability < st.state.stability, "stability should drop on Again");
});

test("retention decays over time", () => {
  const s = VocabSRS.init_state(4); // Easy
  const r1 = VocabSRS.retention(0, s);
  const r5 = VocabSRS.retention(5, s);
  const r30 = VocabSRS.retention(30, s);
  assert.ok(r1 >= 0.9);
  assert.ok(r5 <= r1);
  assert.ok(r30 <= r5);
  assert.ok(r30 > 0);
});

test("retention of unknown state is 0", () => {
  assert.strictEqual(VocabSRS.retention(5, { stability: 0 }), 0);
  assert.strictEqual(VocabSRS.retention(5, null), 0);
});

test("appToFsrs maps app grades correctly", () => {
  assert.strictEqual(VocabSRS.appToFsrs(1), 1);
  assert.strictEqual(VocabSRS.appToFsrs(3), 2);
  assert.strictEqual(VocabSRS.appToFsrs(4), 3);
  assert.strictEqual(VocabSRS.appToFsrs(5), 4);
});

test("forgetting_curve matches R(t,S) = (1 + FACTOR*t/S)^decay at t=0 -> 1", () => {
  assert.strictEqual(VocabSRS.forgetting_curve(0, 100), 1);
});

test("interval_for_stability rounds to integer days", () => {
  const ivl = VocabSRS.interval_for_stability(123.456);
  assert.ok(Number.isInteger(ivl));
});