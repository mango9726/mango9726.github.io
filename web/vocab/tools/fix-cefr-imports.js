/* Fix script: Remove ES module import/export and convert to global consts */
const fs = require("fs");
const path = require("path");

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, c) { fs.writeFileSync(p, c, "utf8"); console.log("Updated:", p); }

const jsDir = path.join(__dirname, "..", "assets", "js");

/* 1. vocab-data.js - remove imports and export */
let main = read(path.join(jsDir, "vocab-data.js"));
main = main.replace(
  'import VOCAB_DAYS_B1 from "./vocab-data-b1.js";\nimport VOCAB_DAYS_B2 from "./vocab-data-b2.js";\nimport VOCAB_DAYS_C1 from "./vocab-data-c1.js";\nimport VOCAB_DAYS_C2 from "./vocab-data-c2.js";\n\n',
  ""
);
main = main.replace("\nexport default VOCAB_DAYS;", "\n");
write(path.join(jsDir, "vocab-data.js"), main);

/* 2. Remove exports from level files */
function removeExport(p) {
  const c = read(p);
  const updated = c.replace("\nexport default VOCAB_DAYS_" + path.basename(p).replace("vocab-data-", "").replace(".js", "").toUpperCase() + ";", "\n");
  write(p, updated);
}

["vocab-data-b1.js", "vocab-data-b2.js", "vocab-data-c1.js", "vocab-data-c2.js"].forEach(function (f) {
  const p = path.join(jsDir, f);
  let c = read(p);
  c = c.replace(/export default VOCAB_DAYS_[A-Z0-9]+;\s*$/, "");
  write(p, c);
});

/* 3. Update index.html with script tags */
const htmlPath = path.join(__dirname, "..", "index.html");
let html = read(htmlPath);
html = html.replace(
  '<script defer src="assets/js/vocab-data.js"></script>',
  '<script defer src="assets/js/vocab-data-b1.js"></script>\n  <script defer src="assets/js/vocab-data-b2.js"></script>\n  <script defer src="assets/js/vocab-data-c1.js"></script>\n  <script defer src="assets/js/vocab-data-c2.js"></script>\n  <script defer src="assets/js/vocab-data.js"></script>'
);
write(htmlPath, html);

console.log("All fixes applied successfully!");