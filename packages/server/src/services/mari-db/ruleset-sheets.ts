/**
 * Professor Mari reads and writes a Game Mode ruleset sheet on a persona
 * (`personaStats.rulesetSheets[rulesetId]`) or a character card
 * (`data.extensions.rulesetSheets[rulesetId]`) through
 * `persona.rulesetSheet.get|update` and `character.rulesetSheet.get|update`.
 *
 * Every ruleset is built from the same primitives (abilities, skills, saves,
 * bonuses, fields, lists), so one patch shape covers all of them. The server
 * merges the patch into the stored build, checks every value it touched with
 * the same rule the sheet editor and the creature check use, and only then
 * writes that one ruleset's sheet. Live state (hit points, spent slots) is a
 * game's, not the library sheet's, so it is never written here.
 */
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import {
  createRulesetSheetEnvelope,
  evaluateRulesetSheetLive,
  readRulesetSheetEnvelope,
  rulesetSheetBuildIssues,
  rulesetSheetEnvelopeSchema,
  rulesetSheetStamp,
  storedRulesetSheetsSchema,
  workOutRulesetListCells,
  RULESET_SHEET_MAX_BYTES,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";

type Row = Record<string, unknown>;
type Scalar = string | number | boolean;

const isRecord = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);

const scalar = z.union([z.number().finite(), z.string().max(4000), z.boolean()]);
/** `null` clears a value back to the ruleset's default (untrained, no bonus, the field's default). */
const clearable = z.union([scalar, z.null()]);
const listPatchSchema = z
  .object({
    /** Every row of the list, replacing what it held. */
    set: z.array(z.record(scalar)).max(500).optional(),
    /** Cells changed on rows the list already holds, by index; a `null` cell is cleared. */
    update: z
      .array(z.object({ index: z.number().int().min(0), cells: z.record(clearable) }).strict())
      .max(500)
      .optional(),
    /** Rows taken out, by their index before this patch. */
    remove: z.array(z.number().int().min(0)).max(500).optional(),
    /** Rows added at the end. */
    add: z.array(z.record(scalar)).max(500).optional(),
  })
  .strict();
export const rulesetSheetPatchSchema = z
  .object({
    abilities: z.record(z.number().finite().nullable()).optional(),
    skills: z.record(z.string().max(40).nullable()).optional(),
    saves: z.record(z.string().max(40).nullable()).optional(),
    bonuses: z.record(z.number().finite().nullable()).optional(),
    fields: z.record(clearable).optional(),
    lists: z.record(listPatchSchema).optional(),
  })
  .strict();
export type RulesetSheetPatch = z.infer<typeof rulesetSheetPatchSchema>;

export type RulesetSheetPatchResult = { ok: true; envelope: RulesetSheetEnvelope } | { ok: false; issues: string[] };

function issueLines(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`);
}

/** Copies `values` into `target`, deleting the keys set to null. */
function assignClearable<T>(target: Record<string, T>, values: Record<string, T | null>): void {
  for (const [id, value] of Object.entries(values)) {
    if (value === null) delete target[id];
    else target[id] = value;
  }
}

const withoutNulls = <T>(values: Record<string, T | null> | undefined): Record<string, T> =>
  Object.fromEntries(Object.entries(values ?? {}).filter((entry): entry is [string, T] => entry[1] !== null));

/**
 * The stored sheet with `patch` applied, or every problem with it. Only what the patch touches is
 * checked, so a value the player typed long ago that the ruleset has since narrowed never blocks an
 * unrelated edit (the editor clamps on edit, never on read, for the same reason).
 */
export function applyRulesetSheetPatch(
  definition: RulesetDefinition,
  stored: unknown,
  rawPatch: unknown,
): RulesetSheetPatchResult {
  const parsedPatch = rulesetSheetPatchSchema.safeParse(rawPatch);
  if (!parsedPatch.success) return { ok: false, issues: issueLines(parsedPatch.error) };
  const patch = parsedPatch.data;
  if (Object.values(patch).every((part) => part === undefined || Object.keys(part).length === 0)) {
    return {
      ok: false,
      issues: ["The patch changes nothing: send abilities, skills, saves, bonuses, fields or lists"],
    };
  }

  const read =
    stored === undefined ? createRulesetSheetEnvelope(definition) : readRulesetSheetEnvelope(definition, stored);
  if (!read) {
    return {
      ok: false,
      issues: [
        `The stored ${definition.name} sheet cannot be read, so it is left as it is. The user can remove it in the Stats tab and add a new one.`,
      ],
    };
  }
  const build = structuredClone(read.build);
  const issues: string[] = [];

  // Values the ruleset works out itself are never typed in, exactly as the editor shows them read-only.
  for (const id of Object.keys(patch.abilities ?? {})) {
    if (definition.sheet.abilities.find((ability) => ability.id === id)?.value) {
      issues.push(`abilities.${id}: this score is worked out by the ruleset and cannot be set`);
    }
  }
  // One record drives every clearable map through the same three steps: a value cleared under an id the
  // ruleset never declared is refused, the rest is applied, and every value set is handed to the value
  // check. It is keyed by the patch's own maps, so a map added to the schema cannot skip any of them.
  const clearable: Record<
    Exclude<keyof RulesetSheetPatch, "lists">,
    [string, ReadonlyArray<{ id: string; default?: unknown }>]
  > = {
    abilities: ["ability", definition.sheet.abilities],
    skills: ["skill", definition.sheet.skills],
    saves: ["save", definition.sheet.saves],
    bonuses: ["skill or save", [...definition.sheet.skills, ...definition.sheet.saves]],
    fields: ["field", definition.sheet.fields],
  };
  const touched: RulesetSheetBuild = { abilities: {}, skills: {}, saves: {}, bonuses: {}, fields: {}, lists: {} };
  for (const [key, [noun, entries]] of Object.entries(clearable) as Array<
    [keyof typeof clearable, (typeof clearable)[keyof typeof clearable]]
  >) {
    const values: Record<string, unknown> = patch[key] ?? {};
    const target: Record<string, unknown> = build[key];
    for (const [id, value] of Object.entries(values)) {
      const entry = entries.find((declared) => declared.id === id);
      if (value !== null) target[id] = value;
      else if (!entry) issues.push(`${key}.${id}: Unknown ${noun} "${id}"`);
      // A cleared score is the ruleset's default; any other cleared value is simply unset.
      else if (key === "abilities") target[id] = entry.default;
      else delete target[id];
    }
    Object.assign(touched[key], withoutNulls(values));
  }
  issues.push(...rulesetSheetBuildIssues(definition, touched));

  for (const [listId, change] of Object.entries(patch.lists ?? {})) {
    const list = definition.sheet.lists.find((entry) => entry.id === listId);
    if (!list) {
      issues.push(`lists.${listId}: Unknown list "${listId}"`);
      continue;
    }
    const before = build.lists[listId] ?? [];
    const setting = change.set !== undefined;
    const updates = change.update ?? [];
    const removing = new Set(change.remove ?? []);
    const adding = change.add ?? [];
    if (setting && (updates.length > 0 || removing.size > 0)) {
      issues.push(`lists.${listId}: send either set, or update and remove, not both`);
      continue;
    }
    if (!setting && updates.length === 0 && removing.size === 0 && adding.length === 0) {
      issues.push(`lists.${listId}: changes nothing: send set, update, remove or add`);
      continue;
    }
    // Every row a problem can be reported on carries the name a resend uses for it: its index in the
    // stored list for an updated row, `add.<n>` or `set.<n>` for one this patch writes.
    const named = new Map<Record<string, Scalar>, string>();
    const rows: Array<Record<string, Scalar>> = (change.set ?? before).map((row) => ({ ...row }));
    if (change.set) rows.forEach((row, index) => named.set(row, `set.${index}`));
    for (const { index, cells } of updates) {
      const row = rows[index];
      if (!row) {
        issues.push(`lists.${listId}.${index}: there is no row ${index} (the list holds ${before.length})`);
        continue;
      }
      // A cell cleared under a column the list never declared would vanish unnoticed, so it is named.
      for (const [columnId, value] of Object.entries(cells)) {
        if (value === null && !list.columns.some((column) => column.id === columnId))
          issues.push(`lists.${listId}.${index}.${columnId}: Unknown column "${columnId}"`);
      }
      assignClearable(row, cells);
      named.set(row, String(index));
    }
    for (const index of removing) {
      if (index >= before.length) issues.push(`lists.${listId}.${index}: there is no row ${index} to remove`);
    }
    const kept = rows.filter((_row, index) => !removing.has(index));
    adding.forEach((row, index) => {
      const added = { ...row };
      kept.push(added);
      named.set(added, `add.${index}`);
    });
    if (kept.length > list.maxItems) issues.push(`lists.${listId}: holds at most ${list.maxItems} rows`);
    const at = `lists.${listId}.0`;
    for (const row of kept) {
      const name = named.get(row);
      if (name === undefined) continue;
      for (const issue of rulesetSheetBuildIssues(definition, {
        abilities: {},
        skills: {},
        saves: {},
        bonuses: {},
        fields: {},
        lists: { [listId]: [row] },
      })) {
        issues.push(issue.startsWith(at) ? `lists.${listId}.${name}${issue.slice(at.length)}` : issue);
      }
    }
    if (kept.length > 0) build.lists[listId] = kept;
    else delete build.lists[listId];
  }

  if (issues.length > 0) return { ok: false, issues };
  const envelope = rulesetSheetEnvelopeSchema.safeParse({
    ...read,
    v: rulesetSheetStamp(definition, isRecord(stored) ? stored : null),
    build: workOutRulesetListCells(definition, build),
  });
  if (!envelope.success) return { ok: false, issues: issueLines(envelope.error) };
  const bytes = new TextEncoder().encode(JSON.stringify(envelope.data)).length;
  if (bytes > RULESET_SHEET_MAX_BYTES) {
    return { ok: false, issues: [`The sheet would be ${bytes} bytes, over the ${RULESET_SHEET_MAX_BYTES}-byte limit`] };
  }
  return { ok: true, envelope: envelope.data };
}

/** Every stored sheet with `envelope` put in under `rulesetId`, checked as the save boundary checks it. */
export function withRulesetSheet(
  sheets: unknown,
  rulesetId: string,
  envelope: RulesetSheetEnvelope,
): { ok: true; sheets: Row } | { ok: false; issues: string[] } {
  const next = { ...(isRecord(sheets) ? sheets : {}), [rulesetId]: envelope };
  const checked = storedRulesetSheetsSchema.safeParse(next);
  return checked.success ? { ok: true, sheets: next } : { ok: false, issues: issueLines(checked.error) };
}

/** The ids a patch may use, with their bounds, so Mari can write a valid patch on the first try. */
export function describeRulesetSheetLayout(definition: RulesetDefinition): Row {
  const { sheet, resolution } = definition;
  const tierIds = resolution.proficiencyTiers.map((tier) => tier.id);
  const column = (
    spec: RulesetDefinition["sheet"]["fields"][number] | RulesetDefinition["sheet"]["lists"][number]["columns"][number],
  ): Row => ({
    id: spec.id,
    label: spec.label,
    type: spec.type,
    ...(spec.type === "number" ? { min: spec.min, max: spec.max, integer: spec.integer } : {}),
    ...(spec.type === "text" || spec.type === "longtext" ? { maxLength: spec.maxLength } : {}),
    ...(spec.type === "enum" ? { values: spec.values } : {}),
    ...(spec.default !== undefined ? { default: spec.default } : {}),
    ...("required" in spec && spec.required ? { required: true } : {}),
    // A worked-out cell is filled in from the row, whatever is sent for it.
    ...("sum" in spec && spec.sum ? { workedOut: true } : {}),
  });
  return {
    abilities: sheet.abilities.map((ability) => ({
      id: ability.id,
      label: ability.label,
      min: ability.min,
      max: ability.max,
      default: ability.default,
      ...(ability.value ? { workedOut: true } : {}),
    })),
    skills: sheet.skills.map((skill) => ({
      id: skill.id,
      label: skill.label,
      ...(skill.ability ? { ability: skill.ability } : {}),
    })),
    saves: sheet.saves.map((save) => ({
      id: save.id,
      label: save.label,
      ...(save.ability ? { ability: save.ability } : {}),
    })),
    tiers: {
      untrained: tierIds[0],
      skills: sheet.skillTiers ?? tierIds,
      saves: sheet.saveTiers ?? tierIds,
    },
    bonusRange: sheet.bonusRange,
    fields: sheet.fields.map(column),
    lists: sheet.lists.map((list) => ({
      id: list.id,
      label: list.label,
      maxItems: list.maxItems,
      columns: list.columns.map(column),
    })),
    derived: sheet.derived.map((value) => ({ id: value.id, label: value.label })),
  };
}

/** One stored sheet as Mari reads it: the build in the current layout, the numbers it works out to,
 *  and the layout a patch is written against. */
export function describeRulesetSheet(definition: RulesetDefinition, stored: unknown): Row {
  const read = stored === undefined ? null : readRulesetSheetEnvelope(definition, stored);
  // A blank sheet works out too, so Mari sees what an update would start from.
  const build = read?.build ?? (stored === undefined ? createRulesetSheetEnvelope(definition).build : null);
  let values: Row | undefined;
  let valuesNote: string | undefined;
  if (build) {
    try {
      // A library sheet has no live state, so live tracks and pools read as they start.
      const evaluated = evaluateRulesetSheetLive(definition, build);
      values = {
        abilityMods: evaluated.abilityMods,
        skillMods: evaluated.skillMods,
        saveMods: evaluated.saveMods,
        derived: evaluated.derived,
      };
    } catch (error) {
      logger.warn(error, "[mari-db] could not work out the values of a %s sheet", definition.id);
      valuesNote = "The worked-out values could not be computed for this sheet.";
    }
  }
  return {
    rulesetId: definition.id,
    ruleset: definition.name,
    status: read ? "stored" : stored === undefined ? "none" : "unreadable",
    ...(read ? { build: read.build } : {}),
    ...(values ? { values } : {}),
    ...(valuesNote ? { valuesNote } : {}),
    ...(read
      ? {}
      : {
          note:
            stored === undefined
              ? "No sheet yet: an update starts from a blank one at the ruleset's defaults."
              : "The stored sheet cannot be read and an update will not overwrite it.",
        }),
    layout: describeRulesetSheetLayout(definition),
  };
}
