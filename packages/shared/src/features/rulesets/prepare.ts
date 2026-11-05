// The `prepare` command: what a character has ready changes in the story (a cleric's spells, swapped
// after a long rest), and the Game Master writes it.
//
// What the sheet shows as prepared is a list's yes-or-no `display.mark` column (Capability API 1.378),
// the one the Game Master's sheet summary reads with `onlyWhen` too. Preparing ticks it on the row the
// sheet holds, and `unprepare` clears it. A row the sheet does not hold is added where the sheet's own
// builder would let the character pick that entry for that list with the mark ticked (a cleric's whole
// class list), stamped as the builder stamps its rows, so the story never prepares what the character
// could not have picked. How many may be held prepared is what the builder lets them pick or mark, and
// nothing is ticked past it.
//
// This edits the build, not live state, so the result carries the new build and the caller saves it
// the way an `advance` is saved.

import {
  catalogRowRef,
  RULESET_CATALOG_ROW_KEY,
  rowsFromCatalogEntry,
  rulesetSheetBuildSchema,
  storedRulesetSheetsSchema,
  type RulesetBuilderStep,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetList,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { rulesetEntryNameColumn, type RulesetSheetOp, type RulesetSheetRefusal } from "./live-state.js";
import { recomputeScaledRows, rulesetCatalogEntriesByRef } from "./scaled-rows.js";
import {
  rulesetBuilderMarkCount,
  rulesetBuilderMarkRows,
  rulesetBuilderOptions,
  rulesetBuilderPicks,
  rulesetBuilderStamp,
  rulesetBuilderStepCount,
  rulesetBuilderStepVisible,
  type RulesetBuilderState,
} from "./sheet-builder.js";

type CatalogStep = Extract<RulesetBuilderStep, { kind: "catalog" }>;
type MarkStep = Extract<RulesetBuilderStep, { kind: "mark" }>;
type Row = Record<string, string | number | boolean>;

export type RulesetPrepareOp = Extract<RulesetSheetOp, { op: "prepare" | "unprepare" }>;

export type RulesetPrepareResult =
  | {
      ok: true;
      build: RulesetSheetBuild;
      now: string;
      /** Whether the entry's rows were added, rather than a held row ticked. */
      added: boolean;
    }
  | { ok: false; reason: RulesetSheetRefusal };

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function sameName(a: unknown, b: string): boolean {
  return typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The lists whose rows the sheet shows as prepared, with the column that says so. */
function markedLists(definition: RulesetDefinition): Array<{ list: RulesetList; column: string }> {
  return definition.sheet.lists.flatMap((list) => {
    const column = list.display?.mark;
    return column && list.columns.some((one) => one.id === column && one.type === "boolean") ? [{ list, column }] : [];
  });
}

/** The catalog steps that put rows on `list`, by the lists their catalog feeds. */
function stepsOnList(definition: RulesetDefinition, list: string): CatalogStep[] {
  const feeds = new Map((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.feeds]));
  return (definition.sheet.builder?.steps ?? []).filter(
    (step): step is CatalogStep =>
      step.kind === "catalog" && feeds.has(step.catalog) && (feeds.get(step.catalog)?.includes(list) ?? true),
  );
}

/**
 * The catalogs a `prepare` reads: every builder step's that puts rows on a list with a prepared mark,
 * and the catalogs of the steps they pick within (a spell list within the class). Empty for a ruleset
 * with no such list.
 */
export function rulesetPrepareCatalogIds(definition: RulesetDefinition): string[] {
  const steps = definition.sheet.builder?.steps ?? [];
  const ids = new Set<string>();
  const add = (step: RulesetBuilderStep | undefined, depth: number) => {
    if (!step || step.kind !== "catalog" || depth > steps.length) return;
    ids.add(step.catalog);
    if (step.within)
      add(
        steps.find((one) => one.id === step.within!.step),
        depth + 1,
      );
  };
  for (const { list } of markedLists(definition)) for (const step of stepsOnList(definition, list.id)) add(step, 0);
  return [...ids];
}

/** The builder's picks, with those of a step another picks within filled in from the rows the sheet
 *  holds where nothing was picked there: a character the builder never made (one the story made), whose
 *  class is known only by the rows its class wrote. */
function pickedOrHeld(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  given: RulesetBuilderState | undefined,
): RulesetBuilderState {
  const steps = definition.sheet.builder?.steps ?? [];
  const held: string[] = [];
  for (const rows of Object.values(build.lists ?? {})) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const ref = row && typeof row === "object" ? own(row, RULESET_CATALOG_ROW_KEY) : undefined;
      if (typeof ref === "string" && !held.includes(ref)) held.push(ref);
    }
  }
  let picks = given?.picks ?? {};
  for (const step of steps) {
    if (step.kind !== "catalog" || !step.within || picks[step.within.step]?.length) continue;
    const parent = steps.find((one) => one.id === step.within!.step);
    if (!parent || parent.kind !== "catalog") continue;
    const prefix = `${parent.catalog}/`;
    const ids = held.flatMap((ref) => (ref.startsWith(prefix) ? [ref.slice(prefix.length)] : []));
    if (ids.length > 0) picks = { ...picks, [parent.id]: ids };
  }
  return picks === given?.picks ? (given ?? {}) : { ...given, picks };
}

/** What a row an entry writes onto `list` through `step` holds in the mark column: the step's stamp,
 *  else the entry's own value, else the column's default. */
function stepTicks(
  list: RulesetList,
  column: string,
  entry: RulesetCatalogEntry,
  stamp: Record<string, string | number | boolean>,
): boolean {
  const row = (entry.rows ?? []).find((one) => one.list === list.id);
  if (!row) return false;
  const stamped = own(stamp, column);
  if (stamped !== undefined) return stamped === true;
  const value = own(row.values, column);
  if (value !== undefined) return value === true;
  const declared = list.columns.find((one) => one.id === column);
  return !!declared && "default" in declared && declared.default === true;
}

/** Each step that puts rows on the list ticked, with the entries it offers this sheet. A step that
 *  asks for none (a bard's Magical Secrets, to anyone else) offers nothing. Steps that take all they
 *  offer come first: what they give is always prepared and counts against nothing. */
function offeringSteps(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  list: RulesetList,
  column: string,
): Array<{ step: CatalogStep; offered: RulesetCatalogEntry[] }> {
  const out: Array<{ step: CatalogStep; offered: RulesetCatalogEntry[] }> = [];
  for (const step of stepsOnList(definition, list.id)) {
    if (!rulesetBuilderStepVisible(definition, step, build)) continue;
    if (!step.takesAll && rulesetBuilderStepCount(definition, step, build).max < 1) continue;
    const offered = rulesetBuilderOptions(definition, step, state, catalogs, build).filter((entry) =>
      stepTicks(list, column, entry, rulesetBuilderStamp(definition, step, entry, state, catalogs, build)),
    );
    if (offered.length > 0) out.push({ step, offered });
  }
  return out.sort((a, b) => Number(!!b.step.takesAll) - Number(!!a.step.takesAll));
}

/** The first limit the build breaks for the row `ref` just ticked: a mark step's count of rows it
 *  offers marked, or a pick step's count of rows it offers ticked, leaving out what a step that takes
 *  all gives and what another step picked. */
function overLimit(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  list: RulesetList,
  column: string,
  ref: string,
): string | null {
  const rows = Array.isArray(build.lists[list.id]) ? build.lists[list.id]! : [];
  const ticked = new Set(
    rows.flatMap((row) => {
      const mark = own(row, RULESET_CATALOG_ROW_KEY);
      return typeof mark === "string" && own(row, column) === true ? [mark] : [];
    }),
  );
  for (const step of definition.sheet.builder?.steps ?? []) {
    if (step.kind !== "mark" || step.list !== list.id || step.column !== column) continue;
    if (!rulesetBuilderStepVisible(definition, step, build)) continue;
    const offered = rulesetBuilderMarkRows(step as MarkStep, build).map((one) => one.ref);
    if (!offered.includes(ref)) continue;
    const most = rulesetBuilderMarkCount(definition, step as MarkStep, build);
    const count = offered.filter((one) => ticked.has(one)).length;
    if (count > most) return `${most} of ${most} ${step.label} already`;
  }
  const steps = offeringSteps(definition, build, state, catalogs, list, column);
  const refsOf = (step: CatalogStep, entries: readonly RulesetCatalogEntry[]) =>
    entries.map((entry) => catalogRowRef(step.catalog, entry.id));
  const free = new Set(steps.flatMap(({ step, offered }) => (step.takesAll ? refsOf(step, offered) : [])));
  for (const { step, offered } of steps) {
    if (step.takesAll) continue;
    const others = new Set(
      steps.flatMap(({ step: other }) =>
        other === step || other.takesAll
          ? []
          : refsOf(other, rulesetBuilderPicks(definition, other.id, state, catalogs, build)),
      ),
    );
    const counted = refsOf(step, offered).filter((one) => !free.has(one) && !others.has(one));
    if (!counted.includes(ref)) continue;
    const most = rulesetBuilderStepCount(definition, step, build).max;
    const count = counted.filter((one) => ticked.has(one)).length;
    if (count > most) return `${most} of ${most} ${step.label} already`;
  }
  return null;
}

function checked(definition: RulesetDefinition, build: RulesetSheetBuild): RulesetSheetBuild | null {
  const parsed = rulesetSheetBuildSchema.safeParse(build);
  if (
    !parsed.success ||
    !storedRulesetSheetsSchema.safeParse({ [definition.id]: { v: definition.sheet.version, build: parsed.data } })
      .success
  )
    return null;
  return parsed.data;
}

/**
 * Prepare or unprepare one entry by name on one sheet. Pure: the build handed in is never touched.
 * `builder` is the sheet's own builder state, whose picks say what its later steps offer; without
 * them, what the sheet holds stands in for them.
 */
export function applyRulesetPrepare(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  op: RulesetPrepareOp,
  builder?: RulesetBuilderState,
): RulesetPrepareResult {
  const wanted = typeof op.name === "string" ? op.name.trim() : "";
  if (!wanted) return { ok: false, reason: "unknown-entry" };
  const marked = markedLists(definition);
  if (marked.length === 0) return { ok: false, reason: "not-allowed" };
  const on = op.op === "prepare";
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  const state = pickedOrHeld(definition, build, builder);

  // A row the sheet holds, by the name it shows or the entry it came from.
  const held: Array<{ list: RulesetList; column: string; index: number; key: string; label: string }> = [];
  for (const { list, column } of marked) {
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const nameColumn = rulesetEntryNameColumn(definition, list);
    rows.forEach((row, index) => {
      if (!row || typeof row !== "object") return;
      const ref = own(row, RULESET_CATALOG_ROW_KEY);
      const name = nameColumn ? own(row, nameColumn) : undefined;
      const label = typeof ref === "string" ? byRef.get(ref)?.label : undefined;
      if (!sameName(name, wanted) && !sameName(label, wanted)) return;
      const shown = typeof name === "string" && name.trim() ? name.trim() : (label ?? wanted);
      held.push({ list, column, index, key: typeof ref === "string" ? ref : `${list.id}:${shown}`, label: shown });
    });
  }
  if (new Set(held.map((one) => one.key)).size > 1) return { ok: false, reason: "ambiguous-entry" };
  if (held.length > 0) {
    const isTicked = (one: (typeof held)[number]) => own(build.lists[one.list.id]![one.index]!, one.column) === true;
    const target = held.find((one) => isTicked(one) !== on) ?? held[0]!;
    if (isTicked(target) === on)
      return { ok: true, build, added: false, now: `${target.label} ${on ? "already prepared" : "was not prepared"}` };
    const rows = [...build.lists[target.list.id]!];
    rows[target.index] = { ...rows[target.index]!, [target.column]: on };
    const next = checked(definition, { ...build, lists: { ...build.lists, [target.list.id]: rows } });
    if (!next) return { ok: false, reason: "malformed" };
    if (on && target.key.includes("/")) {
      const over = overLimit(definition, next, state, catalogs, target.list, target.column, target.key);
      if (over) return { ok: false, reason: `too-many-prepared: ${over}; unprepare one first` };
    }
    return { ok: true, build: next, added: false, now: `${target.label} ${on ? "prepared" : "no longer prepared"}` };
  }
  if (!on) return { ok: false, reason: "unknown-entry" };

  // Not held: an entry the builder offers this sheet for a marked list, ticked.
  const found = new Map<string, { list: RulesetList; column: string; step: CatalogStep; entry: RulesetCatalogEntry }>();
  for (const { list, column } of marked) {
    const nameColumn = rulesetEntryNameColumn(definition, list);
    for (const { step, offered } of offeringSteps(definition, build, state, catalogs, list, column)) {
      for (const entry of offered) {
        const row = (entry.rows ?? []).find((one) => one.list === list.id);
        const named =
          sameName(entry.label, wanted) || (!!nameColumn && sameName(own(row?.values ?? {}, nameColumn), wanted));
        const ref = catalogRowRef(step.catalog, entry.id);
        if (named && !found.has(ref)) found.set(ref, { list, column, step, entry });
      }
    }
  }
  if (found.size > 1) return { ok: false, reason: "ambiguous-entry" };
  const pick = [...found.values()][0];
  if (!pick) {
    // Known to the catalogs, but not one this sheet could pick: another class's spell.
    const known = [...byRef.values()].some(
      (entry) =>
        sameName(entry.label, wanted) && entry.rows?.some((row) => marked.some(({ list }) => list.id === row.list)),
    );
    return { ok: false, reason: known ? "not-allowed" : "unknown-entry" };
  }
  const { list, column, step, entry } = pick;
  const ref = catalogRowRef(step.catalog, entry.id);
  const stamp = rulesetBuilderStamp(definition, step, entry, state, catalogs, build);
  let lists = build.lists;
  for (const { list: target, row } of rowsFromCatalogEntry(step.catalog, entry)) {
    const spec = definition.sheet.lists.find((one) => one.id === target);
    const rows: Row[] = Array.isArray(lists[target]) ? lists[target]! : [];
    if (!spec || rows.some((one) => own(one, RULESET_CATALOG_ROW_KEY) === ref)) continue;
    // A full list takes no more, as the builder's does not.
    if (rows.length >= spec.maxItems) {
      if (target === list.id) return { ok: false, reason: "not-allowed" };
      continue;
    }
    const added: Row = { ...row, ...stamp, ...(target === list.id ? { [column]: true } : {}) };
    lists = { ...lists, [target]: [...rows, added] };
  }
  const next = checked(definition, recomputeScaledRows(definition, { ...build, lists }, catalogs));
  if (!next) return { ok: false, reason: "malformed" };
  const over = overLimit(definition, next, state, catalogs, list, column, ref);
  if (over) return { ok: false, reason: `too-many-prepared: ${over}; unprepare one first` };
  const nameColumn = rulesetEntryNameColumn(definition, list);
  const shown = own((entry.rows ?? []).find((one) => one.list === list.id)?.values ?? {}, nameColumn ?? "");
  const label = typeof shown === "string" && shown.trim() ? shown.trim() : entry.label;
  return { ok: true, build: next, added: true, now: `${label} prepared, added from ${step.label}` };
}

/** The name an entry a `use` found on no sheet goes by, where preparing it would put it there (or
 *  would, but for how many are prepared already); null where it would not. */
export function rulesetPreparableEntry(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  name: string,
  builder?: RulesetBuilderState,
): string | null {
  const result = applyRulesetPrepare(definition, build, catalogs, { op: "prepare", name }, builder);
  if (result.ok) return result.added ? name.trim() : null;
  return result.reason.startsWith("too-many-prepared") ? name.trim() : null;
}
