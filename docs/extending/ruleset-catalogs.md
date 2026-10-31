# Ruleset Catalogs

This page is part of [Writing Game Mode Rulesets](writing-rulesets.md). Ready-made entries the sheet editor offers in a picker: the catalog header, entries, values the ruleset keeps, sheet commands and the use command.

Typing a spell list, a gear table, or a page of class features row by row is miserable. A catalog is a named collection of ready-made entries that you ship with the ruleset. The sheet editor offers them in a picker on every list the catalog feeds, and picking one fills the row in.

A catalog is optional. A ruleset may have up to twelve of them, and nothing in the Engine knows what any of them are about: every id, column, filter, and word comes from your file.

## The header

The header goes in `catalogs` at the top level of the file, beside `gm`.

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

- `id` and `label`: the id follows the sheet id rules, and the label is what the picker is called.
- `holds`: `"rows"` (the default, and what every catalog written before this release is), `"creatures"` or `"items"`. A catalog of creatures is a bestiary a fight reads, and a catalog of items lists things a party carries. Neither writes anything onto a sheet, declares `feeds`, or is ever offered by the picker. See [Creatures](ruleset-combat.md#creatures-a-bestiary-a-fight-reads) and [Items](ruleset-items.md) below.
- `feeds`: the lists on your sheet that this catalog's entries may write into, one to eight of them. Required for a catalog of rows and refused on a catalog of creatures or items. An entry can never write into a list that is not here, and it can never write a value the list's columns could not hold.
- `filters`: optional, up to eight. What the picker can narrow the list by. A filter is a `number`, a `text` value, or `tags` (several words). `startFrom` names a sheet field the picker opens on, so a character whose Calling is Tinker sees Tinker entries first.
- `units`: optional. What a range or an area size in an entry's `mechanics` block means in your system.

## An entry

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

- `id`: lowercase letters, digits, and single hyphens, unique inside the catalog.
- `label` and `summary`: what the picker shows. The summary is optional, one line, and up to 300 characters.
- `filters`: the values for the filters the header declared. A `number` filter takes a number, a `text` filter takes one string, and a `tags` filter takes a list of strings.
- `rows`: what picking the entry writes, one to six rows. `list` is one of the catalog's `feeds`, and `values` are keyed by that list's column ids.
- `creature`: an opponent instead of rows, in a catalog that `holds` creatures. An entry has exactly one of `rows` or `creature`, and a creature carries no `mechanics`: it says what it does in its own actions.

Every value is checked against the target list's columns, so a mistyped column name or a number outside a column's range is reported with the entry it came from. Entries written inside the ruleset file are checked when the ruleset is loaded, which for an imported file means at import. A package's separate catalog file is checked when the picker first asks for it, and a file with a mistake shows its reasons there instead of any entries.

## One entry, several lists

A feature with limited uses is two rows on a sheet: the feature itself, and the counter that tracks it. That is still one pick.

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

## Values the ruleset keeps up to date

A row's numbers belong to the player once it is picked. One exception is worth having: a maximum that
follows the character, such as uses equal to an ability score, or a class resource that grows with a
level. A row may name up to four of its own number columns in a `scaled` map, and the sheet editor
keeps those cells right.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- The key is one of the list's `number` columns.
- `from` is an ordinary value reference, the same closed vocabulary used everywhere else. Anything
  more complicated is a `derived` value your sheet declares, which `from` then points at
  (`"from": { "derived": "lay_on_hands_max" }`). No new arithmetic is added here.
- `table` is optional. With it, the reference's value is looked up in a step table, which is how a
  level gives a number: `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` must still hold a plain number for the column, and a row that leaves it out is refused.
  That is what the row is before any sheet is known, and what a sheet with no such reference keeps.
- A row with `scaled` must be the entry's only row for that list, so a marked row on a sheet always
  matches one spec, or (Capability API 1.92) every row the entry writes to that list must carry its own
  name in the list's name column (its pools' `nameColumn`, else its first text column). The sheet's
  row is then matched to its spec by that name, so one trait can give two uses that each grow on
  their own; a row the player renames is left alone.

The value is worked out when the sheet is edited and never when it is read, so a stored row is always
the number it says it is. It is fitted to the column it lands in: clamped to the column's `min` and
`max`, and rounded down when the column takes whole numbers. In the example above, a character with
Heart 3 has three uses and one with Heart 0 or less has none. The row stays on their sheet with 0
uses, and because a counter with a maximum of 0 is not a pool, there is nothing to spend in play.

Scaled columns are Capability API 1.23 for a packaged ruleset. A community ruleset you import is
validated by the Engine that reads it, so it needs nothing.

## Picked rows are copies

Each picked row is copied onto the sheet with one extra key, `_catalog`, holding `<catalog id>/<entry id>`. Column ids always start with a letter, so this key can never be one of yours.

The copy is the character's. The player can edit any of it afterwards, the sheet keeps working while your ruleset is not installed, and publishing a new version of the ruleset never rewrites anyone's character. The mark is what the picker reads to show what a sheet already has, and what Refresh reads below.

## Refresh from ruleset

Because a picked row keeps its mark, the sheet editor can tell a player when your newer text differs from what their row holds. A short line under the list says how many rows have newer text, and a **Review** button shows each of them with what the sheet holds beside what the ruleset says, and a tick per row. Nothing is written until the player clicks **Update selected**, and only the columns that differ in the ticked rows are written. Everything else in the row survives, the mark included.

What is compared is deliberately narrow:

- Existing values are compared only in `text`, `longtext`, `dice` and `enum` columns. Existing `number` and `boolean` values belong to the player and are preserved, including 0 and false. A column the row does not yet contain can be offered with its typed value, including numbers and switches. A scaled column is excluded because it already follows the sheet.
- Only columns your entry sets. A column your entry leaves out is never touched, whatever the sheet holds in it.
- A value the column itself would refuse, such as an `enum` value you no longer offer or text past its `maxLength`, is skipped rather than written.
- A row is matched to the entry row it came from by position among the rows carrying the same mark in that list, which holds while the sheet still has as many of them as your entry writes. Otherwise it works only when your entry writes a single row for that list. If a player deleted one row of a two-row entry, that entry is left alone rather than guessed at.
- A row whose entry your catalog no longer has is left alone, silently.

So rewording or renaming an entry can reach characters who already picked it, if they accept it. Changing what a number means cannot, and will not: that column is the player's once the row is theirs.

## Sheet commands: permanent advancement

A ruleset may opt into changes to the permanent build with `sheet.advancement`:

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

Only include field ids your sheet declares as number or text (`text` or `longtext`), at most 24.
The booleans allow all abilities, skills or saves respectively; omitted or false means no permission.
An empty permission set, unknown field, unsupported field type or unknown key is refused on import.
`text` is optional guidance of at most 400 prompt-safe characters. Without `advancement`, the existing
commands behave as before and every `advance` request is refused.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Name exactly one target. Fields and abilities take exactly one of `by` or `to`; text takes only `to`.
Names and tiers match ids or labels, ignoring case. Skills and saves accept any tier declared in
`resolution.proficiencyTiers`. Number fields honor `integer`, `min` and `max`; abilities honor their
integer bounds; text honors `maxLength`. An invalid value is refused with a `bad-amount` reason that
states the bound, never silently clamped. Disabled advancement, disallowed targets, unknown names and
unknown tiers are also refused. The rewritten tag carries `result` and the new value in `now`.
Omit `who` for the player, or use `who="party"` for every unambiguous party card; partial refusals name
which cards could not advance.

The Engine saves the build on the game's card through the same metadata storage as a player edit,
keeping its sheet version and recomputing derived values from the new build. Library cards are not
changed. Like live commands, an alternate swipe or regenerated reply starts before the outgoing
reply's changes. Each reply records its ending build, including replies with no advancement. Selecting a swipe
restores its snapshot; deleting the latest reply reveals the preceding snapshot. Deleting an older
reply leaves a later snapshot in force until that later reply is removed. A continuation updates the
same reply's snapshot. Undo changes only values still matching the recorded result, so
later player edits survive and unrelated edits do not prevent an XP award from being undone.

## The `use` command: letting the Game Master spend a price you wrote

While it narrates, the Game Master keeps each sheet up to date with `[sheet: ...]` commands: `spend`,
`restore` (`heal` means the same thing), `damage`, `temp`, `track`, `condition`, `note` and `rest`. A
ruleset that ships catalogs gets one more:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` means the same as `op="use"` and `spell=` the same as `name=`, so the wording a Game
Master reaches for works without your format having to know the word "spell".

The name is matched, ignoring case, against the rows on that character's sheet that came from one of
your catalogs. A row answers to the name the Game Master was shown (the `sheetSummary` name column for
that list, then the list's `pools.nameColumn`, then its first text column) and to the `label` of the
entry it came from, so a player who renamed their row still has it. A name nothing answers to, and a
name two different entries answer to, are both refused.

What it spends:

- every term of the entry's `mechanics.cost`. A term naming a live pool pays from that pool; a term
  naming a pool GROUP pays from the first pool of that group, in declaration order, that can afford
  it. There is no automatic climb to a higher pool, because a group is not always a ladder.
- plus one from every list-row pool the same entry wrote, such as the counter that tracks a feature's
  uses. That is the second row of the `Last Ember` entry above. A counter whose maximum is 0 has no
  uses to give, so the command is refused instead of going through for free.

`pool=` is the upcast: the same single price, paid from another pool of the same group. It is only
accepted when the cost has exactly one term and the named pool shares that term's group, or pays
for it. Anything else is refused rather than reinterpreted.

**A pool that pays for another group** (Capability API 1.171). A live pool's `pays` names up to four
other groups whose costs it may pay too, at its own level (its `level`, or its place in its own
group), and never for a cost of a higher level than its own. 5e's pact slots pay for spells costed
from the spell slots, as a multiclass warlock may:

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

A fight offers such a pool beside the higher pools of the spell's own group, and a payment from it
grows the spell by as many steps as its level is above the spell's: a 3rd-level pact slot pays for
Magic Missile as a 3rd-level slot would. A use whose own pool is empty is still offered, paid only
from a higher pool or one that pays for it, so a 1st-level spell is cast with a 2nd-level slot once
the 1st-level slots are gone. `targetsPerCostStep` (1.171, 1 to 10) on an entry's `mechanics` adds
that many targets for each step it is paid up, to 20 at most: Hold Person is `"targetCount": 1,
"targetsPerCostStep": 1`.

It is all or nothing. If any part cannot be paid the whole command is refused, nothing changes, and
the player is told. An entry with no cost at all, such as a cantrip or a passive feature, is accepted
and changes nothing.

## Inline, or a file of its own

A small catalog sits inline in `ruleset.json`, in the header's `entries`. A long one lives in its own file and the header names it with `asset` instead. A catalog has exactly one of the two.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

The path is always `catalogs/<the catalog's id>.json`. The file itself looks like this:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Separate catalog files come in a package: one published through the official catalog, or a ruleset package file you import yourself (see [Sharing your ruleset](writing-rulesets.md#sharing-your-ruleset)). The package lists the file in `contributions.assets.paths` beside `ruleset.json`, and it needs Capability API 1.21. A catalog of creatures, inline or in its own file, needs Capability API 1.27, and a catalog of items needs 1.49. **A ruleset you import as a single file, or share through a GitHub repository, carries its catalogs inline**, which means they have to fit inside the 512 KB limit on the whole ruleset file. That is room for a few hundred short entries.

The limits are 12 catalogs per ruleset, 2000 entries per catalog either way, and 2 MB for one catalog file. A package whose `ruleset.json` is over 256 KB, or with a catalog file over 1 MB, needs Capability API 1.340, which raised both limits.
