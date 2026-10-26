# Écrire des scripts d'histoire Game Mode

Un script d'histoire permet à un créateur d'orienter le déroulement d'une partie Game Mode : des scènes
qui se jouent quand l'équipe arrive quelque part, des choses que le Game Master (le maître du jeu) doit
faire une fois une condition remplie, des objectifs que le joueur suit dans le journal, et des moments
que le Game Master peut marquer lui-même. Ce guide s'adresse à ceux qui écrivent leurs propres
histoires. Pour jouer dans un monde qui a une histoire, commence par
[Créer un monde](../game/getting-started.md#making-a-world).

Un script d'histoire, ce sont des données, pas du code. Rien ne s'y exécute. Le moteur le vérifie par
rapport au monde auquel il est destiné, le joue tour par tour et refuse tout ce qui ne convient pas.

## Où se trouve une histoire

Une histoire appartient à un seul monde. Elle nomme les lieux et les personnes de ce monde : elle n'a
donc de sens qu'avec le monde pour lequel elle a été écrite (sa graine, sa description et ses
modifications manuelles).

- Dans un **fichier de monde** (`.world.json`), comme clé `story` de premier niveau à côté de `world`.
  Une version du moteur qui ne connaît pas les histoires lit quand même le monde.
- Dans le **pack de carte** d'une Experience : chaque fichier de monde peut porter son histoire, et une
  nouvelle partie la reprend avec la carte. Consulte
  [Packages d'agents et de capacités optionnels](../development/optional-agent-packages.md).
- Dans un monde gardé dans la bibliothèque, hors de toute partie : `GET`, `PUT` et
  `DELETE /api/game-worlds/:id/story`, comme pour une partie. Une nouvelle partie lancée depuis ce monde
  emporte l'histoire avec elle.
- Dans une partie, une fois lancée : `GET`, `PUT` et `DELETE /api/game/:chatId/story` lisent,
  enregistrent et suppriment l'histoire. Un enregistrement est vérifié par rapport au monde de la
  partie, modifications manuelles comprises, et les modifications manuelles qui retireraient un élément
  nommé par l'histoire sont refusées.

Dans la configuration d'une nouvelle partie, une histoire lue depuis un fichier ou un pack de carte est
conservée tant que la graine et la description du monde restent inchangées.

## La structure

```json
{
  "storyVersion": 1,
  "flags": [],
  "directions": [],
  "events": [],
  "cutscenes": [],
  "fights": [],
  "endings": [],
  "knowledge": []
}
```

Les identifiants comptent de 1 à 40 lettres minuscules, chiffres, `_` ou `-`, et sont uniques dans leur
liste. Une histoire contient au plus 256 drapeaux (64 avant Capability API 1.353), 64 consignes,
256 événements (128 avant 1.349), 64 cinématiques, 32 combats, 16 fins et 600 entrées de connaissance.
Aucun de ses textes ne peut contenir de saut de ligne, de crochets ni `{{`, et les noms écrits dans une balise
(un groupe, un arrière-plan) ne peuvent pas contenir de guillemet double : rien de ce que dit une
histoire ne peut passer pour une balise du Game Master.

### Drapeaux

Un drapeau est une valeur que l'histoire garde : `"bool"` (vrai ou faux) ou `"number"`.

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- `gm: true` permet au Game Master de le définir (voir
  [Les balises du Game Master](#the-game-masters-tags)) ; `note` lui explique ce que signifie le
  drapeau.
- Les drapeaux sont cachés au joueur. Avec `quest`, un drapeau devient un **objectif de quête** dans le
  journal :

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

Un drapeau numérique peut avoir un `min` et un `max` (Capability API 1.358) : chaque `set` et `add`
le maintient dans ces limites, y compris les balises du Game Master lui-même. Un score d'approbation
reste donc entre -10 et 10, quel que soit le nombre d'événements qui l'augmentent. Son `initial` doit
respecter ces limites.

```json
{ "id": "approval", "kind": "number", "initial": 0, "min": -10, "max": 10, "gm": true }
```

Un objectif oui/non est atteint quand son drapeau est vrai ; un objectif numérique, quand son drapeau
atteint son `goal` (1 s'il n'est pas indiqué). Quand un `goal` est écrit, le journal montre où en est la
progression. Un objectif avec `"hidden": true` attend dans le journal qu'un événement le montre.

#### Horloges

Un drapeau numérique peut être une **horloge** que le joueur voit se remplir (Capability API 1.342) :
un cercle de 2 à 12 segments, dont un se remplit par point, affiché dans le HUD de la partie et l'onglet
World, avec son titre et ce qui arrive lorsqu'il est plein.

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

Définis sa valeur, ajoute-lui des points et teste-la dans les conditions comme tout drapeau numérique.
À chaque tour, le Game Master reçoit les horloges et, une seule fois lorsqu'une se remplit (par un
événement, ou au tour suivant si sa propre balise l'a remplie), ce qu'il doit faire arriver. Une horloge
avec `"hidden": true` reste cachée jusqu'à ce qu'un événement la montre avec `show`.

### Consignes

Une consigne est une instruction permanente donnée au Game Master, en vigueur tant que ses conditions
sont remplies :

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### Conditions

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Toutes les
conditions d'une liste `if` doivent être remplies. Un drapeau oui/non ne se compare qu'avec `=` ou `!=`.

`{ "party": "<person id>", "is": "in" | "out" }` demande si une personne du monde voyage actuellement
avec l'équipe, par exemple un compagnon recruté par l'histoire (Capability API 1.349).

`{ "partySize": { "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <1 to 32> } }` demande combien de
membres compte l'équipe : le personnage du joueur et chaque compagnon qui voyage avec lui, sauf ceux
qui ne combattent jamais (Capability API 1.360). Cette condition n'est remplie que si le moteur connaît
la taille de l'équipe.

`{ "any": [<condition>, <condition>, ...] }` est remplie dès qu'une de ses 2 à 8 conditions l'est
(Capability API 1.358) : un choix entre plusieurs possibilités dans une seule liste, au lieu de deux
événements.

```json
"if": [{ "any": [{ "flag": "won_granary", "is": "=", "value": true }, { "party": "p11-3", "is": "in" }] }]
```

### Connaissances

Ce que les personnes savent et disent sur elles-mêmes, les autres et l'univers évolue avec l'histoire
(Capability API 1.348). Chaque entrée est transmise au Game Master comme quelque chose que cette
personne peut dire si le sujet se présente, lors d'un tour où :

- ses conditions sont remplies,
- sa `person` est dans la scène : nommée dans la dernière réponse ou le message du joueur, ou voyageant
  avec l'équipe,
- et, si elle a des `keys`, l'une d'elles y est aussi mentionnée. Une entrée sans personne a besoin de
  mots-clés et n'est sélectionnée que par eux.

Au plus 12 entrées sont transmises par tour. Depuis 1.361, elles sont classées : les personnes nommées
dans la scène viennent d'abord, puis les entrées sans personne déclenchées par ses mots, puis les
compagnons qui ne font que voyager avec l'équipe ; dans chaque catégorie, les entrées sont réparties
personne par personne, pour qu'un compagnon bavard n'écarte jamais les autres. Les compagnons qui
voyagent avec l'équipe gardent toujours deux des 12 places, même si la scène est chargée, réparties de
la même façon.

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

Un script contient jusqu'à 600 entrées. Au plus 12 sont transmises par tour, dans l'ordre du script :
place donc les plus importantes en premier.

### Événements

Un événement est quelque chose qui se produit : quand son déclencheur survient et que ses conditions
sont remplies, il exécute ses actions.

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

Un événement ne se produit qu'une fois, sauf s'il a `"repeat": true` (que `start`, `turn` et `day`
ignorent). Au plus 32 événements se produisent en un tour, chacun une fois au plus, dans l'ordre où le
script les liste.

**Déclencheurs** (`when.on`), tous lus dans ce que la partie a enregistré :

| Déclencheur | Se déclenche                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`  | À la première réponse de la partie.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `turn`   | À la réponse numéro `turn` du Game Master sur l'ensemble de la partie, toutes sessions confondues, ou après.                                                                                                                                                                                                                                                                                                                                            |
| `day`    | Dès que le jour du monde (qui avance avec le temps que fait passer le Game Master et avec les trajets) atteint `day` ou plus.                                                                                                                                                                                                                                                                                                                           |
| `arrive` | Tant que l'équipe se trouve dans `place` (un identifiant de lieu) ou dans un lieu qu'il contient, après y être arrivée en y commençant la partie, par un trajet sur la carte du monde, par une visite en ville ou parce que le Game Master nomme ce lieu. Avec `repeat`, de nouveau chaque fois qu'elle y revient d'ailleurs.                                                                                                                           |
| `meet`   | Dès qu'une réponse a nommé `person` (un identifiant de personne comme `p11-3`, ou `p11-e1` pour une personne ajoutée à la main) par son nom complet. Avec `repeat`, de nouveau pour chaque réponse qui la nomme. Seules les réponses de cette session sont lues pour trouver les noms.                                                                                                                                                                  |
| `deed`   | Dès que le monde a enregistré un acte de l'équipe, du type `deed`, et à `place` si ce champ est indiqué. Avec `repeat`, de nouveau pour chaque réponse qui en enregistre un.                                                                                                                                                                                                                                                                            |
| `fight`  | Quand un combat se termine par `outcome` : `victory`, `defeat` ou `flee`. Avec `fight` (un des combats du script, 1.358), seulement si ce combat précis s'est terminé ainsi : celui que la dernière réponse du Game Master a lancé, par l'action `fight` de l'histoire ou son propre déclenchement. |
| `leave`  | Quand l'équipe quitte `place` (un identifiant de lieu) et tous les lieux qu'il contient (1.358) : par un trajet, une visite, un lieu que nomme le Game Master ou le `move` de l'histoire, dans la dernière réponse ou pendant ce tour. Avec `repeat`, de nouveau à chaque départ. |
| `broke`  | Quand un combat a brisé l'élément de décor appelé `prop` (Capability API 1.316), sans tenir compte de la casse. Seul un élément de décor peint sur l'un des champs de bataille du monde peut être nommé.                                                                                                                                                                                                                                                |
| `flags`  | Quand ses conditions sont remplies. Avec `repeat`, de nouveau chaque fois qu'elles redeviennent vraies après avoir été fausses.                                                                                                                                                                                                                                                                                                                         |
| `gm`     | Seulement quand le Game Master le déclenche (l'événement doit avoir `"gm": true`).                                                                                                                                                                                                                                                                                                                                                                      |
| `rest`   | Après une réponse pendant laquelle l'équipe s'est reposée : un `[sheet: op="rest"]` accepté dans la réponse du Game Master, du repos de l'ensemble de règles nommé par `rest` (son identifiant ou son libellé, comme `long`) ou de n'importe quel repos (1.349). |
| `travel` | Lors d'un tour où l'équipe part d'un lieu vers un autre, depuis l'intérieur de `from` et vers l'intérieur de `to` si ces champs sont indiqués (1.349). |
| `idle`   | Après `turns` réponses consécutives sans rien : aucun événement d'histoire, trajet ni combat (1.349). |
| `step`   | Quand un trajet passe sur la case `x`, `y` (comptée à partir de 0 depuis le coin supérieur gauche) de `place` : la ville d'une agglomération (le chemin d'une visite, de porte à porte) ou la carte d'un lieu faite à la main (un trajet sur celle-ci). La case doit être accessible à pied pour l'équipe : dans une ville, un sol accessible depuis la place, et non une parcelle libre, où l'histoire pourrait construire ; sur une carte, un sol accessible depuis son entrée. Une carte générée n'a pas de cases à nommer. Avec `repeat`, de nouveau à chaque tour dont le trajet passe dessus. |

Les modifications manuelles qui retirent la case d'un événement step (un bâtiment posé dessus, le sol
d'une carte muré) sont refusées à l'enregistrement, avec le nom de l'événement.

Un événement `meet` répétable dont la propre scène nomme cette personne, ou un événement `deed`
répétable qui accomplit l'acte qu'il attend, se déclencherait lui-même à chaque tour : le moteur le
refuse donc.

**Actions** (`do`) :

| Action                                                                                                  | Effet                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `{ "set": "<flag>", "value": <value> }`                                                                 | Définit un drapeau.                                                      |
| `{ "add": "<flag>", "amount": <number> }`                                                               | Ajoute une quantité à un drapeau numérique.                              |
| `{ "tell": "<text>" }`                                                                                  | Demande quelque chose au Game Master, une seule fois, pendant ce tour.   |
| `{ "cutscene": "<id>" }`                                                                                | Joue une cinématique.                                                    |
| `{ "show": "<flag>" }`                                                                                  | Montre dans le journal un objectif de quête caché.                       |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | Enregistre un acte dans le monde, traité comme le serait un acte du Game Master lui-même. |
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }` | Donne un objet (1.343) : un des objets de l'ensemble de règles de la partie par son identifiant, ou un autre par son nom (avec `summary` pour le décrire), dans le sac du joueur ou du membre de l'équipe nommé par `who`. Il est ajouté comme le serait celui du Game Master : les règles de l'inventaire s'appliquent. Un identifiant absent de l'ensemble de règles de la partie est refusé, avec la raison dans la réponse. |
| `{ "fight": "<fight id>" }` | Lance un des combats du script (1.343). Le Game Master reçoit pour consigne de l'amener dans le récit, et le combat qui suit a les adversaires de l'histoire. |
| `{ "move": "<place id>" }` | Place l'équipe dans un lieu du monde (1.343), comme un trajet ; un événement `arrive` ainsi déclenché se produit pendant le même tour. |
| `{ "ending": "<ending id>" }` | Termine la partie avec une des fins du script (1.343) : sa scène se joue, le Game Master conclut sur son épilogue, puis le joueur voit la fin et peut terminer la session. Rien d'autre ne se produit dans l'histoire après cela. |
| `{ "music": "<track id>" }` ou `{ "music": null }` | Lance une piste de son Experience à la place de la musique du lieu (1.345), jusqu'au prochain changement ou jusqu'à ce que `null` rende la main à celle du lieu. La piste doit faire partie de `music` dans le pack de carte. |
| `{ "recruit": "<person id>" }` | Fait entrer un compagnon de son Experience dans l'équipe (1.347), avec sa fiche pour l'ensemble de règles de la partie. Le Game Master reçoit pour consigne de montrer son arrivée. |
| `{ "dismiss": "<person id>" }` | Laisse un compagnon quitter l'équipe (1.347). |
| `{ "season": { "place": "<place id>", "to": "winter" } }` | Maintient un lieu, et tous les lieux qu'il contient, dans une saison quelle que soit la date (1.351) ; sans `place`, le monde entier. `"to": null` le ramène aux `seasons` propres au script, ou à la saison de la date. |
| `{ "sheet": { "condition": "<id>", "state": "on" }` ou `{ "sheet": { "track": "<id>", "by": 1, "upTo": 3 } }` | Applique un état de fiche à chaque membre de l'équipe ou le retire (`"off"`), ou déplace une piste de la fiche de chacun en s'arrêtant à `upTo` (1.368) : le froid de Rime Edge qu'aucun repos ne soigne, via un état dont l'état de combat a `cannot-heal-nonmagical`. Le déclenchement du moteur l'applique avec la réponse qu'il écrit ; celui du Game Master, au tour suivant le marquage. |

Toute action peut avoir son propre `if` (Capability API 1.358) : elle n'est exécutée que si ses
conditions sont remplies au moment où l'événement l'atteint, après les actions précédentes de cet
événement. Un seul événement peut donc se ramifier.

```json
"do": [
  { "add": "approval", "amount": 2 },
  { "tell": "Hob warms to the party.", "if": [{ "flag": "approval", "is": ">=", "value": 5 }] },
  { "tell": "Hob keeps his distance.", "if": [{ "flag": "approval", "is": "<", "value": 5 }] }
]
```

Les actions exécutées sont consignées avec le déclenchement : les scènes et demandes d'un événement
`gm` arrivent donc au tour suivant telles qu'elles ont été exécutées quand le Game Master l'a marqué.

Chaque fonction d'histoire nécessite une version mineure de Capability API :

- les horloges nécessitent 1.342 ;
- les combats, les fins et les actions `give`, `fight`, `move` et `ending` nécessitent 1.343 ;
- les changements de musique nécessitent 1.345 ;
- recruter ou renvoyer des compagnons nécessite 1.347 ;
- les connaissances nécessitent 1.348 ;
- les événements `rest`, `travel` et `idle`, une `priority`, une condition `party` ou plus de 128 événements nécessitent 1.349 ;
- `seasons` et l'action `season` nécessitent 1.351 ;
- plus de 64 drapeaux nécessitent 1.353 ;
- les `variants` de combat nécessitent 1.356 ;
- les conditions `any`, un événement `fight` nommant son combat, un événement `leave`, le `min` ou `max`
  d'un drapeau et un `if` sur une action ou une page nécessitent 1.358 ;
- une condition `partySize`, une variante pour une équipe de plus de 6 membres ou sans limite supérieure,
  ou plus de 6 variantes nécessitent 1.360 ;
- une action `season` passant `over` tout ce qu'elle contient nécessite 1.361 ;
- `exposures` nécessite 1.362 ;
- les créatures de combat avec `adjust` nécessitent 1.363 ;
- le `save` d'une exposition ou le `upTo` d'une piste nécessite 1.364 ;
- le `sparedByShade` d'une exposition nécessite 1.365 ;
- `heldGround` nécessite 1.366 ;
- une action `sheet` nécessite 1.368 ;
- le `release` d'un terrain retenu nécessite 1.369 ;
- donner une liste d'alternatives nécessite 1.370 (un identifiant d'entrée seul, donné depuis le catalogue
  qui le possède depuis 1.370, est un nom pour un moteur plus ancien) ;
- les créatures de combat dont `adjust` contient `calls` ou `levels` nécessitent 1.371.

Un compagnon est une personne marquée comme telle dans le fichier de personnes du pack (voir les
personnes du pack de carte dans
[Packages d'agents et de capacités optionnels](../development/optional-agent-packages.md)).

Parmi les événements `rest`, `travel` et `idle` qui pourraient se produire pendant un même tour, un seul
se produit : celui dont la `priority` est la plus élevée (un entier de -100 à 100, 0 si elle est omise ;
le premier du script en cas d'égalité). Ainsi, le récit d'un compagnon au feu de camp, une dispute entre
deux compagnons sur la route ou la visite d'un compagnon au joueur à une heure calme ne s'accumulent
jamais. Avec une condition `party`, une telle scène ne se produit que si ces compagnons voyagent avec
l'équipe. Un script peut avoir 256 événements depuis 1.349 (128 auparavant).

### Expositions

Les effets d'un lieu sur l'équipe au fil du temps (Capability API 1.362), par exemple un champ de
lumière de midi qui épuise les voyageurs hors combat comme la règle de lumière d'un plateau le fait
pendant un combat :

```json
"exposures": [
  { "id": "noonfield", "place": "e9", "label": "Noonfield's light", "hours": 1,
    "tracks": [{ "track": "exhaustion", "by": 1 }], "applies": ["sunstruck"],
    "if": [{ "flag": "darkness_carried", "is": "=", "value": false }],
    "tell": "The light presses on them; darkness would be a mercy." }
]
```

Selon l'horloge de la partie : le premier tour où l'équipe se trouve dans `place` (ou à l'intérieur)
et où `if` est rempli lance l'exposition. Chaque tour suivant compte combien d'heures (`hours`) s'y sont
écoulées depuis. Chaque fois que cette durée passe, le moteur déplace les `tracks` de `by` et applique les états
`applies` à chaque membre de l'équipe, avec ses propres commandes de fiche appliquées avec celles de la
réponse, et en informe le Game Master (avec `tell`). Quitter le lieu, ou ne plus remplir `if`, met fin à
l'exposition ; elle repart de zéro la fois suivante. Elle est consignée une seule fois dans la réponse
(`[story: exposure=...]`).

Une piste peut s'arrêter à un maximum (Capability API 1.364) : `{ "track": "exhaustion", "by": 1, "upTo": 3 }`
ne la fait jamais dépasser 3 et ne déplace jamais une piste déjà au-delà. Une exposition peut demander
un jet de sauvegarde au lieu de frapper tout le monde (1.364), de la même forme que le `save` de la
règle de lumière d'un plateau de combat (1.321) :

```json
"save": { "save": "con_save", "difficulty": 12, "against": { "conditions": ["noon_light"] } }
```

À chaque application, le moteur lance cette sauvegarde pour chaque membre de l'équipe à partir de sa
propre fiche ; seuls ceux qui échouent subissent ses pistes et ses états, chacun avec sa propre
commande de fiche. `against` désigne ce contre quoi la sauvegarde est faite : un modificateur de
sauvegarde limité à cette menace compte hors combat comme en combat. Ainsi, un chapeau de paille d'une
surcouche avec `{ "to": "saves", "mode": "advantage", "against": { "conditions": ["noon_light"] } }`
donne l'avantage à son porteur. Le Game Master reçoit les réussites et les échecs, avec les totaux.

Avec `"sparedByShade": true` (Capability API 1.365), une source d'ombre portée allumée par n'importe
quel membre de l'équipe empêche l'exposition, comme lorsque `if` n'est pas rempli : un objet dont la
`light` portée ou transportée a `"shade": true` (la Lantern of Dusk de la démonstration), uniquement
lorsqu'il est allumé s'il possède un interrupteur. L'allumer met fin à l'exposition ; l'éteindre la
fait repartir de zéro.

### Terrain retenu

Là où la mort est retenue (Capability API 1.366), comme dans la vallée de la démonstration :

```json
"heldGround": [
  { "id": "valley", "place": "p0", "label": "The Held Autumn", "condition": "felled",
    "marks": [{ "track": "owing", "by": 1 }],
    "if": [{ "flag": "year_turned", "is": "=", "value": false }],
    "tell": "Nobody here has died in forty years." }
]
```

Tant que l'équipe se trouve dans `place` (ou à l'intérieur ; le monde entier si ce champ est omis) et
que `if` est rempli, un combat par ensemble de règles commencé là se joue sur Held Ground (terrain
retenu, 1.323) : celui qui n'a plus de santé est abattu à la place, hors combat, stable et sans jamais
agoniser, puis se relève plus tard, sauf si quelque chose qui fauche l'a abattu. `condition` s'applique
aux abattus et les pistes `marks` de chaque personnage abattu avancent (une marque de dette, Owing).
La première entrée dont les conditions sont remplies s'applique. L'histoire consigne l'arrivée et le
départ de l'équipe (`[story: held=...]`) et en informe chaque fois le Game Master (avec `tell`) ; à
chaque tour où le terrain reste retenu, le Game Master reçoit un rappel de ce que cela signifie.

Le terrain retenu peut être libéré (Capability API 1.369) : le passage à l'année suivante dans la
démonstration. Son `release` indique ce qui devient alors exigible :

```json
"release": { "felled": "die", "owing": { "track": "owing", "bonus": { "flag": "hymn_bonus" } } }
```

`felled` indique le sort de ceux qui sont abattus : ils meurent (`"die"`, par défaut), ou tombent et
commencent à agoniser selon la règle propre à l'ensemble de règles (`"down"`). `owing` fait lancer à
chaque membre de l'équipe une sauvegarde contre la mort de l'ensemble de règles par marque sur
`track` (la première piste marquée du terrain retenu si elle est omise), avec `bonus` ajouté à chaque
jet (un nombre, ou un drapeau numérique lu au moment de la libération), jusqu'à épuisement des marques
ou décision du résultat ; les marques sont dépensées, et trois échecs causent la mort. Dans un combat
par ensemble de règles toujours sur ce terrain, la libération a lieu à l'étape même qui la provoque :
l'utilisation d'un objet qui dépense le nombre d'histoire lu par son `if` (1.359), ou un élément de
décor brisé auquel répond un événement `broke` (1.316), et les événements de drapeaux qu'ils déclenchent.
Le sort des abattus et les dettes Owing sont réglés pendant ce round, selon la libération propre au
combat (1.330). Hors combat, le tour d'histoire qui consigne la libération lance les dettes Owing de
chacun à partir de sa propre fiche et dit au Game Master qui a vécu et qui est mort ; un combat laissé
inachevé sur ce terrain le libère à son étape suivante. Ce qu'un combat a déjà réglé n'est jamais
relancé.

<a id="seasons"></a>

### Saisons

Les saisons d'un monde suivent son calendrier et durent 90 jours chacune. Une histoire peut maintenir
des lieux dans une saison quelle que soit la date (Capability API 1.351) : une vallée bloquée en
automne, une colline maintenue en hiver.

```json
"seasons": [{ "place": "p3", "season": "autumn" }, { "season": "summer" }]
```

Chaque entrée maintient un lieu et tous ceux qu'il contient ; sans `place`, elle maintient le monde
entier. Le lieu maintenu le plus proche décide : un village maintenu en hiver dans une région
maintenue en automne est en hiver. L'action `season` change ce maintien pendant la partie, ou le lève.
Un maintien passant `over` tout ce qu'il contient (1.361) est l'exception : il l'emporte sur toutes les
saisons à l'intérieur, celles du script comme tous les autres maintiens (le plus extérieur de ces
maintiens d'abord). Ainsi, `{ "season": { "to": "spring", "over": true } }` fait passer le monde entier
d'un coup au printemps. Là où l'équipe est dans une saison maintenue, le Game Master reçoit la saison
et le fait qu'elle est maintenue ; la météo est créée pour elle ; la carte du monde dessine chaque
case dans la saison du lieu le plus proche (les tuiles `<id>@<season>` d'un pack de tuiles), et chaque
ville dans la sienne.

Un champ de bataille peint à la main peut aussi être peint avec des saisons : une ligne `seasons`
par ligne de tuiles, une lettre ou `.` par tuile, et `seasonKeys` pour nommer les lettres
(`{ "a": "autumn", "w": "winter" }`). Une tuile laissée à `.` suit la saison du lieu du combat. Les
tuiles d'un combat commencent dans ces saisons, et les événements de carte de ses rounds peuvent les
changer, comme un anneau de gel qui s'étend ou une ligne de printemps qui balaie le terrain.

### Combats

Un combat défini par l'histoire : les adversaires, et le lieu si le monde a un plateau peint pour lui.

```json
{
  "id": "granary",
  "name": "The Granary",
  "creatures": [
    { "creature": "creatures/scarecrow", "count": 3 },
    { "creature": "The Owed", "name": "The Owed" }
  ],
  "battlefield": "b2",
  "note": "The jars break when hit."
}
```

Chaque créature vient du bestiaire de l'ensemble de règles de la partie, par son identifiant
(`catalog/entry`) ou son nom, avec `count` exemplaires (numérotés s'il y en a plusieurs), appelés
`name` pendant le combat si ce champ est indiqué. `battlefield` est un plateau peint à la main dans
le monde (`b<n>`), utilisé quel que soit le lieu où commence le combat ; sans lui, le combat se joue
là où il commence, comme tout autre. `note` indique au Game Master comment il survient. Un identifiant
absent de l'ensemble de règles de la partie est refusé : ces créatures sont exclues du combat et le
refus est journalisé. Un combat ainsi privé de toute créature commence quand même selon l'histoire,
sur son champ de bataille, mais le Game Master choisit ses ennemis.

Un combat peut être adapté à des équipes d'autres tailles (Capability API 1.356). L'équipe comprend
le personnage du joueur et tous les compagnons qui voyagent avec lui, sauf un compagnon marqué
`noncombatant` (1.360).

```json
"variants": [
  { "party": { "min": 3, "max": 4 }, "creatures": [{ "creature": "creatures/scarecrow", "count": 4 }] },
  { "party": 5, "creatures": [{ "creature": "creatures/scarecrow", "count": 5 }], "battlefield": "b3",
    "note": "The Owed wakes in the loft." }
]
```

La variante dont `party` inclut la taille de l'équipe est jouée, avec ses propres créatures, et ses
propres `battlefield` et `note` lorsqu'elle les indique (ceux du combat sinon). Une équipe qu'aucune
variante ne couvre joue le combat tel qu'il est écrit. Aucune taille ne peut être couverte par deux
variantes.

Une entrée de créature d'un combat ou d'une variante peut l'ajuster avec `adjust` pour ce combat
(Capability API 1.363), afin qu'un boss s'adapte à l'équipe sans créature distincte :
`"adjust": { "legendaryResistance": 2, "maxHp": 40 }` lui donne cette résistance légendaire (0 la retire)
et cette santé (un nombre fixe à la place de celle de son bloc, dés compris). Le Game Master reçoit
ces informations à côté de la créature. Le `calls` d'un ajustement change les créatures appelées par
ses actions (Capability API 1.371) : `[{ "action": "shelves_lean", "creature": "creatures/wraith" }]`,
par l'identifiant ou le nom d'une action qui appelle (1.325). Ses `levels` changent ces valeurs à partir
d'un niveau d'équipe, chacun remplaçant le précédent : `"levels": [{ "from": 8, "calls": [{ "action": "shelves_lean", "creature":
"creatures/wraith" }] }]`. Le niveau de l'équipe est le plus élevé atteint par l'un de ses membres,
lu dans les champs de niveau que les fiches de compagnons de l'Experience nomment pour l'ensemble de
règles de la partie ; sans ce champ, `levels` n'est pas lu. Un `party` nomme des tailles jusqu'à 32 ;
une plage sans `max` (`{ "min": 7 }`, Capability API 1.360) couvre toutes les équipes à partir de son
`min`, sans limite. Le Game Master reçoit la taille d'équipe prévue au début du combat, puis après
son récapitulatif.

### Fins

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene` est une des scènes du script, jouée au début de la fin ; `epilogue` est ce sur quoi le Game
Master conclut la partie, et ce que le joueur lit lorsque la fin est affichée.

### Cinématiques

Une cinématique est soit montrée au joueur exactement telle qu'elle est écrite, soit confiée au Game
Master pour qu'il la raconte.

```json
{
  "id": "gates",
  "kind": "pages",
  "background": "backgrounds:generated:town-gates",
  "pages": [
    { "text": "The gates creak open." },
    { "speaker": "p11-3", "expression": "happy", "text": "Welcome, travellers." },
    { "speaker": "player", "text": "We come in peace." }
  ]
}
```

Une cinématique `pages` se joue avant la réponse du Game Master, dans la narration, une page à la fois :
une page sans locuteur est de la narration, une page avec un locuteur est la réplique de cette personne,
sous son nom dans le monde (ou celui du joueur, pour `player`), avec une `expression` tirée de la liste
propre au Game Master. Un `background` est un arrière-plan dont dispose la partie, ou
`backgrounds:generated:<words>` pour en faire créer un quand la génération d'images est activée. Le Game
Master est informé que la scène a été montrée et poursuit à partir de là.

Une page peut avoir un `if` (Capability API 1.358) : elle n'est montrée que si ses conditions sont
remplies au moment où la scène se joue. Une scène de camp peut ainsi donner une réplique à chaque
compagnon seulement s'il voyage avec l'équipe.

```json
{ "speaker": "p11-3", "text": "Another night.", "if": [{ "party": "p11-3", "is": "in" }] }
```

Une scène dont toutes les pages sont retenues ne montre rien.

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

Une cinématique `beats` est racontée par le Game Master avec ses propres mots, temps fort après temps
fort, pendant ce tour. Les temps forts d'un événement `gm` sont transmis au Game Master avec
l'événement, et il les raconte dans la réponse qui marque le moment. Une scène à temps forts qu'utilise
un événement `gm` est donc connue du Game Master dès le départ, même quand un événement du moteur la
joue aussi. Comme ils lui sont transmis à chaque tour, les temps forts de tous les événements `gm` sont
limités ensemble à 16 000 caractères.

<a id="the-intro-message"></a>

### Le message d'introduction

`intro` (Capability API 1.339) définit l'ouverture de la partie, le même choix que la configuration du
GM propose pour toute partie :

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` fait du premier message de la partie exactement `text` ; le Game Master n'écrit rien pour
lui, et le régénérer redonne le même texte. `"guided"` ne fait qu'orienter l'ouverture écrite par le
Game Master, sous forme de consigne qu'il lit pour cette seule première réponse. `text` compte de 1 à
8000 caractères et peut contenir des sauts de ligne (c'est le seul texte d'une histoire qui le peut),
mais jamais `{{` ; un texte guidé ne peut pas non plus contenir de crochets. Avec `locked`, le joueur
voit l'introduction dans la configuration du GM et ne peut pas la modifier ; sans lui, l'introduction ne
fait que remplir le champ de la configuration, et le joueur peut la modifier ou l'effacer. Une partie
dont la première réponse est déjà écrite, ou qui reprend l'équipe d'une partie précédente, n'a pas
d'introduction. Une Experience peut aussi définir son introduction à côté de ses autres valeurs de
configuration du GM (`contributions.gameSurface.setup.defaults.intro`, 1.372) ; celle-ci est lue en
premier.

## Déroulement d'une histoire

Une fois par tour, avant que le Game Master réponde, le moteur lit ce que l'histoire a fait jusque-là et
ce qu'apporte ce tour (un trajet, une visite, la fin d'un combat), puis laisse les événements se
produire. Ce qui se produit est écrit au début de cette réponse : une balise qui consigne chaque
événement et ce qu'il a défini, et toute scène montrée telle qu'elle est écrite. Comme l'histoire est
relue à partir des réponses, un swipe (une réponse alternative) ou une régénération reprend ce que sa
réponse avait fait, et une histoire modifiée en cours de partie ne réécrit jamais ce qui s'est déjà
passé. L'histoire se poursuit dans la session suivante de la partie.

<a id="the-game-masters-tags"></a>

### Les balises du Game Master

À chaque tour, le Game Master reçoit les valeurs de l'histoire (cachées au joueur) et les consignes en
vigueur. Du reste du script, il ne reçoit que ce que le script lui confie : les événements `gm` (avec
leur `note` et les éventuels `beats` à raconter avec eux), les drapeaux `gm`, et ceux de ces événements
qu'il ne peut pas marquer pour l'instant (déjà faits, ou retenus par leurs conditions). Il les marque
dans sa réponse :

- `[story: event="<id>"]` déclenche un événement `gm` dont les conditions sont remplies (une fois, sauf
  s'il se répète).
- `[story: flag="<id>" value="<value>"]`, ou `add="<number>"` pour un drapeau numérique, définit un
  drapeau `gm`.

Les cadeaux, le combat et le déplacement d'un événement `gm` entrent dans la réponse avec sa balise ;
sa scène de fin et son épilogue arrivent au début de la réponse suivante.

Le moteur répond sur place à chaque balise (à un même événement, une fois par tour au plus) et refuse
tout le reste en donnant la raison. Dans une partie sans histoire, toute balise d'histoire est refusée.
Ce que le Game Master déclenche prend effet immédiatement (ses drapeaux, ses actes) ; ses scènes et ses
demandes arrivent au début de la réponse suivante, sauf ses `beats` (le Game Master a reçu pour consigne
de les raconter avec le moment). Écris les `pages` d'un événement `gm` comme la suite du moment, puisque
le Game Master a déjà raconté le moment lui-même.

## Essayer une histoire

Enregistre-la dans une partie avec `PUT /api/game/:chatId/story` et `{ "story": { ... } }` : une
histoire qui ne convient pas est refusée avec toutes les raisons. L'onglet World (monde) de la partie
liste les objectifs et les horloges que l'histoire a montrés, et le prompt du Game Master contient à chaque tour les
valeurs et les consignes de l'histoire.
