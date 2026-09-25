# Game Mode: Dice and Skill Checks

This guide covers dice rolling in Marinara Engine Game Mode. It explains the quick-dice menu, custom dice notation, and the limits on custom rolls. It also covers how the Game Master runs a skill check against a Difficulty Class (DC).

## Rolling dice

The message input bar in a Game Mode chat has a dice button. Hover it to see the tooltip **Roll dice**. Click it to open the quick-dice menu.

The menu has eight one-click presets:

| Preset | Rolls             |
| ------ | ----------------- |
| d20    | one 20-sided die  |
| d6     | one 6-sided die   |
| 2d6    | two 6-sided dice  |
| d10    | one 10-sided die  |
| d100   | one 100-sided die |
| d4     | one 4-sided die   |
| d8     | one 8-sided die   |
| d12    | one 12-sided die  |

To make a quick roll:

1. Open the message input bar in a Game Mode chat.
2. Click the dice button.
3. Click one of the eight presets, for example **d20**.
4. You should see a small chip in the input bar, like `🎲 d20`.

The roll is not sent right away. It is queued. To remove a queued roll, click the clear button on the chip. Its tooltip is **Clear queued roll**.

The dice math runs when you send your next message. The app adds the result to the end of your message as a tag. A single die with no bonus looks like this:

```
[dice: d20 = 14]
```

A roll with more than one die or with a bonus also shows the parts:

```
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

The Game Master reads that tag and narrates around the result.

When the Game Master rolls several times in one turn, each dice card gets its own place in the queue. Dismiss a card to see the next one. All rolls are saved on that turn's active swipe and remain in **Logs** after a reload. Continuing a turn keeps its earlier rolls; regenerating creates a separate set for the new swipe.

The Game Master can also request a roll in narration with `[dice: 3d8+2]`. The engine supplies the real numbers and shows the same animated card. This works on text-only connections, including Claude and Grok subscriptions. It uses the same notation and limits as the dice menu.

## Custom dice notation

The dice menu also has a text field for a custom roll. It uses standard `NdM` notation. `N` is how many dice to roll and `M` is how many sides each die has. You can add a bonus or a penalty at the end.

The field placeholder shows an example: `3d8+2`. That means roll three 8-sided dice and add 2 to the total.

To use a custom roll:

1. Click the dice button to open the menu.
2. Type your notation in the text field, for example `2d6+1`.
3. Press Enter, or click the small paper-plane (send) button next to the field.
4. You should see the roll queued as a chip, ready to send.

Some more examples you can type:

- `d20` rolls one 20-sided die.
- `4d8-1` rolls four 8-sided dice and subtracts 1.
- `2d6+3` rolls two 6-sided dice and adds 3.

There are two hard limits. You can roll at most 100 dice at once, and each die can have at most 1000 sides. If you ask for more, the app trims your request down to those limits instead of refusing it, and the result card shows the trimmed notation, so typing `500d6` gives you a `100d6` card for the hundred dice it actually rolled. If your text is not valid dice notation, meaning `NdM` or a bare `dM` like `d20`, the roll fails and you get an error that names the expected format.

## Skill checks

A skill check tests whether you succeed at something risky, such as sneaking, spotting a clue, or convincing an NPC. You do not start a skill check yourself. The Game Master calls for one inside its narration. The app then turns it into an animated d20 roll with a result banner.

A text-requested check begins with the attempt. The engine resolves the dice, then makes one additional model request with the actual results so the Game Master can finish the outcome in the same turn. This also corrects a draft that guessed an outcome before the roll existed. The extra request sends the prompt again and uses more input and output tokens. If it fails, the turn keeps the resolved results in its log without saving a guessed or partial outcome. A notice remains on the turn with a **Regenerate turn** button, including after reloading the chat.

Turn off **Narrate dice outcomes immediately** in **Chat Settings → Function Calling** to keep the real results for the next turn without this extra request. This setting is on by default. Requests that produce no actual rolls never trigger the extra narration request.

There is a third option, which keeps the outcome in the same turn without the second request. See [Finishing a rolled turn in one request](#finishing-a-rolled-turn-in-one-request) below.

On a connection that supports the dice tool, the Game Master can instead obtain a real roll during generation. The dice card appears as soon as the tool returns; the completed check records that result without rolling again. Every resolved skill check receives its own banner, following any queued dice cards.

The banner shows the skill and the target number, for example **Stealth Check** with **DC 15** next to it. DC stands for Difficulty Class. It is the number your roll must reach or beat.

### How the result is decided

The check rolls one 20-sided die and adds two modifiers:

- A skill modifier, from the skill level the game tracks for your character. If the game has no level for that skill yet, this modifier is 0.
- An attribute modifier, from the governing attribute for that skill.

The die roll plus both modifiers is your total. If the total reaches or beats the DC, the check succeeds. If it falls short, the check fails. Each skill maps to a governing attribute automatically. For example, Stealth uses Dexterity, Perception uses Wisdom, and Persuasion uses Charisma. A skill the app does not recognize falls back to Intelligence.

### Critical success and critical failure

Two rolls override the math:

- A natural 20 (the die itself shows 20) is a **CRITICAL SUCCESS**. It always passes, even against a high DC.
- A natural 1 (the die itself shows 1) is a **CRITICAL FAILURE**. It always fails, even with large modifiers.

The banner shows one of four results: **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE**, or **CRITICAL FAILURE**.

### Other dice systems

The Game Master can specify another notation, such as `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. These checks use the notation's flat modifier instead of d20 character-sheet modifiers and succeed when the total reaches the DC. Natural-1 and natural-20 rules apply only to the standard d20 check above.

Success pools must state both the per-die threshold and the number of successes needed: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` rolls six d10s, counts each die showing at least 6 once, and succeeds with at least four successes. The engine does not guess a missing threshold or implement exploding dice, botches, or other special pool rules. A pool without a valid threshold stays unresolved, with any model-invented numbers removed.

This is the pool a game with **no ruleset** gets, and it is unchanged. A game that carries a ruleset built on dice pools is a different thing, with rules the engine actually holds; see [Games that use a ruleset](#games-that-use-a-ruleset) below.

Unsupported requests such as `4d6kh3`, `3d6!`, or `4dF` are not rolled. The engine logs the unsupported notation and removes invented numbers from check records. These outcomes remain open; the engine does not silently substitute a different dice system.

### Advantage and disadvantage

The Game Master can call a check with advantage or with disadvantage. A check is never rolled with both at the same time.

- With advantage, the app rolls two 20-sided dice and keeps the higher one.
- With disadvantage, the app rolls two dice and keeps the lower one.

If the Game Master ever asks for both at once, the app leaves that check alone instead of guessing which one it meant, so you get no banner for it.

When either one is active, the banner shows the mode next to the DC, and it marks which die it used.

### Pre-rolling your own die

You can queue your own `d20` from the dice menu before the check happens. When you do, the skill check uses your rolled number instead of rolling a fresh die. Your skill and attribute modifiers still apply on top of it.

## Games that use a ruleset

A game can carry a ruleset, such as 5e (SRD 5.1), in place of Marinara's own rules. The ruleset belongs to that one game and stays with it. You pick it under **Rules** in the setup wizard when you create the game (see [Choosing rules](getting-started.md#choosing-rules)). A game with no ruleset behaves exactly as described above.

When a game has a ruleset:

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
- If the ruleset has a wound track and says its penalty applies to rolls, being hurt makes every check harder. Under a pool ruleset it takes that many dice off the pool, never below the smallest pool that ruleset allows, which some systems set to none at all. Under a ruleset that adds dice up, it is a flat penalty on the roll. Either way the check says how much was applied, so you can see why you rolled fewer dice. See [The ruleset sheet](party-and-npcs.md#the-ruleset-sheet).
- The Game Master also keeps each character's resources, conditions and rests up to date on the sheet, and the Engine refuses a change the sheet does not allow. See [The ruleset sheet](party-and-npcs.md#the-ruleset-sheet).

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

## Finishing a rolled turn in one request

By default, a turn that rolls dice costs two model requests: one for the draft, one to rewrite the outcome with the real numbers. **Finish rolled turns in one request** in **Chat Settings → Function Calling** removes the second one. It is off by default and applies only to the chat you turn it on in.

It works because the Game Master commits its writing before any number exists. It never sees a roll before it decides what happens, so it cannot steer an outcome towards the die it was handed. The engine rolls afterwards, and the engine's record is what gets saved.

While the switch is on, the Game Master is asked to write a check in one of three ways, and to pick by what the outcome actually is.

**When the outcome splits two ways, it writes both halves.** The check is written without numbers, followed by a block holding a success line and a failure line. The engine rolls, keeps the half the roll selected, and deletes the other before you ever read the turn. What you see is one outcome, exactly as if the roll had come first.

**When the outcome is only a number, it writes a placeholder and keeps going.** Damage, healing, gold, a duration, a count, a distance: the Game Master writes `[[roll: 2d6+3]]` in the middle of the sentence, and the engine puts the number in its place. A placeholder can name a character-sheet modifier instead of a value, as in `[[roll: 1d8+STR]]`, and the engine adds the modifier itself; that form is only offered when your game actually has a sheet to read, and a name the engine cannot resolve is refused rather than treated as zero. Hover a number that came from a placeholder to see the dice behind it; every one of them also appears in **Logs** as its own roll line.

**When the number itself has to choose between three or more different endings, it asks for the value and stops.** This is the same sparse check or `[dice:]` request the Game Master writes today. The engine rolls it, records it, and the turn ends without the outcome. The Game Master narrates what the number meant at the start of the next turn, which is exactly what happens with **Narrate dice outcomes immediately** turned off.

A check written in none of those forms falls back to that same behaviour, so nothing is ever left unresolved and nothing is ever invented.

Some things worth knowing before you turn it on.

- **Narrate dice outcomes immediately is not used while this is on.** It stays visible, disabled, with a note saying so. Its stored value is untouched, so turning one-request dice back off gives you your old setting back.
- **Your existing turns do not change.** The switch only affects turns generated after you turn it on, and an already-saved transcript reads exactly as it did.
- **A turn can still cost more than one request in two cases.** If **Enable Tool Use** is on and the dice tool is in your tool list, the Game Master can still call it, and a tool call costs a full extra round. And a **Game tool connection** other than **Same as narrator** always makes its own planning request. Neither of those is the outcome rewrite this switch removes.
- **When something cannot be rolled, you are told.** A number the engine cannot read is replaced with a short notice rather than a made-up value, a branch it cannot read leaves the recorded roll and drops both halves, and either way a plain line appears in **Logs** saying what was left out.
- **While the turn is being written**, a placeholder or a branch block is held back from the streaming text, so you never watch a number appear and then change. The finished sentence arrives when the turn is done.

### Letting the Game Master see one die of each size

Under the switch there is a second setting, **Let the Game Master see one die of each size**, and it is off by default. It exists for the one case the two blind forms cannot serve: an outcome where the number itself has to pick between three or more different endings, like a margin of success, a hit-location table, or a reaction roll. Without it, that kind of check has to end the turn and be narrated at the start of the next one.

When it is on, the engine throws one die of each standard size before the turn and shows the next value of each to the Game Master, so it can spend one and write what it means in the same pass.

**This is the trade-off, and it is worth reading twice.** The Game Master sees the number before it decides what to check and how hard to make it. That means it can steer outcomes in a way the blind forms do not allow: it can pick a difficulty that the die it was handed will clear, and it can avoid calling for a check at all while it is holding a bad number. Nothing in the engine can tell whether a difficulty suits the fiction, so nothing in the engine can catch that. A player who does not know the Game Master saw the dice will read a suspiciously heroic session as good luck.

What the engine does enforce, and enforces without asking the Game Master to cooperate:

- **The values come out in order, and none of them comes out twice.** The engine keeps the queue and hands out the next one, whatever the turn claims.
- **Every number in the record is the engine's.** The roll, the modifier, the total and the outcome are all recomputed from the queue and your character sheet. A number the Game Master wrote that does not match is replaced, and a line in **Logs** says so.
- **The difficulty is bounded.** It is held between 1 and 40, which a written check has never been before. A game on a ruleset may go as far as its ruleset's difficulty ladder instead.
- **Being asked again does not improve the luck.** A swipe, a regenerate and a continuation of the same turn all face the same values, so there is no rerolling until something good comes up.
- **Only the next value of each size is shown.** That is the **Values shown per size** setting, and 1 is the default. Every later roll of the same size in one turn is unseen, and it is narrated on the next turn instead.
- **An unspent die is thrown again after a while.** That is **Rethrow after idle turns**, 3 by default. Without it, a low value can sit at the front of the queue for the rest of the chat while the Game Master simply avoids that size. Setting it to 0 turns the rethrow off and brings that behaviour back.
- **Asking for more rolls than the queue holds does not produce one.** The check keeps its question, loses every number, and is narrated on the next turn. **Logs** says which turn that happened on.

## Related guides

- [Game Mode: Combat](combat.md)
- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
