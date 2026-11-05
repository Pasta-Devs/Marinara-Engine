# Game Mode architecture: rulesets, checks and combat

This is the map for anyone about to change Game Mode's rules code: where a ruleset is read, how a check and a fight are resolved, where state is kept, and what a new ruleset key needs. Player docs are in `docs/game/`, the ruleset author guide starts at [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md), and the combat AI has its own page, [Game Mode combat AI](game-combat-ai.md).

## Where things live

| Area | Code |
| --- | --- |
| The ruleset format | `packages/shared/src/schemas/ruleset.schema.ts`: the zod schema, `RulesetRef` (the pin) and the cross-checks an import runs. The editor JSON Schema, `docs/extending/ruleset.schema.json`, is generated from it with `pnpm ruleset:schema`. |
| Capability API | `supportedCapabilityApi` in `packages/shared/src/schemas/capability-package.schema.ts`, with one comment line per minor saying what it added. |
| Sheet math and live state | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts` (the `[sheet:]` operations), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (the `battle` block). |
| Ruleset fights | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts` (what is on the menu), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`. All pure over `(definition, state)`. |
| Marinara's own combat | `packages/shared/src/features/tactical-combat/` (Tactical engine, grid generation, AI), `combat-director.ts`, `combat-conditions.ts`. |
| Combat AI | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`; see [Game Mode combat AI](game-combat-ai.md). |
| Server: rulesets | `packages/server/src/services/game/ruleset-registry.service.ts` (reads installed and imported rulesets, resolves a game's pin), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (applies a turn's `[sheet:]` commands), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`. |
| Server: checks and dice | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`. |
| Server: fights | `combat-director.service.ts` (Classic and Tactical), `combat.service.ts` (the Classic round math, `resolveCombatRound`), `ruleset-combat-director.service.ts` (a fight the ruleset resolves), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`. Routes: `routes/combat-director.routes.ts` (the director's start, state and command), `routes/encounter.routes.ts`, and the older `POST /game/combat/round`, `/game/combat/tactical/start` and `/game/combat/tactical/action` in `routes/game.routes.ts`. |
| Prompt | `gm-prompts.ts` (`buildGmFormatReminder`, the sheet blocks and the taught tags). |
| Client | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` and the other `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`. |

## A ruleset, from package to game

1. **Source.** An official ruleset is a capability package of kind `ruleset` that lists `ruleset.json` (and any `catalogs/<id>.json`) in `contributions.assets.paths`, hash-pinned in `files[]`. A community ruleset is imported as one file, a `<name>.ruleset.json` package file, or from a repository's `rulesets/` folder, and is stored under a namespaced id (`local/<id>`, `<owner>/<id>`) so it can never shadow an official one.
2. **Language.** An official ruleset's translations are per-language packs listed in its catalog entry; the package manager keeps only the Engine's language (`syncRulesetLocalePack` in `package-manager.service.ts`). An imported package file keeps only the language active at import.
3. **Registry.** `ruleset-registry.service.ts` parses every definition with the shared schema and drops an unusable one with a log line. Definitions are stored by id and version; the same version with different bytes is refused.
4. **The pin.** Game creation writes `chat.metadata.gameRuleset` once: `{ id, version, packageId, source?, options }`, where `options` holds the chosen layers. No pin means Marinara's own rules. A pin this install cannot honour (missing, or older than the pin) is reported and the game's checks stay owed; it is never resolved by another system's rules.

## State

| Part | Contents | Where | Rewinds with swipes |
| --- | --- | --- | --- |
| Starting build | The sheet a player fills in on a card or persona | Card `data.extensions.rulesetSheets[rulesetId]`, persona `personaStats.rulesetSheets[rulesetId]` | n/a |
| Game build | A copy taken at setup, edited by **Edit sheet** and level-ups | `chat.metadata.gameCharacterCards[].rulesetSheet` | No |
| Live state | Pools, tracks, conditions, states, notes | `game_state_snapshots.ruleset_live` | Yes |
| A fight | The encounter, its seed and dice cursor, whose turn it is | The combat director's storage row, one per chat | Restored with the turn that started it |

Live state belongs to the snapshot so a regenerated turn never spends twice. A stored sheet is `{ v, build }`, capped at 64 KB, and read tolerantly: unknown fields are kept and missing ones take defaults. A layout that moves values to new ids declares `sheet.migrations`, applied on read by `readRulesetSheetEnvelope` and `readStoredLiveState`. A sheet for a ruleset that is not installed is kept dormant, never dropped.

## A check, end to end

1. The Game Master writes `[skill_check: …]`, optionally with `who=`, `with=`, a ladder step name, a charm or a spend. With one-request dice on, it may write a branch block or a `[[roll: …]]` placeholder instead (`one-request-dice.ts`).
2. `skill-check-resolution.service.ts` reads the pinned ruleset and dispatches on `resolution.kind`: `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` or `symbol-pool`. Numbers the model wrote are audited and replaced unless the ruleset vouches for them; pools, kept dice and banded results are never vouched for.
3. Dice: a check rolls with `rollDieSecurely` (Web Crypto, in `packages/shared/src/utils/dice-notation.ts`). A ruleset fight, its item uses, loot and markets roll with `seededDieRoller(seed, cursor)` from the same module, so a fight replays from its seed. Since #8608 there is no other roller.
4. The result is written back as a complete tag and a dice card, and recorded in **Logs**.

## Sheet commands

The Game Master changes a sheet with `[sheet: who="Name" op="…"]`. The operations a tag may spell are `spend`, `restore` (alias `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (alias `cast`), `pass`, `advance`, `dismiss`, `prepare` and `unprepare` (`RULESET_SHEET_OP_NAMES` and `RulesetSheetOp` in `live-state.ts`). `ruleset-sheet-turn.service.ts` validates each against the live sheet; one that cannot happen, such as a cast with no slot left, is refused, logged and surfaced once per turn, and nothing is half-applied. `sheet` is a reserved GM tag.

## A fight, end to end

A game's fight is played in one of three styles, chosen by the ruleset and the game's **Combat Preference**:

| Ruleset | Style | Server |
| --- | --- | --- |
| None, or no `battle`/`combat` block | Marinara's Classic or Tactical combat | `combat-director.service.ts` |
| `battle` block | Marinara's combat, lent the sheet's pools, slots and catalog skills; health carried as a share of the maximum and written back | `combat-director.service.ts` with `combat-bridge.ts` |
| `combat` block | The ruleset's own fight, on a board when `combat` gives a square's distance and the game is Tactical | `ruleset-combat-director.service.ts` |

All three share the director's ledger: one storage row per chat, one revision, a request-id guard and a per-chat queue. The ledger covers director-backed fights only. The older routes in `game.routes.ts`, `POST /game/combat/round` (which calls `resolveCombatRound` on the combatants it is sent), `/game/combat/tactical/start` and `/game/combat/tactical/action`, keep no ledger: the client holds the fight's state and sends it back with each call. In a ruleset fight the menu decides legality (`options.ts`), the resolver applies a choice (`resolve.ts`), the dice come from the fight's seed and cursor, and everything a party member spends or loses is written through the sheet's own rules, so closing the tab mid-fight loses nothing. Opponents nobody wrote are built from the ruleset's bestiary and encounter budget; the Game Master may play named opponents and bosses, choosing from the Engine's ranked suggestions.

## Adding a ruleset key

1. Add it to `ruleset.schema.ts`, with its cross-checks, and to the TypeScript types the resolver reads.
2. Raise `supportedCapabilityApi` by one minor and add its comment line. Gate the key so a ruleset using it must declare that minor or newer.
3. Implement it in the pure shared code first, then wire the server, then the client.
4. Run `pnpm ruleset:schema` to regenerate `docs/extending/ruleset.schema.json`.
5. Document it on the matching page of the author guide (`docs/extending/ruleset-*.md`), and in the player docs if players will see it.
6. Add a `scripts/regressions/*.regression.ts` that drives it through the pure code, including a refused input.
7. List the changed English pages on the open `[docs-i18n]` issue.

`docs/development/ruleset-5e-2014.example.json` is a trimmed 5e draft that hundreds of regressions and end-to-end tests read as a fixture. It is not the shipped SRD package, which lives in Marinara-Agents under `packages/ruleset-5e-2014/`.

## Open work

- Flying over obstacles on a ruleset board: a flier is moved like anybody else.
- Summoning in Marinara's own Classic and Tactical combat (ruleset fights summon already). The design is in [Game Mode combat AI](game-combat-ai.md#summoning-design-extension).
- A Battlefield Scout Agent that prepares a fight's terrain brief, described in [Game Mode combat AI](game-combat-ai.md#encounter-environment-agent-handoff).
