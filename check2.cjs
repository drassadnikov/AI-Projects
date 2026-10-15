const fs = require('fs');
const dir = 'out/convert3';
let fences = 0, labelsBefore = 0, labelsAfter = 0;
let badCols = 0, tables = 0;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
  const c = fs.readFileSync(dir + '/' + f, 'utf8');
  fences += (c.match(/```json/g) || []).length;
  labelsBefore += (c.match(/Пример (?:запроса|ответа)[^\n]*\n\n?```json/g) || []).length;
  labelsAfter += (c.match(/\n```\n\nПример (?:запроса|ответа)\b/g) || []).length;
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && (!lines[i - 1] || !lines[i - 1].startsWith('|'))) {
      let j = i;
      while (j < lines.length && lines[j].startsWith('|')) j++;
      const rows = lines.slice(i, j).map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim()));
      const ncol = rows[0].length;
      tables++;
      for (let k = 0; k < ncol; k++) {
        if (rows.every(r => r.length <= k || r[k] === '')) badCols++;
      }
    }
  }
}
console.log('json fences:', fences, '| label-before-fence:', labelsBefore, '| unswapped (fence-then-label):', labelsAfter);
console.log('tables:', tables, '| fully empty columns left:', badCols);
