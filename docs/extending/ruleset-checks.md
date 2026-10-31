# Ruleset Checks

This page is part of [Writing Game Mode Rulesets](writing-rulesets.md). How a ruleset rolls a check or a save: the five resolution kinds, outcome bands, checks that roll their own way, and spending or charms that change a roll.

## Resolution kinds

`resolution.kind` picks how a check is rolled. Every kind reads the same character sheet and shares three keys, so the parts of the file below `resolution` do not change when you switch:

- `abilityModifier`: how a score on the sheet becomes a number. `identity` means the score is the number. `floorHalfMinusTen` is the 5e rule. `stepTable` lets you list your own thresholds as `[[score, number], ...]`.
- `proficiencyTiers`: the training levels a skill or save can have. The first one is what an unlisted skill gets. A tier adds `flat`, or `multiplier` times a proficiency bonus, or both. If your system has a proficiency bonus, name where it comes from with `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: optional, and only needed by a tier that multiplies.

What the resulting number means is the kind's business: `dice-sum` adds it to the roll, `dice-pool` and `dice-highest` throw that many dice. `symbol-pool` keeps ability and training separate to build and upgrade narrative dice.

### `dice-sum`: add the dice up

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

### `dice-pool`: throw the dice and count them

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

### What the Game Master may write on a pool check

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

### `dice-highest`: throw the dice and read the highest

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

### `roll-against`: roll at most (or at least) the sheet's number

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

### `symbol-pool`: throw narrative dice and read the symbols

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
- `outcomes` can read the net success count (`total`) or `net successes - needed + 1` (`margin`). Bands still decide success in their usual way; the original critical symbols remain marked. `spend` buys only extra base character dice within `pool.max`. Its fights are a `symbol-pool` fight (Capability API 1.382, see [A fight thrown in symbol dice](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)); any other combat kind is refused beside it.
- Outside a check, a game on this ruleset can throw its dice by name: the composer's custom dice field and the Game Master's `roll_dice` tool read `2 ability 1 proficiency vs 2 difficulty` (each die's `id` or `label`, any case) and count and cancel symbols as a check does, without the sheet, upgrades or a difficulty ladder. No key enables it.
- The record keeps `resolution="sum"`, with `symbols="2s 1a 1t"`, `thrown=` identifying each die, and `rolls=` holding its 1-based face. Encoded `symbolDetails` preserves labels, face symbols and both critical markers. `setback` records the independent setback dice actually added after the shared setback limit, and `upgradeOwn` records additional upgrades actually applied; ignored or zero additions are omitted. The card and summary name the net symbols, including an empty result, rather than adding face numbers. Overrides can change this kind's rules, but cannot replace `symbols` or `dice`.

### What is out of scope, and why

These mechanics still need their own resolution kind:

- **Opposed pools** resolve two characters at once; a check has one roller.
- **Sum pools with a wild die** (as in OpenD6) add the dice up and treat one of them specially.

Both of the things this kind used to leave out are modelled now, and Spending to change a roll below says how. A rule of the system itself, "spend a point for a success" or "spend a point to throw the failures again", is `resolution.spend`. A re-throw the system grants for free when the situation calls for it is `resolution.reroll`, above. One that belongs to something a character picked is `mechanics.check` on a catalog entry, bought with that entry's own cost.

## Outcome bands: more than success or failure

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

## Checks that roll their own way

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

## Spending to change a roll

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

## A charm that changes a roll

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
