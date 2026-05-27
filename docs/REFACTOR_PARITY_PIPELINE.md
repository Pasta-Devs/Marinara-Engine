# Refactor Parity Pipeline

This tracker is the working ledger for bringing the Tauri refactor branch back to Marinara Engine v1.6.1 functionality. The reference behavior is the current `main` line at v1.6.1; the implementation target is `refactor`.

## Ground Rules

- Port behavior, not the old Node runtime. Browser/client behavior belongs in `src/features`, domain behavior in `src/engine`, shared host adapters in `src/shared/api`, and privileged/native behavior in `src-tauri`.
- Keep chat, roleplay, and game mode ownership separate unless there is an existing shared abstraction.
- Prove each migrated feature with a focused check before marking it complete.
- Prefer lazy, requested-only loading. Opening one chat, roleplay, or game must not load unrelated conversations or heavyweight history.
- Do not hide failures behind fake success states. If a Tauri capability is missing or unsupported, surface a precise error.

## Loop

For each feature slice:

1. Investigate the v1.6.1 behavior and the current refactor behavior.
2. Implement the missing or broken behavior in the correct Tauri/refactor layer.
3. Verify with focused automated checks and, where needed, app-level manual testing.
4. Mark the slice complete or document the remaining gap before moving on.

## Initial Findings

- Embedded Tauri IPC currently has handlers for every frontend `invokeTauri` command found in `src`.
- Hostable remote runtime coverage is incomplete. Many embedded commands are not in the remote allowlist or HTTP dispatcher yet.
- Initial chat message loading is already paginated through `list_messages_for_chat_page`; freezes are likely caused by adjacent bulk reads, invalidations, derived counts, imports, deletes, or focus/refetch behavior rather than the first message page alone.
- Refactor has a TypeScript generation spine and Rust/native capability wrappers, but agents, streaming, prompt assembly, game mode, autonomous behavior, and imports still need proof against v1.6.1.

## Ordered Pipeline

Work proceeds in these lanes, one slice at a time. A lane only moves to complete when it has a code path, focused proof, and a note about any remaining app/manual pass.

1. Preset parity: selected prompt preset sections, wrap format, generation parameters, variables/choice blocks, import/export, and preview.
2. Agent parity: built-in/custom activation, prompt injection, custom tools, run cadence, memories/runs, and visible error state.
3. Game parity: setup, start, turn generation, repair/retry, tracker/game-state snapshots, assets, and UI affordances.
4. Autonomous conversation parity: background polling, cadence, idle/active status, schedules, unread state, and surfaced errors.
5. Profile/data migration parity: v1.6.1 imports for chats, messages, characters, personas, settings, presets, agents, memories, assets, and odd legacy rows.
6. UI/settings/integration parity: remaining stale controls, loading states, haptics, knowledge sources, GIFs, image generation, sprites, and app-level browser passes.
7. Runtime substrate parity: embedded and hostable remote command coverage, capability boundaries, and precise unsupported-capability errors.

## Parity Ledger

| Slice | Scope | Status | Proof |
| --- | --- | --- | --- |
| Runtime substrate | Embedded command coverage, remote command coverage, capability boundaries | In progress | Embedded coverage checked: no missing frontend handlers. Remote coverage still partial. |
| Profile/data migration | Import v1.6.1 chats, messages, characters, settings, presets, personas, agents, memories, assets | In progress | Legacy connected conversation notes and OOC influences now import into target chat notes. Rust checks can now run locally. |
| Chat/generation performance | Lazy chat open, deletion, list summaries, focus/refetch behavior, generation message loading | In progress | Normal generation now loads a bounded recent history window instead of the full chat; regeneration still loads broadly so old targets remain addressable. |
| Generation spine | Streaming, cancellation, prompt assembly, history roles, preset formatting, summaries, regex | In progress | Connected conversation prompt injection ported; stored chat/game generation parameters now merge into LLM requests; selected prompt preset params, wrap format, and choice variables now apply. Focused tests pass. |
| Agents | Agent enablement, prompt injection, tool calls, custom tools, agent memory/runs, UI state | In progress | Custom script tools restored and agent tool loops now prove script execution plus native custom-tool dispatch; Secret Plot memory now loads into agent prompts and persists fresh arc/direction output; saved agent runs include config IDs and display names for UI parity; chat-scoped built-in fallback agents now resolve without DB rows and per-chat selection overrides disabled global rows; empty agent responses now surface as failures; preset `agent_data` markers receive runtime output; parallel agent results are not double-counted. Focused tests pass. |
| Roleplay | Roleplay prompt assembly, typewriter streaming, character roles, scene/encounter/tracker hooks | In progress | Expression avatars restored; streaming views now read per-chat buffers. Need app/browser pass. |
| Game mode | Game services, start path, turn generation, repair flow, UI state, assets | In progress | Start guard restored and game turns now inherit stored generation parameters. Focused generation tests pass. |
| Autonomous conversation | Client polling, background cadence, idle behavior, schedules, error display | Not started | Need focused tests and app run. |
| Professor Mari | Persistent history, connection/tool requirements, compaction, loading state, animation | In progress | History no longer flashes welcome before load; persona and connection preferences persist; compaction/history tests pass. Need app/browser pass. |
| UI parity | Stale controls, input buttons, loading surfaces, status indicators | In progress | Chat bulk export format menu and several missing settings restored. Need app/browser pass. |
| Integrations | TTS, haptics, Spotify, knowledge sources, GIFs, image generation, sprites | In progress | Spotify mini player and TTS audio format restored; frontend and Rust checks pass. |

## Completed Slice: Connected Conversation Notes And Influences

This was the first completed parity slice because it crossed migration, prompt assembly, and generation behavior:

- Conversation `<note>` and `<influence>` tags are stored on the linked roleplay/game chat instead of being stranded on the source conversation.
- Roleplay/game prompt assembly injects durable notes and unconsumed one-shot influences using the v1.6.1 XML blocks.
- One-shot influences are marked consumed after they enter the prompt.
- Legacy `conversation_notes` and `ooc_influences` tables import into the target chat's `notes` array.

## Active Slice: Agent End-To-End Parity

Next target: prove and fill the remaining agent path after the preset fix:

- Verify built-in and custom agents trigger from normal roleplay generation, manual retry, and configured run intervals.
- Confirm remaining webhook app pass after script and native custom-tool dispatch proof.
- Audit remaining non-Secret-Plot memory-like outputs against v1.6.1.
- Check app-level visibility for agent failures, debug entries, and retry affordances.

## Completed Slice: Bounded Generation History Load

Normal generation no longer asks storage for every message in a chat before prompt assembly. It now loads a bounded recent window based on `historyLimit` plus a small margin, matching the maximum prompt history the assembler can use. Regenerating an old assistant message still loads without the bound because it may need to find an older target.

## Completed Slice: Settings And Tool Parity Batch

This batch restored several v1.6.1 surfaces that had regressed in the Tauri refactor:

- TTS audio format is back in settings and the Rust TTS proxy now forwards MP3/WAV to OpenAI-compatible and local TTS providers.
- OpenRouter service tier is back in generation parameters and is sent as `service_tier` for OpenRouter requests.
- Expression avatars are back for roleplay message rendering, with the duplicate expression sprite hidden from the VN overlay when enabled.
- Selected chats can export JSONL ZIP, Text ZIP, or native Marinara JSON from the sidebar.
- Custom script tools can be saved, selected, advertised to models, and executed in the Tauri TypeScript runtime.

## Completed Slice: Professor Mari Loading And Generation Parameters

This slice tightened the next broken user-facing paths:

- Professor Mari waits for stored history before rendering the welcome message, shows an app-styled restoring state, and keeps her sprite animated while loading.
- Professor Mari now persists the quick persona selection with the selected model connection and keeps input disabled until both history and preferences are ready.
- The shared generation engine now merges connection defaults, game setup parameters, game metadata parameters, per-chat parameters, and per-request parameters into the outgoing LLM call.
- Roleplay streaming/regeneration views read per-chat stream and thinking buffers so switching away and back does not lose typewriter text.
- Game start now rejects invalid session states, avoids duplicate intro generation when a GM turn already exists, and game user turns honor the global quote-format setting.

## Completed Slice: Agent Activation Fallbacks

The Tauri runtime now matches the important v1.6.1 agent behavior for chat-scoped built-ins:

- Built-in agents explicitly listed in a chat's `activeAgentIds` run even when no saved `agents` config row exists yet.
- A per-chat active agent selection overrides a disabled global config row, so disabling an agent globally does not silently suppress a chat that explicitly enabled it.
- Manual agent retries can resolve built-in fallback configs when only an agent type is requested.
- Synthetic fallback configs use the built-in default settings and default tool list, then fall back to the chat connection/model just like v1.6.1.
- Empty agent LLM responses are reported as failed agent results instead of successful no-op outputs.
- Preset `agent_data` markers receive pre-generation runtime output before the main model call.
- Parallel/post agent results are de-duplicated across callback and return paths before UI emission and generation metadata counting.

## Completed Slice: Agent Custom Tool Execution

Agent tool-calling now has focused parity proof in the refactor runtime:

- Tool-capable agents advertise selected custom tool definitions to the LLM.
- Script custom tools execute locally in the TypeScript generation runtime and feed JSON-serializable results back into the agent tool loop.
- Script bodies can use the current `args.foo` shape or legacy `arguments.foo` fields from imported profiles.
- Static/native custom tools route through the Tauri custom-tool integration and return their native result to the next agent LLM turn.
- The native `custom_tool_execute` command now reports a precise `custom_tool_script_unsupported` error when it is asked to execute a script tool directly, because scripts belong to the TypeScript generation runtime.

## Completed Slice: Secret Plot Memory

The Secret Plot Driver now carries its v1.6.1 long-running state through the Tauri generation runtime:

- Saved `overarchingArc`, active `sceneDirections`, `pacing`, `recentlyFulfilled`, and `staleDetected` memory are rebuilt into the agent-only `<secret_plot_state>` prompt block.
- Successful `secret_plot` results persist fresh arc and direction state back to `agent-memory`.
- Fulfilled directions roll into the last-ten `recentlyFulfilled` memory list so the agent has anti-repetition context.
- Missing directions clear stale active directions, matching the old server behavior.
- Saved agent run rows now carry both `agentConfigId` and `agentName`, restoring the joined run/config shape expected by the roleplay agents UI.

## Completed Slice: Prompt Preset Parameters And Variables

Preset-driven roleplay/visual-novel generation now restores the v1.6.1 behavior that was missing in the Tauri spine:

- The selected prompt preset's `parameters` merge into the outgoing LLM request between connection defaults and per-chat/request overrides.
- Prompt assembly uses the selected preset's `wrapFormat` before falling back to chat/connection/default wrapping.
- Prompt choice-block selections stored in chat metadata resolve as macro variables, including multi-select separator handling.
- Preset formatting parameters such as `strictRoleFormatting`, `squashSystemMessages`, and `singleUserMessage` influence prompt assembly.
- Prompt preview reports the same preset-aware parameter merge as live generation.
