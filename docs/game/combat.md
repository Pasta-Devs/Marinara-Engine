# Game Mode: Combat

This guide explains Classic combat in Marinara Engine Game Mode. Classic is the cinematic, menu-driven presentation. Tactical is the grid-based alternative and has its own [Tactical Combat guide](tactical-combat.md). Both styles use the same server-owned session rules for deterministic rolls, duplicate-action protection, objectives, boss phases, inventory, restoration, and aftermath. The AI Game Master (GM) narrates authoritative results instead of deciding the math.

## Starting an encounter

You do not start combat yourself. The GM starts a fight when the story calls for one, such as when you provoke an enemy or walk into an ambush. When that happens, a full battle screen opens over the narration. The engine builds the fight (your party, the enemies, their stats, and any special rules) from what is happening in the story.

The battle screen shows your party on one side and the enemies on the other. Each fighter has a health bar (HP, hit points) and, if they use skills, a magic bar (MP, magic points). The turn order is shown at the top as **Next:** followed by the name of whoever acts next. A round counter shows **Round** and the current round number.

## The action menu

On your turn, you pick one action from the menu. The six actions are:

- **Attack**: strike one enemy with a basic attack.
- **Skills**: use a special ability. Skills can cost MP. Some heal an ally, some hit an enemy, and some apply a buff or debuff.
- **Special**: type a free-form maneuver in your own words. The GM proposes a small structured set of effects from the current battle, then the deterministic resolver rolls success, partial success, or failure and applies only legal, capped effects. The GM narrates the result but cannot rewrite arbitrary combat state.
- **Defend**: raise your Defense for the rest of the round to take less damage.
- **Items**: use an item from your bag. Choose **Full inventory** to open your full item list from here.
- **Flee**: leave an ordinary fight at once. When escape is the encounter objective, you must first complete its exit interaction; an early attempt does not end combat.

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

Difficulty scales enemy damage. Party attacks keep their normal damage, so harder settings increase danger instead of making every participant hit harder.

## Sessions, objectives, and restoration

The server owns the current combatants, random seed, roll cursor, items, objectives, and action history. A browser action includes the session revision it was based on. A stale tab must refresh instead of overwriting a newer turn, and retrying the same action ID returns the original result without spending MP or an item twice.

Defeating every enemy is the default objective. Encounters can instead require survival, escape, defense, escort, capture, interruption, or a conditional defeat. Special, capture, interruption, escort, and conditional actions advance only when the structured maneuver result explicitly affects that objective. Boss phases can trigger from HP thresholds or scheduled rounds, emit a telegraph before their mechanic resolves, and call bounded reinforcement waves into valid positions.

Refreshing restores the active session. Leaving through the pre-combat return control abandons it. Victory, defeat, fleeing, restart, chat reset, and chat deletion all finalize or clean up their session.

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

- [Game Mode: Tactical Combat](tactical-combat.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Game Mode: Getting Started](getting-started.md)
- [Roleplay Combat Encounters](../roleplay/combat-encounters.md)
