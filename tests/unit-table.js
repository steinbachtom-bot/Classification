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
  eq(T.parseDelimited('"offen;mit Ende\nweiter" ;x', ';'), [['offen;mit Ende\nweiter ', 'x']]);
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
  eq(x.sheet, 'Sicht>bar'); eq(x.rows, [['2']]); eq(x.sheets, ['Sicht>bar']); eq(x.sheetIndex, 0);
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
  eq(T.guess(MIT_KOPF, resolve), { headerRow: 0, codeCol: 2, textCols: [0, 1], fillDown: false }));
check('toCases: Texte zusammengefügt, ohne Code, unbekannte Codes, ohne Text', () => {
  const r = T.toCases(MIT_KOPF, T.guess(MIT_KOPF, resolve), resolve);
  eq(r.cases, [
    { t: 'Fotobuch nicht erhalten\nDie Bestellung ist seit drei Wochen unterwegs, Tracking zeigt nichts Neues', c: '50410', row: 1, line: 2 },
    { t: 'Tasse kaputt\nHenkel war beim Auspacken abgebrochen, Karton eingedrückt', c: '517', row: 2, line: 3 },
    { t: 'Rechnung\nRechnung zweimal erhalten und beide bezahlt, bitte Geld zurück', c: '50104', row: 3, line: 4 },
    { t: 'Gutscheincode wird im Warenkorb nicht akzeptiert', c: '20709', row: 4, line: 5 },
    { t: 'Leer', c: '50410', row: 7, line: 8 },
  ]);
  eq([r.total, r.noCode, r.noText, r.subtotal, r.groupRows, r.filled], [7, 2, 0, 0, 0, 0]);
  eq(r.unknown, [['77777', 1]]);
  eq(r.textColsWithCodes, []);
  const r2 = T.toCases(MIT_KOPF, { headerRow: 0, codeCol: 2, textCols: [1] }, resolve);
  eq([r2.cases.length, r2.noText, r2.noCode], [4, 1, 2]);
});
check('guess: ohne Kopfzeile, Datum und Telefon werden nicht als Text genommen', () => {
  const rows = [
    ['2026-01-05', '+41 00 000 00 01', 'Kunde hat doppelt bezahlt, bitte Rückerstattung', '50104'],
    ['2026-01-06', '+41 00 000 00 02', 'Fotobuch mit Knick in der Ecke angekommen', '518'],
    ['2026-01-07', '+41 00 000 00 03', 'Wo bleibt meine Leinwand? Schon zwei Wochen', '50410'],
    ['2026-01-08', '', 'Newsletter abmelden bitte', '50601'],
  ];
  eq(T.guess(rows, resolve), { headerRow: -1, codeCol: 3, textCols: [2], fillDown: false });
  const r = T.toCases(rows, T.guess(rows, resolve), resolve);
  eq([r.total, r.cases.length, r.cases[0].row, r.cases[0].line, r.cases[0].c], [4, 4, 0, 1, '50104']);
});
check('guess: Code-Spalte nur mit Bezeichnungen', () => {
  const rows = T.parseDelimited('Fall\tKategorie\n' +
    'Kundin wartet seit zwei Wochen auf ihr Fotobuch\tLieferverzögerung\n' +
    'Hat versehentlich zweimal bestellt\tDoppelbestellung\n' +
    'Neue Wohnadresse ab nächstem Monat\tAdressänderung\n' +
    'Seite im Buch ist eingerissen\tHerstellung mech. Beschädigung Seite eingerissen\n');
  const g = T.guess(rows, resolve);
  eq(g, { headerRow: 0, codeCol: 1, textCols: [0], fillDown: false });
  eq(T.toCases(rows, g, resolve).cases.map(c => c.c), ['50410', '50702', '6102', '342']);
});
check('guess: Kopfzeile mit Kundennr/Telefon/Datum, unbekannte Codes (Top 10)', () => {
  const lines = ['Datum;Kunden-Nr;Telefon;Notiz;Code'];
  for (let i = 0; i < 12; i++) for (let k = 0; k <= i; k++) lines.push(`0${1 + (i % 9)}.02.2026;${100000 + i};+41 00 000 00 ${10 + k};Alter Fall mit Code Nummer ${i};Alt-${i}`);
  for (let i = 0; i < 90; i++) lines.push(`03.03.2026;${200000 + i};+41 00 000 11 ${10 + (i % 80)};Tracking seit Tagen ohne Bewegung;50407`);
  const rows = T.parseDelimited(lines.join('\r\n'));
  const g = T.guess(rows, resolve);
  eq(g, { headerRow: 0, codeCol: 4, textCols: [3], fillDown: false });
  const r = T.toCases(rows, g, resolve);
  eq([r.total, r.cases.length, r.noCode], [78 + 90, 90, 78]);
  eq(r.unknown.length, 10);
  eq(r.unknown[0], ['Alt-11', 12]); eq(r.unknown[9], ['Alt-2', 3]);
});
check('guess: Zusatzspalte Betreff nur mit Kopfzeile, Bearbeiter ausgeschlossen', () => {
  const rows = T.parseDelimited('Nachricht,Bearbeiter,Klassifizierung,Titel\n' +
    '"Guten Tag, mein Fotobuch ist nicht angekommen",Agent Muster,50410,Nicht erhalten\n' +
    '"Die Tasse hat einen Sprung, bitte Ersatz",Agent Muster,517,Tasse\n');
  eq(T.guess(rows, resolve), { headerRow: 0, codeCol: 2, textCols: [0, 3], fillDown: false });
});
check('guess: ohne Code-Spalte, leere Tabelle, eine Zeile', () => {
  const rows = T.parseDelimited('Datum;Notiz\n01.02.2026;Kunde ruft wegen Lieferung an\n02.02.2026;Frage zur Rechnung, bitte zurückrufen');
  const g = T.guess(rows, resolve);
  eq(g, { headerRow: 0, codeCol: -1, textCols: [1], fillDown: false });
  const r = T.toCases(rows, g, resolve);
  eq([r.total, r.noCode, r.noText, r.cases.length, r.unknown.length], [2, 2, 0, 0, 0]);
  eq(T.guess([], resolve), { headerRow: -1, codeCol: -1, textCols: [], fillDown: false });
  eq(T.guess([['Fotobuch nicht erhalten, Tracking offen', '50407']], resolve), { headerRow: -1, codeCol: 1, textCols: [0], fillDown: false });
});
check('guess: erste Datenzeile mit unbekanntem Code ist keine Kopfzeile', () => {
  const rows = [['Kunde bekam das falsche Paket mit fremden Fotos', '99999'], ['Fotobuch kam zu spät, Geburtstag verpasst', '50410'],
    ['Leinwand mit Kratzer geliefert', '362']];
  eq(T.guess(rows, resolve), { headerRow: -1, codeCol: 1, textCols: [0], fillDown: false });
});
check('Ende-zu-Ende: CSV-Bytes (windows-1252) -> Fälle', async () => {
  const csv = Buffer.from('Beschreibung;Klassifizierung\r\n"Paket nie angekommen;\r\nPost sagt zugestellt";514\r\nKäse;?\r\n', 'latin1');
  const x = await T.read(csv, 'export.csv');
  const g = T.guess(x.rows, resolve);
  const r = T.toCases(x.rows, g, resolve);
  eq(r.cases, [{ t: 'Paket nie angekommen;\nPost sagt zugestellt', c: '514', row: 1, line: 2 }]);
  eq(r.unknown, [['?', 1]]);
});

/* ---------- Korrekturen nach der Durchsicht (T1–T14); alle Daten erfunden ---------- */
const NOTIZEN = [['FB n. erh.', '50410'], ['RE n. erh.', '50114'], ['AB fehlt', '20801'], ['Seiten lose', '315'], ['GS Code ungültig', '20709'], ['LW Delle', '517']];
const NAMEN = ['Anna Beispiel', 'Beat Muster', 'Carla Test', 'Daniel Probe'];
const MAILS = ['Guten Tag, mein Fotobuch ist seit drei Wochen nicht angekommen. Bitte prüfen Sie das.',
  'Die Rechnung habe ich nie per E-Mail bekommen, können Sie sie nochmals senden?',
  'Ich habe keine Auftragsbestätigung erhalten, ist die Bestellung angekommen?',
  'Nach zwei Tagen lösen sich die Seiten aus dem Buch, das ist sehr ärgerlich.'];
const CODES4 = ['50410', '50114', '20801', '315'];
// Tabelle aus Kopfzeile und n Zeilen (f(i) -> Zeile)
const table = (head, n, f) => { const r = head ? [head] : []; for (let i = 0; i < n; i++) r.push(f(i)); return r; };
const tc = (rows, g) => T.toCases(rows, g || T.guess(rows, resolve), resolve);

check('T1: Haupttext nach Wörtern: kurze Notizen statt Namen, Links, E-Mails, Prüfsummen', () => {
  const notiz = i => NOTIZEN[i % NOTIZEN.length];
  // ohne Kopfzeile: Namen (2 Wörter) gegen Notizen wie „FB n. erh.“
  let rows = table(null, 30, i => [NAMEN[i % 4], notiz(i)[0], notiz(i)[1]]);
  eq(T.guess(rows, resolve), { headerRow: -1, codeCol: 2, textCols: [1], fillDown: false });
  // Link, E-Mail-Adresse, GUID und Prüfsumme sind nie Text, auch ohne Kopfzeile
  rows = table(null, 30, i => ['https://crm.example.com/fall/' + (1000 + i) + '?ansicht=voll&x=1', 'kunde' + i + '@example.com',
    '3f2504e0-4f89-11d3-9a0c-0305e82c33' + String(10 + i), 'dGVzdGRhdGVuMTIzNDU2Nzg5MA' + i + 'x==', notiz(i)[0], notiz(i)[1]]);
  eq(T.guess(rows, resolve).textCols, [4]);
  // mehrere Wörter, aber Absender mit Adresse oder Link mit Zusatz: kein Text; eine Adresse in einer langen Nachricht stört nicht
  rows = table(null, 30, i => [NAMEN[i % 4] + ' <kunde' + i + '@example.com>', 'https://crm.example.com/fall/' + i + ' (öffnen)',
    MAILS[i % 4] + ' Gruss, kunde' + i + '@example.com', CODES4[i % 4]]);
  eq(T.guess(rows, resolve).textCols, [2]);
  // Kopfzeile „Kunde;Bemerkung“: Bemerkung ist der Text, die Namen nicht
  rows = table(['Kunde', 'Bemerkung', 'Klassifizierung'], 30, i => [NAMEN[i % 4], notiz(i)[0], notiz(i)[1]]);
  eq(T.guess(rows, resolve), { headerRow: 0, codeCol: 2, textCols: [1], fillDown: false });
  eq(tc(rows).cases[0], { t: 'FB n. erh.', c: '50410', row: 1, line: 2 });
  // Spalte mit langen Zeilen, aber kaum gefüllt (Fusszeilen), wird nicht Haupttext
  rows = table(['Hinweis', 'Notiz', 'Code'], 40, i => [i % 20 ? '' : 'Dieser Bericht enthält vertrauliche Angaben und ist nur für den internen Gebrauch bestimmt',
    notiz(i)[0], notiz(i)[1]]);
  eq(T.guess(rows, resolve).textCols, [1]);
  // lauter einzelne Wörter (Status, Produkt) sind kein Text
  rows = table(null, 20, i => [['Offen', 'Erledigt', 'Wartend'][i % 3], notiz(i)[0], notiz(i)[1]]);
  eq(T.guess(rows, resolve).textCols, [1]);
});

check('T2: Spalte mit Bezeichnungen (zweite Klassifizierung) ist nie Text', () => {
  const lab = c => E.byCode[c].label;
  let rows = table(['Notiz', 'Klassifizierung', 'Klassifizierungstext'], 24, i => ['Kd. ruft an wegen Bestellung (Fall ' + i + ')', CODES4[i % 4], lab(CODES4[i % 4])]);
  eq(T.guess(rows, resolve).textCols, [0]);
  rows = table(['Code', 'Bezeichnung', 'Notiz'], 24, i => [CODES4[i % 4], lab(CODES4[i % 4]), NOTIZEN[i % 6][0]]);
  eq(T.guess(rows, resolve), { headerRow: 0, codeCol: 0, textCols: [2], fillDown: false });
  rows = table(['Fallnotiz', 'Kategorie', 'Kategorie Beschreibung'], 24, i => [MAILS[i % 4], lab(CODES4[i % 4]), CODES4[i % 4] + ' - ' + lab(CODES4[i % 4])]);
  eq(T.guess(rows, resolve).textCols, [0]);
});

check('T3: Titel mit E-Mail/Agent/Datum/Order, aber langem Text, sind Textspalten; Kunde, Absender, Link nicht', () => {
  for (const h of ['E-Mail-Text', 'Email Body', 'Inhalt der E-Mail', 'Kommentar Agent', 'Agent Notes', 'Updated Description',
    'Beschreibung (Kundenname entfernt)', 'Order notes', 'Mailtext', 'Mail Text']) {
    const rows = table(['Betreff', h, 'Klassifizierung'], 20, i => [['Ihre Bestellung', 'Anfrage', 'Reklamation'][i % 3], MAILS[i % 4], CODES4[i % 4]]);
    eq([h, T.guess(rows, resolve).textCols], [h, [0, 1]]);
  }
  for (const h of ['Kunde', 'Kontaktname', 'Absender', 'Von', 'From', 'Account', 'Firma', 'Link', 'URL', 'Checksum']) {
    const rows = table([h, 'Notiz', 'Klassifizierung'], 20, i => ['Firma Beispiel AG, Abteilung Einkauf ' + i, NOTIZEN[i % 6][0], NOTIZEN[i % 6][1]]);
    eq([h, T.guess(rows, resolve).textCols], [h, [1]]);
  }
  // kurzer „Statustext“ bleibt ausgeschlossen
  const rows = table(['Statustext', 'Nachricht', 'Code'], 20, i => ['in Arbeit ' + (i % 3), MAILS[i % 4], CODES4[i % 4]]);
  eq(T.guess(rows, resolve).textCols, [1]);
});

check('T4: Kopfzeile nicht in Zeile 1 (Titel- und Filterzeilen darüber)', () => {
  const data = i => ['', '0100' + i, MAILS[i % 4], CODES4[i % 4]];
  let rows = [['Fälle nach Klassifizierung – Kundenservice', '', '', ''], ['Gefiltert nach: Erstellt am = letzte 12 Monate', '', '', ''],
    ['', 'Fallnummer', 'Beschreibung', 'Klassifizierung'], ...table(null, 20, data), ['Vertraulich – nur für den internen Gebrauch', '', '', '']];
  let g = T.guess(rows, resolve);
  eq(g, { headerRow: 2, codeCol: 3, textCols: [2], fillDown: false });
  let r = tc(rows, g);
  eq([r.total, r.cases.length, r.noCode], [21, 20, 1]);
  eq([r.cases[0].row, r.cases[0].line], [3, 4]);
  // Titel über alle Spalten (auch über der Klassifizierung, z. B. verbundene Zellen) und Code-Spalte vorne
  rows = [['Export Fälle', 'Export Fälle', 'Export Fälle'], ['Klassifizierung', 'Kontaktname', 'Notiz'],
    ...table(null, 12, i => [CODES4[i % 4], NAMEN[i % 4], MAILS[i % 4]])];
  eq(T.guess(rows, resolve), { headerRow: 1, codeCol: 0, textCols: [2], fillDown: false });
  // unbekannte Codes vor dem ersten gültigen: die Kopfzeile ist die mit dem Spaltentitel
  rows = [['Notiz', 'Code'], [MAILS[0], 'Alt-1'], [MAILS[1], 'Alt-2'], ...table(null, 10, i => [MAILS[i % 4], CODES4[i % 4]])];
  eq(T.guess(rows, resolve).headerRow, 0);
  // Freitext in der Code-Spalte mitten in den Daten ist keine Kopfzeile
  rows = [['Notiz', 'Klassifizierung'], [MAILS[0], '50410'], [MAILS[1], 'Rückruf Frau Beispiel'], ...table(null, 10, i => [MAILS[i % 4], CODES4[i % 4]])];
  eq(T.guess(rows, resolve).headerRow, 0);
  // ohne Code-Spalte: Kopfzeile nur, wenn Zeile 1 wie Spaltentitel aussieht
  eq(T.guess([['Datum', 'Notiz', ''], ['01.02.2026', MAILS[0], ''], ['02.02.2026', MAILS[1], '']], resolve).headerRow, 0);
  eq(T.guess([['01.02.2026', MAILS[0]], ['02.02.2026', MAILS[1]]], resolve).headerRow, -1);
  eq(T.guess([['Notiz', MAILS[0]], ['Notiz', MAILS[1]]], resolve).headerRow, -1);
  // toCases: alte Angabe header: true gilt noch als headerRow 0
  eq(tc(MIT_KOPF, { header: true, codeCol: 2, textCols: [1] }).total, 7);
});

check('T5: „sep=;“ in der ersten Zeile bestimmt das Trennzeichen und ist keine Zeile', async () => {
  const txt = 'sep=;\r\nText;Code\r\nRechnung falsch, bitte korrigieren;50103\r\nGutschein, geht nicht;20709\r\n';
  const rows = T.parseDelimited(txt);
  eq(rows, [['Text', 'Code'], ['Rechnung falsch, bitte korrigieren', '50103'], ['Gutschein, geht nicht', '20709']]);
  eq(rows.lineNos, [1, 2, 3]);
  const x = await T.read(Buffer.from('﻿sep=|\nText|Code\nTasse; kaputt|517\n', 'utf8'), 'x.csv');
  eq([x.delimiter, x.rows], ['|', [['Text', 'Code'], ['Tasse; kaputt', '517']]]);
  eq(T.parseDelimited('"sep=,"\na,b\n'), [['a', 'b']]);
  eq(T.parseDelimited('sep=\na;b\n'), [['sep=', ''], ['a', 'b']]);   // ohne Zeichen: normale Zeile
});

// kleines .xlsx mit einem Blatt (Zeilen als XML) und optionalem Zusatz nach sheetData
const xlsx1 = (rowsXml, after = '', sheets = [['Tabelle1']]) => zip([...common,
  { name: 'xl/workbook.xml', data: workbook(sheets.map((s, i) => [s[0], 'rId' + (i + 1), s[1]])) },
  { name: 'xl/_rels/workbook.xml.rels', data: rels(sheets.map((s, i) => ['rId' + (i + 1), 'worksheet', 'worksheets/sheet' + (i + 1) + '.xml'])) },
  ...sheets.map((s, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: HEAD + `<worksheet ${NS}><sheetData>${i ? s[2] : rowsXml}</sheetData>${i ? '' : after}</worksheet>` }))]);
const is = (ref, t) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`;

check('T6: verbundene Zellen (xlsx) und rowspan/colspan (HTML) werden gefüllt', async () => {
  const x = await T.readXlsx(xlsx1(
    '<row r="1">' + is('A1', 'Klassifizierung') + is('B1', 'Notiz') + '</row>' +
    '<row r="2"><c r="A2"><v>50410</v></c>' + is('B2', 'Paket seit Wochen unterwegs') + '</row>' +
    '<row r="3"><c r="A3" s="1"/>' + is('B3', 'Wo bleibt mein Fotobuch?') + '</row>' +
    '<row r="4">' + is('B4', 'Tracking ohne Bewegung') + '</row>' +
    '<row r="5">' + is('A5', 'Summe') + '<c r="B5"><v>3</v></c></row>' +
    '<row r="6"><c r="A6"><v>517</v></c>' + is('B6', 'Karton nass') + '</row>' +
    '<row r="7">' + is('B7', 'Ecke eingedrückt') + '</row>' +
    '<row r="9">' + is('A9', 'Ende der Liste') + '</row>',
    '<mergeCells count="4"><mergeCell ref="A2:A4"/><mergeCell ref="A6:A8"/><mergeCell ref="A9:C9"/><mergeCell ref="B5:B5"/></mergeCells>'));
  eq(x.rows, [['Klassifizierung', 'Notiz'], ['50410', 'Paket seit Wochen unterwegs'], ['50410', 'Wo bleibt mein Fotobuch?'],
    ['50410', 'Tracking ohne Bewegung'], ['Summe', '3'], ['517', 'Karton nass'], ['517', 'Ecke eingedrückt'], ['Ende der Liste', 'Ende der Liste']]);
  eq(x.rows.lineNos, [1, 2, 3, 4, 5, 6, 7, 9]);
  const r = tc(x.rows);
  eq([r.cases.length, r.subtotal, r.noCode, r.cases.map(c => c.c).join()], [5, 1, 1, '50410,50410,50410,517,517']);
  const h = await T.read(u8('<table><tr><th>Klassifizierung</th><th colspan="2">Text</th></tr>' +
    '<tr><td rowspan=3>50410 - Lieferverzögerung</td><td>Paket fehlt</td><td rowspan="2">Kunde A</td></tr>' +
    '<tr><td>Buch nicht da</td></tr><tr><td colspan=2>Wo bleibt es?</td></tr><tr><td>517</td><td>Karton nass</td><td>Kunde B</td></tr></table>'), 'bericht.xls');
  eq(h.rows, [['Klassifizierung', 'Text', 'Text'], ['50410 - Lieferverzögerung', 'Paket fehlt', 'Kunde A'], ['50410 - Lieferverzögerung', 'Buch nicht da', 'Kunde A'],
    ['50410 - Lieferverzögerung', 'Wo bleibt es?', 'Wo bleibt es?'], ['517', 'Karton nass', 'Kunde B']]);
  eq(h.rows.lineNos, [1, 2, 3, 4, 5]);
});

check('T7: gruppierte Berichte: Klassifizierung nur in der Gruppenzeile, Summenzeilen', () => {
  // Gruppenzeile mit Code, darunter Fälle ohne Code, danach Zwischensumme
  const rows = [['Klassifizierung', 'Fallnummer', 'Notiz'],
    ['50410 - Lieferverzögerung (3)', '', ''], ['', '01', MAILS[0]], ['', '02', 'Paket noch nicht da'], ['', '03', 'Wo bleibt mein Kalender?'], ['Zwischensumme', '3', ''],
    ['99999 - Alter Code (1)', '', ''], ['', '04', 'Alter Fall ohne gültigen Code'], ['Zwischensumme', '1', ''],
    ['', '05', 'Fall ohne Gruppe nach der Summe'],
    ['50114 - Rechnung per E-Mail nicht angekommen (2)', '', ''], ['', '06', MAILS[1]], ['', '07', ''], ['', '08', 'Rechnung fehlt im Postfach'],
    ['Gesamtsumme', '8', ''], ['Anzahl: 8', '', ''], ['Total', '', '']];
  const g = T.guess(rows, resolve);
  eq(g, { headerRow: 0, codeCol: 0, textCols: [2], fillDown: true });
  const r = tc(rows, g);
  eq(r.cases.map(c => [c.c, c.row]), [['50410', 2], ['50410', 3], ['50410', 4], ['50114', 11], ['50114', 13]]);
  eq([r.total, r.cases.length, r.noCode, r.noText, r.subtotal, r.groupRows, r.filled], [16, 5, 3, 1, 5, 2, 5]);
  eq(r.total, r.cases.length + r.noCode + r.noText + r.subtotal + r.groupRows);
  eq(r.unknown, [['99999 - Alter Code (1)', 1]]);   // Summenzeilen sind keine unbekannten Codes
  // ohne fillDown: nur die Summenzeilen werden erkannt
  const r2 = tc(rows, Object.assign({}, g, { fillDown: false }));
  eq([r2.cases.length, r2.noCode, r2.noText, r2.subtotal, r2.groupRows, r2.filled], [0, 9, 2, 5, 0, 0]);
  // Pivot-Stil: Code nur in der ersten Zeile der Gruppe (mit Text)
  const piv = [['Klassifizierung', 'Notiz'], ['50410', MAILS[0]], ['', 'Paket fehlt'], ['', 'Buch nicht da'], ['50114 Ergebnis', ''], ['517', 'Karton nass'], ['', 'Ecke kaputt']];
  const gp = T.guess(piv, resolve);
  eq(gp.fillDown, true);
  eq(tc(piv, gp).cases.map(c => c.c), ['50410', '50410', '50410', '517', '517']);
  // Summenzeilen in verschiedenen Schreibweisen (auch ohne fillDown), keine davon ist ein Code
  const sums = ['Summe', 'Zwischensumme 50410', 'Gesamtsumme', 'Gesamtergebnis', '50410 - Lieferverzögerung Ergebnis', 'Total', 'Subtotal', 'Grand Total', 'Anzahl: 3', 'Count 3', '517 Summe'];
  const rs = tc([['Notiz', 'Code'], ...sums.map(x => ['', x]), [MAILS[0], '50410']], { headerRow: 0, codeCol: 1, textCols: [0] });
  eq([rs.total, rs.subtotal, rs.cases.length, rs.noText, rs.unknown], [12, 11, 1, 0, []]);
  // flache Liste mit wenigen leeren Codes: kein fillDown
  const flat = table(['Notiz', 'Code'], 20, i => [MAILS[i % 4], i % 5 ? CODES4[i % 4] : '']);
  eq(T.guess(flat, resolve).fillDown, false);
});

check('T8: Tabellenblatt: erstes mit Daten, wählbar, ausgeblendete nicht in der Liste', async () => {
  const daten = table(null, 6, i => '<row r="' + (i + 1) + '">' + is('A' + (i + 1), i ? MAILS[i % 4] : 'Notiz') + '<c r="B' + (i + 1) + '"' + (i ? '><v>' + CODES4[i % 4] + '</v></c>' : ' t="inlineStr"><is><t>Code</t></is></c>') + '</row>').join('');
  const z = xlsx1('<row r="1">' + is('A1', 'Auswertung 2026') + '</row><row r="2">' + is('A2', 'Erstellt: 24.09.2026') + '</row>', '',
    [['Deckblatt'], ['Intern', 'hidden', daten], ['Daten', null, daten], ['Leer', null, '']]);
  let x = await T.readXlsx(z);
  eq([x.sheet, x.sheets, x.sheetIndex, x.rows.length], ['Daten', ['Deckblatt', 'Daten', 'Leer'], 1, 6]);
  x = await T.read(z, 'f.xlsx', { sheet: 0 });
  eq([x.format, x.sheet, x.sheetIndex, x.rows], ['xlsx', 'Deckblatt', 0, [['Auswertung 2026'], ['Erstellt: 24.09.2026']]]);
  x = await T.read(z, 'f.xlsx', { sheet: '2' });
  eq([x.sheet, x.sheetIndex, x.rows.length], ['Leer', 2, 0]);
  x = await T.read(z, 'f.xlsx', { sheet: 7 });   // ungültig -> Standard
  eq(x.sheetIndex, 1);
  // kein Blatt mit Daten: das erste
  x = await T.readXlsx(xlsx1('<row r="1">' + is('A1', 'nur Titel') + '</row>', '', [['Eins'], ['Zwei', null, '<row r="1"><c r="A1"><v>1</v></c></row>']]));
  eq([x.sheet, x.sheetIndex, x.rows], ['Eins', 0, [['nur Titel']]]);
});

check('T9: Codes mit Tausendertrennzeichen, Platzhalter nicht über enthaltene Bezeichnung', () => {
  eq(["50'410", '50’410', '50`410', '50 410', '50 410'].map(resolve), Array(5).fill('50410'));
  eq(["10'211", "3'712", "30'212"].map(resolve), ['10211', '3712', '30212']);   // früher still 211, 712, 212
  eq(["1'234'567", '50 410'].map(resolve), [null, null]);
  eq(['Grund unbekannt', 'Klassifizierung unbekannt', 'Kein Material', 'Bildqualität Farbe', 'Paket mit Postschaden angekommen',
    'Kunde möchte Rückerstattung (doppelt bezahlt)', 'Postschaden: Leinwand eingedrückt, Kunde schickt Fotos'].map(resolve), Array(7).fill(null));
  eq(['unbekannt', '(unbekannt)', 'Material', 'Postschaden'].map(resolve), ['512', '512', '10128', '517']);   // genaue Bezeichnung zählt
  eq(['Operations > Logistics & Shipping > Lieferverzögerung', 'Lieferverzögerung (Kulanz)', 'Kategorie: Doppelbestellung',
    'Finance > Rechnung per E-Mail nicht angekommen', 'Ops | Lieferverzögerung > Fotobuch', 'Herstellung mech. Beschädigung Seite eingerissen!'].map(resolve),
    ['50410', '50410', '50702', '50114', '50410', '342']);
});

check('T10: UTF-8 mit einzelnen kaputten Bytes bleibt UTF-8', () => {
  const ok = Buffer.from('Notiz;Klassifizierung\n' + table(null, 20, i => 'Bestätigung fehlt, Größe falsch;Lieferverzögerung').join('\n'), 'utf8');
  const bad = Buffer.concat([ok.subarray(0, 40), Buffer.from([0x96]), ok.subarray(40)]);
  const s = T.decode(bad);
  assert.ok(s.includes('Lieferverzögerung') && s.includes('�'), s.slice(0, 80));
  eq(T.decode(Buffer.from('Käse;Brücke;Größe', 'latin1')), 'Käse;Brücke;Größe');   // echtes windows-1252 bleibt
  eq(T.decode(Buffer.concat([Buffer.from('Grüsse ', 'utf8'), Buffer.from([0xE4, 0x20, 0xFC])])), 'GrÃ¼sse ä ü');   // zu wenig UTF-8
});

check('T11: Excel-2003-XML (.xls): Blatt, Zeilen, ss:Index, Entities, verbundene Zellen', async () => {
  const xml = '<?xml version="1.0"?>\r\n<?mso-application progid="Excel.Sheet"?>\r\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:html="http://www.w3.org/TR/REC-html40">' +
    '<Styles><Style ss:ID="Default"/></Styles>' +
    '<Worksheet ss:Name="Versteckt"><Table><Row><Cell><Data ss:Type="String">X</Data></Cell></Row></Table>' +
    '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Visible>SheetHidden</Visible></WorksheetOptions></Worksheet>' +
    '<Worksheet ss:Name="F&#228;lle"><Table ss:ExpandedColumnCount="3">' +
    '<Row><Cell><Data ss:Type="String">Notiz</Data></Cell><Cell ss:Index="3"><Data ss:Type="String">Code</Data></Cell></Row>' +
    '<Row ss:Index="3"><Cell><ss:Data ss:Type="String" xmlns="http://www.w3.org/TR/REC-html40"><B>Tasse</B> kaputt &amp; Henkel ab&#10;Zeile 2</ss:Data>' +
    '<Comment><Data>Notiz vom Team</Data></Comment></Cell><Cell ss:Index="3" ss:MergeDown="1"><Data ss:Type="Number">517</Data></Cell></Row>' +
    '<Row><Cell ss:MergeAcross="1"><Data ss:Type="String">Karton nass</Data></Cell></Row>' +
    '<Row/><Row><Cell><Data ss:Type="String">&lt;leer&gt;</Data></Cell><Cell/><Cell><Data ss:Type="Number">50410</Data></Cell></Row>' +
    '</Table></Worksheet></Workbook>';
  const x = await T.read(u8(xml), 'export.xls');
  eq([x.format, x.sheet, x.sheets, x.sheetIndex], ['xml2003', 'Fälle', ['Fälle'], 0]);
  eq(x.rows, [['Notiz', '', 'Code'], ['Tasse kaputt & Henkel ab\nZeile 2', '', '517'], ['Karton nass', 'Karton nass', '517'], ['<leer>', '', '50410']]);
  eq(x.rows.lineNos, [1, 3, 4, 6]);
  const r = tc(x.rows);
  eq(r.cases.map(c => [c.c, c.line]), [['517', 3], ['517', 4], ['50410', 6]]);
});

check('T12: Zeilennummern wie in Excel (rows.lineNos, case.line)', async () => {
  const rows = T.parseDelimited('Text;Code\n\n"Zeile mit\nUmbruch";50410\n;\nTasse kaputt;517\n');
  eq(rows.lineNos, [1, 3, 5]);
  eq(tc(rows).cases.map(c => [c.row, c.line]), [[1, 3], [2, 5]]);
  const x = await T.read(MAIN, 'f.xlsx');
  eq(x.rows.lineNos, [1, 2, 3, 6, 9]);
  const h = await T.read(u8('<table><tr><td>Text</td><td>Code</td></tr><tr><td> </td></tr><tr><td>Tasse</td><td>517</td></tr></table>'), 'h.xls');
  eq(h.rows.lineNos, [1, 3]);
  eq(T.guess([], resolve).headerRow, -1); eq(T.parseDelimited('').lineNos, []);
  // Zeilen ohne lineNos (z. B. von Hand gebaut): Index + 1
  eq(tc([['Text', 'Code'], ['Fotobuch kam nie an', '50410']]).cases[0].line, 2);
});

check('T13: einzelnes " am Zellanfang (eingefügt) verschluckt keine Zeilen', () => {
  const txt = 'Text\tCode\r\n"Buch kaputt angekommen, Ecke eingedrückt\t511\r\nZweite Zeile\t515\r\nDritte Zeile\t517\r\n';
  eq(T.parseDelimited(txt), [['Text', 'Code'], ['"Buch kaputt angekommen, Ecke eingedrückt', '511'], ['Zweite Zeile', '515'], ['Dritte Zeile', '517']]);
  const two = 'Text\tCode\n"Buch kaputt\t511\n"Tasse kaputt\t517\nRest\t515\n';
  eq(T.parseDelimited(two), [['Text', 'Code'], ['"Buch kaputt', '511'], ['"Tasse kaputt', '517'], ['Rest', '515']]);
  eq(T.parseDelimited('"Buch" sagt Kundin\t511\n"a\nb"\t515', '\t'), [['Buch sagt Kundin', '511'], ['a\nb', '515']]);
  eq(T.parseDelimited('a;"b""c"\n"x";"y', ';'), [['a', 'b"c'], ['x', '"y']]);
});

check('T14: toCases meldet Textspalten, in denen oft ein Code steht', () => {
  const rows = table(['Notiz', 'Code', 'Bezeichnung'], 20, i => [MAILS[i % 4], CODES4[i % 4], E.byCode[CODES4[i % 4]].label]);
  const r = T.toCases(rows, { headerRow: 0, codeCol: 1, textCols: [0, 2] }, resolve);
  eq(r.textColsWithCodes, [2]);
  eq(r.cases[0].t, MAILS[0] + '\n' + E.byCode[CODES4[0]].label);
  eq(T.toCases(rows, { headerRow: 0, codeCol: 1, textCols: [0] }, resolve).textColsWithCodes, []);
  // gleicher Text in zwei Spalten nur einmal
  eq(T.toCases([['a', 'b', 'c'], ['Tasse kaputt', 'Tasse kaputt', '517']], { headerRow: 0, codeCol: 2, textCols: [0, 1] }, resolve).cases[0].t, 'Tasse kaputt');
});

/* ---------- Korrekturen nach der zweiten Durchsicht (T15–T20); alle Daten erfunden ---------- */
const ALLE = built.classes.map(c => c.code);
const zufall = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;   // fester Zufall für die Tests
const mischen = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const daten = (n, f) => table(null, n, f || (i => [MAILS[i % 4], CODES4[i % 4]]));

check('T15: Kopfzeile: offener Fall in der ersten Datenzeile ist nicht die Kopfzeile', () => {
  for (const [head, top] of [[['Notiz', 'Klassifizierung'], [['Kunde ruft wegen Lieferung zurück', 'nicht klassifiziert']]],
    [['Notiz', 'Klassifizierung'], [['Kunde meldet sich nochmals', 'Unclassified']]],
    [['Beschreibung', 'Grund'], [['Kunde wartet auf Rückruf', 'Grund unbekannt']]],
    [['Notiz', 'Anliegen'], [['Kunde ruft nochmals an', 'offen']]],
    [['Notiz', 'Anliegen'], [['Kunde ruft nochmals an', 'offen'], ['Rückruf Kunde', 'offen']]],
    [['Kundennachricht', 'Fallart'], [['Kunde hat eine Frage zum Datum', 'Sonstiges']]]]) {
    const rows = [head, ...top, ...daten(20)];
    const g = T.guess(rows, resolve);
    eq([head, top.length, g], [head, top.length, { headerRow: 0, codeCol: 1, textCols: [0], fillDown: false }]);
    eq(tc(rows, g).cases.length, 20);
  }
  // Fallnummer-Spalte (Buchstaben + Ziffern): gleiche Punkte, die Zeile mit Textspalte gewinnt
  let rows = [['Fall', 'Notiz', 'Klassifizierung'], ['CAS-10001', 'Kunde ruft zurück', 'nicht klassifiziert'],
    ...daten(20, i => ['CAS-' + (10002 + i), MAILS[i % 4], CODES4[i % 4]])];
  eq(T.guess(rows, resolve), { headerRow: 0, codeCol: 2, textCols: [1], fillDown: false });
  // vier Spalten: die Beschreibung bleibt Text (nicht nur der kurze Betreff)
  rows = [['Kunde', 'Betreff', 'Beschreibung', 'Anliegen'], ['Anna Beispiel', 'Rückruf', 'Kunde ruft an', 'offen'],
    ...daten(20, i => [NAMEN[i % 4], ['Ihre Bestellung', 'Frage zur Rechnung', 'Lieferung fehlt'][i % 3], MAILS[i % 4], CODES4[i % 4]])];
  eq(T.guess(rows, resolve), { headerRow: 0, codeCol: 3, textCols: [1, 2], fillDown: false });
  // Titelzeile mit 2 Zellen über der Kopfzeile verliert weiterhin (gleiche Punkte: die untere zuerst)
  for (const title of [['Fallbericht Kundendienst', 'nach Klassifizierung'], ['Erstellt von: T. Beispiel', 'Fälle nach Kategorie'], ['Filter:', 'Klassifizierung = alle']]) {
    rows = [title, ['Notiz', 'Klassifizierung'], ...daten(20)];
    eq([title, T.guess(rows, resolve)], [title, { headerRow: 1, codeCol: 1, textCols: [0], fillDown: false }]);
  }
});

check('T16: guess mit opts.headerRow: Kopfzeile vorgegeben, Spalten und fillDown neu erraten', () => {
  const rows = [['Notiz', 'Klassifizierung'], ['Kunde ruft wegen Lieferung zurück', 'nicht klassifiziert'], ...daten(20)];
  eq(T.guess(rows, resolve, { headerRow: 0 }), { headerRow: 0, codeCol: 1, textCols: [0], fillDown: false });
  eq(T.guess(rows, resolve, { headerRow: '0' }), { headerRow: 0, codeCol: 1, textCols: [0], fillDown: false });   // Wert aus <select>
  eq(T.guess(rows, resolve, { headerRow: 1 }), { headerRow: 1, codeCol: 1, textCols: [], fillDown: false });   // Titel "Kunde …" = SKIP
  eq(T.guess(rows, resolve, { headerRow: -1 }), { headerRow: -1, codeCol: 1, textCols: [0], fillDown: false });
  eq(T.guess(rows, resolve, { headerRow: 99 }).headerRow, -1);   // ungültig -> keine Kopfzeile
  eq(T.guess(rows, resolve, { headerRow: null }), T.guess(rows, resolve));   // nicht angegeben -> raten
  eq(T.guess(rows, resolve, { headerRow: 'x' }), T.guess(rows, resolve));
  // Klassifizierung nur aus den Zeilen unter der Kopfzeile (darüber eine Übersicht mit Codes in Spalte A)
  const ueb = [...table(null, 10, i => [ALLE[i], String(10 + i)]), ['Notiz', 'Klassifizierung'], ...daten(5)];
  eq(T.guess(ueb, resolve).codeCol, 0);
  eq(T.guess(ueb, resolve, { headerRow: 10 }), { headerRow: 10, codeCol: 1, textCols: [0], fillDown: false });
  // gruppierter Bericht unter Titelzeilen: vorgegebene Kopfzeile = gleiche Spalten und fillDown wie geraten
  const grp = [['Fälle nach Klassifizierung', '', ''], ['Klassifizierung', 'Fallnummer', 'Notiz'],
    ...[0, 1, 2, 3].flatMap(k => [[CODES4[k] + ' (3)', '', ''], ['', 'F' + k + '1', MAILS[k]], ['', 'F' + k + '2', 'Paket fehlt noch'], ['', 'F' + k + '3', 'Wo bleibt die Ware?']])];
  eq(T.guess(grp, resolve), { headerRow: 1, codeCol: 0, textCols: [2], fillDown: true });
  eq(T.guess(grp, resolve, { headerRow: 1 }), { headerRow: 1, codeCol: 0, textCols: [2], fillDown: true });
  eq(tc(grp, T.guess(grp, resolve, { headerRow: 1 })).cases.length, 12);
});

check('T17: fillDown nur bei gruppierten Berichten, nie bei flachen Listen mit vielen offenen Fällen', () => {
  const flach = (n, p, seed, codes, amEnde) => {
    const r = zufall(seed), rows = [['Fallnr', 'Beschreibung', 'Klassifizierung']];
    for (let i = 0; i < n; i++) {
      const c = codes[Math.floor(Math.pow(r(), 2) * codes.length)], leer = amEnde ? i >= n * (1 - p) : r() < p;
      rows.push(['CAS-' + (1000 + i), MAILS[i % 4] + ' (' + i + ')', leer ? '' : c]);
    }
    return rows;
  };
  for (const p of [0.3, 0.35, 0.5, 0.7]) for (const seed of [1, 2, 3]) {
    eq(['verstreut', p, seed, T.guess(flach(400, p, seed, ALLE.slice(0, 60)), resolve).fillDown], ['verstreut', p, seed, false]);
    eq(['am Ende', p, seed, T.guess(flach(400, p, seed, ALLE.slice(0, 60), true), resolve).fillDown], ['am Ende', p, seed, false]);
  }
  // kleine Liste, fast jeder Fall mit eigenem Code (60 Zeilen, 40 % leer)
  let rows = [['Beschreibung', 'Klassifizierung']].concat(ALLE.slice(0, 60).map((c, i) => [MAILS[i % 4] + ' ' + i, i % 5 < 2 ? '' : c]));
  rows[4][1] = rows[20][1] = rows[33][1] = ALLE[2];   // ein paar Wiederholungen wie in echten Listen
  eq(T.guess(rows, resolve).fillDown, false);
  // viele Fälle mit Code, aber ohne Text (Telefonfälle), dazwischen Fälle ohne Code: keine Gruppenzeilen
  const r = zufall(7);
  rows = [['Fallnr', 'Beschreibung', 'Klassifizierung']];
  for (let i = 0; i < 300; i++) { const q = r(); rows.push(['CAS-' + i, q < 0.4 ? '' : MAILS[i % 4], q >= 0.4 && q < 0.75 ? '' : ALLE[Math.floor(r() * 40)]]); }
  eq(T.guess(rows, resolve).fillDown, false);
  // gruppiert: Code in der ersten Zeile der Gruppe (Gruppen in beliebiger Reihenfolge)
  const gruppen = mischen(ALLE.slice(0, 40), zufall(3));
  rows = [['Klassifizierung', 'Notiz']];
  gruppen.forEach((c, k) => { for (let j = 0; j <= k % 4; j++) rows.push([j ? '' : c, MAILS[(k + j) % 4]]); });
  let g = T.guess(rows, resolve);
  eq(g.fillDown, true);
  eq(tc(rows, g).cases.length, rows.length - 1);
  // zwei Ebenen (Monat, dann Klassifizierung): Codes wiederholen sich pro Monat; mit Zwischentitel, Summen oder Gruppenzeilen
  const monate = ['Januar', 'Februar', 'März'];
  const zweiEbenen = art => {
    const out = [['Monat', 'Klassifizierung', 'Notiz']];
    monate.forEach(m => {
      if (art === 'titel') out.push([m, '', '']);
      ALLE.slice(0, 12).forEach((c, k) => {
        if (art === 'gruppenzeile') out.push(['', c + ' (2)', '']);
        out.push([art === 'titel' ? '' : m, art === 'gruppenzeile' ? '' : c, MAILS[k % 4]], ['', '', 'Paket fehlt ' + k]);
        if (art === 'summe') out.push(['', 'Summe', '2']);
      });
    });
    return out;
  };
  for (const art of ['titel', 'summe', 'gruppenzeile']) {
    rows = zweiEbenen(art); g = T.guess(rows, resolve);
    eq([art, g.fillDown, tc(rows, g).cases.length], [art, true, 72]);
  }
});

check('T18: kurze Notizen: Stichwörter aus einem Wort und Notiz-Titel mit Kunde/Agent sind Text', () => {
  // (keine Wörter, die selbst eine Bezeichnung sind wie "Doppelbestellung": so eine Spalte wäre eine Klassifizierung)
  const EIN = [['Lieferverzug', '50410'], ['Storno', '50403'], ['Rekla', '221'], ['Mahnung', '50102'], ['Rechnungskopie', '50114'],
    ['Farbstich', '321'], ['Retoure', '50104'], ['Twint', '50205'], ['FB n. erh.', '50410'], ['Kratzer', '362']];
  // 80 % einzelne Wörter
  for (const h of ['Notiz', 'Stichwort', 'Anliegen']) {
    const rows = table(['Datum', h, 'Klassifizierung'], 50, i => ['2026-09-' + String(i % 28 + 1).padStart(2, '0'), EIN[i % 10][0], EIN[i % 10][1]]);
    eq([h, T.guess(rows, resolve).textCols], [h, [1]]);
  }
  // ohne Kopfzeile: einzelne Wörter (Priorität) gegen Stichwort-Notizen: die Notizen; bei Gleichstand die längeren Zellen
  let rows = table(null, 30, i => [['Hoch', 'Tief', 'Mittel'][i % 3], EIN[i % 10][0], EIN[i % 10][1]]);
  eq(T.guess(rows, resolve).textCols, [1]);
  const EIN1 = EIN.filter(x => !x[0].includes(' '));   // nur einzelne Wörter: gleiche Punktzahl wie die Priorität
  rows = table(null, 30, i => [['Hoch', 'Tief', 'Mittel', 'Dringend', 'Normal', 'Später'][i % 6], EIN1[i % 9][0], EIN1[i % 9][1]]);
  eq(T.guess(rows, resolve).textCols, [1]);
  // eine Auswahl mit wenigen Werten (Kanal) ist nie der Haupttext, auch ohne andere Textspalte
  rows = table(['Datum', 'Kanal', 'Klassifizierung'], 30, i => ['2026-09-01', ['Telefon', 'E-Mail', 'Chat'][i % 3], CODES4[i % 4]]);
  eq(T.guess(rows, resolve).textCols, []);
  // Kennungen aus einem Wort (Ziffern, @, _, Punkt im Wort, sehr lang) bleiben ausgeschlossen
  for (const f of [i => 'RX' + (7000 + i), i => 'fall_' + i, i => 'kunde' + i + '@example.com', i => 'foto' + i + '.jpg', i => 'Bearbeitungsstatusaenderungsvermerk' + 'x'.repeat(i % 3)]) {
    rows = table(['Referenz', 'Notiz', 'Klassifizierung'], 30, i => [f(i), NOTIZEN[i % 6][0], NOTIZEN[i % 6][1]]);
    eq([f(1), T.guess(rows, resolve).textCols], [f(1), [1]]);
  }
  // Titel mit Notiz-Wort und Kunde/Agent/Kontakt: Text, auch bei kurzen Notizen (Namen daneben nicht)
  for (const h of ['Notiz Agent', 'Agent-Notiz', 'Kundendienst-Notiz', 'Bearbeiter-Notiz', 'Kommentar Kundenservice', 'Notiz zum Kunden',
    'Notiz Kunde', 'Kundenanliegen', 'Kundenmail', 'Kommentar Agent', 'Kundenmeldung', 'Kontaktnotiz', 'Kundenproblem', 'Customer Notes']) {
    rows = table(['Fallnr', 'Kunde', h, 'Klassifizierung'], 30, i => ['CAS-' + (100 + i), NAMEN[i % 4], NOTIZEN[i % 6][0], NOTIZEN[i % 6][1]]);
    eq([h, T.guess(rows, resolve).textCols], [h, [2]]);
  }
  // Personen- und Adress-Titel bleiben ausgeschlossen (auch "Kunden-E-Mail" = Adresse)
  for (const h of ['Kunden-E-Mail', 'Kontakt E-Mail', 'Customer', 'Contact', 'Kundin', 'Auftraggeber', 'Requester', 'Endkunde', 'Kontaktperson']) {
    rows = table([h, 'Notiz', 'Klassifizierung'], 20, i => ['Firma Beispiel AG, Abteilung ' + i, NOTIZEN[i % 6][0], NOTIZEN[i % 6][1]]);
    eq([h, T.guess(rows, resolve).textCols], [h, [1]]);
  }
  // Inhalt zählt weiterhin: "Kundenmail" mit Adressen ist kein Text
  rows = table(['Kundenmail', 'Notiz', 'Klassifizierung'], 20, i => ['kunde' + i + '@example.com', NOTIZEN[i % 6][0], NOTIZEN[i % 6][1]]);
  eq(T.guess(rows, resolve).textCols, [1]);
  // Status aus einem Wort unter "Kommentar" neben einer Beschreibung: nur die Beschreibung
  rows = table(['Beschreibung', 'Kommentar', 'Klassifizierung'], 24, i => [MAILS[i % 4], ['erledigt', 'ok', 'Rückruf', 'offen'][i % 4], CODES4[i % 4]]);
  eq(T.guess(rows, resolve).textCols, [0]);
});

check('T19: Codes mit "." oder "," als Tausendertrennzeichen (ganze Zelle)', () => {
  eq(['10.211', '3.712', '50.412', '6.251', '50,412', '50 412', '50.410,00', '50,410.00'].map(resolve),
    ['10211', '3712', '50412', '6251', '50412', '50412', '50410', '50410']);   // früher 211, 712, 412, 251 …
  eq(['50410.0', '50410,0', '511'].map(resolve), ['50410', '50410', '511']);
  eq(['50.999', '1.234', '1.234.567', '12.03.2026', '50.410.0'].map(resolve), [null, null, null, null, null]);
  eq(['511,517', '511.517', '315 312'].map(resolve), ['511', '511', '315']);   // 3 Ziffern vorne: eher eine Liste von Codes
  eq(['50 412', '3 712', '10 211'].map(resolve), [null, null, null]);   // gewöhnliches Leerzeichen: nicht 412, 712, 211 (s. T9)
  // in einer Tabelle
  const rows = table(['Notiz', 'Code'], 12, i => [MAILS[i % 4], ['50.410', '50.114', '3.712', '10.211'][i % 4]]);
  eq(tc(rows).cases.map(c => c.c).slice(0, 4), ['50410', '50114', '3712', '10211']);
});

check('T20: Standardblatt mit opts.resolve: das erste Blatt mit Fällen, nicht eine Übersicht davor', async () => {
  const row = (r, a, b) => '<row r="' + r + '">' + is('A' + r, a) + (/^\d+$/.test(b) ? '<c r="B' + r + '"><v>' + b + '</v></c>' : is('B' + r, b)) + '</row>';
  const uebersicht = [row(1, 'Klassifizierung', 'Anzahl'), ...CODES4.map((c, i) => row(i + 2, c + ' - ' + E.byCode[c].label, String(10 + i))), row(6, 'Gesamt', '46')].join('');
  const faelle = [row(1, 'Notiz', 'Code'), ...table(null, 6, i => row(i + 2, MAILS[i % 4], CODES4[i % 4]))].join('');
  const z = xlsx1(uebersicht, '', [['Übersicht'], ['Fälle', null, faelle]]);
  let x = await T.read(z, 'f.xlsx');
  eq([x.sheet, x.sheetIndex], ['Übersicht', 0]);   // ohne resolve wie bisher
  x = await T.read(z, 'f.xlsx', { resolve });
  eq([x.sheet, x.sheetIndex, x.sheets], ['Fälle', 1, ['Übersicht', 'Fälle']]);
  eq(tc(x.rows).cases.length, 6);
  x = await T.read(z, 'f.xlsx', { resolve, sheet: 0 });   // Auswahl gilt
  eq(x.sheet, 'Übersicht');
  // kein Blatt mit Fällen: das erste mit Daten
  x = await T.read(xlsx1('<row r="1">' + is('A1', 'nur Titel') + '</row>', '', [['Titel'], ['Übersicht', null, uebersicht]]), 'f.xlsx', { resolve });
  eq([x.sheet, x.sheetIndex], ['Übersicht', 1]);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); } catch (e) { failed++; console.log('FEHLER  ' + name + '\n   ' + String(e && e.stack || e).split('\n').slice(0, 12).join('\n   ')); }
  }
  if (failed) { console.log(`Table: ${failed} von ${tests.length} Tests fehlgeschlagen`); process.exit(1); }
  console.log(`Table: ${tests.length} Tests OK`);
})();
