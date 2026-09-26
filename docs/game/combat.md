# Game Mode: Combat

This guide explains combat in Marinara Engine Game Mode. Choose **Classic** menu battles or **Tactical** grid battles under **Combat Preference** in the setup wizard's **World** step. The AI Game Master (GM) establishes the encounter and narrates the results; the engine resolves battle actions.

## Tactical battles and terrain

Tactical combat places your party and enemies on a battlefield. Select a party unit, inspect its movement range, choose a destination and action, then confirm. Each party unit can act before the enemy phase. Attack forecasts show expected consequences before you commit.

When creating a Tactical game, optional battlefield settings let you choose a seed, a size and terrain guidance for the GM. Leave the seed blank for a generated seed. A seed is a whole number from 0 to 4294967295, including zero. It reproduces the board when the encounter's combatants, terrain brief and other generation inputs are the same; it does not force the GM to generate the same story or enemies.

The GM supplies the scene's environment, formation and a short terrain brief. The engine then creates the exact tiles and spawn positions. Briefs can request terrain patches and barriers near the center or an edge of the map. Terrain guidance is a request to the GM, not a guarantee that every word becomes a tile. The accepted battlefield is saved, so refreshing restores that board rather than generating another one.

The engine checks the brief and the resulting layout. It preserves requested terrain while making the generated encounter reachable. If those constraints cannot fit together, the battle reports the problem. **Use generated terrain** explicitly starts without the rejected terrain features; it does not quietly erase them. Exact hand-painted maps and a battlefield editor are not available yet.

| Terrain               | Walking                 | Defense and evasion                       |
| --------------------- | ----------------------- | ----------------------------------------- |
| Plains                | Costs 1 movement point  | No bonus                                  |
| Forest                | Costs 2 movement points | +1 defense, +15 percentage points evasion |
| Ruins                 | Costs 1 movement point  | +1 defense, +10 percentage points evasion |
| Mountain, water, wall | Blocks walking          | No bonus                                  |

Units with an established flying or teleportation capability can move differently:

- **Walking** follows reachable ground tiles. Enemy units block the path; units cannot finish on an occupied tile.
- **Flying** crosses terrain and intervening units at one movement point per tile, including forests. A flying unit can hover over an otherwise blocked tile, but cannot finish on another unit.
- **Teleportation** ignores intervening terrain and units. Its destination must be within movement range, unoccupied and walkable. It cannot end inside a wall, on a mountain tile or over unsupported water.

Both special movement modes use the current movement allowance and orthogonal tile distance. They retain the destination terrain's defense/evasion bonuses. This is a simple flat-grid movement model; altitude, ceilings, spell-specific costs and spell-specific sight requirements are not modeled.

Tactical combat uses party and enemy phases, rather than individual tabletop initiative. Movement-blocking walls do not yet block ranged attacks by line of sight. Cover, tabletop rule profiles and full summoning combat are separate future work.

## Classic battles

The remaining action-menu and dice-math sections describe Classic combat. All party members participate, but your selected command controls the first living party combatant; other companions act automatically.

## Starting an encounter

You do not start combat yourself. The GM starts a fight when the story calls for one, such as when you provoke an enemy or walk into an ambush. When that happens, a full battle screen opens over the narration. The engine builds the fight (your party, the enemies, their stats, and any special rules) from what is happening in the story.

The battle screen shows your party on one side and the enemies on the other. Each fighter has a health bar (HP, hit points) and, if they use skills, a magic bar (MP, magic points). The turn order is shown at the top as **Next:** followed by the name of whoever acts next. A round counter shows **Round** and the current round number.

### Games whose ruleset resolves its own fights

A ruleset may resolve a whole fight by its own rules rather than lending Marinara's combat a few numbers. When it does, the battle screen is that ruleset's: your character's own attacks and abilities on the menu, its own action economy, its own conditions, and a log with the real arithmetic. Everything is written to the character sheet the moment it lands.

What one turn of such a fight may hold is the ruleset's too. A blow can carry more than one kind of harm at once, each part rolled, resisted and saved against on its own while the whole blow is still one blow. One spend of an action can buy several strikes, and while any are left the menu offers them free, saying how many are in hand, so you can swing with something else or walk between them. An ability can cost nothing at all, hand you a second action for this turn only, or let you dash, disengage or hide with a smaller part of your turn. Something your character always does, such as extra damage on the first telling blow of a turn, adds itself without being chosen and says so in the log. And a condition can now make your own saving throws harder or easier, halve every kind of harm, keep you from turning on whoever put it on you, keep you from walking any nearer to them, or lift the moment they go down.

A ruleset may also let anybody in a fight start a contest: grab someone, shove them over or push them back, or break free of a hold. Both sides roll and add their own number, the higher total wins, and the menu shows your chance to win before you choose. Winning a grab holds your opponent in place until they break free or you go down; losing does nothing. Breaking free appears on the menu only while something holds you, and only against whoever is holding on. A push only moves anybody on a battlefield, and stops at walls and at anyone in the way.

Such a ruleset may also say what one square of a battlefield is worth in its own distance, in feet, paces or whatever it calls them. When it does, and your game's **Combat Preference** is **Tactical**, the fight is fought on a generated battlefield: the same boards, the same terrain and the same deployment the Tactical battles above use. Your **Combat Preference** means something again for these games, and a ruleset that says nothing about distance, or a game set to **Classic**, fights exactly as it did before, with anybody able to be pointed at anybody.

On that battlefield the ruleset's own numbers decide everything. How far a turn may walk comes from the ruleset's own movement rule or a creature's own speed; how far a weapon reaches or carries comes from its own rows; an ability's area becomes a real burst, cone or line; a wall blocks a shot; standing behind something adds what the ruleset says cover adds; and walking out of somebody's reach lets them strike at you when the ruleset says such a strike costs something. Movement runs in eight directions at one square each, which is how the tabletop grids these rules are written for are played, and it is not the four-direction model Marinara's own Tactical battles use above.

The battlefield is on screen. Every square is its own button, so the board can be walked with the pointer or with the arrow keys, and each one says what it is, who is standing on it and what it would cost to walk there. Choosing **Move** lights up the squares you can reach with their cost in the ruleset's own distance, draws the way there as you hover or focus one, and marks in amber any square whose path someone would strike at, naming them under the board. Choosing something that needs a target lights up who may be chosen and lets you click them on the board as well as in the list, and an attack that reaches nobody says **Nobody is in reach. Move closer.** rather than offering a swing at nothing. Something that lands as a shape is aimed at a square: the squares it may be aimed at are lit, and the one under your pointer says who it would catch, friends included. Movement may be spent before and after an action, so the menu simply comes back with what is left, and the panel below shows it as **Movement** in the ruleset's own unit. Escape leaves a half-made choice and puts the keyboard back on the menu.

Three-quarter cover, elevation, flying over obstacles, hiding, forced movement other than a contest's push (dragging somebody you hold, for one) and choosing whether to take a strike at somebody walking away are all separate future work.

### Games that use a ruleset

If your game uses a ruleset (see [The ruleset sheet](party-and-npcs.md#the-ruleset-sheet)) and that ruleset says battles may read the sheet, each party member starts the fight with whichever resource pool and spell slots the ruleset set up for battles, as their sheet has them right now. The abilities they picked from the ruleset's catalogs become skills when Marinara's combat can use them: an entry that only describes something out of combat, a reaction, or one whose cost the battle cannot charge is left out. Hit points are carried as a share of the maximum rather than as the sheet's own number: a character at half health on the sheet starts the fight at half the health bar the battle screen gives them, because the numbers in battle are Marinara's. A sheet with 9 health does not walk into a fight where one hit does 12. When the fight ends, the health lost or regained is carried back the same way, and the slots and resources spent are written back as they are. The rest of the battle is unchanged: the dice math on this page is still Marinara's, and attack rolls, saving throws and concentration from the tabletop system are not applied. A fight you leave by deleting the message it started in writes nothing back, because it did not happen. A ruleset that says nothing about battles leaves combat exactly as it is described here.

## The action menu

On your turn, you pick one action from the menu. The six actions are:

- **Attack**: strike one enemy with a basic attack.
- **Skills**: use a special ability. Skills can cost MP. Some heal an ally, some hit an enemy, and some apply a buff or debuff.
- **Special**: type a free-form action in your own words, then press **Ask GM**. For example, "I kick sand into the Ruin Guard's cracked lens." The GM decides what happens.
- **Defend**: raise your Defense for the rest of the round to take less damage.
- **Items**: use an item from your bag. Choose **Full inventory** to open your full item list from here.
- **Flee**: leave the fight at once. Fleeing ends combat immediately.

After you choose, the round plays out. The results appear as floating damage numbers, changing health bars, and lines in the combat log.

## How combat math works

Once a fight begins, each round is decided by fixed dice math, not by the AI. The GM only narrates the results. It never decides who hits or how much damage lands. This means combat is fair and consistent. A "d20" below means a roll of one twenty-sided die (a number from 1 to 20).

### Initiative (turn order)

At the start of each round, every fighter rolls a d20 and adds a bonus based on their Speed. Higher totals act first. A fighter skips the whole round if they are frozen, stunned, or imprisoned, or if their Speed has dropped to 0.

### Attack and defense

When one fighter attacks another:

1. The attacker rolls a d20 and adds a bonus from their Attack stat.
2. The defender rolls a d20 and adds a bonus from their Defense stat.
3. If the attacker's total is lower than the defender's total, the attack misses.
4. A critical hit lands on a natural 20, or when the attacker beats the defender by 10 or more.

### Damage

On a hit, base damage comes from the attacker's Attack stat and grows with their level. Extra damage dice are added, and higher-level fighters roll more of them. A critical hit multiplies the total by 1.5. The defender's Defense then reduces the damage, blocking up to 40 percent of their Defense value.

### Difficulty scaling

The last step scales damage by the game's Difficulty, which you set in the setup wizard. The four settings multiply final damage like this:

| Difficulty | Damage multiplier |
| ---------- | ----------------- |
| Casual     | 0.6               |
| Normal     | 1.0               |
| Hard       | 1.3               |
| Brutal     | 1.6               |

Higher difficulty means both sides hit harder, so fights are shorter and riskier.

## Status effects and elemental reactions

A status effect is a temporary change to a fighter's Attack, Defense, Speed, or HP. Buffs help and debuffs hurt. A status lasts a set number of rounds, then wears off. Poison-style effects drain HP each round, while regeneration-style effects restore it. Three named effects, frozen, stunned, and imprisoned, make the affected fighter skip their turn.

Some attacks and skills carry an element: Fire, Ice, Lightning, Poison, Holy, or Shadow. The first element to hit a target leaves an aura, which is a lingering trace of that element. A different element striking the same target then triggers an elemental reaction. The reaction adds bonus damage and often a status effect.

Example reactions include Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse, and Electrotoxin. This system runs on its own. You do not turn it on or configure it. Reactions happen automatically when the right elements chain on the same target.

## Boss mechanics and loot

Strong enemies can have boss mechanics, which are special rules the GM writes for that fight. A mechanic can trigger on a schedule, such as every few rounds, or when the boss drops below a set health level. Mechanics can hit your whole party, buff the boss, or apply a status effect. When one triggers, the effect appears in the combat log so you can react.

When you win a fight, the enemies drop loot. Each item has a rarity, from most to least common: common, uncommon, rare, epic, and legendary. Harder difficulty tilts the drops toward rarer items and hands out slightly more of them. A **Victory!** banner appears when you win, and a **Defeat...** banner appears if your party falls.

## Interrupting the GM

While the GM is still writing its response, you can cut in with the **Interrupt** button. Nothing you type is committed until you actually send it. Clicking **Interrupt** opens a confirmation window titled **Attempt to Interrupt?** with three choices:

- **No**: cancel and let the GM keep writing.
- **Force Interrupt**: cut in cleanly. The GM is not told that you interrupted. Your input box gets a green outline.
- **Yes**: attempt an in-story interruption that the GM may resist. Your input box turns red, and the app hints "using dice recommended" while the dice button pulses. Rolling dice here can help your attempt succeed.

After you confirm, type your message and send it. If you change your mind, press **Resume** to drop the pending interrupt and let the narration continue. This control is useful in a tense moment, such as reacting the instant before a fight breaks out.

## Quick-Time Events

The GM can trigger a Quick-Time Events overlay, also called a QTE, for fast action beats like dodging or chasing. The overlay shows a shrinking countdown bar, a **React quickly!** prompt, and one button per choice. Each button is numbered (1, 2, 3, and so on). Click the button for the action you want.

Pick an action before the timer runs out to earn a bonus. The faster you react, the bigger the bonus. If the timer runs out first, you take a penalty instead. A Quick-Time Event uses no dice. It is pure speed.

## Combat on mobile

On a phone, the battle screen rearranges itself so it fits a small display. The action buttons stick to the bottom of the screen. Panels that do not fit inline move into a slide-up drawer with four tabs:

- **Party**: your party members and their health.
- **Boss Mechanics**: the special rules for the current fight.
- **Dialogue**: battle lines spoken by fighters.
- **Combat Log**: the round-by-round record of what happened.

Tap a tab to open its drawer. To close it, tap outside the drawer or tap the close button.

## Related guides

- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Game Mode: Getting Started](getting-started.md)
- [Roleplay Combat Encounters](../roleplay/combat-encounters.md)
