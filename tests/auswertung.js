// Genauigkeit an einer Tabelle mit früheren Fällen messen (lokal, wie im Tool unter „Fälle importieren und testen“):
//   node tests/auswertung.js faelle.xlsx|faelle.csv|real_cases.json  [--text 2,3] [--code 4] [--kopf|--kein-kopf] [--bericht out.json] [-v]
// Spalten werden automatisch erkannt; --text/--code (Spaltennummern ab 1) übersteuern das.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8') +
  ';this.S=SYN;this.K=KLASSEN;this.A=ALT_LABELS;this.ABK=ABK;this.B=BEISPIELE;', ctx);
const E = require(path.join(ROOT, 'src/engine.js'));
const T = require(path.join(ROOT, 'src/table.js'));
E.build(ctx.S, ctx.K, ctx.A, ctx.ABK, ctx.B);

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const file = args.find((a, i) => !a.startsWith('-') && !['--text', '--code', '--bericht'].includes(args[i - 1]));
if (!file) { console.log('Aufruf: node tests/auswertung.js <datei.xlsx|.csv|.json> [--text 2,3] [--code 4] [--kopf|--kein-kopf] [--bericht out.json] [-v]'); process.exit(1); }
const pc = (a, n) => n ? (100 * a / n).toFixed(0).padStart(3) + ' %' : '   –';
const label = c => (E.byCode[c] ? E.byCode[c].label : '').slice(0, 38);

(async () => {
  let cases, info;
  if (/\.json$/i.test(file)) {
    // Format wie tests/real_cases.json: [["Text", ["Code", ...]], ...] (der erste Code zählt)
    cases = JSON.parse(fs.readFileSync(file, 'utf8')).map(x => ({ t: x[0], c: Array.isArray(x[1]) ? x[1][0] : x[1] }));
    info = `${cases.length} Fälle aus JSON`;
  } else {
    const res = await T.read(new Uint8Array(fs.readFileSync(file)), file);
    const resolve = T.codeResolver(E.classes);
    const cfg = T.guess(res.rows, resolve);
    if (opt('--text')) cfg.textCols = opt('--text').split(',').map(n => +n - 1);
    if (opt('--code')) cfg.codeCol = +opt('--code') - 1;
    if (args.includes('--kopf')) cfg.header = true;
    if (args.includes('--kein-kopf')) cfg.header = false;
    const tc = T.toCases(res.rows, cfg, resolve);
    const name = i => (cfg.header ? `${i + 1} „${String(res.rows[0][i]).slice(0, 25)}“` : `${i + 1}`);
    console.log(`Datei: ${file} (${res.format}${res.delimiter ? ', Trennzeichen ' + JSON.stringify(res.delimiter) : ''}${res.sheet ? ', Blatt „' + res.sheet + '“' : ''})`);
    console.log(`Spalten: Text = ${cfg.textCols.map(name).join(' + ') || '-'} · Klassifizierung = ${cfg.codeCol >= 0 ? name(cfg.codeCol) : '-'} · Kopfzeile: ${cfg.header ? 'ja' : 'nein'}`);
    console.log(`Zeilen ${tc.total} · Fälle ${tc.cases.length} · ohne Code ${tc.noCode} · ohne Text ${tc.noText}` +
      (tc.unknown.length ? ` · nicht erkannt: ${tc.unknown.slice(0, 5).map(u => `"${u[0]}" (${u[1]}×)`).join(', ')}` : ''));
    cases = tc.cases.map(x => ({ t: x.t, c: x.c }));
  }
  const t0 = Date.now();
  const ctl = E.evaluation(cases, { maxTests: Infinity, minDocs: 5 });
  const tty = process.stderr.isTTY;
  while (!ctl.step(2000)) { const p = ctl.progress(); if (tty) process.stderr.write(`\r${p.phase} ${p.done}/${p.total}   `); }
  if (tty) process.stderr.write('\r' + ' '.repeat(40) + '\r');
  const r = ctl.result();
  console.log(`\nGetestet ${r.tested} von ${r.usable} verwendbaren Fällen (übersprungen: ${JSON.stringify(r.skipped)}) in ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  console.log('Methode'.padEnd(58), 'Platz 1   Top 3   kein Vorschlag');
  r.variants.forEach(v => console.log(v.name.padEnd(58), pc(v.top1, v.n), ' ', pc(v.top3, v.n), '  ', pc(v.none, v.n)));
  console.log('\nHäufigste Verwechslungen (nur Stichwörter, Platz 1):');
  r.confusions.regeln.slice(0, 15).forEach(x => console.log(`  ${String(x.n).padStart(4)}×  ${x.exp} ${label(x.exp).padEnd(38)} -> ${x.got} ${label(x.got)}`));
  if (args.includes('-v')) {
    console.log('\nPro Klassifizierung (Stichwörter Top 3 / mit Fällen Top 3):');
    r.perCode.forEach(p => console.log(`  ${p.code.padEnd(6)} ${label(p.code).padEnd(38)} n=${String(p.n).padStart(4)}  ${pc(p.regeln.top3, p.n)}  ${pc(p.gelernt.top3, p.n)}`));
    console.log('\nAuslöser falscher Vorschläge (Regel -> Anzahl):');
    r.triggers.slice(0, 25).forEach(x => console.log(`  ${String(x.n).padStart(4)}×  ${x.exp} -> ${x.got}  ${x.rule}`));
    console.log('\nFehlgriffe (Stichwörter):');
    r.errors.filter(e => !e.regeln.includes(e.c)).slice(0, 40).forEach(e =>
      console.log(`  ${e.c} <- [${e.regeln.join(',')}] / mit Fällen [${e.gelernt.join(',')}]  ${cases[e.i].t.replace(/\s+/g, ' ').slice(0, 90)}`));
  }
  if (opt('--bericht')) { fs.writeFileSync(opt('--bericht'), JSON.stringify(r, null, 1)); console.log('\nBericht:', opt('--bericht')); }
})().catch(e => { console.error('Fehler:', e.message || e); process.exit(1); });
