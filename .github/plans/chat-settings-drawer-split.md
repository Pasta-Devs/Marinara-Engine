# Chat Settings Drawer split

Status: in progress, one section per pull request. Tracking issue: #9119. This file is the progress record: each pull request in the series updates the table below.

## Outcome

`ChatSettingsDrawer.tsx` keeps only the window, the order of the sections, the values every section needs, and the guarded close. Each section lives in its own component under `packages/client/src/features/chat-settings/` and holds its own state. Each step keeps the behaviour users see the same.

## Problem and proof

Measured on `staging` on 2026-11-12:

- The drawer is 11,757 lines. One function, `ChatSettingsDrawer`, spans lines 969 to 11,088.
- Lines 969 to 5,703 declare 641 names: 50 `useState`, 42 `useEffect`, 78 `useMemo`, 80 `useCallback` and 17 render helpers. The 5,400 lines of JSX below can read any of them, so moving one section out means first finding everything it touches.
- Agents is the largest section: 1,976 lines of JSX, plus about 1,300 lines of state that only Agents uses.
- About 100 commits from 8 people touched the file in the 30 days before this plan. A single large pull request would conflict with most of that work and go stale before review.
- The code had two homes. `features/chat-settings/` was started in June 2026, but the drawer and 14 files only it uses stayed in `components/chat/`, and new panels kept landing there.

## Rules for every pull request in the series

- **Link the tracking issue without closing it.** Put `Part of #9119` on a line of its own, with no "close", "fix" or "resolve" on that line: the issue status workflow treats any issue on such a line as fixed. The required closing line references #1469, the earlier request for this split.
- **One section per pull request, merged quickly.** Before starting a section, run `gh pr list --search "ChatSettingsDrawer"` and skip any section that an open pull request is changing.
- **Cut and paste, no reformatting.** Moved code keeps its text, so anyone with an open change can re-apply it in the new file.
- **Props first.** A moved section gets the few shared values (chat, metadata, the metadata save, mode flags, `requestClose`) as props, the way the existing `sections/` components do. React Query and store hooks are called again inside the section. A shared context is added only if the same prop list repeats across most sections.
- **Unsaved edits live in the section's wrapper.** `components/ui/Drawer.tsx` renders a section's body only while it is expanded, and popping a section out remounts it. Drafts and save-before-close checks therefore go in the component that wraps `ChatSettingsSection` (as `LorebooksSection.tsx` does) or stay in the drawer, never in the collapsible body. A pull request that moves a draft adds a test that collapsing or popping out the section keeps it.
- **Save-before-close checks use the existing pattern.** Sections hand the drawer a flush function through a ref callback, like `handleInlineCardFlushChange` and `handleAgentSuiteCloseGuardChange` do today.
- **Source-text regressions are replaceable.** Many scripts in `scripts/regressions/` read the drawer's source and pattern-match it. When code moves, keep a check only if it guards real behaviour, such as a save or close guard, a lazy-loading boundary or a fixed user-facing bug. Otherwise replace it with a behavioural check or delete it, and say which in the pull request. A `doesNotMatch` check still passes after the code moves, because the file it searches no longer holds that code, so re-point or remove it.

## Steps

| Step | What moves | Lines today | Goes to | Status |
| --- | --- | --- | --- | --- |
| 1 | The drawer and the 14 files only it uses | n/a | `features/chat-settings/` | This pull request |
| 2 | Helpers and constants at the top of the drawer, and the four separate components at the bottom | 421–968, 11,089–11,757 | `features/chat-settings/lib/` and their own files | Not started |
| 3 | Settings profiles, scoped regex, group chat, function calling, game widgets, the rest of Lorebooks | about 700 | `sections/`, one file each | Not started |
| 4 | Connected chats: four near-copies, one per mode | 7,796–8,088 | First moved as they are, then merged into one component in a second pull request | Not started |
| 5 | Memory recall, autonomous messaging, automatic summarization; then Characters, Persona and Game party | about 400; 6,130–6,762 | `sections/` | Not started |
| 6 | Prose Guardian drafts | inside the shared state | The Agents section's wrapper, with the failed-save-keeps-the-drawer-open test | Not started |
| 7 | Agents, both modes, with their state and render helpers | about 3,700 | `features/chat-settings/agents/`, over several pull requests | Not started |

Line numbers refer to `staging` on 2026-11-12 and drift as the file changes. Recount each section's dependencies before its pull request.

## What the drawer keeps after step 7

- The floating window: title, header buttons, the phone sheet and popped-out sections.
- The order of the sections, and which ones show in each chat mode.
- The values every section needs: the chat, its metadata, the save function and the mode.
- Closing: run each registered save check, and stay open if one fails.
- The few windows that more than one section opens.

## New Chat Settings code

New sections and panels go in their own files in `packages/client/src/features/chat-settings/` (see `packages/client/.instructions.md`).
