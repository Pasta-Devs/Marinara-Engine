// ──────────────────────────────────────────────
// Game: reading one catalog of a registered ruleset
// ──────────────────────────────────────────────
// A catalog's entries sit inline in `ruleset.json` or in a hash-pinned `catalogs/<id>.json` asset
// beside it: a package's installed file, or, for a ruleset imported from a package file (RM), the file
// kept with it in the store, under `local/<its id>`. Two callers need them: the route the sheet editor's picker reads, and the turn that
// resolves a `use` command. Opening and reading are separate steps on purpose, so the route can
// answer a browser that already holds the file before the megabyte is read and checked.

import { createHash } from "node:crypto";
import {
  communityRulesetId,
  experienceOverlayEntries,
  isCommunityRulesetId,
  parseBorrowedRulesetCatalog,
  parseRulesetCatalogFile,
  RULESET_LOCAL_NAMESPACE,
  type RulesetCatalogEntry,
  type RulesetCatalogHeader,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";
import { getDB } from "../../db/connection.js";
import { createGameRulesetsStorage } from "../storage/game-rulesets.storage.js";
import { readRulesetRegistry, type RulesetRegistry } from "./ruleset-registry.service.js";

/** One catalog's entries, or the author's own issue lines for a file the Engine will not read. */
export type RulesetCatalogEntriesResult =
  { ok: true; entries: RulesetCatalogEntry[] } | { ok: false; issues: string[] };

/** Where a catalog's entries are. `sha256` is the pinned hash of the asset, which is what a caller
 *  builds a validator out of; `read` parses and checks the file against the ruleset. */
export type OpenedRulesetCatalog =
  | { kind: "inline"; entries: RulesetCatalogEntry[] }
  | { kind: "asset"; sha256: string; read: () => Promise<RulesetCatalogEntriesResult> }
  /** The package no longer holds the file the ruleset names. */
  | { kind: "missing" }
  | { kind: "unusable"; issues: string[] };

export async function openRulesetCatalog(
  packageId: string | null,
  definition: RulesetDefinition,
  catalog: RulesetCatalogHeader,
  registry?: RulesetRegistry,
): Promise<OpenedRulesetCatalog> {
  if (catalog.from) return openBorrowedCatalog(definition, catalog, catalog.from, registry);
  // What the game's Experience adds to it (1.355), after its own.
  const added = experienceOverlayEntries(definition, catalog.id);
  if (catalog.entries)
    return { kind: "inline", entries: added.length ? [...catalog.entries, ...added] : catalog.entries };
  if (!catalog.asset) return { kind: "unusable", issues: ["(root): this catalog holds no entries"] };
  // A package ships its catalog files; of the imported rulesets, only one from a package file has them,
  // and the package import always files it under `local/` (the JSON and repository imports refuse them).
  const source = packageId
    ? await capabilityPackageManager.rulesetCatalogAsset(packageId, catalog.id)
    : await storedCatalog(definition, catalog.id);
  if (!source) return { kind: "missing" };
  if ("issue" in source) return { kind: "unusable", issues: [source.issue] };
  return {
    kind: "asset",
    sha256: added.length ? `${source.sha256}+${added.length}` : source.sha256,
    read: async () => {
      const file = await source.read();
      if ("issue" in file) return { ok: false, issues: [file.issue] };
      let document: unknown;
      try {
        document = JSON.parse(file.data.toString("utf8"));
      } catch {
        return { ok: false, issues: ["(root): the catalog file is not valid JSON"] };
      }
      // A game's definition may have its layers on, which can narrow a field a creature was written with.
      const parsed = parseRulesetCatalogFile(definition, catalog.id, document, true);
      if (!parsed.ok) {
        logger.warn(
          "[capability/rulesets] Catalog %s of %s is unusable: %s",
          catalog.id,
          definition.id,
          parsed.issues.slice(0, 5).join("; "),
        );
        return { ok: false, issues: parsed.issues };
      }
      return { ok: true, entries: added.length ? [...parsed.entries, ...added] : parsed.entries };
    },
  };
}

/** Another installed ruleset's catalog, read against this one (Capability API 1.220). The lender is
 *  found by its id, bare or under a community namespace; an entry that does not fit this ruleset is
 *  left out and logged, and the catalog's own entries add to the rest or replace one of the same id. */
async function openBorrowedCatalog(
  definition: RulesetDefinition,
  catalog: RulesetCatalogHeader,
  from: NonNullable<RulesetCatalogHeader["from"]>,
  known?: RulesetRegistry,
): Promise<OpenedRulesetCatalog> {
  // A caller that has just read the installed rulesets passes them on rather than reading them again.
  let registry = known;
  if (!registry) {
    try {
      registry = await readRulesetRegistry();
    } catch {
      return { kind: "unusable", issues: ["(root): the installed rulesets could not be read"] };
    }
  }
  const notHere = (why: string) => ({ kind: "unusable" as const, issues: [`from: ${why}`] });
  // A short id names a ruleset only when one installed ruleset ends with it.
  const suffixed = [...registry].filter(([id]) => id.endsWith(`:${from.ruleset}`) || id.endsWith(`/${from.ruleset}`));
  if (!registry.has(from.ruleset) && suffixed.length > 1) {
    return notHere(`more than one installed ruleset is named "${from.ruleset}"; name it by its full id`);
  }
  const lender = registry.get(from.ruleset) ?? suffixed[0]?.[1];
  if (!lender) return notHere(`the ruleset "${from.ruleset}" this catalog borrows from is not installed`);
  if (lender.definition.id === definition.id) return notHere("a catalog cannot borrow from its own ruleset");
  const theirs = lender.definition.catalogs?.find((entry) => entry.id === from.catalog);
  if (!theirs) return notHere(`the ruleset "${from.ruleset}" has no catalog "${from.catalog}"`);
  if (theirs.from) return notHere(`"${from.ruleset}" borrows its catalog "${from.catalog}" in turn`);
  let file: { sha256: string; read: () => Promise<{ data: Buffer } | { issue: string }> };
  if (theirs.entries) {
    const data = Buffer.from(JSON.stringify({ schemaVersion: 1, catalog: theirs.id, entries: theirs.entries }), "utf8");
    file = { sha256: createHash("sha256").update(data).digest("hex"), read: async () => ({ data }) };
  } else {
    const source = lender.packageId
      ? await capabilityPackageManager.rulesetCatalogAsset(lender.packageId, theirs.id)
      : await storedCatalog(lender.definition, theirs.id);
    if (!source) return notHere(`the file for "${from.ruleset}"'s catalog "${from.catalog}" is gone`);
    if ("issue" in source) return { kind: "unusable", issues: [source.issue] };
    file = source;
  }
  // The lender's file, its version, this catalog's own entries and the borrowing ruleset (whose sheet
  // decides which entries fit) name what the answer was read from.
  const sha256 = createHash("sha256")
    .update(
      `${file.sha256}.${lender.definition.version}.${definition.id}.${definition.version}.${JSON.stringify(catalog.entries ?? [])}`,
    )
    .digest("hex");
  return {
    kind: "asset",
    sha256,
    read: async () => {
      const read = await file.read();
      if ("issue" in read) return { ok: false, issues: [read.issue] };
      let document: unknown;
      try {
        document = JSON.parse(read.data.toString("utf8"));
      } catch {
        return { ok: false, issues: ["(root): the borrowed catalog file is not valid JSON"] };
      }
      const parsed = parseBorrowedRulesetCatalog(definition, catalog.id, theirs, document, true);
      if (!parsed.ok) {
        logger.warn(
          "[capability/rulesets] Catalog %s of %s, borrowed from %s, is unusable: %s",
          catalog.id,
          definition.id,
          from.ruleset,
          parsed.issues.slice(0, 5).join("; "),
        );
        return { ok: false, issues: parsed.issues };
      }
      if (parsed.dropped.length) {
        logger.warn(
          "[capability/rulesets] Catalog %s of %s leaves out %d of %s's entries it cannot read: %s",
          catalog.id,
          definition.id,
          parsed.dropped.length,
          from.ruleset,
          parsed.dropped.slice(0, 5).join("; "),
        );
      }
      return { ok: true, entries: parsed.entries };
    },
  };
}

/** A package-imported ruleset's catalog file, from the store, in the shape a package's asset comes in. */
async function storedCatalog(
  definition: RulesetDefinition,
  catalogId: string,
): Promise<{ sha256: string; read: () => Promise<{ data: Buffer } | { issue: string }> } | null> {
  // The registry hands an imported ruleset out under its namespaced id; a file as written has its own.
  let rulesetId = definition.id;
  if (!isCommunityRulesetId(rulesetId)) {
    try {
      rulesetId = communityRulesetId(RULESET_LOCAL_NAMESPACE, definition.id);
    } catch {
      return null;
    }
  }
  const stored = await createGameRulesetsStorage(await getDB()).catalogText(rulesetId, definition.version, catalogId);
  return stored ? { sha256: stored.sha256, read: async () => ({ data: Buffer.from(stored.text, "utf8") }) } : null;
}

/** One catalog's entries, for a caller with no cached copy to compare against. */
export async function loadRulesetCatalogEntries(
  packageId: string | null,
  definition: RulesetDefinition,
  catalog: RulesetCatalogHeader,
  registry?: RulesetRegistry,
): Promise<RulesetCatalogEntriesResult> {
  const opened = await openRulesetCatalog(packageId, definition, catalog, registry);
  if (opened.kind === "inline") return { ok: true, entries: opened.entries };
  if (opened.kind === "asset") return opened.read();
  return {
    ok: false,
    issues: opened.kind === "missing" ? [`(root): the file for catalog "${catalog.id}" is gone`] : opened.issues,
  };
}
