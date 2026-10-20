# Écrire des ensembles de règles Game Mode

Un ensemble de règles explique à Game Mode le fonctionnement d'un système sur table : les dés d'un test, le contenu de la fiche, les ressources dépensées et ce qu'un repos rend. Ce guide s'adresse à ceux qui veulent en écrire un et le partager. Pour jouer avec celui d'une autre personne, commence par [Choisir les règles](../game/getting-started.md#choosing-rules).

Un ensemble est un fichier JSON. Ce sont des données, pas du code. Rien ne s'y exécute, donc l'importer ne peut rien faire à ton ordinateur. Avant d'importer un fichier d'autrui, lis attentivement le texte du Game Master : il est envoyé au modèle dans toutes les parties utilisant cet ensemble.

## À lire d'abord : ce qu'un ensemble peut et ne peut pas faire

Un ensemble ne peut que remplir les paramètres d'une mécanique déjà connue du moteur. Aujourd'hui, celui-ci connaît cinq façons de résoudre un test ; ton fichier en choisit une avec `resolution.kind` :

- **`dice-sum`** : lancer des dés, ajouter des nombres de la fiche et atteindre ou dépasser une difficulté. Cela couvre les systèmes d20, ceux à 2d6 plus attribut et bien d'autres.
- **`dice-pool`** : lancer le nombre de dés du personnage et compter ceux qui atteignent une cible. Cela couvre les systèmes où une valeur représente une poignée de dés plutôt qu'un bonus.

- **`dice-highest`** : lancer une réserve et lire son plus haut dé, ou additionner ses quelques plus hauts. Cela couvre Blades in the Dark et Trophy Dark.
- **`roll-against`** : obtenir un résultat inférieur ou égal (ou supérieur ou égal) au nombre de la fiche. Cela couvre les compétences en pourcentage et les tests de GURPS.
- **`symbol-pool`** : constituer et améliorer des dés narratifs, puis annuler les symboles opposés. Cela couvre les tests de Genesys.

Les cinq sont décrits intégralement dans [Types de résolution](#resolution-kinds).

Une mécanique qui n'entre dans aucune de ces formes ne peut pas s'écrire dans le fichier. Les réserves opposées en sont un exemple. Chacune exige un nouveau type de résolution dans le moteur : une contribution de code avec des tests, pas un JSON. Si ton système en a besoin, ouvre une demande de fonctionnalité sur le dépôt du moteur et décris la mécanique avec quelques jets détaillés. Ces exemples deviennent les tests.

Game Mode peut résoudre un combat avec les règles de Marinara ou celles de ton ensemble. Le bloc facultatif `battle` prête au combat Marinara les nombres des fiches : consulte [Batailles](#battles-lending-the-sheet-to-marinaras-combat). Le bloc facultatif `combat` définit comment ton ensemble résout le combat : consulte [Combat](#combat-a-fight-your-own-rules-resolve). Le moteur applique déjà ces règles. **Combat Preference** (Préférence de combat) choisit la présentation Classic ou, si l'ensemble définit une distance, un champ Tactical.

## Démarrage rapide

1. Copie l'exemple correspondant aux jets de ton système. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) est un petit système à 2d6 et trois attributs montrant que le format ne suppose ni d20 ni six caractéristiques. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) est une petite réserve de dés à dix faces avec trois valeurs et six métiers. Pour un exemple complet, consulte le fichier 5e (SRD 5.1), [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json).
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

<a id="resolution-kinds"></a>

### Types de résolution

`resolution.kind` choisit le jet. Tous les types lisent la même fiche et partagent trois clés ; les parties du fichier après `resolution` ne changent donc pas quand tu passes de l'un à l'autre :

- `abilityModifier` : comment une valeur de fiche devient un nombre. `identity` utilise la valeur elle-même ; `floorHalfMinusTen` est la règle 5e ; `stepTable` permet de définir tes seuils sous la forme `[[score, number], ...]`.
- `proficiencyTiers` : les niveaux d'entraînement d'une compétence ou sauvegarde. Le premier s'applique à une compétence non renseignée. Un niveau ajoute `flat`, ou `multiplier` fois un bonus de maîtrise, ou les deux. Si ton système possède ce bonus, indique sa source avec `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency` : facultatif, nécessaire seulement pour un niveau qui multiplie.

Le sens du nombre dépend du type : `dice-sum` l'ajoute au jet ; `dice-pool` et `dice-highest` lancent ce nombre de dés. `symbol-pool` garde l'attribut et l'entraînement séparés pour constituer et améliorer des dés narratifs.

#### `dice-sum` : additionner les dés

```json
"resolution": {
  "kind": "dice-sum",
  "dice": { "count": 2, "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained" },
    { "id": "trained", "label": "Trained", "flat": 1 }
  ],
  "advantage": false,
  "difficultyLadder": [
    { "label": "Easy", "dc": 6 },
    { "label": "Hard", "dc": 10 }
  ]
}
```

- `dice` : nombre de dés et de faces. Le total est comparé à la difficulté.
- `advantage` : si le Game Master peut demander deux jets et en garder un.
- `naturals` : effet des faces minimale et maximale d'un seul dé sur les tests et sauvegardes : `none`, `both`, `max-only` ou `min-only`. Omets-le pour une simple addition. Il exige un seul dé : un système 2d6 doit utiliser `none`.
- `dice.faces` : la valeur de chaque face, de la plus basse à la plus haute, lorsque les faces ne valent pas leur propre numéro (Capability API 1.136). Les quatre dés Fudge de Fate s'écrivent `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }` : la carte affiche −, vide et + et les additionne, et les probabilités sont exactement celles de Fate. Donne une valeur par face.
- `openEnded` : un seul dé qui continue de rouler (1.136). Une face égale ou supérieure à `high` est relancée et ajoutée, et ainsi de suite tant que le nouveau dé montre `high` ou plus ; une face égale ou inférieure à `low` est relancée et retranchée, et ce jet s'enchaîne de la même façon sur `high`. Le jet de pourcentage ouvert de Rolemaster s'écrit `{ "high": 96, "low": 5 }` sur un seul d100. Un jet lance au maximum 20 dés. Les faces naturelles, et le décalage des bandes de résultat, lisent le premier dé.
- `unmodified` : faces d'un seul dé que le registre signale quand le premier dé les montre (1.136), pour pouvoir appliquer les tables qui traitent à part "un 66 non modifié" : `[66, 100]`. Le registre indique `unmodified="66"`, la carte aussi, et le Game Master a pour consigne d'appliquer ce que les règles en disent.
- `difficultyLadder` : difficultés parmi lesquelles le GM doit choisir. `dc` est le nombre que le total doit atteindre. Le Game Master peut nommer un palier au lieu d'écrire son nombre, comme `difficulty="Hard"`, et le moteur lit le nombre sur ce palier.

#### `dice-pool` : lancer les dés et les compter

Le nombre de la fiche est la **taille de la réserve**, pas un bonus ajouté. Une valeur de 3 et un métier valant 2 lancent cinq dés. C'est tout le principe : aucun nouveau vocabulaire de fiche ni nouvel éditeur ; un système aux valeurs exprimées en poignées de dés utilise les mêmes `abilities`, `skills` et `proficiencyTiers` que les autres.

```json
"resolution": {
  "kind": "dice-pool",
  "die": { "sides": 10 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "rating_0", "label": "Untried" },
    { "id": "rating_1", "label": "Shown once", "flat": 1 }
  ],
  "pool": { "min": 1, "max": 15, "abilityPlusAbility": true },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10, "min": 8 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "reroll": [{ "id": "careful", "upTo": 6, "mode": "once" }],
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die` : nombre de faces d'un dé de la réserve, de 2 à 100.
- `pool` : limites appliquées au nombre de la fiche avant toute explosion. Un `min` de 0 laisse une réserve vide échouer sans jet ; `max` ne dépasse pas 100. `abilityPlusAbility: true` permet à un test d'attribut de nommer un second attribut avec `with=` et de lancer les deux, pour les systèmes qui lancent deux attributs ensemble ; sans lui, `with=` ne signifie rien sur un test d'attribut.
- `target` : face à atteindre pour compter. Mets `min` sous `max` pour permettre au GM de la déplacer par test avec `threshold=` ; rends les trois valeurs identiques pour la fixer.
- `double` : facultatif. Une face égale ou supérieure à `from` compte deux fois.
- `explode` : facultatif. Une face égale ou supérieure à `from` lance un dé supplémentaire, qui peut lui-même exploser. Les dés supplémentaires sont plafonnés à `pool.max` en plus de la réserve initiale : un test lance au maximum deux fois `pool.max` dés et un `from` bas ne peut pas provoquer des jets infinis.
- Les deux peuvent porter un `min` : la face la plus basse jusqu'à laquelle un test peut abaisser la règle, avec `explode="N"` ou `double="N"` sur la balise ou une entrée utilisée par le personnage. Avec un `min`, tu peux omettre `from` : la règle ne se déclenche alors que sur un test qui la demande. Une spécialité qui fait relancer les dix sur une seule compétence s'écrit `"explode": { "min": 10 }`. `from` ne peut pas être inférieur à `min`.
- `cancel` : facultatif. Une face égale ou inférieure à `upTo` retire une réussite. Le compte ne descend jamais sous zéro.
- `botch` : facultatif. Si **aucun** dé n'a réussi et qu'une face égale ou inférieure à `upTo` est sortie, le test est un échec critique. Une réserve dont l'unique réussite a été annulée a échoué, mais n'a pas fait de maladresse critique. `"rule": "halfOrMore"` le lit autrement : des faces égales ou inférieures à `upTo` sur au moins la moitié des dés lancés au départ (explosions non comptées) donnent un échec critique si aucun dé n'a réussi ; sinon, le résultat est maintenu et marqué `complication="true"`, quelque chose tourne mal en même temps. `"noSuccesses"` est la valeur par défaut.
- `exceptional` : facultatif. Ce nombre de réussites nettes ou plus, sur un test réussi, donne une réussite critique.
- `situationalDice` : facultatif. Limites des dés ajoutés ou retirés par le GM avec `bonus=` pour une prouesse, des blessures ou une mauvaise lumière.
- `reroll` : facultatif. Des relances que le système accorde sans que personne ne les paie, jusqu'à six, chacune avec un `id` que le Game Master nomme sur un test avec `reroll=`. Les faces égales ou inférieures à `upTo` sont relancées : `"once"`, et la nouvelle face reste quelle qu'elle soit, ou `"until"`, jusqu'à ce qu'elles montrent plus. `upTo` va de 1 au nombre de faces du dé moins un, puisqu'une relance de toutes les faces ne s'arrêterait jamais, et un `until` s'arrête de toute façon après cent relances sur un même test. Aucune n'est lancée si le test ne la nomme pas. Un test lance une seule relance : si une dépense ou une entrée utilisée par le personnage en a aussi acheté une, celle qui atteint le plus de faces est lancée, et `until` l'emporte sur `once` à faces égales.
- `difficultyLadder` : `successes` indique le nombre de réussites nécessaire. Un palier peut nommer un `target`, seulement si la cible est réglable et dans ses limites. C'est avec cette cible que compte un test à ce palier : quand le Game Master nomme le palier avec `difficulty=`, ou écrit un `dc=` qu'exige un seul palier. Si plusieurs paliers exigent le même nombre de réussites, `dc=` seul ne peut pas dire lequel était visé : la cible reste celle par défaut ; nomme le palier.

- `target.from` : facultatif. Lit la cible de chaque personnage sur sa fiche, comme le Number de Lasers & Feelings, qu'un personnage choisit une seule fois (n'importe quelle référence de valeur : un attribut, un champ, une valeur dérivée). Elle est maintenue dans `min`..`max`, et `threshold=` ne la déplace pas, car ce nombre appartient au personnage ; un seuil acheté par une entrée utilisée par le personnage la déplace toujours. Le `threshold=` du registre indique ce qui a servi.
- `stances` : facultatif. Jusqu'à six, chacune avec un `id`, un `label`, `count` (`"below"` ou `"above"`) et les `skills` qu'elle couvre. Un test sur l'une de ces compétences compte les dés **sous** la cible, ou **au-dessus**, au lieu de ceux qui l'atteignent ou la dépassent : Lasers & Feelings a une posture Lasers qui compte en dessous et une posture Feelings qui compte au-dessus, chaque compétence appartenant à l'une d'elles. Une compétence ne peut appartenir qu'à une seule posture. Les postures excluent `explode`, `double`, `cancel` et `botch`, qui se lisent par rapport à "égal ou supérieur".
- `exact` : facultatif. Un dé qui montre exactement la cible : `label` le nomme (`"LASER FEELINGS"`), `text` peut dire ce qu'il fait à la table, et il compte comme une réussite sauf si `counts` vaut `false`. Le registre porte `exact="N"`, le nombre de ces dés, et la carte des dés l'affiche à côté du résultat, pour que le Game Master puisse donner au joueur l'éclairage que ce dé lui vaut.

Les faces de `cancel` et `botch` doivent être inférieures à la cible minimale, et toutes les faces nommées par ces règles doivent exister sur le dé. Une règle impossible à déclencher est refusée à l'importation plutôt que découverte en jeu.

Un ensemble en package utilisant des réserves relève de Capability API 1.24 ; un `min` sur `explode` ou `double`, `pool.abilityPlusAbility` et `botch.rule` relèvent de 1.37 ; `reroll`, de 1.38 ; `target.from`, `stances` et `exact`, de 1.137. Un ensemble communautaire importé est validé par le moteur qui le lit et n'a donc besoin de rien d'autre.

#### Ce que le Game Master peut écrire sur un test de réserve

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc` est le nombre de **réussites** demandé, pas une cible par dé. Il va de 1 au maximum que pourrait compter un jet : maximum de la réserve, doublé si les dés explosent, puis doublé encore si les faces comptent deux fois.
- `threshold=` déplace la cible par dé et n'est proposé que si `target.min` est inférieur à `target.max`.
- `bonus=` ajoute ou retire des dés et n'est proposé que si `situationalDice` est déclaré.
- `with=` lance une compétence ou sauvegarde avec un autre attribut. Il fonctionne pour les deux types ; 5e obtient ainsi "Strength (Intimidation)" par le même attribut. Sur un test d'attribut, il ajoute plutôt un second attribut, si `pool.abilityPlusAbility` est activé.
- `difficulty=` nomme un palier de l'échelle à la place de `dc=`, pour les deux types : ses réussites (ou sa difficulté pour une somme) et, pour une réserve, sa cible. Un `dc=` écrit à côté l'emporte toujours pour le nombre, et `threshold=` pour la cible. Un nom auquel aucun palier ne répond, ou que deux paliers partagent, est ignoré.
- `explode=` et `double=` déplacent les faces de ces règles pour ce test et ne sont proposés que si la règle a un `min`.
- `reroll=` nomme l'une de tes entrées `reroll` pour ce test et n'est proposé que si tu en as déclaré. Un nom auquel aucune ne répond est ignoré.

Tout respecte ton fichier : une valeur hors limites est ramenée à l'extrémité la plus proche et un attribut absent est ignoré sans refuser le test. Le registre montre ce qui a réellement servi : la difficulté et la cible sous forme de nombres, les dés supplémentaires après limitation, `with=` seulement si l'attribut a été remplacé ou ajouté, une face seulement si le test l'a déplacée, `reroll=` seulement si la relance nommée est celle qui a été lancée et a relancé quelque chose, et `complication="true"` quand une maladresse `halfOrMore` a mal tourné à côté d'un résultat. Le moteur lance toujours les dés. Il remplace tout résultat de réserve écrit par le modèle, ignore `mode="advantage"` puisque le type n'a pas d'avantage et n'utilise pas un dé lancé par le joueur avant le tour.

#### `dice-highest` : lancer les dés et lire le plus haut

Blades in the Dark et Trophy Dark lancent une poignée de d6 et ne lisent que le plus haut. Capability API 1.138.

```json
"resolution": {
  "kind": "dice-highest",
  "die": { "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "rating_0", "label": "0" }, { "id": "rating_1", "label": "1", "flat": 1 }],
  "pool": { "min": 0, "max": 6 },
  "zeroDice": "lowest-of-two",
  "critical": { "count": 2 },
  "situationalDice": { "min": -1, "max": 2 },
  "difficultyLadder": [{ "label": "Partial", "dc": 4 }, { "label": "Full", "dc": 6 }],
  "outcomes": {
    "by": "total",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "full", "label": "Full success", "atLeast": 6, "success": true },
      { "id": "partial", "label": "Partial success", "atLeast": 4, "success": true, "text": "You do it, with a consequence." },
      { "id": "bad", "label": "Bad outcome" }
    ]
  }
}
```

- Le nombre de la fiche est le nombre de dés, comme pour une réserve, maintenu dans `pool` (20 au maximum). Les blessures, `adjust`, les états et les objets ajoutent ou retirent des dés.
- `keep` : facultatif, de 1 à 3, 1 par défaut. Le nombre de dés les plus hauts qui sont additionnés : 1 pour Blades, 2 pour les combats de Trophy Dark.
- `zeroDice` : ce que fait un personnage sans dé. `"lowest-of-two"` (par défaut) en lance deux et garde le plus bas, sans jamais pouvoir donner de critique ; `"fail"` échoue sans jet.
- `critical` : facultatif. `count` dés montrant la face maximale (ou `face` et plus) donnent une réussite critique : les deux six de Blades.
- `dark` : facultatif, les dés sombres de Trophy Dark. `label`, `max` (de 1 à 10) et `text`. Le Game Master les ajoute à un test avec `dark="N"`. `outcome` vaut `"all"` par défaut : ils sont lus avec les autres. Avec `"outcome": "light"` (Capability API **1.149**), seuls les dés clairs décident des dés gardés, du total, des bandes de résultat et des critiques. S'il n'y a aucun dé clair, `zeroDice` s'applique au côté clair : lancer deux dés clairs et garder le plus bas, ou échouer tout en lançant les dés sombres. Les dés sombres sont toujours lancés et enregistrés en dernier ; `darkHighest="true"` signifie qu'un dé sombre a battu strictement chaque dé clair (dés clairs de repli compris ; si aucun n'a été lancé, n'importe quel dé sombre l'emporte). Ce que cela coûte (Ruin), c'est au Game Master de l'appliquer. Déclarer `dark.outcome`, même à `"all"`, exige capabilityApi 1.149.
- `situationalDice` : facultatif, les dés que le Game Master peut ajouter ou retirer avec `bonus=` (une aide, un effort supplémentaire).
- `spend` ne peut acheter que des dés.
- `difficultyLadder` : paliers avec `dc`, le nombre que les dés gardés doivent atteindre. `dc=` sur un test est ce nombre, de 1 à `keep` fois le nombre de faces du dé.
- `outcomes` lit `by: "total"` sur les dés gardés, et une bande `on: "critical-success"` capte le critique.

Le registre garde la forme d'une somme (`resolution="sum"`, `modifier="0"`, les dés gardés comme total) et ajoute `highest="1"`, avec `zeroDice="true"` et `dark="N"` quand ils s'appliquent ; les dés sombres sont les derniers de `rolls`. Un résultat lu sur les seuls dés clairs enregistre aussi `darkOutcome="light"`, pour que la carte ne mette en évidence que les dés clairs gardés, y compris après un rechargement. Un ensemble de ce type n'a pas de combat propre : `combat` est donc refusé à côté.

#### `roll-against` : obtenir au plus (ou au moins) le nombre de la fiche

Call of Cthulhu, GURPS et les pourcentages du voleur des anciennes éditions se lancent contre un nombre de la fiche au lieu de s'ajouter aux dés. Capability API 1.139.

```json
"resolution": {
  "kind": "roll-against",
  "dice": { "count": 1, "sides": 100 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "base", "label": "Base" }],
  "against": "at-most",
  "criticalSuccess": [{ "from": 1, "to": 1 }],
  "criticalFailure": [{ "from": 100, "to": 100 }, { "from": 96, "whenTarget": { "below": 50 } }],
  "tens": { "max": 2 },
  "difficultyLadder": [
    { "label": "Regular", "dc": 0 },
    { "label": "Hard", "dc": 0, "divide": 2 },
    { "label": "Extreme", "dc": 0, "divide": 5 }
  ],
  "outcomes": {
    "by": "fraction",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "extreme", "label": "Extreme success", "atLeast": 5, "success": true },
      { "id": "hard", "label": "Hard success", "atLeast": 2, "success": true },
      { "id": "regular", "label": "Regular success", "atLeast": 1, "success": true },
      { "id": "fail", "label": "Failure" },
      { "id": "fumble", "label": "Fumble", "on": "critical-failure" }
    ]
  }
}
```

- Le nombre de la fiche pour le test est la cible. Le pourcentage d'une compétence est le bonus par compétence de la fiche (`bonusRange` monte jusqu'à 100), sans attribut ni bonus de niveau ; une compétence GURPS vaut son attribut plus ce bonus.
- `dice` : ce qui est lancé et additionné, 1d100 par défaut (3d6 pour GURPS, 1d20 pour un jet de sauvegarde).
- `against` : `"at-most"` (par défaut) réussit à la cible ou en dessous, `"at-least"` à la cible ou au-dessus.
- `difficultyLadder` : le `dc` de chaque palier déplace la cible, et `divide` (de 2 à 10) divise d'abord le nombre de la fiche. Le Game Master nomme un palier avec `difficulty=` ; un `dc=` sur la balise déplace le nombre, de -100 à 100. Le `dc` du registre est le nombre contre lequel le jet a été lu, et le registre indique `against="at-most"`.
- `criticalSuccess` et `criticalFailure` : jusqu'à six règles chacun. Une règle nomme des faces (`from`, `to`, l'une ou l'autre pouvant rester ouverte) ou, pour un échec, `pastTarget`, un jet au moins aussi éloigné du côté de l'échec. `whenTarget` (`atLeast`, `below`) limite une règle à certaines cibles : le 5 de GURPS n'est une réussite critique qu'à 15 ou plus. Une réussite critique réussit toujours et un échec critique échoue toujours.
- `tens` : facultatif, sur un seul d100 uniquement. `bonus="+N"` lance N dés des dizaines de plus et garde le meilleur jet, `bonus="-N"` le pire, jusqu'à `max`.
- `outcomes` peut lire `by: "fraction"` sur un jet `at-most` : l'`atLeast` de chaque bande divise la cible, et un jet égal ou inférieur à cette part tombe dans la bande. Les mesures `margin` (l'écart sous la cible) et `total` fonctionnent aussi.

#### `symbol-pool` : lancer des dés narratifs et lire les symboles

Genesys constitue une réserve à partir d'une caractéristique et d'un rang de compétence, puis ajoute des dés opposés. Les faces portent réussite, avantage, triomphe, échec, menace et désespoir au lieu de nombres. Capability API 1.141.

```json
"resolution": {
  "kind": "symbol-pool",
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained", "flat": 0 },
    { "id": "rank_one", "label": "Rank 1", "flat": 1 }
  ],
  "symbols": [
    { "id": "s", "label": "Success" },
    { "id": "f", "label": "Failure", "cancels": "s" },
    { "id": "a", "label": "Advantage" },
    { "id": "h", "label": "Threat", "cancels": "a" },
    { "id": "t", "label": "Triumph", "counts": "s" },
    { "id": "d", "label": "Despair", "counts": "f" }
  ],
  "dice": [
    { "id": "ability", "label": "Ability", "faces": [[], ["s"], ["s"], ["s", "s"], ["a"], ["a"], ["s", "a"], ["a", "a"]] },
    { "id": "proficiency", "label": "Proficiency", "faces": [[], ["s"], ["s"], ["s", "s"], ["s", "s"], ["a"], ["s", "a"], ["s", "a"], ["s", "a"], ["a", "a"], ["a", "a"], ["t"]] },
    { "id": "difficulty", "label": "Difficulty", "faces": [[], ["f"], ["f", "f"], ["h"], ["h"], ["h"], ["h", "h"], ["f", "h"]] },
    { "id": "challenge", "label": "Challenge", "faces": [[], ["f"], ["f"], ["f", "f"], ["f", "f"], ["h"], ["h"], ["f", "h"], ["f", "h"], ["h", "h"], ["h", "h"], ["d"]] },
    { "id": "boost", "label": "Boost", "faces": [[], [], ["s"], ["s", "a"], ["a", "a"], ["a"]] },
    { "id": "setback", "label": "Setback", "faces": [[], [], ["f"], ["f"], ["h"], ["h"]] }
  ],
  "success": { "symbol": "s", "needed": 1 },
  "pool": { "die": "ability", "upgrade": "proficiency", "max": 6 },
  "difficulty": { "die": "difficulty", "upgrade": "challenge", "max": 5 },
  "boost": { "die": "boost", "max": 3 },
  "setback": { "die": "setback", "max": 3 },
  "criticalSuccess": "t",
  "criticalFailure": "d",
  "difficultyLadder": [{ "label": "Easy", "dc": 1 }, { "label": "Average", "dc": 2 }, { "label": "Hard", "dc": 3 }]
}
```

- `symbols` : de 2 à 10 symboles nommés. `counts` ajoute aussi un exemplaire d'un autre symbole avant l'annulation : un triomphe ajoute une réussite et reste un triomphe. Il nomme un symbole qui n'a pas de `counts` propre ; les chaînes et les références à soi-même sont refusées. `cancels` associe deux symboles un pour un, avec au plus un partenaire chacun. La déclaration inverse est facultative. `text` explique un symbole au Game Master.
- `dice` : de 2 à 8 dés nommés, chacun avec 2 à 20 faces. Les faces sont des tableaux d'au plus trois identifiants de symboles ; `[]` est une face vide et un identifiant répété compte deux fois. Toutes les références doivent exister.
- `pool` : `larger-upgraded` (par défaut) lance le plus grand de l'attribut et du rang, en améliorant le plus petit nombre quand `upgrade` est déclaré. `sum` additionne les deux et n'en améliore aucun. `max` vaut 6 par défaut et ne peut pas dépasser 12. L'attribut passe par `abilityModifier` : utilise donc `identity` pour les caractéristiques de Genesys. Le rang vient du niveau d'entraînement de la compétence ou de la sauvegarde ; un test d'attribut brut a un rang nul. `with=` remplace la caractéristique comme sur les autres tests. Les bonus de la fiche, les blessures, les ajustements et les effets ajoutent des dés de fortune (boost) ou d'infortune (setback) par le bonus signé ci-dessous.
- `difficulty` : `dc=` compte les dés opposés de 0 à `max` (5 par défaut, plafond 12). `difficulty=` nomme plutôt un palier de l'échelle. `upgrade="N"` remplace autant de dés opposés par le dé amélioré, dans la limite du nombre réellement lancé. Il n'ajoute jamais de dés au-delà de la difficulté.
- `boost` et `setback` : dés facultatifs ajoutés respectivement par `bonus="+N"` et `bonus="-N"`, jusqu'au `max` de chacun (3 par défaut, plafond 6). Les ajustements signés se combinent avant l'application de cette limite. Capability API **1.150** accepte aussi `setback="N"` de façon indépendante : `bonus="2" setback="1"` lance les deux côtés. Un bonus négatif s'ajoute à `setback`, le nombre combiné de dés d'infortune restant limité à `setback.max` ; les dés de fortune restent bornés par `boost.max`.
- `allowOwnUpgrade` : facultatif, faux en son absence. Avec `true`, `upgradeOwn="N"` améliore N dés de personnage de plus en `pool.upgrade` (qui doit être déclaré), après les améliorations de la fiche et les dés achetés. Quand tous les dés existants sont améliorés, chaque amélioration supplémentaire ajoute un dé amélioré, toujours dans la limite de `pool.max`. Cela fonctionne aussi avec `pool.build: "sum"`. Déclarer cette clé, même à `false`, exige capabilityApi **1.150**. Les noms d'attributs de balise s'écrivent en camel case, comme `zeroDice` ; `upgradeOwn` agit sur le lanceur et `upgrade` n'agit toujours que sur les dés de difficulté. `setback` et `upgradeOwn` prennent tous deux des entiers positifs ou nuls et sont ignorés hors des réserves à symboles ; `upgradeOwn` est ignoré s'il n'est pas activé.
- `success` : exige ce nombre de son symbole après annulation, un par défaut. La réussite et l'échec critiques signalent toute occurrence de leur symbole nommé, même si la réussite ou l'échec qu'il ajoute est annulé. Les deux marqueurs peuvent apparaître ensemble, et aucun ne change le fait que les réussites nettes passent le test ou non.
- `outcomes` peut lire le nombre de réussites nettes (`total`) ou `net successes - needed + 1` (`margin`). Les bandes décident toujours de la réussite à leur manière habituelle ; les symboles critiques d'origine restent signalés. `spend` n'achète que des dés de personnage de base supplémentaires, dans la limite de `pool.max`. Le combat est exclu, comme pour `dice-highest`.
- Le registre garde `resolution="sum"`, avec `symbols="2s 1a 1t"`, `thrown=` qui identifie chaque dé et `rolls=` qui contient sa face (numérotée à partir de 1). Le `symbolDetails` encodé conserve les libellés, les symboles des faces et les deux marqueurs critiques. `setback` enregistre les dés d'infortune indépendants réellement ajoutés après la limite commune, et `upgradeOwn` les améliorations supplémentaires réellement appliquées ; les ajouts ignorés ou nuls sont omis. La carte et le résumé nomment les symboles nets, résultat vide compris, au lieu d'additionner des numéros de faces. Les remplacements peuvent modifier les règles de ce type, mais pas remplacer `symbols` ni `dice`.

#### Ce qui reste hors périmètre, et pourquoi

Ces mécaniques ont encore besoin de leur propre type de résolution :

- **Réserves opposées** résolvent deux personnages à la fois ; un test n'a qu'un lanceur.
- **Réserves additionnées avec un dé spécial** (comme dans OpenD6) additionnent les dés en traitant l'un d'eux à part.

Les deux éléments autrefois exclus sont maintenant modélisés ; la section sur les dépenses pour modifier un jet, ci-dessous, explique comment. Une règle du système lui-même, "spend a point for a success" ou "spend a point to throw the failures again", est `resolution.spend`. Une relance que le système accorde gratuitement quand la situation l'exige est `resolution.reroll`, ci-dessus. Celle qui appartient à un élément choisi par le personnage est `mechanics.check` sur une entrée de catalogue, payée avec le coût de cette entrée.

### Bandes de résultat : plus que réussite ou échec

Beaucoup de systèmes lisent un test comme l'un de plusieurs résultats plutôt qu'une simple réussite ou un simple échec : les quatre degrés de réussite de Pathfinder, un "de justesse" qui réussit à un prix, les réussites majeures et extrêmes de Call of Cthulhu, la "réussite avec style" de Fate. `resolution.outcomes` nomme ces bandes, et le moteur indique sur chaque test dans laquelle il est tombé (Capability API 1.135). Cela fonctionne avec tous les types de résolution.

```json
"outcomes": {
  "by": "margin",
  "naturals": "shift",
  "tiers": [
    { "id": "critical_success", "label": "Critical success", "atLeast": 10, "success": true, "critical": true },
    { "id": "success", "label": "Success", "atLeast": 0, "success": true },
    { "id": "failure", "label": "Failure", "atLeast": -9 },
    { "id": "critical_failure", "label": "Critical failure", "critical": true }
  ]
}
```

- `by` : ce sur quoi les bandes sont lues. `"margin"` (par défaut) est l'écart entre le résultat et ce que le test exigeait : un total additionné moins sa difficulté, ou les réussites nettes d'une réserve moins les réussites nécessaires. `"total"` est le résultat lui-même : le total additionné, ou les réussites nettes, quelle qu'ait été la difficulté.
- `tiers` : de deux à huit bandes, **la meilleure d'abord**. `atLeast` est le plus petit nombre qui tombe dans une bande ; celui de chaque bande est inférieur à celui de la précédente, et la dernière bande n'en a pas, car elle capte tout ce qui est en dessous. `success` indique si la bande est une réussite, et `critical` la marque comme critique dans son genre (une réussite critique quand `success` est vrai, un échec critique sinon). Au moins une bande doit réussir et au moins une doit échouer. `text` est une ligne facultative, jusqu'à 200 caractères, qui dit au Game Master ce que la bande signifie à la table ("You do it, but the Game Master adds a complication").
- `on` : `"critical-success"` ou `"critical-failure"` fait d'une bande celle où tombe un critique, quoi que dise le nombre, et rien d'autre n'y tombe jamais. Elle n'a pas d'`atLeast`, une bande sur une réussite critique est une réussite et une bande sur un échec critique n'en est pas une, et il y en a au plus une de chaque. Les "deux six" de Blades in the Dark sont une bande sur une réussite critique placée au-dessus de la bande d'un seul six ; les autres bandes, celles lues sur le nombre, suivent entre elles les règles ci-dessus.
- `naturals: "shift"` : la face la plus haute d'un seul dé déplace le résultat d'une bande vers le meilleur, et sa face la plus basse d'une bande vers le pire, sans jamais dépasser les extrémités. Il exige un seul dé et remplace `resolution.naturals` : mets donc les deux à `none` à côté.

La bande décide du résultat : la réussite et les deux critiques en découlent, jamais de la simple comparaison. Quand les `naturals` d'un ensemble additionné font d'une face une réussite ou un échec automatique, cette face tombe dans la bande de ce critique, ou sinon dans la meilleure ou la pire bande, et reste un critique. La maladresse d'une réserve fait de même en bas, et une réserve avec des bandes laisse `exceptional` de côté, car les bandes disent déjà ce qu'est une réussite critique.

Une réserve lue avec `by: "total"` est la façon dont un système à difficulté fixe exprime ses résultats : le "1 success: you barely manage it, 2: you do it well, 3: critical success" de Lasers & Feelings, ce sont trois bandes à 3, 2 et 1 réussites et un échec en dessous.

Le registre nomme la bande avec `outcome="Critical success"`, la carte des dés l'affiche à la place du simple mot, et le Game Master apprend les bandes et leur `text`, avec la consigne de raconter la bande. Un ensemble en package qui déclare des bandes nécessite Capability API 1.135.

### Les tests qui se lancent à leur façon

Certains jeux lancent la plupart des tests d'une façon et quelques-uns d'une autre : un jeu à l'ancienne lance un d20 sous une valeur d'attribut, mais les compétences d'un voleur sur un d100 et Open Doors sur un d6. `resolution.overrides` nomme ces tests et les clés de résolution avec lesquelles ils se lancent à la place. Capability API 1.140.

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- Chaque remplacement nomme des `skills`, des `saves` ou des `abilities` (un ou plusieurs des trois), un `label` et un `text` facultatif pour le Game Master.
- `set` contient des clés de résolution du type propre à l'ensemble, qui remplacent celles de l'ensemble pour ces tests. `null` retire une clé : les 1 d'exwod qui n'annulent pas sur un attribut favori s'écrivent `"cancel": null`. Le type, le calcul de la fiche (`abilityModifier`, `proficiency`, `proficiencyTiers`, `penaltyFrom`, `spend`, `adjust`) et `difficultyLadder` ne peuvent pas être modifiés. Une réserve à symboles verrouille aussi ses `symbols` et ses `dice`. La résolution produite par un remplacement est vérifiée comme celle de l'ensemble : une face qu'il nomme doit donc exister sur ses dés.
- `when` : facultatif. Une valeur de la fiche du lanceur ; le remplacement ne s'applique que là où elle ne vaut pas 0, par exemple un champ numérique à 0 ou 1 pour un attribut favori. Sans lui, le remplacement s'applique toujours.
- Le premier remplacement qui nomme le test et dont le `when` est vérifié est celui qui sert. Un test figure dans au plus un remplacement sans `when`.

### Dépenser pour modifier un jet

Certains systèmes permettent de payer un jet à venir : un point de volonté pour une réussite automatique. `resolution.spend` l'exprime comme règle permanente du système, plutôt que comme achat propre à un personnage :

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` désigne l'une de tes `live.pools`. Elle ne peut pas commencer vide : il n'y aurait rien à dépenser au début de la partie.
- `amount` est le coût d'UN achat. `successes`, `dice` et `reroll` indiquent ce qu'il achète ; il faut au moins l'un d'eux. Les réussites sont ajoutées après le comptage et les annulations, puisque personne ne les a lancées. Les dés sont lancés avec la réserve, dans ses limites. Un `reroll` s'écrit `{ "upTo": 6, "mode": "once" }`, se lit comme `resolution.reroll` et n'est acheté qu'une fois, quel que soit le nombre d'achats du test : un dé relancé deux fois reste une seule relance.
- `perCheck` limite le nombre d'achats d'un test : il peut acheter au maximum pour `amount * perCheck` points. Cela empêche une réserve pleine d'acheter un jet impossible à perdre. C'est un nombre de 1 à 10, une valeur de la fiche sous la même forme que celle lue par une valeur dérivée (`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`), ou `"pool"` : autant que le test a de dés, c'est-à-dire le nombre de la fiche pour ce test avant blessures, dés bonus ou modificateurs. Une valeur de la fiche est lue pour la personne qui lance, arrondie vers le bas et maintenue entre 0 et 100 ; un personnage dont la limite vaut 0 n'achète rien et ne paie rien.
- Un ensemble `dice-pool` peut acheter des réussites, des dés ou des relances. `dice-highest` et `symbol-pool` n'achètent que des dés. Les autres types ne peuvent pas déclarer `spend`.
- Jusqu'à quatre entrées, et deux ne peuvent pas nommer la même réserve, sinon le test ne pourrait pas les distinguer.
- Une dépense qui achète un `reroll`, un `perCheck` qui n'est pas un nombre et plus de deux entrées relèvent de Capability API 1.38 pour un ensemble en package.

**Cela se place sur le test lui-même.** Le GM écrit `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`, pas une commande `[sheet:]` séparée : les dés sont lancés avant d'appliquer les commandes de fiche et il ne resterait rien à modifier. Une seule résolution lance les dés et paie ce qui les a modifiés.

### Un charme qui modifie un jet

`resolution.spend` est une règle du système. Une entrée réellement CHOISIE par le personnage peut aussi modifier un test, avec `mechanics.check` sur son entrée de catalogue :

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll` relance les dés égaux ou inférieurs à `upTo`. `once` remplace chacun une fois et garde la nouvelle face ; `until` continue. `upTo` doit être inférieur à la face maximale, sinon toute la réserve serait relancée indéfiniment. Le moteur plafonne le nombre de dés relançables par test, quoi que dise le fichier.
- `dice` ajoute des dés avant le jet ; `successes` ajoute des réussites après comptage ; `threshold` fixe la cible par dé de ce jet dans la plage autorisée par `target`.
- `explode` et `double` déplacent les faces de ces règles pour ce seul jet, uniquement si ta règle a un `min` et sans descendre en dessous : `"check": { "explode": 8 }` est une entrée qui fait relancer les huit. Ils l'emportent sur ce que le Game Master a écrit sur la balise, comme `threshold`. Capability API 1.37.
- Il faut au moins l'un d'eux, sinon l'entrée ne dit rien et est refusée.
- Seul `dice-pool` peut les appliquer ; un ensemble `dice-sum` avec `mechanics.check` est refusé à l'importation.

**Le coût est le `cost` de l'entrée**, payé par le même mécanisme que tout autre usage : la réserve et une utilisation de chaque compteur écrit par cette entrée. `perCostStep` indique qu'elle CHANGE D'ÉCHELLE : si elle le déclare, elle est achetée autant de fois que son prix a été payé ; sinon, elle est achetée une seule fois, quelle que soit la somme offerte.

**Le GM la nomme sur le test :** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Pas dans une commande de fiche séparée, pour la même raison : les dés sont lancés avant la mise à jour des comptes.

**Tout ou rien.** Si la réserve ne suffit pas, aucun achat ni prélèvement n'a lieu ; le jet reste celui qu'il aurait été. Des points ne correspondant pas à un nombre entier d'achats n'achètent rien non plus. Une demande au-delà de `perCheck` est plafonnée plutôt que refusée, et seul ce plafond est payé. Le moteur calcule tout cela ; le GM nomme la dépense annoncée par le joueur sans toucher aux dés. Le registre indique ce qui a vraiment été payé, l'entrée appliquée, les réussites non lancées et le nombre de dés relancés. Un charme non choisi, ou dont le moteur ne peut pas lire le catalogue, ne fait rien au lieu d'être appliqué sur confiance.

### La fiche

- `sections` regroupe les éléments dans l'éditeur. Les champs, valeurs dérivées et listes nomment avec `section` celle où ils se trouvent, et les attributs, compétences et sauvegardes le peuvent aussi : l'éditeur, la fiche de la partie et le bloc de fiche du Game Master les montrent alors sous ce titre (une fiche qui ne leur nomme aucune section les montre exactement comme avant). Une section peut aussi porter une règle `untrained` (ci-dessous).
- `abilities` contient les valeurs principales. `skills` et `saves` peuvent nommer l'attribut de leur jet, un `cap` et une règle `untrained` (ci-dessous).
- `fields` contient des valeurs simples. Types : `number`, `text`, `longtext`, `boolean`, `enum` (liste fixe de choix) et `dice` (texte comme `1d8`).
- Les valeurs `derived` sont calculées depuis d'autres valeurs et ne peuvent pas être écrasées à la saisie. Une fiche peut en avoir jusqu'à 400 (Capability API 1.111 ; 240 à partir de 1.88, 120 à partir de 1.84, 60 avant) ; un package qui en a plus de 240 déclare 1.111. Opérations : `sum`, `min`, `max`, `scale` (multiplier par un nombre fixe et arrondir), `multiply` (deux à six valeurs multipliées entre elles, comme un modificateur de Constitution multiplié par le niveau ; Capability API 1.82), `stepTable` (chercher dans des seuils, comme un niveau donnant un bonus de maîtrise) et `enumTable` (un nombre pour chaque valeur d'un champ enum ou d'un état vivant ; voir États vivants ci-dessous).
- `lists` contient des tableaux à colonnes personnalisées, comme équipement, sorts ou capacités. Une liste a jusqu'à 24 colonnes ; un package dont une liste en a plus de 12 déclare Capability API 1.165. Une liste avec `pools` transforme chaque ligne en ressource ayant son propre maximum, pour les capacités de classe à usages limités. Une colonne numérique peut être remplie par un jet : `"roll": { "count": 1, "sides": 8 }`, où `sides` est un nombre, une autre colonne de la même ligne (`{ "column": "die" }`, une colonne numérique ou un enum dont les valeurs se lisent comme des dés, par exemple `d8`) ou une valeur de la fiche. L'éditeur de fiche affiche un bouton Roll qui lance les propres dés du moteur et écrit le total, maintenu entre le `min` et le `max` de la colonne (Capability API 1.85).
- `live` contient ce qui change en jeu : `pools` (points de vie, emplacements de sorts, Grit), `tracks` (nombre sur une échelle, comme l'épuisement, ou piste de blessures à cases), `text` (notes courtes, comme la concentration), `conditions` et `states` (une valeur parmi un ensemble fermé, comme une forme ou une posture).

Tout ce qui lit un nombre le nomme par une référence de valeur : un objet avec exactement une clé parmi `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` et `itemStat`. Par exemple, une réserve au maximum dérivé : `"max": { "derived": "grit_max" }`.

- `listSum` additionne une colonne numérique d'une liste : `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` est facultatif et nomme une colonne booléenne ; seules les lignes où elle est activée comptent. Une cellule vide compte comme la valeur par défaut de sa colonne, et une liste cachée par `hideWhen` n'ajoute rien. Ember Roads calcule ainsi Burden à partir de l'équipement emporté par un personnage : il ne peut jamais s'écarter de la liste comme le ferait un nombre saisi. La colonne à échelle d'un catalogue ne peut pas lire une somme de liste, même par une valeur dérivée : une liste peut contenir des cellules à échelle, les siennes ou d'autres qui la relisent, et le recalcul ne se stabiliserait jamais.
- `livePool` lit ce qui reste dans l'une de tes `live.pools` (la réserve d'une ligne de liste n'en fait pas partie). `liveTrack` lit l'une de tes `live.tracks`, avec un `read` facultatif : `"value"`, sa position (par défaut) ; `"filled"`, l'écart au-dessus de son `min` ; `"remaining"`, l'écart sous son `max` ; ou, seulement sur une piste de blessures, `"penalty"`, la pénalité active. Une réserve ou une piste cachée vaut 0. Le "Harm still to take" de Gravewatch s'écrit `{ "liveTrack": "harm", "read": "remaining" }`.
- Une lecture de l'état courant prend celui-ci tel qu'il est quand un test est lancé, qu'un combat commence ou que le bloc de fiche du Game Master est écrit. S'il n'existe pas encore (l'éditeur de fiche, l'examen d'une importation), elle lit l'état de départ du jeu : une réserve pleine ou vide selon son `start`, une piste à son `default`, une piste de blessures sans marque.
- Rien de ce qui est calculé avant qu'un état courant existe ne peut le lire : le `max` d'une réserve ou d'une piste, le bonus de maîtrise, ou la colonne à échelle ou la mise à l'échelle d'un catalogue. Cela vaut aussi à travers une valeur dérivée qui le lit et à travers une compétence plafonnée par une valeur vivante, et l'importation nomme la valeur fautive.
- Ces trois références relèvent de Capability API 1.39 pour un ensemble en package.
- `itemStat` lit les objets que tient le personnage, comme la protection de l'armure qu'il porte, et suit la même règle qu'une lecture de l'état courant. Consulte [Les objets sur la fiche](#items-on-the-sheet). Capability API 1.52.

**Ce que fait un test sans entraînement.** Une compétence ou sauvegarde dans laquelle le personnage n'a aucun entraînement (son niveau est le premier) se lance normalement, sauf si l'ensemble en décide autrement avec `untrained` sur la compétence, sur la sauvegarde ou sur la section où elle se trouve (la règle propre à la compétence ou à la sauvegarde l'emporte) :

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"` : comme d'habitude (par défaut).
- `{ "by": -3 }` : ajouté au nombre du test, de -20 à 20 : des dés pour une réserve, un montant fixe pour une somme. Il fait partie du nombre que montre la fiche et que lance chaque test, avant tout `cap`.
- `"harder"` : un degré plus difficile. Pour une réserve, la cible par dé monte d'un cran (en restant dans la plage de la cible) ; il faut donc un ensemble à réserve dont la cible peut bouger. Partout ailleurs, il est refusé à l'importation, car il ne pourrait jamais changer un jet.
- `"refuse"` : le test n'est pas lancé du tout. Le moteur réécrit la demande du Game Master avec `reason="untrained"`, ce qui la règle : rien ne la lance plus tard, le Game Master apprend que le personnage ne pouvait pas tenter l'action et la narration le dit. Le point de terminaison des tests de compétence répond à un tel test par une erreur 400 (`skill_check_untrained`), et un embranchement qui en dépend ne garde aucune de ses deux issues. L'éditeur de fiche n'affiche aucun nombre pour lui.
- Un personnage sans fiche n'a aucun entraînement à lire ; aucune règle sans entraînement ne s'applique donc à lui.
- Le rappel du Game Master liste les règles sans entraînement, par section ou par compétence, pour qu'il demande des tests que le personnage peut faire.

Les sections sur les attributs, compétences et sauvegardes, et `untrained` où qu'il soit, relèvent de Capability API 1.41 pour un ensemble en package.

Une compétence ou sauvegarde peut porter un `cap`, une référence de valeur qui fixe le maximum que son test puisse jamais atteindre : une valeur qu'elle ne peut dépasser, ou une piste qui la retient. Gravewatch plafonne Soothe à la Resolve qui reste à un gardien, `"cap": { "livePool": "resolve" }`. Le nombre plafonné est celui que montre la fiche et que lance chaque test, et un échange `with=` est calculé sur le nombre avant le plafond, puis plafonné à nouveau. Un plafond ne peut pas lire un modificateur de compétence ou de sauvegarde, pas plus que la valeur dérivée qu'il lit ni aucune valeur dérivée déclarée au-dessus de celle-ci : la fiche est toujours calculée une seule fois, de haut en bas. Capability API 1.39.

`hideWhen` cache un champ, une valeur dérivée, une liste, une réserve ou une piste ordinaire selon la valeur d'un autre champ, d'exactement une façon parmi trois : `equals` une valeur, `notEquals` une valeur (caché dès que le champ contient autre chose : c'est ainsi qu'on dit "seulement pour ce type de personnage"), ou `in` une liste de valeurs. Chaque valeur nommée doit pouvoir figurer dans le champ, sinon la règle ne correspondrait jamais, et elle est vérifiée valeur par valeur ; pour `notEquals` et `in`, cela inclut la plage d'un champ numérique et la longueur d'un champ texte. La règle lit la valeur que montre l'éditeur de fiche : un champ non défini a la valeur de départ d'une fiche vierge, et une valeur enum que l'ensemble ne propose plus vaut la valeur par défaut du champ. Le fichier 5e utilise `equals` pour cacher les emplacements de sorts aux personnages qui n'en lancent pas ; Gravewatch retire l'huile de lanterne de la fiche de chaque gardien qui n'est pas de la garde de nuit avec `"hideWhen": { "field": "watch", "notEquals": "night" }`. Une couche ne peut pas retirer une valeur avec laquelle l'une de ces règles compare. Une piste de blessures ne peut pas être cachée, car les jets et les combats la lisent quoi que montre la fiche. `notEquals` et `in` relèvent de Capability API 1.39.

Le `max` d'une piste ordinaire peut être une référence de valeur plutôt qu'un nombre, pour qu'une valeur du personnage fixe sa longueur : `"max": { "field": "willpower_rating" }`. Son `min` et son `default` restent des nombres. Une piste de blessures à niveaux nommés a un `max` égal à son nombre de niveaux ; une piste à cases numérotées est aussi longue que son propre `max` (voir Cases numérotées ci-dessous). `alwaysShow: true` affiche une piste dans le bloc de fiche du Game Master même à sa valeur par défaut, pour une valeur qui compte à chaque tour ; sans lui, une piste à sa valeur par défaut est omise, car trois sauvegardes contre la mort à zéro ne disent rien. Ces trois éléments relèvent de Capability API 1.37 pour un ensemble en package.

### États vivants : une forme, une posture, une lumière

Un champ enum est choisi à la création du personnage et le reste, et un état (condition) est seulement actif ou inactif. Un **état vivant** (live state) est une valeur parmi un ensemble fermé qui change en jeu : la forme d'un métamorphe, une posture de combat, la clarté d'une lanterne.

```json
"live": {
  "states": [
    {
      "id": "stance",
      "label": "Stance",
      "values": ["guarded", "steady", "reckless"],
      "valueLabels": { "guarded": "Guarded", "steady": "Steady", "reckless": "Reckless" },
      "default": "steady"
    }
  ]
}
```

- `values` en contient de deux à quarante, chacune affichée par son entrée `valueLabels` ou telle quelle. Elles suivent la règle de tout libellé (une ligne, sans crochets ni accolades de macro) et ne contiennent jamais de guillemet double, car la commande de fiche les met entre guillemets. Jusqu'à douze états.
- `default` est le point de départ de chaque fiche, et la première valeur si tu l'omets. Seul un état éloigné de sa valeur par défaut est stocké, et une valeur stockée que l'état ne propose plus se lit comme la valeur par défaut.
- `hideWhen` retire un état d'une fiche selon la valeur d'un champ, comme pour une réserve : il n'est pas affiché, aucune commande ne le fixe, et une table (ci-dessous) le lit comme une absence de valeur.
- Le Game Master en fixe un avec `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`, en nommant l'état par son identifiant ou son libellé, et la valeur telle quelle ou par son libellé. Un état ou une valeur que la fiche n'a pas est refusé (`unknown-state`, `unknown-value`). Le moteur n'enseigne la commande et ne liste toutes les valeurs que si ton ensemble a un état, et chaque bloc de fiche indique la valeur de chaque état, valeur par défaut comprise, car "sous forme humaine" est un fait dont la narration a besoin à chaque tour.
- L'écran de fiche de la partie affiche un sélecteur pour chaque état.
- Un repos en rétablit un avec une étape de restauration qui le nomme : `{ "state": "stance", "to": "default" }`, ou `"to"` l'une de ses valeurs.

**Des nombres qui suivent.** Une valeur dérivée avec `"op": "enumTable"` donne un nombre pour chaque valeur d'un champ enum ou d'un état vivant :

```json
{
  "id": "stance_brawn",
  "label": "Stance on Brawn",
  "op": "enumTable",
  "from": { "liveState": "stance" },
  "table": { "guarded": -1, "reckless": 2 },
  "default": 0
}
```

- `from` nomme exactement l'un de `field` (un champ enum) ou `liveState`. Chaque ligne de `table` est une valeur que celui-ci peut prendre, de une à quarante. Une valeur absente de la table, et un état que la fiche cache, lisent `default` (0 si tu l'omets).
- Un champ est fixé à la création du personnage : une table indexée sur un champ peut donc alimenter un maximum. Gravewatch donne une Resolve de plus à un gardien de la garde de l'aube. Un état vivant change en jeu : une table indexée sur lui est donc une lecture de l'état courant, comme `liveTrack`, et rien de ce qui est calculé avant qu'un état courant existe ne peut la lire, directement ou par une autre valeur dérivée. C'est pourquoi la clé est `liveState` plutôt que `state` : toute lecture de l'état courant est nommée `live`, ce qui permet à toi comme à l'importation de savoir ce qu'un maximum ne peut pas utiliser.
- Pour appliquer le nombre aux dés, fais pointer `resolution.adjust` dessus (voir Modificateurs de la fiche). Ember Roads ajoute sa Stance à chaque jet de Brawn ; Gravewatch retire des dés à chaque jet de Nerve quand la lanterne est voilée ou éteinte.
- Une couche peut retirer d'un champ une valeur pour laquelle une table a une ligne. Cette ligne n'est alors simplement jamais lue tant que la couche est active.

Les états vivants, `enumTable` et une étape de repos qui nomme un `state` relèvent de Capability API 1.42 pour un ensemble en package.

### Pistes de blessures : une santé marquée sur une piste

Beaucoup de systèmes ne comptent pas de points de vie. Ils utilisent une colonne de cases, chacune pire que la précédente, dont on coche une lorsqu'on est blessé. Donne à une entrée `live.tracks` des `kinds` et soit des `levels` nommés, soit des `boxes` numérotées (ci-dessous), pour remplacer un nombre sur une échelle par une telle piste :

**Quelle forme convient à ton système ?** Une réserve enregistre COMBIEN de dégâts sont passés ; une piste enregistre combien ET le type de chaque part. Si une blessure est contondante, létale ou aggravée et que ce type importe après le coup (parce que l'aggravé guérit moins vite, ne peut pas être absorbé ou finit par tuer), il doit être conservé après le jet. Seule une marque le porte. Une réserve ne le peut pas : après soustraction des dégâts, il reste un plus petit nombre, sans souvenir de la nature des points. Voilà pourquoi `combat.damageKinds` est refusé lorsque la santé est une réserve, plutôt qu'ignoré. Une réserve peut toujours avoir `damageTypes` et un adversaire peut y résister ou en être immunisé : cela concerne la quantité qui passe, pas la nature de la blessure après le coup.

```json
{
  "id": "harm",
  "label": "Harm",
  "min": 0,
  "max": 4,
  "levels": [
    { "label": "Scuffed", "penalty": 0 },
    { "label": "Winded", "penalty": -1 },
    { "label": "Bleeding", "penalty": -3 },
    { "label": "Down", "penalty": -99 }
  ],
  "kinds": [
    { "id": "knock", "label": "K", "severity": 0 },
    { "id": "tear", "label": "T", "severity": 1 }
  ]
}
```

- `levels` compte 1 à 16 degrés, du meilleur au pire. Chacun a `label` et un entier `penalty` inférieur ou égal à 0. Un grand nombre négatif exprime la mise hors d'état, donc `-99` convient.
- `kinds` compte 1 à 6 types de dégâts acceptés, chacun avec `id`, un court `label` pour la case et `severity`. Les gravités doivent être distinctes ; seul leur ordre compte, pas les nombres eux-mêmes, donc espace-les comme tu veux.
- Les deux vont ensemble. `kinds` sans `levels` ni `boxes` est refusé faute de cases à marquer, et `levels` ou `boxes` sans `kinds` est refusé car une marque doit avoir un type. Une piste a `levels` ou `boxes`, jamais les deux.
- **Distingue les deux mots.** `kinds` définit ce qu'une marque PEUT ÊTRE. Une MARQUE est l'un de ces types placé sur la piste pendant le jeu. La définition contient des types ; la fiche contient des marques.
- Une piste de blessures commence sans marque ; son `min` vaut donc 0. Une piste à niveaux nommés est aussi longue que ses niveaux : son `max` vaut `levels.length`, et un fichier qui indique autre chose est refusé plutôt que corrigé, pour qu'il n'exprime jamais deux longueurs contradictoires. Une piste à cases est aussi longue que son propre `max`, qui peut être une valeur calculée par la fiche (voir Cases numérotées ci-dessous).

**Les règles exactes**, car une lecture vague produit la mauvaise piste :

- Les marques sont triées, **les plus graves d'abord**. Sept niveaux contiennent au maximum sept marques.
- Une marque est **insérée dans l'ordre de gravité**, jamais ajoutée simplement au bout. Elle prend le plus haut niveau qui lui revient et pousse les plus légères vers le bas.
- La pénalité active est celle du **niveau marqué le plus bas**, jamais la somme. Trois marques sur l'exemple donnent `-3`, pas `0 + -1 + -3`.
- `amount` est un nombre de marques d'un type, **appliquées une par une**. Une piste qui se remplit en cours de route suit donc la même règle qu'une piste déjà pleine.
- Marquer une piste **pleine** **augmente d'un degré sa marque la moins grave**, au lieu d'en ajouter une. Un degré sur ton échelle de types, quel que soit le type de la nouvelle marque.
- Une marque qui dépasserait la gravité maximale y reste ; celle qui n'a pas pu entrer compte comme **débordement**. Celui-ci est sauvegardé, afin qu'un rechargement n'oublie pas les dégâts déjà subis.
- **Guérir utilise la même commande avec une quantité négative.** Elle efface le débordement avant toute marque. Un soin qui nomme l'un des types de la piste n'efface que les marques de ce type : "le contondant guérit, le létal reste" s'écrit donc `kind="bashing"` avec une quantité négative ; un soin qui ne nomme aucun type de la piste efface d'abord les marques les plus légères.

**Marquer en jeu.** Le GM écrit `[sheet: op="damage" track="harm" kind="knock" amount="1"]` et soigne avec un `amount` négatif. Sur une piste qui se remplit par case, il ajoute `box="3"` pour la case que le coup atteint. La forme de `damage` pour réserves, qui nomme `pool=`, ne change pas. La commande ordinaire `track` est refusée sur une piste de blessures : un nombre ne précise pas le type des nouvelles marques. Le joueur peut aussi marquer et effacer les cases à la main, comme ces systèmes le prévoient.

**Un combat peut aussi la marquer.** Fais pointer `combat.health` vers la piste plutôt qu'une réserve : un coup réussi marque les cases indiquées par `combat.damageKinds.marks`, du type auquel ce bloc associe ses dégâts. Un personnage à la piste pleine est à terre, ce que lit la règle de mort. Sur une piste qui se remplit par case, des dégâts `per-point` nomment la case qu'ils atteignent et `per-blow` vise la première ; un coup qu'aucune case ne peut recevoir met le personnage à terre, ce que signifie être mis hors de combat dans les systèmes qui tiennent une telle piste. Guérir efface une marque, la plus légère, quel que soit son type. Les points temporaires sont refusés faute de tampon où les placer. Le moteur lit la piste comme les niveaux RESTANTS ; tout le reste du combat, tomber, être ranimé, le journal et le récapitulatif, reste inchangé.

**Un repos peut guérir une piste de blessures.** Une étape de restauration qui la nomme avec `"to"` la ramène à ce nombre de marques, débordement compris ; avec un `"by"` NÉGATIF, elle en efface ce nombre, débordement d'abord : `"by": { "const": -2 }` en efface donc deux. Une étape qui nomme aussi un `kind` n'efface que les marques de ce type : le "Catch your breath" de Gravewatch s'écrit `{ "track": "harm", "kind": "knock", "to": "min" }`, qui soigne les coups et laisse les déchirures. Une étape qui AJOUTERAIT des marques ne fait rien, car un repos ne marque aucune blessure, et cela inclut un `"by"` positif : il est ignoré sans un mot, alors écris le signe moins.

#### Cases numérotées au lieu de niveaux nommés

Quand une piste est aussi longue que le personnage est robuste, donne-lui `boxes` au lieu de `levels`. Elle a autant de cases que son propre `max`, qui peut être une valeur calculée par la fiche (jamais une valeur qui lit l'état courant), jusqu'à 64 :

```json
{
  "id": "strain",
  "label": "Strain",
  "min": 0,
  "max": { "derived": "strain_boxes" },
  "boxes": {
    "penalty": {
      "by": "remaining",
      "table": [
        [0, -1],
        [1, 0]
      ]
    }
  },
  "kinds": [{ "id": "strain", "label": "S", "severity": 0 }],
  "fill": "indexed",
  "onFull": "refuse"
}
```

- La pénalité active est lue dans `table` (une table à seuils, comme celle d'une valeur dérivée, avec des pénalités inférieures ou égales à 0) au nombre de cases `filled` (remplies) ou `remaining` (restantes), quel que soit ce nombre : une table peut donc coûter quelque chose sans aucune marque. Elle ne dépend pas des cases marquées.
- Les cases sont numérotées : la fiche affiche "Box 3", et le bloc de fiche du Game Master indique combien sont marquées sur combien au lieu de nommer un niveau.

#### Remplir par case, et pistes qui refusent

- `"fill": "indexed"` place une marque sur la case que la commande nomme avec `box=` (la première si elle n'en nomme aucune), ou sur la prochaine case libre au-dessus, et ne déplace jamais une marque une fois posée. Un soin efface la plus haute des marques les plus légères. L'écran de fiche permet au joueur de cliquer sur n'importe quelle case vide.
- `"onFull": "refuse"` refuse une marque qui n'a aucune case libre, au lieu d'aggraver la marque la plus légère. La commande entière est refusée : trois marques avec deux cases libres n'en posent aucune. Une piste indexée refuse toujours ; indique-le avec `"onFull": "refuse"` à côté.

#### Niveaux ajoutés par une liste

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` sur une piste à niveaux nommés permet à une liste de la fiche de l'allonger pour chaque personnage. Chaque ligne, dans l'ordre, ajoute son nombre de niveaux (16 au plus) avec sa pénalité, après le dernier niveau dont la pénalité est au moins aussi bonne ; ces niveaux prennent le nom de ce niveau quand les pénalités correspondent, et celui de la pénalité sinon. Les cicatrices de Gravewatch fonctionnent ainsi. Une liste cachée par la fiche n'ajoute rien, et si une ligne est supprimée alors que ses niveaux sont marqués, les marques qui ne tiennent plus sont conservées comme débordement : modifier la fiche n'annule pas une blessure.

`boxes`, `fill`, `onFull`, `extra` et le `kind` d'une étape de repos relèvent de Capability API 1.40 pour un ensemble en package.

### La pénalité sur tes jets

`resolution.penaltyFrom` nomme la piste de blessures dont la pénalité touche chaque test de l'ensemble. Elle est déclarée, pas supposée : un ensemble qui l'omet lance exactement comme avant l'existence des pistes.

L'EFFET de la pénalité dépend du type de résolution, comme celui du nombre de la fiche :

- Sous `dice-pool`, elle **retire des dés de la réserve**, sans descendre sous `pool.min`. Un `pool.min` de 1 permet encore de lancer un dé au dernier degré ; un `pool.min` de 0 permet de n'en lancer aucun et d'échouer sans jet.
- Sous `dice-sum`, c'est un **modificateur fixe du jet**, intégré au même nombre auquel contribuent l'attribut et l'entraînement.

Elle doit nommer une piste de blessures. Une piste ordinaire n'a pas de pénalité et est refusée à l'importation. Le résultat indique celle qui s'applique pour expliquer au joueur ses dés en moins ; le bloc de fiche du GM montre aussi le degré et son coût.

### Modificateurs de la fiche

Certains nombres d'une fiche accompagnent chaque jet qu'ils concernent : un sac lourd à chaque escalade, une pénalité d'armure à chaque déplacement discret, une bénédiction sur tout. `resolution.adjust` l'exprime, pour les deux types :

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` est une valeur de la fiche, sous la même forme que celle lue par une valeur dérivée, état courant compris. Un nombre négatif retire. Ember Roads additionne l'encombrement de l'équipement emporté par un personnage en un Burden, et une table à seuils transforme chaque tranche de trois en un point retiré à chaque jet de Brawn. Une table indexée sur un état vivant permet à une forme ou à une posture d'atteindre les dés (voir États vivants).
- `abilities` est facultatif. Avec lui, le modificateur ne s'applique qu'à un test lancé avec l'un de ces attributs : l'attribut lui-même, une compétence ou une sauvegarde qui l'utilise, une compétence lancée avec lui par `with=`, ou une paire d'attributs qui l'inclut. Sans lui, il s'applique à tous les tests.
- Il s'applique au même endroit que la pénalité de blessure : des dés pour une réserve, avec le même plancher `pool.min`, et un nombre fixe pour une somme, dans le modificateur que le registre additionne. Jusqu'à huit entrées, additionnées pour chaque test.
- Un combat régi par l'ensemble l'ajoute à chaque jet qu'il construit à partir d'une fiche, au début du combat : une attaque lancée avec un attribut ou une compétence, une sauvegarde, un test de confrontation et une initiative lus sur un attribut, une compétence ou une sauvegarde prennent les entrées de cet attribut, et tout autre jet ne prend que les entrées valables pour tous les jets.
- Un personnage sans fiche n'en reçoit rien, de même qu'il ne reçoit aucun modificateur.

Le résultat indique ce que la fiche a ajouté (`adjust="-2"` dans le registre, et une ligne sur la carte des dés), pour que le joueur voie pourquoi un jet a donné ce résultat. Cela relève de Capability API 1.38 pour un ensemble en package.

### Repos

Un repos liste des restaurations et des éléments à effacer. Chaque étape nomme une cible (`pool`, `poolGroup`, `listPools`, `track` ou `state`) et la fixe (`"to": "max"`, `"to": "min"` ou un nombre) ou la modifie (`"by": { "const": 1 }` ou `"by": { "fractionOfMax": 0.5 }`). Une étape visant une piste de blessures peut seulement la soigner : son `by` est donc négatif ; voir plus haut. Une étape visant un état vivant le fixe seulement, à `"default"` ou à l'une de ses valeurs. Une étape `poolGroup` avec un `fractionOfMax` modifie chaque réserve du groupe de sa propre fraction ; ajoute `"shared": true` (Capability API 1.77) pour calculer plutôt la fraction sur le maximum de tout le groupe et la répartir entre les réserves du groupe dans l'ordre où la fiche les liste, chacune jusqu'à ce qui lui manque. Le repos long de 5e, "half of the character's total number of" dés de vie gardés dans une réserve par dé, s'écrit `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

### Texte du Game Master

- `checkGuidance` remplace le paragraphe intégré qui explique comment demander un test. Nomme le système et les occasions de lancer. Le GM nomme seulement la compétence et la difficulté. Le moteur lance et calcule depuis la fiche : ne demande pas de calculs au modèle.
- `sheetGuidance` introduit les fiches dans le prompt. Explique quelles ressources comptent et quand les dépenser.
- `worldGuidance` est facultatif et lu une fois à la création du monde pour adapter le cadre aux règles : aucune poudre à canon, magie rare, morts qui marchent. Il n'atteint jamais un tour.
- `sheetSummary` choisit les champs, valeurs dérivées et lignes de listes que voit le GM par personnage. Le moteur montre toujours les modificateurs d'attribut, les compétences et sauvegardes entraînées et les valeurs vivantes. Garde le reste court, car il part à chaque tour. La `nameColumn` d'une liste du résumé peut être une colonne texte ou enum (un enum affiche le libellé de sa valeur), et `columns` nomme jusqu'à trois autres colonnes de la ligne à afficher après le nom ; le bloc se lit alors `Gear: Crowbar 1d6` plutôt que des noms seuls. Une colonne booléenne affiche son libellé quand elle est activée. Les deux relèvent de Capability API 1.37 pour un ensemble en package.
- Tu n'as pas besoin d'enseigner la commande de fiche dans `sheetGuidance`. Le moteur enseigne lui-même chaque commande avec les noms que déclare ton fichier ; quand ton ensemble a une piste de blessures, il ajoute la commande `op="damage"` pour la marquer et liste ses niveaux et ses types de blessures. Quand il a des états vivants, il ajoute la commande `op="state"` et liste les valeurs que chacun peut prendre.

### Référence complète des règles pour le GM (Capability API 1.145)

Le `gmReference` facultatif **de premier niveau** contient la référence complète des règles de l'ensemble pour le Game Master, jusqu'à 16 000 caractères. Places-y les règles d'arbitrage détaillées et garde les courtes consignes sur les tests et les ressources dans `gm.checkGuidance` et `gm.sheetGuidance`. Ces champs, et `gm.worldGuidance`, gardent leur limite de 1 500 caractères ; les consignes des couches gardent aussi leurs limites actuelles.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

La référence apparaît sous **Game Master rules reference** (référence des règles du Game Master) dans le prompt système stable, une fois par requête. Elle n'est jamais recopiée dans le rappel de chaque tour. Comme tout texte destiné au prompt, elle doit tenir sur une ligne, sans caractères de contrôle, crochets ni accolades de macro (`{{` et `}}`). Si la requête dépasse encore la limite de contexte après les ajustements habituels de l'historique et du budget de réponse, la référence est raccourcie, avec une coupe signalée, avant que les instructions principales ne soient coupées. Ne la définis pas pour garder les prompts actuels. Un package qui l'utilise doit déclarer `schemaVersion: 2` dans son manifeste et `capabilityApi: { "major": 1, "minor": 145 }` ou plus récent.

## Horloges de progression de l'équipe et de la scène (`clocks`)

Capability API **1.143** ajoute un objet `clocks` facultatif de premier niveau. Omets-le pour laisser les commandes d'horloge désactivées. L'objet est strict : seules ces trois clés sont acceptées.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` accepte de un à six nombres de segments entiers et distincts, chacun de 2 à 12 ; sa valeur par défaut est `[4, 6, 8]`. `max` est le nombre maximal d'horloges gardées en même temps, de 1 à 12, 8 par défaut. Le `text` facultatif est une ligne destinée au prompt, jusqu'à 400 caractères, qui explique quand le GM doit créer et faire avancer des horloges. Un objet vide active les valeurs par défaut.

Les horloges appartiennent à l'équipe ou à la scène, pas à un personnage. Le rappel du GM liste leur nom et leur remplissage à chaque tour et enseigne ces commandes :

- `[clock: name="Alarm raised" size="6"]` crée une horloge vide. Une taille non autorisée, un nom existant (sans tenir compte de la casse) ou l'atteinte de `max` refuse la création.
- `[clock: name="Alarm raised" tick="2"]` ajoute des segments. Des valeurs négatives en retirent ; le remplissage reste dans `0..size`. Une horloge pleine est terminée, reste visible et compte dans `max` jusqu'à ce qu'elle soit effacée. Une valeur négative peut la rouvrir.
- `[clock: name="Alarm raised" clear]` supprime l'horloge nommée.

Les noms tiennent sur une ligne de 1 à 100 caractères, sans guillemets doubles, crochets, caractères de contrôle ni accolades de macro. Chaque balise demande exactement une action. Les commandes s'appliquent dans l'ordre de la réponse : une horloge peut donc être créée et avancée dans la même réponse. Le moteur réécrit chaque balise avec `result="ok" now="4/6"` (ou `now="cleared"`), ou avec `result="refused" reason="..."`. Les attributs de résultat fournis par le modèle sont ignorés. Les horloges inconnues et les demandes mal formées sont refusées ; au plus 40 commandes s'appliquent par réponse.

Game Mode affiche un cercle segmenté, le nom et le remplissage à côté de l'état de l'équipe. Les balises restent dans la réponse enregistrée comme reçus et sont masquées de la narration. Les horloges sont stockées dans chaque instantané d'état de la partie sous `rulesetClocks` ; en l'absence de données, il n'y a pas d'horloge. Régénérer part de l'instantané précédent, continuer part de l'instantané actuel, et sélectionner ou supprimer des swipes ou des messages restaure les horloges avec le reste de cet instantané.

## Fiche d'équipe : une bande, un vaisseau ou des Story Points partagés

Capability API **1.144** ajoute un `party` facultatif de premier niveau, à côté de `sheet`. Il contient une fiche partagée par partie, comme la bande de Blades, le vaisseau de Lasers & Feelings ou les Story Points de Genesys :

```json
"party": {
  "label": "Crew",
  "fields": [
    { "id": "heat", "label": "Heat", "type": "number", "min": 0, "max": 9, "default": 0 },
    { "id": "vault", "label": "Vault capacity", "type": "number", "min": 0, "max": 16, "default": 8 },
    { "id": "upgrades", "label": "Upgrades", "type": "text", "maxLength": 400 }
  ],
  "pools": [{ "id": "coin", "label": "Coin", "max": { "field": "vault" }, "start": "empty" }],
  "advancement": { "fields": ["heat", "vault", "upgrades"], "text": "Record heat after a score." },
  "text": "Coin belongs to the crew."
}
```

`fields` utilise le même schéma de champ que `sheet.fields` ; `pools` utilise `sheet.live.pools`, y compris `start`, `group`, `hideWhen` et `allowTemp`. Il faut au moins un champ ou une réserve, et leurs identifiants doivent être uniques dans la fiche d'équipe. Les identifiants de personnage et d'équipe peuvent coïncider. Dans cette version mineure, les fiches d'équipe n'ont ni sections, ni listes, ni attributs, ni valeurs dérivées, ni migrations de fiche de personnage. Le `max` d'une réserve lit une constante ou un champ numérique de l'équipe. Les formules de personnage ne peuvent pas lire les valeurs de l'équipe, et les formules d'équipe ne peuvent pas lire les valeurs des personnages. `hideWhen` ne nomme lui aussi que des champs de l'équipe.

`advancement.fields` nomme les champs number, text ou longtext que le GM peut modifier de façon permanente. `advancement.text` et `text` prennent chacun une ligne destinée au prompt d'au plus 400 caractères. Le `summary` facultatif reprend `gm.sheetSummary` : ses `fields` choisissent des champs de l'équipe ; `derived` et `lists` doivent être vides. Sans résumé, tous les champs visibles de l'équipe sont affichés. Les réserves apparaissent toujours.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` choisit la fiche partagée ; laisse `who` de côté. Le `who="party"` existant s'applique toujours à chaque **personnage** et ne modifie jamais la fiche partagée. Cette version mineure permet `spend`, `restore` et l'`advance` d'un champ sur la fiche d'équipe. Les fiches inconnues, les opérations non prises en charge, les réserves insuffisantes, la progression non déclarée et les valeurs invalides sont refusées et réécrites avec le résultat du moteur. Les réserves d'équipe suivent la même arithmétique valeur actuelle/maximum et les mêmes valeurs par défaut que celles des personnages.

Le GM reçoit à chaque tour le libellé, les champs et les réserves de l'équipe à côté des blocs de fiche des personnages. Game Mode propose une fiche d'équipe repliable, en lecture seule, à côté des portraits des personnages, avec la même présentation de fiche. Les valeurs permanentes sont stockées une seule fois dans les métadonnées du chat (`gamePartySheet`), à côté de `gameCharacterCards`, et partagent les reçus de progression. Les réserves vivantes utilisent l'entrée réservée `$party` de `rulesetLive` ; les noms de personnages normalisés ne peuvent pas entrer en collision avec elle. Régénérer repart d'avant la réponse, et sélectionner ou supprimer un swipe restaure les valeurs permanentes et vivantes par l'historique existant. Les ensembles sans `party` gardent leur comportement actuel.

**Création d'équipe partagée (Capability API 1.163).** Une fiche d'équipe peut porter des `lists` (jusqu'à 12, écrites comme les listes de la fiche de personnage), son propre `builder` guidé et `fromMembers` : jusqu'à 8 champs numériques d'équipe lus sur les personnages de l'équipe, chacun `{ "field", "count": true }` (combien de personnages il y a) ou `{ "field", "sum": "<character number field>" }` (la somme des leurs, comme les points de Totem). Les champs de membres sont calculés à partir des personnages tels qu'ils sont chaque fois que la fiche partagée est lue : un personnage qui rejoint ou quitte l'équipe les modifie aussitôt. Avec des listes, le `summary.lists` de l'équipe peut les nommer.

L'assistant de création s'écrit exactement comme celui d'un personnage (réserves, étapes, lignes à prix, offres de dépense, profils) et respecte les mêmes règles vis-à-vis des champs et des listes de l'équipe. Ses étapes de catalogue et de copie de ligne peuvent lire les catalogues de l'ensemble qui alimentent les listes d'équipe. En Game Mode, n'importe quel joueur ouvre l'Edit de la fiche partagée, qui propose la création guidée, et l'enregistre pour toute l'équipe. Chaque enregistrement nomme la révision sur laquelle il a été ouvert (`gamePartySheetRevision` dans les métadonnées du chat, augmenté par chaque enregistrement et par les propres modifications de l'histoire) : un enregistrement ouvert avant que celui d'une autre personne n'aboutisse est refusé, la fiche plus récente s'affiche et le brouillon du joueur reste ouvert ; enregistrer à nouveau est alors son choix de la remplacer.

```json
"party": {
  "label": "The Crew",
  "fields": [
    { "id": "tier", "label": "Tier", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "size", "label": "Crew size", "type": "number", "min": 0, "max": 12, "default": 0 }
  ],
  "lists": [{ "id": "upgrades", "label": "Upgrades", "columns": [{ "id": "name", "label": "Name", "type": "text" }] }],
  "builder": { "steps": [{ "id": "upgrades", "label": "Upgrades", "kind": "rows", "list": "upgrades" }] },
  "fromMembers": [{ "field": "size", "count": true }]
}
```

## Catalogues : entrées préparées pour les listes de la fiche

Saisir une liste de sorts, un tableau d'équipement ou une page de capacités ligne par ligne est pénible. Un catalogue est une collection nommée d'entrées préparées que tu distribues avec l'ensemble. L'éditeur les propose dans un sélecteur sur chaque liste alimentée par le catalogue ; un choix remplit la ligne.

Les catalogues sont facultatifs. Un ensemble peut en avoir douze ; le moteur ne connaît pas leur sujet : chaque identifiant, colonne, filtre et mot vient de ton fichier.

### L'en-tête

L'en-tête va dans `catalogs`, au premier niveau du fichier, à côté de `gm`.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` et `label` : l'identifiant suit les règles des identifiants de fiche ; le libellé nomme le sélecteur.
- `holds` : `"rows"` (valeur par défaut, et celle de tous les catalogues antérieurs à cette version), `"creatures"` ou `"items"`. Un catalogue de créatures est un bestiaire lu par le combat, et un catalogue d'objets liste ce que transporte une équipe. Aucun des deux n'écrit dans une fiche, ne déclare `feeds` ni n'apparaît dans le sélecteur. Consulte [Créatures](#creatures-a-bestiary-a-fight-reads) et [Objets](#items-what-a-party-carries) ci-dessous.
- `feeds` : les une à huit listes de fiche où ses entrées peuvent écrire. Obligatoire pour les lignes, refusé pour les créatures et les objets. Une entrée ne peut écrire ni dans une autre liste, ni une valeur que ses colonnes ne peuvent contenir.
- `filters` : facultatif, jusqu'à huit. Définit comment réduire le sélecteur : `number`, une valeur `text` ou `tags` (plusieurs mots). `startFrom` nomme le champ utilisé à l'ouverture : un personnage dont Calling vaut Tinker voit d'abord les entrées Tinker.
- `units` : facultatif. Définit le sens d'une portée ou d'une taille de zone dans le bloc `mechanics` d'une entrée.

### Une entrée

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id` : minuscules, chiffres et tirets simples, unique dans le catalogue.
- `label` et `summary` : ce qu'affiche le sélecteur. Le résumé est facultatif, sur une ligne et limité à 300 caractères.
- `filters` : valeurs des filtres déclarés par l'en-tête. `number` prend un nombre ; `text`, une chaîne ; `tags`, une liste de chaînes.
- `rows` : ce qu'écrit le choix, entre une et six lignes. `list` appartient à `feeds` ; les clés de `values` sont les identifiants de colonnes de cette liste.
- `creature` : un adversaire plutôt que des lignes, dans un catalogue dont `holds` indique des créatures. Une entrée a exactement l'un de `rows` ou `creature`. Une créature ne porte pas `mechanics` : elle exprime ses effets dans ses actions.

Chaque valeur est vérifiée contre les colonnes cibles. Un nom mal écrit ou un nombre hors limites est signalé avec son entrée d'origine. Les entrées dans le fichier de règles sont vérifiées à son chargement, donc à l'importation pour un fichier importé. Un catalogue séparé de package est vérifié lorsque le sélecteur le demande pour la première fois ; s'il contient une erreur, il montre les raisons plutôt que des entrées.

### Une entrée, plusieurs listes

Une capacité à usages limités occupe deux lignes : la capacité et son compteur. Cela reste un seul choix.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

### Valeurs maintenues à jour par l'ensemble

Les nombres d'une ligne appartiennent au joueur dès qu'il la choisit. Une exception est utile : un maximum dépendant du personnage, comme des usages égaux à un attribut ou une ressource de classe qui augmente avec le niveau. Une ligne peut nommer jusqu'à quatre de ses colonnes numériques dans `scaled` ; l'éditeur maintient ces cellules à jour.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- La clé est l'une des colonnes `number` de la liste.
- `from` est une référence de valeur ordinaire, utilisant le même vocabulaire fermé qu'ailleurs. Pour plus complexe, déclare une valeur `derived` et pointe `from` dessus (`"from": { "derived": "lay_on_hands_max" }`). Aucune nouvelle arithmétique n'est ajoutée ici.
- `table` est facultatif. Il cherche la valeur de référence dans une table à seuils, comme un niveau donnant un nombre : `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` doit toujours contenir un nombre simple pour la colonne ; son absence est refusée. C'est la valeur avant de connaître une fiche et celle que garde une fiche sans cette référence.
- Une ligne avec `scaled` doit être l'unique ligne de l'entrée pour cette liste, pour qu'une ligne marquée corresponde toujours à une seule spécification, ou bien (Capability API 1.92) chaque ligne que l'entrée écrit dans cette liste doit porter son propre nom dans la colonne de nom de la liste (le `nameColumn` de ses réserves, sinon sa première colonne de texte). La ligne de la fiche est alors associée à sa spécification par ce nom : un même trait peut ainsi donner deux usages qui progressent chacun de leur côté ; une ligne renommée par le joueur est laissée telle quelle.

La valeur est calculée à l'édition, jamais à la lecture : une ligne sauvegardée contient toujours le nombre qu'elle annonce. Elle est adaptée à la colonne : bornée par `min` et `max`, puis arrondie vers le bas si la colonne prend des entiers. Dans l'exemple, Heart 3 donne trois usages et Heart 0 ou moins n'en donne aucun. La ligne reste avec 0 usage ; un compteur au maximum de 0 n'étant pas une réserve, rien n'est dépensable en jeu.

Les colonnes à échelle nécessitent Capability API 1.23 pour les ensembles en package. Un ensemble communautaire importé est validé par le moteur qui le lit et n'a besoin de rien d'autre.

### Les lignes choisies sont des copies

Chaque ligne choisie est copiée sur la fiche avec une clé supplémentaire, `_catalog`, contenant `<catalog id>/<entry id>`. Les identifiants de colonnes commencent par une lettre ; cette clé ne peut donc pas être l'une des tiennes.

La copie appartient au personnage. Le joueur peut tout modifier ensuite ; la fiche fonctionne sans l'ensemble installé et publier une version n'écrase jamais les personnages. La marque permet au sélecteur d'afficher ce que possède déjà la fiche et à l'actualisation décrite ci-dessous de le reconnaître.

### Actualiser depuis l'ensemble de règles

Grâce à la marque, l'éditeur peut avertir le joueur si ton nouveau texte diffère de sa ligne. Une courte ligne sous la liste indique combien de lignes ont un texte nouveau ; **Review** (Examiner) montre le contenu de la fiche à côté de celui de l'ensemble, avec une case par ligne. Rien n'est écrit avant **Update selected** (Mettre à jour la sélection) ; seules les colonnes différentes des lignes cochées changent. Tout le reste est conservé, marque comprise.

La comparaison est volontairement étroite :

- Les valeurs existantes ne sont comparées que dans `text`, `longtext`, `dice` et `enum`. Les valeurs `number` et `boolean` appartiennent au joueur et sont conservées, y compris 0 et false. Une colonne encore absente peut être proposée avec sa valeur typée, nombres et interrupteurs compris. Une colonne à échelle est exclue car elle suit déjà la fiche.
- Seules les colonnes définies par ton entrée sont comparées. Une colonne omise n'est jamais touchée, quel que soit son contenu.
- Une valeur que refuserait la colonne, comme un `enum` retiré ou un texte dépassant `maxLength`, est ignorée plutôt qu'écrite.
- La ligne est reliée à celle d'origine par sa position parmi les lignes de même marque dans cette liste, tant que la fiche en garde autant que l'entrée en écrit. Sinon, cela fonctionne seulement si l'entrée écrit une ligne unique pour cette liste. Si le joueur supprime l'une de deux lignes, l'entrée reste intacte plutôt que devinée.
- Une ligne dont l'entrée n'existe plus dans le catalogue est laissée intacte, sans bruit.

Reformuler ou renommer une entrée peut donc atteindre les personnages qui l'ont déjà choisie, s'ils l'acceptent. Changer le sens d'un nombre ne le peut pas et ne le fera pas : cette colonne appartient au joueur depuis qu'il possède la ligne.

### `mechanics` : ce qu'une entrée fait en nombres

Une entrée peut porter un bloc `mechanics` facultatif exprimant ses effets numériques : `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dés comme `2d6` ou nombre fixe), `amountAdd` (une valeur lue sur la fiche de l'utilisateur et ajoutée à la quantité, comme `{ "field": "level_fighter" }` pour un Second Wind de 1d10 plus le niveau de guerrier ; il exige un `amount`, n'est lu que dans les combats propres à l'ensemble (les combats Classic et Tactical du moteur utilisent la quantité telle qu'elle est écrite) et relève de Capability API 1.83), `damageType`, `attackRoll`, `autoHit`, `save` (une sauvegarde de la fiche et l'effet d'une réussite), `applies` (états appliqués), `temporary` (points temporaires de santé), `scales` (quantité qui grandit avec la fiche), `cost` (réserve dépensée), `perCostStep`, `targetsPerCostStep`, `budget` (part de l'économie d'actions dépensée), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` et `check`.

Une attaque qui vise des ennemis peut laisser de quoi frapper aux tours suivants avec `summons` (Capability API 1.122). Pour Spiritual Weapon, mets `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }` sur son entrée d'attaque. Le lancement fait la première attaque et laisse l'arme à côté de sa première cible une fois les réactions terminées ; un lancement annulé ne laisse rien. Les frappes suivantes ne dépensent que le budget d'économie déclaré, gardent le niveau de paiement du lancement pour la mise à l'échelle des dégâts et ouvrent les mêmes fenêtres de réaction. Les distances utilisent l'unité du catalogue ; un mouvement omis vaut zéro et une allonge omise, une case. Sur un plateau, l'arme peut frapper un ennemi à portée de son mouvement plus son allonge, en ignorant les murs, et se place à côté de lui. Sans plateau, tout ennemi debout est à portée. Les rondes sont décomptées à la fin des tours du porteur, sans compter le tour du lancement. L'invocation prend fin à zéro, à la défaite du porteur ou quand la concentration de son entrée prend fin. Relancer la même entrée remplace son invocation.

Une entrée avec une `area` peut persister avec `zone` (Capability API 1.172) : `{ "rounds", "anchor", "triggers", "atCast" }`. Elle reste en place pendant `rounds` (de 1 à 1000) tours de son lanceur, comptés comme ceux d'une invocation, et prend fin plus tôt quand la concentration qui la maintient prend fin ou que son lanceur est vaincu. `anchor: "point"` (par défaut) garde les cases sur lesquelles elle a été lancée ; `anchor: "caster"` est une explosion autour de son lanceur qui le suit partout, donc sa portée vaut 0. `triggers` indique quand elle refait l'effet propre de l'entrée (amount, plus, save, applies) sur une créature : `enter` (la créature y entre, ou une zone portée par son lanceur l'atteint), `turn-start` ou `turn-end` (elle commence ou termine son tour dedans). Une créature est prise une fois par tour, quel que soit le déclencheur, et quiconque a été pris par le lancement lui-même compte comme pris ce tour-là. Qui elle prend suit l'entrée : `friendlyFire: false` laisse de côté le camp du lanceur, un soin ou une entrée alliée s'y limite, et une zone portée par son lanceur ne le prend jamais. `atCast: false` ne fait rien à son apparition. Relancer l'entrée remplace sa zone. Le plateau teinte ses cases, le combat la liste avec les tours qui lui restent, et le journal indique chaque prise. Hors plateau, elle garde ceux sur qui elle a été lancée, et `turn-start` et `turn-end` les prennent.

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

C'est Cloudkill. Spirit Guardians s'écrit `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false` avec `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }` ; Moonbeam est une explosion de 5 pieds avec `"triggers": ["enter", "turn-start"]`.

Une zone maintenue en un point peut se déplacer et changer son terrain (Capability API 1.173). `move: { "budget", "distance" }` permet à son lanceur de la déplacer pendant son tour : le combat propose "Move <zone>" pour ce budget, choisi sur le plateau comme un déplacement, vers toute case située à `distance` ou moins de son centre. `drift: { "distance" }` la déplace d'autant en ligne droite à l'opposé de son lanceur au début de chacun de ses tours, en s'arrêtant au bord du plateau. Dans les deux cas, quiconque elle couvre désormais sans l'avoir couvert auparavant est pris comme le dit `enter`. Seule une explosion maintenue en un point se déplace ou dérive. `terrain: { "difficult": true }` fait coûter double l'entrée dans chacune de ses cases pour quiconque elle prend (un terrain déjà difficile n'est pas doublé une seconde fois), et `terrain: { "perDistance": { "every", "amount", "damageType" } }` inflige `amount` (dés et valeur fixe, comme pour une entrée) à quiconque elle prend pour chaque `every` parcouru à l'intérieur, sans sauvegarde, cumulé sur plusieurs déplacements. Le journal indique chaque déplacement, chaque dérive et chaque blessure.

```json
{
  "id": "moonbeam",
  "name": "Moonbeam",
  "mechanics": {
    "kind": "attack",
    "range": 120,
    "area": { "shape": "burst", "size": 5 },
    "amount": { "dice": "2d10" },
    "damageType": "radiant",
    "save": { "save": "con_save", "onSuccess": "half" },
    "concentration": true,
    "zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "move": { "budget": "action", "distance": 60 } }
  }
}
```

Cloudkill ajoute `"drift": { "distance": 10 }`. Spike Growth est une explosion de 20 pieds sans quantité propre, `"triggers": []` (son terrain est tout ce qu'elle fait), `"atCast": false` et `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`.

Une zone peut faire davantage à quiconque elle prend (Capability API 1.174). `breaksConcentration: true` fait lancer à une créature qu'elle prend pendant qu'elle se concentre la sauvegarde de concentration de l'ensemble contre la difficulté de sauvegarde propre à l'entrée, avant l'effet de l'entrée, et lui fait perdre sa concentration en cas d'échec ; l'entrée a besoin d'un `save`. `damageCap` met fin à la zone une fois qu'elle a infligé ce total de dégâts depuis son apparition, en comptant ses prises et son terrain. Sleet Storm est une explosion de 40 pieds avec `"save": { "save": "dex" }`, `"applies": [{ "condition": "prone", "duration": "instant" }]` et `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`. Guardian of Faith est une explosion avec `"friendlyFire": false`, `"amount": { "flat": 20 }` et `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`.

La difficulté contre laquelle on échappe à un état appliqué par une entrée peut être la difficulté de sauvegarde propre à l'entrée (1.174) : `"escapeDc": "save"` sur l'entrée `applies`, à côté d'une confrontation dont le `from.holding` est cet état. Web et Black Tentacles entravent avec `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }`, et la confrontation de la créature entravée pour s'échapper se lance contre le DD de sauvegarde des sorts du lanceur. Quand ce qui l'a appliqué n'a pas de difficulté de sauvegarde, on s'en échappe comme le dit la confrontation, contre son porteur.

Le `use` d'un objet peut aussi porter `concentration` et `zone` (1.174), comme une entrée de catalogue : un parchemin de Cloudkill ou de Moonbeam garde sa zone persistante et est maintenu par la concentration de son lecteur.

Une zone déplacée peut percuter, et son terrain peut coûter plus cher (Capability API 1.175). `move: { ..., "ram": true }` l'envoie case par case droit vers l'endroit où elle a été déplacée ; à la première case où elle atteint quelqu'un qu'elle ne couvrait pas avant, elle s'arrête, le prend comme s'il avait été percuté (quoi que disent ses déclencheurs) et ne peut plus être déplacée ce tour-là. Les créatures qui y entrent en marchant ne sont prises que comme le disent ses déclencheurs. Flaming Sphere est une explosion de 5 pieds avec `"triggers": ["turn-end"]` et `"move": { "budget": "bonus", "distance": 30, "ram": true }`. `terrain.costTimes` (de 2 à 10) fait coûter chaque pas vers elle autant de pas ordinaires, et un terrain déjà difficile ne coûte pas plus que cela : Plant Growth s'écrit `"terrain": { "costTimes": 4 }`. Il remplace `difficult`, qui équivaut à `costTimes: 2`. `terrain.halvesSpeed: true` fait coûter encore double chaque pas à l'intérieur, en plus de tout terrain difficile : Spirit Guardians s'écrit `"terrain": { "halvesSpeed": true }`.

Les emprises qu'un sort impose ne peuvent être brisées que comme le sort le dit (également 1.175). Une confrontation pour se libérer avec `"from": { "holding": "restrained", "escapable": true }` n'est proposée que contre une emprise qui nomme un `escapeDc` : la même confrontation brise ainsi une toile, jamais une pétrification. `applies[].escapeChecks` nomme les tests de confrontation qui peuvent briser cette emprise, à la place des tests d'attaquant propres à la confrontation : Black Tentacles entrave avec `"escapeDc": "save", "escapeChecks": ["might", "agility"]`, et Web avec `"escapeChecks": ["might"]`. `zone.whileHeld: { "condition", "amount", "damageType" }` inflige sa quantité, sans sauvegarde et à la place de l'effet propre de la zone, à quiconque commence un tour dedans en étant déjà retenu par cet état venant de son lanceur : le `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }` de Black Tentacles.

Une entrée ou l'utilisation d'un objet peut guérir (Capability API 1.176). `ends: { "conditions": [...], "count"? }` retire ces états de sa cible dans l'ordre nommé, au plus `count` d'entre eux : Lesser Restoration s'écrit `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. `stabilizes: true` stabilise une cible mourante, qui ne lance plus de sauvegardes contre la mort, et nécessite un bloc de combat avec une règle `dying` : Spare the Dying. `revives: { "withinRounds", "health" }` ne vise que quelqu'un mort depuis au plus ce nombre de rondes et le ramène avec cette quantité : Revivify s'écrit `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`. Une entrée qui ne fait que retirer des états ou stabiliser n'est proposée que contre quelqu'un qu'elle aiderait ; une entrée de type `utility` sans rien d'autre à faire est proposée tant qu'elle guérit.

Les zones peuvent être des boîtes, et les zones persistantes des murs (Capability API 1.177). `area.shape: "box"` est un carré de `size` de côté dont le coin proche se trouve sur la case visée et qui s'étend à l'opposé de son auteur ; le long d'un axe où son auteur est aligné avec elle, elle est plutôt centrée sur cette case. Sans `range`, elle est accolée à son auteur. Web s'écrit `"area": { "shape": "box", "size": 20 }` avec une portée de 60. `area.shape: "wall"` ne fait que persister et nécessite donc une `zone` : il mesure `size` de long et `width` d'épaisseur (une case sans cette clé), passe par la case visée perpendiculairement à la ligne qui part de son auteur, ou de là vers la case `toward` du choix ; `"ring": <diameter>` permet à son lanceur de le poser plutôt en anneau de ce diamètre autour de la case visée, quand le choix indique `"ring": true`. Un mur n'a besoin d'aucun déclencheur : Wind Wall ne fait son effet qu'à son apparition. Un mur n'est jamais déplacé, ne dérive pas et ne suit pas son auteur. `zone.blocks: ["move", "sight"]` ferme ses cases au déplacement, à la vue, ou aux deux tant qu'il tient, et quiconque se trouve là où il s'élève est placé sur la case libre la plus proche (du côté choisi si une case y est aussi proche) : Wall of Stone bloque les deux, Wall of Force le déplacement, Wall of Fire la vue. `zone.side: { "distance", "triggers" }` fait prendre aux cases situées à `distance` ou moins d'un côté comme le disent ses propres `triggers`, en plus des cases du mur ; le `side` du choix indique lequel, `near` son auteur (à l'intérieur d'un anneau) ou `far` (à l'extérieur), le côté éloigné s'il est omis. Wall of Fire s'écrit `"area": { "shape": "wall", "size": 60, "ring": 20 }`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`.

La vue compte (Capability API 1.178). `combat.senses` liste les sens qui voient là où les yeux ne le peuvent pas, chacun `{ "id", "label", "sheet"?, "blind"? }` : la portée d'un personnage se lit sur sa fiche par `sheet` (rien à zéro), une créature porte les siennes sous la forme `"senses": { "darkvision": 60 }` dans la distance de l'ensemble, et un sens `blind` (vision aveugle, perception des vibrations) fonctionne sans les yeux. Le bloc a alors besoin de `combat.distance`. Une zone avec `obscures` cache tout ce qui s'y trouve, et tout ce qu'on voit à travers, à quiconque n'a à portée aucun des sens listés par son `pierced` : Fog Cloud s'écrit `"obscures": {}`, Darkness `"obscures": { "pierced": ["blindsight", "truesight"] }`. Une telle zone n'a besoin d'aucun déclencheur, et une entrée `utility` qui ne fait que laisser une zone en place (Fog Cloud, Darkness, un mur) figure dans le menu et se pose où son lanceur le choisit. Une entrée de `combat.conditions` avec `unseen` cache son porteur de la même façon : invisible s'écrit `"unseen": { "pierced": ["blindsight", "truesight"] }`. `combat.sight` indique ce que cela fait : `unseenAttacks: true` donne l'avantage à une attaque quand sa cible ne peut pas voir l'attaquant et le désavantage quand l'attaquant ne peut pas voir sa cible, et `eyes` nomme le sens (comme le `lacks` d'un état le nomme) qui correspond à la vue : une créature aveuglée ne voit alors que par un sens `blind`. Une entrée ou une action de créature avec `seen: true` ne peut choisir que des cibles que son auteur voit, comme le dit "a creature you can see within range". Une explosion ou une boîte peut être posée plusieurs fois à la fois avec `area.copies` (de 2 à 10), chaque copie en touchant une autre, et le joueur place chacune : Fire Storm s'écrit `"area": { "shape": "box", "size": 10, "copies": 10 }`. Une zone posée plusieurs fois reste là où elle est lancée.

Les zones peuvent agir sur quiconque s'y tient (Capability API 1.179). `combat.components` nomme ce dont l'utilisation de quelque chose peut avoir besoin, chacun `{ "id", "label" }` (les composantes verbale, somatique et matérielle de 5e), et une entrée ou l'action d'une créature liste les siennes dans `components`. L'`inside` d'une zone applique des `conditions` à quiconque s'y trouve et le protège des types de dégâts de `immune` tant qu'il y reste ; son `forbids: { "components": [...] }` empêche d'utiliser à l'intérieur tout ce qui en a besoin, comme le `forbids` d'un état le fait pour son porteur (bâillonné). Silence s'écrit `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`. Le `wards: { "catalogs": [...], "maxLevel": N }` d'une zone protège quiconque est à l'intérieur de tout ce qui provient de ces catalogues et est utilisé depuis l'extérieur au niveau N ou moins, jugé au niveau auquel il est payé : Globe of Invulnerability s'écrit `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`. Un état qui retire des budgets (`budgets` avec un `flat` négatif), appliqué pendant le tour de son porteur, les retire aussi de ce tour : la sauvegarde ratée de Stinking Cloud au début du tour coûte donc l'action de ce tour.

Les sens et la vue vont plus loin (Capability API 1.180). Un état qu'une entrée applique peut prendre fin quand son porteur agit : `"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` le retire dès qu'il a fait une attaque ou utilisé une entrée d'un catalogue qu'il nomme, et l'utilisation d'un objet qui indique `"casts": "spells"` (un parchemin, une baguette) compte comme un lancement depuis ce catalogue. L'attaque ou le sort qui y a mis fin en bénéficiait encore : Invisibility donne donc l'avantage à sa seule attaque et disparaît ensuite. Ce qu'une zone en place fait d'elle-même n'est pas une action de son lanceur. Un état de `combat.conditions`, ou l'effet `worn` ou `carried` d'un objet, peut donner des sens avec une portée dans la distance de l'ensemble, `"senses": { "darkvision": 60 }` ; la plus longue de cette portée et de celle du porteur compte tant qu'il dure : le sort Darkvision, True Seeing (`{ "truesight": 120 }`) et les lunettes de nuit fonctionnent ainsi. Un état avec `"cancelsUnseen": true` permet à tout le monde de voir son porteur, quel que soit l'état qui le cache, comme Faerie Fire dessine le contour des invisibles ; les zones qui masquent et les murs le cachent toujours.

Les protections, les sauvegardes, l'incantation des monstres et les parchemins vont plus loin (Capability API 1.181). Le `wards` d'une zone compare le niveau auquel un sort a été payé, sauf s'il indique `"by": "base"`, qui compare le niveau propre du sort quel que soit son paiement, comme le fait Globe of Invulnerability. `"maxLevelPerCostStep": 1` repousse un niveau de plus pour chaque cran dont le lancement de la protection elle-même a été payé au-dessus de sa base. Le `save` d'une entrée ou d'une action de créature peut indiquer contre quoi d'autre il compte, `"against": { "damage": ["poison"] }`, pour qu'un modificateur de sauvegarde `against` le poison s'y applique, et qui réussit sans lancer : `"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }` (un seul suffit), comme l'exige Stinking Cloud. Le `spellcasting` d'une créature peut indiquer ce dont ses sorts ont besoin à la place des `components` de chaque entrée, pour tout le trait ou sort par sort, avec `[]` pour une incantation innée qui n'en exige aucune : Silence ne l'arrête alors pas. L'utilisation d'un objet peut être `"kind": "utility"` quand elle ne fait que laisser une zone en place (un parchemin de Fog Cloud, Darkness, Silence ou Globe of Invulnerability) ; elle a besoin d'une `area` et d'une `zone`.

Poussées, vents et lunettes (Capability API 1.182). Le `"push": 15` d'une entrée pousse quiconque elle touche sans réussir sa sauvegarde de 15 dans la distance du catalogue, en ligne droite à l'opposé de son auteur, en s'arrêtant devant tout obstacle solide ou toute personne debout ; une zone pousse de la même façon quiconque elle prend. Une zone maintenue par son lanceur (`"anchor": "caster"`) peut désormais être une ligne ou un cône aussi bien qu'une explosion : elle pointe dans la direction où elle a été lancée et suit son lanceur, et `"turn": { "budget": "bonus" }` permet à celui-ci de dépenser ce budget pendant son tour pour l'orienter autrement, en prenant quiconque elle couvre désormais comme s'il y était entré (le Gust of Wind de 5e). Le `terrain` d'une zone avec `"towardCaster": true` ne rend le terrain difficile que pour un pas qui rapproche celui qui se déplace de son lanceur. Un sens donné par un état ou un objet peut être `{ "add": 60 }` au lieu d'une portée : il s'ajoute à la portée de ce sens chez le porteur, ou donne 60 à quelqu'un qui n'en a pas (les lunettes de nuit de 5e).

Des zones qui se déclenchent plus tard ou se consument (Capability API 1.183). Une zone avec `"detonates"` ne fait rien tant qu'elle tient ni à son lancement : quand elle prend fin, parce que sa concentration a pris fin, que ses rondes sont écoulées ou qu'elle a été relancée, elle fait une fois l'effet propre de l'entrée à tous ceux qui s'y trouvent. `"grows": { "dice": "1d6" }` ajoute autant à sa quantité à la fin de chaque tour de son lanceur, y compris le tour du lancement : elle lance donc les mêmes dés que la quantité propre de l'entrée ; `"touched": true` fait lancer la sauvegarde de l'entrée à quiconque se déplace sur son centre, et la déclenche en cas d'échec (le Delayed Blast Fireball de 5e). Elle reste là où elle a été lancée. Une zone avec `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` est enflammée par des dégâts de l'un de ces types qui touchent l'une de ses cases ou quelqu'un qui s'y trouve ; elle se consume quand le tour de son lanceur revient, ce qui met fin au sort, et inflige entre-temps sa quantité sans sauvegarde à toute autre personne qui commence un tour dedans (le Web de 5e).

Les créatures poussent aussi (Capability API 1.184). L'action d'une créature accepte `"push": 60` dans la distance propre de l'ensemble, comme une entrée de catalogue : quiconque elle touche est poussé d'autant en ligne droite à l'opposé de la créature et, avec un `save`, seulement en cas d'échec : `"onSuccess": "none"` garde donc les dégâts et n'épargne que la poussée et ce que `applies` applique (la Tail d'une tortue-dragon). L'utilisation d'un objet peut donner une `width` à une ligne, comme les 60 pieds sur 10 d'un parchemin de Gust of Wind.

Ce qu'est une créature compte davantage (Capability API 1.185). Une sauvegarde peut indiquer `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`, pour qu'une cible de ce type la lance deux fois et garde le pire résultat (Sunbeam) ; le `"maxAgainst": { "types": ["plant"] }` d'une entrée inflige ses dégâts maximaux à une cible de ce type (Blight). `targetTypes` peut aussi indiquer `"abilityAtMost": { "int": 3 }`, pour une cible dont la valeur ne dépasse pas celle-là (une créature écrite sans cette valeur n'est pas exclue), et `"notImmuneTo": ["charmed"]` (Sleep). Le modificateur d'un état peut faire lancer les attaques deux fois : `{ "to": "attacks", "mode": "disadvantage", "atSource": true }` concerne les propres attaques du porteur contre celui qui le lui a appliqué (Chill Touch), et `{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` les attaques faites contre le porteur par des attaquants de ce type (Protection from Evil and Good). Une modification des sauvegardes peut être `"against": { "from": { "types": ["dragon"] } }`, qui correspond à toute sauvegarde contre une chose faite par une créature de ce type (Dragon Scale Mail).

Les actions d'une créature peuvent se recharger ensemble (Capability API 1.186) : donne à chaque `"recharge"` le même `"group"` et les mêmes dés ; utiliser l'une dépense les deux, et un seul jet au début du tour de la créature les ramène toutes les deux (les deux souffles d'un dragon métallique). Un coup peut avoir une `"charge"` : `{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` ajoute ses clauses quand le déplacement de la créature ce tour-ci s'est terminé par une course d'au moins `atLeast` droit vers celui qu'elle frappe, chaque pas la rapprochant d'une case ; la cible fait alors la sauvegarde et, en cas d'échec (ou toujours, sans sauvegarde), est poussée et reçoit les états (la Charge d'un minotaure). Une charge accompagne un coup contre une seule cible et ne se mesure que sur un plateau.

L'`attack` d'un objet peut en dire plus sur ce qu'il touche (Capability API 1.187). `"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` ajoute au toucher contre une cible de ce type (une masse de destruction). Une clause `plus` peut indiquer `"not": { "types": ["construct", "undead"] }` pour ignorer les cibles de ce type, `"blow": "ranged"` pour ne compter que sur un coup lancé ou tiré (un marteau de lancer nain) ou `"melee"` seulement sur un coup au contact, et `"tempHp": true` pour donner au porteur de l'arme des points de vie temporaires égaux à ce qu'elle a infligé (une épée voleuse de vie). Un état `onHit` peut nommer `"targetIs"` (une tueuse de géants qui renverse un géant) et `"oncePerTurn": true` (une épée de blessure). `"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` tue net une cible que le coup a laissée à `healthAtMost` ou moins, sur une sauvegarde ratée si elle en a une, en dépensant les charges de l'objet quand c'est le cas (une voleuse de neuf vies) ; `"immuneTo": ["slashing"]` épargne une cible immunisée contre ce type (une épée vorpale). La santé est lue après les dégâts du coup.

Le `live.conditions` d'une fiche, le `clear.conditions` d'un repos et `combat.conditions` contiennent jusqu'à 320 entrées (Capability API 1.269 ; 160 à partir de 1.188, 80 avant). Un modificateur `to: "attacks"` peut nommer `"ability": "str"` pour ne modifier que les attaques faites avec cet attribut (le Weakening Breath d'un dragon d'or), et un modificateur `to: "checks"` peut nommer `"abilities": ["str"]` pour ne modifier que les tests d'attribut faits avec l'un d'eux, tests en confrontation et tests de compétence de cet attribut compris (la Rage d'un barbare). Les actions du bloc de statistiques d'une créature ne nomment aucun attribut : un modificateur d'attaques restreint à un attribut ne les atteint donc jamais.

Un état de `combat.conditions` peut blesser son porteur (Capability API 1.189) : `"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` inflige cela au début de chacun de ses tours (ou `"turn-end"`), de la part de celui qui l'a appliqué, avant toute sauvegarde qui y met fin. `"stacks": 10` permet de l'appliquer à nouveau tant qu'il dure, jusqu'à ce nombre de fois, et sa blessure est infligée une fois pour chacun (une épée de blessure) ; y mettre fin les termine tous. `"onePerSource": true` le garde sur un seul porteur par source : appliqué à quelqu'un d'autre, il quitte celui qui l'avait de la même source (l'ennemi juré d'un arc du serment). L'entrée `against` d'une attaque d'objet peut nommer `"marked": "sworn"` au lieu ou à côté de `is`, ce qui correspond à une cible portant cet état venant du porteur de l'arme, et en plus de `toHit` peut indiquer `"mode": "advantage"`, `"ignoresCover": true` (une couverture qui n'est pas totale ne compte pour rien) et `"ignoresLongRange": true` ; une clause `plus` peut aussi indiquer `"marked": "sworn"` (les 3d6 perforants de l'arc du serment). L'action du bloc de statistiques d'une créature peut nommer `"ability": "str"`, l'attribut avec lequel son attaque est faite, pour que les modifications des attaques ou des dégâts restreintes à un attribut l'atteignent.

L'entrée `modes` d'une attaque d'objet peut être une tout autre façon d'utiliser l'arme (Capability API 1.190) : `"range": { "normal": 120 }` est sa portée dans ce mode, dans la distance propre de l'ensemble ; `"plus"` ajoute des clauses à un coup, comme celles de l'attaque elle-même ; `"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` est un éclair contre lequel toute personne debout entre le porteur et la cible (ni l'un ni l'autre) fait une sauvegarde avant le jet d'attaque ; et `"charges": 1` dépense autant de charges propres à l'objet, pour que le mode ne soit proposé que tant qu'il en a (un javelot de foudre : `charges.max` 1 et `stack` 1 sur l'objet). Une ligne a besoin d'un plateau à traverser.

Un état de combat avec l'effet `"cannot-heal"` empêche tout soin sur son porteur tant qu'il dure, et le journal le dit (Capability API 1.191) : le Chill Touch de 5e. `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` sur un état de combat n'écarte ces états que lorsqu'une créature correspondant à `from` les applique ; un état déjà présent reste (Protection from Evil and Good). Le `targetTypes.abilityAtLeast` d'un sort est le plancher dont `abilityAtMost` est le plafond : `{ "int": 5 }` ignore une créature d'Intelligence 4 ou moins (Hideous Laughter), et une créature écrite sans cette valeur n'est pas exclue. Le `against.actions` d'un modificateur de sauvegardes nomme des actions par identifiant, nom ou groupe de recharge partagé, sans tenir compte de la casse, et restreint tout ce que dit d'autre `against` : `{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` désigne le souffle ou la Frightful Presence d'un dragon, jamais sa Wing Attack, et la sauvegarde répétée pour mettre fin à un état appliqué par l'un d'eux compte aussi.

Une attaque d'objet peut porter d'autres effets supplémentaires (Capability API 1.192). `"ignoresResistance": true` fait passer ses dégâts outre la résistance de la cible au type de dégâts propre à l'attaque, résistance à tout comprise, tandis qu'une clause `plus` d'un autre type est toujours réduite de moitié (le tranchant d'une épée vorpale) ; l'immunité tient toujours. Le `"saved"` d'une entrée `slay` liste des états, sous la même forme que `applies`, qu'une cible qui réussit la sauvegarde de cette mise à mort reçoit à la place : `[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` est le fiélon d'une masse d'anéantissement, effrayé par le porteur jusqu'à la fin du prochain tour de celui-ci. `"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` fait lancer avec ce mode toute autre attaque d'arme du porteur tant qu'une créature à laquelle il a appliqué `sworn` reste debout, ou seulement les attaques à distance avec `"ranged": true` (un arc du serment). Et dans un combat sans plateau, une action de zone (d'une créature ou d'un sort) peut être pointée sur des personnes de l'un ou l'autre camp, jamais sur son auteur, car elle prend chaque créature qui s'y trouve ; `friendlyFire: false` la limite à l'autre camp, comme sur un plateau.

Une confrontation peut être un test contre un nombre fixe au lieu d'un jet opposé (Capability API 1.193). Omets `defender` et donne `"difficulty": 15` ; l'acteur lance le meilleur de ses tests `attacker` et gagne s'il l'atteint. `"targets"` indique sur qui elle peut être tentée : `"enemy"` (par défaut), `"ally"` ou `"any"`, acteur compris. `"targetHolds": "wounded"` ne la propose que sur une cible portant cet état, et `"targetDying": true` seulement sur une cible mourante et pas encore stabilisée. `onWin.stabilizes` stabilise une cible mourante. Ainsi, un test de Sagesse (Médecine) DD 15 qui met fin aux blessures d'une épée de blessure s'écrit `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`, et celui de DD 10 qui sauve les mourants `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`. Un combat en réserves compte des réussites et refuse donc `difficulty`. Le `"healedOnlyByRest": true` d'une attaque d'objet scelle les points de vie qu'elle retire : aucun soin ne ramène le porteur au-dessus de son maximum moins ce qui est scellé, et tout repos les restaure et lève le scellé. Le `harms` d'un état de combat accepte le même `"healedOnlyByRest": true` : les blessures que laisse l'épée scellent donc aussi ce qu'elles retirent.

Une taille peut occuper plus d'une case (Capability API 1.194). Donne à une entrée de `combat.sizes.order` un nombre de `"cells"`, `{ "id": "large", "label": "Large", "cells": 2 }`, et une créature de cette taille occupe autant de cases de côté sur un plateau, sa propre case étant celle en haut à gauche : en 5e, Large vaut 2, Huge 3 et Gargantuan 4. Elle est posée là où elle tient entièrement, à l'endroit le plus proche de celui où on a demandé de la placer. L'allonge et la portée se mesurent depuis et vers la case la plus proche qu'elle occupe : une épée atteint donc un ogre depuis une case voisine de n'importe laquelle de ses quatre cases ; elle ne se déplace que là où elle tient entièrement et personne ne traverse aucune de ses cases ; une zone la prend dès que l'une de ses cases est dedans ; une poussée la déplace tout entière ; et elle est vue, et couverte, depuis celle de ses cases la plus dégagée. Une taille sans `cells` occupe une case, exactement comme avant.

Un état peut agrandir ou rétrécir son porteur (Capability API 1.195). Donne à une entrée de `combat.conditions` un `"size": { "steps": 1 }` : tant qu'il dure, son porteur avance d'autant de tailles dans `combat.sizes.order`, ou recule pour un nombre négatif, sans jamais dépasser la première ni la dernière : l'Enlarge de 5e vaut `1` et Reduce `-1`. Son allonge, ce que les zones prennent et tout ce qui demande sa taille lisent la nouvelle, et quand l'état prend fin, il retrouve sa propre taille. Sur un plateau, quelqu'un qui grandit occupe sa nouvelle taille par-dessus toutes les cases où il se tenait, là où elle tient sur un terrain libre et dégagé de toute autre personne, ou la plus grande taille inférieure qui y tient : un ogre agrandi dans un couloir ne grandit donc qu'autant que le couloir le permet ; quelqu'un qui rétrécit garde sa case en haut à gauche. Le journal indique qui a changé, et en quoi. Cela nécessite `combat.sizes` ; associe-le à un modificateur `damage` pour les dés d'arme et à un mode de Force sur `checks` et `saves` pour le reste du sort.

Une entrée peut choisir ses cibles selon la santé qui leur reste (Capability API 1.196). `"healthPool": { "dice": "5d8" }` dans ses `mechanics` est lancé une fois à l'utilisation et réparti en partant de la cible à qui il reste le moins de santé : chacune n'est affectée que si sa santé ne dépasse pas ce qui reste, qu'elle consomme alors, et les autres ne sont pas touchées du tout, comme fonctionnent Sleep et Color Spray en 5e ; `perCostStep` l'augmente quand le sort est lancé à un niveau supérieur. `"healthAtMost": 150` n'affecte qu'une cible ayant cette santé ou moins, comme Power Word Stun ; `"kills": true` tue net quiconque est affecté : Power Word Kill s'écrit donc `"healthAtMost": 100, "kills": true`. Les deux lisent la santé qui reste à une cible, après que `targetTypes` a dit qui peut être visé. Le journal indique ce qu'une réserve a donné et pour qui elle a suffi.

Un modificateur de dégâts peut lancer plusieurs fois les dés propres d'un coup (Capability API 1.197). `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` sur un état fait infliger 2d8 + 2 au lieu de 1d8 + 2 à un pic de guerre tant qu'il dure, comme les armes d'un duergar agrandi ; sa part fixe reste la même, un critique double les dés supplémentaires comme le reste, et la moyenne du menu les compte. Cela modifie les dégâts d'un coup et rien d'autre. L'action d'une créature avec `"self": true` utilisée pendant son propre tour s'applique désormais à la créature elle-même, comme c'était déjà le cas dans une réaction : ses `applies` s'appliquent donc.

Une zone peut infliger, à ses déclencheurs, un autre type de dégâts qu'à son apparition (Capability API 1.198). `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }` sur une entrée dont le propre `damageType` est `"piercing"` inflige des dégâts perforants à ceux autour de qui le mur apparaît et des dégâts tranchants à ceux qui y entrent plus tard, comme le Wall of Thorns de 5e. Cela nécessite le propre `amount` de l'entrée et un déclencheur, un côté ou une percussion pour l'infliger, et nomme l'un des `combat.damageTypes` quand l'ensemble les déclare.

Une réserve de santé peut passer par-dessus certaines cibles (Capability API 1.199). `"healthPoolSkips": { "conditions": ["unconscious"] }` à côté d'un `healthPool` laisse de côté quiconque porte l'un de ces états et ne dépense rien de la réserve pour lui, comme Sleep en 5e ignore les inconscients ; `"unseeing": true` fait de même pour quiconque ne peut pas voir l'auteur de l'entrée (aveuglé, ou sans ligne de vue vers lui), comme Color Spray ignore les créatures qui ne voient pas. Cela nomme `conditions`, `unseeing` ou les deux, et nécessite un `healthPool`.

Un mur peut se dresser en sections frappées et brisées une à une (Capability API 1.200). `"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` est le Wall of Ice de 5e : chaque panneau de 10 pieds a une CA de 12 et 30 points de vie et subit le double des dégâts de feu (`resist` et `immune` fonctionnent de la même façon). Une attaque qui vise un seul ennemi ou n'importe qui et inflige des dégâts peut plutôt être pointée sur une section : son option liste les cases qu'elle peut frapper sous `walls`, et le choix en nomme une sous `wall`. L'attaque est lancée et ses dégâts infligés comme contre une créature, et le journal indique ce que la section a subi et ce qui lui reste. Une section ramenée à 0 est brisée : elle cesse de bloquer, et quiconque y entre (ou y commence ou termine un tour, selon ses `triggers`) subit son `amount`, une fois par tour, en faisant sa sauvegarde `save` contre la difficulté propre de l'entrée pour n'en subir que la moitié (`onSave: "none"` pour ne rien subir). Les sections nécessitent un mur qui `blocks`, et le `save` d'une section brisée nécessite le propre `save` de l'entrée.

Une entrée peut déplacer les pistes vivantes de la fiche et rendre une santé scellée (Capability API 1.201). `"tracks": [{ "track": "exhaustion", "by": -1 }]` retire un niveau d'épuisement à quiconque elle touche, comme le Greater Restoration de 5e, et `"by": 1` sur une entrée avec sauvegarde (Sickening Radiance) en ajoute un à quiconque la rate. Chaque piste reste dans ses propres limites, les niveaux qui réduisent de moitié le maximum de santé prennent effet aussitôt, et atteindre un niveau qui `defeats` tue. `"unseals": true` rend la santé que seul un repos rendrait (ce qu'un coup `seals` a retiré), comme Greater Restoration met fin à une réduction du maximum de points de vie. Une entrée qui ne guérit que de cette façon n'est proposée que sur quelqu'un qu'elle aiderait. Le `broken` d'une section de mur peut porter son propre `perCostStep`, ajouté une fois pour chaque cran dont le lancement a été payé au-dessus de sa base : l'air glacial de Wall of Ice, `{ "dice": "1d6" }`. Les pistes sont des pistes ordinaires, pas des pistes de blessures, et `unseals` nécessite une santé comptée en points.

Un état qu'une entrée applique peut prendre fin avec un autre état qu'elle applique (Capability API 1.202). Dans `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`, le Hypnotic Pattern de 5e, l'incapacité prend fin dès que le charme prend fin : une sauvegarde, une guérison, la rupture de la concentration de son lanceur, un allié qui secoue la cible pour la réveiller, ou la fin du combat. Seul l'état appliqué par la même utilisation l'accompagne, et le journal dit pourquoi. `endsWith` nomme un autre état de la même liste `applies` (ou de la liste `onEnd`, `charge` ou `saved`), jamais le sien.

L'action d'une créature peut abaisser le maximum de santé de sa cible (Capability API 1.203). `"reducesMax": { "save": "con_save", "difficulty": 14 }` sur le Life Drain d'une âme-en-peine fait lancer cette sauvegarde à la cible quand le coup porte ; en cas d'échec, les dégâts qu'elle subit sont retirés de son maximum comme de sa santé, et aucun soin ne les lui rend avant un repos. Avec `"lasting": true` (le Slam d'un golem d'argile), même un repos ne les rend pas, seulement une entrée qui `unseals` (Greater Restoration). Une cible dont le maximum tombe ainsi à 0 meurt. Une fiche garde ce qu'aucun repos ne rend dans le `lasting` de sa réserve, à l'intérieur de `sealed`. Cela nécessite une santé comptée en points.

Un remède peut appliquer un seul de ses remèdes plutôt que tous (Capability API 1.204). Avec `"cureOneOf": true`, une entrée qui met fin (`ends`) à certains états, déplace des `tracks` et `unseals` (le Greater Restoration de 5e : charmé, pétrifié, un niveau d'épuisement ou le maximum de points de vie) en applique exactement un : chacun est proposé comme mode de l'option (un état, une piste ou la réserve de santé, par son libellé), comme les modes d'une arme, et une utilisation sans choix applique le premier d'entre eux, dans cet ordre, pour lequel la cible a quelque chose. Cela nécessite au moins deux remèdes entre lesquels choisir.

Un maximum abaissé peut n'exiger aucune sauvegarde propre (Capability API 1.235). Un `reducesMax` sans `save` ni `difficulty` abaisse le maximum d'autant que les dégâts de chaque coup qui porte (la Bite du vampire en 5e) ; avec `"onFailedSave": true`, seulement quand la cible a raté la sauvegarde propre de l'entrée (le Harm de 5e, une entrée de catalogue avec sauvegarde ; là, `reducesMax` n'a jamais de sauvegarde propre). `damageType` ne compte que les dégâts de ce type (les dégâts nécrotiques de la Bite), et `"heals": true` rend à son auteur autant de points de vie qu'il en a abaissé. Les mécaniques de catalogue acceptent aussi `reducesMax`, et `leavesAtLeast` empêche les dégâts de l'entrée de faire descendre la cible sous ce nombre de points de vie (Harm en laisse 1). `targetHolds` sur une action de créature ou des mécaniques de catalogue limite qui elle peut viser : quelqu'un qui porte l'un des états de ses `conditions`, ou l'un de ceux de ses `fromSelf` que l'auteur de l'action lui a appliqué (la Bite : agrippé par le vampire, ou neutralisé ou entravé).

Un état peut donner à son porteur des utilisations propres (Capability API 1.236). Les `actions` d'un état de combat listent des entrées de catalogue (`spells/break-enchantment`) que son porteur peut utiliser tant qu'il le porte : elles ne sont au menu qu'à ce moment-là, ne coûtent rien sur la fiche hormis le budget que chacune dépense, et sont lancées avec les nombres propres du porteur, comme ses sorts (une créature qui lance des sorts utilise ceux de son incantation). Une entrée avec `"endsCondition": "<condition>"` met fin à cet état sur son utilisateur une fois utilisée, ainsi qu'à la concentration qui le maintient quand c'est celle de l'utilisateur : le Dispel Evil and Good de 5e, dont Break Enchantment et Dismissal mettent chacun fin au sort. `ends.from` (un test de type et de tag) ne guérit que ce qu'une créature qui le passe a appliqué : Break Enchantment met fin à un charme ou à une frayeur dus à un céleste, un élémentaire, une fée, un fiélon ou un mort-vivant, et laisse ceux dus à quelqu'un d'autre. `dismisses` renvoie hors du combat quiconque elle touche sans qu'il réussisse sa sauvegarde, vivant, hors du plateau et hors de l'ordre des tours : `true` pour de bon (Dismissal), ou `{ "while": "<condition>" }` tant qu'il porte cet état, que la même entrée doit appliquer (le Banishment de 5e). Son décompte suit alors les tours de son lanceur, et quand il prend fin, par sa durée, une sauvegarde ou la concentration du lanceur, la cible revient là où elle était, ou à la place libre la plus proche où elle tient. Avec `gone` (un test de type et de tag), une cible qui le passe et a subi l'état pendant toute sa durée reste partie.

Un combat peut commencer avec certains de ses participants pris au dépourvu (Capability API 1.237). La scène dit lesquels : la rencontre dont il est tiré les marque `"surprised": true`, qu'ils soient de l'équipe ou ennemis. Pendant leur premier tour, ils ne peuvent ni se déplacer ni agir, et leur menu ne contient que la fin du tour ; ils n'ont ni réaction ni utilisation légendaire tant que ce tour n'est pas terminé ou que la première ronde ne l'est pas, selon ce qui arrive en premier. Un état de combat avec `"cannotBeSurprised": true` empêche son porteur d'être jamais surpris : le Foresight de 5e. Une entrée de catalogue avec `"ignoresSurpriseWith": "<catalog>/<entry>"` nomme une utilisation que son porteur peut encore faire en étant surpris, et la faire met fin à la surprise sur-le-champ, si bien que le reste du tour lui appartient : le Feral Instinct de 5e, qui permet à un barbare surpris d'agir normalement s'il entre d'abord en rage.

Une entrée de catalogue peut donner à son porteur un second tour pendant la première ronde d'un combat (Capability API 1.238). `"extraFirstTurn": { "initiative": -10 }` sur une entrée tenue dans une liste de la fiche place ce second tour à l'initiative du porteur plus ce nombre, après tous ceux qui sont à ce nombre ou au-dessus ; chacun des deux est un tour complet, et à partir de la deuxième ronde le porteur joue un tour par ronde comme d'habitude. Un porteur mis hors de combat avant l'arrivée du second tour le manque simplement. Avec `"unlessSurprised": true`, il n'y a pas de second tour pour celui qui commence le combat surpris : le Thief's Reflexes de 5e.

Un état de combat peut restreindre ce qu'achète le budget qu'il accorde à un coup porté à portée d'allonge, et laisser une marque sur les pistes de son porteur quand il prend fin (Capability API 1.239). Avec `"grants": { "budget": "bonus", "attacks": true, "melee": true }`, la seule frappe que paie ce budget ne se fait qu'avec une arme qui frappe à portée d'allonge, et une arme de lancer seulement contre quelqu'un à portée de son allonge, puisqu'elle est maniée plutôt que lancée ; une arme qui a une portée et pas d'allonge n'est pas proposée. `"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` déplace les pistes vivantes de son porteur de ce nombre de niveaux quand l'état prend fin, quelle que soit la façon dont il prend fin, comme `tracks` sur une entrée de catalogue ; `applies` et `tracks` peuvent figurer ensemble ou seuls. Le `"usesOf": "<row name>"` d'une entrée de catalogue dépense les utilisations de l'entrée de cette ligne (sa ligne de compteur) au lieu des siennes. Le Frenzy de 5e est alors une entrée de Berserker, Frenzied Rage, avec `"usesOf": "Rage"`, qui applique la rage et un état `frenzied` dont le `endsWith` la nomme, et qui réunit ainsi ces deux éléments.

L'initiative peut être lancée deux fois, en gardant le meilleur ou le pire jet (Capability API 1.240). `combat.initiative.checkAbility` indique que l'initiative est un test fait avec cet attribut : tout ce qui fait lancer deux fois un tel test fait donc lancer deux fois l'initiative, qu'il s'agisse d'un état avec `own-checks-advantage` (le Foresight de 5e) ou d'un modificateur `checks` avec un `mode`, restreint à cet attribut ou à aucun (le Cat's Grace d'Enhance Ability sur la Dextérité). Une entrée de catalogue tenue dans une liste de la fiche avec `"initiativeMode": "advantage"` (ou `"disadvantage"`) fait lancer deux fois l'initiative de son porteur quoi qu'il porte : le Feral Instinct de 5e. Avantage et désavantage s'annulent, comme sur tout jet ; l'entrée d'initiative du journal porte `mode` et le jet `dropped`. Un combat qui relance l'initiative à chaque ronde la lance deux fois à chaque ronde. Dés lancés uniquement : l'initiative d'une réserve n'est pas lancée deux fois.

Une réaction peut répondre au coup réussi PROPRE de son porteur (Capability API 1.241) : une réaction `"hit"` avec `"by": "self"` est proposée à l'attaquant une fois que son jet a touché, après que tous ceux que le coup a frappés ont répondu, et vise celui qu'il a touché (écris `"at": "target"`). `"weapon": true` restreint tout moment de coup réussi à un coup d'arme : une attaque, ou l'action à cible unique d'une créature, qui ne vient d'aucun catalogue. Une réaction à son propre coup n'est pas arrêtée par ce qui arrête les réactions, puisque la choisir fait partie de l'attaque ; marque-la `"free"` sauf si elle dépense vraiment un budget. Le Stunning Strike de 5e en est une : `"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`, gratuite, avec un coût en ki, une sauvegarde de Constitution et `stunned` jusqu'à la fin du prochain tour du moine. Avec `"addsToBlow": true`, la quantité d'une entrée d'attaque rejoint ce coup au lieu d'être infligée séparément : lancée quand le coup porte, doublée par son critique, ses clauses ne s'appliquant qu'à une cible qu'elles atteignent. Le Divine Smite de 5e, ce sont 2d8 radiants, `perCostStep` 1d8, une clause de 1d8 radiants avec `targetIs` fiélon ou mort-vivant, et `"perCostStepsMax": 3` : le nombre maximal de crans d'un coût supérieur qui comptent, pour toute entrée avec `perCostStep` ou `targetsPerCostStep`. Une attaque faite dans une autre fenêtre (une attaque d'opportunité) n'est jamais retenue pour son coup réussi : rien ne s'y ajoute donc.

Ce que contient une fiche peut modifier ses lignes d'attaque, accorder des frappes et attendre l'action d'attaque (Capability API 1.242). Une entrée de catalogue tenue dans une liste de la fiche avec `attackRows` modifie les lignes dont elle liste les noms (comparés sans tenir compte de la casse), tant que ses bornes `when` sont respectées (une valeur de la fiche, comme une armure portée au plus égale à 0) : `abilities` utilise le meilleur de l'attribut propre de la ligne et de ceux-ci pour toucher et, quand les dégâts de la ligne ajoutent ce même attribut, pour les dégâts ; `die` (`from` une valeur de la fiche, par une `table` de paliers, vers un nombre de faces) lance un seul dé de cette taille à la place des dés de la ligne quand sa moyenne est meilleure ; `qualities` s'ajoute à ce que les coups portent pour passer une résistance. Le Martial Arts de 5e s'écrit `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`, et Ki-Empowered Strikes `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`. Le `grantsStrike` d'une entrée tenue permet à son porteur d'acheter une frappe avec un autre budget une fois le budget propre d'une attaque dépensé, exactement comme le `grants.attacks` d'un état : `names` la restreint à ces attaques, `melee` à l'allonge, et `afterAttack` à un tour où l'action d'attaque a été faite (`true`, ou `{ "names": [...] }` pour une action d'attaque faite avec l'une d'elles). La frappe à mains nues bonus de Martial Arts s'écrit `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`. Le `grants` d'un état accepte les mêmes `names` et `afterAttack`. Une entrée avec `afterAttack` n'est proposée qu'après l'action d'attaque : Flurry of Blows est une entrée `utility` sur le budget bonus, qui dépense un ki, avec `afterAttack`, qui `gives` 2 d'un budget déclaré avec un compte de 0, et un `grantsStrike` d'Unarmed Strike sur ce budget. L'action d'attaque, c'est toute attaque faite depuis une liste d'attaques ou un objet qui paie son propre budget ou une frappe déjà achetée, jamais une attaque payée par un octroi.

Une attaque d'opportunité est retenue là où elle touche exactement comme une attaque pendant un tour (Capability API 1.243) : tous ceux qui ont une réponse à ce coup sont sollicités, son auteur en dernier pour ce qu'il y ajoute (Divine Smite, Stunning Strike), et la fenêtre propre du déplacement, où celui qui frappe a déjà répondu, est sollicitée de nouveau une fois le coup porté. Celui qui se déplace et se retrouve immobilisé en chemin (un état avec `speed-zero`, comme étourdi ou agrippé) ne va pas plus loin que la case où il a été frappé. Une entrée qui est une réaction ou qui s'ajoute à un autre coup n'est jamais choisie comme attaque d'opportunité elle-même.

Les règles d'attaque atteignent les armes tenues, et une liste d'attaques peut donner une ligne à chaque fiche (Capability API 1.244). `combat.attacks[].always` liste jusqu'à 4 lignes écrites dans les colonnes de cette liste que le combat de chaque fiche possède en plus des siennes ; une ligne de fiche du même nom est utilisée à sa place. La frappe à mains nues de 5e s'écrit `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`. Le `names` d'une règle `attackRows` reconnaît désormais aussi une arme tenue par le nom sous lequel son attaque est connue, et ses `items` reconnaissent les armes tenues par leurs tags : tous ceux de `tags` et aucun de `notTags` (`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`, donc une dague +1 compte) ; une règle nomme `names`, `items` ou les deux. `wielding: { "only": {...} }`, avec les mêmes `names`, `tags` et `notTags`, ne garde une règle que tant que chaque arme tenue en fait partie, ou qu'aucune n'est tenue : "unarmed or wielding only monk weapons". Un `grantsStrike` accepte le même `wielding`, et un `when` comme celui d'une règle `attackRows` : la frappe bonus de Martial Arts n'est donc pas proposée en armure.

Plusieurs utilisations à la fois, une sauvegarde qui fait tomber à 0, des coups réussis par des attaques nommées et une blessure à la fin d'un état (Capability API 1.245). Le `usesSpent` d'une entrée dépense autant d'utilisations de sa ligne (ou de celle de `usesOf`) en une seule utilisation, et n'est proposé que tant qu'il en reste autant : les 3 ki de Quivering Palm. Le `names` d'une réaction `"hit"` ne répond qu'à un coup réussi par ces attaques, comparées par nom sans tenir compte de la casse : Quivering Palm s'écrit `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }` et applique un état `quivering` de longue durée. `dropsOnFailedSave` sur une entrée avec sauvegarde fait tomber à 0 santé une cible qui la rate au lieu d'infliger sa quantité (une créature est hors de combat, un personnage mourant là où l'ensemble a une règle de mort) ; une cible qui la réussit subit la quantité comme le dit l'`onSuccess` de la sauvegarde. Mettre fin aux vibrations est une action avec `targetHolds: { "fromSelf": ["quivering"] }`, 10d10 nécrotiques, une sauvegarde de Constitution avec `onSuccess: "none"` et `dropsOnFailedSave`. Le `onEnd.harm` d'un état (`dice`, `flat`, `type`, `unless`) inflige des dégâts à son porteur quand il prend fin, de la part de celui qui l'a appliqué, sauf si le porteur correspond à ce que nomme `unless` : Hurl Through Hell est une réaction au coup réussi avec `dismisses: { "while": "hurled" }` et `hurled` qui dure `{ "rounds": 1, "of": "source" }`, et le `onEnd` de l'état `hurled` s'écrit `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`.

`afterAttack` reconnaît aussi par ses tags l'arme avec laquelle l'action d'attaque a été faite (Capability API 1.246) : `{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` signifie après une attaque portant l'un de ces noms ou faite avec une arme tenue qui a tous les `tags` et aucun des `notTags`, quel que soit son nom : une dague +1 compte donc. Il nomme `names`, `items` ou les deux, aussi bien sur une entrée que sur un `grantsStrike` ou l'octroi d'un état.

Coups téméraires et brutaux (Capability API 1.247). Une entrée avec `beforeAttack` n'est proposée que pendant le propre tour de son porteur, avant qu'il y ait attaqué : Reckless Attack est un `buff` gratuit sur le barbare avec `beforeAttack`, qui applique `reckless` pour `{ "rounds": 1 }` et `exposed` pour `{ "rounds": 1, "at": "turn-start" }`. Une modification des attaques accepte `attacks` (`weapon`, `spell` ou `any`) et `blow` (`melee` ou `ranged`) comme une modification des dégâts, avec `ability` : `reckless` s'écrit `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`, et `exposed` a l'effet `attacks-against-advantage`. Le `criticalDice` d'une modification des dégâts ajoute autant de dés de dégâts propres au coup, sur un coup critique seulement, sans les doubler : Brutal Critical est un niveau d'une valeur dérivée du barbare avec `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`, un niveau par dé.

Réponses aux coups d'une rafale (Capability API 1.248). Le `budget` d'un moment `hit` le restreint aux coups réussis par une frappe payée sur ce budget : Open Hand Technique répond à `{ "on": "hit", "by": "self", "budget": "flurry" }`, le budget que Flurry of Blows `gives` et que son `grantsStrike` dépense. Le `oneOf` d'une réaction nomme un groupe de réponses au propre coup réussi de son porteur dont une seule est prise par coup : Open Hand Technique, ce sont trois entrées gratuites partageant `"oneOf": "open-hand"`, l'une avec un `save` de Dextérité qui applique `prone`, une autre avec un `save` de Force et un `push` de 15, et une dernière qui applique un état avec l'effet `cannot-react` pour `{ "rounds": 1, "at": "turn-start" }`. En prendre une dépense les deux autres pour ce coup ; le coup suivant propose à nouveau les trois. `oneOf` se place sur un moment `hit` `by` `self` sans `also`.

Des sauvetages après le jet (Capability API 1.249). Une modification de `attacks`, `saves` ou `checks` avec `"rescue": true` est tenue à l'écart du jet : c'est seulement quand le propre jet de son porteur est insuffisant, et que son maximum (la part fixe et chaque dé à sa valeur la plus haute) pourrait combler l'écart, qu'elle est lancée et ajoutée, et l'état dont elle vient est consommé. Un jet qu'elle ne pourrait pas renverser la conserve. Bardic Inspiration est un état appliqué à un allié avec `{ "to": "saves", "dice": "1d6", "rescue": true }` et la même chose pour `attacks` et `checks` (un état par taille de dé, choisi selon le niveau du barde comme les autres bandes) ; Guidance correspond à `checks` avec `1d4`, Resistance à `saves` avec `1d4`. Un raté naturel n'est jamais sauvé, et un combat sur une réserve de dés ne retient rien. Le `rescue` d'une entrée la retire du menu : elle est dépensée, avec ses utilisations et son coût, quand le propre jet de ce genre de son porteur a échoué. `{ "roll": "saves", "by": "reroll" }` relance la sauvegarde et le nouveau jet est conservé (Indomitable avec ses propres utilisations ; Diamond Soul avec `usesOf` Ki) ; `{ "roll": "attacks", "by": "success" }` transforme un raté en coup réussi et `{ "roll": "checks", "by": "success" }` un test raté en réussite (Stroke of Luck). Les modifications tenues à l'écart sont essayées en premier.

Mots cinglants et esquive (Capability API 1.250). Le `lowersRoll` d'une entrée se prend quand l'attaque de quelqu'un d'autre touche, sur une réaction `hit` sans `by` (avec `for` et `within` pour répondre au profit d'alliés) : ses `dice`, ou un seul `die` dont la taille dépend d'une valeur comme celui de Martial Arts (`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`), sont retirés du jet, qui est alors de nouveau comparé à la défense ; un coup réussi naturel touche toujours. Cutting Words est un `debuff` gratuit avec `{ "on": "hit", "for": "ally", "within": 60 }` et `usesOf` le compteur d'inspiration du barde. L'`evasion` d'un état de combat ou d'un niveau nomme des sauvegardes : contre quelque chose qui inflige la moitié en cas de réussite, une sauvegarde réussie ne subit rien et une sauvegarde ratée la moitié. Evasion est un niveau sur le niveau de roublard ou de moine avec `"evasion": ["dex_save"]`.

Imposition des mains (Capability API 1.251). Le `usesChosen` d'une entrée permet à son utilisateur de choisir combien de ses utilisations une utilisation dépense, d'une jusqu'à ce qui reste, et soigne autant de fois sa quantité. L'option porte `amount: { max }` et le choix envoie `amount` ; s'il est omis, il dépense ce qui soigne entièrement la première cible en moyenne. C'est pour un `heal` sans `usesSpent`. Lay on Hands est un `heal` de `"amount": { "flat": 1 }` avec `usesOf` un compteur de cinq par niveau de paladin, `usesChosen` et `"targetTypes": { "not": { "types": ["undead", "construct"] } }`.

Source de magie (Capability API 1.252). Le `restore` d'une entrée rend des points à une réserve de quiconque elle touche, sur un `heal` ou un `buff` : une réserve vivante par son identifiant, ou la réserve d'une ligne de liste par son nom (`"Sorcery Points"`). Avec un `cost` dans une famille de réserves, `perCostStep` s'y ajoute pour chaque cran au-dessus du moins cher, si bien que l'emplacement d'un ensorceleur devient un nombre de Sorcery Points égal à son niveau : un `buff` sur soi qui coûte `slots_1` avec `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` et `"perCostStep": { "flat": 1 }`. `overMax` lui permet de dépasser le maximum de la réserve ; ce qui le dépasse est gardé à part et disparaît quand un repos ramène la réserve à son maximum. Un emplacement créé à partir de points, c'est une entrée par niveau, `usesOf` les points avec `usesSpent` pour prix et `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`. Une entrée qui rendrait à son propre utilisateur une réserve qu'il n'a pas ne figure pas dans son menu.

Métamagie (Capability API 1.253). Le `alters` d'une entrée modifie la façon dont une entrée de ses `catalogs` est utilisée : elle ne figure jamais seule dans un menu, mais elle est proposée avec chaque entrée à laquelle elle convient, choisie au moment où celle-ci est utilisée et payée avec ses propres utilisations (`usesOf` les Sorcery Points avec `usesSpent`, ou `usesSpentByLevel` pour le niveau auquel le sort est payé, au moins un). C'est un `utility` sans réaction. Une seule par utilisation, sauf si elle `joins` une autre. Ce qu'elle modifie, chacune ne convenant qu'à un sort sur lequel elle a quelque chose à modifier : `spares` (une valeur de la fiche : autant de créatures parmi son utilisateur et ses alliés pris par le sort réussissent d'office sa sauvegarde : Careful), `range` (`{ "times": 2, "touch": 30 }` : Distant), `rerolls` (autant de ses dés de dégâts sous la moyenne sont relancés, les plus bas d'abord : Empowered, avec `joins`), `lasts` (ce qu'il applique pour une minute ou plus dure autant de fois plus longtemps, jamais au-delà d'une journée : Extended), `heightens` (sa première cible lance sa première sauvegarde avec désavantage : Heightened), `budget` (`{ "from": "action", "to": "bonus" }` : Quickened), `drops` (les composantes dont il n'a alors plus besoin, et personne ne peut réagir à son lancement : Subtle) et `twins` (une cible de plus pour un sort à une seule cible qui ne vise pas uniquement son utilisateur et ne gagne rien d'un emplacement supérieur : Twinned). Un sort qui ne peut être lancé à l'instant qu'avec l'une d'elles (Quickened une fois l'action dépensée, Subtle sous Silence) est proposé avec `alterNeeded`, et le choix doit la porter. Le choix envoie `alters`, les identifiants pris dans le `alters` de l'option ; le journal indique `altered`.

La métamagie telle qu'elle est choisie (Capability API 1.254). `rerolls` relance les plus bas de tous les dés de dégâts d'un sort, jamais plus que ce nombre au total : les siens, ceux de chaque clause de `plus` et, sur un coup critique, les dés supplémentaires avec ce qui reste. Un sort d'attaque les lance pour chaque cible qu'il touche. Quand une modification `spares` prend plus de membres du camp de son utilisateur qu'elle n'en épargne, l'utilisateur choisit qui : l'offre `alters` de l'option porte `spares` (combien), et le choix envoie `spares`, les identifiants des membres de son camp à épargner (n'en envoyer aucun n'épargne personne). S'il est omis, elle épargne les premiers qu'elle prend. Le choix tient à travers une fenêtre qui répond au lancement. `spares` sans modification qui épargne quelqu'un, plus d'identifiants qu'elle n'en épargne, un identifiant en double ou celui d'un autre camp sont refusés avec `bad-alter`.

La cible de Heightened et Acid Arrow (Capability API 1.255). Quand une modification `heightens` prend plus d'une créature, son utilisateur choisit qui lance sa première sauvegarde avec désavantage : l'offre `alters` de l'option porte `heightens: true`, et le choix envoie `heightens`, l'identifiant d'un combattant (l'un de ceux que le sort vise, s'il en vise, et jamais son utilisateur). S'il est omis, c'est le premier qu'il prend. Une entrée avec `halfOnMiss: true` (elle doit avoir `attackRoll` et un `amount`) inflige quand même la moitié de ses dégâts sur un raté, ceux de ses clauses aussi, et rien d'autre de ce qu'elle fait sur un coup réussi. Le `harmsPerCostStep` d'une entrée `applies` (`{ "dice": "1d4" }`) ajoute autant à ce qu'inflige le `harms` de l'état pour chaque cran d'un coût supérieur avec lequel il a été appliqué : l'acide qui suit d'Acid Arrow, 1d4 de plus par niveau d'emplacement au-dessus du 2e.

Les sauvetages propres d'un porteur, des entrées jamais sur leur utilisateur, et des états un à la fois (Capability API 1.256). Le `rescue` d'une entrée peut aussi être `by: "twenty"` (seulement avec `roll: "checks"`) : le d20 d'un test raté compte comme un 20, dépensé seulement là où cela le fait réussir, comme Stroke of Luck pour un test d'attribut. `by: "die"` ajoute un dé propre au porteur là où rien de ce qu'on lui a donné ne pourrait combler l'écart et où ce dé le pourrait : `dice` (`"1d10"`, Dark One's Own Luck) ou un seul `die` dont la taille dépend d'une valeur de la fiche, `{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }` (Peerless Skill). Un état qu'on lui a donné est essayé d'abord. `notSelf: true` sur une entrée pointée sur une créature `ally` ou `any` l'écarte de son propre utilisateur : Bardic Inspiration. Le `oneAtATime` d'un état de combat nomme un groupe (`"bardic"`) : tant qu'une créature a un état de ce groupe, aucun autre de ce groupe, le même compris, ne peut s'ajouter ; l'événement d'état indique `already`.

Des réponses à plus de types de jets (Capability API 1.257). `lowersRoll` peut aussi lister `"also": ["checks", "damage"]` : en plus d'un jet d'attaque réussi, ses dés sont retirés du test d'attribut d'une autre personne (une confrontation comme une lutte, le seuil d'un objet, le test de Counterspell) ou de son jet de dégâts au moment où il est fait. Cela se dépense de soi-même, avec le budget, les utilisations et le coût de l'entrée, par le premier du camp adverse dont l'entrée atteint celui qui lance, et seulement là où son maximum pourrait renverser le jet : un test qui réussirait et pourrait alors échouer, ou des dégâts qui mettraient à terre quelqu'un du camp de son porteur et pourraient alors le laisser debout. Cutting Words s'écrit `{ "dice": "1d6", "also": ["checks", "damage"] }` avec son dé dimensionné selon le niveau, `needs: ["hearing"]` et `targetTypes: { "notImmuneTo": ["charmed"] }`. Un sauvetage peut nommer des `saves` (seulement un sauvetage de `saves`) : il n'est alors dépensé que sur ces sauvegardes. Avec `budget`, il consomme aussi une unité de ce budget, et n'est pas dépensé sans elle : un anneau d'esquive s'écrit `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }` avec ses charges comme utilisations. L'utilisation d'un objet peut aussi porter `halfOnMiss`, avec `attackRoll` et un `amount` : un parchemin d'Acid Arrow.

Maladies (Capability API 1.258). Les `kinds` d'un état de combat (`["disease"]`) indiquent de quel genre d'état il s'agit. Un genre n'est jamais l'identifiant propre d'un état. Le `ends` d'un remède peut nommer un genre à la place d'états : tout état de ce genre compte, et son `count` n'en prend toujours que ce nombre : la "one disease" de Lesser Restoration s'écrit donc `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. Une immunité (les `conditionImmunities` d'une créature ou d'un objet, ou celles d'un état ou d'un niveau) peut aussi nommer un genre : Divine Health est un état avec `"conditionImmunities": ["disease"]`. Un `saveEnds` peut compter : `successes` (de 2 à 10) est le nombre de réussites qui y mettent fin, et `failures` (`{ "count": 3, "becomes": "blinding_sickness" }`) applique `becomes` à sa place, sans décompte et sans autres sauvegardes, une fois que ce nombre de sauvegardes ont échoué. L'événement d'état indique `worsened`. C'est Contagion : un état `until-save` contre lequel on sauvegarde à la fin de chaque tour, avec trois dans un sens ou dans l'autre. Un état sans décompte n'est pas levé à la fin du combat : une maladie qui s'est installée lui survit donc jusqu'à ce que quelque chose la guérisse.

Des sauvetages sur des objets portés (Capability API 1.259). Le `use` d'un objet peut porter un `rescue` comme les mécaniques d'une entrée, `saves` et `budget` compris. Il ne figure jamais au menu et n'est dépensé que tant que l'objet est porté (là où il a des emplacements) et possède les `charges` que son utilisation dépense. Le dépenser consomme l'une de ces charges. Un anneau d'esquive est un objet avec `"charges": { "max": 3 }` et `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`. Ses charges reviennent comme le dit le `recharge` de l'objet.

Les maladies entre les combats (Capability API 1.260). Un état de combat peut porter `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }` : chaque fois que son porteur prend l'un de ces repos pendant qu'il en est affecté, le maximum de santé baisse d'autant, lancé là où le repos est pris, après que le repos a rendu ce qu'il rend. Sans `lasting`, le repos suivant le restitue ; avec, seul quelque chose qui lève le scellé le fait. Un `onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` est lancé d'abord, comme les tests de l'ensemble et avec le modificateur propre de la fiche : seul un échec abaisse le maximum, et avec `cures` une réussite met fin à l'état (la maladie de l'otyugh). Seule une santé comptée en points a un maximum à abaisser. Le Mummy Rot de 5e est un état sans décompte avec `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`. Une sauvegarde comptée jusqu'à une fin ou jusqu'à ce qu'elle devient (1.258) ne s'arrête plus quand le combat s'arrête : à la fin de tout combat, y compris ceux qui se terminent par une fuite, les sauvegardes de tour restantes de son porteur sont lancées jusqu'au bout, si bien que Contagion est alors soit secouée, soit installée. Une sauvegarde faite seulement sur des dégâts attend des dégâts.

Les stades d'une maladie (Capability API 1.261). Un état de combat peut porter `onDamaged: { "applies": [...] }`, appliqué à son porteur chaque fois qu'il subit des dégâts, avec un décompte comme ceux de `onEnd` (l'étourdissement de Slimy Doom jusqu'à la fin du prochain tour du porteur) ; `expires: { "becomes": conditionId }`, en quoi il se transforme, sans décompte, quand son propre décompte s'épuise, fin du combat comprise, mais pas quand il prend fin d'une autre façon (la maladie du Tentacle d'un aboleth après sa minute) ; et `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`, pour que seul un remède de ces catalogues payé à ce niveau ou plus y mette fin. `onRest.restoredWhenCured: true` (avec `lasting`) rend ce que les repos de cet état ont retiré du maximum quand il disparaît, quelle que soit la façon, sa propre sauvegarde réussie comprise. L'effet `cannot-heal-nonmagical` écarte tout soin sauf un soin magique : en combat, une action dont les qualités indiquent `"magical"` ; hors combat, une opération restore avec `"magical": true` (une potion portant le tag `magical` en est une) ; et jamais un repos ; un restore refusé indique `cannot-heal`. L'action d'un bloc de statistiques peut porter `ends` comme une entrée de catalogue, genres compris : le Healing Touch d'une licorne s'écrit `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`. Un remède que le lanceur choisit parmi ses états, une malédiction parmi plusieurs, c'est `cureOneOf` (1.204).

Des qualités sur l'action d'une créature (Capability API 1.262). L'action d'un bloc de statistiques peut porter des `qualities`, des tags d'objet que l'ensemble déclare, comme celles d'une entrée de catalogue : `["magical"]` rend son soin magique, ce que `cannot-heal-nonmagical` laisse passer, et fait d'une sauvegarde contre elle une sauvegarde contre la magie. L'utilisation d'un objet en combat porte de la même façon les tags propres de l'objet : une potion portant le tag `magical` y soigne donc par magie comme elle le fait sur la fiche.

Auras (Capability API 1.263). Un état de combat peut porter des `auras`, jusqu'à quatre : chacune propage ses `conditions` à quiconque se tient à `distance` ou moins du porteur, selon son `side` : `allies`, `enemies` ou `all`, et au porteur aussi avec `self: true` (pas avec `enemies`). `when` lit une valeur de la fiche du porteur avec `atLeast` ou `atMost` : une aura peut ainsi s'ouvrir à un niveau. Un porteur à terre, vaincu ou ayant l'effet `cannot-act` ne propage rien. Ce qu'une aura propage s'applique au fil du combat, disparaît quand les deux se séparent (le journal indique `aura` et `parted`), n'est jamais écrit sur une fiche et disparaît à la fin du combat ; un état propagé par une aura ne peut pas porter sa propre aura. Sans plateau, l'aura atteint tout le monde de son côté. Pour que le porteur commence chaque combat avec l'état, donne aux mécaniques d'une entrée de catalogue, ou à un bloc de statistiques, `keepsOn` : les états qu'il porte pendant tout le combat, jamais écrits sur une fiche non plus. L'Aura of Protection de 5e est un `aura-of-protection` conservé dont l'aura propage un état qui ajoute le Charisme du paladin aux sauvegardes ; Holy Nimbus est une aura sur les ennemis dont l'état blesse au début de leur tour.

Comportement imposé (Capability API 1.264). Un état de combat peut porter `behavior`, qui décide de ce que son porteur fait de son tour. `only` liste tout ce que le tour peut contenir en plus de sa fin : `move` (se déplacer et se relever), `escape` (se libérer d'une emprise) et les actions standard que l'ensemble déclare ; une liste vide ne laisse que la fin du tour (le halt de Command). `onlyWhenStuck` nomme des actions standard autorisées seulement quand il n'y a nulle part où se déplacer (le Dodge de Turn Undead). `moves: "away"` ne se déplace qu'en s'éloignant de celui qui a appliqué l'état, jamais d'un pas plus près, et finit plus loin ; `moves: "toward"` ne se déplace qu'en se rapprochant (l'approach de Command, Sympathy). `table` est lancé au début de chaque tour du porteur, `{dice, rows: [{atMost, does}]}`, et la première ligne que le jet ne dépasse pas décide du tour : `wander` parcourt toute sa vitesse dans une direction choisie par un d8 et met fin au tour, `nothing` y met fin, `strike` ne permet qu'une attaque au corps à corps contre une créature à portée d'allonge choisie par les dés (amie ou ennemie ; rien s'il n'y a personne), et `normal`, comme un jet au-dessus de toutes les lignes, laisse le tour tel quel (Confusion, Mindfire). Le journal affiche le jet comme un événement `compelled`, et tout le reste est refusé avec `compelled`. Une sauvegarde qui met fin à un état peut aussi être `at: "action"` : son porteur dépense son action pour la lancer (Irresistible Dance).

Les auras vont plus loin (Capability API 1.265). Les `conditions` d'une aura sont désormais facultatives, tant qu'elle propage des états, blesse ou demande une sauvegarde. `needs` liste des sens qu'un receveur doit avoir, et ni le porteur ni le receveur ne peuvent se tenir dans une zone dont les `inside.conditions` retirent ces sens : le `needs: ["hearing"]` de Countercharm s'arrête à Silence. `harms` `{dice, flat, type}` est infligé par le porteur à tous ceux que l'aura atteint au début de chacun des tours du porteur (la Fire Aura d'un balor). `save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` est fait par tous ceux que l'aura atteint au début de leur propre tour : un échec applique `applies` de la part du porteur à cette difficulté, `seen` ne la demande que tant que les deux peuvent se voir (le regard d'un basilic), et `immuneOnSuccess` écarte l'aura de ce porteur pour le reste du combat après une réussite (la Fear Aura d'un diantrefosse). Le `against.casts` d'un modificateur de sauvegarde le restreint aux sauvegardes contre ce qui est lancé depuis ces catalogues, utilisation d'un objet qui lance depuis l'un d'eux comprise, puis à tout ce qu'il nomme d'autre : l'avantage de Holy Nimbus contre les sorts lancés par des fiélons ou des morts-vivants s'écrit `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`.

Plus de comportement imposé (Capability API 1.266). Un `behavior` peut porter `drops` `{slots?, tags?, at, pickUp?}` : son porteur laisse tomber chaque objet porté qui occupe l'un des `slots` ou porte l'un des `tags`, et chaque action de bloc de statistiques dont les `qualities` portent l'un des `tags`, soit quand l'état s'applique (`at: "applied"`, le "drops whatever it is holding" de Fear), soit au début de chacun des tours du porteur (`at: "turn-start"`, le "drop" de Command). Ce qui est tombé reste sur la case où il se tenait : aucune de ses actions n'est plus la sienne (refusées avec `dropped`), il ne donne plus rien de ce qu'il donnait une fois porté, et sa part de la défense du porteur disparaît (les 2 d'un bouclier). Le porteur le ramasse en se tenant sur cette case ou à côté, avec le ramassage gratuit du tour, ou pour le budget `pickUp` quand l'état en nomme un ; le journal affiche `letFall` et `pickedUp`. `onlyWhenStuck: "any"` rend entièrement libre un tour qui commence sans aucun endroit où l'état laisse son porteur se déplacer (le "unless there is nowhere to move" de Fear). `keepsOut` est une distance depuis celui qui a appliqué l'état : à l'intérieur, le porteur ne fait que s'éloigner, et il ne s'arrête qu'à l'extérieur tant qu'un endroit à l'extérieur est à sa portée (le "can't willingly move to a space within 30 feet of you" de Turn Undead). Une sauvegarde qui met fin à un état peut être `unseen: true`, lancée seulement tant que son porteur ne peut pas voir celui qui l'a appliqué (la sauvegarde de Fear hors de la ligne de vue). Les `applies` d'une entrée peuvent porter `destroysUpTo` `[{tier, when?}]` : une créature qui rate la sauvegarde et dont le palier de menace ne dépasse pas le plus haut `tier` dont le `when` est vérifié sur la fiche de l'utilisateur est plutôt détruite sur-le-champ (Destroy Undead, FP 1/2 pour un clerc de niveau 5 jusqu'à FP 4 au niveau 17) ; un personnage, ou une créature sans palier, ne l'est jamais.

Cibler par n'importe quel sens, des cibles proches les unes des autres, des zones qui grandissent, plus d'utilisations et des choses tenues (Capability API 1.267). Une entrée ou une action de créature qui `needs` des sens peut ajouter `needsAny: true` : une cible qui en garde un seul suffit, et seule une cible qui les a tous perdus est refusée (le "each undead that can see or hear you" de Turn Undead). `targetsWithin` est une distance dans laquelle chaque paire de cibles choisies doit se tenir, sinon elles sont refusées avec `targets-apart` (les créatures supplémentaires de Command à un emplacement supérieur, "within 30 feet of each other"). Une `area` peut porter `sizePerCostStep`, la distance dont sa taille grandit pour chaque cran dont son coût est augmenté (la sphère de Confusion qui grandit de 5 pieds par niveau d'emplacement) ; un mur ne grandit jamais. Un objet avec un `use` peut lister des `moreUses` `[{label, use}]` : chacune est une autre entrée de menu, nommée d'après l'objet et son `label`, qui puise dans les mêmes charges et tombe avec l'objet (une baguette de plusieurs sorts). Une créature peut lister des `held` `[{label, tags, defense?}]`, des choses qu'elle tient et qui ne sont pas une action propre (un bouclier imprimé dans son bloc) : un état dont les `drops` nomment l'un de leurs `tags` les fait tomber avec ses actions portant ce tag, leur `defense` disparaît de la sienne jusqu'à ce qu'elle les ramasse, et chacune se ramasse comme un objet tombé.

Regards, et auras selon qui elles atteignent (Capability API 1.268). Une aura peut porter `targetTypes`, lu comme celui d'une entrée : elle n'atteint que ceux qui correspondent (le Horrific Appearance d'une guenaude marine, humanoïdes seulement). `sourcesOf` nomme des états : elle n'atteint que quiconque a appliqué l'un d'eux à son porteur (le Barbed Hide d'un diable barbelé, qui blesse quiconque l'agrippe). Le `save` d'une aura peut porter `failedBy` `{atLeast, applies}` : un échec d'au moins cette marge applique ceux-ci à la place (le regard d'une méduse, qui pétrifie sur-le-champ sur un échec de 5 ou plus). Une sauvegarde `seen` peut porter `avert: true` : quiconque elle atteint peut, pendant son tour et sans frais, détourner les yeux de son porteur ; jusqu'à ce qu'il regarde de nouveau (également son libre choix), il saute cette sauvegarde et ne peut pas voir le porteur, si bien que ses attaques contre lui sont faites sans le voir ; le journal affiche `averted`, et le directeur garde détournés les yeux de ses créatures tant qu'il reste quelqu'un d'autre à combattre. Une sauvegarde qui met fin à un état peut porter `seenLean` (`"advantage"` ou `"disadvantage"`) : elle est lancée ainsi tant que son porteur peut voir celui qui a appliqué l'état (la sauvegarde répétée contre la guenaude marine, avec désavantage tant qu'elle est en vue).

Des bâtons qui lancent avec les nombres de leur porteur (Capability API 1.269). Le `use` d'un objet peut lire sa difficulté de sauvegarde sur la fiche de son porteur avec `sheetDifficulty`, une valeur lue comme `toHit.sheetBonus` en lit une (`{ "derived": "spell_save_dc" }`), à la place de `saveDifficulty` ; son bonus d'attaque se lit déjà de la même façon sur la fiche, avec `toHit.sheetBonus` (`{ "derived": "spell_attack" }`) et sans attributs. Une utilisation avec `charges` peut porter `chargeStep` `{max, amount?, targets?}` : son utilisateur peut dépenser jusqu'à `max` charges de plus, chacune étant un cran d'un coût supérieur, qui ajoute `amount` et `targets` comme un emplacement supérieur ajoute `perCostStep` et `targetsPerCostStep`, et fait grandir une zone avec `sizePerCostStep` (le sort d'un Staff of Power à un niveau supérieur, les 1d6 de force par charge d'un Staff of Striking). Le menu les propose comme des paiements nommés `charges:<how many more>`, seulement autant que l'objet en contient encore. La même version mineure porte à 320 le nombre d'états qu'un ensemble peut déclarer, et le `save` d'une aura peut porter `immuneWhenEnds: true` : une fois que ce qu'un échec a appliqué prend fin, quelle que soit la façon (une sauvegarde, son décompte, un remède), l'aura de ce porteur reste écartée de lui pour le reste du combat, comme `immuneOnSuccess` l'écarte après une sauvegarde réussie (le "is successful or the effect ends for it" d'une guenaude marine).

Un genre nommé au lancement (Capability API 1.270). Les `mechanics` d'une entrée de catalogue avec `applies` peuvent porter `kindChoice: true` : son utilisateur nomme l'un des `combat.creatureTypes` (un type ou un tag) en l'utilisant, proposé sous forme de modes `kind-<id>`, et ce qu'elle applique retient ce genre. L'aura de ce qu'elle a appliqué avec `chosenKind: true` n'atteint que les créatures de ce genre, et une aura avec `orSeen: true` atteint aussi quiconque peut voir son porteur, à quelque distance que ce soit : l'Antipathy de 5e applique donc à sa cible un état dont l'aura, `side: "all"`, effraie le genre choisi à 60 pieds ou moins ou en vue, et ses effrayés s'éloignent (`moves: "away"`), tandis que les charmés de Sympathy s'approchent. Le `saveEnds` d'un état peut porter `beyond`, dans la distance de l'ensemble : sa sauvegarde n'est lancée que tant que son porteur se tient plus loin que cela de celui qui l'a appliqué et, avec `unseen`, aussi hors de sa vue (le "not within 60 feet of the target or able to see it" d'Antipathy).

Plus de ce que font les bâtons et les anneaux (Capability API 1.271). Le `use` d'un objet peut porter `label`, affiché à côté du nom de l'objet comme le libellé d'une entrée `moreUses` ("Staff of Fire: Burning Hands") ; une utilisation supplémentaire est nommée par son propre `label`. Une utilisation peut porter `amountAdd`, une valeur lue sur la fiche de son porteur et ajoutée à sa quantité, comme celle d'une entrée de catalogue (le Cure Wounds d'un Staff of Healing, `{ "abilityModFromField": "spellcasting_ability" }`), en combat comme hors combat. Un `chargeStep` peut porter `push`, dans la distance de l'ensemble : chaque charge de plus pousse sa cible d'autant plus loin, en plus du `push` propre à l'utilisation (les 5 pieds par charge d'un Ring of the Ram). Le `charges.breaksOn` d'un objet peut porter `regains` `{atLeast, amount}` : quand sa dernière charge est dépensée et que son dé montre `atLeast` ou plus, l'objet récupère plutôt `amount` charges (les 1d12 + 1 d'un Staff of the Magi sur un 20), en combat, hors combat et quand l'inventaire dépense une charge ; `atMost` peut alors être omis pour un objet qui ne se brise jamais.

Un objet qui en devient un autre (Capability API 1.272). Le `charges.breaksOn` d'un objet peut porter `becomes`, un autre objet de l'ensemble sous la forme `<catalog>/<entry>`, à côté de `atMost` : sur les faces qui le briseraient, l'objet devient plutôt celui-là (le bâton non magique d'un Staff of Striking, ou un Staff of Power qui ne garde que son +2, écrit comme un objet qui n'a que cela). En combat, ses utilisations disparaissent et il frappe désormais comme le nouvel objet, et le combat réécrit la pile comme cet objet, sous son nom et sans charges ; hors combat et quand l'inventaire dépense une charge, la pile change de la même façon. L'objet nommé doit être un autre objet de l'ensemble, dans quelque fichier de catalogue qu'il se trouve.

Des charges dépensées sur un coup réussi (Capability API 1.273). Le `attack.spends` d'une arme liste jusqu'à quatre façons dont son porteur peut dépenser les charges de l'objet une fois qu'un coup porté avec elle a touché : chacune a un `label`, les `charges` qu'elle coûte, un `amount` de dés et une part fixe ajoutés au coup avec leur propre `type` de dégâts (celui de l'arme si elle n'en nomme aucun) et, en option, `blow` (seulement un coup `melee` ou `ranged`), `chargeStep` (`max` charges de plus, chacune ajoutant à nouveau son `amount` : les 1d6 de force par charge d'un Staff of Striking, jusqu'à trois) et `onHit` (jusqu'à deux états que reçoit celui qui est touché, chacun avec `rounds`, un `save` qui l'écarte, ou `saveEnds` : la sauvegarde de Constitution d'un Staff of Withering). En combat, chacune est proposée au porteur lors de son propre coup réussi avec cette arme, et d'aucune autre, après que celui qui est touché a répondu ; ses dés sont lancés avec le coup et doublés par son critique, et le dé de dernière charge de l'objet est lancé comme pour une utilisation. L'objet contient des charges.

Des nombres fixés d'après celui qui a appliqué un état (Capability API 1.274). Un état qu'une entrée `applies` peut porter une `value`, une référence de valeur lue sur la fiche de celui qui l'applique au moment où il s'applique (le `{ "abilityModFromField": "spellcasting_ability" }` de Heroism), et le `temporary` d'un état de combat donne à son porteur des points temporaires au début ou à la fin de chacun de ses tours (`at`) : `dice` et `flat`, plus cette valeur avec `value: true`, et avec `lostWhenEnds` ce qu'il en reste disparaît quand l'état prend fin, sauf si le porteur en a davantage, grâce à autre chose, que ce que l'état a donné. Le `save.appliedDifficulty` d'une aura lance sa sauvegarde contre la difficulté de sauvegarde de ce qui a appliqué l'état de l'aura à son porteur, fixée au moment de l'application (le DD de sauvegarde des sorts du lanceur d'Antipathy/Sympathy) ; sa `difficulty` reste pour une aura que rien n'a appliquée. Une sauvegarde qui met fin à un état `at: "damaged"` peut indiquer `bySource` : lancée seulement sur une blessure venant de celui qui a appliqué l'état (la sauvegarde de Sympathy quand la cible blesse son porteur). Le `behavior.keepsIn` d'un état empêche son porteur, une fois à cette distance ou moins de celui qui l'a appliqué, de jamais s'en éloigner davantage (le "can't willingly move away" de Sympathy). Et le `use` d'un objet peut porter `kindChoice` comme les mécaniques d'une entrée (1.270) : un parchemin d'Antipathy/Sympathy nomme ainsi son genre à l'utilisation.

Des états tenus en suspens plutôt que terminés (Capability API 1.275). À côté de `whileSourceInSight`, le `orSourceWithin` d'un état de combat (une distance dans les unités propres de l'ensemble) le maintient actif tant que son porteur se tient aussi près de celui qui l'a appliqué, qu'il le voie ou non : hors de vue et hors de portée, il est tenu en suspens, toujours sur son porteur avec son décompte qui court, et il redevient actif dès que l'une des deux conditions est remplie (la frayeur d'Antipathy, à 60 pieds ou moins ou en vue). Le `suppresses` d'un état de combat liste d'autres états qu'il tient en suspens tant qu'il est actif : leurs effets s'arrêtent, ils restent en place et redeviennent actifs une fois qu'il prend fin (le charme et la frayeur de Calm Emotions, ceux de Mindless Rage).

Téléportations (Capability API 1.276). Le `mechanics.teleport` d'une entrée de catalogue, le `use.teleport` d'un objet ou le `teleport` d'une action de créature déplace aussitôt son utilisateur vers une place libre à `distance` ou moins (dans les unités propres de l'ensemble) : aucun pas entre les deux, donc personne ne le frappe quand il part, et une zone où il atterrit le prend comme s'il y était entré en marchant. Seulement sur un plateau, donc il nécessite `combat.distance` ; hors plateau, une action qui ne fait que téléporter n'est pas proposée. Avec `seen`, seulement vers une place que son utilisateur voit maintenant (un mur, un brouillard ou une cécité qui prive des yeux retirent de la liste les cases situées derrière) : le Misty Step de 5e, `{ "distance": 30, "seen": true }`. `carries` (de 1 à 8) emmène autant de créatures consentantes du camp de son utilisateur, pas plus grandes que lui, situées à `carriesWithin` ou moins (au contact s'il est omis), et chacune atterrit aussi près de son utilisateur que la place le permet : Dimension Door, `{ "distance": 500, "carries": 1, "carriesWithin": 5 }`. Une action de créature avec téléportation s'applique à la créature elle-même (le Teleport d'un chien esquiveur). L'option liste les cases où il peut aller sous `teleport.cells`, et qui peut l'accompagner sous `teleport.carries` ; un choix nomme la case sous `at` et ses compagnons sous `carries`. Une téléportation n'est jamais une zone ni une réaction.

Six états à la fois, et une vue qui voit vraiment (Capability API 1.277). `applies` contient jusqu'à 6 entrées sur les mécaniques d'une entrée de catalogue, l'utilisation d'un objet et une action de créature (4 avant) : Rage et Frenzy ajoutent chacun l'état de Mindless Rage à côté de leurs quatre. Et `whileSourceInSight` (avec `orSourceWithin` à côté) lit désormais la vue propre du porteur, comme le fait le `orSeen` d'une aura : une ligne dégagée sur le plateau reste nécessaire et, en plus, le porteur doit voir sa source avec ses yeux ou ses sens ; une cécité qui prive des yeux, un brouillard qui masque, l'obscurité au-delà de ce qu'il voit, ou une source invisible pour lui, tout cela la rompt comme un mur.

Calm Emotions (Capability API 1.278). Une sauvegarde peut indiquer `alliesMayFail: true` (sur le `save` d'une entrée de catalogue, de l'utilisation d'un objet ou d'une action de créature) : une cible du camp de son utilisateur la laisse passer et échoue sans lancer, et le journal le dit, tandis que tous les autres lancent normalement. Les `effects` d'un état peuvent porter `cannot-target-source-side` : son porteur ne pointe rien sur celui qui le lui a appliqué ni sur quiconque de son camp, sauf si ce camp est celui du porteur (il n'écarte alors personne). `endsWhen` accepte deux fins de plus à côté de `damaged` et `harmed-by-source-side`, jusqu'à les quatre : `attacked`, un jet d'attaque fait contre son porteur par quiconque, réussi ou raté (une action qui touche sans jet n'en est pas un), et `ally-harmed-in-sight`, des dégâts infligés à quiconque d'autre du camp de son porteur et que celui-ci voit (une ligne dégagée sur le plateau et ses propres yeux ou sens). Et `endsWhenHarmedFrom` liste des catalogues : une blessure infligée à son porteur par quoi que ce soit lancé depuis l'un d'eux, par quiconque, sort de parchemin et zone en place compris, y met fin ; une blessure, ce sont des dégâts, ou le fait d'être la cible d'une action nuisible, comme pour `harmed-by-source-side`, et relancer ce même état le rafraîchit au lieu d'y mettre fin. Chacune de ces fins attend que l'étape qui l'a causée soit terminée. Et un état que l'état actif propre du porteur `suppresses` n'est plus terminé par une immunité que donne ce même état : il est suspendu, pas guéri, si bien qu'une frayeur déjà présente quand commence une rage immunisée contre la frayeur revient quand la rage prend fin (le Mindless Rage de 5e), tandis que de nouvelles frayeurs ne peuvent toujours pas s'appliquer.

Téléportations hors du combat, passagers visibles et fumée (Capability API 1.279). Un `teleport` (sur une entrée de catalogue, l'utilisation d'un objet ou une action de créature) accepte trois clés de plus. `leaves: true` : il peut emmener son utilisateur entièrement hors du combat, le mile d'une licorne, au lieu de le mener à une case ; le choix ne nomme alors aucun `at` (le menu affiche un bouton "Leave the fight"), et son utilisateur et ceux qui l'accompagnent disparaissent vivants (affichés comme "Left the fight", leur santé conservée, et rien ne les ramène). Hors plateau, partir est la seule destination, et toute personne debout du camp de son utilisateur peut l'accompagner, puisque rien ne mesure qui se tient près. Une équipe dont plus personne ne combat, et dont l'un des membres est parti ainsi, a fui (le résultat `fled`, qui termine le combat comme une fuite) ; un ennemi parti ainsi n'est ni battu ni encore debout, mais il s'est échappé, et le récapitulatif le dit. Les propres créatures du directeur partent à un quart de leur santé ou moins, en emmenant qui elles peuvent. `carriesSeen: true` (avec `carries`) : seuls ceux que son utilisateur voit peuvent l'accompagner, les "willing creatures it can see" d'une licorne. Et `smoke` (`{}`, ou `{ "pierced": [senses] }`) : un nuage se forme sur les cases que son utilisateur a quittées et sur celles où il atterrit, et masque comme le `obscures` d'une zone, dès l'atterrissage et jusqu'à la fin du prochain tour de son utilisateur : la fumée de la Cape of the Mountebank.

Une téléportation qui frappe (Capability API 1.280). La téléportation d'une créature peut nommer l'une de ses propres actions comme `strike` (son `id`) : le "Before or after teleporting, the dog can make one bite attack." d'un chien esquiveur. Se téléporter permet alors à cette action de suivre une fois ce tour-ci sans frais (le menu indique "Free, part of the same action"), et le menu la propose aussi dans l'autre sens, comme "Bite, then Teleport" sur le budget de la téléportation, après quoi la téléportation suit une fois sans frais. Aucune des deux ne mène à une troisième. La frappe faite en premier dépense les utilisations et la recharge de la téléportation en plus des siennes, et n'est proposée que tant qu'il reste les deux. La frappe est une autre action simple de la même créature : ni la téléportation elle-même, ni une séquence, ni une autre téléportation, ni une réaction, ni quelque chose acheté avec des points. Seule la téléportation d'une créature en nomme une ; celle d'une entrée de catalogue ou de l'utilisation d'un objet est refusée. Dans un combat qui ne mesure aucune distance, une téléportation ne mène nulle part : rien n'est donc associé. Le directeur s'en sert aussi : une créature trop loin pour rejoindre sa proie à pied se téléporte à côté d'elle et mord dans le même tour.

Coups qui drainent (Capability API 1.281). Les `mechanics` d'une entrée de catalogue ou l'action d'une créature peuvent porter `drain` : son utilisateur récupère une santé égale aux dégâts que le coup a infligés à chaque cible, après résistances, arrondie vers le bas et jamais au-dessus de son maximum, et rien n'est retiré du maximum de la cible (pour cela, voir `reducesMax`). `share` (supérieur à 0, jusqu'à 1, la totalité s'il est omis) est la part qui revient, et `damageType` ne compte que les dégâts de ce type : le Psychic Drain d'un aboleth s'écrit `drain: {}`, Vampiric Touch `drain: { "share": 0.5, "damageType": "necrotic" }`. Ce qui empêche de guérir empêche aussi cela. Un drain a besoin de dégâts à rendre : il est donc refusé sur une entrée sans `amount`, sur un soin, ou sur une action de créature sans `damage`.

Des explosions centrées sur leur utilisateur (Capability API 1.282). Une `area` (d'une entrée de catalogue ou d'une action de créature) peut indiquer `around: true` : une explosion de `size` centrée sur son utilisateur et jamais visée. Tous ceux qui se trouvent à `size` ou moins de l'utilisateur sont pris quand elle est utilisée, amis comme ennemis sauf si `friendlyFire` vaut false (une explosion qui soigne ne prend que le camp de son utilisateur), et jamais l'utilisateur. Un mur entre eux protège une créature, sauf si la zone indique aussi `throughWalls: true` : le Channel Negative Energy d'un seigneur momie, "including ones behind barriers and around corners". Dans un combat sans plateau, elle prend tout le monde. Elle n'est pointée sur personne : elle fonctionne donc comme une action distinctive achetée entre deux tours aussi bien que pendant un tour. Seule une explosion unique est centrée sur son utilisateur (pas de `copies`), `throughWalls` ne va qu'avec `around`, et l'explosion d'une entrée autour de son utilisateur s'applique aussitôt, sans laisser de `zone`. Channel Negative Energy est une action de créature avec `signature: { "cost": 2 }`, `area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }` et qui `applies` un état avec l'effet `cannot-heal` pour `{ "rounds": 1, "of": "source" }`, jusqu'à la fin du prochain tour du seigneur momie. Le directeur en évalue une selon ceux qu'elle prend, comme il évalue une forme visée.

Mouvements légendaires (Capability API 1.283). Une action de créature avec un coût `signature` peut indiquer `move` et rien d'autre à faire : son auteur se déplace entre deux tours, en choisissant une case sur le plateau comme pour un déplacement pendant son propre tour, avec un crédit de mouvement prêté pour ce seul déplacement, si bien que le mouvement de son propre tour reste intact. `move: { "share": 0.5 }` est une part de sa vitesse (une tarasque "moves up to half its speed"), `move: { "distance": 60 }` une distance dans l'unité propre de l'ensemble, et `move: {}` toute sa vitesse ; jamais `share` et `distance` ensemble. On le frappe quand il quitte l'allonge de quelqu'un, comme pour tout déplacement, et la fenêtre dans laquelle il a été acheté est de nouveau sollicitée une fois la frappe portée. `noOpportunity: true` ne provoque personne (un vampire "moves up to its speed without provoking opportunity attacks"). `untouchable: true` est un déplacement que rien ne peut blesser ni retenir (le Whirlwind of Sand d'un seigneur momie, `{ "distance": 60, "untouchable": true }`) : ce qui immobilise son auteur le lâche d'abord, personne ne le frappe, et aucune zone ni aucun terrain qu'il traverse ne lui fait quoi que ce soit. Une créature immobilisée, ou sans vitesse, n'a nulle part où aller avec tout autre déplacement. Rien n'est proposé hors plateau. Le directeur en achète un comme il achète une téléportation : pour se dégager d'un ennemi à côté de lui quand il est gravement blessé, ou pour se rapprocher d'un ennemi quand aucun n'est à portée.

Lancements légendaires (Capability API 1.284). Une action de créature avec un coût `signature` peut indiquer `casting` et rien d'autre à faire : entre deux tours, elle propose chaque sort que son auteur pourrait lancer pendant son propre tour avec le `budget` de l'action, tiré de son `spellcasting` ou des sorts de sa fiche, nommé "Cast a Spell: Fireball" et ainsi de suite. Chacun est visé, payé et résolu exactement comme pendant le tour de la créature (cibles, une case pour une zone, un emplacement ou une utilisation dépensés comme toujours), et les points sont dépensés à la place du budget : son propre tour garde donc tous ses budgets. `casting: { "cantripsOnly": true }` ne propose que les sorts mineurs (des sorts payés sur aucune réserve) : le Cantrip d'une liche, `signature: { "cost": 1 }`. Le Cast a Spell d'un sphinx s'écrit `casting: {}` avec `signature: { "cost": 3 }`. Tout ce que le sort ouvre (un Counterspell, une réaction au fait d'en être blessé) reçoit une réponse comme pendant un tour, et la fenêtre dans laquelle il a été acheté est de nouveau sollicitée une fois que tout cela s'est refermé. Le directeur en achète un quand le sort vaut les points, comme il évalue toute autre action distinctive.

Se déplacer après l'action, et sur une seule vitesse (Capability API 1.285). Une action distinctive qui fait quelque chose (des dégâts, une zone, une sauvegarde, un état) peut aussi porter un `move` : ce qu'elle fait s'applique d'abord, puis son auteur peut se déplacer vers une case que le menu a proposée, choisie avec l'action ; n'en choisir aucune est aussi un choix, et une case qu'il ne peut plus atteindre après ce qu'il a fait n'est simplement pas parcourue. Un `move` peut aussi nommer une façon de se déplacer avec `speed` (`walk`, `fly`, `swim`, `climb` ou `burrow`) : son `share` se lit sur cette seule vitesse, il ne se déplace que de cette façon, et une créature sans cette vitesse n'a nulle part où aller. La Wing Attack d'un dragon est son explosion autour de lui (`area: { "shape": "burst", "size": 10, "around": true }`, sa sauvegarde et son renversement) avec `move: { "share": 0.5, "speed": "fly" }` : "The dragon can then fly up to half its flying speed." Un `move` ne porte toujours ni `teleport`, ni `sequence`, ni `reaction`, ni `charge`. Le directeur s'envole après la bourrasque quand il est gravement blessé à côté d'un ennemi, ou se rapproche d'un ennemi hors de sa portée.

L'obscurcissement léger et le vent (Capability API 1.286). Le `obscures` d'une zone, ou le `smoke` d'une téléportation, peut indiquer `light: true` : il ne cache alors personne et ne fait qu'obscurcir légèrement quiconque est vu à travers ou s'y trouve, comme la faible lumière de 5e ou la fumée d'une Cape of the Mountebank (le moteur sait qui est vu ainsi ; Hide et Perception le lisent). Il peut aussi indiquer `dispersed: true` : une zone dont la règle indique `disperses: true` y met alors fin partout où les deux se rencontrent, après chaque action, ainsi qu'à la concentration qui la maintient. Le Fog Cloud de 5e s'écrit `obscures: { "dispersed": true }`, son Gust of Wind est une zone avec `disperses: true` ; Darkness n'indique ni l'un ni l'autre : le vent la laisse donc en place. Une zone qui ne fait que disperser n'a besoin d'aucun déclencheur.

Se cacher, Search et Detect (Capability API 1.287). `combat.hiding` rend réelle l'action standard `hide` : `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` nomme deux des `combat.checks` et, en option, `passive` (10), `lightly` (5) et les `combat.components` qui font du bruit. Hide lance `stealth` sur les dés propres du combat ; son utilisateur est alors caché de chaque adversaire qui ne le voit pas clairement (derrière un mur, dans un brouillard, invisible, ou ne le voyant que légèrement obscurci) et dont la Perception passive, `passive` plus son test `perception`, moins `lightly` quand il ne le voit que légèrement obscurci, est atteinte par le total. Un adversaire dont il est caché ne le voit pas : il ne peut donc rien pointer sur lui, celui qui est caché l'attaque comme quelqu'un qu'on ne voit pas, et `combat.sight.unseenAttacks` donne l'avantage à cette attaque. La cachette dure d'un tour à l'autre et prend fin : pour tout le monde, dès que son utilisateur attaque, fait une confrontation, blesse quelqu'un ou demande une sauvegarde, ou utilise quoi que ce soit qui nécessite une composante `noisy` (un sort sans composante verbale, ou un brouillard posé, le laisse caché) ; et pour chaque adversaire qui finit par le voir clairement ou dont la valeur passive bat désormais le total, après chaque étape et sur chaque case d'un déplacement. L'action standard `search` (ajoute-la à `combat.standard` ; elle nécessite `combat.hiding`) lance `perception` et trouve, pour celui qui cherche, tous ceux qui se cachent de lui et dont il atteint le total. Une action de créature avec `search: true` fait de même et rien d'autre : un Detect légendaire s'écrit `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`. Une créature lit les deux tests sur ses propres `checks`. Le directeur cherche quand chacun de ses adversaires lui est caché, et utilise un Detect entre deux tours quand l'un d'eux l'est. Hors plateau, personne ne peut être caché autrement que par un état qui le cache déjà.

Ready (Capability API 1.288). `combat.readying: { "budget": "reaction" }` rend réelle l'action Ready : pour chaque option que son utilisateur pourrait prendre maintenant avec son budget `standard` (une attaque, un sort, une action de créature) et pour un déplacement, le menu propose deux entrées, préparées pour le moment où un adversaire arrive à portée (`comes`) ou celui où il agit (`acts`). En prendre une dépense le budget standard et met cette option en attente jusqu'au début du prochain tour de son utilisateur. Quand le déplacement d'un adversaire l'amène, à n'importe quel pas, là où l'option en attente pourrait être pointée sur lui (et que son détenteur le voit), ou qu'un adversaire termine quoi que ce soit qu'il fait là, une fenêtre sollicite le détenteur, qui prend l'option appelée `readied` avec `budget` (la réaction de 5e) ou la laisse passer, et n'est plus sollicité sur ce déplacement. Un déplacement en attente va aussi loin que porte toute la vitesse de son détenteur, et quitter une allonge en chemin provoque des attaques d'opportunité comme tout déplacement. Avec `"concentrates": true` (cela nécessite `combat.concentration`), un sort est payé au moment où il est préparé et maintenu par concentration : quand il se déclenche, il n'est pas payé à nouveau, perdre la concentration le fait perdre, et un sort qui ne se déclenche jamais reste dépensé. Préparer autre chose ne paie rien jusqu'au déclenchement. Celui de 5e s'écrit `{ "budget": "reaction", "concentrates": true }`.

Dispersion lente (Capability API 1.289). Le `dispersed` d'un brouillard peut être `{ "after": N }` au lieu de `true` : un vent qui l'atteint n'y met alors fin qu'une fois qu'il a soufflé dessus pendant N rondes complètes d'affilée, comptées depuis le tour où il l'a atteint pour la première fois. Un vent qui cesse de l'atteindre avant, parce qu'il a été déplacé, a pris fin ou a disparu, remet le compte à zéro quand un vent l'atteint de nouveau. Le Stinking Cloud de 5e, qu'un vent fort comme Gust of Wind disperse après 1 ronde, s'écrit `"obscures": { "dispersed": { "after": 1 } }`.

La recherche des cachés, pondérée (Capability API 1.290). Un test du combat lu sur une compétence (`{ "skillMod": "stealth" }`) compte désormais comme le test de cette compétence lors de son jet : une modification restreinte à elle par `skills` s'applique donc à Hide, à Search et aux confrontations : le désavantage de l'armure lourde sur Stealth, le +10 de Pass without Trace, l'avantage des Eyes of the Eagle sur Perception. `combat.hiding.passiveMode` (5 en 5e) s'ajoute à une Perception passive qui a l'avantage et se retire d'une Perception passive qui a le désavantage ; sans lui, une valeur passive ne lit aucun mode. Une modification `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` applique ce mode aux tests faits pour trouver son porteur, à la fois la valeur passive d'un adversaire et son Search ; elle prend un `mode` et rien d'autre. C'est le Cloak of Elvenkind de 5e. Quand un Search découvre que quelqu'un modifie pour lui la façon dont il est lancé, il est relancé pour lui seul, et le journal affiche aussi ce jet.

Les propres façons qu'a une créature de se cacher et de chercher (Capability API 1.291). Une action de créature peut être une permission, `"standard": { "actions": ["disengage", "hide"] }` : ces actions standard (de `combat.standard`) prises avec le budget propre de cette action, comme le Nimble Escape du gobelin de 5e avec l'action bonus. Avec `"while": "obscured"`, elle ne vaut que tant que la créature se tient dans un brouillard ou une brume, ou dans un combat livré dans une faible lumière ou dans l'obscurité : le Shadow Stealth de l'ombre. Les `checkModes` d'une créature font lancer deux fois ses propres tests avec certaines compétences : `{ "skills": ["perception"], "mode": "advantage", "sight": true }` seulement tant qu'elle voit (Keen Sight), avec `"light": ["sunlight"]` seulement sous cette lumière (Sunlight Sensitivity, avec `"mode": "disadvantage"`), et avec `"terrain": ["snow"]` seulement sur une tuile du plateau ou dans un type de lieu qu'elle nomme (Snow Camouflage ; les lieux sont ceux du générateur tactique : neige, grotte, montagnes, eau et les autres). Le `passive` d'une créature est sa Perception passive imprimée, utilisée à la place de `hiding.passive` plus son test (cela nécessite `combat.hiding`). La lumière dans laquelle se livre un combat vient de l'heure de la scène : la lumière du soleil le jour en extérieur, une faible lumière à l'aube et au crépuscule, l'obscurité la nuit, et une vive lumière qui n'est pas celle du soleil en intérieur ou quand l'heure n'indique rien que le moteur sache lire. La lumière n'affecte que ce qui la lit (ces modes, et `while: "obscured"`). Sans `combat.sight.darkness` (1.294), elle ne change pas qui peut voir qui.

Les propres façons de se cacher et de trouver ce qui est caché (Capability API 1.292). Le `mechanics.hiding` d'une entrée de catalogue (de n'importe quel type, `utility` compris) et le `hiding` d'une créature sont des permissions lues là où `combat.hiding` cache réellement. `"behindLarger": true` permet à son porteur de se cacher derrière quelqu'un d'au moins une taille de plus qui se tient entre lui et celui qui regarde, sur chaque ligne entre eux (le Naturally Stealthy d'un halfelin ; nécessite `combat.sizes`). `"still": 10` ajoute autant à son total de Stealth quand il se cache, retiré dès qu'il se déplace ou fait une action (le Hide in Plain Sight d'un rôdeur). `"slow": "advantage"` lance son Hide avec avantage quand il ne s'est pas déplacé de plus de la moitié de sa vitesse ce tour-ci (le Supreme Sneak d'un voleur). `"aware": { "within": 10, "lostWith": ["deafened"] }` signifie que personne à cette distance ou moins, dans l'unité propre de l'ensemble, ne lui est caché, sauf s'il a l'un de ces états (le Blindsense d'un roublard). Le `"starts": 15` d'une créature la fait commencer le combat cachée à la vue de tous avec ce total, aux yeux de quiconque dont la Perception passive ne le bat pas, qu'il la voie clairement ou non, jusqu'à ce qu'elle se déplace, et elle se cache de nouveau ainsi avec l'action Hide (le Transparent d'un cube gélatineux).

Les propres jets d'attaque d'une créature lancés deux fois (Capability API 1.293). Les `attackModes` d'une créature s'appliquent là où ses `checkModes` s'appliqueraient : `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` est le Sunlight Sensitivity de 5e, un désavantage sur ses attaques tant qu'elle voit et que le combat se livre à la lumière du soleil. Chaque mode indique où il s'applique, avec `sight`, `light` ou `terrain`. Le mode s'ajoute à tous les autres avantages et désavantages du jet : les deux s'annulent donc toujours.

L'obscurité (Capability API 1.294). Avec `combat.sight.darkness`, la lumière dans laquelle se livre un combat empêche les yeux de voir : `{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`. Personne dans l'obscurité n'est vu, et personne dans une faible lumière n'est vu clairement, sauf par un sens de `seeIn` à portée, qui voit l'obscurité comme une faible lumière et la faible lumière comme une vive lumière, ou par un sens `blind` ou l'un de ceux de `pierced` à portée, qui voient quelle que soit la lumière. Ce qui éclaire l'obscurité : `carried`, la lumière que porte toute personne combattant avec une fiche, sauf si un sens de `seeIn` lui suffit (une torche) ; `light` sur un état (le sort mineur Light), sur l'effet `worn` ou `carried` d'un objet (une lanterne), ou sur une créature (des bandits avec des torches, un élémentaire de feu). Chacun s'écrit `{ "bright": N, "dim": N }` dans la distance propre de l'ensemble : une vive lumière jusqu'à cette distance, une faible lumière sur la même distance au-delà. Les murs arrêtent la lumière, et quelqu'un qui est abattu n'en répand aucune. Là où l'obscurité est réelle, tout ce qui lit la lumière la lit là où quelqu'un se tient : qui voit qui (attaques contre ceux qu'on ne voit pas, cachette, une créature que tu peux voir), le fait de se tenir dans une zone obscurcie (`while: "obscured"`), et les `checkModes` et `attackModes` d'une créature. Un combat dans une grotte ou un donjon se livre dans l'obscurité à toute heure.

Éteindre une lumière et la rallumer (Capability API 1.295). Quiconque porte la lumière `carried` a dans son menu une option pour l'allumer et l'éteindre, nommée par son `label` (`"Torch"` ; "Light" s'il n'en indique aucun). Elle coûte son `budget` quand il en nomme un, et elle est sinon gratuite une fois par tour. Une lumière éteinte ne répand rien : son porteur peut donc passer inaperçu dans l'obscurité ; rallumée, il est vu, et découvert s'il se cachait. Un objet avec un `toggle` ne répand la `light` de son effet que tant qu'il est allumé, comme une lanterne à capote.

Des lumières allumées et éteintes par des créatures et des objets (Capability API 1.296). Une action de créature avec `"sheds": { "bright": 10, "dim": 10 }` fixe la lumière que son utilisateur répand dès lors, et `"sheds": "out"` l'éteint. Elle ne fait rien d'autre et ne vise personne : l'Ignited Illumination du magmin, ce sont deux actions de ce genre sur son action bonus, et la Variable Illumination d'un feu follet est une action pour chaque portée. Une créature avec `"unlit": true` commence le combat avec sa `light` éteinte, et il lui faut l'une de ses actions pour l'allumer. Le `toggle.offLight` d'un objet est la lumière qu'il répand quand il est éteint, à la place de celle de son effet : une lanterne à capote dont la capote est baissée répand `{ "bright": 0, "dim": 5 }`. Une lumière sans portée de vive lumière ne répand qu'une faible lumière, même là où elle est tenue.

La lumière des zones, et une lumière qui met fin à l'obscurité ou montre l'invisible (Capability API 1.297). Les `lights` d'une zone de sort (en pieds, comme toute `light`) répandent de la lumière sur les seules cases de la zone, mesurée depuis son centre : le point où une explosion est lancée, ou son lanceur pour une zone maintenue par celui-ci ; une lanterne sourde est ainsi un cône de 60 pieds ancré sur son lanceur avec `"lights": { "bright": 60, "dim": 60 }`, qui n'éclaire rien derrière lui. Dancing Lights est une zone ponctuelle mobile avec `{ "bright": 0, "dim": 10 }`. Une zone qui masque avec `"obscures": { "darkness": true }` est une obscurité magique, et une zone avec `"dispelsDark": { "upTo": 3 }` met fin à toute obscurité de ce genre que ses cases rencontrent et dont l'emplacement était de ce niveau ou inférieur, quand l'une ou l'autre est lancée : Daylight. Une lumière avec `"reveals": true`, sur une zone, un effet d'objet, un état ou une créature, montre toute personne rendue invisible par un état qui se tient dans sa vive lumière : une lanterne de révélation. Chacun de ces éléments nécessite Capability API 1.297.

Une lumière cachée sous un état, et la lumière du soleil (Capability API 1.298). Le `"lightOutWhile": ["invisible"]` d'une créature éteint sa propre lumière, quoi que ses actions aient réglé en dernier, tant que l'un de ces états la touche, et la rallume quand l'état prend fin : l'Invisibility d'un feu follet cache aussi sa lumière. Une lumière avec `"sunlight": true`, sur une créature, un effet d'objet, un état ou une zone, fait de sa vive lumière une lumière du soleil, ce que lit `"light": ["sunlight"]` dans un mode de test ou d'attaque : une lame solaire contre Sunlight Sensitivity. Sa lumière du soleil compte aussi sur un plateau déjà vivement éclairé.

L'obscurité magique contre la lumière (Capability API 1.299). Une zone d'obscurité magique (`"obscures": { "darkness": true }`) avec `"dispelsLight": { "upTo": 2 }` éteint la lumière créée par un sort de ce niveau ou inférieur, partout où les deux se rencontrent et quel que soit celui qui est arrivé en premier : les `lights` d'une zone, ou la `light` d'un état appliquée par un sort, qui prend fin avec la concentration du sort quand elle la maintient (le Darkness de 5e sur Flame Blade). Seule une lumière magique éclaire les cases d'une obscurité magique, quelle que soit la lumière du combat : la lumière d'un sort sur une zone ou un état l'est toujours, et toute autre lumière l'est quand elle indique `"magical": true` (celle d'une lame solaire) ; une torche dans l'obscurité n'y éclaire rien. Un `dispelsDark` avec `"within": 60` ne met fin qu'à l'obscurité aussi proche de son centre : la sphère de vive lumière de Daylight, pas sa faible lumière au-delà. Chacun de ces éléments nécessite Capability API 1.299.

Le supplément d'un coût supérieur seulement tous les tant de crans (Capability API 1.300). `"perCostStepsEvery": 2` ajoute `perCostStep` une fois tous les deux crans d'un coût supérieur plutôt qu'à chaque cran. Une action qu'un état donne (1.236) grandit désormais selon le coût auquel a été payé le sort qui a appliqué l'état, avec ses propres `perCostStep`, `perCostStepsEvery` et `perCostStepsMax` : la frappe de Flame Blade en 5e, c'est `3d6` avec `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`, si bien qu'une lame appelée avec un emplacement de niveau 4 frappe pour 4d6. Utiliser `perCostStepsEvery` nécessite Capability API 1.300.

Des zones portées avec quelqu'un, et des copies posées à distance (Capability API 1.301). Le `"carried": "any"` d'une zone fait qu'une explosion posée sur une case où se tient quelqu'un le suit partout, centrée sur lui : le Darkness ou le Daylight de 5e sur un objet qu'il tient. Avec `"own"`, seule une case où se tient son lanceur compte, pour un sort qui ne peut être lancé que sur un objet tenu par son lanceur. Posée sur une case vide, elle y reste. Une zone portée est une explosion unique en un point et ne se déplace jamais d'elle-même. Le `"copiesWithin": 20` d'une zone pose ses `copies` avec le centre de chacune à 20 pieds ou moins de celui d'une autre, plutôt qu'en contact, et une zone de copies que son lanceur peut `move` les déplace toutes de la même façon : le Dancing Lights de 5e est une explosion de 10 pieds avec `"copies": 4, "copiesWithin": 20` et `"lights": { "bright": 0, "dim": 10 }`. Chacun nécessite Capability API 1.301.

Des entrées qui en modifient une autre (Capability API 1.302). Une entrée tenue dans une liste de la fiche avec `"amends": [{ "entry": "spells/eldritch-blast", ... }]` modifie cette entrée de son porteur chaque fois qu'il l'utilise, et plusieurs se cumulent. `"damageAdd"` (une valeur, comme `{ "abilityMod": "cha" }`) s'ajoute à ses dégâts à chaque coup réussi : Agonizing Blast. `"range"` (dans la distance de l'ensemble) est sa portée quand elle est plus longue : les 300 pieds d'Eldritch Spear. `"push"` pousse quiconque elle touche d'autant en ligne droite, et `"pushOptional": true` la propose aussi comme "Eldritch Blast (no push)" : Repelling Blast. Une portée ou une poussée nécessite `combat.distance`, et l'entrée nommée doit exister. Nécessite Capability API 1.302.

Des utilisations seulement dans certaines lumières, et des états auxquels le déplacement ou l'action met fin (Capability API 1.303). Une entrée avec `"usableIn": { "light": ["dark", "dim"] }` n'est proposée que tant que son utilisateur se tient dans l'une de ces lumières : One with Shadows. Le `endsWhenHolder` d'un état peut aussi indiquer `"moves": true` (il prend fin quand son porteur se déplace) ou `"acts": true` (il prend fin quand son porteur fait une action, attaque ou lance un sort), à côté de `attacks` et `casts` : les ombres cachent un occultiste qui reste immobile. Nécessite Capability API 1.303.

Une fois par créature jusqu'à un repos (Capability API 1.304). Une entrée avec `"oncePerTarget": { "until": "long" }` (un repos que l'ensemble déclare) n'est pas proposée contre une créature sur laquelle elle a déjà été utilisée tant que son utilisateur n'a pas pris ce repos, quel que soit le nombre de combats entre-temps : Chains of Carceri. Les créatures visées sont gardées par leur nom sur la fiche vivante de l'utilisateur, et seul ce repos les efface. Pas sur une zone ni sur une entrée visant son utilisateur. Nécessite Capability API 1.304.

Des cibles qui grandissent avec la fiche, et la même cible de nouveau (Capability API 1.305). `"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` ajoute autant de cibles à chaque palier de ce qu'il lit, comme `scales` ajoute des dés. Avec `"targetsRepeat": true`, la même cible peut être choisie plusieurs fois, et chaque choix est sa propre attaque avec son propre jet, qui porte tout ce qui modifie l'entrée : les rayons d'eldritch blast, avec les dégâts d'Agonizing Blast et la poussée de Repelling Blast sur chacun. Le sélecteur de cibles du combat ajoute un rayon par clic tant qu'il y a de la place, et le moteur, quand il joue un combattant, place les rayons restants sur la cible qu'il a choisie. Aucun des deux ne va sur une zone ni sur une entrée visant son utilisateur. Nécessite Capability API 1.305.

Une arme mise en main (Capability API 1.306). Une entrée `"utility"` avec `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` met l'une de ces armes de corps à corps dans la main de son utilisateur pour le reste du combat, choisie à l'utilisation comme le mode d'une arme ; `binds` propose aussi chaque arme tenue qui y correspond, qui compte alors comme celle-ci. Avec `proficient`, elle est utilisée avec maîtrise, et ses coups portent `qualities`. Une autre utilisation la remplace, et une arme liée redevient ce qu'elle était. Les modifications de l'entrée qui fait apparaître l'arme atteignent celle-ci : le `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` d'une modification ajoute des dégâts de son propre type sur un coup réussi (Lifedrinker), et `"strikes": 2` fait qu'une dépense du budget de l'attaque achète autant d'attaques (Thirsting Blade). Le moteur, quand il joue un combattant, met une fois en main l'arme qui frappe le plus fort. Nécessite Capability API 1.306 : Pact of the Blade.

Ce que maintient son propre utilisateur (Capability API 1.307). L'action propre d'une créature peut indiquer `"concentration": true`, comme une entrée de catalogue : ce qu'elle applique prend fin quand cette concentration prend fin, et les dégâts la mettent à l'épreuve comme d'habitude. C'est l'Invisibility d'un diablotin ou d'un quasit. Le `endsWhenHolder` d'un état peut aussi indiquer `"uses": ["scare", "spells/bolt"]` : il prend fin quand son porteur utilise l'un de ceux-ci, les propres actions d'une créature par identifiant ou des entrées de catalogue sous la forme `<catalog>/<entry>`. L'invisibilité d'un quasit prend fin quand il utilise son Scare. Le `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` d'une entrée applique ces états à son propre utilisateur au moment où elle est utilisée, quoi qu'il arrive à ses cibles, maintenus par sa concentration quand elle en a une, au niveau auquel elle a été lancée : la particule lumineuse de Sunbeam, un état de combat avec `light` et `"actions": ["spells/sunbeam-line"]` pour les rayons suivants. Une créature toujours invisible n'a besoin de rien de nouveau : `keepsOn: ["invisible"]` (1.263) maintient l'état. Nécessite Capability API 1.307.

Ce qui restait de 1.303 à 1.306 (Capability API 1.308). Le `use` d'un parchemin ou d'une baguette peut porter `targetsScale` et `targetsRepeat`, lus sur la fiche de son utilisateur : un parchemin d'eldritch blast tire un rayon de plus au niveau 5 de son lecteur, et les fléchettes d'une baguette peuvent toutes viser une même créature. Nécessite Capability API 1.308. Trois changements ne nécessitent aucune nouvelle clé. Réagir, c'est agir : un état dont le `endsWhenHolder` indique `"acts": true` prend aussi fin sur toute réaction de son porteur, comme One with Shadows prend fin sur "a reaction". `oncePerTarget` distingue deux créatures du même nom : Chains of Carceri sur un diablotin laisse l'autre diablotin tranquille, et le diablotin d'un combat ultérieur n'est exclu que si le nom était celui de cette créature-là. Une arme mise en main (1.306) peut être une arme de corps à corps de lancer (une attaque avec à la fois une `reach` et une `range`, comme une dague ou un javelot). Elle est renvoyée sans action depuis le menu du combat, et elle disparaît quand son créateur meurt. Elle n'est jamais à plus de 5 pieds de son créateur, car un combat ne la lui retire jamais de la main.

Les conditions de la cachette, Feral Senses, la surprise et le rituel de liaison (Capability API 1.309). Un `hiding` avec `still` peut indiquer `"stillWhile": { "holds": "camouflaged", "wall": true }` : le bonus ne compte que tant que son porteur porte cet état (le camouflage préparé à l'avance, avec une entrée utilitaire d'une minute ou réglé avant le combat) et, avec `wall`, se tient à côté d'une case qui bloque la vue. C'est Hide in Plain Sight. `"unseenStrikes": true` supprime le désavantage pour attaquer quelqu'un que son porteur ne peut pas voir, ce qui est la première moitié de Feral Senses. La seconde moitié ne nécessite rien, car un combat sait déjà où se trouve chaque créature qui n'est pas cachée. Le `hiding` d'une créature avec `starts` peut indiquer `"surprises": true` : quiconque à qui elle est cachée au début commence le combat surpris, comme le fait le Transparent d'un cube gélatineux. Un `conjures` avec `binds` peut nommer un champ texte vivant dans `"boundIn"` : seule l'arme tenue qui y est écrite est liée, et aucune tant qu'il est vide. Y écrire le nom, c'est le rituel d'une heure fait hors combat, pendant un repos court. Nécessite Capability API 1.309.

Répétitions et états qui prennent fin à distance (Capability API 1.310). Les mécaniques d'une entrée à concentration peuvent indiquer `"repeats": { "budget": "action" }` : tant que son utilisateur se concentre dessus, son effet est de nouveau proposé sur ce budget, sans rien coûter sur la fiche, sans commencer de nouvelle concentration et sans rien appliquer de nouveau à son utilisateur, au niveau et au cran de coût auxquels le lancement a été payé. Le menu l'affiche sous la forme "Vampiric Touch again". `"notSaved": true` ne le propose jamais contre une créature qui a réussi une sauvegarde contre ce lancement (Eyebite), et `"sameTargets": true` ne le propose que contre ceux que le lancement visait (Heat Metal, sur une action bonus). `repeats` nécessite `concentration` et un budget connu. Un `applies` peut indiquer `"endsAway": { "beyond": 60, "unseen": true }` : l'état disparaît dès que son porteur se tient à plus de cette distance de celui qui l'a appliqué et, avec `unseen`, ne peut pas le voir. C'est la panique d'Eyebite. C'est vérifié à chaque pas d'un déplacement, de qui que ce soit, et à la fin de chaque tour. Nécessite Capability API 1.310.

Ce qui restait de 1.307 et 1.309 (Capability API 1.311). Le `use` d'un objet peut porter `appliesSelf`, comme les mécaniques d'une entrée : un parchemin de Sunbeam laisse la particule lumineuse, et avec elle les rayons suivants, dans la main de son lecteur, maintenus par la concentration de la lecture. L'action d'une créature peut indiquer `"dyingOnly": true` (seule une créature sans santé mais encore en vie peut être choisie), `"slaysOnFailedSave": true` (une cible qui rate la sauvegarde propre de l'action meurt) et `"healsOnSlay": { "dice": "3d6" }` (la créature récupère autant pour chaque cible qui meurt). C'est le Consume Life d'un feu follet. `slaysOnFailedSave` nécessite un `save`, et `healsOnSlay` nécessite `slaysOnFailedSave`. Une règle de `combat.conditions` peut indiquer `"endsWhenHolder": { "moves": true, "acts": true }` : l'état quitte son porteur, et sa fiche, à son premier pas (`moves`) ou à tout ce qu'il fait sauf Hide, réactions comprises (`acts`), quelle que soit la façon dont il a été appliqué. C'est le camouflage de Hide in Plain Sight, coché sur la fiche avant le combat. Nécessite Capability API 1.311.

Un coup de tonnerre autour d'un coup réussi (Capability API 1.312). Le mode d'une arme peut indiquer `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`. Un coup réussi dans ce mode fait sauvegarder celui qu'il a touché, et tous ceux qui se tiennent à `within` ou moins de lui, sous peine de subir `condition`. Cela inclut les alliés et le porteur de l'arme, s'ils se tiennent aussi près. `rounds` compte leurs propres tours, ou avec `of: "source"` ceux du porteur de l'arme : `rounds: 1, of: "source"` signifie donc "until the end of your next turn". `of` nécessite `rounds`. Hors plateau, seul celui qui est touché sauvegarde. Avec le `range` et les `charges` du mode, c'est un Hammer of Thunderbolts lancé pour une charge. Son Giant's Bane est le `slay` de l'arme avec `when: "critical"`. Nécessite Capability API 1.312.

Maze, Expeditious Retreat, les choix d'un lancement et les ajouts d'attribut plafonnés (Capability API 1.313). Un `dismisses` avec `while` peut indiquer `"turns": true`. La créature est hors du combat mais joue toujours ses tours, et pendant ceux-ci on ne lui propose que ce qui met fin à l'état qui la tient à l'écart, ou la fin du tour. Un `applies` peut porter `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }` : son porteur peut dépenser le budget standard sur ce test de `combat.checks` contre le nombre pour y mettre fin. Une créature qui `passes` réussit sans jet. Ensemble, c'est le Maze de 5e et son minotaure : la créature revient là où elle était quand le test réussit. Les mécaniques d'une entrée peuvent indiquer `"takes": ["dash"]` (ou `disengage`, `dodge`), et son utilisateur fait ces actions standard au moment où elle est utilisée : Expeditious Retreat fait un Dash au moment où il est lancé. Les Dash en action bonus qui suivent viennent des `grants` de son état. Un `repeats` peut nommer un `group` : les entrées d'un même groupe sont les choix d'un même lancement, et tant que l'une d'elles est maintenue par concentration, chacune est de nouveau proposée. `notSaved` et le niveau du lancement sont partagés, comme pour l'endormissement, la panique et la nausée d'Eyebite. La modification d'attribut d'un objet `{ "add": 4, "max": 30 }` s'ajoute par-dessus la valeur que laisse chaque `set`, jusqu'à `max`, et n'abaisse jamais une valeur déjà supérieure. Sans `max`, un ajout fonctionne comme avant. Le `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` d'un objet ne permet de le lier que tant qu'un objet de chaque groupe est porté par le même personnage, lié là où cet objet se lie, et le délie dès que l'un d'eux est retiré, délié ou quitte son sac. Avec `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }`, c'est un Hammer of Thunderbolts. Nécessite Capability API 1.313.

Resilient Sphere (Capability API 1.314). Une entrée de `combat.conditions` peut porter `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`. Tant que l'état dure, son porteur est isolé de tous les autres. Personne d'autre ne peut viser quoi que ce soit sur lui, une zone ou une explosion passe à côté de lui, et rien venant de quelqu'un d'autre ne le blesse, ne le soigne ni ne lui applique d'état, zones et auras comprises. Rien de ce qui vient de lui n'atteint non plus quelqu'un d'autre, et personne ne le frappe quand il se déplace, pas plus que lui ne frappe qui que ce soit. Son propre mouvement est nul, mais avec `rolls` il peut dépenser ce budget pour se déplacer jusqu'à `share` de sa vitesse. Avec `lifted`, quelqu'un qui se tient à côté de lui peut dépenser ce budget pour le soulever. Le porteur va ensuite partout où va celui qui le transporte, jusqu'à ce que celui-ci le dépose, ce qui est gratuit, ou que l'état prenne fin. Les entrées de `brokenBy` peuvent toujours viser le porteur et, au lieu de faire ce qu'elles font, elles mettent fin à l'état et à la concentration qui le maintient : Disintegrate sur la sphère. Les mécaniques d'une entrée peuvent indiquer `"targetsUpTo": "large"`, l'une des `combat.sizes`, et l'entrée ne vise alors que les créatures de cette taille ou plus petites. C'est le "Large size or smaller" de Resilient Sphere. Nécessite Capability API 1.314.

Actions de repaire (Capability API 1.315). Une action de créature peut porter `"lair": true`, et la créature `"lairInitiative"` (20 s'il est omis). Tant que la créature combat dans son repaire (le `"inLair": true` du Game Master sur cet ennemi, ou la liste `inLair` d'une rencontre), elle fait une action de repaire par ronde quand le compte du combat passe le nombre de son repaire, en perdant les égalités : entre les deux tours entre lesquels tombe ce nombre, après le dernier tour de la ronde quand tout le monde est à ce nombre ou au-dessus, ou avant le tout premier tour quand tout le monde est en dessous. Elle ne peut pas faire la même action de repaire deux rondes de suite. Une action de repaire est visée et résolue comme pendant son propre tour, avec son `budget` prêté pour l'occasion, et ne dépense rien du tour propre de la créature. Elle ne figure jamais au menu du tour propre de la créature, et n'est pas faite tant que la créature est à terre ou ne peut pas agir. Une action de repaire n'est ni une réaction ni achetée avec des points, une séquence n'en nomme jamais, et `lairInitiative` nécessite au moins une action de repaire. Les dragons de 5e jouent les leurs au compte d'initiative 20.

Éléments de décor (Capability API 1.316). Un combat sur un plateau peut comporter des éléments de décor qui peuvent être brisés : les `board.props` d'une rencontre, ou les `props` d'un champ de bataille de monde tels qu'ils ont été peints. Chacun a un `label`, les `cells` qu'il occupe, sa `health`, une `defense` (10 si elle est omise), et des types de dégâts `resist`, `vulnerable` et `immune` facultatifs. `blocks` ferme ses cases au déplacement (`move`), à la vue (`sight`), ou aux deux tant qu'il tient, et personne ne commence le combat à l'intérieur. Un élément de décor `fragile` est brisé par tout ce qui le touche. Une attaque qui peut frapper la section d'un mur peut plutôt frapper un élément de décor : il est listé parmi les `walls` de l'option, et le `wall` du choix nomme sa case. Une zone prend chaque élément de décor qu'elle atteint et lui inflige les mêmes dégâts que ceux qu'elle lance pour tout le monde ; un élément de décor ne sauvegarde jamais. Un élément de décor à 0 est brisé : il ne ferme plus rien, et son libellé est ajouté à la liste `broken` du plateau, au résumé du combat et au récapitulatif que lit le Game Master (`Broken: Sluice Gate; Oil Jar`). Le déclencheur `broke` d'une histoire se déclenche sur lui.

Legendary Resistance (Capability API 1.317). Le `"legendaryResistance": 3` d'une créature transforme ses trois premières sauvegardes ratées d'un combat en réussites : le "If the dragon fails a saving throw, it can choose to succeed instead" (3/Day) de 5e. Le moteur choisit toujours de le faire, sur n'importe quelle sauvegarde, y compris une qu'un état fait échouer d'office ; jamais tant que la créature est à terre. La sauvegarde est enregistrée telle qu'elle a été lancée, suivie d'une ligne indiquant qu'elle a plutôt réussi et combien il en reste. C'est un nombre entier de 1 à 20.

L'utilisation d'un objet peut aussi porter `"targetsUpTo"` (Capability API 1.317), comme les mécaniques d'une entrée depuis 1.314 : le `"targetsUpTo": "large"` d'un parchemin de Resilient Sphere n'atteint qu'une créature de cette taille ou plus petite. Il lit `combat.sizes`, et sert à une utilisation pointée sur une créature, pas sur une zone.

Événements du plateau et végétation (Capability API 1.318). Le plateau d'un combat peut changer de lui-même au fil des rondes : les `board.events` d'une rencontre, ou les `events` d'un champ de bataille de monde tels qu'ils ont été peints. Chaque événement a un `id`, un `label` facultatif, et se produit `at` `"round-start"` ou `"round-end"`, `from` une ronde (2 au début d'une ronde, 1 à sa fin, s'il est omis), `every` tant de rondes (1), et `until` une ronde s'il l'indique. `where` nomme ses cases : `cells`, un `block` (`x`, `y`, `w`, `h`), un `ring` autour d'une case (`x`, `y`) qui atteint `start` cases la première fois et `step` cases de plus chaque fois ensuite, un `sweep` depuis un bord (`from` `north`, `south`, `east` ou `west`) avec les mêmes `start` et `step`, ou `{"spread": "growth"}`, chaque case libre voisine de la végétation. Un anneau ou un balayage n'atteint que sa bande la plus récente, profonde de `step` cases (une au moins), la première fois aussi : un anneau avec `start` 3 laisse donc son centre tranquille ; `filled` atteint tout ce qui est à l'intérieur. `onlyOn` le limite aux cases de ces terrains. `change` dit ce qui se passe là, au moins l'un de ces éléments : `terrain`, `height` (de 0 à 3), `light` (`bright`, `dim`, `dark`, `sunlight` ou `clear`), `obscured` (`light`, `heavy` ou `clear`), `growth` (true ou false), `season` (un nom, ou null pour la retirer), `rotate` (un `block` carré seulement, tourné de 1, 2 ou 3 quarts de tour dans le sens horaire avec ses tuiles, ses hauteurs, son sol, les éléments de décor entièrement dedans et ceux qui s'y tiennent entièrement), et `tell`, la ligne que dit le journal à la place de la ligne ordinaire. Quiconque se retrouve là où personne ne peut se tenir (de la glace fendue devenue eau) est placé sur la case libre la plus proche. Un plateau contient jusqu'à 32 événements.

Emportés (Capability API 1.329). Le `change` d'un événement du plateau peut aussi indiquer `push`, `{"toward": "east", "squares": 3}` (un bord, `north`, `south`, `east` ou `west`, et de 1 à 6 cases) : quiconque se tient au sol sur ses cases est emporté dans cette direction case par case, jamais hors du plateau, dans un mur ou un élément de décor fermé, sur un sol où personne ne peut se tenir, ni sur quelqu'un d'autre, et personne ne le frappe pour cela ; ceux qui sont les plus proches de ce bord partent les premiers, et quelqu'un en l'air n'est pas touché. Le journal indique qui il a emporté. Le bief du Mill of Hours. Ou `drift`, de même forme : ce qui masque ses cases (léger ou dense) est soufflé dans cette direction et revient par le côté opposé de son `block`, ou du plateau pour tout autre `where` ; rien d'autre ne bouge sur les cases, et un masquage dense reste là où un masquage léger est soufflé dessus. Les amas de Leaffall. Les événements peints d'un champ de bataille acceptent les deux.

La végétation sur une case coûte double pour y entrer (pas plus qu'un autre terrain difficile) et obscurcit légèrement quiconque s'y tient. Un coup dont le type de dégâts coupe la végétation (tranchant, sauf si le `growth.cutBy` du plateau dit autre chose) peut viser une case de végétation qu'il atteint, listée parmi les `walls` de l'option : il dégage cette case sans jet et dépense l'action. Des dégâts d'un type qui brûle la végétation (le feu, sauf si `growth.burnedBy` dit autre chose) la brûlent sur chaque case qu'ils atteignent, toute l'étendue d'une zone ou la case de celui qu'ils touchent. Les mécaniques d'une entrée, ou l'utilisation d'un objet, avec `"clears": "growth"` et une `area` dégagent la végétation de cette zone : un sécateur, `{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`. Le `board.ground` d'une rencontre peint au départ végétation, lumière, masquage et saisons sur des cases ; un champ de bataille de monde peint la végétation sous forme de lignes `growth` de `g` et de `.`, et ses saisons comme le font les Experiences.

Ombre, règles de lumière, carillons et créatures craignant la lumière (Capability API 1.319). Une lumière avec `"shade": true` répand de l'ombre : une faible lumière aussi loin que porte son `dim`, et la vive lumière et la lumière du soleil y sont faibles elles aussi, quoi que ce soit d'autre qui les éclaire. Elle n'a pas de vive lumière, et n'est ni `reveals` ni `sunlight`. L'ombre n'atteint jamais l'intérieur d'une obscurité magique. La Lantern of Dusk de la vitrine est un objet transporté avec `{"light": {"bright": 0, "dim": 15, "shade": true}}`. La propre lumière d'une case (1.318) et son ombre sont aussi ce que les yeux y lisent : sur un plateau vivement éclairé, une créature qui se tient sur une case obscure n'est vue que par un sens qui voit dans le noir.

Le plateau d'un combat peut avoir une règle de lumière : le `board.lightRule` d'une rencontre, ou le `lightRule` d'un champ de bataille de monde tel qu'il a été peint. À la fin de chaque ronde, quiconque se tient entièrement dans l'une de ses lumières (`in`, la vive lumière et la lumière du soleil si rien n'est indiqué ; la vive lumière comprend la lumière du soleil) compte une fin de ronde de plus à cet endroit et, toutes les `rounds` fins de ronde (1 si rien n'est indiqué), ses `tracks` bougent de `by` et ses états `applies` lui sont appliqués. En sortir, même dans l'ombre d'une seule case, remet le compte à zéro. `spares` nomme les `types` et `tags` de créatures qu'elle ne touche jamais. Une règle qui ne déplace aucune piste de la fiche et n'applique aucun état connu du combat ne fait rien et est abandonnée. Noonfield s'écrit `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}` : un niveau d'épuisement par minute au soleil.

Sauvegardes contre les règles de lumière (Capability API 1.321). Le `save` d'une règle de lumière (`save`, `difficulty`) est lancé par chaque créature qu'elle est sur le point de toucher, et une sauvegarde réussie y échappe cette fois-ci ; le compte reprend de zéro dans tous les cas. Son `against` (des `conditions` connues du combat, des types `damage`) indique contre quoi la sauvegarde compte, pour qu'un modificateur de sauvegarde avec un `against` correspondant s'applique : un chapeau de paille porté ou transporté avec `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`. Le `upTo` d'une entrée de piste indique jusqu'où la règle la déplace : un épuisement qui le dépasserait s'y arrête, et plus rien n'est ajouté une fois ce niveau atteint. Noonfield tel qu'il est écrit : `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`, avec un état `noon_light` que l'expérience ajoute pour que le chapeau puisse le nommer.

Utilisations d'objets comme réactions (Capability API 1.322). Le `use` d'un objet (ou l'un de ses `moreUses`) peut porter une `reaction`, écrite comme celle d'une entrée de catalogue, et n'est alors proposé que lorsque ce moment s'ouvre, payé sur `budget` (la réaction du porteur) et sur ses charges ou l'objet lui-même comme toute utilisation. Liesl's Coffin, une fois par jour quand une créature à 5 pieds ou moins de son porteur est touchée, +5 à la CA pour elle jusqu'au début du prochain tour du porteur, y compris contre ce coup : `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}` sur un objet avec `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`. Le Straw Proxy, une attaque visant son propriétaire perdue et le mannequin brûlé : `{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`. L'utilisation d'un objet nomme son moment : `"reaction": true` est refusé.

Held Ground et la moisson (Capability API 1.323). Un combat peut se livrer sur un Held Ground, un lieu où la mort est retenue : le `heldGround` du combat (`label`, une `condition`, et `marks` sous la forme `[{"track", "by"}]`), que la règle de région de l'histoire lui transmet. Là, quiconque n'a plus de santé est terrassé au lieu de mourir ou de tomber à terre : un adversaire est hors du combat ; un personnage reste stable, ne lance jamais de dé pour mourir, ne subit aucun échec du fait d'être blessé et peut être soigné comme d'habitude. Les terrassés reçoivent sa `condition` (et un personnage, l'état propre de l'ensemble pour être à terre), et chacun de ceux qui ont une fiche déplace ses pistes `marks` : la marque d'Owing de la vitrine. Ce qui tuerait sur-le-champ terrasse à la place. Un coup qui `reaps`, sur l'action d'une créature ou l'attaque d'un objet, moissonne quiconque il terrasse : il reste à terre, ne reçoit ni état ni marque, et un personnage moissonné est mort. Le Reaping Hook est une arme dont l'`attack` a `"reaps": true`. Les combattants terrassés et moissonnés portent `felled` et `reaped`, pour que l'histoire puisse relever plus tard les terrassés.

Held Ground relâché (Capability API 1.330). L'histoire peut relâcher le Held Ground au milieu d'un combat, quand l'année tourne : le `releaseRulesetHeldGround(definition, state, release)` du directeur (avec, en dessous, le `rulesetReleaseHeldGround` partagé). Dès lors, quiconque n'a plus de santé meurt ou tombe à terre comme partout ailleurs. Les terrassés qui n'ont pas été moissonnés meurent, adversaires comme personnages, sauf si `release.felled` vaut `"down"` : un personnage tombe alors à terre et commence à mourir selon la règle propre de l'ensemble. Avec `release.owing` (`{"track"?, "bonus"?}`, la piste étant par défaut la première piste marquée du Held Ground), les marques de chaque personnage sur cette piste arrivent à échéance : une sauvegarde contre la mort de l'ensemble par marque, avec `bonus` ajouté à chacune (le Debts Settled de l'équipe), lancées jusqu'à épuisement des marques ou jusqu'à ce que le compte soit décidé, avec les résultats naturels comme le dit la règle de mort ; les marques sont ensuite dépensées. Trois échecs (le maximum de la piste des échecs), c'est la mort. Le journal indique qui est mort, qui est tombé à terre, et les jets de chaque personnage. Un combat qui n'est pas sur un Held Ground reste tel quel.

Zones et sol des créatures (Capability API 1.324). Une action de créature avec une `area` peut laisser cette zone en place avec `zone`, écrite comme la zone d'une entrée de catalogue (`rounds`, `triggers`, `obscures`, `terrain` et le reste) : le Freezing Fog de The Owed, le cube de farine de Scatter Flour, le sol qui gèle en terrain difficile. Une zone avec `"untilLair": true` prend aussi fin quand revient le compte de repaire de son auteur, avant le choix de cette action de repaire, si ses `rounds` n'y ont pas mis fin avant : "until the next lair action". Une action de créature peut plutôt changer pour de bon le sol que couvre sa zone avec `ground`, comme le dit le `change` d'un événement du plateau (`terrain`, `height` de 0 à 3, `light`, `obscured`, `growth`, `season`, et un `tell` pour le journal) : le feu de joie vacille (`"light": "dark"`), la glace se fend (`"terrain": "water"`) ; quiconque reste sur une case où personne ne peut se tenir est déplacé sur la case libre la plus proche. Les deux nécessitent l'`area` de l'action, et un `ground` doit changer quelque chose. Un ensemble qui utilise l'un ou l'autre, ou `untilLair` où que ce soit, nécessite Capability API 1.324.

Créatures appelées dans un combat (Capability API 1.325). Une action de créature peut indiquer `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }` : à son utilisation, autant de créatures du bestiaire nommées (un `"<catalogId>/<entryId>"` tiré des catalogues de l'ensemble ou du bestiaire transmis au combat ; `count` vaut `{"dice"}`, `{"flat"}` ou les deux, huit au plus à chaque fois) rejoignent le combat dans le camp de son utilisateur, construites comme le combat a construit les siennes et nommées une à une ("Zombie 1", "Zombie 2"). Avec une `area`, elles sont posées là où elle est visée, et aussi près que la place le permet une fois qu'elle est pleine ; sans zone, à côté de celui qui les appelle, et l'action ne vise personne. Elles lancent leur propre initiative et prennent leur place dans l'ordre : une place que les tours de cette ronde ont déjà dépassée devient une place de la ronde suivante. Avec `"initiative": "after"`, leurs tours viennent plutôt juste après celui de leur appelant. Une action de repaire peut appeler (Shelves Lean), et le tour pendant lequel son compte est tombé se poursuit comme avant. Une créature introuvable au début du combat n'appelle personne, et un combat ne contient pas plus de 40 combattants. Le journal indique qui est venu. Un ensemble qui utilise `calls` nécessite Capability API 1.325.

Attiré vers une créature (Capability API 1.326). Une action de créature peut indiquer `"draws": { "spends": "reaction" }` : quiconque elle touche (avec un `save`, seulement en cas d'échec) dépense ce budget sur-le-champ pour se déplacer jusqu'à sa vitesse vers la créature, par le chemin libre menant à la case accessible la plus proche d'elle, sans provoquer de frappe. Quelqu'un à qui il ne reste rien de ce budget, ou qui ne pourrait pas s'approcher davantage, ne dépense rien et reste sur place. Le Whisper a Name de The Owed. `spends` est l'un des budgets de l'économie. Un ensemble qui utilise `draws` nécessite Capability API 1.326.

Le moment du repaire (Capability API 1.327). Une action de créature avec `"actedOnly": true` ne peut être pointée que sur quelqu'un qui a déjà commencé son tour cette ronde, celui en cours compris ; avant le tout premier tour du combat, tant qu'un repaire agit avant tout le monde, personne ne l'a fait. C'est le "one creature that has already acted this round" de l'Hour Bell. La durée d'un état peut ajouter `"untilLair": true` à ses `rounds` : il prend aussi fin quand celui qui l'a appliqué arrive de nouveau au compte de son repaire, avant le choix de cette action de repaire (le "until the next lair action" de l'Hour Bell). Une action de créature maintenue par sa `concentration` peut nommer `"brokenNextLair"`, l'une de ses propres actions de repaire : une fois cette concentration rompue (par une blessure, par une chute à terre, ou par ce que fait une zone, jamais parce que son détenteur y met fin ou en commence une autre), cette action de repaire est la prochaine qu'elle fait et la seule proposée, quoi qu'elle ait fait la ronde précédente ; une fois faite, le choix redevient libre. La Litany of Keeping de Father Ivo et les étagères qui penchent. Un ensemble qui utilise l'un de ces éléments nécessite Capability API 1.327.

Difficulté de sauvegarde déplacée par un état (Capability API 1.328). La modification `{ "to": "save-difficulty", "flat": -2 }` d'un état déplace la difficulté de chaque sauvegarde que demande son porteur tant qu'il le porte : les propres sauvegardes de ses actions, et la difficulté de sauvegarde donnée pour les sauvegardes qui mettent fin à ce que ces actions appliquent. Elle prend une quantité `flat` et rien d'autre, et elle ne touche jamais la difficulté d'un test, une sauvegarde de concentration (fixée par les dégâts) ni les créatures qu'une action appelle dans le combat. L'Un-age du Miller of Hours : un DD de sauvegarde des sorts inférieur de 2. Un ensemble qui l'utilise nécessite Capability API 1.328.

Éléments de décor et auras qui se nourrissent (Capability API 1.331). Un état de combat peut indiquer `"whileNearProp": {"prop": "Year-Wheel", "within": 10}` : il ne vaut que tant que son porteur se tient à cette distance ou moins (celle de l'ensemble) d'un élément de décor encore debout du plateau portant ce libellé, et il est tenu en suspens, pas terminé, partout ailleurs ou une fois cet élément brisé ; un combat sans plateau le maintient. Le Wheel's Favour. L'`area` en explosion d'une action de créature peut indiquer `"aroundProp": "Shelf"` : où qu'elle soit visée, elle couvre chaque case située à sa `size` ou moins d'un élément de décor encore debout portant ce libellé, y compris derrière lui. Shelves Lean autour des rangées d'étagères du Granary. Une aura peut indiquer `"feeds": 15` : son porteur récupère autant de points de vie chaque fois que quelqu'un que l'aura atteint est terrassé, tombe à terre ou est tué, et une aura peut ne faire que cela. Le Collector de The Owed. Un ensemble qui utilise l'un de ces éléments nécessite Capability API 1.331.

Rallumer, tomber au travers, et des utilisations près d'un élément de décor (Capability API 1.332). L'élément de décor d'un plateau (les `board.props` d'une rencontre, ou un élément peint sur un champ de bataille) peut indiquer `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}` : tant qu'une case située à `squares` ou moins de lui n'est pas dans cette lumière telle que le combat la lit, quelqu'un qui se tient à côté se voit proposer "Light it again" pour ce budget (`action` s'il est omis), ce qui met cette lumière sur chacune de ces cases. Le feu de joie de The Owed après Bonfire Gutters. Le `ground` d'une action de créature peut indiquer `"occupants": "stay"` avec son `terrain` : quiconque se tient là où le sol devient quelque chose sur quoi personne ne tient reste là, tombé à travers la glace dans l'eau, plutôt que d'être déplacé sur la case libre la plus proche (`"shove"`, par défaut). Une entrée de catalogue ou l'utilisation d'un objet peut indiquer `"usableNear": {"prop": "Year-Wheel", "within": 5}` : elle n'est proposée que tant que son utilisateur se tient à cette distance ou moins d'un élément de décor encore debout nommé par son identifiant ou son libellé, et jamais dans un combat sans plateau. Le Fennick's Hymnal au Year-Wheel. Depuis 1.332, `whileNearProp`, `aroundProp` et `usableNear` nomment tous un élément de décor de la même façon : par son identifiant (`"p1"`), ou par son libellé lu de façon souple, sans tenir compte de la casse, d'un "the" initial ni de tout ce qui n'est pas lettre ou chiffre : `"Year-Wheel"` trouve donc un élément libellé "The Year-Wheel". Un ensemble qui utilise `usableNear` ou `occupants` nécessite Capability API 1.332.

Illustrations du plateau de combat (Capability API 1.333). Le plateau d'un combat peut être dessiné à partir d'un pack de plateau : des feuilles PNG sur une grille de cases (48 pixels pour le style RPG Maker) avec des tuiles sous des identifiants fixes, créées dans Pixelforge et gardées dans la bibliothèque (`POST /api/game-tile-packs/boards`). `bt_plains`, `bt_forest`, `bt_mountain`, `bt_ruin`, `bt_water` et `bt_wall` sont les terrains, jusqu'à huit variantes chacun choisies case par case, ou un motif plus grand qu'une case posé sur le plateau ; `bt_edge_water` et `bt_edge_wall` sont des blocs en double grille de seize pièces, quatre cases sur quatre, disposés comme les blocs `edge_` de Pixelforge, qui fondent l'eau et les murs dans les plaines voisines ; `bt_height1` à `bt_height3` sont des rebords sur le terrain surélevé. `bo_dim`, `bo_dark`, `bo_sunlight`, `bo_fog_light`, `bo_fog_heavy`, `bo_growth`, `bo_ice` (une case en hiver), `bo_zone`, `bo_aim` et `bo_reach` sont dessinés sur une case à la place des teintes actuelles. Le sprite d'un élément de décor est `bp_<name>` sur ses cases (`"art": "bp_bonfire"` sur l'élément ou, s'il est omis, son libellé en mots minuscules joints par `_` sans "the" initial : "The Year-Wheel" donne donc `bp_year_wheel`), et `bp_<name>_broken` une fois qu'il est brisé. Un champ de bataille peint ou le plateau d'une rencontre peut nommer son pack avec `"pack": "local/<id>"` ; sans pack, il est dessiné avec le pack de la bibliothèque pour son environnement (l'`environment` d'un pack), puis avec le `board/<environment>` intégré, puis comme aujourd'hui, et les éléments de décor sont aussi cherchés dans le pack d'éléments de décor de la bibliothèque (`"environment": "props"`), puis dans le `board/props` intégré. Une tuile absente d'un pack est dessinée comme aujourd'hui. Une zone de catalogue peut indiquer `"art": "bz_<name>"` : chaque case qu'elle couvre est dessinée avec cette tuile du pack du plateau, sinon avec `bo_zone`. Un ensemble qui utilise l'`art` d'une zone nécessite Capability API 1.333.

Plus de tour grâce à un objet (Capability API 1.334). L'utilisation d'un objet peut indiquer `"gives": [{"budget": "action", "count": 1}]`, comme les mécaniques d'une entrée de catalogue (Action Surge) : l'utiliser donne aussitôt à son utilisateur autant de tour en plus, plafonné là où il s'applique, si bien que rien n'est gardé pour plus tard. Le Time-Flour Loaf, mangé avec une action bonus, donne une action de plus maintenant. Un ensemble qui l'utilise nécessite Capability API 1.334.

Des dés dépensés pendant un repos (Capability API 1.335). Un repos peut indiquer `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}` : le `[sheet: op="rest" rest="short" dice="2"]` du Game Master (ou un pour toute l'équipe) dépense alors d'abord autant de `pool`, lance chaque dé (`die` est n'importe quelle valeur, ou un champ enum écrit "d8") plus `add`, jamais en dessous de 0 par dé, et rend autant à `heals` comme un soin qui n'est pas magique, avant que le repos ne fasse ce qu'il dit. `extra` est un dé de plus pour tous ceux qui en dépensent : le membre de l'équipe dont le `die` donne le plus de faces le lance pour chacun, plus son propre `add`. C'est le Song of Rest de 5e, et le +1 sur chacun de ses dés du Pell's Brown Teapot, comme statistique d'objet que lit l'`add`. Un ensemble qui utilise les `dice` d'un repos nécessite Capability API 1.335.

Des dés de repos sur plusieurs réserves (Capability API 1.337). Le `"dice"` d'un repos peut être une liste, une entrée par réserve, chacune avec ses propres `die`, `add`, `heals` et `extra` : `[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`, si bien qu'un guerrier 1 / magicien 1 dépense un d10 et un d6. `[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` ne dépense que dans cette réserve ; sans `pool`, les dés viennent de la première réserve listée qui en a, puis de la suivante, et un total insuffisant est refusé sans rien dépenser. Le dé supplémentaire (Song of Rest) est celui de la première entrée qui en a un, lancé une fois pour toute la dépense, et il soigne ce que soigne la première réserve dans laquelle on a dépensé ; il vient même quand seule une réserve ultérieure paie. En partie, les dés d'un repos lisent ce que porte chaque personnage : un `itemStat` dans `add` ou dans l'`add` du dé supplémentaire compte donc. C'est le Teapot de Pell, `{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`. Un ensemble qui a une liste ici nécessite Capability API 1.337.

Icônes (Capability API 1.338). Une entrée de catalogue et un état de fiche peuvent nommer leur icône, `"icon": "ic_poison_cloud"` : une tuile du pack d'icônes de la partie (un pack de plateau de type `icons` ; voir packages/server/src/assets/board-packs/README.md). Sans icône, le moteur cherche le nom dérivé : un état `ic_cond_<id>`, un objet `ic_item_<entry id>` (ou `ic_item_<name>` pour un objet inventé par le Game Master), toute autre entrée de catalogue `ic_<catalog id>_<entry id>` (`ic_spells_fireball`), les tirets devenant `_`. Sans l'un ni l'autre, la lettre ou le texte actuels s'affichent. Un ensemble qui nomme une icône nécessite Capability API 1.338.

Une liste d'actions de repaire pour une concentration rompue (Capability API 1.336). `"brokenNextLair"` peut être une liste de ses propres actions de repaire, chacune une fois, au lieu d'une seule : `["shelves_lean_north", "shelves_lean_south"]`. Une fois cette concentration rompue, la prochaine action de repaire est l'une de celles-là et aucune autre, quoi qu'elle ait fait la ronde précédente, et celui qui dirige la créature choisit laquelle. Une créature dirigée par le moteur prend celle qui prendrait le plus de ses ennemis ; entre des actions égales, elle les évalue comme n'importe quoi d'autre. Une fois faite, le choix redevient libre. Un ensemble qui a une liste ici nécessite Capability API 1.336.

Un état, ou un objet porté ou transporté, avec `"alerts": 15` trahit quiconque se déplace caché à cette distance ou moins de son porteur : il n'est caché de personne, et le journal indique que son porteur l'a trahi. Le Wind-Chime de la vitrine est un objet transporté avec `{"alerts": 15}`. Le `"stillIn": ["bright"]` d'une créature l'empêche de se déplacer tant que l'une de ses cases est dans l'une de ces lumières : aucun déplacement ne figure alors dans son menu. C'est le Lantern-Shy de la vitrine.

Auras qui grandissent, emprises plafonnées, se libérer et tenir bon (Capability API 1.320). Le `"grows": {"by": 10, "upTo": 40}` d'une aura atteint `by` plus loin au début de chacun des tours de son porteur, jusqu'à `upTo` au plus, qui est supérieur à sa `distance` ; le journal indique jusqu'où elle porte maintenant. Ses `harms` peuvent indiquer `"on": "their-turn"` : infligés au début de chaque tour de quiconque elle atteint, au lieu d'en une seule fois au début du tour de son porteur. `"lingers": true` laisse ce qu'elle propage sur quiconque elle n'atteint plus jusqu'au début de son prochain tour, et l'aura le maintient de nouveau si elle l'atteint avant. Le Frost Debt de The Owed s'écrit `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`.

Ce qu'une action applique peut porter `"heldAtMost": 2` : tant que sa source en maintient déjà autant d'autres avec lui, il ne s'applique pas à un troisième (le journal indique qu'il ne s'applique pas), comme les Grasps de The Owed. Le `shakeOff` d'un état avec `"self": true` permet aussi à son porteur d'y mettre fin, en dépensant le budget sans test : le Seed Hopper, `{"budget": "action", "self": true}`, dont on se libère soi-même ou grâce à un allié à côté. Le `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` d'une créature la laisse à 1 point de vie au lieu de tomber à 0, `uses` fois par combat, mais pas contre ce qui tue sur-le-champ ; avec `extraTurn`, elle joue un tour à elle juste après celui où cela s'est produit, et l'ordre redevient ce qu'il était une fois ce tour terminé.

Le sélecteur affiche ce bloc sur une ligne. Qui lit le reste dépend du bloc choisi par l'ensemble :

- Avec [`combat`](#combat-a-fight-your-own-rules-resolve), le combat lit ses effets. `range`, `area` et `friendlyFire` s'appliquent sur un champ avec positions ; `reaction` marque une entrée qui répond à quelque chose plutôt qu'une entrée jouée pendant un tour, et nomme le moment qu'elle attend (voir [Fenêtres](#windows-holding-the-fight-open)) ; une entrée marquée simplement `true` n'en nomme aucun et ne figure sur aucun menu. `check` concerne les tests de compétence décrits plus haut.
- Avec seulement [`battle`](#battles-lending-the-sheet-to-marinaras-combat), la bataille lit `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` et `cost`, car le combat propre à Marinara peut les utiliser.

Le vocabulaire est fermé : une clé ou valeur absente de cette liste est refusée au lieu d'être ignorée.

`cost` est aussi le prix payé hors bataille par la commande `use` du GM, décrite ci-dessous.

### Commandes de fiche : progression permanente (Capability API 1.142)

Un ensemble peut accepter des modifications de la construction permanente du personnage avec `sheet.advancement` :

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

N'inclus que des identifiants de champs que ta fiche déclare comme nombre ou texte (`text` ou `longtext`), 24 au plus. Les booléens autorisent respectivement tous les attributs, toutes les compétences ou toutes les sauvegardes ; omis ou faux, ils n'autorisent rien. Un ensemble d'autorisations vide, un champ inconnu, un type de champ non pris en charge ou une clé inconnue sont refusés à l'importation. `text` est une consigne facultative d'au plus 400 caractères destinés au prompt. Sans `advancement`, les commandes existantes se comportent comme avant et toute demande `advance` est refusée.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Nomme exactement une cible. Les champs et les attributs prennent exactement l'un de `by` ou `to` ; le texte ne prend que `to`. Les noms et les niveaux correspondent aux identifiants ou aux libellés, sans tenir compte de la casse. Les compétences et les sauvegardes acceptent tout niveau déclaré dans `resolution.proficiencyTiers`. Les champs numériques respectent `integer`, `min` et `max` ; les attributs respectent leurs bornes entières ; le texte respecte `maxLength`. Une valeur invalide est refusée avec une raison `bad-amount` qui indique la borne, jamais ramenée silencieusement dans les limites. Une progression désactivée, des cibles non autorisées, des noms inconnus et des niveaux inconnus sont aussi refusés. La balise réécrite porte `result` et la nouvelle valeur dans `now`. Omets `who` pour le joueur, ou utilise `who="party"` pour chaque fiche de l'équipe identifiée sans ambiguïté ; les refus partiels nomment les fiches qui n'ont pas pu progresser.

Le moteur enregistre la construction sur la fiche de personnage de la partie par le même stockage de métadonnées qu'une modification du joueur, en gardant sa version de fiche et en recalculant les valeurs dérivées à partir de la nouvelle construction. Les fiches de la bibliothèque ne sont pas modifiées. Comme pour les commandes vivantes, un swipe alternatif ou une réponse régénérée part d'avant les modifications de la réponse sortante. Chaque réponse enregistre la construction à laquelle elle aboutit, y compris les réponses sans progression. Sélectionner un swipe restaure son instantané ; supprimer la dernière réponse fait réapparaître l'instantané précédent. Supprimer une réponse plus ancienne laisse un instantané ultérieur en vigueur jusqu'à ce que cette réponse ultérieure soit supprimée. Une continuation met à jour l'instantané de la même réponse. Annuler ne modifie que les valeurs qui correspondent encore au résultat enregistré : les modifications ultérieures du joueur sont conservées, et des modifications sans rapport n'empêchent pas d'annuler une attribution d'XP.

### La commande `use` : laisser le Game Master payer un prix que tu as écrit

Pendant la narration, le GM actualise les fiches avec `[sheet: ...]` : `spend`, `restore` (`heal` a le même sens), `damage`, `temp`, `track`, `condition`, `note` et `rest`. Un ensemble avec catalogues en reçoit une autre :

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` équivaut à `op="use"` et `spell=` à `name=` : l'expression choisie par le GM fonctionne sans que ton format connaisse le mot "spell".

Le nom est comparé sans tenir compte de la casse aux lignes du personnage issues de tes catalogues. Une ligne répond au nom montré au GM (colonne de nom `sheetSummary`, puis `pools.nameColumn`, puis première colonne de texte) et au `label` de l'entrée d'origine. Renommer une ligne ne fait donc pas perdre son accès. Un nom sans correspondance et un nom partagé par deux entrées distinctes sont tous deux refusés.

Ce qui est dépensé :

- Chaque terme de `mechanics.cost`. Un terme nommant une réserve vivante paie depuis celle-ci ; un terme nommant un GROUPE paie depuis la première réserve du groupe capable de payer, dans l'ordre de déclaration. Aucune montée automatique vers une réserve supérieure : un groupe n'est pas toujours une échelle.
- Plus un de chaque réserve de ligne écrite par la même entrée, comme un compteur d'usages : la seconde ligne de `Last Ember`. Un compteur au maximum de 0 n'a aucun usage ; la commande est refusée plutôt qu'exécutée gratuitement.

`pool=` représente l'incantation à niveau supérieur : le même prix unique, payé depuis une autre réserve du groupe. Il est accepté seulement si le coût a un terme unique et si la réserve nommée appartient au même groupe, ou paie pour ce groupe. Tout autre cas est refusé plutôt que réinterprété.

**Une réserve qui paie pour un autre groupe** (Capability API 1.171). Le `pays` d'une réserve vivante nomme jusqu'à quatre autres groupes dont elle peut aussi payer les coûts, à son propre niveau (son `level`, ou sa place dans son propre groupe), et jamais pour un coût d'un niveau supérieur au sien. Les emplacements de pacte de 5e paient pour des sorts dont le coût est exprimé en emplacements de sorts, comme peut le faire un occultiste multiclassé :

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

Un combat propose une telle réserve à côté des réserves supérieures du groupe propre au sort, et un paiement depuis elle fait grandir le sort d'autant de crans que son niveau dépasse celui du sort : un emplacement de pacte de niveau 3 paie Magic Missile comme le ferait un emplacement de niveau 3. Une utilisation dont la propre réserve est vide est toujours proposée, payée seulement depuis une réserve supérieure ou une réserve qui paie pour elle : un sort de niveau 1 se lance ainsi avec un emplacement de niveau 2 une fois les emplacements de niveau 1 épuisés. `targetsPerCostStep` (1.171, de 1 à 10) sur les `mechanics` d'une entrée ajoute autant de cibles pour chaque cran dont elle est payée au-dessus, jusqu'à 20 au plus : Hold Person s'écrit `"targetCount": 1, "targetsPerCostStep": 1`.

C'est tout ou rien. Si une partie du prix ne peut pas être payée, toute la commande est refusée, rien ne change et le joueur est averti. Une entrée gratuite, comme un tour de magie ou une capacité passive, est acceptée sans rien changer.

### Dans le fichier, ou dans son propre fichier

Un petit catalogue est intégré à `ruleset.json`, dans les `entries` de son en-tête. Un long catalogue a son fichier, nommé par `asset` dans l'en-tête. Il possède exactement l'une de ces deux formes.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

Le chemin est toujours `catalogs/<the catalog's id>.json`. Le fichier ressemble à ceci :

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Les fichiers de catalogue séparés viennent dans un package : un package publié par le catalogue officiel, ou un fichier de package d'ensemble que tu importes toi-même (voir [Partager ton ensemble de règles](#sharing-your-ruleset)). Le package liste le fichier dans `contributions.assets.paths` avec `ruleset.json` et nécessite Capability API 1.21. Un catalogue de créatures, intégré ou séparé, nécessite Capability API 1.27, et un catalogue d'objets, 1.49. **Un ensemble importé comme fichier unique ou partagé par GitHub contient ses catalogues dans le fichier**, donc ils doivent tenir dans sa limite totale de 512 KB. Cela permet quelques centaines d'entrées courtes.

Les limites sont douze catalogues par ensemble, 2000 entrées par catalogue dans les deux cas et 2 MB par fichier de catalogue. Un package dont le `ruleset.json` dépasse 256 KB, ou dont un fichier de catalogue dépasse 1 MB, nécessite Capability API 1.340, qui a relevé ces deux limites.

### L'assistant de création guidée : créer un personnage par étapes

Une fiche peut déclarer `sheet.builder` (Capability API 1.86). L'éditeur de fiche, dans les éditeurs de personnage et de persona et, dans une partie, sous **Edit sheet** (modifier la fiche), s'ouvre alors sur une vue **Guided** (guidée), à côté du formulaire complet **All fields** (tous les champs) : les étapes en haut, chacune avec un badge qui compte les choix qu'elle attend encore, **Back** (retour) et **Next** (suivant), qui ne bloquent jamais (un joueur peut laisser des choix pour plus tard), et le personnage tel qu'il est à côté : ce que les étapes ont écrit, les valeurs d'attributs, les valeurs que nomme `gm.sheetSummary` (classe d'armure, bonus de maîtrise) et les sauvegardes et compétences entraînées.

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

Jusqu'à 24 étapes, chacune `{ id, label, kind, ... }` ; un package qui en a plus de 16 déclare Capability API 1.112 :

- `catalog` : les entrées d'un catalogue de lignes, affichées sous forme de cartes avec leur `summary` derrière **Info** (informations). `min` (1 par défaut) est le nombre d'entrées que l'étape demande et `max` (1 par défaut) le plus grand nombre qu'elle accepte ; avec `max` à 1, une nouvelle sélection remplace l'ancienne. Les deux peuvent monter jusqu'à 40 ; un package dont l'un dépasse 20 déclare Capability API 1.110. `field` nomme un champ texte ou enum dans lequel les libellés sélectionnés sont écrits (un champ enum prend l'identifiant ou le libellé de l'entrée, celui qui fait partie de ses valeurs). `filters` fixe des valeurs des filtres du catalogue, et `within: { step, filter }` ne propose que les entrées dont le `filter` nomme une entrée sélectionnée à cette étape antérieure, comme une sous-race nomme sa race ; si la race est désélectionnée, sa sous-race ne compte plus. `upTo: { filter, value }` (Capability API 1.87) ne propose que les entrées dont le `filter` numérique vaut au plus `value`, une valeur lue sur la fiche telle qu'elle est, comme des aptitudes jusqu'au niveau du personnage (`{ "filter": "level", "value": { "derived": "level" } }`) ; une entrée sans ce filtre est toujours proposée, et une sélection sous laquelle la fiche est retombée depuis ne compte plus, mais elle est conservée. Une sélection qui modifie la valeur lue (une classe qui fixe le niveau) est réglée dans la même modification, tout comme une valeur modifiée dans **All fields** (un niveau abaissé là reprend aussitôt ce qu'une aptitude au-dessus avait donné). `countFrom` (Capability API 1.90) est une valeur lue de la même façon sur la fiche qui tient lieu à la fois de `min` et de `max` : le nombre d'entrées que l'étape demande et le plus grand nombre qu'elle accepte, arrondi vers le bas et jamais au-dessus de `max`, comme les sorts qu'une classe connaît au niveau du personnage (`{ "derived": "spells_known" }`). Les sélections au-delà sont conservées mais ne comptent pas jusqu'à ce que le compte remonte. Une étape de catalogue peut aussi porter `stamp` (Capability API 1.108), de 1 à 4 valeurs de colonne écrites sur chaque ligne qu'elle ajoute, comme `"stamp": { "class": "wizard" }` sur l'étape des sorts du magicien et `"stamp": { "class": "cleric" }` sur celle du clerc. Chaque clé doit être une colonne de chaque liste qu'alimente le catalogue ; les valeurs sont des chaînes, des nombres ou des booléens. Le marquage remplace la valeur initiale du catalogue. Les lignes existantes et les modifications ultérieures dans **All fields** restent celles du joueur. Avec Capability API 1.130, une valeur de marquage peut plutôt être un objet dont le `fromWithin` vaut `"id"`, `"label"` ou un identifiant de filtre déclaré par le catalogue parent : elle lit le premier parent correspondant dans l'ordre des sélections, écrit une chaîne ou un nombre une seule fois quand la ligne est ajoutée, et laisse cette colonne sans marquage si aucun parent ne correspond ou si son filtre est absent ou est un tableau.

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields` : un court formulaire de champs nommés. Son badge compte ceux qui sont encore vides, sauf ceux listés dans `optional` (une sous-classe choisie à un niveau ultérieur). `shownWhen: { "field_id": { "field": "level" } }` (Capability API 1.107) n'affiche et ne compte un champ nommé de l'étape que tant que sa référence de valeur vaut plus de 0 sur la fiche telle qu'elle est ; les champs cachés gardent leurs valeurs. `total: { "fields": ["level_bard", "level_other"], "max": 20 }` (1.107) limite au moins deux champs numériques de l'étape à un maximum combiné (un entier de 1 à 1000), en abaissant le maximum de chaque saisie des valeurs actuelles des autres sans descendre sous son propre minimum, et ajoute un au badge si le total dépasse la limite ; **Next** fonctionne toujours.
- `abilities` : les valeurs d'attributs (`abilities`, toutes si la clé est omise), fixées par l'une des `methods` : `pointBuy` (un `budget` qui ne dépasse pas le coût d'achat de toutes les valeurs au maximum, et le coût de chaque valeur depuis la plus basse, où chaque valeur commence, en montant d'un cran à la fois ; une valeur saisie à la main part de la valeur la plus proche de la table), `standardArray` (une valeur pour chaque attribut), `roll` (`count` dés à `sides` faces, en gardant les `keep` plus hauts, lancés avec les propres dés du moteur, un jet par valeur, puis répartis comme un tableau) et `manual`. `manual: true` garde les bornes de valeur existantes ; `manual: { min, max }` (Capability API 1.110) ramène les valeurs de base saisies, avant les octrois, dans ces bornes entières, avec min au moins -100, max au plus 1000 et min au plus max, tandis que les bornes propres de chaque attribut limitent toujours le total. `default` (1.87) est la méthode par laquelle commence un personnage que l'assistant démarre depuis une fiche vierge (et qu'il garde, même si la méthode par défaut de l'ensemble change plus tard) : un débutant voit ainsi l'achat de points, par exemple, jusqu'à ce qu'il en choisisse une autre ; un personnage décrit ne la prend jamais, et ses valeurs restent telles quelles jusqu'à ce que le joueur choisisse une méthode après la description ; **Manual entry** (saisie manuelle) reste la modification saisie dans ses bornes, et **All fields** est toujours là. Ce que les sélections ajoutent vient par-dessus : l'étape affiche la base, le bonus, le total et le modificateur. Une seule étape d'attributs au plus.
- `allocate` (Capability API 1.152) : des points répartis par étapes, avec des attributions par priorité ou des budgets de groupe, décrits ci-dessous.
- `trained` : les choix de compétences et de sauvegardes que proposent les sélections, et le propre `choose: [{ "what": "skills", "count": 2, "from": [...] }]` de l'étape (n'importe lesquelles quand `from` est omis).
- `startingGear` : liste l'équipement de départ de l'ensemble. L'équipement se prend en partie, depuis l'inventaire, comme toujours.
- `choices` (Capability API 1.91) : `catalog` nomme un catalogue de lignes, et l'étape est l'endroit où l'on choisit les entrées que les sélections accordent à partir de lui (`grants.entries`, ci-dessous), comme une langue au choix.

Une étape d'équipement de départ peut porter `"strict": true` (Capability API 1.109). En mode légal uniquement, le mode par défaut, elle ne propose que l'équipement dont le `fits` vaut vrai sur la fiche telle qu'elle est, sans état vivant, plus l'équipement sans `fits` ; il n'y a pas de liste Other gear. Pour 5e, mets `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }` sur le kit Wizard et le champ de niveau de classe correspondant sur chaque autre kit de classe ; laisse `fits` de côté sur le kit Acolyte pour qu'il convienne à tout le monde. La modification libre propose de nouveau tous les kits. Le sélecteur d'inventaire efface une sélection qui ne convient plus après un changement de classe ou la sortie de la modification libre, et dit pourquoi ; il vérifie aussi que l'équipement convient avant de le prendre. S'il n'y a aucun équipement qui convient, l'étape affiche son état vide, et Next reste ouvert. Les étapes sans `strict` continuent de proposer tous les kits. Le mode est propre à chaque écran : il n'est ni enregistré avec une construction sauvegardée ni envoyé au serveur.

Ce que donne une sélection, ce sont les `grants` de son entrée, lus uniquement par l'assistant de création :

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add` ajoute aux valeurs ; `abilities.choose` permet au joueur de choisir `count` valeurs (jamais deux fois la même, jamais l'une de `except`) qui reçoivent chacune `amount`. Avec `"repeat": true` (Capability API 1.93), une même valeur peut être choisie plusieurs fois, `amount` à chaque fois : `{ "count": 2, "amount": 1, "repeat": true }` est donc le +2 à une valeur ou +1 à deux valeurs d'une amélioration de caractéristique ; l'étape affiche un moins à côté d'une valeur pour en retirer un. Dans les deux cas, aucune valeur ne dépasse son `max`. `upTo` (Capability API 1.96) plafonne ce à quoi le choix lui-même peut élever une valeur, après ce qu'ajoute chaque autre octroi : `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` est l'amélioration du SRD, qui "can't increase an ability score above 20" ; l'étape désactive une valeur qui l'a atteint. Le choix s'affiche à l'étape des attributs, ou là où l'entrée a été sélectionnée s'il n'y en a pas.
- `trained` entraîne des compétences et des sauvegardes, et propose des choix, affichés à la première étape d'entraînement ou là où l'entrée a été sélectionnée. Elles sont entraînées au `tier` de l'octroi, sinon au `tier` de l'assistant, sinon au premier niveau au-dessus de non entraîné que la fiche propose pour les compétences ou les sauvegardes. Un choix ne propose jamais ce que les sélections entraînent déjà à son niveau ou plus, directement ou par un choix antérieur (Capability API 1.104) : un historique qui entraîne Insight laisse le choix de compétences d'une classe aux autres, comme le demande le SRD. Un choix enregistré avant cette règle et qui la contredit ne compte plus, l'étape en demande donc un autre, et un choix qui n'a plus rien à proposer n'est pas affiché. Un choix peut indiquer `"held": "<tier>"` (Capability API 1.105) : il ne propose que ce que les sélections entraînent à ce niveau ou plus, ou ce qu'un choix inférieur à son propre niveau y maintient, comme l'Expertise de 5e porte sur deux compétences que tu maîtrises : `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`. `held` se classe en dessous du niveau auquel le choix entraîne.
- `sets` écrit des valeurs de champ : le dé de vie d'une classe, sa caractéristique d'incantation.
- Une entrée de catalogue peut indiquer quand une étape de l'assistant la propose : `offeredWhen` (Capability API 1.99) est une valeur lue sur la fiche telle qu'elle est, et l'entrée n'est proposée que tant qu'elle vaut plus de 0, comme 5e ne propose une seconde classe que lorsque ses prérequis de multiclassage sont remplis (une valeur dérivée par classe). Une sélection qui vaut ensuite 0 ne compte plus et est conservée, comme celles de `upTo`. Une entrée dont la propre sélection modifie ce que lit son `offeredWhen` (une valeur qu'elle augmente, un champ qu'elle fixe, une compétence qu'elle entraîne, une liste qu'elle écrit, directement ou par une valeur dérivée) est refusée, car elle se proposerait elle-même, se retirerait et se proposerait de nouveau. Une entrée qui a un groupe `exclusive` est lue sur la fiche sans aucune des sélections que l'étape a enregistrées dans ce groupe (Capability API 1.100), puisque la sélectionner les retire : un don pris à la place d'une amélioration de caractéristique et conditionné à une Force de 13 n'est pas proposé avec la Force donnée par cette amélioration. Un choix qu'une entrée accorde (`grants.entries.choose`) limite de la même façon ses options à leur `offeredWhen` (Capability API 1.106). Le sélecteur de catalogue de **All fields** propose toutes les entrées, comme toujours.
- Une entrée de catalogue peut nommer un groupe `exclusive` (Capability API 1.94) : une étape de l'assistant garde une sélection par groupe, si bien que sélectionner une entrée retire l'autre sélection de l'étape dans ce groupe, et seule la plus récente compte. Un don pris à la place d'une amélioration de caractéristique partage un groupe avec elle : `"exclusive": "fighter-asi-4"`.
- `entries` (Capability API 1.91) propose de choisir des entrées d'un autre catalogue de lignes : `{ "choose": [{ "catalog": "languages", "count": 1 }] }`, six choix au plus. `filters` fixe des valeurs des filtres de ce catalogue et `ids` liste les seules entrées proposées (`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). Elles sont choisies à l'étape `choices` de l'assistant pour ce catalogue (un octroi qui nomme un catalogue sans une telle étape est refusé), seules les entrées qui écrivent des lignes sont proposées et leurs lignes vont sur la fiche, et une entrée choisie pour un octroi n'est pas proposée pour un autre. Leurs propres octrois ne sont pas appliqués.
- Une sélection écrit aussi les `rows` de l'entrée, une seule fois. Une entrée peut porter des `grants` et aucun `rows` (une classe dont les aptitudes viennent d'un autre catalogue), et un catalogue dont toutes les entrées ne font qu'accorder n'a besoin d'aucun `feeds` ; le sélecteur de catalogue ne propose jamais de telles entrées.

Désélectionner reprend ce qu'une sélection a donné, et seulement cela : ses augmentations (dans la mesure où les bornes d'une valeur les ont laissées monter), son entraînement, ses valeurs de champ et ses lignes. Ce que la fiche avait déjà du joueur lui-même (une compétence entraînée à la main, une ligne ajoutée depuis le sélecteur de catalogue) lui reste, et une modification faite dans **All fields** reste jusqu'à ce que la réponse propre de l'assistant pour cette valeur change. Une entrée sélectionnée à deux étapes sur un même catalogue n'accorde qu'une fois, et une entrée que les couches d'une partie cachent compte toujours pour ce qu'elle a donné. Un champ qu'une sélection `sets` n'est écrit que tant qu'il est encore vide, ou que l'assistant en répond déjà, si bien qu'un niveau saisi à la main n'est jamais écrasé ; une valeur dont l'assistant répond et que le joueur modifie dans sa propre étape de champs reste celle de l'assistant, et disparaît quand une sélection ultérieure ne la demande plus. Les choix du joueur sont gardés à côté de la fiche, si bien qu'une étape peut être rouverte plus tard.

**Répartition de valeurs par étapes (Capability API 1.152).** Une étape `allocate` achète un point de valeur par point dépensé, avec son propre budget et ses plafonds de création. Elle ne change ni la méthode ni les réponses enregistrées de l'unique étape `abilities`. Utilise des étapes séparées pour les attributs, les Virtues et les points bonus ultérieurs :

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

Il y a de 1 à 12 groupes, chacun avec un `id` et un `label` stables et de 1 à 120 cibles. Les cibles sont distinctes dans toute l'étape. Une cible nomme exactement un `{ ability }`, un `{ field }` numérique, un `{ skill }`, un `{ save }` ou un `{ bonus }` existants ; un bonus est l'entrée numérique `build.bonuses` d'une compétence ou d'une sauvegarde existante. Les groupes utilisent exactement un mode de budget : `priorities` a une attribution entière positive ou nulle par groupe (doublons autorisés), ou **chaque** groupe déclare `budget: Ref`. Les emplacements de priorité sont attribués explicitement, et attribuer un emplacement occupé échange les groupes. L'ordre du tableau désigne la priorité primaire, secondaire, tertiaire, puis les priorités numérotées ; place les plus grosses attributions en premier si ces noms doivent suivre la taille. Les budgets ne dépassent pas 1 200 000 points.

`base` est facultatif ; `min` et `max` sont obligatoires. Chacun accepte un entier ou une `Ref` non vivante, comme `{ "derived": "archetype_floor" }`. Les valeurs doivent se résoudre en nombres entiers de 0 à 10 000 et tenir dans les bornes de stockage ou la table de niveaux de la cible. La première base remplace la valeur par défaut d'une cible vide, en gardant les valeurs de méthode et les octrois existants ; une base ultérieure est un plancher pour les étapes précédentes. Sans base, l'étape part de la valeur existante. Un min égal au max fixe la valeur de création : `base: 0, min: 0, max: 0` exprime une Appearance fixe. Les minimums n'achètent pas de points automatiquement. Les budgets et les bornes peuvent utiliser les opérateurs dérivés existants, mais ne peuvent pas lire les cibles modifiées par cette étape ou une étape ultérieure, même à travers des valeurs dérivées. Les conditions des octrois gratuits ne peuvent pas non plus lire les valeurs d'un groupe de répartition qu'elles peuvent modifier, y compris les groupes liés d'autres étapes. Les prix par formule ne sont pas pris en charge : chaque incrément payé coûte un point. Une source non résolue ou invalide est affichée comme **not configured**.

Les cibles de compétence et de sauvegarde nécessitent `sheet.builder.ratingTiers`, séparément pour chaque cible :

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

L'index du tableau est la valeur numérique. Les tables comptent de 1 à 12 identifiants de niveaux existants, proposés et croissants, en commençant par le niveau non entraîné de l'ensemble ; elles ne sont jamais déduites des bonus de niveau. Des cibles différentes peuvent utiliser des tables différentes. Place les cibles aux plafonds de création différents dans des groupes séparés.

Les `grants.ratings` d'un catalogue fournissent des points gratuits, avant **toutes** les étapes payantes :

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

Chaque octroi a soit un `add` positif, soit un `set` positif ou nul, jamais les deux. Tous les octrois `set` sont des planchers : le plus élevé l'emporte, puis tous les ajouts se cumulent, en s'arrêtant à la limite de stockage de la cible. Deux ajouts gratuits d'un rang atteignent donc le rang deux, sans entamer le budget payant. L'entraînement existant et les octrois de champ ou d'attribut se combinent avant ces octrois de valeur. Les choix d'entrées n'écrivent toujours que des lignes ; ils n'appliquent jamais récursivement les octrois de l'entrée choisie.

L'interface affiche les valeurs de base/précédentes, gratuites, achetées et totales, la plage de création et le budget restant. Le bouton plus est désactivé à un plafond, sans budget, ou tant que des achats invalides ou des remplacements manuels demandent ton attention. La sous-dépense, les minimums impossibles et les remplacements reçoivent des badges ; Back et Next restent disponibles. Réattribuer une priorité conserve les incréments enregistrés du groupe. Un groupe en dépassement devient inactif en entier ; un achat au-dessus du plafond de sa cible devient inactif pour cette cible. Réduis ou efface ces réponses pour les réparer, ou rétablis l'attribution antérieure pour les réactiver. Les étapes ultérieures peuvent dépasser les plafonds de création antérieurs. **All fields** reste la modification libre, avec les remplacements affichés explicitement plutôt que ramenés aux règles de création.

Le `builder.allocations[stepId]` enregistré contient les index d'emplacements de priorité par identifiant de groupe, les incréments payés `bought` et des `notes` facultatives par clés de cible `kind/id` stables (par exemple `ability/strength`). `annotations: true` propose jusqu'à 1 000 caractères par cible pour expliquer un héritage ou des spécialités ; l'assistant ne juge pas ce texte. Les incréments appliqués appartiennent séparément à chaque étape. Rouvrir n'accorde jamais de nouveau les octrois et ne remplit jamais les ressources, et décrire une fiche existante enregistre les choix sans la réécrire, y compris à la fin de la description. Désélectionner recalcule les valeurs gratuites et les étapes payantes en préservant les différences manuelles.

**Budgets partagés et achats à prix (Capability API 1.153).** Déclare jusqu'à 12 réserves de création dans `sheet.builder.pools`. Plusieurs étapes `spend` peuvent utiliser une même réserve ; des réserves séparées gardent indépendants les points d'occupation et ceux d'intérêt personnel. Les budgets sont des références de valeur non vivantes, y compris les calculs existants `sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable` et `listSum`. Leur valeur résolue doit être finie et comprise entre 0 et 100 000. Une source absente est affichée comme "not configured".

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

Chaque étape a jusqu'à 120 offres avec un `id` et un `label` stables. Les cibles utilisent le même contrat à cible unique que les étapes de répartition : `ability`, `field` numérique, `skill`/`save` avec table, ou `bonus`. Les achats de lignes de liste sont réservés à la fonctionnalité d'identité des lignes (F4) ; cette API n'identifie pas les lignes par leur position dans le tableau. Les bornes doivent tenir dans les bornes de stockage de la cible. Les valeurs de départ et les octrois gratuits sont préservés, jamais facturés à nouveau : un Background avec deux points gratuits et cinq points payés en a sept.

Un coût est exactement l'un des suivants :

- `{ "flat": 1 }` : un point par incrément de valeur.
- `{ "perRank": 5 }` : cinq fois le rang suivant ; passer de 2 à 3 coûte donc 15.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }` : des prix cumulés à des valeurs croissantes. L'achat suivant passe à la valeur adjacente et coûte la différence (5, puis 7 ici). Les valeurs fractionnaires nécessitent un champ numérique non entier ; les tables incluent les deux bornes de l'offre.

Le `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]` facultatif contient au plus 12 entrées. La première condition positive l'emporte. Les conditions lisent la fiche avant les achats ; sans correspondance, le prix de base s'applique. Les budgets et les conditions ne peuvent pas lire les cibles achetées, y compris à travers des valeurs dérivées, ni dépendre de choix ultérieurs. Les octrois gratuits et les étapes de répartition sont appliqués avant les achats à prix.

Les prix ont des marges positives, sauf les crédits explicitement déclarés. Pour un défaut dont la valeur augmente, utilise `"credit": true, "cost": { "flat": -1 }`. Pour une réduction depuis une valeur de référence déclarée, utilise `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }` : un achat fait passer 10 à 9 et enregistre un crédit d'un point. La valeur de départ doit correspondre à la référence. Une cible à crédit n'a qu'une seule offre dans tout l'assistant, ce qui empêche les cycles achat/crédit.

Les réserves n'accordent aucun crédit par défaut. Règle `creditLimit` sur le crédit total maximal et ajoute éventuellement jusqu'à 12 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`. Les filtres nomment les `tags: ["flaw"]` des offres : les crédits de défauts et de désavantages peuvent ainsi avoir des plafonds séparés. Les plafonds comptent les crédits bruts, indépendamment des dépenses positives. Les nombres distincts de travers restent des contraintes de choix ou de lignes.

**Lignes comptées et lignes qui correspondent (Capability API 1.205).** Un `listSum` peut porter `where: { "column", "equals" }` pour ne lire que les lignes dont la cellule est égale à une valeur (une cellule vide se lit comme la valeur par défaut de sa colonne), et `count: true` à la place de `column` pour compter les lignes au lieu d'additionner une colonne. La pyramide de talents de Genesys, ce sont deux comptes dérivés et une règle de création :

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

avec une règle dont la `value` lit `tier2` et dont le `max` lit le compte du rang 1 moins un.

**Prix de ligne calculés ligne par ligne (Capability API 1.206).** Le `cost` objet d'une étape de lignes peut multiplier sa `column` par `times` et ajouter `add` : `{ "column": "tier", "times": 5 }` fixe ainsi le prix d'un talent de Genesys à 5 XP par rang ; `add` seul est un prix fixe écrit sous forme d'objet. `overrides` (jusqu'à 4) donne un prix utilisé à la place quand une valeur dérivée nommée par un préfixe et par la cellule propre de la ligne vaut plus de 0 sur la fiche : `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }` fixe le prix d'un Charm d'Exalted à 4 Bonus Points quand `affinity_<its Ability>` vaut plus de 0. Une cellule enum doit avoir une valeur dérivée pour chaque valeur qu'elle peut contenir.

**Offres sans prix (Capability API 1.207).** Le `cost` d'une offre de dépense (ou celui d'un remplacement) peut être `{ "unpriced": true }` tant que la source n'a pas fourni le prix : l'offre s'affiche avec une note, retient la réserve sans rien lui coûter et n'est jamais achetée. Un achat enregistré sous un prix qui devient ensuite sans prix devient inactif et est conservé pour être réparé.

**Plus de champs (Capability API 1.208).** Une fiche peut déclarer jusqu'à 240 champs ; avant 1.208, le plafond est de 160. Les rangs de compétence, rangs de catégorie, potentiels et totaux de Rolemaster ont besoin de cette place.

**Jets écrits dans un attribut (Capability API 1.209).** Le jet d'une étape `roll` peut nommer `ability` au lieu de `field` (exactement l'un des deux). Le résultat est maintenu dans les bornes propres de l'attribut. Avec `gain`, le test est lancé contre la valeur et seul un résultat supérieur ajoute le gain, que l'assistant garde ensuite comme augmentation : relancer ou racheter la valeur conserve l'amélioration par-dessus. Sans `gain`, le résultat est écrit comme une valeur saisie, conservée jusqu'à ce que la réponse propre de l'assistant pour cette valeur change. Un attribut calculé ne peut pas être lancé, et chaque attribut est lancé au plus une fois par étape.

**Colonnes de liste calculées (Capability API 1.210).** Une colonne numérique peut nommer `sum` : jusqu'à six autres colonnes numériques de la même ligne, additionnées (une cellule vide se lit comme la valeur par défaut de sa colonne) et maintenues entre le `min` et le `max` de la colonne. La cellule s'affiche en lecture seule, est remplie à chaque lecture d'une fiche enregistrée, et est lue par les sommes, les tests de ligne et tout le reste comme une cellule saisie. Une colonne calculée n'est pas lancée et n'additionne jamais une autre colonne calculée. La valeur d'une spécialité de CoC s'écrit `"sum": ["base", "occupation", "interest"]`.

**Augmentations partielles de valeur (Capability API 1.211).** Le `abilities.choose` d'un octroi peut nommer `partialFrom`. Une valeur déjà égale ou supérieure à ce seuil au moment du choix reçoit une augmentation partielle, et deux augmentations partielles donnent `amount` une fois. Les choix comptent dans l'ordre où l'assistant les fait, après chaque augmentation entière : les boosts ultérieurs de Pathfinder 2e s'écrivent donc `"amount": 1, "partialFrom": 4`, et un modificateur de +4 a besoin de deux boosts pour atteindre +5. Cela se combine avec `upTo`.

**Tests de ligne dans une posture (Capability API 1.212).** L'entrée `checks[]` d'une liste peut nommer `stance`, l'une des `resolution.stances` de la réserve de dés. Le test de chaque ligne se fait alors dans cette posture, comme pour une compétence que la posture liste : les occupations de Stewpot comptent les dés à la manière STILLNESS. Le rappel du Game Master nomme les lignes avec les compétences de la posture.

**Spécialités d'attribut (Capability API 1.213).** Le `contextual` d'une liste peut fixer `"abilities": true`. Sa cellule `skill` peut alors nommer un attribut (par identifiant, libellé ou forme courte) aussi bien qu'une compétence, et la ligne s'applique à tout test lancé avec cet attribut : un test d'attribut brut, une compétence dont c'est l'attribut propre, ou une compétence que `with=` fait passer à cet attribut. Une spécialité d'attribut de World of Darkness, "Strength: lifting", est une ligne nommée "lifting" dont la cellule de compétence indique "Strength".

**Annulation désactivée (Capability API 1.214).** Un `check` contextuel (sur le `contextual` d'une liste ou le `mechanics.contextual` d'une entrée) peut fixer `"cancel": false`. Sur un jet auquel il s'applique, les faces égales ou inférieures à `resolution.cancel.upTo` ne retirent aucune réussite ; une maladresse les lit toujours. L'ensemble doit avoir un `resolution.cancel` à désactiver.

**Des objets accessibles sans les porter (Capability API 1.215).** Le `grants.itemAccess` d'une entrée de catalogue liste jusqu'à 48 objets de l'ensemble (`<catalog>/<entry>`, jamais un service). Sélectionner l'entrée dans l'assistant de création guidée les ouvre au personnage : la fiche et le bloc de fiche du Game Master les listent comme non portés, et rien ne va dans le sac. Le Game Master en ajoute un à l'inventaire quand il est pris, comme un personnage de Blades déclare sa charge au début d'un coup.

**Points de ligne à la création (Capability API 1.216).** Un groupe `allocate` peut nommer `rows`, jusqu'à quatre paires `{list, column}` : les points de cette colonne numérique dans les lignes de la liste comptent dans le budget du groupe à côté de ses cibles. Les lignes se modifient sur la liste ; un groupe qui a plus de points de ligne que son budget attend le joueur. Le remplacement de coût d'une étape de lignes peut donner `times`, un tarif unitaire pour la colonne de coût, à la place d'un `cost` fixe. Les lignes Craft d'Exalted comptent les "dots" dans les 28 points d'Ability et fixent le prix des points "bought" à `times: 2`, remplacé par `times: 1` là où `affinity_<ability>` est défini ; une colonne de valeur calculée (1.210) additionne les deux.

**La meilleure valeur (Capability API 1.217).** Un `check` contextuel peut fixer `"best": true` : un test de compétence auquel il s'applique lance la meilleure valeur de compétence du personnage quand elle est supérieure à celle demandée. Un ensemble `dice-highest` peut utiliser un test contextuel qui ne fait que cela ; tout autre effet de test nécessite toujours une réserve de dés. Le Rook's Gambit de Blades est une ligne de capacité spéciale avec `"check": {"best": true}`, appliquée par son nom.

**Des coûts qui marquent une piste (Capability API 1.218).** Une entrée `cost` contextuelle peut être `{"track": "<id>", "by": N}` aussi bien que `{"pool", "amount"}` : appliquer la ligne ou l'entrée marque cette piste vivante ordinaire de N, dans la mesure où ses bornes le permettent (une piste de blessures ne se marque pas ainsi). Le `contextual` d'une liste peut aussi porter un `cost`. Le Rook's Gambit de Blades est une ligne avec `"check": {"best": true}` et `"cost": [{"track": "stress", "by": 2}]`. Les noms appliqués par `apply=` lisent de la même façon les apostrophes et guillemets courbes ou droits.

**Catalogues empruntés (Capability API 1.220).** Un catalogue peut emprunter le catalogue d'un autre ensemble installé au lieu de porter le sien : `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`. Le prêteur est trouvé par son identifiant, seul ou sous un espace de noms communautaire, et ses entrées sont lues par rapport à l'ensemble emprunteur : une entrée qui nomme quelque chose que l'emprunteur ne déclare pas (un état, un palier de menace, un sens) est laissée de côté et consignée, tandis que les autres passent. Les `entries` à côté de `from` s'ajoutent aux entrées empruntées, ou remplacent celle du même identifiant ; elles sont vérifiées à la lecture de l'ensemble : l'en-tête nomme donc tous les `filters` qu'elles portent (un en-tête qui n'en a pas prend ceux du prêteur). Une créature empruntée écrite comme une fiche utilise les identifiants du prêteur ; `from.sheet` indique comment ils se lisent chez l'emprunteur : `fields` associe un champ à un autre identifiant (ou `null` pour l'écarter), `values` associe les valeurs d'un champ, et `tiers` associe des niveaux d'entraînement (ceux d'une créature, et ceux qu'une entrée accorde ou demande), comme dans `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`. Toute entrée empruntée, objets compris, peut en prendre deux de plus : `refs` lit une valeur dérivée du prêteur comme l'une des valeurs de l'emprunteur (`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), et `slots` place l'emplacement d'un objet sous le nom de l'emprunteur (`"slots": { "body": "armor" }`). Un catalogue ne peut emprunter ni à son propre ensemble ni à un catalogue qui emprunte lui-même. L'illustration d'une créature empruntée est associée comme celle du prêteur (`5e-2014/creatures/<id>` dans un pack de créatures). Les références vers un catalogue emprunté, comme les sorts d'une créature, sont vérifiées à la lecture du catalogue, pas à celle de l'ensemble.

**Listes de progression plus longues (Capability API 1.219).** `sheet.advancement.fields` accepte jusqu'à 64 champs (24 auparavant) : un jeu où un niveau augmente de nombreux champs, comme les emplacements de chaque niveau de sort et les listes de maîtrises, peut ainsi laisser le GM les augmenter tous. Une liste de plus de 24 champs nécessite 1.219.

**Achats dans les deux sens, possédés et échangés (Capability API 1.164).** `"direction": "both"` permet à une même offre d'augmenter et de baisser sa valeur depuis son point de départ (sa `baseline`, quand elle est déclarée, doit correspondre à la fiche) : chaque cran vers le haut coûte le prix de la courbe et chaque cran vers le bas au-delà du départ le rapporte en crédit, dans la limite du `creditLimit` et des plafonds de la réserve. Le livre de comptes ne va jamais que dans un sens : baisser une valeur achetée reprend le dernier achat au prix payé, et augmenter une valeur baissée rembourse son crédit ; acheter puis baisser ne crée jamais de crédit. Une telle cible a une seule offre dans tout l'assistant. La ST de GURPS s'écrit `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14, "cost": { "flat": 10 } }` ; un coût en table fixe le prix de crans fractionnaires comme Basic Speed. `"direction": "increase"` et `"decrease"` désignent explicitement une offre à sens unique (`"decrease"` est la réduction ci-dessus, avec sa référence et son crédit).

`"effect": "ownership"` fixe le prix d'une offre sur sa propre échelle, à partir de sa `baseline` (ou de son `min`) vers le haut, et la fiche garde la plus élevée de sa propre valeur et du niveau acheté : une familiarité GURPS d'un point est payée et listée même quand une valeur par défaut est déjà meilleure, et la rembourser ne coûte rien à la fiche.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` fait d'une offre un échange de création fermé : chaque achat baisse `from` de `units` et augmente la cible de `gain` (1 par défaut), sans jamais faire descendre `from` sous `floor` ni la cible au-delà de `max`. Il ne coûte rien à la réserve et laisse donc `cost` de côté. Les points échangés ne sont jamais échangés à nouveau : une fois qu'un échange a augmenté une valeur, aucun autre échange ne la baisse, et une fois qu'un échange a baissé une valeur, aucun autre échange ne l'augmente. Les échanges qu'une classe ne peut pas faire (`when`) peuvent nommer les mêmes valeurs dans l'autre sens. Un remboursement rétablit les deux valeurs. L'échange de caractéristique principale d'OSE, c'est une offre par valeur baissée :

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

L'assistant enregistre les écarts payés signés et leurs prix d'origine sous des identifiants d'étape et d'offre stables, avec au plus 1 000 lignes d'achat par offre. Le remboursement retire la dernière ligne et annule exactement sa contribution et son prix enregistré, y compris en retirant un crédit. Il ne rembourse jamais une valeur gratuite. Aucun XP vivant, inventaire, monnaie ou ressource d'équipe n'est dépensé.

Changer de carrière, d'octrois gratuits ou de sources de budget conserve le livre de comptes. Les achats invalides sont inactifs ; la réserve affiche sa dépense d'origine, des points restants négatifs en cas de dépassement, et le nouveau prix proposé. Les cibles partagées suspendent aussi les achats dépendants dans d'autres réserves. **Reprice saved purchases** (recalculer le prix des achats enregistrés) accepte explicitement un nouveau prix légal pour la réserve ; sinon, rembourse des lignes pour la réparer. Aucun achat n'est supprimé ou vendu silencieusement. Les points non dépensés sont indicatifs. Back et Next restent disponibles, et **All fields** préserve les remplacements manuels visibles dans les bornes du schéma. Décrire un personnage existant et rouvrir des choix enregistrés n'accorde jamais de points une seconde fois.

**Lignes nommées (Capability API 1.154).** Une étape `rows` permet au joueur d'ajouter, de modifier et de supprimer ses propres lignes dans l'une des listes de la fiche pendant la création : des serviteurs, des contacts, des rituels et leurs ingrédients, ou tout ce qu'un catalogue ne liste pas.

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns` est le sous-ensemble des colonnes de la liste que l'étape modifie (toutes si la clé est omise). `required` nomme les colonnes qu'une ligne doit remplir pour compter. Le badge compte les lignes entières qui manquent encore sous `min` (de 0 à 20), plus chaque ligne dont une cellule obligatoire est vide : un ingrédient à moitié écrit reste ainsi non résolu. `max` arrête **Add a row** (ajouter une ligne) et ne dépasse jamais le `maxItems` de la liste. Une nouvelle ligne part des valeurs par défaut des colonnes, puis de `defaults`, qui doit convenir à chaque colonne.

L'étape modifie la liste là où se trouve chaque ligne : deux serviteurs du même nom restent deux lignes, et en supprimer un garde l'autre. Les lignes écrites par la sélection d'un catalogue s'affichent en lecture seule avec une note "Added by a pick" et vont et viennent avec la sélection. **All fields** modifie chaque ligne comme avant.

**Offres conditionnelles, bornes lues sur la fiche et règles de création (Capability API 1.155).** Une offre de dépense peut aussi porter :

- `when: Ref` : proposée seulement tant qu'il vaut plus de 0 sur la fiche avant les achats, comme les compétences propres à une occupation ou un Background qu'une tribu peut prendre. Une offre jamais achetée laisse la réserve telle quelle ; les achats enregistrés sur une offre que le personnage ne peut plus prendre restent, inactifs, pour être réparés.
- `minFrom: Ref` et `maxFrom: Ref` : un plancher et un plafond lus sur la fiche, maintenus dans `min` et `max`. Credit Rating prend la plage de son occupation ; Dodge s'arrête à DEX. Une valeur sous le plancher est achetée jusqu'à lui en un seul achat.
- `allowedRatings: number[]` : les seules valeurs auxquelles un achat peut aboutir, comme un Merit vendu à 1, 3 ou 5 points. Chaque achat va directement à la valeur autorisée suivante, au prix de la courbe.

Comme les budgets et les remplacements, ils ne peuvent pas lire une cible achetée. Un choix d'entraînement avec `onDuplicate: "replace"` peut nommer `replacementFrom`, les compétences (ou sauvegardes) par lesquelles un doublon peut être remplacé, à la place de toutes celles que la fiche possède ; cela vaut pour ce qui est affiché, enregistré et appliqué.

`sheet.builder.constraints` contient jusqu'à 40 règles de création. Chacune nomme le `step` dont le badge la porte et le `label` qui y est affiché tant qu'elle échoue, un `when: Ref` facultatif, et exactement l'un des éléments suivants :

- `value: Ref` avec `min` et/ou `max` (chacun un nombre ou une Ref).
- `rows: { list, filter?, sum? }` avec `min` et/ou `max` : le nombre de lignes de la liste, ou le total de la colonne numérique `sum`, sur les lignes que `filter` garde (`{ column, equals?, below?, above? }`).
- `distinct: { list, column }` : deux lignes ne partagent jamais une valeur remplie (sans tenir compte de la casse ni des espaces).
- `approved: fieldId` : un champ booléen qui doit être activé, comme l'approbation d'un Storyteller.

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

Une règle non respectée ne bloque jamais Back, Next ni **All fields**.

**Valeurs calculées et effets appliqués à un seul jet (Capability API 1.156).** Un attribut peut porter `value: Ref[]` (de 1 à 8) : sa valeur est la somme de celles-ci, maintenue entre son `min` et son `max`, et affichée en lecture seule. Un attribut de Blades est la somme de ses actions marquées ; la Perception de GURPS s'écrit `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`, et les compétences qui se lancent avec elle suivent ce qui a été acheté. Les valeurs dérivées, les plafonds et les compétences peuvent lire une valeur calculée, mais aucune valeur calculée ne peut en lire une autre, même à travers une valeur dérivée. L'assistant n'en fixe jamais, et tout ce qui est stocké pour elle est ignoré.

Une liste peut déclarer `contextual` pour que ses lignes s'appliquent à un jet quand le Game Master les nomme :

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name` est la colonne par laquelle le Game Master nomme une ligne. `skill` (facultatif) contient la compétence à laquelle une ligne s'applique, par identifiant ou libellé ; une cellule vide s'applique à tout test. `bonus` (une colonne numérique) et `dice` (une colonne de dés) s'ajoutent au test, sous forme de dés sur un ensemble à réserves. `to: "saves"` applique plutôt les lignes aux sauvegardes. Sur un ensemble à réserves, `check: { dice?, successes?, double?, explode? }` donne à chaque ligne appliquée le même effet sur la réserve, comme une spécialité dont les 10 explosent.

Une entrée de catalogue peut porter `mechanics.contextual` avec des `effects` (`own-checks-advantage` et les autres effets de test et de sauvegarde), des `modifiers` sur `checks` ou `saves`, des `skills` et `saves` qui les restreignent, un effet `check` de réserve, et `cost: [{ "pool": "...", "amount": 1 }]`, payé une fois sur le jet auquel elle s'applique. Le Game Master écrit `apply="Strong Back; Quick Eye"` (jusqu'à quatre noms) sur un test. Seuls les noms qui s'appliquent à ce test le modifient : une ligne pour une autre compétence, un nom partagé par deux lignes et un coût que la réserve ne peut pas couvrir ne changent rien. Posséder une ligne ne modifie jamais un jet à lui seul. Le registre liste ce qui s'est appliqué dans `from`.

**Pièces de départ lancées ou lues sur la fiche (Capability API 1.157).** Une ligne de pièces d'équipement de départ peut porter `roll` (des dés comme `"2d6"`) ou `countFrom` (une Ref lue sur la fiche du porteur) à la place de `count`, jamais les deux, et `times` (de 1 à 10000) multiplie l'un ou l'autre :

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

Le sélecteur affiche les dés ("5d4 gold, rolled when taken"). Le jet a lieu une seule fois, quand le groupe ou le porteur prend le paquetage : rouvrir le sélecteur ne peut donc pas le relancer. `countFrom` lit la propre fiche du porteur, comme un champ Credit Rating ; un porteur sans fiche est refusé, et un montant de 0 n'ajoute rien. Les lignes d'objets gardent leur `count` fixe.

**Valeurs de départ fixées une fois (Capability API 1.158).** Une étape d'assistant de `kind: "initialize"` écrit des valeurs de départ quand le joueur les confirme, et plus jamais d'elle-même :

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

Chaque écriture nomme un champ de la fiche et soit une `value` (une valeur fixe, ou une Ref pour un champ numérique), soit `remaining`, ce qu'une réserve de l'assistant n'a pas dépensé. L'étape affiche la valeur actuelle de chaque champ et celle qu'il recevra ; son badge attend que le joueur les fixe. Les valeurs écrites sont enregistrées avec l'assistant : rouvrir celui-ci, importer le personnage ou changer POW plus tard ne les écrit donc jamais à nouveau. Si la fiche a changé depuis, l'étape montre ce que fixer à nouveau remplacerait, et seul le bouton **Set again** (fixer à nouveau), actionné par le joueur, le fait. Un personnage décrit tel qu'il est déjà n'est jamais modifié.

Une réserve vivante peut déclarer `startFrom: Ref` pour commencer à une valeur lue sur la fiche au lieu de pleine ou vide, maintenue entre 0 et son maximum, et une piste ordinaire peut déclarer `startFrom` à la place de `default`. Pointée vers un champ qu'une étape d'initialisation a écrit, SAN commence au POW à partir duquel elle a été fixée et reste là où le jeu la laisse : une valeur vivante stockée l'emporte toujours sur le point de départ de la réserve.

**Sélections et lignes à prix (Capability API 1.159).** Une étape de catalogue ou une étape de lignes peut nommer un `pool` de l'assistant et un `cost`, si bien que ce que le joueur sélectionne ou écrit est payé sur la même réserve que les étapes de dépense. Le coût d'une étape de catalogue est un nombre ou `{ "filter": "tier" }`, le filtre numérique propre de l'entrée. Le coût d'une étape de lignes est un nombre ou `{ "column": "cost" }`, lu sur chaque ligne ; un prix négatif est un crédit, dans la limite du `creditLimit` de la réserve : un défaut finance ainsi des traits. Une étape de lignes peut aussi nommer `from`, un catalogue de lignes qui alimente sa liste : le joueur ajoute une copie de la ligne d'une entrée aussi souvent qu'il le veut, et chaque copie est sa propre ligne, payée et supprimée séparément :

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

Une sélection que la réserve ne peut pas payer n'est pas proposée. Les sélections et lignes à prix sont payées en premier et ne sont jamais vendues à la place du joueur : quand retirer un défaut met la réserve en dépassement, les achats des étapes de dépense cessent de s'appliquer jusqu'à ce que le joueur répare, et le badge de chaque étape à prix compte la réparation. Un total qu'une colonne ne peut pas dépasser (les niveaux de Rite) est une règle de création (1.155) avec `rows.sum` et `max`.

**Profils de création et phases antérieures (Capability API 1.160).** `sheet.builder.profiles` (jusqu'à 16) permet à un type de personnage, une carrière ou un paquetage d'apporter ses propres étapes et budgets :

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

Le premier profil dont le `when` vaut plus de 0 est celui du personnage, et l'assistant indique lequel. Une étape listée par un profil n'est affichée que tant qu'un profil qui la liste est celui du personnage ; ses réponses sont conservées tant qu'elle est cachée et n'accordent rien. Les `budgets` d'un profil remplacent ceux de ces réserves : changer de type ne garde donc jamais le budget de l'autre type, et les achats qu'il ne couvre plus cessent de s'appliquer jusqu'à ce que le joueur les répare.

Une étape de catalogue ou une étape d'initialisation peut déclarer `reads: { "before": "step_id" }`. Le `offeredWhen` de ses entrées et son `upTo` (ou les valeurs de l'étape d'initialisation) lisent alors la fiche telle que la font les étapes qui précèdent cette étape : tout ce que les étapes ultérieures ont sélectionné, accordé ou acheté est repris, et ce que le joueur a saisi est conservé. Une étape de multiclassage lit les valeurs d'attributs avant l'amélioration de ce niveau ; un instantané d'Humanity lit les Virtues avant les points bonus, quels que soient les allers-retours du joueur entre les étapes.

**Des lignes qui sont des tests à part entière (Capability API 1.161).** Une liste peut déclarer jusqu'à quatre `checks`, pour que chaque ligne écrite par le joueur soit un test que le Game Master peut demander par son nom :

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` est la colonne de texte par laquelle une ligne est appelée et `rating` la colonne numérique qui est sa valeur ; `ability` (facultatif) s'ajoute comme l'attribut d'une compétence. Science (Physics) et Science (Biology) sont deux lignes et deux tests, chacun avec sa propre valeur. Deux tests sur une même liste sont deux postures appuyées sur une même valeur, chacune avec un `label` que le Game Master dit après le nom de la ligne : "Fire stew (bold)" et "Fire stew (careful)". Les propres compétences, sauvegardes et attributs de la fiche sont reconnus en premier. Un nom partagé par deux lignes n'est pas un test du tout tant que l'une n'est pas renommée, et le test d'une ligne supprimée disparaît avec elle. Le bloc de fiche du Game Master liste chaque test de ligne avec son nombre, et `with=` fonctionne comme sur une compétence. Une étape de lignes dont le prix est fixé par la colonne de valeur (1.159) achète les valeurs sur la réserve de création.

**Jets de création conservés avec leurs dés (Capability API 1.162).** Les dés de création s'écrivent `{ "count", "sides", "keep"?, "add"?, "multiplier"? }` : les `keep` faces les plus hautes, plus `add`, fois `multiplier` ; le `(2d6+6) x 5` de CoC s'écrit donc `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`.

Le `methods.rolls` d'une étape d'attributs lance chaque valeur dans l'ordre, chacune avec les dés de son propre groupe, et ne laisse jamais un jet passer à une autre valeur (méthode `"rolls"`) :

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

Une étape de `kind: "roll"` liste jusqu'à 12 `rolls`, chacun écrit dans un `field` numérique : Luck, points de vie, argent de départ. `best` (2 ou 3) lance autant de fois et garde le meilleur ; `floor` (un nombre ou une Ref) est le minimum que le résultat peut valoir, comme 1 point de vie ou un potentiel jamais inférieur à sa caractéristique ; `gain` en fait plutôt un test d'amélioration, lancé contre le champ et qui n'ajoute `gain` que si le jet le dépasse, comme l'amélioration d'EDU de CoC. Chaque jet est conservé avec ses faces et affiché avec elles. Un jet déjà fait est maintenu ; rouvrir l'assistant ne relance jamais, et seule une étape avec `retry: true` propose de le faire. On ne lance jamais de dés pour un personnage en cours de description.

**Choix comptés et contraintes de création (Capability API 1.151).** Chaque étape peut porter `when: Ref` (l'afficher et l'appliquer seulement tant que la valeur non vivante de la fiche est supérieure à zéro) et `requiredWhen: Ref` (compter les choix inachevés dans son badge seulement tant qu'elle est supérieure à zéro). Les étapes cachées gardent leurs réponses enregistrées. Next et Back restent disponibles même avec des choix incomplets ou invalides ; All fields reste la modification libre.

Les étapes de catalogue peuvent déclarer jusqu'à 12 `quotas`, chacun utilisant l'un des filtres typés du catalogue :

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

C'est une pyramide à la Fate quand le catalogue propose chaque compétence à chaque valeur. Les entrées déclarent leurs octrois d'entraînement avec des identifiants de niveau d'entraînement explicites ; les valeurs numériques des filtres n'inventent jamais de correspondance de niveaux. Un quota a `0 <= min <= max <=` le maximum de l'étape. Les minimums affectent le badge ; les maximums désactivent les sélections correspondantes supplémentaires. `distinctBy` nomme un filtre existant : les sélections ne peuvent pas partager sa valeur (ni aucun tag pour un filtre de tags), et une entrée sans ce filtre ne peut pas compter. Sinon, la distinction se fait par identifiant d'entrée. `quotaBelow: { "filter": "tier" }` exige **strictement plus** de sélections actives au rang n−1 qu'au rang n pour les rangs entiers positifs supérieurs à 1. Le rang 1 est la base. Retirer une sélection qui sert d'appui rend inactives les sélections supérieures en excès, ce qui reprend leurs octrois tout en gardant leurs réponses pour réparation.

Les emplacements `abilities.choose`, `trained.choose`, `choose` d'étape d'entraînement et `entries.choose` acceptent :

- `id` : un identifiant de fiche stable. Les nouveaux emplacements devraient l'utiliser ; les réponses enregistrées survivent alors à un réordonnancement. Les anciens emplacements sans identifiant gardent leurs clés de position. Les identifiants sont uniques parmi tous les choix proposés par une étape source.
- `countFrom: Ref`, avec un `max` explicite (de 1 à 20, au plus 6 pour les attributs). `count` reste le nombre fixe en l'absence de `countFrom`. Un nombre dynamique est arrondi vers le bas et borné entre zéro et `max`. Il lit les opérateurs dérivés existants, jamais des expressions exécutables.
- `excludeChoices: ["background/restricted"]` : identifiants de choix antérieurs du même genre, écrits `source_step/choice_id`. Ils excluent les réponses actives du choix antérieur, remplacements compris. Les références doivent pouvoir être vérifiées dans la définition ou dans le même fichier de catalogue. Des choix d'octroi antérieurs intégrés ou des étapes d'entraînement explicites peuvent donc alimenter un fichier de catalogue ultérieur ; les références vers un autre fichier de catalogue externe sont refusées. Les identifiants de choix des entrées alternatives d'une même étape doivent aussi être uniques.

Les choix d'attributs acceptent en plus `from`, croisé avec les attributs de la fiche et `except`. Pour des boosts PF2e distincts, un choix `restricted` peut proposer `["str", "dex"]`, suivi d'un choix `free_boost` qui exclut `background/restricted`. Les choix d'entrées acceptent les mêmes `quotas`, `distinctBy` et `quotaBelow` que les étapes de catalogue, bornés par `max` ou `count` ; ils écrivent toujours des lignes sans appliquer les octrois propres des entrées choisies.

Les choix d'entraînement acceptent en plus `tier` (un niveau proposé au-dessus de non entraîné, qui remplace celui de l'octroi ou de l'assistant), `only: "any" | "trained" | "untrained"` et `onDuplicate: "replace"`. L'admissibilité lit l'entraînement manuel et les octrois actifs antérieurs, en excluant les écritures précédentes de l'assistant lui-même. Une compétence choisie déjà entraînée par ces sources ouvre un emplacement de remplacement séparé parmi les compétences non entraînées du même genre, en gardant la réponse d'origine. Les remplacements respectent les exclusions et le niveau du choix. Leur clé enregistrée est la clé de l'emplacement d'origine suivie de `/replacement`. Les rangs hors carrière d'un Human peuvent exclure un choix de carrière antérieur et utiliser `only: "untrained"` ; changer de carrière conserve les réponses ultérieures invalides.

Les conditions et les nouveaux nombres d'emplacements ne peuvent lire que des valeurs modifiées par des étapes antérieures, ce qui empêche les octrois qui s'activent eux-mêmes ou cycliques. Un nombre d'emplacements ne peut pas lire de valeurs de la fiche quand un fichier de catalogue externe ultérieur pourrait les modifier ; déplace son étape source plus tôt ou garde ce catalogue intégré. Une condition peut utiliser un `enumTable` dérivé existant pour rendre une étape de sous-race obligatoire pour une seule ascendance. `requiredWhen` n'affecte que les badges et peut lire n'importe quelle valeur non vivante valide. Les nouveaux choix contraints restent non résolus quand le contenu admissible manque, avec une explication "not configured". Ils ne réduisent jamais silencieusement leur nombre obligatoire au contenu disponible. Les modifications manuelles de la fiche et les personnages décrits gardent les règles de propriété existantes de l'assistant.

Un personnage créé sans l'assistant (une fiche qui n'est pas vierge et n'a encore aucun choix d'assistant) s'ouvre **décrit** : les sélections enregistrent ce qu'est déjà le personnage (les augmentations de sa race sont considérées comme déjà comprises dans ses valeurs) et ne changent rien sur la fiche, jusqu'à ce que le joueur choisisse **Done: let picks change the sheet** (terminé : laisser les sélections modifier la fiche). Dès lors, changer une sélection reprend ce que la sélection décrite avait donné.

Sans `tier`, l'entraînement va au premier niveau au-dessus de non entraîné que la fiche propose ; une fiche qui propose un demi-niveau (comme les compétences de 5e) fixe `"tier": "proficient"`.

<a id="items-what-a-party-carries"></a>

## Objets : ce que transporte une équipe

Les armures, les armes, les potions, l'équipement, les munitions et l'argent sont des objets. Un bloc facultatif `items` déclare les mots dans lesquels chaque objet de ton ensemble est écrit, et un catalogue avec `holds: "items"` liste les objets eux-mêmes. Les deux nécessitent Capability API 1.49 ; les `rarityCaps` et `propose` du bloc, qui encadrent les objets inventés par le Game Master, nécessitent 1.51 ; une valeur qui lit les objets que tient un personnage (`itemStat`), 1.52 ; l'effet d'un objet sur les tests quand il est porté ou transporté, avec les plafonds `bonus` du bloc, 1.53 ; ce qu'un objet exige de son porteur et les attributs qu'il modifie, 1.54 ; l'`attack` d'une arme, 1.55 ; ce que fait un objet en combat, 1.56 ; ce qu'une arme tire et garde chargé, 1.57 ; les modes d'une arme, l'attaque de la main secondaire, le plancher et les états infligés sur un coup, 1.58 ; ce que fait l'utilisation d'un objet en combat, avec les charges qu'il contient, 1.59 ; une utilisation qui restaure une réserve, 1.60 ; des charges regagnées au repos ou un objet qui se brise une fois vide, 1.61 ; une utilisation qui demande d'abord un test (`gate`), 1.62 ; les tables de butin et le butin d'une créature, 1.63 ; une ligne de butin qui lâche des pièces ou une couche qui retire des pièces, 1.64 ; un marché, le lieu `sold` d'un objet et un `service`, 1.65 ; un jour de marché (une bourse, `buyBack`, le `stock` d'un vendeur, une quantité `limited` ou un `sold` qui ne nomme aucun lieu), 1.69 ; un effet supplémentaire qui se déclenche sur les armes tenues (`weapons`), 1.70 ; l'équipement de départ (`startingGear`), 1.78 ; et un objet risqué, une contrefaçon ou un vendeur malhonnête, 1.79.

### Le bloc des objets

Le bloc va dans `items`, au premier niveau du fichier. Voici celui d'Ember Roads, un peu raccourci :

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories` : de une à 24. Chaque objet en a exactement une, comme armure, arme ou potion.
- `rarities` : facultatif, jusqu'à 12. Liste-les de la plus courante à la plus rare.
- `tags` : facultatif, jusqu'à 48. Les propriétés qu'un objet peut avoir, comme être une arme de lancer ou être argenté.
- `stats` : facultatif, jusqu'à 24. Les nombres et les mots que porte un objet, déclarés exactement comme une colonne de liste : `number`, `text`, `boolean`, `enum` ou `dice`, avec une plage, des valeurs et une valeur par défaut quand le type en a. `promptVisible` (par défaut `true`) indique si le Game Master voit la statistique à côté de l'objet. Mets-le à `false` pour ce que seul le joueur doit voir, comme l'endroit où un objet est caché.
- `slots` : facultatif, jusqu'à 12. Où un objet est porté ou tenu, et combien d'emplacements de ce type a un personnage, de 1 à 20.
- `binding` : facultatif. L'harmonisation, l'investiture ou tout autre mécanisme qui limite le nombre d'objets qu'un personnage peut avoir liés à la fois. `label` est son nom, et `max` une valeur lue sur la fiche du personnage, comme `{ "abilityScore": "nerve" }` ou une valeur dérivée. Il ne peut pas lire l'état courant, car le nombre d'objets qu'un personnage peut lier ne change pas à chaque coup.
- `carry` : facultatif. `stat` nomme la statistique numérique qui donne le poids d'un objet, dont le `min` vaut 0 ou plus. `encumberedAbove` est ce qu'un personnage peut porter avant d'être encombré, et `limit` (facultatif) le maximum qu'il peut porter. Les deux sont lus sur la fiche comme `binding.max`. Sans `carry`, le poids ne signifie rien et personne n'est jamais encombré.
- `currencies` : facultatif, jusqu'à six familles de une à dix pièces chacune.
  - Les pièces d'une même famille s'échangent entre elles selon `value`, compté en plus petite pièce de la famille. La plus petite pièce vaut donc 1, et deux pièces d'une famille ne valent jamais la même chose.
  - Deux familles ne s'échangent jamais entre elles. La monnaie d'une autre nation, ou les faveurs d'un univers, forment une famille à part.
  - L'identifiant d'une pièce est unique parmi toutes les familles, car le coût d'un objet ne nomme que la pièce.
  - Le `label` d'une pièce est son nom pour un nombre quelconque d'exemplaires (`pennies`) ; `one` (Capability API 1.89) est son nom pour exactement un exemplaire (`penny`), utilisé partout où un prix, une bourse ou un marché nomme une seule pièce. Sans lui, le `label` vaut aussi pour une seule pièce.
  - `perWeight` (facultatif, et seulement à côté de `carry`) indique combien de pièces de la famille pèsent une unité de la statistique de poids.
  - Les pièces sont l'argent de l'équipe, rangées dans les sacs comme n'importe quel objet (voir Argent, ci-dessous).
- `rarityCaps` : facultatif, au plus un par rareté. Le maximum qu'un objet inventé par le Game Master peut donner à cette rareté : la plus grande valeur de chaque statistique numérique nommée dans `stats`, dans la plage de cette statistique et en nombre entier pour une statistique qui prend des entiers, et `bonus` (Capability API 1.53), le plus grand bonus fixe que l'un de ses modificateurs portés ou transportés peut ajouter. À une rareté dotée d'un `bonus`, un bonus en dés est omis, car des dés ne peuvent pas être limités à un nombre ; une pénalité n'est jamais plafonnée. Un objet inventé y est soumis ; les objets listés par tes catalogues t'appartiennent et ne sont jamais plafonnés.
- `propose` : `true` par défaut. `false` interdit au Game Master d'inventer des objets de ton ensemble.
- `native` : `true` par défaut. `false` désactive les objets non typés propres à Game Mode dans les parties de ton ensemble (voir **Ce qui lit les objets**). Le Game Master peut toujours inventer des objets, écrits dans les mots de ton ensemble.
- `freeform` : ce que devient un objet saisi par le joueur. `"plain"` (par défaut) le garde comme objet sans règles, comme aujourd'hui. `"refuse"` n'autorise que les objets de ton ensemble.
- `lootTables` (Capability API 1.63) : facultatif, jusqu'à 24. Ce que lâchent les créatures d'un combat gagné et la commande `[loot:]` du Game Master (voir Butin, ci-dessous).

### Un objet

Un catalogue d'objets ne déclare aucun `feeds` :

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Chaque entrée porte un `item` au lieu de `rows` ou d'une `creature` :

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`, `label`, `summary` et `filters` fonctionnent comme pour toute entrée. Le libellé est le nom de l'objet.
- `category` est obligatoire. `rarity` et `tags` sont facultatifs, et tous trois nomment les identifiants propres au bloc. Un objet ne peut avoir de rareté que si le bloc en déclare.
- `stats` : les valeurs des statistiques du bloc. Chacune est une valeur que sa statistique peut contenir.
- `slots` : combien d'emplacements de chaque type l'objet occupe, jamais plus qu'un personnage n'en a.
- `stack` : le maximum d'une pile, de 1 à 999 999. Sans lui, une pile contient autant que n'importe quelle pile de Game Mode. Un objet qui contient des `charges` est seul dans sa pile.
- `cost` : un `amount` entier d'une seule pièce, nommée par son identifiant `unit`. Le sélecteur l'affiche, et le Game Master le voit à côté de l'objet (voir Argent, ci-dessous).
- `sold` (Capability API 1.65) : `{ "place": "city" }`, le plus petit des lieux de ton marché qui vend l'objet, prioritaire sur toute règle contraire ; avec 1.69, il peut à la place, ou en plus, indiquer combien d'exemplaires un lieu garde en stock pour une journée (`"limited": 2` ou `"limited": "1d3"`) (voir Marchés, ci-dessous).
- `service` (Capability API 1.65) : `true` pour un logement, une traversée, une bénédiction : acheté comme un objet et jamais transporté. L'acheter ne fait que payer ; rien d'autre n'en met un dans un sac (un ajout est refusé comme `service`), et le sélecteur omet les services. Un service a un `cost` et rien de ce qui concerne le transport ou l'utilisation (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds` : l'objet doit être lié avant de faire quoi que ce soit quand il est porté. `restriction` (facultatif) indique en mots qui peut le lier, et `cursed: true` marque un objet qui ne lâche plus prise. Seul un ensemble avec `binding` peut avoir des objets à lier.
- `worn` et `carried` (facultatifs, Capability API 1.53) : l'effet de l'objet sur les tests et sauvegardes de son porteur quand il est porté, et quand il est seulement transporté, (1.54) les attributs qu'il fixe ou augmente, et (1.56) ce qu'il fait en combat. Consulte [Les tests hors combat](#checks-outside-a-fight) et [Armures et effets portés en combat](#armor-and-worn-effects-in-a-fight).
- `requires` (facultatif, Capability API 1.54) : ce que l'objet exige de son porteur, et ce qui s'applique tant qu'il n'y satisfait pas. Consulte [Les tests hors combat](#checks-outside-a-fight).
- `attack` (facultatif, Capability API 1.55) : ce que fait l'objet comme arme en combat quand il est porté, (1.57) ce qu'il tire et garde chargé, et (1.58) ses autres modes, une attaque de la main secondaire, un plancher pour ses dégâts et les états qu'il inflige sur un coup. Consulte [Les armes en combat](#weapons-in-a-fight), [Munitions et rechargement](#ammunition-and-reloading) et [Modes, seconde arme, plancher et états sur un coup](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (facultatif, Capability API 1.170) : un interrupteur que porte l'objet, `{ "label", "budget" }`. Un combat le propose comme option sur ce budget ("Turn on Flame Tongue: Flames"), l'inventaire comme un bouton portant le libellé, et la position dans laquelle il a été laissé reste sur la pile d'un combat à l'autre ; il commence éteint. Un objet avec un interrupteur est seul dans sa pile tant qu'il est activé. Une clause `plus` d'arme avec `when: "toggled"` n'est infligée que tant qu'il est activé. La langue de flammes de 5e : `"toggle": { "label": "Flames", "budget": "bonus" }` et `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` et `charges` (facultatifs, Capability API 1.59) : ce que fait l'utilisation de l'objet, en combat et hors combat, les charges qu'il contient pour cette utilisation, et (1.60) une réserve qu'il restaure. Consulte [Utiliser des objets en combat](#using-items-in-a-fight) et [Utiliser des objets hors combat](#using-items-outside-a-fight).

Un objet ne porte pas de `mechanics` : ce qu'il fait est écrit dans son bloc `item`.

### Ce qui lit les objets

Tout ce qui précède est vérifié à l'importation de l'ensemble, et tes catalogues d'objets sont distribués avec lui. En partie, l'inventaire de Game Mode les lit :

- **Tes objets sont dans le sac.** Une pile peut être l'un de tes objets, et reste cet objet quel que soit le nom que lui donne le joueur. Le bouton **From the ruleset** (depuis l'ensemble de règles) de l'inventaire ouvre un sélecteur de tous les objets listés par tes catalogues, avec la recherche et les filtres du catalogue ; une couche qui masque une entrée la masque aussi là.
- **Les noms trouvent tes objets.** Un nom que saisit le joueur, ou que le Game Master écrit dans `[inventory: action="add"]`, et qui est le `label` de l'un de tes objets, quelle que soit la casse, ajoute cet objet. Si deux objets partagent un libellé, un nom trouve celui que tes catalogues listent en premier.
- **`stack`** est respecté : ajouter, fixer, fusionner ou donner au-delà remplit la pile et en commence une nouvelle.
- **`freeform: "refuse"`** ne laisse au joueur que tes objets : le sélecteur, et les noms qui sont tes objets.
- **`native: false`** ne laisse au Game Master que tes objets et ceux qu'il invente : un nom qui n'est ni l'un ni l'autre est refusé (`not-ruleset-item`), alors qu'on peut toujours ajouter davantage d'un objet déjà tenu, et ses instructions le disent. Un combat ne demande plus à un modèle ce que font les objets de l'inventaire ; seuls tes objets combattent donc : dans un combat régi par l'ensemble, tes armes tenues et les utilisations de tes objets (voir Les armes en combat, ci-dessous), et dans une bataille Classic ou Tactical, tes objets dotés d'un `use` (voir Les objets dans les batailles Classic et Tactical, ci-dessous). Ce que saisit le joueur suit toujours `freeform`, et ce que l'équipe transportait revient dans une nouvelle session dans les deux cas.
- **Ce qu'est un objet** s'affiche sur la pile sélectionnée : sa catégorie, sa rareté et ses tags par leurs libellés, les statistiques qu'il donne, son résumé et le contenu maximal d'une pile. Le sélecteur affiche aussi son `cost`. Le Game Master voit chacun de tes objets tenus avec sa catégorie, sa rareté, ses tags et les statistiques laissées `promptVisible`, comme `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`** : un objet qui occupe des emplacements peut être équipé par celui qui le transporte, tant qu'il a ces emplacements libres, et un exemplaire d'une pile plus grande est placé dans sa propre pile pour être porté. L'inventaire affiche les emplacements utilisés par chaque personnage.
- **`binding`** : un objet qui `binds` peut être lié, jusqu'à `binding.max` lu sur la propre fiche de son porteur (un personnage sans fiche lit une fiche vierge). Un objet `cursed`, une fois lié, le reste : le joueur ne peut ni le délier, ni l'enlever, ni le donner, ni le retirer, et seul le Game Master peut mettre fin à la malédiction.
- **`carry`** : un objet pèse sa valeur de `carry.stat` (un objet qui n'en a pas ne pèse rien), et la charge d'un personnage est le poids de son sac, comparé à `encumberedAbove` et `limit` lus sur sa propre fiche. Un objet ajouté dans la vue partagée de l'inventaire, par le joueur ou par le Game Master sans `who=`, va à celui qui peut le porter sans devenir encombré (le joueur d'abord, puis l'équipe dans l'ordre), réparti selon la place qui reste à chacun quand personne ne peut tout prendre. Rien ne dépasse la `limit` de quiconque : ce que personne ne peut porter est laissé sur place et le Game Master en est informé. Donne à une statistique de poids `"integer": false` pour des poids comme un quart de livre.
- **Le Game Master invente des objets dans tes mots.** Sauf si tu fixes `propose: false`, sa commande `[inventory: action="add"]` peut décrire un nouvel objet : `like=` l'un de tes objets comme point de départ, puis n'importe lesquels de `category=`, `rarity=`, `tags=`, `stats=` (paires `id=value`), `slots=` (`id=count`), `binds=` (`yes`, `cursed` ou `no`), `worn=` et `carried=` (des changements séparés par `;`, chacun `+N`, `-N`, `advantage`, `disadvantage` ou `fails` pour les sauvegardes, sur des compétences ou des sauvegardes par leur nom, ou sur `checks` ou `saves` pour toutes, `+N` ou `-N` sur le nom d'un attribut pour l'augmenter ou le baisser, et, si tu as des combats, `+N`, `-N`, l'avantage ou le désavantage sur les attaques et `+N` ou `-N` sur la défense ou ton mot pour elle : `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"`, ou `none`) et `summary=`, chaque partie par son identifiant ou son libellé. Une statistique d'objet que ta défense compte déjà (la Guard d'Ember Roads additionne la `guard` de ce qui est porté) est la manière dont une armure l'augmente ; un changement porté de la défense à côté d'une telle statistique est donc omis, et la réponse le dit : un petit modèle écrit `guard=1` et `+1 Guard` pour un seul +1. Le moteur lit aussi ce qu'un petit modèle a tendance à écrire à la place : un nombre après le nom (`Brawn +1`), "bonus" après les attaques ou la défense (`+1 attack roll bonus`), `none` pour une liste vide de tags, de statistiques ou d'emplacements, et `worn=`, `carried=` ou `summary=` à l'intérieur de `stats=` quand tu n'as pas de statistique de ce nom. Le moteur ne garde que ce que contient ton bloc : une catégorie, un tag, une statistique, un emplacement, une compétence ou une sauvegarde inconnus sont omis, une rareté que tu n'as pas devient ta plus basse, un nombre est limité à la plage de sa statistique puis aux `rarityCaps` de sa rareté, un bonus porté ou transporté au `bonus` de sa rareté (y compris la partie héritée de `like`), et un nom qui est l'un de tes objets est simplement cet objet. La réponse indique au Game Master ce qui a été changé (jamais à propos d'une statistique que tu ne lui montres pas), et les détails de l'objet montrent chaque changement au joueur. La partie garde l'objet : le même nom désigne cet objet jusqu'à la fin de la partie, et une nouvelle session le conserve tant que quelqu'un le tient encore.
- Le Game Master peut utiliser `equip` et `unequip` sur tes objets avec sa commande d'inventaire quand tu as des `slots`, et `bind` et `unbind` quand tu as `binding` : on ne lui présente que les actions dont ton ensemble dispose. Il voit la charge, les objets liés et les emplacements de chaque personnage, et ce qui est porté ou lié.

- **Ce que fait un objet porté ou transporté** s'affiche sur la pile sélectionnée et dans le sélecteur ("While worn: -1 on checks (Sneak)"), et le Game Master le voit à côté de l'objet (`worn: -1 on checks (Sneak)`). Les tests hors combat l'appliquent (voir Les tests hors combat, ci-dessous).
- **Ce que fait une arme** s'affiche de la même façon ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), et un combat la propose tant qu'elle est tenue (voir Les armes en combat, ci-dessous).
- **Ce que fait l'utilisation d'un objet** s'affiche de la même façon ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), avec les charges qui lui restent. Un combat la propose, tout comme le bouton **Use** (utiliser) de l'inventaire et la commande `[inventory: action="use"]` du Game Master (voir Utiliser des objets en combat et Utiliser des objets hors combat, ci-dessous).

Dans une bataille Classic ou Tactical, chacun de tes objets doté d'un `use` y fait ce qu'il dit, et un objet qui n'en a pas n'est pas proposé (voir Les objets dans les batailles Classic et Tactical, ci-dessous). Quoi que dise `native`, la fiche peut lire tes objets (ci-dessous), une arme tenue est une attaque dans un combat régi par l'ensemble et tire ce qu'elle prend dans le sac, ce que fait un objet porté ou transporté y compte (voir Armures et effets portés en combat, ci-dessous), un objet doté d'un `use` est utilisé selon ses propres règles, en combat et hors combat (voir Utiliser des objets en combat et Utiliser des objets hors combat, ci-dessous), et tes `currencies` sont l'argent de l'équipe (voir Argent, ci-dessous).

<a id="items-on-the-sheet"></a>

### Les objets sur la fiche

Une référence de valeur peut lire les objets que tient un personnage, avec `itemStat` (Capability API 1.52). Ember Roads ajoute la protection de l'armure que porte un voyageur à sa Guard, le nombre qu'un coup doit battre :

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from` : `"worn"` désigne les objets sur le personnage : un objet qui occupe des emplacements tant qu'il est équipé, un objet qui `binds` tant qu'il est lié, et un objet qui fait les deux tant que les deux conditions sont remplies. Un objet qui ne fait ni l'un ni l'autre n'est jamais porté. `"carried"` désigne le reste de ce qu'il tient, et `"all"` les deux.
- `pick` : `"sum"` additionne la valeur de chaque objet multipliée par sa quantité, `"max"` et `"min"` lisent la plus haute ou la plus basse valeur individuelle, et `"count"` compte les objets, selon leur quantité.
- `stat` nomme l'une de tes statistiques d'objet. `sum`, `max` et `min` exigent une statistique `number`. `count` peut l'omettre pour compter tous les objets, ou nommer n'importe quelle statistique pour ne compter que les objets qui la donnent.
- `slot`, `category` et `tag` (chacun facultatif) ne gardent que les objets qui occupent cet emplacement, sont de cette catégorie ou portent ce tag.
- `default` (facultatif, 0 si omis) est ce qui est lu quand aucun objet n'est retenu, ou qu'aucun ne donne la statistique.

Les objets changent en jeu ; `itemStat` suit donc la même règle qu'une lecture de l'état courant : le `max` d'une réserve ou d'une piste, le bonus de maîtrise, `binding.max`, les nombres de `carry` et la colonne à échelle ou la mise à l'échelle d'un catalogue ne peuvent pas le lire, même par une valeur dérivée. Partout ailleurs où un nombre est lu, il le peut : une valeur dérivée, l'`adjust` d'un test, le `cap` d'une compétence, la défense, l'absorption ou l'initiative d'un combat.

Les objets d'un personnage sont ceux de son propre sac. Le personnage du joueur (celui qui porte le nom de la personne qu'incarne le chat, sinon le premier) lit le sac du joueur, et chaque autre personnage, le sien. Seuls les objets de ton ensemble comptent, car un objet ordinaire n'a aucune statistique à lire. La fiche à l'écran, un test, le bloc de fiche du Game Master et un combat à son début lisent tous ce que chaque personnage tient à ce moment-là. Hors partie, dans l'éditeur de fiche ou dans l'examen d'une importation, personne ne tient rien et `itemStat` lit son `default`.

<a id="checks-outside-a-fight"></a>

### Les tests hors combat

Un test ou une sauvegarde que le Game Master demande hors combat lit plus que la fiche : les états actifs du personnage, les niveaux qu'il a atteints, ce que font ses objets portés ou transportés, et ce que coûte l'exigence d'un objet porté tant qu'il n'y satisfait pas. C'est le même vocabulaire que celui des états d'un combat (Capability API 1.53 pour les clés d'objet et la restriction à certaines compétences ou sauvegardes).

Un objet indique ce qu'il fait avec `worn`, qui s'applique tant qu'il est porté (et lié, s'il doit l'être), et `carried`, qui s'applique tant qu'il est seulement transporté. Le manteau de cuir d'Ember Roads grince quand tu te faufiles, et une pierre de route pousse les caravaniers à te faire confiance :

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Chacun prend les parties d'un état que lit un test :

- `effects` : `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` et `own-saves-disadvantage`.
- `modifiers` : des changements `to` des tests ou des sauvegardes, avec `flat`, `dice` (et `minus`), `mode`, et leurs propres `skills` ou `saves`, exactement comme ceux d'un état.
- `failsSaves` : les sauvegardes que son porteur rate sans jet.
- `skills` et `saves` : les compétences ou sauvegardes que concernent les effets, et les modificateurs qui n'en nomment aucune.
- `abilities` (Capability API 1.54) : les attributs qu'il modifie, par identifiant, chacun `{ "set": N }` (au moins N : une valeur plus élevée reste) ou `{ "add": N }` (un nombre négatif le baisse). Ils s'appliquent avant le calcul de la fiche ; tout ce qui lit l'attribut lit donc la valeur modifiée : la fiche à l'écran, les valeurs dérivées, les tests, le bloc de fiche du Game Master et un combat à son début. Les additions s'appliquent d'abord, puis le `set` le plus élevé, et les `min` et `max` propres à l'attribut tiennent. Le maximum d'une réserve ou d'une piste et le bonus de maîtrise sont calculés à partir de la fiche seule ; un objet ne les déplace donc pas.

Les gantelets en peau de bœuf d'Ember Roads donnent à une main faible la poigne d'un bouvier :

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

Ce que fait un objet en combat (défense, attaques, vitesse, les autres effets du combat, et les dégâts et états qu'il écarte) se trouve dans [Armures et effets portés en combat](#armor-and-worn-effects-in-a-fight) ; un test hors combat ne lit que les parties ci-dessus. Un objet s'applique une seule fois, quel que soit le nombre de piles que quelqu'un en tient.

Un objet peut aussi exiger quelque chose de son porteur, avec `requires` : une valeur de sa fiche (`value`, toute référence de valeur, lue comme tout ce qui est en jeu), le minimum requis (`atLeast`), et ce qui s'applique tant qu'il n'y satisfait pas (`otherwise`, dans le même vocabulaire, sauf qu'il ne peut pas modifier un attribut, puisque l'exigence peut en lire un). Jusqu'à quatre. La bêche de fossoyeur de Gravewatch est un dur labeur pour un gardien faible :

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

Une exigence lit l'attribut tel que les objets du porteur le laissent : des gantelets qui fixent Sinew à 3 satisfont donc celle de la bêche.

Sur un test :

- Chaque modificateur qui le concerne ajoute son nombre, et ses dés sont lancés : un nombre fixe sur un test additionné, des dés sur une réserve. Un test d'attribut, et un test que l'ensemble ne sait pas nommer, ne lisent que ce qui n'est restreint à rien, et une sauvegarde ne lit que ce qui concerne les sauvegardes.
- L'avantage et le désavantage de toutes les sources, y compris le `mode=` du Game Master, s'annulent : dès qu'il y a au moins un de chaque, le test est lancé une seule fois. Seul un ensemble qui lance deux fois (`resolution.advantage`) penche d'un côté.
- Une sauvegarde qu'un état ou un objet fait rater est ratée sans jet, et rien n'est dépensé pour elle.
- Le registre indique ce qui l'a modifié : `effects="-1"` pour le nombre, `from="Leather coat"` pour ce qui l'a modifié, et `automatic="true"` pour une sauvegarde ratée sans jet. La carte des dés montre la même chose, et le Game Master le lit au tour suivant. Il sait que le moteur applique ces modifications, donc il ne les ajoute pas une seconde fois.

Gravewatch montre la même chose sur une réserve : la Dawn bell liée ajoute un dé à Ward, et Rattled en retire un à Soothe et à Barter.

### Défenses typées issues des états, des niveaux, des objets et des lignes de fiche (Capability API 1.132)

`combat.conditions[]` et `combat.levels[]` peuvent accorder `resist`, `vulnerable`, `immune` (de 1 à 30 entrées chacun) et `conditionImmunities` (de 1 à 40 identifiants d'états). Ils s'appliquent tant que l'état dure ou que le seuil du niveau est atteint. Une immunité d'état nouvellement acquise met fin à cet état s'il est déjà actif et empêche de l'appliquer à nouveau. L'immunité l'emporte sur la résistance ; résistance et vulnérabilité s'annulent. Plusieurs résistances ne réduisent jamais les dégâts de moitié deux fois.

`resist` et `immune` utilisent la forme des créatures : un mot de dégâts ou `{ "type": "bludgeoning", "except": ["magical"] }`. Tout tag nommé porté par le coup contourne cette entrée. `vulnerable` reste une liste de simples mots de dégâts. La même forme d'exception fonctionne sur les effets `worn` et `carried` des objets. Déclare les tags d'exception dans `items.tags` et place-les dans les qualités de l'arme ou du sort. Par exemple, Stoneskin est une association d'état :

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

L'armure d'invulnérabilité utilise ce même tableau `resist` dans son effet `worn`. Protection from Energy peut accorder `resist: ["fire"]` ; un trait semblable à Brave peut accorder `conditionImmunities: ["frightened"]`. Un niveau peut accorder `resist: ["poison"]` à son seuil. Les mots de dégâts statiques inconnus sont signalés quand `combat.damageTypes` déclare le vocabulaire, comme pour les créatures ; sans cette déclaration, les mots de dégâts sont du texte libre.

Pour les traits d'ascendance ou de catalogue, `combat.sheetHides` contient jusqu'à huit sources (un tableau vide est autorisé). Chacune nomme une liste de la fiche, une colonne texte ou enum de cette liste, et l'un des quatre types. Pour un nain dont la ligne de traits contient `"poison"` dans une colonne `resistance` :

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Chaque ligne fournit des mots séparés par des virgules, débarrassés des espaces superflus et comparés sans tenir compte de la casse ; les mots vides sont ignorés. Ajouter une ligne avec `"fire"` ajoute une résistance au feu ; la supprimer retire cette source. Les mots de résistance et d'immunité peuvent comporter `except`, comme dans `"bludgeoning except magical silvered"`. Les vulnérabilités et les immunités d'état sont de simples mots. Les mots de dégâts déclarés inconnus dans le texte de la fiche sont ignorés, tout comme les identifiants d'états inconnus ; une colonne enum pour les immunités d'état ne doit déclarer que des identifiants d'états à l'importation. Les résumés de la fiche, de la bataille et du Game Master incluent ces défenses et leurs exceptions.

<a id="weapons-in-a-fight"></a>

### Les armes en combat

Un objet peut être une arme (Capability API 1.55). Son `attack` a la forme des [lignes d'attaque](#combat-a-fight-your-own-rules-resolve) d'un bloc de combat, avec des valeurs à la place des colonnes, et un [combat régi par l'ensemble](#combat-a-fight-your-own-rules-resolve) la propose comme attaque tant que l'objet est porté : tenu dans les mains qu'il occupe, et lié s'il doit l'être. Un objet rangé ou seulement transporté ne propose rien, et les lignes d'attaque et les actions propres d'une créature fonctionnent exactement comme avant. La hachette d'Ember Roads :

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget` : le budget qu'elle dépense, l'un de `combat.economy.budgets`.
- `toHit` : ce qu'elle ajoute pour toucher. `abilities` contient un ou plusieurs identifiants d'attributs, et le meilleur compte (une arme de finesse en liste deux). `skill` ajoute ce qu'ajoute un test de cette compétence, avec l'attribut de l'attaque à la place de celui de la compétence, comme pour une ligne d'attaque. `proficiency` est une valeur de la fiche du porteur : si elle vaut plus de 0, le bonus de maîtrise de l'ensemble est ajouté (`{ "const": 1 }` pour toujours). `bonus` est un nombre. `sheetBonus` est un nombre lu sur la fiche du porteur et ajouté tel quel, pour ce que le porteur apporte à toute arme d'un genre plutôt que pour ce qu'est l'arme : le style de combat Archery de 5e donne `{ "derived": "archery" }` à chaque arme à distance, une valeur dérivée qui vaut 2 pour un archer et 0 pour tout autre personnage (Capability API 1.95 ; les caractéristiques de l'objet la nomment par son nom sur la fiche). `target` est la cible par dé propre à l'attaque de cette arme dans un combat à réserve (la bêche de Gravewatch compte chaque dé à partir de 6 au lieu du 7 de la réserve), et seul un ensemble `dice-pool` dont la `target` peut bouger peut en donner une ; dans un combat par somme, son `bonus` dit la même chose.
- `damage` : les `dice` qu'elle inflige, le meilleur de ses `abilities` de dégâts ajouté, un `bonus` et un `type`. Un combat par somme exige `dice` ; dans un combat à réserve, un coup inflige ses réussites et `dice` ajoute autant de dés supplémentaires du dé de la réserve. `sheetBonus` (Capability API 1.97) est un nombre de la fiche du porteur ajouté aux dégâts comme celui de `toHit`, et avec `"oneHanded": true` il ne compte que tant que l'arme est tenue à une main : ni une arme `versatile` maniée à deux mains, ni une arme qui prend deux exemplaires d'un emplacement. Le style Dueling de 5e donne `{ "derived": "dueling" }`, 2 pour un duelliste qui tient une seule arme. `rerollUpTo` (Capability API 1.98) est une valeur de la fiche du porteur : les dés de dégâts propres de l'arme égaux ou inférieurs à elle sont relancés une fois et la nouvelle face est conservée, y compris les dés supplémentaires d'un critique, seulement tant que l'arme est maniée à deux mains (une arme `versatile` avec les mains libres, ou une arme qui prend deux exemplaires d'un emplacement) et seulement dans un combat par somme. Le style Great Weapon Fighting de 5e donne `{ "derived": "great_weapon_fighting" }`, 2 avec le style.
- `reach` et `range` (`normal`, et `long` pour ce qu'elle porte encore au-delà) sont exprimés dans ton unité `combat.distance`, qui doit exister. Une arme dotée des deux est une arme de lancer, comme une ligne d'attaque : une frappe de près, un lancer au-delà. Sans aucun des deux, elle atteint une case.
- `versatile` : les `dice` qu'elle inflige à la place tant que chaque emplacement qu'elle occupe a encore autant de place libre parmi ce que porte son porteur : une lance tenue d'une main, l'autre libre.
- `strikes` : combien d'attaques achète une dépense, lu sur la fiche du porteur, comme le `strikes` d'une ligne d'attaque. Une arme qui ne le déclare pas donne une attaque par dépense, quel que soit le nombre d'attaques de son porteur.

N'importe lequel de ces nombres ou mots peut lire à la place une statistique de l'objet : `{ "stat": "damage" }` est le `damage` de l'objet, et une statistique pour laquelle l'objet ne donne rien vaut comme si la valeur n'était pas écrite. `abilities` et `skill` lisent une statistique enum dont les mots sont des identifiants d'attributs ou de compétences, et `type` une statistique texte ou enum. Ainsi, un objet que le Game Master invente `like=` une arme est aussi une arme, qui combat avec ses propres statistiques, limitées par `rarityCaps` comme toute statistique (une valeur que tu écris en dur est copiée telle quelle). Un objet inventé sans emplacement ni lien n'est jamais porté ; il est donc créé sans l'attaque. Un petit modèle a tendance à décrire une arme en omettant `like=` ; une arme inventée dans une catégorie de tes armes sans point de départ combat donc comme celle de tes armes de cette catégorie dont le nom ressemble le plus au sien (un mot partagé dans un sens ou dans l'autre : un crossbow ressemble donc à un bow), ou comme la première d'entre elles, en prenant toute statistique lue par cette attaque que la proposition a omise, et la réponse le dit ("It fights as Hand axe does."). Le formulaire de proposition du Game Master lui indique aussi qu'une arme faite comme une autre combat comme elle.

Les tags d'une arme sont ce que portent ses coups. L'entrée `resist` ou `immune` d'une créature peut dire ce qui la traverse : `{ "type": "tearing", "except": ["silver"] }` est subi en entier d'une arme avec le tag `silver`, et résisté pour tout le reste. La grave wight de Gravewatch est écrite ainsi, et le clou de cercueil en argent la traverse. Les dégâts qui ne viennent pas d'un objet arme nomment ce qu'ils portent avec `qualities` (Capability API 1.101), dans les mêmes tags d'objet : sur les `mechanics` d'une entrée de catalogue (un sort) et sur le `damage` d'une action de créature (la masse d'un deva). Le "resistance to bludgeoning, piercing and slashing from nonmagical attacks" de 5e s'écrit `{ "type": "slashing", "except": ["magical"] }` à côté de la même chose pour les deux autres, avec `magical` dans les tags de ses armes magiques et `"qualities": ["magical"]` sur ses sorts et sur les attaques de créatures que le SRD dit magiques.

Les détails de l'arme et la ligne du Game Master disent ce qu'elle fait : `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, avec `1d8 with a hand free` pour l'épieu à sanglier d'Ember Roads et `at 6` à côté de la bêche de Gravewatch.

<a id="ammunition-and-reloading"></a>

#### Munitions et rechargement

Une arme peut tirer quelque chose, et garder son propre compte de munitions chargées (Capability API 1.57). L'arc de chasse d'Ember Roads tire des flèches, et le pistolet de guet de Gravewatch contient une balle, chargée à partir du plomb et de la poudre du gardien :

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo` : ce que tire l'arme, par l'un de tes `tags` d'objet. Chaque attaque prend `perAttack` (1 s'il n'est pas indiqué) des objets portant ce tag que transporte son porteur, portés ou non, dans la première pile de ce type de son sac, puis dans la suivante. L'arme n'est proposée que tant qu'il en transporte assez, et le menu de combat indique combien il en reste. Après un combat gagné par l'équipe, `recover` (de 0 à 1) de ce que chacun a tiré revient à la pile d'origine : la part est additionnée sur tout le combat et arrondie vers le bas une fois par pile ; la moitié de cinq flèches tirées d'un même carquois donne donc deux. Un combat perdu ou fui ne rend rien.
- `clip` : un compte chargé que l'arme garde sur elle. `max` est sa capacité, écrite en dur ou lue sur une statistique numérique de l'objet, et `reload` est le budget que dépense un rechargement. Une attaque dépense ce qui est chargé au lieu de prendre dans le sac, et l'arme n'est proposée que tant qu'elle contient assez pour une attaque. Une option **Reload** (recharger) du menu de combat dépense `reload` et la remplit : à partir du sac si elle a `ammo` (autant que le sac contient encore si c'est moins), et entièrement si elle n'en a pas. Le compte est conservé sur la pile d'inventaire de l'arme ; un pistolet vidé lors d'un combat est donc toujours vide au suivant. Une arme dont personne ne s'est encore servi est chargée, tout comme celle qu'un joueur verse dans une pile de plusieurs exemplaires, car un compte chargé appartient à une seule arme. Les munitions d'un chargeur ne sont pas ramassées après un combat ; `recover` concerne donc une arme sans chargeur.

Ce qu'un combat tire, charge et ramasse est écrit dans l'inventaire à chaque étape, comme la santé de l'équipe, et le journal de la partie indique ce qui a été utilisé. Une étape dont la pile a disparu, ou contient moins que ce que le combat comptait, est refusée, comme un objet dépensé que le combat ne trouve pas. Le journal de combat indique chaque tir, rechargement et ramassage ("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), et les détails de l'objet et la ligne du Game Master indiquent ce que l'arme tire et contient : `ammunition Arrow (1 an attack, 50% picked up after a won fight)` et `holds 1, reload (Act)`.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

#### Modes, seconde arme, plancher et états sur un coup

Une arme peut avoir d'autres façons de porter son attaque, une partenaire dans la main secondaire, un minimum de dégâts et des états qu'elle inflige à ce qu'elle touche (Capability API 1.58). L'arc de chasse d'Ember Roads peut tirer une volée, et le clou de cercueil en argent de Gravewatch peut être tenu dans chaque main et marque ce qu'il mord profondément :

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes` : jusqu'à six autres façons de porter l'attaque, chacune avec un `id`, un `label` et ce qu'elle change. `ammo` est le nombre de tirs d'une attaque dans ce mode ; l'arme a donc un `ammo` ou un `clip` où puiser. `toHit` est ce qu'elle ajoute pour toucher, des dés dans un combat à réserve et un nombre dans un combat par somme. `target` déplace de cette valeur la cible par dé d'un combat à réserve (à partir de celle de l'arme, sinon de celle de la réserve ; `+1` est plus difficile), si la cible de la réserve peut bouger. `targets` indique combien de cibles elle peut viser, chacune avec son propre jet d'attaque. Le menu de combat demande le mode une fois l'attaque choisie (après son style d'initiative, s'il y a des styles), chacun avec son effet attendu, et ne propose que les modes pour lesquels le porteur a les tirs nécessaires. Un membre de l'équipe joué par le moteur évalue chaque mode visant une seule cible, et laisse à un joueur les modes à plusieurs cibles. Dans une fenêtre, une attaque est portée telle quelle.
- `offHand` : une arme pour la main secondaire. Le bloc de combat nomme le budget que dépense une seconde attaque, et indique si ses dégâts gardent un attribut positif :

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Une fois que son porteur a attaqué pendant ce tour avec une arme marquée `offHand`, chaque autre arme de ce type qu'il porte propose une seconde attaque sur ce budget, nommée "Silver coffin nail, off hand" dans le menu. `ability` vaut `full` (par défaut) ou `penalty-only`, qui n'ajoute l'attribut aux dégâts que quand il retire quelque chose, comme le combat à deux armes de 5e. Une attaque de la main secondaire est un seul coup, quel que soit le nombre d'attaques qu'achète l'attaque principale, et jamais une frappe sur quelqu'un qui s'éloigne. Une arme marquée `offHand` exige l'`offHand` du bloc de combat. `fullWhen` (Capability API 1.97) est une valeur de la fiche du combattant : au-dessus de 0, la main secondaire de ce combattant garde l'attribut entier quoi que dise `ability`, comme le style Two-Weapon Fighting de 5e.

- `floor` : le minimum qu'inflige un coup, écrit en dur ou lu sur une statistique numérique de l'objet. Les dégâts d'un combat à réserve après absorption, ou ceux d'un combat par somme, y sont relevés avant qu'une résistance ne les réduise de moitié, et le journal le dit. Un coup qui dépense lance le nombre de son auteur et n'est jamais relevé.
- `onHit` : jusqu'à quatre de tes états que subit la cible quand les dégâts du coup ont atteint `atLeast`, pendant `rounds` de ses propres tours ou, sans lui, jusqu'à ce que quelque chose les retire. Les dégâts sont ce qui l'a atteinte après absorption et résistances ; un coup qui prend retire de l'initiative plutôt que de la santé, donc il n'inflige aucun état. Une entrée peut aussi porter `save: { "save": <save id>, "difficulty": n }`, que la cible lance au moment où l'état s'appliquerait, une réussite l'écartant, et `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, qui le fait durer jusqu'à ce que son porteur réussisse cette sauvegarde au début ou à la fin de chacun de ses tours ou sur des dégâts supérieurs à zéro (il n'a alors pas de `rounds`). Les deux comptent comme des sauvegardes contre cet état, et contre la magie quand l'arme est magique (Capability API 1.169). L'épée de blessure de 5e : `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus` : jusqu'à trois quantités supplémentaires à chaque coup réussi, chacune `{ "dice", "flat", "type", "save", "targetIs", "when" }`, lancée, typée et soumise aux résistances séparément (Capability API 1.169). `save` nomme sa propre `difficulty` et son `onSuccess` (`half` ou `none`). `targetIs` ne l'inflige qu'à une cible de ces types ou tags de créatures (voir Types de créatures et tests de cible). `when: "critical"` ne l'inflige que sur un coup critique ; les dés de toute clause sont doublés sur un coup critique comme ceux de l'arme. Un javelot de foudre s'écrit `{ "dice": "4d6", "type": "lightning" }` ; une tueuse de dragons `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }` ; une épée acérée `{ "flat": 14, "type": "slashing", "when": "critical" }`. Une prévision ne compte une clause que contre une cible qu'elle atteint, et jamais une clause réservée aux critiques. `when: "toggled"` ne l'inflige que tant que l'interrupteur de l'objet est activé (Capability API 1.170, voir `toggle` ci-dessous).

Les détails de l'arme et la ligne du Game Master disent tout : `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` et `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

### Armures et effets portés en combat

Ce que fait un objet porté ou transporté peut aussi changer un combat (Capability API 1.56), pour son porteur, à côté de ses états et de ses niveaux. Chacun prend les parties d'un état que lit un combat :

- `effects` : n'importe lequel de ceux d'un état, sauf les cinq qu'un niveau ne peut pas avoir (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), puisque personne n'a imposé l'objet à son porteur et qu'il ne prend jamais fin tout seul : `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` et les autres.
- `modifiers` : des changements `to` la défense, les attaques et la vitesse ainsi que les tests et sauvegardes, exactement comme ceux d'un état ; dans un combat `dice-pool`, un changement aux attaques est un nombre fixe de dés, comme pour un état.
- `resist`, `vulnerable` et `immune` : les types de dégâts dont son porteur subit la moitié, le double ou rien, comme pour une créature (et vérifiés contre `combat.damageTypes` si tu en déclares). `conditionImmunities` : tes propres états qui ne sont jamais infligés à son porteur.

L'anneau de veuve maudit de Gravewatch coûte un dé à chaque attaque, sa Dawn bell liée protège son porteur de Rattled, et une pierre de route d'Ember Roads transportée tient la chaleur à distance :

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

Un combat lit chaque objet une fois, nommé d'après la pile ("Widow's ring" à côté d'un jet dans le journal, et sur une défense), comme le fait un test ; l'`otherwise` d'une exigence non satisfaite compte aussi en combat, si bien qu'une armure trop lourde pour son porteur peut coûter de la vitesse. Les détails d'un objet et la ligne du Game Master disent tout ("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). Une armure qui ajoute simplement à une défense ou à une absorption est une statistique d'objet lue avec `itemStat` (voir Les objets sur la fiche), comme la Guard d'Ember Roads lit le manteau porté.

**Dureté.** Quand l'initiative est un nombre que les attaques déplacent, `combat.pool.hardness` est la dureté d'un combattant, lue sur sa fiche au début du combat (celle de son armure, par `itemStat`), et une créature donne sa propre `hardness`. Un coup qui dépense et dont les dés sont inférieurs à elle touche sans rien faire : le nombre de son auteur revient quand même à la base, le journal le dit ("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing."), et le menu ne lui prévoit aucun dégât. Seul un ensemble doté d'un style qui dépense peut l'avoir, et une créature écrite sous forme de fiche la prend sur sa fiche.

<a id="using-items-in-a-fight"></a>

### Utiliser des objets en combat

Un objet peut être utilisé en combat (Capability API 1.59) : un cataplasme pressé sur une coupure, un tonique avalé, une cloche qu'on fait sonner. Son `use` indique ce que fait son utilisation dans les mots du `mechanics` d'une entrée de catalogue (voir [Ce qu'un combat lit dans `mechanics`](#what-a-fight-reads-from-mechanics)) : `kind` (`heal`, `attack`, `buff` ou `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` et, depuis Capability API 1.174, `concentration` et `zone`, avec le `budget` qu'il dépense, ou `free`. Le cataplasme d'Ember Roads, ainsi que le tonique réchauffant et la cloche de l'aube de Gravewatch :

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- Une utilisation figure dans le menu de combat sous **Items** (objets), nommée d'après l'objet ("Poultice") quel que soit le nom de la pile. Un objet qui occupe des emplacements ou qui se lie est utilisé tant qu'il est porté (et lié, s'il doit l'être), comme la cloche ; tout autre objet, tant qu'il est transporté.
- Elle dépense un budget, ou est `free`, et se paie elle-même : un `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` ou `rider` concerne une entrée de catalogue que contient une fiche, et est refusé sur une utilisation.
- `toHit`, sur une utilisation avec `attackRoll`, est ce qu'elle ajoute pour toucher, comme le dit le `toHit` d'une arme (voir Les armes en combat) : des attributs, une compétence, un bonus et, dans un combat à réserve, une cible par dé. Sans lui, le jet n'ajoute rien.
- `saveDifficulty` : le nombre contre lequel est lancée une sauvegarde qu'elle demande (la sienne, celle qui met fin à un état qu'elle applique, ou celle d'une clause sans `difficulty`), écrit en dur ou lu sur une statistique numérique de l'objet. Une entrée d'une fiche lit ce nombre sur la source de son catalogue ; un objet n'en a pas, il donne donc le sien.
- `consumes: true` retire un exemplaire de la pile de l'objet à chaque utilisation, et le menu indique combien il en reste. Le dernier utilisé emporte la pile avec lui.
- `restore` (Capability API 1.60) rend une partie d'une réserve à chaque fiche qu'il atteint, comme une poche de sang rend du sang : `{ "pool": "resolve", "amount": { "flat": 1 } }`, avec `dice` et `flat` comme dans un `amount`. Il nomme l'une de tes réserves vivantes, jamais la réserve de santé (la santé revient par un soin), et se place sur une utilisation qui aide, un `heal` ou un `buff`. Une créature n'a pas de réserves, elle ne reçoit donc rien. Le journal le dit ("Ada gets back 1 Resolve, and is on 3 of 4."), et un membre de l'équipe joué par le moteur laisse tranquille une réserve pleine. Le tonique réchauffant de Gravewatch restaure un point de Resolve en plus de son soin.
- `charges` dépense ce nombre de `charges` propres à l'objet, dont le `max` est la capacité, de 1 à 100, écrit en dur ou lu sur une statistique numérique de l'objet (un objet qui donne cette statistique à moins de 1 est refusé, et un objet au-delà de 100 en contient 100). Le compte est conservé sur la pile d'inventaire de l'objet : une cloche sonnée deux fois lors d'un combat n'a plus qu'une charge au suivant, et une cloche que personne n'a sonnée est pleine. Les charges appartiennent à un seul objet ; un objet qui en contient a donc un `stack` de 1. Une utilisation consomme l'objet ou dépense des charges, jamais les deux, et les charges d'un objet sont toujours dépensées par son utilisation. Deux clés s'ajoutent à `charges` (Capability API 1.61), comme sur la cloche de l'aube de Gravewatch :

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge` : lesquels de tes `rests` rendent les charges, et combien : `"max"` remplit l'objet, et une quantité (`{ "dice": "1d6", "flat": 1 }`) en rend autant, sans jamais dépasser `max`. Un repos rend les charges de chaque objet que transporte son personnage et qui le nomme, que ce soit par le bouton Rest de la fiche ou par la commande `[sheet: op="rest"]` du Game Master ; la fiche et le sac sont écrits ensemble, et une réponse régénérée ne recharge qu'une fois. La fiche indique ce qui est revenu après le repos ("Dawn bell 3/3 charges"), et le Game Master voit à côté de chaque objet de l'inventaire les charges qui lui restent ("2 of 3 charges left").
  - `breaksOn` : quand une utilisation dépense la dernière charge, le moteur lance un d`die`, et à `atMost` ou moins l'objet se brise et disparaît du sac, en combat comme hors combat. Le journal de combat le dit ("Dawn bell breaks (a 1 on its die)."), le rapport du bouton Use aussi ("Its last charge spent, it breaks."), et le journal de la partie le compte comme perdu.

- `gate` (Capability API 1.62) est un test que l'utilisateur doit réussir avant que l'objet fonctionne, comme un parchemin d'un sort au-dessus du niveau du lecteur en exige un. `check` nomme ce qui est lancé : `{ "skill": "ward" }`, `{ "ability": "wits" }`, ou une valeur de la fiche (`{ "value": { "derived": "spell_mod" } }`, pour un nombre qui diffère d'un personnage à l'autre, comme le modificateur d'incantation d'un lanceur de sorts 5e). `difficulty` va de 1 à 100, écrit en dur ou lu sur une statistique numérique de l'objet (un objet qui ne la donne pas est retiré du menu, et son bouton Use le dit clairement). `unless` saute le test quand une valeur de la fiche de l'utilisateur vaut au moins `atLeast`. Un test raté consomme l'objet (ou dépense ses charges) pour rien. En combat, le test est lancé au moment où l'objet est dépensé, avec les dés du combat (une réserve dans un combat à réserve, où `difficulty` est le nombre de réussites nécessaires) et le nombre de la fiche lu au début du combat, et ce qu'ajoutent à ce test les états et les objets portés de l'utilisateur compte, y compris ce qui vise la compétence elle-même. Le journal le dit ("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). La page de la litanie de veille de Gravewatch en a un :

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

Ce qu'un combat consomme et les charges qu'il laisse sont écrits dans l'inventaire à chaque étape, comme les tirs d'une arme, et le journal de la partie indique ce qui a été utilisé. Le journal de combat indique chaque utilisation ("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). Un membre de l'équipe joué par le moteur n'utilise un soin que sur quelqu'un de blessé, et personne n'utilise un objet pour frapper quelqu'un qui s'éloigne. Les détails de l'objet et la ligne du Game Master indiquent ce que fait son utilisation : "Use (Action): heals 1d4 + 1, range 0 paces, used up" et `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, et les détails montrent les charges restantes. Un objet que le Game Master invente `like=` l'un des tiens s'utilise comme lui, charges comprises.

### Les objets dans les batailles Classic et Tactical

Un ensemble qui ne résout pas ses propres combats les confie aux batailles Classic et Tactical propres à Game Mode, où l'on demande à un modèle ce que font les objets de l'inventaire au début d'un combat. Tes objets ne sont pas devinés : chacun de ceux dotés d'un `use` fait ce que celui-ci dit, avec les nombres propres au moteur, et l'estimation du Game Master n'est demandée que pour les objets qui ne sont pas les tiens (et pour aucun avec `native: false`).

- Un `heal` soigne et une `attack` blesse d'une part de la santé maximale de la cible, calculée à partir de la moyenne de son `amount` : une moyenne de 7, le `1d8+3` d'une arme de base, représente un peu plus d'un cinquième de cette santé, jamais moins d'un vingtième et au plus la totalité. C'est l'échelle à laquelle le pont de combat lit les nombres d'une entrée de catalogue. Le `damageType` est l'élément.
- Le premier état de `applies` s'applique comme un statut portant son propre nom, pendant ses `rounds` (2 sans eux), et un `buff` ou un `debuff` se réduit à ce statut, qui augmente ou baisse la défense comme les statuts propres au moteur.
- `targets` indique sur qui il est utilisé. Sans lui, un soin ou une amélioration va à un allié, et une attaque ou un affaiblissement à un ennemi.
- `consumes: true` retire un exemplaire de la pile, et une utilisation sans lui laisse l'objet là où il est.
- Un jet pour toucher, une sauvegarde, une zone, des points temporaires et une réserve restaurée n'ont pas de place dans ces batailles, comme pour le `mechanics` d'une entrée de catalogue : la description de l'objet dans le menu les mentionne toujours.
- Un objet qui occupe des emplacements n'est utilisé que tant qu'il est porté, et un objet qui se lie que tant qu'il est lié, comme dans un combat régi par l'ensemble. Un objet consommé est pris parmi ce qui est porté, jamais sur un exemplaire de rechange dans le sac.
- Un objet dont l'utilisation dépense des `charges` est proposé tant qu'il reste une utilisation, et le menu **Items** compte ses utilisations. Chaque utilisation les dépense sur la pile de l'objet, celle du joueur en premier, et la dernière dépensée lance son `breaksOn` : brisé, l'objet disparaît du sac et le journal de la partie le compte comme perdu.
- Un objet qui demande d'abord un test (`gate`) le fait lancer sur le serveur quand un membre de l'équipe l'utilise, avec la fiche de ce membre et ce qu'il porte (un compagnon qui n'a pas sa propre fiche de personnage lance sur une fiche vierge, et seule l'unité du joueur se rabat sur la fiche de personnage du joueur), comme le lance le bouton Use, et le test est sauté quand `unless` est satisfait. En cas d'échec, l'objet est dépensé (ou ses charges le sont) sans effet, et le journal le dit : "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- Un objet sans `use` n'est pas proposé dans ces batailles, pas plus qu'un soin sans `amount`.

Le moteur calcule lui-même l'effet de chaque objet ; ce qu'envoie l'écran ne décide donc jamais de ce que fait l'un de tes objets.

### Butin

Un combat gagné lâche du butin dans chaque partie Game Mode, une seule fois, dans les sacs de l'équipe. Sans ensemble de règles, il vient des tables propres à Game Mode (plus abondant et plus rare dans une partie plus difficile), et il en va de même dans un ensemble qui ne déclare aucune table de butin et laisse `native` activé. Un ensemble qui déclare des tables de butin lâche plutôt ses propres objets, et un ensemble avec `native: false` et sans tables ne lâche rien.

`lootTables` dans le bloc `items` (Capability API 1.63) les liste, comme le font les objets funéraires de Gravewatch :

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls` indique combien de tirages fait la table : un nombre de 0 à 20, ou des dés (`"1d2"`), 1 par défaut.
- Chaque tirage choisit une ligne selon son `weight` (1 par défaut) par rapport aux autres. Une ligne nomme l'un de tes objets sous la forme `<catalog>/<entry>`, un `filter` par `rarity`, `category` et `tag`, qui choisit uniformément parmi tous les objets correspondants, ou (Capability API 1.64) `coins`, l'une de tes pièces par son identifiant. `count` indique combien en tombent, un nombre ou des dés, 1 par défaut. Un objet ou une pièce qu'une couche retire ne lâche rien, pas plus qu'un filtre qui ne trouve rien.
- Une créature de bestiaire nomme la table qu'elle porte avec `loot` (voir Créatures, ci-dessous). Un combat régi par l'ensemble et gagné lance la table de chaque créature vaincue, et un combat que le moteur ne résout pas selon tes règles n'a pas de créatures de bestiaire, donc il ne lâche rien.
- Ce qui tombe va dans la vue partagée comme un ajout, le sac du joueur étant sollicité en premier, et ce que personne ne peut porter est laissé sur place. Le récapitulatif que reçoit le Game Master indique ce qui est tombé et que c'est déjà dans les sacs, le journal de la partie le note, et une notification l'affiche.
- Le Game Master lance une table dans l'histoire avec `[loot: table="grave_goods" who="Ada"]` (`who=` pour le sac d'un seul personnage), mesuré depuis le début du tour comme ses balises d'inventaire ; une réponse régénérée ne lâche donc le butin qu'une fois. Chaque objet tombé reçoit la même réponse qu'un ajout, et ses instructions listent tes tables.

### Argent

Tes `currencies` sont l'argent de l'équipe. Une pièce est un objet dans les sacs, une pile par pièce comme n'importe quelle autre, nommée par son `label` :

- Elle pèse une unité de ta statistique de poids pour chaque `perWeight` pièces de sa famille, compte dans la charge de son porteur et est placée selon la règle de transport à son arrivée. Une famille sans `perWeight` ne pèse rien.
- Le joueur ajoute des pièces depuis la liste **Coins** (pièces) du sélecteur, et les divise, les donne et les fusionne comme n'importe quelle pile.
- Une ligne au-dessus des piles de l'inventaire affiche les pièces visibles de chaque famille et leur valeur en plus petite pièce de la famille. Le Game Master voit cette valeur à côté de chaque sac (`Coin worth 432 pennies`, ou `no coins` pour une bourse vide, le sac du joueur étant listé même s'il ne contient rien), et le `cost` d'un objet à côté de l'objet (`costs 3 shillings`).
- Le Game Master paie avec `[inventory: action="pay" amount="3 shillings" who="Ada"]` et est payé avec `action="earn"`. `amount` est un nombre et une pièce, par son identifiant ou son libellé, au singulier ou au pluriel, quelle que soit la casse (`1 penny`, `12 pennies`). Un paiement sort d'un seul sac (celui du joueur sans `who=`), uniquement dans la famille de la pièce : les plus grosses pièces qui conviennent partent d'abord, puis la plus petite pièce restante qui couvre ce qui reste dû est rompue, et la monnaie revient en pièces plus petites de la famille, les plus grosses d'abord. La réponse indique ce qui a été payé et ce qui est revenu : 3 shillings tirés d'une bourse contenant une couronne donnent `Paid with crowns ×1; shillings ×2 back.` Un paiement que le sac ne peut pas couvrir est refusé (`cannot-afford`), tout comme une pièce que tu n'as pas (`unknown-coin`) et tout paiement dans un ensemble sans monnaies (`no-currencies`). Un gain est un ajout de cette pièce, dans le sac de `who` ou réparti selon la règle de transport. Le journal de la partie liste ce qui a été dépensé et gagné, et une notification l'affiche. Ses instructions listent tes pièces, et seul un ensemble qui en a les reçoit.
- Acheter, c'est payer puis ajouter, ou, dans un ensemble doté d'un marché, utiliser `buy` (ci-dessous). Il n'y a pas d'écran de boutique.

### Équipement de départ

`items.startingGear` (Capability API 1.78) liste l'équipement qu'un personnage peut prendre dans son sac au départ : le paquetage d'une classe, d'un historique, d'une vocation. Il n'est jamais donné de lui-même. L'inventaire affiche une ligne **Starting gear** (équipement de départ), et le joueur choisit un équipement, une option pour chacun de ses choix et un objet de chaque liste, puis le prend dans son propre sac ou dans celui d'un membre de l'équipe. L'équipement auquel la fiche du personnage correspond (`fits`) est listé en premier, puis l'équipement sans `fits` (pour n'importe quel personnage, comme celui d'un historique) ; chaque équipement est proposé, car le concept d'un personnage est à convenir entre le joueur et le Game Master.

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- Une ligne est l'un des objets de l'ensemble (`item`), des pièces (`coins`, un identifiant d'unité), un objet que le joueur choisit dans une liste fixe (`oneOf`, de 2 à 48 objets), ou un objet ordinaire par son nom (`name`, là où `freeform` autorise les objets ordinaires ; soumis aux règles d'un libellé, donc ni crochets, ni `{{`, ni sauts de ligne). `count` va de 1 à 999 ; `equip: true` équipe un objet au moment où il est pris, là où ses emplacements sont libres : une armure compte ainsi dès le départ.
- `choices` en compte de 0 à 8, chacun avec 2 à 6 options faites de leurs propres lignes.
- `group` : l'équipement qu'un personnage prend une fois par groupe (celui d'une classe et celui d'un historique). Reprendre le même groupe est un choix que le joueur fait dans la boîte de dialogue, et cela s'ajoute à ce qui est déjà dans le sac. Un équipement sans groupe forme son propre groupe, jamais identique à un groupe du même nom.
- `fits` lit la fiche sans son état vivant, comme le transport. Il ne fait qu'ordonner la liste.
- La prise est tout ou rien : un équipement trop lourd pour son porteur est refusé en entier, et la boîte de dialogue indique son poids par rapport à ce que le porteur peut encore transporter. Un objet qu'une couche retire du jeu est laissé de côté et nommé, tout comme une liste dont elle retire tous les objets ; les pièces d'une monnaie qu'une couche retire sont payées dans la plus grosse pièce restante de même valeur, et la boîte de dialogue les affiche ainsi. Un équipement dont il ne reste rien est refusé, pour qu'il ne soit jamais marqué comme pris pour rien. Un service n'est jamais proposé depuis une liste.
- L'importation vérifie chaque objet (dans un catalogue intégré ; un catalogue dans son propre fichier est vérifié quand l'équipement est pris), pièce, objet ordinaire et référence `fits`, refuse un service, et refuse une quantité qui nécessiterait plus de piles qu'un sac n'en accepte à la fois.

### Marchés

Un `market` dans le bloc `items` (Capability API 1.65) indique ce que vend un lieu et à quel prix, au lieu que chaque boutique vende tout à son prix catalogue. Celui de Gravewatch, un peu raccourci :

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices` : de un à huit niveaux, chacun un multiplicateur (`times`, supérieur à 0) du `cost` d'un objet, dont l'un est le `default`. Un prix est le coût en plus petite pièce de la famille multiplié par le niveau, arrondi à cette pièce (jamais moins d'une pièce pour ce qui coûte quelque chose), et exprimé dans la pièce où son coût est écrit si cette pièce le paie exactement, sinon dans la plus grosse pièce, parmi celles que laissent tes couches, qui le paie exactement : à `dear`, un manteau qui coûte 8 shillings en coûte 12, et une potion 5e qui coûte 50 gp coûte 50 pièces d'or, jamais 5 pièces de platine. Le marchandage ou l'humeur d'un vendeur déplace le niveau, jamais le nombre.
- `places` : de une à douze tailles de lieux, de la plus petite à la plus grande, dans tes propres mots.
- `sold` : des règles donnant le plus petit lieu qui vend ce que choisit un filtre. Un filtre nomme une `rarity`, une `category` et un `tag`, n'importe lesquels, et correspond à un objet qui a tous ceux qu'il nomme ; la première règle qui correspond à un objet décide. Le `sold` propre à un objet l'emporte sur les règles, et un objet que rien ne nomme est vendu partout.
- `sellers` : des types de vendeurs, chacun avec ce qu'il vend (`sells`, des filtres dont n'importe lequel choisit un objet), le plus petit lieu (`place`) qui en compte un (partout, sans lui), et facultativement à qui il vend exclusivement (`only`) : une valeur de la fiche de l'acheteur, avec son état courant et ce qu'il transporte, d'au moins `atLeast`, présentée au Game Master sous la forme de `label`. Sans `sellers`, n'importe qui dans un lieu vend tout ce que ce lieu vend.
- Un objet sans `cost` n'est pas à vendre, pas plus qu'un objet qu'une couche masque ou dont une couche a retiré les pièces.

**Où se trouve l'équipe.** Le Game Master indique dans quel lieu se situe une scène et sa taille avec `[place: name="Millbrook" size="market town"]`, la taille par son identifiant ou son libellé, et omet la taille pour un endroit sans marché (une route, la nature sauvage). Le moteur répond à chaque balise sur place, en refusant une taille que tu n'as pas, et le dernier lieu auquel il a répondu dans les réponses du Game Master que voit le joueur, depuis le dernier début de conversation, est le lieu en vigueur jusqu'à ce qu'un autre soit indiqué. Une balise de lieu saisie par un joueur ne compte jamais. Une réponse régénérée ne lit que ce qui précède la réponse qu'elle remplace.

**Acheter.** Le Game Master achète avec `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, `level` (le niveau par défaut sans lui) et `seller` (n'importe quel vendeur présent qui vend l'objet, sans lui) étant facultatifs. Le moteur fixe le prix selon le lieu en vigueur à la fin de la réponse, retire ce prix de la bourse de l'acheteur (celle du joueur sans `who=`) comme pour un paiement, avec la monnaie, et place l'objet dans son sac, ou se contente de payer pour un service. Soit les deux se produisent, soit aucun. La réponse indique le coût (`price="12 shillings"`) ainsi que ce qui a été payé et rendu, et une notification l'affiche. Un achat est refusé, sans rien changer, si aucun lieu n'est indiqué (`no-place`), si le niveau, l'objet ou le vendeur n'existe pas chez toi (`unknown-level`, `unknown-item`), s'il n'y a pas de prix (`not-for-sale`), si le lieu est trop petit pour l'objet (`not-here`), si aucun vendeur présent ne le vend (`no-seller`), si l'acheteur ne remplit pas l'`only` du vendeur (`not-to-you`), si la bourse ne peut pas le couvrir (`cannot-afford`), ou si le sac ne peut pas le porter.

**Ce que voit le Game Master.** Tant qu'une scène se déroule dans un lieu doté d'un marché, un bloc MARKET nomme le lieu et sa taille, les niveaux de prix, et chaque vendeur présent avec une douzaine de ses articles au niveau par défaut, les moins chers d'abord ; tout ce qu'il vend peut être acheté par son nom. Ses instructions enseignent `[place:]` et `buy`, et seul un ensemble doté d'un marché les reçoit.

#### Un jour de marché

Un jour de marché (Capability API 1.69) fait changer et s'épuiser les étals d'un lieu, et permet à l'équipe de revendre. Celui de Gravewatch, un peu raccourci :

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **Le jour.** Un jour dans un lieu dure jusqu'à ce que le Game Master nomme un autre lieu ; il commence un nouveau jour au même lieu en le nommant à nouveau avec `day="new"` (`[place: name="Millbrook" size="market town" day="new"]`). Tout ce qui suit est calculé par jour à partir des réponses du Game Master que voit le joueur ; un swipe, une réponse régénérée ou une branche n'ont donc besoin de rien stocker, et un même jour donne toujours le même étal.
- **`limited`** sur une règle `sold` ou sur le `sold` propre à un objet : combien d'exemplaires un lieu garde en stock pour une journée, un nombre ou des dés lancés pour la journée. Une règle peut nommer une limite sans lieu (vendu partout, quelques exemplaires à la fois) ; le lieu d'un objet vient de la première règle qui nomme un lieu, et sa limite de la première qui nomme une limite. Une fois ces exemplaires achetés, un achat est refusé (`sold-out`) jusqu'au jour suivant.
- **`stock`** sur un vendeur : l'une de tes tables de butin, lancée une fois par jour pour ce que ce vendeur a en stock en plus de ce qu'il vend. Ce qu'elle donne (des objets seulement, jamais de pièces) n'est vendu que par ce vendeur, en autant d'exemplaires qu'obtenus, quoi que disent `sells` et `sold` ; l'`only` d'un vendeur s'applique toujours.
- **`buyBack`** : la part (supérieure à 0, au plus 1) du prix par défaut d'un objet qu'un vendeur paie pour le racheter. Un vendeur présent qui vend ce genre d'article le rachète (n'importe qui, sans vendeurs). Sans `buyBack`, personne ne rachète rien.
- **`purse`** sur une taille de lieu : le maximum que ses vendeurs déboursent en une journée, tous ensemble, dans l'une de tes pièces. Les ventes payées dans la famille de cette pièce sont décomptées de cette bourse ; sans bourse, ils achètent sans limite.
- **Vendre.** Le Game Master vend avec `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. Le moteur fixe le prix, retire l'objet du sac de celui qui vend (celui du joueur sans `who=` ; jamais un objet maudit lié) et y verse les pièces, les plus grosses d'abord, ou refuse sans rien changer : aucun lieu indiqué, personne ici ne l'achète (`not-bought`), pas de prix (`not-for-sale`), bourse du jour épuisée (`purse-spent`), aucun exemplaire détenu, ou des pièces que le sac ne peut pas porter. La réponse indique ce qu'il a rapporté (`price="4 shillings"`), le journal de la partie le liste comme vendu, et une notification l'affiche.
- Le bloc MARKET ajoute ce que chaque vendeur a en stock aujourd'hui, combien il reste d'un objet limité, ce que paient les vendeurs présents et ce qu'il reste de la bourse du jour ; ses instructions enseignent `sell` et `day="new"`.

#### Vendeurs honnêtes et malhonnêtes

Capability API 1.79 permet qu'un objet soit risqué ou une contrefaçon, et qu'un vendeur soit malhonnête.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** sur un objet : ce dont un vendeur honnête prévient avant de le vendre. Le bloc MARKET le liste avec "(warn the buyer first: ...)" à côté de la marchandise d'un vendeur honnête ; un vendeur malhonnête ne dit rien.
- **`passesFor`** sur un objet en fait une contrefaçon d'un autre objet (`<catalog>/<entry>`) : un objet réel et vendable de la même catégorie, porté dans les mêmes emplacements, qui se lie si la contrefaçon se lie. Il est vérifié à l'importation là où les deux sont lisibles, à l'installation pour chaque fichier de catalogue, et de nouveau quand un marché le propose : une contrefaçon dont la cible manque ou est cachée par une couche n'est donc jamais vendue. Un objet maudit (`binds.cursed`) ou une contrefaçon ne figure jamais parmi les marchandises de qui que ce soit, ni dans le stock d'un vendeur honnête.
- **`honest: false`** sur un vendeur : une contrefaçon que tire sa table `stock` est proposée comme l'objet qu'elle imite, au prix de cet objet, et le bloc MARKET montre la vérité au Game Master à côté. Un achat qui nomme ce vendeur et cet objet obtient la contrefaçon ; un achat qui ne nomme aucun vendeur ne l'obtient jamais.
- **Une contrefaçon dans le sac** apparaît comme l'objet qu'elle imite partout où le joueur regarde (le sac, le journal, les notifications, les combats), et garde ce qu'elle est vraiment. Le bloc d'inventaire du Game Master la marque `[FAKE: really ...]` et lui demande de continuer à l'appeler par le nom sous lequel elle s'affiche.
- **Démasquée** : `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, en la liant (l'harmonisation révèle une malédiction), en l'utilisant (ce qu'elle fait vraiment se produit ; quand les règles n'en tirent rien, le Game Master le raconte), ou en la vendant à un acheteur honnête, qui dit ce qu'elle est vraiment et paie ce que cela vaut (son propre `cost`), ou refuse si elle n'en a pas. Un acheteur malhonnête prend une contrefaçon pour ce qu'elle semble être. Dès lors, elle devient son véritable objet.
- **Portée ou transportée** : une contrefaçon fait ce qu'elle fait vraiment sur la fiche du personnage (ses effets `worn` ou `carried` et ses statistiques). Le premier changement d'inventaire après lequel la fiche affiche un nombre, ou ce qu'ajoute un test, que l'objet imité ne donnerait pas, la démasque, et le journal et l'écran disent ce qu'elle était. Une différence que seul un combat lit (une résistance) ne la démasque pas, pas plus qu'un changement de la seule fiche jusqu'au changement d'inventaire suivant. En combat, une arme contrefaite portée attaque toujours comme l'arme qu'elle imite.
- En confiance solo (un seul joueur), Peek Prompt montre la vue du Game Master, vérité comprise.

<a id="using-items-outside-a-fight"></a>

### Utiliser des objets hors combat

Le même `use` fonctionne hors combat (Capability API 1.60 pour `restore` ; le reste ne nécessite rien de nouveau). Le bouton **Use** de l'inventaire, sur l'un de tes objets doté d'un `use`, et la commande `[inventory: action="use" item="Poultice" who="Juno"]` du Game Master font tous deux ce que fait l'objet à celui qui le transporte, avec les dés du moteur :

- Un soin rend de la santé : la quantité sur une réserve de santé, ou une marque effacée sur une piste de blessures, comme un soin en combat. Les points `temporary` vont sur une réserve de santé, `restore` rend sa réserve, et chaque état qu'il `applies` est infligé, jusqu'à ce que quelque chose le retire.
- Une utilisation qui blesse, ou qui vise le camp adverse (`kind` `attack` ou `debuff`, ou `targets` `enemy`), n'atteint personne : hors combat, il n'y a personne sur le plateau à frapper. L'objet est tout de même utilisé, et le Game Master apprend ce qu'il fait, pour le raconter.
- Elle retire un exemplaire de la pile ou dépense ses charges exactement comme en combat, et un objet qui n'en a plus, ou qui occupe un emplacement ou se lie et n'est pas porté, est refusé sans rien changer. La fiche et le sac sont écrits ensemble.
- Un `gate` est lancé d'abord, comme un test : les dés propres à l'ensemble avec le nombre de la fiche, la pénalité de blessure de l'utilisateur et ce que ses états et ses objets portés ou transportés font à ce test. Un échec consomme l'objet pour rien, et la ligne le dit ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

Ce qui s'est passé est dit en une ligne : "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." Le bouton Use l'envoie au Game Master dans un bloc `[item_used]` après "I use my Poultice.", que le chat affiche sous forme de badge ; la balise du Game Master lui-même reçoit la même réponse, mesurée depuis le début du tour comme ses autres balises, si bien qu'une réponse régénérée n'utilise jamais un objet deux fois. Un objet sans `use`, ou dans une partie sans ensemble de règles, est toujours simplement mentionné : "I use my rope."

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Batailles : prêter la fiche au combat de Marinara

Par défaut, une bataille ignore la fiche. Elle construit les combattants comme toujours ; un personnage peut sortir du combat sans changement de ses points de vie sur la fiche.

Le bloc facultatif `battle` change cela dans un seul sens : il prête les nombres au combat et réécrit son résultat. **Il ne fait pas suivre tes règles au combat.** Les calculs, les coups qui touchent et leurs dégâts restent ceux de Marinara. La santé est donc transférée comme proportion du maximum, pas comme ton nombre : une fiche à moitié de sa santé commence à mi-barre de celle construite par Marinara. Ta réserve de 9 points n'est jamais placée directement dans une bataille où un coup fait 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health` : obligatoire. Réserve vivante représentant les points de vie en combat. Elle doit appartenir à `sheet.live.pools`, pas être une liste dont les lignes sont des réserves.
- `energy` : facultatif. Réserve dépensable par la bataille, qui devient la barre MP. Elle doit différer de `health` : le combat ne peut pas consommer la santé comme énergie.
- `slots` : facultatif. Réserves dépensées une unité à la fois, chacune avec `level` de 1 à 9 : `[{ "pool": "slots_1", "level": 1 }]`. Chaque niveau et chaque réserve ne sont utilisés qu'une fois.
- `skills` : facultatif, jusqu'à huit. Listes dont les lignes deviennent des compétences de combat. Seules comptent les lignes issues de tes catalogues et dont l'entrée porte `mechanics` : une ligne saisie à la main n'exprime rien numériquement. `onlyWhen` nomme une colonne booléenne qui doit être active, comme un sort préparé. `alwaysWhen` nomme une colonne et une valeur qui laissent passer malgré tout, comme un sort sans préparation. C'est l'exception à `onlyWhen`, donc elle est refusée sans lui.

### Ce qui entre et ce qui revient

**À l'entrée**, pour chaque membre dont la partie possède la fiche : la proportion de santé fixe le début sur la barre Marinara ; l'énergie devient MP ; chaque réserve d'emplacements devient ceux de ce niveau ; les lignes marquées deviennent des compétences. Santé maximale, attaque, défense, vitesse et niveau restent les nombres de Marinara. Une réserve de santé à zéro fait commencer à terre ; au-dessus de zéro, le personnage commence toujours avec au moins un point, pour qu'une petite proportion ne le fasse pas tomber par arrondi.

**À la sortie**, quand le combat est terminé : la proportion finale de la barre est convertie à l'échelle de la réserve, et la différence avec le début est appliquée en dégâts ou soins. Énergie et emplacements sont des comptes, pas des proportions ; ils reviennent tels quels. Tout suit les règles des boutons de la fiche ; un changement refusé est ignoré et signalé, pas forcé. Un combat sans changement de santé n'en écrit aucun, pour que les deux conversions ne puissent pas déplacer la fiche à elles seules.

**Dans aucun sens** : jets d'attaque, sauvegardes, concentration et effets d'un coût supérieur. Ils figurent dans `mechanics` pour être lus un jour par un véritable système de combat ; ce pont ne les applique pas et l'ensemble ne doit pas prétendre le contraire.

Une bataille abandonnée ne réécrit rien. Si tu supprimes le message de départ ou si elle ne finit jamais, la fiche reste identique : le combat n'a pas eu lieu.

### Comment une entrée devient une compétence

Le bloc `mechanics` est lu ainsi :

- `kind` devient le type de compétence. Les entrées `utility` et celles marquées `reaction` sont omises, car le combat Marinara n'a pas où les placer.
- `amount` fixe la puissance comme multiplicateur de l'attaque du combattant, pas comme nombre de dégâts. Des dés plus grands ne frappent jamais moins fort ; le multiplicateur reste dans la plage des compétences générées.
- `range` et `area.size` sont divisés par `units.distance.perCell` du catalogue pour obtenir des cases, sans jamais arrondir à zéro. Une explosion prend son rayon, un cône la moitié et une ligne une case. Une zone cible tous les ennemis couverts et respecte `friendlyFire`.
- `damageType` devient l'élément. `targets` n'est pas transféré : Marinara décide des cibles des soins, améliorations et attaques selon le type de compétence.
- Un `cost` d'énergie devient un coût MP ; plusieurs sont additionnés. Un `cost` d'exactement un emplacement en consomme un de ce niveau. Marinara facture une quantité d'énergie ou un emplacement, jamais les deux : il omet deux emplacements, des emplacements de deux niveaux ou un emplacement plus énergie. Les coûts d'autres réserves, comme la santé ou une ressource de classe, sont aussi omis pour ne pas les offrir gratuitement.
- `buff` et `debuff` deviennent les effets propres à Marinara. Les autres promesses du texte, comme retirer un état de la fiche, ne sont pas appliquées. Omets `mechanics` si l'effet n'a de sens qu'en dehors d'une bataille.

`coverage.combat` reste distinct et garde son sens : active-le seulement si les batailles suivent réellement les règles de ton système.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Combat : une lutte résolue par tes propres règles

Le bloc `battle` prête les nombres de la fiche au combat en gardant l'arithmétique Marinara. Le bloc facultatif `combat` définit comment tes règles RÉSOLVENT le combat. Il paramètre un type de combat détenu par le moteur, comme `resolution` paramètre les tests ; tous ses noms sont les tiens. Il en existe deux : `attack-vs-defense`, où les dés sont additionnés et comparés à un nombre, et `dice-pool`, où un combat lance les réserves propres à ton ensemble `dice-pool` et compte les réussites (voir Un combat lancé en réserves, ci-dessous).

**Une partie dont l'ensemble déclare `combat` combat selon ton bloc.** Les nombres du groupe viennent de leurs fiches, les adversaires de ton bestiaire ou échelle de menace, et chaque tour est résolu par tes dés. Toute dépense ou perte est écrite dans la fiche immédiatement : fermer l'onglet au milieu ne perd rien. L'écran utilise tes mots : attaques et capacités au menu, budgets, états et journal des vrais calculs. Ce qui manque est listé dans la section sur les limites actuelles.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

C'est tout le bloc Ember Roads, et ses parties l'utilisent pour combattre. Le brouillon 5e utilise les mêmes clés pour d20 :

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

### Toutes les clés

- `kind` : `"attack-vs-defense"` (un camp lance les dés contre la défense de l'autre ; toucher inflige des dégâts) ou `"dice-pool"` (voir Un combat lancé en réserves). Chaque clé ci-dessous a le même sens dans les deux cas, lue à la manière dont ce type lit les nombres.
- `health` : obligatoire. Ce que retire le combat : `{ "pool": "grit" }`, une réserve qui diminue et dont le tampon temporaire absorbe les dégâts d'abord s'il existe ; ou `{ "track": "harm" }`, une piste de blessures MARQUÉE. La piste exige `damageKinds` et n'accorde aucun point temporaire.
- `defense` : obligatoire, référence de valeur. Un champ saisi par le joueur ou une valeur dérivée calculée.
- `initiative` : obligatoire. Dés lancés une fois au début et référence facultative de modificateur. Une égalité favorise le plus grand modificateur, puis l'ordre de création du combat. `"each": "round"` relance l'initiative de tout le monde au début de chaque nouvelle ronde, avec le modificateur tel qu'il est alors (un modificateur qui lit une piste de blessures ralentit donc une fois blessé), et la ronde commence par celui qui est premier dans le nouvel ordre. Capability API 1.47. Un combat `dice-pool` peut plutôt la lancer comme une réserve : `pool` (une référence de valeur) indique combien de dés, et leurs réussites plus `plus` donnent le nombre, sans `dice` ni `modifier` à côté. `resource`, qui exige `pool`, conserve ce nombre et laisse les attaques le déplacer (voir "Une initiative que les attaques déplacent", ci-dessous). Capability API 1.48.
- `attackRoll` : obligatoire sous `attack-vs-defense`, et refusé sous `dice-pool`, qui lance les réserves propres à ta résolution. Définit les dés, si l'on lance deux fois pour en garder un (`advantage`), les faces extrêmes d'un seul dé (`naturals.max` : `critical`, `hit` ou `none` ; `naturals.min` : `miss` ou `none`) et l'effet d'un critique (`critical` : `double-dice` relance les dés de dégâts ; `max-dice` ajoute une fois leurs faces maximales ; `none` donne un coup ordinaire). Les faces spéciales exigent un seul dé, comme les tests. Les sauvegardes du combat utilisent les mêmes dés. `criticalFrom` élargit la face critique : une valeur lue sur la fiche de l'attaquant qui est la plus petite face naturelle comptant comme critique, comme `{ "field": "critical_from" }` pour un Champion de 5e dont la fiche indique 19. Elle est plafonnée à la face la plus haute du dé, une valeur inférieure à 2 signifie aucune plage (la face la plus haute seulement, comme pour un personnage dont le champ reste à 0), et elle exige un seul dé avec `naturals.max` réglé sur `critical`. Capability API 1.81.
- `economy` : obligatoire. `budgets` définit le contenu d'un tour : identifiant, libellé, `per` (`turn` remplit au début du tour du porteur ; `round`, au début d'une ronde) et `count`. Le PREMIER budget est le principal, dépensé par les actions standard. `movement` est une référence facultative de distance parcourue par tour, dans ton unité. Les combats sur plateau la lisent ; voir Positions.
- `attacks` : facultatif. Listes de fiche dont les lignes sont des armes. `name` est la colonne de nom ; `damage.dice`, celle des dés ; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` et `damage.type` nomment des colonnes de la même liste. Une colonne `ability` est un `enum` contenant un identifiant d'attribut ; un autre contenu n'ajoute rien. `proficiency` est `boolean` : l'activer ajoute la maîtrise. Sans dés lisibles, la ligne n'est pas une attaque ; une corde reste une corde. `toHit.skill` nomme une colonne `enum` contenant l'un de tes identifiants de compétence : la ligne ajoute ce qu'ajoute un test de cette compétence, avec l'`ability` propre à la ligne à la place de celui de la compétence si elle en nomme un, exactement comme le `with=` d'un test l'échange (Capability API 1.47). `strikes` référence le nombre d'attaques acheté par UNE dépense du budget. Choisir une ligne sans attaques disponibles dépense le budget et met les restantes en réserve. Tant qu'il en reste, toutes les lignes déclarant `strikes` sont gratuites : changer d'arme, de cible ou marcher entre les attaques découle du menu. `strikesCappedBy` nomme une colonne booléenne limitant SA ligne à une seule attaque, quel que soit le nombre acheté : cela sert aux armes tirant une fois par tour, comme la propriété Loading du SRD 5.1. Cela n'a aucun sens, et est refusé, pour une liste qui achète déjà une attaque par dépense. Les attaques disponibles appartiennent au COMBATTANT, pas à une liste : deux listes déclarant `strikes` partagent le même nombre, quelle que soit la ligne utilisée. Elles sont effacées à la fin du tour qui les a achetées. Sans déclaration, chaque dépense achète une attaque, comme auparavant.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities` : facultatif. Listes dont les lignes marquées par catalogue sont des capacités, filtrées comme `battle.skills` avec `onlyWhen` et `alwaysWhen`. Leurs effets sont le `mechanics` de l'entrée ; le bloc fixe le `budget` par défaut, le `toHit` ajouté si elle lance pour toucher et la `saveDifficulty` des sauvegardes. Une entrée demandant une sauvegarde, propre ou terminant un état appliqué, est refusée si sa liste n'a pas `saveDifficulty` : une sauvegarde contre rien réussirait toujours. Avec Capability API 1.108, `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` choisit les références selon la classe d'une ligne. Un clerc 3 / magicien 2 peut dériver l'attaque du clerc de la maîtrise plus la Sagesse et son DD de 8 plus cette attaque, et ceux du magicien de l'Intelligence. La colonne doit exister dans la liste de la source, et `values` contient de 1 à 20 entrées. Chaque entrée peut remplacer l'une ou l'autre référence ; une référence omise, une valeur de colonne absente ou une valeur non listée garde la référence propre de la source. Le combat, le résumé de ligne de la fiche et le résumé du Game Master lisent les mêmes nombres par ligne. `stamp` et `byColumn` exigent tous deux schemaVersion 2 et capabilityApi 1.108 ou plus récent.
- `standard` : facultatif, liste fermée `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (attaques reçues lancées deux fois en gardant la pire) et `help` (prochaine attaque de l'allié lancée deux fois en gardant la meilleure) sont toujours résolus. `dash` (un autre déplacement complet) et `disengage` (personne ne frappe pour ton éloignement ce tour) sont résolus sur plateau et seulement enregistrés sans lui. `hide` et `ready` sont acceptés sans effet pour l'instant.
- `standardEffects` : facultatif, effets d'une action standard absents de son indicateur. Seul `dodge` en a aujourd'hui : `{ "dodge": { "saves": ["dex_save"] } }` indique les sauvegardes lancées deux fois en gardant la meilleure tant qu'il dure. Nomme seulement des sauvegardes déclarées, et seulement si `standard` comprend `dodge`. Sans cela, esquiver rend plus difficile à toucher, sans autre effet.
- `conditions` : facultatif. Associe TES identifiants d'états à leurs effets pour que fiche et combat partagent un registre : un personnage empoisonné le reste ensuite. Liste fermée : `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) et `cannot-approach-source`. `failsSaves` nomme les sauvegardes échouées sans jet. Les six effets nécessitant distance ou déplacement (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) n'agissent que sur plateau ; voir Positions. `cannot-react` exclut le porteur des fenêtres ouvertes par un déplacement : il n'est jamais interrogé. Quatre clés s'ajoutent :
  - `modifiers` : les nombres qu'il modifie tant qu'il dure. Voir Les nombres qu'un état modifie, ci-dessous.
  - `saves` : sauvegardes visées par les deux effets de sauvegarde et par tout modificateur de sauvegarde. Sans cette clé, toutes ; la déclarer sans l'un ni l'autre à côté est refusé.
  - `skills` : compétences visées par les deux effets de test et par tout modificateur de test qui ne nomme pas ses propres compétences. Sans cette clé, toutes ; la déclarer sans l'un ni l'autre à côté est refusé. Les confrontations d'un combat lancent les tests propres au combat, pas des compétences : ce qui est restreint à des compétences n'en atteint donc jamais aucune, mais un test hors combat sur l'une de ces compétences le lit (voir Les tests hors combat, ci-dessous). Capability API 1.53.
  - `whileSourceInSight` : ce qui compte seulement quand l'auteur de l'état est visible du porteur. `true` conditionne tout l'état ; une liste de ses effets conditionne seulement ceux-ci et laisse les autres, comme une peur empêchant de s'approcher même sans voir la source. Un effet absent de l'état est refusé. Sans plateau, aucune ligne de vue ne peut être rompue et tout compte pareillement.
  - `endsWhenSourceDown` : l'état disparaît dès que son auteur tombe.
  - Sens (Capability API 1.127) : le `lacks` d'un état nomme des sens que son porteur n'a pas, et le `mechanics.needs` d'une entrée de catalogue ou le `needs` d'une action de créature nomme des sens qu'une cible doit avoir pour que l'effet agisse sur elle. Pour le Deafened de 5e, écris `"lacks": ["hearing"]` ; pour Command, écris `"needs": ["hearing"]` dans ses mécaniques. Une cible assourdie est retirée du menu de cibles de Command. Un effet de zone ou à plusieurs cibles qui nécessite l'ouïe ignore entièrement cette cible : ni sauvegarde, ni dégâts, ni états. Une fois Deafened terminé, la cible redevient valide. Chaque liste a de un à quatre identifiants de sens uniques, dans les mots propres de l'ensemble ; le moteur ne connaît aucun nom de sens.
  - Utilisable seulement quand la fiche le permet (Capability API 1.166) : le `mechanics.usableWhen` d'une entrée de catalogue s'écrit `{ "value": <value reference>, "atLeast": n, "atMost": n }` (une borne ou les deux). En combat, l'entrée est proposée, pendant le tour de son porteur ou dans une fenêtre de réaction, seulement tant que la valeur lue sur la fiche, l'état vivant et les objets de son porteur reste dans les bornes ; elle est relue chaque fois que le menu est affiché. La Protection de 5e exige un bouclier en main : `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. Le "no heavy armor" de Rage s'écrit de la même façon avec `"atMost": 0` sur le compte d'armures lourdes. Une créature écrite comme un bloc de statistiques n'a pas de fiche : rien ne la retient donc.
  - États appliqués seulement quand la fiche de celui qui les applique le permet (Capability API 1.167) : une entrée `applies` sur les mécaniques d'une entrée de catalogue ou l'utilisation d'un objet peut porter `"when"`, de même forme que `usableWhen`. Il est lu sur la fiche, l'état vivant et les objets de celui qui l'applique, au moment où l'état s'appliquerait, et une entrée hors de ses bornes est ignorée ; les autres s'appliquent quand même. La Rage de 5e applique `raging` et l'un de trois états de dégâts dans la limite de quatre entrées : `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, puis `raging_damage_3` avec `"atLeast": 9, "atMost": 15` et `raging_damage_4` avec `"atLeast": 16`. Quelqu'un qui applique sans fiche applique chaque entrée. Le bloc de statistiques d'une créature et le `onEnd` d'un état n'ont pas de fiche d'applicateur à lire : `when` y est donc refusé. Nécessite schemaVersion 2 et capabilityApi 1.167 ou plus récent.
  - Types de créatures et tests de cible (Capability API 1.168) : `combat.creatureTypes` liste ce qu'un combattant peut être, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id": "devil", "label": "devil" }], "field": "race", "default": "humanoid" }`. Une créature nomme son propre `type` et ses `tags` ; le type d'un personnage est la valeur du champ texte ou à choix `field` quand c'est l'un des types, sinon `default` (les personnages de 5e sont humanoïdes). Un test de cible s'écrit `{ "types": [...], "tags": [...] }` et réussit dès qu'une correspondance existe ; un combattant sans type ni tags ne correspond jamais. Il se place à trois endroits : le `targetIs` d'une clause de dégâts n'inflige cette clause qu'à une cible qui correspond (une tueuse de dragons : `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, l'eau bénite : `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`) ; le `targetIs` d'une entrée `applies` n'applique cet état qu'à une cible qui correspond ; et `mechanics.targetTypes: { "is": test, "not": test }` dit qui peut être choisi ou pris tout court (Animal Friendship : `{ "is": { "types": ["beast"] } }` ; Sleep : `{ "not": { "types": ["undead"] } }`). Une zone passe par-dessus ceux que `targetTypes` exclut. Une prévision ne compte une clause `targetIs` que contre une cible qu'elle atteindrait ; la simple moyenne de la fiche la laisse de côté. Le panneau de bataille et le Game Master voient le type et les tags de chaque combattant. Nécessite schemaVersion 2 et capabilityApi 1.168 ou plus récent.
  - Fins d'état (Capability API 1.125) : Charm Person utilise `"endsWhen": ["harmed-by-source-side"]`. Des dégâts supérieurs à zéro venant de celui qui l'a appliqué ou de quiconque de son camp, ou le fait qu'ils visent son porteur avec une attaque, une sauvegarde ou un état nuisible, y mettent fin une fois l'action nuisible entièrement résolue, même si l'attaque rate ou que la sauvegarde réussit. `"saveWhenDamaged": true` répète une sauvegarde de tour sur des dégâts : chaque quantité de dégâts supérieure à zéro répète le `saveEnds` de l'action d'application à son DD enregistré ; une réussite y met fin. Sans sauvegarde ou DD enregistré, rien n'est lancé. Hypnotic Pattern utilise `"endsWhen": ["damaged"]` et `"shakeOff": { "budget": "action" }` : tout dégât supérieur à zéro y met fin immédiatement, ou un autre combattant du camp du porteur peut dépenser ce budget pendant son propre tour pour y mettre fin. `shakeOff.reach` est dans l'unité de distance de l'ensemble et vaut une case par défaut ; sans plateau, aucune distance n'est mesurée. L'économie doit déclarer son budget. `endsWhen` a une ou deux entrées uniques. Ces clés laissent inchangées les fins liées à la chute de l'auteur et à la concentration. Pour une sauvegarde uniquement sur des dégâts supérieurs à zéro, jamais au début ni à la fin d'un tour, utilise `saveEnds.at: "damaged"` (Capability API 1.129) : l'applies de Dominate Person s'écrit `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, qui lance une fois par coup au DD enregistré de l'action d'application sans avoir besoin de `saveWhenDamaged`.
  - L'économie d'actions (Capability API 1.76), telle que Haste et Slow la modifient :
    - `budgets` : `[{ "budget": "haste", "flat": 1 }]` donne à son porteur autant d'unités en plus (ou en moins) d'un budget de tour à chaque tour, jamais en dessous de zéro. Seul un budget qui se remplit `per` tour peut être modifié ainsi. Un budget peut être déclaré avec `"count": 0` pour qu'il ne soit rempli que par un état, et l'écran ne l'affiche que tant que quelqu'un en a. Un adversaire inventé n'en dépense jamais.
    - `grants` : `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true, "items": true }` indique sur quoi ce budget peut être dépensé : les actions standard nommées (tirées de la liste `standard` propre de l'ensemble, jamais sur le premier budget, où se trouve déjà chaque action standard), une attaque d'arme d'une seule frappe (quelles que soient les frappes qu'une action mettrait autrement en main ; pour une créature, une attaque de son bloc de statistiques contre une seule cible, jamais une attaque multiple), et l'utilisation d'un objet : `true` pour n'importe quel objet, ou `{ "tags": ["mundane"] }` pour seulement un objet portant l'un de ces tags d'objet (le Use an Object de 5e concerne un objet ordinaire, jamais l'activation d'un objet magique). Ils sont proposés une fois épuisé le budget qu'ils dépenseraient habituellement, et seulement pendant le propre tour du porteur : un octroi ne paie jamais une réaction.
    - `exclusive` : `["action", "bonus"]`, deux budgets dont un tour ne dépense qu'un seul : dépenser l'un vide l'autre.
    - `attacksPerTurn` : le nombre d'attaques (actions qui lancent pour toucher, chaque partie attaquante d'une séquence, et une confrontation qui remplace une frappe, comme une lutte) que son porteur fait pendant son propre tour, quoi qu'une action donnerait. Une réaction pendant le tour de quelqu'un d'autre n'est ni plafonnée ni comptée.
    - `onEnd` : `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, ce qu'il laisse derrière lui quand il prend fin pour de bon (il s'épuise, une sauvegarde ou des dégâts y mettent fin, la concentration est rompue), jamais quand il est appliqué de nouveau. Il dure quelques `rounds` (jamais `"until-save"` ni `"instant"`). Laissé en plein milieu du propre tour de son porteur, ses rondes commencent au tour suivant : une ronde correspond donc à tout le tour suivant.
  - Quand un combat prend fin, quelle que soit la façon, chaque état qu'il a appliqué avec un décompte, un `endsAfter` ou une concentration quitte la fiche sans rien laisser derrière lui, et la concentration prend fin. Un état sans décompte (l'état à terre causé par une chute) reste.

  `own-saves-advantage` et son contraire lancent deux fois et gardent un jet, comme les attaques ; ils s'annulent. `own-checks-advantage` et son contraire font de même pour le camp du porteur dans une confrontation, là où un combat fait ses tests d'attribut, et pour ses tests hors combat. `resist-all` réduit de moitié tous les dégâts en plus des défenses propres à la cible et s'annule avec une vulnérabilité de la même manière. `cannot-target-source` interdit de viser l'auteur de l'état avec quoi que ce soit (`cannot-target-source-side`, 1.278 : ni quiconque de son camp, sauf si c'est celui du porteur). `cannot-approach-source` interdit de s'en rapprocher davantage que la case actuelle, chemin compris : contourner jusqu'à une case aussi éloignée reste permis ; passer près de lui puis ressortir de l'autre côté ne l'est pas.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Dégâts qu'un état modifie (Capability API 1.133).** `damage` modifie ce que son porteur inflige ; `damage-taken` modifie ce que son porteur subit. Les deux acceptent `flat`, `dice` (et `minus`), ou `times: 0.5 | 2`. Les ajouts se produisent une fois par coup d'attaque réussi, même quand le coup a plusieurs clauses de dégâts ; les critiques doublent les dés ajoutés comme l'ensemble double ses autres dés. Les sauvegardes et les coups automatiques n'en reçoivent aucun. `times` modifie l'ensemble du coup après les ajouts et avant la résistance, en arrondissant le total vers le bas une seule fois pour toutes ses clauses. Les quantités ajoutées affrontent la résistance selon leur propre `damageType`, ou selon le type du coup s'il est omis. Les ajouts du même type rejoignent cette quantité avant la résistance.

  `attacks` vaut `weapon`, `spell` ou `any` (par défaut). Les lignes de liste d'attaques et les attaques d'objets équipés sont des armes, tout comme les jets d'attaque à cible unique des blocs de statistiques ; les capacités de catalogue (incantation des créatures comprise) et les utilisations d'objets sont des attaques de sort ou autres. `blow: "melee" | "ranged"` suit 1.118 : une arme de lancer utilisée à portée d'allonge compte donc comme au corps à corps. `ability` nomme l'attribut réellement choisi pour le jet d'attaque : l'attribut d'une ligne, ou le premier meilleur attribut proposé par un objet (finesse comprise). Les actions simples des blocs de statistiques n'en ont pas et ne correspondent jamais à une restriction d'attribut. Ces clés et `damageType` sont refusés sur les autres cibles de modificateur. `fromSource: true` est réservé à `damage-taken` : le coup doit venir de celui qui a appliqué l'état suivi. Un état non suivi, un niveau ou un objet n'a pas de source d'application et ne peut pas y correspondre.

  En 5e, déclare ces identifiants d'états sur la fiche, puis place ces entrées dans `combat.conditions` :

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor et Rage s'appliquent à leur lanceur ; Ray of Enfeeblement et Hunter's Mark s'appliquent à leur cible. Hex utilise l'entrée `damage-taken` de la marque avec `attacks: "any"` et `damageType: "necrotic"`. Les niveaux et les effets `worn`, `carried` et `otherwise` d'exigence des objets partagent ces modificateurs. Le menu d'attaque ne compte que les ajouts et multiplicateurs propres au porteur ; la marque d'une cible n'y est jamais promise. Les résumés de la fiche et du prompt décrivent les modificateurs de dégâts propres au porteur, et la vue de bataille décrit aussi ceux qu'il reçoit. Les packages qui utilisent l'une ou l'autre cible exigent schemaVersion 2 et capabilityApi 1.133 ou plus récent, y compris quand l'objet se trouve dans un fichier de catalogue séparé.

  **Les nombres qu'un état modifie.** Chaque entrée de `modifiers` nomme ce qu'elle modifie, `to`, et de combien :
  - `defense` : le nombre qu'une attaque contre le porteur doit atteindre. Un nombre fixe uniquement.
  - `attacks`, `saves`, `checks` : les jets d'attaque, sauvegardes et tests de confrontation du porteur. Un nombre fixe, ou des `dice` lancés à chaque jet (`"1d4"`) ; `minus: true` retire les dés au lieu de les ajouter.
  - `speed` : la distance que parcourt le porteur, dans ton unité de distance (`flat`), ou `times` 0.5 ou 2 pour la moitié ou le double, appliqué après tous les changements fixes. Lu seulement sur un plateau, comme `speed-zero`.
  - `health-max` : `times` 0.5 et rien d'autre réduit de moitié le maximum de santé du porteur, arrondi vers le bas et jamais en dessous de 1 (Capability API 1.115). Une piste de santé à cases n'a pas de maximum à réduire de moitié. La santé au-dessus du maximum réduit est perdue au début du combat, et les soins ne le dépassent jamais.

  Un modificateur de `checks` peut nommer ses propres `skills`, et un modificateur de `saves` ses propres `saves`, qui le restreignent à la place de ceux de l'état. L'un comme l'autre peut faire lancer deux fois avec `mode: "advantage"` ou `"disadvantage"`, compté avec les effets du même nom et s'annulant comme eux, avec ou sans nombre à côté ; un même état peut ainsi rendre Sneak plus difficile et Climb plus facile à la fois. Ces trois clés nécessitent Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Un nombre fixe porte son propre signe, et 0 est refusé. Chaque modificateur apparaît dans le journal à côté du jet qu'il a modifié, avec le nom de l'état ("12 + 5 + 3 (Blessed) = 20"), et les chances de toucher et de gagner affichées dans le menu en tiennent compte. Les états se cumulent entre eux ; le même état deux fois reste un seul état.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels` : facultatif. Des niveaux d'une piste vivante qui comptent comme des états tant que la piste est assez haute : c'est ainsi que s'exprime un état qui empire par degrés, comme l'épuisement. Chaque entrée nomme une `track` ordinaire (pas une piste de blessures), le niveau `at` auquel il commence et ce qu'il fait, avec les mêmes `effects`, `modifiers`, `failsSaves`, `saves` et `skills` qu'un état. Chaque niveau atteint par la piste compte : ils s'additionnent donc à mesure qu'elle monte. Un niveau n'a pas d'auteur et ne prend fin que lorsque ce qu'il lit redescend ; `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` et `cannot-approach-source` y sont donc refusés. Seul un combattant doté d'une fiche a des pistes. Le journal nomme un niveau par sa piste et son nombre ("- 1 (Heat 3)").

  À la place de `track`, un niveau peut lire une valeur `derived` (Capability API 1.54), calculée avec l'état courant et les objets du personnage, pour que personne n'ait rien à cocher : Ember Roads ralentit quiconque transporte 10 d'encombrement ou plus.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  Un seuil qui diffère d'un personnage à l'autre ("plus de cinq fois la Force") est une valeur dérivée qui le soustrait : `scale` par -1 donne la part à retirer, et une `sum` des deux est ce que lit le niveau.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` met le porteur hors du combat pour de bon dès le début, avant que quiconque ne bouge (Capability API 1.115). Cela, et la santé perdue par un maximum réduit de moitié, est réglé une seule fois, au début du combat ; tout autre niveau est lu chaque fois que le nombre qu'il modifie l'est.

  Les adversaires portent aussi des pistes (Capability API 1.115). Un adversaire sans fiche commence aux `tracks` qu'on lui donne, par tes identifiants de pistes : une créature que propose le Game Master peut les nommer (`"tracks": { "exhaustion": 2 }`), tout comme un adversaire du bestiaire placé dans un combat. Les `conditionImmunities` d'une créature peuvent nommer une piste que lit un niveau ; aucun des niveaux de cette piste ne la touche alors, avec ou sans fiche : les morts-vivants et les créatures artificielles de 5e, immunisés contre l'épuisement.

  Les modificateurs, les niveaux et les effets de test nécessitent Capability API 1.45.

- `checks` et `contests` : facultatifs. Ce que lit une confrontation, et les confrontations que n'importe qui peut engager en combat : agripper, pousser, se libérer. Voir Confrontations, ci-dessous. Capability API 1.43.
- `concentration` : facultatif. Champ vivant `text` enregistrant l'effet maintenu, `save` imposée par les dégâts, `floor` minimal de difficulté et `fromDamage`, part des dégâts qui la fixe si elle est supérieure. Commencer une autre capacité concentrée termine la première ; rater la sauvegarde la termine et retire les états qu'elle maintenait.
- `dying` : facultatif, `kind: "saves"`. Deux pistes comptant les jets (le nombre nécessaire est leur maximum), `dice`, `succeedAt`, effets des faces extrêmes (`naturals.max` : `revive-1` ou `success` ; `naturals.min` : `one-failure` ou `two-failures`), coût des dégâts à terre (`damageWhileDown`, `criticalWhileDown`) et `condition` du personnage à terre. Sans bloc, zéro santé met simplement à terre et les soins le ramènent.
- `damageTypes` : facultatif. Types du système, comparés sans tenir compte de la casse.
- `damageKinds` : obligatoire si `health` nomme une piste de blessures, refusé pour une réserve : seule une marque conserve un type. Définit les `kinds` marqués par un coup et le nombre de cases. `default` reçoit tout ce qui n'est pas associé, y compris les dégâts sans type ; `byType` associe `damageTypes` aux types de marques sans distinguer la casse : `"Fire"` et `"fire"` sont la même clé et les déclarer ensemble est refusé. `marks` n'a pas de valeur par défaut car ses deux réponses s'opposent : `"per-point"` compte les niveaux de santé selon les dégâts, donc trois dégâts marquent trois cases et les réduire est utile ; `"per-blow"` marque une case si le coup touche, quelle que soit sa force. Un coup à plusieurs clauses marque encore une seule case en prenant le type le plus grave passé. Indique le choix de ton système : `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool` : obligatoire sous `dice-pool`, refusé sous `attack-vs-defense`. Voir Un combat lancé en réserves.
- `spendLimits` : facultatif. Combien d'une réserve vivante un combattant peut dépenser par `turn` ou par `round` en combat, quel que soit son type : `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` est lu une fois au début du combat. Un coût qui dépasse ce qui reste de la limite n'est pas abordable et sort donc du menu, quel que soit le contenu de la réserve. Une limite par tour repart au début du propre tour de son porteur, une limite par ronde au début d'une ronde. Un adversaire écrit en nombres simples ne paie rien sur une fiche, une limite ne le contraint donc jamais ; un adversaire écrit sous forme de fiche paie avec ses propres réserves et est soumis à la limite comme n'importe qui. Capability API 1.47.
- `threat` : facultatif, nécessaire à un bestiaire. `tiers` est l'échelle d'adversaires : identifiant, libellé, plage `health`, `defense`, `toHit`, plage `damagePerRound` et `saveDifficulty`. Chaque créature nomme un palier ; un adversaire non écrit est ramené à celui demandé par le GM, sans sortir de l'échelle. `damagePerRound` décrit ce qu'il inflige à UNE cible par ronde, séquence complète comprise.

### Sauvegardes contre des états, des dégâts ou la magie (Capability API 1.134)

Un modificateur avec `to: "saves"` peut porter `against`. Il faut au moins l'un de `conditions` (identifiants d'états de la fiche), `damage` (types de dégâts) ou `magic: true`. Une seule correspondance suffit ; `saves` restreint toujours la sauvegarde concernée, en s'y ajoutant comme un ET. Utilise le `mode: "advantage"` du modificateur, pas `effects`, pour restreindre ainsi l'avantage. Ces modificateurs fonctionnent sur les états, les niveaux de piste ou dérivés atteints et les effets d'objets. Pour les traits de race, dérive une valeur du choix de race de la fiche et attache le modificateur à un niveau atteint quand cette valeur vaut 1. Exemples de modificateurs :

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave utilise `conditions: ["frightened"]`. Magic Resistance utilise `magic: true` sans `saves`, sur un niveau dérivé de la fiche ou un niveau de piste d'une créature. Les `applies` d'une action comptent même si la sauvegarde empêche l'état ; ses dégâts incluent chaque clause `plus`. Les noms de dégâts sont comparés sans tenir compte de la casse. La magie désigne la qualité `"magical"` de 1.101 : les `mechanics.qualities` d'un catalogue (même sans dégâts), le `damage.qualities` d'une action de créature, ou les tags d'un objet arme. Un sort doit porter cette qualité ; son nom ou son catalogue seuls ne le rendent pas magique. Une sauvegarde pour mettre fin à un état, y compris `saveWhenDamaged` et `saveEnds.at: "damaged"`, ne vaut que contre cet état. Les sauvegardes de concentration et contre la mort ne valent contre rien. Hors combat, les demandes de sauvegarde du Game Master ne portent ni source ni état structurés ; `against` ne correspond jamais à ces demandes. La fiche, les détails d'objet, les détails de bataille et le résumé de fiche du Game Master affichent ces restrictions. Nécessite schemaVersion 2 et capabilityApi 1.134 ou plus récent.

### Un combat lancé en réserves : `dice-pool`

Un ensemble `dice-pool` compte des réussites au lieu d'additionner les dés, et ses combats le peuvent aussi. `"kind": "dice-pool"` exige que `resolution.kind` vaille `"dice-pool"`, et il lit la fiche comme le font déjà tes tests de réserve : **chaque nombre qu'un jet ajoute est un nombre de dés, et chaque nombre qu'il doit atteindre est un nombre de réussites.** Rien n'est donc renommé :

- Un nombre pour toucher (celui d'une ligne d'attaque, le `toHit` d'une liste de capacités, celui de l'action d'une créature) est la réserve que lance une attaque. Le dé, la cible qu'un dé doit atteindre, et les faces qui doublent, explosent, annulent ou provoquent une maladresse sont ceux de ta `resolution`. La piste de blessures nommée par ton `resolution.penaltyFrom` retire sa pénalité de la réserve, comme pour un test.
- `defense` est le nombre de réussites dont une attaque a besoin, jamais moins d'une. Le modificateur d'un état à `defense`, et la couverture (`cover.bonus`, ou `cover.threeQuarters`), s'y ajoutent.
- Chaque réussite au-delà de celles nécessaires ajoute un dé de dégâts. Une maladresse rate, quoi qu'elle ait compté. Il n'y a pas de critiques : un coup puissant vaut ses dés supplémentaires.
- Le nombre d'une sauvegarde est sa réserve, et sa difficulté le nombre de réussites nécessaires. Une confrontation lance le test de chaque camp comme une réserve, et le camp qui obtient le plus de réussites gagne.
- Le modificateur d'un état aux attaques, sauvegardes ou tests est un nombre de dés ajoutés ou retirés ; c'est donc un nombre `flat` : un modificateur lancé (`dice`) est refusé.
- Les dégâts sont des dés de ton dé : les `dice` d'une quantité (celle d'une créature, d'une entrée) indiquent combien, et doivent être de ton dé, et sa partie `flat` correspond à des réussites automatiques, jamais lancées. La colonne de dés de dégâts d'une ligne d'attaque est lue pour son nombre de dés, `damage.ability` ajoute la valeur de cet attribut en dés, et `damage.bonus` ajoute des réussites automatiques. `perCostStep` et `scales` ajoutent des dés, comme toujours. Les soins et les points temporaires sont des quantités, additionnées comme avant.
- L'initiative est une somme (`initiative.dice` et `modifier`), ou une réserve si tu en demandes une (`initiative.pool`, ci-dessous), et une règle d'agonie garde ses propres dés.

Ce qu'un combat à réserve lance en plus se trouve dans son bloc `pool` :

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage` : si un jet qui penche est lancé deux fois en gardant celui qui a le plus de réussites (une maladresse compte comme moins que tout jet sans maladresse). Sans lui, un combat lance une seule fois, quoi que dise un état.
- `damageTarget` : la cible par dé contre laquelle sont lancés les dés de dégâts et d'absorption. La cible par défaut de ta résolution si tu l'omets. Ces dés comptent une fois chaque face égale ou supérieure, et rien d'autre : aucune face n'y double, n'explose, n'annule ni ne provoque de maladresse.
- `soak` : ce qu'une cible retire des dégâts d'un coup, par type de blessure. `all` est une référence de valeur pour tous les types, et `byKind` en donne une par type de ta piste de santé, qui l'emporte sur `all` pour son type ; un type que ni l'un ni l'autre ne nomme n'est pas absorbé. Avec `"roll": true`, la cible lance ce nombre de dés contre la cible de dégâts et chaque réussite en retire un. Avec `"roll": false`, le nombre est retiré des dés de dégâts avant leur lancer : il ne touche donc jamais les réussites automatiques, que l'absorption lancée retire comme les autres. Rien ne descend sous zéro, et rien n'est lancé pour absorber un coup qui n'a rien compté. Une créature donne ses propres nombres sous la forme `soak: { "all": 1, "byKind": { "knock": 3 } }`, ce qui exige que le `soak` du bloc indique comment l'absorption se fait. La résistance, la vulnérabilité, l'immunité et `resist-all` s'appliquent après l'absorption, à ce qui reste.
- `hardness` : une référence de valeur pour la dureté d'un combattant, quand l'initiative est un nombre que les attaques déplacent. Voir [Armures et effets portés en combat](#armor-and-worn-effects-in-a-fight).

Les dégâts de chaque cible sont lancés pour cette cible, car ce qu'un coup a gagné au-delà des réussites nécessaires, et ce qu'elle absorbe, lui appartiennent. La seconde clause d'un coup, et un effet supplémentaire, forment chacun leur propre réserve de dégâts de leur propre type, sans dés supplémentaires du coup. Le menu prévoit une réserve exactement : la chance d'atteindre les réussites nécessaires, et ce que valent les dés de dégâts après ce qu'absorbe la première cible.

Gravewatch est écrit ainsi : ses gardiens lancent une valeur et un métier, absorbent les coups avec Sinew et pas du tout les déchirures, peuvent dépenser un point de Resolve par tour, et relancent l'initiative à chaque ronde.

**Déclarer dans l'ordre inverse n'est pas implémenté.** Certains systèmes font déclarer son action à chacun avant que quiconque n'agisse, du plus lent au plus rapide. Dans un combat où chaque combattant choisit une action quand vient son tour, déclarer en premier ne change rien de ce que lit une règle ; une clé n'aurait donc rien à dire.

### Dés de dégâts minimum (Capability API 1.146)

Un combat en réserves peut garder des dés même contre une forte absorption, comme le fait **Overwhelming** dans Exalted :

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

C'est `combat.damage.minimum`, une référence de valeur lue sur la fiche actuelle de l'**attaquant**. Après que l'absorption statique a retiré des dés de la première réserve de dégâts d'un coup, la réserve est relevée à au moins ce nombre. Ce sont des dés entiers, arrondis vers le bas et bornés entre zéro et `resolution.pool.max`, pas des réussites automatiques : chaque dé restant peut échouer. L'absorption lancée retire toujours des réussites après le jet de dégâts ; elle ne réduit pas une réserve de dés, donc le minimum ne protège pas les réussites contre elle. La résistance et l'immunité s'appliquent toujours. Les coups qui dépensent de l'initiative ignorent le minimum, comme ils ignorent les dégâts d'arme et l'absorption ; les coups qui prennent de l'initiative l'utilisent.

Une arme peut remplacer le minimum commun avec `item.attack.damage.minimum`. Il accepte les mêmes références de valeur sur son porteur, ou `{ "stat": "overwhelming" }` pour l'une des statistiques numériques propres à l'objet. Un zéro déclaré remplace aussi le minimum commun. Cela diffère du `floor` d'arme existant, qui garantit une quantité de dégâts après absorption. Les clauses de dégâts supplémentaires et les effets supplémentaires ne reçoivent pas d'autre minimum. Le registre du combat et le journal affichent le minimum résolu à côté des dés. La clé de combat et la clé d'arme nécessitent toutes deux **Capability API 1.146** dans un package, y compris pour les armes dans des fichiers de catalogue externes.

### Un coup qui étourdit (Capability API 1.147)

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` est destiné aux combats en réserves. `over` lit la fiche actuelle de la **cible**, juste avant le coup. Un seul coup doit infliger **strictement plus** de dégâts que ce nombre, après absorption, sauvegardes et résistance. Ses clauses de dégâts comptent ensemble ; des coups séparés ne s'accumulent jamais pour étourdir. Sur une piste qui marque par coup, un coup qui inflige des dégâts compte comme un niveau. Un coup qui prend de l'initiative plutôt que de la santé ne peut pas étourdir. `measure` ne vaut pour l'instant que `"damage"`.

La cible saute exactement son prochain tour. D'autres coups étourdissants avant ce tour n'ajoutent pas de tours sautés. Le tour sauté fait quand même avancer les décomptes des états et le reste de la gestion des tours, y compris les changements de ronde et l'initiative relancée. Enregistrer puis recharger le combat conserve le saut en attente. `condition`, quand il est présent, nomme un état déclaré de la fiche. Le combat le marque jusqu'à ce que le tour sauté soit passé ou que le combat prenne fin. Un état déjà présent est laissé en place ; l'immunité contre l'état empêche la marque mais pas le saut. `text` est une narration facultative, pas un autre effet. Le journal et le contexte de combat du Game Master enregistrent le coup et le saut. La clé nécessite **Capability API 1.147**.

### La cible détermine le type de blessure (Capability API 1.148)

Ajoute `remap` à l'association `combat.damageKinds` existante ; garde ses `default`, `byType` et `marks` :

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

Un combat en réserves choisit d'abord le type de l'attaque avec son association ordinaire, puis lit le `when` de chaque remappage sur la **cible**. Un nombre non nul active la règle. `from` et `to` doivent tous deux être des types de la piste de blessures de santé. La première règle qui correspond l'emporte ; les remappages ne s'enchaînent pas. On peut en donner au plus 12. Avec `tags`, au moins un doit correspondre à l'attaque : une arme porte déjà `item.tags`, et les mécaniques de catalogue et les dégâts de créature portent déjà `qualities`. Ces noms viennent de `items.tags`. Sans `tags`, toute attaque de ce type peut correspondre. Aucun nouveau champ de tag d'attaque n'est nécessaire.

Le type obtenu décide à la fois de l'**absorption** et des marques de blessure. Ainsi, le coup létal d'une arme à feu peut devenir contondant contre un vampire et utiliser l'absorption contondante ; la même arme à feu contre quelqu'un d'autre, ou une lame contre ce vampire, garde son type ordinaire. Le _type_ de dégâts d'origine de l'attaque reste inchangé pour la résistance et l'immunité. Chaque clause de dégâts utilise son propre type et les tags de l'attaque. Le registre du combat et le journal montrent les types d'origine et remappés, et la prévision de dégâts lit la même règle. Une créature simple sans fiche peut satisfaire une référence constante, mais ne peut pas fournir de valeurs de fiche pour ces règles ; donne-lui une fiche de créature pour cela. Seule la nouvelle clé `remap` nécessite **Capability API 1.148** ; les associations de types de dégâts plus anciennes gardent leur compatibilité existante.

### Une initiative que les attaques déplacent

Certains systèmes à réserve gardent l'initiative comme un nombre pour tout le combat et laissent les attaques le déplacer : une façon d'attaquer la prend à la cible, une autre dépense celle de l'attaquant comme dégâts, et quiconque tombe jusqu'à une ligne fixée s'effondre. Un combat `dice-pool` peut l'exprimer (Capability API 1.48) :

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **L'ouverture.** Chacun lance `pool` dés au début du combat, et les réussites plus `plus` forment son nombre ; `resource` exige donc `pool` : des dés additionnés donnent un ordre, pas un nombre de dés. L'`initiativeModifier` d'une créature est sa réserve, puisque tout nombre qu'ajoute un combat à réserve est en dés. Le nombre est conservé : il n'est jamais relancé (`each` est refusé à côté de `resource`), et au début de chaque ronde l'ordre est trié selon les nombres du moment.
- **Styles.** Chaque attaque (une ligne d'attaque, une capacité ou une entrée de catalogue qui lance pour toucher et inflige des dégâts, l'action d'une créature qui en inflige, et une action faite d'autres actions) est proposée une fois par style, et un joueur choisit le style avant la cible. Jusqu'à quatre ; chacun prend ou dépense, et au moins un prend. Un choix qui ne nomme aucun style se fait dans le premier ; un choix dans un style où l'attaque n'est pas proposée est refusé. Une attaque garde le style dans lequel elle a été faite jusqu'à sa fin, même quand une réponse change le nombre de son auteur avant qu'elle ne touche.
- **Un style qui prend.** Sur un coup au but, les dégâts sont lancés comme d'habitude (les dés supplémentaires du coup, les dés de l'arme, l'absorption par type, les réussites automatiques), et ce qu'ils comptent est retiré du nombre de la cible plutôt que de sa santé. L'attaquant gagne le tout plus `gain`.
- **Un style qui dépense.** Proposé seulement tant que le nombre de l'attaquant est au-dessus de la ligne d'effondrement (0 si tu ne donnes pas de `crash`), et jamais pour une action faite d'autres actions, puisqu'un nombre se dépense sur un seul coup. Sur un coup au but, les dégâts sont le nombre de l'attaquant au moment de l'attaque, en dés contre la cible de dégâts, et rien d'autre : ni dés d'arme, ni dés supplémentaires du coup, ni réussites automatiques, ni absorption. Il marque la santé selon le type de blessure propre à l'attaque. Une fois l'attaque terminée, un nombre qui a touché quelque part revient à `base`, et un nombre qui n'a rien touché perd ce qu'indique `onMiss` pour le nombre avec lequel l'attaque a été faite (une table à seuils : paires `[at least, lose]`, croissantes ; rien sous le premier palier).
- **L'effondrement.** Un nombre qui tombe à `crash.at` ou en dessous s'est effondré : la `condition` (l'un de tes états, facultatif) est infligée, et celui qui l'a fait tomber là gagne `bonus`. Un échec qui fait s'effondrer son propre auteur ne donne de bonus à personne. Un combattant effondré ne peut pas dépenser. L'effondrement prend fin, état compris, quand son nombre repasse au-dessus de la ligne, après `recoverAfter` de ses propres tours (son nombre revient à `base` au début de ce tour), et quand le combat se termine, quelle qu'en soit l'issue. Quelqu'un dont le jet d'ouverture est sur la ligne ou en dessous commence le combat effondré. `base` doit être au-dessus de `crash.at`, sinon y revenir le ferait s'effondrer à nouveau.

Le menu montre la prévision propre à chaque style : la chance de toucher, et ce que prendrait un style qui prend ou les dégâts que ferait un style qui dépense. Le panneau d'état montre le nombre de chacun, et le journal indique chaque changement et sa raison : "Ada gains 5 initiative for crashing Rats, and is on 14." Le sélecteur du moteur évalue un coup qui prend un tour à l'avance : prendre puis dépenser, comparé à dépenser maintenant puis de nouveau depuis la base.

<a id="what-a-fight-reads-from-mechanics"></a>

### Ce qu'un combat lit dans `mechanics`

`kind` détermine si `amount` représente des dégâts ou des soins ; toute entrée marquée `reaction` reste hors du menu, tout comme une entrée `utility`, sauf si elle modifie ce que le tour lui-même peut contenir (voir ci-dessous). `attackRoll` effectue un jet contre la défense de la cible avec le `toHit` de la liste ; `autoHit` saute entièrement cette étape. `save` lance la sauvegarde de la cible contre la `saveDifficulty` de la liste, et `onSuccess` détermine si une réussite subit la moitié ou rien. `targetCount` indique combien de cibles elle peut viser. Une capacité sans jet d'attaque (une zone contre laquelle chacun effectue une sauvegarde, quelque chose qui touche directement) lance ses dés UNE FOIS pour toutes les cibles ; une capacité qui lance pour toucher chaque cible relance ses dés à chaque coup au but. `applies` impose des états à ce qu'elle affecte, chacun avec une `duration` de `instant` (sans horloge propre : il reste jusqu'à ce que quelque chose le retire), `until-save` (qui exige `saveEnds` à côté) ou `{ "rounds": n }`, et éventuellement un `saveEnds` qui nomme la sauvegarde et indique si elle se répète à `turn-end` ou `turn-start`. Les rondes se décomptent sur les propres tours du porteur, à la fin de chacun ; `{ "rounds": 1, "at": "turn-start" }` les décompte au début de chacun, ce qui permet de dire "jusqu'au début de ton prochain tour". `"of": "source"` (Capability API 1.119) compte plutôt les tours de celui qui l'a appliqué, à partir de son prochain tour, ce qui permet de dire "jusqu'à la fin de ton prochain tour" à propos de quelqu'un d'autre. Le `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` de Guiding Bolt donne l'avantage au prochain jet d'attaque contre sa cible avant la fin du prochain tour du lanceur. Si la source quitte le combat, les rondes se décomptent sur les propres tours du porteur. Le `delays` d'un état de combat (Capability API 1.120) retarde ce qu'utilise son porteur : une action tirée de l'un de ses `catalogs`, payée avec son `budget`, lance un dé de `chance.sides` faces et, à `chance.atLeast` ou plus, elle ne se produit pas encore. Au début du prochain tour du porteur, elle est achevée avec ce même budget et se poursuit comme elle l'aurait fait, réponses comprises ; s'il ne peut pas agir ou n'a plus rien de ce budget, elle est perdue. Ce qu'elle a coûté reste dépensé dans tous les cas. Le Slow de 5e s'écrit `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` retire l'état après le premier `own-attack` (le prochain jet d'attaque du porteur), `attacked` (le prochain jet d'attaque fait contre le porteur) ou `own-save` (la prochaine sauvegarde du porteur), quoi que dise son horloge ; `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` signifie donc "sur sa prochaine attaque avant la fin de son prochain tour". Un état qui dure le temps d'une attaque dure toute cette attaque, dégâts compris, et un nouvel état infligé par le même coup reste. Les deux nécessitent Capability API 1.45. `temporary` accorde des points temporaires à la réserve de santé, qui ne se cumulent jamais : la plus grande protection reste. `scales` augmente la quantité du nombre de DÉS supplémentaires que sa table donne pour la valeur lue. `cost` se paie par la commande `use` de la fiche elle-même, et `budget` remplace la partie de l'économie dépensée.

`plus` contient jusqu'à trois quantités SUPPLÉMENTAIRES sur le même coup, à côté de `amount`, chacune avec son propre jet et son propre type ("and 2d6 fire"). Une clause est `{ "dice": "2d6", "flat": 1, "type": "fire" }` et peut porter sa propre `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, que lance la CIBLE indépendamment de ce que l'action lui demandait déjà : `none` supprime toute cette clause en cas de réussite, `half` en laisse la moitié, et le reste du coup demeure intact dans les deux cas. Sans `difficulty`, elle reprend le nombre utilisé par la sauvegarde de l'action, puis la `saveDifficulty` de la liste. Un critique double les dés de chaque clause selon la même règle que ceux de la première quantité ; une clause sans `type` reprend le type de dégâts du coup, et le coup entier reste UN test de concentration, avec les dégâts additionnés, et un test de chute. Une clause nécessite un `amount` à accompagner, et un `heal` n'en porte aucune.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Trois clés indiquent ce qu'une entrée fait à l'économie du tour lui-même, et une entrée `utility` qui en déclare une est proposée au lieu d'être écartée :

- `free` : elle ne coûte aucun budget. Elle paie toujours le `cost` indiqué et ne peut pas aussi nommer un `budget`.
- `gives` : `[{ "budget": "action", "count": 1 }]`, jusqu'à quatre. L'utiliser ajoute immédiatement à ces budgets, avec un plafond égal à ce qu'un tour contient plus le don, pour que rien ne puisse être mis de côté pour un tour ultérieur.
- `standard` : `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Son détenteur peut effectuer ces actions standard avec CE budget. Elles sont proposées à côté des actions ordinaires sous la forme `standard:<id>@<budget>`, et l'entrée elle-même reste hors du menu lorsqu'elle n'est que cette permission, car une permission n'est pas quelque chose que l'on exécute.

Une entrée du nouveau `kind: "rider"` est PASSIVE : personne ne l'exécute, elle n'apparaît jamais au menu et ajoute automatiquement une clause de dégâts au premier coup au but admissible d'une période. Elle porte `rider` et rien d'autre qui puisse être exécuté :

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` nomme les listes d'attaques dont elle provient et `requires` une colonne vraie de leurs lignes ; ainsi, un effet supplémentaire qui ne se déclenche qu'avec certaines armes les précise sans qu'Engine sache ce qu'est une arme. N'indiquer ni l'un ni l'autre signifie n'importe quel coup au but de son détenteur. Une arme tenue depuis le sac n'est pas une ligne ; `weapons` (Capability API 1.70) nomme donc aussi les tags d'objet sur lesquels il se déclenche : `"weapons": { "tags": ["finesse", "ranged"] }` se déclenche sur un coup au but avec une arme tenue portant l'un ou l'autre tag, frappe de la main secondaire comprise. Ne nommer que `weapons` ne se déclenche sur aucune ligne, et ne nommer que des lignes ne se déclenche sur aucune arme tenue. `when` accepte N'IMPORTE LAQUELLE des options : `advantage` est l'orientation finale du jet d'attaque, et `ally-adjacent` désigne un allié de l'attaquant debout et capable d'agir, à une case de la cible sur un plateau et n'importe où sans plateau. `ally-adjacent-no-disadvantage` (Capability API 1.126) exige aussi que le jet final ne soit pas avec désavantage une fois avantage et désavantage annulés ; l'exemple ci-dessus l'utilise pour Sneak Attack. `oncePer` vaut `turn` (renouvelé au début de chaque tour, de sorte qu'un coup porté pendant qu'un autre agit peut encore en bénéficier) ou `round`. `amount` augmente avec le `scales` de l'entrée, et `type` est le type de dégâts, celui du coup par défaut.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Créatures : un bestiaire lu par le combat

Un catalogue qui déclare `"holds": "creatures"` contient des adversaires au lieu de lignes de fiche. Il n'alimente aucune liste, le sélecteur de l'éditeur de fiches ne le propose jamais, et tous ses nombres utilisent les clés déjà déclarées par ton bloc `combat`. Il nécessite un bloc `combat` et une échelle `threat`, car une créature est classée sous l'un de tes propres paliers.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

Les nombres ci-dessous sont la manière directe d'écrire une créature. Une créature écrite dans les termes de ton ensemble de règles, sous forme de `sheet`, tire plutôt `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` et `hardness` de cette fiche (voir "Une créature écrite dans les termes de ton ensemble de règles", ci-dessous).

- `health` : un nombre, ou `{ "dice": "3d6", "flat": 2 }`, lancé une fois à la création du combat. Une prévision lit la moyenne, donc un menu ne promet jamais un dé que personne n'a lancé.
- `defense`, `initiativeModifier`, `speed` : ce contre quoi l'attaque est lancée, ce qui est ajouté à l'initiative (ou, quand l'initiative est lancée comme une réserve, combien de dés elle lance) et la distance parcourue en un tour, dans ton unité de distance.
- `abilities` et `saves` : indexés par les identifiants de caractéristiques et de sauvegardes déclarés par ta fiche. Une sauvegarde absente vaut zéro.
- `checks` : ce qu'elle ajoute dans une confrontation, indexé par les identifiants de `combat.checks`. Un test qu'elle ne nomme pas vaut zéro. Capability API 1.43.
- `soak` : dans un combat `dice-pool` uniquement, ce qu'elle absorbe : `all` pour toute blessure, `byKind` pour un type de ta piste de santé. Capability API 1.47.
- `hardness` : quand l'initiative est un nombre que les attaques déplacent, un coup qui dépense et dont les dés sont inférieurs à cette valeur ne fait rien. Capability API 1.56.
- `speeds` et `hover` : la façon dont elle se déplace en plus de la marche (voir Autres façons de se déplacer, sous Positions). Capability API 1.113.
- `shield: true` : ses mains sont prises, donc l'alternative `twoHanded` d'une action ne s'applique pas. Capability API 1.102.
- `size` : l'une des `combat.sizes`, par identifiant, que lit le `maxSizeAbove` d'une confrontation (voir Tailles et DD d'évasion). Capability API 1.103.
- `type` et `tags` : l'un des `combat.creatureTypes.types` et jusqu'à huit de ses `tags`, par identifiant, que lisent les tests de cible (voir Types de créatures et tests de cible). Capability API 1.168.
- `resist`, `vulnerable`, `immune` : types de dégâts comparés sans tenir compte de la casse et vérifiés contre `combat.damageTypes` si tu en déclares. Une entrée `resist` ou `immune` peut aussi dire ce qui la traverse, `{ "type": "tearing", "except": ["silver"] }` : un coup porté par une arme (un objet) qui porte l'un de ces tags d'objet est subi tel quel (Capability API 1.55, voir [Les armes en combat](#weapons-in-a-fight)), tout comme une action dont les `damage.qualities` ou une entrée de catalogue dont les `mechanics.qualities` en nomment un (Capability API 1.101). `conditionImmunities` nomme tes propres états, ou une piste que lisent tes `combat.levels` (Capability API 1.115).
- `tier` : le barreau de `combat.threat` auquel elle appartient.
- `loot` (Capability API 1.63) : l'identifiant de la table de butin qu'un combat gagné lance pour elle (voir Butin, ci-dessus).
- `traits` : de courtes paires nom/texte montrées au Game Master. Elles ne sont jamais résolues, donc tout ce qui contient des nombres appartient à une action.
- `signaturePoints` : points rendus au début de son propre tour et dépensés pour les actions `signature`.
- `riders` : jusqu'à quatre, identiques au `rider` d'une entrée de catalogue, écrits sur le bloc. Chacun vaut `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, avec un `type` facultatif et un `actions` facultatif qui nomme les actions de ce bloc sur lesquelles il se déclenche. L'effet supplémentaire d'un bloc ne lit aucune liste de fiche : `sources` et `requires` sont donc les deux clés qu'il ne possède pas. Une créature écrite sous forme de fiche reçoit les effets supplémentaires de ses listes, exactement comme un personnage.
- `actions` : jusqu'à douze, chacune avec son propre `id`. Une action porte ce qu'un bloc de statistiques écrit à la main porte (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), plus quatre éléments propres aux créatures. `reach` est sa portée de frappe, `range` sa portée de lancer ou de tir et `area` sa forme d'impact, le tout dans ton unité de distance ; `range` peut être un simple nombre ou `{ "normal": 30, "long": 120 }` si elle porte plus loin avec une pénalité, et `area` vaut `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (voir Positions) :
  - `uses` : `{ "per": "encounter" | "day", "count": n }`. Lorsqu'ils sont épuisés, l'action quitte le menu.
  - `recharge` : `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Elle commence le combat disponible, est dépensée à l'utilisation, puis lance les dés au début du propre tour de la créature : `from` ou plus la rétablit. Le journal contient les dés dans les deux cas.
  - `damage.alternatives` (Capability API 1.102) : jusqu'à quatre quantités qu'elle inflige à la place de la première, chacune `{ "when": ..., "dice": "1d10", "flat": 3 }`, la première qui s'applique l'emportant. Le type, les clauses et les qualités restent ceux de l'action. `"when": "twoHanded"` s'applique sauf si la créature a `"shield": true`, ce qui correspond au "or 8 (1d10 + 3) slashing damage if used with two hands" de 5e ; `"when": { "selfHealthAtMost": 0.5 }` s'applique tant que sa santé ne dépasse pas cette part de son maximum, ce qui correspond au "or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer" d'une nuée. La prévision du menu et le coup la lisent tous deux telle qu'elle est.
  - `sequence` : d'autres actions du même bloc, dans l'ordre, chacune avec sa propre cible. **C'est ainsi que s'écrit une créature qui frappe deux fois en une action.** Un budget paie toute la séquence. Une séquence ne porte rien de propre et ne peut jamais nommer une autre séquence.
  - `signature` : `{ "cost": n }`, payée avec les points de la créature plutôt qu'un budget et uniquement pendant qu'un autre agit : le combat la propose dans la fenêtre entre deux tours (voir Fenêtres).
  - `reaction` : le même objet que le `mechanics.reaction` d'une entrée de catalogue (voir Fenêtres) : l'action ne figure sur le menu d'aucun tour et est proposée à la place au moment qu'elle nomme. Une réaction n'est pas aussi une action distinctive, et aucune séquence ne peut en faire une.
  - `self: true` : elle s'applique à la créature elle-même plutôt qu'à quelqu'un d'autre, et ne prend donc ni `targetCount` ni `area`. Les deux nécessitent Capability API 1.46. Une parade (Parry) est les deux, avec un état `parrying` qui ajoute 2 à la défense :

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```
- Une sauvegarde nécessite une difficulté sur l'action elle-même : `save.difficulty` pour une sauvegarde imposée par l'action, ou `saveDifficulty` pour un état qui prend fin sur sauvegarde lorsque l'action n'a pas sa propre sauvegarde. Une action de bloc s'écrit avec des nombres simples même sur une créature dotée d'une fiche : ce nombre réside donc sur l'action. La sauvegarde d'une clause peut omettre sa `difficulty` et reprendre ce même nombre.
- `damage.plus` est la même liste de clauses que le `plus` d'une entrée de catalogue, et se lit exactement de la même manière : `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` est une morsure qui porte la chaleur comme quantité distincte, avec sa propre résistance et son propre doublement.

Une action de créature peut rendre des points de vie avec `heal` (des dés, une quantité fixe ou les deux), plafonnés au maximum de sa cible. `targets: "ally"` atteint son propre camp, elle-même comprise ; `targets: "any"` atteint l'un ou l'autre camp. Sans `targets`, elle atteint l'autre camp comme avant. Ces clés nécessitent Capability API 1.121. Un soin ne porte ni `damage`, ni `toHit`, ni `save`, ni `area` ; `targets` n'accepte ni `self` ni `sequence`, et une séquence ne porte aucune de ces clés. Le Healing Touch d'un deva s'écrit :

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

Le `spellcasting` d'une créature (Capability API 1.123) lance des sorts de catalogue sans dépenser d'emplacements ni de points. Ses `saveDifficulty` et `toHit` fournissent les nombres du sort ; une créature avec une `sheet` peut les omettre pour utiliser les nombres d'incantation de sa fiche. Une créature simple doit fournir chaque nombre dont ses sorts ont besoin. Chaque `entry` nomme une entrée de catalogue existante avec des `mechanics`. Des `uses` omis signifient à volonté ; `level` est le niveau de lancement pour la mise à l'échelle `perCostStep`, ou la base de l'entrée s'il est omis. L'entrée fournit toujours son budget, ses cibles, sa concentration, ses réactions, ses zones et ses invocations. La liste d'une dryade pourrait s'écrire ainsi ; ces identifiants de sorts sont donnés à titre d'illustration et doivent être fournis dans un catalogue `spells` :

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

Pour un cercle de guenaudes, ajoute `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` à côté de `spells` et `"coven": true` sur chaque sort partagé. Ces sorts ne sont proposés que tant qu'au moins trois combattants debout du camp du lanceur portent cet identifiant de cercle, chacun à 30 unités de distance de l'ensemble ou moins du lanceur, en simple distance de cases. Sans plateau, tous les membres debout comptent. Les utilisations de chaque sort forment une réserve commune à ce cercle, indexée par identifiant de cercle et par entrée. Un bloc de cercle nécessite un sort de cercle et un sort de cercle nécessite le bloc ; les entrées en double sont refusées. Une créature proposée par le Game Master perd son `spellcasting` quand elle est ramenée dans les limites, car une échelle de menace ne peut pas borner une liste de sorts.

Le bestiaire du brouillon 5e contient cinq créatures écrites à la main dans `docs/development/ruleset-5e-2014.example.json`, couvrant une séquence, une recharge, une sauvegarde avec un état, des résistances et immunités, des utilisations limitées, des points d'actions distinctives et une créature écrite sous forme de fiche.

#### Une créature écrite dans les termes de ton ensemble de règles

Une créature ne doit pas forcément s'écrire avec des nombres simples. Donne-lui plutôt une `sheet`, avec exactement la structure d'une fiche de personnage, et le combat la construit comme un membre du groupe : sa santé, sa défense, ses sauvegardes, son initiative, sa vitesse et chaque attaque et capacité de ses listes résultent de tes propres formules de fiche. C'est ainsi qu'un ensemble de règles indique que ses adversaires possèdent les mêmes caractéristiques, compétences et listes que ses personnages, quelles qu'elles soient. Le Toll Warden d'Ember Roads :

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Chaque partie est facultative** : `abilities`, `skills`, `saves`, `bonuses`, `fields` et `lists`, indexés par les identifiants déclarés dans ta fiche. Tout élément omis prend la valeur par défaut de ta fiche, exactement comme sur un personnage vierge. Le Grit du gardien vaut 9 parce que ton `grit_max` additionne 4, sa Toughness et son Brawn, et sa Guard vaut 7 pour une raison similaire.
- **Chaque nombre n'a qu'une source.** Une créature avec une fiche ne fournit pas aussi `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` ou `checks`, et Engine refuse le fichier si elle le fait. Elle peut n'avoir aucune `actions` propre, puisque ses listes définissent ce qu'elle fait. Une créature sans fiche fournit toujours les trois premiers et au moins une action.
- **Elle est vérifiée comme les données d'auteur qu'elle est.** Chaque identifiant doit être déclaré par ta fiche ; une compétence ou sauvegarde prend l'un des paliers de maîtrise que tu lui proposes ; un champ, score, bonus ou colonne contient ce qu'il est déclaré contenir (un entier dans son intervalle, une de ses valeurs, etc.), et une liste ne contient pas plus de lignes qu'elle n'en autorise. Il n'y a pas de partie `live`, car le combat conserve les dépenses de la créature.
- **Une ligne peut provenir d'un catalogue.** `_catalog: "<catalog>/<entry>"` nomme l'entrée dont une ligne a été sélectionnée, comme sur une fiche de personnage, et le combat lit dans cette entrée le coût et l'effet de la ligne. Le catalogue doit alimenter cette liste. Quand le catalogue est intégré au fichier, l'entrée doit s'y trouver ; quand il possède son propre fichier, une ligne qui nomme une entrée absente de ce fichier ne donne simplement rien à la créature. Les catalogues nommés par les fiches d'un bestiaire sont chargés pour le combat avec le bestiaire.
- **Ce que l'entrée indique à côté de la fiche compte toujours** : `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` et `conditionImmunities`.
- **Elle paie dans ses propres réserves.** Elles commencent pleines ; elle les dépense pour ce que lui donnent ses listes, et les paiements supérieurs (un sort avec un emplacement supérieur) lui sont proposés exactement comme à un membre du groupe, qu'Engine ou le Game Master décide pour elle. Hold the Line coûte de la Luck au gardien.
- **Avec une piste de blessures, sa santé est la piste.** Un coup marque la propre piste de la créature selon tes `damageKinds`, après application de ses `resist`, `vulnerable` et `immune` ; une créature immunisée à un type de dégâts n'en reçoit donc aucune marque.
- **Elle reste un adversaire.** À zéro, elle est hors combat plutôt que mourante ; elle ne lance jamais de sauvegarde contre la mort ; l'écran montre ce qu'il montrait toujours d'un adversaire et rien de sa fiche, et aucune de ses dépenses n'est réécrite ailleurs, même si un personnage porte le même nom.
- **Une fiche dont la santé totale est nulle** est exclue du combat, et le journal d'ouverture explique pourquoi, plutôt que de faire entrer quelque chose que personne ne peut blesser.
- Une couche qui retire une valeur d'un de tes champs énumérés ne supprime jamais une créature qui l'utilise : tant que la couche est active, ce champ prend sa valeur par défaut pour la créature, exactement comme pour un personnage, et la créature n'est pas refusée pour cette raison.
- Un Game Master peut aussi en inventer une, qui reste limitée à son palier (voir Adversaires que personne n'a écrits).
- Un package qui en fournit une déclare Capability API 1.34.

Le Toll Sergeant du brouillon 5e est la même chose sur une fiche d20 : son Armor Class, ses points de vie, ses sauvegardes et ses deux frappes par action proviennent de ses propres champs et de sa liste d'attaques.

#### Adversaires que personne n'a écrits

Lorsqu'un Game Master invente un adversaire, Engine ramène la proposition sur ton échelle `threat` avant tout jet : la santé dans la plage du palier ; la défense, le bonus d'attaque et les difficultés de sauvegarde au maximum à deux au-dessus du palier ; et les dégâts diminués jusqu'à ce que le meilleur round de la créature (sa séquence la plus forte ou son action individuelle la plus forte, mesurée contre une cible) entre dans le `damagePerRound` du palier. Il réduit d'abord le nombre de dés, puis la partie fixe, puis une frappe d'une séquence, et seulement ensuite la taille du dé, sans jamais réduire quoi que ce soit à néant. Les noms absents de ton ensemble de règles sont retirés : types de dégâts, états et sauvegardes inconnus, ainsi que tout ce qui dépasse les six premières actions. Un palier jamais déclaré se rabat sur le bas de ton échelle. Chaque changement est renvoyé sous forme d'une phrase simple pour que le journal puisse expliquer son intervention.

Une invention peut aussi s'écrire sous forme de `sheet`, comme une créature de bestiaire ; c'est ainsi qu'un mage inventé obtient emplacements et sorts. Le Game Master voit les identifiants de ta fiche et ce que chacun peut contenir, les listes lues par le combat et les noms que tes catalogues leur proposent ; ainsi, un sort est nommé plutôt que décrit : une ligne qui nomme une entrée de catalogue, quelle que soit sa casse, devient cette entrée, et les propres valeurs du Game Master (comme la préparation d'un sort) s'appliquent par-dessus. La fiche est lue avec tolérance, car un modèle l'a écrite : un nom absent de ton ensemble de règles est retiré, une valeur est ajustée à son champ ou sa colonne, et les nombres écrits à côté de la fiche ne sont pas utilisés.

Une créature inventée qui n'est pas un boss est limitée à ce que ton ensemble de règles lui ouvre. Un filtre de catalogue avec `startFrom` nomme le champ de fiche qui organise ses entrées (la liste de sorts du package 5e par `class`), et une créature inventée ne conserve que les entrées dont le filtre correspond à sa propre valeur de ce champ, selon la comparaison utilisée à l'ouverture du sélecteur. Ainsi, un Sorcerer n'a jamais toute la liste de sorts, et une créature sans classe indiquée ne reçoit rien d'un catalogue organisé par classe. Les choix laissés ouverts sont ensuite complétés sans interroger à nouveau le Game Master : pour chaque liste dont les lignes ne comptent qu'une fois choisies (`onlyWhen` sur une source de capacités de combat), parmi les entrées accessibles qu'elle peut payer avec ses propres réserves, chaque réserve qu'elle possède reçoit un petit nombre d'entrées (davantage pour une créature plus compétente), tout comme ce qu'elle peut utiliser à volonté. Ce qu'elle reçoit dépend de son tempérament et de sa compétence, les mêmes qui gouvernent son combat : une créature protectrice ou de soutien cherche ce qui soutient son camp ; une téméraire, les dégâts ; une méthodique ou patiente, ce qui entrave un ennemi ; et plus elle est compétente, plus elle risque de porter une réaction, un contre ou tout autre élément qui modifie le tour. Le tirage vient de la graine du combat, donc un même combat complète toujours de la même façon. Une ligne que le Game Master a nommée dans une telle liste compte comme choisie.

Un boss appartient entièrement au Game Master, en tant qu'exception possible : rien ne lui est retiré et rien n'est complété.

Puis l'un comme l'autre est limité à son palier :

- La santé entre dans la plage du palier par l'unique champ dont elle est lue : le maximum de la réserve est ce champ, ou une `sum` contenant exactement un champ (le maximum de points de vie de 5e, la Toughness d'Ember Roads). Une formule de santé sans champ unique reste telle quelle, et le journal le précise. La longueur d'une piste de blessures t'appartient et ne change jamais.
- Une fois la créature construite, la défense, le bonus d'attaque et les difficultés de sauvegarde sont limités à deux au-dessus du palier, et les dégâts diminuent jusqu'à ce que son meilleur round entre dans le `damagePerRound` du palier, en comptant le plus gros paiement qu'elle peut se permettre. Ce qu'achète un paiement supérieur diminue d'abord, puis les dés, la partie fixe, une frappe, et seulement ensuite la taille du dé.

Ton propre bestiaire n'est jamais plafonné. Ce sont des données que tu as écrites, donc Engine les accepte telles quelles.

### Positions : un combat sur un plateau

Un combat se déroule dans l'imagination jusqu'à ce que ton bloc indique la valeur d'une case de plateau. Déclare `distance` et il peut se jouer sur une grille ; mouvement, allonge, portées, zones, ligne de vue, couverture et frappes sur quelqu'un qui s'éloigne prennent alors un sens. Chacun est un nombre que tu as écrit ; Engine fournit le plateau et rien d'autre.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
"opportunity": { "budget": "reaction" }
```

Ember Roads n'en déclare qu'une ligne, et rien d'autre ; c'est tout l'intérêt : le reste n'est pas obligatoire.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**La case.** `distance.perCell` indique combien de TON unité vaut une case, et `label` nomme cette unité. Toutes les distances du monde du bloc l'utilisent : `economy.movement`, la `speed` d'une créature, le `reach` et le `range` d'une arme, et le `reach` et le `range` d'une action de créature. Un catalogue qui déclare son propre `units.distance` convertit ses `mechanics.range` et `area.size` avec son propre `perCell` ; sinon, il utilise celui-ci. Une distance supérieure à zéro est arrondie à la case la plus proche, jamais à aucune : tout ce à quoi tu as donné un nombre atteint donc au moins une case. Zéro n'est pas une courte distance et conserve son sens propre : un `mechanics.range` de 0 signifie soi-même ou contact (toucher quelqu'un d'autre atteint la case voisine), et une colonne d'arme `reach` ou `range` valant 0 sur une ligne signifie que cette ligne n'a pas cette distance.

**Le combat utilise-t-il un plateau ?** Deux éléments doivent concorder : ton bloc déclare `distance`, et la partie du joueur utilise le style de combat Tactical. Avec le style Classic, ou un ensemble de règles sans `distance`, le combat reste dans l'imagination : n'importe qui peut viser n'importe qui, et rien de ce qui suit n'est lu.

**Ce que voit le joueur.** Le plateau est dessiné avec le terrain du style tactique. Chaque case est un bouton, accessible au pointeur ou aux touches fléchées, et indique sa nature, son occupant et ce qu'en fait le choix en cours. Marcher éclaire les cases proposées par le menu, chacune avec son coût DANS TON UNITÉ, trace le chemin et marque en ambre toute case dont le chemin provoquerait la frappe de quelqu'un, nommé sous le plateau. Une option qui prend une cible éclaire les personnes admissibles, à la fois sur le plateau et dans la liste. Une option avec une `area` vise une case, et celle sous le pointeur indique qui serait touché, alliés compris. Le mouvement restant apparaît à côté de tes budgets, toujours dans ton unité. L'écran ne mesure rien : chaque case, coût, chemin, cible et point de visée est envoyé par le serveur.

**Mouvement.** Le déplacement autorisé d'un tour vaut `economy.movement` pour un membre du groupe, ou la `speed` de la créature, divisé par `perCell` et arrondi VERS LE BAS, sans jamais descendre sous une case tant qu'elle peut bouger. Il se recharge au début du propre tour de son détenteur et peut se dépenser avant, entre et après les actions : marcher, frapper, marcher encore. Entrer dans une case coûte un, ou davantage en terrain difficile. Huit directions, toutes au même coût, car les grilles de jeu de rôle sur table visées fonctionnent ainsi. On peut traverser un allié mais s'arrêter sur personne ; un adversaire est un mur ; on ne peut entrer dans rien de solide ni couper un coin entre deux cases solides.

**Autres façons de se déplacer** (Capability API 1.113). Les `speeds` d'une créature donnent la façon dont elle se déplace en plus de la marche, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` dans ton unité, et `"hover": true` indique qu'un volant n'a pas besoin de mouvement pour rester en l'air (il lui faut une vitesse `fly`). Celles d'un membre de l'équipe viennent de la fiche par `economy.movementModes`, des références de valeur indexées de la même façon, comme le seraient la vitesse de nage d'une race ou la vitesse de vol d'un sort ; une valeur nulle signifie qu'il ne se déplace pas de cette façon. `speed` et `economy.movement` restent la marche. Sur un plateau :

- le crédit de mouvement est celui de la façon la plus rapide dont ils se déplacent, et chaque case parcourue est retirée de toutes les façons à la fois : une créature qui marche à 30 et vole à 60 peut marcher 10 puis voler 40, et ne jamais marcher au-delà de 30 ;
- un volant entre dans toute case non solide pour une case, eau et marche de n'importe quelle hauteur comprises ;
- un nageur traverse l'eau pour une case, et marche sur la terre ferme ;
- un grimpeur franchit une marche de n'importe quelle hauteur pour ce que coûte le sol sur lequel il pose le pied ;
- la vitesse de creusement d'un fouisseur est transmise au Game Master et compte comme une marche, puisqu'un plateau n'a pas de sol à creuser.

Chaque pas se fait de la façon la moins coûteuse à laquelle il reste assez de mouvement. Un combat sans plateau n'en lit rien, et quelqu'un qui ne fait que marcher se déplace exactement comme avant.

**Hauteur de vol** (Capability API 1.114). Sur un plateau dont l'ensemble donne `combat.elevation.levelHeight` et `combat.distance.perCell`, un volant se voit proposer Fly up et Fly down là où il se trouve, chacun coûtant un niveau de son vol (un niveau de 5 pieds sur des cases de 5 pieds vaut une case). Jusqu'à 20 niveaux au-dessus du sol qu'il survole. Tant qu'il est en l'air :

- il ne fait que voler, une case par pas, au-dessus de tout ce qui n'est pas solide ;
- la distance entre lui et n'importe qui d'autre est la plus grande de la distance au sol et de la hauteur qui les sépare : une épée d'une allonge de 5 pieds ne peut pas toucher un dragon à 30 pieds de haut, et sa propre morsure ne peut pas non plus toucher le chevalier ;
- il a l'avantage de la hauteur sur quiconque est plus bas, comme le lui donnerait une colline ;
- quitter l'allonge de quelqu'un pour qui il est trop haut ne provoque aucune frappe ;
- abattu, jeté à terre ou ramené à une vitesse nulle, il tombe sur le sol en dessous comme le dit `falling`, sauf s'il a `hover`.

Voler sur un sol aussi haut que lui, ou plus haut, le fait atterrir, comme un volant au sol vole sur une falaise. Aucune nouvelle clé : un moteur antérieur à 1.114 garde les volants au sol, donc un package qui compte sur la hauteur déclare 1.114.

**Allonge et portée.** Une ligne d'arme les tire de `combat.attacks[].reach` et `.range`, chacun étant une colonne de la même liste ou le même nombre sur toutes les lignes :

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

Une colonne qui vaut 0 sur une ligne indique que cette ligne n'a pas cette distance ; c'est ainsi qu'une épée ordinaire figure dans la même liste qu'une hache de lancer. Une ligne sans allonge atteint une case. Une action de créature utilise son propre `reach` ou `range`, et une capacité de catalogue utilise `mechanics.range` (0 signifie soi-même ou contact, soit une case lorsqu'elle vise quelqu'un d'autre).

Une ligne avec LES DEUX est une arme de lancer : dans son allonge, c'est une frappe ; au-delà, un tir. Les règles de tir ci-dessous ne l'affectent donc pas en main, et elle permet de frapper quelqu'un qui passe, contrairement à un arc.

Une action de créature peut aussi porter l'`area` dans laquelle elle touche, dans ton unité : `{ "shape": "cone", "size": 15 }`, avec `"friendlyFire": false` pour épargner son camp. C'est ainsi qu'un souffle devient un vrai cône sur le plateau plutôt qu'un nombre de cibles. Une séquence n'a pas de forme propre ; les actions qu'elle nomme ont les leurs. Un combat sans plateau ignore la forme et utilise `targetCount` ; une entrée de créature peut donc porter les deux et rester fidèle dans les deux cas.

**Jusqu'où envoyer une forme.** `range` le dit : une boule lancée à cent pieds en possède un. Sans portée, une explosion se produit là où elle est posée, sur la case de l'acteur, et un cône ou une ligne peut viser n'importe où dans la longueur qu'il dessine, car la case n'y indique que la direction. Cela vaut autant pour le `mechanics.area` d'une entrée de catalogue que pour l'aire d'une créature.

`ranged` indique le coût d'un tir au-delà de sa distance ordinaire `normal`, ou avec quelqu'un du camp adverse dans la case voisine. Chacun vaut `"disadvantage"` ou `"normal"` ; omets le bloc et aucun ne coûte quoi que ce soit. Une frappe n'est jamais un tir, donc aucune règle ne l'affecte, ni une arme de lancer utilisée dans sa propre allonge.

**Zones.** Le `mechanics.area` d'une entrée devient une vraie forme sur le plateau, visant une case plutôt qu'une personne, et `targetCount` n'y décide rien : la forme détermine combien elle atteint. Tous ceux qui occupent ces cases sont touchés, amis comme ennemis, sauf si l'entrée indique `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Une explosion englobe toutes les cases à une distance inférieure ou égale à sa taille de la case visée. Un cône part de l'acteur vers cette case, aussi large à chaque pas qu'il est éloigné. Une ligne suit la même direction, sur une case de large. Les trois s'arrêtent devant tout élément solide.

Une ligne sur la `mechanics.area` d'une entrée ou l'`area` d'une action de créature peut porter `width` dans la même unité que `size`, arrondie en cases avec un minimum d'une case (Capability API 1.128), par exemple `{ "shape": "line", "size": 60, "width": 10 }` pour une ligne de 60 pieds large de 10 pieds ; omets-le pour une case, et une largeur paire en cases place sa colonne supplémentaire à gauche du lanceur.

**Ligne de vue et couverture.** Une ligne droite de cases entre les deux : un mur ou une montagne sur cette ligne bloque un tir et empêche une zone de s'étendre au-delà, et la cible n'apparaît simplement pas au menu. On voit par-dessus l'eau : un tir traverse une rivière, et une zone en ligne continue au-dessus. Les combats propres du moteur utilisent le même test de vue.

La couverture se lit depuis l'endroit où se tient l'attaquant, selon les lignes de coin de la règle optionnelle de grille du DMG : depuis le meilleur coin de l'attaquant, une ligne vers chaque coin de la case de la cible. Trois ou quatre lignes passant par un mur ou une montagne donnent une couverture aux trois quarts ; une seule ligne qui en traverse un, ou qui traverse un terrain offrant une couverture (bois, ruines), donne une demi-couverture ; un terrain bas seul ne donne jamais plus qu'une demi-couverture. Une cible que l'attaquant ne peut pas voir du tout a une couverture totale et n'apparaît pas au menu. Contre une attaque, une cible qui se tient sur un terrain offrant une couverture a au moins une demi-couverture, comme toujours ; une sauvegarde n'est aidée que par ce qui se trouve entre elle et l'effet.

- `cover.bonus` est ce qu'une demi-couverture ajoute à la défense contre laquelle une attaque est lancée, et le journal le précise.
- `cover.threeQuarters` (Capability API 1.74) est ce qu'ajoute une couverture aux trois quarts ; sans lui, `bonus` sert pour les deux.
- `cover.saves` (1.74) nomme les sauvegardes que la couverture aide aussi, contre la sauvegarde propre d'une action (jamais une sauvegarde qui met fin à un état ou maintient la concentration) : depuis l'endroit où tombe une explosion, et depuis son auteur pour tout le reste. Le journal le dit aussi.
- `cover.creatures` (1.74) fait de toute personne qui se trouve sur le chemin une demi-couverture, amie ou ennemie.
- Une sauvegarde dont le texte dit que la cible ne bénéficie d'aucune couverture (le Sacred Flame de 5e) indique `"ignoresCover": true` (1.74), sur le `mechanics.save` d'une entrée, le `save` d'une action de créature ou le `save` de l'utilisation d'un objet.

**Hauteur.** Un plateau peut avoir de la hauteur, jusqu'à trois niveaux, et tout combat positionné se déplace et voit en en tenant compte, quoi que dise l'ensemble : monter d'un niveau coûte une case de plus, descendre ne coûte rien, une marche de deux niveaux ou plus est une falaise que personne ne franchit à pied (et sur laquelle personne n'est poussé), et un sol plus haut que les deux extrémités bloque la vue. En tirant vers le bas depuis un terrain plus élevé, une couverture basse entre les deux ne cache rien. Un ensemble indique ce que son système ajoute avec `elevation` (Capability API 1.75, et cela nécessite `distance`) :

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` est la hauteur d'un niveau dans la distance propre de l'ensemble.
- `highGround` est ce que frapper vers le bas depuis un terrain plus élevé donne à un jet d'attaque : `"advantage"`, ou `{ "bonus": n }`, retiré de la défense contre laquelle l'attaque est lancée. S'il est omis, il ne donne rien.
- `rangeBonus` est le nombre de cases supplémentaires que porte un tir depuis un terrain plus élevé.
- `falling` est ce que fait une chute : quelqu'un poussé d'une marche de deux niveaux ou plus atterrit en dessous et subit `dice` pour chaque `per` de la chute (niveaux multipliés par `levelHeight`), au plus `max` dés, de `type`, puis reçoit l'état `prone`, quand il y en a un. Les dés sont lancés comme le système lance les dégâts : additionnés, ou sous `dice-pool` comptés comme des réussites dont on retire l'absorption. Une chute est un coup comme un autre : elle peut donc mettre quelqu'un à terre ou rompre sa concentration. Le journal indique de quelle hauteur il est tombé. Sans `falling`, la chute est notée et ne fait rien.

**Frappes sur quelqu'un qui s'éloigne.** Déclare `opportunity.budget` : lorsqu'un combattant quitte en marchant l'allonge d'un ennemi debout, capable d'agir, disposant de ce budget et d'une arme de mêlée, le déplacement S'ARRÊTE là où il est et cet ennemi est invité à frapper ou non. Accepter dépense le budget et se résout exactement comme la même attaque pendant son propre tour ; laisser passer ne coûte rien. Dans les deux cas, la marche reprend où elle a été suspendue, en payant chaque case réellement traversée ; une frappe qui fait tomber le personnage en mouvement termine sa marche là où il tombe. Une occasion chacun pour toute la marche, quel que soit le nombre de fois où le chemin quitte la même allonge. `disengage` l'empêche pour le reste du tour, et un ensemble de règles sans `opportunity` n'a rien de tout cela.

La demande est une FENÊTRE, et elle suspend tout le combat : rien d'autre ne bouge avant la réponse de toutes les personnes interrogées. Le joueur répond à la fenêtre d'un membre du groupe, avec la frappe ou **Pass** (passer) à côté ; les autres sont gérées par celui qui les joue, un boss du Game Master par la décision du Game Master lui-même. Voir Fenêtres ci-dessous.

**Ce qu'un adversaire fait du plateau.** Un adversaire que personne ne joue évalue chaque case accessible face à chaque option qu'il pourrait y prendre, retire des points pour chaque frappe provoquée par la marche et préfère rester immobile s'il peut déjà faire de son mieux depuis sa position. Sans rien à portée, il se rapproche et sprinte d'abord si ta liste `standard` contient `dash`.

**Refus possibles.** `out-of-reach` (au-delà de la portée), `no-line-of-sight` (un obstacle solide), `unreachable` (une case que la marche ne peut payer ou sur laquelle elle ne peut finir) et `bad-cell` (une forme visant un endroit interdit).

### Ce que le combat fait de ton bloc sur le serveur

Une partie dont l'ensemble de règles déclare `combat` obtient un combat résolu par celui-ci, dans la même bataille sauvegardée qu'Engine a toujours utilisée :

- **Qui participe.** Le Game Master indique qui combat ; Engine lit les nombres de chaque membre du groupe dans sa propre fiche. Un membre sans fiche pour ton ensemble de règles est refusé par son nom plutôt que de recevoir des nombres que tu n'as pas écrits.
- **D'où viennent les nombres d'un adversaire**, dans cet ordre : la créature nommée par le Game Master dans ton bestiaire ; puis celle dont le libellé correspond au nom de l'adversaire ; puis un bloc de statistiques proposé pour ce combat par le Game Master, ajusté à ton échelle de menace ; enfin, une créature simple construite avec les nombres du palier. Chaque solution de repli et chaque ajustement est consigné en mots simples pour que le combat puisse expliquer son intervention. Un ensemble de règles sans entrée de bestiaire, proposition ni échelle de menace refuse le combat plutôt que d'en inventer un.
- **Tes fiches font foi.** Santé, réserves, états, concentration et compteurs de ta règle d'agonie sont écrits selon les propres règles de la fiche après chaque action acceptée ; un rechargement en plein combat montre donc exactement ce qu'il a laissé, sans bilan final qui pourrait le contredire.
- **Ton menu est la seule source de légalité.** Tout acteur, joueur ou adversaire, choisit un identifiant dans le même menu produit par ton bloc. Un adversaire joué par Engine y choisit avec les tactiques d'Engine ; un adversaire joué par le Game Master est invité à choisir un identifiant dans ce même menu, voit tes nombres et n'apprend jamais ce que feront les dés.
- **Tes dés.** Un combat possède sa propre graine et un curseur ; relu depuis le disque, il reprend donc avec les dés qu'il aurait lancés.

### À l'écran

Le combat se joue sur l'écran de bataille dans tes mots. Le menu contient tes attaques, tes capacités, tes confrontations et les actions standard que tu as listées, chacune indiquant ce qu'elle dépense dans tes budgets et réserves. L'ordre des tours, le round, chaque état nommé avec ses rounds restants, les points temporaires, la concentration et les deux compteurs de ta règle d'agonie sont affichés. Le journal imprime le calcul réel dans tes termes : "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Chaque action acceptée est écrite sur la fiche au moment où elle se produit ; un rechargement en plein combat est donc exact, et le Game Master reçoit ensuite l'instruction de ne pas changer ces nombres à nouveau.

Un combat avec positions est dessiné sur le plateau plutôt que sur la scène des portraits ; voir Positions pour les interactions du joueur. Chaque distance, sur le plateau, dans le menu et dans le journal, est exprimée dans TON unité : "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Confrontations : agripper, pousser, se libérer

Certaines actions ne sont pas une attaque contre une défense mais une confrontation : les deux camps lancent les dés, et celui qui fait mieux obtient gain de cause. Agripper quelqu'un, le renverser ou le repousser, et se libérer ont tous la même forme ; un ensemble exprime donc chacune de ces actions sous forme de données :

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** sont les nombres que lit une confrontation, chacun une valeur de la fiche, lue une fois au début du combat comme une défense ou une sauvegarde. Une créature écrite en nombres simples donne les siens (`"checks": { "brawn": 2 }`) ; une créature dotée d'une fiche les lit sur celle-ci. Jusqu'à douze.
- **Le jet.** Les deux camps lancent tes `attackRoll.dice` et ajoutent le meilleur des tests qu'ils peuvent utiliser ici (`attacker.checks`, `defender.checks`). Le total le plus élevé gagne ; une égalité profite au défenseur, sauf si `ties` indique `"attacker"`. Le journal indique les deux camps : "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **Gagner** fait ce que dit `onWin`, au moins une chose :
  - `applies` inflige des états au perdant avec le gagnant comme auteur ; un état que tu marques `endsWhenSourceDown` prend donc fin quand celui qui maintient la prise tombe. `rounds` lui donne une horloge ; sans lui, il dure jusqu'à ce que quelque chose y mette fin.
  - `ends` retire des états à l'acteur ou à la cible.
  - `push` éloigne le perdant en ligne droite du gagnant, de cette distance dans ton unité, en s'arrêtant avant tout obstacle solide, toute personne debout, le bord du plateau et un coin trop étroit pour s'y faufiler. C'est un déplacement forcé : il ne dépense rien de son mouvement et personne ne le frappe pour autant. Un combat sans plateau ne déplace personne. Perdre ne fait rien : c'est ce qu'est une prise ratée.
- **`from: { "holding": "held" }`** fait qu'une confrontation ne vise que celui qui a infligé cet état à l'acteur, et ne la place au menu que tant que l'état dure : c'est ainsi que s'exprime se libérer.
- **`reach`**, dans ton unité de distance, est sa portée ; la case voisine si tu l'omets. `reach` et `push` exigent `combat.distance`.
- **`strike: true`** lui permet de remplacer une attaque quand une action en achète plusieurs, comme le fait une attaque : prise en premier, elle dépense le budget et laisse les autres attaques disponibles ; prise avec des attaques disponibles, elle en coûte une. La référence 5e gère ainsi la lutte et la bousculade.
- **Dans le menu**, une confrontation a son propre groupe et indique sa chance de gagner. Un adversaire joué par le moteur l'évalue comme le reste, mais avec mesure : une prise ou une poussée prépare quelque chose, et se libérer vaut le plus, seulement quand on est tenu. Un Game Master qui joue un adversaire en choisit une dans le même menu.
- Un adversaire inventé par un Game Master voit ses tests limités à son palier, comme sa chance de toucher.

Les confrontations relèvent de Capability API 1.43 pour un ensemble en package.

<a id="windows-holding-the-fight-open"></a>

### Fenêtres : maintenir le combat ouvert

Certains moments appartiennent à quelqu'un d'autre que l'acteur en cours. Engine maintient le combat ouvert pour cette personne plutôt que de décider pour elle ; cette pause est une fenêtre.

Sept événements en ouvrent une, dont deux proviennent de ce que tu as déjà déclaré :

- **Quelqu'un s'éloigne.** Une marche qui quitte l'allonge d'un ennemi capable de frapper s'arrête à cette étape et l'interroge. Voir Frappes sur quelqu'un qui s'éloigne, ci-dessus.
- **Entre deux tours.** À la fin d'un tour, chaque adversaire possédant des `signaturePoints` et pouvant payer l'une de ses propres actions `signature` est invité à en acheter une, avant le début du tour suivant. C'est le seul moment où elles s'achètent : une action distinctive ne figure sur aucun menu de tour, pas même le sien.
- **Quelqu'un utilise quelque chose.** Avant sa résolution, toutes les personnes de l'AUTRE camp qui possèdent une entrée attendant ce moment sont interrogées, quelle que soit la cible, tant que cette entrée atteint celui qui l'utilise. Une action standard et une confrontation n'ouvrent pas ce moment.
- **Quelque chose vise quelqu'un.** Avant sa résolution, toutes les cibles de l'AUTRE camp possédant une entrée qui attend ce moment sont interrogées. Un ami qui te soigne n'est pas une menace à laquelle répondre ; son action n'ouvre donc aucune fenêtre.
- **Un jet d'attaque touche quelqu'un.** Avant ses dégâts, la personne touchée est interrogée si elle possède une entrée qui attend ce moment. Ce qu'elle choisit compte pour cette attaque : voir Le moment après un coup au but, ci-dessous.
- **Quelque chose a blessé quelqu'un.** Après sa résolution, toutes les personnes blessées possédant une entrée qui attend CE moment sont interrogées, quel qu'en soit l'auteur. Être blessé est un fait qui te concerne ; une entrée renvoyée vers le responsable ne peut toujours pas viser un ami.
- **Quelqu'un tombe.** Avant les dégâts et la chute à terre, pour quiconque possède une réaction qui atteint celui qui tombe et autorise son camp (Capability API 1.124).

- **Quelqu'un commence son tour.** Avant qu'il n'agisse, pour une entrée qui l'atteint dans le camp qu'elle vise (Capability API 1.131).

Les six dernières sont celles qu'une entrée de catalogue, ou l'action propre d'une créature, demande en nommant le moment qu'elle attend. Quand une même action ouvre à la fois `used` et `aimed`, l'utilisation est interrogée d'abord ; si personne ne l'annule, ceux qu'elle vise sont interrogés ensuite, et elle se résout une fois que les deux ont répondu. Être touché est interrogé à chaque jet qui touche, et être blessé une fois l'action entière terminée.

Ce que fait une fenêtre, quelle que soit son origine :

- **Rien d'autre ne bouge tant qu'elle est ouverte.** Ni l'acteur dont c'est le tour, ni la fin de ce tour, ni une autre fenêtre. Le combat attend. Une chute retient son atterrissage le temps que l'étape d'action qui l'a causée se termine ; les chutes suivantes sont interrogées ensuite.
- **Elle interroge une personne à la fois**, dans l'ordre des tours, une seule fois chacune. Passer est toujours une réponse et ne coûte rien. Une personne interrogée qui ne peut rien exécuter est ignorée plutôt qu'interrogée.
- **Elle reprend exactement où elle s'était arrêtée.** Une marche termine les cases restantes, en payant chacune de celles réellement traversées.
- **Celui qui joue répond.** La fenêtre de ton membre du groupe t'appartient, avec l'option et **Pass** (passer) à côté dans le menu ; celle d'un adversaire est gérée par celui qui le joue, et un boss du Game Master est interrogé par l'intermédiaire du Game Master, avec laisser passer ce moment parmi ses réponses.
- **Elle est sauvegardée avec le combat.** Une partie fermée au milieu d'une marche revient avec les mêmes personnes à interroger et les mêmes cases à parcourir.

Tu ne déclares rien pour les deux premières : un ensemble de règles avec `opportunity.budget` obtient l'une, un bestiaire avec `signaturePoints` obtient l'autre, et un ensemble de règles sans aucun des deux ne les voit jamais.

**Indiquer le moment qu'une entrée attend.** Écris `mechanics.reaction` comme un objet plutôt que `true` :

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` vaut `used`, `aimed`, `hit`, `harmed`, `falls` ou `turn-start` et place l'entrée dans le menu de cette fenêtre. Ce sont les six seuls moments qu'Engine surveille. Une entrée qui indique encore `"reaction": true` dit seulement qu'elle ne s'exécute pas pendant un tour ; cela ne suffit pas à la proposer quelque part, elle ne figure donc sur aucun menu.
- `at` vaut `source` (par défaut), `target` ou `chosen`. `source` dirige l'action vers le responsable du moment et remplit la cible, donc personne n'est invité à choisir ; `chosen` conserve les propres cibles de l'entrée et demande un choix. `target` vise la créature que concerne le moment. Une réponse `falls` s'applique à ceux qui tombent et qu'elle a choisis.
- `cancels` empêche entièrement ce que la fenêtre retenait de se produire. Seule une entrée `used` ou `aimed` peut le déclarer : un moment déjà survenu ne peut être annulé, et un coup au but a déjà été lancé.
- `against` restreint ce à quoi l'entrée répond aux éléments utilisés depuis certains catalogues : `"against": { "catalogs": ["spells"] }` répond à un sort et à rien d'autre. Une action sans entrée derrière elle (une arme d'une liste, l'action propre d'une créature) ne vient d'aucun catalogue ; elle n'ouvre donc jamais le moment pour une entrée qui nomme des catalogues. Omets `against` et l'entrée répond à tout.

Donne-lui aussi un `budget`, sinon elle dépense celui par défaut de la liste. Une réaction dépense presque toujours un budget propre, ce qui empêche un tour d'en contenir plusieurs.

**Son coût est dépensé avant d'interroger qui que ce soit.** Une action annulée est empêchée de se produire, pas d'avoir été achetée : budget et réserves sont déjà dépensés. Si ton système les rembourse, il ne peut pas encore le dire.

Un contre s'écrit ainsi, et sur un plateau il ne répond qu'à quelqu'un situé dans sa propre `range` :

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Un contre qui ne monte que jusqu'à un certain niveau** (Capability API 1.116). `"upTo": "paid"` sur une réaction `used` qui annule n'arrête que ce qui a été payé à un niveau qui ne dépasse pas celui de la réponse elle-même, et `"above": { "check": <value>, "dc": 10 }` est le test qui arrête malgré tout quelque chose de plus élevé, contre `dc` plus son niveau. C'est le Counterspell de 5e, qui arrête un sort du niveau de son emplacement ou inférieur et demande au-delà un test de caractéristique d'incantation contre 10 + le niveau du sort, et qui se lance à niveau supérieur comme tout sort :

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

Le niveau de tout ce qui est payé est le niveau de la réserve dont il provient : le `level` propre d'une réserve, une valeur lue sur la fiche de son porteur, quand elle en indique un (les emplacements de pacte de 5e, lancés au niveau d'emplacement de l'occultiste), et sinon sa place dans son groupe, la première réserve étant de niveau 1. Ce qui n'a rien coûté, ou provient d'une réserve sans groupe, est de niveau 0 : tout contre de ce genre l'arrête donc. Le test utilise les propres dés du combat avec les états de celui qui répond sur les tests ; un combat `dice-pool` n'a pas de DD à atteindre et refuse `above`. Une créature sans fiche écrit son test `{ "const": n }`. Le journal indique le niveau et le jet chaque fois que la réponse vise plus haut qu'elle-même, et la ligne habituelle suit quand elle l'arrête. Sans `above`, quelque chose de plus élevé n'est simplement pas arrêté, et ce que la réponse a coûté reste dépensé.

**Le moment après un coup au but.** Une entrée sur `hit` est la manière d'exprimer Shield, une parade (Parry) et Uncanny Dodge. L'attaque est retenue après son jet, et la personne touchée est interrogée avant que des dégâts soient infligés. Ce qu'elle choisit compte pour cette attaque : son jet n'est pas refait mais vérifié à nouveau, contre sa défense telle qu'elle est maintenant ; un état qui ajoute à la défense peut donc transformer le coup au but en échec, et une face naturelle qui touche toujours touche encore. Un état qui dure une attaque (`endsAfter: "attacked"`) infligé en réponse couvre cette attaque, dégâts compris, et s'épuise avec elle. C'est ainsi que s'exprime "réduire de moitié les dégâts de cette attaque" : `resist-all` pour une seule attaque.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

L'attaque reprend exactement où elle a été retenue : le reste de ses cibles et, pour une action de créature faite d'autres actions, le reste de ses parties. Chaque jet qui touche quelqu'un possédant une telle réponse est retenu à son tour, et un combat sauvegardé pendant que la fenêtre est ouverte revient de la même manière. Une attaque faite à l'intérieur d'une fenêtre (une frappe sur quelqu'un qui s'éloigne, une action distinctive, une réponse) n'est jamais retenue, car rien de ce qui s'ouvre à l'intérieur d'une fenêtre n'en ouvre une autre. Le journal montre le jet et ce contre quoi il a été fait à l'ouverture de la fenêtre et, quand la réponse a changé la défense, s'il rate désormais. Les adversaires joués par le moteur ne prennent une garde que lorsqu'elle transforme le coup au but en échec.

Un package qui nomme un moment nécessite Capability API 1.33, et un package qui utilise `used` ou `against` nécessite 1.44. Un package qui attend `hit` nécessite 1.46.

**Répondre à un sort par son nom** (Capability API 1.117). `against` peut nommer des `entries` sous la forme `<catalog>/<entry>` à côté de `catalogs`, et l'une ou l'autre correspondance ouvre le moment. `also` prend la même réponse à jusqu'à trois autres moments, chacun avec son propre `against`. Le `noDamageFrom` d'un état écarte entièrement de son porteur les dégâts de ces entrées tant qu'il dure, quel que soit leur type. Le Shield de 5e se prend quand une attaque touche et quand Magic Missile vise son lanceur, et sous son effet Magic Missile ne fait rien :

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Seul le premier moment peut annuler : une réaction qui annule n'a donc pas d'`also`. Le catalogue qu'une entrée nomme doit être un catalogue de l'ensemble. Une entrée qui n'y figure pas n'ouvre simplement jamais le moment. Un coup écarté de cette façon apparaît dans le journal comme un coup contre lequel la cible est immunisée.

**Ne répondre qu'à certains coups** (Capability API 1.118). Un moment `hit` peut indiquer `"blow": "melee"` ou `"blow": "ranged"`. Un coup est au corps à corps tant que sa cible se tient à portée d'allonge de l'arme : une dague lancée de loin est donc à distance, et la même dague utilisée à côté de sa cible est au corps à corps. Une arme qui a une allonge et pas de portée est toujours au corps à corps, et une arme qui a une portée et pas d'allonge est toujours à distance. Dans un combat sans plateau, une arme qui a une allonge est considérée comme maniée en main. `"seesSource": true`, sur n'importe quel moment sauf `falls`, ne l'ouvre que tant que son porteur voit celui qui l'a causé. Cela signifie une ligne de vue entre eux sur le plateau (sans plateau, tout le monde voit tout le monde), et jamais quelqu'un qui a fait l'action standard Hide, jusqu'à ce qu'elle se dissipe au début de son prochain tour. Le Parry de 5e utilise les deux :

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

Les deux clés peuvent aussi s'écrire sur un moment de `also`, et `blow` seulement sur un moment `hit`.

**Rattraper une chute** (Capability API 1.124). Une réaction sur `falls`, y compris dans `also`, répond à une créature qui tombe d'un rebord ou à un volant forcé de redescendre au sol, avant que la chute n'inflige des dégâts ou ne la mette à terre. Sa portée et le camp qu'elle vise sont vérifiés par rapport à celui qui tombe, et sa réponse s'applique à cette créature. Pour Feather Fall, donne ces mécaniques à l'entrée et déclare `feather_falling` dans les états vivants de la fiche :

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

Son entrée `combat.conditions` s'écrit `{ "condition": "feather_falling", "fallsSafely": true }`. Tant qu'il dure, cet état empêche les dégâts de chute et l'état à terre qu'une chute appliquerait ; il ne retire pas un état qui a causé la chute. Utilise `targets: "self"` pour une réponse qui ne vaut que pour la chute du lanceur lui-même. Une chute n'a pas d'entrée source : sa réaction ne peut donc porter ni `cancels`, ni `blow`, ni `seesSource`, ni `against`. Une entrée à cible unique interroge sur chaque chute séparément. Cela résout l'atterrissage ; cela ne suit pas une descente ralentie.

**Répondre pour une autre créature** (Capability API 1.131). `for` vaut `self` par défaut ; `ally` exclut le porteur, tandis que `any` l'inclut. Les deux interrogent les porteurs du camp de la cible situés dans la distance `within` exigée, dans l'unité de distance du catalogue, et seulement sur `aimed` ou `hit`. Ces clés fonctionnent aussi sur chaque moment `also`. `seesSource` exige toujours de voir l'attaquant. Protection applique `own-attacks-disadvantage` à la source avant que les dés d'attaque ne soient lancés. Sa durée `this-action` prend fin quand l'action se résout ou est annulée. Sans portée explicite vers la source, la réponse d'un témoin atteint cette source ; `within` mesure la distance jusqu'à la créature protégée. Déclare `protected_attack` sur la fiche et donne cet effet à son état de combat :

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Placer la réponse sur la cible.** `at: "target"` s'applique à la créature attaquée, tandis que `source` reste l'attaquant. Shield Guardian représente le porteur de l'amulette comme un allié à 5 ou moins ; `parrying` accorde `+2` de défense. Le coup retenu revérifie la défense de cet allié après la réponse :

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**Au début d'un tour.** `on: "turn-start"` interroge quand une créature du camp visé par l'entrée commence son tour à sa portée, avant que cette créature n'agisse. Cette créature est la `source`. Une entrée nuisible répond à l'autre camp, une entrée utile à son propre camp. Elle ne peut porter ni `cancels`, ni `blow`, ni `against`, ni `upTo`. L'action de créature Unnerving Mask demande une sauvegarde de Sagesse ; une ronde sur le décompte de la créature affectée dure pendant ce tour et expire à sa fin (laisse `of: "source"` de côté) :

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Annuler sur une sauvegarde.** `cancelSave: { save, dc }` exige `cancels` ; le porteur lance avec ses modificateurs de sauvegarde habituels. Une réussite annule, un échec laisse l'action d'origine se résoudre, et dans les deux cas la réaction est dépensée. `against.actions` nomme de une à douze actions de bloc de statistiques, en comparant le nom entier sans tenir compte de la casse (80 caractères au plus chacun). Rock Catching représente le fait d'attraper le rocher en annulant toute l'attaque, dégâts compris, plutôt que ses seuls dégâts contondants. Les identifiants de sauvegarde sont ceux de ton ensemble (`dex` ici ; `dex_save` dans l'exemple 5e fourni) :

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Rattraper plusieurs chutes.** Une entrée `falls` avec un `targetCount` supérieur à un propose les créatures admissibles qui tombent à cause d'un même coup ou d'un même effet, à portée et dans le camp qu'elle vise. Le menu et le directeur prennent par défaut toutes les créatures admissibles jusqu'au nombre indiqué, les plus proches d'abord ; le joueur peut modifier la sélection. Une chute ultérieure est un événement séparé. Feather Fall utilise le même état `fallsSafely` que ci-dessus :

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Pas encore

Dit clairement, car un ensemble de règles ne doit pas promettre ce qu'Engine ne fait pas :

- **Au-delà du plateau modeste** : ni vol au-dessus des obstacles, ni passage serré, ni montures. Une créature n'est déplacée que par sa propre marche, une téléportation et ce qui la pousse (une confrontation, une entrée, l'action d'une créature ou une zone). Personne ne traîne une créature qu'il tient.
- **Une confrontation est simple.** Son jet n'ouvre aucune fenêtre, mais une chute qu'elle provoque peut recevoir une réponse.
- **Une entrée ne peut attendre que six moments**, `used`, `aimed`, `hit`, `harmed`, `falls` et `turn-start` (voir Fenêtres, ci-dessus). Ce sont les moments qu'Engine remarque pour une entrée ; les deux autres fenêtres, quelqu'un qui s'éloigne et la pause entre deux tours, sont ouvertes par le combat lui-même et ne sont pas des moments qu'une entrée peut demander. Il n'existe pas de moment pour un jet de sauvegarde ou une mort.
- **Pas d'enchaînement.** Le combat conserve une fenêtre plutôt qu'une pile, donc rien ouvert à l'intérieur d'une fenêtre n'en ouvre une autre : un contre ne peut pas être contré à son tour, ce qu'inflige une réaction n'ouvre aucun autre moment, et une attaque faite à l'intérieur d'une fenêtre n'est pas retenue quand elle touche. Une chute à laquelle on peut répondre, causée pendant une fenêtre, est retenue jusqu'à la fermeture de celle-ci, puis interrogée à son tour.
- **Seul un jet d'attaque est un coup au but.** Ce qui atteint sa cible sans jet (des fléchettes qui touchent d'office, une zone contre laquelle chacun fait une sauvegarde) n'ouvre aucun moment `hit`.
- **Les modificateurs de dégâts concernent les coups d'attaque.** Une réponse peut placer un modificateur de dégâts sur son porteur ou réduire de moitié les dégâts reçus avec `resist-all` ; les modificateurs de dégâts ne modifient jamais un effet fondé uniquement sur une sauvegarde.
- **Rien n'est remboursé.** Le coût d'une action annulée reste dépensé.
- **Ce qu'un état modifie est une liste fermée.** La défense, les jets d'attaque, les sauvegardes, les tests de confrontation, la vitesse, le maximum de santé, les dégâts infligés et les dégâts subis (aussi pour les niveaux et les effets d'objets). Les modificateurs de dégâts ne modifient que les coups d'attaque ; ils ne s'ajoutent jamais aux dégâts fondés sur une sauvegarde ni aux coups automatiques.
- **Une créature écrite en nombres simples n'a pas de piste de blessures.** Dans un ensemble de règles dont la santé est une piste, cette créature perd toujours des points ; donne-lui une `sheet` et les coups qu'elle reçoit marqueront des cases, d'abord atténués par ses propres `resist`, `vulnerable` et `immune`.
- **Un effet supplémentaire se déclenche seul.** `on` n'a qu'une valeur, `hit` : le premier coup au but admissible de la période l'applique, sans moment où l'on te demande si tu souhaites en dépenser un.
- **Un nombre que les attaques déplacent est simple.** Un coup qui dépense lance le nombre et rien d'autre : aucune arme ne le modifie, son `floor` compris (une cible robuste absorbe un coup qui prend, et sa dureté arrête un coup qui dépense, mais rien d'autre ne réduit l'un ou l'autre) ; un effondrement prend fin après un nombre fixe de tours, quelle que soit sa profondeur ; et une attaque faite dans une fenêtre (une frappe sur quelqu'un qui s'éloigne, une réaction, une action distinctive) se fait dans le premier style.
- **Un adversaire inventé n'absorbe rien et n'a pas de dureté.** Une créature que le Game Master invente pour un combat est limitée à ton échelle de menace, qui ne dit rien de l'absorption ni de la dureté ; elle n'a donc ni l'une ni l'autre.

## Couches : variantes de ton propre ensemble de règles

Une couche est une variante nommée de ton ensemble de règles, activée par le joueur à la création d'une partie : magie rare, hiver rude, difficulté plus âpre. Les couches résident dans le fichier de l'ensemble de règles, dans un tableau facultatif `layers` ; elles voyagent donc avec lui et ne peuvent jamais manquer à une partie qui les a utilisées. L'assistant les affiche comme des interrupteurs sous ton ensemble de règles, et le choix reste fixé pour toute la durée de vie de cette partie, exactement comme l'ensemble lui-même.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**Ce qu'une couche peut faire.** La liste est fermée, et chaque effet restreint quelque chose ou ajoute du texte :

- `gm.guidance` est ajouté à la fin de ton `gm.checkGuidance`, après ton propre texte et celui des couches précédentes. `gm.worldGuidance` est ajouté à `gm.worldGuidance` de la même manière.
- `fields` retire des valeurs d'un champ **énuméré**. `removeValues` nomme des valeurs déjà présentes ; au moins une doit subsister, et si le `default` du champ est retiré, la couche nomme à la place un `default` qui subsiste.
- `difficultyLadder` remplace ton échelle par une autre, dans la structure de ton propre type de résolution : `{label, dc}` pour `dice-sum` et `{label, successes, target?}` pour `dice-pool`. Elle subit exactement les mêmes vérifications que ton échelle. Lorsque plusieurs couches actives en déclarent une, la dernière l'emporte.
- `catalogs` masque des entrées du sélecteur de l'éditeur de fiches. Chaque règle nomme l'un des `filters` déclarés par ce catalogue et exactement une comparaison : `above` ou `below` pour un filtre `number`, `equals` ou `notIn` pour un filtre `text` ou `tags`. Une entrée qui ne définit pas ce filtre n'est jamais masquée.
- `currencies` retire des pièces : `removeUnits` nomme des pièces isolées et `removeFamilies` des familles entières. La plus petite pièce d'une famille ne part qu'avec sa famille ; chaque famille restante peut donc toujours payer et rendre la monnaie. Tant que la couche est active, personne ne gagne, ne paie avec, ne choisit ni ne lâche une pièce retirée, et la ligne de la bourse l'omet. Un prix exprimé dans cette pièce est donné dans la plus grosse pièce restante qui le paie exactement, à valeur égale : la longue nuit de Gravewatch retire la couronne ; un pistolet de guet à 3 couronnes coûte donc 15 shillings. Un objet dont toute la famille a disparu n'a pas de prix.

**Ce qu'une couche ne peut pas faire.** Elle ne peut ajouter une valeur énumérée, un champ, une compétence, une réserve ou un repos, changer le type de résolution, toucher l'état en cours ou les nombres de combat, ni ajouter un appel de modèle. Une valeur qu'une couche _ajouterait_ serait inconnue de tous les autres lecteurs de la fiche ; les valeurs ne peuvent donc que disparaître. Tout ce qui dépasse cette liste constitue une modification de l'ensemble de règles lui-même ou un second ensemble.

**Conflits.** `conflicts` nomme les couches qui ne peuvent être actives ensemble. Nommer un seul côté de la paire suffit. L'assistant désactive l'autre interrupteur, et si un choix sauvegardé contient malgré tout les deux, la couche déclarée **plus tard** est retirée ; les deux mêmes choix donnent donc toujours les mêmes règles.

**Une fiche contenant déjà une valeur retirée la conserve.** Rien ne réécrit un personnage. L'éditeur cesse simplement de proposer la valeur, et un personnage qui la possédait déjà l'affiche telle quelle. Désactive la couche dans une nouvelle partie et la valeur sera proposée à nouveau. Il en va de même pour une entrée de catalogue masquée : elle disparaît du sélecteur, et une ligne déjà choisie par le joueur reste sur la fiche. Les pièces qu'une couche retire et que quelqu'un transporte déjà restent dans son sac.

**Limites.** 12 couches par ensemble de règles et 4000 caractères de consignes par couche, les deux chaînes comptées ensemble. Un ensemble de règles en package qui déclare `layers`, ou un `gm.worldGuidance` de base, nécessite Capability API 1.25, et un ensemble dont les couches retirent des pièces nécessite 1.64. Un ensemble que tu importes est validé par Engine à la lecture et n'a donc besoin de rien.

**Les couches écrites par quelqu'un d'autre** (une couche de magie rare pour un ensemble de règles que tu n'as pas écrit, livrée dans son propre fichier) viendront plus tard. Aujourd'hui, une couche est livrée à l'intérieur de l'ensemble de règles auquel elle appartient.

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

### Déplacer des valeurs vers de nouveaux identifiants : `sheet.migrations`

Ajouter des éléments ne demande rien de plus. Quand une nouvelle disposition déplace une valeur ailleurs (un champ renommé, un niveau unique qui devient un niveau par classe, une réserve de dés de vie unique qui devient une réserve par dé), indique comment dans `sheet.migrations` (Capability API 1.77), pour que chaque personnage créé avec l'ancienne disposition garde ses nombres : dans la bibliothèque, dans les parties, dans les anciennes sauvegardes, branches et points de contrôle, et dans les fiches importées.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- Chaque entrée fait passer une fiche stockée de la version `from` à `from + 1`, et s'exécute pour chaque fiche stockée à cette version ou à une version plus ancienne, dans l'ordre. N'en retire jamais une une fois qu'elle a été publiée : une fiche stockée il y a longtemps en a encore besoin. Une version qui ne fait qu'ajouter n'en a besoin d'aucune.
- `rename` (un `ability`, `skill`, `save` ou `field`) : la valeur est copiée vers son nouvel identifiant. Une compétence ou une sauvegarde emporte son bonus. Un renommage peut prolonger celui d'une entrée antérieure, ou alimenter un champ qu'un `route` ultérieur fait suivre ; l'importation suit la chaîne jusqu'à son terme.
- `route` : la valeur d'un champ va vers le champ que nomme le texte d'un autre champ. Un cas l'emporte quand ses mots apparaissent dans le texte de `by` comme mots entiers (seules les lettres forment un mot, donc "Fighter3" nomme un guerrier), sans tenir compte de la casse, et qu'un seul cas correspond. S'il n'y en a aucun, ou plusieurs ("Fighter 3 / Wizard 2", qu'un seul nombre ne permet pas de répartir sans demander), elle va vers `else`. `default` tient lieu de valeur pour une fiche qui ne l'a jamais stockée. `by` est un champ que la fiche possède, ou un champ qu'une disposition antérieure a renommé. Les cibles sont des champs numériques ou texte sans valeur par défaut, ou avec une valeur par défaut de 0 ou vide : la valeur arrive dans l'un d'eux et chaque autre garde sa valeur par défaut, si bien que toute autre valeur par défaut se lirait comme un niveau que personne n'a donné. Une cible qu'un renommage ultérieur déplace est suivie jusque-là.
- `routeLive` (un `pool` ou un `track` de l'état vivant) : la valeur stockée va vers celui des `cases` que la fiche migrée affiche (une réserve dont le maximum dépasse 0, une piste que la fiche ne cache pas), sinon vers `else`. Les pistes vers lesquelles va une valeur sont toutes des pistes de blessures (elle porte les marques) ou toutes des pistes ordinaires (elle porte le nombre).
- Chaque étape de construction copie : l'ancienne valeur reste là où elle était, si bien qu'une version plus ancienne de ton ensemble lit toujours la fiche comme avant. Une étape n'écrase jamais une valeur déjà présente dans sa cible.
- L'importation refuse une entrée égale ou supérieure à `sheet.version`, deux entrées partant de la même version, une étape qui écrit vers un identifiant que la fiche n'a pas, un cas listé deux fois, et un `rename` ou un `routeLive` qui lit un identifiant que la fiche possède encore (un identifiant déplacé n'est plus jamais utilisé, ce qui permet de relancer ces étapes sans risque).
- Les fiches sont migrées chaque fois qu'elles sont lues, et la nouvelle disposition est stockée à la modification suivante. L'état vivant n'a pas de version propre : `routeLive` s'exécute donc à chaque lecture ; l'ancienne clé est supprimée et sa valeur ne se déplace que tant que la nouvelle clé n'existe pas encore, si bien qu'une valeur dépensée ou restaurée par un repos depuis n'est jamais écrasée. L'endroit où elle est allée est fixé par la première écriture après la mise à jour : une fiche corrigée plus tard (un niveau de classe déplacé à la main) ne la déplace pas de nouveau. Un combat déjà en cours à l'arrivée de la nouvelle version se termine quand même, comme avant.

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

Le manifeste liste `ruleset.json` et chaque `catalogs/<id>.json` dans `contributions.assets.paths` et dans `files`, avec la taille et le sha256 de chacun. Un éditeur d'ensembles comme Pixelforge en crée un. **Import agents** → **Game Mode ruleset** prend le fichier et affiche le même examen que pour un fichier d'ensemble, avec chaque catalogue et son nombre d'entrées. Rien n'y est compressé : il ne contient donc jamais plus que sa propre taille. Il est lu comme des données et n'est jamais installé comme un package : il est refusé, avec la raison, s'il contient autre chose (une autre clé, tout autre fichier, un document qui n'est pas du base64 strict ou pas du texte UTF-8), si son manifeste va au-delà de celui d'un ensemble (du code, des permissions ou d'autres contributions), si un fichier n'est pas celui que liste le manifeste, si un `$comment` dépasse 2 000 caractères ou si `$schema` nomme autre chose que le propre schéma du moteur, ou si l'ensemble ou un catalogue ne peut pas être lu. Il est classé sous `local/<its id>` comme un fichier d'ensemble, 24 MB au plus, avec au plus 12 fichiers de catalogue de 2 MB chacun. Une version, c'est son ensemble et ses catalogues réunis : un catalogue modifié exige donc aussi une `version` plus élevée. Les packages d'ensembles ne sont pas acceptés sous forme de zip.

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

**Dans le catalogue officiel.** Un système largement joué, dont les licences sont claires, peut être proposé à tous via **Download Agents** (télécharger des agents). Cela passe par une pull request au dépôt [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Consulte le package `ruleset-5e-2014` pour sa structure.

## Licences

Ne publie que du texte de règles que tu as le droit de partager. Beaucoup de systèmes publient un document de référence sous licence ouverte ; c'est ce document que tu peux copier. Place l'identifiant de licence et le texte d'attribution exigé sous `license`. Ne copie pas le texte de livres de règles sans licence ouverte. Un ensemble de règles a surtout besoin de noms et de nombres, et le texte du Game Master doit être rédigé dans tes propres mots.

## Dépannage

- **L'importation dit qu'un nom n'existe pas.** Quelque chose dans le fichier pointe vers un identifiant non déclaré, comme une compétence nommant une caractéristique supprimée. Le message donne le chemin vers la ligne.
- **L'importation dit qu'une version est déjà installée avec un contenu différent.** Augmente `version` et réimporte.
- **Mon ensemble de règles n'apparaît pas dans l'assistant de configuration.** Vérifie que **Allow custom Agent imports** est activé. Lorsqu'il est désactivé, les ensembles importés sont exclus des nouvelles parties. Les parties qui en utilisent déjà un continuent de fonctionner.
- **Une partie dit que son ensemble de règles manque.** La version exacte utilisée à sa création n'est pas installée. Réimporte cette version du fichier.
