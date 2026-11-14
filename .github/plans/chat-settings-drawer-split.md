# Chat Settings Drawer split

Status: in progress, one step per pull request. Tracking issue: #9119. This file is the progress record: each pull request in the series updates the table below.

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
- **One step per pull request, one section per commit.** Each step in the table below is one pull request, and each section in it is its own commit with its own checks, so a reviewer can go commit by commit. Connected chats (move, then merge) and Agents (cards, then the shell) are split further, as the table says. Separate pull requests for every section would pile up into a deep stack while each waits for review, and every pull request costs a hand test, a review and a CI run. Before starting a section, list the open pull requests that change files in the folder, and skip any section one of them is changing. Search by changed files, not text: `gh pr list --search` only matches a pull request's title and description.

  ```sh
  gh pr list --repo Pasta-Devs/Marinara-Engine --base staging --state open --limit 200 --json number,title,files \
    --jq '.[] | select(any(.files[]; .path | startswith("packages/client/src/features/chat-settings/"))) | "#\(.number) \(.title)"'
  ```
- **Cut and paste, no reformatting.** Moved code keeps its text, so anyone with an open change can re-apply it in the new file.
- **Props first.** A moved section gets the few shared values (chat, metadata, the metadata save, mode flags, `requestClose`) as props, the way the existing `sections/` components do. React Query and store hooks are called again inside the section. A shared context is added only if the same prop list repeats across most sections. Only 7 drawer values are used by more than half the sections (`metadata`, `chatMode`, `persistedChatMode`, `isGame`, `updateMeta`, `t`, `localizeUi`), so props stay cheap.
- **State two or more sections use stays in the drawer.** It's passed down as props. Examples: `inlineResourceEditor` (both Persona sections, Characters and Lorebooks), and `showCharPicker` and `pendingAddedCard` (Persona and Characters).
- **Unsaved edits and effects live in the section's wrapper.** `components/ui/Drawer.tsx` renders a section's body only while it is expanded, and popping a section out remounts it. Drafts, save-before-close checks and `useEffect` calls therefore go in the component that wraps `ChatSettingsSection` (as `LorebooksSection.tsx` does) or stay in the drawer, never in the collapsible body. An effect in the body would stop running while the section is collapsed: the agent setup queue effect, for example, opens the add-agent window whenever the drawer is open. The drawer has 42 effects with no JSX of their own, so check each one a section's state feeds before moving it. A pull request that moves a draft adds a test that collapsing or popping out the section keeps it.
- **Save-before-close checks go through one register function.** Today each check has its own ref slot and its own line in `requestClose` (`handleInlineCardFlushChange`, `handleAgentSuiteCloseGuardChange`). The first pull request that needs another check replaces them with one `registerCloseGuard(check)` that returns an unregister function; `requestClose` runs every registered check and stays open if one fails. Two sections sharing one slot would overwrite each other's check, and one's cleanup would clear the other's.
- **Moved sections take an `order` prop** and put `style={{ order }}` on their root, as `sections/ChatVariablesSection.tsx` does, so the drawer passes `CHAT_SETTINGS_ORDER` values one way.
- **Source-text regressions are replaceable.** Many scripts in `scripts/regressions/` read the drawer's source and pattern-match it. When code moves, keep a check only if it guards real behaviour, such as a save or close guard, a lazy-loading boundary or a fixed user-facing bug. Otherwise replace it with a behavioural check or delete it, and say which in the pull request. A `doesNotMatch` check still passes after the code moves, because the file it searches no longer holds that code, so re-point or remove it.

## Steps

| Step | What moves | Lines today | Goes to | Status |
| --- | --- | --- | --- | --- |
| 1 | The drawer and the 14 files only it uses | n/a | `features/chat-settings/` | Merged: #9120 |
| 2 | The three separate components at the bottom of the drawer (Memory recall's memories window, the Knowledge agents card, Conversation notes), and the helper groups at the top that stand on their own: game video prompt templates, conversation command toggles, Knowledge agent source settings, the agent menu icons | about 1,080 | Their own files, and `features/chat-settings/lib/` for plain helpers | Merged: #9121 |
| 3 | First, a browser test that opens Chat Settings in a Conversation, a Roleplay and a Game chat and checks that every section for that mode shows. Then settings profiles, scoped regex, group chat, function calling, game widgets, the rest of Lorebooks | about 700 | `e2e/` for the test; `sections/`, one file each | Merged: the test as #9150, the sections as #9123 |
| 4 | Connected chats: four near-copies, one per mode | 7,796–8,088 | First moved as they are, then merged into one component in a second pull request | In progress: the move and a linking test are this pull request; the merge comes next |
| 5 | Memory recall, autonomous messaging, automatic summarization; then Characters, Persona and Game party | about 400; 6,130–6,762 | `sections/` | Not started |
| 6 | Agents, part 1: the per-agent cards, one or a few per pull request. The cards that need the fewest drawer values go first. Each becomes a component that gets its values as props. The Knowledge agents card and `lib/knowledge-agent-settings.ts` move here too | most of about 2,400 lines of JSX | `features/chat-settings/agents/` | Not started |
| 7 | Agents, part 2, in one pull request: the shell, its state, its effects and its 17 render helpers, plus the Prose Guardian drafts. One Agents component serves both faces (Conversation, and Roleplay and Game), told which by a `surface` prop, because only one shows at a time and they share most of their state | about 1,300 lines of state | `features/chat-settings/agents/`, with the failed-save-keeps-the-drawer-open test | Not started |

Line numbers refer to `staging` on 2026-11-12 and drift as the file changes. Recount each section's dependencies before its pull request.

Small constants, types and helpers that only one future section uses, like the Spotify source options, the Prose Guardian defaults or the persona avatar, stay in the drawer for now and move with their section. Moving them earlier would only fill `lib/` with files that the later steps re-home.

Agents can't move in small cut-and-paste pieces from the top down: its render helpers read the drawer's state directly, so that state has to move in one go. Moving the cards out first shrinks what's left until that last move is reviewable.

## What the drawer keeps after step 7

- The floating window: title, header buttons, the phone sheet and popped-out sections.
- The order of the sections, and which ones show in each chat mode.
- The values every section needs: the chat, its metadata, the save function and the mode.
- The state that two or more sections share, and the few windows that more than one section opens.
- Closing: run each registered save check, and stay open if one fails.

After step 7, render the sections in their display order instead of relying on CSS `order`. Today the reading order for keyboard and screen readers differs from what's on screen: Advanced parameters is seventh on screen but near the end of the page's code.

## New Chat Settings code

New sections and panels go in their own files in `packages/client/src/features/chat-settings/` (see `packages/client/.instructions.md`).
