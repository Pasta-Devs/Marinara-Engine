# Marinara Engine Unified Combat Expansion Plan

## Scope

This plan covers the expansion and hardening of both Game Mode combat styles:

- **Classic:** cinematic, menu-driven, narrative-heavy combat.
- **Tactical:** grid positioning, terrain, formations, and direct unit control.

The implementation will preserve each style's identity while moving both onto a shared, server-authoritative combat foundation.

## Working Constraints

- Create `feat/game-mode-combat-expansion` from the latest `pasta/staging` when implementation begins.
- Preserve unrelated worktree content, including the untracked `.claude/` directory.
- Keep the work divided into reviewable implementation slices.
- Do not push, commit, create an issue, or open a PR without separate user authorization.
- Do not create a PR until the user has tested and approved the complete implementation.
- Update `CHANGELOG.md` under `[Unreleased]` as part of the implementation.

## Phase 1 — Combat Contracts and Storage

Create a shared combat foundation used by both presentation styles.

- Add shared session, action, effect, objective, maneuver, and result contracts.
- Introduce a server-owned `game_combat_sessions` record containing:
  - Session and chat IDs.
  - Combat style.
  - Canonical state JSON.
  - Seed and RNG cursor.
  - Revision number.
  - Last action ID.
  - Active/completed status.
  - Creation and update timestamps.
- Change action requests to send only `sessionId`, `expectedRevision`, `actionId`, and the chosen action.
- Atomically reject stale revisions and duplicate actions.
- Retain compatibility with existing Classic and Tactical metadata snapshots by importing them into a session when restored.
- Add combat-session cleanup when chats are deleted or reset.

### Checkpoint

Both existing combat modes still play normally using server-owned state.

## Phase 2 — Tactical Correctness and Parity

Resolve the current Tactical gaps before adding new mechanics.

- Replace the hard-coded Potion with real inventory items and generated item effects.
- Validate ownership, quantity, target side, range, and consumption server-side.
- Persist item consumption only after the action succeeds.
- Implement frozen, stunned, imprisoned, and zero-speed turn skipping.
- Add skill-aware forecasts covering power, element, status, cooldown, MP cost, and counterattacks.
- Expand threat previews to include attack skills and projected movement.
- Make cooldown, MP, status, and defending behavior consistent with the displayed UI.
- Synchronize Tactical HP, MP, and statuses back into Game state.
- Improve malformed legacy snapshot handling.

### Checkpoint

Tactical reaches functional parity with Classic inventory, statuses, skills, and persistence.

## Phase 3 — Tactical Maneuver Redesign

Add a proper **Maneuver** action to the selected-unit menu.

### Player Flow

- Select a unit and optionally stage movement.
- Choose Maneuver.
- Enter a free-form tactical action.
- Optionally select a unit, tile, terrain object, or objective.
- Display action cost and risk before submission.

### Resolution Flow

- Build server-side context from the canonical battlefield.
- Ask the GM for a constrained maneuver proposal.
- Parse it into a structured success, partial-success, or failure result.
- Roll the actual outcome deterministically.
- Validate every proposed effect before applying it.
- Consume the acting unit's turn.
- Trigger an enemy reaction when appropriate.

### Supported Effects

- Damage, healing, buffs, and statuses.
- Push, pull, reposition, or knockback.
- Cover and concealment.
- Terrain and hazard changes.
- Objective interaction.
- Boss-mechanic interaction.
- Enemy interruption or counteraction.

The GM supplies intent and narration; the deterministic engine owns rolls and state changes.

### Checkpoint

Maneuvers create visible, mechanically meaningful battlefield consequences without allowing unrestricted GM state mutation.

## Phase 4 — Classic Combat Hardening

Move Classic combat onto the same authoritative session foundation.

- Replace unseeded randomness with session RNG and a persisted cursor.
- Reject invalid targets rather than selecting a random fallback.
- Enforce MP, cooldown, target, item, and status rules server-side.
- Prevent duplicate round resolution.
- Preserve the current cinematic interface and animation flow.
- Convert Classic special maneuvers to the structured maneuver pipeline.
- Improve enemy targeting using role, HP, threat, weaknesses, and available skills.
- Make difficulty primarily affect enemies rather than indiscriminately scaling all damage.

### Checkpoint

Classic encounters become reproducible, refresh-safe, and mechanically consistent.

## Phase 5 — Shared Objectives and Bosses

Add encounter goals beyond eliminating every enemy.

- Defeat a commander.
- Survive a fixed number of rounds.
- Escape through an exit area.
- Defend a location or NPC.
- Escort a unit.
- Capture or interact with an objective.
- Interrupt a ritual or charged attack.
- Defeat enemies under special conditions.

Add shared boss features:

- HP-threshold phases.
- Scheduled mechanics.
- Telegraphs and counterplay.
- Summoned reinforcements.
- Terrain changes.
- Enrage conditions.
- Dialogue cues and phase narration.
- Objective-aware victory and defeat summaries.

## Phase 6 — Tactical Battlefield Depth

Build additional grid mechanics on top of the stable resolver.

- Line-of-sight and ranged obstruction.
- Cover and high-ground bonuses.
- Flanking and back attacks.
- Opportunity attacks.
- Overwatch.
- Destructible walls and objects.
- Temporary hazards.
- Elemental terrain interactions.
- Unit behavior profiles for attackers, defenders, healers, controllers, and bosses.
- AI movement before healing, buffing, or debuffing.

Each mechanic remains deterministic and represented through the shared effect system.

## Phase 7 — Aftermath, Replay, and UX

- Persist final HP, MP, statuses, inventory, loot, and objectives directly.
- Keep the GM's role limited to narrating the authoritative result.
- Store action history, rolls, seed, and revisions for combat replay and debugging.
- Add animation-speed and skip controls.
- Add Tactical keyboard and controller navigation.
- Add reduced-motion and color-blind-safe indicators.
- Improve mobile action sheets, target selection, and combat logs.
- Ensure interrupted, fled, defeated, retried, and restored battles clean up correctly.

## Phase 8 — Documentation and Changelog

- Update `CHANGELOG.md` under `[Unreleased]` with separate **Added**, **Changed**, and **Fixed** entries.
- Update `docs/game/combat.md` for shared and Classic mechanics.
- Add `docs/game/tactical-combat.md`.
- Link Tactical documentation from Game Mode getting-started and related guides.
- Update the canonical English localization catalog for all new UI text.
- Document maneuver behavior, objectives, terrain, restoration, and accessibility controls.

## Validation Gates

Run progressively:

1. Shared engine and storage tests.
2. Classic and Tactical route tests.
3. Determinism and stale-revision tests.
4. Inventory and persistence tests.
5. Maneuver schema and adversarial-output tests.
6. Objective and boss simulations.
7. Tactical AI simulations.
8. `pnpm localization:check`
9. `pnpm regression:prompt`
10. `pnpm check`
11. `pnpm smoke:ui`
12. Manual desktop and mobile combat verification.

Manual verification will cover refreshes, duplicate clicks, concurrent tabs, retries, defeat, fleeing, long encounters, inventory failures, malformed GM maneuver output, and every difficulty.

## Implementation Checkpoints

1. Shared contracts and server-authoritative session storage complete.
2. Tactical parity and correctness fixes complete.
3. Tactical maneuver redesign complete.
4. Classic hardening complete.
5. Objectives, bosses, battlefield depth, and AI complete.
6. Persistence, replay, accessibility, documentation, and changelog complete.
7. Full validation and maintainer-style diff review complete.

## Final Handoff

When all phases pass:

- Review the complete diff locally.
- Present changed files, test results, screenshots, known limitations, and remaining risks.
- Let the user test and request adjustments.
- Create no PR until the user explicitly confirms the implementation is satisfactory.
