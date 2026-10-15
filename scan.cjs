const fs = require('fs');
const xml = fs.readFileSync('dx/word/document.xml', 'utf8');
console.log('xml length:', xml.length);
const tbl = (xml.match(/<w:tbl>/g) || []).length;
const pCount = (xml.match(/<w:p [^>]*>|<w:p>/g) || []).length;
console.log('tables:', tbl, ' paragraphs:', pCount);

// styles used
const styles = {};
for (const m of xml.matchAll(/<w:pStyle w:val="([^"]+)"/g)) styles[m[1]] = (styles[m[1]] || 0) + 1;
console.log('styles:', JSON.stringify(styles));

// TOC field?
const tocFields = (xml.match(/TOC \\\w+/g) || []);
console.log('TOC fields:', tocFields.slice(0, 5));
const tocHyper = (xml.match(/_Toc[0-9A-F]+/g) || []).length;
console.log('_Toc refs:', tocHyper);

// find "Содержание"
const i = xml.indexOf('Содержание');
console.log('"Содержание" at:', i);
// text around first heading-ish content: extract first 10 w:t texts
const texts = [];
for (const m of xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
  texts.push(m[1]);
  if (texts.length >= 25) break;
}
console.log('first texts:', texts.join(' ␞ '));

// sectPr count (page breaks / sections)
console.log('sectPr:', (xml.match(/<w:sectPr/g) || []).length);
console.log('page breaks (w:br type=page):', (xml.match(/type="page"/g) || []).length);
