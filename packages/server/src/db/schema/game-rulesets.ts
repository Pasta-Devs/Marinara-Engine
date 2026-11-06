// ──────────────────────────────────────────────
// Game: community rulesets
//
// A ruleset the user imported, from a file or from a GitHub repository, rather than one an
// installed capability package supplied. One row per (namespaced ruleset id, VERSION): a game pins
// an exact version, and a sheet built on version 1 must keep resolving after the author publishes
// version 2, so versions are kept side by side instead of being replaced.
//
// The row is not owned by anything. It survives the repository it came from being removed
// (`repositoryId` goes null and the rows stay), because a game pinned to one of these versions has
// to keep working; deleting it is a deliberate act, never a cascade. That is why this table
// declares no foreign key and appears in no CASCADES entry.
//
// `definition` holds the EXACT bytes that were imported, never a re-serialization, so `sha256`
// stays a statement about the file the user actually chose and a re-import of the same file is
// recognisable as the same bytes.
// ──────────────────────────────────────────────

import { fileTable, text, integer } from "../file-schema.js";

export const gameRulesets = fileTable("game_rulesets", {
  /** `<namespaced ruleset id>@<version>`: the identity itself, so the key cannot drift from it. */
  id: text("id").primaryKey(),
  /** Namespaced (`local/my-5e`, `alice/v20`) — never a bare id, which is an official ruleset's. */
  rulesetId: text("ruleset_id").notNull(),
  version: integer("version").notNull(),
  sourceKind: text("source_kind", { enum: ["repository", "local"] }).notNull(),
  /** The repository the file came from; null for a file the user picked. */
  sourceUrl: text("source_url"),
  /** The managing custom-agent repository, or null once that repository is gone. */
  repositoryId: text("repository_id"),
  /** Hex sha256 of the stored bytes: a re-import of the same file is a no-op, a changed one is a
   *  conflict the author has to resolve by raising the version number. */
  sha256: text("sha256").notNull(),
  /** The imported `ruleset.json` text, verbatim. */
  definition: text("definition").notNull(),
  /** A package file's catalog files (RM), as the JSON of `{ <catalog id>: <sha256> }`, each kept once in
   *  `game_ruleset_catalogs`; null for a ruleset whose catalogs are inline (every JSON or repository
   *  import). Part of the version's identity: a changed catalog is a changed version. */
  catalogs: text("catalogs"),
  /** The translation kept of a package file's (1.811), in the Engine's language, as the JSON of
   *  `{ <language>: <sha256> }`, its text kept once in `game_ruleset_catalogs` beside the catalog files;
   *  null for none. Display only, so NOT part of the version's identity: importing the version again in
   *  another language replaces it. */
  locales: text("locales"),
  createdAt: text("created_at").notNull(),
});

/** The catalog files of rulesets imported from a package file (RM), and their translations (1.811), kept
 *  once by their content, however many versions name them. Read only through a ruleset row's `catalogs`, and checked against it; a file
 *  no version names any more is removed with the last one that did. */
export const gameRulesetCatalogs = fileTable("game_ruleset_catalogs", {
  /** The file's hex sha256. */
  id: text("id").primaryKey(),
  /** The catalog file's text, verbatim. */
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});
