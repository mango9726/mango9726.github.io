"use strict";
const test = require("node:test");
const assert = require("node:assert");

global.window = global;
require("../assets/js/vocab-i18n.js");

const STRINGS = global.window.VOCAB_STRINGS;

test("i18n: TH and EN tables exist", () => {
  assert.ok(STRINGS.th && typeof STRINGS.th === "object");
  assert.ok(STRINGS.en && typeof STRINGS.en === "object");
});

test("i18n: every TH key exists in EN (key parity)", () => {
  const th = STRINGS.th, en = STRINGS.en;
  const missing = Object.keys(th).filter(function (k) { return !(k in en); });
  assert.deepStrictEqual(missing, [], "TH keys missing in EN: " + missing.join(", "));
});

test("i18n: every EN key exists in TH (key parity)", () => {
  const th = STRINGS.th, en = STRINGS.en;
  const missing = Object.keys(en).filter(function (k) { return !(k in th); });
  assert.deepStrictEqual(missing, [], "EN keys missing in TH: " + missing.join(", "));
});

test("i18n: mode keys for all game modes present in TH", () => {
  const th = STRINGS.th;
  ["cards", "quiz", "boss", "pron", "fill", "match", "tf", "hang", "build", "cloze", "listen"].forEach(function (m) {
    assert.ok(th["mode." + m], "missing TH mode." + m);
  });
});

test("i18n: new CSV/pron keys exist in both languages", () => {
  ["cw.importCsv", "cw.csvFormat", "cw.importOk", "cw.importErr", "stats.modeAcc", "stats.days"].forEach(function (k) {
    assert.ok(STRINGS.th[k], "missing TH " + k);
    assert.ok(STRINGS.en[k], "missing EN " + k);
  });
});