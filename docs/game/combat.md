# Game Mode: Combat

Combat in Game Mode comes in two kinds: **Classic** menu battles and **Tactical** grid battles. You choose between them with **Combat Preference** on the setup wizard's **World** step. To change it later, open **Chat Settings**, expand **Combat Style** and pick a **Battle system**. A ruleset that runs its own fights can limit the choices. The Game Master (GM, the AI that runs the game) sets up the encounter and narrates the result. Marinara resolves the battle actions with fixed dice math, so the AI never decides who hits.

## Starting an encounter

You do not start combat yourself. The GM starts a fight when the story calls for one, such as when you provoke an enemy or walk into an ambush. A full battle screen then opens over the narration, built from what is happening in the story: your party, the enemies, their stats and any special rules.

The screen shows your party on one side and the enemies on the other. Each fighter has a health bar (HP, hit points) and, if they use skills, a magic bar (MP, magic points). The top shows **Next:** and the name of whoever acts next, and **Round** with the round number.

> **Note:** In a game on a ruleset that resolves its own fights, such as 5e (SRD 5.1), the fight follows the ruleset, not this page. See [Fights on a Ruleset](fighting-on-a-ruleset.md). A ruleset that only lends its sheet to battles keeps the combat here. See [What happens in battles](rulesets.md#what-happens-in-battles).

## Play a Classic battle

A Classic battle has no board. All party members take part. You choose the action for one character, the first living party member. The other companions act on their own.

On your turn, pick one action:

| Action | What it does |
| --- | --- |
| **Attack** | Strikes one enemy with a basic attack. |
| **Skills** | Uses a special ability. Skills can cost MP. Some heal an ally, some hit an enemy, some apply a buff or debuff. |
| **Special** | Type a free-form action in your own words, then press **Ask GM**, for example "I kick sand into the Ruin Guard's cracked lens." The GM decides what happens. |
| **Defend** | Raises your Defense for the rest of the round, so you take less damage. |
| **Items** | Uses an item from your bag. **Full inventory** opens your full item list. |
| **Flee** | Leaves the fight at once. It always works and ends combat immediately. |

After you choose, the round plays out. Results appear as floating damage numbers, changing health bars and lines in **Combat Log**. A **Victory!** banner appears when you win and a **Defeat...** banner if your party falls.

In a game with a ruleset, **Items** does what the ruleset says for the ruleset's own items: how much they heal or harm and which conditions they add. An item with charges is offered while a use is left. An item that asks for a check first has it rolled, and if it fails the item is spent for nothing. An item the ruleset gives no use to is not offered. Other items do what the GM judged when the fight began, unless the ruleset turns off Game Mode's own items.

## Play a Tactical battle

Tactical combat places your party and the enemies on a grid battlefield. Each square is a tile, such as **Plains** or **Forest**.

1. When it is your turn (**Player Phase**, or a unit's name shows "'s turn"), click one of your units on the grid. Its movement range shows on the board.
2. Click a destination tile, then click **Confirm Move**. Click **Reset Move** to pick again.
3. After moving, the board says "Already moved — choose an action." Choose **Attack**, **Defend** or **Item**. **Flee** is also here.
4. For **Attack**, the board says **Select an enemy**. Click one. The attack forecast shows the expected result. Click **Confirm** to commit. **← Back** goes back one step.
5. Click **End Turn** when you are done. In the party-first turn order, the **Enemy Phase** then plays.

If the board shows **Resolving…**, wait a moment. **Restart** restarts the battle from the beginning on the same battlefield, after you confirm.

Who acts when depends on **Turn order**. See [Turn order](#turn-order). Hand-made boards and terrain rules are in [Tactical battles and terrain](#tactical-battles-and-terrain).

## Interrupt the GM

While the GM is writing, you can cut in with the **Interrupt** button. Nothing you type is committed until you send it.

1. Click **Interrupt**. A window titled **Attempt to Interrupt?** opens.
2. Choose one:
   - **No** cancels and lets the GM keep writing.
   - **Force Interrupt** cuts in cleanly. The GM is not told you interrupted. Your input box gets a green outline.
   - **Yes** attempts an in-story interruption that the GM may resist. Your input box turns red and the app hints "using dice recommended" while the dice button pulses. Rolling dice can help.
3. Type your message and send it.

To change your mind, press **Resume**. It drops the pending interrupt and the narration continues.

## Quick-Time Events

The GM can trigger a Quick-Time Event (QTE) for fast beats such as dodging or chasing. The overlay shows a shrinking countdown bar, a **React quickly!** prompt and one numbered button per choice. Click the action you want before the timer runs out to earn a bonus. The faster you react, the bigger the bonus. If time runs out, you take a penalty instead. A QTE uses no dice.

To turn QTEs off, for screen-reader or untimed play, turn off **Quick Time Events** on the wizard's **Features** step.

## Combat on a phone

On a phone, the action buttons stick to the bottom of the screen. Panels that do not fit move into a slide-up drawer with four tabs: **Party** (members and health), **Boss Mechanics** (the fight's special rules), **Dialogue** (battle lines spoken by fighters) and **Combat Log** (the round-by-round record). Tap a tab to open its drawer. Tap outside the drawer or its close button to close it.

## How combat math works

Each round is decided by fixed dice math, not by the AI. This keeps combat fair and consistent. A d20 is a twenty-sided die (1 to 20). The initiative, attack and damage rules below are how Classic battles play. They are Marinara's own rules, not those of a ruleset. For Tactical battles, see [Turn order](#turn-order) and [Sight, cover and height](#sight-cover-and-height).

**Initiative.** At the start of each round, every fighter rolls a d20 and adds a bonus from their Speed (Speed divided by 5, rounded down). Higher totals act first. A fighter skips the round if frozen, stunned or imprisoned, or if their Speed has dropped to 0.

**Attack and defense.** When one fighter attacks another:

1. The attacker rolls a d20 and adds a bonus from their Attack stat.
2. The defender rolls a d20 and adds a bonus from their Defense stat.
3. If the attacker's total is lower, the attack misses.
4. A critical hit lands on a natural 20, or when the attacker beats the defender by 10 or more.

**Damage.** On a hit, base damage comes from the attacker's Attack stat and grows with level. Extra d6 dice are added, and higher-level fighters roll more of them. A critical hit multiplies the total by 1.5. The defender's Defense then blocks up to 40 percent of its own value from that damage.

### Difficulty scaling

Next, damage is scaled by the **Difficulty** you set in the setup wizard. Weather and status-effect modifiers then apply after it. The multiplier applies only to attacks by enemies, so a harder game makes enemies hit harder while your party's damage stays the same.

| Difficulty | Enemy damage multiplier |
| --- | --- |
| Casual | 0.6 |
| Normal | 1.0 |
| Hard | 1.3 |
| Brutal | 1.6 |

These multipliers belong to Marinara's own rules. A ruleset supplies its own difficulty policy.

## Status effects and elemental reactions

A status effect is a temporary change to a fighter's Attack, Defense, Speed or HP. Buffs help and debuffs hurt. A status lasts a set number of rounds, then wears off. Poison-style effects drain HP each round and regeneration-style effects restore it. Frozen, stunned and imprisoned make the fighter skip their turn.

Some attacks and skills carry an element. The first element to hit a target leaves an aura, a lingering trace. A different element hitting the same target triggers an elemental reaction, which adds bonus damage and often a status effect. Reactions include Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse and Electrotoxin. They happen automatically, and you do not turn them on.

### Elements

Which elements exist belongs to the setting:

- No setting kit, or a kit that names none: the classic six (fire, ice, lightning, poison, holy, shadow).
- Wuxia: the five phases (wood, fire, earth, metal, water), each overcoming the next.
- Cyberpunk and space opera: kinetic, thermal, EM, and chemical or plasma.
- Modern day and 1920s: none.

Rain and storms on open ground damp fire-like elements and feed lightning-like ones. In a tactical fight, an element hits harder against one it beats and softer against one that beats it. You can change a kit's elements and reactions under **Change its words**. See [Choosing a setting kit](getting-started.md#choosing-a-setting-kit).

## Boss mechanics and loot

Strong enemies can have boss mechanics, special rules the GM writes for that fight. A mechanic triggers on a schedule, such as every few rounds, or when the boss drops below a set health. It can hit your whole party, buff the boss or apply a status effect. When one triggers, **Combat Log** shows it so you can react.

When you win, the enemies drop loot, which goes straight into the party's bags. Items have a rarity, from common to uncommon, rare, epic and legendary. Higher difficulty tilts drops toward rarer items and gives slightly more of them. A notification says what dropped, and the GM is told it is already in your bags.

What drops belongs to your setting. A game with a setting kit drops the kit's own loot (a modern-day game drops a gift card or a first-aid kit, never an enchanted sword), and you can change those words under **Change its words**. A game without a kit drops what its genre usually has. A genre with no starter kit, such as Steampunk, drops plain things that belong to no setting. In a game whose ruleset has its own loot tables, enemies drop the ruleset's items instead, and a ruleset that turns Game Mode's own items off drops only its own.

## Reference: tactical battles

### Tactical battles and terrain

There are no battlefield settings to fill in when you create a game. Each fight gets its own board, generated from a new seed and the GM's brief for the scene. The GM supplies the environment, formation and a short terrain brief, which can ask for terrain patches and barriers near the center or an edge. Marinara creates the exact tiles and spawn positions. The accepted battlefield is saved, so a refresh restores that board.

Marinara checks the brief and the layout. It keeps the requested terrain while keeping the encounter reachable.

If the constraints cannot fit together, the battle reports the problem. **Use generated terrain** then starts without the rejected terrain features. It never erases them quietly.

A world can also have hand-made battlefields: boards painted tile by tile for one of its places with a world editor such as Pixelforge. When a fight starts at that place, or inside it, it uses one of those boards instead of a generated one.

- The board is used exactly as painted. If the place has several, the fight's seed (a number that picks one) chooses.
- The GM's terrain brief is not used there, but its formation still decides where each side starts. The GM is told the board was made for this place.
- A hand-made board must follow three rules: it is one of the three board sizes, the two columns at each side are plains where the sides line up, and every tile a fighter can stand on connects to the rest. The maker refuses a board that breaks a rule and says why.

These boards are kept with the world's hand edits, so they travel in world files, map packs and the library.

| Terrain | Walking | Defense and evasion |
| --- | --- | --- |
| Plains | Costs 1 movement point | No bonus |
| Forest | Costs 2 movement points | +1 defense, +15 percentage points evasion |
| Ruins | Costs 1 movement point | +1 defense, +10 percentage points evasion |
| Mountain, water, wall | Blocks walking | No bonus |

Units with an established flying or teleportation ability move differently:

- **Walking** follows reachable ground tiles. Enemy units block the path, and units cannot finish on an occupied tile.
- **Flying** crosses terrain and units at one movement point per tile, including forests. A flier can hover over an otherwise blocked tile but cannot finish on another unit.
- **Teleportation** ignores terrain and units in between. The destination must be within movement range, unoccupied and walkable. It cannot end inside a wall, on a mountain or over unsupported water.

Both special modes use the current movement allowance and straight (not diagonal) tile distance. They keep the destination terrain's defense and evasion bonuses and ignore height. A flier's altitude, ceilings, spell-specific costs and spell-specific sight requirements are not modeled. Summoning is not part of Marinara's own combat yet.

### Turn order

A Tactical battle takes turns in one of two ways:

- **One at a time, by initiative**: every unit gets a place in a rolled order and only the unit whose turn it is can act. The board shows the order. New Overworld RPG games use this.
- **Your whole party, then the enemies**: each party unit can act, then the enemy phase plays. Classic games use this.

To change it, open **Chat Settings**, expand **Combat Style** and pick a **Turn order**. It appears while the **Battle system** is Tactical, unless the game's ruleset runs its own fights. The change applies from the next battle. A battle in progress keeps its order.

### Sight, cover and height

- **Sight.** Walls and mountains block sight. A unit can attack, use a skill or use an item only on a target it can see.
- **Cover.** Something between attacker and target protects the target. A forest or ruins tile in the way, or a wall or mountain blocking part of the view, gives half cover. A wall or mountain blocking most of the view gives three-quarter cover. Half cover takes 15 percentage points off the hit chance and three-quarter cover 30. A target's own tile bonus and its cover do not add up: the better one counts.
- **Height.** On a board with mountains, a mountain stands two levels high and the ground around it one. Walking up one level costs one more movement point, and walking down costs nothing. A step of two levels or more is a cliff nobody can walk. Higher ground also blocks sight between two lower tiles. Attacking down from higher ground adds 10 to the hit chance, a ranged attack from higher ground reaches one tile farther, and low cover such as a forest does not hide a target from above. Hand-made battlefields can have cliffs of their own.

### Battlefield scenes

A tactical board is laid out like the kind of place the fight happens in: a forest has trees to hide among, a dungeon has walls and corridors, a city has streets. A game with a setting kit names its own scenes in its words, so a cyberpunk fight happens on a rooftop or in a megablock corridor and a wuxia fight in a bamboo forest or a teahouse. The board's tiles use the setting's words too (cover and debris rather than forest and ruins). You can change a kit's scenes and tile words under **Change its words**.

## Related guides

- [Game Mode: Fights on a Ruleset](fighting-on-a-ruleset.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Game Mode: Getting Started](getting-started.md)
- [Roleplay Combat Encounters](../roleplay/combat-encounters.md)
