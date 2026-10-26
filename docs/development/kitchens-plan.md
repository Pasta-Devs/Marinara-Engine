# Kitchens — plan

Status: concept, parked 2026-10-05. Omnibar ships first. Engine core, with follow-up adoption work in Marinara-Agents.

**Mental model:** the pantry is shared, the cooking is not. The library (characters, lorebooks, personas, connections) is available in every Kitchen. What happens in a Kitchen (its chats, agent memory, Noodle, Slurp, maps) stays in that Kitchen.

## What a Kitchen is

A Kitchen is a workspace that strings chats together. Chats in the same Kitchen
share a world, a cast, selected agents, and agent storage. It groups and shares;
it does not hide. Characters, lorebooks, personas, and connections stay global
and visible everywhere.

Name: **Kitchen / Kitchens** in the UI (see Naming for code). "Workspace" is taken by
`professor-mari-workspace`, and "Kitchen" matches "Marinara's Kitchen".

## Naming

"Kitchen" is a UI label only, so the product name can change without a migration.

- Code, storage, API, and localization keys use the neutral internal name **`sphere`** (no other use in the codebase): type `Sphere`, table `spheres`, `sphereId` / `sphere_id` on chats, `/api/spheres`, `setSphereForChat`, keys like `spheres.title`.
- Only the English locale values say "Kitchen" / "Kitchens". A rename changes locale values only.
- Avoided: `world` (lorebooks, world state), `scope` (lorebook scope), `space` (too common), `workspace` (Professor Mari workspace).
- In this document, "Kitchen" means the product concept; field names below written as `kitchen*` map to `sphere*` in code.

## Decisions

| Topic | Decision |
| --- | --- |
| Isolation | Group and share for the library: no hidden or Kitchen-owned characters, lorebooks, personas, connections. Kitchen-owned for activity: agent memory, Noodle, Slurp, maps. |
| Agent storage | Both scopes. Per-chat `agent_memory` stays; agents also get a Kitchen-shared store. |
| Package storage | Kitchen-scoped Noodle and Slurp ("universe 1 Noodle, universe 2 Noodle"). Existing data belongs to the default Kitchen ("Mari's Kitchen", `kitchenId = null`). |
| Kitchen lorebooks | A lorebook can be scoped to a whole Kitchen: every chat and agent in it sees the lorebook. First slice. |
| Folders | Stay separate. Folders arrange the sidebar; a chat can have a folder and a Kitchen. |
| World | Lorebooks, map and world state, default persona and connection, a character cast, selected agents. |
| Membership | A chat is in zero or one Kitchen (`kitchenId`). Chats with no Kitchen behave exactly as today. |
| Memory | Characters remember the scenes they were in. Opt-in per Kitchen. See "Memory between chats". |

## Where Kitchens live in the UI

No new top-bar icon.

A Kitchen is a scope over the mode tabs, not a mode. Modes and Kitchens are separate axes: every Kitchen can hold CONVO, RP, and GM chats.

- **Chat sidebar scope row:** above `CONVO | RP | GM` (`ChatSidebar.tsx` segmented control), a full-width scope picker: "All chats" (default, today's behavior) or one Kitchen; last item "New Kitchen". Next to it, an open button opens the Kitchen page. No Kitchens yet: the picker opens the Mari explainer.
- **Mode tabs filter by scope.** With a Kitchen selected, each mode tab lists only that Kitchen's chats of that mode, shows per-mode counts, and ends with "New <mode> in <Kitchen>". Empty mode: "No game chats in <Kitchen> yet."
- **"All chats" scope is unchanged** except a small Kitchen badge on chats that are in a Kitchen, and a + button to add a chat to a Kitchen. Nothing is hidden by default; no sidebar is replaced.
- **Center:** the open button (or the page link) opens the Kitchen page (mockup "Stocked Kitchen"). No Kitchens yet: center shows "Welcome to the Kitchens".
- **Tab sync:** the existing effect still switches to the opened chat's mode. Scope rule: if the opened chat is not in the selected Kitchen, switch scope to the chat's Kitchen, or to "All chats" when it has none.
- **Persist scope** per device with the other sidebar UI state.
- **Right panel:** unchanged; its items are drag sources for the Kitchen page (reuse the chat-resource drag-and-drop resolver).
- **Chat settings drawer:** a "Kitchen" section next to "Connected chats" (join, leave, open).
- Check the scope row with the lead dev before building: it is core chat UI every user sees.

## Resolution

One server resolver returns chat settings merged with Kitchen settings (lorebooks, agents, cast, persona, connection). The generate route and agents call it; prompt changes are covered by `pnpm regression:prompt`. Ship as "Alpha" (precedent: Advanced Memory Recall).

## Relation to existing features

- **Connected chats** (`connectedChatId`, 1 conversation ↔ 1 roleplay, transcript/influence sharing): stay separate. A Kitchen can contain a linked pair.
- **Chat folders:** per mode, sidebar arrangement only. Separate.
- **`groupId`:** chat branches. Not reused.
- **Chat settings profiles:** copy settings into new chats per mode. Separate: profiles configure a chat, Kitchens give it a world.
- **Game mode:** game chats join Kitchens and share cast, lorebooks, agents, memory, but keep their own game map and state.

## Kitchen-scoped package storage

Today each install has one Noodle and one Slurp universe:

- `noodle_*` and `slurp_*` tables (`packages/server/src/db/schema/noodle.ts`, `slurp.ts`) have no chat or world key.
- Package documents (`capability_documents`, `CapabilityDocumentStore`) are keyed by `packageId` + `kind` only.

Plan: add a nullable `kitchenId` namespace to these tables and to the document store API; `null` is the default Kitchen, so existing data needs no migration beyond the column. The runtime passes the active chat's Kitchen to the package. Engine owns the namespace and the API contract; Noodle, Slurp, and LTM adopt it in Marinara-Agents (separate PRs there).

## Memory between chats

**Rule:** characters remember the scenes they were in. Each chat in a Kitchen gets a short list of the newest scenes its characters experienced in other chats. The Kitchen page shows all of it, and you can remove any item.

Example (Kim Possible Kitchen): chats "Mission: Lair raid" (Kim, Ron, Drakken, Shego), "Possible family group" (Kim, Mom, Dad, Jim, Tim), "Drakken & Shego" (Drakken, Shego).

- Ron knows the lair raid in every chat, because he was there. Nothing to link.
- Drakken knows only what he saw at the raid, not what Kim told her family.
- Mom learns about the raid only when Kim tells her in the family chat. That telling is a new scene, and Mom was present.

| Part | Rule |
| --- | --- |
| Switch | Kitchen setting "Share memories between chats", off by default. Turning it on enables Advanced Memory scene summaries for the Kitchen's chats (asked once per Kitchen). |
| Unit | One Advanced Memory scene, with the characters present (`audienceCharacterIds`). |
| Who receives it | A chat receives a scene from another chat in the same Kitchen when at least one of its characters was present. |
| Prompt | A short block "Elsewhere in <Kitchen>" with the newest few scenes (about 5), one line each, with the source chat. |
| Control | Kitchen page Memory section: per chat, the scenes it receives and their source. [×] hides a scene for that chat only. |
| Persona | Persona setting "Counts as a witness", default on (you play a character, it remembers). A narrator persona turns it off. |
| Hearsay | No feature. Telling someone is a new scene that they witnessed. |
| Lorebook Keeper | Never writes into a Kitchen lorebook automatically. Kitchen lorebooks are canon; automatic writes would leak secrets to every chat. |

Prompt block example:

```text
Elsewhere in Kim Possible (what the characters here experienced):
- Kim & Ron: Lair raid — stopped Drakken's hairdryer ray, Ron lost his pants. (Mission: Lair raid)
- Kim: Mom's birthday is Saturday; Jim and Tim plan a rocket cake. (Possible family group)
```

Not in V1:

- Older scenes drop off the list. Recall of older relevant scenes from other chats comes later.
- LTM and Memory Nag keep working per chat; they can adopt the Kitchen later.
- Timeline and flashbacks (which scene happened first across chats).

Engine-only work; no package changes. Wire prompt logging for the new block (`DEBUG_AGENTS`, `logDebugOverride`) and cover it with `pnpm regression:prompt`.

## Current state (what we build on)

- `Chat` has `folderId`, `groupId`, `connectedChatId` (`packages/shared/src/types/chat.ts`). None share state.
- `agent_memory` is keyed by `agentConfigId` + `chatId` (`packages/server/src/db/schema/agents.ts`).
- Chat agents: `metadata.enableAgents`, `agentOverrides`, `activeAgentIds`.
- Lorebook scope: `lorebooks.scope` JSON `{ mode, chatIds }` plus optional `chatId`.
- Map / world state: `spatial_context_snapshots` and `game_state_snapshots`, both keyed by `chatId`.
- Storage: `STORAGE_VERSION = 7`; root `storage-format.json` must match.

## Data model

```ts
interface Kitchen {
  id: string;
  name: string;
  color: string;
  description: string;
  personaId: string | null;      // default for new chats
  connectionId: string | null;   // default for new chats
  characterIds: string[];        // cast
  lorebookIds: string[];         // world
  agentIds: string[];            // selected agents
  shareMemories: boolean;        // "Share memories between chats"
  hiddenScenes: Record<string, string[]>; // chatId -> scene ids hidden by [×]
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
// Chat gains: kitchenId: string | null
// Persona gains: countsAsWitness: boolean (default true)
```

New table `kitchens`, new table `kitchen_agent_memory`
(`agentConfigId`, `kitchenId`, `key`, `value`, `updatedAt`).
Storage version bump 7 → 8 with a no-op migration (`kitchenId` defaults to `null`).

## Inheritance rules

Everything is live: Kitchen settings apply to every Kitchen chat at resolve time, not copied at creation.

- **Persona, connection:** when a chat joins, ask "Use the Kitchen persona and connection?" Yes clears the chat's own values so the Kitchen value applies live; No keeps the chat's values.
- **Characters:** the Kitchen cast is available to every Kitchen chat.
- **Lorebooks:** live. Kitchen lorebooks are active in every Kitchen chat, in addition to the chat's own.
- **Agents:** live. Kitchen `agentIds` join the chat's active agent set; per-chat `agentOverrides` still win.
- **Agent storage:** agents read/write per-chat memory as today, plus a Kitchen store through a separate memory API.
- **Map / world state:** one shared Kitchen snapshot for conversation and roleplay chats. Game chats keep their own. Hardest part; last slice.

## Slices

0. **Link chats (no shared behavior).** `kitchens` table shaped like `api_connection_folders` (id, name, color, sortOrder), CRUD via `registerFolderCrudRoutes`; nullable `kitchenId` on chats through the existing chat update; sidebar scope picker (create/rename/delete Kitchen) + mode-tab filter + badge; "Kitchen" select in the chat settings drawer. Delete Kitchen = unset `kitchenId`, never delete chats. No Kitchen page, no generation or prompt change. Likely no `STORAGE_VERSION` bump (folder tables were added without one); confirm. Regression: deleting a Kitchen keeps its chats with `kitchenId = null`. PR text: cross-mode grouping is useful alone (folders are per mode) and is the base for later slices.
1. **Kitchen page + Kitchen lorebooks.** Kitchen page (open button in the scope row), Kitchen lorebook scope (extend `LorebookScope` with Kitchen ids), drag and drop from the sidebars into the Kitchen page.
2. **Kitchen memories.** "Share memories between chats" setting, "Elsewhere in <Kitchen>" prompt block, Kitchen page Memory section with [×], persona "Counts as a witness". Regression: a chat receives only scenes one of its characters witnessed.
3. **Defaults and cast.** Kitchen persona, connection, and cast resolve live for Kitchen chats.
4. **Agents and Kitchen agent memory.** Kitchen agents join the agent resolution; `kitchen_agent_memory` table, capability API access, debug logging.
5. **Kitchen-scoped package storage.** `kitchenId` namespace on Noodle/Slurp tables and the document store API (Engine). Adoption in Noodle, Slurp, LTM (Marinara-Agents).
6. **Shared map and world state.** Kitchen-level spatial and game-state snapshots.
7. **Intro tutorial.** Mari in her kitchen shows her drawers (left and right sidebars), then zooms out to differently themed kitchens. Reuse the existing tutorial system.

Each slice is its own PR against `staging`, with a CHANGELOG entry, localization keys, and one regression proof.

## Later (community input, 2026-10-02/03)

- **Search scope:** search one Kitchen or all Kitchens. Fits the omnibar scope work.
- **Theme per Kitchen** (cyberpunk Kitchen, hearts Kitchen). Reuse the theme system.
- **Clone** items or a whole Kitchen from A to B (same world, hero vs villain).
- **Share Kitchens as templates, not user data:** a manifest that references packages, lorebooks, and settings. Never export chats, memory, or package data.
- **Source of truth per Kitchen** (an agent's world/timeline as canon vs chats and lorebooks). Depends on agent-to-agent calls; separate feature.
- **Right sidebar order:** with a Kitchen selected, show its items first and the rest below. Library stays shared.

## Open questions

- Kitchen agent storage conflicts: last write wins, or per-key timestamps?
- Export/backup: include Kitchens in backup now (yes, via the table) — Kitchen export/import later.
- Multiplayer: does a Kitchen travel with a shared multiplayer chat? Assume no for V1.
- Sidebar scope label: keep "All chats", or call the default scope "Mari's Kitchen" to match the default storage namespace?
- LTM (Long-Term Memory) storage: confirm where it stores data before slice 5.
- Memory: timeline and flashbacks across chats; recall of older scenes from other chats.
- Memory: does [×] also stop a scene from coming back through later recall?
