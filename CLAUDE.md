# Récap : outil de classification des cas (service client ifolor)

> À lire en premier. Dernière mise à jour : 24 septembre 2026 (version 4).

## Contexte

- Tom travaille au service client d'ifolor (Suisse). Après chaque contact client, il ouvre un « cas » et doit choisir une classification parmi 331 codes (liste en allemand, ex. « 50410 - Lieferverzögerung »).
- Objectif : un petit outil qui propose la ou les bonnes classifications à partir du problème du client.
- Choix de Tom :
  - page HTML qui fonctionne par mots-clés, hors ligne, sans rien envoyer (pas d'IA pour l'instant, à cause des données clients) ;
  - version allemande d'abord ;
  - 3 propositions maximum ;
  - saisie : le message du client collé en entier, des notes courtes en allemand et des abréviations internes (pas de français).
- Tom écrit en français. L'interface de l'outil et les mots-clés sont en allemand (orthographe suisse, jamais de « ß »).
- Dépôt GitHub : `steinbachtom-bot/Classification`.

## État actuel (version 4)

Fichier livré : `dist/Fall-Klassifizierung_DE.html`. C'est un fichier unique et autonome, qui s'ouvre dans le navigateur.

1. **Nettoyage des messages collés.** Sont ignorés :
   - la formule d'appel, la signature (y compris après une ligne « -- » ou une formule de fin très courte), les pieds du type « Von meinem iPhone gesendet » et l'historique cité (« Von: », « Am … schrieb ») ;
   - les en-têtes et champs de formulaire (« Name: … ») ; si la valeur est une vraie phrase, seule l'étiquette est retirée ;
   - les e-mails, les téléphones (y compris « +41 (0)44 … »), les IBAN et numéros de carte, les dates, les numéros de 5 chiffres ou plus, les numéros de référence (« RE-2026/48213 » → « RE »), les adresses (y compris « Seestr. 50 ») ;
   - le nom qui suit Frau, Herr, Hr., Fr. ou Familie (jusqu'à 3 mots, titres Dr./Prof. compris), remplacé par « – » pour que le texte reste stable si on le nettoie une 2e fois. Exceptions : les abréviations internes (« Hr. FB n. erh. » garde FB), « Fr. » = vendredi ou « Frage » (après am/seit/… ou en début de ligne), « meine Frau », « für die Familie » ;
   - les formules de politesse.

   L'interface affiche ce qui a été ignoré.
2. **Abréviations internes** (table `ABK`). La liste a été devinée : FB, AB, RE, GS, LW, Kd., erh., n. erh., Best., Rekla… Une clé tout en majuscules est sensible à la casse, pour ne pas toucher « ab ». « RE: » n'est pas remplacé.
3. **Règles de mots-clés** par classification (syntaxe plus bas), évaluées phrase par phrase.
4. **Apprentissage.** Quand du texte est dans le champ et que Tom copie un code, le texte nettoyé est enregistré dans `localStorage` (clé `fall-klassifizierung.gelernt.v1`). Le texte stocké est `Engine.learnText()`, limité à 1000 caractères. La copie peut venir d'une proposition, de la recherche « Richtige Klassifizierung nicht dabei? » ou de la liste complète. Les textes similaires reçoivent ensuite ce code, avec l'étiquette « Gelernt ».
   - Le bouton « Nicht lernen » annule l'enregistrement.
   - La section « Gelernte Fälle » permet l'export et l'import en JSON, ainsi que la suppression. L'export ne contient **que les cas appris à la main**, jamais les cas importés.
   - Si le stockage échoue (mémoire du navigateur pleine), un avertissement s'affiche en haut de la page et dans le message de copie.
5. **Affichage.** 3 propositions au maximum. Si le texte contient plusieurs problèmes, elles sont choisies pour les couvrir. Alt+1…3 copie une proposition. Un code tapé seul s'affiche directement.
6. **Nouveau en v4 : « Fälle importieren und testen ».**
   - **Chargement.** Tom charge d'anciens cas : fichier `.xlsx`, CSV (UTF-8, Windows-1252 ou UTF-16), tableau HTML, Excel 2003 XML, ou copier-coller depuis Excel. Il faut une colonne de texte et une colonne de classification (code, « code - libellé » ou libellé seul).
   - **Colonnes détectées automatiquement :** texte, code, ligne d'en-tête (même sous des lignes de titre), feuille, remplissage vers le bas pour les rapports groupés.
     - Une colonne qui contient des libellés de classification n'est jamais prise comme texte, car elle révélerait la réponse.
     - Tom peut tout changer dans le tableau d'aperçu.
   - **« Genauigkeit testen ».** Il mesure la précision **localement**, en « leave-one-out » : chaque cas est testé comme s'il était nouveau, sans lui-même ni les textes identiques.
     - Résultats affichés : Platz 1 et « unter den 3 Vorschlägen », pour « Nur Stichwörter (so wie heute) » et « Mit importierten Fällen ».
     - Un verdict dit si l'apprentissage améliore l'outil ou l'empire. Il regarde Platz 1 **et** « unter den 3 », avec un test de signe sur les cas qui changent (`pairs` : cas devenus justes ou faux). Aucun verdict en dessous de 30 cas testés, et une réserve en dessous de 200.
     - Détails : résultats par code, confusions, et liste des erreurs, visible **seulement à l'écran**.
     - Si la liste de cas contient beaucoup de textes presque identiques, une estimation prudente est affichée en plus (« ohne fast gleiche Texte »).
     - Des variantes techniques (poids 20/40/80, agrégation « max » ou « top3 », cas seuls) sont calculées pour régler les paramètres.
   - **« Bericht exportieren ».** Il produit un rapport JSON **sans textes clients** : chiffres, codes, confusions, règles qui ont déclenché de fausses propositions (`ausloeser`) et codes non reconnus qui ressemblent à des codes.
     - Les mots fréquents par code (au moins 5 cas) n'y figurent que si Tom les active, après avoir retiré les noms d'un clic.
   - **« Alle als gelernte Fälle übernehmen ».** Il apprend tous les cas d'un coup, marqués `s: "import"` et supprimables avec « Importierte löschen ».
     - Une confirmation avertit si le test n'a pas été fait ou s'il montre que l'outil empire.
     - Si la mémoire du navigateur ne suffit pas, l'outil garde environ 250 000 caractères de réserve et répartit les cas gardés sur tous les codes.

## Historique et retours de Tom (important)

- **v1 :** mots-clés simples, jusqu'à 8 propositions.
- **v2 :** 3 propositions maximum et filtre affiné.
- **Retour de Tom sur la v2 :** « dans 90 % des cas, pas du tout la bonne classification ». Les erreurs tombaient **sur un tout autre thème**.
- **Cause probable :** Tom colle souvent le message complet du client. Les formules de politesse, la signature, l'historique et les détails secondaires déclenchaient des règles hors sujet. Les abréviations internes n'étaient pas reconnues.
- **v3 :** corrige ces points, **mais n'a jamais été testée sur de vrais cas**.
- **v4 :** outil de mesure local (« Fälle importieren und testen »), pour obtenir enfin des chiffres sur de vrais cas **sans envoyer de données clients**. S'y ajoutent l'apprentissage en masse et un moteur refondu, 2 à 3 fois plus rapide, qui supporte des milliers de cas appris.
  - La refonte donne des propositions identiques à la v3 sur les 199 textes de l'instantané.
  - Le nettoyage renforcé (noms, IBAN, signatures…) ne change aucune proposition sur les 4753 textes inventés testés.
  - Avant livraison : relecture critique à 5 angles (import de vrais exports, justesse de l'évaluation, navigateur, confidentialité, clarté pour Tom). Les problèmes ont été confirmés par un second agent puis corrigés.
- **Toujours vrai :** tous les tests reposent sur des phrases **inventées par Claude**. Les scores des mots-clés sur ces phrases (80 à 100 %) ne disent rien de la précision réelle : ne pas s'y fier, ni les présenter comme une preuve.
  - Sur ces données inventées, l'apprentissage fait un peu *baisser* le score (1 ou 2 cas par code seulement). Ce n'est pas une conclusion non plus. Seul le test sur les vrais cas de Tom compte.

## Prochaines étapes (par priorité)

1. **Mesurer sur les vrais cas de Tom, en local.**
   - Tom exporte des cas déjà classés depuis le CRM : texte et classification, idéalement plusieurs centaines. Il les charge dans « Fälle importieren und testen », lance « Genauigkeit testen », puis envoie le **rapport** (« Bericht exportieren »).
   - Le rapport ne contient pas de textes clients. Si Tom ajoute les mots fréquents, il doit d'abord retirer les noms.
2. **Corriger les mots-clés avec le rapport.** Utiliser :
   - `verwechslungen`, pour voir quels codes sont confondus ;
   - `ausloeser`, pour trouver les règles qui déclenchent à tort ;
   - `woerter`, pour les mots des vrais clients, en gras s'ils manquent aux règles ;
   - `proCode`, pour voir les codes jamais trouvés.

   Corriger `src/data.js` et vérifier qu'il n'y a pas de régression (`node tests/run-tests.js`). Puis demander à Tom de refaire le test et de renvoyer le rapport.
3. **Régler l'apprentissage avec `methoden`** (variantes) : si une variante est nettement meilleure, changer `EX_WEIGHT` ou l'agrégation dans `engine.js` (la variante par défaut est `{agg:"max", w:40}`). Recommander « Alle übernehmen » seulement si le verdict est positif sur les vrais cas.
4. **Obtenir la vraie liste des abréviations internes** et l'intégrer dans `ABK`.
5. **Si les mots-clés restent insuffisants :** une version avec IA serait bien plus fiable sur du texte libre, mais seulement avec l'accord de l'employeur (données clients).

**Ne pas faire :**
- mettre des textes de clients dans `BEISPIELE` ou ailleurs dans le dépôt ;
- utiliser les fichiers exportés par Tom comme jeux de test dans le dépôt.

Seuls des exemples inventés, ou entièrement anonymisés et relus avec Tom, sont acceptables. Le `.gitignore` exclut `*.xlsx`, `*.csv`, `tests/real_cases.json` et les exports de l'outil.

## Structure du projet

```
Classification/
├── CLAUDE.md            (= ce récap)
├── .gitignore           jamais d'exports réels dans le dépôt
├── build.js             node build.js → dist/Fall-Klassifizierung_DE.html
├── src/
│   ├── data.js          classifications, mots-clés, synonymes, abréviations, exemples intégrés
│   ├── engine.js        moteur : nettoyage, abréviations, règles, apprentissage, choix des 3, évaluation
│   ├── table.js         lecture locale des fichiers (CSV, xlsx, HTML, XML 2003), détection des colonnes
│   └── template.html    interface (allemand), marqueurs /*__DATA__*/, /*__ENGINE__*/, /*__TABLE__*/
├── dist/
│   └── Fall-Klassifizierung_DE.html   fichier livré (généré, ne pas modifier à la main)
└── tests/
    ├── run-tests.js     précision sur les phrases inventées (-v pour voir les erreurs)
    ├── unit-engine.js   tests du moteur et de l'évaluation (sortie ≠ 0 si échec)
    ├── unit-table.js    tests de lecture des fichiers (sortie ≠ 0 si échec)
    ├── auswertung.js    node tests/auswertung.js fichier.xlsx|.csv|.json → même évaluation qu'à l'écran
    ├── debug.js         node tests/debug.js "texte" → texte nettoyé + règles déclenchées
    ├── browser-test.js  test dans le navigateur (Playwright, optionnel)
    └── *.json           jeux de test (phrases inventées)
```

Toujours modifier `src/`, puis lancer `node build.js`, puis `node tests/run-tests.js && node tests/unit-engine.js && node tests/unit-table.js`. Seul Node est nécessaire. Pour les tests navigateur : `NODE_PATH=<modules globaux> node tests/browser-test.js`.

## Format des données (`src/data.js`)

- `SYN` : groupes de synonymes, utilisables dans les règles avec `@nom`.
- `KLASSEN` : une ligne par classification, au format `Code :: Bezeichnung :: règle; règle; …`. Les lignes `# Bereich` et `## Gruppe` donnent la hiérarchie.
- **Syntaxe d'une règle :**
  - `a b` (espace) : tous les mots doivent apparaître, au maximum 15 mots d'écart. Dans la même phrase, ils comptent plein ; dans la phrase voisine, ×0,75.
  - `a|b` : l'un ou l'autre.
  - `a_b` : groupe de mots dans l'ordre, avec au maximum 2 mots entre eux. L'ordre est libre si le groupe contient nicht, kein, keine, nie, nichts ou sich.
  - `@groupe` : groupe de synonymes.
  - `=mot` : mot exact.
  - `^mot` : début de mot.
  - `!terme` : exclusion ; la règle ne compte pas si le terme est dans la même phrase.
  - `*0.8` en fin de règle : poids de la règle.
- **Comportement par défaut :**
  - 3 lettres ou moins = mot exact, 4 lettres = début de mot, 5 lettres ou plus = n'importe où dans le mot (mots composés).
  - Les umlauts sont normalisés (ä → ae…).
  - Les fautes de frappe sont tolérées pour les mots de 8 lettres ou plus.
  - Les mots du libellé comptent aussi, faiblement (×0,6, et ×0,3 pour les textes longs), sauf les mots trop généraux (liste `STOP` dans engine.js).
- `ALT_LABELS` : anciens libellés (3709, 515), affichés et cherchables.
- `ABK` : abréviation → forme longue.
- `BEISPIELE` : exemples intégrés au format `{ t: "texte", c: "code" }`. Vide pour l'instant. Uniquement des textes inventés ou anonymisés (voir plus haut).

## Moteur (`src/engine.js`) : points clés

- **Étapes :** `classify()` = `analyze` → `scoreRules` → `similar` (cas appris, via un index inversé) → `applyLearned` → `finish` (tri et choix des 3). L'évaluation réutilise exactement ces étapes.
- **Score :** somme pondérée des règles. Le poids dépend de la rareté du terme parmi les 331 classes (IDF). Une phrase qui décrit un problème (leider, nicht, fehlt, kaputt, bitte, ?…) compte 1, les autres 0,6.
- **Cas appris :**
  - similarité cosinus sur des racines de mots, sans les mots vides ni les mots trop fréquents dans le domaine (Kunde, Fotobuch, Paket, Bestellung, bekommen…) ;
  - il faut au moins 2 mots en commun, sauf si la similarité atteint 0,6 ;
  - bonus = 40 × (sim − 0,2) / 0,8 (agrégation « max » : le meilleur cas par code).
  - Conséquence : une note très courte comme « Kd. hat FB n. erh. » n'est **pas** apprenable (ses mots sont tous trop fréquents). Elle est quand même testée par les mots-clés.
- **Sélection :** 3 propositions au maximum. Seuils : score d'au moins 2,5 et d'au moins 35 % du meilleur. Les propositions suivantes sont préférées si elles couvrent d'autres mots du texte ou une autre catégorie.
- **Évaluation (`Engine.evaluation(cases, {maxTests: 3000, minDocs: 5})`).** Elle avance par tranches de temps (`step(ms)`), sans toucher aux cas appris de Tom.
  - Au-delà de 3000 cas, elle teste 1 cas sur k, mais tous les cas servent de voisins.
  - L'IDF de l'index inclut le cas testé : c'est une approximation d'environ 1 point, documentée dans le code.
  - Champs du rapport : `variants`, `pairs`, `perCode`, `confusions`, `triggers`, `words`, `errors` (indices, pour l'écran seulement), `sameText`, `nearDup`, `zuKurzZumLernen`.
- **Paramètres** en tête de fichier : `WIN`, `MAX_RESULTS`, `EX_WEIGHT`, `EX_MIN`, `LEARN_MAX` (1000).

## Les classifications

- 331 codes, répartis en 4 domaines (Marketing, Operations, Finance, Product & Tech), avec les groupes de la 2e liste envoyée par Tom.
- **Fusion des deux listes :**
  - la 2e liste a ajouté 3728, 50208 et 20815 ;
  - elle a renommé 3709 (« Keine Rückmeldung Kunde ») et 515 (« Zustellungsbeschwerde ») ;
  - 351, 411 et 372 n'existent que dans la 1re liste ; ils ont été gardés.
- **Sens incertain, donc peu de mots-clés :** 20814 Bad Order, 20604 Produktprüfung, 50204 Direct Payment.
- **Libellés partagés par deux codes** (un libellé seul ne suffit pas à l'import) : Photobook Sharing 20205/30215, Rahmengestaltung 10117/30209, Variable Bildlänge 10122/50505, Softwarefehler (-) Templatefehler 10215/373, Produkteigenschaften 30206/50501.
- **Limite de fond :** beaucoup de codes décrivent le même symptôme avec une cause différente (Herstellung / Softwarefehler / erreur du client / Maschinenfehler ; HP / Xerox / Canon ; gerechtfertigt / Kulanz). Souvent, le texte seul ne permet pas de trancher.

## Règles de travail avec Tom

- Répondre en français.
- **Données clients :**
  - ne jamais mettre de données personnelles réelles dans les fichiers du projet (noms, adresses, e-mails, téléphones, numéros de commande) ;
  - préférer le test local (« Fälle importieren und testen ») et le rapport sans textes ; sinon, demander des cas anonymisés ;
  - l'envoi de vrais cas à une IA doit être autorisé par l'employeur.
- Ne pas deviner à l'aveugle : partir des vrais cas de Tom, mesurer, puis corriger.
- Rester honnête sur ce que les tests prouvent.
- L'outil doit rester un seul fichier HTML hors ligne, sans envoi de données.
- **Compromis connus du nettoyage :** un nom de famille qui est aussi un mot courant (Klein, Frei, Weiss…) reste après « Fr. » en début de ligne ou après « für die Familie » ; les quasi-doublons (même message avec une autre phrase autour) peuvent encore gonfler « Mit importierten Fällen ». L'écran le signale quand il en détecte beaucoup.
- **Limite connue :** dans Chrome et Edge, toutes les pages HTML ouvertes depuis le disque (`file://`) partagent le même `localStorage`. Les cas appris y sont donc lisibles par d'autres fichiers HTML locaux.

## Formats utiles

`tests/real_cases.json` (exclu de git), pour mesurer la précision sur des cas anonymisés avec `node tests/run-tests.js -v` ou `node tests/auswertung.js tests/real_cases.json`. La 1re ligne ci-dessous est un exemple inventé.

```json
[
  ["Kd. hat FB n. erh., Tracking seit 5 Tagen unverändert", ["50407", "50410"]],
  ["<texte collé ou note, anonymisé>", ["<code choisi>"]]
]
```

Si plusieurs codes sont indiqués, ils sont tous acceptés. Un 3e élément, optionnel, liste les codes qui ne doivent pas apparaître.

Export de l'outil (section « Gelernte Fälle », cas appris à la main seulement) :

```json
{ "app": "Fall-Klassifizierung", "version": 1, "exportiert": "…",
  "beispiele": [ { "t": "texte nettoyé", "c": "50410", "d": "2026-09-24" } ] }
```

Rapport d'évaluation (« Bericht exportieren », sans textes clients) :

```json
{ "app": "Fall-Klassifizierung", "typ": "Auswertung", "version": 2, "erstellt": "…",
  "quelle": { "format": "xlsx", "zeilen": 0, "faelle": 0, "ohneCode": 0, "ohneText": 0,
              "summenzeilen": 0, "ausZeileDarueber": 0,
              "nichtErkannteCodes": [["99999", 3]], "andereNichtErkannte": 0 },
  "test": { "verwendbar": 0, "getestet": 0, "jederNte": 1, "uebersprungen": {},
            "zuKurzZumLernen": 0, "gleicherText": 0, "fastGleicherText": 0 },
  "methoden": [ { "id": "regeln", "name": "…", "n": 0, "top1": 0, "top3": 0, "keinVorschlag": 0 } ],
  "proCode": [], "verwechslungen": { "regeln": [], "gelernt": [] }, "ausloeser": [],
  "woerter": "(seulement si Tom l'active)" }
```
