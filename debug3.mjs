import fs from 'fs';
const pages = JSON.parse(fs.readFileSync('out/pages.json', 'utf8'));
function dump(pi, n = 60) {
  console.log('=== PDF page', pi + 1, '===');
  pages[pi].lines.slice(0, n).forEach(l =>
    console.log(`${l.y},${l.x} s${l.s}${l.b ? ' B' : ''} ${JSON.stringify(l.t).slice(0, 100)}`)
  );
}
dump(13, 40); // page 14 glossary
dump(50, 30); // page 51
dump(20, 15); // page 21 (has image)
