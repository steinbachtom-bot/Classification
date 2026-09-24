// Messung an einem echten CRM-Export (Datei bleibt ausserhalb des Repos, siehe .gitignore):
//   node tests/echte-faelle.js export.csv [--split dev|test|all] [--cfg desc|title|both] [--learned] [-v] [--codes 50401,50403]
// Spalten wie im Dynamics-Export: "Betreff" = Klassifizierung ("50410 - Lieferverzögerung"), "Problem / Beschreibung" = Text,
// "Anfragetitel" = Titel (weggelassen, wenn er selbst eine Klassifizierung ist), "Erstellt am" = Datum.
// Aufteilung nach Datum: ältere 2/3 = dev (zum Verbessern der Stichwörter), neueste 1/3 = test (nur zum Prüfen, nie zum Anpassen).
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a, i) => !a.startsWith('-') && !['--split', '--cfg', '--codes'].includes(args[i - 1]));
if (!file) { console.log('Aufruf: node tests/echte-faelle.js export.csv [--split dev|test|all] [--cfg desc|title|both] [--learned] [-v]'); process.exit(1); }
const split = opt('--split', 'dev'), cfg = opt('--cfg', 'desc'), verbose = args.includes('-v'), learned = args.includes('--learned');
const onlyCodes = opt('--codes', '') ? opt('--codes').split(',') : null;
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8') + ';this.S=SYN;this.K=KLASSEN;this.A=ALT_LABELS;this.ABK=ABK;this.B=BEISPIELE;', ctx);
const E = require(path.join(ROOT, 'src/engine.js'));
const built = E.build(ctx.S, ctx.K, ctx.A, ctx.ABK, ctx.B);
if (built.errors.length) console.log('FEHLER data.js:', built.errors);
const T = require(path.join(ROOT, 'src/table.js'));
const resolve = T.codeResolver(E.classes);

(async () => {
  const rows = (await T.read(new Uint8Array(fs.readFileSync(file)), file)).rows;
  const H = rows[0].map(h => String(h).trim().toLowerCase());
  const col = re => H.findIndex(h => re.test(h));
  const cCode = col(/^betreff$/), cText = col(/beschreibung/), cTitle = col(/titel/), cDate = col(/erstellt/);
  if (cCode < 0 || cText < 0) { console.log('Spalten "Betreff" und "… Beschreibung" nicht gefunden:', rows[0].join(' | ')); process.exit(1); }
  const ts = s => { let m = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/.exec(s || ''); return m ? new Date(+m[3], m[2] - 1, +m[1], +m[4], +m[5]).getTime() : 0; };
  let all = rows.slice(1).map(r => ({ code: resolve(r[cCode]), text: String(r[cText] || '').trim(), title: cTitle >= 0 ? String(r[cTitle] || '').trim() : '', ts: cDate >= 0 ? ts(r[cDate]) : 0 }))
    .filter(c => c.code);
  all.sort((a, b) => a.ts - b.ts);
  const cut = Math.floor(all.length * 2 / 3);
  all.forEach((c, k) => { c.split = k < cut ? 'dev' : 'test'; });
  const textOf = c => {
    const title = resolve.label(c.title) ? '' : c.title;   // Titel, der selbst eine Klassifizierung ist, verrät die Lösung
    return cfg === 'desc' ? c.text : cfg === 'title' ? title : [title, c.text].filter(Boolean).join('\n');
  };
  const cases = all.filter(c => split === 'all' || c.split === split).map(c => Object.assign(c, { q: textOf(c) })).filter(c => c.q);
  const lab = c => (E.byCode[c] ? E.byCode[c].label : '?').slice(0, 34);
  const pc = (a, n) => (100 * a / n).toFixed(1) + '%';
  let t1 = 0, t3 = 0, none = 0; const conf = {}, per = {}, errs = [];
  cases.forEach(c => {
    const r = E.classify(c.q).map(x => x.c.code);
    const p = per[c.code] = per[c.code] || { n: 0, t1: 0, t3: 0 }; p.n++;
    if (r[0] === c.code) { t1++; p.t1++; }
    if (r.includes(c.code)) { t3++; p.t3++; } else errs.push({ c, r });
    if (!r.length) none++;
    if (r[0] !== c.code) { const k = c.code + ' -> ' + (r[0] || '-'); conf[k] = (conf[k] || 0) + 1; }
  });
  console.log(`[${split}/${cfg}] n=${cases.length}  Platz 1: ${t1} (${pc(t1, cases.length)})  unter den 3: ${t3} (${pc(t3, cases.length)})  kein Vorschlag: ${none} (${pc(none, cases.length)})`);
  if (learned) {
    const ctl = E.evaluation(cases.map(c => ({ t: c.q, c: c.code })), { maxTests: 1e9, minDocs: 5 });
    while (!ctl.step(5000)) {}
    const r = ctl.result();
    r.variants.forEach(v => console.log('   leave-one-out', v.id.padEnd(15), 'Platz 1', pc(v.top1, v.n), ' unter den 3', pc(v.top3, v.n)));
  }
  if (verbose) {
    if (split === 'test') console.log('\n(-v auf dem Test-Teil: nur ansehen, nicht danach anpassen – sonst misst der Test nichts mehr)');
    console.log('\nVerwechslungen (Platz 1):');
    Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, n]) => { const [a, b] = k.split(' -> '); console.log(`  ${String(n).padStart(3)}  ${a} ${lab(a)} -> ${b} ${b === '-' ? '' : lab(b)}`); });
    console.log('\nPro Code (n>=3):');
    Object.entries(per).filter(([, p]) => p.n >= 3).sort((a, b) => b[1].n - a[1].n)
      .forEach(([k, p]) => console.log(`  ${k.padEnd(6)} ${lab(k).padEnd(34)} n=${String(p.n).padStart(3)} P1 ${pc(p.t1, p.n).padStart(6)} T3 ${pc(p.t3, p.n).padStart(6)}`));
    console.log('\nFehlgriffe (richtige Klassifizierung nicht unter den 3):');
    errs.filter(e => !onlyCodes || onlyCodes.includes(e.c.code))
      .forEach(e => console.log(`  ${e.c.code} ${lab(e.c.code)} <- [${e.r.join(',')}]  «${e.c.q.replace(/\s+/g, ' ').slice(0, 160)}»`));
  }
})().catch(e => { console.error('Fehler:', e.message || e); process.exit(1); });
