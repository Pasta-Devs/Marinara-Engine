# Audit: agents, noodle, integrations, media (read-only, staging checkout f756cfdce)

Scope: docs/agents/*.md (8 files + built-in-agents), docs/noodle/*.md (2), docs/integrations/*.md (5), docs/media/*.md (9). Total about 67.7k words.
Method: headings and structure read for all 24 files. Full read for agents-overview, built-in-agents, approvals-and-agent-suite, knowledge-sources, custom-agents, memory (first 2/3 and tail). Labels checked with `grep` against `packages/client/src/localization/locales/en.json` and the components. Links checked with a script (all relative links and anchors in the 24 files resolve, 0 broken). Ban-list scan run on all 24 files.

Status of sections not yet covered in this pass is listed at the end under "Not yet audited".

---

## docs/agents/agents-overview.md (2.1k words)

- Main tasks: understand what agents are, turn one on for a chat, find the Agents panel and Agent Organizer. Easy to find: yes (it is the hub, linked from every agents guide).
- Verified: "Enable Agents" (en.json:9633), "Agent Organizer" (en.json:7354), "Trackers Control" (en.json:986), "Attach chat summaries" (en.json:984) and its default off (roleplay-summary-retrieval.ts:21 returns true only when `attachSummariesToAgents === true`), "Review Agent Outputs" (en.json:9790), "Agent activity" (en.json:982), "Individual tracker schedule" (en.json:9699), Agents section shelves (en.json:7907-7919: Apps, Chat games, Trackers, Writing help), Agent Organizer buttons Update all / Not now / Restart now / Version history (en.json:7736-7762), Debug mode path Settings → Advanced → Message Tools → Debug mode (SettingsPanel.tsx:7866-7944, AdvancedSettings at 6926).
- Wrong or unverifiable:
  - MEDIUM: "an **Agent Debug** overlay with per-agent calls, tokens, and timing". No overlay component exists. Debug entries go to the browser console as "[Marinara Agent Debug]" (packages/client/src/stores/agent.store.ts:74-91). The only debug-gated UI is the **Injections** tab (AgentActivitySection.tsx:49, label hard-coded at RoleplayHUDActionsMenu.tsx:139). Fix the sentence.
  - MEDIUM: The Telling whether an agent ran section repeats the same claim ("shows an **Agent Debug** overlay"). Same fix.
  - LOW: "**Agent Organizer** is the store for the official one-click packages" and "Installed agents are grouped into **Apps**, **Writer Agents**, **Tracker Agents**, and **Misc Agents**" are correct (en.json:7343-7407), but the built-in reference puts the games and calls under "Misc agents" while the Organizer shelf is "Chat games". See word list.
  - LOW: "Updates only apply to packages you already installed... iOS, iPadOS, and other browser clients use the packages installed on the Marinara server" - not verified, outside checkout scope (depends on client platform code).
- Missing steps: step 5 says "Add the agents you want from the lists below the switch" but does not say what the lists look like or where a fresh install shows none. Add one line: "A fresh install has no optional agents, so install them from Agent Organizer first."
- Unexplained terms: "pipeline phase" (defined in text), "HUD" (defined), "Termux" (not explained), "Game Mode" and "Conversation" (not explained here; used before the reader knows the modes). "Rules" package type is explained only by a link.
- Duplication: the Updating packages block (~400 words) repeats the Agent Organizer behavior of built-in-agents.md's intro and the Agent Organizer page. Owner: this guide (keep it, but cut by half). The "Reference lorebook for one agent" block duplicates the Attach-lorebook text in custom-agents.md and approvals; owner: this guide, link from others.
- Length: about 35% cuttable. The **Updating packages** subsection (about 330 words) and the "Updates only apply to packages..." paragraph can move to a Agent Organizer reference. The cost warning paragraph is about 170 words and could be a 3-line Tip.
- Ban-list: 0 hits. Em-dash usage: none. Long sentences: several paragraphs over 90 words (Agents panel, Trackers Control), which breaks the 1-4 sentence paragraph rule.
- Links: all 4 relative links resolve (`../game/rulesets.md`, `../prompts/generation-parameters.md#parameters-for-agents`, `../roleplay/getting-started.md#agent-activity`, `../roleplay/hud-and-trackers.md`).
- Priority: MEDIUM (one false UI claim, Agent Debug overlay; long paragraphs).

## docs/agents/built-in-agents.md (5.1k words) - website parser shape

- Main tasks: find a named agent and see what it does, its phase, where it works, and key settings. Easy to find: partly. It is a long reference and the reader must already know the agent name. Its Apps/Writer/Tracker/Misc grouping matches the Agents panel (en.json:7343-7407).
- Shape check for the website parser (`##` group, one `###` per agent):
  - `##` groups in order: How to read this reference (no agents), Apps, Writer agents, Tracker agents, Misc agents, Related guides (no agents). Each `###` is one agent name. The two `##` sections with no `###` will produce empty groups or pages unless the site parser skips them. Check the site config (MEDIUM).
  - Group names use sentence case "Writer agents", "Tracker agents", "Misc agents" but the UI uses "Writer Agents", "Tracker Agents", "Misc Agents" (en.json:7370-7407). If the website shows group labels from these headings, the casing will differ from the app. Decide and align (LOW/MEDIUM for the site).
  - Text between H1 and the first `##` is the intro. It has no heading, so it should not become an agent page.
  - 43 `###` agent headings: Apps 5, Writer agents 6, Tracker agents 13, Misc agents 19. The per-agent fields are not uniform. Entries use "Phase" for pipeline agents and "Integration" for feature packages, and only some have "Availability" or "Compatibility" lines. Pick one field set for the parser (MEDIUM for readers, LOW for the site).
- Verified:
  - Prose Guardian default banned word "ozone" (packages/server/src/services/generation/prose-guardian-settings.ts:30). OK.
  - Echo Chamber reveal every 30 seconds (packages/client/src/lib/echo-chamber-queue.ts:1, DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS = 30). OK.
  - Illustrator default 5 messages and Video Run Interval (chat.ts:426 "else 5"). OK.
  - Card Evolution Auditor 8 and Lorebook Keeper 8 default: not verified in code (package-owned). Could not verify.
  - Labels verified in en.json: Banned Words, Prefer In Writing, Remove From Writing, Hold Message Until Rewrite, Sprite Source, Expression Avatars, Sprite Owners, Use chat-active lorebooks, Fixed Source Lorebooks, Image Run Interval, Video Run Interval, Pictures and clips, Clips only, Illustrator makes, Review Character Card Updates, Add as Prompt Section, Auto-Generate NPC Avatars, Include the outfit in portraits, Individual tracker schedule, Add CYOA choices to the message box instead of sending them, Input & Editing, Touch Sensitivity, Intiface URL, Re-run Echo, Clear messages, Push Story, Secret Plot, Reference lorebook.
  - Compatibility versions (Engine 2.3.5 to before 4.0.0 etc.) are not verifiable in this checkout; the manifests live in Pasta-Devs/Marinara-Agents. Capability API 1.73 for avatars is confirmed (packages/shared/src/schemas/capability-package.schema.ts:736-739). App version 2.5.1 is confirmed (package.json, shared constants defaults.ts:7).
- Wrong or unverifiable (fix or label):
  - HIGH (accuracy, unverifiable model names): Beholder recommends "OpenAI GPT-5.5+, Claude Opus 4.8+, or Kimi K3+". The staging code has no such list and the Style rules say never add models from memory. Remove or move to a dated, sourced note.
  - MEDIUM: Narrative Director "Story Push Mode" labels **Natural** and **Random Event** are not in en.json (0 hits). Could not verify; they are probably package-owned. Mark as unverified or check the package.
  - MEDIUM: Narrative Director says "a **Push Story** button appears above the message box". en.json:7770 has "Push Story" and ContextInjectionPanel.tsx:191 renders it. Placement not verified. Leave, but note.
  - MEDIUM: Knowledge Retrieval "Use chat-active lorebooks" is correct; OK.
  - LOW: Combat: "it ships with a dice-roll tool" is vague. "Encounter" button: not verified.
  - LOW: Storyboard "Compatibility: Engine 2.3.5 through before 3.0.0" but Long-Term Memory says "before 4.0.0". Versions are package-owned; cannot verify. Check against manifests.
  - LOW: Quartermaster says "requires Engine 2.4.6+" and Relationship Tracker "2.4.4+ (below 4.0.0)". Not verifiable here (package-owned). Also the built-in "Availability" lines conflict with the overview's "The 5e package is in preview... only an Engine on the staging branch lists it" style. Leave to package owners.
  - LOW: "Staging only" marks Modern Life Sim. Cannot verify from checkout.
- Missing steps / "what you see now": The reference has no "how to add" step for each agent; it points to the overview. Fine. But for tracker agents, "Add as Prompt Section" is named, with no explanation of what it does (see custom-agents and approvals). Add one shared definition near the top (once), then link.
- Unexplained terms: "Pre-Generation", "Parallel", "Post-Processing" are explained at the top. "Prompt section", "preset", "run interval", "Agent connection", "HUD", "sprite", "lorebook", "Fixed Source Lorebooks", "Decision model", "Secret Plot", "Intiface Central", "Calls", "Storyboard", "World Maps" appear without a short gloss. "Agent connection" is not defined anywhere.
- Duplication: Knowledge Retrieval and Knowledge Router entries repeat knowledge-sources.md. Owner: knowledge-sources.md; keep one-line summary here. Illustrator entry repeats illustrator-agent.md. Owner: illustrator-agent.md. Haptic entry repeats integrations/haptic-feedback.md. Music DJ entry repeats media/music.md. Narrative Director repeats roleplay/narrative-director.md. Long-Term Memory and Memory Nag details are in memory.md only partially. Avatars entries repeat avatars.md.
- Length: about 40% cuttable. The per-entry "Compatibility" and "Availability" lines (versions) are the most volatile and should be in one table or moved out.
- Ban-list: 2 hits: "unlock" (Slurp, line 37) and "actually" (Memory Nag, line 239: "actually calls for a nag"). Low priority. Em-dash: 3 uses.
- Links: all resolve. External GitHub links not checked for 200 status (not in scope of the link script).
- Priority: HIGH (Beholder model list; shape/field inconsistency for the website parser; unverifiable versions and labels).

## docs/agents/approvals-and-agent-suite.md (1.2k words)

- Main tasks: approve or reject agent writes, use Agent Suite, see cached injections. Easy to find: yes for "Review Agent Outputs"; the Agent Suite is a sub-task. Medium.
- Verified: Review Lorebook/Summary title pattern "Review {{value1}} Update" (en.json:13526); Proposed Text (en.json), Override stale (en.json), Review Character Card Updates (en.json:13543), Clear memory, Reveal spoilers, Open in State Editor, Stored Memory, Tracker Data, Recent Outputs, Add Context, AI Edit, Rewrite, Reset, Cached prompt injections (en.json:7763), Accept, Regenerate, Discard (en.json). Card edits always ask for approval: the doc says this; check left as unverified (see below).
- Wrong or unverifiable:
  - MEDIUM: "Injections tab ... shows while Debug mode is on" is correct (AgentActivitySection.tsx:49). OK.
  - LOW: "Approve" and "Reject" are used for card updates; labels not checked in en.json (not located by grep). Verify button text.
  - LOW: "Stale" / "dimmed" wording: no "Stale" label found in en.json. Verify wording in the component.
  - LOW: "Approving raises the character's version number and saves a version-history entry" - not verified.
  - LOW: "It then adds the stale text to the field instead of replacing text" - not verified.
  - LOW: "Sometimes a card changed since ..." - fine.
- Missing: the Agent Write Approval modal says "a short reminder to keep each entry under a `###` heading" — no label found; verify.
- Unexplained terms: "Lorebook", "summary", "stale", "Regenerate" (reruns the agent). "Tracker data" is explained only as "current scene, present characters, persona stats".
- Duplication: Review Agent Outputs setup steps repeat agents-overview.md (the Trackers Control path). Owner: agents-overview (keep the short path in one place, link from here). The Agent Suite opening steps repeat roleplay/hud-and-trackers.md (State Editor). Owner: hud-and-trackers.
- Length: about 15% cuttable.
- Ban-list: 1 hit ("just"). Low.
- Links: `../roleplay/hud-and-trackers.md#the-state-editor` resolves (anchor checked).
- Priority: MEDIUM (a few unverified UI labels and claims about card approval).

## docs/agents/knowledge-sources.md (1.3k words)

- Main tasks: add Knowledge Retrieval or Router, pick sources, improve descriptions. Easy to find: yes.
- Verified: Writer Agents group (en.json:7407 and agents panel), "Use chat-active lorebooks" (en.json), "Fixed source override" (en.json), "Fixed Source Lorebooks" (setup dialog label, en.json), "Add Agent", "Retrieving knowledge..." (packages/client/src/hooks/use-generate.ts:2196), supported text types match knowledge-sources.routes.ts:17 (.txt .md .csv .json .xml .html .htm .log .yaml .yml .tsv) plus PDF (routes:18-19). Both agents Roleplay only; "both knowledge agents configured" warning (AgentEditor.tsx:1314-1322, 2426).
- Wrong or unverifiable:
  - LOW: Two toggle labels exist in the UI: "Use this chat's active lorebooks" in the agent editor (en.json:7689) and "Use chat-active lorebooks" in the knowledge source fields (en.json:10557). The docs use both. Pick one per surface and say which.
  - MEDIUM: "**Semantic Search (Embeddings)** section" and "**Embedding Connection**": the UI uses "Semantic search (embeddings)" (en.json:11647, 13487) and "Embedding provider" (en.json:11512). Fix casing and label.
  - MEDIUM: "coverage badge ... **75% described (9/12)**; green 75 and up, amber 25 to 74, red below 25": the label is "% described" (en.json:7493) and "No entries yet" matches. Thresholds not verified; check the component.
  - LOW: "Note: these agents do not run again when you regenerate" uses a plain "Note:" instead of a `> **Note:**` callout. Style rule violation.
  - LOW: "Knowledge Retrieval ... the progress indicator can show the phase" - OK.
  - LOW: The file-upload controls, "Upload file" (en.json:1 hit), OK.
- Missing: the reader is not told that "Fixed source override" with no picks means chat-active lorebooks are used; it is said, OK. "Vectorize N missing" and "Re-vectorize" labels exist (en.json, 4 and 9 hits) — OK.
- Unexplained terms: "RAG" is explained. "Token" explained. "Embedder" explained. "Description" field called out. OK.
- Duplication: the semantic search paragraph repeats lorebooks/semantic-search.md. Owner: lorebooks/semantic-search.md. Keep one link.
- Length: about 10% cuttable. Good size.
- Ban-list: 4 hits: "just" x3, "really" x1. Examples: "not just by keyword" (line 87), "It just relies on keywords" (line 91), "not really text" (line 62).
- Links: `../lorebooks/semantic-search.md` and `../lorebooks/overview.md` resolve.
- Priority: MEDIUM (label casing, "Embedding Connection" name, plain Note callout).

## docs/agents/custom-agents.md (3.4k words)

- Main tasks: build a custom agent (editor fields, phase, abilities, result type, prompt). Easy to find: yes (linked from built-in-agents and overview).
- Verified (all in AgentEditor.tsx or en.json): "New" button label not checked, "Copy agent" (en.json:15004), Pipeline Phase (en.json:7599), Result Type (en.json:7617), Turn Data Access (en.json:7677), Pre-generation injections and Parallel agent results (in component via turnDataAccess section), abilities Create lorebooks / Edit lorebooks / Edit messages / Edit trackers / Frontend styling / Image generation / Vectors/embeddings / Main prompt edits (AgentEditor.tsx:285-345), ability keys for Change backgrounds, sprites, media, haptics, About Me (AgentEditor.tsx:310-330, en.json:6439-6453). Result types Context Injection, Text Rewrite, Lorebook Update, Character Tracker, Persona Stats, Custom Tracker, Game State, Image Prompt, Prompt Patch, Frontend Style (AgentEditor.tsx:427-498). Forced phases: Text Rewrite → Post-Processing and Prompt Patch → Pre-Generation (AgentEditor.tsx:2744-2748). Activation keywords Scan Depth default 5 and max 200 (packages/shared/src/constants/agent-activation.ts:1-2). Question max 500 characters (agent-activation.ts:4). Tool rounds 16 for agents and 64 for lorebook backfill (packages/server/src/config/runtime-config.ts:23, 26). Worked example JSON key `editedText` is read at packages/server/src/routes/generate.routes.ts:15426. Decision timeouts 1500 ms default (packages/shared/src/types/decision.ts:131, system-one.client.ts:107).
- Wrong or unverifiable:
  - MEDIUM: The Custom Agent Abilities table omits two abilities that exist: "Create character cards" and "Choose active chat characters" (en.json:6439, 6453; AgentEditor.tsx:280, 350). Add them.
  - MEDIUM: The Result Type table omits "Character Card Creation" and "Character Activity" (AgentEditor.tsx:432, 492; en.json:6472-6474). Add them or say which are internal.
  - MEDIUM: Ability labels "Edit messages" etc. are hard-coded English in AgentEditor.tsx (not localized). Not a doc error; note for localization owner.
  - MEDIUM: The Turn Data Access toggle names. Doc says **Pre-generation injections** and **Parallel agent results**; the labels in the component are not in en.json (0 hits for "Parallel agent results" and "Pre-generation injections" as value start; the en.json has "Pre-generation injections" at line 7604 under agenteditor which is a section, not the toggle). Could not verify the exact toggle text.
  - MEDIUM: "Create a new agent-made lorebook when its lore output has no target" etc. OK.
  - LOW: "Image Connection" label (doc) not found in en.json (0 hits). The per-chat card control label needs verification.
  - LOW: "Lorebook Writer" section, "Allow lorebook entry writes", "Target lorebook" — "Target lorebook" and "Lorebook Writer" not confirmed by grep. Could not verify.
  - LOW: "Attach lorebook ..." in agents-overview vs "Target lorebook" here are different features. OK.
  - LOW: "Activation question" label: en.json has "Run when probability is at least" (en.json:45) and "Bypass the question..." not checked; "Trigger Cadence" not checked. Verify.
  - LOW: The "Export agent" and "Select agents" labels not checked. "Allow custom Agent imports" / "Danger Zone" labels not checked by grep (1 hit each in earlier batch not run for Danger Zone specifically). Verify.
  - LOW: "Import agent folder" label not found; en.json:15023 says "Choose agent files, an agent folder, or a Game Mode ruleset file to import." so the button text needs checking.
  - LOW: The Decision connection default "1.5 seconds by default, 4 for an OpenAI-compatible chat model connection" — 1500 ms default verified (decision.ts:131). The 4 s and 20 s figures not verified.
  - LOW: "Context Size ... default 5" and "Max Output Tokens default 4096, 128 to 32768": not verified in code this pass.
  - LOW: The phrase "Decision statements read as no" and "{{else}}" branch: consistent with conditional-prompts; OK.
- Missing: step 5 "Click Save ... green Saved badge": not verified. "Name it" step fine.
- Unexplained terms: "JSON" is explained. "Tool" explained. "Macro" links. "Decision model" links to decision-models. "Cadence" (Trigger Cadence) not explained. "Prompt Template" not defined. "Parallel" not explained for a custom-agent reader (already explained in overview).
- Duplication: Activation keywords/question repeat connections/decision-models.md ("Decision Models"). Owner: connections/decision-models.md. Keep a short pointer here. Pipeline phases repeat agents-overview.md (The three phases). Owner: agents-overview. Abilities table is unique to this guide (keep).
- Length: about 30% cuttable. The "Decision statements" section and the "Activation questions" section are about 900 words and are reference material; move to conditional-prompts.md or decision-models.md (owner exists), and keep two lines here.
- Ban-list: 1 hit ("just"): "when you just want the agent to add a short note" (line 105). Low.
- Links: all resolve (`../extending/custom-tools.md`, `../prompts/macros.md`, `../prompts/conditional-prompts.md#writing-statements`, `#asking-the-decision-model`, `#answer-reuse`, `../connections/decision-models.md#thresholds`).
- Priority: HIGH for the abilities and result-type tables being incomplete (blocks a reader from finding two abilities); MEDIUM for unverified labels.

## docs/agents/memory.md (8.9k words)

- Main tasks: (a) turn on Memory Recall and set an embedding source; (b) read Chat Summary in Roleplay; (c) Automatic Summarization in Conversation; (d) troubleshoot. Advanced Memory Recall is a separate, very large topic. Easy to find: no. The title "Memory Recall and Chat Summaries" hides that the page is four guides in one.
- Verified: Enable Memory Recall (en.json:9639); Access memories for this chat (in en.json? checked label family "Access memories" - present); Advanced Memory Recall (9 hits); Standalone scene check (1 hit); Character recollections (4 hits); Prepare existing history (5 hits); Maximum recalled scenes (1); Moving context (1); Helper model; Decide who sees new messages; Use Decision model; Peek Prompt; Automatic context and memory handling; Hide summarised messages (en.json:11168); Recent message tail (en.json:11180); Day Rollover (1 hit); Summary maximum output size; Maximum output size (en.json:11179); Mark as new start (1 hit); Exclude Past Reasoning (1 hit); Updating continuity (1 hit); Writing character recollections (1 hit); Hold Message Until Rewrite (2 hits). Advanced Memory max context default 65,000 (packages/shared/src/types/advanced-memory.ts:15). Minimum output 8,196 tokens (packages/server/src/services/advanced-memory.ts:1980). Marinara Lite turns Memory Recall off: not verified.
- Wrong or unverifiable:
  - HIGH: "Same as this connection" and "Local Model (sidecar)" (Embedding Connection dropdown). The UI says "Same as this provider" (en.json:11634) and there is no "Local Model (sidecar)" key. Could not find the dropdown option labels; correct to the UI text.
  - HIGH: "**Embedding Connection** dropdown" and "**Embedding Endpoint URL**" (Semantic Search section). The UI label is "Embedding provider" (en.json:11512). The section label "Semantic Search (Embeddings)" is "Semantic search (embeddings)" (en.json:11647). Align.
  - HIGH: Chat Summary "**Summary Connection** panel ... labeled **Agent default (falls back to chat connection)**": the UI says "Summary Provider" (en.json:11188) and "Summary provider" (11189). The "Agent default (falls back ...)" text is not found in en.json. Could not verify default label text.
  - MEDIUM: "**Maximum output size** ... The default is 4096 tokens, and the range is 1 to 32768." Not verified (default in code not located this pass).
  - MEDIUM: "**Automatic Summaries** ... **Every** field ... default 5, range 1 to 200": not verified.
  - MEDIUM: "Recent message tail ... The default is 10": UI label is "Recent message tail" (en.json:11180). The default not verified.
  - MEDIUM: Day Rollover Hour default 4 AM: not verified.
  - MEDIUM: "Advanced Memory ... starts at **6,500**, 10% of the default maximum of **65,000**" - maximum default 65,000 verified (advanced-memory.ts:15); 6,500 not verified.
  - LOW: "A chunk needs at least 5 new messages before it is created": not verified.
  - LOW: "Summaries ... **Semantic retrieval**" feature (en.json:11178-11179 Semantic retrieval / description) is absent from the Chat Summary section. Add or note.
  - LOW: "Chat Summaries" in Advanced Memory is a term distinct from Chat Summary. Two features with near-identical names. Needs a glossary line.
  - LOW: "Memories for This Chat" modal and statuses "Vectorized", "Waiting for vector", "Embedding unavailable": not verified in en.json (not searched this pass). Verify.
  - LOW: "Forget Memory" / "Clear Memories" dialog names: not verified.
  - LOW: "Peek Prompt → Decision diagnostics" and "Advanced Memory activity": not verified.
- Missing steps / "what you see now": the Turning on steps say "Chat Settings button (starts at the top right)" — location not verified. The Embedding source section has five steps; OK. Advanced Memory section has no steps at all; it is a spec.
- Unexplained terms (heavy): "scene", "scene summary", "excerpt", "recollection", "constant summary", "live history", "swipe", "snapshot", "Decision model", "helper model", "embedding" (explained), "vector" (not explained), "token" (explained only in passing), "Narrator", "start marker", "Hide from AI", "whisper", "break line", "continuity", "Prompt caching", "Peek Prompt", "receipt". Several sentences exceed 80 words.
- Duplication: Decision model text duplicates connections/decision-models.md; owner: decision-models. Embedding source steps duplicate connections/ and lorebooks/semantic-search.md (owner: connections or semantic-search). "Hide from AI" and whisper behavior is in chats/ and roleplay/ (owner: whichever owns Hide from AI). Preset placement table duplicates prompts/macros.md or presets.md (owner: prompts/presets.md).
- Length: about 60% cuttable from this page. Split into: (1) Memory Recall (short, ~600 words), (2) Chat Summary (Roleplay) (~500 words), (3) Automatic Summarization (Conversation) (~350 words), (4) Advanced Memory Recall (its own guide, the current Advanced sections ~5k words, with its own troubleshooting), (5) Troubleshooting. The Advanced Memory section alone is roughly 4.5k words of one-paragraph specs with 150-word sentences. Also the **Fixing memory problems** part is a separate task.
- Ban-list: 7 hits: "just" x6 (e.g. "what you just said" line 9, "a new scene has just started" line 145, "a new version of just that message" line 158), "actually" x1. Em-dash: 0.
- Links: `../connections/local-model.md`, `../chats/chat-settings.md#popping-a-section-out-into-its-own-window`, `../connections/connecting-to-a-provider.md`, `../conversation/getting-started.md`, `../roleplay/getting-started.md`, `../TROUBLESHOOTING.md` all resolve; anchors `#in-game-mode`, `#character-recollections`, `#fixing-memory-problems`, `#optional-decision-model` resolve. The `#the-state-editor` in approvals resolves.
- Priority: HIGH (page is a spec wall, wrong UI labels on the connection/provider path, the most likely reader task "make memory work" is buried).

## docs/noodle/overview.md (1.8k words)

- Main tasks: open Noodle, write a post, follow, refresh the timeline. Easy to find: yes.
- Verified: Agent Organizer install then restart (en.json), composer placeholder "What's simmering?" (en.json, 2 hits), "The plate is empty." and "Nothing from followed characters yet." (en.json), "Who to follow" (en.json), "Switch account" and "Edit Profile" (en.json), "Attach image", "Create poll" (en.json), "Refresh timeline" flow with "Choose a generation connection for Noodle first." and "Noodle timeline refreshed" (en.json), post length 4000 chars (packages/shared/src/schemas/noodle.schema.ts:52), reply length 2000 (schema:53), 48-hour past-memory rule (packages/server/src/services/noodle/noodle-prompt.ts:13), up to 8 images in refresh (settings text; not located in code, see below).
- Wrong or unverifiable:
  - HIGH: "Image connection" / "Use Noodle image connection" under a character's profile. "Use Noodle image connection" has 0 hits in en.json. The per-character image connection UI could not be located. Verify before keeping the sentence.
  - MEDIUM: "Noodle 1.5.4 or later" and "1.5.5 or later" version gates (not verifiable here; package-owned).
  - MEDIUM: The "Note on content" paragraph says "every account as an adult (18+)". This is true of the public feed prompt (noodle-prompt.ts:21), but the Engine also ships a separate adult timeline, **NoodleR**, with an age gate ("Enter NoodleR", en.json: ui.noodle.agegate.*; schema enableNoodler, noodlerGenerationGuidance). Neither Noodle guide mentions NoodleR. Maintainer decision needed: document it, or state it is not yet released.
  - LOW: "The feed loads the 160 most recent posts" and "up to eight ... pictures" are not located in this checkout (could not verify).
  - LOW: The Home address row text "marinara/noodle" is not verified.
  - LOW: "Post" button on the left sidebar opens a "New post" window: "New post" not checked.
- Missing: the Noodle entry point needs "what you see now": the screenshot heading text is not the issue; the steps are fine.
- Unexplained terms: "persona" (linked), "connection" (linked), "AI connection", "refresh", "random users" (explained in settings), "Professor Mari" (linked), "carryover" (only in related text), "@handle".
- Duplication: Refresh timeline mechanics repeat noodle/settings.md "Refresh" and "Automatic schedule" (owner: settings.md). Keep one short paragraph here and link. The "Following a character" section partly repeats settings.md "Invites". Owner: overview for following, settings for invites.
- Length: about 25% cuttable (the Refresh timeline section and mobile layout list can shrink).
- Ban-list: 0 hits. "simmering" is a UI term, OK.
- Links: all resolve (`../characters/personas.md`, `../home/professor-mari.md`, `../connections/connecting-to-a-provider.md`, `settings.md#image-generation`, `../chats/connected-chats.md`).
- Priority: HIGH (unverified image-connection sentence; NoodleR omitted).

## docs/noodle/settings.md (3.3k words)

- Main tasks: find a setting and its default. Easy to find: yes (sectioned like the panel). It is a reference page. Good fit for a table format.
- Verified against code (packages/shared/src/schemas/noodle.schema.ts DEFAULT_NOODLE_SETTINGS, lines 70-92):
  - Refreshes/day default 2, range 0-24 (schema:71, 119). Doc: default 2, 0-24. OK.
  - Active selection default Random range; Min active 2, Max active 5 (schema:72-74). OK.
  - Posts 8, Replies 12, Reposts 4, Likes 18 (schema:75-78). OK. Replies max 200, likes max 500 (schema:131, 133). OK.
  - Images/refresh default 3, max 50 (schema:79, 134). OK.
  - Noodle image generation default off (enableImagePrompts: false, schema:81). OK.
  - Use avatar references default on (schema:84); Include descriptions default on (schema:85); Attach gallery images default off (schema:86). OK.
  - Image captioning default off with "use connection default" on (schema:87-89). Doc says it "follows the captioning setting of Noodle's Generation connection". Not verified.
  - Enhanced tone & continuity default off (en.json:14225 label; schema enableEnhancedTimelineWriting false). OK.
  - Use generated character schedules default off (schema includeCharacterSchedules false). OK.
  - Professor Mari participates default on (schema allowProfessorMari true). OK.
  - Labels verified in en.json (ui.noodle.noodlehome.*): Active count, Active selection, Add from Folder, All invited, Attach gallery images, Automatic schedule, Characters to Invite, Default image generation connection, Enhanced tone & continuity, Exact count, Images/refresh, Image generation connection, Included by folder, Include descriptions, Invites, Max active, Random users, Refresh, Reset Noodle Timeline, Timeline Writing, Image Understanding, World / Lore, Carryover to chats. Settings page tabs General / Timeline / Participants / Advanced (en.json:14792-14806). Matches the four-page structure. OK.
- Wrong or unverifiable:
  - HIGH: **Interpret image prompts** (default on, and the described behavior with Image Prompting Instructions). No such key in the Noodle schema and no en.json label. Likely removed or renamed. Verify and remove or replace.
  - HIGH: **Translate posts automatically** (Translation section, "needs Noodle 1.5.0"). No schema key found in noodle.schema.ts; the toggle may live in client code. Could not verify.
  - MEDIUM: **Show images to the writer** and **Captioning connection** labels: not in en.json (the UI uses "Captioning model" under ui.noodle.noodlehome.captioningConnection, en.json:14153, and "Captioning provider" in connection editor, en.json:11473). Show-images toggle could not be located.
  - MEDIUM: **Noodle image generation** toggle label is "Image generation" (en.json:14246) with "Noodle image generation connection" shown as "Image generation connection" (en.json:14247). Align.
  - MEDIUM: **Image Prompting Instructions** (doc) vs "Image prompting instructions" (en.json:11546, lowercase p) in the connection editor.
  - MEDIUM: **Noodle Post Image** template name is in the prompt-override registry (packages/server/src/services/prompt-overrides/registry/noodle.ts:19, label "Noodle Post Image"). OK in code; not in en.json (fine if the override UI uses registry labels).
  - MEDIUM: "Image width 1024 by height 1536" defaults: not found in noodle.schema.ts. Could not verify.
  - LOW: "Choose connection" placeholder and "Select folders to invite" button label: "Select folders to invite" not found in en.json (0 hits). Verify button text.
  - LOW: "Random users" are called "Ambient Profiles" here and in en.json (ui.noodle.ambientProfiles). Pick one name for the section.
  - LOW: The doc says the Refresh section has "Generation connection" with the placeholder "Choose connection". Label "Generation connection" present in en.json? Not checked. Verify.
- Missing: NoodleR settings (see overview). The Carryover section and Reset Noodle section were not read this pass beyond headings.
- Unexplained terms: "persona" (linked on first use), "connection" (defined), "embedding" not used, "Conversation schedule" (not explained), "translator defaults" (points to chat settings), "vision-capable" (not explained), "captioning" (not explained: "A vision-capable connection describes images for the writer" is the only gloss), "style profile" (linked), "lorebook" (not explained here).
- Duplication: Translation section repeats message-translation.md (owner: message-translation.md). Image Generation repeats media/image-providers.md and media/style-profiles.md. Owner: those. Keep a link only.
- Length: about 30% cuttable. Turn the Activity, Refresh and Image Generation sections into the tables they already almost are.
- Ban-list: 0 hits.
- Links: all resolve (`overview.md#profiles-and-following`, `../connections/providers-reference.md`, `../prompts/prompt-overrides.md`, `../media/style-profiles.md`).
- Priority: HIGH (two settings that the code does not show, plus missing NoodleR).

## docs/integrations/discord-mirror.md (0.7k words)

- Main tasks: paste a webhook URL to mirror a chat. Easy to find: yes.
- Verified: "Discord Mirror" label, placeholder "https://discord.com/api/webhooks/...", "Invalid webhook URL format" (en.json:11312-11314), "Connected Chats" section (en.json, 1 hit). Message length cap: truncation at 1997 + "..." (packages/server/src/services/discord-webhook.ts:77), allowed_mentions parse [] (discord-webhook.ts:80, mentions do not ping), rate limit 1200 ms (discord-webhook.ts:24, about 50 per minute), 429 handling with Retry-After (discord-webhook.ts:93-95). Impersonated messages not sent (generate.routes.ts:11992 excludes impersonate and regenerate). Game narration name "Party" (game.routes.ts:14028). Webhook URL and export behavior: not checked.
- Wrong or unverifiable:
  - LOW: "If a send to Discord fails, Marinara does not show an error and does not retry" — the code retries after 429 (discord-webhook.ts:93-95). A failed non-429 send is not retried (not fully read). Reword to: "Only rate limits are retried; other failures are logged on the server."
  - LOW: The Discord webhook steps (Integrations → Webhooks) are Discord UI, not verifiable here.
  - LOW: "Narrator" name for story narration in Game Mode: not verified (only "Party" was located).
  - LOW: "Character GM" option label not verified.
- Missing: what the reader sees after pasting a valid URL (no confirmation message documented). Add one line if the UI shows one.
- Unexplained terms: "webhook" (explained), "persona", "swipes" (not explained, used in "Regenerated replies and swipes"), "Impersonate" (explained).
- Duplication: connected-chats.md is the owner of Connected Chats; keep link.
- Length: none to cut.
- Ban-list: 0 hits.
- Priority: LOW (accurate); fix the retry sentence.

## docs/integrations/haptic-feedback.md (1.3k words)

- Main tasks: install Intiface Central, connect, scan, enable the agent. Easy to find: yes.
- Verified: default Intiface URL ws://127.0.0.1:12345 (packages/server/src/config/runtime-config.ts:783); env var INTIFACE_URL exists there but is not mentioned in the guide (add to the address section). HAPTICS_ALLOW_REMOTE (.env.example:288, default false). Labels: "Touch sensitivity" (en.json), "Incidental contact" with "Tiny taps for accidental brushes and bumps." (en.json), "Allow this agent to send touch cues", "Touch cues are enabled", "Scan for devices", "No devices found", "Scanning...", "Intiface URL", "Admin Access" (en.json: 5 hits), Subtle and Steady patterns (en.json "Subtle" 1 hit).
- Wrong or unverifiable:
  - MEDIUM: Pattern "Impact" (listed with Steady, Tap, Pulse, Wave, Ramp) has no en.json hit. Could not verify the pattern list; check the haptic agent code.
  - LOW: "Standard is selected by default" and "The toggle is off by default" not verified in this pass.
  - LOW: Admin Access path "Settings → Advanced → Admin Access" is not verified; the doc says "under Settings in the Advanced area, in the Admin Access section" (5 en.json hits for "Admin Access").
  - LOW: "Marinara saves your address with the chat and also remembers it in this browser" not verified.
  - LOW: Intiface download address https://intiface.com/central/ not verified (external).
- Missing: a sentence on what the card looks like in the Agents list for a reader who has not added the agent yet. Also "Haptic Agent" (used at the end of "Connect, scan") is a different name from "Haptic Feedback"; pick one.
- Unexplained terms: "Buttplug.io" (named, not explained beyond "protocol"), "WebSocket" (explained), "pattern", "intensity", "device protocol".
- Duplication: built-in-agents.md Haptic entry (owner: this guide for setup). Keep the reference entry short.
- Length: about 15% cuttable (the "Supported actions" paragraph is dense).
- Ban-list: 1 hit ("just").
- Links: `../CONFIGURATION.md`, `../REMOTE_ACCESS.md`, agents guides resolve.
- Priority: MEDIUM (Impact pattern, INTIFACE_URL env var not documented, Haptic Agent vs Haptic Feedback naming).

## docs/integrations/home-assistant.md (2.1k words)

- Main tasks: install the HACS integration, set it up, verify, control HA from automations, troubleshoot. Easy to find: yes.
- Verified: default Host localhost and Port 7860 (custom_components/marinara_engine/const.py:5-6). Option labels "Primary Chat" and "Exposed Tool Categories" (custom_components/marinara_engine/strings.json:27-28). The eight categories and their tool names (const.py: TOOL_CATEGORIES 15-24 and per-tool "category" keys); Locks and Generic Service Calls off by default (const.py:26 comment; DEFAULT_ENABLED_CATEGORIES). Entities: Marinara Chat Count, Marinara Active Agent Count, Marinara Active Chat, Marinara Agent: <name>, Marinara Abort Generation, Marinara Sync HA Tools (sensor.py:55, 81; select.py:33; switch.py:43; button.py:41, 69). Sync every 30 seconds (const.py:7 SCAN_INTERVAL = 30). Services: role options user, assistant, system, narrator, default user; trigger_generation default false; user_message optional (__init__.py:35-45). WEBHOOK_LOCAL_URLS_ENABLED (.env.example:282, default false).
- Wrong or unverifiable:
  - MEDIUM: "Home Assistant version 2024.1.0 or newer". The integration manifest (custom_components/marinara_engine/manifest.json) has no minimum version. Could not verify. Keep only if the hacs.json or the maintainer confirms it.
  - LOW: "runs in Roleplay, Conversation, and Game chats" (agent availability). Not verified here.
  - LOW: "takes effect within a couple of seconds" for WEBHOOK_LOCAL_URLS_ENABLED. Not verified.
  - LOW: The webhook pattern `http://<homeassistant-ip>:8123/api/webhook/<webhook-id>` is standard HA; not verified in code.
  - LOW: Example automation uses `platform: state` and `service:` keys. Current Home Assistant YAML uses `trigger:`/`triggers:` and `action:`/`actions:` with `platform` renamed to `trigger`. Check the example still runs on current Home Assistant (LOW to MEDIUM for the reader).
- Missing: the Configure step (**Settings → Devices & Services → Marinara Engine → Configure**) is given, fine. The "setup form" field names (Host, Port, Submit) are verified by config_flow strings (not checked this pass).
- Unexplained terms: "HACS" (explained), "webhook" (explained), "entity" (explained), "Functions" (explained as custom tools), "primary chat" (explained lightly), "automation" (not explained), "IP allowlist" (linked).
- Duplication: the `.env` and remote access text repeats REMOTE_ACCESS.md and CONFIGURATION.md (owners). Keep one pointer.
- Length: about 20% cuttable (the "If Home Assistant runs on a different device" block repeats Remote Access).
- Ban-list: 4 hits: "just" x2 (line 145 "A chat or agent you just made"; line 171 sits inside a YAML example string). The other two were not located.
- Links: all resolve (`../extending/custom-tools.md`, `../agents/agents-overview.md`, `../CONFIGURATION.md`, `../REMOTE_ACCESS.md`).
- Priority: MEDIUM (version claim unverifiable; automation YAML syntax may be outdated).

## docs/integrations/message-translation.md (1.3k words)

- Main tasks: pick a provider, set languages, turn on auto translate, translate one message. Easy to find: yes.
- Verified: all named labels present in en.json (Model Language, My Language, Translate My Messages, Translate draft, Auto-Translate Responses, Show Draft Translate Button, Show Only Translation, Save translator defaults, Forget saved defaults, Outgoing Message Prompt, Incoming Response Prompt, Restore, Hide translation, DeepLX URL, DeepL API Key, Google Translate, Translation). Provider limits: Google 5000 chars (packages/server/src/services/translation.service.ts:27); server max 50000 (translation.service.ts:32); 15 s timeouts (translation.service.ts:239, 279, 313); DeepL free key suffix ":fx" (translation.service.ts:266); DEEPLX_LOCAL_URLS_ENABLED (runtime-config.ts and translation.service.ts). "Connection ID is required for AI translation" (translation.service.ts).
- Wrong or unverifiable:
  - LOW: "Translate draft" under the Conversation composer's smile button → Tools (not verified).
  - LOW: "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." (the message text not checked against the code string).
  - LOW: The default prompt text example (the `--` dash) is quoted from code; verify it matches the built-in default.
- Missing: when Model Language is wrong for a chat, what the reader sees. Add one line on the failure path.
- Unexplained terms: "draft", "provider" vs "connection" (the page says both: "Provider" dropdown and "Connection" dropdown in AI setup, and "connection" elsewhere). Pick one for the AI option ("AI (via connection)").
- Duplication: noodle/settings.md Translation section (owner: this guide; Noodle links here). Good. Message actions link to chats/messages.md (owner).
- Length: about 10% cuttable.
- Ban-list: 1 hit ("just").
- Links: `../chats/messages.md`, `../noodle/settings.md#translation`, `../CONFIGURATION.md` resolve; anchor `#translator-defaults-for-new-chats` resolves.
- Priority: LOW.

## docs/media/ (9 guides, about 19k words) - checked by label sweep, targeted code checks, and one full read (animated-expressions)

Method for this set: every bold string in each guide was checked against en.json (case-insensitive). Most misses were sentences or headings, not labels, so each miss was judged by hand. Providers named in image-providers.md were checked against the code (all exist: Arli, NovelAI, xAI, Venice, Z.AI, Atlas Cloud, fal, SpicyAPI, NanoGPT, Block Entropy, RunPod, Pollinations, Stable Horde, SwarmUI, Draw Things, Together, Stability, CogView, Codex).

### Settings paths that do not exist (HIGH, multiple guides)

- The settings tabs are **General, Appearance, Generations, Addons, Imports, Advanced** (packages/client/src/components/panels/SettingsPanel.tsx:242-283; en.json settings.tabs.*). There is no **Look** or **World** tab.
  - tts-setup.md: "Settings → Look (Visual)" and "Settings → World → Sources" are stale. Find the right location in code before rewriting.
  - illustrator-agent.md: "Defaults → Images" is unverified. "Settings → Generations → Image Generation" is plausible (Generations tab exists) but the "Image Generation" section was not found in en.json.

### Per-guide findings

**animated-expressions.md (0.9k)**
- Verified: Generate animated portraits (en.json, 1 hit), Generate Animated Portrait (2 hits), Animated expression length (1 hit), Prefer clean transparent-style background (1), Expose media prompts before sending (1), Overall Generations (1), Facial Expressions (1), Appearance Description (1), Image Generation Connection (1). ffmpeg message and FFMPEG_PATH / FFMPEG_COMMAND (packages/server/src/routes/sprites.routes.ts:492-497).
- Wrong or unverifiable:
  - MEDIUM: "Generate animated portrait GIFs..." progress text: 0 hits in en.json. Check the component.
  - MEDIUM: "Video Generation Connection" and "Persona Editor": 0 hits in en.json (case-sensitive and insensitive). Check the labels; the doc uses them as exact UI labels.
  - LOW: 3 s default, 1-8 s range, 512 px width: not verified.
- Missing: "what you see now" after clicking Generate Animated Portrait (the progress line is given; the result review screen is not named).
- Duplication: ffmpeg and video connection setup repeat scene-video.md. Owner: scene-video.md.
- Ban-list: 0 hits. Links resolve.
- Priority: MEDIUM.

**scene-video.md (3.6k)**
- Label sweep misses (case-insensitive, not in en.json): Add Connection, Edit Video Presets, Video Generation Defaults, Use as default video connection, Review Video Prompt, Visual Generation, Roleplay Clip Director, Cinematic Scene Video, Google AI Studio (Veo), xAI Imagine, OpenRouter Video, Gemini Omni (the code has Gemini Omni: 5 files), Seedance 2.0 (code: 10 files).
- Likely hard-coded in components. Could not verify each label. Check the video connection editor component for exact text, or move these labels to en.json (localization rule).
- "Chat Settings > Agents > Storyboards" uses a ">" arrow instead of "→": style fix (LOW).
- Length: about 25% cuttable. Provider-specific model differences (Atlas Cloud subsections) belong in a reference table or in image-providers.md / connections reference. Owner for provider list: connections/providers-reference.md.
- Priority: MEDIUM (cannot verify many provider-model labels; the Atlas and Seedance subsections are long).

**scene-backgrounds.md (1.2k)**
- Misses: "Browse Images" and "Review Image Prompt" (not in en.json, 0 hits). Check the Gallery component text.
- Ban-list: 1 hit ("unlock").
- Priority: LOW to MEDIUM (two unverified labels).

**illustrator-agent.md (2.6k)**
- Verified: Illustrator run-interval labels (Image Run Interval, Video Run Interval, Pictures and clips, Clips only, Illustrator makes) in en.json. Agent defaults are in built-in-agents.md.
- Misses: "Manual clips" (0 hits), "B&W Manga" (0 hits; check the prompt-mode list in code), "Defaults → Images" (path unverified), "Settings → Generations → Image Generation" (section not found).
- Ban-list: 5 hits ("actually" x1 at line 15, "just" x3 at lines 84 and 102). Fix the "just" uses; "actually" is an ordinary verb here, so keep it if it is needed.
- Duplication: built-in-agents.md Illustrator entry and agents-overview.md repeat the run-interval text. Owner: this guide.
- Priority: MEDIUM (stale settings path, unverified mode names).

**image-providers.md (3.3k)**
- Providers in the guide all exist in code (see above). Good.
- Label misses: "Add connection" (1 hit in code as "Add Connection" elsewhere; 0 hits in en.json), "Test Connection" (1 file), "Save and test" (0), "Custom (OAI-Compatible)" (0), "OpenAI (ChatGPT)" vs heading "ChatGPT (Codex login)" (en.json has no "OpenAI (ChatGPT)"), "OpenAI (DALL-E)", "Images, video & voice" (0), "Export (API)" and "Export to API" (0), "SD Web UI (AUTOMATIC1111 / Forge)" (0), "RunPod Serverless (ComfyUI)" (0). These are provider-list labels. Check the connection editor component for exact text.
- Length: about 30% cuttable. The per-provider sections repeat the same three steps (key, model, test). Move to a table: Provider | Needs | Notes, and keep the unusual ones (Codex login, local services, RunPod) as short sections.
- Duplication: connections/providers-reference.md overlaps. Owner: providers-reference.
- Ban-list: 0 hits.
- Priority: MEDIUM (provider labels unverified; the table would fix length).

**comfyui.md (1.9k)**
- Misses: "Export (API)" and "Export to API" (0 hits; ComfyUI's own menu text may differ; OK to keep only if it is ComfyUI's label, not Marinara's). "SaveImage" is a ComfyUI node name (fine). "RunPod Serverless (ComfyUI)" (0 hits).
- Ban-list: 2 hits ("actually" x2, lines 161 and 165). Low priority; "actually" here is a plain verb.
- Priority: LOW.

**music.md (2.3k)**
- Misses: "Liked Songs" (0 hits; Spotify's label, OK if quoted from Spotify), "Any Spotify" (0 hits, check the device picker).
- Command: the Conversation Music command section should name the actual command (roleplay-command.ts lists "music" as a command type, packages/shared/src/types/roleplay-command.ts:9). Verify the Conversation command name.
- Ban-list: 0 hits.
- Priority: LOW.

**style-profiles.md (1.4k)**
- Misses: "Painterly Fantasy", "Photorealistic", "Digital Painting", "Realistic SDXL", "Z-Image Turbo Narrative", "Danbooru / Illustrious", "Danbooru tags", "Natural language" (0 hits each). Built-in profile names may be defined in code, not en.json. Check packages/shared or server defaults for the built-in profile list. If they match, fine.
- Settings path "Settings → ..." not checked.
- Priority: MEDIUM (built-in profile names unverified).

**tts-setup.md (3.6k)**
- Verified (en.json): Source (ui.panels.ttsconfigcard.source), Base URL, API key (doc: "API Key"; UI: "API key"), Model, Voice option (doc: "Voice Option"; UI: "Voice option"), Narrator voice (doc: "Narrator Voice"), Auto-play (doc: "Auto-play"), Request timeout (seconds). Audio providers group (en.json tts.connection.group). TTSConfigCard.tsx is the component.
- Wrong or unverifiable:
  - HIGH: The toggle the doc calls **Enable TTS** is labeled **Use text to speech** (en.json connections.device.ttsEnabled). Fix the label in the guide. The doc uses "Enable TTS" throughout.
  - HIGH: **All Characters Voice** is labeled **Shared voice** (en.json ui.panels.ttsconfigcard.allCharactersVoice). The doc's heading "One voice for all characters" does not match this label.
  - MEDIUM: **Selected per character** heading vs UI **Character and persona voices** (en.json ui.panels.ttsconfigcard.characterVoices). Align.
  - MEDIUM: "Audio connection" (doc) vs "Audio providers" (UI group label) and "Audio connections" (doc heading; 0 hits). Pick one term. The word list needs an entry.
  - MEDIUM: "Missing Audio connection" message (doc) not verified.
  - LOW: "Read character dialogue", "Add character voice", "No audio after 60 s", "3 seconds" not verified.
- Terms: "Audio connection", "Audio provider", "Source", "TTS" (not expanded on first use: "Text to speech (TTS)" is in the title, fine).
- Length: about 20% cuttable; the Audio format section and cache section can be a short reference.
- Ban-list: 1 hit ("actually", line 54, plain verb; low).
- Priority: HIGH (the first step's toggle label is wrong; the first heading of the setup path does not match the UI).

**scene-backgrounds.md, comfyui.md, image-providers.md** see above.

### docs/agents/avatars.md (7.3k words) - label sweep and deep link only (not fully read)
- Deep link: VrmSetupPanel.tsx:146 opens agents/avatars.md with search "Get a 3D model". The heading "## Get a 3D model" (line 124) must stay as is.
- Verified: "Faces and mouth shapes" (en.json avatars.vrm.expressions.title), "Get a 3D model" (en.json avatars.vrm.getModel.title), "Faces" (en.json avatars.pngtuber.faces), "Make faces from the avatar" (en.json avatars.generation.facesFromAvatar), "VRM model" (avatars.setup.kind.vrm).
- Misses (labels not in en.json): "Add-ons", "Get Extensions", "Media & Assets", "Embed Media", "Embed Textures", "Export .mavatar", "Make pictures", "File → Export → VRM (.vrm)", "File → Export → VRM Animation (.vrma)" (these are Blender/VRoid/external UI, fine if quoted from those apps), "Chat connection that can see pictures", "The agent's connection", "Mouths", "Faces:" (headings or list labels).
- Structure: about 25 headings for a 7.3k-word guide. Heavy. Split: (1) Set up an avatar (2D/3D, the reader task), (2) Make your own model (external tools, move to a reference), (3) Performance and devices.
- Ban-list: 4 hits ("very" x4 at lines 63-110, mostly "very large" and "very old"). Low; "very" is not a filler in these cases, so keep only where it adds meaning.
- Priority: MEDIUM (long; several labels need checking, but the reader task is clear).

### docs/agents/hierarchical-maps.md (7.1k words) - label sweep only (not fully read)
- File name is stale: the UI and release notes call the feature **World Maps** (en.json ui.modals.whatsnewmodal.release240.paragraphs.worldMaps: "The World Maps Agent (previously Hierarchical Maps)"). The page title is already "World Maps". The game setup still says **Hierarchical world map** (en.json ui.game.gamesetupwizard.hierarchicalWorldMap). Decide the naming. If renaming the file, use git mv and mirror docs-i18n per the rules. Do not rename in the same commit as a rewrite.
- The map editor labels (Add child, Add sibling, Add to chat, Detach and keep copy, Expand with AI, Import map file, Delete permanently, Continue to editor, Build manually, Choose artwork, Edit world map, Browse up) are 0 hits in en.json. Most of the World Maps UI ships in the package (Pasta-Devs/Marinara-Agents), so it cannot be verified from this checkout. Flag as "could not verify" and confirm with the package.
- Compatibility lines ("2.3.5 through 2.4.0", "2.3.5 through 3.x", "Current compatibility") conflict with each other and with built-in-agents.md (World Maps entry has no version line). Confirm one range.
- Troubleshooting section is long (about 20 H3 items). Move to a Troubleshooting block at the end with one line per symptom.
- Length: about 50% cuttable or movable (troubleshooting, artwork prompt customization, import/export details). Owner for the import/export file format: this guide.
- Ban-list: 0 hits. Links: `../game/...` and `#` anchors resolved in the link check.
- Priority: HIGH for the naming (file name vs title vs UI) and the unverifiable compatibility lines; MEDIUM for length.

## Coverage status

- Fully read: agents-overview, built-in-agents, approvals-and-agent-suite, knowledge-sources, custom-agents, memory (first two thirds and tail).
- Read in part, with label sweep: avatars (label sweep, deep link check), hierarchical-maps (label sweep, naming check), memory (middle section only skimmed).
- Read in full or near full: noodle/overview, noodle/settings, all five integrations, animated-expressions.
- Label sweep and targeted code checks only: scene-video, scene-backgrounds, illustrator-agent, image-providers, comfyui, music, style-profiles, tts-setup.

## Word list candidates (agents, noodle, integrations, media)

| UI term (en.json) | Synonyms seen in docs | Plain explanation |
| --- | --- | --- |
| Agent Organizer | agent store, catalog, Agent catalog | Where you install, update and remove official agents. |
| Agents panel | agent library, agents list | The right-side panel where you browse and create agents. |
| Enable Agents | agents switch, master switch | The per-chat switch that turns all agents on or off. |
| Trackers Control | trackers settings | Roleplay-only card in Chat Settings with tracker options. |
| Review Agent Outputs | approval, review writes | Makes agent writes wait for your approval. |
| Agent Suite | agent data editor | Viewer and editor for what agents stored in this chat. |
| Agent activity | agent status | Short notes about what agents did this turn. |
| Custom Agent Abilities | powers, permissions | Opt-in switches that let a custom agent change parts of the chat. |
| Result Type | output type | How Marinara reads a custom agent's answer. |
| Pipeline Phase | phase | When an agent runs: Pre-Generation, Parallel or Post-Processing. |
| Connection (UI mostly says "Connections", but also "provider" in the summary and embedding labels) | provider, account, API | A saved link to an AI service. Use "connection" everywhere; the UI says "provider" in "Summary Provider", "Embedding provider", "Same as this provider". Decide and align. |
| Embedding provider / Semantic search (embeddings) | embedding connection, Embedding Connection, Semantic Search (Embeddings), embeddings source | The model source that turns text into searchable fingerprints. |
| Summary Provider | Summary Connection | The connection that writes chat summaries. |
| Chat Summary / Chat Summaries | summary, recap | Roleplay summaries of older messages. "Chat Summaries" is also the Advanced Memory list; use one name for each. |
| Advanced Memory Recall | Advanced Memory, Advanced mode | Roleplay and Game option that manages history and scene memories. |
| Memory Recall | recall, memories | Adds related older messages back into the prompt. |
| Use this chat's active lorebooks | chat-active lorebooks | The lorebooks the current chat has turned on. |
| Fixed source override / Fixed Source Lorebooks | fixed sources | A locked lorebook list for one agent. |
| Hide from AI | hidden, crossed eye | Keeps a message out of the AI's prompt. |
| Image Run Interval | run interval, cadence | How many messages pass before the agent runs again. |
| Decision model | decision connection, yes/no model | Small model that answers yes or no questions for activation. |
| Push Story | push, arm | One-time nudge for the next reply (Narrative Director). |
| Echo | Echo Chamber widget | Floating audience reaction widget. |
| Haptic / Intiface | toy, device | Connected sex toy control through Intiface Central. |

Terms to pick a single form for: "Agent Organizer" (keep), "catalog" (use only for the repo), "package" vs "agent" (the docs use both for the same catalog items; the UI says "package" in Organizer messages), "Music DJ" vs "music agent", "Sprite" vs "expression sprite", "Story Writer" vs "Writer agents" (different things).

## Top five wrong facts (this pass)

1. Agents overview: an "Agent Debug" overlay with per-agent calls, tokens and timing. No such overlay exists; debug entries go to the browser console (packages/client/src/stores/agent.store.ts:74-91).
2. Beholder: recommends specific model versions ("GPT-5.5+", "Claude Opus 4.8+", "Kimi K3+") with no source in the repo.
3. Custom agents: the abilities table omits "Create character cards" and "Choose active chat characters" (AgentEditor.tsx:280, 350; en.json:6439, 6453).
4. Memory: the embedding dropdown is "Embedding provider" (en.json:11512), option "Same as this provider" (en.json:11634), not "Embedding Connection" / "Same as this connection"; Chat Summary's connection control is "Summary Provider" (en.json:11188), not "Summary Connection".
5. Knowledge sources and Memory: the section label is "Semantic search (embeddings)" (en.json:11647), not "Semantic Search (Embeddings)" (used in knowledge-sources.md and memory.md).

## Could not verify (leave unchanged, list in PR)

- Compatibility version ranges for every package (Engine 2.3.5, 2.4.4, 2.4.6, 2.5.0, 2.5.1, 4.0.0, 3.0.0): package manifests are in Pasta-Devs/Marinara-Agents, not this checkout.
- Package-owned defaults: Card Evolution Auditor 8, Lorebook Keeper 8, Memory Nag numbers, Narrative Director "Story Push Mode" values, Relationship Tracker Context Size 5 and Presence lookback 15, Long-Term Memory recall budget 128-16,384.
- Beholder model names (see top five).
- Advanced Memory defaults beyond maxContextTokens 65,000: 6,500 budget, 3 recalled scenes, 3-5 moving context, 5-message scene check interval, 2-3 paragraph recap, 8,196 output minimum (the last one partly verified at advanced-memory.ts:1980).
- Chat Summary defaults: Every 5 (1-200), Maximum output size 4096 (1-32768), Recent message tail 10, Day Rollover Hour 4 AM.
- Custom agent defaults: Context Size 5, Max Output Tokens 4096 (128-32768), Decision time limits 4 s and 20 s.
