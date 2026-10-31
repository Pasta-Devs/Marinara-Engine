# Ruleset Combat

This page is part of [Writing Game Mode Rulesets](writing-rulesets.md). How a ruleset takes part in a fight: the `battle` block, which lends Marinara's combat the sheet, and the `combat` block, which resolves the whole fight by the ruleset's own rules, with its bestiary, board, reactions and contests.

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
every name in it is yours. There are three kinds: `attack-vs-defense`, where dice are added up and
compared with a number, `dice-pool`, where a fight throws your `dice-pool` ruleset's own pools
and counts successes (see A fight thrown in pools, below), and `symbol-pool`, where a fight throws
your `symbol-pool` ruleset's narrative dice and spends what is left over (see A fight thrown in
symbol dice, below).

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

- `kind`: `"attack-vs-defense"` (one side rolls dice against the other's defense; a hit does damage),
  `"dice-pool"` (see A fight thrown in pools) or `"symbol-pool"` (see A fight thrown in symbol dice).
  Every key below means the same under each, read the way that kind reads numbers.
- `health`: required. What a fight takes away. Either `{ "pool": "grit" }`, a live pool it counts
  down, whose temporary buffer if it has one is what damage drains first; or `{ "track": "harm" }`,
  a wound track it MARKS. A wound track needs `damageKinds` beside it. Or `{ "track": "wounds" }`
  naming a plain track (no `levels` or `boxes`) that FILLS UP from its `min` to its `max` (Capability
  API 1.383): damage adds the points, a heal takes them off, and a track at its `max` is out of the
  fight, as a pool at zero is. Genesys's Wounds is one, with the Wound Threshold as its `max`; a
  system where you go down only PAST the threshold makes the `max` one more than it. A plain health
  track starts at its `default` (not a `startFrom`), may not start at its `max`, and takes no
  `damageKinds`. A `max` the sheet works out is each character's own, as a pool's maximum is. No track grants temporary points.
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
  `abilityChoices` maps a value of the row's ability column to two or more of your ability ids
  (Capability API 1.793): a row that reads it swings with whichever adds the most to hit and deals
  its damage with that same one. SRD 5.1's Finesse is the sentence it exists for, written
  `{ "finesse": ["str", "dex"] }` with `finesse` among the column's values. The value is refused
  where it is itself an ability, names one your sheet lacks, or is not offered by an ability column.
  `toHit.sheetBonus` (Capability API 1.800) adds a number off the sheet to hit: `value` is any value
  reference, and `when: { "column": ..., "equals": ... }` holds it to the rows whose column holds that
  value. SRD 5.1's Archery, "+2 bonus to attack rolls you make with ranged weapons", reads a features
  column's `listSum` on rows whose `reach` is 0, so a thrown dagger gets none.
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
  it was: harder to hit, and nothing else. `{ "help": { "beside": true } }` (Capability API 1.771)
  offers Help only beside an opponent, and the help counts only against an opponent who was beside the
  helper; it needs `help` in your `standard` list.
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
    to skills never reaches one; a check outside a fight on one of those skills reads it (see [Checks outside a fight](ruleset-items.md#checks-outside-a-fight)). Capability API 1.53.
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
  because only a mark carries a kind and a pool of points has nowhere to keep one (see [Wound tracks](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number)). It says which of the track's `kinds` a blow marks and how many boxes it ticks. `default` is what
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
  A tier may carry `worth`, what a creature of it counts for against an encounter budget (5e's
  experience points by challenge rating), and `threat` may carry `budget`, what a fight may hold for
  the party that meets it (Capability API 1.803):
  - `level`: the number fields whose sum is a member's level (5e: one per class).
  - `steps`: the difficulty steps, lowest first, each `{ "id", "label" }`.
  - `byLevel`: `[{ "level": 5, "worth": [500, 750, 1100] }]`, one worth a step for one member at
    that level and up, levels rising.
  - `crowd`: optional, `[{ "from": 2, "times": 1.5 }]`, what the opponents' worth is multiplied by
    once there are that many; `smallParty` and `largeParty` read a row up for a party smaller than
    one and a row down for one larger than the other (5e 2014's multipliers). Leave it out for SRD
    5.2's budget, which adds worths as they are.
  - `forGame`: optional, the step each game difficulty (`casual`, `normal`, `hard`, `brutal`) plays
    at. Unsaid, they take the steps in order, and any past the last plays at the last.

  The Game Master is told each tier's worth and the party's budget before writing a fight. A fight it
  makes up that is worth more is brought down: the invented opponent worth the most comes down a tier,
  and again, until it fits; one with a boss in it may reach the next step up. A bestiary creature and
  one that comes back from an earlier fight are counted as they are, and a story's fight is its
  author's. What came down is said in the fight's adjustments.

### Saves against conditions, damage or magic

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
  See [Armor and worn effects in a fight](ruleset-items.md#armor-and-worn-effects-in-a-fight).

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

### A fight thrown in symbol dice: `symbol-pool`

A `symbol-pool` ruleset reads symbols rather than numbers, and its fights can too, so the Engine runs
the whole fight without asking the Game Master what an advantage bought. `"kind": "symbol-pool"`
needs `resolution.kind` to be `"symbol-pool"`, and it reads the sheet the way your symbol checks
already do:

- A to-hit number is the attacker's dice. Off a sheet, an attack row's number is its ability and its
  skill's ranks together: the larger is how many dice are thrown and the smaller how many of them are
  upgraded, as `pool.build: "larger-upgraded"` builds a check. A creature action says it as `toHit`
  (its dice) and `upgrades` (how many of them are upgraded), which needs a pool with an `upgrade` die
  that isn't built by `sum`.
- `defense` is how many difficulty dice are thrown against the attacker's. A creature's `defense` is
  its own number of them. Cover and a condition's modifier to `defense` add difficulty dice.
- A condition's modifier to attacks, saves or checks, and the wound penalty your `penaltyFrom` names,
  are boost dice when they help and setback dice when they hinder, so they are `flat` numbers: a rolled
  modifier (`dice`) is refused. A roll that leans (long range, a condition's disadvantage) throws one
  more setback die, or one more boost die when it leans the other way.
- Net successes (your `success.needed` of them) land a blow. A save's number is its dice and its
  difficulty the dice against them; a contest throws each side's dice and the more net successes
  wins. Initiative may be thrown as a pool (`initiative.pool`): its net successes are the number.
- Damage is added up as in an `attack-vs-defense` fight. Each net success adds `damage.perSuccess`
  (one) to a hit, every success (`"counts": "all"`) or only those past the ones a hit needs
  (`"beyond"`), and the target's soak comes off the whole blow, never below none.
- Nothing botches and nothing doubles a damage roll. A critical is something a spend buys.

What the symbols do is the `symbols` block:

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak`: what a target takes off each hit, read off their sheet. `all` is a value reference for any
  kind of harm and `byKind` one per kind of your health track, which wins over `all` for its kind. A
  creature gives its own as `soak: { "all": 2 }`, which needs this `soak` to be declared.
- `spends`: up to 16 things a symbol left over on an attack's roll buys. `cost` of `symbol` buys it
  once, and `max` (one) says how many times one roll may buy it; a spend that gives a `condition` or
  a `critical` lands once, so its `max` stays one, and no two spends put one condition (or two of
  one `oneAtATime` kind) on the same one on the same throw. A spend is left unbought when it would
  do nothing: its condition would not go on (kept off, or one of its kind already held), or its track
  has no room for a whole step that way (room an earlier spend on the same throw may have used). `by` says which side chooses it: the
  attacker spends the symbols that favour them (advantage, triumph), the target the ones that favour
  the target (threat, despair). One side spends a given symbol, and a spend never buys with the
  successes, which already land the blow and add to its harm.
- `when`: bought only on a `hit`, only on a `miss`, or on either (`any`, the default). `damage` (harm
  added to the hit, before soak) and `critical` (the hit is a critical one, so a clause that says
  `onCritical` lands and the log says so) need `"when": "hit"` and `"by": "attacker"`.
- What a spend does, any of: `condition` puts one of your conditions on somebody, for `rounds` or
  until something ends it; `track` moves a plain live track by `by` (strain, stress), never the
  health track; `boost` and `setback` add that many dice to the next roll whoever it lands on makes
  in this fight, which that roll uses up. `on` is `attacker`, `target`, `attacker-ally` or
  `target-ally`; an ally is the next of that side to take a turn, and a spend whose ally there is
  nobody to be is not bought.
- `worth`: optional, what the AI weighs the spend at in points of harm. Without it the Engine works
  it out from the effects: harm is its points, a condition is worth two, a die on the next roll a
  little over half, a step of a track a half, against the other side, or for the chooser's own side
  when it lowers a track or adds boost there. A spend worth nothing to its chooser is never bought.

The Engine buys, for each side, the spends worth the most for the symbols it has, for players and
opponents alike, and says each one in the log. A player may choose their own instead: with "Choose
my own symbol spends" ticked on the fight screen, a throw that leaves a party member they play
something to buy waits while they pick spends one at a time, take the Engine's pick for the rest,
or spend nothing more. Their choice is held to the same rules as the Engine's (cost, `max`, `when`
and what would land), and the Engine still picks for everybody else. A ruleset needs nothing for
this. Symbols nobody spends stay on the roll for the Game Master to narrate. The menu's forecast counts every way the throw may come out: the chance to hit,
and the harm a hit does with its successes and spends, after soak. The AI weighs each attack by
that, with what the other side's spends would cost it taken off.

**What stays with the Game Master.** A spend's cost is the ruleset's, not each weapon's, so a weapon
with its own critical rating is written as a spend the ruleset shares; a critical's own table is the
Game Master's to roll. Advantage on a save, a check or a contest buys nothing: only an attack's roll is
spent. Upgrading the difficulty dice in a fight is not built.

### Minimum damage dice

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

### A hit that dazes

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

### The target chooses the wound kind

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
  [Weapons in a fight](ruleset-items.md#weapons-in-a-fight)), and so is an action whose `damage.qualities` or a catalog
  entry whose `mechanics.qualities` names one (Capability API 1.101). `conditionImmunities` names your
  own conditions, or a track your `combat.levels` read (Capability API 1.115).
- `tier`: which rung of `combat.threat` it belongs to.
- `loot` (Capability API 1.63): the id of the loot table a won fight rolls for it (see [Loot](ruleset-items.md#loot)).
- `inventory` (Capability API 1.795): what it may have on it as a fight begins, up to 16 lines. Each line names one of your items (`item`, as `<catalog>/<entry>`) or one of your loot tables (`table`), with `chance` (in a hundred, default 100) and `count` (a number or dice, default 1; a table is rolled that many times). It uses what it can in the fight: a creature with a `sheet` uses its items as a party member does, and a plain stat block uses an item whose `use` is used up in the using and reads nothing of its user (a potion, an oil). What it has left drops when it is beaten, beside its `loot`; one that runs off takes it along. The Game Master may give an opponent its own instead (`carrying` in the encounter), which takes the place of these lines.
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

The Engine's test copy of a 5e draft, `docs/development/ruleset-5e-2014.example.json`, has a
bestiary of five hand-written creatures, covering a sequence, a recharge, a save with a
condition, resistances and immunities, limited uses, signature points, and one written as a sheet. The full SRD bestiary is the official
[5e (SRD 5.1) package](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014)'s `catalogs/creatures.json`.

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

**Which styles a game may play.** `combat.styles` names the combat styles a game on your ruleset may
play, by id: `classic`, `tactical`, or a style a client registered (up to 8, each once, and at least
one of `classic` and `tactical`). Left out,
every style is offered, as before. A ruleset whose rules need a board (areas, reach, cover, flanking)
says `"styles": ["tactical"]`: the New Game wizard and the game's settings then offer only Tactical,
and so its fights always have positions. A game already saved on a style you do not list plays the
first one you do that the client can draw (the first built-in one you list, on a client without a
registered style you list), and a game cannot be
made, or switched in its settings, to a style you leave out. A fight already under way keeps the
style it began on. The list holds whether or not the combat director is on, so it also narrows
Marinara's own Classic and Tactical battles on your ruleset. A ruleset using `styles` needs
Capability API 1.379.

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

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
  begins. That is the only moment they are bought in unless `combat.signatureAtTurnStart` says
  otherwise: a signature action is on nobody's turn menu, its own included.
- **A foe's turn starts** (Capability API 1.805). With `"combat": {"signatureAtTurnStart": true}`,
  everybody holding `signaturePoints` is also asked as an opponent's turn starts, once what that
  start sets off (conditions, saves, reactions) has happened and before the opponent acts: a boss
  answering the hero about to act, as a generic fight's anticipation does. A lair's actions keep
  their own count and are not offered there. Left out, signature actions are bought only between
  turns, as 5e's legendary actions are. A ruleset using it needs Capability API 1.805.
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
  obstacles. A creature is moved only by its own walk, a mount's walk, a teleport, what pushes it
  (a contest, an entry, a creature's action or a zone), and whoever drags it.
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
