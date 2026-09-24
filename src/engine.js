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

  var groups = {}, classes = [], byCode = {}, idf = {}, errors = [], abk = [];

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

    // Abkürzungen: nur Grossbuchstaben = Gross-/Kleinschreibung beachten
    if (ABK) Object.keys(ABK).sort(function (a, b) { return b.length - a.length; }).forEach(function (k) {
      var cs = !/[a-zäöüß]/.test(k);
      var esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      abk.push({ re: new RegExp("(^|[^\\p{L}\\p{N}])" + esc + "(?![\\p{L}\\p{N}:])", cs ? "gu" : "giu"), to: ABK[k] });
    });

    featCache = {};
    baseExamples = (BASE || []).filter(function (e) { return e && e.t && byCode[e.c]; });
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
  var baseExamples = [], learnedExamples = [], exItems = [], exDf = {}, exN = 0, featCache = {};
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
  function setExamples(learned) {
    learnedExamples = (learned || []).filter(function (e) { return e && e.t && byCode[e.c]; });
    var all = baseExamples.map(function (e) { return { t: e.t, c: e.c, base: true }; })
      .concat(learnedExamples.map(function (e) { return { t: e.t, c: e.c, base: false }; }));
    exItems = []; exDf = {};
    all.forEach(function (e) {
      var st = featCache[e.t] || (featCache[e.t] = Object.keys(simToks(tokenize(prepare(e.t).text))));
      if (!st.length) return;
      exItems.push({ t: e.t, c: e.c, base: e.base, st: st });
      st.forEach(function (s) { exDf[s] = (exDf[s] || 0) + 1; });
    });
    exN = exItems.length;
    exItems.forEach(function (e) {
      var n = 0; e.st.forEach(function (s) { var v = exIdf(s); n += v * v; }); e.norm = Math.sqrt(n);
    });
    return exN;
  }
  function exIdf(s) { return Math.log(1 + (exN + 1) / ((exDf[s] || 0) + 0.5)); }

  // ------------------------------------------------------------------
  // Klassifizieren
  // ------------------------------------------------------------------
  function classify(raw, opts) {
    opts = opts || {};
    var prep = prepare(raw);
    var toks = tokenize(prep.text);
    var words = toks.map(function (t) { return t.w; });
    var rawWords = norm(raw).split(" ").filter(Boolean);
    var partCache = {}, litCache = {};
    var longText = words.filter(function (w) { return !FILL[w]; }).length > 20;

    function partPos(p) {
      var k = p.m + ":" + p.w;
      if (partCache[k]) return partCache[k];
      var pos = [], i, w;
      for (i = 0; i < words.length; i++) {
        w = words[i];
        if (p.m === "x" ? w === p.w : p.m === "p" ? w.indexOf(p.w) === 0 : w.indexOf(p.w) !== -1) pos.push(i);
      }
      var fuzzy = false;
      if (!pos.length && p.m !== "x" && p.w.length >= 8) {       // Tippfehler tolerieren (nur lange Wörter)
        var L = p.w.length;
        for (i = 0; i < words.length; i++) {
          w = words[i];
          if (w.slice(0, 2) !== p.w.slice(0, 2) || w.length < L - 1) continue;
          if (lev(w.slice(0, L), p.w) <= 1 || lev(w.slice(0, L + 1), p.w) <= 1 || lev(w.slice(0, L - 1), p.w) <= 1) pos.push(i);
        }
        fuzzy = pos.length > 0;
      }
      return (partCache[k] = { pos: pos, fuzzy: fuzzy });
    }

    function litMatch(lit) {
      if (litCache.hasOwnProperty(lit.key)) return litCache[lit.key];
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
      return (litCache[lit.key] = res);
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
      var ci = rawWords.indexOf(norm(c.code));
      if (rawWords.length <= 3 && ci !== -1) hits.push({ w: 100, pos: [], code: true });
      if (!hits.length) return;
      hits.sort(function (a, b) { return b.w - a.w; });
      var score = hits[0].w, allPos = {};
      for (var k = 1; k < hits.length; k++) score += 0.35 * hits[k].w;
      hits.forEach(function (h) { h.pos.forEach(function (p) { allPos[p] = 1; }); });
      var r = { c: c, score: score, pos: allPos, byCode: !!hits[0].code, hits: opts.debug ? hits : undefined };
      results.push(r); byC[c.code] = r;
    });

    // Ähnlichkeit mit gelernten Fällen
    if (exN) {
      var qs = simToks(toks), qk = Object.keys(qs), qn = 0;
      qk.forEach(function (s) { var v = exIdf(s); qn += v * v; });
      qn = Math.sqrt(qn);
      var bestEx = {};
      var qWords = {};
      qk.forEach(function (s) { qs[s].forEach(function (p) { qWords[p] = 1; }); });
      if (qn) exItems.forEach(function (e) {
        var dot = 0, common = [], words = {};
        e.st.forEach(function (s) { if (qs[s]) { var v = exIdf(s); dot += v * v; common.push(s); qs[s].forEach(function (p) { words[p] = 1; }); } });
        if (!dot) return;
        var sim = dot / (qn * e.norm);
        if (Object.keys(words).length < 2 && sim < 0.6) return;   // ein einziges gemeinsames Wort reicht meist nicht
        if (sim > EX_MIN && (!bestEx[e.c] || sim > bestEx[e.c].sim)) bestEx[e.c] = { sim: sim, ex: e, common: common };
      });
      Object.keys(bestEx).forEach(function (code) {
        var b = bestEx[code], r = byC[code];
        if (!r) { r = { c: byCode[code], score: 0, pos: {}, byCode: false }; results.push(r); byC[code] = r; }
        r.score += EX_WEIGHT * (b.sim - EX_MIN) / (1 - EX_MIN);
        r.learned = { sim: b.sim, text: b.ex.t, base: b.ex.base };
        b.common.forEach(function (s) { qs[s].forEach(function (p) { r.pos[p] = 1; }); });
      });
    }

    results.forEach(function (r) {
      var posList = Object.keys(r.pos).map(Number).sort(function (a, b) { return a - b; });
      var matched = [], seenW = {}, content = [];
      posList.forEach(function (p) {
        var o = toks[p].orig;
        if (!seenW[o.toLowerCase()]) { seenW[o.toLowerCase()] = 1; matched.push(o); }
        if (!FILL[toks[p].w]) content.push(p);
      });
      var shown = matched.filter(function (o) { return !FILL[norm(o)]; });
      r.matched = shown.length ? shown : matched; r.content = content;
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
    return picked.map(function (r) { r.rel = r.score / top; return r; });
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

  return {
    build: build, classify: classify, prepare: prepare, norm: norm, setExamples: setExamples, learnable: learnable,
    get classes() { return classes; }, get byCode() { return byCode; }
  };
})();

if (typeof module !== "undefined") module.exports = Engine;
