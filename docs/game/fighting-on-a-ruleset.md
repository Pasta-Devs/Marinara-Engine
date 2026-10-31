# Game Mode: Fights on a Ruleset

Some rulesets resolve a whole fight by their own rules instead of lending Marinara's combat a few numbers. This guide covers what a fight looks like in a game on such a ruleset, such as 5e (SRD 5.1). For games on Marinara's own rules, see [Game Mode: Combat](combat.md). For choosing a ruleset and what else it changes, see [Playing with a Ruleset](rulesets.md).

You do not start these fights yourself. The Game Master starts one when the story calls for it, exactly as in any other game, and the Engine builds it from the party's own sheets and the ruleset's own creatures, or from opponents the Game Master describes in the ruleset's terms.

## The battle screen

The battle screen is the ruleset's own. The menu is your character's own attacks and abilities, each saying what it spends out of the ruleset's own action economy and pools; the panel below shows the turn order, the round, everybody's conditions by the ruleset's own names, and what is left of each budget; and the log prints the real arithmetic, such as "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Every action is written to the character sheet the moment it lands, so closing the tab mid-fight loses nothing and the Game Master is told afterwards that the numbers are already settled.

## What a turn can hold

What one turn holds is up to the ruleset. A blow can carry more than one kind of harm at once, each part rolled, resisted and saved against on its own while the whole blow is still one blow. One spend of an action can buy several strikes, and while any are left the menu offers them free, saying how many are in hand, so you can swing with something else or walk between them. An ability can cost nothing at all, hand you a second action for this turn only, or let you dash, disengage or hide with a smaller part of your turn. Something your character always does, such as extra damage on the first telling blow of a turn, adds itself without being chosen and says so in the log.

## Conditions

A condition can make your own saving throws harder or easier, halve every kind of harm, keep you from turning on whoever put it on you, keep you from walking any nearer to them, or lift the moment they go down. A condition can also change a number: add to your defense, add dice to or take them from your attack rolls, saving throws and contests, or slow you down. The log shows each one beside the roll it changed, and the menu's chances count it. Some conditions last until the start of your next turn, or only until the next attack or save they are about. A ruleset can also count something such as exhaustion on a track on your sheet, so that each level you reach makes things a little worse for as long as it lasts.

## Rulesets that throw a pool of dice

A ruleset whose checks throw a handful of dice and count the ones that reach a target can fight the same way. Then an attack throws your pool and needs a number of successes to land, never fewer than one, and every success past those adds a die to the damage. The damage is thrown as dice too, and the one it hits may soak some of it by the kind of harm, either rolling soak dice that each take one off or taking dice off before the damage is thrown; what is left marks their wounds. Your wound penalty takes dice off your pools as it does off your checks, and a condition adds dice or takes them away. Saving throws and contests are pools as well. The log says how many dice went in, what they had to reach, how many successes they found and what soak took off. Such a ruleset may also throw initiative again at the start of every round, and may limit how much of a resource you can spend in one turn, so something that would go past the limit is simply not on the menu until your next turn. A pool ruleset can also keep initiative as a number for the whole fight that attacks move: you choose how to make each attack, either taking some of your target's number for yourself instead of hurting them or spending your own number as the damage dice. A spending attack that hits resets your number; one that misses costs you as much of it as the ruleset says. Whoever falls to the ruleset's crash line has crashed and cannot spend until they recover. The order follows the numbers each round, and everybody's number is shown beside their health.

A ruleset that throws narrative symbol dice, such as a Genesys-style system, fights with them too. An attack throws your dice against the target's difficulty dice, the symbols cancel as they do on a check, and what is left decides whether it lands. The ruleset says what the leftover symbols buy, so the Game Master is never asked.

## Contests

A ruleset may also let anybody in a fight start a contest: grab someone, shove them over or push them back, or break free of a hold. Both sides roll and add their own number, the higher total wins, and the menu shows your chance to win before you choose. Winning a grab holds your opponent in place until they break free or you go down; losing does nothing. Breaking free appears on the menu only while something holds you, and only against whoever is holding on. A push only moves anybody on a battlefield, and stops at walls and at anyone in the way.

## Answering someone else's move

Some abilities answer somebody else's move instead of being taken on your own turn. When an opponent is about to use something, when something is aimed at you, when an attack has just hit you, or when something has just hurt you, and you hold an answer for that moment, the fight pauses and the menu offers it beside **Pass**. After a hit, the log says what the attack rolled and what it was made against, so you can see whether an answer such as Shield would turn it into a miss; if you take it, the same roll is checked again and the log says whether it still lands. Opponents can answer like this too, with a parry of their own. A counter can stop an opponent's ability before it happens, whoever it was aimed at, as long as the opponent is within the counter's reach; a ruleset may say it answers only some kinds of ability, such as spells. Whatever the stopped ability cost is still spent, and nothing can answer a counter.

## On a battlefield

A ruleset may say what one square of a battlefield is worth in its own distance, in feet, paces or whatever it calls them. When it does, and your game's **Combat Preference** is **Tactical**, the fight is fought on a battlefield: the same boards, generated or hand-made for the place, the same terrain and the same deployment that Marinara's own [Tactical battles](combat.md#tactical-battles-and-terrain) use. A ruleset that says nothing about distance, or a game set to **Classic**, fights without positions, with anybody able to be pointed at anybody.

On that battlefield the ruleset's own numbers decide everything. How far a turn may walk comes from the ruleset's own movement rule or a creature's own speed; how far a weapon reaches or carries comes from its own rows; an ability's area becomes a real burst, cone or line; a wall blocks a shot; standing behind something adds what the ruleset says cover adds; and walking out of somebody's reach lets them strike at you when the ruleset says such a strike costs something. Movement runs in eight directions at one square each, which is how the tabletop grids these rules are written for are played, and it is not the four-direction model Marinara's own Tactical battles use.

The battlefield is on screen. Every square is its own button, so the board can be walked with the pointer or with the arrow keys, and each one says what it is, who is standing on it and what it would cost to walk there. Choosing **Move** lights up the squares you can reach with their cost in the ruleset's own distance, draws the way there as you hover or focus one, and marks in amber any square whose path someone would strike at, naming them under the board. Choosing something that needs a target lights up who may be chosen and lets you click them on the board as well as in the list, and an attack that reaches nobody says **Nobody is in reach. Move closer.** rather than offering a swing at nothing. Something that lands as a shape is aimed at a square: the squares it may be aimed at are lit, and the one under your pointer says who it would catch, friends included. Movement may be spent before and after an action, so the menu simply comes back with what is left, and the panel below shows it as **Movement** in the ruleset's own unit. Escape leaves a half-made choice and puts the keyboard back on the menu.

A ruleset can also use more of the battlefield: cover in degrees, up to three-quarter cover; higher ground that changes attacks and falls; creatures that fly, swim, climb or burrow; **Hide** and **Search** on the menu; and, when somebody breaks away from an opponent, a pause that asks the opponent whether to strike. Which of these a fight uses depends on the ruleset. A ruleset may also let a creature squeeze through a space smaller than itself, ride a mount, or drag somebody it holds as it walks. Flying over obstacles is not built yet: a flier is moved like anybody else.

## Related guides

- [Game Mode: Playing with a Ruleset](rulesets.md)
- [Game Mode: Combat](combat.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Writing Game Mode Rulesets](../extending/writing-rulesets.md)
