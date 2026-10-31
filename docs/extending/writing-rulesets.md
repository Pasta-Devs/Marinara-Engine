# Writing Game Mode Rulesets

A ruleset tells Game Mode how a tabletop system works: which dice a check rolls, what is on the character sheet, which resources get spent, and what a rest gives back. This guide is for people who want to write their own and share it. To play on a ruleset somebody else made, start with [Playing with a Ruleset](../game/rulesets.md).

A ruleset is one JSON file. It is data, not code. Nothing in it runs, so importing one cannot do anything to your computer. The one part that deserves a careful read before you import somebody else's file is the Game Master text, because that text is sent to the model in every game that uses the ruleset.

## Read this first: what a ruleset can and cannot do

A ruleset can only fill in the blanks of a mechanic the Engine already knows. Today the Engine knows five ways to resolve a check, and your file picks one with `resolution.kind`:

- **`dice-sum`**: roll some dice, add numbers from the sheet, and meet or beat a difficulty. That covers d20 systems, 2d6 plus stat systems, and many others.
- **`dice-pool`**: throw the character's own number of dice and count the ones that reach a target. That covers systems where a rating is a handful of dice rather than a bonus.

- **`dice-highest`**: throw a pool and read its highest die, or add its highest few. That covers Blades in the Dark and Trophy Dark.
- **`roll-against`**: roll at or under (or over) the sheet's number. That covers percentile skills and GURPS checks.
- **`symbol-pool`**: build and upgrade narrative dice, then cancel opposing symbols. That covers Genesys checks, and its fights since Capability API 1.382.

All five are described in full under [Resolution kinds](ruleset-checks.md#resolution-kinds).

A mechanic that does not fit these shapes cannot be written in a ruleset file. Opposed pools are one example. Each of those needs a new resolution kind inside the Engine, which is a code contribution with tests, not a JSON file. If your system needs one, open a feature request on the Engine repository and describe the mechanic with a few worked rolls. Those worked rolls become the tests.

Game Mode can resolve a fight using Marinara's own combat or your ruleset's rules. An optional `battle` block lends Marinara's combat the numbers on your character sheets: see [Battles](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). An optional `combat` block instead defines how the ruleset resolves the fight: see [Combat](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). The Engine plays those rules today. The game's Combat Preference selects the Classic presentation or, when the ruleset defines distance, a Tactical battlefield. A ruleset may limit which of these its games play with `combat.styles` (see [Which styles a game may play](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

## Quickstart

1. Copy the example file that matches how your system rolls. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) is a small 2d6 system with three stats, written to show that nothing in the format assumes a d20 or six abilities. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) is a small ten-sided dice pool with three ratings and six trades. For a full-size example, see the official [5e (SRD 5.1) package](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014): its `ruleset.json` and `catalogs/` are what the Agent Organizer installs.
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

## The pages of this guide

This page covers what a ruleset is, how to start one, and how to try and share it. The rest of the guide is split by subject:

- [Ruleset Checks](ruleset-checks.md): How a ruleset rolls a check or a save: the five resolution kinds, outcome bands, checks that roll their own way, and spending or charms that change a roll
- [Ruleset Sheets](ruleset-sheets.md): What goes on a ruleset's character sheet: abilities, skills, fields and lists, live states, wound tracks, penalties, rests and the Game Master text, plus the party sheet and progress clocks
- [Ruleset Catalogs](ruleset-catalogs.md): Ready-made entries the sheet editor offers in a picker: the catalog header, entries, values the ruleset keeps, sheet commands and the use command
- [Ruleset Entry Mechanics](ruleset-mechanics.md): What a catalog entry does in numbers: the `mechanics` block of an entry, read by checks, rests and fights
- [Ruleset Character Builder](ruleset-character-builder.md): The guided builder: making a character in steps, from race and class to scores, proficiencies, spells and gear
- [Ruleset Items](ruleset-items.md): What a party carries: categories, weapons, armor, ammunition, loot, money, starting gear and markets
- [Ruleset Combat](ruleset-combat.md): How a ruleset takes part in a fight: the `battle` block, which lends Marinara's combat the sheet, and the `combat` block, which resolves the whole fight by the ruleset's own rules, with its bestiary, board, reactions and contests
- [Ruleset Layers, Translations and Migrations](ruleset-layers-and-translations.md): Variants a player turns on for one game, translations of a ruleset's text, and moving values to new ids when a sheet changes

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

The manifest lists `ruleset.json` and each `catalogs/<id>.json` in `contributions.assets.paths` and in `files`, with each one's size and sha256. A ruleset editor such as Pixelforge makes one. **Import agents** → **Game Mode ruleset** takes the file and shows the same review as for a ruleset file, with each catalog and its number of entries. Nothing in it is compressed, so it never holds more than its own size. It is read as data and never installed as a package: it is refused, with the reason, if it holds anything else (another key, any other file, a document that is not strict base64 or not UTF-8 text), if its manifest is more than a ruleset's (any code, permissions or other contributions), if a file is not the one the manifest lists, if a `$comment` is longer than 2,000 characters or `$schema` names anything but the Engine's own schema, or if the ruleset or a catalog does not read. It is filed as `local/<its id>` like a ruleset file, at most 132 MB, with at most 12 catalog files of 2 MB each and 40 translations of 8 MB each (see below). A version is its ruleset and its catalogs together, so a changed catalog needs a higher `version` too. Ruleset packages are not accepted as zips.

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

**In the official catalog.** A widely played system with clean licensing can be offered to everyone through **Agent Organizer**. That is a pull request to the [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) repository. Look at the `ruleset-5e-2014` package there for the layout.

## Licensing

Only publish rules text you have the right to share. Many systems publish a reference document under an open license, and that document is what you may copy from. Put the license id and the attribution text the license asks for under `license`. Do not copy text from rulebooks that are not openly licensed. A ruleset mostly needs names and numbers, and the Game Master text should be your own words.

## Troubleshooting

- **The import says a name does not exist.** Something in the file points at an id that is not declared, such as a skill naming an ability you removed. The message gives the path to the line.
- **The import says a version is already installed with different contents.** Raise `version` and import again.
- **My ruleset is missing from the setup wizard.** Check that **Allow custom Agent imports** is on. While it is off, imported rulesets are left out of new games. Games that already use one keep working.
- **A game says its ruleset is missing.** The exact version the game was created on is not installed. Import that version of the file again.
