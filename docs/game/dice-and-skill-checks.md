# Game Mode: Dice and Skill Checks

This guide covers dice rolling in Marinara Engine Game Mode. It explains the quick-dice menu, custom dice notation, and the limits on custom rolls. It also covers how the Game Master runs a skill check against a Difficulty Class (DC).

## Rolling dice

The message input bar in a Game Mode chat has a dice button. Hover it to see the tooltip **Roll dice**. Click it to open the quick-dice menu.

The menu has eight one-click presets:

| Preset | Rolls |
|---|---|
| d20 | one 20-sided die |
| d6 | one 6-sided die |
| 2d6 | two 6-sided dice |
| d10 | one 10-sided die |
| d100 | one 100-sided die |
| d4 | one 4-sided die |
| d8 | one 8-sided die |
| d12 | one 12-sided die |

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

There are two hard limits. You can roll at most 100 dice at once, and each die can have at most 1000 sides. If you ask for more, the app trims your request down to those limits instead of refusing it, and the result card shows the trimmed notation, so typing `500d6` gives you a `100d6` card for the hundred dice it actually rolled. If your text is not valid dice notation — `NdM`, or a bare `dM` like `d20` — the roll fails and you get an error that names the expected format.

## Skill checks

A skill check tests whether you succeed at something risky, such as sneaking, spotting a clue, or convincing an NPC. You do not start a skill check yourself. The Game Master calls for one inside its narration. The app then turns it into an animated d20 roll with a result banner.

A text-requested check begins with the attempt. The engine resolves the dice, then makes one additional model request with the actual results so the Game Master can finish the outcome in the same turn. This also corrects a draft that guessed an outcome before the roll existed. The extra request sends the prompt again and uses more input and output tokens. If it fails, the turn keeps the resolved results without saving a guessed or partial outcome.

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

### Advantage and disadvantage

The Game Master can call a check with advantage or with disadvantage. A check is never rolled with both at the same time.

- With advantage, the app rolls two 20-sided dice and keeps the higher one.
- With disadvantage, the app rolls two dice and keeps the lower one.

If the Game Master ever asks for both at once, the app leaves that check alone instead of guessing which one it meant, so you get no banner for it.

When either one is active, the banner shows the mode next to the DC, and it marks which die it used.

### Pre-rolling your own die

You can queue your own `d20` from the dice menu before the check happens. When you do, the skill check uses your rolled number instead of rolling a fresh die. Your skill and attribute modifiers still apply on top of it.

## Related guides

- [Game Mode: Combat](combat.md)
- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
