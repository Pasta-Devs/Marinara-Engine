---
name: Prompt presets
description: Read before creating, editing, reviewing or debugging a prompt preset, its sections, groups, markers or choice blocks, or explaining what a preset sends to the prompt.
---

# Prompt presets

Purpose: build or repair a preset — the ordered sections, markers and choice variables that decide what a roleplay chat sends to the model. Your own sections reach it only through `sectionOrder`.

Actions: reads `preset.list|get|search|sections|getSection|groups|getGroup|choiceBlocks|getChoiceBlock`; writes `preset.create|update|addSection|updateSection|deleteSection|addGroup|updateGroup|deleteGroup|addChoiceBlock|updateChoiceBlock|deleteChoiceBlock`. There is no `preset.delete` — an unknown sub-action returns `Unknown prompt preset action "<name>".` and the valid list. CLI `mari presets` needs `--apply` for writes.

- Creates (`preset.create`, `addSection`, `addGroup`, `addChoiceBlock`) write unless you send `apply: false`; `update` and the three deletes write only with `apply: true`, else return `mode: "dry-run"`.
- An applied write returns `readBack` with a status and row counts. On success it carries no ids; on `mismatch` it does. A no-op write returns no `readBack` at all — read `preset.sections|groups|choiceBlocks` for what exists now.
- Create fields go in `data`, update fields in `patch` or `data`. On `preset.create` the id must be inside `data`; every other action takes `presetId` at top level. Every write carries a `reason`.

## How a preset reaches the prompt

**`sectionOrder` is the prompt.** It is the JSON array of section ids that decides order and membership: a row can exist, show in `preset.sections`, and never be sent. `addSection` appends to the end. `injectionOrder` places nothing: the editor, `preset.sections` and the prompt all follow `sectionOrder`. It is a mirror the editor rewrites (0, 100, 200, …) when the user drags sections, kept for imports; setting it never moves a section. A section is skipped when its row is missing, `enabled` is not `"true"`, its group is disabled, its content is whitespace-only, or impersonation is on and it is not a marker.

**`preset.update` takes no sections.** It refuses `sections` and `promptSections` and writes nothing. Add one section with `preset.addSection`, edit one with `preset.updateSection`, remove one with `preset.deleteSection`. To reorder, send `preset.update` with the whole `sectionOrder` from `preset.get`, rearranged. Send ids exactly as `preset.sections` returns them: an id with quote characters inside it is refused.

**Groups wrap consecutive members only.** Same-group runs are wrapped in the group name; another group's section in between yields two blocks with that name, and mixed `role` in a run drops the wrapper. `groupOrder` is stored and read only by `preset.groups`; group `order` and `parentGroupId` are panel-only, so `addGroup` alone changes no prompt output — a group's position is where its member sections sit, and disabling it drops them all.

**Markers are a section kind.** `isMarker: true` plus `markerConfig.type` is how character, persona, history, summary, dialogue-example and lorebook text normally reaches the prompt: `character`, `persona`, `chat_history` (`chatHistoryOptions.maxMessages` trims history), `chat_summary`, `dialogue_examples`, `lorebook`, `world_info_before`, `world_info_after`, `agent_data` (`agentType` picks the agent), `current_scene_summary`, `recalled_scenes`, `recalled_messages`, `id_macro_cards`. A marker ignores stored `content` and `skipWrap` (except `agent_data`, where content can wrap the expansion) and drops out when its expansion is empty.

Without a marker some of it still arrives: the assembler appends the chat summary, injects referenced character and persona cards, and a `character` marker also adds `mes_example` when no `dialogue_examples` marker exists; game mode injects lorebooks when the preset has no `lorebook` marker. What never arrives without a section of your own is your text.

`markerConfig.type` is not validated by `app_data`: an unknown type expands to nothing and the section is dropped, and `isMarker` without `markerConfig` is sent as ordinary content. `skipWrap` and `content` on a marker are rejected by `addSection`/`updateSection` (only `preset.create` drops them silently).

`wrapFormat` is per preset (`xml` default, `markdown`, `none`); `skipWrap: true` bares one prompt section, never a marker; `injectionPosition: "depth"` with `injectionDepth` places a section near the end of the chat.

**Choice blocks write a macro.** Before macros resolve, every block sets `variableValues[variableName]`. The block does nothing on its own: its value lands only where `{{variableName}}` appears in a section that is actually sent. No selection → the first option; `""` or `[]` → empty (off); a stale single value → the first option; a stale multi-select value → empty; multi-select joins matches with `separator`; `randomPick` is per generation and multi/array only. Duplicates become `tone` and `tone_2` silently, so `{{tone}}` reads only the first. A zero-option block is skipped silently by `create`/`update` and rejected by `addChoiceBlock`/`updateChoiceBlock`.

**Attachment.** A roleplay chat stores its preset in `chats.prompt_preset_id`; a connection can override it. Generation takes the first that exists — impersonate, request, connection, chat — with no `isDefault` fallback and no stored active preset (`workspace_context` has none; `chat.get` exposes `promptPresetId`, `chat.list` omits it). `isDefault` is writable and not exclusive. REST refuses the stock preset with 409 `The stock Marinara Universal preset is read-only. Open it to create an editable copy.`; `app_data` does not guard it, but startup restores the stock preset and keeps your edit as a copy — treat the stock preset as read-only. A raw delete of it is recovered at startup too.

## Workflow

1. Resolve it: `preset.list` (limit 50, max 1000) and `preset.search` return preset rows only, never section text; `preset.get` returns the row with `sectionOrder`, `groupOrder` and `defaultChoices` parsed, without children. An unknown id on `get`/`getSection`/`getGroup`/`getChoiceBlock` answers `ok: false`, `output: null`, no error.
2. Read before rewriting: `preset.sections` previews content at 200 chars and `preset.choiceBlocks` gives `optionCount` plus a 160-char question, so `getSection` and `getChoiceBlock` are the only full reads. Splice into the whole `content` — a section has no line or offset addressing.
3. Choose the shape: markers for card, history, summary, examples and lorebook; ordered sections for rules and voice; `injectionPosition: "depth"` only when the user asks or an enabled preference allows it for an instruction inside the history — it moves with the chat every turn, costs prompt caching, and needs their `cachePlacement` record (skill `builtin-decisions`, What is gated). For a late instruction without that cost, an ordered section after the history marker.
4. Create it in one call with `data.sections`, `data.groups`, `data.choiceBlocks`; pin section and choice-block ids inside `data`; weave every `{{variableName}}` into a section there. Sections join a group by `groupName` (or `group`), nested groups by `parentGroupName` — `groupId` and `parentGroupId` in a create payload are ignored, and group ids cannot be pinned, so read them back.
   When the output limit is small (your workspace rules say so, or a reply was cut at it): create with the markers and the first section, then send one `preset.addSection` or `preset.addChoiceBlock` per reply, in prompt order, since `addSection` appends to the end of `sectionOrder`.
5. Write, then prove it: `preset.get` lists every intended section id in `sectionOrder`, and `getSection` on each changed section returns the full new `content` carrying the `{{var}}` it needs. Report those two facts in one line.

## Field reference

Preset: `name` (required), `description`, `sectionOrder`, `groupOrder` (stored, read only by `preset.groups`), `variableValues` (macro defaults), `defaultChoices` (saved answers over preset defaults), `parameters` (generation settings, wholesale), `wrapFormat`, `scopedRegexMode` (invalid or `null` throws a Zod error), `conversationPrompt`/`gamePrompt` (used by Conversation and Game mode; the Roleplay assembler ignores them), `isDefault`, `author`, `imagePath` (string only; REST writes the file).

Section: `name` (wrapper tag/heading), `content`, `role` `system|user|assistant`, `enabled`, `groupId` (set on update; create uses `groupName`), `isMarker`, `markerConfig`, `injectionPosition` `ordered|depth`, `injectionDepth`, `injectionOrder`, `skipWrap`; `identifier` is fixed at create. A create payload coerces a bad `role`/`displayMode`/`optionSort`; the granular actions raise.

Group: `name` (wrapper), `enabled`, `parentGroupId` and `order` (panel-only).

Choice block: `variableName`, `question` (defaults to it), `options` (strings or `{label,value}`; `updateChoiceBlock` replaces all and refuses an empty array), `multiSelect`, `separator` (default `", "`), `randomPick`, `displayMode`, `optionSort`, `sortOrder`.

Ignored silently: top-level `id` on `preset.create`; `groupId`/`parentGroupId` inside a create payload; `identifier` on `updateSection`; `injectionOrder` as an ordering instruction; a zero-option block inside `create`/`update`; `system_key`/`systemKey`.

## Errors and fixes

Wording is exact. `No changes: every row already has these values, so nothing was written and no review card was made.` is a no-op, not a failure.

| Message                                                                                                                                                                                 | Fix                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `prompt preset id is required (none was sent): send a non-empty "id" or "presetId" or "promptPresetId" top-level. If you do not know it, use the matching list or search action first.` | Resolve it with `preset.list` or `preset.search` first.                           |
| `prompt section id is required (none was sent): send a non-empty "sectionId" or "id" top-level. If you do not know it, use the matching list or search action first.`                   | Take the id from `preset.sections`.                                               |
| `preset.updateSection needs sectionId plus a field such as content, name, role, enabled, groupId, injectionOrder, or skipWrap`                                                          | No recognised field arrived — a misspelled one, or `identifier`, counts as empty. |
| `Section <id> is a marker; its content is generated from markerConfig at assembly, so a content edit has no effect. Edit markerConfig instead.`                                         | Edit `markerConfig` or its source, not the marker's text.                         |

## Worked example

One `app_data` call per line, ids pinned by the example. A marker and a prompt section create the preset, then one choice variable, one section edit and the proof reads.

```
{"action":"preset.create","data":{"id":"preset-guarded-prose","name":"Guarded Prose","sections":[{"id":"s-card","name":"Character","role":"system","isMarker":true,"markerConfig":{"type":"character"}},{"id":"s-main","name":"Main","content":"Write {{char}}'s next turn in a {{tone}} tone.","role":"system"}],"choiceBlocks":[{"id":"cb-tone","variableName":"tone","options":[{"label":"Warm","value":"warm"},{"label":"Sharp","value":"sharp"}]}]},"reason":"Carries the card and lets each chat pick a tone"}
{"action":"preset.get","presetId":"preset-guarded-prose"}
{"action":"preset.addChoiceBlock","presetId":"preset-guarded-prose","data":{"variableName":"pace","options":["measured","brisk"]},"reason":"Lets the chat choose pacing"}
{"action":"preset.updateSection","sectionId":"s-main","data":{"content":"Write {{char}}'s next turn in a {{tone}} tone at a {{pace}} pace."},"reason":"Makes the new pacing choice reach the model","apply":true}
{"action":"preset.getSection","sectionId":"s-main"}
{"action":"preset.get","presetId":"preset-guarded-prose"}
```

`preset.get` must still list `s-card` and `s-main` in `sectionOrder`; `getSection` shows both `{{tone}}` and `{{pace}}`. Report that in one line.

## Where the detail lives

`docs_read` takes one heading per call. In `docs/prompts/presets.md`: `Sections and markers`, then `Groups and section position`, then `Position and depth`, then `Wrap formats`, then `Assigning a preset to a chat`, then `Decision blocks and prompt caching`. In `docs/prompts/preset-variables.md`: `What preset variables are`, `Adding a preset variable`, `The Configure Preset Variables modal`, `The {{NAME}} catch-all`. In `docs/prompts/macros.md`: `Dynamic variables`, `Chat variables`.
