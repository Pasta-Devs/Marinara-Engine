// The decidable half of the ruleset catalog picker and of Refresh from ruleset: which filter options
// a catalog offers, what a filter starts on, what the sheet already holds, what a selection would
// cost each list, which picked rows the ruleset has newer text for, and the one-line reading of an
// entry's mechanics. None of it needs React, so the client-lane regression checks it directly.
//
// Nothing here knows a system by name: every word comes from a localization key or from the
// ruleset's own labels, and every value comes from the catalog file.
import {
  catalogEntryHiddenByLayers,
  catalogRowRef,
  rowsFromCatalogEntry,
  rulesetListRowIssues,
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntry,
  type RulesetCatalogEntryRow,
  type RulesetCatalogFilter,
  type RulesetCatalogHeader,
  type RulesetCatalogMechanics,
  type RulesetDefinition,
  type RulesetField,
  type RulesetLayerOptions,
  type RulesetList,
  type RulesetListColumn,
  type RulesetSheetBuild,
} from "@marinara-engine/shared";
import type { TFunction } from "i18next";

type Scalar = number | string | boolean;
export type CatalogListRow = Record<string, Scalar>;

/** What a filter's select holds while nothing is chosen. A catalog value is never empty, so this
 *  can never collide with one, even when a ruleset offers a literal "Any". */
export const CATALOG_FILTER_ANY = "";

/** How many rows the picker draws before it asks the user to narrow the search instead. A catalog
 *  may hold two thousand entries, and a list that long is neither readable nor cheap to render. */
export const CATALOG_VISIBLE_LIMIT = 200;

function compare(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

/** What one entry says for one filter, as the texts the picker shows and matches: every tag of a
 *  tags value, a number as its text, a non-empty string as itself. */
export function catalogEntryFilterTexts(entry: RulesetCatalogEntry, filterId: string): string[] {
  const value = entry.filters?.[filterId];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "number") return [String(value)];
  return typeof value === "string" && value ? [value] : [];
}

/** The distinct values the loaded entries actually carry for one declared filter. Derived from the
 *  entries rather than from the header, so a filter never offers a value nothing has. */
export function catalogFilterOptions(filter: RulesetCatalogFilter, entries: readonly RulesetCatalogEntry[]): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const text of catalogEntryFilterTexts(entry, filter.id)) seen.add(text);
  }
  const options = [...seen];
  // Numbers sort as numbers: a cost of 10 belongs after 9, not between 1 and 2.
  return filter.type === "number" ? options.sort((left, right) => Number(left) - Number(right)) : options.sort(compare);
}

/** The texts that could name the sheet's own value of a field. A catalog names a value the way a
 *  player reads it, so an enum's display label has to be tried beside the stored value. */
export function sheetFieldMatchTexts(field: RulesetField | undefined, stored: Scalar | undefined): string[] {
  const value = stored === undefined ? field?.default : stored;
  if (value === undefined || value === "") return [];
  const texts = [String(value)];
  if (field?.type === "enum" && typeof value === "string") {
    const shown = field.valueLabels?.[value];
    if (shown) texts.push(shown);
  }
  return texts;
}

/** The option a filter opens on: the sheet's own value when some entry carries it, "Any" otherwise.
 *  The match ignores case because a file and a sheet spell the same word differently often enough. */
export function catalogFilterStartValue(options: readonly string[], texts: readonly string[]): string {
  const wanted = texts.map((text) => text.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return CATALOG_FILTER_ANY;
  return options.find((option) => wanted.includes(option.trim().toLowerCase())) ?? CATALOG_FILTER_ANY;
}

export type CatalogFilterView = {
  filter: RulesetCatalogFilter;
  options: string[];
  /** What the picker selects when it opens. The user can always change it. */
  start: string;
};

/** Every filter worth drawing, with its options and its starting value. A filter no loaded entry
 *  carries is dropped: a select whose only choice is "Any" filters nothing. */
export function catalogFilterViews(
  catalog: Pick<RulesetCatalogHeader, "filters">,
  entries: readonly RulesetCatalogEntry[],
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
): CatalogFilterView[] {
  const views: CatalogFilterView[] = [];
  for (const filter of catalog.filters ?? []) {
    const options = catalogFilterOptions(filter, entries);
    if (options.length === 0) continue;
    const fieldId = filter.startFrom?.field;
    const field = fieldId ? definition.sheet.fields.find((entry) => entry.id === fieldId) : undefined;
    const texts = fieldId ? sheetFieldMatchTexts(field, build.fields[fieldId]) : [];
    views.push({ filter, options, start: catalogFilterStartValue(options, texts) });
  }
  return views;
}

/** Whether one entry passes one filter's current choice. An entry that carries no value for the
 *  filter is out once a value is chosen: it is not what the user asked for. */
export function catalogEntryMatchesFilter(
  entry: RulesetCatalogEntry,
  filter: RulesetCatalogFilter,
  chosen: string,
): boolean {
  if (chosen === CATALOG_FILTER_ANY) return true;
  const value = entry.filters?.[filter.id];
  if (value === undefined) return false;
  return Array.isArray(value) ? value.includes(chosen) : String(value) === chosen;
}

/** Search runs over what the picker shows: the entry's label and its one-line summary. */
export function catalogEntryMatchesSearch(entry: RulesetCatalogEntry, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return `${entry.label} ${entry.summary ?? ""}`.toLowerCase().includes(needle);
}

export function filterCatalogEntries(
  entries: readonly RulesetCatalogEntry[],
  views: readonly CatalogFilterView[],
  search: string,
  chosen: Readonly<Record<string, string>>,
): RulesetCatalogEntry[] {
  return entries.filter(
    (entry) =>
      catalogEntryMatchesSearch(entry, search) &&
      views.every((view) =>
        catalogEntryMatchesFilter(entry, view.filter, chosen[view.filter.id] ?? CATALOG_FILTER_ANY),
      ),
  );
}

/** The entries the picker may offer at all: everything the catalog holds, minus what the game's
 *  layers hide. It runs before the filters, so a filter never offers a value only a hidden entry
 *  carries, and the count of matches is the count of things that can actually be picked.
 *
 *  Only the PICKER is narrowed. Refresh from ruleset and the scaled columns read the catalog
 *  straight from the query, so a row the sheet already holds keeps working after a layer hides its
 *  entry: hidden means not offered, not gone. Outside a game there is no pin, no options are passed
 *  and nothing is hidden. */
export function visibleCatalogEntries(
  definition: Pick<RulesetDefinition, "layers">,
  options: RulesetLayerOptions | null | undefined,
  catalogId: string,
  entries: readonly RulesetCatalogEntry[],
): RulesetCatalogEntry[] {
  if (!options) return [...entries];
  return entries.filter((entry) => !catalogEntryHiddenByLayers(definition, options, catalogId, entry));
}

/** A stored sheet is read tolerantly, so a list the file holds as something other than rows reads
 *  as having none instead of throwing in the middle of the picker. */
function storedRows(lists: RulesetSheetBuild["lists"], listId: string): CatalogListRow[] {
  const rows: unknown = lists[listId];
  return Array.isArray(rows) ? (rows as CatalogListRow[]) : [];
}

/** Whether the sheet already holds a row this entry wrote, in any list the catalog feeds. Picking it
 *  again is allowed and adds another copy, so this only marks, it never blocks. */
export function catalogEntryAlreadyAdded(
  catalogId: string,
  entry: RulesetCatalogEntry,
  feeds: readonly string[],
  lists: RulesetSheetBuild["lists"],
): boolean {
  const ref = catalogRowRef(catalogId, entry.id);
  return feeds.some((listId) => storedRows(lists, listId).some((row) => row[RULESET_CATALOG_ROW_KEY] === ref));
}

export type CatalogAdditionTarget = {
  listId: string;
  label: string;
  /** Rows the list holds now. */
  current: number;
  /** Rows this selection would add. */
  adding: number;
  /** Rows the list could still take. */
  room: number;
};

export type CatalogAdditionPlan = {
  /** Only the lists that change, each with its full new rows, ready for one `commit({ lists })`. */
  lists: Record<string, CatalogListRow[]>;
  targets: CatalogAdditionTarget[];
  /** Entries left out because one of their rows does not fit the list it is meant for. */
  dropped: number;
  /** Labels of the lists this selection would push past `maxItems`. */
  full: string[];
};

/** What picking these entries would do to the sheet. The rows come from the shared
 *  `rowsFromCatalogEntry`, so the reserved mark is set exactly once and in one place, and each is
 *  checked with the shared `rulesetListRowIssues` against the list it would land in: the row editor
 *  must never be handed a value the ruleset itself would refuse. */
export function planCatalogAddition(
  definition: RulesetDefinition,
  catalogId: string,
  selected: readonly RulesetCatalogEntry[],
  lists: RulesetSheetBuild["lists"],
  /** Lists `hideWhen` hides on THIS sheet. They do not exist for this character, so a row meant for
   *  one is not written where nobody could see or remove it. */
  skipLists: ReadonlySet<string> = new Set(),
): CatalogAdditionPlan {
  const listById = new Map(definition.sheet.lists.map((list) => [list.id, list]));
  const next: Record<string, CatalogListRow[]> = {};
  let dropped = 0;

  for (const entry of selected) {
    // Built and declared rows run in step: `rowsFromCatalogEntry` maps one to one over `entry.rows`,
    // and the declared values are what the list's columns are checked against. An entry is added
    // whole or not at all: a knack without the limited-use row that belongs to it is half a knack.
    const all = rowsFromCatalogEntry(catalogId, entry);
    const fits = all.every((row, index) => {
      if (skipLists.has(row.list)) return true;
      const list = listById.get(row.list);
      const values = entry.rows?.[index]?.values;
      return Boolean(list && values && rulesetListRowIssues(list, values).length === 0);
    });
    const built = all.filter((row) => !skipLists.has(row.list));
    // An entry whose every row belongs to a hidden list would add nothing, which is left out too.
    if (!fits || built.length === 0) {
      dropped += 1;
      continue;
    }
    for (const row of built) {
      const rows = next[row.list] ?? [...storedRows(lists, row.list)];
      rows.push(row.row);
      next[row.list] = rows;
    }
  }

  const targets: CatalogAdditionTarget[] = [];
  const full: string[] = [];
  // The sheet's own list order, so the footer reads the way the editor does.
  for (const list of definition.sheet.lists) {
    const rows = next[list.id];
    if (!rows) continue;
    const current = storedRows(lists, list.id).length;
    const target = {
      listId: list.id,
      label: list.label,
      current,
      adding: rows.length - current,
      room: Math.max(0, list.maxItems - current),
    };
    targets.push(target);
    if (target.adding > target.room) full.push(list.label);
  }
  return { lists: next, targets, dropped, full };
}

// ── Refresh from ruleset ──

/** The column a row of this list is shown under: what the Game Master's sheet block prints it as,
 *  then the name a row pool is keyed by, then the list's first text column. The shared live-state
 *  reader chooses the same column for the same reasons and keeps its own copy of this private. */
function listNameColumn(definition: RulesetDefinition, list: RulesetList): string | undefined {
  return (
    definition.gm.sheetSummary.lists.find((entry) => entry.list === list.id)?.nameColumn ??
    list.pools?.nameColumn ??
    list.columns.find((column) => column.type === "text")?.id
  );
}

/**
 * The entry's value as text the column could really hold, or null when it is not comparable.
 *
 * Only text-like columns are ever compared. A number or a switch is where the player's own state
 * lives (prepared, proficient, a magic weapon's bonus, a maximum they set by hand) and there is no
 * stored base to merge against, so the ruleset's copy of it is never offered. A value the column
 * would refuse is left out too: a refresh must never write something the editor cannot then show.
 */
function refreshableText(column: RulesetListColumn, value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (column.type === "enum") return column.values.includes(value) ? value : null;
  if (column.type === "dice") return value.length <= 40 ? value : null;
  if (column.type === "text" || column.type === "longtext") return value.length <= column.maxLength ? value : null;
  return null;
}

/**
 * The entry's value for a column the row does NOT carry at all, whatever the column's type.
 *
 * The rule above exists because a number or a switch is where the player's own state lives and
 * overwriting it would throw away what they typed. A column the row has never had is not the
 * player's state: they have never seen it. A ruleset that ADDS a column (a weapon list that grows
 * a reach) could otherwise only reach an existing row by having the player delete it and pick it
 * again, which is a thing a package README should not have to say.
 *
 * Still held to what the column can hold, for the same reason as above: a refresh must never write
 * something the editor cannot then show.
 */
function refreshableNewValue(column: RulesetListColumn, value: unknown): string | number | boolean | null {
  if (typeof value === "number") return column.type === "number" && Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return column.type === "boolean" ? value : null;
  return refreshableText(column, value);
}

export type CatalogRefreshColumn = {
  columnId: string;
  label: string;
  /** What the sheet holds now. Empty when the row never carried the column. */
  current: string;
  /** What the ruleset says now, as text a reader can compare. */
  next: string;
  /** Exactly what applying writes. A string for every column the row already had; a number or a
   *  switch only ever for a column the row is GAINING. */
  value: string | number | boolean;
  /** True when the row does not carry this column at all, so the review can word it as something
   *  the row gained rather than as a change to what it holds. */
  added?: boolean;
};

export type CatalogRefreshRow = {
  listId: string;
  /** Where the row sits in the stored list. Unique inside one list, so a chosen row is keyed by it. */
  index: number;
  /** What to call the row while it is reviewed: the name the sheet shows it under, else the entry's. */
  name: string;
  columns: CatalogRefreshColumn[];
};

export type CatalogRefreshList = {
  listId: string;
  label: string;
  rows: CatalogRefreshRow[];
};

/**
 * Which picked rows the ruleset now has different text for, list by list.
 *
 * A row is lined up with the entry row it was copied from by position among the rows carrying the
 * same mark in that list, which only holds while the sheet still has as many of them as the entry
 * writes. Otherwise the only safe reading is an entry with a single row for the list: any other
 * pairing would be a guess, and a guess here rewrites somebody's character. A row whose entry the
 * catalog no longer has is skipped, silently: nothing is known about it any more.
 */
export function planCatalogRefresh(
  definition: RulesetDefinition,
  catalogId: string,
  entries: readonly RulesetCatalogEntry[],
  lists: RulesetSheetBuild["lists"],
): CatalogRefreshList[] {
  const byRef = new Map<string, RulesetCatalogEntry>();
  for (const entry of entries) byRef.set(catalogRowRef(catalogId, entry.id), entry);
  if (byRef.size === 0) return [];

  const plans: CatalogRefreshList[] = [];
  for (const list of definition.sheet.lists) {
    const rows = storedRows(lists, list.id);
    if (rows.length === 0) continue;
    const columnById = new Map(list.columns.map((column) => [column.id, column]));
    const nameColumn = listNameColumn(definition, list);

    // Where this catalog's rows sit in this list, gathered per entry.
    const marked = new Map<string, number[]>();
    rows.forEach((row, index) => {
      const ref = row?.[RULESET_CATALOG_ROW_KEY];
      if (typeof ref !== "string" || !byRef.has(ref)) return;
      const found = marked.get(ref);
      if (found) found.push(index);
      else marked.set(ref, [index]);
    });

    const refreshed: CatalogRefreshRow[] = [];
    for (const [ref, indexes] of marked) {
      const entry = byRef.get(ref)!;
      const entryRows = (entry.rows ?? []).filter((row) => row.list === list.id);
      const pairedWith = (position: number): RulesetCatalogEntryRow | undefined => {
        if (entryRows.length === indexes.length) return entryRows[position];
        return entryRows.length === 1 ? entryRows[0] : undefined;
      };
      indexes.forEach((index, position) => {
        const entryRow = pairedWith(position);
        const row = rows[index];
        if (!entryRow || !row) return;
        const columns: CatalogRefreshColumn[] = [];
        for (const [columnId, value] of Object.entries(entryRow.values)) {
          // A column the ruleset keeps itself follows the sheet, not the file, so it is never part
          // of a refresh: the editor already holds it at whatever this character's numbers say.
          if (entryRow.scaled && Object.hasOwn(entryRow.scaled, columnId)) continue;
          const column = columnById.get(columnId);
          if (!column) continue;
          // A column the row HAS is the rule above, unchanged: only text is compared, because the
          // number and the switch are the player's. Tested on the KEY, never on the value, so a
          // column holding 0, false or "" is a column the row has and stays the player's.
          const isNew = !Object.hasOwn(row, columnId);
          const next = isNew ? refreshableNewValue(column, value) : refreshableText(column, value);
          if (next === null) continue;
          const stored = row[columnId];
          if (stored === next) continue;
          columns.push({
            columnId,
            label: column.label,
            current: stored === undefined ? "" : String(stored),
            next: String(next),
            value: next,
            ...(isNew ? { added: true } : {}),
          });
        }
        if (columns.length === 0) return;
        const name = nameColumn ? row[nameColumn] : undefined;
        refreshed.push({
          listId: list.id,
          index,
          name: typeof name === "string" && name.trim() ? name : entry.label,
          columns,
        });
      });
    }

    if (refreshed.length === 0) continue;
    // The sheet's own row order, so the review reads down the list the way the editor draws it.
    refreshed.sort((left, right) => left.index - right.index);
    plans.push({ listId: list.id, label: list.label, rows: refreshed });
  }
  return plans;
}

/** The lists a refresh changes, each with its full new rows, ready for one `commit({ lists })`. Only
 *  the differing columns of the chosen rows are written, so everything else the row holds survives:
 *  the `_catalog` mark, the player's own numbers, and any column the entry does not set. */
export function applyCatalogRefresh(
  lists: RulesetSheetBuild["lists"],
  chosen: readonly CatalogRefreshRow[],
): Record<string, CatalogListRow[]> {
  const next: Record<string, CatalogListRow[]> = {};
  for (const chosenRow of chosen) {
    const rows = next[chosenRow.listId] ?? [...storedRows(lists, chosenRow.listId)];
    const current = rows[chosenRow.index];
    if (!current || typeof current !== "object") continue;
    const patched = { ...current };
    for (const column of chosenRow.columns) patched[column.columnId] = column.value;
    rows[chosenRow.index] = patched;
    next[chosenRow.listId] = rows;
  }
  return next;
}

// ── The mechanics line ──

const KIND_KEYS: Readonly<Record<RulesetCatalogMechanics["kind"], string>> = Object.freeze({
  attack: "game.ruleset.catalog.kind.attack",
  heal: "game.ruleset.catalog.kind.heal",
  buff: "game.ruleset.catalog.kind.buff",
  debuff: "game.ruleset.catalog.kind.debuff",
  utility: "game.ruleset.catalog.kind.utility",
  rider: "game.ruleset.catalog.kind.rider",
});

const SHAPE_KEYS: Readonly<Record<"burst" | "cone" | "line", string>> = Object.freeze({
  burst: "game.ruleset.catalog.shape.burst",
  cone: "game.ruleset.catalog.shape.cone",
  line: "game.ruleset.catalog.shape.line",
});

const TARGET_KEYS: Readonly<Record<"self" | "ally" | "enemy" | "any", string>> = Object.freeze({
  self: "game.ruleset.catalog.targets.self",
  ally: "game.ruleset.catalog.targets.ally",
  enemy: "game.ruleset.catalog.targets.enemy",
  any: "game.ruleset.catalog.targets.any",
});

const SAVE_KEYS: Readonly<Record<"none" | "half" | "negates", string>> = Object.freeze({
  none: "game.ruleset.catalog.mechanics.saveNone",
  half: "game.ruleset.catalog.mechanics.saveHalf",
  negates: "game.ruleset.catalog.mechanics.saveNegates",
});

export type CatalogMechanicsLabels = {
  /** What a range or an area size is measured in, from the catalog header. */
  units: RulesetCatalogHeader["units"];
  /** Save id to the name the ruleset gives it. */
  saves: Readonly<Record<string, string>>;
  /** Live pool id, or pool group id, to the name the sheet shows. */
  pools: Readonly<Record<string, string>>;
  /** Action-economy budget id to the name the ruleset gives it, for the entries that hand a budget
   *  back or buy a standard action with one. Empty for a ruleset that resolves no combat. */
  budgets: Readonly<Record<string, string>>;
};

/** The ruleset's own names for everything a mechanics block can point at. A pool group has no label
 *  of its own, so it reads as its id, exactly as the in-game sheet heads its group with. */
export function catalogMechanicsLabels(
  definition: RulesetDefinition,
  catalog: Pick<RulesetCatalogHeader, "units">,
): CatalogMechanicsLabels {
  const saves: Record<string, string> = {};
  for (const save of definition.sheet.saves) saves[save.id] = save.label;
  const pools: Record<string, string> = {};
  for (const pool of definition.sheet.live.pools) {
    pools[pool.id] = pool.label;
    if (pool.group && !(pool.group in pools)) pools[pool.group] = pool.group;
  }
  const budgets: Record<string, string> = {};
  for (const budget of definition.combat?.economy.budgets ?? []) budgets[budget.id] = budget.label;
  return { units: catalog.units, saves, pools, budgets };
}

/** Dice and a flat adjustment read as one die expression (`1d8+3`), which every system writes the
 *  same way, so there is nothing here to translate. */
function formatAmount(amount: { dice?: string; flat?: number } | undefined): string {
  if (!amount) return "";
  const { dice, flat } = amount;
  if (dice && flat !== undefined && flat !== 0) return `${dice}${flat > 0 ? "+" : "-"}${Math.abs(flat)}`;
  if (dice) return dice;
  return flat === undefined ? "" : String(flat);
}

/** One compact line saying what an entry does. Every word is a localization key or a label the
 *  ruleset itself wrote; the Engine does not act on any of it yet. */
export function formatCatalogMechanics(
  mechanics: RulesetCatalogMechanics,
  labels: CatalogMechanicsLabels,
  t: TFunction,
): string {
  const distance = (value: number) => {
    const unit = labels.units?.distance?.label;
    return unit ? t("game.ruleset.catalog.mechanics.distance", { value, unit }) : String(value);
  };
  const parts: string[] = [t(KIND_KEYS[mechanics.kind])];

  if (mechanics.check?.reroll) {
    parts.push(
      t(
        mechanics.check.reroll.mode === "once"
          ? "game.ruleset.catalog.mechanics.checkRerollOnce"
          : "game.ruleset.catalog.mechanics.checkRerollUntil",
        { value: mechanics.check.reroll.upTo },
      ),
    );
  }
  if (mechanics.check?.dice) parts.push(t("game.ruleset.catalog.mechanics.checkDice", { count: mechanics.check.dice }));
  if (mechanics.check?.successes) {
    parts.push(t("game.ruleset.catalog.mechanics.checkSuccesses", { count: mechanics.check.successes }));
  }
  if (mechanics.check?.threshold !== undefined) {
    parts.push(t("game.ruleset.catalog.mechanics.checkThreshold", { value: mechanics.check.threshold }));
  }

  if (mechanics.range !== undefined) {
    parts.push(
      mechanics.range === 0
        ? t("game.ruleset.catalog.mechanics.selfOrTouch")
        : t("game.ruleset.catalog.mechanics.range", { distance: distance(mechanics.range) }),
    );
  }
  if (mechanics.area) {
    parts.push(
      t("game.ruleset.catalog.mechanics.area", {
        shape: t(SHAPE_KEYS[mechanics.area.shape]),
        distance: distance(mechanics.area.size),
      }),
    );
  }
  // A rider never reaches the menu, so its line is the only place a reader learns what it does: how
  // much it adds, of what, and how often. Without this the picker says only the word "Rider".
  if (mechanics.rider) {
    const added = formatAmount(mechanics.rider.amount);
    if (added) {
      parts.push(
        t("game.ruleset.catalog.mechanics.riderAmount", {
          amount: added,
          type: mechanics.rider.type ?? t("game.ruleset.catalog.mechanics.riderSameType"),
        }),
      );
    }
    parts.push(
      t(
        mechanics.rider.oncePer === "round"
          ? "game.ruleset.catalog.mechanics.riderOnceRound"
          : "game.ruleset.catalog.mechanics.riderOnceTurn",
      ),
    );
  }
  // What the 1.29 keys do is the whole point of the entries that carry them, and none of them
  // reaches the menu as its own row: an ability that costs no action, or hands one back, or lets
  // its holder Dash with a bonus action, would otherwise read as nothing but its kind.
  if (mechanics.free) parts.push(t("game.ruleset.catalog.mechanics.free"));
  for (const given of mechanics.gives ?? []) {
    parts.push(
      t("game.ruleset.catalog.mechanics.gives", {
        count: given.count,
        budget: labels.budgets[given.budget] ?? given.budget,
      }),
    );
  }
  if (mechanics.standard) {
    parts.push(
      t("game.ruleset.catalog.mechanics.standard", {
        actions: mechanics.standard.actions
          .map((action) => t(`game.combat.ruleset.standard.${action}`, { defaultValue: action }))
          .join(", "),
        budget: labels.budgets[mechanics.standard.budget] ?? mechanics.standard.budget,
      }),
    );
  }
  if (mechanics.targets) parts.push(t(TARGET_KEYS[mechanics.targets]));
  if (mechanics.friendlyFire) parts.push(t("game.ruleset.catalog.mechanics.friendlyFire"));
  if (mechanics.attackRoll) parts.push(t("game.ruleset.catalog.mechanics.attackRoll"));

  const amount = formatAmount(mechanics.amount);
  if (amount) {
    parts.push(
      mechanics.damageType
        ? t("game.ruleset.catalog.mechanics.amountOfType", { amount, type: mechanics.damageType })
        : amount,
    );
  }
  // Each clause beside the first amount is rolled and typed on its own, so each says so on its own
  // rather than being summed into a number no die matches.
  for (const clause of mechanics.plus ?? []) {
    const added = formatAmount(clause);
    if (!added) continue;
    parts.push(
      t("game.ruleset.catalog.mechanics.plus", {
        amount: added,
        type: clause.type ?? t("game.ruleset.catalog.mechanics.riderSameType"),
      }),
    );
    // A clause may ask the target for a saving throw of its OWN, which is a different throw from
    // the action's and is the only thing standing between the target and this part of the blow.
    // Said right after the clause it belongs to, so a reader can tell the two saves apart.
    if (clause.save) {
      parts.push(t(SAVE_KEYS[clause.save.onSuccess], { save: labels.saves[clause.save.save] ?? clause.save.save }));
    }
  }
  const perStep = formatAmount(mechanics.perCostStep);
  if (perStep) parts.push(t("game.ruleset.catalog.mechanics.perStep", { amount: perStep }));

  if (mechanics.save) {
    const save = labels.saves[mechanics.save.save] ?? mechanics.save.save;
    parts.push(t(SAVE_KEYS[mechanics.save.onSuccess], { save }));
  }
  for (const cost of mechanics.cost ?? []) {
    parts.push(
      t("game.ruleset.catalog.mechanics.cost", { count: cost.amount, pool: labels.pools[cost.pool] ?? cost.pool }),
    );
  }
  if (mechanics.concentration) parts.push(t("game.ruleset.catalog.mechanics.concentration"));
  if (mechanics.reaction) parts.push(t("game.ruleset.catalog.mechanics.reaction"));
  return parts.join(" · ");
}
