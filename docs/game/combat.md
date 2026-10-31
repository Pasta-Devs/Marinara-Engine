# Game Mode: Combat

This guide explains combat in Marinara Engine Game Mode. Choose **Classic** menu battles or **Tactical** grid battles under **Combat Preference** in the setup wizard's **World** step. The AI Game Master (GM) establishes the encounter and narrates the results; the engine resolves battle actions.

## Starting an encounter

You do not start combat yourself. The GM starts a fight when the story calls for one, such as when you provoke an enemy or walk into an ambush. When that happens, a full battle screen opens over the narration. The engine builds the fight (your party, the enemies, their stats, and any special rules) from what is happening in the story.

The battle screen shows your party on one side and the enemies on the other. Each fighter has a health bar (HP, hit points) and, if they use skills, a magic bar (MP, magic points). The turn order is shown at the top as **Next:** followed by the name of whoever acts next. A round counter shows **Round** and the current round number.

In a game whose ruleset resolves its own fights, such as 5e (SRD 5.1), the fight is the ruleset's, not the one this page describes. See [Fights on a Ruleset](fighting-on-a-ruleset.md). A ruleset that lends its sheet to battles keeps the combat here; see [What happens in battles](rulesets.md#what-happens-in-battles).

## Tactical battles and terrain

Tactical combat places your party and enemies on a battlefield. Select a party unit, inspect its movement range, choose a destination and action, then confirm. Who acts when depends on the battle's **Turn order** (see [Turn order](#turn-order)). Attack forecasts show expected consequences before you commit.

There are no battlefield settings to fill in when you create a game. Each fight gets a board of its own, generated from a new seed and from the GM's brief for that scene.

The GM supplies the scene's environment, formation and a short terrain brief. The engine then creates the exact tiles and spawn positions. Briefs can request terrain patches and barriers near the center or an edge of the map. The accepted battlefield is saved, so refreshing restores that board rather than generating another one.

The engine checks the brief and the resulting layout. It preserves requested terrain while making the generated encounter reachable. If those constraints cannot fit together, the battle reports the problem. **Use generated terrain** explicitly starts without the rejected terrain features; it does not quietly erase them.

A game's world can also have **hand-made battlefields**. These are boards painted tile by tile for one of the world's places, with a maker such as Pixelforge. When a fight starts while the party is at that place, or at a place inside it, the fight uses one of those boards instead of a generated one. The board is used exactly as painted, in the scene it was painted for. If the place has several boards, the fight's seed picks one. The GM's terrain brief is not used there, but its formation still decides where each side starts. The GM is told the board was made for this place, and the battlefield line names the board.

A hand-made board must follow three rules. It is one of the three board sizes. The two columns at each side are plains, where the sides line up. Every tile a fighter can stand on connects to the rest. The maker refuses a board that breaks a rule and says why. Hand-made battlefields are kept with the world's hand edits, so they travel with it in world files, map packs and the library.

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

Both special movement modes use the current movement allowance and orthogonal tile distance. They retain the destination terrain's defense/evasion bonuses. Both ignore height (see below). A flier's altitude, ceilings, spell-specific costs and spell-specific sight requirements are not modeled.

### Turn order

A Tactical battle takes turns in one of two ways:

- **One at a time, by initiative**: every unit gets a place in a rolled order, and only the unit whose turn it is can act. The board shows the turn order. New Overworld RPG games use this.
- **Your whole party, then the enemies**: each party unit can act, then the enemy phase plays. Classic games use this.

To change it, open **Chat Settings**, expand **Combat Style**, and pick a **Turn order**. It appears while the **Battle system** is Tactical, unless the game's ruleset runs its own fights. The change takes effect at the next battle; a battle already in progress keeps its order.

### Sight, cover and height

- **Sight.** Walls and mountains block sight. A unit can attack, use a skill or use an item only on a target it can see.
- **Cover.** Something between the attacker and the target protects the target. A forest or ruins tile in the way, or a wall or mountain that blocks part of the view, gives half cover. A wall or mountain that blocks most of the view gives three-quarter cover. Half cover takes 15 percentage points off the hit chance and three-quarter cover 30. The target's own tile bonus and its cover do not add up: the better one counts.
- **Height.** On a board with mountains, a mountain stands two levels high and the ground around it one level. Walking up one level costs one more movement point, and walking down costs nothing. A step of two levels or more is a cliff, which nobody can walk. Higher ground also blocks sight between two lower tiles. Attacking down from higher ground adds 10 to the hit chance, a ranged attack from higher ground reaches one tile farther, and low cover such as a forest does not hide a target from above. Hand-made battlefields can have cliffs of their own.

Summoning is not part of Marinara's own combat yet.

## Classic battles

A Classic battle has no board. All party members take part, but your chosen action controls the first living party member; the other companions act on their own. The action menu and the combat math below are how Classic battles play.

## The action menu

On your turn, you pick one action from the menu. The six actions are:

- **Attack**: strike one enemy with a basic attack.
- **Skills**: use a special ability. Skills can cost MP. Some heal an ally, some hit an enemy, and some apply a buff or debuff.
- **Special**: type a free-form action in your own words, then press **Ask GM**. For example, "I kick sand into the Ruin Guard's cracked lens." The GM decides what happens.
- **Defend**: raise your Defense for the rest of the round to take less damage.
- **Items**: use an item from your bag. Choose **Full inventory** to open your full item list from here. In a game with a ruleset, the ruleset's own items do what the ruleset says: how much they heal or harm, and the conditions they put on. One that holds charges is offered while a use is left, and one that asks a check first has it rolled when it is used: failed, it is spent for nothing. One the ruleset gives no use to is not offered. The rest of your items do what the Game Master judged when the fight began, unless the ruleset turns off Game Mode's own items.
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

## Elements

Attacks, skills and items can carry an element, and an element that lands on a target still wearing another's aura can set off a reaction that hits harder. Which elements exist belongs to the setting: a game without a setting kit, or with one that names none, fights with the classic six (fire, ice, lightning, poison, holy and shadow); a wuxia game with the five phases (wood, fire, earth, metal and water, each overcoming the next); a cyberpunk or space opera game with kinetic, thermal, EM and chemical or plasma; and a modern-day or 1920s game with none at all. Rain and storms on open ground damp fire-like elements and feed lightning-like ones. In a tactical fight, an element hits harder against one it beats and softer against one that beats it. You can change a kit's elements and their reactions under **Change its words**.

## Battlefields

A tactical fight's board is laid out like the kind of place the fight happens in: a forest has trees to hide among, a dungeon walls and corridors, a city streets. A game with a setting kit names its own scenes in its words, each laid out like one of those boards, so a cyberpunk fight happens on a rooftop or in a megablock corridor and a wuxia fight in a bamboo forest or a teahouse, and the board's tiles go by the setting's words too (cover and debris rather than forest and ruins). The map of an area and the small details the Game Master is prompted to notice follow the setting the same way. You can change a kit's scenes and tile words under **Change its words**.

## Boss mechanics and loot

Strong enemies can have boss mechanics, which are special rules the GM writes for that fight. A mechanic can trigger on a schedule, such as every few rounds, or when the boss drops below a set health level. Mechanics can hit your whole party, buff the boss, or apply a status effect. When one triggers, the effect appears in the combat log so you can react.

When you win a fight, the enemies drop loot, and it goes straight into the party's bags once the fight ends. Each item has a rarity, from most to least common: common, uncommon, rare, epic, and legendary. Harder difficulty tilts the drops toward rarer items and hands out slightly more of them. What drops belongs to your setting: a game with a setting kit drops the kit's own loot (a modern-day game drops a gift card or a first-aid kit, never an enchanted sword), and you can change those words under the kit's **Change its words**. A game without a kit drops what its genre usually has, and a genre with no starter kit, such as Steampunk, drops plain things that belong to no particular setting. A notification says what dropped, and the Game Master is told it is already in your bags. In a game whose ruleset has its own loot tables, the enemies drop the ruleset's items instead, and a ruleset that turns Game Mode's own items off drops only its own. A **Victory!** banner appears when you win, and a **Defeat...** banner appears if your party falls.

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

- [Game Mode: Fights on a Ruleset](fighting-on-a-ruleset.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Game Mode: Getting Started](getting-started.md)
- [Roleplay Combat Encounters](../roleplay/combat-encounters.md)
