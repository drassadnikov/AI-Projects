const fs = require('fs');
const net = String.fromCharCode(92, 92) + '192.168.1.1' + String.fromCharCode(92) + 'backup' + String.fromCharCode(92) + 'Obsidian' + String.fromCharCode(92) + 'Obsidian';
try {
  const all = fs.readdirSync(net);
  console.log('NET OK:', all.join(' | '));
  const vtb = net + String.fromCharCode(92) + 'VTB';
  if (all.includes('VTB')) {
    console.log('VTB:', fs.readdirSync(vtb).join(' | '));
    const sub = vtb + String.fromCharCode(92) + 'Trebovaniia k IS 3704_3 Elektronnyi koshelek v kanale Partnera';
    if (fs.existsSync(sub)) {
      const s = fs.readdirSync(sub);
      console.log('SUB count:', s.length);
    }
  }
} catch (e) {
  console.log('NET ERR:', e.message);
}
