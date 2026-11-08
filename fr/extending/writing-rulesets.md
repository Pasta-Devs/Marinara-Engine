# Écrire des ensembles de règles Game Mode

Un ensemble de règles explique à Game Mode le fonctionnement d'un système sur table : les dés d'un test, le contenu de la fiche de personnage, les ressources dépensées et ce qu'un repos rend. Écris-en un pour faire entrer ton propre système dans Game Mode et le partager. Pour jouer avec un ensemble de règles créé par quelqu'un d'autre, consulte [Jouer avec un ensemble de règles](../game/rulesets.md).

Un ensemble de règles est un fichier JSON. Ce sont des données, pas du code : rien ne s'y exécute, et l'importer ne peut pas nuire à ton ordinateur. Lis le texte du Game Master avant d'importer le fichier de quelqu'un d'autre, car ce texte est envoyé au modèle dans toutes les parties qui utilisent cet ensemble de règles.

## Commencer un ensemble de règles

1. Copie le fichier d'exemple qui correspond à la façon dont ton système lance les dés :
   - [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) est un petit système à 2d6 avec trois attributs. Il montre que rien dans le format ne suppose un d20 ou six caractéristiques.
   - [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) est une petite réserve de dés à dix faces avec trois valeurs et six métiers.
   - Le [package officiel 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014), un exemple complet. Son `ruleset.json` et son dossier `catalogs/` sont ce qu'Agent Organizer installe.
2. Remplace `id` par le tien. Un identifiant se compose de minuscules, de chiffres et de tirets simples, comme `ember-roads`.
3. Ouvre ta copie dans un éditeur de texte comme le Bloc-notes ou VS Code, et enregistre-la avec l'extension `.json`. Change d'abord `name`, puis les noms des attributs dans `sheet`, puis `rests` et le texte `gm`. [Parties du fichier](#parts-of-the-file) liste chaque clé, et [Pages de référence](#reference-pages) donne les liens vers les pages qui les expliquent.
4. Importe-le (voir [Essayer ton ensemble de règles](#try-your-ruleset)). L'importation vérifie tout le fichier et signale les erreurs, ligne par ligne, avant d'enregistrer quoi que ce soit.
5. Crée une nouvelle partie (voir [Game Mode : premiers pas](../game/getting-started.md)), choisis ton ensemble de règles sous **Rules** (règles) et joue quelques tests.

Si ça n'a pas marché, consulte [Dépannage](#troubleshooting).

Pour obtenir de l'aide dans ton éditeur pendant la saisie, ajoute cette ligne en première position à l'intérieur des accolades extérieures du fichier. Elle indique le JSON Schema à l'éditeur :

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

Le schéma repère les clés mal écrites et les mauvais types. Il ne peut pas vérifier que les noms désignent des éléments qui existent, par exemple une compétence qui nomme un attribut. L'importation s'en charge. Tu peux ajouter une ligne `"$comment": "..."` à n'importe quel objet pour te laisser une note. Le moteur l'ignore.

## Ce qu'un ensemble de règles peut et ne peut pas faire

Un ensemble de règles remplit les paramètres d'une mécanique que le moteur connaît déjà. Le moteur connaît cinq façons de résoudre un test, et ton fichier en choisit une avec `resolution.kind` :

- **`dice-sum`** : lancer des dés, ajouter des nombres de la fiche et atteindre ou dépasser une difficulté. Cela couvre les systèmes d20, ceux à 2d6 plus attribut et bien d'autres.
- **`dice-pool`** : lancer le nombre de dés propre au personnage et compter ceux qui atteignent une cible. Cela couvre les systèmes où une valeur représente une poignée de dés plutôt qu'un bonus.
- **`dice-highest`** : lancer une réserve et lire son plus haut dé, ou additionner ses quelques plus hauts. Cela couvre Blades in the Dark et Trophy Dark.
- **`roll-against`** : obtenir un résultat inférieur ou égal (ou supérieur ou égal) au nombre de la fiche. Cela couvre les compétences en pourcentage et les tests de GURPS.
- **`symbol-pool`** : constituer et améliorer des dés narratifs, puis annuler les symboles opposés. Cela couvre les tests de Genesys, et ses combats depuis Capability API 1.382.

Les cinq sont décrits intégralement dans [Types de résolution](ruleset-checks.md#resolution-kinds).

Une mécanique qui n'entre pas dans ces formes, comme les réserves opposées, ne peut pas s'écrire dans un fichier d'ensemble de règles. Elle exige un nouveau type de résolution dans le moteur, c'est-à-dire une contribution de code avec des tests. Si ton système en a besoin, ouvre une demande de fonctionnalité sur le dépôt du moteur et décris la mécanique avec quelques jets détaillés. Ces jets deviennent les tests.

Game Mode résout un combat soit avec le combat propre à Marinara, soit avec les règles de ton ensemble. Le bloc facultatif `battle` prête au combat de Marinara les nombres de tes fiches de personnage : consulte [Batailles](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). Le bloc facultatif `combat` définit comment l'ensemble de règles résout lui-même le combat : consulte [Combat](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). Le réglage Combat Preference (préférence de combat) de la partie choisit la présentation Turn-Based ou, si l'ensemble de règles définit une distance, un champ de bataille Tactical. Un ensemble de règles peut limiter ceux que ses parties utilisent avec `combat.styles` (voir [Les styles qu'une partie peut utiliser](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

<a id="parts-of-the-file"></a>

## Parties du fichier

| Clé | Contenu |
| --- | --- |
| `schemaVersion` | Toujours `1`. |
| `id`, `version` | Le nom de ton ensemble de règles pour le moteur, et un entier que tu augmentes chaque fois que tu publies un changement. |
| `name` | Ce que les joueurs voient dans l'assistant de configuration. |
| `edition` | Facultatif. Une ligne sur l'édition ou le brouillon dont il s'agit. |
| `license` | Facultatif. Un identifiant SPDX et le texte d'attribution exigé par ta source. |
| `coverage` | Ce que couvre l'ensemble de règles, plus le résumé d'une ligne affiché dans l'assistant de configuration. |
| `resolution` | Comment se lance un test ou une sauvegarde. |
| `sheet` | Tout le contenu de la fiche de personnage. |
| `rests` | Ce que chaque type de repos restaure et efface. |
| `gm` | Le texte donné au modèle du Game Master, et les valeurs de fiche qu'il voit pour chaque personnage. |
| `catalogs` | Facultatif. Des entrées toutes prêtes que propose l'éditeur de fiche, pour que les joueurs ne saisissent pas de longues listes à la main. |
| `items` | Facultatif. Les mots dans lesquels tes objets sont écrits : catégories, raretés, statistiques, emplacements, monnaie. |
| `battle` | Facultatif. Ce qu'une bataille peut lire dans la fiche, et ce qu'elle y réécrit ensuite. |
| `combat` | Facultatif. Comment un combat est résolu par tes propres règles, et ce que joue ensuite l'écran de bataille. |
| `layers` | Facultatif. Des variantes de ton ensemble de règles qu'un joueur active à la création d'une partie. |

Le fichier peut atteindre 512 KB (256 KB avant Capability API 1.340). Le texte qui finit dans un prompt (noms, libellés, texte du Game Master) ne peut pas contenir de sauts de ligne, de crochets ni de doubles accolades.

Les identifiants de la fiche (attributs, compétences, champs, réserves, etc.) se composent de minuscules, de chiffres et de traits de soulignement, et commencent par une lettre, comme `grit_max`.

<a id="reference-pages"></a>

## Pages de référence

Cette page explique comment commencer, essayer et partager un ensemble de règles. Les autres pages traitent chacune d'un sujet :

- [Tests des ensembles de règles](ruleset-checks.md) : les cinq types de résolution, les bandes de résultat, les tests qui se lancent à leur façon et les dépenses ou les charmes qui modifient un jet.
- [Fiches des ensembles de règles](ruleset-sheets.md) : attributs, compétences, champs et listes, états vivants, pistes de blessures, pénalités, repos, texte du Game Master, fiche d'équipe et décomptes de progression.
- [Catalogues des ensembles de règles](ruleset-catalogs.md) : les entrées toutes prêtes que l'éditeur de fiche propose dans un sélecteur.
- [Mécaniques des entrées des ensembles de règles](ruleset-mechanics.md) : le bloc `mechanics` d'une entrée de catalogue, lu par les tests, les repos et les combats.
- [Assistant de création de personnages des ensembles de règles](ruleset-character-builder.md) : créer un personnage par étapes, de la race et de la classe aux scores, aux maîtrises, aux sorts et à l'équipement.
- [Objets des ensembles de règles](ruleset-items.md) : catégories, armes, armures, munitions, butin, argent, équipement de départ et marchés.
- [Combat des ensembles de règles](ruleset-combat.md) : le bloc `battle` et le bloc `combat`, avec le bestiaire, le plateau, les réactions et les confrontations.
- [Couches, traductions et migrations des ensembles de règles](ruleset-layers-and-translations.md) : les variantes qu'un joueur active pour une partie, les traductions et le déplacement de valeurs vers de nouveaux identifiants quand une fiche change.

<a id="try-your-ruleset"></a>

## Essayer ton ensemble de règles

Avant de commencer, active **Allow custom Agent imports** (autoriser l'importation d'agents personnalisés) dans **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger). Les ensembles de règles importés utilisent le même interrupteur de sécurité que les agents importés : il reste désactivé tant que tu ne l'actives pas. L'importation exige aussi un accès localhost ou le secret d'administration (**Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur)).

1. Ouvre le panneau **Agents** et choisis le bouton **Import agents** (importer des agents), l'icône de téléchargement dans la rangée de boutons en haut du panneau.
2. Choisis **Game Mode ruleset** (ensemble de règles Game Mode) et sélectionne ton fichier JSON, ou un fichier de package d'ensemble de règles qui se termine par `.ruleset.json` (voir [Partager ton ensemble de règles](#sharing-your-ruleset)).
3. Lis l'examen. Il montre le nom, la version, la licence, ce que couvre l'ensemble de règles et le texte du Game Master. Choisis **Import** (importer).

Ton ensemble de règles apparaît dans la section **Rules** du panneau et dans le choix **Rules** de l'assistant de configuration des nouvelles parties. Un ensemble de règles importé depuis un fichier est classé sous `local/<your id>`, pour ne jamais être confondu avec un ensemble officiel ou celui de quelqu'un d'autre.

### Modifier un ensemble de règles déjà importé

Une version importée n'est jamais réécrite. Si tu importes un fichier modifié avec la même `version`, l'importation est refusée et te demande d'augmenter le numéro. Une partie est liée à la version exacte utilisée à sa création, pour qu'une campagne en cours ne change jamais de calculs.

Pendant la rédaction, le cycle est : modifier, augmenter `version`, importer, commencer une nouvelle partie. Les anciennes versions restent installées à côté de la nouvelle jusqu'à ce que tu retires l'ensemble de règles de la section **Rules**. Si tu retires un ensemble de règles qu'une partie utilise encore, cette partie signale que son ensemble de règles manque, jusqu'à ce que tu le réimportes.

Si tu changes la structure de la fiche (ajout, suppression ou renommage d'éléments), augmente aussi `sheet.version`. Les fiches existantes sont lues avec tolérance : les valeurs que la nouvelle fiche ne connaît pas sont conservées, et les valeurs manquantes prennent leur valeur par défaut.

<a id="sharing-your-ruleset"></a>

## Partager ton ensemble de règles

Il existe cinq façons de le partager.

### Sous forme de fichier

Envoie le fichier JSON à un ami. Il l'importe de la même façon que toi.

### Sous forme de fichier de package

Un ensemble de règles trop gros pour un seul fichier, avec des catalogues dans leurs propres fichiers, voyage sous la forme d'un simple fichier JSON nommé `<name>.ruleset.json`. Il contient le manifeste du package et les documents de l'ensemble de règles, chacun stocké en base64 (une façon d'écrire un fichier en texte brut) :

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

Le manifeste liste `ruleset.json` et chaque `catalogs/<id>.json` dans `contributions.assets.paths` et dans `files`, avec la taille et le sha256 (une empreinte du fichier) de chacun. Un éditeur d'ensembles de règles comme Pixelforge en crée un. **Import agents** → **Game Mode ruleset** prend le fichier et affiche le même examen que pour un fichier d'ensemble de règles, avec chaque catalogue et son nombre d'entrées.

Le fichier est lu comme des données et n'est jamais installé comme un package. Rien n'y est compressé : il ne contient donc jamais plus que sa propre taille. Limites :

- Il est classé sous `local/<its id>`, comme un fichier d'ensemble de règles.
- Il fait au plus 132 MB, avec au plus 12 fichiers de catalogue de 2 MB chacun et 40 traductions de 8 MB chacune (voir ci-dessous).
- Une version, c'est son ensemble de règles et ses catalogues réunis : un catalogue modifié exige donc aussi une `version` plus élevée.
- Les packages d'ensembles de règles ne sont pas acceptés sous forme de zip.

Il est refusé, avec la raison, si :

- il contient une autre clé ou tout autre fichier, ou un document qui n'est pas du base64 strict ou pas du texte UTF-8
- son manifeste demande plus que ce dont un ensemble de règles a besoin (du code, des permissions ou d'autres contributions)
- un fichier n'est pas celui que liste le manifeste
- un `$comment` dépasse 2 000 caractères, ou `$schema` nomme autre chose que le propre schéma du moteur
- l'ensemble de règles ou un catalogue ne peut pas être lu

### Par le catalogue officiel d'agents

Un ensemble de règles publié dans le catalogue est un fichier de package d'ensemble de règles ayant exactement cette forme, `<id>.ruleset.json`, jamais un package zip. Son manifeste déclare Capability API 1.374 ou plus récent, pour qu'un moteur plus ancien ne se le voie jamais proposer. Le moteur le lit avec le même lecteur et les mêmes vérifications qu'un fichier de package que tu importes, le vérifie par rapport au manifeste que liste le catalogue et l'installe comme tout package du catalogue. Un ensemble de règles du catalogue dont l'artefact est un zip est refusé avant tout téléchargement ; les ensembles de règles déjà installés continuent de fonctionner.

### Depuis un dépôt GitHub

Si tu conserves ton travail dans un dépôt GitHub public, place chaque ensemble de règles dans un dossier `rulesets` à la racine du dépôt, un fichier par ensemble de règles :

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Un utilisateur ajoute ton dépôt une seule fois, examine son contenu et le synchronise plus tard pour recevoir les nouvelles versions. La liste des dépôts personnalisés est une fonction avancée. La personne qui gère le serveur l'active avec `ENABLE_CUSTOM_AGENT_REPOS=true`, puis ouvre **Agents → Agent Organizer → Custom Sources** (Agents → organisateur d'agents → sources personnalisées). Les ensembles de règles d'un dépôt sont classés sous le nom du propriétaire du dépôt, comme `alice/ember-roads`, pour que deux auteurs puissent chacun publier un ensemble de règles nommé `v20` sans conflit.

Deux limites s'appliquent. Un dépôt peut contenir au maximum 32 fichiers JSON directement dans `rulesets`, et un dépôt qui en contient plus est refusé. Un compte nommé `local` ne peut pas publier d'ensembles de règles, car `local/` est réservé aux ensembles de règles importés depuis un fichier.

### Dans le catalogue officiel

Un système largement joué, dont la licence est claire, peut être proposé à tous via **Agent Organizer**. Pour en proposer un, ouvre une pull request sur le dépôt [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Consulte le package `ruleset-5e-2014` qui s'y trouve pour sa structure.

## Licences

Ne publie que du texte de règles que tu as le droit de partager. Beaucoup de systèmes publient un document de référence sous licence ouverte, et c'est ce document que tu peux copier. Place l'identifiant de licence (un identifiant SPDX, un nom standard court comme `CC-BY-4.0`) et le texte d'attribution exigé par la licence sous `license`. Ne copie pas le texte de livres de règles qui ne sont pas sous licence ouverte. Un ensemble de règles a surtout besoin de noms et de nombres. Rédige le texte du Game Master dans tes propres mots.

<a id="troubleshooting"></a>

## Dépannage

- **L'importation dit qu'un nom n'existe pas.** Quelque chose dans le fichier pointe vers un identifiant non déclaré, comme une compétence qui nomme un attribut que tu as supprimé. Le message donne le chemin vers la ligne.
- **L'importation dit qu'une version est déjà installée avec un contenu différent.** Augmente `version` et réimporte.
- **Mon ensemble de règles n'apparaît pas dans l'assistant de configuration.** Vérifie que **Allow custom Agent imports** est activé. Tant qu'il est désactivé, les ensembles de règles importés sont exclus des nouvelles parties, et les parties qui en utilisent déjà un continuent de fonctionner.
- **Une partie dit que son ensemble de règles manque.** La version exacte utilisée à la création de la partie n'est pas installée. Réimporte cette version du fichier.
