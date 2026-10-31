# Tests des ensembles de règles

Cette page fait partie du guide [Écrire des ensembles de règles Game Mode](writing-rulesets.md). Comment un ensemble de règles résout un test ou une sauvegarde : les cinq types de résolution, les bandes de résultat, les tests qui se lancent à leur façon et les dépenses ou les charmes qui modifient un jet.

<a id="resolution-kinds"></a>

## Types de résolution

`resolution.kind` choisit le jet. Tous les types lisent la même fiche et partagent trois clés ; les parties du fichier après `resolution` ne changent donc pas quand tu passes de l'un à l'autre :

- `abilityModifier` : comment une valeur de fiche devient un nombre. `identity` utilise la valeur elle-même ; `floorHalfMinusTen` est la règle 5e ; `stepTable` permet de définir tes seuils sous la forme `[[score, number], ...]`.
- `proficiencyTiers` : les niveaux d'entraînement d'une compétence ou sauvegarde. Le premier s'applique à une compétence non renseignée. Un niveau ajoute `flat`, ou `multiplier` fois un bonus de maîtrise, ou les deux. Si ton système possède ce bonus, indique sa source avec `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency` : facultatif, nécessaire seulement pour un niveau qui multiplie.

Le sens du nombre dépend du type : `dice-sum` l'ajoute au jet ; `dice-pool` et `dice-highest` lancent ce nombre de dés. `symbol-pool` garde l'attribut et l'entraînement séparés pour constituer et améliorer des dés narratifs.

### `dice-sum` : additionner les dés

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

### `dice-pool` : lancer les dés et les compter

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

### Ce que le Game Master peut écrire sur un test de réserve

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

### `dice-highest` : lancer les dés et lire le plus haut

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

### `roll-against` : obtenir au plus (ou au moins) le nombre de la fiche

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

### `symbol-pool` : lancer des dés narratifs et lire les symboles

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
- `outcomes` peut lire le nombre de réussites nettes (`total`) ou `net successes - needed + 1` (`margin`). Les bandes décident toujours de la réussite à leur manière habituelle ; les symboles critiques d'origine restent signalés. `spend` n'achète que des dés de personnage de base supplémentaires, dans la limite de `pool.max`. Ses combats sont de type `symbol-pool` (Capability API 1.382, voir [Un combat lancé avec des dés à symboles](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)) ; tout autre type de combat est refusé à ses côtés.
- En dehors d'un test, une partie utilisant cet ensemble de règles peut lancer ses dés par leur nom : le champ de dés personnalisés de la barre de saisie et l'outil `roll_dice` du Game Master lisent `2 ability 1 proficiency vs 2 difficulty` (l'`id` ou le `label` de chaque dé, sans distinction de casse), comptent et annulent les symboles comme pour un test, sans la fiche, les améliorations ni l'échelle de difficulté. Aucune clé n'est nécessaire pour l'activer.
- Le registre garde `resolution="sum"`, avec `symbols="2s 1a 1t"`, `thrown=` qui identifie chaque dé et `rolls=` qui contient sa face (numérotée à partir de 1). Le `symbolDetails` encodé conserve les libellés, les symboles des faces et les deux marqueurs critiques. `setback` enregistre les dés d'infortune indépendants réellement ajoutés après la limite commune, et `upgradeOwn` les améliorations supplémentaires réellement appliquées ; les ajouts ignorés ou nuls sont omis. La carte et le résumé nomment les symboles nets, résultat vide compris, au lieu d'additionner des numéros de faces. Les remplacements peuvent modifier les règles de ce type, mais pas remplacer `symbols` ni `dice`.

### Ce qui reste hors périmètre, et pourquoi

Ces mécaniques ont encore besoin de leur propre type de résolution :

- **Réserves opposées** résolvent deux personnages à la fois ; un test n'a qu'un lanceur.
- **Réserves additionnées avec un dé spécial** (comme dans OpenD6) additionnent les dés en traitant l'un d'eux à part.

Les deux éléments autrefois exclus sont maintenant modélisés ; la section sur les dépenses pour modifier un jet, ci-dessous, explique comment. Une règle du système lui-même, "spend a point for a success" ou "spend a point to throw the failures again", est `resolution.spend`. Une relance que le système accorde gratuitement quand la situation l'exige est `resolution.reroll`, ci-dessus. Celle qui appartient à un élément choisi par le personnage est `mechanics.check` sur une entrée de catalogue, payée avec le coût de cette entrée.

## Bandes de résultat : plus que réussite ou échec

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

## Les tests qui se lancent à leur façon

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

## Dépenser pour modifier un jet

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

## Un charme qui modifie un jet

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
