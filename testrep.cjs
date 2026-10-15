const s = '{  "forceUpdate": false,  "productTypes": [    "MAGNIT_CARD_ACCOUNT"  ]  "subSystems": [    "OPENWAY_VTB"  ]}';
const rep = (c) => c.replace(/([\]\}])\s+(")\s*:/g, '$1, $2:');
console.log('rep:', rep(s));
try { console.log('parse rep OK'); } catch (e) { }
try { JSON.parse(rep(s)); console.log('parse: OK'); } catch (e) { console.log('parse FAIL:', e.message); }
