# Omnibar UX plan (working file)

Working plan for the omnibar / Professor Mari UX round started 2026-09-30.
It is the single source of truth for an orchestrator agent and for resuming
after a quota stop. Delete this file when every slice is Done.

Branch: `feat/omnibar-professor-mari`. Push only with
`git push origin HEAD:refs/heads/feat/omnibar-professor-mari`. Never push
`staging`/`main`, never open a PR, never deploy, never touch `ssh marinara`.

## North star

The omnibar is three things in one place: search, commands, and the home of Professor Mari.
Every change must make the flow more obvious for a first-time user: what to type, what Enter
does, and how to reach Mari and come back. It must not add a feature for its own sake. If a
slice makes the flow less clear, it is wrong even when its checks pass. (Maintainer guidance,
2026-10-02.)

## How to resume

1. `git fetch origin && git status` in the worktree. If the worktree is gone,
   create one from `origin/feat/omnibar-professor-mari`.
2. Read the Status table. The first row that is not `Done` is next. A row
   marked `In progress` was interrupted: check `git log` for its commit; if
   absent, inspect `git status`/`git diff`, finish or discard the partial work.
3. Continue with that slice. Update the table in the same commit as the slice.

## Status

| #   | Slice                                                           | Owner profile    | Status               | Commit    |
| --- | --------------------------------------------------------------- | ---------------- | -------------------- | --------- |
| 1   | Handoff bugs (A1-A6)                                            | worker           | Done                 | 7a1eef06d |
| 2   | Quick answers: cheap wins (B1-B5)                               | worker           | Done                 | 2b4dd9866 |
| 3   | Quick answers: grounding in docs + setting names (B6)           | worker           | Done                 | f14039aa0 |
| 4   | Carry aside answer into Mari, show what she received (C1-C3)    | worker           | Done                 | 892f2acea |
| 5   | Review of slices 1-4                                            | reviewer         | Done                 | 532479233 |
| 6   | Expanded row redesign (D1-D6)                                   | designer         | Done                 | 2e81ef9de |
| 7   | Mari card mockup + MariCard primitive + notes (E1-E3)           | designer         | Done                 | dbbf886db |
| 7b  | Rework Mari output to the approved direction A (I1-I7)          | designer         | Done                 | 627bfcada |
| 8   | Migrate install/file/created cards to MariCard (E4-E5)          | designer         | Done                 | 8aa390372 |
| 9   | Review of slices 6-8                                            | reviewer         | Done                 | ad7bfc33b |
| 10  | Mobile pull-down from the top bar opens the omnibar (F1-F5)     | designer         | Done                 | 3a04b5342 |
| 11  | Quick answer inside the top Ask Mari row, plus polish (G1-G5)   | designer         | Done                 | 18237a07a |
| 12  | Mari composer redesign with mode + model pickers (H1-H4)        | designer         | Done                 | 7c9f5f8e0 |
| 13  | DB review card + MariEditEasyViewer in direction A (E6)         | designer         | Done                 | ff125a4ad |
| 14  | Final review of slices 7b-13                                    | reviewer         | Done                 | daddf5a02 |
| 15  | Slime pull-to-open from the approved drop prototype (J1-J5)     | designer         | Done                 | bb4f786d0 |
| 16  | Failed replies feed the "fix this" context row (K1)             | worker           | Done                 | a74161ca4 |
| 17  | Relative time on recent-chat rows (K2)                          | worker           | Done                 | 117cb21b8 |
| 18  | Rows for existing chat tools on the chat surface (K3)           | worker           | Done                 | 81393ea47 |
| 19  | Agent-catalog grounding for the quick answer (K4)               | worker           | Done                 | 3ba6e78c9 |
| 20  | Flip more boolean settings in place, with Undo (K5)             | worker           | Done                 | 3e7f5a89e |
| 21  | Measure omnibar open time; cache only if needed (K6)            | worker           | Done                 | f138ad970 |
| 22  | Review of slices 15-21                                          | reviewer         | Done                 | ee502bf2d |
| 23  | Mari reads installed agents and their runs (L1)                 | worker           | Done                 | ce1d1495f |
| 24  | Failed agent runs feed the "fix this" row (L2)                  | worker           | Done                 | 5cdebfb7e |
| 25  | Agent editor as Mari context, agent edits as reviews (L3)       | designer         | Done                 | 3535853a6 |
| 26  | Why a lorebook entry did not fire (L4)                          | worker           | Done                 | 6991cf90d |
| 27  | `chat.updateMessage`: a reviewed reply fix kept as a swipe (L5) | worker           | Done                 | f41a106d6 |
| 28  | Reply-fix review card (L6)                                      | designer         | Done                 | 617a47e05 |
| 28b | Omnibar and Mari above every overlay, game setup included (L8)  | designer         | Done                 | 2ea1f7f65 |
| 29  | Review of slices 23-28b (L7)                                    | reviewer         | Done                 | 112cf53c1 |
| 30  | Composer over the transcript, one always-on fade (M1, M2)       | worker           | Done                 | 167ffaa0a |
| 31  | No scroll back to the question at the end of a run (M4)         | worker           | Done                 | 887b6ac44 |
| 32  | Stable run layout: append only, no layout animation (M3)        | worker           | Done                 | 6bb1ba18f |
| 33  | One header row in Mari mode, no header Mari (M8)                | designer         | Done, amended by 35a | 7506b89ed |
| 33b | Pull drop: accent rim, full width at the edges (M13)            | designer         | Done                 | 1df476615 |
| 34  | "Context" becomes "What Mari sees" (M7)                         | designer         | Done                 | b4586bd4f |
| 35  | Side panels in one surface language (M6)                        | designer         | Done                 | 7160b4798 |
| 35a | Two header lines, Mari inline in the transcript                 | designer         | Done                 | e8509f10b |
| 35b | Bring back the done check and the plop (M14)                    | worker           | Done                 | c624ee0b8 |
| 36  | A run in cards: goal, phases, outcome group (M5a)               | designer         | Done                 | 7f65de826 |
| 37  | Next-step suggestion cards with a fact line (M5b)               | designer         | Done                 | a35066d2d |
| 38  | Small fixes found on the way (M10)                              | worker           | Done                 | 45eedf3c5 |
| 38a | Mari images as small WebP (M15)                                 | worker           | Done                 | f030f7b6e |
| 39  | Mari arrives with context, on every surface (M9, M17, M18)      | designer         | Done                 | c01583495 |
| 38c | The selected Mari everywhere (M16)                              | designer         | Done                 | 38473569d |
| 40  | Review of slices 30-39 (M11)                                    | reviewer, worker | Done                 | 9aeba3739 |
| 41  | Fresh-eyes flow pass (M12)                                      | reviewer, worker | Done                 | a6e98da25 |
| 42  | A failed reply leaves a "Failed · Retry" line in the chat (N1)  | worker           | Done                 | 0d80fb24d |
| 43  | Omnibar commands to start a new chat of each mode (N2)          | worker           | Done                 | ac50dc7cd |
| 44  | Toasts move to the bottom while the omnibar is open (N3)        | worker           | Done                 | bf13aa38e |
| 45  | Mari cards send at once; arrival errors stay strict (N4, N6)    | designer         | Done                 | f94dc3773 |
| 45b | Mari looks down on the pull (N7)                                | designer         | Done                 | 9b4b1b4fe |
| 46  | Review of slices 42-45 (N5)                                     | reviewer         | Done                 | 7502e5429 |
| 47  | Value table: 15 tasks, steps with and without the omnibar (O1)  | reviewer         | Done                 | 67a570772 |
| 48  | It learns your habits: local frecency ranking (O2)              | worker           | Done                 | d052c1420 |
| 49  | It understands your words: setting and command synonyms (O3)    | worker           | Done                 | 90d7d88f9 |
| 50  | Fix or remove what the value table shows is not faster (O4)     | worker           | Done                 | b06687ab6 |
| 51  | Review of 47-50 and a short fresh-eyes pass (O5)                | reviewer         | Done                 | 66551c093 |
| 52  | Mari's working glow is not boxed in; top-bar edge glow (P1-P3)  | designer         | Done                 | 78b8ccdfc |
| 53  | No small Mari in the bottom-right corner at rest (P4)           | worker           | Done                 | 1187e7cab |
| 54  | Redesign the Mari on the Home page widget (P5)                  | designer         | Done                 | 9af31a821 |
| 55  | Review of 52-54 (P6)                                            | reviewer, worker | Done                 | 6e7d8f590 |
| 56  | Professor Mari header: no duplicate ⋮ items, Chats next to + (Q1) | designer         | Done                 | 907fa3bd5 |
| 57  | Omnibar settings redesign, Mari settings move here, packs grid (Q2) | designer      | Done                 | 05b88f313 |
| 57b | Chats · + to the right of the header; chat-card visual audit (Q5) | designer       | Done                 | 652f57fd8 |
| 58  | De-slop all omnibar and Mari text (Q3)                          | designer         | Done                 | cc3081b93 |
| 58b | Type icons everywhere, context for recent chats (Q6)            | designer         | Done                 | 9c7701cd6 |
| 59  | Review of 56-58, 57b, 58b (Q4)                                  | reviewer, worker | Done                 | 40314d650 |
| 60  | Record what was cut, server-side (R1)                           | worker           | Done                 | 122ec6d2e |
| 61  | Reply checkup, no model (R2)                                    | designer         | Done                 | 5267f2fdd |
| 62  | Mari reads the checkup: chat.diagnose (R3)                      | designer         | Done                 | 25fe9dea7 |
| 62a | Fix the "Mari needs your answer" / "working" row navigation (R9) | worker           | Done                 | 8bfa1f99a, e6067407e |
| 62b | One Mari thread per context (R7)                                | designer         | Done                 | dcd18dd78 |
| 62c | Pull-drop rim shares top-bar state colour; fix drag text-select (R8) | designer     | Done                 | 2db202dec |
| 62d | Mari cards v5 (R10)                                             | designer         | Done                 | 66f51efbb, 0ab75f5db |
| 62e | Mari composer v5 (R11)                                          | designer         | Done                 | ce6505267, f2227152e |
| 62g | Mari feels smart and alive again — regressions from 36/37/62/62b (R13) | designer | Done             | a84a46d34, 635e4002c, aa93c736a, f1fc49706 |
| 62h | Errors/retry, step summary, composer v5 follow-ups, sticky Mari (R14) | designer | Done                      | e9fa17e2c |
| 62f | Golden Mari unlocks at 100 h of chat time (R12)                 | designer         | Done                 | 5ab46a8fa |
| 63  | Connection doctor (R4)                                          | worker           | Dropped — maintainer is redesigning connection setup |  |
| 64  | "Connect a model" card + local probe (R5)                       | designer         | Dropped — maintainer is redesigning connection setup |  |
| 65  | Cut and re-measure, review (R6) — T18-T20 + old 15 only, T16/T17 skipped | reviewer, worker | Done | bf5510256, c4e535878, d204582ff, e9beff99d, 0c22971f4, b2ef23500, 0090a9742, 7d7913a93, cdd49c0ac, 3d7178468, 88bea2059, be243fb71, 33748f166, 032e65771, 4eda97c1d, a4f04693d |
| 66  | A/B: staging Mari vs our Mari, then fix where ours is worse (`.tmp/omnibar-ux/round9/mari-ab-66.md`) — scripted-model A/B on production builds (real-model run blocked: no key access); report `.tmp/omnibar-ux/round9/mari-ab/report.md` | designer | Done — real-model rerun pending user OK | 59d0bc4b1 |
| 67  | Real-model Mari A/B + quick bugfix round (`.tmp/omnibar-ux/round9/slice-67.md`) — real run blocked (no saved connection answers: OpenAI key missing, Bifrost refuses the saved model); fixes: header "Ready to help" for an optional Keep/Undo, prompt −2.5k chars (+13.1 % → +9.3 % vs staging), jump-to-latest arrow when her answer grows below the fold; report `.tmp/omnibar-ux/round9/mari-ab/report-real.md` | designer | Done — real-model run still pending a working connection | 0b64e5996, bd4ad2da6, 1c8236b26 |
| 67b | Real-model Mari A/B with MiniMax M3 (`.tmp/omnibar-ux/round9/slice-67b.md`) — staging vs branch, 6 prompts on data copies: B better on p1/p3/p5 substance, worse on p4 (answered Memory Recall from memory, wrong), p2 (guessed), leaked tool names/ids, glued two rounds' text; fixes: look things up before answering, plain words, honest empty checkup, paragraph break between rounds; re-runs fixed p1/p2/p4/p5/p6, p3 no loss; prompt +10.0 % vs staging; report `.tmp/omnibar-ux/round9/mari-ab/report-real.md` | designer | Done | 5e20684a0, 60c69c60d |
| 68  | Bugfix round (`.tmp/omnibar-ux/round9/slice-68.md`) — real models MiniMax M3 + GLM 5.2 via Bifrost, 2 runs per prompt: no finish-reason text (chat.diagnose returns `ended` in words), checkup answers in one shape (one cause, ≤3 bullets, one fix), prompt +10.0 % → +7.5 % vs staging (testScan/diagnose results carry their fix, repair resolves search ids; not ≤ +6 %: rest is earlier trust rules), new thread from a chat keeps Mari's connection (stale fallback + `isDefault` string), feature descriptions no longer trip the completion-claim audit, search matches every typed word; stale regressions/e2e updated, completion-frames DNS stub; report `.tmp/omnibar-ux/round9/mari-ab/report-real.md` § Slice 68 | worker | Done | 4afc2566f…79cd95957 |
| 69  | Bugfix round (`.tmp/omnibar-ux/round9/slice-69.md`) — real models MiniMax M3 + GLM 5.2 via Bifrost: prompt +7.5 % → +5.8 % vs staging (older rules shortened, same meanings); a "why does X forget / cut off" question from a chat runs chat.diagnose server-side first (3/3 per model); checkup result carries on-screen labels (no `maxTokens`/`contextFit` keys); stale open-issues Mari UI checks updated; "Not now" closes the agent-updates dialog at once (declines finish in background). Open: MiniMax p1 holds "just do it" behind Accept in 4/15 runs on the cut prompt (pre-cut 0/6; not the voice rule); report § Slice 69 | worker | Done | 35a7e2460…02fbad37e |
| 70  | Bugfix round (`.tmp/omnibar-ux/round9/slice-70.md`) — real models MiniMax M3 + GLM 5.2 via Bifrost: reply-repair example restored, MiniMax "just do it" extra Accept 0/10 (was 4/15); server filter keeps tool/action names and apply flags out of her visible text and chips (0/10); "Not now" declines all listed updates in one request; chips-only round when an answer ends on a question (chips saved on the message, back after reload), vague-edit prompt line, continuity keeps whole records (re-reads 2/2 → 3/13), finished turn shows steps + final words only; opening Mari no longer invalidates every query (49 → 16 requests, open 1.5–1.7 s → 1.1–1.3 s throttled) and the message list drops prompt-only continuity (−31 % bytes). Prompt +6.4 %. Report § Slice 70 | worker | Done | f4e3b6e87…8de84b3fa |
| 71  | Action cards + one alignment grid (`.tmp/omnibar-ux/round9/slice-71/spec.md`, mockup approved with Q1 A / Q2 quiet / Q3 float): "Needs you" card (accent edge, kicker, plain-word summary, what each button does) for held changes, deletes (one card per turn), sensitive files and installs; held change saved as `mariHeldChanges`; one left edge for text, steps, cards, chips and composer (G1–G8), sprite hangs in the margin on wide panels and floats on phones; fixes F1 (deletes filed under "Changed"), F2 (question line wrap), F3 (file/install reviews shown in every thread) | worker | Done | 8627c7b86 |
| 72  | Steps overhaul, reply links, "Context" (`.tmp/omnibar-ux/round9/slice-72/spec.md`, mockup approved: A / links / Context): phase 1 fixed "Worked for" opening nothing, the "Next" list bottom fade, the dead kept-change box; phase 2 puts "Worked for" on top as the fold (newest open, older folded), groups steps by intent with faces and a leading check, makes reply names links (no reference cards; whole words, list results only when bold), renames "Using" to "Context", shows live narration as the phase caption (server marks a round's words with `metadata.narration`), keeps a worked-around read amber with a green run, hides an empty goal line | worker | Done | 9b8a4bd5b, c75844001 |
| 73  | Context chip X, top-bar status pill, arrival offer (`.tmp/omnibar-ux/round9/slice-73/report.md`, built without a mockup): the composer's "Context" chip X already sent the next message without the chat (proved: no chat context, no reply checkup); fixed ⌘J on a phone right after a chat switch dropping the chat from the chip; top-bar pill "Working · N steps" / "Needs you" / "Done" (fades) / "Failed" from the edge-glow state, tap resumes her thread, server status reports `activeSteps`, status polls every 5 s while she works; arrival offer works but only for ⌘J/pull/top-bar/Home doors from a chat or editor with no thread of its own — kept, pinned by e2e, removal proposed | worker | Done | 0642134fe, 7bd4c24b5 |
| 74  | Change receipts (`.tmp/omnibar-ux/round9/slice-74/spec.md`, mockup approved: Keep + Undo stay on the card / variant A / Why = her reason, else her first Why point): root cause — Keep and Undo delete the undo record, the only copy of the before/after, and the message kept field keys only; now every applied change saves a small record on her message (`changes` excerpts ≤200 chars, list names for entries/greetings/tags, `reason`, `reviewIds`, `undoUntil`, `outcome`; ≤8 fields, ≤12 records), Accept edits mode too; one record per thing a run changed; Keep / Undo write the outcome back; the receipt card (face, plain-word summary, one − / + pair, Why, Keep + Undo while open, Kept / Undone / Undo closed after) replaces the change row and the applied-review card it covers, older messages fall back to field names; prompt examples teach a user-readable `reason`; header "Context" count matches the composer chips (slice 73 leftover). Per-field "Open here" skipped: the editors have no field-level jump | worker | Done | 648a0ebe7 |
| 75  | Match highlight + "add X in/to Y" (`.tmp/omnibar-ux/round9/slice-75/brief.md`): result rows bold the span of the title/subtitle that matched (reused from `searchOmnibar`'s own query, not re-matched in the view; fuzzy/non-contiguous tiers show no highlight rather than a wrong one); `splitOmnibarAddTarget` parses a trailing chat name off "add X to/in/into Y" (only when it actually names a known chat — "Lost in Tokyo" still searches as one name), several tied chats or a dangling "add X to " list candidates instead of guessing; executing attaches to that chat by queuing the assignment and navigating there (new `requestChatResourceAssignmentFor`/`takePendingChatResourceAssign` handoff, same shape as agent-setup's); "remove X from Y" and docs/FAQ highlighting skipped (detach has no equivalent non-active-chat handoff yet; docs rows are not built through `searchOmnibar`) | worker | Done | (uncommitted) |
| 76  | Four red regressions fixed (`mari-ask-latch`, `mari-understood-request`, `assigned-issue-sweep`, `issue-sweep-5371-5375`): three were stale pins left behind by earlier round-9 slices' intended changes (ask-latch arms the overwrite assignment slice 70 switched to, not the old append; `goalNothingReported` was deliberately dropped in slice 72; the receipts/held-card JSX slice 74/71 reshaped); `assigned-issue-sweep` pinned a `resetForChatChange` behavior that `55d351d56` ("Harden Professor Mari guided flows", pre-round-9) deliberately reversed to stop Mari's suggestions/guided plan leaking into another chat (`mari/suggestions.regression.ts` already covered the hardened behavior) — updated the stale pin and the store's doc comment to match, left the store code as `55d351d56` hardened it | worker | Done | ebe30665e |
| 77  | Settings rows show their location: a new `settingsLocationPath` (`settings-registry.ts`) builds "Tab › Section" from the registry, localized the same way the Settings panel's own search is; wired into `buildOmnibarControlResults` (`omnibar-results.ts`) so a quick-toggle row (the bound in-place switches), a plain navigate-only control row, and the `toggleRows` ad-hoc quick toggles (music player, speech-to-text, timestamps, model name, token usage — mapped to their real registry control ids; ambient-effects skipped, no registry entry yet) all get it in front of their description; a section row keeps its existing one-level parent-tab label instead of repeating its own name. Proved live at 390/1440, dark/light. Regression: `settingsLocationPath` asserted non-null and two-level for every `SETTINGS_SEARCHABLE_CONTROLS` entry (`omnibar-settings.test.ts`), plus row-shape asserts in `omnibar-results.test.ts` | worker | Done | (uncommitted) |
| 78  | Empty omnibar: Now + Continue + Try (`.tmp/omnibar-ux/serve/slice-78/spec.md`, mockup approved: variant B / keep Recent ×4 below Continue / Try for everyone until used): new `omnibar-empty-state.ts` — `pickOmnibarNowResult` promotes one existing row (Mari's review, the Fix row, the reply checkup, Mari working/finished, else a no-model setup row) into a header-less tinted "now" group with one action pill; Try rows (`refine-query`, fill the field only) hide per kind on first use (typed pick → search/command, a send → Mari) and all after 15 opens, stored in `marinara:omnibar:try:v1`; Continue = last chat + Mari's last conversation + record edited last (`updatedAt` after `createdAt`), 3 cards ≥640 px; Recent keeps 4 after the Continue chat; frecent keeps non-chat rows; `idleHidden` drops the open chat's members and Regenerate from the empty list; idle slash rows removed; footer "Ask Mari" door on all widths; phone idle placeholder "Search or ask Mari". Regression: group order + Now priority + Try rules + edited-record + idleHidden asserts in `command-center.regression.ts`; e2e pins updated | worker | Done | e9fe68291 |
| 79  | Rich rows everywhere (`.tmp/omnibar-ux/round9/slice-79/brief.md`, inventory + before/after shots in that folder): root cause — the row view read pictures only from `result.preview()`, so rows derived from a record (add/remove, start-chat, message search, lorebook entries) had none, and the `media` field some builders copied was never rendered; highlights came only from `searchOmnibar`, so docs/FAQ/message/entry/add rows had none. New `omnibar-row-visual.ts`: `resolveOmnibarRowVisual` is the one place the row asks for type, icon, picture, chat faces, colour and highlight — a derived row finds its record through the record its action already names (`omnibarRecordRowId`), Mari's rows (Ask Mari, her conversations, approvals, Now/Try) show her face, everything else its type icon; highlights reuse `omnibarMatchQueries` (extracted from `searchOmnibar`), query-echo rows (Ask Mari “…”, See all, Create “Bob”) are not bolded; the Fix row now shows the connection's/agent's image; row images load lazily. Inline chips in the input: proposal only (`slice-79/chips/proposal.md`, recommends an "understood" strip under the input before true inline chips). Regression: every builder row resolves an icon and, when its record has one, that record's picture (`command-center.regression.ts`) | worker | Done | e0ca3c7e2 |
| 79b | Accent highlight, "understood" line, one Mari door (user decisions on slice 79's leftovers): (1) the matched span in a row's title and second line is the theme accent mixed 70/30 with the foreground (`CommandCenterResultRow`), no background, no bold — about 5:1 or better on the card in default and sillytavern, dark and light; (2) `resolveOmnibarUnderstoodLine` (`omnibar-results.ts`) reads the add/remove/start-chat rows and returns one record (+ chat) only when they all agree, else null (bare verb, several names, tied chats, no chat, create rows, plain search); `OmnibarUnderstoodLine.tsx` draws "Add [Eliza] to [Tavern Night]" under the input with 16 px faces from `resolveOmnibarRowVisual`, in an always-mounted `aria-live="polite"` region, opening with a 140 ms height animation (none with reduced motion); (3) slice 78's footer "Ask Mari" pill removed, the pre-78 desktop hint "Ctrl/⌘+J Ask Mari" back; Mari's head in the search bar is the door — aria-label "Ask Mari", tooltip "Ask Mari (⌘J / Ctrl+J)", `aria-keyshortcuts`, inset focus ring, 44 px wide on a phone (56 px tall), faint hover/press tint; keys `commandCenter.footer.askMari*` and `commandCenter.openWork` removed. Proof: `.tmp/omnibar-ux/round9/slice-79/after-79b/` at 390/1440 in dark, light, sillytavern dark/light; show/hide asserts in `command-center.regression.ts`; e2e pin of one "Ask Mari" button in `command-palette.e2e.ts` | worker | Done | 7ecbdba41 |
| 80  | Merge staging, settings overhaul, Mari selector, wording, empty-state bug (`.tmp/omnibar-ux/round9/slice-80/brief.md`): (1) merged 328 staging commits (c040beb38; conflicts in CHANGELOG, ChatArea, AppShell, SettingsPanel, mari-db.service kept both sides; six branch CHANGELOG entries moved out of [2.5.0]); (2) `OmnibarSettingsMenu` labels say what each control does, one-line hints, Home navigator and Mini Mari in a new "Around the app" group, registry labels match with old names as aliases, three Settings controls added to the registry; (3) appearance packs show the 128 px profile pose on a stage, an "In use" pill, and a locked pack's "43 h of 100 h played" with a bar (locked art still never loads); (4) no "story/stories" or "workspace" in omnibar/Mari copy, dead `mari.animationPacks.*` keys removed; (5) bug: leaving Mari for Search unmounted the composer dock while `HomeProfessorMariChat` stayed mounted, and the mount-only effect never measured the new dock, so `--mari-dock-h` was unset and the empty state slid under the composer; a ref callback now measures every dock. Proof: before/after shots in `slice-80/`, e2e `mari-composer-keyboard.e2e.ts` (Mari → Search → Mari by head and Ctrl+J); stale `music-dj-and-floating-ui` / `open-issues` checks and raw safe-area `env()` fixed | worker | Done | df53424b5, 41662a4c4 |
| 81  | Mari gets her personality back (`.tmp/omnibar-ux/round9/slice-81/brief.md`): (1) Reply style keeps one line in her voice in `say` and the diagnose shape allows one; approvals, reasons and diffs stay literal; prompt trimmed elsewhere to +6.3% over staging. (2) Live status line: each finished step moves to the next phrase (`pickMariPhraseIndex`), each run starts on its own, 8 phrases in start/review/long/replying; asserts in `mari-work-card-timing.test.ts`. (3) Real-model A/B (MiniMax M3, GLM 5.2; 5 prompts x 2 runs; staging vs ours): voice NOT yet at staging level. Voice hits, M3 staging 29 vs ours 6; GLM staging 12 vs ours 9. Open: prompt wording alone did not close the M3 gap; the hi-prompt answer lost the most voice. Correctness held on both sides. |
| 82  | Structural cleanup, no behaviour change (`.tmp/omnibar-ux/round9/slice-82/brief.md`, proof in `proof/`): (1) `GlobalOmnibar.tsx` 4,173 → 2,232 lines, split into `layout/omnibar/` hooks (labels, entity rows, local results, screen context, message search, Mari arrival, empty state), result/preview actions, key handlers, `OmnibarResultList` and `OmnibarChrome`; (2) `HomeProfessorMariChat.tsx` 8,310 → 3,269 lines, split into `chat/mari/` (helpers, tool presentation, reply content, work timeline, message, transcript, composer, window header, omnibar header chrome, Chats and Aware-of panels, run/message/chat-history/skill-memory hooks; each hook sits where its statements were, so hook order is unchanged); (3) `globals.css` 13,853 → 8,666 lines: `mari.css`, `omnibar.css`, `omnibar-settings.css` `@import`-ed at their old lines, built CSS byte-identical; (4) dead code deleted (2 files, 5 types/consts, 13 CSS rules + 5 keyframes, 29 en.json keys). Regression pins follow the moved code; "nowhere" checks read all parts. Proof: 52 regressions, `pnpm check`, Mari + command-palette e2e (desktop, phone pull/composer), 16 screenshots at 390/1440 pixel-identical | worker | Done | b8177950c, 366151543, 3278de7f4, 43baab8b7 |
| 83  | Staging blockers and user follow-ups (`.tmp/omnibar-ux/round9/slice-83/brief.md`): (1) focus trap in every Modal was dead since the aria-modal guard compared the panel with the overlay: fixed, `pnpm smoke:ui` 7/7 twice; (2) five pre-existing e2e failures: FAQ window now closes on Ask Mari, stale mobile palette and Mari-handoff specs updated to the current doors; (3) composer stack: guard spec covers answers, empty state, keyboard, error card with Retry, chips, change card and the live run line (fake model), all end above the composer; (4) Mari destinations look like browser tabs, tablist plus one tabpanel, geometry unchanged (max delta 0 px); (5) lorebook rows no longer carry a global enable switch; (6) pill and run timer on the server: Done/Failed stay until the run is seen (per-thread settings key), Needs you until answered, timer anchored on server start and resumes after a reload; (7) calm loading skeleton after 150 ms, fade-in on arrival. Proof: `pnpm check`, `pnpm smoke:ui` 7/7, full mobile command-palette 3 passed (11 desktop-only skipped), touched Mari specs green | worker | Done | cb602a9f9, 189066a38, aa77adab7, 1cafeb812, 2636e68d3, a037fbb39, a1746ecf9, e11ad1ec4, d64cf3cbd, 40801154b |
| 84  | Quick Mari overhaul, variant A (`.tmp/omnibar-ux/round9/slice-84/spec.md`, user decisions 1-4; lead answers in `questions.md`): (1) every follow-up goes to Mari's window, the quick follow-up and the server's `previous` field are gone; (2) Continue with Mari starts a new chat named after the question, and waits until the answer has finished (Enter too); (3) the card says "Quick answer · Read-only"; (4) with no local model Mari's connection is offered in one tap; (5) "Quick answers in Search" wording, and Answer with has "Same as Mari" (follows her connection); (6) the server sends the docs pages it used (`sources` event, kept on the context and in the cache) and every error carries a kind (auth, missing-model, provider, empty, network); the card shows the plain copy, Try again, Continue, Choose a model only for auth/missing model, and the provider message under Details; (7) the wait shows a hairline and "Quick answer when you pause", the thinking state reserves two lines and reads "Reading <pages>…" with a 28 px sprite; (8) the phone Continue is a full-width 44 px button at the foot; (9) the Ask row says "Open Mari to check or change this."; (10) one name for Mari: group "Mari", "Continue with Mari", Ctrl/⌘+J "Open Mari", Try "Get a quick answer", composer "Ask Mari to check or change something"; (11) her window shows the quick answer under the question as a card ("From Search · Quick answer", three lines with Show all, docs pages); (12) docs: `docs/home/professor-mari.md` section and settings overview (translated packs left to the docs-i18n follow-up). Proof: `pnpm check` passed; `pnpm smoke:ui` 7/7; e2e `mari-arrival-append`, `command-palette`, `omnibar-quick-handoff` and the changed `core-flows` test pass on desktop-chromium and mobile-chromium; regressions `command-center` and `professor-mari/quick-answer-error`; harness states in `slice-84/after-final/` at 390/1440 dark/light (no step errors). Still open: the lead's docs-i18n follow-up; the docs corpus returns a development-plan heading as a docs source (see `questions.md`) | worker | Done | 426c11dd4, 85039046a, ed6f65c41, 67b3b88e3, 7aa932615, dd4f775a3, 6f1ef881b, d5ffb78a9, 75d9fd0d4, f13517ecc, e79ebabd6, f0b485a5f, b76a39737 |
| 85  | One playful, draggable Mari (`.tmp/omnibar-ux/round9/slice-85/spec.md`, user decisions 2026-10-08): (1) every pack has its own held sheet (`portrait-drag.webp`, Basic/Dottore/Golden/Safari); (2) the Home navigator is gone: its keyword search, drag, position memory and setting (store v102) are removed, Discord, Credits, Tutorial and Home widgets are omnibar commands, Home surfaces open through `requestHome`, and the onboarding step points at the address bar; (3) the Home Mari widget shows the idle portrait with blink; (4) press and hold lifts Mari on the omnibar head, the Mari window sprite and the Home widget (`useMariHold`, `MariHold`, `MariHoldFigure`), springs back on release, dizzies on shake, and unlocks Please Handle With Care on the first lift. Proof: `mari-hold`, `omnibar-home-commands`, `mari-appearance-pack` regressions, `e2e/mari-hold.e2e.ts` (desktop + mobile), screenshots in `slice-85/proof/`. Review (2026-10-09): held sheets stepped 0/25/50/75 % and showed split frames (now 4 steps of a third); the live-line sprite was not holdable (now `MariHold` too); a drag that ended away from the head swallowed the next keyboard Enter; reduced motion lost her line; her line ran off a 390 screen; Home package tabs are omnibar rows; Discord, Ko-fi and Credits commands fire their achievement events; the Home blink pauses with effects. All four packs checked held at 390 touch and 1440 mouse (`slice-85/review/shots/`); mini Mari visits kept. |

Slice 10 finished 2026-10-01 (commit 3a04b5342: fluid-drop pull-to-open,
revised from the original pill design per maintainer feedback). Slices 1-9
were deployed to prod as of the 2026-09-30 pause (2d999a330 is slices 1-8;
slice 9 fixes are c4f88b4ce, not yet deployed). Slices 11-15 are Done. Slices 16-22 are Done. Slices 23-29 (section L) are Done. Slices 30-41 (section M) are Done. Slices 42-46 (section N) are Done. Slices 47-51 (section O) are Done. Remaining order: 52-55 (section P). Stop after 55.

Staging merge 2026-10-05 (merge commit 94bf98972, staging up to #7096): the #7034
chat window redesign moved chat tools into Chat Settings drawers and deleted
`ActiveLorebookEntriesButton`, so the omnibar's "Active lorebook entries" and
"Search this chat" rows now open Chat Settings at their drawer (`initialSection`
"active-context" / "message-search", like staging's Summary request).

Slice 10 resume note: the unfinished work is on branch `wip/omnibar-slice-10`
(commit 88e297d68), NOT on this branch. Cherry-pick it first
(`git cherry-pick 88e297d68`). Done there: the gesture (touch only, phone shell,
direction lock, threshold, flick, cancel, click swallow, Home long-press clear,
modal/keyboard guards, haptic tick) with a thin pill indicator, the panel
continuing the release velocity, reduced motion, regression asserts; gesture
tests passed on mobile-chromium and mobile-webkit but the temporary spec was
deleted and must be rewritten. Not done: the fluid-drop redesign (F3/F4 revised
below) replacing the pill; the CHANGELOG line and the inventory text still
describe the pill; `pnpm check` did not finish on that state. WebKit on devbox
needs `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` plus local libs and Mesa EGL
variables; `playwright install webkit` removed older cached chromium-1228 and
webkit-2311 builds.

## House rules for every slice

- Read `AGENTS.md`, `packages/client/.instructions.md`, and for UI
  `/home/dev/.claude/skills/marinara-design/SKILL.md`. Ponytail: smallest
  change that works, reuse existing helpers, delete before adding.
- Heavy commands only through `heavy` (devbox rule): `heavy pnpm check`,
  `heavy pnpm exec playwright test ...`. One heavy job at a time.
- Never run commands in the background and never end your turn to wait for
  one. Background shell completions do not wake a Paseo agent. Run long
  commands (including `heavy` ones) in the foreground with a long timeout (up
  to 600000 ms). Only end your turn when the slice is done or truly blocked.
- Never keep `.test.ts` files. Pure logic gets asserts in
  `scripts/regressions/command-center.regression.ts` (run with
  `heavy pnpm tsx scripts/regressions/command-center.regression.ts`).
- Browser proof: temporary spec `e2e/zz-<name>.e2e.ts` (locally excluded from
  git), run with `heavy pnpm exec playwright test e2e/zz-<name>.e2e.ts --project=desktop-chromium`,
  screenshots to `.tmp/omnibar-ux/<slice>/`, then delete the spec and
  `test-results/`. Useful fixtures: `seedUIState(page, { hasCompletedOnboarding: true,
sidebarOpen: false, rightPanelOpen: false, reduceAmbientEffects: true,
professorMariNavigationEnabled: false })`, `localStorage["marinara:whats-new:seen-version"]="2.4.6"`,
  click the page, then `Control+k`. Quick answers can be mocked with
  `page.route("**/api/professor-mari/quick/prompt")` returning SSE frames
  `data: {"type":"token","data":"..."}` and `{"type":"complete"}`, with
  `omnibarAsideConnectionId: "e2e-fake-connection"`.
- Every user-facing string: semantic key in `packages/client/src/localization/locales/en.json`
  (sorted with `localeCompare(a, b, "en")`, keys may not contain `-`).
- Add a user-facing line to `CHANGELOG.md` `[Unreleased]`; keep
  `docs/development/omnibar-feature-inventory.md` true.
- Done means: `heavy pnpm check` exit 0 (capture the real exit code, do not
  pipe through tail), regression passes, browser proof for UI changes, one
  commit per slice, push with the refspec above, status row updated.

## Findings and work items

Paths are under `packages/client/src/` unless noted. Line numbers are from
2026-09-30 and will drift; search by name.

### A. Handoff to Mari (slice 1) — verify each in a browser before fixing

- A1 Context race: `HomeProfessorMariChat.tsx` seeds `handoffContext` as null
  and copies `initialAskContext` in an effect; the auto-submit effect
  (`submitHandoffDraft`) runs in the same commit, so the first handoff sends no
  context and later ones send the previous context; a post-await
  `setHandoffContext(persistentResourceContext(old))` then overwrites the chip.
  Fix: seed state from `initialAskContext` and pass the context into the send
  explicitly.
- A2 Cold connection drops the send: `effectiveConnectionId` is null until
  connections load, `isBusy` ignores loading, the request is marked handled.
  Fix: include loading in the guard so it retries.
- A3 Stale draft returns: `mariHandoff.draft` stays in session state and is
  written back on every mount (`GlobalOmnibar.tsx`, effect near
  `setInputDraft(PROFESSOR_MARI_DRAFT_KEY, session.mariHandoff.draft)`). Clear
  it once applied or sent.
- A4 "Return to results" completion action only `setMariChatOpen(false)` and
  leaves an empty `mari` pane; make it leave the pane like Back does.
- A5 Draft/submit lost on non-omnibar entries: `enterRequestedMariPane` drops
  `request.draft`; `GlobalOmnibarHost` ignores `submitDraft`. Use
  `request.draft ?? context.query`; strip a scope prefix (`faq:`) from the draft.
- A6 No-connection path opens the connections panel behind the omnibar (z-100)
  and drops the request. Show the fix inside the Mari pane instead (the
  composer's connection picker), keep the draft.

### B. Quick answers (slices 2-3)

Files: `hooks/use-omnibar-aside.ts`, `components/layout/omnibar/OmnibarAside.tsx`,
server `packages/server/src/services/professor-mari/workspace-agent.service.ts`
(unasked branch, `buildQuickContextPayload`), `documentation-tools.ts`.

- B1 Send the real surface (`source`) and a deliberate `resourceLabel` (active
  chat or open editor subject) instead of hard-coded `"command-center"` and
  `contextResults[0]`.
- B2 Visible waiting line with the thinking sprite once the call starts (not
  during the idle delay); handle `status` events.
- B3 Errors: plain message plus "Try again" and "Choose a model" (R24).
- B4 Cache answers per `connectionId + query` (small LRU, short TTL) so
  retyping does not pay again.
- B5 Prompt asks for plain text, exact menu labels; client strips stray
  markdown and marks answers cut at the token cap with "…".
- B6 Grounding: server runs the docs search for the query (top 3 excerpts with
  headings) and adds a compact list of real setting/section labels to the
  unasked prompt. Docs only, no user data (R22 stays true). Keep token use
  bounded; local sidecar must still work.

### C. Aside → Mari (slice 4)

- C1 Add the aside answer to `ProfessorMariAskContext` (shared type + server
  summary) when escalating; `⌘↵` escalates the aside when it is live (R25).
- C2 The context chip lists every facet (resource, chat, field, error, settings
  location, aside answer) and stays visible on the sent message, so the user
  sees what Mari received.
- C3 Also send `fieldId` in the server summary.

### D. Expanded row (slice 6)

Today: row title/avatar/description repeated in a second header; 5-6 borders;
chat facts as a table ("Messages 0"); lorebook dumps entries with key pills;
`animate-in` classes do nothing (plugin not installed); actions repeat Enter;
~500px tall at 390px. Files: `components/command-center/CommandCenterResultRow.tsx`,
`components/command-center/CommandResultPreview.tsx`, `GlobalOmnibar.tsx`
(`renderResultPreview`, preview facts, `previewActions`),
`lib/omnibar-entity-rows.ts`, `lib/omnibar-results.ts`.

- D1 No wrapper/card/header/dividers inside the row; body indents to the row's
  text column; the row's selected state is the only frame.
- D2 Description max 2 lines; one Strip of ≤4 `.mari-chrome-control--compact`
  facts per kind; one quiet Note line (greeting / last message / first entry).
- D3 Actions: drop any that equal the Enter action; `.mari-chrome-control--small`
  chips, `--danger` for remove, ≤3, wrapping.
- D4 Motion: `grid-template-rows: 0fr→1fr` + opacity ~180ms, none under
  reduced motion.
- D5 Trim facts per kind; drop duplicate doc facts (Category/Match); FAQ steps
  as a short list.
- D6 Remove stale "external xl panel" wording (`OmnibarDetailPane.tsx`,
  `omnibar-concept.md`). Keep `CommandResultPreview` behaviour for other
  callers (Mari uses it) — add a lean variant or a small `OmnibarRowPreview`.
- Proof: screenshots character/lorebook/chat/connection at 390/768/1440, dark
  and light; touch targets ≥44px on coarse pointers.

### E. Mari cards (slices 7-8)

Vibe tokens: `--marinara-app-accent-gradient`, `--mari-logo-*`,
`.mari-chrome-accent-frame`, `.mari-chrome-accent-tile`, `.mari-chrome-control`
(+ `--primary/--compact/--small/--danger`), radius 0.75rem, body 0.875rem,
labels 0.8125rem/600, pixel sprites, glow. Rules R41-R48 in
`docs/development/omnibar-concept.md` (Card border only when data is involved,
Note has no box, one Chip, no washes).

- E1 Static mockup first (HTML in `.tmp/omnibar-ux/cards/`, screenshots dark +
  light, 390 + 1440) of MariCard variants (review, created, install, danger)
  and the new expanded row. Save the screenshots for the maintainer.
- E2 `MariCard` primitive in `components/chat/mari-primitives.tsx` + `.mari-card`
  CSS: one border weight (accent frame), solid `--card`, icon tile/avatar,
  title 0.875/600, meta line, body without inner borders, one action bar
  (secondary left, primary right), mobile full-width stacked, ≥44px targets.
- E3 Errors/recovery/tools-unavailable become `MariNote` (no box, no wash) with
  an inline Retry chip; remove `.mari-error-card`, the tools-note box and unused
  `.mari-decision-peek`.
- E4 Dependency-install and sensitive-file approvals on `MariCard`; technical
  details (integrity hash, full path, preview) behind one disclosure.
- E5 Created/updated artifact card (`MariWorkspaceActionResultRow`) on the
  `created` variant; stop reusing `CommandResultPreview` + `--compact` overrides.
- E6 (NOT in this round) DB review + `MariEditEasyViewer` rebuild: neutral
  before/after by default, diff behind a toggle, chips for toggles/keys, no
  nested panels.

### F. Mobile pull-to-open (slice 10) — gesture only, NO top bar icon (maintainer decision)

Today the phone top bar has no omnibar button; the only bar entry is a hidden
550 ms long-press on Home (`components/layout/TopBar.tsx`, `HOME_LONG_PRESS_MS`,
`handleOmnibarClick`). Page overscroll is already off on phones
(`styles/globals.css` mobile `html/body overflow:hidden; overscroll-behavior:none`),
the Android app WebView has no pull-to-refresh, and no touch handlers sit on the
bar. `framer-motion` is installed; no new dependency.

- F1 Hook `hooks/use-pull-to-open-omnibar.ts`, bound in `TopBar` to the header
  and to the safe-area spacer in `AppShell.tsx` (`md:hidden h-[env(safe-area-inset-top)]`).
  Pointer events, `pointerType === "touch"` only, mobile shell only
  (`isMobileShellViewport()`). Direction lock after 10 px (`dy > 1.5 * |dx|`,
  down). Then `setPointerCapture`, clear the Home long-press timer, swallow the
  next click (a pull that starts on a button must not press it). `touch-action: none`
  on the header.
- F2 Threshold `min(120px, 18% of innerHeight)`, at least 80px in landscape;
  open on release past it, or on a flick (> 0.5 px/ms after ≥ 40px). Cancel when
  moving back above the threshold, on `pointercancel`, or a second pointer.
  Skip when `ui.modal`, `isModalOverlayOpen()`, omnibar already open, or
  `data-mari-software-keyboard-open`.
- F3 Indicator: a thin (4px) accent pill under the bar that grows and fills
  with progress (`useMotionValue`/`useTransform`, no React re-render per move),
  rubber-band resistance (`dy^0.8`, capped), snaps full at the threshold with one
  `navigator.vibrate?.(8)`, springs back on cancel. Small, low, faint (see
  memory rule: effects start subtle). `aria-hidden`.
- F4 Hand-off: on open, the omnibar panel continues the downward motion (pass
  the release velocity into the panel's initial y). Reduced motion: no
  finger-following, static fill, open at the threshold.
- F3/F4 REVISED by the maintainer: the indicator is a FLUID DROP, not a pill.
  The user pulls a liquid drop out of the bar's bottom edge; it stretches with a
  neck (surface tension), follows the finger with a spring, pinches off at the
  threshold, and on release falls, lands with a small "plop" (squash, settle)
  and MORPHS into the omnibar (shape and radius ease into the card; the real
  dialog takes over at the end without its own open animation playing twice).
  Below the threshold the drop snaps back into the bar with a small wobble.
  One SVG path driven by framer-motion motion values; no full-screen blur
  filter; accent colour. Reduced motion: no drop, open at the threshold.
- F5 Tests: the pure recognizer (threshold, flick, direction lock, cancel) as
  asserts in `scripts/regressions/command-center.regression.ts` or a small new
  regression; browser proof on `mobile-chromium` (CDP `Input.dispatchTouchEvent`,
  example in `e2e/core-flows.e2e.ts` around the touch-drag test) and
  `mobile-webkit` (synthetic touch PointerEvents): long pull opens; short pull,
  pull back up, and horizontal swipe do not; a pull starting on a bar button
  does not press it; no open while a modal is open; reduced motion still opens.
  Risk to note in the report: on iOS a pull from the very top edge may go to
  Notification Center; only a real device can confirm.

### G. Quick answer at the top (slice 11) — after slice 6

Idea (maintainer): bring the quick answer to the top and make it better.
Constraint: R9 put the aside at the bottom so a late answer never pushes rows
under the cursor. Solution: the answer grows INSIDE the promoted "Ask Mari: “…”"
row, which is already first and selected on a dead end; content is only ever
inserted below the selected row (same rule as R40 and the slice 6 expansion).

- G1 Move the aside UI (waiting line, streamed answer, error with Try again /
  Choose a model, disclosure, link chips) from `OmnibarAside` into the Ask row's
  expansion; the bottom aside slot goes away. When the Ask row is not promoted
  (a normal search), no call is made (unchanged dead-end rule). Update R9 in
  `docs/development/omnibar-concept.md` and the inventory: the answer lives in
  the Ask row, never above the selection.
- G2 Light formatting for the answer (bold, lists, inline code via the app's
  existing message markdown renderer if it is cheap to reuse; otherwise keep
  plain text), and "…" when cut at the token cap.
- G3 Small row actions: Copy, Answer again (bypasses the cache), and Enter /
  ⌘↵ = continue with Mari carrying the answer (slice 4 behaviour).
- G4 One follow-up line inside the row ("Ask a follow-up…") that sends a
  second quick call with the previous answer as context; a third question goes
  to full Mari.
- G5 Expose the idle delay (`OMNIBAR_ASIDE_DELAY_MS`, default 3s) in the omnibar
  settings view (R23 says it is a knob). Proof: mocked SSE answers, screenshots
  390/1440 dark+light, no row above the Ask row moves while streaming.

### H. Mari composer redesign (slice 12)

Idea (maintainer): put the permissions mode (Auto / Ask / Bypass) in or above
the chat bar like ChatGPT and Claude, and redesign the composer a bit. Today
"Auto" is a pill in the tab row at the top of the Mari view, far from typing;
the composer has attach, the context chip and the connection (chain) button.
Files: `components/chat/HomeProfessorMariChat.tsx` (composer, header tab row,
Permissions Mode pill), the permissions mode store/setting (search
"Permissions Mode", #5725), `components/chat/ProfessorMariContextControl.tsx`.

- H1 A compact toolbar row in the composer (below or above the textarea, like
  Claude): mode menu (Auto / Ask first / Bypass, one-line explanation each,
  current mode as the pill label), model/connection menu (replaces the bare
  chain icon), attach. `.mari-chrome-control--compact` chips, menus as
  popovers inside the omnibar dialog (focus + Escape handled like the settings
  view), 44px targets on touch.
- H2 Remove the mode pill from the tab row; the header becomes one calm row
  (sprite + title, tabs, close).
- H3 Keep behaviour identical: same store values, same server semantics;
  Bypass keeps its warning wording.
- H4 Proof: screenshots 390/768/1440 dark+light of the empty state and a
  conversation; keyboard: the mode menu opens with Enter/Space and closes on
  Escape without closing the omnibar.

### I. Approved direction A (slice 7b) — the reference for every Mari output slice

The maintainer rejected the first card mockup (slice 7: identical glowing
bordered boxes, gradient icon tiles, big pink-on-pink buttons, content missing)
and APPROVED direction A of the live demo. Reference, committed with this plan:
`docs/development/mockups/mari-v3/index.html` (open it in a browser; it plays a
scripted run; Replay/Pause/Light/2× at the bottom left). Direction A rules:
text first, chrome last; tool steps as quiet one-line disclosures with an icon
and a past-tense label; the running step is the live line itself (not also a
row in the list); an applied edit is ONE summary line ("Updated Zylo Vantrell ·
3 changes") that opens to tracked changes (old struck and muted, new with tint +
underline so colour is not the only signal; tags as −/+; greeting word by
word) with Undo / Keep as small text buttons; a created thing is a small inline
tile (avatar/portrait, name, one-line hook, "Open ›"); only risky prompts
(delete, install, sensitive file) get a neutral grey 1px border (not pink),
one primary (red Delete / solid neutral Install) and a quiet text secondary,
technical details collapsed; after an answer a prompt folds to one line; a
failed send is one red line under the user's message with Retry; the accent
colour only on her name; the run ends with "Worked for Ns · N steps" at the
bottom with the sprite (success, then idle).

- I1 Rework the slice 7 `MariCard`/`MariNote` (`components/chat/mari-primitives.tsx`,
  `.mari-card` CSS) to direction A: neutral border only for risky prompts, no
  glow, no gradient tiles, small buttons; keep the component names if possible.
- I2 Edits: the applied-change summary line + tracked-change body with Undo/Keep
  (replace the DB review card's default Easy view presentation for prose fields;
  the full DB review rebuild is slice 13).
- I3 Created/updated resources: the inline tile (replaces
  `MariWorkspaceActionResultRow` + `CommandResultPreview` reuse) — this absorbs
  plan item E5.
- I4 `MariWorkTimeline`: quiet step lines; the running step only in the live
  line; "Worked for Ns · N steps" at the bottom where the live line was; the
  sprite stays (success → idle). Respect the appearance-pack rule unless the
  demo's hop is cheap to allow.
- I5 Failed send: one red line under the user's message with Retry (not a Mari
  status line).
- I6 Tone the end-of-run glow DOWN (maintainer rule: small, low, faint; the demo's
  green is too strong) and fix the phone header status truncation ("Professor
  Mari needs your a…") — shorten or wrap the status text.
- I7 Proof: real app screenshots of a mocked run (mock the Mari workspace
  endpoints in Playwright) at 390/1440, dark+light, side by side with the demo;
  reduced motion.

Slice 8 now means E4 only (install and sensitive-file prompts in direction A)
since E5 moved into I3. Slice 13 (E6): the DB review card and
`MariEditEasyViewer` in direction A — neutral tracked changes by default, the
exact diff behind a toggle, chips for toggles/keys, no nested panels, Raw as one
disclosure. The applied-edit group moves inside the turn it belongs to (today
it renders in `pendingApprovalsPanel`, below "Worked for…" after the whole
transcript) as part of that rebuild.

### J. Slime pull-to-open (slice 15) — approved by the maintainer 2026-10-01

Reference: the approved interactive prototype `.tmp/omnibar-ux/drop/index.html`
(served at http://10.0.0.127:8799/drop/; constants at the top of its script).
It replaces the slice 10 drop/pill visuals; the slice 10 recognizer, guards and
tests stay where they still fit.

- J1 Gesture: start anywhere on the phone top bar (touch only, phone shell
  only, existing guards); after the pull starts the finger steers; at release
  the left half opens the omnibar, the right half opens Mari (omnibar in the
  Mari pane); a dead zone with hysteresis in the middle; when Mari is disabled
  the whole bar opens the omnibar. Threshold 30% of the viewport height
  (min 160px, max 280px), flick opens early, pulling back cancels.
- J2 Shape: one smooth, symmetric, calm sheet pulled out of the bar's bottom
  edge (wide base, gentle taper, no string, no bumps, bar edge straight outside
  the pulled area), ending in a circle with a small bar under it; circle shows
  the magnifier (left) or Mari's pixel portrait from the active appearance pack
  (right); small bar reads "Search" / "Ask Mari", at the threshold "Release to
  search" / "Release to ask Mari" (localized keys). Circle and small bar sit
  ABOVE the fingertip.
- J3 Colour: exactly the top bar surface (`--marinara-topbar-surface` over the
  app background, same blur) at the join, opaque at the top to more transparent
  at the bottom; no accent in the sheet, only a faint glow around the circle
  when armed. Dark and light.
- J4 Motion: viscous follow, slight sag, stretch; at the threshold the sheet
  thins and releases the circle, the sheet snaps back into the bar, the circle
  pops open into the omnibar search field or the Mari view (portrait flies to
  the header, title fades in after it); below the threshold everything slurps
  back. One SVG path / clip path driven by framer-motion motion values, no
  React re-render per move, 60fps. Reduced motion: no sheet, only the label
  near the finger, opens at the threshold.
- J5 Proof: regression asserts for the pure parts (threshold, side/dead zone,
  flick, cancel); browser tests on mobile-chromium and mobile-webkit (long pull
  left opens the omnibar, right opens Mari, short pull and pull-back do not, a
  pull starting on a bar button does not press it, no open under a modal);
  screenshots dark+light compared with the prototype; CHANGELOG and inventory
  updated; `heavy pnpm check` exit 0.

### K. Assistant round 2 (slices 16-22) — approved by the maintainer 2026-10-01

Source: the strategy report (jobs the omnibar owns; Mari only behind the dead
end). Only items that need no product decision. Rules for every K item: unasked
Mari calls get query + surface + resource label + docs/settings labels only
(R22); user content leaves the device only after a deliberate act; every write
is a review (R5); if a deterministic row answers, ship the row, not a Mari run.
Check what already exists before adding anything.

- K1 Fix what just broke: today `lastAppError` is set only by connection tests
  (`hooks/use-connections.ts`). In `hooks/use-generate.ts` (`showError` and the
  agent-failure path) also call `setLastAppError({ message, action: "Generate
reply", retry: { kind: "open-connection", id: <active connection> } })`;
  clear it on the next successful generation. The context row and the
  `chat-error` Mari handoff exist already. Error text goes to Mari only on ⌘↵.
  Proof: regression assert on `buildOmnibarContextResults` with a generation
  error; e2e that mocks a 500 from generate, then ⌘K shows the error row first
  and ⌘↵ opens Mari with `source: "chat-error"`.
- K2 Relative time: recent-chat rows show an absolute date
  (`formatDate` in `lib/omnibar-entity-rows.ts`). Use the existing
  `formatRelativeContact` (`lib/relative-time.ts`) for the second line, at least
  in the Recent group. Proof: regression assert with a fixed `now`; screenshot
  390 and 1440.
- K3 Chat tools as rows: on the chat surface, reach Summary (`SummaryPopover`),
  Active lorebook entries, Peek prompt, Search this chat, Continue and
  Regenerate from the omnibar; each row opens/runs the existing UI, nothing new
  behind it. First list which already exist as `data.commands` and skip those.
  Mari never writes roleplay. Proof: regression on surface rows; e2e opening
  Summary from ⌘K.
- K4 Agent catalog grounding: when a quick-answer query asks for a capability
  ("images", "music", "maps"…), add 2-3 matching lines from
  `official-agent-knowledge.ts` to the aside context (static data only, R22
  holds) and show a link chip to Download Agents. Proof: extend the
  quick-context-payload check; mocked answer shows the chip.
- K5 Flip settings in place: only 9 of 59 `Toggle` controls in
  `settings-registry.ts` flip in the omnibar (`toggleRows` in
  `omnibar-results.ts`). Add a small `controlId → { get, set }` binding map for
  client-store toggles next to `omnibar-settings.ts`; the registry stays plain
  data. Exclude server-backed and risky toggles (anything that deletes, spends
  money, or changes security). Keep the existing Undo toast. Proof: regression
  assert that every bound id is a `Toggle` in the registry; e2e flip + Undo.
- K6 Open time: add `performance.mark`/`measure` on ⌘K or pull and on the first
  result paint (`useLayoutEffect`), logged only in debug mode (client
  `console.debug`). Measure on a large fixture (2k characters, 5k chats). Add a
  cache for derived rows only if p95 > ~100 ms; otherwise record the numbers in
  this file and ship only the measurement. Proof: the numbers.
  Done 2026-10-01: marked in `setOmnibarOpen` (the shared open action every
  trigger - ⌘K, the pull gesture, the topbar click - already routes through)
  and measured in `GlobalOmnibarDialog`'s first non-Mari-pane `useLayoutEffect`
  (`packages/client/src/lib/omnibar-open-timing.ts`). Measured with a mocked
  `/api/characters` (2,000 rows) and `/api/chats` (5,000 rows), 40 opens via a
  temporary `e2e/zz-omnibar-open-perf.e2e.ts` (deleted after the run):
  **p50 138.4 ms, p95 157.0 ms, max 1608.6 ms (n=40)**. p95 is over the
  ~100 ms bar.
  Slice 22 review correction: the `memoizeLastByKeys` cache added here keyed
  `buildOmnibarChatRows`/`buildOmnibarCharacterRows` on `useMemo` lookup maps
  (`characterById`, `connectionById`, `personaById`,
  `lorebookNamesByCharacter`) that `GlobalOmnibarDialog` recreates on every
  mount - and the dialog unmounts on close - so the cache could never hit
  across opens and was dead weight; it has been removed and those two
  builders are plain functions again. The real, zero-risk win found in review:
  `GlobalOmnibar.tsx`'s `data` memo (and the ranking/searchable memos
  downstream of it) depended directly on `setDefaultPreset`/`updateLorebook`,
  the `useMutation` result objects, which TanStack Query hands back as a new
  reference on every render, so that memo chain rebuilt on every keystroke
  and hover while the dialog was open, not just on open. Extracting their
  stable `.mutate`/`.mutateAsync` functions into the dependency array (the
  same pattern the file already used for `patchChat`) fixes that unnecessary
  work. This does not touch the measured open→first-paint numbers above,
  which stay the real baseline: p95 ~136-157 ms, still above the ~100 ms bar.
  The next lever - capping or virtualizing the idle list on a 7k-entity
  library - needs a maintainer decision and is out of scope for this round.
- Slice 22: reviewer pass over 15-21 (read-only findings, then a worker fixes
  the confirmed ones in the same slice).

Needs the maintainer's decision, NOT in this round: batch review for library
chores, lorebook health check placement, Mari in the
game setup wizard.

### L. Mari in chats and in agents (slices 23-29) — maintainer decision 2026-10-01

Decision: Mari helps inside and outside chats, inside the agent surfaces, and knows the agents.
In scope: #6 (why an entry did not fire), #9 (fix a broken reply as a review), agents. Out: batch
library writes, lorebook health check, game setup (L-open). K's rules hold for every item: unasked =
query + surface + resource label + docs/settings labels (R22); chat text, error text, prompts and
field values go to Mari only after Enter/⌘↵ and show as `MariContextFacetChips` facets; every write is
a review (R5); a deterministic row beats a Mari run; no new buttons in editors or chat (R29) — the doors
are ⌘K, the top bar and existing rows. Repo boundary (AGENTS.md): only Engine host code here.

- L1 Mari reads agents (server only). `executeAgentAction` (`mari-db.service.ts:4381`): `list` merges
  the installed registry (`agent-registry.ts`, the same source as `GET /capability-packages/agents`,
  `capability-packages.routes.ts:110`) with `agent_configs`: name, type, packageId, phase, category,
  modes, enabled, custom/package, prompt overridden yes/no, setting keys (names only, no values);
  `get` accepts an id or a type (`getById ?? getByType`, `agents.storage.ts:119/124`). New read
  `agent.runs { type, chatId?, limit≤10 }` from `getLastRunByType`/`listRunsByTypeForChat`
  (`agents.storage.ts:475/568`): success, error, durationMs, createdAt. Add `runs` to the read regex
  `appDataActionLooksReadOnly` (`workspace-agent.service.ts:1869`) and the action enum (`:328`).
  Prompt (`:772` block): before "which agent fits" check `agent.list` installed, then the catalog,
  then link Agents → Download Agents; never claim an uninstalled agent is active. Proof: regression
  asserts that `agent.runs` is read-only and that the merged list includes a registry-only agent.
- L2 Failed agent runs feed "fix this". `lastAppError.retry` (`ui.store.ts:669`) gains
  `{ kind: "open-agent"; id: agentType }`. Set it where `agent_error`/`agents_retry_failed` land
  (`use-generate.ts:2948/3180`, from `toAgentFailure`, `lib/agent-failures.ts:64`) with action
  "Run <agent name>"; never overwrite a current "Generate reply" error; clear on the next clean run.
  `buildOmnibarContextResults` (`omnibar-results.ts:982`) keys the row on `retry.kind` (connection row
  or `agent:<type>` row, Enter opens the agent editor); `buildAskContext` (`GlobalOmnibar.tsx:2345`)
  sends `source: "chat-error"` + `resource { kind: "agent", id: type }` for either row; Mari then calls
  `agent.runs`. Proof: regression on the context rows with an agent error; e2e mocks an `agent_error`
  SSE frame, ⌘K shows "Fix: Run Illustrator failed" first, ⌘↵ shows the error + agent facets.
- L3 Agent editor as Mari context (designer). `AgentEditor.tsx` (prompt `:1016`, name, description)
  sets `activeEditorField` on focus exactly like `CharacterEditor`; the existing "Improve {{field}}
  with Mari" row (`omnibar-results.ts:997`) and field facet then work with no new UI. Fix custom agents:
  `resolveResource` resolves `agent` by id then type (`workspace-agent.service.ts:3825`), so ⌘↵ on
  "Editing <custom agent>" no longer says "no longer available". Prompt edits go through
  `agent.update` → applied review: `MariEditEasyViewer` (`rowTitle :43`, icon `:167`) labels
  `agent_configs` "Agent" with the agent icon, `promptTemplate`/description render as prose
  (`trackProseChange`), `settings` JSON stays behind Raw. With the catalog open, `asideResourceLabel`
  is "Download Agents" (`GlobalOmnibar.tsx:1502`). Proof: e2e edit a custom agent's prompt via a mocked
  Mari review, Keep and Restore; screenshots 390/1440 dark+light of the agent review row.
- L4 Why an entry did (not) fire. "Did fire" is already deterministic (matched keys in
  `ActiveLorebookEntriesPanel`, `ChatRoleplayPanels.tsx:375`; K3 row) — no Mari. New read
  `lorebook.testScan { lorebookId, chatId, entryId? }` wrapping the `POST /lorebooks/:id/test` logic
  (`lorebooks.routes.ts:1335` → `runLorebookTestScan`): returns activated/blocked with reasons, plus
  "no key matched in the scanned messages" for an absent entry. Mari gets keys and reasons, not the
  scanned text. Door: ⌘↵ on a lorebook-entry row while a chat is active sends the lorebook resource +
  `activeChat` (facets: lorebook, chat); typed "why didn't X fire" works too. Prompt line: answer with
  the reason and the exact setting to change, offer `lorebook.updateEntry` (review) only if asked.
  Proof: regression on the result shape for a secondary-key block and a no-match; e2e mocked answer.
- L5 `chat.updateMessage` (server). New write `chat.updateMessage { chatId, messageId, content, reason }`
  for assistant/narrator messages in non-game chats only. It never overwrites: it adds the fixed text
  as a new swipe and makes it active (reuse chat storage `addSwipe` and the active-swipe path behind
  `chats.routes.ts:3881/4010`), so the old reply is kept. Always a review card, also in Accept-edits/Bypass (like deletes, `mari-db.service.ts:7427`);
  Restore sets the old swipe active and removes the new one through chat storage, never a raw row
  restore. Guard: raw `mari db` writes to `messages`/`message_swipes` (`file-backed-store.ts:362`) are
  refused with a pointer to `chat.updateMessage`. Prompt: repair only (cut-off end, OOC lines, broken
  formatting), keep the voice, never continue or rewrite the scene. Door: typed "fix the last reply" on
  the chat surface, or ⌘↵ on a message hit (`commandCenterResultId` carries the message id; print it in
  `buildHandoffContextPrompt`, `:3805`). Proof: regression on the guard and on read-only/write
  classification; e2e Keep and Restore keep both texts as swipes.
- L6 Reply-fix review card (designer). `MariEditEasyViewer`: a `messages` change reads "Reply ·
  <chat name>", content as tracked prose, Restore wording "Put the old reply back". After Keep, the
  open chat shows the new swipe without reload (invalidate the chat messages query). Proof: screenshots
  390/1440 dark+light; e2e the chat shows the fixed text and swipe 2/2.
- L7 Reviewer pass over 23-28 (read-only findings, then a worker fixes the confirmed ones). Check R22
  on every new payload, that no write skips a review, and the inventory/CHANGELOG.

Belongs in Pasta-Devs/Marinara-Agents, not here: per-setting help text for each agent (manifests
have only an untyped `defaultSettings`; Mari can name keys, not explain them), better error text from a
package agent, Mari inside feature-package UIs (`FeatureAgentDetailHost` content), catalog
descriptions (`official-agent-knowledge.ts` mirrors them; refresh it when the catalog changes).

L-open resolved 2026-10-01: the maintainer decided "Omnibar and Mari should be above all!" (L8).

- L8 Omnibar and Mari above everything (designer, slice 28b). Today the omnibar is `z-[100]`
  (`GlobalOmnibar.tsx`, backdrop and the preview layer at `z-[110]`) while many overlays sit higher:
  `z-[9999]` popovers, the game setup wizard and lightbox at `z-[10000]`/`z-[10001]`, capability
  elements `z-[10020]`, the chat help overlay `z-[10050]`, `CsrfOriginWarningBanner` 9999. Put the
  omnibar, the Mari pane/workspace takeover and their own portalled popovers/menus/tooltips above all
  of them with ONE shared layer constant (or CSS variable) instead of new magic numbers; keep the
  sonner `Toaster` (`App.tsx`) above the omnibar so Undo toasts stay visible. Skip
  `PersonalExtensionContributionsMenu` (`z-[2147482000]`, user extensions) only if it cannot be
  outranked sanely; note it. ⌘K and the slice 15 pull now open over modals and the game setup wizard
  too (relax the "no open under a modal" guard: open ON TOP instead); Escape closes the omnibar first
  and leaves the modal underneath intact; focus returns to the modal. With the wizard open, the surface
  is the game setup, so typed questions reach Mari as the existing `game-setup` entry point with the
  wizard step as label only (R22) — no new button in the wizard (R29). Proof: e2e at 390 and 1440
  that opens ⌘K over the game setup wizard, a lightbox and a Settings dialog, Escape returns to each;
  pull-to-open over a modal now opens; screenshots dark+light; regression where pure.

  Done 2026-10-02. One layer, `--mari-layer-omnibar: 100000` (`globals.css`), used by the omnibar
  root, its error panel, the pull overlay (+1), Mari's portalled dialogs/popovers (+1/+2),
  `HelpTooltip` (+1) and the expanded macro editor (same layer, DOM order). A `Modal` opened while
  the omnibar is open takes the layer. NOT a slice 15 regression: the "no pull/⌘K under a modal"
  guard was removed on purpose; covered bars are followed on the document. Skipped:
  `PersonalExtensionContributionsMenu` (2147482000) and `PersonalExtensionInjector` windows
  (2147483000) stay above; they already sit above sonner (999999999), so outranking them would mean
  moving the toaster into the 2^31 range too. The regression pins both exceptions.

### M. The Professor Mari window, round 4 (slices 30-41) — maintainer feedback 2026-10-01/02

Source: the maintainer's nine points on the Mari window, reproduced with a mocked long run (temporary
`e2e/zz-mari-window.e2e.ts`, deleted; evidence in `.tmp/omnibar-ux/round4/shots/`, `*-log.json` has the
per-frame scroll log). Target design: `docs/development/mockups/mari-v4/index.html` (5 scenes, Light / Phone 390 /
Glow off toggles; screenshots in `round4/mock/`). Direction A (section I) and K/L rules hold: unasked = query +
surface + resource label + docs/settings labels (R22); every write is a review (R5); a deterministic row
beats a Mari run; no new buttons in editors or chat (R29).

Paths are under `packages/client/src/` unless noted. Line numbers are from 2026-10-01 and drift (other
agents commit here); search by name.

Order: bugs first (30-32, small, worker), then the redesign (33-38, designer), arrival (39), review
(40), fresh-eyes flow pass (41).

Maintainer decisions (2026-10-01), YES to all four open questions:

1. The header portrait goes away in Mari mode; slice 15's portrait flight lands on the arrival
   sprite instead (already the plan for M8/M9 below). **Amended by maintainer decision
   2026-10-02 (slice 35a):** no header portrait (slice 33 stays correct), but Mari must always be
   visible inline in the transcript: in the empty state, in the resting/finished state, and in the
   existing live-work state. The header is two lines (name + status, then the destinations), with
   no portrait. The slice 15 pull target is the inline resting sprite in the transcript, not the
   header.
2. Desktop mouse drag on the top bar: build it (slice 39), reusing the slice 15 recognizer, on
   empty bar space only — not a progressive-enhancement maybe, ship it.
3. Action cards may act at once without Mari (open a picker, start a chat, Peek prompt) — already
   the action-card half of M5b below.
4. `MariSuggestionChip` gains an optional `detail` field from the server — already specified in
   M5b below.
   Also: Mari output must be things you read and act on (reference pills, the hairline row group,
   suggestion cards with a fact line), never long paragraphs. Treat the mockup as the target.

Slice table for 30-41: see the top-level Status table (the single source of truth; this section
does not keep its own copy).

#### Root causes (reproduced)

- **M1 "the composer sits on its own box".** The transcript and the composer are flex siblings
  (`HomeProfessorMariChat.tsx`: `div[data-component="HomeProfessorMariChat.Transcript"]` ≈5887 and
  `form.mari-workspace-composer-dock` ≈5987). Content never passes under the composer; the strip under it
  (≈117 px at 1440, ≈100 px at 390) shows only the opaque canvas (`.mari-workspace-canvas`,
  `globals.css` ≈1923, `color-mix(--background 97%)`; in dark mode near black) and the composer shell's own
  `--marinara-chat-chrome-input-bg` (`rgba(20,20,20,.85)`). So scrolled text stops at a line and the strip
  below is a dark block.
- **M2 "the glow box swallows content with a hard edge".** While she works, the band lives in the dock's
  `::before/::after` (`globals.css` ≈746-810, `z-index:-1` inside `isolation:isolate`), that is inside the
  same box. The transcript has no bottom fade at all; its only mask is a TOP fade that is on only while
  following (`.mari-workspace-transcript[data-following="true"]`, ≈1951, toggled per scroll in
  `handleTranscriptScroll` ≈3670). Scrolling up removes the top fade too, so both edges become hard, and the
  fade flickers on/off at the 72 px threshold. Also: `reduceAmbientEffects` does not turn the band off (only
  `prefers-reduced-motion` stops its animation).
- **M3 "things jump while she works".** (a) Every step row is `motion.li layout` with
  `initial {y:6, blur}` inside `AnimatePresence` (`MariWorkTimeline` ≈1856) inside `MariSmoothGrow`
  (≈1709, `overflow:clip` + 0.5 s height transition, `globals.css` ≈2475). Rows animate position while the
  box animates height: frame `shots/390-dark-glowon-run-11.png` shows "Reading done." on top of the
  documentation row, a ghost "Read character" row, and "Thought for 1s" gone for a frame. (b) At the end the
  live `<MariWorkTimeline>` (≈5938) unmounts and a second `<MariWorkTimeline active={false}>` mounts from
  the reloaded message (`renderDisplayMessage` ≈2418): every row re-renders, the live line becomes a
  shorter "Worked for" line, `MariSmoothGrow` switches off (height snaps). (c) The stack is bottom-anchored
  (`data-anchor="bottom"` → `margin-top:auto`, ≈1940), so the question rides up the screen with every
  line. (d) Reviews, the resting story line and the suggestion question are hidden while working
  (`visiblePendingChangeReviews` ≈3572) and pop in after.
- **M4 "at the end it scrolls back up to the question".** `sendWorkspaceMessage`'s `finally` sets
  `setWorkspaceActive(false)` (≈4783) the moment the stream closes, which unmounts the live timeline.
  `refreshAfterWorkspaceRun` (≈4808) only then fetches the messages; the timeline is cleared after the
  fetch. For that gap the transcript holds only the question: `scrollHeight` falls to `clientHeight`
  (log: `top 430 → 0, h 926 → 496`, question at the bottom edge for ≈500 ms with a 250 ms mocked fetch;
  longer on a real server). The browser clamps `scrollTop`. If the reader was within 72 px of the bottom,
  the scroll event re-arms following and the reply snaps back (a visible jump); if the reader had scrolled
  at all, `transcriptFollowOutputRef` stays false (≈3654) and the view stays clamped at the question
  (`shots/1440-dark-scrolledup-log.json`: `top 0, qTop 17` after the reply lands).
- **M5 structure.** One long markdown answer; steps grouped only as "rail" vs text; the outcome (applied
  review, created tiles, decisions) sits after the prose; the guided "what next" is chips over the composer.
- **M6 sidebars.** Three panel styles: Chats is a card in a card (`sm:rounded-xl sm:border sm:shadow-2xl`,
  ≈6321) with pink Rename/Delete buttons per row; Skills has its own pink frame (`MariSkillsMenu`); Context
  is a translucent slot (`cn(MARI_PANEL_SLOT_CLASS, "… bg-[var(--background)]/45")`, ≈6609) that on a phone
  overlays the transcript at 45 % so both texts mix (`shots/side-390-dark-context.png`, a real bug).
- **M7 "context" is three things.** The header destination "Context" (attached chat histories + the
  persistent focus + the trust strip), the one-shot handoff chip in the composer (`oneShotContext`, one X
  removes all facets), and `ProfessorMariContextControl` outside omnibar mode. The panel copy ("Only the
  context shown here is attached to this Mari workspace") does not say what she reads or when.
- **M8 header Mari.** In Mari mode the omnibar header shows her portrait, name and status
  (`GlobalOmnibar.tsx` ≈2824-2862) above a second row of destinations (`mari-omnibar-header-row`, ≈2963),
  while the transcript already shows her (live line sprite, "Worked for" sprite). Two rows ≈107 px; at
  390 the destinations clip ("Cor…").
- **M14 the done check and the plop (added 2026-10-02, maintainer feedback after deploy of e8509f10b).**
  The maintainer asked for the green done check and the entrance "plop" back, reading M3/slice 32 as
  having deleted both. Checked with `git show 6bb1ba18f^:…HomeProfessorMariChat.tsx` against the current
  file: the `mari-work-timeline__done-mark` svg and `settleTo={restStory === "success" ? "idle" :
undefined}` were never removed — slice 32 only dedented them when it deleted the `MariSmoothGrow`
  wrapper, and slice 35a's inline-sprite rework (M8/M9) kept both on the same `.mari-work-timeline__live`
  line without touching them. What slice 32 did cut on purpose was the step row's entrance: `motion.li
layout` with a `y`/blur slide became opacity-only (150 ms), because the slide was fighting
  `MariSmoothGrow`'s height transition (M3 root cause above) and produced ghost/overlapping rows. That
  part is the real gap: steps now fade in with no "plop", and a step's running→done/error transition is
  silent.
- **M13 pull drop at the screen's sides (added 2026-10-02, slice 15 bugfix).** On a phone the drop's rim
  shimmer is always white (`OmnibarPullDrop.tsx` gradient stops hardcode `#fff`). Near a side the sheet
  narrows on both sides (`use-pull-to-open-omnibar.ts` clamps `base` to `min(cx, width - cx)`), the circle
  stops 12 px plus its radius in from the edge, the small bar centred on it runs off screen (−22 px at 390
  in Chromium, −36 px in WebKit), and on release the circle jumps to the raw finger x (`landing` skips the
  clamp) and pops open half off screen.

#### Work items

- **M1/M2 (slice 30).** Put the composer over the transcript. Wrap transcript + form in one
  `relative flex-1` box; the form becomes `absolute inset-x-0 bottom-0` with a transparent background; the
  composer shell stays the only surface (keep its token, add `backdrop-filter` like the mockup). The
  transcript gets `padding-bottom: var(--mari-dock-h)`, set from one `ResizeObserver` on the form (the
  composer grows with attachments and chips). Replace the `[data-following]` rule with one always-on mask:
  `linear-gradient(to bottom, transparent 0, #000 2rem, #000 calc(100% - var(--mari-dock-h) - 2.5rem),
transparent calc(100% - var(--mari-dock-h) + 1.25rem))`; delete the `node.dataset.following` writes. Move
  the band out of the dock pseudo-elements into one `aria-hidden` sibling under the transcript (the faded
  edge shows it, no box); `html[data-marinara-effects-paused="true"]` / `reduceAmbientEffects` hides it.
  `.mari-jump-to-latest` stays anchored to the form. Same for the non-omnibar window (shared JSX).
  Proof: regression none (CSS); e2e at 390/1440, dark+light, working and idle: walk up from the composer
  and assert no ancestor below the panel paints an opaque background over the transcript area, assert the
  transcript's computed `mask-image` has both stops while scrolled up and while following; screenshots
  scrolled-mid next to `mock/run-scrolled.png`.
- **M4 (slice 31).** (1) Never collapse: clear the live timeline in the SAME synchronous block that applies
  the reloaded messages (give `loadMessages` an `onApplied` callback or return the list and set both
  states together), and render the live timeline while `workspaceTimeline.length > 0`, not while
  `workspaceTimelineActive`. (2) Question at the top once: after the local user message commits, scroll so
  its top sits 1 rem under the header, set the active turn's `min-height` to the transcript's visible
  height (clientHeight − dock), and start with following = false; following turns on only when the reader
  reaches the bottom (existing `isProfessorMariTranscriptNearBottom`). Drop `data-anchor="bottom"` once a
  conversation has a turn (keep it for the empty state). (3) Completion never scrolls. Put the decision in a
  pure helper in `lib/professor-mari-transcript-scroll.ts` (`transcriptScrollAction({ event:
"send"|"grow"|"complete"|"user-scroll", nearBottom, following })`) with asserts in
  `scripts/regressions/command-center.regression.ts`. Proof: e2e with the per-frame recorder (mock SSE via
  a `window.fetch` override in an init script; `page.route` cannot stream): at completion the scroll height
  never drops and `scrollTop` never decreases; a reader who scrolled up stays at the same text.
- **M3 (slice 32).** Append-only run: remove `layout` from step rows and the `y`/blur entrance (opacity
  only, 150 ms); keep `MariSmoothGrow` only if it no longer clips moving children, else delete it (the
  reserved turn height from slice 31 makes it unnecessary). One timeline per turn: the persisted turn keys
  its `MariWorkTimeline` by the run so the swap from live to persisted (slice 31) keeps the DOM; the live line
  and the "Worked for" line share `.mari-work-timeline__live` with the same `min-height` (4.75 rem). Render
  the review / resting-story slots inside the turn from the start (empty, no height) so they append in
  place. Proof: e2e samples every 100 ms the rects of all rows of the running turn: no two rows overlap,
  existing rows never move down, the question's top only moves up (by scrolling) or not at all; frame
  strip at 390 and 1440 next to the old `shots/390-dark-glowon-run-1[0-2].png`.
- **M8 (slice 33).** In the Mari pane the header is one row: Back, the destinations (Chats, Skills,
  Memories, What Mari sees + count), New chat, settings, Close. Remove the portrait, title and status
  there (`GlobalOmnibar.tsx` Mari header branch); status already lives in the live line and the `aria-live`
  status. Below 30 rem the destinations show icons + count, with labels in the existing ⋮ menu. Keep the
  search-mode header unchanged. Slice 15's "portrait flies to the header" lands on the arrival sprite (M9)
  instead; update `data-mari-pull-target="mari"`. Proof: screenshots 390/768/1440 dark+light; e2e that the
  header has no `.mari-workspace-portrait` in Mari mode and that every destination is reachable at 390.
- **M13 (slice 33b).** Rim stops use `var(--marinara-app-accent-solid)` (same opacities). Drop the edge
  clamp on `base` (keep `rx + 4`): the sheet keeps its width and the viewport clips it. One pure
  `pullOnScreenX(x, half, width)` in `lib/pull-to-open.ts` keeps the circle and the small bar 6 px in from
  the side and otherwise on the finger; `land` jumps `x` to the drawn circle first. Proof: regression
  asserts (constant sheet width as `cx` nears either side, circle on screen and on the finger); temporary
  e2e on mobile-chromium and mobile-webkit, pulls 0-40 px from each side, along the edge and diagonally,
  dark+light, three accents, before/after in `.tmp/omnibar-ux/round4/slice-33b/`.
- **M7 (slice 34).** Rename everywhere: "Context" → "What Mari sees" (header, panel, `en.json` keys
  `contextControlLabel`, `contextControlTitle`, `contextDestinationHint` get new semantic keys; old keys
  deleted). Composer: one removable chip per facet (`MariContextFacetChips` gets `onRemove(facet)`;
  removing one facet keeps the others), a small "Mari sees" label in front; a facet whose content leaves
  only on Send (chat text, error text, field values) is outlined with the tooltip "Name only now; the
  content goes when you send" — that makes R22 visible. Panel: three groups — "With your next message"
  (the chips), "Always in this Mari chat" (attached histories, + Attach), "How she works" (model with
  context use, sandbox; the trust strip moves here) — and one privacy line. Fix the phone overlay (drop
  `/45`, opaque canvas). Proof: e2e remove one facet → the sent request's `context` lacks only that facet;
  screenshots 390/1440 dark+light next to `mock/sees-*.png`; `pnpm localization:check`.
- **M6 (slice 35).** One panel language for Chats, Skills, Memories and What Mari sees: canvas colour, one
  hairline (`border-left` on desktop; full opaque sheet with Back on phone), one shared header (title,
  one-line hint, close), rows as direction A group rows (`.group`/`.row` from the v3 mockup; add one
  `.mari-side-*` CSS block, no new component framework — a small `MariSidePanelHeader` if it removes
  duplication across the four). Chats: Rename/Delete move to a row menu, multi-select stays; no pink
  buttons. Skills/Memories (`MariSkillsMenu`, `MariMemoriesMenu`): drop their own frames and shadows, keep
  behaviour. Proof: screenshots all four at 390/1440 dark+light next to `mock/chats-*.png`; keyboard: each
  panel's first control takes focus, Escape closes the panel before the omnibar (existing back logic).
- **M14 (slice 35b).** The done check and `settleTo` success story stay as they are (confirmed unchanged
  since before slice 32; no restoration needed — see the M14 root cause above). The plop: the step row's
  `motion.li` key becomes `${id}:${tool.status}`, so a status change (running → done/error) remounts just
  that row while an unrelated re-render (the live timer ticking, a sibling row updating) keeps the same
  key and replays nothing. `initial`/`animate` grow from `{opacity: 0, scale: 0.96, y: 4}` to `{opacity:
1, scale: 1, y: 0}` on a short spring (`visualDuration: 0.22`, `bounce: 0.25`) instead of the opacity-only
  150 ms fade — transform and opacity only, no `layout` prop, no height animation, so M3's no-jump
  guarantee holds. `prefers-reduced-motion` keeps `initial={false}` (no pop, instant). Proof: re-run M3's
  per-100ms frame-overlap/no-ghost-row check (still holds) plus new frames showing the pop on a new row and
  on a running→done transition, and the done check next to slice 35a's inline sprite on the "Worked for"
  line with no overlap.
- **M5a (slice 36).** A run reads top to bottom as: goal → phases → short lead → reference pills →
  outcome group → "Worked for" → next cards. Goal: the existing `latestUnderstoodRequest` record (#5740)
  shown as one muted "Goal" line (no model call). Phases: pure `groupRunPhases(items)` in
  `lib/mari-work-timeline.ts` buckets steps by verb class (reuse the `STEP_ICONS` patterns: read/search/list
  → "Looked at N things", edit/create/delete → "Changed N", errors → "N failed"); the running phase is
  open, finished phases fold to their one line. Outcome group: the applied review rows (slice 13), created
  tiles (I3) and decisions (install/sensitive/held changes) render as ONE group of hairline rows inside the
  turn, after the answer, with "What changed" and "Needs your OK" labels only when both exist. Reference
  pills: the existing `MariReferencedResources` (`.mari-ref-card`) move from under the prose to directly
  under the lead. Prompt (server, `workspace-agent.service.ts` reply-style block): lead with one or two
  sentences, no headings for short answers, "why" as at most three bullets — the client folds a trailing
  "Why" list into a one-line disclosure. Proof: regression asserts for `groupRunPhases`; e2e mocked run
  shows the order above; screenshots 390/1440 dark+light next to `mock/run-16000.png`.
- **M5b (slice 37).** Next-step cards replace the post-run chip row: the `suggestions` event renders as
  2-4 cards under the finished turn (icon, label, one fact line), not over the composer. Two kinds: Mari
  cards (spark mark) put the prompt in the composer as today; action cards (arrow) run an existing
  deterministic action at once — open the created resource, start a chat, open the connection picker,
  Peek prompt (reuse `executeStateNavigation` / the omnibar row actions; no new backend). Shared type:
  `MariSuggestionChip` gains optional `detail?: string` and `action?: OmnibarRowAction`-like discriminant;
  the server suggestion prompt asks for a short factual `detail`. Authorization accept/decline chips stay
  where they are (they are answers, not suggestions). Proof: regression on the shared parser accepting
  and bounding `detail`; e2e: clicking an action card navigates without a prompt request, a Mari card fills
  the composer; screenshots.
- **M10 (slice 38).** Found while reproducing: light-mode inline code is white on white (the markdown
  `code` background uses a dark-only token; see `shots/1440-light-glowon-scrolled-mid.png`); the glow band
  ignores Reduced ambient effects (M1); a stored trace whose tool output is not a string crashes the
  omnibar in `stdoutOf` (`lib/mari-referenced-resources.ts` ≈38, `output.indexOf`) — the server always
  stores strings, but `isWorkspaceTraceItem` (≈658) should reject non-string outputs instead of trusting
  disk data. Proof: screenshot light code; regression assert that a trace item with an object output is
  dropped.
- **M9 (slice 39).** Mari arrives with context, the same on every door (⌘K → Mari, pull right half, top-bar
  drag, Home "Ask Professor Mari"). When the pane opens with no handoff text, the empty state shows the
  arrival: one deterministic line + reference pills + 2-4 cards built on the client from
  `createOmnibarContext` (surface, `activeChat`, `openResource`, `settingsTarget`, `error`), the chat store
  and `lastAppError`. No model call until a card is clicked or the user types (R22; facts that would leave
  the device are shown as outlined chips). Pure builder `buildMariArrival(context, data)` in a new
  `lib/mari-arrival.ts` with asserts per surface:
  - chat: "You're in <chat> with <character>." · mode · message count · last reply; cards: Fix the last
    reply (only when the last reply's `finishReason` is `length` or it failed), Why didn't <entry> fire
    (only with an active lorebook; count from the K3 active-entries data), Summarize since last summary
    (count), Peek prompt (action);
  - agent editor: "This is <agent>, your <type> agent." · on for <chat> · last run; cards: the L2 fix
    (action when the fix is a picker, e.g. no connection), Why did it fail, Tighten its prompt (review),
    What do its settings do;
  - character / lorebook editor: the open field and dirty state; Improve <field> (L3 row), Check
    consistency, For lorebooks: entries that never fired;
  - settings: the open section; Explain this section, Find a setting, Undo last change (K5 Undo);
  - game setup (L8): the wizard step as label only.
    The current generic welcome stays only for Home with nothing open. The inline resting-Mari
    sprite for the empty/idle and finished states already exists as of slice 35a (`MariStorySprite`
    in the welcome and under the newest reply, also the slice 15 pull target): slice 39 builds the
    surface-aware arrival content (cards, reference pills, the deterministic line) around and near
    this existing sprite and does not duplicate the sprite mechanism. Desktop pull: **build it**
    (maintainer decision 2026-10-01, decision 2) — a mouse drag on the top bar: reuse the slice 15
    recognizer with `pointerType === "mouse"`, start only on empty bar space (never on a button),
    threshold 30 % like touch, same left/right split; the recognizer and the slime visuals already
    exist. ⌘K and the Mari button remain the primary desktop doors alongside it. Proof: regression asserts for `buildMariArrival` per surface
    (and that it reads no message text); e2e from a chat and from the agent editor: the arrival line and
    cards render with zero requests to `/professor-mari/*/prompt`; desktop drag opens Mari, a drag that
    starts on a top-bar button does not; screenshots next to `mock/chat-900.png`, `mock/agent-*.png`.
- **M17 (slice 39), the pull-drop morphs into the present Mari (maintainer feedback 2026-10-02).** "The
  Mari you pull down with the liquid thing should morph into the present Mari, wherever she is." Today
  (35a) the circle flies to the first `[data-mari-pull-target="mari"]` match and fades. Work: mark exactly
  one sprite `mari-current` (live-line sprite while a run is live, else the one beside the newest reply,
  else the arrival sprite); scroll it into view; the circle's head grows into its box (clip circle → box,
  size, position; transform/opacity/clip only, spring ~0.4 s, pure `pullMorphFrame` in
  `lib/pull-to-open.ts`), cross-fades to the sprite's own sheet frame, the real sprite shows under the
  identical morph before it fades; the arrival's line and cards wait until she has landed; reduced motion
  skips the flight. Proof: regression asserts for the morph frames; frame logs + screenshots on
  mobile-chromium and mobile-webkit for an empty chat, a chat with replies and a live run, landing on the
  right sprite each time.
- **M18 (slice 39), a desktop door with context (maintainer feedback 2026-10-02).** "On mobile we go from a
  chat to Mari with the pull; how on desktop, with context?" Work: `⌘J` / `Ctrl+J` "Ask Mari about this"
  opens Mari through the same arrival path as M9 (no model call until a card or typing), over any dialog
  (L8), and goes back to the search when Mari is open; listed in `keyboard-shortcuts.ts` (the **?** list)
  and the omnibar footer. Tab-to-Mari only if Tab is free in the omnibar (it is not: ghost completion and
  focus order). The desktop mouse drag of decision 2 ships here (empty bar space only, same threshold and
  halves). Proof: regression asserts for the shortcut matcher; e2e on desktop-chromium, -webkit and
  -firefox that Ctrl+J opens Mari with context from a chat, toggles back, works over a dialog and is
  taken from the browser (`preventDefault`); desktop drag right/left/from a button.
- **M11 (slice 40).** Reviewer pass over 30-39 (read-only findings, then a worker fixes the confirmed
  ones in the same slice): R22 on the arrival builder and the new facets, no write without a review, the
  scroll rule under real network latency, both themes, both visual themes (`default`, `sillytavern`),
  reduced motion, 44 px targets, `pnpm localization:check`, inventory and CHANGELOG. Judge every slice
  against the North star above (search + commands + Mari, in one obvious flow), not only against its own
  proof — a slice whose checks pass but that makes the flow less clear is a finding.

  **Known issues (not round-4, filed for later):**
  - `e2e/core-flows.e2e.ts` "Professor Mari visibly arrives on Home and navigates without AI" fails at
    the `marinara/professor` address assertion: the omnibar now opens Mari via `requestProfessorMariOpen()`
    instead of switching `activeTab` to `"professor"` (pre-round-4, from `6134a021b`/`48c60d016`); the
    unchanged test still expects the old tab route.
  - `e2e/expression-active-sprites.e2e.ts` asserts 1 active sprite but sees 2: the client keeps the
    previous active set after the server stores a new one (pre-round-4 `resolveLatestSpriteExpressionTurn`
    behaviour), unrelated to any round-4 commit.

- **M12 (slice 41), Fresh-eyes flow pass.** Reviewer profile, then a worker. The reviewer acts as a new
  user on the real running app at 390 and 1440, with no knowledge of the code or this plan, and does these
  jobs: find and reopen a chat; find a message; change a setting; run a command; ask a quick question; hand
  off to Mari and come back; fix a failed reply; pull to open on a phone. For each job it records every
  hesitation, dead end, unclear label or extra step, with a screenshot, judged against the North star
  (what to type, what Enter does, how to reach Mari and come back). Then a worker fixes the confirmed
  friction in small, safe changes (copy, affordance, a misrouted click) and lists anything bigger
  (navigation redesign, new surface) as open items for the maintainer rather than building it. Proof:
  the reviewer's findings list with screenshots in `.tmp/omnibar-ux/round4/slice-41/`; the worker's fix
  commit plus `heavy pnpm check`.

  **Open items for the maintainer** (bigger than this round's small fixes; recorded, not built):
  1. No visible door to search/Mari on desktop chat screens or on the phone — the desktop top bar has no
     search/Mari icon, and the phone's only doors are the pull (no on-screen hint) and a hidden Home
     long-press. Options: a desktop top-bar search pill, or a one-time "Pull down to search or ask Mari"
     hint under the phone bar on first run.
  2. A failed reply leaves no trace in the chat itself — no inline "Failed · Retry" under the user's
     message; after the 15 s toast ends there is no sign it failed except the omnibar's Fix row (which only
     helps users who already know ⌘K).
  3. No "New chat" command — "new chat" finds nothing that starts one; you must name a character ("start
     chat with …"). Home's Conversation/Roleplay/Game buttons have no omnibar counterpart.
  4. Toasts still cover the omnibar's search field (desktop and phone) — L8 keeps toasts above the omnibar
     for Undo, but error toasts now cover the field. Consider moving toasts to the bottom while the omnibar
     is open.
  5. Mari cards drafting vs. sending (b2) — after the slice 41 copy fix ("Drafts a message"), decide whether
     Mari cards should send at once instead (and the label would then say "Asks Mari" truthfully).
  6. D1 (slice 40) is still open; it needs a real-model session to judge honestly.
  7. Arrival + live error and R22 — on an arrival (⌘J, pull, Home button) with a live error, `focusResult`
     falls back to the Fix row, so the error rides along with any question typed after, not only on a
     deliberate ⌘↵ on the error row as K1 specifies; the arrival's "Fix the last reply" chip also duplicates
     the error chip. Suggested fix: treat the Fix row like the current-chat row in the arrival branch. Needs
     a maintainer or the slice 40 reviewer to confirm before a worker changes R22 semantics.

- **M15 (slice 38a), Mari images as small WebP (new maintainer request 2026-10-02, performance).** Root
  cause: `public/sprites/mari/` carried ~49 MB, nearly all of it full-resolution painted PNGs sized for
  print, not screen, plus a ~16 MB `generated/` folder of narrative sprite sheets from a cut feature that
  nothing ever loaded. Work: delete the ~16 MB of unreferenced `generated/` files (verified against both
  literal and template-string path construction, then against a built app's network tab) plus three more
  orphaned files found the same way; convert every remaining raster to WebP with `sharp` via a disposable
  script — the four appearance packs (pixel art) losslessly and at native resolution, everything else
  (root Home poses, profile, chibi, the memory wheel, the 6 used `generated/` files) resized to ~2x their
  actual rendered CSS size at quality 85. The painted onboarding/profile/FAQ poses get only this quick
  pass, nothing more: slice 38c replaces them with pixel art and deletes them outright. Proof: a build,
  an HTTP sweep of every referenced sprite URL plus the removed ones (200s and 404s as expected), and
  screenshots at 390/1440 in `.tmp/omnibar-ux/round4/slice-38a/` showing the pixel art stays unblurred and
  the resized poses still read fine; `heavy pnpm check`.

- **M16 (slice 38c), the selected Mari everywhere (maintainer-confirmed 2026-10-02, pixel poses approved).**
  Root cause: the appearance packs skinned only the omnibar portraits and stories; onboarding, the Home
  Professor tab, the Home Mari widget, the FAQ, the chibi toast and the "Help me navigate" Mari
  (`ProfessorMariNavigator`) hard-coded painted or Basic-only images, so a chosen pack stopped at the
  omnibar. Work: (A) nine pixel poses per pack (`wave`, `greet`, `point-up/-middle/-down`, `explaining`,
  `thinking`, `profile`, `chibi`; `MARI_POSES`, `pack.poses`) imported losslessly from `.tmp/mari-skins/`
  at native size as `public/sprites/mari/<pack>/pose-<pose>.webp` (the `pose-` prefix keeps them apart from
  the `thinking` story), prompts in `assets/imagegen/mari-<pack>/pose-prompts.json`; every hard-coded use
  reads the selected pack; the painted `Mari_*.webp` and `chibi-professor-mari.webp` are deleted. Basic's
  six portraits move from `generated/` into `basic/`. The server's character avatar path
  `/sprites/mari/Mari_profile.png` (stored in user data, missing since 38a) is back as the Basic pixel
  profile. (B) The pull/morph targets (`MariStorySprite`, the live-line sprite) are untouched. (C) Split:
  nothing is imported into the bundle; every URL lives in its own pack folder and carries
  `?v=MARI_SPRITE_VERSION`; a Workbox `CacheFirst` rule (`mari-sprites`, 120 entries, 30 days) keeps a
  used pack offline; `**/sprites/**` stays out of the precache; the pack chooser shows each pack's profile
  pose lazily, only while open. (D) `MARI_ASSET_TIER` next to the packs: tier 1 (profile, chibi: Home at
  first paint) starts from `main.tsx` at high priority; tier 2 (portraits idle/blink/shrug, the idle
  story) is prefetched by `GlobalOmnibarHost` after `load` at idle; tier 3 (other poses and stories, the
  previews) is `loading="lazy"`. Proof: regression asserts (per-pack folders, versions, tiers, files);
  e2e network log (selected pack only, tier timing, switch loads only the new pack, live switch); screenshots
  for 4 packs at 390/1440 and LCP before/after in `.tmp/omnibar-ux/round4/slice-38c/`.

Belongs in Pasta-Devs/Marinara-Agents, not here: agent-specific arrival cards that need package knowledge
(e.g. per-setting help for an agent); the Engine only shows names and states it already has.

### N. Round 5: open items from the slice 41 flow pass (slices 42-46) — maintainer decision 2026-10-03

Source: `.tmp/omnibar-ux/round4/slice-41/review.md` § "Open items for the maintainer". The maintainer approved
items 2-7 with the recommended option and declined item 1 for now (no new visible top-bar door; the pull and
the long-press stay the phone doors, ⌘K and ⌘J stay the desktop doors). The North star and every earlier house
rule apply. Find the real code paths first; reuse what exists.

- N1 (item 2) A failed reply leaves a trace: in normal chats (conversation, roleplay; check game mode and skip
  it if it has its own retry), the user message whose reply failed shows one quiet line under it: "Failed ·
  Retry" (plus the short reason on hover or tap). Retry runs the same regenerate path the existing Retry/
  Regenerate uses. The line goes away on the next successful reply or when the user edits or deletes the
  message. Client state only unless the failure is already stored; do not change chat storage. Keep the toast,
  but it may get shorter. Proof: e2e mocks a 500 from generate, the line shows, Retry succeeds and removes it;
  390/1440 dark+light.
- N2 (item 3) "new chat" works: omnibar commands "New conversation", "New roleplay" and "New game" that open
  the same start flows as the Home buttons (same modal/wizard, nothing new behind them). Typed "new chat" ranks
  "New conversation" first; "new rp"/"new roleplay" and "new game" match. Proof: regression asserts on ranking;
  e2e opens each flow from ⌘K.
- N3 (item 4) Toasts while the omnibar is open: sonner moves to the bottom (bottom-center on phones, bottom-right
  on desktop) while the omnibar is open, and back when it closes; it stays above the omnibar layer (Undo must
  stay visible). Proof: screenshots of an error toast with the omnibar open at 390/1440; the search field is
  never covered.
- N4 (item 5) Mari cards send at once: a spark (Mari) suggestion/next-step card sends its prompt immediately
  instead of drafting it into the composer; its visible kind label reads "Asks Mari". Action (arrow) cards stay
  as they are. Undo is not needed (sending is not a write; writes still go through review). Keep a way to edit
  first: if the user holds Shift (or long-presses on touch), it drafts instead. Proof: e2e both paths.
- N6 (item 7) Arrival + live error stays strict (R22): the arrival block may show that a reply/agent failed
  (local, names only), but the error TEXT is never put into Mari's context or prompt unless the user picks the
  deliberate "Fix" card/row. Check the slice 39/40 arrival and the N4 change: an arrival "Fix the last reply"
  card that now sends at once must send only after that deliberate pick, and its prompt may carry the error text
  only then. Regression assert on the arrival prompt payloads.
- N7 (new maintainer request 2026-10-03/04) Mari looks down on the pull: "The drop prototype had Professor
  Mari looking down on the pull at the active chat and things on screen. That was immersive." Reference: the
  armed face swap in `.tmp/omnibar-ux/drop/index.html` (`.face`, `[data-armed] .face`). Root cause: slice 15
  shows one fixed portrait in the circle. Work: a per-pack `pull-heads.webp` (six 96 px frames: neutral, down,
  down-left, down-right, peering, delighted; lossless, tier 2, versioned like 38c) in the circle, round-cropped
  in CSS. While pulled she looks at the screen's middle (pure `pullGazeFrame` in `lib/pull-to-open.ts`, 3
  buckets; `holdPullGaze` keeps a frame at least 150 ms). Armed: peering, or delighted when there is context.
  Context and the armed label ("Release · Zylo's chat", "fix that reply", "Illustrator settings") come from
  the slice 39 arrival (`buildMariArrival` + new `mariPullAbout`, one shared `resolveOmnibarScreen`), names
  only (R22). Reduce ambient effects freezes the gaze, the label stays live. Pull-time only; the M17 morph is
  unchanged. Proof: regression asserts; frame sequences on mobile-chromium and mobile-webkit, dark+light, over
  a chat, an editor and Home in `.tmp/omnibar-ux/round4/slice-45b/`.
- N5 Review of 42-45 (reviewer read-only findings, then a worker fixes the confirmed ones). Plan-mode reviewer
  children end on ExitPlanMode: the orchestrator must check `list_pending_permissions` and answer it.
- Item 6 (D1 with a real model) is the maintainer's own manual test after the next deploy; nothing to build.

### O. Round 6: make the added value measurable and larger (slices 47-51) — maintainer decision 2026-10-04

Question from the maintainer: what is the omnibar's real added value compared with having no omnibar? Answer: it
is worth it only where it is faster or easier than the normal app. This round measures that and grows the parts a
normal menu cannot do. North star applies. Nothing leaves the device (no telemetry).

- O1 Value table (slice 47, reviewer on the real app, no code). Pick 15 common tasks across the jobs in the
  strategy report (reopen last chat, find a message in another chat, change model in this chat, attach a
  lorebook, flip a deep setting, find a lorebook entry, start a new roleplay, fix a failed reply, ask how X works,
  open a character, change persona, peek prompt, search docs, switch theme, open an agent's settings). For each,
  count steps (clicks/keys/scrolls) and note "must know where it lives" WITHOUT the omnibar and WITH it, at 1440
  and 390, on a seeded instance. Write `docs/development/omnibar-value-table.md` (task, steps without, steps with,
  winner, note, screenshots in .tmp/omnibar-ux/round6/slice-47/). List every task where the omnibar is not
  clearly faster (≥2 steps fewer or no "know where" needed) as an O4 item with a concrete fix or a removal.
- O2 Local frecency (slice 48). Count which omnibar results the user runs (result id + surface + timestamp) in
  localStorage, capped (e.g. 300 entries, decay by age). Blend a frecency boost into ranking (never above an exact
  name match; never moves Mari's row). Empty-state on a surface: the top 3-5 rows are the user's most frecent
  actions on that surface (chat, editor, Home), then recents. A "Clear search history" control in the omnibar
  settings. Proof: regression asserts on the score function (recency decay, cap, exact-match wins), e2e that a
  used row rises.
- O3 Synonyms (slice 49). Add a small `keywords` array to settings-registry controls and to command definitions
  (plain data), e.g. "bigger text / font size / zoom", "dark / night", "streaming / typing effect", "nsfw /
  content filter", "tokens / context length". Search matches keywords with a lower weight than the label. Cover
  the 40 most-used settings and all commands. Proof: regression asserts for 20 phrase → result pairs.
- O4 Fix or remove (slice 50): the O1 items. Removal beats a new feature. Update the inventory and CHANGELOG.
- O5 Review (slice 51): reviewer read-only findings + a 5-task fresh-eyes check on the value table's weakest
  tasks, then a worker fixes the confirmed ones. Plan-mode children end on ExitPlanMode: answer it via
  list_pending_permissions.

### P. Round 7: Mari presence polish (slices 52-55) — maintainer feedback 2026-10-05

Follow `mari-ui-subtle-effects`: glows are low, faint and soft; nothing loud. Screenshot the current state first.

- P1 (slice 52) Glow trapped in a box: in the omnibar, the place in the top row where Mari is shown while she works
  (her portrait/button with the turning glow behind it) clips the glow to a rectangle. Find the clipping ancestor
  (overflow hidden, contain, a mask or a stacking context) and let the glow fade out softly with no visible box
  edge, at 390 and 1440, dark and light.
- P2 (slice 52) Top-bar edge glow: while Mari works, and after she finishes, the BOTTOM EDGE of the app top bar
  glows: a soft, thin line (about 1-2 px core with a short soft fade, never a thick band), in her state colour
  (working = her working colour, wavering slowly; finished = green, steady and faint; needs approval = gold; error
  = red). It is visible from anywhere in the app, so the user knows Mari is busy or done without the floating
  button. Reduced motion / reduce ambient effects: static, no wavering.
- P3 (slice 52) Seen clears it: the "finished" (and the error/approval) edge glow goes away as soon as the user
  opens Mari's window (the omnibar Mari pane or her workspace) and sees the result. A new run starts the working
  glow again. Pure state (unseen result → glow) with a regression assert.
- P4 (slice 53) No small Mari bottom right in normal use: the floating Mari button/presence in the bottom-right
  corner (MariPresenceIndicator or the floating button in AppShell) does not show at rest. Decide by the North star
  whether it shows at all while she works; the P2 edge glow now carries "she is busy/done", so default: remove it in
  normal operation entirely, and keep only what a feature needs (e.g. Mini Mari surprise visits if that setting is
  on). Check every caller; update the inventory and settings text.
- P5 (slice 54) Home page Mari widget looks bad: the Home Mari widget (slice 38c made it show the pack chibi) must
  look good. Screenshot it at 390/768/1440 dark and light in all four packs, find what is wrong (size, scaling,
  crop, alignment, blurry or non-integer pixel scaling, background, spacing), and redesign it in the Home module
  style (see `mockups-match-real-app`). Use a better pose from the pack (wave, greet, explaining, or a portrait) if
  the chibi is the wrong asset, at an integer pixel scale. If new art is truly needed, write the exact request into
  the plan for the Image Creator instead of inventing art.
- P6 (slice 55) Review of 52-54, then a worker fixes the confirmed findings.


### Q. Round 8: Mari header, omnibar settings, packs grid, deslopped text (slices 56-59) — maintainer feedback 2026-10-05

- Q1 (slice 56) Professor Mari header buttons. Today the ⋮ overflow menu repeats items that are already in the bar,
  and "Chats" sits on the opposite side from New chat (+). Fix: the ⋮ menu holds ONLY actions that are not in the
  bar (on narrow screens it may also hold the destinations that do not fit, and nothing else). Put Chats directly
  next to New chat (+): one group "Chats · +". Keep the two-line header (35a), Mari inline (no portrait). Check
  390/768/1440, keyboard order, labels.
- Q2 (slice 57) Redesign the omnibar settings page, and make it the home of all Mari and omnibar settings. Move
  the Professor Mari settings that today live in the app's main Settings (suggestions, permissions-mode default,
  quick-answer model and delay, Mini Mari visits, appearance pack, and the like; find them all) into the omnibar
  settings. In main Settings leave one row "Omnibar & Professor Mari settings → Open" that opens them, so nothing
  is lost. The settings registry and the omnibar search must still find every moved control (anchors updated).
  Group the page in clear sections (Search, Quick answers, Professor Mari, Appearance) in the Home/omnibar style,
  not a long list. The appearance packs become a GRID of cards (pack profile pose, name, one line), selected
  state clear, keyboard and screen-reader friendly, lazy previews (38c tiers).
- Q5 (slice 57b) Maintainer feedback after Q1/Q2 landed, 2026-10-05. (a) Move the "Chats · +" group from slice 56
  to the RIGHT side of the Professor Mari header row, next to settings/close — not the left. (b) Look again at the
  chat cards: screenshot every card type in Mari's chat at 390/1440, dark and light, in a real conversation —
  reference cards (characters, agents, chats, lorebook entries, settings), the outcome group, the next-step cards,
  the arrival cards, and the cards in her Chats panel. Judge them against the North star and the mari-v4 mockup:
  size, density, alignment, consistent anatomy (icon/portrait · name · one fact · action), no visual noise. Fix
  what is off. Before/after screenshots in the slice's scratch folder.
- Q3 (slice 58) De-slop every user-facing text of and in the omnibar and Professor Mari. Use the deslop skill in
  `.tmp/deslop/repo/` (SKILL.md plus references/phrases.md, tropes.md, structures.md) together with the
  better-writing rules: short, direct, plain words, no filler, no false agency, no cute padding, consistent names
  (one name per thing), sentence case. Scope: the en.json keys used by the omnibar, the Mari pane/workspace, the
  pull, the arrival lines/cards, the omnibar settings, toasts and empty states from these surfaces, and the
  CHANGELOG lines of rounds 1-8 if they read as slop. Keep the meaning and the keys; edit English only (community
  locales fall back). Do not change model prompts or user content. Produce a before/after list in the plan. Run
  `heavy pnpm localization:check`. Maintainer feedback, 2026-10-05: rename "What Mari sees" to "Aware of"
  everywhere (the facet-chip header, e.g. "Aware of · Zylo's chat · Description field") — tooltips,
  screen-reader text, the omnibar settings, docs and the inventory; semantic en.json keys, remove the old ones.
  This slice also owns the naming conflict slice 57 flagged ("omnibar" vs "search" in new UI copy) — pick one
  name and apply it consistently in anything this slice touches.
- Q6 (slice 58b) Maintainer feedback, 2026-10-05: "Type icons everywhere, and context for recent chats." In the
  omnibar result rows, the expanded rows, Mari's reference and next-step cards, the arrival cards, the "Aware of"
  chips and Mari's Chats panel, every item must show WHAT it is at a glance. (1) Each kind gets one consistent
  type icon (reuse the existing lucide icons the app already uses for each kind in its panels): chat (with mode:
  conversation / roleplay / game), character, persona, lorebook, lorebook entry, preset, agent, setting, command,
  doc, message, connection. (2) Items with an avatar or portrait (characters, chats, personas, agents) keep the
  avatar and get a small type badge in a corner (e.g. a chat bubble on a chat's avatar, a book on a lorebook
  cover). Items without an avatar show the type icon in the same slot, so the layout stays aligned. (3) Recent
  chats need context: participant avatars (stacked, at most 3), the chat mode, the last speaker plus a short
  snippet of the last message (1 line), the relative time, and the attached-lorebook count if there is one. All
  on two lines at most, no heavier than today on the phone. Keep it calm (`mari-ui-subtle-effects`): small
  badges, muted colours, no new chrome. One shared `ResultTypeIcon`/badge component, not a copy per surface.
  Proof: screenshots of the empty omnibar (Recent), a mixed search ("ne": chats, characters, lorebooks, entries,
  settings, docs), Mari cards and the Chats panel, at 390/1440, dark and light.
- Q4 (slice 59) Review of 56-58, 57b and 58b, then a worker fixes the confirmed findings.

#### Q3 before/after (slice 58)

Key · old → new. `homeprofessormarichat.whatMariSees*` keys became `awareOf*`; rows with the same text only changed the key.

- `omnibar.aside.disclosure`: "Professor Mari answered this because nothing matched what you typed." → "No results matched, so Professor Mari answered."
- `omnibar.aside.needsModel`: "Professor Mari can answer searches like this once she has a model." → "Choose a model so Professor Mari can answer searches like this."
- `omnibar.askMari.peek.change`: "Mari will help you change this." → "Mari helps you change this."
- `omnibar.askMari.peek.create`: "Mari will help you create this." → "Mari helps you create this."
- `omnibar.askMari.peek.explain`: "Mari will explain this and guide your next step." → "Mari explains this and suggests a next step."
- `omnibar.askMari.peek.recommend`: "Mari will compare the options and recommend one." → "Mari compares the options and recommends one."
- `omnibar.askMari.peek.repair`: "Mari will help troubleshoot and fix this." → "Mari finds the problem and helps you fix it."
- `omnibar.greetings.chat.one`: "Oh, a chat. What should we look into?" → "What should we look into in this chat?"
- `omnibar.greetings.conversation.one`: "A conversation. What should we look into?" → "What should we look into in this conversation?"
- `omnibar.greetings.conversation.two`: "I found your chat. What do you need?" → "Your conversation is open. What do you need?"
- `omnibar.greetings.roleplay.one`: "A roleplay chat. What should we look into?" → "What should we look into in this roleplay?"
- `omnibar.greetings.roleplay.two`: "Oh, a scene in progress. Need a hand?" → "A scene is in progress. What do you need?"
- `omnibar.hello`: "Hi, I'm Mari. Type to search, or ask me for anything..." → "Hi, I'm Mari. Type to search, or ask me anything."
- `omnibar.settings.appearance.description`: "One look for Mari everywhere: her workspace, search, Home and the top bar." → "How Mari looks in her workspace, Search, Home and the top bar."
- `omnibar.settings.aside.connection.description`: "Your search text is sent to this model, never your memories or the field you are editing." → "Quick answers send only your search text to this model, not your memories or the field you are editing."
- `omnibar.settings.aside.delay.description`: "How long you stop typing before Mari answers." → "How long Mari waits after you stop typing."
- `omnibar.settings.aside.description`: "Answer a search that finds nothing." → "Mari answers when a search finds nothing."
- `omnibar.settings.aside.localMissingNote`: "No local model is downloaded yet, so quick answers stay silent. Download one, or choose a connection." → "No local model is downloaded, so quick answers are off. Download one or choose a connection."
- `omnibar.settings.label`: "Omnibar & Professor Mari settings" → "Search and Professor Mari settings"
- `omnibar.settings.mari.label`: "Ask Mari from search" → "Ask Mari from Search"
- `omnibar.settings.mari.description`: "Ask Mari from the search field, the pull-down and Ctrl/Command+J." → "Ask Mari from the Search field, the pull-down and Ctrl/Command+J."
- `omnibar.settings.suggestions.description`: "Offer context and edits before you ask." → "Mari offers context and edits before you ask."
- `mari.animationPacks.core.description`: "Mari's everyday desk work — reading, writing, tinkering, thinking." → "Mari at her desk: reading, writing and thinking."
- `mari.animationPacks.expeditions.description`: "Trips, dives and launches, for the long-running jobs." → "Trips, dives and launches for long jobs."
- `mari.appearancePacks.basic.description`: "Mari's familiar pixel look, with a little story for every state." → "Mari's pixel look, with a short scene for each state."
- `mari.appearancePacks.dottore.description`: "A cyan heart pin, a Dottore plush and little fangirl stories." → "A cyan heart pin, a Dottore plush and fangirl scenes."
- `mari.appearancePacks.golden.description`: "Shiny gold and a larger-than-life Chad expression." → "Gold colours and a Chad expression."
- `mari.appearancePacks.safari.description`: "Safari gear and little jungle expeditions." → "Safari gear and jungle expeditions."
- `mari.errors.beforeAnswer`: "The request failed before Professor Mari could answer. This message will stay visible long enough to screenshot for troubleshooting." → "The request failed before Professor Mari could answer. This message stays open so you can take a screenshot."
- `mari.errors.withDetails`: "{{message}} This message will stay visible long enough to screenshot for troubleshooting." → "{{message}} This message stays open so you can take a screenshot."
- `mari.stories.cancelled`: "Stopped. Ready when you are." → "Stopped."
- `mari.stories.retry`: "That attempt ran into trouble. Ready to try again." → "That attempt failed. You can try again."
- `mari.workCard.phrases.veryLong.p3`: "Almost there, I promise" → "Still cooking"
- `mari.workCard.phrases.veryLong.p4`: "Still stirring, don't worry" → "Still stirring"
- `commandCenter.approval.decide`: "Mari is waiting on you" → "Mari needs your answer"
- `commandCenter.empty.description`: "Try a chat, character, setting, or message. Use the category shortcuts above to browse." → "Type a chat, character, setting or message. Pick a category above to browse."
- `commandCenter.placeholder`: "Search everything — or narrow with faq:, docs:, msg:, char:" → "Search everything, or narrow with faq:, docs:, msg:, char:"
- `commandCenter.messages.seeAllDescription`: "Opens Search All Chats, with filters." → "Opens Search all chats with filters."
- `commandCenter.newChat.conversationDescription`: "Opens the same new-chat flow as Home’s Conversation button." → "Same as Conversation on Home."
- `commandCenter.newChat.gameDescription`: "Opens the same new-chat flow as Home’s Game button." → "Same as Game on Home."
- `commandCenter.newChat.roleplayDescription`: "Opens the same new-chat flow as Home’s Roleplay button." → "Same as Roleplay on Home."
- `commandCenter.shortcuts.startChatDescription`: "Choose the mode, then the chat opens." → "Pick a mode to open the chat."
- `commandCenter.suggestions.editFocusedFieldDescription`: "Ask Mari to suggest a useful change for the selected field." → "Mari suggests a change to the selected field."
- `…marichat.awaitingApprovalHint`: "Mari is waiting for your approval - nothing has been changed yet. Accept to apply, or reply with what to change." → "Mari needs your OK. Nothing has changed yet. Accept to apply, or reply with what to change."
- `…marichat.couldNotChangeThePermissionsMode`: "Could not change the Permissions Mode." → "Could not change the permissions mode."
- `…marichat.permissionsMode`: "Permissions Mode" → "Permissions mode"
- `…marichat.permissionsModeForThisChat`: "Permissions Mode (this chat)" → "Permissions mode (this chat)"
- `…marichat.deleteMessage`: "Delete Message" → "Delete message"
- `…marichat.editMessage`: "Edit Message" → "Edit message"
- `…marichat.regenerateResponse`: "Regenerate Response" → "Regenerate response"
- `…marichat.removeAttachment`: "Remove Attachment" → "Remove attachment"
- `…marichat.deleteMessageConfirmation`: "Are you sure you want to delete this message? This cannot be undone." → "Delete this message? This cannot be undone."
- `…marichat.regenerateResponseConfirmation`: "Are you sure you want to regenerate this response? This cannot be undone." → "Regenerate this response? This cannot be undone."
- `…marichat.removeAttachmentConfirmation`: "Are you sure you want to remove this attachment? This cannot be undone." → "Remove this attachment? This cannot be undone."
- `…marichat.detailsEmpty`: "Completed results and resource details will appear here." → "Results and resource details show here."
- `…marichat.emptyWelcomeDescription`: "I can inspect your setup, explain how something works, or make a reversible change." → "I can check your setup, explain a feature, or make a change you can undo."
- `…marichat.suggestions.start`: "What should we work on? I can inspect your setup, explain how something works, or make a reversible change." → "What should we work on? I can check your setup, explain a feature, or make a change you can undo."
- `…marichat.professorMariMemoriesAreUnavailable`: "Professor Mari memories are unavailable." → "Professor Mari's memories are unavailable."
- `…marichat.professorMariSkillsAreUnavailable`: "Professor Mari skills are unavailable." → "Professor Mari's skills are unavailable."
- `…marichat.selectAConnectionFirst`: "Select a connection first by clicking the chainlink icon in the input box below!" → "Select a connection first. Use the link icon in the message box below."
- `…marichat.theModelOrServerMayStillBeBusyThis`: "The model or server may still be busy. This message stays visible long enough to screenshot." → "The model or server may still be busy. This message stays open so you can take a screenshot."
- `…marichat.thinkingUpSuggestions`: "Thinking up suggestions..." → "Finding suggestions..."
- `home.professorMari.chats`: "Professor Mari Chats" → "Professor Mari chats"
- `home.professorMari.newChat`: "New chat - the current Professor Mari conversation is saved to Chats" → "New chat · the current chat is saved in Chats"
- `settings.controls.miniMari.help`: "Allow rare Chibi Professor Mari messages while scrolling." → "Chibi Professor Mari sometimes appears with a message while you scroll."
- `settings.controls.omnibarSettings.help`: "Search, quick answers, Professor Mari and her appearance have their own settings page. Open takes you there." → "Settings for Search, quick answers, Professor Mari and her appearance are on their own page."
- `settings.controls.omnibarSettings.label`: "Omnibar & Professor Mari settings" → "Search and Professor Mari settings"
- `settings.controls.mariPermissionsMode.manual.description`: "Always ask before making changes: Mari describes first and stages only after you say go." → "Mari describes each change first and stages it only after you say go."
- `settings.controls.mariPermissionsMode.plan.description`: "Mari never changes anything: she lays out the exact changes she would make, in chat." → "Mari changes nothing. She lists the exact changes she would make, in chat."
- `shortcuts.general.askMari`: "Ask Mari about this screen, or go back to the search" → "Ask Mari about this screen, or go back to Search"
- `ui.chat.mariediteasyviewer.notVectorizedHint`: "Can be found by meaning once it's vectorized, which hasn't happened yet." → "Not vectorized yet, so search by meaning cannot find it."
- `ui.chat.mariediteasyviewer.rejectHint`: "Revert just this entry. The rest of the change stays applied." → "Revert only this entry. The rest of the change stays applied."
- `ui.chat.maripromptpreviewmodal.explainer`: "A synthetic preview assembled on its own, without a persona or chat history. Added text is green, removed text is red." → "A preview built without a persona or chat history. Added text is green, removed text is red."
- `ui.chat.databaseworkspaceapprovalcard.keepAndEnable`: "Keep & Enable" → "Keep and enable"
- `ui.chat.professormarimemoriesmenu.professorMariMemories`: "Professor Mari Memories" → "Professor Mari memories"
- `ui.chat.professormariskillsmenu.professorMariSkills`: "Professor Mari Skills" → "Professor Mari skills"
- `omnibar.settings.suggestions.label`: "Proactive suggestions" → "Context suggestions"
- `commandCenter.controls.mariAssist`: "Professor Mari assistance" → "Ask Mari from Search"
- `…marichat.whatMariSees → awareOf`: "What Mari sees" → "Aware of"
- `…marichat.whatMariSeesAlways → awareOfAlways`: (text kept)
- `…marichat.whatMariSeesAttach → awareOfAttach`: (text kept)
- `…marichat.whatMariSeesBack → awareOfBack`: "Back to What Mari sees" → "Back to Aware of"
- `…marichat.whatMariSeesChangeModel → awareOfChangeModel`: (text kept)
- `…marichat.whatMariSeesChipsLabel → awareOfChipsLabel`: "Mari sees" → "Aware of"
- `…marichat.whatMariSeesClose → awareOfClose`: "Close What Mari sees" → "Close Aware of"
- `…marichat.whatMariSeesContextUse → awareOfContextUse`: (text kept)
- `…marichat.whatMariSeesFacetLaterTitle → awareOfFacetLaterTitle`: "{{label}}: {{text}}. Name only now; the content goes when you send." → "{{label}}: {{text}}. Name only for now. The content goes when you send."
- `…marichat.whatMariSeesFocusMeta → awareOfFocusMeta`: (text kept)
- `…marichat.whatMariSeesGoesNext → awareOfGoesNext`: (text kept)
- `…marichat.whatMariSeesHint → awareOfHint`: (text kept)
- `…marichat.whatMariSeesHowSheWorks → awareOfHowSheWorks`: (text kept)
- `…marichat.whatMariSeesModelMeta → awareOfModelMeta`: (text kept)
- `…marichat.whatMariSeesNameOnly → awareOfNameOnly`: "Name only now · the content goes when you send" → "Name only for now · the content goes when you send"
- `…marichat.whatMariSeesNextEmpty → awareOfNextEmpty`: "Nothing extra. She sees what you type." → "Nothing extra. Mari reads only what you type."
- `…marichat.whatMariSeesNextMessage → awareOfNextMessage`: (text kept)
- `…marichat.whatMariSeesOpen → awareOfOpen`: "Show what Mari sees" → "Show what Mari is aware of"
- `…marichat.whatMariSeesPrivacy → awareOfPrivacy`: "Nothing here reaches the model until you press Send. Quick answers in search only see what you type and the name of the open screen." → "Nothing here goes to the model until you press Send. Quick answers in Search get only what you type and the name of the open screen."
- `…marichat.whatMariSeesRemoveFacet → awareOfRemoveFacet`: (text kept)
- `…marichat.whatMariSeesSandboxOff → awareOfSandboxOff`: (text kept)
- `…marichat.whatMariSeesSandboxOn → awareOfSandboxOn`: (text kept)
- Code-only labels (`settings-registry.ts`): "Ask Mari from search" → "Ask Mari from Search", "Professor Mari Permissions Mode" → "Professor Mari permissions mode", "Proactive suggestions" → "Context suggestions" (one name for the `omnibarSuggestionsEnabled` toggle).

### R. Round 9: from door to diagnosis (slices 60-65) — maintainer decision 2026-10-05

Source: `.tmp/omnibar-ux/strategy-report-2.md` (read it; re-check every "S:" line, they drift). Thesis accepted:
the omnibar is the index for buried things and the inbox for "something broke"; it stops competing with visible
one-click buttons. Mari is the diagnostician and setup engineer: she reads the user's own facts, names one cause
with a number, and proposes one reviewed fix. Deterministic first, no model and no cost for checks; Mari only
after Enter/⌘↵ (R22); her reads return numbers and names, never chat text. A slice is worth it only if a new
value-table task (T16-T20 in the strategy report §7) moves. Decisions: the maintainer declined the
`api_connections` raw-db guard for now (do not build it); "Connect a model" card WITH the local-server probe;
a cut-off/trimmed reply DOES get a quiet line in the chat. Lorebook batch review stays undecided (out of scope).

- R1 (slice 60) Record what was cut (server). `fitMessagesForModelAccess` returns its fit result; the generate
  route saves `generationInfo.contextFit = { trimmed, droppedHistory, tokensBefore, tokensAfter, inputBudget,
  replyBudgetFrom, replyBudgetTo }` (history drops only); same for the dry run. Proof: regression asserts.
- R2 (slice 61) Reply checkup, no model. Pure `diagnoseReply` in `shared/src/utils/` with codes
  `history_trimmed`, `reply_budget_cut`, `cut_off`, `empty_reply`, `lore_budget_skipped`, `card_large`, each with
  a link to the exact setting. Doors: (1) a quiet line under the affected reply, like "Failed · Retry", e.g. "Cut
  off · Check" / "42 older messages not sent · Check" (maintainer approved); (2) the omnibar "Fix" row on a chat;
  (3) the Peek modal header. Delete the separate "Preview next prompt" row; the checkup links to Peek. Proof: one
  regression fixture per code; e2e 390/1440 with a seeded trimmed and a cut-off reply.
- R3 (slice 62) Mari reads the checkup: read `chat.diagnose { chatId, messageId? }` → findings, generationInfo
  numbers, attached lorebook names/budgets, preset name and sampler keys, card token share (character token
  estimator). No message text. Prompt block: on "worse / forgets / cut off / empty / does not act like the card",
  call it first, name one cause with the number, offer one reviewed fix she already has (preset maxTokens,
  character.update, lorebook.updateEntry) or a deep link to the Chat Settings section. Proof: regression that the
  payload has no message content; e2e with a mocked answer.
- R4 (slice 63) **DROPPED, maintainer decision 2026-10-06.** The maintainer will soon change how Engine
  connections are set up, so round 9 must not touch connection setup at all: no changes to `ConnectionEditor`,
  `TestResultCard`, `connections.routes`, the first-run Home card, or the tour's Connections step. Original scope
  (not built): test failures return `{ code, advice, detail }` for 401/403, 404, HTML body (missing /v1),
  ECONNREFUSED/timeout, no model; `TestResultCard` shows the advice + one docs link, raw detail behind "Details";
  the no-connection send error gets an "Open Connections" action.
- R5 (slice 64) **DROPPED, maintainer decision 2026-10-06.** Same reason as R4 — no connection-setup work this
  round. Original scope (not built): a "Connect a model" card on Home when no language connection exists: "I
  have an API key" (chat providers only, OpenRouter first), "I run a local server" (server probes localhost
  11434/1234/5001 `/v1/models`, short timeout, localhost only; in Docker say so and ask for a URL), "Sign in with
  a subscription" (LOCAL_AUTH_PROVIDERS); reuses the editor fields and the test routes; failures use the R4
  doctor; on success "Start a roleplay" and "Ask Mari to make a character"; the tour's Connections step points at
  the card.
- R6 (slice 65) Cut and re-measure (reviewer, then worker). Remove the model/preset/persona duplicates from the
  EMPTY omnibar list (keep them reachable by typing); never promote Ask Mari above docs rows when no model is
  set; re-run the 15 old tasks plus T18-T20 only (T16/T17 were the connection-setup tasks measured by the now-
  dropped R4/R5 — skip them); update the value table, inventory and CHANGELOG; fix confirmed review findings.
- R9 (slice 62a, worker, after 62, priority bug) Clicking the omnibar row "Mari needs your answer" does not
  navigate. The row (`lib/omnibar-results.ts` ≈1600-1650, category `professor`, score 480, group "continue")
  carries a `choice` control (Keep/Restore) with no selected value, so a click or Enter on the row body does
  nothing. Fix: click or Enter on the row opens the omnibar's Mari pane and scrolls to THAT pending review card,
  focused and briefly highlighted — use the existing `mariPendingReviewRequest` path (`GlobalOmnibar.tsx` ≈493,
  ≈2869, ≈2920 → `OmnibarMariPane`'s `pendingReviewRequest`), targeting the specific approval id, not just "any
  pending review". The inline Keep/Restore choice may stay as a quick action, but the row itself must navigate.
  If the review belongs to a different Mari thread or chat, open that thread (compatible with R7 below). The same
  rule applies to the "Mari is working" row: click it to go to her live run. Proof: e2e with a mocked pending
  review — click the row → the Mari pane opens with the card in view and focused; Enter does the same; Keep/
  Restore inline still works; a regression assert for the row's action at 390 and 1440.
  Also in this slice: (1) a CHANGELOG line for the maintainer's own already-shipped fix (`6bf8bf780`, "Mari's
  memories open collapsed instead of auto-expanding the first one") — no code change needed, just the entry.
  (2) Remove the pin shortcut and its UI entirely — there is a Cmd/Ctrl+P shortcut and hint but no visible way to
  pin or unpin anything, so cut the dead feature rather than leave an orphaned hint: the Cmd/Ctrl+P handler and
  `togglePinned` in `GlobalOmnibar.tsx` (≈2100, ≈2584); the footer hint `commandCenter.keyboard.pin` (≈3781); the
  shortcut entry in `lib/keyboard-shortcuts.ts:35-36` plus `shortcuts.general.omnibarPin`; the "pinned" group, its
  icon branch, `commandCenter.groups.pinned` / `commandCenter.context.pinned`; `pinnedResultIds` in
  `omnibar-search.ts` (≈164, ≈249, ≈463); `setCommandPinned` / `MAX_PINNED_COMMANDS` in `command-center.ts`.
  `normalizeCommandRankingState` must ignore any old stored `pinnedIds` so no stale "Pinned" group can appear from
  existing user data. Update the regression asserts in `command-center.regression.ts` (≈13, ≈175-187), the
  inventory, the shortcut docs and the CHANGELOG. Run `heavy pnpm check` and the regression.
- R7 (slice 62b, designer, after 62a) One Mari thread per context (maintainer decision 2026-10-05, option C).
  Each Mari conversation carries a context key (chat id, agent type, editor resource, or "general" for Home and
  no context). Opening Mari through an arrival door (⌘J, pull, drag, Home "Ask", the Fix/Check rows) continues the
  newest thread with the same context key, or creates one; the arrival block (slice 39/40) shows in it. If the
  user was in a DIFFERENT Mari thread within the last ~30 minutes, the arrival block offers two buttons:
  "Continue there" and "New about <context>". "+" still starts a fresh thread. The Chats panel lists threads with
  their context label and time ("Zylo's chat · 2 days ago"), grouped or filterable by context. Existing threads
  without a key count as "general". Reuse `ensureProfessorMariChat` and the existing chat metadata; no new storage
  format if a metadata field suffices. Proof: regression on the thread-choice function (same key, different key,
  recent other thread, no key); e2e ⌘J from two chats lands in two threads, and back in the first one; 390/1440.
- R8 (slice 62c, designer, after 62b) Two small pull-system fixes, maintainer feedback 2026-10-05/06.
  (1) The pull drop's rim should share the top bar's current state colour. When the top-bar bottom edge glows
  (slice 52: the working colour while it pulses, green when done, gold for approval, red for an error), the pull
  sheet's rim and shimmer (`OmnibarPullDrop`, slice 33b set it to the accent) must use that SAME current state
  colour, including the slow pulse while she works. When the bar has no state glow, they keep the accent. The
  sheet body keeps the top-bar surface. Reduced motion: no pulse. Use one shared source for the state colour (the
  same CSS variables or state hook the edge glow itself uses) — not a second copy that can drift. Proof: frame
  screenshots of a pull while Mari works, after she is done, and at rest, on mobile-chromium, dark and light.
  (2) Desktop mouse-drag text-selection bug (slice 39): dragging the top bar selects all page text. Fix in the
  shared pull recognizer (`use-pull-to-open-omnibar.ts`): once a mouse drag is recognized as a pull (after the
  direction lock), clear the current selection and block text selection for the whole drag — a class on `<html>`
  setting `user-select: none` (and `-webkit-user-select`), or `preventDefault` on `pointermove`/`selectstart`
  while the drag is active; remove the block on release or cancel. Must not block a normal click on bar buttons,
  and must not block text selection anywhere when no drag is active. Proof: e2e on desktop-chromium — drag the
  top bar 200px and assert `window.getSelection().toString() === ""` during and after the drag; a bar-button
  click still works; selecting text in a chat message still works after the drag.
- R10 (slice 62d, designer) Mari cards v5 — maintainer-approved card system, 2026-10-06. Mockup:
  `.tmp/omnibar-ux/cards-v5/index.html`; exact tokens, anatomy, states and code locations:
  `.tmp/omnibar-ux/cards-v5/spec.md` (sections 1-8). Implement exactly: one card anatomy (icon/portrait · title ·
  one fact · one trailing item); grouped inset lists instead of nested boxes; three radii; the fact line never
  repeats the card's own type; trailing-glyph rules (› opens, a gold ✦ means Mari acts, a quiet Undo, a small
  filled Keep button); "Needs your OK" always listed first; reviews closed by default; one row per record (no
  duplicate rows for the same thing); calm states throughout (`mari-ui-subtle-effects`); correct at phone and
  desktop widths. Covers: reference cards, the outcome group, review cards, next-step cards, arrival cards, the
  reply-checkup panel (R2/slice 61), and the Chats panel rows. First copy the mockup's needed assets into
  `docs/development/mockups/mari-v5/` so the reference survives after `.tmp/` is cleared — reuse assets already
  present from mari-v3/v4's mockup folders where they already match, don't duplicate. Proof: before/after
  screenshots matching the mockup at 390/1440, dark and light; the outcome group's height measured (target ≈280px
  on desktop for 2 changes + 1 question); `heavy pnpm check`.
- R11 (slice 62e, designer, after 62d) Mari composer v5 — maintainer-approved, 2026-10-06. Mockup/spec same
  source, `.tmp/omnibar-ux/cards-v5/spec.md` §9. Scope: the Mari composer ONLY — the omnibar's Mari pane and her
  workspace. The normal chat composer (for characters/roleplay) is unchanged. Implement: neutral at rest, a pink
  focus ring only (no pink fill/border at rest); quiet borderless controls (34px targets, 44px touch target);
  one shared radius family; smooth growth up to 8 lines (6 on a phone), then scrolls internally with a top fade;
  attachments and the "Aware of" chips share one row inside the top edge of the composer; Send button is NEUTRAL
  — grey when empty, solid neutral (not pink) once there is something to send (maintainer decision: pink stays
  reserved for the focus ring only); menu options each get a one-line description (the mode menu is ≈300px
  wide); the Stop pill is unchanged from its current design. Also: while the phone's on-screen keyboard is open,
  Mari's header compacts to ONE line (name + status only, with the Skills/Memories/Aware of/Chats tabs tucked
  behind a menu) and expands back to the normal two-line header when the keyboard closes (maintainer-approved
  behavior). Proof: every composer state screenshotted before/after against the mockup at 390/1440, dark and
  light; a simulated on-screen-keyboard viewport (reduced visual viewport height) proving the header compaction;
  `heavy pnpm check`.
- R13 (slice 62g, designer, after 62e, priority — user report 2026-10-06) "Mari is getting dumber… long silent
  thinking, no visual feedback… no cool (I'm doing / I've done this) checkmarks." Full investigation (verify each
  before fixing) in `.tmp/omnibar-ux/round9/mari-regressions.md`. Four confirmed regressions plus one side check:
  (1) Done marks hidden (slice 36, `7f65de826`): `groupRunPhases`
  (`packages/client/src/lib/mari-work-timeline.ts:88-120`) folds done steps into closed `<details>`, the newest
  phase closes when answering, the plop runs inside closed details, the green check only shows on "Worked for"
  and only when `toolItems.length > 0`. Fix: keep phases open while the run is active, fold only after it ends;
  show a green done mark on each done step row (and on a phase summary once every step in it is done); keep the
  plop visible; an answer with no tool calls still gets a small done check.
  (2) The prompt adds silent rounds and thin answers (`workspace-agent.service.ts`): ≈line 796 (slice 36) reads
  every named record via `app_data` "so its card can show" plus "one or two plain sentences, do not repeat card
  details" — fix: bold the exact name instead, read a record only if its id isn't already known, allow a longer
  paragraph when the question actually needs one. ≈lines 865-866 (slice 37) adds a detail-plus-action read to
  every suggestion, "only ids you read in this run" — fix: only read when not already known, no extra reads.
  ≈line 903 (slice 62) calls `chat.diagnose` FIRST for any broad phrase — fix: restrict to actual cut-off/empty/
  worse-reply complaints, not every vague question.
  (3) Silent thinking: workspace rounds aren't streamed (`chatCompleteWorkspace(..., () => {})` at ≈3249, ≈3603);
  reasoning is off for non-custom providers. Fix, after (2) is done: stream a partial frame (reply text or
  planned command names) into the live headline if it's small; otherwise leave a `ponytail:` note rather than
  building full streaming infrastructure for this round.
  (4) Slice 62b's thread routing (`dcd18dd78`): opening Mari fresh from a chat/editor with no matching thread
  starts an EMPTY thread — reads as "she forgot everything". Arrival mid-run reroutes once `isBusy` clears and
  wipes the "Worked for" check (`HomeProfessorMariChat.tsx` ≈3893-3901). Fix: when no thread shares the context
  key, continue the most recent thread instead (offer "New about X" there, don't silently start fresh); never
  reroute before a finished run's timeline has actually been shown.
  Side check (low confidence, verify first): the staging merge (`2c754ae5c`) brought #7131's Anthropic
  thinking-budget/replay changes — confirm Mari on Opus 5.5 (`supportsAnthropicThinkingDisable: false`) doesn't
  silently think for a long time with zero feedback. Proof: e2e showing live step rows with done checks during a
  real run; a regression on the thread-routing fix. CHANGELOG. No deploy.
- R12 (slice 62f, designer, after 62g) "Golden Mari only unlocks after the Engine's own statistics show more
  than 100h of chat time." (1) Find the statistic: `chat-insights.routes.ts` (`/activity`, `/chats/:id/stats`).
  Reuse an existing total-time-chatted value if one exists; if none exists, add a deterministic estimate from
  message timestamps (sum the gaps between consecutive messages per chat, treat a gap over ≈15 minutes as a new
  session so it contributes a fixed small allowance instead of the raw gap). Compute server-side using the
  existing activity cache; show the number in the Activity overview so the user can see what the unlock is
  measuring. Keep the session rule and its constant in one place, with a `ponytail:` note on the heuristic.
  (2) Gate the pack: `MARI_APPEARANCE_PACKS` gets an optional `unlock` rule; Golden gets `{ chatHours: 100 }`. In
  the omnibar-settings pack grid (slice 57), a locked Golden card shows a lock, the requirement, and progress
  ("64h of 100h chatted"); it cannot be selected. The preview may stay visible, dimmed. Locked packs never load
  their sprites (38c tiers). (3) Existing users who already picked Golden while it was locked fall back to Basic
  in rendering; their stored choice is kept and returns automatically at 100h. Crossing the threshold shows a
  one-time quiet toast: "Golden Mari unlocked". Proof: a regression on the time estimate (sessions, gaps, empty
  chats) and on the unlock check (99h locked, 100h unlocked, the stored-choice fallback); an e2e with a seeded
  instance below and above the threshold; screenshots of the locked and unlocked cards at 390/1440, dark and
  light. CHANGELOG. `heavy pnpm check`.
- R14 (slice 62h, designer, priority — user report 2026-10-06 ~19:50, runs in parallel with slice 65 in the same
  worktree) Errors/retry, step summary, composer v5 follow-ups, sticky Mari. Full brief:
  `.tmp/omnibar-ux/round9/mari-fixes-62h.md`. Deployed prod is `f421bbb27`; reproduce each item first (a fake
  provider returning 503/timeout is fine, no external prompts needed). Five parts:
  (1) Errors + retry: every failed run (provider HTTP error, timeout, no answer, stream abort) must set the
  edge/composer glow to the red error state — find every path that ends a run with an error and route them
  through ONE place; error cards get "Retry" and "Retry with another model" actions (the latter opens the
  existing composer connection/model picker, then retries with the picked model — reuse the picker, no new one);
  drop or shorten the "This message stays open so you can take a screenshot." line.
  (2) Error-state lifecycle: Retry or a new message clears the red state immediately and brings back the
  thinking/cyan shimmer; old error cards don't persist for the whole chat — once a later run succeeds or the
  user sends a new message, collapse earlier error cards to one quiet line ("Failed · <short reason>") or remove
  them, keeping only the latest unresolved one as a full card; a "Worked for 1s · 1 step" line that expands to
  nothing should render as plain text, not a toggle (fix the cause if steps are getting lost, don't just hide
  the symptom).
  (3) "Looked at 1 thing" phase summary: open by default when it holds ≤3 items (or always for the latest run —
  pick whichever reads best, stay calm); when a step names a record (character, persona, lorebook, chat, agent),
  show a tiny avatar beside the name using the existing avatar/initial helper from the v5 cards (slice 62d).
  (4) Composer v5 follow-ups (slice 62e gaps): rename the "Aware of" chip to something clearer (designer's
  call — e.g. "Context" or "Using"; plain, short; update the `en.json` key text, keep the key itself semantic);
  the pre-62e context bar (showing what Mari is aware of / the current chat context) is gone with the new
  composer — bring it back in the v5 style (compact, in or right above the composer box); the Send button's
  arrow icon isn't optically centred in the round button on desktop (and maybe mobile) — centre it at 390 and
  1440.
  (5) Sticky Mari: her sprite beside the latest reply should stay visible (sticky) while that reply scrolls, the
  same way avatars stay sticky in Conversation mode — find and reuse that existing sticky-avatar pattern/CSS
  rather than building a new one.
  Constraints: subtle effects throughout; do NOT touch Engine connection setup (`ConnectionEditor`, connection
  routes, the first-run connection card — same exclusion as R4/R5); `en.json` keys sorted; CHANGELOG
  `[Unreleased]` entry; screenshots 390/1440 dark+light before/after in `.tmp/omnibar-ux/round9/slice-62h/`;
  keep the Paseo Progress ticket (T12) current; no deploy. Runs concurrently with slice 65 in the same worktree
  — stage only its own changed files (`git add <paths>`, never `git add -A`), never revert anyone else's changes,
  handle a push rejection by fetching and rebasing onto the new remote tip, never force-push.
