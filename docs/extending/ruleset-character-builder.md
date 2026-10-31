# Ruleset Character Builder

This page is part of [Writing Game Mode Rulesets](writing-rulesets.md). The guided builder: making a character in steps, from race and class to scores, proficiencies, spells and gear.

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

Up to 32 steps, each `{ id, label, kind, ... }`; a package with more than 16 declares Capability API 1.112, and one with more than 24 Capability API 1.768:

- `catalog`: entries of a catalog of rows, shown as cards with their `summary` behind **Info**. `min` (default 1) is how many the step asks for and `max` (default 1) the most it takes; with `max` 1 a new pick replaces the old one. Both may go up to 60; a package with either above 20 declares Capability API 1.110, and one with either above 40 Capability API 1.768 (a wizard's spellbook at 20th level holds 44 spells). `field` names a text or enum field the picked labels are written to (an enum field takes the entry's id or label, whichever is one of its values). `filters` fixes values of the catalog's filters, and `within: { step, filter }` offers only entries whose `filter` names an entry picked at that earlier step, as a subrace names its race; unpick the race and its subrace counts for nothing. `upTo: { filter, value }` (Capability API 1.87) offers only entries whose number `filter` is at most `value`, a value read off the sheet as it stands, such as features up to the character's level (`{ "filter": "level", "value": { "derived": "level" } }`); an entry without the filter is always offered, and a pick the sheet has since fallen below counts for nothing but is kept. A pick that changes the value read (a class that sets the level) is settled in the same change, and so is a value changed in **All fields** (a level lowered there takes back at once what a feature above it gave). `countFrom` (Capability API 1.90) is a value read off the sheet the same way that stands for both `min` and `max`: how many entries the step asks for and the most it takes, rounded down and never above `max`, such as the spells a class knows at the character's level (`{ "derived": "spells_known" }`). Picks past it are kept but count for nothing until the count rises again.
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
- A catalog entry may name an `exclusive` group (Capability API 1.94): a builder step keeps one pick of each group, so picking one drops the step's other pick of that group, and only the latest counts. A feat taken in place of an ability score improvement shares a group with it: `"exclusive": "fighter-asi-4"`. `"exclusiveDefault": true` (Capability API 1.772) makes an entry the one a step that takes all it offers takes of its group until the player picks another.
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

A rows step may say how many rows it wants with `countFrom` (Capability API 1.799), a value read
off the sheet: 5e's hit point rolls, one per level after 1st. When the step is shown, the builder
adds rows, each as **Add a row** makes it, until the player's own rows reach that many, never past
`max` or the list's `maxItems`; it never takes a row away, and a row removed there stays removed until
the step is shown again. A character being described is not given rows by looking at the step. The
step then waits on that many whole rows as it does on `min`, the larger of the two when both are
given, and shows the same "N of M" count. A ruleset using it needs Capability API 1.799.

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

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
