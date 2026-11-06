# Ruleset Creator's Guide

Use this page to plan a Game Mode ruleset for your own tabletop system before you open the reference pages. It explains how the parts of a ruleset fit together, which choices matter most, and what we learned converting 16 very different systems. The key-by-key reference starts at [Writing Game Mode Rulesets](../extending/writing-rulesets.md), and every section below links the page it summarises.

A ruleset is one JSON file (or a package of files) that tells Marinara Engine how your system works. The Engine then rolls every check, applies every sheet change and can run whole fights by your rules. Nothing in a ruleset is code, so you design by filling in mechanics the Engine already knows. A mechanic it does not know is an Engine feature request.

Each key below names the Capability API minor that added it. A package that uses the key declares that minor or newer (see [Versioning, testing and publishing](#versioning-testing-and-publishing)).

Two terms are easy to mix up:

- **Classic and Tactical** are _combat styles_: a menu battle with front and back rows, or a battle on a board. Any game, with or without a ruleset, plays one of them.
- **Marinara's own rules** are what a game uses when it has no ruleset. A ruleset replaces them.

## Anatomy of a ruleset

A ruleset is one JSON file of at most 512 KB, validated whole on import. Bigger rulesets split their catalogs into a package. Start by copying the example closest to your dice:

- [`ember-roads.json`](../examples/rulesets/ember-roads.json): 2d6 plus a stat.
- [`gravewatch.json`](../examples/rulesets/gravewatch.json): a d10 pool.
- The full [5e (SRD 5.1) package](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) in Marinara-Agents.

Point your editor at the [JSON Schema](../extending/ruleset.schema.json) with a `$schema` line for autocomplete and typo checks.

| Key                                                            | What it holds                                                                                                      | Reference                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `id`, `version`, `name`, `edition`, `license` | Identity. `version` is a whole number raised on every published change                                             | [Writing rulesets](../extending/writing-rulesets.md)                                                                                               |
| `coverage`                                                     | What the ruleset handles (checks, combat and so on) and the wizard's one-line summary                              | [Writing rulesets](../extending/writing-rulesets.md)                                                                                               |
| `resolution`                                                   | How a check is rolled: one of five kinds, plus outcome bands, spends and rerolls                                   | [Checks](../extending/ruleset-checks.md)                                                                                                           |
| `sheet`                                                        | Abilities, skills, fields, lists, live pools, tracks, states, wound tracks, penalties, migrations                  | [Sheets](../extending/ruleset-sheets.md)                                                                                                           |
| `party`, `clocks`                                              | A shared party sheet (crew, ship, story points) and progress clocks                                                | [Sheets](../extending/ruleset-sheets.md)                                                                                                           |
| `rests`                                                        | What each rest restores and clears                                                                                 | [Sheets](../extending/ruleset-sheets.md)                                                                                                           |
| `gm`, `gmReference`                                            | Game Master text, the per-character summary, who plays opponents, and a rules reference of up to 16,000 characters | [Sheets](../extending/ruleset-sheets.md)                                                                                                           |
| `catalogs`                                                     | Ready-made entries (spells, talents, creatures), each with an optional `mechanics` block                           | [Catalogs](../extending/ruleset-catalogs.md), [Mechanics](../extending/ruleset-mechanics.md), [Builder](../extending/ruleset-character-builder.md) |
| `items`                                                        | Categories, weapons, armour, ammunition, loot, money, starting gear, markets                                       | [Items](../extending/ruleset-items.md)                                                                                                             |
| `battle`                                                       | Lends your sheet's numbers to Marinara's own Classic and Tactical fights                                           | [Combat](../extending/ruleset-combat.md)                                                                                                           |
| `combat`                                                       | Runs the whole fight by your rules, with a bestiary, board, reactions and contests                                 | [Combat](../extending/ruleset-combat.md)                                                                                                           |
| `layers`                                                       | Variants a player turns on for one game (Low magic, Hard winter)                                                   | [Layers and translations](../extending/ruleset-layers-and-translations.md)                                                                         |

**Ids.** The ruleset id is lowercase letters, digits and single hyphens (`ember-roads`). Ids inside the sheet are lowercase letters, digits and underscores, starting with a letter (`grit_max`). Keep ids stable once you publish, because saved characters, other rulesets that borrow your catalogs, and Experience overlays all point at them.

**Prompt-safe text.** Anything that reaches the model (names, labels, Game Master text) is one line, with no square brackets and no `{{` or `}}`.

**Packages.** A ruleset too big for one file ships as `<id>.ruleset.json`: a manifest plus `ruleset.json`, up to 12 `catalogs/<id>.json` files of 2 MB each, and up to 40 translations, all as base64. Zips are refused. A ruleset editor such as Pixelforge builds this file for you. The manifest declares the Capability API minor your ruleset needs.

**Where a ruleset is filed.** An imported file becomes `local/<id>`, a GitHub repository's becomes `<owner>/<id>`, and the official catalog's keeps its bare id. Two authors can each publish a `v20` without clashing.

## Checks, dice and the sheet

Your first and biggest decision is `resolution.kind`, because everything else is read through it. The Game Master only names a skill and a difficulty. The Engine rolls, does the arithmetic off the sheet, and tells the model the result, so never write Game Master text that asks the model to do math.

| Kind           | How it rolls                                                                                                                             | Systems it fits                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `dice-sum`     | Roll dice, add sheet numbers, meet or beat a difficulty. Custom faces, open-ended chains and exploding dice are supported                | d20 games, 2d6 plus stat, Fate (4dF as faces −1/0/+1), Rolemaster  |
| `dice-pool`    | Throw a number of dice from the sheet and count those that reach a target. The target can come from the sheet, per check, above or below | World of Darkness, Exalted, Shadowrun-likes, Lasers & Feelings     |
| `dice-highest` | Throw a pool and read the highest die, or add the top few. A zero-dice rule and a second "dark" set are supported                        | Blades in the Dark and other Forged in the Dark games, Trophy Dark |
| `roll-against` | Roll at or under (or over) the sheet's number                                                                                            | Call of Cthulhu, GURPS, BRP, old-school X-in-6                     |
| `symbol-pool`  | Build and upgrade narrative dice, cancel opposing symbols                                                                                | Genesys and similar                                                |

Then add what your system needs. All of it is in [Ruleset Checks](../extending/ruleset-checks.md):

- **Outcome bands** (`resolution.outcomes`, 1.135): two to eight labelled results by margin or total, such as degrees of success, "success at a cost" or hard and extreme successes. Each band can carry a line telling the Game Master what it means at the table. This was the most widely needed feature across the systems we converted.
- **Checks that roll their own way** (`resolution.overrides`, 1.140): a few skills on different dice, such as thief skills on d100 and Open Doors on d6 in a d20 game.
- **Spending to change a roll** (`resolution.spend`) and free rerolls (`resolution.reroll`): willpower for a success, Luck, hero points. `perCheck` caps what one roll can buy, so a full pool cannot buy a sure thing.
- **A charm that changes a roll**: put `mechanics.check` on the catalog entry a character picked, bought with that entry's own cost.

**What a check cannot do yet.** Opposed pools (two rollers compared) and sum pools with a wild die, as in OpenD6. Both need a new resolution kind inside the Engine. If your system depends on one, open a feature request on the Engine repository with a few worked rolls; those become the tests.

**The sheet** ([Ruleset Sheets](../extending/ruleset-sheets.md)) holds abilities, skills, fields, lists and derived values, plus live state the Engine changes in play:

- **Pools** such as hit points, willpower, motes or spell slots, spent and restored by sheet commands and rests.
- **Tracks** such as stress, Ruin or XP, with triggers when they fill.
- **Wound tracks**, for health that is named levels or numbered boxes instead of a number, with penalties on rolls.
- **Live states** such as a form, a stance or anima, which can change rolls while they hold.
- **Party sheet and clocks**: a crew, ship or shared story points, and progress clocks of 4, 6 or 8 segments.

The Game Master changes the sheet through sheet commands the Engine teaches it automatically, using your own ids, so you do not explain them in `gm.sheetGuidance`. Permanent advancement (XP, new dots, level-ups) uses catalog sheet commands; see [Ruleset Catalogs](../extending/ruleset-catalogs.md).

**Making characters.** The [character builder](../extending/ruleset-character-builder.md) walks a player through steps you define: origin and class, scores (rolled, bought or assigned), proficiencies, spells, gear and starting coin, with legality checks and shared party creation. Catalogs can borrow another installed ruleset's catalog with `from` (1.220), so a 5e variant can reuse the SRD's creatures and spells instead of copying them.

**Game Master text.** `gm.checkGuidance` and `gm.sheetGuidance` (1,500 characters each) are sent every turn, so keep them tight. `gm.worldGuidance` is read once, when the world is made ("no gunpowder", "magic is rare"). `gmReference` holds up to 16,000 characters of fuller rules in the stable system prompt. `gm.sheetSummary` picks what the model sees per character, and everything there costs tokens every turn. Write all of it in your own words, never copied rulebook text.

## Combat

A ruleset takes part in fights at one of three depths. You can start shallow and go deeper later. Pick by how much your system's identity lives in its fights.

| Depth          | What you write                                                                        | What happens in a fight                                                                                                                                   | Good for                                                          |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| None           | No `battle` or `combat` block                                                         | Marinara's own Classic or Tactical combat builds the fighters itself. The sheet is untouched                                                              | Narrative systems where fights are fiction (Fate, Blades, Trophy) |
| Lend the sheet | A `battle` block: health pool, optional energy pool, spell slots, up to 8 skill lists | Marinara's math and dice, but health starts as the same share of the bar as on the sheet, and the result is written back                                  | Light systems that want consequences to stick                     |
| Your own rules | A `combat` block                                                                      | Your dice resolve every attack, save and contest. Opponents come from your bestiary or threat scale, and every cost is written to the sheet as it happens | Crunchy tactical systems (5e, Pathfinder, Storyteller, Genesys)   |

**The `combat` block** parameterises one of three kinds the Engine owns: `attack-vs-defense` (dice against a defense number), `dice-pool` (your pools, counting successes) or `symbol-pool` (narrative dice with spends, 1.382). The essentials are `health` (a pool counted down, a wound track marked, or a plain track that fills up, 1.383), `defense`, `initiative`, `attackRoll`, an action `economy`, and the lists that become `attacks` and `abilities`. A complete small block is about 25 lines; the Ember Roads block in [Ruleset Combat](../extending/ruleset-combat.md#combat-a-fight-your-own-rules-resolve) is a good template.

Beyond the essentials, add what your system needs:

- **Conditions**, with effects from a closed list (defense, attack rolls, saves, contests, speed, maximum health, damage dealt and taken).
- **Saves**, concentration, dying rules, and reactions held in **windows** (an entry can wait for `used`, `aimed`, `hit`, `harmed`, `falls` or `turn-start`).
- **Contests** for grabbing, shoving and breaking free.
- **Creatures**: a bestiary catalog the fight reads, with stat blocks, actions, senses and spellcasting. A **threat scale** lets the Game Master invent an opponent for one fight, and `combat.threat.budget` (1.803) builds encounters to an experience budget per difficulty.
- **Entry mechanics** on catalog entries: area shapes, lasting zones, walls, summons, cures and senses. See [Ruleset Entry Mechanics](../extending/ruleset-mechanics.md).

**Classic or Tactical.** Your own fights get a board only if `combat` declares `distance` (`label`, `perCell`) and the sheet or creatures give movement. Without them, a Tactical game still plays your rules as theatre of the mind. If your rules depend on position (areas, reach, flanking), set `"styles": ["tactical"]` (1.379) so every game on your ruleset has a board.

**Creature art** is separate from rules: a [creature pack](../extending/writing-creature-packs.md) (`.creatures.json`, easiest made in Pixelforge) draws your bestiary on the Tactical board by matching creature ids. Anything without art keeps a token.

**Known limits** are listed under [Not yet](../extending/ruleset-combat.md#not-yet). The ones conversions hit most were opposed defence rolls (Dodge and Fight Back, Parry and Block), hit locations, side initiative, and reactions to reactions. The Game Master narrates those around the Engine's fight.

## The fight AI: minds, temperaments and who plays opponents

The Engine plays every opponent and AI companion nobody else controls, with no model call per turn. It is ruleset-neutral: we tested it on Storyteller, Exalted, old-school, Call of Cthulhu, GURPS and Genesys conversions as well as 5e. It works without any of the keys below; they make your creatures fight like themselves. All are in [Ruleset Entry Mechanics](../extending/ruleset-mechanics.md), and the design is in [Game Mode combat AI](game-combat-ai.md).

| Key                                                               | What it controls                                                                                                                                                                                                          | API            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `mind` on a creature, or `combat.minds` tiers keyed on an ability | How much thought it puts in: `mindless`, `instinct`, `cunning`, `tactical`, `genius`. Beasts default to instinct, constructs and oozes to mindless                                                                        | 1.761          |
| `behavior.temperament`                                            | How it fights: reckless, cautious, opportunistic, protective, supportive, disciplined, cowardly, patient, methodical, coordinated                                                                                         | 1.763          |
| Story-only temperaments                                           | `fanatical` (never breaks), `arrogant` (holds back, takes to the air when legendary and losing), `territorial`, `cruel`, `honourable` (offers the party Surrender), `hungry` (drags a victim away). Never dealt at random | 1.778 to 1.784 |
| `behavior.role`                                                   | bruiser, bulwark, skirmisher, marksman, spellcaster, supporter, controller, `solo` (1.776). Dealt from its abilities if unsaid                                                                                            | 1.763          |
| `behavior.targets`, `opens`, `pack`, `ambush`                     | Target priorities, an opening move, pack tactics, waiting in hiding                                                                                                                                                       | 1.763          |
| `behavior.shifts`                                                 | A temperament that turns when bloodied, an ally falls, the leader falls or it is cornered                                                                                                                                 | 1.779          |
| `combat.morale`                                                   | When and how foes check their nerve (2d6 under a score, or a save), and who surrenders                                                                                                                                    | 1.762, 1.775   |
| `gm.opposition: "game-master"`                                    | The Game Master plays every opponent, picking from the Engine's legal options, with the Engine as fallback                                                                                                                | 1.774          |

`behavior` can sit on the whole `combat` block, on a creature type, or on one stat block, each overriding the one before. Examples from the SRD: a wolf `{"targets": ["wounded"], "pack": true}`, a goblin `{"temperament": "cowardly", "targets": ["weakest"]}`, a ghoul `{"ambush": true}`.

**For board fights the AI needs** `combat.distance`, movement (`combat.economy.movement` or a creature `speed`), a `range` on ranged attacks and weapon rows, and an `area` on anything that hits a zone. Without a range, a pistol only works at arm's length. Without areas, the AI never spreads out.

**Narrative systems.** By default the Engine plays ordinary foes and the Game Master plays bosses. For a system whose opposition is fiction rather than damage (Fate, Blades, Trophy, Lasers & Feelings), `gm.opposition: "game-master"` lets the model play every opponent in character. It only takes effect when the player turned on "GM directs bosses" at setup, because that is their consent to model calls during fights.

**Without a combat block**, your games still get morale in Classic and Tactical fights: each non-boss, non-mindless foe gets a 2 to 12 score from its mind and temperament, and thinking foes may surrender. The encounter writer can mark a side's `leader`.

**Party temperament.** Each party member gets a temperament from their Description when a game starts, and it changes only for story reasons at the end-of-session review. AI companions fight by it. A ruleset does not set it, but your Game Master text can lean on it.

## Layers, overlays and migrations

Three mechanisms change a ruleset without forking it. Use a layer for a variant the player picks, an overlay for content that belongs to one adventure, and a migration when you reshape the sheet.

**Layers** (`layers`, up to 12) are toggles in the New Game wizard, fixed for that game's life. A layer can only narrow or add text, never add rules:

- append Game Master guidance (`gm.guidance`, `gm.worldGuidance`; 4,000 characters per layer);
- remove values from an enum field, replace the difficulty ladder, or hide catalog entries by a declared filter;
- remove coins (1.64), remove market sellers, mark items unsold, or swap loot tables (1.813);
- declare `conflicts` with other layers.

A layer cannot add a field, value, skill, pool, rest, seller or loot table, change the resolution kind, or touch combat numbers. Characters keep anything a layer removes. The SRD's **Low magic** layer is a good model: spells capped at 5th level, items above uncommon rarer and not normally for sale, high-magic creatures kept out of random encounters, and world guidance asking the Game Master to explain why magic is rare. Other authors may copy it. Layers written for somebody else's ruleset are not supported yet.

**Overlays** (1.355) let an Experience's map pack add creatures, conditions, sheet conditions, items and tracks (1.367) to your ruleset while that Experience is on. Keep adventure-specific monsters and loot in an overlay, not in your base ruleset. An overlay that reuses one of your ids, or does not fit, is dropped whole, which is another reason to keep ids stable. Reference: [ruleset overlays](optional-agent-packages.md#capability-api-1355-ruleset-overlays).

**Migrations** (`sheet.migrations`, 1.77) say how saved characters move when you rename a field, split one level into per-class levels, or split a pool. Adding things needs no migration; raise `sheet.version` when the sheet's shape changes. Reference: [Layers, Translations and Migrations](../extending/ruleset-layers-and-translations.md).

## Translations

Write the ruleset in English and ship each other language as its own translation file (1.811). Translations are display only: rules, sheet commands and everything the Game Master is told stay in English, so a translation can never break a game.

A translation is keyed by the English string, word for word:

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

- Language codes match the Engine's own (`ru`, `pt-BR`, `zh-Hans`). A missing or empty string shows in English, and `pt-BR` falls back to `pt` first.
- **In a shared package file**, put them at `locales/<language>.json`, up to 40 of 8 MB each. Importing keeps only the Engine's current language; to switch, change the language and import again.
- **In the official catalog**, each language is a separate pack, `<id>-<version>.<language>.json`, listed under `locales` in the catalog entry with its URL, sha256, size, and a translated store name and description. The Engine downloads only the pack for its current language and swaps it when the language changes. Shipping all 11 SRD languages inside one file grew the download from 7 MB to 34 MB, which is why packs are separate.
- A corrected translation does not need a new `version`.

The SRD package ships 11 languages this way and is the model to copy. Reference: [Translations](../extending/ruleset-layers-and-translations.md#translations).

## The 5e (SRD 5.1) package: a full-size example

The [ruleset-5e-2014 package](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) in Marinara-Agents uses nearly every feature on this page, so look there when you want to see a key in real use. Things worth copying:

- **Layout**: `ruleset.json` plus one file per catalog under `catalogs/` (creatures, spells, magic items and more), built into a `.ruleset.json` package. Its README and MODELING.md explain how each rule was modelled.
- **Licensing**: CC BY 4.0 attribution under `license`, a "not affiliated" line, and no trademarked product names anywhere.
- **Full combat**: a d20 `attack-vs-defense` block with action, bonus action and reaction budgets, concentration, reactions such as Shield and Counterspell, a board, a full bestiary with minds and temperaments, and an encounter budget.
- **Builder**: race, class, rolled or bought scores, proficiencies, spells and starting gear.
- **A layer** (Low magic) and **11 translations** as on-demand packs.
- **Stable ids**: other rulesets borrow its creatures and spells, so its ids never change.
- **Regression tests** run as their own CI job on every change.

If your system is a d20 variant, consider borrowing its catalogs with `from` (1.220) rather than copying them.

## Designing similar systems: what the conversions taught us

We converted 16 systems from a community collection to this format, from rules-light story games to Rolemaster. The biggest lesson: a ruleset here is enforced, not suggested. The Engine rolls every check and applies every sheet change, so anything you leave to "the GM will handle it" is genuinely unhandled. Decide early what the Engine owns and what the Game Master narrates.

| System family      | Examples                            | Resolution     | Keys that made it work                                                                                                       | Left to the Game Master                                                      |
| ------------------ | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| d20 and d% crunch  | 5e, Pathfinder 2e, Rolemaster       | `dice-sum`     | Outcome bands for degrees of success; `openEnded` and `unmodified` for Rolemaster; `gmReference` for big tables              | Pathfinder's non-stacking bonus types; Rolemaster's crit tables beyond bands |
| Old-school         | OSE                                 | `dice-sum`     | `resolution.overrides` for thief skills (d100) and X-in-6 (d6); 2d6 morale                                                   | Side initiative (played as individual)                                       |
| Roll-under         | Call of Cthulhu 7e, GURPS Lite      | `roll-against` | `against`, bonus and penalty `tens` dice, critical faces, hard and extreme bands                                             | Opposed Dodge, Fight Back, Parry; GURPS hit locations                        |
| Storyteller pools  | V20, W20, Exalted 3e, Exalted WoD   | `dice-pool`    | Wound tracks with penalties, live states (forms, anima), overrides for 1s that do not cancel, a pool-based `combat` block    | Area Disciplines and Gifts unless written as entries                         |
| Forged in the Dark | Blades in the Dark, Trophy Dark     | `dice-highest` | `keep`, `zeroDice`, a `dark` dice set, bands (6 / 4 to 5 / 1 to 3), tracks with `onFull`, clocks, a party sheet for the crew | Fights, through `gm.opposition: "game-master"`                               |
| Stance pools       | Lasers & Feelings, an original game | `dice-pool`    | `target` read off the sheet, `stances` (under or over), `exact` for an exact match, a party sheet for the ship               | Fights, as fiction                                                           |
| Fate               | Fate Core                           | `dice-sum`     | Custom faces for 4dF, bands for a tie and success with style                                                                 | Invokes and compels as story; fights as fiction                              |
| Narrative dice     | Genesys                             | `symbol-pool`  | `combat.kind: "symbol-pool"` with `symbols.spends`, soak, and health on a filling Wounds track                               | Spends on checks outside fights                                              |

**Practical advice from those conversions:**

1. **Start from the dice, then the sheet, then the Game Master text.** Get one check rolling correctly before adding catalogs or combat.
2. **Use outcome bands everywhere your system has them.** Each band's `text` tells the model what happens at the table, which is where narrative systems live.
3. **Prefer no combat block over a half-right one.** A narrative system plays better with Marinara's own fights (or Game Master opposition) than with a combat block that half-models its rules.
4. **If you do write combat, give it the board basics**: `distance`, movement, ranges on ranged weapons, and at least one area attack. Every conversion we AI-tested lacked some of these, and its fights stalled or never used positioning.
5. **Check movement against your scale.** At 2 metres a cell, a creature speed of 2 could not climb hills and fights stalled.
6. **Write your sources down.** Keep a notes file per ruleset listing each source rule and how it was converted, especially where you chose between conflicting readings. It is the first thing reviewers ask for.
7. **When the Engine truly lacks a mechanic**, leave it to the Game Master in `gmReference` and file a feature request with worked examples. Many features on this page (outcome bands, `dice-highest`, `roll-against`, symbol fights, clocks, party sheets) exist because a conversion asked for them.

## Versioning, testing and publishing

**Two version numbers matter.** Your ruleset's `version` is a whole number you raise on every published change. An installed version is never rewritten, and every game stays tied to the exact version it was created on, so a running campaign never changes its math. The **Capability API** version says which Engine features your file needs. A package's manifest declares `schemaVersion: 2` and `capabilityApi: { "major": 1, "minor": N }`, where N is the highest minor of any key you use, so an older Engine is never offered your ruleset. Official catalog rulesets need at least 1.374. A plain file you import needs nothing, because the Engine reading it validates it.

**The draft loop.** Edit, raise `version`, import, start a new game. Importing the same version with different contents is refused. Old versions stay installed until you remove the ruleset. Raise `sheet.version` when the sheet's shape changes, and write a migration when values move.

**Testing.**

- Use the `$schema` line so your editor catches typos and wrong types as you write.
- Import it: turn on **Settings → Advanced → Danger Zone → Allow custom Agent imports**, then use **Agents → Import agents → Game Mode ruleset**. The review lists every problem with its path before anything is saved, including names that point at nothing.
- Play a few checks of every kind you declared, including overrides, spends and each outcome band. The log shows the real arithmetic.
- If you have a `combat` block, fight in both Classic and Tactical, with AI companions, against creatures of each mind. Watch for stalls (nobody can reach anyone), friendly fire from areas, and foes that never use their best actions.
- Turn each layer on and off, and switch the Engine's language if you ship translations.
- If an Experience overlays your ruleset, `POST /api/game/experience/check` reports what does not fit.
- Ask a playtester who does not know your system to make a character with the builder.

**Publishing.** There are five routes, from simplest (details in [Sharing your ruleset](../extending/writing-rulesets.md#sharing-your-ruleset)):

1. Send the `.json` file.
2. Send a `.ruleset.json` package, with catalogs and translations inside.
3. Put it in a public GitHub repository under `rulesets/` (at most 32 files). Users add the repository as a custom source, and it is filed under your GitHub name.
4. Propose it for the official catalog with a pull request to [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), laid out like `ruleset-5e-2014`. This is for widely played systems with clean licensing.
5. Ship an Experience whose map pack overlays your ruleset with adventure content.

**Licensing.** Only publish rules text you have the right to share. Many systems have an openly licensed reference document; put its SPDX id and required attribution under `license`. A ruleset mostly needs names and numbers, so write all Game Master text in your own words.

### Before you share

- [ ] Ids are final and follow the id rules.
- [ ] `license` has the SPDX id and attribution, and no trademarked names are used without permission.
- [ ] Every check kind, override, spend and band was rolled at least once in a game.
- [ ] `gm.checkGuidance` and `gm.sheetGuidance` are short, never ask the model to do math, and are in your own words.
- [ ] Fights were played in each style your ruleset allows, or `combat.styles` limits them.
- [ ] The package manifest declares the right Capability API minor.
- [ ] `version` is raised since the last file anyone else has.
- [ ] A notes file explains how each source rule was converted.

## Related guides

- [Writing Game Mode Rulesets](../extending/writing-rulesets.md)
- [Game Mode architecture](game-mode-architecture.md), for changing the Engine's rules code
- [Game Mode combat AI](game-combat-ai.md)
- [Playing with a Ruleset](../game/rulesets.md)
