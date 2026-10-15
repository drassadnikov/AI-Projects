const fs = require('fs');

const xml = fs.readFileSync('dx/word/document.xml', 'utf8');
// rels: rId -> media file
const relsXml = fs.readFileSync('dx/word/_rels/document.xml.rels', 'utf8');
const rels = {};
for (const m of relsXml.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
  rels[m[1]] = m[2];
}

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
   .replace(/&amp;/g, '&');

// ---- 1. Tag event scan of <w:body> ----
const bodyStart = xml.indexOf('<w:body>');
const bodyEnd = xml.lastIndexOf('</w:body>');
const tagRe = /<(\/)?(w:[a-zA-Z]+|[^w][^ >]*)(?:"[^"]*")?[^>]*?(\/?)>/g;
// simpler and safer: match any tag
const tagRe2 = /<([/?]?)([A-Za-z][\w:.-]*)((?:"[^"]*")?[^>]*?)(\/?)>/g;

let events = []; // {pos, close, name, self}
let m;
tagRe2.lastIndex = bodyStart;
while ((m = tagRe2.exec(xml)) !== null) {
  if (m.index > bodyEnd) break;
  events.push({ pos: m.index, close: m[1] === '/', name: m[2], self: m[4] === '/' });
}
console.log('tag events:', events.length);

// walk events, track stack; collect direct children of body
const blocks = []; // {kind, start, end}
let stack = [];
let i = 0;
while (i < events.length) {
  const e = events[i];
  if (e.name === 'w:body') { i++; continue; }
  if (!e.close && !e.self) {
    // if top of stack is body-level (stack empty relative to body), this is a direct child
    if (stack.length === 0) {
      blocks.push({ kind: e.name, start: e.pos, end: -1 });
    }
    stack.push(e.name);
    i++;
  } else {
    if (e.close) {
      const top = stack.pop();
      if (stack.length === 0 && blocks.length && blocks[blocks.length - 1].kind === e.name && blocks[blocks.length - 1].end === -1) {
        blocks[blocks.length - 1].end = e.pos + m ? e.pos : e.pos;
      }
      i++;
    } else {
      i++;
    }
  }
}
// fix: close position should point at the end of the closing tag; store end = pos (start of close tag) is fine for slicing [start, closeStart)
const kids = {};
for (const b of blocks) if (b.end > 0) kids[b.kind] = (kids[b.kind] || 0) + 1;
console.log('body direct children:', JSON.stringify(kids));

// ---- 2. Parse paragraph ----
function parsePara(span) {
  const pStyleM = span.match(/<w:pStyle w:val="([^"]+)"/);
  const style = pStyleM ? pStyleM[1] : '';
  let text = '';
  const imgs = [];
  const tRe = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<a:blip[^>]*r:embed="([^"]+)"[^>]*\/>|<w:br\s*\/>|<w:tab\s*\/>/g;
  let t;
  while ((t = tRe.exec(span)) !== null) {
    if (t[1] !== undefined) text += decode(t[1]);
    else if (t[2]) imgs.push(t[2]);
    else if (t[0].includes('w:br')) text += ' / ';
    else if (t[0].includes('w:tab')) text += ' ';
  }
  const isTocField = /TOC \\o/.test(span);
  return { style, text: text.trim(), imgs, isTocField };
}

// ---- 3. Parse table (depth-aware) ----
function splitSpans(str, tag) {
  // returns [start,end) spans of direct occurrences (no nesting expected, but depth-aware)
  const out = [];
  const open = new RegExp('<' + tag + '[ >]', 'g');
  let depth = 0, start = -1;
  const closeRe = new RegExp('</' + tag + '>', 'g');
  let pos = 0;
  // walk through both open and close occurrences in order
  const occ = [];
  let o;
  while ((o = open.exec(str)) !== null) occ.push({ p: o.index, open: true });
  open.lastIndex = 0;
  while ((o = closeRe.exec(str)) !== null) occ.push({ p: o.index, open: false });
  closeRe.lastIndex = 0;
  occ.sort((a, b) => a.p - b.p);
  for (const ev of occ) {
    if (ev.open) {
      if (depth === 0) start = ev.p;
      depth++;
    } else {
      depth--;
      if (depth === 0) { out.push([start, ev.p]); }
    }
  }
  return out;
}

function parseCell(span) {
  const gsM = span.match(/<w:gridSpan w:val="(\d+)"/);
  const vRestart = /<w:vMerge w:val="restart">/.test(span);
  const vCont = /<w:vMerge\/>/.test(span) && !vRestart;
  const pSpans = splitSpans(span, 'w:p');
  const paras = pSpans.map(([a, b]) => parsePara(span.slice(a, b)));
  const imgs = [];
  for (const pm of span.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) imgs.push(pm[1]);
  const text = paras.map(p => p.text).filter(Boolean).join(' <br> ');
  return { gridSpan: gsM ? +gsM[1] : 1, vCont, text: text.trim(), imgs };
}

function parseTable(span) {
  const gridM = span.match(/<w:tblGrid>(.*?)<\/w:tblGrid>/s);
  const gridCols = gridM ? (gridM[1].match(/<w:gridCol/g) || []).length : 0;
  const rowSpans = splitSpans(span, 'w:tr');
  const rows = rowSpans.map(([a, b]) => {
    const rs = span.slice(a, b);
    const cellSpans = splitSpans(rs, 'w:tc');
    return cellSpans.map(([ca, cb]) => parseCell(rs.slice(ca, cb)));
  });
  // build matrix
  const nCols = gridCols || rows.reduce((mx, r) => Math.max(mx, r.reduce((s, c) => s + c.gridSpan, 0)), 0);
  const matrix = rows.map(cells => {
    const arr = new Array(nCols).fill('');
    let col = 0;
    for (const c of cells) {
      if (col >= nCols) break;
      const content = c.vCont ? '' : c.text;
      for (let k = 0; k < c.gridSpan && col + k < nCols; k++) {
        arr[col + k] = k === 0 ? content : '';
      }
      col += c.gridSpan;
    }
    return arr;
  });
  const tableImgs = [];
  for (const r of rows) for (const c of r) tableImgs.push(...c.imgs);
  return { matrix, tableImgs, nCols };
}

// ---- 4. Build linear model ----
const mediaFiles = fs.readdirSync('dx/word/media');
const imgMap = {}; // rId -> output name
const mediaToOut = new Map(); // src media file -> output name
let imgSeq = 0;
const usedMedia = new Set();
function imgOutName(rid) {
  if (imgMap[rid]) return imgMap[rid];
  const target = rels[rid];
  if (!target || !target.startsWith('media/')) return null;
  const fname = target.replace('media/', '');
  if (!mediaFiles.includes(fname)) return null;
  imgSeq++;
  const out = 'img_' + String(imgSeq).padStart(3, '0') + '.' + (fname.split('.').pop() || 'png');
  imgMap[rid] = out;
  mediaToOut.set(fname, out);
  usedMedia.add(fname);
  return out;
}

const items = []; // {kind:'p'|'tbl', ...}
for (const b of blocks) {
  if (b.end <= 0) continue;
  const span = xml.slice(b.start, b.end);
  if (b.kind === 'w:p') {
    const p = parsePara(span);
    items.push({ kind: 'p', ...p });
  } else if (b.kind === 'w:tbl') {
    const t = parseTable(span);
    items.push({ kind: 'tbl', ...t });
  }
  // ignore sectPr, bookmarkStart (self-closing, no end), etc.
}
console.log('items:', items.length, ' tables:', items.filter(x => x.kind === 'tbl').length);

// heading levels by style
const levelOf = (s) => (/^Heading([1-6])$/.test(s) ? +s.match(/^Heading([1-6])$/)[1] : 0);
const isTocStyle = (s) => /^toc[ 0-9]*$/i.test(s) || s === '2' || s === '3' || s === '1';

// ---- 5. Split into sections ----
const sections = []; // {num, title, level, items:[]}
let cover = [];
let inToc = false;
for (const it of items) {
  const lvl = it.kind === 'p' ? levelOf(it.style) : 0;
  if (lvl > 0) {
    const text = it.text;
    const numM = text.match(/^(\d+(?:\.\d+)*\.?)\s+(.*)$/);
    const num = numM ? numM[1].replace(/\.+$/, '') : '';
    const title = numM ? numM[2] : text;
    sections.push({ num, title: title.trim(), level: lvl, items: [] });
  } else if (sections.length === 0) {
    // cover area (before first heading): skip TOC field + toc-style paragraphs
    if (it.kind === 'p' && (it.isTocField || isTocStyle(it.style))) continue;
    cover.push(it);
  } else {
    const last = sections[sections.length - 1];
    last.items.push(it);
  }
}
console.log('sections:', sections.length);

// ---- 6. Render markdown ----
const escCell = (s) => s.replace(/\|/g, '\\|').replace(/<br>/g, ' <br> ').trim();
function renderTable(t) {
  const rows = t.matrix;
  if (!rows.length) return '';
  const lines = [];
  lines.push('| ' + rows[0].map(escCell).join(' | ') + ' |');
  lines.push('|' + rows[0].map(() => ' --- ').join('|') + '|');
  for (let i = 1; i < rows.length; i++) {
    lines.push('| ' + rows[i].map(escCell).join(' | ') + ' |');
  }
  return lines.join('\n');
}
function mdPara(text) {
  if (!text) return '';
  if (/^[#>\-*+|`]/.test(text)) return ' ' + text;
  return text;
}

const outDir = 'out/convert2';
fs.mkdirSync(outDir + '/img', { recursive: true });
const idxName = 'БАНК ВТБ';
const sanitize = (s) =>
  s.replace(/[\/\\:*?"<>|#^\[\]{}]/g, ' ')
    .replace(/([а-яА-Яa-z0-9])-\s+/g, '$1-')
    .replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, 90);

for (let i = 0; i < sections.length; i++) sections[i].fname = String(i + 1).padStart(3, '0') + '_' + sanitize(sections[i].title) + '.md';

const childIdxs = (num) => {
  const res = [];
  for (let i = 0; i < sections.length; i++) {
    const p = sections[i].num.split('.');
    if (sections[i].num && p.length === num.split('.').length + 1 && p.slice(0, -1).join('.') === num) res.push(i);
  }
  return res;
};

let totalBytes = 0;
for (let i = 0; i < sections.length; i++) {
  const s = sections[i];
  const blocks = [];
  blocks.push('# ' + (s.num ? s.num + ' ' : '') + s.title);
  const nav = ['[[БАНК ВТБ|← Содержание]]'];
  const parentNum = s.num.split('.').slice(0, -1).join('.');
  const parent = parentNum ? sections.find(x => x.num === parentNum) : null;
  if (parent) nav.push('[[' + parent.fname + '|Родитель: ' + parent.num + ']]');
  blocks.push('> ' + nav.join(' · '));
  blocks.push('');
  const content = [];
  for (const it of s.items) {
    if (it.kind === 'p') {
      if (it.text) content.push(mdPara(it.text));
      for (const rid of it.imgs) {
        const out = imgOutName(rid);
        if (out) content.push('![[img/' + out + ']]');
      }
    } else {
      const r = renderTable(it);
      if (r) content.push(r);
      for (const rid of it.tableImgs) {
        const out = imgOutName(rid);
        if (out) content.push('![[img/' + out + ']]');
      }
    }
  }
  blocks.push(content.join('\n').replace(/\n{3,}/g, '\n\n').trim() || '_(раздел не содержит содержимого)_');
  const ch = childIdxs(s.num).map(j => sections[j]);
  if (ch.length) {
    blocks.push('');
    blocks.push('**Подразделы:** ' + ch.map(c => '[[' + c.fname + '|' + c.num + ']]').join(' · '));
  }
  const body = blocks.join('\n') + '\n';
  fs.writeFileSync(outDir + '/' + s.fname, body);
  totalBytes += body.length;
}

// ---- 7. Index ----
const idx = [];
idx.push('# ' + idxName);
idx.push('');
idx.push('> БАНК ВТБ (ПАО) · Система/Подсистема 3704_3 «Электронный кошелек в канале Партнёра» · Требования к ИС · Код АППД: 2026');
idx.push('> Исходный файл: БАНК ВТБ.docx (' + (9577296 / 1e6).toFixed(1) + ' МБ), ' + sections.length + ' разделов, ' + items.filter(x => x.kind === 'tbl').length + ' таблиц, ' + mediaFiles.length + ' рисунков');
idx.push('');
idx.push('## Титульный лист');
idx.push('');
for (const it of cover) {
  if (it.kind === 'p' && it.text) idx.push(mdPara(it.text));
}
idx.push('');
idx.push('## Содержание');
idx.push('');
const byNum = {};
sections.forEach((s, i) => { if (!(s.num in byNum)) byNum[s.num] = i; });
function emit(num, depth) {
  const i = byNum[num];
  if (i == null) return;
  const s = sections[i];
  idx.push('  '.repeat(depth - 1) + '- [[' + s.fname + '|' + (s.num ? s.num + ' ' : '') + s.title + ']]');
  for (const j of childIdxs(num)) emit(sections[j].num, depth + 1);
}
for (const s of sections) if (!s.num.includes('.')) emit(s.num, 1);
fs.writeFileSync(outDir + '/' + idxName + '.md', idx.join('\n') + '\n');

// copy media
for (const [src, out] of mediaToOut) fs.copyFileSync('dx/word/media/' + src, outDir + '/img/' + out);
console.log('done. files:', sections.length + 1, 'bytes:', totalBytes, 'images:', usedMedia.size);
