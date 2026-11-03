# Audit: lorebooks, prompts, appearance guides (17 files)

Checkout: `/tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/ro` (read-only, staging). Nothing edited there.
UI strings checked in `packages/client/src/localization/locales/en.json` and in component source. Many tooltips and labels are hard-coded in components, so those were checked in source. Paths below are relative to the checkout unless absolute.
Link checker used: `scratchpad/audit/tools/linkcheck.py` (checks every relative link target and GitHub-style anchor in the 17 files).

## Summary by priority

| Guide | Priority | Main issue |
|---|---|---|
| appearance/appearance-settings.md | HIGH | Accent default wrong; chat font max wrong; Game dialogue labels wrong; Display Size list incomplete; tab grouping (App / Conversation / Roleplay / Game buttons) not described |
| appearance/chat-backgrounds.md | HIGH | Uploaded-image badge is "My upload", not "Library" (used in 5 tasks) |
| prompts/generation-parameters.md | HIGH | Broken link (line 118); "Connections > Default Chat Parameters" label does not exist; quoted help text wrong; "Captioning Connection" label wrong |
| lorebooks/entries.md | HIGH | Position labels wrong ("Before/After chat" vs "Before/After character definitions"); sort list missing "Fired ↓"; 79 em-dashes; ~35% cuttable; decision section duplicates other guides |
| lorebooks/semantic-search.md | MEDIUM | Quoted Vectors help text is not what the UI shows; missing "Include character context" option |
| lorebooks/import-export.md | MEDIUM | Export dialog also has Markdown and CSV; text import from Markdown/CSV not documented |
| prompts/presets.md | MEDIUM | Marker table missing 3 markers that the Add Section menu offers; conversation prompt status labels differ |
| prompts/conditional-prompts.md | MEDIUM | Accurate syntax, but ~50% is decision-engine internals that belong in decision-models.md |
| appearance/custom-css-themes.md | MEDIUM | "Theme name" is a placeholder, not a field label; path style mixes `->`, `>`, `→`; duplicates chat-widget section |
| lorebooks/overview.md | MEDIUM | "three switches" omits Global; Entry Limit described as "per prompt" (UI says "per reply"); otherwise verified |
| prompts/macros.md | LOW | Accurate; reference-length; a few dense paragraphs |
| appearance/card-css-theming.md | LOW | Accurate; 568 lines, ~210 are one showcase CSS block (~37%) |
| lorebooks/linking-to-characters.md | LOW | Accurate; the "Remove the current embedded lorebook first" text is a disabled-button tooltip, not a visible note |
| lorebooks/token-budgets.md | LOW | Accurate, all defaults and reason labels verified |
| prompts/preset-variables.md | LOW | Accurate; "Random Pick" behavior not verified in code |
| prompts/prompt-overrides.md | LOW | Accurate; status pill labels and registry verified |
| appearance/fonts.md | LOW | Accurate; chat-widget text duplicated from custom-css-themes.md |

Broken links: 1 (generation-parameters.md:118). All other relative links and anchors in the 17 files resolve.

---

## 1. lorebooks/overview.md

- **Reader tasks:** understand what a lorebook is; create first lorebook and entry; learn how a lorebook activates. Easy to find: yes (first guide in the folder, linked from the others).
- **Verified correct:** panel buttons New/Import/Select (tooltips, LorebooksPanel.tsx:761-790); search placeholder "Search lorebooks"; sort options incl. "Token Budget" (LorebooksPanel.tsx:812-820); category labels and default (CreateLorebookModal.tsx:12-17 "Other"; LorebookEditor.tsx:363 "Uncategorized"); row buttons Copy/Delete and "OFF" badge (LorebooksPanel.tsx:1335-1374); create-form labels and "Create Lorebook" button; Overview tab defaults Scan Depth 2 / Token Budget 2048 / Entry Limit 100 / Max Depth 3 (lorebook.schema.ts:143-152); Entry Limit range 1-1000 (defaults.ts:105-109); Global clears character/persona links on save (LorebookEditor.tsx:490-491); Max Depth shown only when Recursive is on (LorebookEditor.tsx:2877); Scan Depth 0 = whole chat (keyword-scanner.ts:557).
- **Wrong or stale:**
  - Line 96: "The tab also has three switches" lists Enabled, Recursive, Vectors. The Global switch is also on this tab (LorebookEditor.tsx:467, 1788); the text mentions it earlier but the count is wrong. Medium-low.
  - Line 87-91: Entry Limit "adds to one prompt". UI help: "The most entries this lorebook can add to one reply." (en.json:13367). Low.
- **Missing steps:** what the reader sees after "Click the Create Lorebook button" is fine; no note on where the Global/Enabled switches sit relative to the Overview form. Low.
- **Duplication:** the numeric table (lines 87-92) repeats token-budgets.md lines 16-23. Owner: token-budgets.md. Vectors/semantic paragraph (lines 96-102) repeats semantic-search.md. Owner: semantic-search.md.
- **Length:** ~10% cuttable (drop the numeric table and point to token-budgets.md).
- **Ban list:** 2 hits: "Note that" (overview.md:49) and "just" (overview.md:57, "just to one chat"). Low.
- **Broken links:** none.
- **Terms:** "Lorebook" (UI) vs "World Info" (intro, import-export). "Global" vs "global lorebook". "Linked" vs "assigned" (linking guide uses both).
- **Could not verify:** Copy/Delete buttons "always visible on mobile" (line 35) — CSS-only, not checked.

## 2. lorebooks/entries.md (441 lines, 38.6 KB)

- **Reader tasks:** add an entry; choose keys and entry type; set position/order; timing; use folders; keyword test. Easy to find: partly. The guide is an 18-section reference with the "How it fires" content mixed into "Authoring strategy" and "Use cases by parameter". The Position choice, a common task, sits in section "Position, Depth, and Order", but its labels are wrong (see below).
- **Wrong or stale:**
  - Lines 93, 287-290 (and the Placement examples in the strategy section): Position choices written as **Before chat / After chat**. UI options are **Before character definitions** / **After character definitions**; compact row labels are ↑Char / ↓Char (LorebookEntryRow.tsx:954-957, 1034; en.json:13395-13400, "ui.lorebooks.lorebookentryrow.beforeCharacter"). HIGH.
  - Line 14: sort dropdown lists 8 options. The UI has 9; "**Fired ↓**" is missing (LorebookEditor.tsx:368-378). Medium.
  - Line 60-66: Whole Words and Case Sensitive are in the drawer and Regex on the compact row. Verified (LorebookEntryRow.tsx:712-733; expandeddrawer keys). OK.
  - Line 46: "more than 10 keys shows only the first 10" verified (LorebookFormFields.tsx:50). OK.
  - Line 421 (Keyword test section) claims: "It ignores timing, probability, character filters, and semantic matching" (line 421, in section "Keyword test tool"). Timing ignored (test-scan.ts:109). Probability is not ignored: it is always treated as passing and flagged (test-scan.ts:111, 194). The editor also has an "Include other lorebooks" switch (LorebookEditor.tsx:3003) that the guide omits. Medium-low.
  - Line 31: Save states verified ("Autosaving…", "Saved automatically": expandeddrawer keys).
  - Line 116-121: timing fields "All four start unset (0, meaning off)". Schema default is null (lorebook.schema.ts:236-239). Low; "unset" is correct, "(0...)" is not the stored default.
  - Line 418-419: "Would activate" chip and "Always active" chip are verified (LorebookEntryRow / en.json).
  - Line 161-176 (Context filters): not verified beyond the UI section name "Context filters & matching sources" (en.json:13224).
  - Line 369: group-chat filter behaviour ("keeps the entry out of other characters' replies") not verified in code.
  - Line 178 and 399: "Order: a lower number loads first and survives trimming" verified (index.ts:551-556: constant, then matched-context, then injection order; trimming follows that order).
- **Missing steps:** no "what you see" after "Add Entry" beyond "a new row appears"; no note that the Entries tab is reached by clicking a lorebook row (overview covers it). Expand-row and the type dot (green/yellow/red) are described, which is good. The "Show N more" control is labelled "Show {{count}} more" (en.json:13284); the guide's "Show 5 more" example is correct.
- **Duplication:**
  - Decision activation (lines 125-150) duplicates and extends conditional-prompts.md (216-446). Owner: decision-models.md / conditional-prompts.md. Move out.
  - Outlet macro explanation (lines 106-108) duplicates macros.md (127-133). Owner: macros.md for the macro; keep only the field text here.
  - Include macro (line 380) duplicates macros.md (143-160). Owner: macros.md.
  - Macros list (lines 372-392) repeats macros.md. Owner: macros.md.
  - "Structure lore as a tree" / "Reusing lore" (lines 180-195) overlaps linking-to-characters.md (scope/global). Owner: linking-to-characters.md for scope; keep the authoring tip only.
  - "Worked example", "Stacking several controls", and "Alternate versions" (lines 197-249) plus "Use cases by parameter" (251-305) repeat the authoring strategy. Keep one example.
- **Length:** ~35-40% cuttable (decision section ~25 lines, Use-cases ~55 lines, macros ~20 lines, one of three worked examples).
- **Ban list:** 11 hits, 79 em-dashes. Examples: line 78 "It just does not need a keyword"; line 249 "everything else simply waits"; line 104 "Reach for it only when…a rule the model keeps forgetting — or…"; line 168 "**It only matters when it comes up** — a person, place…"; line 223 "…how the villain can actually be killed — a fact…". Em-dash chains and dashes between clauses should be periods. Also "Use it for:" and "Example:" bullet pattern repeats ~25 times (fine as a pattern, but consider a table).
- **Broken links:** none in this file (anchors `#authoring-strategy-choosing-the-right-entry`, `#worked-example-a-small-setting`, `#decision-activation` resolve).
- **Terms:** "keywords" / "keys" / "trigger keywords" / "primary keys" (UI: "Primary Keys", "Secondary Keys"). "Position" vs "placement". "Depth" (field) vs "@ Depth" (position). "Type" vs "status" (UI: STATUS_LABEL, "Normal/Constant/Selective"; guide says "entry type" — consistent with the menu label "Choose entry type"). "Recursion" (per-entry) vs "Recursive" (lorebook switch) — UI uses both; guide explains both.
- **Priority:** HIGH (wrong Position labels in the most-used section; plus length/duplication).

## 3. lorebooks/token-budgets.md

- **Reader tasks:** set token budget and entry limit; set the chat-wide Lorebook Token Budget; understand skipped entries in Active Context; set recursion. Easy to find: yes.
- **Verified:** Token Budget default 2048, 0 = unlimited (lorebook.schema.ts:144; index.ts:743); Entry Limit 100, range 1-1000 (defaults.ts:105-109); chat budget default 8192 (defaults.ts:117); current-location cap 2,048 (index.ts:708); Active Context notice text and reason labels "lorebook budget", "chat budget", "lorebook and chat budgets", "current-location context cap" (en.json:469-483); trimming order (index.ts:551-557); Max Depth default 3, range 1-10 (lorebook.schema.ts:152); "Knowledge Retrieval" / "Knowledge Router" suggestion (en.json:9129).
- **Wrong or stale:** none found. Line 59 (location cap) and line 61 (blank entries not listed) not verified in code (low).
- **Missing steps:** none material.
- **Duplication:** the chat Lorebook Token Budget is also described in linking-to-characters.md:99-101 (owner: token-budgets.md, which should keep it). Recursion overlaps entries.md:184, 351-353 (owner: token-budgets.md).
- **Length:** ~5% cuttable.
- **Ban list:** 1 hit: "just" (token-budgets.md:67, "just the chat"). Clean otherwise.
- **Broken links:** none.
- **Terms:** "Lorebook Token Budget" (chat, UI label) vs "Token Budget" (lorebook, UI label): same name for two things. Keep the UI names and say "chat's Lorebook Token Budget" every time.
- **Priority:** LOW.

## 4. lorebooks/import-export.md

- **Reader tasks:** import one or many lorebooks; export one or many; find the Import/Export buttons. Easy to find: yes.
- **Verified:** Import tooltip "Import" (LorebooksPanel.tsx:769); drop-box text "Drop one or more lorebook files here or click to browse" (en.json:13665); result line "Imported lorebook" (ImportLorebookModal.tsx:62, hard-coded English); "N succeeded M failed" summary (ImportLorebookModal.tsx:146-153); `file.lastModified` used as created date (ImportLorebookModal.tsx:46-47); Export dialog options "Marinara Native" / "Compatible JSON" (ExportFormatDialog.tsx:51-52); `.marinara.json` and `.json` file names (server routes, lorebooks route lines ~599-612); bulk zip name `marinara-lorebooks.zip` (LorebooksPanel.tsx:378); bulk export always native (not checked; low).
- **Wrong or stale / incomplete:**
  - Line 41-48: "Export lorebook… two choices". The editor's export dialog also offers **Markdown** and **CSV** text exports (LorebookEditor.tsx:2236-2256; en.json:13380-13382). Medium.
  - Import of **Markdown or CSV** text ("Import entries from Markdown or CSV", en.json:5416; LorebookTextImportDialog.tsx) is not documented at all. Medium.
- **Missing steps:** no mention that the Import button is in the top action row next to New and Select (it is described, good).
- **Duplication:** SillyTavern folder import is linked to data/importing-from-sillytavern.md (correct owner).
- **Length:** ~5% cuttable.
- **Ban list:** 0.
- **Broken links:** none.
- **Terms:** "World Info" (other tools) vs "lorebook". Good.
- **Priority:** MEDIUM.

## 5. lorebooks/linking-to-characters.md

- **Reader tasks:** link a lorebook to a character/persona; set scope; embed into a card; manage embedded copy; per-chat lorebooks. Easy to find: yes.
- **Verified:** Lorebook tab with "New" and "Assign Lorebook" (LorebookAssignmentSection.tsx; en.json:13294, 13303); New creates Character-category lorebook (LorebookAssignmentSection.tsx:163); picker limited to character-category lorebooks (`useLorebooks("character", …)`, LorebookAssignmentSection.tsx:96); Scope labels "All chats with {{name}}", "Disabled for all chats", "Specific chats" (en.json:13289, 13296, 13314); "Assign" button (13291); "Embedded" badge, "Embed into card", "Refresh" (en.json:13297, 13299; ui.noodle.noodlehome.refresh); embedded-card buttons "Import Embedded Lorebook", "Reimport Embedded Lorebook", "Edit Embedded Lorebook", "Remove from card" (en.json:8753-8772); chat-section badges "Chat", "Global", "Character", "Persona" (chat-lorebooks.ts:5, 72-86); "Disable in this chat"/"Enable in this chat", "Remove from chat", "Add Lorebook", "Disabled" badge (LorebooksSection.tsx, en.json:11389-11393); Lorebook Token Budget default 8192 (defaults.ts:117).
- **Wrong or stale:**
  - Line 63: "the Embed into card button is disabled with the note 'Remove the current embedded lorebook first'". It is a disabled button's **tooltip** (title), not a visible note (LorebookAssignmentSection.tsx:308-316). Low.
  - Line 65: "Refresh" button rewrites the embedded copy: title text confirms ("Rewrite the card's embedded copy from this lorebook's current entries"). OK.
- **Missing steps:** Step 1-3 of "Embed" say "Make sure the lorebook you want is already assigned"; the guide does not say what to do if the lorebook is not in the Character category (it does, in the Assign section). Fine.
- **Duplication:** the chat-wide Lorebook Token Budget paragraph (lines 99-101) duplicates token-budgets.md (owner). Global behaviour repeated from overview.md:55-59 (owner: overview.md).
- **Length:** ~10% cuttable.
- **Ban list:** 1 hit: "just this chat" (line 92). Clean otherwise.
- **Broken links:** none.
- **Terms:** "link" / "assign" / "attach" — UI uses "Assign Lorebook" and "Linked Characters". The guide's "Link (Assign)" heading pair is fine; pick "assign" for the action and "linked" for the state. "Embed" / "embedded" — UI consistent.
- **Priority:** LOW.

## 6. lorebooks/semantic-search.md

- **Reader tasks:** set up an embedding source; turn on Vectors; vectorize entries; tune thresholds; re-vectorize after model change. Easy to find: yes, but the setup steps are split across this guide and the Connections guides.
- **Verified:** Vectors switch and its disabled note "Semantic search is disabled by the lorebook-level Vectors toggle." (en.json:13488); panel name "Semantic search (embeddings)" (en.json:13487); numeric settings and defaults: Query Messages 10 range 0-100 (defaults.ts:134-136), Score Threshold 0.3 (defaults.ts:138), Vector Limit 10 range 1-100 (defaults.ts:140-144); labels "No semantic search", "Vectorize {{n}} missing", "Re-vectorize {{n}} entries", "Re-vectorize all", "Delete vectors" (en.json:13475-13496); "Test embedding" (en.json:2271); "Same as this provider" and "Embedding provider" (en.json:11634, 11512); "Embeddings" default under Connections defaults (en.json:2268); the dimension-change server message (lorebooks.routes.ts:1580) matches line 102 exactly; "entries vectorized" chip text (en.json:13468).
- **Wrong or stale:**
  - Line 51: the quoted Vectors help text ("When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook.") does not exist. The UI shows: "When on, entries can also be found by meaning. When off, keywords still work and this lorebook isn't vectorized." (LorebookEditor.tsx:2859 → en.json:13392). Medium.
  - Line 63: "Query Messages — How many recent chat messages". UI: "How many recent user messages to search with…" (en.json:13470). Low.
  - Line 94: the No Vector help text quoted ("When enabled, bulk vectorization skips this entry and removes any stored embedding.") matches the hard-coded tooltip (LorebookEntryRow.tsx:1982). OK.
  - Line 15 "Keyword and semantic matches have equal priority… entry order decides". Verified: semantic matches get the same matchedCurrentContext flag (keyword-scanner.ts:774-779).
- **Missing steps:**
  - "Include character context" switch (en.json:13471-13472) is not described. Medium-low.
  - Setup path: "Open Advanced, then More" (connection editor) is not verified in code. Could not verify.
  - Built-in model "appears only after you download the local model" and "hidden on Lite builds" (lines 39-41): not verified.
- **Duplication:** "How it feeds the Knowledge Router agent" (lines 106-110) repeats knowledge-sources.md (owner). Embedding-source setup (lines 17-41) duplicates connections guides (owner: connecting-to-a-provider.md / local-model.md; keep a one-line link).
- **Length:** ~20% cuttable.
- **Ban list:** 3 hits: "simply" (semantic-search.md:110 "Vectorizing simply gives it…") and "just" (2, e.g. :94 "just"). Low.
- **Broken links:** none.
- **Terms:** "Vectors" (switch), "semantic search", "embeddings", "vectorize", "vector" — the UI uses all of these. Suggested: "Vectors" for the switch, "semantic search" for the feature, "vectorize" for the action.
- **Priority:** MEDIUM.

## 7. lorebooks/entries.md (see section 2)

## 8. prompts/generation-parameters.md (197 lines)

- **Reader tasks:** change temperature/max tokens/reasoning; set per-chat overrides; understand Send switches; set custom parameters; find where defaults live. Easy to find: partly. Location info (line 15) points to a path that does not exist.
- **Verified:** Advanced Parameters section label (en.json:11243); "Limit Context Messages" toggle (11251); Exclude Past Reasoning (11248); Captioning Prompt (en.json:1391); "Past reasoning blocks" and hint (en.json:1394-1395); Reasoning Effort levels: Off/Low/Medium/High/Extra high/Maximum (generationParameters.level.* en.json:5002-5007); Verbosity choices None/Low/Medium/High (GenerationParametersEditor.tsx:634-645; generation-parameter-relevance.ts:412-426); Send switch tooltip "This parameter is sent to the model" (en.json:17005); numeric ranges: Temperature 0-2, Top P 0-1, Top K 0-500, Frequency/Presence -2 to 2, Context messages 1-9999 starting at 50 (AdvancedParametersSection.tsx:257, 271-274, 363-440); defaults DEFAULT values temperature 1, maxTokens 4096, topK 0, reasoningEffort "maximum" (defaults.ts:62-70; GenerationParametersEditor.tsx:77-106, Roleplay 8192); Send defaults: maxTokens and reasoningEffort on, others off in chat Advanced Parameters (GenerationParametersEditor.tsx:66-75, AdvancedParametersSection.tsx:99); prefill rejection list (generation-parameters.ts:270-279); "Save as Connection Default", "Reset to Defaults" (en.json: advancedparameterssection.saveAsConnectionDefault / resetToDefaults); "Thinking Tags" and "View model thoughts" (en.json:17145, 891); "Service Tier" help (en.json:6853-6854); agent default temperature 0.7 (agent-executor.ts:96); "Peek Prompt" link.
- **Wrong or stale:**
  - Line 15 and 151: "Connections > Default Chat Parameters". No such label exists. Connection-level generation settings are in the connection editor's **Chat defaults** section (ConnectionEditor.tsx:3558-3561; en.json:2265). HIGH.
  - Line 23: quoted help text "Override generation parameters for this chat. Only change these if you know what you're doing." The UI shows "Change generation settings for this chat only. Leave these alone unless you know what they do." (en.json:11254, key `…overrideGenerationParametersForThisChatOnlyChangeThese`). Medium.
  - Line 132: "pick a connection in the **Captioning Connection** dropdown". The label is **Captioning model** (en.json:11244). Medium.
  - Line 167: "**Use custom defaults for this connection**". UI: "Use custom defaults for this model" (en.json:11698). Medium-low.
  - Line 53 vs 78: the same switch is called "Send switch" and then "Send toggle" in the same section. Pick one (UI has no text; use "Send switch"). Low.
  - Line 15/17: "Marinara's Universal Preset contributes no generation parameters" — repeated from presets.md:13. Owner: presets.md.
- **Missing steps:** the Effective line (line 156) is described but not shown; it says "the **Effective** line" (UI: "generationParameters.effective.*" hint text). Low.
- **Duplication:**
  - Universal Preset note (lines 17) duplicates presets.md:13 (owner presets.md).
  - "Parameters for agents" (lines 160-170) belongs to custom-agents.md / agents-overview (owner: agents guide). Keep one link.
  - Prefill and model refusal list (lines 86) is a model-support table; it will go stale fast. Move to a reference or a connections note.
- **Length:** ~25% cuttable (agents section, model-specific prefill list, symptom tips to a short list).
- **Ban list:** 3 hits: "just" (generation-parameters.md:78 "It is just not sent") and "very" (2). Low.
- **Broken links:** line 118 `../agents/memory.md#advanced-memory-recall-roleplay` does not resolve. The target file exists, but its heading is `## Advanced Memory Recall (Roleplay and Game Mode)`, whose GitHub slug is `advanced-memory-recall-roleplay-and-game-mode`. Fix: change the anchor to `#advanced-memory-recall-roleplay-and-game-mode`. HIGH (broken link, confirmed).
- **Terms:** "Send switch" / "Send toggle" (same control). "Advanced Parameters" (UI) vs "generation parameters" (guide title). "Reasoning Effort" vs "thinking" vs "reasoning". "Context message limit" (field) vs "Limit Context Messages" (switch) — UI uses both.
- **Could not verify:** "Max Output Tokens override" (line 154; connection editor section exists at ConnectionEditor.tsx:3862 but the exact label was not found); "Exclude Past Reasoning is on by default" (default not located); Effective-line wording; the Roleplay-vs-Conversation output defaults beyond defaults.ts.
- **Priority:** HIGH.

## 9. prompts/presets.md (190 lines)

- **Reader tasks:** create a preset; add sections/markers; group sections; set wrap format; assign to a chat; understand Conversation/Game prompts. Easy to find: yes.
- **Verified:** Presets panel sections "Prompts", "Regexes", "Functions" (en.json:15563, 15597, 15363); buttons New/Import/Select; sort labels "Manual order", "A-Z", "Z-A", "Newest", "Oldest" (presets sort keys not fully traced; treat as likely); "DEFAULT" badge (en.json:15534); editor tabs Overview/Sections/Prompts/Parameters/Regex (PresetEditor.tsx:111-115); "Add Section", "Prompt Block", "MARKER", "Send without wrapper", "Ordered (in sequence)", "Depth (from end of chat)", "New Group", "Agent Sections" (en.json:16142-16200); marker labels Character Info, Persona, Chat History, Chat Summary, Dialogue Examples, Lorebook Marker (All/Before/After) (PresetEditor.tsx:131-145); wrap format default XML and the three buttons (shared prompt.schema.ts:203; en.json:16092); "Assign to chat" (en.json:15527); the Conversation-mode message "Prompt presets are not available in conversation mode." (en.json:15562); "Configure Preset Variables" (en.json:16070); "Default conversation prompt", "No presets available", "Edit Conversation Prompt", "Reset to default prompt" (en.json:11300-11308); Extra instructions 2000-character limit (GameExtraPromptSection.tsx:173); lorebook marker warning text (en.json:16138); "Scoped regex default" (en.json:6170).
- **Wrong or stale:**
  - Lines 49-53 and 157-165: the Conversation/Game status row is named **Default / Preset / Custom**. The UI text is "Using default conversation prompt" / "Using chat-local edit" (en.json:11310-11311). The preset-status text was not located. Low-medium.
  - Lines 80-88: the marker table lists 8 markers. The Add Section menu also offers **Current Scene Summary**, **Recalled Scenes**, and **ID Macro Cards** (MARKER_LABELS and markerLabel(), PresetEditor.tsx:131-150, 1408-1413; en.json:16147-16171). Medium. Also "Recalled Messages" is a legacy alias for Recalled Scenes (PresetEditor.tsx:137).
- **Missing steps:** Save/Export/Delete buttons are described by icon only ("up-arrow icon", "trash icon") — the reader cannot see the tooltip text. Could not verify exact tooltip strings.
- **Duplication:**
  - "Marinara's Universal Preset" (line 13) duplicates generation-parameters.md:17. Owner: presets.md.
  - Decision blocks and prompt caching (lines 171-177) duplicates conditional-prompts.md:438-446 and preset-variables.md:62-66. Owner: conditional-prompts.md (keep a link here).
  - Line 173 links `conditional-prompts.md#asking-the-decision-model` (anchor exists).
- **Length:** ~10% cuttable.
- **Ban list:** 3 hits: "simply" (presets.md:111 "They simply lose the group"), "just" (presets.md:167 "just for this chat"), "actually" (presets.md:181). Low.
- **Broken links:** none.
- **Terms:** "section" (UI: section, "Sections" tab) vs "Prompt Block" (UI) vs "block" (conditional syntax). "Preset" vs "Prompt preset" (UI: "Prompt Preset" in chat settings). "Group" vs "Groups" (UI: "Groups"). "Marker" (UI term) — good.
- **Priority:** MEDIUM.

## 10. prompts/conditional-prompts.md (467 lines, 31 KB)

- **Reader tasks:** write a basic {{#if}}; compare values; group blocks; use decision statements; understand limits. Easy to find: the syntax is easy; the decision material is hard to locate (sections "Asking the Decision model" → "Limits and cost" → "When a decision branch never appears").
- **Verified:** operators incl. `is not`, `not contains`, `not includes`, `<=`, `>=` (macro-engine.ts:1824-1846); numeric comparison rules (1-2: macro-engine.ts:1828-1850); truthy list `false|0|no|off|null|undefined` (macro-engine.ts:1867); `&&` before `||` and the equality shorthand (macro-engine.ts:1921); `var:`/`var.` lookups (macro-engine.ts:2165); group block = `[` / `]` lines with a character macro, needs 2+ characters (macro-engine.ts:968-1010); decision_choice criteria after a colon (line 266-271; macro-engine.ts:1309); "Decision statements per turn" default 32 (types/decision.ts:256); Decision time limit 1500 ms (decision/system-one.client.ts:107); answer cache 200 turns (prompt-decisions.ts:365); "Test" / "Decision diagnostics" / "Test decisions" labels (en.json:2734, 2752); "Decision model" label (en.json:2001); "Also gate agents that run before the reply" (en.json:2027).
- **Wrong or stale:** none found in the verified set. Not verified: "cache depth 5 by default" (line 444), exact cache-boundary behaviour, "Open-Jev 2B/9B" test numbers (these are test claims; they cannot be checked from code — keep only if the team has the test data), "Smart response order".
- **Missing steps:** no "where to set the Decision model" step (the first mention is at line 218 "under Decision model in the Connections panel"); add a one-line Before-you-start.
- **Duplication:**
  - Decision statements are explained here, in entries.md:125-150, in decision-models.md (linked), in custom-agents.md (linked), in peek-prompt.md (linked). Owner should be decision-models.md. Move "Writing statements", "Limits and cost", "Answer reuse", "Prompt caching", and "When a branch never appears" there; keep syntax here.
  - "Prompt caching" (lines 438-446) duplicates presets.md:171-177 and preset-variables.md:62-66. Owner: this guide, or decision-models.md.
  - Group blocks repeated in macros.md:66.
- **Length:** ~50% cuttable (the decision internals from line 216 to the end; the test table at lines 393-404 and the statistics paragraph at 391-404 are the most reference-like and least needed by a reader).
- **Ban list:** 2 hits: "actually" (conditional-prompts.md:222 "the scene actually moved"; one more in the test section). Em-dash 0. The test section opens with "What the tests showed." (a describe-the-doc lead-in; low).
- **Broken links:** none (anchors `#statement-allowance`, `#answer-reuse`, `#sticky-and-cooldown`, `#checking-every-few-turns`, `#priority`, `#limits-and-cost`, `#prompt-caching`, `#writing-statements` resolve).
- **Terms:** "Decision model" (UI) vs "Decision connection" / "decision" / "Decision" (connections.decision.label). "statement" vs "question" (UI: "Decision statements per turn", "questionLimit" key; agent activation uses "questions"). "branch" vs "block". Suggest "statement" everywhere, and "block" for `{{#if}}`.
- **Priority:** MEDIUM (accurate, but far too long for its reader).

## 11. prompts/macros.md (304 lines)

- **Reader task:** look up a macro. Easy to find: yes (reference guide). Macro reference button and `/macros` are described; both exist (en.json:16993 "Macro reference"; slash-commands.ts:1644-1645 and 340 `{{prompt}}` input action).
- **Verified:** catalog entries in macro-engine.ts:463-704 match the guide for Identity, Character, Conversation, Placement, Context, Outlet, lorebooksize, include, Time, Random, Variables, Formatting; time macros; `{{reasoning}}` (macro-engine.ts:561); character field labels "Depth Prompt", "Post-History Instructions", "Convo Display Name", "About Me", "Convo Behavior", "Phonetic name" (en.json; CharacterEditor.tsx:3680); `{{prompt}}` as an input action (slash-commands.ts:340); the 21-character card-ID rule (guide only; plausible from macro-engine.ts:484-492).
- **Wrong or stale:** none found. Not verified: the `{{lastGenerationType}}` value list (line 121), the Impersonate placeholder claim (line 294), "Very large macro output is cut off silently" (line 295), `{{group}}` with the first-character default in group chats (line 66).
- **Missing steps:** none.
- **Duplication:** conditional blocks and decision statements (line 285) repeat conditional-prompts.md; Outlet and include macros repeated in entries.md (see above). Owner: this guide for macros.
- **Length:** ~10% cuttable; line 285 is a dense paragraph that should be a bullet list.
- **Ban list:** 2 hits: "just" and "actually" in macros.md prose. Em-dash 1. Clean otherwise.
- **Broken links:** none.
- **Terms:** "macro" vs "tag" ("a short `{{tag}}`", line 3) — use "macro". "variable" vs "chat variable" vs "preset variable" (UI: "Chat Variables", "Preset Variables") — consistent with UI.
- **Priority:** LOW.

## 12. prompts/preset-variables.md (73 lines)

- **Reader tasks:** add a variable; set options and presentation; configure on assign; change answers later. Easy to find: yes.
- **Verified:** "Add Variable" (en.json present), "Variable Name", "Question (shown to user)", "Alphabetical option display", footer "Changes auto-save…" (en.json), "Boolean Toggle" / "Multi-Select" / "Random Pick" labels (en.json), "Configure Preset Variables" modal intro "This preset has configurable variables…" (en.json), "Save as default", "Confirm Choices", "Skip", "Edit preset variables" (en.json); presentation options Auto / Radios or Checkboxes / Dropdown or Listbox (PresetVariablesEditor.tsx:857-859); Boolean toggle = exactly one option (PresetVariablesEditor.tsx:479); separator default ", " (prompt.schema.ts:172; preset-choices.ts:68); "Chat Variables" section (en.json).
- **Wrong or stale:** none found. Not verified: "Random Pick preselects a random option for each new chat" (line 21); "Preset Variables panel at the bottom of Sections tab" (line 28).
- **Missing steps:** Step 4 "It must use only letters, numbers, and underscores" — not verified in code. Could not verify.
- **Duplication:** decision blocks in options (lines 62-66) duplicates presets.md:171-177 (owner: conditional-prompts.md).
- **Length:** ~5% cuttable.
- **Ban list:** 0 hits (line 3 "sometimes called choice blocks" is fine).
- **Broken links:** none.
- **Terms:** "Preset Variables" (UI) vs "choice blocks" (line 3 says "sometimes called" — the UI never uses it; say so once or drop it).
- **Priority:** LOW.

## 13. prompts/prompt-overrides.md (71 lines)

- **Reader tasks:** find Prompt Overrides; edit an image/video template; keep or reset. Easy to find: yes ("Settings > Generations").
- **Verified:** Settings "Generations" tab (en.json "settings.tabs" via SettingsPanel TABS, SettingsPanel.tsx:259); "Reusable image and video prompt templates" (en.json:15099 neighbour); editor titles "Video Generation Prompt Overrides" / "Image Generation Prompt Overrides" (en.json); "Registered prompt" (en.json); "Available variables"; "Rendered preview"; "Unknown variables"; "Apply this override"; "Reset to Default" (en.json); status pills "Custom active" / "Custom paused" (PromptOverridesEditor.tsx:51-53, hard-coded English); "Noodle Post Image" template exists (registry/noodle.ts via prompt-overrides/index.ts:31); "Prompt override saved" (en.json).
- **Wrong or stale:** none found. Status pill "Default" not traced (low).
- **Missing steps:** the status pills are hard-coded English in source; the guide's labels match the UI. Could note that these are not localized (not a docs problem).
- **Duplication:** none material; links to media guides are correct owners.
- **Length:** ~5% cuttable.
- **Ban list:** 1 hit: "actually" (prompt-overrides.md:62). Clean otherwise.
- **Broken links:** none.
- **Terms:** "Prompt Override" (UI) vs "template" (used throughout). Pick "Prompt Override" for the feature and "template" only in the editor description.
- **Priority:** LOW.

## 14. appearance/appearance-settings.md (146 lines)

- **Reader tasks:** find a specific appearance control; reset appearance. Easy to find: partly. The tab is split into **four mode buttons: App, Conversation, Roleplay, Game** (SettingsPanel.tsx:1497-1510, 1782-1808; en.json:6506-6509, "settings.appearance.modeNavigation" = "Appearance by chat mode"). The guide says "The tab is split into sections you scroll through" and does not mention the buttons. A reader looking for "Roleplay Messages" will not find it in the App group. HIGH (missing step).
- **Wrong or stale:**
  - Line 37: "The default is `#d4acfb` in both schemes" for Accent Color. The default is a gradient preset, `linear-gradient(90deg, #ec4b97, #f29744, #36cdde)` (lib/css-colors.ts:1; stores/ui.store.ts:412-414 `getDefaultAppAccentColor`). HIGH.
  - Line 65: Chat Font Size "ranges from 12px to 48px". The slider is `min={12} max={72}` (SettingsPanel.tsx:4365-4366). HIGH.
  - Lines 111-112: Game Dialogue Display options named "Classic VN" and "History Above VN". UI labels: "Classic Dialogue Box" and "History Above Dialogue Box" (SettingsPanel.tsx:603-611). HIGH.
  - Line 64: Display Size lists 6 choices. The select has 9: Tiny 12, Small 14, Medium 16, Default 17, Large 19, Huge 22, Extra large 26, Extra extra large 30, Maximum 34 (SettingsPanel.tsx:4342-4351; en.json:6498-6500). Medium.
  - Line 36: Background default `#050312` / `#faf8ff` verified (ui.store.ts:348-349). Chat text `#d4d4d4` / `#1a1025` verified (ui.store.ts:352-353). Text outline 0.5 default verified (ui.store.ts:2409). Chat Layout default Linear (classic) verified (ui.store.ts:2330). Roleplay avatar Small Circles default verified (ui.store.ts:2395). Portrait 100%, sprite 135% verified (ui.store.ts:2405-2406). Button size 32-96 verified (SettingsPanel.tsx:4150-4151).
- **Missing steps:** the four mode buttons (above). The reader is told "Settings → Appearance" and then "App Style" but never told that App Style is under the App button.
- **Duplication:**
  - Chat-widget style and the Apply-preset switches (lines 48-54) repeat custom-css-themes.md:5-33 and fonts.md:18. Owner: custom-css-themes.md (or a new chat-style doc). Keep one sentence + link here.
  - Backgrounds (lines 124-126) is a link; fine.
  - "Settings that stay on this device" (lines 134-138) repeats settings-overview.md (owner).
- **Length:** ~25% cuttable.
- **Ban list:** 0 hits. Em-dash 0.
- **Broken links:** none.
- **Terms:** "App Style" (UI section) vs "App" (mode button) vs "Appearance tab". "Chat widget style" (UI) vs "chat window style" (custom-css-themes heading). "Chat Layout" (UI) vs "Chat style" (guide). "Text & Scale" vs "text size".
- **Priority:** HIGH.

## 15. appearance/chat-backgrounds.md (133 lines)

- **Reader tasks:** import a background; choose one for this chat; set the default Roleplay background; set blur; organize; download; delete. Easy to find: yes.
- **Verified:** "Import Backgrounds" (en.json:15191); "Search backgrounds" (en.json:15217); "New Folder" (en.json:15200); "Edit tags", "Add tag…" (en.json:bulk / BackgroundPicker); "Download background" (en.json); "Set as default for new Roleplay chats" (en.json:15218); "Reset Roleplay default" (BackgroundPicker.tsx:1376); "Background Blur" 0-24, "Off" at 0 (SettingsPanel.tsx:4524-4544); "Game asset" label (en.json:15187; BackgroundPicker.tsx:802); allowed extensions jpg/jpeg/png/gif/webp/avif (backgrounds.routes.ts:126); 20 MB limit (defaults.ts:90); sort labels A-Z, Z-A, Newest, Oldest (en.json:15155-15229); "Save file" on iOS (en.json present).
- **Wrong or stale:**
  - Lines 19-22 and every later use of the **Library** label (lines 21, 29, 63, 71, 84, 110): the uploaded-image badge is **My upload** (BackgroundPicker.tsx:802-803; en.json:15197 "ui.panels.backgroundpicker.myUpload"). Readers will look for a label that is not there. HIGH.
- **Missing steps:** the first thing a reader sees is not described (the picker sits under Settings → Appearance → Backgrounds; the grid shows badges). Could add one "What you see now" line.
- **Duplication:** "Automatic and AI-generated backgrounds" (lines 122-127) repeats roleplay/backgrounds.md and scene-backgrounds.md (owners). Keep one line each.
- **Length:** ~10% cuttable.
- **Ban list:** 1 hit: "just" (chat-backgrounds.md:33, "not just its name"). Clean otherwise.
- **Broken links:** none.
- **Terms:** "Background" vs "backdrop" (roleplay/backgrounds uses "backdrop"). "Library" (guide) vs "My upload" (UI) vs "Background Library" (en.json:15157). "Chat Background" (UI label, line 40).
- **Priority:** HIGH (labels wrong in a common task).

## 16. appearance/fonts.md (62 lines)

- **Reader tasks:** pick a font; add a font file; download from Google Fonts; use the Open Fonts Folder button. Easy to find: yes.
- **Verified:** "Default (Inter)" (en.json present); "Font" dropdown and "Text & Scale" section (en.json:15078-15099 area; SettingsPanel.tsx:4322); "Google Fonts" field (en.json present); "Open Fonts Folder" (en.json); extensions `.ttf .otf .woff .woff2` (fonts.routes.ts:16); folder `data/fonts` (fonts.routes.ts:13); Google Fonts 400 weight rule (fonts.routes.ts:149, 183, 215); "Apply preset font" (en.json present); Browse link text "Browse fonts at fonts.google.com →" (en.json:15078) — guide omits the arrow; fine.
- **Wrong or stale:** none found. Line 16: "The preset editor's prompt fields and a character's Example Dialogue use a monospace font while the default font is selected" — not verified. Line 20: "Your font choice syncs across devices" — not verified against the sync list.
- **Missing steps:** none material.
- **Duplication:** the Chat widget / Apply preset font paragraph (line 18) repeats custom-css-themes.md:5-33 (owner: custom-css-themes.md). Settings-sync note (line 20) belongs to settings-overview.md (owner).
- **Length:** ~5% cuttable.
- **Ban list:** 0 hits.
- **Broken links:** none.
- **Terms:** "Font" dropdown (UI) vs "app font" (guide). Fine.
- **Priority:** LOW.

## 17. appearance/custom-css-themes.md (294 lines)

- **Reader tasks:** create, import/export, activate a theme; find the variables and classes; style chat windows; admin access over network. Easy to find: yes for the Theme Library; the class/data-attribute tables are long.
- **Verified:** "Theme Library" section in the Addons tab (shared settings-registry.ts:289-292 `tab: "addons"`); "Admin Access" in Advanced (shared settings-registry.ts:317-321 `tab: "advanced"`; guide line 275 "Settings -> Advanced -> Admin Access" is correct); "Create Theme", "Installed Themes", "Default Theme", "Import File", "Export theme", "Remove theme", "Delete Theme", "Edit theme CSS", "CSS Variable Reference" (en.json); saved message `Theme "…" saved and activated` (en.json); 200-character name limit (shared css-size.ts:8) and 256 KiB CSS limit (css-size.ts MAX_USER_CSS_BYTES); CSS classes `.mari-window__header`, `.mari-window__control`, `.mari-drawer__popout`, `.mari-window-bubble__banner`, `.mari-agents-running-dot` (all present in client source); variables `--marinara-theme-accent-pulse`, `--marinara-shell-edge-border`, `--mari-window-font-family`, `--mari-drawer-radius`, `--mari-window-ornament` (present in client source); Card CSS vs theme: `!important` and `position: fixed` rules are card-only (lib/card-css.ts:455-475; core-token block card-css.ts:119-126); url() stripped in card CSS (card-css.ts:391).
- **Wrong or stale:**
  - Line 25 section list is fine. Line 27 ("Load More"/"Show older") not verified.
  - Line 54: "Type a name in the **Theme name** field". The control is a placeholder "Theme name..." (SettingsPanel.tsx:5723; en.json:6920), not a field label. Low.
  - Line 7 and 94: path style "Settings > Appearance > App" vs "Settings -> Appearance" (line 275 and appearance-settings.md:3). Use one arrow (→) everywhere. Low.
- **Missing steps:** The App/Conversation/Roleplay/Game mode buttons (see appearance-settings) are not mentioned, though the Chat-widget style lives under App.
- **Duplication:**
  - "Ready-made chat window styles" (lines 5-33) repeats appearance-settings.md:48-54 and fonts.md:18. Owner: this guide (or a chat-style doc).
  - "How themes and Card CSS work together" (279-287) repeats card-css-theming.md "What you cannot style" table. Owner: card-css-theming.md; keep a link.
- **Length:** ~20% cuttable (move the class and data-attribute tables to a reference section at the end; keep the tasks first).
- **Ban list:** 2 hits: "just" (custom-css-themes.md:270, "these actions just work") and "unlock" (custom-css-themes.md:173-area). Low.
- **Broken links:** none.
- **Terms:** "theme" vs "custom theme" vs "custom CSS" (UI: "Theme Library", "Custom"). "Card CSS" (card-css-theming) — consistent.
- **Priority:** MEDIUM.

## 18. appearance/card-css-theming.md (568 lines)

- **Reader tasks:** theme a card: paste CSS, choose a mode, know which selectors exist, know what is blocked. Easy to find: yes (Quick Start is first).
- **Verified:** Creator Notes (en.json has the label); "Card Theming" (en.json:9561); modes Disabled / Exclusive / Chat (en.json:9642 "Exclusive"; Disabled present); "Color Character Names in Text" and "Add from Folder" (en.json present); "Party" in Game (en.json present); `@chat-mode roleplay|conversation|game` (card-css.ts:18); classes `.mari-message-bubble`, `.mari-message-name`, `.mari-message-content`, `.mari-message-meta`, `.mari-message-timestamp`, `.mari-message-avatar`, `.mari-message-narrator`, `.mari-typing-text`, `.mari-typing-dots`, `.mari-typing-indicator`, `data-typing-name`, `.mari-about-me-*`, `data-grouped` (all present in client source); sanitizer: url() only data: (card-css.ts:391), `@import` removed (402), `:has()` removed (453), `position: fixed` → absolute (455-456), `!important` stripped (474-475), `content:` 200-char cap (217), `@font-face` family renamed (568-595); Layout path "Settings → Appearance → Conversation Display → Chat Layout" (the section exists in the Conversation group; see appearance-settings.md).
- **Wrong or stale:** none found. Not verified: "Chat-mode buttons only appear once an active character has CSS in Creator Notes" (line 27; logic not traced), and the Game "game surface" claims (line 132).
- **Missing steps:** none material for the Quick Start.
- **Duplication:** "How themes and Card CSS work together" in custom-css-themes.md:279-287 repeats the "What you cannot style" table here. Owner: card-css-theming.md.
- **Length:** ~35% cuttable. Move the Eldritch Grimoire showcase (lines 315-524, ~210 lines) to its own example file and link from the guide. Move the "About Me profile popout" example (lines 209-267) to a sub-page. Keep the AI-assistant prompt (lines 525-562): it is useful.
- **Ban list:** 2 hits: "just" (card-css-theming.md:201 in a CSS comment, and :303 "not just message bubbles"). Clean otherwise. The Tips list is fine.
- **Broken links:** none.
- **Terms:** "Card CSS" vs "card theming" vs "Creator Notes"; "Exclusive/Chat" (scope) vs "mode" (line 25: "Choose Exclusive or Chat. The mode starts on Disabled"). The guide uses both "mode" and "scope" for the same control; the UI calls it "Card Theming". Pick "Card Theming mode" everywhere, and reserve "scope" for the CSS rewrite.
- **Priority:** LOW (accurate; the length is the problem).

---

## Ban-list counts (across the 17 files)

- Every file opens with "This guide explains/shows…" (17 of 17). Borderline against the opener rule; not a ban-list word. Low.
- "Here is/Here are" lead-ins: 31 occurrences (mostly "Here is a simple example"). Low.
- Ban-list words (just, actually, simply, very, really, "note that", unlock, etc.): about 40 hits in total, most are "just" or "actually". Highest: lorebooks/entries.md 11; prompts/presets.md, prompts/generation-parameters.md, lorebooks/semantic-search.md 3 each. Hard-word hits like seamless, robust, leverage: 0.
- Em-dashes: 79 in lorebooks/entries.md (the rest 1 or 0). entries.md is the clear outlier.
- Heading structure: one `#` per file, no level jumps, no horizontal rules, no emoji (the one "✦" in card-css-theming.md is inside a CSS block).

## Broken relative links and anchors

- prompts/generation-parameters.md:118 → `../agents/memory.md#advanced-memory-recall-roleplay` (anchor missing). Correct target: `../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode`. Confirmed.
- All other link targets (files) and anchors in the 17 files resolve (checked with the linkcheck tool; includes `#answer-reuse`, `#decision-activation`, `#writing-statements`, `#limits-and-cost`, `#asking-the-decision-model`, `#ready-made-chat-window-styles`, `#logging-levels`, `#lorebook-include-macro`).
- Note: the `docs-i18n` branch is not in this checkout, so translated packs could not be checked. Any rename, deletion or meaningful edit in these 17 files needs the matching `docs-i18n` update or a `[docs-i18n]` follow-up issue (AGENTS.md; CONTRIBUTING.md).

## Length and cut recommendations (summary)

- lorebooks/entries.md: ~35-40% (move Decision activation to decision-models.md; cut Use cases by parameter and one worked example; drop the macro copy).
- prompts/conditional-prompts.md: ~50% (move statements, limits, cost, caching, and the test table to decision-models.md).
- appearance/card-css-theming.md: ~35% (move showcase and About Me example to a sub-page).
- prompts/generation-parameters.md: ~25% (move agent parameters to the agents guide; trim model-specific prefill list).
- appearance/appearance-settings.md: ~25% (remove chat-widget and backgrounds duplication; add the mode-button step).
- lorebooks/semantic-search.md: ~20% (remove embedding-source setup and Knowledge Router repetition).
- appearance/custom-css-themes.md: ~20% (move class and variable tables to a reference section).
- Others: 0-10%.

## Could not verify (left unchanged in the report)

- generation-parameters.md: Max Output Tokens override label (line 154); Exclude Past Reasoning default on (line 122); Effective line wording; the prefill-refusal model list (line 86) is a code comment, which matches, but model names change.
- presets.md: "Export" and "Delete" icon tooltips; preset-status text.
- conditional-prompts.md: default cache depth 5 (line 444); the Open-Jev and Gemma test numbers (lines 376-404); "Smart response order".
- entries.md: group-chat context filter behaviour (line 369); "Recursion" wording; Locked behaviour with the Lorebook Keeper (partly verified: agent-executor.ts:3482 writes `locked="true"`).
- semantic-search.md: Built-in model appears only after download; hidden on Lite builds; "Advanced → More" path.
- macros.md: `{{lastGenerationType}}` value list; Impersonate placeholders; output cut-off.
- preset-variables.md: Random Pick behaviour; name character rules.
- appearance-settings.md: Atmosphere toggle needs World State agent (line 118).
- fonts.md: sync statement (line 20); monospace fields (line 16).
- custom-css-themes.md: "Load More"/"Show older" following switches (line 27).

## Word list candidates

| UI term (use this) | Synonyms seen in docs | One-line plain explanation |
|---|---|---|
| Lorebook | World Info, knowledge base, encyclopedia | A set of entries the AI can pull from when keywords come up |
| Before character definitions / After character definitions (Position) | Before chat / After chat | Where an entry is placed in the prompt, relative to the character card |
| @ Depth | depth, inserted at depth | Places an entry inside the recent messages, counted back from the newest |
| Outlet | outlet macro | An entry that only appears where you put `{{outlet::name}}` |
| Primary Keys / Secondary Keys | keys, keywords, trigger words | Words that make an entry active; secondary keys narrow a Selective entry |
| Normal / Constant / Selective (entry type) | entry types | Normal waits for keys; Constant is always on; Selective needs keys plus secondary logic |
| Token Budget (lorebook) | lorebook budget | The most tokens one lorebook can add to a reply |
| Lorebook Token Budget (chat) | chat budget | The most tokens all lorebooks together can add to one chat's reply |
| Entry Limit | max entries | The most entries one lorebook can add to a reply |
| Vectors (switch) / Semantic search (embeddings) | vectorize, embeddings, semantic matching | Lets an entry match by meaning, not only by keywords |
| Embedding provider | embedding connection | The connection whose embedding model turns text into vectors |
| Decision model | Decision connection, decision model, Decision | The model that answers yes/no or choice questions about the latest messages |
| Decision statements per turn | question limit, decision budget | Cap on how many decision questions a turn can ask |
| Prompt Preset / Preset Editor | preset, prompt blueprint | A saved layout of prompt sections sent to the AI |
| Prompt Block / Marker | section, block | Prompt Block: text you write. Marker: auto-filled content from the chat |
| Group (presets) | section group | A container that wraps several sections in one tag or heading |
| Wrap Format | wrapper, tags | How sections are wrapped: XML tags, Markdown headings, or none |
| Preset Variable | choice block, variable | A question with options the user answers when assigning a preset |
| Advanced Parameters | generation settings, overrides | Per-chat overrides for temperature, tokens, reasoning, and so on |
| Send switch | Send toggle | Whether a parameter is sent to the provider at all |
| Max Output Tokens | reply length, output limit | Longest reply the model may write in one turn |
| Reasoning Effort | thinking, reasoning level | How much a thinking model reasons before it answers |
| Chat defaults (connection editor section) | Default Chat Parameters (does not exist) | Parameters saved on a connection for new chats |
| Captioning model | captioning connection | The connection that describes images in text for text-only models |
| Peek Prompt | prompt preview | Shows the exact prompt the AI received for a message |
| Appearance by chat mode (App / Conversation / Roleplay / Game) | Appearance tab sections | The four buttons that group Appearance settings |
| App Style | App, app look | Appearance group for colors, scheme, widget style |
| Chat Font Size / Display Size | text size | Chat message size (12-72 px) and whole-app text size presets |
| Accent Color | accent | Color for buttons and highlights; default is a three-color gradient |
| Chat widget style | chat window style, widget style | Frame, font, and color preset for movable chat windows and buttons |
| Theme Library / Custom theme | custom CSS, theme | Saved CSS themes; one can be active |
| Card Theming (Disabled / Exclusive / Chat) | Card CSS mode, card scope | Per-chat switch that turns a character's own CSS on |
| Creator Notes | card notes | The card field where a `<style>` block is pasted |
| Chat Background | background | The image behind a Roleplay or Game chat |
| My upload / Game asset | Library | Badge on background images: yours or built-in |
| Background Blur | blur | Softens the chat background, 0-24, 0 is Off |
| Prompt Override | template, prompt template | Editable text template for image and video prompts |
| Custom active / Custom paused / Default (Prompt Override status) | status pill | Whether your saved template is used |
