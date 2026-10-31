# Ruleset Sheets

This page is part of [Writing Game Mode Rulesets](writing-rulesets.md). What goes on a ruleset's character sheet: abilities, skills, fields and lists, live states, wound tracks, penalties, rests and the Game Master text, plus the party sheet and progress clocks.

## The sheet

- `sections` group things in the editor. Fields, derived values and lists name the one they sit in with `section`, and so may abilities, skills and saves: the editor, the game's sheet and the Game Master's sheet block then show them under that heading (a sheet that names no section on them shows them exactly as before). A section may also carry an `untrained` rule (below).
- `abilities` are the core scores. `skills` and `saves` each may name the ability they roll with, a `cap`, and an `untrained` rule (below).
- `fields` are single values. Types: `number`, `text`, `longtext`, `boolean`, `enum` (a fixed list of choices), and `dice` (text such as `1d8`). A `text` field or list column may add `suggestions` (Capability API 1.796): up to 40 words offered as chips under it, each one added to what is written, and the field is still typed in freely, such as a ranger's favored enemies out of the creature types. Such a field may also say how many to `pick` (Capability API 1.797), a value read off the sheet such as a derived count that grows with class level: the editor says "Choose N", shows how many are picked, and stops offering more chips once N are in, though what is typed is never refused.
- `derived` values are worked out from other values and cannot be typed over. A sheet may have up to 800 of them (Capability API 1.729; 400 from 1.111, 240 from 1.88, 120 from 1.84, 60 before it); a package with more than 240 declares 1.111, and one with more than 400 declares 1.729. The operations are `sum`, `min`, `max`, `scale` (multiply by a fixed number and round), `multiply` (two to six values multiplied together, such as a Constitution modifier times the level; Capability API 1.82), `stepTable` (look a value up in thresholds, the way a level gives a proficiency bonus), and `enumTable` (a number for each value of an enum field or a live state; see Live states below).
- `lists` are tables with your own columns, such as gear, spells, or features. A list has up to 24 columns; a package with a list of more than 12 declares Capability API 1.165. A list with `pools` turns every row into a resource with its own maximum, for class features with limited uses. A number column may be filled by a roll: `"roll": { "count": 1, "sides": 8 }`, where `sides` is a number, another column of the same row (`{ "column": "die" }`, a number column or an enum whose values read as dice such as `d8`), or a value off the sheet. The sheet editor shows a Roll button that throws the Engine's own dice and writes the total, held to the column's `min` and `max` (Capability API 1.85).
- `live` is what changes during play: `pools` (hit points, spell slots, Grit), `tracks` (a number on a scale, such as exhaustion, or a wound track of boxes you tick), `text` (short notes such as what a character is concentrating on), `conditions`, and `states` (one value out of a closed set, such as a form or a stance).

Anything that reads a number names it with a value reference, which is an object with exactly one key: `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack`, or `itemStat`. For example, a pool whose maximum is a derived value: `"max": { "derived": "grit_max" }`.

- `listSum` adds up one number column of a list: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` is optional and names a boolean column; only the rows where it is set count. An empty cell counts as its column's default, and a list that `hideWhen` hides adds nothing. Ember Roads works out Burden this way, from the gear a character has packed, so it can never drift from the list the way a typed-in number would. A catalog's scaled column cannot read a list sum, even through a derived value: a list may hold scaled cells, its own or ones that read it back, and the recompute would never settle.
- `livePool` reads what is left in one of your `live.pools` (a list row's pool is not one of them). `liveTrack` reads one of your `live.tracks`, with an optional `read`: `"value"`, where it stands (the default); `"filled"`, how far above its `min`; `"remaining"`, how far below its `max`; or, on a wound track only, `"penalty"`, the penalty in force. A hidden pool or track reads 0. Gravewatch's "Harm still to take" is `{ "liveTrack": "harm", "read": "remaining" }`.
- A live read takes the live state as it stands when a check is rolled, a fight begins, or the Game Master's sheet block is written. Where there is none yet (the sheet editor, an import review) it reads the state play starts in: a pool full or empty as it `start`s, a track at its `default`, a wound track clear.
- Nothing worked out before there is a live state may read one: a pool's or a track's `max`, the proficiency bonus, or a catalog's scaled column or scaling. That holds through a derived value that reads one and through a skill a live value caps, and the import names the value that does.
- These three are Capability API 1.39 for a packaged ruleset.
- `itemStat` reads the items the character holds, such as the guard of the armor they wear, and is held to the same rule as a live read. See [Items on the sheet](ruleset-items.md#items-on-the-sheet). Capability API 1.52.

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

## Live states: a form, a stance, a light

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

## Wound tracks: health that is a track, not a number

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

### Numbered boxes instead of named levels

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

### Filling by box, and tracks that refuse

- `"fill": "indexed"` puts a mark on the box the command names with `box=` (the first box when it names none), or the next free box above it, and never moves a mark once it is down. A heal clears the highest of the lightest marks. The sheet screen lets a player click any clear box.
- `"onFull": "refuse"` refuses a mark that has no box free, instead of upgrading the lightest mark. The whole command is refused, so three marks with two boxes free land none. An indexed track always refuses; say so with `"onFull": "refuse"` beside it.

### Levels a list adds

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` on a track with named levels lets a list on the sheet lengthen it per character. Each row, in order, adds its count of levels (at most 16) at its penalty, after the last level whose penalty is at least as good, named after that level when the penalties match and by the penalty otherwise. Gravewatch's scars work this way. A list the sheet hides adds nothing, and if a row is deleted while its levels are marked, the marks that no longer fit are kept as overflow: harm is not undone by editing the sheet.

`boxes`, `fill`, `onFull`, `extra` and a rest step's `kind` are Capability API 1.40 for a packaged ruleset.

## The penalty on your rolls

`resolution.penaltyFrom` names the wound track whose penalty applies to every check this ruleset rolls. It is declared rather than assumed, so a ruleset that leaves it out rolls exactly as it did before wound tracks existed.

What the penalty DOES is your resolution kind's business, exactly like the sheet's own number:

- Under `dice-pool` it is **dice off the pool**, floored at your own `pool.min`. A `pool.min` of 1 means even somebody on the bottom rung throws one die; a `pool.min` of 0 means they throw none and fail without rolling.
- Under `dice-sum` it is a **flat modifier on the roll**, folded into the same number your ability and training already add.

The track it names has to be a wound track. A plain track carries no penalty to apply, and naming one is refused at import. The result says which penalty was applied, so a player can see why they rolled fewer dice, and the Game Master's own sheet block shows the rung and what it costs.

## Modifiers off the sheet

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

## Rests

A rest is a list of restore steps and things to clear. Each step names one target (`pool`, `poolGroup`, `listPools`, `track`, or `state`) and either sets it (`"to": "max"`, `"to": "min"`, or a number) or changes it (`"by": { "const": 1 }`, or `"by": { "fractionOfMax": 0.5 }`). A step naming a wound track can only heal it, so its `by` is negative; see above. A step naming a live state only sets it, to `"default"` or one of its values. A `poolGroup` step with a `fractionOfMax` changes each pool of the group by its own fraction; add `"shared": true` (Capability API 1.77) to work the fraction out on the whole group's maximum instead and hand it to the group's pools in the order the sheet lists them, each up to what it is missing. 5e's long rest, "half of the character's total number of" hit dice kept in one pool per die, is `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

## Game Master text

- `checkGuidance` replaces the built-in paragraph that tells the Game Master how to ask for a check. Say which system this is and when to call for a roll. The Game Master only names the skill and the difficulty. The Engine rolls the dice and does the arithmetic from the sheet, so do not ask the model to do math.
- `sheetGuidance` introduces the character sheets in the prompt. Use it to say which resources matter and when to spend them.
- `worldGuidance` is optional and is read once, when the world is generated, so the setting the Game Master invents suits your rules: no gunpowder, magic is rare, the dead walk. It never reaches a turn.
- `opposition` says who plays the other side of a fight (Capability API 1.774). `"game-master"` gives every opponent's turn to the Game Master, which picks one of the options the Engine offers, with the Engine's own picker as the fallback when it does not answer. It applies only in a game whose player let the Game Master play bosses, and in every combat style, including a Classic or Tactical fight for a ruleset without a `combat` block. Use it for a narrative system whose opposition is played as fiction rather than as a sum of damage: Fate, Blades in the Dark, Trophy, Lasers & Feelings. `"engine"`, or leaving it out, keeps the Engine's picker, with bosses (and, when the player asks, named and genius-minded opponents) going to the Game Master. A ruleset using the key needs Capability API 1.774.
- `sheetSummary` chooses which fields, derived values, and list rows the Game Master sees for each character. The Engine always shows ability modifiers, trained skills and saves, and live values. Keep the rest short, because it is sent on every turn. A summary list's `nameColumn` may be a text or an enum column (an enum shows its value's label), and `columns` names up to three more of the row's own columns to print after the name, so the block reads `Gear: Crowbar 1d6` rather than names alone. A boolean column prints its label when it is set. Both are Capability API 1.37 for a packaged ruleset.
- You do not need to teach the sheet command in `sheetGuidance`. The Engine teaches every command itself, with the names your file declares, and when your ruleset has a wound track it adds the `op="damage"` command for marking it and lists its levels and kinds of harm. When it has live states, it adds the `op="state"` command and lists the values each may take.

## Full GM rules reference

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
