# Changelog

This file is the release-notes source of truth for Marinara Engine. Reuse these entries when publishing GitHub Releases for tags in the `vX.Y.Z` format.

## [Unreleased]

### Changed

- Moved Conversation **About Me** drafting from per-editor **AI Write** controls to Professor Mari. Character and Persona Convo editors no longer expose a separate model connection or source settings; Professor Mari can inspect a saved character or persona, write the bio in their voice, and save it directly to the real About Me field.
- Changed Noodle refreshes to choose active participants before first-time profile generation, skip characters that already have generated profiles, and send only the selected character cards to the timeline model. World/lore context and chat carryover now each have an 8,192-token budget so large invited rosters cannot inflate unrelated generations.

### Fixed

- Resolved `{{user}}`, `{{char}}`, and other prompt macros in opening greetings and `/guided` instructions at the final provider boundary, including lorebook routing and embedding scans, so late prompt injections cannot send raw identity placeholders to models (#3704).
- Raised Conversation routine-summary generations from a 512-token ceiling to an 8,192-token default, honored larger Connection overrides, and requested low reasoning effort so reasoning models still return visible summaries (#3696).
- Allowed selected custom agents to run in Conversation, Roleplay, and Game chats whenever **Enable Agents** is on, while preserving per-mode availability rules for official packages (#3692).
- Applied saved Connection Custom Parameters to every API-backed text generation that uses that connection, including Noodle and custom endpoints hosted locally, while preserving per-chat and per-call overrides.
- Routed bare Cohere API roots and versioned API URLs through Cohere's OpenAI-compatible endpoint.
- Kept the Noodle Carryover mode buttons equal-width while scaling their labels to remain fully visible with consistent spacing before each checkbox.

## [3.2.2]

### Added

- Added Venice.ai as an Image Generation service, including authenticated live image-model discovery and native `/image/generate` support with model-aware sizing and validated base64 responses (#3682).
- Added responsive Background library folders, desktop and touch drag-and-drop organization, A-Z/Z-A/Newest/Oldest sorting, and collapsible tag filters without limiting the Background agent's available choices (#3678).
- Added Conversation, Roleplay, and Game compatibility badges to Download Agents, including catalog search by supported mode (#3676).

### Changed

- Renamed current user-facing Conversation Calls references to **Calls** while preserving package IDs and legacy compatibility symbols (#3676).
- Moved Hierarchical Maps controls inside its active entry in Chat Settings → Agents instead of displaying a separate top-level settings section (#3679).

### Fixed

- Made `@handle` mentions in Noodle replies open the referenced profile, and resolved active Persona, Character, and linked lorebook macros before Noodle refresh prompts reach the model (#3687).
- Let Connection Custom Parameters preserve arbitrary JSON values and convenient bare string values instead of discarding invalid drafts, and restored unified reasoning-effort requests for dynamically discovered OpenRouter models (#3688).
- Fixed the downloadable Conversation Calls package persisting a hardcoded assistant reply when typed-message generation failed. Package v1.0.4 no longer requires provider-native JSON mode and reports genuine provider failures instead of inventing character dialogue (#3685).
- Made native profile imports atomic across file-storage rows and assets. Present archive assets are now fully decompressed, CRC-checked, and staged before live mutation; table upserts run in a serialized transaction; and promoted files roll back if a later write or durable database flush fails, while missing assets remain warning-only (#3683).
- Fixed generated and manually replaced Game Journal NPC portraits failing to update when a reputation label was appended to the NPC name. Portrait matching now treats the display label and the tracked NPC as the same character throughout the live session (#3681).
- Increased the final Game setup generation watchdog from 300 to 500 seconds so large GM blueprints have enough time to finish without extending unrelated in-session generation limits (#3684).
- Fixed merged Roleplay group prompts stripping every historical speaker-tag example. The latest assistant message now keeps its `<speaker>` wrappers while older tags are still trimmed, and the instruction remains inside `<output_format>` when available or otherwise appends to the last user message (#3673).
- Preserved the **Enable Agents** master switch during the v2.3 capability migration, so upgrading cannot silently reactivate selected agents or their model calls. Hierarchical Maps now remains independently available when selected (#3669).
- Made the v2.3 capability migration restart-safe by writing its completion marker only after per-chat selections are migrated and flushed to durable storage; interrupted migrations retry idempotently on the next startup (#3670).
- Fixed Conversation Calls failing to recognize downloaded Local Whisper models when `DATA_DIR` was not explicitly configured. Downloaded capability runtimes now inherit Engine's resolved host data directory instead of deriving a private nested model path (#3671).
- Fixed Professor Mari returning blank character or lorebook generation turns, normalized common character-card field names, and made lorebook creation save generated entries atomically (#3674).
- Fixed Tic-Tac-Toe failing to render when an installed legacy game client expects React on the global scope (#3675).
- Kept cropped Character and Persona avatars contained inside the Colors message preview, including cards with additional sprites, instead of letting the preview image cover the editor (#3678).
- Kept the Roleplay-default star anchored in one place when its selected state changes (#3678).
- Vertically centered Chibi Professor Mari in her surprise-visit toast (#3678).

## [2.3.1]

### Added

- Installed official agents and feature packages now check the Marinara-Agents catalog during server startup and automatically upgrade to the newest compatible version before their runtimes activate. Offline, incompatible, missing, or failed package updates leave the previously installed version available, while verified server-runtime failures continue to roll back automatically.
- Conversation schedule creation now includes a global timezone selector that defaults to the browser-detected IANA timezone, can be overridden or reset to the current device zone, syncs across devices, and applies to existing and future Conversation chats. Schedule generation, presence, autonomous messages, temporal prompt context, and background server polling now honor the same saved selection.

### Changed

- Began the v2.3.1 development cycle and synchronized version metadata across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and shared update checks.
- Android `versionName` is `2.3.1` with `versionCode 35`.

### Fixed

- Restored passwordless localhost access to container installs on Docker Desktop and custom Docker address pools. Docker runtime trust now recognizes the container's exact default IPv4 gateway in addition to the conventional `172.16.0.0/12` bridge range, while the existing `BYPASS_AUTH_DOCKER=false` and proxy-auth controls remain available.
- Fixed Windows installs and updates failing during the shared-package build with `'pnpm' is not recognized` when the launcher correctly used Corepack without a global pnpm executable. The shared build now cleans its artifacts directly through Node, and the Windows installer guard prevents nested package-manager calls from returning.
- Reworked Conversation prompt assembly so Peek Prompt groups Conversation turns under **Chat History**, character join/leave notices become timestamped history events only after a chat has actually started, reaction syntax lives inside **Commands**, and merged-group speaker-prefix and character-only response boundaries are emitted last in the preset's XML, Markdown, or plain output format. The built-in Conversation prompt and Marinara preset now use identity wording that fits both one-to-one and group chats, with a safe startup migration for existing bundled presets that still have the old lead sentence.
- Restored Conversation group chats to one merged provider generation per turn, allowing the model to choose every present speaker within the grouped response instead of issuing a separate restricted request for each character. Roleplay Individual mode remains unchanged.
- Preserved distinct Noodle authorship across persona switching: posts and replies retain their originating persona account and snapshot, timeline prompts identify each persona by handle and stable identity key, and chat carryover summaries name the persona account instead of collapsing activity into the currently selected identity.
- Restored Card Browser and official agent-catalog requests when upstream services reject Undici's default identity or a Windows proxy strips the response `Content-Type`. Marinara now identifies those requests explicitly and permits only missing MIME headers for their trusted, size-capped JSON paths; present invalid content types and malformed catalog data remain rejected.

## [2.3.0]

### Added

- Added a one-time, version-aware **What's New?** window for fresh installs and updates. It waits until first-run onboarding is complete, introduces each release's main features with Professor Mari, links directly to that version's GitHub release, and remembers the exact version shown so it does not reappear until the next update. The v2.3.0 announcement spotlights downloadable Agents, Hierarchical Maps, and Tactical Combat Mode with a compact, responsive battlefield preview.
- Added an editable **Noodle Prompt** at the top of Noodle Settings, with a full-screen editor and one-click default restoration. The canonical default now contains the complete adult-platform, persona-authorship, interaction, and JSON instructions, while the separate timeline voice text is appended last. Its **Edit prompt** action now follows the standard Noodle Settings button treatment, with centered content and a clearly visible Noodle-blue pencil icon on desktop and mobile.
- Added a **Combat Preference** to Game mode, chosen in the setup wizard and changeable later from the Chat Settings **Combat Style** section: keep the classic narrative combat, or switch to a new tactical battle style inspired by grid-based tactics RPGs. Tactical encounters play out on a terrain-painted battlefield with scene-matched backdrops, unit classes, party formations, per-unit movement and attack ranges, counters, critical hits, misses, and a full enemy phase driven by a deterministic seeded engine at four difficulty levels. Battles feature animated movement, floating damage popups, a draggable unit inspector and action menu, staged moves shown as translucent previews until confirmed, defeated units leaving the battlefield, restartable encounters, and a mobile-friendly layout.
- Added a responsive full-page **Agents → Download Agents** library for installing, reading about, updating, and uninstalling official capability packages, with installed/uninstalled groupings ordered as Writer, Tracker, and Misc Agents, plus creator artwork with an Agents-star fallback. Card Evolution is classified as a Writer Agent and Hierarchical Maps as a Tracker Agent. On desktop, full-page libraries and resource editors open beside their originating sidebar; mobile keeps the focused full-screen flow. Fresh installs now contain no optional agents, while existing installations migrate their agents and chat feature selections without losing settings, runtime data, or history.
- Added **Install All** and **Uninstall All** controls beneath Download Agents search. Bulk package changes run through a safe sequential queue with visible progress, partial-failure reporting, immediate catalog refresh, and confirmation before removing every installed agent.
- Published first-party downloadable agents in the new [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) repository as individually verified packages. Its README now lists every Writer, Tracker, and Misc package, while repository contribution rules, issue and PR templates, catalog validation, protected review flow, and automatic CodeRabbit review keep future package work complete and reviewable. Conversation mode's About Me profile and `update_about_me` tool remain built into the Engine and are not downloadable agents.
- Moved Hierarchical Maps, Conversation audio/video calls, UNO, Chess, Poker, 8-Ball Pool, Tic-Tac-Toe, and Rock-Paper-Scissors into optional packages with package-owned server runtimes and responsive client surfaces. Maps can be enabled as an agent in Roleplay and during or after Game creation.
- Added a default-on Noodle setting that can exclude Professor Mari from account discovery and future generated activity without deleting existing timeline history ([#3598](https://github.com/Pasta-Devs/Marinara-Engine/issues/3598)).
- Added **Open Full Library** to Personas, with the same responsive card grid, search, sorting, preview pane, paging, scroll restoration, and editor return flow as the Character Library.
- Added separate opt-in browser and Android generation-completion notifications for manually started Conversation, Roleplay, Visual Novel, and Game replies that finish while Marinara is unfocused, without changing autonomous-message background notification preferences (#3588).

### Changed

- Categorized Marinara Engine's attributed OpenRouter traffic as **Roleplay** and **Game**, improving its visibility in OpenRouter's relevant app-ranking filters while preserving the GitHub repository as the canonical app referer.
- Renamed **Bot Browser** to **Card Browser** throughout the interface, documentation, onboarding tutorial, and Professor Mari guidance, and renamed **Browse Online** to **Download Cards**.
- Updated the Character and Persona full libraries to use the chroma text color selected in Settings for headings, counts, descriptions, metadata, tags, previews, and empty states instead of legacy fixed-color text.
- Reworked Character and Persona sprite transparency around a native-alpha-first pipeline. Providers that cannot return transparent PNGs now receive a subject-aware saturated chroma matte, followed by border-connected soft matting and color despill; the optional neural remover is reserved for genuinely complex backgrounds, while saved legacy white-background sprites remain cleanable with restore points.
- Made Local Whisper a Conversation Calls-owned download. Connections now shows Local Speech Model controls only while the Conversation Calls package is installed, and uninstalling Conversation Calls removes every downloaded Whisper model and its saved selection to reclaim disk space. Reinstalling Calls makes the models available to download again.
- Removed the retired database compatibility stack, including its runtime backend switch, startup migrations, one-time importer and repair readers, old migration scripts, database-file backup handling, and external ORM/runtime dependencies. Storage schemas and query expressions are now file-native throughout the Engine.
- Made file-native primary and natural-key constraints enforceable during atomic inserts and updates, preventing concurrent custom-media names, Noodle toggles, and lorebook links from persisting ambiguous duplicates.
- Reduced the base Engine by removing more than 25,000 lines of optional agent, map, call, and table-game implementation code. The base now exposes small validated capability registries and compatibility bridges while downloaded packages supply feature code on demand.
- Added a canonical 29-package catalog summary to both Professor Mari prompt paths and completed the public agent reference, README, and developer documentation so Mari can compare and recommend every Writer, Tracker, Misc, Maps, Calls, and Conversation-game package without confusing catalog availability with installation state.
- Consolidated Conversation command controls and renamed selfie configuration as **Illustrator Settings** inside Chat Settings → Agents. Agent sections, settings, and package-owned command toggles now appear only for agents that are actually installed, while an empty setup-wizard Agents step links directly to the Agents tab and its Download Agents action.
- Updated Professor Mari, onboarding, and agent documentation to explain the downloadable-agent workflow, package restarts, offline behavior, and backward-compatible migration.
- Began the v2.3.0 development cycle and synchronized version metadata across packages, the PWA manifest, Windows installer sources, Android APK metadata, and shared update checks.
- Android `versionName` is `2.3.0` with `versionCode 34`.

### Fixed

- Logged every Noodle timeline refresh model response in debug mode, including correction attempts, and persisted each raw attempt with its full rejection reason so malformed first responses remain auditable after a successful retry ([#3655](https://github.com/Pasta-Devs/Marinara-Engine/issues/3655)).
- Fixed Conversation **About Me → AI Write** sending literal card macros such as `{{user}}` to the model. The one-shot draft now resolves selected card fields, lorebook entries, recent chat context, and extra direction with the active Conversation persona and character before provider submission ([#3646](https://github.com/Pasta-Devs/Marinara-Engine/issues/3646)).
- Unified the online Card Browser with the Character, Persona, and Agent library shell: it now opens as **Cards Library**, introduces **Browse character cards online**, keeps the familiar back navigation and chroma-aware library background, and renders search failures in the selected chroma text color instead of legacy pink.
- Changed **Uninvite everybody** and its confirmation action from destructive red to Noodle blue, and made the disabled custom mouse-pointer preference persist immediately so Firefox, PWAs, and quickly closed sessions do not silently turn it back on.
- Fixed concluded Conversation scene summaries bypassing daily and weekly compaction because narrator history is represented as system-role prompt messages. Past scene summaries now fold into their normal day/week summaries and stay out of the verbatim recent-message tail, while current-day scene context and genuine system instructions remain intact ([#3641](https://github.com/Pasta-Devs/Marinara-Engine/issues/3641)).
- Replaced stale Spotify, YouTube, or Custom player controls with clear **Download Music DJ Agent to configure** guidance and a direct **Download Agents** action on desktop and mobile whenever the always-available **Music Player** toggle is enabled without Music DJ installed.
- Fixed Conversation selfie prompt generation ignoring the per-chat **Prompt Model** selection. Automatic character selfies and Gallery selfies now route their prompt-writing request through the selected text connection, including its provider, model, caching behavior, and local-sidecar support (#3638).
- Applied downloaded package artwork to matching installed agents in the Agents sidebar, while preserving user-uploaded pictures and the star fallback for missing or failed images.
- Restored the Characters sidebar header icon to the same pink-to-rose gradient used by the New Character action while keeping its topbar icon on the selected chroma accent.
- Calibrated Lorebook semantic similarity against an unrelated-text baseline so embedding models whose raw cosine scores cluster around 0.97 no longer inject unrelated entries at every usable threshold or suppress relevant entries near 1.0 (#3627).
- Replaced the nested presence animation used by expandable right-sidebar folders with an accessible grid transition, preventing Connections and Lorebooks folders from crashing the app shell with React hook-order errors (#3630).
- Recognized OpenRouter's positive-form `No endpoints found that support image input` rejection as a non-vision model response, allowing Noodle timeline refreshes to retry once with the existing text-only prompt (#3631).
- Moved the Game Assets manifest and rescan lifecycle out of Zustand into one React Query cache shared by Game surfaces and the Asset Browser, consolidated model/runtime and Whisper download SSE parsing, and made failed sidecar delete/unload actions propagate instead of silently succeeding (#3616).
- Fixed Game Journal tabs refusing to scroll on desktop and iOS by giving the embedded journal a bounded flex viewport, and made replaced/generated NPC portraits refresh immediately even when the server reuses the same image URL (#3624).
- Updated the Character Colors preview to render the active card's cropped avatar with an icon fallback, while keeping its sample narration free of formatting asterisks (#3622).
- Preserved the standard `<START>` example-dialogue separator through XML prompt sanitization, including cards whose importer had already encoded the marker, without allowing other XML-looking card text through unescaped (#3623).
- Removed every random-user instruction and profile placeholder from Noodle refresh prompts when Random Characters are disabled, while participant selection continues to exclude those accounts entirely (#3619).
- Consolidated Chub, CharacterTavern, and Wyvern Bot Browser JSON requests behind a shared HTTPS-only `safeFetch` boundary with explicit provider hosts, JSON content-type validation, redirect rejection, cancellation-aware timeouts, and bounded response sizes (#3617).
- Restored swipe-to-dismiss for mobile web toasts in both horizontal directions and upward, so touch users no longer need to target the small close control (#3625).
- Renamed the Connections **Illustrator** defaults category to **Images**, hid image/video generation settings and `/illustrate` or `/selfie` commands until Illustrator is installed, kept `/help` first in slash suggestions, and refreshed `/help` and `/macros` feedback with chroma-aware styling.
- Fixed Gallery generation controls appearing without an active Illustrator package. Illustrate, Selfie, Storyboard, Video, Animate, and Background actions now require Illustrator to be installed and enabled for that chat in every mode, while Roleplay Gallery replaces the separate Browse Images window with its asset search directly in the Gallery.
- Unified Chat Settings → Agents and Conversation command toggles with the same accessible chroma-aware control styling used by the rest of Chat Settings, restored spacing between installed Conversation Calls settings and schedule-generation preferences, and changed Game setup's selected SFW/NSFW rating from green/red status colors to the selected accent color.
- Fixed installed Conversation feature packages still behaving like per-chat pipeline agents. The six table games now appear in the Commands controls without separate Add Agent entries, Conversation Calls settings render directly below Illustrator settings using the native chroma controls and expand only after calls are enabled for that chat, and installed games/calls expose their surfaces and command runtimes without requiring legacy `activeAgentIds` metadata.
- Fixed downloaded Maps and Conversation Calls packages failing against file-native storage with `Unsupported table: chats`, `Unsupported table: conversation_call_sessions`, or an undefined schema name. Capability-owned file-table and column objects now resolve safely through the Engine's registered schema names instead of requiring identical JavaScript object instances, while incompatible installed package versions are quarantined before their hooks can crash generation ([#3647](https://github.com/Pasta-Devs/Marinara-Engine/issues/3647)).
- Updated Persona Status Bars’ **Add** button to follow the selected chroma accent instead of using hard-coded green styling.
- Fixed Conversation Chat Settings hiding the **Selfies** command after Illustrator was installed. Package-owned commands now appear alongside their separate agent settings as soon as the matching agent is available.
- Kept Chat Settings → Agents available in Conversation, Roleplay, and Game when no optional agents are installed. Built-in Conversation commands remain configurable without downloads, and the Conversation setup wizard now shows those commands plus only the extra commands owned by installed agents. Empty Roleplay and Game sections link directly to Download Agents, while the chat setup wizard removes its redundant decorative Agents icon from the empty state.
- Made Game setup respect installed agent ownership: Hierarchical Maps, Music DJ, Lorebook Keeper, and Illustrator controls now appear only when their packages are installed, with Visual Generation renamed to Illustrator. Empty Game and Conversation setup states link directly to Download Agents, and the Game connection guidance now follows the selected chroma accent instead of hard-coded yellow styling.
- Removed the inert **All agents** back control from the desktop Download Agents detail view while preserving its working list navigation on mobile.
- Fixed uninstalling a downloadable agent leaving its card in the already-open Agents sidebar until the panel was closed and reopened. Capability registry updates now land before React publishes the refreshed package state, so installed-agent lists and empty states update immediately.
- Fixed left and right sidebars disappearing before the desktop shell caught up, which briefly left an empty column beside the chat. Their reserved width now collapses in sync with the visible panel slide, including the full-width mobile chat sidebar. Lorebook entry filter chips now use consistent inset-safe borders so character, tag, generation, and additional-source choices are no longer clipped by their scrolling containers.
- Fixed Group Conversation replies ignoring the documented inherited-speaker format in Bubble display. Each generated line now receives its own bubble while unprefixed consecutive lines retain the preceding character's identity (#3609).
- Fixed recurring Roleplay characters losing tracker stats, custom fields, or their character-card avatar after being absent for several scenes. Character Tracker now receives card RPG configuration and bounded historical continuity, restores omitted prior values, and enforces card identity and artwork in normal and retry runs (#3606).
- Fixed graceful shutdown completing before a file-native storage flush could drain newer writes queued during its active disk write, and made persistent close-time I/O failures reject shutdown instead of silently reporting success (#3602).
- Fixed the Agent Editor custom-music folder picker omitting saved remote-admin and CSRF credentials by routing its privileged request through the shared API client (#3603).
- Fixed dense Connections editor text flickering or shifting in Chromium browsers at the accent pulse's 500 ms update cadence. Editor reading surfaces now retain the selected base accent while headers and explicit accent chrome continue to pulse (#3599).
- Fixed recalled-memory truncation splitting supplementary Unicode characters such as emoji or Lydian text into invalid UTF-16 surrogate halves, which caused strict provider JSON parsers to reject otherwise valid Conversation generations (#3596).
- Fixed selected background-library images immediately disappearing in Roleplay mode because the renderer probed the GET-only image route with an unsupported HEAD request (#3592).
- Fixed Noodle profile text edits resetting character avatars from their configured crop to the full source image. Unchanged avatars now preserve their crop, and previously lost crops recover from the matching character card on the next profile save.
- Fixed a blank `TZ=` forcing server-side schedules and date-sensitive Conversation context into the synthetic `Etc/Unknown` UTC timezone. Blank values now inherit the host timezone, Noodle warns when timezone detection is unresolved, and chats remember the browser timezone for autonomous scheduling, temporal awareness, daily memories, and tool macros (#3590).

## [2.2.1]

### Added

- Added Tic-Tac-Toe and Rock-Paper-Scissors as one-on-one Conversation-mode table games. Tic-Tac-Toe seats you against a character on a 3×3 board with a choice of X, O, or a random mark, and detects wins and draws. Rock-Paper-Scissors plays a best-of-3/5/7 match where each round's throw stays hidden from your opponent until both of you have thrown, then reveals the result. Both join the `[tic_tac_toe]`/`[rock_paper_scissors]` Conversation command family alongside `[chess]` and `[eightball]`, with `/tictactoe` (alias `/ttt`) and `/rps` slash commands, natural-language launchers, per-chat command toggles, and setup modals for opponent and game length.
- Added a compact, expandable **Defaults** section to Connections for Main, Agents, Illustrator, and Videos. Each category now supports an optional fallback connection; failed generations retry once through that category's fallback while user cancellations and already-visible partial text streams remain protected from duplicate output. A toast identifies the fallback connection and model whenever the engine switches over.
- Added drag-to-resize controls for the Echo Chamber on desktop and touch devices, with responsive text wrapping and correctly oriented handles in every screen corner.
- Added native Android notification permission and delivery support to the APK wrapper so autonomous Conversation messages can notify mobile users while the app is backgrounded (#3572).
- Added expandable Noodle poll vote details so tapping or clicking a vote count reveals which accounts selected each option (#3566).

### Changed

- Moved **Title / comment** into the primary identity fields directly below **Name** in both Character and Persona Metadata, while keeping it synchronized with the matching editor-header field.
- Changed Noodle participant selection so invited characters remain the primary cast while random-user accounts appear only occasionally as supporting activity.
- Moved media-wide queueing and prompt-review controls into a new **Overall Generations** settings group, renamed the queue option to **Queue media generation requests**, extended it to video generation, and added a Conversation toolbar hint linking users to generation settings.
- Moved weather particle rendering off the main UI thread where supported, capped canvas resolution and mobile particle density, and reduced background polling/animation work to improve foreground smoothness and mobile battery use (#3567).
- Added consistent Marinara Engine app attribution to every OpenRouter request path, including text, embeddings, image generation, model discovery, and video generation.
- Bumped release metadata to v2.2.1 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Android `versionName` is `2.2.1` with `versionCode 33`.

### Fixed

- Fixed NovelAI connection tests calling a retired subscription endpoint. Connection setup now directs users to Test Image, which verifies the real generation path (#3582).
- Added a confirmation step before branching a chat from a message, preventing accidental branch creation from tightly spaced mobile Roleplay controls (#3583).
- Fixed Noodle timeline prompts exposing internal character and account IDs, mentioning disabled random users, and repeatedly favoring the same early invited characters. Timeline generation now identifies accounts only by handle, omits random-user guidance when disabled, rotates the eligible roster fairly, and still prioritizes accounts involved in recent persona mentions or replies (#3584).

- Fixed desktop top-bar navigation dismissing open chat tools such as Chat Settings, Gallery, Branches, Active Context, and Conversation Presence. Desktop shell panels now reflow those tools alongside the chat, while mobile navigation continues to dismiss floating chat UI.
- Fixed Presets list metadata wrapping Regex AI/User badges above their patterns and Function badges below their names. Patterns and function names now truncate first so their badges remain beside them on one line.
- Fixed Professor Mari's chat opening below the usable mobile viewport and hiding its composer on iPhones. The expanded chat now fills the app content area beneath the top bar and reserves the device's bottom safe area (#3569).
- Fixed Professor Mari's structured `persona.create` action and `mari personas create` helper omitting required Conversation profile columns. Both creation paths now supply safe defaults and accept phonetic name, Convo display name, About Me, and Convo behavior values; the corresponding update helpers and command guidance were synchronized as well (#3571).
- Hardened generation fallbacks so output already emitted through streaming callbacks is never replaced, failed toast delivery cannot cancel a working fallback, Roleplay background generation participates in Illustrator fallback routing, and Conversation selfie galleries record the connection and model that actually produced the image.
- Fixed Present Characters tracker values crashing React when generated stats used structured `{ name, value, max, color }` objects; tracker displays now normalize those values safely (#3563).
- Fixed autonomous group Conversation exchanges stopping at one capped or cooling-down character, sequential turns leaking other speakers, valid target replies being removed by wrong-speaker pruning, and OpenAI-compatible SSE responses losing content delivered through final message frames (#3573).
- Fixed Roleplay chats opening at the oldest history position instead of the latest message, and updated **Show newer** and **Latest** controls to inherit the selected chroma text color.
- Fixed Echo Chamber batches appearing all at once or too quickly by revealing queued reactions individually at randomized 10–30 second intervals, while protecting the active chat from stale delivery writes.
- Fixed Echo Chamber corner controls pointing in the wrong vertical direction when the panel is anchored along the bottom edge.
- Fixed image and video connections retaining or claiming the language-only **Fallback for Main** role after creation or provider changes.
- Fixed corrected Noodle refreshes bypassing the same activity and authorship validation as the first attempt, empty refreshes being accepted without retry, persona IDs being offered as generated authors, and JSON-shaped image prompts without a usable prompt field being sent verbatim to image providers.
- Fixed Android/Termux updates repeatedly forcing the entire dependency store to reinstall for the same stale build. The launcher now performs one rebuild, prunes unreferenced packages left by older releases, avoids irrelevant cross-platform binary downloads, and accepts the current Node 26 Termux runtime (#3540).
- Fixed one malformed generated Noodle post, interaction, follow, or digest rejecting an otherwise valid refresh. Rows are now validated independently, while wholly malformed JSON or batches containing only invented account IDs receive one constrained retry with the exact active IDs (#3547, #3553).
- Fixed XML agent prompt-template overrides escaping literal contract tags such as `<chat_summary>` and `<existing_entries>` while continuing to escape values inserted through macros (#3548).
- Fixed Conversation group messages ignoring character-specific Convo display names in generation instructions, speaker parsing, sender labels, typing events, and historical base-name matching (#3550).
- Added profile editing for directly invited Noodle characters, including display name, handle, bio, location, avatar, and banner; manual profile identity changes are preserved when the underlying character card is refreshed (#3551).
- Fixed add-character searches in Conversation and Roleplay setup and Chat Settings ignoring card tags, descriptions, creator metadata, and title aliases (#3555).
- Fixed Noodle's default generated-image path sending the post text and prompt-building meta-instructions directly to image providers. It now sends only the model's visual idea, character appearance, Noodle image direction, and selected image-generation style settings, with recovery for legacy or JSON-wrapped image prompts (#3554).
- Fixed Noodle profile setup failing an entire refresh when one model-generated profile contains an overlong or malformed field. Generated profile text is safely bounded, invalid rows are skipped independently, and valid accounts from the same batch still apply (#3533).
- Fixed Noodle forgetting the last selected persona after a browser refresh or app restart; the account choice now persists per browser and falls back safely when that persona no longer exists (#3535).
- Fixed renamed character cards retaining their former Noodle display name. Bootstrap now refreshes entity-owned character names and avatars while preserving generated handles, bios, locations, and other Noodle profile data (#3537).
- Fixed generated chat images being saved only to the chat gallery. Illustrator generations and retries across Roleplay/Game, Conversation command and Gallery selfies, and Conversation Call selfies now also create independent copies in every depicted character or persona gallery (#3538).
- Restored Echo Chamber's queued Roleplay delivery: newly generated reactions now arrive one at a time with short delays, persistence races cannot reveal a whole batch, stale reveal counters are clamped, and inactive-chat retries cannot write into the visible chat's Echo panel.
- Fixed character Advanced prompt controls being dropped from live Conversation and Game requests. System Prompts, Post-History Instructions, and Depth Prompts now cover Conversation participants plus Game party/character-GM cards, using the same shared injection path in preset assembly, direct mode assembly, and Prompt Preview.
- Fixed Roleplay Illustrator comic and manga prompts being contradicted by an unconditional negative prompt that banned speech bubbles, captions, readable lettering, and SFX. Text suppression now remains enabled for ordinary illustrations but yields to explicit lettering requests in the final compiled prompt.
- Fixed Roleplay Text to Speech replaying the previous assistant message whenever a new output generation failed. Autoplay now requires a successful generation with a genuinely new assistant-message revision, and failed partial outputs are never queued for automatic playback.

## [2.2.0]

### Added

- Added **Noodle**, Marinara's fake social network and the headline feature of v2.2.0: invited characters and optional random users can create posts, nested replies, polls, images, likes, reposts, mentions, and notifications on a persistent generated timeline; personas can participate directly; automatic and manual refreshes support scheduling and social-memory carryover into Conversation, Roleplay, and Game; and the responsive mobile shell provides profile navigation, search, settings, notifications, and pinned bottom navigation.
- Added long-term Noodle timeline recall: refreshes can now sample up to three posts older than 48 hours so characters may naturally remember, revisit, or interact with past activity.
- Added native multimodal Noodle timeline context: refresh models can inspect images attached to recent posts and comments, with deterministic post/reply labels, bounded image inputs, and an automatic text-only fallback for models that reject vision content.
- Added optional Noodle image captioning with a selectable vision connection so text-only timeline models can understand images attached to posts and replies (#3505).
- Added prefix-matched `@handle` suggestions to Noodle post and reply composers, with click, touch, and keyboard insertion.
- Added first-class custom fields and hide controls to World State and Present Character trackers, including inline editing, lock-aware persistence, tracker-agent updates, and matching displays in the Tracker Panel and Roleplay HUD (#3518).
- Added per-agent manual scheduling for Roleplay tracker agents, so selected trackers can be excluded from automatic post-turn runs and triggered from the HUD without forcing the whole tracker suite into manual mode (#3522).
- Added batch editing for selected Lorebook entries, letting one boolean setting such as recursion, case sensitivity, whole-word matching, vector exclusion, or enabled state be applied to thousands of entries in one atomic update (#3513).
- Added Discord-style standard emoji shortcodes and Conversation autocomplete, so names such as `:crying:` render as Unicode emoji and `:cry…` suggestions appear alongside custom emoji (#3515).
- Added server-backed extension storage APIs and client/server runtime helpers so installed extensions can persist validated, size-limited settings across devices (#3524).
- Added a message-scoped Game state endpoint so extensions and integrations can retrieve the exact stored snapshot for a selected chat message and swipe (#3526).
- Documentation search in the in-app docs viewer now highlights every occurrence of the active query in the opened guide, result titles, and snippets, and opens each result at its first highlighted match.
- Added visible Game setup progress with an elapsed timer and indeterminate progress bar while the Game Master builds the initial world, plus live phase labels during the first turn (#3495).
- Added an **Initial Game Setup** section to Game Mode Session History so players can review, copy, or download a `.txt` file containing the complete setup that created a successful campaign, including preferences, prompt choices, visual/storyboard options, safe model descriptors, and effective generation parameters without credentials or local IDs.
- Added per-turn **Peek Prompt** actions to Game Mode Logs and **History Above Dialogue Box**, opening the exact cached prompt that was actually sent for that historical GM turn.
- Added read-only replay for completed Game Mode sessions from Session History, including click-through narration, stored presentation cues, and deterministic choice forks that only permit the option selected during the original session (#3465).
- Added a selectable **Comic Page Video** prompt for storyboard clips that interprets comic and manga panels as duration-aware ordered animation beats without changing the shared Game Video Prompt.
- Added an Anime Episode presentation for Game Mode with coordinated **Anime Game Prompt**, **Comic Page Animation**, and **Comic Page Video** defaults; setup-time keyframe targeting; a `{{gameStoryboardKeyframeCount}}` GM macro; and independent storyboard prompt selectors that keep **Anime Episode Director** plus **Anime Game Video** available as the alternative still-shot combination.
- Added GLM-5.2 to custom OpenAI-compatible connection model choices, including its 1M context and 128K output limits.
- Added OpenAI GPT-5.6 Sol/Terra/Luna model support, including the `gpt-5.6` Sol alias, a `gpt-5.6-sol-pro` pro-mode alias, Responses API routing, GPT-5.6 `max` reasoning effort mapping, and reuse of the existing Exclude Past Reasoning toggle for GPT-5.6 reasoning context.
- Added a configurable source picker (⚙️) for the Conversation "about me" AI-write, in both the character-card editor and the in-chat profile popout: choose which of the card fields (description, personality, scenario, backstory, appearance), the Convo behavior directive, the character's lorebook entries (with per-entry selection in the card editor), and recent chat context feed the draft. Defaults to personality only.
- Added Professor Mari suggestion chips and guided creation follow-ups so Home Mari and legacy Mari chats can surface color-coded quick replies for step-by-step creation, editing, and contextual next actions.
- Added a Revert control to the about-me editor (card editor and in-chat popout) to undo a manual or AI-write change, and an emoji picker in the about-me editor.
- Added an optional per-character toggle to declare a character's Convo display name on its card in the prompt, so the model can map the display name to the right card in group chats.
- The Convo display name is now shown as the sender label above messages in Conversation (read live, so renames reflect immediately), not only in the prompt and the profile popout.
- Added Poker (No-Limit Texas Hold'em) as a Conversation-mode table game for 2-8 players: seeded fair dealing, full no-limit betting with all-ins and side pots, showdown hand ranking with natural-language labels, and multi-hand sessions with a rotating dealer button, optional blind escalation, an optional hand limit, and player-paced "Next hand" breaks between hands.
- Added a selectable poker dealer: choose the silent house dealer or seat any chat character as the croupier, who announces hand starts, flop/turn/river reveals, showdowns, and blind increases in their own voice and personality — narration only, with dealing always seeded and fair.
- Poker joins the `[poker]` Conversation command family alongside `[uno]` and `[chess]`, with a `/poker` slash command, natural-language launcher, per-chat command toggle, and a setup modal for players, dealer, and stakes.
- Added 8-Ball Pool as a one-on-one Conversation-mode table game with a real 2D physics simulation: you aim and shoot for real — drag to aim with a guide line and ghost-ball preview, set power on a slider, and watch every shot play out with animated ball motion, collisions, cushion bounces, and pocket drops. Characters pick from an engine-computed shot menu (direct pots, bank shots, and safeties) in personality — daredevils take the showoff bank, tacticians play safe — and their choice is executed through the same physics with skill-based aim accuracy. Fouls (scratches and wrong-ball-first contact) give ball-in-hand with tap-to-place cue placement, slop counts, alternate breaks, and race-to-N matches with player-paced racks.
- Added a selectable 8-ball announcer: seat any chat character as the pool-hall commentator, who calls the break, group assignment, fouls, great shots, and rack wins in their own voice — narration only, never affecting the rules.
- 8-ball joins the `[eightball]` Conversation command family, with a `/8ball` slash command (alias `/pool`), natural-language launcher, per-chat command toggle, and a setup modal for the opponent, announcer, match length, and who breaks.
- Added an opt-in **Lorebook context** setting to Noodle (off by default): when enabled, timeline refreshes scan recent post/reply text and active character profiles for lorebook keyword matches and include activated entries as world/lore context, reusing the same multi-character lorebook system group chats already use, with a Noodle-specific token budget that scales with the active character count.
- Registered a **Noodle Timeline Voice & Tone** prompt override (Settings -> Generations -> Image Generation Prompt Overrides) so the tone and creative-freedom portion of Noodle's refresh prompt can be rewritten without code changes, while structured-action and output-format rules stay hardcoded outside the override so a rewrite cannot break refresh generation.
- Noodle's opted-in chat context now includes a character's current Conversation-schedule status and activity (for example, "currently dnd (At the office)") alongside that chat's recent messages, when the chat both has **Allow Noodle references** on and a running character schedule. Scoped per chat, with no new schedule computation or cross-chat reconciliation.
- Added an opt-in **Enhanced tone & continuity** setting to Noodle (off by default, Settings -> Timeline Writing): when enabled, each account's tone is grounded more strongly in its own Personality/Description/Backstory instead of a default upbeat voice, accounts are encouraged to react to, quote, or argue with each other's posts within the same refresh, older-post recall happens more often and favors posts relevant to currently active accounts, and the recall instruction is reworded to allow rather than discourage references. Off (the default) reproduces the prior tone and recall behavior exactly.

### Changed

- Updated UNO bot instructions and Wild tool guidance to expose the bot's remaining color counts and prefer its strongest held color instead of reflexively repeating the active color (#3512).
- Changed random and exact Noodle participant selection to prioritize directly involved accounts, then accounts absent from the previous refresh, while retaining recently active accounts as a fallback when the pool is small (#3505).
- Changed post-processing orchestration so Prose Guardian, Continuity Checker, and Immersive HTML share a dedicated rewrite call that is isolated from tracker batches, and hid the legacy About Me Keeper from the manually addable Agents library.
- Changed Noodle's generated-image quota from a daily cap to **Images/refresh**, applied independently to every manual and automatic timeline refresh while preserving each user's saved limit.
- Added a separate **Comic Page Animation** storyboard prompt with clip-duration panel budgets, causal panel order, continuity guidance, and timed motion direction while preserving the original **Comic Page** illustration prompt.
- Refined comic storyboard animations from output review: Gemini Omni now receives complete untruncated prompt components, six-second pages may use a simple third beat without overcrowding, animation pages minimize lettering and repeated cast members, full-page establishes cannot reveal later consequences early, and clips reserve a final hold.
- Changed storyboard videos to play once and hold on their final frame instead of looping. Background mode now starts each story beat's clip once with sound, lets narration display while it plays, waits before narration auto-advances, and exposes replay, play/pause, and mute controls in the desktop and mobile game toolbar.
- Removed the obsolete Visual Novel coming-soon tab and grouped legacy/imported Visual Novel chats under Roleplay while preserving their schema, importer, and achievement compatibility; Game dialogue layout labels now use Dialogue Box wording.
- Updated Noodle timeline guidance so characters may naturally be rude, petty, confrontational, revive grudges, form rivalries, and stir up interpersonal drama when it fits their established personalities and relationships.
- Restyled Noodle around the Klusek blue logo asset, replacing the always-visible settings column with a profile-triggered drawer and a more Twitter-like central feed.
- Updated Noodle image prompt generation so character posts may request either character-focused images or in-character memes when image generation is enabled.
- Updated Noodle timeline generation guidance so characters and random users know they may occasionally create and vote in polls and naturally use Unicode emoji in posts and replies; when random users are enabled, they may also very occasionally post clearly fictional parody ads or absurd fake crypto scams.
- Updated Noodle settings so selected character folders can be bulk-invited directly, and automated refreshes can be disabled by setting refreshes per day to `0`.
- Updated Noodle posts with edit/delete actions for every post, toggleable likes/reposts, a confirmed timeline reset control, multi-character image references, and automatic character-gallery saves for generated character post images.

### Fixed

- Fixed the root recovery screen hydrating the legacy default pink before the selected app accent could mount; crash details, borders, focus rings, and recovery actions now inherit the saved chroma color, and remaining old pink application-chrome fallbacks use semantic accent tokens.
- Added an actionable startup warning when the compiled client is missing, identifying the expected build path and the `pnpm build` command instead of silently serving only the API (#3529).
- Fixed Illustrator defaulting to the Background prompt in new and existing Roleplay chats after the staging update; normal Illustration is restored as the default, affected stored agent configs are repaired once, and explicit per-chat Background choices remain intact (#3517).
- Fixed the Windows uninstaller deleting current-layout user data under `packages/server/data`; uninstall now asks before application cleanup, safely preserves and restores retained data, supports the legacy root data folder, and removes the current `win` directory instead of a stale path (#3484).
- Fixed semantic Lorebook search being unreachable for ordinary keyed entries; vector similarity now acts as the documented fallback when keyword matching misses while retaining score thresholds, maximum results, filters, and probability gates (#3511).
- Fixed partially speaker-prefixed Conversation replies rendering their leading model text as narration beneath the user's message; the leading block now inherits the saved assistant character while edit and reaction attribution remain aligned (#3514).
- Fixed Conversation and other non-assembled generation paths silently disabling reasoning when the UI showed the default **Maximum** effort; shared and server runtime defaults now agree while an explicit disabled value remains respected (#3498).
- Fixed Noodle accounts repeatedly interacting with the same post or replying to their own comments without new involvement, while still allowing a return after an explicit tag or direct reply; also fixed profile validation errors rendering as `[object Object]` (#3505).
- Fixed pending persona portrait focus and zoom changes being lost when a tab was refreshed or closed before the debounce completed by flushing the save on `pagehide` with a keepalive request (#3506).
- Fixed Conversation replies leaking combined date-and-time and speaker prefixes such as `[11.07 15:53] Character: Hello!`; single and individual replies now store and display only `Hello!`, while merged group speaker boundaries remain intact.
- Fixed Lorebook Overview sections briefly rearranging after Save by handing the editor the authoritative PATCH response before clearing its dirty state; Professor Mari-created lorebooks now normalize categories and advanced numeric settings so later manual edits, including Global changes, can be saved.
- Fixed Roleplay streaming collapsing into the completed response when post-processing agents started, final response cleanup changed an already-painted prefix, the provider closed immediately after tracker work, or the browser tab lost visibility; authoritative cleanup now preserves typewriter progress, the live buffer remains authoritative through agent work, background tabs pause instead of flushing, held rewrites stream their final rewritten response before the durable message takes over, bottom-follow scrolling tracks the rewrite's committed DOM growth, and rewritten messages retain a persistent shield toggle for comparing the original and edited versions.
- Fixed editing the preceding user message during Roleplay generation temporarily rendering the saved assistant response beside its live streaming presentation.
- Fixed Text to Speech treating quotes inside generated HTML attributes and CSS as dialogue; markup is now removed before dialogue extraction, non-speech code/style blocks are discarded, and explicit speaker tags continue to route proper dialogue to the correct voice.
- Fixed desktop sidebars stuttering over dense Roleplay transcripts by replacing continuous width animation with compositor-only transform and opacity motion, retaining panel content between visits, and performing each center-layout resize only once.

- Fixed Noodle setting controls reverting to an earlier snapshot by serializing saves, keeping the edited value optimistic while the request completes, and returning the value re-read from persistent storage.
- Preserved stored votes on older Noodle polls when manual or automatic refresh hydration briefly returns an incomplete interaction snapshot.

- Fixed persona-authored Noodle comments bumping their target posts to the top of the timeline; a post now moves up only when another account directly responds to the active persona's comment.
- Fixed failed Noodle image generations leaving a visible image prompt in place of the missing picture; Noodle now retries the image provider once, then publishes a clean text-only post if the second attempt also fails and clears orphan prompts from earlier failed posts.
- Fixed provider concurrency-limit failures being reduced to generic agent errors or omitted from generation guidance; affected toasts now identify the concurrency limit and include the provider's message.
- Fixed new Roleplay chats opening without character greetings because initial character assignment inserted a hidden join notice before greeting seeding (#3472).
- Fixed the regex safety validator rejecting linear delimiter-bounded field patterns such as `([^|]+)\|([^|]+)\|([^|]+)` as polynomial backtracking risks while retaining rejection of overlapping broad-unbounded chains (#3471).
- Fixed failed Game Mode Lorebook Keeper runs leaving no obvious recovery path: Session History now surfaces the failure immediately, keeps its background status fresh, and provides a dedicated **Retry Lorebook Keeper** action.
- Fixed Game Mode status readouts written as standalone `<...>` lines being sanitized into empty narration steps, and removed segments made empty by display regex or macro processing.
- Fixed Background storyboard playback state leaking between keyframes, which could rapidly pause, restart, or appear to fast-forward animations.
- Fixed Grok CLI subscription requests failing to spawn (`E2BIG` / "Argument list too long") on long or multibyte-heavy transcripts by delivering the prompt via `--prompt-file` instead of a single inline `-p` argument; with the transport limit gone, an explicitly configured Max Context Window is now honored instead of being silently capped at 32k (the conservative 32k default is unchanged).
- Fixed Text to Speech source switching discarding the previous provider's encrypted API key, endpoint, model, voice assignments, and provider parameters; each source now restores its own saved profile when selected again (#3467).
- Fixed desktop Noodle emoji, custom emoji, and sticker insertions always appending to the end of post and reply drafts instead of replacing the active selection at the caret.
- Fixed example dialogue `<START>` sentinels being escaped as `&lt;START&gt;` in XML-wrapped prompts while continuing to escape arbitrary imported markup (#3441).
- Fixed Conversation **About Me** and Noodle avatars ignoring saved crop settings, and restored custom emoji rendering in Noodle profile bios (#3443).
- Fixed structured Game and Noodle generations being rejected when a model wraps an otherwise valid JSON object or array in thinking, metadata, or other stray text.
- Fixed GPT-5.6 Sol rejecting Noodle timeline/profile generation by supplying strict JSON schemas with `additionalProperties: false` at every object level and placing an explicit JSON instruction in Responses API input messages.
- Fixed native Z.AI GLM-5.2 connections using legacy thinking parameters; Marinara now sends the documented `thinking.type` and compatible `reasoning_effort` values while preserving JSON mode on Z.AI endpoints.
- Expanded every standard emoji picker from a hand-curated subset to the complete Unicode Emoji 17.0 base catalog, including science emoji such as 🧪 plus the previously missing travel, activity, object, symbol, animal, and flag groups.
- Fixed Quick Replies' **Post only** action saving recognized slash commands as ordinary messages; known commands now execute normally while unknown slash-prefixed text can still be posted.
- Moved **Quick replies** from Advanced settings to **General -> Input & Editing**, and clarified that image prompt review is a global generation preference rather than a Game-only option.
- Fixed manual Noodle timeline refreshes bypassing **Expose image prompts before sending**; generated Noodle images now present their final positive and negative prompts for editing before provider submission.
- Fixed character-assigned lorebooks failing validation when duplicated from the Lorebooks pane, while preserving their assignment and vector-search settings (#3433).
- Fixed the Noodle reply image picker separator inheriting a pink chrome accent instead of using Noodle blue.
- Fixed character-authored Noodle comments being read-only; their edit and delete controls now use the same flow as persona comments, while generated random-user comments remain protected.
- Fixed custom and imported preset variables disabling **Confirm Choices** when a valid blank-valued option was selected (#3429).
- Fixed turn-game bot table talk and dealer announcements leaking the model's chain-of-thought into chat when the connected model emits inline reasoning (e.g. a leading `<think>` block): narration now strips inline reasoning like the main generation pipeline, falls back to the factual event line when the output was all reasoning, and gets a larger output budget so reasoning models can still land the spoken line (#3427).
- Fixed comma-separated lorebook activation-key input so pasted key lists are trimmed, split, and deduplicated into individual keys (#3422).
- Fixed grouped Conversation reactions on mobile by keeping each speaker's reaction button visible and removing the ambiguous whole-block reaction target (#3424).
- Fixed generated and uploaded Game assets being misclassified as native merely because they lived below a bundled-assets folder, restoring move and delete actions for user-owned files (#3425).
- Fixed local git installs being unable to switch release channels from Settings unless general browser-applied updates were enabled; deliberate loopback channel switches now work while ordinary and remote update safety gates remain intact (#3426).
- Completed Noodle's automatic timeline refresh scheduling: daily refresh times are now distributed across persisted local-day windows, survive restarts, collapse overdue slots into one catch-up refresh, retry safely after failures, and update an open Noodle timeline automatically.
- Fixed PocketTTS voice refresh so built-in and custom voices returned by the provider `/v1/voices` endpoint are listed, including custom voices identified by URL/path fields (#3410).
- Fixed Conversation Call live-mic input so Local Whisper/provider media submissions cannot queue unbounded speech segments and lock the call UI behind repeated "too many requests" failures (#3411).
- Fixed Game Mode reputation widget updates accepting generated action descriptions longer than 50 characters, preventing scene-analysis reputation updates from failing on natural-language actions (#3409).
- Fixed the v2.1.1 auto-update build regression by resolving the stale TypeScript errors that broke the server/client build during update (#3401).
- Fixed the chat-specific about-me override being lost on reload or refetch — the popout read chat metadata without parsing it, so the override reset to the card default and, on save, could drop other characters' overrides.
- Fixed the about-me AI-write failing on "thinking" models (e.g. Gemini 3.x) that spent the entire output budget on reasoning and returned no content; the output ceiling was raised and reasoning effort lowered.
- Fixed the about-me source picker listing only "linked" lorebooks — a character whose lorebook is embedded now sees and can select its entries.
- Fixed the Conversation participant-profiles block labeling the persona as "the user," which nudged some models toward sycophancy; the persona is now presented as just another participant.
- Fixed the about-me profile popout on mobile (now a full-height sheet so the keyboard and emoji picker no longer overlap the field) and its overflow on desktop when the source panel is opened.
- Fixed help tooltips stacking — opening one now closes any other.

### Additional release scope

#### Added

- Added Conversation-mode profiles for characters and personas: a separate Convo display name, an "about me" profile (editable by hand or drafted by an AI-write button), and a Convo behavior directive with configurable insertion strategy, all Conversation-mode-only and never sent to the model in Roleplay, Visual Novel, or Game mode (#3368).
- Added per-chat "about me" overrides (Discord per-server-profile style): click a participant's avatar in Conversation mode to view their effective profile and set, edit, or clear a chat-specific override that supersedes their default about-me in that conversation.
- Added the opt-in **About Me Keeper** Conversation agent that lets characters keep their own about-me current on a configurable cadence, updating either their public card profile through the existing approval flow or a private, chat-specific one, and the opt-in **update_about_me** command so a character can update its own about-me in character mid-turn.
- Extended card CSS theming so the Conversation about-me profile popout is customizable from a character's or persona's Creator Notes (new `mari-about-me-*` hooks documented in the Card CSS Theming Guide), and personas can now ship creator-notes CSS for their popout.
- Added Grok 4.5 to the xAI / Grok model list and made new xAI connections default to it.
- Added Conversation prompt relocation macros for auto-inserted context: `{{context}}`/`{{status}}`, `{{commands}}`, `{{reactRules}}`, `{{memories}}`, and `{{lorebook}}`.
- Added a TTS cache export control in Text to Speech settings so generated cached voice clips can be downloaded from IndexedDB.
- Added a Roleplay Chat Summary maximum output size setting under Summary Connection, defaulting to 4096 tokens for manual and automatic summaries.
- Added a connected-chat shortcut to Game mode so connected Conversation and Game chats can switch back and forth like Conversation/Roleplay links.
- Added a scene prompt setup dialog for user- and character-initiated scenes, remembering POV, tense, and optional prompt wishes for the next scene generation.

#### Changed

- Bumped release metadata to v2.2.0 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Android `versionName` is `2.2.0` with `versionCode 32`.
- Tagged releases now attach a clearly named, versioned source ZIP alongside the Windows installer and Android bootstrap APK, in addition to GitHub's automatic source archives.
- Reworked Settings with search-first navigation, compact pinned controls, fixed top-level categories, and finer section shortcuts for faster navigation.
- Updated the default Illustrator prompt rules so generated image prompts carry available character builds, clothing/outfits, and appearance details instead of relying on the image model to infer them.
- Changed custom Roleplay Chat Summary prompts to apply globally across roleplay chats instead of only the currently open chat.

#### Fixed

- Fixed manual agent retry/rerun requests so only agents currently added to the chat can be resolved, preventing removed agents from being prompted by stale retry requests.
- Fixed agent prompt assembly so the required output format is appended to the terminal user message after chat history using the selected chat prompt preset wrapper (`<output_format>`, `## Output Format`, or raw text).
- Fixed non-Quest agents receiving active quest progress in current game-state context while keeping compact quest state available to the Quest Tracker when it is active.
- Fixed Roleplay/VN chat branching so tracker snapshots copy to the branch instead of only copying Game Mode snapshots (#3385).
- Fixed Lorebook Keeper approval previews and commits so updates to existing entries keep the existing text and include `newFacts` alongside proposed replacement content (#3384).
- Fixed the mobile Characters panel **Load more** footer so it no longer overlaps or blocks the last character cards (#3383).
- Fixed generated TTS playback so clips created while the tab is hidden or unfocused wait for the tab to return instead of being dropped (#3382).
- Fixed prompt identity fallback so card fields referenced by macros are not duplicated, and fields can be intentionally suppressed by placing their macro in the prompt template (#3380, #3377).
- Fixed Game Mode world setup lorebook generation so per-chat disabled lorebooks and hidden Game Lorebook Keeper books are excluded (#3376).
- Fixed active lorebook controls so a pinned lorebook that is also active via persona, character, or global scope can still be disabled in the current chat (#3375).
- Fixed Conversation command reminders so preset wrap format `None` no longer emits a literal `<commands>` XML wrapper (#3378).
- Fixed roleplay streaming recovery so parallel agent events are deferred until the main assistant stream finishes, preventing late agent updates from replacing the streamed message.
- Fixed the recovery/error page so **Internal Server Error** uses the configured chat chrome text color instead of a hard-coded pink.
- Fixed Conversation Calls on Chromium browsers by allowing same-origin microphone, camera, and screen-capture access in the server permissions policy instead of blocking the browser permission prompt.
- Fixed the Roleplay setup wizard's **Use Settings Presets** shortcut so system "joined the chat" notices no longer block seeding the selected character's first message (#3392).
- Fixed Conversation-mode prompt assembly so the user's visible status and activity are always included in context unless the persona is set to Invisible, even when a relocated context macro is configured but not present after prompt resolution.

## [2.1.1]

### Added

- Added a **Grok CLI (Subscription)** connection provider that routes chat requests through a local `grok` CLI login for SuperGrok / X Premium+ users, with in-app setup instructions and no API key or base URL fields.

### Changed

- Bumped release metadata to v2.1.1 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Reorganized Settings so Addons combines Themes and Extensions, Generations houses image/video generation and prompt overrides, Imports uses the plural label, generation prompt editors start collapsed, and Danger Zone uses accent-color selections with no default checked categories.
- Refreshed the in-app Credits modal from the GitHub contributors list and added credits sync/check helpers to the release workflow.
- Split the server generation route into focused prompt, provider, context, and command-runtime modules so Conversation commands, Professor Mari actions, turn games, provider setup, and post-processing paths are easier to review and maintain.
- Removed unused API Key and Base URL fields from local subscription/auth providers such as Claude Subscription, ChatGPT/Codex auth, and Grok CLI.

### Fixed

- Fixed Marinara profile/full backup exports so generated scene-video MP4s and reusable Conversation Call character video clips are included with their storage metadata and accepted on profile ZIP import (#3315).
- Fixed Card Evolution Auditor review proposals being falsely marked stale from cached character data by refreshing the character card before validation, and added an explicit stale override path that appends edited replacement text after confirmation instead of blocking the proposal outright (#3314).
- Fixed Memory Recall embedding creation for very large memories by chunking oversized recall text before sending it to embedding providers, preventing single giant entries from exceeding provider limits (#3317).
- Fixed Windows/git updater and launcher flows so they use the pinned pnpm version, avoid stale aggregate clean/build commands, and rebuild shared/server/client in update-safe package steps (#3318, #3323, #3324).
- Fixed Bot Browser avatar importing for sources that return generic or missing image content types, including Datacat, Character Tavern, Janitor/Janny, Pygmalion, and Wyvern avatar CDNs (#3319).
- Fixed Game Mode NPC portrait generation so GM-generated NPC descriptions are distilled into canonical portrait guidance for the initial and later NPC asset prompts (#3321).
- Fixed the Roleplay setup wizard's **Use Settings Presets** shortcut so it still seeds the selected character's first message when creating an empty chat (#3322).
- Added phonetic name fields to Character and Persona metadata, resolves phonetic-name macros, and uses those values when sending Conversation Call voice lines to TTS so names can be pronounced correctly (#3325).
- Fixed Conversation Call prompt macro resolution so live audio prompts, persona/character context, lorebook entries, daily history, and call transcript content resolve macros such as `{{user}}` before provider dispatch (#3326).
- Fixed custom preset choice confirmation so edited multi-select preset variables can intentionally be saved empty instead of disabling **Confirm Choices** (#3327).
- Fixed Conversation message avatars that were cropped in editors but appeared oversized in DMs/groups by restoring the relative avatar crop container (#3328).
- Fixed Conversation mode prompt assembly so selected preset wrap formats (XML, Markdown, or None) are respected for instructions, daily summary/date blocks, current context, memories, and lorebook injections instead of always wrapping supplemental sections in XML.
- Restored the Echo Chamber chat as a collapsible panel instead of making close/collapse hide the chamber permanently for the chat (#3329).
- Fixed manual group Conversation character triggers so the prompted character receives recent visible group transcript context and does not answer from profile/lorebook content alone (#3330).
- Fixed Roleplay `/guided respond for <character>` in individual group chats so Manual mode asks for an explicit target instead of no-oping, and Smart mode honors the requested character instead of the queued responder badge.
- Fixed first-turn lorebook activation so opening chat messages remain keyword-scannable during the first user generation even when the recent-message scan window would otherwise drop earlier group greetings (#3332).
- Fixed Text to Speech character voice assignment so users can add character voices using provider default voices, including ElevenLabs defaults, even before custom/account voices are loaded.
- Added a per-chat Conversation Calls setting to disable generated bracketed voice cues for TTS providers that do not accept `[whispering]`, `[laughing]`, `[sighs]`, and similar tags.
- Fixed Grok CLI (Subscription) connections so they no longer seed stale `grok-build-*` model aliases, can use the local CLI default model with a blank model field, and fetch selectable model IDs from `grok models`.
- Fixed Grok CLI (Subscription) roleplay requests by preferring the safe headless Composer model when discovered, starting Grok CLI connections with a safer 32k context window, and surfacing a clearer context-limit hint when the CLI reports `max turns reached`.
- Added Lorebook entry-status sorting, fixed continued assistant messages so appended text starts after a blank line, and removed the obsolete tracked `pr-evidence/` artifacts while ignoring future evidence folders (#3336).
- Fixed Conversation-created scene chats so their Prompt Preset selector remains visible while still defaulting to None.
- Made the Connections panel's unfiled/root drop area more forgiving so desktop users, including Windows users, can reliably drag connections out of folders without hitting a tiny target.
- Fixed native lorebook import so nested folders keep their parent/child hierarchy instead of being flattened to the top level (#3347).
- Fixed the character Lorebook tab so an embedded lorebook can be removed from the card: added a **Remove from card** action (including for cards with no linked copy), clarified that the row delete only unlinks the standalone while the embedded copy stays, and renamed **Edit Linked Lorebook** to **Edit Embedded Lorebook** (#3359).
- Fixed a growing pause after each response completes in long chats: removed two O(n²) passes over the whole message history in the post-generation path (a per-message cachedPrompt eviction scan and the swipe-count lookup), so completing a response no longer takes tens of seconds in very large chats (#3402).

## [2.1.0]

### Added

- Added an in-app documentation viewer: the guides shipped in the `docs` folder (installation, configuration, troubleshooting, macros, extensions, Game Mode, and more) can now be browsed and read inside Marinara via a **Documentation** button in the home page footer next to **Replay Tutorial**, and a new "Where can I find documentation?" FAQ entry that shows the on-disk docs path and opens the viewer (#3238).
- Added Conversation-mode audio/video calls with per-chat call toggles, character-initiated incoming calls, a Discord-style desktop/mobile call surface, call-only chat, speaking highlights, mute/camera/screen-share controls, soundboard support, minimized active-call popouts, call history cards, and post-call summary injection.
- Added Conversation Call message reactions, including user reactions in the call-only chat and hidden character `[react]` call commands that react to the user's latest written call message; character-initiated calls can now include a greeting that plays after the user answers.
- Added Conversation Call character video presence: when enabled, Marinara uses the Default for Videos connection to generate cached avatar-based idle, talking, laughing, angry, crying, and sighing clips, then plays them in-call from TTS cues while returning characters to idle after speech.
- Added per-slot Conversation Call clip generation from Character/Persona editor **Sprites -> Clips** empty/error clip cards, so individual idle/talking/reaction clips can be tested without generating the full batch.
- Added Video Generation services for Google AI Studio (Gemini Omni/Veo), OpenRouter, and Seedance 2.0, including connection defaults, asynchronous job polling, MP4 download handling, OpenRouter first-frame references, Veo first/last-frame avatar interpolation, and Seedance first/last-frame URL references for cleaner generated loops.
- Added Advanced > Video Generation settings for editing Game/Gallery scene-video defaults, Conversation Call clip lengths, and the reusable video prompt templates for Game scene videos and call presence clips.
- Added opt-in custom Conversation Call video clips: when Character Video Presence and Custom Clips are enabled, characters can sparsely use `[custom_clip]` for explicit user-requested visual clips that are saved into that character's **Sprites -> Clips** library.
- Added **Sprites -> Clips** to Character and Persona editors for reusable video-call presence clips, including standard idle/talking/reaction slots and named custom call clips.
- Renamed Gallery clips to **Videos** for broader Roleplay/Game/Conversation generated or uploaded video assets, with Character and Persona Gallery **Images** / **Videos** tabs.
- Added user-uploaded MP4 support for both Gallery **Videos** and reusable video-call clips: Character/Persona **Sprites -> Clips** can replace standard call-presence slots such as Idle or Talking or store extra custom call clips, and custom call-clip libraries now allow up to 128 entries.
- Added animated Expression Engine portrait generation: Portrait sprite generation can use Video Generation connections to create short expression clips, convert them into looping GIF sprites, and save them into expression slots, with Advanced > Video Generation controls for duration and prompt templates.
- Added Conversation call voice input through provider-native audio/video when supported, Local Whisper transcription with downloadable Whisper Tiny/Base models, browser speech recognition fallback, and manual system dictation mode.
- Added xAI as a Text-to-Speech provider option with built-in voice fallbacks and xAI speech request handling.
- Added Conversation mode reactions that can target an individual character's part of a merged multi-character reply, including per-segment add-reaction buttons, per-segment reaction rows, and prompt-visible `[User reacted with ...]` notes under the exact targeted segment (#3210).
- Added character-to-character Conversation reactions through `[react: emoji="..." to "Character Name"]`, placing the reaction on the target character's most recent matching part and showing it in both UI chips and prompt context (#3210).
- Conversation mode: character emoji reactions now have their own **Reactions** card in the per-command Commands grid (Chat Settings and the chat setup wizard), so they can be toggled independently like Selfies or Music (#3219).
- Added the Agent Suite to the Chat Settings drawer's Agents section: a window listing the agents active in the current chat where you can view and edit everything they have stored — agent memory, tracker state, and custom-agent outputs — manually or with AI-assisted rewrites (select text, give an instruction, optionally attach grounding context such as character cards or active-lorebook entries, and pick a connection) (#3160).
- Added first-class scene video generation for Game Mode, Roleplay, and Visual Novel galleries, including Video Generation connections for Gemini Omni and xAI Imagine, editable `game.video` prompts, manual Gallery video actions, per-image Animate buttons, Gallery video previews with prompt copy, live View Latest media, and draggable/resizable pinned video overlays.
- Added Game Mode turn storyboards: the active storyboard prompt preset splits completed GM narration into anchored keyframes, renders keyframe media concurrently, follows the current story section in a draggable/resizable viewer, can be reopened from Gallery, and supports off-by-default **Automatic Storyboard Animations**.
- Added per-chat Game Mode media prompt presets with separate **Illustration Prompt**, **Animation Prompt**, and **Game Video Prompt** selectors, read-only built-ins for Still Keyframes, Comic Page, Colored Manga, B&W Manga, and Cinematic Scene Video, plus chat-local editable copies.
- Added Gallery **Images** and **Videos** tabs so generated videos are reachable without scrolling through every still image first.
- Added an optional Game Illustrator toggle for Dynamic LLM Prompt Generation, letting the selected prompt model rewrite Game Mode NPC portrait, location background, and key-moment illustration prompts before image generation (#3225).
- Added `/illustrate` in Conversation, Roleplay, and Game chats to trigger the same illustration action as the Gallery **Illustrate** button without opening the Gallery first.
- Turn-game bots now choose their moves in character (#3308): move selection is steered by the character's personality, mood, and grudges instead of pure game logic, and UNO board summaries include a "What just happened" recap of recent plays so reactions track the actual game.
- Characters seated in a turn game now carry their own seat's perspective into normal chat (#3308): mid-game replies know their own UNO hand or chess color and last move, spectators and unseated characters keep a hands-hidden view, and each generation request loads the game state once instead of once per responding character.
- Turn-game hand secrecy is now personality-gated (#3308): in hidden-information games a seated character knows their hand is private and may deflect, tease, bluff, or let something slip according to their personality, while in open-information games like chess the same treatment applies to their plans.

### Changed

- Bumped release metadata to v2.1.0 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Documented Conversation audio/video call setup, Local Whisper download, audio input modes, character-initiated call behavior, reusable video-call clips, and Professor Mari's built-in guidance for the feature.
- Refreshed the v2.1.0 documentation set with current setup flows, provider lists, Bot Browser sources, Agent Suite behavior, knowledge sources, custom tools, emoji/sticker uploads, regex scripts, prompt presets, macros, Conversation/Roleplay/Game Mode workflows, Home Assistant setup, remote access, extension safety, container/iOS/Android update notes, storyboard/video guidance, and the current architecture map.
- Made Android/Termux update builds use low-memory build wrappers: server builds transpile runtime JS with esbuild, client builds skip memory-heavy typechecking/PWA generation on Android, and the updater builds shared, server, and client sequentially on Android devices (#3156).
- Removed the Gallery **View latest** button because galleries already show newest images and videos first.

### Fixed

- Fixed root-level Connections panel dragging by adding a Custom sort order backed by saved `sortOrder`, so unfiled connections can be reordered or moved into folders the same way foldered connections can (#3295).
- Fixed merged group Conversation autonomous-message accounting so the selected autonomous character receives the saved message attribution, follow-up count, and daily-budget count instead of every turn being charged to the first group member (#3299).
- Fixed launcher startup messages on Windows, macOS/Linux, and Termux so they show the configured bind host instead of always claiming `127.0.0.1`, while still printing/opening a browser-friendly local URL when the bind host is `0.0.0.0` (#3300).
- Fixed Game Assets create menus inside the in-game floating asset browser so portaled New menus and create modals no longer close the browser, empty names cannot be submitted, and failed create actions keep the modal open with the error visible (#3301).
- Improved mobile browser compatibility by lowering the production client bundle target for Safari and replacing newer `Array.prototype.at` / `replaceAll` usage in shared/client code paths that older iOS Safari versions may not provide (#3302).
- Fixed Game Mode background selection from Settings so a manually selected chat background overrides automatic GM scene background selection until the user removes it (#3304).
- Fixed character library favorites and non-favorites filtering so server-side pagination searches the full library before returning each 100-item page, and kept the **Load more** control in a bottom footer instead of overlapping character cards in both the side panel and full library (#3286).
- Fixed Roleplay `/as` so `/as Character "message"` posts the exact message as that character, while bare `/as Character` still asks the model to generate that character's next response.
- Fixed Roleplay tracker locks so AI tracker updates cannot bypass a locked field by renaming or replacing the locked row at the same position.
- Fixed Game Mode NPC portrait generation so GM-created NPC profile descriptions from initial world setup are rebuilt from current game state at asset-send time, sent as required canonical visual guidance for portrait prompts, and preserved when generated avatars are written back to NPC metadata.
- Fixed launcher startup ordering so `.env` values such as `BACKGROUNDREMOVER_AUTO_INSTALL=true` are loaded before optional background-remover setup begins (#3269).
- Fixed Home Assistant documentation and defaults to point at Marinara's current port, note `WEBHOOK_LOCAL_URLS_ENABLED=true` for local webhooks, and explain that re-syncing updates existing generated tools.
- Added delete controls to Character/Persona Gallery **Videos** and **Sprites -> Clips**, including call-video resets plus custom call clip and scene/game video cleanup from the originating stored media.
- Forced generated Conversation Call character video clips to play silently in calls and **Sprites -> Clips** previews so provider-generated audio tracks cannot overlap Marinara's TTS playback.
- Fixed Google AI Studio Veo reference-image clip generation by retrying with Google's alternate `bytesBase64Encoded` image payload when a Veo model rejects `inlineData`, preserving avatar first/last-frame loop requests.
- Fixed Conversation Call video clips continuing to use stale avatar references by fingerprinting the actual avatar bytes for standard clip freshness and cache-busting regenerated `idle`/`talking`/reaction MP4 URLs.
- Shortened default Conversation Call video-clip prompts so providers get crisp locked-camera loop instructions instead of long identity-preservation prompts that could invite camera drift.
- Fixed **Sprites -> Clips** call-clip generation status so stale `generating` slots from older jobs no longer light up when only one clip, such as Idle, is being generated; Google Veo video extraction now also accepts more completed-operation shapes and reports provider no-video reasons.
- Revised the default Conversation Call video-clip prompts using Google's Veo guidance so clip generation now gives providers explicit composition, subject identity, action, ambiance, locked-camera, looping, and focus instructions.
- Fixed **Sprites -> Clips** call-clip prompts to use the provider-effective clip duration, so Google Veo avatar-reference clips now ask for the same 8-second loop length that Veo actually generates.
- Trimmed Conversation Call video-clip prompts to avoid hard-coded lighting/ambiance and audio-related wording, making avatar-reference clips depend on the uploaded reference image instead of invented call-scene details.
- Added non-destructive trim points for Conversation Call clips, with a small **Sprites -> Clips** trim editor and in-call playback that loops inside the saved start/end range.
- Added a dismissible 10-second muted-microphone reminder when a Conversation Call starts, made **Sprites -> Clips** call-clip pre-generation queue provider requests one clip at a time, removed character-card description dumps from call-video generation prompts, strengthened locked-camera/reference-image loop instructions, and made standard call-video clips regenerate when the character avatar changes.
- Fixed Seedance 2.0 completed video jobs so Marinara reads MP4 URLs returned in `data.results[]` instead of reporting a missing downloadable video.
- Added an opt-in Seedance 2.0 temporary reference-frame upload toggle under **Default for Videos** in Video Generation connections, so local avatar/gallery first/last-frame references can be uploaded to temporary public URLs when Seedance cannot fetch local Marinara files directly.
- Fixed group-chat character reactions always being credited to the first character in the chat: commands placed above the first `Name:` line of a merged reply now attribute to the speaker whose section they open (leaked `[HH:MM]` timestamps no longer skew this), merged group chats now instruct models to write the `[react:]` tag inside the reacting character's own section — and that several characters may react in the same reply — and a react aimed at the user's persona name (or "User") explicitly targets the user's latest message (#3220).
- Hardened Conversation reaction processing against stalls and junk: the shared timestamp strip is no longer quadratic on pathological whitespace runs (~7s → <1ms at 100KB), each `[react:]` command persists with far fewer storage scans so multi-react group replies no longer block generations for seconds on large installs, malformed quote-bearing react tags stay visible instead of becoming junk text chips, and per-segment add-reaction buttons mount their emoji picker only while open.
- Fixed Conversation Call video-clip avatar framing by preparing call-video references as top-aligned 16:9 frames before provider upload, reducing head/hair cropping when Seedance or other video providers animate square avatars.
- Loosened Conversation Call talking-clip prompts so providers can animate natural speaking motion beyond mouth-only movement while keeping the camera, framing, and loop return stable.
- Loosened Conversation Call reaction-clip prompts for laughing, angry, crying, and sighing states so providers can create smoother natural motion while preserving the locked camera, identity, accessories, and loop return.
- Aligned Conversation Call reaction-clip prompts with the successful Talking/Idle prompt shape: one smooth restrained video-call motion, subtle breathing/body/expression motion, and a return to the first-frame pose by the final frame.
- Tightened Conversation Call custom clip generation so the command prompt becomes the clip action, the action returns to the starting pose by the final frame, and Seedance receives explicit first/final avatar references even when both frames are identical.
- Sequenced Conversation Call character video clips from ordered TTS cues, so lines like `[sighs] I thought so [soft laugh]` play sighing, talking, and laughing clips in order instead of using one reaction clip for the whole voice turn.
- Improved Seedance 2.0 task-failure handling by extracting provider failure reasons from more response fields, logging compact failed task payloads, and retrying once when Seedance only reports an opaque unknown operation error.
- Fixed lorebook entry rows collapsing when editing the entry title by making row-header inline controls opt out of the expand/collapse click handler (#3244).
- Capped NanoGPT image-generation reference payloads at three images so Qwen Image/edit-capable NanoGPT models only receive the number of references those services accept.
- Fixed Windows dark-mode contrast for prompt/chat preset dropdown option menus so preset choices no longer render as pale text on a white native popup (#3237).
- Fixed Roleplay empty-input generation so pressing Generate after an assistant reply renders the new assistant output as its own bubble, while explicit `/continue` still appends to the previous assistant message.
- Fixed Roleplay `/continue` with tracker agents enabled so late tracker/cache refreshes no longer restore the previous assistant text and make the continued output vanish.
- Fixed Conversation call prompt assembly so call output JSON format and command instructions stay attached to the latest call input, adjacent same-role call history messages are merged, older TTS cue tags are stripped from call history, command turns use the same descriptive command guidance as normal Conversation mode, and `[end_call]` waits until prior voice lines finish before ending the call.
- Fixed Conversation call command execution so hidden commands such as selfies, memories, music, haptics, influences, notes, soundboard actions, character leave, and call end are executed as call actions instead of leaking into the visible call chat.
- Fixed Conversation call media and UI reliability by keeping speech-only transcripts out of the visible call chat, returning server-resolved character IDs for playback, preserving active calls while navigating elsewhere in Marinara, stacking the call popout with Professor Mari, improving mobile control scaling/participant tiling, and keeping offline characters out of calls.
- Fixed group Conversation calls so each speaking character is prompted as its own ordered turn, server voice-capability checks match the call playback resolver more closely, and accidental voice turns for characters without a resolvable voice fall back to visible call text instead of disappearing.
- Fixed Conversation Call video prompts so generated standard/custom character clips rely on the current avatar/reference frame and concise action/loop instructions instead of stale or overlong character-card dumps, helping video providers preserve visual constraints such as masks or hidden eyes from the reference.
- Fixed Conversation Call prompts so calls with character video presence enabled explicitly tell the model that voice turns are paired with video-call clips.
- Strengthened Conversation Call and animated Expression portrait video prompts so generated clips preserve identity/outfits/framing and return to matching first/final frames for cleaner loops; reaction call clips now default to 5 seconds.
- Fixed the Connections panel Local Model card so a downloaded/running Local Whisper speech model is shown in the collapsed status instead of reporting the whole card as not downloaded when the Gemma helper model is absent.
- Fixed 1:1 Conversation prompt history so assistant turns are speaker-labeled with the character name, preserving multi-turn user/assistant roles while making prior DM replies unambiguous to the model.
- Prevented Echo Chamber from triggering on `/continue` generations; it now stays limited to fresh user messages rather than assistant continuation rewrites.
- Fixed agent pipeline phase overrides so changing built-in agents such as Echo Chamber, Prose Guardian, Continuity, Immersive HTML, Expression, or Music DJ in the agent editor is respected in storage, normal generation, and manual agent retries instead of being forced back to a built-in default.
- Fixed Android APK chat background imports by allowing WebView picker-granted `content://` image URIs and handling Android multi-select file picker results safely instead of returning null picker entries (#3233).
- Fixed the Mari CLI flag parser so boolean flags such as `--tail`, `--raw`, `--patch`, `--strict`, and `--staged` no longer swallow positional arguments in commands like `mari chats messages --tail <chat-id>` (#3222).
- Fixed Local Whisper availability after updates by adding a post-install native dependency repair step that rebuilds or refreshes `onnxruntime-node` for the Node architecture used to run Marinara, and documented the repair path for Windows, macOS/Linux, and Termux installs.
- Renamed the editable scene-video prompt template from `game.omniVideo` to `game.video`, with legacy override fallback, and shortened scene-video prompts for smaller video providers by summarizing narration into a compact story beat, excerpting source illustration prompts, and loosening default motion guidance.
- Fixed escaped roleplay HTML such as `&lt;font color=...&gt;` rendering as visible code by decoding allowed escaped tags before the existing sanitized HTML render path (#3206).
- Fixed Professor Mari preset creation so structured `app_data` `preset.create`/`preset.update` commands can create prompt groups, prompt sections, and preset variables/choice blocks in the same reversible operation (#3207).
- Added a root `pnpm mari -- --help` wrapper that exposes the built Mari CLI from source checkouts without requiring a global install or manual shell alias (#3208).
- Fixed impersonate prompt assembly so fallback chat presets still drop conflicting non-marker sections, while explicitly selected impersonate presets keep their normal prompt sections (#3209).
- Fixed Smart group response order so hidden responder selection no longer overrides `/guided` or `/impersonate` directives in Roleplay group chats (#3212).
- Fixed stopped partial replies being cache-only placeholders, so editing a kept unfinished reply persists it as a real message instead of deleting it on refresh (#3213).
- Fixed Game Mode party recruitment for mid-session NPCs by creating a game-scoped tracked NPC/card fallback instead of throwing when the NPC was not generated at setup (#3216).
- Fixed starting the next Game Mode session when backup branches exist by using the active concluded session as the source and preventing branch labels from carrying into newly created sessions (#3229).
- Removed the hard-coded three-sprite limit from Roleplay sprite selection, setup, and display paths so chats can enable all uploaded sprite owners they need (#3169).
- Let Image Captioning use any non-image-generation connection instead of hiding local or custom multimodal models behind model-name heuristics (#3170).
- Stabilized emoji and sticker popover positioning above the mobile composer when Android browsers resize the visual viewport around the keyboard (#3171).
- Switched Persona editor textarea counters from raw character counts to the same approximate token counts used elsewhere in the UI (#3172).
- Fixed Illustrator prompt tag cleanup so grouped weighted tags such as `(shaved head, bald:1.2)` stay intact during deduplication and negative-prompt extraction (#3173).
- Fixed Windows server builds failing from install paths with spaces by launching the TypeScript compiler through Node directly instead of a shell-resolved shim.
- Restored chat input and generation cleanup behavior so post-generation agents such as Illustrator keep the UI busy state without leaving a duplicate live-stream message visible, and preserved textarea caret position while quote formatting runs on apostrophes.
- Removed the agent/tool write-path size cap on lorebook entry content so large entries are no longer truncated before storage.
- Fixed readable text-file attachments being pre-truncated to 60,000 characters before prompt context fitting, so large uploaded text files can use the selected model's actual context window.
- Fixed Termux dependency refreshes so Android installs that add the `wasm32` optional-dependency architecture run `pnpm install --force`, allowing `@img/sharp-wasm32` to be linked for sprite generation and other sharp-backed image processing (#3167).
- Fixed Android/Termux git updates aborting during release rebuilds with exit status 134 by making the default package build scripts Android-aware and documenting the low-memory update path (#3156).
- Fixed `pnpm install --frozen-lockfile` failures with `ERR_PNPM_TRUST_DOWNGRADE` for older locked dependencies such as `pino` and `semver` by disabling trust-downgrade enforcement for released Marinara installs.
- Fixed partial installs after aborted pnpm runs so launchers detect missing workspace dependencies such as `chess.js` and repair `node_modules` before shared builds run.
- Fixed non-interactive launcher, installer, and in-app updater installs so pnpm can purge and recreate stale dependency folders without stopping for a TTY confirmation prompt.
- Hardened `start.bat` so the Windows launcher explicitly repairs dependencies and runs the root `pnpm build` whenever updates, version mismatches, commit mismatches, or missing build outputs require it, using Corepack/installed pnpm/temporary npx pnpm as available.

### Platform Notes

- Android `versionName` is `2.1.0` with `versionCode 29`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.9]

### Added

- Added Chess as a Conversation-mode table game, including setup UI, move validation, board state, and model/bot play support.
- Added Image Captioning in Advanced Parameters so chats can describe image attachments through a chosen vision-capable connection before sending them to non-vision models.
- Added an Anthropic connection toggle for extended 1-hour prompt-cache TTLs when users want cached context to survive longer between turns.

### Changed

- Converted Immersive HTML from static main-prompt injection into a Roleplay post-processing rewrite agent that works alongside Prose Guardian and Continuity Checker, preserving story meaning while adding diegetic HTML/CSS/JS visuals (#3094).
- Increased default image-generation and ComfyUI polling timeouts so slower image editing and local/remote workflows have more room to finish.

### Fixed

- Fixed continue generation with rewrite agents so continued assistant messages are rewritten from the full merged message instead of being overwritten by only the new continuation text.
- Added backoff for failed conversation summaries and server-side autonomous generations so permanent 4xx/model errors no longer retry every poll forever, while keeping stored failure metadata sanitized and bounded.
- Fixed staging updates so Settings can target the current checkout branch, staging applies create/update a real local `staging` branch, and Windows/macOS/Linux/Termux launchers no longer drag staging installs back to stable `main`.
- Expanded Professor Mari data commands with paginated chat message offsets, full lorebook entry lookup by entry id, entry descriptions in lorebook entry lists, and entry tag support for add/update flows.
- Polished mobile input controls by using a paperclip attachment icon in Conversation mode, placing Game mode attachments before the address selector, hiding Roleplay's mobile emoji button, and tightening Game/Roleplay composer spacing.
- Fixed migrated default agent prompts causing roleplay lag by keeping compatible agents batched with a raw JSON result map instead of wrapping JSON-only prompts in `<result>` tags, and made the default-prompt migration stop rewriting already-current named prompt options on every startup.
- Fixed agent UI flicker by scoping agent processing and failure badges to the chat that owns the run, and stopped ChatArea from repeatedly auto-switching Game chats to the newest session during chat-list refreshes.
- Reduced background request churn by stopping synced themes/extensions from polling every 15 seconds and slowing Professor Mari workspace status refreshes outside explicit workspace actions.
- Fixed rewrite-agent notification timing so held assistant messages keep their post-processing marker until the final rewritten text lands.
- Fixed failed send/generation recovery so timeout-style failures restore the submitted draft, completions, and attachments for retry.
- Hardened prompt regex scripts against polynomial ReDoS by rejecting chained broad unbounded patterns and guarding long server-side replacement runs with a VM timeout.
- Improved profile/backup ZIP import diagnostics when the selected archive does not contain `marinara-profile.json`.
- Tightened Android Firefox chat input sizing so the mobile composer grows less rigidly and leaves more room for typed text.
- Shortened mobile Roleplay and Conversation composer placeholders so command hints do not wrap and pull the input caret upward.
- Fixed XML prompt wrapping so user-authored `>` characters, including Markdown blockquotes, reach the model as typed while `<` and `&` remain escaped for prompt-boundary safety (#3108).
- Fixed legacy Immersive HTML built-in configs so stock saved prompts, descriptions, phases, and result settings migrate to the new post-processing defaults instead of showing the old static prompt.
- Added hold-until-rewrite support for Immersive HTML, pinned it to JSON text-rewrite parsing, counted it as a real post-processing call in agent load estimates, and bundled Prose Guardian, Continuity Checker, and Immersive HTML into one rewrite pass when multiple built-in rewrite agents are active.
- Added mobile chat composer minimization while scrolling through older messages, with automatic restore near the bottom, on downward scroll, or when the minimized input is tapped (#3091).
- Fixed branch switching so a valid selected branch is not cleared just because the flat chat list briefly does not include it while detail/group caches are resolving (#3087).
- Fixed provider requests so blank custom `model` parameters cannot erase the configured model, and corrected missing-model error guidance for MiMo/OpenAI-compatible endpoints (#3110).
- Reduced tracker-panel freezes on chats with world-state/character-tracker agents by scoping tracker character/persona lookups to the active chat and containing off-screen tracker card rendering (#3104).
- Reduced ChatArea render stalls by scoping chat character/persona, creator-notes CSS, and Conversation emoji/sticker lookups to the active chat instead of full libraries.
- Lowered the mounted transcript render window in Conversation and Roleplay modes so long loaded chats keep fewer message components mounted at once.
- Fixed giant imported libraries by paging character, persona, lorebook, full-library, and chat sidebar lists in 100-item batches with Load More controls, while keeping search routed across the full matching data set (#3153).
- Fixed Debug Mode and Peek Prompt previews for `/guided` so the generated narrator instruction resolves macros like `{{user}}` the same way the real generation request does (#2906).

### Platform Notes

- Android `versionName` is `2.0.9` with `versionCode 28`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.8]

### Fixed

- Slowed custom cursor recoloring during Accent Pulse/RGB Mode and skipped cursor recolor work entirely when Marinara's custom pointer is disabled.
- Hardened Windows, macOS/Linux, and Termux launcher updates so generated feature registries keep LF line endings on Windows, launchers stash untracked local files, main/detached installs reset to the exact fetched `origin/main` commit when a normal fast-forward refuses, and Git's real error prints if updating is still blocked.
- Fixed the Android APK blocked-Termux fallback so it copies a full Marinara setup command instead of telling fresh Termux users to run a missing `./start-termux.sh`, and made the copied `allow-external-apps` command tolerate Termux builds without `termux-reload-settings`.

### Platform Notes

- Android `versionName` is `2.0.8` with `versionCode 27`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.7]

### Added

- Added structured no-shell Professor Mari `app_data` actions for character, persona, lorebook, lorebook entry, and theme reads/creation/updates so local models no longer need to compose `mari ...` shell commands for common creative data work.
- Added an Android APK console shortcut under Settings > Advanced > Debug mode that opens Termux for server logs, while non-mobile-shell installs show disabled guidance (#2922).
- Added lorebook semantic-search controls for vector query message depth, score threshold, and per-lorebook vector result limits, plus Active Context vector badges and scores for semantic lorebook hits (#2923, #2924).
- Added a prominent Connections warning that the bundled Local Model is intended for tracker/helper work, not main chat, roleplay, Game Master narration, or Professor Mari creation tasks.
- Added an explicit Local Model connection option for Professor Mari and non-Game chat generation paths when the sidecar model is downloaded, for users who still want to route main chat/roleplay requests through it.
- Added persisted drag-and-drop ordering for custom Functions in the Presets panel, including desktop hover handles and mobile touch dragging.
- Added a Game Illustrator Chat Settings toggle for automatic visual generation plus a Gallery Background action for Roleplay and Game scenes that creates a background-only image, applies it to the current scene, and saves it into the Appearance background library.
- Added a Game mode decision-step branch button on the latest narration/dialogue beat so players can fork before choosing their next action.
- Added customizable RPG stat pools for characters, personas, and Game character sheets so HP-like bars such as HP, MP, EP, or Sanity can be added, colored, tracked, and passed into Present Characters/agent context (#3077).
- Added a per-chat Illustrator Prompt Model override in Chat Settings so selfie and illustration prompts can be written by a different text connection than the main chat model (#2969).
- Added an Advanced > Message Tools toggle to include saved reasoning/thinking in chat exports; exports now omit reasoning by default unless the toggle is enabled.
- Added a built-in `web_search` function-call tool under function selection so chats and agents can fetch compact current web results without custom webhook setup (#3074).
- Added an Appearance > App Style toggle for Marinara's custom mouse pointer, made cursor rules theme-overridable, and recolored the custom pointer from the live Accent Color so RGB Mode and Accent Pulse animate it too. Cursor recoloring now pauses briefly during wheel scrolling so scroll repaints keep one stable custom cursor image instead of flickering, doubling, or jumping at scroll limits.
- Added a startup migration that detects built-in agents still storing untouched pre-2.0.0 default prompt text and moves them back onto the live default prompt path so they receive current default prompt updates automatically.

### Fixed

- Fixed Professor Mari structured app-data creation so new characters, personas, lorebooks, lorebook entries, and non-activating themes save directly without a preview/approval loop.
- Changed Professor Mari reversible app-data edits to save first and show an in-chat Keep/Restore review card instead of making Mari ask the user conversationally about `apply:true` or `apply:false`.
- Fixed recursive macro parsing so character/persona field macros like `{{description}}` resolve nested macros such as `{{char}}` and `{{user}}` when used from prompt builder sections (#2925).
- Fixed memory-recall and agent prompt blocks so `{{char}}`, `{{user}}`, and related prompt macros resolve inside `<memories>` and `<agents>` payload sections (#2927).
- Fixed Illustrator image prompts in tagged/danbooru profiles so illustration, background, and selfie prompts preserve the generated tag list instead of being compacted/distilled like portraits (#2929).
- Fixed chat lists sorted by newest/oldest so simply opening a chat no longer moves it to the top; recency now follows the newest saved message instead of chat-open touches or settings metadata (#2926).
- Fixed Spotify DJ playlist and search tools so malformed model-supplied `limit` values are clamped before Spotify receives them, avoiding `Invalid limit` API errors.
- Fixed RGB accent mode so opening the Appearance settings tab no longer pauses the live rainbow cycle and snaps the app accent back to the first color.
- Fixed Game mode Journal subviews so Timeline, NPCs, Notes, and other tabs scroll inside the Session panel on both mobile and desktop (#2921).
- Fixed TogetherAI image-generation URLs so full `/images/generations` endpoint URLs are not doubled when requests are sent.
- Fixed legacy Extended Descriptions persona migration to explicitly keep the generated lorebook attached to the source persona.
- Fixed Roleplay empty-submit continuation so pressing Enter after an assistant message creates a separate regenerable assistant response, while `/continue` remains the append-to-previous-message path (#2920).
- Removed the unused Quick Replies "Group consecutive messages" setting that no longer affected chat rendering (#2920).
- Fixed Professor Mari's lorebook helper text so `update-entry <entry-id>` and `delete-entry <entry-id>` explicitly refer to lorebook entry IDs, reducing accidental use of parent lorebook IDs.
- Fixed `EXTENSIONS.md` so it documents SillyTavern-style extension folders and JavaScript behavior extensions, not only CSS styling.
- Fixed v2.0.7 version metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.
- Fixed regex scripts so display-side replacements share the server safety gate, macro values in Find are treated as literal text, macro values in Replace are not reinterpreted as replacement grammar, random Replace macros resolve once per script application, invalid flags/depth ranges show actionable validation, imports continue past bad entries with skip reasons, SillyTavern display placements import deliberately, a new Apply Mode radio supports prompt-only/display-only/both with legacy `promptOnly` migration, and script ordering/reorder writes remain stable across scoped and global scripts (#2931, #2933, #2934, #2935, #2936, #2937).
- Fixed macro conditionals so numeric comparisons (`>`, `<`, `>=`, `<=`) evaluate numerically instead of falling through as truthy text, `{{else if}}` chains and macro-bearing conditions parse without leaking raw tags, random/dice macros resolve consistently for the same message seed, and runaway nested macro expansion is capped alongside reversed `{{random:X:Y}}` ranges and zero-sided `{{roll:Xd0}}` rolls (#2938, #2939, #2940, #2942, #2943).
- Fixed group-chat join/leave markers so removing a character refreshes the visible transcript immediately and prompt previews keep the "has left the chat" event in the correct chronological position (#2901).
- Fixed the Mini Mari surprise visit toast so its custom layout includes a dismiss button like other app toasts.
- Fixed Browser back controls so they use the same icon-only editor-exit button style as card editors.
- Fixed desktop drag handles in resource panels so draggable cards reveal their grip on row hover, agents expose a matching grip, and regex rows stop showing the grip constantly.
- Fixed `{{agent::TYPE}}` prompt macro insertion so model-generated agent/tracker output is inserted as inert text instead of being re-run as dice, variable, or other macros (#2941).
- Fixed shared theme and extension CSS safety so active themes, live preview, extension CSS, and extension `addStyle()` calls strip external network/script CSS constructs before injection (#2944).
- Fixed extension imports so raw files and loose folders land disabled for review, JavaScript extension enabling asks for explicit confirmation, theme/extension deletion asks for confirmation, extension handler errors name the responsible extension, and toggling/editing one extension no longer restarts every other enabled extension (#2945, #2946, #2948, #2952).
- Fixed synced theme hardening and migration/import diagnostics by adding the extension-style privileged write gate, a 256 KiB theme CSS cap, per-entry theme import skip reasons, and legacy-theme migration backoff/permanent-error handling (#2947, #2953, #2954).
- Fixed card CSS sanitizing so app theme token protection includes popover/sidebar tokens and nested conditional at-rules preserve all outer conditions when scoped (#2950, #2951).
- Fixed client TTS sequencing so failed chunks no longer discard successfully generated audio, and added a saved Progressive Playback option for local/self-hosted TTS backends to start playback while later chunks are still being fetched (#2949).
- Fixed manual Gallery background generation so UI debug mode logs the final image prompt sent to the provider.
- Fixed Spotify mini-player startup noise so disconnected Spotify state no longer polls playback endpoints, and Spotify's Web Playback SDK only loads after the user asks to use Marinara as the playback device.
- Fixed chat tool resolution so Spotify tools stripped from provider prompts when Spotify is unavailable are also removed from the runtime allow-list, producing the intended "Tool not allowed" denial for hallucinated Spotify calls (#3020).
- Fixed preset and prompt edge cases so conversation memories are no longer destructively pruned by daily awareness filtering, imported/duplicated presets preserve `defaultChoices`, grouped Chat History markers keep message boundaries, user-edited bundled presets are not wiped by seed refreshes once a snapshot baseline exists, prompt override defaults avoid ambiguous reverse-substitution collisions, preset variable option edits use the in-flight local option list, stored preset parameters are validated before provider use, and Dry Run preserves `topP=0` like real generation (#3022, #3023, #3024, #3025, #3026, #3027, #3028, #3029, #3030).
- Fixed provider, connection, persona, folder, schedule, and impersonation edge cases so provider finish reasons survive Gemini/Anthropic/OpenAI/ChatGPT paths, Anthropic cache breakpoints stay on attachment-only turns, Local Model sampler parameters respect per-request values, connection mutation responses mask encrypted API keys, provider-category changes keep one agent default, manual model edits preserve max-output overrides, deleted characters/personas leave folders clean, stale persona activation returns 404 without clearing the active persona, character group avatars can be set, persona versions include saved status options, object-form imported persona stats survive import, conversation schedule generation uses queued metadata patches, manual conversation replies do not consume autonomous follow-up slots, in-turn group replies keep Name Prefix History context, and inline custom impersonate placeholders no longer drop whole instruction lines (#3033, #3034, #3035, #3036, #3037, #3038, #3039, #3040, #3041, #3042, #3043, #3044, #3045, #3046, #3047, #3048, #3049, #3050, #3051, #3052).
- Fixed Chat Summary placement so enabled summaries automatically append to the end of the system prompt when the active preset has no enabled Chat Summary marker, while presets with an enabled marker still control the exact insertion point.
- Hardened prompt assembly against XML/Markdown block-boundary prompt injection by escaping untrusted character/persona card text, chat history, summaries, lorebook text, recalled memory, awareness snippets, post-history instructions, and agent-result leaves before they enter engine-authored prompt wrappers.
- Hardened custom script tool execution so enabled script tools no longer receive host-realm intrinsics that could expose server globals such as `process`, and clarified that the opt-in is for trusted in-process scripts only.
- Fixed chat JSONL exports so hidden reasoning is emitted once instead of duplicated through message and swipe metadata, and stale NPC journal rows from unrelated Game chats are filtered from exported `gameJournal` metadata.
- Fixed Roleplay smart group response selection so an empty selector result falls back to a valid character instead of aborting with "No response queue was created", and incomplete auto-created DM chats are cleaned up instead of remaining as empty orphaned chats (#3019).
- Fixed Game mode History Above VN rows so stacked history messages expose the same copy, delete, edit, branch, and NPC portrait actions as the full Logs view.
- Fixed a Game mode History Above VN visual jump when deleting a stacked narration beat by holding the stacked history shell height during the delete frame.
- Fixed lorebook data edge cases so approval-gated Keeper updates append instead of overwriting entries, drawer autosaves stop clobbering header edits, nested explicit replacements still replace, character-linked lorebook sync preserves entry names/descriptions/settings, bulk imports validate folders before writing, moved entries clean up failed target copies, and entry-row optimistic toggles roll back on failed saves (#2970, #2971, #2972, #2977, #2978, #2980, #2981).
- Fixed lorebook matching and scanning so whitespace-only keywords do not match everything, whole-word matching handles non-ASCII word characters, per-lorebook recursion depths below 3 are honored, sticky carry-over does not spend ephemeral activations, and invalid create-time scope conflicts are rejected (#2973, #2974, #2975, #2976, #2979).
- Fixed chat branching so unknown cutoff message IDs are rejected instead of silently copying the full chat, every alternate swipe is preserved, active swipe indexes survive, and Game/turn-game snapshots are copied to the matching branched swipe (#2956, #2962).
- Fixed swipe persistence races so structural swipe edits, generation extras, retry-agent extras, CYOA choices, sprites, attachments, and thinking data target the correct swipe even when users switch swipes while generation is finishing (#2960).
- Fixed regenerated swipes so translations, sprites, choices, token counts, Gemini parts, attachments, and other old-swipe metadata do not leak onto the fresh swipe (#2958).
- Fixed message editing so no-op saves no longer rewrite punctuation/whitespace, empty edit saves are ignored, and classic Conversation edits preserve the raw saved name/timestamp prefix instead of saving the stripped display copy (#2957, #2959).
- Fixed imported Game JSONL transcripts so manual narration edits in `mes` override stale active-swipe content and imported source `gameId`/scene pointers are remapped or stripped so branch imports cannot drive another campaign's sessions (#2966).
- Fixed turn-game engine cleanup so UNO/turn-game state is deleted when messages, chats, groups, or swipes are removed, preventing orphaned game state from resurfacing later (#2961).
- Fixed conditional macros for persona cards by adding persona field operands/macros such as `personaDescription`, `personaPersonality`, and related fields to the shared macro engine (#2964).
- Fixed Android Firefox mobile keyboard layout by sizing the mobile shell from the visual viewport and nudging chat input bars into view after keyboard focus (#2965).
- Fixed swipe counter flashes after regenerate/switch by preserving cached swipe counts and moving optimistic swipe content/extra together with the active index (#2963).
- Fixed Peek Prompt display so the Chat History section only shows user/assistant turns and no longer repeats system prompt/history wrapper content already shown in separate prompt sections.
- Fixed agent retry and generation edge cases around Local Model sidecar fallback, built-in default tools, runtime phase normalization, retry persona/wrap-format parity, noncritical pre-generation failures, Spotify retry fallback, edit-message retry tools, lorebook-update permissions and scoping, Lorebook Keeper error isolation, message-scoped tracker effects, atomic Illustrator attachment appends, batch result parsing, text-rewrite markup preservation, JSON repair, custom-agent run listing/limits, sprite expression variants, and Custom Music DJ reset state (#2983, #2984, #2985, #2986, #2987, #2988, #2989, #2990, #2991, #2992, #2993, #2994, #2995, #2996, #2997, #2998, #2999, #3000, #3001, #3002).
- Fixed custom tool and built-in tool-call edge cases so rich parameter schemas round-trip through the editor, blank webhook/script tools cannot be saved, built-in name collisions are rejected, empty schemas represent zero-argument tools, malformed nested parameter schemas are skipped before provider calls, textual tool-call parsing handles arrays in tags and closing-tag text inside string arguments, edit-message replacements are not capped at the summary append limit, chat variable caps are enforced inside the metadata write queue, automated summary entries are bounded safely, lorebook-entry keys/modes are normalized without data loss, and Spotify volume falls back on invalid input (#3005, #3006, #3007, #3008, #3009, #3010, #3011, #3012, #3013, #3014, #3015, #3016, #3017).
- Fixed image and asset safety edge cases so image-prompt negation only moves the directly negated clause, local music file serving uses the same privileged gate as the folder picker, bundled native game assets cannot be deleted or moved through bulk routes, sprite-sheet grid dimensions validate before provider calls, reference images keep their real MIME type on chat-completions image backends, RunPod ComfyUI observes abort signals and rejects corrupt fallback image data, and chat/global gallery uploads validate real image bytes without leaving partial files or phantom-chat orphans (#3054, #3055, #3056, #3057, #3058, #3059, #3060, #3061, #3062, #3063).
- Fixed mobile UI edge cases so Roleplay exposes the emoji picker on phones, composer emoji/GIF/sticker popovers clamp to short viewports, resource-panel action pills no longer cover row text, Spotify/media floating widgets stay reachable and below open mobile panels, Game Assets toolbar menus stay onscreen, and Game narration/readable copy actions are available on mobile (#3065, #3066, #3067, #3068, #3069, #3070, #3071).
- Fixed Game Lorebook Keeper books carried from previous Game sessions so explicitly linked keeper lorebooks remain eligible for constant/keyword triggering in later sessions instead of being blocked by the old session chat ID (#3073).
- Fixed Peek Prompt display so prompt/system sections surrounding Chat History stay visible while the Chat History block itself still lists only user and assistant turns.
- Fixed `/impersonate` persona-description insertion so macros inside the persona description resolve before the impersonation instruction is appended (#3081).
- Fixed regex import safety checks so optional `?` quantifiers do not incorrectly increase star height and reject valid patterns such as `(a+)?` (#3080).
- Fixed Author's Notes autosave on fast chat switches so an outgoing chat cannot save the incoming chat's note text under the wrong chat ID (#3079).
- Fixed Game Widget setup fields so label/stat drafts can be cleared or contain trailing spaces while editing, with normalization deferred until save/import/export (#3078).

### Platform Notes

- Android `versionName` is `2.0.7` with `versionCode 26`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.6]

### Added

- Added a synced custom theme Accent Pulse opt-in so CSS themes can request the built-in pulse with `--marinara-theme-accent-pulse: enabled`.
- Added a Stable/Staging update channel selector with staging warnings and channel-aware apply checks (#2912).
- Added searchable Home FAQ controls, saved Professor Mari chat history management, Game Mode manual background generation, and lorebook vector deletion controls (#2913, #2909, #2902, #2900).
- Added Up/Down controls for alternate greetings in the Character Editor so card authors can reorder greetings without copy/paste work (#2917).
- Added native Gemini API embedding support for Google and Vertex Gemini connections so lorebook vectorization and memory recall can use Gemini embedding models (#2889).
- Added a per-chat AI translation prompt override in Chat Settings, with a restore-default action, so chats can customize the translation system prompt without losing the built-in default (#2883).
- Added llama.cpp sidecar embedding endpoint controls for pooling type and physical batch size so Gemma and other embedding GGUF models can use OpenAI-compatible lorebook/memory embeddings when they require non-default pooling (#2863).

### Changed

- Chat Branches no longer shows a separate "Active" pill; the checkmark and active row highlight identify the selected branch, while rename/delete actions remain available for the active branch.
- Memory recall chunking now behaves as read-behind storage when a chat message limit is set, keeping the active prompt tail out of durable memory chunks (#2862).

### Fixed

- Fixed compact UI layout polish around the Browser source menu, Settings tab labels, Game Assets import actions, Advanced update/admin buttons, and Lorebook overview control sizing/tooltips.
- Fixed Import Profile and Advanced Danger Zone settings buttons so they use the shared neutral Marinara chrome button styling, with Danger Zone actions stacked one per row.
- Fixed CodeRabbit review findings around recovery-boundary safety, Professor Mari chat switching, FAQ search accessibility, lorebook export/default compatibility, chat metadata patching, import mode validation, update channel checkout safety, and avatar crop normalization.
- Fixed Chats sidebar Conversation rows so they match Roleplay/Game row density while blank/new Conversation chat fallback icons use the cyan mode color instead of the custom chat accent.
- Fixed the Professor Mari home experience so desktop opens the chat inline in place of the home menu while mobile keeps its prior full-screen focus flow, the FAQ opens by default only on desktop, the FAQ/Professor launch card stays taller and evenly split with centered welcome copy on larger screens, the chat composer starts as a single-line input, achievements align to the home card width, missing-connection guidance points at the chain selector, closing the desktop chat no longer flashes homepage text, tutorial copy uses Chat Chrome text colors, Professor chat history controls live inside the chat window, and an in-progress Professor Mari chat can follow the user as an accent-bordered dismissible floating companion after they leave the home screen or open mobile detail sheets, with a DJ-sized circular mobile button and without loading the floating chat machinery while it is hidden on the home shell.
- Fixed broad app slowness paths by avoiding full chat-list refetches when opening Chat Settings, removing eager settings preloads, showing immediate settings/branch loading feedback, skipping Game snapshot copy work for non-Game branches, and stripping bulky internal prompt/debug payloads from branched/exported/imported messages (#2914, #2913).
- Fixed Game Mode setup list editing, guided generation macro resolution, game portrait/background prompt handling, NovelAI image sizing, image-prompt style compaction, and roleplay empty-send behavior (#2915, #2906, #2905, #2903, #2902, #2894, #2893, #2892).
- Fixed chat export/import fidelity by preserving mode/persona metadata, resolving macros in exported transcripts, preserving group-chat speaker snapshots after member removal, stripping internal export payloads, and exporting compatible lorebook entries as arrays (#2913, #2910, #2904, #2901, #2897, #2895).
- Fixed Professor Mari workspace/home behavior by saving previous chats on restart, exposing prior chats for rename/delete/reopen, preserving the selected persona, preventing repeated command-failure loops, asking clarifying questions before vague persona creation, and using a Termux-compatible `mari` shim path on Android (#2911, #2909, #2899, #2891).
- Fixed persistent black-screen recovery, Android/touch popover dismissal around Author Notes and Chat Settings pickers, JannyAI detail imports, blank preset variable options, and default vectorization state for new lorebooks (#2908, #2907, #2900, #2898, #2896).
- Fixed impersonation generations so preset-driven prompts skip regular preset instructions while preserving marker-provided context, preventing conflicting "respond as the assistant" system text from contaminating `/impersonate` prompts (#2886).
- Fixed Professor Mari home-chat restart so chat messages are deleted only after the workspace reset succeeds, preventing failed restarts from causing delayed chat history loss (#2887).
- Fixed Professor Mari workspace privileged-route access so trusted LAN/Tailscale clients can use the workspace when loopback-only mode is disabled, while database command execution remains loopback-only (#2884).
- Fixed privileged-route parameter errors so missing or invalid admin access is not rewritten as a generation-parameter warning (#2884).
- Fixed chat exports so saved thinking/reasoning content is included in text exports and mirrored in JSONL exports/imports (#2881).
- Fixed sprite prompt compilation so concise user descriptions survive prompt review/compaction, and reviewed prompts no longer receive a second layout/negative suffix (#2871).
- Fixed memory-recall branch contamination by pruning native chunks whose timestamp span no longer matches the current chat message log (#2862).
- Fixed v2.0.6 release metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.6` with `versionCode 25`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.5]

### Added

- Added regression infrastructure with prompt regression and Playwright smoke commands so high-risk prompt/UI flows can be checked before release.
- Added A-Z, Z-A, Newest, and Oldest sorting controls to Browser, Presets, Connections, and Agents panels, with persisted sort choices.
- Added a bulk alternate-greeting swipe insert path so first-message swipes can be added during roleplay setup without many slow client round trips.

### Changed

- Professor Mari now supports streaming in the home-page chat path and no longer limits Mari chat message count/length by default.
- Professor Mari tool instructions are slimmer when the selected model supports structured `body.tools`, avoiding duplicate tool availability text in the system prompt.
- Tool-capable streaming no longer disables streaming by default just because tool calling is enabled.
- New roleplay setup opens the chat/settings wizard immediately and applies starred chat presets in the background while seeding top-level preset connection/prompt fields up front.

### Fixed

- Fixed Author's Notes leaking draft text across chats by remounting the panel per chat and resetting its local draft state when `chatId` changes.
- Fixed roleplay first-message insertion on slow/mobile devices so alternate greetings are added through the new bulk path instead of a fragile sequential browser request chain.
- Fixed dead desktop drag handles in Lorebooks/Presets-style lists so non-functional handles no longer create misleading indentation.
- Fixed chat/message editor regressions from the stabilization pass, including tracker edit targeting, prompt-editor close handling, per-chat lorebook disabling, conversation card info, summary modal interaction, and swipe navigation behavior.
- Fixed several agent editor prompt-customization paths so canon extra prompts can remain customized instead of reverting unexpectedly, while still allowing restoration to defaults.
- Fixed Game mode and image-generation stabilization issues around setup timeouts, NovelAI/background generation, and generated NPC/agent metadata handling.
- Fixed v2.0.5 release metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.5` with `versionCode 24`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.4]

### Added

- Added Game mode HUD widget import/export controls in Chat Settings and the Game Setup Wizard so widget layouts can be reused between games.

### Fixed

- Fixed Roleplay streaming so failed post-processing/rewrite agent calls no longer drop the Typewriter effect from the final generated message.
- Fixed Roleplay Chat Settings preset-variable configuration so clicking inside the "Configure Preset Variables" modal no longer closes Chat Settings before users can edit choices.
- Fixed `/continue` so it can find the latest assistant message even when the transcript tail is not an assistant turn, injects a continuation cue into the prompt, and appends the model output to the continued assistant message.
- Fixed Professor Mari's home-page chat connection so the selected connection is remembered across Marinara restarts instead of resetting to the first/default connection.
- Fixed legacy group chats with the old Professor Mari character so those chats can still resolve her restored card while keeping the home-page assistant avatar out of Roleplay/Game expression matching.
- Fixed agent activation regressions after removing the old global enabled state so adding agents to chats no longer depends on a legacy per-agent flag.
- Fixed pinned Gallery images so pinned chat images persist across refresh/restart/chat switches and pinning from the full image view actually pins instead of only closing the lightbox.
- Fixed Active Context lorebook reporting so Conversation, Roleplay, and Game modes show the cached lorebook scan from the last generation instead of a best-effort rescan that could disagree with the prompt.
- Fixed Lorebook recursion defaults by making recursion opt-in with a "Recursion" toggle that is off by default for new/imported entries, and fixed keyword entry so pending keys are added when the user clicks away.
- Fixed Game mode generated NPC portrait prompts so NPC descriptions created during world setup are available to portrait generation even when the NPC is not in the character library.
- Fixed Characters and Lorebooks panel filters so search, sort, tag, category, and favorite filters persist while opening and returning from editors.
- Fixed v2.0.4 release metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.4` with `versionCode 23`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.3]

### Added

- Added a Re-run action to the Echo Chamber panel so users can retry the chamber output directly from the panel.
- Added per-parameter include toggles for Advanced Parameters so strict providers can opt out of unsupported temperature, sampling, penalty, reasoning, verbosity, and max-token fields while keeping custom JSON parameters available.
- Added a Custom Music DJ mode that can pick from local Game Assets music and play tracks through Marinara Engine's embedded accent-colored player, alongside the existing Spotify and YouTube modes.
- Added a default-on Image Generation queue setting so providers that reject concurrent requests can receive one portrait/background/illustration request at a time.
- Added extension manifest documentation and examples for folder-based extension imports.

### Fixed

- Fixed Conversation mode presence/status dots in the chat list and in-chat avatar overlay so they stay synced with live manual overrides and schedule-derived statuses instead of waiting for the next generation snapshot.
- Fixed Conversation mode generation lag spikes by making repeated streaming indicator clears no-op and moving heavy generation/agent console payload logging behind Debug Mode.
- Fixed Conversation mode command history so generated commands like `[selfie]` remain visible to future chat-history assembly.
- Fixed Professor Mari connection defaults so she no longer sends the whole saved defaults object as raw custom parameters, respects connection max-token/reasoning/verbosity defaults, logs her model requests at debug level, and shows clearer parameter-rejection guidance.
- Fixed Professor Mari workspace approval cards so long commands wrap, destructive database deletes show a larger warning with delete previews, and users can see that a restore copy is journaled before approval applies.
- Fixed Professor Mari home-page sessions so the assistant path cannot schedule background autonomous messages.
- Fixed local-provider textual tool calls so local models, including Gemma-style delimiter output, can be repaired into supported tool calls without rewriting unrelated assistant text.
- Fixed curated sidecar GGUF downloads so rounded display sizes are no longer used as exact byte counts for final download validation.
- Fixed Roleplay rolling summary compression so summarized tail messages can be auto-hidden from future AI context while preserving the summary ownership metadata needed to restore or inspect them.
- Fixed summary auto-hide storage rollback reporting so a failed compensating undo is surfaced as a compound failure instead of looking like a clean all-or-nothing rollback.
- Fixed chat notification sounds so rewrite/post-processing agents do not fire the completion ping until the final message is done, with a setting to play notification sounds only when Marinara is unfocused.
- Fixed Game mode chat UI drawers so Chat Settings, Gallery, Session, Retry, Volume, Game Assets, and Active Context can swap in one click/tap without closing first, stay aligned to the toolbar, and avoid the Game-only double-open flash.
- Fixed Game mode Chat Settings startup work and message rendering so opening the drawer no longer forces unnecessary full-history work.
- Fixed image-generation prompt compilation so connection/style prompt and negative prefixes are not duplicated for ComfyUI, selfies, and Gallery Illustrate requests.
- Fixed selfie prompt shaping so the distilled prompt preserves the user's useful prompt detail instead of collapsing it too aggressively.
- Fixed Bot Browser result navigation so Back to results restores the previous mobile scroll position.
- Fixed prompt macros so date/time values resolve in the user's browser timezone and `/continue` can append continuation text to the unfinished assistant message.
- Fixed privileged-route guidance so ADMIN_SECRET setup and the `X-Admin-Secret` header are documented in Settings and configuration docs.

### Platform Notes

- Android `versionName` is `2.0.3` with `versionCode 22`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.2]

### Fixed

- Fixed Game mode world generation returning empty setup JSON on some providers by disabling implicit high-reasoning/high-verbosity defaults for the strict setup JSON call unless the user explicitly configured them.
- Fixed a Game Setup Wizard cancel path that could silently hard-delete an existing campaign when stale metadata or a setup status made the wizard appear for a real game.
- Fixed mobile editor navigation and Lorebooks controls so editor tabs remain usable on narrow screens, Lorebook category selection fits mobile layouts, and mobile sidebars/topbar controls remain reachable while editing.
- Fixed mobile chat UI popovers across Conversation, Roleplay, and Game modes so Author's Notes, Active Context, Retry, Session, Volume, Game Assets, Gallery, and Chat Settings open beside the vertical toolbar, stay on screen, and close predictably when sidebars open.
- Fixed duplicate Author's Notes popovers in Roleplay mode and restored chat export requests across all chat modes.
- Fixed mobile notification stacking so the close action dismisses the visible stack consistently instead of leaving endless messages behind.
- Fixed Preset editor mobile controls and variable-field caret behavior so options no longer spill off screen and typing does not reverse text.
- Fixed Game mode mobile button sizing for map, party, and overflow controls so they match the other chat-mode toolbar buttons.
- Fixed touch drag-and-drop ergonomics in tab libraries by limiting mobile dragging to explicit handles, preventing long-press freezes on Personas and Agents, narrowing the "drop here to move out of folder" target, and removing the unused drag handle from Agents.
- Fixed Expression Engine sprite and avatar visual settings so device-specific positions, sizes, sides, opacities, and avatar overrides are cached locally per device instead of syncing unwanted layout changes across desktop and mobile.
- Fixed Expression Engine emotion matching for non-Latin labels so Cyrillic, Chinese, comma-separated names, and other Unicode emotion names are preserved instead of collapsing into long underscores.
- Fixed chat summary injection so generated summaries use the expected `<chat_summary>` marker and are included even when the preset section label is customized.
- Fixed SD Web UI / AUTOMATIC1111-compatible image generation through llama-swap by sending the configured model as a top-level SDAPI `model` field while retaining native A1111 checkpoint override settings.
- Fixed Music DJ agent editor display so YouTube provider prompt and tool details are reflected correctly.
- Fixed Professor Mari command handling after the JSON protocol refactor so local-model command attempts are repaired through the new JSON command path instead of surfacing as broken plain text.
- Fixed v2.0.2 release metadata across packages, homepage-visible app version, PWA manifest, Windows installer sources, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.2` with `versionCode 21`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.1]

### Fixed

- Fixed the Android APK first-launch bootstrap so the app checks the local Marinara server before showing the WebView, keeps the Install / Start screen visible while Termux or Android permission prompts are active, and no longer strands users on a raw `127.0.0.1:7860` connection error page.
- Fixed Conversation Mode Active Context previews changing lorebook entries while idle by making preview-only probability and weighted group selection deterministic for unchanged chat state.
- Fixed Conversation Mode input lag and slow DM switching in large chats by reducing per-keystroke work, throttling draft sync, and limiting rendered transcript work to the visible window.
- Fixed Conversation setup flows where connection or semantic-search selectors could fail to persist selected connections, leave the picker at `None`, or keep the setup wizard/sidebar layered over the wrong newly created chat on mobile.
- Fixed Conversation presence/status wording so away messages use the character's actual name, and improved multilingual character-name matching for avatars, lookup, search, and command matching.
- Fixed Professor Mari chat behavior after v2.0.0: home-page sessions now survive refresh until manually reset, mobile layout starts below the top bar, the mobile CTA says "Ask Professor Mari", and tool/db command instructions are less likely to surface as plain text for local models.
- Fixed Roleplay and generation parameter handling so chats using connection custom defaults respect reasoning/output settings, custom provider parameters continue to be sent, and stored provider reasoning remains routed correctly.
- Fixed built-in local model generation so chat/preset Advanced Parameters control max output tokens instead of being capped by the local runtime fallback value.
- Fixed suppressed/unknown-model parameter handling so max output tokens are still sent while sampler-specific parameters remain gated.
- Fixed OpenRouter service tier handling so Flex/Priority and custom `service_tier` values still reach OpenRouter when unknown-model parameter suppression is active.
- Fixed the post-release issue sweep for chat metadata cache corruption, mobile Characters panel scroll restoration, mobile notification bubbles, Bubble-style multi-speaker messages, Professor Mari mobile restart access, memory-recall embedder retries, YouTube player default visibility, display-size overflow, mobile panel layering, local textual tool calls, new/delete chat failure handling, and visible extension/Mari workspace import errors.
- Fixed Roleplay agent toggles so enabled agents stay enabled after switching to persona, lorebook, or other editor screens instead of being overwritten by stale chat metadata.
- Fixed Roleplay chat-settings presets so metadata-only actions like Advanced Parameters, Translation, Lorebooks, Memory Recall, Tool Use, tracker actions, and agent toggles no longer reset the preset selector back to custom settings.
- Fixed mobile tab/library drag-and-drop ergonomics by requiring the explicit drag handle for touch dragging, restoring normal scrolling elsewhere, improving touch auto-scroll, and preserving folder tap open/close behavior.
- Fixed browser/source dropdown layering, chat window layering, Chat Settings/Gallery mutual closing, and mobile topbar/sidebar stacking so popovers and side panels no longer hide underneath or cover the wrong UI region.
- Fixed display-size scaling regressions where large/huge text caused topbar icons, settings buttons, regex rows, preset rows, and other tab controls to overlap or escape their containers.
- Fixed notification/toast behavior so stacked notifications fade/dismiss consistently and special Professor Mari toast variants use the unified toast styling.
- Fixed Game and Roleplay UI edge cases around widgets, branches, author-note style popovers, gallery image opening, pinned-image depth, YouTube player coloring, and chat toolbar buttons.
- Fixed Game Illustrator wiring so Gallery → Illustrate, scene illustrations, NPC portraits, and background generation use the game chat's selected image connection and scene image instructions consistently.
- Fixed Game Gallery → Illustrate so manual illustrations use the Game Illustrator image connection and asset pipeline directly, preventing false "No connection configured" errors from the retry-agent path.
- Fixed NovelAI reference-image generation so uploaded/data-URL references are normalized to the base64 payload NovelAI expects before being sent.
- Fixed ComfyUI reference-image avatar generation regressions, bot-browser import/delete flows, SillyTavern bulk import mappings, tracker field-lock serialization, and lorebook/import/export edge cases found during the post-2.0.0 stabilization pass.
- Fixed Docker Compose onboarding documentation so the root `docker-compose.yml` location is linked clearly.
- Fixed Marinara's Universal Preset v12 so the bundled language choice defaults to English instead of Polish.
- Fixed legacy persona Extended Descriptions migration so old persona description blocks become persona-linked lorebook entries just like character Extended Descriptions.
- Fixed version metadata for the v2.0.1 hotfix release across packages, the homepage-visible app version, Windows installer sources, PWA manifest, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.1` with `versionCode 20`; users need a rebuilt v2.0.1 APK for the bootstrap/WebView fix.
- Windows, macOS/Linux, Termux, Docker, and PWA users can update through their usual v2 updater paths.

## [2.0.0]

### Release Highlights

- Refactored major parts of the codebase, UI shell, prompt pipeline, storage/import paths, and agent orchestration so Marinara Engine is easier to extend after the 2.0 line.
- Professor Mari is now a separate assistant living on the home page, capable of not only helping and creating stuff but also changing the theme of your frontend, creating agents, and extensions for you. Aka, fully customize your experience.
- Rebuilt the app UI around unified settings controls, square-y chat/sidebar/tab affordances, accent-aware chrome, customizable text/background colors, a reset-to-default appearance action, and optional RGB/pulse accent effects. All available to customize from the Settings. Freshened up mobile view.
- Reworked all the available Agents and made it easy for anyone to create their own custom one. Agents can also now easily be exported and imported.
- Treated this as a release-stabilization pass: every known release-blocking bug and maintainer-tracked issue from the 2.0.0 sweep was addressed before preparing the release notes.
- Marinara's Universal Preset v12 (new version) was set as a new default. Now Presets also include prompts for Conversation and Game modes you can use.

### Added

- Added a Local Model runtime toggle that starts llama.cpp with `--jinja` for OpenAI-compatible native tool calls.
- Added tracker field locks for editable Roleplay HUD and Tracker Panel fields so manually pinned tracker values survive generated game-state updates.
- Added a Termux bootstrap path to the Android APK. The APK now opens a running local server when available and otherwise offers setup actions that can hand the install/start command to Termux after Android's required user permissions.
- Added folder-based import/export support for custom agents and browser extensions so more complex agents/extensions can travel with code and related files instead of only single JSON payloads.
- Added Game Mode custom-agent selection in Chat Settings and aligned the Game setup wizard shell with Conversation and Roleplay setup styling.
- Added UNO/turn-game support for Conversation chats, including in-character setup flow, bot turns, board state, and safer live snapshot handling.
- Added stronger appearance customization: default accent color alignment, chat chrome text color coverage, app background color and gradient presets, RGB mode controls, and Marinara-style home-screen star glints.
- Added release-ready Android APK naming and release-note notices for the Termux bootstrap shell.

### Changed

- Moved AI-assisted character, persona, lorebook, preset creation, and preset review workflows to Professor Mari.
- Unified UI/UX styling across Settings, Characters, Presets, Agents, Browser, Connections, Chat Settings, top bar icons, sidebar tabs, buttons, sort controls, and repeated list rows.
- Improved Game Mode setup, generation defaults, asset generation bounds, checkpoint restore paths, journal/conclusion serialization, HUD widget persistence, and tracker rendering/merging.
- Improved prompt assembly around post-history preset sections, assistant prefill steering, context-window trimming, lorebook placement, visible tracker context, and prompt/debug parity.
- Improved file-backed storage, backup/import/export fidelity, SillyTavern character/lorebook/preset mappings, avatar transcoding, browser card preservation, and JSONL chat import/export.
- Improved local sidecar lifecycle, backend-aware requests, embedding paths, model provisioning checks, and local inference hardening.
- Improved Conversation autonomous scheduling, character presence status scoping, chat settings controls, Music DJ descriptions/behavior, and top bar hover/focus behavior.
- Updated Android docs, FAQ, troubleshooting, configuration, release-note rendering, and APK artifact naming around the new bootstrap-shell behavior.

### Removed

- Removed the deprecated standalone character, persona, and lorebook maker modals (replaced by Professor Mari) and their dedicated generation routes.
- Removed the Preset editor's standalone review tab and dedicated preset-review route.

### Fixed

- Fixed the "Fetch Models" HTML error hint so non-image connections say "connection" instead of "image service."
- Fixed server responsiveness issues where long generations could block unrelated UI/API work such as chat switching and `/api/health`.
- Fixed Roleplay first-message confirmation layering so "Add Message" can be clicked without the Chat Settings drawer closing underneath it.
- Fixed light-theme dropdown/list contrast in Chat Settings.
- Fixed duplicate visual Prose Guardian/agent streaming artifacts when opening other menus mid-generation.
- Fixed YouTube Music DJ first-track behavior to avoid Shorts-style picks where possible and clarified that Music DJ supports both Spotify and YouTube.
- Fixed the Professor Mari surprise toast shape so it matches the rest of the toast UI.
- Fixed max-context-window enforcement so non-history prompt material is prioritized first, recent chat history is windowed afterward, and response/free-token headroom is preserved.
- Fixed RGB/accent styling drift across top bar icons, settings icons, hard-coded pink text, tab/list icons, New chat buttons, title gradients, and solid-color RGB pulse strength.
- Fixed pinned gallery images layering so they stay above chat messages but below Chat Settings, trackers, author notes, summaries, session menus, and other chat UI windows.
- Fixed custom agents in Game Mode chat settings so the picker appears in the Agents section and sits at the bottom of the section.
- Fixed Android, Windows, Docker, Termux, and release-note wording that still described outdated APK/install behavior.
- Fixed Claude Subscription assistant prefill steering so embedded `</assistant_prefill>` text cannot break the synthetic XML-style continuation prompt.
- Fixed malformed provider/proxy response guards for Google/Gemini and related connection paths.
- Fixed Game Mode tracker state races, retry result handling, field-lock persistence, widget persistence, malformed stats rendering, game-state snapshot integrity, and committed tracker context rendering.
- Fixed prompt post-history system sections so they preserve metadata while being injected as user-side content at the configured depth instead of being glued to pre-history system prompts.
- Fixed a broad sweep of import/export, storage, lorebook, agent, sidecar, game-generation, chat-sidebar, and provider edge cases found during the 2.0.0 stabilization pass.
- And many, many more.

### Platform Notes

- Users upgrading from v1.6.1 can follow the new [Upgrading to v2.0.0](docs/UPGRADING.md) guide. Windows, macOS/Linux, and Termux git installs update by relaunching their platform launcher; Docker/Podman users pull the new image; iOS/iPadOS users update the host server and reload the PWA.
- Windows installer sources are already set to `v2.0.0` and continue to build the Git/Node/pnpm bootstrap installer from tagged releases.
- Android `versionName` is `2.0.0` with `versionCode 19`. Release APKs are now named as Termux bootstrap shells instead of "WebView shell requires Termux" artifacts.
- Docker/GHCR release images continue to publish from `v*` tags, including regular and lite variants.
- iOS/iPadOS remains a Safari PWA flow for v2.0.0. A jailbroken/sideloaded one-tap iOS bootstrap wrapper is still future work and is not included in this release.

## [1.6.1]

### Added

- Added a Marinara-specific AI agent workflow overlay, adapted from the Chai Agent Workflow Pack, covering proof discipline, bugfix/feature lanes, issue filing, PR gates, and risky-work claim boundaries.
- Added a None option for Roleplay message avatars so messages can render without avatar attachments.
- Added default starting values for numeric Game HUD widgets, with setup/editor clamps that keep start values within the configured max.
- Added a prompt override editor for registered prompt templates, including conversation selfie overrides, collapsible settings, and draft preservation.
- Added shared drag-and-drop image upload dropzones for character avatars, chat gallery images, and background imports.
- Added a manual Game Mode combat start control with confirmation so players can trigger encounter setup when a scene should enter combat.
- Added a General quote-format preference for straight or curly dialogue quotes and apostrophes, with editor/input formatting support across chat, presets, characters, and personas.
- Added conditional prompt macros, macro comment blocks, and Macro Reference guidance so presets and character/persona cards can keep author-only notes or branch prompt text by speaker/character.
- Added Roleplay TTS narrator voice support and speaker-tagged dialogue voice routing so grouped character dialogue can queue per-character voice requests.
- Added Roleplay Expression Avatar controls so Expression Engine selections can replace character avatars for matching messages, with sprite expression blocks hidden when avatar replacement is enabled.
- Added Roleplay Music DJ source controls matching Game Mode so chats can choose playlist, liked-song, artist, or wider Spotify selection behavior.
- Added an Illustrator run interval setting so scene illustrations are only eligible after a configurable number of assistant messages, and only successful image generations reset the interval.
- Added Roleplay quick-edit gestures: double-click on desktop or double-tap on mobile opens a message editor.
- Added a Chat Settings context toggle for excluding stored provider reasoning from future prompt context, enabled by default.
- Added numbered ComfyUI reference placeholders `%reference_image_01%`-`%reference_image_04%` and `%reference_image_name_01%`-`%reference_image_name_04%`, with the legacy unnumbered placeholders kept as slot 01 aliases.
- Added OpenRouter service-tier selection to generation parameters so OpenRouter connections and chats can request Flex or Priority routing.
- Added a lorebook-level No Vector toggle so an entire lorebook can opt out of semantic embeddings without editing every entry.
- Added a dedicated Game image prompt template editor in General Settings with variables, rendered previews, enable/disable control, and reset support for NPC portrait, background, and scene illustration prompts.
- Added a copy control to stored guided-generation details so guidance can be reused as a ready-to-paste `/guided` command.

### Changed

- Removed the Conversation, Roleplay, and Game mode shortcuts from the topbar because the sidebar already owns mode navigation.
- Widened the Glued Side Panel roleplay avatar presentation so the portrait strip has more visual presence.
- Improved sprite wand cleanup with halo edge cleanup, clean/paint brush tools, unified brush controls, and better multi-pointer handling.
- Polished Tracker Panel visual controls, thought bubbles, persona/tracker card styling, responsive world-state temperature display, and color preview restore/legacy tint behavior.
- Improved Game Mode combat setup so encounter generation can run in the background after scene analysis, with debug logging and a wait state only when the player reaches combat before setup is ready.
- Removed unreliable met/unmet status tracking from Game Mode NPC prompt context.
- Improved Roleplay group chat Individual mode prompting so only the currently responding character card is included, other characters' prior messages are treated as user-side context, and the turn-owner instruction can be toggled.
- Improved Roleplay streaming so the Streaming Speed slider uses a real typewriter reveal cadence instead of dumping fast server token bursts onto the screen.
- Improved Roleplay Music DJ execution so it can trigger in Roleplay chats, respect its configured context/source constraints, strip large playlists into song candidates, and recover playable tracks from grouped post-generation agent results.
- Unified Roleplay Agents & Actions plus Roleplay/Conversation input toolbar icon styling around the neutral grey-white treatment used by the emoji picker.
- Polished mobile Roleplay/Conversation input toolbar controls with larger touch targets while keeping desktop density compact.
- Updated the Roleplay input placeholder to invite writing a response without naming the active characters.
- Limited agent-specific Chat Settings controls to chats where the matching agent has actually been added.
- Updated Gemini topK handling so a disabled topK value sends `0` instead of falling back to the provider default.
- Expanded the Roleplay Re-run Trackers action so it also retries active custom agents alongside built-in tracker agents.
- Improved Settings update checks so git, Docker, and iPhone/iPad PWA clients get platform-specific update guidance, including the Docker release image tags published from `v1.6.1`.

### Fixed

- Fixed mobile Conversation chats where optional toolbar actions could squeeze the message textarea down until it appeared missing on narrow phone viewports.
- Fixed tracker character-card lookup so active-chat card aliases from title/comment text resolve tracker rows before out-of-chat fallback cards, keeping group-chat tracker portraits and color settings attached to the intended character.
- Fixed character tracker refreshes preserving user-uploaded NPC portraits and portrait framing across agent updates, including first snapshot writes.
- Fixed the Roleplay HUD temperature chip so it respects the shared Tracker Panel Celsius/Fahrenheit display setting.
- Added a stale client artifact cleanup step for the obsolete tracker data sidebar folder so installs, updates, checks, and builds are not tripped up by leftover local files after the tracker panel refactor.
- Fixed Docker builds so the stale client artifact cleanup script is available before dependency install/build scripts run.
- Fixed streaming Roleplay messages in Glued Side Panel avatar mode so the avatar frame keeps the selected scale and is revealed by the growing message instead of rescaling while tokens arrive.
- Fixed Quest Board state merges so tracker updates no longer revert quest progress or keep completed empty-objective quests.
- Fixed profile export/import fallback handling for large assets so profile exports can recover cleanly when embedded asset payloads are too large.
- Fixed Windows installer updates for existing shallow release checkouts by fetching the resolved release commit before checkout.
- Fixed mobile Game Mode character and party controls so sheet actions stay compact, long character names can remain accessible, and crowded party rosters collapse into a scrollable mobile party picker.
- Fixed mobile Game Mode choice prompts so large choice sets stay readable and scroll inside the available play area instead of squishing buttons or pushing custom input off-screen.
- Fixed mobile Game Mode side dialogue voice playback so voiced dialogue cues can play when the side line first appears.
- Fixed Game Mode log deletion on mobile so deleting the currently viewed beat returns to the previous beat instead of the start of the turn.
- Fixed Game Mode combat presentation across desktop and mobile: combatants scale to fit tighter screens, status badges no longer misalign portraits, ally NPC avatars resolve from character/game assets, action pacing is slower, desktop dialogue bubbles avoid overlap, and mobile combat dialogue is shown as tappable cues above the action box.
- Fixed quote formatting and macro parsing so curly quotes do not break macro conditions, and quote-formatting no longer pushes editor cursors to the end while typing.
- Fixed macro comments in character and persona card fields so `{{// ...}}` text is stripped before prompt assembly.
- Fixed Roleplay prompt/debug routing around transformed group-chat messages so `<last_message>` follows the actual latest visible message and generated responses trim leading blank lines/spaces before line breaks.
- Fixed Roleplay Music DJ false failure toasts after successful queueing, malformed-summary handling, and missing playable-track extraction.
- Fixed Advanced Settings layout issues, including the Admin Access save button escaping its bounds and tooltip/expand icons crowding each other in non-Game chat settings.
- Fixed gradient character names in Roleplay generated messages so the text uses the gradient instead of rendering as a solid gradient block.
- Fixed rare Professor Mari toast visits so they can be dismissed.
- Fixed Roleplay-to-Conversation DM commands so generated DMs mirror the initiating user message, reuse an existing character DM thread, and leave cardless NPC replies visible in Roleplay instead of trying to create an invalid Conversation chat.
- Fixed Conversation prompt timestamps and current-time context so they use the browser/user timezone instead of falling back to UTC-like server time.
- Fixed Assistant Prefill so generated messages are seeded with the configured prefill text instead of only sending it as prompt-only assistant context.
- Fixed stored-guidance modals appearing underneath high-layer Roleplay controls on compact landscape screens.
- Fixed preset depth-injected sections so short chats clamp them to the chat-history span instead of letting them float above the preset prompt context.

## [1.6.0]

### Added

- Added optional image generation for the Background agent so Roleplay can create and reuse missing scene backgrounds from an agent-selected image connection.
- Added `count`/`quantity` support to Game Mode inventory tags so `[inventory: action="remove" item="Coin" count="10"]` updates stacked item quantities directly. ([#899](https://github.com/Pasta-Devs/Marinara-Engine/issues/899))
- Added `{{charSysInfo}}` and `{{charPostHistory}}` prompt macros so presets can place character system prompts and post-history instructions explicitly. ([#865](https://github.com/Pasta-Devs/Marinara-Engine/issues/865))
- Added checkbox review controls for Continuity Checker findings so users can keep selected continuity fixes instead of dismissing the whole result. ([#858](https://github.com/Pasta-Devs/Marinara-Engine/issues/858))
- Added schedule-less Conversation autonomous messaging so chatty characters can still reach out based on talkativeness and the user's status when schedules are off or missing. ([#840](https://github.com/Pasta-Devs/Marinara-Engine/issues/840))
- Added Google Vertex AI as a connection provider for Gemini models, including Vertex model URLs, model listing, service-account JSON, OAuth bearer token, and API-key credential handling. ([#826](https://github.com/Pasta-Devs/Marinara-Engine/issues/826))
- Added bulk chat transcript export from the sidebar multi-select bar, producing JSONL or text zip archives for selected chats or the full chat library. ([#823](https://github.com/Pasta-Devs/Marinara-Engine/issues/823))
- Added `LOG_PRESET=prompt-connections` and `LOG_DISABLE_REQUEST_LOGGING` so prompt/model/connection troubleshooting can surface debug diagnostics without routine Fastify request-log noise. ([#798](https://github.com/Pasta-Devs/Marinara-Engine/issues/798))
- Added explicit Illustrator try-again controls when image generation fails, including a toast action and a persistent Roleplay HUD retry button. ([#797](https://github.com/Pasta-Devs/Marinara-Engine/issues/797))
- Added Local Model sidecar as a first-class embedding source, including an Embedding Connection option, lorebook vectorization support, and a stable `/api/sidecar/v1/embeddings` endpoint. ([#780](https://github.com/Pasta-Devs/Marinara-Engine/issues/780))
- Added opt-in Turn Data Access settings for custom post-processing agents so they can receive current-turn pre-generation injections and parallel agent results without exposing that data to existing agents by default. ([#778](https://github.com/Pasta-Devs/Marinara-Engine/issues/778))
- Added Memory Recall export/import for moving chat recall data between profiles or installs.
- Added weighted random macro choices for SillyTavern-style random prompt variants.
- Added a native Appearance background blur slider for Roleplay and Game mode backgrounds. ([#763](https://github.com/Pasta-Devs/Marinara-Engine/issues/763))
- Added excluded-tag filtering for the character browser, including `-tag:"tag name"` search syntax and exclude toggles in the character tag picker. ([#702](https://github.com/Pasta-Devs/Marinara-Engine/issues/702))
- Added a server-side autonomous conversation scheduler so enabled characters can generate restrained scheduled messages while the browser poller is absent, with client-presence checks to avoid duplicate client/server generations. ([#698](https://github.com/Pasta-Devs/Marinara-Engine/issues/698))
- Reworked the avatar crop tool into a square-region selector with corner handles + interior pan, so users can pick the exact part of the source image that becomes the circle avatar. Replaces the prior zoom + pan slider on Character avatars and adds the same widget to Personas (previously had no crop UI). The original avatar file is never overwritten — the Roleplay glued side panel still shows the full portrait.
- Added in-game access to Game Assets from the top-right game controls, including per-game asset selection.
- Added `%reference_image_name%` placeholder for ComfyUI custom workflows. When the workflow contains this placeholder, Marinara uploads the reference image to ComfyUI's `input/` folder via `/upload/image` and substitutes the returned filename, so vanilla `LoadImage` nodes can use the reference without needing a base64 decode node. The existing `%reference_image%` placeholder still works for workflows that decode base64 themselves (e.g. via `ETN_LoadImageBase64`).
- Added automated Windows installer builds for tagged GitHub Releases, and hardened release-asset workflows so the `.exe` installer and Android WebView shell APK attach from `v*` tag pushes even when the release itself is created by automation.
- Added a full-screen Game Assets browser with search, previews, editing, multi-select, and bulk operations.
- Added TTS playback controls, guided-action Quick Replies, direct swipe-number jumping, and clearer visible agent failure details.
- Added Game Mode inventory amount controls, drag-swap inventory interactions, tracker card color customization, and visible unread state for background autonomous messages.
- Added connection folders, per-connection prompt preset overrides, profile import progress feedback, and JSONL chat import into existing chats as new branches.
- Added tag import controls, bulk tag removal, Grok image generation support, NovelAI prompt controls for selfies and Illustrator, and Conversation-mode function calls.
- Added Lorebook keyword testing, vectorization exclusions, budget-skip visibility, and stronger regex safety protections.

### Changed

- Guided `/guided` requests and guided manual character replies now use Chat reply lorebook triggers instead of Continue/Autonomous triggers. Move lorebook entries from Continue/Autonomous to Chat reply if they should fire for guided replies.
- Simplified `/emote` syntax so `/emote joy`, `/emote "Character" joy`, and `/emote "all" joy` work alongside the original named arguments. ([#764](https://github.com/Pasta-Devs/Marinara-Engine/issues/764))
- Increased ComfyUI image generation polling to 5 minutes by default, matching the shared image request timeout used by Game Mode assets and documenting the image timeout env settings. ([#786](https://github.com/Pasta-Devs/Marinara-Engine/issues/786))
- Increased the default image generation canvases to `1280x720` for backgrounds, `1024x1024` for portraits, and `896x1152` for selfies so newly generated assets look sharper out of the box. Existing saved image size settings are preserved. ([#913](https://github.com/Pasta-Devs/Marinara-Engine/issues/913))
- Expanded Android APK disclaimers across GitHub Release notes, release asset naming, install docs, FAQ/troubleshooting, in-app update metadata, APK build output, and the Android shell's connection screen so users know the APK is a WebView shell and still requires the Termux launcher to be running.
- Improved Game Mode Spotify and narration handling, scene prompts, startup recovery, and asset generation/regeneration flows.
- Improved Docker runtime config, Docker Lite behavior, sharp handling, Linux sidecar fallback, Termux startup reliability, and the Docker Compose `HOME` default.
- Added a Termux `--skip-update` startup option and improved startup port-collision handling.

### Fixed

- Fixed launcher and in-app updater updates for installer-created shallow release checkouts by fetching `main` into `origin/main` explicitly and moving detached release installs to the fetched `main` commit.
- Compressed oversized chat image attachments before generation and capped provider-bound image payloads so large uploads no longer deadlock OpenAI replies with 413 errors. ([#912](https://github.com/Pasta-Devs/Marinara-Engine/issues/912))
- Pruned stale prompt preset multi-select values from chat preset selections so edited option values no longer leave old strings in assembled prompts. ([#909](https://github.com/Pasta-Devs/Marinara-Engine/issues/909))
- Made CSRF rejections visible in the UI so saves can no longer silently fail when Marinara is reached through an untrusted origin (e.g. a public IP, reverse-proxy domain, or Tailscale MagicDNS hostname). Three layers cover the issue: a sticky red banner appears at the top of the app on page load when the current browser origin would be rejected, with the exact `.env` line and a one-click copy button; the existing toast still fires on any in-session mutation that hits CSRF; and the 403 response now carries a stable `code` (`CSRF_ORIGIN_NOT_TRUSTED`, `CSRF_REFERER_NOT_TRUSTED`, `CSRF_CROSS_SITE`, or `CSRF_MISSING_HEADER`). The server logs the active CSRF auto-trust scope (loopback, HOST, private-IP literals, configured origins) on startup, and a new read-only `GET /api/csrf/origin-status` endpoint reports the current origin's trust verdict. Tailscale, Docker bridge, RFC 1918, and link-local IP-literal origins remain auto-trusted; only public IPs and DNS names need to be listed in `CSRF_TRUSTED_ORIGINS`. ([#722](https://github.com/Pasta-Devs/Marinara-Engine/issues/722))
- Restored message number display in Conversation chats when the setting is enabled.
- Fixed Docker images missing the optional background remover installer script, and added the Python venv runtime needed by the regular image installer.
- Fixed fresh Docker installs so runtime `.env` creation and file-native storage stay inside the persistent `/app/data` volume.
- Fixed Game mode image prompt review so prompt review modals can appear during first-start asset generation instead of suppressing the review flow.
- Fixed Linux NVIDIA local-runtime setup in Docker by falling back to the official Vulkan/CPU llama.cpp builds when Linux CUDA release assets are unavailable.
- Fixed GLM 5.1 via NanoGPT returning thinking-only text in Professor Mari chats by explicitly disabling thinking when reasoning is off and refusing to expose GLM thinking as visible chat output.
- Fixed app settings reverting after reload when stale server-synced settings overwrote newer browser-local preferences.
- Game mode now keeps the selected Appearance background when Scene Analysis is off instead of falling back to black.
- Fixed Game Mode stuck starts, duplicated setup modals, HUD widget setup recovery, provider recovery, thinking-only or empty model replies, and scene intro recovery paths.
- Fixed Game Mode asset generation prompt review, NPC portrait matching, sprite recovery, Professor-name avatar matching, and command-prompt regeneration replay.
- Fixed Game Session Log flicker, deletion offsets, manual deletion persistence, and dice-roll dismissal when advancing dialogue.
- Fixed Game Mode weather, storm ambience, sun overlay behavior, CYOA live updates, skill checks, inventory notifications, combat voice audio, mobile party access, tracker refreshes, and tracker edit persistence.
- Fixed CJK Google font shard loading and scene-summary max-token overrides.
- Fixed manual chat file deletion persistence and regenerate replay for command prompts.
- Fixed Conversation disconnection aborts on Docker, markdown block preservation, hidden-message regeneration crashes, Up Arrow recall behavior, role editing, DM schedule inheritance, random connection schedule generation, and connected-chat placeholder branch names.
- Fixed character avatar uploads preserving unsaved drafts, chat folder click targets, drag reorder behavior, text selection while dragging, folder storage atomicity, and Professor Mari continuation after tool/fetch work.
- Fixed OpenAI ChatGPT request shape and SSE parsing, compressed provider JSON decoding (`gzip`, raw `gzip`, and Brotli), Gemini gzip decoding, provider identity handling, NovelAI V4 prompt/model handling, ComfyUI numeric workflow placeholders, Horde image endpoints, and Pygmalion avatar content-type fallback.
- Fixed macro resolution in lorebooks and regex scripts, Lorebook Keeper overwrite/update behavior, depth-zero lorebook injections, Knowledge Retrieval and built-in agent prompt sections, roleplay leakage from Knowledge Retrieval prompts, preset identity sections, and regex lorebook matching ReDoS hardening.
- Fixed Docker proxy auth behavior and clarified its network scope, and improved file-native backup/self-heal behavior.

## [1.5.9]

### Added

- Improved sprite generation for expressions and full-body ones, allowing you to create matching full-body sprites for game mode to be shown alongside the expression ones.
- Spotify music player with DJ Mari (can be toggled in Settings).
- Cross-device extension storage, so browser extensions can sync through the server instead of staying tied to one device.
- Editable agent context injections and secret plot controls.
  Configurable impersonation controls, including an option to use CYOA choices as impersonation directions.
- /hide and /unhide slash commands for bulk AI-context visibility control.
- Start Chat actions from character views and the character panel.
- Persona-specific saved status options.
- Random expression sprite groups.
- Copy-message support in Game mode.
- Documentation updates for setup, updates, troubleshooting, iOS PWA use, and platform-specific install paths.
- The `.env` is now auto-created on first run (empty placeholder pointing at .env.example).
- Per-connection Fast Mode toggle for Claude (Subscription) — currently a no-op, kept for when Anthropic restores fast-mode routing.
- "Diagnose Model Routing" button on Claude (Subscription) connections, reporting which model the SDK actually billed against.
- OpenAI (ChatGPT) connections that use the local Codex ChatGPT login instead of an OpenAI API key.
- Server-side warning when the SDK silently bills against a different model than requested.
- Roleplay avatar and default sprite scale controls in Appearance settings.
- Per-connection max parallel agent job controls, allowing agent-heavy chats to split same-connection work across multiple LLM calls.
- Editable Game Session History map JSON in the current-session spoiler section.
- Markdown rendering and live preview for Game journal notes.
- Tracker Data Sidebar for viewing and editing live tracker data from the side panel.
- `/emote name="Character" expression="expression"` for listing and manually switching roleplay sprite expressions.
- Duplicate action for individual prompt preset blocks.
- Close controls for Game mode choice prompts and quick-time event windows.
- Agent tool calls for reading and replacing chat-wide string variables.
- OpenRouter as an image generation service through the existing image connection flow.
- Game setup can now review, edit, or remove generated HUD widgets and custom stat fields before the first turn starts.
- Game mode NPC side banter now spreads long runs across later VN segments, reducing oversized popup stacks.
- Roleplay Writer Agents can now pause before the main reply so their prompt injections can be reviewed and edited.
- Game Session Logs now highlight entries included in a pending multi-message deletion.
- Conversation settings now include a Commands section for toggling hidden character commands and configuring selfie and schedule command support.
- Rare Chibi Professor Mari scroll toast easter egg with a matching thank-you response in Professor Mari chats.
- Active World Info controls in Conversation and Game mode, including mobile access through the overflow menus.

### Changed

- Agents in Roleplay display rework.
- Game mode inventory no longer has a hard item cap.
- The `.env` changes hot-reload without a server restart for most settings (auth, IP allowlist, CSRF/CORS origins, and local-URL flags). Boot-bound vars still warn on change.
- Tailscale (100.64.0.0/10) and Docker (172.16.0.0/12) traffic are trusted by default, skipping IP allowlist and Basic Auth, with BYPASS_AUTH_TAILSCALE / BYPASS_AUTH_DOCKER opt-outs.
- CORS_ORIGINS is now hot-reloadable, and same-origin requests are auto-allowed regardless of config.
- Network rejection, SSRF, CSRF, and CORS errors now name the exact env var and the line to paste into `.env` to fix them.

### Fixed

- Fixed local LM Studio connection JSON errors and .local provider endpoint validation.
- Fixed agent output leaking into the main prompt, local model fallback handling, and Narrative Director cadence in group replies.
- Fixed spurious aborts on normal generation completion and raw conversation streaming buffers appearing in the UI.
- Fixed Roleplay DM routing to linked Conversation chats and connected chat branch labels.
- Fixed retrying Conversation generation from the send button and refreshing Conversation status when opening chats.
- Fixed Memory Recall refresh after message edits, reroll invalidation, and Termux embedding handling.
- Fixed Lorebook import, embedded lorebook sync, legacy link hydration, duplicate links, stale linked counts, disabled lorebook activation, prompt preview gates, and several scoping edge cases.
- Fixed Game mode combat targeting, mobile combat layout, combat HP initialization, enemy portraits, skill-check attributes, scene time drift, map regeneration after restored turns, typed choice prompts, background switching races, and scene intro recovery after asset failures.
- Fixed grouped Conversation image attachments and selfie persistence to active swipes.
- Fixed NovelAI image request settings and V4 native prompt input.
- Fixed Google provider empty candidate handling, Claude Subscription model identity loss, llama.cpp embedding response parsing, and TTS provider diagnostics.
- Fixed Docker and Lite Docker startup/install issues, including recursive app ownership layers, CPU-only hosts, and Rollup native binary restoration.
- Fixed Lite Docker sprite generation by rebuilding the `sharp` native module after scriptless dependency installs.
- Fixed conversation schedule generation so a connection max-token override replaces the old fixed schedule budget.
- Removed the oversized Characters panel New Chat row button so character names and metadata are no longer truncated.
- Fixed Active World Info so it reflects the lorebook entries used by the last generation instead of previewing the next turn.
- Fixed Game setup JSON parsing for common LLM omissions such as a missing comma before the next property, and added line numbers to the JSON repair editor.
- Fixed Game mode Talk to GM and Talk to Party turns so they skip scene/weather analysis instead of running the full scene-prep pipeline.
- Fixed right-panel resize handle layering and custom font family normalization.
- Improved combat in Game mode.
- Claude (Subscription) silent model-identity loss; Opus and Haiku falsely self-identified as Sonnet because the SDK strips version awareness without the claude_code preset wrapping.
- Bounded the CSRF/CORS rejection-log throttle caches (capped at 2048 with FIFO eviction) so attacker-controlled origin strings can't grow process memory without bound.
- Unified the CSRF 403 response body to use origin across all branches (it was inconsistent for the Referer-not-trusted case).
- Fixed Game mode inventory item names so long names wrap instead of truncating, and removed stale item-description rendering from inventory surfaces.
- Various UI improvements.

## [1.5.8]

### Added

- Special edition of Game mode Lorebook Keeper.
- Guides for all modes.
- QoL improvements to Lorebooks handling.
- Optional intuitive swipe navigation lets Conversation and Roleplay users move through rerolls with arrow keys or touch swipes, with an opt-in reroll-at-the-end shortcut.
- Roleplay chats can now optionally let characters create direct-message Conversation chats with hidden `[dm: ...]` commands.
- Lorebook entries can now be selected in bulk and copied or moved to another lorebook.

### Fixed

- Various issues caused by the security tightening were fixed.
- Sidecar issues fixed.
- Improves the selfie regex, catching malformed commands.
- Fixed context trimming.
- MLX sidecar runtime installs the upstream `mlx-lm` source build so curated Gemma 4 MLX models can load on Apple Silicon.
- Dry-run prompt preview now trims against manually configured preset Max Context Window values instead of only connection/model limits.
- Script custom tools now show their disabled state in the editor and fail safely when `CUSTOM_TOOL_SCRIPT_ENABLED` is off instead of silently disappearing from agent tool pickers.
- Browser extensions now load under CSP through Blob module execution instead of eval, keeping extension support without adding `unsafe-eval`.
- Local sidecar runtime installation now works when the matching Admin Access secret is entered, even if `SIDECAR_RUNTIME_INSTALL_ENABLED` remains off.
- Agent traffic now warns when the default agent connection may bill a provider. Agents explicitly set to Local Model are skipped with a visible warning when the sidecar is unavailable instead of silently falling back to a paid API connection.
- Chat attachments now wait for file reads, preserve files in manual group mode, and expose supported text files like JSON/Markdown/CSV to the model instead of silently dropping them.
- Fixed rolling in Game mode.
- Lorebook Keeper updates now receive existing entry content, and append structured new facts instead of replacing user-written lorebook text.
- Docker images now repair `/app/data` volume ownership before dropping to the non-root runtime user, preventing `EACCES` startup failures during file-storage migration.
- OpenAI-compatible local streams now accept stricter and looser SSE `data:` formatting, Conversation mode visibly streams text again, and live reasoning chunks appear while a reply is still generating.
- Expression agent sprite updates now repair stale character IDs from the current character name before dropping the expression, so existing characters keep their expressions mid-session.
- Stability AI image connections now test against Stability's account endpoint, fetch legacy v1 engines when needed, and generate through the correct v2beta Stable Image task endpoints instead of probing `/models`.
- Game mode party changes made from Chat Settings now sync to game metadata and carry into future sessions.
- NanoGPT GPT Image 2 requests now normalize image size to a supported pixel budget instead of forwarding too-small canvases.
- Conversation manual generations now share the autonomous in-progress guard, preventing async catch-up replies from duplicating the same user turn.
- Edits made via "Edit Linked Lorebook" on a character with an embedded lorebook now persist back to the character's V2 `character_book`, so deleted entries no longer reappear when the character is reopened, and deleting the linked lorebook clears the embedded copy on the character and evicts the cached lorebook detail instead of leaving stale entries, a phantom Reimport button, and a ghost lorebook editor behind. Imported character cards no longer carry over a foreign `lorebookId` pointer in their extensions, the character editor verifies the linked lorebook actually exists before showing "Edit Linked Lorebook", and the lorebook editor surfaces a 404 with a toast instead of an infinite loading shimmer when opened against a deleted lorebook.

## [1.5.7]

### Added

- Guide for Game mode.
- Professor Mari can now create Lorebooks for you.
- Days tracker in Game mode that you can edit.
- Lorebook entry trigger mode can now be changed directly from the entry status dot.
- Game mode interrupt button that allows you to interrupt the GM (with or without consequences to your game).
- Various improvements to the Game mode's combat and inventory systems, more cinematic battles, better UI handling, and more overall mechanics.
- Game mode map scaling.
- New permanent tag that persists in Roleplay mode if a character passed you important information in Conversation mode.
- Improvements to the Knowledge Router agent.
- Storing the Conversation Theme background gradient separately for dark and light color schemes, so switching OS/browser theme automatically loads the correct gradient.
- Custom agents now have a chat memory.
- Prompt overrides the registry for image generation.
- Active filter tab in Lorebooks.
- Compressed Lorebooks.
- Customizable generation settings for local image generation.
- When generating schedules, they now receive context from the conversation chats you had with a character.
- Hide/unhide messages in Roleplay mode.
- Alternative display of logs for Game mode.
- Custom agents can now choose a result type, including Text Rewrite for post-processing agents that edit the generated reply.
- Setting to enable showing and editing image prompts before they're sent.
- Setting to change the image dimensions for generation.
- Various small QOL changes.
- Custom agents' outputs can now be edited in the Agents button in the Roleplay mode.
- Custom parameters field.
- Sliders to control the sprite's size and opacity in Roleplay mode.
- Custom activity statuses for the user.
- Vectorized Lorebook entries are now visibly marked.
- Character card version history with compare and restore controls.
- Prefills.
- File-backed storage now writes JSON tables under `DATA_DIR/storage`, and backups include those files.
- Allowed token size outputs in agents.
- Lorebook folders.
- Game mode setup remembers custom genre, tone, setting, and goal options from previous games.
- Optional trimming for incomplete model endings before generated messages are saved.
- Draft translation button option in chat Translation settings for Conversation, Roleplay, and Game modes.
- Native vs compatible export choices for profile, character, persona, and lorebook exports.
- PocketTTS is now available as a local TTS provider.
- Optional speech-to-text microphone buttons can be enabled for Conversation, Roleplay, and Game input fields.
- Character imports now ask before extracting embedded character-card lorebooks into standalone Marinara lorebooks.
- Home Assistant HACS integration that syncs Marinara custom tools and a Home Assistant agent for smart-home control.
- Updated the supported toolchain to Node.js 24 LTS and pnpm 10.33.2 across launchers, installers, Docker images, docs, and CI, plus refreshed dependencies within their compatible ranges.
- Lorebook entries can now be scoped by active characters, character tags, and generation triggers, and can scan selected character/persona fields as extra keyword-matching sources.
- Game mode now has an optional Lorebook Keeper that updates a game-scoped lorebook after session conclusion and automatically attaches it to that game.

### Security

- Hardened default network access so loopback remains convenient while non-loopback private-network traffic fails closed unless Basic Auth, an allowlist, or an explicit unsafe opt-in is configured.
- Added global unsafe-method CSRF/origin protections, security headers, route throttling, and shared privileged-route gates for admin, update, backup/import, sidecar, haptics, and custom-tool operations.
- Added SSRF, path containment, upload validation, bulk-import capability tokens, and response-size guards around high-risk URL, file, and archive flows.
- Disabled or gated risky execution paths by default, including API-driven update apply, custom script tools, sidecar runtime installs, and remote haptic control.
- Removed the seeded default provider key, encrypted Spotify token storage, and redacted obvious secrets from profile export.
- Hardened chat HTML sanitization and SVG/image handling, then upgraded vulnerable production and build dependencies.
- Hardened Docker, Android WebView/backup, GitHub Actions action references, and Windows installer dependency verification.
- Breaking/default changes: privileged routes now require `ADMIN_SECRET`, Docker binds to localhost by default, and update apply, custom script tools, and sidecar runtime installs are disabled until operators opt in with the documented environment switches.
- Operators who intentionally need the old exposure model must set `ADMIN_SECRET`, choose a remote bind address for Docker/launchers, and explicitly enable only the required flows such as `UPDATES_APPLY_ENABLED`, `CUSTOM_TOOL_SCRIPT_ENABLED`, or `SIDECAR_RUNTIME_INSTALL_ENABLED`.

### Fixed

- Custom OpenAI-compatible endpoints like Venice no longer receive provider-specific request fields just because a fetched model ID matches an OpenAI, xAI, OpenRouter, or Z.AI naming pattern.
- Addressed various security concerns.
- Game mode dark screen error addressed.
- Consolidated live persistence on file-backed storage, reducing release-to-release migration failures.
- File-backed recovery now checks every known historical data location and repairs snapshots that missed chats during early v1.5.7 testing.
- On mobile Roleplay, the branch quick-switcher now lives inside the three-dot toolbar menu, so it no longer overlaps the Agents' controls.
- Settings Debug Mode now prints prompt, scene-analysis, party-turn, and game asset debug logs even when `LOG_LEVEL` is not set to `debug`.
- Switching chats doesn't stop the generation of the previously triggered one.
- Cross-conversations confusions addressed.
- {{user}} and {{char}} macros now work in all modes.
- Injections at a specific depth now work correctly.
- Added Spotify OAuth redirect URI handling and manual paste-back.
- [Start the game] is being sent twice upon starting the game.
- Expression Engine now retrieves all the available sprites correctly upon retry.
- Fixed unstable message pagination cursor.
- Various errors were addressed.
- Advanced parameters are now respected by local endpoints.
- Improved the quality of some prompts.
- Ensured the daily/weekly summaries trigger consistently.
- We now handle assets in Game mode better.
- Conversation mode characters no longer reply to themselves; instead, they reply to you.
- Drag-and-drop on mobiles now works.
- Custom agents can now rewrite your messages.
- Full-body sprites in game mode now get updated properly.
- Deleted characters from group chat no longer appear as Unknown.
- Roleplay setup and connection setup dialogs now fit short screens with internal scrolling, and Custom Parameters starts empty with an example placeholder.
- File-backed storage now supports Lorebook folders during generation and migration.
- Deleting one saved character card version now leaves the rest of the version history intact.
- Removed the legacy database setup step from the installer flow.
- Fresh installs no longer install the old fallback storage packages.
- Browser-tab character imports now preserve embedded Chub lorebooks as linked Marinara lorebooks.
- OpenRouter Claude reasoning is requested with OpenRouter's unified `reasoning` payload again, restoring thinking capture for Sonnet/Opus reasoning models.
- Sprite sheet prompts now more explicitly require complete slicable grids for expression and full-body pose generation.
- Loopback LLM provider URLs are allowed by default again, so local model servers on `127.0.0.1`, `::1`, or `localhost` do not require the broad private-network URL opt-in.
- Restored the animated Marinara logo on the home screen while keeping the static logo as the inactive-page fallback.
- Tightened the home screen spacing so the logo, FAQ, credits, and special thanks fit more comfortably on desktop and mobile.
- Windows installer updates now force-refresh the release tag and verify the resolved tag commit instead of aborting on legitimate v1.5.7 hotfix retags.
- The v1.5.7 Android wrapper APK now uses a bumped `versionCode` for hotfix updates and the release workflow uploads an installable sideload APK.
- Game Lorebook Keeper now continues in the background after a session is concluded instead of holding the End Session response open.
- Launchers, installers, and in-app updates now fall back to installed or temporary pnpm when Corepack cannot resolve the exact pinned pnpm patch version.
- Explicit ComfyUI and AUTOMATIC1111 image-generation connections can use LAN/private-network hosts without the broad image URL opt-in.
- Restored scoped HTML/CSS rendering inside Roleplay messages and narrator bubbles.
- Backup and profile export failures now surface the specific server/admin-secret error instead of a generic failure toast.
- Haptic agent position commands now normalize PositionWithDuration-style outputs and continue executing later commands if one device command fails.
- Lorebook entry drawers now autosave edits, so the manual Save Entry button is no longer needed.
- Docker/LAN browser origins now pass CSRF checks when Marinara is reached through a mapped host port, and `CSRF_TRUSTED_ORIGINS=*` is honored as an explicit unsafe wildcard.
- Loopback backup/profile export requests no longer require `ADMIN_SECRET` by default; remote privileged requests still do.
- Turning off Conversation schedules now clears saved schedule metadata and resets affected character availability state.
- Removed the Workbox `index.html` navigation fallback that caused non-precached-url console noise.
- Various minor UI bugs.

## [1.5.6]

### Added

- New connection provider Claude (Subscription) that routes chat through the locally installed Claude Agent SDK so requests bill against your Anthropic Pro / Max subscription instead of an `sk-ant-*` API key. Requires `npm i -g @anthropic-ai/claude-code` and a one-time `claude login` on the host running Marinara. This is the same auth mechanism Anthropic-endorsed integrations like Zed use; no proxy or third-party shim is involved. Built-in agent tools are disabled and use Marinara's own agent/tool layer. Embeddings are not supported on this provider; configure a separate connection for them.
- The "Mari is thinking…" indicator appears above the composer while Professor Mari executes her embedded commands (create/update character, fetch, create chat, navigate). Makes it clear that her background work is running, not frozen. Bonus: Dottore is doing jumping jacks.
- Dry-run generation endpoint (`POST /api/generate/dryRun`) that runs the full generation pipeline without side effects; no messages persisted, no agents or tools invoked, no Discord webhooks. Extensions can send a `userMessage` to preview "what if I said this", use `impersonate: true` to preview the user's next in-character line, enable optional injections (lorebook, trackers, chat summary), override the preset or connection, and optionally receive the assembled prompt instead of a completion (`returnPrompt: true`). Supports both non-streaming JSON responses and SSE streaming with abort capability. Intended as a stopgap extension API for flexible prompt inspection and silent generation.
- In Game mode, NPCs can be added/removed from your party, plus now you can manage the party manually.
- If you have Image Generation enabled in Game mode, during important scenes, the model now generates immersive VN-like scenes from the player's POV.
- Overall improvements to generating expressions/full-body sprites for your characters.
- Guided generations with a visible indicator.
- Schedule generation preferences added for conversations.
- Pygmalion, Jenny, and DataCat added to the Browser.
- Pinnable taskbar shortcut via custom launcher.
- Universal Tool Support for agents.
- New Knowledge Router agent.
- You can now link Personas to Lorebooks.
- Drag-and-drop Lorebook entries.
- Added ElevenLabs for TTS support.
- TTS now supports character and NPC voices.
- You can now see spoilers for Game mode and edit the plot accordingly to your needs in the History section.
- Upon ending the Game session, you can now optionally include what you want to happen in the next session.
- Separate volume levels for different sounds in Game mode.
- Added the `/impersonate_prompt` command that allows you to change the impersonate prompt.
- Added manual mode in Conversations that only makes the character respond when you ping them with `@name`.
- Resizing sprites in game mode.
- Conversation auto-summarization now has a Day Rollover Hour (so a late-night session doesn't get cut in half when calendar midnight passes) and a Recent Message Tail (keeps the last N messages verbatim across the day boundary so characters wake up remembering the actual flow of last night, not just the gist). Defaults: 4 AM rollover, 10-message tail.
- Conversation characters can now emit durable `<note>...</note>` tags for connected roleplay and game chats. Notes persist in the target chat's prompt until cleared from Chat Settings.
- Lorebook entries now use compact rows with inline controls and an expandable inline editor.
- Lorebook entries can now be grouped into collapsible folders to reduce vertical clutter for stable or AI-managed entries. Folders have their own enable/disable toggle that gates every entry inside (regardless of each entry's own toggle) without modifying the entries' individual settings, so re-enabling a folder restores everything to how it was. Each folder is its own container — sort by Order works inside the folder, and a folder full of high-Order entries can sit above root-level entries with low Order without conflict. Move entries between folders via a per-row folder picker or drag-and-drop. Collapse state is per-browser (localStorage). Folders are flat in this release; nesting may follow.

### Fixed

- UI and other minor glitches in Game Mode.
- Image Generation in game mode is not firing up for named NPCs in a scene.
- More ComfyUI fixes.
- Various general fixes and improvements.
- Anchor link error.
- We now enable the send button immediately after branching.
- Remove background actually sticks across switches.
- Sidecar CUDA runtime setup fix.
- Light Mode readability issues.
- Removed the ability to apply presets to Conversations, which broke the format.
- Improved usability on mobile devices with small screens, where tapping tiny buttons could be difficult.
- Navigational icons under messages now scale with the display size.
- When selecting Personas during chat setups, you can now see their avatars.
- Switching between chats doesn't cancel generations in progress.
- Parameters added to Conversations and Roleplay setups.
- Bugged NPC entries in Game mode journal.
- Creating a new agent doesn't delete the old one.
- Preset names are no longer set to Default upon being selected.
- Black screen on search bar typing in chats was fixed.
- Various UI fixes applied.
- DeepSeek V4 is now supported.
- Addressed the bug that deleted your Persona fields when uploading an avatar in an unsaved state.
- Minor adjustments to some agent widgets.
- Game mode now supports multiple maps.
- Debug mode restored.
- Expression Engine retries now load available sprites, validate returned expressions, and persist the corrected sprite state.

## [1.5.5]

### Added

- New agent: Card Evolution Auditor that actively updates your characters as they grow.
- Polska gurom!!! In Game mode.
- GM can now add party members during the game and create character cards for them.
- Turn, Scene Analysis, and Assets Image Generation retry button in Game mode.
- Improved Game mode's structure and prompts.
- Custom widgets, notes/books, session summaries, and inventory in Game mode are now all editable.
- You can now upload custom NPC portraits in Game mode when clicking on the portraits.
- The Characters tab now opens a full-page library with large card browsing, creator-note previews, and a selected-card overview before editing.
- Chat galleries and character galleries now support selecting and uploading multiple images in one action.
- Chat branches can now be switched from a selector at the top of the chat bar instead of only through Manage Chat Files.
- Conversation schedules now let you customize per-character idle and DND response delays, plus inactivity follow-up timing.
- Character titles to mirror the ones Personas have.
- Various macros, see all under `/macros`.
- Game mode combat improvements (statuses, abilities).
- Bulk delete.
- Search filters for chats in the Chats tab.
- TTS support.
- FAQ on the home page.

### Fixed

- Fresh installs and client builds no longer fail with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` because the shared package now builds from root entrypoints instead of the client package's nested `predev` and `prebuild` hooks.
- The lite container release workflow now inspects the correct `-lite` image tag instead of the nonexistent `*-lite-lite` tag, so tagged lite image publishing completes successfully again.
- Fixed sidecar startup state and enabled logs for Ollama to see what's going on.
- You can now use tab when writing lorebook entries.
- Some image generation endpoints.
- Clicking roleplay image attachments now opens them in Marinara's in-app lightbox instead of a new browser tab.
- Auto-play in game mode now pauses when you're reading a note, a book, or doing a QTE event.
- Opening a conversation no longer resets the autonomous-message inactivity timers just because the message history finished loading.
- OpenAI-compatible connections no longer send reasoning payloads to models that do not support them.
- Selfies and sprite generation no longer force a character avatar as a hidden reference image by default.
- Explicitly adding or editing an agent no longer persists it as globally disabled.
- Memory recall now stays inside a dedicated prompt budget before injection, preventing recalled history from crowding out agent and thinking context.
- Exporting a modified character to PNG no longer reuses stale embedded card metadata from the avatar image.
- Sprites get displayed automatically when you add Expression Engine to your chat, and their setup was moved to the Agents section of Chat Settings.
- More ComfyUI fixes.
- Group chats' inconsistent injections: now, upon regenerations, the model knows who should respond.
- Game mode scene-wrap now only sends the current party's character names instead of the entire imported character library, preventing large libraries from tripping the 100-name limit.
- Professor Mari now has access to all the fields in character cards/personas/lorebooks/etc. and can correctly split info into them.
- The Windows installer now downloads Git from a valid prerequisite URL again instead of failing the autodownload step with a missing PowerShell `-Uri` argument.
- Mobile UI fixes for Game mode.
- Increased the output size to 16384 tokens on the new Game setup generation to prevent malformed JSON errors.
- Decreased padding for text in boxes in the Glued Side Panel avatars option.
- Edit Sheet in Game mode black screen bug.
- CYOA choices can now be edited.
- UI fixes.
- Lorebook entries now don't stay active after they've been activated once, and the lorebooks respect the token limits of how many active entries there may be at once.
- Custom widgets now may change between sessions.
- No more looping music/ambiance in Game mode.
- If a provider accepts a smaller context size than the overall model allows, we now automatically reduce the output size to match the allowed size.

## [1.5.4]

### Added

- An option to control when the Narrative Director triggers to prevent rushing.
- Every time you add an agent to a chat, you now see a window with its description and setup.
- Macros support for {{user}} and {{char}} in Game mode.
- Added translation support to the Game mode.
- You can now address the GM directly in the Game mode.
- Refresh cache button in Advanced Settings.

### Fixed

- OpenAI endpoint now correctly re-routes all GPT-5.4 models via Responses API.
- Strengthened the regex to catch incorrect formatting of the messages in Conversations mode.
- Restored the slight delay on receiving multi-line messages in Conversations mode.
- Fixed mobile side displays of dialogues in Game mode.
- Game mode incorrect starting narration.
- ComfyUI generation for sprites and default workflow fixes.
- Removed a bugged new chat creation from Manage Chat Files.
- Bold dialogue formatting now supports Chinese and Japanese quotation marks.
- Strengthened commands in Conversations mode.
- Various mobile UI fixes.
- Scenes cannot be branched anymore (that broke them).
- Sprite generation triggering on unsupported platforms.
- Cross-awareness with game mode.
- Clicking on new conversation notifications while in Game mode now takes you to the Conversations correctly.
- All GLM models now correctly receive only the `enable_thinking` parameter with `false/true` depending on whether you chose reasoning to be `None` or any other.
- Improved Lorebook Keeper agent.
- QTE in Game mode fix.

## [1.5.3]

### Added

- Character galleries for storing reference images directly on a character instead of a specific chat.
- Conversation mode swipe controls.
- An option to delete a selected swipe instead of the entire message.
- Prompt caching support and cache hit/write visibility for OpenRouter Claude connections.
- Recommended models for the first Game generation.
- A setting to disable bold dialogue formatting while keeping dialogue colors.
- Custom parameters setup for initial Game mode generation.
- Instant display of messages in game mode.
- Discord Mirror for all chatting modes.
- No more "Preset Variables" pop-up on presets without them.

### Fixed

- We no longer use browser pop-up windows, so the users won't accidentally permanently dismiss them.
- Various setup fixes, including Docker runtime libraries and launcher/installer build steps.
- Decreased text padding in Roleplay mode inside the message box area.
- Session recordings can now be accessed.
- Addressed storage-query errors.
- Impersonate direction is now properly sent to the model.
- Inventory is now saved and stored between game sessions.
- We now apply the correct headers for official Anthropic calls.
- Multi-line messages no longer collapse after editing in Conversations.
- Character schedules now use your local timezone when generating.
- Dialogue highlight colors now keep working even when bold dialogue is turned off.
- Marinara landing-screen effects now stop rendering when they are off-screen, and they stay paused while the tab is inactive.
- Text renders in HD.
- We correctly catch Gemma-4's thinking tag.
- Audio docker fix.
- Selecting a new location in the Game mode now doesn't automatically transport you there.
- Party-only Game turns no longer commit staged travel.
- Game Discord Mirror now carries narrator labels across regular turns and new-session recaps.
- Game chat parameter changes now override setup-time defaults after the game has already been created.

## [1.5.2]

### Added

- General settings now include a persisted app-language selector at the top of the tab. It currently exposes only English and is ready for future translation PRs to extend it.
- Added a new option to display character/persona avatars in the Roleplay mode (as a side panel, bigger size). Access it in the Appearance Settings.
- NanoGPT support and improved image connection handling.
- Added a macOS Apple Silicon-only MLX backend for the local sidecar.
- Support for running different local models.

### Fixed

- Installed Windows desktop and Start Menu shortcuts now launch Marinara Engine with the correct working directory, so packaged installs no longer open and close immediately.
- Windows installers and launchers now force the repo-pinned pnpm version through Corepack when available, so older global pnpm installs no longer break setup, and the batch installer restores the Marinara icon on the desktop shortcut.
- Conversation mode no longer forces OpenAI-compatible backends like NovelAI onto the non-streaming transport path, preventing immediate cancellations while keeping complete-message rendering in the UI.
- Character maker, persona maker, lorebook maker, prompt review, retry-agents, game setup, and other system tasks now obey the global Streaming Responses toggle instead of silently forcing streamed transport.
- Image Generation connections can now keep ComfyUI selected on non-default hosts and ports, so remote ComfyUI servers still expose checkpoint fetching and custom workflow JSON.
- Connection max-context limits now trim oversized prompts before generation, and prompt inspection shows the fitted prompt that was actually sent upstream.
- OpenRouter connection provider preferences now carry through agent runs, game setup, GM/tool generations, and other helper flows instead of falling back to Auto router outside the main chat path.
- Inline reasoning blocks wrapped in `<thought>...</thought>` or `<|think|>...<|/think|>` are now extracted into stored message thoughts, and game-mode JSON helpers strip those blocks before parsing model output.
- Glued Side Panel roleplay avatars now fade and blur out more aggressively at the bottom so they merge into the message bubble instead of ending abruptly.
- Clean installs no longer warn that pnpm ignored build scripts for `onnxruntime-node` and `protobufjs`, so Windows users do not need to run `pnpm approve-builds` or patch `package.json` by hand.
- Added the no split mode flag to prevent the looping crash of Gemma-4 on multiple GPU systems.
- Tracker agents can now use the built-in local sidecar through the normal Connection Override dropdown, and the Local Model card now provides a bulk action to point every built-in tracker at the local model.
- Fixed new game mode sessions not starting after the last one concluded.

## [1.5.1]

### Added

- Display of the time of the day in the game mode.
- Custom game widgets can be moved around.

### Changed

- Removed the Quests tab from Game Mode. Game sessions deliberately do not use tracker agents for quests, so the journal now focuses on the code-driven data it actually maintains to avoid excessive generations.

### Fixed

- Returning to an active game session no longer reopens the full-screen world overview and blocks the current scene behind the black intro overlay.
- Combat encounters now wait until narration and scene presentation finish before opening, and HUD widgets hide during combat and restore correctly afterward.
- Loot drops now resolve to the correct item names instead of malformed combat-drop payloads.
- Constant lorebook entries selected for Game Mode are now injected during world generation instead of being skipped during setup.
- Non-English setup languages now propagate through setup generation and GM output formatting, so game text stays in the selected language.
- `/game/setup` now streams upstream tokens during first-turn world generation, reducing timeout failures on slower local backends.
- Map discoveries and NPC meetings now populate the journal from code-owned game state. Locations appear when discovered, and NPCs are logged when first met instead of only after a reputation change.
- Our built-in Gemma-4 will now target available GPUs during generations.
- Fixed Gemma-4 issues on Windows.
- We now only install llama-cpp if you choose to host Gemma-4.

## [1.5.0]

### Added

- Introducing the new **Game Mode**! A cross between a classic roleplay and a visual novel, fully driven by the AI GM! Embark on adventures either solo or with a party of characters of your choice. Or perhaps have one of your characters DM the game for you and others? The games span multiple sessions, and _anything_ can happen. The sky is the limit. Well, I guess your wallet, too.
  - Follow an easy and quick game setup wizard to customize your game, or ask the model to come up with the ideas for you.
  - The game's UI is a cross between RPGs (think Baldur's Gate) and visual novels. Witness dynamically changing dialogues, backgrounds, sprites, ambiance, music, sounds, and weather; all based on your current scene. The mode supports sprites and will show them with different expressions. You have an item inventory, an automatically updated journal storing information about your adventure, and an option to talk to your party whenever you feel like simply chatting with them instead of progressing.
  - Your party, and you, all have unique character cards, secrets, and goals to achieve. Remember to keep morale high.
  - Do dice rolls yourself or let the GM handle those for you.
  - Play with the interactive widgets, travel to different locations via a map, build a reputation with NPCs and factions, and explore a dynamically changing world.
  - Everything is handled on the backend. You just sit back, relax, and enjoy the experience.
  - Seriously, just try it. It's fun. I put a lot of time and effort into it, so you'd better enjoy it, or I'll explode.
- Automated sprite generation for expressions and full-body poses in character cards. These can be used for both roleplay and game modes.
- Saved presets for starting new roleplays and conversations.
- Option to save parameters (samplers) per connection.
- Select, duplicate, and manage multiple chats/characters/lorebooks/personas/etc. at once.
- More filters to sort by in lorebooks, and added an ability to lock entries from being edited by agents.
- You may now generate images based on the chat anytime by pressing the "Illustrate" button in the Gallery.
- Spellbooks were added as a separate lorebook category, used in combat.
- Added an ability to download and use Gemma-4-E2B, a tiny model that can be run even on mobile devices and can handle trackers in roleplays and scene analysis for the game mode.
- Other minor things I probably forgot about, have fun discovering them on your own.

### Fixed

- Expression Engine fix that prevented sprites from being generated.
- Messages will no longer disappear and reappear only upon page refresh.
- Scenes created out of conversations now inherit all the parameters from their original chat.
- Fixed a "niche advanced parameter bug", if you know, you know.
- Added full markdown support for roleplays.
- Various Termux/iPhone native fixes for both installation and UI.
- Text formatting with asterisks is now fixed.
- Bettered image generation support.
- Lorebook entries not working in scenes.
- Numbered lists now display correctly.
- You can now select a folder where your backup will be saved.
- No more random scroll-ups when editing lorebooks.
- Additional minor fixes that I can't be bothered enough to list, I want a break.

## [1.4.8]

### Added

- Added `pnpm check`, version-sync helpers, and PR CI checks for version drift.
- Added tracked-installer and release-note scripts plus a GitHub release workflow driven by `CHANGELOG.md`.

### Changed

- Startup config now resolves `.env` before env-sensitive server modules, normalizes repo-root data paths, and keeps `/api/*` 404s JSON-only.
- Shell launchers now align on the resolved `PORT`, honor launcher-level browser auto-open consistently, and pin pnpm to the repo version.
- Android now uses a build-time WebView server URL constant instead of a hardcoded Java literal, with optional `MARINARA_PORT` support in `android/build-apk.sh`.
- The client app shell now lazy-loads editors, right-panel surfaces, onboarding, modals, and the main chat surface to reduce initial bundle weight.

### Fixed

- **Vanishing messages after generation** — Messages could disappear at the end of streaming in Roleplay mode due to the browser and service worker serving stale cached API responses. Added triple-layer cache busting (server `Cache-Control: no-store`, client `cache: "no-store"`, and Workbox `NetworkOnly` for API routes) and hardened the streaming-to-message transition with retry-on-failure and double-rAF React commit timing.
- **Agent deletion foreign key constraint** — Deleting an agent no longer fails when chat history references its characters.
- **Mode switch caching** — Switching between Conversation and Roleplay mode now correctly invalidates the cached chat data.
- **Update system** — The in-app update check and notification flow now works reliably.
- `CORS_ORIGINS=*` now behaves as explicit allow-all without credentials, while explicit origin lists retain credentialed CORS support.
- GIF search no longer falls back to a shared embedded API key when `GIPHY_API_KEY` is unset.
- Sidebar tab text metrics were made explicit so descenders like the `y` in `Roleplay` no longer clip.
- Default log level changed to `warn` to reduce console noise.
- Cross-post redirect handling corrected.
- Restored local data-path compatibility so existing installs continue to resolve storage under `packages/server/data`.
- Update checks now resolve the newest GitHub `v*` tag even when `releases/latest` is stale.

## [1.4.7]

### Added

- **Persona Groups** — Organize personas into named groups with full CRUD and local storage.
- **Group Scenario Override** — Replace individual character scenarios with a single shared scenario for group chats.
- **AI Persona Maker** — Generate complete personas from a prompt using your LLM connection via SSE streaming.
- **Import Persona** — Import personas from PNG character cards or JSON files.
- **Quick Connection & Persona Switchers** — Floating popover switchers anchored to the chat input.
- **Notification Bubbles** — Floating avatar notification bubbles for unread messages in background chats.

### Changed

- **Personas Panel Redesign** — Search, sort, active/inactive filter, plus New and Import action buttons.
- **Quick Switcher Vertical Alignment** — Desktop quick switchers anchor to the input box container's top border.
- **Conversation Edit Simplification** — Removed keyboard shortcuts from message editing; explicit cancel/save buttons only.
- **Blank Line Collapsing** — Runs of 3+ consecutive newlines collapsed to a double newline.
- **OpenRouter Thinking/Content Block Parsing** — Correctly parses thinking and content blocks from reasoning models.
- **Claude 4.5/4.6 Temperature-Only Sampling** — Omits `top_p` for Claude models that only support temperature.

### Fixed

- Fixed quick switcher flash at (0,0) on mount.
- Fixed notification bubbles not triggering from normal generation path.
- Fixed notification character ID parsing (JSON string now properly parsed).
- Fixed empty conversation response guard.
- Fixed memory recall scoping.
- Fixed Lorebook Keeper scoping.
- Fixed missing `persona_groups` DB migration.

## [1.4.6]

### Added

- **Bot Browser** — Browse, search, and one-click import characters from Chub.ai directly inside the app. Includes paginated grid view, sort by downloads, stars, or trending, an NSFW filter toggle, and full character detail previews.
- **Chat Folders** — Organize chats into named, color-coded folders with drag-and-drop reorder. Move chats between folders, collapse or expand them, and filter by mode. State is persisted server-side.
- **Slash Commands** — Added SillyTavern-style commands with autocomplete, including `/roll`, `/sys`, `/guided`, `/continue`, `/as <character>`, `/impersonate`, `/remind <time> <message>`, `/random`, `/scene`, and `/help`.
- **AI Lorebook Maker** — Generate structured lorebook entries from a topic prompt using your LLM connection, with SSE streaming, batch support, and attach-to-existing-lorebook support.
- **Connection Duplicate & Test** — Clone existing connections, including encrypted API keys, and test connectivity with provider-specific checks.
- **ComfyUI Custom Workflows** — Paste custom workflow JSON with `%prompt%`, `%negative_prompt%`, `%width%`, `%height%`, `%seed%`, and `%model%` placeholders.
- **OpenRouter Provider Preference** — Select a preferred upstream provider when routing through OpenRouter.
- **Expanded Image Generation** — Added Pollinations, Stability AI, Together AI, NovelAI, ComfyUI, and AUTOMATIC1111 / SD Web UI alongside OpenAI-compatible image generation.
- **Plain Text Chat Export** — Export chat history as readable plain text alongside the existing JSONL format.
- **Embedding Base URL** — Configure a per-connection base URL for embedding endpoints.

### Changed

- **Performance — Streaming Re-render Optimization** — Extracted streaming UI into isolated components so the main chat area no longer re-renders on every streamed token.
- **Performance — Zustand Selector Batching** — Combined UI store selectors with shallow comparison and memoized style objects to reduce unnecessary re-renders.
- **Performance — Debounced UI Persistence** — Debounced `localStorage` writes and added unload or visibility flushes to reduce churn without losing data.
- **Chat Text Appearance** — Unified chat text color under a single setting and set the default text stroke width to `0.5px`.
- **Folder UX** — New folders now appear at the top, render above unfiled chats, and support inline rename plus hover-delete affordances.
- **Roleplay Input Responsiveness** — Tightened responsive spacing and flex behavior in the input bar to prevent overflow.
- **Home Page Mobile Layout** — Reduced mobile padding, constrained content width, and improved QuickStart card responsiveness.
- **Tracker Injection Order** — Tracker data now injects before Output Format for correct prompt ordering.
- **Settings Panel Polish** — Renamed reset actions to "Reset to default", removed redundant labels, and consolidated reset behavior.

### Fixed

- **Infinite re-render loop** — Wrapped the combined Zustand selector in `useShallow()` so `memo()` can short-circuit correctly.
- **Message background opacity** — Corrected roleplay bubble colors to match the intended Tailwind neutral palette.
- **New folders appearing at the bottom** — Fixed both the server-side sort order assignment and the client-side render ordering.
- **Missing DB column migrations** — Added `openrouter_provider`, `comfyui_workflow`, and `embedding_base_url` to startup column migrations.
- **Combat encounter `parseJSON`** — Corrected escape-sequence handling and added multi-stage sanitization for AI responses.
- **Additional fixes and polish** — Includes smaller bug fixes that shipped as part of the same release.
