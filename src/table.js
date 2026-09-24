/* =====================================================================
   TABELLEN-IMPORT – liest importierte Dateien mit früheren Fällen
   ---------------------------------------------------------------------
   Alles läuft lokal (Browser oder Node), nichts wird verschickt.
   1. Text-Dateien (CSV/TSV, auch aus Excel kopiert): Zeichensatz und
      Trennzeichen werden erkannt ("sep=;" von Excel beachtet), Felder nach RFC 4180
   2. Excel (.xlsx): kleiner ZIP-Leser, XML per Textsuche (kein DOMParser),
      verbundene Zellen werden gefüllt, Blatt wählbar (Standard: erstes Blatt
      mit Daten). Excel-2003-XML und HTML-Tabellen (beide oft ".xls") werden
      gelesen, altes binäres .xls wird abgelehnt.
   3. Spalten erraten (Kopfzeile, Text, Klassifizierung, Gruppen) und Zeilen in
      Lernbeispiele { t, c } umwandeln. rows.lineNos = Zeilennummer wie in Excel.
   ===================================================================== */
var Table = (function () {
  function fail(code, msg) { var e = new Error(msg); e.code = code; return e; }
  function bytesOf(b) {
    if (b instanceof Uint8Array) return b;
    if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return new Uint8Array(b);
  }
  function str(v) { return v == null ? "" : String(v); }
  function blank(v) { return !str(v).trim(); }
  function cell(r, i) { return str(r && r[i]); }
  function pad(rows) {
    var w = 0, i;
    rows.forEach(function (r) { if (r.length > w) w = r.length; });
    rows.forEach(function (r) { for (i = 0; i < w; i++) if (r[i] == null) r[i] = ""; });
    return rows;
  }
  // Leere Zeilen weglassen, auffüllen; rows.lineNos = Zeilennummer, wie sie in Excel zu sehen ist
  function withLines(rows, nums) {
    var out = [], ln = [], i;
    for (i = 0; i < rows.length; i++) if (rows[i] && !rows[i].every(blank)) { out.push(rows[i]); ln.push(nums[i]); }
    // nicht aufzählbar: rows bleibt ein gewöhnliches Array (Vergleiche, for-in)
    Object.defineProperty(pad(out), "lineNos", { value: ln, writable: true, configurable: true, enumerable: false });
    return out;
  }

  /* ---------- Zeichensatz ---------- */
  // windows-1252: Zeichen 0x80–0x9F (Rest wie Latin-1)
  var CP1252 = [0x20AC, 0x81, 0x201A, 0x192, 0x201E, 0x2026, 0x2020, 0x2021, 0x2C6, 0x2030, 0x160, 0x2039, 0x152, 0x8D, 0x17D, 0x8F,
    0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x2DC, 0x2122, 0x161, 0x203A, 0x153, 0x9D, 0x17E, 0x178];

  // n Zeichencodes -> String (stückweise wegen der Argument-Grenze von apply)
  function chars(n, at) {
    var s = "", buf = [], i;
    for (i = 0; i < n; i++) {
      buf.push(at(i));
      if (buf.length === 8192) { s += String.fromCharCode.apply(null, buf); buf = []; }
    }
    return s + String.fromCharCode.apply(null, buf);
  }
  function utf8(u) { return new TextDecoder("utf-8").decode(u); }
  function utf16(u, be) {
    try { return new TextDecoder(be ? "utf-16be" : "utf-16le").decode(u); } catch (e) { /* Ersatz unten */ }
    return chars(u.length >> 1, function (i) { var a = u[2 * i], b = u[2 * i + 1]; return be ? a << 8 | b : b << 8 | a; });
  }
  function cp1252(u) {
    try { return new TextDecoder("windows-1252").decode(u); } catch (e) { /* Ersatz unten */ }
    return chars(u.length, function (i) { var b = u[i]; return b >= 0x80 && b < 0xA0 ? CP1252[b - 0x80] : b; });
  }

  // UTF-8 mit wenigen kaputten Bytes: viele gültige Nicht-ASCII-Zeichen, höchstens 5 % Ersatzzeichen
  function mostlyUtf8(s) {
    var good = 0, bad = 0, i, c;
    for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); if (c === 0xFFFD) bad++; else if (c > 0x7F) good++; }
    return good >= 10 && bad <= (good + bad) * 0.05;
  }

  // Bytes -> Text: BOM, sonst UTF-16 (viele Nullbytes), UTF-8, sonst windows-1252 (Excel "CSV" aus der Schweiz)
  function decode(bytes) {
    var u = bytesOf(bytes), s, n = Math.min(u.length, 200) >> 1, z0 = 0, z1 = 0, i;
    if (u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF) s = utf8(u.subarray(3));
    else if (u[0] === 0xFF && u[1] === 0xFE) s = utf16(u.subarray(2), false);
    else if (u[0] === 0xFE && u[1] === 0xFF) s = utf16(u.subarray(2), true);
    else {
      for (i = 0; i < n; i++) { if (!u[2 * i]) z0++; if (!u[2 * i + 1]) z1++; }
      if (n >= 2 && z1 >= n * 0.3 && z0 <= n * 0.1) s = utf16(u, false);
      else if (n >= 2 && z0 >= n * 0.3 && z1 <= n * 0.1) s = utf16(u, true);
      else {
        try { s = new TextDecoder("utf-8", { fatal: true }).decode(u); } catch (e) { s = utf8(u); if (!mostlyUtf8(s)) s = cp1252(u); }
      }
    }
    return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
  }

  /* ---------- CSV / TSV ---------- */
  var DELIMS = ["\t", ";", ",", "|"];

  // Schliessendes " zu einem Feld, das bei i-1 mit " beginnt. -1 = dieses " ist ein normales Zeichen:
  // nie geschlossen, oder mehrzeilig und nach dem " geht das Feld weiter (einzelnes " am Anfang einer eingefügten Zelle)
  function closeQuote(text, i, dc) {
    var n = text.length, j = i, k, c;
    for (;;) {
      j = text.indexOf("\"", j);
      if (j < 0) return -1;
      if (text.charCodeAt(j + 1) !== 34) break;
      j += 2;
    }
    for (k = j + 1; k < n && (c = text.charCodeAt(k)) !== dc && (c === 32 || c === 9); k++);
    if (k >= n || c === dc || c === 10 || c === 13) return j;
    return /[\r\n]/.test(text.slice(i, j)) ? -1 : j;
  }

  // Datensätze nach RFC 4180 lesen ("" = Anführungszeichen, Trenner und Zeilenumbruch in "..." erlaubt)
  function records(text, d, max) {
    var rows = [], row = [], n = text.length, dc = d.charCodeAt(0), i = 0, j, c, f;
    if (!n) return rows;
    for (;;) {
      f = "";
      if (text.charCodeAt(i) === 34 && (j = closeQuote(text, i + 1, dc)) >= 0) {
        f = text.slice(i + 1, j).replace(/""/g, "\"").replace(/\r\n?/g, "\n");
        i = j + 1;
      }
      // ohne Anführungszeichen (oder Rest nach dem schliessenden ") bis zum Trenner
      for (j = i; j < n; j++) { c = text.charCodeAt(j); if (c === dc || c === 10 || c === 13) break; }
      row.push(f + text.slice(i, j));
      i = j;
      if (i >= n) { rows.push(row); return rows; }
      c = text.charCodeAt(i++);
      if (c === dc) continue;
      if (c === 13 && text.charCodeAt(i) === 10) i++;
      rows.push(row); row = [];
      if (i >= n || rows.length === max) return rows;
    }
  }

  // Trennzeichen: kommt in den meisten Datensätzen gleich oft vor; sonst Tab (= eine Spalte)
  function detectDelimiter(text) {
    var best = "\t", top = 0;
    text = str(text);
    DELIMS.forEach(function (d) {
      var recs = records(text, d, 60).filter(function (r) { return !r.every(blank); }).slice(0, 30);
      var freq = {}, has = 0, mode = 0;
      recs.forEach(function (r) {
        var k = r.length - 1;
        if (k < 1) return;
        has++; freq[k] = (freq[k] || 0) + 1;
        if (freq[k] > mode) mode = freq[k];
      });
      // nur wenn in mindestens der Hälfte der Datensätze vorhanden
      var score = has && has * 2 >= recs.length ? has + mode : 0;
      if (score > top) { top = score; best = d; }
    });
    return best;
  }

  // Erste Zeile "sep=;" (Hinweis für Excel): legt das Trennzeichen fest, ist keine Datenzeile
  var SEP = /^"?sep=([^\r\n"])"?[ \t]*(?:\r\n?|\n|$)/i;

  // Text -> Zeilen; rows.lineNos = Nummer des Datensatzes (leere mitgezählt, wie die Zeilen in Excel)
  function parseDelimited(text, delim) {
    var m, recs;
    text = str(text);
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if ((m = SEP.exec(text))) text = text.slice(m[0].length);
    recs = records(text, delim || (m ? m[1] : detectDelimiter(text)));
    return withLines(recs, recs.map(function (r, i) { return i + 1; }));
  }

  /* ---------- HTML-Tabelle (manche Programme speichern so ".xls"-Exporte) ---------- */
  var HENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", auml: "ä", ouml: "ö", uuml: "ü",
    Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à", euro: "€" };
  function isHtml(text) { return /^\s*</.test(text) && /<table\b/i.test(text); }
  // Tag bis zum ">" (ein ">" in Attributwerten mit Anführungszeichen zählt nicht)
  function tagRe(start, flags) { return new RegExp(start + "(?:\"[^\"]*\"|'[^']*'|[^'\">])*>", flags); }
  var TR = tagRe("<tr\\b", "i"), TD = new RegExp("<t[dh]\\b((?:\"[^\"]*\"|'[^']*'|[^'\">])*)>", "gi"),
    BR = tagRe("<br\\b", "gi"), TAG = tagRe("<[a-zA-Z\\/!]", "g");
  // rowspan/colspan (Excel schreibt Attribute auch ohne Anführungszeichen)
  function span(tag, re, max) { var m = re.exec(tag), k = m ? parseInt(m[1], 10) : 1; return k > 1 ? Math.min(k, max) : 1; }
  // Zeilen der HTML-Tabelle; rowspan/colspan: der Wert steht in allen überdeckten Zellen
  function htmlRows(text) {
    var rows = [], nums = [], carry = [];   // carry[Spalte] = { v: Wert, left: noch überdeckte Zeilen }
    text = text.replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
    text.split(TR).slice(1).forEach(function (tr, ti) {
      var body = tr.split(/<\/tr\s*>|<\/table\s*>/i)[0], cells = [], row = [], k = 0, m, x;
      function covered() { while (carry[k] && carry[k].left > 0) { row[k] = carry[k].v; carry[k].left--; k++; } }
      TD.lastIndex = 0;
      while ((m = TD.exec(body))) cells.push({ tag: m[1], at: m.index, from: TD.lastIndex });
      cells.forEach(function (c, i) {
        var td = body.slice(c.from, i + 1 < cells.length ? cells[i + 1].at : body.length),
          cs = span(c.tag, /\bcolspan\s*=\s*["']?\s*(\d+)/i, 1000), rs = span(c.tag, /\browspan\s*=\s*["']?\s*(\d+)/i, 100000);
        td = td.split(/<\/t[dh]\s*>/i)[0].replace(/\s+/g, " ").replace(BR, "\n").replace(/<\/(p|div|li)\s*>/gi, "\n").replace(TAG, "");
        td = ent(td, HENT).split("\n").map(function (l) { return l.trim(); }).join("\n").replace(/^\n+|\n+$/g, "");
        covered();
        for (x = 0; x < cs; x++, k++) { row[k] = td; carry[k] = rs > 1 ? { v: td, left: rs - 1 } : null; }
      });
      // rechts davon: noch von oben überdeckte Spalten
      for (; k < carry.length; k++) if (carry[k] && carry[k].left > 0) { row[k] = carry[k].v; carry[k].left--; }
      rows.push(row); nums.push(ti + 1);
      if (/<\/table\b/i.test(tr)) carry = [];   // Tabelle zu Ende
    });
    return withLines(rows, nums);
  }

  /* ---------- ZIP (für .xlsx) ---------- */
  function isXlsx(bytes) { var u = bytesOf(bytes); return u[0] === 0x50 && u[1] === 0x4B && u[2] === 3 && u[3] === 4; }
  function isXls(bytes) {
    var u = bytesOf(bytes), sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], i;
    for (i = 0; i < 8; i++) if (u[i] !== sig[i]) return false;
    return true;
  }
  // Passwortgeschütztes .xlsx steckt ebenfalls in einer alten OLE-Datei ("EncryptedPackage")
  function encryptedOle(u) {
    var w = "EncryptedPackage", i, j;
    outer: for (i = 0; i + 2 * w.length <= u.length; i++) {
      for (j = 0; j < w.length; j++) if (u[i + 2 * j] !== w.charCodeAt(j) || u[i + 2 * j + 1]) continue outer;
      return true;
    }
    return false;
  }
  function xlsError(u) {
    var enc = encryptedOle(u), e = fail("XLS", enc
      ? "Die Excel-Datei ist mit einem Passwort geschützt. Bitte ohne Passwort als .xlsx oder CSV speichern."
      : "Altes Excel-Format (.xls) wird nicht unterstützt. Bitte in Excel als .xlsx oder CSV speichern.");
    if (enc) e.encrypted = true;
    return e;
  }

  function inflate(raw) {
    try {
      return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()
        .then(function (b) { return new Uint8Array(b); }, function () { throw fail("ZIP", "Die Excel-Datei ist beschädigt (Entpacken fehlgeschlagen)."); });
    } catch (e) {
      return Promise.reject(fail("ZIP", "Dieser Browser kann die Excel-Datei nicht entpacken. Bitte als CSV speichern."));
    }
  }

  // Inhaltsverzeichnis lesen: End Of Central Directory suchen, dann Central Directory durchgehen
  function unzip(u) {
    var dv = new DataView(u.buffer, u.byteOffset, u.byteLength), n = u.length, p = n - 22, stop = Math.max(0, n - 22 - 65535);
    var files = {}, count, off, i, nl, name;
    for (; p >= stop; p--) if (dv.getUint32(p, true) === 0x06054b50) break;
    if (p < stop) throw fail("ZIP", "Die Excel-Datei ist beschädigt (ZIP-Verzeichnis fehlt).");
    count = dv.getUint16(p + 10, true); off = dv.getUint32(p + 16, true);
    if (count === 0xFFFF || off === 0xFFFFFFFF) throw fail("ZIP", "Zu grosse Excel-Datei (ZIP64) wird nicht unterstützt.");
    for (i = 0; i < count; i++) {
      if (off + 46 > n || dv.getUint32(off, true) !== 0x02014b50) throw fail("ZIP", "Die Excel-Datei ist beschädigt (ZIP-Verzeichnis).");
      nl = dv.getUint16(off + 28, true);
      name = utf8(u.subarray(off + 46, off + 46 + nl)).replace(/\\/g, "/").toLowerCase();
      files[name] = { flags: dv.getUint16(off + 8, true), method: dv.getUint16(off + 10, true), size: dv.getUint32(off + 20, true),
        usize: dv.getUint32(off + 24, true), at: dv.getUint32(off + 42, true) };
      off += 46 + nl + dv.getUint16(off + 30, true) + dv.getUint16(off + 32, true);
    }
    function bytes(path) {   // Promise<Uint8Array|null>
      var e = files[path.toLowerCase()], start;
      if (!e) return Promise.resolve(null);
      if (e.flags & 1) return Promise.reject(fail("ZIP", "Verschlüsselte Excel-Datei wird nicht unterstützt."));
      if (e.size === 0xFFFFFFFF || e.usize === 0xFFFFFFFF || e.at === 0xFFFFFFFF) return Promise.reject(fail("ZIP", "Zu grosse Excel-Datei (ZIP64) wird nicht unterstützt."));
      if (e.at + 30 > n || dv.getUint32(e.at, true) !== 0x04034b50) return Promise.reject(fail("ZIP", "Die Excel-Datei ist beschädigt."));
      // Namens- und Zusatzfeldlänge aus dem LOKALEN Kopf (kann vom Verzeichnis abweichen)
      start = e.at + 30 + dv.getUint16(e.at + 26, true) + dv.getUint16(e.at + 28, true);
      if (start + e.size > n) return Promise.reject(fail("ZIP", "Die Excel-Datei ist beschädigt (abgeschnitten)."));
      if (e.method === 0) return Promise.resolve(u.subarray(start, start + e.size));
      if (e.method !== 8) return Promise.reject(fail("ZIP", "Komprimierungsart " + e.method + " wird nicht unterstützt."));
      return inflate(u.subarray(start, start + e.size));
    }
    return {
      names: Object.keys(files),
      has: function (path) { return !!files[path.toLowerCase()]; },
      text: function (path) { return bytes(path).then(function (b) { return b && decode(b); }); }
    };
  }

  /* ---------- XML per Textsuche ---------- */
  var XENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
  function codePoint(n) {
    if (!(n > 0 && n <= 0x10FFFF)) return "\uFFFD";
    if (n < 0x10000) return String.fromCharCode(n);
    n -= 0x10000;
    return String.fromCharCode(0xD800 + (n >> 10), 0xDC00 + (n & 1023));
  }
  function ent(s, names) {
    return s.replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));/g, function (m, h, d, nm) {
      if (nm) return names[nm] != null ? names[nm] : m;
      return codePoint(h ? parseInt(h, 16) : parseInt(d, 10));
    });
  }
  // Zelltext: XML-Entities, dann OOXML-Escapes (_x000D_), Zeilenumbrüche vereinheitlichen
  function xtext(s) {
    return ent(s, XENT).replace(/_x([0-9a-fA-F]{4})_/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/\r\n?/g, "\n");
  }
  function attrs(s) {
    var o = {}, re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, m;
    while ((m = re.exec(s))) o[m[1]] = ent(m[2] != null ? m[2] : m[3], XENT);
    return o;
  }
  // Alle Elemente <name ...>...</name> oder <name .../> (mit beliebigem Namensraum-Präfix; ">" in Attributwerten erlaubt)
  function each(xml, name, fn) {
    var re = new RegExp("<(?:\\w+:)?" + name + "\\b((?:\"[^\"]*\"|'[^']*'|[^'\"\\/>])*)(?:\\/>|>([\\s\\S]*?)<\\/(?:\\w+:)?" + name + "\\s*>)", "g"), m;
    while ((m = re.exec(xml))) fn(attrs(m[1]), m[2] || "");
  }
  // Text aus <t>-Elementen (auch Rich-Text-Läufe <r>), ohne Lautschrift <rPh>
  function runs(xml) {
    var s = "";
    xml = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh\s*>/g, "").replace(/<(?:\w+:)?t\b[^>]*\/>/g, "");
    each(xml, "t", function (a, inner) { s += inner; });
    return xtext(s);
  }
  function colIndex(ref) {   // "B3" -> 1, "AA1" -> 26
    var m = /^\$?([A-Za-z]{1,3})/.exec(ref || ""), n = 0, i, L;
    if (!m) return -1;
    L = m[1].toUpperCase();
    for (i = 0; i < L.length; i++) n = n * 26 + L.charCodeAt(i) - 64;
    return n - 1;
  }
  function cellValue(a, inner, sst) {
    var t = a.t || "n", v;
    if (t === "inlineStr" || /<(?:\w+:)?is\b/.test(inner)) return runs(inner);
    v = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v\s*>/.exec(inner);
    if (!v) return "";
    v = xtext(v[1]);
    if (t === "s") return str(sst[parseInt(v, 10)]);
    if (t === "b") return v === "1" ? "TRUE" : v === "0" ? "FALSE" : v;
    return v;
  }
  // Verbundene Zellen: Wert oben links in den ganzen Bereich (nur vorhandene Zeilen, nur bis zur Tabellenbreite)
  // ranges: [erste Zeile, erste Spalte, letzte Zeile, letzte Spalte], Zeilen als Blatt-Nummern, Spalten ab 0
  function fillMerged(rows, nums, ranges) {
    var byNum = {}, w = 0, maxR = 0;
    rows.forEach(function (r, i) { byNum[nums[i]] = r; if (r.length > w) w = r.length; if (nums[i] > maxR) maxR = nums[i]; });
    ranges.forEach(function (m) {
      var v = byNum[m[0]] ? str(byNum[m[0]][m[1]]) : "", r, c, row;
      if (blank(v)) return;
      for (r = m[0]; r <= Math.min(m[2], maxR); r++) {
        if (!(row = byNum[r])) continue;
        for (c = m[1]; c <= Math.min(m[3], w - 1); c++) if (blank(row[c])) row[c] = v;
      }
    });
  }
  function sheetRows(xml, sst) {
    var rows = [], nums = [], r = 0, merged = [], tail = xml.lastIndexOf("sheetData>");
    each(xml, "row", function (ra, inner) {
      var row = [], col = -1;
      r = +ra.r > 0 ? +ra.r : r + 1;
      each(inner, "c", function (a, content) {
        var k = a.r ? colIndex(a.r) : -1;
        col = k >= 0 ? k : col + 1;
        if (col < 16384) row[col] = content ? cellValue(a, content, sst) : "";
      });
      while (row.length && blank(row[row.length - 1])) row.pop();
      rows.push(row); nums.push(r);
    });
    // <mergeCell ref="A2:A5"/> (steht nach sheetData)
    if (tail >= 0 && xml.indexOf("mergeCell", tail) >= 0) each(xml.slice(tail), "mergeCell", function (a) {
      var p = str(a.ref).split(":"), r1 = parseInt(str(p[0]).replace(/^\$?[A-Za-z]+\$?/, ""), 10), r2 = parseInt(str(p[1]).replace(/^\$?[A-Za-z]+\$?/, ""), 10);
      if (p.length === 2 && r1 > 0 && r2 >= r1 && colIndex(p[0]) >= 0 && colIndex(p[1]) >= colIndex(p[0])) merged.push([r1, colIndex(p[0]), r2, colIndex(p[1])]);
    });
    fillMerged(rows, nums, merged);
    return withLines(rows, nums);
  }
  function relPath(target) {   // Ziel einer Beziehung (relativ zu xl/ oder absolut) -> Pfad im ZIP
    var out = [];
    (target.charAt(0) === "/" ? target.slice(1) : "xl/" + target).split("/").forEach(function (p) {
      if (p === "..") out.pop(); else if (p && p !== ".") out.push(p);
    });
    return out.join("/");
  }

  // Blatt mit Daten: mindestens 5 Zeilen mit mindestens 2 gefüllten Zellen
  function hasData(rows) {
    var n = 0, i, j, k;
    for (i = 0; i < rows.length && n < 5; i++) {
      for (j = k = 0; j < rows[i].length && k < 2; j++) if (!blank(rows[i][j])) k++;
      if (k >= 2) n++;
    }
    return n >= 5;
  }
  // Blatt wählen: opts.sheet (Index in names = sichtbare Blätter), sonst das erste mit Daten, sonst das erste.
  // load(k) liefert die Zeilen (oder ein Promise darauf)
  function pickSheet(names, load, opts) {
    var want = opts && opts.sheet != null && opts.sheet !== "" ? +opts.sheet : -1, first;
    function done(k, rows) { return { rows: rows, sheet: names[k], sheets: names, sheetIndex: k }; }
    function next(k) {
      return Promise.resolve(load(k)).then(function (rows) {
        if (!k) first = rows;
        if (hasData(rows)) return done(k, rows);
        return k + 1 < names.length ? next(k + 1) : done(0, first);
      });
    }
    if (want >= 0 && want < names.length && want % 1 === 0) return Promise.resolve(load(want)).then(function (rows) { return done(want, rows); });
    return next(0);
  }

  // Tabellenblätter in der Reihenfolge der Arbeitsmappe (ausgeblendete nur, wenn kein anderes da ist)
  function readXlsx(bytes, opts) {
    var zip;
    try { zip = unzip(bytesOf(bytes)); } catch (e) { return Promise.reject(e); }
    return Promise.all([zip.text("xl/workbook.xml"), zip.text("xl/_rels/workbook.xml.rels")]).then(function (r) {
      var rels = {}, sheets = [], ssPath = "xl/sharedStrings.xml", ok, vis, nums;
      each(r[1] || "", "Relationship", function (a) {
        if (!a.Id || !a.Target) return;
        rels[a.Id] = relPath(a.Target);
        if (/\/sharedStrings$/.test(a.Type || "")) ssPath = rels[a.Id];
      });
      each(r[0] || "", "sheet", function (a) {
        var id = "";
        Object.keys(a).forEach(function (k) { if (/:id$/.test(k)) id = a[k]; });
        sheets.push({ name: a.name || "", path: rels[id], hidden: /hidden/i.test(a.state || "") });
      });
      ok = sheets.filter(function (s) { return s.path && zip.has(s.path); });
      vis = ok.filter(function (s) { return !s.hidden; });
      if (!vis.length) vis = ok;
      if (!vis.length) {   // ohne verwertbare Arbeitsmappe: xl/worksheets/sheetN.xml nach Nummer
        nums = zip.names.map(function (f) { var m = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(f); return m ? +m[1] : -1; })
          .filter(function (k) { return k >= 0; }).sort(function (a, b) { return a - b; });
        if (!nums.length) throw fail("ZIP", "In der Datei wurde keine Excel-Tabelle gefunden.");
        vis = nums.map(function (k) { return { name: "sheet" + k, path: "xl/worksheets/sheet" + k + ".xml" }; });
      }
      return zip.text(ssPath).then(function (x) {
        var sst = [];
        if (x) each(x, "si", function (a, inner) { sst.push(runs(inner)); });
        return pickSheet(vis.map(function (s) { return s.name; }), function (k) {
          return zip.text(vis[k].path).then(function (xml) { return sheetRows(xml || "", sst); });
        }, opts);
      });
    });
  }

  /* ---------- Excel-2003-XML ("XML-Kalkulationstabelle", oft als .xls gespeichert) ---------- */
  function isXml2003(text) { return /^\s*<\?xml/.test(text) && text.indexOf("urn:schemas-microsoft-com:office:spreadsheet") >= 0; }
  function att(a, name) {   // Attribut ohne Namensraum-Präfix (ss:Index -> Index)
    for (var k in a) if (k === name || k.slice(-name.length - 1) === ":" + name) return a[k];
    return null;
  }
  // <Row ss:Index><Cell ss:Index ss:MergeAcross ss:MergeDown><Data>…</Data></Cell></Row>
  function xml2003Rows(xml) {
    var rows = [], nums = [], merged = [], r = 0;
    each(xml.replace(/<(?:\w+:)?Comment\b[\s\S]*?<\/(?:\w+:)?Comment\s*>/g, ""), "Row", function (ra, inner) {
      var row = [], c = 0;
      r = +att(ra, "Index") > 0 ? +att(ra, "Index") : r + 1;
      each(inner, "Cell", function (a, content) {
        var ma = Math.min(+att(a, "MergeAcross") || 0, 1000), md = Math.min(+att(a, "MergeDown") || 0, 100000),
          d = /<(?:\w+:)?Data\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Data\s*>/.exec(content);
        c = +att(a, "Index") > 0 ? +att(a, "Index") : c + 1;
        if (c > 16384) return;
        row[c - 1] = d ? xtext(d[1].replace(TAG, "")) : "";   // Rich-Text (<B>, <Font>) ohne Tags
        if (ma > 0 || md > 0) merged.push([r, c - 1, r + md, c - 1 + ma]);
        c += ma;
      });
      rows.push(row); nums.push(r);
    });
    fillMerged(rows, nums, merged);
    return withLines(rows, nums);
  }
  function readXml2003(text, opts) {
    var sheets = [], vis;
    each(text, "Worksheet", function (a, inner) {
      sheets.push({ name: att(a, "Name") || "", xml: inner, hidden: /<(?:\w+:)?Visible\s*>\s*Sheet(Very)?Hidden/i.test(inner) });
    });
    vis = sheets.filter(function (s) { return !s.hidden; });
    if (!vis.length) vis = sheets;
    if (!vis.length) return Promise.resolve({ rows: withLines([], []), format: "xml2003" });
    return pickSheet(vis.map(function (s) { return s.name; }), function (k) { return xml2003Rows(vis[k].xml); }, opts)
      .then(function (x) { return { rows: x.rows, format: "xml2003", sheet: x.sheet, sheets: x.sheets, sheetIndex: x.sheetIndex }; });
  }

  // Datei lesen: .xlsx, Excel-2003-XML, HTML-Tabelle oder Text (CSV/TSV); altes .xls -> Fehler "XLS".
  // opts.sheet = Index des Blattes in der gelieferten Liste sheets
  function read(bytes, fileName, opts) {
    return new Promise(function (ok) {
      var u = bytesOf(bytes), text, d, m;
      if (isXls(u)) throw xlsError(u);
      if (isXlsx(u)) {
        ok(readXlsx(u, opts).then(function (x) { return { rows: x.rows, format: "xlsx", sheet: x.sheet, sheets: x.sheets, sheetIndex: x.sheetIndex }; }));
        return;
      }
      text = decode(u);
      if (isXml2003(text)) { ok(readXml2003(text, opts)); return; }
      if (isHtml(text)) { ok({ rows: htmlRows(text), format: "html" }); return; }
      m = SEP.exec(text);
      d = m ? m[1] : detectDelimiter(text);
      ok({ rows: parseDelimited(text, d), format: "text", delimiter: d });
    });
  }

  /* ---------- Spalten erkennen, Fälle bilden ---------- */
  // gleich wie Engine.norm
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  // Zellwert -> Code: 1. Zahl mit 3–5 Ziffern ("50'410" = 50410), 2. genaue Bezeichnung,
  // 3. längste enthaltene Bezeichnung (eindeutig, mindestens 8 Zeichen), aber nur wenn sie fast den ganzen Wert
  //    ausmacht (>= 70 %) oder der Wert eine Hierarchie ist ("Operations > …", "Kategorie: …").
  //    So werden Platzhalter wie "Grund unbekannt" oder "Kein Material" nicht zu einem Code.
  function codeResolver(classes) {
    var known = Object.create(null), exact = Object.create(null), labels = [], memo = Object.create(null);
    (classes || []).forEach(function (c) {
      var code = str(c.code);
      known[code] = 1;
      [c.label, c.alt].forEach(function (l) {
        var n = l ? norm(l) : "";
        if (!n) return;
        exact[n] = exact[n] && exact[n] !== code ? "?" : code;   // "?" = mehrdeutig
        if (n.length >= 8) labels.push({ n: " " + n + " ", len: n.length, code: code });
      });
    });
    labels.sort(function (a, b) { return b.len - a.len; });
    function find(s) {
      var re = /(^|\D)(\d{3,5})(?!\d)/g, m, v, i, k, x, L, hit = null, tree;
      s = s.trim().replace(/(\d)['\u2019`\u2009\u202F](?=\d{3}(?!\d))/g, "$1");   // Tausendertrennzeichen
      while ((m = re.exec(s))) if (known[m[2]]) return m[2];
      v = norm(s);
      if (!v) return null;
      if (exact[v] && exact[v] !== "?") return exact[v];
      tree = /[>\/|:()\u2013-]/.test(s);
      L = v.length; v = " " + v + " ";
      for (i = 0; i < labels.length && (!hit || labels[i].len === hit.len); i++) {
        x = labels[i];
        if (x.len >= 0.7 * L) k = v.indexOf(x.n);
        // Hierarchie: Bezeichnung am Ende, höchstens ein kurzer Zusatz danach ("… > Lieferverzögerung (Kulanz)")
        else if (tree) k = v.indexOf(x.n, Math.max(0, Math.floor(L - x.len / 0.6)));
        else break;   // alle weiteren sind noch kürzer
        if (k < 0) continue;
        if (hit && hit.code !== x.code) return null;
        hit = x;
      }
      return hit ? hit.code : null;
    }
    return function (value) {
      if (value == null) return null;
      var k = String(value);
      return k in memo ? memo[k] : (memo[k] = find(k));
    };
  }

  // Titel, bei denen die Spalte nicht als Text taugt (ausser der Titel sagt zugleich "Text" und die Zellen sind lang)
  var SKIP = /(e-?mail|name|telefon|phone|\btel\b|adresse|address|strasse|plz|\bort\b|kunden-?nr|kundennummer|bestell-?nr|bestellnummer|auftrags-?nr|order|datum|date|zeit|time|\bid\b|nummer|number|status|owner|besitzer|bearbeiter|agent|kunde|kontakt|absender|\bvon\b|from|account|firma|link|\burls?\b|checksum|pr(ue|ü)fsumme|do not modify)/i;
  var EXTRA = /(betreff|subject|titel|title|beschreibung|description|nachricht|message|notiz|note|kommentar|comment|anliegen|problem|text|body|inhalt|mailtext|mail text|bemerkung|anmerkung|anfrage)/i;
  var CODEHEAD = /(klass|kateg|categ|class|code|grund|reason|typ|thema|topic)/i;
  var NUMERIC = /^[\d\s.,:\/+-]+$/;
  // Summenzeilen in gruppierten Berichten (in der Spalte Klassifizierung)
  var SUBTOTAL = /^\s*(zwischen|gesamt)?summe|^\s*gesamt|^\s*(sub-?|grand\s+)?total\b|^\s*anzahl\b|^\s*count\b|\b(ergebnis|summe|total)\s*$/i;
  // E-Mail-Adresse, Link, GUID, Prüfsumme/Base64
  var JUNK = /^(https?:\/\/|www\.)|^[{(]?[0-9a-f]{8}(-?[0-9a-f]{4}){3}-?[0-9a-f]{12}[)}]?$|^(?=\S*\d)(?=\S*[a-z])[A-Za-z0-9+\/_=-]{16,}$/i;
  function words(v) { return v.split(/\s+/).length; }
  function subtotal(v) { return SUBTOTAL.test(v); }

  // Kopfzeile, Spalte mit der Klassifizierung, Textspalten, Gruppen ohne Code in jeder Zeile?
  function guess(rows, resolve) {
    rows = rows || [];
    var n = rows.length, w = 0, top = Math.min(n, 315), codeCol = -1, best = 0, headerRow = -1, first = -1, hc = [],
      sample = [], stats = [], main = -1, cand = [], textCols, fillDown = false, i, j, k, v, s, ne, ok, tn, te, any;
    rows.forEach(function (r) { if (r.length > w) w = r.length; });
    // 1. Klassifizierung: grösster Anteil auflösbarer Werte (mindestens 30 %, ohne Summenzeilen)
    for (j = 0; j < w; j++) {
      for (i = ne = ok = 0; i < top; i++) {
        v = cell(rows[i], j).trim();
        if (!v || subtotal(v)) continue;
        ne++; if (resolve(v)) ok++;
      }
      if (ne && ok / ne >= 0.3 && ok / ne > best) { best = ok / ne; codeCol = j; }
    }
    // 2. Kopfzeile: letzte Zeile vor dem ersten gültigen Code (in den ersten 15), deren Code-Zelle Text ist;
    //    Titel- und Filterzeilen darüber zählen nicht. Bevorzugt eine Zeile, die wie Spaltentitel aussieht.
    function headerLike(r) {   // mindestens 2 kurze, verschiedene, nicht numerische Zellen
      var seen = Object.create(null), cnt = 0, x, y;
      for (x = 0; x < w; x++) {
        y = cell(rows[r], x).trim();
        if (!y) continue;
        if (y.length > 40 || NUMERIC.test(y) || seen[y]) return false;
        seen[y] = 1; cnt++;
      }
      return cnt >= 2;
    }
    if (codeCol >= 0) {
      for (i = 0; i < Math.min(n, 16) && first < 0; i++) {
        v = cell(rows[i], codeCol).trim();
        if (v && !subtotal(v) && resolve(v)) first = i;
        else if (i < 15 && v && !NUMERIC.test(v) && !subtotal(v)) hc.push(i);
      }
      if (first >= 0 && hc.length) {
        for (k = -1, i = 0; i < hc.length; i++) {
          s = headerLike(hc[i]) ? (CODEHEAD.test(cell(rows[hc[i]], codeCol)) ? 2 : 1) : 0;
          if (s >= k) { k = s; headerRow = hc[i]; }
        }
      } else {
        v = cell(rows[0], codeCol).trim();
        headerRow = v && !NUMERIC.test(v) && !resolve(v) ? 0 : -1;
      }
    } else headerRow = n > 1 && headerLike(0) ? 0 : -1;
    // 3. Datenzeilen (ohne Summenzeilen) auswerten
    for (i = headerRow + 1; i < n && sample.length < 300; i++) if (codeCol < 0 || !subtotal(cell(rows[i], codeCol))) sample.push(rows[i]);
    for (j = 0; j < w; j++) {
      s = { ne: 0, ok: 0, len: 0, words: 0, num: 0, one: 0, junk: 0 };
      for (i = 0; i < sample.length; i++) {
        v = cell(sample[i], j).trim();
        if (!v) continue;
        k = words(v);
        s.ne++; s.len += v.length; s.words += k;
        if (resolve(v)) s.ok++;
        if (NUMERIC.test(v)) s.num++;
        if (k === 1) s.one++;
        if (JUNK.test(v) || k <= 4 && v.indexOf("@") >= 0) s.junk++;
      }
      s.frac = s.ne ? s.ok / s.ne : 0; s.avg = s.ne ? s.len / s.ne : 0;
      s.score = s.ne ? s.ne / sample.length * s.words / s.ne : 0;   // Füllgrad × Wörter pro Zelle
      stats.push(s);
    }
    // 4. Textspalten: Haupttext = meiste Wörter (bei mindestens 30 % gefüllten Zeilen), dazu Spalten mit Text-Titel
    function title(x) { var t = headerRow >= 0 ? cell(rows[headerRow], x).trim() : ""; return t.length <= 40 ? t : ""; }
    for (j = 0; j < w; j++) {
      s = stats[j];
      if (j === codeCol || !s.ne || s.frac >= 0.3 || s.num > s.ne * 0.5 || s.one > s.ne * 0.7 || s.junk > s.ne * 0.3) continue;
      if (SKIP.test(title(j)) && !(EXTRA.test(title(j)) && s.avg >= 20)) continue;
      cand.push(j);
      if (s.ne >= 0.3 * sample.length && s.words >= 1.5 * s.ne && (main < 0 || s.score > stats[main].score)) main = j;
    }
    textCols = main < 0 ? [] : cand.filter(function (x) { return x === main || headerRow >= 0 && EXTRA.test(title(x)) && stats[x].avg >= 5; });
    // 5. Gruppierter Bericht: Klassifizierung nur in der ersten Zeile der Gruppe, darunter leer
    if (codeCol >= 0 && textCols.length) {
      tn = te = 0; any = false;
      sample.forEach(function (r) {
        var c = cell(r, codeCol).trim();
        if (c && resolve(c)) any = true;
        if (!textCols.some(function (x) { return !blank(cell(r, x)); })) return;
        tn++; if (!c) te++;
      });
      fillDown = any && tn > 0 && te >= 0.3 * tn;
    }
    return { headerRow: headerRow, codeCol: codeCol, textCols: textCols, fillDown: fillDown };
  }

  // Zeilen nach der Kopfzeile -> Lernbeispiele. Jede Datenzeile zählt genau einmal: Fall, ohne Code, ohne Text,
  // Summenzeile oder (bei fillDown) Gruppenzeile. fillDown: leere Klassifizierung = die letzte darüber (bis zur Summenzeile)
  function toCases(rows, cfg, resolve) {
    var out = { cases: [], total: 0, noCode: 0, noText: 0, subtotal: 0, groupRows: 0, filled: 0, unknown: [], textColsWithCodes: [] };
    var unk = Object.create(null), order = [], cols = cfg.textCols || [], codeCol = cfg.codeCol == null ? -1 : cfg.codeCol;
    var hr = cfg.headerRow != null ? +cfg.headerRow : cfg.header ? 0 : -1, fill = !!cfg.fillDown && codeCol >= 0, last = null;
    var tc = cols.map(function () { return { ne: 0, ok: 0 }; }), lines, i, j, v, c, t, x, filled;
    rows = rows || [];
    lines = rows.lineNos;
    for (i = Math.max(hr + 1, 0); i < rows.length; i++) {
      out.total++;
      v = codeCol >= 0 ? cell(rows[i], codeCol).trim() : "";
      if (v && subtotal(v)) { out.subtotal++; last = null; continue; }
      c = v ? resolve(v) : null;
      filled = false;
      if (v) last = c; else if (fill && last) { c = last; filled = true; }
      t = [];
      for (j = 0; j < cols.length; j++) {
        x = cell(rows[i], cols[j]).trim();
        if (!x) continue;
        if (t.indexOf(x) < 0) t.push(x);   // gleicher Text in zwei Spalten nur einmal
        if (tc[j].ne < 500) { tc[j].ne++; if (resolve(x)) tc[j].ok++; }
      }
      if (!c) {
        out.noCode++;
        if (v) { if (!(v in unk)) { unk[v] = 0; order.push(v); } unk[v]++; }
        continue;
      }
      if (!t.length) { if (fill && v) out.groupRows++; else out.noText++; continue; }
      out.cases.push({ t: t.join("\n"), c: c, row: i, line: lines && lines[i] != null ? lines[i] : i + 1 });
      if (filled) out.filled++;
    }
    out.unknown = order.map(function (k, idx) { return [k, unk[k], idx]; })
      .sort(function (a, b) { return b[1] - a[1] || a[2] - b[2]; })
      .slice(0, 10).map(function (y) { return [y[0], y[1]]; });
    // Textspalten, in denen oft ein Code steht (verrät die Lösung)
    out.textColsWithCodes = cols.filter(function (k, idx) { return tc[idx].ne && tc[idx].ok >= 0.3 * tc[idx].ne; });
    return out;
  }

  return {
    decode: decode, detectDelimiter: detectDelimiter, parseDelimited: parseDelimited,
    isXlsx: isXlsx, isXls: isXls, readXlsx: readXlsx, read: read,
    norm: norm, codeResolver: codeResolver, guess: guess, toCases: toCases
  };
})();

if (typeof module !== "undefined") module.exports = Table;
