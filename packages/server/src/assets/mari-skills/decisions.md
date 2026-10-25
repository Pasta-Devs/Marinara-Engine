---
name: Decisions
description: Read before writing or debugging a decision or decision-choice conditional in a preset section, lorebook entry, character depth prompt or agent activation setting: permission to author it, the exact macro forms, timing and priority, option criteria, size caps, and why a branch never fires.
---

# Decisions

Purpose: write prompt-text conditionals — `{{#if decision:"…"}}` and `{{#if decision_choice:"…" == "option"}}` — whose branch text follows what the last messages contain. Recorded permission and the exact parse decide whether they work.

Actions: `decision.get`, `decision.record`; writes `preset.create|update|addSection|updateSection|addChoiceBlock`, `lorebook.create|addEntry|updateEntry`, `character.update`, `agent.update` with activation fields inside `settings`; reads `preset.getSection`, `preset.getChoiceBlock`, `lorebook.list`, `lorebook.entries`, `lorebook.getEntry`, `persona.get`.

## The syntax

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}Combat pacing.{{else}}Ordinary pacing.{{/if}}
{{#if decision_choice:"Scene mood" == "tense":"Raises the stakes"}}Clip it.{{else if decision_choice:"Scene mood" == "calm"}}Slow it.{{else}}Match the scene.{{/if}}
```

- The operand starts `decision:` or `decision_choice:`, case-insensitive; quotes may be straight or typographic, and the parser is greedy, so the closing quote is the last before the modifiers. Macros resolve before it becomes the key.
- Write the comparison on the left operand — `decision_choice:"<subject>" == "<option>"` — with `==`, `=`, `is`, `!=` or `is not`; `== "rain" || "snow"` adds both. Modifiers precede `==`.
- `decision:` is true or false, `decision_choice:` the chosen option or nothing; no answer makes every comparison false, `!=` included. `&&`, `||`, parentheses, `{{else if}}` and nesting work; two occurrences of one statement are one question.
- Never gate essential scene or safety content behind a decision: with no answer every comparison reads false, so the branch with the necessary text must be the `{{else}}`.

## What is gated

Two separate gates check every write you make, and each needs its own record.

**Decision content** (`authoring`) — anywhere in a character, persona, lorebook entry, agent, preset, preset section or choice block:

- decision syntax in any field: a card's description, an ordinary preset section, a lorebook entry's content — not only the depth shapes below.
- a non-empty `decisionStatement` on a lorebook entry, **even with `decisionMode: "off"`**: a drafted statement is authored content.
- a non-empty `activationQuestion` in an agent's `settings`.

The counted key includes the field, the statement text and its options, so **rewording a statement, changing an option, or copying the conditional into another field is new content** — not an edit. Removing one, timing edits (`sticky`, `cooldown`) and threshold tuning pass.

**Preserve existing Decisions.** During an edit the user did not aim at a Decision, keep every existing conditional, `decisionStatement` and `activationQuestion` verbatim — rewrite around them. Removal passes the gate, so nothing stops you deleting the user's Decision by accident.

**History placement** (`cachePlacement`) — with or without any decision in it, a new or changed:

- preset section at `injectionPosition: "depth"`,
- lorebook entry at `position: 2`,
- character `data.extensions.depth_prompt.prompt`.

Text inserted at a depth moves every turn as the chat grows, so the provider cannot reuse its cached prompt from that point on. Use ordinary placement (an ordered section; lorebook `position` 0 or 1) unless the user asked for depth or an enabled preference allows it; then explain the cache cost and record their instruction with `cachePlacement`. Nothing else is placement-gated — never ask for "early prompt" permission.

## Permission

Recorded, never inferred — one object in `data`:

```json
{
  "category": "authoring",
  "answer": "allow",
  "source": "user",
  "quote": "Use Decisions for this chat",
  "scope": "chat"
}
```

- `category`: `authoring` (may add decision content), `setupReminder` (the model question, once per chat), `cachePlacement` (the three history-placement shapes, decisions or not); one per category per chat.
- `answer`: `pending`, `allow`, `decline`, `suppress` (setupReminder only). `scope`: `turn` (default) or `chat`; setupReminder is always `chat`. `source`: `user` (default), `memory`, `skill`; the last two need `sourceId` (max 200). `quote`: 1–2000 characters, a substring of the source body.
- Record the question before asking it: `{"category":"setupReminder","answer":"pending","source":"user"}` — pending needs no quote — then ask in your reply and stop. Never answer your own pending question; silence is not allow or decline; record the answer on the next user turn; a decline stays.
- A `turn` record ends at the next user message; a memory or skill record lives while its source is enabled and holds the quote. A memory you save starts disabled, so it cannot authorise anything until the user enables it.
- Explaining syntax is not permission, nor is a request that mentions decisions: the record proves provenance, not consent. If the record is absent, name what is missing and stop rather than write decision content. `suppress` removes reminders only.
- `decision.get` first: `selected` means configured, not health-tested. Any other status — `none`, `unavailable`, `unknown` — is treated as no usable model, which adds two requirements to the next allow: it must quote this turn's user message, and `setupReminder` must be `allow` or `suppress`. `unknown` is a failed lookup, not missing setup. Never start a model to check.
- No usable model: before writing, tell the user what happens — with no answer every comparison reads false, so only the `{{else}}` text is ever sent until they select a Decision model (or, for `unknown`, until the lookup works). Record `setupReminder` `pending`, ask whether to add it anyway, and stop. Record their reply on the next turn. The request that asked for Decisions is not an answer to a warning it never saw: never record `setupReminder` `allow` from it.

## Timing and priority

- `sticky:N` holds a yes N turns; `cooldown:N` then holds no N turns; `every:N` asks every N turns, reads false between checks and takes no slot, so it misses fleeting events. Integers above 0, capped at 1000; `sticky:0`, `every:0`, `priority:urgent` and unknown modifiers are dropped silently.
- `priority:high` or `priority:low`; no priority is medium. The plan sorts high → medium → low and drops low first under `decision-prompt-question-limit` (default 32, max 255); a dropped statement reads no with `status: "dropped"`.
- **The limit is staged, not shared.** The preset's prompt plan is built first, and lorebook statements (which have no `priority` field of their own) get what remains. On a turn carrying many preset statements, a lorebook `require` can be dropped before it is ever asked. Keep preset decisions few when a lorebook entry depends on one, or move the rule into the preset.
- `until:"…"` / `while:"…"` add a second statement: after a yes the block stays on while it holds, and that condition is asked instead. The join is a colon suffix — `until:"…":and`, `until:"…":or` — and the defaults differ: `until` joins with `and`, `while` with `or`; with no `sticky` the plan forces `or`. `:restrict` and `:extend` are accepted too. Only `decision:` takes them; a `decision_choice:` silently drops the modifier. In `decisionStatement` or `activationQuestion`, `sticky:3` is literal text.
- Occurrences merge by max sticky, max cooldown, min `every`, highest priority.
- Every prompt statement sees the last five saved messages (`DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH` = 5), the just-saved message included; agent questions use `activationScanDepth` (1–200); post-processing statements see the new reply, pre-generation ones do not.
- Answers cache per turn, 200 turns: a pre-reply swipe reuses them, an edited message re-asks only for the newest message, and a failure is not cached as no. Answers are never injected.

## Options and criteria

- Options are the literals compared with the statement this turn; write them as criteria — `== "tense":"Raises stakes or threatens someone"` — option then description, one quote kind, first criteria kept.
- `"none of these"` is always offered; when chosen every comparison is false, so give the tag a real `{{else}}`.
- A `decision_choice:` with no compared option is never asked. Keep options few and state observable text from those five messages; a keyword often suffices.

## Workflow

1. Get the record before the first content write: `source:"user"` quoting this turn's message, or `memory`/`skill` with an exact quote. No usable model → warn, record `pending` and stop first; both allows then quote the user's reply.
2. Write one timing control, `priority:` on a preset with many decisions, `until:` when the state must survive the yes.
3. Read back. Stored is not proved: Peek Prompt or the decision debug output lists each statement as `ready`, `answered`, `unanswered`, `deferred`, `evaluated`, `cached`, `held`, `dropped` or `unavailable`, unanswered under `decisions.unanswered`; absent means unreachable.

## Errors and silent failures

A malformed prompt statement is never rejected — no grammar validation exists, so a misspelled keyword or a wrong operand form never matches and reads as no, separately from a statement-text typo that asks a different question than you meant.

- Absent from the plan: its text is unreachable — a disabled section or group, a choice block with no selected value, a chat with no preset. Conversation and Game mode exclude preset sections entirely.
- A conditional in a lorebook entry's **content** cannot gate activation: decisions are asked only for entries that already activated. `decisionMode: "off"` never asks.
- Lorebook `require` admits nothing when the statement has no answer (a sticky-held entry continues), and an empty or whitespace `decisionStatement` is inert. `trigger` keeps ordinary routes and adds one when keywords miss.
- `app_data` truncates `decisionStatement` at 500 characters silently where REST returns 400; an unknown `decisionMode` is 400 on REST and `ok:false` through `app_data`, but an import or raw write stores `"off"`.
- Agent question gone, two paths: a **new** out-of-range value (`activationThreshold` 0.05–0.95, `activationScanDepth` 1–200, `activationMaxSkip` 1–100, `activationQuestion` up to 500) is rejected with `ok:false`; an **imported** bad value passes validation and makes `activationQuestionSettings()` return null, so the gate silently disappears — as does an `activationKeywords` value that breaks the same parse. `runInterval` is a positive integer; `<= 1` is no cadence.

## Worked example

Precondition: an active Mari chat with no Decision model selected; every `quote` must be a substring of the user message it cites. The user asks `Use Decisions for this chat and add the pacing preset.`:

```
{"action":"decision.get"}
{"action":"decision.record","data":{"category":"setupReminder","answer":"pending","source":"user"}}
```

`decision.get` reports `none`, so you write nothing yet: say that until a Decision model is selected every comparison reads false and only the `{{else}}` text is sent, ask whether to add the preset anyway, and stop. The user replies `Yes, add the pacing preset without a model.` — now both records quote that reply:

```
{"action":"decision.record","data":{"category":"setupReminder","answer":"allow","source":"user","quote":"Yes, add the pacing preset without a model."}}
{"action":"decision.record","data":{"category":"authoring","answer":"allow","source":"user","quote":"Yes, add the pacing preset without a model.","scope":"chat"}}
{"action":"preset.create","data":{"id":"preset-decision-pacing","name":"Decision pacing demo","description":"Pacing rules sent only on the turns they apply.","sections":[{"id":"section-pacing-rules","identifier":"pacing_rules","name":"Pacing rules","content":"{{#if decision:\"The latest message starts a fight\" sticky:3 cooldown:5}}Combat pacing: short sentences, no time skips.{{else}}Ordinary pacing: description and reflection are welcome.{{/if}}\n{{#if decision_choice:\"The mood of the scene in the latest message\" == \"tense\":\"The latest message raises stakes or threatens someone\"}}Keep sentences clipped.{{else if decision_choice:\"The mood of the scene in the latest message\" == \"calm\"}}Slow the scene down.{{else}}Match the scene as written.{{/if}}\n{{#if decision:\"In the latest message, a character is badly hurt\" priority:high until:\"The injuries are treated in the latest message\"}}Injuries persist until treated.{{/if}}"},{"id":"section-style","identifier":"style","name":"Style","content":"Write in third person, past tense.\nScene mood: {{mood}}"},{"id":"section-history","name":"Chat History","isMarker":true,"markerConfig":{"type":"chat_history"}}],"choiceBlocks":[{"id":"choice-block-mood","variableName":"mood","question":"Scene mood","options":[{"label":"Tense","value":"tense"},{"label":"Calm","value":"calm"}]}]},"apply":true,"reason":"Add Decision-gated pacing rules to a new preset."}
{"action":"lorebook.create","lorebookId":"lore-decision-pacing","data":{"name":"Decision pacing lore","description":"Lore that follows the scene.","entries":[{"name":"Fight lore","content":"Fights in the tavern follow the house rules: no blades, no magic.","keys":["fight","brawl"],"decisionMode":"trigger","decisionStatement":"The latest message starts a fight","sticky":3,"cooldown":5},{"name":"Infirmary notes","content":"The infirmary keeps a ledger of every wound treated here.","keys":["infirmary"],"decisionMode":"require","decisionStatement":"In the latest message, a character is injured"}]},"apply":true,"reason":"Add lore that activates on scene decisions."}
{"action":"preset.getSection","sectionId":"section-pacing-rules"}
{"action":"preset.getChoiceBlock","choiceBlockId":"choice-block-mood"}
{"action":"lorebook.entries","lorebookId":"lore-decision-pacing","limit":50}
{"action":"decision.get"}
```

`preset.getSection` returns the three conditions verbatim, `preset.getChoiceBlock` both options, `lorebook.entries` both entries, and `decision.get` both records `answer: "allow"`, `active: true`. Open one entry with `lorebook.getEntry` for its `decisionStatement`, `decisionMode`, `sticky` and `cooldown` when you need them. Stored is not parsed: Peek Prompt or the decision debug output must list the fight statement with `sticky: 3`, the mood statement with both options, and the injury statement as high priority.

## Where the detail lives

`docs_read` takes one heading per call. `docs/prompts/conditional-prompts.md`: `The basic syntax`, `Until and while`, `Priority`, `Statement allowance`, `When a decision branch never appears`. `docs/connections/decision-models.md`: `Thresholds`. `docs/lorebooks/entries.md`: `Decision activation`. `docs/agents/custom-agents.md`: `Activation questions`. `docs/prompts/presets.md`: `Decision blocks and prompt caching`.
