---
name: Characters and personas
description: Read before creating or editing a character or persona card: the fields and aliases, where each value really lives, what a patch replaces, About Me, avatars, folders, and the writes that report success while saving the wrong thing.
---

# Characters and personas

Purpose: create or change a character card or a persona — a field, the About Me, an avatar, a folder — and have it land where the app reads it. Character storage is asymmetric, and neither `app_data` nor a `verified` read-back warns you when a value went somewhere nothing displays.

## Actions

Reads: `character.list|get|search|folder.list|onboarding.get`, `persona.list|get|search`. Writes: `character.create|update|moveToFolder`, `persona.create|update`, values in `data` on a create and `patch` on an update.

- **A new character is one `character.create` with the full card in `data`** — every field the user gave or you wrote, split as below. Only a non-empty `name` is enforced, so a name-only placeholder saves and verifies; never make one to fill with updates, each of which is another change card. If the request is bare — a role or a vibe, no name, situation or voice — ask what the card cannot invent about them (who they are, what the scene is), then build with your best defaults; never interrogate.
- When the output limit is small (your workspace rules say so, or a reply was cut at it), the full card may not fit one reply: create with `name`, `description` and `personality`, then add the other fields with one `character.update` per reply. The extra change cards are the price of a card that saves.
- `character.create` and `persona.create` write by default; `character.update`, `character.moveToFolder` and `persona.update` need `apply:true` (sent without `apply` they are refused; `apply:false` previews). `apply` is read from the top level only — `data.apply` and `patch.apply` are ignored.
- A dry run has no `readBack`; a no-op write returns `No changes: every row already has these values, so nothing was written and no review card was made.` and makes no card.
- `character.get` keeps the card's attached `lorebooks`; `mari characters get` drops them. Read-back is otherwise equivalent on both paths, so use the CLI only when you want it. Attaching or detaching one is `lorebook.linkCharacter` / `lorebook.unlinkCharacter` with `lorebookId` and `characterId`, never a `lorebooks` field on `character.update`; `builtin-lorebook` owns that workflow.
- When you made a character for a lorebook — built from its lore, or the user named the book — offer to link them once the card is verified: ask in your reply, and link only on a yes. Skip the offer when `character.get` already lists the book.
- `character.delete` is not an `app_data` action (it answers `Unknown character action "<name>".` with the valid list): `mari characters delete <id> --apply`. No folder create, rename or delete action exists either.

## What a patch replaces

**Each field you send replaces that whole field; omitted fields stay.** Read, splice, resend the whole value — never append. Arrays replace whole too (`tags`, `alternateGreetings`), and `builtin-onboarding` states the same rule for its card patch.

`"status": "verified"` is row equality, not intent: `summary` is truncated to 500 characters when the row is built, so a 600-character summary verifies at 500, and `app_data` does not zod-parse (`characterDataSchema` is the REST/import contract), so a misplaced key stores as sent and verifies. On `mismatch` or `unavailable`, read again and compare the stored value.

## The fields

A character card is JSON in `characters.data`, snake_case. Keep the meanings apart: `description` identity and role, `personality` traits, temperament, voice and mannerisms, `backstory` history, `appearance` physical features and clothing. Nothing validates the split, so history in `description` saves and never reaches the Backstory box.

- `data.extensions.backstory`, `data.extensions.appearance`, `data.extensions.aboutMe` (aliases `about_me`, `about-me`): every create and update moves those three there.
- `data.first_mes` from `firstMes`, `firstMessage`, `first_mes` or `greeting` — input aliases, deleted after mapping; the response shows `first_mes`.
- Every other card scalar (`description`, `personality`, `scenario`, `creator`, `tags`, `summary`, …) at `data.<snake_case>`; clears `""` and `[]`; `tags` must be an array.
- `comment` is the row column `characters.comment`, accepted at top level and stripped from `data`. It cannot be cleared through `app_data` (`""` is dropped); `mari characters update <id> --comment "" --apply` clears it.
- `avatarPath`, `spriteFolderPath`, `folderId`, ids, timestamps are row columns — a patch value sits in `data` unread.
- Extensions such as `nameColor` and `convoBehavior` are reachable only as `patch.extensions.<key>`. A `nameColor` inside `patch` lands at `data.nameColor`, which the client never reads; at the envelope's top level it is ignored outright. `onboarding` is the exception: write it with `character.onboarding.update`, because a raw `patch.extensions.onboarding` bypasses `buildOnboardingUpdate` and its validation.

**Personas are columns, not extensions:** `description`, `personality`, `scenario`, `backstory`, `appearance`, `aboutMe`, `creator`, `creatorNotes`, `convoBehavior`, `tags`, `comment` (aliases like `creator_notes`). A plain-string `convoBehavior` becomes `{instruction, insertionStrategy: "constant_after"}`; `avatarPath` is not settable here.

## About Me

`aboutMe` is the self-written Conversation profile, never read in Roleplay or Game: rendered into the prompt as a participant profile (an empty or whitespace one is skipped; macros `{{char_about}}`/`{{persona_about}}`). No length limit in code.

Read the entity first, then write it in its own first-person voice into `aboutMe` — a line or two is the usual shape, but the documented range includes a single emoji, a joke, or nothing at all, and empty is valid. Match what the card already does; do not overwrite an intentional bio with a generic one. `aboutMe` is its only home — no separate bio field or About Me connection exists.

- Character: `character.update`, `apply:true`, `patch.aboutMe` → `data.extensions.aboutMe`; read it with `character.get`.
- Persona: `persona.update` → the `aboutMe` column; read with `persona.get`.
- **Clearing differs.** A character clears with `{"aboutMe": ""}`; `{"aboutMe": null}` is dropped before the patch. A persona's `""` through `app_data` is silently ignored — and that is true of **every persona string field except `summary` and `mes_example`** (those two clear with `""`): alone it throws `persona.update needs a patch field…`, beside another field it no-ops while reporting `verified`. Clear any persona string with the CLI, e.g. `mari personas update <id> --about-me "" --apply`.

`builtin-onboarding` fills the five template fields and sets no About Me — write it on the finished persona.

## Avatars and folders

**An avatar is not a card field**: creates and updates ignore it, and a patch `avatarPath` sits in the card JSON unread. `mari images generate --prompt <text>` makes an unassigned preview asset; `mari images assign --asset <id> --target character-avatar --character <id> --apply` copies it into `DATA_DIR/avatars/` and writes `/api/avatars/file/<file>` onto the row (`--target persona-avatar --persona <id>` for a persona). Without `--apply` nothing is saved. Clear with `mari images delete --target character-avatar --character <id> [--delete-file] --apply`; without `--delete-file` the file stays.

**Folders have no create action.** `character.folder.list` returns `{id, name, description, characterIds}`; creation is UI-only, and an unknown name is an error. `character.moveToFolder` takes `characterId` plus `folderId` or `folderName`, removes the character from every other folder and adds it once.

## Errors and silent failures

| Message                                                                                                                                                                    | Cause                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `character.update needs a patch field such as name, summary, description, personality, scenario, firstMes, creatorNotes, backstory, appearance, aboutMe, tags, or comment` | the patch came out empty: no fields, only dropped ones (`aboutMe: null` on a character; `aboutMe: ""` on a persona), or `comment: ""`. |
| `No character has the id "<id>". …`                                                                                                                                        | a name or slug sent as the id, or the card is gone; take the `id` from `character.search` (or `character.list`).                       |
| `Unknown character action "<name>".`                                                                                                                                       | no such sub-action; `character.delete` is CLI-only.                                                                                    |

These save or skip with no error:

1. A `null` on a text field other than `aboutMe` is stored as JSON `null` and verifies — never rendered, never clear. `""` is the clear.
2. A persona string field sent as `""` beside another field — dropped, `verified`, old value stays.
3. `summary` over 500 characters — stored at 500, `verified`.
4. A misspelled or misplaced key (`backstoy`, `nameColor` inside the patch) — stored as sent and never read, `verified`.

## Worked example

Three calls against a temp DATA_DIR: the whole card in one create, a requested About Me rewrite, a read-back. Creates write by default; updates need `apply:true`.

```
{"action":"character.create","characterId":"note-luna","data":{"name":"Luna Vale","description":"Keeper of the Lantern Coast light; wary of strangers.","personality":"Dry, watchful, kinder than she sounds; answers questions with questions.","firstMes":"*She lifts the lamp without turning around.* You picked a poor night for a walk.","backstory":"Took the light at nineteen after her father's boat never came back.","appearance":"Salt-stiff dark coat, copper hair pinned up.","aboutMe":"Fog chaser. Keeper of the light.","comment":"demo card"},"reason":"Creates the lighthouse keeper the user described"}
{"action":"character.update","characterId":"note-luna","patch":{"aboutMe":"Keeper of the light. Fog chaser. If the lamp is lit, I am awake — knock anyway."},"reason":"Rewrite the bio in her voice","apply":true}
{"action":"character.get","characterId":"note-luna"}
```

The create returns `ok:true` with `"readBack": {"status": "verified"}`: `firstMes` becomes `data.first_mes`, `backstory`, `appearance` and `aboutMe` sit under `data.extensions`, `comment` on the row. The patch replaces the whole field and verifies, and the get shows the new bio. To clear it, send `{"aboutMe": ""}`: a `{"aboutMe": null}` patch fails with `character.update needs a patch field such as …`, because `null` is dropped before the patch is built.

## Where the detail lives

`docs_read docs/characters/creating-and-editing-characters.md` at `Card tab`, `Adding an avatar`; `docs_read docs/conversation/profiles.md` at `About Me`, `Writing an About Me with Professor Mari`.
