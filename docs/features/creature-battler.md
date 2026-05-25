# Creature-Battler Feature Specification

**Status**: Draft  
**Branch**: `feat/creature-battler`  
**Target**: `staging`  
**Date**: 2026-05-25

## 1. Overview
Generic creature-battler system (inspired by but not limited to Pokémon) that runs alongside the existing `combat` agent. Supports single and double battles, switching, items, stats, types, abilities, and held items with deterministic rule enforcement.

## 2. Design Decisions (from requirements gathering)
- **Storage**: Dedicated `creature_parties` table (linked by `characterId` + `chatId`)
- **Agent**: Built-in `creature-battler` agent
- **Rules**: Deterministic TypeScript engine (type chart, priority, Speed, damage)
- **UI**: Dedicated controls (party panel, move grid, bag, targeting)
- **Ally support**: Full — any character card can own a creature party
- **Persistence**: Database-backed
- **Scope**: Full feature in first PR

## 3. Database Schema
```ts
// packages/server/src/db/schema/creature-parties.ts
export const creatureParties = pgTable("creature_parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: text("character_id").notNull(),
  chatId: text("chat_id").notNull(),
  party: jsonb("party").$type<CreatureInstance[]>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```
- Unique index on `(characterId, chatId)`
- Migration via `pnpm db:push`

## 4. Shared Types (`packages/shared/src/types/creature-battle.ts`)
- `CreatureInstance`
- `CreatureMove` (name, type, category, power, accuracy, pp)
- `CreatureType` (enum or string union + effectiveness chart)
- `CreatureAbility`
- `HeldItem`
- `BattlePosition` (single | double-front | double-back)
- `CreatureBattleState`
- `CreatureAction` (switch | item | move)

## 5. Server Components
- New result type: `"creature_battle_update"` (added to `agent.schema.ts` + `agent-executor.ts`)
- Built-in agent prompt in `agent-prompts.ts` (rules reference + state JSON schema)
- Deterministic engine: `packages/server/src/services/game/creature-battle.engine.ts`
  - `calculateDamage(...)`, `getTypeEffectiveness(...)`, `resolveTurnOrder(...)`, `applyStatus(...)`
- Executor handler writes to `creature_parties` table and updates encounter memory

## 6. Client Components
- Extend `encounter.store.ts` or new `creatureEncounter.store.ts`
- New UI in `GameSurface.tsx`:
  - `CreaturePartyPanel` (switch, status, held item)
  - `MoveGrid` (4 moves with type badges)
  - `CreatureBag` (item list with use button)
  - Double-battle target selector
- Action flow: UI selection → `CombatPlayerAction` payload → `/game/combat/round`

## 7. Integration Points
- `use-encounter.ts` and combat round endpoint accept creature actions
- `character-tracker` agent surfaces creature HP/status from DB
- Existing `combat` agent continues to handle general encounter state; creature-battler augments it

## 8. Validation & Testing
- `pnpm check` (TypeScript + ESLint)
- Manual browser verification:
  - Single battle flow
  - Double battle with ally creature
  - Switch priority (first action)
  - Item priority (second)
  - Speed-based turn order
  - Type effectiveness
  - Persistence across page reload
- No automated tests required per repo policy

## 9. Documentation & Release
- Update `CHANGELOG.md`
- Add section to `docs/CONFIGURATION.md` (creature-battler agent)
- PR description must list manual verification steps (no auto-checked boxes)

## 10. Open Questions / Future Work
- Creature sprite rendering in combat view
- Ability/held-item interaction matrix (v2)
- Creature evolution / capture mechanics (future)
