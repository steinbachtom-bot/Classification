# Récap : outil de classification des cas (service client ifolor)

> À lire en premier. Dernière mise à jour : 24 septembre 2026.

## Contexte

- Tom travaille au service client d'ifolor (Suisse). Après chaque contact client, il ouvre un « cas » et doit choisir une classification parmi 331 codes (liste en allemand, ex. « 50410 - Lieferverzögerung »).
- Objectif : un petit outil qui propose la ou les bonnes classifications à partir du problème du client.
- Choix de Tom :
  - page HTML qui fonctionne par mots-clés, hors ligne, sans rien envoyer (pas d'IA pour l'instant, à cause des données clients) ;
  - version allemande d'abord ;
  - 3 propositions maximum ;
  - saisie : le message du client collé en entier, des notes courtes en allemand et des abréviations internes (pas de français).
- Tom écrit en français. L'interface de l'outil et les mots-clés sont en allemand.

## État actuel (version 3)

Fichier livré : `dist/Fall-Klassifizierung_DE.html`. C'est un fichier unique et autonome, qui s'ouvre dans le navigateur.

1. **Nettoyage des messages collés.** Sont ignorés : la formule d'appel, la signature, l'historique cité (« Von: », « Am … schrieb »), les en-têtes et champs de formulaire, les e-mails, les téléphones, les dates, les numéros de 5 chiffres ou plus, les adresses et les formules de politesse. L'interface affiche ce qui a été ignoré.
2. **Abréviations internes** (table `ABK`). La liste a été devinée : FB, AB, RE, GS, LW, Kd., erh., n. erh., Best., Rekla… Une clé tout en majuscules est sensible à la casse, pour ne pas toucher « ab ». « RE: » n'est pas remplacé.
3. **Règles de mots-clés** par classification (syntaxe plus bas), évaluées phrase par phrase.
4. **Apprentissage.** Quand du texte est dans le champ et que Tom copie un code, le texte nettoyé est enregistré dans `localStorage` (clé `fall-klassifizierung.gelernt.v1`). La copie peut venir d'une proposition, de la recherche « Richtige Klassifizierung nicht dabei? » ou de la liste complète. Les textes similaires reçoivent ensuite ce code, avec l'étiquette « Gelernt ».
   - Le bouton « Nicht lernen » annule l'enregistrement.
   - La section « Gelernte Fälle » permet l'export et l'import en JSON, ainsi que la suppression.
5. **Affichage.** 3 propositions au maximum. Si le texte contient plusieurs problèmes, elles sont choisies pour les couvrir. Alt+1…3 copie une proposition. Un code tapé seul s'affiche directement.

## Historique et retours de Tom (important)

- **v1 :** mots-clés simples, jusqu'à 8 propositions.
- **v2 :** 3 propositions maximum et filtre affiné.
- **Retour de Tom sur la v2 :** « dans 90 % des cas, pas du tout la bonne classification ». Les erreurs tombaient **sur un tout autre thème**.
- **Cause probable :** Tom colle souvent le message complet du client. Les formules de politesse, la signature, l'historique et les détails secondaires déclenchaient des règles hors sujet. Les abréviations internes n'étaient pas reconnues.
- **v3 :** corrige ces points, **mais n'a jamais été testée sur de vrais cas**. Tous les tests reposent sur des phrases inventées par Claude. Leurs scores, proches de 100 %, ne disent rien de la précision réelle : ne pas s'y fier, ni les présenter comme une preuve.

## Prochaines étapes (par priorité)

1. **Obtenir de vrais cas**, anonymisés : le texte tel que tapé ou collé, et le code choisi par Tom.
   - Les mettre dans `tests/real_cases.json` (format en bas) et lancer `node tests/run-tests.js -v`.
   - Analyser chaque erreur avec `node tests/debug.js "texte"`, puis corriger `src/data.js`.
   - Vérifier que les autres tests ne régressent pas.
2. **Obtenir la vraie liste des abréviations internes** et l'intégrer dans `ABK`.
3. **Utiliser les exports de Tom** (fichier JSON de la section « Gelernte Fälle ») :
   - vérifier qu'il n'y a pas de données personnelles ;
   - s'en servir comme jeu de test ;
   - les intégrer dans `BEISPIELE` (`src/data.js`) pour que tous les collègues en profitent.
4. **Idée :** importer dans l'outil un fichier CSV ou Excel de cas historiques, pour un apprentissage en masse. Le nettoyage se ferait localement, dans le navigateur.
5. **Si les mots-clés restent insuffisants :** une version avec IA serait bien plus fiable sur du texte libre, mais seulement avec l'accord de l'employeur (données clients).

## Structure du projet

```
fall-klassifizierung/
├── CLAUDE.md            (= ce récap)
├── build.js             node build.js → dist/Fall-Klassifizierung_DE.html
├── src/
│   ├── data.js          classifications, mots-clés, synonymes, abréviations, exemples intégrés
│   ├── engine.js        moteur : nettoyage, abréviations, règles, apprentissage, choix des 3
│   └── template.html    interface (allemand), marqueurs /*__DATA__*/ et /*__ENGINE__*/
├── dist/
│   └── Fall-Klassifizierung_DE.html   fichier livré (généré, ne pas modifier à la main)
└── tests/
    ├── run-tests.js     tous les tests (-v pour voir les erreurs)
    ├── debug.js         node tests/debug.js "texte" → texte nettoyé + règles déclenchées
    ├── browser-test.js  test dans le navigateur (Playwright, optionnel)
    └── *.json           jeux de test (phrases inventées)
```

Toujours modifier `src/`, puis lancer `node build.js`, puis `node tests/run-tests.js`. Seul Node est nécessaire.

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
- `BEISPIELE` : exemples intégrés au format `{ t: "texte", c: "code" }`. Vide pour l'instant.

## Moteur (`src/engine.js`) : points clés

- **Score :** somme pondérée des règles. Le poids dépend de la rareté du terme parmi les 331 classes (IDF). Une phrase qui décrit un problème (leider, nicht, fehlt, kaputt, bitte, ?…) compte 1, les autres 0,6.
- **Cas appris :**
  - similarité cosinus sur des racines de mots, sans les mots vides ni les mots trop fréquents dans le domaine (Kunde, Fotobuch, Paket, Bestellung, bekommen…) ;
  - il faut au moins 2 mots en commun, sauf si la similarité atteint 0,6 ;
  - bonus = 40 × (sim − 0,2) / 0,8.
- **Sélection :** 3 propositions au maximum. Seuils : score d'au moins 2,5 et d'au moins 35 % du meilleur. Les propositions suivantes sont préférées si elles couvrent d'autres mots du texte ou une autre catégorie.
- **Paramètres** en tête de fichier : `WIN`, `MAX_RESULTS`, `EX_WEIGHT`, `EX_MIN`.

## Les classifications

- 331 codes, répartis en 4 domaines (Marketing, Operations, Finance, Product & Tech), avec les groupes de la 2e liste envoyée par Tom.
- **Fusion des deux listes :**
  - la 2e liste a ajouté 3728, 50208 et 20815 ;
  - elle a renommé 3709 (« Keine Rückmeldung Kunde ») et 515 (« Zustellungsbeschwerde ») ;
  - 351, 411 et 372 n'existent que dans la 1re liste ; ils ont été gardés.
- **Sens incertain, donc peu de mots-clés :** 20814 Bad Order, 20604 Produktprüfung, 50204 Direct Payment.
- **Limite de fond :** beaucoup de codes décrivent le même symptôme avec une cause différente (Herstellung / Softwarefehler / erreur du client / Maschinenfehler ; HP / Xerox / Canon ; gerechtfertigt / Kulanz). Souvent, le texte seul ne permet pas de trancher.

## Règles de travail avec Tom

- Répondre en français.
- **Données clients :**
  - ne jamais mettre de données personnelles réelles dans les fichiers du projet (noms, adresses, e-mails, téléphones, numéros de commande) ;
  - demander des cas anonymisés ;
  - l'envoi de vrais cas à une IA doit être autorisé par l'employeur.
- Ne pas deviner à l'aveugle : partir des vrais cas de Tom, mesurer, puis corriger.
- Rester honnête sur ce que les tests prouvent.
- L'outil doit rester un seul fichier HTML hors ligne, sans envoi de données.

## Formats utiles

`tests/real_cases.json`, pour mesurer la précision sur de vrais cas. La 1re ligne ci-dessous est un exemple inventé.

```json
[
  ["Kd. hat FB n. erh., Tracking seit 5 Tagen unverändert", ["50407", "50410"]],
  ["<texte collé ou note, anonymisé>", ["<code choisi>"]]
]
```

Si plusieurs codes sont indiqués, ils sont tous acceptés. Un 3e élément, optionnel, liste les codes qui ne doivent pas apparaître.

Export de l'outil (section « Gelernte Fälle ») :

```json
{ "app": "Fall-Klassifizierung", "version": 1, "exportiert": "…",
  "beispiele": [ { "t": "texte nettoyé", "c": "50410", "d": "2026-09-24" } ] }
```
