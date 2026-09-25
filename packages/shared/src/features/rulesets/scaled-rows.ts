// Scaled row values: the columns of a catalog-picked row that the RULESET keeps, rather than the
// player. A maximum that grows with a level lives here (Ki points equal to the level, a trick's uses
// from an ability score, Rage uses from a table).
//
// It is worked out ON EDIT and never on read. The sheet editor runs the recompute over the build it
// is about to store, so a stored row is always the number it says it is: live state, the prompt
// block, the battle bridge and the server all read the row as they always have, and a sheet that is
// only opened is never rewritten.
//
// Everything here is pure, never throws, and needs the catalogs handed in: a catalog may live behind
// a route, and nothing in this file does I/O. Without them a row is left exactly as it is.

import {
  catalogRowRef,
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCatalogEntryRow,
  type RulesetDefinition,
  type RulesetField,
  type RulesetList,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { evaluateRulesetSheet, lookupStepTable, resolveRulesetValueRef } from "./sheet-math.js";

function own(row: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined;
}

/** The catalogs a build's rows point at, in the order the ruleset declares them. A caller fetches
 *  these before the scaled columns, or a `use` command, can be resolved; a mark naming a catalog the
 *  ruleset no longer declares is left out, because there is nothing to fetch. */
export function rulesetCatalogIdsForBuild(definition: RulesetDefinition, build: RulesetSheetBuild): string[] {
  const declared = definition.catalogs;
  if (!declared?.length) return [];
  const marked = new Set<string>();
  for (const rows of Object.values(build.lists ?? {})) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const ref = own(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY);
      if (typeof ref !== "string") continue;
      const slash = ref.indexOf("/");
      if (slash > 0) marked.add(ref.slice(0, slash));
    }
  }
  return declared.map((catalog) => catalog.id).filter((id) => marked.has(id));
}

/** Every fetched entry by the mark a picked row carries. Exported so a caller that asks about many
 *  rows (an editor drawing a list) builds the lookup once and hands it to `scaledRowColumns`. */
export function rulesetCatalogEntriesByRef(catalogs: RulesetCatalogEntriesById): Map<string, RulesetCatalogEntry> {
  const byRef = new Map<string, RulesetCatalogEntry>();
  for (const [catalogId, entries] of Object.entries(catalogs)) {
    for (const entry of entries) byRef.set(catalogRowRef(catalogId, entry.id), entry);
  }
  return byRef;
}

/** The spec for one row of one list: the entry it came from carries at most one row for that list
 *  when that row is scaled, which is the schema's own rule, so there is nothing to guess. */
function scaledRowSpec(
  byRef: ReadonlyMap<string, RulesetCatalogEntry>,
  listId: string,
  row: Record<string, unknown>,
): RulesetCatalogEntryRow | null {
  const ref = own(row, RULESET_CATALOG_ROW_KEY);
  if (typeof ref !== "string") return null;
  const entry = byRef.get(ref);
  if (!entry) return null;
  // A creature entry writes no rows at all, so it never matches a marked row on a sheet.
  return entry.rows?.find((candidate) => candidate.list === listId && candidate.scaled) ?? null;
}

/** The value fitted into the column's own rules, so the recompute can never write something the
 *  sheet editor would then refuse. */
function fitToColumn(value: number, column: Extract<RulesetList["columns"][number], { type: "number" }>): number {
  const bounded = Math.min(Math.max(value, column.min), column.max);
  return column.integer ? Math.max(column.min, Math.floor(bounded)) : bounded;
}

/**
 * The build with every scaled column of every catalog-marked row brought up to date.
 *
 * Returns the SAME reference when nothing changed, so a caller can store the result unconditionally
 * and a sheet that was only opened is never rewritten. A row with no mark, an unknown catalog, an
 * unknown entry or an entry with no `scaled` is left exactly as it is: the player's own numbers are
 * never touched by this, and neither is a row whose catalog the caller could not fetch.
 */
export function recomputeScaledRows(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
): RulesetSheetBuild {
  if (!definition.catalogs?.length) return build;
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  if (byRef.size === 0) return build;

  // The sheet is evaluated at most once per call, and only when a scaled column is actually found.
  let evaluated: ReturnType<typeof evaluateRulesetSheet> | null = null;
  const sheetNumbers = () => (evaluated ??= evaluateRulesetSheet(definition, build));

  let lists: RulesetSheetBuild["lists"] | null = null;
  for (const list of definition.sheet.lists) {
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const columnById = new Map(list.columns.map((column) => [column.id, column]));
    let replaced: Array<Record<string, string | number | boolean>> | null = null;

    rows.forEach((row, index) => {
      if (!row || typeof row !== "object") return;
      const cells = row as Record<string, unknown>;
      const spec = scaledRowSpec(byRef, list.id, cells);
      if (!spec?.scaled) return;
      let next: Record<string, string | number | boolean> | null = null;
      for (const [columnId, scaled] of Object.entries(spec.scaled)) {
        const column = columnById.get(columnId);
        if (column?.type !== "number") continue;
        const raw = resolveRulesetValueRef(definition, build, scaled.from, sheetNumbers());
        const looked = scaled.table ? lookupStepTable(scaled.table, raw) : raw;
        // A value that is not a number leaves the cell alone rather than writing junk into it.
        if (!Number.isFinite(looked)) continue;
        const fitted = fitToColumn(looked, column);
        if (own(cells, columnId) === fitted) continue;
        next = next ?? { ...(row as Record<string, string | number | boolean>) };
        next[columnId] = fitted;
      }
      if (!next) return;
      replaced = replaced ?? [...(rows as Array<Record<string, string | number | boolean>>)];
      replaced[index] = next;
    });

    if (!replaced) continue;
    lists = lists ?? { ...build.lists };
    lists[list.id] = replaced;
  }
  return lists ? { ...build, lists } : build;
}

/**
 * The columns of this row the ruleset sets, for an editor that wants to show them as read-only.
 *
 * Empty for a hand-typed row, for a catalog the caller has not fetched, and for a column the list
 * does not declare as a number, so a cell is only ever locked when something really does write it.
 */
export function scaledRowColumns(
  definition: RulesetDefinition,
  listId: string,
  row: Readonly<Record<string, unknown>>,
  /** The fetched catalogs, or the lookup `rulesetCatalogEntriesByRef` built from them. */
  catalogs: RulesetCatalogEntriesById | ReadonlyMap<string, RulesetCatalogEntry>,
): string[] {
  const list = definition.sheet.lists.find((entry) => entry.id === listId);
  if (!list) return [];
  const byRef = catalogs instanceof Map ? catalogs : rulesetCatalogEntriesByRef(catalogs as RulesetCatalogEntriesById);
  const spec = scaledRowSpec(byRef, listId, row);
  if (!spec?.scaled) return [];
  return Object.keys(spec.scaled).filter(
    (columnId) => list.columns.find((column) => column.id === columnId)?.type === "number",
  );
}

/** The texts that could name the sheet's own value of a field. A catalog names a value the way a
 *  player reads it, so an enum's display label has to be tried beside the stored value. */
export function sheetFieldMatchTexts(
  field: RulesetField | undefined,
  stored: string | number | boolean | undefined,
): string[] {
  const value = stored === undefined ? field?.default : stored;
  if (value === undefined || value === "") return [];
  const texts = [String(value)];
  if (field?.type === "enum" && typeof value === "string") {
    const shown = field.valueLabels?.[value];
    if (shown) texts.push(shown);
  }
  return texts;
}
