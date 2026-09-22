# Game Mode combat roadmap

This records the agreed direction for [hybrid terrain #6265](https://github.com/Pasta-Devs/Marinara-Engine/issues/6265) and later combat work. It distinguishes planned behavior from the current game. Implementation starts against `staging`; this document is not a claim that every capability below has shipped.

## Keep participation and battlefield rules separate

The current `combatStyle` values are `classic` and `tactical`. Preserve them. Future summoning belongs to a separate participation setting, defaulting to party combat for older setups and saves. Creation presets can set both values without introducing another persisted mode enum:

| Preset                     | Participation                                | Battlefield   |
| -------------------------- | -------------------------------------------- | ------------- |
| Party                      | Player and companions                        | Classic menus |
| Summoning (planned)        | Controlled creatures; trainer outside combat | Classic menus |
| Tactical                   | Player and companions                        | Tactical grid |
| Tactical summoning (later) | Controlled creatures; trainer outside combat | Tactical grid |

Do not expose unfinished combinations. Narrative companions and combat units are distinct; the first party member's array position must not become a permanent controller identity contract.

## Current implementation priority: hybrid terrain

The GM supplies a small structured brief grounded in the scene. The engine resolves exact terrain and spawns using a seed, validates the board, and saves the resolved result. The GM then describes the accepted battlefield. Routine movement and attacks do not require model calls.

The environment/formation pipeline supports optional map size and scene landmarks. Terrain guidance belongs to each encounter; map seeds are internal per encounter, with no campaign setup seed control. Keep old setups valid. Save the accepted grid and generator provenance so a future generator change cannot redraw an existing battle. Saved seeds reproduce generation given the same brief and combatants; they do not make arbitrary model output deterministic.

Generated terrain may be repaired for connectivity, but authored constraints must not silently disappear. Bound model output, tile counts, unit counts and feature dimensions. Reject an impossible constrained layout with an actionable reason and offer an explicit generated fallback. A full paint/place editor and arbitrary authored maps are later work and must use the same validation rules.

### Movement capabilities

Walking, flying and teleportation need explicit movement semantics. Flight and teleportation may cross walls, water and mountains and bypass forest's extra movement cost. Terrain defense and evasion bonuses remain independent of movement mode.

An omitted movement mode defaults to walking for legacy encounters. An explicitly unsupported movement mode is rejected with an error; do not silently replace a requested capability with walking. This validation contract applies to generated blueprints and tactical API inputs.

Keep traversal, legal destinations and occupancy separate. Teleporting across a wall does not imply permission to finish inside solid terrain. The initial flat grid cannot represent altitude, ceilings, spell-specific sight requirements or limited flight duration; document that ceiling instead of claiming full tabletop movement rules. Reuse the same movement legality for previews, resolution, path animation and enemy AI.

## Tabletop rules: built-in profiles plus GM reference tools

Prioritize 5e-like and V20-like play over a complete creature-collection game. Add bounded, versioned rules profiles in later changes. Choose an exact edition and supported subset before naming a profile as an implementation of that ruleset.

The engine should own actual rolls, legal targets, movement, action budgets, resource consumption and numeric results. The GM should interpret the fiction, select an appropriate supported operation, provide NPC intent and narrate the real result. Retrieved lorebook text can supply references and campaign rules, but it should not bypass the resolver or rewrite rolled outcomes.

[Issue #5955](https://github.com/Pasta-Devs/Marinara-Engine/issues/5955) covers semantic lorebook retrieval and an opt-in tool path. Retrieval is complementary: it helps the GM find relevant information, while explicit rule profiles make common mechanics consistent and testable. Avoid a separate lookup for every routine die roll.

Start with supported check, turn and resource primitives. A d20-oriented profile and a d10-pool-oriented profile need different resolution rules; one is not a renamed version of the other. Future coverage should include initiative, contested checks, damage/mitigation, conditions and resource use. Document unsupported cases and keep GM adjudication explicit.

Tactical tabletop work also needs shared line-of-sight and cover rules. The current grid blocks movement through walls but distance-based ranged targeting can cross them. Update resolver, AI, counters, forecasts and threat overlays together. Preserve the current party/enemy phase system; individual initiative is a separate selectable rule profile.

## Summoning: retain the design, defer the larger system

A first summoning slice can stay small: one active creature per side, owned reserves, a noncombat trainer, a voluntary switch that consumes the command, and a persisted replacement pause after fainting. Defeat occurs when no deployable creature remains. Trainer items must not grant an extra creature action.

Keep one roster keyed by stable IDs plus active-slot IDs. Derive reserves and fainted state instead of maintaining competing arrays. Owned creature HP, resources and conditions persist; encounter generation should not reinvent those stats each fight. Define reserve condition ticks explicitly.

Capturing, evolution, breeding, doubles, temporary summoning durations and tactical summoning are separate additions. The GM recap must distinguish a fainted creature from an injured trainer.

## Persistence and proof

Pin effective encounter rules when a battle starts. New optional fields must preserve old classic and tactical saves. Setup imports, immutable creation snapshots and summaries must preserve new choices. Refresh, restart, next-session carry, swipes, branching and checkpoint restore each need explicit coverage.

Future server-owned battle state should apply battle and roster changes together, with encounter IDs, revisions and idempotent action IDs. Reuse existing queued writes where suitable. Audit turn-game and Experience namespaces before reusing `game_engine_state`; it is not automatically a safe combat store.

For each new rule, add the smallest runnable `*.regression.ts` proof, including rejected actions and legacy inputs. Browser proof must cover setup, a real tactical action, refresh, small screens, theme contrast, focus/keyboard access and helpful failure states. Keep localization and user documentation alongside implementation.

## Prior work and contributor entry points

[Closed, unmerged PR #4391](https://github.com/Pasta-Devs/Marinara-Engine/pull/4391), on `feat/game-mode-combat-expansion`, contains a broader combat-session, maneuver, objective and boss expansion. It is useful prior art, not current staging behavior. Check its ownership/status before restarting that work; do not merge its entire expansion as a prerequisite for terrain.

Primary Engine files are `packages/shared/src/features/tactical-combat/`, `packages/server/src/routes/encounter.routes.ts`, `packages/server/src/routes/game.routes.ts`, `packages/client/src/components/game/GameSetupWizard.tsx`, `GameSurface.tsx`, and `TacticalCombatUI.tsx`. Downloadable agent/Experience definitions and package-owned prompts belong in Marinara-Agents if later work affects them.
