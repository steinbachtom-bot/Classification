// Tests für den Tabellen-Import (src/table.js): node tests/unit-table.js
// Alle Testdaten sind erfunden. Excel-Dateien werden hier mit einem kleinen ZIP-Schreiber gebaut.
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const T = require('../src/table.js');

// echte Klassifizierungen aus data.js (wie in run-tests.js)
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/data.js'), 'utf8') +
  ';this.S=SYN;this.K=KLASSEN;this.A=ALT_LABELS;this.ABK=ABK;this.B=BEISPIELE;', ctx);
const E = require(path.join(ROOT, 'src/engine.js'));
const built = E.build(ctx.S, ctx.K, ctx.A, ctx.ABK, ctx.B);
const resolve = T.codeResolver(built.classes);

const tests = [];
const check = (name, fn) => tests.push([name, fn]);
const eq = assert.deepStrictEqual;
const u8 = s => new Uint8Array(Buffer.from(s, 'utf8'));
async function rejects(p, code) {
  let err = null;
  try { await p; } catch (e) { err = e; }
  assert.ok(err, 'Fehler erwartet (' + code + ')');
  assert.strictEqual(err.code, code, 'Code ' + err.code + ' statt ' + code + ': ' + err.message);
  return err;
}

/* ---------- kleiner ZIP-Schreiber ---------- */
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(b) { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
// files: { name, data, store, method, flags, localExtra, centralExtra, raw }
// Zusatzfeld (lokal und im Verzeichnis verschieden lang, wie bei echten Dateien möglich)
const extra = n => { const b = Buffer.alloc(n || 0, 0x2A); if (n) { b.writeUInt16LE(0x7A7A, 0); b.writeUInt16LE(n - 4, 2); } return b; };
function zip(files, comment = '') {
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const data = Buffer.from(f.data, 'utf8'), name = Buffer.from(f.name, 'utf8');
    const method = f.method != null ? f.method : f.store ? 0 : 8;
    const comp = f.raw || (method === 8 ? zlib.deflateRawSync(data) : data);
    const lx = extra(f.localExtra), cx = extra(f.centralExtra), flags = (f.flags || 0) | 0x800;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0x6000, 10); lh.writeUInt16LE(0x5B38, 12); lh.writeUInt32LE(crc32(data), 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(lx.length, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0x6000, 12); ch.writeUInt16LE(0x5B38, 14); ch.writeUInt32LE(crc32(data), 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(cx.length, 30); ch.writeUInt32LE(off, 42);
    parts.push(lh, name, lx, comp); central.push(ch, name, cx);
    off += 30 + name.length + lx.length + comp.length;
  }
  const cd = Buffer.concat(central), cm = Buffer.from(comment, 'utf8'), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(cm.length, 20);
  return new Uint8Array(Buffer.concat([...parts, cd, eocd, cm]));
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const workbook = sheets => HEAD + `<workbook ${NS}><bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
  sheets.map((s, i) => `<sheet name="${s[0]}" sheetId="${i + 1}"${s[2] ? ' state="' + s[2] + '"' : ''} r:id="${s[1]}"/>`).join('') + '</sheets></workbook>';
const rels = list => HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}${type}" Target="${target}"/>`).join('') + '</Relationships>';
const sheet = rows => HEAD + `<worksheet ${NS}><dimension ref="A1:E9"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
  '<sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="2" width="40" customWidth="1"/></cols>' +
  `<sheetData>${rows}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
const common = [
  { name: '[Content_Types].xml', store: true, data: HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    ['sheet1', 'sheet2'].map(n => `<Override PartName="/xl/worksheets/${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>' },
  { name: '_rels/.rels', data: rels([['rId1', 'officeDocument', 'xl/workbook.xml']]), store: true },
];

// Hauptbeispiel: 2 Blätter, das erste der Arbeitsmappe ist sheet2.xml (absolutes Ziel), sharedStrings mit Rich-Text und rPh
const SST = HEAD + '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="9" uniqueCount="9">' +
  '<si><t>Betreff</t></si>' +                                                        // 0
  '<si><t>Beschreibung</t></si>' +                                                   // 1
  '<si><t>Klassifizierung</t></si>' +                                                // 2
  '<si><r><rPr><b/><sz val="11"/><rFont val="Calibri"/></rPr><t>Fotobuch </t></r><r><rPr><i/></rPr><t xml:space="preserve">nicht </t></r><r><t>erhalten</t></r></si>' + // 3
  '<si><t>Tassen-Reklamation</t><rPh sb="0" eb="5"><t>TASSEN</t></rPh><phoneticPr fontId="1" type="noConversion"/></si>' + // 4
  '<si><t xml:space="preserve">  Zeile 1_x000D_\nZeile 2 &amp; &lt;b&gt; &quot;x&quot; &apos;y&apos; &#252; &#xE4; &#x1F600; _x005F_x000D_  </t></si>' + // 5
  '<si/>' +                                                                          // 6
  '<si><t/></si>' +                                                                  // 7
  '<si><t>Lieferverzögerung</t></si>' +                                              // 8
  '</sst>';
const SHEET2 = sheet(
  '<row r="1" spans="1:3"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
  '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="inlineStr"><is><t>Kunde wartet seit 3 Wochen</t></is></c><c r="C2"><v>50410</v></c></row>' +
  '<row r="3"><c r="A3" s="1" t="s"><v>5</v></c><c r="C3" t="s"><v>8</v></c><c r="D3" s="2"/></row>' +
  '<row r="4"/>' +
  '<row r="5"><c r="A5" t="s"><v>6</v></c><c r="B5" t="s"><v>7</v></c><c r="C5" s="1"/></row>' +
  '<row r="6"><c t="inlineStr"><is><r><t>Ohne</t></r><r><t xml:space="preserve"> Referenz</t></r></is></c><c t="n"><v>515</v></c>' +
  '<c t="str"><f>A1&amp;"x"</f><v>Formel &amp; Text</v></c></row>' +
  '<row r="9"><c r="A9" t="s"><v>4</v></c><c r="B9" t="b"><v>1</v></c><c r="C9" t="e"><v>#N/A</v></c><c r="E9" t="inlineStr"><is><t>E</t></is></c></row>');
const SHEET1 = sheet('<row r="1"><c r="A1" t="inlineStr"><is><t>FALSCHES BLATT</t></is></c></row>');
const MAIN = zip([...common,
  { name: 'xl/workbook.xml', data: workbook([['Fälle &amp; Codes', 'rId2'], ['Liste', 'rId1']]), store: true },
  { name: 'xl/_rels/workbook.xml.rels', data: rels([['rId1', 'worksheet', 'worksheets/sheet1.xml'], ['rId2', 'worksheet', '/xl/worksheets/sheet2.xml'],
    ['rId3', 'sharedStrings', 'sharedStrings.xml'], ['rId4', 'styles', 'styles.xml']]), store: true, centralExtra: 4 },
  { name: 'xl/worksheets/sheet1.xml', data: SHEET1 },
  { name: 'xl/worksheets/sheet2.xml', data: SHEET2, localExtra: 12 },
  { name: 'xl/sharedStrings.xml', data: SST, localExtra: 4, centralExtra: 8 },
  { name: 'xl/styles.xml', data: HEAD + '<styleSheet/>' },
], 'erfundene Testdatei');
const MAIN_ROWS = [
  ['Betreff', 'Beschreibung', 'Klassifizierung', '', ''],
  ['Fotobuch nicht erhalten', 'Kunde wartet seit 3 Wochen', '50410', '', ''],
  ['  Zeile 1\nZeile 2 & <b> "x" \'y\' ü ä \u{1F600} _x000D_  ', '', 'Lieferverzögerung', '', ''],
  ['Ohne Referenz', '515', 'Formel & Text', '', ''],
  ['Tassen-Reklamation', 'TRUE', '#N/A', '', 'E'],
];

check('Test-ZIP-Schreiber: CRC32 wie zlib', () => {
  const b = Buffer.from('Fälle & Codes 50410', 'utf8');
  eq(crc32(Buffer.from('123456789')), 0xCBF43926);
  if (zlib.crc32) eq(crc32(b), zlib.crc32(b));
});

/* ---------- Zeichensatz ---------- */
check('decode: UTF-8 ohne BOM', () => eq(T.decode(u8('Grüsse;50410')), 'Grüsse;50410'));
check('decode: UTF-8 mit BOM', () => eq(T.decode(new Uint8Array([0xEF, 0xBB, 0xBF, ...u8('Kürzel;Code')])), 'Kürzel;Code'));
check('decode: windows-1252 (ü, ä, €)', () => {
  const b = Buffer.concat([Buffer.from('Br', 'latin1'), Buffer.from([0xFC]), Buffer.from('cke;K', 'latin1'), Buffer.from([0xE4]), Buffer.from('se ', 'latin1'), Buffer.from([0x80])]);
  eq(T.decode(b), 'Brücke;Käse €');
});
check('decode: UTF-16LE mit BOM', () => eq(T.decode(Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('Text\tCode\nÜbergrösse\t50409', 'utf16le')])), 'Text\tCode\nÜbergrösse\t50409'));
check('decode: UTF-16LE ohne BOM (erkannt an Nullbytes)', () => eq(T.decode(Buffer.from('Text;Code\nTasse kaputt;517', 'utf16le')), 'Text;Code\nTasse kaputt;517'));
check('decode: UTF-16BE mit BOM', () => {
  const le = Buffer.from('Grüsse;515', 'utf16le'), be = Buffer.alloc(le.length);
  for (let i = 0; i < le.length; i += 2) { be[i] = le[i + 1]; be[i + 1] = le[i]; }
  eq(T.decode(Buffer.concat([Buffer.from([0xFE, 0xFF]), be])), 'Grüsse;515');
});
check('decode: ArrayBuffer und Teil-Ansicht', () => {
  const b = u8('xxÄnderung;6102');
  eq(T.decode(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), 'xxÄnderung;6102');
  eq(T.decode(b.subarray(2)), 'Änderung;6102');
});

/* ---------- Trennzeichen und CSV ---------- */
check('CSV ";" mit Anführungszeichen, ; und Zeilenumbruch im Feld, ""', () => {
  const txt = 'Betreff;Beschreibung;Code\n"Lieferung; verspätet";"Kunde schreibt:\n""Wo bleibt mein Fotobuch?""";50410\nTasse kaputt;Henkel abgebrochen;517\n';
  eq(T.detectDelimiter(txt), ';');
  eq(T.parseDelimited(txt), [['Betreff', 'Beschreibung', 'Code'],
    ['Lieferung; verspätet', 'Kunde schreibt:\n"Wo bleibt mein Fotobuch?"', '50410'], ['Tasse kaputt', 'Henkel abgebrochen', '517']]);
});
check('CSV mit Komma', () => {
  const txt = 'Text,Code\n"Rechnung falsch, bitte korrigieren",50103\nGutschein geht nicht,20709\n"Doppelt bezahlt, Geld zurück",50104';
  eq(T.detectDelimiter(txt), ',');
  eq(T.parseDelimited(txt), [['Text', 'Code'], ['Rechnung falsch, bitte korrigieren', '50103'], ['Gutschein geht nicht', '20709'], ['Doppelt bezahlt, Geld zurück', '50104']]);
});
check('TSV aus Excel kopiert (mehrzeilige Zelle, CRLF, Zeilenumbruch am Ende)', () => {
  const txt = 'Notiz\tCode\r\n"Kd. ruft an\nFB n. erh.; Tracking offen"\t50410\r\nTracking seit Tagen gleich\t50407\r\n';
  eq(T.detectDelimiter(txt), '\t');
  eq(T.parseDelimited(txt), [['Notiz', 'Code'], ['Kd. ruft an\nFB n. erh.; Tracking offen', '50410'], ['Tracking seit Tagen gleich', '50407']]);
});
check('CRLF und \\r\\n im Feld wird \\n', () => {
  eq(T.parseDelimited('a;b\r\n"x\r\ny";d\r\n'), [['a', 'b'], ['x\ny', 'd']]);
  eq(T.parseDelimited('a;b\rc;d\r'), [['a', 'b'], ['c', 'd']]);
});
check('Leere Zeilen werden entfernt', () => eq(T.parseDelimited('a;b\n\n;\n  ; \nc;d\n\n\n', ';'), [['a', 'b'], ['c', 'd']]));
check('Ungleich lange Zeilen werden aufgefüllt', () => {
  const txt = 'a;b;c\nd\ne;f';
  eq(T.detectDelimiter(txt), ';');
  eq(T.parseDelimited(txt), [['a', 'b', 'c'], ['d', '', ''], ['e', 'f', '']]);
});
check('Eine Spalte (Kommas nur in einzelnen Zeilen)', () => {
  const txt = 'Fotobuch nicht erhalten\nTasse kaputt, Henkel ab\nRechnung doppelt\n';
  eq(T.detectDelimiter(txt), '\t');
  eq(T.parseDelimited(txt), [['Fotobuch nicht erhalten'], ['Tasse kaputt, Henkel ab'], ['Rechnung doppelt']]);
});
check('Trennzeichen |, Vorrang bei Gleichstand, Anführungszeichen beachtet', () => {
  eq(T.detectDelimiter('a|b\nc|d'), '|');
  eq(T.detectDelimiter('a;b,c\nd;e,f'), ';');
  eq(T.detectDelimiter('a\tb;c\nd\te;f'), '\t');
  eq(T.detectDelimiter('"x;y;z",1\n"p;q",2\n"r",3'), ',');
  eq(T.detectDelimiter(''), '\t');
});
check('Felder: Text wie geliefert, " mitten im Feld, leeres letztes Feld', () => {
  eq(T.parseDelimited(' a ;5" Bild;\n"x"y;;z', ';'), [[' a ', '5" Bild', ''], ['xy', '', 'z']]);
  eq(T.parseDelimited('"offen;ohne Ende\nweiter', ';'), [['offen;ohne Ende\nweiter']]);
  eq(T.parseDelimited('﻿a;b'), [['a', 'b']]);
});

/* ---------- Excel ---------- */
check('Signaturen xlsx/xls', () => {
  assert.ok(T.isXlsx(MAIN)); assert.ok(!T.isXls(MAIN));
  const xls = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0]);
  assert.ok(T.isXls(xls)); assert.ok(!T.isXlsx(xls)); assert.ok(!T.isXlsx(u8('a;b')));
});
check('xlsx: erstes Blatt der Arbeitsmappe, sharedStrings, Rich-Text, rPh, inlineStr, Lücken, Entities', async () => {
  const x = await T.readXlsx(MAIN);
  eq(x.sheet, 'Fälle & Codes');
  eq(x.sheets, ['Fälle & Codes', 'Liste']);
  eq(x.rows, MAIN_ROWS);
});
check('xlsx: ohne sharedStrings, relatives Ziel, Präfix x:, A1 dann C1, Spalte AA', async () => {
  const s = HEAD + '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>' +
    '<x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>Text</x:t></x:is></x:c><x:c r="C1" t="inlineStr"><x:is><x:t>Code</x:t></x:is></x:c></x:row>' +
    '<x:row r="2"><x:c r="A2" t="inlineStr"><x:is><x:t>Leinwand hat Kratzer</x:t></x:is></x:c><x:c r="C2"><x:v>362</x:v></x:c></x:row>' +
    '<x:row r="3"><x:c r="Z3"><x:v>1</x:v></x:c><x:c r="AA3"><x:v>2.5</x:v></x:c></x:row>' +
    '</x:sheetData></x:worksheet>';
  const z = zip([...common,
    { name: 'xl/workbook.xml', data: workbook([['Tabelle1', 'rId1']]) },
    { name: 'xl/_rels/workbook.xml.rels', data: rels([['rId1', 'worksheet', 'worksheets/sheet1.xml']]) },
    { name: 'xl/worksheets/sheet1.xml', data: s, store: true }]);
  const x = await T.readXlsx(z);
  eq(x.sheet, 'Tabelle1'); eq(x.sheets, ['Tabelle1']);
  const e = n => Array(n).fill('');
  eq(x.rows, [['Text', '', 'Code', ...e(24)], ['Leinwand hat Kratzer', '', '362', ...e(24)], [...e(25), '1', '2.5']]);
});
check('xlsx: ohne Arbeitsmappe -> sheetN.xml mit kleinster Nummer', async () => {
  const z = zip([
    { name: 'xl/worksheets/sheet10.xml', data: sheet('<row r="1"><c r="A1" t="inlineStr"><is><t>zehn</t></is></c></row>') },
    { name: 'xl/worksheets/sheet2.xml', data: sheet('<row r="1"><c r="A1" t="inlineStr"><is><t>zwei</t></is></c></row>') }]);
  const x = await T.readXlsx(z);
  eq(x.rows, [['zwei']]); eq(x.sheet, 'sheet2');
});
check('xlsx: ausgeblendetes erstes Blatt wird übersprungen', async () => {
  const z = zip([
    { name: 'xl/workbook.xml', data: workbook([['Versteckt', 'rId1', 'hidden'], ['Sicht>bar', 'rId2']]) },
    { name: 'xl/_rels/workbook.xml.rels', data: rels([['rId1', 'worksheet', 'worksheets/sheet1.xml'], ['rId2', 'worksheet', 'worksheets/sheet2.xml']]) },
    { name: 'xl/worksheets/sheet1.xml', data: sheet('<row r="1"><c r="A1"><v>1</v></c></row>') },
    { name: 'xl/worksheets/sheet2.xml', data: sheet('<row r="1"><c r="A1"><v>2</v></c></row>') }]);
  const x = await T.readXlsx(z);
  eq(x.sheet, 'Sicht>bar'); eq(x.rows, [['2']]); eq(x.sheets, ['Versteckt', 'Sicht>bar']);
});
check('xlsx: nicht unterstützte ZIP-Dateien -> Fehler ZIP', async () => {
  const s = sheet('<row r="1"><c r="A1"><v>1</v></c></row>');
  await rejects(T.readXlsx(zip([{ name: 'xl/worksheets/sheet1.xml', data: s, flags: 1 }])), 'ZIP');                  // verschlüsselt
  await rejects(T.readXlsx(zip([{ name: 'xl/worksheets/sheet1.xml', data: s, method: 12, store: true }])), 'ZIP');   // bzip2
  await rejects(T.readXlsx(zip([{ name: 'xl/worksheets/sheet1.xml', data: s, method: 8, raw: Buffer.from([0xFF, 0xFF, 0xFF, 1, 2, 3]) }])), 'ZIP'); // kaputt
  await rejects(T.readXlsx(zip([{ name: 'hallo.txt', data: 'kein Excel' }])), 'ZIP');                                  // keine Tabelle
  await rejects(T.readXlsx(new Uint8Array([0x50, 0x4B, 3, 4, 1, 2, 3, 4, 5])), 'ZIP');                                 // abgeschnitten
  const z64 = zip([{ name: 'xl/worksheets/sheet1.xml', data: s }]);
  new DataView(z64.buffer).setUint16(z64.length - 12, 0xFFFF, true);                                                   // ZIP64-Markierung
  await rejects(T.readXlsx(z64), 'ZIP');
});

/* ---------- read() ---------- */
check('read: xlsx, Text, HTML-Tabelle', async () => {
  const x = await T.read(MAIN, 'faelle.xlsx');
  eq(x.format, 'xlsx'); eq(x.sheet, 'Fälle & Codes'); eq(x.rows, MAIN_ROWS);
  const c = await T.read(new Uint8Array(Buffer.from('Text;Code\nTasse kaputt;517\n', 'latin1')).buffer, 'faelle.csv');
  eq(c, { rows: [['Text', 'Code'], ['Tasse kaputt', '517']], format: 'text', delimiter: ';' });
  const h = await T.read(u8('<html><body><table><tr><th>Betreff</th><th>Code</th></tr>' +
    '<tr><td title="a>b" class=x1>Fotobuch&nbsp;besch&auml;digt<br style="mso-data-placement:same-cell">Ecke   eingedr&#252;ckt</td><td>518</td></tr><tr><td></td><td> </td></tr></table></body></html>'), 'export.xls');
  eq(h, { rows: [['Betreff', 'Code'], ['Fotobuch beschädigt\nEcke eingedrückt', '518']], format: 'html' });
});
check('read: altes .xls -> Fehler XLS (auch passwortgeschützt)', async () => {
  const xls = new Uint8Array(600); xls.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  const e1 = await rejects(T.read(xls, 'alt.xls'), 'XLS');
  assert.ok(!e1.encrypted);
  xls.set(Buffer.from('EncryptedPackage', 'utf16le'), 300);
  const e2 = await rejects(T.read(xls.buffer, 'geschuetzt.xlsx'), 'XLS');
  assert.ok(e2.encrypted);
});

/* ---------- norm und Codes ---------- */
check('norm gleich wie Engine.norm', () => {
  for (const s of ['Lieferverzögerung', 'Grüsse aus Zürich', 'Café  crème', 'STRASSE ß', 'a-b_c/d 50410', '', '  x  '])
    eq(T.norm(s), E.norm(s));
});
check('Codes: Zahlen', () => {
  eq(resolve('50410'), '50410'); eq(resolve(' 50410 '), '50410'); eq(resolve('50410.0'), '50410'); eq(resolve(50410), '50410');
  eq(resolve('50410 - Lieferverzögerung'), '50410'); eq(resolve('Lieferverzögerung (50410)'), '50410');
  eq(resolve('515'), '515'); eq(resolve('Code 99999 / 50407'), '50407');
  eq(resolve('99999'), null); eq(resolve('123456'), null); eq(resolve('5041'), null);
  eq(resolve(''), null); eq(resolve('   '), null); eq(resolve(null), null); eq(resolve(undefined), null);
});
check('Codes: Bezeichnung und alte Bezeichnung', () => {
  eq(resolve('Lieferverzögerung'), '50410'); eq(resolve('LIEFERVERZOEGERUNG'), '50410');
  eq(resolve('Keine Rückmeldung'), '3709'); eq(resolve('Keine Rückmeldung Kunde'), '3709');
  eq(resolve('Sonstiges Versand'), '515'); eq(resolve('Zustellungsbeschwerde'), '515');
  eq(resolve('Photobook Sharing'), null);   // 20205 und 30215 heissen gleich
  eq(resolve('constructor'), null);
});
check('Codes: längste enthaltene Bezeichnung', () => {
  eq(resolve('Operations > Herstellung mech. Beschädigung Seite eingerissen'), '342');
  eq(resolve('Kategorie: Doppelbestellung'), '50702');
  eq(resolve('Frage zu Photobook Sharing'), null);   // mehrdeutig
  eq(resolve('Lieferverzögerungen'), null);          // nur ganze Wörter
  eq(resolve('Sonstwas'), null);
});

/* ---------- Spalten erkennen und Fälle bilden ---------- */
const MIT_KOPF = T.parseDelimited([
  'Betreff;Beschreibung;Klassifizierung;E-Mail',
  'Fotobuch nicht erhalten;Die Bestellung ist seit drei Wochen unterwegs, Tracking zeigt nichts Neues;50410;kundin.a@example.com',
  'Tasse kaputt;Henkel war beim Auspacken abgebrochen, Karton eingedrückt;517;kunde.b@example.com',
  'Rechnung;Rechnung zweimal erhalten und beide bezahlt, bitte Geld zurück;50104 - Rückerstattung;kunde.c@example.com',
  ';Gutscheincode wird im Warenkorb nicht akzeptiert;Checkout Gutschein nicht akzeptiert;kunde.d@example.com',
  'Adresse;Neue Adresse für die nächste Lieferung;;kunde.e@example.com',
  'Frage;Kunde fragt nach einem alten Code;77777;kunde.f@example.com',
  'Leer;;50410;kunde.g@example.com',
].join('\n'));
check('guess: Kopfzeile Betreff;Beschreibung;Klassifizierung;E-Mail', () =>
  eq(T.guess(MIT_KOPF, resolve), { header: true, codeCol: 2, textCols: [0, 1] }));
check('toCases: Texte zusammengefügt, ohne Code, unbekannte Codes, ohne Text', () => {
  const r = T.toCases(MIT_KOPF, T.guess(MIT_KOPF, resolve), resolve);
  eq(r.cases, [
    { t: 'Fotobuch nicht erhalten\nDie Bestellung ist seit drei Wochen unterwegs, Tracking zeigt nichts Neues', c: '50410', row: 1 },
    { t: 'Tasse kaputt\nHenkel war beim Auspacken abgebrochen, Karton eingedrückt', c: '517', row: 2 },
    { t: 'Rechnung\nRechnung zweimal erhalten und beide bezahlt, bitte Geld zurück', c: '50104', row: 3 },
    { t: 'Gutscheincode wird im Warenkorb nicht akzeptiert', c: '20709', row: 4 },
    { t: 'Leer', c: '50410', row: 7 },
  ]);
  eq([r.total, r.noCode, r.noText], [7, 2, 0]);
  eq(r.unknown, [['77777', 1]]);
  const r2 = T.toCases(MIT_KOPF, { header: true, codeCol: 2, textCols: [1] }, resolve);
  eq([r2.cases.length, r2.noText, r2.noCode], [4, 1, 2]);
});
check('guess: ohne Kopfzeile, Datum und Telefon werden nicht als Text genommen', () => {
  const rows = [
    ['2026-01-05', '+41 00 000 00 01', 'Kunde hat doppelt bezahlt, bitte Rückerstattung', '50104'],
    ['2026-01-06', '+41 00 000 00 02', 'Fotobuch mit Knick in der Ecke angekommen', '518'],
    ['2026-01-07', '+41 00 000 00 03', 'Wo bleibt meine Leinwand? Schon zwei Wochen', '50410'],
    ['2026-01-08', '', 'Newsletter abmelden bitte', '50601'],
  ];
  eq(T.guess(rows, resolve), { header: false, codeCol: 3, textCols: [2] });
  const r = T.toCases(rows, T.guess(rows, resolve), resolve);
  eq([r.total, r.cases.length, r.cases[0].row, r.cases[0].c], [4, 4, 0, '50104']);
});
check('guess: Code-Spalte nur mit Bezeichnungen', () => {
  const rows = T.parseDelimited('Fall\tKategorie\n' +
    'Kundin wartet seit zwei Wochen auf ihr Fotobuch\tLieferverzögerung\n' +
    'Hat versehentlich zweimal bestellt\tDoppelbestellung\n' +
    'Neue Wohnadresse ab nächstem Monat\tAdressänderung\n' +
    'Seite im Buch ist eingerissen\tHerstellung mech. Beschädigung Seite eingerissen\n');
  const g = T.guess(rows, resolve);
  eq(g, { header: true, codeCol: 1, textCols: [0] });
  eq(T.toCases(rows, g, resolve).cases.map(c => c.c), ['50410', '50702', '6102', '342']);
});
check('guess: Kopfzeile mit Kundennr/Telefon/Datum, unbekannte Codes (Top 10)', () => {
  const lines = ['Datum;Kunden-Nr;Telefon;Notiz;Code'];
  for (let i = 0; i < 12; i++) for (let k = 0; k <= i; k++) lines.push(`0${1 + (i % 9)}.02.2026;${100000 + i};+41 00 000 00 ${10 + k};Alter Fall mit Code Nummer ${i};Alt-${i}`);
  for (let i = 0; i < 90; i++) lines.push(`03.03.2026;${200000 + i};+41 00 000 11 ${10 + (i % 80)};Tracking seit Tagen ohne Bewegung;50407`);
  const rows = T.parseDelimited(lines.join('\r\n'));
  const g = T.guess(rows, resolve);
  eq(g, { header: true, codeCol: 4, textCols: [3] });
  const r = T.toCases(rows, g, resolve);
  eq([r.total, r.cases.length, r.noCode], [78 + 90, 90, 78]);
  eq(r.unknown.length, 10);
  eq(r.unknown[0], ['Alt-11', 12]); eq(r.unknown[9], ['Alt-2', 3]);
});
check('guess: Zusatzspalte Betreff nur mit Kopfzeile, Bearbeiter ausgeschlossen', () => {
  const rows = T.parseDelimited('Nachricht,Bearbeiter,Klassifizierung,Titel\n' +
    '"Guten Tag, mein Fotobuch ist nicht angekommen",Agent Muster,50410,Nicht erhalten\n' +
    '"Die Tasse hat einen Sprung, bitte Ersatz",Agent Muster,517,Tasse\n');
  eq(T.guess(rows, resolve), { header: true, codeCol: 2, textCols: [0, 3] });
});
check('guess: ohne Code-Spalte, leere Tabelle, eine Zeile', () => {
  const rows = T.parseDelimited('Datum;Notiz\n01.02.2026;Kunde ruft wegen Lieferung an\n02.02.2026;Frage zur Rechnung, bitte zurückrufen');
  const g = T.guess(rows, resolve);
  eq(g, { header: true, codeCol: -1, textCols: [1] });
  const r = T.toCases(rows, g, resolve);
  eq([r.total, r.noCode, r.noText, r.cases.length, r.unknown.length], [2, 2, 0, 0, 0]);
  eq(T.guess([], resolve), { header: false, codeCol: -1, textCols: [] });
  eq(T.guess([['Fotobuch nicht erhalten, Tracking offen', '50407']], resolve), { header: false, codeCol: 1, textCols: [0] });
});
check('guess: erste Datenzeile mit unbekanntem Code ist keine Kopfzeile', () => {
  const rows = [['Kunde bekam das falsche Paket mit fremden Fotos', '99999'], ['Fotobuch kam zu spät, Geburtstag verpasst', '50410'],
    ['Leinwand mit Kratzer geliefert', '362']];
  eq(T.guess(rows, resolve), { header: false, codeCol: 1, textCols: [0] });
});
check('Ende-zu-Ende: CSV-Bytes (windows-1252) -> Fälle', async () => {
  const csv = Buffer.from('Beschreibung;Klassifizierung\r\n"Paket nie angekommen;\r\nPost sagt zugestellt";514\r\nKäse;?\r\n', 'latin1');
  const x = await T.read(csv, 'export.csv');
  const g = T.guess(x.rows, resolve);
  const r = T.toCases(x.rows, g, resolve);
  eq(r.cases, [{ t: 'Paket nie angekommen;\nPost sagt zugestellt', c: '514', row: 1 }]);
  eq(r.unknown, [['?', 1]]);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); } catch (e) { failed++; console.log('FEHLER  ' + name + '\n   ' + String(e && e.stack || e).split('\n').slice(0, 12).join('\n   ')); }
  }
  if (failed) { console.log(`Table: ${failed} von ${tests.length} Tests fehlgeschlagen`); process.exit(1); }
  console.log(`Table: ${tests.length} Tests OK`);
})();
