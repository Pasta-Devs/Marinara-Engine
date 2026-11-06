# Game Mode: Dice and Skill Checks

Use the dice button to roll dice for the Game Master (GM) in Game Mode. This guide also shows how the GM runs a skill check against a Difficulty Class (DC), the number a roll must reach or beat.

## Roll dice

The message input bar has a dice button. Its tooltip is **Roll dice**.

1. Click the dice button to open the quick-dice menu.
2. Click a preset: d20, d6, 2d6, d10, d100, d4, d8 or d12.
3. A chip appears in the input bar, like `🎲 d20`. The roll is queued, not sent yet.
4. Send your message. Marinara rolls and adds the result to the end of your message as a tag, which the GM reads and narrates around.

To remove a queued roll before you send, click **Clear queued roll** on the chip.

A single die with no bonus looks like this:

```text
[dice: d20 = 14]
```

More than one die, or a bonus, also shows the parts:

```text
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

The GM can also ask for a roll in its narration with `[dice: 3d8+2]`. Marinara supplies the real numbers and shows the same animated card. This works on text-only connections, including Claude and Grok subscriptions. When the GM rolls several times in one turn, each dice card waits its turn: dismiss one to see the next. All rolls are saved on that turn's active swipe and stay in **Logs** after a reload. Continuing a turn keeps its earlier rolls. Regenerating makes a new set for the new swipe.

## Roll custom dice

The dice menu has a text field for a custom roll in `NdM` notation: `N` dice with `M` sides each, with an optional bonus or penalty at the end. The field shows the example `3d8+2` (three 8-sided dice, add 2).

1. Open the dice menu.
2. Type your notation, for example `2d6+1`.
3. Press <kbd>Enter</kbd> or click the paper-plane button. The roll is queued as a chip.

| Notation | Meaning |
| --- | --- |
| `d20` | One 20-sided die |
| `4d8-1` | Four 8-sided dice, subtract 1 |
| `4d6kh3` | Roll four 6-sided dice, keep the highest three |
| `2d20kl1` | Keep the lowest one: a roll with disadvantage |
| `4d6dl1+2` | Drop the lowest die, add 2 |

`kh` and `kl` keep the highest or lowest dice. `dh` and `dl` drop them. Every die thrown is recorded, and only the kept ones are added up.

If it did not work: text that is not `NdM` or a bare `dM`, optionally followed by `kh`, `kl`, `dh` or `dl` and a number, fails with an error that names the expected format.

You can roll at most 100 dice at once, and each die can have at most 1000 sides. A plain roll above that is trimmed to the limits and the card shows the trimmed notation, so `500d6` gives a `100d6` card. A keep-or-drop roll above the limits, such as `101d6kh3`, is refused with an out-of-range error, because trimming would change which dice are kept.

## Skill checks

A skill check tests something risky, such as sneaking, spotting a clue or convincing an NPC. You do not start one. The GM calls for it in its narration, and Marinara turns it into an animated d20 roll with a result banner. The banner shows the skill and target, for example **Stealth Check** with **DC 15**. Each resolved check gets its own banner, after any queued dice cards.

### How the result is decided

The check rolls one d20 and adds two modifiers:

- A skill modifier, from the skill level the game tracks for your character. It is 0 if the game has no level for that skill yet.
- An attribute modifier, from the skill's governing attribute. Each skill maps to one automatically: Stealth uses Dexterity, Perception uses Wisdom, Persuasion uses Charisma. A skill Marinara does not recognize uses Intelligence.

If the total reaches or beats the DC, the check succeeds. Two rolls override the math:

- A natural 20 is a **CRITICAL SUCCESS** and always passes.
- A natural 1 is a **CRITICAL FAILURE** and always fails.

The banner shows **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** or **CRITICAL FAILURE**.

### Advantage and disadvantage

The GM can call a check with advantage (roll two d20s, keep the higher) or disadvantage (keep the lower). The banner shows the mode next to the DC and marks the die used. If the GM asks for both at once, Marinara leaves that check alone instead of guessing, so you get no banner for it.

### Pre-roll your own d20

Queue a `d20` from the dice menu before the check happens. The check then uses your number instead of rolling a new die. Your skill and attribute modifiers still apply.

For how the GM finishes a turn after a roll, and what it costs, see [How a rolled turn is narrated](#how-a-rolled-turn-is-narrated).

### Games that use a ruleset

In a game on a ruleset, such as 5e (SRD 5.1), checks use the ruleset's own dice, difficulty ladder and sheet modifiers, and in some rulesets a pool of dice or symbol dice. See [Checks on a ruleset](rulesets.md#checks-on-a-ruleset).

## Reference

### How a rolled turn is narrated

When the GM calls for a check in text, Marinara resolves the dice and has three ways to finish the outcome. All three are in **Chat Settings → Function Calling**.

| Setting | Default | What happens |
| --- | --- | --- |
| **Finish rolled turns in one request** | On | One request. The GM writes the outcome without numbers and Marinara fills them in. See below. |
| **Narrate dice outcomes immediately** | On | Two requests. The GM drafts, Marinara rolls, then one more request sends the prompt again with the real results so the GM finishes the outcome in the same turn. This costs more input and output tokens. |
| Both off | | The real results are kept for the next turn, with no extra request. |

With **Narrate dice outcomes immediately**, if the extra request fails, the turn keeps the resolved results in its log without saving a guessed or partial outcome. A notice with a **Regenerate turn** button stays on the turn, even after a reload. A request with no actual rolls never triggers the extra request.

On a connection that supports the dice tool, the GM can get a real roll during generation instead. The dice card appears as soon as the tool returns, and the completed check records that result without rolling again.

#### Finishing a rolled turn in one request

Without this, a turn that rolls dice costs two requests. **Finish rolled turns in one request** removes the second. It is on by default. Turn it off in a chat to have that chat rewrite each rolled turn with the real numbers instead.

It works because the GM commits its writing before any number exists. It never sees a roll before it decides what happens, so it cannot steer the outcome. Marinara rolls afterwards and saves its own record. While the switch is on, the GM writes a check in one of three ways:

- **Two outcomes.** The GM writes the check without numbers, then a success line and a failure line. Marinara rolls, keeps the half the roll selected and deletes the other before you read the turn.
- **Only a number.** For damage, healing, gold, a duration, a count or a distance, the GM writes a placeholder such as `[[roll: 2d6+3]]` mid-sentence, and Marinara puts the number in its place. A placeholder can name a sheet modifier, as in `[[roll: 1d8+STR]]`. That form is offered only when your game has a sheet to read, and a name Marinara cannot resolve is refused rather than treated as zero. Hover a number from a placeholder to see its dice. Each one also appears in **Logs** as its own roll line.
- **Three or more endings.** The GM asks for the value and stops. Marinara rolls and records it, the turn ends without the outcome, and the GM narrates what the number meant at the start of the next turn.

A check written in none of these forms falls back to the last behavior, so nothing is left unresolved and nothing is invented.

- **Narrate dice outcomes immediately** is not used while this is on. It stays visible but disabled, and its stored value is kept for when you turn this off.
- Existing turns do not change. The switch affects only turns generated after you turn it on.
- A turn can still cost more than one request in two cases: **Enable Tool Use** is on and the dice tool is in your tool list (a tool call costs a full extra round), or a **Game tool provider** other than **Same as narrator** is set (it always makes a planning request).
- When something cannot be rolled, a short notice replaces the number, never a made-up value. **Logs** says what was left out.
- While the turn is written, placeholders and branch blocks are held back from the streaming text, so you never watch a number change.

### Symbol dice by name

In a game whose ruleset throws symbol dice (a `symbol-pool` ruleset, such as a Genesys-style system), the custom field also takes those dice by name. Give a count and a die name for each kind, for example `2 ability 1 proficiency vs 2 difficulty`. Names can be a die's id or label in any case, separated by spaces, commas, `+` or `vs`. A roll can name up to 40 dice.

The card shows each die with its face symbols, then the symbols left after cancelling and whether that is a success. The message tag carries the same, for example `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. The GM's dice tool accepts these names too. Plain `NdM` still works in every game.

### Other dice in a skill check

The GM can specify another notation, such as `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. These checks use the notation's flat modifier instead of d20 sheet modifiers and succeed when the total reaches the DC. Natural-1 and natural-20 rules apply only to the standard d20 check.

A success pool must give both a per-die threshold and the number of successes needed: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` rolls six d10s, counts each die showing at least 6, and succeeds with at least four. Marinara does not guess a missing threshold or implement exploding dice, botches or other special pool rules. A pool without a valid threshold stays unresolved, with invented numbers removed.

This is the pool a game with no ruleset gets. A game with a ruleset built on dice pools is different: see [Checks on a ruleset](rulesets.md#checks-on-a-ruleset).

A check's `dice=` attribute takes plain `NdM` only. Requests such as `4d6kh3`, `3d6!` or `4dF` are not rolled: Marinara logs the unsupported notation and removes invented numbers, and the outcome stays open.

### Let the Game Master see one die of each size

**Let the Game Master see one die of each size** is under **Finish rolled turns in one request**. It is off by default. It serves one case the blind forms cannot: a number that must choose between three or more endings, such as a margin of success or a hit-location table. Without it, that check ends the turn and is narrated next turn.

When on, Marinara throws one die of each standard size before the turn and shows the next value of each to the GM, so it can write what it means in the same pass.

> **Warning:** The GM then sees the number before it decides what to check and how hard to make it. It can pick a difficulty that the die it holds will clear, or avoid calling a check while holding a bad number. Marinara cannot tell whether a difficulty suits the fiction, so it cannot catch this. A suspiciously heroic session may be luck-shaping.

What Marinara enforces without the GM's cooperation:

- Values come out in order and none comes out twice.
- Every number in the record is Marinara's. The roll, modifier, total and outcome are recomputed from the queue and your sheet. A mismatched number is replaced, and **Logs** says so.
- Difficulty is held between 1 and 40. A game on a ruleset may go as far as its ruleset's difficulty ladder.
- A swipe, regenerate or continuation of the same turn faces the same values, so there is no rerolling for luck.
- **Values shown per size** sets how many values the GM sees per size. The default is 1. Later rolls of that size in one turn are unseen and narrated next turn.
- **Rethrow after idle turns** (default 3) throws an unspent die again after that many turns. Without it, a low value could sit at the front for the rest of the chat. Set 0 to turn the rethrow off.
- If the GM asks for more rolls than the queue holds, the check keeps its question, loses every number and is narrated next turn. **Logs** says which turn.

## Related guides

- [Game Mode: Playing with a Ruleset](rulesets.md)
- [Game Mode: Combat](combat.md)
- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
