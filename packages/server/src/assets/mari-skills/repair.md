---
name: Reply diagnosis and repair
description: Read before diagnosing or repairing a bad reply: cut off, empty, oddly short, or a character who forgets or ignores their card.
---

# Reply diagnosis and repair

Purpose: read the saved facts behind one bad reply and report them with their real numbers, then repair the reply only when the user asks. `chat.diagnose` never returns message text, so the reply you repair has to be read.

Actions: reads `chat.diagnose`, `chat.messages`, `character.get`; writes `chat.updateMessage`. The CLI reads and writes raw tables (`mari chats messages`, `mari db …`) but nothing in it diagnoses a reply.

## Workflow

1. Call `chat.diagnose` with `chatId` from `activeChat`; pass `messageId` only when the user named a reply (`"last"`, `"latest"`, `"newest"` count as absent), and with no id it diagnoses the newest assistant or narrator message. It returns every applicable finding, not one. If the checkup for that reply is already in your context, use it instead of calling again.
2. Report before changing anything, in one shape: a line in your voice, then ONE cause with its real number first — the first finding's own `text` (`card_large` comes first when the card forced the trim) — at most three short bullets on the settings it names, and ONE fix, that finding's `fix`. No other causes, no second fix, no hedging. Name a gap only when the card does not already explain it.
3. Repair only on request — "fix the last reply", a named defect, the Fix shortcut. An acceptable reply is not a repair target; if nothing is broken, say so. Do not diagnose when the user is asking about Mari herself or how a feature works.
4. Read the reply before rewriting it. `chat.messages` takes no `messageId` (it is ignored, and you get the whole chat): read by post. For the newest reply send `last: 1` and check that `messages[0].id` is the id `chat.diagnose` returned — if the user wrote after it, read `last: 5` and take the row with that id. For an older post send `afterPost` = its `postNumber` minus 1 with `limit: 1`. Build the repaired `content` from that row's `content`, then `chat.updateMessage` with `apply: true` — without `apply` it is a dry run that writes nothing, and the user never sees it.
5. Verify the swipe you added: the same post now shows your `content` as its active swipe and a `swipeCount` one higher than before the write; if either differs, read the row and resend. Read it with the same `chat.messages` call (`last: 1` only when it is still the newest post); `chat.updateMessage` returns no `readBack`, and a second `chat.diagnose` cannot reproduce what you just fixed.

## What the findings mean

Each finding is `{code, text, fix}`; the panel's `link` is not returned. `text` carries the numbers, and `fix` is specific only for `cut_off`, `card_large` and `lore_budget_skipped` — the other three fall back to `Point to Chat Settings -> Advanced Parameters.`

| code                  | what it points at                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cut_off`             | hit the output limit mid-sentence: `The reply hit its <n>-token output limit and stopped mid-sentence.` Fix: raise Max Output Tokens, a `preset.update` of `parameters.maxTokens`.                                                                                                                      |
| `empty_reply`         | nothing was written; the text is built from the saved finish reason, usage and thinking, so relay it. Fix falls back to the generic line.                                                                                                                                                               |
| `history_trimmed`     | `<n> older messages were not sent: the prompt needed <tokens> tokens, the budget was <budget>.` The generic fix is wrong here: `Prompt budget` is the computed input budget, which a large card, lorebook or prompt can exhaust with no small window involved. Point at the chat's connection settings. |
| `reply_budget_cut`    | `The reply limit was cut from <a> to <b> tokens to make room for the prompt.` Fix falls back to the generic line.                                                                                                                                                                                       |
| `lore_budget_skipped` | entries matched but the budget left them out, up to three names quoted. Fix: move the entry earlier in `order` with `lorebook.updateEntry`; the book's Token Budget is a book-level field (`lorebook.update`), not an entry field.                                                                      |
| `card_large`          | the card exceeds 40% of the prompt budget: `The character card is about <tokens> tokens, <percent>% of the <budget>-token prompt budget.` Fix: shorten it with `character.update`.                                                                                                                      |

- `reply` carries the on-screen names: `Prompt tokens`, `Max Context Window`, `ended`, `Reply tokens`, plus `Older messages not sent`, `Prompt budget`, `Max Output Tokens` and `Max Output Tokens before the cut` when a context fit was saved. `ended` reads `It ended on its own; nothing cut it.`, `It was cut off at the output limit.`, or the provider value lowercased.
- `lorebooks` lists included books as `{name, "Token Budget"}`; `preset` gives the active preset's `name` and `sends`, or `null`. An empty `lorebooks` is the only evidence of no linked book — not a finding.
- `findings: []` means the saved facts show nothing, not that the reply is fine: imported, pre-`generationInfo` and already-repaired messages have no info, so findings stay silent and most `reply` values are `null`. An empty chat returns `messageId: null`. When nothing is found, say what the facts show and point at the next check (Peek Prompt, the card).
- For forgetting or ignoring the card, the checkup measures only its size: read it with `character.get`, and use Peek Prompt to see what actually reached the model. The card or a setting the finding names can be the cause.

## Repair rules

- `chat.updateMessage` **adds a swipe**, never an in-place edit: the new swipe is appended, becomes active, and gets `generationInfo: null` and `tokenCount: null`; memory chunks from that message onward are invalidated. The earlier swipe keeps its extras.
- Capture the diagnosis before repairing, and quote its numbers in your answer: the new active swipe is what `chat.diagnose` reads next, and it no longer shows the cut-off, empty or trim finding.
- Arguments: `chatId`; `messageId` (or `message_id`/`id`); `content`, the full repaired reply; `reason`; `apply`. `messageId` may be a search row id `message:<chatId>:<n>` when the prefix matches `chatId`, with `n` the 1-based `postNumber` from `chat.messages`; `chat.diagnose` does not resolve that form.
- `apply` defaults to false: without it, `mode: "dry-run"`, `approval.status: "not_required"`, no swipe, and nothing the user can see. With `apply: true`, `mode: "apply"`, `summary.updatedRows: 1`, `approval: {status: "pending", id, expiresAt}`, and the Undo card.
- Repair, not rewrite: fix only the defect, keep the voice and every other word, never continue the scene. Stray out-of-character lines and broken formatting are defects; a plot you would have written differently is not.
- Refused: a user message, a game chat, blank `content`, a message from another chat.

## Raw writes and a broken app

- Never edit `messages` or `message_swipes`: raw writes to them are refused, and the error names `chat.updateMessage` as the only path. `mari db delete --where` has no row cap and `mari db transform` executes a script — neither is a repair tool.
- `apply` is an `app_data` field; on the CLI it is `--apply`, with the same default (omit it to preview). `--apply` commits at once and is not an approval gate; the Undo card follows the commit, lasts 14 days, keeps the newest 50, and refuses to restore a row that changed since. There is no `mari db restore`.
- When the app itself, not a reply, is broken: `mari db validate` reports structural problems and repairs nothing, `mari code health` adds git status to it, and `mari db status` always says `ok`. Nothing checks embeddings, orphans, connections, keys, backups or the storage format, and every `mari` command needs a live server — so a startup failure has no CLI diagnosis. Read the server or launcher error and the troubleshooting page.

## Errors and refusals

| message                                                                                                                                                              | when                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `No chat has the id "<id>". …`                                                                                                                                       | diagnose / updateMessage on a missing chat |
| `No message has the id "<id>". …`                                                                                                                                    | the id is not a message of this chat       |
| `chat.updateMessage needs non-empty content for the fixed reply.`                                                                                                    | `content` is blank                         |
| `chat.updateMessage can only fix an assistant or narrator reply, not a user message.`                                                                                | the target is the user's turn              |
| `chat.updateMessage only fixes replies in non-game chats; a game chat's turns are out of scope.`                                                                     | the chat's `mode` is `game`                |
| `Raw mari db writes to "<table>" are refused. Use chat.updateMessage to fix an assistant or narrator reply as a new swipe instead of editing message rows directly.` | a raw write to a message table             |

## Worked example

For a chat whose id is `lantern-chat-7f3a`, whose newest reply is post 12, `msg-9c41`, stopping mid-sentence at a 700-token output limit:

```
{"action":"chat.diagnose","chatId":"lantern-chat-7f3a","messageId":"msg-9c41"}
{"action":"chat.messages","chatId":"lantern-chat-7f3a","last":1}
{"action":"chat.updateMessage","chatId":"lantern-chat-7f3a","messageId":"msg-9c41","content":"She sets the glass down and finally answers you. \"Twelve ships,\" she says, \"and one of them never reached the bay.\"","reason":"Finishes the cut-off reply without changing the scene.","apply":true}
{"action":"chat.messages","chatId":"lantern-chat-7f3a","last":1}
```

The first call returns one `cut_off` finding whose `text` names the 700-token limit (`reply["Max Output Tokens"]` repeats it when a context fit was saved) and `ended: "It was cut off at the output limit."` — give those numbers and the Max Output Tokens fix, and stop unless the repair was requested. The second returns `messages: [{postNumber: 12, id: "msg-9c41", content, …}]` — the id matches, so its `content` is the text to finish. The third adds the swipe and returns `approval.status: "pending"`; the fourth shows the repaired text on that post. Diagnose `msg-9c41` again and you get `findings: []` with null `reply` values; the old swipe still holds the original numbers.

## Where the detail lives

`docs_read docs/prompts/generation-parameters.md` at `Symptom-based tuning tips` and `Each parameter in plain language` for Max Output Tokens and Max Context Window. `docs_read docs/chats/peek-prompt.md` at `Using Peek Prompt to debug responses`. `docs_read docs/chats/messages.md` at `Swipes: alternate replies`. `docs_read docs/TROUBLESHOOTING.md` at `Storage and data` when the app, not a reply, is broken. No user-facing page documents `chat.diagnose`, `chat.updateMessage` or `mari db`.
