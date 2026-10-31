# Fiches des ensembles de règles

Cette page fait partie du guide [Écrire des ensembles de règles Game Mode](writing-rulesets.md). Ce qui figure sur la fiche de personnage d'un ensemble de règles : attributs, compétences, champs et listes, états vivants, pistes de blessures, pénalités, repos et texte du GM (maître du jeu), ainsi que la fiche d'équipe et les décomptes de progression.

## La fiche

- `sections` regroupe les éléments dans l'éditeur. Les champs, valeurs dérivées et listes nomment avec `section` celle où ils se trouvent, et les attributs, compétences et sauvegardes le peuvent aussi : l'éditeur, la fiche de la partie et le bloc de fiche du Game Master les montrent alors sous ce titre (une fiche qui ne leur nomme aucune section les montre exactement comme avant). Une section peut aussi porter une règle `untrained` (ci-dessous).
- `abilities` contient les valeurs principales. `skills` et `saves` peuvent nommer l'attribut de leur jet, un `cap` et une règle `untrained` (ci-dessous).
- `fields` contient des valeurs simples. Types : `number`, `text`, `longtext`, `boolean`, `enum` (liste fixe de choix) et `dice` (texte comme `1d8`). Un champ ou une colonne de liste de type `text` peut ajouter `suggestions` (Capability API 1.796) : jusqu'à 40 mots proposés sous forme de pastilles en dessous, chacun étant ajouté au texte déjà écrit, tandis que la saisie reste libre, par exemple pour les ennemis jurés d'un rôdeur choisis parmi les types de créatures. Un tel champ peut aussi indiquer combien en choisir avec `pick` (Capability API 1.797), une valeur lue sur la fiche, comme un nombre dérivé qui augmente avec le niveau de classe : l'éditeur indique "Choose N", montre combien sont choisis et cesse de proposer des pastilles dès que N sont présents, mais le texte saisi n'est jamais refusé.
- Les valeurs `derived` sont calculées depuis d'autres valeurs et ne peuvent pas être écrasées à la saisie. Une fiche peut en avoir jusqu'à 800 (Capability API 1.729 ; 400 à partir de 1.111, 240 à partir de 1.88, 120 à partir de 1.84, 60 avant) ; un package qui en a plus de 240 déclare 1.111, et un qui en a plus de 400 déclare 1.729. Opérations : `sum`, `min`, `max`, `scale` (multiplier par un nombre fixe et arrondir), `multiply` (deux à six valeurs multipliées entre elles, comme un modificateur de Constitution multiplié par le niveau ; Capability API 1.82), `stepTable` (chercher dans des seuils, comme un niveau donnant un bonus de maîtrise) et `enumTable` (un nombre pour chaque valeur d'un champ enum ou d'un état vivant ; voir États vivants ci-dessous).
- `lists` contient des tableaux à colonnes personnalisées, comme équipement, sorts ou capacités. Une liste a jusqu'à 24 colonnes ; un package dont une liste en a plus de 12 déclare Capability API 1.165. Une liste avec `pools` transforme chaque ligne en ressource ayant son propre maximum, pour les capacités de classe à usages limités. Une colonne numérique peut être remplie par un jet : `"roll": { "count": 1, "sides": 8 }`, où `sides` est un nombre, une autre colonne de la même ligne (`{ "column": "die" }`, une colonne numérique ou un enum dont les valeurs se lisent comme des dés, par exemple `d8`) ou une valeur de la fiche. L'éditeur de fiche affiche un bouton Roll qui lance les propres dés du moteur et écrit le total, maintenu entre le `min` et le `max` de la colonne (Capability API 1.85).
- `live` contient ce qui change en jeu : `pools` (points de vie, emplacements de sorts, Grit), `tracks` (nombre sur une échelle, comme l'épuisement, ou piste de blessures à cases), `text` (notes courtes, comme la concentration), `conditions` et `states` (une valeur parmi un ensemble fermé, comme une forme ou une posture).

Tout ce qui lit un nombre le nomme par une référence de valeur : un objet avec exactement une clé parmi `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` et `itemStat`. Par exemple, une réserve au maximum dérivé : `"max": { "derived": "grit_max" }`.

- `listSum` additionne une colonne numérique d'une liste : `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` est facultatif et nomme une colonne booléenne ; seules les lignes où elle est activée comptent. Une cellule vide compte comme la valeur par défaut de sa colonne, et une liste cachée par `hideWhen` n'ajoute rien. Ember Roads calcule ainsi Burden à partir de l'équipement emporté par un personnage : il ne peut jamais s'écarter de la liste comme le ferait un nombre saisi. La colonne à échelle d'un catalogue ne peut pas lire une somme de liste, même par une valeur dérivée : une liste peut contenir des cellules à échelle, les siennes ou d'autres qui la relisent, et le recalcul ne se stabiliserait jamais.
- `livePool` lit ce qui reste dans l'une de tes `live.pools` (la réserve d'une ligne de liste n'en fait pas partie). `liveTrack` lit l'une de tes `live.tracks`, avec un `read` facultatif : `"value"`, sa position (par défaut) ; `"filled"`, l'écart au-dessus de son `min` ; `"remaining"`, l'écart sous son `max` ; ou, seulement sur une piste de blessures, `"penalty"`, la pénalité active. Une réserve ou une piste cachée vaut 0. Le "Harm still to take" de Gravewatch s'écrit `{ "liveTrack": "harm", "read": "remaining" }`.
- Une lecture de l'état courant prend celui-ci tel qu'il est quand un test est lancé, qu'un combat commence ou que le bloc de fiche du Game Master est écrit. S'il n'existe pas encore (l'éditeur de fiche, l'examen d'une importation), elle lit l'état de départ du jeu : une réserve pleine ou vide selon son `start`, une piste à son `default`, une piste de blessures sans marque.
- Rien de ce qui est calculé avant qu'un état courant existe ne peut le lire : le `max` d'une réserve ou d'une piste, le bonus de maîtrise, ou la colonne à échelle ou la mise à l'échelle d'un catalogue. Cela vaut aussi à travers une valeur dérivée qui le lit et à travers une compétence plafonnée par une valeur vivante, et l'importation nomme la valeur fautive.
- Ces trois références relèvent de Capability API 1.39 pour un ensemble en package.
- `itemStat` lit les objets que tient le personnage, comme la protection de l'armure qu'il porte, et suit la même règle qu'une lecture de l'état courant. Consulte [Les objets sur la fiche](ruleset-items.md#items-on-the-sheet). Capability API 1.52.

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

## États vivants : une forme, une posture, une lumière

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

<a id="wound-tracks-health-that-is-a-track-not-a-number"></a>

## Pistes de blessures : une santé marquée sur une piste

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

### Cases numérotées au lieu de niveaux nommés

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

### Remplir par case, et pistes qui refusent

- `"fill": "indexed"` place une marque sur la case que la commande nomme avec `box=` (la première si elle n'en nomme aucune), ou sur la prochaine case libre au-dessus, et ne déplace jamais une marque une fois posée. Un soin efface la plus haute des marques les plus légères. L'écran de fiche permet au joueur de cliquer sur n'importe quelle case vide.
- `"onFull": "refuse"` refuse une marque qui n'a aucune case libre, au lieu d'aggraver la marque la plus légère. La commande entière est refusée : trois marques avec deux cases libres n'en posent aucune. Une piste indexée refuse toujours ; indique-le avec `"onFull": "refuse"` à côté.

### Niveaux ajoutés par une liste

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` sur une piste à niveaux nommés permet à une liste de la fiche de l'allonger pour chaque personnage. Chaque ligne, dans l'ordre, ajoute son nombre de niveaux (16 au plus) avec sa pénalité, après le dernier niveau dont la pénalité est au moins aussi bonne ; ces niveaux prennent le nom de ce niveau quand les pénalités correspondent, et celui de la pénalité sinon. Les cicatrices de Gravewatch fonctionnent ainsi. Une liste cachée par la fiche n'ajoute rien, et si une ligne est supprimée alors que ses niveaux sont marqués, les marques qui ne tiennent plus sont conservées comme débordement : modifier la fiche n'annule pas une blessure.

`boxes`, `fill`, `onFull`, `extra` et le `kind` d'une étape de repos relèvent de Capability API 1.40 pour un ensemble en package.

## La pénalité sur tes jets

`resolution.penaltyFrom` nomme la piste de blessures dont la pénalité touche chaque test de l'ensemble. Elle est déclarée, pas supposée : un ensemble qui l'omet lance exactement comme avant l'existence des pistes.

L'EFFET de la pénalité dépend du type de résolution, comme celui du nombre de la fiche :

- Sous `dice-pool`, elle **retire des dés de la réserve**, sans descendre sous `pool.min`. Un `pool.min` de 1 permet encore de lancer un dé au dernier degré ; un `pool.min` de 0 permet de n'en lancer aucun et d'échouer sans jet.
- Sous `dice-sum`, c'est un **modificateur fixe du jet**, intégré au même nombre auquel contribuent l'attribut et l'entraînement.

Elle doit nommer une piste de blessures. Une piste ordinaire n'a pas de pénalité et est refusée à l'importation. Le résultat indique celle qui s'applique pour expliquer au joueur ses dés en moins ; le bloc de fiche du GM montre aussi le degré et son coût.

## Modificateurs de la fiche

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

## Repos

Un repos liste des restaurations et des éléments à effacer. Chaque étape nomme une cible (`pool`, `poolGroup`, `listPools`, `track` ou `state`) et la fixe (`"to": "max"`, `"to": "min"` ou un nombre) ou la modifie (`"by": { "const": 1 }` ou `"by": { "fractionOfMax": 0.5 }`). Une étape visant une piste de blessures peut seulement la soigner : son `by` est donc négatif ; voir plus haut. Une étape visant un état vivant le fixe seulement, à `"default"` ou à l'une de ses valeurs. Une étape `poolGroup` avec un `fractionOfMax` modifie chaque réserve du groupe de sa propre fraction ; ajoute `"shared": true` (Capability API 1.77) pour calculer plutôt la fraction sur le maximum de tout le groupe et la répartir entre les réserves du groupe dans l'ordre où la fiche les liste, chacune jusqu'à ce qui lui manque. Le repos long de 5e, "half of the character's total number of" dés de vie gardés dans une réserve par dé, s'écrit `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

## Texte du Game Master

- `checkGuidance` remplace le paragraphe intégré qui explique comment demander un test. Nomme le système et les occasions de lancer. Le GM nomme seulement la compétence et la difficulté. Le moteur lance et calcule depuis la fiche : ne demande pas de calculs au modèle.
- `sheetGuidance` introduit les fiches dans le prompt. Explique quelles ressources comptent et quand les dépenser.
- `worldGuidance` est facultatif et lu une fois à la création du monde pour adapter le cadre aux règles : aucune poudre à canon, magie rare, morts qui marchent. Il n'atteint jamais un tour.
- `opposition` indique qui joue le camp adverse d'un combat (Capability API 1.774). `"game-master"` confie chaque tour d'adversaire au GM (maître du jeu), qui choisit parmi les options proposées par le moteur ; le sélecteur du moteur prend le relais quand le GM ne répond pas. Cela ne s'applique que dans une partie dont le joueur a autorisé le GM à jouer les boss, et dans tous les styles de combat, y compris un combat Classic ou Tactical pour un ensemble de règles sans bloc `combat`. Utilise cette clé pour un système narratif dont l'opposition se joue par la fiction plutôt que par une somme de dégâts : Fate, Blades in the Dark, Trophy, Lasers & Feelings. `"engine"`, ou l'omission de la clé, conserve le sélecteur du moteur, les boss (et, quand le joueur le demande, les adversaires nommés et ceux d'une intelligence exceptionnelle) étant confiés au GM. Un ensemble de règles qui utilise cette clé nécessite Capability API 1.774.
- `sheetSummary` choisit les champs, valeurs dérivées et lignes de listes que voit le GM par personnage. Le moteur montre toujours les modificateurs d'attribut, les compétences et sauvegardes entraînées et les valeurs vivantes. Garde le reste court, car il part à chaque tour. La `nameColumn` d'une liste du résumé peut être une colonne texte ou enum (un enum affiche le libellé de sa valeur), et `columns` nomme jusqu'à trois autres colonnes de la ligne à afficher après le nom ; le bloc se lit alors `Gear: Crowbar 1d6` plutôt que des noms seuls. Une colonne booléenne affiche son libellé quand elle est activée. Les deux relèvent de Capability API 1.37 pour un ensemble en package.
- Tu n'as pas besoin d'enseigner la commande de fiche dans `sheetGuidance`. Le moteur enseigne lui-même chaque commande avec les noms que déclare ton fichier ; quand ton ensemble a une piste de blessures, il ajoute la commande `op="damage"` pour la marquer et liste ses niveaux et ses types de blessures. Quand il a des états vivants, il ajoute la commande `op="state"` et liste les valeurs que chacun peut prendre.

## Référence complète des règles pour le GM

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
