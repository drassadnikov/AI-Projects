import fs from 'fs';
const pages = JSON.parse(fs.readFileSync('out/pages.json', 'utf8'));
for (const pi of [1, 2, 4]) {
  const lines = pages[pi].lines;
  console.log('=== PDF page', pi + 1, lines.length, 'lines');
  lines.slice(0, 50).forEach(l => console.log(JSON.stringify(l.t).slice(0, 130)));
}
