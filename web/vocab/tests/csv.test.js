"use strict";
const test = require("node:test");
const assert = require("node:assert");
const VocabCSV = require("../assets/js/vocab-csv.js");

test("parseCsv: plain rows", () => {
  const rows = VocabCSV.parseCsv("a,b\n1,2");
  assert.deepStrictEqual(rows, [["a", "b"], ["1", "2"]]);
});

test("parseCsv: quoted field with comma and newline", () => {
  const rows = VocabCSV.parseCsv('x,"hello, world"\ny,"multi\nline"');
  assert.deepStrictEqual(rows, [["x", "hello, world"], ["y", "multi\nline"]]);
});

test("parseCsv: escaped double quote", () => {
  const rows = VocabCSV.parseCsv('a,"say ""hi"""');
  assert.deepStrictEqual(rows, [["a", 'say "hi"']]);
});

test("parseCsv: skips blank lines", () => {
  const rows = VocabCSV.parseCsv("a,b\n\n\n1,2");
  assert.deepStrictEqual(rows, [["a", "b"], ["1", "2"]]);
});

test("parseCsv: CRLF line endings", () => {
  const rows = VocabCSV.parseCsv("a,b\r\n1,2\r\n");
  assert.deepStrictEqual(rows, [["a", "b"], ["1", "2"]]);
});

test("csvField: escapes comma, quote, newline", () => {
  assert.strictEqual(VocabCSV.csvField("plain"), "plain");
  assert.strictEqual(VocabCSV.csvField("a,b"), '"a,b"');
  assert.strictEqual(VocabCSV.csvField('say "hi"'), '"say ""hi"""');
  assert.strictEqual(VocabCSV.csvField("a\nb"), '"a\nb"');
});

test("buildCsv: round trip", () => {
  const csv = VocabCSV.buildCsv(["word", "th"], [["alpha", "ตัวแรก"], ["beta", "b,c"]]);
  assert.ok(csv.startsWith("word,th"));
  assert.ok(csv.includes('"b,c"'));
});

test("parseImport: adds valid rows, skips duplicates & empty", () => {
  const csv = "word,th,type,pos,exEn,exTh\n" +
    "alpha,ตัวแรก,vocab,noun,Alpha is first.,อัลฟาคือตัวแรก\n" +
    "alpha,dup,vocab,noun,, \n" +
    ",noth, , , , \n" +
    "beta,ตัวที่สอง,, ,Beta is second.,เบตาคือตัวที่สอง";
  const res = VocabCSV.parseImport(csv, [{ word: "alpha" }]);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.added, 1);
  assert.strictEqual(res.skipped, 3);
  assert.strictEqual(res.toAdd.length, 1);
  assert.strictEqual(res.toAdd[0].word, "beta");
  assert.strictEqual(res.toAdd[0].type, "vocab");
});

test("parseImport: rejects missing header", () => {
  const res = VocabCSV.parseImport("foo,bar\n1,2", []);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "header");
});

test("parseImport: rejects empty input", () => {
  const res = VocabCSV.parseImport("", []);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "empty");
});