import mupdf from 'mupdf';
import fs from 'fs';
import path from 'path';

const doc = mupdf.Document.openDocument('doc.pdf', '');
const N = 20;
const stats = [];

for (let i = 0; i < N; i++) {
  const page = doc.loadPage(i);
  const st = page.toStructuredText();
  const j = JSON.parse(st.asJSON());
  const lines = j.blocks.flatMap(b => b.lines || []);
  // images
  const imgs = [];
  const dev = new mupdf.Device({
    fillImage: (image, ctm) => {
      const [a, b, c, d, e, f] = ctm;
      // device space: y down, unit square (0,0) top-left -> (1,1) bottom-right
      const x = e, yTop = f, dx = Math.abs(a), dy = Math.abs(d);
      imgs.push({ w: image.getWidth(), h: image.getHeight(), dx, dy, x, yTop });
    },
  });
  page.run(dev, [1, 0, 0, 1, 0, 0]);
  stats.push({ page: i + 1, lines: lines.length, imgs: imgs.length, imgDetail: imgs.filter(im => im.dx > 15 && im.dy > 15).map(im => `${Math.round(im.dx)}x${Math.round(im.dy)} @${Math.round(im.x)},${Math.round(im.yTop)}`).join(' ') });
}
for (const s of stats) console.log(`p${s.page}: ${s.lines} lines, ${s.imgs} imgs :: ${s.imgDetail}`);

// show TOC-ish text of page 2
const p2 = JSON.parse(doc.loadPage(1).toStructuredText().asJSON());
const t2 = p2.blocks.flatMap(b => (b.lines || []).map(l => l.text)).join('\n');
console.log('=== page 2 text (first 60 lines) ===');
console.log(t2.split('\n').slice(0, 60).join('\n'));
