# Writing Creature Packs

A **creature pack** is art for the creatures Game Mode fights. When a pack is chosen, an enemy it has
art for is drawn with that art on the battle board instead of a round token. The art faces the way the
enemy last moved and is drawn at the creature's own size. An enemy the pack has no art for keeps its
token. See [Tactical battles and terrain](../game/combat.md#tactical-battles-and-terrain) for how it
looks in play.

A pack is one JSON file (`.creatures.json`). The easiest way to make one is Pixelforge's **Creatures**
tab, which builds the file from one picture per creature. This page describes the file itself, for
anyone who builds packs another way.

## The file

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

| Field | What it is |
| --- | --- |
| `creaturePackVersion` | `1`, or `2` for a pack with flying art (Capability API 1.352). |
| `id` | Lowercase letters, digits, `_` and `-`. The library files an imported pack under `local/<id>`. |
| `name`, `author` | Shown in the library. `author` is optional. |
| `version` | A whole number. A version is never rewritten: to change a pack, raise its version. Importing the same file again changes nothing. |
| `tileSize` | One cell in pixels, a multiple of 16 from 16 to 96. Game Mode's grid is 48. |
| `sheets` | Up to 64 pictures, each at most 8192 pixels on a side. |
| `creatures` | Up to 2000 creatures. |

## Sheets

A sheet's `png` must be a PNG **data URL**: `data:image/png;base64,` followed by base64 and nothing
else. A link to an image elsewhere is refused, and so is anything after the base64. This way a pack can
only ever show its own pictures. The `width` and `height` must be the PNG's real size; the Engine reads
them from the picture's header and refuses a pack whose sheets say otherwise.

## A creature

| Field | What it is |
| --- | --- |
| `id` | The creature's id in the pack, unique. |
| `match` | What the art is for, 1 to 16 entries. An entry is a ruleset creature, a name, or both kinds side by side. |
| `size` | `tiny`, `small`, `medium`, `large`, `huge` or `gargantuan`. This is only how it looks; every unit still takes one square. |
| `w`, `h` | One frame's size in cells, 1 to 6 each. |
| `frames` | `1` for a still creature, `3` for a walking one (step, stand, step). |
| `variants` | Its **looks**, 1 to 8, each where its block starts on a sheet: `sheet` and the top-left cell `x`, `y`. |
| `fly` | Optional, needs `creaturePackVersion` 2: its **flying** blocks, laid out as a walking block (three frames across, the four facings down), placed as `variants` are. One for every look, or one per look in the same order. |

### Flying

A creature with `fly` is drawn from its flying block, its frames played 0, 1, 2, 1, while it is shown in
the air in a fight: it has a fly speed and no walk, it hovers, it is up above the ground, or it flew this
turn (a step only its flight takes, such as over water). Otherwise it is drawn from its look as before.
An Experience map pack whose creature packs have flying art needs Capability API 1.352.

### What `match` names

- **A ruleset creature:** `<catalog>/<entry>` (for example `creatures/goblin`) matches that bestiary
  entry in any ruleset. `<ruleset>/<catalog>/<entry>` (for example `5e-2014/creatures/goblin`) matches
  it only in that ruleset.
- **A name:** matches an enemy by its name. Case and punctuation are ignored, and so is a trailing
  number, so "Goblin 2" is a goblin.

A fighter from a ruleset's bestiary is matched by its entry first, then by its name. If two creatures
match the same thing, the one listed first in the pack wins; the Engine notes this when the pack is
imported.

### Sizes

Frames are counted in cells, and a creature is drawn standing on the bottom of its square, centred, so
a big one stands over the squares around it. These sizes look right on the 48-pixel grid:

| Creature | Frame (`w` by `h`) |
| --- | --- |
| Tiny, or a small or medium four-legged creature | 1 by 1 |
| Small or medium, standing upright | 1 by 2 |
| Large | 2 by 2, or 2 by 3 if it stands upright (an ogre, a golem) |
| Huge | 3 by 3, or 3 by 4 standing upright (a giant) |
| Gargantuan | 4 by 4 |

### The block: rows and frames

Each look is a **block** on its sheet. A block is `frames` frames across and 4 rows down, and each frame
is `w` by `h` cells. The rows are the facings, in this order:

1. down (towards the viewer)
2. left
3. right
4. up (seen from behind)

A still creature (`frames: 1`) is one column of the four facings. A walking one (`frames: 3`) has step,
stand and step across each row, as a walking character in RPG Maker does. Every block must lie wholly
inside its sheet; the Engine names any that reaches past the edge.

### Looks

A creature with several looks (other clothes, colours or weapons) gives each of its fighters one. A
fighter keeps the same look every time it is drawn, and two goblins in one fight can differ. All of a
creature's looks are the same size.

In Pixelforge's **Creatures** tab, **Add looks** beside a creature adds more pictures of the same size
as its first, up to eight in all.

## Using a pack

In Pixelforge's **Creatures** tab, **Import a creature pack file** (or **Save to the library** for one
made there), then **Use for fights**. One pack draws every fight. Removing the chosen pack, or **Use
tokens instead**, goes back to tokens.
