import fs from 'fs';
const pages = JSON.parse(fs.readFileSync('out/pages.json', 'utf8'));
// print full lines (no truncation) of page 2, focusing on leader endings
const lines = pages[1].lines;
for (const l of lines) {
  if (/\.{3,}/.test(l.t)) console.log(JSON.stringify(l.t));
}
console.log('=== doc.txt raw TOC lines (first 40) ===');
const txt = fs.readFileSync('doc.txt', 'utf8').split('\n');
let shown = 0;
for (const t of txt) {
  if (/^\d+(\.\d+)*\s/.test(t) && /\.{3,}/.test(t)) {
    console.log(JSON.stringify(t));
    if (++shown >= 40) break;
  }
}
