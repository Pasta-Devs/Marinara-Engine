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
- `4d6kh3` rolls four 6-sided dice and keeps the highest three. `kl` keeps the lowest, and `dh` and `dl` drop the highest or lowest instead, so `2d20kl1` is a roll with disadvantage and `4d6dl1+2` drops the lowest die and adds 2. Every die thrown is recorded, and only the kept ones are added up.

There are two hard limits. You can roll at most 100 dice at once, and each die can have at most 1000 sides. If a plain roll asks for more, the app trims it down to those limits instead of refusing it, and the result card shows the trimmed notation, so typing `500d6` gives you a `100d6` card for the hundred dice it actually rolled. A keep or drop roll past the limits, such as `101d6kh3`, is refused with an out-of-range error instead, because trimming the dice would change which ones are kept. If your text is not valid dice notation, meaning `NdM` or a bare `dM` like `d20`, optionally followed by `kh`, `kl`, `dh` or `dl` and a number, the roll fails and you get an error that names the expected format.

### Symbol dice by name

In a game whose ruleset throws symbol dice (a `symbol-pool` ruleset, such as a Genesys-style system), the custom field also takes those dice by name. Give a count and the die's name for each kind, for example `2 ability 1 proficiency vs 2 difficulty`. Names can be the die's id or its label in any case, and you can separate them with spaces, commas, `+` or `vs`.

The card shows each die with the symbols on its face, then the symbols left after they cancel and whether that is a success. The tag added to your message carries the same, for example `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. A roll can name up to 40 dice. When the Game Master rolls with its dice tool, it can use these names too. Plain `NdM` notation still rolls as above in every game.

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

This is the pool a game with **no ruleset** gets, and it is unchanged. A game that carries a ruleset built on dice pools is a different thing, with rules the engine actually holds; see [Checks on a ruleset](rulesets.md#checks-on-a-ruleset).

A check's `dice=` attribute takes plain `NdM` only. Requests there such as `4d6kh3`, `3d6!`, or `4dF` are not rolled. The engine logs the unsupported notation and removes invented numbers from check records. These outcomes remain open; the engine does not silently substitute a different dice system.

### Advantage and disadvantage

The Game Master can call a check with advantage or with disadvantage. A check is never rolled with both at the same time.

- With advantage, the app rolls two 20-sided dice and keeps the higher one.
- With disadvantage, the app rolls two dice and keeps the lower one.

If the Game Master ever asks for both at once, the app leaves that check alone instead of guessing which one it meant, so you get no banner for it.

When either one is active, the banner shows the mode next to the DC, and it marks which die it used.

### Pre-rolling your own die

You can queue your own `d20` from the dice menu before the check happens. When you do, the skill check uses your rolled number instead of rolling a fresh die. Your skill and attribute modifiers still apply on top of it.

## Games that use a ruleset

In a game on a ruleset, such as 5e (SRD 5.1), checks are rolled the ruleset's way: its own dice, difficulty ladder and sheet modifiers, and in some rulesets a pool of dice or symbol dice. See [Checks on a ruleset](rulesets.md#checks-on-a-ruleset).

## Finishing a rolled turn in one request

Without it, a turn that rolls dice costs two model requests: one for the draft, one to rewrite the outcome with the real numbers. **Finish rolled turns in one request** in **Chat Settings → Function Calling** removes the second one. It is on by default; turn it off in a chat to have that chat rewrite each rolled turn with the real numbers instead.

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

- [Game Mode: Playing with a Ruleset](rulesets.md)
- [Game Mode: Combat](combat.md)
- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
