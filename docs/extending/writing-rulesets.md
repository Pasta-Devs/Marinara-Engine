# Writing Game Mode Rulesets

A ruleset tells Game Mode how a tabletop system works: which dice a check rolls, what is on the character sheet, which resources get spent, and what a rest gives back. This guide is for people who want to write their own and share it. To play on a ruleset somebody else made, start with [Choosing rules](../game/getting-started.md#choosing-rules).

A ruleset is one JSON file. It is data, not code. Nothing in it runs, so importing one cannot do anything to your computer. The one part that deserves a careful read before you import somebody else's file is the Game Master text, because that text is sent to the model in every game that uses the ruleset.

## Read this first: what a ruleset can and cannot do

A ruleset can only fill in the blanks of a mechanic the Engine already knows. Today the Engine knows five ways to resolve a check, and your file picks one with `resolution.kind`:

- **`dice-sum`**: roll some dice, add numbers from the sheet, and meet or beat a difficulty. That covers d20 systems, 2d6 plus stat systems, and many others.
- **`dice-pool`**: throw the character's own number of dice and count the ones that reach a target. That covers systems where a rating is a handful of dice rather than a bonus.

- **`dice-highest`**: throw a pool and read its highest die, or add its highest few. That covers Blades in the Dark and Trophy Dark.
- **`roll-against`**: roll at or under (or over) the sheet's number. That covers percentile skills and GURPS checks.
- **`symbol-pool`**: build and upgrade narrative dice, then cancel opposing symbols. That covers Genesys checks.

All five are described in full under [Resolution kinds](#resolution-kinds).

A mechanic that does not fit these shapes cannot be written in a ruleset file. Opposed pools are one example. Each of those needs a new resolution kind inside the Engine, which is a code contribution with tests, not a JSON file. If your system needs one, open a feature request on the Engine repository and describe the mechanic with a few worked rolls. Those worked rolls become the tests.

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
| `items`         | Optional. The words your items are written in: categories, rarities, stats, slots, money.         |
| `battle`        | Optional. What a battle may read from the sheet, and what it writes back afterwards.              |
| `combat`        | Optional. How a fight is resolved by your own rules, and what the battle screen then plays.       |
| `layers`        | Optional. Variants of your ruleset a player turns on when a game is created.                      |

The file may be up to 512 KB (256 KB before Capability API 1.340). Text that ends up in a prompt (names, labels, Game Master text) cannot contain line breaks, square brackets, or double curly braces.

Ids inside the sheet (abilities, skills, fields, pools, and so on) are lowercase letters, digits, and underscores, starting with a letter, such as `grit_max`.

### Resolution kinds

`resolution.kind` picks how a check is rolled. Every kind reads the same character sheet and shares three keys, so the parts of the file below `resolution` do not change when you switch:

- `abilityModifier`: how a score on the sheet becomes a number. `identity` means the score is the number. `floorHalfMinusTen` is the 5e rule. `stepTable` lets you list your own thresholds as `[[score, number], ...]`.
- `proficiencyTiers`: the training levels a skill or save can have. The first one is what an unlisted skill gets. A tier adds `flat`, or `multiplier` times a proficiency bonus, or both. If your system has a proficiency bonus, name where it comes from with `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: optional, and only needed by a tier that multiplies.

What the resulting number means is the kind's business: `dice-sum` adds it to the roll, `dice-pool` and `dice-highest` throw that many dice. `symbol-pool` keeps ability and training separate to build and upgrade narrative dice.

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
- `dice.faces`: what each face is worth, lowest face first, where the faces are not their own numbers (Capability API 1.136). Fate's four Fudge dice are `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`: the card shows −, blank and + and adds them up, and the odds are exactly Fate's. Give one value per face.
- `openEnded`: a single die that rolls on (1.136). A face at or above `high` is rolled again and added, and again while the new die shows `high` or more; a face at or below `low` is rolled again and taken away, and that roll chains on `high` the same way. Rolemaster's open-ended percentile roll is `{ "high": 96, "low": 5 }` on one d100. One roll throws at most 20 dice. Natural faces, and the bands' shift, read the first die.
- `unmodified`: faces of a single die the record marks when the first die shows them (1.136), so tables that treat "an unmodified 66" apart can be applied: `[66, 100]`. The record says `unmodified="66"`, the card says it, and the Game Master is told to apply what the rules say about it.
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

- `target.from`: optional. Reads each character's target off their sheet, as Lasers & Feelings' Number, which a character picks once (any value reference: an ability, a field, a derived value). It is held to `min`..`max`, and `threshold=` does not move it, because the number is the character's own; a threshold an entry the character used bought still does. The record's `threshold=` says what was used.
- `stances`: optional. Up to six, each with an `id`, a `label`, `count` (`"below"` or `"above"`) and the `skills` it covers. A check on one of those skills counts the dice **under** the target, or **over** it, instead of at or above it: Lasers & Feelings is a Lasers stance counting below and a Feelings stance counting above, with each skill in one of them. A skill may be in one stance only. Stances leave out `explode`, `double`, `cancel` and `botch`, which are read against "at or above".
- `exact`: optional. A die showing exactly the target: `label` names it (`"LASER FEELINGS"`), `text` may say what it does at the table, and it counts as one success unless `counts` is `false`. The record carries `exact="N"`, the number of such dice, and the dice card shows it beside the result, so the Game Master can give the player the insight it buys.

`cancel` and `botch` faces must be below the lowest target, and every face any of these rules names has to be a face the die actually has. A rule that could never fire is refused at import rather than found in play.

A pool ruleset is Capability API 1.24 for a packaged ruleset; a `min` on `explode` or `double`, `pool.abilityPlusAbility` and `botch.rule` are 1.37; `reroll` is 1.38; `target.from`, `stances` and `exact` are 1.137. A community ruleset you import is validated by the Engine that reads it, so it needs nothing.

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

#### `dice-highest`: throw the dice and read the highest

Blades in the Dark and Trophy Dark throw a handful of d6 and read only the highest one. Capability API 1.138.

```json
"resolution": {
  "kind": "dice-highest",
  "die": { "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "rating_0", "label": "0" }, { "id": "rating_1", "label": "1", "flat": 1 }],
  "pool": { "min": 0, "max": 6 },
  "zeroDice": "lowest-of-two",
  "critical": { "count": 2 },
  "situationalDice": { "min": -1, "max": 2 },
  "difficultyLadder": [{ "label": "Partial", "dc": 4 }, { "label": "Full", "dc": 6 }],
  "outcomes": {
    "by": "total",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "full", "label": "Full success", "atLeast": 6, "success": true },
      { "id": "partial", "label": "Partial success", "atLeast": 4, "success": true, "text": "You do it, with a consequence." },
      { "id": "bad", "label": "Bad outcome" }
    ]
  }
}
```

- The sheet's number is how many dice, as on a pool, held to `pool` (at most 20). Wounds, `adjust`, conditions and items add or take dice.
- `keep`: optional, 1 to 3, default 1. How many of the highest dice are added up: 1 is Blades, 2 is Trophy Dark's fights.
- `zeroDice`: what a character with no dice does. `"lowest-of-two"` (the default) throws two and keeps the lower, and can never be a critical; `"fail"` fails without a roll.
- `critical`: optional. `count` dice showing the top face (or `face` and above) is a critical success: Blades' two sixes.
- `dark`: optional, Trophy Dark's dark dice. `label`, `max` (1 to 10) and `text`. The Game Master adds them to one check with `dark="N"`. `outcome` is `"all"` by default: they are read with the rest. With `"outcome": "light"` (Capability API **1.149**), only light dice decide the kept dice, total, outcome bands and criticals. No light dice applies `zeroDice` to the light side: throw two light dice and keep the lower, or fail while still throwing the dark dice. Dark dice are always thrown and recorded last; `darkHighest="true"` means a dark die strictly beat every light die (including fallback light dice; with none thrown, any dark die wins). What that costs (Ruin) is the Game Master's to apply. Declaring `dark.outcome`, including `"all"`, requires capabilityApi 1.149.
- `situationalDice`: optional, the dice the Game Master may add or take with `bonus=` (assist, push).
- `spend` may buy dice only.
- `difficultyLadder`: steps with `dc`, the number the kept dice must reach. `dc=` on a check is that number, from 1 to `keep` times the die's sides.
- `outcomes` read `by: "total"` from the kept dice, and an `on: "critical-success"` band catches the critical.

The record keeps the summed shape (`resolution="sum"`, `modifier="0"`, the kept dice as the total) and adds `highest="1"`, with `zeroDice="true"` and `dark="N"` where they apply; the dark dice are the last ones in `rolls`. A light-only outcome also records `darkOutcome="light"`, so the card highlights only kept light dice, including after reload. A ruleset of this kind has no fight of its own, so `combat` is refused beside it.

#### `roll-against`: roll at most (or at least) the sheet's number

Call of Cthulhu, GURPS and an old-school thief's percentages roll against a number on the sheet instead of adding to the dice. Capability API 1.139.

```json
"resolution": {
  "kind": "roll-against",
  "dice": { "count": 1, "sides": 100 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "base", "label": "Base" }],
  "against": "at-most",
  "criticalSuccess": [{ "from": 1, "to": 1 }],
  "criticalFailure": [{ "from": 100, "to": 100 }, { "from": 96, "whenTarget": { "below": 50 } }],
  "tens": { "max": 2 },
  "difficultyLadder": [
    { "label": "Regular", "dc": 0 },
    { "label": "Hard", "dc": 0, "divide": 2 },
    { "label": "Extreme", "dc": 0, "divide": 5 }
  ],
  "outcomes": {
    "by": "fraction",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "extreme", "label": "Extreme success", "atLeast": 5, "success": true },
      { "id": "hard", "label": "Hard success", "atLeast": 2, "success": true },
      { "id": "regular", "label": "Regular success", "atLeast": 1, "success": true },
      { "id": "fail", "label": "Failure" },
      { "id": "fumble", "label": "Fumble", "on": "critical-failure" }
    ]
  }
}
```

- The sheet's number for the check is the target. A skill's percentage is the sheet's per-skill bonus (`bonusRange` goes to 100), with no ability and no tier bonus; a GURPS skill is its attribute plus that bonus.
- `dice`: what is rolled and added, 1d100 by default (3d6 for GURPS, 1d20 for a saving throw).
- `against`: `"at-most"` (the default) succeeds at or under the target, `"at-least"` at or over it.
- `difficultyLadder`: each step's `dc` moves the target, and `divide` (2 to 10) divides the sheet's number first. The Game Master names a step with `difficulty=`; a `dc=` on the tag moves the number, from -100 to 100. The record's `dc` is the number the roll was read against, and the record says `against="at-most"`.
- `criticalSuccess` and `criticalFailure`: up to six rules each. A rule names faces (`from`, `to`, either may be left open) or, for a failure, `pastTarget`, a roll that far or farther on the failing side. `whenTarget` (`atLeast`, `below`) limits a rule to some targets: GURPS' 5 is a critical success only at 15 or more. A critical success always succeeds and a critical failure always fails.
- `tens`: optional, on a single d100 only. `bonus="+N"` throws N more tens dice and keeps the best roll, `bonus="-N"` the worst, up to `max`.
- `outcomes` may read `by: "fraction"` on an `at-most` roll: each band's `atLeast` divides the target, and a roll at or under that share lands in the band. The `margin` (how far under the target) and `total` measures work too.

#### `symbol-pool`: throw narrative dice and read the symbols

Genesys builds a pool from a characteristic and a skill rank, then adds opposing dice. Faces carry success, advantage, triumph, failure, threat and despair instead of numbers. Capability API 1.141.

```json
"resolution": {
  "kind": "symbol-pool",
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained", "flat": 0 },
    { "id": "rank_one", "label": "Rank 1", "flat": 1 }
  ],
  "symbols": [
    { "id": "s", "label": "Success" },
    { "id": "f", "label": "Failure", "cancels": "s" },
    { "id": "a", "label": "Advantage" },
    { "id": "h", "label": "Threat", "cancels": "a" },
    { "id": "t", "label": "Triumph", "counts": "s" },
    { "id": "d", "label": "Despair", "counts": "f" }
  ],
  "dice": [
    { "id": "ability", "label": "Ability", "faces": [[], ["s"], ["s"], ["s", "s"], ["a"], ["a"], ["s", "a"], ["a", "a"]] },
    { "id": "proficiency", "label": "Proficiency", "faces": [[], ["s"], ["s"], ["s", "s"], ["s", "s"], ["a"], ["s", "a"], ["s", "a"], ["s", "a"], ["a", "a"], ["a", "a"], ["t"]] },
    { "id": "difficulty", "label": "Difficulty", "faces": [[], ["f"], ["f", "f"], ["h"], ["h"], ["h"], ["h", "h"], ["f", "h"]] },
    { "id": "challenge", "label": "Challenge", "faces": [[], ["f"], ["f"], ["f", "f"], ["f", "f"], ["h"], ["h"], ["f", "h"], ["f", "h"], ["h", "h"], ["h", "h"], ["d"]] },
    { "id": "boost", "label": "Boost", "faces": [[], [], ["s"], ["s", "a"], ["a", "a"], ["a"]] },
    { "id": "setback", "label": "Setback", "faces": [[], [], ["f"], ["f"], ["h"], ["h"]] }
  ],
  "success": { "symbol": "s", "needed": 1 },
  "pool": { "die": "ability", "upgrade": "proficiency", "max": 6 },
  "difficulty": { "die": "difficulty", "upgrade": "challenge", "max": 5 },
  "boost": { "die": "boost", "max": 3 },
  "setback": { "die": "setback", "max": 3 },
  "criticalSuccess": "t",
  "criticalFailure": "d",
  "difficultyLadder": [{ "label": "Easy", "dc": 1 }, { "label": "Average", "dc": 2 }, { "label": "Hard", "dc": 3 }]
}
```

- `symbols`: 2 to 10 named symbols. `counts` also adds one of another symbol before cancellation: a triumph adds a success and remains a triumph. It names a symbol without its own `counts`; chains and self-references are refused. `cancels` pairs two symbols one for one, with at most one partner for each. The reverse declaration is optional. `text` explains a symbol to the Game Master.
- `dice`: 2 to 8 named dice, each with 2 to 20 faces. Faces are arrays of up to three symbol ids; `[]` is blank and repeated ids count twice. All references must exist.
- `pool`: `larger-upgraded` (the default) throws the larger of ability and rank, upgrading the smaller number when `upgrade` is declared. `sum` adds the two and upgrades none. `max` defaults to 6 and cannot exceed 12. The ability uses `abilityModifier`, so use `identity` for Genesys characteristics. Rank comes from the skill or save's proficiency tier; a raw ability check has rank zero. `with=` swaps the characteristic as on other checks. Sheet bonuses, wounds, adjustments and effects add boost or setback dice through the signed bonus below.
- `difficulty`: `dc=` counts opposing dice from 0 through `max` (default 5, ceiling 12). `difficulty=` names a ladder step instead. `upgrade="N"` replaces that many opposing dice with the upgrade die, limited to the number actually thrown. It never adds dice beyond the difficulty.
- `boost` and `setback`: optional dice added by `bonus="+N"` and `bonus="-N"`, respectively, up to each `max` (default 3, ceiling 6). Signed adjustments combine before this limit is applied. Capability API **1.150** also accepts `setback="N"` independently: `bonus="2" setback="1"` throws both sides. A negative bonus adds to `setback`, with the combined setback count held to `setback.max`; boost dice stay bounded by `boost.max`.
- `allowOwnUpgrade`: optional, false when absent. With `true`, `upgradeOwn="N"` upgrades N more character dice to `pool.upgrade` (which must be declared), after sheet upgrades and purchased dice. When all existing dice are upgraded, each extra upgrade adds one upgraded die, still bounded by `pool.max`. This also works with `pool.build: "sum"`. Declaring this key, even as `false`, requires capabilityApi **1.150**. Attribute names use camel case, like `zeroDice`; `upgradeOwn` affects the roller and `upgrade` still affects only difficulty dice. Both `setback` and `upgradeOwn` take nonnegative integers and are ignored outside symbol pools; `upgradeOwn` is ignored unless enabled.
- `success`: needs this many of its symbol after cancellation, one by default. Critical success and failure mark any occurrence of their named symbol, even if its added success or failure cancels. Both markers may occur together, and neither changes whether the net successes passed the check.
- `outcomes` can read the net success count (`total`) or `net successes - needed + 1` (`margin`). Bands still decide success in their usual way; the original critical symbols remain marked. `spend` buys only extra base character dice within `pool.max`. Combat is left out, as for `dice-highest`.
- The record keeps `resolution="sum"`, with `symbols="2s 1a 1t"`, `thrown=` identifying each die, and `rolls=` holding its 1-based face. Encoded `symbolDetails` preserves labels, face symbols and both critical markers. `setback` records the independent setback dice actually added after the shared setback limit, and `upgradeOwn` records additional upgrades actually applied; ignored or zero additions are omitted. The card and summary name the net symbols, including an empty result, rather than adding face numbers. Overrides can change this kind's rules, but cannot replace `symbols` or `dice`.

#### What is out of scope, and why

These mechanics still need their own resolution kind:

- **Opposed pools** resolve two characters at once; a check has one roller.
- **Sum pools with a wild die** (as in OpenD6) add the dice up and treat one of them specially.

Both of the things this kind used to leave out are modelled now, and Spending to change a roll below says how. A rule of the system itself, "spend a point for a success" or "spend a point to throw the failures again", is `resolution.spend`. A re-throw the system grants for free when the situation calls for it is `resolution.reroll`, above. One that belongs to something a character picked is `mechanics.check` on a catalog entry, bought with that entry's own cost.

### Outcome bands: more than success or failure

Many systems read a check as one of several results rather than a bare pass or fail: Pathfinder's four degrees of success, a "barely" that succeeds at a cost, Call of Cthulhu's hard and extreme successes, Fate's "success with style". `resolution.outcomes` names those bands, and the Engine says on every check which one it landed in (Capability API 1.135). It works with every resolution kind.

```json
"outcomes": {
  "by": "margin",
  "naturals": "shift",
  "tiers": [
    { "id": "critical_success", "label": "Critical success", "atLeast": 10, "success": true, "critical": true },
    { "id": "success", "label": "Success", "atLeast": 0, "success": true },
    { "id": "failure", "label": "Failure", "atLeast": -9 },
    { "id": "critical_failure", "label": "Critical failure", "critical": true }
  ]
}
```

- `by`: what the bands are read from. `"margin"` (the default) is how far the result is past what the check needed: a summed total minus its difficulty, or a pool's net successes minus the successes it needed. `"total"` is the result itself: the summed total, or the net successes, whatever the difficulty was.
- `tiers`: two to eight bands, **best first**. `atLeast` is the lowest number that lands in a band; each band's is lower than the one before it, and the last band has none, because it catches everything below. `success` says whether the band is a success, and `critical` marks it as a critical one of its kind (a critical success when `success` is true, a critical failure when it is not). At least one band must succeed and at least one must fail. `text` is an optional line, up to 200 characters, telling the Game Master what the band means at the table ("You do it, but the Game Master adds a complication").
- `on`: `"critical-success"` or `"critical-failure"` makes a band the one a critical lands in, whatever the number says, and nothing else ever lands there. It has no `atLeast`, a band on a critical success is a success and one on a critical failure is not, and there is at most one of each. Blades in the Dark's "two sixes" is a band on a critical success above the band for a single six; the other bands, the ones read from the number, follow the rules above among themselves.
- `naturals: "shift"`: the highest face of a single die moves the result one band better, and its lowest face one band worse, never past the ends. It needs one die, and it replaces `resolution.naturals`, so set both of those to `none` beside it.

The band decides the outcome: success and the two criticals come from it, never from the bare comparison. Where a summed ruleset's `naturals` make a face an automatic success or failure, that face lands in the band on that critical, or else in the best or the worst band, and stays a critical. A pool's botch does the same at the bottom, and a pool with bands leaves `exceptional` out, because the bands already say what a critical success is.

A pool read `by: "total"` is how a system whose difficulty is fixed says its results: Lasers & Feelings' "1 success: you barely manage it, 2: you do it well, 3: critical success" is three bands at 3, 2 and 1 successes and a miss below.

The record names the band with `outcome="Critical success"`, the dice card shows it in place of the plain word, and the Game Master is taught the bands and their `text` and told to narrate the band. A packaged ruleset that declares bands needs Capability API 1.135.

### Checks that roll their own way

Some games roll most checks one way and a few another: an old-school game rolls a d20 under an ability score, but a thief's skills on a d100 and Open Doors on a d6. `resolution.overrides` names those checks and the resolution keys they roll with instead. Capability API 1.140.

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- Each override names `skills`, `saves` or `abilities` (one or more of the three), a `label`, and optional `text` for the Game Master.
- `set` holds resolution keys of the ruleset's own kind, which replace the ruleset's for those checks. `null` takes a key away: exwod's 1s that do not cancel on a favored ability is `"cancel": null`. The kind, the sheet math (`abilityModifier`, `proficiency`, `proficiencyTiers`, `penaltyFrom`, `spend`, `adjust`) and the `difficultyLadder` cannot be changed. A symbol pool also locks its `symbols` and `dice`. The resolution an override makes is checked like the ruleset's own, so a face it names has to be on its dice.
- `when`: optional. A value off the roller's sheet; the override applies only where it is not 0, such as a 0-or-1 number field for a favored ability. Without it, the override always applies.
- The first override that names the check and whose `when` holds is the one used. A check appears in at most one override without `when`.

### Spending to change a roll

Some systems let a player pay for a roll they are about to make: a point of will for an automatic success. `resolution.spend` says so, as a standing rule of the system rather than as something a character went and bought:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` is one of your `live.pools`. It cannot be a pool that starts empty, because there would be nothing in it to spend when play begins.
- `amount` is what ONE purchase costs. `successes`, `dice` and `reroll` are what it buys, and a purchase has to buy at least one of them. Successes are added after the dice are counted, and after any cancelling, because nobody rolled them. Dice are thrown with the pool, inside the pool's own range. A `reroll` is `{ "upTo": 6, "mode": "once" }`, read the way `resolution.reroll` is, and is bought once however many purchases the check makes: a die thrown again twice is still one re-throw.
- `perCheck` is how many purchases one check may make, so the most a check can buy is `amount * perCheck` points' worth. That cap is what stops a full pool buying an unlosable roll. It is a number from 1 to 10, a value off the sheet in the same form a derived value reads (`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`), or `"pool"`: as many as the check has dice, meaning the sheet's number for it before wounds, bonus dice or modifiers. A value off the sheet is read for whoever rolls, rounded down and held between 0 and 100, and a character whose limit comes to 0 buys nothing and pays nothing.
- A `dice-pool` ruleset can buy successes, dice or re-throws. `dice-highest` and `symbol-pool` buy only dice. The other kinds cannot declare `spend`.
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
- `derived` values are worked out from other values and cannot be typed over. A sheet may have up to 400 of them (Capability API 1.111; 240 from 1.88, 120 from 1.84, 60 before it); a package with more than 240 declares 1.111. The operations are `sum`, `min`, `max`, `scale` (multiply by a fixed number and round), `multiply` (two to six values multiplied together, such as a Constitution modifier times the level; Capability API 1.82), `stepTable` (look a value up in thresholds, the way a level gives a proficiency bonus), and `enumTable` (a number for each value of an enum field or a live state; see Live states below).
- `lists` are tables with your own columns, such as gear, spells, or features. A list has up to 24 columns; a package with a list of more than 12 declares Capability API 1.165. A list with `pools` turns every row into a resource with its own maximum, for class features with limited uses. A number column may be filled by a roll: `"roll": { "count": 1, "sides": 8 }`, where `sides` is a number, another column of the same row (`{ "column": "die" }`, a number column or an enum whose values read as dice such as `d8`), or a value off the sheet. The sheet editor shows a Roll button that throws the Engine's own dice and writes the total, held to the column's `min` and `max` (Capability API 1.85).
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

A rest is a list of restore steps and things to clear. Each step names one target (`pool`, `poolGroup`, `listPools`, `track`, or `state`) and either sets it (`"to": "max"`, `"to": "min"`, or a number) or changes it (`"by": { "const": 1 }`, or `"by": { "fractionOfMax": 0.5 }`). A step naming a wound track can only heal it, so its `by` is negative; see above. A step naming a live state only sets it, to `"default"` or one of its values. A `poolGroup` step with a `fractionOfMax` changes each pool of the group by its own fraction; add `"shared": true` (Capability API 1.77) to work the fraction out on the whole group's maximum instead and hand it to the group's pools in the order the sheet lists them, each up to what it is missing. 5e's long rest, "half of the character's total number of" hit dice kept in one pool per die, is `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

### Game Master text

- `checkGuidance` replaces the built-in paragraph that tells the Game Master how to ask for a check. Say which system this is and when to call for a roll. The Game Master only names the skill and the difficulty. The Engine rolls the dice and does the arithmetic from the sheet, so do not ask the model to do math.
- `sheetGuidance` introduces the character sheets in the prompt. Use it to say which resources matter and when to spend them.
- `worldGuidance` is optional and is read once, when the world is generated, so the setting the Game Master invents suits your rules: no gunpowder, magic is rare, the dead walk. It never reaches a turn.
- `sheetSummary` chooses which fields, derived values, and list rows the Game Master sees for each character. The Engine always shows ability modifiers, trained skills and saves, and live values. Keep the rest short, because it is sent on every turn. A summary list's `nameColumn` may be a text or an enum column (an enum shows its value's label), and `columns` names up to three more of the row's own columns to print after the name, so the block reads `Gear: Crowbar 1d6` rather than names alone. A boolean column prints its label when it is set. Both are Capability API 1.37 for a packaged ruleset.
- You do not need to teach the sheet command in `sheetGuidance`. The Engine teaches every command itself, with the names your file declares, and when your ruleset has a wound track it adds the `op="damage"` command for marking it and lists its levels and kinds of harm. When it has live states, it adds the `op="state"` command and lists the values each may take.

### Full GM rules reference (Capability API 1.145)

The optional **top-level** `gmReference` holds the ruleset's full rules reference for the Game Master,
up to 16,000 characters. Put extended adjudication rules here and keep the short check and resource
instructions in `gm.checkGuidance` and `gm.sheetGuidance`. Those fields, and `gm.worldGuidance`, still
have their 1,500-character limits; layer guidance keeps its existing limits too.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

The reference appears under **Game Master rules reference** in the
stable system prompt, once per request. It is never copied into the per-turn reminder. Like other
prompt-safe text, it must be one line, without control characters, square brackets or macro braces
(`{{` and `}}`). When the request still exceeds the context limit after the usual history and reply
budget adjustments, the reference is shortened with a marked cut before core instructions are cut.
Leave it unset to keep the existing prompts. A package using it must declare manifest
`schemaVersion: 2` and `capabilityApi: { "major": 1, "minor": 145 }` or newer.

## Party and scene progress clocks (`clocks`)

Capability API **1.143** adds an optional top-level `clocks` object. Omit it to keep
clock commands disabled. The object is strict: only these three keys are accepted.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` allows one to six unique integer segment counts, each from 2 to 12; it defaults
to `[4, 6, 8]`. `max` is the maximum number of clocks kept at once, from 1 to 12, and
defaults to 8. Optional `text` is one prompt-safe line of up to 400 characters explaining
when the GM should make and tick clocks. An empty object enables the defaults.

Clocks belong to the party/scene, not to a character. The GM reminder lists their names
and fill every turn and teaches these commands:

- `[clock: name="Alarm raised" size="6"]` creates an empty clock. A disallowed size,
  an existing name (case-insensitive), or reaching `max` refuses creation.
- `[clock: name="Alarm raised" tick="2"]` adds segments. Negative ticks remove them;
  fill is bounded to `0..size`. A full clock is done, remains visible, and counts toward
  `max` until cleared. A negative tick can reopen it.
- `[clock: name="Alarm raised" clear]` removes the named clock.

Names are single lines of 1–100 characters with no double quotes, square brackets, control
characters or macro braces. Each tag requests exactly one action. Commands apply in
reply order, so a clock can be created and ticked in the same reply. The Engine rewrites
each tag with `result="ok" now="4/6"` (or `now="cleared"`), or with
`result="refused" reason="..."`. Model-supplied outcome attributes are discarded.
Unknown clocks and malformed requests are refused; at most 40 commands apply per reply.

Game Mode shows a segmented circle, name and fill beside the party status. Tags stay
in the saved reply as receipts and are hidden from narration. Clocks are stored in each
game-state snapshot as `rulesetClocks`; missing data means no clocks. Regenerating starts
from the preceding snapshot, continuing starts from the current one, and selecting or
removing swipes/messages restores clocks with the rest of that snapshot.

## Party sheet: a crew, ship or shared Story Points

Capability API **1.144** adds an optional top-level `party`, beside `sheet`. It holds one shared
sheet per game, such as a Blades crew, a Lasers & Feelings ship, or Genesys Story Points:

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

`fields` uses the same field schema as `sheet.fields`; `pools` uses `sheet.live.pools`, including
`start`, `group`, `hideWhen` and `allowTemp`. At least one field or pool is required, and their ids
must be unique within the party sheet. Character and party ids may coincide. Party sheets have no
sections, lists, abilities, derived values or character-sheet migrations in this minor. A pool's
`max` reads a constant or a numeric party field. Character formulas cannot read party values, and
party formulas cannot read character values. `hideWhen` also names party fields only.

`advancement.fields` names number, text or longtext fields the GM may change permanently.
`advancement.text` and `text` each take one prompt-safe line of at most 400 characters.
Optional `summary` reuses `gm.sheetSummary`: its `fields` select party fields; `derived` and `lists`
must be empty. Without a summary, all visible party fields are shown. Pools always appear.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` selects the shared sheet; leave `who` out. Existing `who="party"` still applies to
every **character** and never changes the shared sheet. This minor permits `spend`, `restore` and
field `advance` on the party sheet. Unknown sheets, unsupported operations, insufficient pools,
undeclared advancement and invalid values are refused and rewritten with the Engine's result.
Party pools follow the same current/maximum arithmetic and defaults as character pools.

The GM receives the party label, fields and pools beside the character sheet blocks each turn.
Game Mode offers a collapsible read-only party sheet beside the character portraits, using the
same sheet presentation. Permanent values live once in chat metadata (`gamePartySheet`), beside
`gameCharacterCards`, and share advancement receipts. Live pools use the reserved `$party` entry
of `rulesetLive`; normalized character names cannot collide with it. Regenerate starts before
the reply, and swipe selection or deletion restores both permanent and live values through the
existing history. Rulesets without `party` keep their existing behavior.

**Shared party creation (Capability API 1.163).** A party sheet may carry `lists` (up to 12, written
as the character sheet's lists), a guided `builder` of its own, and `fromMembers`: up to 8 party
number fields read off the party's characters, each `{ "field", "count": true }` (how many
characters there are) or `{ "field", "sum": "<character number field>" }` (what theirs add up to,
such as Totem dots). Member fields are worked out from the characters as they stand whenever the
shared sheet is read, so a character joining or leaving changes them at once. With lists, the
party `summary.lists` may name them.

The builder is written exactly as a character's (pools, steps, priced rows, spend offers,
profiles) and is held to the same rules against the party's own fields and lists. Its catalog and
row-copy steps may read the ruleset's catalogs that feed party lists. In Game Mode any player opens
the shared sheet's Edit, which offers the guided setup, and saves it for the whole party. Each save
names the revision it was opened on (`gamePartySheetRevision` in chat metadata, raised by every save
and by the story's own changes): a save opened before someone else's landed is refused, the newer sheet is shown,
and the player's draft stays open, so saving again is their choice to replace it.

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

An entry may carry an optional `mechanics` block that says what it does in numbers: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dice such as `2d6`, or a flat number), `amountAdd` (a value read off the user's sheet and added to the amount, such as `{ "field": "level_fighter" }` for a Second Wind of 1d10 plus the fighter's level; it needs an `amount`, is read only in the ruleset's own fights (the Engine's Classic and Tactical fights use the amount as written), and is Capability API 1.83), `damageType`, `attackRoll`, `autoHit`, `save` (one of your sheet's saves, and what a success does), `applies` (conditions it puts on what it touches), `temporary` (temporary points on the health pool), `scales` (an amount that grows with the sheet), `cost` (which pool using it spends), `perCostStep`, `targetsPerCostStep`, `budget` (which part of the action economy it spends), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` and `check`.

An attack that targets enemies can leave something to strike on later turns with `summons` (Capability API 1.122). For Spiritual Weapon, put `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }` on its attack entry. The cast makes the first attack and leaves the weapon beside its first target once reactions finish; a cancelled cast leaves nothing. Later strikes spend only the declared economy budget, keep the cast's payment level for damage scaling, and open the same reaction windows. Distances use the catalog's unit; omitted movement is zero and omitted reach is one cell. On a board the weapon can strike an enemy within movement plus reach, ignoring walls, and moves beside it. Without a board any standing enemy is in reach. Rounds count down at the end of the holder's turns, excluding the casting turn. The summon ends at zero, on the holder's defeat, or when its entry's concentration ends. Casting the same entry again replaces its summon.

An entry with an `area` can stay with `zone` (Capability API 1.172): `{ "rounds", "anchor", "triggers", "atCast" }`. It stands for `rounds` (1 to 1000) of its caster's turns, counted as a summon's are, and ends sooner when the concentration that holds it ends or its caster is defeated. `anchor: "point"` (the default) keeps the cells it was cast on; `anchor: "caster"` is a burst around its caster that goes where they go, so its range is 0. `triggers` names when it does the entry's own effect again (amount, plus, save, applies) to one creature: `enter` (they move into it, or a zone carried by its caster reaches them), `turn-start` or `turn-end` (they start or end their turn in it). A creature is caught once a turn whatever the trigger, and whoever the cast itself caught counts as caught that turn. Whom it catches follows the entry: `friendlyFire: false` leaves the caster's side out, a heal or an ally entry keeps to it, and a zone carried by its caster never catches them. `atCast: false` does nothing as it appears. Casting the entry again replaces its zone. The board tints its cells, the fight lists it with the turns it has left, and the log says each catch. Off a board it holds whom it was cast on, and `turn-start` and `turn-end` catch them.

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

That is Cloudkill. Spirit Guardians is `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false` with `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`; Moonbeam is a 5-foot burst with `"triggers": ["enter", "turn-start"]`.

A zone held at a point can move and change its ground (Capability API 1.173). `move: { "budget", "distance" }` lets its caster move it on their turn: the fight offers "Move <zone>" for that budget, picked on the board like a walk, to any cell within `distance` of its centre. `drift: { "distance" }` moves it that far straight away from its caster as each of their turns starts, stopping at the board's edge. Either way, whoever it now covers and did not before is caught as `enter` says. Only a burst held at a point moves or drifts. `terrain: { "difficult": true }` makes every cell of it cost double to move into for whoever it catches (ground that is already hard going is not doubled again), and `terrain: { "perDistance": { "every", "amount", "damageType" } }` deals `amount` (dice and flat, as an entry's own) to whoever it catches for every `every` they move inside it, with no save, counted across walks. The log says each move, drift and hurt.

```json
{
  "id": "moonbeam",
  "name": "Moonbeam",
  "mechanics": {
    "kind": "attack",
    "range": 120,
    "area": { "shape": "burst", "size": 5 },
    "amount": { "dice": "2d10" },
    "damageType": "radiant",
    "save": { "save": "con_save", "onSuccess": "half" },
    "concentration": true,
    "zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "move": { "budget": "action", "distance": 60 } }
  }
}
```

Cloudkill adds `"drift": { "distance": 10 }`. Spike Growth is a 20-foot burst with no amount of its own, `"triggers": []` (its ground is all it does), `"atCast": false` and `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`.

A zone can do more to whoever it catches (Capability API 1.174). `breaksConcentration: true` makes a creature it catches while concentrating roll the ruleset's concentration save against the entry's own save difficulty, before the entry's effect, and lose its concentration on a failure; the entry needs a `save`. `damageCap` ends the zone once it has dealt that much damage in all after it appears, counting its catches and its ground. Sleet Storm is a 40-foot burst with `"save": { "save": "dex" }`, `"applies": [{ "condition": "prone", "duration": "instant" }]` and `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`. Guardian of Faith is a burst with `"friendlyFire": false`, `"amount": { "flat": 20 }` and `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`.

What a condition applied by an entry is escaped against can be the entry's own save difficulty (1.174): `"escapeDc": "save"` on the `applies` entry, beside a contest whose `from.holding` is that condition. Web and Black Tentacles restrain with `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }`, and the restrained creature's escape contest is rolled against the caster's spell save DC. Whatever applied it with no save difficulty leaves it escaped as the contest says, against its holder.

An item's `use` may also carry `concentration` and `zone` (1.174), as a catalog entry does, so a spell scroll of Cloudkill or Moonbeam keeps its lasting area and is held by its reader's concentration.

A moved zone may ram, and its ground may cost more (Capability API 1.175). `move: { ..., "ram": true }` sends it a cell at a time straight for where it was moved to; on the first cell where it reaches somebody it did not cover before, it stops, catches them as if rammed (whatever its triggers say), and cannot be moved again that turn. Creatures who walk into it are caught only as its triggers say. Flaming Sphere is a 5-foot burst with `"triggers": ["turn-end"]` and `"move": { "budget": "bonus", "distance": 30, "ram": true }`. `terrain.costTimes` (2 to 10) makes every step into it cost that many plain steps, and ground already hard going costs no more than that: Plant Growth is `"terrain": { "costTimes": 4 }`. It replaces `difficult`, which is `costTimes: 2`. `terrain.halvesSpeed: true` makes every step inside cost double again, on top of any hard going: Spirit Guardians is `"terrain": { "halvesSpeed": true }`.

Holds a spell puts on can be broken only as the spell says (also 1.175). A breaking-free contest with `"from": { "holding": "restrained", "escapable": true }` is offered only against a hold that names an `escapeDc`, so the same contest breaks a web and never petrification. `applies[].escapeChecks` names the contest checks that may break that hold, in place of the contest's own attacker checks: Black Tentacles restrains with `"escapeDc": "save", "escapeChecks": ["might", "agility"]`, and Web with `"escapeChecks": ["might"]`. `zone.whileHeld: { "condition", "amount", "damageType" }` deals its amount, with no save and in place of the zone's own effect, to whoever starts a turn in it already held by that condition from its caster: Black Tentacles' `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }`.

An entry or an item's use may cure (Capability API 1.176). `ends: { "conditions": [...], "count"? }` takes those conditions off its target in the order named, at most `count` of them: Lesser Restoration is `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. `stabilizes: true` steadies a dying target, who rolls no more dying saves, and needs a combat block with a `dying` rule: Spare the Dying. `revives: { "withinRounds", "health" }` is aimed only at somebody who died no more than that many rounds ago and brings them back at that amount: Revivify is `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`. An entry that only ends conditions or steadies is offered only against somebody it would help; one of the kind `utility` with nothing else to do is offered as long as it cures.

Areas may be boxes, and lasting ones walls (Capability API 1.177). `area.shape: "box"` is a square of `size` a side whose near corner sits on the cell aimed at, reaching away from its maker; along an axis its maker is level with, it is centred on that cell instead. Without a `range` it sits against its maker. Web is `"area": { "shape": "box", "size": 20 }` with a range of 60. `area.shape: "wall"` only ever stays, so it needs a `zone`: it is `size` long and `width` thick (one cell without it), run through the aimed cell across the line from its maker, or toward the choice's `toward` cell from there; `"ring": <diameter>` lets its caster lay it instead as a ring that wide around the aimed cell, when the choice says `"ring": true`. A wall needs no trigger: Wind Wall only does its effect as it appears. A wall is never moved, drifts or follows its maker. `zone.blocks: ["move", "sight"]` closes its cells to walking, to seeing, or both while it stands, and whoever stands where it goes up is put on the nearest open cell (on its chosen side when one is as near): Wall of Stone blocks both, Wall of Force movement, Wall of Fire sight. `zone.side: { "distance", "triggers" }` makes the cells within `distance` of one side catch as its own `triggers` say, beside the wall's own cells; the choice's `side` says which, `near` its maker (inside a ring) or `far` (outside), far when left out. Wall of Fire is `"area": { "shape": "wall", "size": 60, "ring": 20 }`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`.

Seeing matters (Capability API 1.178). `combat.senses` lists the senses that see where eyes cannot, each `{ "id", "label", "sheet"?, "blind"? }`: a character's range is read off its sheet by `sheet` (nothing at zero), a creature carries its own as `"senses": { "darkvision": 60 }` in the ruleset's distance, and a `blind` sense (blindsight, tremorsense) works without eyes. The block then needs `combat.distance`. A zone with `obscures` hides everything in it, and anything seen through it, from whoever has none of the senses its `pierced` lists within range: Fog Cloud is `"obscures": {}`, Darkness `"obscures": { "pierced": ["blindsight", "truesight"] }`. Such a zone needs no trigger, and a `utility` entry that does nothing but leave an area standing (Fog Cloud, Darkness, a wall) is on the menu, set down wherever its caster chooses. A `combat.conditions` entry with `unseen` hides its holder the same way: invisible is `"unseen": { "pierced": ["blindsight", "truesight"] }`. `combat.sight` says what this does: `unseenAttacks: true` gives an attack advantage when its target cannot see the attacker and disadvantage when the attacker cannot see its target, and `eyes` names the sense (as a condition's `lacks` names it) that is sight, so a blinded creature sees only by a `blind` sense. An entry or creature action with `seen: true` may only pick targets its maker can see, as "a creature you can see within range" says. A burst or box may be set down several times at once with `area.copies` (2 to 10), each copy touching another, and the player places each one: Fire Storm is `"area": { "shape": "box", "size": 10, "copies": 10 }`. A zone set down several times stays where it is cast.

Zones can work on whoever stands in them (Capability API 1.179). `combat.components` names what using something may need, each `{ "id", "label" }` (5e's verbal, somatic, material), and an entry or a creature's action lists its own in `components`. A zone's `inside` puts `conditions` on whoever is in it and keeps the damage types in `immune` off them while they stay; its `forbids: { "components": [...] }` stops anything needing those from being used inside, as a condition's `forbids` does for its holder (gagged). Silence is `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`. A zone's `wards: { "catalogs": [...], "maxLevel": N }` keeps off whoever is inside anything off those catalogs used from outside it at level N or lower, judged at the level it is paid at: Globe of Invulnerability is `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`. A condition that takes budgets away (`budgets` with a negative `flat`), put on during its holder's own turn, takes them from that turn too, so Stinking Cloud's failed save as the turn begins costs that turn's action.

Senses and seeing go further (Capability API 1.180). A condition an entry applies may end when its holder acts: `"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` takes it off once they have made an attack, or used an entry of a catalog it names, and an item's use that says `"casts": "spells"` (a scroll, a wand) counts as casting from that catalog. The attack or spell that ended it still had it, so Invisibility gives its one attack advantage and is gone afterwards. What a standing zone does by itself is not its caster acting. A condition in `combat.conditions`, or an item's `worn` or `carried` effect, may give senses with a range in the ruleset's distance, `"senses": { "darkvision": 60 }`; the longer of that and the holder's own range counts while it holds, so the Darkvision spell, True Seeing (`{ "truesight": 120 }`) and goggles of night work. A condition with `"cancelsUnseen": true` lets everybody see its holder whatever condition hides them, as Faerie Fire outlines the invisible; obscuring zones and walls still hide them.

Wards, saves, monster spellcasting and scrolls go further (Capability API 1.181). A zone's `wards` compares the level a spell was paid at unless it says `"by": "base"`, which compares the spell's own level however it was paid, as Globe of Invulnerability does. `"maxLevelPerCostStep": 1` keeps out one level more for each step the ward's own cast was paid above its base. An entry's or a creature action's `save` may say what else it counts as being against, `"against": { "damage": ["poison"] }`, so a save modifier `against` poison applies to it, and who succeeds without rolling: `"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }` (any one is enough), as Stinking Cloud needs. A creature's `spellcasting` may say what its spells need in place of each entry's own `components`, for the whole trait or per spell, with `[]` for innate spellcasting that needs none, so Silence does not stop it. An item's use may be `"kind": "utility"` when all it does is leave an area standing (a scroll of Fog Cloud, Darkness, Silence or Globe of Invulnerability); it needs an `area` and a `zone`.

Pushes, winds and goggles (Capability API 1.182). An entry's `"push": 15` pushes whoever it lands on and does not save against 15 of the catalog's distance straight away from its maker, stopping at anything solid or anybody standing; a zone pushes whoever it catches the same way. A zone held by its caster (`"anchor": "caster"`) may now be a line or cone as well as a burst: it points the way it was cast and goes where its caster goes, and `"turn": { "budget": "bonus" }` lets them spend that budget on their turn to face it another way, catching whoever it now covers as if they had moved into it (5e's Gust of Wind). A zone's `terrain` with `"towardCaster": true` makes its hard going count only for a step that brings the mover nearer its caster. A sense a condition or an item gives may be `{ "add": 60 }` instead of a range, which adds to the holder's own range of that sense, or gives 60 to someone who has none (5e's goggles of night).

Zones that go off later or burn away (Capability API 1.183). A zone with `"detonates"` does nothing while it stands and nothing as it is cast: when it ends, because its concentration ended, its rounds ran out or it was cast again, it does the entry's own effect once to everybody in it. `"grows": { "dice": "1d6" }` adds that much to its amount at the end of each of its caster's turns, the turn it was cast on too, so it rolls the same dice as the entry's own amount; `"touched": true` makes whoever moves onto its middle roll the entry's save, and sets it off when they fail (5e's Delayed Blast Fireball). It stays where it was cast. A zone with `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` is set alight by damage of one of those types landing on any of its cells or on anybody in it; it burns away when its caster's turn comes round again, ending the spell, and deals its amount with no save to anybody else who starts a turn in it meanwhile (5e's Web).

Creatures push too (Capability API 1.184). A creature's action takes `"push": 60` in the ruleset's own distance, as a catalog entry does: whoever it lands on is pushed that far straight away from the creature, and with a `save`, only when they fail it, so `"onSuccess": "none"` keeps the damage and spares only the push and what `applies` puts on (a dragon turtle's Tail). An item's use may give a line its `width`, as a scroll of Gust of Wind's 60 by 10 feet.

What a creature is counts for more (Capability API 1.185). A save may say `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`, so a target that is that rolls it twice and keeps the worse (Sunbeam); an entry's `"maxAgainst": { "types": ["plant"] }` deals its damage at its most to a target that is that (Blight). `targetTypes` may also say `"abilityAtMost": { "int": 3 }`, for a target whose score is at most that (a creature written with no score is not kept out), and `"notImmuneTo": ["charmed"]` (Sleep). A condition's modifier may roll attacks twice: `{ "to": "attacks", "mode": "disadvantage", "atSource": true }` is the holder's own attacks against whoever put it on them (Chill Touch), and `{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` is attacks made against the holder by attackers that are that (Protection from Evil and Good). A change to saves may be `"against": { "from": { "types": ["dragon"] } }`, which matches any save against something a creature of that kind did (Dragon Scale Mail).

A creature's actions may recharge together (Capability API 1.186): give each `"recharge"` the same `"group"` and the same dice, and using either spends both, while one roll at the start of the creature's turn brings both back (a metallic dragon's two breath weapons). A blow may `"charge"`: `{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` adds its clauses when the creature's walk this turn ended with a run of at least `atLeast` straight at the one it hits, each step a square closer to them; then the target makes the save, and on a failure (or always, with no save) is pushed and takes the conditions (a minotaur's Charge). A charge rides a blow at one target and is only measured on a board.

An item's `attack` can say more about what it hits (Capability API 1.187). `"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` adds to hit against a target that is that (a mace of smiting). A `plus` clause may say `"not": { "types": ["construct", "undead"] }` to skip targets that are that, `"blow": "ranged"` to count only on a thrown or shot blow (a dwarven thrower) or `"melee"` only on one in reach, and `"tempHp": true` to give the wielder temporary hit points equal to what it dealt (a sword of life stealing). An `onHit` condition may name `"targetIs"` (a giant slayer knocking a giant prone) and `"oncePerTurn": true` (a sword of wounding). `"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` kills a target the hit left at `healthAtMost` or less outright, on a failed save where it has one, spending the item's charges when it does (a nine lives stealer); `"immuneTo": ["slashing"]` spares a target immune to that (a vorpal sword). Health is read after the blow's damage.

A sheet's `live.conditions`, a rest's `clear.conditions` and `combat.conditions` hold up to 320 entries (Capability API 1.269; 160 from 1.188, 80 before). A modifier `to: "attacks"` may name `"ability": "str"` so it changes only attacks made with that ability (a gold dragon's Weakening Breath), and a modifier `to: "checks"` may name `"abilities": ["str"]` so it changes only ability checks made with one of them, contested checks and skill checks of that ability included (a barbarian's Rage). A creature's stat-block actions name no ability, so an ability-narrowed attacks modifier never reaches them.

A condition in `combat.conditions` can hurt its holder (Capability API 1.189): `"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` deals that as each of their turns starts (or `"turn-end"`), from whoever put it on, before any save that ends it. `"stacks": 10` lets it be put on again while it holds, up to that many times, and its harm is dealt once for each (a sword of wounding); ending it ends them all. `"onePerSource": true` keeps it on one holder per source: put on somebody else, it leaves whoever had it from the same source (an oathbow's sworn enemy). An item attack's `against` entry may name `"marked": "sworn"` instead of or beside `is`, matching a target that carries that condition from the wielder, and besides `toHit` may say `"mode": "advantage"`, `"ignoresCover": true` (cover short of total counts for nothing) and `"ignoresLongRange": true`; a `plus` clause may say `"marked": "sworn"` too (the oathbow's 3d6 piercing). A creature's stat-block action may name `"ability": "str"`, the ability its attack is made with, so changes to attacks or damage narrowed to an ability reach it.

An item attack's `modes` entry can be a different way of using the weapon altogether (Capability API 1.190): `"range": { "normal": 120 }` is how far it reaches in that mode, in the ruleset's own distance; `"plus"` adds clauses to a hit, as the attack's own do; `"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` is a bolt everybody standing between the wielder and the target (neither of them) saves against before the attack is rolled; and `"charges": 1` spends that many of the item's own charges, so the mode is offered only while it has them (a javelin of lightning: `charges.max` 1 and `stack` 1 on the item). A line needs a board to run across.

A combat condition with the effect `"cannot-heal"` keeps every heal off its holder while it lasts, and the log says so (Capability API 1.191): 5e's Chill Touch. `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` on a combat condition keeps those conditions off only when a creature that is `from` puts them on; one already on stays (Protection from Evil and Good). A spell's `targetTypes.abilityAtLeast` is the floor `abilityAtMost` is the ceiling of: `{ "int": 5 }` passes over a creature of Intelligence 4 or less (Hideous Laughter), and a creature written with no score for it is not kept out. A saves modifier's `against.actions` names actions by id, name or shared recharge group, case-insensitively, and narrows everything else `against` says: `{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` is a dragon's breath or Frightful Presence and never its Wing Attack, and the repeated save to end a condition one of them put on counts too.

An item attack can carry more riders (Capability API 1.192). `"ignoresResistance": true` lets its damage through the target's resistance to the attack's own damage type, resistance to everything included, while a `plus` clause of another type is still halved (a vorpal sword's slashing); immunity still holds. A `slay` entry's `"saved"` lists conditions, in the same shape as `applies`, that a target which makes the slay's save takes instead: `[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` is a mace of disruption's fiend frightened of the wielder until the end of the wielder's next turn. `"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` makes every other weapon attack the wielder makes roll with that mode while a creature they put `sworn` on still stands, or only the ranged ones with `"ranged": true` (an oathbow). And in a fight without a board, an area action (a creature's or a spell's) may be pointed at people on either side, never its maker, because it catches each creature in it; `friendlyFire: false` keeps it to the other side, as it does on a board.

A contest can be a check against a fixed number instead of a roll-off (Capability API 1.193). Leave out `defender` and give `"difficulty": 15`; the actor rolls the best of its `attacker` checks and wins on meeting it. `"targets"` says who it may be taken on: `"enemy"` (the default), `"ally"` or `"any"`, the actor included. `"targetHolds": "wounded"` offers it only on a target holding that condition, and `"targetDying": true` only on one who is dying and not yet stable. `onWin.stabilizes` makes a dying target stable. So a DC 15 Wisdom (Medicine) check that ends a sword of wounding's wounds is `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`, and the DC 10 one that saves the dying is `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`. A pool fight counts successes, so it refuses `difficulty`. An item attack's `"healedOnlyByRest": true` seals the hit points it takes: no heal brings the holder above their maximum less what is sealed, and any rest restores them and clears the seal. A combat condition's `harms` takes the same `"healedOnlyByRest": true`, so the wounds the sword leaves seal what they take too.

A size can fill more than one cell (Capability API 1.194). Give an entry of `combat.sizes.order` a `"cells"` count, `{ "id": "large", "label": "Large", "cells": 2 }`, and a creature of that size fills that many cells a side on a board, its own cell the top-left one: 5e's Large is 2, Huge 3 and Gargantuan 4. It is set down where all of it fits, the nearest such place to where it was asked to stand. Reach and range run to and from the nearest cell it fills, so a sword reaches an ogre from beside any of its four cells; it walks only where all of it fits and nobody walks through any of it; an area catches it when any of its cells is inside; a push moves the whole of it; and it is seen, and is as covered as, from whichever of its cells is clearest. A size with no `cells` fills one, exactly as before.

A condition can make its holder bigger or smaller (Capability API 1.195). Give an entry of `combat.conditions` a `"size": { "steps": 1 }`, and while it holds its holder is that many sizes further along `combat.sizes.order`, or back along it for a negative number, never past the first or the last: 5e's Enlarge is `1` and Reduce `-1`. Their reach, what areas catch them and anything that asks their size read the new one, and when it ends they are their own size again. On a board somebody who grows fills their new size over every cell they stood on where it fits on open ground clear of everybody else, or the biggest size short of it that fits, so an ogre enlarged in a corridor grows only as big as the corridor allows; somebody who shrinks keeps their top-left cell. The log says who changed, and to what. It needs `combat.sizes`; pair it with a `damage` modifier for the weapon dice and a Strength `checks` and `saves` mode for the rest of the spell.

An entry can pick its targets by how much health they have left (Capability API 1.196). `"healthPool": { "dice": "5d8" }` in its `mechanics` is rolled once as it is used and shared out from the target with the least health left upward: each is affected only while their health is no more than what remains, which they then use up, and the rest are left alone entirely, as 5e's Sleep and Color Spray work; `perCostStep` adds to it when it is cast higher. `"healthAtMost": 150` affects only a target with that much health or less, as Power Word Stun; `"kills": true` kills whoever it affects outright, so Power Word Kill is `"healthAtMost": 100, "kills": true`. Both read the health a target has left, after `targetTypes` has said who it may take at all. The log says what a pool rolled and whom it was enough for.

A damage modifier can throw a blow's own dice more times over (Capability API 1.197). `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` on a condition makes a war pick's 1d8 + 2 deal 2d8 + 2 while it holds, as an enlarged duergar's weapons do; its flat part stays as it was, a critical doubles the extra dice as it does the rest, and the menu's average counts them. It changes the damage a blow deals and nothing else. A creature's action with `"self": true` taken on its own turn now lands on the creature itself, as it already did in a reaction, so its `applies` go on.

A zone can deal another damage type at its triggers than it does as it appears (Capability API 1.198). `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }` on an entry whose own `damageType` is `"piercing"` deals piercing to whoever the wall appears around and slashing to whoever moves into it later, as 5e's Wall of Thorns does. It needs the entry's own `amount` and a trigger, a side or a ram to deal it at, and names one of `combat.damageTypes` where the ruleset declares them.

A health pool can pass over some of its targets (Capability API 1.199). `"healthPoolSkips": { "conditions": ["unconscious"] }` beside a `healthPool` leaves whoever holds one of those conditions alone and spends none of the pool on them, as 5e's Sleep ignores the unconscious; `"unseeing": true` does the same for whoever cannot see the entry's maker (blinded, or with no line of sight to them), as Color Spray ignores creatures that can't see. It names `conditions`, `unseeing` or both, and needs a `healthPool`.

A wall can stand in sections that are struck and broken one by one (Capability API 1.200). `"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` is 5e's Wall of Ice: each 10-foot panel has AC 12 and 30 hit points and takes double from fire (`resist` and `immune` work the same way). An attack that is aimed at one foe or anybody and deals damage may be pointed at a section instead: its option lists the cells it may strike as `walls`, and the choice names one of them as `wall`. The attack is rolled and its damage dealt as against a creature, and the log says what the section took and has left. A section brought to 0 is broken: it stops blocking, and whoever enters it (or starts or ends a turn there, as its `triggers` say) takes its `amount`, once a turn, saving with its `save` against the entry's own difficulty for half (`onSave: "none"` for nothing). Sections need a wall that `blocks`, and a broken `save` needs the entry's own `save`.

An entry can move the sheet's live tracks and give back sealed health (Capability API 1.201). `"tracks": [{ "track": "exhaustion", "by": -1 }]` takes a level of exhaustion off whoever it lands on, as 5e's Greater Restoration does, and `"by": 1` on an entry with a save (Sickening Radiance) adds one to whoever fails it. Each track is held to its own bounds, levels that halve the health maximum take hold at once, and reaching a level that `defeats` slays. `"unseals": true` gives back the health that only a rest would (what a `seals` blow took off), as Greater Restoration ends a reduction of the hit point maximum. An entry that only cures this way is offered only on somebody it would help. A wall section's `broken` can carry its own `perCostStep`, added once for each step the cast was paid above its base: Wall of Ice's frigid air, `{ "dice": "1d6" }`. Tracks are plain tracks, not wound tracks, and `unseals` needs health kept in points.

A condition an entry puts on can end with another one it puts on (Capability API 1.202). In `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`, 5e's Hypnotic Pattern, the incapacitation ends whenever the charm does: a save, a cure, its caster's concentration breaking, an ally shaking them awake, or the fight ending. Only the one put on by the same use goes with it, and the log says why. `endsWith` names another condition of the same `applies` list (or `onEnd`, `charge` or `saved` list), never its own.

A creature's action can lower its target's health maximum (Capability API 1.203). `"reducesMax": { "save": "con_save", "difficulty": 14 }` on a wraith's Life Drain has the target roll that save as the blow lands; on a failure, the damage it takes comes off its maximum as well as its health, and no heal gives it back before a rest. With `"lasting": true` (a clay golem's Slam) not even a rest does, only an entry that `unseals` (Greater Restoration). A target whose maximum is lowered to 0 this way dies. A sheet keeps what no rest gives back as its pool's `lasting`, inside `sealed`. It needs health kept in points.

A cure can do one of its cures rather than all of them (Capability API 1.204). With `"cureOneOf": true`, an entry that `ends` some conditions, moves `tracks` and `unseals` (5e's Greater Restoration: charmed, petrified, a level of exhaustion, or the hit point maximum) does exactly one: each is offered as a mode of the option (a condition, a track or the health pool, by its label), as a weapon's modes are, and a use with none picked does the first of them, in that order, the target has something for. It needs at least two cures to choose between.

A lowered maximum can need no save of its own (Capability API 1.235). A `reducesMax` without `save` and `difficulty` lowers the maximum by the damage of every blow that lands (5e's vampire Bite); with `"onFailedSave": true` only when the target failed the entry's own save (5e's Harm, a catalog entry with a save; there `reducesMax` never has a save of its own). `damageType` counts only damage of that type (the Bite's necrotic), and `"heals": true` gives its maker back as many hit points as it lowered. Catalog mechanics take `reducesMax` too, and `leavesAtLeast` keeps the entry's damage from taking the target below that many hit points (Harm leaves 1). `targetHolds` on a creature action or catalog mechanics limits whom it may be pointed at: one who holds one of its `conditions`, or one of its `fromSelf` that the action's maker put on them (the Bite: grappled by the vampire, or incapacitated or restrained).

A condition can give its holder uses of its own (Capability API 1.236). A combat condition's `actions` lists catalog entries (`spells/break-enchantment`) its holder may use while they hold it: they are on the menu only then, cost nothing off the sheet but the budget each spends, and are rolled with the holder's own numbers, as their spells are (a creature that casts uses its casting's). An entry with `"endsCondition": "<condition>"` ends that condition on its user once used, and the concentration holding it when that is the user's own: 5e's Dispel Evil and Good, whose Break Enchantment and Dismissal each end the spell. `ends.from` (a type and tag test) cures only what a creature that passes it put on: Break Enchantment ends a charm or fright by a celestial, an elemental, a fey, a fiend or an undead, and leaves one by anybody else. `dismisses` sends whoever it lands on and who does not save out of the fight, alive, off the board and out of the turn order: `true` for good (Dismissal), or `{ "while": "<condition>" }` for as long as they hold that condition, which the same entry must put on (5e's Banishment). Its clock then runs on its caster's turns, and when it ends, by its time, a save or the caster's concentration, they come back where they were, or to the nearest free place they fit. With `gone` (a type and tag test), one that passes it and saw the condition run its whole time stays away.

A fight can begin with some of its people caught unaware (Capability API 1.237). The scene says who: the encounter it is drawn from marks them `"surprised": true`, party or enemy alike. On their first turn they cannot move or act, and their menu holds only ending it; they take no reaction, and no legendary use, until that turn is over or the first round is, whichever comes first. A combat condition with `"cannotBeSurprised": true` keeps its holder from ever being caught: 5e's Foresight. A catalog entry with `"ignoresSurpriseWith": "<catalog>/<entry>"` names a use its holder may still take while surprised, and taking it ends the surprise there and then, so the rest of the turn is theirs: 5e's Feral Instinct, which lets a surprised barbarian act normally by raging first.

A catalog entry can give its holder a second turn in a fight's first round (Capability API 1.238). `"extraFirstTurn": { "initiative": -10 }` on an entry held on a sheet's list places that second turn at the holder's own initiative plus the number, after everybody at that number or above it; each of the two is a whole turn, and from the second round on they take one turn a round as usual. A holder taken out before the second turn comes simply misses it. With `"unlessSurprised": true` there is no second turn for one who begins the fight surprised: 5e's Thief's Reflexes.

A combat condition can narrow what its granted budget buys to a swing in reach, and leave a mark on its holder's tracks as it ends (Capability API 1.239). With `"grants": { "budget": "bonus", "attacks": true, "melee": true }`, the one strike that budget pays for is made only with a weapon that strikes in reach, and a thrown one only at somebody within its reach, since it is swung rather than thrown; a weapon with a range and no reach is not offered. `"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` moves its holder's live tracks by levels as the condition ends, however it ends, as `tracks` on a catalog entry does; `applies` and `tracks` may stand together or alone. A catalog entry's `"usesOf": "<row name>"` spends the uses of that row's entry (its counter row) instead of its own. 5e's Frenzy is then a Berserker's entry, Frenzied Rage, with `"usesOf": "Rage"`, that puts on the rage and a `frenzied` condition that `endsWith` it, holding both of these.

Initiative can be thrown twice, the better or the worse kept (Capability API 1.240). `combat.initiative.checkAbility` says initiative is a check made with that ability, so whatever rolls such a check twice rolls initiative twice: a condition with `own-checks-advantage` (5e's Foresight) or a `checks` modifier with a `mode`, narrowed to that ability or to none (Enhance Ability's Cat's Grace on Dexterity). A catalog entry held on a sheet's list with `"initiativeMode": "advantage"` (or `"disadvantage"`) throws its holder's initiative twice whatever they hold: 5e's Feral Instinct. Advantage and disadvantage cancel out, as on any roll; the log's initiative entry carries `mode` and the `dropped` throw. A fight that throws initiative every round throws it twice every round. Thrown dice only: a pool's initiative is not thrown twice.

A reaction can answer its holder's OWN attack hitting (Capability API 1.241): a `"hit"` reaction with `"by": "self"` is offered to the attacker once their roll has hit, after everybody the blow struck has answered, and is aimed at whoever it hit (write `"at": "target"`). `"weapon": true` narrows any hit moment to a weapon's blow: an attack, or a creature's single-target action, from no catalog. A reaction to one's own hit is not stopped by what stops reactions, since choosing it is part of the attack; mark it `"free"` unless it really spends a budget. 5e's Stunning Strike is one: `"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`, free, a ki cost, a Constitution save and `stunned` until the end of the monk's next turn. With `"addsToBlow": true` an attack entry's amount joins that blow instead of being dealt on its own: rolled as the blow lands, doubled by its critical, its clauses only on a target they reach. 5e's Divine Smite is 2d8 radiant, `perCostStep` 1d8, a clause of 1d8 radiant with `targetIs` fiend or undead, and `"perCostStepsMax": 3`: the most steps of a higher cost that count, for any entry with `perCostStep` or `targetsPerCostStep`. An attack made inside another window (an opportunity attack) is never held for its hit, so nothing is added to it.

What a sheet holds can change its attack rows, grant strikes and wait for the attack action (Capability API 1.242). A catalog entry held on a sheet's list with `attackRows` changes the rows whose names it lists (matched without case), while its `when` bounds hold (a value off the sheet, such as armor worn at most 0): `abilities` uses the best of the row's own ability and these to hit and, where the row's damage adds the same ability, to damage; `die` (`from` a sheet value, through a step `table`, to a number of sides) rolls one die of that size in place of the row's dice where that is the better average; `qualities` add to what the blows carry past a resistance. 5e's Martial Arts is `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`, and Ki-Empowered Strikes is `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`. A held entry's `grantsStrike` lets its holder buy one strike with another budget once an attack's own budget is spent, exactly as a condition's `grants.attacks` does: `names` narrows it to those attacks, `melee` to reach, and `afterAttack` to a turn in which the attack action was taken (`true`, or `{ "names": [...] }` for an attack action taken with one of those). Martial Arts' bonus unarmed strike is `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`. A condition's `grants` takes the same `names` and `afterAttack`. An entry with `afterAttack` is offered only after the attack action: Flurry of Blows is a `utility` entry on the bonus budget, spending a ki, with `afterAttack`, `gives` 2 of a budget declared with count 0, and a `grantsStrike` of Unarmed Strike on that budget. The attack action is any attack made from an attack list or item paying its own budget or a strike it already bought, never one a grant paid for.

An opportunity attack is held where it hits exactly as an attack on a turn is (Capability API 1.243): everybody with an answer to that hit is asked, its maker last for what they add to it (Divine Smite, Stunning Strike), and the walk's own window, with its striker already answered, is asked on once the blow has landed. A walker who is held still on the way (a condition with `speed-zero`, such as stunned or grappled) goes no further than the cell they were struck in. An entry that is a reaction or is added to another blow is never picked as the opportunity attack itself.

Attack rules reach held weapons, and an attack list can give every sheet a row (Capability API 1.244). `combat.attacks[].always` lists up to 4 rows written in that list's columns that every sheet's fight has as well as its own; a sheet row of the same name is used in its place. 5e's unarmed strike is `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`. An `attackRows` rule's `names` now matches a held weapon by the name its attack goes by too, and its `items` matches held weapons by tags: every one of `tags` and none of `notTags` (`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`, so a dagger +1 counts); a rule names `names`, `items` or both. `wielding: { "only": {...} }`, with the same `names`, `tags` and `notTags`, keeps a rule only while every weapon held is one of those, or none is: "unarmed or wielding only monk weapons". A `grantsStrike` takes the same `wielding`, and a `when` like an `attackRows` rule's, so Martial Arts' bonus strike is not offered in armor.

Several uses at once, a save that drops to 0, hits by named attacks and harm as a condition ends (Capability API 1.245). An entry's `usesSpent` spends that many of its row's uses (or `usesOf`'s) in one use, and is offered only while that many are left: Quivering Palm's 3 ki. A `"hit"` reaction's `names` answers only a hit by those attacks, matched by name without case: Quivering Palm is `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`, putting on a long-lasting `quivering` condition. `dropsOnFailedSave` on an entry with a save drops a target that fails it to 0 health instead of dealing its amount (a creature is out, a character dying where the ruleset has a dying rule); a target that makes it takes the amount as the save's `onSuccess` says. Ending the vibrations is an action with `targetHolds: { "fromSelf": ["quivering"] }`, 10d10 necrotic, a Constitution save with `onSuccess: "none"` and `dropsOnFailedSave`. A condition's `onEnd.harm` (`dice`, `flat`, `type`, `unless`) deals damage to its holder as it ends, from whoever put it on, unless the holder is what `unless` names: Hurl Through Hell is a hit reaction with `dismisses: { "while": "hurled" }` and `hurled` lasting `{ "rounds": 1, "of": "source" }`, and the `hurled` condition's `onEnd` is `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`.

`afterAttack` matches the weapon the attack action was taken with by tags too (Capability API 1.246): `{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` is after an attack with one of those names or with a held weapon that has every one of `tags` and none of `notTags`, whatever it is called, so a dagger +1 counts. It names `names`, `items` or both, on an entry and on a `grantsStrike` or condition grant alike.

Reckless and brutal blows (Capability API 1.247). An entry with `beforeAttack` is offered only on its holder's own turn before they have attacked in it: Reckless Attack is a free `buff` on the barbarian with `beforeAttack`, applying `reckless` for `{ "rounds": 1 }` and `exposed` for `{ "rounds": 1, "at": "turn-start" }`. A change to attacks takes `attacks` (`weapon`, `spell` or `any`) and `blow` (`melee` or `ranged`) as a change to damage does, with `ability`: `reckless` is `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`, and `exposed` has the `attacks-against-advantage` effect. A damage change's `criticalDice` adds that many of the blow's own damage dice on a critical hit only, not doubled: Brutal Critical is a level on a derived value of the barbarian's with `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`, one level for each die.

Answers to a flurry's hits (Capability API 1.248). A `hit` moment's `budget` narrows it to hits by a strike paid for from that budget: Open Hand Technique answers `{ "on": "hit", "by": "self", "budget": "flurry" }`, the budget Flurry of Blows `gives` and its `grantsStrike` spends. A reaction's `oneOf` names a group of answers to its holder's own hit of which only one is taken per hit: Open Hand Technique is three free entries sharing `"oneOf": "open-hand"`, one with a Dexterity `save` applying `prone`, one with a Strength `save` and `push` of 15, and one applying a condition with the `cannot-react` effect for `{ "rounds": 1, "at": "turn-start" }`. Taking one spends the other two for that hit; the next hit offers all three again. `oneOf` goes on a `hit` moment `by` `self` with no `also`.

Rescues after the roll (Capability API 1.249). A change to `attacks`, `saves` or `checks` with `"rescue": true` is held back from the roll: only when its holder's own roll falls short, and its most (the flat part and every die at its highest) could make up the difference, is it rolled and added, and the condition it came from is spent. A roll it could not turn keeps it. Bardic Inspiration is a condition put on an ally with `{ "to": "saves", "dice": "1d6", "rescue": true }` and the same for `attacks` and `checks` (one condition per die size, chosen by the bard's level as other bands are); Guidance is `checks` with `1d4`, Resistance `saves` with `1d4`. A natural miss is never rescued, and a fight on a dice pool holds nothing back. An entry's `rescue` takes it off the menu: it is spent, with its uses and cost, when its holder's own roll of that kind has failed. `{ "roll": "saves", "by": "reroll" }` rolls the save again and the new roll stands (Indomitable with its own uses; Diamond Soul with `usesOf` Ki); `{ "roll": "attacks", "by": "success" }` turns a miss into a hit and `{ "roll": "checks", "by": "success" }` a failed check into a success (Stroke of Luck). Changes held back are tried first.

Cutting words and evasion (Capability API 1.250). An entry's `lowersRoll` is taken as somebody else's attack hits, on a `hit` reaction without `by` (with `for` and `within` to answer for allies): its `dice`, or one `die` sized by a value as Martial Arts' is (`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`), come off the roll, which is then checked again against the defense; a natural hit still hits. Cutting Words is a free `debuff` with `{ "on": "hit", "for": "ally", "within": 60 }` and `usesOf` the bard's inspiration counter. A combat condition's or level's `evasion` names saves: against something that deals half on a success, a made save takes nothing and a failed one half. Evasion is a level on the rogue's or monk's level with `"evasion": ["dex_save"]`.

Lay on hands (Capability API 1.251). An entry's `usesChosen` lets its user choose how many of its uses one use spends, from one up to what is left, and heals that many times its amount. The option carries `amount: { max }` and the choice sends `amount`; left out, it spends what heals the first target fully on average. It is for a `heal` with no `usesSpent`. Lay on Hands is a `heal` of `"amount": { "flat": 1 }` with `usesOf` a counter of five per paladin level, `usesChosen`, and `"targetTypes": { "not": { "types": ["undead", "construct"] } }`.

Font of magic (Capability API 1.252). An entry's `restore` gives back to a pool of whoever it lands on, on a `heal` or a `buff`: a live pool by id, or a list row's pool by its name (`"Sorcery Points"`). With a `cost` in a pool family, `perCostStep` adds to it for each step above the cheapest, so a sorcerer's slot becomes Sorcery Points equal to its level: a self `buff` costing `slots_1` with `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` and `"perCostStep": { "flat": 1 }`. `overMax` lets it go past the pool's maximum; what is past it is kept apart and goes when a rest sets the pool back to its maximum. A slot made from points is one entry per level, `usesOf` the points with `usesSpent` its price and `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`. An entry restoring its own user a pool they do not have is not on their menu.

Metamagic (Capability API 1.253). An entry's `alters` changes how an entry of its `catalogs` is used: it is never on a menu of its own, but offered with each one it fits, chosen as that one is used and paid for with its own uses (`usesOf` the Sorcery Points with `usesSpent`, or `usesSpentByLevel` for the level the spell is paid at, at least one). It is a `utility` with no reaction. Only one per use, unless it `joins` another. What it changes, each fitting only a spell it has something to change on: `spares` (a value off the sheet: that many of its user and their allies it catches make its save outright: Careful), `range` (`{ "times": 2, "touch": 30 }`: Distant), `rerolls` (that many of its damage dice below average thrown again, the lowest first: Empowered, with `joins`), `lasts` (what it puts on for a minute or more lasts that many times as long, never past a day: Extended), `heightens` (its first target rolls its first save at disadvantage: Heightened), `budget` (`{ "from": "action", "to": "bonus" }`: Quickened), `drops` (the components it then needs none of, and nobody can answer it being cast: Subtle), and `twins` (one more target for a spell of one target that is not its user's alone and gains none from a higher slot: Twinned). A spell that can only be cast with one of them right now (Quickened once the action is spent, Subtle under Silence) is offered with `alterNeeded`, and the choice has to carry it. The choice sends `alters`, the ids from the option's `alters`; the log says `altered`.

Metamagic as it is picked (Capability API 1.254). `rerolls` throws again the lowest of all a spell's damage dice, never more than that many in all: its own, every clause's in `plus`, and on a critical hit the extra ones with whatever is left. An attack spell rolls them for each target it hits. Where a `spares` alteration catches more of its user's side than it spares, its user picks who: the option's `alters` offer carries `spares` (how many), and the choice sends `spares`, the ids of its user's side to spare (none at all spares nobody). Left out, it spares the first it catches. The pick holds through a window that answers the cast. `spares` with no alteration that spares anybody, more ids than it spares, an id twice or one of another side is refused as `bad-alter`.

Heightened's target and Acid Arrow (Capability API 1.255). Where a `heightens` alteration catches more than one, its user picks who rolls their first save at disadvantage: the option's `alters` offer carries `heightens: true`, and the choice sends `heightens`, one combatant's id (one it is pointed at, where it is pointed at some, and never its user). Left out, it is the first it catches. An entry with `halfOnMiss: true` (it must have `attackRoll` and an `amount`) still deals half its damage on a miss, its clauses' too, and nothing else it does on a hit. An `applies` entry's `harmsPerCostStep` (`{ "dice": "1d4" }`) adds that much to what the condition `harms` with for each step of a higher cost it was put on with: Acid Arrow's later acid, 1d4 more a slot level above 2nd.

A holder's own rescues, entries never on their user, and conditions one at a time (Capability API 1.256). An entry's `rescue` may also be `by: "twenty"` (only with `roll: "checks"`): a failed check's d20 counts as a 20, spent only where that makes it, as Stroke of Luck does for an ability check. `by: "die"` adds a die of the holder's own where nothing given them could make up the difference and that die could: `dice` (`"1d10"`, Dark One's Own Luck) or one `die` sized by a value off the sheet, `{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }` (Peerless Skill). A condition given them is tried first. `notSelf: true` on an entry pointed at an `ally` or `any` creature keeps it off its own user: Bardic Inspiration. A combat condition's `oneAtATime` names a group (`"bardic"`): while a creature has one condition of that group, no other one of it, the same one included, goes on; the condition event says `already`.

Answers to more kinds of roll (Capability API 1.257). `lowersRoll` may also list `"also": ["checks", "damage"]`: besides an attack roll that hit, its dice come off somebody else's ability check (a contest such as a grapple, an item's gate, Counterspell's check) or damage roll as it is made. That is spent by itself, with the entry's budget, uses and cost, by the first on the other side whose entry reaches the roller, and only where its most could turn the roll: a check that would succeed and might then fail, or damage that would take one of its holder's side down and might then leave them standing. Cutting Words is `{ "dice": "1d6", "also": ["checks", "damage"] }` with its die sized by level, `needs: ["hearing"]` and `targetTypes: { "notImmuneTo": ["charmed"] }`. A rescue may name `saves` (only a rescue of `saves`): it is spent only on those saves. With `budget` it also takes one of that budget, and is not spent without it: a ring of evasion is `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }` with its charges as uses. An item's use may carry `halfOnMiss` too, with `attackRoll` and an `amount`: a scroll of Acid Arrow.

Diseases (Capability API 1.258). A combat condition's `kinds` (`["disease"]`) says what kind of condition it is. A kind is never a condition's own id. A cure's `ends` may name a kind in place of conditions: every condition of that kind counts, and its `count` still takes only that many, so Lesser Restoration's "one disease" is `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. An immunity (a creature's or item's `conditionImmunities`, or a condition's or level's) may name a kind too: Divine Health is a condition with `"conditionImmunities": ["disease"]`. A `saveEnds` may count: `successes` (2 to 10) is how many successes end it, and `failures` (`{ "count": 3, "becomes": "blinding_sickness" }`) puts on `becomes` in its place, with no clock and no more saves, once that many saves have failed. The condition event says `worsened`. That is Contagion: an `until-save` condition saved against at the end of each turn, with three either way. A condition with no clock is not lifted when the fight ends, so a disease that set in outlasts it until something cures it.

Rescues on worn items (Capability API 1.259). An item's `use` may carry a `rescue` as an entry's mechanics do, `saves` and `budget` included. It is never on the menu, and it is spent only while the item is worn (where it has slots) and has the `charges` its use spends. Spending it takes one of those charges. A ring of evasion is an item with `"charges": { "max": 3 }` and `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`. Its charges come back as the item's `recharge` says.

Diseases between fights (Capability API 1.260). A combat condition may carry `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`: each time its holder takes one of those rests while it is on them, health's maximum drops by that much, rolled where the rest is taken, after the rest has given back what it gives back. Without `lasting` the next rest returns it; with it, only something that unseals does. An `onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` is rolled first, as the ruleset's checks are and with the sheet's own modifier: only a failure lowers the maximum, and with `cures` a success ends the condition (the otyugh's disease). Only health kept in points has a maximum to lower. 5e's Mummy Rot is a no-clock condition with `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`. A save counted to an end or to what it becomes (1.258) no longer stops when the fight does: as any fight ends, fled ones included, its holder's remaining turn saves are rolled out, so Contagion is either shaken off or set in by then. A save made only on damage waits for damage.

Disease stages (Capability API 1.261). A combat condition may carry `onDamaged: { "applies": [...] }`, put on its holder each time they take damage, on a clock as `onEnd`'s are (Slimy Doom's stun until the end of the holder's next turn); `expires: { "becomes": conditionId }`, which it turns into, with no clock, when its own clock runs out, a fight's end included, but not when it is ended any other way (an aboleth's Tentacle disease after its minute); and `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`, so only a cure from those catalogs paid at that level or higher ends it. `onRest.restoredWhenCured: true` (with `lasting`) gives back what that condition's rests took off the maximum when it comes off, however it does, its own made save included. The `cannot-heal-nonmagical` effect keeps off every heal but a magical one: in a fight an action whose qualities say `"magical"`, out of one a restore op with `"magical": true` (a potion tagged `magical` is one), and never a rest; a refused restore says `cannot-heal`. A stat block's action may carry `ends` as a catalog entry does, kinds included: a unicorn's Healing Touch is `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`. A cure the caster picks among its conditions, one curse among several, is `cureOneOf` (1.204).

Qualities on a creature's action (Capability API 1.262). A stat block's action may carry `qualities`, item tags the ruleset declares, as a catalog entry's do: `["magical"]` makes its heal a magical one, which `cannot-heal-nonmagical` lets through, and a save against it a save against magic. An item's use in a fight carries the item's own tags the same way, so a potion tagged `magical` heals as magic there as it does on the sheet.

Auras (Capability API 1.263). A combat condition may carry `auras`, up to four: each spreads its `conditions` to whoever stands within `distance` of the holder, on `side` `allies`, `enemies` or `all`, and on the holder too with `self: true` (not with `enemies`). `when` reads one of the holder's sheet values with `atLeast` or `atMost`, so an aura can open at a level. A holder who is down, defeated or has the `cannot-act` effect spreads nothing. What an aura spreads goes on as the fight steps, comes off as the two part (the log says `aura` and `parted`), is never written to a sheet, and is gone when the fight ends; a condition an aura spreads cannot carry an aura of its own. Without a board the aura reaches everyone on its side. To have the holder start every fight with the condition, give a catalog entry's mechanics, or a stat block, `keepsOn`: the conditions it holds for the whole fight, also never written to a sheet. 5e's Aura of Protection is a kept `aura-of-protection` whose aura spreads a condition adding the paladin's Charisma to saves; Holy Nimbus is an aura on enemies whose condition harms at the start of their turn.

Forced behavior (Capability API 1.264). A combat condition may carry `behavior`, which decides what its holder does with their turn. `only` lists all the turn may hold besides ending it: `move` (walking and getting up), `escape` (breaking free of a hold) and standard actions the ruleset declares; an empty list leaves only ending the turn (Command's halt). `onlyWhenStuck` names standard actions allowed only while there is nowhere to walk (Turn Undead's Dodge). `moves: "away"` walks only away from whoever put the condition on, never a step nearer, ending further off; `moves: "toward"` walks only nearer (Command's approach, Sympathy). `table` is rolled as each of the holder's turns starts, `{dice, rows: [{atMost, does}]}`, and the first row the roll is at most decides the turn: `wander` walks all their speed one way a d8 picks and ends the turn, `nothing` ends it, `strike` allows only a melee attack at a creature in reach the dice pick (friend or foe; nothing with nobody there), and `normal`, like a roll above every row, leaves the turn alone (Confusion, Mindfire). The log shows the roll as a `compelled` event, and anything else is refused as `compelled`. A save that ends a condition may also be `at: "action"`: its holder spends their action to roll it (Irresistible Dance).

More from auras (Capability API 1.265). An aura's `conditions` are now optional, as long as it spreads conditions, harms or asks for a save. `needs` lists senses a receiver must have, and neither the holder nor the receiver may stand in a zone whose `inside.conditions` take those senses away: Countercharm `needs: ["hearing"]` stops at Silence. `harms` `{dice, flat, type}` is dealt by the holder to everybody the aura reaches as each of the holder's own turns starts (a balor's Fire Aura). `save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` is made by everybody the aura reaches as their own turn starts: a failure puts on `applies` from the holder at that difficulty, `seen` asks only while the two can see each other (a basilisk's gaze), and `immuneOnSuccess` keeps that holder's aura off them for the rest of the fight after a success (a pit fiend's Fear Aura). A save modifier's `against.casts` narrows it to saves against what is cast from those catalogs, an item's use that casts from one included, and then whatever else it names: Holy Nimbus's advantage against spells cast by fiends or undead is `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`.

More forced behavior (Capability API 1.266). A `behavior` may carry `drops` `{slots?, tags?, at, pickUp?}`: its holder lets fall each worn item taking one of `slots` or carrying one of `tags`, and each stat block action whose `qualities` carry one of `tags`, either as the condition goes on (`at: "applied"`, Fear's "drops whatever it is holding") or as each of the holder's turns starts (`at: "turn-start"`, Command's "drop"). What fell lies on the cell where they stood: none of its actions are theirs (refused as `dropped`), it gives nothing it gave while worn, and its share of the holder's defense is gone (a shield's 2). They pick it up standing on that cell or beside it, with the turn's one free pick-up, or for the `pickUp` budget when the condition names one; the log shows `letFall` and `pickedUp`. `onlyWhenStuck: "any"` makes a turn that starts with nowhere the condition lets its holder walk wholly their own (Fear's "unless there is nowhere to move"). `keepsOut` is a distance from whoever put the condition on: inside it the holder steps only further off, and it stops only outside it while anywhere outside is in reach (Turn Undead's "can't willingly move to a space within 30 feet of you"). A save that ends a condition may be `unseen: true`, rolled only while its holder cannot see whoever put it on (Fear's save out of line of sight). An entry's `applies` may carry `destroysUpTo` `[{tier, when?}]`: a creature that fails the save and whose threat tier is at or below the highest `tier` whose `when` holds on the user's sheet is destroyed outright instead (Destroy Undead, CR 1/2 at cleric 5th up to CR 4 at 17th); a character, or a creature with no tier, never is.

Targeting by any sense, targets near each other, growing areas, more uses and held things (Capability API 1.267). An entry or creature action that `needs` senses may add `needsAny: true`: a target that keeps any one of them qualifies, and only one that lacks them all is refused (Turn Undead's "each undead that can see or hear you"). `targetsWithin` is a distance every pair of picked targets must stand within, refused as `targets-apart` otherwise (Command's higher-slot creatures "within 30 feet of each other"). An `area` may carry `sizePerCostStep`, the distance its size grows by for each step its cost is raised (Confusion's sphere growing 5 feet a slot level); a wall never grows. An item with a `use` may list `moreUses` `[{label, use}]`: each is another menu entry, named after the item and its `label`, drawing on the same charges and let fall with the item (a wand of several spells). A creature may list `held` `[{label, tags, defense?}]`, things it holds that are no action of its own (a printed shield): a condition whose `drops` names one of their `tags` lets them fall with its tagged actions, their `defense` is gone from its own until it picks them up, and each is picked up like a dropped item.

Gazes, and auras by who they reach (Capability API 1.268). An aura may carry `targetTypes`, read as an entry's: it reaches only who is that (a sea hag's Horrific Appearance, humanoids only). `sourcesOf` names conditions: it reaches only whoever has put one of them on its holder (a barbed devil's Barbed Hide, harming whoever grapples it). An aura's `save` may carry `failedBy` `{atLeast, applies}`: a failure by at least that much puts those on instead (a medusa's gaze, petrified outright on a failure by 5 or more). A `seen` save may carry `avert: true`: whoever it reaches may, on their turn and for nothing, avert their eyes from its holder; until they look again (their own free choice too) they skip that save and cannot see the holder, so their attacks on it are made unseen; the log shows `averted`, and the director keeps its creatures' eyes averted while anybody else is left to fight. A save that ends a condition may carry `seenLean` (`"advantage"` or `"disadvantage"`): rolled so while its holder can see whoever put the condition on (the sea hag's repeated save, with disadvantage while she is in sight).

Staffs cast with their holder's numbers (Capability API 1.269). An item's `use` may read its save difficulty off its holder's sheet with `sheetDifficulty`, a value as `toHit.sheetBonus` reads one (`{ "derived": "spell_save_dc" }`), in place of `saveDifficulty`; its attack bonus is read off the sheet the same way already, with `toHit.sheetBonus` (`{ "derived": "spell_attack" }`) and no abilities. A use with `charges` may carry `chargeStep` `{max, amount?, targets?}`: its user may spend up to `max` more charges, each one a step of a higher cost, adding `amount` and `targets` as a higher slot adds `perCostStep` and `targetsPerCostStep`, and growing an area with `sizePerCostStep` (a Staff of Power's spell at a higher level, a Staff of Striking's 1d6 force a charge). The menu offers them as payments named `charges:<how many more>`, only as many as the item still holds. The same minor raises the conditions a ruleset may declare to 320, and an aura's `save` may carry `immuneWhenEnds: true`: once what a failure put on ends, however it ends (a save, its clock, a cure), that holder's aura stays off them for the rest of the fight, as `immuneOnSuccess` keeps it off after a made save (a sea hag's "is successful or the effect ends for it").

A kind named as it is cast (Capability API 1.270). A catalog entry's `mechanics` with `applies` may carry `kindChoice: true`: its user names one of `combat.creatureTypes` (a type or a tag) as they use it, offered as modes `kind-<id>`, and what it puts on remembers that kind. An aura of what it put on with `chosenKind: true` reaches only creatures of that kind, and one with `orSeen: true` also reaches whoever can see its holder however far off, so 5e's Antipathy puts a condition on its target whose aura, `side: "all"`, frightens the chosen kind within 60 feet or in sight, and its frightened ones move away (`moves: "away"`) while Sympathy's charmed ones move toward. A condition's `saveEnds` may carry `beyond`, in the ruleset's distance: its save is rolled only while its holder stands farther than that from whoever put it on, with `unseen` also out of their sight (Antipathy's "not within 60 feet of the target or able to see it").

More of what staffs and rings do (Capability API 1.271). An item's `use` may carry `label`, shown beside the item's name as a `moreUses` entry's label is ("Staff of Fire: Burning Hands"); a further use is named by its own `label`. A use may carry `amountAdd`, a value read off its holder's sheet and added to its amount, as a catalog entry's is (a Staff of Healing's Cure Wounds, `{ "abilityModFromField": "spellcasting_ability" }`), in a fight and outside one. A `chargeStep` may carry `push`, in the ruleset's distance: each charge more pushes its target that much farther, beside the use's own `push` (a Ring of the Ram's 5 feet a charge). An item's `charges.breaksOn` may carry `regains` `{atLeast, amount}`: when its last charge is spent and its die shows `atLeast` or more, the item gets `amount` charges back instead (a Staff of the Magi's 1d12 + 1 on a 20), in a fight, outside one and as the inventory spends a charge; `atMost` may then be left out for an item that never breaks.

An item that becomes another (Capability API 1.272). An item's `charges.breaksOn` may carry `becomes`, another item of the ruleset as `<catalog>/<entry>`, beside `atMost`: on the faces that would break it, the item becomes that one instead (a Staff of Striking's nonmagical quarterstaff, or a Staff of Power that keeps only its +2 as an item written with just that). In a fight its uses go and it strikes as the new item from then on, and the fight writes the stack back as that item, under its name and with no charges; outside a fight and as the inventory spends a charge, the stack changes the same way. The item named must be another item of the ruleset, in whichever catalog file it is.

Charges spent on a hit (Capability API 1.273). A weapon's `attack.spends` lists up to four ways its holder may spend the item's charges once a blow with it has hit: each has a `label`, the `charges` it costs, an `amount` of dice and a flat part added to the blow with its own damage `type` (the weapon's when it names none), and optionally `blow` (only a `melee` or `ranged` blow), `chargeStep` (`max` more charges, each adding its `amount` again: a Staff of Striking's 1d6 force a charge, up to three) and `onHit` (up to two conditions the one hit takes, each with `rounds`, a `save` that keeps it off, or `saveEnds`: a Staff of Withering's Constitution save). In a fight each is offered to the holder at their own hit with that weapon, and no other, after the one hit has answered; its dice are rolled with the blow and doubled by its critical, and the item's last-charge die is rolled as for a use. The item holds charges.

Numbers fixed off whoever put a condition on (Capability API 1.274). A condition an entry `applies` may carry a `value`, a value reference read off the sheet of whoever applies it as it goes on (Heroism's `{ "abilityModFromField": "spellcasting_ability" }`), and a combat condition's `temporary` gives its holder temporary points as each of their turns starts or ends (`at`): `dice` and `flat`, plus that value with `value: true`, and with `lostWhenEnds` what is left of them goes as the condition ends, unless the holder has more than it gave from something else. An aura's `save.appliedDifficulty` rolls its save against the save difficulty of whatever put the aura's condition on its holder, fixed as it went on (Antipathy/Sympathy's caster's spell save DC); its `difficulty` stays for an aura nothing put on. A save that ends a condition `at: "damaged"` may say `bySource`: rolled only on harm from whoever put the condition on (Sympathy's save when the target harms its holder). A condition's `behavior.keepsIn` keeps its holder, once within that distance of whoever put it on, from ever walking farther off (Sympathy's "can't willingly move away"). And an item's `use` may carry `kindChoice` as an entry's mechanics do (1.270), so a scroll of Antipathy/Sympathy names its kind as it is used.

Conditions held off rather than ended (Capability API 1.275). Beside `whileSourceInSight`, a combat condition's `orSourceWithin` (a distance in the ruleset's own units) keeps it holding while its holder stands that near whoever applied it, seen or not: out of sight and out of reach it is held off, still on its holder with its clock running, and it holds again the moment either is true (Antipathy's fright, within 60 feet or in sight). A combat condition's `suppresses` lists other conditions it holds off while it holds: what they do stops, they stay on, and they hold again once it ends (Calm Emotions' charm and fright, Mindless Rage's).

Teleports (Capability API 1.276). A catalog entry's `mechanics.teleport`, an item's `use.teleport` or a creature action's `teleport`, moves its user at once to a free place within `distance` (the ruleset's own units): no step between, so nobody gets a strike at them leaving, and a zone they land in catches them as walking in would. Only on a board, so it needs `combat.distance`; off a board an action that only teleports is not offered. With `seen`, only a place its user can see now (a wall, a fog or blindness that takes the eyes keeps the cells behind it off the list): 5e's Misty Step, `{ "distance": 30, "seen": true }`. `carries` (1 to 8) takes that many willing creatures of its user's side, no bigger than its user, from within `carriesWithin` (touching when left out), and each lands as near its user as there is room: Dimension Door, `{ "distance": 500, "carries": 1, "carriesWithin": 5 }`. A creature action with a teleport lands on the creature itself (a blink dog's Teleport). The option lists the cells it may go to as `teleport.cells`, and who may go along as `teleport.carries`; a choice names the cell as `at` and its company as `carries`. A teleport is never an area or a reaction.

Six conditions at once, and sight that is really seeing (Capability API 1.277). `applies` holds up to 6 entries on a catalog entry's mechanics, an item's use and a creature action (4 before): Rage and Frenzy each add Mindless Rage's condition beside their four. And `whileSourceInSight` (with `orSourceWithin` beside it) now reads the holder's own sight, as an aura's `orSeen` does: a clear line on the board is still needed, and on top of it the holder must see its source with its eyes or senses, so blindness that takes the eyes, a fog that obscures, the dark beyond what it sees in, or a source unseen to it (invisible) all break it as a wall does.

Calm Emotions (Capability API 1.278). A save may say `alliesMayFail: true` (on a catalog entry's, an item use's or a creature action's `save`): a target on its user's own side lets it in and fails without rolling, and the log says so, while anybody else rolls as usual. A condition's `effects` may carry `cannot-target-source-side`: its holder points nothing at whoever put it on them or at anybody on their side, unless that side is the holder's own (then it keeps nobody off). `endsWhen` takes two more endings beside `damaged` and `harmed-by-source-side`, up to all four: `attacked`, an attack roll made at its holder by anybody, hit or miss (an action that hits without rolling is not one), and `ally-harmed-in-sight`, damage to anybody else on its holder's side that its holder sees (a clear line on the board and its own eyes or senses). And `endsWhenHarmedFrom` lists catalogs: harm to its holder from anything cast out of one of them, by anybody, a scroll's spell and a standing zone's included, ends it; harm is damage, or being the target of a harmful action, as for `harmed-by-source-side`, and casting the very same condition on again refreshes it rather than ending it. Each of these waits until the step that caused it has finished. And a condition its holder's own active condition `suppresses` is no longer ended by an immunity that same condition gives: it is suspended, not cured, so a fright already on when a rage immune to fright begins comes back when the rage ends (5e's Mindless Rage), while new frights still cannot land.

Teleports out of the fight, seen passengers and smoke (Capability API 1.279). A `teleport` (on a catalog entry, an item use or a creature action) takes three more keys. `leaves: true`: it may take its user out of the fight altogether, a unicorn's mile, instead of to a cell; the choice then names no `at` (the menu shows a "Leave the fight" button), and its user and whoever goes along with it are gone alive (shown as "Left the fight", their health kept, and nothing brings them back). Off a board, leaving is the only place it goes, and anybody standing on its user's side may go along, since nothing measures who stands near. A party that is out of the fight with somebody of it gone this way has fled (the outcome `fled`, which ends the fight as fleeing does); an enemy gone this way is neither beaten nor still standing but got away, and the recap says so. The director's own creatures leave at a quarter of their health or less, taking whoever they may. `carriesSeen: true` (with `carries`): only those its user can see may go along, a unicorn's "willing creatures it can see". And `smoke` (`{}`, or `{ "pierced": [senses] }`): a cloud stands on the cells its user left and the cells it lands in, obscuring as a zone's `obscures` does, from the moment it lands until the end of its user's next turn, the Cape of the Mountebank's smoke.

A teleport that strikes (Capability API 1.280). A creature's teleport may name one of its own actions as `strike` (its `id`): a blink dog's "Before or after teleporting, the dog can make one bite attack." Teleporting then lets that action follow once this turn for nothing (the menu says "Free, part of the same action"), and the menu also offers it the other way round, as "Bite, then Teleport" on the teleport's budget, after which the teleport follows once for nothing. Neither leads on to a third. The strike made first spends the teleport's uses and recharge along with its own, and is offered only while both are left. The strike is another plain action of the same creature: not the teleport itself, a sequence, another teleport, a reaction or something bought with points. Only a creature's teleport names one; a catalog entry's or an item use's is refused. In a fight that measures no distance a teleport goes nowhere, so nothing is paired. The director takes it too: a creature too far off to walk to its prey teleports beside it and bites in the same turn.

Draining blows (Capability API 1.281). A catalog entry's `mechanics` or a creature's action may carry `drain`: its user regains health equal to the damage the blow dealt to each target, after resistances, rounded down and never above its maximum, and nothing comes off the target's maximum (for that, see `reducesMax`). `share` (above 0, up to 1, all of it when left out) is how much of it comes back, and `damageType` counts only damage of that type: an aboleth's Psychic Drain is `drain: {}`, Vampiric Touch `drain: { "share": 0.5, "damageType": "necrotic" }`. Something that stops healing stops this too. A drain needs damage to give back, so one on an entry without an `amount`, on a heal, or on a creature action without `damage` is refused.

Bursts centred on their user (Capability API 1.282). An `area` (a catalog entry's or a creature action's) may say `around: true`: a burst of `size` centred on its user and never aimed. Everybody within `size` of the user is caught when it is used, friend and foe alike unless `friendlyFire` is false (a mending one only its user's own side), and never the user. A wall between them keeps a creature out, unless the area also says `throughWalls: true`: a mummy lord's Channel Negative Energy, "including ones behind barriers and around corners". In a fight without a board it catches everybody. It is pointed at nobody, so it works as a signature action bought between turns as much as on a turn. Only a single burst is centred on its user (no `copies`), `throughWalls` goes only with `around`, and an entry's burst around its user lands at once, so it leaves no `zone`. Channel Negative Energy is a creature action with `signature: { "cost": 2 }`, `area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }` and `applies` a condition with the effect `cannot-heal` for `{ "rounds": 1, "of": "source" }`, until the end of the mummy lord's next turn. The director weighs one by whom it catches, as it weighs an aimed shape.

Legendary moves (Capability API 1.283). A creature action with a `signature` cost may say `move` and nothing else it does: its maker walks between turns, picking a square on the board as a walk on its own turn does, on an allowance lent for that move alone, so its own turn's movement is untouched. `move: { "share": 0.5 }` is a share of its speed (a tarrasque "moves up to half its speed"), `move: { "distance": 60 }` a distance in the ruleset's own unit, and `move: {}` its whole speed; not `share` and `distance` both. It is struck at leaving somebody's reach as any walk is, and the window it was bought in is asked on once the strike lands. `noOpportunity: true` provokes nobody (a vampire "moves up to its speed without provoking opportunity attacks"). `untouchable: true` is a move nothing can harm or hold (a mummy lord's Whirlwind of Sand, `{ "distance": 60, "untouchable": true }`): whatever holds its maker still lets go first, nobody strikes at it, and no zone or ground it crosses does anything to it. A creature held still, or with no speed, has nowhere to go with any other move. Nothing is offered off a board. The director buys one as it buys a teleport: to get clear of an enemy beside it when badly hurt, or to close on one when none is in reach.

Legendary casts (Capability API 1.284). A creature action with a `signature` cost may say `casting` and nothing else it does: between turns it offers each spell its maker could cast on its own turn with the action's `budget`, out of its `spellcasting` or its sheet's spells, named "Cast a Spell: Fireball" and so on. Each is aimed, paid and resolved exactly as on the creature's turn (targets, a cell for an area, a slot or a use spent as always), and the points are spent instead of the budget, so its own turn keeps every budget it had. `casting: { "cantripsOnly": true }` offers only cantrips (spells paid from no pool): a lich's Cantrip, `signature: { "cost": 1 }`. A sphinx's Cast a Spell is `casting: {}` with `signature: { "cost": 3 }`. Whatever the spell opens (a Counterspell, a reaction to being hurt by it) is answered as on a turn, and the window it was bought in is asked on once all of that has closed. The director buys one when the spell is worth the points, as it weighs any other signature action.

Moving after the action, and on one speed (Capability API 1.285). A signature action that does something (damage, an area, a save, a condition) may carry a `move` as well: what it does lands first, then its maker may move to a square the menu offered, picked with the action; picking none is a choice too, and a square it can no longer reach after what it did is simply not walked. A `move` may also name one way of moving with `speed` (`walk`, `fly`, `swim`, `climb` or `burrow`): its `share` is read off that speed alone, it moves by that way only, and a creature without that speed has nowhere to go. A dragon's Wing Attack is its burst around it (`area: { "shape": "burst", "size": 10, "around": true }`, its save and its prone) with `move: { "share": 0.5, "speed": "fly" }`: "The dragon can then fly up to half its flying speed." A `move` still carries no `teleport`, `sequence`, `reaction` or `charge`. The director flies off after the buffet when it is badly hurt beside an enemy, or closes on one out of its reach.

Light obscurement and the wind (Capability API 1.286). A zone's `obscures`, or a teleport's `smoke`, may say `light: true`: it then hides nobody and only lightly obscures whoever is seen through it or in it, as 5e's dim light or a Cape of the Mountebank's smoke does (the Engine knows who is seen that way; Hide and Perception read it). It may also say `dispersed: true`: a zone whose rule says `disperses: true` then ends it wherever the two meet, after every action, along with the concentration holding it. 5e's Fog Cloud is `obscures: { "dispersed": true }`, its Gust of Wind a zone with `disperses: true`; Darkness says neither, so the wind leaves it. A zone that only disperses needs no trigger.

Hiding, Search and Detect (Capability API 1.287). `combat.hiding` makes the `hide` standard action real: `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` names two of `combat.checks` and, optionally, `passive` (10), `lightly` (5) and the `combat.components` that make noise. Hide throws `stealth` on the fight's own dice; its user is then hidden from each opponent that does not see them clearly (behind a wall, in a fog, invisible, or seeing them only lightly obscured) and whose passive Perception, `passive` plus its `perception` check and `lightly` less when it sees them only lightly obscured, the total meets. An opponent they are hidden from does not see them, so it cannot point anything at them, they attack it as somebody unseen, and `combat.sight.unseenAttacks` gives that attack advantage. Hiding lasts across turns, and ends: for everybody, once its user attacks, makes a contest, harms somebody or asks for a save, or uses anything needing a `noisy` component (a spell with no verbal component, or a fog set down, keeps them hidden); and for each opponent that comes to see them clearly or whose passive now beats the total, after any step and on every cell of a walk. The `search` standard action (add it to `combat.standard`; it needs `combat.hiding`) throws `perception` and finds, for the searcher, everybody hidden from them whose total it meets. A creature action with `search: true` does the same and nothing else: a legendary Detect is `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`. A creature reads both checks off its own `checks`. The director searches when every opponent it has is hidden from it, and uses a Detect between turns when any is. Off a board nobody can be hidden but by a condition that already hides them.

Ready (Capability API 1.288). `combat.readying: { "budget": "reaction" }` makes the Ready action real: for each option its user could take with their `standard` budget now (an attack, a spell, a creature action) and for a walk, the menu offers two entries, readied for when an opponent comes within reach (`comes`) or for when one acts (`acts`). Taking one spends the standard budget and holds that option until the start of its user's next turn. When an opponent's walk brings it, on any step, to where the held option could be pointed at it (and its holder sees it), or an opponent finishes anything it does there, a window asks the holder, who takes the option called `readied` with `budget` (5e's reaction) or lets it go and is not asked again on that walk. A held walk goes as far as its holder's whole speed reaches, and leaving reach on it gives opportunity attacks as any walk does. With `"concentrates": true` (it needs `combat.concentration`) a spell is paid for as it is readied and held by concentration: going off it is not paid again, losing the concentration loses it, and one that never goes off stays spent. Readying anything else pays nothing until it goes off. 5e's is `{ "budget": "reaction", "concentrates": true }`.

Slow dispersal (Capability API 1.289). A fog's `dispersed` may be `{ "after": N }` instead of `true`: a wind that reaches it then ends it only once it has blown on it N whole rounds running, counted from the turn it first reached it. A wind that stops reaching it before then, moved, ended or gone, starts the count over when one reaches it again. 5e's Stinking Cloud, which a strong wind such as Gust of Wind disperses after 1 round, is `"obscures": { "dispersed": { "after": 1 } }`.

Looking for the hidden, weighed (Capability API 1.290). A check of the fight's read off a skill (`{ "skillMod": "stealth" }`) now counts as that skill's check on its throw, so a change narrowed by `skills` to it applies on Hide, Search and contests: heavy armor's disadvantage on Stealth, Pass without Trace's +10, Eyes of the Eagle's advantage on Perception. `combat.hiding.passiveMode` (5e's 5) is added to a passive Perception that has advantage and taken off one that has disadvantage; without it a passive reads no mode. A change `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` puts that mode on checks made to find its holder, both an opponent's passive and its Search; it takes a `mode` and nothing else. 5e's Cloak of Elvenkind. When a Search finds that somebody changes how it is thrown for them, it throws again for them alone, and the log shows that throw too.

A creature's own ways of hiding and looking (Capability API 1.291). A creature action may be a permission, `"standard": { "actions": ["disengage", "hide"] }`: those standard actions (from `combat.standard`) taken with that action's own budget, as 5e's goblin's Nimble Escape is with the bonus action. With `"while": "obscured"` it holds only while the creature stands in a fog or haze, or in a fight fought in dim light or darkness: the shadow's Shadow Stealth. A creature's `checkModes` roll its own checks with some skills twice: `{ "skills": ["perception"], "mode": "advantage", "sight": true }` only while it can see (Keen Sight), with `"light": ["sunlight"]` only in that light (Sunlight Sensitivity, with `"mode": "disadvantage"`), and with `"terrain": ["snow"]` only on a board tile or in a kind of place it names (Snow Camouflage; the places are the tactical generator's: snow, cave, mountains, water and the rest). A creature's `passive` is its printed passive Perception, used in place of `hiding.passive` plus its check (it needs `combat.hiding`). The light a fight is fought in comes from the scene's time of day: sunlight by day outdoors, dim light at dawn and dusk, darkness at night, and bright light that is not the sun's indoors or when the time says nothing the Engine reads. The light affects only what reads it (these modes, and `while: "obscured"`). Without `combat.sight.darkness` (1.294) it does not change who can see whom.

Somebody's own ways of hiding and of finding the hidden (Capability API 1.292). A catalog entry's `mechanics.hiding` (any kind, `utility` included) and a creature's `hiding` are permissions read where `combat.hiding` hides for real. `"behindLarger": true` lets its holder hide behind somebody at least one size larger standing between it and whoever looks, on every line between them (a halfling's Naturally Stealthy; needs `combat.sizes`). `"still": 10` adds that much to its Stealth total as it hides, taken off again once it moves or takes an action (a ranger's Hide in Plain Sight). `"slow": "advantage"` rolls its Hide with advantage when it has moved no more than half its speed this turn (a thief's Supreme Sneak). `"aware": { "within": 10, "lostWith": ["deafened"] }` means nobody within that distance, in the ruleset's own unit, is hidden from it, unless it has one of those conditions (a rogue's Blindsense). A creature's `"starts": 15` begins the fight hidden in plain sight with that total, from whoever's passive Perception does not beat it, whether they see it clearly or not, until it moves, and hides that way again with the Hide action (a gelatinous cube's Transparent).

A creature's own attack rolls rolled twice (Capability API 1.293). A creature's `attackModes` hold where its `checkModes` would: `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` is 5e's Sunlight Sensitivity, disadvantage on its attacks while it can see and the fight is fought in sunlight. Each mode says where it holds, with `sight`, `light` or `terrain`. The mode joins every other advantage and disadvantage on the roll, so the two still cancel out.

The dark (Capability API 1.294). With `combat.sight.darkness`, the light a fight is fought in keeps eyes from seeing: `{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`. Nobody in darkness is seen, and nobody in dim light is seen clearly, except by a sense of `seeIn` within its range, which sees darkness as dim light and dim light as bright, or by a `blind` sense or one of `pierced` within its range, which see whatever the light. What lights the dark: `carried`, the light everybody fighting from a sheet carries unless a sense of `seeIn` reaches for them (a torch); `light` on a condition (the Light cantrip), on an item's `worn` or `carried` effect (a lantern), or on a creature (bandits with torches, a fire elemental). Each is `{ "bright": N, "dim": N }` in the ruleset's own distance: bright light that far, dim light as far again. Walls keep light out, and somebody struck down sheds none. Where the dark is real, everything that reads the light reads it where somebody stands: who sees whom (attacks at the unseen, hiding, a creature you can see), standing obscured (`while: "obscured"`), and a creature's `checkModes` and `attackModes`. A fight in a cave or a dungeon is fought in darkness at any hour.

Putting a light out and lighting it again (Capability API 1.295). Whoever carries the `carried` light has a switch on their menu for it, named by its `label` (`"Torch"`; "Light" when it says none). It costs its `budget` where it names one, and is otherwise free once a turn. A light that is out sheds nothing, so its holder may go unseen in the dark; lit again, they are seen, and found if they were hiding. An item with a `toggle` sheds the `light` of its effect only while it is switched on, as a hooded lantern does.

Lights switched by creatures and items (Capability API 1.296). A creature action with `"sheds": { "bright": 10, "dim": 10 }` sets the light its user sheds from then on, and `"sheds": "out"` puts it out. It does nothing else and points at nobody: the magmin's Ignited Illumination is two such actions on its bonus action, and a will-o'-wisp's Variable Illumination is one action for each reach. A creature with `"unlit": true` begins the fight with its `light` out, which needs one of its actions to light it. An item's `toggle.offLight` is the light it sheds while switched off, in place of its effect's: a hooded lantern with its hood down sheds `{ "bright": 0, "dim": 5 }`. A light with no bright reach sheds only dim light, even where it is held.

Light from zones, and light that ends darkness or shows the invisible (Capability API 1.297). A spell zone's `lights` (feet, like any `light`) sheds light over the zone's own cells only, measured from its middle: the point a burst is cast at, or its caster for a zone held by its caster, so a bullseye lantern is a 60-foot cone anchored on its caster with `"lights": { "bright": 60, "dim": 60 }` that lights nothing behind it. Dancing Lights is one moving point zone with `{ "bright": 0, "dim": 10 }`. An obscuring zone with `"obscures": { "darkness": true }` is magical darkness, and a zone with `"dispelsDark": { "upTo": 3 }` ends every such darkness its cells meet whose slot was that level or lower, when either is cast: Daylight. A light with `"reveals": true`, on a zone, item effect, condition or creature, shows everybody unseen by a condition who stands in its bright light: a lantern of revealing. Any of these needs Capability API 1.297.

Light hidden under a condition, and sunlight (Capability API 1.298). A creature's `"lightOutWhile": ["invisible"]` puts its own light out, whatever its actions last set, while any of those conditions is on it, and brings it back when the condition ends: a will-o'-wisp's Invisibility hides its light too. A light with `"sunlight": true`, on a creature, item effect, condition or zone, makes its bright light sunlight, which is what `"light": ["sunlight"]` in a check or attack mode reads: a sun blade against Sunlight Sensitivity. Its sunlight counts over a board already bright, too.

Magical darkness against light (Capability API 1.299). A magical-darkness zone (`"obscures": { "darkness": true }`) with `"dispelsLight": { "upTo": 2 }` puts out the light a spell of that level or lower made, wherever the two meet and whichever came first: a zone's `lights`, or a condition's `light` put on by a spell, which ends with the spell's concentration where that holds it (5e's Darkness on Flame Blade). Only magical light lights any magical darkness's cells, whatever the fight is fought in: a spell's light on a zone or condition always is, and any other light is when it says `"magical": true` (a sun blade's); a torch inside the darkness lights nothing there. A `dispelsDark` with `"within": 60` ends only darkness that near its middle: Daylight's bright sphere, not its dim light beyond. Any of these needs Capability API 1.299.

A higher cost's more only every so many steps (Capability API 1.300). `"perCostStepsEvery": 2` adds `perCostStep` once for every two steps of a higher cost rather than for each. An action a condition gives (1.236) now grows by the cost the spell that put the condition on was paid at, with its own `perCostStep`, `perCostStepsEvery` and `perCostStepsMax`: 5e's Flame Blade strike is `3d6` with `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`, so a blade called up with a 4th-level slot strikes for 4d6. Using `perCostStepsEvery` needs Capability API 1.300.

Zones carried with somebody, and copies set down apart (Capability API 1.301). A zone's `"carried": "any"` makes a burst put on a cell somebody stands on go wherever they go, centred on them: 5e's Darkness or Daylight on an object they hold. With `"own"` only a cell its caster stands on counts, for a spell that may be cast only on its caster's own held object. Put on an empty cell, it stays there. A carried zone is a single burst at a point and is never moved of its own. An area's `"copiesWithin": 20` sets its `copies` down with each middle within 20 feet of another's, rather than touching, and a zone of copies its caster may `move` moves all of them the same way: 5e's Dancing Lights is a 10-foot burst with `"copies": 4, "copiesWithin": 20` and `"lights": { "bright": 0, "dim": 10 }`. Either needs Capability API 1.301.

Entries that change another (Capability API 1.302). An entry held on a sheet's list with `"amends": [{ "entry": "spells/eldritch-blast", ... }]` changes that entry of its holder's every time they use it, and several stack. `"damageAdd"` (a value, such as `{ "abilityMod": "cha" }`) is added to its damage on each hit: Agonizing Blast. `"range"` (in the ruleset's distance) is its range where that is farther: Eldritch Spear's 300 feet. `"push"` pushes whoever it hits that far straight away, and `"pushOptional": true` also offers it as "Eldritch Blast (no push)": Repelling Blast. A range or push needs `combat.distance`, and the named entry must exist. Needs Capability API 1.302.

Uses only in some light, and conditions moving or acting ends (Capability API 1.303). An entry with `"usableIn": { "light": ["dark", "dim"] }` is offered only while its user stands in one of those lights: One with Shadows. A condition's `endsWhenHolder` may also say `"moves": true` (it ends when its holder moves) or `"acts": true` (it ends when its holder takes an action, attacks or casts), beside `attacks` and `casts`: the shadows hide a warlock who stays still. Needs Capability API 1.303.

Once a creature until a rest (Capability API 1.304). An entry with `"oncePerTarget": { "until": "long" }` (a rest the ruleset declares) is not offered against a creature it was already used on until its user takes that rest, however many fights come between: Chains of Carceri. Whom it was used on is kept by name on the user's live sheet, and only that rest clears it. Not on an area or an entry aimed at its user. Needs Capability API 1.304.

Targets that grow with the sheet, and the same target again (Capability API 1.305). `"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` adds that many targets at each step of what it reads, as `scales` adds dice. With `"targetsRepeat": true` the same target may be picked more than once, and each pick is its own attack with its own roll, carrying everything that amends the entry: eldritch blast's beams, with Agonizing Blast's damage and Repelling Blast's push on each. The fight's target picker adds a beam per click while there is room, and the Engine, playing a combatant, puts any beams left over on the one it picked. Neither is on an area or an entry aimed at its user. Needs Capability API 1.305.

A weapon put in hand (Capability API 1.306). A `"utility"` entry with `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` puts one of those melee weapons in its user's hand for the rest of the fight, picked as it is used like a weapon's mode; `binds` also offers each held weapon it matches, which then counts as this one. With `proficient` it is used with proficiency, and its blows carry `qualities`. Another use replaces it, and a bound weapon goes back to what it was. Amends of the conjuring entry reach the weapon: an amend's `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` adds damage of its own type on a hit (Lifedrinker), and `"strikes": 2` makes one spend of the attack's budget buy that many attacks (Thirsting Blade). The Engine, playing a combatant, puts the weapon that hits hardest in hand once. Needs Capability API 1.306: Pact of the Blade.

What its own user holds (Capability API 1.307). A creature's own action may say `"concentration": true`, as a catalog entry does: what it puts on ends when that concentration does, and damage tests it as usual. An imp's or a quasit's Invisibility. A condition's `endsWhenHolder` may also say `"uses": ["scare", "spells/bolt"]`: it ends when its holder uses one of those, a creature's own actions by id or catalog entries as `<catalog>/<entry>`. A quasit's invisibility ends when it uses its Scare. An entry's `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` puts those conditions on its own user as it is used, whatever happens to its targets, held by its concentration when it has one, at the level it was cast at: Sunbeam's mote, a combat condition with `light` and `"actions": ["spells/sunbeam-line"]` for the later beams. A creature that is always invisible needs nothing new: `keepsOn: ["invisible"]` (1.263) keeps it on. Needs Capability API 1.307.

Left over from 1.303 to 1.306 (Capability API 1.308). A scroll's or a wand's `use` may carry `targetsScale` and `targetsRepeat`, read off its user's sheet: a scroll of eldritch blast fires a beam more at its reader's 5th level, and a wand's darts may all go at one creature. Needs Capability API 1.308. Three changes need no new key. A reaction is acting: a condition whose `endsWhenHolder` says `"acts": true` also ends on any reaction its holder takes, as One with Shadows ends on "a reaction". `oncePerTarget` tells two creatures of the same name apart: Chains of Carceri on one imp leaves the other imp, and a later fight's imp is barred only when the name was that one creature's. A weapon put in hand (1.306) may be a thrown melee weapon (an attack with both a `reach` and a `range`, such as a dagger or a javelin). It is dismissed for no action from the fight's menu, and it is gone when its maker dies. It is never more than 5 feet from its maker, because a fight never takes it out of their hand.

Hiding's needs, Feral Senses, surprise and the binding ritual (Capability API 1.309). A `hiding` with `still` may say `"stillWhile": { "holds": "camouflaged", "wall": true }`: the bonus counts only while its holder holds that condition (the camouflage made beforehand, with a 1-minute utility entry or set before the fight) and, with `wall`, stands beside a cell that blocks sight. That is Hide in Plain Sight. `"unseenStrikes": true` takes away the disadvantage of attacking somebody its holder cannot see, which is the first half of Feral Senses. The second half needs nothing, because a fight already knows where every creature is that is not hidden. A creature's `hiding` with `starts` may say `"surprises": true`: whoever it starts hidden from begins the fight surprised, as a gelatinous cube's Transparent does. A `conjures` with `binds` may name a live text field in `"boundIn"`: only the held weapon written there is bound, and none while it is empty. Writing the name there is the hour-long ritual done out of the fight, during a short rest. Needs Capability API 1.309.

Repeats and conditions that end at a distance (Capability API 1.310). A concentration entry's mechanics may say `"repeats": { "budget": "action" }`: while its user concentrates on it, its effect is offered again on that budget, costing nothing off the sheet, starting no new concentration and putting nothing on its user again, at the level and cost step the cast was paid at. The menu shows it as "Vampiric Touch again". `"notSaved": true` never offers it at a creature that succeeded on a save against this casting (Eyebite), and `"sameTargets": true` offers it only at whom the cast was aimed (Heat Metal, on a bonus action). `repeats` needs `concentration` and a known budget. An `applies` may say `"endsAway": { "beyond": 60, "unseen": true }`: the condition comes off once its holder stands more than that far from whoever put it on and, with `unseen`, cannot see them. That is Eyebite's panic. It is asked on every step of a walk, anybody's, and as every turn ends. Needs Capability API 1.310.

Left over from 1.307 and 1.309 (Capability API 1.311). An item's `use` may carry `appliesSelf`, as an entry's mechanics do: a scroll of Sunbeam leaves the mote, and with it the later beams, in its reader's hand, held by the reading's concentration. A creature's action may say `"dyingOnly": true` (only a creature at no health that is still alive may be picked), `"slaysOnFailedSave": true` (a target that fails the action's own save dies) and `"healsOnSlay": { "dice": "3d6" }` (the creature regains that much for each one that dies). That is a will-o'-wisp's Consume Life. `slaysOnFailedSave` needs a `save`, and `healsOnSlay` needs `slaysOnFailedSave`. A rule in `combat.conditions` may say `"endsWhenHolder": { "moves": true, "acts": true }`: the condition comes off its holder, and off their sheet, on their first step (`moves`) or anything they do but Hide, reactions included (`acts`), however it was put on. That is Hide in Plain Sight's camouflage, ticked on the sheet before the fight. Needs Capability API 1.311.

A thunderclap around a hit (Capability API 1.312). A weapon's mode may say `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`. A hit in that mode makes the one it hit, and everybody standing within `within` of them, save or take `condition`. That includes allies and the wielder, if they stand that close. `rounds` counts their own turns, or with `of: "source"` the wielder's, so `rounds: 1, of: "source"` is "until the end of your next turn". `of` needs `rounds`. Off a board only the one hit saves. Together with the mode's `range` and `charges`, this is a Hammer of Thunderbolts hurled for a charge. Its Giant's Bane is the weapon's `slay` with `when: "critical"`. Needs Capability API 1.312.

Maze, Expeditious Retreat, a casting's choices and capped ability adds (Capability API 1.313). A `dismisses` with `while` may say `"turns": true`. The creature is out of the fight but still takes its turns, and on them it is offered only what ends the condition that keeps it away, or ending the turn. An `applies` may carry `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`: its holder may spend the standard budget on that `combat.checks` check against the number to end it. A creature that `passes` succeeds without a roll. Together these are 5e's Maze and its minotaur, back where it was when the check succeeds. An entry's mechanics may say `"takes": ["dash"]` (or `disengage`, `dodge`), and its user takes those standard actions as it is used: Expeditious Retreat Dashes as it is cast. The bonus-action Dashes after that come from its condition's `grants`. A `repeats` may name a `group`: entries of one group are one casting's choices, and while any of them is concentrated on, every one of them is offered again. `notSaved` and the cast's level are shared, as with Eyebite's asleep, panicked and sickened. An item's ability change `{ "add": 4, "max": 30 }` goes on top of the score that every `set` leaves, up to `max`, and never lowers a score already above it. Without `max`, an add works as before. An item's `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` lets it be bound only while one item of each group is worn by the same character, bound where that item binds, and unbinds it as soon as one of them comes off, is unbound or leaves their bag. With `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }` that is a Hammer of Thunderbolts. Needs Capability API 1.313.

Resilient Sphere (Capability API 1.314). A `combat.conditions` entry may carry `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`. While the condition holds, its holder is shut away from everybody else. Nobody else can aim anything at them, an area or burst passes them by, and nothing from anybody else harms, heals or puts a condition on them, zones and auras included. Nothing of theirs reaches anybody else either, and nobody strikes at them as they move, nor they at anybody. Their own movement is nothing, but with `rolls` they may spend that budget to move up to `share` of their speed. With `lifted`, somebody standing next to them may spend that budget to pick them up. After that the holder goes wherever the bearer walks until the bearer puts them down, which is free, or the condition ends. The entries in `brokenBy` may still be aimed at the holder, and instead of doing what they do they end the condition and the concentration holding it: Disintegrate on the sphere. An entry's mechanics may say `"targetsUpTo": "large"`, one of `combat.sizes`, and it is then aimed only at creatures that size or smaller. That is Resilient Sphere's "Large size or smaller". Needs Capability API 1.314.

Lair actions (Capability API 1.315). A creature action may carry `"lair": true`, and the creature `"lairInitiative"` (20 when left out). While the creature fights in its lair (the Game Master's `"inLair": true` on that enemy, or an encounter's `inLair` list), it takes one lair action a round as the fight's count passes its lair's number, losing ties: between the two turns that number falls between, after the round's last turn when everybody is at that number or above it, or before the very first turn when everybody is below it. It may not take the same lair action two rounds running. A lair action is aimed and resolved as on its own turn, with its `budget` lent for it, and spends nothing of the creature's own turn. It is never on the creature's own turn's menu, and is not taken while the creature is down or cannot act. A lair action is neither a reaction nor bought with points, a sequence never names one, and `lairInitiative` needs at least one lair action. 5e's dragons take theirs on initiative count 20.

Props (Capability API 1.316). A fight on a board may have props standing on it that can be broken: an encounter's `board.props`, or a world battlefield's `props` as painted. Each has a `label`, the `cells` it fills, its `health`, a `defense` (10 when left out), and optional `resist`, `vulnerable` and `immune` damage types. `blocks` closes its cells to walking (`move`), to seeing (`sight`), or both while it stands, and nobody starts the fight inside it. A `fragile` prop is broken by anything that hits it. An attack that may strike a wall's section may strike a prop instead: it is listed among the option's `walls`, and the choice's `wall` names its cell. An area catches every prop it reaches and deals the same damage it rolls for everybody else; a prop never saves. A prop at 0 is broken: it closes nothing more, and its label is added to the board's `broken` list, the fight's summary and the recap the Game Master reads (`Broken: Sluice Gate; Oil Jar`). A story's `broke` trigger fires on it.

Legendary Resistance (Capability API 1.317). A creature's `"legendaryResistance": 3` turns its first three failed saves in a fight into successes, 5e's "If the dragon fails a saving throw, it can choose to succeed instead" (3/Day). The Engine always chooses to, on any save, including one a condition fails outright; never while the creature is down. The save is logged as rolled, followed by a line saying it succeeded instead and how many are left. A whole number from 1 to 20.

An item's use may carry `"targetsUpTo"` too (Capability API 1.317), as an entry's mechanics do since 1.314: a scroll of Resilient Sphere's `"targetsUpTo": "large"` reaches only a creature of that size or smaller. It reads `combat.sizes`, and is for a use pointed at a creature, not an area.

Board events and growth (Capability API 1.318). A fight's board may change on its own as rounds pass: an encounter's `board.events`, or a world battlefield's `events` as painted. Each event has an `id`, an optional `label`, and happens `at` `"round-start"` or `"round-end"`, `from` a round (2 at a round's start, 1 at its end, when left out), `every` so many rounds (1), and `until` a round if it says. `where` names its cells: `cells`, a `block` (`x`, `y`, `w`, `h`), a `ring` around a cell (`x`, `y`) that reaches `start` squares the first time and `step` squares further each time after, a `sweep` in from one edge (`from` `north`, `south`, `east` or `west`) by the same `start` and `step`, or `{"spread": "growth"}`, every open cell beside growth. A ring or sweep reaches only its newest band, `step` squares deep (one at least), the first time too, so a ring with `start` 3 leaves its middle be; `filled` reaches everything inside. `onlyOn` keeps it to cells of those terrains. `change` says what happens there, at least one of: `terrain`, `height` (0 to 3), `light` (`bright`, `dim`, `dark`, `sunlight` or `clear`), `obscured` (`light`, `heavy` or `clear`), `growth` (true or false), `season` (a name, or null to take it off), `rotate` (a square `block` only, turned 1, 2 or 3 quarter turns clockwise with its tiles, heights, ground, the props wholly in it and whoever stands wholly in it), and `tell`, the line the log says in place of the plain one. Whoever is left standing where nobody may stand (ice cracked to water) is set down on the nearest open cell. A board holds up to 32 events.

Carried along (Capability API 1.329). A board event's `change` may also say `push`, `{"toward": "east", "squares": 3}` (an edge, `north`, `south`, `east` or `west`, and 1 to 6 squares): whoever stands on the ground on its cells is carried that way a square at a time, never off the board, into a wall or a closed prop, onto ground nobody may stand on, or into anybody else, and nobody strikes at them for it; those nearest that edge go first, and somebody aloft is left be. The log says who it carried. The Mill of Hours' millrace. Or `drift`, the same shape: whatever obscures its cells (light or heavy) is blown that way and comes back in at the far side of its `block`, or of the board for any other `where`; nothing else on the cells moves, and heavy stays where light is blown onto it. The Leaffall's drifts. A battlefield's painted events take both.

Growth on a cell costs double to enter (no more than other hard going) and lightly obscures whoever stands in it. A blow whose damage type cuts growth (slashing, unless the board's `growth.cutBy` says otherwise) may be aimed at a cell of growth it reaches, listed among the option's `walls`: it clears that cell with no roll and spends the action. Damage of a type that burns growth (fire, unless `growth.burnedBy` says otherwise) burns it off every cell it lands on, an area's whole reach or the cell of whoever it hits. An entry's mechanics, or an item's use, with `"clears": "growth"` and an `area` clears growth from that area: pruning shears, `{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`. An encounter's `board.ground` paints growth, light, obscurement and seasons on cells to start with; a world battlefield paints growth as `growth` rows of `g` and `.`, and its seasons as Experiences do.

Shade, light rules, chimes and the light-shy (Capability API 1.319). A light with `"shade": true` sheds shade: dim light as far as its `dim` reaches, and bright light and sunlight there are dim too, whatever else lights them. It has no bright light, and is neither `reveals` nor `sunlight`. Shade never reaches into magical darkness. The showcase's Lantern of Dusk is an item carried with `{"light": {"bright": 0, "dim": 15, "shade": true}}`. A cell's own light (1.318) and shade are what eyes read there too: on a bright board a creature standing in a dark cell is not seen but by a sense that sees in the dark.

A fight's board may have a light rule: an encounter's `board.lightRule`, or a world battlefield's `lightRule` as painted. As each round ends, everybody standing wholly in one of its lights (`in`, bright light and sunlight when not said; bright light includes sunlight) counts one more round end there, and on every `rounds`th (1 when not said) its `tracks` move by `by` and its `applies` conditions go on them. Stepping out, even into one cell's shade, starts the count again. `spares` names the creature `types` and `tags` it never touches. A rule that moves no track the sheet has and puts on no condition the fight knows does nothing and is dropped. Noonfield is `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`: a level of exhaustion a minute in the sun.

Light rule saves (Capability API 1.321). A light rule's `save` (`save`, `difficulty`) is rolled by each creature it is about to touch, and a made save escapes it this time; the count starts again either way. Its `against` (`conditions` the fight knows, `damage` types) is what the save counts as being against, so a save modifier with a matching `against` applies: a straw hat worn or carried with `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`. A track entry's `upTo` is as far as the rule moves it, so exhaustion that would pass it stops there and none at all is added once it is reached. Noonfield as written: `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`, with a `noon_light` condition the experience adds for the hat to name.

Item uses as reactions (Capability API 1.322). An item's `use` (or one of its `moreUses`) may carry a `reaction`, said as a catalog entry's is, and is then offered only when that moment opens, paid from `budget` (the bearer's reaction) and from its charges or the item itself as any use is. Liesl's Coffin, once a day as a creature within 5 feet of its bearer is hit, +5 AC on them until the start of the bearer's next turn, against that hit too: `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}` on an item with `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`. The Straw Proxy, an attack aimed at its owner lost and the proxy burnt: `{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`. An item's use names its moment: `"reaction": true` is refused.

Held Ground and reaping (Capability API 1.323). A fight can be fought on Held Ground, a place where death is held: the fight's `heldGround` (`label`, a `condition`, and `marks` as `[{"track", "by"}]`), which the story's region rule hands it. There, whoever reaches no health is felled instead of dying or going down: an opponent is out of the fight; a character lies stable, never rolls to die and takes no failures from being hurt, and can be healed up as usual. The felled take its `condition` (and a character the ruleset's own condition for being down), and each with a sheet moves its `marks` tracks: the showcase's mark of Owing. What would slay outright fells instead. A blow that `reaps`, on a creature's action or an item's attack, reaps whoever it fells: they stay down, take no condition and no mark, and a character reaped is dead. The Reaping Hook is a weapon whose `attack` has `"reaps": true`. Felled and reaped combatants carry `felled` and `reaped`, for the story to raise the felled later.

Held Ground let go (Capability API 1.330). The story can let Held Ground go in the middle of a fight, as the year turns: the director's `releaseRulesetHeldGround(definition, state, release)` (the shared `rulesetReleaseHeldGround` underneath). From then on whoever reaches no health dies or goes down as anywhere else. The felled who were not reaped die, opponents and characters alike, unless `release.felled` is `"down"`, when a character goes down instead and starts dying by the ruleset's own rule. With `release.owing` (`{"track"?, "bonus"?}`, the track being Held Ground's first marked one when left out), each character's marks on it come due: one of the ruleset's dying saves a mark, `bonus` added to each (the party's Debts Settled), rolled until the marks run out or the count is decided, with naturals as the dying rule says; the marks are then spent. Three failures (the failures track's top) is death. The log says who died, who went down, and each character's rolls. A fight not on Held Ground is left as it was.

Creature areas and ground (Capability API 1.324). A creature action with an `area` can leave that area standing with `zone`, written as a catalog entry's zone is (`rounds`, `triggers`, `obscures`, `terrain`, and the rest): The Owed's Freezing Fog, Scatter Flour's cube of flour, the ground freezing into hard going. A zone with `"untilLair": true` also ends as its maker's lair count next comes round, before that lair action is chosen, if its `rounds` have not ended it first: "until the next lair action". A creature action can instead change the ground its area covers for good with `ground`, as a board event's `change` says it (`terrain`, `height` 0 to 3, `light`, `obscured`, `growth`, `season`, and a `tell` for the log): the bonfire gutters (`"light": "dark"`), the ice cracks (`"terrain": "water"`); whoever is left on a cell nobody may stand on is moved to the nearest open one. Both need the action's `area`, and a `ground` changes something. A ruleset using either, or `untilLair` anywhere, needs Capability API 1.324.

Creatures called into a fight (Capability API 1.325). A creature action may say `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`: as it is used, that many of the named bestiary creature (a `"<catalogId>/<entryId>"` from the ruleset's catalogs or the bestiary the fight was handed; `count` is `{"dice"}`, `{"flat"}` or both, eight at most each time) join the fight on its user's side, built as the fight built its own and named one by one ("Zombie 1", "Zombie 2"). With an `area` they are set down where it is aimed, and as near it as there is room once it is full; without one, beside their caller, and the action is aimed at nobody. They throw their own initiative and take their place in the order: a place this round's turns have passed is next round's. With `"initiative": "after"` their turns come right after their caller's instead. A lair action may call (Shelves Lean), and the turn its count came between goes on as it was. A creature found nowhere when the fight begins calls nobody, and a fight holds no more than 40. The log says who came. A ruleset using `calls` needs Capability API 1.325.

Drawn toward a creature (Capability API 1.326). A creature action may say `"draws": { "spends": "reaction" }`: whoever it lands on (with a `save`, only on a failed one) spends that budget there and then to walk up to their speed toward the creature, by the open way to the cell they can reach that is nearest it, drawing no strikes. Somebody with none of that budget left, or who could come no nearer, spends nothing and stays. The Owed's Whisper a Name. `spends` is one of the economy's budgets. A ruleset using `draws` needs Capability API 1.326.

Lair timing (Capability API 1.327). A creature action with `"actedOnly": true` may be pointed only at somebody who has already begun their turn this round, the one going on included; before the fight's very first turn, while a lair acts ahead of everybody, nobody has. That is the Hour Bell's "one creature that has already acted this round". A condition's duration may add `"untilLair": true` to its `rounds`: it also comes off as whoever put it on next comes to their lair's count, before that lair action is chosen (the Hour Bell's "until the next lair action"). A creature action held by its `concentration` may name `"brokenNextLair"`, one of its own lair actions: once that concentration is broken (by harm, by going down, or by what a zone does, never by its holder ending it or beginning another), that lair action is the next it takes and the only one offered, whatever it took the round before; once taken, the choice is free again. Father Ivo's Litany of Keeping and the shelves leaning. A ruleset using any of these needs Capability API 1.327.

Save difficulty moved by a condition (Capability API 1.328). A condition's change `{ "to": "save-difficulty", "flat": -2 }` moves the difficulty of every save its holder calls for while they hold it: their actions' own saves, and the save difficulty given for saves that end what those actions put on. It takes a `flat` amount and nothing else, and it never touches a check's difficulty, a concentration save (set by the damage), or the creatures an action calls into the fight. The Miller of Hours' Un-age: a spell save DC 2 lower. A ruleset using it needs Capability API 1.328.

Props and feeding (Capability API 1.331). A combat condition may say `"whileNearProp": {"prop": "Year-Wheel", "within": 10}`: it holds only while its holder stands within that distance (the ruleset's own) of a standing prop of the board with that label, and is held off, not ended, anywhere else or once that prop is broken; a fight with no board holds it. The Wheel's Favour. A creature action's burst `area` may say `"aroundProp": "Shelf"`: wherever it is aimed, it covers every cell within its `size` of a standing prop with that label, behind it too. Shelves Lean around the Granary's shelf rows. An aura may say `"feeds": 15`: its holder regains that many hit points whenever somebody the aura reaches is felled, goes down or is slain, and an aura may do only that. The Owed's Collector. A ruleset using any of these needs Capability API 1.331.

Relighting, falling in, and uses beside a prop (Capability API 1.332). A board's prop (an encounter's `board.props`, or one painted on a battlefield) may say `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`: while any cell within `squares` of it is not in that light as the fight reads it, somebody standing beside it is offered "Light it again" for that budget (`action` when not said), which puts that light on every one of those cells. The Owed's bonfire after Bonfire Gutters. A creature action's `ground` may say `"occupants": "stay"` with its `terrain`: whoever stands where the ground turns to something nobody stands on stays there, fallen through the ice into the water, rather than being moved to the nearest open cell (`"shove"`, the default). A catalog entry or an item's use may say `"usableNear": {"prop": "Year-Wheel", "within": 5}`: it is offered only while its user stands within that distance of a standing prop named by its id or its label, never in a fight with no board. Fennick's Hymnal at the Year-Wheel. From 1.332 `whileNearProp`, `aroundProp` and `usableNear` all name a prop the same way: by its id (`"p1"`), or by its label read loosely, ignoring case, a leading "the" and anything but letters and digits, so `"Year-Wheel"` finds a prop labelled "The Year-Wheel". A ruleset using `usableNear` or `occupants` needs Capability API 1.332.

Fight-board art (Capability API 1.333). A fight's board can be drawn from a board pack: PNG sheets on a grid of cells (48 pixels for the RPG Maker look) with tiles under fixed ids, made in Pixelforge and kept in the library (`POST /api/game-tile-packs/boards`). `bt_plains`, `bt_forest`, `bt_mountain`, `bt_ruin`, `bt_water` and `bt_wall` are the terrains, up to eight variants each picked per cell, or one pattern larger than a cell laid over the board; `bt_edge_water` and `bt_edge_wall` are dual-grid blocks of sixteen pieces, four cells by four, laid out as Pixelforge's `edge_` blocks, that blend water and walls into the plains beside them; `bt_height1` to `bt_height3` are rims over raised ground. `bo_dim`, `bo_dark`, `bo_sunlight`, `bo_fog_light`, `bo_fog_heavy`, `bo_growth`, `bo_ice` (a cell in winter), `bo_zone`, `bo_aim` and `bo_reach` are drawn over a cell in place of today's tints. A prop's sprite is `bp_<name>` across its cells (`"art": "bp_bonfire"` on the prop, or, left out, its label in lowercase words joined by `_` with a leading "the" dropped, so "The Year-Wheel" is `bp_year_wheel`), and `bp_<name>_broken` once it is broken. A painted battlefield or an encounter's board may name its pack with `"pack": "local/<id>"`; with none it is drawn with the library's pack for its environment (a pack's `environment`), then the built-in `board/<environment>`, then as today, and props are also looked up in the library's props pack (`"environment": "props"`), then the built-in `board/props`. A tile a pack lacks is drawn as today. A catalog zone may say `"art": "bz_<name>"`: every cell it covers is drawn with that tile of the board's pack, else with `bo_zone`. A ruleset using zone `art` needs Capability API 1.333.

More of the turn from an item (Capability API 1.334). An item's use may say `"gives": [{"budget": "action", "count": 1}]`, as a catalog entry's mechanics may (Action Surge): using it hands its user that much more of the turn at once, capped where it lands, so nothing is saved for later. The Time-Flour Loaf, eaten for a bonus action, gives one more action now. A ruleset using it needs Capability API 1.334.

Dice spent on a rest (Capability API 1.335). A rest may say `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`: the Game Master's `[sheet: op="rest" rest="short" dice="2"]` (or one for the whole party) then spends that many of `pool` first, rolls each die (`die` is any value, or an enum field written "d8") plus `add`, never below 0 a die, and gives that much back to `heals` as a heal that is not magical, before the rest does what it says. `extra` is one more die for everybody who spends any: the party member whose `die` reads the most sides rolls it for each, plus their own `add`. 5e's Song of Rest, and Pell's Brown Teapot's +1 on each of its dice as an item stat the `add` reads. A ruleset using rest `dice` needs Capability API 1.335.

Rest dice over several pools (Capability API 1.337). A rest's `"dice"` may be a list, one entry per pool, each with its own `die`, `add`, `heals` and `extra`: `[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`, so a fighter 1 / wizard 1 spends a d10 and a d6. `[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` spends from that pool only; without `pool` the dice come from the first listed pool that has any, then the next, and too few in all is refused with nothing spent. The extra die (Song of Rest) is the first entry's that has one, rolled once for the whole spend, and it heals what the first pool spent from heals; it comes even when only a later pool pays. In a game, a rest's dice read what each character carries, so an `itemStat` in `add` or in the extra die's `add` counts: Pell's Teapot, `{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`. A ruleset with a list here needs Capability API 1.337.

Icons (Capability API 1.338). A catalog entry and a sheet condition may name their icon, `"icon": "ic_poison_cloud"`: a tile of the game's icons pack (a board pack of kind `icons`; see packages/server/src/assets/board-packs/README.md). Without one, the Engine looks for the derived name: a condition `ic_cond_<id>`, an item `ic_item_<entry id>` (or `ic_item_<name>` for one the Game Master invented), any other catalog entry `ic_<catalog id>_<entry id>` (`ic_spells_fireball`), hyphens as `_`. Without either, today's letter or text is shown. A ruleset that names an icon needs Capability API 1.338.

How the fight screen shows your ruleset (Capability API 1.375). On a board, the combat pane marks each budget with a small round pip: a letter on a colour, filled while the budget is still there to spend. A budget may name both, `"short": "A"` (one or two letters) and `"tone"`, one of `rose`, `amber`, `violet`, `teal`, `sky`, `lime`, `orange` and `slate`; without them the pip takes the first letter of the budget's label and a tone by its place in the list, which gives 5e's Action, Bonus action and Reaction A, B and R in rose, amber and violet. `combat.display` says the rest: `"defense": {"short": "AC"}` heads the turn order's defense column (up to six letters; without it a short label is kept and a longer one becomes its initials, so "Armor Class" reads "AC"), and `"hide": true` leaves the column out for a ruleset whose defense is no single number worth a column. `"pools": ["slots_1", "slots_2", "ki"]` lists the sheet pools shown under the turn in hand, in that order, as dots (spell slots by level, ki). Each must be a pool `sheet.live.pools` declares, named once; a pool a list's rows make is refused. Without it the pools the party's actions spend are shown, in the order they are spent. A ruleset using `short`, `tone` or `combat.display` needs Capability API 1.375.

A list of lair actions for a broken concentration (Capability API 1.336). `"brokenNextLair"` may be a list of its own lair actions, each once, instead of one: `["shelves_lean_north", "shelves_lean_south"]`. Once that concentration is broken, the next lair action is one of those and no other, whatever it took the round before, and whoever runs the creature picks which. A creature the Engine runs takes the one that would catch the most of its foes; between equal ones, it weighs them as it weighs anything else. Once taken, the choice is free again. A ruleset with a list here needs Capability API 1.336.

A condition, or an item worn or carried, with `"alerts": 15` gives away whoever moves hidden within that distance of its holder: they are hidden from nobody, logged as given away by its holder. The showcase's Wind-Chime is an item carried with `{"alerts": 15}`. A creature's `"stillIn": ["bright"]` keeps it from moving while any of its cells is in one of those lights: no walking is on its menu there. The showcase's Lantern-Shy.

Growing auras, holds with a most, tearing free and hanging on (Capability API 1.320). An aura's `"grows": {"by": 10, "upTo": 40}` reaches `by` further as each of its holder's turns starts, to no more than `upTo`, which is more than its `distance`; the log says how far it reaches now. Its `harms` may say `"on": "their-turn"`: dealt as each turn of whoever it reaches starts, in place of all at once as its holder's turn starts. `"lingers": true` leaves what it spreads on whoever it no longer reaches until their next turn starts, and the aura holds it again if it reaches them before then. The Owed's Frost Debt is `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`.

What an action puts on may carry `"heldAtMost": 2`: while its source holds that many others with it, it does not go on a third (logged as not going on), as The Owed's Grasps. A condition's `shakeOff` with `"self": true` lets its holder end it too, spending the budget with no check: the Seed Hopper, `{"budget": "action", "self": true}`, torn free by the held or an ally beside them. A creature's `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` is left at 1 hit point instead of dropping to 0, `uses` times a fight, but not against what slays outright; with `extraTurn` it takes a turn of its own straight after the one it happened in, and the order is as it was once that turn is over.

The picker shows this block as one line. Who reads the rest depends on which block your ruleset opted in with:

- With a [`combat` block](#combat-a-fight-your-own-rules-resolve), the fight reads its combat effects. `range`, `area` and `friendlyFire` apply on a battlefield with positions; `reaction` marks an entry as one that answers something rather than one taken on a turn, and names the moment it waits for (see [Windows](#windows-holding-the-fight-open)); one marked plain `true` names none and is on no menu. `check` applies to skill checks, as described above.
- With only a [`battle` block](#battles-lending-the-sheet-to-marinaras-combat), a battle reads `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` and `cost`, because those are the parts Marinara's own combat has somewhere to put.

The vocabulary is closed, so a key or a value that is not in the list above is refused instead of being quietly ignored.

`cost` is also what the Game Master's `use` command pays, outside battle, which is the next section.

### Sheet commands: permanent advancement (Capability API 1.142)

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

### Inline, or a file of its own

A small catalog sits inline in `ruleset.json`, in the header's `entries`. A long one lives in its own file and the header names it with `asset` instead. A catalog has exactly one of the two.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

The path is always `catalogs/<the catalog's id>.json`. The file itself looks like this:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Separate catalog files come in a package: one published through the official catalog, or a ruleset package file you import yourself (see [Sharing your ruleset](#sharing-your-ruleset)). The package lists the file in `contributions.assets.paths` beside `ruleset.json`, and it needs Capability API 1.21. A catalog of creatures, inline or in its own file, needs Capability API 1.27, and a catalog of items needs 1.49. **A ruleset you import as a single file, or share through a GitHub repository, carries its catalogs inline**, which means they have to fit inside the 512 KB limit on the whole ruleset file. That is room for a few hundred short entries.

The limits are 12 catalogs per ruleset, 2000 entries per catalog either way, and 2 MB for one catalog file. A package whose `ruleset.json` is over 256 KB, or with a catalog file over 1 MB, needs Capability API 1.340, which raised both limits.

### The guided builder: making a character in steps

A sheet may declare `sheet.builder` (Capability API 1.86). The sheet editor, in the character and persona editors and in a game's **Edit sheet**, then opens on a **Guided** view beside the full form (**All fields**): the steps across the top, each with a badge counting the choices it still waits on, **Back** and **Next** that never block (a player may leave choices for later), and the character as it stands beside them: what the steps wrote, the scores, the values `gm.sheetSummary` names (armor class, proficiency bonus) and the trained saves and skills.

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

Up to 24 steps, each `{ id, label, kind, ... }`; a package with more than 16 declares Capability API 1.112:

- `catalog`: entries of a catalog of rows, shown as cards with their `summary` behind **Info**. `min` (default 1) is how many the step asks for and `max` (default 1) the most it takes; with `max` 1 a new pick replaces the old one. Both may go up to 40; a package with either above 20 declares Capability API 1.110. `field` names a text or enum field the picked labels are written to (an enum field takes the entry's id or label, whichever is one of its values). `filters` fixes values of the catalog's filters, and `within: { step, filter }` offers only entries whose `filter` names an entry picked at that earlier step, as a subrace names its race; unpick the race and its subrace counts for nothing. `upTo: { filter, value }` (Capability API 1.87) offers only entries whose number `filter` is at most `value`, a value read off the sheet as it stands, such as features up to the character's level (`{ "filter": "level", "value": { "derived": "level" } }`); an entry without the filter is always offered, and a pick the sheet has since fallen below counts for nothing but is kept. A pick that changes the value read (a class that sets the level) is settled in the same change, and so is a value changed in **All fields** (a level lowered there takes back at once what a feature above it gave). `countFrom` (Capability API 1.90) is a value read off the sheet the same way that stands for both `min` and `max`: how many entries the step asks for and the most it takes, rounded down and never above `max`, such as the spells a class knows at the character's level (`{ "derived": "spells_known" }`). Picks past it are kept but count for nothing until the count rises again.
  A catalog step may also carry `stamp` (Capability API 1.108), 1 to 4 column values written onto every row it adds, such as `"stamp": { "class": "wizard" }` on the wizard's spells step and `"stamp": { "class": "cleric" }` on the cleric's. Each key must be a column in every list the catalog feeds; values are strings, numbers or booleans. The stamp replaces the catalog's initial value. Existing rows and later edits in **All fields** remain the player's. With Capability API 1.130, a stamp value may instead be an object whose `fromWithin` is `"id"`, `"label"` or a filter id declared by the parent catalog: it reads the first matching parent in pick order, writes a string or number once when the row is added, and leaves that column unstamped if no parent matches or its filter is missing or an array.

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields`: a short form of named fields. Its badge counts the ones still empty, except those listed in `optional` (a subclass chosen at a later level). `shownWhen: { "field_id": { "field": "level" } }` (Capability API 1.107) shows and counts a named field of the step only while its value reference reads above 0 on the sheet as it stands; hidden fields keep their values. `total: { "fields": ["level_bard", "level_other"], "max": 20 }` (1.107) holds at least two number fields of the step to a combined maximum (an integer from 1 to 1000), lowering each input's maximum by the others' current values without going below its own minimum, and adds one to the badge if the total is over the limit; **Next** still works.
- `abilities`: the scores (`abilities`, all of them when left out), set by any of `methods`: `pointBuy` (a `budget` no more than buying every score to the top costs, and the cost of every score from the lowest, where every score starts, up one at a time; a score typed by hand starts from the nearest score on the table), `standardArray` (one value to each score), `roll` (`count` dice of `sides`, keeping the highest `keep`, thrown by the Engine's own dice, one roll per score, then handed out like an array) and `manual`. `manual: true` keeps the existing score bounds; `manual: { min, max }` (Capability API 1.110) clamps typed base scores before grants to those integer bounds, with min at least -100, max at most 1000 and min at most max, while each ability's own bounds still hold the total. `default` (1.87) is the method a character the builder starts from a blank sheet begins on (and keeps, even if the ruleset's default later changes), so a beginner sees point buy, say, until they choose another; a described character never takes it, and its scores stay as they are until the player chooses a method after describing; **Manual entry** stays the typed edit within its bounds, and **All fields** is always there. What the picks add goes on top: the step shows base, bonus, total and modifier. One abilities step at most.
- `allocate` (Capability API 1.152): staged dots with priority allotments or group budgets, described below.
- `trained`: the skill and save choices the picks offer, and the step's own `choose: [{ "what": "skills", "count": 2, "from": [...] }]` (any of them when `from` is left out).
- `startingGear`: lists the ruleset's starting gear. Gear is taken in a game, from the inventory, as always.
- `choices` (Capability API 1.91): `catalog` names a catalog of rows, and the step is where the entries the picks grant from it are chosen (`grants.entries`, below), such as a language of your choice.

A starting-gear step may carry `"strict": true` (Capability API 1.109). In legal-only mode, the default, it offers only gear whose `fits` reads true on the sheet as it stands, without live state, plus gear without `fits`; there is no Other gear list. For 5e, put `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }` on the Wizard kit and the corresponding class-level field on each other class kit; leave `fits` off the Acolyte kit so it fits everyone. Free edit offers every kit again. The inventory picker clears a selection that stops fitting after a class change or leaving free edit and says why; it also checks the fit before taking the gear. With no fitting gear the step shows its empty state, and Next stays open. Steps without `strict` keep offering every kit. The mode is local to each screen, not recorded with a saved build or sent to the server.

What a pick gives is its entry's `grants`, read only by the builder:

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add` adds to scores; `abilities.choose` lets the player pick `count` scores (never one twice, never one in `except`) that get `amount` each. With `"repeat": true` (Capability API 1.93) one score may be picked more than once, `amount` each time, so `{ "count": 2, "amount": 1, "repeat": true }` is an ability score improvement's +2 to one score or +1 to two; the step shows a minus beside a score to take one back. Either way no score goes past its `max`. `upTo` (Capability API 1.96) caps what the choice itself may raise a score to, after what every other grant adds: `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` is the SRD's improvement, which "can't increase an ability score above 20"; the step disables a score that stands at it. The choice is shown at the abilities step, or where the entry was picked when there is none.
- `trained` trains skills and saves, and offers choices, shown at the first trained step or where the entry was picked. They are trained to the grant's `tier`, else the builder's `tier`, else the first tier above untrained the sheet offers for skills or saves. A choice never offers what the picks already train to its tier or higher, outright or through an earlier choice (Capability API 1.104): a background that trains Insight leaves a class's skill choice to the others, as the SRD asks. A choice stored before it was taken that way counts for nothing, so the step asks for another, and a choice with nothing left to offer is not shown. A choice may say `"held": "<tier>"` (Capability API 1.105): it offers only what the picks train to that tier or higher, or what a choice below its own tier holds there, as 5e's Expertise is two skills you are proficient in: `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`. `held` ranks below the tier the choice trains to.
- `sets` writes field values: a class's hit die, its spellcasting ability.
- A catalog entry may say when a builder step offers it: `offeredWhen` (Capability API 1.99) is a value read off the sheet as it stands, and the entry is offered only while it reads above 0, as 5e offers a second class only when its multiclassing prerequisites are met (a derived value per class). A pick that later reads 0 counts for nothing and is kept, as `upTo`'s are. An entry whose own pick changes what its `offeredWhen` reads (a score it raises, a field it sets, a skill it trains, a list it writes, directly or through a derived value) is refused, since it would offer itself, take itself back and offer itself again. An entry with an `exclusive` group is read on the sheet without every pick the step has stored in that group (Capability API 1.100), since picking it drops them: a feat taken in place of an ability score improvement and gated on Strength 13 is not offered on the Strength that improvement gave. A choice an entry grants (`grants.entries.choose`) holds its options to their `offeredWhen` the same way (Capability API 1.106). The catalog picker in **All fields** offers every entry, as always.
- A catalog entry may name an `exclusive` group (Capability API 1.94): a builder step keeps one pick of each group, so picking one drops the step's other pick of that group, and only the latest counts. A feat taken in place of an ability score improvement shares a group with it: `"exclusive": "fighter-asi-4"`.
- `entries` (Capability API 1.91) offers entries of another catalog of rows to choose: `{ "choose": [{ "catalog": "languages", "count": 1 }] }`, at most six choices. `filters` fixes values of that catalog's filters and `ids` lists the only entries offered (`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). They are chosen at the builder's `choices` step for that catalog (a grant naming a catalog without one is refused), only entries that write rows are offered and their rows go on the sheet, and an entry chosen for one grant is not offered to another. Their own grants are not applied.
- A pick also writes the entry's `rows`, once. An entry may carry `grants` and no `rows` at all (a class whose features come from another catalog), and a catalog whose entries all just grant needs no `feeds`; the catalog picker never offers such entries.

Unpicking takes back what a pick gave, and only that: its increases (as far as a score's bounds let them go up), its training, its field values and its rows. What the sheet already had of the player's own (a skill trained by hand, a row added from the catalog picker) stays theirs, and an edit made in **All fields** stays until the builder's own answer for that value changes. An entry picked at two steps on one catalog grants once, and one a game's layers hide still counts for what it gave. A field a pick `sets` is written only while it is still blank, or while the builder already answers for it, so a level typed in by hand is never written over; a value the builder answers for and the player changes in its own fields step stays the builder's, and goes when a later pick no longer asks for it. The player's choices are kept beside the sheet, so a step can be reopened later.

**Staged rating allocation (Capability API 1.152).** An `allocate` step buys one dot per
point, with its own budget and creation caps. It does not change the single `abilities` step's
method or saved answers. Use separate steps for attributes, Virtues and later freebies:

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

There are 1–12 groups, each with a stable `id`, `label` and 1–120 targets. Targets are distinct
within the whole step. A target names exactly one existing `{ ability }`, numeric `{ field }`,
`{ skill }`, `{ save }`, or `{ bonus }`; a bonus is the numeric `build.bonuses` entry for an
existing skill or save. Groups use exactly one budget mode: `priorities` has one nonnegative
integer allotment per group (duplicates allowed), or **every** group declares `budget: Ref`.
Priority slots are assigned explicitly, and assigning an occupied slot swaps the groups. The
array order names primary, secondary, tertiary, then numbered priorities; put larger allotments
first if those names should follow size. Budgets are at most 1,200,000 points.

`base` is optional; `min` and `max` are required. Each accepts an integer or non-live `Ref`,
such as `{ "derived": "archetype_floor" }`. Ratings must resolve to whole numbers from 0 to
10,000 and fit the target's storage bounds or tier map. The first base replaces a blank target's
default, keeping existing method scores and grants; a later base is a floor on prior stages.
Without a base the stage starts at the existing rating. Equal min/max fixes the creation score:
`base: 0, min: 0, max: 0` expresses fixed Appearance. Minimums do not buy dots automatically.
Budgets and bounds can use the existing derived operators, but cannot read targets changed by
this or a later step, even through derived values. Conditions on free grants also cannot read
ratings in an allocation group they can change, including connected groups in other stages.
Formula prices are not supported: every paid
increment costs one point. An unresolved or invalid source is shown as **not configured**.

Skill and save targets need `sheet.builder.ratingTiers`, separately for each target:

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

The array index is the numeric rating. Maps have 1–12 existing, increasing offered tier IDs,
starting at the ruleset's untrained tier; they are never inferred from tier bonuses. Different
targets may use different maps. Put targets with different creation caps in separate groups.

Catalog `grants.ratings` supplies free dots, before **all** paid stages:

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

Each grant has either a positive `add` or a nonnegative `set`, never both. All `set` grants are
floors: the highest wins, then all adds stack, stopping at the target's storage limit. Two free
rank adds therefore reach rank two, without charging the paid budget. Existing training and
field/ability grants compose before these rating grants. Entry choices still only write rows;
they never apply the chosen entry's grants recursively.

The UI shows base/prior, free, bought and total ratings, the creation range and the remaining
budget. Plus is disabled at a cap, without a budget, or while invalid purchases or manual
overrides need attention. Underspending, impossible minima and overrides get badges; Back and
Next remain available. Reassigning a priority retains the group's saved increments. An
overspent group becomes inactive as a whole; a purchase above its target's cap becomes inactive
for that target. Reduce or clear those answers to repair them, or restore the earlier allotment
to reactivate them. Later stages can exceed earlier creation caps. **All fields** remains the
free edit, with overrides shown explicitly rather than clamped to creation rules.

Saved `builder.allocations[stepId]` holds priority slot indices by group ID, paid `bought`
increments and optional `notes` by stable `kind/id` target keys (for example `ability/strength`).
`annotations: true` offers up to 1,000 characters per target for heritage explanations or
specialties; the builder does not judge that text. Applied increments are owned separately by
stage. Reopening never re-awards grants or refills resources, and describing an existing sheet
records the choices without rewriting it, including when describing ends. Unpicking recomputes
the free ratings and paid stages while preserving manual differences.

**Shared budgets and priced purchases (Capability API 1.153).** Declare up to 12 creation pools in
`sheet.builder.pools`. Several `spend` steps may use one pool; separate pools keep occupation and
personal-interest points independent. Budgets are non-live value references, including existing
`sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable`, and `listSum` calculations.
Their resolved value must be finite and between 0 and 100,000. A missing source is “not configured.”

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

Each step has up to 120 offers with stable `id` and `label`. Targets use the same exact-one
`ability`, numeric `field`, mapped `skill`/`save`, or `bonus` contract as allocation stages.
List-row purchases are reserved for the row-identity feature (F4); this API does not identify rows
by array position. Bounds must fit the target's storage bounds. Starting ratings and free grants
are preserved, never charged again: a Background with two free dots and five paid dots has seven.

A cost is exactly one of:

- `{ "flat": 1 }`: one point per rating increment.
- `{ "perRank": 5 }`: five times the next rank, so raising 2 to 3 costs 15.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`: cumulative prices at increasing ratings.
  The next purchase moves to the adjacent rating and costs the difference (5, then 7 here).
  Fractional ratings require a non-integer numeric field; tables include both offer bounds.

Optional `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]`
contains at most 12 entries. The first positive condition wins. Conditions read the sheet before
purchases; no match uses the base price. Budgets and conditions cannot read purchased targets,
including through derived values, or depend on later choices. Free grants and allocation stages
are applied before priced purchases.

Prices have positive margins except explicitly declared credits. For a flaw whose rating increases,
use `"credit": true, "cost": { "flat": -1 }`. For a reduction from a declared baseline, use
`"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`:
a purchase lowers 10 to 9 and records a one-point credit. The starting value must match the baseline.
A credit target has only one offer across the builder, preventing buy/credit cycles.

Pools default to zero credit. Set `creditLimit` to the maximum total credit and optionally add up to
12 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`. Filters name offer `tags: ["flaw"]`,
so flaw and disadvantage credits can have separate caps. Caps count gross credits, independent
of positive spending. Distinct quirk counts remain choice/row constraints.

**Counted rows and rows that match (Capability API 1.205).** A `listSum` may carry `where:
{ "column", "equals" }` to read only the rows whose cell equals a value (an empty cell reads its
column's default), and `count: true` in place of `column` to count the rows instead of adding up a
column. Genesys's talent pyramid is two derived counts and a creation rule:

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

with a rule whose `value` reads `tier2` and whose `max` reads tier 1's count less one.

**Row prices worked out per row (Capability API 1.206).** A rows step's object `cost` may scale its
`column` by `times` and add `add`, so `{ "column": "tier", "times": 5 }` prices a Genesys talent at
5 XP a tier; `add` alone is a fixed price written as an object. `overrides` (up to 4) gives a price
used instead when a derived value named by a prefix and the row's own cell reads above 0 on the
sheet: `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }`
prices an Exalted Charm at 4 Bonus Points when `affinity_<its Ability>` is above 0. An enum cell must
have a derived value for every value it can hold.

**Unpriced offers (Capability API 1.207).** A spend offer's `cost` (or an override's) may be
`{ "unpriced": true }` while the source has not supplied the price: the offer shows with a note,
holds the pool up for nothing, and is never bought. A purchase saved under a price that later
becomes unpriced goes inactive and is kept for repair.

**More fields (Capability API 1.208).** A sheet may declare up to 240 fields; before 1.208 the
ceiling is 160. Rolemaster's skill ranks, category ranks, potentials and totals need the room.

**Rolls written to an ability (Capability API 1.209).** A `roll` step's roll may name `ability`
instead of `field` (exactly one of the two). The result is held to the ability's own bounds. With
`gain`, the check is rolled against the score and only a result above it adds the gain, which the
builder then keeps as an increase: rolling or buying the score again keeps the improvement on top.
Without `gain`, the result is written like a score typed in, kept until the builder's own answer for
that score changes. A worked-out ability can't be rolled, and each ability is rolled at most once
per step.

**Worked-out list columns (Capability API 1.210).** A number column may name `sum`: up to six other
number columns of the same row, added up (an empty cell reads its column's default) and held to the
column's `min` and `max`. The cell is shown read-only, filled in on every read of a stored sheet, and
read by sums, row checks and everything else like a typed cell. A worked-out column is not rolled and
never adds up another worked-out column. A CoC specialty's rating is
`"sum": ["base", "occupation", "interest"]`.

**Partial score increases (Capability API 1.211).** A grant's `abilities.choose` may name
`partialFrom`. A score already at or above that mark when the choice comes gets a partial increase,
and two partials give `amount` once. Choices count in the order the builder makes them, after every
whole increase, so Pathfinder 2e's later boosts read `"amount": 1, "partialFrom": 4`: a +4 modifier
takes two boosts to reach +5. It combines with `upTo`.

**Row checks in a stance (Capability API 1.212).** A list's `checks[]` entry may name `stance`, one
of the dice pool's `resolution.stances`. Every row's check is then in that stance, as a skill the
stance lists is: Stewpot's pursuits count dice the STILLNESS way. The Game Master's reminder names
the rows with the stance's skills.

**Ability specialties (Capability API 1.213).** A list's `contextual` may set `"abilities": true`.
Its `skill` cell may then name an ability (by id, label or short form) as well as a skill, and the
row applies to any check rolled with that ability: a raw ability check, a skill whose own ability it
is, or a skill `with=` swaps to it. A World of Darkness attribute specialty, "Strength: lifting", is a
row named "lifting" whose skill cell reads "Strength".

**Cancelling switched off (Capability API 1.214).** A contextual `check` (on a list's `contextual`
or an entry's `mechanics.contextual`) may set `"cancel": false`. On a roll it is applied to, faces
at or below `resolution.cancel.upTo` take no successes away; a botch still reads them. The ruleset
must have a `resolution.cancel` to switch off.

**Items open without carrying them (Capability API 1.215).** A catalog entry's `grants.itemAccess`
lists up to 48 of the ruleset's items (`<catalog>/<entry>`, never a service). Picking the entry in
the guided builder opens them to the character: the sheet and the Game Master's sheet block list
them as not carried, and nothing goes in the bag. The Game Master adds one to the inventory when it
is taken, as a Blades character declares load at the start of a score.

**Row dots at creation (Capability API 1.216).** An `allocate` group may name `rows`, up to four
`{list, column}` pairs: the dots in that number column across the list's rows count against the
group's budget beside its targets. The rows are edited on the list; a group with more row dots than
its budget waits on the player. A rows step's cost override may give `times`, a per-unit rate for the
cost column, in place of a flat `cost`. Exalted's Craft rows put "dots" against the 28 Ability dots
and price "bought" dots at `times: 2`, overridden to `times: 1` where `affinity_<ability>` is set; a
worked-out rating column (1.210) adds the two.

**The best rating (Capability API 1.217).** A contextual `check` may set `"best": true`: a skill
check it is applied to rolls the character's best skill rating when that is higher than the asked
one. A `dice-highest` ruleset may use a contextual check that does only this; every other check
effect still needs a dice pool. Blades' Rook's Gambit is a special-ability row with
`"check": {"best": true}`, applied by name.

**Costs that mark a track (Capability API 1.218).** A contextual `cost` entry may be
`{"track": "<id>", "by": N}` as well as `{"pool", "amount"}`: applying the row or entry marks that
plain live track by N, as far as its bounds let it (a wound track is not marked this way). A list's
`contextual` may carry a `cost` too. Blades' Rook's Gambit is a row with `"check": {"best": true}`
and `"cost": [{"track": "stress", "by": 2}]`. Names applied by `apply=` read curly and straight
apostrophes and quotes alike.

**Borrowed catalogs (Capability API 1.220).** A catalog may borrow another installed ruleset's catalog instead of carrying its own: `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`. The lender is found by its id, bare or under a community namespace, and its entries are read against the borrowing ruleset, so an entry that names something the borrower does not declare (a condition, a threat tier, a sense) is left out and logged while the rest come through. `entries` beside `from` add to the borrowed ones, or replace one of the same id; they are checked as the ruleset is read, so the header names any `filters` they carry (a header with none takes the lender's). A borrowed creature written as a sheet uses the lender's ids; `from.sheet` says how they read in the borrower: `fields` maps a field to another id (or `null` to leave it out), `values` maps a field's values, and `tiers` maps proficiency tiers (a creature's, and those any entry grants or asks for), as in `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`. Any borrowed entry, items included, can take two more: `refs` reads a lender's derived value as one of the borrower's values (`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), and `slots` puts an item's slot under the borrower's name (`"slots": { "body": "armor" }`). A catalog cannot borrow from its own ruleset or from a catalog that borrows in turn. A borrowed creature's art is matched as the lender's (`5e-2014/creatures/<id>` in a creature pack). References into a borrowed catalog, such as a creature's spells, are checked when the catalog is read, not when the ruleset is.

**Longer advancement lists (Capability API 1.219).** `sheet.advancement.fields` takes up to 64 fields (was 24), so a game where a level raises many fields, such as slots for every spell level and proficiency lists, can let the GM raise all of them. A list over 24 fields needs 1.219.

**Two-way, owned and traded purchases (Capability API 1.164).** `"direction": "both"` lets one offer
raise and lower its rating from where it starts (its `baseline`, when declared, must match the sheet):
each step up costs the curve's price and each step down past the start earns it back as credit, held
to the pool's `creditLimit` and caps. The ledger only ever runs one way, so lowering a rating that was
bought takes the last purchase back at the price it was paid, and raising a lowered one pays its credit
back; buying and lowering never makes credit. Such a target has one offer across the builder. GURPS
ST is `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14,
"cost": { "flat": 10 } }`; a table cost prices fractional steps such as Basic Speed.
`"direction": "increase"` and `"decrease"` name a one-way offer outright (`"decrease"` is the
reduction above, with its baseline and credit).

`"effect": "ownership"` prices an offer on its own ladder, from its `baseline` (or `min`) up, and the
sheet keeps the higher of its own value and the level bought: a one-point GURPS familiarity is paid
for and listed even when a default is already better, and refunding it costs the sheet nothing.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` makes an offer a closed creation
trade: each purchase lowers `from` by `units` and raises the target by `gain` (default 1), never taking
`from` under `floor` or the target past `max`. It costs the pool nothing, so it leaves `cost` out. Traded
points are never traded on: once a trade has raised a rating, no other trade lowers it, and once one
has lowered a rating, no other trade raises it. Trades a class cannot take (`when`) may name the same
ratings the other way round. A refund puts both ratings back. OSE's prime-requisite trade is one offer per score lowered:

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

The builder stores signed paid deltas and their original prices under stable step/offer IDs, with
at most 1,000 purchase lines per offer. Refund removes the latest line and reverses exactly its
contribution and recorded price, including removing a credit. It never refunds a free rating.
No live XP, inventory, currency, or party resources are spent.

Changing career, free grants, or budget sources retains the ledger. Invalid purchases are inactive;
the pool shows its original spending, negative remaining points when overspent, and the proposed
new price. Shared targets also suspend dependent purchases in other pools. **Reprice saved purchases**
explicitly accepts a legal new price for the pool; otherwise refund lines to repair it. No purchase
is silently deleted or sold. Unspent points are informational. Back/Next stay available, and
**All fields** preserves visible manual overrides within schema bounds. Describing an existing
character and reopening saved choices never awards dots again.

**Named rows (Capability API 1.154).** A `rows` step lets the player add, edit and remove their own
rows on one of the sheet's lists while building: retainers, contacts, rituals and their ingredients,
or anything else a catalog does not list.

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns` is the subset of the list's columns the step edits (all of them when left out). `required`
names the columns a row must fill to count. The badge counts the whole rows still missing below
`min` (0 to 20), plus every row with an empty required cell, so a half-written ingredient stays
unresolved. `max` stops **Add a row** and never exceeds the list's `maxItems`. A new row starts
from the columns' own defaults, then `defaults`, which must fit each column.

The step edits the list where each row sits, so two retainers with the same name stay two rows, and
removing one keeps the other. Rows a catalog pick wrote are shown read-only with an "Added by a pick"
note and come and go with the pick. **All fields** edits every row as before.

**Conditional offers, sheet-read bounds and creation rules (Capability API 1.155).** A spend offer
may also carry:

- `when: Ref`: offered only while it reads above 0 on the sheet before purchases, such as an
  occupation's own skills or a Background a tribe may take. An offer never bought leaves the pool as
  it is; saved purchases on an offer the character can no longer take stay, inactive, for repair.
- `minFrom: Ref` and `maxFrom: Ref`: a floor and a ceiling read off the sheet, held inside `min` and
  `max`. Credit Rating takes its occupation's range; Dodge stops at DEX. A rating below the floor is
  bought up to it in one purchase.
- `allowedRatings: number[]`: the only ratings a purchase may end on, such as a Merit sold at 1, 3
  or 5 dots. Each purchase goes straight to the next allowed rating at the curve's price.

Like budgets and overrides, these may not read a purchased target. A training choice with
`onDuplicate: "replace"` may name `replacementFrom`, the skills (or saves) a duplicate may be
replaced with, in place of every one the sheet has; it holds for what is shown, saved and applied.

`sheet.builder.constraints` holds up to 40 creation rules. Each names the `step` whose badge carries
it and the `label` shown there while it fails, an optional `when: Ref`, and exactly one of:

- `value: Ref` with `min` and/or `max` (each a number or a Ref).
- `rows: { list, filter?, sum? }` with `min` and/or `max`: the count of the list's rows, or the total
  of the number column `sum`, over the rows `filter` keeps (`{ column, equals?, below?, above? }`).
- `distinct: { list, column }`: no two rows share a filled-in value (ignoring case and spaces).
- `approved: fieldId`: a boolean field that must be on, such as a Storyteller's approval.

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

A failed rule never blocks Back, Next or **All fields**.

**Worked-out scores and effects applied to one roll (Capability API 1.156).** An ability may carry
`value: Ref[]` (1 to 8): its score is those added up, held to its `min` and `max`, and shown
read-only. A Blades attribute is the sum of its marked actions; GURPS Perception is
`[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`, and skills that roll with it follow
what was bought. Derived values, caps and skills may read a worked-out score, but none may read
another, even through a derived value. The builder never sets one, and anything stored for it is
ignored.

A list may declare `contextual` so its rows apply to a roll when the Game Master names them:

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name` is the column the Game Master names a row by. `skill` (optional) holds the skill a row applies
to, by id or label; an empty cell applies to any check. `bonus` (a number column) and `dice` (a dice
column) add to the check, as dice on a pool ruleset. `to: "saves"` applies rows to saves instead.
On a pool ruleset `check: { dice?, successes?, double?, explode? }` gives every applied row the
same effect on the pool, such as a specialty whose 10s explode.

A catalog entry may carry `mechanics.contextual` with `effects` (`own-checks-advantage` and the
other check and save effects), `modifiers` to `checks` or `saves`, narrowing `skills` and `saves`,
a pool `check` effect, and `cost: [{ "pool": "...", "amount": 1 }]`, paid once on the roll it is
applied to. The Game Master writes `apply="Strong Back; Quick Eye"` (up to four names) on a check.
Only names that apply to that check change it: a row for another skill, a name two rows share, and
a cost the pool cannot cover change nothing. Owning a row never changes a roll by itself. The record
lists what applied in `from`.

**Rolled and sheet-read starting coins (Capability API 1.157).** A starting-gear coin line may carry
`roll` (dice such as `"2d6"`) or `countFrom` (a Ref read off the holder's sheet) in place of
`count`, never both, and `times` (1 to 10000) multiplies either:

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

The picker shows the dice ("5d4 gold, rolled when taken"). The roll happens once, when the group or
holder takes the package, so reopening the picker cannot roll it again. `countFrom` reads the
holder's own sheet, such as a Credit Rating field; a holder without a sheet is refused, and an
amount of 0 adds nothing. Item lines keep their fixed `count`.

**Starting values set once (Capability API 1.158).** A builder step of `kind: "initialize"` writes
starting values when the player confirms them, and never again on its own:

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

Each write names a sheet field and either a `value` (a fixed value, or a Ref for a number field) or
`remaining`, what a builder pool has left unspent. The step shows each field now and what it will be
set to; its badge waits until the player sets them. The values written are saved with the builder,
so reopening it, importing the character or changing POW later never writes them again. When the
sheet has changed since, the step shows what setting again would replace, and only the player's
**Set again** does it. A character being described as it already is is never written to.

A live pool may declare `startFrom: Ref` to start at a value read off the sheet instead of full or
empty, held to 0 and its maximum, and a plain track may declare `startFrom` in place of `default`.
Pointed at a field an initialize step wrote, SAN starts at the POW it was set from and stays where
play leaves it: a stored live value always wins over where the pool starts.

**Priced picks and rows (Capability API 1.159).** A catalog step or a rows step may name a builder
`pool` and a `cost`, so what the player picks or writes is paid out of the same pool as the spend
steps. A catalog step's cost is a number or `{ "filter": "tier" }`, the entry's own number filter. A
rows step's cost is a number or `{ "column": "cost" }`, read off each row; a negative price is a
credit, held to the pool's `creditLimit`, so a flaw funds traits. A rows step may also name `from`, a
catalog of rows that feeds its list: the player adds a copy of an entry's row as often as they like,
and each copy is their own row, priced and removed on its own:

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

A pick the pool cannot pay for is not offered. Priced picks and rows are paid first and are never
sold for the player: when taking a flaw away overspends the pool, the spend steps' purchases stop
applying until the player repairs it, and each priced step's badge counts the repair. A total a
column may not pass (Rite levels) is a creation rule (1.155) with `rows.sum` and `max`.

**Creation profiles and earlier phases (Capability API 1.160).** `sheet.builder.profiles` (up to 16)
lets a character type, career or package bring its own steps and budgets:

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

The first profile whose `when` reads above 0 is the character's, and the builder says which. A step
any profile lists is shown only while a profile that lists it is the character's; its answers are
kept while it is hidden and grant nothing. A profile's `budgets` replace those pools' own, so
switching type never keeps the other type's budget: purchases it no longer covers stop applying
until the player repairs them.

A catalog step or an initialize step may declare `reads: { "before": "step_id" }`. Its entries'
`offeredWhen` and its `upTo` (or the initialize step's values) then read the sheet as the steps
before that step make it: everything later steps picked, granted or bought is taken back, and what
the player typed in is kept. A multiclass step reads ability scores before this level's
improvement; a Humanity snapshot reads the Virtues before freebies, however the player went back and
forth between the steps.

**Rows that are checks of their own (Capability API 1.161).** A list may declare up to four `checks`,
so each row the player writes is a check the Game Master can call for by its name:

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` is the text column a row is called by and `rating` the number column that is its rating;
`ability` (optional) is added the way a skill's ability is. Science (Physics) and Science (Biology)
are two rows and two checks, each with its own rating. Two checks on one list are two stances backed
by one rating, each with a `label` the Game Master says after the row's name: "Fire stew (bold)" and
"Fire stew (careful)". The sheet's own skills, saves and abilities are matched first. A name two
rows share is no check at all until one is renamed, and a deleted row's check is gone with it. The
Game Master's sheet block lists every row check with its number, and `with=` works as on a skill.
A rows step priced by the rating column (1.159) buys the ratings out of the creation pool.

**Creation rolls kept with their dice (Capability API 1.162).** Creation dice are
`{ "count", "sides", "keep"?, "add"?, "multiplier"? }`: the highest `keep` faces, plus `add`, times
`multiplier`, so CoC's `(2d6+6) x 5` is `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`.

An abilities step's `methods.rolls` rolls every score in order, each with its own group's dice,
and never lets a roll move to another score (method `"rolls"`):

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

A step of `kind: "roll"` lists up to 12 `rolls`, each written to a number `field`: Luck, hit points,
starting money. `best` (2 or 3) rolls that many times and keeps the best; `floor` (a number or a
Ref) is the least the result may be, such as 1 hit point or a potential never below its stat;
`gain` makes it an improvement check instead, rolled against the field and adding `gain` only when
the roll is above it, as CoC's EDU improvement does. Every roll is kept with its faces and shown
with them. A roll already made stands; reopening the builder never rolls again, and only a step
with `retry: true` offers to. A character being described is never rolled for.

**Counted choices and creation constraints (Capability API 1.151).** Every step may carry `when: Ref`
(show and apply it only while the non-live sheet value is above zero) and `requiredWhen: Ref` (count
unfinished choices in its badge only while above zero). Hidden steps keep their saved answers. Next
and Back remain available even with incomplete or invalid choices; All fields remains the free edit.

Catalog steps can declare up to 12 `quotas`, each using one of the catalog's typed filters:

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

This is a Fate-style pyramid when the catalog offers each skill at each rating. Entries declare their
training grants with explicit proficiency tier IDs; numeric filter values never invent a tier mapping.
A quota has `0 <= min <= max <=` the step's maximum. Minimums affect the badge; maximums disable
further matching picks. `distinctBy` names an existing filter: picks cannot share its value (or any tag
for a tags filter), and an entry missing that filter cannot count. Otherwise distinctness is by entry ID.
`quotaBelow: { "filter": "tier" }` requires strictly more active picks at tier n−1 than at tier n for
positive integer tiers above 1. Tier 1 is the base. Removing a supporting pick makes excess higher
picks inactive, taking back their grants while retaining their answers for repair.

The `abilities.choose`, `trained.choose`, trained step `choose`, and `entries.choose` slots accept:

- `id`: a stable sheet ID. New slots should use it; saved answers then survive reordering. Old slots
  without IDs keep their positional keys. IDs are unique across all choices offered by a source step.
- `countFrom: Ref`, with an explicit `max` (1–20, at most 6 for abilities). `count` remains the fixed
  count when `countFrom` is absent. A dynamic count is floored and bounded between zero and `max`.
  It reads existing derived operators, never executable expressions.
- `excludeChoices: ["background/restricted"]`: IDs of earlier choices of the same kind, written as
  `source_step/choice_id`. These exclude the earlier choice's active answers, including replacements.
  References must be verifiable in the definition or the same catalog file. Inline earlier grant
  choices or explicit trained steps can therefore feed a later catalog file; references into another
  external catalog file are refused. Choice IDs across alternative entries of one step must also be unique.

Ability choices additionally accept `from`, intersected with the sheet's abilities and `except`.
For distinct PF2e boosts, a `restricted` choice can offer `["str", "dex"]`, followed by a `free_boost`
choice excluding `background/restricted`. Entry choices accept the same `quotas`, `distinctBy`, and
`quotaBelow` as catalog steps, bounded by `max` or `count`; they still write rows without applying the
chosen entries' own grants.

Training choices additionally accept `tier` (an offered tier above untrained, overriding the grant's
or builder's tier), `only: "any" | "trained" | "untrained"`, and `onDuplicate: "replace"`. Eligibility
reads manual training and earlier active grants, excluding the builder's own previous writes. A selected
skill already trained by those sources opens a separate replacement slot among untrained skills of the
same kind, retaining the original answer. Replacements honor the choice's exclusions and tier. Their
saved key is the original slot's key plus `/replacement`. A Human's non-career ranks can exclude an
earlier career choice and use `only: "untrained"`; changing the career retains invalid later answers.

Conditions and new slot counts may only read values changed by earlier steps, preventing self-enabling
or cyclic grants. A slot count cannot read sheet values when a later external catalog file could change
them; move its source step earlier or keep that catalog inline. A condition can use an existing derived `enumTable` to make a subrace step required
for only one ancestry. `requiredWhen` affects badges only and may read any valid non-live value.
New constrained choices remain unresolved when eligible content is missing, with a “not configured”
explanation. They never silently lower their required count to the available content. Manual sheet
edits and described characters keep the builder's existing ownership rules.

A character made without the builder (a sheet that is not blank and has no builder choices yet) opens **described**: picks record what the character already is (its race's increases are taken as already in its scores) and change nothing on the sheet, until the player chooses **Done: let picks change the sheet**. From then on, changing a pick takes back what the described one gave.

Without `tier`, training goes to the first tier above untrained the sheet offers; a sheet that offers a half tier (as 5e's skills do) sets `"tier": "proficient"`.

## Items: what a party carries

Armor, weapons, potions, gear, ammunition and money are items. An optional `items` block declares the words every item of your ruleset is written in, and a catalog with `holds: "items"` lists the items themselves. Both need Capability API 1.49; the block's `rarityCaps` and `propose`, which govern the items the Game Master invents, need 1.51, a value that reads the items a character holds (`itemStat`) needs 1.52, what an item does to checks while worn or carried, with the block's `bonus` caps, needs 1.53, what an item asks of its wearer and the abilities it changes need 1.54, a weapon's `attack` needs 1.55, what an item does in a fight needs 1.56, what a weapon shoots and holds loaded needs 1.57, a weapon's modes, off-hand attack, floor and conditions on a hit need 1.58, what using an item does in a fight, with the charges it holds, needs 1.59, a use that restores a pool needs 1.60, charges regained on a rest or an item that breaks when emptied need 1.61, a use that asks a check first (`gate`) needs 1.62, loot tables and a creature's loot need 1.63, a loot line that drops coins or a layer that takes coins out needs 1.64, a market, an item's `sold` place and a `service` need 1.65, a market day (a purse, `buyBack`, a seller's `stock`, a `limited` count, or a `sold` that names no place) needs 1.69, a rider that fires on held weapons (`weapons`) needs 1.70, starting gear (`startingGear`) needs 1.78, and a risky item, a fake or a dishonest seller needs 1.79.

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
  - A coin's `label` is its name for any number of it (`pennies`); `one` (Capability API 1.89) is its name for exactly one (`penny`), said wherever a price, a purse or a market names one coin. Without it the `label` stands for one too.
  - `perWeight` (optional, and only beside `carry`) is how many of the family's coins weigh one unit of the carry stat.
  - Coins are the party's money, carried in the bags like any item (see Money, below).
- `rarityCaps`: optional, one per rarity at most. The most an item the Game Master invents may give at that rarity: the largest value of each number stat named in `stats`, inside that stat's own range, and a whole number for a stat that takes whole numbers, and `bonus` (Capability API 1.53), the largest flat bonus one of its worn or carried modifiers may add. At a rarity with a `bonus`, a bonus in dice is left out, since dice cannot be held to a number; a penalty is never capped. An invented item is held to it; the items your catalogs list are yours and never capped.
- `propose`: `true` by default. `false` forbids the Game Master to invent items of your ruleset.
- `native`: `true` by default. `false` turns off Game Mode's own untyped items in your ruleset's games (see **What reads items**). The Game Master can still invent items, written in your ruleset's words.
- `freeform`: what an item the player types in becomes. `"plain"` (the default) keeps it as an item with no rules, as today. `"refuse"` allows only items of your ruleset.
- `lootTables` (Capability API 1.63): optional, up to 24. What a won fight's creatures and the Game Master's `[loot:]` drop (see Loot, below).

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
- `cost`: a whole `amount` of one coin, named by its `unit` id. The picker shows it, and the Game Master sees it beside the item (see Money, below).
- `sold` (Capability API 1.65): `{ "place": "city" }`, the smallest of your market's places that sells the item, over any rule that would say otherwise; with 1.69 it may instead, or as well, say how many a place keeps on hand in a day (`"limited": 2` or `"limited": "1d3"`) (see Markets, below).
- `service` (Capability API 1.65): `true` for lodging, passage, a blessing: bought like an item and never carried. Buying it only pays; nothing else puts one in a bag (an add of one is refused as `service`), and the picker leaves services out. A service has a `cost`, and nothing about carrying or using it (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds`: the item has to be bound before it does anything while worn. `restriction` (optional) says in words who may bind it, and `cursed: true` marks one that will not let go. Only a ruleset with `binding` can have items that bind.
- `worn` and `carried` (optional, Capability API 1.53): what the item does to its holder's checks and saves while it is worn, and while it is only carried, (1.54) the abilities it sets or raises, and (1.56) what it does in a fight. See [Checks outside a fight](#checks-outside-a-fight) and [Armor and worn effects in a fight](#armor-and-worn-effects-in-a-fight).
- `requires` (optional, Capability API 1.54): what the item asks of whoever wears it, and what applies while they fall short. See [Checks outside a fight](#checks-outside-a-fight).
- `attack` (optional, Capability API 1.55): what the item does as a weapon in a fight, while it is worn, (1.57) what it shoots and holds loaded, and (1.58) its other modes, an off-hand attack, a floor to its harm and the conditions it puts on a hit. See [Weapons in a fight](#weapons-in-a-fight), [Ammunition and reloading](#ammunition-and-reloading) and [Modes, a second weapon, a floor and conditions on a hit](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (optional, Capability API 1.170): a switch the item carries, `{ "label", "budget" }`. A fight offers it as an option on that budget ("Turn on Flame Tongue: Flames"), the inventory as a button with the label, and whichever way it was left stays on the stack between fights; it starts off. An item with a switch is one to a stack while it is on. A weapon's `plus` clause with `when: "toggled"` is dealt only while it is on. 5e's flame tongue: `"toggle": { "label": "Flames", "budget": "bonus" }` and `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` and `charges` (optional, Capability API 1.59): what using the item does, in a fight and outside one, and the charges it holds for that use to spend, and (1.60) a pool it restores. See [Using items in a fight](#using-items-in-a-fight) and [Using items outside a fight](#using-items-outside-a-fight).

An item carries no `mechanics`: what it does is written in its `item` block.

### What reads items

Everything above is checked when the ruleset is imported, and your catalogs of items ship with it. In a game, Game Mode's inventory reads them:

- **Your items are in the bag.** A stack can be one of your items, and stays that item whatever the player calls it. The inventory's **From the ruleset** button opens a picker of every item your catalogs list, with the catalog's search and filters, and a layer that hides an entry hides it there too.
- **Names find your items.** A name the player types, or one the Game Master writes in `[inventory: action="add"]`, that is the `label` of one of your items, in any case, adds that item. When two items share a label, the one your catalogs list first is the one a name finds.
- **`stack`** is kept: adding, setting, merging or giving past it fills the stack and starts a new one.
- **`freeform: "refuse"`** leaves the player only your items: the picker, and names that are your items.
- **`native: false`** leaves the Game Master only your items and the ones it invents: a name that is neither is refused (`not-ruleset-item`), while more of something already held can still be added, and its instructions say so. A fight no longer asks a model what the inventory's items do, so only your items fight: in a ruleset fight your held weapons and your items' uses (see Weapons in a fight, below), and in a Classic or Tactical battle your items with a `use` (see Items in Classic and Tactical battles, below). What the player types in still follows `freeform`, and what the party carried comes back in a new session either way.
- **What an item is** shows on the selected stack: its category, rarity and tags by their labels, the stats it gives, its summary and how many one stack holds. The picker also shows its `cost`. The Game Master sees each of your items it holds with its category, rarity, tags and the stats you left `promptVisible`, such as `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: an item that takes slots can be equipped by whoever carries it, while they have those slots free, and one item of a larger stack is taken into its own stack to be worn. The inventory shows each slot in use per character.
- **`binding`**: an item that `binds` can be bound, up to `binding.max` read off its bearer's own sheet (a character without a sheet reads a blank one). A `cursed` item, once bound, stays bound: the player cannot unbind it, take it off, give it away or remove it, and only the Game Master can end the curse.
- **`carry`**: an item weighs its value of `carry.stat` (an item without one weighs nothing), and a character's load is what their bag weighs, against `encumberedAbove` and `limit` read off their own sheet. An item added into the inventory's shared view, by the player or by the Game Master without a `who=`, goes to whoever can carry it without becoming encumbered (the player first, then the party in order), shared out by the room each has left when nobody can take all of it. Nothing goes past anyone's `limit`: what nobody can carry is left behind and the Game Master is told. Give a weight stat `"integer": false` for weights such as a quarter of a pound.
- **The Game Master invents items in your words.** Unless you set `propose: false`, its `[inventory: action="add"]` can describe a new item: `like=` one of your items to start from, then any of `category=`, `rarity=`, `tags=`, `stats=` (`id=value` pairs), `slots=` (`id=count`), `binds=` (`yes`, `cursed` or `no`), `worn=` and `carried=` (changes split by `;`, each `+N`, `-N`, `advantage`, `disadvantage` or `fails` for saves, on skills or saves by name, or on `checks` or `saves` for all of them, `+N` or `-N` on an ability's name to raise or lower it, and, where you have fights, `+N`, `-N`, advantage or disadvantage on attacks and `+N` or `-N` on defense or your word for it: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"`, or `none`) and `summary=`, each part by its id or label. An item stat your defense already counts (Ember Roads' Guard adds up the `guard` of what is worn) is how armor raises it, so a worn change to defense beside such a stat is left out and the answer says so: a small model writes `guard=1` and `+1 Guard` for one +1. It also reads what a small model tends to write instead: a number after the name (`Brawn +1`), "bonus" after attacks or defense (`+1 attack roll bonus`), `none` for an empty list of tags, stats or slots, and `worn=`, `carried=` or `summary=` inside `stats=` when you have no stat of that name. The Engine keeps only what your block has: an unknown category, tag, stat, slot, skill or save is left out, a rarity you do not have becomes your lowest, a number is held to its stat's range and then to `rarityCaps` for its rarity, a worn or carried bonus to its rarity's `bonus` (the part `like` started it from as well), and a name that is one of your items is simply that item. The answer tells the Game Master what was changed (never about a stat you do not show it), and the item's details show every change to the player. The game keeps the item, so the same name is that item for the rest of the game, and a new session keeps it while anyone still holds it.
- The Game Master can `equip` and `unequip` your items with its inventory command when you have `slots`, and `bind` and `unbind` them when you have `binding`: it is only told of the ones your ruleset has. It sees each character's load, bound items and slots, and what is worn or bound.

- **What an item does while worn or carried** shows on the selected stack and in the picker ("While worn: -1 on checks (Sneak)"), and the Game Master sees it beside the item (`worn: -1 on checks (Sneak)`). Checks outside a fight apply it (see Checks outside a fight, below).
- **What a weapon does** shows the same way ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), and a fight offers it while it is held (see Weapons in a fight, below).
- **What using an item does** shows the same way ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), with the charges it has left. A fight offers it, and so do the inventory's **Use** button and the Game Master's `[inventory: action="use"]` (see Using items in a fight and Using items outside a fight, below).

In a Classic or Tactical battle, each of your items with a `use` does what it says there, and one without is not offered (see Items in Classic and Tactical battles, below). Whatever `native` says, the sheet can read your items (below), a held weapon is an attack in a ruleset fight, shooting what it draws from the bag, what an item does while worn or carried counts in one (see Armor and worn effects in a fight, below), and an item with a `use` is used by its own rules, in a fight and outside one (see Using items in a fight and Using items outside a fight, below), and your `currencies` are the party's money (see Money, below).

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

### Typed defenses from conditions, levels, items and sheet rows (Capability API 1.132)

`combat.conditions[]` and `combat.levels[]` can grant `resist`, `vulnerable`, `immune`
(1–30 entries each) and `conditionImmunities` (1–40 condition ids). They apply while the
condition holds or the level's threshold is reached. A newly gained condition immunity ends
that condition if already active and prevents applying it again. Immunity wins over resistance;
resistance and vulnerability cancel. Multiple resistances never halve damage twice.

`resist` and `immune` use the creature form: a damage word or `{ "type": "bludgeoning",
"except": ["magical"] }`. Any named tag on the blow bypasses that entry. `vulnerable` stays
plain damage words. The same exception form works on items' `worn` and `carried` effects.
Declare the exception tags in `items.tags` and put them on the weapon or spell's qualities.
For example, Stoneskin is a condition mapping:

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

Armor of invulnerability uses that same `resist` array inside its `worn` effect. Protection
from Energy can grant `resist: ["fire"]`; a Brave-like trait can grant
`conditionImmunities: ["frightened"]`. A level can grant `resist: ["poison"]` at its threshold.
Unknown static damage words are reported when `combat.damageTypes` declares the vocabulary,
as for creatures; without that declaration damage words are free text.

For ancestry or catalog traits, `combat.sheetHides` holds up to eight sources (an empty array
is allowed). Each names a sheet list, one text or enum column of that list, and one of the four
kinds. For a dwarf whose traits row contains `"poison"` in a `resistance` column:

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Every row contributes comma-separated words, trimmed and matched without case; empty words
are skipped. Adding a row with `"fire"` adds fire resistance; deleting it removes that source.
Resistance and immunity words may include `except`, as in `"bludgeoning except magical silvered"`.
Vulnerabilities and condition immunities are plain words. Unknown declared damage words in
sheet text are ignored, as are unknown condition ids; an enum column for condition immunities
must declare only condition ids at import. Sheet, battle and Game Master summaries include
these defenses and their exceptions.

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
- `toHit`: what it adds to hit. `abilities` are one or more ability ids, and the best of them counts (a finesse weapon lists two). `skill` adds what a check of that skill adds, with the attack's ability in place of the skill's own, as an attack row's is. `proficiency` is a value off the holder's sheet: where it reads above 0, the ruleset's proficiency bonus is added (`{ "const": 1 }` for always). `bonus` is a number. `sheetBonus` is a number read off the holder's sheet and added as it stands, for what the holder brings to every weapon of a kind rather than what the weapon is: 5e's Archery fighting style gives `{ "derived": "archery" }` to each ranged weapon, a derived value that is 2 for an archer and 0 for anyone else (Capability API 1.95; the item's facts name it by its name on the sheet). `target` is a pool fight's own per-die target for this weapon's attack (Gravewatch's spade counts every die from 6 rather than the pool's 7), and only a `dice-pool` ruleset whose `target` can move may give one; in a summed fight its `bonus` says the same.
- `damage`: `dice` it deals, the best of its damage `abilities` added, a `bonus`, and a `type`. A summed fight needs `dice`; in a pool fight a hit deals its successes and `dice` adds that many more of the pool's own die. `sheetBonus` (Capability API 1.97) is a number off the holder's sheet added to the damage as `toHit`'s is, and with `"oneHanded": true` it counts only while the weapon is held in one hand: not a `versatile` weapon wielded two-handed, and not one that takes two of a slot. 5e's Dueling gives `{ "derived": "dueling" }`, 2 for a duelist holding one weapon. `rerollUpTo` (Capability API 1.98) is a value off the holder's sheet: the weapon's own damage dice at or below it are thrown again once and the new face stands, a critical's extra dice too, only while the weapon is wielded two-handed (a `versatile` weapon with its hands free, or one that takes two of a slot) and only in a summed fight. 5e's Great Weapon Fighting gives `{ "derived": "great_weapon_fighting" }`, 2 with the style.
- `reach` and `range` (`normal`, and `long` for what it still carries beyond) are in your `combat.distance` unit, and need one. A weapon with both is thrown, as an attack row is: a swing close, a throw beyond. With neither it reaches one cell.
- `versatile`: `dice` it deals instead while each slot it takes has room for as much again among what its holder wears: a spear in one hand with the other free.
- `strikes`: how many strikes one spend buys, off the holder's sheet, as an attack row's `strikes` is. A weapon without it is one strike a spend, however many attacks its wielder has.

Any of those numbers or words may read the item's own stat instead: `{ "stat": "damage" }` is the item's `damage`, and a stat the item gives nothing is as if the value were not written. `abilities` and `skill` read an enum stat whose words are ability or skill ids, and `type` a text or enum stat. So an item the Game Master invents `like=` a weapon is a weapon too, fighting with its own stats, held to `rarityCaps` like any stat (a value you write down is copied as it is). One invented with no slot and no binding is never worn, so it is made without the attack. A small model tends to describe a weapon and leave `like=` out, so one invented in a category of your weapons with nothing to start from fights as your weapon of that category it is most like by name (a word shared either way, so a crossbow is like a bow), or the first of them, taking any stat that attack reads which the proposal left out, and the answer says so ("It fights as Hand axe does."). The Game Master's proposal form also tells it that a weapon made like one fights like it.

A weapon's tags are what its blows carry. A creature's `resist` or `immune` entry may say what gets through it: `{ "type": "tearing", "except": ["silver"] }` is taken in full from a weapon tagged `silver`, and resisted from anything else. Gravewatch's grave wight is written that way, and its silver coffin nail gets through. Harm that is not a weapon item's names what it carries with `qualities` (Capability API 1.101), in the same item tags: on a catalog entry's `mechanics` (a spell) and on a creature action's `damage` (a deva's mace). 5e's "resistance to bludgeoning, piercing and slashing from nonmagical attacks" is `{ "type": "slashing", "except": ["magical"] }` beside the same for the other two, with `magical` on its magic weapons' tags and `"qualities": ["magical"]` on its spells and on the creature attacks the SRD calls magical.

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

  Once its holder has attacked this turn with one weapon marked `offHand`, each other such weapon they wear offers a second attack on that budget, named "Silver coffin nail, off hand" on the menu. `ability` is `full` (the default) or `penalty-only`, which adds the damage ability only when it takes something away, as 5e's two-weapon fighting does. An off-hand attack is one blow, whatever strikes the main attack buys, and never a strike at somebody walking away. A weapon marked `offHand` needs the combat block's `offHand`. `fullWhen` (Capability API 1.97) is a value off the fighter's sheet: above 0, that fighter's off hand keeps the full ability whatever `ability` says, as 5e's Two-Weapon Fighting style does.

- `floor`: the least a hit deals, written down or read off a number stat of the item. A pool fight's harm after soak, or a summed fight's damage, is raised to it before a resistance halves it, and the log says so. A spending blow throws its maker's number and is never raised.
- `onHit`: up to four of your conditions the target takes when the harm the blow dealt reached `atLeast`, for `rounds` of their own turns or, without it, until something takes it off. The harm is what reached them after soak and their resistances; a taking blow takes initiative rather than harm, so it puts none on.
  An entry may also carry `save: { "save": <save id>, "difficulty": n }`, which the target rolls as the condition would go on, a success keeping it off, and `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, which makes it last until its holder makes that save at the start or end of each of their turns or on damage above zero (it then has no `rounds`). Both count as saves against that condition, and against magic when the weapon is magical (Capability API 1.169). 5e's sword of wounding: `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus`: up to three more amounts on each hit, each `{ "dice", "flat", "type", "save", "targetIs", "when" }` and rolled, typed and resisted on its own (Capability API 1.169). `save` names its own `difficulty` and `onSuccess` (`half` or `none`). `targetIs` deals it only to a target of those creature types or tags (see Creature types and target tests). `when: "critical"` deals it only on a critical hit; any clause's dice are doubled on a critical hit as the weapon's are. A javelin of lightning is `{ "dice": "4d6", "type": "lightning" }`; a dragon slayer `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; a sword of sharpness `{ "flat": 14, "type": "slashing", "when": "critical" }`. A forecast counts a clause only against a target it reaches and never a critical-only one. `when: "toggled"` deals it only while the item's switch is on (Capability API 1.170, see `toggle` below).

The weapon's details and the Game Master's line say all of it: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` and `Marked for 2 rounds when a hit deals 2 or more`.

### Armor and worn effects in a fight

What an item does while worn or carried may also change a fight (Capability API 1.56), for its holder, alongside their conditions and levels. Each takes the parts of a condition a fight reads:

- `effects`: any of a condition's but the five a level cannot have (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), since nobody put an item on its holder and it never ends by itself: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` and the rest.
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

An item may be used in a fight (Capability API 1.59): a poultice pressed on a cut, a tonic swallowed, a bell rung. Its `use` says what using it does in the words a catalog entry's `mechanics` use (see [What a fight reads from `mechanics`](#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` or `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire`, and since Capability API 1.174 `concentration` and `zone`, with the `budget` it spends, or `free`. Ember Roads' poultice, and Gravewatch's warming tonic and dawn bell:

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

### Items in Classic and Tactical battles

A ruleset that does not resolve its own fights leaves them to Game Mode's own Classic and Tactical battles, where a model is asked what the inventory's items do when a fight begins. Your items are not guessed at: each one with a `use` does what that says, on the Engine's own numbers, and the Game Master's guess is asked only for the items that are not yours (and for none with `native: false`).

- A `heal` heals and an `attack` harms by a share of the target's maximum health, from the average of its `amount`: an average of 7, a basic weapon's `1d8+3`, is a little over a fifth of it, never less than a twentieth and at most all of it. That is the scale the combat bridge reads a catalog entry's numbers on. The `damageType` is the element.
- The first condition in `applies` goes on as a status by its own name, for its `rounds` (2 without them), and a `buff` or `debuff` is that status alone, which raises or lowers defense as the Engine's own statuses do.
- `targets` says who it is used on. Without it, a heal or a buff goes to a friend and an attack or a debuff to a foe.
- `consumes: true` takes one off the stack, and a use without it leaves the item where it is.
- A roll to hit, a save, an area, temporary points and a restored pool have no place in these battles, as with a catalog entry's `mechanics` there: the item's description on the menu still says them.
- An item that takes slots is used only while it is worn, and one that binds only while it is bound, as in a ruleset fight. One that is used up is taken from what is worn, never from a spare in the bag.
- An item whose use spends `charges` is offered while a use is left, and the Items menu counts its uses. Each use spends them from the item's stack, the player's own first, and the last one spent rolls its `breaksOn`: broken, it is gone from the bag, and the journal counts it as lost.
- An item that asks a check first (`gate`) has it rolled on the server when a party member uses it, with that member's sheet and what they wear (a companion with no card of their own rolls on a blank sheet, and only the player's own unit falls back on the player's card), as the Use button rolls it, and skipped when `unless` holds. Failed, the item is spent (or its charges are) and does nothing, and the log says so: "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- An item with no `use` is not offered in these battles, and neither is a heal without an `amount`.

The Engine works each item's effect out itself, so what the screen sends never decides what one of your items does.

### Loot

A won fight drops loot in every Game Mode game, once, into the party's bags. Without a ruleset it comes from Game Mode's own tables (more and rarer on a harder game), and so it does in a ruleset that declares no loot tables and leaves `native` on. A ruleset that declares loot tables drops its own items instead, and one with `native: false` and no tables drops nothing.

`lootTables` in the `items` block (Capability API 1.63) lists them, as Gravewatch's grave goods do:

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

- `rolls` is how many picks the table makes: a number from 0 to 20, or dice (`"1d2"`), 1 by default.
- Each pick draws one line by `weight` (1 by default) against the others. A line names one of your items as `<catalog>/<entry>`, a `filter` by `rarity`, `category` and `tag`, which picks evenly among every item that matches, or (Capability API 1.64) `coins`, one of your coins by its id. `count` is how many drop, a number or dice, 1 by default. An item or a coin a layer takes out drops nothing, and neither does a filter that finds none.
- A bestiary creature names the table it carries with `loot` (see Creatures, below). A won ruleset fight rolls the table of each creature defeated, and a fight the Engine does not resolve by your rules has no bestiary creatures, so it drops nothing.
- What drops goes into the shared view as an add does, the player's bag asked first, and what nobody can carry is left behind. The recap the Game Master gets says what dropped and that it is already in the bags, the journal says so, and a notification shows it.
- The Game Master rolls a table in the story with `[loot: table="grave_goods" who="Ada"]` (`who=` for one character's bag), measured from where the turn began like its inventory tags, so a regenerated reply drops once. Each item that drops is answered as an add, and its instructions list your tables.

### Money

Your `currencies` are the party's money. A coin is an item in the bags, a stack of each coin like any other, named by its `label`:

- It weighs one unit of your carry stat for every `perWeight` of its family's coins, counts toward its bearer's load and is placed by the carrying rule when it comes in. A family without `perWeight` weighs nothing.
- The player adds coins from the picker's **Coins** list, and splits, gives and merges them as any stack.
- A line above the inventory's stacks shows each family's coins in view and their worth in the family's smallest coin. The Game Master sees that worth beside each bag (`Coin worth 432 pennies`, or `no coins` for an empty purse, with the player's bag listed even when it holds nothing), and an item's `cost` beside the item (`costs 3 shillings`).
- The Game Master pays with `[inventory: action="pay" amount="3 shillings" who="Ada"]` and is paid with `action="earn"`. `amount` is a count and a coin, by its id or label, one of it or many, in any case (`1 penny`, `12 pennies`). A payment comes out of one bag (the player's without `who=`), in the coin's own family only: the largest coins that fit go first, then the smallest coin left that covers what is still owed is broken, and the change comes back in the family's smaller coins, largest first. The answer says what was paid and what came back: 3 shillings out of a purse holding one crown is `Paid with crowns ×1; shillings ×2 back.` A payment the bag cannot meet is refused (`cannot-afford`), and so is a coin you do not have (`unknown-coin`) and any payment in a ruleset without currencies (`no-currencies`). An earning is an add of that coin, into `who`'s bag or shared out by the carrying rule. The journal lists what was spent and earned, and a notification shows it. Its instructions list your coins, and only a ruleset with some has them.
- Buying is a payment and then an add, or, in a ruleset with a market, a `buy` (below). There is no shop screen.

### Starting gear

`items.startingGear` (Capability API 1.78) lists gear a character may take into their bag at the start: a class's kit, a background's, a calling's. It is never given on its own. The inventory shows a **Starting gear** row, and the player picks a gear, an option for each of its choices and an item from each list, then takes it into the player's bag or a party member's. Gear the character's sheet `fits` is listed first, then gear without `fits` (for any character, such as a background's); every gear is offered, because a character's concept is the player's and the Game Master's to agree.

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

- A line is one of the ruleset's items (`item`), coins (`coins`, a unit id), one item the player picks from a fixed list (`oneOf`, 2 to 48 items), or a plain item by name (`name`, where `freeform` allows plain items; held to the rules of a label, so no brackets, `{{` or line breaks). `count` is 1 to 999; `equip: true` puts an item on as it is taken, where its slots are free, so armor counts from the start.
- `choices` are 0 to 8, each with 2 to 6 options of their own lines.
- `group`: the gear a character takes once of each group (a class's and a background's). Taking the same group again is a choice the player makes in the dialog, and adds to what is already in the bag. Gear with no group is its own group, never the same as a group of the same name.
- `fits` reads the sheet without its live state, as carrying does. It only orders the list.
- Taking is all or nothing: gear too heavy for its bearer is refused whole, and the dialog says what it weighs against what they can still carry. An item a layer takes out of the game is left out and named, and so is a list all of whose items it takes out; coins of a coin a layer takes out are paid in the largest coin left of the same worth, and the dialog shows them that way. Gear of which nothing is left is refused, so it is never marked as taken for nothing. A service is never offered from a list.
- The import checks every item (in an inline catalog; a catalog in its own file is checked when the gear is taken), coin, plain item and `fits` reference, refuses a service, and refuses a count that would need more stacks than a bag takes at once.

### Markets

A `market` in the `items` block (Capability API 1.65) says what a place sells and at what price, instead of every shop selling everything at its list price. Gravewatch's, a little shortened:

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

- `prices`: one to eight levels, each a multiplier (`times`, above 0) on an item's `cost`, and one of them the `default`. A price is the cost in its family's smallest coin times the level, rounded there (never below one coin for something that costs anything), and said in the coin its cost is written in where that coin pays it exactly, else in the largest coin your layers leave that does: at `dear`, a coat that costs 8 shillings is 12 shillings, and a 5e potion that costs 50 gp is 50 gold pieces, never 5 platinum. Haggling or a seller's mood moves the level, never the number.
- `places`: one to twelve place sizes, smallest first, in your own words.
- `sold`: rules for the smallest place that sells what a filter picks. A filter names a `rarity`, a `category` and a `tag`, any of them, and matches an item that has every one it names; the first rule that matches an item decides. An item's own `sold` wins over the rules, and an item nothing names is sold anywhere.
- `sellers`: kinds of seller, each with what it `sells` (filters, any of which picks an item), the smallest `place` that has one (anywhere, without it), and optionally who it sells `only` to: a value off the buyer's sheet, with their live state and what they carry, at least `atLeast`, said to the Game Master as `label`. Without `sellers`, anybody at a place sells whatever that place sells.
- An item with no `cost` is not for sale, and neither is one a layer hides or one whose coins a layer took out.

**Where the party is.** The Game Master says which place a scene is in and its size with `[place: name="Millbrook" size="market town"]`, the size by its id or label, and leaves the size out for somewhere with no market (a road, the wilds). The Engine answers each tag in place, refusing a size you do not have, and the last place it answered in its own replies the player sees, from the latest conversation start, is the place in force until another is said. A place tag a player types never counts. A regenerated reply reads only what came before the telling it replaces.

**Buying.** The Game Master buys with `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, `level` (the default without it) and `seller` (any seller here that sells the item, without it) optional. The Engine prices it at the place in force when the reply ends, takes the price out of the buyer's purse (the player's without `who=`) as a payment is, with change, and puts the item in their bag, or only pays for a service. Either both happen or neither does. The answer says what it cost (`price="12 shillings"`) and what was paid and given back, and a notification shows it. A buy is refused, and changes nothing, with no place said (`no-place`), a level, item or seller you do not have (`unknown-level`, `unknown-item`), no price (`not-for-sale`), a place too small for the item (`not-here`), no seller here who sells it (`no-seller`), a seller whose `only` the buyer does not meet (`not-to-you`), a purse that cannot meet it (`cannot-afford`), or a bag that cannot carry it.

**What the Game Master sees.** While a scene is at a place with a market, a MARKET block names the place and its size, the price levels, and each seller there with a dozen of what they sell at the default level, cheapest first; anything they sell can be bought by name. Its instructions teach `[place:]` and `buy`, and only a ruleset with a market has them.

#### A market day

A market day (Capability API 1.69) makes a place's shelves change and run out, and lets the party sell back. Gravewatch's, a little shortened:

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

- **The day.** A day at a place lasts until the Game Master names another place; it starts a new day at the same place by saying it again with `day="new"` (`[place: name="Millbrook" size="market town" day="new"]`). Everything below is worked out per day from the Game Master's replies the player sees, so a swipe, a regenerated reply or a branch needs nothing stored, and a day always rolls the same shelf.
- **`limited`** on a `sold` rule or an item's own `sold`: how many a place keeps on hand in a day, a number or dice rolled for the day. A rule may name a limit without a place (sold anywhere, a few at a time); an item's place comes from the first rule that names a place, and its limit from the first that names a limit. Once they are bought, a buy is refused (`sold-out`) until a new day.
- **`stock`** on a seller: one of your loot tables, rolled once a day for what that seller has in stock on top of what they sell. What it rolls (items only, never coins) is sold by that seller alone, as many as it rolled, whatever `sells` and `sold` say; a seller's `only` still applies.
- **`buyBack`**: the share (above 0, at most 1) of an item's default price a seller pays for it. A seller here who sells that kind of thing buys it (anybody, without sellers). Without `buyBack`, nobody buys anything back.
- **`purse`** on a place size: the most its sellers pay out in a day, all together, in one of your coins. Sales paid in that coin's family count against it; without a purse, they buy without limit.
- **Selling.** The Game Master sells with `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. The Engine prices it, takes it out of the seller's bag (the player's without `who=`; never a bound cursed item) and pays its coins in, largest first, or refuses and changes nothing: no place said, nobody here buys it (`not-bought`), no price (`not-for-sale`), today's purse spent (`purse-spent`), none held, or coins the bag cannot carry. The answer says what it fetched (`price="4 shillings"`), the journal lists it as sold, and a notification shows it.
- The MARKET block adds what each seller has in stock today, how many are left of a limited item, and what the sellers here pay and how much of today's purse is left; its instructions teach `sell` and `day="new"`.

#### Honest and dishonest sellers

Capability API 1.79 lets an item be risky or a fake, and a seller be dishonest.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** on an item: what an honest seller warns of before selling it. The MARKET block lists it with "(warn the buyer first: ...)" beside an honest seller's ware; a dishonest seller says nothing.
- **`passesFor`** on an item makes it a fake of another item (`<catalog>/<entry>`): a real, sellable item of the same category, worn in the same slots, that binds if the fake binds. It is checked at import where both are readable, at install for every catalog file, and again when a market offers it, so a fake whose target is missing or hidden by a layer is never sold. A cursed item (`binds.cursed`) or a fake is never among anybody's wares, and never in an honest seller's stock.
- **`honest: false`** on a seller: a fake their `stock` table rolls is offered as the item it passes for, at that item's price, and the MARKET block shows the Game Master the truth beside it. A buy that names that seller and that item gets the fake; a buy that names no seller never does.
- **A fake in the bag** shows as the item it passes for everywhere the player looks (the bag, the journal, notifications, fights), and keeps what it truly is. The Game Master's inventory block marks it `[FAKE: really ...]` and asks it to keep calling it by the name it is shown by.
- **Found out**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, binding it (attuning shows a curse), using it (what it truly does happens; when that is nothing the rules work out, the Game Master tells it), or selling it to an honest buyer, who says what it truly is and pays what that is worth (its own `cost`), or refuses where it has none. A dishonest buyer takes a fake as what it seems. From then on it is its true item.
- **Worn or carried**: a fake does what it truly does on the character's sheet (its `worn` or `carried` effects and its stats). The first inventory change after which the sheet shows a number, or what a check adds, that the item it passes for would not, finds it out, and the journal and the screen say what it was. A difference only a fight reads (a resistance) does not, and neither does a change to the sheet alone until the next inventory change. In a fight, a worn fake weapon still attacks as the weapon it passes for.
- Under single-player trust, Peek Prompt shows the Game Master's view, truth included.

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
  dice. `criticalFrom` widens the critical face: a value read off the attacker's sheet that is the
  lowest natural face counting as a critical, such as `{ "field": "critical_from" }` for a 5e Champion
  whose sheet says 19. It is held to the die's highest face, a value under 2 means no range at all (the highest face only, as for a character whose field is left at 0), and it needs a single die
  with `naturals.max` set to `critical`. Capability API 1.81.
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
  With Capability API 1.108, `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` selects references by a row's class. A cleric 3 / wizard 2 can derive the cleric's attack from proficiency plus Wisdom and DC from 8 plus that attack, and the wizard's from Intelligence instead. The column must exist in the source's list, and `values` holds 1 to 20 entries. Each entry may replace either reference; an omitted reference, an absent column value or an unlisted value keeps the source's own reference. Combat, the sheet's row summary and the Game Master's summary read the same per-row numbers. Both `stamp` and `byColumn` require schemaVersion 2 and capabilityApi 1.108 or newer.
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
  `cannot-target-source`, `cannot-target-source-side` (1.278) and `cannot-approach-source`.
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
  - Senses (Capability API 1.127): a condition's `lacks` names senses its holder does not have,
    and a catalog entry's `mechanics.needs` or a creature action's `needs` names senses a target
    must have for it to work on them. For 5e Deafened, write `"lacks": ["hearing"]`; for Command,
    write `"needs": ["hearing"]` in its mechanics. A deafened target is left off Command's target
    menu. An area or multi-target effect needing hearing skips that target entirely: no save,
    damage or conditions. Once Deafened ends, the target is legal again. Each list has one to four
    unique sense ids, in the ruleset's own words; the Engine knows no sense names.
  - Usable only while the sheet allows (Capability API 1.166): a catalog entry's
    `mechanics.usableWhen` is `{ "value": <value reference>, "atLeast": n, "atMost": n }` (one
    bound or both). In a fight the entry is offered, on its holder's turn or in a reaction window,
    only while the value read off its holder's sheet, live state and items stands within the
    bounds; it is read each time the menu is drawn. 5e's Protection needs a shield in hand:
    `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`.
    Rage's "no heavy armor" is the same with `"atMost": 0` on the heavy armor count. A creature written as a stat block has no sheet,
    so nothing holds it back.
  - Conditions applied only while the applier's sheet allows (Capability API 1.167): an `applies`
    entry on a catalog entry's mechanics or an item's use may carry `"when"`, the same shape as
    `usableWhen`. It is read off the sheet, live state and items of whoever applies it, at the
    moment it would go on, and an entry outside its bounds is skipped; the others still apply. 5e's
    Rage applies `raging` and one of three damage conditions within the four-entry limit:
    `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`,
    then `raging_damage_3` with `"atLeast": 9, "atMost": 15` and `raging_damage_4` with
    `"atLeast": 16`. An applier without a sheet applies every entry. A creature's stat block and a
    condition's `onEnd` have no applier's sheet to read, so `when` is refused there. Requires
    schemaVersion 2 and capabilityApi 1.167 or newer.
  - Creature types and target tests (Capability API 1.168): `combat.creatureTypes` lists what a
    combatant can be, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`. A creature names its
    own `type` and `tags`; a character's type is the value of the text or choice field `field` when
    that is one of the types, otherwise `default` (5e characters are humanoids). A target test is
    `{ "types": [...], "tags": [...] }` and passes for any one match; a combatant with no type and
    no tags never matches. It goes in three places:
    a damage clause's `targetIs` deals that clause only to a target that matches (a dragon slayer:
    `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, holy
    water: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`);
    an `applies` entry's `targetIs` puts that condition only on a target that matches; and
    `mechanics.targetTypes: { "is": test, "not": test }` says who may be picked or caught at all
    (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`).
    An area passes over whoever `targetTypes` leaves out. A forecast counts a `targetIs` clause only
    against a target it would reach; the sheet's plain average leaves it out. The battle panel and
    the Game Master see each combatant's type and tags. Requires schemaVersion 2 and
    capabilityApi 1.168 or newer.
  - Condition endings (Capability API 1.125): Charm Person uses
    `"endsWhen": ["harmed-by-source-side"]`. Damage above zero from whoever applied it or anyone on
    their side, or their targeting its holder with an attack, save or harmful condition, ends it
    after the harmful action resolves in full, even if the attack misses or the save succeeds.
    `"saveWhenDamaged": true` repeats a turn save on damage: each amount of damage above zero
    repeats the applying action's `saveEnds` at its stored DC; success ends it. Without a stored save
    or DC, nothing is rolled. Hypnotic Pattern uses `"endsWhen": ["damaged"]` and
    `"shakeOff": { "budget": "action" }`: any damage above zero ends it immediately, or another
    combatant on the holder's side can spend that budget on their own turn to end it. `shakeOff.reach`
    is in the ruleset's distance unit and defaults to one cell; without a board no distance is
    measured. The economy must declare its budget. `endsWhen` has one or two unique entries.
    These keys leave source-down and concentration endings unchanged.
    For a save only on damage above zero, never at turn start or end, use `saveEnds.at: "damaged"`
    (Capability API 1.129): Dominate Person's applies is
    `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`,
    which rolls once per blow at the applying action's stored DC without needing `saveWhenDamaged`.
  - The action economy (Capability API 1.76), as Haste and Slow change it:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` gives its holder that many more (or fewer) of a
      turn budget each turn, never below none. Only a budget that refills `per` turn can be changed
      this way. A budget may be declared with `"count": 0` for one only a condition fills, and the
      screen shows it only while somebody has some. An invented opponent never spends one.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }` says what that budget may be spent on: the standard actions named (from the
      ruleset's own `standard` list, never on the first budget, where every standard action already
      is), one weapon attack of a single strike (whatever strikes an action would otherwise put in
      hand; for a creature, an attack of its stat block at one target, never a multiattack), and an
      item's use: `true` for any item, or `{ "tags": ["mundane"] }` for only an item with one of
      those item tags (5e's Use an Object is a mundane item's, never a magic item's activation).
      They are offered once the budget they would usually spend is gone, and only on the holder's
      own turn: a grant never pays for a reaction.
    - `exclusive`: `["action", "bonus"]`, two budgets of which a turn spends only one: spending
      either empties the other.
    - `attacksPerTurn`: how many attacks (actions that roll to hit, each attacking part of a
      sequence, and a contest that takes the place of a strike, such as a grapple) its holder makes
      on its own turn, whatever an action would give. A reaction on somebody else's turn is neither
      capped nor counted.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, what it
      leaves behind when it ends for good (it runs out, a save or damage ends it, concentration
      breaks), never when it is put on again. It lasts some `rounds` (never `"until-save"` or
      `"instant"`). Left behind in the middle of its holder's own turn, its rounds start with the
      next turn, so one round is the whole next turn.
  - When a fight ends, however it ends, every condition it put on with a clock, an `endsAfter` or a
    concentration comes off the sheet without leaving anything behind, and concentration ends. A
    condition with no clock (a fall's prone) stays.

  `own-saves-advantage` and its opposite roll the save twice and keep one, exactly as an attack is
  rolled, and they cancel each other out. `own-checks-advantage` and its opposite do the same to the
  holder's side of a contest, which is where a fight makes its ability checks, and to their checks
  outside a fight. `resist-all` halves every kind of harm on top of whatever
  the target's own hide said, and cancels against a vulnerability the same way.
  `cannot-target-source` keeps the holder from pointing anything at whoever put it on them
  (`cannot-target-source-side`, 1.278: or at anybody on their side, unless it is the holder's own), and
  `cannot-approach-source` keeps them from walking any nearer to that somebody than the cell they
  stand in, the route included: a way round to a cell just as far off is still offered, and one
  that would dip past them and come out the other side is not.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Damage a condition changes (Capability API 1.133).** `damage` changes what its holder deals;
  `damage-taken` changes what its holder takes. Both accept `flat`, `dice` (and `minus`), or
  `times: 0.5 | 2`. Additions happen once per attack hit, even when the hit has several damage
  clauses; criticals double the added dice as the ruleset doubles its other dice. Saves and
  automatic hits get none. `times` changes the whole hit after additions and before resistance,
  rounding the total down once across its clauses. Added amounts meet resistance by their own
  `damageType`, or the hit's type when omitted. Same-type additions join that amount before resistance.

  `attacks` is `weapon`, `spell` or `any` (the default). Attack-list rows and equipped item attacks
  are weapons, as are single-target stat-block attack rolls; catalog abilities (including creature
  spellcasting) and item uses are spell/other attacks. `blow: "melee" | "ranged"` follows 1.118,
  so a thrown weapon in reach is melee. `ability` names the ability actually chosen for the attack
  roll: a row's ability, or the first best ability offered by an item (including finesse). Plain
  stat-block actions have none and never match an ability restriction. These keys and `damageType`
  are refused on other modifier targets. `fromSource: true` is only for `damage-taken`: the hit must
  come from whoever applied the tracked condition. An untracked condition, level or item has no
  applying source and cannot match it.

  In 5e, declare these condition ids on the sheet, then put these entries in `combat.conditions`:

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor and Rage go on their caster; Ray of Enfeeblement and Hunter's Mark go on their
  target. Hex uses the mark's `damage-taken` entry with `attacks: "any"` and `damageType: "necrotic"`.
  Levels and items' `worn`, `carried` and requirement `otherwise` effects share these modifiers.
  The attack menu counts only the holder's own additions and multipliers; a target's mark is never
  promised there. Sheet and prompt summaries describe the holder's own damage modifiers, and the
  battle view also describes incoming ones. Packages using either target require schemaVersion 2
  and capabilityApi 1.133 or newer, including when the item lives in a separate catalog file.

  **Numbers a condition changes.** Each entry in `modifiers` names what it changes, `to`, and by how
  much:
  - `defense`: the number an attack against the holder has to reach. A flat number only.
  - `attacks`, `saves`, `checks`: the holder's own attack rolls, saves and contest checks. A flat
    number, or `dice` rolled every time the roll is made (`"1d4"`); `minus: true` takes the dice
    away instead of adding them.
  - `speed`: how far the holder walks, in your own distance unit (`flat`), or `times` 0.5 or 2 for
    half or double, applied after every flat change. Read only on a board, as `speed-zero` is.
  - `health-max`: `times` 0.5 and nothing else halves the holder's health maximum, rounded down and
    never below 1 (Capability API 1.115). A health track of boxes has no maximum to halve. Health
    above the halved maximum is lost as the fight begins, and healing never goes past it.

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
  reads goes down, so `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`,
  `cannot-target-source-side` and `cannot-approach-source` are refused on one. Only a combatant with a sheet has tracks. The log names
  a level by its track and number ("- 1 (Heat 3)").

  In place of `track`, a level may read a `derived` value (Capability API 1.54), worked out with the
  character's live state and items, so nobody has to tick anything: Ember Roads slows anybody carrying
  10 bulk or more.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  A threshold that differs from one character to the next ("more than five times Strength") is a
  derived value that subtracts it: `scale` by -1 gives the part to take away, and a `sum` of the two is
  what the level reads.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` takes the holder out of the fight for good as it begins, before anybody moves
  (Capability API 1.115). It and a halved maximum's lost health are settled once, as the fight
  begins; every other level is read whenever the number it changes is.

  Opponents carry tracks too (Capability API 1.115). One without a sheet starts at the `tracks` it is
  given, by your track ids: a creature the Game Master proposes may name them
  (`"tracks": { "exhaustion": 2 }`), and so may a bestiary opponent put into a fight. A creature's
  `conditionImmunities` may name a track a level reads, and then none of that track's levels touch
  it, on a sheet or not: 5e's undead and constructs, immune to exhaustion.

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

### Saves against conditions, damage or magic (Capability API 1.134)

A modifier with `to: "saves"` may carry `against`. It needs at least one of
`conditions` (sheet condition ids), `damage` (damage types), or `magic: true`.
Any one match is enough; `saves` still narrows which save as an AND. Use the
modifier's `mode: "advantage"`, not `effects`, to narrow advantage this way.
These modifiers work on conditions, reached track or derived levels, and item effects.
For race features, derive a value from the sheet's race pick and attach the modifier
to a level reached when that value is 1. Example modifiers:

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave uses `conditions: ["frightened"]`. Magic Resistance uses `magic: true`
without `saves`, on a creature's sheet-derived level or track level.
An action's `applies` counts even if the save prevents the condition; its damage
includes every `plus` clause. Damage names match without case. Magic means the
1.101 `"magical"` quality: catalog `mechanics.qualities` (even without damage),
a creature action's `damage.qualities`, or a weapon item's tags. A spell must
carry that quality; its name or catalog alone does not make it magical.
A save to end a condition, including `saveWhenDamaged` and `saveEnds.at: "damaged"`,
is against that condition only. Concentration and death saves are against nothing.
Outside combat, Game Master save requests carry no structured source or condition;
`against` never matches those requests. The sheet, item details, battle details and
Game Master sheet summary show these restrictions. Requires schemaVersion 2 and
capabilityApi 1.134 or newer.

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
  to `defense`, and cover (`cover.bonus`, or `cover.threeQuarters`), add to it.
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

### Minimum damage dice (Capability API 1.146)

A pool fight can keep dice even against heavy soak, as Exalted's **Overwhelming** does:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

This is `combat.damage.minimum`, a value reference read from the **attacker's** current sheet.
After static soak takes dice off the first damage pool of a hit, the pool is raised to at least
this number. It is whole dice, rounded down and bounded by zero and `resolution.pool.max`, not
automatic successes: every surviving die may fail. Rolled soak still takes successes off after
the damage throw; it does not reduce a dice pool, so the minimum does not protect successes from
it. Resistance and immunity still apply. Initiative-spending blows ignore the minimum, just as
they ignore weapon damage and soak; initiative-taking blows use it.

A weapon may override the common minimum with `item.attack.damage.minimum`. It accepts the same
value references on its holder, or `{ "stat": "overwhelming" }` for one of the item's own numeric
stats. A declared zero overrides the common minimum too. This differs from the existing weapon
`floor`, which guarantees an amount of damage after soak. Extra damage clauses and riders do not
receive another minimum. The fight record and log show the resolved minimum beside the dice.
Both the combat key and the weapon key require **Capability API 1.146** in a package, including
weapons in external catalog files.

### A hit that dazes (Capability API 1.147)

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` is for pool fights. `over` reads the **target's** current sheet, immediately before
the hit. One hit must deal **strictly more** damage than that number, after soak, saves and
resistance. Its damage clauses count together; separate hits never accumulate towards daze.
On a track that marks per blow, a damaging hit counts as one level. A blow that takes initiative
rather than health cannot daze. `measure` is currently only `"damage"`.

The target skips exactly their next turn. Further dazing hits before that turn do not stack extra
skips. The skipped turn still advances condition clocks and other turn bookkeeping, including
round changes and rerolled initiative. A save/reload of the fight preserves the pending skip.
`condition`, when present, names a declared sheet condition. The fight marks it until the skipped
turn passes, or the fight ends. A condition already present is left in place; condition immunity
prevents the mark but does not prevent the skip. `text` is optional narration, not another effect.
The log and the Game Master's fight context record the hit and the skip. The key requires
**Capability API 1.147**.

### The target chooses the wound kind (Capability API 1.148)

Add `remap` to the existing `combat.damageKinds` mapping; keep its `default`, `byType` and `marks`:

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

A pool fight first chooses the attack's kind using its ordinary mapping, then reads each remap's
`when` on the **target**. A nonzero number enables the rule. `from` and `to` must both be kinds on
the health wound track. The first matching rule wins; remaps do not chain. At most 12 may be given.
With `tags`, at least one must match the attack: a weapon already carries `item.tags`, and catalog
mechanics and creature damage already carry `qualities`. These names come from `items.tags`.
Without `tags`, any attack of that kind may match. No new attack-tag field is needed.

The resulting kind decides both **soak** and the wound marks. Thus a firearm's lethal hit can become
bashing against a vampire and use bashing soak; the same firearm against someone else, or a blade
against that vampire, keeps its ordinary kind. The attack's original damage _type_ is unchanged
for resistance and immunity. Each damage clause uses its own kind and the attack's tags. The fight
record and log show the original and remapped kinds, and the damage forecast reads the same rule.
A plain creature without a sheet can satisfy a constant reference, but cannot supply sheet values
for these rules; give it a creature sheet for that. Only the new `remap` key requires **Capability
API 1.148**; older damage-kind mappings keep their existing compatibility.

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
begins, which is how "until the start of your next turn" is said. `"of": "source"` (Capability API
1.119) counts the turns of whoever put it on instead, starting with their next one, which is how
"until the end of your next turn" is said of somebody else. Guiding Bolt's
`{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` gives advantage to the
next attack roll against its target before the end of the caster's next turn. If the source leaves
the fight, the rounds count on the holder's own turns. A combat condition's `delays` (Capability API
1.120) holds over what its holder uses: an action out of one of its `catalogs`, paid with its
`budget`, rolls a die of `chance.sides`, and at `chance.atLeast` or more it does not happen yet. As
the holder's next turn begins it is completed with that same budget and goes on as it would have,
answers and all, and if they cannot act or have none of that budget it is lost. What it cost stays
spent either way. 5e's Slow is
`"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`.
`endsAfter` takes the condition off
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
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
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
naming neither means any hit its holder lands. A weapon held from the bag is no row, so `weapons`
(Capability API 1.70) names the item tags it fires on as well: `"weapons": { "tags": ["finesse",
"ranged"] }` fires on a hit with a held weapon carrying either tag, its off-hand strike included.
Naming only `weapons` fires on no row, and naming only rows fires on no held weapon. `when` is ANY-of: `advantage` is how the attack roll
finally leaned, and `ally-adjacent` is a standing ally of the attacker who can act, within one cell
of the target on a board and anywhere at all without one. `ally-adjacent-no-disadvantage` (Capability
API 1.126) also requires the final roll not to be at disadvantage after advantage and disadvantage
cancel; the example above uses it for Sneak Attack. `oncePer` is `turn` (fresh at the start of every
turn there is, so a strike made while somebody else acts can still carry one) or `round`.
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
- `speeds` and `hover`: how it moves besides walking (see Other ways of moving, under Positions).
  Capability API 1.113.
- `shield: true`: its hands are full, so an action's `twoHanded` alternative does not hold.
  Capability API 1.102.
- `size`: one of `combat.sizes`, by id, which a contest's `maxSizeAbove` reads (see Sizes and
  escape DCs). Capability API 1.103.
- `type` and `tags`: one of `combat.creatureTypes.types` and up to eight of its `tags`, by id, which
  target tests read (see Creature types and target tests). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: damage types, matched without case, and checked against
  `combat.damageTypes` when you declare any. A `resist` or `immune` entry may also say what gets
  through it, `{ "type": "tearing", "except": ["silver"] }`: a blow from a weapon item carrying one
  of those item tags is taken as it comes (Capability API 1.55, see
  [Weapons in a fight](#weapons-in-a-fight)), and so is an action whose `damage.qualities` or a catalog
  entry whose `mechanics.qualities` names one (Capability API 1.101). `conditionImmunities` names your
  own conditions, or a track your `combat.levels` read (Capability API 1.115).
- `tier`: which rung of `combat.threat` it belongs to.
- `loot` (Capability API 1.63): the id of the loot table a won fight rolls for it (see Loot, above).
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
  - `damage.alternatives` (Capability API 1.102): up to four amounts it deals in place of its first,
    each `{ "when": ..., "dice": "1d10", "flat": 3 }`, the first that holds winning. The type, the
    clauses and the qualities stay the action's own. `"when": "twoHanded"` holds unless the creature
    has `"shield": true`, which is 5e's "or 8 (1d10 + 3) slashing damage if used with two hands";
    `"when": { "selfHealthAtMost": 0.5 }` holds while its health is at most that share of its most,
    which is a swarm's "or 5 (2d4) piercing damage if the swarm has half of its hit points or
    fewer". The menu's forecast and the blow both read it as it stands.
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

A creature action can give hit points back with `heal` (dice, a flat amount, or both), capped at
its target's maximum. `targets: "ally"` reaches its own side, including itself; `targets: "any"`
reaches either side. Without `targets`, it reaches the other side as before. These keys need
Capability API 1.121. A heal carries no `damage`, `toHit`, `save` or `area`; `targets` takes no
`self` or `sequence`, and a sequence carries neither key. A deva's Healing Touch is:

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

A creature's `spellcasting` (Capability API 1.123) casts catalog spells without spending slots or
points. Its `saveDifficulty` and `toHit` supply the spell's numbers; a creature with a `sheet` may
omit them to use its sheet's spellcasting numbers. A plain creature must supply any number its
spells need. Each `entry` names an existing catalog entry with `mechanics`. Omitted `uses` means at
will; `level` is the casting level for `perCostStep` scaling, or the entry's base when omitted. The
entry still supplies its budget, targets, concentration, reactions, areas and summons. A dryad's
list could be written as follows; these spell ids are illustrative and must be supplied in a
`spells` catalog:

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

For a hag coven, add `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` beside `spells`
and `"coven": true` on each shared spell. Those spells are offered only while at least three
standing combatants on the caster's side carry that coven id, each within 30 ruleset distance
units of the caster by plain cell distance. Without a board, all standing members count. Each
spell's uses are one pool shared across that coven, keyed by coven id and entry. A coven block
needs a coven spell and a coven spell needs the block; duplicate entries are refused. A Game
Master's proposed creature loses `spellcasting` when clamped, because a threat scale cannot bound
a spell list.

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
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
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

**Other ways of moving** (Capability API 1.113). A creature's `speeds` gives what it moves besides
walking, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` in your unit, and `"hover": true`
says a flier needs no motion to stay up (it needs a `fly` speed). A party member's come off the
sheet through `economy.movementModes`, value references keyed the same way, as a race's swim speed
or a spell's fly speed would be; a nought is not moving that way. `speed` and `economy.movement`
stay the walk. On a board:

- the allowance is the fastest way they move, and every cell moved comes off every way at once, so
  a creature that walks 30 and flies 60 can walk 10 and then fly 40, and never walk past 30;
- a flier steps anywhere not solid for one cell, water and a step of any height included;
- a swimmer crosses water for one cell, and walks on land;
- a climber takes a step of any height for what the ground it steps onto costs;
- a burrower's speed is carried for the Game Master and moves as a walk, since a board has no
  ground to tunnel through.

Each step is taken the cheapest way that has enough left. A fight without a board reads nothing of
it, and somebody who only walks moves exactly as before.

**Flying height** (Capability API 1.114). On a board whose ruleset gives `combat.elevation.levelHeight`
and `combat.distance.perCell`, a flier is offered Fly up and Fly down where it stands, each costing a
level's worth of its flight (a 5 foot level on 5 foot cells is one cell). Up to 20 levels above the
ground it is over. While it is up:

- it only flies, a cell a step over anything not solid;
- the distance between it and anybody else is the larger of the flat distance and the height
  between them, so a sword with 5 feet of reach cannot touch a dragon 30 feet up, and its own bite
  cannot touch the knight either;
- it has the high ground over anybody lower, as a hill would give it;
- leaving the reach of somebody it is too high for draws no strike;
- knocked down, knocked prone or held to a speed of nought, it falls to the ground below as
  `falling` says, unless it has `hover`.

Flying onto ground as high as it is, or higher, lands it, as a flier on the ground flies onto a
cliff. No new key: an Engine before 1.114 keeps
fliers on the ground, so a package that relies on height declares 1.114.

**In the air** (Capability API 1.354). On any board, whether a flier is in the air is its own: a flier
with no walk, or with `hover`, starts in the air; one on the ground takes off with the free Take off
move, by flying up, or by a step only its flight takes (over water, or where flying is cheaper than
walking), and comes down with the free Land move (only one with a walk) or when it is knocked prone,
knocked down or held to a speed of nought, unless it hovers. Fly down to the ground keeps it in the
air at the ground's height until it lands. Its creature art is its flying art while it is in the air.
Nothing else in the rules reads it yet.

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

A line on an entry's `mechanics.area` or a creature action's `area` may carry `width` in the same unit as `size`, rounded to cells with a minimum of one (Capability API 1.128), for example `{ "shape": "line", "size": 60, "width": 10 }` for a 60-foot line that is 10 feet wide; omit it for one cell, and an even cell width puts its extra column on the caster's left.

**Line of sight and cover.** A straight line of cells between the two of them: a wall or a mountain
on it blocks a shot and stops an area spreading past it, and the target simply is not on the menu.
Water is seen across: a shot crosses a river, and a line area carries on over it. The Engine's own
fights use the same sight test.

Cover is read from where the attacker stands, by the corner lines of the DMG's optional grid rule:
from the attacker's best corner, one line to each corner of the target's cell. Three or four lines
through a wall or a mountain are three-quarters cover; any line through one, or through ground worth
something as cover (woods, ruins), is half; low ground alone is never more than half. A target the
attacker cannot see at all has total cover and is not on the menu. Against an attack, a target
standing on ground worth something as cover has at least half, as it always had; a save is helped
only by what lies between it and the effect.

- `cover.bonus` is what half cover adds to the defense an attack is rolled against, and the log says
  so.
- `cover.threeQuarters` (Capability API 1.74) is what three-quarters adds; without it, `bonus`
  serves for both.
- `cover.saves` (1.74) names the saves cover helps too, against an action's own save (never a save
  that ends a condition or keeps concentration): from where a burst lands, and from its maker for
  anything else. The log says that too.
- `cover.creatures` (1.74) makes anybody standing in the way half cover, friend or foe.
- A save whose text says the target gains nothing from cover (5e's Sacred Flame) says
  `"ignoresCover": true` (1.74), on an entry's `mechanics.save`, a creature action's `save` or an
  item use's `save`.

**Height.** A board can have height, up to three levels, and every positioned fight walks and sees by
it whatever the ruleset says: climbing a level costs one more cell, coming down costs nothing, a step
of two levels or more is a cliff nobody walks (and nobody is shoved up), and ground higher than both
ends blocks sight. Shooting down from higher ground, low cover between hides nothing. A ruleset says
what its system adds with `elevation` (Capability API 1.75, and it needs `distance`):

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` is how high one level is in the ruleset's own distance.
- `highGround` is what striking down from higher ground gives an attack roll: `"advantage"`, or
  `{ "bonus": n }`, taken off the defense the attack is rolled against. Left out, it gives nothing.
- `rangeBonus` is how many cells further a shot carries from higher ground.
- `falling` is what a fall does: somebody shoved off a step of two levels or more lands below and takes
  `dice` for every `per` of the drop (levels times `levelHeight`), at most `max` dice, of `type`, and
  takes the `prone` condition after, when there is one. The dice are thrown as the system throws harm:
  added up, or under `dice-pool` counted as successes with soak taken off. A fall is a blow like any
  other, so it can put somebody down or break their concentration. The log says how far they fell.
  Without `falling` the fall is noted and does nothing.

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

Seven things open one, and two of them come out of what you already declared:

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
- **Somebody falls.** Before the damage and prone, for whoever holds a reaction that reaches the
  faller and permits its side (Capability API 1.124).

- **Somebody starts their turn.** Before they act, for an entry that reaches them on its target side
  (Capability API 1.131).

The last six are what a catalog entry, or a creature's own action, asks for by naming the moment it
waits for. When one action opens both `used` and `aimed`, the use is asked about first; if nobody
calls it off, the ones it is aimed at are asked next, and it resolves once both have been answered.
Being hit is asked about as each of its rolls hits, and being hurt once the whole action is over.

What a window does, whichever opened it:

- **Nothing else moves while it is open.** Not the actor whose turn it is, not the end of that turn,
  not another window. The fight waits. A fall holds its landing while the action step that caused
  it finishes; further falls are asked about afterwards.
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

- `on` is `used`, `aimed`, `hit`, `harmed`, `falls` or `turn-start`, and it is what puts the entry on that window's menu.
  Those six are the only moments the Engine watches for. An entry that still says `"reaction": true` says only
  that it is not taken on a turn, which is not enough to offer it anywhere, so it stays on no menu.
- `at` is `source` (the default), `target` or `chosen`. `source` points what is taken at whoever caused the
  moment and fills the target in, so nobody is asked to pick; `chosen` keeps the entry's own
  targets and asks. `target` points at the creature the moment is about. A `falls` answer lands on
  its chosen fallers.
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

**A counter that reaches only so high** (Capability API 1.116). `"upTo": "paid"` on a `used`
reaction that cancels stops only what was paid for no higher than the answer itself was, and
`"above": { "check": <value>, "dc": 10 }` is the check that stops something higher anyway, against
`dc` plus its level. 5e's Counterspell, which stops a spell of its slot's level or lower and asks a
spellcasting ability check against 10 + the spell's level above that, upcast like any spell:

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

The level of anything paid for is the level of the pool it came out of: a pool's own `level`, a
value read off its holder's sheet, when it says one (5e's pact slots, cast at the warlock's slot
level), and otherwise its place in its group, the first pool being 1. Something that cost nothing,
or came out of a pool in no group, is level 0, so every such counter stops it. The check is the
fight's own dice with the answerer's conditions on checks; a `dice-pool` fight has no DC to meet and
refuses `above`. A creature without a sheet writes its check as `{ "const": n }`. The log says the
level and the roll whenever the answer reaches above itself, and the usual line follows when it
stops it. Without `above`, something higher is simply not stopped, and what the answer cost is
still spent.

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

**Answering one spell by name** (Capability API 1.117). `against` may name `entries` as
`<catalog>/<entry>` beside `catalogs`, and either one matching opens the moment. `also` takes the same
answer at up to three more moments, each with its own `against`. A condition's `noDamageFrom` keeps
those entries' harm off its holder entirely while it holds, whatever kind of harm it is. 5e's Shield
is taken when an attack hits and when Magic Missile is aimed at its caster, and under it Magic Missile
does nothing:

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Only the first moment may cancel, so a reaction that cancels has no `also`. The catalog an entry
names has to be one the ruleset has. An entry that is not in it simply never opens the moment. A blow
kept off this way shows in the log as one the target is immune to.

**Answering only some blows** (Capability API 1.118). A `hit` moment may say `"blow": "melee"` or
`"blow": "ranged"`. A blow is melee while its target stands in the weapon's reach, so a dagger thrown
from afar is ranged and the same dagger used next to its target is melee. A weapon with a reach and no
range is always melee, and one with a range and no reach is always ranged. In a fight with no board,
a weapon that has a reach is taken as swung in hand. `"seesSource": true`, on any moment except
`falls`, opens it only while its holder sees whoever caused it. That means a line of sight between them on the board
(everybody sees everybody without one), and never somebody who has taken the Hide standard action
until it wears off at the start of their next turn. 5e's Parry is both:

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

Both keys may also be written on a moment in `also`, and `blow` only ever on a `hit` one.

**Catching a fall** (Capability API 1.124). A reaction on `falls`, including in `also`, answers a
creature falling off a ledge or a flier forced to the ground, before the fall deals damage or leaves
it prone. Its range and target side are checked against the faller, and its answer lands on that
creature. For Feather Fall, give the entry these mechanics and declare `feather_falling` in the
sheet's live conditions:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

Its `combat.conditions` entry is `{ "condition": "feather_falling", "fallsSafely": true }`.
While held, this condition prevents falling damage and the prone condition a fall would apply; it
does not remove a condition that caused the fall. Use `targets: "self"` for an answer only to the
caster's own fall. A fall has no source entry, so its reaction cannot carry `cancels`, `blow`,
`seesSource` or `against`. A single-target entry asks about each fall separately. This resolves the
landing; it does not track a slowed descent.

**Answering for another creature** (Capability API 1.131). `for` is `self` by default; `ally`
excludes the holder, while `any` includes them. Both ask holders on the target's side within the
required `within`, in the catalog's distance unit, and only on `aimed` or `hit`. These keys work
on each `also` moment too. `seesSource` still requires sight of the attacker. Protection puts
`own-attacks-disadvantage` on the source before the attack dice are rolled. Its `this-action`
duration ends when the action resolves or is cancelled. Without an explicit source range, a
bystander's answer reaches that source; `within` measures the distance to the protected creature.
Declare `protected_attack` on the sheet and give its combat condition that effect:

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Putting the answer on the target.** `at: "target"` applies to the creature attacked, while
`source` stays the attacker. Shield Guardian models the amulet wearer as an ally within 5;
`parrying` grants `+2` defense. The held hit rechecks that ally's defense after the answer:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**At the start of a turn.** `on: "turn-start"` asks when a creature on the entry's target side
starts within its range, before that creature acts. That creature is the `source`. A harmful entry
answers the other side, a helpful entry its own side. It cannot carry `cancels`, `blow`, `against`
or `upTo`. The Unnerving Mask creature action asks for a Wisdom save; one round on the affected creature's clock lasts
through this turn and expires at its end (leave `of: "source"` out):

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Cancelling on a save.** `cancelSave: { save, dc }` requires `cancels`; the holder rolls with its
usual save modifiers. Success cancels, failure lets the original action resolve, and either spends
the reaction. `against.actions` names one to twelve stat-block actions, matching the whole name
case-insensitively (at most 80 characters each). Rock Catching models catching the rock by cancelling
the whole attack, including all its damage, rather than only its bludgeoning damage. Save ids are
those of your ruleset (`dex` here; `dex_save` in the bundled 5e example):

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Catching several fallers.** A `falls` entry with `targetCount` greater than one offers the eligible
creatures falling from one blow or effect, within range and on its target side. The menu and director
default to all eligible up to the count, nearest first; the player can change the selection. A later
fall is a separate event. Feather Fall uses the same `fallsSafely` condition as above:

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Not yet

Said plainly, because a ruleset should not claim what the Engine does not do:

- **Beyond the modest board**: no flying over
  obstacles, no squeezing and no mounts. A creature is moved only by its own walk, a teleport, and
  what pushes it (a contest, an entry, a creature's action or a zone). Nobody drags a creature they
  hold.
- **A contest is plain.** Its roll opens no window, but a fall it causes may be answered.
- **An entry may wait for six moments only**, `used`, `aimed`, `hit`, `harmed`, `falls` and `turn-start` (see Windows, above).
  Those are the moments the Engine notices on an entry's behalf; the other two windows, somebody
  breaking away and the pause between two turns, are opened by the fight itself and are not moments
  an entry can ask for. There is no moment for a save being rolled or a death.
- **No chain of them.** The fight keeps one window rather than a stack, so nothing opened inside a
  window opens another: a counter cannot itself be countered, what a reaction deals opens no
  further moment, and an attack made inside a window is not held when it hits. An answerable fall
  caused during a window is held until it closes and then asked about in turn.
- **Only an attack roll is a hit.** Something that lands without one (darts that simply hit, an area
  everyone saves against) opens no `hit` moment.
- **Damage modifiers belong to attack hits.** An answer can put a damage modifier on its holder
  or halve incoming harm with `resist-all`; damage modifiers never change a save-only effect.
- **Nothing is refunded.** What a cancelled action cost is spent.
- **What a condition changes is a closed list.** Defense, attack rolls, saves, contest checks,
  speed, health maximum, damage dealt and damage taken (also for levels and item effects).
  Damage modifiers change attack hits only; they never add to save-based damage or automatic hits.
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
- `currencies` takes coins out: `removeUnits` names single coins and `removeFamilies` whole
  families. A family's smallest coin goes only with its family, so every family left can still pay
  and give change. While the layer is on, nobody earns, pays with, picks or drops a coin taken out,
  and the purse line leaves it out. A price named in it is said in the largest coin left that pays
  it exactly, at the same worth: Gravewatch's long night takes the crown out, so a watch pistol at 3
  crowns costs 15 shillings. An item whose whole family is gone has no price.

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
entry: it is left out of the picker, and a row a player already picked stays on the sheet. Coins a
layer takes out that somebody already carries stay in their bag.

**Limits.** 12 layers per ruleset, and 4000 characters of guidance per layer counting both strings
together. A packaged ruleset that declares `layers`, or a base `gm.worldGuidance`, needs Capability
API 1.25, and one whose layers take coins out needs 1.64. A ruleset you import is validated by the Engine that reads it, so it needs nothing.

**Layers written by somebody else** (a Low Magic layer for a ruleset you did not write, shipped in
its own file) are a later addition. Today a layer ships inside the ruleset it belongs to.

## Trying your ruleset

Community rulesets use the same switch as imported agents. Open **Settings** > **Advanced** > **Danger Zone** and make sure **Allow custom Agent imports** is on. Importing also needs localhost access or configured **Admin Access**.

1. Open the **Agents** panel and choose the **Import agents** button (the download icon in the row of buttons at the top of the panel).
2. Pick **Game Mode ruleset** and choose your JSON file, or a ruleset package file ending in `.ruleset.json` (see [Sharing your ruleset](#sharing-your-ruleset)).
3. Read the review. It shows the name, version, license, what the ruleset covers, and the Game Master text. Choose **Import**.

Your ruleset appears in the panel's **Rules** section and in the setup wizard's **Rules** choice for new games. A ruleset imported from a file is filed as `local/<your id>`, so it can never be confused with an official ruleset or with somebody else's.

### Changing a ruleset you already imported

A version that has been imported is never rewritten. If you change the file and import it again with the same `version`, the import is refused and asks you to raise the number. This is on purpose: a game is tied to the exact version it was created on, so a running campaign never wakes up on different math.

So the loop while you are drafting is: edit, raise `version`, import, start a new game. Old versions stay installed beside the new one until you remove the ruleset from the **Rules** section. Removing a ruleset that a game still uses makes that game say its ruleset is missing until you import it again.

If you change the shape of the sheet (add, remove, or rename things), raise `sheet.version` too. Existing sheets are read tolerantly: values the new sheet does not know are kept, and missing ones take their defaults.

### Moving values to new ids: `sheet.migrations`

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
- Every build step copies: the old value stays where it was, so an older version of your ruleset still reads the sheet as it did. A step never overwrites a value already in its target.
- The import refuses an entry at or above `sheet.version`, two entries from the same version, a step that writes to an id the sheet does not have, a case listed twice, and a `rename` or `routeLive` that reads from an id the sheet still has (an id moved away is never used again, which is what makes those steps safe to run again).
- Sheets are migrated whenever they are read, and the new layout is stored at the next edit. Live state has no version of its own, so `routeLive` runs on every read: the old key is dropped and its value moves only while the new key is not there yet, so a value spent or rested since is never overwritten. Where it went is settled by the first write after the update: a sheet corrected later (a class level moved by hand) does not move it again. A fight already in progress when the new version arrives still ends, as before.

## Sharing your ruleset

**As a file.** Send the JSON file to a friend. They import it the same way you did.

**As a package file.** A ruleset too big for one file, with catalogs in their own files, travels as one plain JSON file named `<name>.ruleset.json`. It holds the package manifest and the ruleset's documents, each as its exact bytes in base64:

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

The manifest lists `ruleset.json` and each `catalogs/<id>.json` in `contributions.assets.paths` and in `files`, with each one's size and sha256. A ruleset editor such as Pixelforge makes one. **Import agents** → **Game Mode ruleset** takes the file and shows the same review as for a ruleset file, with each catalog and its number of entries. Nothing in it is compressed, so it never holds more than its own size. It is read as data and never installed as a package: it is refused, with the reason, if it holds anything else (another key, any other file, a document that is not strict base64 or not UTF-8 text), if its manifest is more than a ruleset's (any code, permissions or other contributions), if a file is not the one the manifest lists, if a `$comment` is longer than 2,000 characters or `$schema` names anything but the Engine's own schema, or if the ruleset or a catalog does not read. It is filed as `local/<its id>` like a ruleset file, at most 24 MB, with at most 12 catalog files of 2 MB each. A version is its ruleset and its catalogs together, so a changed catalog needs a higher `version` too. Ruleset packages are not accepted as zips.

**Through the official agents catalog.** A ruleset published in the catalog is a ruleset package file of exactly this shape, `<id>.ruleset.json`, never a package zip (Capability API 1.374). Its manifest declares Capability API 1.374 or newer, so an older Engine is never offered it. The Engine reads it with the same reader and checks as a package file you import, holds it to the manifest the catalog lists, and installs it like any catalog package. A catalog ruleset whose artifact is a zip is refused before anything is downloaded; rulesets already installed keep working.

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
