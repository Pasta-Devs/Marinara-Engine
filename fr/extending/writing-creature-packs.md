# Écrire des packs de créatures

Un **pack de créatures** rassemble les illustrations des créatures que Game Mode affronte. Quand un pack
est choisi, un ennemi pour lequel il a une illustration est dessiné avec elle sur le plateau de combat,
au lieu d'un pion rond. L'illustration est tournée dans la direction du dernier déplacement de l'ennemi
et dessinée à la taille propre de la créature. Un ennemi pour lequel le pack n'a pas d'illustration
garde son pion. Consulte [Combats tactiques et terrain](../game/combat.md#tactical-battles-and-terrain)
pour voir le rendu en jeu.

Un pack est un seul fichier JSON (`.creatures.json`). Le plus simple pour en créer un est l'onglet
**Creatures** (créatures) de Pixelforge, qui construit le fichier à partir d'une image par créature.
Cette page décrit le fichier lui-même, pour qui construit ses packs autrement.

## Le fichier

```json
{
  "creaturePackVersion": 1,
  "id": "my-monsters",
  "name": "My monsters",
  "version": 1,
  "author": "Robin",
  "tileSize": 48,
  "sheets": [{ "id": "s1", "png": "data:image/png;base64,iVBORw0KGgo...", "width": 2048, "height": 1536 }],
  "creatures": [
    {
      "id": "goblin",
      "match": ["5e-2014/creatures/goblin", "Goblin"],
      "size": "small",
      "w": 1,
      "h": 2,
      "frames": 1,
      "variants": [
        { "sheet": "s1", "x": 0, "y": 0 },
        { "sheet": "s1", "x": 1, "y": 0 }
      ]
    }
  ]
}
```

| Champ | Ce que c'est |
| --- | --- |
| `creaturePackVersion` | Toujours `1`. |
| `id` | Lettres minuscules, chiffres, `_` et `-`. La bibliothèque range un pack importé sous `local/<id>`. |
| `name`, `author` | Affichés dans la bibliothèque. `author` est facultatif. |
| `version` | Un nombre entier. Une version n'est jamais réécrite : pour modifier un pack, augmente sa version. Importer de nouveau le même fichier ne change rien. |
| `tileSize` | La taille d'une case en pixels, un multiple de 16 compris entre 16 et 96. La grille de Game Mode est de 48. |
| `sheets` | Jusqu'à 64 planches, c'est-à-dire des images d'au plus 8192 pixels de côté chacune. |
| `creatures` | Jusqu'à 2000 créatures. |

## Planches

Le `png` d'une planche doit être une **data URL** PNG : `data:image/png;base64,` suivi du base64, et de
rien d'autre. Un lien vers une image située ailleurs est refusé, tout comme ce qui suit le base64.
Ainsi, un pack ne peut jamais afficher que ses propres images. `width` et `height` doivent être la
taille réelle du PNG ; le moteur les lit dans l'en-tête de l'image et refuse un pack dont les planches
indiquent autre chose.

## Une créature

| Champ | Ce que c'est |
| --- | --- |
| `id` | L'identifiant de la créature dans le pack, unique. |
| `match` | Ce à quoi l'illustration est destinée, de 1 à 16 entrées. Une entrée est une créature d'ensemble de règles ou un nom, et les deux types peuvent se côtoyer. |
| `size` | `tiny`, `small`, `medium`, `large`, `huge` ou `gargantuan`. Cela ne concerne que l'affichage ; chaque unité occupe toujours une seule case. |
| `w`, `h` | La taille d'une image d'animation en cases, de 1 à 6 chacune. |
| `frames` | `1` pour une créature immobile, `3` pour une créature qui marche (pas, repos, pas). |
| `variants` | Ses **apparences**, de 1 à 8, chacune indiquant où commence son bloc sur une planche : `sheet` et la case en haut à gauche, `x`, `y`. |

### Ce que désigne `match`

- **Une créature d'ensemble de règles :** `<catalog>/<entry>` (par exemple `creatures/goblin`)
  correspond à cette entrée de bestiaire dans n'importe quel ensemble de règles.
  `<ruleset>/<catalog>/<entry>` (par exemple `5e-2014/creatures/goblin`) ne lui correspond que dans cet
  ensemble de règles.
- **Un nom :** correspond à un ennemi par son nom. La casse et la ponctuation sont ignorées, tout comme
  un nombre final : "Goblin 2" est donc un gobelin.

Un combattant issu du bestiaire d'un ensemble de règles est reconnu d'abord par son entrée, puis par son
nom. Si deux créatures correspondent à la même chose, celle qui est listée en premier dans le pack
l'emporte ; le moteur le signale à l'importation du pack.

### Tailles

Les images d'animation se comptent en cases, et une créature est dessinée debout sur le bas de sa case,
centrée : une grande créature domine donc les cases qui l'entourent. Ces tailles rendent bien sur la
grille de 48 pixels :

| Créature | Image d'animation (`w` sur `h`) |
| --- | --- |
| Très petite, ou petite ou moyenne à quatre pattes | 1 sur 1 |
| Petite ou moyenne, debout | 1 sur 2 |
| Grande | 2 sur 2, ou 2 sur 3 si elle se tient debout (un ogre, un golem) |
| Très grande | 3 sur 3, ou 3 sur 4 debout (un géant) |
| Gigantesque | 4 sur 4 |

### Le bloc : lignes et images d'animation

Chaque apparence est un **bloc** sur sa planche. Un bloc compte `frames` images d'animation en largeur
et 4 lignes en hauteur, et chaque image fait `w` sur `h` cases. Les lignes sont les orientations, dans
cet ordre :

1. bas (vers le spectateur)
2. gauche
3. droite
4. haut (vu de dos)

Une créature immobile (`frames: 1`) est une seule colonne des quatre orientations. Une créature qui
marche (`frames: 3`) aligne sur chaque ligne pas, repos et pas, comme un personnage en marche dans RPG
Maker. Chaque bloc doit tenir entièrement dans sa planche ; le moteur nomme tout bloc qui dépasse du
bord.

### Apparences

Une créature qui a plusieurs apparences (d'autres vêtements, couleurs ou armes) en attribue une à chacun
de ses combattants. Un combattant garde la même apparence chaque fois qu'il est dessiné, et deux
gobelins d'un même combat peuvent être différents. Toutes les apparences d'une créature ont la même
taille.

Dans l'onglet **Creatures** de Pixelforge, **Add looks** (ajouter des apparences), à côté d'une
créature, ajoute d'autres images de la même taille que la première, jusqu'à huit en tout.

## Utiliser un pack

Dans l'onglet **Creatures** de Pixelforge, choisis **Import a creature pack file** (importer un fichier
de pack de créatures), ou **Save to the library** (enregistrer dans la bibliothèque) pour un pack créé
sur place, puis **Use for fights** (utiliser pour les combats). Un seul pack dessine tous les combats.
Retirer le pack choisi, ou choisir **Use tokens instead** (utiliser plutôt les pions), ramène aux pions.
