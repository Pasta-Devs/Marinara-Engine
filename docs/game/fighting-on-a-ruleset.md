# Game Mode: Fights on a Ruleset

Some rulesets, such as 5e (SRD 5.1), fight a whole battle by their own rules instead of lending Marinara's combat a few numbers. This guide shows what such a fight looks like and how to take your turn. For games on Marinara's own rules, see [Game Mode: Combat](combat.md). To choose a ruleset, see [Playing with a Ruleset](rulesets.md).

You do not start these fights. The Game Master (GM) starts one when the story calls for it, as in any game. Marinara builds it from the party's sheets and the ruleset's creatures, or from opponents the GM describes in the ruleset's terms.

## The battle screen

The screen is the ruleset's own:

- **The menu** lists your character's attacks and abilities. Each says what it spends from the ruleset's action economy (what you can do each turn) and pools (stores such as spell slots).
- **The panel below** shows the turn order, the round, everyone's conditions by the ruleset's names and what is left of each budget.
- **The log** prints the real arithmetic, for example "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit."

Every action is written to the character sheet as it lands. Closing the tab mid-fight loses nothing, and the GM is told afterwards that the numbers are settled.

## Take your turn

1. Read the log and the panel for the round, the order and your budgets.
2. Choose an attack or ability from the menu.
3. If it needs a target, pick one in the list. On a battlefield you can also click one on the board.
4. Read the log line to see what happened.
5. When nothing is left to do, or you want to skip, choose **Pass**.

If you cannot act, an action may be missing from the menu on purpose. Check these:

- It costs more than you have left. Look at the budgets (what is left of each pool and action) in the panel.
- It goes past a per-turn limit on a resource. It is offered again on your next turn.
- It is a way to break free, which shows only while something holds you.
- It needs a target and nobody is in reach. The menu says **Nobody is in reach. Move closer.** See [On a battlefield](#on-a-battlefield).

The menu groups its choices under these headings, when the ruleset has them:

| Group | What it holds |
| --- | --- |
| **Attacks**, **Abilities**, **Items** | Your attacks, abilities and items. |
| **Standard actions** | The ruleset's common actions. |
| **Stat block actions** | Actions a creature's stat block lists. |
| **Contests** | Grabs, shoves and breaking free (see [Contests](#contests)). |
| **Movement** | Walking on a battlefield (see [On a battlefield](#on-a-battlefield)). |
| **Spend symbols** | What leftover symbols buy, in a symbol-dice ruleset. |
| **Reload**, **Switches** | Reloading, and switches the ruleset defines. |
| **End of turn** | Ending your turn. |

## What a turn can hold

The ruleset decides what one turn holds.

- A blow can carry more than one kind of harm. Each part is rolled, resisted and saved against on its own, while the whole is still one blow.
- One spend of an action can buy several strikes. While any are left the menu offers them free and shows how many are in hand, so you can swing again or use something else or walk between them.
- An ability can cost nothing, give a second action for this turn only, or let you dash, disengage or hide with a smaller part of your turn.
- Something your character always does, such as extra damage on the first telling blow of a turn, adds itself and says so in the log.

## Conditions

A condition is a lasting effect on a fighter. Depending on the ruleset, it can make your saving throws (rolls to resist an effect) harder or easier, halve every kind of harm, keep you from turning on whoever put it on you or from walking nearer to them, or end when they go down. It can also change a number: add to your defense, add or remove dice on your attacks, saving throws and contests, or slow you down. The log shows each one beside the roll it changed, and the menu's chances count it. Some last until the start of your next turn, or only until the next attack or save they apply to. A ruleset can also count something such as exhaustion on a track on your sheet, so each level makes things a little worse while it lasts.

## Rulesets that throw a pool of dice

A ruleset whose checks throw a handful of dice and count the ones that reach a target fights the same way.

- **Attacks.** An attack throws your pool and needs a number of successes to land, never fewer than one. Every success past those adds a die to the damage. The damage is thrown as dice too.
- **Soak.** The target may soak some of the damage by the kind of harm. Soak is a defense that either rolls dice that each take one off, or takes dice off before the damage is thrown. What is left marks their wounds.
- **Penalties and conditions.** Your wound penalty takes dice off your pools as it does off your checks, and a condition adds or takes away dice. Saving throws and contests are pools too.
- **The log** says how many dice went in, what they had to reach, how many successes they found and what soak took off.
- **Initiative and limits.** Such a ruleset may throw initiative again each round, and may limit how much of a resource you spend in one turn.

Some pool rulesets keep initiative as one number for the whole fight that attacks move. You choose how to make each attack: take some of your target's number for yourself instead of hurting them, or spend your own number as damage dice. A spending attack that hits resets your number. One that misses costs you as much as the ruleset says. Whoever falls to the ruleset's crash line (its own low limit for that number) has crashed and cannot spend until they recover. The order follows the numbers each round, and everyone's number is shown beside their health.

A ruleset that throws narrative symbol dice, such as a Genesys-style system, fights with them too. An attack throws your dice against the target's difficulty dice, symbols cancel as they do on a check and what is left decides whether it lands. The ruleset says what leftover symbols buy, so the GM is never asked.

## Contests

A ruleset may let anyone in a fight start a contest: a roll against an opponent. You can grab someone, shove them over or push them back, or break free of a hold. Both sides roll and add their own number, the higher total wins, and the menu shows your chance to win before you choose.

- Winning a grab holds your opponent in place until they break free or you go down. Losing does nothing.
- Breaking free is on the menu only while something holds you, and only against whoever holds you.
- A push moves anyone only on a battlefield, and stops at walls and at anyone in the way.

## Answer someone else's move

Some abilities answer another fighter's move instead of being taken on your own turn. The fight pauses and the menu offers your answer beside **Pass** when:

- an opponent is about to use something,
- something is aimed at you,
- an attack has just hit you, or
- something has just hurt you,

and you hold an answer for that moment. After a hit, the log says what the attack rolled and what it was made against, so you can see whether an answer such as Shield would turn it into a miss. If you take it, the same roll is checked again and the log says whether it still lands.

Opponents can answer too, with a parry of their own. A counter can stop an opponent's ability before it happens, whoever it was aimed at, while the opponent is within the counter's reach. A ruleset may say it answers only some kinds of ability, such as spells. Whatever the stopped ability cost is still spent, and nothing can answer a counter.

## On a battlefield

A ruleset may say what one square of a battlefield is worth in its own distance, in feet, paces or its own unit. When it does, and your game's **Combat Preference** is **Tactical**, the fight is fought on a battlefield: the same boards (generated or hand-made for the place), terrain and deployment as Marinara's own [Tactical battles](combat.md#tactical-battles-and-terrain). A ruleset with no distance, or a game set to **Classic**, fights without positions, and anyone can be pointed at anyone.

On the battlefield, the ruleset's own numbers decide everything:

- How far a turn can walk comes from the ruleset's movement rule or the creature's speed.
- How far a weapon reaches or carries comes from its own rows.
- An ability's area becomes a real burst, cone or line, and a wall blocks a shot.
- Standing behind something adds what the ruleset says cover adds.
- Walking out of someone's reach lets them strike at you when the ruleset says such a strike costs something.
- Movement runs in eight directions at one square each, as tabletop grids do. It is not the four-direction model of Marinara's own Tactical battles.

Using the board:

1. Every square is its own button. Use the pointer or the arrow keys. Each square says what it is, who stands on it and what it costs to walk there.
2. Choose **Move**. The squares you can reach light up with their cost in the ruleset's unit. The route is drawn as you hover or focus one. Amber marks a square whose path someone would strike at, and the people are named under the board.
3. Choose something that needs a target. The legal targets light up, and you can click them on the board or in the list.
4. For an area ability, aim at a square. The squares you may aim at are lit, and the one under your pointer says who it would catch, friends included.
5. Press <kbd>Esc</kbd> to leave a half-made choice and put the keyboard back on the menu.

You can spend movement before and after an action. The menu comes back with what is left, and the panel shows it as **Movement** in the ruleset's unit.

A ruleset can use more of the battlefield: cover in degrees up to three-quarter cover, higher ground that changes attacks and falls, creatures that fly, swim, climb or burrow, **Hide** and **Search** on the menu, and a pause that asks an opponent whether to strike when someone breaks away from them. Which of these a fight uses depends on the ruleset. A ruleset may also let a creature squeeze through a smaller space, ride a mount, or drag someone it holds. Flying over obstacles is not built yet: a flier moves like anyone else.

## Related guides

- [Game Mode: Playing with a Ruleset](rulesets.md)
- [Game Mode: Combat](combat.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Writing Game Mode Rulesets](../extending/writing-rulesets.md)
