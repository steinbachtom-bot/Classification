/* =====================================================================
   SUCHMASCHINE – vergleicht den Text mit den Stichwörtern
   ---------------------------------------------------------------------
   1. Bereinigung: Anrede, Grussformel/Signatur, zitierte E-Mails,
      Kontaktdaten, Nummern und Höflichkeitsfloskeln werden entfernt
   2. Abkürzungen (ABK) werden ausgeschrieben
   3. Stichwort-Regeln: Begriffe einer Regel müssen im selben oder im
      nächsten Satz stehen; Sätze, die ein Problem beschreiben, zählen mehr
   4. Gelernte Fälle: ähnliche, früher klassifizierte Texte schlagen
      ihren Code vor
   5. Höchstens 3 Vorschläge, bei mehreren Problemen möglichst verschiedene
   ===================================================================== */
var Engine = (function () {
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  function set(str) { var o = {}; str.split(/\s+/).forEach(function (w) { if (w) o[w] = 1; }); return o; }

  // Allgemeine Wörter aus Bezeichnungen, die nichts unterscheiden
  var STOP = set("herstellung produkt softwarefehler maschinenfehler mech beschaedigung auftrag fehler sonstige sonstiges " +
    "bearbeitung unvollst bildqualitaet kunde kunden nicht falsche falscher falsches falschen erhalten sich eine seite " +
    "seiten bild bilder texte produkte zahlung bestellung kann werden ohne beim nach sind wird mail email frei best price");

  // Füllwörter (zählen nicht für die Abdeckung mehrerer Probleme)
  var FILL = set("nicht sich noch immer aber auch habe hat ist sind wird wurde wurden eine einen einem einer der die das den " +
    "dem des und oder mit von vom zu zum zur im am an auf bei kam kann ich er sie es wir was wie wo wann schon mehr keine kein " +
    "sehr ein nur fuer ueber aus nach vor bis mein meine sein seine ihr ihre kunde kundin laut dass");

  // Wörter, die für die Ähnlichkeit mit gelernten Fällen nicht zählen
  var SIMSTOP = set(Object.keys(FILL).join(" ") + " mich mir meinen meinem meiner ihnen ihren ihrem unser unsere uns euch " +
    "haben hatte haette hatten bin war waren werden worden koennen koennte koennten moechte moechten wuerde wuerden soll sollte " +
    "muss musste bitte danke heute gestern morgen jetzt nun bereits leider ganz dann wenn weil doch mal so da hier dort dies diese " +
    "dieser dieses man warum wieso einfach gerne gern etwas alles alle viel viele wieder erst letzte letzten neue neuen geht gibt " +
    // Wörter, die in fast jedem Fall vorkommen und darum nichts unterscheiden
    "kunde kundin kd fotobuch fotobuecher buch buecher paket pakete bestellung bestellungen bestellt bestellen bestelle " +
    "auftrag auftraege will wollen wollte fragt frage fragen wissen ruft anruf angerufen schreibt geschrieben wegen " +
    "betreff ifolor tag tage woche wochen monat ihnen ihrer ihres " +
    "bekommen bekommt bekam erhalten erhalt erhielt gekriegt gehen machen macht gemacht sagen sagt gesagt sehen sieht " +
    "gesehen kommen kommt gekommen geben gegeben nehmen nimmt stellen stellt finden findet gefunden brauchen braucht brauche " +
    "benoetigt benoetige senden gesendet schicken geschickt schickt");

  // Wörter, die zeigen, dass ein Satz das eigentliche Anliegen beschreibt
  var SIGNAL = set("leider aber jedoch trotzdem obwohl problem probleme reklamation reklamieren beanstandung fehler fehlerhaft " +
    "defekt kaputt beschaedigt falsch falsche falschen fehlt fehlen nicht kein keine keinen nichts nie enttaeuscht unzufrieden " +
    "aergerlich schade bitte moechte moechten wuerde wollte brauche benoetige frage wie wann wo warum wieso weshalb kann koennen " +
    "koennten ersatz storno stornieren gutschein rechnung mahnung");

  // Wortgruppen mit diesen Wörtern dürfen in beliebiger Reihenfolge stehen
  var FREE_ORDER = set("nicht kein keine keinen keiner nie nichts sich");

  var WIN = 15;          // max. Wortabstand zwischen Begriffen einer Regel
  var MAX_RESULTS = 3;   // Anzahl Vorschläge
  var EX_WEIGHT = 40;    // Gewicht gelernter Fälle (bei Ähnlichkeit 100 %)
  var EX_MIN = 0.2;      // darunter zählt ein gelernter Fall nicht

  function modeFor(w, mod) {
    if (mod === "=") return "x";          // exaktes Wort
    if (mod === "^") return "p";          // Wortanfang
    if (w.length <= 3) return "x";
    if (w.length === 4) return "p";
    return "c";                           // irgendwo im Wort (Komposita)
  }

  function compileLiteral(raw) {
    raw = raw.trim();
    var mod = "";
    if (raw[0] === "=" || raw[0] === "^") { mod = raw[0]; raw = raw.slice(1); }
    var words = norm(raw.replace(/_/g, " ")).split(" ").filter(Boolean);
    if (!words.length) return null;
    return { key: mod + words.join(" "), parts: words.map(function (w) { return { w: w, m: modeFor(w, mod) }; }) };
  }

  var groups = {}, classes = [], byCode = {}, idf = {}, errors = [], abk = [], nLit = 0, nPart = 0;

  function build(SYN, TEXT, ALT, ABK, BASE) {
    groups = {}; classes = []; byCode = {}; idf = {}; errors = []; abk = [];
    Object.keys(SYN).forEach(function (g) { groups[g] = SYN[g].split(",").map(compileLiteral).filter(Boolean); });

    function parseTerm(t) {
      var matchers = [];
      t.split("|").forEach(function (alt) {
        if (!alt) return;
        if (alt[0] === "@") {
          var g = groups[alt.slice(1)];
          if (!g) { errors.push("Unbekannte Gruppe: " + alt); return; }
          matchers = matchers.concat(g);
        } else {
          var l = compileLiteral(alt);
          if (l) matchers.push(l);
        }
      });
      return { key: t, matchers: matchers };
    }
    function parseRule(r) {
      var factor = 1, pos = [], neg = [];
      r.split(/\s+/).forEach(function (tok) {
        if (!tok) return;
        if (/^\*[\d.]+$/.test(tok)) { factor = parseFloat(tok.slice(1)) || 1; return; }
        if (tok[0] === "!") { neg.push(parseTerm(tok.slice(1))); return; }
        pos.push(parseTerm(tok));
      });
      return { terms: pos, neg: neg, factor: factor, src: r };
    }

    var bereich = "", gruppe = "";
    TEXT.split("\n").forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (line.indexOf("## ") === 0) { gruppe = line.slice(3).trim(); return; }
      if (line.indexOf("# ") === 0) { bereich = line.slice(2).trim(); gruppe = ""; return; }
      var f = line.split("::");
      if (f.length < 2) { errors.push("Zeile unlesbar: " + line); return; }
      var code = f[0].trim(), label = f[1].trim(), rulesTxt = (f[2] || "").trim();
      var alt = (ALT && ALT[code]) || "";
      var rules = rulesTxt.split(";").map(function (r) { return r.trim(); }).filter(Boolean).map(parseRule)
        .filter(function (r) { return r.terms.length; });
      var seen = {};
      norm(label + " " + alt).split(" ").forEach(function (w) {
        if (w.length < 4 || STOP[w] || seen[w] || /^\d+$/.test(w)) return;
        seen[w] = 1;
        rules.push({ terms: [{ key: "lbl:" + w, matchers: [{ key: w, parts: [{ w: w, m: w.length >= 6 ? "c" : w.length === 5 ? "p" : "x" }] }] }], neg: [], factor: 0.6, label: true });
      });
      var c = { code: code, label: label, alt: alt, bereich: bereich, gruppe: gruppe, rules: rules,
        search: norm(code + " " + label + " " + alt + " " + gruppe + " " + bereich) };
      classes.push(c); byCode[code] = c;
    });

    var df = {};
    classes.forEach(function (c) {
      var keys = {};
      c.rules.forEach(function (r) { r.terms.forEach(function (t) { keys[t.key] = 1; }); });
      Object.keys(keys).forEach(function (k) { df[k] = (df[k] || 0) + 1; });
    });
    var N = classes.length;
    Object.keys(df).forEach(function (k) { idf[k] = Math.log(1 + N / df[k]); });

    // Literale und Wortteile durchnummerieren (Zwischenspeicher je Text als Array)
    var litIds = Object.create(null), partIds = Object.create(null);
    nLit = 0; nPart = 0;
    classes.forEach(function (c) { c.rules.forEach(function (r) { r.terms.concat(r.neg).forEach(function (t) {
      t.matchers.forEach(function (l) {
        l.id = litIds[l.key] !== undefined ? litIds[l.key] : (litIds[l.key] = nLit++);
        l.parts.forEach(function (p) {
          var k = p.m + ":" + p.w;
          p.id = partIds[k] !== undefined ? partIds[k] : (partIds[k] = nPart++);
        });
      });
    }); }); });

    // Abkürzungen: nur Grossbuchstaben = Gross-/Kleinschreibung beachten
    if (ABK) Object.keys(ABK).sort(function (a, b) { return b.length - a.length; }).forEach(function (k) {
      var cs = !/[a-zäöüß]/.test(k);
      var esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      abk.push({ re: new RegExp("(^|[^\\p{L}\\p{N}])" + esc + "(?![\\p{L}\\p{N}:])", cs ? "gu" : "giu"), to: ABK[k] });
    });

    featCache = Object.create(null);
    baseExamples = (BASE || []).filter(validEx);
    setExamples(learnedExamples);
    return { classes: classes, errors: errors };
  }

  // ------------------------------------------------------------------
  // 1. Bereinigung
  // ------------------------------------------------------------------
  var HEAD = /^\s*(von|from|de|gesendet|sent|envoy[ée]|datum|date|an|to|à|cc|bcc|betreff|subject|objet)\s*:(.*)$/i;
  var FIELD = /^\s*(name|vorname|nachname|e-?mail|telefon|tel\.?|mobile?|handy|natel|adresse|strasse|straße|plz|ort|plz\s*\/\s*ort|land|kundennummer|kunden-?nr\.?|bestellnummer|bestell-?nr\.?|auftragsnummer|auftrags-?nr\.?|firma|unternehmen)\s*:/i;
  var CLOSE_LINE = /^\s*(?:(?:mit\s+)?(?:freundliche[nrm]?|beste[n]?|liebe[n]?|herzliche[n]?|viele[n]?|sch(?:ö|oe)ne[n]?|sonnige[n]?|nette[n]?)\s+gr(?:ü|ue|u)(?:ss|ß)(?:e|en)?|gr(?:ü|ue|u)(?:ss|ß)(?:e|en|li)?|mfg|lg|vg|bg|beste\s+w(?:ü|ue)nsche|cordialement|meilleures\s+salutations|salutations|bien\s+(?:à|a)\s+vous|best\s+regards|kind\s+regards|regards)(?![\p{L}])/iu;
  var THANKS_LINE = /^\s*(?:(?:vielen|herzlichen|besten|tausend)\s+dank|danke(?:\s+(?:sch(?:ö|oe)n|vielmals|im\s+voraus|und\s+gr(?:ü|ue|u)(?:ss|ß)e?))?|merci(?:\s+beaucoup)?)\s*[!.,]*\s*$/i;
  var GREET = /^\s*(?:guten\s+(?:tag|morgen|abend|nachmittag)|gr(?:ü|ue|u)e?zi(?:\s+mit(?:e|ei)nand)?|hallo|hoi|hey|sal(?:ü|u)|servus|moin|sehr\s+geehrte[rsn]?|geehrte[rsn]?|liebe[rsn]?|gesch(?:ä|ae)tzte[rsn]?|bonjour|bonsoir)(?![\p{L}])(?:\s+(?:zusammen|miteinander|mitenand|damen|und|herren|frau|herr|liebes?|ifolor|ifolor-team|team|kundenservice|kundendienst|service|support)(?![\p{L}-])){0,5}/iu;
  var INLINE_CLOSE = /(?:^|[\s.!?,;])((?:mit\s+)?(?:freundliche[nrm]?|beste[n]?|liebe[n]?|herzliche[n]?|viele[n]?)\s+gr(?:ü|ue|u)(?:ss|ß)(?:e|en)?|(?:danke\s+und\s+)?gr(?:ü|ue|u)(?:ss|ß)e?|mfg)(?![\p{L}])[\s\S]{0,160}$/iu;
  var INLINE_THANKS = /(?:^|[.!?]\s*)((?:vielen|besten|herzlichen)\s+dank|danke(?:\s+(?:sch(?:ö|oe)n|vielmals))?|merci)\s*[.!]?[^.!?]{0,40}$/i;
  var POLITE = [
    /(?:vielen|herzlichen|besten|tausend)\s+dank(?:\s+(?:im\s+voraus|schon\s+(?:mal|jetzt|im\s+voraus)|f(?:ü|ue)r\s+(?:ihre|eure|deine|die|eine)\s+(?:\S+\s+)?(?:hilfe|antwort|r(?:ü|ue)ckmeldung|bem(?:ü|ue)hungen|unterst(?:ü|ue)tzung|m(?:ü|ue)he|geduld|verst(?:ä|ae)ndnis|info|information|nachricht|kenntnisnahme)))?\s*[!.,]?/gi,
    /(?:^|\s)danke(?:\s+(?:sch(?:ö|oe)n|vielmals|sehr|im\s+voraus|schon\s+mal|f(?:ü|ue)r\s+(?:ihre|eure|die)\s+(?:\S+\s+)?(?:hilfe|antwort|r(?:ü|ue)ckmeldung|info|information)))?(?=[\s!.,]|$)[!.,]?/gi,
    /ich\s+(?:freue\s+mich|danke\s+ihnen)\s+(?:auf|f(?:ü|ue)r)\s+(?:ihre|eine)\s+(?:\S+\s+)?(?:antwort|r(?:ü|ue)ckmeldung|hilfe|nachricht)\s*[.!]?/gi,
    /f(?:ü|ue)r\s+(?:eine|ihre)\s+(?:\S+\s+)?(?:antwort|r(?:ü|ue)ckmeldung|info|information|l(?:ö|oe)sung|hilfe)\s+(?:w(?:ä|ae)re|bin)\s+ich\s+(?:ihnen\s+)?(?:sehr\s+)?dankbar\s*[.!]?/gi,
    /(?:k(?:ö|oe)nnen|k(?:ö|oe)nnten|w(?:ü|ue)rden)\s+sie\s+mir\s+(?:bitte\s+)?(?:da\s+)?(?:helfen|weiterhelfen)\s*\??/gi,
    /ich\s+hoffe[^.!?\n]{0,40}(?:helfen|weiterhelfen|l(?:ö|oe)sung|antwort|r(?:ü|ue)ckmeldung)[^.!?\n]{0,10}[.!?]?/gi,
    /(?:ich\s+)?bitte\s+(?:sie\s+)?um\s+(?:eine\s+)?(?:kurze\s+|rasche\s+|baldige\s+)?(?:r(?:ü|ue)ckmeldung|antwort|info|information|kenntnisnahme)\s*[.!]?/gi,
    /was\s+(?:k(?:ö|oe)nnen|kann)\s+(?:sie|man|ich)\s+(?:da\s+|nun\s+|jetzt\s+)?(?:machen|tun)\s*\??/gi,
    /wie\s+(?:gehen\s+wir|geht\s+es)\s+(?:jetzt\s+|nun\s+)?weiter(?:\s+vor)?\s*\??/gi
  ];

  function words(s) { return (String(s).match(/[\p{L}\p{N}]+/gu) || []).length; }

  function clean(raw) {
    var removed = {}, t = String(raw || "").replace(/\r\n?/g, "\n");
    var lines = t.split("\n"), out = [], bodyW = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*>/.test(line)) { removed["zitierte E-Mails"] = 1; continue; }
      var h = HEAD.exec(line);
      if (h) {
        var key = h[1].toLowerCase();
        if (bodyW >= 6 && (key === "von" || key === "from" || key === "de" || key === "gesendet" || key === "sent")) { removed["zitierte E-Mails"] = 1; break; }
        if ((key === "betreff" || key === "subject" || key === "objet") && bodyW < 6) {
          out.push(h[2].replace(/^\s*(?:(?:aw|re|wg|fw|fwd|tr)\s*:\s*)+/i, ""));
        }
        removed["E-Mail-Kopf"] = 1; continue;
      }
      if (bodyW >= 6 && (/^\s*(?:-{2,}|_{4,}).*(?:original|urspr(?:ü|ue)ngliche|weitergeleitet|forwarded|message|nachricht)/i.test(line) ||
          /^\s*(?:am|on|le)\s.{3,140}(?:schrieb|wrote|a\s+écrit)/i.test(line))) { removed["zitierte E-Mails"] = 1; break; }
      if (FIELD.test(line)) { removed["Kontaktdaten"] = 1; continue; }
      out.push(line);
      bodyW += words(line);
    }
    // Grussformel und Signatur (ab der Grusszeile alles weg)
    var w = 0;
    for (i = 0; i < out.length; i++) {
      if (w >= 3 && (CLOSE_LINE.test(out[i]) || THANKS_LINE.test(out[i]))) {
        out = out.slice(0, i); removed["Grussformel/Signatur"] = 1; break;
      }
      w += words(out[i]);
    }
    t = out.join("\n");
    // Anrede am Anfang
    var g = GREET.exec(t);
    if (g && g[0].trim()) {
      var rest = t.slice(g[0].length);
      var name = /^[ \t]+[A-ZÄÖÜ][\p{L}'-]*\.?(?:[ \t]+[A-ZÄÖÜ][\p{L}'-]+)?(?=[ \t]*[,\n!:])/u.exec(rest);
      if (name) rest = rest.slice(name[0].length);
      t = rest.replace(/^\s*[,!.:;-]*/, "");
      removed["Anrede"] = 1;
    }
    // Grussformel im Fliesstext am Ende
    var m = INLINE_CLOSE.exec(t);
    if (m && m.index > 15) { t = t.slice(0, m.index + (m[0].length - m[0].replace(/^[\s.!?,;]/, "").length)); removed["Grussformel/Signatur"] = 1; }
    m = INLINE_THANKS.exec(t);
    if (m && m.index > 15) { t = t.slice(0, m.index + 1); removed["Grussformel/Signatur"] = 1; }
    // Höflichkeitsfloskeln
    POLITE.forEach(function (re) {
      re.lastIndex = 0;
      if (re.test(t)) { re.lastIndex = 0; t = t.replace(re, " "); removed["Höflichkeitsfloskeln"] = 1; }
    });
    // Kontaktdaten und Nummern
    function strip(re, what) { var n = t.replace(re, " "); if (n !== t) { removed[what] = 1; t = n; } }
    strip(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "E-Mail-Adressen");
    strip(/(?:https?:\/\/|www\.)\S+/gi, "Links");
    strip(/(?:\+|00)\s?\d{2}[\d\s\/.-]{7,}\d/g, "Telefonnummern");
    strip(/(^|\s)0\d{2}[\s\/.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?=\s|$|[.,;])/g, "Telefonnummern");
    strip(/(^|\s)\d{1,2}\.\s?\d{1,2}\.(?:\s?\d{2,4})?/g, "Daten/Nummern");
    strip(/(^|\s)\d{1,2}\.?\s+(?:januar|jänner|februar|m(?:ä|ae)rz|april|mai|juni|juli|august|september|oktober|november|dezember)(?:\s+\d{4})?(?![\p{L}])/giu, "Daten/Nummern");
    strip(/\d[\d.\-\/]{6,}\d/g, "Daten/Nummern");
    strip(/(^|\s)\d{5,}(?=\s|$|[.,;:)])/g, "Daten/Nummern");
    strip(/(^|\s)\d{4}\s+[A-ZÄÖÜ][\p{L}-]+/gu, "Adressen");
    strip(/(^|\s)[\p{L}-]*(?:strasse|straße|weg|gasse|platz|allee)\s+\d+[a-z]?(?=\s|$|[.,;])/giu, "Adressen");
    t = t.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
    return { text: t, removed: Object.keys(removed) };
  }

  function expand(t) {
    var used = [];
    abk.forEach(function (a) {
      a.re.lastIndex = 0;
      t = t.replace(a.re, function (m0, pre) { used.push(m0.slice(pre.length)); return pre + a.to; });
    });
    return { text: t, used: used };
  }

  function prepare(raw) {
    var c = clean(raw), e = expand(c.text);
    return { text: e.text, cleaned: c.text, removed: c.removed, abbreviations: e.used };
  }

  // ------------------------------------------------------------------
  // Zerlegung in Wörter und Sätze
  // ------------------------------------------------------------------
  function tokenize(text) {
    var out = [], seg = 0, segQ = {};
    var re = /[\p{L}\p{N}]+|[.!?;:\n]+/gu, m;
    while ((m = re.exec(String(text)))) {
      var t = m[0];
      if (/^[.!?;:\n]+$/.test(t)) {
        var prev = out.length ? out[out.length - 1] : null;
        if (t === "." && prev && prev.seg === seg && (prev.orig.length <= 3 || /^\d+$/.test(prev.orig))) continue;
        if (t === ":" ) { continue; }
        if (t.indexOf("?") !== -1) segQ[seg] = 1;
        if (prev && prev.seg === seg) seg++;
        continue;
      }
      norm(t).split(" ").forEach(function (w) { if (w) out.push({ orig: t, w: w, seg: seg }); });
    }
    // Gewicht je Satz
    var segW = {};
    out.forEach(function (tk) { if (SIGNAL[tk.w] || segQ[tk.seg]) segW[tk.seg] = 1; });
    out.forEach(function (tk) { tk.sw = segW[tk.seg] ? 1 : 0.6; });
    var anySignal = Object.keys(segW).length > 0;
    if (!anySignal) out.forEach(function (tk) { tk.sw = 1; });
    return out;
  }

  // ------------------------------------------------------------------
  // Gelernte Fälle
  // ------------------------------------------------------------------
  var baseExamples = [], learnedExamples = [], featCache = Object.create(null);
  var LIVE = { agg: "max", w: EX_WEIGHT };   // Einstellung im Tool
  var TOP3 = [1, 0.5, 0.25];                 // Gewichte bei agg "top3"
  var liveIndex = makeIndex([]);
  var SUF = ["ungen", "ung", "en", "er", "es", "em", "e", "n", "s", "t"];
  function stem(w) {
    for (var i = 0; i < SUF.length; i++) {
      var s = SUF[i];
      if (w.length - s.length >= 4 && w.slice(-s.length) === s) { w = w.slice(0, -s.length); break; }
    }
    return w.slice(0, 8);
  }
  function simToks(toks) {
    var o = {};
    toks.forEach(function (t, i) {
      if (t.w.length < 3 || SIMSTOP[t.w] || /^\d+$/.test(t.w)) return;
      var s = stem(t.w);
      if (SIMSTOP[s]) return;
      var keys = ["w:" + s];
      if (t.w.length >= 6) keys.push("p:" + t.w.slice(0, 6));
      keys.forEach(function (k) { (o[k] = o[k] || []).push(i); });
    });
    return o;
  }
  function hasCode(c) { return Object.prototype.hasOwnProperty.call(byCode, c); }
  function validEx(e) { return e && e.t && hasCode(e.c); }

  // Index über Beispiele: Stämme, IDF, Norm und Postings (Stamm -> Beispiele),
  // damit nur Beispiele mit gemeinsamen Stämmen verglichen werden.
  // items: [{t, c, base, st?, ...}] – ohne st werden die Stämme aus t berechnet
  function makeIndex(items) {
    var ix = { items: [], df: {}, idf: {}, N: 0, post: {} };
    (items || []).forEach(function (e) {
      var st = e.st || featCache[e.t] || (featCache[e.t] = Object.keys(simToks(tokenize(prepare(e.t).text))));
      if (!st.length) return;
      var it = {}, n = ix.items.length, k;
      for (k in e) if (Object.prototype.hasOwnProperty.call(e, k)) it[k] = e[k];
      it.st = st;
      ix.items.push(it);
      st.forEach(function (s) { ix.df[s] = (ix.df[s] || 0) + 1; (ix.post[s] || (ix.post[s] = [])).push(n); });
    });
    var N = ix.N = ix.items.length;
    Object.keys(ix.df).forEach(function (s) { ix.idf[s] = Math.log(1 + (N + 1) / (ix.df[s] + 0.5)); });
    ix.items.forEach(function (e) {
      var n = 0; e.st.forEach(function (s) { var v = ix.idf[s]; n += v * v; }); e.norm = Math.sqrt(n);
    });
    return ix;
  }
  function idfOf(ix, s) { var v = ix.idf[s]; return v !== undefined ? v : Math.log(1 + (ix.N + 1) / 0.5); }

  function setExamples(learned) {
    learnedExamples = (learned || []).filter(validEx);
    liveIndex = makeIndex(baseExamples.map(function (e) { return { t: e.t, c: e.c, base: true }; })
      .concat(learnedExamples.map(function (e) { return { t: e.t, c: e.c, base: false }; })));
    return liveIndex.N;
  }

  // Stämme des Suchtextes (Stamm -> Wortpositionen), einmal je Analyse
  function queryStems(a) { return a.qs || (a.qs = simToks(a.toks)); }

  // Ähnliche Beispiele (Kosinus über IDF-gewichtete Stämme). Nur Beispiele über
  // EX_MIN und mit mindestens 2 gemeinsamen Wörtern (oder Ähnlichkeit ab 0.6).
  // opts.exclude(item) -> true: Beispiel überspringen. Ergebnis: [{e, sim, common}]
  function similar(a, ix, opts) {
    var out = [];
    if (!ix || !ix.N) return out;
    var qs = queryStems(a), qn = 0, cand = [], seen = {}, excl = opts && opts.exclude;
    Object.keys(qs).forEach(function (s) {
      var v = idfOf(ix, s), p = ix.post[s], j;
      qn += v * v;
      if (p) for (j = 0; j < p.length; j++) if (!seen[p[j]]) { seen[p[j]] = 1; cand.push(p[j]); }
    });
    qn = Math.sqrt(qn);
    if (!qn) return out;
    cand.sort(function (x, y) { return x - y; });   // Reihenfolge des Index (bei Gleichstand gewinnt das erste)
    cand.forEach(function (n) {
      var e = ix.items[n];
      if (excl && excl(e)) return;
      var dot = 0, common = [], words = {}, nw = 0;
      e.st.forEach(function (s) {
        if (!qs[s]) return;
        var v = ix.idf[s]; dot += v * v; common.push(s);
        qs[s].forEach(function (p) { if (!words[p]) { words[p] = 1; nw++; } });
      });
      if (!dot) return;
      var sim = dot / (qn * e.norm);
      if (nw < 2 && sim < 0.6) return;   // ein einziges gemeinsames Wort reicht meist nicht
      if (sim > EX_MIN) out.push({ e: e, sim: sim, common: common });
    });
    return out;
  }

  // Bonus der ähnlichen Beispiele je Code. v.agg "max": bestes Beispiel zählt;
  // "top3": bis zu 3 beste Beispiele, gewichtet 1 : 0.5 : 0.25. v.w = Gewicht
  function applyLearned(res, a, sims, v) {
    if (!sims.length) return res;
    var qs = queryStems(a), per = {};
    sims.forEach(function (x) { (per[x.e.c] || (per[x.e.c] = [])).push(x); });
    Object.keys(per).forEach(function (code) {
      var list = per[code], used, bonus, b, i;
      if (v.agg === "top3") {
        used = list.slice().sort(function (x, y) { return y.sim - x.sim; }).slice(0, 3);
        bonus = 0;
        for (i = 0; i < used.length; i++) bonus += TOP3[i] * ((used[i].sim - EX_MIN) / (1 - EX_MIN));
        bonus = v.w * bonus / 1.75;
      } else {
        b = list[0];
        for (i = 1; i < list.length; i++) if (list[i].sim > b.sim) b = list[i];
        used = [b];
        bonus = v.w * (b.sim - EX_MIN) / (1 - EX_MIN);
      }
      b = used[0];
      var r = res.byC[code];
      if (!r) { r = { c: byCode[code], score: 0, pos: {}, byCode: false }; res.results.push(r); res.byC[code] = r; }
      r.score += bonus;
      r.learned = { sim: b.sim, text: b.e.t, base: b.e.base };
      used.forEach(function (x) { x.common.forEach(function (s) { qs[s].forEach(function (p) { r.pos[p] = 1; }); }); });
    });
    return res;
  }

  // ------------------------------------------------------------------
  // Klassifizieren
  // ------------------------------------------------------------------
  // Text bereinigen und in Wörter/Sätze zerlegen
  function analyze(raw) {
    var prep = prepare(raw), toks = tokenize(prep.text);
    var words = toks.map(function (t) { return t.w; });
    return { prep: prep, toks: toks, words: words, rawWords: norm(raw).split(" ").filter(Boolean),
      longText: words.filter(function (w) { return !FILL[w]; }).length > 20 };
  }

  // Stichwort-Regeln je Klassifizierung (unsortiert, ohne gelernte Fälle).
  // Ergebnis: {results: [{c, score, pos, byCode, hits}], byC: Code -> Ergebnis}
  function scoreRules(a, opts) {
    opts = opts || {};
    var toks = a.toks, words = a.words, rawWords = a.rawWords, longText = a.longText;
    var partCache = new Array(nPart), litCache = new Array(nLit);   // je Literal-Schlüssel bzw. Modus+Wort
    var SEP = "\u0001", joined = SEP + words.join(SEP) + SEP;   // für den Schnelltest in partPos

    function partPos(p) {
      if (partCache[p.id]) return partCache[p.id];
      var pos = [], i, w;
      // Schnelltest: kommt das Wort(-stück) überhaupt vor?
      if (joined.indexOf(p.m === "x" ? SEP + p.w + SEP : p.m === "p" ? SEP + p.w : p.w) !== -1) {
        for (i = 0; i < words.length; i++) {
          w = words[i];
          if (p.m === "x" ? w === p.w : p.m === "p" ? w.indexOf(p.w) === 0 : w.indexOf(p.w) !== -1) pos.push(i);
        }
      }
      var fuzzy = false;
      if (!pos.length && p.m !== "x" && p.w.length >= 8 && joined.indexOf(SEP + p.w.slice(0, 2)) !== -1) {   // Tippfehler tolerieren (nur lange Wörter)
        var L = p.w.length;
        for (i = 0; i < words.length; i++) {
          w = words[i];
          if (w.slice(0, 2) !== p.w.slice(0, 2) || w.length < L - 1) continue;
          if (lev(w.slice(0, L), p.w) <= 1 || lev(w.slice(0, L + 1), p.w) <= 1 || lev(w.slice(0, L - 1), p.w) <= 1) pos.push(i);
        }
        fuzzy = pos.length > 0;
      }
      return (partCache[p.id] = { pos: pos, fuzzy: fuzzy });
    }

    function litMatch(lit) {
      if (litCache[lit.id] !== undefined) return litCache[lit.id];
      var res = null;
      if (lit.parts.length === 1) {
        var r = partPos(lit.parts[0]);
        if (r.pos.length) res = { pos: r.pos, fuzzy: r.fuzzy };
      } else {
        var lists = lit.parts.map(partPos), win = lit.parts.length + 1, ok = true, all = [];
        for (var a = 0; a < lists.length; a++) if (!lists[a].pos.length) ok = false;
        var free = lit.parts.some(function (p) { return FREE_ORDER[p.w]; });
        if (ok && !free) {
          // Reihenfolge wie geschrieben, höchstens 2 Wörter dazwischen
          for (var s0 = 0; s0 < lists[0].pos.length; s0++) {
            var cur = lists[0].pos[s0], ch = [cur], good0 = true;
            for (var j0 = 1; j0 < lists.length && good0; j0++) {
              var nx = -1;
              for (var q0 = 0; q0 < lists[j0].pos.length; q0++) {
                var pp = lists[j0].pos[q0];
                if (pp > cur && pp - cur <= 3 && toks[pp].seg === toks[cur].seg) { nx = pp; break; }
              }
              if (nx < 0) good0 = false; else { ch.push(nx); cur = nx; }
            }
            if (good0) all = all.concat(ch);
          }
          if (all.length) res = { pos: all, fuzzy: lists.some(function (l) { return l.fuzzy; }) };
        } else if (ok) {
          for (var i = 0; i < lists[0].pos.length; i++) {
            var p0 = lists[0].pos[i], chosen = [p0], good = true;
            for (var j = 1; j < lists.length && good; j++) {
              var found = -1;
              for (var q = 0; q < lists[j].pos.length; q++) {
                var pq = lists[j].pos[q];
                if (Math.abs(pq - p0) <= win && toks[pq].seg === toks[p0].seg && chosen.indexOf(pq) === -1) { found = pq; break; }
              }
              if (found < 0) good = false; else chosen.push(found);
            }
            if (good) all = all.concat(chosen);
          }
          if (all.length) res = { pos: all, fuzzy: lists.some(function (l) { return l.fuzzy; }) };
        }
      }
      return (litCache[lit.id] = res);
    }

    function termMatch(t) {
      var pos = [], exactPos = [], hit = false;
      for (var i = 0; i < t.matchers.length; i++) {
        var r = litMatch(t.matchers[i]);
        if (r) { hit = true; pos = pos.concat(r.pos); if (!r.fuzzy) exactPos = exactPos.concat(r.pos); }
      }
      if (!hit) return null;
      return { pos: exactPos.length ? exactPos : pos, fuzzy: !exactPos.length };
    }

    // Regel: alle Begriffe im selben Satz (oder im Nachbarsatz, schwächer)
    function ruleMatch(r) {
      var ms = [], i, j;
      for (i = 0; i < r.terms.length; i++) {
        var mm = termMatch(r.terms[i]);
        if (!mm) return null;
        ms.push(mm);
      }
      var negs = r.neg.map(termMatch);
      var ai = 0;
      for (i = 1; i < ms.length; i++) if (ms[i].pos.length < ms[ai].pos.length) ai = i;
      var best = null;
      for (var pass = 0; pass < 2 && !best; pass++) {
        for (var k = 0; k < ms[ai].pos.length; k++) {
          var a = ms[ai].pos[k], sa = toks[a].seg, got = [a], segs = {}, ok = true, sw = toks[a].sw;
          segs[sa] = 1;
          for (i = 0; i < ms.length && ok; i++) {
            if (i === ai) continue;
            var near = ms[i].pos.filter(function (p) {
              var d = Math.abs(toks[p].seg - sa);
              return (pass === 0 ? d === 0 : d <= 1) && Math.abs(p - a) <= WIN;
            });
            if (!near.length) ok = false;
            else { got = got.concat(near); near.forEach(function (p) { segs[toks[p].seg] = 1; sw = Math.max(sw, toks[p].sw); }); }
          }
          if (!ok) continue;
          for (j = 0; j < negs.length && ok; j++) {
            if (negs[j] && negs[j].pos.some(function (p) { return segs[toks[p].seg]; })) ok = false;
          }
          if (!ok) continue;
          var cand = { pos: got, fuzzy: ms.some(function (x) { return x.fuzzy; }), f: (pass === 0 ? 1 : 0.75) * sw };
          if (!best || cand.f > best.f) best = cand;
        }
      }
      return best;
    }

    var results = [], byC = {};
    classes.forEach(function (c) {
      var hits = [];
      c.rules.forEach(function (r) {
        var m = ruleMatch(r);
        if (!m) return;
        var tot = 0;
        r.terms.forEach(function (t) { tot += idf[t.key] || 1; });
        var fac = r.factor * (r.label && longText ? 0.5 : 1);
        var w = tot * fac * m.f * (m.fuzzy ? 0.75 : 1) * (r.terms.length > 1 ? 1.15 : 1);
        hits.push({ w: w, pos: m.pos, src: r.src || (r.terms[0] && r.terms[0].key) });
      });
      if (rawWords.length <= 3 && rawWords.indexOf(norm(c.code)) !== -1) hits.push({ w: 100, pos: [], code: true });
      if (!hits.length) return;
      hits.sort(function (a, b) { return b.w - a.w; });
      var score = hits[0].w, allPos = {};
      for (var k = 1; k < hits.length; k++) score += 0.35 * hits[k].w;
      hits.forEach(function (h) { h.pos.forEach(function (p) { allPos[p] = 1; }); });
      var r = { c: c, score: score, pos: allPos, byCode: !!hits[0].code, hits: opts.debug ? hits : undefined };
      results.push(r); byC[c.code] = r;
    });
    return { results: results, byC: byC };
  }

  // Auswahl: sortieren, Schwellen (minAbs, rel), höchstens max Vorschläge,
  // bei mehreren Problemen möglichst verschiedene
  function finish(res, a, opts) {
    opts = opts || {};
    var results = res.results, toks = a.toks;
    function posList(r) { return Object.keys(r.pos).map(Number).sort(function (a, b) { return a - b; }); }
    results.forEach(function (r) {
      r.content = posList(r).filter(function (p) { return !FILL[toks[p].w]; });
    });

    results.sort(function (a, b) {
      return b.score - a.score || b.content.length - a.content.length || a.c.code.localeCompare(b.c.code);
    });
    if (!results.length) return [];

    var top = results[0].score;
    var minAbs = opts.minAbs || 2.5, rel = opts.rel || 0.35, max = opts.max || MAX_RESULTS;
    var pool = results.filter(function (r) { return r.score >= minAbs && r.score >= top * rel; });

    var picked = [], covered = {}, groupsUsed = {};
    while (picked.length < max && pool.length) {
      var bestI = -1, bestV = -1;
      for (var i = 0; i < pool.length; i++) {
        var r = pool[i], v = r.score;
        if (picked.length) {
          var n = r.content.length || 1, fresh = r.content.filter(function (p) { return !covered[p]; }).length;
          v = v * (0.55 + 0.45 * (fresh / n));
          if (groupsUsed[r.c.bereich + r.c.gruppe]) v *= 0.92;
        }
        if (v > bestV) { bestV = v; bestI = i; }
      }
      var pick = pool.splice(bestI, 1)[0];
      pick.content.forEach(function (p) { covered[p] = 1; });
      groupsUsed[pick.c.bereich + pick.c.gruppe] = 1;
      picked.push(pick);
    }
    return picked.map(function (r) {
      // erkannte Wörter (nur für die Vorschläge)
      var matched = [], seenW = {};
      posList(r).forEach(function (p) {
        var o = toks[p].orig;
        if (!seenW[o.toLowerCase()]) { seenW[o.toLowerCase()] = 1; matched.push(o); }
      });
      var shown = matched.filter(function (o) { return !FILL[norm(o)]; });
      r.matched = shown.length ? shown : matched;
      r.rel = r.score / top;
      return r;
    });
  }

  function classify(raw, opts) {
    opts = opts || {};
    var a = analyze(raw);
    return finish(applyLearned(scoreRules(a, opts), a, similar(a, liveIndex), LIVE), a, opts);
  }

  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  // Taugt ein Text als Lernbeispiel? (genug Inhalt nach der Bereinigung)
  function learnable(raw) {
    var p = prepare(raw);
    return Object.keys(simToks(tokenize(p.text))).length >= 2 ? p.cleaned : "";
  }

  // ------------------------------------------------------------------
  // Auswertung mit früheren Fällen (lokal, in Etappen)
  // ------------------------------------------------------------------
  var VARIANTS = [
    { id: "regeln", name: "Nur Stichwörter (ohne gelernte Fälle)", rules: true, learned: false },
    { id: "gelernt", name: "Stichwörter + importierte Fälle (aktuelle Einstellung)", rules: true, agg: "max", w: EX_WEIGHT },
    { id: "max20", name: "Stichwörter + importierte Fälle, Gewicht 20", rules: true, agg: "max", w: 20 },
    { id: "max80", name: "Stichwörter + importierte Fälle, Gewicht 80", rules: true, agg: "max", w: 80 },
    { id: "top3_20", name: "Stichwörter + mehrere ähnliche Fälle, Gewicht 20", rules: true, agg: "top3", w: 20 },
    { id: "top3_40", name: "Stichwörter + mehrere ähnliche Fälle, Gewicht 40", rules: true, agg: "top3", w: 40 },
    { id: "top3_80", name: "Stichwörter + mehrere ähnliche Fälle, Gewicht 80", rules: true, agg: "top3", w: 80 },
    { id: "nurfaelle", name: "Nur importierte Fälle (ohne Stichwörter)", rules: false, agg: "max", w: EX_WEIGHT }
  ];

  function cmp(x, y) { return x < y ? -1 : x > y ? 1 : 0; }
  function partHit(p, w) { return p.m === "x" ? w === p.w : p.m === "p" ? w.indexOf(p.w) === 0 : w.indexOf(p.w) !== -1; }
  // Alle Wortteile der Regeln einer Klassifizierung (inkl. Bezeichnung und @Gruppen)
  function ruleParts(c) {
    var seen = {}, out = [];
    c.rules.forEach(function (r) { r.terms.forEach(function (t) { t.matchers.forEach(function (l) { l.parts.forEach(function (p) {
      if (!seen[p.m + ":" + p.w]) { seen[p.m + ":" + p.w] = 1; out.push(p); }
    }); }); }); });
    return out;
  }
  // Frische Kopie der Regel-Ergebnisse (finish/applyLearned verändern sie)
  function cloneRes(res) {
    var out = { results: [], byC: {} };
    res.results.forEach(function (r) {
      var pos = {}, k;
      for (k in r.pos) pos[k] = 1;
      var n = { c: r.c, score: r.score, pos: pos, byCode: r.byCode, hits: r.hits };
      out.results.push(n); out.byC[r.c.code] = n;
    });
    return out;
  }

  // Misst die Genauigkeit mit früheren Fällen [{t: Text, c: Code}]: jeder Fall wird
  // wie ein neuer Fall getestet (er selbst und Fälle mit gleichem Text zählen nicht).
  // Die gelernten Fälle des Tools werden weder benutzt noch verändert.
  // opts: {maxTests: 3000, minDocs: 5, details: false}
  // Rückgabe: {step(ms) -> fertig?, progress() -> {phase, done, total}, result() -> Bericht}
  function evaluation(cases, opts) {
    cases = cases || []; opts = opts || {};
    var maxTests = opts.maxTests || 3000, minDocs = opts.minDocs || 5;
    var phase = "prepare", at = 0, usable = [], skipped = { unbekannterCode: 0, zuWenigText: 0 };
    var codeN = {}, codeWords = {}, dfAll = Object.create(null);
    var baseItems = baseExamples.map(function (e) { return { t: e.t, c: e.c, base: true }; });
    var baseIdx = makeIndex(baseItems), evalIdx = null, tests = [], every = 1;
    var stats = {}, perCode = {}, conf = { regeln: {}, gelernt: {} }, trig = {}, errors = [];
    var details = opts.details ? [] : null, wordCodes = [], wordsOut = [], report = null;
    VARIANTS.forEach(function (v) { stats[v.id] = { id: v.id, name: v.name, n: 0, top1: 0, top3: 0, none: 0 }; });

    // 1. Fälle vorbereiten, Wortstatistik sammeln
    function prepOne(i) {
      var x = cases[i] || {}, c = String(x.c == null ? "" : x.c).trim(), t = String(x.t == null ? "" : x.t);
      if (!hasCode(c)) { skipped.unbekannterCode++; return; }
      var a = analyze(t), st = Object.keys(queryStems(a));
      if (st.length < 2) { skipped.zuWenigText++; return; }
      usable.push({ i: i, t: t, c: c, key: norm(a.prep.cleaned), st: st });
      codeN[c] = (codeN[c] || 0) + 1;
      var cw = codeWords[c] || (codeWords[c] = Object.create(null)), seen = Object.create(null);
      a.words.forEach(function (w) {
        if (seen[w] || w.length < 4 || /^\d+$/.test(w) || FILL[w] || SIMSTOP[w] || STOP[w]) return;
        seen[w] = 1; cw[w] = (cw[w] || 0) + 1; dfAll[w] = (dfAll[w] || 0) + 1;
      });
    }
    function startTest() {
      evalIdx = makeIndex(baseItems.concat(usable.map(function (u) {
        return { t: u.t, c: u.c, base: false, i: u.i, key: u.key, st: u.st };
      })));
      every = usable.length > maxTests ? Math.ceil(usable.length / maxTests) : 1;
      for (var j = 0; j < usable.length; j += every) tests.push(usable[j]);
      phase = "test"; at = 0;
    }
    function count(m, key, obj) { (m[key] || (m[key] = obj)).n++; }

    // 2. Einen Fall mit allen Varianten testen
    function testOne(u) {
      var a = analyze(u.t), rules = scoreRules(a, { debug: true });
      var sims = similar(a, evalIdx, { exclude: function (e) { return !e.base && e.key === u.key; } });
      var baseSims = similar(a, baseIdx), top = {}, first = null;
      VARIANTS.forEach(function (v) {
        var res = v.rules ? cloneRes(rules) : { results: [], byC: {} };
        applyLearned(res, a, v.learned === false ? baseSims : sims, v.learned === false ? LIVE : v);
        var picked = finish(res, a, {}), codes = picked.map(function (r) { return r.c.code; }), s = stats[v.id];
        top[v.id] = codes;
        if (v.id === "regeln") first = picked[0];
        s.n++;
        if (!codes.length) s.none++;
        if (codes[0] === u.c) s.top1++;
        if (codes.indexOf(u.c) !== -1) s.top3++;
      });
      var pc = perCode[u.c] || (perCode[u.c] = { code: u.c, n: 0, regeln: { top1: 0, top3: 0 }, gelernt: { top1: 0, top3: 0 }, wrong: {} });
      pc.n++;
      ["regeln", "gelernt"].forEach(function (id) {
        var codes = top[id], got = codes[0] || "-";
        if (got === u.c) pc[id].top1++;
        if (codes.indexOf(u.c) !== -1) pc[id].top3++;
        if (got !== u.c) count(conf[id], u.c + " " + got, { exp: u.c, got: got, n: 0 });
      });
      // falscher Platz 1 mit Stichwörtern: Code und auslösende Regeln (2 stärkste Treffer)
      var got = top.regeln[0];
      if (got && got !== u.c) {
        pc.wrong[got] = (pc.wrong[got] || 0) + 1;
        var hs = (first.hits || []).slice(0, 2), srcs = hs.map(function (h) { return h.code ? "(Code eingegeben)" : String(h.src); });
        if (!hs.length && first.learned) srcs = ["(Beispiel)"];
        srcs.forEach(function (rl) { count(trig, got + " " + u.c + " " + rl, { exp: u.c, got: got, rule: rl, n: 0 }); });
      }
      if (top.regeln.indexOf(u.c) === -1 || top.gelernt.indexOf(u.c) === -1) errors.push({ i: u.i, c: u.c, regeln: top.regeln, gelernt: top.gelernt });
      if (details) details.push({ i: u.i, c: u.c, top: top });
    }

    // 3. Häufige Wörter je Klassifizierung
    function startWords() {
      evalIdx = null;
      wordCodes = Object.keys(codeN).filter(function (c) { return codeN[c] >= minDocs; })
        .sort(function (x, y) { return codeN[y] - codeN[x] || cmp(x, y); });
      phase = "words"; at = 0;
    }
    function wordsOne(code) {
      var n = codeN[code], cw = codeWords[code], U = usable.length, parts = ruleParts(byCode[code]);
      var list = Object.keys(cw).filter(function (w) { return cw[w] >= minDocs; }).map(function (w) {
        return { w: w, d: cw[w], lift: (cw[w] / n) / (dfAll[w] / U) };
      });
      list.sort(function (x, y) { return y.lift - x.lift || y.d - x.d || cmp(x.w, y.w); });
      wordsOut.push({ code: code, n: n, words: list.slice(0, 15).map(function (x) {
        return [x.w, x.d, parts.some(function (p) { return partHit(p, x.w); })];
      }) });
    }

    function makeReport() {
      function list(m, max, order) {
        return Object.keys(m).map(function (k) { return m[k]; }).sort(order).slice(0, max);
      }
      function byN(x, y) { return y.n - x.n || cmp(x.exp, y.exp) || cmp(x.got, y.got) || cmp(x.rule || "", y.rule || ""); }
      report = {
        total: cases.length, usable: usable.length, skipped: skipped, tested: tests.length, sampleEvery: every,
        variants: VARIANTS.map(function (v) { var s = stats[v.id]; return { id: v.id, name: v.name, n: s.n, top1: s.top1, top3: s.top3, none: s.none }; }),
        perCode: Object.keys(perCode).map(function (c) {
          var p = perCode[c];
          return { code: c, n: p.n, regeln: p.regeln, gelernt: p.gelernt,
            wrong: Object.keys(p.wrong).map(function (g) { return [g, p.wrong[g]]; })
              .sort(function (x, y) { return y[1] - x[1] || cmp(x[0], y[0]); }).slice(0, 3) };
        }).sort(function (x, y) { return y.n - x.n || cmp(x.code, y.code); }),
        confusions: { regeln: list(conf.regeln, 30, byN), gelernt: list(conf.gelernt, 30, byN) },
        triggers: list(trig, 40, byN),
        words: wordsOut,
        errors: errors
      };
      if (details) report.details = details;
      phase = "done";
    }

    function unit() {
      if (phase === "prepare") {
        if (at < cases.length) prepOne(at++);
        if (at >= cases.length) startTest();
      } else if (phase === "test") {
        if (at < tests.length) testOne(tests[at++]);
        if (at >= tests.length) startWords();
      } else if (phase === "words") {
        if (at < wordCodes.length) wordsOne(wordCodes[at++]);
        if (at >= wordCodes.length) makeReport();
      }
    }

    return {
      // arbeitet etwa ms Millisekunden (ohne ms: bis zum Ende); true = fertig
      step: function (ms) {
        var t0 = Date.now();
        while (phase !== "done") {
          unit();
          if (ms != null && Date.now() - t0 >= ms) break;
        }
        return phase === "done";
      },
      progress: function () {
        var total = phase === "prepare" ? cases.length : phase === "test" ? tests.length :
          phase === "words" ? wordCodes.length : cases.length;
        return { phase: phase, done: phase === "done" ? total : at, total: total };
      },
      result: function () { return report; }
    };
  }

  return {
    build: build, classify: classify, prepare: prepare, norm: norm, setExamples: setExamples, learnable: learnable,
    evaluation: evaluation, VARIANTS: VARIANTS,
    get classes() { return classes; }, get byCode() { return byCode; }
  };
})();

if (typeof module !== "undefined") module.exports = Engine;
