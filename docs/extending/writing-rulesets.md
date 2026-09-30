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
| `items`         | Optional. The words your items are written in: categories, rarities, stats, slots, money.        |
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
- `difficultyLadder`: the difficulties the Game Master is told to pick from. `dc` is the number the total must reach. The Game Master may name a step instead of writing its number, as `difficulty="Hard"`, and the Engine reads the number off the step.

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
  "pool": { "min": 1, "max": 15, "abilityPlusAbility": true },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10, "min": 8 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "reroll": [{ "id": "careful", "upTo": 6, "mode": "once" }],
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: how many sides one die of the pool has, from 2 to 100.
- `pool`: the range the sheet's number is held to before anything explodes. A `min` of 0 lets an empty pool fail with no roll at all, and `max` can be 100 at most. `abilityPlusAbility: true` lets an ability check name a second ability with `with=` and throw both, for systems that roll two attributes together; without it `with=` means nothing on an ability check.
- `target`: the face a die has to reach to count. Write `min` below `max` to let the Game Master move it per check with `threshold=`; write all three the same to fix it.
- `double`: optional. A face at or above `from` counts twice.
- `explode`: optional. A face at or above `from` rolls one more die, and a die added that way can explode in turn. The extra dice are capped at `pool.max` on top of the pool itself, so one check throws at most twice `pool.max` dice and a low `from` cannot roll forever.
- Both may carry a `min`: the lowest face a check may move the rule down to, with `explode="N"` or `double="N"` on the tag or an entry the character used. With a `min` you may leave `from` out, and then the rule fires only on a check that asks for it: a specialty that makes tens roll again on one skill is `"explode": { "min": 10 }`. `from` may not be below `min`.
- `cancel`: optional. A face at or below `upTo` takes one success away. The count never goes below zero.
- `botch`: optional. When **no** die succeeded and a face at or below `upTo` showed, the check is a critical failure. A pool whose one success was cancelled away has failed, not botched. `"rule": "halfOrMore"` reads it another way: faces at or below `upTo` on at least half the dice first thrown (explosions not counted) are a critical failure when no die succeeded, and otherwise leave the result standing and mark it `complication="true"`, something going wrong alongside it. `"noSuccesses"` is the default.
- `exceptional`: optional. This many net successes or more, on a check that succeeded, is a critical success.
- `situationalDice`: optional. The range of dice the Game Master may add or take for one check with `bonus=`, for stunts, wounds or bad light.
- `reroll`: optional. Re-throws the system grants without anybody paying for them, up to six, each with an `id` the Game Master names on a check with `reroll=`. Faces at or below `upTo` are thrown again: `"once"`, and the new face stands whatever it is, or `"until"` they show more. `upTo` runs from 1 to one below the die's sides, since a re-throw of every face would never stop, and an `until` stops anyway after a hundred re-throws on one check. None is thrown unless the check names it. One check throws one re-throw: where a spend or an entry the character used bought one too, the one that reaches more faces is thrown, and `until` over `once` where they reach the same.
- `difficultyLadder`: `successes` is how many the check needs. A step may also name a `target`, but only where the target is adjustable and only inside its range. That target is what a check at that step counts with: when the Game Master names the step with `difficulty=`, or writes a `dc=` exactly one step needs. Where several steps need the same number of successes, `dc=` alone cannot say which was meant, so the target stays the default; name the step.

`cancel` and `botch` faces must be below the lowest target, and every face any of these rules names has to be a face the die actually has. A rule that could never fire is refused at import rather than found in play.

A pool ruleset is Capability API 1.24 for a packaged ruleset; a `min` on `explode` or `double`, `pool.abilityPlusAbility` and `botch.rule` are 1.37; `reroll` is 1.38. A community ruleset you import is validated by the Engine that reads it, so it needs nothing.

#### What the Game Master may write on a pool check

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc` is the number of **successes** needed, not a target number. It may be anything from 1 up to the most one roll could ever count: the pool's maximum, doubled when dice can explode, and doubled again when faces count twice.
- `threshold=` moves the per-die target, and is only offered while `target.min` is below `target.max`.
- `bonus=` adds or takes dice, and is only offered while `situationalDice` is declared.
- `with=` rolls a skill or save with another ability than its own. It works on both kinds, so a 5e ruleset gets "Strength (Intimidation)" from the same attribute. On an ability check it adds a second ability instead, where `pool.abilityPlusAbility` is on.
- `difficulty=` names a ladder step in place of `dc=`, on both kinds: its successes (or its difficulty on a sum) and, on a pool, its target. A `dc=` written beside it still wins for the number, and `threshold=` for the target. A name no step answers to, or two steps share, is ignored.
- `explode=` and `double=` move those rules' faces for this check, and are only offered where the rule has a `min`.
- `reroll=` names one of your `reroll` entries for this check, and is only offered where you declared any. A name none of them answers to is ignored.

Each one is held to what your file declares: a value outside the range is pulled back to the nearest end, and an attribute your ruleset does not offer is ignored rather than refusing the check. The saved record then shows what the roll really used: the difficulty and the threshold as numbers, the bonus dice after your limits, `with=` only when that ability was swapped in or added, a face only when the check moved it, `reroll=` only when the re-throw it names was the one thrown and threw something, and `complication="true"` when a `halfOrMore` botch went wrong alongside a result. The Engine always throws the dice itself. A pool result the model wrote is replaced, `mode="advantage"` is ignored because the kind has no advantage, and a die the player rolled before the turn does not apply.

#### What is out of scope, and why

Each of these needs its own resolution kind, because none of them can be expressed by counting dice against a target:

- **Take the highest die** (as in Blades in the Dark) needs a partial-success tier that a check result does not have.
- **Stance pools compared to a stat** (as in Lasers and Feelings) decide "over or under" per check, which is a different comparison.
- **Symbol dice** (as in Genesys) do not produce numbers at all.
- **Opposed pools** resolve two characters at once; a check has one roller.
- **Roll-under and open-ended percentile** compare in the other direction.
- **Sum pools with a wild die** (as in OpenD6) add the dice up and treat one of them specially.

Both of the things this kind used to leave out are modelled now, and Spending to change a roll below says how. A rule of the system itself, "spend a point for a success" or "spend a point to throw the failures again", is `resolution.spend`. A re-throw the system grants for free when the situation calls for it is `resolution.reroll`, above. One that belongs to something a character picked is `mechanics.check` on a catalog entry, bought with that entry's own cost.

### Spending to change a roll

Some systems let a player pay for a roll they are about to make: a point of will for an automatic success. `resolution.spend` says so, as a standing rule of the system rather than as something a character went and bought:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` is one of your `live.pools`. It cannot be a pool that starts empty, because there would be nothing in it to spend when play begins.
- `amount` is what ONE purchase costs. `successes`, `dice` and `reroll` are what it buys, and a purchase has to buy at least one of them. Successes are added after the dice are counted, and after any cancelling, because nobody rolled them. Dice are thrown with the pool, inside the pool's own range. A `reroll` is `{ "upTo": 6, "mode": "once" }`, read the way `resolution.reroll` is, and is bought once however many purchases the check makes: a die thrown again twice is still one re-throw.
- `perCheck` is how many purchases one check may make, so the most a check can buy is `amount * perCheck` points' worth. That cap is what stops a full pool buying an unlosable roll. It is a number from 1 to 10, a value off the sheet in the same form a derived value reads (`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`), or `"pool"`: as many as the check has dice, meaning the sheet's number for it before wounds, bonus dice or modifiers. A value off the sheet is read for whoever rolls, rounded down and held between 0 and 100, and a character whose limit comes to 0 buys nothing and pays nothing.
- Only a `dice-pool` ruleset can have one: a summed roll has no successes to add and no pool to add dice to, so a `dice-sum` ruleset that declares `spend` is refused at import.
- Up to four entries, and two may not name the same pool, or a check could not say which of them it meant.
- A spend that buys a `reroll`, a `perCheck` that is not a number, and more than two entries are Capability API 1.38 for a packaged ruleset.

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
- `explode` and `double` move those rules' faces for that one roll, and only where your rule has a `min` and inside it: `"check": { "explode": 8 }` is an entry that makes eights roll again. They outrank what the Game Master wrote on the tag, as `threshold` does. Capability API 1.37.
- At least one of these, or the entry says nothing and is refused.
- Only a `dice-pool` ruleset can honour any of it, so a `dice-sum` ruleset with a `mechanics.check` is refused at import.

**What it costs is the entry's own `cost`,** paid through exactly the machinery that pays for using anything else: the pool, and one use of every counter the same entry wrote. `perCostStep` is what says the entry SCALES; an entry that declares one is bought as many times over as the price was paid, and one that does not is bought once however much was offered.

**The Game Master names it on the check:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Not a separate sheet command, for the same reason as above: the dice are thrown before any bookkeeping runs.

**All or nothing.** If the pool cannot cover it, the purchase does not happen and nothing is deducted: the roll is exactly the one it would have been. Points that are not a whole number of purchases buy nothing either. Asking for more than `perCheck` is clamped rather than refused, and only the cap is paid for. The Engine works all of this out; the Game Master names what the player said they were spending and never touches the dice. The record says what was really paid, which entry was applied, how many successes nobody rolled and how many dice were thrown again. A charm the character has not picked, or one the Engine cannot read the catalog for, does nothing at all rather than being applied on trust.

### The sheet

- `sections` group things in the editor. Fields, derived values and lists name the one they sit in with `section`, and so may abilities, skills and saves: the editor, the game's sheet and the Game Master's sheet block then show them under that heading (a sheet that names no section on them shows them exactly as before). A section may also carry an `untrained` rule (below).
- `abilities` are the core scores. `skills` and `saves` each may name the ability they roll with, a `cap`, and an `untrained` rule (below).
- `fields` are single values. Types: `number`, `text`, `longtext`, `boolean`, `enum` (a fixed list of choices), and `dice` (text such as `1d8`).
- `derived` values are worked out from other values and cannot be typed over. The operations are `sum`, `min`, `max`, `scale` (multiply and round), `stepTable` (look a value up in thresholds, the way a level gives a proficiency bonus), and `enumTable` (a number for each value of an enum field or a live state; see Live states below).
- `lists` are tables with your own columns, such as gear, spells, or features. A list with `pools` turns every row into a resource with its own maximum, for class features with limited uses.
- `live` is what changes during play: `pools` (hit points, spell slots, Grit), `tracks` (a number on a scale, such as exhaustion, or a wound track of boxes you tick), `text` (short notes such as what a character is concentrating on), `conditions`, and `states` (one value out of a closed set, such as a form or a stance).

Anything that reads a number names it with a value reference, which is an object with exactly one key: `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack`, or `itemStat`. For example, a pool whose maximum is a derived value: `"max": { "derived": "grit_max" }`.

- `listSum` adds up one number column of a list: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` is optional and names a boolean column; only the rows where it is set count. An empty cell counts as its column's default, and a list that `hideWhen` hides adds nothing. Ember Roads works out Burden this way, from the gear a character has packed, so it can never drift from the list the way a typed-in number would. A catalog's scaled column cannot read a list sum, even through a derived value: a list may hold scaled cells, its own or ones that read it back, and the recompute would never settle.
- `livePool` reads what is left in one of your `live.pools` (a list row's pool is not one of them). `liveTrack` reads one of your `live.tracks`, with an optional `read`: `"value"`, where it stands (the default); `"filled"`, how far above its `min`; `"remaining"`, how far below its `max`; or, on a wound track only, `"penalty"`, the penalty in force. A hidden pool or track reads 0. Gravewatch's "Harm still to take" is `{ "liveTrack": "harm", "read": "remaining" }`.
- A live read takes the live state as it stands when a check is rolled, a fight begins, or the Game Master's sheet block is written. Where there is none yet (the sheet editor, an import review) it reads the state play starts in: a pool full or empty as it `start`s, a track at its `default`, a wound track clear.
- Nothing worked out before there is a live state may read one: a pool's or a track's `max`, the proficiency bonus, or a catalog's scaled column or scaling. That holds through a derived value that reads one and through a skill a live value caps, and the import names the value that does.
- These three are Capability API 1.39 for a packaged ruleset.
- `itemStat` reads the items the character holds, such as the guard of the armor they wear, and is held to the same rule as a live read. See [Items on the sheet](#items-on-the-sheet). Capability API 1.52.

**What a check does untrained.** A skill or save the character has no training in (its tier is the first one) rolls as usual unless the ruleset says otherwise, with `untrained` on the skill or save or on the section it sits in (the skill's or save's own rule wins):

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`: as usual (the default).
- `{ "by": -3 }`: added to the check's number, from -20 to 20: dice on a pool, a flat amount on a sum. It is part of the number the sheet shows and every check rolls, before any `cap`.
- `"harder"`: one step harder. On a pool, the per-die target goes up one (and stays inside the target's range), so it needs a pool ruleset whose target can move; anywhere else it is refused at import, because it could never change a roll.
- `"refuse"`: the check is not rolled at all. The Engine writes the Game Master's ask back with `reason="untrained"`, which settles it: nothing rolls it later, the Game Master is told the character could not attempt it, and the narration says so. The skill-check endpoint answers such a check with a 400 (`skill_check_untrained`), and a branch on it keeps neither half. The sheet editor shows no number for it.
- A character nobody has a sheet for has no training to read, so no untrained rule applies to them.
- The Game Master's reminder lists the untrained rules, by section or by skill, so it asks for checks a character can make.

Sections on abilities, skills and saves, and `untrained` anywhere, are Capability API 1.41 for a packaged ruleset.

A skill or save may carry a `cap`, a value reference that is the most its check may ever come to: a rating it cannot outgrow, or a track that holds it down. Gravewatch caps Soothe at the Resolve a warden has left, `"cap": { "livePool": "resolve" }`. The capped number is the one the sheet shows and every check rolls, and a `with=` swap is worked out on the number before the cap and then capped again. A cap cannot read a skill or save modifier, and neither can the derived value it reads or any derived value declared above that one, so the sheet is still worked out once, top to bottom. Capability API 1.39.

`hideWhen` hides a field, a derived value, a list, a pool, or a plain track by another field's value, in exactly one of three ways: `equals` one value, `notEquals` one value (hidden whenever the field holds anything else, which is how "only for this kind of character" is said), or `in` a list of values. Every value named must be one the field can hold, or the rule could never match, and it is checked one value at a time; for `notEquals` and `in` that includes a number field's range and a text field's length. The rule reads the value the sheet editor shows: an unset field is the value a blank sheet starts with, and an enum value the ruleset no longer offers is the field's default. The 5e file uses `equals` to hide spell slots from a character who does not cast spells; Gravewatch keeps lantern oil off the sheet of every warden who is not on the night watch with `"hideWhen": { "field": "watch", "notEquals": "night" }`. A layer cannot remove a value any of these compares with. A wound track cannot be hidden, because rolls and fights read it whatever the sheet shows. `notEquals` and `in` are Capability API 1.39.

A plain track's `max` may be a value reference instead of a number, so a rating the character has sets how far it goes: `"max": { "field": "willpower_rating" }`. Its `min` and `default` stay numbers. A wound track with named levels has a `max` equal to its number of levels; a track of numbered boxes is as long as its own `max` (see Numbered boxes below). `alwaysShow: true` prints a track in the Game Master's sheet block even at its default, for a rating that matters on every turn; without it a track at its default is left out, because three death saves at zero say nothing. These three are Capability API 1.37 for a packaged ruleset.

### Live states: a form, a stance, a light

An enum field is chosen when a character is made and stays chosen, and a condition is only on or off. A **live state** is one value out of a closed set that changes in play: a shapeshifter's form, a fighting stance, how lit a lantern is.

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

- `values` are two to forty, each shown as its `valueLabels` entry or as itself. They follow the rule every label follows (one line, no square brackets, no macro braces) and never hold a double quote, because the sheet command quotes them. Up to twelve states.
- `default` is where every sheet starts, and the first value when you leave it out. Only a state moved away from its default is stored, and a stored value the state no longer offers reads as the default.
- `hideWhen` takes a state off a sheet by a field's value, as it does a pool: not shown, not set by a command, and read by a table (below) as no value at all.
- The Game Master sets one with `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`, naming the state by id or label and the value by itself or its label. A state or a value the sheet does not have is refused (`unknown-state`, `unknown-value`). The Engine teaches the command and lists every value only when your ruleset has a state, and every sheet block says each state's value, its default included, because "in human form" is a fact the narration needs every turn.
- The game's sheet screen shows a picker for each state.
- A rest puts one back with a restore step that names it: `{ "state": "stance", "to": "default" }`, or `"to"` one of its values.

**Numbers that follow.** A derived value with `"op": "enumTable"` gives a number for each value of an enum field or of a live state:

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

- `from` names exactly one of `field` (an enum field) or `liveState`. Every row of `table` is a value that one can hold, one to forty of them. A value the table leaves out, and a state the sheet hides, read `default` (0 when you leave it out).
- A field is fixed when the character is made, so a table keyed on one may feed a maximum: Gravewatch gives a warden on the dawn watch one more Resolve. A live state changes in play, so a table keyed on one is a live read, like `liveTrack`: nothing worked out before there is a live state may read it, directly or through another derived value. That is why the key is `liveState` rather than `state`: every read of the live state is named `live`, which is how you and the import tell what a maximum cannot use.
- To put the number on the dice, point `resolution.adjust` at it (see Modifiers off the sheet). Ember Roads adds its Stance to every Brawn roll; Gravewatch takes a shuttered or dark lantern off every Nerve roll.
- A layer may take a value out of a field a table has a row for. The row is simply never read while the layer is on.

Live states, `enumTable` and a rest step that names a `state` are Capability API 1.42 for a packaged ruleset.

### Wound tracks: health that is a track, not a number

Plenty of systems do not count hit points at all. They have a column of boxes, each worse than the last, and you tick one when you get hurt. Give a `live.tracks` entry `kinds` and either named `levels` or numbered `boxes` (below) and it stops being a number on a scale and becomes one of those:

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
- The two go together. `kinds` without `levels` or `boxes` is refused, because there would be nothing to mark, and `levels` or `boxes` without `kinds` is refused, because a mark has to be of something. A track has `levels` or `boxes`, never both.
- **Keep the two words apart.** `kinds` is what your ruleset says a mark may BE. A MARK is one of those kinds sitting on the track during play. The definition holds kinds; a character's sheet holds marks.
- A wound track starts unmarked, so its `min` is 0. A track with named levels is as long as its levels, so its `max` is `levels.length`, and a file that says anything else is refused rather than quietly corrected, so it can never carry two disagreeing lengths. A track of boxes is as long as its own `max`, which may be a value the sheet works out (see Numbered boxes below).

**The rules, exactly**, because a vague reading produces the wrong track:

- Marks are held sorted, **most severe first**. A track of seven levels holds at most seven marks.
- A mark is **placed in severity order** among the marks already there, never added to the end. It takes the highest level its severity earns and pushes lighter marks down.
- The penalty in force is the one on the **lowest marked level**, never the sum of the marked ones. Three marks on the track above read `-3`, not `0 + -1 + -3`.
- An `amount` is a number of marks of one kind, **applied one at a time**, so a track that fills partway through is handled by the same rule as one that was already full.
- Marking a **full** track **upgrades its lowest-severity mark by one step** instead of adding a mark. One step up your own ladder of kinds, whatever kind the new mark was.
- A mark that would upgrade past your highest severity is kept at the highest, and the one that could not land is counted as an **overflow**. Overflow is stored, so a reload does not forget harm somebody already took.
- **Healing is the same command with a negative amount.** It clears overflow before it clears any mark. A heal that names one of the track's kinds clears only marks of that kind, so "the bashing heals, the lethal stays" is `kind="bashing"` with a negative amount; one that names no kind the track has clears the lightest marks first.

**Marking it in play.** The Game Master writes `[sheet: op="damage" track="harm" kind="knock" amount="1"]`, and heals with a negative `amount`. On a track that fills by box it adds `box="3"` for the box the hit lands on. The pool form of `damage`, which names `pool=` instead, is unchanged. The plain `track` command is refused on a wound track: a bare number cannot say what the new marks are. The player can also mark and clear boxes by hand on the sheet, which is what these systems expect.

**A fight can mark one too.** Point `combat.health` at the track instead of a pool and the fight
marks it: a blow that lands marks the boxes `combat.damageKinds.marks` says it does, of the kind
that block maps its damage type onto, and a character whose track is full is down, which is what
your dying rule reads. On a track that fills by box, `per-point` damage names the box it lands on
and `per-blow` aims at the first, and a blow that no box can take puts the character down, which is
what being taken out means in the systems that keep such a track. Healing clears one mark, the
lightest, of any kind. Temporary points are refused, because a track has no buffer for them to sit in. The Engine
reads a track as the levels it has LEFT, so everything else about a fight, going down, being
revived, the log and the recap, is unchanged.

**A rest can heal a wound track.** A restore step naming one with `"to"` clears it down to that many marks, overflow and all; one naming it with a NEGATIVE `"by"` clears that many, overflow first, so `"by": { "const": -2 }` clears two. A step that also names a `kind` clears only marks of that kind: Gravewatch's "Catch your breath" is `{ "track": "harm", "kind": "knock", "to": "min" }`, which mends the knocks and leaves the tears. A step that would ADD marks does nothing, because a rest marks no harm, and that includes a positive `"by"`: it is skipped without a word, so write the minus sign.

#### Numbered boxes instead of named levels

Where a track is as long as a character is tough, give it `boxes` instead of `levels`. It has as many boxes as its own `max`, which may be a value the sheet works out (never one that reads the live state), up to 64:

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

- The penalty in force is read off `table` (a step table, like a derived value's, with penalties at or below 0) at the number of boxes `filled` or `remaining`, whatever that number is, so a table can cost something with nothing marked. It does not depend on which boxes are marked.
- The boxes are numbered: the sheet shows "Box 3", and the Game Master's sheet block says how many are marked out of how many rather than naming a level.

#### Filling by box, and tracks that refuse

- `"fill": "indexed"` puts a mark on the box the command names with `box=` (the first box when it names none), or the next free box above it, and never moves a mark once it is down. A heal clears the highest of the lightest marks. The sheet screen lets a player click any clear box.
- `"onFull": "refuse"` refuses a mark that has no box free, instead of upgrading the lightest mark. The whole command is refused, so three marks with two boxes free land none. An indexed track always refuses; say so with `"onFull": "refuse"` beside it.

#### Levels a list adds

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` on a track with named levels lets a list on the sheet lengthen it per character. Each row, in order, adds its count of levels (at most 16) at its penalty, after the last level whose penalty is at least as good, named after that level when the penalties match and by the penalty otherwise. Gravewatch's scars work this way. A list the sheet hides adds nothing, and if a row is deleted while its levels are marked, the marks that no longer fit are kept as overflow: harm is not undone by editing the sheet.

`boxes`, `fill`, `onFull`, `extra` and a rest step's `kind` are Capability API 1.40 for a packaged ruleset.

### The penalty on your rolls

`resolution.penaltyFrom` names the wound track whose penalty applies to every check this ruleset rolls. It is declared rather than assumed, so a ruleset that leaves it out rolls exactly as it did before wound tracks existed.

What the penalty DOES is your resolution kind's business, exactly like the sheet's own number:

- Under `dice-pool` it is **dice off the pool**, floored at your own `pool.min`. A `pool.min` of 1 means even somebody on the bottom rung throws one die; a `pool.min` of 0 means they throw none and fail without rolling.
- Under `dice-sum` it is a **flat modifier on the roll**, folded into the same number your ability and training already add.

The track it names has to be a wound track. A plain track carries no penalty to apply, and naming one is refused at import. The result says which penalty was applied, so a player can see why they rolled fewer dice, and the Game Master's own sheet block shows the rung and what it costs.

### Modifiers off the sheet

Some numbers on a sheet ride along on every roll they touch: a heavy pack on every climb, an armour penalty on every sneak, a blessing on everything. `resolution.adjust` says so, on either kind:

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` is a value off the sheet, in the same form a derived value reads, the live state included. A negative number takes away. Ember Roads adds up the bulk of the gear a character has packed into a Burden, and a step table turns every three of it into one off each Brawn roll. A table keyed on a live state is how a form or a stance reaches the dice (see Live states).
- `abilities` is optional. With it, the modifier applies only to a check that rolls with one of those abilities: the ability itself, a skill or save that uses it, a skill rolled with it through `with=`, or a pair of abilities that includes it. Without it, it applies to every check.
- It is applied where the wound penalty is: dice on a pool, under the same `pool.min` floor, and a flat number on a sum, inside the modifier the record adds up. Up to eight entries, added together for each check.
- A ruleset fight adds it to every roll it builds from a sheet, as the fight begins: an attack rolled with an ability or a skill, a save, a contest check and initiative read off an ability, a skill or a save take the entries for that ability, and anything else rolled takes only the entries for every roll.
- A character nobody has a sheet for gets nothing from it, the same way they get no modifier.

The result says what the sheet added (`adjust="-2"` on the record, and a line on the dice card), so a player can see why a roll came out as it did. It is Capability API 1.38 for a packaged ruleset.

### Rests

A rest is a list of restore steps and things to clear. Each step names one target (`pool`, `poolGroup`, `listPools`, `track`, or `state`) and either sets it (`"to": "max"`, `"to": "min"`, or a number) or changes it (`"by": { "const": 1 }`, or `"by": { "fractionOfMax": 0.5 }`). A step naming a wound track can only heal it, so its `by` is negative; see above. A step naming a live state only sets it, to `"default"` or one of its values.

### Game Master text

- `checkGuidance` replaces the built-in paragraph that tells the Game Master how to ask for a check. Say which system this is and when to call for a roll. The Game Master only names the skill and the difficulty. The Engine rolls the dice and does the arithmetic from the sheet, so do not ask the model to do math.
- `sheetGuidance` introduces the character sheets in the prompt. Use it to say which resources matter and when to spend them.
- `worldGuidance` is optional and is read once, when the world is generated, so the setting the Game Master invents suits your rules: no gunpowder, magic is rare, the dead walk. It never reaches a turn.
- `sheetSummary` chooses which fields, derived values, and list rows the Game Master sees for each character. The Engine always shows ability modifiers, trained skills and saves, and live values. Keep the rest short, because it is sent on every turn. A summary list's `nameColumn` may be a text or an enum column (an enum shows its value's label), and `columns` names up to three more of the row's own columns to print after the name, so the block reads `Gear: Crowbar 1d6` rather than names alone. A boolean column prints its label when it is set. Both are Capability API 1.37 for a packaged ruleset.
- You do not need to teach the sheet command in `sheetGuidance`. The Engine teaches every command itself, with the names your file declares, and when your ruleset has a wound track it adds the `op="damage"` command for marking it and lists its levels and kinds of harm. When it has live states, it adds the `op="state"` command and lists the values each may take.

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
- `holds`: `"rows"` (the default, and what every catalog written before this release is), `"creatures"` or `"items"`. A catalog of creatures is a bestiary a fight reads, and a catalog of items lists things a party carries. Neither writes anything onto a sheet, declares `feeds`, or is ever offered by the picker. See [Creatures](#creatures-a-bestiary-a-fight-reads) and [Items](#items-what-a-party-carries) below.
- `feeds`: the lists on your sheet that this catalog's entries may write into, one to eight of them. Required for a catalog of rows and refused on a catalog of creatures or items. An entry can never write into a list that is not here, and it can never write a value the list's columns could not hold.
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

- With a [`combat` block](#combat-a-fight-your-own-rules-resolve), the fight reads its combat effects. `range`, `area` and `friendlyFire` apply on a battlefield with positions; `reaction` marks an entry as one that answers something rather than one taken on a turn, and names the moment it waits for (see [Windows](#windows-holding-the-fight-open)); one marked plain `true` names none and is on no menu. `check` applies to skill checks, as described above.
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

Separate catalog files are for packages published through the official catalog: the package lists the file in `contributions.assets.paths` beside `ruleset.json`, and it needs Capability API 1.21. A catalog of creatures, inline or in its own file, needs Capability API 1.27, and a catalog of items needs 1.49. **A ruleset you import as a single file, or share through a GitHub repository, carries its catalogs inline**, which means they have to fit inside the 256 KB limit on the whole ruleset file. That is room for a few hundred short entries.

The limits are 12 catalogs per ruleset, 2000 entries per catalog either way, and 1 MB for one catalog file.

## Items: what a party carries

Armor, weapons, potions, gear, ammunition and money are items. An optional `items` block declares the words every item of your ruleset is written in, and a catalog with `holds: "items"` lists the items themselves. Both need Capability API 1.49; the block's `rarityCaps` and `propose`, which govern the items the Game Master invents, need 1.51, a value that reads the items a character holds (`itemStat`) needs 1.52, what an item does to checks while worn or carried, with the block's `bonus` caps, needs 1.53, what an item asks of its wearer and the abilities it changes need 1.54, a weapon's `attack` needs 1.55, what an item does in a fight needs 1.56, what a weapon shoots and holds loaded needs 1.57, a weapon's modes, off-hand attack, floor and conditions on a hit need 1.58, what using an item does in a fight, with the charges it holds, needs 1.59, a use that restores a pool needs 1.60, charges regained on a rest or an item that breaks when emptied need 1.61, and a use that asks a check first (`gate`) needs 1.62.

### The items block

The block goes in `items` at the top level of the file. This is Ember Roads', a little shortened:

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

- `categories`: one to 24. Every item has exactly one, such as armor, weapon or potion.
- `rarities`: optional, up to 12. List them from the most common to the rarest.
- `tags`: optional, up to 48. Properties an item may have, such as thrown or silvered.
- `stats`: optional, up to 24. The numbers and words an item carries, declared exactly like a list column: `number`, `text`, `boolean`, `enum` or `dice`, with a range, values and a default where the type has them. `promptVisible` (default `true`) says whether the Game Master is shown the stat beside the item. Set it to `false` for something only the player should see, such as where an item is hidden.
- `slots`: optional, up to 12. Where an item is worn or held, and how many of that slot a character has, from 1 to 20.
- `binding`: optional. Attunement, investiture, or anything else that limits how many items one character may have bound at once. `label` is what it is called, and `max` is a value read off the character's sheet, such as `{ "abilityScore": "nerve" }` or a derived value. It cannot read the live state, because how many items a character may bind does not change with every blow.
- `carry`: optional. `stat` names the number stat that is an item's weight, whose `min` is 0 or more. `encumberedAbove` is how much a character carries before they are encumbered, and `limit` (optional) the most they can carry at all. Both are read off the sheet like `binding.max`. Without `carry`, weight means nothing and nobody is ever encumbered.
- `currencies`: optional, up to six families of one to ten coins each.
  - Coins of one family change into each other by `value`, which counts the family's smallest coin. So the smallest coin is worth 1, and no two coins of a family are worth the same.
  - Two families never change into each other. A second nation's coin, or a setting's favours, is a family of its own.
  - A coin's id is unique across every family, because an item's cost names the coin alone.
  - `perWeight` (optional, and only beside `carry`) is how many of the family's coins weigh one unit of the carry stat.
- `rarityCaps`: optional, one per rarity at most. The most an item the Game Master invents may give at that rarity: the largest value of each number stat named in `stats`, inside that stat's own range, and a whole number for a stat that takes whole numbers, and `bonus` (Capability API 1.53), the largest flat bonus one of its worn or carried modifiers may add. At a rarity with a `bonus`, a bonus in dice is left out, since dice cannot be held to a number; a penalty is never capped. An invented item is held to it; the items your catalogs list are yours and never capped.
- `propose`: `true` by default. `false` forbids the Game Master to invent items of your ruleset.
- `native`: `true` by default. `false` turns off Game Mode's own untyped items in your ruleset's games (see **What reads items**). The Game Master can still invent items, written in your ruleset's words.
- `freeform`: what an item the player types in becomes. `"plain"` (the default) keeps it as an item with no rules, as today. `"refuse"` allows only items of your ruleset.

### An item

An item catalog declares no `feeds`:

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Each entry carries an `item` instead of `rows` or a `creature`:

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

- `id`, `label`, `summary` and `filters` work as they do for any entry. The label is the item's name.
- `category` is required. `rarity` and `tags` are optional, and all three name the block's own ids. An item can only have a rarity when the block declares some.
- `stats`: values for the block's stats. Each one is a value its stat could hold.
- `slots`: how many of each slot the item takes, never more than a character has.
- `stack`: the most one stack holds, from 1 to 999,999. Without it, a stack holds as many as any Game Mode stack. An item that holds `charges` is one to a stack.
- `cost`: a whole `amount` of one coin, named by its `unit` id.
- `binds`: the item has to be bound before it does anything while worn. `restriction` (optional) says in words who may bind it, and `cursed: true` marks one that will not let go. Only a ruleset with `binding` can have items that bind.
- `worn` and `carried` (optional, Capability API 1.53): what the item does to its holder's checks and saves while it is worn, and while it is only carried, (1.54) the abilities it sets or raises, and (1.56) what it does in a fight. See [Checks outside a fight](#checks-outside-a-fight) and [Armor and worn effects in a fight](#armor-and-worn-effects-in-a-fight).
- `requires` (optional, Capability API 1.54): what the item asks of whoever wears it, and what applies while they fall short. See [Checks outside a fight](#checks-outside-a-fight).
- `attack` (optional, Capability API 1.55): what the item does as a weapon in a fight, while it is worn, (1.57) what it shoots and holds loaded, and (1.58) its other modes, an off-hand attack, a floor to its harm and the conditions it puts on a hit. See [Weapons in a fight](#weapons-in-a-fight), [Ammunition and reloading](#ammunition-and-reloading) and [Modes, a second weapon, a floor and conditions on a hit](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `use` and `charges` (optional, Capability API 1.59): what using the item does, in a fight and outside one, and the charges it holds for that use to spend, and (1.60) a pool it restores. See [Using items in a fight](#using-items-in-a-fight) and [Using items outside a fight](#using-items-outside-a-fight).

An item carries no `mechanics`: what it does is written in its `item` block.

### What reads items

Everything above is checked when the ruleset is imported, and your catalogs of items ship with it. In a game, Game Mode's inventory reads them:

- **Your items are in the bag.** A stack can be one of your items, and stays that item whatever the player calls it. The inventory's **From the ruleset** button opens a picker of every item your catalogs list, with the catalog's search and filters, and a layer that hides an entry hides it there too.
- **Names find your items.** A name the player types, or one the Game Master writes in `[inventory: action="add"]`, that is the `label` of one of your items, in any case, adds that item. When two items share a label, the one your catalogs list first is the one a name finds.
- **`stack`** is kept: adding, setting, merging or giving past it fills the stack and starts a new one.
- **`freeform: "refuse"`** leaves the player only your items: the picker, and names that are your items.
- **`native: false`** leaves the Game Master only your items and the ones it invents: a name that is neither is refused (`not-ruleset-item`), while more of something already held can still be added, and its instructions say so. A fight no longer asks a model what the inventory's items do, and offers none to guess at: only your weapons fight, while they are held (see Weapons in a fight, below). What the player types in still follows `freeform`, and what the party carried comes back in a new session either way.
- **What an item is** shows on the selected stack: its category, rarity and tags by their labels, the stats it gives, its summary and how many one stack holds. The picker also shows its `cost`. The Game Master sees each of your items it holds with its category, rarity, tags and the stats you left `promptVisible`, such as `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: an item that takes slots can be equipped by whoever carries it, while they have those slots free, and one item of a larger stack is taken into its own stack to be worn. The inventory shows each slot in use per character.
- **`binding`**: an item that `binds` can be bound, up to `binding.max` read off its bearer's own sheet (a character without a sheet reads a blank one). A `cursed` item, once bound, stays bound: the player cannot unbind it, take it off, give it away or remove it, and only the Game Master can end the curse.
- **`carry`**: an item weighs its value of `carry.stat` (an item without one weighs nothing), and a character's load is what their bag weighs, against `encumberedAbove` and `limit` read off their own sheet. An item added into the inventory's shared view, by the player or by the Game Master without a `who=`, goes to whoever can carry it without becoming encumbered (the player first, then the party in order), shared out by the room each has left when nobody can take all of it. Nothing goes past anyone's `limit`: what nobody can carry is left behind and the Game Master is told. Give a weight stat `"integer": false` for weights such as a quarter of a pound.
- **The Game Master invents items in your words.** Unless you set `propose: false`, its `[inventory: action="add"]` can describe a new item: `like=` one of your items to start from, then any of `category=`, `rarity=`, `tags=`, `stats=` (`id=value` pairs), `slots=` (`id=count`), `binds=` (`yes`, `cursed` or `no`), `worn=` and `carried=` (changes split by `;`, each `+N`, `-N`, `advantage`, `disadvantage` or `fails` for saves, on skills or saves by name, or on `checks` or `saves` for all of them, `+N` or `-N` on an ability's name to raise or lower it, and, where you have fights, `+N`, `-N`, advantage or disadvantage on attacks and `+N` or `-N` on defense or your word for it: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"`, or `none`) and `summary=`, each part by its id or label. An item stat your defense already counts (Ember Roads' Guard adds up the `guard` of what is worn) is how armor raises it, so a worn change to defense beside such a stat is left out and the answer says so: a small model writes `guard=1` and `+1 Guard` for one +1. It also reads what a small model tends to write instead: a number after the name (`Brawn +1`), "bonus" after attacks or defense (`+1 attack roll bonus`), `none` for an empty list of tags, stats or slots, and `worn=`, `carried=` or `summary=` inside `stats=` when you have no stat of that name. The Engine keeps only what your block has: an unknown category, tag, stat, slot, skill or save is left out, a rarity you do not have becomes your lowest, a number is held to its stat's range and then to `rarityCaps` for its rarity, a worn or carried bonus to its rarity's `bonus` (the part `like` started it from as well), and a name that is one of your items is simply that item. The answer tells the Game Master what was changed (never about a stat you do not show it), and the item's details show every change to the player. The game keeps the item, so the same name is that item for the rest of the game, and a new session keeps it while anyone still holds it.
- The Game Master can `equip` and `unequip` your items with its inventory command when you have `slots`, and `bind` and `unbind` them when you have `binding`: it is only told of the ones your ruleset has. It sees each character's load, bound items and slots, and what is worn or bound.

- **What an item does while worn or carried** shows on the selected stack and in the picker ("While worn: -1 on checks (Sneak)"), and the Game Master sees it beside the item (`worn: -1 on checks (Sneak)`). Checks outside a fight apply it (see Checks outside a fight, below).
- **What a weapon does** shows the same way ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), and a fight offers it while it is held (see Weapons in a fight, below).
- **What using an item does** shows the same way ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), with the charges it has left. A fight offers it, and so do the inventory's **Use** button and the Game Master's `[inventory: action="use"]` (see Using items in a fight and Using items outside a fight, below).

A fight already spends one of your items the way it spends any item, unless `native` is `false`. Whatever `native` says, the sheet can read your items (below), a held weapon is an attack in a ruleset fight, shooting what it draws from the bag, what an item does while worn or carried counts in one (see Armor and worn effects in a fight, below), and an item with a `use` is used by its own rules, in a fight and outside one (see Using items in a fight and Using items outside a fight, below). Money comes in a later release.

### Items on the sheet

A value reference can read the items a character holds, with `itemStat` (Capability API 1.52). Ember Roads adds the guard of the armor a traveller wears to their Guard, which is what a blow has to beat:

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"` is the items on the character: an item that takes slots while it is equipped, one that `binds` while it is bound, and one that does both while both. An item that does neither is never worn. `"carried"` is the rest of what they hold, and `"all"` is both.
- `pick`: `"sum"` adds each item's value times how many there are, `"max"` and `"min"` read the highest or the lowest single value, and `"count"` counts the items, by how many there are.
- `stat` names one of your item stats. `sum`, `max` and `min` need a `number` stat. `count` may leave it out to count every item, or name any stat to count only the items that give it.
- `slot`, `category` and `tag` (each optional) keep only the items that take that slot, are of that category, or carry that tag.
- `default` (optional, 0 when left out) is what it reads when no item is picked, or none of them gives the stat.

Items change in play, so `itemStat` is held to the same rule as a live read: a pool's or a track's `max`, the proficiency bonus, `binding.max`, the `carry` numbers, and a catalog's scaled column or scaling cannot read it, even through a derived value. Anywhere else a number is read, it can: a derived value, a check's `adjust`, a skill's `cap`, a fight's defense, soak or initiative.

A character's items are the ones in their own bag. The player's card (the one named for who the chat plays as, else the first) reads the player's bag, and every other card its own. Only your ruleset's items count, since a plain item has no stats to read. The sheet on screen, a check, the Game Master's sheet block, and a fight as it begins all read what each character holds right then. Outside a game, in the sheet editor or an import review, nobody holds anything and `itemStat` reads its `default`.


### Checks outside a fight

A check or save the Game Master calls for outside a fight reads more than the sheet: the character's own active conditions, the levels they have reached, what their items do while worn or carried, and what a worn item's requirement costs while they fall short of it. It is the same vocabulary a fight's conditions use (Capability API 1.53 for the item keys and the narrowing).

An item says what it does with `worn`, which applies while it is on (and bound, where it binds), and `carried`, which applies while it is only carried. Ember Roads' leather coat creaks when you creep, and a waystone makes caravan folk trust you:

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Each takes the parts of a condition that a check reads:

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` and `own-saves-disadvantage`.
- `modifiers`: changes `to` checks or saves, with `flat`, `dice` (and `minus`), `mode`, and their own `skills` or `saves`, exactly as a condition's.
- `failsSaves`: saves its holder fails without a roll.
- `skills` and `saves`: which skills or saves the effects and the modifiers that name none of their own are about.
- `abilities` (Capability API 1.54): abilities it changes, by id, each `{ "set": N }` (at least N: a higher score stays) or `{ "add": N }` (a negative number lowers it). They apply before the sheet is worked out, so everything that reads the ability reads the changed one: the sheet on screen, derived values, checks, the Game Master's sheet block and a fight as it begins. The additions go on first, then the highest `set`, and the ability's own `min` and `max` hold. A pool's or track's maximum and the proficiency bonus are worked out from the sheet alone, so an item does not move them.

Ember Roads' ox-hide gauntlets lend a weak grip a drover's:

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

What an item does in a fight (defense, attacks, speed, the fight's other effects, and the harm and conditions it keeps off) is in [Armor and worn effects in a fight](#armor-and-worn-effects-in-a-fight); a check outside a fight reads only the parts above. One item applies once however many stacks of it someone holds.

An item may also ask something of whoever wears it, with `requires`: a value off their sheet (`value`, any value reference, read as everything in play is), the least it may be (`atLeast`), and what applies while they fall short (`otherwise`, in the same vocabulary, except that it cannot change an ability, since what it asks may read one). Up to four. Gravewatch's grave spade is heavy work for a weak warden:

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

A requirement reads the ability as the wearer's items leave it, so gauntlets that set Sinew to 3 meet the spade's.

On a check:

- Every modifier that is about it adds its number, and its dice are rolled: a flat number on a summed check, dice on a pool. An ability check, and a check the ruleset cannot name, read only what is narrowed to nothing, and a save reads only what is about saves.
- Advantage and disadvantage from every source, the Game Master's `mode=` among them, cancel out: any of each and the check is rolled once. Only a ruleset that rolls twice at all (`resolution.advantage`) leans.
- A save that a condition or item fails is failed without a roll, and nothing is spent on it.
- The record says what changed it: `effects="-1"` for the number, `from="Leather coat"` for whatever changed it, and `automatic="true"` for a save failed without a roll. The dice card shows the same, and the Game Master reads it next turn. It is told the Engine applies these, so it does not add them again.

Gravewatch shows the same on a pool: the bound Dawn bell adds a die to Ward, and Rattled takes one off Soothe and Barter.

### Weapons in a fight

An item may be a weapon (Capability API 1.55). Its `attack` is the shape a combat block's [attack rows](#combat-a-fight-your-own-rules-resolve) have, with values in place of columns, and a [ruleset fight](#combat-a-fight-your-own-rules-resolve) offers it as an attack while the item is worn: held in the hands it takes, and bound where it binds. One put away or only carried offers nothing, and the attack rows and a creature's own actions work exactly as before. Ember Roads' hand axe:

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: the budget it spends, one of `combat.economy.budgets`.
- `toHit`: what it adds to hit. `abilities` are one or more ability ids, and the best of them counts (a finesse weapon lists two). `skill` adds what a check of that skill adds, with the attack's ability in place of the skill's own, as an attack row's is. `proficiency` is a value off the holder's sheet: where it reads above 0, the ruleset's proficiency bonus is added (`{ "const": 1 }` for always). `bonus` is a number. `target` is a pool fight's own per-die target for this weapon's attack (Gravewatch's spade counts every die from 6 rather than the pool's 7), and only a `dice-pool` ruleset whose `target` can move may give one; in a summed fight its `bonus` says the same.
- `damage`: `dice` it deals, the best of its damage `abilities` added, a `bonus`, and a `type`. A summed fight needs `dice`; in a pool fight a hit deals its successes and `dice` adds that many more of the pool's own die.
- `reach` and `range` (`normal`, and `long` for what it still carries beyond) are in your `combat.distance` unit, and need one. A weapon with both is thrown, as an attack row is: a swing close, a throw beyond. With neither it reaches one cell.
- `versatile`: `dice` it deals instead while each slot it takes has room for as much again among what its holder wears: a spear in one hand with the other free.
- `strikes`: how many strikes one spend buys, off the holder's sheet, as an attack row's `strikes` is. A weapon without it is one strike a spend, however many attacks its wielder has.

Any of those numbers or words may read the item's own stat instead: `{ "stat": "damage" }` is the item's `damage`, and a stat the item gives nothing is as if the value were not written. `abilities` and `skill` read an enum stat whose words are ability or skill ids, and `type` a text or enum stat. So an item the Game Master invents `like=` a weapon is a weapon too, fighting with its own stats, held to `rarityCaps` like any stat (a value you write down is copied as it is). One invented with no slot and no binding is never worn, so it is made without the attack. A small model tends to describe a weapon and leave `like=` out, so one invented in a category of your weapons with nothing to start from fights as your weapon of that category it is most like by name (a word shared either way, so a crossbow is like a bow), or the first of them, taking any stat that attack reads which the proposal left out, and the answer says so ("It fights as Hand axe does."). The Game Master's proposal form also tells it that a weapon made like one fights like it.

A weapon's tags are what its blows carry. A creature's `resist` or `immune` entry may say what gets through it: `{ "type": "tearing", "except": ["silver"] }` is taken in full from a weapon tagged `silver`, and resisted from anything else. Gravewatch's grave wight is written that way, and its silver coffin nail gets through.

The weapon's details and the Game Master's line say what it does: `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, with `1d8 with a hand free` for Ember Roads' boar spear and `at 6` beside Gravewatch's spade.

#### Ammunition and reloading

A weapon may shoot something, and may keep a loaded count of its own (Capability API 1.57). Ember Roads' hunting bow shoots arrows, and Gravewatch's watch pistol holds one ball, loaded out of the warden's shot and powder:

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: what the weapon shoots, by one of your item `tags`. Each attack takes `perAttack` (1 when it says nothing) of the items with that tag its holder carries, worn or not, out of the first such stack in their bag, then the next. The weapon is offered only while they carry enough, and the fight menu says how many are left. After a fight the party wins, `recover` (from 0 to 1) of what each of them shot comes back to the stack it came from: the share is added up over the whole fight and rounded down once for each stack, so half of five arrows shot out of one quiver is two. A fight that is lost or fled gives nothing back.
- `clip`: a loaded count the weapon keeps on itself. `max` is how many it holds, written down or read off a number stat of the item, and `reload` is the budget a reload spends. An attack spends what is loaded instead of taking from the bag, and the weapon is offered only while it holds enough for one. A **Reload** option on the fight menu spends `reload` and fills it: out of the bag where it has `ammo` (as much as the bag still holds when that is less), and in full where it has none. The count is kept on the weapon's inventory stack, so a pistol emptied in one fight is still empty in the next. A weapon nobody has fired yet is loaded, and so is one a player pours into a stack of several of it, since a loaded count is one weapon's. A clip's rounds are not picked up after a fight, so `recover` is for a weapon without one.

What a fight shoots, loads and picks up is written to the inventory as each step is taken, the way the party's health is, and the journal says what was used. A step whose stack is gone, or holds fewer than the fight counted on, is refused, as a spent item the fight cannot find is. The fight log says every shot, reload and pickup ("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), and the item's details and the Game Master's line say what the weapon shoots and holds: `ammunition Arrow (1 an attack, 50% picked up after a won fight)` and `holds 1, reload (Act)`.

#### Modes, a second weapon, a floor and conditions on a hit

A weapon may have other ways to make its attack, a partner in the off hand, a least harm it deals and conditions it puts on what it hits (Capability API 1.58). Ember Roads' hunting bow can loose a volley, and Gravewatch's silver coffin nail may be held in each hand and marks what it bites deep:

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: up to six other ways to make the attack, each with an `id`, a `label` and what it changes. `ammo` is how many one attack in it shoots, so the weapon has `ammo` or a `clip` to shoot from. `toHit` is what it adds to hit, dice in a pool fight and a number in a summed one. `target` moves a pool fight's per-die target by this much (from the weapon's own, else the pool's; `+1` is harder), where the pool's target can move. `targets` is how many it may be aimed at, each its own attack roll. The fight menu asks which way once the attack is picked (after its initiative style, where there are styles), each with what it is expected to do, and offers only the modes its holder has the shots for. A party member the Engine plays weighs every mode aimed at one target, and leaves a mode for several to a player. In a window, an attack is made as it is.
- `offHand`: a weapon for the off hand. The combat block names the budget a second attack spends, and whether its damage keeps a positive ability:

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Once its holder has attacked this turn with one weapon marked `offHand`, each other such weapon they wear offers a second attack on that budget, named "Silver coffin nail, off hand" on the menu. `ability` is `full` (the default) or `penalty-only`, which adds the damage ability only when it takes something away, as 5e's two-weapon fighting does. An off-hand attack is one blow, whatever strikes the main attack buys, and never a strike at somebody walking away. A weapon marked `offHand` needs the combat block's `offHand`.
- `floor`: the least a hit deals, written down or read off a number stat of the item. A pool fight's harm after soak, or a summed fight's damage, is raised to it before a resistance halves it, and the log says so. A spending blow throws its maker's number and is never raised.
- `onHit`: up to four of your conditions the target takes when the harm the blow dealt reached `atLeast`, for `rounds` of their own turns or, without it, until something takes it off. The harm is what reached them after soak and their resistances; a taking blow takes initiative rather than harm, so it puts none on.

The weapon's details and the Game Master's line say all of it: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance` and `Marked for 2 rounds when a hit deals 2 or more`.

### Armor and worn effects in a fight

What an item does while worn or carried may also change a fight (Capability API 1.56), for its holder, alongside their conditions and levels. Each takes the parts of a condition a fight reads:

- `effects`: any of a condition's but the four a level cannot have (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-approach-source`), since nobody put an item on its holder and it never ends by itself: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` and the rest.
- `modifiers`: changes `to` defense, attacks and speed as well as checks and saves, exactly as a condition's; in a `dice-pool` fight a change to attacks is a flat number of dice, as a condition's is.
- `resist`, `vulnerable` and `immune`: kinds of harm its holder takes half of, double, or none of, as a creature's are (and checked against `combat.damageTypes` when you declare any). `conditionImmunities`: your own conditions that are never put on its holder.

Gravewatch's cursed widow's ring costs a die on every attack, its bound Dawn bell keeps its bearer from being rattled, and an Ember Roads waystone carried keeps the heat off:

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

A fight reads each item once, named for the stack ("Widow's ring" beside a roll in the log, and on a defense), as a check does; an unmet requirement's `otherwise` counts in a fight too, so armor too heavy for its wearer can cost speed. An item's details and the Game Master's line say all of it ("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). Armor that simply adds to a defense or a soak is an item stat read with `itemStat` (see Items on the sheet), as Ember Roads' Guard reads the coat worn.

**Hardness.** Where initiative is a number attacks move, `combat.pool.hardness` is a fighter's hardness, read off their sheet as the fight begins (their armor's, through `itemStat`), and a creature gives its own `hardness`. A spending blow whose dice are below it lands and does nothing: the maker's number still goes back to the base, the log says so ("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing."), and the menu forecasts no harm for it. Only a ruleset with a style that spends may have it, and a creature written as a sheet takes it from the sheet.

### Using items in a fight

An item may be used in a fight (Capability API 1.59): a poultice pressed on a cut, a tonic swallowed, a bell rung. Its `use` says what using it does in the words a catalog entry's `mechanics` use (see [What a fight reads from `mechanics`](#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` or `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount` and `friendlyFire`, with the `budget` it spends, or `free`. Ember Roads' poultice, and Gravewatch's warming tonic and dawn bell:

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

- A use is on the fight menu under **Items**, named for the item ("Poultice") whatever the stack is called. An item that takes slots or binds is used while it is worn (and bound, where it binds), as the bell is; any other while it is carried.
- It spends a budget, or is `free`, and pays with itself: a `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` or `rider` is for a catalog entry a sheet holds, and is refused on a use.
- `toHit`, on a use with `attackRoll`, is what it adds to hit, as a weapon's `toHit` says it (see Weapons in a fight): abilities, a skill, a bonus and, in a pool fight, a per-die target. Without it the roll adds nothing.
- `saveDifficulty`: the number a save it asks for is rolled against (its own, one that ends a condition it applies, or a clause's without a `difficulty`), written down or read off a number stat of the item. An entry on a sheet reads that number off its catalog's source; an item has none, so it says its own.
- `consumes: true` takes one off the item's stack each time it is used, and the menu says how many are left. The last one used takes the stack with it.
- `restore` (Capability API 1.60) gives back some of a pool of each sheet it lands on, as a blood bag gives back blood: `{ "pool": "resolve", "amount": { "flat": 1 } }`, with `dice` and `flat` as an `amount` has them. It names one of your live pools, never the health pool (health comes back with a heal), and is on a use that helps, a `heal` or a `buff`. A creature has no pools, so it takes nothing. The log says it ("Ada gets back 1 Resolve, and is on 3 of 4."), and a party member the Engine plays leaves a full pool alone. Gravewatch's warming tonic restores a point of Resolve beside its heal.
- `charges` spends that many of the item's own `charges`, whose `max` is how many it holds, from 1 to 100, written down or read off a number stat of the item (an item that gives that stat as less than 1 is refused, and one past 100 holds 100). The count is kept on the item's inventory stack, so a bell rung twice in one fight has one charge left in the next, and one nobody has rung is full. Charges are one item's, so an item that holds them has a `stack` of 1. A use is used up or spends charges, never both, and an item's charges are always spent by its use. Two keys of `charges` go on (Capability API 1.61), as Gravewatch's dawn bell has them:

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: which of your `rests` bring the charges back, and how many: `"max"` fills the item, and an amount (`{ "dice": "1d6", "flat": 1 }`) gives back that many, never past `max`. A rest brings back the charges of every item its character carries that names it, whether the sheet's Rest button takes it or the Game Master's `[sheet: op="rest"]` does; the sheet and the bag are written together, and a regenerated reply recharges only once. The sheet says what came back after the rest ("Dawn bell 3/3 charges"), and the Game Master sees each item's charges left beside it in the inventory ("2 of 3 charges left").
  - `breaksOn`: when a use spends the last charge, the Engine rolls a d`die`, and at or under `atMost` the item breaks and is gone from the bag, in a fight and outside one. The fight log says so ("Dawn bell breaks (a 1 on its die)."), the Use button's report does ("Its last charge spent, it breaks."), and the journal counts it as lost.
- `gate` (Capability API 1.62) is a check its user passes before the item works, as a scroll of a spell above the reader's own asks for one. `check` names what is rolled: `{ "skill": "ward" }`, `{ "ability": "wits" }`, or a value off the sheet (`{ "value": { "derived": "spell_mod" } }`, for a number that differs from one character to the next, as a 5e caster's spellcasting modifier does). `difficulty` is from 1 to 100, written down or read off a number stat of the item (an item that does not give it is left off the menu, and its Use button says it plainly). `unless` skips the check when a value on the user's sheet is at least `atLeast`. A failed check uses the item up (or spends its charges) for nothing. In a fight the check is rolled as the item is spent, with the fight's own dice (a pool in a pool fight, where `difficulty` is the successes it needs) and the sheet's number read as the fight began, and what the user's conditions and worn items add to that check counts, a skill's own included. The log says it ("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). Gravewatch's page of the vigil litany has one:

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

What a fight uses up and the charges it leaves are written to the inventory as each step is taken, as a weapon's shots are, and the journal says what was used. The fight log says each use ("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). A party member the Engine plays uses a heal only on somebody hurt, and nobody uses an item to strike at somebody walking away. The item's details and the Game Master's line say what using it does: "Use (Action): heals 1d4 + 1, range 0 paces, used up" and `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, and the details show the charges left. An item the Game Master invents `like=` one of yours is used as that one is, charges and all.

### Using items outside a fight

The same `use` works outside a fight (Capability API 1.60 for `restore`; the rest needs nothing new). The inventory's **Use** button, on one of your items with a `use`, and the Game Master's `[inventory: action="use" item="Poultice" who="Juno"]` both do what the item does to whoever carries it, with the Engine's dice:

- A heal gives back health: the amount on a health pool, or one mark cleared on a wound track, as a heal in a fight does. `temporary` points go on a health pool, `restore` gives back its pool, and each condition it `applies` is put on, until something takes it off.
- A use that harms, or is aimed at the other side (`kind` `attack` or `debuff`, or `targets` `enemy`), lands on nobody: outside a fight there is nobody on the board to hit. The item is still used, and the Game Master is told what it does, to narrate.
- It takes one off the stack or spends its charges exactly as a fight does, and one with none left, or one that takes a slot or binds and is not worn, is refused and changes nothing. The sheet and the bag are written together.
- A `gate` is rolled first, as a check is: the ruleset's own dice with the sheet's number, the user's wound penalty and what their conditions and worn or carried items do to that check. A failed one uses the item up for nothing, and the line says so ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

What happened is said in one line: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." The Use button sends it to the Game Master in an `[item_used]` block after "I use my Poultice.", which the chat shows as a badge; the Game Master's own tag is answered with it, measured from where the turn began like its other tags, so a regenerated reply never uses an item twice. An item without a `use`, or in a game without a ruleset, is still simply said: "I use my rope."

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
every name in it is yours. There are two kinds: `attack-vs-defense`, where dice are added up and
compared with a number, and `dice-pool`, where a fight throws your `dice-pool` ruleset's own pools
and counts successes (see A fight thrown in pools, below).

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

- `kind`: `"attack-vs-defense"` (one side rolls dice against the other's defense; a hit does damage)
  or `"dice-pool"` (see A fight thrown in pools). Every key below means the same under both, read
  the way that kind reads numbers.
- `health`: required. What a fight takes away. Either `{ "pool": "grit" }`, a live pool it counts
  down, whose temporary buffer if it has one is what damage drains first; or `{ "track": "harm" }`,
  a wound track it MARKS. A track needs `damageKinds` beside it, and grants no temporary points.
- `defense`: required, a value reference. A field the player enters, or a derived value you compute.
- `initiative`: required. The dice rolled once at the start, and an optional modifier reference. A
  tie goes to the higher modifier, and then to the order the fight was set up in. `"each": "round"`
  throws everybody's initiative again as each new round begins, with the modifier as it stands then
  (so a modifier that reads a wound track is slower once wounded), and the round starts at whoever is
  first in the new order. Capability API 1.47. A `dice-pool` fight may throw it as a pool instead:
  `pool` (a value reference) is how many dice, and their successes plus `plus` are the number, with
  no `dice` or `modifier` beside it. `resource`, which needs `pool`, keeps that number and lets attacks move it (see
  "Initiative that attacks move", below). Capability API 1.48.
- `attackRoll`: required under `attack-vs-defense`, and refused under `dice-pool`, which throws your
  resolution's own pools. The dice, whether the system rolls twice and keeps one (`advantage`), what
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
  `toHit.skill` names an `enum` column holding one of your skill ids: the row adds what a check of
  that skill adds, with the row's own `ability` in place of the skill's when it names one, exactly as
  a check's `with=` swaps it (Capability API 1.47).
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
  `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`,
  `cannot-target-source` and `cannot-approach-source`.
  `failsSaves` names saves the condition fails without rolling. The six that need distance or
  movement (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`,
  `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`)
  are read by a fight on a board and say nothing in one without (see Positions). `cannot-react`
  keeps its holder out of the window a walk opens, so they are never asked. Four more keys sit
  beside the effects:
  - `modifiers`: the numbers it changes while it holds. See Numbers a condition changes, below.
  - `saves`: which of your saves the two save effects, and any modifier to saves, are about. All of
    them when it is left out, and naming it with neither beside it is refused.
  - `skills`: which of your skills the two check effects, and any modifier to checks that names no
    skills of its own, are about. All of them when it is left out, and naming it with neither beside
    it is refused. A fight's contests roll the fight's own checks, not skills, so something narrowed
    to skills never reaches one; a check outside a fight on one of those skills reads it (see Checks
    outside a fight, below). Capability API 1.53.
  - `whileSourceInSight`: what counts only while whoever applied it is in the holder's line of
    sight. `true` gates the whole condition; a list of its own effects gates only those and leaves
    the rest standing, which is what a fright that stops you walking any nearer whether or not you
    can see it needs. Naming an effect the condition does not have is refused. Without a board there
    is no line to break, so everything counts either way.
  - `endsWhenSourceDown`: it comes off the moment whoever applied it goes down.

  `own-saves-advantage` and its opposite roll the save twice and keep one, exactly as an attack is
  rolled, and they cancel each other out. `own-checks-advantage` and its opposite do the same to the
  holder's side of a contest, which is where a fight makes its ability checks, and to their checks
  outside a fight. `resist-all` halves every kind of harm on top of whatever
  the target's own hide said, and cancels against a vulnerability the same way.
  `cannot-target-source` keeps the holder from pointing anything at whoever put it on them, and
  `cannot-approach-source` keeps them from walking any nearer to that somebody than the cell they
  stand in, the route included: a way round to a cell just as far off is still offered, and one
  that would dip past them and come out the other side is not.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Numbers a condition changes.** Each entry in `modifiers` names what it changes, `to`, and by how
  much:
  - `defense`: the number an attack against the holder has to reach. A flat number only.
  - `attacks`, `saves`, `checks`: the holder's own attack rolls, saves and contest checks. A flat
    number, or `dice` rolled every time the roll is made (`"1d4"`); `minus: true` takes the dice
    away instead of adding them.
  - `speed`: how far the holder walks, in your own distance unit (`flat`), or `times` 0.5 or 2 for
    half or double, applied after every flat change. Read only on a board, as `speed-zero` is.

  A modifier to `checks` may name its own `skills`, and one to `saves` its own `saves`, which narrow
  it in place of the condition's. Either may roll twice with `mode: "advantage"` or
  `"disadvantage"`, counted with the effects of the same name and cancelling as they do, with or
  without a number beside it; so one condition can make Sneak harder and Climb easier at once. These
  three keys need Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  A flat number carries its own sign, and 0 is refused. Every modifier shows in the log beside the
  roll it changed, with the condition's name ("12 + 5 + 3 (Blessed) = 20"), and the menu's chance to
  hit and chance to win count it. Conditions stack with each other; the same condition twice is still
  one condition.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: optional. Levels of a live track that count as conditions while the track is high
  enough, which is how a condition that gets worse in steps, such as exhaustion, is said. Each entry
  names a plain `track` (not a wound track), the level `at` which it starts, and what it does, with
  the same `effects`, `modifiers`, `failsSaves`, `saves` and `skills` a condition has. Every level the track has
  reached counts, so they add up as it climbs. A level has no source and ends only when what it
  reads goes down, so `half-move-to-stand`, `ends-on-damage`, `cannot-target-source` and
  `cannot-approach-source` are refused on one. Only a combatant with a sheet has tracks. The log names
  a level by its track and number ("- 1 (Heat 3)").

  In place of `track`, a level may read a `derived` value (Capability API 1.54), worked out with the
  character's live state and items, so nobody has to tick anything: Ember Roads slows anybody carrying
  10 bulk or more.

  ```json
  { "derived": "bulk_carried", "at": 10, "modifiers": [{ "to": "speed", "flat": -2 }, { "to": "checks", "skills": ["sneak"], "flat": -1 }] }
  ```

  A threshold that differs from one character to the next ("more than five times Strength") is a
  derived value that subtracts it: `scale` by -1 gives the part to take away, and a `sum` of the two is
  what the level reads.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] }
  ]
  ```

  Modifiers, levels and the check effects need Capability API 1.45.

- `checks` and `contests`: optional. What a contest reads, and the contests anybody in a fight may
  start: grabbing, shoving, breaking free. See Contests, below. Capability API 1.43.
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
- `pool`: required under `dice-pool`, refused under `attack-vs-defense`. See A fight thrown in pools.
- `spendLimits`: optional. How much of a live pool one combatant may spend per `turn` or per `round`
  in a fight, whichever kind it is: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`.
  `max` is read once as the fight begins. A cost past what is left of the limit is not affordable,
  so it is off the menu, however much is in the pool. A limit per turn starts again at the start of
  its holder's own turn, one per round when a round begins. An opponent written in plain numbers pays
  for nothing off a sheet, so a limit never binds one; an opponent written as a sheet pays from its
  own pools and is held to the limit like anybody else. Capability API 1.47.
- `threat`: optional, and needed by a bestiary. `tiers`, the scale an opponent is picked from: an id,
  a label, a `health` band, a `defense`, a `toHit`, a `damagePerRound` band and a `saveDifficulty`.
  Every creature you ship names one of these tiers, and an opponent nobody wrote is pulled onto the
  one the Game Master asked for, so nothing lands off your scale. The `damagePerRound` band is read
  as what a creature does to ONE target in a round, its whole sequence included.

### A fight thrown in pools: `dice-pool`

A `dice-pool` ruleset counts successes rather than adding dice up, and its fights can too.
`"kind": "dice-pool"` needs `resolution.kind` to be `"dice-pool"`, and it reads the sheet the way your
pool checks already do: **every number a roll adds is a number of dice, and every number it meets is
a count of successes.** So nothing is renamed:

- A to-hit number (an attack row's, an ability list's `toHit`, a creature action's) is the pool an
  attack throws. The die, the target a die has to reach, and what the faces double, explode, cancel
  and botch on are your `resolution`'s. The wound track your `resolution.penaltyFrom` names takes its
  penalty off the pool, as it does off a check.
- `defense` is how many successes an attack needs, and never fewer than one. A condition's modifier
  to `defense`, and `cover.bonus`, add to it.
- Each success past the ones needed adds one damage die. A botch misses, whatever it counted. There
  are no criticals: a strong hit is worth its extra dice.
- A save's number is its pool and its difficulty the successes it needs. A contest throws each side's
  check as a pool, and the side with more successes wins.
- A condition's modifier to attacks, saves or checks is dice added or taken away, so it is a `flat`
  number: a rolled modifier (`dice`) is refused.
- Damage is dice of your die: an amount's `dice` (a creature's, an entry's) says how many, and has to
  be of your die, and its `flat` part is automatic successes, never thrown. An attack row's damage
  dice column is read for its count, `damage.ability` adds that ability's rating as dice, and
  `damage.bonus` adds automatic successes. `perCostStep` and `scales` add dice, as they always have.
  Healing and temporary points are amounts, and are added up as before.
- Initiative is a sum (`initiative.dice` and `modifier`), or a pool when you ask for one
  (`initiative.pool`, below), and a dying rule keeps its own dice.

What a pool fight rolls beyond that is its `pool` block:

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: whether a roll that leans is thrown twice with the one with more successes kept (a
  botch counts as fewer than any throw that did not botch). Without it, a fight throws once whatever
  a condition says.
- `damageTarget`: the per-die target damage and soak dice are thrown against. Your resolution's
  default target when you leave it out. Those dice count each face at or above it once and nothing
  else: nothing doubles, explodes, cancels or botches on them.
- `soak`: what a target takes off the harm a hit does, by kind of harm. `all` is a value reference
  for any kind, and `byKind` one per kind of your health track, which wins over `all` for its kind;
  a kind neither names is not soaked. With `"roll": true` the target throws that many dice against
  the damage target and each success takes one off. With `"roll": false` the number comes off the
  damage dice before they are thrown, so it never touches automatic successes, which thrown soak takes
  off like any other. Nothing goes below zero, and nothing is thrown to soak a blow that counted
  nothing. A creature gives its own
  numbers as `soak: { "all": 1, "byKind": { "knock": 3 } }`, which needs the block's `soak` to say how
  soak is taken. Resistance, vulnerability, immunity and `resist-all` apply after soak, to what is
  left.
- `hardness`: a value reference for a fighter's hardness, where initiative is a number attacks move.
  See [Armor and worn effects in a fight](#armor-and-worn-effects-in-a-fight).

Every target's damage is thrown for that target, because what a hit earned past its needed
successes, and what they soak, are theirs. A blow's second clause, and a rider, are each their own
damage pool of their own kind, with no extra dice from the hit. The menu forecasts a pool exactly:
the chance to reach the successes needed, and what the damage dice are worth after what the first
target soaks.

Gravewatch is written this way: its wardens throw a rating and a trade, soak knocks with Sinew and
no tears at all, may spend one point of Resolve a turn, and throw initiative again every round.

**Declaring in reverse order is not built.** Some systems have everybody declare their action before
anybody acts, slowest first. In a fight where each combatant picks one action when their turn comes,
declaring first changes nothing any rule reads, so there is nothing for a key to say.

### Initiative that attacks move

Some pool systems keep initiative as a number for the whole fight and let attacks move it: one way
of attacking takes it from the target, another spends the attacker's own as damage, and whoever
falls to a set line has crashed. A `dice-pool` fight can say so (Capability API 1.48):

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **The opening.** Everybody throws `pool` dice as the fight begins, and the successes plus `plus`
  are their number, so `resource` needs `pool`: summed dice are an order, not a number of dice. A creature's `initiativeModifier` is its pool, since every number a pool fight
  adds is dice. The number is kept: it is never thrown again (`each` is refused beside `resource`),
  and as each round begins the order is sorted by the numbers as they stand.
- **Styles.** Every attack (an attack row, an ability or catalog entry that rolls to hit and does
  harm, a creature's action that does, and an action made of other actions) is offered once per
  style, and a player picks the style before the target. Up to four, each either takes or spends,
  and at least one takes. A choice that names no style is made in the first; one the attack is not
  offered in is refused. An attack keeps the style it was made in until it is over, even when an
  answer changes its maker's number before it lands.
- **A style that takes.** On a hit, the damage is thrown as usual (the extra dice from the hit, the
  weapon's dice, soak by kind, automatic successes), and what it counts comes off the target's
  number instead of their health. The attacker gains all of it plus `gain`.
- **A style that spends.** Offered only while the attacker's number is above the crash line (0 when
  you give no `crash`), and never for an action made of other actions, since a number is spent on
  one blow. On a hit, the damage is the attacker's number as they made the attack, in dice against
  the damage target, and nothing else: no weapon dice, no extra dice from the hit, no automatic successes, no
  soak. It marks health by the attack's own kind of harm. Once the attack is over, a number that
  landed anywhere goes back to `base`, and one that landed nowhere loses what `onMiss` says at the
  number it was made with (a step table: `[at least, lose]` pairs, ascending; nothing below the
  first step).
- **Crashing.** A number that falls to `crash.at` or below has crashed: the `condition` (one of your
  own, and optional) is put on them, and whoever took them there gains `bonus`. A miss that crashes
  its own maker gives nobody a bonus. A crashed combatant cannot spend. The crash lifts, condition
  and all, when their number rises above the line again, after `recoverAfter` of their own turns
  (their number goes back to `base` as that turn begins), and when the fight ends however it ends.
  Somebody whose opening throw is at the line or below starts the fight crashed. `base` has to be
  above `crash.at`, or going back to it would crash them again.

The menu shows each style's own forecast: the chance to hit, and what a taking style would take or
the harm a spending one would do. The status panel shows everybody's number, and the log says every
change and why: "Ada gains 5 initiative for crashing Rats, and is on 14." The Engine's picker weighs
a taking blow one turn ahead: taking and then spending against spending now and again from the base.

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
`saveEnds` naming the save and whether it is repeated at `turn-end` or `turn-start`. Rounds count the
holder's own turns down as each one ends; `{ "rounds": 1, "at": "turn-start" }` counts them as each
begins, which is how "until the start of your next turn" is said. `endsAfter` takes the condition off
after the first `own-attack` (the holder's next attack roll), `attacked` (the next attack roll made
against the holder) or `own-save` (the holder's next save), whatever its clock says, so
`{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` is "on its next attack before the end of
its next turn". One that lasts an attack lasts the whole of it, its damage included, and a fresh one
the same blow puts on stays. Both need Capability API 1.45. `temporary`
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

The numbers below are the plain way to write a creature. One written in your ruleset's own terms,
as a `sheet`, takes `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`,
`checks`, `soak` and `hardness` from that sheet instead (see "A creature written in your ruleset's own terms", below).

- `health`: a number, or `{ "dice": "3d6", "flat": 2 }` thrown once when the fight is created. A
  forecast reads the average, so a menu never promises a die nobody has thrown.
- `defense`, `initiativeModifier`, `speed`: what an attack is rolled against, what it adds to
  initiative (or, where initiative is thrown as a pool, how many dice it throws), and how far it
  walks in one turn, in your own distance unit.
- `abilities` and `saves`: keyed by the ability ids and save ids your sheet declares. A save it does
  not name reads as zero.
- `checks`: what it adds in a contest, keyed by the ids of `combat.checks`. One it does not name reads
  as zero. Capability API 1.43.
- `soak`: in a `dice-pool` fight only, what it soaks: `all` for any harm, `byKind` for a kind of your
  health track. Capability API 1.47.
- `hardness`: where initiative is a number attacks move, a spending blow whose dice are below it does
  nothing. Capability API 1.56.
- `resist`, `vulnerable`, `immune`: damage types, matched without case, and checked against
  `combat.damageTypes` when you declare any. A `resist` or `immune` entry may also say what gets
  through it, `{ "type": "tearing", "except": ["silver"] }`: a blow from a weapon item carrying one
  of those item tags is taken as it comes (Capability API 1.55, see
  [Weapons in a fight](#weapons-in-a-fight)). `conditionImmunities` names your own conditions.
- `tier`: which rung of `combat.threat` it belongs to.
- `traits`: short name and text pairs the Game Master is shown. They are never resolved, so
  anything with numbers in it belongs in an action.
- `signaturePoints`: points given back at the start of its own turn, spent on `signature` actions.
- `riders`: up to four, the same thing a catalog entry's `rider` is, written on the block. Each one
  is `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`,
  with an optional `type` and an optional `actions` naming which of this block's own actions it
  fires on. A block's rider reads no sheet list, so `sources` and `requires` are the two keys it
  does not have. A creature written as a sheet gets the riders its lists carry, exactly as a
  character does.
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
    only while somebody else is acting: the fight offers it in the window between one turn and the
    next (see Windows).
  - `reaction`: the same object a catalog entry's `mechanics.reaction` is (see Windows): the action
    is on no turn's menu and is offered at the moment it names instead. A reaction is not also a
    signature action, and no sequence may make one.
  - `self: true`: it lands on the creature itself rather than on somebody else, and so takes no
    `targetCount` or `area`. Both need Capability API 1.46. A Parry is both, with a `parrying`
    condition that adds 2 to defense:

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```
- A save needs a difficulty on the action itself: `save.difficulty` for a save the action forces, or
  `saveDifficulty` for a condition that ends on a save when the action has no save of its own. A
  block action is written in plain numbers even on a creature with a sheet, so that number lives on
  the action. A clause's own save may leave its `difficulty` out and fall back to that same number.
- `damage.plus` is the same list of clauses a catalog entry's `plus` is, and reads exactly the same
  way: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }`
  is a bite that carries the heat as its own amount, resisted on its own and doubled on its own.

The 5e draft's own bestiary is five hand-written creatures in
`docs/development/ruleset-5e-2014.example.json`, covering a sequence, a recharge, a save with a
condition, resistances and immunities, limited uses, signature points, and one written as a sheet.

#### A creature written in your ruleset's own terms

A creature does not have to be written in plain numbers. Give it a `sheet` instead, in exactly the
shape a character's sheet has, and a fight builds it the way it builds a party member: its health,
defense, saves, initiative, speed and every attack and ability on its lists are whatever your own
sheet formulas make of it. That is how a ruleset whose opponents have the same abilities, skills and
lists as its characters says so, whatever those are. Ember Roads' Toll Warden:

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Every part is optional**: `abilities`, `skills`, `saves`, `bonuses`, `fields` and `lists`, keyed
  by the ids your sheet declares. Anything left out reads as your sheet's own default, exactly as it
  would on a blank character. The warden's Grit is 9 because your `grit_max` adds 4, its Toughness
  and its Brawn, and its Guard is 7 for the same kind of reason.
- **Each number has one place it comes from.** A creature with a sheet does not also give `health`,
  `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` or `checks`, and the Engine refuses
  the file
  if it does. It may have no `actions` of its own, because its lists are what it does. A creature
  without a sheet still gives the first three and at least one action.
- **It is checked as the authored data it is.** Every id has to be one your sheet declares, a skill
  or save is set to one of the proficiency tiers you offer for it, a field, score, bonus or column
  holds what it is declared to hold (a whole number inside its range, one of its values, and so
  on), and a list holds no more rows than it allows. There is no `live` part, because what a
  creature has spent is the fight's to keep.
- **A row can come out of a catalog.** `_catalog: "<catalog>/<entry>"` names the entry a row was
  picked from, as it does on a character's sheet, and that entry is where a fight reads what the row
  costs and does. The catalog has to be one that feeds that list. When the catalog is written
  inline, the entry has to be in it; when it lives in its own file, a row naming an entry the file
  does not have simply gives the creature nothing. The catalogs a bestiary's sheets name are loaded
  for the fight along with the bestiary.
- **What the entry says beside the sheet still counts**: `tier`, `traits`, `actions`,
  `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` and `conditionImmunities`.
- **It pays out of its own pools.** They start full, it spends them on what its lists give it, and
  it is offered the bigger ways of paying (a spell out of a higher slot) exactly as a party member
  is, whether the Engine or the Game Master decides for it. The warden's Hold the Line costs it Luck.
- **On a wound track, its health is the track.** A blow marks the creature's own track by your
  `damageKinds`, after its `resist`, `vulnerable` and `immune` have had their say, so a creature
  immune to a kind of harm takes no mark from it.
- **It is still an opponent.** At zero it is out rather than dying, it never rolls against death, a
  screen shows what an opponent always showed and none of its sheet, and nothing it spent is written
  back anywhere, even when a character shares its name.
- **A sheet that adds up to no health at all** is left out of the fight, and the opening log says
  why, rather than walking in as something nobody can hurt.
- A layer that takes a value out of one of your enum fields never costs a creature that uses it:
  while the layer is on, that field reads as its default for the creature, exactly as it does on a
  character, and the creature is not refused for it.
- A Game Master can invent one too, and it is held to its tier (see Opponents nobody wrote).
- A package that ships one declares Capability API 1.34.

The 5e draft's Toll Sergeant is the same thing on a d20 sheet: its Armor Class, hit points, saves
and two swings an action all come from its own fields and its attacks list.

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

An invention may also be written as a `sheet`, the same way a bestiary creature can, and that is how
an invented mage gets slots and spells. The Game Master is shown your sheet's ids and what each may
hold, the lists a fight reads, and the names your catalogs offer for them, so a spell is named
rather than described: a row that names a catalog entry, in any case, becomes that entry, and the
Game Master's own values (such as a spell being prepared) go on top. The sheet is read leniently,
because a model wrote it: a name your ruleset does not have is dropped, a value is fitted to its
field or column, and numbers written beside the sheet are not used.

An invented creature that is not a boss is held to what your ruleset opens to it. A catalog filter
with `startFrom` names the sheet field its entries are organised by (the 5e package's spell list by
`class`), and an invented creature keeps only the entries whose filter matches its own value of that
field, matched the way the picker opens on it. So a Sorcerer never has the whole spell list, and one
that names no class has nothing from a catalog organised by class. The choices it left open are then
filled in without asking the Game Master again: for every list whose rows count only once chosen
(`onlyWhen` on a combat ability source), out of the entries open to it that it can pay for from its
own pools, each pool it has is topped up to a small number of entries (more for a more competent
creature) and so is what it can use at will. What it gets leans on its temperament and competence,
the same ones it fights with: a protective or supportive creature reaches for what holds up its side,
a reckless one for harm, a methodical or patient one for what holds a foe back, and the more
competent it is, the likelier it is to carry a reaction, a counter or anything else that bends the
turn. The draw comes from the fight's own seed, so the same fight always fills the same way. A row
the Game Master named from such a list counts as chosen.

A boss is the Game Master's to write in full, as the exception it may be: nothing is taken off it
and nothing is filled in.

Then either is held to its tier:

- Health goes into the tier's band through the one field your health is read off: the pool's
  maximum is that field, or is a `sum` with exactly one field in it (5e's hit point maximum, Ember
  Roads' Toughness). A health formula with no single field in it is left as written, and the log
  says so. A wound track's length is yours and is never changed.
- Once the creature is built, defense, to-hit and save difficulties are held to two above the
  tier's own, and the damage is scaled down until its best round is inside the tier's
  `damagePerRound`, counting the biggest payment it can afford. What a bigger payment buys gives
  way first, then the dice, the flat part, a strike, and only then the size of the die.

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
with, the walk STOPS where it stands and that enemy is asked whether to strike. Taking it spends the
budget and resolves exactly as the same attack would on their own turn; letting it go by costs
nothing. Either way the walk then picks up where it was held, paying for every cell it really
crossed, and a strike that drops the mover ends the walk where they fell. One chance each for a
whole walk, however many times the path leaves the same reach. `disengage` prevents it for the rest
of the turn, and a ruleset that declares no `opportunity` has none of this at all.

The asking is a WINDOW, and it holds the whole fight: nothing else moves until everybody it asks has
answered. A party member's window is the player's to answer, with the strike or a Pass beside it;
everybody else's is answered by whoever plays them, a Game Master's boss through the Game Master's
own decision. See Windows below.

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

The fight plays on the battle screen in your words. The menu is your attacks, your abilities, your
contests and the standard actions you listed, each saying what it spends out of your budgets and
your pools. Turn order, the round, every condition you named with its rounds left, temporary points,
concentration, and the two counts of your dying rule are all shown. The log prints the real
arithmetic in your terms: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard
6, a hit." Every accepted action is written to the sheet as it happens, so a reload mid-fight is
exact and the Game Master is told afterwards not to change those numbers again.

A fight with positions is drawn on the board instead of on the portrait stage; see Positions for
what the player does with it. Every distance on it, in the menu and in the log, is said in YOUR
unit: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Contests: grabbing, shoving, breaking free

Some moves are not an attack against a defense but a contest: both sides roll, and whoever does
better gets their way. Grabbing somebody, shoving them over or away, and breaking free are all one
shape, so a ruleset says each of them as data:

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** are the numbers a contest reads, each a value off the sheet, read once when the fight
  begins the way a defense or a save is. A creature written in plain numbers gives its own
  (`"checks": { "brawn": 2 }`); one with a sheet reads them off it. Up to twelve.
- **The roll.** Both sides throw your `attackRoll.dice` and add the best of the checks they may use
  here (`attacker.checks`, `defender.checks`). The higher total wins; a tie goes to the defender
  unless `ties` says `"attacker"`. The log says both sides:
  "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with
  Brawn, and wins."
- **Winning** does what `onWin` says, at least one thing:
  - `applies` puts conditions on the loser with the winner as their source, so a condition you mark
    `endsWhenSourceDown` ends when the one holding on goes down. `rounds` gives one a clock; without
    it, it lasts until something ends it.
  - `ends` takes conditions off the actor or the target.
  - `push` moves the loser straight away from the winner, that far in your distance unit, stopping
    short of anything solid, anybody standing, the board's edge and a corner too tight to squeeze
    through. It is forced: it spends none of their movement and nobody strikes at it. A fight with
    no board moves nobody.
    Losing does nothing, which is what a failed grab is.
- **`from: { "holding": "held" }`** makes a contest aim only at whoever put that condition on the
  actor, and puts it on the menu only while it holds: that is how breaking free is said.
- **`reach`**, in your distance unit, is how far it reaches; the next cell when you leave it out.
  `reach` and `push` need `combat.distance`.
- **`strike: true`** lets it take the place of one strike when an action buys several, the way an
  attack does: taken first, it spends the budget and leaves the rest of the strikes in hand; taken
  with strikes in hand, it costs one of them. The 5e reference grapples and shoves this way.
- **On the menu** a contest has its own group, and says its chance to win. An opponent the Engine
  plays weighs one like anything else, but modestly: a grab or a shove sets something up, and
  breaking free is worth most, only while held. A Game Master playing an opponent picks one off the
  same menu.
- An opponent a Game Master invents has its checks held to its tier, as its chance to hit is.

Contests are Capability API 1.43 for a packaged ruleset.

### Windows: holding the fight open

Some moments belong to somebody who is not the one acting. The Engine holds the fight open for them
rather than deciding for them, and that pause is a window.

Six things open one, and two of them come out of what you already declared:

- **Somebody breaks away.** A walk that leaves the reach of an enemy who could strike stops on that
  step and asks them. See Strikes at somebody walking away, above.
- **Between one turn and the next.** When a turn ends, every opponent holding `signaturePoints` who
  can afford one of its own `signature` actions is asked whether to buy one, before the next turn
  begins. That is the only moment they are bought in: a signature action is on nobody's turn menu,
  its own included.
- **Somebody uses something.** Before it resolves, everybody on the OTHER side holding an entry
  waiting for that moment is asked, whoever it is aimed at, as long as that entry reaches whoever is
  using it. A standard action and a contest open no such moment.
- **Something is aimed at somebody.** Before it resolves, everybody on the OTHER side it is
  pointed at who holds an entry waiting for that moment is asked. A friend healing you is not a
  threat to answer, so a friend's action opens no window.
- **An attack roll hits somebody.** Before its damage, the one it hit is asked, when they hold an
  entry waiting for that moment. What they take counts for this attack: see The moment after a hit,
  below.
- **Something has hurt somebody.** After it resolves, everybody it damaged who holds an entry
  waiting for THAT moment is asked, whoever did it. Being hurt is a fact about you; an entry pointed
  back at whoever caused it still cannot be pointed at a friend.

The last four are what a catalog entry, or a creature's own action, asks for by naming the moment it
waits for. When one action opens both `used` and `aimed`, the use is asked about first; if nobody
calls it off, the ones it is aimed at are asked next, and it resolves once both have been answered.
Being hit is asked about as each of its rolls hits, and being hurt once the whole action is over.

What a window does, whichever opened it:

- **Nothing else moves while it is open.** Not the actor whose turn it is, not the end of that turn,
  not another window. The fight waits.
- **It asks one at a time**, in turn order, and each is asked once. Passing is always an answer, and
  costs nothing. Somebody who is asked and has nothing they can take is skipped rather than asked.
- **It picks up exactly where it was held.** A walk finishes on the cells it had left, paying for
  every one it really crossed.
- **Who answers is who plays them.** Your own party member's window is yours, with the option and a
  Pass beside it on the menu; an opponent's is answered by whoever plays it, and a Game Master's
  boss is asked through the Game Master, with letting the moment go by as one of its answers.
- **It is saved with the fight.** A game closed mid-walk comes back with the same people still to
  ask and the same cells still to walk.

The first two you declare nothing for: a ruleset with `opportunity.budget` gets one, a bestiary with
`signaturePoints` gets the other, and a ruleset with neither never sees them.

**Saying which moment an entry waits for.** Write `mechanics.reaction` as an object instead of
`true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` is `used`, `aimed`, `hit` or `harmed`, and it is what puts the entry on that window's menu.
  Those four are the only moments the Engine watches for. An entry that still says `"reaction": true` says only
  that it is not taken on a turn, which is not enough to offer it anywhere, so it stays on no menu.
- `at` is `source` (the default) or `chosen`. `source` points what is taken at whoever caused the
  moment and fills the target in, so nobody is asked to pick; `chosen` keeps the entry's own
  targets and asks.
- `cancels` stops what the window was holding from happening at all. Only a `used` or `aimed` entry
  may say it: a moment that has already happened cannot be called off, and a hit has been rolled.
- `against` narrows what the entry answers to things used from certain catalogs:
  `"against": { "catalogs": ["spells"] }` answers a spell and nothing else. An action with no entry
  behind it (a weapon on a list, a creature's own action) comes from no catalog, so it never opens
  the moment for an entry that names catalogs. Leave `against` out and the entry answers anything.

Give it a `budget` too, or it spends the list's default. A reaction almost always spends a budget of
its own, which is what stops one turn holding several.

**What it costs is spent before anybody is asked.** A cancelled action is stopped from happening,
not from having been bought: the budget and the pools are already gone. If your system refunds
them, it cannot say so yet.

A counter is written like this, and on a board it answers only somebody within its own `range`:

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**The moment after a hit.** An entry on `hit` is how Shield, a Parry and Uncanny Dodge are said. The
attack is held after its roll, and the one it hit is asked before any damage is dealt. What they take
counts for that attack: its roll is not made again but checked again, against their defense as it now
stands, so a condition that adds to defense can turn the hit into a miss, and a natural face that
always hits still hits. A condition that lasts one attack (`endsAfter: "attacked"`) put on as the
answer covers this attack, its damage included, and is spent by it, which is how "halve that
attack's damage" is said: `resist-all` for one attack.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

The attack picks up exactly where it was held: the rest of its targets, and, for a creature's action
made of other actions, the rest of its parts. Each roll that hits somebody holding such an answer is
held in its turn, and a fight saved while the window is open comes back the same way. An attack made
inside a window (a strike at somebody walking away, a signature action, an answer) is never held,
because nothing opened inside a window opens another. The log shows the roll and what it was made
against when the window opens, and, when the answer changed the defense, whether it now misses.
Opponents the Engine plays take a guard only when it turns the hit into a miss.

A package that names a moment needs Capability API 1.33, and one that uses `used` or `against`
needs 1.44. One that waits for `hit` needs 1.46.

### Not yet

Said plainly, because a ruleset should not claim what the Engine does not do:

- **Beyond the modest board**: no three-quarter or total cover, no elevation, no flying over
  obstacles, no squeezing, no mounts, no hiding or surprise, and nothing moves anybody but their own
  walk and a contest's push. Nobody drags a creature they hold.
- **A contest is plain.** It has no size limits and opens no window (nobody may answer one).
- **An entry may wait for four moments only**, `used`, `aimed`, `hit` and `harmed` (see Windows, above).
  Those are the moments the Engine notices on an entry's behalf; the other two windows, somebody
  breaking away and the pause between two turns, are opened by the fight itself and are not moments
  an entry can ask for. There is no moment for a save being rolled, a death, a turn beginning, or
  anything falling.
- **A counter stops what it answers outright.** It cannot tell one entry of a catalog from another,
  and there is no check to stop something bigger than itself.
- **No chain of them.** The fight keeps one window rather than a stack, so nothing opened inside a
  window opens another: a counter cannot itself be countered, what a reaction deals opens no
  further moment, and an attack made inside a window is not held when it hits.
- **Only an attack roll is a hit.** Something that lands without one (darts that simply hit, an area
  everyone saves against) opens no `hit` moment, and an answer cannot tell a swing from a shot, so a
  Parry the rules keep to swords parries arrows too.
- **Damage is changed by halving, not by an amount.** An answer can make one attack's harm half
  (`resist-all` for that attack); it cannot take a rolled number off it.
- **Nothing is refunded.** What a cancelled action cost is spent.
- **What a condition changes is a closed list.** Defense, attack rolls, saves, contest checks and
  speed (and so for a level and what an item does in a fight), and nothing else: no bonus to the damage its holder deals, and no level that lowers the
  most a character can have or takes them out of the fight.
- **A creature written in plain numbers has no wound track.** On a ruleset whose health is a track,
  such a creature still loses points; give it a `sheet` and its blows mark boxes, softened first by
  its own `resist`, `vulnerable` and `immune`.
- **A rider fires by itself.** `on` has one value, `hit`, so the first qualifying hit of the period
  takes it, and there is no moment at which you are asked whether to spend one.
- **A number attacks move is plain.** A spending blow throws the number and nothing else, so no
  weapon changes it, its `floor` included (a sturdy target soaks a taking blow, and its
  hardness stops a spending one, but nothing else shrinks either); a crash lifts after a fixed count
  of turns however deep it went; and an attack made
  in a window (a strike at somebody breaking away, a reaction, a signature move) is made in the
  first style.
- **An invented opponent soaks nothing and has no hardness.** A creature the Game Master makes up for
  one fight is held to your threat scale, which says nothing about soak or hardness, so it has neither.

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
