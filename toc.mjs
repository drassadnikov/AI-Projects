import fs from 'fs';
const pages = JSON.parse(fs.readFileSync('out/pages.json', 'utf8'));

// Find TOC pages: lines like "1 Глоссарий....14" or "3.1.2.4.10. title .... 198"
const tocRe = /^(\d+(?:\.\d+)*)\s+(.+?)\.{3,}\s*(\d+)\s*$/;
const entries = [];
let tocPageRange = null;
for (let i = 0; i < pages.length; i++) {
  const lines = pages[i].lines;
  const matches = lines.filter(l => tocRe.test(l.t));
  if (matches.length >= 2) {
    if (!tocPageRange) tocPageRange = [i + 1, i + 1];
    else tocPageRange[1] = i + 1;
    for (const l of matches) {
      const m = l.t.match(tocRe);
      entries.push({ num: m[1], title: m[2].trim(), page: +m[3], tocOn: i + 1, bold: l.b });
    }
  }
}
console.log('TOC pages:', tocPageRange, 'entries:', entries.length);
console.log('levels:', JSON.stringify(entries.reduce((a, e) => { const d = e.num.split('.').length; a[d] = (a[d] || 0) + 1; return a; }, {})));
console.log('last entry:', JSON.stringify(entries[entries.length - 1]));
console.log('max page:', Math.max(...entries.map(e => e.page)));
// first body section start
const first = entries.find(e => e.num === '1');
console.log('entry "1":', JSON.stringify(first));
// check page 14 content
const p14 = pages[13].lines.map(l => l.t).join('\n');
console.log('--- page 14 first 10 lines ---');
console.log(p14.split('\n').slice(0, 10).join('\n'));
// check what's around TOC end
const endPg = tocPageRange[1];
const pNext = pages[endPg].lines.map(l => l.t).join('\n');
console.log('--- page ' + (endPg + 1) + ' first 10 lines ---');
console.log(pNext.split('\n').slice(0, 10).join('\n'));
// save
fs.writeFileSync('out/toc.json', JSON.stringify(entries, null, 1));
