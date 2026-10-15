import fs from 'fs';
const pages = JSON.parse(fs.readFileSync('out/pages.json', 'utf8'));
const targets = ['3.1.2.3.13', '3.1.9.2', '3.1.12.2.2', '3.1.17.3.5', '3.1.40'];
for (let pi = 1; pi <= 12; pi++) {
  const lines = pages[pi].lines;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].t;
    if (targets.some(x => t.startsWith(x))) {
      console.log('--- page', pi + 1, 'line idx', i, '---');
      for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 2); j++) {
        console.log(JSON.stringify(lines[j].t));
      }
    }
  }
}
