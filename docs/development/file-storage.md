# File-Native Storage

This guide describes Guksu Motor's local persistence architecture. For the user-facing folder layout, see [Where Your Data Is Stored](../data/where-data-is-stored.md).

## Source of truth

Guksu stores application rows as JSON snapshots under `DATA_DIR/storage`:

```text
storage/
├── manifest.json
└── tables/
    ├── chats.json
    ├── messages.json
    ├── characters.json
    └── ...
```

`FILE_STORAGE_DIR` can override the `storage` directory. Each table file contains a JSON array. `manifest.json` records the storage format version, save time, backend identifier, and row count for every registered table.

## Runtime model

`packages/server/src/db/file-backed-store.ts` loads table snapshots into memory at startup. The server reads and changes those rows through the file-native operations exposed by `db/file-query.ts`. `db/file-schema.ts` supplies collision-safe table and column metadata for the definitions in `db/schema/`.

The fluent `select`, `insert`, `update`, and `delete` API keeps storage services compact while remaining independent of an external database or ORM. Supported filters and ordering are explicit expression objects, so the store never parses query strings.

Tables declare natural keys with `fileTable(..., { uniqueBy: [...] })`. Inserts and updates validate primary and declared natural keys against the complete candidate change before mutating in-memory rows, so a failed constraint leaves the table untouched. A rule may include a `when` predicate when uniqueness applies only to a subset of rows.

Downloaded capability packages may carry their own file-table instances. The store resolves those instances by registered table name after checking object identity, allowing package-owned storage code to use Engine tables safely.

## Persistence and recovery

Writes mark affected tables dirty. A short debounce coalesces nearby changes, while a safety timer periodically flushes pending work. Graceful shutdown waits for active writes and then persists any rows changed during that write.

Each snapshot is written to a temporary file, flushed, and atomically renamed. Before replacement, the previous healthy snapshot is refreshed as a `.bak` file. On startup, an unreadable primary is recovered from its backup when possible. If neither copy is usable, Guksu quarantines the corrupt files with a timestamped suffix and starts only that table empty so the UI remains reachable for recovery.

## Transactions

Transactions use copy-on-write snapshots scoped with `AsyncLocalStorage`. A table is cloned only when that transaction first mutates it. If the callback throws, only tables changed by that transaction are restored; unrelated concurrent writes survive.

## Adding a table

When adding persistent data:

1. Define the table in `packages/server/src/db/schema/` with `fileTable` and the file-native column builders.
2. Export it from `db/schema/index.ts`.
3. Declare any natural keys with the `uniqueBy` table option.
4. Register its name in `FILE_BACKED_TABLES`.
5. Define cascade or set-null relationships in `file-backed-store.ts` when required.
6. Include JSON-column metadata in `services/mari-db/mari-db.service.ts` when a text field contains structured JSON.
7. Confirm profile backup and restore behavior.
8. Run `pnpm check` and the relevant storage regressions.

Keep table definitions, relation metadata, profile portability, and Mari DB validation aligned in the same change.
