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
// ──────────────────────────────────────────────

import { createHash } from "node:crypto";
import {
  communityRulesetId,
  isCommunityRulesetId,
  parseRulesetDefinition,
  RULESET_MAX_BYTES,
  rulesetSourceUrlSchema,
} from "@marinara-engine/shared";
import { and, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameRulesets } from "../../db/schema/index.js";
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
  // A catalog file beside `ruleset.json` is something only a package can ship. An imported ruleset
  // is this one file, so its catalogs have to be inline or the picker would have nothing to read.
  const assetCatalog = parsed.definition.catalogs?.find((catalog) => catalog.asset);
  if (assetCatalog) {
    throw new RulesetRefusedError(
      `The catalog "${assetCatalog.id}" names a separate file (${assetCatalog.asset}). An imported ruleset carries its catalogs inline, as "entries"`,
    );
  }
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
      const sha256 = createHash("sha256").update(input.definition, "utf8").digest("hex");
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
          if (existing.sha256 !== sha256) throw new RulesetVersionConflictError(input.rulesetId, input.version);
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
          createdAt: now(),
        };
        await tx.insert(gameRulesets).values(row);
        return { status: "added" as const, row };
      });
    },

    /** Forget which repository manages these versions, keeping the versions themselves. Removing a
     *  repository must not break a game pinned to a ruleset it once supplied. */
    async detachRepository(repositoryId: string): Promise<void> {
      await db.update(gameRulesets).set({ repositoryId: null }).where(eq(gameRulesets.repositoryId, repositoryId));
    },

    async remove(rulesetId: string, version: number): Promise<void> {
      await db
        .delete(gameRulesets)
        .where(and(eq(gameRulesets.rulesetId, rulesetId), eq(gameRulesets.version, version)));
    },

    /** Forget every stored version of one ruleset, and say how many went. Whether a game still
     *  plays on it is the caller's question: this path only writes. */
    async removeAll(rulesetId: string): Promise<number> {
      // Counted and deleted in one transaction, so the number is the number that went.
      return db.transaction(async (tx) => {
        const removed = tx.count(gameRulesets, eq(gameRulesets.rulesetId, rulesetId));
        await tx.delete(gameRulesets).where(eq(gameRulesets.rulesetId, rulesetId));
        return removed;
      });
    },
  };
}
