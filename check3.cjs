const fs = require('fs');
const dir = 'out/convert3';
let shown = 0;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
  const c = fs.readFileSync(dir + '/' + f, 'utf8');
  const m = c.match(/Пример ответа\n```json\n([\s\S]{0,380})/);
  if (m) {
    console.log('FILE:', f);
    console.log(m[0].slice(0, 400));
    console.log('---');
    if (++shown >= 2) break;
  }
}
