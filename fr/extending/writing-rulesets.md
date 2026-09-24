# Écrire des ensembles de règles Game Mode

Un ensemble de règles explique à Game Mode le fonctionnement d'un système sur table : les dés d'un test, le contenu de la fiche, les ressources dépensées et ce qu'un repos rend. Ce guide s'adresse à ceux qui veulent en écrire un et le partager. Pour jouer avec celui d'une autre personne, commence par [Choisir les règles](../game/getting-started.md#choosing-rules).

Un ensemble est un fichier JSON. Ce sont des données, pas du code. Rien ne s'y exécute, donc l'importer ne peut rien faire à ton ordinateur. Avant d'importer un fichier d'autrui, lis attentivement le texte du Game Master : il est envoyé au modèle dans toutes les parties utilisant cet ensemble.

## À lire d'abord : ce qu'un ensemble peut et ne peut pas faire

Un ensemble ne peut que remplir les paramètres d'une mécanique déjà connue du moteur. Aujourd'hui, celui-ci connaît deux façons de résoudre un test ; ton fichier en choisit une avec `resolution.kind` :

- **`dice-sum`** : lancer des dés, ajouter des nombres de la fiche et atteindre ou dépasser une difficulté. Cela couvre les systèmes d20, ceux à 2d6 plus attribut et bien d'autres.
- **`dice-pool`** : lancer le nombre de dés du personnage et compter ceux qui atteignent une cible. Cela couvre les systèmes où une valeur représente une poignée de dés plutôt qu'un bonus.

Les deux sont décrits intégralement dans [Types de résolution](#resolution-kinds).

Une mécanique qui n'entre dans aucune de ces formes ne peut pas s'écrire dans le fichier. Par exemple : garder le plus grand dé d'une réserve, réussir sous un pourcentage, utiliser des dés à symboles ou des réserves opposées. Chacune exige un nouveau type de résolution dans le moteur : une contribution de code avec des tests, pas un JSON. Si ton système en a besoin, ouvre une demande de fonctionnalité sur le dépôt du moteur et décris la mécanique avec quelques jets détaillés. Ces exemples deviennent les tests.

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
| `battle` | Facultatif. Ce qu'une bataille lit dans la fiche et y réécrit ensuite. |
| `combat` | Facultatif. Comment tes règles résolvent un combat et ce que joue l'écran de bataille. |
| `layers` | Facultatif. Les variantes activées par le joueur à la création d'une partie. |

Le fichier peut atteindre 256 KB. Le texte destiné à un prompt (noms, libellés, texte du Game Master) ne peut pas contenir de sauts de ligne, de crochets ni de doubles accolades.

Les identifiants de la fiche (attributs, compétences, champs, réserves, etc.) utilisent minuscules, chiffres et traits de soulignement, en commençant par une lettre, comme `grit_max`.

<a id="resolution-kinds"></a>

### Types de résolution

`resolution.kind` choisit le jet. Les deux types lisent la même fiche et partagent trois clés ; les parties du fichier après `resolution` ne changent donc pas quand tu passes de l'un à l'autre :

- `abilityModifier` : comment une valeur de fiche devient un nombre. `identity` utilise la valeur elle-même ; `floorHalfMinusTen` est la règle 5e ; `stepTable` permet de définir tes seuils sous la forme `[[score, number], ...]`.
- `proficiencyTiers` : les niveaux d'entraînement d'une compétence ou sauvegarde. Le premier s'applique à une compétence non renseignée. Un niveau ajoute `flat`, ou `multiplier` fois un bonus de maîtrise, ou les deux. Si ton système possède ce bonus, indique sa source avec `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency` : facultatif, nécessaire seulement pour un niveau qui multiplie.

Le sens du nombre dépend du type : `dice-sum` l'ajoute au jet ; `dice-pool` lance ce nombre de dés.

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
- `difficultyLadder` : difficultés parmi lesquelles le GM doit choisir. `dc` est le nombre que le total doit atteindre.

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
  "pool": { "min": 1, "max": 15 },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die` : nombre de faces d'un dé de la réserve, de 2 à 100.
- `pool` : limites appliquées au nombre de la fiche avant toute explosion. Un `min` de 0 laisse une réserve vide échouer sans jet ; `max` ne dépasse pas 100.
- `target` : face à atteindre pour compter. Mets `min` sous `max` pour permettre au GM de la déplacer par test avec `threshold=` ; rends les trois valeurs identiques pour la fixer.
- `double` : facultatif. Une face égale ou supérieure à `from` compte deux fois.
- `explode` : facultatif. Une face égale ou supérieure à `from` lance un dé supplémentaire, qui peut lui-même exploser. Les dés supplémentaires sont plafonnés à `pool.max` en plus de la réserve initiale : un test lance au maximum deux fois `pool.max` dés et un `from` bas ne peut pas provoquer des jets infinis.
- `cancel` : facultatif. Une face égale ou inférieure à `upTo` retire une réussite. Le compte ne descend jamais sous zéro.
- `botch` : facultatif. Si **aucun** dé n'a réussi et qu'une face égale ou inférieure à `upTo` est sortie, le test est un échec critique. Une réserve dont l'unique réussite a été annulée a échoué, mais n'a pas fait de maladresse critique.
- `exceptional` : facultatif. Ce nombre de réussites nettes ou plus, sur un test réussi, donne une réussite critique.
- `situationalDice` : facultatif. Limites des dés ajoutés ou retirés par le GM avec `bonus=` pour une prouesse, des blessures ou une mauvaise lumière.
- `difficultyLadder` : `successes` indique le nombre de réussites nécessaire. Un palier peut nommer un `target`, seulement si la cible est réglable et dans ses limites.

Les faces de `cancel` et `botch` doivent être inférieures à la cible minimale, et toutes les faces nommées doivent exister sur le dé. Une règle impossible à déclencher est refusée à l'importation plutôt que découverte en jeu.

Un ensemble distribué en paquet utilisant des réserves relève de Capability API 1.24. Un ensemble communautaire importé est validé par le moteur qui le lit et n'a donc besoin de rien d'autre.

#### Ce que le Game Master peut écrire sur un test de réserve

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc` est le nombre de **réussites** demandé, pas une cible par dé. Il va de 1 au maximum que pourrait compter un jet : maximum de la réserve, doublé si les dés explosent, puis doublé encore si les faces comptent deux fois.
- `threshold=` déplace la cible par dé et n'est proposé que si `target.min` est inférieur à `target.max`.
- `bonus=` ajoute ou retire des dés et n'est proposé que si `situationalDice` est déclaré.
- `with=` lance une compétence ou sauvegarde avec un autre attribut. Il fonctionne pour les deux types ; 5e obtient ainsi "Strength (Intimidation)" par le même attribut.

Tout respecte ton fichier : une valeur hors limites est ramenée à l'extrémité la plus proche et un attribut absent est ignoré sans refuser le test. Le registre montre ce qui a réellement servi : cible et dés supplémentaires après limitation, et `with=` seulement si l'attribut a été remplacé. Le moteur lance toujours les dés. Il remplace tout résultat de réserve écrit par le modèle, ignore `mode="advantage"` puisque le type n'a pas d'avantage et n'utilise pas un dé lancé par le joueur avant le tour.

#### Ce qui reste hors périmètre, et pourquoi

Chacun de ces cas nécessite son propre type de résolution : aucun ne s'exprime en comptant des dés qui atteignent une cible.

- **Garder le plus grand dé** (comme dans Blades in the Dark) nécessite un niveau de réussite partielle absent du résultat d'un test.
- **Réserves de posture comparées à un attribut** (comme dans Lasers and Feelings) choisissent le sens de comparaison à chaque test.
- **Dés à symboles** (comme dans Genesys) ne produisent aucun nombre.
- **Réserves opposées** résolvent deux personnages à la fois ; un test n'a qu'un lanceur.
- **Jets sous un pourcentage et pourcentages ouverts** comparent dans l'autre direction.
- **Réserves additionnées avec un dé spécial** (comme dans OpenD6) additionnent les dés en traitant l'un d'eux à part.

Les deux éléments autrefois exclus sont maintenant modélisés ; la section sur les dépenses pour modifier un jet explique comment. Une règle du système, "spend a point for a success", est `resolution.spend` : elle achète des réussites ou des dés, jamais une relance. Relancer appartient à un élément choisi par le personnage : c'est donc `mechanics.check` sur une entrée de catalogue, payé avec le coût de cette entrée.

### Dépenser pour modifier un jet

Certains systèmes permettent de payer un jet à venir : un point de volonté pour une réussite automatique. `resolution.spend` l'exprime comme règle permanente du système, plutôt que comme achat propre à un personnage :

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` désigne l'une de tes `live.pools`. Elle ne peut pas commencer vide : il n'y aurait rien à dépenser au début de la partie.
- `amount` est le coût d'UN achat. `successes` et `dice` indiquent ce qu'il achète ; il faut au moins l'un des deux. Les réussites sont ajoutées après le comptage et les annulations, puisque personne ne les a lancées. Les dés sont lancés avec la réserve, dans ses limites.
- `perCheck` limite le nombre d'achats d'un test : il peut acheter au maximum pour `amount * perCheck` points. Cela empêche une réserve pleine d'acheter un jet impossible à perdre.
- Seul `dice-pool` le permet : un jet additionné n'a ni réussites ni réserve auxquelles ajouter quelque chose. Un ensemble `dice-sum` déclarant `spend` est refusé à l'importation.
- Deux entrées ne peuvent pas nommer la même réserve, sinon le test ne pourrait pas les distinguer.

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
- Il faut au moins l'un des quatre, sinon l'entrée ne dit rien et est refusée.
- Seul `dice-pool` peut les appliquer ; un ensemble `dice-sum` avec `mechanics.check` est refusé à l'importation.

**Le coût est le `cost` de l'entrée**, payé par le même mécanisme que tout autre usage : la réserve et une utilisation de chaque compteur écrit par cette entrée. `perCostStep` indique qu'elle CHANGE D'ÉCHELLE : si elle le déclare, elle est achetée autant de fois que son prix a été payé ; sinon, elle est achetée une seule fois, quelle que soit la somme offerte.

**Le GM la nomme sur le test :** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Pas dans une commande de fiche séparée, pour la même raison : les dés sont lancés avant la mise à jour des comptes.

**Tout ou rien.** Si la réserve ne suffit pas, aucun achat ni prélèvement n'a lieu ; le jet reste celui qu'il aurait été. Des points ne correspondant pas à un nombre entier d'achats n'achètent rien non plus. Une demande au-delà de `perCheck` est plafonnée plutôt que refusée, et seul ce plafond est payé. Le moteur calcule tout cela ; le GM nomme la dépense annoncée par le joueur sans toucher aux dés. Le registre indique ce qui a vraiment été payé, l'entrée appliquée, les réussites non lancées et le nombre de dés relancés. Un charme non choisi, ou dont le moteur ne peut pas lire le catalogue, ne fait rien au lieu d'être appliqué sur confiance.

### La fiche

- `sections` regroupe les éléments dans l'éditeur.
- `abilities` contient les valeurs principales. `skills` et `saves` peuvent nommer l'attribut de leur jet.
- `fields` contient des valeurs simples. Types : `number`, `text`, `longtext`, `boolean`, `enum` (liste fixe de choix) et `dice` (texte comme `1d8`).
- Les valeurs `derived` sont calculées depuis d'autres valeurs et ne peuvent pas être écrasées à la saisie. Opérations : `sum`, `min`, `max`, `scale` (multiplier et arrondir) et `stepTable` (chercher dans des seuils, comme un niveau donnant un bonus de maîtrise).
- `lists` contient des tableaux à colonnes personnalisées, comme équipement, sorts ou capacités. Une liste avec `pools` transforme chaque ligne en ressource ayant son propre maximum, pour les capacités de classe à usages limités.
- `live` contient ce qui change en jeu : `pools` (points de vie, emplacements de sorts, Grit), `tracks` (nombre sur une échelle, comme l'épuisement, ou piste de blessures à cases), `text` (notes courtes, comme la concentration) et `conditions`.

Tout ce qui lit un nombre le nomme par une référence de valeur : un objet avec exactement une clé parmi `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod` et `saveMod`. Par exemple, une réserve au maximum dérivé : `"max": { "derived": "grit_max" }`.

`hideWhen` cache un champ, une liste ou une réserve quand un autre champ prend une valeur donnée. Le fichier 5e l'utilise pour cacher les emplacements de sorts aux personnages qui n'en lancent pas.

### Pistes de blessures : une santé marquée sur une piste

Beaucoup de systèmes ne comptent pas de points de vie. Ils utilisent une colonne de cases, chacune pire que la précédente, dont on coche une lorsqu'on est blessé. Ajoute `levels` et `kinds` à une entrée `live.tracks` pour remplacer un nombre sur une échelle par une telle piste :

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
- Les deux vont ensemble. `kinds` sans `levels` est refusé faute de cases à marquer, et `levels` sans `kinds` est refusé car une marque doit avoir un type.
- **Distingue les deux mots.** `kinds` définit ce qu'une marque PEUT ÊTRE. Une MARQUE est l'un de ces types placé sur la piste pendant le jeu. La définition contient des types ; la fiche contient des marques.
- La longueur de la piste est celle de ses niveaux : `min` vaut 0 et `max`, `levels.length`. Toute autre valeur est refusée plutôt que corrigée, pour que le fichier n'exprime jamais deux longueurs contradictoires.

**Les règles exactes**, car une lecture vague produit la mauvaise piste :

- Les marques sont triées, **les plus graves d'abord**. Sept niveaux contiennent au maximum sept marques.
- Une marque est **insérée dans l'ordre de gravité**, jamais ajoutée simplement au bout. Elle prend le plus haut niveau qui lui revient et pousse les plus légères vers le bas.
- La pénalité active est celle du **niveau marqué le plus bas**, jamais la somme. Trois marques sur l'exemple donnent `-3`, pas `0 + -1 + -3`.
- `amount` est un nombre de marques d'un type, **appliquées une par une**. Une piste qui se remplit en cours de route suit donc la même règle qu'une piste déjà pleine.
- Marquer une piste **pleine** **augmente d'un degré sa marque la moins grave**, au lieu d'en ajouter une. Un degré sur ton échelle de types, quel que soit le type de la nouvelle marque.
- Une marque qui dépasserait la gravité maximale y reste ; celle qui n'a pas pu entrer compte comme **débordement**. Celui-ci est sauvegardé, afin qu'un rechargement n'oublie pas les dégâts déjà subis.
- **Guérir utilise la même commande avec une quantité négative.** Elle efface les marques les plus légères d'abord, et le débordement avant toute marque.

**Marquer en jeu.** Le GM écrit `[sheet: op="damage" track="harm" kind="knock" amount="1"]` et soigne avec un `amount` négatif. La forme de `damage` pour réserves, qui nomme `pool=`, ne change pas. La commande ordinaire `track` est refusée sur une piste de blessures : un nombre ne précise pas le type des nouvelles marques. Le joueur peut aussi marquer et effacer les cases à la main, comme ces systèmes le prévoient.

**Un combat peut aussi la marquer.** Fais pointer `combat.health` vers la piste plutôt qu'une réserve : un coup réussi marque les cases indiquées par `combat.damageKinds.marks`, du type auquel ce bloc associe ses dégâts. Un personnage à la piste pleine est à terre, ce que lit la règle de mort. Guérir efface une marque. Les points temporaires sont refusés faute de tampon où les placer. Le moteur lit la piste comme les niveaux RESTANTS ; tout le reste du combat, tomber, être ranimé, le journal et le récapitulatif, reste inchangé.

**Un repos peut guérir une piste.** Une restauration avec `"to"` la ramène à ce nombre de marques, débordement compris ; avec `"by"`, elle en efface ce nombre, débordement d'abord. Une étape qui AJOUTERAIT des marques ne fait rien, car un repos n'en précise pas le type.

### La pénalité sur tes jets

`resolution.penaltyFrom` nomme la piste de blessures dont la pénalité touche chaque test de l'ensemble. Elle est déclarée, pas supposée : un ensemble qui l'omet lance exactement comme avant l'existence des pistes.

L'EFFET de la pénalité dépend du type de résolution, comme celui du nombre de la fiche :

- Sous `dice-pool`, elle **retire des dés de la réserve**, sans descendre sous `pool.min`. Un `pool.min` de 1 permet encore de lancer un dé au dernier degré ; un `pool.min` de 0 permet de n'en lancer aucun et d'échouer sans jet.
- Sous `dice-sum`, c'est un **modificateur fixe du jet**, intégré au même nombre auquel contribuent l'attribut et l'entraînement.

Elle doit nommer une piste de blessures. Une piste ordinaire n'a pas de pénalité et est refusée à l'importation. Le résultat indique celle qui s'applique pour expliquer au joueur ses dés en moins ; le bloc de fiche du GM montre aussi le degré et son coût.

### Repos

Un repos liste des restaurations et des éléments à effacer. Chaque étape nomme une cible (`pool`, `poolGroup`, `listPools` ou `track`) et la fixe (`"to": "max"`, `"to": "min"` ou un nombre) ou la modifie (`"by": { "const": 1 }` ou `"by": { "fractionOfMax": 0.5 }`). Une étape visant une piste de blessures peut seulement la soigner ; voir plus haut.

### Texte du Game Master

- `checkGuidance` remplace le paragraphe intégré qui explique comment demander un test. Nomme le système et les occasions de lancer. Le GM nomme seulement la compétence et la difficulté. Le moteur lance et calcule depuis la fiche : ne demande pas de calculs au modèle.
- `sheetGuidance` introduit les fiches dans le prompt. Explique quelles ressources comptent et quand les dépenser.
- `worldGuidance` est facultatif et lu une fois à la création du monde pour adapter le cadre aux règles : aucune poudre à canon, magie rare, morts qui marchent. Il n'atteint jamais un tour.
- `sheetSummary` choisit les champs, valeurs dérivées et lignes de listes que voit le GM par personnage. Le moteur montre toujours les modificateurs d'attribut, les compétences et sauvegardes entraînées et les valeurs vivantes. Garde le reste court, car il part à chaque tour.

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
- `holds` : `"rows"` (valeur par défaut, et celle de tous les catalogues antérieurs à cette version) ou `"creatures"`. Un catalogue de créatures est un bestiaire lu par le combat : il n'écrit rien dans une fiche, ne déclare pas `feeds` et n'apparaît jamais dans le sélecteur. Consulte [Créatures](#creatures-a-bestiary-a-fight-reads).
- `feeds` : les une à huit listes de fiche où ses entrées peuvent écrire. Obligatoire pour les lignes, refusé pour les créatures. Une entrée ne peut écrire ni dans une autre liste, ni une valeur que ses colonnes ne peuvent contenir.
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

Chaque valeur est vérifiée contre les colonnes cibles. Un nom mal écrit ou un nombre hors limites est signalé avec son entrée d'origine. Les entrées dans le fichier de règles sont vérifiées à son chargement, donc à l'importation pour un fichier importé. Un catalogue séparé de paquet est vérifié lorsque le sélecteur le demande pour la première fois ; s'il contient une erreur, il montre les raisons plutôt que des entrées.

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
- Une ligne avec `scaled` doit être l'unique ligne de l'entrée pour cette liste ; une ligne marquée correspond ainsi toujours à une seule spécification.

La valeur est calculée à l'édition, jamais à la lecture : une ligne sauvegardée contient toujours le nombre qu'elle annonce. Elle est adaptée à la colonne : bornée par `min` et `max`, puis arrondie vers le bas si la colonne prend des entiers. Dans l'exemple, Heart 3 donne trois usages et Heart 0 ou moins n'en donne aucun. La ligne reste avec 0 usage ; un compteur au maximum de 0 n'étant pas une réserve, rien n'est dépensable en jeu.

Les colonnes à échelle nécessitent Capability API 1.23 pour les ensembles en paquets. Un ensemble communautaire importé est validé par le moteur qui le lit et n'a besoin de rien d'autre.

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

Une entrée peut porter un bloc `mechanics` facultatif exprimant ses effets numériques : `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dés comme `2d6` ou nombre fixe), `damageType`, `attackRoll`, `autoHit`, `save` (une sauvegarde de la fiche et l'effet d'une réussite), `applies` (états appliqués), `temporary` (points temporaires de santé), `scales` (quantité qui grandit avec la fiche), `cost` (réserve dépensée), `perCostStep`, `budget` (part de l'économie d'actions dépensée), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` et `check`.

Le sélecteur affiche ce bloc sur une ligne. Qui lit le reste dépend du bloc choisi par l'ensemble :

- Avec [`combat`](#combat-a-fight-your-own-rules-resolve), le combat lit ses effets. `range`, `area` et `friendlyFire` s'appliquent sur un champ avec positions ; `reaction` marque une entrée répondant à quelque chose et, tant qu'elle ne peut pas nommer le déclencheur attendu, elle ne figure sur aucun menu. `check` concerne les tests de compétence décrits plus haut.
- Avec seulement [`battle`](#battles-lending-the-sheet-to-marinaras-combat), la bataille lit `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` et `cost`, car le combat propre à Marinara peut les utiliser.

Le vocabulaire est fermé : une clé ou valeur absente de cette liste est refusée au lieu d'être ignorée.

`cost` est aussi le prix payé hors bataille par la commande `use` du GM, décrite ci-dessous.

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

`pool=` représente l'incantation à niveau supérieur : le même prix unique, payé depuis une autre réserve du groupe. Il est accepté seulement si le coût a un terme unique et si la réserve nommée appartient au même groupe. Tout autre cas est refusé plutôt que réinterprété.

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

Les fichiers séparés concernent les paquets publiés par le catalogue officiel : le paquet les liste dans `contributions.assets.paths` avec `ruleset.json` et nécessite Capability API 1.21. Un catalogue de créatures, intégré ou séparé, nécessite Capability API 1.27. **Un ensemble importé comme fichier unique ou partagé par GitHub contient ses catalogues dans le fichier**, donc ils doivent tenir dans sa limite totale de 256 KB. Cela permet quelques centaines d'entrées courtes.

Les limites sont douze catalogues par ensemble, 2000 entrées par catalogue dans les deux cas et 1 MB par fichier de catalogue.

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

Le bloc `battle` prête les nombres de la fiche au combat en gardant l'arithmétique Marinara. Le bloc facultatif `combat` définit comment tes règles RÉSOLVENT le combat. Il paramètre un type de combat détenu par le moteur, comme `resolution` paramètre les tests ; tous ses noms sont les tiens. Il existe un type aujourd'hui.

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

- `kind` : `"attack-vs-defense"`. Un camp lance les dés contre la défense de l'autre ; toucher inflige des dégâts.
- `health` : obligatoire. Ce que retire le combat : `{ "pool": "grit" }`, une réserve qui diminue et dont le tampon temporaire absorbe les dégâts d'abord s'il existe ; ou `{ "track": "harm" }`, une piste de blessures MARQUÉE. La piste exige `damageKinds` et n'accorde aucun point temporaire.
- `defense` : obligatoire, référence de valeur. Un champ saisi par le joueur ou une valeur dérivée calculée.
- `initiative` : obligatoire. Dés lancés une fois au début et référence facultative de modificateur. Une égalité favorise le plus grand modificateur, puis l'ordre de création du combat.
- `attackRoll` : obligatoire. Définit les dés, si l'on lance deux fois pour en garder un (`advantage`), les faces extrêmes d'un seul dé (`naturals.max` : `critical`, `hit` ou `none` ; `naturals.min` : `miss` ou `none`) et l'effet d'un critique (`critical` : `double-dice` relance les dés de dégâts ; `max-dice` ajoute une fois leurs faces maximales ; `none` donne un coup ordinaire). Les faces spéciales exigent un seul dé, comme les tests. Les sauvegardes du combat utilisent les mêmes dés.
- `economy` : obligatoire. `budgets` définit le contenu d'un tour : identifiant, libellé, `per` (`turn` remplit au début du tour du porteur ; `round`, au début d'une ronde) et `count`. Le PREMIER budget est le principal, dépensé par les actions standard. `movement` est une référence facultative de distance parcourue par tour, dans ton unité. Les combats sur plateau la lisent ; voir Positions.
- `attacks` : facultatif. Listes de fiche dont les lignes sont des armes. `name` est la colonne de nom ; `damage.dice`, celle des dés ; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` et `damage.type` nomment des colonnes de la même liste. Une colonne `ability` est un `enum` contenant un identifiant d'attribut ; un autre contenu n'ajoute rien. `proficiency` est `boolean` : l'activer ajoute la maîtrise. Sans dés lisibles, la ligne n'est pas une attaque ; une corde reste une corde.

  `strikes` référence le nombre d'attaques acheté par UNE dépense du budget. Choisir une ligne sans attaques disponibles dépense le budget et met les restantes en réserve. Tant qu'il en reste, toutes les lignes déclarant `strikes` sont gratuites : changer d'arme, de cible ou marcher entre les attaques découle du menu. `strikesCappedBy` nomme une colonne booléenne limitant SA ligne à une seule attaque, quel que soit le nombre acheté : cela sert aux armes tirant une fois par tour, comme la propriété Loading du SRD 5.1. Cela n'a aucun sens, et est refusé, pour une liste qui achète déjà une attaque par dépense. Les attaques disponibles appartiennent au COMBATTANT, pas à une liste : deux listes déclarant `strikes` partagent le même nombre, quelle que soit la ligne utilisée. Elles sont effacées à la fin du tour qui les a achetées. Sans déclaration, chaque dépense achète une attaque, comme auparavant.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities` : facultatif. Listes dont les lignes marquées par catalogue sont des capacités, filtrées comme `battle.skills` avec `onlyWhen` et `alwaysWhen`. Leurs effets sont le `mechanics` de l'entrée ; le bloc fixe le `budget` par défaut, le `toHit` ajouté si elle lance pour toucher et la `saveDifficulty` des sauvegardes. Une entrée demandant une sauvegarde, propre ou terminant un état appliqué, est refusée si sa liste n'a pas `saveDifficulty` : une sauvegarde contre rien réussirait toujours.
- `standard` : facultatif, liste fermée `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (attaques reçues lancées deux fois en gardant la pire) et `help` (prochaine attaque de l'allié lancée deux fois en gardant la meilleure) sont toujours résolus. `dash` (un autre déplacement complet) et `disengage` (personne ne frappe pour ton éloignement ce tour) sont résolus sur plateau et seulement enregistrés sans lui. `hide` et `ready` sont acceptés sans effet pour l'instant.
- `standardEffects` : facultatif, effets d'une action standard absents de son indicateur. Seul `dodge` en a aujourd'hui : `{ "dodge": { "saves": ["dex_save"] } }` indique les sauvegardes lancées deux fois en gardant la meilleure tant qu'il dure. Nomme seulement des sauvegardes déclarées, et seulement si `standard` comprend `dodge`. Sans cela, esquiver rend plus difficile à toucher, sans autre effet.
- `conditions` : facultatif. Associe TES identifiants d'états à leurs effets pour que fiche et combat partagent un registre : un personnage empoisonné le reste ensuite. Liste fermée : `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` et `cannot-approach-source`. `failsSaves` nomme les sauvegardes échouées sans jet. Les six effets nécessitant distance ou déplacement (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) n'agissent que sur plateau ; voir Positions. `cannot-react` exclut le porteur des fenêtres ouvertes par un déplacement : il n'est jamais interrogé. Trois clés s'ajoutent :
  - `saves` : sauvegardes visées par les deux effets de sauvegarde. Sans cette clé, toutes ; la déclarer sans un de ces effets est refusé.
  - `whileSourceInSight` : ce qui compte seulement quand l'auteur de l'état est visible du porteur. `true` conditionne tout l'état ; une liste de ses effets conditionne seulement ceux-ci et laisse les autres, comme une peur empêchant de s'approcher même sans voir la source. Un effet absent de l'état est refusé. Sans plateau, aucune ligne de vue ne peut être rompue et tout compte pareillement.
  - `endsWhenSourceDown` : l'état disparaît dès que son auteur tombe.

  `own-saves-advantage` et son contraire lancent deux fois et gardent un jet, comme les attaques ; ils s'annulent. `resist-all` réduit de moitié tous les dégâts en plus des défenses propres à la cible et s'annule avec une vulnérabilité de la même manière. `cannot-target-source` interdit de viser l'auteur de l'état avec quoi que ce soit. `cannot-approach-source` interdit de s'en rapprocher davantage que la case actuelle, chemin compris : contourner jusqu'à une case aussi éloignée reste permis ; passer près de lui puis ressortir de l'autre côté ne l'est pas.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration` : facultatif. Champ vivant `text` enregistrant l'effet maintenu, `save` imposée par les dégâts, `floor` minimal de difficulté et `fromDamage`, part des dégâts qui la fixe si elle est supérieure. Commencer une autre capacité concentrée termine la première ; rater la sauvegarde la termine et retire les états qu'elle maintenait.
- `dying` : facultatif, `kind: "saves"`. Deux pistes comptant les jets (le nombre nécessaire est leur maximum), `dice`, `succeedAt`, effets des faces extrêmes (`naturals.max` : `revive-1` ou `success` ; `naturals.min` : `one-failure` ou `two-failures`), coût des dégâts à terre (`damageWhileDown`, `criticalWhileDown`) et `condition` du personnage à terre. Sans bloc, zéro santé met simplement à terre et les soins le ramènent.
- `damageTypes` : facultatif. Types du système, comparés sans tenir compte de la casse.
- `damageKinds` : obligatoire si `health` nomme une piste de blessures, refusé pour une réserve : seule une marque conserve un type. Définit les `kinds` marqués par un coup et le nombre de cases. `default` reçoit tout ce qui n'est pas associé, y compris les dégâts sans type ; `byType` associe `damageTypes` aux types de marques sans distinguer la casse : `"Fire"` et `"fire"` sont la même clé et les déclarer ensemble est refusé. `marks` n'a pas de valeur par défaut car ses deux réponses s'opposent : `"per-point"` compte les niveaux de santé selon les dégâts, donc trois dégâts marquent trois cases et les réduire est utile ; `"per-blow"` marque une case si le coup touche, quelle que soit sa force. Un coup à plusieurs clauses marque encore une seule case en prenant le type le plus grave passé. Indique le choix de ton système : `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `threat` : facultatif, nécessaire à un bestiaire. `tiers` est l'échelle d'adversaires : identifiant, libellé, plage `health`, `defense`, `toHit`, plage `damagePerRound` et `saveDifficulty`. Chaque créature nomme un palier ; un adversaire non écrit est ramené à celui demandé par le GM, sans sortir de l'échelle. `damagePerRound` décrit ce qu'il inflige à UNE cible par ronde, séquence complète comprise.

### Ce qu'un combat lit dans `mechanics`

`kind` détermine si `amount` représente des dégâts ou des soins ; toute entrée marquée `reaction` reste hors du menu, tout comme une entrée `utility`, sauf si elle modifie ce que le tour lui-même peut contenir (voir ci-dessous). `attackRoll` effectue un jet contre la défense de la cible avec le `toHit` de la liste ; `autoHit` saute entièrement cette étape. `save` lance la sauvegarde de la cible contre la `saveDifficulty` de la liste, et `onSuccess` détermine si une réussite subit la moitié ou rien. `targetCount` indique combien de cibles elle peut viser. Une capacité sans jet d'attaque (une zone contre laquelle chacun effectue une sauvegarde, quelque chose qui touche directement) lance ses dés UNE FOIS pour toutes les cibles ; une capacité qui lance pour toucher chaque cible relance ses dés à chaque coup au but. `applies` impose des états à ce qu'elle affecte, chacun avec une `duration` de `instant` (sans horloge propre : il reste jusqu'à ce que quelque chose le retire), `until-save` (qui exige `saveEnds` à côté) ou `{ "rounds": n }`, et éventuellement un `saveEnds` qui nomme la sauvegarde et indique si elle se répète à `turn-end` ou `turn-start`. `temporary` accorde des points temporaires à la réserve de santé, qui ne se cumulent jamais : la plus grande protection reste. `scales` augmente la quantité du nombre de DÉS supplémentaires que sa table donne pour la valeur lue. `cost` se paie par la commande `use` de la fiche elle-même, et `budget` remplace la partie de l'économie dépensée.

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
    "when": ["advantage", "ally-adjacent"],
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

`sources` nomme les listes d'attaques dont elle provient et `requires` une colonne vraie de leurs lignes ; ainsi, un effet supplémentaire qui ne se déclenche qu'avec certaines armes les précise sans qu'Engine sache ce qu'est une arme. N'indiquer ni l'un ni l'autre signifie n'importe quel coup au but de son détenteur. `when` accepte N'IMPORTE LAQUELLE des options : `advantage` est l'orientation finale du jet d'attaque, et `ally-adjacent` désigne un allié de l'attaquant debout et capable d'agir, à une case de la cible sur un plateau et n'importe où sans plateau. `oncePer` vaut `turn` (renouvelé au début de chaque tour, de sorte qu'un coup porté pendant qu'un autre agit peut encore en bénéficier) ou `round`. `amount` augmente avec le `scales` de l'entrée, et `type` est le type de dégâts, celui du coup par défaut.

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

Les nombres ci-dessous sont la manière directe d'écrire une créature. Une créature écrite dans les termes de ton ensemble de règles, sous forme de `sheet`, tire plutôt `health`, `defense`, `initiativeModifier`, `speed`, `abilities` et `saves` de cette fiche (voir « Une créature écrite dans les termes de ton ensemble de règles », ci-dessous).

- `health` : un nombre, ou `{ "dice": "3d6", "flat": 2 }`, lancé une fois à la création du combat. Une prévision lit la moyenne, donc un menu ne promet jamais un dé que personne n'a lancé.
- `defense`, `initiativeModifier`, `speed` : ce contre quoi l'attaque est lancée, ce qui est ajouté à l'initiative et la distance parcourue en un tour, dans ton unité de distance.
- `abilities` et `saves` : indexés par les identifiants de caractéristiques et de sauvegardes déclarés par ta fiche. Une sauvegarde absente vaut zéro.
- `resist`, `vulnerable`, `immune` : types de dégâts comparés sans tenir compte de la casse et vérifiés contre `combat.damageTypes` si tu en déclares. `conditionImmunities` nomme tes propres états.
- `tier` : le barreau de `combat.threat` auquel elle appartient.
- `traits` : de courtes paires nom/texte montrées au Game Master. Elles ne sont jamais résolues, donc tout ce qui contient des nombres appartient à une action.
- `signaturePoints` : points rendus au début de son propre tour et dépensés pour les actions `signature`.
- `riders` : jusqu'à quatre, identiques au `rider` d'une entrée de catalogue, écrits sur le bloc. Chacun vaut `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, avec un `type` facultatif et un `actions` facultatif qui nomme les actions de ce bloc sur lesquelles il se déclenche. L'effet supplémentaire d'un bloc ne lit aucune liste de fiche : `sources` et `requires` sont donc les deux clés qu'il ne possède pas. Une créature écrite sous forme de fiche reçoit les effets supplémentaires de ses listes, exactement comme un personnage.
- `actions` : jusqu'à douze, chacune avec son propre `id`. Une action porte ce qu'un bloc de statistiques écrit à la main porte (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), plus quatre éléments propres aux créatures. `reach` est sa portée de frappe, `range` sa portée de lancer ou de tir et `area` sa forme d'impact, le tout dans ton unité de distance ; `range` peut être un simple nombre ou `{ "normal": 30, "long": 120 }` si elle porte plus loin avec une pénalité, et `area` vaut `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (voir Positions) :
  - `uses` : `{ "per": "encounter" | "day", "count": n }`. Lorsqu'ils sont épuisés, l'action quitte le menu.
  - `recharge` : `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Elle commence le combat disponible, est dépensée à l'utilisation, puis lance les dés au début du propre tour de la créature : `from` ou plus la rétablit. Le journal contient les dés dans les deux cas.
  - `sequence` : d'autres actions du même bloc, dans l'ordre, chacune avec sa propre cible. **C'est ainsi que s'écrit une créature qui frappe deux fois en une action.** Un budget paie toute la séquence. Une séquence ne porte rien de propre et ne peut jamais nommer une autre séquence.
  - `signature` : `{ "cost": n }`, payée avec les points de la créature plutôt qu'un budget et uniquement pendant qu'un autre agit : le combat la propose dans la fenêtre entre deux tours (voir Fenêtres).
- Une sauvegarde nécessite une difficulté sur l'action elle-même : `save.difficulty` pour une sauvegarde imposée par l'action, ou `saveDifficulty` pour un état qui prend fin sur sauvegarde lorsque l'action n'a pas sa propre sauvegarde. Une action de bloc s'écrit avec des nombres simples même sur une créature dotée d'une fiche : ce nombre réside donc sur l'action. La sauvegarde d'une clause peut omettre sa `difficulty` et reprendre ce même nombre.
- `damage.plus` est la même liste de clauses que le `plus` d'une entrée de catalogue, et se lit exactement de la même manière : `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` est une morsure qui porte la chaleur comme quantité distincte, avec sa propre résistance et son propre doublement.

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
- **Chaque nombre n'a qu'une source.** Une créature avec une fiche ne fournit pas aussi `health`, `defense`, `initiativeModifier`, `speed`, `abilities` ou `saves`, et Engine refuse le fichier si elle le fait. Elle peut n'avoir aucune `actions` propre, puisque ses listes définissent ce qu'elle fait. Une créature sans fiche fournit toujours les trois premiers et au moins une action.
- **Elle est vérifiée comme les données d'auteur qu'elle est.** Chaque identifiant doit être déclaré par ta fiche ; une compétence ou sauvegarde prend l'un des paliers de maîtrise que tu lui proposes ; un champ, score, bonus ou colonne contient ce qu'il est déclaré contenir (un entier dans son intervalle, une de ses valeurs, etc.), et une liste ne contient pas plus de lignes qu'elle n'en autorise. Il n'y a pas de partie `live`, car le combat conserve les dépenses de la créature.
- **Une ligne peut provenir d'un catalogue.** `_catalog: "<catalog>/<entry>"` nomme l'entrée dont une ligne a été sélectionnée, comme sur une fiche de personnage, et le combat lit dans cette entrée le coût et l'effet de la ligne. Le catalogue doit alimenter cette liste. Quand le catalogue est intégré au fichier, l'entrée doit s'y trouver ; quand il possède son propre fichier, une ligne qui nomme une entrée absente de ce fichier ne donne simplement rien à la créature. Les catalogues nommés par les fiches d'un bestiaire sont chargés pour le combat avec le bestiaire.
- **Ce que l'entrée indique à côté de la fiche compte toujours** : `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` et `conditionImmunities`.
- **Elle paie dans ses propres réserves.** Elles commencent pleines ; elle les dépense pour ce que lui donnent ses listes, et les paiements supérieurs (un sort avec un emplacement supérieur) lui sont proposés exactement comme à un membre du groupe, qu'Engine ou le Game Master décide pour elle. Hold the Line coûte de la Luck au gardien.
- **Avec une piste de blessures, sa santé est la piste.** Un coup marque la propre piste de la créature selon tes `damageKinds`, après application de ses `resist`, `vulnerable` et `immune` ; une créature immunisée à un type de dégâts n'en reçoit donc aucune marque.
- **Elle reste un adversaire.** À zéro, elle est hors combat plutôt que mourante ; elle ne lance jamais de sauvegarde contre la mort ; l'écran montre ce qu'il montrait toujours d'un adversaire et rien de sa fiche, et aucune de ses dépenses n'est réécrite ailleurs, même si un personnage porte le même nom.
- **Une fiche dont la santé totale est nulle** est exclue du combat, et le journal d'ouverture explique pourquoi, plutôt que de faire entrer quelque chose que personne ne peut blesser.
- Une couche qui retire une valeur d'un de tes champs énumérés ne supprime jamais une créature qui l'utilise : tant que la couche est active, ce champ prend sa valeur par défaut pour la créature, exactement comme pour un personnage, et la créature n'est pas refusée pour cette raison.
- Un Game Master peut aussi en inventer une, qui reste limitée à son palier (voir Adversaires que personne n'a écrits).
- Un paquet qui en fournit une déclare Capability API 1.34.

Le Toll Sergeant du brouillon 5e est la même chose sur une fiche d20 : son Armor Class, ses points de vie, ses sauvegardes et ses deux frappes par action proviennent de ses propres champs et de sa liste d'attaques.

#### Adversaires que personne n'a écrits

Lorsqu'un Game Master invente un adversaire, Engine ramène la proposition sur ton échelle `threat` avant tout jet : la santé dans la plage du palier ; la défense, le bonus d'attaque et les difficultés de sauvegarde au maximum à deux au-dessus du palier ; et les dégâts diminués jusqu'à ce que le meilleur round de la créature (sa séquence la plus forte ou son action individuelle la plus forte, mesurée contre une cible) entre dans le `damagePerRound` du palier. Il réduit d'abord le nombre de dés, puis la partie fixe, puis une frappe d'une séquence, et seulement ensuite la taille du dé, sans jamais réduire quoi que ce soit à néant. Les noms absents de ton ensemble de règles sont retirés : types de dégâts, états et sauvegardes inconnus, ainsi que tout ce qui dépasse les six premières actions. Un palier jamais déclaré se rabat sur le bas de ton échelle. Chaque changement est renvoyé sous forme d'une phrase simple pour que le journal puisse expliquer son intervention.

Une invention peut aussi s'écrire sous forme de `sheet`, comme une créature de bestiaire ; c'est ainsi qu'un mage inventé obtient emplacements et sorts. Le Game Master voit les identifiants de ta fiche et ce que chacun peut contenir, les listes lues par le combat et les noms que tes catalogues leur proposent ; ainsi, un sort est nommé plutôt que décrit : une ligne qui nomme une entrée de catalogue, quelle que soit sa casse, devient cette entrée, et les propres valeurs du Game Master (comme la préparation d'un sort) s'appliquent par-dessus. La fiche est lue avec tolérance, car un modèle l'a écrite : un nom absent de ton ensemble de règles est retiré, une valeur est ajustée à son champ ou sa colonne, et les nombres écrits à côté de la fiche ne sont pas utilisés.

Une créature inventée qui n'est pas un boss est limitée à ce que ton ensemble de règles lui ouvre. Un filtre de catalogue avec `startFrom` nomme le champ de fiche qui organise ses entrées (la liste de sorts du paquet 5e par `class`), et une créature inventée ne conserve que les entrées dont le filtre correspond à sa propre valeur de ce champ, selon la comparaison utilisée à l'ouverture du sélecteur. Ainsi, un Sorcerer n'a jamais toute la liste de sorts, et une créature sans classe indiquée ne reçoit rien d'un catalogue organisé par classe. Les choix laissés ouverts sont ensuite complétés sans interroger à nouveau le Game Master : pour chaque liste dont les lignes ne comptent qu'une fois choisies (`onlyWhen` sur une source de capacités de combat), parmi les entrées accessibles qu'elle peut payer avec ses propres réserves, chaque réserve qu'elle possède reçoit un petit nombre d'entrées (davantage pour une créature plus compétente), tout comme ce qu'elle peut utiliser à volonté. Ce qu'elle reçoit dépend de son tempérament et de sa compétence, les mêmes qui gouvernent son combat : une créature protectrice ou de soutien cherche ce qui soutient son camp ; une téméraire, les dégâts ; une méthodique ou patiente, ce qui entrave un ennemi ; et plus elle est compétente, plus elle risque de porter une réaction, un contre ou tout autre élément qui modifie le tour. Le tirage vient de la graine du combat, donc un même combat complète toujours de la même façon. Une ligne que le Game Master a nommée dans une telle liste compte comme choisie.

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
"cover": { "bonus": 2 },
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

Une action de créature peut aussi porter l'`area` dans laquelle elle touche, dans ton unité : `{ "shape": "cone",
"size": 15 }`, avec `"friendlyFire": false` pour épargner son camp. C'est ainsi qu'un souffle devient un vrai cône sur le plateau plutôt qu'un nombre de cibles. Une séquence n'a pas de forme propre ; les actions qu'elle nomme ont les leurs. Un combat sans plateau ignore la forme et utilise `targetCount` ; une entrée de créature peut donc porter les deux et rester fidèle dans les deux cas.

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

**Ligne de vue et couverture.** Une ligne droite de cases entre les deux : tout élément solide bloque un tir et empêche une zone de s'étendre au-delà, et la cible n'apparaît simplement pas au menu. Le terrain qui offre une couverture ajoute `cover.bonus` à la défense contre laquelle l'attaque est lancée, et le journal le précise. Il n'y a ni couverture aux trois quarts, ni couverture totale, ni altitude.

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

Le combat se joue sur l'écran de bataille dans tes mots. Le menu contient tes attaques, tes capacités et les actions standard que tu as listées, chacune indiquant ce qu'elle dépense dans tes budgets et réserves. L'ordre des tours, le round, chaque état nommé avec ses rounds restants, les points temporaires, la concentration et les deux compteurs de ta règle d'agonie sont affichés. Le journal imprime le calcul réel dans tes termes : "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Chaque action acceptée est écrite sur la fiche au moment où elle se produit ; un rechargement en plein combat est donc exact, et le Game Master reçoit ensuite l'instruction de ne pas changer ces nombres à nouveau.

Un combat avec positions est dessiné sur le plateau plutôt que sur la scène des portraits ; voir Positions pour les interactions du joueur. Chaque distance, sur le plateau, dans le menu et dans le journal, est exprimée dans TON unité : "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Fenêtres : maintenir le combat ouvert

Certains moments appartiennent à quelqu'un d'autre que l'acteur en cours. Engine maintient le combat ouvert pour cette personne plutôt que de décider pour elle ; cette pause est une fenêtre.

Quatre événements en ouvrent une, dont deux proviennent de ce que tu as déjà déclaré :

- **Quelqu'un s'éloigne.** Une marche qui quitte l'allonge d'un ennemi capable de frapper s'arrête à cette étape et l'interroge. Voir Frappes sur quelqu'un qui s'éloigne, ci-dessus.
- **Entre deux tours.** À la fin d'un tour, chaque adversaire possédant des `signaturePoints` et pouvant payer l'une de ses propres actions `signature` est invité à en acheter une, avant le début du tour suivant. C'est le seul moment où elles s'achètent : une action distinctive ne figure sur aucun menu de tour, pas même le sien.
- **Quelque chose vise quelqu'un.** Avant sa résolution, toutes les cibles de l'AUTRE camp possédant une entrée qui attend ce moment sont interrogées. Un ami qui te soigne n'est pas une menace à laquelle répondre ; son action n'ouvre donc aucune fenêtre.
- **Quelque chose a blessé quelqu'un.** Après sa résolution, toutes les personnes blessées possédant une entrée qui attend CE moment sont interrogées, quel qu'en soit l'auteur. Être blessé est un fait qui te concerne ; une entrée renvoyée vers le responsable ne peut toujours pas viser un ami.

Les deux dernières sont celles qu'une entrée de catalogue demande en nommant le moment qu'elle attend.

Ce que fait une fenêtre, quelle que soit son origine :

- **Rien d'autre ne bouge tant qu'elle est ouverte.** Ni l'acteur dont c'est le tour, ni la fin de ce tour, ni une autre fenêtre. Le combat attend.
- **Elle interroge une personne à la fois**, dans l'ordre des tours, une seule fois chacune. Passer est toujours une réponse et ne coûte rien. Une personne interrogée qui ne peut rien exécuter est ignorée plutôt qu'interrogée.
- **Elle reprend exactement où elle s'était arrêtée.** Une marche termine les cases restantes, en payant chacune de celles réellement traversées.
- **Celui qui joue répond.** La fenêtre de ton membre du groupe t'appartient, avec l'option et **Pass** (passer) à côté dans le menu ; celle d'un adversaire est gérée par celui qui le joue, et un boss du Game Master est interrogé par l'intermédiaire du Game Master, avec laisser passer ce moment parmi ses réponses.
- **Elle est sauvegardée avec le combat.** Une partie fermée au milieu d'une marche revient avec les mêmes personnes à interroger et les mêmes cases à parcourir.

Tu ne déclares rien pour les deux premières : un ensemble de règles avec `opportunity.budget` obtient l'une, un bestiaire avec `signaturePoints` obtient l'autre, et un ensemble de règles sans aucun des deux ne les voit jamais.

**Indiquer le moment qu'une entrée attend.** Écris `mechanics.reaction` comme un objet plutôt que `true` :

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` vaut `aimed` ou `harmed` et place l'entrée dans le menu de cette fenêtre. Ce sont les deux seuls moments qu'Engine surveille. Une entrée qui indique encore `"reaction": true` dit seulement qu'elle ne s'exécute pas pendant un tour ; cela ne suffit pas à la proposer quelque part, elle ne figure donc sur aucun menu.
- `at` vaut `source` (par défaut) ou `chosen`. `source` dirige l'action vers le responsable du moment et remplit la cible, donc personne n'est invité à choisir ; `chosen` conserve les propres cibles de l'entrée et demande un choix.
- `cancels` empêche entièrement ce que la fenêtre retenait de se produire. Seule une entrée `aimed` peut le déclarer : un moment déjà survenu ne peut être annulé.

Donne-lui aussi un `budget`, sinon elle dépense celui par défaut de la liste. Une réaction dépense presque toujours un budget propre, ce qui empêche un tour d'en contenir plusieurs.

**Son coût est dépensé avant d'interroger qui que ce soit.** Une action annulée est empêchée de se produire, pas d'avoir été achetée : budget et réserves sont déjà dépensés. Si ton système les rembourse, il ne peut pas encore le dire.

Un paquet qui nomme un moment nécessite Capability API 1.33.

### Pas encore

Dit clairement, car un ensemble de règles ne doit pas promettre ce qu'Engine ne fait pas :

- **Au-delà du plateau modeste** : ni couverture aux trois quarts ou totale, ni altitude, ni vol au-dessus des obstacles, ni passage serré, ni montures, ni déplacement par agrippement ou bousculade, ni dissimulation ou surprise, et rien ne pousse personne ailleurs.
- **Une entrée ne peut attendre que deux moments**, `aimed` et `harmed` (voir Fenêtres, ci-dessus). Ce sont les moments qu'Engine remarque pour une entrée ; les deux autres fenêtres, quelqu'un qui s'éloigne et la pause entre deux tours, sont ouvertes par le combat lui-même et ne sont pas des moments qu'une entrée peut demander. Il n'existe pas de moment pour un jet de sauvegarde, un sort lancé en tant que tel, une mort, un début de tour ou une chute.
- **Pas d'enchaînement.** Le combat conserve une fenêtre plutôt qu'une pile, donc rien ouvert à l'intérieur d'une fenêtre n'en ouvre une autre : un contre ne peut pas être contré à son tour, et ce qu'inflige une réaction n'ouvre aucun autre moment.
- **Une réaction arrête quelque chose ou fait quelque chose ; elle ne peut pas en changer un nombre.** Il n'y a aucun moyen de dire « plus difficile à toucher jusqu'à ton prochain tour », car un état est un nom dans une liste fermée plutôt qu'un modificateur. C'est une limite des états, pas des réactions.
- **Rien n'est remboursé.** Le coût d'une action annulée reste dépensé.
- Les états font ce que la liste fermée d'effets peut dire et rien de plus. Un état qui impose un désavantage aux TESTS de caractéristique, ou qui empire par niveaux comme l'épuisement, est aujourd'hui un simple relevé sur la fiche.
- **Une créature écrite en nombres simples n'a pas de piste de blessures.** Dans un ensemble de règles dont la santé est une piste, cette créature perd toujours des points ; donne-lui une `sheet` et les coups qu'elle reçoit marqueront des cases, d'abord atténués par ses propres `resist`, `vulnerable` et `immune`.
- **Un effet supplémentaire se déclenche seul.** `on` n'a qu'une valeur, `hit` : le premier coup au but admissible de la période l'applique, sans moment où l'on te demande si tu souhaites en dépenser un.

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

**Ce qu'une couche ne peut pas faire.** Elle ne peut ajouter une valeur énumérée, un champ, une compétence, une réserve ou un repos, changer le type de résolution, toucher l'état en cours ou les nombres de combat, ni ajouter un appel de modèle. Une valeur qu'une couche _ajouterait_ serait inconnue de tous les autres lecteurs de la fiche ; les valeurs ne peuvent donc que disparaître. Tout ce qui dépasse cette liste constitue une modification de l'ensemble de règles lui-même ou un second ensemble.

**Conflits.** `conflicts` nomme les couches qui ne peuvent être actives ensemble. Nommer un seul côté de la paire suffit. L'assistant désactive l'autre interrupteur, et si un choix sauvegardé contient malgré tout les deux, la couche déclarée **plus tard** est retirée ; les deux mêmes choix donnent donc toujours les mêmes règles.

**Une fiche contenant déjà une valeur retirée la conserve.** Rien ne réécrit un personnage. L'éditeur cesse simplement de proposer la valeur, et un personnage qui la possédait déjà l'affiche telle quelle. Désactive la couche dans une nouvelle partie et la valeur sera proposée à nouveau. Il en va de même pour une entrée de catalogue masquée : elle disparaît du sélecteur, et une ligne déjà choisie par le joueur reste sur la fiche.

**Limites.** 12 couches par ensemble de règles et 4000 caractères de consignes par couche, les deux chaînes comptées ensemble. Un ensemble de règles empaqueté qui déclare `layers`, ou un `gm.worldGuidance` de base, nécessite Capability API 1.25. Un ensemble que tu importes est validé par Engine à la lecture et n'a donc besoin de rien.

**Les couches écrites par quelqu'un d'autre** (une couche de magie rare pour un ensemble de règles que tu n'as pas écrit, livrée dans son propre fichier) viendront plus tard. Aujourd'hui, une couche est livrée à l'intérieur de l'ensemble de règles auquel elle appartient.

<a id="trying-your-ruleset"></a>

## Essayer ton ensemble de règles

Les ensembles de règles communautaires utilisent le même interrupteur que les agents importés. Ouvre **Settings** (réglages) > **Advanced** (avancé) > **Danger Zone** (zone de danger) et vérifie que **Allow custom Agent imports** (autoriser l'importation d'agents personnalisés) est activé. L'importation nécessite aussi un accès localhost ou **Admin Access** (accès administrateur) configuré.

1. Ouvre le panneau **Agents** (agents) et choisis le bouton **Import agents** (importer des agents), l'icône de téléchargement dans la rangée de boutons en haut du panneau.
2. Choisis **Game Mode ruleset** (ensemble de règles du mode jeu) et sélectionne ton fichier JSON.
3. Lis l'examen. Il montre le nom, la version, la licence, ce que couvre l'ensemble de règles et le texte du Game Master. Choisis **Import** (importer).

Ton ensemble apparaît dans la section **Rules** (règles) du panneau et dans le choix **Rules** de l'assistant de configuration des nouvelles parties. Un ensemble importé depuis un fichier est classé sous `local/<your id>`, pour ne jamais être confondu avec un ensemble officiel ou celui de quelqu'un d'autre.

### Modifier un ensemble de règles déjà importé

Une version importée n'est jamais réécrite. Si tu modifies le fichier et le réimportes avec la même `version`, l'importation est refusée et te demande d'augmenter le numéro. C'est volontaire : une partie est liée à la version exacte utilisée à sa création, pour qu'une campagne en cours ne se réveille jamais avec des calculs différents.

Pendant la rédaction, le cycle est donc : modifier, augmenter `version`, importer, commencer une nouvelle partie. Les anciennes versions restent installées à côté de la nouvelle jusqu'à ce que tu retires l'ensemble de règles de la section **Rules**. Retirer un ensemble encore utilisé par une partie fait signaler à celle-ci que son ensemble de règles manque, jusqu'à sa réimportation.

Si tu changes la structure de la fiche (ajout, suppression ou renommage d'éléments), augmente aussi `sheet.version`. Les fiches existantes sont lues avec tolérance : les valeurs inconnues de la nouvelle fiche sont conservées, et les valeurs manquantes prennent leur valeur par défaut.

## Partager ton ensemble de règles

**Sous forme de fichier.** Envoie le fichier JSON à un ami. Il l'importe comme toi.

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

**Dans le catalogue officiel.** Un système largement joué, dont les licences sont claires, peut être proposé à tous via **Download Agents** (télécharger des agents). Cela passe par une pull request au dépôt [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Consulte le paquet `ruleset-5e-2014` pour sa structure.

## Licences

Ne publie que du texte de règles que tu as le droit de partager. Beaucoup de systèmes publient un document de référence sous licence ouverte ; c'est ce document que tu peux copier. Place l'identifiant de licence et le texte d'attribution exigé sous `license`. Ne copie pas le texte de livres de règles sans licence ouverte. Un ensemble de règles a surtout besoin de noms et de nombres, et le texte du Game Master doit être rédigé dans tes propres mots.

## Dépannage

- **L'importation dit qu'un nom n'existe pas.** Quelque chose dans le fichier pointe vers un identifiant non déclaré, comme une compétence nommant une caractéristique supprimée. Le message donne le chemin vers la ligne.
- **L'importation dit qu'une version est déjà installée avec un contenu différent.** Augmente `version` et réimporte.
- **Mon ensemble de règles n'apparaît pas dans l'assistant de configuration.** Vérifie que **Allow custom Agent imports** est activé. Lorsqu'il est désactivé, les ensembles importés sont exclus des nouvelles parties. Les parties qui en utilisent déjà un continuent de fonctionner.
- **Une partie dit que son ensemble de règles manque.** La version exacte utilisée à sa création n'est pas installée. Réimporte cette version du fichier.

