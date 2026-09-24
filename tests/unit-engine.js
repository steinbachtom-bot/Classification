// Tests für den Motor (src/engine.js): node tests/unit-engine.js
//   --snapshot alt.json      (optional) Verhalten mit einem früheren Stand vergleichen und Unterschiede je Text
//                            auflisten (auch ENGINE_SNAPSHOT=alt.json); ohne diese Angabe wird nichts verglichen
//   --snapshot-neu neu.json  aktuellen Stand als Snapshot speichern (vor einem Umbau)
// Alle Testtexte, Namen und Nummern sind erfunden.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8') +
  ';this.S=SYN;this.K=KLASSEN;this.A=ALT_LABELS;this.ABK=ABK;this.B=BEISPIELE;', ctx);
const E = require(path.join(ROOT, 'src/engine.js'));
E.build(ctx.S, ctx.K, ctx.A, ctx.ABK, ctx.B);
// eigene Instanz des Motors (z.B. mit anderen eingebauten Beispielen)
function engineWith(base) {
  const m = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(ROOT, 'src/engine.js'), 'utf8'))(m, m.exports);
  m.exports.build(ctx.S, ctx.K, ctx.A, ctx.ABK, base);
  return m.exports;
}
const rd = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const args = process.argv.slice(2), arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

let ok = 0; const failures = [];
function test(name, fn) {
  try { fn(); ok++; } catch (e) { failures.push(name); console.log(`FEHLER ${name}: ${String(e.message).split('\n').slice(0, 6).join('\n   ')}`); }
}
const codes = r => r.map(x => x.c.code);
// „Lieferung nicht erhalten“: in den echten Fällen meist 50401 (Auftragsstatus), sonst 516 (Untergang) – 50410 nur 1× von 791
const LIEF = ['50401', '516', '50410'];
const isCode = (c, want) => want === 'LIEF' ? LIEF.includes(c) : c === want;
const first = v => Array.isArray(v) ? first(v[0]) : v;
const hasWord = s => /[\p{L}\p{N}]/u.test(s);
// deterministischer Zufall
let seed = 12345;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rng() * a.length)];
function run(ctl, ms) { let n = 0; while (!ctl.step(ms)) n++; return n; }
function evalAll(eng, cases, opts) { const c = eng.evaluation(cases, Object.assign({ details: true }, opts || {})); c.step(); return c.result(); }

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
].map(([t, c]) => ({ t: E.learnText(t) || t, c }));

// ------------------------------------------------------------------
// a) Vergleich mit einem früheren Stand (Snapshot, optional)
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
if (!snapFile) {
  console.log('Hinweis: kein Snapshot-Vergleich (optional: --snapshot alt.json)');
} else {
  test('Snapshot: Datei vorhanden', () => assert.ok(fs.existsSync(snapFile), 'Datei fehlt: ' + snapFile));
  if (fs.existsSync(snapFile)) {
    const A = JSON.parse(fs.readFileSync(snapFile, 'utf8')), B = snapshot(A.texts, A.learned);
    // 1e-9 relativ, plus eine Rundungsstelle von toFixed(9)
    const near = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(Math.abs(x), Math.abs(y)) + 1.01e-9;
    const fmt = l => l.map(r => r.c + ':' + r.s.toFixed(2) + (r.l ? '[L' + r.l.sim.toFixed(2) + ']' : '')).join(' ') || '-';
    const same = (a, b) => a.length === b.length && a.every((x, j) => {
      const y = b[j];
      return x.c === y.c && x.byCode === y.byCode && JSON.stringify(x.m) === JSON.stringify(y.m) && near(x.s, y.s) && near(x.rel, y.rel) &&
        !!x.l === !!y.l && (!x.l || (x.l.t === y.l.t && x.l.base === y.l.base && near(x.l.sim, y.l.sim)));
    });
    const diffs = [];
    A.texts.forEach((t, i) => {
      const d = [];
      if (A.prepare[i].cleaned !== B.prepare[i].cleaned) d.push(`bereinigt: ${JSON.stringify(A.prepare[i].cleaned)} -> ${JSON.stringify(B.prepare[i].cleaned)}`);
      if (JSON.stringify(A.prepare[i].removed) !== JSON.stringify(B.prepare[i].removed)) d.push(`entfernt: ${A.prepare[i].removed.join(',')} -> ${B.prepare[i].removed.join(',')}`);
      if (JSON.stringify(A.prepare[i].abbreviations) !== JSON.stringify(B.prepare[i].abbreviations)) d.push(`Abkürzungen: ${A.prepare[i].abbreviations} -> ${B.prepare[i].abbreviations}`);
      if (A.learnable[i] !== B.learnable[i]) d.push(`lernbar: ${JSON.stringify(A.learnable[i])} -> ${JSON.stringify(B.learnable[i])}`);
      ['plain', 'debug10', 'withLearned', 'withLearnedDebug10'].forEach(k => { if (!same(A[k][i], B[k][i])) d.push(`${k}: ${fmt(A[k][i])} -> ${fmt(B[k][i])}`); });
      if (d.length) diffs.push(`#${i} ${JSON.stringify(t).slice(0, 90)}\n      ` + d.join('\n      '));
    });
    diffs.forEach(d => console.log('   ' + d));
    console.log(`Snapshot: ${A.texts.length} Texte verglichen, ${diffs.length} verschieden`);
    test('Snapshot unverändert', () => assert.strictEqual(diffs.length, 0, `${diffs.length} Texte verschieden (siehe oben)`));
  }
}

// ------------------------------------------------------------------
// b) Bereinigung: Signatur, Grussformeln, Kontaktdaten, Nummern, Namen
// ------------------------------------------------------------------
const P = 'Das Fotobuch ist nicht angekommen.';
test('Signatur-Trenner und Fusszeilen von Geräten', () => {
  [P + '\n\nVon meinem iPhone gesendet', P + '\nVon meinem Samsung Galaxy Smartphone gesendet', P + '\nGesendet von meinem iPad',
    P + '\nSent from my iPhone', P + '\nGet Outlook for Android', P + '\nVon Outlook für iOS gesendet',
    P + '\n-- \nAnna Beispiel\nBeispielweg 3', P + '\n--\nAnna Beispiel', P + '\n\n--  \nMax Muster\nBeispielfirma AG']
    .forEach(t => assert.strictEqual(E.prepare(t).cleaned, P, JSON.stringify(t)));
  assert.ok(E.prepare(P + '\n--\nAnna').removed.includes('Grussformel/Signatur'));
  // gleicher Text mit und ohne Fusszeile = gleicher bereinigter Text (zählt in der Auswertung als gleicher Text)
  assert.strictEqual(E.prepare('Die Tasse hat einen Sprung.\nSent from my iPhone').cleaned, E.prepare('Die Tasse hat einen Sprung.').cleaned);
});
test('Grussformel ohne Text davor: ab hier Signatur', () => {
  [['Hallo zusammen\n\nVielen Dank und liebe Grüsse\nPeter Muster', ''],
    ['Die Tasse ist kaputt.\nVielen Dank und freundliche Grüsse\nPeter Muster', 'Die Tasse ist kaputt.'],
    ['Die Tasse ist kaputt.\nDanke und LG\nPeter', 'Die Tasse ist kaputt.'],
    ['Guten Tag\n\nFreundliche Grüsse\nAnna Beispiel', ''], ['Guten Tag\n\nFreundliche Grüsse', ''], ['Liebe Grüsse', ''],
    ['Grüezi\nFreundliche Grüsse\nHans Meier', ''], ['Guten Tag\n\nFreundliche Grüsse, Anna Beispiel', ''], ['LG Anna', ''],
    ['Danke!\n\nVon meinem iPhone gesendet', ''], ['Vielen Dank.\nAnna Beispiel\nBeispielweg 3', ''],
    ['Guten Tag Herr Muster\n\n--\nAnna Beispiel\nBeispielweg 3', ''],
    ['Guten Tag\n\nSiehe Anhang.\n\nFreundliche Grüsse\nMaria Muster', 'Siehe Anhang.'],
    // Dank als erste Zeile, danach Inhalt: nur der Dank fällt weg
    ['Danke!\nDas Paket ist aber immer noch nicht angekommen.', 'Das Paket ist aber immer noch nicht angekommen.'],
    ['Grüss Gott\nMein Fotobuch ist nicht angekommen.', 'Mein Fotobuch ist nicht angekommen.']]
    .forEach(([t, exp]) => assert.strictEqual(E.prepare(t).cleaned, exp, JSON.stringify(t)));
});
test('Inhalt bleibt (Kürzel, Grüsse im Satz, ähnliche Zeilen)', () => {
  ['LG Fotobuch kaputt angekommen', 'VG Rechnung doppelt', 'VG Rechnung', 'Grüsse aus den Ferien, das Fotobuch ist nie angekommen',
    'Von meinem Konto wurde doppelt abgebucht, obwohl ich alles gesendet', 'Gesendet von meinem Mann, aber nie angekommen',
    'Kd. hat FB n. erh. -- Tracking prüfen', 'Seite 12 fehlt, Format A4, Rahmen 30x40', 'Die Frau am Telefon war unfreundlich',
    'Frau hat angerufen, Paket fehlt', 'Mo-Fr. Paket kommt nicht', 'Windows 11: Software stürzt ab', 'Gutscheincode funktioniert nicht',
    'VG RE doppelt', 'LG FB kaputt', 'Gruss FB\nSeiten lose']
    .forEach(t => assert.strictEqual(E.prepare(t).cleaned, t, JSON.stringify(t)));
  assert.strictEqual(E.learnText('LG Fotobuch kaputt angekommen'), 'LG Fotobuch kaputt angekommen');
  assert.deepStrictEqual(codes(E.classify('LG Fotobuch kaputt angekommen')), codes(E.classify('Fotobuch kaputt angekommen')));
});
test('Formularfelder: Kontaktdaten weg, Notiz bleibt', () => {
  [['Telefon: Kundin sagt, FB nicht erhalten', 'Kundin sagt, FB nicht erhalten', []],
    ['Telefon: 079 123 45 67\nFotobuch fehlt', 'Fotobuch fehlt', ['Kontaktdaten']],
    ['Name: Anna Beispiel\nFotobuch fehlt', 'Fotobuch fehlt', ['Kontaktdaten']],
    ['Name: Anna Maria von Beispiel-Muster\nFotobuch fehlt', 'Fotobuch fehlt', ['Kontaktdaten']],
    ['E-Mail: anna@example.com\nFotobuch fehlt', 'Fotobuch fehlt', ['Kontaktdaten']],
    ['Adresse: Beispielweg 3, 8000 Zürich\nFotobuch fehlt', 'Fotobuch fehlt', ['Kontaktdaten']],
    // Name, Adresse, Firma, Ort …: immer ganz weg, auch als langer Satz
    ['Fotobuch kaputt angekommen.\nAdresse: Chemin des Vignes, chez Dupont, Lausanne', 'Fotobuch kaputt angekommen.', ['Kontaktdaten']],
    ['Fotobuch kaputt angekommen.\nAdresse: bei Familie Meier im Oberdorf, Hinterhaus links', 'Fotobuch kaputt angekommen.', ['Kontaktdaten']],
    ['Fotobuch kaputt angekommen.\nName: Meier statt Maier auf dem Cover gedruckt', 'Fotobuch kaputt angekommen.', ['Kontaktdaten']],
    ['Fotobuch kaputt angekommen.\nFirma: Fotostudio Beispiel, zuständig ist Frau Beispiel persönlich', 'Fotobuch kaputt angekommen.', ['Kontaktdaten']],
    ['Fotobuch kaputt angekommen.\nOrt: im Garten beim Nachbarn Herr Keller abgelegt', 'Fotobuch kaputt angekommen.', ['Kontaktdaten']],
    ['Unternehmen: Beispiel AG, Abteilung für interne Kommunikation\nRechnung doppelt', 'Rechnung doppelt', ['Kontaktdaten']],
    // Telefon/E-Mail/Handy: ein echter Satz ist eine Notiz (Bezeichnung weg)
    ['E-Mail: bitte nur an meine Geschäftsadresse schreiben', 'bitte nur an meine Geschäftsadresse schreiben', []],
    ['Handy: Kunde meldet, Paket nie angekommen', 'Kunde meldet, Paket nie angekommen', []],
    ['Tel.: Kundin ruft an, Rechnung doppelt erhalten', 'Kundin ruft an, Rechnung doppelt erhalten', []]]
    .forEach(([t, exp, rm]) => { const p = E.prepare(t); assert.strictEqual(p.cleaned, exp, t); assert.deepStrictEqual(p.removed, rm, t); });
  assert.deepStrictEqual(codes(E.classify('Telefon: Kundin sagt, FB nicht erhalten')), codes(E.classify('Kundin sagt, FB nicht erhalten')));
  assert.strictEqual(E.learnText('Fotobuch kaputt angekommen.\nAdresse: Chemin des Vignes, chez Dupont, Lausanne'), 'Fotobuch kaputt angekommen.');
});
test('Konto-, Karten-, Telefon-, Referenznummern, Adressen und Namen werden entfernt', () => {
  // [Text, darf nicht bleiben, Grund in "removed", muss bleiben]
  [['Bitte Rückerstattung auf IBAN CH93 0076 2011 6238 5295 7 überweisen.', ['CH93', '0076', '6238', '5295'], 'Konto-/Kartennummern', ['Rückerstattung auf IBAN überweisen']],
    ['Bitte auf CH56 0483 5012 3456 7800 9 zurückzahlen', ['CH56', '0483', '7800'], 'Konto-/Kartennummern', ['zurückzahlen']],
    ['Konto CH5604835012345678009, doppelt bezahlt', ['CH56', '0483'], 'Konto-/Kartennummern', ['Konto', 'doppelt bezahlt']],
    ['IBAN DE89 3704 0044 0532 0130 00 und AT61 1904 3002 3457 3201 angegeben', ['DE89', '3704', 'AT61', '3201'], 'Konto-/Kartennummern', ['angegeben']],
    ['Karte 4111 1111 1111 1111 doppelt belastet', ['4111', '1111'], 'Konto-/Kartennummern', ['Karte doppelt belastet']],
    ['Karte 5500-0000-0000-0004 doppelt belastet', ['5500', '0004'], 'Konto-/Kartennummern', ['doppelt belastet']],
    ['Rückruf auf +41 (0)44 123 45 67 erwünscht', ['41', '44', '123', '67'], 'Telefonnummern', ['Rückruf auf erwünscht']],
    ['Rückruf auf 0041 79 123 45 67 erwünscht', ['0041', '79', '123'], 'Telefonnummern', ['Rückruf auf erwünscht']],
    ['Rückruf auf +41 79 123 45 67 erwünscht', ['41', '79', '123'], 'Telefonnummern', ['Rückruf auf erwünscht']],
    ['Tel.079 555 12 34, Paket fehlt', ['079', '555'], 'Telefonnummern', ['Paket fehlt']],
    ['Auftrag A-938794 prüfen', ['938794'], 'Daten/Nummern', ['Auftrag A prüfen']],
    ['RE-2026/48213 doppelt bezahlt', ['2026', '48213'], 'Daten/Nummern', ['RE doppelt bezahlt']],
    ['Ticket #123456 noch offen', ['123456', '#'], 'Daten/Nummern', ['Ticket noch offen']],
    ['Bestellung Nr.1234567 fehlt', ['1234567'], 'Daten/Nummern', ['Bestellung Nr fehlt']],
    ['Neue Adresse Seestr. 50, bitte ändern', ['Seestr', '50'], 'Adressen', ['Neue Adresse', 'bitte ändern']],
    ['Lieferung an Hauptstr 3a geht nicht', ['Hauptstr', '3a'], 'Adressen', ['Lieferung an', 'geht nicht']],
    ['Abholung am Bahnhofpl. 1 gewünscht', ['Bahnhofpl', ' 1 '], 'Adressen', ['Abholung am', 'gewünscht']],
    ['Frau Müller ruft an, FB n. erh.', ['Müller'], 'Namen', ['Frau ruft an, FB n. erh.']],
    ['Rückruf Hr. Hans Meier: Rechnung doppelt', ['Hans', 'Meier'], 'Namen', ['Rückruf Hr.', 'Rechnung doppelt']],
    ['Herr Meier Rechnung doppelt bezahlt', ['Meier'], 'Namen', ['Herr – Rechnung doppelt bezahlt']],
    ['Paket für Herrn Beispiel kam zurück', ['Beispiel'], 'Namen', ['Paket für Herrn kam zurück']],
    ['Familie Keller wartet auf das Paket', ['Keller'], 'Namen', ['Familie wartet auf das Paket']],
    ['Fam. Keller und Fr. Frei warten', ['Keller', 'Frei'], 'Namen', ['Fam.', 'und Fr.', 'warten']]]
    .forEach(([t, gone, why, keep]) => {
      const p = E.prepare(t);
      gone.forEach(g => assert.ok(!p.cleaned.includes(g), `${t} -> ${p.cleaned} (enthält ${g})`));
      keep.forEach(k => assert.ok(p.cleaned.includes(k), `${t} -> ${p.cleaned} (ohne ${k})`));
      assert.ok(p.removed.includes(why), `${t}: ${p.removed}`);
    });
  // "RE" bleibt und wird ausgeschrieben
  assert.ok(E.prepare('RE-2026/48213 doppelt bezahlt').text.includes('Rechnung'));
  // Vorschläge ändern sich durch das Entfernen nicht
  assert.deepStrictEqual(codes(E.classify('Kreditkarte doppelt belastet, Karte 4111 1111 1111 1111 bitte prüfen')), codes(E.classify('Kreditkarte doppelt belastet, Karte bitte prüfen')));
});
// eigene Instanz mit zusätzlichen Abkürzungen (z.B. von Tom später ergänzt)
function engineWithAbk(extra) {
  const m = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(ROOT, 'src/engine.js'), 'utf8'))(m, m.exports);
  m.exports.build(ctx.S, ctx.K, ctx.A, Object.assign({}, ctx.ABK, extra), ctx.B);
  return m.exports;
}
test('Namen nach Anrede: Abkürzungen bleiben, "Fr." = Freitag, "meine Frau" = Nomen', () => {
  // Kurznotizen mit Anrede + Name + interner Abkürzung: Name weg, Abkürzung und Vorschlag bleiben
  [['Hr. Müller FB n. erh.', 'Hr. FB n. erh.', 'LIEF'], ['Frau Meier RE doppelt', 'Frau RE doppelt', '50103'],
    ['Fr. Meier LW beschädigt', 'Fr. LW beschädigt', '10116'], ['Frau Huber LS fehlt', 'Frau LS fehlt', '430'],
    ['Herr Graf WK leer', 'Herr WK leer', '30212'], ['Kd. Fr. Meier FB n. erh.', 'Kd. Fr. FB n. erh.', 'LIEF'],
    ['Frau Meier FBs n. erh.', 'Frau FBs n. erh.', 'LIEF'], ['Hr. FB n. erh.', 'Hr. FB n. erh.', 'LIEF'],
    ['Hr. Keller GS n. erh.', 'Hr. GS n. erh.', null],
    // "Fr." = Freitag
    ['Am Fr. Rechnung doppelt erhalten', 'Am Fr. Rechnung doppelt erhalten', '50103'],
    ['Seit Fr. Fotobuch nicht erhalten', 'Seit Fr. Fotobuch nicht erhalten', 'LIEF'],
    ['Letzten Fr. Paket bestellt, noch nicht da', 'Letzten Fr. Paket bestellt, noch nicht da', 'LIEF'],
    ['jeden Fr. FB n. erh.', 'jeden Fr. FB n. erh.', 'LIEF'], ['Mo. - Fr. Paket kommt nicht', 'Mo. - Fr. Paket kommt nicht', null],
    // "meine Frau", "die Familie": Nomen, das bekannte Wort danach bleibt
    ['Ich habe für die Familie Kalender bestellt', 'Ich habe für die Familie Kalender bestellt', '10114'],
    ['Meine Frau Tasse zerbrochen', 'Meine Frau Tasse zerbrochen', '381'],
    ['unserer Familie Kalender geschenkt', 'unserer Familie Kalender geschenkt', null]]
    .forEach(([t, exp, code]) => {
      assert.strictEqual(E.prepare(t).cleaned, exp, t);
      if (code) assert.ok(isCode(codes(E.classify(t))[0], code), t + ' -> ' + codes(E.classify(t)));
    });
  assert.ok(codes(E.classify('Hr. Keller GS n. erh.')).includes('20709'));
  // alle Abkürzungen in Grossbuchstaben aus ABK, auch später ergänzte
  const caps = Object.keys(ctx.ABK).filter(k => /^[A-ZÄÖÜ]{2,}s?$/.test(k));
  assert.ok(caps.length >= 12, caps.join(','));
  caps.forEach(k => assert.strictEqual(E.prepare('Hr. Keller ' + k + ' fehlt').cleaned, 'Hr. ' + k + ' fehlt', k));
  assert.strictEqual(E.prepare('Hr. Keller TX kaputt').cleaned, 'Hr. kaputt');
  const EX = engineWithAbk({ TX: 'Tasse' });
  assert.strictEqual(EX.prepare('Hr. Keller TX kaputt').cleaned, 'Hr. TX kaputt');
  assert.strictEqual(EX.prepare('Frau TX kaputt').cleaned, 'Frau TX kaputt');
});
test('Bereinigung ist stabil: gelernter Text ändert sich beim zweiten Bereinigen nicht', () => {
  ['Hr. Keller Rechnung doppelt erhalten', 'Herr Müller Farbstich Fotos', 'Hr. Hans Peter Meier Rechnung doppelt erhalten',
   'Frau Dr. Anna Imhof ruft an: Gutschein ungültig', 'Fam. EGLI Leinwand beschädigt angekommen', 'Frau Keller E-Mail ändern'].forEach(t => {
    const l = E.learnText(t);
    assert.ok(l, 'lernbar: ' + t);
    assert.strictEqual(E.prepare(l).cleaned, l, 'stabil: ' + t);
  });
});
test('Kurze Notiz mit Gruss vor weitergeleiteter Nachricht ohne Kopf; E-Mail nach Name; „Fr.“ am Zeilenanfang', () => {
  const fwd = 'FYI\nLG Sandra\n\nGuten Tag\nMein Fotobuch ist nie angekommen.\nFreundliche Grüsse\nAnna Beispiel';
  assert.ok(/Fotobuch ist nie angekommen/.test(E.prepare(fwd).cleaned));
  assert.ok(isCode((E.classify(fwd)[0] || { c: {} }).c.code, 'LIEF'));
  assert.ok(/E-Mail/.test(E.prepare('Frau Keller E-Mail ändern').cleaned));
  assert.ok(!/Keller/.test(E.prepare('Frau Keller E-Mail ändern').cleaned));
  assert.ok(/Rechnung/.test(E.prepare('Fr. Rechnung nicht erhalten').cleaned));
  assert.ok(!/Meier/.test(E.prepare('Fr. Meier: FB n. erh.').cleaned));
  assert.strictEqual(E.learnable('Guten Tag\n\nFreundliche Grüsse\nAnna Beispiel'), '');
});
test('Namen nach Anrede werden trotzdem entfernt (Titel, Doppelnamen, Grossbuchstaben, bekannte Wörter)', () => {
  // [Text, bereinigt]
  [['Hr. Hans Peter Imhof ruft an: Rechnung doppelt', 'Hr. ruft an: Rechnung doppelt'],
    ['Frau Dr. Anna Imhof ruft an: Rechnung doppelt', 'Frau ruft an: Rechnung doppelt'],
    ['Herr Prof. Dr. Hans Imhof reklamiert', 'Herr reklamiert'], ['Fr. Dr. Meier FB n. erh.', 'Fr. FB n. erh.'],
    ['Hr. H. Meier wartet', 'Hr. wartet'], ['Frau Anna Maria Beispiel wartet', 'Frau wartet'],
    ['Frau Meier. Paket fehlt', 'Frau. Paket fehlt'],
    // Nachnamen in Grossbuchstaben sind keine Abkürzungen
    ['Frau ROTH FB n. erh.', 'Frau FB n. erh.'], ['Herr OTT RE doppelt', 'Herr RE doppelt'], ['Hr. HUG ruft an wegen FB', 'Hr. ruft an wegen FB'],
    ['Fam. EGLI Fotobuch nicht erhalten', 'Fam. – Fotobuch nicht erhalten'],
    // Nachname = bekanntes Wort: als 1. Wort nach der Anrede trotzdem weg
    ['Frau Klein reklamiert Farbstich', 'Frau reklamiert Farbstich'], ['Rückruf an Frau Klein', 'Rückruf an Frau'],
    ['Herr Frei wartet auf Paket', 'Herr wartet auf Paket'], ['für Herrn Frei Kalender bestellt', 'für Herrn – Kalender bestellt'],
    // Freitag/Nomen nur vor einem bekannten Wort, sonst Name
    ['Am Fr. Meier angerufen, Paket fehlt', 'Am Fr. angerufen, Paket fehlt'], ['meine Frau Susanne hat bestellt', 'meine Frau hat bestellt'],
    ['für die Familie Keller bestellt', 'für die Familie bestellt'], ['Ich habe mit Ihrer Frau Keller telefoniert', 'Ich habe mit Ihrer Frau telefoniert']]
    .forEach(([t, exp]) => {
      const p = E.prepare(t);
      assert.strictEqual(p.cleaned, exp, t);
      assert.ok(p.removed.includes('Namen'), t + ': ' + p.removed);
    });
  assert.ok(!/Imhof|Hans|Anna/.test(E.learnText('Frau Dr. Anna Imhof ruft an: Rechnung doppelt')));
});
const DISC = 'Diese E-Mail enthält vertrauliche Informationen und ist nur für den Adressaten bestimmt.';
test('Grussformel oder "--" weit oben: nur die Zeile weg, wenn keine Signatur folgt', () => {
  [['Liebe Grüsse Anna\nDas Fotobuch ist nie angekommen.', 'Das Fotobuch ist nie angekommen.'],
    ['Gruss\nWK Tasse kaputt', 'WK Tasse kaputt'], ['LG\nFotobuch kaputt', 'Fotobuch kaputt'],
    ['Grüsse\nDas Paket ist nicht angekommen', 'Das Paket ist nicht angekommen'],
    ['Kunde ruft an\n--\nFB Seiten lose, Ersatz gewünscht', 'Kunde ruft an\nFB Seiten lose, Ersatz gewünscht'],
    ['--\nDas Fotobuch ist nie angekommen.', 'Das Fotobuch ist nie angekommen.'],
    // Notiz in Grossbuchstaben ist keine Signaturzeile
    ['Danke!\nFB NICHT ERH.', 'FB NICHT ERH.'], ['Danke\nRE DOPPELT', 'RE DOPPELT'],
    // "Am … schrieb" als Satz (keine Kopfzeile) bleibt
    ['Am Montag schrieb die Kundin, dass das Fotobuch fehlt', 'Am Montag schrieb die Kundin, dass das Fotobuch fehlt'],
    // nach dem Text: "--" = Signatur, auch wenn danach keine typische Signaturzeile kommt
    ['Das Fotobuch ist nie angekommen, bitte prüfen Sie das.\n--\n' + DISC, 'Das Fotobuch ist nie angekommen, bitte prüfen Sie das.'],
    ['Guten Tag, mein Fotobuch ist nie angekommen, bitte prüfen.\n--\nAnna Beispiel\nBeispiel AG\n' + DISC, 'mein Fotobuch ist nie angekommen, bitte prüfen.']]
    .forEach(([t, exp]) => assert.strictEqual(E.prepare(t).cleaned, exp, JSON.stringify(t)));
  [['Liebe Grüsse Anna\nDas Fotobuch ist nie angekommen.', 'LIEF'], ['Kunde ruft an\n--\nFB Seiten lose, Ersatz gewünscht', '315'],
    ['--\nDas Fotobuch ist nie angekommen.', 'LIEF'], ['Danke!\nFB NICHT ERH.', 'LIEF'], ['Danke\nRE DOPPELT', '50103']]
    .forEach(([t, c]) => assert.ok(codes(E.classify(t)).some(x => isCode(x, c)), JSON.stringify(t) + ' -> ' + codes(E.classify(t))));
});
test('kurze Weiterleitungen: Kopf weg, weiter mit der weitergeleiteten Mail', () => {
  // [Text, muss bleiben, darf nicht bleiben, Code unter den Vorschlägen]
  [['FYI\nLG Tom\n\nAm 3.9.2026 schrieb Kunde:\nDas Fotobuch ist nie angekommen.', ['Das Fotobuch ist nie angekommen.'], ['Tom', 'schrieb'], 'LIEF'],
    ['Hallo\nGruss Anna\n\n-----Ursprüngliche Nachricht-----\nVon: kunde@example.ch\nBetreff: Fotobuch\n\nMein Fotobuch ist kaputt angekommen, die Seiten lösen sich.',
      ['Mein Fotobuch ist kaputt angekommen, die Seiten lösen sich.'], ['Anna', 'Ursprüngliche', 'Nachricht', 'example'], '315'],
    ['Weiterleitung\nGruss Peter\n\n---------- Forwarded message ----------\nFrom: x@example.ch\nMeine Rechnung ist doppelt.',
      ['Meine Rechnung ist doppelt.'], ['Peter', 'Forwarded', 'message'], '50103'],
    ['Bitte erledigen\nLG Tom\n\nAm 3.9.2026 um 10:12 schrieb Anna Beispiel <anna@example.ch>:\nGuten Tag, die Rechnung ist doppelt.',
      ['die Rechnung ist doppelt.'], ['Tom', 'Anna', 'Beispiel', 'schrieb'], '50103'],
    ['Zur Info\nGruss Sandra\n\nVon: Anna Beispiel\nGesendet: Montag, 3. September 2026\nAn: Service\nBetreff: Fotobuch\n\nGuten Tag\nMein Fotobuch ist nie angekommen.\nFreundliche Grüsse\nAnna',
      ['Mein Fotobuch ist nie angekommen.'], ['Sandra', 'Anna', 'Beispiel', 'Freundliche'], 'LIEF'],
    ['FYI\n\nFreundliche Grüsse\nTom\n\n-----Original Message-----\nFrom: anna@example.ch\nSubject: Fotobuch\nDas Fotobuch hat lose Seiten.',
      ['Das Fotobuch hat lose Seiten.'], ['Tom', 'Original'], '315']]
    .forEach(([t, keep, gone, code]) => {
      const p = E.prepare(t), l = E.learnText(t);
      keep.forEach(k => { assert.ok(p.cleaned.includes(k), `${JSON.stringify(t)} -> ${JSON.stringify(p.cleaned)} (ohne ${k})`); assert.ok(l.includes(k), 'learnText ' + k); });
      gone.forEach(g => assert.ok(!p.cleaned.includes(g), `${JSON.stringify(t)} -> ${JSON.stringify(p.cleaned)} (enthält ${g})`));
      assert.ok(codes(E.classify(t)).some(x => isCode(x, code)), JSON.stringify(t) + ' -> ' + codes(E.classify(t)));
    });
  // Antwort mit Text darüber (ab 3 Wörtern vor dem Gruss bzw. 6 Wörtern vor dem Kopf): Verlauf darunter fällt weg (wie bisher)
  assert.strictEqual(E.prepare('Wann kommt es endlich?\nGruss Anna\n\nAm 3.9.2026 schrieb Kundendienst <service@example.ch>:\nIhr Paket wurde versendet.').cleaned,
    'Wann kommt es endlich?');
  assert.strictEqual(E.prepare('Mein Fotobuch ist leider immer noch nicht angekommen.\n\nAm 3.9.2026 schrieb Kundendienst <service@example.ch>:\nIhr Paket wurde versendet.').cleaned,
    'Mein Fotobuch ist leider immer noch nicht angekommen.');
});
test('nur Anrede, Signatur oder Fusszeile: nicht lernbar', () => {
  ['Guten Tag\n\nFreundliche Grüsse\nAnna Beispiel', 'Grüezi\nFreundliche Grüsse\nHans Meier', 'Guten Tag\n\n--\nAnna Beispiel\nBeispielweg 3',
    'Danke!\nAnna Beispiel\n079 123 45 67', 'Freundliche Grüsse\nAnna Beispiel\nBeispielweg 3\n8000 Zürich',
    'Guten Tag\n\nFreundliche Grüsse\nAnna Beispiel\nBeispiel AG\n' + DISC, 'Guten Tag\n\n--\nAnna Beispiel\nBeispielweg 3\n' + DISC,
    'Freundliche Grüsse\nAnna Beispiel\nmobil 079 123 45 67', 'LG Anna\nVon meinem iPhone gesendet', 'Danke!\nAnna Beispiel\nTel. 079 123 45 67',
    'Merci\nAnna\nc/o Beispiel AG', 'Liebe Grüsse\nanna', 'Danke!\nANNA BEISPIEL\nBEISPIEL AG', 'Freundliche Grüsse\nAnna Beispiel\nLeiterin Marketing\nBeispiel AG',
    'Siehe Anhang\n\nFreundliche Grüsse\nAnna Beispiel\nLeiterin Marketing\nBeispiel AG | Beispielweg 3 | 8000 Zürich\nwww.example.ch\n' + DISC]
    .forEach(t => assert.strictEqual(E.learnText(t), '', JSON.stringify(t)));
  ['Guten Tag\n\nFreundliche Grüsse\nAnna Beispiel\nBeispiel AG\n' + DISC, 'Liebe Grüsse\nanna', 'Danke!\nANNA BEISPIEL\nBEISPIEL AG']
    .forEach(t => assert.strictEqual(E.prepare(t).cleaned, '', JSON.stringify(t)));
});
test('lernbar / learnText', () => {
  assert.strictEqual(E.LEARN_MAX, 1000);
  ['Siehe Anhang', 'Siehe Anhang.', 'siehe Anhang!', 'Anhang', 'Anbei im Anhang', 'Beilage', 'Guten Tag\n\nFreundliche Grüsse', 'Freundliche Grüsse',
    'Liebe Grüsse\nAnna', 'Guten Tag\n\nSiehe Anhang.\n\nFreundliche Grüsse\nMaria Muster', 'Danke!\n\nVon meinem iPhone gesendet', 'Grüezi\nFreundliche Grüsse\nHans Meier',
    'Kd. hat FB n. erh.', '', 'x']
    .forEach(t => { assert.strictEqual(E.learnable(t), '', JSON.stringify(t)); assert.strictEqual(E.learnText(t), '', JSON.stringify(t)); });
  base.forEach(b => assert.strictEqual(E.learnText(b.t), E.learnable(b.t).slice(0, 1000)));
  const long = 'Guten Tag\n\n' + 'Das Fotobuch ist leider mit Kratzern auf dem Umschlag angekommen. '.repeat(40) + '\n\nFreundliche Grüsse\nAnna Beispiel';
  assert.ok(E.learnable(long).length > 1000);
  assert.strictEqual(E.learnText(long), E.learnable(long).slice(0, 1000));
  assert.strictEqual(E.learnText(long).length, 1000);
  // nach dem Lernen keine Vorschläge aus "Siehe Anhang"-Fällen
  E.setExamples(['Siehe Anhang.', 'Anhang', 'Anbei im Anhang'].map((t, i) => ({ t: E.learnText(t), c: ['50410', '511', '315'][i] })));
  assert.deepStrictEqual(codes(E.classify('Siehe Anhang')), []);
  assert.ok(codes(E.classify('Die Tasse ist kaputt, siehe Anhang')).every(c => !['50410', '511', '315'].includes(c)));
  E.setExamples([]);
});
test('Literale mit gleichen Wörtern, aber anderem Modus', () => {
  const hits = q => E.classify(q, { debug: true, max: 99, minAbs: 0.0001, rel: 0.0001 }).flatMap(r => (r.hits || []).map(h => r.c.code + ' ' + h.src));
  // Bezeichnung "paket"/"rand" (Wortanfang/ganzes Wort) darf nicht wie die Regel (irgendwo im Wort) treffen
  assert.ok(!hits('Das Ersatzpaket ist beschädigt angekommen').some(h => / lbl:paket$/.test(h)));
  assert.ok(!hits('Beim Randbereich fehlt ein Stück').some(h => / lbl:rand$/.test(h)));
  assert.ok(hits('Das Paket ist beschädigt angekommen').some(h => / lbl:paket$/.test(h)));
  assert.ok(hits('Der Rand ist abgeschnitten').some(h => / lbl:rand$/.test(h)));
  // Regel mit "farbe" (irgendwo im Wort) trifft auch zusammengesetzte Wörter
  assert.ok(hits('Beim Rahmen stimmt die Wunschfarbe nicht').some(h => /^10117 .*farbe/.test(h)));
  assert.strictEqual(codes(E.classify('Beim Rahmen stimmt die Wunschfarbe nicht'))[0], '10117');
});

// ------------------------------------------------------------------
// c) Auswertung mit früheren Fällen
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
// kurze Notizen: werden getestet, sind aber zu kurz zum Lernen
const SHORT = [{ t: 'Kd. hat FB n. erh.', c: '50401' }, { t: 'FB n. erh.', c: '50401' }, { t: 'Paket nicht erhalten', c: '50401' }];
SHORT.forEach(x => synth.push(x));
// nicht verwendbar (unbekannter Code oder leer) bzw. nur Test (zu kurz)
const BAD = [{ t: 'Paket nicht angekommen, Tracking zeigt nichts', c: '99999' }, { t: 'Rechnung doppelt erhalten', c: '' }, { t: 'Rechnung doppelt erhalten' },
  { t: 'x', c: '50410' }, { t: '', c: '50410' }, { t: 'Guten Tag\n\nFreundliche Grüsse', c: '50410' }, { t: 'Siehe Anhang.', c: '511' }, { c: '50410' }, null];
const cases = synth.concat(BAD);
const known = x => !!(x && x.c != null && E.byCode.hasOwnProperty(String(x.c).trim()));
const text = x => x && x.t != null ? String(x.t) : '';
const isUsable = x => known(x) && hasWord(E.prepare(text(x)).cleaned);
const usableIdx = cases.map((x, i) => isUsable(x) ? i : -1).filter(i => i >= 0);
const keyOf = t => E.norm(E.prepare(t).cleaned);

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

test('Bericht: Felder wie vereinbart', () => {
  assert.deepStrictEqual(Object.keys(R).filter(k => k !== 'details'), ['total', 'usable', 'skipped', 'zuKurzZumLernen', 'sameText', 'nearDup',
    'tested', 'sampleEvery', 'variants', 'pairs', 'perCode', 'confusions', 'triggers', 'words', 'errors']);
  assert.deepStrictEqual(Object.keys(R.pairs), ['gelernt', 'gelernt_streng']);
  Object.values(R.pairs).forEach(p => {
    assert.deepStrictEqual(Object.keys(p), ['top1', 'top3']);
    Object.values(p).forEach(x => { assert.deepStrictEqual(Object.keys(x), ['fixed', 'broken']); assert.ok(Number.isInteger(x.fixed) && Number.isInteger(x.broken)); });
  });
  assert.deepStrictEqual(Object.keys(R.skipped), ['unbekannterCode', 'leer']);
  assert.deepStrictEqual(Object.keys(R.confusions), ['regeln', 'gelernt']);
  R.variants.forEach(v => assert.deepStrictEqual(Object.keys(v), ['id', 'name', 'n', 'top1', 'top3', 'none']));
  R.errors.forEach(e => assert.deepStrictEqual(Object.keys(e), ['i', 'c', 'regeln', 'gelernt']));
  assert.strictEqual(typeof E.learnText, 'function');
  assert.strictEqual(typeof E.evaluation, 'function');
});
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
  const unknown = cases.filter(x => !known(x)).length;
  assert.deepStrictEqual(R.skipped, { unbekannterCode: unknown, leer: cases.length - unknown - usableIdx.length });
  assert.strictEqual(R.skipped.unbekannterCode, 4);
  assert.strictEqual(R.skipped.leer, 3);   // '', nur Anrede/Grussformel, ohne Text
  assert.strictEqual(R.total, cases.length);
  assert.strictEqual(R.usable, usableIdx.length);
  assert.strictEqual(R.tested, usableIdx.length);
  assert.strictEqual(R.sampleEvery, 1);
  assert.deepStrictEqual(D.map(d => d.i), usableIdx);
  assert.strictEqual(R.zuKurzZumLernen, usableIdx.filter(i => !E.learnText(text(cases[i]))).length);
  D.forEach(d => assert.strictEqual(d.lernbar, !!E.learnText(text(cases[d.i])), `Fall ${d.i}`));
});
test('kurze Notizen werden getestet', () => {
  assert.ok(R.zuKurzZumLernen >= SHORT.length + 2, R.zuKurzZumLernen);   // + 'x' und 'Siehe Anhang.'
  SHORT.forEach(x => {
    const d = byI[cases.indexOf(x)];
    assert.ok(d, 'getestet: ' + x.t);
    assert.strictEqual(d.lernbar, false);
    assert.ok(isCode(d.top.regeln[0], 'LIEF'), JSON.stringify(d.top));
  });
  const pc = R.perCode.find(p => p.code === '50401');
  assert.ok(pc && pc.n >= SHORT.length, JSON.stringify(pc));   // auch pro Code mitgezählt
  // Notizen, die zu kurz zum Lernen sind, sind nie ähnliche Fälle; lernbare schon
  const code = lonely[3], extra = [{ t: 'Lack', c: code }, { t: 'Lack matt', c: code }];
  assert.ok(!E.learnText(extra[0].t) && E.learnText(extra[1].t));
  const r = evalAll(E, synth.concat(extra)), dd = r.details.filter(d => d.i >= synth.length);
  assert.strictEqual(dd.length, 2);
  assert.ok(!dd[1].top.nurfaelle.includes(code), JSON.stringify(dd[1].top));   // "Lack" ist nicht im Index
  assert.strictEqual(dd[0].top.nurfaelle[0], code, JSON.stringify(dd[0].top));  // "Lack matt" schon
});
test('"regeln" = classify() ohne gelernte Fälle', () => {
  // gilt, solange BEISPIELE leer ist (sonst zählen die eingebauten Beispiele mit)
  assert.strictEqual(ctx.B.length, 0);
  D.forEach(d => assert.deepStrictEqual(d.top.regeln, plain[d.i], `Fall ${d.i}: ${cases[d.i].t.slice(0, 60)}`));
});
test('Varianten gezählt und benannt', () => {
  assert.deepStrictEqual(R.variants.map(v => v.id), E.VARIANTS.map(v => v.id));
  assert.deepStrictEqual(R.variants.map(v => [v.id, v.name]), [
    ['regeln', 'Nur Stichwörter (so wie heute)'], ['gelernt', 'Mit importierten Fällen'],
    ['gelernt_streng', 'Mit importierten Fällen, ohne fast gleiche Texte'],
    ['max20', 'Mit Fällen, Gewicht 20'], ['max80', 'Mit Fällen, Gewicht 80'],
    ['top3_20', 'Mit Fällen, mehrere ähnliche, Gewicht 20'], ['top3_40', 'Mit Fällen, mehrere ähnliche, Gewicht 40'],
    ['top3_80', 'Mit Fällen, mehrere ähnliche, Gewicht 80'], ['nurfaelle', 'Nur importierte Fälle (ohne Stichwörter)']]);
  E.VARIANTS.forEach(v => assert.ok(!/ß/.test(v.name), v.name));
  R.variants.forEach(v => {
    const t = D.map(d => d.top[v.id]);
    assert.deepStrictEqual([v.n, v.top1, v.top3, v.none],
      [D.length, D.filter((d, k) => t[k][0] === d.c).length, D.filter((d, k) => t[k].includes(d.c)).length, t.filter(x => !x.length).length], v.id);
    t.forEach(x => assert.ok(x.length <= 3));
  });
  const V = {}; R.variants.forEach(v => { V[v.id] = v; });
  // die leicht veränderte Kopie wird als ähnlicher Fall gefunden
  assert.ok(V.nurfaelle.top3 >= 0.75 * V.nurfaelle.n, JSON.stringify(V.nurfaelle));
  assert.ok(V.gelernt.top3 >= V.regeln.top3, JSON.stringify([V.gelernt, V.regeln]));
  // ohne fast gleiche Texte: nie besser als mit ihnen, wenn es fast gleiche Texte gibt
  assert.ok(V.gelernt_streng.top3 <= V.gelernt.top3, JSON.stringify([V.gelernt_streng, V.gelernt]));
});
test('pairs: neu richtig / neu falsch gegenüber "regeln" (Platz 1 und unter den 3)', () => {
  const V = {}; R.variants.forEach(v => { V[v.id] = v; });
  ['gelernt', 'gelernt_streng'].forEach(id => {
    const exp = { top1: { fixed: 0, broken: 0 }, top3: { fixed: 0, broken: 0 } };
    D.forEach(d => {
      const a0 = d.top.regeln[0] === d.c, a1 = d.top[id][0] === d.c, b0 = d.top.regeln.includes(d.c), b1 = d.top[id].includes(d.c);
      if (a1 && !a0) exp.top1.fixed++; if (a0 && !a1) exp.top1.broken++;
      if (b1 && !b0) exp.top3.fixed++; if (b0 && !b1) exp.top3.broken++;
    });
    assert.deepStrictEqual(R.pairs[id], exp, id);
    // Differenz der Summen = neu richtig - neu falsch
    assert.strictEqual(V[id].top1 - V.regeln.top1, exp.top1.fixed - exp.top1.broken, id);
    assert.strictEqual(V[id].top3 - V.regeln.top3, exp.top3.fixed - exp.top3.broken, id);
  });
  assert.ok(R.pairs.gelernt.top3.fixed > 0, JSON.stringify(R.pairs));
  // kleines Beispiel: Stichwörter finden den Code nicht, der fast gleiche Fall schon -> 2 neu richtig, ohne fast gleiche nicht
  const code = lonely[1], T = 'Die Glanzfolie auf dem Umschlag löst sich an den Ecken ab und wirft Blasen';
  const r = evalAll(E, [{ t: T, c: code }, { t: 'Kundin schreibt, ' + T, c: code }]);
  assert.deepStrictEqual(r.pairs.gelernt, { top1: { fixed: 2, broken: 0 }, top3: { fixed: 2, broken: 0 } });
  assert.deepStrictEqual(r.pairs.gelernt_streng, { top1: { fixed: 0, broken: 0 }, top3: { fixed: 0, broken: 0 } });
  // leer: nichts getestet
  const r0 = evalAll(E, []);
  assert.deepStrictEqual(r0.pairs, { gelernt: { top1: { fixed: 0, broken: 0 }, top3: { fixed: 0, broken: 0 } }, gelernt_streng: { top1: { fixed: 0, broken: 0 }, top3: { fixed: 0, broken: 0 } } });
});
test('Leave-one-out: eigener Code nie aus dem Fall selbst', () => {
  const iu = cases.indexOf(UNIQUE);
  assert.ok(byI[iu], 'eindeutiger Fall getestet');
  assert.ok(!byI[iu].top.nurfaelle.includes(UNIQUE.c), JSON.stringify(byI[iu].top));
  // allgemein: Code nur einmal unter den lernbaren Fällen und der Fall selbst ist lernbar -> "nurfaelle" kann ihn nicht liefern
  const n = {}; usableIdx.filter(i => E.learnText(text(cases[i]))).forEach(i => { n[cases[i].c] = (n[cases[i].c] || 0) + 1; });
  D.filter(d => d.lernbar && n[d.c] === 1).forEach(d => assert.ok(!d.top.nurfaelle.includes(d.c), `Fall ${d.i}`));
});
test('exakte Duplikate schliessen sich gegenseitig aus, fast gleiche zählen (und werden gezählt)', () => {
  const T = 'Die Glanzfolie auf dem Umschlag löst sich an den Ecken ab und wirft Blasen';
  const code = lonely[1];
  const dup = [{ t: T, c: code }, { t: '  ' + T + ' !!', c: code }, { t: T.toUpperCase(), c: code }, { t: T + '\n\nVon meinem iPhone gesendet', c: code }];   // gleicher bereinigter Text
  const r1 = evalAll(E, synth.concat(dup)), d1 = r1.details.filter(d => d.i >= synth.length);
  assert.strictEqual(d1.length, 4);
  d1.forEach(d => { assert.ok(!d.top.nurfaelle.includes(code), JSON.stringify(d.top.nurfaelle)); assert.strictEqual(d.nearDup, false); });
  // Gegenprobe: leicht anderer Text zählt als ähnlicher Fall ("Mit importierten Fällen"), ist aber ein fast gleicher Text
  const r2 = evalAll(E, synth.concat([dup[0], { t: 'Kundin schreibt, ' + T, c: code }])), d2 = r2.details.filter(d => d.i >= synth.length);
  assert.ok(!d2[0].top.regeln.includes(code), 'Voraussetzung: Stichwörter finden den Code nicht');
  d2.forEach(d => {
    assert.strictEqual(d.top.nurfaelle[0], code, JSON.stringify(d.top.nurfaelle));
    assert.ok(d.top.gelernt.includes(code), JSON.stringify(d.top.gelernt));          // nicht stillschweigend ausgeschlossen
    assert.strictEqual(d.nearDup, true);
    assert.ok(!d.top.gelernt_streng.includes(code), JSON.stringify(d.top.gelernt_streng));
  });
  assert.strictEqual(r2.nearDup - r2.details.filter(d => d.i < synth.length && d.nearDup).length, 2);
});
test('sameText und nearDup', () => {
  const kn = {}; usableIdx.forEach(i => { const k = keyOf(text(cases[i])); kn[k] = (kn[k] || 0) + 1; });
  assert.strictEqual(R.sameText, usableIdx.filter(i => kn[keyOf(text(cases[i]))] > 1).length);
  assert.ok(R.sameText > 0);
  assert.strictEqual(R.nearDup, D.filter(d => d.nearDup).length);
  // kleines Beispiel: 2 gleiche Texte (mit Fusszeile), 2 fast gleiche, 1 anderer
  const code = lonely[1], T = 'Der Zauberlack auf der Leinwand blättert an den Rändern ab';
  const mini = [{ t: T, c: code }, { t: T + '\nSent from my iPhone', c: code }, { t: 'Rechnung doppelt erhalten, bitte eine stornieren', c: '50103' },
    { t: 'Die Tasse hat nach dem Spülen Risse in der Glasur', c: lonely[4] }, { t: 'Leider: die Tasse hat nach dem Spülen Risse in der Glasur', c: lonely[4] }];
  const r = evalAll(E, mini);
  assert.strictEqual(r.sameText, 2);
  assert.strictEqual(r.nearDup, 2);
  assert.deepStrictEqual(r.details.map(d => d.nearDup), [false, false, false, true, true]);
});
test('eingebaute Beispiele (BEISPIELE) mit gleichem Text zählen nicht', () => {
  const cs = synth.slice(0, 120).concat([UNIQUE]);
  const E0 = engineWith([]), r0 = evalAll(E0, cs);
  const EB = engineWith(cs.map(x => ({ t: E.learnText(x.t), c: x.c })).filter(x => x.t)), rB = evalAll(EB, cs);
  const iu = cs.length - 1, d0 = r0.details.find(d => d.i === iu), dB = rB.details.find(d => d.i === iu);
  assert.ok(!d0.top.regeln.includes(UNIQUE.c), 'Voraussetzung: Stichwörter finden den Code nicht');
  ['regeln', 'gelernt', 'gelernt_streng', 'nurfaelle'].forEach(id => assert.ok(!dB.top[id].includes(UNIQUE.c), id + ' ' + JSON.stringify(dB.top)));
  // nicht 100 %: jeder Fall findet sich nicht selbst
  const V = {}; rB.variants.forEach(v => { V[v.id] = v; });
  assert.ok(V.regeln.top1 < V.regeln.n && V.nurfaelle.top1 < V.nurfaelle.n, JSON.stringify(rB.variants));
  // ein leicht anderer Text als Beispiel zählt, aber nicht ohne fast gleiche Texte
  const EN = engineWith([{ t: 'Kundin schreibt, ' + UNIQUE.t, c: UNIQUE.c }]), dN = evalAll(EN, cs).details.find(d => d.i === iu);
  assert.ok(dN.top.regeln.includes(UNIQUE.c) && dN.top.gelernt.includes(UNIQUE.c), JSON.stringify(dN.top));
  assert.ok(!dN.top.gelernt_streng.includes(UNIQUE.c), JSON.stringify(dN.top));
  assert.strictEqual(dN.nearDup, false);   // zählt nur importierte Fälle
  // langer Text: das Beispiel ist der gekürzte gespeicherte Text (learnText) und zählt trotzdem als gleicher Text
  const long = { t: 'Guten Tag\n\n' + 'Die Glanzfolie auf dem Umschlag hat Blasen und löst sich an den Ecken. '.repeat(20) + '\n\nFreundliche Grüsse\nAnna Beispiel', c: UNIQUE.c };
  assert.ok(E.learnable(long.t).length > 1000);
  const EL = engineWith([{ t: E.learnText(long.t), c: long.c }]), dL = evalAll(EL, synth.slice(0, 40).concat([long])).details.find(d => d.i === 40);
  ['regeln', 'gelernt', 'nurfaelle'].forEach(id => assert.ok(!dL.top[id].includes(long.c), id + ' ' + JSON.stringify(dL.top)));
});
test('ähnliche Fälle = gespeicherter Text (learnText, höchstens LEARN_MAX Zeichen)', () => {
  // zwei lange Mails mit gleichem Code: vorne nur Füllwörter (ohne Stämme), das Entscheidende erst nach 1000 Zeichen
  const FILL = 'Ich habe leider schon wieder eine Frage, weil es doch immer noch nicht geht und ich jetzt auch nicht mehr weiss, was ich machen soll. ';
  const code = lonely[5], mk = (n, tail) => ({ t: FILL.repeat(n) + tail, c: code });
  const tails = ['Der Zauberlack auf dem Kalender blättert ab und riecht stark.', 'Beim Kalender blättert der Zauberlack ab, er riecht stark.'];
  const longs = tails.map(x => mk(9, x)), shorts = tails.map(x => mk(1, x));
  assert.ok(longs.every(x => E.learnable(x.t).length > 1000 && !E.learnable(E.learnText(x.t))), 'gespeicherter Text ohne Inhalt');
  assert.ok(shorts.every(x => E.learnText(x.t).includes('Zauberlack')));
  const others = synth.slice(0, 40);
  const rl = evalAll(E, others.concat(longs)).details.filter(d => d.i >= 40), rs = evalAll(E, others.concat(shorts)).details.filter(d => d.i >= 40);
  assert.strictEqual(rl.length, 2);
  rl.forEach(d => assert.ok(!d.top.nurfaelle.includes(code), 'lang ' + JSON.stringify(d.top)));
  rs.forEach(d => assert.strictEqual(d.top.nurfaelle[0], code, 'kurz ' + JSON.stringify(d.top)));
  // gleich wie im Tool nach dem Lernen der gespeicherten Texte (der gesuchte Text bleibt vollständig)
  const learnedCodes = q => E.classify(q, { max: 99, rel: 0.0001, minAbs: 0.0001 }).filter(r => r.learned).map(r => r.c.code);
  E.setExamples([{ t: E.learnText(longs[1].t), c: code }]);
  assert.deepStrictEqual(learnedCodes(longs[0].t), []);
  E.setExamples([{ t: E.learnable(longs[1].t), c: code }]);   // Gegenprobe: ungekürzt gespeichert würde er gefunden
  assert.deepStrictEqual(learnedCodes(longs[0].t), [code]);
  E.setExamples([{ t: E.learnText(shorts[1].t), c: code }]);
  assert.deepStrictEqual(learnedCodes(shorts[0].t), [code]);
  E.setExamples(LEARNED);
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
  assert.strictEqual(r.nearDup, r.details.filter(d => d.nearDup).length);
  assert.strictEqual(r.sameText, R.sameText);   // über alle verwendbaren Fälle
  // alle lernbaren Fälle bleiben Nachbarn: gleiche Vorschläge wie ohne Stichprobe
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
  assert.strictEqual(R.perCode.reduce((s, p) => s + p.n, 0), R.tested);
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
// erwartete Wortstatistik (unabhängig nachgerechnet): ohne Namen im unbereinigten Text (mit Gross-/Kleinschreibung):
// unbekanntes Wort nach Frau/Herr …; nach Kunde/Kd./Name nur mit Grossbuchstaben oder alles klein ("kd. muster")
const CUE_T = new Set(['frau', 'herr', 'herrn', 'hr', 'fr', 'familie', 'fam']), CUE_K = new Set(['kunde', 'kundin', 'kd', 'kde', 'kdin', 'name']);
// bekanntes Wort oder Abkürzung? (von aussen gemessen: bleibt als 2. Wort nach "Frau Anna" stehen)
const capF = w => w[0].toUpperCase() + w.slice(1), knownMemo = {};
const knownWord = w => knownMemo[w] !== undefined ? knownMemo[w] : (knownMemo[w] = E.prepare('Frau Anna ' + capF(w) + ' ruft an').cleaned.includes(capF(w)));
function nameWords(t) {
  const rt = String(t).match(/[\p{L}\p{N}]+/gu) || [], names = new Set();
  rt.forEach((w, k) => {
    const cue = k ? E.norm(rt[k - 1]) : '';
    if (!(CUE_T.has(cue) || CUE_K.has(cue)) || knownWord(w)) return;
    if (CUE_K.has(cue) && !/^\p{Lu}/u.test(w) && /^\p{Lu}/u.test(rt[k - 1])) return;
    E.norm(w).split(' ').forEach(x => names.add(x));
  });
  return names;
}
function wordStats(cs, idx) {
  const docs = {}, dfAll = {}, n = {}, ok = w => w.length >= 4 && !/^\d+$/.test(w);
  idx.forEach(i => {
    const c = cs[i].c, all = E.norm(E.prepare(text(cs[i])).text).split(' ');
    const names = nameWords(text(cs[i]));
    const ws = new Set(all.filter(w => ok(w) && !names.has(w)));
    n[c] = (n[c] || 0) + 1;
    ws.forEach(w => { docs[c + ' ' + w] = (docs[c + ' ' + w] || 0) + 1; dfAll[w] = (dfAll[w] || 0) + 1; });
  });
  return { docs, dfAll, n, ok };
}
test('Bericht: häufige Wörter je Code', () => {
  const minDocs = 5, { docs, dfAll, n, ok } = wordStats(cases, usableIdx);
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
test('Wortstatistik ohne Namen', () => {
  const code = lonely[6];
  const named = ['Kd. Zwahlen ruft an, Lieferung fehlt', 'frau zwahlen meldet: Lieferung fehlt immer noch', 'Kundin Zwahlen wartet auf die Lieferung',
    'Rückruf Frau Zwahlen, Lieferung verzögert', 'Fr. Bettina Zwahlen: Lieferung fehlt', 'Lieferung fehlt weiterhin.\n--\nBettina Zwahlen',
    'Mein Glitzerkalender ist noch nicht da.\n\nFreundliche Grüsse\nBettina Zwahlen', 'Herr zwahlen fragt nach dem Glitzerkalender',
    'Kunde zwahlen reklamiert erneut die Lieferung']
    .map(t => ({ t, c: code }));
  const r = evalAll(E, synth.concat(named), { minDocs: 5 }), w = r.words.find(x => x.code === code);
  assert.ok(w && w.n === named.length, JSON.stringify(w));
  assert.ok(!w.words.some(([x]) => /zwahlen|bettina/.test(x)), JSON.stringify(w.words));
  assert.ok(w.words.some(([x]) => x === 'lieferung'), JSON.stringify(w.words));   // normale Wörter bleiben
});
test('Wortstatistik: Wort nach Kunde/Kd./Name ist kein Name, wenn es klein geschrieben oder bekannt ist', () => {
  const V = ['heute', 'gestern', 'erneut', 'telefonisch', 'per Mail', 'nochmals'];
  // [Vorlage, Wort, das in der Liste stehen muss]
  const G = [[v => 'Kunde storniert Bestellung ' + v + ', doppelt bestellt', 'storniert'], [v => 'Kd. Farbstich auf allen Seiten ' + v, 'farbstich'],
    [v => 'Kundin reklamiert Leinwand ' + v, 'reklamiert'], [v => 'Kd. GS ungültig ' + v, 'gutschein'], [v => 'Name falsch gedruckt ' + v, 'falsch'],
    [v => 'kd. storniert Bestellung ' + v, 'storniert']];
  // Namen bleiben draussen: "Kd. Zwahlen", "kd. zwahlen", "Kundin Zwahlen", "Name: Zwahlen"
  const N = [v => 'Kd. Zwahlen ' + v + ' Gutschein ungültig', v => 'kd. zwahlen ' + v + ' Gutschein ungültig', v => 'Kundin Zwahlen ' + v + ' Gutschein ungültig'];
  const extra = [];
  G.forEach(([f], g) => V.forEach(v => extra.push({ t: f(v), c: lonely[7 + g] })));
  N.forEach((f, g) => V.forEach(v => extra.push({ t: f(v), c: lonely[7 + G.length + g] })));
  const r = evalAll(E, synth.concat(extra), { minDocs: 5 });
  G.forEach(([f, want], g) => {
    const w = r.words.find(x => x.code === lonely[7 + g]);
    assert.ok(w && w.words.some(([x]) => x === want), f('…') + ': ' + JSON.stringify(w && w.words));
  });
  N.forEach((f, g) => {
    const w = r.words.find(x => x.code === lonely[7 + G.length + g]);
    assert.ok(w && w.words.length && !w.words.some(([x]) => /zwahlen/.test(x)), f('…') + ': ' + JSON.stringify(w && w.words));
  });
  // wie die unabhängige Nachrechnung
  const cs = synth.concat(extra), idx = cs.map((x, i) => i), { docs } = wordStats(cs, idx);
  r.words.forEach(x => x.words.forEach(([w, d]) => assert.strictEqual(d, docs[x.code + ' ' + w], `${x.code} ${w}`)));
});
E.setExamples([]);

// ------------------------------------------------------------------
// d) Geschwindigkeit
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
