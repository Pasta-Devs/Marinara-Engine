# Assistant de création de personnages des ensembles de règles

Cette page fait partie du guide [Écrire des ensembles de règles Game Mode](writing-rulesets.md). L'assistant de création guidée : créer un personnage par étapes, de la race et de la classe aux scores, aux maîtrises, aux sorts et à l'équipement.

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

Jusqu'à 32 étapes, chacune `{ id, label, kind, ... }` ; un package qui en a plus de 16 déclare Capability API 1.112, et un qui en a plus de 24 déclare Capability API 1.768 :

- `catalog` : les entrées d'un catalogue de lignes, affichées sous forme de cartes avec leur `summary` derrière **Info** (informations). `min` (1 par défaut) est le nombre d'entrées que l'étape demande et `max` (1 par défaut) le plus grand nombre qu'elle accepte ; avec `max` à 1, une nouvelle sélection remplace l'ancienne. Les deux peuvent monter jusqu'à 60 ; un package dont l'un dépasse 20 déclare Capability API 1.110, et un dont l'un dépasse 40 déclare Capability API 1.768 (le grimoire d'un magicien de niveau 20 contient 44 sorts). `field` nomme un champ texte ou enum dans lequel les libellés sélectionnés sont écrits (un champ enum prend l'identifiant ou le libellé de l'entrée, celui qui fait partie de ses valeurs). `filters` fixe des valeurs des filtres du catalogue, et `within: { step, filter }` ne propose que les entrées dont le `filter` nomme une entrée sélectionnée à cette étape antérieure, comme une sous-race nomme sa race ; si la race est désélectionnée, sa sous-race ne compte plus. `upTo: { filter, value }` (Capability API 1.87) ne propose que les entrées dont le `filter` numérique vaut au plus `value`, une valeur lue sur la fiche telle qu'elle est, comme des aptitudes jusqu'au niveau du personnage (`{ "filter": "level", "value": { "derived": "level" } }`) ; une entrée sans ce filtre est toujours proposée, et une sélection sous laquelle la fiche est retombée depuis ne compte plus, mais elle est conservée. Une sélection qui modifie la valeur lue (une classe qui fixe le niveau) est réglée dans la même modification, tout comme une valeur modifiée dans **All fields** (un niveau abaissé là reprend aussitôt ce qu'une aptitude au-dessus avait donné). `countFrom` (Capability API 1.90) est une valeur lue de la même façon sur la fiche qui tient lieu à la fois de `min` et de `max` : le nombre d'entrées que l'étape demande et le plus grand nombre qu'elle accepte, arrondi vers le bas et jamais au-dessus de `max`, comme les sorts qu'une classe connaît au niveau du personnage (`{ "derived": "spells_known" }`). Les sélections au-delà sont conservées mais ne comptent pas jusqu'à ce que le compte remonte. Une étape de catalogue peut aussi porter `stamp` (Capability API 1.108), de 1 à 4 valeurs de colonne écrites sur chaque ligne qu'elle ajoute, comme `"stamp": { "class": "wizard" }` sur l'étape des sorts du magicien et `"stamp": { "class": "cleric" }` sur celle du clerc. Chaque clé doit être une colonne de chaque liste qu'alimente le catalogue ; les valeurs sont des chaînes, des nombres ou des booléens. Le marquage remplace la valeur initiale du catalogue. Les lignes existantes et les modifications ultérieures dans **All fields** restent celles du joueur. Avec Capability API 1.130, une valeur de marquage peut plutôt être un objet dont le `fromWithin` vaut `"id"`, `"label"` ou un identifiant de filtre déclaré par le catalogue parent : elle lit le premier parent correspondant dans l'ordre des sélections, écrit une chaîne ou un nombre une seule fois quand la ligne est ajoutée, et laisse cette colonne sans marquage si aucun parent ne correspond ou si son filtre est absent ou est un tableau.

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
- Une entrée de catalogue peut nommer un groupe `exclusive` (Capability API 1.94) : une étape de l'assistant garde une sélection par groupe, si bien que sélectionner une entrée retire l'autre sélection de l'étape dans ce groupe, et seule la plus récente compte. Un don pris à la place d'une amélioration de caractéristique partage un groupe avec elle : `"exclusive": "fighter-asi-4"`. `"exclusiveDefault": true` (Capability API 1.772) fait de cette entrée celle qu'une étape qui prend tout ce qu'elle propose prend dans son groupe tant que le joueur n'en choisit pas une autre.
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

**Lignes comptées et lignes qui correspondent (Capability API 1.205).** Un `listSum` peut porter `where:
{ "column", "equals" }` pour ne lire que les lignes dont la cellule est égale à une valeur (une cellule vide se lit comme la valeur par défaut de sa colonne), et `count: true` à la place de `column` pour compter les lignes au lieu d'additionner une colonne. La pyramide de talents de Genesys, ce sont deux comptes dérivés et une règle de création :

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

**Achats dans les deux sens, possédés et échangés (Capability API 1.164).** `"direction": "both"` permet à une même offre d'augmenter et de baisser sa valeur depuis son point de départ (sa `baseline`, quand elle est déclarée, doit correspondre à la fiche) : chaque cran vers le haut coûte le prix de la courbe et chaque cran vers le bas au-delà du départ le rapporte en crédit, dans la limite du `creditLimit` et des plafonds de la réserve. Le livre de comptes ne va jamais que dans un sens : baisser une valeur achetée reprend le dernier achat au prix payé, et augmenter une valeur baissée rembourse son crédit ; acheter puis baisser ne crée jamais de crédit. Une telle cible a une seule offre dans tout l'assistant. La ST de GURPS s'écrit `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14,
"cost": { "flat": 10 } }` ; un coût en table fixe le prix de crans fractionnaires comme Basic Speed. `"direction": "increase"` et `"decrease"` désignent explicitement une offre à sens unique (`"decrease"` est la réduction ci-dessus, avec sa référence et son crédit).

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

Une étape de lignes peut indiquer le nombre de lignes qu'elle demande avec `countFrom` (Capability API 1.799), une valeur lue sur la fiche : les jets de points de vie de 5e, un par niveau après le 1er. Quand l'étape est affichée, l'assistant ajoute des lignes, chacune telle que **Add a row** (ajouter une ligne) la crée, jusqu'à ce que les propres lignes du joueur atteignent ce nombre, sans jamais dépasser `max` ni le `maxItems` de la liste ; il ne retire jamais de ligne, et une ligne supprimée à cet endroit reste supprimée jusqu'à ce que l'étape soit affichée à nouveau. Consulter l'étape ne donne pas de lignes à un personnage en cours de description. L'étape attend alors ce nombre de lignes complètes comme elle le fait pour `min`, le plus grand des deux nombres quand les deux sont donnés, et affiche le même décompte "N of M". Un ensemble de règles qui l'utilise nécessite Capability API 1.799.

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

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
