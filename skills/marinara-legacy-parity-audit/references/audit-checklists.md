# Audit Checklists

Load only the sections that match the parityscan target.

## Comparison Axes

Check each relevant axis, skipping only when it clearly does not apply:

- Contract/schema surface: field presence, defaults, optionality, discriminators, validation, coercion, serialized names, compatibility repair, and versioning.
- Data model relationships and downstream runtime assumptions.
- CRUD behavior: create, edit, duplicate, delete, reset, archive, favorite, enable/disable.
- Editor fields, defaults, validation, dirty-state, cancel/save behavior, and error recovery.
- Library workflows: search, filter, sort, grouping, bulk actions, selection persistence.
- Import/export: accepted formats, compatibility repair, metadata preservation, backups, conflicts, and failure messages.
- Runtime consumption: prompt assembly, mode behavior, generation effects, active selection, continuity/memory, macros, regex, lorebooks, tools, agents, or provider usage.
- Assets/media: sprites, avatars, generated images, file picking, asset copying, missing-file fallback, relative path handling, async URL resolution, visible blanks, cache behavior, and lazy-loading on immediately visible media.
- Storage and migration: old data compatibility, IDs, timestamps, schema versions, path layout, remote/embedded behavior, projected reads, filters, pagination, and large-payload avoidance.
- Performance and payload shape: cold/warm behavior, full vs projected reads, large embedded fields, serialization format, deserialization shape, and high-traffic UI latency.
- Remote/embedded parity: same command behavior and optimization through embedded Tauri, remote `/api/invoke`, shared API wrappers, and duplicated dispatch code.
- UX quality: click count, discoverability, information density, previews, undo/recovery, keyboard support, empty/loading/error states.
- Architecture and ownership: refactor separation, shared API wrapper use, hostable/runtime routing, forbidden imports, feature or contract boundaries.
- Tests/proof surfaces: existing checks, harnesses, app proof, or lack of proof around high-risk behavior.

## Storage And Hot Paths

When the target includes `src-tauri/crates/storage`, storage commands, catalog data, chats/messages, avatars, or cold-load complaints, widen the audit beyond the crate itself.

Check:

- Embedded command path in `src-tauri/src/commands/storage` and remote `/api/invoke` routing in `src-tauri/src/http_dispatch.rs`.
- Frontend wrappers in `src/shared/api` and high-traffic consumers in `src/features`.
- Cold vs warm timings and first-open behavior for selectors, timelines, chat switching, prompt peek, and immediately visible avatars.
- `storage_get` and `storage_list` handling for projections such as `fields`, `fieldSelections`, id-only reads, filters, `before`, and pagination.
- Whether optimized projected readers are bypassed by special collection paths such as messages, characters, or managed assets.
- Large fields that should not be deserialized or returned for list/selector reads: character `data`, avatar/base64 fields, message `swipes`, `extra`, attachments, prompt snapshots, memories, and provider payload snapshots.
- JSON layout and read shape risks: pretty JSON vs compact JSON, large fields appearing before `id`, streaming lookups that deserialize nonmatching rows, and duplicated serializers with different field order.
- Media latency risks: async file URL conversion, managed-avatar resolution, cached vs uncached URL paths, `loading="lazy"` on above-the-fold avatars, and blank intermediate render states.
