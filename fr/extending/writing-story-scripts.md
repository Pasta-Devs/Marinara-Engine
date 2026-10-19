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
  "cutscenes": []
}
```

Les identifiants comptent de 1 à 40 lettres minuscules, chiffres, `_` ou `-`, et sont uniques dans leur
liste. Une histoire contient au plus 64 drapeaux, 64 consignes, 128 événements et 64 cinématiques. Aucun
de ses textes ne peut contenir de saut de ligne, de crochets ni `{{`, et les noms écrits dans une balise
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

Un objectif oui/non est atteint quand son drapeau est vrai ; un objectif numérique, quand son drapeau
atteint son `goal` (1 s'il n'est pas indiqué). Quand un `goal` est écrit, le journal montre où en est la
progression. Un objectif avec `"hidden": true` attend dans le journal qu'un événement le montre.

### Consignes

Une consigne est une instruction permanente donnée au Game Master, en vigueur tant que ses conditions
sont remplies :

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### Conditions

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Toutes les
conditions d'une liste `if` doivent être remplies. Un drapeau oui/non ne se compare qu'avec `=` ou `!=`.

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
| `fight`  | Quand un combat se termine par `outcome` : `victory`, `defeat` ou `flee`.                                                                                                                                                                                                                                                                                                                                                                               |
| `broke`  | Quand un combat a brisé l'élément de décor appelé `prop` (Capability API 1.316), sans tenir compte de la casse. Seul un élément de décor peint sur l'un des champs de bataille du monde peut être nommé.                                                                                                                                                                                                                                                |
| `flags`  | Quand ses conditions sont remplies. Avec `repeat`, de nouveau chaque fois qu'elles redeviennent vraies après avoir été fausses.                                                                                                                                                                                                                                                                                                                         |
| `gm`     | Seulement quand le Game Master le déclenche (l'événement doit avoir `"gm": true`).                                                                                                                                                                                                                                                                                                                                                                      |
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

Une histoire ne donne pas d'objets, ne lance pas de combats, ne déplace pas l'équipe et ne termine pas
la partie : cela reste l'affaire du Game Master et du joueur. Demande-les au Game Master avec `tell`.

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

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

Une cinématique `beats` est racontée par le Game Master avec ses propres mots, temps fort après temps
fort, pendant ce tour. Les temps forts d'un événement `gm` sont transmis au Game Master avec
l'événement, et il les raconte dans la réponse qui marque le moment. Une scène à temps forts qu'utilise
un événement `gm` est donc connue du Game Master dès le départ, même quand un événement du moteur la
joue aussi. Comme ils lui sont transmis à chaque tour, les temps forts de tous les événements `gm` sont
limités ensemble à 16 000 caractères.

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
d'introduction.

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

Le moteur répond sur place à chaque balise (à un même événement, une fois par tour au plus) et refuse
tout le reste en donnant la raison. Dans une partie sans histoire, toute balise d'histoire est refusée.
Ce que le Game Master déclenche prend effet immédiatement (ses drapeaux, ses actes) ; ses scènes et ses
demandes arrivent au début de la réponse suivante, sauf ses `beats` (le Game Master a reçu pour consigne
de les raconter avec le moment). Écris les `pages` d'un événement `gm` comme la suite du moment, puisque
le Game Master a déjà raconté le moment lui-même.

## Essayer une histoire

Enregistre-la dans une partie avec `PUT /api/game/:chatId/story` et `{ "story": { ... } }` : une
histoire qui ne convient pas est refusée avec toutes les raisons. L'onglet World (monde) de la partie
liste les objectifs que l'histoire a montrés, et le prompt du Game Master contient à chaque tour les
valeurs et les consignes de l'histoire.
