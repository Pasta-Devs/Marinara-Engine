# Game Mode: Playing with a Ruleset

A ruleset tells Game Mode how a tabletop system works: which dice a check rolls, what is on the character sheet, which resources get spent, what a rest gives back and, for some rulesets, how a whole fight is fought. Use this guide to get a ruleset, choose it for a game and see what changes in play. A game without one plays on Marinara's own rules, described in the other Game Mode guides.

## Get a ruleset

To install an official ruleset such as 5e (SRD 5.1):

1. Open the **Agents** panel (the Sparkles icon).
2. Select **Agent Organizer**.
3. Find the ruleset. Rulesets are marked **Rules**.
4. Select **Install**.

Then start a new game and pick it (see below). Rulesets come from two places:

- **Official** rulesets are installed as above.
- **Community** rulesets are imported from a file or an author's GitHub repository. They are filed by origin, such as `local/ember-roads` or `alice/v20`.

Importing uses the same **Allow custom Agent imports** switch as imported agents. While it is off, imported rulesets are left out of new games, and games that already use one keep working. A game on an imported ruleset always plays on the exact version it was created on. To write your own, see [Writing Game Mode Rulesets](../extending/writing-rulesets.md).

A ruleset's own text, such as skill names, spells and Game Master (GM) text, follows the language set in **Settings**. An official ruleset downloads only that language's translation, fetches a new one when you switch, and falls back to English for a language it lacks. A ruleset imported from a file keeps only the translation for the language you had at import. To switch, import the file again.

## Choose a ruleset for a game

**Rules** appears on the wizard's **World** step only when at least one ruleset is installed, and only for a new game. It is separate from **Combat Preference**: **Rules** sets how checks and sheets work, and **Combat Preference** sets how battles are shown.

1. In the setup wizard, open the **World** step.
2. Under **Rules**, keep **Marinara's own rules** (the built-in d20 checks and six-attribute sheet), or pick a ruleset such as **5e (SRD 5.1)**.
3. Read the summary. It lists what the ruleset covers and one line about battles (see [What happens in battles](#what-happens-in-battles)).
4. Optional: turn on **layers** (see below).
5. On the **Party** step, check who **Has a sheet** and who **Starts on a blank sheet**. A sheet is the character's numbers for this ruleset, such as scores and hit points. A blank sheet uses the ruleset's default values. You can fill one in later.

The ruleset is set when the game is created. You cannot change it or add one later.

**Layers** are named variants of a ruleset, such as Low magic or Hard winter. They show as toggles under the ruleset, with a line on what each does. A layer can:

- make difficulties harsher,
- narrow a choice on the sheet,
- hide some ready-made entries from the sheet editor's picker,
- change what shops sell and what treasure drops,
- give the GM extra instructions, including for the world it builds.

Some layers rule each other out, and the wizard disables the one you cannot have. Layers are fixed once the game starts. A sheet that already uses something a layer removes keeps it.

A sheet is added under **Stats** in the character or persona editor (see [Ruleset sheets](../characters/colors-and-stats.md#ruleset-sheets)). The game copies each sheet when it generates the world, and nothing you change in the game goes back to the character or persona. A member without a sheet gets a blank one with every value at the ruleset's default. World generation never makes up scores.

A shared setup file remembers its ruleset. If you import one and do not have that ruleset, or have an older version, the wizard says which ruleset it was, and the game uses Marinara's own rules unless you install it and pick it.

## What happens in battles

What a ruleset does in a fight depends on how it was written. The wizard's line under the ruleset says which row applies.

| The ruleset | Battles |
| --- | --- |
| Resolves its own fights, such as 5e (SRD 5.1) | Fought by the ruleset's own rules, on its own battle screen. See [Fights on a Ruleset](fighting-on-a-ruleset.md). |
| Lends its sheet to battles | Marinara's own combat, using the sheet's health, spell slots and abilities (see below). |
| Says nothing about battles | Marinara's own combat, exactly as with no ruleset. See [Combat](combat.md). |

When a ruleset lends its sheet, Marinara's combat uses the sheet like this:

- Each party member starts the fight with the resource pool and spell slots the ruleset set up for battles, as their sheet has them now.
- Abilities picked from the ruleset's catalogs become skills when Marinara's combat can use them. An entry that only describes something outside combat, a reaction, or one whose cost the battle cannot charge is left out.
- Hit points carry over as a share of the maximum, not as the sheet's number. A character at half health starts at half the battle screen's health bar, so a sheet with 9 health never walks into a fight where one hit does 12.
- When the fight ends, health lost or regained is carried back the same way, and slots and resources spent are written back as they are.

The rest is unchanged. The dice math is still Marinara's (see [How combat math works](combat.md#how-combat-math-works)), and the tabletop system's attack rolls, saving throws and concentration are not applied. A fight you leave by deleting the message it started in writes nothing back.

## Checks on a ruleset

The GM asks for checks as in any game (see [Skill checks](dice-and-skill-checks.md#skill-checks)), but the ruleset decides how they roll.

- The GM only names the skill or save and sets a difficulty. It is told the ruleset's difficulty ladder, not the built-in one. A difficulty may go as far as that ladder does, even past the 1 to 40 of Marinara's own rules. One path stays at 1 to 40: the fallback that rolls a check a saved turn still owes.
- Marinara rolls the ruleset's dice and adds the modifier from the character's **ruleset sheet**: the ability modifier when the skill or save names an ability, the bonus for training level (a multiple of a proficiency bonus, a flat number, or both) and any extra bonus on the sheet. Built-in skill bonuses and attributes are not used.
- Results follow the ruleset. Under 5e (SRD 5.1), a natural 20 or natural 1 has no special effect on checks and saves, so a natural 20 that misses the difficulty fails.
- If the ruleset's package is missing or older than the one the game was created on, checks are saved without numbers and stay owed. They are never rolled with another system's rules.

Marinara does not trust numbers the GM writes. A finished-looking tag is rolled again and replaced when its modifier is not the sheet's, when it rolled a different number or size of dice than the ruleset does, when the die it counted is not the one its roll mode keeps, or when it claims a natural result the ruleset does not have.

### What the GM can add to a check

| The GM writes | Effect |
| --- | --- |
| `who="Name"` | The check uses that party member's sheet. Without it, the player is checked. A member with no sheet rolls on a blank one. A name that matches nobody, or that two members share, rolls with no modifier. If a member shares your own character's name, that name still means you. Marinara never borrows someone else's sheet. |
| `with="Ability"` | Rolls the skill or save with a different ability. Only an ability the ruleset declares counts. Anything else is ignored. |
| `difficulty="Hard"` | Names a step of the ladder instead of a number. Marinara rolls against that step's number, and the saved check shows the number. An unknown name is ignored. |
| Roll placeholders | Can name the ruleset's abilities, skills and saves, and `PROF` for the proficiency bonus when the ruleset has one. |

A die you rolled yourself before the check is used only when the ruleset rolls a single d20. A ruleset that rolls other dice, such as 2d6 or a pool, ignores it.

### Sheet effects on a roll

- **Charms that change a roll.** The GM names the charm on the check, and Marinara takes its cost, applies its effect and rolls. A charm you have not picked, or cannot pay for, does nothing and costs nothing.
- **Spending a resource to steady a roll.** The GM says so on the check. Marinara takes the points, adds what they bought and rolls. If the pool cannot cover it, nothing is spent. The record shows what was really paid. The ruleset sets how much one check may buy: a fixed number, a number on your sheet, or as many as the check has dice.
- **Numbers that ride along.** If the ruleset says a sheet number applies to certain rolls, such as a heavy pack on every Brawn roll, Marinara adds it to every check it applies to, and the dice card says what the sheet added.
- **Untrained skills.** A ruleset can make an untrained check cost dice or points, be one step harder, or be impossible. A check you cannot attempt is not rolled, and the narration says so. Your sheet shows no number for such a skill until you train it.
- **Wounds.** If the ruleset has a wound track and says its penalty applies to rolls, being hurt makes every check harder. Under a pool ruleset it takes that many dice off the pool, never below the smallest pool the ruleset allows (some allow none). Under a ruleset that adds dice up, it is a flat penalty. The check says how much was applied. See [The ruleset sheet](#the-ruleset-sheet).

The GM also keeps each character's resources, conditions and rests current on the sheet, and Marinara refuses a change the sheet does not allow.

### Rulesets that roll a pool of dice

Some systems count dice instead of adding a bonus. The sheet's number is how many dice you throw, and you count the ones that come up high enough.

- **The sheet's number is dice.** A rating of 3 and a trade worth 2 throw five dice. The sheet shows "5 dice" rather than "+5".
- **Difficulty is a count of successes.** A hard job asks for three successes, not a total of 15. The ruleset's ladder says how many each step needs.
- **Marinara throws and counts.** The ruleset decides which faces count, whether a high face rolls another die or counts twice, whether low faces cancel successes, and what counts as a fumble or a standout success. The dice card shows every die, with the ones that reached the target picked out, and reads the successes against the number needed. A big pool wraps onto more rows, and the card never shows a total the dice were not added up to.
- **The GM can adjust one check**, if the ruleset allows: a harder or easier per-die target, dice added or removed for circumstances, and a lower face for dice to roll again or count twice. Each stays within the ruleset's range. A ladder step can carry its own per-die target. The dice card says when a check used a face other than the ruleset's usual one.
- **Dice can be thrown again**, if the ruleset has a rule for it. The GM names it on the check, and the dice that fell low are thrown again, once or until they come up higher. A resource you spend can buy the same. One roll is thrown again only one way. Where two apply, the one that reaches more dice is used.
- **Two abilities can be rolled together**, if the ruleset says so: two ratings are thrown as one pool.
- **A fumble can come with a result.** In a ruleset that counts low faces on half the dice or more as a fumble, a check that still got its successes keeps its result, and the card adds that something went wrong. With no successes, it is a critical failure.
- **The GM never supplies the numbers.** A pool result written into the narration is replaced by Marinara's own roll. Advantage and a pre-rolled die do not apply.
- **Seeing one die of each size does not apply.** The dice the GM is shown are twenty-sided. A pool check is rolled blind and narrated like any blind roll.

### Other ways a ruleset can roll

Marinara still throws the dice, and the dice card follows the ruleset:

- **Keep the highest dice.** Throw a handful and read the highest one, two or three.
- **Roll against your sheet.** Roll at or under a number on your sheet, such as a skill percentage.
- **Dice with their own faces.** Faces can be worth something other than their number, such as minus, blank and plus, or carry symbols such as success, advantage and their opposites.
- **Results in bands.** A check can land in a band, such as a critical success or a success at a cost, rather than a plain pass or fail. The card names the band and the GM narrates it.
- **A few checks rolled another way.** A ruleset can roll most checks one way and name a few that roll differently.

## The ruleset sheet

In a game on a ruleset, each character sheet starts with a **Ruleset sheet** block. Its layout comes from the ruleset, so a 5e sheet and another system's sheet look different. A game with no ruleset has no such block. See also [Character Profiles](party-and-npcs.md#character-profiles).

| Part | How it works |
| --- | --- |
| **Resources** | Hit points, spell slots or a class resource show what is left of the maximum. Use the minus and plus buttons, or type a number. A resource with a temporary buffer also shows **Temp**. |
| **Tracks** | Such as exhaustion. Step up and down within their range. |
| **Notes** | Short text boxes, such as what a character is concentrating on. |
| **Conditions** | Buttons you switch on and off. |
| **States** | A form or stance: one value from a list at a time. A state can change numbers that follow it, such as dice added to rolls, and a rest may reset it. |
| **Rest buttons** | Apply one of the ruleset's rests. The ruleset defines what a rest restores. It can also bring back item charges, such as a wand's, and the line under the buttons says what came back. Under 5e (SRD 5.1), a long rest restores hit points and spell slots and brings back half of the hit dice, at least one. |
| Build summary | Ability modifiers, trained skills and saves, and values the ruleset picks, such as armor class. |

**Wound tracks** are a row of boxes instead of a number, for systems that mark harm rather than count it. Each box names that level of hurt and says what it takes off your rolls.

1. If the ruleset has more than one kind of harm, pick the kind first.
2. Click **Mark** or **Clear one**. You can also click the next empty box to add a mark, or the last marked box to clear one. Other boxes do not respond to clicks.

A worse mark takes the higher box and pushes lighter ones down. The line underneath says which penalty is in force, and anything that did not fit the track. Some rulesets number their boxes instead of naming them, sometimes as many as your own rating, and some put each mark on the box it is aimed at. On those, you can click any clear box, **Clear one** takes the lightest mark on the highest box, and a full track refuses another mark instead of worsening an old one. A ruleset can add boxes from a list on your sheet, and have a rest or heal clear only one kind of harm.

### How the GM changes the sheet

The GM keeps the sheet current while it narrates. When a character spends a resource, takes damage, heals, gains or loses a condition, changes a state or rests, it records the change and Marinara checks it against the sheet. An impossible change, such as a spell cast with no slot left, is refused. Nothing changes, and a notice tells you.

When a character uses something picked from the ruleset's catalogs, such as a spell or class feature, the GM names it and Marinara pays the whole price: what the ruleset says it costs, plus one use of each counter that came with it. A spell that costs a slot is paid from the slot level the ruleset names, and the GM can ask for a higher one. Marinara never climbs to a higher slot on its own. If any part of the price cannot be paid, the whole thing is refused and nothing is spent. Something free, such as a cantrip, is only narrated.

Some sheet numbers belong to the ruleset: a class resource whose maximum follows your level, or uses that follow an ability score, is set by the ruleset and kept right when you edit the sheet. A ruleset can also calculate a number from a resource or track as it stands, give a number for each value of a state, add up a column of a list (such as the weight of packed gear), or cap a skill by such a number, so a skill can shrink while a resource is low. The game's sheet shows these current values, and a check or fight uses the value at that moment. The sheet editor on a character card has no game to read, so it shows them as at the start of play.

Live values belong to the message they happened in. If you swipe to another version of a turn, or regenerate it, the sheet goes back to how it was before that turn, so nothing is spent twice.

### Edit the ruleset sheet

Change the build itself, for example after a level-up.

1. Open the character's sheet and click **Edit ruleset sheet**.
2. Change scores, fields, lists such as spells, and skill and save training. Calculated values update as you type. When the ruleset has a step-by-step builder, choose **Guided** to be walked through each choice (scores, skills, starting gear), or **All fields** to see everything at once.
3. Click **Save sheet**.

It is the same editor as on the character card. Rows can be added from the ruleset's catalogs, cells the ruleset keeps are shown but cannot be typed in, and a list whose ruleset text has changed offers **Review**. Saving changes only this game's copy. The sheet stored on the character or persona is never changed by a game.

The separate **Edit card** button (see [Edit a sheet by hand](party-and-npcs.md#edit-a-sheet-by-hand)) edits the general sheet (class, abilities, strengths) and leaves the ruleset sheet alone.

If it did not work, and the ruleset's package was removed or is older than the one the game was created on, the block shows a notice instead. Checks cannot be rolled until the package is installed again.

## The party sheet and progress clocks

Some rulesets keep a sheet for the whole party, such as a crew or company. It shows on the game screen near the map under the ruleset's own name for it. Click the name to open it. The GM keeps it current like each character's sheet, and where the ruleset allows you can edit it too. If someone else saved the party sheet while you were editing, you see their version. **Save** replaces it with yours and **Cancel** keeps theirs.

A ruleset can also use **Progress clocks**: circles split into segments that the GM fills as something builds up, such as an alarm being raised. They show near the map, each with how many segments are filled, and read **Done** when full.

## Related guides

- [Game Mode: Fights on a Ruleset](fighting-on-a-ruleset.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Character Colors and RPG Stats: Ruleset sheets](../characters/colors-and-stats.md#ruleset-sheets)
- [Writing Game Mode Rulesets](../extending/writing-rulesets.md)
