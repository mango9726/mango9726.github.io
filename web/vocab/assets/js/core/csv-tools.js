/* ============================================================
   Vocab Trainer — CSV helpers (pure, testable)
   ============================================================
   Exposes window.VocabCSV (and module.exports in Node).
   Load BEFORE app.js.
   ============================================================ */
(function (root) {
  "use strict";

  /** Parse CSV text into a 2D array of row arrays (handles quoted fields, commas, newlines). */
  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') {
        inQ = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
  }

  /** Escape a value for CSV output (quotes if it contains , " or newline). */
  function csvField(v) {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Build a CSV string from header + rows (array of arrays). */
  function buildCsv(header, rows) {
    return [header].concat(rows).map(function (r) {
      return r.map(csvField).join(",");
    }).join("\n");
  }

  /**
   * Parse & validate custom-word CSV text against existing words.
   * Pure — does NOT persist. Returns { ok, added, skipped, error, toAdd }.
   * Expected headers (case-insensitive): word, type, pos, th, exEn, exTh
   */
  function parseImport(text, existing) {
    try {
      const rows = parseCsv(text);
      if (!rows.length) return { ok: false, added: 0, skipped: 0, error: "empty", toAdd: [] };
      const headers = rows[0].map(function (h) { return h.trim().toLowerCase(); });
      const col = { word: headers.indexOf("word"), type: headers.indexOf("type"), pos: headers.indexOf("pos"), th: headers.indexOf("th"), exen: headers.indexOf("exen"), exth: headers.indexOf("exth") };
      if (col.word === -1 || col.th === -1) return { ok: false, added: 0, skipped: 0, error: "header", toAdd: [] };
      const seen = {};
      (existing || []).forEach(function (w) { seen[String(w.word || "").toLowerCase()] = 1; });
      let added = 0, skipped = 0;
      const toAdd = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const word = (r[col.word] || "").trim();
        const th = (r[col.th] || "").trim();
        if (!word || !th) { skipped++; continue; }
        const key = word.toLowerCase();
        if (seen[key]) { skipped++; continue; }
        seen[key] = 1;
        const type = col.type >= 0 ? (r[col.type] || "").trim().toLowerCase() : "";
        toAdd.push({
          word: word,
          type: ["vocab", "collocation", "idiom"].indexOf(type) !== -1 ? type : "vocab",
          pos: col.pos >= 0 ? (r[col.pos] || "").trim() : "",
          th: th,
          exEn: col.exen >= 0 ? (r[col.exen] || "").trim() : "",
          exTh: col.exth >= 0 ? (r[col.exth] || "").trim() : "",
          day: 1
        });
        added++;
      }
      return { ok: true, added: added, skipped: skipped, error: "", toAdd: toAdd };
    } catch (e) {
      return { ok: false, added: 0, skipped: 0, error: (e && e.message) || "parse", toAdd: [] };
    }
  }

  root.VocabCSV = {
    parseCsv: parseCsv,
    csvField: csvField,
    buildCsv: buildCsv,
    parseImport: parseImport
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.VocabCSV;
})(typeof window !== "undefined" ? window : globalThis);