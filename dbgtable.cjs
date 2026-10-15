const fs = require('fs');
let src = fs.readFileSync('build-docx2.cjs', 'utf8');
const cut = src.indexOf('// ---- 4. linear model');
src = src.slice(0, cut);
src += `
;(function(){
  const i = xml.indexOf('queryParams. Пример');
  const tStart = xml.lastIndexOf('<w:tbl>', i);
  const tEnd = xml.indexOf('</w:tbl>', i);
  const span = xml.slice(tStart, tEnd);
  const t = parseTable(span);
  console.log('nCols:', t.nCols);
  t.matrix.forEach((r, ri) => {
    console.log('row', ri, 'len', r.length);
    r.forEach((c, ci) => { if (c.trim() !== '') console.log('  [' + ci + ']', JSON.stringify(c.slice(0, 25))); });
  });
})();
`;
eval(src);
