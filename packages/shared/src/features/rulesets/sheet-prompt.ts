// The compact sheet block one party member contributes to the Game Master prompt.
//
// It is a summary, not the sheet: what the Game Master needs to narrate honestly and to write a
// sheet command that will not be refused. Everything in it is named by the ruleset — the abilities,
// what counts as trained, which fields and lists are worth showing — so a system with no abilities
// and one pool renders one short line rather than an empty 5e skeleton.
//
// Every value that comes off the sheet is user-authored text on its way into a prompt, so it is
// flattened to one line, stripped of the characters that shape a tag or a macro, and capped.

import {
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetField,
  type RulesetListColumn,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { readRulesetLive } from "./live-state.js";
import { rulesetCatalogEntriesByRef } from "./scaled-rows.js";
import { evaluateRulesetSheet, formatRulesetCheckValue, isRulesetItemHidden } from "./sheet-math.js";

/** How much of one sheet value reaches the prompt. */
const MAX_VALUE_LENGTH = 80;
/** How many rows of one list are named. A longer list is a spellbook, not a summary. */
const MAX_LIST_NAMES = 40;

/** Sheet values are written by players and, through the note command, by the model itself, and
 *  the block they land in is wrapped in a tag in the prompt. Brackets and braces could forge a
 *  command or a macro; angle brackets could close that tag and speak as the Engine. */
function safeValue(value: string): string {
  return (
    value
      // Control characters AND the Unicode line and paragraph separators: either kind would start a
      // new logical line inside the sheet block, and a sheet value is one line.
      .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ")
      .replace(/[{}[\]<>]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, MAX_VALUE_LENGTH)
  );
}

function own(row: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined;
}

function cellText(value: unknown): string {
  if (typeof value === "string") return safeValue(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return "";
}

/** One cell as the sheet shows it: a cell the row leaves out reads as its column's default, the way
 *  the editor shows it, and an enum column's value reads by the label the ruleset gives it. */
function columnText(
  list: { columns: ReadonlyArray<RulesetListColumn> },
  id: string,
  row: Record<string, unknown>,
): string {
  const column = list.columns.find((candidate) => candidate.id === id);
  const stored = own(row, id);
  const value = stored === undefined ? column?.default : stored;
  if (column?.type === "boolean") return value === true ? safeValue(column.label) : "";
  if (column?.type === "enum" && typeof value === "string") return safeValue(column.valueLabels?.[value] ?? value);
  return cellText(value);
}

function fieldText(field: RulesetField, build: RulesetSheetBuild): string {
  const stored = build.fields?.[field.id];
  const value = stored === undefined ? field.default : stored;
  if (field.type === "enum" && typeof value === "string") return safeValue(field.valueLabels?.[value] ?? value);
  return cellText(value);
}

/** One party member's sheet, as the Game Master reads it. Deterministic and pure. */
export function renderRulesetSheetBlock(
  definition: RulesetDefinition,
  card: { name: string; build: RulesetSheetBuild },
  stored: unknown,
  catalogs: RulesetCatalogEntriesById = {},
): string {
  const { sheet, gm } = definition;
  const build = card.build;
  const live = readRulesetLive(definition, build, stored);
  const evaluated = evaluateRulesetSheet(definition, build, live);
  const catalogEntries = rulesetCatalogEntriesByRef(catalogs);
  const lines: string[] = [];
  const push = (line: string) => {
    if (line) lines.push(line);
  };

  push(safeValue(card.name));

  // A score is only ever shown through the ruleset's own modifier rule, so an `identity` system
  // shows its one number and a 3d6 system shows what it adds. How it is SPELLED follows the
  // resolution kind: a pool ruleset's number is dice, not a bonus, and "+5" would read as one.
  const checkValue = (value: number) => formatRulesetCheckValue(definition, value);
  push(
    sheet.abilities
      .map((ability) => `${ability.short ?? ability.label} ${checkValue(evaluated.abilityMods[ability.id] ?? 0)}`)
      .join(", "),
  );

  // "Trained" is whatever the ruleset's first tier is not: the first tier is the untrained default
  // every unmentioned skill takes, so listing it would list the whole sheet.
  const firstTier = definition.resolution.proficiencyTiers[0]!.id;
  const trained = [
    ...sheet.skills
      .filter((skill) => (evaluated.skillTiers[skill.id] ?? firstTier) !== firstTier)
      .map((skill) => `${skill.label} ${checkValue(evaluated.skillMods[skill.id] ?? 0)}`),
    ...sheet.saves
      .filter((save) => (evaluated.saveTiers[save.id] ?? firstTier) !== firstTier)
      .map((save) => `${save.label} ${checkValue(evaluated.saveMods[save.id] ?? 0)}`),
  ];
  if (trained.length > 0) push(`Trained: ${trained.join(", ")}`);

  const summary: string[] = [];
  for (const id of gm.sheetSummary.fields) {
    const field = sheet.fields.find((entry) => entry.id === id);
    if (!field || isRulesetItemHidden(field, build, definition)) continue;
    const value = fieldText(field, build);
    if (value) summary.push(`${field.label} ${value}`);
  }
  for (const id of gm.sheetSummary.derived) {
    const derived = sheet.derived.find((entry) => entry.id === id);
    if (!derived || isRulesetItemHidden(derived, build, definition)) continue;
    summary.push(`${derived.label} ${evaluated.derived[id] ?? 0}`);
  }
  push(summary.join(", "));

  push(
    live.pools
      .map((pool) => `${pool.label} ${pool.value}/${pool.max}${pool.temp > 0 ? ` +${pool.temp} temp` : ""}`)
      .join(", "),
  );

  // A track at its default says nothing: three death saves at zero are the absence of a fact. A
  // marked WOUND track says how far down it is, what that level is called and what it costs a roll,
  // because those three are exactly what the Game Master has to narrate honestly. A track the
  // ruleset marks `alwaysShow` is a rating that matters every turn, so it is said at its default too.
  const resolvedTracks = new Map(live.tracks.map((track) => [track.id, track]));
  push(
    sheet.live.tracks
      .flatMap((track) => {
        const resolved = resolvedTracks.get(track.id);
        if (!resolved) return [];
        if (resolved.wound) {
          if (resolved.value === 0 && resolved.wound.overflow === 0 && !track.alwaysShow) return [];
          const level = resolved.wound.levels[resolved.value - 1]?.label;
          const over = resolved.wound.overflow > 0 ? ` +${resolved.wound.overflow} over` : "";
          const penalty = resolved.wound.penalty !== 0 ? ` ${resolved.wound.penalty} to rolls` : "";
          return [
            `${track.label} ${resolved.value}/${resolved.max}${level ? ` ${safeValue(level)}` : ""}${penalty}${over}`,
          ];
        }
        // The maximum is the character's own, which is what the resolved track already holds.
        const fallback = Math.min(Math.max(track.default ?? track.min, track.min), resolved.max);
        return resolved.value === fallback && !track.alwaysShow ? [] : [`${track.label} ${resolved.value}`];
      })
      .join(", "),
  );

  push(
    live.text.flatMap((entry) => (entry.value.trim() ? [`${entry.label}: ${safeValue(entry.value)}`] : [])).join(", "),
  );

  const conditions = live.conditions.flatMap((condition) => (condition.active ? [condition.label] : []));
  if (conditions.length > 0) push(`Conditions: ${conditions.join(", ")}`);

  for (const entry of gm.sheetSummary.lists) {
    const list = sheet.lists.find((candidate) => candidate.id === entry.list);
    if (!list || isRulesetItemHidden(list, build, definition)) continue;
    const rows = build.lists?.[list.id];
    if (!Array.isArray(rows)) continue;
    const groups = new Map<string, string[]>();
    let named = 0;
    for (const row of rows) {
      if (named >= MAX_LIST_NAMES) break;
      if (!row || typeof row !== "object") continue;
      if (entry.onlyWhen !== undefined) {
        const column = list.columns.find((candidate) => candidate.id === entry.onlyWhen);
        const flag = own(row as Record<string, unknown>, entry.onlyWhen);
        const on = typeof flag === "boolean" ? flag : column?.type === "boolean" && (column.default ?? false);
        if (!on) continue;
      }
      const name = columnText(list, entry.nameColumn, row as Record<string, unknown>);
      if (!name) continue;
      // The columns the ruleset asked to see beside the name, as the sheet would show them: a rating
      // is its number, an enum its label, and a flag its column's label when it is set.
      const beside = (entry.columns ?? [])
        .map((id) => columnText(list, id, row as Record<string, unknown>))
        .filter(Boolean)
        .join(" ");
      const ref = own(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY);
      const mechanics = typeof ref === "string" ? catalogEntries.get(ref)?.mechanics : undefined;
      const cost = mechanics?.cost?.map((term) => `${term.amount} ${safeValue(term.pool)}`).join(" + ");
      const scaledCost = mechanics?.perCostStep && mechanics.cost?.length === 1 ? mechanics.cost[0] : undefined;
      const scale = scaledCost
        ? `; stronger use: spend="${safeValue(scaledCost.pool)}:N", where N is a positive multiple of ${scaledCost.amount}`
        : "";
      const check = mechanics?.check
        ? ` (check: ${JSON.stringify(mechanics.check)}${cost ? `; pool cost: ${cost}` : ""}${scale})`
        : "";
      const describedName = (beside ? `${name} ${beside}` : name) + check;
      const group = entry.groupBy === undefined ? "" : cellText(own(row as Record<string, unknown>, entry.groupBy));
      const bucket = groups.get(group);
      if (bucket) bucket.push(describedName);
      else groups.set(group, [describedName]);
      named += 1;
    }
    if (groups.size === 0) continue;
    push(
      entry.groupBy === undefined
        ? `${list.label}: ${[...groups.values()].flat().join(", ")}`
        : `${list.label} ${[...groups].map(([group, names]) => `(${group || "-"}): ${names.join(", ")}`).join("; ")}`,
    );
  }

  return lines.join("\n");
}
