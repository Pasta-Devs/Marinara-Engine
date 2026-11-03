# Audit: connections, settings and data guides

Scope: `docs/connections/*.md` (7 files), `docs/settings/settings-overview.md`, `docs/data/*.md` (4 files).
Checkout: `/tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/ro` (read-only). Code paths are relative to that checkout. "en.json" is `packages/client/src/localization/locales/en.json`. Line numbers refer to the guide file unless marked otherwise.

Method: link targets and heading anchors were checked by script (`scratchpad/audit/tools/check_links.py`); all relative links and anchors in the 12 files resolve. Ban-list counts come from a grep of the style-rule words and em dashes. Claims were checked against code and en.json; anything not checked is marked "unverified".

## Summary

| Guide | Lines | Priority | Main problems |
| --- | --- | --- | --- |
| connections/decision-models.md | 220 | High | Names a control that does not exist; wrong sidecar labels; very dense (~35% cuttable) |
| connections/local-model.md | 214 | High | "Local Model" is not the UI name (UI: "Built-in model") throughout; several button labels differ |
| connections/subscription-clis.md | 145 | High | Wrong Claude login command; wrong fast-mode dialog title; wrong checkbox label; unsupported Grok claim |
| connections/connecting-to-a-provider.md | 95 | High | Add-window section names wrong; "service" vs "provider"; built-in model location wrong |
| connections/local-self-hosted.md | 95 | High | Provider name "Custom (OAI-Compatible)" is wrong (UI: "OpenAI-compatible"); test labels wrong |
| connections/providers-reference.md | 276 | High (facts); length ~40% cuttable | Wrong heading name; embeddings default label; duplicated usage, audio and music material |
| connections/organizing-connections.md | 84 | Medium | "Usage and limits" label; delete-account behavior described wrong |
| settings/settings-overview.md | 175 | Medium | Defaults and labels mostly verified; "Feature Switches" name; hard-wrapped bullets; Message Tools table cuttable |
| data/backup-and-restore.md | 135 | Medium | Mostly verified; label case; hard-wrapped paragraphs |
| data/importing-from-sillytavern.md | 108 | Medium | "Import Chat always creates a Roleplay chat" is not true; tooltip text not found; hard wraps |
| data/clearing-data.md | 69 | Low | Accurate; jargon in category descriptions |
| data/where-data-is-stored.md | 65 | Low | Accurate; asset table is partial (labelled "main"); 2 em dashes |

## Top wrong facts (verified)

1. Claude sign-in command. `connections/subscription-clis.md:42` says `claude auth login`. Code uses `claude login` (`packages/client/src/components/modals/create-connection/shared.tsx:247`, `packages/client/src/components/connections/ConnectionEditor.tsx:2496`, `packages/server/src/services/llm/providers/claude-subscription.provider.ts:159`). A reader who copies the guide's command gets an error.
2. Local/custom provider name. Guides say "Custom (OAI-Compatible)" (`connections/local-self-hosted.md:17,23,31`; heading at `connections/providers-reference.md:201`). Code name is "OpenAI-compatible" (`packages/shared/src/constants/providers.ts:287`, `packages/shared/src/types/connection.ts:79`); en.json `connections.add.useCustom` = "Use any OpenAI-compatible address".
3. Decision "Recent-message token budget" control. `connections/decision-models.md:106` describes a setting with defaults of 30,000 and 3,500 tokens. No such label exists in en.json. The numbers are internal defaults (`packages/shared/src/types/connection.ts:53-56`, `defaultDecisionStateTokens`). Remove the UI claim.
4. Decision sidecar labels. `connections/decision-models.md:145-146` says "Decision sidecar (experimental)" and "Enable decision sidecar". UI: modal title "Built-in decision model" and toggle "Use the built-in decision model" (en.json `ui.modals.decisionmodelmodal.title` line 13610, `.enableToggle` 13580); card line "Built-in model (decisions)" (en.json 15603).
5. Fast-mode confirm dialog. `connections/subscription-clis.md:122` quotes "YOU DON'T WANT THIS SETTING ON!". UI title is "Turn on fast mode?" (en.json `ui.connections.connectioneditor.youDonTWantThisSettingOn` 11721; `ConnectionEditor.tsx:3828-3838`). Buttons "Enable anyway" and "Keep it off" are correct.

Also high impact, not in the top five: the built-in model is called "Built-in model" in the UI (en.json `connections.add.device.local_model` 1803; `packages/client/src/components/connections/BuiltInModelCard.tsx:53`), not "Local Model". The Add-window sections are Chat, Decisions, Images & video, Voice (en.json 1814-1817; `ServiceListStep.tsx:26`), not "Popular / Subscriptions / On your computer / All providers".

---

## connections/connecting-to-a-provider.md

- Main reader tasks: add a first account and pick Main; choose a model per job; choose a model for one chat. Findable: yes (first connections guide, linked from the other connection guides). The definitions and steps are in a good order.
- Verified correct: Connections panel items (Add, More actions, Jobs box); Jobs groups Chat, Omnibar, Pictures & sound, Behind the scenes (`packages/client/src/lib/connection-jobs.ts:50-127`; en.json `connections.defaults.group.*` 2088-2091); job labels Impersonate, Professor Mari, Quick answers, Image reading (en.json 2072-2075); "Make it my Main model", "Start chatting", "Done", "Try again", "Continue anyway" (en.json 2606, `connections.add.startChatting`, 1806, 1861, 1799); account editor fields Name, API key, Address, Requests per minute, Parallel jobs (en.json 1684-1685, 1833-1834); "Model for this chat" and "This chat only" (en.json 1458, 2629); "Search providers" (en.json 1847); "Search models and accounts" (en.json `connections.list.search` 2347).
- Wrong facts:
  - Line 26: "The Add account window lists providers under Popular, Subscriptions, On your computer, and All providers." The UI shows four kind sections: Chat, Decisions, Images & video, Voice (en.json 1814-1817; `ServiceListStep.tsx:26,121`). The Popular / plan / local / all grouping in `packages/client/src/components/modals/create-connection/shared.tsx:175-199` only orders tiles; it is not shown as headings.
  - Lines 7, 27: "service" is used for the thing you pick. The UI says "Which provider?" (en.json 1819) and "Search providers" (1847). Use "provider". Keep "service" for the Image, Video and Audio service pickers.
  - Line 13: "Built-in model under On your computer". The built-in model is a card under the Jobs box and a tile in the Add window labelled "Built-in model" (`BuiltInModelCard.tsx`, en.json 1803). Fix the location.
  - Address field name: the guide's line 36 uses "Address", which matches the account editor (en.json 1684). The connection (model) editor says "Base URL" (en.json `ui.connections.connectioneditor.baseUrl` 11469). `providers-reference.md:15` says "The connection's editor calls it Address", which is only half right (see that guide).
- Missing: what the reader sees after **Connect** when the key test succeeds and the window moves to model selection (line 30 gives the sequence but no visual cue). "Model" is used before it is defined as a saved model vs a catalog entry.
- Duplication: "Testing an account" (lines 63-65) overlaps the test steps in `local-self-hosted.md`. Owner: this guide for general tests; local-self-hosted for local servers.
- Length: 95 lines. ~5% cuttable.
- Ban-list: 0 hits.
- Priority: High (wrong Add-window structure on the first-run path).
- Unverified: the account-name pattern `OpenAI · …a1b2` (line 34) was not traced in code.

## connections/decision-models.md

- Main reader tasks: pick a Decision model; use a local model for decisions; set up a Decision connection; test it. Findable: yes as a linked guide, but the first task is buried after roughly 60 lines of explanation ("What a decision model is", "Where Marinara uses it", "What the model sees").
- Verified correct:
  - Thresholds: 0.5 for chat models and hosted sources (`packages/shared/src/constants/agent-activation.ts:3`); Open-Jev 0.1 (`packages/shared/src/types/decision-catalog.ts:163,200,226`).
  - Time limits: hosted 1.5 s (`packages/shared/src/types/decision.ts:130-135`, `systemOne: 1500`); OpenAI-compatible chat model 4 s (`decision.ts:148`); bounds 0.5-30 s (`decision.ts:141`); thinking at least 20 s (`decision.ts:133`); Open-Jev per-statement 0.35 s and 0.8 s (`decision-catalog.ts:169,203`).
  - Test waits max(10 s, limit + 5 s) (`decision.ts:163-165`).
  - Prompt statements and Smart response order read the last 5 messages; activation questions read Scan Depth, default 5 (`agent-activation.ts:1`; `packages/server/src/services/decision/prompt-decisions.ts:478`).
  - "Decision statements per turn": default 32, max 255 (`decision.ts:256-257`; en.json 2037).
  - Open-Jev download, disk and VRAM figures (`decision-catalog.ts`, `downloadSizeBytes`, `diskBytes`, `vramBytes`); compute capability 7.5 and driver 580 (`decision-catalog.ts:158,195` and `platforms`).
  - Source names TypeSafe, OpenRouter, Custom System One endpoint, OpenAI-compatible chat model (en.json 2045-2048); "Use this model for decisions" (en.json 1998); "Use this key for decisions" (2 hits); Thinking options Auto, Off, Allowed (en.json 2056-2058); "Time limit (seconds)" (2060); "Decision statements per turn" (2037).
  - Android turns `PROVIDER_LOCAL_URLS_ENABLED` on by default (`packages/server/src/config/runtime-config.ts:553-556`).
- Wrong or stale:
  - Line 106: "Recent-message token budget" control does not exist (no en.json string). The 30,000 and 3,500 values are internal defaults (`packages/shared/src/types/connection.ts:53-56`).
  - Lines 145-146: sidecar labels are wrong (top wrong fact 4). Line 148 says to select "Decision sidecar" in the Model for picker; the UI name is "Built-in decision model" (en.json 13610) or "Built-in model (decisions)" (en.json 15603).
  - Line 45: the group heading "Local models" is not a UI label. en.json `connections.decision.localGroup` = "Built-in model" (line 2030). "Connections" is correct (en.json 1999). "None" is "None (decisions off)" (en.json 2036).
- Missing: what the Decision row looks like after a successful test (one line). Terms used without a definition: "log-probabilities", "System One", "calibration", "sidecar", "thinks first", "Open-Jev" and "Jev". The guide never says what "2B" and "9B" mean.
- Duplication:
  - "Use a model you already run" (lines 69-86) and "On a server you already run" (88-95) repeat `local-model.md` (Decision paragraph) and `local-self-hosted.md` ("Use this model for decisions"). Owner: this guide.
  - Time limits are stated three times (Time limits section, Set up step 4, Thresholds). Keep the section; link the others.
  - `providers-reference.md` "Decision" section repeats the source list. Owner: this guide.
  - Statement syntax links to `prompts/conditional-prompts.md` and activation to `agents/custom-agents.md`; good, keep.
- Length: 220 lines, ~35% cuttable. Move to a reference section at the end: the wording-test numbers (lines 52-54, Gemma 32/32 and Open-Jev 31/31; not verifiable in code, see below), the Strands decider section (lines 112-130), the sizes narrative (136-156), and the budget detail in "What the model sees" (23-38).
- Ban-list: "just" (lines 34, 194). About 115 bold spans; many bold phrases are not UI labels (for example lines 42-48). Em dashes: 0.
- Unverified: the Gemma / Open-Jev wording-test counts (lines 52-54, 128) are test results, not code. Keep only with a source.
- Priority: High.

## connections/local-model.md

- Main reader tasks: set up the built-in model (install runtime, download a model, test); turn it on for trackers or scene analysis; use it for lorebook embeddings. Findable: yes (linked from the connection guides). The opening paragraph and "What the Local Model is" repeat each other.
- Verified correct (defaults and sizes):
  - `SIDECAR_DEFAULT_CONFIG` (`packages/shared/src/types/sidecar.ts:391-409`): contextSize 8192, maxTokens 4096, temperature 0.3, topP 0.95, topK 64, maxParallelJobs 2, native tool calls on, embeddingPooling "none", embeddingBatchSize 512, runtimePreference "auto", useForTrackers false, useForGameScene true.
  - Curated presets (`sidecar.ts:440-480`): Q8 5.4 GB download and 5.8 GB RAM; Q4_K_M 3.2 GB and 3.6 GB; 8-bit MLX 5.9 GB and 7.5 GB; 4-bit MLX 3.6 GB and 4.8 GB.
  - Whisper Tiny 180 MB and 350 MB RAM; Whisper Base 320 MB and 650 MB (`sidecar.ts:418-430`).
  - `SIDECAR_RUNTIME_INSTALL_ENABLED` (`packages/server/src/config/runtime-config.ts:775`; `packages/server/src/routes/sidecar.routes.ts:64`, error text "Sidecar runtime install is disabled").
  - en.json: "Local runtime unavailable" (2189); "Retry startup" (13749); "Reinstall runtime" (13746); "Download Whisper" (2239); "Delete Local Whisper" (2236); "Local speech model" (2252); "Use for tracker agents (roleplay)" (2234); "Use for game scene analysis" (2233).
- Wrong or stale labels (against en.json):
  - Card and dropdowns: "Local Model", "Local Model (sidecar)", "Local AI Model" → "Built-in model" (card 1803; setup window `ui.modals.modeldownloadmodal.localAiModel` 13713; dropdown 2604). "Local Model" appears 0 times in en.json. Line 17 says the UI uses "Local Model (sidecar)"; that is false.
  - Line 29: the card's buttons are "Download" and "Settings" (`BuiltInModelCard.tsx`; en.json 1923, 1928). "Download now" (2148) is used elsewhere.
  - Line 51: "Install MLX Runtime" → "Install MLX runtime" (13704). Line 51 "Install Runtime" → "Install runtime" (13705).
  - Line 57: "Skip for Now" → "Skip for now" (13759). Line 83: "Use Curated Preset" → "Use curated preset" (13779). Line 82: "Switch to Curated Preset" → "Switch to curated preset" (13764).
  - Line 128: "Send Test Message" → "Send test message" (11648). Lines 132-133 result texts "Local Test Message Succeeded/Failed" are not in en.json (unverified).
  - Line 146: "Use local model for all tracker agents" → "Use the built-in model for all tracker agents" (2232).
  - Line 148: "Scene Effects Connection" → "Scene effects model" (en.json 12536).
  - Line 152: lorebook picker "Local Model (sidecar)" → "Built-in model (on this device)" (en.json 2543).
  - Line 166: "Local Speech Model" → "Local speech model" (2252).
  - Line 59: the protected-action wording for runtime installs is unverified.
  - Line 122: "The app suggests 1024 for Gemma" is unverified.
- Missing: the card's states "Not downloaded", "Downloading", "Ready" (en.json 1926-1927) are not described. Terms used without definition: GGUF, MLX, llama.cpp, quantization (Q8, Q4_K_M), embeddings, pooling, GPU offload, physical batch. Add a "what you see" line after **Send test message**.
- Duplication: the Decision paragraphs (lines 15, 150-152) repeat `decision-models.md`. Owner: decision-models for decisions; this guide for the built-in model.
- Length: 214 lines, ~25% cuttable. Merge the first two sections; turn "Hardware and operating system support" (lines 33-44) into a 4-row table.
- Ban-list: 0. Links: all resolve.
- Priority: High (naming wrong in most sections).

## connections/local-self-hosted.md

- Main reader task: connect Ollama, LM Studio or KoboldCpp, then test. Findable: yes.
- Verified: local presets Ollama `http://localhost:11434/v1`, LM Studio `http://localhost:1234/v1`, KoboldCpp `http://localhost:5001/v1` (`packages/client/src/components/modals/create-connection/shared.tsx:238-243`); the list also has llama.cpp `http://localhost:8080/v1`, which the guide omits. `PROVIDER_LOCAL_URLS_ENABLED` (`packages/server/src/config/runtime-config.ts:553-556`). Warning "Only use URLs from providers you trust..." (en.json `ui.connections.connectioneditor.onlyUseUrlsFromProvidersYouTrustAMalicious` 11604). Windows firewall note exists (en.json 1 hit).
- Wrong or stale:
  - Lines 17, 23, 31: "Custom (OAI-Compatible)" → "OpenAI-compatible" (`providers.ts:287`; en.json 1862).
  - Line 23: "It is listed under On your computer." The tile sits in the Chat section (`ServiceListStep.tsx:26`). `SERVICE_GROUPS` id "local" (`shared.tsx:180`) is not a heading.
  - Line 77: "The model editor has a Connection Tests card" → "Provider tests" (en.json 11491).
  - Line 80: "Click Test Connection" → "Test provider" (en.json 11664). Line 82: "Send Test Message" → "Send test message" (11648).
  - Line 79: "Click your model in the Connections panel. The model editor opens." is unverified.
- Missing: the path to the server's `.env` file (line 65 says "Add this line to the server .env file" with no location; link `CONFIGURATION.md` or state where it lives). Line 71 says "restart the Marinara server" with no how-to. Base URL table omits llama.cpp.
- Duplication: "Test your connection" (lines 75-88) repeats `connecting-to-a-provider.md` ("Testing an account"). Owner: connecting guide for general tests; this guide for local servers.
- Length: 95 lines, ~10% cuttable.
- Ban-list: 1 ("Just set the Address instead.", line 31).
- Links: all resolve.
- Priority: High (provider name wrong on the main path).
- Terms: "Custom" (code id), "OpenAI-compatible" (UI), "Custom (OAI-Compatible)" (guide), "Address" (account editor) vs "Base URL" (connection editor).

## connections/organizing-connections.md

- Main reader tasks: fold, star, move or remove models; folders; Shuffle; export and import. Findable: yes.
- Verified: "More actions" items "Import account", "Export all accounts", "Fold all accounts", "Open all accounts", "Show only Off or Needs key", "Show cost badges", "Group by folder" (en.json 15278, 2337, 2339, 2345, 2330, 2351, 2293); account menu "Edit account" (1687 area), "Add model" (1 hit), "Add image model", "Select models", "Duplicate", "Turn off"/"Turn on", "Delete account" (1686-1694); model menu "Make default for", "Edit model", "Move to account…" (1755), "Add to Shuffle" (1752), "Remove from Shuffle" (1756), "Change picture", "Remove" (1 hit each); star "Star" (1757) and "Undo" (2580); export file names `.connection.json` and `marinara-connections.zip` (`packages/client/src/components/panels/ConnectionsPanel.tsx:484-488`).
- Wrong or stale:
  - Line 19 (Account actions, Edit account): "Usage and limits" → the section is "Usage and balance" (en.json `connections.usage.title` 2684). "Usage and limits" is not in en.json.
  - Line 26 (Delete account): "Marinara lists the jobs, chats, and agents that still use its models first." The UI blocks deletion while models exist ("This account still has models. Remove these first:", en.json 1690) and offers "Delete with its N models" (1688-1689). The jobs, chats and agents list is not in those strings (unverified where it appears).
- Missing: "gateway" (line 11) is explained only by example (LinkAPI). Define it in one clause. "via" headings are shown without an example screen.
- Duplication: account actions repeat the test steps in `connecting-to-a-provider.md` and `local-self-hosted.md`. Keep here; link from the others.
- Length: 84 lines, ~5% cuttable.
- Ban-list: 0. Links: all resolve.
- Priority: Medium.
- Unverified: "Stars are included; the provider's catalog is not" (line 168 of the export section in the source, not traced).

## connections/providers-reference.md

- Main reader task: find a provider's key page, base URL and quirks. Findable: yes as a reference, but there is no summary table at the top.
- Verified base URLs (all match `packages/shared/src/constants/providers.ts`): OpenAI 103, Anthropic 126, Gemini 162, Vertex 79, Mistral 185, Cohere 197, OpenRouter 209, NanoGPT 221, xAI 235, Arli 247, Z.AI 262, DeepSeek 276, Decision (TypeSafe) 316.
- Verified other claims:
  - Cohere v2 URL is switched to the compatibility endpoint (`packages/server/src/services/llm/provider-registry.ts:30`).
  - Gemini safety filters off except categories the user names (`packages/server/src/services/llm/providers/google.provider.ts:98-120`).
  - "Enable prompt caching" for Anthropic (en.json `ui.connections.connectioneditor.enablePromptCaching` 11515).
  - xAI prefill "grok-4.5" (`packages/client/src/components/connections/ConnectionEditor.tsx:2426`); Grok 4.6 and 4.7 at 500,000 context (`packages/shared/src/constants/model-lists.ts:679-680`); xhigh support for Grok 4.6 and 4.7 (`model-lists.ts:130-140`).
  - DeepSeek models `deepseek-flash` and `deepseek-v4-pro` (`model-lists.ts:742-743`); GLM 5.3 models (`model-lists.ts:782-783`).
  - Z.AI effort levels Low, High, Max map to `glm-request-compat.ts:60`; the "Maximum" label exists (en.json 5005).
  - Timeout variables `CHAT_GENERATION_TIMEOUT_MS` and `AGENT_CALL_TIMEOUT_MS` (`packages/server/src/config/runtime-config.ts:29-32` area).
  - NanoGPT usage-meter labels "Show the usage meter on the card" (en.json 2679), "Show usage" (2680), "Add a usage-only key" (2656), "Usage and balance" (2684).
- Wrong or stale:
  - Line 201 heading and line 205: "Custom (OAI-Compatible)" → "OpenAI-compatible" (`providers.ts:287`).
  - Line 15: "The connection's editor calls it Address." The account editor says "Address" (en.json 1684); the connection (model) editor says "Base URL" (en.json 11469). Both exist.
  - Line 266: "None (built-in local model)" → en.json `connections.embeddingDefault.none` = "Marinara's own search" (line 2269).
  - Line 152 and similar: the "API Key" and "Base URL" hidden-field claims for subscription providers are consistent with `ConnectionEditor.tsx:788`; keep.
  - Line 133 (Z.AI "Low, High, Maximum") is acceptable; line 142-146 (DeepSeek levels) is unverified in code, but the labels exist (en.json 5002-5007).
  - OpenRouter option is "Preferred provider" in en.json (1 hit); the guide writes "Preferred Provider". Case only.
  - Lines 238 and 255 (Audio and SunoAPI details) are unverified.
- Missing: "aggregator", "gateway", "OAuth", "service-account JSON" and "management token" are used without definition. Argon's "global, us and eu" location rule (lines 56-57) is a Google documentation claim, not in code (`google.provider.ts` checks only the host suffix); mark it as sourced from Google's docs.
- Duplication:
  - NanoGPT subscription usage (lines 95-112) and the Claude and ChatGPT plan-usage sections (156-191) repeat the same steps. Owner: `subscription-clis.md` for the CLI connections; NanoGPT stays here.
  - "Decision" (221-227) repeats `decision-models.md`.
  - "Audio" (229-240) and "Music & Sound Effects" (242-258) repeat `media/tts-setup.md` material. Owner: media guides (out of scope).
  - "Embeddings" (260-266) overlaps `lorebooks/semantic-search.md`. Owner: lorebooks guide.
- Length: 276 lines, ~40% cuttable. Move Audio, Music & SFX, NanoGPT usage and Claude/ChatGPT usage to their owner guides. Keep one table: provider | key page | default base URL | note.
- Ban-list: em dashes at lines 112, 142, 144 (5 total). Other ban-list words: 0.
- Links: all resolve.
- Priority: High (wrong heading and label facts).

## connections/subscription-clis.md

- Main reader task: sign in a CLI, add the subscription account, pick a model. Findable: yes.
- Verified: install and login commands for Claude Code (`npm i -g @anthropic-ai/claude-code`), Codex (`npm i -g @openai/codex`, `codex login`, `shared.tsx:248`), and Grok (`grok login`, `shared.tsx:249`; install line at `ConnectionEditor.tsx:2557`); Grok context default 32,000 (`packages/server/src/services/llm/providers/grok-subscription.provider.ts:44`); "Extended token caching (1 hour)" (en.json 11522); help text "Requires Claude Code 2.1.242 or later" (en.json 11657, UI copy only; not checked against Claude Code); "Use Claude Code fast-mode routing" and "Fast mode" (en.json 11697, 11523); "Diagnose model routing" (11504); reasoning level labels "Extra high" (`generationParameters.level.xhigh`, en.json 5007), "Max" (5004); "Default keeps Codex's own level" (5011).
- Wrong or stale:
  - Line 42: `claude auth login` → `claude login` (top wrong fact 1).
  - Line 75: "turn on **Use custom defaults for this connection**" → the UI says "Use custom defaults for this model" (en.json 11698).
  - Line 75: "GPT-5.6 and GPT-6 models go up to Max." Code shows xhigh for gpt-5.4, 5.5, 5.6 and 6 (`packages/shared/src/constants/model-lists.ts:130-140`). A separate "Max" level for 5.6 and 6 was not found in code (unverified). The "Max" label exists in en.json 5004.
  - Line 96: "The safest model for roleplay is usually grok-composer-2.5-fast." Code names it `GROK_CLI_SAFE_HEADLESS_MODEL_ID` (`grok-subscription.provider.ts:46`), i.e. safe for headless use. The roleplay claim is not in code. Reword or drop.
  - Line 122: confirm dialog title is "Turn on fast mode?" (top wrong fact 5). Buttons "Enable anyway" and "Keep it off" are correct (`ConnectionEditor.tsx:3830-3831`).
  - Line 98 and 139: "Grok CLI does not stream" is consistent with the provider (no streaming code path found in `grok-subscription.provider.ts`). Acceptable.
- Missing: "prompt caching", "Agent SDK" and "token" are used without definition (line 102 section). "Sign in", "login" and "login file" are used interchangeably; pick "sign in". A reader without a terminal is not told how to open one. Restart Marinara after install is not stated.
- Duplication: Claude and ChatGPT plan-usage text is repeated in `providers-reference.md` (lines 156-191). Owner: this guide for sign-in; keep one usage section here and link from providers-reference.
- Length: 145 lines, ~20% cuttable. The Fast mode (116-122) and Diagnose model routing (124+) sections can become a 3-row table. "Why there is no API key field" (110-114) repeats "What subscription connections are".
- Ban-list: "very" (line 98), "actually" (line 130). 2 total.
- Links: all resolve.
- Priority: High.
- Terms: "subscription" (UI "(Subscription)"), "plan" (UI "Plan" badge), "sign in" vs "login", "CLI", "Codex".

## settings/settings-overview.md

- Main reader task: find which Settings tab or section holds a control; understand General and Text Rules; learn how settings sync. Findable: yes, but the page covers too much (tabs, General summary, Message Tools, sync).
- Verified correct:
  - Six tabs (`packages/shared/src/constants/settings-registry.ts:71-102`); General sections (settings-registry.ts:110-169).
  - Search settings box (en.json "Search settings", 1 hit).
  - Text Rules labels (en.json 6592 "Bold dialogue in quotes", 6646 "Convert LaTeX symbols", 6722 "Quote style", 6688 "Load images from other websites in messages") and defaults: bold on, LaTeX on, quote style straight, remote images off (`packages/client/src/stores/ui.store.ts:2353-2358`).
  - Message Tools defaults: show context usage and older-messages note on; other toggles off; debug mode off (`ui.store.ts:2301` debug, `ui.store.ts:2334-2341` message tools).
  - "Confirm before deleting" on (`ui.store.ts:2349`); "Add a new line before /continue text" on (`ui.store.ts:2361`); "Hide chat Help button" off (`ui.store.ts:2441`); Achievements on (`achievementsEnabled: true`); Music Player on (`ui.store.ts:2372`).
  - Settings sync debounce 1 s (`packages/client/src/hooks/use-settings-sync.ts:56`); Display Size and Chat Font Size are per-browser (`use-settings-sync.ts:63-72`, keys `fontSize` and `chatFontSize`).
  - Interface languages: 12 codes including Arabic (`packages/shared/src/utils/ui-locales.ts:4-17`).
  - Documentation Language, "Download & Replace" (en.json 6535 area), "Fix documentation" (6526).
  - Custom notification sound: MP3, WAV, OGG, M4A, MP4, WebM (plus .oga), 10 MB cap (`packages/server/src/routes/notification-sound.routes.ts:22-29`; `packages/client/src/components/panels/settings/SettingControls.tsx:375`).
- Wrong or stale:
  - Line 27: "Feature Switches" → the section is "Features" (`settings-registry.ts:331-335`). The link to `configuration/features.md` resolves.
  - Lines 56-64: sub-group names ("Quick answers", "Around the app", "Appearance" inside the Search and Professor Mari section) are unverified. Only the section label "Search and Professor Mari" is verified (`settings-registry.ts:119-121`).
  - Line 53: "the Home screen shows the Achievements bookmark" is unverified.
- Missing: Admin Access is in Advanced (`settings-registry.ts:317-321`), but the overview does not name its tab-section path. Display Size is named but not located beyond a link.
- Duplication: the General Responses and Input & Editing bullets (lines 99-121) repeat `chats/sending-and-streaming.md` and `chats/messages.md`. The Message Tools table (lines 127-139) repeats `chats/messages.md` and `TROUBLESHOOTING.md`. Keep one-line pointers.
- Length: 175 lines, ~30% cuttable. Move the Message Tools table and the General summary bullets to a reference table; keep Text Rules and sync.
- Ban-list: "unlock" (line 53), "Intuitive" (line 116), "just" (line 153). 3 total.
- Hard wrap: App Behavior bullets (lines 44-48) and the Search and Professor Mari bullets (about 55-64) wrap across lines; one line per paragraph is the rule. About 3 pairs.
- Links: all resolve (`#choosing-a-model-for-one-chat` exists in the connecting guide).
- Priority: Medium.
- Terms: "tab" vs "section"; "Feature Switches" vs "Features"; "Advanced settings" vs "Advanced" tab.

## data/backup-and-restore.md

- Main reader tasks: download a backup; export a profile; restore with Import Profile; re-enter keys afterward. Findable: yes.
- Verified correct:
  - "Download Backup" (en.json `ui.panels.advancedsettings.downloadBackup` 14966); "Export Profile" (en.json `settings.transfer.exportProfile.title` 7221).
  - Export format labels "Marinara Native" and "Compatible JSON" (`packages/client/src/components/ui/ExportFormatDialog.tsx:51-52`). A third "Compatible PNG Card" appears only when enabled (line 54); it is not offered for profile export.
  - Import Profile (JSON/ZIP) in the Imports tab, section "Profile & Marinara" (en.json 15443; `settings-registry.ts:296-300`).
  - Profile file names `marinara-profile.json` and `marinara-profile.zip` (`packages/server/src/routes/backup.routes.ts:1832,1870-1876`).
  - API keys blanked in profile exports (`backup.routes.ts:764-771`, `apiKeyEncrypted: ""`).
  - `RESTORE.txt` in the backup (`backup.routes.ts:2691`).
  - Automatic backup file `marinara-automatic-backup.zip` and `backups/` folder (`packages/server/src/services/backup/automatic-backup-retention.ts:4`; `backup.routes.ts:292`).
  - Retention 1 to 9999 (en.json 14943); Daily, Weekly, Monthly (14934-14936); "Existing backups" (14968).
  - Backup media folders (`backup.routes.ts:98-119`) are wider than the guide's text (adds `notification-sounds`, `game-scene-videos`, `long-term-memory`).
- Wrong or stale:
  - Line 40: "Automatic Backups" → "Automatic backups" (en.json 14937).
  - Line 36: the backup includes "secret files used to unlock your saved API keys". Name the file `.encryption-key` and link `where-data-is-stored.md`.
  - Line 103 (missing-media warning in amber) and "Scanning Profile..." copy: unverified beyond the 1-hit en.json strings.
- Duplication: the Android notes repeat `where-data-is-stored.md` (Android section). Owner: backup guide for the steps; where-data keeps the location.
- Length: 135 lines, ~15% cuttable ("Access on the same device" and "Existing backups" can merge).
- Ban-list: 6 matches (line 12 "just", line 34 "easy", line 36 "unlock", line 99 "Very"; 2 more on the same pattern).
- Hard wrap: automatic-backup paragraph (about lines 40-54), about 12 line pairs starting at line 40. Fix.
- Links: all resolve.
- Priority: Medium.
- Terms: "backup" vs "archive" vs ".zip" vs "profile"; "profile file" (guide) vs "profile JSON" (UI copy).

## data/importing-from-sillytavern.md

- Main reader tasks: import one file (character, chat, preset, lorebook); import a whole SillyTavern folder. Findable: yes.
- Verified correct:
  - Single-file buttons "Import Character (JSON/PNG)", "Import Chat (JSONL)", "Import Preset (JSON)", "Import Lorebook (JSON)" (en.json 7223-7226); section "SillyTavern Import" (`settings-registry.ts:303-305`).
  - Wizard labels "Import from SillyTavern Folder", "Scan Folder", "Import Selected", "Browse", "SillyTavern Folder Path", "Choose exactly what to import", "Imported character tags", "Imported regex scripts", "Import complete!" (en.json 1 hit each).
  - Tag options "All tags", "No tags", "Existing only" and regex options "Character only", "Global" (`packages/client/src/components/modals/STBulkImportModal.tsx:81-91`). These strings are hard-coded English, not in en.json.
  - Seven categories (`STBulkImportModal.tsx`; `packages/server/src/services/import/st-bulk.importer.ts`).
  - Stock presets `deterministic`, `neutral`, `universal-*` (`st-bulk.importer.ts:176-182`).
  - Error text "Could not find SillyTavern data directory" (`st-bulk.importer.ts:229`).
  - `IMPORT_ALLOWED_ROOTS` (`packages/server/src/config/runtime-config.ts:787`; `packages/server/src/routes/import.routes.ts:99`).
  - Group chats import as Roleplay (`packages/server/src/services/import/st-bulk.importer.ts:737`).
- Wrong or stale:
  - Line 36 and line 40: "Import Chat (JSONL) ... always creates a Roleplay chat." Code: the mode comes from the request `mode` field if sent; otherwise from the file's header or Marinara metadata; only then defaults to roleplay (`packages/server/src/services/import/st-chat.importer.ts:322-327`; `packages/server/src/routes/import.routes.ts:551-560`). The Settings button sends no mode (`packages/client/src/components/panels/SettingsPanel.tsx:6770-6774`). Reword: "creates a Roleplay chat unless the file records another mode."
  - Line 40: the tooltip "Import SillyTavern or Marinara chat JSONL" is not in en.json or in the client code (unverified). Remove the quote or confirm it in the chat-list component.
  - Line 46: the window title "Import from SillyTavern" is unverified.
- Missing: "branch" (line 83, "branches of a single chat") is not explained. "World Info" is explained (line 13), good.
- Duplication: character and lorebook import are covered in `characters/import-export.md` and `lorebooks/import-export.md`; this guide links them. Good.
- Length: 108 lines, ~15% cuttable. "What does not transfer" (lines 95-101) repeats "What you can bring over".
- Ban-list: "really" (line 63). 1 total.
- Hard wrap: lines 54-55 and two more pairs. Fix.
- Links: all resolve.
- Priority: Medium.
- Terms: "chat" vs "chat log" (JSONL); "character card" vs "character"; "World Info" vs "lorebook".

## data/clearing-data.md

- Main reader task: clear selected categories, or all data. Findable: yes.
- Verified correct: Danger Zone location and description (`settings-registry.ts:387-389`; en.json 7116-7118); eight categories with descriptions (`packages/client/src/components/panels/SettingsPanel.tsx:506-530`); "Select All" and "Clear Selection", "Clear Selected Data", "Clear All Data", "Confirm Delete" (en.json 1 hit each); Chats & Messages clears gallery and scene-video folders (`packages/server/src/routes/admin.routes.ts:181-194`); Connections clears TTS, speech-to-text and Tripo keys (`admin.routes.ts:301-318`); Media clears avatars, sprites, fonts, backgrounds, gallery, knowledge sources and avatar models (`admin.routes.ts:330-345`); Professor Mari is kept.
- Wrong or stale: none found.
- Unverified: line 50 "you should see a confirmation message ... runtime caches were reset immediately" (not in en.json as quoted).
- Missing: category descriptions use terms a reader does not know: "scene/OOC data", "chat runtime state", "automation state", "knowledge-source files", "synced themes" (table, line 29 and following). Add a short plain definition or a link.
- Duplication: admin access (line 15) repeats `REMOTE_ACCESS.md`; link only.
- Length: 69 lines, ~10% cuttable.
- Ban-list: 0.
- Links: all resolve.
- Priority: Low.
- Terms: "clear" (UI) vs "reset" (title) vs "wipe" (lines 42, 54). Use "clear".

## data/where-data-is-stored.md

- Main reader task: find the data folder; know what to keep when moving data; copy data from Android. Findable: yes.
- Verified correct: `DATA_DIR` default is a `data` folder next to the server, overridable (`packages/server/src/utils/data-dir.ts:1-13`); Docker `/app/data` (`Dockerfile:99`; `docker-compose.yml:15`); startup log line `[storage] DATA_DIR=` (`packages/server/src/config/runtime-config.ts:919`); `storage` folder under DATA_DIR (`runtime-config.ts:402-406`); `.pre-shard` suffix (`packages/server/src/db/file-backed-store.ts:1440,3010`); `.encryption-key` in DATA_DIR (`packages/server/src/utils/crypto.ts:34,56`); `ENCRYPTION_KEY` override (`crypto.ts:33`; `runtime-config.ts:791`); `backups/` folder (`backup.routes.ts:292`); asset folders avatars, sprites, avatar-models, backgrounds, gallery, fonts, knowledge-sources, game-assets, custom-emojis, custom-stickers (`backup.routes.ts:98-119`).
- Wrong or stale: none.
- Missing or partial: the asset table is labelled "main asset folders" but omits `game-scene-videos`, `notification-sounds`, `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images`, `long-term-memory` and `conversation-call-character-videos` (`backup.routes.ts:98-119`). Add them or keep "main" and say the list is partial.
- Jargon: "storage", "ownership-grouped files", "table files", ".pre-shard" (line 21, line 29 area). Give each one plain sentence.
- Duplication: the Android section (lines 48-57) repeats `backup-and-restore.md`. Keep here as a pointer.
- Length: 65 lines; no cut needed.
- Ban-list: "simply" (line 50); em dashes (line 21, two). 3 total.
- Links: all resolve.
- Priority: Low.
- Terms: "data folder" (guide), "DATA_DIR" (env var), "storage" (folder), "encryption key file".

---

## Word list candidates

UI term, then synonyms seen in the docs, then a one-line plain explanation.

- **Account** (UI: "Add account", "Edit account") → "connection" (guides; UI also says "Chat Settings → Connection" and "Decision connection"), "key", "provider" → A saved key or sign-in for one AI provider.
- **Provider** (UI: "Which provider?", "Search providers") → "service" (Add-window text in the guides), "vendor", "backend" → The company or service an account talks to, such as OpenAI or Ollama.
- **Model** (UI: "Model for …", "Model for this chat") → "AI model", "model ID", "catalog" → One AI model you give a job or a chat.
- **Address** (UI account editor) → "Base URL" (UI connection editor and guides), "endpoint", "server address" (Add window) → The web address Marinara sends requests to. Say "Address" in account-editor steps; say "Base URL" only where the UI does.
- **Built-in model** (UI card and dropdowns) → "Local Model", "Local AI Model", "Local Model (sidecar)", "sidecar", "Gemma" → The small model Marinara downloads and runs on the same computer.
- **Built-in decision model** (UI modal) → "Decision sidecar", "Decision sidecar (experimental)", "Open-Jev sidecar" → The optional second model Marinara can install for yes-or-no decisions.
- **Decision** (UI job, group "Behind the scenes") → "Decision model", "Decision provider", "Decision connection" → The model chosen for the Decision job. Use "Decision model" for the chosen model and "Decision account" for the saved account.
- **Jobs box** (UI "Jobs") → "job", "role", "default" → The panel that shows which model does each job, such as Main or Images.
- **Main** (UI) → "chat model", "default model" → The model that writes replies in new chats.
- **Shuffle** (UI) → "random model", "rotation" → A setting where each reply picks a different model from your list.
- **API key** (UI "API key") → "key", "API Key", "secret", "password" → The secret code a provider gives you. Keep "API key" in the UI case.
- **Test** (UI "Test", "Provider tests", "Test provider", "Send test message") → "Test Connection", "Connection Tests", "Send Test Message" → A check that the key and address work.
- **OpenAI-compatible** (UI service name) → "Custom (OAI-Compatible)", "Custom", "OAI-compatible", "custom endpoint" → A server or proxy that speaks the OpenAI chat format.
- **Subscription** (UI "(Subscription)", "Plan" badge) → "plan", "sign-in", "login" → An account signed in through a local CLI instead of an API key.
- **Export Profile / Download Backup** (UI) → "backup", "archive", "profile file", ".zip" → Export Profile makes a restorable account file. Download Backup makes a full .zip of all data.
- **Import Profile** (UI) → "restore", "import backup" → Loads a profile or backup .zip into Marinara.
- **Clear / Danger Zone** (UI "Clear All Data", "Danger Zone") → "reset", "wipe", "expunge" → Permanently deletes chosen data categories. Use "clear".
- **Scene effects model** (UI game setup) → "Scene Effects Connection", "Local Model (Gemma)" → The model that picks backgrounds, music and weather in Game Mode.
- **Speech to text / Local speech model** (UI) → "Local Whisper", "Whisper" → Speech-to-text for calls, run locally with Whisper or sent to your own server.
- **Time limit** (UI "Time limit (seconds)") → "timeout", "budget" → How long a decision waits for an answer.
- **Decision statements per turn** (UI) → "question limit", "statement limit" → The cap on decision statements a turn may ask.
- **Imports tab / Profile & Marinara** (UI) → "Imports" → The Settings tab that restores profiles and imports from other apps.
- **Features** (UI, Advanced section) → "Feature Switches" (guide link text) → Optional feature on/off switches.
- **Automatic backups** (UI) → "Automatic Backups" (guide) → Scheduled full backups kept on the device.
- **Data folder** (guide) → "DATA_DIR", "data directory" → Where Marinara keeps your data on the server computer.
