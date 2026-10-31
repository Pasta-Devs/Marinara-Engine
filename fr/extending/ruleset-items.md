# Objets des ensembles de règles

Cette page fait partie du guide [Écrire des ensembles de règles Game Mode](writing-rulesets.md). Ce que transporte une équipe : catégories, armes, armures, munitions, butin, argent, équipement de départ et marchés.

Les armures, les armes, les potions, l'équipement, les munitions et l'argent sont des objets. Un bloc facultatif `items` déclare les mots dans lesquels chaque objet de ton ensemble est écrit, et un catalogue avec `holds: "items"` liste les objets eux-mêmes. Les deux nécessitent Capability API 1.49 ; les `rarityCaps` et `propose` du bloc, qui encadrent les objets inventés par le Game Master, nécessitent 1.51 ; une valeur qui lit les objets que tient un personnage (`itemStat`), 1.52 ; l'effet d'un objet sur les tests quand il est porté ou transporté, avec les plafonds `bonus` du bloc, 1.53 ; ce qu'un objet exige de son porteur et les attributs qu'il modifie, 1.54 ; l'`attack` d'une arme, 1.55 ; ce que fait un objet en combat, 1.56 ; ce qu'une arme tire et garde chargé, 1.57 ; les modes d'une arme, l'attaque de la main secondaire, le plancher et les états infligés sur un coup, 1.58 ; ce que fait l'utilisation d'un objet en combat, avec les charges qu'il contient, 1.59 ; une utilisation qui restaure une réserve, 1.60 ; des charges regagnées au repos ou un objet qui se brise une fois vide, 1.61 ; une utilisation qui demande d'abord un test (`gate`), 1.62 ; les tables de butin et le butin d'une créature, 1.63 ; une ligne de butin qui lâche des pièces ou une couche qui retire des pièces, 1.64 ; un marché, le lieu `sold` d'un objet et un `service`, 1.65 ; un jour de marché (une bourse, `buyBack`, le `stock` d'un vendeur, une quantité `limited` ou un `sold` qui ne nomme aucun lieu), 1.69 ; un effet supplémentaire qui se déclenche sur les armes tenues (`weapons`), 1.70 ; l'équipement de départ (`startingGear`), 1.78 ; et un objet risqué, une contrefaçon ou un vendeur malhonnête, 1.79.

## Le bloc des objets

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
- `carry` : facultatif. `stat` nomme la statistique numérique qui donne le poids d'un objet, dont le `min` vaut 0 ou plus. `encumberedAbove` est ce qu'un personnage peut porter avant d'être encombré, et `limit` (facultatif) le maximum qu'il peut porter. Les deux sont lus sur la fiche comme `binding.max`. Sans `carry`, le poids ne signifie rien et personne n'est jamais encombré. `unit` (facultatif, jusqu'à 12 lettres, Capability API 1.791) est l'unité dans laquelle un poids est compté, comme `"lb"` : la charge de l'inventaire, les poids du sélecteur d'équipement de départ et le poids d'une option de kit l'affichent après le nombre.
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

## Un objet

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

## Ce qui lit les objets

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

## Les objets sur la fiche

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

## Les tests hors combat

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

## Défenses typées issues des états, des niveaux, des objets et des lignes de fiche

`combat.conditions[]` et `combat.levels[]` peuvent accorder `resist`, `vulnerable`, `immune` (de 1 à 30 entrées chacun) et `conditionImmunities` (de 1 à 40 identifiants d'états). Ils s'appliquent tant que l'état dure ou que le seuil du niveau est atteint. Une immunité d'état nouvellement acquise met fin à cet état s'il est déjà actif et empêche de l'appliquer à nouveau. L'immunité l'emporte sur la résistance ; résistance et vulnérabilité s'annulent. Plusieurs résistances ne réduisent jamais les dégâts de moitié deux fois.

`resist` et `immune` utilisent la forme des créatures : un mot de dégâts ou `{ "type": "bludgeoning",
"except": ["magical"] }`. Tout tag nommé porté par le coup contourne cette entrée. `vulnerable` reste une liste de simples mots de dégâts. La même forme d'exception fonctionne sur les effets `worn` et `carried` des objets. Déclare les tags d'exception dans `items.tags` et place-les dans les qualités de l'arme ou du sort. Par exemple, Stoneskin est une association d'état :

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

## Les armes en combat

Un objet peut être une arme (Capability API 1.55). Son `attack` a la forme des [lignes d'attaque](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) d'un bloc de combat, avec des valeurs à la place des colonnes, et un [combat régi par l'ensemble](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) la propose comme attaque tant que l'objet est porté : tenu dans les mains qu'il occupe, et lié s'il doit l'être. Un objet rangé ou seulement transporté ne propose rien, et les lignes d'attaque et les actions propres d'une créature fonctionnent exactement comme avant. La hachette d'Ember Roads :

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

### Munitions et rechargement

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

### Modes, seconde arme, plancher et états sur un coup

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
- `plus` : jusqu'à trois quantités supplémentaires à chaque coup réussi, chacune `{ "dice", "flat", "type", "save", "targetIs", "when" }`, lancée, typée et soumise aux résistances séparément (Capability API 1.169). `save` nomme sa propre `difficulty` et son `onSuccess` (`half` ou `none`). `targetIs` ne l'inflige qu'à une cible de ces types ou tags de créatures (voir Types de créatures et tests de cible dans [Toutes les clés](ruleset-combat.md#every-key) sur la page consacrée au combat). `when: "critical"` ne l'inflige que sur un coup critique ; les dés de toute clause sont doublés sur un coup critique comme ceux de l'arme. Un javelot de foudre s'écrit `{ "dice": "4d6", "type": "lightning" }` ; une tueuse de dragons `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }` ; une épée acérée `{ "flat": 14, "type": "slashing", "when": "critical" }`. Une prévision ne compte une clause que contre une cible qu'elle atteint, et jamais une clause réservée aux critiques. `when: "toggled"` ne l'inflige que tant que l'interrupteur de l'objet est activé (Capability API 1.170, voir `toggle` ci-dessous).

Les détails de l'arme et la ligne du Game Master disent tout : `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` et `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

## Armures et effets portés en combat

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

## Utiliser des objets en combat

Un objet peut être utilisé en combat (Capability API 1.59) : un cataplasme pressé sur une coupure, un tonique avalé, une cloche qu'on fait sonner. Son `use` indique ce que fait son utilisation dans les mots du `mechanics` d'une entrée de catalogue (voir [Ce qu'un combat lit dans `mechanics`](ruleset-combat.md#what-a-fight-reads-from-mechanics)) : `kind` (`heal`, `attack`, `buff` ou `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` et, depuis Capability API 1.174, `concentration` et `zone`, avec le `budget` qu'il dépense, ou `free`. Le cataplasme d'Ember Roads, ainsi que le tonique réchauffant et la cloche de l'aube de Gravewatch :

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

## Les objets dans les batailles Classic et Tactical

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

<a id="loot"></a>

## Butin

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
- Une créature de bestiaire nomme la table qu'elle porte avec `loot` (voir [Créatures](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)). Un combat régi par l'ensemble et gagné lance la table de chaque créature vaincue, et un combat que le moteur ne résout pas selon tes règles n'a pas de créatures de bestiaire, donc il ne lâche rien.
- Ce qui tombe va dans la vue partagée comme un ajout, le sac du joueur étant sollicité en premier, et ce que personne ne peut porter est laissé sur place. Le récapitulatif que reçoit le Game Master indique ce qui est tombé et que c'est déjà dans les sacs, le journal de la partie le note, et une notification l'affiche.
- Le Game Master lance une table dans l'histoire avec `[loot: table="grave_goods" who="Ada"]` (`who=` pour le sac d'un seul personnage), mesuré depuis le début du tour comme ses balises d'inventaire ; une réponse régénérée ne lâche donc le butin qu'une fois. Chaque objet tombé reçoit la même réponse qu'un ajout, et ses instructions listent tes tables.

## Argent

Tes `currencies` sont l'argent de l'équipe. Une pièce est un objet dans les sacs, une pile par pièce comme n'importe quelle autre, nommée par son `label` :

- Elle pèse une unité de ta statistique de poids pour chaque `perWeight` pièces de sa famille, compte dans la charge de son porteur et est placée selon la règle de transport à son arrivée. Une famille sans `perWeight` ne pèse rien.
- Le joueur ajoute des pièces depuis la liste **Coins** (pièces) du sélecteur, et les divise, les donne et les fusionne comme n'importe quelle pile.
- Une ligne au-dessus des piles de l'inventaire affiche les pièces visibles de chaque famille et leur valeur en plus petite pièce de la famille. Le Game Master voit cette valeur à côté de chaque sac (`Coin worth 432 pennies`, ou `no coins` pour une bourse vide, le sac du joueur étant listé même s'il ne contient rien), et le `cost` d'un objet à côté de l'objet (`costs 3 shillings`).
- Le Game Master paie avec `[inventory: action="pay" amount="3 shillings" who="Ada"]` et est payé avec `action="earn"`. `amount` est un nombre et une pièce, par son identifiant ou son libellé, au singulier ou au pluriel, quelle que soit la casse (`1 penny`, `12 pennies`). Un paiement sort d'un seul sac (celui du joueur sans `who=`), uniquement dans la famille de la pièce : les plus grosses pièces qui conviennent partent d'abord, puis la plus petite pièce restante qui couvre ce qui reste dû est rompue, et la monnaie revient en pièces plus petites de la famille, les plus grosses d'abord. La réponse indique ce qui a été payé et ce qui est revenu : 3 shillings tirés d'une bourse contenant une couronne donnent `Paid with crowns ×1; shillings ×2 back.` Un paiement que le sac ne peut pas couvrir est refusé (`cannot-afford`), tout comme une pièce que tu n'as pas (`unknown-coin`) et tout paiement dans un ensemble sans monnaies (`no-currencies`). Un gain est un ajout de cette pièce, dans le sac de `who` ou réparti selon la règle de transport. Le journal de la partie liste ce qui a été dépensé et gagné, et une notification l'affiche. Ses instructions listent tes pièces, et seul un ensemble qui en a les reçoit.
- Acheter, c'est payer puis ajouter, ou, dans un ensemble doté d'un marché, utiliser `buy` (ci-dessous). Il n'y a pas d'écran de boutique.

## Équipement de départ

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

## Marchés

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

### Un jour de marché

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

### Vendeurs honnêtes et malhonnêtes

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

<a id="spotting-fakes"></a>

### Repérer les faux

Capability API 1.802 permet à un personnage de reconnaître un faux pour ce qu'il est, par un test qu'il effectue ou en le remarquant avant que quiconque paie. Le moteur ne connaît aucun de ces tests par leur nom : l'ensemble de règles les écrit.

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- **`tells`** sur une contrefaçon (jusqu'à six) : chacun est un test que n'importe qui peut effectuer (`check` est une compétence, un attribut ou une valeur lue sur la fiche, comme ce que nomme le `gate` d'une utilisation), avec sa difficulté `dc` et ce qu'une réussite permet de voir (`says`). `needs` indique ce que la fiche doit remplir pour pouvoir seulement tenter le test (avec `needsAny`, il suffit de remplir l'une de ces exigences), et `carries` un objet que la personne qui effectue le test doit avoir dans son propre sac, comme le kit utilisé pour un test d'outil. Dès qu'une ligne de `advantageIf` est remplie, le test se fait avec avantage ; dès qu'une ligne de `disadvantageIf` est remplie, avec désavantage.
- **`manner`** sur un vendeur malhonnête : un test portant sur le vendeur plutôt que sur l'objet, avec les mêmes éléments. Une réussite indique que quelque chose cloche dans ce qu'il vend, jamais de quoi il s'agit.
- **Inspection** : `[inventory: action="inspect" item="Potion of Healing" who="Mira"]` examine un objet dans le sac de Mira, et `seller="Fence"` examine une marchandise qu'un vendeur présent ici propose aujourd'hui, avant tout achat. Le bouton **Inspect** (inspecter) de l'inventaire, proposé par un ensemble de règles dont les contrefaçons peuvent être repérées, dit "I look my Potion of Healing over carefully before trusting it." pour que le GM (maître du jeu) écrive la balise. Le moteur effectue le meilleur test que le personnage puisse faire à ce sujet, avec les dés propres à l'ensemble de règles : les indices de la contrefaçon et la manière d'être du vendeur malhonnête. Une réussite sur une contrefaçon la rend suspecte : la réponse indique ce que le personnage a vu, et le sac affiche "Mira thinks it is a fake", tout en continuant à la nommer comme l'objet pour lequel elle se fait passer. Une réussite sur un indice avec une marge d'au moins `items.namesItAt` (5 en 5e) l'identifie aussi, et elle est dès lors traitée comme l'objet qu'elle est réellement. Pour un objet authentique, le moteur effectue les tests des indices des contrefaçons qui se font passer pour lui, de sorte que demander ne révèle rien, et une réussite indique qu'il semble authentique. Chaque personnage essaie une fois par objet (une pile garde la trace de ceux qui ont essayé ; une marchandise est mémorisée pour le jour de marché) ; un échec indique qu'il ne peut pas se prononcer. Un objet que rien ne pourrait trahir, ou qu'un personnage ne peut absolument pas examiner par un test, est refusé avec `nothing-to-check`, et la tentative n'est pas dépensée.
- **Remarquer avant un achat** : lorsqu'un achat ferait obtenir une contrefaçon auprès d'un vendeur malhonnête, chaque autre membre de l'équipe évalue chaque test qu'il peut effectuer à son sujet et à celui du vendeur, sans dés : `items.passiveBase` (10 par défaut) et son nombre, avec 5 de plus en cas d'avantage et 5 de moins en cas de désavantage. Le premier qui atteint une difficulté a remarqué quelque chose : rien n'est payé, et l'achat reçoit la réponse `reason="held"` précisant qui a remarqué quoi. Le GM a pour consigne de jouer ce compagnon avertissant l'acheteur en restant dans son personnage, sans accuser le vendeur en face à moins que la personnalité de ce compagnon ne l'y pousse, et de laisser l'acheteur décider. Le joueur n'apprend rien d'autre. Le même achat redemandé à ce vendeur le même jour aboutit. `items.warnBy: "roll"` effectue ces tests avec des dés à la place.
- **Percer les contrefaçons à jour** : `items.revealsFakes` liste les moyens de percer les contrefaçons à jour qu'un personnage peut lancer sur un objet (un sort, un rituel), chacun avec un `id`, son `label` et, pour un moyen qui ne perce à jour que certaines contrefaçons, les `tags` qu'elles portent ou les contrefaçons elles-mêmes par référence (`items`, qui ne peut contenir que des contrefaçons). Nommer les contrefaçons évite de leur donner un tag révélateur : une potion de poison portant le tag "poison" se trahirait à côté de la potion de soins pour laquelle elle se fait passer. `[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]` nomme l'un de ces moyens : une contrefaçon qu'il perce à jour est identifiée, une contrefaçon dont `foolsReveal` le liste apparaît comme l'objet pour lequel elle se fait passer, et une contrefaçon qu'il ne peut pas percer à jour, ou un objet authentique, ne révèle rien ("genuine" pour un moyen qui perce à jour n'importe quelle contrefaçon, sinon "unsure"). Cela ne coûte aucune tentative ; le coût éventuel de ce lancement relève du GM, comme celui de tout sort.
- Un ensemble de règles qui utilise l'un de ces éléments nécessite Capability API 1.802. Des `tells` ou un `foolsReveal` de contrefaçon sur un objet qui n'est pas une contrefaçon, un objet de `carries` ou de `revealsFakes` qui n'appartient pas à l'ensemble de règles (une contrefaçon, pour `items`), et un identifiant de `foolsReveal` qui n'est pas listé par `revealsFakes` sont refusés à l'installation.

<a id="using-items-outside-a-fight"></a>

## Utiliser des objets hors combat

Le même `use` fonctionne hors combat (Capability API 1.60 pour `restore` ; le reste ne nécessite rien de nouveau). Le bouton **Use** de l'inventaire, sur l'un de tes objets doté d'un `use`, et la commande `[inventory: action="use" item="Poultice" who="Juno"]` du Game Master font tous deux ce que fait l'objet à celui qui le transporte, avec les dés du moteur :

- Un soin rend de la santé : la quantité sur une réserve de santé, ou une marque effacée sur une piste de blessures, comme un soin en combat. Les points `temporary` vont sur une réserve de santé, `restore` rend sa réserve, et chaque état qu'il `applies` est infligé, jusqu'à ce que quelque chose le retire.
- Une utilisation qui blesse, ou qui vise le camp adverse (`kind` `attack` ou `debuff`, ou `targets` `enemy`), n'atteint personne : hors combat, il n'y a personne sur le plateau à frapper. L'objet est tout de même utilisé, et le Game Master apprend ce qu'il fait, pour le raconter.
- Elle retire un exemplaire de la pile ou dépense ses charges exactement comme en combat, et un objet qui n'en a plus, ou qui occupe un emplacement ou se lie et n'est pas porté, est refusé sans rien changer. La fiche et le sac sont écrits ensemble.
- Un `gate` est lancé d'abord, comme un test : les dés propres à l'ensemble avec le nombre de la fiche, la pénalité de blessure de l'utilisateur et ce que ses états et ses objets portés ou transportés font à ce test. Un échec consomme l'objet pour rien, et la ligne le dit ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

Ce qui s'est passé est dit en une ligne : "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." Le bouton Use l'envoie au Game Master dans un bloc `[item_used]` après "I use my Poultice.", que le chat affiche sous forme de badge ; la balise du Game Master lui-même reçoit la même réponse, mesurée depuis le début du tour comme ses autres balises, si bien qu'une réponse régénérée n'utilise jamais un objet deux fois. Un objet sans `use`, ou dans une partie sans ensemble de règles, est toujours simplement mentionné : "I use my rope."
