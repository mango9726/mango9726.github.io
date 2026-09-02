/* Extract the ICONS + STRINGS data blocks from app.js into vocab-i18n.js.
   Run from web/vocab:  node tools/extract-i18n.js
   - Removes the literal blocks from app.js and replaces them with window refs.
   - Writes assets/js/vocab-i18n.js exposing window.VOCAB_ICONS / window.VOCAB_STRINGS.
 */
const fs = require("fs");
const path = require("path");

const appFile = path.join(__dirname, "..", "assets", "js", "app.js");
const i18nFile = path.join(__dirname, "..", "assets", "js", "vocab-i18n.js");

const src = fs.readFileSync(appFile, "utf-8");
const lines = src.split("\n");

function blockRange(startNeedle) {
  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(startNeedle) !== -1) { start = i; break; }
  }
  if (start === -1) throw new Error("start needle not found: " + startNeedle);
  for (let i = start + 1; i < lines.length; i++) {
    // Closing line: exactly "  };" (indented 2) — end of the const literal.
    if (lines[i].trim() === "};") { end = i; break; }
  }
  if (end === -1) throw new Error("closing brace not found for: " + startNeedle);
  return { start, end };
}

const icons = blockRange("  const ICONS = {");
const strings = blockRange("  const STRINGS = {");

// Sanity: STRINGS must contain both th and en tables; ICONS a known key.
const iconsBlock = lines.slice(icons.start, icons.end + 1).join("\n");
const stringsBlock = lines.slice(strings.start, strings.end + 1).join("\n");
if (iconsBlock.indexOf("gitBranch:") === -1) throw new Error("ICONS block looks wrong (no gitBranch)");
if (stringsBlock.indexOf("th: {") === -1 || stringsBlock.indexOf("en: {") === -1) throw new Error("STRINGS block looks wrong");

const body = src;
const newApp =
  body
    .replace(iconsBlock, "  const ICONS = window.VOCAB_ICONS;")
    .replace(stringsBlock, "  const STRINGS = window.VOCAB_STRINGS;");

if (newApp.indexOf("const ICONS = window.VOCAB_ICONS;") === -1) throw new Error("app.js ICONS replace failed");
if (newApp.indexOf("const STRINGS = window.VOCAB_STRINGS;") === -1) throw new Error("app.js STRINGS replace failed");

// Build the new module file (top-level, no IIFE, so consts reach window scope via explicit assignment).
const i18nSrc =
  "/* ============================================================\n" +
  "   vocab-i18n.js — shared icon set + EN/TH string tables.\n" +
  "   Extracted from app.js so other modules can reuse the same data.\n" +
  "   Load BEFORE app.js. Exposes window.VOCAB_ICONS + window.VOCAB_STRINGS.\n" +
  "   ============================================================ */\n" +
  "window.VOCAB_ICONS = " + iconsBlock.replace(/^  const ICONS = /, "") + "\n\n" +
  "window.VOCAB_STRINGS = " + stringsBlock.replace(/^  const STRINGS = /, "") + "\n";

fs.writeFileSync(i18nFile, i18nSrc, "utf-8");
fs.writeFileSync(appFile, newApp, "utf-8");

console.log("OK — wrote", i18nFile);
console.log("ICONS lines:", icons.start + 1, "-", icons.end + 1, `(${icons.end - icons.start + 1} lines)`);
console.log("STRINGS lines:", strings.start + 1, "-", strings.end + 1, `(${strings.end - strings.start + 1} lines)`);