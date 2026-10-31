# Ruleset Items

This page is part of [Writing Game Mode Rulesets](writing-rulesets.md). What a party carries: categories, weapons, armor, ammunition, loot, money, starting gear and markets.

Armor, weapons, potions, gear, ammunition and money are items. An optional `items` block declares the words every item of your ruleset is written in, and a catalog with `holds: "items"` lists the items themselves. Both need Capability API 1.49; the block's `rarityCaps` and `propose`, which govern the items the Game Master invents, need 1.51, a value that reads the items a character holds (`itemStat`) needs 1.52, what an item does to checks while worn or carried, with the block's `bonus` caps, needs 1.53, what an item asks of its wearer and the abilities it changes need 1.54, a weapon's `attack` needs 1.55, what an item does in a fight needs 1.56, what a weapon shoots and holds loaded needs 1.57, a weapon's modes, off-hand attack, floor and conditions on a hit need 1.58, what using an item does in a fight, with the charges it holds, needs 1.59, a use that restores a pool needs 1.60, charges regained on a rest or an item that breaks when emptied need 1.61, a use that asks a check first (`gate`) needs 1.62, loot tables and a creature's loot need 1.63, a loot line that drops coins or a layer that takes coins out needs 1.64, a market, an item's `sold` place and a `service` need 1.65, a market day (a purse, `buyBack`, a seller's `stock`, a `limited` count, or a `sold` that names no place) needs 1.69, a rider that fires on held weapons (`weapons`) needs 1.70, starting gear (`startingGear`) needs 1.78, a risky item, a fake or a dishonest seller needs 1.79, and a market's `unsold` (or a layer's `items`) needs 1.813.

## The items block

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
- `carry`: optional. `stat` names the number stat that is an item's weight, whose `min` is 0 or more. `encumberedAbove` is how much a character carries before they are encumbered, and `limit` (optional) the most they can carry at all. Both are read off the sheet like `binding.max`. Without `carry`, weight means nothing and nobody is ever encumbered. `unit` (optional, up to 12 letters, Capability API 1.791) is what a weight is counted in, such as `"lb"`: the inventory's load, the starting gear picker's weights and a kit option's weight say it after the number.
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

## An item

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

## What reads items

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

## Items on the sheet

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

## Checks outside a fight

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

## Typed defenses from conditions, levels, items and sheet rows

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

## Weapons in a fight

An item may be a weapon (Capability API 1.55). Its `attack` is the shape a combat block's [attack rows](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) have, with values in place of columns, and a [ruleset fight](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) offers it as an attack while the item is worn: held in the hands it takes, and bound where it binds. One put away or only carried offers nothing, and the attack rows and a creature's own actions work exactly as before. Ember Roads' hand axe:

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

### Ammunition and reloading

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

### Modes, a second weapon, a floor and conditions on a hit

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
- `plus`: up to three more amounts on each hit, each `{ "dice", "flat", "type", "save", "targetIs", "when" }` and rolled, typed and resisted on its own (Capability API 1.169). `save` names its own `difficulty` and `onSuccess` (`half` or `none`). `targetIs` deals it only to a target of those creature types or tags (see Creature types and target tests under [Every key](ruleset-combat.md#every-key) on the combat page). `when: "critical"` deals it only on a critical hit; any clause's dice are doubled on a critical hit as the weapon's are. A javelin of lightning is `{ "dice": "4d6", "type": "lightning" }`; a dragon slayer `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; a sword of sharpness `{ "flat": 14, "type": "slashing", "when": "critical" }`. A forecast counts a clause only against a target it reaches and never a critical-only one. `when: "toggled"` deals it only while the item's switch is on (Capability API 1.170, see `toggle` below).

The weapon's details and the Game Master's line say all of it: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` and `Marked for 2 rounds when a hit deals 2 or more`.

## Armor and worn effects in a fight

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

## Using items in a fight

An item may be used in a fight (Capability API 1.59): a poultice pressed on a cut, a tonic swallowed, a bell rung. Its `use` says what using it does in the words a catalog entry's `mechanics` use (see [What a fight reads from `mechanics`](ruleset-combat.md#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` or `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire`, and since Capability API 1.174 `concentration` and `zone`, with the `budget` it spends, or `free`. Ember Roads' poultice, and Gravewatch's warming tonic and dawn bell:

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

## Items in Classic and Tactical battles

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

## Loot

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
- A bestiary creature names the table it carries with `loot` (see [Creatures](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)). A won ruleset fight rolls the table of each creature defeated, and a fight the Engine does not resolve by your rules has no bestiary creatures, so it drops nothing.
- What drops goes into the shared view as an add does, the player's bag asked first, and what nobody can carry is left behind. The recap the Game Master gets says what dropped and that it is already in the bags, the journal says so, and a notification shows it.
- The Game Master rolls a table in the story with `[loot: table="grave_goods" who="Ada"]` (`who=` for one character's bag), measured from where the turn began like its inventory tags, so a regenerated reply drops once. Each item that drops is answered as an add, and its instructions list your tables.

## Money

Your `currencies` are the party's money. A coin is an item in the bags, a stack of each coin like any other, named by its `label`:

- It weighs one unit of your carry stat for every `perWeight` of its family's coins, counts toward its bearer's load and is placed by the carrying rule when it comes in. A family without `perWeight` weighs nothing.
- The player adds coins from the picker's **Coins** list, and splits, gives and merges them as any stack.
- A line above the inventory's stacks shows each family's coins in view and their worth in the family's smallest coin. The Game Master sees that worth beside each bag (`Coin worth 432 pennies`, or `no coins` for an empty purse, with the player's bag listed even when it holds nothing), and an item's `cost` beside the item (`costs 3 shillings`).
- The Game Master pays with `[inventory: action="pay" amount="3 shillings" who="Ada"]` and is paid with `action="earn"`. `amount` is a count and a coin, by its id or label, one of it or many, in any case (`1 penny`, `12 pennies`). A payment comes out of one bag (the player's without `who=`), in the coin's own family only: the largest coins that fit go first, then the smallest coin left that covers what is still owed is broken, and the change comes back in the family's smaller coins, largest first. The answer says what was paid and what came back: 3 shillings out of a purse holding one crown is `Paid with crowns ×1; shillings ×2 back.` A payment the bag cannot meet is refused (`cannot-afford`), and so is a coin you do not have (`unknown-coin`) and any payment in a ruleset without currencies (`no-currencies`). An earning is an add of that coin, into `who`'s bag or shared out by the carrying rule. The journal lists what was spent and earned, and a notification shows it. Its instructions list your coins, and only a ruleset with some has them.
- Buying is a payment and then an add, or, in a ruleset with a market, a `buy` (below). There is no shop screen.

## Starting gear

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

## Markets

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
- `unsold` (Capability API 1.813): filters for what no seller has among their wares, wherever `sold` and `sells` would put it. A seller's `stock` table may still roll one, so an odd lot is the only way to buy it, and sellers still buy it back. A layer may add to it (a low-magic setting's `[{ "tag": "magical" }]`, see [layers](ruleset-layers-and-translations.md)).
- An item with no `cost` is not for sale, and neither is one a layer hides or one whose coins a layer took out.

**Where the party is.** The Game Master says which place a scene is in and its size with `[place: name="Millbrook" size="market town"]`, the size by its id or label, and leaves the size out for somewhere with no market (a road, the wilds). The Engine answers each tag in place, refusing a size you do not have, and the last place it answered in its own replies the player sees, from the latest conversation start, is the place in force until another is said. A place tag a player types never counts. A regenerated reply reads only what came before the telling it replaces.

**Buying.** The Game Master buys with `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, `level` (the default without it) and `seller` (any seller here that sells the item, without it) optional. The Engine prices it at the place in force when the reply ends, takes the price out of the buyer's purse (the player's without `who=`) as a payment is, with change, and puts the item in their bag, or only pays for a service. Either both happen or neither does. The answer says what it cost (`price="12 shillings"`) and what was paid and given back, and a notification shows it. A buy is refused, and changes nothing, with no place said (`no-place`), a level, item or seller you do not have (`unknown-level`, `unknown-item`), no price (`not-for-sale`), a place too small for the item (`not-here`), no seller here who sells it (`no-seller`), a seller whose `only` the buyer does not meet (`not-to-you`), a purse that cannot meet it (`cannot-afford`), or a bag that cannot carry it.

**What the Game Master sees.** While a scene is at a place with a market, a MARKET block names the place and its size, the price levels, and each seller there with a dozen of what they sell at the default level, cheapest first; anything they sell can be bought by name. Its instructions teach `[place:]` and `buy`, and only a ruleset with a market has them.

### A market day

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

### Honest and dishonest sellers

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

### Spotting fakes

Capability API 1.802 lets a character tell a fake for what it is, by a check they make or by noticing it before anybody pays. The Engine knows none of the checks by name: the ruleset writes them.

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- **`tells`** on a fake (up to six): each a check anyone may make (`check` is a skill, an ability or a value off the sheet, as a use's `gate` names one), its difficulty `dc`, and what a success sees (`says`). `needs` is what the sheet must meet to make it at all (with `needsAny`, any one of them), and `carries` an item the checker must have in their own bag, such as the kit a tool check is made with. With any one line of `advantageIf` met it is rolled with advantage, with any one of `disadvantageIf` with disadvantage.
- **`manner`** on a dishonest seller: a check on the seller rather than the item, with the same parts. A success says something is off about what they sell, never what it is.
- **Inspecting**: `[inventory: action="inspect" item="Potion of Healing" who="Mira"]` looks over an item in Mira's bag, and `seller="Fence"` looks over a ware a seller here shows today, before anyone buys. The inventory's **Inspect** button, offered by a ruleset whose fakes can be spotted, says "I look my Potion of Healing over carefully before trusting it." for the Game Master to write the tag. The Engine rolls the best check the character can make about it, with the ruleset's own dice: a fake's tells, and a dishonest seller's manner. A success on a fake finds it suspect: the answer says what they saw, and the bag shows "Mira thinks it is a fake" while it is still called what it passes for. A success by `items.namesItAt` or more (5 in 5e) on a tell also names it, and from then on it is its true item. A real item rolls the tells of the fakes that pass for it, so asking gives nothing away, and a success says it looks genuine. Each character tries once per item (a stack keeps who has; a ware is remembered for the market day); a failure says they cannot tell. An item nothing could give away, or one a character cannot check at all, is refused with `nothing-to-check`, and the try is not spent.
- **Noticing before a buy**: when a buy would get a fake from a dishonest seller, every other member of the party weighs each check they can make about it and the seller, with no dice: `items.passiveBase` (10 by default) and their number, 5 more with advantage and 5 less with disadvantage. The first who meets a difficulty has noticed: nothing is paid, and the buy is answered `reason="held"` with who noticed what. The Game Master is asked to play it as that companion warning the buyer in character, without accusing the seller to their face unless that companion's personality would, and to let the buyer decide. The player is not told anything else. The same buy from that seller asked again that day goes through. `items.warnBy: "roll"` rolls those checks instead.
- **Seeing through fakes**: `items.revealsFakes` lists the ways of seeing through fakes a character may cast on an item (a spell, a ritual), each with an `id`, its `label` and, for one that sees only some fakes, the `tags` they carry or the fakes themselves by ref (`items`, which only fakes may be). Naming the fakes keeps a telling tag off them: a potion of poison tagged "poison" would give itself away beside the healing potion it passes for. `[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]` names one: a fake it reads is named, one whose `foolsReveal` lists it shows as what it passes for, and a fake it cannot read, or a real item, shows nothing ("genuine" for a way that reads any fake, else "unsure"). It costs no try; whatever casting it costs is the Game Master's, as any spell's is.
- A ruleset using any of these needs Capability API 1.802. A fake's `tells` or `foolsReveal` on an item that is no fake, a `carries` item or a `revealsFakes` item that is not one of the ruleset's (a fake, for `items`), and a `foolsReveal` id that `revealsFakes` does not list are refused at install.

## Using items outside a fight

The same `use` works outside a fight (Capability API 1.60 for `restore`; the rest needs nothing new). The inventory's **Use** button, on one of your items with a `use`, and the Game Master's `[inventory: action="use" item="Poultice" who="Juno"]` both do what the item does to whoever carries it, with the Engine's dice:

- A heal gives back health: the amount on a health pool or a plain health track, or one mark cleared on a wound track, as a heal in a fight does. `temporary` points go on a health pool, `restore` gives back its pool, and each condition it `applies` is put on, until something takes it off.
- A use that harms, or is aimed at the other side (`kind` `attack` or `debuff`, or `targets` `enemy`), lands on nobody: outside a fight there is nobody on the board to hit. The item is still used, and the Game Master is told what it does, to narrate.
- It takes one off the stack or spends its charges exactly as a fight does, and one with none left, or one that takes a slot or binds and is not worn, is refused and changes nothing. The sheet and the bag are written together.
- A `gate` is rolled first, as a check is: the ruleset's own dice with the sheet's number, the user's wound penalty and what their conditions and worn or carried items do to that check. A failed one uses the item up for nothing, and the line says so ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

What happened is said in one line: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." The Use button sends it to the Game Master in an `[item_used]` block after "I use my Poultice.", which the chat shows as a badge; the Game Master's own tag is answered with it, measured from where the turn began like its other tags, so a regenerated reply never uses an item twice. An item without a `use`, or in a game without a ruleset, is still simply said: "I use my rope."
