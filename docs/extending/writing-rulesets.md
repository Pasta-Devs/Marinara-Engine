# Writing Game Mode Rulesets

A ruleset tells Game Mode how a tabletop system works: which dice a check rolls, what is on the character sheet, which resources get spent, and what a rest gives back. This guide is for people who want to write their own and share it. To play on a ruleset somebody else made, start with [Choosing rules](../game/getting-started.md#choosing-rules).

A ruleset is one JSON file. It is data, not code. Nothing in it runs, so importing one cannot do anything to your computer. The one part that deserves a careful read before you import somebody else's file is the Game Master text, because that text is sent to the model in every game that uses the ruleset.

## Read this first: what a ruleset can and cannot do

A ruleset can only fill in the blanks of a mechanic the Engine already knows. Today the Engine knows two ways to resolve a check, and your file picks one with `resolution.kind`:

- **`dice-sum`**: roll some dice, add numbers from the sheet, and meet or beat a difficulty. That covers d20 systems, 2d6 plus stat systems, and many others.
- **`dice-pool`**: throw the character's own number of dice and count the ones that reach a target. That covers systems where a rating is a handful of dice rather than a bonus.

Both are described in full under [Resolution kinds](#resolution-kinds).

A mechanic that does not fit either shape cannot be written in a ruleset file. Taking the highest die of a pool, roll-under percentile checks, symbol dice, and opposed pools are examples. Each of those needs a new resolution kind inside the Engine, which is a code contribution with tests, not a JSON file. If your system needs one, open a feature request on the Engine repository and describe the mechanic with a few worked rolls. Those worked rolls become the tests.

Game Mode can resolve a fight using Marinara's own combat or your ruleset's rules. An optional `battle` block lends Marinara's combat the numbers on your character sheets: see [Battles](#battles-lending-the-sheet-to-marinaras-combat). An optional `combat` block instead defines how the ruleset resolves the fight: see [Combat](#combat-a-fight-your-own-rules-resolve). The Engine plays those rules today. The game's Combat Preference selects the Classic presentation or, when the ruleset defines distance, a Tactical battlefield.

## Quickstart

1. Copy the example file that matches how your system rolls. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) is a small 2d6 system with three stats, written to show that nothing in the format assumes a d20 or six abilities. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) is a small ten-sided dice pool with three ratings and six trades. For a full-size example, see the 5e (SRD 5.1) file in [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json).
2. Change `id` to your own. An id is lowercase letters, digits, and single hyphens, such as `ember-roads`.
3. Edit the sheet, the rests, and the Game Master text.
4. Import it (see [Trying your ruleset](#trying-your-ruleset)). The import checks the whole file and tells you what is wrong, line by line, before anything is saved.
5. Create a new game, pick your ruleset under **Rules**, and play a few checks.

For help while you type, point your editor at the JSON Schema by adding this as the first line inside the file's outer braces:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

The schema catches misspelled keys and wrong types as you type. It cannot check that the names in your file point at things that exist, such as a skill naming an ability. The import does that.

You may add a `"$comment": "..."` line to any object in the file to leave yourself a note. The Engine ignores it.

## The parts of the file

| Key             | What it holds                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `schemaVersion` | Always `1`.                                                                                       |
| `id`, `version` | Your ruleset's name for the Engine, and a whole number you raise every time you publish a change. |
| `name`          | What players see in the setup wizard.                                                             |
| `edition`       | Optional. One line about which edition or draft this is.                                          |
| `license`       | Optional. An SPDX id and the attribution text your source requires.                               |
| `coverage`      | What the ruleset handles, plus the one-line summary shown in the setup wizard.                    |
| `resolution`    | How a check or a save is rolled.                                                                  |
| `sheet`         | Everything on the character sheet.                                                                |
| `rests`         | What each kind of rest restores and clears.                                                       |
| `gm`            | The text the Game Master model is given, and which sheet values it sees for each character.       |
| `catalogs`      | Optional. Ready-made entries the sheet editor offers, so players do not type long lists by hand.  |
| `battle`        | Optional. What a battle may read from the sheet, and what it writes back afterwards.              |
| `combat`        | Optional. How a fight is resolved by your own rules, and what the battle screen then plays.       |
| `layers`        | Optional. Variants of your ruleset a player turns on when a game is created.                      |

The file may be up to 256 KB. Text that ends up in a prompt (names, labels, Game Master text) cannot contain line breaks, square brackets, or double curly braces.

Ids inside the sheet (abilities, skills, fields, pools, and so on) are lowercase letters, digits, and underscores, starting with a letter, such as `grit_max`.

### Resolution kinds

`resolution.kind` picks how a check is rolled. Both kinds read the same character sheet and share three keys, so the parts of the file below `resolution` do not change when you switch:

- `abilityModifier`: how a score on the sheet becomes a number. `identity` means the score is the number. `floorHalfMinusTen` is the 5e rule. `stepTable` lets you list your own thresholds as `[[score, number], ...]`.
- `proficiencyTiers`: the training levels a skill or save can have. The first one is what an unlisted skill gets. A tier adds `flat`, or `multiplier` times a proficiency bonus, or both. If your system has a proficiency bonus, name where it comes from with `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: optional, and only needed by a tier that multiplies.

What the resulting number means is the kind's business: `dice-sum` adds it to the roll, `dice-pool` throws that many dice.

#### `dice-sum`: add the dice up

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

- `dice`: how many dice and how many sides. The total is what gets compared to the difficulty.
- `advantage`: whether the Game Master may ask for the dice to be rolled twice and one roll kept.
- `naturals`: what the highest and lowest face of a single die do for checks and for saves: `none`, `both`, `max-only`, or `min-only`. Leave it out for pure arithmetic. It needs a single die, so a 2d6 system has to use `none`.
- `difficultyLadder`: the difficulties the Game Master is told to pick from. `dc` is the number the total must reach.

#### `dice-pool`: throw the dice and count them

The sheet's number is the **size of the pool**, not a bonus on top of it. A rating of 3 and a trade worth 2 throw five dice. That is the whole trick: no new sheet vocabulary, no new editor, and a system whose ratings are handfuls of dice is written with the same `abilities`, `skills` and `proficiencyTiers` as any other.

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

- `die`: how many sides one die of the pool has, from 2 to 100.
- `pool`: the range the sheet's number is held to before anything explodes. A `min` of 0 lets an empty pool fail with no roll at all, and `max` can be 100 at most.
- `target`: the face a die has to reach to count. Write `min` below `max` to let the Game Master move it per check with `threshold=`; write all three the same to fix it.
- `double`: optional. A face at or above `from` counts twice.
- `explode`: optional. A face at or above `from` rolls one more die, and a die added that way can explode in turn. The extra dice are capped at `pool.max` on top of the pool itself, so one check throws at most twice `pool.max` dice and a low `from` cannot roll forever.
- `cancel`: optional. A face at or below `upTo` takes one success away. The count never goes below zero.
- `botch`: optional. When **no** die succeeded and a face at or below `upTo` showed, the check is a critical failure. A pool whose one success was cancelled away has failed, not botched.
- `exceptional`: optional. This many net successes or more, on a check that succeeded, is a critical success.
- `situationalDice`: optional. The range of dice the Game Master may add or take for one check with `bonus=`, for stunts, wounds or bad light.
- `difficultyLadder`: `successes` is how many the check needs. A step may also name a `target`, but only where the target is adjustable and only inside its range.

`cancel` and `botch` faces must be below the lowest target, and every face any of these rules names has to be a face the die actually has. A rule that could never fire is refused at import rather than found in play.

A pool ruleset is Capability API 1.24 for a packaged ruleset. A community ruleset you import is validated by the Engine that reads it, so it needs nothing.

#### What the Game Master may write on a pool check

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc` is the number of **successes** needed, not a target number. It may be anything from 1 up to the most one roll could ever count: the pool's maximum, doubled when dice can explode, and doubled again when faces count twice.
- `threshold=` moves the per-die target, and is only offered while `target.min` is below `target.max`.
- `bonus=` adds or takes dice, and is only offered while `situationalDice` is declared.
- `with=` rolls a skill or save with another ability than its own. It works on both kinds, so a 5e ruleset gets "Strength (Intimidation)" from the same attribute.

Each one is held to what your file declares: a value outside the range is pulled back to the nearest end, and an attribute your ruleset does not offer is ignored rather than refusing the check. The saved record then shows what the roll really used: the threshold and the bonus dice after your limits, and `with=` only when that ability was swapped in. The Engine always throws the dice itself. A pool result the model wrote is replaced, `mode="advantage"` is ignored because the kind has no advantage, and a die the player rolled before the turn does not apply.

#### What is out of scope, and why

Each of these needs its own resolution kind, because none of them can be expressed by counting dice against a target:

- **Take the highest die** (as in Blades in the Dark) needs a partial-success tier that a check result does not have.
- **Stance pools compared to a stat** (as in Lasers and Feelings) decide "over or under" per check, which is a different comparison.
- **Symbol dice** (as in Genesys) do not produce numbers at all.
- **Opposed pools** resolve two characters at once; a check has one roller.
- **Roll-under and open-ended percentile** compare in the other direction.
- **Sum pools with a wild die** (as in OpenD6) add the dice up and treat one of them specially.

Both of the things this kind used to leave out are modelled now, and Spending to change a roll below says how. A rule of the system itself, "spend a point for a success", is `resolution.spend`, which buys successes or dice and never a re-roll. A re-roll belongs to something a character picked, so it is `mechanics.check` on a catalog entry, bought with that entry's own cost.

### Spending to change a roll

Some systems let a player pay for a roll they are about to make: a point of will for an automatic success. `resolution.spend` says so, as a standing rule of the system rather than as something a character went and bought:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` is one of your `live.pools`. It cannot be a pool that starts empty, because there would be nothing in it to spend when play begins.
- `amount` is what ONE purchase costs. `successes` and `dice` are what it buys, and a purchase has to buy at least one of them. Successes are added after the dice are counted, and after any cancelling, because nobody rolled them. Dice are thrown with the pool, inside the pool's own range.
- `perCheck` is how many purchases one check may make, so the most a check can buy is `amount * perCheck` points' worth. That cap is what stops a full pool buying an unlosable roll.
- Only a `dice-pool` ruleset can have one: a summed roll has no successes to add and no pool to add dice to, so a `dice-sum` ruleset that declares `spend` is refused at import.
- Two entries may not name the same pool, or a check could not say which of them it meant.

**It goes on the check itself.** The Game Master writes `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`, not a separate `[sheet:]` command, because the dice are thrown before sheet commands are applied and there would be nothing left to change. One resolution rolls the dice and pays for what changed them.

### A charm that changes a roll

`resolution.spend` is a rule of the system. An entry a character actually PICKED can change a check too, with `mechanics.check` on the catalog entry:

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll` throws the dice at or below `upTo` again. `once` replaces each of them one time and the new face stands; `until` keeps going. `upTo` has to be a face below your die's top one, or it would throw the whole pool again for ever, and the Engine caps how many dice one check may re-throw whatever the file says.
- `dice` adds dice before the pool is thrown, `successes` adds successes after it is counted, and `threshold` sets the per-die target for that one roll, inside the range your `target` allows.
- At least one of the four, or the entry says nothing and is refused.
- Only a `dice-pool` ruleset can honour any of it, so a `dice-sum` ruleset with a `mechanics.check` is refused at import.

**What it costs is the entry's own `cost`,** paid through exactly the machinery that pays for using anything else: the pool, and one use of every counter the same entry wrote. `perCostStep` is what says the entry SCALES; an entry that declares one is bought as many times over as the price was paid, and one that does not is bought once however much was offered.

**The Game Master names it on the check:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Not a separate sheet command, for the same reason as above: the dice are thrown before any bookkeeping runs.

**All or nothing.** If the pool cannot cover it, the purchase does not happen and nothing is deducted: the roll is exactly the one it would have been. Points that are not a whole number of purchases buy nothing either. Asking for more than `perCheck` is clamped rather than refused, and only the cap is paid for. The Engine works all of this out; the Game Master names what the player said they were spending and never touches the dice. The record says what was really paid, which entry was applied, how many successes nobody rolled and how many dice were thrown again. A charm the character has not picked, or one the Engine cannot read the catalog for, does nothing at all rather than being applied on trust.

### The sheet

- `sections` group things in the editor.
- `abilities` are the core scores. `skills` and `saves` each may name the ability they roll with.
- `fields` are single values. Types: `number`, `text`, `longtext`, `boolean`, `enum` (a fixed list of choices), and `dice` (text such as `1d8`).
- `derived` values are worked out from other values and cannot be typed over. The operations are `sum`, `min`, `max`, `scale` (multiply and round), and `stepTable` (look a value up in thresholds, the way a level gives a proficiency bonus).
- `lists` are tables with your own columns, such as gear, spells, or features. A list with `pools` turns every row into a resource with its own maximum, for class features with limited uses.
- `live` is what changes during play: `pools` (hit points, spell slots, Grit), `tracks` (a number on a scale, such as exhaustion, or a wound track of boxes you tick), `text` (short notes such as what a character is concentrating on), and `conditions`.

Anything that reads a number names it with a value reference, which is an object with exactly one key: `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, or `saveMod`. For example, a pool whose maximum is a derived value: `"max": { "derived": "grit_max" }`.

`hideWhen` hides a field, a list, or a pool when another field has a given value. The 5e file uses it to hide spell slots from a character who does not cast spells.

### Wound tracks: health that is a track, not a number

Plenty of systems do not count hit points at all. They have a column of boxes, each worse than the last, and you tick one when you get hurt. Give a `live.tracks` entry `levels` and `kinds` and it stops being a number on a scale and becomes one of those:

**Which shape does your system want?** A pool records how MUCH harm landed; a track records how much AND what kind each piece of it was. If your system says a wound is bashing, lethal or aggravated, and which one it was still matters after the blow, because aggravated heals slower or cannot be soaked or is what finally kills, then that kind has to live somewhere after the roll, and only a mark carries one. A pool of points cannot: once damage is subtracted it is just a smaller number, and nothing on the sheet remembers which points were which. That is why `combat.damageKinds` is refused on a ruleset whose health is a pool rather than being quietly ignored. A pool can still have `damageTypes`, and an opponent can still resist or be immune to them, because that is a question about how much of the blow lands rather than about what the wound is afterwards.

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

- `levels` is 1 to 16 rungs, best first and worst last. Each has a `label` and an integer `penalty` at or below 0. A large negative number is how these systems say "you are out of it", so `-99` is fine.
- `kinds` is 1 to 6 sorts of harm the track can take, each with an `id`, a short `label` for the box, and a `severity`. The severities have to be distinct; the numbers themselves mean nothing beyond their order, so space them however you like.
- The two go together. `kinds` without `levels` is refused, because there would be nothing to mark, and `levels` without `kinds` is refused, because a mark has to be of something.
- **Keep the two words apart.** `kinds` is what your ruleset says a mark may BE. A MARK is one of those kinds sitting on the track during play. The definition holds kinds; a character's sheet holds marks.
- A wound track's length is its levels, so its `min` is 0 and its `max` is `levels.length`. A file that says anything else is refused rather than quietly corrected, so the file can never carry two disagreeing lengths.

**The rules, exactly**, because a vague reading produces the wrong track:

- Marks are held sorted, **most severe first**. A track of seven levels holds at most seven marks.
- A mark is **placed in severity order** among the marks already there, never added to the end. It takes the highest level its severity earns and pushes lighter marks down.
- The penalty in force is the one on the **lowest marked level**, never the sum of the marked ones. Three marks on the track above read `-3`, not `0 + -1 + -3`.
- An `amount` is a number of marks of one kind, **applied one at a time**, so a track that fills partway through is handled by the same rule as one that was already full.
- Marking a **full** track **upgrades its lowest-severity mark by one step** instead of adding a mark. One step up your own ladder of kinds, whatever kind the new mark was.
- A mark that would upgrade past your highest severity is kept at the highest, and the one that could not land is counted as an **overflow**. Overflow is stored, so a reload does not forget harm somebody already took.
- **Healing is the same command with a negative amount.** It clears the lightest marks first, and it clears overflow before it clears any mark.

**Marking it in play.** The Game Master writes `[sheet: op="damage" track="harm" kind="knock" amount="1"]`, and heals with a negative `amount`. The pool form of `damage`, which names `pool=` instead, is unchanged. The plain `track` command is refused on a wound track: a bare number cannot say what the new marks are. The player can also mark and clear boxes by hand on the sheet, which is what these systems expect.

**A fight can mark one too.** Point `combat.health` at the track instead of a pool and the fight
marks it: a blow that lands marks the boxes `combat.damageKinds.marks` says it does, of the kind
that block maps its damage type onto, and a character whose track is full is down, which is what
your dying rule reads. Healing clears one mark. Temporary points are refused, because a track has no buffer for them to sit in. The Engine
reads a track as the levels it has LEFT, so everything else about a fight, going down, being
revived, the log and the recap, is unchanged.

**A rest can heal a wound track.** A restore step naming one with `"to"` clears it down to that many marks, overflow and all; one naming it with `"by"` clears that many, overflow first. A step that would ADD marks does nothing, because a rest names no kind to mark with.

### The penalty on your rolls

`resolution.penaltyFrom` names the wound track whose penalty applies to every check this ruleset rolls. It is declared rather than assumed, so a ruleset that leaves it out rolls exactly as it did before wound tracks existed.

What the penalty DOES is your resolution kind's business, exactly like the sheet's own number:

- Under `dice-pool` it is **dice off the pool**, floored at your own `pool.min`. A `pool.min` of 1 means even somebody on the bottom rung throws one die; a `pool.min` of 0 means they throw none and fail without rolling.
- Under `dice-sum` it is a **flat modifier on the roll**, folded into the same number your ability and training already add.

The track it names has to be a wound track. A plain track carries no penalty to apply, and naming one is refused at import. The result says which penalty was applied, so a player can see why they rolled fewer dice, and the Game Master's own sheet block shows the rung and what it costs.

### Rests

A rest is a list of restore steps and things to clear. Each step names one target (`pool`, `poolGroup`, `listPools`, or `track`) and either sets it (`"to": "max"`, `"to": "min"`, or a number) or changes it (`"by": { "const": 1 }`, or `"by": { "fractionOfMax": 0.5 }`). A step naming a wound track can only heal it; see above.

### Game Master text

- `checkGuidance` replaces the built-in paragraph that tells the Game Master how to ask for a check. Say which system this is and when to call for a roll. The Game Master only names the skill and the difficulty. The Engine rolls the dice and does the arithmetic from the sheet, so do not ask the model to do math.
- `sheetGuidance` introduces the character sheets in the prompt. Use it to say which resources matter and when to spend them.
- `worldGuidance` is optional and is read once, when the world is generated, so the setting the Game Master invents suits your rules: no gunpowder, magic is rare, the dead walk. It never reaches a turn.
- `sheetSummary` chooses which fields, derived values, and list rows the Game Master sees for each character. The Engine always shows ability modifiers, trained skills and saves, and live values. Keep the rest short, because it is sent on every turn.

## Catalogs: ready-made entries for the sheet's lists

Typing a spell list, a gear table, or a page of class features row by row is miserable. A catalog is a named collection of ready-made entries that you ship with the ruleset. The sheet editor offers them in a picker on every list the catalog feeds, and picking one fills the row in.

A catalog is optional. A ruleset may have up to twelve of them, and nothing in the Engine knows what any of them are about: every id, column, filter, and word comes from your file.

### The header

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
- `holds`: `"rows"` (the default, and what every catalog written before this release is) or `"creatures"`. A catalog of creatures is a bestiary a fight reads: it writes nothing onto a sheet, declares no `feeds`, and the picker never offers it. See [Creatures](#creatures-a-bestiary-a-fight-reads) below.
- `feeds`: the lists on your sheet that this catalog's entries may write into, one to eight of them. Required for a catalog of rows and refused on a catalog of creatures. An entry can never write into a list that is not here, and it can never write a value the list's columns could not hold.
- `filters`: optional, up to eight. What the picker can narrow the list by. A filter is a `number`, a `text` value, or `tags` (several words). `startFrom` names a sheet field the picker opens on, so a character whose Calling is Tinker sees Tinker entries first.
- `units`: optional. What a range or an area size in an entry's `mechanics` block means in your system.

### An entry

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

### One entry, several lists

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

### Values the ruleset keeps up to date

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
  matches one spec.

The value is worked out when the sheet is edited and never when it is read, so a stored row is always
the number it says it is. It is fitted to the column it lands in: clamped to the column's `min` and
`max`, and rounded down when the column takes whole numbers. In the example above, a character with
Heart 3 has three uses and one with Heart 0 or less has none. The row stays on their sheet with 0
uses, and because a counter with a maximum of 0 is not a pool, there is nothing to spend in play.

Scaled columns are Capability API 1.23 for a packaged ruleset. A community ruleset you import is
validated by the Engine that reads it, so it needs nothing.

### Picked rows are copies

Each picked row is copied onto the sheet with one extra key, `_catalog`, holding `<catalog id>/<entry id>`. Column ids always start with a letter, so this key can never be one of yours.

The copy is the character's. The player can edit any of it afterwards, the sheet keeps working while your ruleset is not installed, and publishing a new version of the ruleset never rewrites anyone's character. The mark is what the picker reads to show what a sheet already has, and what Refresh reads below.

### Refresh from ruleset

Because a picked row keeps its mark, the sheet editor can tell a player when your newer text differs from what their row holds. A short line under the list says how many rows have newer text, and a **Review** button shows each of them with what the sheet holds beside what the ruleset says, and a tick per row. Nothing is written until the player clicks **Update selected**, and only the columns that differ in the ticked rows are written. Everything else in the row survives, the mark included.

What is compared is deliberately narrow:

- Existing values are compared only in `text`, `longtext`, `dice` and `enum` columns. Existing `number` and `boolean` values belong to the player and are preserved, including 0 and false. A column the row does not yet contain can be offered with its typed value, including numbers and switches. A scaled column is excluded because it already follows the sheet.
- Only columns your entry sets. A column your entry leaves out is never touched, whatever the sheet holds in it.
- A value the column itself would refuse, such as an `enum` value you no longer offer or text past its `maxLength`, is skipped rather than written.
- A row is matched to the entry row it came from by position among the rows carrying the same mark in that list, which holds while the sheet still has as many of them as your entry writes. Otherwise it works only when your entry writes a single row for that list. If a player deleted one row of a two-row entry, that entry is left alone rather than guessed at.
- A row whose entry your catalog no longer has is left alone, silently.

So rewording or renaming an entry can reach characters who already picked it, if they accept it. Changing what a number means cannot, and will not: that column is the player's once the row is theirs.

### `mechanics`: what an entry does in numbers

An entry may carry an optional `mechanics` block that says what it does in numbers: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dice such as `2d6`, or a flat number), `damageType`, `attackRoll`, `autoHit`, `save` (one of your sheet's saves, and what a success does), `applies` (conditions it puts on what it touches), `temporary` (temporary points on the health pool), `scales` (an amount that grows with the sheet), `cost` (which pool using it spends), `perCostStep`, `budget` (which part of the action economy it spends), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` and `check`.

The picker shows this block as one line. Who reads the rest depends on which block your ruleset opted in with:

- With a [`combat` block](#combat-a-fight-your-own-rules-resolve), the fight reads its combat effects. `range`, `area` and `friendlyFire` apply on a battlefield with positions; `reaction` still waits for reaction windows. `check` applies to skill checks, as described above.
- With only a [`battle` block](#battles-lending-the-sheet-to-marinaras-combat), a battle reads `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` and `cost`, because those are the parts Marinara's own combat has somewhere to put.

The vocabulary is closed, so a key or a value that is not in the list above is refused instead of being quietly ignored.

`cost` is also what the Game Master's `use` command pays, outside battle, which is the next section.

### The `use` command: letting the Game Master spend a price you wrote

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
accepted when the cost has exactly one term and the named pool shares that term's group. Anything
else is refused rather than reinterpreted.

It is all or nothing. If any part cannot be paid the whole command is refused, nothing changes, and
the player is told. An entry with no cost at all, such as a cantrip or a passive feature, is accepted
and changes nothing.

### Inline, or a file of its own

A small catalog sits inline in `ruleset.json`, in the header's `entries`. A long one lives in its own file and the header names it with `asset` instead. A catalog has exactly one of the two.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

The path is always `catalogs/<the catalog's id>.json`. The file itself looks like this:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Separate catalog files are for packages published through the official catalog: the package lists the file in `contributions.assets.paths` beside `ruleset.json`, and it needs Capability API 1.21. A catalog of creatures, inline or in its own file, needs Capability API 1.27. **A ruleset you import as a single file, or share through a GitHub repository, carries its catalogs inline**, which means they have to fit inside the 256 KB limit on the whole ruleset file. That is room for a few hundred short entries.

The limits are 12 catalogs per ruleset, 2000 entries per catalog either way, and 1 MB for one catalog file.

## Battles: lending the sheet to Marinara's combat

By default a battle knows nothing about the sheet. It builds its fighters the way it always has, and
a character can walk out of a fight with their hit points on the sheet untouched.

An optional `battle` block changes that, in one direction only: it lends the fight the sheet's
numbers, and writes the fight's outcome back. **It does not make combat follow your rules.** The
dice math is still Marinara's, and so is who hits whom and for how much. Because of that, health is
carried as a share of the maximum rather than as your own number: a character at half health on the
sheet starts the fight at half of the health bar Marinara built for them. Your 9-point health pool
is never dropped into a fight where one blow does 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: required. The live pool that is the character's hit points in a fight. It must be one of
  the pools in `sheet.live.pools`, not a list whose rows are pools.
- `energy`: optional. A live pool the fight may spend, which becomes the MP bar. It has to be a
  different pool from `health`, because a fight cannot spend hit points as fuel.
- `slots`: optional. Live pools that a fight spends one at a time, each with a `level` from 1 to 9:
  `[{ "pool": "slots_1", "level": 1 }]`. Levels and pools are each used once.
- `skills`: optional, up to eight. The sheet lists whose rows become the character's combat skills.
  Only rows that came from one of your catalogs count, and only when the entry behind the row has a
  `mechanics` block: a row somebody typed by hand says nothing in numbers. `onlyWhen` names a boolean
  column the row must have set, such as a prepared spell. `alwaysWhen` names a column and a value
  that lets a row through anyway, such as the spells that are cast without being prepared. It is
  the exception to `onlyWhen`, so it is refused without one beside it.

### What is carried in, and what is carried out

**In**, for each party member whose sheet the game has: the health pool's share of its maximum sets
where the fighter starts on Marinara's own health bar, the energy pool becomes MP, each slot pool
becomes that level's slots, and the marked rows become skills. Maximum hit points, attack, defense,
speed and level stay Marinara's own numbers. A character at zero in the health pool starts the fight
down, because that is what the sheet says, and a character above zero never starts below one hit
point, so a small share cannot knock somebody out by rounding.

**Out**, once the fight is over: the share of the health bar the fighter ended on is read back onto
the health pool's own scale, and the difference from where the fight began is applied as damage or
healing. Energy and slots are counts, not shares, so they are written back as they are. Everything
goes through the same rules the sheet's own buttons follow, and a change the sheet refuses is
skipped and reported rather than forced. A fight that did not move a fighter's hit points writes no
health change at all, so the two conversions can never move a sheet by themselves.

**Neither**: attack rolls, saving throws, concentration, and what a higher cost would add. Those are
in the `mechanics` block for a real combat system to read one day; this bridge does not apply them,
and a ruleset should not claim it does.

An abandoned battle writes nothing back. If you delete the message the fight started in, or the
fight never reaches its end, the sheet is exactly as it was: the fight did not happen.

### How an entry becomes a skill

A catalog entry's `mechanics` block is read like this:

- `kind` becomes the skill's type. `utility` entries and anything marked `reaction` are left out,
  because Marinara's combat has nowhere to put them.
- `amount` sets how hard it lands, as a multiplier against the fighter's own attack rather than as a
  damage number. Bigger dice never land softer, and the multiplier stays inside the range a
  generated skill already uses.
- `range` and `area.size` are divided by the catalog's `units.distance.perCell` to get grid cells,
  and never round down to nothing. A burst becomes its radius, a cone half of it, and a line one
  cell. Anything with an area targets every enemy it covers, and `friendlyFire` is honoured.
- `damageType` becomes the skill's element. `targets` is not carried: Marinara's combat decides who
  a heal, a buff or an attack can be pointed at from the skill's type.
- `cost` on the energy pool becomes the MP cost, and several energy costs are added up. A `cost` of
  exactly one slot spends one slot of that level. Marinara's combat charges one number of energy
  or one slot, never both, so an entry that costs two slots, slots of two levels, or a slot plus
  energy is left out of the fight. So is a cost on any other pool, such as hit points or a class
  resource, because the Engine would otherwise hand it out for free.
- A `buff` or a `debuff` becomes Marinara's own buff or debuff. Whatever else the entry's text
  promises, such as clearing a condition on the sheet, is not applied in the fight. Leave
  `mechanics` off an entry whose effect only makes sense outside a battle.

`coverage.combat` is separate and still means what it meant: set it only when battles really do
follow your system's rules.

## Combat: a fight your own rules resolve

The `battle` block above lends a fight the sheet's numbers while the arithmetic stays Marinara's.
The optional `combat` block is the other thing: it says how a fight is RESOLVED by your rules. It
parameterises a combat kind the Engine owns, exactly as `resolution` parameterises a check kind, and
every name in it is yours. There is one kind today.

**A game whose ruleset declares `combat` fights by your block.** The party's numbers are read off
their own sheets, the opponents come out of your bestiary or off your threat scale, every turn is
resolved by your dice, and everything a character spends or loses is written back to their sheet as
it happens, so closing the tab mid-fight loses nothing. The battle screen plays it in your words:
your attacks and abilities as the menu, your budgets, your conditions, and a log with the real
arithmetic. What it does not do yet is listed under Not yet.

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

That is the whole Ember Roads block, and a game on Ember Roads fights by it. The 5e draft uses the
same keys for a d20 system:

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

### Every key

- `kind`: `"attack-vs-defense"`. One side rolls dice against the other's defense; a hit does damage.
- `health`: required. What a fight takes away. Either `{ "pool": "grit" }`, a live pool it counts
  down, whose temporary buffer if it has one is what damage drains first; or `{ "track": "harm" }`,
  a wound track it MARKS. A track needs `damageKinds` beside it, and grants no temporary points.
- `defense`: required, a value reference. A field the player enters, or a derived value you compute.
- `initiative`: required. The dice rolled once at the start, and an optional modifier reference. A
  tie goes to the higher modifier, and then to the order the fight was set up in.
- `attackRoll`: required. The dice, whether the system rolls twice and keeps one (`advantage`), what
  the extreme faces of a single die do (`naturals.max`: `critical`, `hit` or `none`; `naturals.min`:
  `miss` or `none`), and what a critical hit does to the damage (`critical`: `double-dice` rolls the
  damage dice again, `max-dice` adds their highest faces once, `none` is a plain hit). Lucky faces
  need a single die, exactly as they do for checks. Saving throws inside a fight roll these same
  dice.
- `economy`: required. `budgets` is what a turn may hold: an id, a label, `per` (`turn` refills at
  the start of the holder's own turn, `round` when a new round begins) and a `count`. The FIRST
  budget you declare is the main one, and is what a standard action spends. `movement` is an
  optional value reference: how far one turn may walk, in your own distance unit. It is read by a
  fight on a board (see Positions).
- `attacks`: optional. Sheet lists whose rows are weapons. `name` is the text column the row is
  named by, `damage.dice` the dice column, and each of `toHit.ability`, `toHit.proficiency`,
  `toHit.bonus`, `damage.ability`, `damage.bonus` and `damage.type` names a column of the same list.
  An `ability` column is an `enum` holding one of your ability ids; a value that is not one adds
  nothing. A `proficiency` column is a `boolean`, and where it is set your proficiency bonus is
  added. A row with no readable dice is not an attack, so rope in the same list is just rope.
  `strikes` is an optional value reference saying how many strikes ONE spend of this list's budget
  buys: taking a row with none in hand spends the budget and puts the rest in hand, and while any
  are in hand every row that declares `strikes` costs no budget at all, so a different weapon, a
  different target and a walk between them all fall out of the menu on their own. `strikesCappedBy`
  names a boolean column that holds ITS OWN row to a single strike however many the list buys, for
  the weapons that fire once a turn whatever their wielder's count: SRD 5.1's Loading property is
  the sentence it exists for. It is meaningless, and refused, on a list that buys one strike a
  spend anyway. The strikes in
  hand are the COMBATANT's, not one list's: a character whose two weapon lists both declare
  `strikes` spends from the same handful whichever row they swing. They are cleared at the end of
  the turn that bought them. A list that says nothing buys one strike a spend, which is what
  every fight did before this existed.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: optional. Sheet lists whose catalog-marked rows are abilities, filtered exactly as
  `battle.skills` are with `onlyWhen` and `alwaysWhen`. What each one does is that entry's own
  `mechanics`; the block says which `budget` they spend by default, the `toHit` an entry that rolls
  to hit adds, and the `saveDifficulty` an entry's save is rolled against. An entry that asks for a
  save, its own or one that ends a condition it applies, is refused when the list it lands in has
  no `saveDifficulty`: a save against nothing would always succeed.
- `standard`: optional, from the closed list `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`.
  `dodge` (attacks against the dodger are rolled twice and the worse kept) and `help` (the helped
  ally's next attack is rolled twice and the better kept) are always resolved. `dash` (the same
  movement allowance again) and `disengage` (nobody strikes at you for walking away this turn) are
  resolved on a board and recorded off one. `hide` and `ready` are accepted and do nothing yet.
- `standardEffects`: optional, for the part of a standard action its flag does not carry. Only
  `dodge` has one today: `{ "dodge": { "saves": ["dex_save"] } }` says which of your saves a dodger
  rolls twice, keeping the better, for as long as the dodge lasts. Name only saves your sheet
  declares, and only when your `standard` list has `dodge`. Leave it out and dodging is exactly what
  it was: harder to hit, and nothing else.
- `conditions`: optional. Maps YOUR condition ids onto what they do, so the sheet's conditions and
  the fight's are one record and a poisoned character is still poisoned afterwards. The effects are
  a closed list: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`,
  `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`,
  `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`,
  `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`,
  `own-saves-disadvantage`, `resist-all`, `cannot-target-source` and `cannot-approach-source`.
  `failsSaves` names saves the condition fails without rolling. The six that need distance or
  movement (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`,
  `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`)
  are read by a fight on a board and say nothing in one without (see Positions). `cannot-react` is
  read only for a strike at somebody walking away; the reaction window it will also gate is a later
  release. Three more keys sit beside the effects:
  - `saves`: which of your saves the two save effects are about. All of them when it is left out,
    and naming it without one of those two effects is refused.
  - `whileSourceInSight`: what counts only while whoever applied it is in the holder's line of
    sight. `true` gates the whole condition; a list of its own effects gates only those and leaves
    the rest standing, which is what a fright that stops you walking any nearer whether or not you
    can see it needs. Naming an effect the condition does not have is refused. Without a board there
    is no line to break, so everything counts either way.
  - `endsWhenSourceDown`: it comes off the moment whoever applied it goes down.

  `own-saves-advantage` and its opposite roll the save twice and keep one, exactly as an attack is
  rolled, and they cancel each other out. `resist-all` halves every kind of harm on top of whatever
  the target's own hide said, and cancels against a vulnerability the same way.
  `cannot-target-source` keeps the holder from pointing anything at whoever put it on them, and
  `cannot-approach-source` keeps them from walking any nearer to that somebody than the cell they
  stand in, the route included: a way round to a cell just as far off is still offered, and one
  that would dip past them and come out the other side is not.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration`: optional. The live `text` field that records what is being held, the `save` that
  damage forces, the `floor` under that difficulty, and `fromDamage`, the share of the damage taken
  that sets it when it is higher. Starting a second ability that concentrates ends the first, and
  losing the save ends it and takes the conditions it was holding with it.
- `dying`: optional, `kind: "saves"`. The two tracks that count the rolls (how many it takes is each
  track's own maximum), the `dice`, `succeedAt`, what the extreme faces do (`naturals.max`:
  `revive-1` or `success`; `naturals.min`: `one-failure` or `two-failures`), what damage while down
  costs (`damageWhileDown`, `criticalWhileDown`) and the `condition` a downed character is in.
  Without this block a character at zero is simply down, and healing brings them back.
- `damageTypes`: optional. The types your system has, matched without case.
- `damageKinds`: required when `health` names a wound track, and refused when it names a pool,
  because only a mark carries a kind and a pool of points has nowhere to keep one (see Wound tracks
  above). It says which of the track's `kinds` a blow marks and how many boxes it ticks. `default` is what
  anything unmapped lands as, including a blow that carries no type at all, and `byType` maps your
  own `damageTypes` onto kinds, with its keys matched without case as the types themselves are, so
  `"Fire"` and `"fire"` are one key and naming both is refused. `marks` has no default because the
  two answers are opposite:
  `"per-point"` where your damage roll counts health levels, so a blow for three ticks three boxes
  and softening one is worth doing, and `"per-blow"` where a blow either lands or does not, so it
  ticks one box however hard it hit. A blow with several damage clauses still marks one box, using
  the most severe kind that landed. Say which your system is.
  `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `threat`: optional, and needed by a bestiary. `tiers`, the scale an opponent is picked from: an id,
  a label, a `health` band, a `defense`, a `toHit`, a `damagePerRound` band and a `saveDifficulty`.
  Every creature you ship names one of these tiers, and an opponent nobody wrote is pulled onto the
  one the Game Master asked for, so nothing lands off your scale. The `damagePerRound` band is read
  as what a creature does to ONE target in a round, its whole sequence included.

### What a fight reads from `mechanics`

`kind` decides whether the `amount` is damage or healing; anything marked `reaction` is left off the
menu, and so is a `utility` entry unless it changes what the turn itself may hold (see below).
`attackRoll` makes it roll against the target's defense with the
list's `toHit`; `autoHit` skips that entirely. `save` rolls the target's own save against the list's
`saveDifficulty`, and `onSuccess` decides whether a success takes half or nothing. `targetCount` is
how many it may be pointed at. An ability that rolls no attack (an area everyone saves against,
something that simply hits) rolls its dice ONCE for all of them, and one that rolls to hit each
target rolls its dice again for each hit. `applies` puts conditions on what it
affects, each with a `duration` of `instant` (no clock of its own: it stays until something takes it
off), `until-save` (which needs `saveEnds` beside it) or `{ "rounds": n }`, and an optional
`saveEnds` naming the save and whether it is repeated at `turn-end` or `turn-start`. `temporary`
grants temporary points on the health pool, and they never stack: the bigger buffer stands.
`scales` grows the amount by the extra DICE its table gives for the value it reads. `cost` is paid
through the sheet's own `use` command, and `budget` overrides which part of the economy it spends.

`plus` is up to three MORE amounts on the same blow, beside `amount`, each one rolled and typed on
its own ("and 2d6 fire"). A clause is `{ "dice": "2d6", "flat": 1, "type": "fire" }` and may carry a
`save` of its own, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, which
the TARGET rolls whatever the action already asked them for: `none` leaves nothing of that clause on
a success and `half` leaves half of it, and the rest of the blow is untouched either way. Without a
`difficulty` it falls back to the number the action's own save uses, and then to the list's
`saveDifficulty`. A critical doubles every clause's dice by the same rule it doubles the first
amount's, a clause with no `type` is the blow's own kind of harm, and the whole blow is still ONE
check against concentration, with the summed damage, and one check for going down. A clause needs an
`amount` to ride, and a `heal` carries none.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Three keys say what an entry does to the turn's own economy, and a `utility` entry that declares any
of them is offered rather than dropped:

- `free`: it costs no budget at all. It still pays whatever `cost` it names, and it may not also
  name a `budget`.
- `gives`: `[{ "budget": "action", "count": 1 }]`, up to four. Using it adds to those budgets the
  moment it is used, capped where they land at what a turn holds plus the gift, so nothing can be
  saved up for a later turn.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Its holder may take
  those standard actions for THAT budget. They are offered beside the ordinary ones as
  `standard:<id>@<budget>`, and the entry itself stays off the menu when that permission is all it
  is, because a permission is not something anybody takes.

An entry of the new `kind: "rider"` is PASSIVE: nobody takes it, it is never on the menu, and it
adds one more damage clause to the first qualifying hit of a period, automatically. It carries
`rider` and nothing else that would be taken:

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

`sources` names the attack lists it comes off and `requires` one truthy column of their rows, so a
rider that only fires with certain weapons says which without the Engine knowing what a weapon is;
naming neither means any hit its holder lands. `when` is ANY-of: `advantage` is how the attack roll
finally leaned, and `ally-adjacent` is a standing ally of the attacker who can act, within one cell
of the target on a board and anywhere at all without one. `oncePer` is `turn` (fresh at the start of
every turn there is, so a strike made while somebody else acts can still carry one) or `round`.
`amount` grows with the entry's own `scales`, and `type` is the kind of harm, defaulting to the
blow's own.

### Creatures: a bestiary a fight reads

A catalog that declares `"holds": "creatures"` carries opponents instead of sheet rows. It feeds no
list, the sheet editor's picker never offers it, and every number in it is written in the keys your
`combat` block already declares. It needs a `combat` block and a `threat` scale, because a creature
is filed under one of your own tiers.

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

- `health`: a number, or `{ "dice": "3d6", "flat": 2 }` thrown once when the fight is created. A
  forecast reads the average, so a menu never promises a die nobody has thrown.
- `defense`, `initiativeModifier`, `speed`: what an attack is rolled against, what it adds to
  initiative, and how far it walks in one turn, in your own distance unit.
- `abilities` and `saves`: keyed by the ability ids and save ids your sheet declares. A save it does
  not name reads as zero.
- `resist`, `vulnerable`, `immune`: damage types, matched without case, and checked against
  `combat.damageTypes` when you declare any. `conditionImmunities` names your own conditions.
- `tier`: which rung of `combat.threat` it belongs to.
- `traits`: short name and text pairs the Game Master is shown. They are never resolved, so
  anything with numbers in it belongs in an action.
- `signaturePoints`: points given back at the start of its own turn, spent on `signature` actions.
- `riders`: up to four, the same thing a catalog entry's `rider` is, written on the block. Each one
  is `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`,
  with an optional `type` and an optional `actions` naming which of this block's own actions it
  fires on. A creature has no sheet list to read, so `sources` and `requires` are the two keys it
  does not have.
- `actions`: up to twelve, each with an `id` of its own. An action carries what a hand-written stat
  block carries (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`)
  plus four things only a creature has. `reach` is how far it strikes, `range` how far it is thrown
  or shot and `area` the shape it lands in, all in your own distance unit; `range` may be a plain
  number, or `{ "normal": 30, "long": 120 }` when it still carries further at a penalty, and `area`
  is `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (see Positions):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. When they run out the action leaves the
    menu.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. It starts the fight available,
    is spent when used, and at the start of the creature's own turn it rolls: `from` or higher
    brings it back. The log carries the dice either way.
  - `sequence`: other actions of the same block, in order, each with its own target. **This is how
    a creature that strikes twice in one action is written.** One budget pays for the whole
    sequence. A sequence carries nothing of its own and may never name another sequence.
  - `signature`: `{ "cost": n }`, bought with the creature's own points instead of a budget, and
    only while somebody else is acting. Stored, priced and spent today; see Not yet below.
- A save needs a difficulty on the action itself: `save.difficulty` for a save the action forces, or
  `saveDifficulty` for a condition that ends on a save when the action has no save of its own. A
  stat block is not a character sheet, so there is nowhere else for that number to come from. A
  clause's own save may leave its `difficulty` out and fall back to that same number.
- `damage.plus` is the same list of clauses a catalog entry's `plus` is, and reads exactly the same
  way: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }`
  is a bite that carries the heat as its own amount, resisted on its own and doubled on its own.

The 5e draft's own bestiary is four hand-written creatures in
`docs/development/ruleset-5e-2014.example.json`, covering a sequence, a recharge, a save with a
condition, resistances and immunities, limited uses and signature points.

#### Opponents nobody wrote

When a Game Master invents an opponent, the Engine pulls the proposal onto your `threat` scale
before anything rolls: health into the tier's band, defense, to-hit and save difficulties to at most
two above the tier's own, and the damage scaled down until the creature's best round (its heaviest
sequence, or its heaviest single action, measured against one target) is inside the tier's
`damagePerRound`. It takes off the dice count first, then the flat part, then a strike from a
sequence, and only then the size of the die, and never scales anything down to nothing. Names your
ruleset does not have are dropped: unknown damage types, conditions and saves, and anything past the
first six actions. A tier you never declared falls back to the bottom of your scale. Every change
comes back as a plain sentence, so a log can say what it did.

Your own bestiary is never clamped. It is data you wrote, so the Engine takes it as written.

### Positions: a fight on a board

A fight is theatre of the mind until your block says what one cell of a board is worth. Declare
`distance` and it can be fought on a grid, and then movement, reach, ranges, areas, line of sight,
cover and strikes at somebody walking away all start to mean something. Every one of them is a
number you wrote; the Engine supplies the board and nothing else.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2 },
"opportunity": { "budget": "reaction" }
```

Ember Roads declares one line of it and nothing else, which is the point: none of the rest is
required.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**The cell.** `distance.perCell` is how much of YOUR unit one cell is worth, and `label` is what you
call that unit. Every distance in the block's world is in it: `economy.movement`, a creature's
`speed`, a weapon's `reach` and `range`, and a creature action's `reach` and `range`. A catalog that
declares its own `units.distance` converts its own `mechanics.range` and `area.size` with its own
`perCell`; one that does not uses this. A distance above zero is rounded to the nearest cell and
never to none, so anything you gave a number to reaches at least one. Zero is not a short distance,
it keeps its own meaning: a `mechanics.range` of 0 is self or touch (and a touch on somebody else
reaches the next cell), and a weapon `reach` or `range` column reading 0 on a row means that row
has no such distance.

**Whether a fight is on a board.** Two things have to agree: your block declares `distance`, and the
player's game is set to the Tactical combat style. With the Classic style, or on a ruleset without
`distance`, the fight is theatre of the mind exactly as it was: anybody can be pointed at anybody,
and nothing below is read at all.

**What the player sees.** The board is drawn, with the tactical style's own terrain. Every square is
a button, reachable with the pointer or the arrow keys, and says what it is, who is on it and what
the half-made choice makes of it. Walking lights up the squares the menu offered, each carrying its
cost IN YOUR UNIT, draws the way there, and marks in amber any square whose path somebody would
strike at, naming them under the board. An option that takes a target lights up who may be chosen,
on the board and in the list at once. An option with an `area` is aimed at a square, and the square
under the pointer says who it would catch, friends included. What is left of the allowance is shown
beside your budgets, again in your unit. None of it is measured by the screen: every square, cost,
path, target and aim is sent by the server.

**Movement.** A turn's allowance is `economy.movement` for a party member, or the creature's own
`speed`, divided by `perCell` and rounded DOWN, and never less than one cell while it can move at
all. It refills at the start of its holder's own turn and may be spent before, between and after
actions: walk, strike, walk again. A cell costs one to step onto, or more for rough ground. Eight
directions, all at the same cost, because that is how the tabletop grids this is for are played. A
friend may be walked past and nobody may be stopped on; an opponent is a wall; nothing solid may be
entered and no corner may be cut between two solid cells.

**Reach and range.** A weapon row gets them from `combat.attacks[].reach` and `.range`, each a
column of that same list or the same number on every row:

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

A column that reads 0 on a row is that row saying it carries no such distance, which is how an
ordinary sword sits in the same list as a thrown axe. A row with no reach at all reaches one cell.
A creature action uses its own `reach` or `range`, and a catalog ability uses `mechanics.range`
(0 is self or touch, which is one cell when it is aimed at somebody else).

A row with BOTH is a thrown weapon: inside its reach it is a swing, beyond it a shot. So the rules
below for a shot do not touch it in somebody's hand, and it is something to strike a passer-by with,
which a bow is not.

A creature action may also carry the `area` it lands in, in your own unit: `{ "shape": "cone",
"size": 15 }`, with `"friendlyFire": false` to spare its own side. That is how a breath weapon is a
real cone on a board rather than a number of targets. A sequence carries no shape of its own; the
actions it names carry theirs. A fight without a board ignores the shape and uses `targetCount`, so
a creature entry can carry both and be honest either way.

**How far a shape may be sent.** `range` says it: a ball thrown a hundred feet carries one. With no
range, a burst goes off where it is set down, on the actor's own cell, and a cone or a line may be
aimed anywhere within the length it draws, because there the cell only says which way it points.
That holds for a catalog entry's `mechanics.area` as much as for a creature's.

`ranged` says what a shot costs when it is taken past its ordinary `normal` distance, or with
somebody on the other side in the next cell. Each is `"disadvantage"` or `"normal"`; leave the block
out and neither costs anything. A swing is never a shot, so neither rule touches it, and neither
does a thrown weapon used within its own reach.

**Areas.** An entry's `mechanics.area` becomes a real shape on the board, aimed at a cell rather
than at anybody, and `targetCount` says nothing about it: the shape decides how many it reaches.
Everybody standing in the cells is caught, friend and foe, unless the entry says
`"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

A burst is every cell within its size of the cell it was aimed at. A cone runs from the actor toward
that cell, as wide at each step as it is far. A line runs the same way, one cell wide. All three
stop at anything solid.

**Line of sight and cover.** A straight line of cells between the two of them: anything solid on it
blocks a shot and stops an area spreading past it, and the target simply is not on the menu. Ground
that is worth something as cover adds `cover.bonus` to the defense the attack is rolled against, and
the log says so. There is no three-quarter cover, no total cover and no elevation.

**Strikes at somebody walking away.** Declare `opportunity.budget` and, when a combatant walks out
of the reach of a standing enemy who can act, has that budget and has something melee to strike
with, that enemy strikes once with its best melee attack BEFORE the mover leaves the cell, and
spends the budget. `disengage` prevents it for the rest of the turn, and a strike that drops the
mover ends the walk where they fell. It is automatic for everybody, the party included, and said in
the log; CHOOSING whether to take it is a reaction window, and that is a later release. A ruleset
that declares no `opportunity` has none of this at all.

**What an opponent does with a board.** An opponent nobody plays weighs every cell it can reach
against every option it could take from there, subtracts for each strike the walk would be met by,
and prefers not to move when it can already do its best from where it stands. With nothing in reach
it closes the distance, and sprints first when your `standard` list has `dash`.

**Refusals you may see.** `out-of-reach` (further off than this reaches), `no-line-of-sight`
(something solid in the way), `unreachable` (a cell the walk cannot pay for or cannot end on) and
`bad-cell` (a shape aimed somewhere it may not be aimed).

### What a fight does with your block on the server

A game whose ruleset declares `combat` gets a fight resolved by it, on the same saved battle the
Engine has always used:

- **Who is in it.** The Game Master says who is fighting; the Engine reads each party member's
  numbers off their own sheet. A member with no sheet for your ruleset is refused by name rather
  than given numbers you did not write.
- **Where an opponent's numbers come from**, in this order: the creature the Game Master named in
  your bestiary, then one whose label matches the opponent's own name, then a stat block the Game
  Master proposed for this fight, pulled onto your threat scale by the clamp, and last a plain
  creature built from the rung's own numbers. Every fallback and every clamp is recorded in plain
  words so the fight can say what it did. A ruleset with no bestiary entry, no proposal and no
  threat scale refuses the fight instead of inventing one.
- **Your sheets are the record.** Health, pools, conditions, concentration and the counts of your
  dying rule are written through the sheet's own rules after every accepted action, so a reload
  mid-fight shows exactly what the fight left, and there is no end-of-battle tally that could
  disagree with it.
- **Your menu is the only legality.** Everything that acts, a player or an opponent, picks an id off
  the same menu your block produces. An opponent the Engine plays chooses from it with the Engine's
  own tactics, and an opponent the Game Master plays is asked to pick one id from that same menu,
  shown your numbers and never told what the dice will do.
- **Your dice.** A fight carries its own seed and a cursor, so a fight read back off disk carries on
  with the dice it would have thrown.

### On screen

The fight plays on the battle screen in your words. The menu is your attacks,
your abilities and the standard actions you listed, each saying what it spends out of your budgets
and your pools. Turn order, the round, every condition you named with its rounds left, temporary
points, concentration, and the two counts of your dying rule are all shown. The log prints the real
arithmetic in your terms: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard
6, a hit." Every accepted action is written to the sheet as it happens, so a reload mid-fight is
exact and the Game Master is told afterwards not to change those numbers again.

A fight with positions is drawn on the board instead of on the portrait stage; see Positions for
what the player does with it. Every distance on it, in the menu and in the log, is said in YOUR
unit: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Not yet

Said plainly, because a ruleset should not claim what the Engine does not do:

- **Beyond the modest board**: no three-quarter or total cover, no elevation, no flying over
  obstacles, no squeezing, no mounts, no grapple or shove movement, no hiding or surprise, and
  nothing pushes anybody anywhere.
- **No reactions**, so nothing interrupts a turn. Choosing whether to strike at somebody walking
  away is a reaction window, so that strike is automatic today; `cannot-react` is read for it and
  for nothing else yet.
- **Signature actions are stored, priced and resolved, but nothing opens the window they are used
  in.** The points, the options and the spending are all here; what asks a creature for one between
  one turn and the next arrives with reactions.
- Conditions do what the closed effect list can say and no more. A condition that gives
  disadvantage on ability CHECKS, or one that gets worse in levels the way exhaustion does, is a
  plain record on the sheet today.
- **Creature stat-block resistances, vulnerabilities and immunities do not describe a wound track.** They live on an
  opponent's stat block, and an opponent has no sheet to mark, so a ruleset whose health is a track
  cannot soften a blow by its kind. What each kind of harm MARKS is `damageKinds`, which is a
  different question from how much of it lands. A condition with `resist-all` can still reduce damage before it marks a wound.
- **A rider fires by itself.** Choosing when to spend one is a window, so the first qualifying hit
  of the period takes it. `on` has one value, `hit`; the rest of the moments arrive with reactions.

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

**What a layer cannot do.** It cannot add an enum value, add a field, a skill, a pool or a rest,
change the resolution kind, touch live state or combat numbers, or add a model call. A value a
layer _added_ would be unknown to every other reader of the sheet, so values only ever go away.
Anything beyond this list is a change to the ruleset itself, or a second ruleset.

**Conflicts.** `conflicts` names layers that cannot be on together. Naming one side of the pair is
enough. The wizard disables the other toggle, and if a saved choice somehow has both, the one
declared **later** is dropped, so the same two choices always give the same rules.

**A sheet that already holds a removed value keeps it.** Nothing rewrites a character. The editor
simply stops offering the value, and a character who already had it shows it as what it is. Turn
the layer off in a new game and the value is offered again. The same is true of a hidden catalog
entry: it is left out of the picker, and a row a player already picked stays on the sheet.

**Limits.** 12 layers per ruleset, and 4000 characters of guidance per layer counting both strings
together. A packaged ruleset that declares `layers`, or a base `gm.worldGuidance`, needs Capability
API 1.25. A ruleset you import is validated by the Engine that reads it, so it needs nothing.

**Layers written by somebody else** (a Low Magic layer for a ruleset you did not write, shipped in
its own file) are a later addition. Today a layer ships inside the ruleset it belongs to.

## Trying your ruleset

Community rulesets use the same switch as imported agents. Open **Settings** > **Advanced** > **Danger Zone** and make sure **Allow custom Agent imports** is on. Importing also needs localhost access or configured **Admin Access**.

1. Open the **Agents** panel and choose the **Import agents** button (the download icon in the row of buttons at the top of the panel).
2. Pick **Game Mode ruleset** and choose your JSON file.
3. Read the review. It shows the name, version, license, what the ruleset covers, and the Game Master text. Choose **Import**.

Your ruleset appears in the panel's **Rules** section and in the setup wizard's **Rules** choice for new games. A ruleset imported from a file is filed as `local/<your id>`, so it can never be confused with an official ruleset or with somebody else's.

### Changing a ruleset you already imported

A version that has been imported is never rewritten. If you change the file and import it again with the same `version`, the import is refused and asks you to raise the number. This is on purpose: a game is tied to the exact version it was created on, so a running campaign never wakes up on different math.

So the loop while you are drafting is: edit, raise `version`, import, start a new game. Old versions stay installed beside the new one until you remove the ruleset from the **Rules** section. Removing a ruleset that a game still uses makes that game say its ruleset is missing until you import it again.

If you change the shape of the sheet (add, remove, or rename things), raise `sheet.version` too. Existing sheets are read tolerantly: values the new sheet does not know are kept, and missing ones take their defaults.

## Sharing your ruleset

**As a file.** Send the JSON file to a friend. They import it the same way you did.

**From a GitHub repository.** If you keep your work in a public GitHub repository, put each ruleset in a `rulesets` folder at the top of the repository, one file per ruleset:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

A user adds your repository once through the custom agent repository list, reviews what it holds, and can sync later to receive new versions. The custom repository list is an advanced feature that the person running the server has to turn on with `ENABLE_CUSTOM_AGENT_REPOS=true`. Rulesets from a repository are filed under the repository owner's name, such as `alice/ember-roads`, so two authors can both publish a ruleset called `v20` without clashing.

Two limits apply. A repository can hold at most 32 JSON files directly inside `rulesets`, and one with more is refused. An account named `local` cannot publish rulesets, because `local/` is kept for rulesets imported from a file.

**In the official catalog.** A widely played system with clean licensing can be offered to everyone through **Download Agents**. That is a pull request to the [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) repository. Look at the `ruleset-5e-2014` package there for the layout.

## Licensing

Only publish rules text you have the right to share. Many systems publish a reference document under an open license, and that document is what you may copy from. Put the license id and the attribution text the license asks for under `license`. Do not copy text from rulebooks that are not openly licensed. A ruleset mostly needs names and numbers, and the Game Master text should be your own words.

## Troubleshooting

- **The import says a name does not exist.** Something in the file points at an id that is not declared, such as a skill naming an ability you removed. The message gives the path to the line.
- **The import says a version is already installed with different contents.** Raise `version` and import again.
- **My ruleset is missing from the setup wizard.** Check that **Allow custom Agent imports** is on. While it is off, imported rulesets are left out of new games. Games that already use one keep working.
- **A game says its ruleset is missing.** The exact version the game was created on is not installed. Import that version of the file again.
