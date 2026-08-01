# Chat Resource Drag-and-Drop Plan

## Status

Phases 1 through 4 are implemented on `drag-me-baby-one-more-time`.

Automated resolver coverage is active. Desktop Playwright coverage has been added for character assignment and persona replacement, but local execution in the current development container is blocked because Chromium cannot load `libnspr4.so`; CI or an environment with Playwright system dependencies must run those browser cases.

Before remaining phases begin, follow the repository coordination rules:

1. Check for an existing issue, issue-linked branch, draft PR, or project item covering chat resource drag-and-drop.
2. Establish visible ownership on the issue.
3. Open a draft PR against `staging` when implementation starts.

## Goal

Let users drag supported resources from the right panel into the active chat without navigating through chat settings.

The center window has two potential destinations:

- **Chat surface:** change the active chat's persistent configuration.
- **Composer:** add a supported attachment to the current draft.

These are not universal drop targets. A destination appears only when the dragged item has a real, currently supported operation there.

## Product Rule

Dragging selects the resource and destination. The application performs only operations already represented by the chat data model and generation pipeline.

- One valid additive operation: apply immediately and offer Undo.
- One valid replacement operation: confirm if it would replace an existing value.
- Multiple genuinely supported operations: show a small chooser containing only those operations.
- No valid operation: do not activate a target.
- Already-applied resource: do not accept a duplicate drop.
- No speculative one-turn context, hidden prompt injection, synthetic mentions, or decorative chips.

## Current Contracts

The existing `Chat` and `ChatMetadata` contracts support these persistent operations:

- Characters: update `Chat.characterIds`.
- Persona: update `Chat.personaId`.
- Prompt preset: update `Chat.promptPresetId`.
- Connection: update `Chat.connectionId`.
- Lorebooks: update `ChatMetadata.activeLorebookIds`.
- Agents: update `ChatMetadata.activeAgentIds` and, when accepted, `ChatMetadata.enableAgents`.
- Chat background: update the existing chat background metadata through the same assignment path used by `BackgroundPicker`.

The existing composers support file attachments. They do not currently support message-scoped character, lorebook, agent, persona, preset, or connection references.

## Supported Action Matrix

The capability resolver must also enforce current chat-mode restrictions and resource availability. The table describes the operation when the existing UI already allows it in the active mode.

| Resource | Chat surface | Composer | Drop behavior |
| --- | --- | --- | --- |
| Character | Add ID to `characterIds` | None | Add immediately; toast with Undo |
| Lorebook | Add ID to `activeLorebookIds` | None | Add immediately; toast with Undo |
| Agent | Add ID to `activeAgentIds` | None | Add immediately when agents are enabled; otherwise confirm enabling agents and adding it |
| Persona | Set `personaId` | None | Set immediately if empty; confirm when replacing another persona |
| Prompt preset | Set `promptPresetId` | None | Respect mode restrictions; set immediately if empty; confirm when replacing another preset |
| Connection | Set `connectionId` | None | Confirm when changing the current connection; include the old and new connection names |
| Chat background | Set existing chat background metadata | None | Use the current background assignment semantics; confirm replacement only if the existing flow requires it |
| Image or supported file | None | Add to draft attachments | Reuse the existing attachment validation and preparation pipeline |
| Character/lorebook/agent folder | None | None | No target |
| Settings control | None | None | No target |
| Regex script | None | None | No target until a chat-scoped assignment contract exists |
| Custom function/tool | None | None | No target until a chat-scoped assignment contract exists |
| Extension contribution | None by default | None by default | Opt-in only through a future typed contribution API |

### Mode Rules

Do not duplicate mode policy in drag handlers. The drop capability resolver should use the same predicates as the existing chat setup/settings UI.

At minimum:

- Prompt presets remain unavailable in Conversation mode, matching `PresetsPanel`.
- Agent drops require the agent to be installed, available, and valid for the current mode.
- Character, persona, lorebook, connection, and background operations are offered only where their existing assignment control is available.
- Chats with no active ID expose no resource drop target.
- Streaming or agent processing should not block safe metadata updates unless an existing mutation path already does so. Replacement confirmations must re-read current chat state before applying.

## Interaction Design

### Drag Start

Every supported panel row writes one versioned resource payload:

```ts
type ChatResourceDragPayload = {
  version: 1;
  kind: "character" | "lorebook" | "agent" | "persona" | "preset" | "connection" | "background";
  ids: string[];
  label: string;
};
```

Use one custom MIME type, for example `application/x-marinara-chat-resource`. Keep the existing folder MIME payloads during migration because folder reordering remains a separate valid interpretation of the same drag.

Resource drag effects should advertise `copyMove`:

- Folder targets interpret the drag as a move.
- Chat targets interpret the drag as a copy/assignment.

Do not rely on `text/plain` for internal resource operations. It is ambiguous and currently contains bare IDs.

### Target Visibility

Drop affordances are hidden at rest.

When a recognized resource drag enters the center window:

1. Parse and validate the typed payload.
2. Resolve valid actions against the latest active chat.
3. Show only valid destinations.
4. Use action-specific text such as `Add Maris to this chat`, not generic `Drop here`.
5. Keep invalid areas unchanged and non-droppable.

For a supported file drag, only the composer highlights. For a character, lorebook, agent, persona, preset, connection, or background drag, only the chat surface highlights in the first release.

### Chat Surface Drop

The active drop area is the current conversation surface, independent of transcript scroll position. Dropping over an old message does not insert history or retroactively change context.

On drop:

1. Re-read the active chat ID and current chat data.
2. Re-resolve the capability to prevent stale or duplicate actions.
3. Apply immediately when additive and unambiguous.
4. Open a focused confirmation for replacements or agent enablement.
5. Report success with a localized toast and Undo action.
6. Report mutation failure without changing the transcript.

Do not create user, assistant, narrator, or system messages to record configuration changes. The message model has no dedicated activity-event type, and configuration events must not enter model-visible history.

### Composer Drop

Preserve the current file behavior in both `ChatInput` and `ConversationInput`:

- Validate supported types and the 20 MB size limit.
- Prepare images through `prepareImageAttachment`.
- Read supported text/PDF files through the current attachment path.
- Preserve per-chat pending attachment draft behavior.

Tighten composer drag detection so internal resource drags do not activate the file drop highlight and then do nothing.

### Confirmation

Confirm only when the operation has a meaningful consequence:

- Replacing an active persona.
- Replacing an active prompt preset.
- Switching an active connection.
- Enabling agents as part of adding an agent.
- Any existing background assignment path that already requires a choice or replacement confirmation.

Confirmations must name the current and proposed values where applicable. They must not include unrelated actions such as starting a new chat, invoking an agent once, or referencing the resource in a message.

### Undo

Undo restores the exact pre-drop value, not a reconstructed guess.

- Character: restore the previous complete `characterIds` array.
- Lorebook: restore the previous complete `activeLorebookIds` array.
- Agent: restore both `activeAgentIds` and `enableAgents`.
- Persona, preset, connection, and background: restore the previous value.

Before executing Undo, verify that the active chat still has the value produced by the drop. If another edit has since changed the same field, do not overwrite it; dismiss the stale Undo and notify the user that the chat changed.

## Architecture

### Shared Client Utility

Add a focused client module, tentatively `packages/client/src/lib/chat-resource-drag.ts`, containing:

- MIME constant.
- Payload type and runtime parser.
- `writeChatResourceDragPayload(dataTransfer, payload)`.
- File-drag detection.
- Resource-kind guards.

Keep the payload client-local for the first release because it is browser interaction state, not an API contract.

### Capability Resolver

Add a pure resolver, tentatively `packages/client/src/lib/chat-resource-drop-capabilities.ts`:

```ts
type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[] }
  | { type: "add-lorebooks"; ids: string[] }
  | { type: "add-agents"; ids: string[]; mustEnableAgents: boolean }
  | { type: "set-persona"; id: string; replacesId: string | null }
  | { type: "set-preset"; id: string; replacesId: string | null }
  | { type: "set-connection"; id: string; replacesId: string | null }
  | { type: "set-background"; id: string };
```

Inputs include the parsed resource payload, active chat, normalized metadata, current mode, and available resource IDs. Output is either one concrete action or `null`.

The resolver owns:

- Duplicate suppression.
- Mode restrictions.
- Multi-ID filtering.
- Installed/available checks.
- Replacement detection.
- User-facing action key selection.

The resolver does not perform mutations or render UI.

### Mutation Coordinator

Add one hook near the chat surface, tentatively `use-chat-resource-drop.ts`, which:

- Reads the latest active chat from React Query/Zustand at drop time.
- Calls `useUpdateChat` for top-level chat fields.
- Calls `useUpdateChatMetadata` for lorebooks and agents.
- Reuses the existing background assignment mutation path.
- Opens localized confirmations using existing app-dialog helpers.
- Creates success/error toasts and guarded Undo actions.

Do not put asynchronous mutation logic in a Zustand store.

### Drop Overlay

Add one presentational component around the shared center-chat boundary, not separate implementations inside every transcript:

- Receives current drag payload and resolved action.
- Covers the conversation surface without obstructing the composer.
- Uses `dragenter`/`dragleave` depth accounting to avoid flicker across child elements.
- Shows icon, resource label, and localized action text.
- Is pointer and theme responsive.

Both Conversation and Roleplay/Game surfaces should route through the same coordinator. Surface-specific wrappers may provide geometry, but they must not duplicate capability policy.

### Panel Integration

Migrate draggable rows incrementally:

1. Characters.
2. Lorebooks.
3. Agents.
4. Personas.
5. Presets.
6. Connections.
7. Backgrounds if the existing assignment contract can be reused cleanly.

Each row keeps its existing folder drag payload and adds the chat resource payload. Do not change folder movement behavior.

## Delivery Phases

### Phase 1: Drag Contract and Center Overlay

- Add the typed payload utility and parser.
- Add the pure capability resolver for characters, lorebooks, and agents.
- Add the center chat-surface overlay and mutation coordinator.
- Integrate Character, Lorebook, and Agent panel rows.
- Add localized action, confirmation, success, error, duplicate, and Undo text.
- Ensure internal resource drags do not trigger composer file highlighting.

This phase proves the primary additive workflow requested by the feature.

### Phase 2: Replacement Resources

- Add Persona, Preset, and Connection payloads.
- Add replacement detection and localized confirmation dialogs.
- Reuse existing mode restrictions and mutation hooks.
- Add guarded Undo for replacement operations.

### Phase 3: Background Assignment

- Determine whether the existing background picker choice flow can accept a dropped background ID without duplicating policy.
- Add background dragging only if the same chat-scoped assignment behavior can be reused.
- Otherwise leave backgrounds unsupported and record the blocker in the issue/PR.

### Phase 4: Touch and Non-Drag Parity

Desktop HTML drag-and-drop is the first implementation lane. Mobile must not depend on cross-panel precision dragging.

- Add `Add to active chat` to each supported row's existing action surface.
- Reuse the same capability resolver, confirmations, mutations, and Undo behavior.
- If touch dragging is retained, use existing touch drag handles and resolve the center target with `elementFromPoint`.
- Do not overload folder long-press behavior in a way that makes organization unreliable.

This phase is required before calling the feature complete on mobile.

## Expected File Changes

Likely new files:

- `packages/client/src/lib/chat-resource-drag.ts`
- `packages/client/src/lib/chat-resource-drop-capabilities.ts`
- `packages/client/src/hooks/use-chat-resource-drop.ts`
- `packages/client/src/components/chat/ChatResourceDropOverlay.tsx`

Likely modified files:

- `packages/client/src/components/chat/ChatArea.tsx` or the narrowest shared center-surface owner.
- `packages/client/src/components/chat/ChatRoleplaySurface.tsx` if surface geometry requires it.
- `packages/client/src/components/chat/ConversationView.tsx` if surface geometry requires it.
- `packages/client/src/components/chat/ChatInput.tsx`.
- `packages/client/src/components/chat/ConversationInput.tsx`.
- `packages/client/src/components/panels/CharactersPanel.tsx`.
- `packages/client/src/components/panels/LorebooksPanel.tsx`.
- `packages/client/src/components/panels/AgentsPanel.tsx`.
- `packages/client/src/components/panels/PersonasPanel.tsx`.
- `packages/client/src/components/panels/PresetsPanel.tsx`.
- `packages/client/src/components/panels/ConnectionsPanel.tsx`.
- `packages/client/src/components/panels/settings/BackgroundPicker.tsx`, only in Phase 3.
- `packages/client/src/localization/locales/en.json` or the canonical English catalog path in use at implementation time.

No server or shared-package changes are expected for Phases 1 and 2. If implementation discovers that an operation cannot use the existing chat patch routes, stop and resize the plan rather than introducing a hidden prompt or persistence contract.

## Accessibility and Input Requirements

- Do not rely on color alone; show resource icon and action text.
- Do not require hover to discover the non-drag equivalent.
- Confirmations are keyboard navigable and restore focus on close.
- Escape cancels a pending confirmation.
- Screen readers receive a concise announcement when a valid drop target appears and when an operation succeeds or fails.
- Drag overlays must not intercept normal scrolling when no recognized drag is active.
- Touch targets follow the existing minimum mobile sizes.
- Reduced-motion users receive opacity/state changes without unnecessary movement.

## Localization

All new visible copy uses semantic localization keys. Update only the canonical English catalog; community locales may fall back to English.

Copy categories include:

- Action labels for each resource kind.
- Replacement confirmations.
- Agent-enable confirmation.
- Success and failure toasts.
- Undo and stale-Undo messages.
- Accessibility announcements.
- Duplicate/already-active feedback if shown.
- Non-drag `Add to active chat` actions.

## Tests

Do not leave temporary `.test.ts` files in the repository.

### Pure Regression Coverage

Add permanent coverage only in an existing supported regression-test location/format for the capability resolver:

- Character absent -> add action.
- Character already present -> no action.
- Mixed multi-character payload -> add only missing valid IDs.
- Lorebook absent -> add action.
- Lorebook already active -> no action.
- Agent absent with agents enabled -> add action.
- Agent absent with agents disabled -> add action requiring enablement.
- Agent unavailable -> no action.
- Persona with no current persona -> non-replacement set action.
- Persona replacing another -> replacement action.
- Preset in unsupported mode -> no action.
- Connection matching current connection -> no action.
- Invalid version, unknown kind, malformed IDs, and oversized payload -> rejected.

### Browser Smoke Coverage

Extend `pnpm smoke:ui` where practical:

- Drag a character from the panel to the chat surface and verify assignment.
- Undo and verify the prior character list is restored.
- Verify character drag over the composer does not show file-drop feedback.
- Drag a supported file over the composer and verify attachment behavior remains intact.
- Verify an already-active resource has no active drop destination.
- Verify a replacement confirmation cancels without mutation.
- Verify confirmed replacement updates the chat.
- Verify folder drag-and-drop still moves resources within the panel.

### Manual Verification

Verify on desktop in Conversation, Roleplay, and Game modes where supported:

- Dark and light themes.
- Right panel open with a long/scrolled transcript.
- Additive drop, duplicate drop, replacement, cancellation, failure, Undo, and stale Undo.
- Drag movement across nested transcript elements without overlay flicker.
- Existing panel folder movement.
- Existing file/image drops in both composers.

Verify on a mobile/coarse-pointer viewport:

- Non-drag `Add to active chat` parity.
- Existing folder touch dragging remains usable.
- Confirmations fit and are dismissible.
- No text or controls overlap.

Required commands:

```bash
pnpm localization:check
pnpm check
pnpm regression:prompt
pnpm smoke:ui
```

`pnpm regression:prompt` is required before merge: the `LorebooksPanel.tsx` change affects lorebook activation, which feeds prompt assembly.

## Risks and Mitigations

### Existing Folder Drag Conflict

Risk: the same rows already use drag-and-drop to move items into folders.

Mitigation: retain existing folder MIME types, add a separate typed chat-resource MIME type, and let each target interpret only its own payload. Verify `copyMove` behavior and folder regressions.

### Composer False Highlight

Risk: current composer `dragover` handlers react to any drag, including internal resource IDs.

Mitigation: activate composer feedback only when `DataTransfer.types` or `DataTransfer.items` indicates files or another explicitly supported attachment payload.

### Stale Chat State

Risk: the active chat or assigned resources may change between drag start, drop, confirmation, and Undo.

Mitigation: resolve against current state at drop and again before mutation/Undo. Guard Undo against overwriting newer changes.

### Mode Policy Drift

Risk: drag-and-drop could permit an assignment that the setup/settings UI prohibits.

Mitigation: extract or reuse shared predicates from existing assignment flows. Do not hard-code a second policy matrix inside panel components.

### Hidden Behavioral Expansion

Risk: visually accepting resources in the composer could imply one-turn context that the server does not honor.

Mitigation: keep resource-to-composer drops disabled until a separately designed message-scoped context contract exists.

### Large Selection Drops

Risk: selection-mode dragging could add an unexpectedly large set of characters, lorebooks, or agents.

Mitigation: filter invalid/already-active IDs, respect existing server or mode limits, and require confirmation when a multi-item drop would cross an existing threshold. Do not invent a new arbitrary limit.

## Explicit Non-Goals

- Dropping a resource onto a historical message.
- Retroactively changing prompt history.
- Adding configuration changes as transcript messages.
- One-turn characters, lorebooks, personas, presets, connections, or agents.
- Agent invocation by dropping onto the composer.
- Starting a new chat from a center-surface drop.
- Dragging arbitrary settings into chat.
- A generic plugin drop API in the first release.
- Cross-chat dragging from one chat transcript into another.

## Acceptance Criteria

Phase 1 is acceptable when:

- A character, lorebook, or agent can be dragged from its right-panel row onto a valid active chat surface.
- The correct existing chat field is updated without creating a transcript message.
- Already-active and unavailable resources are not accepted.
- Adding an agent while agents are disabled requires explicit confirmation.
- Every successful mutation offers a guarded Undo.
- Resource drags do not trigger composer attachment feedback.
- Existing file attachment drops still work in both composers.
- Existing folder drag-and-drop behavior is unchanged.
- All new visible copy is localized.
- Desktop and mobile have equivalent actions, even if mobile uses a menu action instead of cross-panel dragging.
- `pnpm localization:check`, `pnpm check`, and the relevant UI smoke tests pass.

The full feature is acceptable when Phase 2 replacement resources and required mobile parity are also complete. Background assignment remains optional until Phase 3 confirms that its existing semantics can be reused without duplicating policy.

## Deferred Extension

A future message-scoped context feature may make characters, lorebooks, agents, personas, presets, or connections valid composer drops. That work requires a separate shared/server contract defining persistence, prompt assembly, token budgeting, provider routing, display, draft restoration, and message history semantics. It must not be smuggled into this feature as client-only chips.
