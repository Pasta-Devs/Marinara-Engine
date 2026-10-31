# Ruleset Layers, Translations and Migrations

This page is part of [Writing Game Mode Rulesets](writing-rulesets.md). Variants a player turns on for one game, translations of a ruleset's text, and moving values to new ids when a sheet changes.

## Layers: variants of your own ruleset

A layer is a named variant of your ruleset that the player turns on when they create a game: Low
magic, Hard winter, a grittier difficulty. Layers live in the ruleset file, in an optional
`layers` array, so they travel with it and can never go missing from a game that used them. The
wizard shows them as toggles under your ruleset, and the choice is fixed for that game's lifetime,
exactly like the ruleset itself.

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

**What a layer can do.** The list is closed, and every effect either narrows something or adds text:

- `gm.guidance` is appended to your `gm.checkGuidance`, after your own text and after any earlier
  layer's. `gm.worldGuidance` is appended to `gm.worldGuidance` the same way.
- `fields` takes values out of an **enum** field. `removeValues` names values the field already
  has, at least one has to survive, and if the field's `default` is one of them the layer names a
  `default` that survives instead.
- `difficultyLadder` replaces your ladder with another one, in the shape of your own resolution
  kind: `{label, dc}` for `dice-sum` and `{label, successes, target?}` for `dice-pool`. It is held
  to exactly the checks your own ladder is held to. When several active layers declare one, the
  last of them wins.
- `catalogs` hides entries from the sheet editor's picker. Each rule names one of that catalog's
  declared `filters` and exactly one comparison: `above` or `below` for a `number` filter,
  `equals` or `notIn` for a `text` or `tags` one. An entry that does not set that filter at all is
  never hidden.
- `currencies` takes coins out: `removeUnits` names single coins and `removeFamilies` whole
  families. A family's smallest coin goes only with its family, so every family left can still pay
  and give change. While the layer is on, nobody earns, pays with, picks or drops a coin taken out,
  and the purse line leaves it out. A price named in it is said in the largest coin left that pays
  it exactly, at the same worth: Gravewatch's long night takes the crown out, so a watch pistol at 3
  crowns costs 15 shillings. An item whose whole family is gone has no price.
- `items` changes where things are sold and what drops, never what exists. `market.removeSellers`
  takes sellers out of your market (at least one is always left: a market with no sellers lets
  anybody sell everything, so a removal that would empty it, even by two layers together, is not
  made). `market.unsold` takes wares off every seller, with filters like the market's own (it is
  added to the market's `unsold`). `lootTables` replaces loot tables you already have, by id, with
  tables of the same shape, so every creature, threat tier and seller's `stock` that names one
  rolls the replacement; when several active layers replace one table, the last of them wins. An
  unsold item is still an item: it can be carried, used, found in loot and handed out by the Game
  Master, and a seller's `stock` table may still roll it.

```json
"items": {
  "market": { "removeSellers": ["magic_dealer", "scribe"], "unsold": [{ "tag": "magical" }] },
  "lootTables": [{ "id": "treasure_low", "label": "Pocket treasure", "entries": [{ "coins": "sp", "weight": 1, "count": "4d6" }] }]
}
```

**What a layer cannot do.** It cannot add an enum value, add a field, a skill, a pool or a rest,
add a seller or a loot table, change the resolution kind, touch live state or combat numbers, or add
a model call. A value a
layer _added_ would be unknown to every other reader of the sheet, so values only ever go away.
Anything beyond this list is a change to the ruleset itself, or a second ruleset.

**Conflicts.** `conflicts` names layers that cannot be on together. Naming one side of the pair is
enough. The wizard disables the other toggle, and if a saved choice somehow has both, the one
declared **later** is dropped, so the same two choices always give the same rules.

**A sheet that already holds a removed value keeps it.** Nothing rewrites a character. The editor
simply stops offering the value, and a character who already had it shows it as what it is. Turn
the layer off in a new game and the value is offered again. The same is true of a hidden catalog
entry: it is left out of the picker, and a row a player already picked stays on the sheet. Coins a
layer takes out that somebody already carries stay in their bag.

**Limits.** 12 layers per ruleset, and 4000 characters of guidance per layer counting both strings
together. A packaged ruleset that declares `layers`, or a base `gm.worldGuidance`, needs Capability
API 1.25, one whose layers take coins out needs 1.64, and one whose layers change its `items` needs
1.813. A ruleset you import is validated by the Engine that reads it, so it needs nothing.

**Layers written by somebody else** (a Low Magic layer for a ruleset you did not write, shipped in
its own file) are a later addition. Today a layer ships inside the ruleset it belongs to.

## Translations

**Translations** (Capability API 1.811). A ruleset's display strings in another language are one translation per language, named by the language's code as the Engine's own language packs are (`ru`, `pt-BR`, `zh-Hans`). In the official agents catalog each is a language pack beside the ruleset's file (below). A ruleset package file you share may carry them inside instead, one file per language beside `ruleset.json`: `locales/<language>.json`, listed in the manifest like the other files. Either way, each is a package localization catalog with a `ruleset` section: every key is a display string of the ruleset or its catalogs, word for word in English, and its value is that string in the file's language.

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

`_meta.locale` must be the language the file is named for, and the file holds `$schema`, `_meta`, `package` and `ruleset` and nothing else, every value text. A string left empty is not translated yet and shows in English; a file with no `ruleset` section (a package's own English listing, `locales/en.json`) translates nothing. Translations are display only: the rules, the sheet commands and everything the Game Master is told go on reading the English. A fight's screen (names, conditions, actions, spells, the log and the turn order) shows each string in the player's language where the ruleset's translation has it, the language's own file first and then the one it is a kind of (`pt` for `pt-BR`), and in English otherwise; "Goblin 2" reads the translation of "Goblin" with its number. A package file with translations needs Capability API 1.811. Importing it keeps only the translation in the language the Engine is set to (or the one it is a kind of) and drops the rest; to read the ruleset in another language, switch the Engine's language and import the file again, which replaces the one kept. Translations are no part of the version, so importing the same version again with a corrected translation replaces it too, and a file of it with none leaves what was kept.

A catalog ruleset never carries `locales/<language>.json` inside its file (one that does is refused before it is downloaded). Its translations are language packs (Capability API 1.811): one JSON file per language, `<id>-<version>.<language>.json`, published beside `<id>-<version>.ruleset.json` and holding exactly what a `locales/<language>.json` holds (`_meta.locale` the language it is named for, and a `ruleset` section). The catalog entry lists them beside its `artifact`:

```json
"locales": {
  "ru": {
    "url": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/ember-roads-1.0.0.ru.json",
    "sha256": "<64 hex>",
    "bytes": 812345,
    "name": "Угольные дороги",
    "description": "<the store card's description in Russian>"
  }
}
```

Each pack is an https URL of the same form as the artifact's, named for its version and language, with its sha256 and its size (at most 8 MB); a ruleset lists at most 40, never `en` (English is the ruleset itself), and its manifest declares Capability API 1.811. `name` and `description` are the store card's in that language, so the card reads in the Engine's language without fetching the pack. An install fetches the ruleset's file and then only the pack in the language the Engine is set to (or the one it is a kind of), checks its size, checksum and language, and keeps it with the installed version. When the Engine's language changes (and each time a page opens in it), each installed catalog ruleset that lists a pack in the new language fetches it and the old language's pack is removed. A pack that cannot be had (offline, none listed, or not the file the catalog lists) leaves the ruleset in English; the next install or change of language tries again. An update keeps the version before it for rollback without its pack: after a rollback the next change of language fetches that version's pack again, if the catalog still lists it.

## Moving values to new ids: `sheet.migrations`

Adding things needs nothing more. When a new layout moves a value somewhere else (a renamed field, one level that becomes a level per class, one pool of hit dice that becomes one per die), say how in `sheet.migrations` (Capability API 1.77), so every character made on the old layout keeps its numbers: in the library, in games, in old saves, branches and checkpoints, and in imported cards.

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

- Each entry moves a stored sheet from version `from` to `from + 1`, and runs for every sheet stored at that version or older, in order. Never remove one once it has shipped: a sheet stored long ago still needs it. A version that only adds needs none.
- `rename` (an `ability`, `skill`, `save` or `field`): the value is copied to its new id. A skill or save takes its bonus along. A rename may continue one from an earlier entry, or feed a field a later `route` sends on; the import follows the chain to where it ends.
- `route`: one field's value goes to the field that another field's text names. A case wins when its words appear in `by`'s text as whole words (only letters join a word, so "Fighter3" names a fighter), ignoring case, and exactly one case does. None, or several ("Fighter 3 / Wizard 2", which one number cannot be split between without asking), and it goes to `else`. `default` stands in for a sheet that never stored the value. `by` is a field the sheet has, or one an earlier layout renamed away. The targets are number or text fields with no default, or a default of 0 or empty: the value lands in one of them and every other keeps its default, so any other default would read as a level nobody gave. A target a later rename moves on is followed there.
- `routeLive` (a `pool` or `track` of the live state): the stored value goes to the one of `cases` the migrated sheet shows (a pool with a maximum above 0, a track the sheet does not hide), else to `else`. The tracks a value goes to are all wound tracks (it carries the marks) or all plain ones (it carries the number).
- `setColumn` (Capability API 1.794): `{ "setColumn": { "list": "attacks", "where": { "name": ["Dagger", "Rapier"], "ability": ["str", "dex"] }, "column": "ability", "to": "finesse" } }` sets one column on every row of a list whose `where` columns each hold one of the values listed (text matches ignoring case and spaces at its ends; a number matches exactly). Use it to fix rows made before your ruleset knew better, such as attack rows made before a weapon's ability choice existed. The list and every column it names must be on the sheet.
- Every other build step copies: the old value stays where it was, so an older version of your ruleset still reads the sheet as it did, and the step never overwrites a value already in its target. `setColumn` is the one step that overwrites.
- The import refuses an entry at or above `sheet.version`, two entries from the same version, a step that writes to an id the sheet does not have, a case listed twice, and a `rename` or `routeLive` that reads from an id the sheet still has (an id moved away is never used again, which is what makes those steps safe to run again).
- Sheets are migrated whenever they are read, and the new layout is stored at the next edit. Live state has no version of its own, so `routeLive` runs on every read: the old key is dropped and its value moves only while the new key is not there yet, so a value spent or rested since is never overwritten. Where it went is settled by the first write after the update: a sheet corrected later (a class level moved by hand) does not move it again. A fight already in progress when the new version arrives still ends, as before.
