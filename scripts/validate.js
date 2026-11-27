// Usage: node scripts/validate.js   (checks every database file; exits 1 on any error)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'data');
const CATS = ['movies', 'series', 'games', 'anime'], TARGET = 500;
const errors = [], warns = [], ids = new Set(), allFacts = new Map();
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { errors.push('manifest.json missing or invalid'); }
let total = 0;
for (const c of CATS) {
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')); } catch (e) { errors.push(`${c}.json: ${e.message}`); continue; }
  if (!Array.isArray(list)) { errors.push(`${c}.json is not an array`); continue; }
  const titles = new Set();
  list.forEach((t, i) => {
    const w = `${c}[${i}] ${t && t.title}`;
    const bad = m => errors.push(`${w}: ${m}`);
    if (!t.id || !t.id.startsWith(c + '-')) bad('id must start with "' + c + '-"');
    else if (ids.has(t.id)) bad('duplicate id'); else ids.add(t.id);
    if (t.category !== c) bad('category must be "' + c + '"');
    if (typeof t.title !== 'string' || !t.title.trim()) bad('missing title');
    else { const k = t.title.toLowerCase().trim(); if (titles.has(k)) bad('duplicate title'); titles.add(k); }
    if (!Number.isInteger(t.year) || t.year < 1880 || t.year > 2030) bad('invalid year');
    if (!Array.isArray(t.genres) || !t.genres.length) bad('genres missing');
    if (typeof t.rating !== 'number' || t.rating < 0 || t.rating > 10) bad('rating must be 0-10');
    if (typeof t.description !== 'string' || t.description.length < 20) bad('description too short');
    if (typeof t.cover !== 'string') bad('cover must be a string (empty = placeholder)');
    else if (!t.cover) warns.push(`${w}: no cover image yet`);
    if (!Array.isArray(t.facts) || t.facts.length !== 10) bad(`needs exactly 10 facts (has ${t.facts && t.facts.length})`);
    else t.facts.forEach(f => {
      if (typeof f !== 'string' || f.trim().length < 15) bad('empty or too-short fact');
      const k = f.toLowerCase().trim();
      if (allFacts.has(k)) bad(`fact repeated from ${allFacts.get(k)}`); else allFacts.set(k, t.id);
    });
  });
  if (manifest[c] !== list.length) errors.push(`manifest.json says ${c}=${manifest[c]} but file has ${list.length}`);
  if (list.length !== TARGET) warns.push(`${c}: ${list.length}/${TARGET} titles`);
  total += list.length;
}
console.log(`Titles: ${total} / ${TARGET * 4}`);
warns.slice(0, 12).forEach(w => console.log('warn:', w)); if (warns.length > 12) console.log(`warn: ...and ${warns.length - 12} more`);
errors.forEach(e => console.error('ERROR:', e));
console.log(errors.length ? `FAILED with ${errors.length} error(s)` : 'Schema check passed (this does not verify that facts are true).');
process.exit(errors.length ? 1 : 0);
