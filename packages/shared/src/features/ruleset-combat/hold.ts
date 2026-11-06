// A Game Master's invented opponent, written as a SHEET, held to its tier.
//
// A plain invention is held by its numbers before the fight is built (`clampRulesetStatBlock`). A
// sheet has no numbers until it is built: its defense, to-hit, save difficulties and damage are
// whatever the ruleset's own formulas make of it. So it is held in three steps, each the smallest
// thing that works for any ruleset:
//
//   1. `readProposedRulesetSheet`: a model's sheet is read the way a character's is, leniently.
//      Anything the ruleset does not have is dropped by name, a value is fitted to its field or
//      column, and a row named after a catalog entry becomes that entry, so "Fireball" is Fireball.
//      For anything but a boss, `restrictRulesetSheetEntries` then keeps only the entries the ruleset
//      opens to that sheet (a Sorcerer's spells, not every spell), and `fillRulesetSheetChoices`
//      fills the choices it left open by its temperament and competence, with no model call.
//   2. `holdRulesetSheetHealth`: health goes into the tier's band through the one field the
//      ruleset's health is read off, which is a sheet edit, so every reader agrees on it.
//   3. `holdRulesetCombatant`: once the fight is built, defense, to-hit, save difficulties and the
//      best round are held on the combatant itself, which is where those numbers live for the whole
//      fight. The damage a bigger payment buys counts toward the best round.
//
// Every change comes back as a plain sentence, exactly as the plain clamp's do.

import {
  RULESET_CATALOG_ROW_KEY,
  RULESET_STANDS_FOR_ROW_KEY,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatThreatTier,
  type RulesetDefinition,
  type RulesetField,
  type RulesetList,
  type RulesetListColumn,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { combatAiHash, type CombatTactics } from "../combat-ai.js";
import { applyRulesetSheetOp, planRulesetUse, readRulesetLive } from "../rulesets/live-state.js";
import { sheetFieldMatchTexts } from "../rulesets/scaled-rows.js";
import { resolveRulesetValueRef } from "../rulesets/sheet-math.js";
import {
  heaviestRider,
  RULESET_CLAMP_HEADROOM,
  rulesetActionAverage,
  rulesetStepAverageTimes,
  smallerDie,
} from "./creatures.js";
import { rulesetAverageAmount, rulesetAverageDamage } from "./dice.js";
import { rulesetCostSteps, rulesetPoolFamily } from "./options.js";
import type { RulesetCombatAction, RulesetCombatAmount, RulesetCombatant } from "./types.js";

type SheetScalar = string | number | boolean;

/** How many names one sentence lists before it says "and N more". */
const NAMES_SHOWN = 4;

/** Names for a log line, quoted, the first few and a count of the rest. */
function listed(names: readonly string[]): string {
  const shown = names.slice(0, NAMES_SHOWN).map((name) => `"${name}"`);
  const more = names.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
}

/** Whether two values are the same word, ignoring case and the space around it. */
const sameName = (left: unknown, right: unknown) =>
  typeof left === "string" && typeof right === "string" && left.trim().toLowerCase() === right.trim().toLowerCase();

/** A value fitted to a field or a column: a number into its range, one of its values, text to its
 *  length. Undefined when there is nothing of the right kind to keep. */
function fitted(spec: RulesetField | RulesetListColumn, value: unknown): SheetScalar | undefined {
  switch (spec.type) {
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
      const whole = spec.integer ? Math.round(value) : value;
      return Math.min(spec.max, Math.max(spec.min, whole));
    }
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "enum":
      return spec.values.find((candidate) => sameName(candidate, value));
    case "dice":
      return typeof value === "string" && value.length <= 40 ? value : undefined;
    default:
      return typeof value === "string" ? value.slice(0, spec.maxLength) : undefined;
  }
}

/** The column a row is known by: the first text column, which is its name in every list a ruleset
 *  writes. A list with none has no name to match a catalog entry by. */
function nameColumnOf(list: RulesetList): RulesetListColumn | undefined {
  return list.columns.find((column) => column.type === "text");
}

/** The catalog entry a proposed row is: the one its mark names, or the one its name matches, out of
 *  the catalogs that feed this list and were loaded for the fight. */
function entryFor(
  definition: RulesetDefinition,
  list: RulesetList,
  row: Record<string, unknown>,
  catalogs: RulesetCatalogEntriesById,
): { catalogId: string; entry: RulesetCatalogEntry } | null {
  const feeding = (definition.catalogs ?? []).filter((catalog) => catalog.feeds?.includes(list.id));
  const mark = row[RULESET_CATALOG_ROW_KEY];
  if (typeof mark === "string") {
    const slash = mark.indexOf("/");
    const catalogId = mark.slice(0, slash);
    const entry = feeding.some((catalog) => catalog.id === catalogId)
      ? catalogs[catalogId]?.find((candidate) => candidate.id === mark.slice(slash + 1))
      : undefined;
    if (entry) return { catalogId, entry };
  }
  const nameColumn = nameColumnOf(list);
  const name = nameColumn ? row[nameColumn.id] : undefined;
  if (typeof name !== "string") return null;
  for (const catalog of feeding) {
    const entry = catalogs[catalog.id]?.find((candidate) => {
      const own = candidate.rows?.find((entryRow) => entryRow.list === list.id);
      return !!own && (sameName(candidate.label, name) || sameName(own.values[nameColumn!.id], name));
    });
    if (entry) return { catalogId: catalog.id, entry };
  }
  return null;
}

/**
 * A Game Master's sheet with each of `names` on it as the catalog entry of that name (laptop playtest
 * 2026-10-25: an invented cult mage given a Counterspell reaction, which this ruleset has as a spell,
 * never countered): a row naming it on the first list a catalog holding it feeds, unless a row there
 * names it already. Returns the names it found nowhere, for the caller to say.
 */
export function rulesetProposedSheetWithEntries(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  names: readonly string[],
  catalogs: RulesetCatalogEntriesById,
): { sheet: RulesetSheetBuild; missing: string[] } {
  const lists: Record<string, Array<Record<string, unknown>>> = Object.fromEntries(
    Object.entries(proposed.lists ?? {}).map(([id, rows]) => [id, Array.isArray(rows) ? [...rows] : []]),
  );
  const missing: string[] = [];
  for (const name of names) {
    const placed = definition.sheet.lists.some((list) => {
      const nameColumn = nameColumnOf(list);
      if (!nameColumn || !(definition.catalogs ?? []).some((catalog) => catalog.feeds?.includes(list.id))) return false;
      const found = entryFor(definition, list, { [nameColumn.id]: name }, catalogs);
      if (!found) return false;
      const rows = (lists[list.id] ??= []);
      const mark = `${found.catalogId}/${found.entry.id}`;
      const already = rows.some(
        (row) =>
          row[RULESET_CATALOG_ROW_KEY] === mark || entryFor(definition, list, row, catalogs)?.entry === found.entry,
      );
      if (!already) rows.push({ [nameColumn.id]: name });
      return true;
    });
    if (!placed) missing.push(name);
  }
  return { sheet: { ...proposed, lists: lists as RulesetSheetBuild["lists"] }, missing };
}

/** The rows an entry writes onto OTHER lists than the one it was named or filled in on, such as the
 *  counter that tracks a feature beside the feature itself, added once each, the way picking the
 *  entry adds them to a character's sheet. Without them a feature whose uses a counter tracks
 *  could never be used. */
function addCompanionRows(
  definition: RulesetDefinition,
  sheet: RulesetSheetBuild,
  catalogId: string,
  entry: RulesetCatalogEntry,
  listId: string,
): void {
  const mark = `${catalogId}/${entry.id}`;
  for (const row of entry.rows ?? []) {
    if (row.list === listId) continue;
    const list = definition.sheet.lists.find((candidate) => candidate.id === row.list);
    if (!list) continue;
    const rows = (sheet.lists[row.list] ??= []);
    if (rows.length >= list.maxItems || rows.some((existing) => existing[RULESET_CATALOG_ROW_KEY] === mark)) continue;
    rows.push({
      ...row.values,
      [RULESET_CATALOG_ROW_KEY]: mark,
      ...(row.standsFor ? { [RULESET_STANDS_FOR_ROW_KEY]: row.standsFor } : {}),
    });
  }
}

/**
 * A Game Master's sheet, read leniently against the ruleset: every id kept is one the ruleset
 * declares and every value one its field or column can hold, and a row named after a catalog entry
 * becomes that entry's row with the Game Master's own values on top. `catalogs` are the ones loaded
 * for the fight; a row whose catalog was not loaded simply stays the row it was written as.
 */
export function readProposedRulesetSheet(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const declared = definition.sheet;
  const adjusted: string[] = [];
  const unknown: string[] = [];
  const sheet: RulesetSheetBuild = { abilities: {}, skills: {}, saves: {}, bonuses: {}, fields: {}, lists: {} };

  for (const [id, value] of Object.entries(proposed.abilities ?? {})) {
    const ability = declared.abilities.find((candidate) => candidate.id === id);
    if (!ability) {
      unknown.push(id);
      continue;
    }
    const kept = Math.min(ability.max, Math.max(ability.min, Math.round(value)));
    if (kept !== value) adjusted.push(`${ability.label} ${value} was set to ${kept}.`);
    sheet.abilities[id] = kept;
  }

  const tierIds = definition.resolution.proficiencyTiers.map((tier) => tier.id);
  for (const key of ["skills", "saves"] as const) {
    const ids = new Set(declared[key].map((entry) => entry.id));
    const offered = new Set((key === "skills" ? declared.skillTiers : declared.saveTiers) ?? tierIds);
    for (const [id, tier] of Object.entries(proposed[key] ?? {})) {
      if (!ids.has(id)) {
        unknown.push(id);
        continue;
      }
      const kept = [...offered].find((candidate) => sameName(candidate, tier));
      if (!kept) {
        adjusted.push(`"${tier}" is not offered for ${id}, so it was left at the ruleset's default.`);
        continue;
      }
      sheet[key][id] = kept;
    }
  }

  const skillOrSave = new Set([...declared.skills, ...declared.saves].map((entry) => entry.id));
  const { min, max } = declared.bonusRange;
  for (const [id, value] of Object.entries(proposed.bonuses ?? {})) {
    if (!skillOrSave.has(id)) {
      unknown.push(id);
      continue;
    }
    const kept = Math.min(max, Math.max(min, Math.round(value)));
    if (kept !== value) adjusted.push(`The bonus on ${id} was set to ${kept}.`);
    sheet.bonuses[id] = kept;
  }

  for (const [id, value] of Object.entries(proposed.fields ?? {})) {
    const field = declared.fields.find((candidate) => candidate.id === id);
    if (!field) {
      unknown.push(id);
      continue;
    }
    const kept = fitted(field, value);
    if (kept === undefined) {
      adjusted.push(`${field.label} could not hold ${JSON.stringify(value)}, so it was left at the ruleset's default.`);
      continue;
    }
    if (kept !== value) adjusted.push(`${field.label} ${JSON.stringify(value)} was set to ${JSON.stringify(kept)}.`);
    sheet.fields[id] = kept;
  }

  // An entry the sheet names by a level it sets (5e's level_cleric, which choosing Cleric sets) sets
  // the rest of what choosing it sets too, where the sheet left it out (laptop playtest 2026-10-25: a
  // cleric 4 written with no spellcasting ability had no slots and a save DC of 10). One per group of
  // entries a sheet takes only one of, the highest level first.
  const named: Array<{ entry: RulesetCatalogEntry; by: string[]; level: number }> = [];
  for (const entries of Object.values(catalogs)) {
    for (const entry of entries) {
      if (!entry.exclusive || !entry.grants?.sets) continue;
      const by = Object.entries(entry.grants.sets).flatMap(([id, value]) =>
        typeof value === "number" && value > 0 && typeof proposed.fields?.[id] === "number" && id in sheet.fields
          ? [id]
          : [],
      );
      if (by.length > 0) named.push({ entry, by, level: Math.max(...by.map((id) => sheet.fields[id] as number)) });
    }
  }
  // Each level read once, by the first entry that sets it (a Cleric, never a Cleric taken second too).
  const taken = new Set<string>();
  for (const { entry, by } of named.sort((a, b) => b.level - a.level)) {
    if (taken.has(`group:${entry.exclusive}`) || by.some((id) => taken.has(id))) continue;
    taken.add(`group:${entry.exclusive}`);
    for (const id of by) taken.add(id);
    const filled: string[] = [];
    for (const [id, value] of Object.entries(entry.grants!.sets!)) {
      if (proposed.fields?.[id] !== undefined || sheet.fields[id] !== undefined) continue;
      const field = declared.fields.find((candidate) => candidate.id === id);
      const kept = field ? fitted(field, value) : undefined;
      if (kept === undefined) continue;
      sheet.fields[id] = kept;
      filled.push(field!.label);
    }
    if (filled.length > 0)
      adjusted.push(`${listed(filled)} set as ${entry.label} sets ${filled.length === 1 ? "it" : "them"}.`);
  }

  const nothing: string[] = [];
  const picked: Array<{ catalogId: string; entry: RulesetCatalogEntry; listId: string }> = [];
  for (const [listId, rows] of Object.entries(proposed.lists ?? {})) {
    const list = declared.lists.find((candidate) => candidate.id === listId);
    if (!list) {
      unknown.push(listId);
      continue;
    }
    const fedByACatalog = (definition.catalogs ?? []).some((catalog) => catalog.feeds?.includes(list.id));
    const kept: Array<Record<string, SheetScalar>> = [];
    let overflow = false;
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || typeof row !== "object") continue;
      const own: Record<string, SheetScalar> = {};
      for (const column of list.columns) {
        const value = fitted(column, (row as Record<string, unknown>)[column.id]);
        if (value !== undefined) own[column.id] = value;
      }
      const found = entryFor(definition, list, row as Record<string, unknown>, catalogs);
      const entryRow = found?.entry.rows?.find((candidate) => candidate.list === list.id);
      const entryValues = entryRow?.values ?? {};
      const nameColumn = nameColumnOf(list);
      // The Game Master's own values on top of the entry's, except its name, which is the entry's:
      // "ember lance" is Ember Lance, and the sheet's `use` command knows it by that name.
      const built: Record<string, SheetScalar> = found
        ? {
            ...entryValues,
            ...own,
            ...(nameColumn && entryValues[nameColumn.id] !== undefined
              ? { [nameColumn.id]: entryValues[nameColumn.id]! }
              : {}),
            [RULESET_CATALOG_ROW_KEY]: `${found.catalogId}/${found.entry.id}`,
            ...(entryRow?.standsFor ? { [RULESET_STANDS_FOR_ROW_KEY]: entryRow.standsFor } : {}),
          }
        : own;
      if (list.columns.some((column) => column.required && built[column.id] === undefined)) continue;
      // Past the list's own limit a row is not kept, so it brings no companion and is named in no line.
      if (kept.length >= list.maxItems) {
        overflow = true;
        continue;
      }
      // A spell the Game Master named is one it has ready: in a list whose rows count only once they
      // are chosen, naming the entry is choosing it.
      const chosenBy = found ? readyColumnOf(definition, list.id) : undefined;
      if (chosenBy) built[chosenBy] = true;
      if (found) picked.push({ ...found, listId: list.id });
      if (!found && fedByACatalog) {
        const name = nameColumn ? built[nameColumn.id] : undefined;
        if (typeof name === "string") nothing.push(name);
      }
      kept.push(built);
    }
    if (overflow) adjusted.push(`Only the first ${list.maxItems} rows of ${list.label} were kept.`);
    if (kept.length > 0) sheet.lists[listId] = kept;
  }

  for (const { catalogId, entry, listId } of picked) addCompanionRows(definition, sheet, catalogId, entry, listId);
  if (unknown.length > 0) {
    adjusted.push(`${listed(unknown)} ${unknown.length === 1 ? "is" : "are"} not on this ruleset's sheet, so dropped.`);
  }
  if (nothing.length > 0) {
    adjusted.push(
      `${listed(nothing)} ${nothing.length === 1 ? "is" : "are"} in no catalog of this ruleset, so ${nothing.length === 1 ? "it does" : "they do"} nothing in a fight.`,
    );
  }
  return { sheet, adjusted };
}

/** The boolean column a fight reads to know a row of this list is ready (5e's "prepared"), when a
 *  combat ability source says its rows count only once chosen. Such a list is one a creature
 *  CHOOSES from, which is what makes it a list whose open choices can be filled in. */
function readyColumnOf(definition: RulesetDefinition, listId: string): string | undefined {
  return definition.combat?.abilities?.find((source) => source.list === listId && source.onlyWhen)?.onlyWhen;
}

/** The sheet fields a catalog is organised by: every filter that `startFrom`s one says which of its
 *  entries belong to a sheet with that value, 5e's spell list by class. Nothing here knows either
 *  word; the ruleset says it. */
function boundFilters(definition: RulesetDefinition, catalogId: string) {
  const catalog = definition.catalogs?.find((candidate) => candidate.id === catalogId);
  return (catalog?.filters ?? []).flatMap((filter) => {
    const fieldId = filter.startFrom?.field;
    const field = definition.sheet.fields.find((candidate) => candidate.id === fieldId);
    return fieldId && field ? [{ filter, field }] : [];
  });
}

/** Whether a catalog entry is open to this sheet under every filter its catalog binds to a field,
 *  matched the way the picker opens on it. A sheet that leaves such a field empty has nothing open. */
function entryOpenTo(
  definition: RulesetDefinition,
  catalogId: string,
  entry: RulesetCatalogEntry,
  sheet: RulesetSheetBuild,
  /** The whole catalog, when a value it never names opens all of it: a sheet's own invention (an
   *  "Orc War-Shaman") is no class of the ruleset's to hold its spells to. */
  everything?: readonly RulesetCatalogEntry[],
): boolean {
  const valuesOf = (one: RulesetCatalogEntry, filterId: string) => {
    const value = one.filters?.[filterId];
    return (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((candidate) =>
      String(candidate).trim().toLowerCase(),
    );
  };
  return boundFilters(definition, catalogId).every(({ filter, field }) => {
    const texts = sheetFieldMatchTexts(field, sheet.fields[field.id]).map((text) => text.trim().toLowerCase());
    if (valuesOf(entry, filter.id).some((candidate) => texts.includes(candidate))) return true;
    // No value at all (an invented Cult Necromancer with no Class) holds it to nothing either.
    return (
      !!everything && !everything.some((one) => valuesOf(one, filter.id).some((candidate) => texts.includes(candidate)))
    );
  });
}

/**
 * Only the entries the ruleset opens to this sheet: a row out of a catalog whose filters are bound
 * to a sheet field (5e's spells by class) is kept only when the sheet's own value opens it. Rows not
 * out of such a catalog are untouched, and so is every row of one whose value the catalog never
 * names (laptop playtest 2026-10-24: an invented "Orc War-Shaman" lost Bane, Cure Wounds and Guiding
 * Bolt). What went is said, and why.
 */
export function restrictRulesetSheetEntries(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const sheet = structuredClone(proposed);
  const shut = new Map<string, string[]>();
  for (const [listId, rows] of Object.entries(sheet.lists)) {
    sheet.lists[listId] = rows.filter((row) => {
      const mark = row[RULESET_CATALOG_ROW_KEY];
      if (typeof mark !== "string") return true;
      const catalogId = mark.slice(0, mark.indexOf("/"));
      const entry = catalogs[catalogId]?.find((candidate) => candidate.id === mark.slice(mark.indexOf("/") + 1));
      if (!entry || entryOpenTo(definition, catalogId, entry, sheet, catalogs[catalogId])) return true;
      const reason = boundFilters(definition, catalogId)
        .map(({ field }) => {
          const value = sheet.fields[field.id] ?? field.default;
          return value === undefined || value === "" ? `no ${field.label}` : `${field.label} ${value}`;
        })
        .join(" and ");
      shut.set(reason, [...(shut.get(reason) ?? []), entry.label]);
      return false;
    });
  }
  const adjusted = [...shut].map(
    ([reason, names]) =>
      `${listed(names)} ${names.length === 1 ? "is" : "are"} not open to a sheet with ${reason} in this ruleset, so dropped.`,
  );
  return { sheet, adjusted };
}

type Nature = "offense" | "support" | "control" | "meta" | "other";

/** What an entry is for in a fight, read off its mechanics: dealing harm, holding up an ally,
 *  holding back a foe, or bending the turn itself (a reaction, a counter, an extra action). */
function natureOf(entry: RulesetCatalogEntry): Nature {
  const mechanics = entry.mechanics;
  if (!mechanics) return "other";
  if (mechanics.reaction || mechanics.gives || mechanics.standard || mechanics.kind === "rider") return "meta";
  if (mechanics.kind === "heal" || mechanics.kind === "buff" || mechanics.temporary) return "support";
  if (mechanics.kind === "debuff") return "control";
  if (mechanics.kind === "attack") return mechanics.amount ? "offense" : "control";
  return "other";
}

/** How strongly each temperament reaches for each kind of entry. One where nothing is said is 1. */
const LEANING: Record<CombatTactics["adjective"], Partial<Record<Nature, number>>> = {
  mindless: { offense: 3, support: 0.5, control: 0.5, meta: 0.25 },
  reckless: { offense: 3, support: 0.5, control: 0.75 },
  cautious: { control: 2, support: 1.5, meta: 1.5 },
  opportunistic: { offense: 2, control: 2 },
  protective: { support: 3, control: 1.5 },
  supportive: { support: 4, meta: 1.5, offense: 0.5 },
  disciplined: { offense: 1.5, control: 1.5, meta: 1.5 },
  cowardly: { control: 2, meta: 2, support: 1.5, offense: 0.5 },
  patient: { control: 2, meta: 2 },
  methodical: { control: 2.5, meta: 1.5 },
  coordinated: { support: 2, control: 2 },
  fanatical: { offense: 3, support: 1.5 },
  arrogant: { offense: 2.5 },
  territorial: { offense: 2, control: 2 },
  cruel: { control: 2.5, offense: 2 },
  honourable: { offense: 2, support: 1.5, meta: 0.5 },
  hungry: { offense: 2.5, control: 2 },
};

const COMPETENCE = ["novice", "trained", "veteran", "master"] as const;

/** How many open choices one rung of pools is given, and how many things it can use at will, by
 *  competence: a master has more ready than a novice.
 *  ponytail: a fixed count per rung, because no ruleset declares how many choices a class has. The
 *  upgrade path is a ruleset-declared count, read here in place of these. */
const PER_RUNG = [1, 2, 2, 3] as const;
const AT_WILL = [2, 2, 3, 3] as const;

/**
 * The choices a sheet left open, filled by its temperament and competence rather than by another
 * model call: for every list a creature chooses from (see `readyColumnOf`), and out of the entries
 * the ruleset opens to it (see `entryOpenTo`) and it can pay for from its own pools, each rung is
 * topped up to a small count and what it can use at will likewise. A protective creature reaches for
 * what holds up its side, a reckless one for harm, and the more competent it is the likelier it is to
 * carry what bends the turn. Drawn from `key`, so the same fight always fills the same way.
 */
export function fillRulesetSheetChoices(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  tactics: Pick<CombatTactics, "proficiency" | "adjective">,
  key: string,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const sheet = structuredClone(proposed);
  const competence = Math.max(0, COMPETENCE.indexOf(tactics.proficiency));
  // Read off `proposed`, not the clone: the clone is written below, and is read only after (see
  // `withRulesetSheetEvaluationCache`).
  const pools = new Map(readRulesetLive(definition, proposed, {}).pools.map((pool) => [pool.key, pool.max]));
  const groups = new Map<string, string[]>();
  for (const pool of definition.sheet.live.pools) {
    if (pool.group) groups.set(pool.group, [...(groups.get(pool.group) ?? []), pool.id]);
  }
  const has = (target: string) =>
    (pools.get(target) ?? 0) > 0 || (groups.get(target) ?? []).some((pool) => (pools.get(pool) ?? 0) > 0);
  const rungOf = (entry: RulesetCatalogEntry) => entry.mechanics?.cost?.[0]?.pool ?? "";
  const payable = (entry: RulesetCatalogEntry) => (entry.mechanics?.cost ?? []).every((term) => has(term.pool));
  const filled: string[] = [];

  for (const list of definition.sheet.lists) {
    const ready = readyColumnOf(definition, list.id);
    if (!ready) continue;
    const rows = (sheet.lists[list.id] ??= []);
    const held = new Set(rows.map((row) => row[RULESET_CATALOG_ROW_KEY]).filter((mark) => typeof mark === "string"));
    const candidates = (definition.catalogs ?? [])
      .filter((catalog) => catalog.feeds?.includes(list.id) && boundFilters(definition, catalog.id).length > 0)
      .flatMap((catalog) =>
        (catalogs[catalog.id] ?? [])
          .filter(
            (entry) =>
              entry.mechanics &&
              entry.rows?.some((row) => row.list === list.id) &&
              !held.has(`${catalog.id}/${entry.id}`) &&
              entryOpenTo(definition, catalog.id, entry, sheet) &&
              payable(entry),
          )
          .map((entry) => ({ catalogId: catalog.id, entry })),
      );
    // What it already has counts toward each rung, whoever chose it.
    const count = new Map<string, number>();
    for (const row of rows) {
      const mark = row[RULESET_CATALOG_ROW_KEY];
      if (typeof mark !== "string") continue;
      const entry = catalogs[mark.slice(0, mark.indexOf("/"))]?.find(
        (candidate) => candidate.id === mark.slice(mark.indexOf("/") + 1),
      );
      if (entry) count.set(rungOf(entry), (count.get(rungOf(entry)) ?? 0) + 1);
    }
    for (const rung of [...new Set(candidates.map(({ entry }) => rungOf(entry)))]) {
      let pool = candidates.filter(({ entry }) => rungOf(entry) === rung);
      const want = (rung === "" ? AT_WILL : PER_RUNG)[competence]! - (count.get(rung) ?? 0);
      for (let draw = 0; draw < want && pool.length > 0 && rows.length < list.maxItems; draw++) {
        const weights = pool.map(({ entry }) => {
          const nature = natureOf(entry);
          const leaning = LEANING[tactics.adjective][nature] ?? (nature === "other" ? 0.5 : 1);
          return leaning * (nature === "meta" ? 0.25 + (2 * competence) / 3 : 1);
        });
        let roll =
          (combatAiHash(`${key}:${list.id}:${rung}:${draw}`) / 0x100000000) *
          weights.reduce((total, weight) => total + weight, 0);
        let picked = pool.length - 1;
        for (let index = 0; index < pool.length; index++) {
          roll -= weights[index]!;
          if (roll < 0) {
            picked = index;
            break;
          }
        }
        const { catalogId, entry } = pool[picked]!;
        pool = pool.filter((_, index) => index !== picked);
        const own = entry.rows?.find((row) => row.list === list.id);
        rows.push({
          ...(own?.values ?? {}),
          [ready]: true,
          [RULESET_CATALOG_ROW_KEY]: `${catalogId}/${entry.id}`,
          ...(own?.standsFor ? { [RULESET_STANDS_FOR_ROW_KEY]: own.standsFor } : {}),
        });
        addCompanionRows(definition, sheet, catalogId, entry, list.id);
        filled.push(entry.label);
      }
    }
    if (rows.length === 0) delete sheet.lists[list.id];
  }
  return {
    sheet,
    adjusted:
      filled.length > 0
        ? [`Filled in for a ${tactics.proficiency}, ${tactics.adjective} creature: ${listed(filled)}.`]
        : [],
  };
}

/** The number field the ruleset's health pool is read off: its maximum IS the field, or is a sum with
 *  exactly one field in it. Anything else is a formula the Engine does not try to invert. */
function healthField(definition: RulesetDefinition, poolId: string): Extract<RulesetField, { type: "number" }> | null {
  const pool = definition.sheet.live.pools.find((candidate) => candidate.id === poolId);
  let fieldId = pool?.max.field;
  if (!fieldId && pool?.max.derived) {
    const derived = definition.sheet.derived.find((candidate) => candidate.id === pool.max.derived);
    const fields = derived?.op === "sum" ? derived.of.filter((ref) => ref.field !== undefined) : [];
    if (fields.length === 1) fieldId = fields[0]!.field;
  }
  const field = definition.sheet.fields.find((candidate) => candidate.id === fieldId);
  return field?.type === "number" ? field : null;
}

/** How many entries paid for out of a pool family (5e's leveled spells, off its spell slots) an
 *  invented caster keeps (Alyssa, 2026-10-25): enough for one role, "unless it's supposed to be some
 *  legendary Elminster or Daurgothoth level entity or literal Deity". */
export const RULESET_INVENTED_CASTER_MOST = 6;

/**
 * An invented caster sent with none of the pools its spells are paid out of (5e's spell slots: a
 * sheet with no class level, laptop playtest 2026-10-25, cast Chill Touch for 11 rounds with its
 * leveled spells dropped) has the one number field that opens them raised, a step at a time, until
 * as many of its spells as that field can pay for are paid for, at the lowest value that does. Of
 * several such fields, the one that pays for the most, then the one whose label the sheet names most
 * (its class "Wizard", its spells' classes: so a wizard's slots come back as a wizard's do), then the
 * lowest. A sheet with any of those
 * pools is the Game Master's own and never touched. What changed is said.
 */
export function raiseRulesetCasterPools(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const pools = definition.sheet.live.pools;
  const family = (id: string) => pools.find((pool) => pool.id === id)?.group;
  const familyOf = new Map(pools.flatMap((pool) => (pool.group !== undefined ? [[pool.id, pool.group]] : [])));
  // The rows paid out of a family, with the family each is paid out of.
  const wanted: Array<{ label: string; group: string }> = [];
  for (const rows of Object.values(proposed.lists)) {
    for (const row of rows) {
      const mark = row[RULESET_CATALOG_ROW_KEY];
      if (typeof mark !== "string") continue;
      const entry = catalogs[mark.slice(0, mark.indexOf("/"))]?.find(
        (candidate) => candidate.id === mark.slice(mark.indexOf("/") + 1),
      );
      if (!entry?.mechanics) continue;
      const asked = planRulesetUse(definition, proposed, {}, catalogs, { op: "use", name: entry.label });
      const spent = asked.ok
        ? asked.steps.find((step) => step.op.op === "spend" && familyOf.has(step.op.pool))
        : undefined;
      if (spent) wanted.push({ label: entry.label, group: family((spent.op as { pool: string }).pool)! });
    }
  }
  if (wanted.length === 0) return { sheet: proposed, adjusted: [] };
  const groups = new Set(wanted.map((one) => one.group));
  const open = (build: RulesetSheetBuild) =>
    readRulesetLive(definition, build, {}).pools.some(
      (pool) => groups.has(familyOf.get(pool.key) ?? "") && pool.max > 0,
    );
  if (open(proposed)) return { sheet: proposed, adjusted: [] };
  const paidFor = (build: RulesetSheetBuild) =>
    wanted.filter(({ label }) => {
      const pools = definition.sheet.live.pools;
      const plan = planRulesetUse(definition, build, {}, catalogs, { op: "use", name: label });
      if (!plan.ok) return false;
      const spent = plan.steps.find((step) => step.op.op === "spend")?.op as { pool: string } | undefined;
      const own = pools.find((pool) => pool.id === spent?.pool);
      const rungs = own?.group !== undefined ? pools.filter((pool) => pool.group === own.group) : [];
      // Out of its own pool or a bigger one of the family, as `capRulesetCasterSheet` reads it.
      return [undefined, ...rungs.slice(rungs.indexOf(own!) + 1).map((pool) => pool.id)].some((pool) => {
        const tried = planRulesetUse(definition, build, {}, catalogs, {
          op: "use",
          name: label,
          ...(pool ? { pool } : {}),
        });
        if (!tried.ok) return false;
        let live: unknown = {};
        for (const step of tried.steps) {
          const result = applyRulesetSheetOp(definition, build, live, step.op);
          if (!result.ok) return false;
          live = result.live;
        }
        return true;
      });
    }).length;
  // The words the sheet says of itself: its text and choice fields, and its rows' text.
  const said = [
    ...Object.values(proposed.fields),
    ...Object.values(proposed.lists).flatMap((rows) => rows.flatMap((row) => Object.values(row))),
  ]
    .flatMap((value) => (typeof value === "string" ? [value] : Array.isArray(value) ? value.map(String) : []))
    .map((value) => ` ${value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `);
  const named = (label: string) => {
    const word = ` ${label
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()} `;
    return word.trim() ? said.filter((text) => text.includes(word)).length : 0;
  };
  // Each way to open them: a number field raised alone, or an entry that sets one (5e's classes,
  // whose own Spellcasting ability shows the slots at all), its other fields set where the sheet
  // wrote none, then that field raised (cloud re-test 2026-10-25: a wizard with no level and no
  // casting ability kept only its cantrips).
  const ways: Array<{
    label: string;
    base: RulesetSheetBuild;
    field: Extract<RulesetField, { type: "number" }>;
    entry?: true;
  }> = [];
  for (const field of definition.sheet.fields)
    if (field.type === "number" && field.integer) ways.push({ label: field.label, base: proposed, field });
  for (const entries of Object.values(catalogs))
    for (const entry of entries) {
      const sets = entry.grants?.sets;
      if (!sets) continue;
      const base = structuredClone(proposed);
      let raised: Extract<RulesetField, { type: "number" }> | undefined;
      for (const [id, value] of Object.entries(sets)) {
        const field = definition.sheet.fields.find((one) => one.id === id);
        if (!field) continue;
        if (field.type === "number" && field.integer && typeof value === "number") raised ??= field;
        const written = proposed.fields[id];
        const unset =
          written === undefined ||
          written === "" ||
          (field.type === "enum" && written === (field.default ?? field.values[0]));
        if (unset) base.fields[id] = value;
      }
      if (raised) ways.push({ label: entry.label, base, field: raised, entry: true });
    }
  let best: ((typeof ways)[number] & { value: number; paid: number; named: number }) | undefined;
  for (const way of ways) {
    const { label, base, field } = way;
    const at = (value: number) => {
      const sheet = structuredClone(base);
      sheet.fields[field.id] = value;
      return sheet;
    };
    const from = typeof proposed.fields[field.id] === "number" ? (proposed.fields[field.id] as number) : field.min;
    if (from >= field.max || !open(at(field.max))) continue;
    // Only what its holder may cast counts: a class keeps to its own spell list.
    const pays = (sheet: RulesetSheetBuild) => paidFor(restrictRulesetSheetEntries(definition, sheet, catalogs).sheet);
    const most = pays(at(field.max));
    if (most === 0) continue;
    // The lowest value that pays for as many as its top does.
    let value = Math.max(from + 1, field.min);
    while (value < field.max && pays(at(value)) < most) value += 1;
    const names = named(label);
    if (
      !best ||
      most > best.paid ||
      (most === best.paid && (names > best.named || (names === best.named && value < best.value)))
    )
      best = { ...way, value, paid: most, named: names };
  }
  if (!best) return { sheet: proposed, adjusted: [] };
  const sheet = structuredClone(best.base);
  sheet.fields[best.field.id] = best.value;
  return {
    sheet,
    adjusted: [
      best.entry
        ? `Made a ${best.label} ${best.value}, so its spells have the pools they are paid out of.`
        : `${best.field.label} was set to ${best.value}, so its spells have the pools they are paid out of.`,
    ],
  };
}

/**
 * An invented caster held to its tier's damage: a spell whose damage alone, on average, is more than
 * the most its tier deals in a round goes (cloud re-test 2026-10-26: a boss stepped down to a CR 4's
 * numbers was made a 13th level caster to pay for Finger of Death, and kept it). Heals and rows not out
 * of a catalog are untouched. What went is said.
 */
export function holdRulesetCasterSpellDamage(
  proposed: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  tier: RulesetCombatThreatTier,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const cap = tier.damagePerRound[1];
  const sheet = structuredClone(proposed);
  const gone: string[] = [];
  for (const [listId, rows] of Object.entries(sheet.lists))
    sheet.lists[listId] = rows.filter((row) => {
      const mark = row[RULESET_CATALOG_ROW_KEY];
      if (typeof mark !== "string") return true;
      const catalogId = mark.slice(0, mark.indexOf("/"));
      const entry = catalogs[catalogId]?.find((candidate) => candidate.id === mark.slice(mark.indexOf("/") + 1));
      const mechanics = entry?.mechanics as { kind?: string; amount?: { dice?: string; flat?: number } } | undefined;
      if (!entry || !mechanics?.amount || mechanics.kind === "heal") return true;
      const average = rulesetActionAverage({ damage: mechanics.amount });
      if (average <= cap) return true;
      gone.push(`${entry.label} (${Math.round(average)})`);
      return false;
    });
  return {
    sheet,
    adjusted:
      gone.length > 0
        ? [`${gone.join(", ")} went: more damage on its own than ${tier.label} deals in a round (${cap} at most).`]
        : [],
  };
}

/**
 * An invented caster held to what it can cast: an entry its fresh sheet could never pay for (a 5th
 * level spell on a sheet with no 5th level slots) goes, and of those paid for out of a pool family
 * (spell slots, as against a cantrip or a ki feature) it keeps `most`, spread over its pools from the
 * biggest down. Rows not out of a catalog are untouched. What went is said.
 */
export function capRulesetCasterSheet(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  most = RULESET_INVENTED_CASTER_MOST,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const sheet = structuredClone(proposed);
  const families = new Set(
    definition.sheet.live.pools.flatMap((pool) => (pool.group !== undefined ? [pool.id, pool.group] : [])),
  );
  const pays = (name: string, pool?: string) => {
    const plan = planRulesetUse(definition, proposed, {}, catalogs, { op: "use", name, ...(pool ? { pool } : {}) });
    if (!plan.ok) return null;
    let live: unknown = {};
    for (const step of plan.steps) {
      const result = applyRulesetSheetOp(definition, proposed, live, step.op);
      if (!result.ok) return null;
      live = result.live;
    }
    return plan;
  };
  const uncastable: string[] = [];
  const over: string[] = [];
  // Each row paid out of a family, with how far up the family its own pool is (a spell's level).
  const paidRows = new Map<
    Record<string, unknown>,
    { label: string; rung: number; order: number; role?: "heal" | "control" }
  >();
  for (const [listId, rows] of Object.entries(sheet.lists)) {
    sheet.lists[listId] = rows.filter((row) => {
      const mark = row[RULESET_CATALOG_ROW_KEY];
      if (typeof mark !== "string") return true;
      const catalogId = mark.slice(0, mark.indexOf("/"));
      const entry = catalogs[catalogId]?.find((candidate) => candidate.id === mark.slice(mark.indexOf("/") + 1));
      if (!entry?.mechanics) return true;
      const asked = planRulesetUse(definition, proposed, {}, catalogs, { op: "use", name: entry.label });
      const fromFamily = (plan: typeof asked) =>
        plan.ok && plan.steps.some((step) => step.op.op === "spend" && families.has(step.op.pool));
      if (!asked.ok || !fromFamily(asked)) return true;
      // Out of its own pool, or a bigger one of the same family (a 2nd level spell off a 3rd level
      // slot), never a smaller one.
      const spent = asked.steps.find((step) => step.op.op === "spend")!.op as { pool: string };
      const pools = definition.sheet.live.pools;
      const own = pools.find((pool) => pool.id === spent.pool);
      const family = own?.group !== undefined ? pools.filter((pool) => pool.group === own.group) : [];
      const paid =
        pays(entry.label) ??
        family
          .slice(family.indexOf(own!) + 1)
          .map((pool) => pays(entry.label, pool.id))
          .find((plan) => plan);
      if (!paid) {
        uncastable.push(entry.label);
        return false;
      }
      const mechanics = entry.mechanics as { kind?: string; amount?: unknown; applies?: unknown[]; targets?: string };
      const role =
        mechanics.kind === "heal"
          ? ("heal" as const)
          : !mechanics.amount && (mechanics.applies?.length ?? 0) > 0 && mechanics.targets === "enemy"
            ? ("control" as const)
            : undefined;
      paidRows.set(row, {
        label: entry.label,
        rung: Math.max(0, family.indexOf(own!)),
        order: paidRows.size,
        ...(role ? { role } : {}),
      });
      return true;
    });
  }
  // Which it keeps: the first of its biggest, then its first heal and its first spell that holds a
  // foe, where it has them (laptop pass 6 2026-10-26: a druid's Cure Wounds, its only heal, went),
  // then the rest spread over its
  // pools from the biggest down, one of each in turn, as written within each (cloud re-test
  // 2026-10-25: a wizard 5 kept its six 1st and 2nd level spells, and Fireball, Counterspell and
  // Haste went).
  if (paidRows.size > most) {
    const byRung = new Map<number, Array<Record<string, unknown>>>();
    for (const [row, one] of [...paidRows].sort((a, b) => a[1].order - b[1].order))
      byRung.set(one.rung, [...(byRung.get(one.rung) ?? []), row]);
    const rungs = [...byRung.keys()].sort((a, b) => b - a);
    const keep = new Set<Record<string, unknown>>();
    const top = byRung.get(rungs[0]!)?.[0];
    if (top) keep.add(top);
    for (const role of ["heal", "control"] as const) {
      const first = [...paidRows].filter(([, one]) => one.role === role).sort((a, b) => a[1].order - b[1].order)[0];
      if (first && keep.size < most) keep.add(first[0]);
    }
    for (let turn = 0; keep.size < most; turn += 1)
      for (const rung of rungs) {
        const row = byRung.get(rung)![turn];
        if (row && keep.size < most) keep.add(row);
      }
    for (const [listId, rows] of Object.entries(sheet.lists))
      sheet.lists[listId] = rows.filter((row) => !paidRows.has(row) || keep.has(row));
    over.push(
      ...[...paidRows]
        .filter(([row]) => !keep.has(row))
        .sort((a, b) => a[1].order - b[1].order)
        .map(([, one]) => one.label),
    );
  }
  const adjusted: string[] = [];
  if (uncastable.length > 0)
    adjusted.push(
      `${listed(uncastable)} ${uncastable.length === 1 ? "is" : "are"} beyond what this sheet can pay for, so dropped.`,
    );
  if (over.length > 0)
    adjusted.push(`${listed(over)} went: an invented caster keeps ${most} of what it pays for out of its pools.`);
  return { sheet, adjusted };
}

/**
 * An invented sheet written with no ability scores, whose fields name the ability it works from (5e's
 * spellcasting ability), has that ability raised until what reads it reaches its tier: a number that
 * reads like a save difficulty up to the tier's, one that reads like a bonus to hit up to its to-hit
 * (laptop playtest 2026-10-25: a cleric 4 with no scores cast at DC 10 and +2). The ruleset's own
 * formulas say what each score gives; scores it did write are its own and never touched.
 */
export function raiseRulesetSheetAbilities(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  tier: RulesetCombatThreatTier,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  if (Object.keys(proposed.abilities ?? {}).length > 0) return { sheet: proposed, adjusted: [] };
  const declared = definition.sheet;
  const abilityIds = new Set(declared.abilities.filter((ability) => !ability.value).map((ability) => ability.id));
  const sheet = structuredClone(proposed);
  const adjusted: string[] = [];
  for (const field of declared.fields) {
    if (field.type !== "enum") continue;
    const ability = sheet.fields[field.id];
    if (typeof ability !== "string" || !abilityIds.has(ability)) continue;
    const reads = declared.derived.filter((derived) =>
      JSON.stringify(derived).includes(`"abilityModFromField":${JSON.stringify(field.id)}`),
    );
    if (reads.length === 0) continue;
    const valueOf = (build: RulesetSheetBuild) =>
      reads.map((derived) => resolveRulesetValueRef(definition, build, { derived: derived.id }));
    const start = valueOf(sheet);
    // Each is held to whichever of the tier's two numbers it is nearer.
    const targets = start.map((value) =>
      Math.abs(value - tier.saveDifficulty) <= Math.abs(value - tier.toHit) ? tier.saveDifficulty : tier.toHit,
    );
    const rule = declared.abilities.find((candidate) => candidate.id === ability)!;
    const from = sheet.abilities[ability] ?? rule.default;
    let score = from;
    while (score < rule.max && valueOf(sheet).some((value, index) => value < targets[index]!)) {
      score += 1;
      sheet.abilities[ability] = score;
    }
    if (score !== from) adjusted.push(`${rule.label} was set to ${score}, as no scores were written.`);
  }
  return { sheet, adjusted };
}

/**
 * Health into the tier's band, through the one field the ruleset's health is read off, so the sheet
 * itself says the new number and nothing downstream has to know it was held. A wound track's length
 * is the ruleset's own and is never changed; a formula with no single field in it is left as written,
 * and says so.
 */
export function holdRulesetSheetHealth(
  definition: RulesetDefinition,
  proposed: RulesetSheetBuild,
  tier: RulesetCombatThreatTier,
  /** The health the Game Master gave it, held to where it is inside the band (laptop playtest
   *  2026-10-25: three invented CR 3 foes sent at 45, 45 and 40 came out at 52, 52 and 32). */
  given?: number,
): { sheet: RulesetSheetBuild; adjusted: string[] } {
  const health = definition.combat?.health;
  if (!health || !("pool" in health)) return { sheet: proposed, adjusted: [] };
  const maxOf = (build: RulesetSheetBuild) =>
    readRulesetLive(definition, build, {}).pools.find((pool) => pool.key === health.pool)?.max ?? 0;
  const before = maxOf(proposed);
  const [low, high] = tier.health;
  const asked =
    given !== undefined && Number.isFinite(given) && given >= low && given <= high ? Math.round(given) : undefined;
  if (asked === undefined ? before >= low && before <= high : before === asked)
    return { sheet: proposed, adjusted: [] };
  const field = healthField(definition, health.pool);
  if (!field) {
    return {
      sheet: proposed,
      adjusted: [
        `Health ${before} is outside the ${low} to ${high} of ${tier.label}, and it is not read off one field of the sheet, so it was left as written.`,
      ],
    };
  }
  const target = asked ?? Math.min(high, Math.max(low, before));
  const bounded = (value: number) =>
    Math.min(field.max, Math.max(field.min, field.integer ? Math.round(value) : value));
  // The field moved by what health is short, then by what is still short, a few times: health need not
  // move one for one with it (laptop playtest 2026-10-25: 5e's health is the typed number where one is
  // typed and its fixed values where none is, so typing 5 over nothing gave 5, not 27 + 5). The typed
  // number at the target itself is tried too, and the closest of them is kept.
  const through = (base: RulesetSheetBuild) => {
    const start = maxOf(base);
    const current = resolveRulesetValueRef(definition, base, { field: field.id });
    const tried = new Map<number, { sheet: RulesetSheetBuild; after: number }>();
    const attempt = (value: number) => {
      const at = bounded(value);
      let found = tried.get(at);
      if (!found) {
        const sheet = structuredClone(base);
        sheet.fields[field.id] = at;
        found = { sheet, after: maxOf(sheet) };
        tried.set(at, found);
      }
      return { at, ...found };
    };
    let step = attempt(current + (target - start));
    attempt(target);
    for (let round = 0; round < 6 && step.after !== target; round++) {
      const next = attempt(step.at + (target - step.after));
      if (next.at === step.at) break;
      step = next;
    }
    return [...tried.values()].reduce((one, other) =>
      Math.abs(other.after - target) < Math.abs(one.after - target) ? other : one,
    );
  };
  const within = (value: number) => (asked === undefined ? value >= low && value <= high : value === asked);
  let best = through(proposed);
  let reset: Extract<RulesetField, { type: "enum" }> | undefined;
  // A choice the sheet made that health reads, and that leaves the field out of it, is set back to the
  // ruleset's own default when only that lets health be held (laptop playtest 2026-10-25: an invented
  // mage written with 5e's "Average" hit points, which never reads the typed number, stayed at 38 below
  // a band of 45 to 120). Only a choice that stops the field counting at all is one: a field that
  // counts but runs out of room, or a choice that moves health without the field (a creature's own
  // hit die, a class), is the sheet's to keep.
  const counts = (base: RulesetSheetBuild) => {
    const at = (value: number) => {
      const sheet = structuredClone(base);
      sheet.fields[field.id] = bounded(value);
      return maxOf(sheet);
    };
    return at(field.min) !== at(field.max);
  };
  if (!within(best.after) && !counts(proposed)) {
    for (const choice of healthChoices(definition, health.pool, proposed)) {
      const base = structuredClone(proposed);
      delete base.fields[choice.id];
      if (!counts(base)) continue;
      const held = through(base);
      if (within(held.after)) {
        best = held;
        reset = choice;
        break;
      }
    }
  }
  const { sheet, after } = best;
  // Already in the band, and not to be moved to the Game Master's own number: as written.
  if (asked !== undefined && after === before && before >= low && before <= high)
    return { sheet: proposed, adjusted: [] };
  const back = reset ? ` with its ${reset.label} set back to the ruleset's default` : "";
  return {
    sheet,
    adjusted: [
      asked !== undefined && after === asked
        ? `Health ${before} was set to the Game Master's ${asked} through its ${field.label}${back}.`
        : within(after) || (asked !== undefined && after >= low && after <= high)
          ? `Health ${before} was pulled into the ${low} to ${high} of ${tier.label} through its ${field.label}${back}, and is now ${after}.`
          : `Health ${before} was moved toward the ${low} to ${high} of ${tier.label} as far as its ${field.label} goes, and is now ${after}.`,
    ],
  };
}

/** The choices a sheet made away from the ruleset's default that its health pool's maximum reads. */
function healthChoices(
  definition: RulesetDefinition,
  poolId: string,
  sheet: RulesetSheetBuild,
): Array<Extract<RulesetField, { type: "enum" }>> {
  const pool = definition.sheet.live.pools.find((candidate) => candidate.id === poolId);
  const derived = new Map(definition.sheet.derived.map((entry) => [entry.id, entry]));
  const fields = new Set<string>();
  const seen = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    for (const [key, inner] of Object.entries(value)) {
      // Where a value is shown is not what it is.
      if (key === "hideWhen" || key === "$comment") continue;
      if (key === "field" && typeof inner === "string") fields.add(inner);
      else if (key === "derived" && typeof inner === "string") {
        if (seen.has(inner)) continue;
        seen.add(inner);
        walk(derived.get(inner));
      } else walk(inner);
    }
  };
  walk(pool?.max);
  return definition.sheet.fields.filter(
    (one): one is Extract<RulesetField, { type: "enum" }> =>
      one.type === "enum" &&
      fields.has(one.id) &&
      sheet.fields[one.id] !== undefined &&
      sheet.fields[one.id] !== (one.default ?? one.values[0]),
  );
}

/** The pools this combatant could pay out of right now, by id, for pricing a bigger payment. */
function poolValues(definition: RulesetDefinition, combatant: RulesetCombatant): Map<string, number> {
  const sheet = combatant.sheet;
  if (!sheet) return new Map();
  return new Map(
    readRulesetLive(definition, sheet.build, sheet.live, sheet.items).pools.map((pool) => [pool.key, pool.value]),
  );
}

/** How many rungs the biggest payment it can afford climbs, for an action that grows when paid for
 *  out of a bigger pool. */
function stepsAffordable(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
  pools: Map<string, number>,
): number {
  if (!action.use?.perCostStep) return 0;
  let steps = 0;
  // Its own family, and the pools of other groups that pay for it (1.171).
  const payers = definition.sheet.live.pools
    .filter((pool) => pool.pays?.includes(action.use!.group ?? ""))
    .map((pool) => pool.id);
  for (const pool of [...rulesetPoolFamily(definition, action.use.group), ...payers]) {
    if ((pools.get(pool) ?? 0) >= 1) steps = Math.max(steps, rulesetCostSteps(definition, action, pool, combatant));
  }
  return steps;
}

interface SheetRound {
  average: number;
  action: RulesetCombatAction | null;
  /** The actions the round is made of: a sequence's steps, or a striking row and the heaviest one
   *  the rest of its strikes may go to. */
  parts: RulesetCombatAction[];
}

/** The heaviest round one spend buys against one target (two, for what reaches more): every strike it buys, the biggest payment
 *  it can afford, and the heaviest rider counted once on top, exactly as the plain clamp counts.
 *  Strikes bought by one spend wait in hand and may go to ANY row that declares strikes, so a
 *  striking round is the row spent on and then the rest of its strikes on the heaviest such row. */
function bestSheetRound(definition: RulesetDefinition, combatant: RulesetCombatant): SheetRound {
  const pools = poolValues(definition, combatant);
  const byId = new Map(combatant.actions.map((action) => [action.id, action]));
  const rider = heaviestRider(combatant.riders);
  const carried = rider ? Math.max(0, rulesetAverageAmount(rider.amount)) : 0;
  const once = (action: RulesetCombatAction | undefined) => {
    if (!action?.damage) return 0;
    const steps = stepsAffordable(definition, combatant, action, pools);
    const grown = steps > 0 ? steps * rulesetAverageAmount(action.use!.perCostStep!) : 0;
    // What reaches more than one is counted on two of them, as a tier's damage a round is meant
    // (laptop pass 6 2026-10-26: a wizard 11 brought down to CR 8 kept a Chain Lightning of 45 on each
    // of four heroes, under a cap read for one).
    const reach = action.area || action.around || action.targets.count > 1 ? 2 : 1;
    return Math.max(0, (rulesetAverageDamage(action.damage) + grown) * reach);
  };
  const striking = combatant.actions.filter((action) => action.strikes !== undefined);
  const heaviestStrike = striking.reduce<RulesetCombatAction | null>(
    (best, action) => (!best || once(action) > once(best) ? action : best),
    null,
  );
  let best: SheetRound = { average: 0, action: null, parts: [] };
  for (const action of combatant.actions) {
    const parts = action.sequence
      ? action.sequence.flatMap((step) => {
          const part = byId.get(step.actionId);
          return part ? [part] : [];
        })
      : action.strikes !== undefined && heaviestStrike && heaviestStrike !== action
        ? [action, heaviestStrike]
        : [action];
    const average = action.sequence
      ? action.sequence.reduce(
          (total, step) => total + rulesetStepAverageTimes(step) * once(byId.get(step.actionId)),
          0,
        )
      : once(action) + Math.max(0, (action.strikes ?? 1) - 1) * once(heaviestStrike ?? action);
    const round = average > 0 ? average + carried : 0;
    if (round > best.average) {
      best = { average: round, action, parts };
    }
  }
  return best;
}

/**
 * What its points buy between turns is part of its round too, on top of its own best turn (laptop
 * 2026-10-26: a CR 3 Archlich's borrowed Disrupt Life, on the whole party with all 3 points, came on
 * top of a round already near the cap, and wiped four rested level-4 heroes). Each such action is
 * scaled down until its points' worth fits what the round leaves, and goes when it cannot. Any
 * invented opponent with points is held so, however it was built (laptop v3b 2026-10-26: one built
 * from a proposed block kept a full Disrupt Life).
 */
export function holdRulesetLegendary(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  tier: RulesetCombatThreatTier,
): string[] {
  const adjusted: string[] = [];
  const cap = tier.damagePerRound[1];
  const points = combatant.signature?.max ?? 0;
  if (points > 0) {
    const plain = bestSheetRound(definition, {
      ...combatant,
      actions: combatant.actions.filter((action) => !action.signature),
    }).average;
    const room = Math.max(0, cap - plain);
    const worth = (action: RulesetCombatAction) =>
      (bestSheetRound(definition, { ...combatant, actions: [action], riders: [] }).average * points) /
      Math.max(1, action.signature!.cost);
    const scaledDown: string[] = [];
    const dropped: string[] = [];
    for (const action of combatant.actions.filter((one) => one.signature && one.damage)) {
      let shaved = false;
      for (let guard = 0; guard < 200 && worth(action) > room; guard++) {
        const heaviest = [action.damage!, ...(action.damage!.plus ?? [])].sort(
          (left, right) => rulesetAverageAmount(right) - rulesetAverageAmount(left),
        )[0]!;
        if (!shave(heaviest)) break;
        shaved = true;
      }
      if (worth(action) > room) dropped.push(action.label);
      else if (shaved) scaledDown.push(action.label);
    }
    if (dropped.length > 0) {
      combatant.actions = combatant.actions.filter((action) => !dropped.includes(action.label) || !action.signature);
      adjusted.push(
        `${dropped.join(", ")} went from what its points buy: with its own turn, it would deal more in a round than the ${cap} of ${tier.label}.`,
      );
    }
    if (scaledDown.length > 0)
      adjusted.push(
        `${scaledDown.join(", ")}, bought with its points, was scaled down so its turn and its points together stay inside the ${cap} of ${tier.label}.`,
      );
  }
  return adjusted;
}

/** One amount a step down: fewer dice, then less flat, then a smaller die. False when there is
 *  nothing left to take without taking it to nothing. */
function shave(amount: RulesetCombatAmount): boolean {
  const rolls = amount.count > 0 && amount.sides > 0;
  if (amount.count > 1 && amount.sides > 0) amount.count -= 1;
  else if (amount.flat > (rolls ? 0 : 1)) amount.flat -= 1;
  else if (rolls && amount.sides > 2) amount.sides = smallerDie(amount.sides);
  else return false;
  return true;
}

/**
 * Defense, to-hit, save difficulties, contest checks and the best round of a BUILT opponent held to
 * its tier, on the combatant itself: those numbers are resolved once when a fight begins and read
 * from there, so this is the one place they have to change. Health is not here; `holdRulesetSheetHealth` set it on
 * the sheet before the fight was built.
 */
export function holdRulesetCombatant(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  tier: RulesetCombatThreatTier,
): string[] {
  const adjusted: string[] = [];
  const defenseCap = tier.defense + RULESET_CLAMP_HEADROOM;
  if (combatant.defense > defenseCap) {
    adjusted.push(`Defense ${combatant.defense} was lowered to ${defenseCap}.`);
    combatant.defense = defenseCap;
  }
  const toHitCap = tier.toHit + RULESET_CLAMP_HEADROOM;
  const difficultyCap = tier.saveDifficulty + RULESET_CLAMP_HEADROOM;
  for (const action of combatant.actions) {
    if (action.toHit !== undefined && action.toHit > toHitCap) {
      if (!action.id.startsWith("granted:"))
        adjusted.push(`"${action.label}" now hits at ${toHitCap} instead of ${action.toHit}.`);
      action.toHit = toHitCap;
    }
    const saves = [
      ...(action.save ? [action.save] : []),
      ...(action.damage?.plus ?? []).flatMap((clause) => (clause.save ? [clause.save] : [])),
    ];
    let lowered = saves.some((save) => save.difficulty > difficultyCap);
    for (const save of saves) save.difficulty = Math.min(save.difficulty, difficultyCap);
    if (action.saveDifficulty !== undefined && action.saveDifficulty > difficultyCap) {
      action.saveDifficulty = difficultyCap;
      lowered = true;
    }
    // Said only for what it has of its own: what a condition would give it (a Sunbeam's later line)
    // is held all the same, unsaid (laptop pass 6 2026-10-26: 17 lines for spells it did not know).
    if (lowered && !action.id.startsWith("granted:"))
      adjusted.push(`The save against "${action.label}" was lowered to ${difficultyCap}.`);
  }
  // A contest is won with a number added to the dice an attack throws, so it is held where a blow's
  // chance to land is.
  for (const [id, value] of Object.entries(combatant.checks ?? {})) {
    if (value <= toHitCap) continue;
    adjusted.push(`Its ${id} is now ${toHitCap} instead of ${value}.`);
    combatant.checks![id] = toHitCap;
  }

  // Damage last, in the plain clamp's order, with one step in front of it: what a bigger payment
  // buys says least about the creature, so it gives way first, then the dice, the flat part, a
  // strike, and only then the size of the die.
  const cap = tier.damagePerRound[1];
  // Holding changes numbers on the combatant, never what its pools hold, so they are read once.
  const pools = poolValues(definition, combatant);
  let scaled = false;
  let growth = false;
  for (let guard = 0; guard < 500; guard++) {
    const round = bestSheetRound(definition, combatant);
    if (round.average <= cap || !round.action) break;
    const action = round.action;
    const parts = round.parts;
    // Only a part that can really climb gives up what the climb buys: a striking row or a sequence's
    // step is measured for itself, not by the action the round was spent on.
    const grown = parts.find(
      (part) => part.use?.perCostStep && stepsAffordable(definition, combatant, part, pools) > 0,
    );
    if (grown?.use?.perCostStep) {
      if (!shave(grown.use.perCostStep)) delete grown.use.perCostStep;
      growth = true;
      scaled = true;
      continue;
    }
    // The rider the round counts is shaved like any other amount on it, as the plain clamp shaves it,
    // or a heavy one would leave the round over the cap with every action already at its least.
    const rider = heaviestRider(combatant.riders);
    const amounts = [
      ...parts.flatMap((part) => (part.damage ? [part.damage, ...(part.damage.plus ?? [])] : [])),
      ...(rider ? [rider.amount] : []),
    ].sort((left, right) => rulesetAverageAmount(right) - rulesetAverageAmount(left));
    const heaviest = amounts[0];
    if (heaviest && heaviest.count > 1 && heaviest.sides > 0) heaviest.count -= 1;
    else if (heaviest && heaviest.flat > (heaviest.count > 0 && heaviest.sides > 0 ? 0 : 1)) heaviest.flat -= 1;
    // One strike fewer on the row spent on. Any other row whose strikes still make too big a round
    // is measured by the round above, which counts strikes in hand going to the heaviest row.
    else if (!action.sequence && (action.strikes ?? 1) > 1) action.strikes = (action.strikes ?? 1) - 1;
    else if (!heaviest || !shave(heaviest)) break;
    scaled = true;
  }
  adjusted.push(...holdRulesetLegendary(definition, combatant, tier));
  if (growth) adjusted.push("What a bigger payment buys was scaled down to fit the tier.");
  if (scaled) {
    const left = Math.round(bestSheetRound(definition, combatant).average * 100) / 100;
    adjusted.push(
      left <= cap
        ? `The damage was scaled down until the best round averages ${left}, inside the ${tier.damagePerRound[0]} to ${cap} of ${tier.label}.`
        : `The damage was scaled down as far as it goes, and the best round still averages ${left} against the ${cap} of ${tier.label}.`,
    );
  }
  return adjusted;
}
