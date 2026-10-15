const fs = require('fs');
const xml = fs.readFileSync('dx/word/document.xml', 'utf8');
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)).replace(/&amp;/g, '&');
// TOC area: from 'Содержание' to first Heading1
const i = xml.indexOf('Содержание');
const h1 = xml.search(/<w:pStyle w:val="Heading1"/);
const area = xml.slice(i, h1);
// paragraphs in TOC area
const tocEntries = [];
let pos = 0;
const pRe = /<w:p[ >]/g;
let mm;
const paraSpans = [];
while ((mm = pRe.exec(area)) !== null) {
  const closeIdx = area.indexOf('</w:p>', mm.index);
  paraSpans.push([mm.index, closeIdx]);
}
for (const [a, b] of paraSpans) {
  const span = area.slice(a, b);
  const pStyleM = span.match(/<w:pStyle w:val="([^"]+)"/);
  let text = '';
  for (const t of span.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)) text += decode(t[1]);
  text = text.trim();
  if (text) tocEntries.push({ style: pStyleM ? pStyleM[1] : '', text });
}
console.log('toc paragraphs:', tocEntries.length);
console.log('first 5:');
tocEntries.slice(0, 5).forEach(e => console.log(JSON.stringify(e)));
console.log('last 12:');
tocEntries.slice(-12).forEach(e => console.log(JSON.stringify(e)));
const styles = {};
tocEntries.forEach(e => styles[e.style] = (styles[e.style] || 0) + 1);
console.log('styles:', JSON.stringify(styles));
