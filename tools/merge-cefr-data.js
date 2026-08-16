/* Temporary script to merge CEFR level data into vocab-data.js */
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "assets", "js", "vocab-data.js");
let content = fs.readFileSync(dataPath, "utf8");

const mergeCode = `

/* ============================================================
   Merge CEFR-level data into VOCAB_DAYS (B1, B2, C1, C2)
   Days 30-69 from the separate level files.
   ============================================================ */
["30","31","32","33","34","35","36","37","38","39"].forEach(function (k) { VOCAB_DAYS[k] = VOCAB_DAYS_B1[k]; });
["40","41","42","43","44","45","46","47","48","49"].forEach(function (k) { VOCAB_DAYS[k] = VOCAB_DAYS_B2[k]; });
["50","51","52","53","54","55","56","57","58","59"].forEach(function (k) { VOCAB_DAYS[k] = VOCAB_DAYS_C1[k]; });
["60","61","62","63","64","65","66","67","68","69"].forEach(function (k) { VOCAB_DAYS[k] = VOCAB_DAYS_C2[k]; });

export default VOCAB_DAYS;`;

// Replace the final export
content = content.replace(/};\n\nexport default VOCAB_DAYS;/, mergeCode);

fs.writeFileSync(dataPath, content, "utf8");
console.log("Merge code added successfully.");