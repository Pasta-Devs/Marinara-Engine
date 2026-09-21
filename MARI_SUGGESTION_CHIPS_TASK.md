# TASK: Professor Mari — Dynamic Suggestion Chips & Chat-Native Guided Generation

> **You are implementing this task.** This document is self-contained: file paths, anchors, code, and
> ordering are given so you should not need broad exploration. Read the referenced files before editing,
> but do not re-plan — the design below is approved. Work against the `staging` branch (see
> `CONTRIBUTING.md § Branches`); do **not** target `main`.

## Repo facts you need
- Monorepo (pnpm): `packages/client` (React 19 + TS strict, **Tailwind v4 CSS-vars**, **Zustand** stores, **TanStack Query** hooks, **no URL router**), `packages/server` (Fastify + Pino logger), `packages/shared` (types/constants/schemas).
- **Read `packages/client/src/components/.instructions.md` before any client edit.** No barrel/index files — use direct imports.
- Server logging: import the Pino `logger` (`import { logger } from "../lib/logger.js"` — adjust path); **never `console.*`** in server code. Client keeps `console.*`.
- Validate with `pnpm install` then `pnpm check` (TS + ESLint). No automated test suite. Run `pnpm db:push` if the Mari seed changes.
- Identity constant: `PROFESSOR_MARI_ID = "__professor_mari__"` in `packages/shared/src/constants/defaults.ts`.

## Background (why)
Mari can already create characters/lorebooks/personas/presets/chats, navigate, edit the DB, and generate images — but the chat input is a bare textarea, so **none of it is discoverable**, and there is no guided creation flow. We add **color-themed suggestion chips above Mari's chat input**: curated starters on an empty chat, then **model-emitted contextual chips** per turn (CYOA-like). The text input always stays; clicking a chip drops its prompt into the draft so the user can refine and send. Guided generation is achieved conversationally (Mari asks one thing at a time, offers answer chips) — **no new wizard/modal**.

Mari has **two surfaces**, both get chips from one shared component/type:
- **System A** — the in-chat Mari *character*: actions are bracket/XML commands embedded in her generated text, parsed server-side, streamed to the client as `assistant_action` SSE events over `/api/generate`.
- **System B** — the Home-screen *workspace agent* (`HomeProfessorMariChat.tsx`): a real tool-loop agent; the model replies with a JSON envelope `{ say, commands, stop }`; server streams `MariWorkspacePromptEvent` SSE events over `/api/professor-mari/workspace/prompt`.

## Color rule (do not break existing meaning)
Reuse existing per-entity gradient tokens in `packages/client/src/styles/globals.css` (L791–872):
characters=pink `#f472b6→#f43f5e`, lorebooks=amber `#f59e0b→#f97316`, personas=green `#34d399→#14b8a6`, presets=purple, connections=blue, agents=violet. Preserve semantic tones: **red (`--destructive`) = destructive/irreversible**, amber = caution, emerald = success. Only NEW color token to add is **settings** (neutral gray).

---

## Implement in this order

### Step 1 — Shared contract (do first; both surfaces depend on it)
File: `packages/shared/src/types/professor-mari-workspace.ts`

1a. Add near the top (after the existing `MariWorkspaceToolName` type):
```ts
export type MariChipEntity =
  | "characters" | "lorebooks" | "personas" | "presets"
  | "connections" | "agents" | "settings" | "chat";

export type MariChipTone = "default" | "danger" | "caution" | "success";

export interface MariSuggestionChip {
  id: string;
  label: string;            // short display text on the chip
  prompt: string;           // text inserted into the draft when clicked (may differ from label)
  entity?: MariChipEntity;  // drives the gradient color token
  icon?: string;            // optional lucide icon name, e.g. "UserPlus"
  tone?: MariChipTone;      // semantic override; "danger" => red, etc.
}
```

1b. Add a variant to the existing `MariWorkspacePromptEvent` union (currently ends at the `error` variant, ~L176):
```ts
  | { type: "suggestions"; data: MariSuggestionChip[] }
```

1c. Export the curated starter set (used by BOTH surfaces for the empty state):
```ts
export const MARI_STARTER_CHIPS: MariSuggestionChip[] = [
  { id: "starter-character", label: "Create a character", entity: "characters", icon: "UserPlus",
    prompt: "Let's create a new character together — guide me through it step by step." },
  { id: "starter-lorebook", label: "Create a lorebook", entity: "lorebooks", icon: "BookOpen",
    prompt: "Help me build a new lorebook, one entry at a time." },
  { id: "starter-persona", label: "Create a persona", entity: "personas", icon: "Sparkles",
    prompt: "Help me create a persona for myself, step by step." },
  { id: "starter-explore", label: "What can you do?", icon: "Wand2",
    prompt: "What kinds of things can you help me do here?" },
  { id: "starter-surprise", label: "Surprise me", icon: "Dices",
    prompt: "Surprise me — suggest something fun we could create." },
];
```

1d. **System A transport contract.** Find the `assistant_action` event union used by System A (client handler is in `packages/client/src/hooks/use-generate.ts` ~L2260 `case "assistant_action"`; server emits via `sendAssistantAction` in `packages/server/src/routes/generate.routes.ts`). Locate its TypeScript union type (search the repo for `assistant_action` and `persona_created`/`character_created` to find the shared/route type). Add a variant carrying the same payload:
```ts
  | { type: "suggestions"; suggestions: MariSuggestionChip[] }
```
Import `MariSuggestionChip` from the workspace-mari types file (or move the chip types to a more neutral shared location if the assistant_action type cannot import from the workspace file — prefer keeping types where `MariSuggestionChip` already lives and importing).

Run `pnpm check` after Step 1 to confirm shared types compile.

---

### Step 2 — Backend System B (Home workspace agent)
File: `packages/server/src/services/professor-mari/workspace-agent.service.ts`

2a. The model reply envelope is `{ say, commands, stop }`, parsed by `rawJsonToolCalls` (~L804) with bracket/XML fallbacks (~L815–885). Extend parsing to also read an optional `suggestions` array from the same JSON object. Validate/clamp before use:
- cap at 6 chips, drop entries missing `label` or `prompt`, truncate `label` to ~40 chars and `prompt` to ~400 chars, coerce `entity`/`tone` to the allowed unions (drop if invalid), generate an `id` if absent.
Add a small helper `sanitizeSuggestionChips(raw: unknown): MariSuggestionChip[]`.

2b. Update `workspaceCommandProtocolPrompt()` (~L399–444) — document the new optional field and the guided behavior. Add text like:
```
You may include an optional "suggestions" array (max 5) of quick-reply chips:
  { "label": short button text, "prompt": exact message to send if tapped, "entity": one of
    characters|lorebooks|personas|presets|connections|agents|settings|chat, "tone": danger|caution|success (optional) }
When the user is creating or editing something, ask ONE focused question at a time and offer 3–5
suggested answers as suggestions, each tagged with the matching entity so the UI colors them. Use
tone:"danger" only for irreversible actions. Suggestions never replace your natural reply text.
```

2c. Emit the chips through the existing `onEvent` channel after a model turn is parsed (near the trace upsert ~L1779–1793 and/or the final-answer path ~L1575–1582): 
```ts
if (chips.length) onEvent({ type: "suggestions", data: chips });
```
Keep it optional/back-compat: no `suggestions` ⇒ emit nothing. Log parse issues with `logger.debug`.

`packages/server/src/services/generation/professor-mari-command-runtime.ts` needs **no** change for System B.

---

### Step 3 — Backend System A (in-chat Mari character)

3a. `packages/server/src/db/seed-mari.ts` — inside `MARI_ASSISTANT_PROMPT`, in the `<assistant_commands>` block (~L352–418), add a `suggestions` command form + guidance mirroring 2b:
```
<suggestions>[{"label":"...","prompt":"...","entity":"characters","tone":"default"}]</suggestions>
```
State: emit at most 5; use when guiding creation; ask one thing at a time; tag entity for color; tone:"danger" only for irreversible actions. **Changing the seed requires `pnpm db:push`** (and note in the PR that existing installs re-seed / may need the Mari character updated).

3b. `packages/server/src/services/conversation/character-commands.ts` — add `suggestions` to the `CharacterCommand` type definitions and its bracket+XML parser so the `<suggestions>...</suggestions>` block is recognized and its JSON payload parsed.

3c. `packages/server/src/services/generation/professor-mari-command-runtime.ts` — add `"suggestions"` to `PROFESSOR_MARI_COMMAND_TYPES` (~L34–45) and a handler branch in `handleProfessorMariCommand` (~L62) that validates the chip array (reuse the same sanitize logic as Step 2a — factor it into a shared helper in `packages/shared` or a server util so both call sites use it) and returns an action descriptor of shape `{ type: "suggestions", suggestions }`.

3d. `packages/server/src/routes/generate.routes.ts` (~L7860 and ~L7920) — where executed commands are turned into `assistant_action` SSE events via `sendAssistantAction`, forward the `suggestions` action: `sendAssistantAction({ type: "suggestions", suggestions })`.

Run `pnpm check` (and `pnpm db:push` if seed changed) after Step 3.

---

### Step 4 — Client: shared chip component
New file: `packages/client/src/components/chat/MariSuggestionChips.tsx`

Requirements:
- Props: `{ chips: MariSuggestionChip[]; onSelect: (chip: MariSuggestionChip) => void; disabled?: boolean; compact?: boolean }`.
- Import `MariSuggestionChip` from `@marinara-engine/shared` (match how other shared imports are written in sibling files).
- Layout: a horizontal, wrapping/scrollable row rendered ABOVE the input, using a new `.mari-suggestion-chips` class (Step 6).
- Each chip is a button reusing the existing pill primitive: base classes `mari-panel-gradient-button` + (when `chip.entity`) `mari-panel-gradient--{entity}`. When `chip.tone` is set it overrides entity color:
  - `danger` → `--destructive` styling (match existing danger usage `mari-chrome-control--danger` / `border-[var(--destructive)]`), `caution` → amber (`amber-400/…`), `success` → emerald. Model these on existing usages in `CyoaChoices.tsx` and `HomeProfessorMariChat.tsx`.
- Optional icon: map `chip.icon` (string) to a lucide-react icon via a small local `Record<string, LucideIcon>` lookup (include at least: `UserPlus, BookOpen, Sparkles, Wand2, Dices`), render if present.
- `compact` variant: smaller padding / min-height for the floating assistant window.
- Use `cn()` from `@/lib/utils` for class composition.
- Reference for the interaction/visual pattern: `packages/client/src/components/chat/CyoaChoices.tsx`.

---

### Step 5 — Client: wire chips into both surfaces

**Interaction model for `onSelect` (both surfaces):** insert `chip.prompt` into the draft textarea and focus it — **append** (with a separating space) if the draft is non-empty so a typed refinement + chip combine; do **not** auto-send. User then edits and presses Enter/Send.

5a. **System B** — `packages/client/src/components/chat/HomeProfessorMariChat.tsx`:
- Add local state `const [suggestionChips, setSuggestionChips] = useState<MariSuggestionChip[]>([])` alongside the workspace timeline state.
- In the SSE `for await` loop (~L2698–2767, where `token`/`thinking`/`status`/`tool_*` are handled) add: `case "suggestions": setSuggestionChips(event.data); break;`
- Reset `suggestionChips` to `[]` when a new prompt is submitted, on chat switch, and on reset/restart (mirror where the timeline is reset).
- Render `<MariSuggestionChips>` directly above the input pill in BOTH input forms: the embedded form (~L2867) and the floating duplicate (~L3448, pass `compact`). When `suggestionChips.length === 0` and the transcript is empty, render `MARI_STARTER_CHIPS` instead. Wire `onSelect` to set the draft state used by the textarea and focus it (the textarea ref / `setDraft` already exist in this component).

5b. **System A** — state + event:
- `packages/client/src/stores/agent.store.ts`: add a slice parallel to the existing `cyoaChoices` / `cyoaChoicesChatId`:
  `mariChips: MariSuggestionChip[]`, `mariChipsChatId: string | null`, plus `setMariChips(chatId, chips)` and `clearMariChips()`.
- `packages/client/src/hooks/use-generate.ts` (~L2260, `case "assistant_action"`): add handling for `action.type === "suggestions"` → `setMariChips(activeChatId, action.suggestions)`. Clear on new user send for that chat.

5c. **System A** — render gate — `packages/client/src/components/chat/ChatArea.tsx`:
- Above the normal chat input row, render `<MariSuggestionChips>` **only when the active character is `PROFESSOR_MARI_ID`**. Pull chips from `agent.store` (`mariChips` when `mariChipsChatId === activeChatId`); if empty and the chat has no messages, show `MARI_STARTER_CHIPS`.
- `onSelect` inserts into the existing message draft (there's an existing draft/setDraft mechanism for the normal composer — reuse it; check `chat.store.ts` drafts) and focuses the composer.

---

### Step 6 — Client: styling tokens
File: `packages/client/src/styles/globals.css`

6a. Add the missing settings entity token next to the others (~L866):
```css
.mari-panel-gradient--settings {
  --mari-panel-gradient-start: #9ca3af;
  --mari-panel-gradient-end: #6b7280;
  --mari-panel-gradient-text: #f9fafb;
}
```

6b. Add a layout class for the chip row (near the other `.mari-*` chrome classes, e.g. around L740 or after the gradient block):
```css
.mari-suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}
.mari-suggestion-chips--compact { gap: 0.375rem; }
```
Consider a smaller-size modifier for chips in compact mode (reduce `min-height`/`padding` of `.mari-panel-gradient-button` via a `.mari-suggestion-chips--compact .mari-panel-gradient-button` override).

---

## Guided generation
No extra code — it emerges from the Step 2b / Step 3a prompt guidance: Mari asks for one attribute at a time (name → vibe → description → greeting …) and returns 3–5 answer chips per turn, each tagged with the entity so the flow stays color-themed (pink while building a character, amber for a lorebook, green for a persona).

## Reuse (don't reinvent)
- `.mari-panel-gradient-button` + `.mari-panel-gradient--<entity>` tokens (`globals.css` L791–872).
- `CyoaChoices.tsx` — the choice-button + store-slice pattern to copy.
- Existing `assistant_action` (System A) and `MariWorkspacePromptEvent` (System B) unions — the ONLY extension points; don't invent new transports.
- `PROFESSOR_MARI_ID` from `packages/shared/src/constants/defaults.ts`.

## Definition of done / verification
1. `pnpm install`; `pnpm check` clean (TS + ESLint). Run `pnpm db:push` if `seed-mari.ts` changed.
2. Home Mari chat (System B):
   - Empty chat shows curated starter chips above the input, correctly colored (character pink, lorebook amber, persona green).
   - Clicking a starter inserts its prompt into the textarea (focused, editable), does NOT auto-send; Enter sends.
   - Asking to create a character → Mari asks step-by-step and emits contextual pink answer chips each turn; a destructive suggestion renders red.
   - Same works in the floating assistant window (compact chips).
3. Normal chat with the Mari character (System A): chips render above the standard input; verify they are gated OFF for non-Mari characters.
4. Existing semantic colors unchanged (Keep/Restore red, warnings amber, success emerald).

## PR notes (per AGENTS.md)
- Target `staging`. Open a draft PR early. Make the "why" explicit (discoverability + guided creation).
- Leave all validation/test-plan checkboxes UNCHECKED. List manual-verification steps explicitly.
- If no linked issue/feature request exists, note that one should be opened first.
- If you touch version-bearing files or release docs, run `pnpm version:check` — this change normally should not.
