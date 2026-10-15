const fs = require('fs');
const xml = fs.readFileSync('dx/word/document.xml', 'utf8');

// same block scan as build-docx2.cjs
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

function tryParseJson(s) {
  for (const c of [s, '{' + s, s + '}', '{' + s + '}']) {
    try { return JSON.parse(c); } catch (e) { }
  }
  return null;
}

let looks = 0, parsed = 0;
const failed = [];
for (const b of blocks) {
  if (b.kind !== 'w:p' || b.end <= 0) continue;
  const span = xml.slice(b.start, b.end);
  let t = '';
  for (const tm of span.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g))
    t += tm[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)).replace(/&amp;/g, '&');
  const s = t.trim();
  if (s.length < 15) continue;
  const looksLike = /"\s*:\s*"/.test(s) || /"\s*:\s*[\{\[]/.test(s) || s[0] === '{' || s[0] === '[';
  if (!looksLike) continue;
  looks++;
  const ok = tryParseJson(s);
  if (ok) parsed++;
  else if (failed.length < 8) failed.push(s.slice(0, 160));
}
console.log('json-like paragraphs:', looks, '| parsed:', parsed, '| failed:', failed.length);
for (const f of failed) console.log('FAILED:', f);
