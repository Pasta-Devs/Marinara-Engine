// ──────────────────────────────────────────────
// Professor Mari built-in skills
//
// Code-constant skill documents served from this module. The skill service
// merges these into list(): untouched IDs serve the constant (synthesized
// detail, builtin: true); user-edited IDs serve the materialized file
// (written on first edit) with builtin: true applied at read time.
// "Restore Default" = delete the file; the constant reappears on the next
// list(). The flag is never persisted to skills.json.
// ──────────────────────────────────────────────

export type SkillCategory = "atomic" | "task" | "meta";

export interface BuiltinSkillDef {
  id: string;
  name: string;
  category: SkillCategory;
  summary: string;
  content: string;
}

export const BUILTIN_SKILL_TIMESTAMP = new Date("2026-07-05T00:00:00.000Z").toISOString();

export const BUILTIN_SKILLS: BuiltinSkillDef[] = [
  // ── Atomic skills ──
  {
    id: "read-docs",
    name: "Read Docs",
    category: "atomic",
    summary: "Search and read Marinara documentation.",
    content: `# Read Docs

Purpose: Answer user-facing questions about Marinara features, configuration, installation, and troubleshooting using the canonical local documentation.

Tools used: docs_search, docs_read

Workflow:
1. docs_search with a focused query (2-200 chars). Search is the entry point; search before reading.
2. From the top hit, docs_read the exact path and heading. Bound the read (maxChars, default 8000) rather than pulling whole files.
3. If the answer is incomplete, widen the search or read the next heading. Fall back to raw workspace source only when the documentation is missing or genuinely ambiguous.
4. Cite the documentation path and heading in the reply.

Verification: docs_read returns the section content; if the read comes back empty or truncated, re-target the heading before answering.

Common Mistakes:
- Answering from memory without reading the doc.
- Reading whole large files instead of the specific heading.
- Citing a path without having actually read it.
- Claiming "not documented" after a single narrow search - widen the query first.

Best Practices:
- Search first, read second, then answer with a citation.
- When source inspection was genuinely required, say the answer used an implementation-level source.
- For exact CLI syntax, use built-in or CLI help (\`mari --help\`) rather than guessing.`,
  },
  {
    id: "inspect-files",
    name: "Inspect Files",
    category: "atomic",
    summary: "Read, grep, find, and list workspace files.",
    content: `# Inspect Files

Purpose: Read, search, find, and list files in the local workspace without modifying them.

Tools used: read, grep, find, ls

Workflow:
1. ls a directory to see what is there (bounded; heavy vendor dirs are skipped).
2. find with a glob when you need to locate files by name pattern.
3. grep for content when you need to locate a symbol, string, or pattern across files.
4. read a specific file with offset/limit when you need its content.

Verification: reads return the content and a line range; an empty grep or find result is a valid answer - report it as such rather than treating it as an error.

Common Mistakes:
- Reading a very large file whole - oversized reads are refused, so grep first or target a narrower range.
- Treating no matches as a failure instead of a finding.
- Inspecting source files to answer a question about saved app content (use app_data for that).

Best Practices:
- Narrow with grep before reading, and read only the lines around the match.
- Use limit and offset to page through long files.
- Keep it read-only: this skill never mutates.`,
  },
  {
    id: "edit-files",
    name: "Edit Files",
    category: "atomic",
    summary: "Edit, write, copy, move, and remove workspace files.",
    content: `# Edit Files

Purpose: Create, modify, copy, move, and remove ordinary workspace files.

Tools used: edit, write, copy, move, remove

Workflow:
1. Read the current content of any file you will modify.
2. Prefer edit (a targeted replacement) over write (replacing the whole file).
3. For copy/move, use copy/move with explicit source and destination paths.
4. Verify the result: read back the changed file, or ls the affected directory after copy/move/remove.

Verification: a read of the changed file after edit/write, or an ls after copy/move/remove. Never claim a file change succeeded without that confirming read.

Common Mistakes:
- Editing without reading the file first.
- Claiming success without a verifying read.
- Using remove on a non-empty directory (it only deletes files or empty directories).
- Silently editing dependency manifests, lockfiles, launchers, installers, or CI workflows - those are staged for a separate user review, never changed in passing.

Best Practices:
- Make the smallest edit that accomplishes the change.
- Verify after every mutation, in the same response where possible.
- Keep edits to ordinary source files; route structured app data through app_data instead.`,
  },
  {
    id: "run-commands",
    name: "Run Commands",
    category: "atomic",
    summary: "Run shell commands in the sandbox.",
    content: `# Run Commands

Purpose: Run shell commands, including the mari CLI, inside the OS sandbox.

Tools used: bash

Workflow:
1. Prefer structured tools (app_data, docs, file tools) over raw shell when they fit. Use bash for what app_data does not cover: images, wiki reads, code/workspace tasks, agents, tools, and raw DB work.
2. Run the command with a timeout (1-300 seconds).
3. Check the output. For a mutating command, add a confirming read in the same or next step before claiming success.

Verification: the command output, plus a confirming read for any mutation. A bash command never counts as its own verifying read, even a read-shaped one.

Common Mistakes:
- Reaching for bash when a structured tool does the job.
- Assuming network access - the sandbox denies it; the mari CLI (which needs network) fails closed inside a sandbox-bound compound command.
- Running a mutation and reporting done without verifying.

Best Practices:
- Check \`mari --help\` for exact CLI syntax before running it.
- Keep commands simple; one concern per command where possible.
- If the sandbox is unavailable, raw shell fails closed - use the structured read/grep/find/ls/edit/write/copy/move/remove and app_data tools instead.`,
  },
  // ── Meta skill ──
  {
    id: "manage-deps",
    name: "Manage Dependencies",
    category: "meta",
    summary: "Request npm dependencies for the workspace.",
    content: `# Manage Dependencies

Purpose: Request an exact public npm dependency for the workspace, for user approval.

Tools used: dependency

Workflow:
1. Identify the exact package and which workspace it belongs to (root, client, server, or shared).
2. Call dependency with the package name, an exact semver (or "latest" to resolve one), the target, the dev flag where appropriate, and a reason.
3. Report the resolved version and integrity. Nothing is installed until the user approves.

Verification: the dependency result carries the resolved version and integrity. The install happens only after user approval, outside the command loop.

Common Mistakes:
- Installing with a raw package manager via bash (blocked).
- Guessing a version instead of resolving an exact one.
- Claiming the package is installed before the user has approved.

Best Practices:
- Use exact semver so the resolved version and integrity are pinned.
- Always give a reason the user can judge.
- Set the dev flag when the dependency is only needed for tooling.`,
  },
  // ── Character/chat task skills ──
  {
    id: "edit-chats",
    name: "Edit Chats",
    category: "task",
    summary: "Read and search chat histories.",
    content: `# Edit Chats

Purpose: Read and search chat histories.

Tools used: app_data (chat.list, chat.get, chat.messages, chat.search)

Workflow:
1. Scope the chats: chat.list, chat.get for a known chat, or chat.search with a query.
2. Read messages with chat.messages, preserving the user-requested bounds with last or afterPost, and page only inside that range with limit and offset.
3. Answer from what was actually read.

Verification: read-only - the result is the data. Confirm the sample covers the requested range before drawing conclusions.

Common Mistakes:
- Making an unbounded chat read when the user asked for "the last N" or "after post N".
- Letting an oversized range elide messages, then answering from the elided view - re-read a post with last: 1 or afterPost, field "messages[0].content", and offset/limit windows.

Best Practices:
- Preserve the boundary the user set; never widen it silently.
- State which range was read so the answer is grounded.`,
  },
  {
    id: "mine-chats",
    name: "Mine Chats",
    category: "task",
    summary: "Extract patterns, themes, and insights from chat data.",
    content: `# Mine Chats

Purpose: Extract patterns, themes, and insights from chat data.

Tools used: app_data (chat.list, chat.search, chat.messages)

Workflow:
1. Define the scope and bounds (which chats, what range) the user actually wants mined.
2. Page the messages within those bounds with limit and offset; handle elided ranges by re-reading the specific posts.
3. Analyze across the gathered sample for patterns, recurring themes, or named insights.
4. Report findings grounded in the sample, noting what was and was not included.

Verification: read-only. The main check is that the sample genuinely covers the requested scope before any claim is made.

Common Mistakes:
- Mining a truncated sample and generalizing from it.
- Answering over an elided range without re-reading the hidden posts.
- Reporting a pattern that is an artifact of the sampling window.

Best Practices:
- State the sample size and range in the finding.
- Keep to what the data shows; mark inference as inference.`,
  },
  {
    id: "create-character",
    name: "Create Character",
    category: "task",
    summary: "Create a new character from a description.",
    content: `# Create Character

Purpose: Create a new character from a description.

Tools used: app_data (character.create, character.get)

When to use a plan: if the request is vague (e.g. "make me a character" with no details), emit one plan for the natural field order - name -> one-line vibe/personality -> scenario/setting -> first message (greeting), chips tagged entity "characters". Skip the plan entirely once there is enough to just create it.

Workflow:
1. Collect the details the user gave; use a plan only for the gaps.
2. Compose the full card in data, keeping the fields distinct: description is a brief identity overview, personality is behavioral traits and mannerisms, backstory is substantive history, appearance is physical features and clothing.
3. Put the opening message in firstMes (or firstMessage).
4. character.create with apply:true; the result's readBack confirms persistence. Read back only if you need the new id or content for a next step.

Verification: character.get on the created ID; compare the requested fields against what was asked.

Common Mistakes:
- Creating a name-only placeholder instead of a full card.
- Putting backstory or appearance content into description.
- Omitting the opening message.

Best Practices:
- Write substantive content into the correct field for each.
- Offer follow-up suggestions (add a lorebook, refine a field, open for full editing) after a successful create.`,
  },
  {
    id: "edit-character",
    name: "Edit Character",
    category: "task",
    summary: "Modify an existing character's fields.",
    content: `# Edit Character

Purpose: Modify an existing character's fields.

Tools used: app_data (character.get, character.update, character.folder.list, character.moveToFolder)

Workflow:
1. character.get the card first - always inspect before editing.
2. Build a patch with only the fields the user asked to change; leave unrelated fields out so they stay untouched.
3. Keep the card fields semantically separate: description is a brief identity overview, personality is behavioral traits, backstory is history, appearance is physical features and clothing. When asked for backstory or appearance, write it to that exact field, never into description.
4. character.update with the patch and apply:true.
5. Read the character back and compare each requested field with the requested value; for an explicit clear, confirm the field is now empty.

Verification: character.get and compare the requested fields. Claim completion only when every requested value or clear matches; otherwise correct it before replying.

Common Mistakes:
- Overwriting the whole card instead of patching the requested fields.
- Moving requested backstory or appearance into description.
- Reporting done without the read-back comparison.

Best Practices:
- For About Me, compose a short profile in the character's own voice and save it to aboutMe.
- For folder moves, resolve the destination with character.folder.list, then character.moveToFolder (the readBack confirms).`,
  },
  {
    id: "clone-character",
    name: "Clone Character",
    category: "task",
    summary: "Duplicate a character with modifications.",
    content: `# Clone Character

Purpose: Duplicate a character with modifications.

Tools used: app_data (character.get, character.create)

Workflow:
1. character.get the source card in full.
2. Build a new create payload from the source, applying the requested modifications and giving it a distinct name.
3. character.create with apply:true for the new card.
4. character.get on the new ID and compare it against the source to confirm the intended differences and that the rest carried over.

Verification: character.get on the new ID.

Common Mistakes:
- Cloning without first reading the source card.
- Leaving the clone with the original name.
- Dropping fields that were meant to carry over.

Best Practices:
- State plainly what was changed from the original.
- Keep the unchanged fields intact; treat the clone as a copy plus the requested deltas.`,
  },
  // ── Lorebook / preset / theme task skills ──
  {
    id: "create-lorebook",
    name: "Create Lorebook",
    category: "task",
    summary: "Author a new lorebook with entries.",
    content: `# Create Lorebook

Purpose: Author a new lorebook with entries.

Tools used: app_data (lorebook.create, lorebook.get, lorebook.entries), docs_read

When to use a plan: if the request is vague, emit one plan for the natural field order - category (world/character/npc/spellbook) -> scope (global vs linked to a character/persona/chat) -> first entry topic, chips tagged entity "lorebooks". Skip it once you can create the book.

Workflow:
1. Plan the entries first (premise, places, people, factions, rules), then create the whole book in one lorebook.create. Marinara saves the book and entries together, so never make an empty book to fill later.
2. Set each entry deliberately:
   - Always-true world premise (the setting's ground rules) -> constant: true, no keys. Everything else is keyword-triggered.
   - Topical lore -> keys (3-8 specific trigger words). Tighten a too-broad key with matchWholeWords: true; reach for caseSensitive/useRegex only when truly needed.
   - A shared or ambiguous word that mis-fires -> selective: true + secondaryKeys + selectiveLogic ("and" = any secondary present, "and_all" = all present, "not" = blocked if any present, "not_all" = blocked if all present). Secondary keys do nothing unless selective: true.
   - Alternate versions of one thing where only one should load -> give them the same group.
   - Fill description on every entry: it feeds the entry's semantic embedding and is what the Knowledge Router agent (when enabled) reads to route the entry, so an empty description weakens both.
   - Placement (position/depth/order/role): leave at defaults unless the user asks for specific placement; docs_read the "Position, Depth, and Order" section of docs/lorebooks/entries.md for exact values.
   - Semantic recall needs an embedding model. If embeddingModelConfigured: false there is no matching by meaning, so rely on keys and constant. If true, important but rarely-named lore may also be recalled by meaning once vectorized, so it need not be forced constant.
   - Recursion flags are inverted and subtle - set them only on an explicit request: preventRecursion defaults to TRUE (this entry does NOT trigger other entries; set it false to let its content trigger others), excludeRecursion: true stops this entry from being activated BY recursion (first-pass matches only), and delayUntilRecursion: true makes it activate ONLY on a recursion pass.
   - Vectorization gate: an entry joins semantic/vector recall only when it is NOT excluded AND an embedding model exists. Set excludeFromVectorization: false (include) ONLY when embeddingModelConfigured: true; with no embedding model it has no effect, so never promise vector recall then. excludeFromVectorization: true (exclude) is always fine.
   - You can also set (leave at defaults unless asked): activation chance probability (0-100), timing sticky/cooldown/delay/ephemeral (turn counts), inclusion-group weight groupWeight, per-entry scanDepth, locked, and folder placement folderId (an existing folder in the SAME lorebook). Pass a numeric field as null to clear it back to default.
3. lorebook.create with apply:true; the result's readBack confirms persistence.

Verification: lorebook.get then lorebook.entries on the created book.

Common Mistakes:
- Creating an empty book to fill in later.
- Leaving entry descriptions empty (weakens embedding and Knowledge Router routing).
- Forcing vector recall (excludeFromVectorization: false) when no embedding model is configured.
- Misusing group for entries that should co-load.

Best Practices:
- Unsure what a field does? docs_read docs/lorebooks/entries.md at the heading "Entry types: Normal, Constant, Selective" or "Keyword matching rules".
- After creating, OFFER the user a second-pass fidelity review (do not run it unprompted).`,
  },
  {
    id: "edit-lorebook",
    name: "Edit Lorebook",
    category: "task",
    summary: "Modify lorebook entries, structure, and settings.",
    content: `# Edit Lorebook

Purpose: Modify lorebook entries, structure, and settings.

Tools used: app_data (lorebook.get, lorebook.entries, lorebook.getEntry, lorebook.update, lorebook.addEntry, lorebook.updateEntry, lorebook.deleteEntry, lorebook.folder.list, lorebook.folder.create, lorebook.libraryFolder.list, lorebook.libraryFolder.create), docs_read

Workflow:
1. lorebook.get the book, then use the lorebook.entries index (entry IDs and content previews).
2. Call lorebook.getEntry with each relevant entryId before reviewing or rewriting its full content.
3. For entry changes use lorebook.updateEntry with the entryId; use lorebookId only for the book itself or for lorebook.addEntry.
4. When adding or rewriting entries, apply the same field rules as when creating: constant for always-true premises, keys for topical lore, selective + secondaryKeys for ambiguous words, group for alternates, a filled description on every entry, and the inverted recursion flags only on explicit request.
5. lorebook.updateEntry / lorebook.update with apply:true.
6. For folders, remember they are two separate things: lorebook.folder.list|create (with lorebookId) organizes entries inside one book (pass parentFolderId only for a nested folder); lorebook.libraryFolder.list|create are the folders shown in the main Lorebooks panel.

Verification: lorebook.getEntry on the modified entry (or lorebook.get / lorebook.entries for structure and settings).

Common Mistakes:
- Rewriting an entry without reading its full content first.
- Using entryId and lorebookId in the wrong places.
- Deleting an entry with a raw mari db delete: its --where selector can match and permanently remove far more rows than intended. If a raw delete is ever unavoidable, dry-run it first (apply:false) and confirm the exact affected-row count.
- Confusing the two kinds of lorebook folders.

Best Practices:
- Use lorebook.deleteEntry with the entry's entryId and apply:true to remove one entry (it shows a Keep/Restore card).
- After a substantive change, offer a fidelity pass: read the entries back and fix weak spots (narrow an over-broad key or add matchWholeWords, mark always-relevant lore constant, group alternates, fill a missing description).`,
  },
  {
    id: "create-preset",
    name: "Create Preset",
    category: "task",
    summary: "Build a new prompt preset with sections and variables.",
    content: `# Create Preset

Purpose: Build a new prompt preset with sections and variables.

Tools used: app_data (preset.create, preset.get)

When to use a plan: if the request is vague, emit one plan for the natural field order - starting point (from scratch vs clone existing) -> which sections to include, chips tagged entity "presets". Skip it once you can build it.

Workflow:
1. Ask the user what kind of preset they want before creating it.
2. Put the prompt sections in data.sections; section.role must be system, user, or assistant, and wrapFormat must be xml, markdown, or none.
3. Put preset variables in data.choiceBlocks. Each choice block needs variableName, question, and options with label/value pairs.
4. A choice block does nothing on its own: its picked value only reaches the model where a section's content references it with the {{variableName}} macro. So whenever you define a variable you MUST also drop its {{variableName}} into at least one section's content, or the user gets a picker in the preset UI that changes nothing.
5. preset.create with apply:true; the result's readBack confirms persistence.

Verification: preset.get on the created preset.

Common Mistakes:
- Defining a variable and never referencing it in any section (the anti-pattern: a {{tone}} variable with a section that is just "You are {{char}}.").
- Using a section role or wrapFormat outside the allowed values.

Best Practices:
- Follow the rule you teach: every declared variable must be referenced in a section.
- Offer follow-up suggestions (add a section, wire a variable, open for full editing) after a successful create.`,
  },
  {
    id: "edit-preset",
    name: "Edit Preset",
    category: "task",
    summary: "Modify preset sections, groups, and choice blocks.",
    content: `# Edit Preset

Purpose: Modify preset sections, groups, and choice blocks.

Tools used: app_data (preset.get, preset.sections, preset.getSection, preset.updateSection, preset.addSection, preset.deleteSection, preset.addGroup, preset.updateGroup, preset.deleteGroup, preset.addChoiceBlock, preset.updateChoiceBlock, preset.deleteChoiceBlock, preset.update)

Workflow:
1. preset.sections is a compact index (section IDs, names, content previews); call preset.getSection before rewriting one.
2. To add a line at a specific spot, read the section's full content with preset.getSection, splice your change into it, then preset.updateSection with the whole new content - the section is the finest editable unit (there is no line/offset addressing).
3. preset.addSection / preset.addGroup place the new item and wire it into the preset's order; preset.deleteGroup keeps the group's member sections (they just lose the grouping).
4. When you add a variable to an EXISTING preset with addChoiceBlock, also updateSection to weave the {{variableName}} into a section's content, or the picker changes nothing on its own.
5. Apply changes with apply:true.

Verification: preset.getSection on the modified section (or preset.get for the whole preset).

Common Mistakes:
- Attempting a partial section update - only whole-content updates are supported.
- Using line or offset addressing to edit a section.
- Adding a choice block without weaving its variable into a section.

Best Practices:
- Read before you rewrite: getSection, then updateSection with the full new content.
- Keep the section the finest unit of edit; do not hand-edit beyond that granularity.`,
  },
  {
    id: "create-theme",
    name: "Create Theme",
    category: "task",
    summary: "Create a new custom theme.",
    content: `# Create Theme

Purpose: Create a new custom CSS theme for the app.

Tools used: app_data (theme.create, theme.get), docs_read

Workflow:
1. docs_read docs/appearance/custom-css-themes.md for the current hooks before writing CSS.
2. Build the CSS on the stable .mari-window, .mari-drawer, and .mari-window-bubble classes and the public --mari-window-* / --mari-drawer-* variables for colors, fonts, shapes, and decoration. --mari-window-font-family overrides preset lettering and --mari-window-ornament replaces or hides the title ornament.
3. For chat appearance, target .mari-chat-style-surface, .mari-chat-style-conversation, .mari-chat-style-text, and .mari-chat-style-control with public --mari-chat-* variables.
4. Embed images and fonts as data URIs; external URL loads are blocked.
5. theme.create with apply:true (non-activating create - use apply:true immediately when the user asked for it).

Verification: theme.get after creation.

Common Mistakes:
- Using external image or font URLs (they do not load).
- Overriding controls and content when only decorative paint should change - clip only decorative paint.
- Claiming the theme is active when only a create was done; activation is a separate theme.setActive the user requests.

Best Practices:
- Keep text inputs and placeholders legible.
- Respect the Conversation shape exception: message bubbles keep their own shape even when font and color are overridden.
- After creating, offer to activate it (theme.setActive) if the user wants it applied.`,
  },
  {
    id: "edit-theme",
    name: "Edit Theme",
    category: "task",
    summary: "Modify theme colors, fonts, and settings.",
    content: `# Edit Theme

Purpose: Modify theme colors, fonts, and settings.

Tools used: app_data (theme.get, theme.update, theme.setActive), docs_read

Workflow:
1. theme.get the current theme first - inspect before editing.
2. Build the changed CSS or fields, keeping to the stable classes and public variables; embed images and fonts as data URIs.
3. theme.update with apply:true for the requested change.
4. If the user asked to make it the active theme, theme.setActive with apply:true.

Verification: theme.get after the change; for a setActive, confirm the active theme is what was requested.

Common Mistakes:
- Editing a theme without reading it first.
- Conflating an update with a setActive - changing a theme does not make it active, and vice versa.
- Changing a theme the user did not ask about.

Best Practices:
- Keep the edit scoped to what was requested.
- Route activation through the normal requested-change flow; do not flip the active theme on a cosmetic edit.`,
  },
];

export const BUILTIN_SKILL_MAP = new Map(BUILTIN_SKILLS.map((s) => [s.id, s]));
export const BUILTIN_SKILL_IDS = new Set(BUILTIN_SKILLS.map((s) => s.id));

/** Get a built-in skill's content (for the skill tool and restore-default). */
export function getBuiltinSkill(id: string): BuiltinSkillDef | undefined {
  return BUILTIN_SKILL_MAP.get(id);
}

/** Render the compact <skill_library> index block (~17 lines). */
export function renderSkillLibraryIndex(enabledIds?: Set<string>): string {
  const skills = enabledIds ? BUILTIN_SKILLS.filter((s) => enabledIds.has(s.id)) : BUILTIN_SKILLS;
  const lines = skills.map((s) => `- ${s.id}: ${s.summary}`);
  return [
    "<skill_library>",
    "Available skills (call `skill` with the id to load full instructions):",
    ...lines,
    "</skill_library>",
  ].join("\n");
}
