# Game Mode: Tactical Combat

Tactical combat is Game Mode's grid-based battle style. It uses the same party, enemies, skills, items, statuses, objectives, and deterministic server resolver as Classic combat, but adds direct movement and battlefield positioning.

Choose **Tactical** as the combat style when creating or configuring a Game Mode chat. Classic combat remains available for players who prefer a faster cinematic menu battle.

## Server-owned battles

Every battle has a combat session stored by the server. The session owns the battlefield, combatants, inventory, objectives, random seed, action history, and current revision. The browser sends only the selected action and the revision it acted on.

This prevents a refresh, repeated click, retry, or second browser tab from resolving the same turn twice. If another tab acts first, the older tab must load the newer revision before it can act.

The action history retains the rolls and resolved events used by the UI. Opening **Logs** loads those server-backed events so a refreshed battle still exposes its authoritative sequence for replay and debugging.

## Turn flow

The player phase lets each living party unit move once and take one action. A unit can also move and act in one command. When every party unit has acted, the enemy phase resolves automatically. Status durations and cooldowns tick at the end of the round.

Frozen, stunned, imprisoned, or zero-Speed units lose their turn. The combat log identifies the status that caused the skip.

## Actions

- **Attack** uses the unit's class range and shows damage, hit, critical, and counterattack forecasts.
- **Skills** spend MP and respect cooldowns. Attack-skill forecasts include the skill's power and element rather than showing basic-attack damage.
- **Items** come from the real Game inventory. The server validates quantity, target type, range, generated combat effect, and whether the item is consumed.
- **Maneuver** accepts a free-form tactical action. Select a unit or tile first when the action needs a target or terrain context.
- **Defend** reduces incoming damage until the unit's next turn.
- **Overwatch** lets a ranged unit attack the first enemy that moves into its line of sight.
- **Wait** ends the unit's action without another effect.
- **End Turn** yields the rest of the player phase.
- **Flee** ends an ordinary battle and returns the result to the GM. In an escape objective, the party must first reach a configured exit tile or complete the exit interaction; fleeing early is rejected and combat continues.

Keyboard shortcuts are available after selecting a unit: `A` Attack, `S` Skills, `I` Items, `M` Maneuver, `D` Defend, `O` Overwatch, `W` Wait, and `Esc` cancel. Standard controllers can move the grid cursor with the D-pad or left stick, confirm/select with the primary button, and back out with the secondary button. Controller input pauses while a text field is focused.

## Maneuvers

Maneuvers are deterministic combat actions, not unrestricted requests for the GM to rewrite battle state. The GM first proposes bounded effects from the acting unit, selected target or tile, visible terrain, objectives, and pending boss phases. The resolver independently rolls from the session seed, caps amounts and durations, rejects illegal targets or tiles, and applies only supported effects.

Supported results include damage, healing, protection, hindering statuses, forced movement, enemy reactions, and terrain changes. Examples:

- "Shove the guard away from the doorway."
- "Brace the wounded mage behind my shield."
- "Freeze the water between us."
- "Collapse the damaged wall."
- "Trip the commander before the ritual finishes."

The engine applies the mechanical result first. The GM then narrates that authoritative result in the story. A maneuver consumes the unit's action and may trigger a counterattack or movement reaction.

Maneuvers respect reach. Healing and status effects must target a unit within 2 tiles of the acting unit, damage must stay within the unit's attack range and line of sight, and cover or terrain changes must land on the grid, on an unoccupied tile, near the actor. Phrasing your maneuver around a selected unit or tile keeps the request inside these limits.

A maneuver always produces a result. If the GM's proposed effects have a small mistake, such as a target written by unit name instead of by its id, the engine repairs what it can and drops only the effects it cannot fix. If nothing usable survives, the GM gets one chance to correct itself; if that also fails, the maneuver is resolved from the keywords in your instruction (heal, guard, shield, stun, push, attack), so it never comes back empty. Say "heal myself" or "raise a shield" without selecting a unit and the effect lands on the acting unit. When only part of a maneuver could take effect, because a target was out of reach or out of sight or a tile was occupied, the combat log says what did not land instead of reporting a flat failure.

## Movement and terrain

Movement uses terrain costs. Forests cost more movement and provide avoidance, while ruins provide cover. Mountains, water, and walls are normally impassable.

Walls and mountains block line of sight. Ranged attacks and attack skills cannot target a unit through an obstruction. Units attacking from raised ruins gain high-ground accuracy and damage. The threat overlay includes projected enemy movement, ready attack skills, range limits, and line of sight.

Leaving an adjacent enemy's reach can trigger an opportunity attack. Moving into a ranged enemy's Overwatch can trigger its prepared shot. A successful maneuver can reposition a unit or convert a wall, water, or damaged area into a different terrain tile. Burning, poisoned, or electrified hazards damage units that remain on their tile until the hazard expires.

## Objectives and bosses

Eliminating every enemy is the default objective. Encounters can also track survival, escape, defense, escort, capture, interruption, or conditional-defeat goals. The current objective and its status appear in the combat header.

Boss encounters can trigger phases by round or HP threshold. A phase emits its telegraph before the next mechanic so the player can react with movement, an objective action, or a maneuver. Phases may also add a small reinforcement wave at valid open positions. A phase can trigger only once unless the encounter explicitly defines otherwise.

Objective completion is authoritative. Capture, interruption, escort, and conditional-defeat progress comes only from validated maneuver effects aimed at that objective. A survival or capture encounter can end without defeating every enemy, while losing a protected or escorted unit can end the encounter in defeat. Goals marked to clear the whole battlefield automatically include hostile reinforcements; targeted commander goals do not.

## Inventory and aftermath

Items are consumed only after the action succeeds. A rejected target, stale revision, or malformed request does not spend the item.

At the end of combat, the authoritative HP, MP, and active statuses for every matched party member, plus inventory quantities and deterministic victory loot, are written back to Game state and character sheets. The GM receives a compact result report containing objective outcomes and loot for narration and does not recalculate the battle.

## Accessibility and mobile

The speed button cycles battle animation playback through `1×`, `2×`, and `4×`. Reduced-motion system preferences start combat at `4×`. All action controls are keyboard focusable, and the grid remains inspectable without relying only on color.

On mobile, the action panel becomes a bottom sheet. Tap a unit, stage movement, choose an action, and tap a highlighted target. The combat log, threat overlay, restart, flee, and speed controls remain in the top bar.

## Restoring or leaving a battle

Refreshing restores the active server session and its compatibility snapshot. Restarting creates a fresh session and abandons the old one. Returning to the pre-combat turn abandons the active session, and deleting or resetting a chat removes its combat sessions.

Terminal victory, defeat, and flee states stay visible long enough to finish their story handoff. A restored terminal battle cannot resolve another action.

## Related guides

- [Game Mode: Combat](combat.md)
- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Game Mode: Sessions and Saves](sessions-and-saves.md)
