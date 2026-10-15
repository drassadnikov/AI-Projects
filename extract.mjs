import mupdf from 'mupdf';
import fs from 'fs';
import crypto from 'crypto';

const doc = mupdf.Document.openDocument('doc.pdf', '');
const N = doc.countPages();
fs.mkdirSync('out/img', { recursive: true });

const imgMeta = [];
const imgCache = new Map();
const pages = [];
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const page = doc.loadPage(i);
  const st = page.toStructuredText();
  const j = JSON.parse(st.asJSON());
  st.destroy();
  const lines = [];
  for (const b of j.blocks) {
    if (b.type !== 'text') continue;
    for (const l of b.lines || []) {
      lines.push({
        t: l.text,
        x: Math.round(l.x),
        y: Math.round(l.y),
        w: Math.round(l.bbox ? l.bbox.w : 0),
        s: +(l.font ? l.font.size : 0),
        b: /bold/i.test(l.font ? l.font.name || '' : ''),
      });
    }
  }
  lines.sort((a, c) => a.y - c.y || a.x - c.x);
  pages.push({ label: page.getLabel() || '', lines });

  const found = [];
  const dev = new mupdf.Device({
    fillImage: (image, ctm) => {
      found.push({ image, x: ctm[4], y: ctm[5], w: Math.abs(ctm[0]), h: Math.abs(ctm[3]) });
    },
  });
  page.run(dev, [1, 0, 0, 1, 0, 0]);
  for (const im of found) {
    const pm = im.image.toPixmap();
    const png = Buffer.from(pm.asPNG());
    pm.destroy();
    const hash = crypto.createHash('md5').update(png).digest('hex').slice(0, 10);
    const file = `img_${hash}.png`;
    if (!imgCache.has(hash)) {
      fs.writeFileSync('out/img/' + file, png);
      imgCache.set(hash, file);
    }
    im.image.destroy();
    imgMeta.push({
      page: i + 1,
      file,
      x: Math.round(im.x),
      y: Math.round(im.y),
      w: Math.round(im.w),
      h: Math.round(im.h),
    });
  }
  dev.destroy();
  page.destroy();
  if (i % 100 === 0) console.log(`page ${i}/${N}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

fs.writeFileSync('out/pages.json', JSON.stringify(pages));
fs.writeFileSync('out/imgmeta.json', JSON.stringify(imgMeta, null, 1));
console.log('DONE', N, 'pages; unique images:', imgCache.size, '; total image refs:', imgMeta.length);
console.log('labels:', JSON.stringify([...new Set(pages.map(p => p.label))].slice(0, 30)));
