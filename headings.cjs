const fs = require('fs');
const xml = fs.readFileSync('dx/word/document.xml', 'utf8');
const bodyStart = xml.indexOf('<w:body>');
const bodyEnd = xml.lastIndexOf('</w:body>');
const tagRe2 = /<([/?]?)([A-Za-z][\w:.-]*)((?:"[^"]*")?[^>]*?)(\/?)>/g;
const events = [];
let m;
tagRe2.lastIndex = bodyStart;
while ((m = tagRe2.exec(xml)) !== null) {
  if (m.index > bodyEnd) break;
  events.push({ pos: m.index, close: m[1] === '/', name: m[2], self: m[4] === '/' });
}
const blocks = [];
let stack = [];
for (const e of events) {
  if (e.name === 'w:body') continue;
  if (!e.close && !e.self) {
    if (stack.length === 0) blocks.push({ kind: e.name, start: e.pos, end: -1 });
    stack.push(e.name);
  } else if (e.close) {
    stack.pop();
    if (stack.length === 0 && blocks.length && blocks[blocks.length - 1].kind === e.name && blocks[blocks.length - 1].end === -1) {
      blocks[blocks.length - 1].end = e.pos;
    }
  }
}
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)).replace(/&amp;/g, '&');
const heads = [];
let noNum = 0;
for (const b of blocks) {
  if (b.kind !== 'w:p' || b.end <= 0) continue;
  const span = xml.slice(b.start, b.end);
  const pStyleM = span.match(/<w:pStyle w:val="([^"]+)"/);
  if (pStyleM && /^Heading[1-6]$/.test(pStyleM[1])) {
    let text = '';
    for (const t of span.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>/g)) {
      text += t[1] !== undefined ? decode(t[1]) : ' ';
    }
    const numM = text.match(/^(\d+(?:\.\d+)*)[.]?\s+(.*)$/);
    if (!numM) noNum++;
    heads.push(text.trim());
  }
}
console.log('headings:', heads.length, 'without num:', noNum);
heads.slice(0, 25).forEach(h => console.log(JSON.stringify(h)));
console.log('...');
heads.slice(-8).forEach(h => console.log(JSON.stringify(h)));
