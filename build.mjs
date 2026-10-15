import fs from 'fs';

const pages = JSON.parse(fs.readFileSync('out/pages.json', 'utf8'));
const imgMeta = JSON.parse(fs.readFileSync('out/imgmeta.json', 'utf8'));
const N = pages.length;
const norm = (s) => s.replace(/\s+/g, ' ').trim();

// ---------- 1. Parse TOC (PDF pages 2..13 = indexes 1..12) ----------
const startRe = /^(\d+(?:\.\d+)*)(?:\.)?\s+(.*)$/;
const leaderRe = /\.(\s*\.)+\s*(\d{1,4})\s*$/;
const segOK = (num) => num.split('.').every(s => s.length >= 1 && s.length <= 2);

const tocLines = [];
for (let pi = 1; pi <= 12; pi++) {
  for (const line of pages[pi].lines) {
    if (line.y <= 780) tocLines.push({ t: line.t, b: line.b });
  }
}
const entries = [];
let cur = null;
let lastPageSeen = 14;
function tryFallbackPage(s, nextIsStart) {
  const mf = s.match(/^(.*?)(\d{2,4})$/);
  if (!mf || !nextIsStart) return null;
  const pg = +mf[2];
  if (pg > N || pg < lastPageSeen) return null;
  return { text: mf[1].replace(/[\s.]+$/, ''), page: pg };
}
for (let k = 0; k < tocLines.length; k++) {
  const L = tocLines[k];
  const ms = L.t.match(startRe);
  const isStart = ms && segOK(ms[1]);
  if (isStart) {
    const rest = ms[2].trim();
    const ml = rest.match(leaderRe);
    const next = tocLines[k + 1];
    const nextIsStart = next && nextIsEntryStart(next.t);
    if (ml) {
      const textPart = rest.slice(0, ml.index).trim();
      if (cur) entries.push({ ...cur, page: null });
      entries.push({ num: ms[1], title: textPart, page: +ml[2], bold: L.b });
      lastPageSeen = Math.max(lastPageSeen, +ml[2]);
    } else {
      const fb = tryFallbackPage(rest, nextIsStart);
      if (fb) {
        if (cur) entries.push({ ...cur, page: null });
        entries.push({ num: ms[1], title: fb.text, page: fb.page, bold: L.b });
        lastPageSeen = Math.max(lastPageSeen, fb.page);
      } else {
        if (cur) entries.push({ ...cur, page: null });
        cur = { num: ms[1], title: rest, page: null, bold: L.b };
      }
    }
  } else if (cur) {
    const ml = L.t.match(leaderRe);
    const next = tocLines[k + 1];
    const nextIsStart = next && nextIsEntryStart(next.t);
    if (ml) {
      cur.title += ' ' + L.t.slice(0, ml.index).trim();
      cur.page = +ml[2];
      entries.push({ ...cur });
      lastPageSeen = Math.max(lastPageSeen, +ml[2]);
      cur = null;
    } else {
      const fb = tryFallbackPage(L.t, nextIsStart);
      if (fb) {
        cur.title += ' ' + fb.text;
        cur.page = fb.page;
        entries.push({ ...cur });
        lastPageSeen = Math.max(lastPageSeen, fb.page);
        cur = null;
      } else {
        cur.title += ' ' + L.t.trim();
      }
    }
  }
}
if (cur) entries.push({ ...cur, page: null });

function nextIsEntryStart(t) {
  const m = t.match(startRe);
  return !!(m && segOK(m[1]));
}
for (const e of entries) e.title = norm(e.title);
console.log('TOC entries:', entries.length);

// monotonicity check
for (let i = 1; i < entries.length; i++) {
  if (entries[i].page != null && entries[i - 1].page != null && entries[i].page < entries[i - 1].page) {
    console.log('MONO VIOLATION at', i, entries[i - 1].num, entries[i].num, entries[i - 1].page, '->', entries[i].page);
    entries[i].page = entries[i - 1].page;
  }
}
const noPage = entries.filter(e => e.page == null).map(e => e.num);
console.log('entries without page:', noPage.length, noPage.slice(0, 10).join(', '));
// fill missing pages: previous known page
let lastPg = 14;
for (const e of entries) {
  if (e.page == null) e.page = lastPg;
  else lastPg = Math.max(lastPg, e.page);
}

// ---------- 2. Locate headings in body ----------
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const pi = e.page - 1;
  const key = norm(e.title).slice(0, Math.max(15, Math.min(30, norm(e.title).length)));
  let found = null;
  for (let li = 0; li < pages[pi].lines.length; li++) {
    const t = norm(pages[pi].lines[li].t);
    if (t.includes(key)) { found = { pi, li, y: pages[pi].lines[li].y }; break; }
  }
  if (!found) {
    // fallback: line whose text starts with the number (allowing trailing dot differences)
    const numKey = e.num.replace(/\.?$/, '');
    for (let li = 0; li < pages[pi].lines.length; li++) {
      const t = norm(pages[pi].lines[li].t);
      if (t.startsWith(numKey + ' ') || t.startsWith(numKey + '.')) { found = { pi, li, y: pages[pi].lines[li].y }; break; }
    }
  }
  if (found) e.bound = found;
  else e.bound = { pi, li: 0, y: pages[pi].lines[0].y, fallback: true };
}
const fb = entries.filter(e => e.bound.fallback).map(e => e.num);
console.log('heading fallbacks:', fb.length, fb.slice(0, 10).join(', '));

// ---------- 3. Partition lines per entry ----------
// flatten bounds: entry i covers [bound_i, bound_{i+1}) in (page, line) space
const lastEntry = entries.length - 1;
const endBound = { pi: N - 1, li: pages[N - 1].lines.length };
const ranges = entries.map((e, i) => ({ start: e.bound, end: i < lastEntry ? entries[i + 1].bound : endBound }));

// ---------- 4. Build markdown ----------
const idxName = 'Trebovaniia k IS 3704_3 Elektronnyi koshelek v kanale Partnera';
const sanitize = (s) =>
  s.replace(/[\/\\:*?"<>|#^\[\]{}]/g, ' ')
    .replace(/([а-яА-Яa-z0-9])-\s+/g, '$1-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 90);

// direct children map
const children = {};
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const parts = e.num.split('.');
  let p = e;
  while (parts.length > 1) {
    parts.pop();
    p = entries.find(x => x.num === parts.join('.'));
    if (!p) break;
    (children[p.num] = children[p.num] || []).push(i);
  }
}
// pre-compute file names (children always come after parents in doc order)
for (let i = 0; i < entries.length; i++) {
  entries[i].fname = `${String(i + 1).padStart(3, '0')}_${sanitize(entries[i].title)}.md`;
}
const files = [];
function pageSpan(r) { return [r.start.pi + 1, r.end.pi + 1]; }

function renderLines(lines, yFrom, yTo) {
  // lines: array of {t,x,y,s,b}
  const sel = lines.filter(l => l.y <= 780 && l.y >= yFrom && l.y < yTo);
  sel.sort((a, c) => a.y - c.y || a.x - c.x);
  // group into visual rows
  const rows = [];
  for (const l of sel) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(l.y - lastRow.y) <= Math.max(4, (l.s || 10) * 0.55)) {
      lastRow.cells.push(l);
      lastRow.gap = Math.max(lastRow.gap, l.x - lastRow.lastX);
    } else {
      rows.push({ y: l.y, cells: [l], lastX: l.x, gap: 0 });
    }
  }
  const out = [];
  let prevY = 0;
  for (const r of rows) {
    if (prevY && r.y - prevY > 22) out.push('');
    const cells = r.cells.map(c => c.t.trim()).filter(Boolean);
    if (!cells.length) continue;
    let text = cells.join('  |  ');
    const allBold = r.cells.every(c => c.b);
    if (allBold && text.length < 120) text = `**${text}**`;
    if (/^[#>\-*|`]/.test(text)) text = ' ' + text;
    out.push(text);
    prevY = r.y;
  }
  return out;
}

for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const r = ranges[i];
  const seq = String(i + 1).padStart(3, '0');
  const fname = `${seq}_${sanitize(e.title)}${i === lastEntry && r.end.pi === N - 1 ? '' : ''}.md`;
  e.fname = fname;
  const depth = e.num.split('.').length;
  const hlevel = Math.min(6, depth);

  // content
  const blocks = [];
  const [p1, p2] = pageSpan(r);
  blocks.push(`# ${'#'.repeat(Math.min(6, hlevel)) === '#' ? '' : ''}${e.num} ${e.title}`);
  const nav = [`> PDF стр. ${p1}–${p2}`, `[[${idxName}|← Содержание]]`];
  const parentNum = e.num.split('.').slice(0, -1).join('.');
  const parent = parentNum ? entries.find(x => x.num === parentNum) : null;
  if (parent && parent.fname) nav.push(`[[${parent.fname}|Родитель: ${parent.num}]]`);
  blocks.push(nav.join(' · '));
  blocks.push('');

  // iterate pages of the range
  const startPage = r.start.pi;
  const endPage = r.end.pi;
  const yFrom = r.start.li >= 0 ? pages[startPage].lines[r.start.li].y : 0;
  const yEnd = endPage > startPage ? 1e9 : (r.end.li < pages[endPage].lines.length ? pages[endPage].lines[r.end.li].y : 1e9);
  // render page by page, inserting images after each page block
  let content = [];
  for (let pi = startPage; pi <= endPage; pi++) {
    const part = renderLines(pages[pi].lines, pi === startPage ? yFrom : 0, pi === endPage ? yEnd : 1e9, pi === endPage);
    if (pi === startPage && part.length) {
      const hIdx = part.findIndex(t => norm(t).replace(/^\*\*|\*\*$/g, '').includes(norm(e.title).slice(0, 25)));
      if (hIdx >= 0 && hIdx <= 2) part.splice(hIdx, 1);
    }
    const pageImgs = imgMeta.filter(im => im.page === pi + 1 && (pi > startPage || im.y >= yFrom - 5) && (pi < endPage || im.y < yEnd + 5));
    for (const t of part) content.push(t);
    for (const im of pageImgs) content.push(`![[img/${im.file}]]`);
  }
  // drop leading empty lines, collapse 3+ blanks
  content = content.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  blocks.push(content || '_(раздел не содержит текстового содержимого)_');
  // children
  const ch = (children[e.num] || []).map(j => entries[j]);
  if (ch.length) {
    blocks.push('');
    blocks.push(`**Подразделы:** ${ch.map(c => `[[${c.fname}|${c.num}]]`).join(' · ')}`);
  }
  files.push({ name: fname, content: blocks.join('\n') + '\n' });
}

// ---------- 5. Index ----------
const idxLines = [];
idxLines.push(`# ${idxName}`);
idxLines.push('');
idxLines.push('> Требования к ИС · БАНК ВТБ (ПАО) · Система/Подсистема 3704_3 «Электронный кошелёк в канале Партнёра»');
idxLines.push('> Исходный файл: PDF, 1344 стр. (контент стр. 14–1344), код АППД: 2026');
idxLines.push('');
// cover page content (page 1)
const cover = pages[0].lines.map(l => l.t.trim()).filter(Boolean);
idxLines.push(cover.join('\n'));
idxLines.push('');
idxLines.push('## Содержание');
idxLines.push('');
const byNum = {};
entries.forEach((e, i) => { byNum[e.num] = i; });
function childIdxs(num) {
  const res = [];
  for (let i = 0; i < entries.length; i++) {
    const p = entries[i].num.split('.');
    if (p.length === num.split('.').length + 1 && p.slice(0, -1).join('.') === num) res.push(i);
  }
  return res;
}
function emitLevel(num, depth) {
  const i = byNum[num];
  if (i == null) return;
  const e = entries[i];
  const indent = '  '.repeat(depth - 1);
  idxLines.push(`${indent}- [[${e.fname}|${e.num} ${e.title}]] — стр. ${e.page}`);
  for (const j of childIdxs(num)) emitLevel(entries[j].num, depth + 1);
}
entries.filter(e => e.num.indexOf('.') === -1).forEach(e => emitLevel(e.num, 1));
files.push({ name: `${idxName}.md`, content: idxLines.join('\n') + '\n' });

// ---------- 6. Write ----------
fs.mkdirSync('out/convert', { recursive: true });
for (const f of files) fs.writeFileSync('out/convert/' + f.name, f.content);
fs.writeFileSync('out/convert/_manifest.json', JSON.stringify(entries.map(e => ({ num: e.num, title: e.title, page: e.page, file: e.fname, range: [ranges[entries.indexOf(e)].start.pi + 1, ranges[entries.indexOf(e)].end.pi + 1] })), null, 1));
console.log('files written:', files.length);
const totalBytes = files.reduce((a, f) => a + f.content.length, 0);
console.log('total md bytes:', totalBytes);
