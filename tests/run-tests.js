// Alle Tests: node tests/run-tests.js   (mit -v: Fehlgriffe anzeigen)
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8') +
  ';this.S=SYN;this.K=KLASSEN;this.A=ALT_LABELS;this.ABK=ABK;this.B=BEISPIELE;', ctx);
const E = require(path.join(ROOT, 'src/engine.js'));
const built = E.build(ctx.S, ctx.K, ctx.A, ctx.ABK, ctx.B);
if (built.errors.length) console.log('FEHLER in data.js:', built.errors);
const rd = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const verbose = process.argv.includes('-v');

function evalSet(name, cases) {
  let t1 = 0, t3 = 0, fp = 0; const out = [];
  for (const [q, exp, not] of cases) {
    const r = E.classify(q).map(x => x.c.code);
    if (exp.includes(r[0])) t1++;
    if (r.some(c => exp.includes(c))) t3++;
    else out.push(`   MISS   ${q.replace(/\n/g, ' / ').slice(0, 80)} -> ${r.join(',') || '-'} (erwartet ${exp.join('/')})`);
    if (not && r.some(c => not.includes(c))) { fp++; out.push(`   FALSCH ${q.slice(0, 80)} -> ${r.join(',')}`); }
  }
  console.log(`${name.padEnd(30)} Top1 ${String(t1).padStart(3)}/${cases.length}   Top3 ${String(t3).padStart(3)}/${cases.length}${fp ? '   Fehltreffer ' + fp : ''}`);
  if (verbose) out.forEach(l => console.log(l));
}

const sets = [
  ['erfundene Sätze', rd('cases.json')],
  ['erfundene Sätze (2. Satz)', rd('holdout.json')],
  ['erfundene Kundenmails', rd('realistic_mails.json')],
  ['erfundene Notizen', rd('realistic_notes.json')],
  ['Kurztests', rd('oldcases.json').map(([q, c]) => [q, [c]])],
];
if (fs.existsSync(path.join(__dirname, 'real_cases.json'))) sets.unshift(['ECHTE FÄLLE', rd('real_cases.json')]);
sets.forEach(([n, c]) => evalSet(n, c));

let mOk = 0, mN = 0;
for (const [q, groups] of rd('multi.json')) {
  const r = E.classify(q).map(x => x.c.code);
  for (const g of groups) { mN++; if (r.some(c => g.includes(c))) mOk++; }
}
console.log(`${'mehrere Probleme im Text'.padEnd(30)} ${mOk}/${mN} Probleme abgedeckt`);

// Lernen: simulierte gelernte Fälle dürfen andere Fälle nicht kapern
const learned = [
  ['Kunde möchte eine PDF-Version seines Fotobuchs', '30501'],
  ['Kundin fragt, ob sie ihr Fotobuch auch digital als Datei bekommen kann', '30501'],
  ['Kunde hat Paket retourniert, möchte Ersatz', '50704'],
  ['Kd. ruft an wegen Status der Reklamation, Ersatz noch nicht produziert', '50414'],
  ['Kunde möchte Musterbuch / Papiermuster bestellen', '50503'],
  ['Kunde beschwert sich über lange Wartezeit am Telefon', '50306'],
  ['Guten Tag, ich möchte gerne wissen ob Sie auch Fotobücher in Leinen anbieten. Freundliche Grüsse', '50503'],
  ['FB Hochzeit: Kunde will Buch mit anderem Cover nachbestellen', '50405'],
  ['Kunde fragt nach Rabattcode für Studenten', '50610'],
  ['Kunde will Rechnung auf Firma statt Privat', '50103'],
].map(([t, c]) => ({ t: E.learnable(t) || t, c }));
const all = sets.filter(s => s[0] !== 'ECHTE FÄLLE').flatMap(s => s[1]);
const before = all.filter(([q, exp]) => exp.includes((E.classify(q)[0] || { c: {} }).c.code)).length;
E.setExamples(learned);
const after = all.filter(([q, exp]) => exp.includes((E.classify(q)[0] || { c: {} }).c.code)).length;
const similar = [['Kann ich mein Fotobuch digital bekommen?', '30501'], ['Wie ist der Stand meiner Reklamation? Wurde der Ersatz schon produziert?', '50414']];
const learnedHits = similar.filter(([q, c]) => (E.classify(q)[0] || { c: {} }).c.code === c).length;
console.log(`${'Lernen'.padEnd(30)} ähnliche Fälle erkannt ${learnedHits}/${similar.length}, Top1 ohne/mit Gelerntem ${before}/${after} (von ${all.length})`);
E.setExamples([]);
