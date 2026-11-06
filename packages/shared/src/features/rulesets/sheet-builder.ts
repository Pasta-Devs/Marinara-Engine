// The guided builder (Capability API 1.86): a ruleset's `sheet.builder` walks a player through making a
// character in steps, and the catalog entries picked on the way say what they `grant`. What the player
// chose is kept beside the build, in the sheet envelope's `builder`, so a step can be reopened; the
// build itself stays the sheet every other part of the Engine reads.
//
// Applying is a pure step from (build, choices) to build, and it only ever changes what the builder
// itself wrote: what it wrote last time is kept in `applied`, so unpicking a race takes back its
// increases and its rows, and an edit the player made in the full form survives until the builder's
// own answer for that value changes.

import { z } from "zod";
import { rulesetPlanMemo, withRulesetPlanMemo } from "./plan-memo.js";
import {
  catalogRowRef,
  rulesetBuilderRatingKey,
  rulesetBuilderRatingBounds,
  type RulesetBuilderRatingTarget,
  type RulesetBuilderCost,
  type RulesetBuilderSpendOffer,
  type RulesetValueRef,
  rowsFromCatalogEntry,
  RULESET_CATALOG_ROW_KEY,
  RULESET_BUILDER_STEPS_MAX,
  type RulesetBuilderStep,
  type RulesetBuilderChoice,
  type RulesetBuilderConstraint,
  type RulesetBuilderCatalogLimits,
  type RulesetBuilderTrainedChoice,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCatalogGrants,
  type RulesetBuilderProfile,
  type RulesetCreationDice,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { defaultRulesetSheetBuild, evaluateRulesetSheet, namesPhrase, resolveRulesetValueRef } from "./sheet-math.js";

type Scalar = number | string | boolean;
type StepOf<K extends RulesetBuilderStep["kind"]> = Extract<RulesetBuilderStep, { kind: K }>;

export type RulesetBuilderMethod = "pointBuy" | "standardArray" | "roll" | "rolls" | "manual";

/** One creation roll kept with its dice (Capability API 1.162). */
export interface RulesetBuilderRollRecord {
  /** Every set of faces thrown, in order: one, or several where the best is kept. */
  sets: number[][];
  /** What the kept set came to, before any floor. */
  total: number;
  /** An improvement check's added dice, when the check beat the field. */
  gained?: number[];
  /** What was written to the field or ability. */
  written: number;
  /** What an improvement check added to an ability (1.209), which the builder keeps as an increase. */
  added?: number;
}

/** What the builder wrote into the build last time it ran, so the next run can take it back. */
export interface RulesetBuilderApplied {
  spending?: Record<string, { before?: Scalar; desired: number }>;
  increases: Record<string, number>;
  /** The scores the builder wrote from a method's base, so an edit made since is kept until they change. */
  scores: Record<string, number>;
  skills: Record<string, string>;
  saves: Record<string, string>;
  fields: Record<string, Scalar>;
  /** Fields the builder answers for that the player typed over since (a class level raised in the
   *  levels step): kept until the builder's answer changes, and cleared with it when it has none. */
  typedFields?: string[];
  rows: string[];
  /** The marks a mark step ticked (1.767), as `<list>:<column>:<row's catalog ref>`, so unmarking clears
   *  only those. */
  marks?: string[];
  /** The sheet below the rating stages, and their last numeric answer. */
  ratings?: Record<string, { before?: Scalar; desired: number }>;
  /** Actual paid increments, independently owned by each stage. */
  allocations?: Record<string, Record<string, number>>;
  /** The tiers a trained-only choice actually replaced, so unpicking restores only those. */
  trainingBefore?: { skills: Record<string, string>; saves: Record<string, string> };
}

/** One reversible line of the creation ledger. */
export interface RulesetBuilderPurchase {
  from: number;
  to: number;
  paid: number;
}

/** The player's choices, as the envelope's `builder` holds them. */
export interface RulesetBuilderState {
  /** Original prices and signed deltas, keyed by stable step and offer IDs. */
  spending?: Record<string, Record<string, RulesetBuilderPurchase[]>>;
  /** Priority slots, paid increments and optional notes, by stage and stable target key. */
  allocations?: Record<
    string,
    {
      priorities?: Record<string, number>;
      bought?: Record<string, number>;
      notes?: Record<string, string>;
    }
  >;
  method?: RulesetBuilderMethod;
  /** Bought or typed scores, by ability (point buy and manual). */
  base?: Record<string, number>;
  /** Rolled totals, in the order they were rolled. */
  rolled?: number[];
  /** Scores rolled in order, each with its own dice (1.162), by ability. */
  rolledBy?: Record<string, { faces: number[]; total: number }>;
  /** Creation rolls a roll step made (1.162), by step and roll. */
  rolls?: Record<string, Record<string, RulesetBuilderRollRecord>>;
  /** Which array value or rolled total each ability took, by its index. */
  assign?: Record<string, number>;
  /** Entry ids picked at each catalog step. */
  picks?: Record<string, string[]>;
  /** The rows marked at each mark step (1.767), by their catalog ref. */
  marks?: Record<string, string[]>;
  /** Abilities chosen for a grant's `abilities.choose`, keyed by `rulesetBuilderChoiceKey`. */
  abilityChoices?: Record<string, string[]>;
  /** Skills or saves chosen for a grant's or a trained step's `choose`. */
  trainedChoices?: Record<string, string[]>;
  /** Catalog entries chosen for a grant's `entries.choose` (1.91). */
  entryChoices?: Record<string, string[]>;
  applied?: RulesetBuilderApplied;
  /** Existing training used by 1.151 eligibility, kept separate from ranks granted by the builder. */
  trainingBase?: { skills: Record<string, string>; saves: Record<string, string> };
  /** Picks describe the character as it already is: what they grant is recorded as given, and the
   *  sheet is not changed. For a character made before the builder, until the player says done. */
  describing?: boolean;
  /** Starting values an initialize step wrote, by step, exactly as written (Capability API 1.158). */
  initialized?: Record<string, Record<string, Scalar>>;
  /** Set once the builder starts a blank sheet: only such a character takes a step's `default` method
   *  (1.87). One it described never does, so ending describing keeps its scores. */
  made?: "builder";
}

const idList = z.array(z.string().max(80)).max(120);
const purchaseSchema = z.object({
  from: z.number().finite().min(-100000).max(100000),
  to: z.number().finite().min(-100000).max(100000),
  paid: z.number().finite().min(-100000).max(100000),
});
const spendingSchema = z
  .record(
    z.string().max(80),
    z
      .record(z.string().max(80), z.array(purchaseSchema).max(1000).catch([]))
      .refine((offers) => Object.keys(offers).length <= 120)
      .catch({}),
  )
  .refine((steps) => Object.keys(steps).length <= RULESET_BUILDER_STEPS_MAX);
const stateShape = {
  spending: spendingSchema.optional(),
  allocations: z
    .record(
      z.string(),
      z
        .object({
          priorities: z.record(z.string(), z.number().int().min(0).max(11).catch(-1)).optional().catch(undefined),
          bought: z.record(z.string(), z.number().int().min(0).max(10000).catch(0)).optional().catch(undefined),
          notes: z.record(z.string(), z.string().max(1000).catch("")).optional().catch(undefined),
        })
        .catch({}),
    )
    .optional(),
  method: z.enum(["pointBuy", "standardArray", "roll", "rolls", "manual"]).optional(),
  rolledBy: z
    .record(
      z.string().max(80),
      z.object({ faces: z.array(z.number().int().min(1).max(100)).max(20), total: z.number().finite() }),
    )
    .optional(),
  rolls: z
    .record(
      z.string().max(80),
      z.record(
        z.string().max(80),
        z.object({
          sets: z.array(z.array(z.number().int().min(1).max(100)).max(20)).max(3),
          total: z.number().finite(),
          gained: z.array(z.number().int().min(1).max(100)).max(20).optional(),
          written: z.number().finite(),
          added: z.number().finite().optional(),
        }),
      ),
    )
    .optional(),
  base: z.record(z.string(), z.number().finite()).optional(),
  rolled: z.array(z.number().finite()).max(40).optional(),
  assign: z.record(z.string(), z.number().int().min(0).max(40)).optional(),
  picks: z.record(z.string(), idList).optional(),
  marks: z.record(z.string(), z.array(z.string().max(200)).max(200)).optional(),
  abilityChoices: z.record(z.string(), idList).optional(),
  trainedChoices: z.record(z.string(), idList).optional(),
  entryChoices: z.record(z.string(), idList).optional(),
  trainingBase: z
    .object({ skills: z.record(z.string(), z.string().max(40)), saves: z.record(z.string(), z.string().max(40)) })
    .optional(),
  describing: z.boolean().optional(),
  initialized: z
    .record(
      z.string().max(80),
      z.record(z.string().max(80), z.union([z.number().finite(), z.string().max(4000), z.boolean()])),
    )
    .refine((steps) => Object.keys(steps).length <= RULESET_BUILDER_STEPS_MAX)
    .optional(),
  made: z.literal("builder").optional(),
  applied: z
    .object({
      spending: z
        .record(
          z.string(),
          z.object({
            before: z.union([z.number().finite(), z.string().max(4000), z.boolean()]).optional(),
            desired: z.number().finite(),
          }),
        )
        .optional()
        .catch(undefined),
      ratings: z
        .record(
          z.string(),
          z.object({
            before: z.union([z.number().finite(), z.string().max(4000), z.boolean()]).optional(),
            desired: z.number().finite(),
          }),
        )
        .optional()
        .catch(undefined),
      allocations: z
        .record(z.string(), z.record(z.string(), z.number().int().min(0).max(10000)))
        .optional()
        .catch(undefined),
      increases: z.record(z.string(), z.number().finite()).prefault({}),
      scores: z.record(z.string(), z.number().finite()).prefault({}),
      skills: z.record(z.string(), z.string().max(40)).prefault({}),
      saves: z.record(z.string(), z.string().max(40)).prefault({}),
      fields: z.record(z.string(), z.union([z.number().finite(), z.string().max(4000), z.boolean()])).prefault({}),
      rows: z.array(z.string().max(200)).max(1000).default([]),
      typedFields: z.array(z.string().max(200)).max(500).optional().catch(undefined),
      marks: z.array(z.string().max(300)).max(1000).optional().catch(undefined),
      trainingBefore: z
        .object({ skills: z.record(z.string(), z.string().max(40)), saves: z.record(z.string(), z.string().max(40)) })
        .optional(),
    })
    .optional(),
};

/** The builder state an envelope carries, read tolerantly key by key: a key it cannot read is no choice
 *  yet, and never costs the others. */
export function readRulesetBuilderState(envelope: unknown): RulesetBuilderState {
  const raw = envelope && typeof envelope === "object" ? (envelope as { builder?: unknown }).builder : undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const state: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(stateShape)) {
    const parsed = schema.safeParse((raw as Record<string, unknown>)[key]);
    if (parsed.success && parsed.data !== undefined) state[key] = parsed.data;
  }
  return state as RulesetBuilderState;
}

/** The key a grant's choice is kept under: the step and entry that granted it, and which choice. A
 *  trained step's own choices have no entry. */
export function rulesetBuilderChoiceKey(stepId: string, entryId: string | null, index: number | string): string {
  return `${stepId}/${entryId ?? ""}/${index}`;
}

/** Opt-in creation constraints, including choices loaded from catalog files. */
export function rulesetBuilderUsesChoiceConstraints(
  definition: RulesetDefinition,
  catalogs: RulesetCatalogEntriesById,
): boolean {
  const choiceUses = (choice: RulesetBuilderChoice) =>
    [
      "id",
      "countFrom",
      "max",
      "excludeChoices",
      "only",
      "tier",
      "onDuplicate",
      "quotas",
      "distinctBy",
      "quotaBelow",
    ].some((key) => key in choice);
  return (
    (definition.sheet.builder?.steps ?? []).some(
      (step) =>
        step.when ||
        step.requiredWhen ||
        step.kind === "allocate" ||
        (step.kind === "catalog" && (step.quotas || step.distinctBy || step.quotaBelow)) ||
        (step.kind === "trained" && step.choose?.some(choiceUses)),
    ) ||
    Object.values(catalogs).some((entries) =>
      entries.some(
        (entry) =>
          entry.grants?.ratings?.length ||
          entry.grants?.abilities?.choose?.some((choice) => choice.from || choiceUses(choice)) ||
          entry.grants?.trained?.choose?.some(choiceUses) ||
          entry.grants?.entries?.choose?.some(choiceUses),
      ),
    )
  );
}

/** The creation profile the sheet selects (1.160): the first whose `when` reads above 0. */
export function rulesetBuilderActiveProfile(
  definition: RulesetDefinition,
  build?: RulesetSheetBuild,
): RulesetBuilderProfile | undefined {
  if (!build) return undefined;
  return definition.sheet.builder?.profiles?.find(
    (profile) => resolveRulesetValueRef(definition, build, profile.when) > 0,
  );
}

/** A hidden step keeps its stored answers, but contributes nothing until it applies again. A step a
 *  profile lists is shown only while that profile is the character's (1.160). */
export function rulesetBuilderStepVisible(
  definition: RulesetDefinition,
  step: RulesetBuilderStep,
  build?: RulesetSheetBuild,
): boolean {
  const profiles = definition.sheet.builder?.profiles;
  if (profiles?.some((profile) => profile.steps?.includes(step.id))) {
    if (!rulesetBuilderActiveProfile(definition, build)?.steps?.includes(step.id)) return false;
  }
  return !step.when || (!!build && resolveRulesetValueRef(definition, build, step.when) > 0);
}

/** Sheets as the steps before one step make them, per sheet and state, so many reads build each once. */
const beforeCache = new WeakMap<
  RulesetSheetBuild,
  WeakMap<
    RulesetBuilderState,
    Map<string, { definition: RulesetDefinition; catalogs: RulesetCatalogEntriesById; build: RulesetSheetBuild }>
  >
>();

/** The sheet as the builder steps before `stepId` make it (1.160): every later step's picks, grants,
 *  ratings and purchases taken back, and the player's own edits kept. */
export function rulesetBuilderBuildBefore(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  stepId: string,
): RulesetSheetBuild {
  const steps = definition.sheet.builder?.steps ?? [];
  const at = steps.findIndex((step) => step.id === stepId);
  if (at <= 0) return build;
  let byState = beforeCache.get(build);
  if (!byState) beforeCache.set(build, (byState = new WeakMap()));
  let byStep = byState.get(state);
  if (!byStep) byState.set(state, (byStep = new Map()));
  const cached = byStep.get(stepId);
  if (cached && cached.definition === definition && cached.catalogs === catalogs) return cached.build;
  const earlier: RulesetDefinition = {
    ...definition,
    sheet: { ...definition.sheet, builder: { ...definition.sheet.builder!, steps: steps.slice(0, at) } },
  };
  const before = applyRulesetBuilder(earlier, build, state, catalogs).build;
  byStep.set(stepId, { definition, catalogs, build: before });
  return before;
}

function choiceCount(definition: RulesetDefinition, choice: RulesetBuilderChoice, build?: RulesetSheetBuild): number {
  if (!choice.countFrom) return choice.count;
  if (!build) return 0;
  const value = resolveRulesetValueRef(definition, build, choice.countFrom);
  return Number.isFinite(value) ? clamp(Math.floor(value), 0, choice.max ?? 0) : 0;
}

export type RulesetBuilderChoiceReason =
  "excluded" | "trained" | "untrained" | "distinct" | "quota" | "pyramid" | "unavailable" | "unaffordable";

/** Apply upper quotas first, then build a pyramid from its bottom. Deleting a lower tier retains the
 * higher answers in state while removing their grants. Tier one needs no tier-zero picks. */
function limitedEntries(
  entries: RulesetCatalogEntry[],
  limits: RulesetBuilderCatalogLimits,
  max: number,
): RulesetCatalogEntry[] {
  const kept: RulesetCatalogEntry[] = [];
  for (const entry of entries) {
    if (kept.some((other) => other.id === entry.id)) continue;
    if (limits.distinctBy) {
      const value = entry.filters?.[limits.distinctBy];
      const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
      if (!values.length || kept.some((other) => values.some((value) => filterHas(other, limits.distinctBy!, value))))
        continue;
    }
    if (
      limits.quotas?.some(
        (quota) =>
          filterHas(entry, quota.filter, quota.value) &&
          kept.filter((other) => filterHas(other, quota.filter, quota.value)).length >= quota.max,
      )
    )
      continue;
    kept.push(entry);
  }
  if (limits.quotaBelow) {
    const filter = limits.quotaBelow.filter;
    const tier = (entry: RulesetCatalogEntry) => entry.filters?.[filter];
    const tiers = [
      ...new Set(
        kept
          .map(tier)
          .filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1),
      ),
    ].sort((a, b) => a - b);
    const active = new Set<string>();
    let previous = 0;
    let previousTier = 0;
    for (const value of tiers) {
      const at = kept.filter((entry) => tier(entry) === value);
      const allowed = value === 1 ? at.length : value === previousTier + 1 ? Math.max(0, previous - 1) : 0;
      const chosen = at.slice(0, Math.min(allowed, Math.max(0, max - active.size)));
      for (const entry of chosen) active.add(entry.id);
      previous = chosen.length;
      previousTier = value;
    }
    return kept.filter((entry) => active.has(entry.id)).slice(0, max);
  }
  return kept.slice(0, max);
}

function entryLimitReason(
  entry: RulesetCatalogEntry,
  picked: RulesetCatalogEntry[],
  limits: RulesetBuilderCatalogLimits,
): RulesetBuilderChoiceReason | undefined {
  if (limitedEntries([...picked, entry], limits, 120).some((each) => each.id === entry.id)) return undefined;
  if (
    limits.distinctBy &&
    !limitedEntries([...picked, entry], { distinctBy: limits.distinctBy }, 120).some((each) => each.id === entry.id)
  )
    return "distinct";
  if (
    limits.quotas &&
    !limitedEntries([...picked, entry], { quotas: limits.quotas }, 120).some((each) => each.id === entry.id)
  )
    return "quota";
  return "pyramid";
}

export function rulesetBuilderPickReason(
  definition: RulesetDefinition,
  step: StepOf<"catalog">,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build: RulesetSheetBuild,
  id: string,
): RulesetBuilderChoiceReason | undefined {
  const entry = rulesetBuilderOptions(definition, step, state, catalogs, build).find((entry) => entry.id === id);
  if (!entry) return "unavailable";
  const picked = rulesetBuilderPicks(definition, step.id, state, catalogs, build).filter(
    (other) => other.id !== id && (!entry.exclusive || other.exclusive !== entry.exclusive),
  );
  const limited = entryLimitReason(entry, step.max === 1 ? [] : picked, step);
  if (limited || !step.pool || (state.picks?.[step.id] ?? []).includes(id)) return limited;
  // A priced pick (1.159) the pool cannot pay for is not offered; one already taken stays.
  const price = rulesetBuilderPickPrice(step, entry);
  const pool = rulesetBuilderSpending(definition, build, state, catalogs).find((each) => each.id === step.pool);
  const replaced = step.max === 1 ? rulesetBuilderPicks(definition, step.id, state, catalogs, build) : [];
  const refund = replaced.reduce((sum, other) => sum + (rulesetBuilderPickPrice(step, other) ?? 0), 0);
  if (price === null || !pool || pool.remaining === null || pool.invalid || price - refund > pool.remaining + 1e-8)
    return "unaffordable";
  return undefined;
}

/** What one pick of a priced catalog step costs (1.159), or null when its entry has no price. */
export function rulesetBuilderPickPrice(step: StepOf<"catalog">, entry: RulesetCatalogEntry): number | null {
  if (step.cost === undefined) return 0;
  if (typeof step.cost === "number") return step.cost;
  const value = entry.filters?.[step.cost.filter];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** What one of the player's rows costs at a priced rows step (1.159): an empty cost cell is free. */
export function rulesetBuilderRowPrice(
  step: StepOf<"rows">,
  row: Record<string, unknown>,
  /** The sheet's derived values, which a price override reads (1.206). */
  derived: Readonly<Record<string, number>> = {},
): number {
  const cost = step.cost;
  if (cost === undefined) return 0;
  if (typeof cost === "number") return cost;
  const columnCell = () => {
    const value = cost.column === undefined ? 0 : row[cost.column];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  for (const override of cost.overrides ?? []) {
    const key = row[override.derived.cell];
    if (typeof key !== "string" && typeof key !== "number") continue;
    const id = `${override.derived.prefix}${key}`;
    if (!Object.hasOwn(derived, id) || (derived[id] ?? 0) <= 0) continue;
    if (override.cost !== undefined) return override.cost;
    // A rate (1.216) in place of `times`.
    return columnCell() * override.times! + (cost.add ?? 0);
  }
  return columnCell() * (cost.times ?? 1) + (cost.add ?? 0);
}

/** One priced pick or row paid out of a builder pool (1.159). */
export interface RulesetBuilderPricedItem {
  stepId: string;
  label: string;
  /** Null when the entry has no price, which leaves the pool unworkable until it is repaired. */
  cost: number | null;
}

function pricedItems(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): Map<string, RulesetBuilderPricedItem[]> {
  const items = new Map<string, RulesetBuilderPricedItem[]>();
  const add = (pool: string, item: RulesetBuilderPricedItem) => items.set(pool, [...(items.get(pool) ?? []), item]);
  for (const step of definition.sheet.builder?.steps ?? []) {
    if (step.kind === "catalog" && step.pool) {
      for (const entry of rulesetBuilderPicks(definition, step.id, state, catalogs, build))
        add(step.pool, { stepId: step.id, label: entry.label, cost: rulesetBuilderPickPrice(step, entry) });
    } else if (step.kind === "rows" && step.pool && rulesetBuilderStepVisible(definition, step, build)) {
      const list = definition.sheet.lists.find((each) => each.id === step.list);
      const name = list?.columns.find((column) => column.type === "text")?.id;
      const derived =
        typeof step.cost === "object" && step.cost.overrides ? evaluateRulesetSheet(definition, build).derived : {};
      rulesetBuilderOwnRows(build, step.list).forEach(({ row }, index) =>
        add(step.pool!, {
          stepId: step.id,
          label: (name && typeof row[name] === "string" && row[name]) || `${list?.label ?? step.list} ${index + 1}`,
          cost: rulesetBuilderRowPrice(step, row, derived),
        }),
      );
    }
  }
  return items;
}

function filterHas(entry: RulesetCatalogEntry, filterId: string, value: string | number): boolean {
  const have = entry.filters?.[filterId];
  return Array.isArray(have) ? typeof value === "string" && have.includes(value) : have === value;
}

/** Set while the builder works out a sheet without one exclusive group's picks (1.100), so the entries
 *  judged inside it are read off that sheet as it stands and the rule never nests. */
let judgingWithoutGroups = false;
/** The step and group that sheet is without: its default (1.772) is not taken in their place either, or
 *  the improvement a feat replaces would still meet the feat's prerequisite. */
let judgingWithout: { step: string; group: string } | null = null;
/** What a read made under the judging above depends on, as one memo key. */
const judgingKey = () =>
  judgingWithoutGroups ? `${judgingWithout?.step ?? ""}\u0000${judgingWithout?.group ?? ""}` : "";
/** Each memoised read's own place in an open pass. */
const builderPicksMemo = {};
const builderOptionsMemo = {};
const builderGrantingMemo = {};

/** Sheets already worked out without a group, per sheet and state (both are never changed in place), so
 *  the many reads of one builder pass rebuild each only once. */
const WITHOUT_GROUP_CONTENT_SIZE = 200;
const withoutGroupByContent = new WeakMap<
  RulesetDefinition,
  WeakMap<RulesetCatalogEntriesById, Map<string, RulesetSheetBuild>>
>();
const withoutGroupCache = new WeakMap<
  RulesetSheetBuild,
  WeakMap<
    RulesetBuilderState,
    Map<string, { definition: RulesetDefinition; catalogs: RulesetCatalogEntriesById; without: RulesetSheetBuild }>
  >
>();

/** The entries a catalog step offers: its fixed filters, and under `within` only those that name an
 *  entry still picked at the earlier step. */
export function rulesetBuilderOptions(
  definition: RulesetDefinition,
  step: StepOf<"catalog">,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  /** The sheet as it stands, which a step's `upTo` reads; no limit without it. */
  build?: RulesetSheetBuild,
): RulesetCatalogEntry[] {
  return rulesetPlanMemo([builderOptionsMemo, definition, step, state, catalogs, build, judgingKey()], () =>
    builderOptions(definition, step, state, catalogs, build),
  );
}

function builderOptions(
  definition: RulesetDefinition,
  step: StepOf<"catalog">,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build: RulesetSheetBuild | undefined,
): RulesetCatalogEntry[] {
  if (!rulesetBuilderStepVisible(definition, step, build)) return [];
  const entries = catalogs[step.catalog] ?? [];
  // Read off the sheet as it stands, or as the steps before `reads.before` make it (1.160); an entry
  // without the filter is never held back by it.
  const sheet =
    step.reads && build ? rulesetBuilderBuildBefore(definition, build, state, catalogs, step.reads.before) : build;
  const limit = step.upTo && sheet ? resolveRulesetValueRef(definition, sheet, step.upTo.value) : null;
  // Or read for each entry (1.766): its own class's level, the highest the sheet has of those it names.
  const per = step.upTo?.per;
  const limitOf = (entry: RulesetCatalogEntry): number | null => {
    if (!per || !sheet) return limit;
    const read = [entry.filters?.[per.filter]].flat().flatMap((value) => {
      if (typeof value !== "string") return [];
      const id = `${per.prefix}${value}`;
      if (definition.sheet.fields.some((field) => field.id === id))
        return [resolveRulesetValueRef(definition, sheet, { field: id })];
      if (definition.sheet.derived?.some((derived) => derived.id === id))
        return [resolveRulesetValueRef(definition, sheet, { derived: id })];
      return [];
    });
    return read.length > 0 ? Math.max(...read) : limit;
  };
  const parentPicks = step.within ? rulesetBuilderPicks(definition, step.within.step, state, catalogs, build) : null;
  // An entry of an `exclusive` group is judged on the sheet without the step's picks of that group
  // (1.100): picking it drops them, so what they gave cannot be what lets it be picked (a feat in place of
  // an ability score improvement, judged on the scores without that improvement). Worked out once per
  // group, and without this rule inside, so it never nests.
  const withoutGroups = new Map<string, RulesetSheetBuild>();
  const judgedOn = (entry: RulesetCatalogEntry, sheet: RulesetSheetBuild): RulesetSheetBuild => {
    if (!entry.exclusive || judgingWithoutGroups) return sheet;
    const group = entry.exclusive;
    let without = withoutGroups.get(group);
    if (!without) {
      without = rulesetBuilderBuildWithoutGroup(definition, step, state, catalogs, sheet, group);
      withoutGroups.set(group, without);
    }
    return without;
  };
  return entries.filter((entry) => {
    // A variant is used through its parent's row, never picked on its own (1.769).
    if (entry.variantOf !== undefined) return false;
    // A list matches any of its values (1.731).
    for (const [filterId, value] of Object.entries(step.filters ?? {})) {
      if (![value].flat().some((one) => filterHas(entry, filterId, one))) return false;
    }
    if (step.upTo && limit !== null) {
      const at = entry.filters?.[step.upTo.filter];
      const most = limitOf(entry);
      if (typeof at === "number" && most !== null && at > most) return false;
    }
    // Offered only while the sheet as it stands says so (1.99): a second class's prerequisites.
    if (
      entry.offeredWhen &&
      sheet &&
      !(resolveRulesetValueRef(definition, judgedOn(entry, sheet), entry.offeredWhen) > 0)
    )
      return false;
    if (step.within && parentPicks) {
      if (!parentPicks.some((picked) => filterHas(entry, step.within!.filter, picked.id))) return false;
    }
    return true;
  });
}

/** The values written when a step adds an entry's rows (1.130): a `fromWithin` reads the first
 *  parent pick whose id the entry's `within.filter` names, in pick order, as the offer is judged. */
export function rulesetBuilderStamp(
  definition: RulesetDefinition,
  step: StepOf<"catalog">,
  entry: RulesetCatalogEntry,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build?: RulesetSheetBuild,
): Record<string, Scalar> {
  const parent = step.within
    ? rulesetBuilderPicks(definition, step.within.step, state, catalogs, build).find((picked) =>
        filterHas(entry, step.within!.filter, picked.id),
      )
    : undefined;
  const stamp: Record<string, Scalar> = {};
  for (const [column, value] of Object.entries(step.stamp ?? {})) {
    if (typeof value !== "object") stamp[column] = value;
    else if (parent) {
      const from = value.fromWithin;
      const resolved = from === "id" ? parent.id : from === "label" ? parent.label : parent.filters?.[from];
      if (typeof resolved === "string" || typeof resolved === "number") stamp[column] = resolved;
    }
  }
  return stamp;
}

/** The sheet as the builder would leave it without the step's picks of one `exclusive` group (1.100),
 *  or the default taken in their place (1.772): what they wrote taken back, everything else as it was.
 *  The sheet itself when none are picked. */
function rulesetBuilderBuildWithoutGroup(
  definition: RulesetDefinition,
  step: StepOf<"catalog">,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build: RulesetSheetBuild,
  group: string,
): RulesetSheetBuild {
  const picks = state.picks?.[step.id] ?? [];
  const inGroup = new Set(
    (catalogs[step.catalog] ?? []).filter((each) => each.exclusive === group).map((each) => each.id),
  );
  // A step that takes all it offers can hold a group's default (1.772) with nothing stored.
  if (!step.takesAll && !picks.some((id) => inGroup.has(id))) return build;
  let byState = withoutGroupCache.get(build);
  if (!byState) withoutGroupCache.set(build, (byState = new WeakMap()));
  let byGroup = byState.get(state);
  if (!byGroup) byState.set(state, (byGroup = new Map()));
  const key = `${step.id}\u0000${group}`;
  const cached = byGroup.get(key);
  if (cached && cached.definition === definition && cached.catalogs === catalogs) return cached.without;
  const without: RulesetBuilderState = {
    ...state,
    picks: { ...state.picks, [step.id]: picks.filter((id) => !inGroup.has(id)) },
  };
  // The same sheet and choices in new objects (each pass of a pick, each render) come to the same
  // answer: kept by what they are, so a level-20 sheet's feats are not judged afresh on every read.
  let byCatalogs = withoutGroupByContent.get(definition);
  if (!byCatalogs) withoutGroupByContent.set(definition, (byCatalogs = new WeakMap()));
  let byContent = byCatalogs.get(catalogs);
  if (!byContent) byCatalogs.set(catalogs, (byContent = new Map()));
  let contentKey: string | undefined;
  try {
    contentKey = `${key}\u0000${JSON.stringify(build)}\u0000${JSON.stringify(without)}`;
  } catch {
    contentKey = undefined;
  }
  const known = contentKey === undefined ? undefined : byContent.get(contentKey);
  if (known) {
    byContent.delete(contentKey!);
    byContent.set(contentKey!, known);
    byGroup.set(key, { definition, catalogs, without: known });
    return known;
  }
  judgingWithoutGroups = true;
  judgingWithout = { step: step.id, group };
  try {
    let result = applyRulesetBuilderOnce(definition, build, without, catalogs);
    for (let pass = 0; pass < 3; pass++) {
      const again = applyRulesetBuilderOnce(definition, result.build, result.state, catalogs);
      if (JSON.stringify(again) === JSON.stringify(result)) break;
      result = again;
    }
    byGroup.set(key, { definition, catalogs, without: result.build });
    if (contentKey !== undefined) {
      byContent.set(contentKey, result.build);
      if (byContent.size > WITHOUT_GROUP_CONTENT_SIZE) byContent.delete(byContent.keys().next().value!);
    }
    return result.build;
  } finally {
    judgingWithoutGroups = false;
    judgingWithout = null;
  }
}

/** How many entries a catalog step asks for and at most takes: its `countFrom` read off the sheet as it
 *  stands (1.90), whole and between 0 and its `max`, or else its own `min` and `max`. */
export function rulesetBuilderStepCount(
  definition: RulesetDefinition,
  step: StepOf<"catalog">,
  build?: RulesetSheetBuild,
): { min: number; max: number } {
  if (!step.countFrom || !build) return { min: step.min, max: step.max };
  const value = resolveRulesetValueRef(definition, build, step.countFrom);
  const count = Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 0), step.max) : 0;
  return { min: count, max: count };
}

function stepById(definition: RulesetDefinition, stepId: string): RulesetBuilderStep | undefined {
  return definition.sheet.builder?.steps.find((step) => step.id === stepId);
}

/** The entries picked at a catalog step that it still offers, in the order they were picked. A pick
 *  whose parent was unpicked, or that left the catalog, counts for nothing but is kept. */
export function rulesetBuilderPicks(
  definition: RulesetDefinition,
  stepId: string,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  /** The sheet as it stands, which a step's `upTo` reads; no limit without it. */
  build?: RulesetSheetBuild,
): RulesetCatalogEntry[] {
  // One builder pass reads each step's picks many times over (every grant, slot and step that asks):
  // worked out once per sheet, state and judging (1.100) while the pass is open. Read, never changed.
  return rulesetPlanMemo([builderPicksMemo, definition, stepId, state, catalogs, build, judgingKey()], () =>
    builderPicks(definition, stepId, state, catalogs, build),
  );
}

function builderPicks(
  definition: RulesetDefinition,
  stepId: string,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build: RulesetSheetBuild | undefined,
): RulesetCatalogEntry[] {
  const step = stepById(definition, stepId);
  if (!step || step.kind !== "catalog" || !rulesetBuilderStepVisible(definition, step, build)) return [];
  // `within` only ever names an earlier step (the ruleset is refused otherwise), so this ends.
  const offered = rulesetBuilderOptions(definition, step, state, catalogs, build);
  const byId = new Map(offered.map((entry) => [entry.id, entry]));
  // Taken without asking (1.766): everything it offers, and of each `exclusive` group the latest pick.
  if (step.takesAll) {
    const chosen = groupsTaken(offered, state.picks?.[stepId] ?? [], stepId);
    return offered.filter((entry) => !entry.exclusive || chosen.get(entry.exclusive) === entry.id);
  }
  // One pick of an `exclusive` group counts (1.94): the latest, since picking replaces; earlier ones
  // of the same group count for nothing.
  const picked = (state.picks?.[stepId] ?? [])
    .map((id) => byId.get(id))
    .filter((entry): entry is RulesetCatalogEntry => !!entry);
  const lastOfGroup = new Map<string, RulesetCatalogEntry>();
  for (const entry of picked) if (entry.exclusive) lastOfGroup.set(entry.exclusive, entry);
  const exclusive = picked.filter((entry) => !entry.exclusive || lastOfGroup.get(entry.exclusive) === entry);
  const max = rulesetBuilderStepCount(definition, step, build).max;
  return step.quotas || step.distinctBy || step.quotaBelow
    ? limitedEntries(exclusive, step, max)
    : exclusive.slice(0, max);
}

/** The rows a mark step offers (1.767): those on its list that a catalog wrote and that match its
 *  `where`, by their catalog ref, each once. A row the player typed in has no ref and is not offered. */
export function rulesetBuilderMarkRows(
  step: StepOf<"mark">,
  build: RulesetSheetBuild,
): Array<{ ref: string; row: Record<string, Scalar> }> {
  const rows = Array.isArray(build.lists[step.list]) ? build.lists[step.list]! : [];
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const ref = row?.[RULESET_CATALOG_ROW_KEY];
    if (typeof ref !== "string" || seen.has(ref)) return [];
    for (const [id, want] of Object.entries(step.where ?? {})) {
      const value = row[id];
      if (typeof want === "object" ? typeof value !== "number" || value < want.atLeast : value !== want) return [];
    }
    seen.add(ref);
    return [{ ref, row }];
  });
}

/** How many rows a mark step lets the player mark (1.767): its `max`, or what `countFrom` reads. */
export function rulesetBuilderMarkCount(
  definition: RulesetDefinition,
  step: StepOf<"mark">,
  build: RulesetSheetBuild,
): number {
  if (step.countFrom) return Math.max(0, Math.floor(resolveRulesetValueRef(definition, build, step.countFrom)));
  return step.max ?? 0;
}

/** The rows marked at a mark step (1.767): the stored marks still offered, the earliest first, no more
 *  than it lets the player mark. */
export function rulesetBuilderMarked(
  definition: RulesetDefinition,
  stepId: string,
  state: RulesetBuilderState,
  build: RulesetSheetBuild,
): string[] {
  const step = stepById(definition, stepId);
  if (!step || step.kind !== "mark" || !rulesetBuilderStepVisible(definition, step, build)) return [];
  const offered = new Set(rulesetBuilderMarkRows(step, build).map(({ ref }) => ref));
  return [...new Set(state.marks?.[stepId] ?? [])]
    .filter((ref) => offered.has(ref))
    .slice(0, rulesetBuilderMarkCount(definition, step, build));
}

/** What a step that takes all it offers takes of each `exclusive` group it offers: the latest pick
 *  of it, or, with none, its default (1.772) or the only entry of it offered. A group missing here
 *  waits on the player. */
function groupsTaken(
  offered: readonly RulesetCatalogEntry[],
  stored: readonly string[],
  stepId: string,
): Map<string, string> {
  const chosen = new Map<string, string>();
  const byId = new Map(offered.map((entry) => [entry.id, entry]));
  for (const id of stored) {
    const group = byId.get(id)?.exclusive;
    if (group) chosen.set(group, id);
  }
  const groups = new Map<string, RulesetCatalogEntry[]>();
  for (const entry of offered)
    if (entry.exclusive) groups.set(entry.exclusive, [...(groups.get(entry.exclusive) ?? []), entry]);
  for (const [group, entries] of groups) {
    if (chosen.has(group) || (judgingWithout?.step === stepId && judgingWithout.group === group)) continue;
    const fallback = entries.find((entry) => entry.exclusiveDefault) ?? (entries.length === 1 ? entries[0] : undefined);
    if (fallback) chosen.set(group, fallback.id);
  }
  return chosen;
}

/** The stored picks of a step with `id` added: one of an `exclusive` group (1.94) replaces the step's
 *  other picks of that group, and any other is added at the end. */
export function rulesetBuilderPickAdded(
  step: StepOf<"catalog">,
  stored: readonly string[],
  id: string,
  catalogs: RulesetCatalogEntriesById,
): string[] {
  const entries = catalogs[step.catalog] ?? [];
  const group = entries.find((entry) => entry.id === id)?.exclusive;
  const kept = stored.filter(
    (each) => each !== id && (!group || entries.find((entry) => entry.id === each)?.exclusive !== group),
  );
  // A step that takes all it offers (1.766) stores only its groups' picks, one for each group.
  return step.max === 1 && !step.takesAll ? [id] : [...kept, id];
}

/** The items a character may take without carrying them (1.215), as `<catalog>/<entry>`, from
 *  what the guided builder's picks grant. `stored` is the sheet envelope, which keeps the picks. */
export function rulesetItemAccess(
  definition: RulesetDefinition,
  stored: unknown,
  catalogs: RulesetCatalogEntriesById,
  build?: RulesetSheetBuild,
): string[] {
  const state = readRulesetBuilderState(stored);
  const refs = new Set<string>();
  for (const { entry } of rulesetBuilderGranting(definition, state, catalogs, build))
    for (const ref of entry.grants?.itemAccess ?? []) refs.add(ref);
  return [...refs];
}

/** Every pick that counts, with the step that made it, in step order. */
export function rulesetBuilderGranting(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  /** The sheet as it stands, which a step's `upTo` reads; no limit without it. */
  build?: RulesetSheetBuild,
): { step: StepOf<"catalog">; entry: RulesetCatalogEntry }[] {
  return rulesetPlanMemo([builderGrantingMemo, definition, state, catalogs, build, judgingKey()], () =>
    builderGranting(definition, state, catalogs, build),
  );
}

function builderGranting(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build: RulesetSheetBuild | undefined,
): { step: StepOf<"catalog">; entry: RulesetCatalogEntry }[] {
  // One entry picked at two steps on one catalog (a feat and a bonus feat) grants once.
  const seen = new Set<string>();
  return (definition.sheet.builder?.steps ?? []).flatMap((step) =>
    step.kind === "catalog"
      ? rulesetBuilderPicks(definition, step.id, state, catalogs, build)
          .filter((entry) => {
            const ref = catalogRowRef(step.catalog, entry.id);
            if (seen.has(ref)) return false;
            seen.add(ref);
            return true;
          })
          .map((entry) => ({ step, entry }))
      : [],
  );
}

/** One choice a player still has to make or has made, and which step shows it. */
export interface RulesetBuilderChoiceSlot {
  key: string;
  /** The step it is shown and counted at. */
  stepId: string;
  /** The entry that granted it; none for a trained step's own choice. */
  entry: RulesetCatalogEntry | null;
  count: number;
  /** What may be chosen. */
  from: string[];
  chosen: string[];
  /** New choices retain invalid answers for repair and explain disabled options. */
  stored?: string[];
  disabled?: Record<string, RulesetBuilderChoiceReason>;
  unresolved?: boolean;
  replacement?: boolean;
  quotas?: RulesetBuilderCatalogLimits["quotas"];
  quotaBelow?: RulesetBuilderCatalogLimits["quotaBelow"];
  distinctBy?: string;
  missing?: number;
}

/** Stored answers not currently active, including surplus copies of a repeating choice. */
export function rulesetBuilderInactiveChoices(slot: RulesetBuilderChoiceSlot): string[] {
  const active = [...slot.chosen];
  return (slot.stored ?? []).filter((id) => {
    const index = active.indexOf(id);
    if (index < 0) return true;
    active.splice(index, 1);
    return false;
  });
}

export interface RulesetBuilderAbilitySlot extends RulesetBuilderChoiceSlot {
  amount: number;
  /** No score goes past this through the choice (1.96). */
  upTo?: number;
  /** A score at or above this gets a partial increase; two make `amount` (1.211). */
  partialFrom?: number;
  /** One score may be chosen more than once (1.93). */
  repeat?: boolean;
}

export interface RulesetBuilderTrainedSlot extends RulesetBuilderChoiceSlot {
  what: "skills" | "saves";
  tier: string;
  only?: "any" | "trained" | "untrained";
  replaced?: string[];
  /** Only what is already trained to this tier or higher is offered (Capability API 1.105). */
  held?: string;
}

export interface RulesetBuilderEntrySlot extends RulesetBuilderChoiceSlot {
  /** The catalog the entries are chosen from; `from` holds their ids. */
  catalog: string;
}

/** The tier a grant trains to: its own, the builder's, or the first above untrained the sheet offers
 *  for skills or saves. */
function grantTier(
  definition: RulesetDefinition,
  grants: RulesetCatalogGrants | undefined,
  what: "skills" | "saves",
): string {
  const tiers = definition.resolution.proficiencyTiers;
  const offered = what === "skills" ? definition.sheet.skillTiers : definition.sheet.saveTiers;
  const firstOffered = tiers.slice(1).find((tier) => !offered || offered.includes(tier.id));
  return grants?.trained?.tier ?? definition.sheet.builder?.tier ?? firstOffered?.id ?? tiers[1]?.id ?? tiers[0]!.id;
}

function chosenSlot(
  definition: RulesetDefinition,
  choice: RulesetBuilderChoice,
  stored: string[],
  from: string[],
  earlier: Map<string, string[]>,
  build?: RulesetSheetBuild,
  repeat = false,
): Pick<RulesetBuilderChoiceSlot, "count" | "from" | "chosen" | "stored" | "disabled" | "unresolved"> {
  const count = choiceCount(definition, choice, build);
  const excluded = new Set((choice.excludeChoices ?? []).flatMap((id) => earlier.get(id) ?? []));
  const disabled: Record<string, RulesetBuilderChoiceReason> = {};
  for (const id of from) if (excluded.has(id)) disabled[id] = "excluded";
  const chosen = (repeat ? stored : [...new Set(stored)])
    .filter((id) => from.includes(id) && !disabled[id])
    .slice(0, count);
  const enhanced =
    choice.id !== undefined ||
    choice.countFrom !== undefined ||
    choice.max !== undefined ||
    choice.excludeChoices !== undefined;
  return { count, from, chosen, ...(enhanced ? { stored, disabled, unresolved: true } : {}) };
}

function orderedGrants(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build?: RulesetSheetBuild,
) {
  const granted = rulesetBuilderGranting(definition, state, catalogs, build);
  if (
    !granted.some(({ entry }) =>
      [entry.grants?.abilities, entry.grants?.trained, entry.grants?.entries].some((grant) =>
        grant?.choose?.some((choice) => choice.id),
      ),
    )
  )
    return granted;
  // A copy: what the grants are is read again, in their own order, elsewhere in the pass.
  return [...granted].sort((a, b) => {
    if (a.step !== b.step) return 0;
    const entries = catalogs[a.step.catalog] ?? [];
    return entries.indexOf(a.entry) - entries.indexOf(b.entry);
  });
}

/** Every ability choice the picks offer. Each is shown at the abilities step, or where the entry was
 *  picked when the builder has none. */
export function rulesetBuilderAbilitySlots(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  /** The sheet as it stands, which a step's `upTo` reads; no limit without it. */
  build?: RulesetSheetBuild,
): RulesetBuilderAbilitySlot[] {
  const hostStep = definition.sheet.builder?.steps.find((step) => step.kind === "abilities");
  if (hostStep && !rulesetBuilderStepVisible(definition, hostStep, build)) return [];
  const host = hostStep?.id;
  const all = definition.sheet.abilities.map((ability) => ability.id);
  const earlier = new Map<string, string[]>();
  return orderedGrants(definition, state, catalogs, build).flatMap(({ step, entry }) =>
    (entry.grants?.abilities?.choose ?? []).map((choice, index) => {
      const key = rulesetBuilderChoiceKey(step.id, entry.id, choice.id ?? index);
      const from = all.filter((id) => (!choice.from || choice.from.includes(id)) && !choice.except?.includes(id));
      const slot = chosenSlot(
        definition,
        choice,
        state.abilityChoices?.[key] ?? [],
        from,
        earlier,
        build,
        choice.repeat,
      );
      if (choice.id) earlier.set(`${step.id}/${choice.id}`, slot.chosen);
      return {
        ...slot,
        ...(choice.from ? { stored: state.abilityChoices?.[key] ?? [], unresolved: true } : {}),
        key,
        stepId: host ?? step.id,
        entry,
        amount: choice.amount,
        ...(choice.repeat ? { repeat: true } : {}),
        ...(choice.upTo !== undefined ? { upTo: choice.upTo } : {}),
        ...(choice.partialFrom !== undefined ? { partialFrom: choice.partialFrom } : {}),
      };
    }),
  );
}

function builderTrainingBase(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  build?: RulesetSheetBuild,
): RulesetBuilderState["trainingBase"] {
  const steps = definition.sheet.builder?.steps ?? [];
  const grants = orderedGrants(definition, state, catalogs, build);
  const choices = [
    ...steps.flatMap((step) =>
      step.kind === "trained"
        ? (step.choose ?? []).map((choice, index) => ({
            choice,
            key: rulesetBuilderChoiceKey(step.id, null, choice.id ?? index),
          }))
        : [],
    ),
    ...grants.flatMap(({ step, entry }) =>
      (entry.grants?.trained?.choose ?? []).map((choice, index) => ({
        choice,
        key: rulesetBuilderChoiceKey(step.id, entry.id, choice.id ?? index),
      })),
    ),
  ];
  if (!choices.some(({ choice }) => choice.only || choice.onDuplicate)) return state.trainingBase;
  const untrained = definition.resolution.proficiencyTiers[0]!.id;
  const base = { skills: { ...build?.skills }, saves: { ...build?.saves } };
  for (const what of ["skills", "saves"] as const) {
    for (const [id, tier] of Object.entries(base[what])) if (tier === untrained) delete base[what][id];
    if (!state.describing) {
      for (const [id, tier] of Object.entries(state.applied?.[what] ?? {}))
        if (base[what][id] === tier) {
          const original = state.trainingBase?.[what][id];
          if (original && original !== untrained) base[what][id] = original;
          else delete base[what][id];
        }
    } else {
      for (const { entry } of grants) for (const id of entry.grants?.trained?.[what] ?? []) delete base[what][id];
      for (const { choice, key } of choices) {
        if (choice.what !== what || choice.only === "trained") continue;
        for (const id of [
          ...(state.trainedChoices?.[key] ?? []),
          ...(state.trainedChoices?.[`${key}/replacement`] ?? []),
        ])
          delete base[what][id];
      }
    }
  }
  return base;
}

/** Every skill or save choice: the picks' and the trained steps' own. Shown at the first trained step,
 *  or where the entry was picked when the builder has none. A choice never offers what the picks already
 *  train to its tier or higher (1.104): not what an entry trains outright, nor what an earlier choice
 *  holds, so two sources that both teach Insight leave the second free for another skill. */
export function rulesetBuilderTrainedSlots(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  /** The sheet as it stands, which a step's `upTo` reads; no limit without it. */
  build?: RulesetSheetBuild,
): RulesetBuilderTrainedSlot[] {
  const steps = definition.sheet.builder?.steps ?? [];
  const hostStep = steps.find((step) => step.kind === "trained");
  const host = hostStep?.id;
  const known = {
    skills: definition.sheet.skills.map((skill) => skill.id),
    saves: definition.sheet.saves.map((save) => save.id),
  };
  const untrained = definition.resolution.proficiencyTiers[0]!.id;
  const have = { skills: new Set<string>(), saves: new Set<string>() };
  const baseline = builderTrainingBase(definition, state, catalogs, build);
  for (const what of ["skills", "saves"] as const) {
    for (const [id, tier] of Object.entries(build?.[what] ?? {}))
      if (
        tier !== untrained &&
        (state.describing
          ? baseline?.[what][id] !== undefined
          : state.applied?.[what][id] !== tier || baseline?.[what][id] !== undefined)
      )
        have[what].add(id);
  }
  const grants = orderedGrants(definition, state, catalogs, build);
  const rank = (tier: string) => definition.resolution.proficiencyTiers.findIndex((each) => each.id === tier);
  const outright = { skills: new Map<string, number>(), saves: new Map<string, number>() };
  for (const { entry } of grants) {
    for (const what of ["skills", "saves"] as const) {
      const tier = rank(grantTier(definition, entry.grants, what));
      for (const id of entry.grants?.trained?.[what] ?? [])
        outright[what].set(id, Math.max(tier, outright[what].get(id) ?? -1));
    }
  }
  // Explicit duplicate replacement keeps the original answer and opens a separate choice (1.151).
  const replacing = new Set<string>();
  const earlier = new Map<string, string[]>();
  const slots: RulesetBuilderTrainedSlot[] = [];
  // Training upgrades must leave the lower choice they build on intact.
  const over = (other: RulesetBuilderTrainedSlot, each: Pick<RulesetBuilderTrainedSlot, "what" | "tier">) =>
    other.what === each.what &&
    rank(other.tier) >= rank(each.tier) &&
    !(
      rank(each.tier) < rank(other.tier) &&
      (other.only === "trained" || (other.held !== undefined && rank(other.held) <= rank(each.tier)))
    );
  const slot = (
    step: RulesetBuilderStep,
    entry: RulesetCatalogEntry | null,
    choice: RulesetBuilderTrainedChoice,
    index: number,
  ) => {
    const key = rulesetBuilderChoiceKey(step.id, entry?.id ?? null, choice.id ?? index);
    const tier = choice.tier ?? grantTier(definition, entry?.grants, choice.what);
    const from = known[choice.what].filter(
      (id) =>
        (!choice.from || choice.from.includes(id)) &&
        (choice.onDuplicate === "replace" || (outright[choice.what].get(id) ?? -1) < rank(tier)),
    );
    if (choice.onDuplicate === "replace") replacing.add(key);
    const common = chosenSlot(definition, choice, state.trainedChoices?.[key] ?? [], from, earlier, build);
    const enhanced =
      common.unresolved || choice.only !== undefined || choice.onDuplicate !== undefined || choice.tier !== undefined;
    const disabled = { ...common.disabled };
    for (const id of from) {
      if (choice.only === "trained" && !have[choice.what].has(id)) disabled[id] = "untrained";
      if (choice.only === "untrained" && have[choice.what].has(id)) disabled[id] = "trained";
    }
    common.chosen = [...new Set(state.trainedChoices?.[key] ?? [])]
      .filter(
        (id) =>
          from.includes(id) &&
          !disabled[id] &&
          (choice.onDuplicate === "replace" ||
            !slots.some((earlier) => over(earlier, { what: choice.what, tier }) && earlier.chosen.includes(id))),
      )
      .slice(0, common.count);
    const duplicates = choice.onDuplicate === "replace" ? common.chosen.filter((id) => have[choice.what].has(id)) : [];
    const result: RulesetBuilderTrainedSlot = {
      ...common,
      key,
      stepId: entry ? (host ?? step.id) : step.id,
      entry,
      what: choice.what,
      tier,
      ...(choice.held !== undefined ? { held: choice.held } : {}),
      ...(choice.only ? { only: choice.only } : {}),
      ...(enhanced
        ? { stored: state.trainedChoices?.[key] ?? [], disabled, unresolved: true, replaced: duplicates }
        : {}),
    };
    slots.push(result);
    if (choice.id) earlier.set(`${step.id}/${choice.id}`, result.chosen);
    for (const id of result.chosen) have[choice.what].add(id);
    if (duplicates.length) {
      const replacementKey = `${key}/replacement`;
      const replacement = chosenSlot(
        definition,
        { ...choice, count: duplicates.length, countFrom: undefined },
        state.trainedChoices?.[replacementKey] ?? [],
        // A named replacement pool (1.155) holds for what is shown, saved and applied alike.
        choice.replacementFrom
          ? known[choice.what].filter((id) => choice.replacementFrom!.includes(id))
          : known[choice.what],
        earlier,
        build,
      );
      const blocked = { ...replacement.disabled };
      for (const id of replacement.from) if (have[choice.what].has(id)) blocked[id] = "trained";
      replacement.chosen = [...new Set(state.trainedChoices?.[replacementKey] ?? [])]
        .filter((id) => replacement.from.includes(id) && !blocked[id])
        .slice(0, replacement.count);
      slots.push({
        ...result,
        ...replacement,
        key: replacementKey,
        disabled: blocked,
        stored: state.trainedChoices?.[replacementKey] ?? [],
        replacement: true,
        unresolved: true,
      });
      for (const id of replacement.chosen) have[choice.what].add(id);
      if (choice.id) earlier.set(`${step.id}/${choice.id}`, [...result.chosen, ...replacement.chosen]);
    }
  };
  for (const step of steps) {
    if (!rulesetBuilderStepVisible(definition, step, build)) continue;
    for (const { entry } of grants.filter((grant) => grant.step === step)) {
      for (const what of ["skills", "saves"] as const)
        for (const id of entry.grants?.trained?.[what] ?? []) have[what].add(id);
      if (!hostStep || rulesetBuilderStepVisible(definition, hostStep, build))
        (entry.grants?.trained?.choose ?? []).forEach((choice, index) => slot(step, entry, choice, index));
    }
    if (step.kind === "trained") (step.choose ?? []).forEach((choice, index) => slot(step, null, choice, index));
  }
  const enhanced = slots.some((slot) => slot.unresolved);
  const ordered = enhanced ? slots : [...slots.filter((slot) => slot.entry), ...slots.filter((slot) => !slot.entry)];
  const kept: RulesetBuilderTrainedSlot[] = [];
  for (const each of ordered) {
    const held = (id: string) => kept.some((earlier) => over(earlier, each) && earlier.chosen.includes(id));
    kept.push({
      ...each,
      chosen: [...new Set(state.trainedChoices?.[each.key] ?? [])]
        .filter((id) => each.from.includes(id) && !each.disabled?.[id] && (replacing.has(each.key) || !held(id)))
        .slice(0, each.count),
    });
  }
  return kept.map((each) => {
    const elsewhere = new Set(
      kept.filter((other) => other !== each && over(other, each)).flatMap((other) => other.chosen),
    );
    let from = each.from.filter((id) => replacing.has(each.key) || each.chosen.includes(id) || !elsewhere.has(id));
    if (each.held !== undefined) {
      const floor = rank(each.held);
      const below = new Set(
        kept
          .filter(
            (other) => other.what === each.what && rank(other.tier) >= floor && rank(other.tier) < rank(each.tier),
          )
          .flatMap((other) => other.chosen),
      );
      from = from.filter((id) => (outright[each.what].get(id) ?? -1) >= floor || below.has(id));
    }
    return { ...each, from, chosen: each.chosen.filter((id) => from.includes(id)) };
  });
}

/** Every choice of catalog entries the picks grant (1.91), shown at the first `choices` step for its
 *  catalog. Only entries that write rows are offered, since rows are all a choice puts on the sheet. An
 *  entry is never chosen twice: one chosen at an earlier slot is that slot's, and is not offered to
 *  the others, so a slot never waits on a choice nobody can make. */
export function rulesetBuilderEntrySlots(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  /** The sheet as it stands, which a step's `upTo` reads; no limit without it. */
  build?: RulesetSheetBuild,
): RulesetBuilderEntrySlot[] {
  const steps = definition.sheet.builder?.steps ?? [];
  const granting = orderedGrants(definition, state, catalogs, build);
  // What the picks give outright (1.788) is held already, so no choice offers it again.
  const given = new Set<string>(
    granting.flatMap(({ entry }) =>
      (entry.grants?.entries?.add ?? []).flatMap((add) => add.ids.map((id) => `${add.catalog}/${id}`)),
    ),
  );
  const taken = new Set<string>();
  const earlier = new Map<string, string[]>();
  const slots = granting.flatMap(({ step, entry }) =>
    (entry.grants?.entries?.choose ?? [])
      .filter((choice) => {
        const host = steps.find((each) => each.kind === "choices" && each.catalog === choice.catalog);
        return !host || rulesetBuilderStepVisible(definition, host, build);
      })
      .map((choice): RulesetBuilderEntrySlot => {
        const key = rulesetBuilderChoiceKey(
          step.id,
          entry.id,
          choice.id ?? entry.grants!.entries!.choose!.indexOf(choice),
        );
        const host = steps.find(
          (each) =>
            each.kind === "choices" &&
            each.catalog === choice.catalog &&
            rulesetBuilderStepVisible(definition, each, build),
        )?.id;
        const from = (catalogs[choice.catalog] ?? [])
          .filter(
            (option) =>
              (option.rows?.length ?? 0) > 0 &&
              // A variant is used through its parent's row, never picked on its own (1.769), here as
              // in a catalog step: "Produce Flame (held)" is Produce Flame's (laptop class builds 2026-10-24).
              option.variantOf === undefined &&
              Object.entries(choice.filters ?? {}).every(([filterId, value]) => filterHas(option, filterId, value)) &&
              (!choice.ids || choice.ids.includes(option.id)) &&
              !given.has(`${choice.catalog}/${option.id}`) &&
              (!option.offeredWhen || !build || resolveRulesetValueRef(definition, build, option.offeredWhen) > 0),
          )
          .map((option) => option.id);
        const common = chosenSlot(definition, choice, state.entryChoices?.[key] ?? [], from, earlier, build);
        const options = catalogs[choice.catalog] ?? [];
        const candidates = [...new Set(state.entryChoices?.[key] ?? [])]
          .filter((id) => from.includes(id) && !common.disabled?.[id] && !taken.has(`${choice.catalog}/${id}`))
          .map((id) => options.find((entry) => entry.id === id)!);
        const chosen = limitedEntries(candidates, choice, common.count).map((entry) => entry.id);
        for (const id of chosen) taken.add(`${choice.catalog}/${id}`);
        if (choice.id) earlier.set(`${step.id}/${choice.id}`, chosen);
        const enhanced = common.unresolved || choice.quotas || choice.distinctBy || choice.quotaBelow;
        const disabled = { ...common.disabled };
        const picked = options.filter((entry) => chosen.includes(entry.id));
        if (choice.quotas || choice.distinctBy || choice.quotaBelow)
          for (const entry of options) {
            if (!from.includes(entry.id) || chosen.includes(entry.id)) continue;
            const reason = entryLimitReason(entry, picked, choice);
            if (reason) disabled[entry.id] = reason;
          }
        return {
          ...common,
          key,
          stepId: host ?? step.id,
          entry,
          catalog: choice.catalog,
          chosen,
          ...(enhanced
            ? {
                stored: state.entryChoices?.[key] ?? [],
                disabled,
                unresolved: true,
                quotas: choice.quotas,
                distinctBy: choice.distinctBy,
                quotaBelow: choice.quotaBelow,
                missing: Math.max(
                  0,
                  ...(choice.quotas ?? []).map(
                    (quota) => quota.min - picked.filter((entry) => filterHas(entry, quota.filter, quota.value)).length,
                  ),
                ),
              }
            : {}),
        };
      }),
  );
  // What another slot holds is not this one's to offer.
  return slots.map((slot) => {
    const elsewhere = new Set(
      slots.filter((other) => other !== slot && other.catalog === slot.catalog).flatMap((other) => other.chosen),
    );
    return { ...slot, from: slot.from.filter((id) => slot.chosen.includes(id) || !elsewhere.has(id)) };
  });
}

/** The abilities an abilities step sets. */
export function rulesetBuilderAbilityIds(definition: RulesetDefinition, step: StepOf<"abilities">): string[] {
  // A worked-out score (1.156) is never one the builder sets.
  const all = definition.sheet.abilities.filter((ability) => !ability.value).map((ability) => ability.id);
  return step.abilities ? all.filter((id) => step.abilities!.includes(id)) : all;
}

/** What point buy has spent on these scores, or null when one of them is not on the cost table. */
export function rulesetPointBuySpent(
  pointBuy: NonNullable<StepOf<"abilities">["methods"]["pointBuy"]>,
  scores: Record<string, number>,
  ids: readonly string[],
): number | null {
  let spent = 0;
  for (const id of ids) {
    const row = pointBuy.costs.find(([score]) => score === scores[id]);
    if (!row) return null;
    spent += row[1];
  }
  return spent;
}

/** The method the scores are set by: the player's, else the step's `default` (1.87) for a character the
 *  builder makes, never for one it describes; none when the step does not offer it. */
export function rulesetBuilderMethod(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
): RulesetBuilderMethod | undefined {
  const step = definition.sheet.builder?.steps.find((each): each is StepOf<"abilities"> => each.kind === "abilities");
  if (!step) return undefined;
  const method = state.method ?? (state.made === "builder" && !state.describing ? step.default : undefined);
  return method && step.methods[method] ? method : undefined;
}

/** The scores the chosen method gives, before any increase. An ability the method has not set yet
 *  is left out, and keeps what the sheet has. */
export function rulesetBuilderBaseScores(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
): Record<string, number> {
  const step = definition.sheet.builder?.steps.find((each): each is StepOf<"abilities"> => each.kind === "abilities");
  const method = rulesetBuilderMethod(definition, state);
  if (!step || !method) return {};
  const ids = rulesetBuilderAbilityIds(definition, step);
  const base: Record<string, number> = {};
  if (method === "pointBuy" || method === "manual") {
    const costs = step.methods.pointBuy?.costs;
    const manual = step.methods.manual;
    const lowest = costs?.[0]?.[0];
    const highest = costs?.[costs.length - 1]?.[0];
    for (const id of ids) {
      const value = state.base?.[id];
      if (method === "pointBuy" && lowest !== undefined && highest !== undefined) {
        // A score typed by hand and then bought starts from the nearest score on the table.
        base[id] = typeof value === "number" ? clamp(value, lowest, highest) : lowest;
      } else if (typeof value === "number") {
        base[id] = method === "manual" && typeof manual === "object" ? clamp(value, manual.min, manual.max) : value;
      }
    }
    return base;
  }
  if (method === "rolls") {
    // Rolled in order: each score keeps its own roll, never moved to another.
    for (const id of ids) {
      const rolled = state.rolledBy?.[id];
      if (rolled && Number.isFinite(rolled.total)) base[id] = rolled.total;
    }
    return base;
  }
  const values = method === "standardArray" ? (step.methods.standardArray ?? []) : (state.rolled ?? []);
  const taken = new Set<number>();
  for (const id of ids) {
    const index = state.assign?.[id];
    // Each value goes to one score: a second claim on it is no claim.
    if (index === undefined || taken.has(index) || values[index] === undefined) continue;
    taken.add(index);
    base[id] = values[index]!;
  }
  return base;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The text or enum value a catalog step writes to its field for these picks, or undefined for none. */
function stepFieldValue(
  definition: RulesetDefinition,
  step: StepOf<"catalog">,
  picks: readonly RulesetCatalogEntry[],
  /** The step's whole catalog, which tells a pick's own name from what only sets it apart there. */
  entries: readonly RulesetCatalogEntry[] = [],
): Scalar | undefined {
  const field = step.field ? definition.sheet.fields.find((each) => each.id === step.field) : undefined;
  if (!field || picks.length === 0) return undefined;
  if (field.type === "enum") {
    for (const entry of picks) {
      if (field.values.includes(entry.id)) return entry.id;
      if (field.values.includes(entry.label)) return entry.label;
    }
    return undefined;
  }
  if (field.type === "text" || field.type === "longtext") {
    // "Cleric (second class)" is the catalog's Cleric told apart from the first-class one: the sheet
    // says Cleric, as it does when the same name stands on its own in the catalog.
    const labels = new Set(entries.map((entry) => entry.label.trim().toLowerCase()));
    const named = (label: string) => {
      const bare = /^(.*\S)\s*\([^()]*\)$/u.exec(label.trim())?.[1];
      return bare && labels.has(bare.toLowerCase()) ? bare : label;
    };
    return picks
      .map((entry) => named(entry.label))
      .join(", ")
      .slice(0, field.maxLength);
  }
  return undefined;
}

/** What the builder's choices come to, worked out from scratch. */
/** An increase a choice with `upTo` (1.96) or `partialFrom` (1.211) gives, applied after every
 *  other so it stops at its cap and sees the score it lands on. */
interface CappedIncrease {
  id: string;
  by: number;
  upTo: number;
  partialFrom?: number;
}

function desired(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  /** The sheet as it stands, which a step's `upTo` reads; no limit without it. */
  build?: RulesetSheetBuild,
): RulesetBuilderApplied & { capped: CappedIncrease[] } {
  const out: RulesetBuilderApplied & { capped: CappedIncrease[] } = {
    increases: {},
    scores: {},
    skills: {},
    saves: {},
    fields: {},
    rows: [],
    capped: [],
  };
  const abilities = new Set(definition.sheet.abilities.map((ability) => ability.id));
  const known = {
    skills: new Set(definition.sheet.skills.map((skill) => skill.id)),
    saves: new Set(definition.sheet.saves.map((save) => save.id)),
  };
  const fieldIds = new Set(definition.sheet.fields.map((field) => field.id));
  const bump = (id: string, by: number) => {
    if (abilities.has(id)) out.increases[id] = (out.increases[id] ?? 0) + by;
  };
  const tierRank = (tier: string | undefined) =>
    definition.resolution.proficiencyTiers.findIndex((each) => each.id === tier);
  // Trained twice, to two tiers (proficient from a class, expertise built on it), keeps the higher.
  const train = (what: "skills" | "saves", id: string, tier: string) => {
    if (known[what].has(id) && tierRank(tier) >= tierRank(out[what][id])) out[what][id] = tier;
  };
  for (const { step, entry } of rulesetBuilderGranting(definition, state, catalogs, build)) {
    const grants = entry.grants;
    for (const [id, by] of Object.entries(grants?.abilities?.add ?? {})) bump(id, by);
    for (const what of ["skills", "saves"] as const)
      for (const id of grants?.trained?.[what] ?? []) train(what, id, grantTier(definition, grants, what));
    for (const [id, value] of Object.entries(grants?.sets ?? {})) if (fieldIds.has(id)) out.fields[id] = value;
    if (entry.rows) out.rows.push(catalogRowRef(step.catalog, entry.id));
  }
  for (const step of definition.sheet.builder?.steps ?? []) {
    if (step.kind !== "catalog") continue;
    const value = stepFieldValue(
      definition,
      step,
      rulesetBuilderPicks(definition, step.id, state, catalogs, build),
      catalogs[step.catalog],
    );
    if (value !== undefined && step.field) out.fields[step.field] = value;
  }
  for (const slot of rulesetBuilderAbilitySlots(definition, state, catalogs, build)) {
    for (const id of slot.chosen) {
      if (slot.upTo !== undefined || slot.partialFrom !== undefined) {
        if (abilities.has(id))
          out.capped.push({
            id,
            by: slot.amount,
            upTo: slot.upTo ?? 1e9,
            ...(slot.partialFrom !== undefined ? { partialFrom: slot.partialFrom } : {}),
          });
      } else bump(id, slot.amount);
    }
  }
  for (const slot of rulesetBuilderTrainedSlots(definition, state, catalogs, build)) {
    for (const id of slot.chosen) if (!slot.replaced?.includes(id)) train(slot.what, id, slot.tier);
  }
  for (const slot of rulesetBuilderEntrySlots(definition, state, catalogs, build)) {
    for (const id of slot.chosen) {
      const ref = catalogRowRef(slot.catalog, id);
      if (!out.rows.includes(ref)) out.rows.push(ref);
    }
  }
  // Entries given outright (1.788): an elf's Common and Elvish.
  for (const { entry } of rulesetBuilderGranting(definition, state, catalogs, build))
    for (const given of entry.grants?.entries?.add ?? [])
      for (const id of given.ids) {
        const ref = catalogRowRef(given.catalog, id);
        if ((catalogs[given.catalog] ?? []).some((each) => each.id === id) && !out.rows.includes(ref))
          out.rows.push(ref);
      }
  // An improvement check that raised an ability (1.209) stays an increase while its step shows.
  for (const step of definition.sheet.builder?.steps ?? []) {
    if (step.kind !== "roll" || !rulesetBuilderStepVisible(definition, step, build)) continue;
    for (const roll of step.rolls) {
      const added = state.rolls?.[step.id]?.[roll.id]?.added;
      if (roll.ability !== undefined && added) bump(roll.ability, added);
    }
  }
  return out;
}

/** Whether a build is still the ruleset's blank sheet: nothing typed, trained or listed. A character
 *  that is not was made some other way, and the builder starts by describing it. */
export function rulesetSheetBuildIsBlank(definition: RulesetDefinition, build: RulesetSheetBuild): boolean {
  const blank = defaultRulesetSheetBuild(definition);
  const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) => a[key] === b[key]);
  return (
    same(build.abilities, blank.abilities) &&
    same(build.fields, blank.fields) &&
    Object.keys(build.skills).length === 0 &&
    Object.keys(build.saves).length === 0 &&
    Object.values(build.bonuses ?? {}).every((value) => !value) &&
    Object.values(build.lists).every((rows) => !Array.isArray(rows) || rows.length === 0)
  );
}

/** Every catalog the builder's steps read, so a caller can load them before applying anything. */
export function rulesetBuilderCatalogIds(definition: RulesetDefinition): string[] {
  const ids = (definition.sheet.builder?.steps ?? []).flatMap((step) =>
    step.kind === "catalog" || step.kind === "choices" ? [step.catalog] : [],
  );
  return [...new Set(ids)];
}

/**
 * The build with the builder's choices applied, and the state that records what was written.
 *
 * `catalogs` must hold every catalog the builder reads (`rulesetBuilderCatalogIds`): a pick whose
 * catalog is missing grants nothing, which would take back what it gave.
 */
function applyRulesetBuilderWithoutSpending(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  given: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): { build: RulesetSheetBuild; state: RulesetBuilderState } {
  // A blank sheet the builder starts is the builder's, and keeps the method it starts on (1.87), so a
  // later change to the ruleset's default never moves its scores.
  let state = given;
  const trainingBase = builderTrainingBase(
    definition,
    state,
    catalogs,
    withoutBuilderRatings(definition, build, state),
  );
  if (trainingBase !== state.trainingBase) state = { ...state, trainingBase };
  if (!state.describing && !state.made && state.applied === undefined && rulesetSheetBuildIsBlank(definition, build)) {
    state = { ...state, made: "builder" };
  }
  if (state.made === "builder" && !state.describing && !state.method) {
    const method = rulesetBuilderMethod(definition, state);
    if (method) state = { ...state, method };
  }
  // A pick can change what a step's `upTo` reads (a class that sets the level), so the builder's
  // answer is worked out again on what it wrote until it settles.
  const steps = definition.sheet.builder?.steps ?? [];
  const passes = rulesetBuilderUsesChoiceConstraints(definition, catalogs) ? Math.max(3, steps.length) : 3;
  let result = applyRulesetBuilderOnce(definition, build, state, catalogs);
  for (let pass = 0; pass < passes; pass++) {
    const again = applyRulesetBuilderOnce(definition, result.build, result.state, catalogs);
    if (JSON.stringify(again) === JSON.stringify(result)) break;
    result = again;
  }
  return result;
}

function ratingTarget(definition: RulesetDefinition, key: string): RulesetBuilderRatingTarget | undefined {
  const [kind, id, extra] = key.split("/");
  if (!id || extra !== undefined) return undefined;
  const sheet = definition.sheet;
  if (kind === "ability" && sheet.abilities.some((entry) => entry.id === id)) return { ability: id };
  if (kind === "field" && sheet.fields.some((entry) => entry.id === id && entry.type === "number"))
    return { field: id };
  if (kind === "skill" && sheet.skills.some((entry) => entry.id === id)) return { skill: id };
  if (kind === "save" && sheet.saves.some((entry) => entry.id === id)) return { save: id };
  if (kind === "bonus" && [...sheet.skills, ...sheet.saves].some((entry) => entry.id === id)) return { bonus: id };
  return undefined;
}

function ratingLocation(
  target: RulesetBuilderRatingTarget,
): ["abilities" | "fields" | "skills" | "saves" | "bonuses", string] {
  if ("ability" in target) return ["abilities", target.ability];
  if ("field" in target) return ["fields", target.field];
  if ("skill" in target) return ["skills", target.skill];
  if ("save" in target) return ["saves", target.save];
  return ["bonuses", target.bonus];
}

function ratingTiers(definition: RulesetDefinition, target: RulesetBuilderRatingTarget): string[] | undefined {
  return definition.sheet.builder?.ratingTiers?.find(
    (entry) => rulesetBuilderRatingKey(entry.target) === rulesetBuilderRatingKey(target),
  )?.tiers;
}

function ratingNumber(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  target: RulesetBuilderRatingTarget,
): number | null {
  const [what, id] = ratingLocation(target);
  const value = build[what]?.[id];
  if (what === "skills" || what === "saves") {
    const index =
      ratingTiers(definition, target)?.indexOf(
        typeof value === "string" ? value : definition.resolution.proficiencyTiers[0]!.id,
      ) ?? -1;
    return index < 0 ? null : index;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (what === "bonuses") return 0;
  const blank = defaultRulesetSheetBuild(definition)[what][id];
  return typeof blank === "number" ? blank : null;
}

function writeRating(build: RulesetSheetBuild, target: RulesetBuilderRatingTarget, value: Scalar | undefined): void {
  const [what, id] = ratingLocation(target);
  const values: Record<string, Scalar> = { ...build[what] };
  if (value === undefined) delete values[id];
  else values[id] = value;
  Object.assign(build, { [what]: values });
}

function withoutBuilderRatings(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
): RulesetSheetBuild {
  if (!state.applied?.ratings) return build;
  const out = { ...build };
  for (const [key, owned] of Object.entries(state.applied.ratings)) {
    const target = ratingTarget(definition, key);
    if (!target) continue;
    const [what, id] = ratingLocation(target);
    const before = owned.before;
    if (before !== undefined) {
      if (what === "skills" || what === "saves") {
        if (!definition.resolution.proficiencyTiers.some((tier) => tier.id === before)) continue;
      } else {
        const [min, max] = rulesetBuilderRatingBounds(definition, target);
        const field = what === "fields" ? definition.sheet.fields.find((entry) => entry.id === id) : undefined;
        if (
          typeof before !== "number" ||
          !Number.isFinite(before) ||
          before < min ||
          before > max ||
          ((what === "abilities" || what === "bonuses" || (field?.type === "number" && field.integer)) &&
            !Number.isInteger(before))
        )
          continue;
      }
    }
    writeRating(out, target, before);
  }
  return out;
}

export interface RulesetBuilderAllocationRow {
  key: string;
  target: RulesetBuilderRatingTarget;
  base: number | null;
  free: number;
  bought: number;
  stored: number;
  total: number | null;
  min: number | null;
  max: number | null;
  inactive: boolean;
  canAdd: boolean;
  override?: number | string;
}
export interface RulesetBuilderAllocation {
  stepId: string;
  groupId: string;
  budget: number | null;
  spent: number;
  remaining: number | null;
  missing: number;
  notConfigured: boolean;
  rows: RulesetBuilderAllocationRow[];
}

/** Compose base, free grants and each stage's paid increments. No creation cap clamps another stage. */
function allocationPlan(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  readingBuild = build,
) {
  const steps = (definition.sheet.builder?.steps ?? []).filter(
    (step): step is StepOf<"allocate"> =>
      step.kind === "allocate" && rulesetBuilderStepVisible(definition, step, readingBuild),
  );
  const grants = rulesetBuilderGranting(definition, state, catalogs, readingBuild).flatMap(
    ({ entry }) => entry.grants?.ratings ?? [],
  );
  const values = new Map<
    string,
    { target: RulesetBuilderRatingTarget; value: number | null; base: number | null; free: number }
  >();
  const get = (target: RulesetBuilderRatingTarget) => {
    const key = rulesetBuilderRatingKey(target);
    if (!values.has(key)) {
      const base = ratingNumber(definition, build, target);
      values.set(key, { target, base, value: base, free: 0 });
    }
    return values.get(key)!;
  };
  const read = (value: number | RulesetValueRef | undefined, limit = 10000): number | null => {
    if (value === undefined) return null;
    const number = typeof value === "number" ? value : resolveRulesetValueRef(definition, readingBuild, value);
    return Number.isInteger(number) && number >= 0 && number <= limit ? number : null;
  };
  const readBase = (value: number | RulesetValueRef, target: RulesetBuilderRatingTarget) => {
    const base = read(value);
    const [min, max] = rulesetBuilderRatingBounds(definition, target);
    return base !== null && base >= min && base <= max ? base : null;
  };
  const initialized = new Set<string>();
  for (const step of steps)
    for (const group of step.groups)
      for (const target of group.targets) {
        const key = rulesetBuilderRatingKey(target);
        const entry = get(target);
        if (initialized.has(key)) continue;
        initialized.add(key);
        if (group.base !== undefined) {
          const base = readBase(group.base, target);
          const [what, id] = ratingLocation(target);
          const legacyOwned =
            what === "abilities"
              ? state.applied?.scores[id] !== undefined || !!state.applied?.increases[id]
              : what !== "bonuses" && state.applied?.[what][id] !== undefined;
          entry.base =
            base === null || entry.base === null
              ? null
              : what === "abilities" && state.applied?.scores[id] === undefined
                ? base + (state.applied?.increases[id] ?? 0)
                : legacyOwned
                  ? Math.max(entry.base, base)
                  : base;
          entry.value = entry.base;
        }
      }
  // Set grants are floors; all adds follow the highest floor, independent of catalog order.
  for (const grant of grants)
    if ("set" in grant) {
      const entry = get(grant.target);
      if (entry.value !== null) entry.value = Math.max(entry.value, grant.set);
    }
  for (const grant of grants)
    if ("add" in grant) {
      const entry = get(grant.target);
      if (entry.value !== null) entry.value += grant.add;
    }
  for (const entry of values.values()) {
    const [min, max] = rulesetBuilderRatingBounds(definition, entry.target);
    const implicitBonus =
      "bonus" in entry.target && entry.base === 0 && build.bonuses[entry.target.bonus] === undefined;
    if (
      entry.base !== null &&
      !implicitBonus &&
      (entry.base < min || entry.base > max || !Number.isInteger(entry.base))
    )
      entry.value = null;
    else if (entry.value !== null) entry.value = clamp(entry.value, min, max);
    entry.free = entry.value !== null && entry.base !== null ? entry.value - entry.base : 0;
  }
  const groups: RulesetBuilderAllocation[] = [];
  const applied: Record<string, Record<string, number>> = {};
  const used = new Set<string>();
  for (const step of steps) {
    applied[step.id] = {};
    const saved = state.allocations?.[step.id];
    const slots = new Set<number>();
    for (const group of step.groups) {
      const assigned = saved?.priorities?.[group.id];
      const priority = assigned !== undefined && !slots.has(assigned) ? step.priorities?.[assigned] : undefined;
      if (assigned !== undefined) slots.add(assigned);
      const budget = step.priorities ? (priority ?? null) : read(group.budget, 1200000);
      const min = read(group.min);
      const max = read(group.max);
      const rows = group.targets.map((target): RulesetBuilderAllocationRow => {
        const key = rulesetBuilderRatingKey(target);
        const entry = get(target);
        if (used.has(key) && group.base !== undefined) {
          const floor = readBase(group.base, target);
          entry.value = floor === null || entry.value === null ? null : Math.max(entry.value, floor);
        }
        const base = used.has(key) ? entry.value : entry.base;
        const free = used.has(key) ? 0 : entry.free;
        used.add(key);
        const [low, high] = rulesetBuilderRatingBounds(definition, target);
        const configured =
          min !== null && max !== null && min <= max && min >= low && max <= high && entry.value !== null;
        const stored = saved?.bought?.[key] ?? 0;
        const valid = Number.isInteger(stored) && stored >= 0 && stored <= 10000;
        return {
          key,
          target,
          base,
          free,
          stored,
          bought: valid ? stored : 0,
          total: entry.value,
          min,
          max,
          inactive:
            !valid || !configured || (entry.value !== null && max !== null && stored > 0 && entry.value + stored > max),
          canAdd: false,
        };
      });
      // Dots on list rows' own ratings (1.216) count first; they are edited on the list, not here.
      const rowDots = (group.rows ?? []).reduce((sum, { list, column }) => {
        const rows = readingBuild.lists?.[list];
        if (!Array.isArray(rows)) return sum;
        return (
          sum +
          rows.reduce((total, row) => {
            const value = row && typeof row === "object" ? (row as Record<string, unknown>)[column] : undefined;
            return total + (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0);
          }, 0)
        );
      }, 0);
      const requested = rows.reduce((sum, row) => sum + (row.inactive ? 0 : row.bought), 0);
      const overspent = budget === null || requested + rowDots > budget;
      let spent = rowDots;
      for (const row of rows) {
        row.inactive ||= overspent && row.stored > 0;
        if (row.inactive) row.bought = 0;
        if (row.total !== null) row.total += row.bought;
        spent += row.bought;
        get(row.target).value = row.total;
        applied[step.id]![row.key] = row.bought;
      }
      const notConfigured =
        rows.some((row) => {
          const [low, high] = rulesetBuilderRatingBounds(definition, row.target);
          return (
            row.total === null ||
            row.min === null ||
            row.max === null ||
            row.min > row.max ||
            row.min < low ||
            row.max > high
          );
        }) ||
        (!step.priorities && budget === null);
      const remaining = budget === null ? null : budget - spent;
      for (const row of rows)
        row.canAdd =
          !notConfigured &&
          !rows.some((each) => each.inactive) &&
          remaining !== null &&
          remaining > 0 &&
          row.total !== null &&
          max !== null &&
          row.total < max;
      const missing = Math.max(
        remaining ?? 1,
        rows.filter(
          (row) =>
            row.inactive || row.total === null || min === null || max === null || row.total < min || row.total > max,
        ).length,
        notConfigured ? 1 : 0,
        // More row dots than the budget is a choice still to undo.
        remaining !== null && remaining < 0 ? 1 : 0,
      );
      groups.push({ stepId: step.id, groupId: group.id, budget, spent, remaining, missing, notConfigured, rows });
    }
  }
  return { values, groups, applied };
}

/** What the allocation UI and step badges show, without writing to the sheet. */
export function rulesetBuilderAllocations(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): RulesetBuilderAllocation[] {
  build = withoutBuilderSpending(definition, build, state);
  const plan = allocationPlan(definition, withoutBuilderRatings(definition, build, state), state, catalogs, build);
  for (const group of plan.groups)
    for (const row of group.rows) {
      const actual = ratingNumber(definition, build, row.target);
      if (actual !== plan.values.get(row.key)?.value) {
        const [what, id] = ratingLocation(row.target);
        const value = build[what]?.[id];
        if (typeof value === "number" || typeof value === "string") row.override = value;
        group.missing = Math.max(1, group.missing);
      }
    }
  return plan.groups;
}

function applyRulesetBuilderOnce(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): { build: RulesetSheetBuild; state: RulesetBuilderState } {
  const previous = state.applied?.ratings ?? {};
  const result = applyRulesetBuilderLegacy(
    definition,
    withoutBuilderRatings(definition, build, state),
    state,
    catalogs,
    build,
  );
  if (
    !Object.keys(previous).length &&
    !definition.sheet.builder?.steps.some((step) => step.kind === "allocate") &&
    !rulesetBuilderGranting(definition, state, catalogs, build).some(({ entry }) => entry.grants?.ratings)
  )
    return result;
  const plan = allocationPlan(definition, result.build, result.state, catalogs, build);
  const out = { ...result.build };
  const ratings: NonNullable<RulesetBuilderApplied["ratings"]> = {};
  for (const key of new Set([...Object.keys(previous), ...plan.values.keys()])) {
    const target = plan.values.get(key)?.target ?? ratingTarget(definition, key);
    if (!target) continue;
    const [what, id] = ratingLocation(target);
    const before = result.build[what]?.[id];
    const desired = plan.values.get(key)?.value ?? ratingNumber(definition, result.build, target);
    const current = ratingNumber(definition, build, target);
    const old = previous[key];
    // A manual override stays visible; changing a purchase moves only its owned difference.
    const next = old && current !== null && desired !== null ? current + desired - old.desired : desired;
    const [min, max] = rulesetBuilderRatingBounds(definition, target);
    const restoring = !plan.values.has(key) && next === ratingNumber(definition, result.build, target);
    const blocked =
      current === null || next === null || (!restoring && (next < min || next > max || !Number.isInteger(next)));
    if (state.describing || (blocked && old)) writeRating(out, target, build[what]?.[id]);
    else if (!blocked) {
      const value = what === "skills" || what === "saves" ? ratingTiers(definition, target)?.[next] : next;
      writeRating(out, target, restoring ? before : value);
    }
    if (blocked && !state.describing && !(next !== null && next < min)) {
      if (old && plan.values.has(key)) ratings[key] = old;
      for (const [stepId, purchases] of Object.entries(plan.applied)) {
        if (key in purchases) purchases[key] = state.applied?.allocations?.[stepId]?.[key] ?? 0;
      }
    } else if (plan.values.has(key) && desired !== null)
      ratings[key] = { ...(before !== undefined ? { before } : {}), desired };
  }
  return {
    build: state.describing ? build : out,
    state: {
      ...result.state,
      applied: {
        ...result.state.applied!,
        ratings,
        allocations: plan.applied,
      },
    },
  };
}

function applyRulesetBuilderLegacy(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  readingBuild = build,
): { build: RulesetSheetBuild; state: RulesetBuilderState } {
  const previous: RulesetBuilderApplied = state.applied ?? {
    increases: {},
    scores: {},
    skills: {},
    saves: {},
    fields: {},
    rows: [],
  };
  const { capped, ...want } = desired(definition, state, catalogs, readingBuild);
  /** The increase capped choices add to a score that stands at `from` before them, each stopping at
   *  its own cap and never taking away (1.96). */
  const cappedOn = (id: string, from: number) => {
    let score = from;
    // A partial increase (1.211) waits for a second one, and the pair gives one whole increase.
    let half = false;
    for (const each of capped) {
      if (each.id !== id) continue;
      if (each.partialFrom !== undefined && score >= each.partialFrom) {
        half = !half;
        if (half) continue;
      }
      score += Math.max(0, Math.min(each.by, each.upTo - score));
    }
    return score - from;
  };
  if (state.describing) {
    // Describing: every pick's grants are recorded as given (so a later change takes them back, as far
    // as the sheet still shows them), and nothing is written, now or when describing ends.
    // A value the player changed in the builder's own fields step stays theirs to the builder.
    const fields = { ...want.fields };
    for (const [id, value] of Object.entries(previous.fields)) {
      if (id in fields && build.fields[id] === value) fields[id] = value;
    }
    // A capped increase is recorded as what it gave a score that already shows it: the largest amount,
    // up to all of it, that the cap would have let through from the score without it.
    const increases = { ...want.increases };
    for (const ability of definition.sheet.abilities) {
      const id = ability.id;
      const full = capped.filter((each) => each.id === id).reduce((sum, each) => sum + each.by, 0);
      if (full === 0) continue;
      const current = typeof build.abilities[id] === "number" ? build.abilities[id]! : ability.default;
      const uncapped = want.increases[id] ?? 0;
      let gave = 0;
      for (let x = full; x >= 0; x--) {
        if (cappedOn(id, current - uncapped - x) === x) {
          gave = x;
          break;
        }
      }
      if (uncapped + gave !== 0) increases[id] = uncapped + gave;
    }
    const trainingBefore: NonNullable<RulesetBuilderApplied["trainingBefore"]> = { skills: {}, saves: {} };
    for (const slot of rulesetBuilderTrainedSlots(definition, state, catalogs, readingBuild))
      if (slot.only === "trained")
        for (const id of slot.chosen) {
          const original = state.trainingBase?.[slot.what][id];
          if (original !== undefined) trainingBefore[slot.what][id] = original;
        }
    return {
      build,
      state: {
        ...state,
        applied: {
          ...want,
          increases,
          fields,
          scores: {},
          ...(Object.keys(trainingBefore.skills).length || Object.keys(trainingBefore.saves).length
            ? { trainingBefore }
            : {}),
        },
      },
    };
  }
  // What this run actually writes, which is all the next run takes back: a value the sheet already
  // had of the player's own is never recorded, so unpicking never takes it.
  const next: RulesetBuilderApplied = { increases: {}, scores: {}, skills: {}, saves: {}, fields: {}, rows: [] };

  // Scores: the method's base plus the increases, written when that total changes; else what the sheet
  // has, moved by the change in increases, as far as the score's bounds let it (and only that far is
  // taken back). Either way a score typed in the full form since is kept until the builder's own answer
  // for it changes.
  const abilityStep = definition.sheet.builder?.steps.find((step) => step.kind === "abilities");
  const base =
    abilityStep && rulesetBuilderStepVisible(definition, abilityStep, readingBuild)
      ? rulesetBuilderBaseScores(definition, state)
      : {};
  const abilities = { ...build.abilities };
  for (const ability of definition.sheet.abilities) {
    const id = ability.id;
    const before = previous.increases[id] ?? 0;
    const uncapped = want.increases[id] ?? 0;
    if (base[id] !== undefined) {
      const after = uncapped + cappedOn(id, base[id]! + uncapped);
      const total = clamp(base[id]! + after, ability.min, ability.max);
      next.scores[id] = total;
      next.increases[id] = total - base[id]!;
      if (previous.scores[id] !== total) abilities[id] = total;
      continue;
    }
    const current = typeof abilities[id] === "number" ? abilities[id]! : ability.default;
    const without = current - before;
    const after = uncapped + cappedOn(id, without + uncapped);
    const total = clamp(without + after, ability.min, ability.max);
    if (total - without !== 0) next.increases[id] = total - without;
    if (total !== current) abilities[id] = total;
  }

  // Training: a tier the builder gave is set when its answer changes, and taken back only while the
  // sheet still shows it; a tier the player set by hand is theirs.
  const untrained = definition.resolution.proficiencyTiers[0]!.id;
  const retrained = new Set(
    state.trainingBase
      ? rulesetBuilderTrainedSlots(definition, state, catalogs, readingBuild)
          .filter((slot) => slot.only === "trained")
          .flatMap((slot) => slot.chosen.map((id) => `${slot.what}/${id}`))
      : [],
  );
  const trained = (what: "skills" | "saves") => {
    const out = { ...build[what] };
    for (const [id, tier] of Object.entries(previous[what])) {
      if (want[what][id] === undefined && out[id] === tier) {
        if (previous.trainingBefore?.[what][id] !== undefined) out[id] = previous.trainingBefore[what][id]!;
        else delete out[id];
      }
    }
    for (const [id, tier] of Object.entries(want[what])) {
      const current = out[id];
      const before = previous.trainingBefore?.[what][id];
      const remember = (value: string) => {
        (next.trainingBefore ??= { skills: {}, saves: {} })[what][id] = value;
      };
      if (previous[what][id] === tier) {
        next[what][id] = tier;
        if (before !== undefined) remember(before);
        continue;
      }
      const retrain =
        previous[what][id] === undefined &&
        current !== tier &&
        current === state.trainingBase?.[what][id] &&
        retrained.has(`${what}/${id}`);
      if (
        current === undefined ||
        current === untrained ||
        retrain ||
        (previous[what][id] !== undefined && current === previous[what][id])
      ) {
        out[id] = tier;
        next[what][id] = tier;
        if (before !== undefined) remember(before);
        else if (retrain && current !== undefined) remember(current);
      }
    }
    return out;
  };
  const skills = trained("skills");
  const saves = trained("saves");

  // Fields: written when the builder's answer changes, cleared when it has none and the sheet still
  // shows the old one. A field the player filled in themselves (a level 5 typed before a class was
  // picked) is never written over: only one still blank, or one the builder already answers for.
  const blankFields = defaultRulesetSheetBuild(definition).fields;
  const fields = { ...build.fields };
  const typed = new Set(previous.typedFields ?? []);
  for (const [id, value] of Object.entries(previous.fields)) {
    if (want.fields[id] === undefined && (fields[id] === value || typed.has(id))) delete fields[id];
  }
  for (const [id, value] of Object.entries(want.fields)) {
    if (previous.fields[id] === value) {
      next.fields[id] = value;
      // Typed over and the answer unchanged: the player's value stands, and is still the builder's to take back.
      if (typed.has(id) && fields[id] !== value) (next.typedFields ??= []).push(id);
    }
    // Already the answer, and only because it is the sheet's blank: the builder's from now on.
    else if (fields[id] === value && value === blankFields[id]) next.fields[id] = value;
    else if (
      fields[id] !== value &&
      (previous.fields[id] !== undefined ||
        fields[id] === undefined ||
        fields[id] === "" ||
        fields[id] === blankFields[id])
    ) {
      fields[id] = value;
      next.fields[id] = value;
    }
  }

  // Rows: an entry's rows go when it is unpicked and come when it is picked, never twice. A row the
  // player had already added from the catalog is theirs.
  let lists: RulesetSheetBuild["lists"] = { ...build.lists };
  const gone = new Set(previous.rows.filter((ref) => !want.rows.includes(ref)));
  if (gone.size > 0) {
    lists = Object.fromEntries(
      Object.entries(lists).map(([listId, rows]) => [
        listId,
        Array.isArray(rows) ? rows.filter((row) => !gone.has(String(row?.[RULESET_CATALOG_ROW_KEY] ?? ""))) : rows,
      ]),
    );
  }
  const has = (ref: string) =>
    Object.values(lists).some(
      (rows) => Array.isArray(rows) && rows.some((row) => row?.[RULESET_CATALOG_ROW_KEY] === ref),
    );
  const entriesByRef = new Map<string, RulesetCatalogEntry>();
  const stampsByRef = new Map<string, Record<string, Scalar>>();
  for (const { step, entry } of rulesetBuilderGranting(definition, state, catalogs, readingBuild)) {
    entriesByRef.set(catalogRowRef(step.catalog, entry.id), entry);
    if (step.stamp) {
      stampsByRef.set(
        catalogRowRef(step.catalog, entry.id),
        rulesetBuilderStamp(definition, step, entry, state, catalogs, readingBuild),
      );
    }
  }
  for (const slot of rulesetBuilderEntrySlots(definition, state, catalogs, readingBuild)) {
    for (const id of slot.chosen) {
      const entry = (catalogs[slot.catalog] ?? []).find((each) => each.id === id);
      if (entry) entriesByRef.set(catalogRowRef(slot.catalog, id), entry);
    }
  }
  for (const { entry: giver } of rulesetBuilderGranting(definition, state, catalogs, readingBuild))
    for (const given of giver.grants?.entries?.add ?? [])
      for (const id of given.ids) {
        const entry = (catalogs[given.catalog] ?? []).find((each) => each.id === id);
        if (entry) entriesByRef.set(catalogRowRef(given.catalog, id), entry);
      }
  for (const ref of want.rows) {
    if (previous.rows.includes(ref)) {
      next.rows.push(ref);
      continue;
    }
    if (has(ref)) continue;
    const entry = entriesByRef.get(ref);
    if (!entry) continue;
    const catalogId = ref.slice(0, ref.indexOf("/"));
    let wrote = false;
    for (const { list, row } of rowsFromCatalogEntry(catalogId, entry)) {
      const spec = definition.sheet.lists.find((each) => each.id === list);
      const rows = Array.isArray(lists[list]) ? lists[list]! : [];
      // A full list takes no more; the pick still counts for everything else it grants, and its rows
      // are tried again on the next change.
      if (!spec || rows.length >= spec.maxItems) continue;
      lists = { ...lists, [list]: [...rows, { ...row, ...stampsByRef.get(ref) }] };
      wrote = true;
    }
    if (wrote) next.rows.push(ref);
  }

  // Marks (1.767): a row newly marked has its column ticked, and one unmarked has it cleared, as far as
  // the builder ticked it. A tick the player changed on the sheet since stays theirs until the mark does.
  const written = { ...build, abilities, skills, saves, fields, lists };
  const wanted = new Map<string, { list: string; column: string; ref: string }>();
  for (const step of definition.sheet.builder?.steps ?? [])
    if (step.kind === "mark")
      for (const ref of rulesetBuilderMarked(definition, step.id, state, written))
        wanted.set(`${step.list}:${step.column}:${ref}`, { list: step.list, column: step.column, ref });
  const tick = (key: string, value: boolean) => {
    const [list, column] = key.split(":") as [string, string];
    const ref = key.slice(list.length + column.length + 2);
    const rows = lists[list];
    if (!Array.isArray(rows)) return false;
    const at = rows.findIndex((row) => row?.[RULESET_CATALOG_ROW_KEY] === ref);
    if (at < 0 || rows[at]![column] === value) return false;
    lists = { ...lists, [list]: rows.map((row, index) => (index === at ? { ...row, [column]: value } : row)) };
    return true;
  };
  for (const key of previous.marks ?? []) {
    if (wanted.has(key)) (next.marks ??= []).push(key);
    else tick(key, false);
  }
  for (const key of wanted.keys()) if (!previous.marks?.includes(key) && tick(key, true)) (next.marks ??= []).push(key);

  return {
    build: { ...build, abilities, skills, saves, fields, lists },
    state: { ...state, applied: next },
  };
}

/** Fields shown at a step on the sheet as it stands (1.107). Hiding keeps their stored values. */
export function rulesetBuilderShownFields(
  definition: RulesetDefinition,
  step: StepOf<"fields">,
  build: RulesetSheetBuild,
): string[] {
  return step.fields.filter((id) => {
    const ref = step.shownWhen?.[id];
    return !ref || resolveRulesetValueRef(definition, build, ref) > 0;
  });
}

/** How many choices each step still waits on, by step id. A step never blocks the next: this is
 *  what its badge shows. */
/** The builder's creation rules (1.155) that do not hold on the sheet as it stands, in their order.
 *  A rule whose `when` reads 0 or less, or whose bound reads a value not yet set, is not checked. */
export function rulesetBuilderConstraintFailures(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
): RulesetBuilderConstraint[] {
  const rules = definition.sheet.builder?.constraints ?? [];
  if (!rules.length) return [];
  const evaluated = evaluateRulesetSheet(definition, build);
  const read = (ref: RulesetValueRef) => resolveRulesetValueRef(definition, build, ref, evaluated);
  const bound = (value: number | RulesetValueRef | undefined) =>
    value === undefined ? undefined : typeof value === "number" ? value : read(value);
  const rowsOf = (list: string) =>
    (Array.isArray(build.lists[list]) ? build.lists[list]! : []).filter(
      (row): row is Record<string, Scalar> => !!row && typeof row === "object",
    );
  const filled = (cell: unknown) => cell !== undefined && cell !== "";
  return rules.filter((rule) => {
    if (rule.when && !(read(rule.when) > 0)) return false;
    if (rule.approved !== undefined) return build.fields[rule.approved] !== true;
    if (rule.distinct) {
      const seen = rowsOf(rule.distinct.list)
        .map((row) => row[rule.distinct!.column])
        .filter(filled)
        .map((cell) => (typeof cell === "string" ? cell.trim().toLowerCase() : String(cell)));
      return new Set(seen).size !== seen.length;
    }
    let value: number;
    if (rule.rows) {
      const filter = rule.rows.filter;
      const kept = rowsOf(rule.rows.list).filter((row) => {
        if (!filter) return true;
        const cell = row[filter.column];
        if (filter.equals !== undefined && cell !== filter.equals) return false;
        if (filter.below !== undefined && !(typeof cell === "number" && cell < filter.below)) return false;
        if (filter.above !== undefined && !(typeof cell === "number" && cell > filter.above)) return false;
        return true;
      });
      value =
        rule.rows.sum === undefined
          ? kept.length
          : kept.reduce((sum, row) => {
              const cell = row[rule.rows!.sum!];
              return sum + (typeof cell === "number" && Number.isFinite(cell) ? cell : 0);
            }, 0);
    } else value = read(rule.value!);
    const min = bound(rule.min);
    const max = bound(rule.max);
    return (min !== undefined && value < min - 1e-9) || (max !== undefined && value > max + 1e-9);
  });
}

/** The rows of a list the player added in a `rows` step (1.154), with where each sits in the list.
 *  Rows a catalog pick wrote carry its mark and are left to the pick. */
export function rulesetBuilderOwnRows(
  build: RulesetSheetBuild,
  listId: string,
): { row: Record<string, Scalar>; index: number }[] {
  const rows = build.lists[listId];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row, index) =>
    row && row[RULESET_CATALOG_ROW_KEY] === undefined ? [{ row: row as Record<string, Scalar>, index }] : [],
  );
}

/** The most of the player's own rows a rows step lets them add: its `max`, never above the list's own. */
function rowsStepLimit(definition: RulesetDefinition, step: StepOf<"rows">): number {
  const listMax = definition.sheet.lists.find((list) => list.id === step.list)?.maxItems ?? 0;
  return Math.min(step.max ?? listMax, listMax);
}

/** How many of the player's own rows a rows step's `countFrom` asks for (Capability API 1.799): what
 *  it reads off the sheet, never above what the step lets the player add, 0 with none. 5e's hit point
 *  rolls read one per level after 1st (5e ship-readiness re-test 2026-10-24). */
export function rulesetBuilderRowsCountFrom(
  definition: RulesetDefinition,
  step: StepOf<"rows">,
  build: RulesetSheetBuild,
): number {
  if (!step.countFrom) return 0;
  const count = Math.floor(resolveRulesetValueRef(definition, build, step.countFrom));
  return Number.isFinite(count) ? Math.max(0, Math.min(count, rowsStepLimit(definition, step))) : 0;
}

/** The whole rows a rows step waits on before its badge clears: its `min`, or what `countFrom` asks
 *  for when that is more (1.799). */
export function rulesetBuilderRowsMin(
  definition: RulesetDefinition,
  step: StepOf<"rows">,
  build: RulesetSheetBuild,
): number {
  return Math.max(step.min ?? 0, rulesetBuilderRowsCountFrom(definition, step, build));
}

/** The row a rows step adds: the columns' own defaults, under the step's `defaults`. */
export function rulesetBuilderNewRow(definition: RulesetDefinition, step: StepOf<"rows">): Record<string, Scalar> {
  const list = definition.sheet.lists.find((each) => each.id === step.list);
  return {
    ...Object.fromEntries(
      (list?.columns ?? [])
        .filter((column) => column.default !== undefined)
        .map((column) => [column.id, column.default as Scalar]),
    ),
    ...step.defaults,
  };
}

/** A rows step as the builder starts it (1.799): new rows added, each as the step's own "add row"
 *  makes it, until the player's own rows reach what `countFrom` asks for, never past the step's or the
 *  list's maximum. It never takes a row away, and with nothing to add hands back the same sheet.
 *  `from` is the sheet the count is read off (the builder's applied sheet), `build` the one written. */
export function rulesetBuilderFillRows(
  definition: RulesetDefinition,
  step: StepOf<"rows">,
  build: RulesetSheetBuild,
  from: RulesetSheetBuild = build,
): RulesetSheetBuild {
  const list = definition.sheet.lists.find((each) => each.id === step.list);
  if (!list || !step.countFrom) return build;
  const rows = Array.isArray(build.lists[list.id]) ? build.lists[list.id]! : [];
  const adding = Math.min(
    rulesetBuilderRowsCountFrom(definition, step, from) - rulesetBuilderOwnRows(build, list.id).length,
    list.maxItems - rows.length,
  );
  if (adding <= 0) return build;
  const added = Array.from({ length: adding }, () => rulesetBuilderNewRow(definition, step));
  return { ...build, lists: { ...build.lists, [list.id]: [...rows, ...added] } };
}

export function rulesetBuilderRemaining(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): Record<string, number> {
  const remaining: Record<string, number> = {};
  const allocations = rulesetBuilderAllocations(definition, build, state, catalogs);
  const spending = rulesetBuilderSpending(definition, build, state, catalogs);
  const add = (stepId: string, count: number) => (remaining[stepId] = (remaining[stepId] ?? 0) + Math.max(0, count));
  for (const step of definition.sheet.builder?.steps ?? []) {
    add(step.id, 0);
    if (
      !rulesetBuilderStepVisible(definition, step, build) ||
      (step.requiredWhen && resolveRulesetValueRef(definition, build, step.requiredWhen) <= 0)
    )
      continue;
    if (step.kind === "catalog" && step.takesAll) {
      // Taken without asking (1.766): what waits is each offered group with nothing taken of it.
      const offered = rulesetBuilderOptions(definition, step, state, catalogs, build);
      const taken = groupsTaken(offered, state.picks?.[step.id] ?? [], step.id);
      const groups = new Set(offered.flatMap((entry) => (entry.exclusive ? [entry.exclusive] : [])));
      add(step.id, [...groups].filter((group) => !taken.has(group)).length);
    } else if (step.kind === "catalog") {
      // Never more than the step can offer: a race with no subraces leaves nothing to choose.
      const offered = rulesetBuilderOptions(definition, step, state, catalogs, build).length;
      const picks = rulesetBuilderPicks(definition, step.id, state, catalogs, build);
      const enhanced = step.quotas || step.distinctBy || step.quotaBelow || step.when || step.requiredWhen;
      const min = rulesetBuilderStepCount(definition, step, build).min;
      add(
        step.id,
        Math.max(
          (enhanced ? min : Math.min(min, offered)) - picks.length,
          enhanced ? (state.picks?.[step.id] ?? []).filter((id) => !picks.some((entry) => entry.id === id)).length : 0,
          ...(step.quotas ?? []).map(
            (quota) => quota.min - picks.filter((entry) => filterHas(entry, quota.filter, quota.value)).length,
          ),
        ),
      );
    } else if (step.kind === "spend") {
      const pool = spending.find((pool) => pool.id === step.pool);
      add(
        step.id,
        pool?.invalid || pool?.rows.some((row) => row.stepId === step.id && row.override !== undefined) ? 1 : 0,
      );
    } else if (step.kind === "rows") {
      // The player's own rows, never the ones a pick wrote. A row missing a required cell is one more
      // thing to do, so the step is done only when enough rows are whole and none is half filled.
      const rows = rulesetBuilderOwnRows(build, step.list);
      const missing = rows.filter(({ row }) =>
        (step.required ?? []).some((id) => row[id] === undefined || row[id] === ""),
      ).length;
      // countFrom (1.799) asks for that many whole rows as min does, the larger of the two: the rows
      // still to add, and each one there not yet whole, counted once (laptop 2026-10-25: four unrolled
      // hit-point rows read "8 choices left").
      add(step.id, rulesetBuilderRowsMin(definition, step, build) - rows.length);
      add(step.id, missing);
    } else if (step.kind === "roll") {
      if (!state.describing) add(step.id, step.rolls.filter((roll) => !state.rolls?.[step.id]?.[roll.id]).length);
    } else if (step.kind === "mark") {
      // Never more than there are rows to mark.
      const most = Math.min(
        rulesetBuilderMarkCount(definition, step, build),
        rulesetBuilderMarkRows(step, build).length,
      );
      add(step.id, Math.max(0, most - rulesetBuilderMarked(definition, step.id, state, build).length));
    } else if (step.kind === "initialize") {
      add(step.id, state.describing || state.initialized?.[step.id] ? 0 : 1);
    } else if (step.kind === "allocate") {
      for (const group of allocations.filter((group) => group.stepId === step.id)) add(step.id, group.missing);
    } else if (step.kind === "fields") {
      add(
        step.id,
        rulesetBuilderShownFields(definition, step, build).filter((id) => {
          if (step.optional?.includes(id)) return false;
          const value = build.fields[id];
          // A default that means "not chosen yet" (1.788) still waits: a dragon ancestor of "none".
          if (
            step.unansweredAtDefault?.includes(id) &&
            value === definition.sheet.fields.find((field) => field.id === id)?.default
          )
            return true;
          return value === undefined || value === "";
        }).length,
      );
      if (step.total) {
        const total = step.total.fields.reduce((sum, id) => {
          const value = build.fields[id];
          return sum + (typeof value === "number" ? value : 0);
        }, 0);
        if (total > step.total.max) add(step.id, 1);
      }
    } else if (step.kind === "abilities") {
      const method = rulesetBuilderMethod(definition, state);
      const ids = rulesetBuilderAbilityIds(definition, step);
      if (!method) add(step.id, 1);
      else if (method === "pointBuy") {
        const spent = rulesetPointBuySpent(step.methods.pointBuy!, rulesetBuilderBaseScores(definition, state), ids);
        add(step.id, spent === null || spent < step.methods.pointBuy!.budget ? 1 : 0);
      } else if (method !== "manual") {
        const base = rulesetBuilderBaseScores(definition, state);
        add(step.id, ids.filter((id) => base[id] === undefined).length);
      }
    }
  }
  // A priced step (1.159) whose pool is over or unworkable is one thing to repair.
  for (const step of definition.sheet.builder?.steps ?? [])
    if (
      (step.kind === "catalog" || step.kind === "rows") &&
      step.pool &&
      rulesetBuilderStepVisible(definition, step, build) &&
      spending.find((pool) => pool.id === step.pool)?.invalid
    )
      add(step.id, 1);
  for (const rule of rulesetBuilderConstraintFailures(definition, build)) if (rule.step in remaining) add(rule.step, 1);
  for (const slot of [
    ...rulesetBuilderAbilitySlots(definition, state, catalogs, build),
    ...rulesetBuilderTrainedSlots(definition, state, catalogs, build),
    ...rulesetBuilderEntrySlots(definition, state, catalogs, build),
  ]) {
    const repeats = "repeat" in slot && !!slot.repeat;
    const step = stepById(definition, slot.stepId)!;
    if (
      !rulesetBuilderStepVisible(definition, step, build) ||
      (step.requiredWhen && resolveRulesetValueRef(definition, build, step.requiredWhen) <= 0)
    )
      continue;
    add(
      slot.stepId,
      Math.max(
        (repeats || slot.unresolved ? slot.count : Math.min(slot.count, slot.from.length)) - slot.chosen.length,
        slot.missing ?? 0,
        rulesetBuilderInactiveChoices(slot).length,
      ),
    );
  }
  return remaining;
}

export interface RulesetBuilderSpendRow {
  stepId: string;
  offer: RulesetBuilderSpendOffer;
  base: number | null;
  total: number | null;
  purchases: RulesetBuilderPurchase[];
  repriced: RulesetBuilderPurchase[] | null;
  spent: number;
  preview: number | null;
  next: RulesetBuilderPurchase | null;
  /** A two-way offer's next step down (1.164): the last purchase taken back, or a new reduction. */
  reduce: RulesetBuilderPurchase | null;
  inactive: boolean;
  canBuy: boolean;
  canReduce: boolean;
  /** What the rating it trades out of stands at, on an exchange (1.164). */
  donor?: number | null;
  override?: number | string;
  /** The bounds in force, `minFrom` and `maxFrom` read off the sheet inside the offer's own (1.155). */
  min: number;
  max: number;
  /** The offer's `when` reads 0 or less, or a bound it reads is not set (1.155). */
  unavailable: boolean;
}

export interface RulesetBuilderSpending {
  id: string;
  budget: number | null;
  spent: number;
  credit: number;
  remaining: number | null;
  invalid: boolean;
  canReprice: boolean;
  rows: RulesetBuilderSpendRow[];
  /** Priced picks and rows paid out of the pool (1.159), in step order. */
  priced: RulesetBuilderPricedItem[];
}

/** A refund always uses the saved price; only a new purchase or explicit repair reads this curve. */
function spendPrice(cost: RulesetBuilderCost, from: number, to: number): number | null {
  if ("unpriced" in cost) return null;
  if ("flat" in cost) return (to - from) * cost.flat;
  if ("perRank" in cost) {
    if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
    return ((to * (to + 1) - from * (from + 1)) / 2) * cost.perRank;
  }
  const before = cost.table.find(([rating]) => rating === from)?.[1];
  const after = cost.table.find(([rating]) => rating === to)?.[1];
  return before === undefined || after === undefined ? null : after - before;
}

/** Whether a one-way offer lowers its rating: declared, or (before 1.164) read off its baseline. */
function spendLowers(offer: RulesetBuilderSpendOffer): boolean {
  if (offer.direction) return offer.direction === "decrease";
  return offer.baseline !== undefined && offer.effect !== "ownership";
}

function spendNext(
  offer: RulesetBuilderSpendOffer,
  cost: RulesetBuilderCost,
  from: number,
  way: "up" | "down" = spendLowers(offer) ? "down" : "up",
): RulesetBuilderPurchase | null {
  const down = way === "down";
  if (offer.exchange) {
    const to = from + offer.exchange.gain;
    return to > offer.max || to < offer.min ? null : { from, to, paid: 0 };
  }
  const allowed = offer.allowedRatings;
  // A rating below a floor read off the sheet (1.155) is bought up to the floor in one purchase, and
  // discrete ratings skip straight to the next one the offer allows, both at the curve's price.
  const to = allowed
    ? [...allowed].sort((a, b) => a - b).find((rating) => rating > from && rating >= offer.min && rating <= offer.max)
    : "table" in cost
      ? (down
          ? [...cost.table].reverse().find(([rating]) => rating < from)
          : cost.table.find(([rating]) => rating > from && rating >= offer.min))?.[0]
      : down
        ? from - 1
        : Math.max(from + 1, offer.min);
  if (to === undefined || to < offer.min || to > offer.max || from > offer.max || (down && from < offer.min))
    return null;
  const paid = spendPrice(cost, from, to);
  // Two ways, raising costs and lowering earns; one way, the sign is the offer's declared credit.
  const signed =
    offer.direction === "both" ? paid !== null && paid < 0 === down : paid !== null && paid < 0 === !!offer.credit;
  return paid === null || !Number.isFinite(paid) || paid === 0 || Math.abs(paid) > 100000 || !signed
    ? null
    : { from, to, paid };
}

/** Missing source values are not a zero-point budget or a default profession. */
function spendRefConfigured(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  ref: RulesetValueRef,
  depth = 0,
): boolean {
  if (depth > 64) return false;
  if (ref.field !== undefined)
    return typeof build.fields[ref.field] === "number" && Number.isFinite(build.fields[ref.field]);
  if (ref.abilityScore !== undefined) return Number.isFinite(build.abilities[ref.abilityScore]);
  if (ref.abilityMod !== undefined) return Number.isFinite(build.abilities[ref.abilityMod]);
  if (ref.abilityModFromField !== undefined) {
    const id = build.fields[ref.abilityModFromField];
    return typeof id === "string" && Number.isFinite(build.abilities[id]);
  }
  if (ref.skillMod !== undefined || ref.saveMod !== undefined) {
    const what = ref.skillMod !== undefined ? "skills" : "saves";
    const entry = definition.sheet[what].find((entry) => entry.id === (ref.skillMod ?? ref.saveMod));
    return (
      !!entry &&
      definition.sheet.abilities.every((ability) => Number.isFinite(build.abilities[ability.id])) &&
      (!entry.cap || spendRefConfigured(definition, build, entry.cap, depth + 1)) &&
      (!definition.resolution.proficiency ||
        spendRefConfigured(definition, build, definition.resolution.proficiency.bonus, depth + 1))
    );
  }
  if (ref.derived !== undefined) {
    const derived = definition.sheet.derived.find((entry) => entry.id === ref.derived);
    if (!derived) return false;
    if (derived.op === "enumTable") {
      const value = derived.from.field !== undefined ? build.fields[derived.from.field] : undefined;
      return typeof value === "string" && Object.hasOwn(derived.table, value);
    }
    if (derived.op === "wordsTable") {
      const value = build.fields[derived.from.field];
      return typeof value === "string" && Object.keys(derived.table).some((word) => namesPhrase(value, word));
    }
    const refs = derived.op === "stepTable" ? [derived.from] : derived.op === "scale" ? [derived.of] : derived.of;
    return refs.every((inner) => spendRefConfigured(definition, build, inner, depth + 1));
  }
  return true;
}

function withoutBuilderSpending(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
): RulesetSheetBuild {
  if (!state.applied?.spending) return build;
  const out = { ...build };
  for (const [key, owned] of Object.entries(state.applied.spending)) {
    const target = ratingTarget(definition, key);
    if (target) writeRating(out, target, owned.before);
  }
  return out;
}

function spendPlan(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  priced: Map<string, RulesetBuilderPricedItem[]> = new Map(),
) {
  const pools: RulesetBuilderSpending[] = [];
  const values = new Map<string, { target: RulesetBuilderRatingTarget; value: number | null }>();
  const valueOf = (target: RulesetBuilderRatingTarget) => {
    const key = rulesetBuilderRatingKey(target);
    if (!values.has(key)) values.set(key, { target, value: ratingNumber(definition, build, target) });
    return values.get(key)!;
  };
  // Plan every offer in step order, including across pools, so next-rank prices include prior dots.
  const rows: RulesetBuilderSpendRow[] = [];
  for (const step of definition.sheet.builder?.steps ?? []) {
    if (step.kind !== "spend") continue;
    for (const offer of step.offers) {
      const entry = valueOf(offer.target);
      // An owned level (1.164) climbs its own ladder; the sheet keeps the higher of the two.
      const owned = offer.effect === "ownership";
      const base = owned ? (offer.baseline ?? offer.min) : entry.value;
      const donor = offer.exchange ? valueOf(offer.exchange.from) : undefined;
      const purchases = state.spending?.[step.id]?.[offer.id] ?? [];
      const visible = rulesetBuilderStepVisible(definition, step, build);
      let configured = visible;
      let cost = offer.cost;
      for (const override of offer.overrides ?? []) {
        if (!spendRefConfigured(definition, build, override.when)) {
          configured = false;
          break;
        }
        if (resolveRulesetValueRef(definition, build, override.when) > 0) {
          cost = override.cost;
          break;
        }
      }
      if (offer.baseline !== undefined && !owned && base !== offer.baseline) configured = false;
      if (donor && donor.value === null) configured = false;
      // Eligibility and sheet-read bounds (1.155) read the sheet before purchases, like overrides.
      const read = (ref: RulesetValueRef | undefined) =>
        ref === undefined
          ? undefined
          : spendRefConfigured(definition, build, ref)
            ? resolveRulesetValueRef(definition, build, ref)
            : null;
      const when = read(offer.when);
      const low = read(offer.minFrom);
      const high = read(offer.maxFrom);
      const unavailable = (when !== undefined && (when === null || when <= 0)) || low === null || high === null;
      const bounded: RulesetBuilderSpendOffer = {
        ...offer,
        min: Math.max(offer.min, low ?? -Infinity),
        max: Math.min(offer.max, high ?? Infinity),
      };
      // An offer the character may not take keeps its saved purchases, inactive, and costs the pool
      // nothing until it is taken back; one never bought leaves the pool as it is.
      const eligible = !unavailable && bounded.min <= bounded.max;
      if ("table" in cost && !cost.table.some(([rating]) => rating === base)) configured = false;
      const field =
        "field" in offer.target
          ? definition.sheet.fields.find((field) => "field" in offer.target && field.id === offer.target.field)
          : undefined;
      const integer = field?.type !== "number" || field.integer;
      let total = base;
      let given = donor?.value ?? null;
      const twoWay = offer.direction === "both";
      const lowering = (purchases[0]?.to ?? 0) < (purchases[0]?.from ?? 0);
      const [donorLow, donorHigh] = offer.exchange
        ? rulesetBuilderRatingBounds(definition, offer.exchange.from)
        : [-Infinity, Infinity];
      const canGive = (value: number | null) =>
        !offer.exchange ||
        (value !== null &&
          value - offer.exchange.units >= Math.max(offer.exchange.floor, donorLow) &&
          value - offer.exchange.units <= donorHigh);
      let repriced: RulesetBuilderPurchase[] | null = configured && base !== null ? [] : null;
      for (const purchase of purchases) {
        // A two-way ledger runs one way only: a step back takes the last purchase off it.
        const way = twoWay ? (lowering ? "down" : "up") : undefined;
        const next = total === null || !eligible || !canGive(given) ? null : spendNext(bounded, cost, total, way);
        // Stored deltas may cover several dots; reconstruct their curve without inventing ratings.
        const delta = purchase.to - purchase.from;
        const to: number | null = total === null ? null : total + delta;
        const paid: number | null = total === null || to === null ? null : spendPrice(cost, total, to);
        const legal =
          next &&
          to !== null &&
          to >= bounded.min &&
          to <= bounded.max &&
          (!offer.allowedRatings || offer.allowedRatings.includes(to)) &&
          (!integer || Number.isInteger(to)) &&
          delta !== 0 &&
          (twoWay ? delta < 0 === lowering : delta < 0 === spendLowers(offer)) &&
          (!offer.exchange || delta === offer.exchange.gain) &&
          Number.isFinite(paid) &&
          paid !== null &&
          (offer.exchange ? paid === 0 : paid !== 0) &&
          Math.abs(paid) <= 100000 &&
          (offer.exchange || (twoWay ? paid < 0 === lowering : paid < 0 === !!offer.credit));
        if (!legal || !repriced) repriced = null;
        else repriced.push({ from: total!, to: to!, paid: paid! });
        total = to;
        if (offer.exchange && given !== null) given -= offer.exchange.units;
      }
      const spent = purchases.reduce((sum, purchase) => sum + purchase.paid, 0);
      const changed =
        repriced === null ||
        repriced.some((purchase, index) => {
          const old = purchases[index]!;
          return old.from !== purchase.from || old.to !== purchase.to || Math.abs(old.paid - purchase.paid) > 1e-8;
        });
      const row: RulesetBuilderSpendRow = {
        stepId: step.id,
        offer,
        base,
        total,
        purchases,
        repriced,
        spent,
        preview: repriced?.reduce((sum, purchase) => sum + purchase.paid, 0) ?? null,
        next: null,
        reduce: null,
        inactive: purchases.length > 0 && changed,
        canBuy: false,
        canReduce: false,
        ...(offer.exchange ? { donor: given } : {}),
        min: bounded.min,
        max: bounded.max,
        unavailable,
      };
      if (
        !configured ||
        base === null ||
        total === null ||
        total < offer.min ||
        total > offer.max ||
        (purchases.length > 0 && (!eligible || total < bounded.min || total > bounded.max))
      ) {
        row.inactive = true;
        row.repriced = null;
        row.preview = null;
      }
      const last = purchases.at(-1);
      const undo = (purchase: RulesetBuilderPurchase): RulesetBuilderPurchase => ({
        from: purchase.to,
        to: purchase.from,
        paid: -purchase.paid,
      });
      if (total !== null && configured && eligible) {
        if (twoWay && last && lowering) row.next = undo(last);
        else if (canGive(given)) row.next = spendNext(bounded, cost, total, twoWay ? "up" : undefined);
        if (twoWay) row.reduce = last && !lowering ? undo(last) : spendNext(bounded, cost, total, "down");
      }
      // An offer nothing was bought on has nothing to suspend: one not yet priceable (its price reads
      // a choice not made yet) leaves the pool as it is.
      if (!purchases.length) {
        row.inactive = false;
        row.repriced = [];
        row.preview = 0;
      }
      if (!owned) entry.value = total;
      else if (purchases.length && total !== null && entry.value !== null) entry.value = Math.max(entry.value, total);
      if (donor) donor.value = given;
      rows.push(row);
    }
  }
  for (const pool of definition.sheet.builder?.pools ?? []) {
    const own = rows.filter((row) =>
      definition.sheet.builder?.steps.some(
        (step) => step.id === row.stepId && step.kind === "spend" && step.pool === pool.id,
      ),
    );
    // The character's profile (1.160) brings its own budget; another profile's never lingers.
    const budgetRef = rulesetBuilderActiveProfile(definition, build)?.budgets?.[pool.id] ?? pool.budget;
    const number = spendRefConfigured(definition, build, budgetRef)
      ? resolveRulesetValueRef(definition, build, budgetRef)
      : NaN;
    const budget = Number.isFinite(number) && number >= 0 && number <= 100000 ? number : null;
    // Priced picks and rows (1.159) are paid first and are never sold by the pool going over.
    const fixed = priced.get(pool.id) ?? [];
    const fixedSpent = fixed.reduce((sum, item) => sum + (item.cost ?? 0), 0);
    const fixedCredit = fixed.reduce((sum, item) => sum + Math.max(0, -(item.cost ?? 0)), 0);
    const spent = own.reduce((sum, row) => sum + row.spent, 0) + fixedSpent;
    const creditOf = (row: RulesetBuilderSpendRow, preview: boolean) =>
      (preview ? (row.repriced ?? []) : row.purchases).reduce((sum, purchase) => sum + Math.max(0, -purchase.paid), 0);
    const credit = own.reduce((sum, row) => sum + creditOf(row, false), 0) + fixedCredit;
    // Whether the pool pays with one row's ledger changed to `instead` (a purchase added or taken back).
    const fits = (preview: boolean, change?: { row: RulesetBuilderSpendRow; instead: RulesetBuilderPurchase[] }) => {
      const ledger = (row: RulesetBuilderSpendRow) =>
        change?.row === row ? change.instead : preview ? (row.repriced ?? []) : row.purchases;
      const creditIn = (row: RulesetBuilderSpendRow) =>
        change?.row === row
          ? change.instead.reduce((sum, purchase) => sum + Math.max(0, -purchase.paid), 0)
          : creditOf(row, preview);
      const spentIn = (row: RulesetBuilderSpendRow) =>
        change?.row === row
          ? ledger(row).reduce((sum, purchase) => sum + purchase.paid, 0)
          : preview
            ? (row.preview ?? 0)
            : row.spent;
      const totalCredit = own.reduce((sum, row) => sum + creditIn(row), 0) + fixedCredit;
      const totalSpent = own.reduce((sum, row) => sum + spentIn(row), 0) + fixedSpent;
      return (
        budget !== null &&
        totalSpent <= budget + 1e-8 &&
        totalCredit <= (pool.creditLimit ?? 0) + 1e-8 &&
        (pool.caps ?? []).every(
          (cap) =>
            own.filter((row) => row.offer.tags?.includes(cap.filter)).reduce((sum, row) => sum + creditIn(row), 0) <=
            cap.maxCredit + 1e-8,
        )
      );
    };
    const invalid = own.some((row) => row.inactive) || fixed.some((item) => item.cost === null) || !fits(false);
    // Taking a bought step back always fits: it only returns what was paid. Taking a reduction back
    // pays its credit back, and must fit like any purchase.
    const canTake = (row: RulesetBuilderSpendRow, purchase: RulesetBuilderPurchase | null) => {
      if (!purchase) return false;
      const last = row.purchases.at(-1);
      const undo = !!last && purchase.from === last.to && purchase.to === last.from;
      if (undo && purchase.paid <= 0) return true;
      const instead = undo ? row.purchases.slice(0, -1) : [...row.purchases, purchase];
      return !invalid && row.purchases.length < 1000 && fits(false, { row, instead });
    };
    for (const row of own) {
      row.inactive ||= invalid && row.purchases.length > 0;
      row.canBuy = canTake(row, row.next);
      row.canReduce = row.offer.direction === "both" && canTake(row, row.reduce);
    }
    pools.push({
      id: pool.id,
      budget,
      spent,
      credit,
      remaining: budget === null ? null : budget - spent,
      invalid,
      canReprice: invalid && own.every((row) => row.repriced !== null) && fits(true),
      rows: own,
      priced: fixed,
    });
  }
  // Shared targets connect pools: an inactive earlier rank cannot price or fund a later one.
  let changed = true;
  while (changed) {
    changed = false;
    const inactiveTargets = new Set(
      rows.filter((row) => row.inactive).map((row) => rulesetBuilderRatingKey(row.offer.target)),
    );
    for (const pool of pools) {
      if (
        pool.rows.some((row) => inactiveTargets.has(rulesetBuilderRatingKey(row.offer.target)) && row.purchases.length)
      )
        pool.invalid = true;
      if (!pool.invalid) continue;
      for (const row of pool.rows) {
        row.canBuy = false;
        row.canReduce = false;
        if (!row.inactive && row.purchases.length) {
          row.inactive = true;
          changed = true;
        }
      }
    }
  }
  for (const entry of values.values()) entry.value = ratingNumber(definition, build, entry.target);
  for (const row of rows) {
    if (row.inactive || row.offer.effect === "ownership") continue;
    const entry = valueOf(row.offer.target);
    if (entry.value !== null)
      entry.value += row.purchases.reduce((sum, purchase) => sum + purchase.to - purchase.from, 0);
    // An exchange's points come out of the rating it trades from (1.164).
    const donor = row.offer.exchange ? valueOf(row.offer.exchange.from) : undefined;
    if (donor && donor.value !== null) donor.value -= row.purchases.length * row.offer.exchange!.units;
  }
  // An owned level shows only where it beats what the sheet already has (1.164).
  for (const row of rows) {
    const entry = valueOf(row.offer.target);
    if (!row.inactive && row.offer.effect === "ownership" && row.purchases.length && row.total !== null)
      entry.value = entry.value === null ? null : Math.max(entry.value, row.total);
  }
  // Traded points are never traded on (1.164): a rating an exchange raised gives nothing to another,
  // and one an exchange lowered is not raised by another. Classes that trade different scores may
  // each declare their own trade; only what was actually traded closes the other way.
  const tradedUp = new Set<string>();
  const tradedDown = new Set<string>();
  for (const row of rows)
    if (row.offer.exchange && !row.inactive && row.purchases.length) {
      tradedUp.add(rulesetBuilderRatingKey(row.offer.target));
      tradedDown.add(rulesetBuilderRatingKey(row.offer.exchange.from));
    }
  for (const row of rows) {
    const total = valueOf(row.offer.target).value;
    const [min, max] = rulesetBuilderRatingBounds(definition, row.offer.target);
    if (
      row.offer.exchange &&
      (tradedUp.has(rulesetBuilderRatingKey(row.offer.exchange.from)) ||
        tradedDown.has(rulesetBuilderRatingKey(row.offer.target)))
    )
      row.canBuy = false;
    const at = (purchase: RulesetBuilderPurchase | null) =>
      purchase && total !== null
        ? row.offer.effect === "ownership"
          ? purchase.to
          : total + purchase.to - purchase.from
        : null;
    const next = at(row.next);
    if (next === null || next < min || next > max) row.canBuy = false;
    const lower = at(row.reduce);
    if (lower === null || lower < min || lower > max) row.canReduce = false;
    if (row.offer.exchange) {
      const donor = valueOf(row.offer.exchange.from).value;
      const [low, high] = rulesetBuilderRatingBounds(definition, row.offer.exchange.from);
      row.donor = donor;
      const left = donor === null ? null : donor - row.offer.exchange.units;
      if (left === null || left < Math.max(low, row.offer.exchange.floor) || left > high) row.canBuy = false;
    }
  }
  return { pools, values };
}

export function applyRulesetBuilder(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): { build: RulesetSheetBuild; state: RulesetBuilderState } {
  // One planning pass for the whole of it: the same sheet is worked out again and again as the
  // answer settles, and is read by which object holds it rather than by what it is made of.
  return withRulesetPlanMemo(() => applyRulesetBuilderPass(definition, build, state, catalogs));
}

function applyRulesetBuilderPass(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): { build: RulesetSheetBuild; state: RulesetBuilderState } {
  if (!definition.sheet.builder?.pools && !state.applied?.spending)
    return applyRulesetBuilderWithoutSpending(definition, build, state, catalogs);
  const result = applyRulesetBuilderWithoutSpending(
    definition,
    withoutBuilderSpending(definition, build, state),
    state,
    catalogs,
  );
  const plan = spendPlan(definition, result.build, state, pricedItems(definition, result.build, state, catalogs));
  const out = { ...result.build };
  const spending: NonNullable<RulesetBuilderApplied["spending"]> = {};
  const previous = state.applied?.spending ?? {};
  for (const key of new Set([...Object.keys(previous), ...plan.values.keys()])) {
    const target = plan.values.get(key)?.target ?? ratingTarget(definition, key);
    if (!target) continue;
    const [what, id] = ratingLocation(target);
    const desired = plan.values.get(key)?.value ?? ratingNumber(definition, result.build, target);
    const current = ratingNumber(definition, build, target);
    const old = previous[key];
    const next = old && current !== null && desired !== null ? current + desired - old.desired : desired;
    const [min, max] = rulesetBuilderRatingBounds(definition, target);
    const field = "field" in target ? definition.sheet.fields.find((field) => field.id === target.field) : undefined;
    const integer = field?.type !== "number" || field.integer;
    const valid = next !== null && next >= min && next <= max && (!integer || Number.isInteger(next));
    if (state.describing || !valid || next === current) writeRating(out, target, build[what]?.[id]);
    else
      writeRating(out, target, what === "skills" || what === "saves" ? ratingTiers(definition, target)?.[next] : next);
    if (desired !== null && plan.values.has(key)) {
      const before = result.build[what]?.[id];
      // A blocked schema-unsafe write owns no new delta.
      spending[key] =
        !valid && old && !(next !== null && next < min)
          ? old
          : {
              ...(before !== undefined ? { before } : {}),
              desired: valid || state.describing || (next !== null && next < min) ? desired : current!,
            };
    }
  }
  return {
    build: state.describing ? build : out,
    state: { ...result.state, applied: { ...result.state.applied!, spending } },
  };
}

/** Shared pool totals, next prices and repair previews; reads never change a saved ledger. */
export function rulesetBuilderSpending(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
): RulesetBuilderSpending[] {
  if (!definition.sheet.builder?.pools) return [];
  const baseline = applyRulesetBuilderWithoutSpending(
    definition,
    withoutBuilderSpending(definition, build, state),
    state,
    catalogs,
  ).build;
  const plan = spendPlan(definition, baseline, state, pricedItems(definition, build, state, catalogs));
  for (const pool of plan.pools)
    for (const row of pool.rows) {
      const current = ratingNumber(definition, build, row.offer.target);
      const desired = plan.values.get(rulesetBuilderRatingKey(row.offer.target))?.value;
      if (current !== desired && state.applied) {
        const [what, id] = ratingLocation(row.offer.target);
        const value = build[what]?.[id];
        if (typeof value === "number" || typeof value === "string") row.override = value;
        row.canBuy = false;
      }
    }
  return plan.pools;
}

/** Guided operations validate against the shared pool. Refund removes exactly the last paid line. */
export function rulesetBuilderSpendAction(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  stepId: string,
  offerId: string,
  action: "buy" | "refund" | "reprice" | "reduce",
): RulesetBuilderState {
  const pools = rulesetBuilderSpending(definition, build, state, catalogs);
  const pool = pools.find((pool) => pool.rows.some((row) => row.stepId === stepId && row.offer.id === offerId));
  const row = pool?.rows.find((row) => row.stepId === stepId && row.offer.id === offerId);
  if (!row || !pool) return state;
  const spending = { ...state.spending };
  const put = (row: RulesetBuilderSpendRow, purchases: RulesetBuilderPurchase[]) => {
    spending[row.stepId] = { ...spending[row.stepId], [row.offer.id]: purchases };
  };
  // A step back over the last purchase takes it off the ledger, refunding exactly what it cost.
  const take = (purchase: RulesetBuilderPurchase) => {
    const last = row.purchases.at(-1);
    put(
      row,
      last && purchase.from === last.to && purchase.to === last.from
        ? row.purchases.slice(0, -1)
        : [...row.purchases, purchase],
    );
  };
  if (action === "buy") {
    if (!row.canBuy || !row.next) return state;
    take(row.next);
  } else if (action === "reduce") {
    if (!row.canReduce || !row.reduce) return state;
    take(row.reduce);
  } else if (action === "refund") {
    if (!row.purchases.length) return state;
    put(row, row.purchases.slice(0, -1));
  } else {
    if (!pool.canReprice) return state;
    for (const row of pool.rows) put(row, row.repriced!);
  }
  return { ...state, spending };
}

/** One starting value an initialize step writes (Capability API 1.158). */
export interface RulesetBuilderInitializeRow {
  field: string;
  label: string;
  /** What the sheet holds now. */
  now: Scalar | undefined;
  /** What setting the values now would write, or null when it cannot be worked out. */
  next: Scalar | null;
  /** What the step wrote when it was last confirmed. */
  written?: Scalar;
}

export interface RulesetBuilderInitializePreview {
  rows: RulesetBuilderInitializeRow[];
  done: boolean;
  /** Done, but what it would write now differs from what it wrote: setting again is a reviewed choice. */
  changed: boolean;
}

/** What an initialize step would write now, beside what it wrote before. Reading never writes. */
export function rulesetBuilderInitializePreview(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  stepId: string,
): RulesetBuilderInitializePreview | null {
  const step = stepById(definition, stepId);
  if (!step || step.kind !== "initialize") return null;
  const sheet = step.reads ? rulesetBuilderBuildBefore(definition, build, state, catalogs, step.reads.before) : build;
  const evaluated = evaluateRulesetSheet(definition, sheet);
  const spending = step.writes.some((write) => write.remaining !== undefined)
    ? rulesetBuilderSpending(definition, build, state, catalogs)
    : [];
  const written = state.initialized?.[stepId];
  const rows = step.writes.map((write): RulesetBuilderInitializeRow => {
    const field = definition.sheet.fields.find((entry) => entry.id === write.field);
    let next: Scalar | null;
    if (write.remaining !== undefined) next = spending.find((pool) => pool.id === write.remaining)?.remaining ?? null;
    else if (write.value !== null && typeof write.value === "object")
      next = resolveRulesetValueRef(definition, sheet, write.value, evaluated);
    else next = write.value ?? null;
    if (typeof next === "number" && field?.type === "number") {
      if (!Number.isFinite(next)) next = null;
      else {
        const held = Math.min(field.max, Math.max(field.min, next));
        next = field.integer ? Math.floor(held) : held;
      }
    }
    return {
      field: write.field,
      label: field?.label ?? write.field,
      now: build.fields[write.field] as Scalar | undefined,
      next,
      ...(written && Object.prototype.hasOwnProperty.call(written, write.field)
        ? { written: written[write.field] }
        : {}),
    };
  });
  return {
    rows,
    done: !!written,
    changed: !!written && rows.some((row) => row.next !== null && row.next !== row.written),
  };
}

/** Writes an initialize step's starting values once, on the player's word. Never in describe mode,
 *  and a value that cannot be worked out leaves its field as it is. */
export function rulesetBuilderInitialize(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  catalogs: RulesetCatalogEntriesById,
  stepId: string,
): { build: RulesetSheetBuild; state: RulesetBuilderState } {
  const preview = rulesetBuilderInitializePreview(definition, build, state, catalogs, stepId);
  if (!preview || state.describing) return { build, state };
  const fields = { ...build.fields };
  const written: Record<string, Scalar> = {};
  for (const row of preview.rows) {
    if (row.next === null) continue;
    fields[row.field] = row.next;
    written[row.field] = row.next;
  }
  return {
    build: { ...build, fields },
    state: { ...state, initialized: { ...state.initialized, [stepId]: written } },
  };
}

/** What one set of creation dice comes to (1.162): the highest `keep` faces, plus `add`, times
 *  `multiplier`. Faces that are not the dice's own count for nothing. */
export function rulesetCreationDiceTotal(dice: RulesetCreationDice, faces: readonly number[]): number | null {
  if (faces.length !== dice.count || faces.some((face) => !Number.isInteger(face) || face < 1 || face > dice.sides))
    return null;
  const kept = [...faces].sort((a, b) => b - a).slice(0, dice.keep ?? dice.count);
  return (kept.reduce((sum, face) => sum + face, 0) + (dice.add ?? 0)) * (dice.multiplier ?? 1);
}

/** The dice a creation roll throws, spelled the way a player reads them: "3d6 x 5", "(2d6+6) x 5". */
export function rulesetCreationDiceText(dice: RulesetCreationDice): string {
  const base = `${dice.count}d${dice.sides}${dice.keep !== undefined && dice.keep < dice.count ? `k${dice.keep}` : ""}`;
  const added = dice.add ? `${base}${dice.add > 0 ? "+" : ""}${dice.add}` : base;
  return dice.multiplier && dice.multiplier !== 1 ? `${dice.add ? `(${added})` : added} x ${dice.multiplier}` : added;
}

/** Scores rolled in order (1.162): every group's dice, one roll per score in the order the step lists
 *  them. Faces the dice could not have thrown leave that score unrolled. */
export function rulesetBuilderRollScoresInOrder(
  definition: RulesetDefinition,
  state: RulesetBuilderState,
  faces: Record<string, number[]>,
): RulesetBuilderState {
  const step = definition.sheet.builder?.steps.find((each): each is StepOf<"abilities"> => each.kind === "abilities");
  if (!step?.methods.rolls) return state;
  const rolledBy: NonNullable<RulesetBuilderState["rolledBy"]> = {};
  for (const group of step.methods.rolls)
    for (const id of group.abilities) {
      const thrown = faces[id];
      const total = thrown ? rulesetCreationDiceTotal(group.dice, thrown) : null;
      if (thrown && total !== null) rolledBy[id] = { faces: [...thrown], total };
    }
  return { ...state, method: "rolls", rolledBy };
}

/** Makes one roll of a roll step (1.162) and writes it to its field, keeping its dice. A roll already
 *  made stands unless the step lets the player retry; describing a character never rolls. */
export function rulesetBuilderRoll(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  state: RulesetBuilderState,
  stepId: string,
  rollId: string,
  /** One set of faces, or one per try where the roll keeps the best. */
  sets: number[][],
  /** The improvement's dice, thrown alongside, used only when the check beats the field. */
  gainFaces?: number[],
): { build: RulesetSheetBuild; state: RulesetBuilderState } {
  const step = stepById(definition, stepId);
  if (!step || step.kind !== "roll" || state.describing) return { build, state };
  const roll = step.rolls.find((each) => each.id === rollId);
  if (!roll || (state.rolls?.[stepId]?.[rollId] && !step.retry)) return { build, state };
  // The target: a number field, or an ability score (1.209) held to the ability's own bounds.
  const field = roll.field !== undefined ? definition.sheet.fields.find((each) => each.id === roll.field) : undefined;
  const ability =
    roll.ability !== undefined ? definition.sheet.abilities.find((each) => each.id === roll.ability) : undefined;
  const bounds =
    field && field.type === "number"
      ? { min: field.min, max: field.max, integer: !!field.integer }
      : ability && !ability.value
        ? { min: ability.min, max: ability.max, integer: true }
        : null;
  if (!bounds || sets.length !== (roll.gain ? 1 : (roll.best ?? 1))) return { build, state };
  const totals = sets.map((set) => rulesetCreationDiceTotal(roll.dice, set));
  if (totals.some((total) => total === null)) return { build, state };
  const total = Math.max(...(totals as number[]));
  const hold = (value: number) => {
    const held = Math.min(bounds.max, Math.max(bounds.min, value));
    return bounds.integer ? Math.floor(held) : held;
  };
  const stored = ability ? build.abilities[ability.id] : build.fields[roll.field!];
  const current = typeof stored === "number" ? stored : ability ? ability.default : 0;
  let written: number;
  let gained: number[] | undefined;
  if (roll.gain) {
    // Only a check above the target improves it; a check at or below it leaves it as it is.
    if (total > current) {
      const gain = gainFaces ? rulesetCreationDiceTotal(roll.gain, gainFaces) : null;
      if (gain === null) return { build, state };
      gained = [...gainFaces!];
      written = hold(current + gain);
    } else written = hold(current);
  } else {
    const floor =
      roll.floor === undefined
        ? -Infinity
        : typeof roll.floor === "number"
          ? roll.floor
          : resolveRulesetValueRef(definition, build, roll.floor);
    written = hold(Math.max(total, floor));
  }
  const record: RulesetBuilderRollRecord = {
    sets: sets.map((set) => [...set]),
    total,
    ...(gained ? { gained } : {}),
    written,
    ...(ability && roll.gain ? { added: written - current } : {}),
  };
  if (ability) {
    // An improvement is an increase the builder keeps adding (see `desired`), recorded as already
    // applied so the next run neither adds it twice nor takes it back. A score rolled outright is
    // written like one typed in: kept until the builder's own answer for that score changes.
    const added = record.added ?? 0;
    const applied = state.applied ?? { increases: {}, scores: {}, skills: {}, saves: {}, fields: {}, rows: [] };
    return {
      build: { ...build, abilities: { ...build.abilities, [ability.id]: written } },
      state: {
        ...state,
        ...(added
          ? {
              applied: {
                ...applied,
                increases: { ...applied.increases, [ability.id]: (applied.increases[ability.id] ?? 0) + added },
                ...(applied.scores[ability.id] !== undefined
                  ? { scores: { ...applied.scores, [ability.id]: written } }
                  : {}),
              },
            }
          : {}),
        rolls: { ...state.rolls, [stepId]: { ...state.rolls?.[stepId], [rollId]: record } },
      },
    };
  }
  return {
    build: { ...build, fields: { ...build.fields, [roll.field!]: written } },
    state: { ...state, rolls: { ...state.rolls, [stepId]: { ...state.rolls?.[stepId], [rollId]: record } } },
  };
}

/** Whether everything an entry would write is already on the sheet (Capability API 1.378): its rows
 *  are there by the entry's own mark (a cleric's domain spell, granted by a later step), or by name
 *  where something else wrote a row that is nothing but its name (a dwarf's Dwarvish, written by
 *  the race). A step offers
 *  such an entry as already known rather than as one more pick. An entry that writes no rows is
 *  never held. */
export function rulesetBuilderEntryHeld(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogId: string,
  entry: RulesetCatalogEntry,
): boolean {
  const rows = rowsFromCatalogEntry(catalogId, entry);
  if (!rows.length) return false;
  return rows.every(({ list, row }) => {
    const held = build.lists?.[list];
    if (!Array.isArray(held)) return false;
    const declared = definition.sheet.lists.find((one) => one.id === list);
    const nameColumn =
      definition.gm.sheetSummary.lists.find((one) => one.list === list)?.nameColumn ??
      declared?.columns.find((column) => column.type === "text")?.id;
    const name = nameColumn ? row[nameColumn] : undefined;
    // A name speaks for the entry only where the name is all its row writes: a row that also writes
    // damage or a range is held only by the entry's own mark, or those columns would go unwritten.
    const nameOnly = Object.keys(row).every((key) => key === nameColumn || key === RULESET_CATALOG_ROW_KEY);
    const wanted = nameOnly && typeof name === "string" ? name.trim().toLowerCase() : undefined;
    const mark = row[RULESET_CATALOG_ROW_KEY];
    return held.some((raw) => {
      if (!raw || typeof raw !== "object") return false;
      const other = raw as Record<string, unknown>;
      if (mark !== undefined && other[RULESET_CATALOG_ROW_KEY] === mark) return true;
      const otherName = nameColumn ? other[nameColumn] : undefined;
      return !!wanted && typeof otherName === "string" && otherName.trim().toLowerCase() === wanted;
    });
  });
}
