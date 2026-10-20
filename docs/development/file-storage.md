# File-Native Storage

This guide describes Marinara Engine's local persistence architecture. For the user-facing folder layout, see [Where Your Data Is Stored](../data/where-data-is-stored.md).

## Source of truth

Marinara stores application rows as JSON snapshots under `DATA_DIR/storage`:

```text
storage/
├── manifest.json
└── tables/
    ├── chats/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── characters/
    │   ├── <encoded-character-id>.json
    │   └── ...
    ├── messages/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── message_swipes/
    │   └── <encoded-chat-id>.json
    └── ...
```

`FILE_STORAGE_DIR` can override the `storage` directory. Each table file contains a JSON array. `manifest.json` records the storage format version, save time, backend identifier, and row count for every registered table.

### Sharded tables

Storage format 5 persists **every file-backed table as ownership-keyed shard files** instead of rewriting a table-wide JSON monolith. Child rows group under the entity that owns their lifecycle and access pattern: messages, memory, Agent runs, and game state by chat; card history and galleries by character or persona; lorebook entries, folders, and links by lorebook; prompt children by preset; and social rows by their account or post. Standalone records use one file per primary key. `message_swipes` is the sole indirect case and resolves ownership through its parent message. `FILE_BACKED_TABLES` and `getFileTableShardStrategy()` in `file-backed-store.ts` are authoritative; the offline `unshard` command in `scripts/protect-launcher-data.mjs` mirrors the complete table list for safe downgrades, with a regression pinning the pair.

Dirty tracking runs at shard granularity, so a flush touches only the owners that changed; a shard whose row count reaches zero is deleted rather than written as an empty array. Shard filenames are percent-encoded from the ownership key (with hash fallbacks for overlong or reserved names) — the encoding is a security boundary, since imported profiles can carry arbitrary ids. Filenames are containers only; rows carry their own keys.

On first boot of a build with newly sharded tables, existing monoliths migrate automatically: rows are grouped by owner and written as shards, then the monolith **and its `.bak`** are renamed to `.pre-shard` — those renamed files are the automatic pre-migration backup and are never deleted by the Engine. A `.migrating` sentinel makes crash recovery decidable (monolith authoritative until the sentinel clears). If an older build later recreates a monolith beside the shards (a downgrade session), the shards win and the conflicting monolith is quarantined with a timestamped `.post-downgrade-` suffix — never merged. Orphaned child rows land in the `orphaned-rows` shard instead of being dropped. A manifest written by a newer storage format refuses to load.

## Runtime model

`packages/server/src/db/file-backed-store.ts` loads table snapshots into memory at startup. The server reads and changes those rows through the file-native operations exposed by `db/file-query.ts`. `db/file-schema.ts` supplies collision-safe table and column metadata for the definitions in `db/schema/`.

The fluent `select`, `insert`, `update`, and `delete` API keeps storage services compact while remaining independent of an external database or ORM. Supported filters and ordering are explicit expression objects, so the store never parses query strings.

Tables declare natural keys with `fileTable(..., { uniqueBy: [...] })`. Inserts and updates validate primary and declared natural keys against the complete candidate change before mutating in-memory rows, so a failed constraint leaves the table untouched. A rule may include a `when` predicate when uniqueness applies only to a subset of rows.

Downloaded capability packages may carry their own file-table instances. The store resolves those instances by registered table name after checking object identity, allowing package-owned storage code to use Engine tables safely.

## Persistence and recovery

Writes mark affected tables dirty. A short debounce coalesces nearby changes, while a safety timer periodically flushes pending work. Graceful shutdown waits for active writes and then persists any rows changed during that write.

Each snapshot is written to a temporary file, flushed, and atomically renamed. Before replacement, the previous healthy snapshot is refreshed as a `.bak` file. On startup, an unreadable primary is recovered from its backup when possible. If neither copy is usable, Marinara quarantines the corrupt files with a timestamped suffix and starts only that table empty so the UI remains reachable for recovery.

## Writer lease

Only one server process writes a storage directory at a time. At startup the store creates the `.writer-lease` directory in it, with an `owner.json` that records the writer's PID, machine id, boot id, PID namespace, hostname and a random token, and removes it on shutdown. A second process that finds a lease refuses to start with a `StorageWriterLeaseError` unless it can prove the previous writer is gone.

The proof first needs the same machine: a matching machine id, Termux's app-private home, or, when one side has no machine id, storage only this machine can reach. On Linux and Android that is a local filesystem. On Windows it is a `Fixed` drive (not a network, removable or UNC path), and the lease must come from a native Windows writer with this computer's name. A lease on the same machine is reclaimed when it belongs to an earlier boot (on Windows, boot times up to 5 minutes apart count as the same boot), when its liveness socket no longer answers (Docker and Termux), or when its PID has exited or (except on the Windows drive proof) now belongs to a newer process. Shared or network storage stays locked, and the error names the lease to remove by hand once every process is stopped.

`scripts/regressions/storage-writer-lock.regression.ts` covers the proofs.

## Transactions

Transactions use copy-on-write snapshots scoped with `AsyncLocalStorage`. A table is cloned only when that transaction first mutates it. If the callback throws, only tables changed by that transaction are restored; unrelated concurrent writes survive.

## Adding a table

When adding persistent data:

1. Define the table in `packages/server/src/db/schema/` with `fileTable` and the file-native column builders.
2. Export it from `db/schema/index.ts`.
3. Declare any natural keys with the `uniqueBy` table option.
4. Register its name in `FILE_BACKED_TABLES`; add its stable parent column to `SHARD_KEY_COLUMNS` when it should group with an owner instead of using its primary key.
5. Define cascade or set-null relationships in `file-backed-store.ts` when required.
6. Include JSON-column metadata in `services/mari-db/mari-db.service.ts` when a text field contains structured JSON.
7. Confirm profile backup and restore behavior.
8. Run `pnpm check` and the relevant storage regressions.

Keep table definitions, relation metadata, profile portability, and Mari DB validation aligned in the same change.
