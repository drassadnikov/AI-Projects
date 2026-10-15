const fs = require('fs');
let src = fs.readFileSync('build-docx2.cjs', 'utf8');
const cut = src.indexOf('// ---- 7. render');
src = src.slice(0, cut);
src += `
;(function(){
  // section 3.1.11.5.2
  const si = sections.findIndex(s => s.num === '3.1.11.5.2');
  console.log('section idx', si, sections[si].title);
  let shown = 0;
  for (let i = 0; i < sections[si].items.length; i++) {
    const it = sections[si].items[i];
    if (it.kind !== 'p') { console.log('  [TBL]'); continue; }
    const t = it.text;
    console.log((t ? t.slice(0, 90) : '(empty)'));
    if (t.includes('Пример ответа с успехом')) shown = 1;
    if (shown && shown > 40) break;
    if (shown) shown++;
  }
})();
`;
eval(src);
