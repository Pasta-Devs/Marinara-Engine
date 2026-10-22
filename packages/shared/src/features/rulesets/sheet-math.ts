// Pure arithmetic over a ruleset definition and a stored character sheet. Shared so the server's
// check resolver, the GM prompt and the client's sheet editor all compute the same numbers.
//
// Nothing here throws. A sheet is read TOLERANTLY against the ruleset's current schema: a missing
// value takes the declared default, an unknown key is ignored, and a value that is not a finite
// number reads as its default. Definitions are assumed validated (`parseRulesetDefinition`), but a
// dangling reference still reads as 0 instead of failing a turn.

import {
  rulesetPartyDefinition,
  RULESET_POOL_MAX_DICE,
  rulesetSheetEnvelopeSchema,
  type RulesetCatalogItem,
  type RulesetCombatAbilitySource,
  type RulesetDefinition,
  type RulesetDifficultyLadderStep,
  type RulesetResolution,
  type RulesetHideWhen,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
  type RulesetSheetMigrationStep,
  type RulesetUntrained,
  type RulesetValueRef,
  rulesetDieSides,
  type RulesetList,
  type RulesetListColumn,
  rulesetOverriddenResolution,
  type RulesetResolutionOverride,
} from "../../schemas/ruleset.schema.js";

type StepTable = ReadonlyArray<readonly [number, number]>;
type Rounding = "down" | "up" | "nearest";

export function lookupStepTable(table: StepTable, input: number): number {
  let value = table[0]?.[1] ?? 0;
  for (const [threshold, entry] of table) {
    if (input < threshold) break;
    value = entry;
  }
  return value;
}

export function roundRulesetNumber(value: number, mode: Rounding): number {
  if (mode === "up") return Math.ceil(value);
  if (mode === "nearest") return Math.round(value);
  return Math.floor(value);
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A complete, blank starting build: every ability, field and tier at its declared default. */
export function defaultRulesetSheetBuild(definition: RulesetDefinition): RulesetSheetBuild {
  const fields: RulesetSheetBuild["fields"] = {};
  for (const field of definition.sheet.fields) {
    if (field.default !== undefined) fields[field.id] = field.default;
    else if (field.type === "number") fields[field.id] = Math.min(Math.max(0, field.min), field.max);
    else if (field.type === "boolean") fields[field.id] = false;
    else if (field.type === "enum") fields[field.id] = field.values[0]!;
    else fields[field.id] = "";
  }
  return {
    abilities: Object.fromEntries(definition.sheet.abilities.map((ability) => [ability.id, ability.default])),
    skills: {},
    saves: {},
    bonuses: {},
    fields,
    lists: {},
  };
}

export function createRulesetSheetEnvelope(
  definition: RulesetDefinition,
  build: RulesetSheetBuild = defaultRulesetSheetBuild(definition),
): RulesetSheetEnvelope {
  return { v: definition.sheet.version, build };
}

/** The copy a new game takes of a starting build: the stored sheet when it reads as one, else a
 *  blank default, so every party member has a sheet from the first turn. Always a deep copy — a
 *  game edits its own sheet and nothing in a game writes back to the library. Migrated to this
 *  layout first, and never labelled older than it was: a sheet a newer version wrote, copied by an
 *  older one, keeps its own number, so the newer version still knows what it holds. */
export function copyRulesetSheetForGame(definition: RulesetDefinition, stored: unknown): RulesetSheetEnvelope {
  const read = readRulesetSheetEnvelope(definition, stored);
  if (!read) return createRulesetSheetEnvelope(definition);
  return { v: read.v, build: structuredClone(read.build) };
}

// ── Migrations (Capability API 1.77) ──
//
// A ruleset that moves a sheet's values to new ids says how in `sheet.migrations`, and every read of a
// stored sheet applies them here: a pure function, so nothing is written by reading and a rewind, a
// branch, an import or a library sheet all read the same way. The next edit stores the new layout.
// Every step COPIES, so what a step read from stays where it was and an older version of the ruleset
// still reads the sheet as it always did. Live state's own step (`routeLive`) is applied where live
// state is read (live-state.ts).

/** The steps a sheet stored at version `v` still has to take, hop by hop in order. */
export function rulesetSheetMigrationSteps(definition: RulesetDefinition, v = 1): RulesetSheetMigrationStep[] {
  const version = definition.sheet.version;
  return [...(definition.sheet.migrations ?? [])]
    .filter((hop) => hop.from >= v && hop.from < version)
    .sort((a, b) => a.from - b.from)
    .flatMap((hop) => hop.steps);
}

/** Whether `phrase` is in `text` as whole words, ignoring case. Only letters join a word, so a level
 *  written straight after a class ("Fighter3") still names it. */
function namesPhrase(text: string, phrase: string): boolean {
  const escaped = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "iu").test(text);
}

/** A build stored at version `v`, as the current layout reads it. The same object when nothing moves. */
export function migrateRulesetSheetBuild(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  v: number,
): RulesetSheetBuild {
  const steps = rulesetSheetMigrationSteps(definition, v).filter((step) => !("routeLive" in step));
  if (steps.length === 0) return build;
  const next = structuredClone(build);
  const own = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key);
  const copy = <T>(record: Record<string, T>, from: string, to: string) => {
    if (own(record, from) && !own(record, to)) record[to] = record[from]!;
  };
  for (const step of steps) {
    if ("rename" in step) {
      if (step.rename === "field") copy(next.fields, step.from, step.to);
      else if (step.rename === "ability") copy(next.abilities, step.from, step.to);
      else {
        copy(step.rename === "skill" ? next.skills : next.saves, step.from, step.to);
        copy(next.bonuses, step.from, step.to);
      }
    } else if ("route" in step) {
      const value = own(next.fields, step.route) ? next.fields[step.route] : step.default;
      if (value === undefined) continue;
      const by = next.fields[step.by];
      const text = typeof by === "string" ? by : "";
      const named = new Set(
        step.cases.filter((entry) => entry.words.some((word) => namesPhrase(text, word))).map((entry) => entry.to),
      );
      // One class named is that class; none, or several ("Fighter 3 / Wizard 2"), is the fallback,
      // since one number cannot be split between them without asking.
      const target = named.size === 1 ? [...named][0]! : step.else;
      if (!own(next.fields, target)) next.fields[target] = value;
    }
  }
  return next;
}

/** A list row with its worked-out cells (Capability API 1.210) filled in: each the columns it names
 *  added up (an empty cell reads its column's default), held to its own bounds. Unchanged, and the
 *  same object, when the row already holds them. */
export function workOutRulesetListRow<Row extends Record<string, unknown>>(
  list: Pick<RulesetList, "columns">,
  row: Row,
): Row {
  let next: Row | undefined;
  for (const column of list.columns) {
    if (column.type !== "number" || !column.sum) continue;
    let total = 0;
    for (const id of column.sum) {
      const other = list.columns.find((each) => each.id === id);
      const value = (next ?? row)[id];
      total += finite(value) ?? (other?.type === "number" ? (other.default ?? 0) : 0);
    }
    let held = Math.min(column.max, Math.max(column.min, total));
    if (column.integer) held = Math.floor(held);
    if ((next ?? row)[column.id] !== held) next = { ...(next ?? row), [column.id]: held };
  }
  return next ?? row;
}

/** A build with every list's worked-out cells filled in; the same object when nothing changes. */
export function workOutRulesetListCells(definition: RulesetDefinition, build: RulesetSheetBuild): RulesetSheetBuild {
  let lists: RulesetSheetBuild["lists"] | undefined;
  for (const list of definition.sheet.lists) {
    if (!list.columns.some((column) => column.type === "number" && column.sum)) continue;
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const worked = rows.map((row) => (row && typeof row === "object" ? workOutRulesetListRow(list, row) : row));
    if (worked.some((row, index) => row !== rows[index])) lists = { ...(lists ?? build.lists), [list.id]: worked };
  }
  return lists ? { ...build, lists } : build;
}

/** A stored sheet as this version of its ruleset reads it, migrated to the current layout, or null
 *  when it is not a sheet at all. A sheet stored by a NEWER version is read as it stands. Worked-out
 *  list cells are filled in on every read, so nothing that reads a row sees a stale one. */
export function readRulesetSheetEnvelope(definition: RulesetDefinition, stored: unknown): RulesetSheetEnvelope | null {
  const parsed = rulesetSheetEnvelopeSchema.safeParse(stored);
  if (!parsed.success) return null;
  const { v, build } = parsed.data;
  if (v >= definition.sheet.version) {
    const worked = workOutRulesetListCells(definition, build);
    return worked === build ? parsed.data : { ...parsed.data, build: worked };
  }
  return {
    ...parsed.data,
    v: definition.sheet.version,
    build: workOutRulesetListCells(definition, migrateRulesetSheetBuild(definition, build, v)),
  };
}

/** The version a sheet written now is labelled with: this layout, never below what it already was. */
export function rulesetSheetStamp(definition: RulesetDefinition, stored?: { v?: unknown } | null): number {
  const before = typeof stored?.v === "number" && Number.isInteger(stored.v) ? stored.v : 0;
  return Math.max(before, definition.sheet.version);
}

export interface EvaluatedRulesetSheet {
  abilityScores: Record<string, number>;
  abilityMods: Record<string, number>;
  proficiencyBonus: number;
  /** Proficiency tier id per skill and per save, defaulted to the ruleset's first tier. */
  skillTiers: Record<string, string>;
  saveTiers: Record<string, string>;
  skillMods: Record<string, number>;
  saveMods: Record<string, number>;
  derived: Record<string, number>;
  /** Number fields as read (default applied), which value references resolve against. */
  numbers: Record<string, number>;
  /** The skills and saves a `cap` holds down: the cap in force and the number before it. `skillMods`
   *  and `saveMods` already hold the capped number; a `with=` swap works from the uncapped one and
   *  caps again, so swapping an ability can never lift a check past its cap. */
  skillCaps: Record<string, { cap: number; uncapped: number }>;
  saveCaps: Record<string, { cap: number; uncapped: number }>;
  /** The live state this sheet was worked out with, so a reference resolved against it later (a
   *  modifier off the sheet, a spend's limit, a fight's defense) reads the same values. */
  live?: RulesetSheetLiveValues;
}

/** What a `liveTrack` or `livePool` reference, or an enum table keyed on a live state, reads: one
 *  character's live state as `readRulesetLive` resolves it (a pool at its value, a track with its
 *  bounds and, on a wound track, the penalty in force, a state at its value). Described here rather
 *  than imported, so the arithmetic never depends on the live state's own module, which depends on
 *  it. A state the sheet hides is not in `states`. */
export interface RulesetSheetLiveValues {
  pools: ReadonlyArray<{ key: string; value: number }>;
  tracks: ReadonlyArray<{ id: string; min: number; max: number; value: number; wound?: { penalty: number } }>;
  states?: ReadonlyArray<{ id: string; value: string }>;
  /** The items the character holds, which an `itemStat` reads. None outside a game. */
  items?: ReadonlyArray<RulesetSheetItem>;
}

/** One stack of the ruleset's items a character holds, as the sheet reads it: what the item is, how
 *  many, and whether it is worn (on, and bound where it must be). */
export interface RulesetSheetItem {
  item: RulesetCatalogItem;
  quantity: number;
  worn: boolean;
  /** What the stack is called, for a record of what an item did. */
  name?: string;
  /** Which inventory stack this is, so what a fight shoots or loads can be written back to it. */
  stack?: { id: string; ref: string; holder?: string };
  /** What a weapon with a clip has loaded, as the stack keeps it. Absent reads as full. */
  loaded?: number;
  /** The charges an item holds, as the stack keeps them. Absent reads as full. */
  charges?: number;
  /** Its switch is on, as the stack keeps it (1.170). */
  on?: true;
  /** A fake (Capability API 1.79): what it truly is, which `item` passes for. The sheet reads it as
   *  what it seems; a fight's use of it does what this one does. */
  truly?: { item: RulesetCatalogItem; name: string };
}

/** Whether the sheet can read the items a character holds, so a caller can skip reading the
 *  inventory and the item catalogs when it cannot: only a ruleset with items has any, and then an
 *  `itemStat`, an item's abilities or a level off a derived value may read them. */
export function rulesetReadsItems(definition: RulesetDefinition): boolean {
  return definition.items !== undefined;
}

/** The item whose effects and stats a held item brings to the sheet: a fake's true item (1.79, the
 *  user's ruling: a worn or carried fake does what it truly does), else the item itself. */
export function rulesetHeldItemDoes(held: RulesetSheetItem): RulesetSheetItem["item"] {
  return held.truly?.item ?? held.item;
}

/** What a character's items do to their abilities: each ability's highest `set` and the sum of its
 *  `add`s, from each worn item's `worn` effect and each other item's `carried` one, one item once. */
function itemAbilityChanges(
  items: ReadonlyArray<RulesetSheetItem> | undefined,
): Map<string, { set?: number; add: number; topped: Array<{ add: number; max: number }> }> {
  const changes = new Map<string, { set?: number; add: number; topped: Array<{ add: number; max: number }> }>();
  const seen = new Set<unknown>();
  for (const held of items ?? []) {
    const does = rulesetHeldItemDoes(held);
    const effect = held.worn ? does.worn : does.carried;
    if (!effect?.abilities || seen.has(effect)) continue;
    seen.add(effect);
    for (const [id, change] of Object.entries(effect.abilities)) {
      const current = changes.get(id) ?? { add: 0, topped: [] };
      if ("set" in change) current.set = Math.max(current.set ?? change.set, change.set);
      // On top of the score sets leave, up to its most (1.313).
      else if (change.max !== undefined) current.topped.push({ add: change.add, max: change.max });
      else current.add += change.add;
      changes.set(id, current);
    }
  }
  return changes;
}

/** A stat over the items a character holds (`itemStat`). The items are picked by where they are and
 *  by slot, category and tag; `sum` adds each one's value times how many, `max` and `min` read one
 *  value, and `count` counts the items (only the ones that give the stat, when one is named). An item
 *  that does not give the stat is left out, and none at all reads the default. */
function readItemStat(
  items: ReadonlyArray<RulesetSheetItem> | undefined,
  spec: NonNullable<RulesetValueRef["itemStat"]>,
): number {
  const held = (items ?? []).filter(
    (each) =>
      (spec.from === "all" || (spec.from === "worn") === each.worn) &&
      (spec.slot === undefined || (rulesetHeldItemDoes(each).slots?.[spec.slot] ?? 0) > 0) &&
      (spec.category === undefined || rulesetHeldItemDoes(each).category === spec.category) &&
      (spec.tag === undefined || (rulesetHeldItemDoes(each).tags ?? []).includes(spec.tag)),
  );
  const given = (each: RulesetSheetItem) =>
    spec.stat === undefined ? undefined : rulesetHeldItemDoes(each).stats?.[spec.stat];
  if (spec.pick === "count") {
    const counted =
      spec.stat === undefined
        ? held
        : held.filter((each) => {
            const value = given(each);
            return value !== undefined && value !== false && value !== "";
          });
    return counted.length > 0 ? counted.reduce((total, each) => total + each.quantity, 0) : (spec.default ?? 0);
  }
  const numbers = held.flatMap((each) => {
    const value = given(each);
    return typeof value === "number" && Number.isFinite(value) ? [{ value, quantity: each.quantity }] : [];
  });
  if (numbers.length === 0) return spec.default ?? 0;
  if (spec.pick === "sum") return numbers.reduce((total, each) => total + each.value * each.quantity, 0);
  return (spec.pick === "max" ? Math.max : Math.min)(...numbers.map((each) => each.value));
}

export function rulesetAbilityModifier(definition: RulesetDefinition, score: number): number {
  const op = definition.resolution.abilityModifier;
  if (op.op === "identity") return score;
  if (op.op === "stepTable") return lookupStepTable(op.table, score);
  return Math.floor((score - 10) / 2);
}

/** The tables one value reference reads. Handed in rather than closed over, so the same resolution
 *  serves the evaluation below — where `derived` is still filling up, top to bottom — and a caller
 *  resolving a reference against a finished sheet. */
interface RulesetValueRefTables {
  abilityScores: Record<string, number>;
  abilityMods: Record<string, number>;
  numbers: Record<string, number>;
  derived: Record<string, number>;
  skillMod: (id: string) => number;
  saveMod: (id: string) => number;
  /** Absent where the sheet is worked out without a live state, and then a live read is 0. The
   *  format refuses one in every such place (a maximum, the proficiency bonus, a catalog's scaling). */
  live?: RulesetSheetLiveValues;
}

/** One number off a live track: where it stands, how far above its floor, how far below its top,
 *  or the penalty in force on a wound track. A track the character does not have reads 0. */
function readLiveTrack(live: RulesetSheetLiveValues | undefined, id: string, read: string): number {
  const track = live?.tracks.find((entry) => entry.id === id);
  if (!track) return 0;
  if (read === "filled") return track.value - track.min;
  if (read === "remaining") return track.max - track.value;
  if (read === "penalty") return track.wound?.penalty ?? 0;
  return track.value;
}

/** One number column of a list added up over its rows, only the rows a boolean column marks where
 *  `onlyWhen` names one. An empty cell reads as its column's default, and a list the sheet hides
 *  is not on it, so it adds nothing. */
function sumListColumn(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  sum: NonNullable<RulesetValueRef["listSum"]>,
): number {
  const list = definition.sheet.lists.find((entry) => entry.id === sum.list);
  const rows = build.lists?.[sum.list];
  if (!list || !Array.isArray(rows) || isRulesetItemHidden(list, build, definition)) return 0;
  const column = sum.column === undefined ? undefined : list.columns.find((entry) => entry.id === sum.column);
  const keyed = sum.where === undefined ? undefined : list.columns.find((entry) => entry.id === sum.where!.column);
  const marker = sum.onlyWhen === undefined ? undefined : list.columns.find((entry) => entry.id === sum.onlyWhen);
  const cell = (row: unknown, id: string) =>
    row && typeof row === "object" && Object.prototype.hasOwnProperty.call(row, id)
      ? (row as Record<string, unknown>)[id]
      : undefined;
  let total = 0;
  for (const row of rows) {
    if (marker && (cell(row, marker.id) ?? marker.default) !== true) continue;
    if (keyed && (cell(row, keyed.id) ?? keyed.default) !== sum.where!.equals) continue;
    if (sum.count) {
      total += 1;
      continue;
    }
    const value = cell(row, sum.column!);
    total += finite(value) ?? (column?.type === "number" ? (column.default ?? 0) : 0);
  }
  return total;
}

function resolveValueRef(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  ref: RulesetValueRef,
  tables: RulesetValueRefTables,
): number {
  if (ref.const !== undefined) return ref.const;
  if (ref.field !== undefined) return tables.numbers[ref.field] ?? 0;
  if (ref.derived !== undefined) return tables.derived[ref.derived] ?? 0;
  if (ref.abilityScore !== undefined) return tables.abilityScores[ref.abilityScore] ?? 0;
  if (ref.abilityMod !== undefined) return tables.abilityMods[ref.abilityMod] ?? 0;
  if (ref.abilityModFromField !== undefined) {
    // An unset choice reads as the field's declared default, like every other field. So does a
    // stored choice the ruleset no longer offers, which is also what the sheet editor shows.
    const field = definition.sheet.fields.find((entry) => entry.id === ref.abilityModFromField);
    const stored = build.fields?.[ref.abilityModFromField];
    const offered = typeof stored === "string" && field?.type === "enum" && field.values.includes(stored);
    const chosen = offered ? stored : field?.default;
    return typeof chosen === "string" ? (tables.abilityMods[chosen] ?? 0) : 0;
  }
  if (ref.skillMod !== undefined) return tables.skillMod(ref.skillMod);
  if (ref.saveMod !== undefined) return tables.saveMod(ref.saveMod);
  if (ref.liveTrack !== undefined) return readLiveTrack(tables.live, ref.liveTrack, ref.read ?? "value");
  if (ref.livePool !== undefined) return tables.live?.pools.find((pool) => pool.key === ref.livePool)?.value ?? 0;
  if (ref.listSum !== undefined) return sumListColumn(definition, build, ref.listSum);
  if (ref.itemStat !== undefined) return readItemStat(tables.live?.items, ref.itemStat);
  return 0;
}

/** What a check on this skill or save does when the character has no training in it: its own rule,
 *  else its section's, else the ordinary one. */
export function rulesetUntrainedRule(
  definition: RulesetDefinition,
  entry: { section?: string; untrained?: RulesetUntrained },
): RulesetUntrained {
  if (entry.untrained !== undefined) return entry.untrained;
  const section = entry.section
    ? definition.sheet.sections.find((candidate) => candidate.id === entry.section)
    : undefined;
  return section?.untrained ?? "normal";
}

/** Abilities, skills or saves under the section headings they sit in: the sheet's sections in their
 *  own order, then the ones that name none under no heading. When nothing names a section there is
 *  one group with no heading, so a sheet with no sections reads exactly as it always has. */
export function rulesetSectionGroups<T extends { section?: string }>(
  definition: RulesetDefinition,
  entries: readonly T[],
): Array<{ section: { id: string; label: string } | null; entries: T[] }> {
  if (!entries.some((entry) => entry.section))
    return entries.length > 0 ? [{ section: null, entries: [...entries] }] : [];
  const groups = definition.sheet.sections
    .map((section) => ({
      section: { id: section.id, label: section.label },
      entries: entries.filter((entry) => entry.section === section.id),
    }))
    .filter((group) => group.entries.length > 0);
  const known = new Set(definition.sheet.sections.map((section) => section.id));
  const loose = entries.filter((entry) => !entry.section || !known.has(entry.section));
  return loose.length > 0 ? [...groups, { section: null, entries: loose }] : groups;
}

/** Every number the sheet yields, computed once, top to bottom. `live` is what a live track or pool
 *  reads; without it they read 0, which is right only where the format refuses them (a maximum, the
 *  proficiency bonus, a catalog's scaling). Anything a player or the Game Master sees, and anything a
 *  check or a fight reads, goes through `evaluateRulesetSheetLive`, which supplies it. Without `live`,
 *  inside `withRulesetSheetEvaluationCache`, a build already evaluated comes back as it was. */
export function evaluateRulesetSheet(
  definition: RulesetDefinition,
  stored: RulesetSheetBuild,
  live?: RulesetSheetLiveValues,
): EvaluatedRulesetSheet {
  if (live !== undefined || !scopedEvaluations) return evaluateRulesetSheetUncached(definition, stored, live);
  let byBuild = scopedEvaluations.get(definition);
  if (!byBuild) scopedEvaluations.set(definition, (byBuild = new WeakMap()));
  const known = byBuild.get(stored);
  if (known) return known;
  const evaluated = evaluateRulesetSheetUncached(definition, stored);
  byBuild.set(stored, evaluated);
  return evaluated;
}

/** The live-less evaluations of the open scope, by definition and build, or null outside one. */
let scopedEvaluations: WeakMap<RulesetDefinition, WeakMap<RulesetSheetBuild, EvaluatedRulesetSheet>> | null = null;

/**
 * Runs `run` (synchronous) with every live-less sheet evaluation remembered by the identity of its
 * definition and build, and forgets them all when it ends; a scope opened inside another uses the
 * outer one. A fight option or picker loop reads the same sheet thousands of times in one command.
 * Sound only while nothing writes to a build after it has been evaluated, so inside a scope a build
 * is evaluated only after its last write: a clone is edited first, then read. A `run` that returns a
 * promise throws.
 */
export function withRulesetSheetEvaluationCache<T>(run: () => T): T {
  if (scopedEvaluations) return synchronous(run());
  scopedEvaluations = new WeakMap();
  try {
    return synchronous(run());
  } finally {
    scopedEvaluations = null;
  }
}

/** A promise would be awaited after the scope has closed, so its reads would go uncached, or into
 *  another command's scope. */
function synchronous<T>(result: T): T {
  if (typeof (result as { then?: unknown } | null | undefined)?.then === "function") {
    throw new TypeError("withRulesetSheetEvaluationCache takes synchronous work only.");
  }
  return result;
}

function evaluateRulesetSheetUncached(
  definition: RulesetDefinition,
  stored: RulesetSheetBuild,
  live?: RulesetSheetLiveValues,
): EvaluatedRulesetSheet {
  const { sheet, resolution } = definition;
  // A draft row not yet read back through the envelope still counts its worked-out cells (1.210).
  const build = workOutRulesetListCells(definition, stored);
  const abilityScores: Record<string, number> = {};
  const abilityMods: Record<string, number> = {};
  // What the character's items do to their abilities comes first, so everything reads the changed one:
  // a `set` is a floor a higher score keeps, the `add`s go on top, and the ability's own range holds.
  const fromItems = itemAbilityChanges(live?.items);
  for (const ability of sheet.abilities) {
    const base = finite(build.abilities?.[ability.id]) ?? ability.default;
    const change = fromItems.get(ability.id);
    let score = change
      ? Math.min(ability.max, Math.max(ability.min, Math.max(base + change.add, change.set ?? -Infinity)))
      : base;
    // An add with a most goes on top of that, never past its most, nor lowering a score above it (1.313).
    for (const top of change?.topped ?? []) {
      score = Math.max(score, Math.min(score + top.add, top.max, ability.max));
    }
    abilityScores[ability.id] = score;
    abilityMods[ability.id] = rulesetAbilityModifier(definition, score);
  }

  const numbers: Record<string, number> = {};
  for (const field of sheet.fields) {
    if (field.type !== "number") continue;
    numbers[field.id] =
      finite(build.fields?.[field.id]) ?? field.default ?? Math.min(Math.max(0, field.min), field.max);
  }

  const derived: Record<string, number> = {};
  const skillMods: Record<string, number> = {};
  const saveMods: Record<string, number> = {};
  const tierById = new Map(resolution.proficiencyTiers.map((tier) => [tier.id, tier]));
  const firstTier = resolution.proficiencyTiers[0]!;

  // Validation guarantees the value feeding the proficiency bonus never reads a skill or save
  // modifier, so resolving it lazily, the first time a modifier is asked for, cannot recurse.
  let proficiencyBonus: number | null = null;
  const readProficiencyBonus = (): number => {
    if (proficiencyBonus === null) {
      proficiencyBonus = 0; // a malformed definition that does recurse reads 0 instead of overflowing
      proficiencyBonus = resolution.proficiency ? resolveRef(resolution.proficiency.bonus) : 0;
    }
    return proficiencyBonus;
  };
  const skillCaps: Record<string, { cap: number; uncapped: number }> = {};
  const saveCaps: Record<string, { cap: number; uncapped: number }> = {};
  // A cap reads no skill or save, and neither does any derived value up to the one it reads (both
  // refused at import), so working it out here, whenever a modifier is first asked for, cannot loop.
  const trainedModifier = (
    entry: { id: string; ability?: string; cap?: RulesetValueRef; section?: string; untrained?: RulesetUntrained },
    tiers: Record<string, string> | undefined,
    caps: Record<string, { cap: number; uncapped: number }>,
  ): number => {
    const tier = tierById.get(tiers?.[entry.id] ?? "") ?? firstTier;
    const trained = roundRulesetNumber(tier.multiplier * readProficiencyBonus(), tier.round) + tier.flat;
    // Untrained, the ruleset may add to or take from the number itself, before any cap holds it.
    const rule = tier.id === firstTier.id ? rulesetUntrainedRule(definition, entry) : "normal";
    const untrainedBy = typeof rule === "object" ? rule.by : 0;
    const uncapped =
      (entry.ability ? (abilityMods[entry.ability] ?? 0) : 0) +
      trained +
      (finite(build.bonuses?.[entry.id]) ?? 0) +
      untrainedBy;
    if (!entry.cap) return uncapped;
    const cap = Math.floor(resolveRef(entry.cap));
    caps[entry.id] = { cap, uncapped };
    return Math.min(uncapped, cap);
  };
  function resolveRef(ref: RulesetValueRef): number {
    return resolveValueRef(definition, build, ref, {
      abilityScores,
      abilityMods,
      numbers,
      derived,
      skillMod: (id) => {
        const skill = sheet.skills.find((entry) => entry.id === id);
        return skill ? trainedModifier(skill, build.skills, skillCaps) : 0;
      },
      saveMod: (id) => {
        const save = sheet.saves.find((entry) => entry.id === id);
        return save ? trainedModifier(save, build.saves, saveCaps) : 0;
      },
      live,
    });
  }

  const workOutDerived = () => {
    for (const entry of sheet.derived) {
      if (entry.op === "sum") derived[entry.id] = entry.of.reduce((total, ref) => total + resolveRef(ref), 0);
      else if (entry.op === "stepTable") derived[entry.id] = lookupStepTable(entry.table, resolveRef(entry.from));
      else if (entry.op === "scale") {
        derived[entry.id] = roundRulesetNumber(resolveRef(entry.of) * entry.multiplier, entry.round);
      } else if (entry.op === "multiply")
        derived[entry.id] = entry.of.reduce((total, ref) => total * resolveRef(ref), 1);
      else if (entry.op === "min") derived[entry.id] = Math.min(...entry.of.map(resolveRef));
      else if (entry.op === "enumTable") {
        // The value it is keyed on: a field as the sheet shows it, or a live state as it stands. With no
        // live state at all (only where the format refuses such a read) there is no value to key on.
        const key =
          entry.from.field !== undefined
            ? effectiveFieldValue(definition, build, entry.from.field)
            : live?.states?.find((state) => state.id === entry.from.liveState)?.value;
        derived[entry.id] =
          typeof key === "string" && Object.prototype.hasOwnProperty.call(entry.table, key)
            ? entry.table[key]!
            : entry.default;
      } else derived[entry.id] = Math.max(...entry.of.map(resolveRef));
    }
  };
  workOutDerived();

  // Worked-out scores (1.156), once everything they may read is: what is stored for one is ignored.
  // None reads another, so one pass finds them all; what read them is then worked out again.
  let workedOut = false;
  for (const ability of sheet.abilities) {
    if (!ability.value) continue;
    workedOut = true;
    const base = Math.floor(ability.value.reduce((total, ref) => total + resolveRef(ref), 0));
    const change = fromItems.get(ability.id);
    const score = Math.min(
      ability.max,
      Math.max(ability.min, change ? Math.max(base + change.add, change.set ?? -Infinity) : base),
    );
    abilityScores[ability.id] = Number.isFinite(score) ? score : ability.default;
    abilityMods[ability.id] = rulesetAbilityModifier(definition, abilityScores[ability.id]!);
  }
  if (workedOut) {
    proficiencyBonus = null;
    for (const id of Object.keys(skillCaps)) delete skillCaps[id];
    for (const id of Object.keys(saveCaps)) delete saveCaps[id];
    workOutDerived();
  }

  const skillTiers: Record<string, string> = {};
  const saveTiers: Record<string, string> = {};
  for (const skill of sheet.skills) {
    skillTiers[skill.id] = tierById.has(build.skills?.[skill.id] ?? "") ? build.skills[skill.id]! : firstTier.id;
    skillMods[skill.id] = trainedModifier(skill, build.skills, skillCaps);
  }
  for (const save of sheet.saves) {
    saveTiers[save.id] = tierById.has(build.saves?.[save.id] ?? "") ? build.saves[save.id]! : firstTier.id;
    saveMods[save.id] = trainedModifier(save, build.saves, saveCaps);
  }
  // A row that is a check of its own (1.161): its rating, with its ability the way a skill adds one.
  for (const row of rulesetRowChecks(definition, build))
    skillMods[row.key] = (row.ability ? (abilityMods[row.ability] ?? 0) : 0) + row.rating;

  return {
    abilityScores,
    abilityMods,
    proficiencyBonus: readProficiencyBonus(),
    skillTiers,
    saveTiers,
    skillMods,
    saveMods,
    derived,
    numbers,
    skillCaps,
    saveCaps,
    ...(live ? { live } : {}),
  };
}

/** One value reference resolved against a sheet, for a reader outside the evaluation — a live
 *  pool's maximum is the only one today. Takes an evaluation when the caller already has one, so
 *  resolving a party's worth of pool maximums evaluates each sheet once. */
export function resolveRulesetValueRef(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  ref: RulesetValueRef,
  evaluated: EvaluatedRulesetSheet = evaluateRulesetSheet(definition, build),
): number {
  return resolveValueRef(definition, build, ref, {
    abilityScores: evaluated.abilityScores,
    abilityMods: evaluated.abilityMods,
    numbers: evaluated.numbers,
    derived: evaluated.derived,
    skillMod: (id) => evaluated.skillMods[id] ?? 0,
    saveMod: (id) => evaluated.saveMods[id] ?? 0,
    live: evaluated.live,
  });
}

/** The value a field holds as the sheet editor shows it: what is stored, else the value a blank sheet
 *  starts with; an enum value the ruleset no longer offers reads as the field's default, as it does
 *  everywhere the sheet is worked out. A rule that hides by the field then reads what the player sees. */
function effectiveFieldValue(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  id: string,
): string | number | boolean | undefined {
  const field = definition.sheet.fields.find((entry) => entry.id === id);
  const stored = build.fields?.[id];
  if (!field) return stored;
  if (field.type === "enum") {
    return typeof stored === "string" && field.values.includes(stored) ? stored : (field.default ?? field.values[0]);
  }
  return stored ?? defaultRulesetSheetBuild(definition).fields[id];
}

/** Whether a field, derived value, list, pool or track is hidden by its `hideWhen`: the field
 *  holds that one value, holds anything but it, or holds one of a few. */
export function isRulesetItemHidden(
  item: { hideWhen?: RulesetHideWhen },
  build: RulesetSheetBuild,
  definition: RulesetDefinition,
): boolean {
  const hide = item.hideWhen;
  if (!hide) return false;
  const value = effectiveFieldValue(definition, build, hide.field);
  if (hide.in) return value !== undefined && hide.in.includes(value);
  if (hide.notEquals !== undefined) return value !== hide.notEquals;
  return value === hide.equals;
}

// ── Checks ──

/** A skill or save also carries the ability it normally rolls with, and the one a `with=` asked
 *  for instead, so the modifier can swap the first for the second without re-reading the sheet. */
interface RulesetTrainedCheckTarget {
  type: "skill" | "save";
  id: string;
  label: string;
  /** The entry's own ability, when it names one. */
  ability?: string;
  /** The ability the request named instead. Only ever an ability this sheet declares. */
  withAbility?: string;
  /** A row of a list that is a check of its own (1.161), rather than a skill the sheet declares. */
  row?: true;
}

/** A raw ability check. `withAbility` is the second ability a pool ruleset with
 *  `pool.abilityPlusAbility` adds to it, and is never set anywhere else. */
interface RulesetAbilityCheckTarget {
  type: "ability";
  id: string;
  label: string;
  withAbility?: string;
}

export type RulesetCheckTarget = RulesetTrainedCheckTarget | RulesetAbilityCheckTarget;

function normalizeCheckName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The spellings one sheet entry answers to: its id, its label and its short form. */
function checkNames(entry: { id: string; label: string; short?: string }): string[] {
  return [
    normalizeCheckName(entry.id),
    normalizeCheckName(entry.label),
    entry.short ? normalizeCheckName(entry.short) : "",
  ].filter(Boolean);
}

/** One row of a list that is a check of its own (Capability API 1.161). */
export interface RulesetRowCheck {
  /** Where the evaluated sheet keeps its number, among the skills'. */
  key: string;
  list: string;
  check: string;
  /** The row's name, with the check's label after it when the list has one. */
  label: string;
  ability?: string;
  rating: number;
}

/** Every row check the sheet has. A name two rows share is no check at all: it is left out rather
 *  than guessed at, and renaming one of them makes both addressable again. */
export function rulesetRowChecks(definition: RulesetDefinition, build: RulesetSheetBuild): RulesetRowCheck[] {
  const found: RulesetRowCheck[] = [];
  for (const list of definition.sheet.lists) {
    if (!list.checks) continue;
    const rows = Array.isArray(build.lists?.[list.id]) ? build.lists[list.id]! : [];
    for (const check of list.checks) {
      const named = new Map<string, RulesetRowCheck[]>();
      for (const row of rows) {
        const raw = row?.[check.name];
        const name = typeof raw === "string" ? raw.trim() : "";
        if (!name) continue;
        const label = check.label ? `${name} (${check.label})` : name;
        const key = `row:${list.id}:${check.id}:${normalizeCheckName(name)}`;
        const rating = finite(row[check.rating]) ?? 0;
        const entry: RulesetRowCheck = {
          key,
          list: list.id,
          check: check.id,
          label,
          rating,
          ...(check.ability ? { ability: check.ability } : {}),
        };
        named.set(key, [...(named.get(key) ?? []), entry]);
      }
      for (const entries of named.values()) if (entries.length === 1) found.push(entries[0]!);
    }
  }
  return found;
}

/** The stance a check is in (1.137): a skill a stance names, or a row check whose list puts its
 *  rows in one (1.212). */
export function rulesetCheckStance(
  definition: RulesetDefinition,
  checkId: string,
): { id: string; label: string; count: "below" | "above" } | undefined {
  const { resolution } = definition;
  if (resolution.kind !== "dice-pool" || !resolution.stances) return undefined;
  const named = resolution.stances.find((entry) => entry.skills.includes(checkId));
  if (named) return named;
  const row = /^row:([^:]+):([^:]+):/.exec(checkId);
  if (!row) return undefined;
  const check = definition.sheet.lists.find((list) => list.id === row[1])?.checks?.find((each) => each.id === row[2]);
  return check?.stance ? resolution.stances.find((entry) => entry.id === check.stance) : undefined;
}

/** The ability a name means in this ruleset, or null. Used for `with=`, which is a bare ability
 *  name rather than a check request. */
function matchAbilityId(definition: RulesetDefinition, requested: string): string | null {
  const name = normalizeCheckName(requested);
  if (!name) return null;
  const base = name.replace(/\s(?:ability check|check|saving throw|save)$/, "").trim();
  const ability = definition.sheet.abilities.find(
    (entry) => checkNames(entry).includes(name) || checkNames(entry).includes(base),
  );
  return ability?.id ?? null;
}

/** What a requested check name means in this ruleset: a skill, a save, or a raw ability check.
 *  Matches ids and labels, with "check", "save" and "saving throw" suffixes understood, so
 *  "Dexterity save", "dex_save" and "DEX saving throw" are one request. Null when the ruleset has
 *  no such thing; the caller then rolls unmodified dice rather than guessing an ability.
 *
 *  `withAbility` is the tag's `with=`: roll this skill or save with another ability than its own.
 *  A name no ability answers to is IGNORED rather than refused, so the entry keeps its own
 *  ability; the resolver notices the unset `withAbility` and says so in the log. On a raw ability
 *  check it names a SECOND ability to add, and only where a pool ruleset declares
 *  `pool.abilityPlusAbility`; anywhere else it means nothing there, because the check already
 *  names the ability it rolls. */
export function matchRulesetCheckTarget(
  definition: RulesetDefinition,
  requested: string,
  withAbility?: string,
  /** The roller's sheet, whose list rows may be checks of their own (1.161). */
  build?: RulesetSheetBuild,
): RulesetCheckTarget | null {
  const { sheet } = definition;
  const name = normalizeCheckName(requested);
  if (!name) return null;
  const saveWord = /\s(?:saving throw|save)$/.test(name);
  const base = name.replace(/\s(?:ability check|check|saving throw|save)$/, "").trim();
  const names = checkNames;
  const override = withAbility ? matchAbilityId(definition, withAbility) : null;
  const trained = (type: "skill" | "save", entry: { id: string; label: string; ability?: string }) => ({
    type,
    id: entry.id,
    label: entry.label,
    ...(entry.ability ? { ability: entry.ability } : {}),
    ...(override ? { withAbility: override } : {}),
  });

  const save = sheet.saves.find((entry) => names(entry).includes(name));
  if (save) return trained("save", save);
  if (saveWord) {
    // "<ability> save": the save that rolls with that ability, when exactly one does.
    const ability = sheet.abilities.find((entry) => names(entry).includes(base));
    const forAbility = ability ? sheet.saves.filter((entry) => entry.ability === ability.id) : [];
    if (forAbility.length === 1) return trained("save", forAbility[0]!);
    const byBase = sheet.saves.find((entry) => names(entry).includes(base));
    if (byBase) return trained("save", byBase);
    return null;
  }
  const skill = sheet.skills.find((entry) => names(entry).includes(name) || names(entry).includes(base));
  if (skill) return trained("skill", skill);
  if (build) {
    const rows = rulesetRowChecks(definition, build).filter((row) => {
      const spelled = normalizeCheckName(row.label);
      return spelled === name || spelled === base;
    });
    if (rows.length === 1)
      return { ...trained("skill", { id: rows[0]!.key, label: rows[0]!.label, ability: rows[0]!.ability }), row: true };
  }
  const ability = sheet.abilities.find((entry) => names(entry).includes(base));
  if (!ability) return null;
  const resolution = definition.resolution;
  const pairs = resolution.kind === "dice-pool" && resolution.pool.abilityPlusAbility === true;
  return {
    type: "ability",
    id: ability.id,
    label: ability.label,
    ...(pairs && override ? { withAbility: override } : {}),
  };
}

export function rulesetCheckModifier(evaluated: EvaluatedRulesetSheet, target: RulesetCheckTarget | null): number {
  if (!target) return 0;
  if (target.type === "ability") {
    // Two abilities rolled together are simply both of them.
    const second = target.withAbility ? (evaluated.abilityMods[target.withAbility] ?? 0) : 0;
    return (evaluated.abilityMods[target.id] ?? 0) + second;
  }
  const own = target.type === "skill" ? evaluated.skillMods[target.id] : evaluated.saveMods[target.id];
  const base = own ?? 0;
  if (!target.withAbility) return base;
  // `with=`: the entry's own ability modifier steps aside for the named one. The training tier and
  // the sheet's own free bonus are untouched, which is what makes this one number, not a new check.
  // A capped entry swaps on the number before its cap, and the cap then holds the result.
  const capped = (target.type === "skill" ? evaluated.skillCaps : evaluated.saveCaps)?.[target.id];
  const replaced = target.ability ? (evaluated.abilityMods[target.ability] ?? 0) : 0;
  const swapped = (capped ? capped.uncapped : base) - replaced + (evaluated.abilityMods[target.withAbility] ?? 0);
  return capped ? Math.min(swapped, capped.cap) : swapped;
}

/** The abilities a check rolls with: a skill or save's own, or the one `with=` swapped in; an ability
 *  check's own, and the second one where a pool adds two together. */
function rollingAbilities(target: RulesetCheckTarget | null): string[] {
  if (!target) return [];
  if (target.type === "ability") return target.withAbility ? [target.id, target.withAbility] : [target.id];
  const ability = target.withAbility ?? target.ability;
  return ability ? [ability] : [];
}

/** What `resolution.adjust` adds to or takes off this check: every entry that applies to all checks,
 *  and every one limited to abilities the check rolls with. Whole numbers, rounded toward zero, so a
 *  half never turns into a die. A check the ruleset cannot name still takes the unlimited ones, the
 *  way it still takes a wound penalty. */
export function rulesetCheckAdjust(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  target: RulesetCheckTarget | null,
): number {
  const entries = definition.resolution.adjust ?? [];
  if (entries.length === 0) return 0;
  const rolling = rollingAbilities(target);
  let total = 0;
  for (const entry of entries) {
    if (entry.abilities && !entry.abilities.some((id) => rolling.includes(id))) continue;
    total += resolveRulesetValueRef(definition, build, entry.value, evaluated);
  }
  return Math.trunc(total);
}

/** One check number, spelled the way its kind means it: a modifier added to the dice, or how many
 *  dice there are. Everywhere a check value is shown to a player or written into a prompt. */
export function formatRulesetCheckValue(definition: RulesetDefinition, value: number): string {
  // Against the sheet's number (1.139) the number is the target itself, so it carries no sign.
  if (definition.resolution.kind === "roll-against" || definition.resolution.kind === "symbol-pool") return `${value}`;
  if (definition.resolution.kind !== "dice-sum") return `${value} ${value === 1 ? "die" : "dice"}`;
  return value >= 0 ? `+${value}` : `${value}`;
}

export interface RulesetCheckRoll {
  /** Every die thrown, in order: one set normally, two sets under advantage or disadvantage. */
  rolls: number[];
  /** Sum of the set that was kept. */
  usedRoll: number;
  total: number;
  success: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
  rollMode: "advantage" | "disadvantage" | "normal";
  /** Notation for the dice actually thrown. */
  dice: string;
  /** The label of the outcome band the check landed in, where the ruleset declares bands (1.135). */
  outcome?: string;
  /** What each face of the die is worth, lowest first, where the ruleset gives faces (1.136). */
  faces?: number[];
  /** The single die's face, where the ruleset marks it as rolled unmodified (1.136). */
  unmodified?: number;
}

/** A check that threw nothing at all: the shape every "no roll happened" answer takes, so no path
 *  ever has to invent a die to have something to return. Built fresh each time, because a caller
 *  spreads it into a result it then owns. */
function noRoll(): RulesetCheckRoll {
  return {
    rolls: [],
    usedRoll: 0,
    total: 0,
    success: false,
    criticalSuccess: false,
    criticalFailure: false,
    rollMode: "normal",
    dice: "",
  };
}

/**
 * The band a check lands in (Capability API 1.135), and what it makes of the roll: success and the
 * two criticals come from the band, never from the bare comparison, so a ruleset with bands has one
 * answer. `measure` is the margin or the total the bands are read from, `natural` the kept face of a
 * single die (+1 its highest, -1 its lowest, 0 neither) where the bands shift on one, and `forced`
 * pins the best or the worst band whatever the measure says (a summed system's automatic success, a
 * pool's botch), keeping the critical it came from. Without bands the roll comes back as it was.
 */
export function applyRulesetCheckOutcome<T extends RulesetCheckRoll>(
  outcomes: RulesetResolution["outcomes"],
  roll: T,
  input: { margin: number; total: number; fraction?: number; natural?: -1 | 0 | 1; forced?: "best" | "worst" },
): T {
  if (!outcomes) return roll;
  // The bands the measure reads; a band `on` a critical is reached by that critical alone.
  const read = outcomes.tiers.filter((tier) => !tier.on);
  const measure =
    outcomes.by === "total" ? input.total : outcomes.by === "fraction" ? (input.fraction ?? 0) : input.margin;
  let index = read.findIndex((tier) => tier.atLeast === undefined || measure >= tier.atLeast);
  if (index < 0) index = read.length - 1;
  if (outcomes.naturals === "shift" && input.natural) index -= input.natural;
  if (input.forced === "best") index = 0;
  if (input.forced === "worst") index = read.length - 1;
  const onCritical =
    input.forced === "best"
      ? outcomes.tiers.find((tier) => tier.on === "critical-success")
      : input.forced === "worst"
        ? outcomes.tiers.find((tier) => tier.on === "critical-failure")
        : undefined;
  const tier = onCritical ?? read[Math.min(read.length - 1, Math.max(0, index))]!;
  // A forced end keeps the critical it came from: a botch is still a botch in a worst band that is not
  // marked critical, and an automatic success still a critical one.
  return {
    ...roll,
    success: tier.success,
    criticalSuccess: tier.success && (tier.critical || !!tier.on || input.forced === "best"),
    criticalFailure: !tier.success && (tier.critical || !!tier.on || input.forced === "worst"),
    outcome: tier.label,
  };
}

/** The most dice one open-ended roll throws, the first included: an Engine bound, so a chain ends. */
export const RULESET_OPEN_ENDED_MAX_ROLLS = 20;

/** Roll a `dice-sum` check. Advantage and disadvantage cancel, and are ignored entirely when the
 *  ruleset does not allow them. `preRolled` stands in for the dice when the player rolled first;
 *  it is honoured only for a single-die ruleset and only within the die's faces.
 *
 *  A ruleset of another kind has no dice to sum, so it comes back as a failure with no roll rather
 *  than borrowing a die this system does not have. Callers dispatch on `resolution.kind`. */
export function rollDiceSumCheck(
  definition: RulesetDefinition,
  input: {
    modifier: number;
    dc: number;
    isSave: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
    preRolled?: number;
  },
  rollDie: (sides: number) => number,
): RulesetCheckRoll {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-sum") return noRoll();
  const { dice, naturals, advantage: allowsAdvantage } = resolution;
  const single = dice.count === 1;
  const preRolled =
    single && Number.isInteger(input.preRolled) && input.preRolled! >= 1 && input.preRolled! <= dice.sides
      ? input.preRolled!
      : null;
  const useAdvantage = preRolled === null && allowsAdvantage && !!input.advantage && !input.disadvantage;
  const useDisadvantage = preRolled === null && allowsAdvantage && !!input.disadvantage && !input.advantage;

  // One set of dice and what it is worth (1.136): its faces' own values where the ruleset gives them,
  // and an open-ended die's chain, added on a high face and taken away on a low one. The faces are
  // recorded as thrown; the worth is what the set adds to the roll.
  const { faces, sides } = dice;
  const openEnded = dice.count === 1 ? resolution.openEnded : undefined;
  const faceWorth = (face: number) => (faces ? (faces[face - 1] ?? 0) : face);
  // A face the player rolled first (single die only) starts the set, and still opens its chain.
  const rollSet = (preset?: number): { thrown: number[]; worth: number } => {
    const thrown = preset === undefined ? Array.from({ length: dice.count }, () => rollDie(sides)) : [preset];
    let worth = thrown.reduce((total, face) => total + faceWorth(face), 0);
    if (openEnded) {
      const first = thrown[0]!;
      const sign =
        openEnded.high !== undefined && first >= openEnded.high
          ? 1
          : openEnded.low !== undefined && first <= openEnded.low
            ? -1
            : 0;
      // Chained while the new die shows a high face, under an Engine ceiling so a roll ends.
      let again = sign !== 0;
      while (again && thrown.length < RULESET_OPEN_ENDED_MAX_ROLLS) {
        const next = rollDie(sides);
        thrown.push(next);
        worth += sign * next;
        again = openEnded.high !== undefined && next >= openEnded.high;
      }
    }
    return { thrown, worth };
  };
  const first = rollSet(preRolled ?? undefined);
  const second = useAdvantage || useDisadvantage ? rollSet() : null;
  const kept = !second
    ? first
    : useAdvantage
      ? second.worth > first.worth
        ? second
        : first
      : second.worth < first.worth
        ? second
        : first;
  const usedRoll = kept.worth;
  const rolls = second ? [...first.thrown, ...second.thrown] : first.thrown;
  // The natural is the first face of the set that counted, before anything was added or rolled again.
  const natural = kept.thrown[0]!;

  const policy = input.isSave ? naturals.save : naturals.check;
  const criticalSuccess = single && natural === dice.sides && (policy === "both" || policy === "max-only");
  const criticalFailure = single && natural === 1 && (policy === "both" || policy === "min-only");
  const unmodified = single && resolution.unmodified?.includes(natural) ? natural : undefined;
  const total = usedRoll + input.modifier;

  const roll: RulesetCheckRoll = {
    rolls,
    usedRoll,
    total,
    success: criticalSuccess ? true : criticalFailure ? false : total >= input.dc,
    criticalSuccess,
    criticalFailure,
    rollMode: useAdvantage ? "advantage" : useDisadvantage ? "disadvantage" : "normal",
    dice: `${rolls.length}d${dice.sides}`,
    ...(faces ? { faces: [...faces] } : {}),
    ...(unmodified !== undefined ? { unmodified } : {}),
  };
  // Bands, where the ruleset declares them: a natural the policy makes automatic pins the best or the
  // worst band, and a natural the bands shift on moves one band either way.
  return applyRulesetCheckOutcome(resolution.outcomes, roll, {
    margin: total - input.dc,
    total,
    natural: single ? (natural === dice.sides ? 1 : natural === 1 ? -1 : 0) : 0,
    ...(criticalSuccess ? { forced: "best" as const } : criticalFailure ? { forced: "worst" as const } : {}),
  });
}

export interface RulesetPoolRoll extends RulesetCheckRoll {
  /** The per-die target the successes were counted with, so a reader can mark the dice that
   *  counted. It is the ruleset's default unless the request moved it inside the declared range. */
  threshold: number;
  /** The situational dice the roll actually added or took: the request's `bonus=` clamped into the
   *  ruleset's range, and 0 where the ruleset declares none. A record is written from this, never
   *  from what the tag asked for. */
  bonusDice: number;
  /** Successes a purchase added after the dice were counted, and 0 where nothing was bought. They
   *  are in `total` already; this is what lets a record say how many of them nobody rolled. */
  autoSuccesses: number;
  /** How many dice a bought re-throw actually replaced, so a record can say the pool was re-thrown
   *  rather than leaving a reader to wonder why the faces beat the odds. */
  rerolled: number;
  /** The faces this roll exploded and doubled from, after the ruleset's limits, or undefined where
   *  the rule was not in play. A reader compares them with the file's own `from` to say whether the
   *  check moved them. */
  explodeFrom?: number;
  doubleFrom?: number;
  /** Something went wrong on the side of a roll that did not botch outright: `botch.rule` is
   *  `halfOrMore` and low faces showed on half the dice or more, but a die still succeeded. */
  complication: boolean;
  /** Which way the dice counted, where a stance made them count below or above the target (1.137). */
  compare?: "below" | "above";
  /** How many dice showed exactly the target, where the ruleset names that face (1.137). */
  exact?: number;
}

/** The hard ceiling on how many dice ONE check may throw again, whatever a ruleset asks for. An
 *  Engine bound rather than an author's choice: an `until` re-throw is a loop, and a loop inside a
 *  turn needs an end that does not depend on the file. */
export const RULESET_POOL_MAX_REROLLS = 100;

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Roll a `dice-pool` check: throw the sheet's own number of dice and count the ones that reach
 *  the target. `total` and `usedRoll` are both the NET successes, so a reader that knows nothing
 *  about pools still shows the number the outcome turned on.
 *
 *  Never throws, and never rolls a die this ruleset did not declare. `threshold` and `bonusDice`
 *  are the Game Master's two per-check freedoms and are clamped into what the ruleset allows
 *  rather than refused, because a check the model asked for slightly wrong is still a check.
 *  A ruleset of another kind comes back as a failure with no roll. */
export function rollDicePoolCheck(
  definition: RulesetDefinition,
  input: {
    /** The sheet's number for this check, which here is how many dice to throw. */
    modifier: number;
    /** How many successes the check needs. */
    required: number;
    /** Taken so the two rollers answer the same question. No pool rule reads it today. */
    isSave: boolean;
    /** `threshold=`, honoured only where the ruleset lets the target move. */
    threshold?: number;
    /** The target the ruleset reads off the roller's sheet (`target.from`, 1.137), already worked out.
     *  It stands in for the default and for `threshold=`, held to the ruleset's range. */
    sheetTarget?: number;
    /** Which way this check's dice count (1.137): below or above the target, from the stance its
     *  skill is in. Absent is at or above. */
    stance?: "below" | "above";
    /** `bonus=`, honoured only where the ruleset declares situational dice. */
    bonusDice?: number;
    /** `explode=` and `double=`, honoured only where the ruleset gives that rule a `min`. */
    explode?: number;
    double?: number;
    /** What a purchase bought for this one check, already validated and paid for by the caller:
     *  dice thrown on top of the pool, successes added after the dice are counted, a per-die target
     *  for this one roll, and a re-throw of the low faces. The roller never decides whether a spend
     *  was allowed; it only applies what it is handed. */
    bought?: {
      dice?: number;
      successes?: number;
      threshold?: number;
      reroll?: { upTo: number; mode: "once" | "until" };
      explode?: number;
      double?: number;
      /** No face cancels a success on this roll (1.214). */
      cancel?: false;
    };
  },
  rollDie: (sides: number) => number,
): RulesetPoolRoll {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-pool") {
    return { ...noRoll(), threshold: 0, bonusDice: 0, autoSuccesses: 0, rerolled: 0, complication: false };
  }
  const { die, pool, target, double, explode, botch, exceptional, situationalDice } = resolution;
  const cancel = input.bought?.cancel === false ? undefined : resolution.cancel;

  // A bought threshold is the entry's own and outranks the Game Master's `threshold=`, because the
  // player paid for it. Both are clamped into what the ruleset allows, and a ruleset whose target
  // cannot move ignores both.
  // A target read off the sheet (1.137) is the character's own, so the Game Master's `threshold=` does
  // not move it; a bought one still does, because the player paid for it.
  const fromSheet = Number.isFinite(input.sheetTarget)
    ? clampInteger(input.sheetTarget!, target.min, target.max)
    : undefined;
  const asked = Number.isFinite(input.bought?.threshold)
    ? input.bought!.threshold!
    : fromSheet === undefined
      ? input.threshold
      : undefined;
  const threshold =
    target.min < target.max && Number.isFinite(asked)
      ? clampInteger(asked!, target.min, target.max)
      : (fromSheet ?? target.default);
  const bonusDice =
    situationalDice && Number.isFinite(input.bonusDice)
      ? clampInteger(input.bonusDice!, situationalDice.min, situationalDice.max)
      : 0;
  // The face each moving rule fires on for this one roll: what an entry bought, else what the Game
  // Master asked for, pulled into the range the ruleset gives it, and the file's own `from` when
  // nobody asked or the ruleset lets no check move it. Undefined is a rule that does not fire.
  const faceFor = (rule: typeof explode, bought: number | undefined, asked: number | undefined) => {
    if (!rule) return undefined;
    const wanted = Number.isFinite(bought) ? bought : asked;
    return rule.min !== undefined && Number.isFinite(wanted) ? clampInteger(wanted!, rule.min, die.sides) : rule.from;
  };
  const explodeFrom = faceFor(explode, input.bought?.explode, input.explode);
  const doubleFrom = faceFor(double, input.bought?.double, input.double);

  // Bought dice go in with the sheet's own and the situational ones, so the pool's declared range
  // is the one ceiling: buying dice can never throw more than the ruleset allows a pool to be.
  const boughtDice = Math.max(0, Math.floor(input.bought?.dice ?? 0));
  const count = clampInteger(
    (Number.isFinite(input.modifier) ? input.modifier : 0) + bonusDice + boughtDice,
    pool.min,
    pool.max,
  );
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(die.sides));

  // A re-throw of the low faces, bought by the character and applied BEFORE anything else reads the
  // pool, so a rerolled die can still explode, still count and still cancel. `once` replaces each
  // qualifying die one time and the new face stands whatever it is; `until` keeps going, bounded by
  // an Engine ceiling on the whole pool so a ruleset whose `upTo` is near the top face cannot roll
  // for the rest of the turn.
  let rerolled = 0;
  const reroll = input.bought?.reroll;
  if (reroll && reroll.upTo >= 1 && reroll.upTo < die.sides) {
    for (let i = 0; i < rolls.length && rerolled < RULESET_POOL_MAX_REROLLS; i++) {
      if (rolls[i]! > reroll.upTo) continue;
      rolls[i] = rollDie(die.sides);
      rerolled += 1;
      if (reroll.mode !== "until") continue;
      while (rolls[i]! <= reroll.upTo && rerolled < RULESET_POOL_MAX_REROLLS) {
        rolls[i] = rollDie(die.sides);
        rerolled += 1;
      }
    }
  }

  // The dice first thrown, re-throws included and explosions not yet added: what "half the dice" of a
  // botch is counted over.
  const thrown = rolls.slice();
  if (explodeFrom !== undefined) {
    // Chained, by walking the array as it grows: a die added at the end is itself examined. The
    // extra dice are capped so a low `from` on a big pool cannot roll for the rest of the turn.
    const cap = Math.min(pool.max, RULESET_POOL_MAX_DICE);
    let extra = 0;
    for (let i = 0; i < rolls.length && extra < cap; i++) {
      if (rolls[i]! >= explodeFrom) {
        rolls.push(rollDie(die.sides));
        extra += 1;
      }
    }
  }

  // Which faces count (1.137): at or above the target, or below or above it for a stance. A face
  // showing exactly the target is counted apart, and counts too where the ruleset says so.
  const stance = input.stance;
  const counts = (roll: number) =>
    stance === "below" ? roll < threshold : stance === "above" ? roll > threshold : roll >= threshold;
  let successes = 0;
  let cancelled = 0;
  let exact = 0;
  for (const roll of rolls) {
    if (resolution.exact && roll === threshold) {
      exact += 1;
      if (!counts(roll) && resolution.exact.counts) successes += 1;
    }
    if (counts(roll)) successes += doubleFrom !== undefined && roll >= doubleFrom ? 2 : 1;
    if (cancel && roll <= cancel.upTo) cancelled += 1;
  }
  // Bought successes are added after the dice are counted and after cancelling, because they were
  // never rolled: a die that cancels a success cannot cancel one nobody threw.
  const autoSuccesses = Math.max(0, Math.floor(input.bought?.successes ?? 0));
  const total = Math.max(0, successes - cancelled) + autoSuccesses;
  // A botch is "nothing worked AND something went wrong", read BEFORE cancelling: a pool whose one
  // success was cancelled away failed, it did not botch. A bought success is not a die that worked,
  // so it does not take a botch away either; it is added to a total that is already 0.
  //
  // `halfOrMore` reads it the other way round: low faces on at least half the dice first thrown are
  // the thing going wrong, and it is a critical failure only when no die succeeded as well. On a
  // roll a die DID succeed on, the result stands as it is and the roll says it went wrong on the side.
  const lowOnHalf =
    botch?.rule === "halfOrMore" &&
    thrown.length > 0 &&
    thrown.filter((roll) => roll <= botch.upTo).length >= Math.ceil(thrown.length / 2);
  const criticalFailure = !botch
    ? false
    : botch.rule === "halfOrMore"
      ? lowOnHalf && successes === 0
      : successes === 0 && rolls.some((roll) => roll <= botch.upTo);
  const complication = lowOnHalf && !criticalFailure;
  const success = !criticalFailure && total >= input.required;
  const roll: RulesetPoolRoll = {
    rolls,
    usedRoll: total,
    total,
    success,
    criticalSuccess: success && !!exceptional && total >= exceptional.successes,
    criticalFailure,
    rollMode: "normal",
    dice: `${rolls.length}d${die.sides}`,
    threshold,
    bonusDice,
    autoSuccesses,
    rerolled,
    ...(explodeFrom !== undefined ? { explodeFrom } : {}),
    ...(doubleFrom !== undefined ? { doubleFrom } : {}),
    complication,
    ...(stance ? { compare: stance } : {}),
    ...(resolution.exact ? { exact } : {}),
  };
  // Bands, where the ruleset declares them, read from the net successes; a botch is the worst band.
  return applyRulesetCheckOutcome(resolution.outcomes, roll, {
    margin: total - input.required,
    total,
    ...(criticalFailure ? { forced: "worst" as const } : {}),
  });
}

/** A `dice-highest` check's roll (1.138): the light dice and then the dark ones, in `rolls`. */
export interface RulesetHighestRoll extends RulesetCheckRoll {
  /** How many of `rolls`, at the end, are dark dice. */
  dark: number;
  /** A dark die strictly beat every light die. */
  darkHighest: boolean;
  /** No dice: two were thrown and the lower kept. */
  zero: boolean;
  bonusDice: number;
}

/** Roll a `dice-highest` check: throw the sheet's number of dice (and any dark dice), keep the
 *  highest (or the sum of the `keep` highest), and meet the difficulty. With no dice at all, two are
 *  thrown and the lower is kept, which can never be a critical, or the check fails unrolled. */
export function rollDiceHighestCheck(
  definition: RulesetDefinition,
  input: {
    /** The sheet's number for this check: how many dice. */
    modifier: number;
    /** What the kept dice must reach. */
    dc: number;
    isSave: boolean;
    /** `bonus=`, honoured only where the ruleset declares situational dice. */
    bonusDice?: number;
    /** `dark=`, honoured only where the ruleset has dark dice, held to their `max`. */
    dark?: number;
    /** Dice a spend bought on top of the pool. */
    bought?: { dice?: number };
  },
  rollDie: (sides: number) => number,
): RulesetHighestRoll {
  const resolution = definition.resolution;
  const nothing = { dark: 0, darkHighest: false, zero: false, bonusDice: 0 };
  if (resolution.kind !== "dice-highest") return { ...noRoll(), ...nothing };
  const { die, pool, keep, situationalDice } = resolution;
  const sides = die.sides;
  const bonusDice =
    situationalDice && Number.isFinite(input.bonusDice)
      ? clampInteger(input.bonusDice!, situationalDice.min, situationalDice.max)
      : 0;
  const bought = Number.isFinite(input.bought?.dice) ? Math.max(0, Math.round(input.bought!.dice!)) : 0;
  const light = clampInteger(Math.round(input.modifier) + bonusDice, pool.min, pool.max) + bought;
  const darkCount =
    resolution.dark && Number.isFinite(input.dark) ? clampInteger(input.dark!, 0, resolution.dark.max) : 0;
  const dc = Math.round(input.dc);

  const lightOnly = resolution.dark?.outcome === "light";
  const empty = light + (lightOnly ? 0 : darkCount) === 0;
  const zero = empty && resolution.zeroDice === "lowest-of-two";
  const lightRolls = Array.from({ length: zero ? 2 : light }, () => rollDie(sides));
  const darkRolls = Array.from({ length: darkCount }, () => rollDie(sides));
  const all = [...lightRolls, ...darkRolls];
  const outcomeRolls = lightOnly ? lightRolls : all;
  const kept = zero ? [Math.min(...lightRolls)] : [...outcomeRolls].sort((a, b) => b - a).slice(0, keep);
  const total = kept.reduce((sum, face) => sum + face, 0);
  const critFace = resolution.critical?.face ?? sides;
  const critical =
    !empty &&
    !!resolution.critical &&
    outcomeRolls.filter((face) => face >= critFace).length >= resolution.critical.count;
  const darkHighest = darkCount > 0 && Math.max(...darkRolls) > (lightRolls.length > 0 ? Math.max(...lightRolls) : 0);
  if (empty && !zero) {
    const failed = {
      ...noRoll(),
      ...nothing,
      rolls: all,
      dark: darkCount,
      darkHighest,
      bonusDice,
      dice: `${all.length}d${sides}`,
    };
    return applyRulesetCheckOutcome(resolution.outcomes, failed, { margin: -dc, total: 0, forced: "worst" });
  }
  const success = critical || total >= dc;
  const roll: RulesetHighestRoll = {
    rolls: all,
    usedRoll: total,
    total,
    success,
    criticalSuccess: critical,
    criticalFailure: false,
    rollMode: "normal",
    dice: `${all.length}d${sides}`,
    dark: darkCount,
    darkHighest,
    zero,
    bonusDice,
  };
  return applyRulesetCheckOutcome(resolution.outcomes, roll, {
    margin: total - dc,
    total,
    ...(critical ? { forced: "best" as const } : {}),
  });
}

/** A symbol pool's characteristic and training rank, kept separate before dice are upgraded.
 *  The existing tier math supplies rank; free bonuses and untrained adjustments stay situational. */
export function rulesetSymbolPoolRatings(
  definition: RulesetDefinition,
  evaluated: EvaluatedRulesetSheet,
  target: RulesetCheckTarget | null,
): { ability: number; rank: number; bonusDice: number } {
  if (!target) return { ability: 0, rank: 0, bonusDice: 0 };
  const abilityId = target.type === "ability" ? target.id : (target.withAbility ?? target.ability);
  const ability = abilityId ? (evaluated.abilityMods[abilityId] ?? 0) : 0;
  const tierId =
    target.type === "skill"
      ? evaluated.skillTiers[target.id]
      : target.type === "save"
        ? evaluated.saveTiers[target.id]
        : undefined;
  const tier = tierId ? definition.resolution.proficiencyTiers.find((entry) => entry.id === tierId) : undefined;
  const rank = tier ? roundRulesetNumber(tier.multiplier * evaluated.proficiencyBonus, tier.round) + tier.flat : 0;
  return { ability, rank, bonusDice: rulesetCheckModifier(evaluated, target) - ability - rank };
}

/** A symbol pool (1.141): each 1-based face in `rolls` belongs to the matching die in `thrown`.
 *  Symbols are the nonzero totals after cancellation. Face symbols and labels travel with the
 *  record, so the card can show the ruleset's words even after the ruleset is uninstalled. */
export interface RulesetSymbolRoll extends RulesetCheckRoll {
  /** Additional setback dice and own upgrades actually applied (1.150). */
  setback?: number;
  upgradeOwn?: number;
  thrown: string[];
  symbols: Record<string, number>;
  symbolLabels: Record<string, string>;
  symbolFaces: string[][];
}

/** Build positive and opposing dice, count faces and their additional symbols, then cancel pairs.
 *  Triumph and despair keep their critical markers independently of whether the check succeeds. */
export function rollSymbolPoolCheck(
  definition: RulesetDefinition,
  input: {
    ability: number;
    rank: number;
    difficulty: number;
    upgrades?: number;
    upgradeOwn?: number;
    setback?: number;
    bonusDice?: number;
    bought?: { dice: number };
    isSave: boolean;
  },
  rollDie: (sides: number) => number,
): RulesetSymbolRoll {
  const resolution = definition.resolution;
  if (resolution.kind !== "symbol-pool")
    return { ...noRoll(), thrown: [], symbols: {}, symbolLabels: {}, symbolFaces: [] };
  const { pool, difficulty, boost, setback } = resolution;
  const bounded = (value: number, max: number) => (Number.isFinite(value) ? clampInteger(value, 0, max) : 0);
  const ability = bounded(input.ability, pool.max);
  const rank = bounded(input.rank, pool.max);
  let size = Math.min(
    pool.max,
    (pool.build === "sum" ? ability + rank : Math.max(ability, rank)) + bounded(input.bought?.dice ?? 0, pool.max),
  );
  let upgraded = pool.build === "larger-upgraded" && pool.upgrade ? Math.min(size, ability, rank) : 0;
  const upgradeOwn =
    resolution.allowOwnUpgrade && pool.upgrade ? bounded(input.upgradeOwn ?? 0, pool.max - upgraded) : 0;
  upgraded += upgradeOwn;
  // Once every existing die is upgraded, each remaining upgrade adds an upgraded die.
  size = Math.max(size, upgraded);
  const against = bounded(input.difficulty, difficulty.max);
  const againstUp = difficulty.upgrade ? bounded(input.upgrades ?? 0, against) : 0;
  const bonus = Number.isFinite(input.bonusDice) ? Math.round(input.bonusDice!) : 0;
  const boosts = boost ? bounded(bonus, boost.max) : 0;
  const bonusSetbacks = setback ? bounded(-bonus, setback.max) : 0;
  const extraSetbacks = setback ? bounded(input.setback ?? 0, setback.max - bonusSetbacks) : 0;
  const setbacks = bonusSetbacks + extraSetbacks;
  const thrown = [
    ...Array<string>(upgraded).fill(pool.upgrade ?? pool.die),
    ...Array<string>(size - upgraded).fill(pool.die),
    ...Array<string>(boosts).fill(boost?.die ?? ""),
    ...Array<string>(againstUp).fill(difficulty.upgrade ?? difficulty.die),
    ...Array<string>(against - againstUp).fill(difficulty.die),
    ...Array<string>(setbacks).fill(setback?.die ?? ""),
  ];
  const dieById = new Map(resolution.dice.map((die) => [die.id, die]));
  const counted = new Map<string, number>();
  const symbolFaces: string[][] = [];
  const rolls = thrown.map((id) => {
    const die = dieById.get(id)!;
    const face = rollDie(die.faces.length);
    const symbols = die.faces[face - 1] ?? [];
    symbolFaces.push([...symbols]);
    for (const symbol of symbols) counted.set(symbol, (counted.get(symbol) ?? 0) + 1);
    return face;
  });
  const totals = new Map(counted);
  for (const symbol of resolution.symbols) {
    if (symbol.counts) totals.set(symbol.counts, (totals.get(symbol.counts) ?? 0) + (counted.get(symbol.id) ?? 0));
  }
  for (const symbol of resolution.symbols) {
    if (!symbol.cancels) continue;
    const pair = Math.min(totals.get(symbol.id) ?? 0, totals.get(symbol.cancels) ?? 0);
    totals.set(symbol.id, (totals.get(symbol.id) ?? 0) - pair);
    totals.set(symbol.cancels, (totals.get(symbol.cancels) ?? 0) - pair);
  }
  const symbols = Object.fromEntries([...totals].filter(([, count]) => count > 0));
  const net = totals.get(resolution.success.symbol) ?? 0;
  const criticalSuccess = !!resolution.criticalSuccess && (counted.get(resolution.criticalSuccess) ?? 0) > 0;
  const criticalFailure = !!resolution.criticalFailure && (counted.get(resolution.criticalFailure) ?? 0) > 0;
  const result: RulesetSymbolRoll = {
    rolls,
    usedRoll: net,
    total: net,
    success: net >= resolution.success.needed,
    criticalSuccess,
    criticalFailure,
    rollMode: "normal",
    dice: `${rolls.length}d${Math.max(...resolution.dice.map((die) => die.faces.length))}`,
    thrown,
    ...(extraSetbacks ? { setback: extraSetbacks } : {}),
    ...(upgradeOwn ? { upgradeOwn } : {}),
    symbols,
    symbolFaces,
    symbolLabels: Object.fromEntries(resolution.symbols.map((symbol) => [symbol.id, symbol.label])),
  };
  const outcome = applyRulesetCheckOutcome(resolution.outcomes, result, {
    margin: net - resolution.success.needed + 1,
    total: net,
  });
  return {
    ...outcome,
    criticalSuccess: criticalSuccess || outcome.criticalSuccess,
    criticalFailure: criticalFailure || outcome.criticalFailure,
  };
}

/** A `roll-against` check's roll (1.139). `total` is the die result; the target it was read against
 *  is the record's `dc`. */
export interface RulesetAgainstRoll extends RulesetCheckRoll {
  /** The target the roll was read against, after the step's divide and the check's modifier. */
  target: number;
  against: "at-most" | "at-least";
  /** Bonus (+) or penalty (-) tens dice thrown, after the ruleset's limit. */
  tens: number;
}

/** Whether a critical rule of a `roll-against` ruleset fires on this roll and target. */
function againstCriticalFires(
  rule: { from?: number; to?: number; pastTarget?: number; whenTarget?: { atLeast?: number; below?: number } },
  roll: number,
  target: number,
  against: "at-most" | "at-least",
): boolean {
  if (rule.whenTarget?.atLeast !== undefined && target < rule.whenTarget.atLeast) return false;
  if (rule.whenTarget?.below !== undefined && target >= rule.whenTarget.below) return false;
  if (rule.pastTarget !== undefined) {
    return against === "at-most" ? roll >= target + rule.pastTarget : roll <= target - rule.pastTarget;
  }
  return roll >= (rule.from ?? -Infinity) && roll <= (rule.to ?? Infinity);
}

/** Roll a `roll-against` check: throw the dice and read the result against the sheet's number, at
 *  most it (Call of Cthulhu, GURPS) or at least it (an old-school saving throw). A ladder step may
 *  divide the number (Hard is half, Extreme a fifth) and the check may move it. On a single d100,
 *  bonus and penalty tens dice throw extra tens and keep the best or the worst. */
export function rollAgainstCheck(
  definition: RulesetDefinition,
  input: {
    /** The sheet's number for this check: the target. */
    modifier: number;
    /** What the check adds to or takes from the target. */
    dc: number;
    /** What the ladder step divides the target by, 1 when none. */
    divide?: number;
    isSave: boolean;
    /** `bonus=`: tens dice, + for bonus and - for penalty, where the ruleset has them. */
    tens?: number;
  },
  rollDie: (sides: number) => number,
): RulesetAgainstRoll {
  const resolution = definition.resolution;
  if (resolution.kind !== "roll-against") {
    return { ...noRoll(), target: 0, against: "at-most", tens: 0 };
  }
  const { dice, against } = resolution;
  const divide = Number.isFinite(input.divide) && input.divide! >= 1 ? Math.round(input.divide!) : 1;
  const target = Math.floor(Math.round(input.modifier) / divide) + Math.round(input.dc);
  const tensMax = resolution.tens?.max ?? 0;
  const tens =
    dice.count === 1 && dice.sides === 100 && Number.isFinite(input.tens)
      ? clampInteger(input.tens!, -tensMax, tensMax)
      : 0;
  let rolls: number[];
  let roll: number;
  let rollMode: RulesetCheckRoll["rollMode"] = "normal";
  if (tens !== 0) {
    // One units die, and one tens die for each candidate; 00 with a 0 is 100.
    const units = rollDie(10) % 10;
    const candidates = Array.from({ length: 1 + Math.abs(tens) }, () => {
      const ten = (rollDie(10) % 10) * 10;
      return ten + units === 0 ? 100 : ten + units;
    });
    rolls = candidates;
    const better = against === "at-most" ? Math.min(...candidates) : Math.max(...candidates);
    const worse = against === "at-most" ? Math.max(...candidates) : Math.min(...candidates);
    roll = tens > 0 ? better : worse;
    rollMode = tens > 0 ? "advantage" : "disadvantage";
  } else {
    rolls = Array.from({ length: dice.count }, () => rollDie(dice.sides));
    roll = rolls.reduce((sum, face) => sum + face, 0);
  }
  const fires = (rules: typeof resolution.criticalSuccess) =>
    (rules ?? []).some((rule) => againstCriticalFires(rule, roll, target, against));
  const criticalSuccess = fires(resolution.criticalSuccess);
  const criticalFailure = !criticalSuccess && fires(resolution.criticalFailure);
  const reached = against === "at-most" ? roll <= target : roll >= target;
  const success = criticalSuccess || (!criticalFailure && reached);
  const result: RulesetAgainstRoll = {
    rolls,
    usedRoll: roll,
    total: roll,
    success,
    criticalSuccess,
    criticalFailure,
    rollMode,
    dice: `${rolls.length === dice.count ? dice.count : rolls.length}d${dice.sides}`,
    target,
    against,
    tens,
  };
  const margin = against === "at-most" ? target - roll : roll - target;
  return applyRulesetCheckOutcome(resolution.outcomes, result, {
    margin,
    total: roll,
    fraction: roll > 0 ? target / roll : target > 0 ? Infinity : 0,
    ...(criticalSuccess ? { forced: "best" as const } : criticalFailure ? { forced: "worst" as const } : {}),
  });
}

/** The override a check rolls with (1.140), if any: the first that names the check's skill, save or
 *  ability and whose `when` the roller's sheet meets. `meets` reads a value off that sheet. */
export function rulesetCheckOverride(
  definition: RulesetDefinition,
  target: RulesetCheckTarget | null,
  meets: (ref: RulesetValueRef) => boolean,
): RulesetResolutionOverride | null {
  if (!target) return null;
  const list = target.type === "skill" ? "skills" : target.type === "save" ? "saves" : "abilities";
  return (
    definition.resolution.overrides?.find(
      (override) => override[list]?.includes(target.id) && (!override.when || meets(override.when)),
    ) ?? null
  );
}

const overriddenDefinitions = new WeakMap<RulesetResolutionOverride, WeakMap<RulesetDefinition, RulesetDefinition>>();

/** The definition a check rolls with: the ruleset's own, or with an override's resolution in place
 *  (1.140). Worked out once per override and definition. An override the import let through always
 *  reads; one that somehow does not leaves the ruleset's own resolution. */
export function rulesetDefinitionForCheck(
  definition: RulesetDefinition,
  override: RulesetResolutionOverride | null,
): RulesetDefinition {
  if (!override) return definition;
  let byDefinition = overriddenDefinitions.get(override);
  if (!byDefinition) overriddenDefinitions.set(override, (byDefinition = new WeakMap()));
  const known = byDefinition.get(definition);
  if (known) return known;
  const made = rulesetOverriddenResolution(definition.resolution, override.set);
  const result = made.ok ? { ...definition, resolution: made.resolution } : definition;
  byDefinition.set(definition, result);
  return result;
}

/** The difficulty ladder step a name picks, or null. Matched without case or punctuation, and only
 *  when exactly one step answers to it, so a name two steps share picks neither of them. */
export function rulesetDifficultyStep(
  definition: RulesetDefinition,
  name: string | undefined,
): RulesetDifficultyLadderStep | null {
  const wanted = normalizeCheckName(name ?? "");
  if (!wanted) return null;
  const steps: RulesetDifficultyLadderStep[] = definition.resolution.difficultyLadder;
  const found = steps.filter((step) => normalizeCheckName(step.label) === wanted);
  return found.length === 1 ? found[0]! : null;
}

/** What a step asks for, in its kind's own terms: successes on a pool, a difficulty on a sum. */
export function rulesetDifficultyStepDc(step: RulesetDifficultyLadderStep): number {
  return "successes" in step ? step.successes : step.dc;
}

/** The per-die target of the one pool ladder step that needs exactly `successes`, or undefined: when
 *  no step or several need that many, when the one that does names no target, or on a summed ruleset.
 *  A ladder that prints "Plain work 1 success (target 6)" then means it at the table, and one whose
 *  steps all need one success says nothing about which of them a bare `dc="1"` meant. */
export function rulesetLadderTargetFor(definition: RulesetDefinition, successes: number): number | undefined {
  const resolution = definition.resolution;
  if (resolution.kind !== "dice-pool") return undefined;
  const found = resolution.difficultyLadder.filter((step) => step.successes === successes);
  return found.length === 1 ? found[0]!.target : undefined;
}

/**
 * Which of a character's held fakes the sheet shows for what they are (1.79): one whose true item,
 * worn or carried as it is, makes any of the sheet's numbers other than the item it passes for would,
 * or changes what a check or save adds. The item's place in `items` for each, so a caller can find it
 * out. `sources` is how a check reads items (`rulesetItemSources`), passed in to keep this module free
 * of the check code.
 */
export function rulesetFakesTheSheetShows(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  items: readonly RulesetSheetItem[],
  sources: (items: readonly RulesetSheetItem[], sheet: () => EvaluatedRulesetSheet) => unknown,
  /** The character's live state as the sheet reads it (`readRulesetLive`). */
  live: RulesetSheetLiveValues,
): number[] {
  const read = (held: readonly RulesetSheetItem[]) => {
    const sheet = evaluateRulesetSheet(definition, build, { ...live, items: held });
    return stableJson([
      sheet.abilityScores,
      sheet.abilityMods,
      sheet.skillMods,
      sheet.saveMods,
      sheet.derived,
      sources(held, () => sheet),
    ]);
  };
  const shown: number[] = [];
  const truth = read(items);
  items.forEach((held, index) => {
    if (!held.truly) return;
    const seeming = items.map((each, at) => {
      if (at !== index) return each;
      const { truly: _truly, ...rest } = each;
      return rest;
    });
    if (read(seeming) !== truth) shown.push(index);
  });
  return shown;
}

/** A value as JSON with its keys in order, so two equal objects written in another order compare equal. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, each: unknown) =>
    each && typeof each === "object" && !Array.isArray(each)
      ? Object.fromEntries(
          Object.entries(each as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : each,
  );
}

/**
 * What a rolled list column throws for one row (Capability API 1.85), as dice notation (`1d8`): its
 * count of dice, of the sides it names, read from the row's own column or off the sheet. Null for a
 * column that is not rolled, or sides that do not read as a die. A cell left empty reads as the editor
 * shows it.
 */
export function rulesetListRollNotation(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  column: RulesetListColumn,
  row: Readonly<Record<string, unknown>>,
  evaluated?: EvaluatedRulesetSheet,
): string | null {
  if (column.type !== "number" || !column.roll) return null;
  const { count, sides } = column.roll;
  // A cell left empty reads as the editor shows it: its column's default, or an enum's first value.
  const cell = (id: string) => {
    if (row[id] !== undefined && row[id] !== null && row[id] !== "") return row[id];
    const other = definition.sheet.lists
      .find((list) => list.columns.includes(column))
      ?.columns.find((each) => each.id === id);
    if (other?.default !== undefined) return other.default;
    if (other?.type === "enum") return other.values[0];
    return other?.type === "number" ? Math.min(Math.max(0, other.min), other.max) : undefined;
  };
  const read =
    typeof sides === "number"
      ? sides
      : "column" in sides
        ? rulesetDieSides(cell(sides.column))
        : rulesetDieSides(Math.trunc(resolveRulesetValueRef(definition, build, sides, evaluated)));
  return read === null ? null : `${count}d${read}`;
}

/** Missing party data starts at defaults; unreadable stored data is never silently replaced. */
export function readRulesetPartySheet(
  definition: RulesetDefinition,
  stored: unknown,
  /** The party's characters' builds, so the fields read off them (1.163) are what they are now. */
  members?: readonly RulesetSheetBuild[],
): RulesetSheetEnvelope | null {
  const party = rulesetPartyDefinition(definition);
  if (!party) return null;
  const envelope = stored == null ? createRulesetSheetEnvelope(party) : readRulesetSheetEnvelope(party, stored);
  if (!envelope || !members) return envelope;
  return { ...envelope, build: rulesetPartyWithMembers(definition, envelope.build, members) };
}

/** The shared sheet's build with its `fromMembers` fields filled from the party's characters (1.163):
 *  how many there are, or what one number field of theirs adds up to. Each character counts once. */
export function rulesetPartyWithMembers(
  definition: RulesetDefinition,
  partyBuild: RulesetSheetBuild,
  members: readonly RulesetSheetBuild[],
): RulesetSheetBuild {
  const from = definition.party?.fromMembers;
  if (!from?.length) return partyBuild;
  const evaluated = members.map((build) => evaluateRulesetSheet(definition, build));
  const fields = { ...partyBuild.fields };
  for (const entry of from) {
    const value = entry.count
      ? members.length
      : evaluated.reduce((sum, sheet) => sum + (sheet.numbers[entry.sum!] ?? 0), 0);
    const field = definition.party!.fields.find((each) => each.id === entry.field);
    fields[entry.field] = field?.type === "number" ? Math.min(field.max, Math.max(field.min, value)) : value;
  }
  return { ...partyBuild, fields };
}

/** One row's spellcasting numbers (1.108). Missing columns never take their editor defaults: an old
 *  row without a class keeps the source's references until the player assigns it one. */
export function resolveRulesetAbilityValues(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  source: RulesetCombatAbilitySource,
  row: Record<string, unknown>,
  evaluated: EvaluatedRulesetSheet,
): { toHit: number; saveDifficulty?: number; toHitRef?: RulesetValueRef } {
  const column = source.byColumn?.column;
  const value = column && Object.prototype.hasOwnProperty.call(row, column) ? row[column] : undefined;
  const key =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : undefined;
  const selected =
    key !== undefined && source.byColumn && Object.prototype.hasOwnProperty.call(source.byColumn.values, key)
      ? source.byColumn.values[key]
      : undefined;
  const toHitRef = selected?.toHit ?? source.toHit;
  const saveRef = selected?.saveDifficulty ?? source.saveDifficulty;
  return {
    toHit: toHitRef ? resolveRulesetValueRef(definition, build, toHitRef, evaluated) : 0,
    ...(toHitRef ? { toHitRef } : {}),
    ...(saveRef ? { saveDifficulty: resolveRulesetValueRef(definition, build, saveRef, evaluated) } : {}),
  };
}
