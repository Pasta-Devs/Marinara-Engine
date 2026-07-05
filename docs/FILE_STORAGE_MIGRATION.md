# File Storage Migration

Marinara Engine v1.5.7 moves user data away from a persistent SQLite database file.

The durable source of truth is now `DATA_DIR/storage`. The live runtime uses a
file-native table store backed by JSON snapshots; SQLite is not opened after the
one-time legacy import completes.

## Runtime Behavior

1. On startup, Marinara checks `DATA_DIR/storage/manifest.json`.
2. If a completed file-storage manifest exists, those JSON files are loaded into
   the file-native runtime store.
3. If file storage does not exist and the legacy `marinara-engine.db` exists, the
   old DB is opened read-only, imported once, and immediately written to
   `DATA_DIR/storage`. The import reads every persisted domain table, including
   Conversation, Roleplay, Game, agents, lorebooks, prompts, connections,
   galleries, memories, and settings.
4. New writes are autosaved back to JSON files. Backups include the `storage`
   directory.
5. The old `.db` file is left in place as a recovery artifact. It is no longer the
   default live store.

If `storage/tables/` exists without a completed manifest and a legacy DB is
available, Marinara treats the file store as incomplete and re-imports from the
legacy DB. This avoids partial first-run migrations blocking the automatic
upgrade.

Users should not need to run `pnpm db:push`, `pnpm db:migrate`, or any other
database command when updating to v1.5.7. Fresh installs do not install the old
native or WASM SQLite fallback packages.

The one-time legacy import uses the bundled libSQL file reader so existing users
can be moved into file storage automatically without shipping `better-sqlite3` or
`sql.js` in new installs.

Advanced installs may opt back into the legacy DB backend with:

```sh
STORAGE_BACKEND=sqlite
DATABASE_DRIVER=libsql
```

## File Layout

Current v1.5.7+ layout:

```text
DATA_DIR/
  storage/
    manifest.json
    tables/
      chats.json
      messages.json
      ...
```

This table-snapshot layout is intentionally conservative. It removes live SQLite and
database migrations from the user-facing data path while preserving the current APIs. A later
cleanup can split large tables into domain-native files such as
`chats/{chatId}/messages.ndjson` and `characters/{characterId}/card.json`.

## SQLite Surface Map

v1.5.7 introduced the table-snapshot layout. Later releases add new files under `storage/tables/` without changing the shape. The authoritative list is `FILE_BACKED_TABLES` in `packages/server/src/db/file-backed-store.ts`.

| Old table | Durable file | Domain |
| --- | --- | --- |
| `chats` | `storage/tables/chats.json` | Chat metadata for Conversation, Roleplay, and Game |
| `messages` | `storage/tables/messages.json` | Chat transcripts |
| `message_swipes` | `storage/tables/message_swipes.json` | Regenerated/alternate message swipes |
| `conversation_call_sessions` | `storage/tables/conversation_call_sessions.json` | Conversation call sessions |
| `conversation_call_messages` | `storage/tables/conversation_call_messages.json` | Conversation call transcripts |
| `conversation_call_sounds` | `storage/tables/conversation_call_sounds.json` | Uploaded call soundboard assets |
| `characters` | `storage/tables/characters.json` | Character cards |
| `character_card_versions` | `storage/tables/character_card_versions.json` | Character card version history |
| `personas` | `storage/tables/personas.json` | User personas |
| `persona_card_versions` | `storage/tables/persona_card_versions.json` | Persona version history |
| `character_groups` | `storage/tables/character_groups.json` | Character folders |
| `persona_groups` | `storage/tables/persona_groups.json` | Persona folders |
| `lorebooks` | `storage/tables/lorebooks.json` | Lorebook metadata |
| `lorebook_character_links` | `storage/tables/lorebook_character_links.json` | Lorebook to character links |
| `lorebook_persona_links` | `storage/tables/lorebook_persona_links.json` | Lorebook to persona links |
| `lorebook_folders` | `storage/tables/lorebook_folders.json` | Lorebook folders |
| `lorebook_entries` | `storage/tables/lorebook_entries.json` | Lorebook entries and vector metadata |
| `prompt_presets` | `storage/tables/prompt_presets.json` | Prompt preset metadata |
| `prompt_groups` | `storage/tables/prompt_groups.json` | Prompt section groups |
| `prompt_sections` | `storage/tables/prompt_sections.json` | Prompt sections |
| `choice_blocks` | `storage/tables/choice_blocks.json` | Preset variables / choice blocks |
| `api_connections` | `storage/tables/api_connections.json` | LLM, image, video, embedding, and TTS connections |
| `api_connection_folders` | `storage/tables/api_connection_folders.json` | Connection folders |
| `assets` | `storage/tables/assets.json` | Generated/default asset metadata |
| `agent_configs` | `storage/tables/agent_configs.json` | Built-in and custom agents |
| `agent_runs` | `storage/tables/agent_runs.json` | Agent output history |
| `agent_memory` | `storage/tables/agent_memory.json` | Per-agent chat memory |
| `custom_tools` | `storage/tables/custom_tools.json` | User-defined tools |
| `regex_scripts` | `storage/tables/regex_scripts.json` | Regex scripts |
| `game_state_snapshots` | `storage/tables/game_state_snapshots.json` | Game turn state snapshots |
| `game_engine_state` | `storage/tables/game_engine_state.json` | Game engine runtime state |
| `game_checkpoints` | `storage/tables/game_checkpoints.json` | Game checkpoints |
| `game_scene_videos` | `storage/tables/game_scene_videos.json` | Game and scene video metadata |
| `game_turn_storyboards` | `storage/tables/game_turn_storyboards.json` | Game storyboard metadata |
| `game_turn_storyboard_keyframes` | `storage/tables/game_turn_storyboard_keyframes.json` | Storyboard keyframes |
| `chat_images` | `storage/tables/chat_images.json` | Chat gallery image metadata |
| `character_images` | `storage/tables/character_images.json` | Character gallery image metadata |
| `persona_images` | `storage/tables/persona_images.json` | Persona gallery image metadata |
| `gallery_folders` | `storage/tables/gallery_folders.json` | Gallery folders |
| `global_images` | `storage/tables/global_images.json` | Global gallery images |
| `custom_emojis` | `storage/tables/custom_emojis.json` | Custom emoji assets |
| `custom_stickers` | `storage/tables/custom_stickers.json` | Custom sticker assets |
| `ooc_influences` | `storage/tables/ooc_influences.json` | Cross-chat influence notes |
| `conversation_notes` | `storage/tables/conversation_notes.json` | Conversation carryover notes |
| `memory_chunks` | `storage/tables/memory_chunks.json` | Vector memory chunks |
| `chat_folders` | `storage/tables/chat_folders.json` | Chat sidebar folders |
| `custom_themes` | `storage/tables/custom_themes.json` | Custom theme CSS |
| `app_settings` | `storage/tables/app_settings.json` | Global app and feature settings |
| `achievement_unlocks` | `storage/tables/achievement_unlocks.json` | Achievement unlock state |
| `chat_presets` | `storage/tables/chat_presets.json` | Per-mode chat settings presets |
| `prompt_overrides` | `storage/tables/prompt_overrides.json` | Built-in prompt override templates |
| `installed_extensions` | `storage/tables/installed_extensions.json` | Cross-device installed extension storage |

## Follow-Up Cleanup

The DB-shaped internal surface should shrink over time:

1. Replace direct `app.db` queries with storage facade calls.
2. Split high-volume domains into append-friendly files:
   `messages.ndjson`, `game-state/*.json`, and `agent-runs.ndjson`.
3. Move object domains to readable directories:
   `characters/{id}/card.json`, `lorebooks/{id}/entries/{entryId}.json`,
   `connections/{id}.json`.
4. Remove the remaining Drizzle-shaped query facade once no route or service
   expects that API.
