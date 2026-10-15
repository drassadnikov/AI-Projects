const fs = require('fs');

const xml = fs.readFileSync('dx/word/document.xml', 'utf8');
const relsXml = fs.readFileSync('dx/word/_rels/document.xml.rels', 'utf8');
const rels = {};
const relExt = {};
for (const m of relsXml.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*TargetMode="External"[^>]*\/>|<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) {
  const id = m[1] || m[3];
  const target = m[2] || m[4];
  rels[id] = target;
  if (m[1] && m[2] && /TargetMode="External"/.test(m[0])) relExt[id] = true;
}

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
   .replace(/&amp;/g, '&');

// ---- 1. body-level block scan ----
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

// ---- 2. paragraph parser (parts with bold + links) ----
function parseParts(span) {
  const parts = [];
  const imgs = [];
  let pos = 0;
  const n = span.length;
  while (pos < n) {
    const hIdx = span.indexOf('<w:hyperlink ', pos);
    const rIdx = span.indexOf('<w:r>', pos);
    const rIdx2 = span.indexOf('<w:r ', pos);
    const rStart = Math.min(rIdx === -1 ? Infinity : rIdx, rIdx2 === -1 ? Infinity : rIdx2);
    const next = Math.min(hIdx === -1 ? Infinity : hIdx, rStart === Infinity ? Infinity : rStart);
    if (next === Infinity) break;
    if (next === hIdx) {
      const end = span.indexOf('</w:hyperlink>', hIdx);
      if (end === -1) { pos = n; break; }
      const attrs = span.slice(hIdx, span.indexOf('>', hIdx));
      const inner = span.slice(span.indexOf('>', hIdx) + 1, end);
      const ip = parseParts(inner);
      const text = ip.parts.map(p => p.t).join('');
      const ridM = attrs.match(/r:id="([^"]+)"/);
      const anchorM = attrs.match(/w:anchor="([^"]+)"/);
      let url = null;
      if (ridM && relExt[ridM[1]] && rels[ridM[1]]) url = rels[ridM[1]];
      parts.push({ t: text, link: url });
      for (const im of inner.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) imgs.push(im[1]);
      pos = end + '</w:hyperlink>'.length;
    } else {
      const start = rStart;
      const end = span.indexOf('</w:r>', start);
      if (end === -1) { pos = n; break; }
      const run = span.slice(start, end);
      const bold = /<w:b\/>/.test(run) || /<w:b w:val="1">/.test(run);
      let t = '';
      for (const tm of run.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>/g)) {
        t += tm[1] !== undefined ? decode(tm[1]) : ' ';
      }
      if (t) parts.push({ t, bold });
      for (const im of run.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) imgs.push(im[1]);
      pos = end + '</w:r>'.length;
    }
  }
  return { parts, imgs };
}

function parsePara(span) {
  const pStyleM = span.match(/<w:pStyle w:val="([^"]+)"/);
  const style = pStyleM ? pStyleM[1] : '';
  const { parts, imgs } = parseParts(span);
  const isTocField = /TOC \\o/.test(span);
  const text = parts.map(p => p.t).join('');
  return { style, parts, imgs, isTocField, text: text.trim() };
}

// ---- 3. table parser ----
function splitSpans(str, tag) {
  const out = [];
  const open = new RegExp('<' + tag + '[ >]', 'g');
  const closeRe = new RegExp('</' + tag + '>', 'g');
  const occ = [];
  let o;
  while ((o = open.exec(str)) !== null) occ.push({ p: o.index, open: true });
  open.lastIndex = 0;
  while ((o = closeRe.exec(str)) !== null) occ.push({ p: o.index, open: false });
  closeRe.lastIndex = 0;
  occ.sort((a, b) => a.p - b.p);
  let depth = 0, start = -1;
  for (const ev of occ) {
    if (ev.open) { if (depth === 0) start = ev.p; depth++; }
    else { depth--; if (depth === 0) out.push([start, ev.p]); }
  }
  return out;
}

function partsToMd(parts, joiner) {
  let md = '';
  for (const p of parts) {
    const t = p.t;
    if (p.link && t) md += '[' + t + '](' + p.link + ')';
    else if (p.bold && t) md += '**' + t + '**';
    else md += t;
  }
  return md;
}

function parseCell(span) {
  const gsM = span.match(/<w:gridSpan w:val="(\d+)"/);
  const vRestart = /<w:vMerge w:val="restart">/.test(span);
  const vCont = /<w:vMerge\/>/.test(span) && !vRestart;
  const pSpans = splitSpans(span, 'w:p');
  const paras = pSpans.map(([a, b]) => parsePara(span.slice(a, b)));
  const imgs = [];
  for (const pm of span.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)) imgs.push(pm[1]);
  const text = paras.map(p => partsToMd(p.parts, ' ')).filter(Boolean).join(' <br> ');
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
  const nCols = gridCols || rows.reduce((mx, r) => Math.max(mx, r.reduce((s, c) => s + c.gridSpan, 0)), 0);
  const matrix = rows.map(cells => {
    const arr = new Array(nCols).fill('');
    let col = 0;
    for (const c of cells) {
      if (col >= nCols) break;
      const content = c.vCont ? '' : c.text;
      for (let k = 0; k < c.gridSpan && col + k < nCols; k++) arr[col + k] = k === 0 ? content : '';
      col += c.gridSpan;
    }
    return arr;
  });
  const tableImgs = [];
  for (const r of rows) for (const c of r) tableImgs.push(...c.imgs);
  return { matrix, tableImgs, nCols };
}

// ---- 4. linear model ----
const mediaFiles = fs.readdirSync('dx/word/media');
const imgMap = {};
const mediaToOut = new Map();
let imgSeq = 0;
function imgOutName(rid) {
  if (imgMap[rid]) return imgMap[rid];
  const target = rels[rid];
  if (!target || !target.startsWith('media/')) return null;
  const fname = target.replace('media/', '');
  if (!mediaFiles.includes(fname)) return null;
  imgSeq++;
  const ext = (fname.split('.').pop() || 'png').toLowerCase() === 'jpeg' ? 'png' : (fname.split('.').pop() || 'png');
  const out = 'img_' + String(imgSeq).padStart(3, '0') + '.' + ext;
  imgMap[rid] = out;
  mediaToOut.set(fname, out);
  return out;
}

const items = [];
for (const b of blocks) {
  if (b.end <= 0) continue;
  const span = xml.slice(b.start, b.end);
  if (b.kind === 'w:p') items.push({ kind: 'p', ...parsePara(span) });
  else if (b.kind === 'w:tbl') items.push({ kind: 'tbl', ...parseTable(span) });
}
console.log('items:', items.length);

// ---- 5. sections ----
const levelOf = (s) => (/^Heading([1-6])$/.test(s) ? +s.match(/^Heading([1-6])$/)[1] : 0);
const isTocStyle = (s) => /^toc/i.test(s) || s === '1' || s === '2' || s === '3';
const sections = [];
let cover = [];
for (const it of items) {
  const lvl = it.kind === 'p' ? levelOf(it.style) : 0;
  if (lvl > 0) {
    const text = it.text;
    const numM = text.match(/^(\d+(?:\.\d+)*\.?)\s+(.*)$/);
    const rawNum = numM ? numM[1] : '';
    const num = rawNum.replace(/\.+$/, '');
    const title = numM ? numM[2] : text;
    sections.push({ rawNum, num, title: title.trim(), level: lvl, items: [] });
  } else if (sections.length === 0) {
    if (it.kind === 'p' && (it.isTocField || isTocStyle(it.style))) continue;
    cover.push(it);
  } else {
    sections[sections.length - 1].items.push(it);
  }
}
console.log('sections:', sections.length);

// ---- 6. filenames with exact document numbering ----
const sanitize = (s) =>
  s.replace(/[\/\\:*?"<>|#^\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').trim();
const usedNames = new Set();
for (const s of sections) {
  let base = (s.rawNum ? s.rawNum + '_' : '') + sanitize(s.title).slice(0, 80);
  let name = base + '.md';
  let k = 2;
  while (usedNames.has(name)) { name = base + ' (' + k++ + ').md'; }
  usedNames.add(name);
  s.fname = name;
}

const childIdxs = (num) => {
  const res = [];
  for (let i = 0; i < sections.length; i++) {
    const p = sections[i].num.split('.');
    if (sections[i].num && p.length === num.split('.').length + 1 && p.slice(0, -1).join('.') === num) res.push(i);
  }
  return res;
};

// ---- 7. render ----
const outDir = 'out/convert3';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir + '/img', { recursive: true });
const idxName = 'БАНК ВТБ';

const escCell = (s) => s.replace(/\|/g, '\\|').replace(/</g, (ch, i, str) => ch === '<' && str[i + 1] === 'b' ? ch : '\\<');
function renderTable(t) {
  const raw = t.matrix.filter(r => r.some(c => c.trim() !== ''));
  if (!raw.length) return '';
  const max = raw.reduce((mx, x) => Math.max(mx, x.length), 0);
  const keep = [];
  for (let c = 0; c < max; c++) if (raw.some(r => (r[c] || '').trim() !== '')) keep.push(c);
  if (!keep.length) return '';
  const norm = raw.map(r => keep.map(c => r[c] || ''));
  const lines = [];
  lines.push('| ' + norm[0].map(escCell).join(' | ') + ' |');
  lines.push('|' + norm[0].map(() => ' --- ').join('|') + '|');
  for (let i = 1; i < norm.length; i++) lines.push('| ' + norm[i].map(escCell).join(' | ') + ' |');
  return lines.join('\n');
}

// ---- JSON example detection ----
const isExampleLabel = (s) => /^Пример\b/.test(s) && s.length < 80 && /(запрос|ответ)/i.test(s);
const jsonTok = (s) => {
  const c = (s || '').trim()[0];
  return !!c && '{}[]:"'.includes(c);
};
function repairParse(s) {
  const cands = [s, '{' + s, s + '}', '{' + s + '}'];
  for (const c of cands) { try { return JSON.parse(c); } catch (e) { } }
  const rep = (c) => c.replace(/([\]\}])\s+(")\s*:/g, '$1, $2:');
  for (const c of cands) { try { return JSON.parse(rep(c)); } catch (e) { } }
  return null;
}
function tryBuildJson(items, idx, t) {
  const s0 = t.trim();
  if (!jsonTok(s0)) return null;
  let acc = s0;
  let k = idx;
  let guard = 0;
  for (;;) {
    const ok = repairParse(acc);
    if (ok) return { md: JSON.stringify(ok, null, 2), nextIdx: k };
    if (guard >= 80) break;
    const nxt = items[k + 1];
    if (!nxt || nxt.kind !== 'p') break;
    if (!nxt.text) { k++; guard++; continue; }
    if (!jsonTok(nxt.text)) break;
    acc += ' ' + nxt.text.trim();
    k++; guard++;
  }
  return null;
}
function mdText(parts) {
  let md = partsToMd(parts, ' ');
  md = md.replace(/\s*\n\s*/g, ' ').trim();
  if (/^[#>*]/.test(md)) md = ' ' + md;
  return md;
}

let totalBytes = 0;
for (const s of sections) {
  const blocksOut = [];
  blocksOut.push('# ' + s.rawNum + ' ' + s.title);
  const nav = ['[[БАНК ВТБ|← Содержание]]'];
  const parentNum = s.num.split('.').slice(0, -1).join('.');
  const parent = parentNum ? sections.find(x => x.num === parentNum) : null;
  if (parent) nav.push('[[' + parent.fname + '|Родитель: ' + parent.rawNum + ']]');
  blocksOut.push('> ' + nav.join(' · '));
  const content = [];
  for (let i = 0; i < s.items.length; ) {
    const it = s.items[i];
    if (it.kind === 'p') {
      const t = mdText(it.parts);
      if (t) {
        const j = tryBuildJson(s.items, i, t);
        if (j) {
          content.push('```json\n' + j.md + '\n```');
          i = j.nextIdx + 1;
          continue;
        }
        content.push(t);
      }
      for (const rid of it.imgs) {
        const out = imgOutName(rid);
        if (out) content.push('![[img/' + out + ']]');
      }
      i++;
    } else {
      const r = renderTable(it);
      if (r) content.push(r);
      for (const rid of it.tableImgs) {
        const out = imgOutName(rid);
        if (out) content.push('![[img/' + out + ']]');
      }
      i++;
    }
  }
  for (let i = 0; i < content.length; i++) {
    if (content[i].startsWith('```json') && i + 1 < content.length && isExampleLabel(content[i + 1].trim())) {
      [content[i], content[i + 1]] = [content[i + 1], content[i]];
    }
  }
  blocksOut.push(content.join('\n\n').trim() || '_(раздел не содержит содержимого)_');
  const ch = childIdxs(s.num);
  if (ch.length) blocksOut.push('**Подразделы:** ' + ch.map(j => '[[' + sections[j].fname + '|' + sections[j].rawNum + ' ' + sections[j].title + ']]').join(' · '));
  const body = blocksOut.join('\n\n') + '\n';
  fs.writeFileSync(outDir + '/' + s.fname, body);
  totalBytes += body.length;
}

// ---- 8. index ----
const idx = [];
idx.push('# ' + idxName);
idx.push('> БАНК ВТБ (ПАО) · Система/Подсистема 3704_3 «Электронный кошелек в канале Партнёра» · Требования к ИС · Код АППД: 2026');
idx.push('> Исходный файл: БАНК ВТБ.docx (9.6 МБ) · разделов: ' + sections.length + ' · таблиц: ' + items.filter(x => x.kind === 'tbl').length + ' · рисунков: ' + mediaFiles.length);
idx.push('## Титульный лист');
for (const it of cover) if (it.kind === 'p' && it.text) idx.push(mdText(it.parts));
idx.push('## Оглавление');
const byNum = {};
sections.forEach((s, i) => { if (!(s.num in byNum)) byNum[s.num] = i; });
function emit(num, depth) {
  const i = byNum[num];
  if (i == null) return;
  const s = sections[i];
  idx.push('  '.repeat(depth - 1) + '- [[' + s.fname + '|' + s.rawNum + ' ' + s.title + ']]');
  for (const j of childIdxs(num)) emit(sections[j].num, depth + 1);
}
for (const s of sections) if (!s.num.includes('.')) emit(s.num, 1);
fs.writeFileSync(outDir + '/' + idxName + '.md', idx.join('\n') + '\n');

for (const [src, out] of mediaToOut) fs.copyFileSync('dx/word/media/' + src, outDir + '/img/' + out);
console.log('done. files:', sections.length + 1, 'bytes:', totalBytes, 'images:', mediaToOut.size);
