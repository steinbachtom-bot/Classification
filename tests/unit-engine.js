// Tests für den Motor (src/engine.js): node tests/unit-engine.js
//   --snapshot alt.json      Verhalten mit einem früheren Stand vergleichen (auch ENGINE_SNAPSHOT=alt.json)
//   --snapshot-neu neu.json  aktuellen Stand als Snapshot speichern (vor einem Umbau)
// Alle Testtexte sind erfunden.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8') +
  ';this.S=SYN;this.K=KLASSEN;this.A=ALT_LABELS;this.ABK=ABK;this.B=BEISPIELE;', ctx);
const E = require(path.join(ROOT, 'src/engine.js'));
E.build(ctx.S, ctx.K, ctx.A, ctx.ABK, ctx.B);
const rd = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const args = process.argv.slice(2), arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

let ok = 0; const failures = [];
function test(name, fn) {
  try { fn(); ok++; } catch (e) { failures.push(name); console.log(`FEHLER ${name}: ${String(e.message).split('\n').slice(0, 6).join('\n   ')}`); }
}
const codes = r => r.map(x => x.c.code);
const first = v => Array.isArray(v) ? first(v[0]) : v;
// deterministischer Zufall
let seed = 12345;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rng() * a.length)];
function run(ctl, ms) { let n = 0; while (!ctl.step(ms)) n++; return n; }

// erfundene Testsätze -> {t, c} (erster erwarteter Code)
const SETS = ['cases.json', 'holdout.json', 'realistic_mails.json', 'realistic_notes.json', 'oldcases.json', 'multi.json'];
const base = SETS.flatMap(f => rd(f).map(x => ({ t: x[0], c: first(x[1]) })));
const LEARNED = [
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

// ------------------------------------------------------------------
// a) Verhalten unverändert (Snapshot)
// ------------------------------------------------------------------
function snapshot(texts, learned) {
  const snap = opts => texts.map(q => E.classify(q, opts).map(r => ({ c: r.c.code, s: +r.score.toFixed(9), rel: +r.rel.toFixed(9), byCode: r.byCode,
    l: r.learned ? { sim: +r.learned.sim.toFixed(9), t: r.learned.text, base: r.learned.base } : null, m: r.matched })));
  E.setExamples([]);
  const out = { texts, learned, plain: snap(), debug10: snap({ max: 10, rel: 0.01, minAbs: 0.1 }) };
  E.setExamples(learned);
  out.withLearned = snap();
  out.withLearnedDebug10 = snap({ max: 10, rel: 0.01, minAbs: 0.1 });
  E.setExamples([]);
  out.prepare = texts.map(q => E.prepare(q));
  out.learnable = texts.map(q => E.learnable(q));
  return out;
}
const writeSnap = arg('--snapshot-neu');
if (writeSnap) {
  const texts = ['cases.json', 'holdout.json', 'realistic_mails.json', 'realistic_notes.json', 'multi.json', 'oldcases.json'].flatMap(f => rd(f).map(x => x[0]))
    .concat(['50410', 'Kd. hat FB n. erh.', 'Kann ich mein Fotobuch digital bekommen?', 'Wie ist der Stand meiner Reklamation? Wurde der Ersatz schon produziert?', '', 'x', 'Guten Tag\n\nFreundliche Grüsse']);
  fs.writeFileSync(writeSnap, JSON.stringify(snapshot(texts, LEARNED)));
  console.log('Snapshot gespeichert:', writeSnap);
}
const snapFile = arg('--snapshot') || process.env.ENGINE_SNAPSHOT;
if (!snapFile || !fs.existsSync(snapFile)) {
  console.log(`Hinweis: Snapshot-Vergleich übersprungen (${snapFile ? 'Datei fehlt: ' + snapFile : 'kein --snapshot / ENGINE_SNAPSHOT angegeben'})`);
} else {
  const A = JSON.parse(fs.readFileSync(snapFile, 'utf8')), B = snapshot(A.texts, A.learned);
  let maxRel = 0, nRes = 0;
  const near = (x, y, what) => {
    const d = Math.abs(x - y), m = Math.max(Math.abs(x), Math.abs(y));
    if (d) maxRel = Math.max(maxRel, d / m);
    // 1e-9 relativ, plus eine Rundungsstelle von toFixed(9)
    assert.ok(d <= 1e-9 * m + 1.01e-9, `${what}: ${x} statt ${y}`);
  };
  ['plain', 'debug10', 'withLearned', 'withLearnedDebug10'].forEach(k => test('Snapshot ' + k, () => {
    A[k].forEach((ra, i) => {
      const rb = B[k][i], w = `${k}[${i}] ${JSON.stringify(A.texts[i]).slice(0, 50)}`;
      assert.deepStrictEqual(rb.map(r => r.c), ra.map(r => r.c), w + ' Codes/Reihenfolge');
      ra.forEach((x, j) => {
        const y = rb[j]; nRes++;
        assert.deepStrictEqual([y.byCode, y.m, !!y.l], [x.byCode, x.m, !!x.l], `${w} #${j} byCode/matched/learned`);
        near(y.s, x.s, `${w} #${j} score`); near(y.rel, x.rel, `${w} #${j} rel`);
        if (x.l) { assert.deepStrictEqual([y.l.t, y.l.base], [x.l.t, x.l.base], `${w} #${j} learned`); near(y.l.sim, x.l.sim, `${w} #${j} sim`); }
      });
    });
  }));
  test('Snapshot prepare/learnable', () => {
    assert.deepStrictEqual(B.prepare, A.prepare);
    assert.deepStrictEqual(B.learnable, A.learnable);
  });
  console.log(`Snapshot: ${A.texts.length} Texte, ${nRes} Vorschläge verglichen, grösste rel. Abweichung ${maxRel}`);
}

// ------------------------------------------------------------------
// b) Auswertung mit früheren Fällen
// ------------------------------------------------------------------
const PRE = ['Kd. meldet: ', 'Notiz: ', 'Kundin schreibt, ', 'Rückruf: ', 'Nachtrag: '];
const POST = ['', '', ' Bitte prüfen.', ' Dringend.', ' Wie besprochen.'];
const synth = [];
base.forEach((b, k) => {
  synth.push({ t: b.t, c: b.c });
  synth.push({ t: PRE[k % PRE.length] + b.t + POST[k % POST.length], c: b.c });   // leicht verändert
  if (k % 4 === 0) synth.push({ t: b.t, c: b.c });                                  // exaktes Duplikat
});
// eindeutiger Text, Code kommt sonst nirgends vor
const used = new Set(synth.map(x => x.c));
const lonely = E.classes.map(c => c.code).filter(c => !used.has(c));
const UNIQUE = { t: 'Kundin möchte wissen, ob die Glanzfolie auf dem Umschlag abwaschbar und kratzfest ist', c: lonely[0] };
synth.push(UNIQUE);
// erfundenes Wort, das in keiner Regel steht (für die Wortstatistik)
const LACK = lonely[2];
['Der Zauberlack auf dem Cover glänzt nicht gleichmässig', 'Zauberlack blättert nach einer Woche ab',
  'Kunde fragt, ob der Zauberlack auch für Kalender erhältlich ist', 'Beim Zauberlack sind Schlieren sichtbar',
  'Zauberlack riecht stark, Kundin ist unsicher', 'Zauberlack fehlt auf der Rückseite'].forEach(t => synth.push({ t, c: LACK }));
// nicht verwendbar
const BAD = [{ t: 'Paket nicht angekommen, Tracking zeigt nichts', c: '99999' }, { t: 'Rechnung doppelt erhalten', c: '' }, { t: 'Rechnung doppelt erhalten' },
  { t: 'x', c: '50410' }, { t: '', c: '50410' }, { t: 'Guten Tag\n\nFreundliche Grüsse', c: '50410' }, { c: '50410' }, null];
const cases = synth.concat(BAD);
const isUsable = x => !!(x && x.c != null && E.byCode.hasOwnProperty(String(x.c).trim()) && E.learnable(x.t == null ? '' : String(x.t)));
const usableIdx = cases.map((x, i) => isUsable(x) ? i : -1).filter(i => i >= 0);

E.setExamples([]);
const plain = cases.map(x => x && x.t ? codes(E.classify(x.t)) : null);   // Stand ohne gelernte Fälle
const probe = base.slice(0, 60).map(b => b.t).concat(['Kann ich mein Fotobuch digital bekommen?', 'Rabattcode für Studenten?']);
const full = () => JSON.stringify(probe.map(q => E.classify(q, { max: 10, rel: 0.01, minAbs: 0.1, debug: true }).map(r => [r.c.code, r.score, r.rel, r.learned, r.matched, r.hits])));
E.setExamples(LEARNED);
const before = full();

const ctl = E.evaluation(cases, { details: true });
const phases = [];
test('Auswertung in Etappen', () => {
  assert.strictEqual(ctl.result(), null);
  assert.strictEqual(ctl.step(0), false);                       // mindestens ein Schritt, dann Pause
  assert.deepStrictEqual(ctl.progress(), { phase: 'prepare', done: 1, total: cases.length });
  let last = null;
  while (!ctl.step(5)) {
    const p = ctl.progress();
    assert.ok(p.done <= p.total, JSON.stringify(p));
    if (p.phase !== last) { phases.push(p.phase); last = p.phase; }
  }
  const order = ['prepare', 'test', 'words'];
  phases.forEach((p, k) => assert.ok(order.indexOf(p) > (k ? order.indexOf(phases[k - 1]) : -1), phases.join(',')));
  assert.strictEqual(ctl.progress().phase, 'done');
  assert.strictEqual(ctl.step(10), true);
});
const R = ctl.result() || {}, D = R.details || [], byI = {};
D.forEach(d => { byI[d.i] = d; });

test('gelernte Fälle des Tools unverändert', () => {
  assert.strictEqual(full(), before);
  E.setExamples([]);
  assert.deepStrictEqual(cases.map(x => x && x.t ? codes(E.classify(x.t)) : null), plain);
  E.setExamples(LEARNED);
});
test('Auswertung unabhängig von gelernten Fällen des Tools', () => {
  E.setExamples([]);
  const c2 = E.evaluation(cases, { details: true }); c2.step();
  assert.deepStrictEqual(c2.result(), R);
  E.setExamples(LEARNED);
});
test('übersprungene Fälle gezählt', () => {
  const unknown = cases.filter(x => !(x && x.c != null && E.byCode.hasOwnProperty(String(x.c).trim()))).length;
  assert.deepStrictEqual(R.skipped, { unbekannterCode: unknown, zuWenigText: cases.length - unknown - usableIdx.length });
  assert.strictEqual(R.skipped.unbekannterCode, 4);
  assert.ok(R.skipped.zuWenigText >= 4);
  assert.strictEqual(R.total, cases.length);
  assert.strictEqual(R.usable, usableIdx.length);
  assert.strictEqual(R.tested, usableIdx.length);
  assert.strictEqual(R.sampleEvery, 1);
  assert.deepStrictEqual(D.map(d => d.i), usableIdx);
});
test('"regeln" = classify() ohne gelernte Fälle', () => {
  D.forEach(d => assert.deepStrictEqual(d.top.regeln, plain[d.i], `Fall ${d.i}: ${cases[d.i].t.slice(0, 60)}`));
});
test('Varianten gezählt', () => {
  assert.deepStrictEqual(R.variants.map(v => v.id), E.VARIANTS.map(v => v.id));
  assert.deepStrictEqual(R.variants.map(v => v.id), ['regeln', 'gelernt', 'max20', 'max80', 'top3_20', 'top3_40', 'top3_80', 'nurfaelle']);
  R.variants.forEach(v => {
    const t = D.map(d => d.top[v.id]);
    assert.deepStrictEqual([v.n, v.top1, v.top3, v.none],
      [D.length, D.filter((d, k) => t[k][0] === d.c).length, D.filter((d, k) => t[k].includes(d.c)).length, t.filter(x => !x.length).length], v.id);
    t.forEach(x => assert.ok(x.length <= 3));
  });
  const V = {}; R.variants.forEach(v => { V[v.id] = v; });
  // die leicht veränderte Kopie wird als ähnlicher Fall gefunden
  assert.ok(V.nurfaelle.top3 >= 0.8 * V.nurfaelle.n, JSON.stringify(V.nurfaelle));
  assert.ok(V.gelernt.top3 >= V.regeln.top3, JSON.stringify([V.gelernt, V.regeln]));
});
test('Leave-one-out: eigener Code nie aus dem Fall selbst', () => {
  const iu = cases.indexOf(UNIQUE);
  assert.ok(byI[iu], 'eindeutiger Fall getestet');
  assert.ok(!byI[iu].top.nurfaelle.includes(UNIQUE.c), JSON.stringify(byI[iu].top));
  // allgemein: Code nur einmal unter den verwendbaren Fällen -> "nurfaelle" kann ihn nicht liefern
  const n = {}; usableIdx.forEach(i => { n[cases[i].c] = (n[cases[i].c] || 0) + 1; });
  D.filter(d => n[d.c] === 1 && !ctx.B.some(b => b.c === d.c)).forEach(d => assert.ok(!d.top.nurfaelle.includes(d.c), `Fall ${d.i}`));
});
test('exakte Duplikate schliessen sich gegenseitig aus', () => {
  const T = 'Die Glanzfolie auf dem Umschlag löst sich an den Ecken ab und wirft Blasen';
  const code = lonely[1];
  const dup = [{ t: T, c: code }, { t: '  ' + T + ' !!', c: code }, { t: T.toUpperCase(), c: code }];   // gleicher bereinigter Text
  const c1 = E.evaluation(synth.concat(dup), { details: true }); c1.step();
  const d1 = c1.result().details.filter(d => d.i >= synth.length);
  assert.strictEqual(d1.length, 3);
  d1.forEach(d => assert.ok(!d.top.nurfaelle.includes(code), JSON.stringify(d.top.nurfaelle)));
  // Gegenprobe: leicht anderer Text zählt als ähnlicher Fall
  const c2 = E.evaluation(synth.concat([dup[0], { t: 'Kd. meldet: ' + T, c: code }]), { details: true }); c2.step();
  c2.result().details.filter(d => d.i >= synth.length).forEach(d => assert.strictEqual(d.top.nurfaelle[0], code, JSON.stringify(d.top.nurfaelle)));
});
test('Stichprobe bei mehr als maxTests Fällen', () => {
  const c3 = E.evaluation(cases, { maxTests: 40, details: true }); c3.step();
  const r = c3.result(), k = Math.ceil(usableIdx.length / 40);
  assert.strictEqual(r.sampleEvery, k);
  assert.strictEqual(r.usable, usableIdx.length);
  assert.deepStrictEqual(r.details.map(d => d.i), usableIdx.filter((i, j) => j % k === 0));
  assert.strictEqual(r.tested, r.details.length);
  assert.ok(r.tested <= 40);
  r.variants.forEach(v => assert.strictEqual(v.n, r.tested));
  // alle verwendbaren Fälle bleiben Nachbarn: gleiche Vorschläge wie ohne Stichprobe
  r.details.forEach(d => assert.deepStrictEqual(d.top, byI[d.i].top, `Fall ${d.i}`));
});
test('Bericht: pro Code, Verwechslungen, Auslöser, Fehlgriffe', () => {
  const pc = {};
  D.forEach(d => {
    const p = pc[d.c] || (pc[d.c] = { code: d.c, n: 0, regeln: { top1: 0, top3: 0 }, gelernt: { top1: 0, top3: 0 }, wrong: {} });
    p.n++;
    ['regeln', 'gelernt'].forEach(id => { if (d.top[id][0] === d.c) p[id].top1++; if (d.top[id].includes(d.c)) p[id].top3++; });
    const g = d.top.regeln[0];
    if (g && g !== d.c) p.wrong[g] = (p.wrong[g] || 0) + 1;   // ohne Vorschlag zählt nicht als Verwechslung
  });
  const exp = Object.values(pc).map(p => ({ ...p, wrong: Object.entries(p.wrong).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3) }))
    .sort((a, b) => b.n - a.n || (a.code < b.code ? -1 : 1));
  assert.deepStrictEqual(R.perCode, exp);
  ['regeln', 'gelernt'].forEach(id => {
    const m = {};
    D.forEach(d => { const g = d.top[id][0] || '-'; if (g !== d.c) { const k = d.c + ' ' + g; (m[k] = m[k] || { exp: d.c, got: g, n: 0 }).n++; } });
    const all = Object.values(m).sort((a, b) => b.n - a.n || (a.exp < b.exp ? -1 : a.exp > b.exp ? 1 : a.got < b.got ? -1 : 1));
    assert.deepStrictEqual(R.confusions[id], all.slice(0, 30), id);
  });
  assert.ok(R.triggers.length > 0 && R.triggers.length <= 40);
  R.triggers.forEach((t, k) => {
    assert.ok(t.rule && t.exp !== t.got && t.got !== '-' && t.n > 0, JSON.stringify(t));
    if (k) assert.ok(R.triggers[k - 1].n >= t.n);
  });
  assert.deepStrictEqual(R.errors, D.filter(d => !d.top.regeln.includes(d.c) || !d.top.gelernt.includes(d.c))
    .map(d => ({ i: d.i, c: d.c, regeln: d.top.regeln, gelernt: d.top.gelernt })));
});
test('Bericht: häufige Wörter je Code', () => {
  const minDocs = 5, docs = {}, dfAll = {}, n = {};
  const ok = w => w.length >= 4 && !/^\d+$/.test(w);
  usableIdx.forEach(i => {
    const c = cases[i].c, ws = new Set(E.norm(E.prepare(cases[i].t).text).split(' ').filter(ok));
    n[c] = (n[c] || 0) + 1;
    ws.forEach(w => { docs[c + ' ' + w] = (docs[c + ' ' + w] || 0) + 1; dfAll[w] = (dfAll[w] || 0) + 1; });
  });
  const codesExp = Object.keys(n).filter(c => n[c] >= minDocs).sort((a, b) => n[b] - n[a] || (a < b ? -1 : 1));
  assert.deepStrictEqual(R.words.map(x => x.code), codesExp);
  const hit = (p, w) => p.m === 'x' ? w === p.w : p.m === 'p' ? w.startsWith(p.w) : w.includes(p.w);
  let known = 0;
  R.words.forEach(x => {
    assert.strictEqual(x.n, n[x.code]);
    assert.ok(x.words.length <= 15);
    const parts = E.byCode[x.code].rules.flatMap(r => r.terms.flatMap(t => t.matchers.flatMap(l => l.parts)));
    let prev = null;
    x.words.forEach(([w, d, inRules]) => {
      assert.strictEqual(d, docs[x.code + ' ' + w], `${x.code} ${w}`);
      assert.ok(d >= minDocs && ok(w));
      assert.strictEqual(inRules, parts.some(p => hit(p, w)), `${x.code} ${w} inRules`);
      const lift = (d / x.n) / (dfAll[w] / usableIdx.length);
      if (prev) assert.ok(prev.lift > lift || (prev.lift === lift && prev.d >= d), `${x.code} Reihenfolge ${w}`);
      prev = { lift, d };
      if (inRules) known++;
    });
  });
  assert.ok(known > 0, 'Wörter aus den Regeln erkannt');
  const lack = R.words.find(x => x.code === LACK);
  assert.ok(lack && lack.n === 6, JSON.stringify(lack));
  assert.deepStrictEqual(lack.words[0], ['zauberlack', 6, false]);
  // Füllwörter und Wörter aus der Liste der allgemeinen Wörter fehlen
  R.words.forEach(x => x.words.forEach(([w]) => assert.ok(!['kunde', 'bestellung', 'nicht', 'bitte', 'fotobuch'].includes(w), w)));
});
E.setExamples([]);

// ------------------------------------------------------------------
// c) Geschwindigkeit
// ------------------------------------------------------------------
const vocab = base.flatMap(b => b.t.split(/\s+/)).filter(w => w.length > 3);
function fake(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const b = pick(base), start = Math.floor(rng() * 20);
    out.push({ t: [pick(PRE), pick(vocab), b.t.slice(start, start + 60 + Math.floor(rng() * 200)), pick(vocab), rng() < 0.3 ? pick(base).t.slice(0, 40) : ''].join(' '), c: b.c });
  }
  return out;
}
test('Geschwindigkeit: classify() mit 5000 gelernten Fällen', () => {
  const ex = fake(5000);
  let t0 = Date.now();
  const n = E.setExamples(ex);
  const tIdx = Date.now() - t0;
  const qs = base.map(b => b.t);
  qs.slice(0, 20).forEach(q => E.classify(q));   // aufwärmen
  t0 = Date.now();
  qs.forEach(q => E.classify(q));
  const ms = (Date.now() - t0) / qs.length;
  console.log(`classify() mit ${n} gelernten Fällen: ${ms.toFixed(2)} ms pro Aufruf (Index ${tIdx} ms)`);
  assert.ok(ms < 20, ms + ' ms');
  E.setExamples([]);
});
test('Geschwindigkeit: Auswertung von 2000 Fällen', () => {
  const cs = fake(2000);
  const t0 = Date.now(), c = E.evaluation(cs), steps = run(c, 40), r = c.result();
  console.log(`Auswertung von ${cs.length} Fällen: ${((Date.now() - t0) / 1000).toFixed(1)} s (${r.tested} getestet, ${steps + 1} Etappen à 40 ms)`);
  assert.strictEqual(r.tested, r.usable);
  assert.ok(r.usable > 1900);
});

if (failures.length) { console.log(`\n${failures.length} Test(s) fehlgeschlagen: ${failures.join(', ')}`); process.exit(1); }
console.log(`Engine: ${ok} Tests OK`);
