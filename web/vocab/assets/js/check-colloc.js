const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load all collocation files
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

// Create sandbox
const sandbox = { window: {} };
sandbox.window = sandbox;
sandbox.VOCAB_TH_EXTRA = {};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// Collect all collocations
const allCollocs = [];
const seenPhrases = new Set();
const dups = [];

for (let day = 1; day <= 360; day++) {
  const dayData = sandbox.VOCAB_DAYS[String(day)];
  if (!dayData || !dayData.collocations) continue;
  for (const c of dayData.collocations) {
    allCollocs.push({ day, ...c });
    if (seenPhrases.has(c.phrase)) {
      dups.push({ day, phrase: c.phrase });
    }
    seenPhrases.add(c.phrase);
  }
}

// Check for mismatches between phrase and exEn
function isMismatch(phrase, exEn, th, exTh) {
  const p = phrase.toLowerCase();
  const e = exEn.toLowerCase();
  
  // Extract the main verb/noun from the phrase
  const words = p.split(/\s+/);
  
  // For each word in the phrase, check if it appears in the example
  // A collocation is mismatched if the example clearly describes a different action
  
  // Specific checks based on known patterns
  const mismatches = [
    {
      phrase: 'compose a note',
      exEn: exEn.toLowerCase(),
      test: (e) => !e.includes('note') && (e.includes('letter') || e.includes('handwritten'))
    },
    {
      phrase: 'scan headlines',
      exEn: exEn.toLowerCase(),
      test: (e) => !e.includes('headlin') && (e.includes('news') || e.includes('morning'))
    },
    {
      phrase: 'complete assignments',
      exEn: exEn.toLowerCase(),
      test: (e) => !e.includes('assignment') && e.includes('homework')
    },
    {
      phrase: 'have a bath',
      exEn: exEn.toLowerCase(),
      test: (e) => e.includes('shower') && !e.includes('bath')
    },
    {
      phrase: 'settle the invoice',
      exEn: exEn.toLowerCase(),
      test: (e) => !e.includes('invoice') && e.includes('bill')
    }
  ];
  
  return mismatches.some(m => m.phrase === p && m.test(m.exEn));
}

// Also check for broader semantic mismatches
function isBroadMismatch(phrase, exEn) {
  const p = phrase.toLowerCase();
  const e = exEn.toLowerCase();
  
  // Generic check: if the phrase is about X but the example is clearly about Y
  // This is harder to automate, so we'll focus on the specific patterns we know about
  
  return false;
}

console.log(`Total collocations: ${allCollocs.length}`);
console.log(`Duplicate phrases: ${dups.length}`);
if (dups.length > 0) {
  console.log('Duplicates:', dups);
}

// Check each collocation for consistency
const issues = [];
for (const c of allCollocs) {
  const p = c.phrase.toLowerCase();
  const e = c.exEn.toLowerCase();
  const t = c.exTh.toLowerCase();
  
  // Check for obvious mismatches where the example describes a different action
  if (p.includes('compose') && e.includes('write') && e.includes('letter') && !e.includes('note')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, reason: 'compose note vs write letter' });
  }
  if (p.includes('scan') && e.includes('read') && e.includes('news') && !e.includes('headlin')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, reason: 'scan headlines vs read news' });
  }
  if (p.includes('complete') && e.includes('finish') && e.includes('homework') && !e.includes('assignment')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, reason: 'complete assignments vs finish homework' });
  }
  if (p.includes('have a bath') && e.includes('shower') && !e.includes('bath')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, reason: 'have a bath vs take a shower' });
  }
  if (p.includes('settle') && e.includes('pay') && e.includes('bill') && !e.includes('invoice')) {
    issues.push({ day: c.day, phrase: c.phrase, exEn: c.exEn, th: c.th, exTh: c.exTh, reason: 'settle invoice vs pay bill' });
  }
  
  // More general checks
  const phraseVerbs = p.split(' ')[0];
  const exVerb = e.split(' ')[0];
  
  // Check if the main action word in the phrase is completely absent from the example
  // and the example uses a clearly different verb for a similar concept
}

console.log('\nPotential mismatches found:', issues.length);
for (const issue of issues) {
  console.log(`\nDay ${issue.day}:`);
  console.log(`  Phrase: ${issue.phrase}`);
  console.log(`  Reason: ${issue.reason}`);
  console.log(`  Current exEn: ${issue.exEn}`);
  console.log(`  Current th: ${issue.th}`);
  console.log(`  Current exTh: ${issue.exTh}`);
}
