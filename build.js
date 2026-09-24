// Baut die fertige Datei: node build.js  ->  dist/Fall-Klassifizierung_DE.html
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const eng = src('engine.js').replace(/\nif \(typeof module[^\n]*\n?/, '\n');
const html = src('template.html')
  .replace('/*__DATA__*/', () => src('data.js'))
  .replace('/*__ENGINE__*/', () => eng);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const out = path.join(__dirname, 'dist', 'Fall-Klassifizierung_DE.html');
fs.writeFileSync(out, html);
console.log('OK', out, Math.round(html.length / 1024) + ' KB');
