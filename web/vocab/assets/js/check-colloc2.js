const vm = require('vm');
const fs = require('fs');
const path = require('path');

const files = [
  'vocab-data.js',
  'vocab-extra-colloc.js',
  'vocab-extra-colloc-b.js',
  'vocab-extra-colloc-c1.js',
  'vocab-extra-colloc-c2.js'
];

const code = files.map(f => {
  const p = path.join(__dirname, f);
  return fs.readFileSync(p, 'utf8');
}).join('\n');

const sandbox = { window: {} };
sandbox.window = sandbox;
sandbox.VOCAB_TH_EXTRA = {};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const allCollocs = [];
for (let day = 1; day <= 360; day++) {
  const dayData = sandbox.VOCAB_DAYS[String(day)];
  if (!dayData || !dayData.collocations) continue;
  for (const c of dayData.collocations) {
    allCollocs.push({ day, ...c });
  }
}

// More thorough mismatch detection
// For each collocation, check if the key word from the phrase appears in the example
// If not, it's a potential mismatch

const issues = [];
for (const c of allCollocs) {
  const p = c.phrase.toLowerCase();
  const e = c.exEn.toLowerCase();
  const t = c.exTh.toLowerCase();
  
  // Extract content words from phrase (skip articles, prepositions)
  const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'and', 'but', 'or', 'not', 'this', 'that', 'these', 'those', 'it', 'its']);
  
  const phraseWords = p.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
  
  // Check if at least one content word from the phrase appears in the example
  const hasContentWord = phraseWords.some(w => e.includes(w));
  
  // For collocations with "homework" in example but "assignments" in phrase
  if (p.includes('assignment') && e.includes('homework') && !e.includes('assignment')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, type: 'assignment/homework' });
  }
  
  // For collocations where example clearly shows different action
  if (p.includes('settle') && e.includes('pay') && e.includes('bill') && !e.includes('invoice')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, type: 'settle/pay' });
  }
  
  // Check for "compose a note" vs "write a letter"
  if (p.includes('compose') && p.includes('note') && e.includes('write') && e.includes('letter') && !e.includes('note')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, type: 'compose note vs write letter' });
  }
  
  // Check for "scan headlines" vs "read news"
  if (p.includes('scan') && p.includes('headlin') && e.includes('read') && e.includes('news') && !e.includes('headlin')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, type: 'scan headlines vs read news' });
  }
  
  // Check for "have a bath" vs "take a shower"
  if (p.includes('have') && p.includes('bath') && e.includes('shower') && !e.includes('bath')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, type: 'bath vs shower' });
  }
}

console.log('Broader mismatch search found:', issues.length);
for (const issue of issues) {
  console.log(`\nDay ${issue.day}: [${issue.type}]`);
  console.log(`  Phrase: "${issue.phrase}"`);
  console.log(`  exEn: "${issue.exEn}"`);
  console.log(`  th: "${issue.th}"`);
  console.log(`  exTh: "${issue.exTh}"`);
}
