/* =====================================================================
   TABELLEN-IMPORT – liest importierte Dateien mit früheren Fällen
   ---------------------------------------------------------------------
   Alles läuft lokal (Browser oder Node), nichts wird verschickt.
   1. Text-Dateien (CSV/TSV, auch aus Excel kopiert): Zeichensatz und
      Trennzeichen werden erkannt, Felder nach RFC 4180 gelesen
   2. Excel (.xlsx): kleiner ZIP-Leser, XML per Textsuche (kein DOMParser),
      es wird das erste Tabellenblatt gelesen. Altes .xls wird abgelehnt.
   3. Spalten erraten (Text / Klassifizierung) und Zeilen in
      Lernbeispiele { t, c } umwandeln
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
    var w = 0;
    rows.forEach(function (r) { if (r.length > w) w = r.length; });
    rows.forEach(function (r) { while (r.length < w) r.push(""); });
    return rows;
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
        try { s = new TextDecoder("utf-8", { fatal: true }).decode(u); } catch (e) { s = cp1252(u); }
      }
    }
    return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
  }

  /* ---------- CSV / TSV ---------- */
  var DELIMS = ["\t", ";", ",", "|"];

  // Datensätze nach RFC 4180 lesen ("" = Anführungszeichen, Trenner und Zeilenumbruch in "..." erlaubt)
  function records(text, d, max) {
    var rows = [], row = [], n = text.length, dc = d.charCodeAt(0), i = 0, j, c, f;
    if (!n) return rows;
    for (;;) {
      f = "";
      if (text.charCodeAt(i) === 34) {
        for (i++; ;) {
          j = text.indexOf("\"", i);
          if (j < 0) { f += text.slice(i); i = n; break; }
          f += text.slice(i, j);
          if (text.charCodeAt(j + 1) === 34) { f += "\""; i = j + 2; } else { i = j + 1; break; }
        }
        f = f.replace(/\r\n?/g, "\n");
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

  function parseDelimited(text, delim) {
    text = str(text);
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return pad(records(text, delim || detectDelimiter(text)).filter(function (r) { return !r.every(blank); }));
  }

  /* ---------- HTML-Tabelle (manche Programme speichern so ".xls"-Exporte) ---------- */
  var HENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", auml: "ä", ouml: "ö", uuml: "ü",
    Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à", euro: "€" };
  function isHtml(text) { return /^\s*</.test(text) && /<table\b/i.test(text); }
  // Tag bis zum ">" (ein ">" in Attributwerten mit Anführungszeichen zählt nicht)
  function tagRe(start, flags) { return new RegExp(start + "(?:\"[^\"]*\"|'[^']*'|[^'\">])*>", flags); }
  var TR = tagRe("<tr\\b", "i"), TD = tagRe("<t[dh]\\b", "i"), BR = tagRe("<br\\b", "gi"), TAG = tagRe("<[a-zA-Z\\/!]", "g");
  function htmlRows(text) {
    var rows = [];
    text = text.replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
    text.split(TR).slice(1).forEach(function (tr) {
      var row = tr.split(/<\/tr\s*>|<\/table\s*>/i)[0].split(TD).slice(1).map(function (td) {
        td = td.split(/<\/t[dh]\s*>/i)[0].replace(/\s+/g, " ").replace(BR, "\n").replace(/<\/(p|div|li)\s*>/gi, "\n").replace(TAG, "");
        return ent(td, HENT).split("\n").map(function (l) { return l.trim(); }).join("\n").replace(/^\n+|\n+$/g, "");
      });
      if (!row.every(blank)) rows.push(row);
    });
    return pad(rows);
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
  function sheetRows(xml, sst) {
    var rows = [];
    each(xml, "row", function (ra, inner) {
      var row = [], col = -1, i;
      each(inner, "c", function (a, content) {
        var k = a.r ? colIndex(a.r) : -1;
        col = k >= 0 ? k : col + 1;
        if (col < 16384) row[col] = content ? cellValue(a, content, sst) : "";
      });
      for (i = 0; i < row.length; i++) if (row[i] == null) row[i] = "";
      while (row.length && blank(row[row.length - 1])) row.pop();
      if (row.length) rows.push(row);
    });
    return pad(rows);
  }
  function relPath(target) {   // Ziel einer Beziehung (relativ zu xl/ oder absolut) -> Pfad im ZIP
    var out = [];
    (target.charAt(0) === "/" ? target.slice(1) : "xl/" + target).split("/").forEach(function (p) {
      if (p === "..") out.pop(); else if (p && p !== ".") out.push(p);
    });
    return out.join("/");
  }

  // Erstes Tabellenblatt (Reihenfolge in der Arbeitsmappe; ausgeblendete nur, wenn kein anderes da ist)
  function readXlsx(bytes) {
    var zip;
    try { zip = unzip(bytesOf(bytes)); } catch (e) { return Promise.reject(e); }
    return Promise.all([zip.text("xl/workbook.xml"), zip.text("xl/_rels/workbook.xml.rels")]).then(function (r) {
      var rels = {}, sheets = [], ssPath = "xl/sharedStrings.xml", ok, pick, nums;
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
      pick = ok.filter(function (s) { return !s.hidden; })[0] || ok[0];
      if (!pick) {   // ohne verwertbare Arbeitsmappe: xl/worksheets/sheetN.xml mit kleinstem N
        nums = zip.names.map(function (f) { var m = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(f); return m ? +m[1] : -1; })
          .filter(function (k) { return k >= 0; }).sort(function (a, b) { return a - b; });
        if (!nums.length) throw fail("ZIP", "In der Datei wurde keine Excel-Tabelle gefunden.");
        pick = { name: "sheet" + nums[0], path: "xl/worksheets/sheet" + nums[0] + ".xml" };
        if (!sheets.length) sheets = [pick];
      }
      return Promise.all([zip.text(ssPath), zip.text(pick.path)]).then(function (x) {
        var sst = [];
        if (x[0]) each(x[0], "si", function (a, inner) { sst.push(runs(inner)); });
        return { rows: sheetRows(x[1] || "", sst), sheet: pick.name, sheets: sheets.map(function (s) { return s.name; }) };
      });
    });
  }

  // Datei lesen: .xlsx, Text (CSV/TSV) oder HTML-Tabelle; altes .xls -> Fehler "XLS"
  function read(bytes, fileName) {
    return new Promise(function (ok) {
      var u = bytesOf(bytes), text, d;
      if (isXls(u)) throw xlsError(u);
      if (isXlsx(u)) {
        ok(readXlsx(u).then(function (x) { return { rows: x.rows, format: "xlsx", sheet: x.sheet, sheets: x.sheets }; }));
        return;
      }
      text = decode(u);
      if (isHtml(text)) { ok({ rows: htmlRows(text), format: "html" }); return; }
      d = detectDelimiter(text);
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

  // Zellwert -> Code: 1. Zahl mit 3–5 Ziffern, 2. genaue Bezeichnung, 3. längste enthaltene Bezeichnung (eindeutig)
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
      var re = /(^|\D)(\d{3,5})(?!\d)/g, m, v, i, hit = null;
      s = s.trim();
      while ((m = re.exec(s))) if (known[m[2]]) return m[2];
      v = norm(s);
      if (!v) return null;
      if (exact[v] && exact[v] !== "?") return exact[v];
      v = " " + v + " ";
      for (i = 0; i < labels.length && (!hit || labels[i].len === hit.len); i++) {
        if (v.indexOf(labels[i].n) < 0) continue;
        if (hit && hit.code !== labels[i].code) return null;
        hit = labels[i];
      }
      return hit ? hit.code : null;
    }
    return function (value) {
      if (value == null) return null;
      var k = String(value);
      return k in memo ? memo[k] : (memo[k] = find(k));
    };
  }

  var SKIP = /(e-?mail|name|telefon|phone|\btel\b|adresse|address|strasse|plz|\bort\b|kunden-?nr|kundennummer|bestell-?nr|bestellnummer|auftrags-?nr|order|datum|date|zeit|time|\bid\b|nummer|number|status|owner|besitzer|bearbeiter|agent)/i;
  var EXTRA = /(betreff|subject|titel|title|beschreibung|description|nachricht|message|notiz|note|kommentar|comment|anliegen|problem|text)/i;
  var NUMERIC = /^[\d\s.,:\/+-]+$/;

  // Kopfzeile? Welche Spalte enthält den Code, welche den Text?
  function guess(rows, resolve) {
    rows = rows || [];
    var n = rows.length, w = 0, sample = [], stats = [], codeCol = -1, best = 0, header, main = -1, cand = [], i, j, v, s;
    rows.forEach(function (r) { if (r.length > w) w = r.length; });
    for (i = 1; i <= Math.min(n - 1, 300); i++) sample.push(rows[i]);
    if (n === 1) sample.push(rows[0]);
    for (j = 0; j < w; j++) {
      s = { ne: 0, ok: 0, len: 0, num: 0 };
      for (i = 0; i < sample.length; i++) {
        v = cell(sample[i], j).trim();
        if (!v) continue;
        s.ne++; s.len += v.length;
        if (resolve(v)) s.ok++;
        if (NUMERIC.test(v)) s.num++;
      }
      s.frac = s.ne ? s.ok / s.ne : 0; s.avg = s.ne ? s.len / s.ne : 0;
      stats.push(s);
      if (s.frac >= 0.3 && s.frac > best) { best = s.frac; codeCol = j; }
    }
    if (codeCol >= 0) {
      v = cell(rows[0], codeCol).trim();
      header = !!v && !NUMERIC.test(v) && !resolve(v);
    } else {
      header = n > 1 && w > 0;
      for (j = 0; j < w; j++) {
        v = cell(rows[0], j).trim();
        if (!v || v.length > 40 || NUMERIC.test(v)) header = false;
      }
    }
    // Spaltentitel (nur kurze Zellen der Kopfzeile zählen als Titel)
    function title(k) { var t = header ? cell(rows[0], k).trim() : ""; return t.length <= 40 ? t : ""; }
    for (j = 0; j < w; j++) {
      if (j === codeCol || SKIP.test(title(j)) || stats[j].num > stats[j].ne * 0.5) continue;
      cand.push(j);
      if (stats[j].avg >= 8 && (main < 0 || stats[j].avg > stats[main].avg)) main = j;
    }
    return {
      header: header, codeCol: codeCol,
      textCols: main < 0 ? [] : cand.filter(function (k) {
        return k === main || (header && EXTRA.test(title(k)) && stats[k].avg >= 5);
      })
    };
  }

  // Zeilen -> Lernbeispiele. Jede Datenzeile zählt genau einmal: Fall, ohne Code oder ohne Text
  function toCases(rows, cfg, resolve) {
    var out = { cases: [], total: 0, noCode: 0, noText: 0, unknown: [] }, unk = Object.create(null), order = [];
    var cols = cfg.textCols || [], codeCol = cfg.codeCol == null ? -1 : cfg.codeCol, i, j, v, c, t;
    rows = rows || [];
    for (i = cfg.header ? 1 : 0; i < rows.length; i++) {
      out.total++;
      v = codeCol >= 0 ? cell(rows[i], codeCol).trim() : "";
      c = v ? resolve(v) : null;
      if (!c) {
        out.noCode++;
        if (v) { if (!(v in unk)) { unk[v] = 0; order.push(v); } unk[v]++; }
        continue;
      }
      t = [];
      for (j = 0; j < cols.length; j++) { v = cell(rows[i], cols[j]).trim(); if (v) t.push(v); }
      if (!t.length) { out.noText++; continue; }
      out.cases.push({ t: t.join("\n"), c: c, row: i });
    }
    out.unknown = order.map(function (k, idx) { return [k, unk[k], idx]; })
      .sort(function (a, b) { return b[1] - a[1] || a[2] - b[2]; })
      .slice(0, 10).map(function (x) { return [x[0], x[1]]; });
    return out;
  }

  return {
    decode: decode, detectDelimiter: detectDelimiter, parseDelimited: parseDelimited,
    isXlsx: isXlsx, isXls: isXls, readXlsx: readXlsx, read: read,
    norm: norm, codeResolver: codeResolver, guess: guess, toCases: toCases
  };
})();

if (typeof module !== "undefined") module.exports = Table;
