# Game Mode: Playing with a Ruleset

A ruleset tells Game Mode how a tabletop system works: which dice a check rolls, what is on the character sheet, which resources get spent, what a rest gives back, and, for some rulesets, how a whole fight is fought. This guide covers getting a ruleset, choosing it for a game, and what changes once you play on it. A game without one plays on Marinara's own rules, described in the other Game Mode guides.

## Getting a ruleset

Rulesets come from two places. Official ones, such as 5e (SRD 5.1), are installed from **Agent Organizer**, where they are marked **Rules**. Community ones are imported from a file or from an author's GitHub repository, and are filed under where they came from, such as `local/ember-roads` or `alice/v20`. Importing uses the same **Allow custom Agent imports** switch as imported agents. While that switch is off, imported rulesets are left out of new games, and games that already use one keep working. A game on an imported ruleset always plays on the exact version it was created on. To write your own, see [Writing Game Mode Rulesets](../extending/writing-rulesets.md).

### Language

A ruleset's own text, such as its skill names, spells and Game Master text, follows the language set in **Settings**. An official ruleset downloads only that language's translation, fetches the new one when you switch languages, and falls back to English for a language it has not been translated into. A ruleset imported from a file keeps only the translation for the language you had when you imported it; to switch, import the file again.

## Choosing a ruleset for a game

**Rules** only appears when at least one ruleset is installed, and only for a new game. It is separate from **Combat Preference**: one decides how checks and character sheets work, the other decides how battles are shown.

- **Marinara's own rules** is the default: the built-in d20 checks and the six-attribute sheet.
- **A ruleset**, such as **5e (SRD 5.1)**, shows a short summary of what it covers, and one line saying what battles will do. A ruleset that resolves its own fights says so. One that only lends the sheet says that battles run on Marinara's combat with the sheet's own health, energy and abilities. One that does neither says that battles run on Marinara's combat and names the **Combat Preference** you picked.

The ruleset is set when the game is created and stays with that game. It cannot be changed or added later.

Some rulesets offer **layers**: named variants such as Low magic or Hard winter, shown as toggles under the ruleset with a line saying what each one does. A layer can make the difficulties harsher, narrow a choice on the character sheet, leave some ready-made entries out of the sheet editor's picker, change which shops sell what and what treasure drops, and give the Game Master extra instructions, including for the world it builds at setup. Some layers rule each other out, and the wizard disables the one you cannot have. Layers are fixed once the game starts, exactly like the ruleset itself, and a sheet that already uses something a layer takes away keeps it.

After you pick a ruleset, the **Party** step lists your persona and party members below the pickers and says who **Has a sheet** for it and who **Starts on a blank sheet**. A sheet is added under **Stats** in the character or persona editor (see [Ruleset sheets](../characters/colors-and-stats.md#ruleset-sheets)). The game takes a copy of each sheet when the world is generated. Nothing you change in the game goes back to the character or persona. A member without a sheet gets a blank one with every value at the ruleset's default; world generation never makes up scores.

A shared setup file remembers its ruleset. If you import one and do not have that ruleset, or have an older version of it, the wizard tells you which ruleset it was and the game uses Marinara's own rules unless you install it and pick it.

## What happens in battles

What a ruleset does in a fight depends on how it was written. The setup wizard's line under the ruleset says which of these applies.

| The ruleset                                   | Battles                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Resolves its own fights, such as 5e (SRD 5.1) | Fought by the ruleset's own rules, on its own battle screen. See [Fights on a Ruleset](fighting-on-a-ruleset.md). |
| Lends its sheet to battles                    | Marinara's own combat, using the sheet's health, spell slots and abilities. See below.                            |
| Says nothing about battles                    | Marinara's own combat, exactly as in a game with no ruleset. See [Combat](combat.md).                             |

When the ruleset lends its sheet to battles, each party member starts the fight with whichever resource pool and spell slots the ruleset set up for battles, as their sheet has them right now. The abilities they picked from the ruleset's catalogs become skills when Marinara's combat can use them: an entry that only describes something out of combat, a reaction, or one whose cost the battle cannot charge is left out. Hit points are carried as a share of the maximum rather than as the sheet's own number: a character at half health on the sheet starts the fight at half the health bar the battle screen gives them, because the numbers in battle are Marinara's. A sheet with 9 health does not walk into a fight where one hit does 12. When the fight ends, the health lost or regained is carried back the same way, and the slots and resources spent are written back as they are. The rest of the battle is unchanged: the dice math is still Marinara's (see [How combat math works](combat.md#how-combat-math-works)), and attack rolls, saving throws and concentration from the tabletop system are not applied. A fight you leave by deleting the message it started in writes nothing back, because it did not happen.

## Checks on a ruleset

On a ruleset, the Game Master asks for checks the way it does in any game (see [Skill checks](dice-and-skill-checks.md#skill-checks)), but the ruleset decides how they are rolled:

- The Game Master still only names the skill or the save and sets a difficulty. It is told the ruleset's own difficulty ladder instead of the built-in one. A difficulty may go as far as that ladder does, even past the 1 to 40 that Marinara's own rules allow. One path stays at 1 to 40 even in a ruleset game: the fallback that rolls a check a saved turn still owes.
- The Engine rolls the ruleset's dice and adds the modifier from the character's **ruleset sheet**, made of whatever parts the ruleset declares: the ability modifier when the skill or save names an ability, the bonus for its training level (a multiple of a proficiency bonus, a flat number, or both), and any extra bonus entered on the sheet. The built-in skill bonuses and attributes are not used.
- A check can be for a party member. The Game Master adds `who="Name"` to the tag, and the Engine uses that character's sheet. Without `who`, the player is checked. A party member who has no sheet yet rolls on a blank one, with every value at the ruleset's default. A name that matches nobody in the party, or that two party members share, rolls the dice with no modifier at all. The one exception is your own character's name: if a party member shares it, that name still means you and uses your sheet. The Engine never borrows someone else's sheet.
- Natural results follow the ruleset. Under 5e (SRD 5.1) a natural 20 or natural 1 has no special effect on checks and saves, so a natural 20 that misses the difficulty fails. This differs from Marinara's own rules on purpose.
- Numbers the Game Master writes itself are not trusted. A finished-looking tag is rolled again and replaced when its modifier is not the one on the sheet, when it rolled a different number or size of dice than the ruleset does, when the die it counted is not the one its roll mode keeps, or when it claims a natural result the ruleset does not have.
- A die you rolled yourself before the check is used only when the ruleset rolls a single d20. A ruleset that rolls other dice, such as 2d6 or a pool, ignores it and rolls normally.
- The Game Master can roll a skill or a save with a different ability than the one it normally uses, by adding `with="Ability"` to the tag. Only an ability your ruleset declares counts; anything else is ignored and the skill keeps its own.
- The Game Master can name a difficulty from the ladder instead of writing its number, such as `difficulty="Hard"`. The Engine rolls against that step's number, and the saved check shows the number. A name the ladder does not have is ignored.
- Roll placeholders can name the ruleset's abilities, skills and saves, and `PROF` for the proficiency bonus when the ruleset has one.
- If the ruleset's package is missing or older than the one the game was created on, checks are saved without numbers and stay owed. They are never rolled with another system's rules.
- If something on your sheet changes a roll, such as a charm that throws the dice that fell wrong again, the Game Master names it on the check and the Engine does the rest: it takes what the charm costs, applies what it does, and rolls. A charm you have not picked, or one you cannot pay for, does nothing and costs nothing.
- If the ruleset lets you spend a resource to steady a roll, the Game Master says so on the check itself and the Engine does both at once: it takes the points, adds what they bought, and rolls. If the pool cannot cover it, nothing is spent and the roll is the one it would have been. What the record shows is what was really paid, not what was asked for. How much one check may buy is set by the ruleset: a fixed number, a number on your sheet, or as many as the check has dice.
- If the ruleset says a number on your sheet rides along on certain rolls, such as a heavy pack on every Brawn roll, the Engine adds it to every check it applies to, and the dice card says what the sheet added.
- A ruleset can say what a check does when you have no training in the skill: it may cost you dice or points, be one step harder, or not be possible at all. A check you cannot attempt untrained is not rolled, and the narration says so instead of showing a result. Your sheet shows no number for such a skill until you train it.
- If the ruleset has a wound track and says its penalty applies to rolls, being hurt makes every check harder. Under a pool ruleset it takes that many dice off the pool, never below the smallest pool that ruleset allows, which some systems set to none at all. Under a ruleset that adds dice up, it is a flat penalty on the roll. Either way the check says how much was applied, so you can see why you rolled fewer dice. See [The ruleset sheet](#the-ruleset-sheet).
- The Game Master also keeps each character's resources, conditions and rests up to date on the sheet, and the Engine refuses a change the sheet does not allow. See [The ruleset sheet](#the-ruleset-sheet).

### Rulesets that roll a pool of dice

Some systems do not add a bonus to a roll. Instead, the number on the sheet is how many dice you throw, and you count the ones that come up high enough. A ruleset can be written that way, and a game on one behaves a little differently:

- **The sheet's number is dice.** A rating of 3 and a trade worth 2 throw five dice. Your sheet shows that as "5 dice" rather than "+5", in the editor and in what the Game Master reads.
- **The difficulty is a count of successes.** A hard job asks for three successes, not for a total of 15. The ruleset's difficulty ladder says how many each step needs.
- **The Engine throws the dice and counts them.** Which faces count, whether a high face rolls another die or counts twice, whether low faces cancel successes, and what counts as a fumble or a standout success, all come from the ruleset. The dice card shows every die that was thrown, with the ones that reached the target picked out from the ones that did not, and reads how many successes came up against how many the check needed. A big pool wraps onto more rows rather than shrinking, and the card never shows a total the dice were not added up to.
- **The Game Master can adjust one check**, if the ruleset allows it: a harder or easier per-die target, dice added or taken for the circumstances, and a lower face for dice to roll again or count twice on. Each is held to the range the ruleset declares. A step of the difficulty ladder can carry its own per-die target, which applies when the Game Master picks that step. The dice card says when a check rolled again or counted twice on a face other than the ruleset's usual one.
- **Dice can be thrown again**, if the ruleset has a rule for it: the Game Master names it on the check when the situation calls for it, and the dice that fell low are thrown again, once or until they come up higher. A resource you spend can buy the same. One roll is thrown again only one way; where two would apply, the one that reaches more dice is used.
- **Two abilities can be rolled together**, if the ruleset says so: an ability check can add a second ability's dice, so two ratings are thrown as one pool.
- **Some rulesets can go wrong alongside the result.** In a ruleset that counts low faces on half the dice or more as a fumble, a check that still got its successes keeps its result, and the dice card adds that something went wrong alongside it. With no successes at all, it is a critical failure.
- **The Game Master never supplies the numbers.** A pool result written into the narration is always replaced by the Engine's own roll. Advantage does not apply, and neither does a die you rolled yourself before the check.
- **Letting the Game Master see one die of each size does not apply to these checks.** The dice it is shown are twenty-sided; a pool check is rolled blind by the Engine and narrated the way every other blind roll is.

### Other ways a ruleset can roll

A ruleset can roll its checks in other ways too. The Engine still throws the dice, and the dice card follows the ruleset:

- **Keep the highest dice.** Throw a handful of dice and read the highest one, two, or three, as the ruleset specifies.
- **Roll against your sheet.** Roll at or under a number on your sheet, such as a skill percentage, instead of adding a bonus to the dice.
- **Dice with their own faces.** Faces can be worth something other than their number, such as minus, blank and plus. Some dice carry symbols, such as success, advantage and their opposites, instead of numbers.
- **Results in bands.** A check can land in one of several results, such as a critical success or a success at a cost, rather than a plain pass or fail. The dice card names the band, and the Game Master narrates it.
- **A few checks rolled another way.** A ruleset can roll most checks one way and name a few that roll differently.

## The ruleset sheet

In a game on a ruleset, each character sheet starts with a **Ruleset sheet** block. Its layout comes from the ruleset, so a 5e sheet and another system's sheet look different. A game with no ruleset does not have this block.

- **Resources** such as hit points, spell slots or a class resource show what is left out of the maximum. Use the minus and plus buttons, or type a number. A resource that has a temporary buffer also shows a **Temp** box.
- **Tracks**, such as exhaustion, step up and down within their range.
- **Wound tracks** are a row of boxes instead of a number, for systems that mark harm rather than count it. Each box says what that level of hurt is called and what it takes off your rolls. Pick the kind of harm first when the ruleset has more than one, then use **Mark** or **Clear one**. You can also click the next empty box to add a mark or the last marked box to clear one; other boxes do not respond to clicks. A worse mark takes the higher box and pushes lighter ones down, and the line underneath says which penalty is in force, along with anything that could not fit on the track at all. Some rulesets number their boxes instead of naming them, sometimes as many as a character's own rating, and some put each mark on the box it is aimed at: on those you can click any clear box, the lightest mark on the highest box is the one **Clear one** takes, and a track that is full refuses another mark instead of making an old one worse. A ruleset can also add boxes to a track from a list on your sheet, and have a rest or a heal clear only one kind of harm. If the ruleset says so, that penalty comes off your rolls: it takes dice off a pool, or is added to a summed roll, and the dice card says how much was applied.
- **Notes**, such as what a character is concentrating on, are short text boxes.
- **Conditions** are buttons you switch on and off.
- **States**, such as a form or a stance, are one value out of a list at a time. Pick the value from the list. A state can change the numbers that follow it, such as the dice a stance adds to your rolls, and a rest may put it back where it started.
- **Rest buttons** apply one of the ruleset's rests. What a rest restores is defined by the ruleset, and a rest can also bring back the charges of items the character carries, such as a wand's; the line under the buttons then says what came back. Under 5e (SRD 5.1), a long rest restores hit points and spell slots and brings back half of the character's hit dice, with a minimum of one.
- Below that is a short summary of the build: ability modifiers, trained skills and saves, and a few values the ruleset picks, such as armor class.

The Game Master keeps the same sheet up to date while it narrates. When a character spends a resource, takes damage, heals, gains or loses a condition, changes a state, or rests, it records the change, and the Engine checks it against the sheet. A change that is not possible, such as a spell cast with no slot left, is refused: nothing changes and a notice tells you so.

When a character uses something they picked from the ruleset's catalogs, such as a spell or a class feature, the Game Master names it and the Engine pays the whole price: whatever the ruleset says it costs, plus one use of each counter that came with it. A spell that costs a slot is paid from the slot level the ruleset names for it, and the Game Master can ask for a higher one instead. The Engine never climbs to a higher slot on its own. If any part of the price cannot be paid, the whole thing is refused and nothing is spent. Something that costs nothing, such as a cantrip, is simply narrated.

Some numbers on the sheet belong to the ruleset rather than to you. A class resource whose maximum follows your level, or uses that follow an ability score, is set by the ruleset and kept right when you edit the sheet.

Some calculated values follow play itself: a ruleset can work out a number from a resource or a track as it stands, give a number for each value of a state, or add up a column of a list, such as the weight of the gear you have packed. It can also cap a skill at a number like that, so a skill can shrink while a resource is low. These show their current value in the game's sheet, and the values a check or a fight uses are the ones at the moment it happens. The sheet editor on a character card, which has no game to read, shows them as they would be at the start of play.

These live values belong to the message they happened in. If you swipe to another version of a turn, or regenerate it, the sheet goes back to how it was before that turn, so nothing is ever spent twice.

Click **Edit sheet** to change the build itself, for example after a level-up: scores, fields, lists such as spells, and skill and save training. Calculated values update as you type. It is the same editor as the one on the character card, so rows can be added from the ruleset's catalogs here too, cells the ruleset keeps are shown but cannot be typed in, and a list whose ruleset text has changed offers a **Review** button. When the ruleset has a step-by-step builder, the editor offers **Guided** beside **All fields**. **Guided** walks you through each choice, such as scores, skills and starting gear, and says what each step still waits on. **All fields** shows everything at once. Click **Save sheet** when you are done. This changes only this game's copy of the sheet. The sheet stored on the character or persona is never changed by a game.

The separate **Edit Sheet** button (see [Edit a sheet by hand](party-and-npcs.md#edit-a-sheet-by-hand)) still edits the general sheet (class, abilities, strengths and so on) and leaves the ruleset sheet alone.

If the ruleset's package was removed, or the installed copy is older than the one the game was created on, the block shows a notice instead, and checks cannot be rolled until the package is installed again.

## The party sheet and progress clocks

Some rulesets keep a sheet for the whole party, such as a crew or a company. It shows on the game screen near the map, under the ruleset's own name for it. Click the name to open it. The Game Master keeps it up to date as it does each character's sheet, and where the ruleset allows, you can edit it too. If someone else saved the party sheet while you were editing, it shows their version: **Save** replaces it with yours, and **Cancel** keeps theirs.

A ruleset can also use **Progress clocks**: circles split into segments that the Game Master fills as something builds up, such as an alarm being raised. They show near the map, each with how many segments are filled, and read **Done** once full.

## Related guides

- [Game Mode: Fights on a Ruleset](fighting-on-a-ruleset.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Character Colors and RPG Stats: Ruleset sheets](../characters/colors-and-stats.md#ruleset-sheets)
- [Writing Game Mode Rulesets](../extending/writing-rulesets.md)
