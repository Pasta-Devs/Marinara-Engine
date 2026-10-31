# Écrire des ensembles de règles Game Mode

Un ensemble de règles explique à Game Mode le fonctionnement d'un système sur table : les dés d'un test, le contenu de la fiche, les ressources dépensées et ce qu'un repos rend. Ce guide s'adresse à ceux qui veulent en écrire un et le partager. Pour jouer avec celui d'une autre personne, commence par [Jouer avec un ensemble de règles](../game/rulesets.md).

Un ensemble est un fichier JSON. Ce sont des données, pas du code. Rien ne s'y exécute, donc l'importer ne peut rien faire à ton ordinateur. Avant d'importer un fichier d'autrui, lis attentivement le texte du Game Master : il est envoyé au modèle dans toutes les parties utilisant cet ensemble.

## À lire d'abord : ce qu'un ensemble peut et ne peut pas faire

Un ensemble ne peut que remplir les paramètres d'une mécanique déjà connue du moteur. Aujourd'hui, celui-ci connaît cinq façons de résoudre un test ; ton fichier en choisit une avec `resolution.kind` :

- **`dice-sum`** : lancer des dés, ajouter des nombres de la fiche et atteindre ou dépasser une difficulté. Cela couvre les systèmes d20, ceux à 2d6 plus attribut et bien d'autres.
- **`dice-pool`** : lancer le nombre de dés du personnage et compter ceux qui atteignent une cible. Cela couvre les systèmes où une valeur représente une poignée de dés plutôt qu'un bonus.

- **`dice-highest`** : lancer une réserve et lire son plus haut dé, ou additionner ses quelques plus hauts. Cela couvre Blades in the Dark et Trophy Dark.
- **`roll-against`** : obtenir un résultat inférieur ou égal (ou supérieur ou égal) au nombre de la fiche. Cela couvre les compétences en pourcentage et les tests de GURPS.
- **`symbol-pool`** : constituer et améliorer des dés narratifs, puis annuler les symboles opposés. Cela couvre les tests de Genesys, et ses combats depuis Capability API 1.382.

Les cinq sont décrits intégralement dans [Types de résolution](ruleset-checks.md#resolution-kinds).

Une mécanique qui n'entre dans aucune de ces formes ne peut pas s'écrire dans le fichier. Les réserves opposées en sont un exemple. Chacune exige un nouveau type de résolution dans le moteur : une contribution de code avec des tests, pas un JSON. Si ton système en a besoin, ouvre une demande de fonctionnalité sur le dépôt du moteur et décris la mécanique avec quelques jets détaillés. Ces exemples deviennent les tests.

Game Mode peut résoudre un combat avec les règles de Marinara ou celles de ton ensemble. Le bloc facultatif `battle` prête au combat Marinara les nombres des fiches : consulte [Batailles](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). Le bloc facultatif `combat` définit comment ton ensemble résout le combat : consulte [Combat](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). Le moteur applique déjà ces règles. Combat Preference (Préférence de combat) choisit la présentation Classic ou, si l'ensemble définit une distance, un champ Tactical. Un ensemble de règles peut limiter les styles utilisés par ses parties avec `combat.styles` (voir [Les styles qu'une partie peut utiliser](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

## Démarrage rapide

1. Copie l'exemple correspondant aux jets de ton système. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) est un petit système à 2d6 et trois attributs montrant que le format ne suppose ni d20 ni six caractéristiques. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) est une petite réserve de dés à dix faces avec trois valeurs et six métiers. Pour un exemple complet, consulte le [package officiel 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) : son `ruleset.json` et son dossier `catalogs/` sont ce qu'Agent Organizer installe.
2. Remplace `id` par le tien. Il utilise minuscules, chiffres et tirets simples, comme `ember-roads`.
3. Modifie la fiche, les repos et le texte du Game Master.
4. Importe-le ; consulte [Essayer ton ensemble](#trying-your-ruleset). L'importation vérifie tout le fichier et indique les erreurs ligne par ligne avant de sauvegarder quoi que ce soit.
5. Crée une partie, choisis ton ensemble sous **Rules** (Règles) et joue quelques tests.

Pour une aide pendant la saisie, indique le JSON Schema à ton éditeur en ajoutant cette première ligne à l'intérieur des accolades extérieures du fichier :

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

Le schéma repère les clés mal écrites et les mauvais types pendant la saisie. Il ne vérifie pas que les noms désignent des éléments existants, par exemple une compétence nommant un attribut. L'importation s'en charge.

Tu peux ajouter une ligne `"$comment": "..."` à n'importe quel objet pour te laisser une note. Le moteur l'ignore.

## Les parties du fichier

| Clé | Contenu |
| --- | --- |
| `schemaVersion` | Toujours `1`. |
| `id`, `version` | Le nom de l'ensemble pour le moteur et un entier que tu augmentes à chaque changement publié. |
| `name` | Ce que voient les joueurs dans l'assistant. |
| `edition` | Facultatif. Une ligne sur l'édition ou le brouillon. |
| `license` | Facultatif. Un identifiant SPDX et l'attribution exigée par ta source. |
| `coverage` | Ce que couvre l'ensemble et le résumé d'une ligne affiché dans l'assistant. |
| `resolution` | Comment lancer un test ou une sauvegarde. |
| `sheet` | Tout le contenu de la fiche. |
| `rests` | Ce que chaque repos restaure et efface. |
| `gm` | Le texte donné au modèle du Game Master et les valeurs de fiche qu'il voit par personnage. |
| `catalogs` | Facultatif. Les entrées préparées que propose l'éditeur pour éviter de saisir de longues listes. |
| `items` | Facultatif. Les mots dans lesquels tes objets sont écrits : catégories, raretés, statistiques, emplacements, monnaie. |
| `battle` | Facultatif. Ce qu'une bataille lit dans la fiche et y réécrit ensuite. |
| `combat` | Facultatif. Comment tes règles résolvent un combat et ce que joue l'écran de bataille. |
| `layers` | Facultatif. Les variantes activées par le joueur à la création d'une partie. |

Le fichier peut atteindre 512 KB (256 KB avant Capability API 1.340). Le texte destiné à un prompt (noms, libellés, texte du Game Master) ne peut pas contenir de sauts de ligne, de crochets ni de doubles accolades.

Les identifiants de la fiche (attributs, compétences, champs, réserves, etc.) utilisent minuscules, chiffres et traits de soulignement, en commençant par une lettre, comme `grit_max`.

## Les pages de ce guide

Cette page explique ce qu'est un ensemble de règles, comment commencer à en créer un, puis comment l'essayer et le partager. Le reste du guide est organisé par sujet :

- [Tests des ensembles de règles](ruleset-checks.md) : Comment un ensemble de règles résout un test ou une sauvegarde : les cinq types de résolution, les bandes de résultat, les tests qui se lancent à leur façon et les dépenses ou les charmes qui modifient un jet
- [Fiches des ensembles de règles](ruleset-sheets.md) : Ce qui figure sur la fiche de personnage d'un ensemble de règles : attributs, compétences, champs et listes, états vivants, pistes de blessures, pénalités, repos et texte du GM (maître du jeu), ainsi que la fiche d'équipe et les décomptes de progression
- [Catalogues des ensembles de règles](ruleset-catalogs.md) : Les entrées préparées que l'éditeur de fiche propose dans un sélecteur : l'en-tête du catalogue, les entrées, les valeurs maintenues par l'ensemble de règles, les commandes de fiche et la commande d'utilisation
- [Mécaniques des entrées des ensembles de règles](ruleset-mechanics.md) : Ce que fait une entrée de catalogue en chiffres : le bloc `mechanics` d'une entrée, lu par les tests, les repos et les combats
- [Assistant de création de personnages des ensembles de règles](ruleset-character-builder.md) : L'assistant de création guidée : créer un personnage par étapes, de la race et de la classe aux scores, aux maîtrises, aux sorts et à l'équipement
- [Objets des ensembles de règles](ruleset-items.md) : Ce que transporte une équipe : catégories, armes, armures, munitions, butin, argent, équipement de départ et marchés
- [Combat des ensembles de règles](ruleset-combat.md) : Comment un ensemble de règles intervient dans un combat : le bloc `battle`, qui prête la fiche au combat de Marinara, et le bloc `combat`, qui résout l'intégralité du combat selon les règles propres à l'ensemble, avec son bestiaire, son plateau, ses réactions et ses confrontations
- [Couches, traductions et migrations des ensembles de règles](ruleset-layers-and-translations.md) : Les variantes qu'un joueur active pour une partie, les traductions du texte d'un ensemble de règles et le transfert des valeurs vers de nouveaux identifiants quand une fiche change

<a id="trying-your-ruleset"></a>

## Essayer ton ensemble de règles

Les ensembles de règles communautaires utilisent le même interrupteur que les agents importés. Ouvre **Settings** (réglages) > **Advanced** (avancé) > **Danger Zone** (zone de danger) et vérifie que **Allow custom Agent imports** (autoriser l'importation d'agents personnalisés) est activé. L'importation nécessite aussi un accès localhost ou **Admin Access** (accès administrateur) configuré.

1. Ouvre le panneau **Agents** (agents) et choisis le bouton **Import agents** (importer des agents), l'icône de téléchargement dans la rangée de boutons en haut du panneau.
2. Choisis **Game Mode ruleset** (ensemble de règles Game Mode) et sélectionne ton fichier JSON, ou un fichier de package d'ensemble qui se termine par `.ruleset.json` (voir [Partager ton ensemble de règles](#sharing-your-ruleset)).
3. Lis l'examen. Il montre le nom, la version, la licence, ce que couvre l'ensemble de règles et le texte du Game Master. Choisis **Import** (importer).

Ton ensemble apparaît dans la section **Rules** (règles) du panneau et dans le choix **Rules** de l'assistant de configuration des nouvelles parties. Un ensemble importé depuis un fichier est classé sous `local/<your id>`, pour ne jamais être confondu avec un ensemble officiel ou celui de quelqu'un d'autre.

### Modifier un ensemble de règles déjà importé

Une version importée n'est jamais réécrite. Si tu modifies le fichier et le réimportes avec la même `version`, l'importation est refusée et te demande d'augmenter le numéro. C'est volontaire : une partie est liée à la version exacte utilisée à sa création, pour qu'une campagne en cours ne se réveille jamais avec des calculs différents.

Pendant la rédaction, le cycle est donc : modifier, augmenter `version`, importer, commencer une nouvelle partie. Les anciennes versions restent installées à côté de la nouvelle jusqu'à ce que tu retires l'ensemble de règles de la section **Rules**. Retirer un ensemble encore utilisé par une partie fait signaler à celle-ci que son ensemble de règles manque, jusqu'à sa réimportation.

Si tu changes la structure de la fiche (ajout, suppression ou renommage d'éléments), augmente aussi `sheet.version`. Les fiches existantes sont lues avec tolérance : les valeurs inconnues de la nouvelle fiche sont conservées, et les valeurs manquantes prennent leur valeur par défaut.

<a id="sharing-your-ruleset"></a>

## Partager ton ensemble de règles

**Sous forme de fichier.** Envoie le fichier JSON à un ami. Il l'importe comme toi.

**Sous forme de fichier de package.** Un ensemble trop gros pour un seul fichier, avec des catalogues dans leurs propres fichiers, voyage sous la forme d'un simple fichier JSON nommé `<name>.ruleset.json`. Il contient le manifeste du package et les documents de l'ensemble, chacun sous forme de ses octets exacts en base64 :

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

Le manifeste liste `ruleset.json` et chaque `catalogs/<id>.json` dans `contributions.assets.paths` et dans `files`, avec la taille et le sha256 de chacun. Un éditeur d'ensembles comme Pixelforge en crée un. **Import agents** → **Game Mode ruleset** prend le fichier et affiche le même examen que pour un fichier d'ensemble, avec chaque catalogue et son nombre d'entrées. Rien n'y est compressé : il ne contient donc jamais plus que sa propre taille. Il est lu comme des données et n'est jamais installé comme un package : il est refusé, avec la raison, s'il contient autre chose (une autre clé, tout autre fichier, un document qui n'est pas du base64 strict ou pas du texte UTF-8), si son manifeste va au-delà de celui d'un ensemble (du code, des permissions ou d'autres contributions), si un fichier n'est pas celui que liste le manifeste, si un `$comment` dépasse 2 000 caractères ou si `$schema` nomme autre chose que le propre schéma du moteur, ou si l'ensemble ou un catalogue ne peut pas être lu. Il est classé sous `local/<its id>` comme un fichier d'ensemble, 132 MB au plus, avec au plus 12 fichiers de catalogue de 2 MB chacun et 40 traductions de 8 MB chacune (voir ci-dessous). Une version, c'est son ensemble et ses catalogues réunis : un catalogue modifié exige donc aussi une `version` plus élevée. Les packages d'ensembles ne sont pas acceptés sous forme de zip.

**Par le catalogue officiel d'agents.** Un ensemble publié dans le catalogue est un fichier de package d'ensemble ayant exactement cette forme, `<id>.ruleset.json`, jamais un package zip (Capability API 1.374). Son manifeste déclare Capability API 1.374 ou plus récent, pour qu'un moteur plus ancien ne se le voie jamais proposer. Le moteur le lit avec le même lecteur et les mêmes vérifications qu'un fichier de package que tu importes, le vérifie par rapport au manifeste listé par le catalogue et l'installe comme tout package du catalogue. Un ensemble du catalogue dont l'artefact est un zip est refusé avant tout téléchargement ; les ensembles déjà installés continuent de fonctionner.

**Depuis un dépôt GitHub.** Si tu conserves ton travail dans un dépôt GitHub public, place chaque ensemble de règles dans un dossier `rulesets` à la racine, un fichier par ensemble :

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Un utilisateur ajoute ton dépôt une seule fois via la liste des dépôts d'agents personnalisés, examine son contenu et peut le synchroniser plus tard pour recevoir les nouvelles versions. Cette liste est une fonction avancée que la personne qui gère le serveur doit activer avec `ENABLE_CUSTOM_AGENT_REPOS=true`. Les ensembles de règles d'un dépôt sont classés sous le nom de son propriétaire, comme `alice/ember-roads`, pour que deux auteurs puissent chacun publier un ensemble nommé `v20` sans conflit.

Deux limites s'appliquent. Un dépôt peut contenir au maximum 32 fichiers JSON directement dans `rulesets` ; au-delà, il est refusé. Un compte nommé `local` ne peut publier d'ensembles de règles, car `local/` est réservé à ceux importés depuis un fichier.

**Dans le catalogue officiel.** Un système largement joué, dont les licences sont claires, peut être proposé à tous via **Agent Organizer** (organisateur d’agents). Cela passe par une pull request au dépôt [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Consulte le package `ruleset-5e-2014` pour sa structure.

## Licences

Ne publie que du texte de règles que tu as le droit de partager. Beaucoup de systèmes publient un document de référence sous licence ouverte ; c'est ce document que tu peux copier. Place l'identifiant de licence et le texte d'attribution exigé sous `license`. Ne copie pas le texte de livres de règles sans licence ouverte. Un ensemble de règles a surtout besoin de noms et de nombres, et le texte du Game Master doit être rédigé dans tes propres mots.

## Dépannage

- **L'importation dit qu'un nom n'existe pas.** Quelque chose dans le fichier pointe vers un identifiant non déclaré, comme une compétence nommant une caractéristique supprimée. Le message donne le chemin vers la ligne.
- **L'importation dit qu'une version est déjà installée avec un contenu différent.** Augmente `version` et réimporte.
- **Mon ensemble de règles n'apparaît pas dans l'assistant de configuration.** Vérifie que **Allow custom Agent imports** est activé. Lorsqu'il est désactivé, les ensembles importés sont exclus des nouvelles parties. Les parties qui en utilisent déjà un continuent de fonctionner.
- **Une partie dit que son ensemble de règles manque.** La version exacte utilisée à sa création n'est pas installée. Réimporte cette version du fichier.
