# Chat Settings Drawer split

Status: done. Every step has merged, one per pull request, and so has the follow-up on section order. Tracking issue: #9119. This file records how the split was done.

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
- **State two or more sections use stays in the drawer.** It's passed down as props. Examples: `inlineResourceEditor` (both Persona sections, Characters and Lorebooks), `showCharPicker` and `showPersonaPicker` (Characters, Persona and Game party), and `pendingAddedCard`.
- **Unsaved edits and effects live in the section's wrapper.** `components/ui/Drawer.tsx` renders a section's body only while it is expanded, and popping a section out remounts it. Drafts, save-before-close checks and `useEffect` calls therefore go in the component that wraps `ChatSettingsSection` (as `LorebooksSection.tsx` does) or stay in the drawer, never in the collapsible body. An effect in the body would stop running while the section is collapsed: the agent setup queue effect, for example, opens the add-agent window whenever the drawer is open. The drawer has 42 effects with no JSX of their own, so check each one a section's state feeds before moving it. A pull request that moves a draft adds a test that collapsing or popping out the section keeps it.
- **Save-before-close checks go through one register function.** Today each check has its own ref slot and its own line in `requestClose` (`handleInlineCardFlushChange`, `handleAgentSuiteCloseGuardChange`). The first pull request that needs another check replaces them with one `registerCloseGuard(check)` that returns an unregister function; `requestClose` runs every registered check and stays open if one fails. Two sections sharing one slot would overwrite each other's check, and one's cleanup would clear the other's.
- **The code order places the sections.** The drawer renders the sections in the order they show, with no CSS `order`, so keyboard and screen readers go through them as they appear. A new section goes in the drawer's JSX where it should show; `e2e/chat-settings-sections.e2e.ts` fails if one of the sections its chats show is moved by CSS `order`. (Until this follow-up, sections took an `order` prop from `CHAT_SETTINGS_ORDER`.)
- **Source-text regressions are replaceable.** Many scripts in `scripts/regressions/` read the drawer's source and pattern-match it. When code moves, keep a check only if it guards real behaviour, such as a save or close guard, a lazy-loading boundary or a fixed user-facing bug. Otherwise replace it with a behavioural check or delete it, and say which in the pull request. A `doesNotMatch` check still passes after the code moves, because the file it searches no longer holds that code, so re-point or remove it.

## Steps

| Step | What moves | Lines today | Goes to | Status |
| --- | --- | --- | --- | --- |
| 1 | The drawer and the 14 files only it uses | n/a | `features/chat-settings/` | Merged: #9120 |
| 2 | The three separate components at the bottom of the drawer (Memory recall's memories window, the Knowledge agents card, Conversation notes), and the helper groups at the top that stand on their own: game video prompt templates, conversation command toggles, Knowledge agent source settings, the agent menu icons | about 1,080 | Their own files, and `features/chat-settings/lib/` for plain helpers | Merged: #9121 |
| 3 | First, a browser test that opens Chat Settings in a Conversation, a Roleplay and a Game chat and checks that every section for that mode shows. Then settings profiles, scoped regex, group chat, function calling, game widgets, the rest of Lorebooks | about 700 | `e2e/` for the test; `sections/`, one file each | Merged: the test as #9150, the sections as #9123 |
| 4 | Connected chats: four near-copies, one per mode | 7,796–8,088 | First moved as they are, then merged into one component in a second pull request | Merged: the move and a linking test as #9127, the merge into one component as #9213 |
| 5 | In this order: (a) Autonomous messaging and Automatic summarization, Conversation only, with the summaries window and rollover state they alone use; (b) Memory recall, whose two copies share `renderMemoryRecallControls` (only the non-Conversation copy has `forceOpen`; `memoryView` stays in the drawer, which also opens the window); (c) Characters, Persona and Game party as their own pull request, with the pieces all three use in `sections/cast-shared.tsx`. The drawer still draws the inline card editor, so its save-before-close check stays as it is and no `registerCloseGuard` is needed yet. The sections get `renderInlineCardEditor` itself, since Characters draws one editor per member row. Adding and removing members, the pending-card effects and the shared pickers' open state stay in the drawer | about 650 | `sections/` | Merged: (a) and (b) as #9226, (c) as #9237 |
| 6 | Agents, part 1: the per-agent card bodies that need few drawer values, each a component in `agents/` that gets its values as props. Each card's wrapper (`AgentSettingsCard` with its menu id, order and remove) stays with the shell for step 7. Copies found on the way become one each: components for the hold-for-rewrite switch, Music DJ's Spotify settings, Illustrator's controls and Long-Term Memory's settings, and one drawer helper for the prompt picker. The Knowledge agents card and its settings file move too. Cards that read 20 to 40 drawer values (Illustrator's three bodies, Expression, Prose Guardian, Music DJ's provider part, custom agents, the avatar layout card) move with or after step 7, where that state sits beside them, since props for them now would be churn step 7 removes. Each card gets a test in `e2e/chat-settings-agent-cards.e2e.ts` before it moves | about 900 | `features/chat-settings/agents/` | Merged: #9271 |
| 7a | Agents, part 2: the state only. Agents' state, effects and handlers (about 2,050 lines, with the Prose Guardian drafts) move into one hook, `agents/use-chat-agents.ts`, which the drawer calls once. The JSX stays in the drawer and reads the hook's result, so the pull request is a state move with no layout change | about 2,050 | `features/chat-settings/agents/`, with the failed-save-keeps-the-drawer-open test | Merged: #9285 |
| 7b | Agents, part 3: Conversation's face of Agents becomes a component that takes the hook's result, with the heavy Conversation cards (Illustrator's Conversation body) | about 350 | `features/chat-settings/agents/` | Merged: #9301 |
| 7c | Agents, part 4: the Roleplay and Game face becomes a component, with its render helpers and the heavy cards left after step 6 (Illustrator's Roleplay and Game bodies, Expression, Prose Guardian, Music DJ's provider part, custom agents, the avatar layout card). If it's still too big to review, split it by category of cards | about 1,500 | `features/chat-settings/agents/` | Merged: #9349 |

Line numbers refer to `staging` on 2026-11-12 and drift as the file changes. Recount each section's dependencies before its pull request.

Small constants, types and helpers that only one future section uses, like the Prose Guardian defaults, stay in the drawer for now and move with their section. Moving them earlier would only fill `lib/` with files that the later steps re-home. Something more than one place uses moves where they can share it: the persona avatar went to `sections/cast-shared.tsx` in step 5, and the Spotify source options to `lib/spotify-source-options.ts` in step 6, since the agent-add setup screen uses them too.

Agents can't move in small cut-and-paste pieces from the top down: its render helpers read the drawer's state directly, so that state has to move in one go. Step 6 moved the cards that need few values, which left about 1,850 lines of Agents JSX, too much for one review alongside the state. So step 7 moves the state first into one hook (7a) and then each face of Agents (7b, 7c); the two faces never show at once, and the drawer passes both the same hook result.

How step 7a was built: the hook takes 39 values from the drawer and returns 219, which the drawer unpacks under their old names, so the JSX didn't change. The drawer went from 7,562 lines to about 5,660, and the hook has about 2,510. What stayed in the drawer, and why:

- Values other sections read too, passed into the hook: `availableAgents`, `activeAgentIds`, `agentConfigsByType` and what they're built from, and the tracker lists, because Group chat reads `activeManualTrackerTypes` and `activeAgentIds`.
- The guarded close: `requestClose`, `closeForSurface`, `showAgentSuiteModal` and the two save-check refs. The hook is called just above `requestClose`, which reads the hook's `flushProseGuardianDrafts`. `gameSetupConfig` moved above the call, since the hook reads it.
- The 16 Agents render helpers, since they hold JSX. They now sit just below the call and move with their face in 7b or 7c.
- The effect that scrolls to an `agent:` section, beside the drawer's other scroll-to-section effects, since it scrolls the drawer's own panel.

The helpers at the top of the drawer that only Agents uses moved into the hook's file, which exports the ones the JSX also uses. The seven-file rename below wasn't part of 7a; it goes with 7b or 7c.

How step 7b was built: Conversation's face of Agents (the Commands, Illustrator, Calls and Long-Term Memory cards and the schedule preferences, about 320 lines of JSX) moved to `agents/ConversationAgentsSection.tsx`. It takes the hook's whole result as one prop, typed `ChatAgents`, and unpacks the 23 values it reads under their old names, so the moved JSX reads as before. The drawer keeps the result as `chatAgents`, still unpacks what it uses itself, and passes the chat, its metadata, the active agent ids, the text connections, `requestClose` and `rememberSettingsReturn`. The drawer went from about 5,660 lines to about 5,340, and the new file has about 400. What stayed in the drawer, and why:

- All 16 Agents render helpers. The eight the Conversation face calls (the lorebook attachment, Illustrator's prompt model, image style, images per generation and video run interval, the custom agent picker and card, and the Haptic card) are called by the Roleplay and Game face too, so they're passed in as props and move with 7c.
- No state or effects moved: the section only reads the hook's result, so it has nothing to lose while collapsed.

The seven-file rename went with 7c. Before the move, new browser tests in `e2e/chat-settings-agent-cards.e2e.ts` covered the Conversation controls that had none: Illustrator's selfie, prompt and video models, the selfie resolution, video messages, the first frame, both reference scopes and the schedule preferences.

Step 7 also moves the seven files that only Agents uses from the top of `features/chat-settings/` into `agents/`: `AgentSuiteModal`, `AgentPromptTemplateSelect`, `AgentLorebookAttachment`, `ExpressionSpriteSettings`, `RoleplayCommandsSettings`, `HapticConnectionPanel` and `roleplay-agent-menu-icon`. They are plain renames, so everything Agents uses ends up in one folder.

Before step 7 starts, the stack of open steps should be merged down: each step waiting on another adds hand work whenever someone else changes the drawer.

How step 7c was built: the 16 Agents render helpers moved to `agents/agent-settings-renderers.tsx`, and the Roleplay and Game face (about 1,520 lines of JSX: the Roleplay commands, the agent library and every agent's card) to `agents/RoleplayAgentsSection.tsx`. The drawer went from about 5,340 lines to about 2,990. What changed in how the pieces fit:

- The helpers are plain functions, not components, so no input in them remounts on a render. `createAgentSettingsRenderers` takes the hook's result and 16 drawer values and returns them. The drawer calls it on each render and hands the result to both faces as one `renderers` prop, which replaced Conversation's eight render props.
- The face takes `agents`, `renderers` and the 27 drawer values it reads, among them the drawer's own metadata save. Like Conversation's face, it only reads them and holds no state.
- `registerCloseGuard` wasn't built. The rule above adds it when a pull request needs another save-before-close check, and 7c added none: Prose Guardian's drafts stayed in the hook the drawer calls, so `requestClose` still calls its flush directly, beside the Agent Suite and inline card checks.

Before the move, new browser tests in `e2e/chat-settings-agent-cards.e2e.ts` covered the Roleplay and Game controls that had none: Prose Guardian's writing instructions and Hold switch, the two Knowledge cards, Roleplay Illustrator's video and reference settings and scene backgrounds, Review Agent Outputs in both modes, the Agent Suite button, the Game agent list's switches, Game Illustrator with the campaign art style, and Game Music DJ and Lorebook Keeper.

## What the drawer keeps after step 7

- The floating window: title, header buttons, the phone sheet and popped-out sections.
- The order of the sections, and which ones show in each chat mode.
- The values every section needs: the chat, its metadata, the save function and the mode.
- The state that two or more sections share, and the few windows that more than one section opens.
- Closing: run the save-before-close checks, and stay open if one fails.

After step 7, the sections were put in the drawer's code in their display order, and CSS `order` was removed from them. Before, the reading order for keyboard and screen readers differed from what's on screen: Advanced parameters was seventh on screen but near the end of the page's code. The agent cards inside Agents still place themselves with CSS `order`.

## New Chat Settings code

New sections and panels go in their own files in `packages/client/src/features/chat-settings/` (see `packages/client/.instructions.md`).
