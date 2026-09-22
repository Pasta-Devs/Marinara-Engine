// ──────────────────────────────────────────────
// Game: reading one catalog of a registered ruleset
// ──────────────────────────────────────────────
// A catalog's entries sit inline in `ruleset.json` or in a hash-pinned `catalogs/<id>.json` asset
// beside it. Two callers need them: the route the sheet editor's picker reads, and the turn that
// resolves a `use` command. Opening and reading are separate steps on purpose, so the route can
// answer a browser that already holds the file before the megabyte is read and checked.

import {
  parseRulesetCatalogFile,
  type RulesetCatalogEntry,
  type RulesetCatalogHeader,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";

/** One catalog's entries, or the author's own issue lines for a file the Engine will not read. */
export type RulesetCatalogEntriesResult =
  | { ok: true; entries: RulesetCatalogEntry[] }
  | { ok: false; issues: string[] };

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
): Promise<OpenedRulesetCatalog> {
  if (catalog.entries) return { kind: "inline", entries: catalog.entries };
  // Only a package can ship a catalog file; an imported ruleset carries its catalogs inline, inside
  // the one file the user imported.
  if (!catalog.asset) return { kind: "unusable", issues: ["(root): this catalog holds no entries"] };
  if (!packageId) return { kind: "unusable", issues: [`asset: ${catalog.asset} can only be shipped by a package`] };
  const source = await capabilityPackageManager.rulesetCatalogAsset(packageId, catalog.id);
  if (!source) return { kind: "missing" };
  if ("issue" in source) return { kind: "unusable", issues: [source.issue] };
  return {
    kind: "asset",
    sha256: source.sha256,
    read: async () => {
      const file = await source.read();
      if ("issue" in file) return { ok: false, issues: [file.issue] };
      let document: unknown;
      try {
        document = JSON.parse(file.data.toString("utf8"));
      } catch {
        return { ok: false, issues: ["(root): the catalog file is not valid JSON"] };
      }
      const parsed = parseRulesetCatalogFile(definition, catalog.id, document);
      if (!parsed.ok) {
        logger.warn(
          "[capability/rulesets] Catalog %s of %s is unusable: %s",
          catalog.id,
          definition.id,
          parsed.issues.slice(0, 5).join("; "),
        );
        return { ok: false, issues: parsed.issues };
      }
      return { ok: true, entries: parsed.entries };
    },
  };
}

/** One catalog's entries, for a caller with no cached copy to compare against. */
export async function loadRulesetCatalogEntries(
  packageId: string | null,
  definition: RulesetDefinition,
  catalog: RulesetCatalogHeader,
): Promise<RulesetCatalogEntriesResult> {
  const opened = await openRulesetCatalog(packageId, definition, catalog);
  if (opened.kind === "inline") return { ok: true, entries: opened.entries };
  if (opened.kind === "asset") return opened.read();
  return {
    ok: false,
    issues: opened.kind === "missing" ? [`(root): the file for catalog "${catalog.id}" is gone`] : opened.issues,
  };
}
