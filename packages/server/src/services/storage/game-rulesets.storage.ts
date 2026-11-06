// ──────────────────────────────────────────────
// Storage: community rulesets
//
// The write side of `game_rulesets`. Everything a stored version has to satisfy is checked HERE,
// before the bytes land, because the registry reads this table on every turn and a row it cannot
// parse is a ruleset that silently disappears from a game that pinned it.
//
// A version is never rewritten. Re-importing the SAME bytes is a no-op, and importing DIFFERENT
// bytes under a version that already exists is refused: a game pinned to `v1` would otherwise wake
// up on other arithmetic, which is the one outcome the pin exists to prevent. The author raises the
// version number instead.
//
// A ruleset imported from a package file (RM) may keep its catalogs as files: their texts are stored
// once each in `game_ruleset_catalogs`, by content, and the row names them `{ <id>: <sha256> }`. The
// map is part of the version: the same ruleset text with other catalogs is another version.
//
// Its translation is kept the same way, `{ <language>: <sha256> }`, but is display only and so no part of
// the version: the import keeps the one in the Engine's language (1.811), and importing the same version
// again in another language replaces it.
// ──────────────────────────────────────────────

import { createHash } from "node:crypto";
import {
  communityRulesetId,
  isCommunityRulesetId,
  parseRulesetCatalogFile,
  rulesetHangsOnRowIssues,
  rulesetCatalogEntryIssues,
  type RulesetCatalogEntriesById,
  parseRulesetDefinition,
  RULESET_CATALOG_MAX_BYTES,
  RULESET_LOCALE_MAX_BYTES,
  RULESET_LOCALE_MAX_FILES,
  RULESET_MAX_BYTES,
  rulesetLocaleOfAssetPath,
  rulesetLocaleAssetPath,
  rulesetSourceUrlSchema,
} from "@marinara-engine/shared";
import { and, eq, inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameRulesetCatalogs, gameRulesets } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";

export type GameRulesetSourceKind = "repository" | "local";

export interface GameRulesetRow {
  id: string;
  rulesetId: string;
  version: number;
  sourceKind: GameRulesetSourceKind;
  sourceUrl: string | null;
  repositoryId: string | null;
  sha256: string;
  definition: string;
  /** `{ <catalog id>: <sha256> }` as JSON, for a package file's catalog files; null otherwise. */
  catalogs: string | null;
  /** `{ <language>: <sha256> }` as JSON, for the translation kept of a package file's (1.811); null (or
   *  absent, on a row stored before them) otherwise. */
  locales?: string | null;
  createdAt: string;
}

export interface PutGameRulesetInput {
  /** Namespaced: `local/<bare id>` for a file, `<owner>/<bare id>` for a repository. */
  rulesetId: string;
  version: number;
  sourceKind: GameRulesetSourceKind;
  sourceUrl?: string | null;
  repositoryId?: string | null;
  /** The imported `ruleset.json` text, exactly as it arrived. */
  definition: string;
  /** A package file's catalog files, by catalog id, exactly as they arrived (RM). Only the package import
   *  sends them; every other import keeps its catalogs inline. */
  catalogs?: Record<string, string>;
  /** The translation kept of a package file's (1.811), by language: the JSON of the strings it translates.
   *  Given, it replaces what the version kept (`{}` keeps none); absent, that stays. */
  locales?: Record<string, string>;
}

export type PutGameRulesetResult = { status: "added" | "unchanged"; row: GameRulesetRow };

/** A stored version cannot be replaced with different bytes. Its own class so a route can turn it
 *  into an actionable message instead of a 500. */
export class RulesetVersionConflictError extends Error {
  constructor(
    readonly rulesetId: string,
    readonly version: number,
  ) {
    super(
      `Version ${version} of "${rulesetId}" is already installed with different contents. ` +
        `Raise the ruleset's version number and import it again. A version games may already be ` +
        `pinned to is never rewritten.`,
    );
    this.name = "RulesetVersionConflictError";
  }
}

/** The file itself cannot be stored, and the message says why in words an author can act on. Its
 *  own class so a route answers 400 for these and lets a real storage failure stay a 500. */
export class RulesetRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RulesetRefusedError";
  }
}

/** The row id for one stored version: the pair itself, so the key and the identity cannot drift. */
export function gameRulesetRowId(rulesetId: string, version: number): string {
  return `${rulesetId}@${version}`;
}

/** The size sentence, or null when the file fits. Exported so the import route can refuse an
 *  oversized file before it parses it, and still say exactly what this write path would say. */
export function rulesetSizeIssue(definition: string): string | null {
  const bytes = Buffer.byteLength(definition, "utf8");
  return bytes > RULESET_MAX_BYTES
    ? `The ruleset file is ${bytes} bytes, over the ${RULESET_MAX_BYTES}-byte limit`
    : null;
}

/** Validate the bytes against everything the registry will later assume. Returns nothing: it either
 *  passes or throws a sentence the importer can show the user. */
function assertStorableRuleset(input: PutGameRulesetInput): void {
  if (!isCommunityRulesetId(input.rulesetId)) {
    throw new RulesetRefusedError(
      `"${input.rulesetId}" is not a community ruleset id; this table never holds official rulesets`,
    );
  }
  // A game's pin records this url, and the pin is re-read through `rulesetRefSchema` on every turn.
  // A url that schema would refuse must never be stored: it would make the whole pin unreadable and
  // take the game's rules with it. This single write path is where that stays true.
  if (input.sourceUrl != null && !rulesetSourceUrlSchema.safeParse(input.sourceUrl).success) {
    throw new RulesetRefusedError(`"${input.sourceUrl}" is not a usable ruleset source address`);
  }
  const sizeIssue = rulesetSizeIssue(input.definition);
  if (sizeIssue) throw new RulesetRefusedError(sizeIssue);
  let json: unknown;
  try {
    json = JSON.parse(input.definition);
  } catch {
    throw new RulesetRefusedError("The ruleset file is not valid JSON");
  }
  const parsed = parseRulesetDefinition(json);
  if (!parsed.ok) {
    throw new RulesetRefusedError(`The ruleset file is not usable: ${parsed.issues.slice(0, 5).join("; ")}`);
  }
  // The document carries the BARE id; the namespace says where the file came from. Combining them
  // has to reproduce the id the caller is filing it under, or the registry would key it elsewhere.
  const namespace = input.rulesetId.slice(0, input.rulesetId.indexOf("/"));
  let declaredId: string;
  try {
    declaredId = communityRulesetId(namespace, parsed.definition.id);
  } catch (error) {
    throw new RulesetRefusedError(error instanceof Error ? error.message : "The ruleset id cannot be used");
  }
  if (declaredId !== input.rulesetId) {
    throw new RulesetRefusedError(
      `The ruleset file declares the id "${parsed.definition.id}", not "${input.rulesetId}"`,
    );
  }
  if (parsed.definition.version !== input.version) {
    throw new RulesetRefusedError(
      `The ruleset file declares version ${parsed.definition.version}, not ${input.version}`,
    );
  }
  // A catalog file beside `ruleset.json` comes only with a package file (RM), which sends the files. Any
  // other import is this one file, so its catalogs have to be inline or the picker would have nothing
  // to read.
  const files = input.catalogs ?? {};
  const entriesById: RulesetCatalogEntriesById = {};
  for (const catalog of parsed.definition.catalogs ?? []) {
    if (!catalog.asset) continue;
    if (files[catalog.id] === undefined) {
      throw new RulesetRefusedError(
        input.catalogs
          ? `The catalog "${catalog.id}" names its file (${catalog.asset}), and the package does not have it`
          : `The catalog "${catalog.id}" names a separate file (${catalog.asset}). An imported ruleset carries its catalogs inline, as "entries", or comes as a package file (.ruleset.json) with its catalog files`,
      );
    }
  }
  for (const [id, text] of Object.entries(files)) {
    if (!parsed.definition.catalogs?.some((catalog) => catalog.id === id && catalog.asset)) {
      throw new RulesetRefusedError(`The package has a file for "${id}", which is not a catalog file of this ruleset`);
    }
    const bytes = Buffer.byteLength(text, "utf8");
    if (bytes > RULESET_CATALOG_MAX_BYTES) {
      throw new RulesetRefusedError(
        `The catalog "${id}" is ${bytes} bytes, over the ${RULESET_CATALOG_MAX_BYTES}-byte limit`,
      );
    }
    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch {
      throw new RulesetRefusedError(`The catalog "${id}" is not valid JSON`);
    }
    const catalog = parseRulesetCatalogFile(parsed.definition, id, document);
    if (!catalog.ok) {
      throw new RulesetRefusedError(`The catalog "${id}" is not usable: ${catalog.issues.slice(0, 5).join("; ")}`);
    }
    entriesById[id] = catalog.entries;
  }
  const languages = Object.keys(input.locales ?? {});
  if (languages.length > RULESET_LOCALE_MAX_FILES)
    throw new RulesetRefusedError(
      `The package has ${languages.length} translations; a ruleset has at most ${RULESET_LOCALE_MAX_FILES}`,
    );
  for (const language of languages) {
    if (rulesetLocaleOfAssetPath(rulesetLocaleAssetPath(language)) !== language)
      throw new RulesetRefusedError(`"${language}" is not a language a translation is named by`);
    const text = input.locales![language]!;
    if (Buffer.byteLength(text, "utf8") > RULESET_LOCALE_MAX_BYTES)
      throw new RulesetRefusedError(
        `The translation into "${language}" is over the ${RULESET_LOCALE_MAX_BYTES}-byte limit`,
      );
    let strings: unknown;
    try {
      strings = JSON.parse(text);
    } catch {
      throw new RulesetRefusedError(`The translation into "${language}" is not valid JSON`);
    }
    if (
      !strings ||
      typeof strings !== "object" ||
      Array.isArray(strings) ||
      Object.values(strings).some((value) => typeof value !== "string")
    )
      throw new RulesetRefusedError(`The translation into "${language}" is not a set of strings`);
  }
  const complete = {
    ...parsed.definition,
    catalogs: parsed.definition.catalogs?.map((catalog) => ({
      ...catalog,
      entries: [...(entriesById[catalog.id] ?? catalog.entries ?? [])],
    })),
  };
  // The pools hang-ons name off list rows, now every catalog's rows are here (1.405).
  const rowIssues = rulesetHangsOnRowIssues(complete);
  if (rowIssues.length) throw new RulesetRefusedError(`The ruleset is not usable: ${rowIssues.slice(0, 5).join("; ")}`);
  for (const catalog of complete.catalogs ?? []) {
    // What names entries of other catalogs: a creature's spells, an entry's amends (1.302), the
    // weapons it conjures (1.306).
    if (
      !catalog.entries?.some(
        (entry) => entry.creature?.spellcasting || entry.mechanics?.amends || entry.mechanics?.conjures,
      )
    )
      continue;
    const issues = rulesetCatalogEntryIssues(complete, catalog, catalog.entries ?? []);
    if (issues.length)
      throw new RulesetRefusedError(
        `The catalog "${catalog.id}" is not usable: ${issues
          .slice(0, 5)
          .map((issue) => issue.message)
          .join("; ")}`,
      );
  }
}

const sha256Of = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** A version's catalog files as its row names them: `{ <id>: <sha256> }` in id order, as JSON, or null. */
function catalogMap(catalogs: Record<string, string> | undefined): string | null {
  const ids = Object.keys(catalogs ?? {}).sort();
  return ids.length ? JSON.stringify(Object.fromEntries(ids.map((id) => [id, sha256Of(catalogs![id]!)]))) : null;
}

/** The sha256 values a row's catalogs and translations name. */
function namedCatalogs(row: Pick<GameRulesetRow, "catalogs" | "locales">): string[] {
  return [row.catalogs, row.locales].flatMap((json) => {
    if (!json) return [];
    try {
      const map = JSON.parse(json) as unknown;
      return map && typeof map === "object"
        ? Object.values(map).filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      return [];
    }
  });
}

/** Remove the catalog files no stored version names any more. Inside the removal's own transaction. */
async function pruneCatalogs(tx: Pick<DB, "select" | "delete">): Promise<void> {
  const named = new Set(((await tx.select().from(gameRulesets)) as GameRulesetRow[]).flatMap(namedCatalogs));
  const kept = (await tx.select().from(gameRulesetCatalogs)) as Array<{ id: string }>;
  const unnamed = kept.map((file) => file.id).filter((id) => !named.has(id));
  if (unnamed.length) await tx.delete(gameRulesetCatalogs).where(inArray(gameRulesetCatalogs.id, unnamed));
}

export function createGameRulesetsStorage(db: DB) {
  return {
    async list(): Promise<GameRulesetRow[]> {
      return (await db.select().from(gameRulesets)) as GameRulesetRow[];
    },

    async listByRepository(repositoryId: string): Promise<GameRulesetRow[]> {
      return (await db
        .select()
        .from(gameRulesets)
        .where(eq(gameRulesets.repositoryId, repositoryId))) as GameRulesetRow[];
    },

    async get(rulesetId: string, version: number): Promise<GameRulesetRow | null> {
      const rows = (await db
        .select()
        .from(gameRulesets)
        .where(and(eq(gameRulesets.rulesetId, rulesetId), eq(gameRulesets.version, version)))) as GameRulesetRow[];
      return rows[0] ?? null;
    },

    /** Store one version. Validates first, then either adds it, recognises it as already stored, or
     *  refuses it because that version already means something else. */
    async put(input: PutGameRulesetInput): Promise<PutGameRulesetResult> {
      assertStorableRuleset(input);
      const sha256 = sha256Of(input.definition);
      const catalogs = catalogMap(input.catalogs);
      const locales = catalogMap(input.locales);
      // Each text once, by its content: a new version that keeps a catalog or translation adds nothing.
      const keep = async (tx: Pick<DB, "select" | "insert">, texts: Record<string, string> | undefined) => {
        for (const text of Object.values(texts ?? {})) {
          const id = sha256Of(text);
          const kept = await tx.select().from(gameRulesetCatalogs).where(eq(gameRulesetCatalogs.id, id));
          if (!kept.length) await tx.insert(gameRulesetCatalogs).values({ id, text, createdAt: now() });
        }
      };
      // One transaction, so two imports of the same version cannot both see "not stored yet": the
      // second one has to come back as unchanged or as a conflict, never as a key collision.
      return db.transaction(async (tx) => {
        const rows = (await tx
          .select()
          .from(gameRulesets)
          .where(
            and(eq(gameRulesets.rulesetId, input.rulesetId), eq(gameRulesets.version, input.version)),
          )) as GameRulesetRow[];
        const existing = rows[0];
        if (existing) {
          if (existing.sha256 !== sha256 || (existing.catalogs ?? null) !== catalogs) {
            throw new RulesetVersionConflictError(input.rulesetId, input.version);
          }
          // Its translation is the latest import's: a package file imported again in another language, or
          // with a corrected translation, brings it; one carrying none leaves what it had.
          if (input.locales !== undefined && (existing.locales ?? null) !== locales) {
            await keep(tx, input.locales);
            await tx
              .update(gameRulesets)
              .set({ locales })
              .where(and(eq(gameRulesets.rulesetId, input.rulesetId), eq(gameRulesets.version, input.version)));
            await pruneCatalogs(tx);
            return { status: "unchanged" as const, row: { ...existing, locales } };
          }
          return { status: "unchanged" as const, row: existing };
        }
        const row: GameRulesetRow = {
          id: gameRulesetRowId(input.rulesetId, input.version),
          rulesetId: input.rulesetId,
          version: input.version,
          sourceKind: input.sourceKind,
          sourceUrl: input.sourceUrl ?? null,
          repositoryId: input.repositoryId ?? null,
          sha256,
          definition: input.definition,
          catalogs,
          locales,
          createdAt: now(),
        };
        await tx.insert(gameRulesets).values(row);
        await keep(tx, input.catalogs);
        await keep(tx, input.locales);
        return { status: "added" as const, row };
      });
    },

    /** Forget which repository manages these versions, keeping the versions themselves. Removing a
     *  repository must not break a game pinned to a ruleset it once supplied. */
    async detachRepository(repositoryId: string): Promise<void> {
      await db.update(gameRulesets).set({ repositoryId: null }).where(eq(gameRulesets.repositoryId, repositoryId));
    },

    async remove(rulesetId: string, version: number): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(gameRulesets)
          .where(and(eq(gameRulesets.rulesetId, rulesetId), eq(gameRulesets.version, version)));
        await pruneCatalogs(tx);
      });
    },

    /** A stored version's catalog file, checked against the sha256 its row names; null when the
     *  version, the catalog or the file is not there, or the file is not what the row names. */
    async catalogText(
      rulesetId: string,
      version: number,
      catalogId: string,
    ): Promise<{ sha256: string; text: string } | null> {
      const rows = (await db
        .select()
        .from(gameRulesets)
        .where(and(eq(gameRulesets.rulesetId, rulesetId), eq(gameRulesets.version, version)))) as GameRulesetRow[];
      let map: Record<string, unknown> = {};
      try {
        map = rows[0]?.catalogs ? (JSON.parse(rows[0].catalogs) as Record<string, unknown>) : {};
      } catch {
        return null;
      }
      const sha256 = map[catalogId];
      if (typeof sha256 !== "string") return null;
      const files = (await db.select().from(gameRulesetCatalogs).where(eq(gameRulesetCatalogs.id, sha256))) as Array<{
        id: string;
        text: string;
      }>;
      const text = files[0]?.text;
      return text !== undefined && sha256Of(text) === sha256 ? { sha256, text } : null;
    },

    /** A stored version's translation into one language (1.811), checked against the sha256 its row
     *  names; null when the version has none in that language. */
    async localeText(
      rulesetId: string,
      version: number,
      locale: string,
    ): Promise<{ sha256: string; text: string } | null> {
      const row = await this.get(rulesetId, version);
      let map: Record<string, unknown> = {};
      try {
        map = row?.locales ? (JSON.parse(row.locales) as Record<string, unknown>) : {};
      } catch {
        return null;
      }
      const sha256 = map[locale];
      if (typeof sha256 !== "string") return null;
      const files = (await db.select().from(gameRulesetCatalogs).where(eq(gameRulesetCatalogs.id, sha256))) as Array<{
        id: string;
        text: string;
      }>;
      const text = files[0]?.text;
      return text !== undefined && sha256Of(text) === sha256 ? { sha256, text } : null;
    },

    /** Forget every stored version of one ruleset, and say how many went. Whether a game still
     *  plays on it is the caller's question: this path only writes. */
    async removeAll(rulesetId: string): Promise<number> {
      // Counted and deleted in one transaction, so the number is the number that went.
      return db.transaction(async (tx) => {
        const removed = tx.count(gameRulesets, eq(gameRulesets.rulesetId, rulesetId));
        await tx.delete(gameRulesets).where(eq(gameRulesets.rulesetId, rulesetId));
        await pruneCatalogs(tx);
        return removed;
      });
    },
  };
}
