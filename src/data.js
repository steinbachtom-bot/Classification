/* =====================================================================
   DATEN – hier werden Klassifizierungen und Stichwörter gepflegt
   ---------------------------------------------------------------------
   SYN  = Synonymgruppen, in Regeln mit @name verwendbar
   KLASSEN-Zeilen:  Code :: Bezeichnung :: Regel; Regel; Regel
     - Regel   = mehrere Begriffe mit Leerzeichen -> ALLE müssen vorkommen
     - a|b|c   = einer davon genügt
     - a_b     = Wortgruppe (Wörter nahe beieinander, z.B. nicht_erhalten)
     - @gruppe = Synonymgruppe aus SYN
     - =wort   = nur exaktes Wort   ^wort = Wortanfang
     - !begriff = Ausschluss: Regel gilt nicht, wenn der Begriff im selben Satz steht
     - *0.8    = am Ende einer Regel: schwächer gewichten
   Die Begriffe einer Regel müssen im selben Satz stehen.
   Umlaute, Gross-/Kleinschreibung und Satzzeichen werden ignoriert.
   ===================================================================== */

var SYN = {
  paket: "paket, pakete, päckli, päckchen, packet, sendung, lieferung, karton, couvert, kuvert, briefumschlag, lieferschein",
  post: "=post, postbote, pöstler, briefträger, briefträgerin, =dpd, =dhl, =gls, =ups, hermes, kurier, zusteller, lieferpartner, paketdienst, versanddienstleister, planzer, quickpac",
  tracking: "tracking, sendungsverfolgung, sendungsnummer, trackingnummer, tracking nummer, trackinglink, verfolgung, sendungsstatus, paketnummer, =track, sendungsverlauf",
  bestellung: "bestellung, bestellungen, =auftrag, =auftrags, aufträge, =order, bestellt, bestellnummer, auftragsnummer",
  fehlt: "fehlt, =fehlen, fehlend, vergessen, nicht dabei, nicht enthalten, nicht im paket, nicht mitgeliefert, nicht drin, nicht beigelegt, nicht vorhanden, nicht mitgeschickt",
  kaputt: "kaputt, beschädigt, beschädigung, defekt, zerstört, ramponiert, lädiert, =schaden, schäden, demoliert, zerbrochen, gebrochen, mangelhaft, zerdrückt, gequetscht, eingedellt",
  falsch: "falsch, verkehrt, fremd, gehört mir nicht, nicht meins, nicht richtig, vertauscht",
  erhalten: "erhalten, bekommen, geliefert, zugestellt, angekommen, eingetroffen, gekriegt, =kam, =kamen, =bekam, =bekamen, =bekommt, =erhielt",
  nichterh: "nicht erhalten, nicht bekommen, nicht angekommen, nie angekommen, nicht geliefert, nicht zugestellt, noch nicht da, nicht eingetroffen, kam nie, kam nicht, nichts da, noch nichts da, ist nichts da, nichts gekommen, nie gekommen, nichts erhalten, nichts bekommen, nichts angekommen, nie erhalten, nie bekommen, noch nichts, immer noch nicht, wo bleibt, warte noch, warten noch, noch nicht erhalten, noch nicht bekommen, noch nicht angekommen",
  spaet: "verspätet, verspätung, verzögerung, verzögert, =spät, =später, zu spät, dauert so lange, dauert zu lange, immer noch nicht, wann kommt, überfällig, ankommen sollen, kommen sollen, sollte längst, hätte längst, =längst, lieferverzug, wo bleibt, noch nicht angekommen, noch nicht erhalten, noch nicht da, lange warten, warte seit, wartet seit, =seit wochen, =seit tagen",
  zuviel: "zu viel, zuviel, zu viele, zuviele, mehr als bestellt, doppelt geliefert, zweimal geliefert, überzählig, zusätzlich, =extra, mehr erhalten, mehr bekommen, zwei statt, drei statt, =2 statt, =3 statt, zwei anstatt",
  zuwenig: "zu wenig, zuwenig, zu wenige, weniger als bestellt, nicht alle, =statt, =anstatt, weniger erhalten, weniger bekommen, nur 1, =nur ein, =nur eine, =nur einen, nur zwei, nur 2, hälfte",
  fehler: "fehler, fehlermeldung, =error, geht nicht, funktioniert nicht, klappt nicht, =problem, =probleme, =bug, nicht möglich, lässt sich nicht, kann nicht, will nicht, fehlgeschlagen, =meldung, =hängt, =spinnt",
  wie: "=wie, kann ich, wo finde, wo kann, anleitung, =hilfe, =frage, möglich, erklären, erklärung, =tipp, =tipps, gibt es, =wo, =welche, =welches, =was",
  software: "software, programm, designer, =app, anwendung, applikation, onlinedesigner, =editor, =pc, computer, laptop, =mac, =macbook, website, webseite, =browser, =tablet, =ipad, smartphone",
  absturz: "absturz, abgestürzt, stürzt ab, =stürzt, =stürzte, =stuerzt, hängt sich, abstürzen, =crash, crasht, gecrasht, friert ein, eingefroren, =freeze, freezt, hängt sich auf, aufgehängt, reagiert nicht, schliesst sich, beendet sich",
  nichtoeffnen: "öffnet nicht, öffnet sich nicht, nicht öffnen, nicht geöffnet, lässt sich nicht öffnen, startet nicht, lädt nicht, geht nicht auf, kann nicht öffnen, nicht aufrufen, öffnen nicht, bleibt weiss, bleibt leer, lädt ewig, lädt endlos",
  login: "login, einloggen, eingeloggt, =log in, =anmelden, =anmeldung, =konto, kundenkonto, =account, benutzerkonto, =profil, benutzername, myifolor, =mein ifolor",
  projekt: "projekt, entwurf, entwürfe, fotobuchprojekt, projektdatei, gespeichertes",
  hochladen: "hochladen, hochgeladen, upload, uploaden, lädt hoch, übertragung, übertragen, übermittlung, übermitteln",
  vorschau: "vorschau, preview, voransicht, vorschaubild, vorschaubilder, 3d ansicht",
  ebook: "ebook, ebooks, =e book, digitales buch, digitale version, digitale ausgabe, pdf version, online version",
  checkout: "checkout, =check out, =kasse, zur kasse, bestellvorgang, bestellprozess, bezahlvorgang, bestellabschluss, bestellung abschliessen",
  warenkorb: "warenkorb, einkaufswagen, =korb, shopping cart, =cart",
  gutschein: "gutschein, voucher, coupon, gutscheincode, rabattcode, aktionscode, promocode, promo code, =code, =codes, =promo, geschenkkarte, wertkarte, gutscheinnummer",
  rabatt: "rabatt, reduktion, reduziert, vergünstigung, =prozent, ermässigung, nachlass, skonto, discount, preisnachlass",
  preis: "preis, kosten, kostet, =teuer, teurer, =betrag, =chf, =eur, =fr, franken, =euro, verrechnet, berechnet",
  newsletter: "newsletter, werbemail, werbemails, werbe mail, mailing, infomail, promo mail, marketing mail",
  abmelden: "abmelden, abbestellen, austragen, =kündigen, =stoppen, =stop, keine mehr, nicht mehr, entfernen, deaktivieren, abbestellung, unsubscribe, abmeldung, abgemeldet, ausgetragen",
  anmelden: "anmelden, abonnieren, abonniert, eintragen, eingetragen, registrieren, anmeldung, =abo, bekomme keinen, erhalte keinen, bekomme keine, erhalte keine, angemeldet",
  email: "email, emails, =e mail, =e mails, =mail, =mails, mailadresse, emailadresse, e mail adresse, posteingang, =inbox, spam, junk",
  buch: "=buch, fotobuch, fotobücher, =album, =alben, =photobook, =bücher, =buchs, fotoalbum, hardcover, softcover",
  kalender: "kalender, wandkalender, tischkalender, fotokalender, jahreskalender, familienplaner, =planer",
  cover: "cover, umschlag, einband, buchdeckel, =deckel, titelseite, titelblatt, buchumschlag, vorderseite, rückseite",
  seite: "seite, =page, =pages, =blatt, =blätter, innenseite, doppelseite",
  bild: "^bild, =foto, =fotos, =photo, =photos, aufnahme, aufnahmen, =motiv, =motive, =image, =images, =pics, =bildli",
  text: "=text, =texte, =texten, textfeld, textfelder, =schrift, beschriftung, =titel, bildunterschrift, bildtext, =widmung, =zitat, =namen, =name",
  print: "abzug, abzüge, fotoabzug, fotoabzüge, =print, =prints, retro print, retroprint, retroprints, =fotos, sofortbild, polaroid, papierbilder, digitalprint, fotoprint",
  wand: "leinwand, =acryl, acrylglas, =alu, alu dibond, dibond, forex, poster, wandbild, wandbilder, wanddeko, =holz, holzbild, galerieprint, hartschaum, fotoleinwand, =canvas, =glas",
  tasse: "tasse, tassen, =becher, =mug, kaffeetasse, fototasse, kaffeebecher",
  schmutz: "flecken, =fleck, fleckig, verschmutzt, schmutz, =dreck, dreckig, fingerabdruck, fingerabdrücke, verschmiert, schmiert, schmierig, klecks, kleckse, =tropfen, =punkte, pünktchen, fettfleck, farbfleck, farbflecken, verfärbung",
  streifen: "streifen, =linie, =linien, =striche, =strich, querstreifen, längsstreifen, =bänder, banding, streifig, gestreift",
  knick: "knick, eselsohr, knitter, zerknittert, =falz, =gefaltet, =faltig",
  ecke: "^ecke, ^ecken, coverecke, eckschaden, buchecke",
  riss: "=riss, =risse, eingerissen, gerissen, zerrissen, einriss, ausgerissen, =loch, =löcher, rissig",
  lose: "löst sich, lösen sich, gelöst, =löst, =lösen, =lose, =locker, lockert, fällt raus, fallen raus, fällt heraus, fallen heraus, herausgefallen, rausgefallen, fällt auseinander, auseinandergefallen, geht ab, abgegangen, hält nicht, halten nicht",
  kleben: "kleben zusammen, klebt zusammen, zusammengeklebt, verklebt, aneinander, zusammenkleben, =kleben, =klebt, =pappen, =pappt, zusammengepappt",
  leer: "^leer, weisse seite, weisse seiten, seite weiss, seiten weiss, komplett weiss, unbedruckt, nicht bedruckt, =blank, ohne inhalt, nichts drauf, nichts gedruckt",
  unscharf: "unscharf, unschärfe, verschwommen, verwaschen, nicht scharf, verwackelt, verwischt, schwammig, milchig",
  dunkel: "dunkel, dunkler, =dunkle, =dunklen, zu dunkel, düster, finster, unterbelichtet, zu hell, heller, =hell, überbelichtet, =blass, blasser, =flau, ausgewaschen, helligkeit, belichtung",
  rechnung: "rechnung, rechnungen, faktura, =invoice, =rechnig, einzahlungsschein, qr rechnung, =beleg",
  kreditkarte: "kreditkarte, kreditkarten, =visa, mastercard, =master card, =amex, american express, debitkarte, =maestro, 3d secure, postfinance card, karte abgelehnt, kartenzahlung"
};

var KLASSEN = `
# Marketing
## Direct Customer Communication
50601 :: Newsletter ab/anmelden :: @newsletter; @newsletter @abmelden; @newsletter @anmelden; keine_mails|keine_emails|keine_werbemails|keine_newsletter
50602 :: Newsletter Sprache :: @newsletter sprache|französisch|deutsch|italienisch|englisch|falsche_sprache|falscher_sprache|andere_sprache; newslettersprache
50603 :: Kampagnen Fehler :: kampagne|kampagnen @fehler; @newsletter @fehler|link|falsch; aktionslink|kampagnenlink|kampagnenfehler|fehler_im_newsletter|fehler_in_der_werbung; ^aktion link @fehler
50610 :: Auskunft Aktionen-Newsletter :: ^aktion @wie; ^aktion welche|wann|laufende|aktuelle|aktuell|nächste|gerade; aktuelle_aktion|aktuelle_aktionen|laufende_aktion|nächste_aktion|black_friday|cyber_monday|sonderangebot|sonderangebote; @newsletter ^aktion|angebot|angebote
50613 :: Zusammenarbeit/Sponsoring :: sponsoring|sponsor|sponsern|gesponsert; zusammenarbeit|kooperation|partnerschaft|influencer|blogger|collab; verein|spende|spenden|charity
50614 :: Wettbewerb/ Gewinnspiel :: wettbewerb|gewinnspiel|verlosung|preisausschreiben|contest|giveaway|gewonnen|gewinner|gewinnerin
50616 :: Spezifikation der Kampagne :: kampagne|^aktion bedingung|bedingungen|konditionen|gültig|gültigkeit|teilnahmebedingungen|mindestbestellwert|ausgeschlossen|gilt|details|laufzeit; aktionsbedingungen|kampagnenbedingungen|aktion_gilt|gilt_die_aktion
6301 :: Werbesperre setzen/entfernen :: werbesperre; keine_werbung|werbung_stoppen|werbung_abbestellen|werbung_nicht_mehr|stopp_werbung; werbung @abmelden; katalog|prospekt|prospekte|flyer|briefwerbung|postwerbung|broschüre @abmelden; werbung_wieder|wieder_werbung

## Price & Sales Incentives
50101 :: Geschenksgutscheine :: geschenkgutschein|geschenksgutschein|geschenkkarte|giftcard|gift_card|wertgutschein|geschenkcode; @gutschein geschenk|verschenken|schenken|kaufen|erwerben !einlösen|eingelöst|ungültig|@fehler; gutschein_kaufen|gutschein_verschenken
50604 :: Rabatt unberechtigt :: unberechtigt|unberechtigter|unberechtigte; zu_unrecht|nicht_berechtigt|kein_anspruch; @rabatt|@gutschein missbrauch|mehrfach|weitergegeben|zweimal_eingelöst|mehrfach_eingelöst
50605 :: Aktionspreis differenz :: aktionspreis; preisdifferenz|preisunterschied; @preis differenz|unterschied|abweichend|abweichung|höher|stimmt_nicht|nicht_übernommen|anders ^aktion|newsletter|werbung|angebot|beworben|angezeigt|website; @preis ^aktion
50606 :: Gutschein falsch angelegt :: @gutschein falsch_angelegt|falsch_erstellt|falsch_ausgestellt|falscher_betrag|falscher_wert|falsches_datum|falsch_hinterlegt|falscher_prozentsatz|angelegt; @gutschein @falsch
50611 :: Werbegutschein Verlängerung :: @gutschein verlängern|verlängerung|verlängert|abgelaufen|verfallen|ausgelaufen|expired|nicht_mehr_gültig|gültigkeit; werbegutschein; gutschein_abgelaufen
50612 :: Rabatte kummulieren :: kumulieren|kummulieren|kumulierbar|kumuliert|kombinierbar; @gutschein|@rabatt kombinieren|kombination|zusammen|gleichzeitig|mehrere|zwei|beide|zweiten; mehrere_gutscheine|zwei_gutscheine|zweiten_gutschein|rabatt_und_gutschein|gutschein_und_rabatt
50615 :: Spezifikation des Gutscheins :: @gutschein bedingung|bedingungen|gültig_für|gilt_für|welche_produkte|mindestbestellwert|einlösbar|restwert|teileinlösung|versandkosten|ausgeschlossen|gilt_nicht|nicht_gültig_für|wert; gutscheinbedingungen

# Operations
## Mix-ups
812 :: Verwechslung falsche Seiten im Produkt :: fremde_seiten|falsche_seiten|seiten_von_jemand|andere_seiten|fremde_seite; @seite fremd|fremde|fremden|jemand_anderem|nicht_meine|gehören_nicht|anderen_auftrag|anderen_bestellung; @seite @falsch *0.8
813 :: Verwechslung falschen Auftrag erhalten :: falscher_auftrag|falsche_bestellung|fremde_bestellung|andere_bestellung|fremden_auftrag|falschen_auftrag|nicht_meine_bestellung|bestellung_von_jemand; @bestellung @falsch|jemand; nicht_mein|nicht_meine|nicht_unser|nicht_unsere|fremd|fremde|fremden|fremdes @buch|@kalender|@print|@wand|@tasse|poster|produkt|artikel !@seite
814 :: Verwechslung falsches Paket erhalten :: falsches_paket|fremdes_paket|paket_für_jemand|paket_von_jemand|falscher_empfänger|anderer_empfänger|nicht_an_mich|anderer_name|nicht_mein_paket; @paket @falsch|jemand *0.8
815 :: Verwechslung falsches Produkt erhalten :: falsches_produkt|falschen_artikel|falscher_artikel|anderes_produkt|falsches_format|falsche_grösse|falsches_motiv; @falsch produkt|artikel|format|grösse @erhalten; produkt @falsch; fremd|fremdes|fremden|falsches|falschen|falscher @buch|@kalender|@print|@wand|@tasse|poster|=karte|=karten|puzzle|artikel !@seite !@bild
816 :: Verwechslung zusätzlich falsches Produkt erhalten :: zusätzlich|extra|zu_viel|mehr_als @falsch|fremd|fremdes; zusätzliches_produkt|zusätzlichen_artikel|noch_ein_fremdes|zusätzlich_ein
811 :: Verwechslung :: verwechslung|verwechselt|verwechselung|vertauscht !@bild !@seite; fremde_bilder|fremde_fotos|fremdes|nicht_seine|nicht_ihre|gehört_nicht_mir|nicht_meine|nicht_meiner|jemand_anderem|jemand_anderes !@rechnung !@gutschein !@preis !@email !adresse|betrag|passwort|antwort|auskunft|sprache|layout|vorlage; @falsch @erhalten !@rechnung !@gutschein !@preis !@email !adresse|betrag|passwort|antwort|auskunft|sprache|layout|vorlage

## Production Issues
3709 :: Keine Rückmeldung Kunde :: kunde_meldet_sich_nicht|kunde_antwortet_nicht|keine_rückmeldung_vom_kunden|keine_rückmeldung_kunde|keine_antwort_vom_kunden|keine_reaktion_vom_kunden|kunde_nicht_erreichbar|kunde_reagiert_nicht; keine_rückmeldung|keine_antwort|keine_reaktion|meldet_sich_nicht|antwortet_nicht|nicht_erreichbar !=ich|=mir|=mich|=mein|=meine|=meiner|=ihnen|=sie|=ihr|=ihre
429 :: Auftrag unvollständig Zubehör fehlt :: zubehör|aufhänger|aufhängung|haken|schraube|schrauben|nägel|dübel|klebepads|klebestreifen|halterung|standfuss|ständer|aufsteller|geschenkbox|etui|schutzhülle|=box|schuber|umschläge|couverts|kuverts @fehlt; zubehör
430 :: Auftrag unvollständig Produkt fehlt :: produkt|artikel|@kalender|fotobuch|=buch|=karte|=karten|@tasse|@print|poster|leinwand|puzzle|exemplar @fehlt !@bild !@text !@seite !@vorschau; nicht_alles|ein_produkt_fehlt|artikel_fehlt|teil_der_bestellung_fehlt|nicht_alle_produkte; @paket @fehlt *0.8
420 :: Auftrag unvollständig :: unvollständig|nicht_vollständig|nicht_komplett|unkomplett; @bestellung @fehlt; fehlt_etwas|fehlt_was
253 :: Bildqualität Viesus SW :: viesus; bildverbesserung|automatische_optimierung|automatisch_optimiert|zu_stark_optimiert|überoptimiert
385 :: Herstellung Produkt Tonerstreifen Cover :: tonerstreifen|toner|@streifen @cover; tonerstreifen
382 :: Herstellung Produkt Flecken HP :: @schmutz =hp|indigo; hp_indigo
383 :: Herstellung Produkt Flecken Xerox :: @schmutz xerox; xerox
384 :: Herstellung Produkt Tonerstreifen Inhalt :: tonerstreifen|toner|@streifen @seite|inhalt|innen|innenseiten|innenteil; tonerstreifen
211 :: Bildqualität Farbe gerechtfertigt :: ^farb @falsch|@dunkel|stimmt_nicht|anders|abweichend|blass|kräftig|intensiv|flau; farbstich|farbabweichung|blaustich|rotstich|grünstich|gelbstich|magentastich; @print|@wand ^farb
212 :: Bildqualität Farbe Kulanz :: ^farb kulanz; ^farb @falsch|@dunkel|stimmt_nicht|anders|abweichend *0.9; farbstich|farbabweichung *0.9
221 :: Bildqualität Dichte gerechtfertigt :: dichte|druckdichte|@dunkel; zu_dunkel|zu_hell|dunkler_als|heller_als|zu_dunkel_gedruckt
222 :: Bildqualität Dichte Kulanz :: dichte kulanz; @dunkel *0.9; zu_dunkel|zu_hell *0.9
231 :: Bildqualität unscharf :: @unscharf; unscharf_gedruckt|druck_unscharf|schärfe
232 :: Bildqualität Kontrast :: kontrast|kontrastarm|kontrastreich|kontraste|zu_hart|flau|ausgewaschen|milchig
241 :: Bildqualität Ränder/Balken :: ränder|balken|weisser_rand|weisse_ränder|weissen_rand|schwarzer_balken|schwarze_balken|weisse_balken|rand_am_bild|streifen_am_rand|ungleicher_rand; rand @print|@bild
251 :: Bildqualität Banding (Prints, Walldeko) :: banding; @streifen @print|@wand; streifen_im_bild|streifen_im_foto
252 :: Bildqualität Tonerstreifen (Druck) :: tonerstreifen|toner; @streifen druck|gedruckt|drucker
291 :: Bildqualität Sonstige :: bildqualität|qualität_der_bilder|schlechte_qualität|qualität_schlecht|bildqualität_schlecht|qualität_enttäuschend|schlechte_bildqualität|druckqualität
311 :: Herstellung Bindung Spiral n.i.O. :: spirale|spiral|spiralbindung|ringbindung|wire_o|wireo|drahtbindung|=ringe|=ring; spirale|spiral|ringbindung|=ringe @kaputt|verbogen|offen|locker|=lose|aufgebogen|eingedrückt|platt|@falsch
312 :: Herstellung Bindung Klebebindung n.i.O. :: klebebindung|leimbindung|klebung|leim|klebstoff; bindung @lose|@kaputt|gebrochen; softcover @lose; fällt_auseinander|auseinandergefallen
314 :: Herstellung Bindung Layflat n.i.O. :: layflat|lay_flat|flachbindung|flach_aufschlagen|nicht_flach|liegt_nicht_flach; layflat @kaputt|@lose|bindung|falz|mitte|bruch|@riss
315 :: Herstellung Bindung Seiten lösen sich :: @seite @lose; seiten_lösen|seiten_lose|lose_seiten|seiten_fallen|fallen_seiten|seite_fällt|herausgefallen|rausgefallen|fällt_auseinander
321 :: Herstellung Papierbeschädigung :: papierbeschädigung|papierschaden; papier @kaputt|@riss|@knick|zerknittert|knitter|wellig
331 :: Herstellung falscher Schnitt :: falscher_schnitt|falsch_geschnitten|schief_geschnitten|falsch_zugeschnitten|zu_viel_abgeschnitten|beschnitt; geschnitten|schnitt|abgeschnitten|zugeschnitten @falsch|schief|schräg|ungerade|zu_viel|zu_knapp|ungleich
351 :: Herstellung sonstige Herstellung :: herstellungsfehler|produktionsfehler|druckfehler|verarbeitungsfehler|verarbeitung|druckqualität|qualitätsmangel|schlecht_verarbeitet|schlecht_gedruckt|mangelhaft
352 :: Herstellung sonstige Kulanz :: kulanz|kulant|kulanzlösung|entgegenkommen|goodwill|ausnahmsweise|aus_kulanz
361 :: Herstellung Produkt Lichteinfall :: lichteinfall|lichtschaden|lichtstreifen|lichtflecken|belichtet|verschleiert|schleier|fehlbelichtung; licht @streifen|@schmutz|=rot|orange|roter|oranger
362 :: Herstellung Produkt Kratzer :: kratz|schramme|schrammen
363 :: Herstellung Produkt hängengeblieben :: hängengeblieben|hängen_geblieben|steckengeblieben|stecken_geblieben|eingeklemmt|verklemmt|papierstau
364 :: Herstellung Produkt Flecken :: @schmutz; flecken_auf|flecken_im|fleckig
365 :: Herstellung Produkt Folie löst sich :: folie|laminat|laminierung|kaschierung|beschichtung|schutzfolie @lose|blasen|blase|schält|abgeschält|hebt|abheben|abgehoben|wellt; folie_löst|folie_geht_ab
366 :: Herstellung Produkt Seiten kleben zusammen :: @kleben @seite; kleben_zusammen|zusammengeklebt|verklebt|kleben_aneinander|klebt_zusammen|zusammenkleben
367 :: Herstellung Produkt Seiten kleben zusammen (Hitze, Toner) :: @kleben hitze|warm|wärme|toner|sonne|heiss|temperatur|=auto; @seite @kleben
369 :: Herstellung Produkt Farbverlauf (Tassen) :: farbverlauf; @tasse ^farb|verlauf|verblasst|blass|ungleichmässig|wolkig|wolken|fleckig|verfärbt|druck|motiv
370 :: Herstellung Produkt Sortierfehler Inhalt (Anzahl, Reihenfolge) :: sortierfehler|seitenreihenfolge|falsche_reihenfolge|durcheinander|reihenfolge_stimmt|falsch_sortiert; reihenfolge|sortierung|sortiert|vertauscht @seite|@bild|@buch|@print; anzahl|stückzahl|zu_wenig|zu_viele @print|@bild
381 :: Materialfehler ( Tasse,Papier,Leinwand…) :: materialfehler|materialmangel|materialschaden; material @kaputt|@fehler|mangel|minderwertig; @tasse =riss|sprung|gesprungen|abgeplatzt|glasur|haarriss|undicht|@kaputt; leinwand|stoff =riss|=loch|faser|webfehler|beule; papier minderwertig|zu_dünn|rissig
712 :: Fehlergrund nicht zuzuordnen, sonstiges :: nicht_zuzuordnen|nicht_zuordenbar|unklar|unbekannter_fehler|sonstiger_fehler|anderes_problem|sonstiges|unklarer_grund|ursache_unbekannt
3701 :: Herstellung Produkt Seiten gewellt :: gewellt|wellig|wellen|welle|wellt|gewölbt|wölbt|wölbung|krumm|beult|beulen; @seite wellig|gewellt|wellen
3702 :: Herstellung Produkt Passerungenauigkeit :: passer|passerungenauigkeit|passgenau|registerfehler|farbversatz|versatz|doppelkontur|doppelkonturen|geisterbild; ^farb verschoben|versetzt|verrutscht
3703 :: Herstellung Produkt doppelte Seiten :: doppelte_seite|doppelte_seiten|seite_doppelt|seiten_doppelt|seite_zweimal|gleiche_seite|seiten_zweimal; @seite doppelt|zweimal|zwei_mal|2x
3705 :: Herstellung Produkt Montagefehler (Aufhänger, Rahmen) :: montagefehler|montage|montiert|falsch_montiert|schief_montiert; aufhänger|aufhängung|aufhängeschiene|schiene|haken|keilrahmen|rahmen|halterung|leiste @kaputt|@lose|schief|@falsch|abgefallen|abgebrochen|verbogen|@fehlt|klebt_nicht|hält_nicht
3706 :: Herstellung Produkt Brennprozess n.i.O. :: brennprozess|brennvorgang|gebrannt|eingebrannt|brennofen|einbrennen|sublimation; nicht_richtig_gebrannt|schlecht_gebrannt
3707 :: Herstellung Produkt Lackierung n.i.O. :: lack|lackierung|lackiert|glanzlack|uv_lack|spotlack|lackschicht|veredelung|lackschaden; lack @schmutz|@kaputt|ungleichmässig|@fehlt|matt|blasen|kratzer
3708 :: Produkt leere Seiten :: @leer @seite; leere_seite|leere_seiten|leeres_blatt|seiten_leer|seite_leer|weisse_seite|weisse_seiten|unbedruckte|nicht_bedruckt
411 :: Auftrag falsche Bearbeitung Kunde :: kundenfehler|selbst_verschuldet|eigener_fehler|mein_fehler|selber_schuld|eigenverschulden; selbst|selber|versehentlich|aus_versehen @falsch|fehler|gestaltet|hochgeladen|gewählt|bearbeitet
412 :: Auftrag falsche Bearbeitung Labor :: laborfehler|labor|falsch_bearbeitet|falsch_verarbeitet|falsch_produziert|bearbeitungsfehler; labor|produktion|=lab @falsch|fehler|bearbeitung
413 :: Auftrag falsche Bearbeitung Datenträger :: datenträger|=usb|stick|usb_stick|=cd|=dvd|speicherkarte|sd_karte|sdkarte|festplatte|speichermedium
414 :: Auftrag falsche Bearbeitung falsche Oberfläche :: falsche_oberfläche|matt_statt|glänzend_statt|glanz_statt|matt_anstatt|glänzend_anstatt|statt_matt|statt_glänzend; oberfläche|matt|glänzend|glanz|hochglanz|seidenmatt|perlglanz|seidenglanz @falsch|statt|anstatt|bestellt|gewählt
421 :: Auftrag Unvollst. Bearbeitung unvollst. Bearb. :: unvollständig_bearbeitet|nicht_vollständig_bearbeitet|teilweise_bearbeitet|unvollständig_verarbeitet|unvollständige_bearbeitung|nicht_alle_bilder|nicht_alle_fotos; nicht_alle @bild gedruckt|bearbeitet|verarbeitet|entwickelt
426 :: Auftrag Unvollst. Bearbeitung sonstiges :: unvollständig|unvollständige|nicht_vollständig bearbeitung|bearbeitet|verarbeitet|verarbeitung
427 :: Auftrag Unvollst. Bearbeitung Seite leer o. fehlendes Bild :: @leer @seite; fehlendes_bild|fehlende_bilder|bild_fehlt|bilder_fehlen|foto_fehlt|fotos_fehlen; @bild @fehlt; leerer_rahmen|leeres_feld|leeres_bildfeld|platzhalter
428 :: Unvollst. Bearbeitung Seite leer o. fehlendes Bild :: @leer @seite *0.95; fehlendes_bild|fehlende_bilder|bild_fehlt|bilder_fehlen|foto_fehlt|fotos_fehlen *0.95; @bild @fehlt *0.95; leerer_rahmen|leeres_feld|leeres_bildfeld|platzhalter *0.95

## Logistics & Shipping
50402 :: Teillieferung :: teillieferung|teilsendung|teilweise_geliefert|teilweise_erhalten|nur_ein_teil|nur_teil|zweites_paket|zwei_pakete|2_pakete|separates_paket|getrennt_geliefert|einzeln_geliefert|separat_geliefert|rest_der_bestellung|restliche|restlichen|zweite_lieferung|erste_paket|ersten_paket; =teil @bestellung @erhalten
50406 :: Status Tracking abgeschlossen :: @tracking zugestellt|abgeschlossen|ausgeliefert|geliefert; als_zugestellt|laut_post_zugestellt|laut_tracking_zugestellt|status_zugestellt|zugestellt_aber; zugestellt @nichterh
50407 :: Status Tracking offen :: @tracking offen|unterwegs|bewegt|keine_änderung|kein_update|=seit_tagen|stillstand|stehen|nicht_aktualisiert|zoll|verzollung; @tracking; wo_ist_mein_paket|wo_ist_das_paket|wo_ist_die_sendung|sendung_unterwegs
50408 :: Lieferdifferenz zu viel :: @zuviel @erhalten|@paket|geliefert|exemplare|stück !=nur; lieferdifferenz @zuviel; zu_viel_geliefert|zu_viele_geliefert|doppelt_geliefert|zweimal_geliefert|mehr_erhalten|mehr_geliefert|mehr_als_bestellt
50409 :: Lieferdifferenz zu wenig :: @zuwenig @erhalten|@paket|geliefert|exemplare|stück|abzüge; lieferdifferenz @zuwenig; zu_wenig_geliefert|weniger_erhalten|weniger_geliefert|weniger_als_bestellt|nicht_alle_exemplare|exemplar_fehlt|stück_fehlen
50703 :: Ohne Absender :: ohne_absender|kein_absender|absender_fehlt|keinen_absender|absender_unbekannt|ohne_bestellnummer; rücksendung|retoure|retour|zurückgeschickt ohne|zuordnen|anonym
50410 :: Lieferverzögerung :: @spaet !@rechnung !bestätigung|link|keine_mail|keine_email|keine_e_mail|mail_nicht|email_nicht|bestätigungsmail|gutschrift|geld|rückerstattung|zurückerstattet|erstattet|antwort|rückmeldung|passwort; lieferverzögerung|lieferverzug; @nichterh @paket|@bestellung|lieferung|@buch|@kalender|@print|@wand|@tasse|produkt|artikel|poster|=karten|geliefert !@rechnung !bestätigung|link|keine_mail|keine_email|keine_e_mail|mail_nicht|email_nicht|bestätigungsmail|gutschrift|geld|rückerstattung|zurückerstattet|erstattet|antwort|rückmeldung|passwort; @spaet @paket|@bestellung|lieferung|@buch|@kalender|@print|@wand|@tasse|produkt|artikel|poster|=karten|geliefert !@rechnung !bestätigung|link|keine_mail|keine_email|keine_e_mail|mail_nicht|email_nicht|bestätigungsmail|gutschrift|geld|rückerstattung|zurückerstattet|erstattet|antwort|rückmeldung|passwort; wartet|warte|warten @paket|@bestellung|lieferung|@buch|@kalender|@print|@wand|@tasse|produkt|artikel|poster|=karten|geliefert !@rechnung !bestätigung|link|keine_mail|keine_email|keine_e_mail|mail_nicht|email_nicht|bestätigungsmail|gutschrift|geld|rückerstattung|zurückerstattet|erstattet|antwort|rückmeldung|passwort; weihnachten|geburtstag|rechtzeitig|dringend|termin @nichterh|@spaet !@rechnung !bestätigung|link|keine_mail|keine_email|keine_e_mail|mail_nicht|email_nicht|bestätigungsmail|gutschrift|geld|rückerstattung|zurückerstattet|erstattet|antwort|rückmeldung|passwort
50704 :: Fehlbestellung :: fehlbestellung|falsch_bestellt|versehentlich_bestellt|aus_versehen_bestellt|irrtümlich_bestellt|irrtümlich|nicht_gewollt|doch_nicht; zurückgeben|zurückschicken|rücksendung|umtauschen|umtausch|retournieren|zurücksenden
50412 :: Paket nicht beim Lieferpartner angekommen :: @post @nichterh; nicht_bei_der_post|nie_bei_der_post|nicht_übergeben|nicht_an_die_post|nicht_eingeliefert|nur_angekündigt|elektronisch_angekündigt|sendungsdaten|label_erstellt|nicht_aufgegeben; lieferpartner
50701 :: Annahme verweigert :: annahmeverweigerung|annahme_verweigert|annahme_abgelehnt|annahme_nicht; @paket|@post verweigert|zurückgewiesen|nicht_angenommen|refused|zurück_an_absender|retour_an
518 :: Postschaden Ecke eingedrückt :: @ecke eingedrückt|gestaucht|zerdrückt|verbogen|abgeknickt|umgebogen|@kaputt @paket|@post|transport|versand; ecke_eingedrückt|ecken_eingedrückt|eckschaden|ecke_zerdrückt|ecken_gestaucht
519 :: Postschaden Knicke :: @knick @paket|@post|transport|versand|briefkasten|zustellung|zugestellt; briefkasten gestopft|reingedrückt|reingestopft|gefaltet|geknickt|gequetscht
511 :: Beschädigung :: @paket @kaputt; beschädigt_angekommen|kaputt_angekommen|defekt_angekommen|beschädigt_geliefert|kaputt_geliefert|beschädigt_erhalten|kaputt_erhalten; @kaputt angekommen|geliefert|zugestellt|transport|versand|auspacken|ausgepackt; paket_nass|paket_aufgerissen|paket_offen|verpackung_beschädigt|verpackung_kaputt|nass_geworden; @paket|verpackung nass|aufgerissen|offen|geöffnet|zerrissen|eingedrückt|durchnässt|feucht|zerdrückt
512 :: unbekannt :: unbekannt !fehler|grund|ursache|problem; empfänger_unbekannt|adresse_unbekannt|unzustellbar|nicht_zustellbar|adressat_unbekannt|adresse_falsch|falsche_adresse|adresse_unvollständig|zurück_an_absender|retour_an_absender|kam_zurück|zurückgekommen
513 :: nicht abgeholt :: nicht_abgeholt|nicht_rechtzeitig_abgeholt|abholfrist|lagerfrist|abholschein|abholungseinladung|abholeinladung|=avis|postfiliale|poststelle|abholstelle|pickpost|pick_post|mypost24|postomat|paketautomat|packstation
514 :: verlorene Sendung :: @paket|@post|@tracking verloren|verschwunden|=weg|abhanden|verlust; verschollen|unauffindbar|nicht_auffindbar|nachforschung|nachforschungsauftrag|nachforschungsantrag|verlustmeldung
515 :: Zustellungsbeschwerde :: zustellungsbeschwerde|zustellbeschwerde|beschwerde_zustellung|beschwerde_über_post|beschwerde_über_den_pöstler; nicht_geklingelt|nicht_geläutet|nicht_geklopft|vor_die_tür|vor_der_tür|einfach_abgestellt|abgestellt|im_regen|beim_nachbarn|zuhause_war|daheim_war|obwohl_ich_da_war|unfreundlich|abholschein_obwohl; @post|@paket vor_die_tür|vor_der_tür|unfreundlich|beschwerde|frech|abgestellt|hingestellt|deponiert|abgelegt|hingelegt|geworfen; versandproblem|zustellproblem|lieferproblem
516 :: untergang Sendung :: untergang|untergegangen|vernichtet|totalschaden|von_der_post_zerstört; @paket zerstört|vernichtet|totalschaden
517 :: Postschaden :: postschaden|transportschaden|versandschaden|transportbeschädigung; @post @kaputt; beim_transport|auf_dem_transport|durch_die_post|von_der_post @kaputt
50414 :: Offene Aufträge und Produktionsablauf :: produktion|produziert|produktionszeit schon|=seit|dauert|lange|wann|immer_noch|noch_nicht|stand !stornier|storno|annull|abbrechen|rückgängig|ändern|widerruf; offene_aufträge|offener_auftrag|offene_bestellung|offene_bestellungen|produktionsablauf|produktionsstatus|in_produktion|noch_in_produktion|produziert|wann_wird_produziert|produktion_dauert

## Mechanical Damage & Technical Faults
3725 :: Herstellung Maschinenfehler Fehlende Düse (Canon) :: düse|düsen|fehlende_düse|canon; feine_weisse_linien|feine_linien|weisse_linien|weisse_striche|dünne_linien
3726 :: Herstellung Maschinenfehler Kompensierte Düse (Canon) :: kompensiert|kompensierte|düse|düsen|canon
3727 :: Herstellung Maschinenfehler Weisse Flecken :: weisse_flecken|weisse_punkte|weisser_fleck|weisse_stellen|helle_flecken|helle_punkte|weisse_pünktchen
333 :: Herstellung mech. Beschädigung Banane :: banane|bananenform|bananenförmig; durchgebogen|gebogen|verbogen|krumm|nicht_gerade|wölbt|gewölbt|verzogen @buch|@cover|@kalender|einband
334 :: Herstellung mech. Beschädigung Buchrücken :: buchrücken|rücken @kaputt|@riss|gebrochen|delle|knick|eingedrückt|gestaucht|verformt; buchrücken
335 :: Herstellung mech. Beschädigung Cover :: @cover @kaputt|delle|macke|druckstelle|eingedrückt|beule|dellen|abgestossen; coverschaden|coverbeschädigung
336 :: Herstellung mech. Beschädigung Cover Kerbe vom Einlagern :: kerbe|kerben|einkerbung|rille|rillen|abdruck|druckstelle|eindruck|eindrücke @cover; kerbe|kerben|einkerbung
337 :: Herstellung mech. Beschädigung Coverecke beschädigt :: coverecke|buchecke|coverecken; @ecke @cover|@buch|einband @kaputt|eingedrückt|gestaucht|abgestossen|umgebogen|geknickt|verbogen|stumpf
338 :: Herstellung mech. Beschädigung Falte im Laminat :: laminat|folie|kaschierung|laminierung falte|falten|faltig|runzel|runzelig|zerknittert|knitter|welle; falte_im_laminat|falte_in_der_folie
339 :: Herstellung mech. Beschädigung Falte im Papier :: falte|falten|faltig|knitter|zerknittert papier|@seite; falte_im_papier; falte|faltig
340 :: Herstellung mech. Beschädigung Knicke vom Einpacken :: @knick einpacken|eingepackt|verpackung|verpackt|verpacken; knicke_vom_einpacken
341 :: Herstellung mech. Beschädigung Nähfehler :: naht|nähte|genäht|nähfehler|fadenheftung|fadenbindung|heftung|faden|nähen|fadengeheftet
342 :: Herstellung mech. Beschädigung Seite eingerissen :: @seite eingerissen|gerissen|zerrissen|einriss|=riss|ausgerissen; eingerissen|einriss
343 :: Herstellung mech. Beschädigung Seite geknickt :: @seite @knick; eselsohr|eselsohren|seite_geknickt|seiten_geknickt|umgeknickt
344 :: Herstellung mech. Beschädigung Seitenrand beschädigt :: seitenrand|seitenränder|blattrand|papierrand @kaputt|@riss|ausgefranst|gestaucht|eingedrückt|wellig|knick; @seite rand|ränder|kante @kaputt|gestaucht|eingedrückt|eingerissen
345 :: Herstellung mech. Beschädigung Vorsatz beschädigt :: vorsatz|vorsatzpapier|vorsatzblatt|vorsatzseite|innendeckel|innenumschlag @kaputt|@riss|@knick; vorsatz
346 :: Herstellung mech. Beschädigung Vorsatz verschmutzt :: vorsatz|vorsatzpapier|innendeckel|innenumschlag @schmutz|leim|kleber|klebereste|klebstoff
3710 :: Herstellung Maschinenfehler Eine Seite spaltet sich :: spaltet|gespalten|spaltung|delaminiert|delamination|trennt_sich|schichten_lösen|löst_sich_in_schichten|aufgespalten|blättert_auf|seite_teilt_sich
3711 :: Herstellung Maschinenfehler Cover Luftblase :: luftblase|luftblasen|bläschen|blase|blasen @cover|folie|laminat|umschlag; luftblase|luftblasen
3712 :: Herstellung Maschinenfehler Eine Seite geknickt :: @seite @knick; seite_geknickt|eine_seite_geknickt
3713 :: Herstellung Maschinenfehler Farbe stimmt nicht :: ^farb @falsch|stimmt_nicht|stimmen_nicht|abweichend|anders|dunkler|heller|zu_dunkel|zu_hell|verfälscht|daneben|komisch|seltsam; farbstich|blaustich|rotstich|grünstich|gelbstich|magentastich|farbabweichung|farbabweichungen|farbverfälschung|farben_stimmen_nicht|farbe_stimmt_nicht
3714 :: Herstellung Maschinenfehler Inhalt schräg eingehängt :: schräg|schief|verschoben inhalt|buchblock|eingehängt|eingebunden|block; schräg_eingehängt|schief_eingehängt|schief_eingebunden|buchblock_schief|inhalt_schief|schräg_eingebunden
3715 :: Herstellung Maschinenfehler Kante beschädigt :: kante|kanten|kantenschaden @kaputt|abgestossen|angeschlagen|eingedrückt|bestossen|abgeplatzt|ausgefranst|gestaucht; kante_beschädigt|kanten_beschädigt
3716 :: Herstellung Maschinenfehler Leere Seiten :: @leer @seite; leere_seiten|leere_seite
3717 :: Herstellung Maschinenfehler Lochung falsch/fehlt :: lochung|gelocht|aufhängeloch|lochstanzung|stanzung|=löcher|=loch @falsch|@fehlt|schief|verschoben|=nicht; lochung|aufhängeloch
3718 :: Herstellung Maschinenfehler Schnittkante ausgefranst :: ausgefranst|franst|fransig|fransen|faserig|unsauber_geschnitten|schnittkante|ausgefasert
3719 :: Herstellung Maschinenfehler Schräg gefaltet :: schräg_gefaltet|schief_gefaltet|falz_schief|falz_nicht_mittig|falsch_gefaltet|ungerade_gefaltet|falzung; =falz|falzung|gefaltet|faltung schräg|schief|ungerade|nicht_mittig|verschoben|daneben
3720 :: Herstellung Maschinenfehler Seiten beschädigt :: @seite @kaputt; seiten_beschädigt|seite_beschädigt
3721 :: Herstellung Maschinenfehler Seiten kopfüber :: kopfüber|auf_dem_kopf|kopfstehend|steht_kopf|verkehrt_herum|falsch_herum|upside|umgedreht|180_grad
3722 :: Herstellung Maschinenfehler Sortierfehler Identpage eingebunden :: identpage|ident_page|identseite|identblatt|auftragsblatt|laufzettel|barcodeseite|barcode|strichcode|interne_seite|seite_mit_barcode|seite_mit_nummer|datenblatt_eingebunden
3723 :: Herstellung Maschinenfehler Vorsatz löst sich :: vorsatz|vorsatzpapier|vorsatzblatt|innendeckel @lose|abgelöst|klebt_nicht|hält_nicht; vorsatz_löst
3724 :: Herstellung Maschinenfehler Banding :: banding|bandingeffekt; @streifen @seite|@buch|@kalender|@cover|druck
332 :: Herstellung mech. Beschädigung :: mechanisch|mechanische|mech_beschädigung|druckstelle|druckstellen|delle|dellen|beule|beulen|macke|macken|abgeschürft|abschürfung|eingedrückt|stossstelle
3704 :: Herstellung Produkt Maschinenfehler :: maschinenfehler|maschinenproblem|technischer_fehler|druckmaschine|maschine
3728 :: Herstellung Maschinenfehler RIP Fehler (Canon) :: =rip|ripfehler|rip_fehler|rasterfehler|raster_fehler|rasterung; canon; fehlende_elemente|elemente_fehlen|pixelblöcke|datenmüll|kryptische_zeichen druck|gedruckt|@seite

# Finance
## Credit & Risk
50102 :: Betreibung :: betreibung|betreibungsamt|betrieben|zahlungsbefehl|inkasso|inkassobüro|inkassofirma|intrum|lowell|rechtsvorschlag|mahnverfahren|betreibungsregister|betreibungsauskunft
50107 :: Bonität :: bonität|bonitätsprüfung|kreditwürdigkeit|kreditprüfung|crif|schufa; @rechnung zahlungsart|bezahlen|bezahlung|bestellen|kauf|option|zahlungsmöglichkeit nicht_möglich|abgelehnt|nicht_angeboten|nicht_verfügbar|nicht_mehr|verweigert|gesperrt|@fehlt|nicht_angezeigt; nur_vorauskasse|keine_rechnung_möglich|nicht_auf_rechnung|auf_rechnung_nicht|kauf_auf_rechnung

## Discounts & Adjustments
50111 :: Mengenrabatt :: mengenrabatt|staffelrabatt|staffelpreis|staffelpreise|grossbestellung|grossmenge|firmenbestellung|firmenkunde|firmenkunden|b2b; @rabatt viele|mehrere|menge|exemplare|stück|grosse_menge|anzahl
50112 :: Rabatt Kulanz :: kulanzrabatt|kulanzgutschein|entschädigung|entschädigen|wiedergutmachung|kompensation|entgegenkommen|goodwill; @rabatt|@gutschein kulanz|entschädigung|entschuldigung|ärger|unzufrieden|wiedergutmachung

## Payments & Balances
50104 :: Rückerstattung :: geld|betrag|rückerstattung|erstattung|gutschrift =kein|=nicht|noch_nicht|=nie|nichts eingegangen|erhalten|bekommen|gutgeschrieben|angekommen|zurück|überwiesen; doppelt_bezahlt|zweimal_bezahlt|doppelt_überwiesen|zweimal_überwiesen|zu_viel_bezahlt|zuviel_bezahlt; rückerstattung|zurückerstatten|zurückerstattet|erstattung|erstatten|erstattet|geld_zurück|zurückzahlen|rückzahlung|refund|rückbuchung|zurückbuchen|zurücküberweisen|gutschrift_auf|mein_geld
50106 :: Mahnsperre :: mahnsperre; mahnung stoppen|sperren|pausieren|aussetzen|zurückhalten|anhalten|stornieren; keine_mahnung|keine_mahnungen|zahlungsaufschub|fristverlängerung|zahlungsfrist_verlängern|frist_verlängern|später_zahlen|später_bezahlen|stundung|mehr_zeit_zum_zahlen
50108 :: Bankangaben :: bankangaben|bankverbindung|iban|kontonummer|bankdaten|kontoangaben|kontodaten|swift|=bic|bankkonto|clearing|clearingnummer|postkonto
50109 :: Auskunft Guthaben /Gutschrift :: guthaben|gutschrift|restguthaben|saldo|kontostand|gutgeschrieben|kundenguthaben|restbetrag
50110 :: Ratenzahlung :: ratenzahlung|=raten|in_raten|teilzahlung|teilzahlungen|abzahlen|ratenweise|monatlich_zahlen|monatliche_zahlung|abstottern|ratenplan
9102 :: Mahnung erhalten :: mahnung|mahnungen|zahlungserinnerung|gemahnt|mahngebühr|mahngebühren|mahnspesen|mahnbrief|letzte_mahnung; mahnung|mahnungen|zahlungserinnerung|gemahnt|mahnbrief obwohl|bereits|schon|bezahlt|überwiesen

## Invoicing & Billing
50114 :: Rechnung per E-Mail nicht angekommen :: @rechnung @email @nichterh; @rechnung @nichterh; @rechnung per_mail|per_email|=keine|@fehlt !zusenden|schicken|senden|benötige|brauche|kopie|ausstellen|erstellen|korrigier; keine_rechnung|rechnung_fehlt|rechnung_nicht_erhalten|rechnung_nicht_bekommen
50103 :: Rechnungskorrektur :: rechnungskorrektur|rechnung_korrigieren|korrigierte_rechnung|rechnung_ändern|rechnung_anpassen|neue_rechnung; @rechnung @falsch|fehlerhaft|korrigieren|korrektur|ändern|anpassen|stimmt_nicht|zu_hoch|doppelt|mwst|mehrwertsteuer|rechnungsadresse|firmenname|firma|firmenadresse|auf_die_firma|auf_unsere_firma
50105 :: Rechnungsstatus :: rechnungsstatus|zahlungseingang|zahlung_eingegangen|zahlung_erhalten|ist_bezahlt|schon_bezahlt|bereits_bezahlt|habe_bezahlt|habe_überwiesen|ob_bezahlt|offene_rechnung|offener_betrag|noch_offen; @rechnung status|offen|bezahlt|beglichen|eingegangen
50113 :: E-Rechnung (Bank) :: e_rechnung|erechnung|ebill|e_bill|ebanking|e_banking|onlinebanking|online_banking|=lsv|debit_direct|lastschrift|lastschriftverfahren|elektronische_rechnung
6251 :: Rechnung ausstellen :: @rechnung firmenadresse|auf_die_firma|auf_unsere_firma|firmenrechnung|=firma|spesenabrechnung|buchhaltung; rechnung_ausstellen|rechnung_erstellen|rechnungskopie|rechnungsduplikat|kopie_der_rechnung|kopie_rechnung|duplikat|quittung|zahlungsbeleg|kaufbeleg|spesen; @rechnung ausstellen|erstellen|schicken|senden|zusenden|benötige|brauche|kopie|nochmals|erneut

## Payment Methods & Issues
50201 :: Kreditkartenprobleme :: @kreditkarte; @kreditkarte @fehler|abgelehnt|ungültig|belastet|abgebucht|3d|sicherheitscode|=cvc|=cvv; zahlung_abgelehnt|karte_wird_nicht_akzeptiert
50202 :: PayPal Probleme :: paypal|pay_pal *0.7; paypal|pay_pal @fehler|abgelehnt|fehlgeschlagen|abgebrochen|belastet|abgebucht|konto
50203 :: Reservierung/Autorisierung :: reservierung|reserviert|autorisierung|autorisiert|vorautorisierung|blockiert|vorgemerkt|pending|ausstehende_zahlung|doppelt_belastet|zweimal_belastet|doppelte_belastung|doppelt_abgebucht|zweimal_abgebucht|zwei_mal_abgebucht|betrag_reserviert
50204 :: Direct Payment :: direct_payment|directpayment|direktzahlung|direkte_zahlung|postfinance|post_finance|e_finance|efinance|sofortüberweisung|sofort_überweisung
50206 :: Zahlungsmöglichkeiten :: zahlungsmöglichkeit|zahlungsmöglichkeiten|zahlungsart|zahlungsarten|zahlungsmittel|bezahlmöglichkeit|bezahlmöglichkeiten|zahlungsoption|zahlungsoptionen|vorauskasse|nachnahme|barzahlung|bar_bezahlen; =wie|womit|kann_ich_mit bezahlen|=zahlen
50207 :: Gutschein zur Bestellung hinzufügen :: @gutschein nachträglich|vergessen|hinzufügen|nachtragen|anrechnen|abziehen|berücksichtigen|bereits_bestellt|schon_bestellt|nicht_eingegeben|nicht_eingelöst|nicht_abgezogen; gutschein_vergessen|nachträglich_gutschein|gutschein_nachträglich
50205 :: Twint Probleme :: twint *0.7; twint @fehler|abgelehnt|fehlgeschlagen|abgebrochen|belastet|abgebucht
50208 :: Klarna-Zahlung fehlgeschlagen :: klarna *0.8; klarna @fehler|abgelehnt|fehlgeschlagen|abgebrochen|nicht_möglich

# Product & Tech
## Errors & Complaints
20101 :: Fehler Installation / Deinstallation :: installier|installation|deinstallation|installer|setup @fehler; lässt_sich_nicht_installieren|installation_fehlgeschlagen|installation_bricht_ab|kann_nicht_installieren|nicht_deinstallieren
20102 :: Software crash :: @absturz; @software @absturz
20103 :: Software startet nicht :: @software @nichtoeffnen; startet_nicht|startet_nicht_mehr|lässt_sich_nicht_starten|programm_öffnet_nicht|software_öffnet_nicht|app_öffnet_nicht|kann_nicht_starten
20104 :: Softwareversion veraltet :: softwareversion|alte_version|veraltete_version|veraltet|neueste_version|aktuelle_version|neue_version|versionsnummer !@absturz !@fehler; @software version|update|aktualisieren !@absturz !@fehler
20105 :: Fehler Software Update :: update|updaten|aktualisierung|aktualisieren @fehler|=nach|=seit|bricht_ab; updatefehler|update_fehlgeschlagen|nach_dem_update|=seit_dem_update|=seit_update|nach_update
20106 :: Probleme Virenscanner :: virenscanner|antivirus|antivir|=virus|=viren|virenschutz|firewall|defender|norton|avast|kaspersky|mcafee|avira|bitdefender|=eset|quarantäne|trojaner|malware|sicherheitssoftware|smartscreen
20201 :: Defekte Daten :: defekte_daten|daten_defekt|daten_beschädigt|daten_kaputt|datei_beschädigt|datei_defekt|datei_kaputt|korrupt|corrupt|beschädigte_datei; =daten|=datei|projektdatei @kaputt
20202 :: Eigene Vorlagen erstellen / verwenden :: eigene_vorlage|eigene_vorlagen|eigenes_template|eigene_templates|eigenes_layout|vorlage_speichern|vorlage_erstellen|als_vorlage|layout_speichern|vorlage_wiederverwenden
20203 :: Konvertierungsprobleme :: konvertierung|konvertieren|konvertiert|konvertierungsfehler|umwandeln|umgewandelt|umwandlung|konverter
20204 :: Photobook Assistent :: assistent|fotobuch_assistent|fotobuchassistent|photobook_assistent|automatisch_befüllen|automatisch_erstellen|automatische_gestaltung|autofill|automatisch_gefüllt
20205 :: Photobook Sharing :: sharing|teilen|geteilt|freigeben|freigabe|=share|gemeinsam_gestalten|zusammen_gestalten|einladen|eingeladen @fehler; photobook_sharing|fotobuch_teilen|projekt_teilen
20206 :: Projekt ist leer :: projekt_ist_leer|projekt_leer|leeres_projekt|projekt_ohne_bilder|alle_bilder_weg|alle_bilder_verschwunden|inhalt_weg|alles_weg|alles_verschwunden|bilder_verschwunden; @projekt @leer
20207 :: Projekt kann nicht geöffnet werden :: @projekt @nichtoeffnen; projekt_öffnet_nicht|projekt_nicht_öffnen|projekt_lässt_sich_nicht
20208 :: Projekte werden nicht gefunden / angezeigt :: @projekt finden|gefunden|finde|angezeigt|verschwunden|=weg|verloren|nicht_mehr_da|gelöscht|sehe|sichtbar; projekt_verschwunden|projekte_verschwunden|finde_mein_projekt|finde_projekt|projekt_weg|projekte_weg|projekt_gelöscht
20209 :: Projektverwaltung :: projektverwaltung|projekte_verwalten|projekt_verwalten; @projekt kopieren|duplizieren|umbenennen|löschen|verschieben|übertragen|exportieren|sichern|backup|anderen_computer|neuen_computer|anderes_gerät
20301 :: Fehler Bilder bearbeiten :: @bild bearbeiten|bearbeitung|zuschneiden|drehen|spiegeln|filter @fehler; bildbearbeitung @fehler
20302 :: Fehler Bilder einfügen :: @bild einfügen|hinzufügen|importieren|reinziehen|ziehen|platzieren|=laden|importiert @fehler|@absturz
20303 :: Fehler Bildoptimierung :: bildoptimierung|optimierung|autokorrektur|automatische_korrektur|optimieren|bildverbesserung @fehler; bildoptimierung
20304 :: Defekte Bilddateien :: bilddatei|bilddateien|=jpg|=jpeg|=png|=heic|=tif|=tiff|=raw|=nef|=cr2 @kaputt|@fehler|nicht_lesbar|nicht_unterstützt|nicht_erkannt; defekte_bilddatei|defekte_bilddateien|bilder_defekt|beschädigte_bilder|bild_beschädigt
20305 :: Fehler Effekte :: effekt|effekte|filter|schwarz_weiss|schwarzweiss|sepia|schatten|vignette @fehler|@falsch; effekte
20306 :: Fehlerhafte Darstellung Bilder :: @bild darstellung|angezeigt|anzeige|dargestellt|erscheinen|schwarz|grau|verzerrt|nicht_richtig_angezeigt; bilder_werden_nicht_angezeigt|bilder_nicht_sichtbar|darstellungsfehler|fehlerhafte_darstellung|graue_bilder|schwarze_bilder
20308 :: Fehler Bild hochladen :: @hochladen @bild|@fehler|abbruch|bricht_ab|dauert|langsam; bilder_hochladen|fotos_hochladen|upload_fehler|uploadfehler
20309 :: Fehler Zugriff Ordner :: zugriff|zugreifen|berechtigung ordner|verzeichnis|laufwerk|bilderordner|fotoordner|dateien; zugriff_verweigert|kein_zugriff|keinen_zugriff|ordner_nicht_gefunden|ordner_nicht_angezeigt|ordner_leer|findet_ordner|finde_ordner
20401 :: Fehler eigene Schriften :: schrift|schriften|schriftart|schriftarten|=font|=fonts eigene|eigenen|installiert|installierte|heruntergeladen|@fehlt|nicht_verfügbar|nicht_angezeigt|erscheint_nicht; eigene_schrift|eigene_schriften|eigene_schriftart|eigene_fonts
20402 :: Fehler Rechtschreibkorrektur :: rechtschreibkorrektur|rechtschreibprüfung|rechtschreibkontrolle|autokorrektur|wellenlinie|rot_unterstrichen|spellcheck|wörterbuch
20403 :: Fehler Texte bearbeiten :: @text bearbeiten|ändern|editieren|löschen|korrigieren|anpassen|markieren @fehler; text_lässt_sich_nicht|kann_text_nicht
20404 :: Fehler Texte erstellen :: @text erstellen|einfügen|hinzufügen|schreiben|tippen|eingeben @fehler; kein_textfeld|textfeld_fehlt|kann_keinen_text|kann_nichts_schreiben
20405 :: Fehler Textformatierung :: textformatierung|formatierung|formatieren|=fett|kursiv|schriftgrösse|schriftfarbe|zeilenabstand|unterstreichen|zentrieren @fehler
20501 :: Vorschau Elemente fehlen :: @vorschau @fehlt|nicht_sichtbar|nicht_angezeigt|^leer|elemente|=weg|verschwunden
20502 :: Vorschau falsche Schnittdarstellung :: @vorschau schnitt|beschnitt|abgeschnitten|schnittdarstellung|=rand|ränder|schnittlinie|beschnittzugabe
20503 :: Vorschau falsche Darstellung :: @vorschau @falsch|anders|stimmt_nicht|nicht_korrekt|verzerrt|fehlerhaft|komisch|seltsam|darstellung; vorschaufehler
20802 :: Auftragsdaten fehlen :: auftragsdaten|bestelldaten|druckdaten @fehlt|nicht_angekommen|nicht_übermittelt|nicht_erhalten; daten_nicht_übermittelt|daten_nicht_angekommen|keine_daten|daten_fehlen
20803 :: Auftragsdaten ohne Bilder :: auftragsdaten|bestelldaten|druckdaten|bestellung|=auftrag ohne_bilder|keine_bilder|bilder_fehlen|ohne_fotos|keine_fotos; bestellung_ohne_bilder|auftrag_ohne_bilder|daten_ohne_bilder
20804 :: Auftragsdaten unvollständig / defekt :: auftragsdaten|bestelldaten|druckdaten unvollständig|defekt|beschädigt|kaputt|fehlerhaft|korrupt
20805 :: Differenz Auftragsbestätigung :: auftragsbestätigung|bestellbestätigung|bestätigung differenz|stimmt_nicht|@falsch|anders|abweichung|unterschied|abweichend|nicht_korrekt|=fehler
20806 :: eBook-Link nicht erhalten :: @ebook link|mail|email|downloadlink @nichterh|@fehlt|=kein|=keinen; @ebook @nichterh
20807 :: eBook-Link ohne Download Verknüpfung :: @ebook download|herunterladen|downloaden|downloadlink|link @fehler|@fehlt|=kein|=keine|=ohne; ebook_ohne_download
20901 :: eBook Vorschaufehler :: @ebook @vorschau
20902 :: eBook Fehlermeldung :: @ebook fehlermeldung|=fehler|=error|=meldung|@nichtoeffnen
20903 :: eBook Metadaten :: @ebook metadaten|=titel|autor|isbn|beschreibung|informationen|dateiname; metadaten
21001 :: Login Fehlermeldung :: @login @fehler; kann_mich_nicht_einloggen|kann_mich_nicht_anmelden|login_geht_nicht|login_fehler|einloggen_nicht_möglich|anmeldung_nicht_möglich|nicht_einloggen
21002 :: Login Produkte fehlen :: @login projekte|produkte|bestellungen|bestellhistorie|fotobücher|daten @fehlt|=weg|verschwunden|nicht_sichtbar|nicht_angezeigt|^leer
21003 :: Login Produkte überschrieben :: überschrieben|überschreiben|alte_version_gespeichert|änderungen_weg|änderungen_verloren|änderungen_nicht_gespeichert|arbeit_verloren
21004 :: Login Registrierungsprobleme :: registrierung|registrieren|registriert|registrierungsmail|konto_erstellen|account_erstellen|konto_eröffnen|neues_konto|bestätigungsmail|aktivierungsmail|aktivierungslink|bestätigungslink|verifizierung|verifizieren
21005 :: Login Passwortprozess :: passwort|kennwort|password|passwort_vergessen|passwort_zurücksetzen|neues_passwort|reset_link|passwort_ändern
20210 :: Layout fehlerhaft :: layout|layouts @fehler|fehlerhaft|kaputt|verschoben|durcheinander|zerschossen|@falsch; layoutfehler|layout_fehlerhaft|layout_kaputt
10125 :: Bilder/Texte zu weit vom Rand :: zu_weit_vom_rand|zu_weit_weg_vom_rand|zu_viel_rand|zu_viel_abstand|abstand_zu_gross|rand_zu_breit|rand_zu_gross|breiter_rand|breiten_rand|grosser_rand|weisser_rand|weissen_rand|zu_weit_innen
10126 :: Falsches Layout :: falsches_layout|falsche_vorlage|anderes_layout|layout_falsch|falsche_seitenaufteilung; layout @falsch|anders|nicht_wie|nicht_gewählt
10127 :: Vorschau :: sieht_anders_aus|anders_als_vorschau|anders_als_in_der_vorschau|nicht_wie_vorschau|nicht_wie_in_der_vorschau|nicht_wie_am_bildschirm|am_bildschirm|auf_dem_bildschirm|bildschirm_anders|monitor; @vorschau anders|abweichend|abweichung|nicht_wie|stimmt_nicht_überein|unterschied
10128 :: Material :: material|papier|papierqualität|papierart|leinwand|stoff|karton|haptik @falsch|erwartet|=dünn|=dick|billig|minderwertig|enttäuscht|enttäuschend|qualität|unzufrieden; materialqualität
10129 :: Oberfäche :: oberfläche|matt|glänzend|glanz|hochglanz|seidenmatt|spiegelt|spiegelung|reflektiert|reflexion|struktur @falsch|erwartet|stark|unzufrieden|enttäuscht|gefällt_nicht; oberfläche
10101 :: Aufnahme Unschärfe :: @unscharf aufnahme|originalbild|original|handy|kamera|handyfoto|smartphone|fotografiert !original_war_scharf|original_ist_scharf|original_scharf|originalbild_scharf|original_gestochen_scharf|am_bildschirm_scharf; verwackelt|aufnahme_unscharf|foto_unscharf|originalfoto_unscharf|unscharf_aufgenommen
10103 :: Bilder/Texte fehlen :: @bild|@text @fehlt; bilder_fehlen|texte_fehlen|text_fehlt|bild_fehlt|fehlende_bilder|fehlender_text
10104 :: Bildausschnitt :: bildausschnitt|ausschnitt|abgeschnitten|zugeschnitten|beschnitten|angeschnitten|=crop; kopf_abgeschnitten|köpfe_abgeschnitten|füsse_abgeschnitten|personen_abgeschnitten|gesicht_abgeschnitten|halb_abgeschnitten; kopf|köpfe|füsse|gesicht|gesichter|personen|person|=arm|=arme|beine abgeschnitten|angeschnitten|beschnitten
10106 :: Falsches Bild :: falsches_bild|falsches_foto|falsche_bilder|falsche_fotos|anderes_bild|anderes_foto|bild_vertauscht|bilder_vertauscht|nicht_das_richtige_bild|falsches_motiv
10114 :: Kalender falscher Startmonat :: startmonat|anfangsmonat|beginnt_mit|startet_mit|fängt_mit|falscher_monat|falsches_jahr|falscher_startmonat; @kalender =monat|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|jahr|jahreszahl @falsch|beginnt|startet|statt|anstatt|=fängt|anfängt|anfangen
10115 :: Leere Seiten :: @leer @seite; leere_seiten|leere_seite
10116 :: Leinwand Rahmenvorschau :: leinwand|keilrahmen|=canvas vorschau|gespiegelt|spiegelung|umlauf|seitenkante|seitenkanten|kantengestaltung|kantenmotiv|um_die_kante|über_die_kante; rahmenvorschau|kantengestaltung
10117 :: Rahmengestaltung :: rahmengestaltung|bilderrahmen|passepartout|umrandung|rahmendesign|dekorahmen; =rahmen gestaltung|farbe|design|gewählt|anders|=dick|=dünn
10118 :: Rechtschreibefehler :: rechtschreibfehler|rechtschreibefehler|rechtschreibung|tippfehler|schreibfehler|falsch_geschrieben|buchstabendreher|=typo|vertippt|verschrieben|grammatikfehler
10119 :: Speicherfrist abgelaufen :: speicherfrist_abgelaufen|nicht_mehr_gespeichert|daten_gelöscht|bestellung_gelöscht|daten_nicht_mehr|bereits_gelöscht; @projekt|=daten|@bestellung gelöscht|abgelaufen|nicht_mehr_verfügbar; speicherfrist
10120 :: Textausrichtung :: textausrichtung|ausrichtung; @text schief|schräg|zentriert|nicht_zentriert|ausgerichtet|verschoben|linksbündig|rechtsbündig|mittig|verrutscht
10121 :: Textformatierung :: textformatierung; @text formatierung|schriftgrösse|schriftart|=fett|kursiv|zu_klein|zu_gross|schriftfarbe|zeilenabstand|lesbar|unleserlich
10122 :: Variable Bildlänge :: variable_bildlänge|bildlänge|variable_länge|panorama|panoramabild|panoramafoto|überlänge
10201 :: Softwarefehler - Bilder gedreht :: gedreht|verdreht|rotiert|hochkant|um_90_grad|auf_der_seite|quer_statt_hoch|hoch_statt_quer; @bild gedreht|verdreht|rotiert|gekippt|liegen|umgedreht
10202 :: Softwarefehler - Bilder gezoomt :: gezoomt|reingezoomt|herangezoomt|=zoom|vergrössert|zu_stark_vergrössert|zu_nah; @bild gezoomt|vergrössert|zu_gross|ausschnitt
10205 :: Softwarefehler - Bilder verzerrt :: verzerrt|gestreckt|in_die_länge_gezogen|breitgezogen|in_die_breite|proportion|proportionen; @bild verzerrt|gestreckt|gestaucht|verzogen
10207 :: Softwarefehler - Bildformat :: bildformat|seitenverhältnis|4_3|3_2|16_9|hochformat|querformat|quadratisch|format_falsch; @bild =format|hochformat|querformat
10208 :: Softwarefehler - Doppelte Bilder :: doppelte_bilder|doppeltes_bild|bild_doppelt|bilder_doppelt|foto_doppelt|fotos_doppelt|zweimal_das_gleiche|gleiche_bild|gleiches_bild|dasselbe_bild|selbe_bild; @bild doppelt|zweimal|mehrfach
10209 :: Softwarefehler - eBook :: @ebook @fehler|softwarefehler|@falsch|kaputt
10212 :: Softwarefehler - Leere Seiten :: @leer @seite; softwarefehler|@software ^leer
10214 :: Softwarefehler - Rote Augen Korrektur :: rote_augen|rotaugen|augen_rot|rotaugeneffekt|augenkorrektur
10215 :: Softwarefehler - Templatefehler :: templatefehler|vorlagenfehler; template|vorlage|vorlagen @fehler|@falsch|softwarefehler
10217 :: Softwarefehler - Bilder/Texte Platzierung :: platzierung|platziert|position|positioniert|verschoben|verrutscht|versetzt @bild|@text; softwarefehler platzierung|verschoben|verrutscht
10218 :: Softwarefehler - Transparente falsch :: transparent|transparenz|transparente|durchsichtig|freigestellt; =png hintergrund|weiss|schwarz
10123 :: Bilder/Texte zu nahe am Rand :: zu_nahe_am_rand|zu_nah_am_rand|zu_knapp|nah_am_rand|nahe_am_rand|am_rand_abgeschnitten|text_abgeschnitten|abgeschnittener_text|sicherheitsabstand|sicherheitsrand|randabstand|beschnittzugabe|im_falz|in_der_bindung|in_der_mitte_verschwunden|verschwindet_in_der_mitte|im_bund|bundsteg|mittelfalz|buchmitte; @bild|@text =rand|=falz|bindung|mitte abgeschnitten|verschluckt|verschwunden|zu_nah|zu_nahe|zu_knapp
10102 :: Bilder/Texte Platzierung :: platzierung|platziert|position|positioniert|verschoben|verrutscht|versetzt|angeordnet|anordnung @bild|@text; falsch_platziert|falsche_position|an_falscher_stelle|falscher_stelle
10105 :: Bilder Auflösung :: auflösung|pixel|pixelich|niedrige_auflösung|geringe_auflösung|grobpixelig|treppchen|=dpi|warndreieck|qualitätswarnung|ampel|rote_ampel|gelbe_ampel|whatsapp; @bild =klein|pixel|auflösung|=schlecht
10107 :: Bildoptimierung Hintergrund :: hintergrund optimierung|optimiert|verändert|anders|farbe|aufgehellt|verfärbt|korrigiert; hintergrundoptimierung
10108 :: Bildoptimierung Bild :: bildoptimierung|optimiert|automatisch_korrigiert|automatisch_verbessert|bildverbesserung|autokorrektur|nachbearbeitet|farben_verändert|viesus; @bild verändert|optimiert|bearbeitet|korrigiert|aufgehellt
10109 :: Bildrauschen :: rauschen|bildrauschen|verrauscht|körnig|grobkörnig|körnung|=noise|griesselig|grieselig|krisselig
10110 :: Buchbindung :: buchbindung|bindungsart|bindeart; bindung @falsch|anders|gewählt|erwartet|nicht_wie|gefällt; falsche_bindung|andere_bindung
10111 :: Falscher Farbraum/Profil :: farbraum|farbprofil|=cmyk|=rgb|adobe_rgb|=srgb|=icc|icc_profil|farbmanagement|=profil
10112 :: Falsches Produkt :: falsches_produkt|falsche_grösse|falsches_format|falscher_artikel|anderes_produkt; @falsch produkt|=format|grösse|artikel gewählt|ausgewählt|bestellt|erwischt
10113 :: Kalendarium :: kalendarium|feiertage|wochentage|kalenderwoche|kalenderwochen|=kw|=geburtstage|=geburtstagen|geburtstagskalender|mondphasen|schulferien|namenstage; @kalender =datum|feiertage|feiertag|wochentage|wochentag|kalendertage|geburtstag|geburtstage|=daten
10203 :: Softwarefehler - Bilder nicht in Vorschau :: @bild @vorschau =nicht|@fehlt|nicht_angezeigt|nicht_sichtbar|^leer|grau !gedruckt|druck|buch_fehlt|im_buch; nicht_in_der_vorschau|nicht_in_vorschau
10204 :: Softwarefehler - Bilder unvollständig :: @bild unvollständig|=halb|teilweise|nur_halb|grauer_balken|graue_fläche|abgebrochen|nicht_komplett|zur_hälfte; bild_unvollständig|bilder_unvollständig|halbes_bild
10206 :: Softwarefehler - Bilder/Texte fehlen :: @bild|@text @fehlt; softwarefehler @fehlt; @bild|@text @fehlt @vorschau war|da|sichtbar|vorhanden|drin|angezeigt|korrekt|richtig
10210 :: Softwarefehler - Kalendarium :: kalendarium softwarefehler|@fehler|@falsch|verschoben; @kalender feiertage|wochentage|datum|=tage verschoben|@falsch
10211 :: Softwarefehler - Layout verschoben :: layout_verschoben|layout_verrutscht|alles_verschoben|elemente_verschoben|layout_zerschossen; layout verschoben|verrutscht|durcheinander
10213 :: Softwarefehler - QR Code :: qr_code|qrcode|=qr|qr_codes
10216 :: Softwarefehler - Textausrichtung :: @text schief|verschoben|ausrichtung|ausgerichtet|verrutscht|zentriert softwarefehler|@fehler; textausrichtung
371 :: Softwarefehler Bildfehler :: bildfehler; softwarefehler|software @bild; @bild artefakt|artefakte|grafikfehler|glitch|bildstörung|kaputt_gedruckt
372 :: Softwarefehler Schnittfehler :: schnittfehler; softwarefehler|software schnitt|beschnitt|abgeschnitten|schnittlinie; schnittlinie|schnittmarke|schnittmarken|beschnittlinie
373 :: Softwarefehler Templatefehler :: templatefehler|vorlagenfehler; template|vorlage|vorlagen|designvorlage @fehler|@falsch|verschoben; softwarefehler template|vorlage
441 :: Auftrag variable Bildlänge :: variable_bildlänge|bildlänge|variable_länge|panorama|panoramabild|panoramafoto|überlänge|sonderlänge

## Software Usage & Settings
30101 :: Betriebssystem veraltet :: betriebssystem|=os|windows|macos|mac_os|osx|=ios|android|vista|=xp|catalina|mojave|sierra|big_sur|monterey|ventura|linux|chromebook veraltet|=alt|=alte|älter|unterstützt|kompatibel|version|mindestanforderung|systemanforderung|voraussetzung; systemanforderungen|systemvoraussetzungen|windows_7|windows_8|windows_xp; betriebssystem
30102 :: Browserversion veraltet :: browser|chrome|firefox|safari|=edge|internet_explorer|opera|webbrowser veraltet|=alt|=alte|version|unterstützt|kompatibel|aktualisieren|update; browserversion|browser_veraltet|anderen_browser
30103 :: Installation :: installier|installation|herunterladen|download|downloaden @software|@wie !@fehler !@absturz; wo_herunterladen|wie_installieren|software_herunterladen|designer_herunterladen; installation
30104 :: Länder- und Sprachwechsel :: sprache|=land|länder|=shop|währung|landesversion|länderversion|domain wechseln|ändern|umstellen|@falsch|wechsel; sprachwechsel|länderwechsel|landeswechsel|sprache_ändern|sprache_umstellen|land_ändern|land_wechseln|shop_wechseln|in_euro|in_franken|deutscher_shop|schweizer_shop|shop_deutschland|shop_schweiz
30105 :: Zugriffsrechte :: zugriffsrechte|zugriffsrecht|berechtigung|berechtigungen|administrator|adminrechte|admin_rechte|administratorrechte|erlaubnis|zugriff_auf_fotos|zugriff_erlauben|fotozugriff|mediathek
30201 :: Cliparts :: clipart|cliparts|sticker|aufkleber|dekoelement|dekoelemente|deko_elemente|verzierung|verzierungen|symbole|grafiken|=icons|embellishment
30202 :: Generelle Einstellungen :: einstellung|einstellungen|optionen|settings|präferenzen|voreinstellung|voreinstellungen|grundeinstellung|konfiguration
30203 :: Gutschein einlösen :: @gutschein einlösen|eingeben|=wo|verwenden|anwenden|eintragen|nutzen|benutzen !@fehler !ungültig|abgelehnt|nicht_akzeptiert|nicht_angenommen|abgelaufen; wo_gutschein|gutschein_eingeben|gutschein_einlösen|gutscheinfeld !@fehler !ungültig|abgelehnt
30204 :: Hintergrundfarben :: hintergrundfarbe|hintergrundfarben|hintergrund|hintergründe|seitenhintergrund|hintergrundbild|seitenfarbe
30205 :: Produktauswahl :: produktauswahl|welches_produkt|welches_format|welche_grösse|welches_fotobuch|welche_bindung|beratung|empfehlung|empfehlen|unterschied_zwischen|was_ist_besser|vergleich
30206 :: Produkteigenschaften :: produkteigenschaften|seitenzahl|seitenanzahl|anzahl_seiten|format_ändern|cover_ändern|bindung_ändern|papier_ändern|produkt_ändern; eigenschaften produkt|fotobuch|ändern
30207 :: Projekte verwalten :: projekte_verwalten|projekt_verwalten; @projekt speichern|gespeichert|kopieren|öffnen|löschen|umbenennen|duplizieren|wiederfinden|sichern @wie !wie_lange|bis_wann|speicherfrist|aufbewahrt
30208 :: Projektgestaltung :: projektgestaltung|gestaltung|gestalten|gestaltungstipps|=design|designen|kreativ|ideen|layouten
30209 :: Rahmengestaltung :: rahmengestaltung|bilderrahmen|=rahmen|umrandung|kontur|passepartout|bildrahmen
30210 :: Seitengestaltung :: seitengestaltung|seitenlayout|seite_gestalten|seiten_gestalten|doppelseite|doppelseiten|seiten_hinzufügen|seiten_löschen|seiten_verschieben|seiten_einfügen|seite_hinzufügen|seite_löschen|seitenzahlen|seitennummer|seitennummerierung
30211 :: Templates / Vorlagen / Layout :: template|templates|vorlage|vorlagen|layout|layouts|designvorlage|designvorlagen|=thema|=themen|layoutvorlage
30212 :: Warenkorb :: @warenkorb
30301 :: Bilder bearbeiten :: bildbearbeitung|bilder_bearbeiten|foto_bearbeiten|fotos_bearbeiten; @bild bearbeiten|drehen|spiegeln|filter|helligkeit|kontrast|anpassen|retuschieren|aufhellen|verbessern @wie
30302 :: Bilder einfügen :: bilder_einfügen|fotos_einfügen|bild_einfügen|foto_einfügen|bilder_hinzufügen|fotos_hinzufügen; @bild einfügen|hinzufügen|importieren|platzieren|=laden|reinziehen|austauschen|ersetzen @wie
30303 :: Bilder zuschneiden :: zuschneiden|zuschnitt|beschneiden|=crop|croppen|ausschnitt_wählen|ausschnitt_ändern|bildausschnitt_ändern; @bild zoomen|verkleinern|vergrössern|ausschnitt|verschieben @wie
30304 :: Bildqualität :: qualitätsanzeige|qualitätswarnung|warndreieck|ampel|rote_ampel|gelbe_ampel|warnsymbol|ausrufezeichen|genug_qualität|reicht_die_qualität|auflösung_reicht|mindestauflösung; bildqualität|auflösung @wie
30305 :: Dateiformate :: dateiformat|dateiformate|dateityp|dateitypen; =jpg|=jpeg|=png|=heic|=tif|=tiff|=pdf|=raw|=gif|=webp|=bmp|=psd|=dng|video|videos|=format|=formate unterstützt|akzeptiert|möglich|welche|@wie
30306 :: Online-Bildergalerien :: bildergalerie|onlinegalerie|online_galerie|google_fotos|google_photos|icloud|instagram|facebook|dropbox|onedrive|flickr|amazon_photos|=cloud|smugmug|online_alben|galerie
30307 :: Seitenverhältnis Digitalprint :: seitenverhältnis|digitalprint|digitalprints|abzugsformat|4_3|3_2|16_9; @print =rand|abgeschnitten|=format|seitenverhältnis|passt_nicht|weisser_rand
30308 :: Sortierung Bilder :: sortierung|sortieren|sortiert|reihenfolge|aufnahmedatum|nach_datum|chronologisch|nach_name|dateiname @bild; bilder_sortieren|fotos_sortieren|sortierung_bilder
30309 :: Zugriffsordner :: zugriffsordner|ordner|speicherort|dateipfad|=pfad|verzeichnis|laufwerk|bilderordner|fotoordner|projektordner|wo_gespeichert|wo_speichert
30401 :: Schriftarten als Standard verwenden :: schriftart|schriftarten|=schrift|=font|=fonts standard|voreinstellung|immer|default|festlegen|jedes_mal|überall; standardschrift|standardschriftart
30402 :: Sprechblasen :: sprechblase|sprechblasen|comic|denkblase|textblase
30403 :: Textbearbeitung :: textbearbeitung|text_bearbeiten|texte_bearbeiten|text_ändern|text_einfügen|textfeld|textfelder|text_schreiben|text_hinzufügen|bildunterschrift|beschriftung|titel_ändern
30404 :: Textformatierungen :: textformatierungen|textformatierung; formatierung|formatieren|=fett|kursiv|schriftgrösse|schriftfarbe|zeilenabstand|zentrieren|textfarbe|unterstreichen|aufzählung @wie|@text
30501 :: eBook Dateiformat :: @ebook =format|dateiformat|=pdf|epub|=datei|dateityp
30502 :: eBook Download :: @ebook download|herunterladen|downloaden|runterladen|speichern
30503 :: eBook Nachbestellung :: @ebook nachbestellen|nachbestellung|nochmals|erneut|neu_bestellen|zusätzlich|nachträglich|später_bestellen
30504 :: eBook Öffnen / Ansicht :: @ebook @nichtoeffnen|öffn|ansehen|anschauen|ansicht|lesen|anzeigen|reader|viewer|blättern|=tablet|=handy
30213 :: Projekt einlesen :: einlesen|projekt_einlesen|projekt_importieren|projekt_laden|projektdatei|backup|sicherung|wiederherstellen|projekt_übernehmen|alte_projekte
30214 :: Logfiles :: logfile|logfiles|log_datei|logdatei|logdateien|protokolldatei|protokoll|=log|=logs|fehlerbericht|fehlerprotokoll
30216 :: Speicherfristen :: wie_lange|bis_wann gespeichert|gespeichert_bleibt|aufbewahrt|verfügbar|gelöscht|online; speicherfristen|speicherfrist|wie_lange_gespeichert|wie_lange_verfügbar|aufbewahrt|aufbewahrungsfrist|aufbewahrungsdauer|gespeichert_bleiben|wie_lange_bleibt
30215 :: Photobook Sharing :: sharing|photobook_sharing|fotobuch_teilen|projekt_teilen|gemeinsam_gestalten|zusammen_gestalten|zusammen_bearbeiten|freigeben|freigabe|mitgestalten|mitarbeiten; @projekt|@buch teilen|freigeben|gemeinsam|mit_anderen|mehrere_personen|zusammen_gestalten|zusammen_arbeiten
30217 :: Frei editieren :: frei_editieren|frei_gestalten|freies_layout|frei_platzieren|freier_modus|freies_gestalten|individuell_gestalten|ohne_vorlage|frei_positionieren|frei_bearbeiten

## Product & Order Information
50411 :: Produkt nicht mehr im Sortiment :: nicht_mehr_im_sortiment|nicht_mehr_erhältlich|nicht_mehr_verfügbar|nicht_mehr_angeboten|nicht_mehr_bestellbar|gibt_es_nicht_mehr|ausverkauft|wurde_eingestellt|aus_dem_sortiment|nicht_mehr_im_angebot|abgekündigt|finde_nicht_mehr
50301 :: Email Änderung :: @email ändern|änderung|=neue|wechseln|aktualisieren|anpassen|geändert|korrigieren|@falsch; emailänderung|mailadresse_ändern|neue_mailadresse|neue_email|email_ändern
50302 :: Account löschen :: @login löschen|schliessen|auflösen|kündigen|entfernen|deaktivieren|aufheben; account_löschen|konto_löschen|kundenkonto_löschen|daten_löschen|meine_daten|dsgvo|datenschutz|datenauskunft
50303 :: Dubletten :: dublette|dubletten|doppeltes_konto|doppelter_account|zwei_konten|zwei_accounts|mehrere_konten|mehrere_accounts|konten_zusammenführen|zusammenlegen|doppelt_registriert|zweimal_registriert|zwei_kundennummern|doppelte_kundennummer
50304 :: Namensänderung :: namensänderung|name_ändern|namen_ändern|nachname|neuer_name|neuen_namen|heirat|geheiratet|name_falsch|namen_korrigieren|name_korrigieren|vorname|scheidung|firmenname_ändern
50401 :: Abfrage Auftragsstatus :: auftragsstatus|bestellstatus|status_der_bestellung|status_meiner_bestellung|bestellung_status|stand_der_bestellung|wo_ist_meine_bestellung|=wo_steht|schon_verschickt|bereits_verschickt|wurde_versendet|schon_versendet|schon_unterwegs|wann_kommt_meine_bestellung|wann_wird_verschickt; @bestellung status|stand|=wo|wann|verschickt|versendet
50403 :: Auftrag ändern/ stornieren :: stornieren|storno|stornierung|storniert|annullieren|annullierung|abbrechen|rückgängig|=cancel|zurückziehen; @bestellung ändern|anpassen|korrigieren|abändern|änderung|stoppen|anhalten; bestellung_ändern|auftrag_ändern|lieferadresse_ändern|menge_ändern
50404 :: Speicherfrist :: wie_lange|bis_wann gespeichert|aufbewahrt|verfügbar|gelöscht @bestellung|nachbestellen|nachbestellung; speicherfrist|wie_lange_gespeichert|aufbewahrt|aufbewahrungsfrist|noch_gespeichert|noch_verfügbar|gelöscht
50405 :: Nachbestellung :: nachbestellung|nachbestellen|nachbestellt|nochmals_bestellen|erneut_bestellen|noch_einmal_bestellen|nochmal_bestellen|wieder_bestellen|zusätzliches_exemplar|weiteres_exemplar|weitere_exemplare|nachdruck|nachdrucken
50501 :: Produkteigenschaften :: produkteigenschaften|abmessungen|abmessung|papierart|papiersorte|papierstärke|grammatur|maximale_seiten|welches_papier|welche_papiersorte|wie_gross|wie_dick|wie_schwer|wasserfest|spülmaschinenfest|mikrowellengeeignet|lichtbeständig|haltbarkeit; grösse|gewicht|=masse|=format|papier|seitenzahl @wie !@bestellung !@fehler
50502 :: Lieferzeit :: lieferzeit|lieferzeiten|lieferfrist|lieferdauer|wie_lange_dauert|wann_geliefert|bis_wann|rechtzeitig|bis_weihnachten|vor_weihnachten|express|expresslieferung|expressversand|schnellversand|eilig|=eilt|dringend|produktionszeit|lieferdatum|liefertermin !schon|=seit|bereits|immer_noch|noch_nicht|überfällig; wie_lange|bis_wann|wann @paket|@bestellung|lieferung|versand|dauert|geliefert|ankommen !schon|=seit|bereits|immer_noch|noch_nicht|überfällig; bis_zum|bis_am|noch_vor|bis_ende|rechtzeitig|bis_weihnachten kommt|ankommen|=an|geliefert|lieferung|bestelle|bestellen|bestellt|da|eintreffen !schon|=seit|bereits|immer_noch|noch_nicht|überfällig; wenn_ich_heute|wenn_ich_jetzt|wenn_ich_morgen|wenn_ich_bis bestelle|bestellen !schon|=seit|bereits
50503 :: Sortiment :: sortiment|produktpalette|produktangebot|neue_produkte|neues_produkt|im_programm|im_sortiment|im_angebot; habt_ihr|haben_sie|gibt_es|bieten_sie|bietet_ihr|führt_ihr|führen_sie =auch|ebenfalls|zusätzlich !@bestellung !@paket !@fehler !@nichterh
50504 :: Preisanfragen :: preisanfrage|preisliste|was_kostet|wie_viel_kostet|wieviel_kostet|kosten_für|preis_für|offerte|kostenvoranschlag|preisauskunft; @preis @wie
50505 :: Variable Bildlänge :: variable_bildlänge|bildlänge|variable_länge|panorama|panoramabild|überlänge @wie|@preis|möglich|=format
50506 :: Versandtasche :: versandtasche|versandtaschen|versandverpackung|versandkarton|umverpackung|polstertasche|luftpolster|kartonverpackung; verpackung|tasche
50305 :: Dankesschreiben :: dankesschreiben|=lob|loben|kompliment|komplimente|begeistert|sehr_zufrieden|super_zufrieden|wunderschön|toll_geworden|schön_geworden|positives_feedback|möchte_mich_bedanken|wollte_mich_bedanken|einfach_danke_sagen|herzliches_dankeschön !leider !aber !problem|reklamation|@fehler|@fehlt|@kaputt|enttäuscht|unzufrieden|@falsch
50306 :: Geschäftleitungsfälle :: beschweren|beschwerde chef|=chefin|leitung|vorgesetzt|verantwortlich|oben|höher; chef|=chefin|höhere_stelle|verantwortlichen|verantwortliche; geschäftsleitung|geschäftleitung|geschäftsführung|geschäftsführer|=ceo|direktion|management|vorgesetzten|vorgesetzter|ombudsstelle|ombudsmann|anwalt|rechtsanwalt|rechtliche_schritte|medien|zeitung|presse|konsumentenschutz|kassensturz|verbraucherzentrale
50307 :: Korrespondenz Sprache :: korrespondenz|korrespondenzsprache|kommunikation|antwort|antworten|kontakt|=mails|briefe sprache|französisch|italienisch|englisch|französischer|italienischer; auf_französisch|auf_italienisch|auf_englisch|auf_deutsch|in_französisch|in_italienisch|in_englisch|spricht_französisch|spricht_italienisch|spricht_englisch|francais|italiano|=english
50308 :: Anruf weiterleiten :: anruf_weiterleiten|weiterleiten|weitergeleitet|weiterverbinden|verbinden_mit|durchstellen|rückruf|zurückrufen|ruft_zurück|rückruf_gewünscht; =anruf|telefonat|telefonisch|abteilung|zuständige_person *0.5
50507 :: Versandkosten :: versandkosten|versandgebühr|versandgebühren|porto|portokosten|lieferkosten|versandpreis|gratis_versand|kostenloser_versand|versandkostenfrei|=zoll|zollgebühren|zollkosten|verzollung|einfuhr; versandkosten|porto|lieferkosten|versandgebühr @wie|@preis|wie_viel|=was
50508 :: Abholung ifolor :: selbst_abholen|selber_abholen|persönlich_abholen|vor_ort_abholen|abholung_bei_ifolor|bei_ifolor_abholen|abholen_in|kreuzlingen|vor_ort|verkaufsstelle|shop_vor_ort|fabrikverkauf
50413 :: Kunden-Masseninformationen :: masseninformation|masseninformationen|massenmail|massenmailing|alle_kunden|rundmail|rundschreiben|information_an_alle|störung|systemstörung|systemausfall|ausfall|serverprobleme|allgemeine_verzögerung|streik|poststreik
6102 :: Adressänderung :: adressänderung|adresse_ändern|neue_adresse|umzug|umgezogen|zügeln|gezügelt|lieferadresse_ändern|rechnungsadresse_ändern|adresse_falsch|falsche_adresse|adresse_korrigieren|adresse_anpassen|adresse_aktualisieren|neue_anschrift|anschrift_ändern

## Ordering & Checkout Issues
20601 :: Warenkorb Upselling Produkte :: upselling|up_selling|zusatzprodukt|zusatzprodukte|zusatzartikel|automatisch_hinzugefügt|cross_selling; @warenkorb zusätzlich|automatisch|ungewollt|empfehlung|angebot|zubehör
20602 :: Warenkorb Preise fehlen :: @warenkorb preis|preise|betrag|kosten @fehlt|=kein|=keine|=ohne|nicht_angezeigt|^leer|=null|0_00; @warenkorb @preis
20603 :: Warenkorb Anzahl Produkte nicht änderbar :: anzahl|menge|stückzahl|exemplare|stück ändern|änderbar|erhöhen|reduzieren|anpassen|nicht_ändern|lässt_sich_nicht|kann_nicht @warenkorb; anzahl_nicht_änderbar|menge_nicht_änderbar|menge_ändern_geht_nicht|anzahl_ändern_geht_nicht
20604 :: Produktprüfung :: produktprüfung|produktcheck|prüfung_fehlgeschlagen|projektprüfung|überprüfung_fehlgeschlagen; prüfung|validierung|=check|geprüft @projekt|@buch|produkt|@fehler
20605 :: Warenkorb öffnet sich nicht :: @warenkorb @nichtoeffnen|öffnet_nicht|lädt_nicht|geht_nicht|reagiert_nicht|funktioniert_nicht; warenkorb_öffnet_nicht|warenkorb_lädt_nicht
20701 :: Checkout Adresseingabe :: @checkout|bestellen|bestellung adresse|adresseingabe|=plz|postleitzahl|hausnummer|strasse|adressfeld|postfach @fehler|@falsch|akzeptiert|ungültig|fehlermeldung; adresseingabe|adresse_wird_nicht_akzeptiert|adresse_nicht_akzeptiert|adresse_ungültig|plz_ungültig|postleitzahl_ungültig|adresse_nicht_speichern|adresse_lässt_sich_nicht
20703 :: Checkout Inhalt ist leer :: @checkout ^leer|inhalt_leer|keine_produkte|keine_artikel|nichts_drin; checkout_leer|kasse_leer
20705 :: Checkout Fehler Best Price :: best_price|bestprice|bestpreis|best_preis|tiefstpreis|bestpreisgarantie|preisgarantie|günstigster_preis
20706 :: Checkout Fehlermeldung :: @checkout @fehler; fehlermeldung_beim_bestellen|fehler_beim_bestellen|fehler_bei_der_bestellung|kann_nicht_bestellen|bestellung_nicht_möglich|bestellen_geht_nicht|bestellung_geht_nicht|bestellung_abschliessen
20707 :: Checkout Upload Absturz / Freeze :: upload|hochladen|übertragung @absturz|=hängt|bleibt_stehen|bleibt_hängen|stecken|stockt|friert|abgebrochen|bricht_ab|prozent|dauert_ewig|=ewig; upload_hängt|upload_bricht_ab|upload_abgebrochen|upload_friert|hochladen_hängt|bleibt_bei
20708 :: Checkout Upload startet nicht :: upload_startet_nicht|upload_beginnt_nicht|hochladen_startet_nicht|hochladen_beginnt_nicht|upload_geht_nicht_los|lädt_nicht_hoch|upload_funktioniert_nicht|übertragung_startet_nicht; upload|hochladen|übertragung startet_nicht|beginnt_nicht|nicht_los|passiert_nichts|bei_0|0_prozent
20709 :: Checkout Gutschein nicht akzeptiert :: @gutschein nicht_akzeptiert|ungültig|funktioniert_nicht|geht_nicht|abgelehnt|nicht_angenommen|nicht_gültig|fehlermeldung|nicht_einlösen|nicht_eingelöst|wird_nicht|klappt_nicht|nicht_anerkannt|@falsch; gutschein_ungültig|code_ungültig|gutscheincode_ungültig|code_funktioniert_nicht|code_geht_nicht
20801 :: Auftragsbestätigung nicht erhalten :: auftragsbestätigung|bestellbestätigung|bestätigungsmail|bestätigungsemail|bestätigung @nichterh|=keine|@fehlt|=kein !registrier|konto|account|passwort|newsletter|anmeld; keine_bestätigung|keine_auftragsbestätigung|keine_bestellbestätigung|bestätigung_nicht_erhalten|bestätigung_fehlt
20809 :: Nachbestelllink nicht erhalten :: nachbestelllink|nachbestellungslink|nachbestell_link|link_zum_nachbestellen|link_für_nachbestellung @nichterh|=keine|=keinen|=kein|@fehlt
20810 :: Nachbestellungslink funktioniert nicht :: nachbestelllink|nachbestellungslink|nachbestell_link|link_zum_nachbestellen @fehler|ungültig|abgelaufen|funktioniert_nicht|geht_nicht|kaputt|fehlermeldung
20812 :: Versandbestätigung nicht erhalten :: versandbestätigung|versandmail|versandbenachrichtigung|versandinfo|versandinformation|versandemail|trackingmail|tracking_mail|sendungsnummer|trackingnummer @nichterh|=keine|=keinen|=kein|@fehlt; keine_versandbestätigung|keine_trackingnummer|keine_sendungsnummer|kein_tracking|keine_versandmail
20704 :: Checkout öffnet sich nicht :: @checkout @nichtoeffnen|lädt_nicht|geht_nicht|kommt_nicht_weiter|reagiert_nicht|öffnet_nicht|=hängt; komme_nicht_zur_kasse|kasse_öffnet_nicht|checkout_öffnet_nicht|checkout_lädt_nicht|nicht_zur_kasse
50702 :: Doppelbestellung :: doppelbestellung|doppelt_bestellt|zweimal_bestellt|2x_bestellt|zwei_mal_bestellt|mehrfach_bestellt|bestellung_doppelt|doppelte_bestellung|versehentlich_zweimal|doppelt_abgeschickt; zweimal|doppelt|2x|zwei_mal @bestellung
20813 :: Pick@home Problem :: pick_home|pickathome|pick_at_home|pickhome|abholung_zu_hause|abholung_zuhause|post_holt_ab|paket_abholen_lassen|abholauftrag
20814 :: Bad Order :: bad_order|badorder|bad_orders
20815 :: Widerrufsrecht EU :: widerrufsrecht|widerruf|widerrufen|widerrufsfrist|widerrufsformular|rücktrittsrecht|rücktritt|14_tage|vierzehn_tage|fernabsatz|fernabsatzgesetz|verbraucherrecht|vom_vertrag|zurücktreten
`;

/* Frühere / alternative Bezeichnungen (werden klein angezeigt und mitgesucht) */
var ALT_LABELS = {
  "3709": "Keine Rückmeldung",
  "515": "Sonstiges Versand"
};

/* Abkürzungen: werden vor der Suche ausgeschrieben.
   Nur Grossbuchstaben (z.B. "AB") = Gross-/Kleinschreibung zählt, damit "ab" nicht betroffen ist.
   Mit Kleinbuchstaben (z.B. "kd.") = Gross-/Kleinschreibung egal.
   Hier eigene Abkürzungen ergänzen. */
var ABK = {
  "FB": "Fotobuch", "FBs": "Fotobücher", "AB": "Auftragsbestätigung", "RE": "Rechnung", "GS": "Gutschein",
  "LW": "Leinwand", "WK": "Warenkorb", "VK": "Versandkosten", "LS": "Lieferschein", "NB": "Nachbestellung",
  "ND": "Nachdruck", "RS": "Rücksendung",
  "kd": "Kunde", "kd.": "Kunde", "kde": "Kunde", "kde.": "Kunde", "kdin": "Kundin", "kdin.": "Kundin",
  "erh": "erhalten", "erh.": "erhalten", "n.e.": "nicht erhalten", "n. e.": "nicht erhalten",
  "n. erh.": "nicht erhalten", "n.erh.": "nicht erhalten", "nicht erh.": "nicht erhalten",
  "best.": "Bestellung", "bestnr": "Bestellnummer", "bestnr.": "Bestellnummer", "best.-nr.": "Bestellnummer",
  "gutsch.": "Gutschein", "gutschr.": "Gutschrift", "lief.": "Lieferung", "rekla": "Reklamation",
  "rekla.": "Reklamation", "reklam.": "Reklamation", "stornierg.": "Stornierung", "adr.": "Adresse",
  "zahlg.": "Zahlung", "rückerst.": "Rückerstattung", "sdg.": "Sendung", "pak.": "Paket",
  "prod.": "Produktion", "qual.": "Qualität", "bestät.": "Bestätigung", "tel.": "Telefon",
  "bzgl.": "bezüglich", "wg.": "wegen",
  // aus echten Notizen (September 2026): KD, AT, RG kommen am häufigsten vor
  "RG": "Rechnung", "RGs": "Rechnungen", "Rg.": "Rechnung", "AT": "Auftrag", "ATs": "Aufträge", "AT-Nr.": "Auftragsnummer",
  "DB": "Doppelbestellung", "GU": "Gutschein", "CC": "Kreditkarte", "PB": "Fotobuch", "CL": "Kunde"
};

/* Fest eingebaute Beispiele (Text -> Code), gelten für alle, die diese Datei nutzen.
   Format: { t: "Text des Falls", c: "Code" } */
var BEISPIELE = [];
