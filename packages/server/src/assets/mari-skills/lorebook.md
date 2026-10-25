---
name: Lorebook authoring
description: Creating, editing, reviewing or debugging a lorebook or its entries: the book and entry fields, keys and selective logic, groups, probability and timing, activation, entry folders, library folders, and why an entry fires too often or never.
---

# Lorebook authoring

Purpose: build or repair a lorebook — its entries, and the settings that decide when each reaches the prompt.

Actions: reads `lorebook.list|get|entries|getEntry|search|testScan|folder.list|libraryFolder.list`; writes `lorebook.create|update|addEntry|updateEntry|deleteEntry|linkCharacter|unlinkCharacter|folder.create|libraryFolder.create`. CLI: `mari lorebooks`; a CLI write dry-runs without `--apply`.

## Write contract

- **Creates write by default; updates and deletes only preview.** `create`, `addEntry`, `linkCharacter`, `folder.create` and `libraryFolder.create` apply unless you send `apply: false`; `update`, `updateEntry`, `deleteEntry` and `unlinkCharacter` write only with `apply: true`, and without it return `mode: "dry-run"` and a `summary`.
- An applied write returns `readBack`: `status: "verified"` with `checkedRows`, `"mismatch"` when the rows came back different, or `"unavailable"`. Only `verified` means it landed; on `mismatch`, read the row back yourself.
- Fields go in `data` (create) or `patch` (update); top-level names work too, and entries belong in `data.entries`.
- `entryId` is the entry; `lorebookId` is the book, required by `addEntry`, `entries`, `testScan` and `folder.*`; `create` takes a chosen book id and `addEntry` a chosen entry id, but entries saved inside a `create` get generated ids — read them from `lorebook.entries`.
- Delete one entry with `deleteEntry` and `apply: true`; never `mari db delete --where`, which takes every matching row.

## Workflow

1. Resolve the book: `lorebook.list` (limit 50, max 1000, no offset) and `lorebook.search` return book rows only — `search` never looks at entry content. `lorebook.get` adds `entryCount`, with booleans as `"true"`/`"false"` strings. `get` refuses an unknown id (`No lorebook has the id "<id>". …`); only `getEntry` answers one with `ok: false` and `output: null`, no error, so check for it.
2. Read first. `lorebook.entries` pages `{items, total, offset, nextOffset}` by `order` (limit 100, max 2000); follow `nextOffset`. Rows are previews — 200 chars (tag 100), keys 50 × 100, `keysTruncated: true` when cut — so `getEntry` before rewriting content or keys, and read every page before deleting or reordering.
3. Plan the entries first — premise, places, people, factions, rules — and save them with the book in one `create`; `data.entries` goes in with it, defaulting to `order` 100, 200, 300 in list order. Never create an empty book to fill later.
   When the output limit is small (your workspace rules say so, or a reply was cut at it), create the book with its first one or two entries, then send one `lorebook.addEntry` per reply with an explicit `order` that continues the 100-step sequence.
4. Route each entry by how it is reached:
   - always relevant (a premise or a rule) → `constant: true`, no keys; it is still filtered, timed and rolled;
   - reached by words the player types → 3-8 `keys`, `matchWholeWords: true` for short or common keys;
   - reached by a key that also appears in the wrong scene → `selective: true` with `secondaryKeys`;
   - versions that must not co-exist → the same `group`;
   - lore the player rarely names → `constant: true` or vectors, never keys alone: a keyword miss is silent.

   Leave `probability`, timing (`sticky`, `cooldown`, `delay`, `ephemeral`) and placement (`position`, `depth`, `role`) at their defaults unless the user asks: a rumor at `probability: 40` fails six times in ten, and the user asks why it never shows.

5. Write with a one-sentence `reason` and `apply: true` on updates and deletes, then verify: `get` reports the `entryCount` you wrote, the last `entries` page has no `nextOffset` (nothing truncated), and each `getEntry` returns your content whole with no `keysTruncated`.
6. Offer a fidelity pass, run only on acceptance: re-read, then `updateEntry` to narrow a broad key, add `matchWholeWords`, mark always-relevant lore `constant`, group alternates, fill a missing `description`. A text edit leaves the stored embedding describing the old text, so name the re-vectorize step once.

## Activation traps and vectors

- `sticky`, `cooldown` and `delay` count **scans** — one per message or generation; `ephemeral` counts **activations**, after which the entry turns itself off in that chat. Sticky keeps an entry active as `matchedKeys: ["[sticky]"]`, with no fresh match.
- `probability`: `null` always fires, `0` never; otherwise one roll per scan.
- `group`: one winner per scan by `groupWeight` (default 100); a sticky winner keeps the group.
- `position`: `0` and any negative inject before the character definition, `1` after it, `2` **@ Depth** — inside the chat history, `depth` messages back from the newest (default 4) as `role`; `7` an **Outlet** — never injected on its own, only where a prompt section reads `{{outlet::<outletName>}}`. Any other number is accepted by `app_data` and injects **nothing** — a silent data-quality bug, so check the value you send. Leave `position` at its default unless asked: `2` moves with the chat every turn, costs prompt caching, and needs the user's `cachePlacement` record (skill `builtin-decisions`, What is gated).
- `selectiveLogic`: `and` (default) and `or` mean at least one secondary key is present, `and_all` means all, `not` means none, `not_all` means not all. An invalid value is dropped silently.
- `additionalMatchingSources` scans the named card or persona fields too: `character_name`, `character_description`, `character_personality`, `character_scenario`, `character_tags`, `persona_description`, `persona_tags`.
- Recursion only runs when the book's `recursive` (`recursiveScanning`) is on, and **`preventRecursion` is inverted and defaults to `true`**: true means the entry's content never triggers others. To let entries trigger each other, turn the book's `recursive` on **and** set `preventRecursion: false` on every entry whose content should trigger; the book switch alone changes nothing. `excludeRecursion: true` keeps an entry from being reached by recursion; `delayUntilRecursion: true` lets it fire only that way.
- `enabled: false` stops an entry entirely. `locked: true` stops the Lorebook Keeper agent from changing it, not the user.
- `null` clears `probability`, `scanDepth`, `sticky`, `cooldown`, `delay`, `ephemeral`, `groupWeight` and `folderId`; every other field is replaced by what you send.
- `app_data` clamps what the REST API rejects: `probability` to 0-100, `entryLimit` to 1-1000, `maxRecursionDepth` to at least 1, `vectorQueryDepth`/`vectorMaxResults` to their ranges. Unmatched enum strings and unknown fields are dropped silently, so a typo costs behaviour with no error.

## Entry folders and panel folders

- `lorebook.folder.create` (`lorebookId`, optional `parentFolderId` for nesting) writes an entry folder, always enabled and ordered last; entries join it with `folderId`.
- `lorebook.libraryFolder.create` writes an empty folder in the main Lorebooks panel (`scope: "lorebooks"`); no action files a book into one.
- `testScan` reports `folder_disabled` when an entry's folder or a parent is off.

## Description and vectors

- `description` is embedded too: the vector text joins `name`, `description`, `keys`, `secondaryKeys` and `content`, so a one-line gist that paraphrases the entry helps semantic recall — do not paste the content into it.
- Semantic recall needs the book's **Vectors** switch — off by default for books created in the UI, on for a book created through `app_data` — and an embedding model in `workspace_context`; with `Embedding model: none` there is no matching by meaning.
- `app_data` writes never rebuild an embedding. After you change an entry's name, description, content or keys, its stored vector still describes the old text until the user re-vectorizes from the panel: say so when you finish a text edit. `excludeFromVectorization: true` keeps the entry out of vector matching and rebuilds nothing.

## Fields

Book (`lorebook.create`/`update`): `name` required; `description`; `category` `uncategorized`|`world`|`character`|`npc`|`spellbook`; `tags`; `global`/`isGlobal`; `enabled`; `scanDepth` (default 2, inherited by entries with `scanDepth: null`; `0` = whole chat); `tokenBudget` (default 2048); `entryLimit` (default 100); `recursive`/`recursiveScanning` (default off); `maxRecursionDepth` (default 3); `excludeFromVectorization` (book-wide off switch, default false); `vectorQueryDepth` (10), `vectorIncludeAssistant` (false), `vectorScoreThreshold` (0.3), `vectorMaxResults` (10); `scope` (`{"mode":"all"}` everywhere, `{"mode":"disabled"}` nowhere, or `{"mode":"specific","chatIds":[…]}` only in those chats; any other `mode` silently reads as `all`, and there is no per-character scope: link the book to the character instead); `entries` (first save only).

Entry (`addEntry`/`updateEntry`): `name`; `content`; `description`; `tag`; `keys`; `secondaryKeys` (alias `sources`); `enabled`; `constant`; `selective`; `selectiveLogic`; `matchWholeWords`; `caseSensitive`; `useRegex`; `probability` (nullable); `scanDepth` (nullable = book); `sticky`, `cooldown`, `delay`, `ephemeral`; `group`, `groupWeight`; `order`; `position`, `depth`, `role` (`system`|`user`|`assistant`); `outletName`; `preventRecursion`, `excludeRecursion`, `delayUntilRecursion`; `excludeFromVectorization`; `filters` (`exclude`, `and`); `additionalMatchingSources`; `folderId`.

## Linking a character

A link is its own row, never a card field: `character.update` refuses a `lorebooks`, `lorebookIds` or `lorebook` field, nested or not. Both ids are required and both are generated — a book's name is not its id, so resolve it with `lorebook.search` first. Then send `{"action":"lorebook.linkCharacter","lorebookId":"<id from search>","characterId":"<character id>","reason":"…"}`.

`linkCharacter` writes by default; `unlinkCharacter` needs `apply: true`. Linking twice, or unlinking what is not linked, answers `nothing changed`. The proof is `character.get`: the book is listed under `lorebooks` with `attached: "linked"`. Report that, not the write's own result.

When you made a book for a character — its lore is theirs, or the user asked for it for them — offer to link it once the book is verified: ask in your reply, and link only on a yes. Skip the offer when `character.get` already lists the book.

## Errors and fixes

The wording below is exact. An unrecognised sub-action returns `Unknown lorebook action "<name>".` followed by the valid actions; `get`, `addEntry`, `testScan` and the folder actions return `No lorebook has the id "<id>". …` (naming the lookup to use) for a bad book id, while `getEntry` stays silent (`ok: false`, `output: null`).

| Message                                                                                                                                                             | Fix                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lorebook id is required (none was sent): send a non-empty "id" or "lorebookId" top-level. If you do not know it, use the matching list or search action first.`    | `lorebook.get` without an id. Add it, or `lorebook.list` first.                                                                                                                                                          |
| `lorebook entry id is required (none was sent): send a non-empty "entryId" or "id" top-level. If you do not know it, use the matching list or search action first.` | `getEntry`, `updateEntry` or `deleteEntry` without the entry id.                                                                                                                                                         |
| `lorebook.updateEntry needs entryId plus a patch field such as name, content, keys, description, enabled, constant, or order`                                       | The patch held no field `app_data` recognises; a misspelled field counts as empty. `lorebook.update` refuses the same way.                                                                                               |
| `No lorebook has the id "<id>". …`                                                                                                                                  | Wrong `lorebookId`, or the book is gone; confirm with `lorebook.list`.                                                                                                                                                   |
| `No lorebook entry has the id "<id>". …`                                                                                                                            | Wrong `entryId`; list it with `lorebook.entries`.                                                                                                                                                                        |
| `Parent folder <id> not found in lorebook <id>`                                                                                                                     | The parent belongs to another book; use a folder from this one.                                                                                                                                                          |
| `Unknown lorebook action "<name>".` + the valid actions                                                                                                             | An unknown `lorebook.*` sub-action — what `lorebook.delete` returns. Delete a book only from the CLI: `mari lorebooks delete <lorebook-id> --cascade --apply`; without `--cascade` its entries and folders are orphaned. |

Why an entry did not fire:

1. Call `lorebook.testScan` with `lorebookId` and the `chatId` from `activeChat`; it scans that chat's messages and takes no text of its own, so with no `chatId` it scans nothing. Add `entryId` for one entry's `status`: `activated`, `blocked` or `no_match`. It ignores timing, forces chance rolls and has no embedding, so a low-`probability` entry is not evidence either way.
2. Without `entryId` it returns `activated` and `blocked`. Blocked rows carry a `reason` and a `fix` — `secondary_keys`, `filters`, `conditions`, `group`, `probability`, `recursion_only`, `folder_disabled` or `budget` — so relay that `fix`. An entry in neither list is disabled or matched no key in the scanned window: a genuine miss — widen the `keys`, raise the `scanDepth`, or make it `constant`.
3. Change activation fields only when the user asks.

Why an entry fires too often ("she keeps mentioning the tavern"):

1. The same `testScan` call with its `entryId`. `status: "activated"` names the cause in `activationSources` and `matchedKeys`: `constant` (always in), `keyword` with the key that matched (a broad or common key), or `recursive` with `triggeredBy`, the entries whose content holds its key.
2. Not activated there, yet it keeps appearing: `getEntry` and check `sticky`, which keeps it in for that many scans after one match, and whether the book's vectors match it by meaning. `testScan` sees neither.
3. Report the cause and offer the narrowest fix — a tighter key with `matchWholeWords`, `selective` with `secondaryKeys`, `constant: false`, a lower `sticky`, or `preventRecursion: true` on the triggering entry. Change nothing unless the user asks.

## Worked example

One book with three entries, then a group alternate; one `app_data` call per line, ids chosen. Creates write without `apply`.

```
{"action":"lorebook.create","lorebookId":"lantern-coast","data":{"name":"The Lantern Coast","entries":[{"name":"The Lantern Coast - ground rules","content":"Fog rises every dusk. Light is currency.","description":"Setting premise: fog cycle, light as currency, keepers' law.","constant":true,"keys":[]},{"name":"Serah Vell","content":"Keeper of the Light, sharp-tongued, keeps a ledger of every ship she guided in.","description":"The lighthouse keeper and her ledger.","keys":["Serah","the keeper"],"secondaryKeys":["Light","Lantern Rock"],"selective":true,"selectiveLogic":"and"},{"name":"Rumor: the drowned bell","content":"Sailors say a bell tolls under the bay before a wreck.","keys":["drowned bell","the bell"],"group":"coast-rumor","groupWeight":70}]}}
{"action":"lorebook.addEntry","lorebookId":"lantern-coast","entryId":"salt-bride","data":{"name":"Rumor: the salt bride","content":"A bride of salt walks the tideline on the fog's third night.","description":"Alternate rumor competing with the drowned bell.","keys":["salt bride","the bride"],"group":"coast-rumor","groupWeight":30,"order":400}}
{"action":"lorebook.get","lorebookId":"lantern-coast"}
{"action":"lorebook.entries","lorebookId":"lantern-coast","limit":2}
{"action":"lorebook.getEntry","entryId":"salt-bride"}
```

`lorebook.get` shows `entryCount: 4`; `lorebook.entries` shows `total: 4` and `nextOffset: 2`; `lorebook.getEntry` shows `group: "coast-rumor"`, `groupWeight: 30` and `probability: null` (no chance roll: the group already picks one rumor per scan, weighted by `groupWeight`). Say what you verified in one line.

## Where the detail lives

`docs_read docs/lorebooks/entries.md` at `Keyword matching rules`, `Entry types: Normal, Constant, Selective`, `Timing: Sticky, Cooldown, Delay, Ephemeral`, `Position, Depth, and Order`, `Entry folders`. Then `docs_read docs/lorebooks/semantic-search.md` (`Vectorize your entries`, `Re-vectorizing after you change models`, `How it feeds the Knowledge Router agent`), `docs_read docs/lorebooks/overview.md` (`The Lorebooks panel`), and `docs_read docs/lorebooks/linking-to-characters.md` (`Two ways to attach a lorebook`, `Scope: which chats can use the linked lorebook`).
