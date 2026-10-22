import { z } from "zod";
import { GAME_INVENTORY_MAX_NEW_STACKS, GAME_INVENTORY_MAX_QUANTITY } from "../utils/game-inventory-stacks.js";

// Game Mode rulesets. A ruleset is validated DATA: it parameterises one of a closed set of
// Engine-owned resolution kinds and declares a character sheet from a closed set of primitives.
// It carries no expression strings, is never evaluated, and brings no package code. A mechanic no
// kind expresses is an Engine change that adds a kind, never something a ruleset file can do.
//
// Nothing here is 5e-shaped on purpose. Ability ids, skill ids, the level field, the proficiency
// table, pools and rests are all named by the ruleset; the Engine never looks for "level", "dex"
// or "slots". The first-party 5e file is one instance of this format, not its definition.

/** Reserved filename a package ships its ruleset under, discovered by convention exactly like
 *  `gm-verbs.json`: declared in `contributions.assets.paths`, hash-pinned in `files[]`. */
export const RULESET_ASSET_PATH = "ruleset.json";

/** Byte ceiling checked against the manifest's declared `files[].bytes` BEFORE the asset is read. 512 KB
 *  since Capability API 1.340; a package whose ruleset is over the earlier ceiling declares 1.340. */
export const RULESET_MAX_BYTES = 512 * 1024;
/** The ruleset ceiling before Capability API 1.340, which an older Engine still holds a package to. */
export const RULESET_EARLIER_MAX_BYTES = 256 * 1024;

/** A stored character sheet (`{ v, build }`) is refused above this many serialized bytes. */
export const RULESET_SHEET_MAX_BYTES = 64 * 1024;

/** The id a game resolves to when nothing is pinned: today's behaviour, byte for byte. */
export const ENGINE_LEGACY_RULESET_ID = "engine-legacy";

/** Ids a ruleset file may not claim. `engine-legacy` is the no-pin behaviour and `traditional` is
 *  the combat handoff's built-in Engine adapter; neither is data. */
export const RESERVED_RULESET_IDS = Object.freeze([ENGINE_LEGACY_RULESET_ID, "traditional"] as const);

const RULESET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A pinned id is a bare official id, or a community id namespaced by its source
 *  (`<owner>/<id>` for a repository, `local/<id>` for a file) so nothing can shadow an official one. */
const RULESET_REF_ID_PATTERN = /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RULESET_NAMESPACE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** The namespace of a community ruleset imported from a file rather than from a repository. */
export const RULESET_LOCAL_NAMESPACE = "local";

/** The id the Engine knows a community ruleset by. The `ruleset.json` itself always carries the
 *  BARE id; the namespace is where the file came from (a repository owner, or `local`). Community
 *  ids therefore always contain a slash and bare ids never do, so nothing a user imports can take
 *  an official ruleset's id, and two authors' `v20` are two different rulesets. Throws rather than
 *  returning null: every caller here has already validated its parts, so a bad one is a bug. */
export function communityRulesetId(namespace: string, bareId: string): string {
  if (!RULESET_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(`"${namespace}" is not a usable ruleset namespace`);
  }
  if (bareId.length > 64 || !RULESET_ID_PATTERN.test(bareId)) {
    throw new Error(`"${bareId}" is not a ruleset id`);
  }
  // Reserved ids are the Engine's own behaviours, not data, inside a namespace exactly as outside.
  if ((RESERVED_RULESET_IDS as readonly string[]).includes(bareId)) {
    throw new Error(`"${bareId}" is an Engine-owned ruleset id`);
  }
  return `${namespace}/${bareId}`;
}

/** Whether an id names a community ruleset (imported) rather than an official packaged one. */
export function isCommunityRulesetId(id: string): boolean {
  return id.includes("/");
}

/** Where a community ruleset came from, as a pin may record it. Exported so the import path can
 *  refuse a url the pin could not carry: a pin that fails to parse takes the game's rules with it. */
export const rulesetSourceUrlSchema = z.string().url().max(300);

/** How many entries a client may send in a new game's `options` record. The pin itself is read
 *  tolerantly (an existing game must never become unreadable), so the bound belongs on the way in,
 *  at `/game/create`, and is generous: a ruleset offers at most a dozen layers. */
export const RULESET_REF_MAX_OPTIONS = 64;

/** The pin written once by game creation (`chat.metadata.gameRuleset`). Read tolerantly: this is
 *  persisted data, so a field a newer Engine added must not make the pin unreadable here. */
export const rulesetRefSchema = z
  .object({
    id: z.string().max(140).regex(RULESET_REF_ID_PATTERN),
    version: z.number().int().min(1),
    /** The capability package that supplied the definition, or null for a community file/repository. */
    packageId: z.string().max(128).nullable().default(null),
    /** Where a community ruleset came from, so a recipient without it can be told where to get it. */
    source: rulesetSourceUrlSchema.optional(),
    options: z.record(z.union([z.boolean(), z.number().finite(), z.string().max(200)])).default({}),
  })
  .passthrough();

export type RulesetRef = z.infer<typeof rulesetRefSchema>;

// ── Text that reaches the GM prompt ──

/** Every label and guidance string can end up inside the GM prompt, so they all follow the
 *  gm-verbs description hygiene: one line, no control characters, no square brackets (the shape of
 *  a GM tag), no macro braces. */
export function promptSafeText(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .superRefine((value, ctx) => {
      if (/[\r\n\u0085\u2028\u2029]/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text cannot contain line breaks" });
      } else if (/[\u0000-\u001F\u007F]/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text cannot contain control characters" });
      }
      if (/[[\]]/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text cannot contain square brackets" });
      }
      if (/\{\{|\}\}/.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text cannot contain macro braces" });
      }
    });
}

const SHEET_ID_MESSAGE = "An id is lowercase letters, digits and underscores, starting with a letter";
const SHEET_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const sheetId = z.string().max(40).regex(SHEET_ID_PATTERN, SHEET_ID_MESSAGE);
const label = promptSafeText(80);

// ── Value references: the closed vocabulary a derived value, pool maximum or bonus can read ──

const VALUE_REF_KEYS = [
  "const",
  "field",
  "derived",
  "abilityScore",
  "abilityMod",
  "abilityModFromField",
  "skillMod",
  "saveMod",
  "liveTrack",
  "livePool",
  "listSum",
  "itemStat",
] as const;

/** Which of a character's items an `itemStat` reads: the ones `worn` (on, and bound where they must
 *  be: an item that takes slots while equipped, one that binds while bound, one that does both while
 *  both; an item that does neither is never worn), the ones only `carried`, or `all` of them. */
export const RULESET_ITEM_STAT_FROM = Object.freeze(["worn", "carried", "all"] as const);

/** How an `itemStat` makes one number of them: the `sum` of each item's value times how many there
 *  are, the highest or lowest one value (`max`, `min`), or the `count` of items (only those that give
 *  the stat, when one is named). An item that does not give the stat is left out of the other three. */
export const RULESET_ITEM_STAT_PICKS = Object.freeze(["sum", "max", "min", "count"] as const);

/** Which number a `liveTrack` reference reads: where the track stands, how far it is from its
 *  floor, how far from its top, or on a wound track the penalty in force. */
export const RULESET_TRACK_READS = Object.freeze(["value", "filled", "remaining", "penalty"] as const);

/** How many fields a sheet may declare (Capability API 1.208), and how many before it. */
export const RULESET_FIELDS_MAX = 240;
export const RULESET_FIELDS_MAX_BEFORE_1203 = 160;

/** A list's column added up, or its rows counted (Capability API 1.205), over the rows `onlyWhen`
 *  marks and whose `where` cell equals its value. */
export interface RulesetListSum {
  list: string;
  column?: string;
  onlyWhen?: string;
  where?: { column: string; equals: number | string | boolean };
  count?: true;
}
const rulesetListSumSchema = z
  .object({
    list: sheetId,
    column: sheetId.optional(),
    onlyWhen: sheetId.optional(),
    where: z
      .object({ column: sheetId, equals: z.union([z.number().finite(), z.string().max(80), z.boolean()]) })
      .strict()
      .optional(),
    count: z.literal(true).optional(),
  })
  .strict();
/** Exactly one key. `abilityModFromField` names an enum field whose VALUE is an ability id (a
 *  caster's chosen spellcasting ability); any other value, such as "none", reads as 0. `liveTrack`
 *  and `livePool` read the character's live state, so nothing worked out without one (a maximum,
 *  the proficiency bonus, a catalog's scaling) may read them; `read` goes only beside `liveTrack`.
 *  `listSum` adds up one number column of a list's rows, only the rows a boolean column marks where
 *  `onlyWhen` names one, and only the rows whose `where` cell equals its value; `count` counts the
 *  rows instead (1.205). `itemStat` reads a stat over the items the character holds (see
 *  `RULESET_ITEM_STAT_FROM`); items change in play, so it is held to the same rule as a live read. */
export const rulesetValueRefSchema = z
  .object({
    const: z.number().finite().optional(),
    field: sheetId.optional(),
    derived: sheetId.optional(),
    abilityScore: sheetId.optional(),
    abilityMod: sheetId.optional(),
    abilityModFromField: sheetId.optional(),
    skillMod: sheetId.optional(),
    saveMod: sheetId.optional(),
    liveTrack: sheetId.optional(),
    read: z.enum(RULESET_TRACK_READS).optional(),
    livePool: sheetId.optional(),
    listSum: (rulesetListSumSchema as z.ZodType<RulesetListSum, z.ZodTypeDef, unknown>).optional(),
    itemStat: z
      .object({
        stat: sheetId.optional(),
        from: z.enum(RULESET_ITEM_STAT_FROM),
        pick: z.enum(RULESET_ITEM_STAT_PICKS),
        slot: sheetId.optional(),
        category: sheetId.optional(),
        tag: sheetId.optional(),
        default: z.number().finite().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((ref, ctx) => {
    const present = VALUE_REF_KEYS.filter((key) => ref[key] !== undefined);
    if (present.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A value reference names exactly one of: ${VALUE_REF_KEYS.join(", ")}`,
      });
    }
    if (ref.read !== undefined && ref.liveTrack === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["read"], message: "read goes only beside liveTrack" });
    }
    if (ref.itemStat && ref.itemStat.pick !== "count" && ref.itemStat.stat === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itemStat", "stat"],
        message: "An itemStat names the stat it reads, unless it only counts items",
      });
    }
  });

export type RulesetValueRef = z.infer<typeof rulesetValueRefSchema>;

/** `[[threshold, value], …]`, ascending: the value of the highest threshold at or below the input.
 *  An input below the first threshold reads as the first value. */
/** A step table is read at the highest threshold at or below its input, so its thresholds must run
 *  strictly up: a repeated or falling one would never be the one read. */
function ascendingThresholds(table: ReadonlyArray<readonly [number, number]>, ctx: z.RefinementCtx): void {
  for (let i = 1; i < table.length; i++) {
    if (table[i]![0] <= table[i - 1]![0]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [i, 0],
        message: "Step table thresholds must be strictly ascending",
      });
    }
  }
}

const stepTableSchema = z
  .array(z.tuple([z.number().finite(), z.number().finite()]))
  .min(1)
  .max(100)
  .superRefine(ascendingThresholds);

const roundingSchema = z.enum(["down", "up", "nearest"]);

/** How many conditions a sheet declares, a rest clears and a fight describes: 80 until Capability API
 *  1.188, which 5e's own list outgrew, and 160 until 1.269, which its monsters' traits outgrew. */
export const RULESET_CONDITIONS_MAX = 320;

const hideWhenValue = z.union([z.string().max(80), z.number().finite(), z.boolean()]);
const HIDE_WHEN_COMPARISONS = ["equals", "notEquals", "in"] as const;
/** Off the sheet while a field holds one value, holds anything but one value, or holds one of a
 *  few. Exactly one of the three, so a rule always says one thing. */
const hideWhenSchema = z
  .object({
    field: sheetId,
    equals: hideWhenValue.optional(),
    notEquals: hideWhenValue.optional(),
    in: z.array(hideWhenValue).min(1).max(24).optional(),
  })
  .strict()
  .superRefine((hide, ctx) => {
    if (HIDE_WHEN_COMPARISONS.filter((key) => hide[key] !== undefined).length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `hideWhen names exactly one of: ${HIDE_WHEN_COMPARISONS.join(", ")}`,
      });
    }
  });

export type RulesetHideWhen = z.infer<typeof hideWhenSchema>;

/** Every value a `hideWhen` compares against, whichever comparison it makes. */
export function rulesetHideWhenValues(hide: RulesetHideWhen): Array<string | number | boolean> {
  if (hide.in) return hide.in;
  const one = hide.equals ?? hide.notEquals;
  return one === undefined ? [] : [one];
}

// ── Resolution kinds ──

/** How an ability SCORE becomes a modifier. `identity` is for systems whose score is the modifier. */
const abilityModifierSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("floorHalfMinusTen") }).strict(),
  z.object({ op: z.literal("identity") }).strict(),
  z.object({ op: z.literal("stepTable"), table: stepTableSchema }).strict(),
]);

/** What the extreme faces of a single die do. `none` is pure arithmetic. */
const naturalPolicySchema = z.enum(["none", "both", "max-only", "min-only"]);

const proficiencyTierSchema = z
  .object({
    id: sheetId,
    label,
    /** Multiplies the proficiency bonus named by `resolution.proficiency.bonus`. */
    multiplier: z.number().min(0).max(10).default(0),
    round: roundingSchema.default("down"),
    /** A flat bonus on top, for systems whose training is a fixed number rather than a multiple. */
    flat: z.number().int().min(-50).max(50).default(0),
  })
  .strict();

/** How many automatic successes, or extra dice, one purchase may be worth. An Engine ceiling rather
 *  than an author's choice: past this the roll stops being a roll. */
const SPEND_EFFECT_MAX = 10;

/** Throw the dice at or below `upTo` again. `once` replaces each of them one time and lets the new
 *  face stand; `until` keeps going, under the Engine's own hard ceiling. One shape wherever a re-throw
 *  can come from: a charm, a purchase, or a standing rule the Game Master names. */
const checkRerollSchema = z
  .object({ upTo: z.number().int().min(1).max(999), mode: z.enum(["once", "until"]) })
  .strict();

/** How many purchases one check may make: a number, a value the character's sheet works out, or
 *  `"pool"`, the check's own dice before anything was added or taken. */
const spendPerCheckSchema = z.union([
  z.number().int().min(1).max(SPEND_EFFECT_MAX),
  rulesetValueRefSchema,
  z.literal("pool"),
]);

/** One thing a check may buy by spending a pool. `amount` is what ONE purchase costs; `perCheck` is
 *  how many purchases a single check may make, so the ceiling is `amount * perCheck` points. */
const resolutionSpendSchema = z
  .object({
    pool: sheetId,
    amount: z.number().int().min(1).max(100),
    /** Successes added after the dice are counted. */
    successes: z.number().int().min(1).max(SPEND_EFFECT_MAX).optional(),
    /** Dice added to the pool before it is thrown. */
    dice: z.number().int().min(1).max(SPEND_EFFECT_MAX).optional(),
    /** A re-throw of the low faces. Bought once however many purchases the check makes, because a
     *  die thrown again twice is still one re-throw. */
    reroll: checkRerollSchema.optional(),
    perCheck: spendPerCheckSchema,
  })
  .strict()
  .superRefine((spend, ctx) => {
    if (spend.successes === undefined && spend.dice === undefined && spend.reroll === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A spend buys successes, dice, a re-throw, or several" });
    }
  });

/** Something on the sheet that rides along on every check it applies to, the way a wound penalty
 *  does: armour that weighs on one ability, a curse on all of them. `abilities` limits it to checks
 *  rolled with one of those; without it, every check. */
const resolutionAdjustSchema = z
  .object({
    value: rulesetValueRefSchema,
    abilities: z.array(sheetId).min(1).max(12).optional(),
  })
  .strict();

/** One band a check can land in (Capability API 1.135), best first. `atLeast` is the lowest
 *  measure that lands here; the last band has none and catches everything below. `success` says
 *  whether landing here is a success, and `critical` marks the band as a critical one of its kind.
 *  A band `on` a critical is never reached by the measure: only that critical lands in it. */
const outcomeTierSchema = z
  .object({
    id: sheetId,
    label,
    atLeast: z.number().int().min(-1000).max(1000).optional(),
    on: z.enum(["critical-success", "critical-failure"]).optional(),
    success: z.boolean().default(false),
    critical: z.boolean().default(false),
    /** What the band means at the table, said to the Game Master beside the band. */
    text: promptSafeText(200).optional(),
  })
  .strict();

/** What a check's outcome is read from (1.135): `margin` is how far the result is past what the
 *  check needed (a summed total minus its difficulty, or net successes minus those needed), and
 *  `total` the result itself (a summed total, or net successes). `fraction` (1.139), on a roll at
 *  most a target only, reads each band's `atLeast` as a divisor: a roll at or under the target divided
 *  by it lands there (Call of Cthulhu's Extreme is a fifth, Hard a half, Regular the whole). */
export const RULESET_OUTCOME_MEASURES = Object.freeze(["margin", "total", "fraction"] as const);

/** Labelled bands a check lands in, in place of a bare success or failure. `naturals: "shift"`
 *  moves a single die's highest face one band better and its lowest one band worse. */
const outcomesSchema = z
  .object({
    by: z.enum(RULESET_OUTCOME_MEASURES).default("margin"),
    tiers: z.array(outcomeTierSchema).min(2).max(8),
    naturals: z.enum(["shift"]).optional(),
  })
  .strict()
  .superRefine((outcomes, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    // The bands the measure reads, in the order written; a band `on` a critical stands apart.
    const read = outcomes.tiers.flatMap((tier, index) => (tier.on ? [] : [{ tier, index }]));
    read.forEach(({ tier, index }, at) => {
      const last = at === read.length - 1;
      if (last && tier.atLeast !== undefined) {
        issue(["tiers", index, "atLeast"], "The last band catches everything below the others, so it has no atLeast");
      }
      if (!last && tier.atLeast === undefined) {
        issue(["tiers", index, "atLeast"], "Every band but the last needs atLeast");
      }
      const before = read[at - 1]?.tier.atLeast;
      if (!last && at > 0 && before !== undefined && tier.atLeast !== undefined && tier.atLeast >= before) {
        issue(["tiers", index, "atLeast"], "Bands go best first, so each atLeast is below the one before it");
      }
    });
    outcomes.tiers.forEach((tier, index) => {
      if (!tier.on) return;
      if (tier.atLeast !== undefined) {
        issue(
          ["tiers", index, "atLeast"],
          "A band on a critical is reached by the critical alone, so it has no atLeast",
        );
      }
      if (tier.success !== (tier.on === "critical-success")) {
        issue(
          ["tiers", index, "success"],
          `A band on a ${tier.on} is ${tier.on === "critical-success" ? "" : "not "}a success`,
        );
      }
      if (outcomes.tiers.filter((other) => other.on === tier.on).length > 1) {
        issue(["tiers", index, "on"], `Only one band may be on a ${tier.on}`);
      }
    });
    if (read.length < 2) issue(["tiers"], "At least two bands are read from the measure");
    if (new Set(outcomes.tiers.map((tier) => tier.id)).size !== outcomes.tiers.length) {
      issue(["tiers"], "Two bands share an id");
    }
    if (!read.some(({ tier }) => tier.success)) issue(["tiers"], "No band is a success, so no check could succeed");
    if (read.every(({ tier }) => tier.success)) issue(["tiers"], "Every band is a success, so no check could fail");
  });

/** Checks that roll their own way (1.140): the skills, saves and abilities named roll with the
 *  resolution's keys that `set` replaces (`null` takes one away), where `when` reads anything but 0
 *  on the roller's sheet or always without it. An old-school game's d100 thief skills and X-in-6
 *  doors, or exwod's 1s that do not cancel on a favored ability. The kind and the sheet math stay
 *  the base resolution's. */
const resolutionOverrideSchema = z
  .object({
    id: sheetId,
    label,
    /** What it means at the table, said to the Game Master. */
    text: promptSafeText(200).optional(),
    skills: z.array(sheetId).min(1).max(60).optional(),
    saves: z.array(sheetId).min(1).max(60).optional(),
    abilities: z.array(sheetId).min(1).max(12).optional(),
    when: rulesetValueRefSchema.optional(),
    set: z.record(z.unknown()),
  })
  .strict();
export type RulesetResolutionOverride = z.infer<typeof resolutionOverrideSchema>;

/** The resolution keys an override may not replace: the kind, the sheet math every check shares,
 *  the ladder the Game Master names steps from, and the overrides themselves. */
export const RULESET_OVERRIDE_LOCKED_KEYS = Object.freeze([
  "kind",
  "abilityModifier",
  "proficiency",
  "proficiencyTiers",
  "penaltyFrom",
  "spend",
  "adjust",
  "difficultyLadder",
  "overrides",
  "symbols",
] as const);

/** The sheet math every resolution kind shares: how a score becomes a modifier, and what training
 *  is worth. Declared once and spread into each kind, so two kinds can never grow different rules
 *  for the same number and the cross-checks below run for all of them. What the resulting number
 *  MEANS is the kind's business: `dice-sum` adds it to the dice, `dice-pool` throws that many. */
const sheetMathShape = {
  abilityModifier: abilityModifierSchema,
  /** Where the proficiency bonus comes from. Omit it for a system with no such number; its tiers
   *  then use `flat` only. */
  proficiency: z.object({ bonus: rulesetValueRefSchema }).strict().optional(),
  /** The first tier is the untrained default for a skill or save the sheet does not mention. */
  proficiencyTiers: z.array(proficiencyTierSchema).min(1).max(12),
  /** The wound track whose penalty applies to this ruleset's rolls, named rather than assumed. A
   *  ruleset that leaves it out rolls exactly as it did before wound tracks existed. What the
   *  penalty DOES is the kind's business, the same way the sheet's own number is: `dice-sum` adds
   *  it to the roll, `dice-pool` takes that many dice off the pool and never below `pool.min`. */
  penaltyFrom: sheetId.optional(),
  /** What a player may BUY on a check, as a standing rule of the system rather than as something
   *  a character went and acquired: "spend a point of will for an automatic success". It has no
   *  catalog entry to hang on, so it lives beside the rest of the sheet math. `perCheck` is what
   *  stops a full pool buying an unlosable roll. Up to four, one per pool. */
  spend: z.array(resolutionSpendSchema).max(4).optional(),
  /** What the sheet itself adds to or takes off a check, with no word from the Game Master. Applied
   *  where the wound penalty is: dice on a pool, a flat number on a sum. */
  adjust: z.array(resolutionAdjustSchema).max(8).optional(),
  /** Labelled bands a check lands in (1.135), read from its margin or its total. */
  outcomes: outcomesSchema.optional(),
  /** Checks that roll their own way (1.140). */
  overrides: z.array(resolutionOverrideSchema).min(1).max(12).optional(),
};

/** One rung of a summed ladder. Hoisted out of the kind because a layer may swap the whole ladder
 *  for another one, and both places must mean exactly the same shape. */
const diceSumLadderStepSchema = z.object({ label, dc: z.number().int().min(-100).max(1000) }).strict();
const diceSumLadderSchema = z.array(diceSumLadderStepSchema).min(1).max(12);

/** Roll dice, add the sheet's modifiers, meet or beat a difficulty. The first resolution kind.
 *  The dice are a parameter so a 2d6+stat system does not need its own kind. */
const diceSumResolutionSchema = z
  .object({
    kind: z.literal("dice-sum"),
    dice: z
      .object({
        count: z.number().int().min(1).max(10),
        sides: z.number().int().min(2).max(1000),
        /** What each face is worth, lowest face first, where it is not its own number (1.136): Fate's
         *  dice are three faces worth -1, 0 and +1. One value per face. */
        faces: z.array(z.number().int().min(-100).max(1000)).min(2).max(20).optional(),
      })
      .strict()
      .default({ count: 1, sides: 20 }),
    ...sheetMathShape,
    /** Open-ended (1.136): a single die showing `high` or more is rolled again and added, chained;
     *  one showing `low` or less is rolled again and taken away, and that roll chains on `high` too. */
    openEnded: z
      .object({
        high: z.number().int().min(2).max(1000).optional(),
        low: z.number().int().min(1).max(999).optional(),
      })
      .strict()
      .optional(),
    /** Faces of a single die the record marks as rolled unmodified (1.136), before anything is added
     *  or rolled again: Rolemaster's 66 and 100. */
    unmodified: z.array(z.number().int().min(1).max(1000)).min(1).max(6).optional(),
    /** Whether the GM may ask for advantage or disadvantage (roll the dice twice, keep one). */
    advantage: z.boolean().default(false),
    naturals: z
      .object({ check: naturalPolicySchema.default("none"), save: naturalPolicySchema.default("none") })
      .strict()
      .default({}),
    difficultyLadder: diceSumLadderSchema,
  })
  .strict();

/** The largest pool a ruleset may declare, whatever it asks for, and the ceiling on the dice an
 *  explosion may add on top of one. So one throw can reach twice `pool.max`: the pool itself, then
 *  as many again exploded. An Engine ceiling rather than an author's choice: the roll runs inside a
 *  turn. */
export const RULESET_POOL_MAX_DICE = 100;

/** How many faces a pool die may have. A pool counts faces one by one, so a percentile die here
 *  would be a roll-under system wearing the wrong kind. */
const POOL_DIE_MAX_SIDES = 100;

const poolFace = z.number().int().min(2).max(POOL_DIE_MAX_SIDES);

/** A face rule the Game Master may move for one check. `from` is the face it fires on when nobody
 *  asks, and `min` is the lowest face a check may move it down to; with `min` and no `from` it fires
 *  only when a check asks for it. At least one of the two, or the rule says nothing. */
const poolFaceRuleSchema = z
  .object({ from: poolFace.optional(), min: poolFace.optional() })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.from === undefined && rule.min === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Give from, min or both" });
    }
  });

/** How a botch is read. `noSuccesses` is no die succeeding while a low face showed; `halfOrMore` is
 *  low faces on at least half the dice first thrown, whatever else they did, and it is a critical
 *  failure only when no die succeeded either. */
export const RULESET_BOTCH_RULES = Object.freeze(["noSuccesses", "halfOrMore"] as const);

/** One rung of a pool ladder, hoisted for the same reason as the summed one. `successes` is how
 *  many the check needs; a step names a `target` only where the ruleset lets the target move. */
const dicePoolLadderStepSchema = z
  .object({ label, successes: z.number().int().min(1).max(RULESET_POOL_MAX_DICE), target: poolFace.optional() })
  .strict();
const dicePoolLadderSchema = z.array(dicePoolLadderStepSchema).min(1).max(12);

/** Throw a handful of dice and count the ones that reach a target number. The second resolution
 *  kind, and the same sheet: what `dice-sum` adds to the roll is, here, the NUMBER OF DICE. So a
 *  system whose ratings are the pool needs no new sheet vocabulary and no new editor. */
const dicePoolResolutionSchema = z
  .object({
    kind: z.literal("dice-pool"),
    die: z.object({ sides: poolFace }).strict().default({ sides: 10 }),
    ...sheetMathShape,
    /** The sheet's number is clamped into this. A `min` of 0 lets an empty pool fail with no roll. */
    pool: z
      .object({
        min: z.number().int().min(0).max(RULESET_POOL_MAX_DICE),
        max: z.number().int().min(1).max(RULESET_POOL_MAX_DICE),
        /** A raw ability check may name a second ability with `with=`, and the two are added: two
         *  abilities rolled together. Off, `with=` means nothing on an ability check. Only this kind
         *  has a pool to add them into, so a summed ruleset cannot declare it. */
        abilityPlusAbility: z.boolean().optional(),
      })
      .strict()
      .default({ min: 1, max: 40 }),
    /** The per-die success threshold. `min` below `max` lets the GM set it per check. `from` (1.137)
     *  reads it off the roller's sheet instead, held to `min`..`max`. */
    target: z
      .object({ default: poolFace, min: poolFace, max: poolFace, from: rulesetValueRefSchema.optional() })
      .strict(),
    /** Stances (1.137): checks on these skills count dice BELOW the target, or ABOVE it, rather than
     *  at or above it. Lasers & Feelings' Lasers and Feelings. */
    stances: z
      .array(
        z
          .object({ id: sheetId, label, count: z.enum(["below", "above"]), skills: z.array(sheetId).min(1).max(40) })
          .strict(),
      )
      .min(1)
      .max(6)
      .optional(),
    /** A die showing exactly the target (1.137): it counts as a success when `counts`, and the record
     *  and the Game Master name it by `label` (Lasers & Feelings' LASER FEELINGS). */
    exact: z
      .object({ counts: z.boolean().default(true), label: promptSafeText(40), text: promptSafeText(200).optional() })
      .strict()
      .optional(),
    /** Optional: a face at or above `from` counts twice. With `min`, a check may move it down that far. */
    double: poolFaceRuleSchema.optional(),
    /** Optional: a face at or above `from` rolls one more die, chained, up to the Engine's ceiling.
     *  With `min`, a check may move it down that far. */
    explode: poolFaceRuleSchema.optional(),
    /** Optional: a face at or below this takes one success away, never below none. */
    cancel: z
      .object({
        upTo: z
          .number()
          .int()
          .min(1)
          .max(POOL_DIE_MAX_SIDES - 1),
      })
      .strict()
      .optional(),
    /** Optional: a face at or below `upTo` going wrong, read by `rule` (no die succeeding, the default,
     *  or low faces on half the dice or more). */
    botch: z
      .object({
        upTo: z
          .number()
          .int()
          .min(1)
          .max(POOL_DIE_MAX_SIDES - 1),
        rule: z.enum(RULESET_BOTCH_RULES).default("noSuccesses"),
      })
      .strict()
      .optional(),
    /** Optional: this many net successes or more is a critical success. */
    exceptional: z
      .object({ successes: z.number().int().min(1).max(RULESET_POOL_MAX_DICE) })
      .strict()
      .optional(),
    /** Optional: re-throws of the low faces the system grants without anybody paying for them, each
     *  named so the Game Master can ask for one on a check with `reroll=`. */
    reroll: z
      .array(checkRerollSchema.extend({ id: sheetId }))
      .min(1)
      .max(6)
      .optional(),
    /** Optional: lets the GM add or take dice for one check (a stunt, a wound, bad light). */
    situationalDice: z
      .object({ min: z.number().int().min(-20).max(0), max: z.number().int().min(0).max(20) })
      .strict()
      .optional(),
    difficultyLadder: dicePoolLadderSchema,
  })
  .strict();

/** The most dice one `dice-highest` check throws from the sheet. Only the highest few are read, so a
 *  larger handful would change nothing but the odds of a critical. */
export const RULESET_HIGHEST_MAX_DICE = 20;

/** Throw a handful of dice and read the highest one (1.138): Blades in the Dark's 6 / 4-5 / 1-3 and
 *  Trophy Dark's light and dark dice. The sheet's number is how many dice, as on a pool; the check
 *  needs the kept die (or the sum of the `keep` highest) to reach its difficulty. */
const diceHighestResolutionSchema = z
  .object({
    kind: z.literal("dice-highest"),
    die: z.object({ sides: poolFace }).strict().default({ sides: 6 }),
    ...sheetMathShape,
    /** The sheet's number is clamped into this. A `min` of 0 lets a character with no rating roll. */
    pool: z
      .object({
        min: z.number().int().min(0).max(RULESET_HIGHEST_MAX_DICE),
        max: z.number().int().min(1).max(RULESET_HIGHEST_MAX_DICE),
      })
      .strict()
      .default({ min: 0, max: 10 }),
    /** How many of the highest dice are added up. One is Blades; two is Trophy's fights. */
    keep: z.number().int().min(1).max(3).default(1),
    /** No dice at all: throw two and keep the lowest (Blades' zero rating), or fail without a roll. */
    zeroDice: z.enum(["lowest-of-two", "fail"]).default("lowest-of-two"),
    /** Several dice on the top face (or on `face` and above) is a critical success. Blades' two sixes. */
    critical: z
      .object({ count: z.number().int().min(2).max(10), face: poolFace.optional() })
      .strict()
      .optional(),
    /** Dark dice (Trophy Dark): the Game Master adds up to `max` with `dark=`. They normally count toward
     *  the outcome; the record flags a dark die that strictly beats every light die. */
    dark: z
      .object({
        label: promptSafeText(40),
        max: z.number().int().min(1).max(10),
        text: promptSafeText(200).optional(),
        /** Read only light dice for the outcome (1.149); absent means all dice. */
        outcome: z.enum(["all", "light"]).optional(),
      })
      .strict()
      .optional(),
    situationalDice: z
      .object({ min: z.number().int().min(-20).max(0), max: z.number().int().min(0).max(20) })
      .strict()
      .optional(),
    /** `dc` is what the kept dice must reach. */
    difficultyLadder: diceSumLadderSchema,
  })
  .strict();

/** A critical rule of a `roll-against` ruleset (1.139): the dice showing `from` to `to`, or landing
 *  `pastTarget` or more beyond the target on the failing side, and only `whenTarget` holds. */
const againstCriticalSchema = z
  .object({
    from: z.number().int().min(1).max(10000).optional(),
    to: z.number().int().min(1).max(10000).optional(),
    pastTarget: z.number().int().min(1).max(1000).optional(),
    whenTarget: z
      .object({
        atLeast: z.number().int().min(-1000).max(10000).optional(),
        below: z.number().int().min(-1000).max(10000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** One rung of a roll-against ladder (1.139): `dc` moves the target, and `divide` divides the
 *  sheet's number first (Call of Cthulhu's Hard is half, Extreme a fifth). */
const rollAgainstLadderStepSchema = z
  .object({ label, dc: z.number().int().min(-1000).max(1000), divide: z.number().int().min(2).max(10).optional() })
  .strict();
const rollAgainstLadderSchema = z.array(rollAgainstLadderStepSchema).min(1).max(12);

/** Roll the dice against the sheet's number (1.139): at most it (Call of Cthulhu, GURPS, a thief's
 *  percentages) or at least it (an old-school saving throw). The sheet's number is the target. */
const rollAgainstResolutionSchema = z
  .object({
    kind: z.literal("roll-against"),
    dice: z
      .object({ count: z.number().int().min(1).max(10), sides: z.number().int().min(2).max(1000) })
      .strict()
      .default({ count: 1, sides: 100 }),
    ...sheetMathShape,
    against: z.enum(["at-most", "at-least"]).default("at-most"),
    criticalSuccess: z.array(againstCriticalSchema).min(1).max(6).optional(),
    criticalFailure: z.array(againstCriticalSchema).min(1).max(6).optional(),
    /** Bonus and penalty tens dice on a single d100 (Call of Cthulhu): `bonus="+N"` throws N more tens
     *  dice and keeps the best, `bonus="-N"` the worst. */
    tens: z
      .object({ max: z.number().int().min(1).max(3) })
      .strict()
      .optional(),
    difficultyLadder: rollAgainstLadderSchema,
  })
  .strict();

/** The most character or difficulty dice a symbol pool throws (1.141). */
export const RULESET_SYMBOL_POOL_MAX_DICE = 12;

/** Dice whose faces carry symbols (1.141): the sheet builds the character's dice, difficulty
 *  adds opposing dice, and pairs cancel before the remaining symbols decide the check. */
const symbolPoolResolutionSchema = z
  .object({
    kind: z.literal("symbol-pool"),
    /** Allow upgradeOwn= to upgrade character dice beyond the sheet's upgrades (1.150). */
    allowOwnUpgrade: z.boolean().optional(),
    ...sheetMathShape,
    symbols: z
      .array(
        z
          .object({
            id: sheetId,
            label,
            cancels: sheetId.optional(),
            /** Also counted once, before cancellation; counts chains are refused. */
            counts: sheetId.optional(),
            text: promptSafeText(200).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(10),
    dice: z
      .array(
        z
          .object({
            id: sheetId,
            label,
            faces: z.array(z.array(sheetId).max(3)).min(2).max(20),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    success: z.object({ symbol: sheetId, needed: z.number().int().min(1).max(10).default(1) }).strict(),
    pool: z
      .object({
        die: sheetId,
        upgrade: sheetId.optional(),
        build: z.enum(["larger-upgraded", "sum"]).default("larger-upgraded"),
        max: z.number().int().min(1).max(RULESET_SYMBOL_POOL_MAX_DICE).default(6),
      })
      .strict(),
    difficulty: z
      .object({
        die: sheetId,
        upgrade: sheetId.optional(),
        max: z.number().int().min(1).max(RULESET_SYMBOL_POOL_MAX_DICE).default(5),
      })
      .strict(),
    /** Positive bonus adds boost dice; negative bonus adds setback dice. */
    boost: z
      .object({ die: sheetId, max: z.number().int().min(1).max(6).default(3) })
      .strict()
      .optional(),
    setback: z
      .object({ die: sheetId, max: z.number().int().min(1).max(6).default(3) })
      .strict()
      .optional(),
    criticalSuccess: sheetId.optional(),
    criticalFailure: sheetId.optional(),
    difficultyLadder: diceSumLadderSchema,
  })
  .strict();

/** A ladder in either kind's shape. A layer declares one of these and the cross-checks hold it to
 *  the base ruleset's own kind, so the two can never mean different things by "difficulty". */
export const rulesetDifficultyLadderSchema = z.union([
  diceSumLadderSchema,
  dicePoolLadderSchema,
  rollAgainstLadderSchema,
]);
export type RulesetDiceSumLadderStep = z.infer<typeof diceSumLadderStepSchema>;
export type RulesetDicePoolLadderStep = z.infer<typeof dicePoolLadderStepSchema>;
export type RulesetRollAgainstLadderStep = z.infer<typeof rollAgainstLadderStepSchema>;
export type RulesetDifficultyLadderStep =
  RulesetDiceSumLadderStep | RulesetDicePoolLadderStep | RulesetRollAgainstLadderStep;
export type RulesetDifficultyLadder = z.infer<typeof rulesetDifficultyLadderSchema>;

/** Closed registry of resolution kinds. Adding a kind is an Engine PR with regressions. */
const resolutionKindsSchema = z.discriminatedUnion("kind", [
  diceSumResolutionSchema,
  dicePoolResolutionSchema,
  diceHighestResolutionSchema,
  rollAgainstResolutionSchema,
  symbolPoolResolutionSchema,
]);
/** Named so the definition's own type refers to it rather than spelling all three kinds out again,
 *  which would pass what the compiler will write into a declaration file. */
export type RulesetResolutionDeclaration = z.infer<typeof resolutionKindsSchema>;
export const rulesetResolutionSchema: z.ZodType<RulesetResolutionDeclaration, z.ZodTypeDef, unknown> =
  resolutionKindsSchema;

/** A resolution with an override's keys laid over it (1.140), read by the resolution's own schema:
 *  the result, or the issues that schema found. A `null` in `set` takes the key away. */
export function rulesetOverriddenResolution(
  resolution: RulesetResolutionDeclaration,
  set: Record<string, unknown>,
): { ok: true; resolution: RulesetResolutionDeclaration } | { ok: false; issues: z.ZodIssue[] } {
  const merged: Record<string, unknown> = { ...resolution };
  delete merged.overrides;
  for (const [key, value] of Object.entries(set)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  const parsed = resolutionKindsSchema.safeParse(merged);
  return parsed.success ? { ok: true, resolution: parsed.data } : { ok: false, issues: parsed.error.issues };
}
export const RULESET_RESOLUTION_KINDS = Object.freeze([
  "dice-sum",
  "dice-pool",
  "dice-highest",
  "roll-against",
  "symbol-pool",
] as const);

// ── Sheet primitives ──

const fieldBase = { id: sheetId, label, section: sheetId.optional(), hideWhen: hideWhenSchema.optional() };
const numberFieldShape = {
  type: z.literal("number"),
  min: z.number().finite(),
  max: z.number().finite(),
  default: z.number().finite().optional(),
  integer: z.boolean().default(true),
};
const textFieldShape = {
  type: z.literal("text"),
  maxLength: z.number().int().min(1).max(500),
  default: z.string().max(500).optional(),
};
const longtextFieldShape = {
  type: z.literal("longtext"),
  maxLength: z.number().int().min(1).max(4000),
  default: z.string().max(4000).optional(),
};
const booleanFieldShape = { type: z.literal("boolean"), default: z.boolean().optional() };
const enumFieldShape = {
  type: z.literal("enum"),
  values: z.array(z.string().min(1).max(80)).min(1).max(40),
  /** Display text per value; a value without one shows as itself. */
  valueLabels: z.record(label).optional(),
  default: z.string().max(80).optional(),
};
const diceFieldShape = {
  type: z.literal("dice"),
  default: z.string().max(40).optional(),
  example: z.string().max(40).optional(),
};

export const rulesetFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...fieldBase, ...numberFieldShape }).strict(),
  z.object({ ...fieldBase, ...textFieldShape }).strict(),
  z.object({ ...fieldBase, ...longtextFieldShape }).strict(),
  z.object({ ...fieldBase, ...booleanFieldShape }).strict(),
  z.object({ ...fieldBase, ...enumFieldShape }).strict(),
  z.object({ ...fieldBase, ...diceFieldShape }).strict(),
]);

/** Anything a single field or one cell of a list row can hold. Shared by stored sheets and by the
 *  rows a catalog entry carries, so the two can never disagree about what a sheet value is. */
const sheetScalar = z.union([z.number().finite(), z.string().max(4000), z.boolean()]);

const columnBase = { id: sheetId, label, required: z.boolean().default(false) };
/** A number column a player fills by rolling (Capability API 1.85): `count` dice of `sides`, where
 *  sides is a number, another column of the same row (a number, or an enum whose values read as
 *  numbers such as "d8"), or a value read off the sheet. The sheet editor rolls them with the Engine's
 *  own dice and writes the total, held to the column's min and max. */
export interface RulesetListRoll {
  count: number;
  sides: number | { column: string } | RulesetValueRef;
}
// Typed by hand: inferred, the value ref inside it makes every type holding a list column too long for
// the compiler to write out.
export const rulesetListRollSchema: z.ZodType<RulesetListRoll, z.ZodTypeDef, unknown> = z
  .object({
    count: z.number().int().min(1).max(10).default(1),
    sides: z.union([z.number().int().min(2).max(100), z.object({ column: sheetId }).strict(), rulesetValueRefSchema]),
  })
  .strict();
export const rulesetListColumnSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...columnBase,
      ...numberFieldShape,
      roll: rulesetListRollSchema.optional(),
      /** A cell worked out rather than typed (Capability API 1.210): these number columns of the same
       *  row added up, held to `min` and `max`, and shown read-only. A CoC specialty is its base plus
       *  the occupation and interest points spent on it. */
      sum: z.array(sheetId).min(1).max(6).optional(),
    })
    .strict(),
  z.object({ ...columnBase, ...textFieldShape }).strict(),
  z.object({ ...columnBase, ...longtextFieldShape }).strict(),
  z.object({ ...columnBase, ...booleanFieldShape }).strict(),
  z.object({ ...columnBase, ...enumFieldShape }).strict(),
  z.object({ ...columnBase, ...diceFieldShape }).strict(),
]);

const abilitySchema = z
  .object({
    id: sheetId,
    label,
    short: promptSafeText(8).optional(),
    min: z.number().int(),
    max: z.number().int(),
    default: z.number().int(),
    section: sheetId.optional(),
    /** A score worked out rather than written down (Capability API 1.156): these added up, held to
     *  `min` and `max`, and shown read-only. A Blades attribute is its marked actions; GURPS
     *  Perception is IQ plus what was bought. No derived value, cap or proficiency may read it. */
    value: z.array(rulesetValueRefSchema).min(1).max(8).optional(),
  })
  .strict();

/** What a check on a skill or save does when the character has no training in it (its tier is the
 *  first one): roll as usual, roll one step harder (a pool's per-die target goes up one), not be
 *  rolled at all, or add `by` to its number (dice on a pool, a flat amount on a sum). */
const untrainedSchema = z.union([
  z.enum(["normal", "harder", "refuse"]),
  z.object({ by: z.number().int().min(-20).max(20) }).strict(),
]);
export type RulesetUntrained = z.infer<typeof untrainedSchema>;

/** A skill names the ability it rolls with. A system whose skills stand alone omits it. `cap` is the
 *  most its check may ever come to, from anything on the sheet or in the live state (a rating the
 *  character has, or a track that holds it down). */
const skillSchema = z
  .object({
    id: sheetId,
    label,
    ability: sheetId.optional(),
    cap: rulesetValueRefSchema.optional(),
    section: sheetId.optional(),
    /** Overrides the untrained rule of the section it sits in. */
    untrained: untrainedSchema.optional(),
  })
  .strict();
const saveSchema = skillSchema;

const derivedBase = { id: sheetId, label, section: sheetId.optional(), hideWhen: hideWhenSchema.optional() };
/** The most derived values a sheet may have: 400 since Capability API 1.111 (240 since 1.88,
 *  120 since 1.84), which a package exceeding the corresponding older limit declares. */
export const RULESET_DERIVED_MAX = 400;
export const RULESET_DERIVED_MAX_BEFORE_1106 = 240;
export const RULESET_DERIVED_MAX_BEFORE_183 = 120;
export const RULESET_DERIVED_MAX_BEFORE_179 = 60;
export const rulesetDerivedSchema = z.discriminatedUnion("op", [
  z.object({ ...derivedBase, op: z.literal("sum"), of: z.array(rulesetValueRefSchema).min(1).max(12) }).strict(),
  z
    .object({ ...derivedBase, op: z.literal("stepTable"), from: rulesetValueRefSchema, table: stepTableSchema })
    .strict(),
  z
    .object({
      ...derivedBase,
      op: z.literal("scale"),
      of: rulesetValueRefSchema,
      multiplier: z.number().finite(),
      round: roundingSchema.default("down"),
    })
    .strict(),
  /** The values multiplied together (Capability API 1.82): a 5e hit point maximum's Constitution
   *  modifier times the level. */
  z.object({ ...derivedBase, op: z.literal("multiply"), of: z.array(rulesetValueRefSchema).min(2).max(6) }).strict(),
  z.object({ ...derivedBase, op: z.literal("min"), of: z.array(rulesetValueRefSchema).min(2).max(12) }).strict(),
  z.object({ ...derivedBase, op: z.literal("max"), of: z.array(rulesetValueRefSchema).min(2).max(12) }).strict(),
  /** A number for each value of an enum field or a live state. A field's value is fixed when the
   *  character is made, so a table keyed on one may feed a maximum; a live state's changes in play,
   *  so a table keyed on one is a live read like `liveTrack`, and nothing worked out without a live
   *  state may read it. A value the table leaves out, and a state the sheet hides, read `default`. */
  z
    .object({
      ...derivedBase,
      op: z.literal("enumTable"),
      from: z
        .object({ field: sheetId.optional(), liveState: sheetId.optional() })
        .strict()
        .refine((from) => (from.field === undefined) !== (from.liveState === undefined), {
          message: "An enum table reads exactly one of: field, liveState",
        }),
      table: z
        .record(z.number().finite())
        .refine((table) => Object.keys(table).length >= 1 && Object.keys(table).length <= 40, {
          message: "An enum table names from 1 to 40 values",
        }),
      default: z.number().finite().default(0),
    })
    .strict(),
]);
export const RULESET_DERIVED_OPS = Object.freeze([
  "sum",
  "stepTable",
  "scale",
  "multiply",
  "min",
  "max",
  "enumTable",
] as const);

/** What applying something does to a pool check's own dice (Capability API 1.156): dice added to
 *  the pool, successes added after counting, and a face that counts twice or explodes from. */
/** What applying a row or entry to a roll costs: points out of a live pool (1.156), or marks on a
 *  live track (Capability API 1.218), Blades' 2 Stress for Rook's Gambit. A track is moved as far as
 *  its bounds let it; a pool that cannot pay refuses the whole application. */
const contextualCostSchema = z
  .array(
    z.union([
      z.object({ pool: sheetId, amount: z.number().int().min(1).max(1000) }).strict(),
      z.object({ track: sheetId, by: z.number().int().min(1).max(1000) }).strict(),
    ]),
  )
  .min(1)
  .max(2);
export type RulesetContextualCost = z.infer<typeof contextualCostSchema>;

const contextualCheckSchema = z
  .object({
    dice: z.number().int().min(1).max(SPEND_EFFECT_MAX).optional(),
    successes: z.number().int().min(1).max(SPEND_EFFECT_MAX).optional(),
    double: z.number().int().min(2).max(1000).optional(),
    explode: z.number().int().min(2).max(1000).optional(),
    /** Faces that cancel successes do not on this roll (Capability API 1.214): an exWoD specialty
     *  or a spent point that keeps 1s from taking successes away. */
    cancel: z.literal(false).optional(),
    /** The roll takes the character's best skill rating in place of the one asked for (Capability
     *  API 1.217): Blades' Rook's Gambit, "roll your best action rating while performing a
     *  different action". Skills only; it is never lower than the asked one. */
    best: z.literal(true).optional(),
  })
  .strict()
  .refine((check) => Object.keys(check).length > 0, { message: "A check effect does something, or is left out" });
export type RulesetContextualCheck = z.infer<typeof contextualCheckSchema>;

/** A list whose rows the player writes and the Game Master applies to a roll by name with `apply=`
 *  (Capability API 1.156): stunts, specialties, traits. Owning a row is not enough; a row applies to
 *  checks (or saves) of the skill its `skill` cell names, or to any when that cell is empty. */
const listContextualSchema = z
  .object({
    name: sheetId,
    skill: sheetId.optional(),
    /** The `skill` cell may name an ability too (Capability API 1.213): the row then applies to any
     *  check rolled with that ability, its own or the one `with=` asks for. A World of Darkness
     *  attribute specialty, "Strength: lifting". */
    abilities: z.literal(true).optional(),
    bonus: sheetId.optional(),
    dice: sheetId.optional(),
    to: z.enum(["checks", "saves"]).optional(),
    check: contextualCheckSchema.optional(),
    /** What applying a row costs (Capability API 1.218), as an entry's `cost` does. */
    cost: contextualCostSchema.optional(),
  })
  .strict()
  .refine((entry) => entry.bonus !== undefined || entry.dice !== undefined || entry.check !== undefined, {
    message: "A row applied to a roll changes it: bonus, dice or check",
  });

const listSchema = z
  .object({
    id: sheetId,
    label,
    section: sheetId.optional(),
    hideWhen: hideWhenSchema.optional(),
    maxItems: z.number().int().min(1).max(500),
    /** Up to 24 columns; a package with more than 12 declares Capability API 1.165. */
    columns: z.array(rulesetListColumnSchema).min(1).max(24),
    contextual: listContextualSchema.optional(),
    /** Every row is a check of its own (Capability API 1.161): Science (Physics) and Science (Biology)
     *  each roll their own rating. Two checks on one list are two stances backed by one rating, each
     *  named by its `label` after the row's name. */
    checks: z
      .array(
        z
          .object({
            id: sheetId,
            label: promptSafeText(24).optional(),
            /** The text column a row is named by. */
            name: sheetId,
            /** The number column that is the row's rating. */
            rating: sheetId,
            /** The ability the check rolls with, added the way a skill's is. */
            ability: sheetId.optional(),
            /** The resolution stance every row's check is in (Capability API 1.212), as a skill named
             *  in that stance is: Stewpot's "Fishing (STILLNESS)". */
            stance: sheetId.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4)
      .optional(),
    /** Makes every row a live pool (a named class resource with its own maximum). Rows are keyed
     *  by `nameColumn`, so renaming a row starts its pool over. */
    pools: z
      .object({ nameColumn: sheetId, maxColumn: sheetId, rechargeColumn: sheetId.optional() })
      .strict()
      .optional(),
  })
  .strict();

const livePoolSchema = z
  .object({
    id: sheetId,
    label,
    max: rulesetValueRefSchema,
    /** Whether the pool carries a separate temporary buffer that damage drains first. */
    allowTemp: z.boolean().default(false),
    group: sheetId.optional(),
    /** The level of what is paid out of it (Capability API 1.116), when its place in its group is
     *  not: 5e's pact slots, one pool whose spells are cast at the warlock's slot level. Without it,
     *  the first pool of a group is level 1, the next 2, and a pool in no group has none. */
    level: rulesetValueRefSchema.optional(),
    /** The groups whose costs it may pay too (Capability API 1.171), at its own level: 5e's pact
     *  slots pay for a spell costed from the spell slots, as a multiclass warlock may. */
    pays: z.array(sheetId).min(1).max(4).optional(),
    /** `full` starts at the maximum (hit points); `empty` starts at zero (stress, corruption). */
    start: z.enum(["full", "empty"]).default("full"),
    /** Where the pool starts instead, read off the sheet (Capability API 1.158): SAN at a snapshot of
     *  POW, Fate Points at Refresh. Held to 0..max; a value that reads 0 or less starts it empty. */
    startFrom: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    hideWhen: hideWhenSchema.optional(),
  })
  .strict();

/** How many levels one wound track may have. A track is a column of boxes on a sheet, so this is a
 *  ceiling on something a player reads at a glance rather than on anything the Engine computes. */
export const RULESET_TRACK_LEVELS_MAX = 16;
/** How many kinds of harm one wound track may take. Three (bashing, lethal, aggravated) is the
 *  usual number; six leaves room without turning a track into a table. */
export const RULESET_TRACK_KINDS_MAX = 6;
/** The most boxes one wound track may come to on one character's sheet, counting box tracks whose
 *  length the sheet works out and levels a list adds. Well past any system's longest track; it
 *  bounds what the sheet screen draws and what one live blob holds. */
export const RULESET_WOUND_LEVELS_MAX = 64;
/** The most levels one row of an `extra` list adds. */
export const RULESET_WOUND_EXTRA_PER_ROW = 16;

/** One rung of a wound track, best first and worst last. `penalty` is what being marked down to
 *  this level does to a roll: 0 for a scratch, and a large negative is how these systems say "you
 *  are out of it", so it is bounded wide rather than tight. */
const liveTrackLevelSchema = z.object({ label, penalty: z.number().int().min(-1000).max(0) }).strict();

/** One kind of harm the track may take. `severity` orders them; the numbers themselves mean
 *  nothing beyond their order, so a ruleset may space them however it likes. */
const liveTrackKindSchema = z
  .object({ id: sheetId, label: promptSafeText(16), severity: z.number().int().min(-100).max(100) })
  .strict();

/** A track is a bounded integer (exhaustion, death saves). A track that declares `levels` is a
 *  WOUND TRACK instead: a column of boxes, each with a label and a penalty, that a MARK sits on.
 *  `kinds` is what the ruleset says a mark may BE; a mark is one of those kinds on the track in
 *  play. The definition holds kinds, the live state holds marks, and the two words never swap.
 *
 *  A wound track's length is `levels.length`, so `min` and `max` say nothing about it. The
 *  cross-checks below hold a wound track to `min: 0` and `max: levels.length` rather than ignoring
 *  what the author wrote, so the file cannot carry two disagreeing lengths. */
const liveTrackSchema = z
  .object({
    id: sheetId,
    label,
    min: z.number().int(),
    /** A number, or on a plain track a value the sheet works out, the way a pool's maximum is (a
     *  rating of the character's own). A wound track's is always its number of levels. */
    max: z.union([z.number().int(), rulesetValueRefSchema]),
    default: z.number().int().optional(),
    /** Where a plain track starts instead of `default`, read off the sheet (Capability API 1.158). */
    startFrom: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    levels: z.array(liveTrackLevelSchema).min(1).max(RULESET_TRACK_LEVELS_MAX).optional(),
    kinds: z.array(liveTrackKindSchema).min(1).max(RULESET_TRACK_KINDS_MAX).optional(),
    /** A wound track of numbered BOXES instead of named `levels`: as many as the track's own `max`
     *  (a number, or a value the sheet works out for each character), with the penalty in force
     *  read off `table` at the number of boxes filled or remaining. */
    boxes: z
      .object({
        penalty: z
          .object({
            by: z.enum(["filled", "remaining"]),
            table: z
              .array(z.tuple([z.number().finite(), z.number().int().min(-1000).max(0)]))
              .min(1)
              .max(40)
              .superRefine(ascendingThresholds),
          })
          .strict(),
      })
      .strict()
      .optional(),
    /** How a wound track fills. `sequential` marks the best free level and keeps the marks sorted by
     *  severity; `indexed` puts a mark on the box a command names (or the next free one above it)
     *  and leaves the others where they are. */
    fill: z.enum(["sequential", "indexed"]).optional(),
    /** What a mark does to a full track: `upgrade` its lightest mark a step (and count what cannot
     *  land as overflow), or `refuse` the command. An indexed track always refuses. */
    onFull: z.enum(["upgrade", "refuse"]).optional(),
    /** Levels a list on the sheet adds, per character: every row inserts `countColumn` levels at the
     *  penalty in `penaltyColumn`, after the last level whose penalty is as good. */
    extra: z.object({ list: sheetId, countColumn: sheetId, penaltyColumn: sheetId }).strict().optional(),
    /** Printed in the sheet block even at its default, for a rating that matters every turn. */
    alwaysShow: z.boolean().optional(),
    /** Off the sheet while a field says so, as a pool can be. Never on a wound track, which rolls
     *  and fights read whatever the sheet shows. */
    hideWhen: hideWhenSchema.optional(),
  })
  .strict();

/** How many live states one sheet may carry. */
export const RULESET_LIVE_STATES_MAX = 12;

/** Its icon (Capability API 1.338): a tile of the game's icons pack, `ic_` then lowercase words joined
 *  by _. Without one, the derived name (`ic_cond_<id>`, `ic_item_<id>`, `ic_<catalog>_<entry>`), then
 *  today's look. */
const artIconRef = z
  .string()
  .max(60)
  .regex(/^ic_[a-z0-9]+(?:_[a-z0-9]+)*$/, "An icon is ic_ then lowercase words joined by _");

/** A LIVE STATE: one value out of a closed set that changes in play, such as a form, a stance or how
 *  lit a lantern is. An enum field is chosen when the character is made and stays chosen, and a
 *  condition is only on or off; a state is exactly one of its values at a time. The sheet command
 *  sets it, a rest may put it back, and a derived value may follow it with an `enumTable`. */
const liveStateSchema = z
  .object({
    id: sheetId,
    label,
    /** Printed in the Game Master's prompt and written inside a command's quotes, so held to the
     *  rule every label is, and never a double quote. */
    values: z
      .array(
        promptSafeText(80).refine((value) => !value.includes('"'), {
          message: "A state's value cannot contain a double quote: the sheet command quotes it",
        }),
      )
      .min(2)
      .max(40),
    /** Display text per value; a value without one shows as itself. */
    valueLabels: z.record(label).optional(),
    /** Where every sheet starts, and where a rest puts it back with `to: "default"`. The first value
     *  when left out. */
    default: z.string().max(80).optional(),
    /** Off the sheet while a field says so, as a pool or track can be: not shown, not set by a
     *  command, and read by a derived value as no value at all. */
    hideWhen: hideWhenSchema.optional(),
  })
  .strict();

const liveSchema = z
  .object({
    pools: z.array(livePoolSchema).max(60).default([]),
    tracks: z.array(liveTrackSchema).max(30).default([]),
    text: z
      .array(z.object({ id: sheetId, label, maxLength: z.number().int().min(1).max(500) }).strict())
      .max(12)
      .default([]),
    conditions: z
      .array(z.object({ id: sheetId, label, icon: artIconRef.optional() }).strict())
      .max(RULESET_CONDITIONS_MAX)
      .default([]),
    states: z.array(liveStateSchema).max(RULESET_LIVE_STATES_MAX).default([]),
  })
  .strict();

/**
 * One step of a sheet migration (Capability API 1.77): how a sheet stored on an older layout reads on
 * this one. Every step COPIES: what it read from stays where it was, so a sheet read by an older
 * version of the ruleset still reads as it did.
 * - `rename`: an ability, skill, save (with its bonus) or field that has a new id.
 * - `route`: one field's value to the field the text of another names, as a single class level
 *   goes to that class's own level: the first case whose words are in `by`'s text, as whole words
 *   ignoring case, when exactly one case matches; `else` when none or several do. `default` stands in
 *   for a value the sheet never stored.
 * - `routeLive`: one live pool's or track's value to the one of `cases` the migrated sheet shows (a
 *   maximum above 0), else to `else`. Live state has no version, so this runs on every read: the old
 *   key always goes, and the value moves only while the new key is not there yet.
 */
const sheetMigrationWordsSchema = z.array(z.string().trim().min(1).max(40)).min(1).max(8);
const sheetMigrationStepSchema = z.union([
  z.object({ rename: z.enum(["ability", "skill", "save", "field"]), from: sheetId, to: sheetId }).strict(),
  z
    .object({
      route: sheetId,
      by: sheetId,
      cases: z
        .array(z.object({ words: sheetMigrationWordsSchema, to: sheetId }).strict())
        .min(1)
        .max(32),
      else: sheetId,
      default: z.union([z.number().finite(), z.string().max(200)]).optional(),
    })
    .strict(),
  z
    .object({
      routeLive: z.enum(["pool", "track"]),
      from: sheetId,
      cases: z.array(sheetId).min(1).max(32),
      else: sheetId,
    })
    .strict(),
]);
const sheetMigrationSchema = z
  .object({
    /** The stored layout this moves on from, to `from + 1`. */
    from: z.number().int().min(1),
    steps: z.array(sheetMigrationStepSchema).min(1).max(64),
  })
  .strict();

// ── The guided builder (Capability API 1.86) ──

/** How many steps one guided builder may have. */
export const RULESET_BUILDER_STEPS_MAX = 24;
export const RULESET_BUILDER_STEPS_MAX_BEFORE_1107 = 16;

/** Point buy: every score a player may buy and what it costs, lowest score first. The lowest is
 *  where every score starts, and the highest the most one score may be bought up to. */
const builderPointBuySchema = z
  .object({
    budget: z.number().int().min(1).max(200),
    costs: z
      .array(z.tuple([z.number().int(), z.number().int().min(0).max(100)]))
      .min(2)
      .max(40)
      .superRefine((costs, ctx) => {
        costs.forEach(([score, cost], index) => {
          const before = costs[index - 1];
          if (before && (score !== before[0] + 1 || cost < before[1])) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: "Costs go up one score at a time, and never cost less than the score below",
            });
          }
        });
      }),
  })
  .strict();

/** A catalog step's limit by a sheet value (1.87). */
export interface RulesetBuilderUpTo {
  filter: string;
  value: RulesetValueRef;
}
// Typed by hand: inferred, the value ref inside it makes every type holding a builder step too long for
// the compiler to write out.
const rulesetBuilderUpToSchema: z.ZodType<RulesetBuilderUpTo, z.ZodTypeDef, unknown> = z
  .object({ filter: sheetId, value: rulesetValueRefSchema })
  .strict();

/** Counted choices and catalog quotas (Capability API 1.151). */
const builderChoiceBase = {
  id: sheetId.optional(),
  countFrom: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
  max: z.number().int().min(1).max(20).optional(),
  excludeChoices: z
    .array(
      z
        .string()
        .max(161)
        .regex(/^[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*$/),
    )
    .min(1)
    .max(20)
    .optional(),
};
const builderCatalogLimits = {
  quotas: z
    .array(
      z
        .object({
          filter: sheetId,
          value: z.union([z.number().finite(), z.string().max(80)]),
          min: z.number().int().min(0).max(20),
          max: z.number().int().min(0).max(20),
        })
        .strict(),
    )
    .min(1)
    .max(12)
    .optional(),
  distinctBy: sheetId.optional(),
  quotaBelow: z.object({ filter: sheetId }).strict().optional(),
};
const builderTrainedChoiceSchema = z
  .object({
    ...builderChoiceBase,
    what: z.enum(["skills", "saves"]),
    count: z.number().int().min(1).max(20),
    from: z.array(sheetId).min(1).max(120).optional(),
    tier: sheetId.optional(),
    /** Only choices already trained to this tier or higher (Capability API 1.105). */
    held: sheetId.optional(),
    only: z.enum(["any", "trained", "untrained"]).optional(),
    onDuplicate: z.literal("replace").optional(),
    /** What a duplicate may be replaced with, in place of every skill or save (Capability API 1.155). */
    replacementFrom: z.array(sheetId).min(1).max(120).optional(),
  })
  .strict();
export type RulesetBuilderTrainedChoice = z.infer<typeof builderTrainedChoiceSchema>;
export type RulesetBuilderChoice = Pick<
  RulesetBuilderTrainedChoice,
  "id" | "count" | "countFrom" | "max" | "excludeChoices"
>;
export interface RulesetBuilderCatalogLimits {
  quotas?: { filter: string; value: string | number; min: number; max: number }[];
  distinctBy?: string;
  quotaBelow?: { filter: string };
}
/** Dice a creation roll throws (Capability API 1.162): `count` d `sides`, the highest `keep` kept,
 *  `add` added and the whole times `multiplier`. CoC's (2d6+6)x5 is count 2, sides 6, add 6, x5. */
const creationDiceSchema = z
  .object({
    count: z.number().int().min(1).max(20),
    sides: z.number().int().min(2).max(100),
    keep: z.number().int().min(1).max(20).optional(),
    add: z.number().int().min(-1000).max(1000).optional(),
    multiplier: z.number().int().min(1).max(100).optional(),
  })
  .strict()
  .refine((dice) => dice.keep === undefined || dice.keep <= dice.count, {
    message: "A roll keeps at most the dice it throws",
  });
export type RulesetCreationDice = z.infer<typeof creationDiceSchema>;

const builderStepBase = {
  id: sheetId,
  label: promptSafeText(40),
  when: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
  requiredWhen: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
};

/** Numeric creation ratings (Capability API 1.152). Tier maps are per target, never inferred. */
const builderRatingTargetSchema = z.union([
  z.object({ ability: sheetId }).strict(),
  z.object({ field: sheetId }).strict(),
  z.object({ skill: sheetId }).strict(),
  z.object({ save: sheetId }).strict(),
  z.object({ bonus: sheetId }).strict(),
]);
export type RulesetBuilderRatingTarget = z.infer<typeof builderRatingTargetSchema>;
const builderRatingBoundSchema = z.union([
  z.number().int().min(0).max(10000),
  rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
]);
const builderAllocationGroupSchema = z
  .object({
    id: sheetId,
    label: promptSafeText(40),
    targets: z.array(builderRatingTargetSchema).min(1).max(120),
    base: builderRatingBoundSchema.optional(),
    min: builderRatingBoundSchema,
    max: builderRatingBoundSchema,
    budget: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    /** Dots the player puts on list rows' own ratings, counted against the budget (Capability API
     *  1.216): Exalted's Craft and Martial Arts rows paid from the 28 Ability dots. The rows are
     *  edited where the list is; the group only counts them. */
    rows: z
      .array(z.object({ list: sheetId, column: sheetId }).strict())
      .min(1)
      .max(4)
      .optional(),
  })
  .strict();
export interface RulesetBuilderAllocationGroup {
  id: string;
  label: string;
  targets: RulesetBuilderRatingTarget[];
  base?: number | RulesetValueRef;
  min: number | RulesetValueRef;
  max: number | RulesetValueRef;
  budget?: RulesetValueRef;
  rows?: Array<{ list: string; column: string }>;
}
const builderRatingTiersSchema = z
  .object({
    target: z.union([z.object({ skill: sheetId }).strict(), z.object({ save: sheetId }).strict()]),
    /** Index is the rating, starting at zero/untrained. */
    tiers: z.array(sheetId).min(1).max(12),
  })
  .strict();
const builderRatingGrantSchema = z.union([
  z.object({ target: builderRatingTargetSchema, add: z.number().int().min(1).max(10000) }).strict(),
  z.object({ target: builderRatingTargetSchema, set: z.number().int().min(0).max(10000) }).strict(),
]);
export type RulesetBuilderRatingGrant = z.infer<typeof builderRatingGrantSchema>;

/** Shared creation budgets and original-price purchases (Capability API 1.153). */
const builderCostSchema = z.union([
  z
    .object({
      flat: z
        .number()
        .finite()
        .min(-100000)
        .max(100000)
        .refine((n) => n !== 0),
    })
    .strict(),
  z.object({ perRank: z.number().finite().positive().max(100000) }).strict(),
  /** A price the source has not supplied yet (Capability API 1.207): the offer shows, and nothing
   *  is bought on it until a price is written in. */
  z.object({ unpriced: z.literal(true) }).strict(),
  z
    .object({
      table: z
        .array(z.tuple([z.number().finite().min(-100000).max(100000), z.number().finite().min(-100000).max(100000)]))
        .min(2)
        .max(200),
    })
    .strict(),
]);
export type RulesetBuilderCost = z.infer<typeof builderCostSchema>;
// ponytail: list purchases await F4's stable row IDs; extend the target union with that contract.
export interface RulesetBuilderSpendOffer {
  id: string;
  label: string;
  target: RulesetBuilderRatingTarget;
  cost: RulesetBuilderCost;
  min: number;
  max: number;
  credit?: boolean;
  baseline?: number;
  tags?: string[];
  overrides?: { when: RulesetValueRef; cost: RulesetBuilderCost }[];
  when?: RulesetValueRef;
  minFrom?: RulesetValueRef;
  maxFrom?: RulesetValueRef;
  allowedRatings?: number[];
  /** Which way the offer moves its rating (1.164). "both" raises and lowers one trait from its
   *  starting value: lowering past it is credit, and lowering what was bought refunds it. */
  direction?: "increase" | "decrease" | "both";
  /** "ownership" (1.164) prices the offer on its own ladder from `baseline` (or `min`), and the
   *  sheet keeps the higher of its own value and the level bought: GURPS familiarity under a
   *  better default. */
  effect?: "rating" | "ownership";
  /** A closed creation trade (1.164): each purchase lowers `from` by `units` and raises the target
   *  by `gain`, never taking `from` under `floor`. It costs the pool nothing. */
  exchange?: RulesetBuilderExchange;
}
export interface RulesetBuilderExchange {
  from: RulesetBuilderRatingTarget;
  units: number;
  gain: number;
  floor: number;
}
export interface RulesetBuilderPool {
  id: string;
  label: string;
  budget: RulesetValueRef;
  creditLimit?: number;
  caps?: { filter: string; maxCredit: number }[];
}
const builderPoolSchema = z
  .object({
    id: sheetId,
    label: promptSafeText(40),
    budget: rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
    creditLimit: z.number().finite().min(0).max(100000).optional(),
    caps: z
      .array(z.object({ filter: sheetId, maxCredit: z.number().finite().min(0).max(100000) }).strict())
      .max(12)
      .optional(),
  })
  .strict();
const builderSpendOfferSchema = z
  .object({
    id: sheetId,
    label: promptSafeText(40),
    target: builderRatingTargetSchema,
    /** Required, except on an exchange, which costs the pool nothing. */
    cost: builderCostSchema.optional(),
    min: z.number().finite().min(-100000).max(100000),
    max: z.number().finite().min(-100000).max(100000),
    credit: z.literal(true).optional(),
    baseline: z.number().finite().min(-100000).max(100000).optional(),
    tags: z.array(sheetId).max(12).optional(),
    overrides: z
      .array(
        z
          .object({
            when: rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
            cost: builderCostSchema,
          })
          .strict(),
      )
      .max(12)
      .optional(),
    /** Offered only while this reads above 0 on the sheet before purchases: an occupation's own
     *  skills, a Background a tribe may take (Capability API 1.155). Saved purchases stay, inactive. */
    when: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    /** A floor and a ceiling read off the sheet, held inside `min` and `max`: a Credit Rating range
     *  by occupation, Dodge capped by DEX (1.155). */
    minFrom: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    maxFrom: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    /** The only ratings a purchase may end on, such as a Merit sold at 1, 3 or 5 dots (1.155). */
    allowedRatings: z.array(z.number().finite()).min(1).max(40).optional(),
    /** Raise, lower, or both from one starting value (Capability API 1.164). */
    direction: z.enum(["increase", "decrease", "both"]).optional(),
    /** A level owned and paid for even where the sheet's own value is higher (1.164). */
    effect: z.enum(["rating", "ownership"]).optional(),
    /** A closed creation trade out of another rating, at no cost to the pool (1.164). */
    exchange: z
      .object({
        from: builderRatingTargetSchema,
        units: z.number().int().min(1).max(20),
        gain: z.number().int().min(1).max(20).default(1),
        floor: z.number().finite().min(-100000).max(100000),
      })
      .strict()
      .optional(),
  })
  .strict()
  // An exchange is priced in the rating it trades out of, so the pool's price is nothing.
  .transform((offer) => ({ ...offer, cost: offer.cost ?? ({ flat: 0 } as RulesetBuilderCost) }));

/** A row's price worked out from the row (1.159, 1.206): its number `column` times `times`, plus
 *  `add`; and the first `overrides` price whose derived value, named by a prefix and the row's cell
 *  (`affinity_` + "melee"), reads above 0 on the sheet: a Charm of a Caste or Favored Ability. */
export interface RulesetBuilderRowsCost {
  column?: string;
  times?: number;
  add?: number;
  overrides?: Array<{ derived: { prefix: string; cell: string }; cost?: number; times?: number }>;
}
const rowsCostSchema: z.ZodType<RulesetBuilderRowsCost, z.ZodTypeDef, unknown> = z
  .object({
    column: sheetId.optional(),
    times: z.number().finite().min(-1000).max(1000).optional(),
    add: z.number().finite().min(-100000).max(100000).optional(),
    overrides: z
      .array(
        z
          .object({
            derived: z
              .object({
                prefix: z
                  .string()
                  .max(30)
                  .regex(/^[a-z0-9_]*$/),
                cell: sheetId,
              })
              .strict(),
            cost: z.number().finite().min(-100000).max(100000).optional(),
            /** Or the column's per-unit rate instead of `times` (Capability API 1.216): an Exalted
             *  Craft dot is 1 BP on a Caste or Favored Ability and 2 otherwise. */
            times: z.number().finite().min(-1000).max(1000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4)
      .optional(),
  })
  .strict();

/** One step of the guided builder. The steps are offered in order, each says how many choices it
 *  still waits on, and none of them blocks the next. */
const builderStepSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...builderStepBase,
      kind: z.literal("catalog"),
      ...builderCatalogLimits,
      /** A catalog of rows whose entries are offered as cards. */
      catalog: sheetId,
      /** How many entries the step asks for, and at most takes. */
      min: z.number().int().min(0).max(40).default(1),
      max: z.number().int().min(1).max(40).default(1),
      /** A text or enum field the picked entries' labels are written to (a race, a class). */
      field: sheetId.optional(),
      /** Values written onto every row this step adds (1.108). Later edits remain the player's.
       *  `fromWithin` reads the first offering parent pick's id, label or filter (Capability API 1.130). */
      stamp: z
        .record(sheetId, z.union([sheetScalar, z.object({ fromWithin: sheetId }).strict()]))
        .refine((stamp) => Object.keys(stamp).length >= 1 && Object.keys(stamp).length <= 4, {
          message: "A step stamps 1 to 4 columns",
        })
        .optional(),
      /** Fixed values of the catalog's filters: only entries that match are offered. */
      filters: z.record(z.union([z.number().finite(), z.string().max(80)])).optional(),
      /** Only entries whose `filter` names an entry picked at an earlier step (a subrace by its race). */
      within: z.object({ step: sheetId, filter: sheetId }).strict().optional(),
      /** Only entries whose number `filter` is at most `value`, read off the sheet as it stands (features
       *  up to the character's level; Capability API 1.87). An entry without the filter is offered. */
      upTo: rulesetBuilderUpToSchema.optional(),
      /** How many entries the step asks for and at most takes, read off the sheet as it stands, in
       *  place of `min` and never above `max` (spells known at the character's level; Capability API
       *  1.90). Picks past it are kept but count for nothing. */
      countFrom: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
      /** Each pick is paid out of this builder pool (Capability API 1.159): talents bought with
       *  creation XP. `cost` is a fixed price or the entry's own number filter. */
      pool: sheetId.optional(),
      cost: z.union([z.number().finite().min(-100000).max(100000), z.object({ filter: sheetId }).strict()]).optional(),
      /** Entries' `offeredWhen` and the step's `upTo` read the sheet as the steps before `before`
       *  make it (Capability API 1.160): multiclass prerequisites on the scores before this level. */
      reads: z.object({ before: sheetId }).strict().optional(),
    })
    .strict(),
  z
    .object({
      ...builderStepBase,
      kind: z.literal("fields"),
      fields: z.array(sheetId).min(1).max(20),
      /** Fields of the step its badge does not wait on, such as a subclass chosen at a later level. */
      optional: z.array(sheetId).min(1).max(20).optional(),
      /** Fields shown only while their value reference reads above 0 on the sheet (1.107). */
      shownWhen: z
        .record(sheetId, rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>)
        .optional(),
      /** Number fields held to a combined maximum (1.107). */
      total: z
        .object({ fields: z.array(sheetId).min(2).max(20), max: z.number().int().min(1).max(1000) })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      ...builderStepBase,
      kind: z.literal("abilities"),
      /** The scores the step sets. All of them when left out. */
      abilities: z.array(sheetId).min(1).max(20).optional(),
      methods: z
        .object({
          pointBuy: builderPointBuySchema.optional(),
          /** Values to hand out, one to each score. */
          standardArray: z.array(z.number().int()).min(1).max(20).optional(),
          /** One roll per score: `count` dice of `sides`, keeping the highest `keep`. */
          roll: z
            .object({
              count: z.number().int().min(1).max(10),
              sides: z.number().int().min(2).max(100),
              keep: z.number().int().min(1).max(10),
            })
            .strict()
            .refine((roll) => roll.keep <= roll.count, { message: "A roll keeps at most the dice it throws" })
            .optional(),
          /** Each score rolled in turn with its own group's dice, never moved (Capability API 1.162):
           *  OSE's 3d6 in order, CoC's 3d6x5 beside (2d6+6)x5. */
          rolls: z
            .array(z.object({ abilities: z.array(sheetId).min(1).max(20), dice: creationDiceSchema }).strict())
            .min(1)
            .max(6)
            .optional(),
          /** Typed in: `true` keeps each score's own bounds; an object bounds the base (1.110). */
          manual: z
            .union([
              z.literal(true),
              z
                .object({ min: z.number().int().min(-100), max: z.number().int().max(1000) })
                .strict()
                .refine((bounds) => bounds.min <= bounds.max, { message: "Manual bounds have min at most max" }),
            ])
            .optional(),
        })
        .strict()
        .refine((methods) => Object.keys(methods).length > 0, { message: "An abilities step offers a method" }),
      /** The method a new character starts on, until the player picks another (Capability API 1.87). */
      default: z.enum(["pointBuy", "standardArray", "roll", "rolls", "manual"]).optional(),
    })
    .strict(),
  z
    .object({
      ...builderStepBase,
      kind: z.literal("trained"),
      /** Skills or saves of the player's own choosing, besides the ones picked entries offer. */
      choose: z.array(builderTrainedChoiceSchema).min(1).max(4).optional(),
    })
    .strict(),
  z
    .object({
      ...builderStepBase,
      kind: z.literal("allocate"),
      priorities: z.array(z.number().int().min(0).max(1200000)).min(1).max(12).optional(),
      groups: z.array(builderAllocationGroupSchema).min(1).max(12),
      annotations: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...builderStepBase,
      kind: z.literal("spend"),
      pool: sheetId,
      offers: z.array(builderSpendOfferSchema).min(1).max(120),
    })
    .strict(),
  /** Rolls made once during creation and kept with their dice (Capability API 1.162): Luck, hit
   *  points, starting money, an EDU improvement check. Reopening the builder never rolls again. */
  z
    .object({
      ...builderStepBase,
      kind: z.literal("roll"),
      rolls: z
        .array(
          z
            .object({
              id: sheetId,
              label: promptSafeText(40),
              /** The number field the result is written to. */
              field: sheetId.optional(),
              /** Or the ability score it is written to (Capability API 1.209): CoC's EDU improvement. An
               *  improvement check adds to the score as an increase, so a score rolled or bought again
               *  keeps it. Exactly one of `field` and `ability`. */
              ability: sheetId.optional(),
              dice: creationDiceSchema,
              /** Roll this many times and keep the best (a youngest investigator's Luck). */
              best: z.number().int().min(2).max(3).optional(),
              /** The least the result may be, a number or read off the sheet (1 hit point; a potential
               *  never below the stat it grows from). */
              floor: z
                .union([
                  z.number().finite(),
                  rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
                ])
                .optional(),
              /** An improvement check instead: the dice are rolled against the field, and only a result
               *  above it adds `gain` to it (CoC's EDU improvement). */
              gain: creationDiceSchema.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(12),
      /** The player may throw a step's rolls away and roll again; otherwise a result stands. */
      retry: z.literal(true).optional(),
    })
    .strict(),
  /** Named rows the player adds, edits and removes on one of the sheet's lists: retainers, contacts,
   *  ritual ingredients (Capability API 1.154). Rows a catalog pick wrote are shown and not edited. */
  z
    .object({
      ...builderStepBase,
      kind: z.literal("rows"),
      list: sheetId,
      /** The columns the step edits. All of the list's columns when left out. */
      columns: z.array(sheetId).min(1).max(20).optional(),
      /** Columns a row must fill to count toward `min`. */
      required: z.array(sheetId).min(1).max(20).optional(),
      /** Rows the step waits on before its badge clears. */
      min: z.number().int().min(0).max(20).optional(),
      /** Rows the step lets the player add, never above the list's own maximum. */
      max: z.number().int().min(1).max(200).optional(),
      /** Values a new row starts with, in place of the columns' own defaults. */
      defaults: z.record(sheetId, sheetScalar).optional(),
      /** Each row is paid out of this builder pool (Capability API 1.159): a custom stunt, a trait, a
       *  repeated Charm. `cost` is a fixed price or the row's own number column; a negative price is a
       *  credit, held to the pool's credit limit. */
      pool: sheetId.optional(),
      cost: z.union([z.number().finite().min(-100000).max(100000), rowsCostSchema]).optional(),
      /** A catalog of rows the player may copy a row from, as many times as they like: each copy is a
       *  row of their own, priced and removed on its own. */
      from: sheetId.optional(),
    })
    .strict(),
  /** Starting values written once, when the player confirms them (Capability API 1.158): SAN from POW,
   *  Humanity before freebies, the creation XP left over. Reopening never writes them again. */
  z
    .object({
      ...builderStepBase,
      kind: z.literal("initialize"),
      /** The values are worked out on the sheet as the steps before `before` make it (1.160):
       *  Humanity from the Virtues before freebies, whatever was bought since. */
      reads: z.object({ before: sheetId }).strict().optional(),
      writes: z
        .array(
          z
            .object({
              field: sheetId,
              value: z
                .union([sheetScalar, rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>])
                .optional(),
              /** What a builder pool has left, such as unspent creation XP. */
              remaining: sheetId.optional(),
            })
            .strict()
            .refine((write) => (write.value === undefined) !== (write.remaining === undefined), {
              message: "A write has value or remaining, not both",
            }),
        )
        .min(1)
        .max(20),
    })
    .strict(),
  z
    .object({
      ...builderStepBase,
      kind: z.literal("startingGear"),
      /** Only gear the sheet fits is offered in legal-only mode (Capability API 1.109). */
      strict: z.literal(true).optional(),
    })
    .strict(),
  /** Where the entries the picks grant from `catalog` are chosen (`grants.entries`, 1.91). */
  z.object({ ...builderStepBase, kind: z.literal("choices"), catalog: sheetId }).strict(),
]);

type BuilderMethodName = "pointBuy" | "standardArray" | "roll" | "rolls" | "manual";
interface BuilderStepBase {
  id: string;
  label: string;
  when?: RulesetValueRef;
  requiredWhen?: RulesetValueRef;
}
/** One step of the guided builder (see `builderStepSchema`). Typed by hand: inferred, the value ref in
 *  `upTo` makes the ruleset's own type too long for the compiler to write out. */
export type RulesetBuilderStep =
  | (BuilderStepBase &
      RulesetBuilderCatalogLimits & {
        kind: "catalog";
        catalog: string;
        min: number;
        max: number;
        field?: string;
        stamp?: Record<string, string | number | boolean | { fromWithin: string }>;
        filters?: Record<string, string | number>;
        within?: { step: string; filter: string };
        upTo?: RulesetBuilderUpTo;
        countFrom?: RulesetValueRef;
        pool?: string;
        cost?: number | { filter: string };
        reads?: { before: string };
      })
  | (BuilderStepBase & {
      kind: "fields";
      fields: string[];
      optional?: string[];
      shownWhen?: Record<string, RulesetValueRef>;
      total?: { fields: string[]; max: number };
    })
  | (BuilderStepBase & { kind: "choices"; catalog: string })
  | (BuilderStepBase & {
      kind: "abilities";
      abilities?: string[];
      methods: {
        pointBuy?: { budget: number; costs: [number, number][] };
        standardArray?: number[];
        roll?: { count: number; sides: number; keep: number };
        rolls?: Array<{ abilities: string[]; dice: RulesetCreationDice }>;
        manual?: true | { min: number; max: number };
      };
      default?: BuilderMethodName;
    })
  | (BuilderStepBase & {
      kind: "trained";
      choose?: RulesetBuilderTrainedChoice[];
    })
  | (BuilderStepBase & {
      kind: "allocate";
      priorities?: number[];
      groups: RulesetBuilderAllocationGroup[];
      annotations?: boolean;
    })
  | (BuilderStepBase & { kind: "spend"; pool: string; offers: RulesetBuilderSpendOffer[] })
  | (BuilderStepBase & {
      kind: "rows";
      list: string;
      columns?: string[];
      required?: string[];
      min?: number;
      max?: number;
      defaults?: Record<string, string | number | boolean>;
      pool?: string;
      cost?: number | RulesetBuilderRowsCost;
      from?: string;
    })
  | (BuilderStepBase & {
      kind: "roll";
      rolls: Array<{
        id: string;
        label: string;
        field?: string;
        ability?: string;
        dice: RulesetCreationDice;
        best?: number;
        floor?: number | RulesetValueRef;
        gain?: RulesetCreationDice;
      }>;
      retry?: true;
    })
  | (BuilderStepBase & {
      kind: "initialize";
      reads?: { before: string };
      writes: Array<{ field: string; value?: string | number | boolean | RulesetValueRef; remaining?: string }>;
    })
  | (BuilderStepBase & { kind: "startingGear"; strict?: true });
export interface RulesetSheetBuilder {
  pools?: RulesetBuilderPool[];
  ratingTiers?: z.infer<typeof builderRatingTiersSchema>[];
  steps: RulesetBuilderStep[];
  tier?: string;
  constraints?: RulesetBuilderConstraint[];
  profiles?: RulesetBuilderProfile[];
}

const builderBoundSchema = z.union([
  z.number().finite(),
  rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
]);
/** A creation rule the builder checks and shows on one step's badge until it holds (Capability API
 *  1.155). It never blocks Next or All fields. Exactly one of `value`, `rows`, `distinct` and
 *  `approved` says what it reads. */
const builderConstraintSchema = z
  .object({
    id: sheetId,
    /** The rule as the player reads it while it fails. */
    label: promptSafeText(160),
    /** The step whose badge carries the rule. */
    step: sheetId,
    /** Checked only while this reads above 0. */
    when: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    value: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    /** A list's rows: how many there are and what one number column adds up to, over the rows
     *  `filter` keeps. */
    rows: z
      .object({
        list: sheetId,
        filter: z
          .object({
            column: sheetId,
            equals: sheetScalar.optional(),
            below: z.number().finite().optional(),
            above: z.number().finite().optional(),
          })
          .strict()
          .optional(),
        sum: sheetId.optional(),
      })
      .strict()
      .optional(),
    /** No two rows of the list share a filled-in value of the column. */
    distinct: z.object({ list: sheetId, column: sheetId }).strict().optional(),
    /** A boolean field that must be on: a Storyteller's approval, recorded on the sheet. */
    approved: sheetId.optional(),
    min: builderBoundSchema.optional(),
    max: builderBoundSchema.optional(),
  })
  .strict()
  .superRefine((rule, ctx) => {
    const kinds = (["value", "rows", "distinct", "approved"] as const).filter((key) => rule[key] !== undefined);
    if (kinds.length !== 1)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A rule reads exactly one of: value, rows, distinct, approved",
      });
    if ((rule.value || rule.rows) && rule.min === undefined && rule.max === undefined)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A value or rows rule names a min or a max" });
    if ((rule.distinct || rule.approved) && (rule.min !== undefined || rule.max !== undefined))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A distinct or approved rule takes no min or max" });
  });
export type RulesetBuilderConstraint = z.infer<typeof builderConstraintSchema>;

/** One creation profile (Capability API 1.160): a character type, career or package the sheet selects.
 *  The first whose `when` reads above 0 is the character's. Steps a profile lists are shown only while
 *  it is active, and its `budgets` replace the pools' own while it is. */
const builderProfileSchema = z
  .object({
    id: sheetId,
    label: promptSafeText(40),
    when: rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
    steps: z.array(sheetId).min(1).max(RULESET_BUILDER_STEPS_MAX).optional(),
    budgets: z.record(sheetId, rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
  })
  .strict();
export type RulesetBuilderProfile = z.infer<typeof builderProfileSchema>;

const sheetBuilderSchema: z.ZodType<RulesetSheetBuilder, z.ZodTypeDef, unknown> = z
  .object({
    constraints: z.array(builderConstraintSchema).min(1).max(40).optional(),
    profiles: z.array(builderProfileSchema).min(1).max(16).optional(),
    pools: z.array(builderPoolSchema).min(1).max(12).optional(),
    steps: z.array(builderStepSchema).min(1).max(RULESET_BUILDER_STEPS_MAX),
    ratingTiers: z.array(builderRatingTiersSchema).min(1).max(140).optional(),
    /** The tier a skill or save the builder trains is set to, unless a grant names its own. The first
     *  tier above untrained the sheet offers when left out. */
    tier: sheetId.optional(),
  })
  .strict();

const advancementSchema = z
  .object({
    fields: z.array(sheetId).max(64).optional(),
    abilities: z.boolean().optional(),
    skills: z.boolean().optional(),
    saves: z.boolean().optional(),
    text: promptSafeText(400).optional(),
  })
  .strict()
  .refine((value) => !!(value.fields?.length || value.abilities || value.skills || value.saves), {
    message: "Advancement must allow at least one field, abilities, skills or saves",
  });

export const rulesetSheetSchema = z
  .object({
    /** Bumped by the author when the sheet's shape changes. Stored sheets record it as `v`. */
    version: z.number().int().min(1),
    /** How a sheet stored on an older layout reads on this one (Capability API 1.77). A version that
     *  only adds needs none. Never removed once shipped: a sheet stored long ago still needs them. */
    migrations: z.array(sheetMigrationSchema).min(1).max(32).optional(),
    sections: z
      .array(
        z
          .object({
            id: sheetId,
            label,
            /** The untrained rule for every skill and save in this section that names none of its own. */
            untrained: untrainedSchema.optional(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    abilities: z.array(abilitySchema).max(20).default([]),
    skills: z.array(skillSchema).max(120).default([]),
    saves: z.array(saveSchema).max(40).default([]),
    /** Which proficiency tiers the editor offers for skills and saves. Omitted means all of them. */
    skillTiers: z.array(sheetId).min(1).max(12).optional(),
    saveTiers: z.array(sheetId).min(1).max(12).optional(),
    /** Range of the free per-skill and per-save bonus every sheet may carry (ranks, items, feats). */
    bonusRange: z
      .object({ min: z.number().int().min(-100), max: z.number().int().max(100) })
      .strict()
      .default({ min: -20, max: 40 }),
    /** Up to 240 (Capability API 1.208; 160 before it): Rolemaster's ranks, potentials and totals. */
    fields: z.array(rulesetFieldSchema).max(RULESET_FIELDS_MAX).default([]),
    /** Up to 240 (Capability API 1.88; 120 from 1.84, 60 before it). */
    derived: z.array(rulesetDerivedSchema).max(RULESET_DERIVED_MAX).default([]),
    lists: z.array(listSchema).max(20).default([]),
    live: liveSchema.default({}),
    /** A guided character builder beside the full form (Capability API 1.86). */
    builder: sheetBuilderSchema.optional(),
    /** Permanent changes the Game Master may make (Capability API 1.142). */
    advancement: advancementSchema.optional(),
  })
  .strict();

// ── Rests ──

const restAmountShape = {
  /** Set the value: the maximum, the minimum, or a number. */
  to: z.union([z.literal("max"), z.literal("min"), z.number().int()]).optional(),
  /** Change the value by a constant, or by a fraction of the maximum. */
  by: z
    .union([
      z.object({ const: z.number().int() }).strict(),
      z
        .object({
          fractionOfMax: z.number().gt(0).max(1),
          round: roundingSchema.default("down"),
          min: z.number().int().min(0).default(0),
        })
        .strict(),
    ])
    .optional(),
};

const restRestoreSchema = z
  .object({
    pool: sheetId.optional(),
    poolGroup: sheetId.optional(),
    /** Row pools of the named list, optionally only rows whose recharge column is one of `recharge`. */
    listPools: sheetId.optional(),
    recharge: z.array(z.string().min(1).max(80)).min(1).max(12).optional(),
    track: sheetId.optional(),
    /** On a wound track: clear only marks of this kind, leaving the others where they are. */
    kind: sheetId.optional(),
    /** A live state, put back with `to`: `"default"` or one of its values. */
    state: sheetId.optional(),
    /** A pool group's fraction worked out on the group's whole maximum and shared out over its pools
     *  in the order the sheet lists them, rather than on each pool alone (Capability API 1.77): 5e's
     *  "half of the character's total number of" hit dice, kept in one pool per die. */
    shared: z.literal(true).optional(),
    ...restAmountShape,
    /** The maximum, the minimum or a number; on a state step, `"default"` or one of its values. */
    to: z.union([z.literal("max"), z.literal("min"), z.number().int(), z.string().min(1).max(80)]).optional(),
  })
  .strict()
  .superRefine((op, ctx) => {
    const targets = (["pool", "poolGroup", "listPools", "track", "state"] as const).filter(
      (key) => op[key] !== undefined,
    );
    if (op.state !== undefined && typeof op.to !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: 'A state step sets it with "to": "default" or one of its values',
      });
    }
    if (op.state === undefined && typeof op.to === "string" && op.to !== "max" && op.to !== "min") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: '"to" is "max", "min" or a number' });
    }
    if (op.kind !== undefined && op.track === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["kind"], message: '"kind" only narrows a track' });
    }
    if (targets.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A restore step names exactly one of: pool, poolGroup, listPools, track, state",
      });
    }
    if ((op.to === undefined) === (op.by === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A restore step has exactly one of "to" or "by"' });
    }
    if (op.recharge && op.listPools === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recharge"], message: '"recharge" only filters listPools' });
    }
    if (op.shared && (op.poolGroup === undefined || !op.by || !("fractionOfMax" in op.by))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shared"],
        message: '"shared" shares a fraction of a pool group\'s maximum: it needs poolGroup and by.fractionOfMax',
      });
    }
  });

/** Dice a rest may spend to heal (Capability API 1.335): 5e's Hit Dice on a short rest. `pool` is spent a
 *  die at a time; each die has `die` sides (a number, or an enum field whose value reads "d8") and adds
 *  `add` (Constitution), never below 0, to `heals`. `extra` is a die more for whoever spends any, from the
 *  party member with the most sides of it, plus their `add` on it: Song of Rest, and Pell's Teapot's +1. */
const restDiceSchema = z
  .object({
    pool: sheetId,
    die: rulesetValueRefSchema,
    add: rulesetValueRefSchema.optional(),
    heals: sheetId,
    extra: z.object({ die: rulesetValueRefSchema, add: rulesetValueRefSchema.optional() }).strict().optional(),
  })
  .strict();

const restSchema = z
  .object({
    id: sheetId,
    label,
    restore: z.array(restRestoreSchema).max(40).default([]),
    /** Dice it may spend to heal (1.335); a list draws from several pools, each its own die (1.337):
     *  5e's hit dice of a multiclass character, a d10 pool and a d6 pool. */
    dice: z.union([restDiceSchema, z.array(restDiceSchema).min(1).max(12)]).optional(),
    clear: z
      .object({
        text: z.array(sheetId).max(12).default([]),
        conditions: z.union([z.literal("all"), z.array(sheetId).max(RULESET_CONDITIONS_MAX)]).default([]),
      })
      .strict()
      .default({}),
  })
  .strict();

// ── The GM surface ──

const gmSchema = z
  .object({
    /** Replaces the built-in skill-check paragraph of the GM reminder. */
    checkGuidance: promptSafeText(1500),
    /** Introduces the sheet blocks and the sheet command. */
    sheetGuidance: promptSafeText(1500).optional(),
    /** Given to world generation when a game on this ruleset is created, so the world it invents
     *  suits the rules the party will play by (no gunpowder, magic is rare, the dead walk). It is
     *  read once, at setup, and never reaches a turn. */
    worldGuidance: promptSafeText(1500).optional(),
    /** What the compact per-character sheet block shows beyond what the Engine always renders
     *  (ability modifiers, trained skills and saves, live state). */
    sheetSummary: z
      .object({
        fields: z.array(sheetId).max(24).default([]),
        derived: z.array(sheetId).max(24).default([]),
        lists: z
          .array(
            z
              .object({
                list: sheetId,
                /** A text column, or an enum column whose value names the row. */
                nameColumn: sheetId,
                /** Up to three more of the row's own columns, printed after its name (a rating). */
                columns: z.array(sheetId).min(1).max(3).optional(),
                /** Group rows under this column's value (spells by level). */
                groupBy: sheetId.optional(),
                /** Only rows whose boolean column is true (prepared spells). */
                onlyWhen: sheetId.optional(),
              })
              .strict(),
          )
          .max(8)
          .default([]),
      })
      .strict()
      .default({}),
  })
  .strict();

const coverageSchema = z
  .object({
    checks: z.boolean().default(false),
    saves: z.boolean().default(false),
    sheet: z.boolean().default(false),
    resources: z.boolean().default(false),
    rests: z.boolean().default(false),
    combat: z.boolean().default(false),
    /** Shown in the setup wizard before the game starts. */
    summary: promptSafeText(400),
  })
  .strict();

/** A handful of dice a fight rolls. Its own object because an attack roll, an initiative roll, a
 *  roll against death and a creature's recharge roll are the same shape. */
const combatDiceSchema = z
  .object({ count: z.number().int().min(1).max(10), sides: z.number().int().min(2).max(1000) })
  .strict();

// ── Catalogs: ready-made entries an author ships with the ruleset ──

/** The reserved key a picked row carries, recording `<catalogId>/<entryId>` so the picker can mark
 *  what a sheet already has. A column id starts with a letter, so this can never be one. */
export const RULESET_CATALOG_ROW_KEY = "_catalog";

/** Byte ceiling for one `catalogs/<id>.json` asset, checked against the manifest's declared
 *  `files[].bytes` BEFORE the asset is read. Larger than a ruleset because a spell list is long. 2 MB
 *  since Capability API 1.340; a package with a catalog over the earlier ceiling declares 1.340. */
export const RULESET_CATALOG_MAX_BYTES = 2 * 1024 * 1024;
/** The catalog ceiling before Capability API 1.340. */
export const RULESET_CATALOG_EARLIER_MAX_BYTES = 1024 * 1024;

/** How many entries one catalog may hold, inline or in its asset. */
export const RULESET_CATALOG_MAX_ENTRIES = 2000;

/** The reserved asset path a package ships one catalog under. */
export function rulesetCatalogAssetPath(catalogId: string): string {
  return `catalogs/${catalogId}.json`;
}

/** The catalog asset family (Capability API 1.21). The file name is the catalog's own id, so the
 *  shape mirrors `sheetId`. One pattern, so the path check and the editor schema cannot drift. */
const RULESET_CATALOG_ASSET_PATTERN = /^catalogs\/[a-z][a-z0-9_]{0,39}\.json$/;

/** Whether a declared package asset path belongs to the catalog family. */
export function isRulesetCatalogAssetPath(path: string): boolean {
  return RULESET_CATALOG_ASSET_PATTERN.test(path);
}

/** One plain line for the picker. Catalog text never reaches the model, so this does not carry the
 *  GM tag and macro-brace rules of `promptSafeText`; it only refuses what would break a line. */
const catalogText = (max: number) =>
  z
    .string()
    .max(max)
    // Control characters (Cc) and the line and paragraph separators, written as ranges rather than
    // as Unicode property escapes so the generated JSON Schema works in validators without them.
    .regex(/^[^\u0000-\u001F\u007F-\u009F\u2028\u2029]*$/, "Text cannot contain line breaks or control characters");

/** A count, a die and one optional flat adjustment (`2d6`, `8d6`, `1d8+3`). Deliberately narrow:
 *  the later combat bridge has to read this, not just print it. At least one die of at least two
 *  sides, because `0d6` and `1d0` are dice nobody can throw: a fight would roll nothing for them and
 *  call it a result. Said in the pattern itself so the generated JSON Schema says it too. */
const catalogDice = z
  .string()
  .max(40)
  .regex(
    /^[1-9]\d{0,2}d(?:[2-9]|[1-9]\d{1,3})(?:[+-]\d{1,4})?$/,
    "Dice look like 2d6 or 1d8+3: at least one die, of at least two sides",
  );

const catalogAmountShape = { dice: catalogDice.optional(), flat: z.number().int().optional() };

/** The moment a reaction waits for, and what it answers. A catalog entry and a creature's own action
 *  say it the same way. */
/** An area that stays (Capability API 1.172), as a catalog entry or an item's use carries it. Typed by
 *  hand: written out, its inferred type is too long for the definition schema around it to emit. */
/** Damage a combat condition deals its holder each turn (Capability API 1.189). Typed by hand:
 *  written out, its inferred type is too long for the definition schema around it to emit. */
export interface RulesetConditionHarms {
  at: "turn-start" | "turn-end";
  dice?: string;
  flat?: number;
  type?: string;
  healedOnlyByRest?: true;
}
const conditionHarmsSchema: z.ZodType<RulesetConditionHarms, z.ZodTypeDef, unknown> = z
  .object({
    at: z.enum(["turn-start", "turn-end"]),
    dice: catalogDice.optional(),
    flat: z.number().int().min(0).max(1000).optional(),
    type: promptSafeText(40).optional(),
    /** What it takes comes back only with a rest (Capability API 1.193): a sword of wounding's. */
    healedOnlyByRest: z.literal(true).optional(),
  })
  .strict()
  .refine((harm) => harm.dice !== undefined || harm.flat !== undefined, {
    message: "What it harms with names dice, a flat amount, or both",
  });

/** Temporary points a combat condition gives its holder each turn (Capability API 1.274). Typed by
 *  hand, as its harm is. */
export interface RulesetConditionTemporary {
  at: "turn-start" | "turn-end";
  dice?: string;
  flat?: number;
  value?: true;
  lostWhenEnds?: true;
}
const conditionTemporarySchema: z.ZodType<RulesetConditionTemporary, z.ZodTypeDef, unknown> = z
  .object({
    at: z.enum(["turn-start", "turn-end"]),
    dice: catalogDice.optional(),
    flat: z.number().int().min(0).max(1000).optional(),
    /** Plus the `value` whoever put it on gave it as it went on: Heroism's spellcasting modifier. */
    value: z.literal(true).optional(),
    /** As it ends, its holder loses what is left of the points it gave. */
    lostWhenEnds: z.literal(true).optional(),
  })
  .strict()
  .refine((given) => given.dice !== undefined || given.flat !== undefined || given.value === true, {
    message: "What it gives names dice, a flat amount, the value it was put on with, or some of them",
  });

/** Damage a condition deals as it ends (1.245), unless its holder is what `unless` names. */
export interface RulesetConditionEndHarm {
  dice?: string;
  flat?: number;
  type?: string;
  unless?: RulesetTargetIs;
}
const conditionEndHarmSchema: z.ZodType<RulesetConditionEndHarm, z.ZodTypeDef, unknown> = z
  .object({
    dice: catalogDice.optional(),
    flat: z.number().int().min(0).max(1000).optional(),
    type: promptSafeText(40).optional(),
    unless: z.lazy(() => targetIsSchema).optional(),
  })
  .strict()
  .refine((harm) => harm.dice !== undefined || harm.flat !== undefined, {
    message: "What it harms with names dice, a flat amount, or both",
  });

/** The senses that see through an obscuring zone or past a condition that hides (1.178). */
export interface RulesetSeenThrough {
  pierced?: string[];
  /** Only lightly obscured (1.286): it hides nobody, and only makes looking into it harder. */
  light?: true;
  /** A wind of the fight's disperses it (1.286): 5e's Fog Cloud, not its Darkness. `{ after }`
   *  only once it has stood in one that many whole rounds (1.289): 5e's Stinking Cloud. */
  dispersed?: true | { after: number };
  /** Magical darkness (1.297), which a zone that `dispelsDark` ends. */
  darkness?: true;
}
const seenThroughSchema: z.ZodType<RulesetSeenThrough, z.ZodTypeDef, unknown> = z
  .object({
    pierced: z
      .array(sheetId)
      .min(1)
      .max(8)
      .refine((senses) => new Set(senses).size === senses.length, { message: "Each sense is named once" })
      .optional(),
    /** Only lightly obscured (Capability API 1.286): nobody is hidden by it, though the fight
     *  knows who is seen only through it: 5e's dim light, a Cape of the Mountebank's smoke. */
    light: z.literal(true).optional(),
    /** A zone that `disperses` ends it where it reaches it (Capability API 1.286): 5e's Fog Cloud,
     *  dispersed by a Gust of Wind. */
    dispersed: z
      .union([
        z.literal(true),
        /** Only once a wind has reached it this many whole rounds (Capability API 1.289): 5e's
         *  Stinking Cloud, dispersed after 1 round in a strong wind. */
        z.object({ after: z.number().int().min(1).max(10) }).strict(),
      ])
      .optional(),
    /** It is magical darkness (Capability API 1.297): a zone that `dispelsDark` ends it where the
     *  two meet, at its level or lower. 5e's Darkness. */
    darkness: z.literal(true).optional(),
  })
  .strict();

/** How far something senses with each of the fight's senses, in the ruleset's distance (1.178):
 *  a range, or (Capability API 1.182) `{ "add": N }`, which adds N to the holder's own range of that
 *  sense and is the range N for a holder without it (5e's goggles of night). */
export type RulesetSenseGrant = number | { add: number };
/** Light something sheds (Capability API 1.294), in the ruleset's distance: bright light this far,
 *  dim light as far again beyond it. 5e's torch is `{ "bright": 20, "dim": 20 }`. */
export interface RulesetLightRadius {
  bright: number;
  dim: number;
  reveals?: true;
  sunlight?: true;
  magical?: true;
  shade?: true;
}
const lightRadiusSchema: z.ZodType<RulesetLightRadius, z.ZodTypeDef, unknown> = z
  .object({
    bright: z.number().finite().min(0).max(10000),
    dim: z.number().finite().min(0).max(10000),
    /** Whoever a condition hides (the invisible) is seen in its bright light (Capability API
     *  1.297): 5e's lantern of revealing. */
    reveals: z.literal(true).optional(),
    /** Its bright light is sunlight (Capability API 1.298), for what holds only in sunlight: 5e's
     *  sun blade against Sunlight Sensitivity. */
    sunlight: z.literal(true).optional(),
    /** Magical light (Capability API 1.299), which shines into magical darkness where other light
     *  does not: a sun blade's. A spell's light, on a zone or a condition, always is. */
    magical: z.literal(true).optional(),
    /** It sheds shade (Capability API 1.319): dim light as far as it reaches, and bright light or
     *  sunlight there is dim too. The showcase's Lantern of Dusk, `{ "bright": 0, "dim": 15,
     *  "shade": true }`, against Noonfield's light rule. */
    shade: z.literal(true).optional(),
  })
  .strict()
  .refine((light) => light.bright + light.dim > 0, { message: "A light reaches somewhere" })
  .refine((light) => !light.shade || (light.bright === 0 && !light.reveals && !light.sunlight), {
    message: "A shade sheds no bright light: its reach is all dim",
  });

const senseRangesSchema: z.ZodType<Record<string, RulesetSenseGrant>, z.ZodTypeDef, unknown> = z.record(
  sheetId,
  z.union([z.number().finite().gt(0).max(10000), z.object({ add: z.number().finite().gt(0).max(10000) }).strict()]),
);

/** What standing in a zone does to whoever is there (1.179), and what it stops. */
export interface RulesetZoneInside {
  conditions?: string[];
  immune?: string[];
}
const uniqueIds = (max: number) =>
  z
    .array(sheetId)
    .min(1)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, { message: "Each is named once" });
const componentIdsSchema: z.ZodType<string[], z.ZodTypeDef, unknown> = uniqueIds(6);
export interface RulesetCombatComponent {
  id: string;
  label: string;
}
const combatComponentsSchema: z.ZodType<RulesetCombatComponent[], z.ZodTypeDef, unknown> = z
  .array(z.object({ id: sheetId, label }).strict())
  .min(1)
  .max(8);
const zoneInsideSchema: z.ZodType<RulesetZoneInside, z.ZodTypeDef, unknown> = z
  .object({
    conditions: uniqueIds(8).optional(),
    immune: z.array(promptSafeText(40)).min(1).max(12).optional(),
  })
  .strict()
  .refine((inside) => inside.conditions !== undefined || inside.immune !== undefined, {
    message: "Say what standing inside does: conditions, immune or both",
  });
export interface RulesetForbids {
  components: string[];
}
const forbidsSchema: z.ZodType<RulesetForbids, z.ZodTypeDef, unknown> = z.object({ components: uniqueIds(8) }).strict();
export interface RulesetZoneWards {
  catalogs: string[];
  maxLevel: number;
  by?: "base" | "paid";
  maxLevelPerCostStep?: number;
}
const zoneWardsSchema: z.ZodType<RulesetZoneWards, z.ZodTypeDef, unknown> = z
  .object({
    catalogs: uniqueIds(8),
    maxLevel: z.number().int().min(0).max(20),
    /** Which level of what is cast it compares (Capability API 1.181): the level it was paid at
     *  (the default), or its own base level however it was paid, as 5e's Globe of Invulnerability
     *  keeps out a spell of 5th level or lower "even if cast using a higher level spell slot". */
    by: z.enum(["base", "paid"]).optional(),
    /** It keeps out this many levels more for each step its own cast was paid above its base
     *  (Capability API 1.181): Globe, one higher for each slot level above 6th. */
    maxLevelPerCostStep: z.number().int().min(1).max(10).optional(),
  })
  .strict();

/** A wall in sections that are struck and broken one by one (Capability API 1.200). */
export interface RulesetZoneSections {
  every: number;
  health: number;
  defense: number;
  vulnerable?: string[];
  resist?: string[];
  immune?: string[];
  broken?: {
    triggers: Array<"enter" | "turn-start" | "turn-end">;
    amount: { dice?: string; flat?: number };
    damageType?: string;
    save?: string;
    onSave?: "half" | "none";
    perCostStep?: { dice?: string; flat?: number };
  };
}

const zoneSectionsSchema: z.ZodType<RulesetZoneSections, z.ZodTypeDef, unknown> = z
  .object({
    every: z.number().finite().gt(0),
    health: z.number().int().min(1).max(100000),
    defense: z.number().int().min(0).max(1000),
    vulnerable: z.array(promptSafeText(40)).min(1).max(16).optional(),
    resist: z.array(promptSafeText(40)).min(1).max(16).optional(),
    immune: z.array(promptSafeText(40)).min(1).max(16).optional(),
    broken: z
      .object({
        triggers: z
          .array(z.enum(["enter", "turn-start", "turn-end"]))
          .min(1)
          .max(3)
          .refine((triggers) => new Set(triggers).size === triggers.length, { message: "A trigger is named once" }),
        amount: z
          .object(catalogAmountShape)
          .strict()
          .refine((amount) => amount.dice !== undefined || amount.flat !== undefined, {
            message: "What a broken section deals names dice or a flat number",
          }),
        damageType: promptSafeText(40).optional(),
        save: sheetId.optional(),
        onSave: z.enum(["half", "none"]).optional(),
        /** Added once for each step the cast was paid above its base (Capability API 1.201), as the
         *  entry's own `perCostStep` is: 5e's Wall of Ice, 1d6 more a slot level above 6th. */
        perCostStep: z.object(catalogAmountShape).strict().optional(),
      })
      .strict()
      .refine((broken) => broken.onSave === undefined || broken.save !== undefined, {
        message: '"onSave" says what a "save" does, so it has one',
      })
      .optional(),
  })
  .strict();

export interface RulesetCatalogZone {
  /** How it looks on a fight's board (1.333): `bz_<name>` in the board's pack. */
  art?: string;
  rounds: number;
  untilLair?: true;
  anchor?: "point" | "caster";
  carried?: "own" | "any";
  triggers: Array<"enter" | "turn-start" | "turn-end">;
  atCast?: boolean;
  move?: { budget: string; distance: number; ram?: true };
  drift?: { distance: number };
  turn?: { budget: string };
  terrain?: {
    difficult?: true;
    costTimes?: number;
    halvesSpeed?: true;
    towardCaster?: true;
    perDistance?: { every: number; amount: { dice?: string; flat?: number }; damageType?: string };
  };
  breaksConcentration?: true;
  damageCap?: number;
  damageType?: string;
  whileHeld?: { condition: string; amount: { dice?: string; flat?: number }; damageType?: string };
  blocks?: Array<"move" | "sight">;
  side?: { distance: number; triggers: Array<"enter" | "turn-start" | "turn-end"> };
  sections?: RulesetZoneSections;
  obscures?: RulesetSeenThrough;
  disperses?: true;
  lights?: RulesetLightRadius;
  dispelsDark?: { upTo: number; within?: number };
  dispelsLight?: { upTo: number };
  inside?: RulesetZoneInside;
  forbids?: RulesetForbids;
  wards?: RulesetZoneWards;
  detonates?: { grows?: { dice?: string; flat?: number }; touched?: true };
  burns?: { by: string[]; amount?: { dice?: string; flat?: number }; damageType?: string };
}

/** What a creature's action does to the ground (Capability API 1.324): the tactical terrains, a
 *  height of 0 to 3, a cell's own light or obscurement (`clear` takes it off), growth, a season. */
export interface RulesetCreatureGround {
  terrain?: "plains" | "forest" | "mountain" | "ruin" | "water" | "wall";
  height?: number;
  light?: "bright" | "dim" | "dark" | "sunlight" | "clear";
  obscured?: "light" | "heavy" | "clear";
  growth?: boolean;
  season?: string | null;
  tell?: string;
  occupants?: "stay" | "shove";
}
const creatureGroundSchema: z.ZodType<RulesetCreatureGround, z.ZodTypeDef, unknown> = z
  .object({
    terrain: z.enum(["plains", "forest", "mountain", "ruin", "water", "wall"]).optional(),
    height: z.number().int().min(0).max(3).optional(),
    light: z.enum(["bright", "dim", "dark", "sunlight", "clear"]).optional(),
    obscured: z.enum(["light", "heavy", "clear"]).optional(),
    growth: z.boolean().optional(),
    season: z.union([z.string().trim().min(1).max(40), z.null()]).optional(),
    tell: promptSafeText(200).optional(),
    /** Whoever stands where its terrain turns to ground nobody stands on (Capability API 1.332):
     *  `shove`d to the nearest open cell (the default), or left to `stay` in it, fallen through the
     *  ice into the water. */
    occupants: z.enum(["stay", "shove"]).optional(),
  })
  .strict()
  .refine((change) => Object.keys(change).some((key) => key !== "occupants" && key !== "tell"), {
    message: "A change to the ground changes something",
  })
  .refine((change) => change.occupants === undefined || change.terrain !== undefined, {
    message: '"occupants" says what becomes of whoever stands where the terrain changes, so it needs a "terrain"',
    path: ["occupants"],
  });

const catalogZoneSchema: z.ZodType<RulesetCatalogZone, z.ZodTypeDef, unknown> = z
  .object({
    /** How it looks on a fight's board (Capability API 1.333): a tile of the board's pack, `bz_` and
     *  lowercase words joined by _ (`bz_fog`, `bz_wall_of_fire`), drawn on every cell it covers. */
    art: z
      .string()
      .max(60)
      .regex(/^bz_[a-z0-9]+(?:_[a-z0-9]+)*$/, "A zone's art is bz_ then lowercase words joined by _")
      .optional(),
    rounds: z.number().int().min(1).max(1000),
    /** It ends as its maker's lair count next comes round (Capability API 1.324), if `rounds` has
     *  not ended it first: "until the next lair action", The Owed's Freezing Fog. */
    untilLair: z.literal(true).optional(),
    anchor: z.enum(["point", "caster"]).optional(),
    /** Cast on a thing somebody holds (Capability API 1.301), it is carried with them: a burst put on
     *  a cell its caster stands on (`own`), or on anybody's (`any`), moves with whoever stands
     *  there. Put on an empty cell, it stays there. 5e's Darkness and Daylight on an object. */
    carried: z.enum(["own", "any"]).optional(),
    triggers: z
      .array(z.enum(["enter", "turn-start", "turn-end"]))
      .max(3)
      .refine((triggers) => new Set(triggers).size === triggers.length, { message: "A trigger is named once" }),
    atCast: z.boolean().optional(),
    /** Its caster may move it on their turn (Capability API 1.173), spending `budget`, up to
     *  `distance` in the catalog's unit: 5e's Moonbeam and Flaming Sphere. */
    move: z
      .object({
        budget: sheetId,
        distance: z.number().finite().gt(0),
        /** Moved into a creature, it stops for the turn and catches them (Capability API 1.175),
         *  in place of `enter`: 5e's Flaming Sphere rammed into a creature. */
        ram: z.literal(true).optional(),
      })
      .strict()
      .optional(),
    /** Its caster may turn it to blast another way on their turn (Capability API 1.182), spending
     *  `budget`: a line or cone that moves with them, as 5e's Gust of Wind on a bonus action. */
    turn: z.object({ budget: sheetId }).strict().optional(),
    /** It does nothing where it stands until it goes off (Capability API 1.183): when it ends, by its
     *  concentration ending or its rounds running out, it does the entry's own effect once to
     *  everybody in it. Its amount `grows` by this at the end of each of its caster's turns, and
     *  `touched` sets it off when somebody moves onto its middle and fails the entry's save: 5e's
     *  Delayed Blast Fireball. */
    detonates: z
      .object({
        grows: z
          .object(catalogAmountShape)
          .strict()
          .refine((amount) => amount.dice !== undefined || amount.flat !== undefined, {
            message: '"grows" names dice, a flat amount, or both',
          })
          .optional(),
        touched: z.literal(true).optional(),
      })
      .strict()
      .refine((detonates) => detonates.grows || detonates.touched, {
        message: '"detonates" says how it "grows", that it goes off when "touched", or both',
      })
      .optional(),
    /** Damage of one of these types reaching it sets it alight (Capability API 1.183): it burns away
     *  by the time its caster's turn comes round again, dealing `amount` with no save to whoever
     *  starts a turn in it meanwhile. 5e's Web, burning for 2d4 fire. */
    burns: z
      .object({
        by: z.array(promptSafeText(40)).min(1).max(8),
        amount: z.object(catalogAmountShape).strict().optional(),
        damageType: promptSafeText(40).optional(),
      })
      .strict()
      .optional(),
    /** It moves `distance` straight away from its caster as each of their turns starts (1.173):
     *  5e's Cloudkill. */
    drift: z
      .object({ distance: z.number().finite().gt(0) })
      .strict()
      .optional(),
    /** What its ground does to whoever moves through it (1.173): `difficult` costs double to move
     *  into, and `perDistance` deals `amount` for every `every` moved inside, with no save
     *  (5e's Spike Growth). */
    terrain: z
      .object({
        difficult: z.literal(true).optional(),
        /** Moving into it costs this many times a plain step, instead of double (1.175): 5e's Plant
         *  Growth, 4. Ground already hard going costs no more than this. */
        costTimes: z.number().int().min(2).max(10).optional(),
        /** Speed is halved inside it (1.175), on top of any hard going: 5e's Spirit Guardians. */
        halvesSpeed: z.literal(true).optional(),
        /** Its hard going counts only for a step that brings the mover nearer its caster
         *  (Capability API 1.182): 5e's Gust of Wind, 2 feet for every 1 moving closer. */
        towardCaster: z.literal(true).optional(),
        perDistance: z
          .object({
            every: z.number().finite().gt(0),
            amount: z.object(catalogAmountShape).strict(),
            damageType: promptSafeText(40).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .refine((terrain) => terrain.difficult || terrain.costTimes || terrain.halvesSpeed || terrain.perDistance, {
        message: '"terrain" says "difficult", "costTimes", "halvesSpeed", "perDistance" or several',
      })
      .refine((terrain) => !(terrain.difficult && terrain.costTimes), {
        message: '"costTimes" is its own price for the ground, so it is not also "difficult"',
      })
      .optional(),
    /** Whoever it catches while concentrating makes the ruleset's concentration save against the
     *  entry's own save difficulty, or loses it (Capability API 1.174): 5e's Sleet Storm. */
    breaksConcentration: z.literal(true).optional(),
    /** Whoever starts a turn in it already held by this condition from its caster takes this, with no
     *  save, in place of its effect (Capability API 1.175): 5e's Black Tentacles, 3d6 bludgeoning to
     *  a creature it already restrains. */
    whileHeld: z
      .object({
        condition: sheetId,
        amount: z.object(catalogAmountShape).strict(),
        damageType: promptSafeText(40).optional(),
      })
      .strict()
      .optional(),
    /** It ends once it has dealt this much damage in all (1.174): 5e's Guardian of Faith, 60. */
    damageCap: z.number().int().min(1).max(100000).optional(),
    /** What it deals when it catches somebody at one of its triggers is this type in place of the
     *  entry's own (Capability API 1.198); as it appears it deals the entry's own. 5e's Wall of
     *  Thorns: piercing to whoever it appears around, slashing to whoever moves into it. */
    damageType: promptSafeText(40).optional(),
    /** Nobody sees into it, out of it or through it (Capability API 1.178) but with one of the senses
     *  `pierced` names, within that sense's range: 5e's Fog Cloud and Darkness (pierced by nothing
     *  but blindsight and truesight), or a plain darkness darkvision sees through. */
    obscures: seenThroughSchema.optional(),
    /** The light it sheds (Capability API 1.297) over its own cells: bright within `bright` of its
     *  middle (the point it is centred on, or its caster), dim in the rest. 5e's Daylight is a
     *  120-foot sphere with `{ "bright": 60, "dim": 60 }`; a bullseye lantern a 120-foot cone held by
     *  its caster, `{ "bright": 60, "dim": 60 }`; Dancing Lights' one glowing form a 10-foot sphere
     *  moved with the spell, `{ "bright": 0, "dim": 10 }`. Read where `combat.sight.darkness` makes
     *  the dark real. */
    lights: lightRadiusSchema.optional(),
    /** Magical darkness (an `obscures` with `darkness`) of this level or lower ends where it meets
     *  this zone (Capability API 1.297), as it appears or moves: 5e's Daylight, `{ "upTo": 3 }`. */
    dispelsDark: z
      .object({
        upTo: z.number().int().min(0).max(20),
        /** Only darkness this near its middle (Capability API 1.299), in the ruleset's distance: 5e's
         *  Daylight dispels what its 60-foot bright sphere meets, not its dim light beyond. */
        within: z.number().finite().gt(0).max(10000).optional(),
      })
      .strict()
      .optional(),
    /** Magical darkness that puts out spell light (Capability API 1.299): every light a spell of this
     *  level or lower made (a zone's `lights`, or a condition's `light` a spell put on) that meets it
     *  ends, as either appears or moves. 5e's Darkness, `{ "upTo": 2 }`. Only magical light lights
     *  any magical darkness's cells. */
    dispelsLight: z
      .object({ upTo: z.number().int().min(0).max(20) })
      .strict()
      .optional(),
    /** A wind (Capability API 1.286): every obscuring zone that is `dispersed` ends where this one
     *  reaches it, as it appears, moves or turns: 5e's Gust of Wind on a Fog Cloud. */
    disperses: z.literal(true).optional(),
    /** Whoever stands in it has these conditions and shrugs off these damage types while there
     *  (Capability API 1.179): 5e's Silence deafens and keeps thunder out. */
    inside: zoneInsideSchema.optional(),
    /** Nothing needing these components is used from inside it (1.179): Silence, no verbal spell. */
    forbids: forbidsSchema.optional(),
    /** What is cast from outside it at this level or lower, off these catalogs, does not reach whoever
     *  is inside (1.179): 5e's Globe of Invulnerability, spells of 5th level or lower. */
    wards: zoneWardsSchema.optional(),
    /** A wall that nobody walks through, sees through, or both (Capability API 1.177): 5e's Wall of
     *  Stone and Wall of Ice block both, Wall of Force movement only, Wall of Fire sight only. */
    blocks: z
      .array(z.enum(["move", "sight"]))
      .min(1)
      .max(2)
      .refine((blocks) => new Set(blocks).size === blocks.length, { message: "Each is named once" })
      .optional(),
    /** The wall stands in sections `every` long (Capability API 1.200), each struck at like a creature
     *  with this `defense` and `health`, taking double, half or none of the damage types it is
     *  `vulnerable` to, `resist`s or is `immune` to. One brought to 0 is broken: it stops blocking,
     *  and its cells catch whoever is there at the `broken` triggers with that amount, saved against
     *  with its `save` at the entry's own difficulty. 5e's Wall of Ice: 10-foot panels, AC 12, 30 hit
     *  points, vulnerable to fire, leaving frigid air that deals 5d6 cold on a Constitution save. */
    sections: zoneSectionsSchema.optional(),
    /** A wall's one side, chosen as it is cast (1.177): the cells within `distance` of it on that
     *  side catch as `triggers` say, beside the wall's own. 5e's Wall of Fire, 10 ft, turn-end. */
    side: z
      .object({
        distance: z.number().finite().gt(0),
        triggers: z
          .array(z.enum(["enter", "turn-start", "turn-end"]))
          .min(1)
          .max(3)
          .refine((triggers) => new Set(triggers).size === triggers.length, { message: "A trigger is named once" }),
      })
      .strict()
      .optional(),
  })
  .strict();

/** One catalog entry, named the way a sheet row points at it: `<catalog>/<entry>`. */
const catalogEntryRef = z
  .string()
  .max(121)
  .regex(
    /^[a-z][a-z0-9_]*\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "An entry is named <catalog>/<entry>, as `spells/magic-missile`",
  );

/** What opens a moment for a reaction: an action from an entry of one of these catalogs, or one of
 *  these entries by name (Capability API 1.117). Either matching is enough. */
const rulesetReactionAgainstSchema = z
  .object({
    catalogs: z.array(sheetId).min(1).max(12).optional(),
    entries: z.array(catalogEntryRef).min(1).max(12).optional(),
    actions: z.array(z.string().trim().min(1).max(80)).min(1).max(12).optional(),
  })
  .strict()
  .refine(
    (against) => against.catalogs !== undefined || against.entries !== undefined || against.actions !== undefined,
    {
      message: '"against" names catalogs, entries or both, or creature actions',
    },
  );

/** Attacks named the way their rows name them, matched without case (Capability API 1.242): 5e's
 *  Unarmed Strike and the monk weapons. */
const attackNamesSchema = z.array(promptSafeText(80)).min(1).max(30);

/** What else narrows a moment (Capability API 1.118): `blow` answers only a hit struck in reach
 *  (`melee`) or from afar (`ranged`), and `seesSource` only while its holder sees whoever caused it.
 *  5e's Parry is both. `by: "self"` (Capability API 1.241) answers its holder's OWN attack hitting,
 *  aimed at whoever it hit, and `weapon` only a weapon's blow: 5e's Divine Smite and Stunning Strike. */
const rulesetMomentNarrowing = {
  for: z.enum(["self", "ally", "any"]).optional(),
  within: z.number().finite().min(0).optional(),
  blow: z.enum(["melee", "ranged"]).optional(),
  seesSource: z.literal(true).optional(),
  by: z.literal("self").optional(),
  weapon: z.literal(true).optional(),
  /** Only a hit by an attack named so (Capability API 1.245): 5e's Quivering Palm, on an unarmed
   *  strike. */
  names: attackNamesSchema.optional(),
  /** Only a hit by a strike paid for from this budget (Capability API 1.248): 5e's Open Hand
   *  Technique, on the strikes Flurry of Blows grants. */
  budget: sheetId.optional(),
};
const blowOnlyOnHit = (
  moment: {
    on: string;
    blow?: string;
    by?: string;
    weapon?: true;
    names?: string[];
    budget?: string;
    for?: string;
    within?: number;
  },
  ctx: z.RefinementCtx,
  path: (string | number)[],
) => {
  if (moment.blow && moment.on !== "hit") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, "blow"],
      message: '"blow" says what kind of hit opens the moment, so it is on a "hit" moment',
    });
  }
  for (const key of ["by", "weapon", "names", "budget"] as const) {
    if (moment[key] !== undefined && moment.on !== "hit") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, key],
        message: `"${key}" narrows a hit, so it is on a "hit" moment`,
      });
    }
  }
  if (moment.by && (moment.for !== undefined || moment.within !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, "by"],
      message: 'A reaction to its holder\'s own hit answers for nobody: "by" goes without "for" and "within"',
    });
  }
};

const rulesetReactionMomentBase = z
  .object({
    on: z.enum(["aimed", "hit", "harmed", "used", "falls", "turn-start"]),
    at: z.enum(["source", "chosen", "target"]).default("source"),
    ...rulesetMomentNarrowing,
    /** Stops what opened the window from happening at all. Only a moment BEFORE something resolves
     *  may be answered that way: what has already happened cannot be called off, and a roll that
     *  has already hit is changed by what the answer does to the numbers, not undone. */
    cancels: z.literal(true).optional(),
    cancelSave: z
      .object({ save: sheetId, dc: z.number().int().min(1).max(1000) })
      .strict()
      .optional(),
    against: rulesetReactionAgainstSchema.optional(),
    /** More moments it may be taken at, each with its own `against` (Capability API 1.117): 5e's
     *  Shield, taken when an attack hits AND when Magic Missile is aimed at its caster. Only the
     *  first moment may cancel, so a reaction that cancels has none. */
    also: z
      .array(
        z
          .object({
            on: z.enum(["aimed", "hit", "harmed", "used", "falls", "turn-start"]),
            against: rulesetReactionAgainstSchema.optional(),
            ...rulesetMomentNarrowing,
          })
          .strict(),
      )
      .min(1)
      .max(3)
      .optional(),
    /** It stops only what was paid for no higher up its pool family than it was itself (Capability
     *  API 1.116): 5e's Counterspell, which stops a spell of its own slot's level or lower. */
    upTo: z.literal("paid").optional(),
    /** Only one of its holder's answers sharing this name is taken at each of their own hits
     *  (Capability API 1.248): Open Hand Technique's three riders, one per hit. */
    oneOf: z.string().trim().min(1).max(60).optional(),
    /** Above that, a check against `dc` plus the level of what it answers stops it all the same:
     *  5e's spellcasting ability check against 10 + the spell's level. */
    above: z
      .object({ check: rulesetValueRefSchema, dc: z.number().int().min(0).max(1000) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((reaction, ctx) => {
    if (
      reaction.cancels &&
      (reaction.on === "harmed" || reaction.on === "hit" || reaction.on === "falls" || reaction.on === "turn-start")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only an "aimed" or "used" reaction cancels: what has already happened cannot be called off',
      });
    }
    if (reaction.upTo && (!reaction.cancels || reaction.on !== "used")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["upTo"],
        message: '"upTo" says how much a "used" reaction that cancels can stop, so it needs both',
      });
    }
    if (reaction.cancelSave && !reaction.cancels) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cancelSave"], message: '"cancelSave" needs "cancels"' });
    }
    [reaction, ...(reaction.also ?? [])].forEach((moment, index) => {
      const path = index === 0 ? [] : ["also", index - 1];
      if (moment.for && moment.for !== "self") {
        if (moment.on !== "aimed" && moment.on !== "hit")
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "for"],
            message: 'Only "aimed" and "hit" moments answer for others',
          });
        if (moment.within === undefined)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "within"],
            message: 'Answering for others needs "within"',
          });
      }
      if (moment.on === "turn-start" && moment.against)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, "against"],
          message: 'A "turn-start" moment has no action to answer with "against"',
        });
    });
    // A fall has no source entry or blow to narrow (Capability API 1.124).
    [reaction, ...(reaction.also ?? [])].forEach((moment, index) => {
      if (moment.on !== "falls") return;
      for (const key of ["blow", "seesSource", "against"] as const) {
        if (moment[key] === undefined) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...(index === 0 ? [] : ["also", index - 1]), key],
          message: `A "falls" reaction has no source entry, so it cannot carry "${key}"`,
        });
      }
    });
    blowOnlyOnHit(reaction, ctx, []);
    reaction.also?.forEach((moment, index) => blowOnlyOnHit(moment, ctx, ["also", index]));
    if (reaction.also && reaction.cancels) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["also"],
        message: 'A reaction that cancels answers one moment: "also" is for one that changes the numbers',
      });
    }
    if (reaction.oneOf && (reaction.on !== "hit" || reaction.by !== "self" || reaction.also)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["oneOf"],
        message: '"oneOf" picks among answers to its holder\'s own hit: on "hit", by "self", with no "also"',
      });
    }
    if (reaction.above && !reaction.upTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["above"],
        message: '"above" is the check for what is past "upTo", so it needs "upTo"',
      });
    }
  });
/** Named, so the schemas built around it stay short enough for the compiler to write. */
export type RulesetReactionMomentDeclaration = z.infer<typeof rulesetReactionMomentBase>;
const rulesetReactionMomentSchema: z.ZodType<RulesetReactionMomentDeclaration, z.ZodTypeDef, unknown> =
  rulesetReactionMomentBase;

/** How many SECOND amounts one blow may carry beside its first. Three, because a blow written as a
 *  list of four separate things is a blow nobody at a table could read out. */
export const RULESET_DAMAGE_MAX_PLUS = 3;

/** The save one clause asks the TARGET for, on top of whatever the action itself asked. `difficulty`
 *  is the clause's own number; without one it falls back to the action's, and then to the number the
 *  source it came from rolls saves against. `onSuccess` says what a success leaves of THIS clause:
 *  nothing at all, or half of it. (The action's own `save` uses the same word for something else:
 *  there "none" means the save changes nothing. A clause is only ever rolled against to take
 *  something off it, so it has no third value.) */
const catalogClauseSaveSchema = z
  .object({
    save: sheetId,
    difficulty: z.number().int().min(0).max(1000).optional(),
    onSuccess: z.enum(["none", "half"]),
  })
  .strict();

/** What a target is (Capability API 1.168): one of these `combat.creatureTypes` types, or carrying
 *  one of these tags. Any one match passes; a combatant with no type and no tags never does. */
export interface RulesetTargetIs {
  types?: string[];
  tags?: string[];
}
const targetIsSchema: z.ZodType<RulesetTargetIs, z.ZodTypeDef, unknown> = z
  .object({
    types: z.array(sheetId).min(1).max(20).optional(),
    tags: z.array(sheetId).min(1).max(20).optional(),
  })
  .strict()
  .refine((test) => test.types !== undefined || test.tags !== undefined, {
    message: "A target test names types, tags or both",
  });

/** One more amount on the same blow, rolled and typed on its own: "and 2d6 fire", "and 1d6 poison
 *  the target may shake off". Never a second attack roll: a clause rides the blow that carried it. */
const catalogPlusClauseSchema = z
  .object({
    dice: catalogDice.optional(),
    flat: z.number().int().min(-1000).max(10000).optional(),
    type: promptSafeText(40).optional(),
    save: catalogClauseSaveSchema.optional(),
    /** Dealt only to a target that is this (Capability API 1.168): a dragon slayer's "+3d6 against
     *  dragons", a holy avenger's radiant against fiends and undead. */
    targetIs: targetIsSchema.optional(),
  })
  .strict()
  .superRefine((clause, ctx) => {
    if (clause.dice === undefined && clause.flat === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A clause names dice, a flat amount, or both" });
    }
  });

/** A value read off a sheet, at least `atLeast` and at most `atMost`, one bound or both: when a
 *  catalog entry's mechanics may be used in a fight (`usableWhen`, Capability API 1.166), and when
 *  one condition it applies goes on (`when`, Capability API 1.167). `key` names it in the errors. */
function sheetBoundsSchema(key: string, never: string) {
  return z
    .object({
      value: rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
      atLeast: z.number().finite().optional(),
      atMost: z.number().finite().optional(),
    })
    .strict()
    .refine((when) => when.atLeast !== undefined || when.atMost !== undefined, {
      message: `"${key}" says at least one of "atLeast" and "atMost"`,
    })
    .refine((when) => when.atLeast === undefined || when.atMost === undefined || when.atLeast <= when.atMost, {
      message: `"atLeast" is above "atMost", so it is never ${never}`,
      path: ["atMost"],
    });
}

const catalogUsableWhenSchema = sheetBoundsSchema("usableWhen", "usable");

/** Held weapons that are these (Capability API 1.244): one of `names`, the name its attack goes by,
 *  or carrying every one of `tags` and none of `notTags`. 5e's monk weapons are the shortsword and
 *  the simple melee weapons that are neither two-handed nor heavy, magic ones included. */
export interface RulesetItemMatchDeclaration {
  names?: string[];
  tags?: string[];
  notTags?: string[];
}
const itemMatchSchema: z.ZodType<RulesetItemMatchDeclaration, z.ZodTypeDef, unknown> = z
  .object({
    names: attackNamesSchema.optional(),
    tags: z.array(sheetId).min(1).max(8).optional(),
    notTags: z.array(sheetId).min(1).max(8).optional(),
  })
  .strict()
  .refine((match) => match.names || match.tags || match.notTags, {
    message: 'An item match names "names", "tags" or "notTags"',
  });

/** Only once its holder has taken the attack action this turn: any attack made with an attack's
 *  own budget, or one of `names` (Capability API 1.242). 5e's Martial Arts bonus strike and Flurry of
 *  Blows. */
export type RulesetAfterAttackDeclaration = true | { names?: string[]; items?: RulesetItemMatchDeclaration };
const afterAttackSchema: z.ZodType<RulesetAfterAttackDeclaration, z.ZodTypeDef, unknown> = z.union([
  z.literal(true),
  z
    .object({
      names: attackNamesSchema.optional(),
      /** Or with a held weapon that is these (Capability API 1.246): a dagger +1 is a monk weapon. */
      items: itemMatchSchema.optional(),
    })
    .strict()
    .refine((after) => after.names || after.items, { message: '"afterAttack" names "names", "items" or both' }),
]);

/** Only while every weapon its holder holds is one of `only` (Capability API 1.244), or none is held:
 *  5e's "unarmed or wielding only monk weapons". */
export interface RulesetWieldingDeclaration {
  only: RulesetItemMatchDeclaration;
}
const wieldingSchema: z.ZodType<RulesetWieldingDeclaration, z.ZodTypeDef, unknown> = z
  .object({ only: itemMatchSchema })
  .strict();

/** A strike its holder may buy with `budget` once an attack's own budget is spent (Capability API
 *  1.242), as a condition's `grants.attacks` gives one: only with the attacks `names` names, in reach
 *  with `melee`, and `afterAttack` only once the attack action has been taken this turn. `when` and
 *  `wielding` (Capability API 1.244) keep it only while its holder's sheet and weapons say so: 5e's
 *  Martial Arts bonus strike is not made in armour. */
export interface RulesetStrikeGrantDeclaration {
  budget: string;
  names?: string[];
  melee?: true;
  afterAttack?: RulesetAfterAttackDeclaration;
  when?: { value: RulesetValueRef; atLeast?: number; atMost?: number };
  wielding?: RulesetWieldingDeclaration;
}
const catalogStrikeGrantSchema: z.ZodType<RulesetStrikeGrantDeclaration, z.ZodTypeDef, unknown> = z
  .object({
    budget: sheetId,
    names: attackNamesSchema.optional(),
    melee: z.literal(true).optional(),
    afterAttack: afterAttackSchema.optional(),
    when: sheetBoundsSchema("when", "held").optional(),
    wielding: wieldingSchema.optional(),
  })
  .strict();

/** What holding the entry does to the attacks its sheet's rows make (Capability API 1.242), while
 *  `when` holds: the best of the row's own ability and `abilities` to hit and to damage, a die of
 *  `die` sides (read off the sheet by step) in place of the row's dice where it is the better, and
 *  `qualities` its blows carry past a resistance. 5e's Martial Arts and Ki-Empowered Strikes. */
export interface RulesetAttackRowsDeclaration {
  names?: string[];
  items?: RulesetItemMatchDeclaration;
  abilities?: string[];
  die?: { from: RulesetValueRef; table: Array<[number, number]> };
  qualities?: string[];
  when?: { value: RulesetValueRef; atLeast?: number; atMost?: number };
  wielding?: RulesetWieldingDeclaration;
}
const catalogAttackRowsSchema: z.ZodType<RulesetAttackRowsDeclaration, z.ZodTypeDef, unknown> = z
  .object({
    /** Rows and held weapons whose attack goes by one of these names. */
    names: attackNamesSchema.optional(),
    /** Held weapons that are these, whatever they are called (Capability API 1.244): a monk's
     *  quarterstaff, or a dagger +1. */
    items: itemMatchSchema.optional(),
    abilities: z.array(sheetId).min(1).max(6).optional(),
    die: z
      .object({
        from: rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
        table: stepTableSchema,
      })
      .strict()
      .optional(),
    qualities: z.array(sheetId).min(1).max(8).optional(),
    when: sheetBoundsSchema("when", "held").optional(),
    /** Only while every weapon held is one of these, or none is (Capability API 1.244). */
    wielding: wieldingSchema.optional(),
  })
  .strict()
  .refine((rule) => rule.abilities || rule.die || rule.qualities, {
    message: '"attackRows" changes something: "abilities", "die" or "qualities"',
  })
  .refine((rule) => rule.names || rule.items, {
    message: '"attackRows" names the attacks it changes: "names", "items" or both',
  });

/** The generic actions the kind implements, named once so a ruleset opts into the ones it has. Up
 *  here rather than beside the combat block because a catalog entry names them too: an ability that
 *  lets its holder buy one of them with another budget says which ones. */
/** `search` (Capability API 1.287) looks for whoever is hiding: see `combat.hiding`. */
const combatStandardActionSchema = z.enum(["dash", "disengage", "dodge", "help", "hide", "ready", "search"]);

const hidingTraitFields = {
  /** It may hide behind somebody at least one size larger than it, as behind anything else that
   *  keeps it from being seen clearly: a halfling's Naturally Stealthy. Needs `combat.sizes`. */
  behindLarger: z.literal(true).optional(),
  /** Added to its Stealth total as it hides, and taken off again once it moves or takes an action:
   *  a ranger's Hide in Plain Sight, `10`. */
  still: z.number().int().min(1).max(20).optional(),
  /** `still` counts only while its holder holds `holds` (a camouflage made beforehand) and, with
   *  `wall`, stands pressed against something that blocks sight (Capability API 1.309): a ranger's
   *  Hide in Plain Sight, "against a solid surface, such as a tree or wall". */
  stillWhile: z
    .object({ holds: sheetId.optional(), wall: z.literal(true).optional() })
    .strict()
    .refine((rule) => rule.holds !== undefined || rule.wall, {
      message: 'Say what "stillWhile" needs: "holds" or "wall"',
    })
    .optional(),
  /** Not seeing whom it attacks puts no disadvantage on its attacks (Capability API 1.309): a
   *  ranger's Feral Senses. */
  unseenStrikes: z.literal(true).optional(),
  /** Its Hide is rolled so when it has moved no more than half its speed this turn: a thief's
   *  Supreme Sneak, `"advantage"`. */
  slow: z.literal("advantage").optional(),
  /** Nobody within this distance, in the ruleset's own unit, is hidden from it, unless it has one
   *  of `lostWith` (a rogue's Blindsense, 10 feet, lost while deafened). */
  aware: z
    .object({
      within: z.number().finite().gt(0).max(10000),
      lostWith: z.array(sheetId).min(1).max(8).optional(),
    })
    .strict()
    .optional(),
};
/** Ways of hiding and of finding the hidden that are their holder's own (Capability API 1.292), read
 *  where `combat.hiding` hides for real. */
const hidingTraitsSchema = z
  .object(hidingTraitFields)
  .strict()
  .refine((traits) => Object.keys(traits).length > 0, { message: "hiding names at least one way of hiding" })
  .refine((traits) => !traits.stillWhile || traits.still !== undefined, {
    message: '"stillWhile" goes with "still"',
    path: ["stillWhile"],
  });
/** A creature's, which may also begin the fight hidden (`starts`, the total it hides with until it
 *  moves or gives itself away, from whoever's passive Perception does not beat it, seen clearly or
 *  not: a gelatinous cube's Transparent, `15`). */
const creatureHidingTraitsSchema = z
  .object({
    ...hidingTraitFields,
    starts: z.number().int().min(1).max(60).optional(),
    /** Whoever it begins the fight hidden from begins it surprised (Capability API 1.309): a gelatinous
     *  cube's Transparent, which surprises a creature unaware of it. */
    surprises: z.literal(true).optional(),
  })
  .strict()
  .refine((traits) => Object.keys(traits).length > 0, { message: "hiding names at least one way of hiding" })
  .refine((traits) => !traits.stillWhile || traits.still !== undefined, {
    message: '"stillWhile" goes with "still"',
    path: ["stillWhile"],
  })
  .refine((traits) => !traits.surprises || traits.starts !== undefined, {
    message: '"surprises" goes with "starts"',
    path: ["surprises"],
  });
export const RULESET_COMBAT_STANDARD_ACTIONS = combatStandardActionSchema.options;

/** How long a condition an entry applies lasts. `until-save` has no clock of its own, so it needs
 *  the save that ends it beside it, or nothing would ever take it off again. Rounds count the
 *  holder's own turns down as each one ENDS; `at: "turn-start"` counts them as each one begins, which
 *  is how "until the start of your next turn" is said. */
const catalogDurationSchema = z.union([
  z.literal("instant"),
  z.literal("until-save"),
  z.literal("this-action"),
  z
    .object({
      rounds: z.number().int().min(1).max(1000),
      at: z.literal("turn-start").optional(),
      /** Counted on the turns of whoever put it on, from their next one (Capability API 1.119):
       *  "until the end of your next turn", as Guiding Bolt's advantage lasts. */
      of: z.literal("source").optional(),
      /** Or until whoever put it on next comes to their lair's count, if that is sooner (Capability
       *  API 1.327): the Hour Bell's "until the next lair action". */
      untilLair: z.literal(true).optional(),
    })
    .strict(),
]);

/** What its holder does that takes a condition off (1.180). */
export interface RulesetHolderEnding {
  attacks?: true;
  casts?: string[];
  moves?: true;
  acts?: true;
  uses?: string[];
}
const holderEndingSchema: z.ZodType<RulesetHolderEnding, z.ZodTypeDef, unknown> = z
  .object({
    attacks: z.literal(true).optional(),
    casts: z
      .array(sheetId)
      .min(1)
      .max(8)
      .refine((catalogs) => new Set(catalogs).size === catalogs.length, { message: "A catalog is named once" })
      .optional(),
    /** Its holder moving (Capability API 1.303): 5e's One with Shadows. */
    moves: z.literal(true).optional(),
    /** Its holder taking any action or reaction after the one that put it on (Capability API 1.303). */
    acts: z.literal(true).optional(),
    /** Its holder using one of these (Capability API 1.307): a creature's own actions by id, or catalog
     *  entries as `<catalog>/<entry>`. A quasit's invisibility ends when it uses its Scare. */
    uses: z
      .array(z.union([catalogEntryRef, sheetId]))
      .min(1)
      .max(8)
      .refine((uses) => new Set(uses).size === uses.length, { message: "An action is named once" })
      .optional(),
  })
  .strict()
  .refine((ends) => ends.attacks || ends.casts || ends.moves || ends.acts || ends.uses, {
    message: "Say what ends it: attacking, casting, moving, acting or using one of its actions",
  });

/** Who passes a save without rolling, and what else it counts as being against (1.181). */
export interface RulesetSaveExtras {
  against?: { conditions?: string[]; damage?: string[] };
  succeeds?: { immune?: string[]; conditionImmune?: string[]; is?: RulesetTargetIs };
  modes?: Array<{ is: RulesetTargetIs; mode: (typeof RULESET_ROLL_MODES)[number] }>;
  alliesMayFail?: true;
}
const saveExtrasShape = {
  /** Its user's own side may choose to fail it (Capability API 1.278), and do: they fail without
   *  rolling, as a friend lets a spell in. 5e's Calm Emotions. */
  alliesMayFail: z.literal(true).optional(),
  /** What else the save counts as being against (Capability API 1.181), for a save modifier's
   *  `against`: 5e's Stinking Cloud is a save against poison, which a dwarf has advantage on. */
  against: z
    .object({
      conditions: z.array(sheetId).min(1).max(8).optional(),
      damage: z.array(promptSafeText(40)).min(1).max(8).optional(),
    })
    .strict()
    .refine((against) => against.conditions || against.damage, { message: "Against names conditions or damage" })
    .optional(),
  /** Who succeeds on it without rolling (Capability API 1.181): a target immune to one of these
   *  damage types or conditions, or one that is this. 5e's Stinking Cloud: immune to poison, or a
   *  creature that does not breathe. */
  succeeds: z
    .object({
      immune: z.array(promptSafeText(40)).min(1).max(8).optional(),
      conditionImmune: z.array(sheetId).min(1).max(8).optional(),
      is: targetIsSchema.optional(),
    })
    .strict()
    .refine((succeeds) => succeeds.immune || succeeds.conditionImmune || succeeds.is, {
      message: "Say who succeeds: immune to damage, to a condition, or what they are",
    })
    .optional(),
  /** A target that is this rolls it twice, keeping the better or the worse (Capability API 1.185):
   *  5e's Sunbeam, which undead and oozes save against with disadvantage. */
  modes: z
    .array(z.object({ is: targetIsSchema, mode: z.enum(["advantage", "disadvantage"]) }).strict())
    .min(1)
    .max(4)
    .optional(),
};

/** What an entry spends itself on once its holder's own roll has failed (Capability API 1.249,
 *  1.256). Typed by hand: written out, its inferred type is too long for the definition schema around
 *  it to emit. */
export interface RulesetCatalogRescue {
  roll: "attacks" | "saves" | "checks";
  by: "reroll" | "success" | "twenty" | "die";
  dice?: string;
  die?: { from: RulesetValueRef; table: Array<[number, number]> };
  saves?: string[];
  budget?: string;
}
const catalogRescueSchema: z.ZodType<RulesetCatalogRescue, z.ZodTypeDef, unknown> = z
  .object({
    roll: z.enum(["attacks", "saves", "checks"]),
    by: z.enum(["reroll", "success", "twenty", "die"]),
    dice: catalogDice.optional(),
    die: z
      .object({
        from: rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
        table: stepTableSchema,
      })
      .strict()
      .optional(),
    /** Only these saves (Capability API 1.257): a ring of evasion's Dexterity saves. */
    saves: z
      .array(sheetId)
      .min(1)
      .max(12)
      .refine((saves) => new Set(saves).size === saves.length, { message: "Saves must be unique" })
      .optional(),
    /** The budget spending it takes (Capability API 1.257): a ring of evasion's reaction. */
    budget: sheetId.optional(),
  })
  .strict()
  .refine((rescue) => rescue.saves === undefined || rescue.roll === "saves", {
    message: '"saves" narrows a rescue of "saves"',
  })
  .refine((rescue) => rescue.by !== "reroll" || rescue.roll === "saves", {
    message: 'Only a failed save is rolled again: "reroll" goes with "saves"',
  })
  .refine((rescue) => rescue.by !== "twenty" || rescue.roll === "checks", {
    message: 'Only a check counts its d20 as a 20: "twenty" goes with "checks"',
  })
  .refine((rescue) => (rescue.by === "die") === (rescue.dice !== undefined || rescue.die !== undefined), {
    message: '"die" adds "dice" or one "die" sized by a value, and only "die" does',
  })
  .refine((rescue) => rescue.dice === undefined || rescue.die === undefined, {
    message: '"die" adds "dice" or one "die" sized by a value: one of them',
  });

/** One condition a catalog entry puts on what it touches. Typed by hand: written out, its inferred type is too long for the
 *  definition schema around it to emit. */
/** A save that ends a condition, and what counting them decides (1.258). */
export interface RulesetCatalogSaveEnds {
  save: string;
  at: "turn-end" | "turn-start" | "damaged" | "action";
  successes?: number;
  failures?: { count: number; becomes: string };
  unseen?: true;
  seenLean?: "advantage" | "disadvantage";
  beyond?: number;
  bySource?: true;
}

export interface RulesetCatalogApplies {
  condition: string;
  duration: z.infer<typeof catalogDurationSchema>;
  saveEnds?: RulesetCatalogSaveEnds;
  endsAfter?: "own-attack" | "attacked" | "own-save";
  endsWhenHolder?: RulesetHolderEnding;
  endsAway?: { beyond: number; unseen?: true };
  escapeDc?: number | "save";
  escapeChecks?: string[];
  heldAtMost?: number;
  when?: z.infer<ReturnType<typeof sheetBoundsSchema>>;
  targetIs?: RulesetTargetIs;
  endsWith?: string;
  checkEnds?: { check: string; difficulty: number; passes?: RulesetTargetIs };
  harmsPerCostStep?: { dice?: string; flat?: number };
  destroysUpTo?: RulesetDestroysUpTo[];
  value?: RulesetValueRef;
}

/** How strong a creature a failed save destroys outright, by its threat tier (1.266). */
export interface RulesetDestroysUpTo {
  tier: string;
  when?: { value: RulesetValueRef; atLeast?: number; atMost?: number };
}

const catalogAppliesSchema: z.ZodType<RulesetCatalogApplies, z.ZodTypeDef, unknown> = z
  .object({
    condition: sheetId,
    duration: catalogDurationSchema,
    /** `at: "damaged"` rolls only on damage above zero, never on a turn (Capability API 1.129):
     *  5e's Dominate Person. */
    saveEnds: z
      .object({
        save: sheetId,
        /** `action` (Capability API 1.264): rolled when its holder spends their action on it, as 5e's
         *  Irresistible Dance allows. */
        at: z.enum(["turn-end", "turn-start", "damaged", "action"]),
        /** It takes this many successes, counted over the turns, to end it (Capability API 1.258):
         *  5e's Contagion, three. */
        successes: z.number().int().min(2).max(10).optional(),
        /** After this many failures it `becomes` another condition, put on in its place with no
         *  clock, and no more saves are made (Capability API 1.258): Contagion's disease setting in
         *  after three, Flesh to Stone's petrification. */
        failures: z
          .object({ count: z.number().int().min(1).max(10), becomes: sheetId })
          .strict()
          .optional(),
        /** Rolled only while its holder cannot see whoever put it on (Capability API 1.266): 5e's
         *  Fear, saved against at the end of a turn out of the caster's line of sight. */
        unseen: z.literal(true).optional(),
        /** Rolled with this lean while its holder can see whoever put it on (Capability API 1.268):
         *  a sea hag's Horrific Appearance, saved against with disadvantage while she is in sight. */
        seenLean: z.enum(["advantage", "disadvantage"]).optional(),
        /** Rolled only while its holder stands farther than this from whoever put it on, in the
         *  ruleset's distance (Capability API 1.270): Antipathy's "more than 60 feet away". */
        beyond: z.number().finite().gt(0).max(10000).optional(),
        /** With `at: "damaged"`, rolled only when the harm came from whoever put it on (Capability
         *  API 1.274): Sympathy's save when the target harms its holder. */
        bySource: z.literal(true).optional(),
      })
      .strict()
      .refine((ends) => !ends.bySource || ends.at === "damaged", {
        message: '"bySource" narrows a save rolled on damage: it goes with "at": "damaged"',
        path: ["bySource"],
      })
      .optional(),
    /** It comes off after the first of these that happens to its holder: their own next attack roll,
     *  the next attack roll made against them, or their own next save. Whatever clock it has still
     *  runs beside it, so "on its next attack before the end of its next turn" is both. */
    endsAfter: z.enum(["own-attack", "attacked", "own-save"]).optional(),
    /** It comes off once its holder has made an attack (`attacks`), or used an entry of one of the
     *  catalogs `casts` names, or an item's use that casts one (Capability API 1.180): 5e's
     *  Invisibility, which ends for a target that attacks or casts a spell. What the attack or the
     *  spell rolled still had it; whatever came after does not. */
    endsWhenHolder: holderEndingSchema.optional(),
    /** It comes off once its holder stands farther than `beyond` (the ruleset's own distance) from
     *  whoever put it on, and, with `unseen`, can no longer see them (Capability API 1.310): 5e's
     *  Eyebite, whose panicked target is free again "at least 60 feet away from you where it can no
     *  longer see you". Asked as each step of a walk ends and as each turn ends. */
    endsAway: z
      .object({ beyond: z.number().min(0).max(100000), unseen: z.literal(true).optional() })
      .strict()
      .optional(),
    /** What breaking free of it is rolled against, in place of the holder's own side of the contest
     *  that breaks free of it (Capability API 1.103): 5e's "the target is grappled (escape DC 13)".
     *  `"save"` is the save difficulty of whatever applied it (1.174): Web and Black Tentacles. */
    escapeDc: z.union([z.number().int().min(1).max(1000), z.literal("save")]).optional(),
    /** Its source holds no more than this many with it at once (Capability API 1.320): a third does
     *  not take it. The showcase's Owed, whose Grasps hold two at most. */
    heldAtMost: z.number().int().min(1).max(20).optional(),
    /** The contest checks that may break it, in place of the breaking-free contest's own attacker
     *  checks (Capability API 1.175): 5e's Black Tentacles allows Strength or Dexterity, Web only
     *  Strength. */
    escapeChecks: z
      .array(sheetId)
      .min(1)
      .max(4)
      .refine((checks) => new Set(checks).size === checks.length, { message: "A check is named once" })
      .optional(),
    /** It goes on only while a value off the sheet of whoever applies it stands within these bounds,
     *  read as it applies (Capability API 1.167); one that does not is skipped. 5e's Rage puts on a
     *  damage bonus by barbarian level: +2 `when` the level is at most 8, +3 from 9, +4 from 16. */
    when: sheetBoundsSchema("when", "applied").optional(),
    /** It goes on only a target that is this (Capability API 1.168). */
    targetIs: targetIsSchema.optional(),
    /** It ends whenever the other condition named here, put on in the same list by the same use,
     *  ends on its holder, however that ends (Capability API 1.202): 5e's Hypnotic Pattern, whose
     *  incapacitation lasts only as long as its charm. */
    endsWith: sheetId.optional(),
    /** Its holder may spend the standard budget on a check of `combat.checks` against `difficulty`
     *  to end it (Capability API 1.313), offered even while it keeps them out of the fight; one that
     *  is `passes` succeeds without a roll. 5e's Maze: an Intelligence check against 20, which a
     *  minotaur or a goristro always makes. */
    checkEnds: z
      .object({
        check: sheetId,
        difficulty: z.number().int().min(0).max(1000),
        passes: targetIsSchema.optional(),
      })
      .strict()
      .optional(),
    /** More of what the condition `harms` with for each step of a higher cost it was put on with
     *  (Capability API 1.255): 5e's Acid Arrow, whose later acid grows by 1d4 a slot level. */
    harmsPerCostStep: z
      .object(catalogAmountShape)
      .strict()
      .refine((amount) => amount.dice !== undefined || (amount.flat ?? 0) > 0, {
        message: '"harmsPerCostStep" names dice, a flat amount, or both',
      })
      .optional(),
    /** A creature whose threat tier is at or below one of these is destroyed outright in place of
     *  taking the condition (Capability API 1.266): the highest tier whose `when`, read off the sheet
     *  of whoever applies it, holds. 5e's Destroy Undead after a failed Turn Undead save, CR 1/2 at
     *  cleric 5th up to CR 4 at 17th. A character, or a creature with no tier, is never destroyed. */
    destroysUpTo: z
      .array(z.object({ tier: sheetId, when: sheetBoundsSchema("when", "met").optional() }).strict())
      .min(1)
      .max(10)
      .optional(),
    /** A number read off the sheet of whoever applies it, fixed as it goes on (Capability API
     *  1.274), for the condition's `temporary` to give: 5e's Heroism, its caster's spellcasting
     *  modifier. */
    value: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
  })
  .strict()
  .superRefine((applies, ctx) => {
    if (applies.endsWith !== undefined && applies.endsWith === applies.condition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsWith"],
        message: "A condition ends with another one, not with itself",
      });
    }
    if (applies.duration === "until-save" && !applies.saveEnds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["saveEnds"],
        message: '"until-save" needs the save that ends it',
      });
    }
  });

/** A list of conditions put on together: each `endsWith` names another one of the same list (1.202). */
function linkedApplies(list: RulesetCatalogApplies[], ctx: z.RefinementCtx): void {
  const named = new Set(list.map((entry) => entry.condition));
  list.forEach((entry, index) => {
    if (entry.endsWith !== undefined && entry.endsWith !== entry.condition && !named.has(entry.endsWith)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "endsWith"],
        message: `"endsWith" names a condition put on in the same list, and "${entry.endsWith}" is not one`,
      });
    }
  });
}

/** What a rider is, minus where it comes from. A rider is PASSIVE: nobody takes it, and it adds one
 *  more damage clause to the first qualifying hit of its period, automatically.
 *
 *  `when` is any-of: one of the listed things being true is enough. "advantage" is how the attack
 *  roll finally leaned, and "ally-adjacent" is a standing ally of the attacker who can act, within
 *  one cell of the target on a board and anywhere at all without one. "ally-adjacent-no-disadvantage"
 *  (Capability API 1.126) also needs the roll's final mode not to be disadvantage. */
const riderCoreShape = {
  /** The one moment a rider fires. More of them arrive with the slice that builds windows. */
  on: z.literal("hit"),
  when: z
    .array(z.enum(["advantage", "ally-adjacent", "ally-adjacent-no-disadvantage"]))
    .min(1)
    .max(3)
    .optional(),
  oncePer: z.enum(["turn", "round"]),
  // Marked so the published JSON Schema can find it by name rather than by guessing from its keys,
  // which would also match every other pair of dice and flat in the file.
  amount: z.object(catalogAmountShape).strict().describe("rider-amount"),
  /** The kind of harm it deals. Without one it is the blow's own kind. */
  type: promptSafeText(40).optional(),
};

const riderAmountIssue = (rider: { amount: { dice?: string; flat?: number } }, ctx: z.RefinementCtx) => {
  if (rider.amount.dice === undefined && rider.amount.flat === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amount"],
      message: "A rider names dice, a flat amount, or both",
    });
  }
};

/** A rider a party member carries, from a catalog entry. `sources` names the attack lists it fires
 *  on and `requires` one truthy column of those lists' rows, so a rider that only comes off certain
 *  weapons says which without the Engine knowing one word of what a weapon is. `weapons` (Capability
 *  API 1.70) says the same of held weapons: one carrying any of these item tags. */
const catalogRiderSchema = z
  .object({
    ...riderCoreShape,
    sources: z.array(sheetId).min(1).max(8).optional(),
    requires: z.object({ column: sheetId }).strict().optional(),
    weapons: z
      .object({ tags: z.array(sheetId).min(1).max(8) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine(riderAmountIssue);

/** The keys a passive carries nothing of: a rider is not something anybody takes, so anything that
 *  would put it on a menu or spend something for it is refused where an author can still see it. */
const RIDER_ENTRY_FORBIDS = [
  "range",
  "area",
  "targets",
  "friendlyFire",
  "amount",
  "amountAdd",
  "damageType",
  "plus",
  "attackRoll",
  "halfOnMiss",
  "save",
  "cost",
  "perCostStep",
  "perCostStepsEvery",
  "targetsPerCostStep",
  "concentration",
  "reaction",
  "targetCount",
  "autoHit",
  "applies",
  "temporary",
  "budget",
  "free",
  "gives",
  "standard",
] as const;

/** Senses named by the ruleset, never by the Engine (Capability API 1.127). */
const combatSensesSchema = z
  .array(sheetId)
  .min(1)
  .max(4)
  .refine((entries) => new Set(entries).size === entries.length, { message: "Senses must be unique" });

/** An area as a catalog entry or an item's use carries it. A `box` (1.177) is a square of `size`
 *  a side, set down with its near corner on the cell aimed at and reaching away from its maker: 5e's
 *  cubes. A `wall` (1.177) is `size` long and `width` thick (one cell without it), run through the
 *  cell aimed at, or, where `ring` gives a diameter, laid as a ring that wide around it if its caster
 *  chooses; it only ever stays, as a zone. */
export interface RulesetCatalogArea {
  shape: "burst" | "cone" | "line" | "box" | "wall";
  size: number;
  width?: number;
  ring?: number;
  copies?: number;
  copiesWithin?: number;
  sizePerCostStep?: number;
  around?: true;
  throughWalls?: true;
}
const catalogAreaSchema: z.ZodType<RulesetCatalogArea, z.ZodTypeDef, unknown> = z
  .object({
    shape: z.enum(["burst", "cone", "line", "box", "wall"]),
    size: z.number().finite().gt(0),
    /** A line's width in the same unit as its size (Capability API 1.128), or a wall's thickness
     *  (1.177). Without it, one cell. */
    width: z.number().finite().gt(0).optional(),
    /** A wall its caster may lay as a ring instead (1.177), this many across: 5e's Wall of Fire, 20. */
    ring: z.number().finite().gt(0).optional(),
    /** How many of it its maker sets down at once (1.178), each touching another: 5e's Fire Storm,
     *  ten 10-ft cubes. Only a burst or a box. */
    copies: z.number().int().min(2).max(10).optional(),
    /** Its copies' middles each within this far of another's (Capability API 1.301), in the
     *  ruleset's distance, rather than touching: 5e's Dancing Lights, four lights each within 20 feet
     *  of another. */
    copiesWithin: z.number().finite().gt(0).max(10000).optional(),
    /** It grows by this much for each step of a higher cost it is paid with (Capability API 1.267):
     *  5e's Confusion, 5 feet more radius a slot level above 4th. Not a wall. */
    sizePerCostStep: z.number().finite().gt(0).optional(),
    /** Centred on its user and never aimed (Capability API 1.282): everybody within `size` of them
     *  is caught, they are not. A mummy lord's Channel Negative Energy, 60 feet. Only a burst. */
    around: z.literal(true).optional(),
    /** Walls and corners do not stop it (Capability API 1.282): "including ones behind barriers and
     *  around corners". Only with `around`. */
    throughWalls: z.literal(true).optional(),
  })
  .strict()
  .refine((area) => !area.around || (area.shape === "burst" && area.copies === undefined), {
    message: "Only a single burst is centred on its user",
    path: ["around"],
  })
  .refine((area) => !area.throughWalls || area.around, {
    message: "Only a burst centred on its user goes through walls",
    path: ["throughWalls"],
  })
  .refine((area) => area.sizePerCostStep === undefined || area.shape !== "wall", {
    message: "A wall does not grow with its cost",
    path: ["sizePerCostStep"],
  })
  .refine((area) => area.width === undefined || area.shape === "line" || area.shape === "wall", {
    message: "Only a line or a wall may carry width",
    path: ["width"],
  })
  .refine((area) => area.ring === undefined || area.shape === "wall", {
    message: "Only a wall is a ring",
    path: ["ring"],
  })
  .refine((area) => area.copies === undefined || area.shape === "burst" || area.shape === "box", {
    message: "Only a burst or a box is set down several times",
    path: ["copies"],
  })
  .refine((area) => area.copiesWithin === undefined || area.copies !== undefined, {
    message: '"copiesWithin" spaces out its copies, so it has "copies"',
    path: ["copiesWithin"],
  });

/** What an entry DOES. The Engine does not act on it in this slice: it validates it and the client
 *  shows one compact line. A later combat bridge turns it into the Engine's own `CombatSkill`, so
 *  the vocabulary is closed and strict, and a typo is refused now rather than ignored then. */
/** How an entry changes another as it is used (Capability API 1.253): 5e's Metamagic. Typed by hand,
 *  as written out its inferred type is too long for the schema around it to emit. */
export interface RulesetCatalogAlters {
  catalogs: string[];
  spares?: RulesetValueRef;
  range?: { times: number; touch?: number };
  rerolls?: RulesetValueRef;
  lasts?: number;
  heightens?: true;
  budget?: { from: string; to: string };
  drops?: string[];
  twins?: true;
  joins?: true;
}

const catalogAltersSchema: z.ZodType<RulesetCatalogAlters, z.ZodTypeDef, unknown> = z
  .object({
    /** The catalogs whose entries it changes: 5e's spells. */
    catalogs: z.array(sheetId).min(1).max(8),
    /** Up to this many of its user and their allies caught by it make its save outright: Careful. */
    spares: rulesetValueRefSchema.optional(),
    /** Its range this many times over, and a touch this far (in the catalog's distance): Distant. */
    range: z
      .object({ times: z.number().int().min(2).max(10), touch: z.number().positive().max(10000).optional() })
      .strict()
      .optional(),
    /** Up to this many of its damage dice that rolled low are thrown again: Empowered. */
    rerolls: rulesetValueRefSchema.optional(),
    /** What it puts on lasts this many times as long, never past a day: Extended. */
    lasts: z.number().int().min(2).max(10).optional(),
    /** Its first target rolls its first save against it with disadvantage: Heightened. */
    heightens: z.literal(true).optional(),
    /** Used with this budget instead of that one: Quickened, an action's casting as a bonus action. */
    budget: z.object({ from: sheetId, to: sheetId }).strict().optional(),
    /** Needs none of these components, and nobody can answer it being used: Subtle. */
    drops: componentIdsSchema.optional(),
    /** One more target, for one that has one and is not its user's alone: Twinned. */
    twins: z.literal(true).optional(),
    /** May be chosen beside another one: Empowered. */
    joins: z.literal(true).optional(),
  })
  .strict();

/** Who an entry may be pointed at or catch, by what they are (Capability API 1.168). Typed by hand:
 *  written out, its inferred type is too long for the definition schema around it to emit. */
const catalogTargetTypesSchema: z.ZodType<
  {
    is?: RulesetTargetIs;
    not?: RulesetTargetIs;
    abilityAtMost?: Record<string, number>;
    abilityAtLeast?: Record<string, number>;
    notImmuneTo?: string[];
  },
  z.ZodTypeDef,
  unknown
> = z
  .object({
    is: targetIsSchema.optional(),
    not: targetIsSchema.optional(),
    /** Only a target whose ability scores are at most these (Capability API 1.185): 5e's
     *  Animal Friendship, a beast of Intelligence 3 or less. A creature written with no score
     *  for one is not kept out by it. */
    abilityAtMost: z.record(sheetId, z.number().int().min(-100).max(1000)).optional(),
    /** Only a target whose ability scores are at least these (Capability API 1.191): 5e's
     *  Hideous Laughter passes over a creature of Intelligence 4 or less. Read as `abilityAtMost`
     *  is: a creature written with no score for one is not kept out by it. */
    abilityAtLeast: z.record(sheetId, z.number().int().min(-100).max(1000)).optional(),
    /** Only a target not immune to any of these conditions (1.185): 5e's Sleep, which passes over
     *  whoever cannot be charmed. */
    notImmuneTo: z.array(sheetId).min(1).max(8).optional(),
  })
  .strict()
  .refine(
    (types) =>
      types.is !== undefined ||
      types.not !== undefined ||
      types.abilityAtMost !== undefined ||
      types.abilityAtLeast !== undefined ||
      types.notImmuneTo !== undefined,
    { message: '"targetTypes" says "is", "not", "abilityAtMost", "abilityAtLeast", "notImmuneTo" or several' },
  );

/** A health pool an entry shares out among its targets (Capability API 1.196). Typed by hand:
 *  written out, its inferred type is too long for the definition schema around it to emit. */
const catalogHealthPoolSchema: z.ZodType<{ dice?: string; flat?: number }, z.ZodTypeDef, unknown> = z
  .object(catalogAmountShape)
  .strict()
  .refine((pool) => pool.dice !== undefined || pool.flat !== undefined, '"healthPool" names dice or a flat number');

/** Who a health pool passes over (Capability API 1.199). Typed by hand, as the pool is. */
const catalogHealthPoolSkipsSchema: z.ZodType<{ conditions?: string[]; unseeing?: true }, z.ZodTypeDef, unknown> = z
  .object({
    conditions: z.array(sheetId).min(1).max(16).optional(),
    unseeing: z.literal(true).optional(),
  })
  .strict()
  .refine((skips) => skips.conditions !== undefined || skips.unseeing !== undefined, {
    message: '"healthPoolSkips" names "conditions", "unseeing" or both',
  });

/** What using an entry does to a check (typed, to keep the mechanics' type small). */
const catalogCheckSchema: z.ZodType<
  {
    reroll?: z.infer<typeof checkRerollSchema>;
    dice?: number;
    successes?: number;
    threshold?: number;
    explode?: number;
    double?: number;
  },
  z.ZodTypeDef,
  unknown
> = z
  .object({
    /** Throw the dice at or below `upTo` again. `once` replaces each of them one time and
     *  lets the new face stand; `until` keeps going, under the Engine's own hard ceiling. */
    reroll: checkRerollSchema.optional(),
    /** Dice added to the pool before it is thrown. */
    dice: z.number().int().min(1).max(SPEND_EFFECT_MAX).optional(),
    /** Successes added after the dice are counted. */
    successes: z.number().int().min(1).max(SPEND_EFFECT_MAX).optional(),
    /** The per-die target this one check counts with, inside what the ruleset allows. */
    threshold: z.number().int().min(2).max(1000).optional(),
    /** The face this one check explodes, or counts twice, from, inside what the ruleset lets a
     *  check move it to. */
    explode: z.number().int().min(2).max(1000).optional(),
    double: z.number().int().min(2).max(1000).optional(),
  })
  .strict()
  .superRefine((check, ctx) => {
    if (
      !check.reroll &&
      check.dice === undefined &&
      check.successes === undefined &&
      check.threshold === undefined &&
      check.explode === undefined &&
      check.double === undefined
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A check effect does something, or is left out" });
    }
  });

/** Conditions a cure takes off (Capability API 1.176). Typed, to keep the mechanics' type small. */
const catalogEndsSchema: z.ZodType<
  { conditions: string[]; count?: number; from?: RulesetTargetIs },
  z.ZodTypeDef,
  unknown
> = z
  .object({
    conditions: z
      .array(sheetId)
      .min(1)
      .max(16)
      .refine((ids) => new Set(ids).size === ids.length, { message: "A condition is named once" }),
    count: z.number().int().min(1).max(16).optional(),
    /** Only what a creature that is this put on (Capability API 1.236): Dispel Evil and Good's Break
     *  Enchantment ends a charm, a fright or a possession by a celestial, an elemental, a fey, a
     *  fiend or an undead. */
    from: targetIsSchema.optional(),
  })
  .strict();

/** Live tracks moved by levels (Capability API 1.201). Typed, to keep the mechanics' type small. */
const catalogTracksSchema: z.ZodType<Array<{ track: string; by: number }>, z.ZodTypeDef, unknown> = z
  .array(
    z
      .object({
        track: sheetId,
        by: z
          .number()
          .int()
          .min(-20)
          .max(20)
          .refine((by) => by !== 0, { message: "A track is moved by at least one level" }),
      })
      .strict(),
  )
  .min(1)
  .max(4)
  .refine((tracks) => new Set(tracks.map((one) => one.track)).size === tracks.length, {
    message: "A track is named once",
  });

/** What an entry's summons spends and how long it stays. Typed, to keep the mechanics' type small. */
const catalogSummonsSchema: z.ZodType<
  { budget: string; rounds: number; move?: number; reach?: number },
  z.ZodTypeDef,
  unknown
> = z
  .object({
    budget: sheetId,
    rounds: z.number().int().min(1).max(100),
    move: z.number().finite().gt(0).optional(),
    reach: z.number().finite().gt(0).optional(),
  })
  .strict();

/** Its maker regains health by the damage a blow dealt (1.281): an aboleth's Psychic Drain, all of it;
 *  Vampiric Touch, half of the necrotic. The target's maximum is not touched. */
export interface RulesetDrain {
  share?: number;
  damageType?: string;
}
const drainSchema: z.ZodType<RulesetDrain, z.ZodTypeDef, unknown> = z
  .object({
    /** The share of what was dealt that comes back, rounded down: 1 when left out. */
    share: z.number().gt(0).max(1).optional(),
    /** Only the damage of this type counts. */
    damageType: promptSafeText(40).optional(),
  })
  .strict();

/** A blow lowering the health maximum (1.203, 1.235), on a creature's action or a catalog entry. */
export interface RulesetReducesMax {
  save?: string;
  difficulty?: number;
  onFailedSave?: true;
  damageType?: string;
  heals?: true;
  lasting?: true;
}
/** Typed, to keep the block's and the mechanics' types small. */
const reducesMaxSchema: z.ZodType<RulesetReducesMax, z.ZodTypeDef, unknown> = z
  .object({
    /** Its own save and the number it is rolled against (1.203); without either, every blow that
     *  lands lowers it (1.235): a vampire's Bite, a succubus's Draining Kiss. */
    save: sheetId.optional(),
    difficulty: z.number().int().min(0).max(1000).optional(),
    /** Only when the target failed the entry's OWN save (1.235): 5e's Harm. */
    onFailedSave: z.literal(true).optional(),
    /** Only the damage of this type counts (1.235): a vampire's necrotic. */
    damageType: promptSafeText(40).optional(),
    /** Its maker regains what it lowered (1.235): a vampire's Bite. */
    heals: z.literal(true).optional(),
    lasting: z.literal(true).optional(),
  })
  .strict()
  .superRefine((reduces, ctx) => {
    if ((reduces.save === undefined) !== (reduces.difficulty === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A lowered maximum\'s own "save" comes with the "difficulty" it is rolled against',
      });
    }
    if (reduces.save !== undefined && reduces.onFailedSave) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["onFailedSave"],
        message: 'A lowered maximum rolls its own "save" or follows the entry\'s, not both',
      });
    }
  });

/** Whom an action may be pointed at by what they hold (1.235): one of `conditions`, or one of
 *  `fromSelf` that its maker put on them. A vampire's Bite: grappled by it, incapacitated or
 *  restrained. */
export interface RulesetTargetHolds {
  conditions?: string[];
  fromSelf?: string[];
}
const targetHoldsSchema: z.ZodType<RulesetTargetHolds, z.ZodTypeDef, unknown> = z
  .object({
    conditions: z.array(sheetId).min(1).max(8).optional(),
    fromSelf: z.array(sheetId).min(1).max(8).optional(),
  })
  .strict()
  .refine((holds) => holds.conditions || holds.fromSelf, {
    message: '"targetHolds" names "conditions", "fromSelf" or both',
  });

/** Where a teleport goes (Capability API 1.276). Typed by hand, to keep the definition's type small. */
export interface RulesetTeleportRule {
  distance: number;
  seen?: true;
  carries?: number;
  carriesWithin?: number;
  carriesSeen?: true;
  leaves?: true;
  smoke?: RulesetSeenThrough;
  strike?: string;
}
/** Its user moves at once to a free place within `distance`, touching nothing between: no step, so
 *  nobody gets a strike at them leaving. With `seen`, only a place they can see. `carries` willing
 *  creatures of their own side no bigger than they are, within `carriesWithin` (touching when left
 *  out), go along and land as near them as there is room. Only on a board. */
const teleportSchema: z.ZodType<RulesetTeleportRule, z.ZodTypeDef, unknown> = z
  .object({
    distance: z.number().finite().gt(0).max(100000),
    seen: z.literal(true).optional(),
    carries: z.number().int().min(1).max(8).optional(),
    carriesWithin: z.number().finite().gt(0).max(10000).optional(),
    /** Only those its user can see go along (Capability API 1.279): a unicorn's "willing creatures
     *  it can see". */
    carriesSeen: z.literal(true).optional(),
    /** It may instead take its user, and whoever goes along, out of the fight altogether (Capability
     *  API 1.279): a unicorn's mile. Off a board that is the only place it goes. */
    leaves: z.literal(true).optional(),
    /** It leaves a cloud on the cell its user left and the one it lands in, obscuring as a zone's
     *  `obscures` does, until the end of its user's next turn (Capability API 1.279): the Cape of
     *  the Mountebank's smoke. */
    smoke: seenThroughSchema.optional(),
    /** A creature's: one of its own actions it may make once, before or after teleporting, as the
     *  same action (Capability API 1.280): a blink dog's bite. The menu offers the teleport, with
     *  the strike after it, and the strike, with the teleport after it. */
    strike: sheetId.optional(),
  })
  .strict()
  .refine((teleport) => teleport.carriesWithin === undefined || teleport.carries !== undefined, {
    message: '"carriesWithin" is how near those it "carries" stand, so it goes with "carries"',
    path: ["carriesWithin"],
  })
  .refine((teleport) => !teleport.carriesSeen || teleport.carries !== undefined, {
    message: '"carriesSeen" says which of those it "carries" may go, so it goes with "carries"',
    path: ["carriesSeen"],
  });

const catalogMechanicsObject = z
  .object({
    kind: z.enum(["attack", "heal", "buff", "debuff", "utility", "rider"]),
    /** Senses a target must have for this to affect it (Capability API 1.127). */
    needs: combatSensesSchema.optional(),
    /** Any one of `needs` is enough (Capability API 1.267): Turn Undead's "can see or hear you". */
    needsAny: z.literal(true).optional(),
    /** The creatures it is aimed at must all stand within this distance of each other (Capability
     *  API 1.267): 5e's Command, "within 30 feet of each other when you target them". */
    targetsWithin: z.number().finite().gt(0).optional(),
    /** Only a creature its maker can see may be picked (Capability API 1.178): 5e's "a creature you
     *  can see within range". Who sees whom is the fight's `sight`, obscuring zones and senses. */
    seen: z.literal(true).optional(),
    /** What using it needs, by the ids of `combat.components` (Capability API 1.179): a 5e spell's
     *  verbal and somatic components, which Silence or a gag can take away. */
    components: componentIdsSchema.optional(),
    /** Offered in a fight only while a value off its holder's sheet, live state and items stands
     *  within these bounds (Capability API 1.166): 5e's Protection, which needs a shield in hand. */
    usableWhen: catalogUsableWhenSchema.optional(),
    /** Who may be picked or caught at all, by what they are (Capability API 1.168): Animal
     *  Friendship takes only a beast (`is`), Sleep passes over the undead (`not`). A combatant with
     *  no type never matches `is` and always passes `not`. */
    targetTypes: catalogTargetTypesSchema.optional(),
    /** It deals its most to a target that is this (Capability API 1.185): every die at its top face.
     *  5e's Blight, against a plant creature. */
    maxAgainst: targetIsSchema.optional(),
    /** In the catalog's own distance unit. 0 is self or touch. */
    range: z.number().finite().min(0).optional(),
    area: catalogAreaSchema.optional(),
    targets: z.enum(["self", "ally", "enemy", "any"]).optional(),
    friendlyFire: z.boolean().optional(),
    amount: z.object(catalogAmountShape).strict().optional(),
    /** Added to `amount`, read off the user's sheet as the entry is used (Capability API 1.83): 5e's
     *  Second Wind heals 1d10 plus the fighter's level. Needs an amount. */
    amountAdd: rulesetValueRefSchema.optional(),
    damageType: promptSafeText(40).optional(),
    /** More amounts on the same blow, beside `amount`, each rolled and typed on its own. */
    plus: z.array(catalogPlusClauseSchema).max(RULESET_DAMAGE_MAX_PLUS).optional(),
    /** What the entry's harm carries past a resistance's or an immunity's `except`, as a weapon
     *  item's tags do (Capability API 1.101): a spell is `["magical"]`, so a resistance to its type
     *  "from nonmagical attacks" does not halve it. */
    qualities: z.array(sheetId).min(1).max(8).optional(),
    attackRoll: z.boolean().optional(),
    /** A miss still deals half its damage (Capability API 1.255), and nothing else it does on a hit:
     *  5e's Acid Arrow. Only on an entry that rolls to hit and deals damage. */
    halfOnMiss: z.literal(true).optional(),
    /** `ignoresCover` (Capability API 1.74): the target gains nothing from cover on this save, as a
     *  spell whose text says so (5e's Sacred Flame). */
    save: z
      .object({
        save: sheetId,
        onSuccess: z.enum(["none", "half", "negates"]),
        ignoresCover: z.literal(true).optional(),
        ...saveExtrasShape,
      })
      .strict()
      .optional(),
    /** What using the entry spends, named by a live pool or by a pool group. */
    cost: z
      .array(z.object({ pool: sheetId, amount: z.number().int().min(1) }).strict())
      .max(4)
      .optional(),
    /** What one step of a higher cost adds, for systems that let a player pay more. */
    perCostStep: z.object(catalogAmountShape).strict().optional(),
    /** What it does to a check or save only when the Game Master names it on that roll with
     *  `apply=` (Capability API 1.156): owning it is not enough. */
    contextual: z.lazy(() => rulesetContextualSchema).optional(),
    /** The most steps of a higher cost that count (Capability API 1.241): paying more than this
     *  adds nothing more. 5e's Divine Smite, 2d8 and 1d8 a slot level above 1st, to 5d8 at most: 3. */
    perCostStepsMax: z.number().int().min(1).max(20).optional(),
    /** `perCostStep` adds once for every this many steps (Capability API 1.300): 5e's Flame Blade,
     *  1d6 more for every two slot levels above 2nd, is 2. An action a condition gives (1.236)
     *  reads its steps off the cost the spell that put the condition on was paid at. */
    perCostStepsEvery: z.number().int().min(2).max(9).optional(),
    /** Taken as its holder's own attack hits (a `"hit"` reaction with `"by": "self"`), its amount is
     *  added to that blow instead of dealt on its own (Capability API 1.241): rolled with it, doubled
     *  by its critical, and taken as part of it. 5e's Divine Smite. */
    addsToBlow: z.literal(true).optional(),
    /** Taken as somebody else's attack hits (a `"hit"` reaction without `"by"`), this many dice come
     *  off the roll before it is checked again (Capability API 1.250): 5e's Cutting Words, a bardic
     *  inspiration die, sized by the bard's level with `die` as Martial Arts' is. */
    lowersRoll: z
      .object({
        dice: catalogDice.optional(),
        die: z
          .object({
            from: rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>,
            table: stepTableSchema,
          })
          .strict()
          .optional(),
        /** Also off somebody else's ability check or damage roll (Capability API 1.257), spent
         *  as it is made where it could turn it: a check that would win, or damage that would take
         *  one of its user's side down. */
        also: z
          .array(z.enum(["checks", "damage"]))
          .min(1)
          .max(2)
          .refine((also) => new Set(also).size === also.length, { message: "Rolls must be unique" })
          .optional(),
      })
      .strict()
      .refine((lowers) => (lowers.dice === undefined) !== (lowers.die === undefined), {
        message: '"lowersRoll" rolls "dice" or one "die" sized by a value: one of them',
      })
      .optional(),
    /** How many more targets one step of a higher cost lets a use take (Capability API 1.171), up
     *  to 20 in all: 5e's Hold Person, one more creature for each slot level above 2nd. */
    targetsPerCostStep: z.number().int().min(1).max(10).optional(),
    /** What using this entry does to a CHECK the character is about to make, rather than to a
     *  fight. A charm that lets a roll be re-thrown, or that simply hands out successes. Only a
     *  pool ruleset can honour any of it, and the cross-checks say so at import. */
    check: catalogCheckSchema.optional(),
    /** What an attack leaves behind to strike on later turns (Capability API 1.122). Distances
     *  are in the catalog's unit; without a reach it touches the next cell. */
    summons: catalogSummonsSchema.optional(),
    /** An area that stays (Capability API 1.172): it lasts `rounds` of its caster's turns, or until
     *  the concentration that holds it ends, and does the entry's own effect again to a creature at
     *  each of its `triggers`, once a turn whatever it was: moving into it (`enter`), or starting or
     *  ending a turn in it. `anchor: "caster"` keeps a burst centred on its caster as they move (5e's
     *  Spirit Guardians); `atCast: false` does nothing as it appears. A zone whose `terrain` is all
     *  it does names no triggers (1.173). */
    zone: catalogZoneSchema.optional(),
    /** Whoever it lands on and does not save against is pushed this far straight away from its maker,
     *  in the catalog's unit (Capability API 1.182): 5e's Gust of Wind, 15 feet. A zone pushes
     *  whoever it catches the same way. */
    push: z.number().finite().gt(0).max(10000).optional(),
    /** Its user teleports (Capability API 1.276), in the catalog's unit: 5e's Misty Step, 30 feet to
     *  a place they can see; Dimension Door, 500 feet, carrying one willing creature within 5 feet. */
    teleport: teleportSchema.optional(),
    /** Takes these conditions off whoever it lands on, up to `count` of them (all when left out) in
     *  the order named (Capability API 1.176): 5e's Lesser Restoration ends one of blinded, deafened,
     *  paralyzed or poisoned. */
    ends: catalogEndsSchema.optional(),
    /** Used, it ends this condition on its user (Capability API 1.236), with the concentration that
     *  holds it when that is theirs: Dispel Evil and Good's Break Enchantment and Dismissal end the
     *  spell. */
    endsCondition: sheetId.optional(),
    /** Used only while its user stands in one of these lights (Capability API 1.303), as the fight
     *  reads it where they stand: 5e's One with Shadows, `{ "light": ["dim", "dark"] }`. */
    usableIn: z
      .object({
        light: z
          .array(z.enum(["sunlight", "bright", "dim", "dark"]))
          .min(1)
          .max(4)
          .refine((lights) => new Set(lights).size === lights.length, { message: "A light is named once" }),
      })
      .strict()
      .optional(),
    /** Used only while its user stands within `within` (the ruleset's distance) of a standing prop of
     *  the board named `prop`, by its id or its label (Capability API 1.332): Fennick's Hymnal, a
     *  verse sung at the Year-Wheel. A fight with no board never offers it. */
    usableNear: z
      .object({ prop: z.string().trim().min(1).max(60), within: z.number().finite().gt(0).max(10000) })
      .strict()
      .optional(),
    /** Held on a sheet's list, surprise is shaken off by using this entry first on the surprised
     *  turn (Capability API 1.237), when nothing keeps its holder from acting: 5e's Feral Instinct
     *  with Rage. The entry is otherwise passive. */
    ignoresSurpriseWith: catalogEntryRef.optional(),
    /** Held on a sheet's list, what it does to the attacks of its holder's rows (Capability API 1.242). */
    attackRows: z.array(catalogAttackRowsSchema).min(1).max(4).optional(),
    /** Held on a sheet's list, a strike it lets its holder buy with another budget (Capability API 1.242). */
    grantsStrike: catalogStrikeGrantSchema.optional(),
    /** Offered only once its holder has taken the attack action this turn (Capability API 1.242). */
    afterAttack: afterAttackSchema.optional(),
    /** Held on a sheet's list, these conditions are on its holder through every fight (Capability
     *  API 1.263), as long as nothing they are immune to: 5e's Aura of Protection, whose condition
     *  spreads the aura. Never written to the sheet; the fight ends, they are gone with it. */
    keepsOn: uniqueIds(4).optional(),
    /** Used, it puts a weapon in its user's hand for the rest of the fight (Capability API 1.306),
     *  one of `items` (melee weapons of the item catalogs) picked as it is used, or one they already
     *  hold that `binds` matches: 5e's Pact of the Blade. Whatever amends this entry amends that
     *  weapon's attacks (Lifedrinker, Thirsting Blade); with `proficient` it is used with proficiency,
     *  and its blows carry `qualities` (magical). Another use replaces it. */
    conjures: z
      .object({
        items: z.array(catalogEntryRef).min(1).max(40),
        proficient: z.literal(true).optional(),
        qualities: z.array(sheetId).min(1).max(8).optional(),
        binds: itemMatchSchema.optional(),
        /** A live text field naming the one held weapon `binds` may bind (Capability API 1.309): bound
         *  out of the fight, as 5e's hour-long ritual during a short rest is, by writing its name
         *  there. Empty, nothing is bound. */
        boundIn: sheetId.optional(),
      })
      .strict()
      .refine((conjures) => conjures.boundIn === undefined || conjures.binds !== undefined, {
        message: '"boundIn" names the weapon "binds" binds, so it goes with "binds"',
        path: ["boundIn"],
      })
      .optional(),
    /** Held on a sheet's list, how it changes one named entry of its holder's every time they use it
     *  (Capability API 1.302), stacking with every other such: 5e's Agonizing Blast adds the
     *  Charisma modifier to eldritch blast's damage on a hit (`damageAdd`), Eldritch Spear makes its
     *  range 300 feet (`range`), Repelling Blast pushes whoever it hits up to 10 feet (`push`, with
     *  `pushOptional` offering it without the push too). */
    amends: z
      .array(
        z
          .object({
            entry: catalogEntryRef,
            damageAdd: rulesetValueRefSchema.optional(),
            /** More damage of its own type on a hit (Capability API 1.306), at least `atLeast`:
             *  Lifedrinker's necrotic equal to the Charisma modifier, minimum 1. */
            damagePlus: z
              .object({
                add: rulesetValueRefSchema,
                type: sheetId.optional(),
                atLeast: z.number().int().min(0).max(1000).optional(),
              })
              .strict()
              .optional(),
            range: z.number().finite().gt(0).max(10000).optional(),
            push: z.number().finite().gt(0).max(10000).optional(),
            pushOptional: z.literal(true).optional(),
            /** At least this many strikes for one spend of its budget (Capability API 1.306): Thirsting
             *  Blade's two attacks with the pact weapon. */
            strikes: z.number().int().min(2).max(6).optional(),
          })
          .strict()
          .refine(
            (amend) =>
              amend.damageAdd !== undefined ||
              amend.damagePlus !== undefined ||
              amend.range !== undefined ||
              amend.push !== undefined ||
              amend.strikes !== undefined,
            { message: 'An amend changes something: "damageAdd", "damagePlus", "range", "push" or "strikes"' },
          )
          .refine((amend) => !amend.pushOptional || amend.push !== undefined, {
            message: '"pushOptional" offers its "push" or none, so it has one',
            path: ["pushOptional"],
          }),
      )
      .min(1)
      .max(4)
      .optional(),
    /** Held on a sheet's list, its holder's initiative dice are thrown twice (Capability API 1.240),
     *  the better (`advantage`) or the worse kept: 5e's Feral Instinct. */
    initiativeMode: z.enum(["advantage", "disadvantage"]).optional(),
    /** Held on a sheet's list, its holder takes a second turn in a fight's first round (Capability
     *  API 1.238), at their own initiative plus `initiative` (a negative number is later):
     *  5e's Thief's Reflexes at -10. `unlessSurprised`: not when they begin the fight surprised. */
    extraFirstTurn: z
      .object({ initiative: z.number().int().min(-100).max(100), unlessSurprised: z.literal(true).optional() })
      .strict()
      .optional(),
    /** Whoever it lands on and does not save against leaves the fight (Capability API 1.236), alive:
     *  `true` for good (Dispel Evil and Good's Dismissal); `{ "while": <condition> }` only while
     *  they hold that condition, which the entry puts on, back where they were (or the nearest free
     *  place) when it ends, by its time, a save or its caster's concentration (5e's Banishment); one
     *  that is `gone` stays away if it ran its whole time (Banishment's creature of another plane). */
    dismisses: z
      .union([
        z.literal(true),
        z
          .object({
            while: sheetId,
            gone: targetIsSchema.optional(),
            /** Away, it still takes its turns (Capability API 1.313), on which it may only try what
             *  ends what keeps it away (`checkEnds`, or a save spent an action on): 5e's Maze. */
            turns: z.literal(true).optional(),
          })
          .strict() as z.ZodType<{ while: string; gone?: RulesetTargetIs; turns?: true }, z.ZodTypeDef, unknown>,
      ])
      .optional(),
    /** Whoever it lands on who is dying stops rolling, stable (1.176): 5e's Spare the Dying. */
    stabilizes: z.literal(true).optional(),
    /** Moves the sheet's live tracks of whoever it lands on and does not save against by `by` levels
     *  (Capability API 1.201), held to each track's own bounds: down for a cure, as 5e's Greater
     *  Restoration takes a level of exhaustion off, and up for harm, as Sickening Radiance adds one.
     *  A level that defeats, reached this way, defeats. */
    tracks: catalogTracksSchema.optional(),
    /** Gives back to whoever it lands on the health only a rest would (Capability API 1.201): what a
     *  sealing blow took off their maximum, as Greater Restoration ends a reduction of it. */
    unseals: z.literal(true).optional(),
    /** It does ONE of its cures, not all of them (Capability API 1.204): one condition of `ends`, one
     *  of `tracks`, or `unseals`, picked as it is used like a weapon's mode, and otherwise the first
     *  of them, in that order, the target has something for. 5e's Greater Restoration. */
    cureOneOf: z.literal(true).optional(),
    /** Its user names a creature type of `combat.creatureTypes` as they use it (Capability API
     *  1.270), picked like a weapon's mode: what it puts on remembers it, for an aura with
     *  `chosenKind` to reach only that kind (5e's Antipathy/Sympathy). */
    kindChoice: z.literal(true).optional(),
    /** Its damage lowers the health maximum as a creature's can (Capability API 1.235), with no save
     *  of its own: on every target, or with `onFailedSave` only on one that failed the entry's save
     *  (5e's Harm). Health only in points. */
    reducesMax: reducesMaxSchema.optional(),
    /** Its user regains health by the damage it dealt, or a share of it (Capability API 1.281):
     *  Vampiric Touch, half of the necrotic. */
    drain: drainSchema.optional(),
    /** Its damage never takes a target below this much health (Capability API 1.235): Harm's 1. */
    leavesAtLeast: z.number().int().min(1).max(100000).optional(),
    /** Offered only on a target that holds one of these (Capability API 1.235). */
    targetHolds: targetHoldsSchema.optional(),
    /** Brings back whoever died no more than `withinRounds` rounds ago, with `health` (1.176): 5e's
     *  Revivify, within 10 rounds with 1 hit point. It is pointed only at them. */
    revives: z
      .object({ withinRounds: z.number().int().min(1).max(1000), health: z.object(catalogAmountShape).strict() })
      .strict()
      .optional(),
    concentration: z.boolean().optional(),
    /** Made again on later turns while its user concentrates on it (Capability API 1.310), on
     *  `budget`, with no cost and no new concentration, at the cost it was cast at: Vampiric Touch,
     *  Call Lightning, Heat Metal (a bonus action). `notSaved`: never at a creature that succeeded on a
     *  save against this casting (Eyebite). `sameTargets`: only at whom the cast was aimed at (Heat
     *  Metal's holder). */
    repeats: z
      .object({
        budget: sheetId,
        notSaved: z.literal(true).optional(),
        sameTargets: z.literal(true).optional(),
        /** Entries that share a `group` are one casting's choices (Capability API 1.313): while its
         *  user concentrates on any of them, every one of them is offered again. Eyebite's asleep,
         *  panicked and sickened, picked anew for each creature. */
        group: sheetId.optional(),
      })
      .strict()
      .optional(),
    /** Something taken at a MOMENT rather than on a turn. `true` says only that much, and an entry
     *  that says only that much is on no menu: nothing knows which moment it waits for. An object
     *  names the moment, and then the entry is offered in the window that moment opens.
     *
     *  `on` is a closed list because the Engine has to be the one that notices the moment:
     *  - `aimed`: somebody is about to do something to the holder. The window opens BEFORE it
     *    resolves, and what is taken there may `cancel` it.
     *  - `used`: somebody on the other side is about to use something, anywhere this reaches,
     *    whoever it is aimed at or none. Before it resolves too, and it may be cancelled.
     *  - `hit`: an attack roll has just hit the holder, and its damage has not been dealt. What is
     *    taken there counts for that attack: its roll is checked again against the holder's
     *    defense as it then stands.
     *  - `harmed`: something has just hurt the holder. The window opens AFTER it resolves, because
     *    the amount is what the moment is about, and nothing taken there unmakes it.
     *  - `falls`: a creature is falling, before its damage and prone (Capability API 1.124).
     *    The answer lands on the faller, within its range and target side.
     *  - `turn-start`: a creature on the entry's target side starts its turn within range (1.131).
     *
     *  `for: "ally" | "any"` on aimed or hit asks bystanders within `within` of the target (1.131).
     *  `at: "target"` puts the answer on that target: Shield Guardian models its amulet wearer as
     *  an ally within 5. Protection puts this-action disadvantage on the source before its roll.
     *  `cancelSave` asks the holder for a save before cancelling; Rock Catching cancels the whole
     *  attack. `against.actions` names stat-block actions, case-insensitively, by their whole name.
     *  A falls answer may catch up to targetCount fallers of the same event, nearest first.
     *
     *  `at` says whom what is taken may be aimed at. `source` is whoever caused the moment, which
     *  is the only target most of these have, and is filled in rather than picked.
     *
     *  `against` narrows what opens the moment for this reaction: only an action that comes from an
     *  entry of one of these catalogs, or (1.117) one of these entries by name. A weapon row, a stat block's own action, a contest and a
     *  standard action have no entry behind them, so they never do. */
    reaction: z
      .union([
        // `false` has been legal since the key existed and says the entry is not a reaction at all,
        // which is what leaving it out says. A package that ships one is not broken by this.
        z.literal(false),
        z.literal(true),
        rulesetReactionMomentSchema,
      ])
      .optional(),
    /** How many targets one use may take. One unless it says otherwise. */
    targetCount: z.number().int().min(1).max(20).optional(),
    /** The amount simply lands: no roll and no save. */
    autoHit: z.boolean().optional(),
    /** Conditions a use puts on the targets it affects: up to 6 (Capability API 1.277; 4 before),
     *  for a rage whose path adds its own (Mindless Rage beside Rage's and Frenzy's). */
    applies: z.array(catalogAppliesSchema).max(6).superRefine(linkedApplies).optional(),
    /** Conditions a use puts on its own user as it is made (Capability API 1.307), whatever happens to
     *  its targets, held by its concentration when it has one: Sunbeam's mote of radiance, which
     *  sheds light and gives the later beams as an action. */
    appliesSelf: z.array(catalogAppliesSchema).min(1).max(4).superRefine(linkedApplies).optional(),
    /** Standard actions its user takes as part of it, for nothing more (Capability API 1.313): 5e's
     *  Expeditious Retreat, which Dashes as it is cast; its later bonus-action Dashes are what the
     *  condition it puts on its caster `grants`. */
    takes: z
      .array(z.enum(["dash", "disengage", "dodge"]))
      .min(1)
      .max(3)
      .optional(),
    /** An amount granted as temporary points on the health pool, which damage drains first. */
    temporary: z.object(catalogAmountShape).strict().optional(),
    /** Health to share out among its targets (Capability API 1.196): the one with the least health
     *  left first, each affected only while their health is no more than what remains of it, which
     *  they then use up; the rest are left alone. 5e's Sleep and Color Spray. `perCostStep` adds to it. */
    healthPool: catalogHealthPoolSchema.optional(),
    /** Whom the pool passes over, using none of it and leaving them alone (Capability API 1.199):
     *  whoever holds one of `conditions` (5e's Sleep ignores the unconscious), and with `unseeing`
     *  whoever cannot see its maker (Color Spray ignores those that can't see). */
    healthPoolSkips: catalogHealthPoolSkipsSchema.optional(),
    /** Affects only a target with this much health left or less (Capability API 1.196): 5e's Power
     *  Word Stun at 150, Power Word Kill at 100. */
    healthAtMost: z.number().int().min(0).max(100000).optional(),
    /** Kills outright whoever it affects (Capability API 1.196): Power Word Kill. */
    kills: z.literal(true).optional(),
    /** An amount that grows with the sheet: the table gives the EXTRA dice at each step of the
     *  value it reads, so a trick that grows with a level needs no second entry. */
    scales: z.object({ from: rulesetValueRefSchema, table: stepTableSchema }).strict().optional(),
    /** More targets as the sheet grows (Capability API 1.305): the table gives the EXTRA targets at
     *  each step of the value it reads, as `scales` does dice. 5e's eldritch blast, a second beam at
     *  5th level, a third at 11th, a fourth at 17th. */
    targetsScale: z.object({ from: rulesetValueRefSchema, table: stepTableSchema }).strict().optional(),
    /** The same target may be picked more than once, each its own attack with its own roll, and
     *  everything that changes the entry (`amends`) applies to each (Capability API 1.305): eldritch
     *  blast's beams "at the same target or at different ones". */
    targetsRepeat: z.literal(true).optional(),
    /** Spends the uses of the row with this name instead of its own (Capability API 1.239): a
     *  Berserker's Frenzied Rage spends a use of Rage, its counter row. */
    usesOf: promptSafeText(80).optional(),
    /** Offered only on its holder's own turn before they have made an attack in it (Capability API
     *  1.247): 5e's Reckless Attack, decided as the first attack is made. */
    beforeAttack: z.literal(true).optional(),
    /** Never on the menu: spent, with whatever it costs, when its holder's own roll of this kind has
     *  failed (Capability API 1.249). A failed save is rolled again (`reroll`), or a failed save,
     *  check or missed attack turned into a success (`success`): 5e's Indomitable and Diamond Soul,
     *  and Stroke of Luck. */
    /** `twenty` counts a failed check's d20 as a 20 where that makes it (Capability API 1.256):
     *  Stroke of Luck. `die` adds a die of the holder's own where it could make up the difference:
     *  `dice`, or one `die` sized by a value as Martial Arts' is (1.256): Peerless Skill spending a
     *  bardic inspiration die, Dark One's Own Luck's d10. */
    rescue: catalogRescueSchema.optional(),
    /** Never pointed at its own user (Capability API 1.256): Bardic Inspiration's "one creature
     *  other than you". Only on an entry that may be pointed at its user's side. */
    notSelf: z.literal(true).optional(),
    /** Pointed only at a creature no bigger than this one of `combat.sizes` (Capability API 1.314):
     *  Resilient Sphere's "a creature of Large size or smaller". Not on an area or its user. */
    targetsUpTo: sheetId.optional(),
    /** Takes growth off the cells its area covers (Capability API 1.318): a druid's clearing word. */
    clears: z.literal("growth").optional(),
    /** Used on a creature, not used on that one again until its user takes this rest (Capability API
     *  1.304), however many fights come between: Chains of Carceri's "You must finish a long rest
     *  before you can use this invocation on the same creature again". Not on an area or on its user. */
    oncePerTarget: z.object({ until: sheetId }).strict().optional(),
    /** How many of those uses one use spends (Capability API 1.245): Quivering Palm's 3 ki. */
    usesSpent: z.number().int().min(2).max(20).optional(),
    /** Its user chooses how many of those uses one use spends, one up to what is left, and it heals
     *  that many times its amount (Capability API 1.251): 5e's Lay on Hands, a point of its pool for
     *  each hit point. */
    usesChosen: z.literal(true).optional(),
    /** Changes how another entry is used, chosen as it is used and paid for with this entry's own
     *  uses (Capability API 1.253): 5e's Metamagic. Never on a menu of its own. One per use, unless
     *  it `joins` another. */
    alters: catalogAltersSchema.optional(),
    /** Its price in uses is the level the altered entry is paid at, at least one (Capability API
     *  1.253): Twinned Spell. */
    usesSpentByLevel: z.literal(true).optional(),
    /** Gives back to a pool of whoever it lands on (Capability API 1.252): a live pool by id, or a
     *  pool a list row holds by its name. `perCostStep` adds to it for each step of a higher cost,
     *  and `overMax` lets it go past the maximum until a rest sets the pool back to it. 5e's Font of
     *  Magic: a spell slot paid for Sorcery Points equal to its level, and a slot made from them. */
    restore: z
      .object({
        pool: z.string().trim().min(1).max(60),
        amount: z.object(catalogAmountShape).strict(),
        overMax: z.literal(true).optional(),
      })
      .strict()
      .optional(),
    /** A target that fails the save drops to 0 health instead of taking the amount (Capability API
     *  1.245), as if the blow had taken every point it had: 5e's Quivering Palm, whose made save
     *  still takes 10d10 necrotic. */
    dropsOnFailedSave: z.literal(true).optional(),
    /** Which budget of the action economy a use spends, instead of the list's own default. */
    budget: sheetId.optional(),
    /** Costs no budget at all: a turn may hold as many of these as their own price allows. */
    free: z.literal(true).optional(),
    /** Budgets this hands its user the moment it is used, for this turn only. Capped where it
     *  lands, so nothing can be saved up for a later turn. */
    gives: z
      .array(z.object({ budget: sheetId, count: z.number().int().min(1).max(10) }).strict())
      .min(1)
      .max(4)
      .optional(),
    /** The standard actions its holder may take for a budget other than the main one. The menu
     *  offers them beside the ordinary ones, and the resolver spends the budget named here. */
    standard: z
      .object({ actions: z.array(combatStandardActionSchema).min(1).max(7), budget: sheetId })
      .strict()
      .optional(),
    /** Its holder's own ways of hiding and finding the hidden (Capability API 1.292): a permission
     *  like `standard`, read where `combat.hiding` hides for real. */
    hiding: hidingTraitsSchema.optional(),
    /** What this adds to the first qualifying hit of a period, all by itself. */
    rider: catalogRiderSchema.optional(),
  })
  .strict();

/** What is wrong with a zone, wherever it is carried: a catalog entry, or an item's use (1.174). */
/** How many sides dice text like "12d6" or "1d6+2" rolls. */
function diceSides(dice: string): number {
  return Number(/d(\d+)/.exec(dice)?.[1] ?? 0);
}

function zoneIssue(mechanics: {
  zone?: RulesetCatalogZone;
  area?: { shape: string };
  summons?: unknown;
  reaction?: unknown;
  save?: unknown;
  amount?: { dice?: string; flat?: number };
}): string | undefined {
  const zone = mechanics.zone;
  if (!zone) return mechanics.area?.shape === "wall" ? "A wall only ever stays, so it needs a zone" : undefined;
  const wall = mechanics.area?.shape === "wall";
  if ((zone.blocks || zone.side) && !wall) return 'Only a wall "blocks" or has a "side"';
  if (zone.sections && !zone.blocks) return 'A wall in "sections" is one that "blocks"';
  if (zone.sections?.broken?.save && !mechanics.save) {
    return "A broken section's save is rolled against the entry's own difficulty, so it has a save";
  }
  if (wall && (zone.anchor === "caster" || zone.move || zone.drift)) return "A wall stays where it is cast";
  if ((mechanics.area as { copies?: number } | undefined)?.copies && (zone.anchor === "caster" || zone.drift)) {
    return "A zone set down several times stays where it is cast, or is moved all together";
  }
  // Carried with whoever holds it (1.301).
  if (
    zone.carried &&
    (zone.anchor === "caster" ||
      zone.move ||
      zone.drift ||
      mechanics.area?.shape !== "burst" ||
      (mechanics.area as { copies?: number }).copies)
  ) {
    return "A zone carried with somebody is a single burst put on a point, never moved of its own";
  }
  // Going off later and burning away (1.183).
  if (zone.detonates && (zone.anchor === "caster" || zone.move || zone.drift || wall)) {
    return "A zone that goes off stays where it is cast";
  }
  const grows = zone.detonates?.grows;
  if (grows && !mechanics.amount) return 'What "grows" is the entry\'s own amount, so it has one';
  if (
    grows?.dice &&
    diceSides(grows.dice) !== (mechanics.amount?.dice ? diceSides(mechanics.amount.dice) : undefined)
  ) {
    return '"grows" rolls the same dice as the entry\'s own amount';
  }
  if (zone.detonates?.touched && !mechanics.save) return "Whoever touches it rolls the entry's own save, so it has one";
  if (zone.burns?.amount && !zone.burns.damageType) return 'What burning deals has a "damageType"';
  if (zone.damageType && !mechanics.amount)
    return "A zone's \"damageType\" is for the entry's own amount, so it has one";
  if (zone.damageType && zone.triggers.length === 0 && !zone.side && !zone.move?.ram) {
    return 'A zone\'s "damageType" is what it deals at its triggers, so it names one';
  }
  if (zone.dispelsLight && !zone.obscures?.darkness)
    return "A zone that puts out spell light is magical darkness, an obscures with darkness";
  return !mechanics.area
    ? "A zone is an area that stays, so it needs an area"
    : zone.anchor === "caster" && !["burst", "line", "cone"].includes(mechanics.area.shape)
      ? "A zone that moves with its caster is a burst around them, or a line or cone from them"
      : zone.turn && (zone.anchor !== "caster" || mechanics.area.shape === "burst")
        ? "Only a line or cone that moves with its caster is turned"
        : zone.terrain?.towardCaster && !(zone.terrain.difficult || zone.terrain.costTimes)
          ? '"towardCaster" says when its hard going counts, so the ground is "difficult" or has "costTimes"'
          : mechanics.summons || mechanics.reaction
            ? "A zone is cast on a turn and leaves no summon"
            : zone.triggers.length === 0 &&
                !zone.terrain &&
                !wall &&
                !zone.obscures &&
                !zone.disperses &&
                !zone.inside &&
                !zone.forbids &&
                !zone.wards &&
                !zone.detonates &&
                !zone.burns &&
                !zone.lights &&
                !zone.dispelsDark
              ? "A zone names at least one trigger, unless it is a wall, or what it does is to its ground or to whoever stands in it"
              : (zone.move || zone.drift) && (zone.anchor === "caster" || mechanics.area.shape !== "burst")
                ? "Only a burst held at a point is moved or drifts"
                : zone.breaksConcentration && !mechanics.save
                  ? "A zone that breaks concentration rolls it against the entry's own save"
                  : zone.breaksConcentration && zone.triggers.length === 0
                    ? "A zone breaks concentration at one of its triggers"
                    : undefined;
}

/** Typed, to keep the definition's type small. */
const catalogMechanicsSchema: z.ZodType<
  z.infer<typeof catalogMechanicsObject>,
  z.ZodTypeDef,
  unknown
> = catalogMechanicsObject.superRefine((mechanics, ctx) => {
  const why = zoneIssue(mechanics);
  if (why) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["zone"], message: why });
  // Where a teleport goes is picked as it is used (1.276): never an aim or an answer.
  // A strike made with it is one of a creature's own actions (1.280).
  if (mechanics.teleport?.strike) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["teleport", "strike"],
      message: "A teleport's strike is one of a creature's own actions, so only a creature's teleport names one",
    });
  }
  // Made again only while held by concentration (1.310).
  if (mechanics.repeats && !mechanics.concentration) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["repeats"],
      message: '"repeats" is made again while its user concentrates on it, so it goes with "concentration"',
    });
  }
  if (mechanics.teleport && (mechanics.area || mechanics.reaction)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["teleport"],
      message: "A teleport goes where its user picks, so it is not an area or a reaction",
    });
  }
  const cureParts =
    (mechanics.ends?.conditions.length ?? 0) + (mechanics.tracks?.length ?? 0) + (mechanics.unseals ? 1 : 0);
  if (mechanics.kindChoice && !mechanics.applies?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kindChoice"],
      message: 'The kind chosen is remembered by what it puts on, so "kindChoice" goes with "applies"',
    });
  }
  if (mechanics.cureOneOf && cureParts < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cureOneOf"],
      message: '"cureOneOf" picks one of at least two cures among "ends", "tracks" and "unseals"',
    });
  }
  if (
    mechanics.reducesMax &&
    (mechanics.reducesMax.save !== undefined || mechanics.reducesMax.difficulty !== undefined)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reducesMax"],
      message: "An entry's lowered maximum has no save of its own: \"onFailedSave\" follows the entry's",
    });
  }
  const away = mechanics.dismisses;
  if (away && away !== true && !mechanics.applies?.some((applied) => applied.condition === away.while)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dismisses", "while"],
      message: `Away while it holds "${away.while}", so the entry puts it on`,
    });
  }
  if (mechanics.dropsOnFailedSave && !mechanics.save) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dropsOnFailedSave"],
      message: '"dropsOnFailedSave" follows the entry\'s own save, so it has one',
    });
  }
  if (mechanics.reducesMax?.onFailedSave && !mechanics.save) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reducesMax", "onFailedSave"],
      message: '"onFailedSave" follows the entry\'s own save, so it has one',
    });
  }
  // A burst centred on its user (1.282) lands at once; one that stays is laid where it is aimed.
  if (mechanics.area?.around && mechanics.zone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["area", "around"],
      message: "A burst centred on its user lands at once, so it leaves no zone",
    });
  }
  // What it regains is what it dealt (1.281), so it deals something.
  if (mechanics.drain && (!mechanics.amount || mechanics.kind === "heal")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["drain"],
      message: "A drain gives back what the blow dealt, so it deals damage",
    });
  }
  if ((mechanics.reducesMax || mechanics.leavesAtLeast !== undefined) && !mechanics.amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [mechanics.reducesMax ? "reducesMax" : "leavesAtLeast"],
      message: "It works on the entry's damage, so it has an amount",
    });
  }
  if (mechanics.alters) {
    const alters = mechanics.alters;
    if (
      alters.spares === undefined &&
      !alters.range &&
      alters.rerolls === undefined &&
      alters.lasts === undefined &&
      !alters.heightens &&
      !alters.budget &&
      !alters.drops?.length &&
      !alters.twins
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alters"], message: '"alters" changes something' });
    }
    if (mechanics.kind !== "utility" || mechanics.reaction !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alters"],
        message: '"alters" is on a "utility" entry that is no reaction: it is chosen with what it changes',
      });
    }
  }
  for (const key of ["targetsScale", "targetsRepeat"] as const) {
    if (mechanics[key] && (mechanics.targets === "self" || mechanics.area)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `"${key}" is on an entry pointed at creatures, not an area or its user`,
      });
    }
  }
  if (
    mechanics.conjures &&
    (mechanics.kind !== "utility" || (mechanics.targets ?? "self") !== "self" || mechanics.area)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["conjures"],
      message: '"conjures" is on a "utility" entry its user uses on themselves',
    });
  }
  if (mechanics.oncePerTarget && (mechanics.targets === "self" || mechanics.area)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["oncePerTarget"],
      message: '"oncePerTarget" is on an entry pointed at a creature, not an area or its user',
    });
  }
  if (mechanics.targetsUpTo && (mechanics.targets === "self" || mechanics.area)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetsUpTo"],
      message: '"targetsUpTo" is on an entry pointed at a creature, not an area or its user',
    });
  }
  if (mechanics.clears && !mechanics.area) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clears"],
      message: '"clears" takes growth off the cells of an area, so the entry has one',
    });
  }
  if (mechanics.notSelf && mechanics.targets !== "ally" && mechanics.targets !== "any") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["notSelf"],
      message: '"notSelf" is on an entry pointed at an "ally" or "any" creature',
    });
  }
  if (mechanics.halfOnMiss && (!mechanics.attackRoll || !mechanics.amount || mechanics.kind === "heal")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["halfOnMiss"],
      message: '"halfOnMiss" is on an entry that rolls to hit ("attackRoll") and deals an "amount"',
    });
  }
  if (mechanics.usesSpentByLevel && (!mechanics.alters || mechanics.usesSpent !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["usesSpentByLevel"],
      message: '"usesSpentByLevel" prices an entry that "alters" another, with no "usesSpent"',
    });
  }
  if (mechanics.restore) {
    const amount = mechanics.restore.amount;
    if (amount.dice === undefined && amount.flat === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["restore", "amount"],
        message: "A restore says how much it gives back",
      });
    }
    if (mechanics.kind !== "heal" && mechanics.kind !== "buff") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["restore"],
        message: "A restore is on an entry that helps, a heal or a buff",
      });
    }
  }
  if (mechanics.usesChosen && (mechanics.kind !== "heal" || mechanics.usesSpent !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["usesChosen"],
      message: '"usesChosen" heals as many times over as the uses chosen: a "heal" with no "usesSpent"',
    });
  }
  if (mechanics.lowersRoll) {
    const moment = typeof mechanics.reaction === "object" ? mechanics.reaction : undefined;
    if (moment?.on !== "hit" || moment.by !== undefined || moment.also) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lowersRoll"],
        message: '"lowersRoll" is taken as somebody else\'s attack hits: reaction "hit" without "by" or "also"',
      });
    }
  }
  if (mechanics.addsToBlow) {
    const moment = typeof mechanics.reaction === "object" ? mechanics.reaction : undefined;
    if (moment?.on !== "hit" || moment.by !== "self" || !mechanics.amount || mechanics.kind !== "attack") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["addsToBlow"],
        message:
          '"addsToBlow" is an attack with an amount, taken as its holder\'s own hit: reaction "hit", "by": "self"',
      });
    }
  }
  {
    const moment = typeof mechanics.reaction === "object" ? mechanics.reaction : undefined;
    if (moment?.by && (moment.at ?? "source") === "source" && (mechanics.targets ?? "enemy") === "enemy") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reaction", "at"],
        message: 'A reaction to its holder\'s own hit is aimed at whoever it hit: "at": "target"',
      });
    }
  }
  if (mechanics.perCostStepsMax !== undefined && !mechanics.perCostStep && !mechanics.targetsPerCostStep) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["perCostStepsMax"],
      message: '"perCostStepsMax" caps what "perCostStep" or "targetsPerCostStep" adds, so it has one',
    });
  }
  if (mechanics.perCostStepsEvery !== undefined && !mechanics.perCostStep) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["perCostStepsEvery"],
      message: '"perCostStepsEvery" spaces out what "perCostStep" adds, so it has one',
    });
  }
  if (mechanics.healthPoolSkips && !mechanics.healthPool) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["healthPoolSkips"],
      message: '"healthPoolSkips" says whom a "healthPool" passes over, so it has one',
    });
  }
  if (mechanics.summons && (mechanics.kind !== "attack" || (mechanics.targets ?? "enemy") !== "enemy")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["summons"],
      message: "Only an attack that targets enemies can leave a summon",
    });
  }
  // A rider and the kind that says it is one always come together: one without the other is an
  // entry that either does nothing or says it is passive and then asks to be taken.
  if (mechanics.rider && mechanics.kind !== "rider") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kind"],
      message: 'An entry with a rider is of the kind "rider"',
    });
  }
  if (mechanics.kind === "rider") {
    if (!mechanics.rider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rider"],
        message: 'A "rider" entry says what its rider does',
      });
    }
    for (const key of RIDER_ENTRY_FORBIDS) {
      if (mechanics[key] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "A rider is passive: nobody takes it, so it carries nothing that would be taken",
        });
      }
    }
  }
  // A second amount needs a first one to ride: a blow made of nothing but clauses would be an
  // amount written in the one place nothing reads it.
  if (mechanics.plus && !mechanics.amount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["plus"], message: "A clause needs an amount beside it" });
  }
  // An `amount` that MENDS is health given back, and there is nothing for a second damage clause
  // to be typed against or saved out of.
  if (mechanics.plus && mechanics.kind === "heal") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["plus"], message: "A heal carries no damage clauses" });
  }
  // Free of the economy, or spending one named budget of it. Both at once says two things about
  // the same use and the menu would have to pick one.
  if (mechanics.free && mechanics.budget !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["free"],
      message: "Something free spends no budget, so it names none",
    });
  }
  // Naming one twice would offer it twice. (Naming the MAIN budget is refused where the ruleset's
  // own economy is in reach, which is not here.)
  if (mechanics.standard && mechanics.standard.actions.length !== new Set(mechanics.standard.actions).size) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["standard", "actions"],
      message: "The same standard action is named twice",
    });
  }
});

/** What the picker may filter on. `startFrom` names a sheet field the picker opens on, so a caster
 *  sees their own school first. Nothing here knows the word "spell" or "class". */
const catalogFilterSchema = z
  .object({
    id: sheetId,
    label,
    type: z.enum(["number", "text", "tags"]),
    startFrom: z.object({ field: sheetId }).strict().optional(),
  })
  .strict();

/** How many columns of one row the ruleset may set for the player. A row is a row, not a second
 *  place to declare derived values: anything bigger belongs in `sheet.derived`, pointed at by `from`. */
export const RULESET_SCALED_MAX_COLUMNS = 4;

/** A number column whose value follows the sheet: the reference's own number, or that number looked
 *  up in `table` (a maximum that grows with a level). The sheet editor writes it when the build
 *  changes; nothing recomputes it at read time, so a stored row is always the number it says. */
const catalogScaledColumnSchema = z.object({ from: rulesetValueRefSchema, table: stepTableSchema.optional() }).strict();

const catalogScaledSchema = z.record(catalogScaledColumnSchema).superRefine((scaled, ctx) => {
  const keys = Object.keys(scaled);
  // An empty map says nothing, and would still make the row the entry's only one for its list.
  if (keys.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "scaled names at least one column, or is left out" });
  }
  if (keys.length > RULESET_SCALED_MAX_COLUMNS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `At most ${RULESET_SCALED_MAX_COLUMNS} columns of a row can be scaled`,
    });
  }
  for (const key of keys) {
    if (key.length > 40 || !SHEET_ID_PATTERN.test(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: SHEET_ID_MESSAGE });
    }
  }
});

const catalogEntryRowSchema = z
  .object({
    list: sheetId,
    values: z.record(sheetScalar),
    /** Optional. `values` still holds what the row starts as, because a catalog is picked before
     *  anything knows which sheet it lands on. */
    scaled: catalogScaledSchema.optional(),
  })
  .strict();

// ── Creatures: the opponents a bestiary catalog ships ──
//
// A creature is written in exactly the numbers a fight reads, and every name in it is the ruleset's
// own: the pool it is measured in, the saves it rolls, the conditions it shrugs off, the damage
// types its hide answers to and the rung of its own threat scale it sits on. Nothing here knows one
// system's vocabulary, and nothing in it is text a fight interprets.

/** How many actions one creature may carry. Generous, because a written opponent has its strikes,
 *  the sequence that spends them and a thing it does once a fight. */
export const RULESET_CREATURE_MAX_ACTIONS = 12;

/** What a creature can take: a plain number, or dice thrown once when the fight is created. The
 *  average is what a forecast reads, so a menu never promises a die nobody has thrown. */
const creatureHealthSchema = z.union([
  z.number().int().min(1).max(100000),
  z.object({ dice: catalogDice, flat: z.number().int().min(-1000).max(100000).optional() }).strict(),
]);

/** One amount an action deals instead of its first, and when (Capability API 1.102). */
const creatureDamageAlternativeSchema = z
  .object({
    when: z.union([z.literal("twoHanded"), z.object({ selfHealthAtMost: z.number().finite().gt(0).lt(1) }).strict()]),
    dice: catalogDice.optional(),
    flat: z.number().int().min(-1000).max(10000).optional(),
  })
  .strict()
  .superRefine((alternative, ctx) => {
    if (alternative.dice === undefined && alternative.flat === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "An alternative names dice, a flat amount, or both" });
    }
  });

/** What one action does to what it reaches: the same amount shape a catalog entry uses, plus the
 *  type the target's own hide is checked against. */
const creatureDamageSchema = z
  .object({
    dice: catalogDice.optional(),
    flat: z.number().int().min(-1000).max(10000).optional(),
    type: promptSafeText(40).optional(),
    /** More amounts on the same blow, each rolled and typed on its own. */
    plus: z.array(catalogPlusClauseSchema).max(RULESET_DAMAGE_MAX_PLUS).optional(),
    /** What the blow carries past a resistance's or an immunity's `except`, as a weapon item's tags
     *  do (Capability API 1.101): a deva's mace is `["magical"]`, so a resistance to slashing "from
     *  nonmagical attacks" does not halve it. */
    qualities: z.array(sheetId).min(1).max(8).optional(),
    /** What the first amount is instead, while something the fight reads holds (Capability API
     *  1.102). The first that holds wins; the type, the clauses and the rest stay the action's own.
     *  `twoHanded` holds unless the creature carries a `shield` (5e's "or 8 (1d10 + 3) if used with
     *  two hands"); `selfHealthAtMost` holds while the creature's health is at most that share of
     *  its most (5e's swarm, "or 5 (2d4) if the swarm has half of its hit points or fewer"). */
    alternatives: z.array(creatureDamageAlternativeSchema).min(1).max(4).optional(),
  })
  .strict()
  .superRefine((damage, ctx) => {
    if (damage.dice === undefined && damage.flat === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Damage names dice, a flat amount, or both" });
    }
  });

/** A save the action itself forces. The difficulty is the action's own, because a stat block is not
 *  a sheet and has no abilities list to read one off. */
const creatureSaveSchema = z
  .object({
    save: sheetId,
    difficulty: z.number().int().min(0).max(1000),
    onSuccess: z.enum(["none", "half", "negates"]),
    /** The target gains nothing from cover on this save (Capability API 1.74). */
    ignoresCover: z.literal(true).optional(),
    ...saveExtrasShape,
  })
  .strict();

/** A distance a shot still carries past its ordinary one. Both numbers are in the ruleset's own
 *  unit, and a plain number is the ordinary distance with nothing beyond it. */
const creatureRangeSchema = z
  .union([
    z.number().finite().min(0).max(10000),
    z
      .object({
        normal: z.number().finite().min(0).max(10000),
        long: z.number().finite().min(0).max(10000).optional(),
      })
      .strict()
      .superRefine((range, ctx) => {
        if (range.long !== undefined && range.long < range.normal) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["long"],
            message: "The long distance is at least the ordinary one",
          });
        }
      }),
  ])
  .describe("A distance, or an ordinary distance with a longer one beyond it");

const creatureUsesSchema = z
  .object({ per: z.enum(["encounter", "day"]), count: z.number().int().min(1).max(20) })
  .strict();

/** Components said in place of an entry's own, none at all included (1.181). */
const componentOverrideSchema = z
  .array(sheetId)
  .max(8)
  .refine((ids) => new Set(ids).size === ids.length, { message: "A component is named once" });

const creatureSpellcastingSchema = z
  .object({
    saveDifficulty: z.number().int().min(1).max(60).optional(),
    toHit: z.number().int().min(-50).max(100).optional(),
    spells: z
      .array(
        z
          .object({
            entry: catalogEntryRef,
            uses: creatureUsesSchema.optional(),
            level: z.number().int().min(0).max(20).optional(),
            coven: z.literal(true).optional(),
            /** What casting it this way needs, in place of the entry's own (Capability API 1.181):
             *  `[]` for innate spellcasting that needs no components. */
            components: componentOverrideSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(60),
    /** What every spell of the trait needs, in place of each entry's own, unless a spell says
     *  (Capability API 1.181): 5e's "requiring no material components" is `["verbal", "somatic"]`. */
    components: componentOverrideSchema.optional(),
    coven: z
      .object({ id: sheetId, size: z.number().int().min(2).max(6), within: z.number().finite().positive() })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((casting, ctx) => {
    const seen = new Set<string>();
    casting.spells.forEach((spell, index) => {
      if (seen.has(spell.entry))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["spells", index, "entry"],
          message: `Duplicate spell entry "${spell.entry}"`,
        });
      seen.add(spell.entry);
      if (spell.coven && !casting.coven)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["spells", index, "coven"],
          message: "A coven spell needs a spellcasting.coven block",
        });
    });
    if (casting.coven && !casting.spells.some((spell) => spell.coven))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coven"],
        message: "A spellcasting.coven block needs at least one coven spell",
      });
  });

const creatureActionSchema = z
  .object({
    id: sheetId,
    name: promptSafeText(80),
    /** Senses a target must have for this to affect it (Capability API 1.127). */
    needs: combatSensesSchema.optional(),
    /** Any one of `needs` is enough (Capability API 1.267): Turn Undead's "can see or hear you". */
    needsAny: z.literal(true).optional(),
    /** Only a creature its maker can see may be picked (Capability API 1.178): 5e's "a creature you
     *  can see within range". Who sees whom is the fight's `sight`, obscuring zones and senses. */
    seen: z.literal(true).optional(),
    /** What using it needs, by the ids of `combat.components` (Capability API 1.179): a 5e spell's
     *  verbal and somatic components, which Silence or a gag can take away. */
    components: componentIdsSchema.optional(),
    budget: sheetId,
    toHit: z.number().int().min(-50).max(100).optional(),
    /** The amount simply lands: no roll to make. */
    autoHit: z.boolean().optional(),
    damage: creatureDamageSchema.optional(),
    /** Hit points given back to each target, capped at its maximum (Capability API 1.121). */
    heal: z.object(catalogAmountShape).strict().optional(),
    /** What it is, as a catalog entry's `qualities` are (Capability API 1.262): `["magical"]` makes
     *  its heal a magical one and a save against it a save against magic. */
    qualities: z.array(promptSafeText(40)).min(1).max(8).optional(),
    /** The conditions it ends on each target (Capability API 1.261), as a catalog entry's `ends`
     *  does, a kind for any of it: a deva's and a unicorn's Healing Touch. */
    ends: catalogEndsSchema.optional(),
    /** Who it may be pointed at, relative to the creature (Capability API 1.121). Without it, the
     *  other side, as before. */
    targets: z.enum(["ally", "any"]).optional(),
    save: creatureSaveSchema.optional(),
    /** Whoever it lands on is pushed this far straight away from the creature, in the ruleset's own
     *  distance (Capability API 1.184); with a save, only on a failed one: a bronze dragon's
     *  Repulsion Breath, a dragon turtle's Tail. */
    push: z.number().finite().gt(0).max(10000).optional(),
    /** The creature teleports (Capability API 1.276), in the ruleset's own distance, as a catalog
     *  entry's `teleport` does: a blink dog's Teleport, 40 feet to a place it can see. */
    teleport: teleportSchema.optional(),
    /** The ability its attack is made with (Capability API 1.189), so a change to attacks or damage
     *  narrowed to an ability reaches it: a gold dragon's Weakening Breath on an ogre's club. */
    ability: sheetId.optional(),
    /** A target that fails this save has its health maximum lowered by the damage it took
     *  (Capability API 1.203), until a rest, or with `lasting` until something gives it back
     *  (`unseals`); brought to 0 that way, it dies. 5e's wraith's Life Drain, a clay golem's Slam. */
    reducesMax: reducesMaxSchema.optional(),
    /** The creature regains health by the damage it dealt, or a share of it (Capability API 1.281):
     *  an aboleth's Psychic Drain. */
    drain: drainSchema.optional(),
    /** Offered only on a target that holds one of these (Capability API 1.235). */
    targetHolds: targetHoldsSchema.optional(),
    /** What a save that ENDS one of `applies` is rolled against, when the action has no save of its
     *  own to borrow the number from. */
    saveDifficulty: z.number().int().min(0).max(1000).optional(),
    /** Up to 6 (Capability API 1.277; 4 before). */
    applies: z.array(catalogAppliesSchema).max(6).superRefine(linkedApplies).optional(),
    /** It is held by the creature's concentration (Capability API 1.307), as a catalog entry's is:
     *  what it puts on ends when that concentration does. An imp's Invisibility. */
    concentration: z.literal(true).optional(),
    targetCount: z.number().int().min(1).max(20).optional(),
    /** In the ruleset's own distance unit, read once a fight has positions. */
    reach: z.number().finite().min(0).max(10000).optional(),
    /** How far it is thrown or shot. A plain number is the ordinary distance; the pair says how far
     *  it still reaches beyond that, which a ruleset may make harder. */
    range: creatureRangeSchema.optional(),
    /** The shape it lands in, in the ruleset's own distance unit, read once a fight has positions.
     *  A breath weapon is a cone; a bolt is a line; a blast is a burst. Its `range` says how far
     *  off it may be aimed, and a shape with none is aimed from where the creature stands. */
    area: z
      .object({
        shape: z.enum(["burst", "cone", "line", "box"]),
        size: z.number().finite().gt(0).max(10000),
        /** A line's width in the same unit as its size (Capability API 1.128). Without it, one cell. */
        width: z.number().finite().gt(0).optional(),
        /** False spares the creature's own side, as a catalog entry's does. */
        friendlyFire: z.boolean().optional(),
        /** Centred on its user and never aimed (Capability API 1.282): everybody within `size` of them
         *  is caught, they are not. A mummy lord's Channel Negative Energy, 60 feet. Only a burst. */
        around: z.literal(true).optional(),
        /** Walls and corners do not stop it (Capability API 1.282): "including ones behind barriers and
         *  around corners". Only with `around`. */
        throughWalls: z.literal(true).optional(),
        /** Everybody within `size` of a standing prop of the board with this label (Capability API
         *  1.331), wherever it is aimed: Shelves Lean, around the Granary's shelf rows. Only a burst,
         *  never `around`. */
        aroundProp: z.string().trim().min(1).max(60).optional(),
      })
      .strict()
      .refine((area) => !area.aroundProp || (area.shape === "burst" && !area.around), {
        message: '"aroundProp" is a burst around the props, never centred on its user',
        path: ["aroundProp"],
      })
      .refine((area) => area.width === undefined || area.shape === "line", {
        message: "Only a line area may carry width",
        path: ["width"],
      })
      .refine((area) => !area.around || area.shape === "burst", {
        message: "Only a single burst is centred on its user",
        path: ["around"],
      })
      .refine((area) => !area.throughWalls || area.around, {
        message: "Only a burst centred on its user goes through walls",
        path: ["throughWalls"],
      })
      .optional(),
    /** How many times it can be done at all, and over what stretch. */
    uses: creatureUsesSchema.optional(),
    /** Spent when it is used, and rolled for at the start of the creature's own turn: `from` or
     *  higher on these dice brings it back. It starts the fight available. */
    recharge: z
      .object({
        dice: combatDiceSchema,
        from: z.number().int().min(1).max(1000),
        /** Actions of this block naming the same group are spent together, and one roll brings them
         *  all back (Capability API 1.186): a metallic dragon's two breath weapons. */
        group: sheetId.optional(),
      })
      .strict()
      .optional(),
    /** What a blow adds when its creature ran at least `atLeast`, in the ruleset's own distance,
     *  straight at the one it hit this turn (Capability API 1.186): a minotaur's Charge. More damage
     *  (`plus`), then `save`, and on a failed one, or always with no save, a `push` and `applies`. */
    charge: z
      .object({
        atLeast: z.number().finite().gt(0).max(10000),
        plus: z.array(catalogPlusClauseSchema).min(1).max(4).optional(),
        save: z
          .object({ save: sheetId, difficulty: z.number().int().min(0).max(1000) })
          .strict()
          .optional(),
        push: z.number().finite().gt(0).max(10000).optional(),
        applies: z.array(catalogAppliesSchema).min(1).max(4).superRefine(linkedApplies).optional(),
      })
      .strict()
      .refine((charge) => charge.plus || charge.push !== undefined || charge.applies, {
        message: 'A charge adds damage ("plus"), a "push" or conditions ("applies")',
      })
      .optional(),
    /** Other actions of this same block, in order, each with its own target choice. ONE budget pays
     *  for the lot: this is how a creature that strikes twice in one action is written. A step may
     *  never name another sequence. */
    sequence: z
      .array(z.object({ action: sheetId, times: z.number().int().min(1).max(10).default(1) }).strict())
      .min(1)
      .max(6)
      .optional(),
    /** Bought out of the creature's own points instead of a budget. */
    signature: z
      .object({ cost: z.number().int().min(1).max(20) })
      .strict()
      .optional(),
    /** A lair action (Capability API 1.315): taken, while the creature fights in its lair, once a
     *  round as the fight's count passes its `lairInitiative` (losing ties), never the same one two
     *  rounds running. Aimed and resolved as on its own turn, with its `budget` lent for it and
     *  nothing of its own turn spent. 5e's dragons' lair actions on initiative count 20. */
    lair: z.literal(true).optional(),
    /** Taken at a moment rather than on a turn, exactly as a catalog entry's reaction is. */
    reaction: rulesetReactionMomentSchema.optional(),
    /** It lands on the creature itself rather than on somebody else: a parry, a guard, a hardening. */
    self: z.literal(true).optional(),
    /** A move bought with points between turns (Capability API 1.283), to a cell its maker picks:
     *  `share` of its speed (a tarrasque's half), or `distance` in the ruleset's own unit (a mummy
     *  lord's 60 feet), its own speed when neither is given. `noOpportunity`: nobody strikes at it
     *  leaving (a vampire's). `untouchable`: nothing harms or holds it on the way, so nobody strikes
     *  at it, ground and zones it crosses do nothing to it, and what held it in place lets go (a
     *  mummy lord's Whirlwind of Sand). Its own turn's movement is not spent. */
    move: z
      .object({
        share: z.number().gt(0).max(1).optional(),
        distance: z.number().finite().gt(0).max(10000).optional(),
        noOpportunity: z.literal(true).optional(),
        untouchable: z.literal(true).optional(),
        /** The one way of moving it uses (Capability API 1.285), its share read off that speed: a
         *  dragon "can then fly up to half its flying speed". */
        speed: z.enum(["walk", "fly", "swim", "climb", "burrow"]).optional(),
      })
      .strict()
      .refine((move) => move.share === undefined || move.distance === undefined, {
        message: 'A move is a "share" of its speed or a "distance", not both',
      })
      .optional(),
    /** A spell cast with points between turns (Capability API 1.284): any of its maker's own
     *  `spellcasting`, paid for as it always is (a sphinx's Cast a Spell), or only its cantrips with
     *  `cantripsOnly` (a lich's Cantrip). Aimed, answered and resolved as on its turn. */
    casting: z
      .object({ cantripsOnly: z.literal(true).optional() })
      .strict()
      .optional(),
    /** It looks for whoever is hiding, as the `search` standard action does (Capability API 1.287):
     *  a creature's legendary Detect, bought with points between turns. */
    search: z.literal(true).optional(),
    /** The light it sheds from now on (Capability API 1.296), or `"out"`, and nothing else: the
     *  magmin's Ignited Illumination, one action to set itself ablaze and one to put its flames
     *  out, or a will-o'-wisp's Variable Illumination, one action for each reach. */
    sheds: z.union([lightRadiusSchema, z.literal("out")]).optional(),
    /** An area that stays where it is aimed (Capability API 1.324), as a catalog entry's `zone`
     *  says it: The Owed's Freezing Fog, Scatter Flour's cube of flour. It needs an `area`. */
    zone: catalogZoneSchema.optional(),
    /** What it does to the ground its `area` covers, for good (Capability API 1.324), as a board
     *  event's `change` says it: the bonfire gutters (`"light": "dark"`), the ice cracks
     *  (`"terrain": "water"`). It needs an `area`. */
    ground: creatureGroundSchema.optional(),
    /** A permission (Capability API 1.291): the standard actions named, from `combat.standard`,
     *  taken with this action's budget, and with `while: "obscured"` only while it stands lightly
     *  or heavily obscured (in a fog, or in dim light or darkness). 5e's goblin's Nimble Escape is
     *  `{ "name": "Nimble Escape", "budget": "bonus", "standard": { "actions": ["disengage", "hide"] } }`. */
    standard: z
      .object({
        actions: z.array(combatStandardActionSchema).min(1).max(7),
        while: z.literal("obscured").optional(),
      })
      .strict()
      .optional(),
    /** Only a creature at no health that is still alive may be picked (Capability API 1.311): a
     *  will-o'-wisp's Consume Life, at a dying or stable character. */
    dyingOnly: z.literal(true).optional(),
    /** A target that fails its save dies (Capability API 1.311), and with `healsOnSlay` the creature
     *  regains that much for each one that does: Consume Life's "or die ... regains 10 (3d6)". */
    slaysOnFailedSave: z.literal(true).optional(),
    healsOnSlay: z.object(catalogAmountShape).strict().optional(),
    /** Who it fells on Held Ground is reaped there and then (Capability API 1.323), and stays down. */
    reaps: z.literal(true).optional(),
    /** Creatures it calls into the fight (Capability API 1.325), on its side: `creature` names a
     *  bestiary entry as `"<catalogId>/<entryId>"`, from this ruleset's catalogs or the fight's
     *  bestiary, and `count` how many (`{"dice": "1d4"}`, or `{"flat": 2}`), eight at most. They
     *  appear in the action's `area` where it is aimed, or beside it without one, and roll their
     *  own initiative, or with `"initiative": "after"` act right after it. The Owed's Jars Burst,
     *  Shelves Lean's specters. */
    calls: z
      .object({
        creature: z
          .string()
          .trim()
          .regex(/^[^/\s]{1,80}\/[^/\s]{1,120}$/, 'A called creature is named "<catalogId>/<entryId>"'),
        count: z
          .object(catalogAmountShape)
          .strict()
          .refine((count) => count.dice !== undefined || (count.flat ?? 0) >= 1, {
            message: "A call brings at least one creature",
          }),
        initiative: z.enum(["roll", "after"]).optional(),
      })
      .strict()
      .optional(),
    /** Whoever it lands on spends `spends` from their own budgets, if they have it left, to walk up
     *  to their speed toward the creature there and then (Capability API 1.326), by the shortest
     *  open way and drawing no strikes; with a save, only on a failed one. The Owed's Whisper a
     *  Name: `{ "spends": "reaction" }`. */
    draws: z.object({ spends: sheetId }).strict().optional(),
    /** Only somebody who has already taken their turn this round may be picked (Capability API
     *  1.327): the Hour Bell's "one creature that has already acted this round". */
    actedOnly: z.literal(true).optional(),
    /** Held by its `concentration`, which once broken (by harm, by going down, or by what a zone
     *  does) makes this lair action of its own the next it takes (Capability API 1.327): Father
     *  Ivo's Litany of Keeping, the shelves leaning. A list (Capability API 1.336) makes the next one of
     *  those, whoever runs it picking: the shelves leaning north or south. */
    brokenNextLair: z.union([sheetId, z.array(sheetId).min(1).max(8)]).optional(),
  })
  .strict()
  .superRefine((action, ctx) => {
    // Where it stands and what ground it changes is where its area is aimed (1.324).
    for (const key of ["zone", "ground"] as const) {
      if (action[key] && !action.area) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `A creature action's "${key}" is where its "area" is aimed, so it has one`,
        });
      }
    }
    if (action.slaysOnFailedSave && !action.save) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slaysOnFailedSave"],
        message: '"slaysOnFailedSave" follows the action\'s own save, so it has one',
      });
    }
    if (action.healsOnSlay && !action.slaysOnFailedSave) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["healsOnSlay"],
        message: '"healsOnSlay" is given back for a target slain, so it goes with "slaysOnFailedSave"',
      });
    }
    // A light switched (1.296) is nothing else.
    if (action.sheds !== undefined) {
      const extras = (
        [
          "damage",
          "heal",
          "applies",
          "area",
          "teleport",
          "move",
          "casting",
          "sequence",
          "reaction",
          "toHit",
          "autoHit",
          "save",
          "search",
          "standard",
        ] as const
      ).filter((key) => action[key] !== undefined);
      if (extras.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sheds"],
          message: `Lighting or putting out its light is all it does, so it carries no ${extras.join(", ")}`,
        });
      }
    }
    // A search (1.287) is the looking, and nothing else.
    if (action.search) {
      const extras = (
        [
          "damage",
          "heal",
          "applies",
          "area",
          "teleport",
          "move",
          "casting",
          "sequence",
          "reaction",
          "toHit",
          "autoHit",
          "save",
          "ends",
          "push",
          "charge",
        ] as const
      ).filter((key) => action[key] !== undefined);
      if (extras.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["search"],
          message: `A search is the looking, so it carries no ${extras.join(", ")}`,
        });
      }
    }
    // A legendary cast (1.284) is bought with points, and only casts.
    if (action.casting) {
      if (!action.signature) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["casting"],
          message: "A cast is bought with points between turns, so it carries a signature",
        });
      }
      const extras = (
        [
          "damage",
          "heal",
          "applies",
          "area",
          "teleport",
          "move",
          "sequence",
          "reaction",
          "toHit",
          "autoHit",
          "save",
          "ends",
          "push",
          "charge",
        ] as const
      ).filter((key) => action[key] !== undefined);
      if (extras.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["casting"],
          message: `A cast is the spell it casts, so it carries no ${extras.join(", ")}`,
        });
      }
    }
    // A legendary move (1.283) is bought with points, and follows whatever else it does (1.285): a
    // dragon's Wing Attack, then its flight.
    if (action.move) {
      if (!action.signature) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["move"],
          message: "A move is bought with points between turns, so it carries a signature",
        });
      }
      const extras = (["teleport", "sequence", "reaction", "charge"] as const).filter(
        (key) => action[key] !== undefined,
      );
      if (extras.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["move"],
          message: `A move follows what its action does, so it carries no ${extras.join(", ")}`,
        });
      }
    }
    // Where a teleport goes is picked as it is taken (1.276): never an aim, an answer or a part.
    if (action.teleport && (action.area || action.reaction || action.sequence)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teleport"],
        message: "A teleport goes where its user picks, so it is not an area, a reaction or a sequence",
      });
    }
    if (action.heal) {
      if (action.heal.dice === undefined && action.heal.flat === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["heal"],
          message: "A heal needs dice, a flat amount, or both",
        });
      }
      // Healing gives points back without a blow or a save, to the targets somebody picked.
      for (const key of ["damage", "toHit", "save", "area"] as const) {
        if (action[key] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "A healing action carries no damage, attack roll, save or area",
          });
        }
      }
    }
    if (action.sequence) {
      // A sequence is a container. Anything else on it would be a second thing the one budget also
      // did, with nothing to say when it happened.
      for (const key of [
        "toHit",
        "autoHit",
        "damage",
        "heal",
        "targets",
        "save",
        "saveDifficulty",
        "applies",
        "targetCount",
        "area",
        "reaction",
        "self",
      ] as const) {
        if (action[key] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "A sequence resolves the actions it names, so it carries nothing of its own",
          });
        }
      }
    }
    // Landing on itself leaves no one else to pick or catch.
    if (action.self) {
      for (const key of ["targetCount", "area", "targets"] as const) {
        if (action[key] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "An action that lands on the creature itself takes no other target",
          });
        }
      }
    }
    // A signature action is bought between turns, and a reaction is taken at its moment: one action
    // is one or the other.
    if (action.reaction && action.signature) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signature"],
        message: "A reaction is taken at its moment, so it is not bought between turns as well",
      });
    }
    // A lair action is the lair's, on its own count (1.315): not a reaction, not bought with points.
    if (action.lair && (action.reaction || action.signature)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lair"],
        message: "A lair action is taken on its own count, so it is neither a reaction nor bought with points",
      });
    }
    if (action.save && action.saveDifficulty !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["saveDifficulty"],
        message: "This action has a save of its own, and that save's difficulty is what a save-ends uses",
      });
    }
    // A recharge nothing on its dice can reach is an action that is used once and never again, which
    // is what `uses` is for.
    if (action.recharge && action.recharge.from > action.recharge.dice.count * action.recharge.dice.sides) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recharge", "from"],
        message: `These dice roll ${action.recharge.dice.count * action.recharge.dice.sides} at most, so the action would never come back`,
      });
    }
    // A charge rides one blow at one target (1.186), and asks a save only where the blow asks none.
    if (action.charge) {
      if ((action.toHit === undefined && !action.autoHit) || action.area || (action.targetCount ?? 1) > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["charge"],
          message: "A charge rides a blow at one target: an action that rolls to hit or simply lands, with no area",
        });
      }
      if (action.charge.save && action.save) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["charge", "save"],
          message: "The action asks a save already, so its charge cannot ask another",
        });
      }
    }
    // A save with nothing to be rolled against is a save everybody passes, so it is refused here
    // rather than rolled for nothing in the middle of a turn.
    if (!action.save && action.saveDifficulty === undefined && action.applies?.some((entry) => entry.saveEnds)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["saveDifficulty"],
        message: "A condition that ends on a save needs a difficulty for that save to be rolled against",
      });
    }
  });

/** How many riders one creature may carry. Four, for the same reason a blow carries three clauses:
 *  past that nobody at a table could hold the creature in their head. */
export const RULESET_CREATURE_MAX_RIDERS = 4;

/** A rider a creature carries. The same shape a catalog entry's is, with the two keys that read a
 *  character sheet's own lists swapped for the one thing a block has: its own action ids. */
const creatureRiderSchema = z
  .object({
    id: sheetId,
    name: promptSafeText(80),
    ...riderCoreShape,
    /** The actions of this same block it fires on. Without it, any hit this creature lands. */
    actions: z.array(sheetId).min(1).max(RULESET_CREATURE_MAX_ACTIONS).optional(),
  })
  .strict()
  .superRefine(riderAmountIssue);

/** A creature described in the ruleset's OWN terms: the same keys a character sheet has, keyed by
 *  the ids the ruleset declares, and every part optional because a creature need only say what it
 *  has. Strict, unlike the sheet a character card carries, because a bestiary is authored data and
 *  a key nobody reads is a mistake to say so about. Checked against the ruleset's own names with
 *  the rest of the catalog. */
const creatureSheetSchema = z
  .object({
    abilities: z.record(z.number().finite()).default({}),
    skills: z.record(z.string().max(40)).default({}),
    saves: z.record(z.string().max(40)).default({}),
    bonuses: z.record(z.number().finite()).default({}),
    fields: z.record(sheetScalar).default({}),
    lists: z.record(z.array(z.record(sheetScalar)).max(500)).default({}),
  })
  .strict();

/** The keys a creature's sheet says for it, and so the ones it does not also give as numbers. Exported
 *  because the published JSON Schema says the same rule and must never drift from this one. */
export const RULESET_CREATURE_SHEET_REPLACES = [
  "health",
  "defense",
  "initiativeModifier",
  "speed",
  "abilities",
  "saves",
  "checks",
  "soak",
  "hardness",
] as const;
/** The keys a creature WITHOUT a sheet cannot go without. */
export const RULESET_CREATURE_PLAIN_NEEDS = ["health", "defense", "initiativeModifier"] as const;
const CREATURE_SHEET_REPLACES = RULESET_CREATURE_SHEET_REPLACES;
const CREATURE_PLAIN_NEEDS = RULESET_CREATURE_PLAIN_NEEDS;

/** One damage type a creature resists or is immune to: the word, or the word and the item tags a blow
 *  gets through with (`except`). */
const creatureHideEntrySchema = z.union([
  promptSafeText(40),
  z.object({ type: promptSafeText(40), except: z.array(sheetId).min(1).max(8) }).strict(),
]);
export type RulesetCreatureHideEntry = z.infer<typeof creatureHideEntrySchema>;

const creatureFields = {
  health: creatureHealthSchema,
  defense: z.number().int().min(0).max(1000),
  /** In the ruleset's own distance unit, read by the slice that gives a fight positions. */
  speed: z.number().finite().min(0).max(10000).optional(),
  /** How fast it moves other than walking, in the ruleset's own distance (Capability API 1.113): on a
   *  board a flier crosses water and steps of any height, a swimmer crosses water, and a climber
   *  takes steps of any height. A burrower's speed is carried for the Game Master and moves as a
   *  walk. `speed` stays its walk. */
  speeds: z
    .object({
      fly: z.number().finite().gt(0).max(10000).optional(),
      swim: z.number().finite().gt(0).max(10000).optional(),
      climb: z.number().finite().gt(0).max(10000).optional(),
      burrow: z.number().finite().gt(0).max(10000).optional(),
    })
    .strict()
    .refine((speeds) => Object.keys(speeds).length > 0, { message: "speeds names at least one way of moving" })
    .optional(),
  /** It flies without needing to keep moving (Capability API 1.113): what knocks a flier out of the
   *  air does not knock it out. Needs a `fly` speed. */
  hover: z.literal(true).optional(),
  initiativeModifier: z.number().int().min(-50).max(100),
  /** Scores, keyed by the sheet's own ability ids. Shown to the Game Master; a later slice asks a
   *  creature for a check with them. */
  abilities: z.record(z.number().int().min(-1000).max(1000)).optional(),
  /** What it adds when it saves, keyed by the sheet's own save ids. One it does not name is zero. */
  saves: z.record(z.number().int().min(-50).max(50)).optional(),
  /** What it adds in a contest, keyed by the ids of `combat.checks`. One it does not name is zero. */
  checks: z.record(z.number().int().min(-100).max(100)).optional(),
  /** Its own checks with these skills rolled twice (Capability API 1.291), only while it can see
   *  (`sight`), in one of these lights where it stands (`light`), or on one of these board tiles
   *  (`terrain`), as it says: 5e's Keen Sight `{ "skills": ["perception"], "mode": "advantage",
   *  "sight": true }`, Sunlight Sensitivity `{ ..., "mode": "disadvantage", "sight": true, "light":
   *  ["sunlight"] }`, Stone Camouflage `{ "skills": ["stealth"], "mode": "advantage", "terrain":
   *  ["rock", "mountain"] }`. */
  checkModes: z
    .array(
      z
        .object({
          skills: z.array(sheetId).min(1).max(12),
          mode: z.enum(["advantage", "disadvantage"]),
          sight: z.literal(true).optional(),
          light: z
            .array(z.enum(["sunlight", "bright", "dim", "dark"]))
            .min(1)
            .max(4)
            .optional(),
          terrain: z.array(promptSafeText(40)).min(1).max(12).optional(),
        })
        .strict(),
    )
    .min(1)
    .max(8)
    .optional(),
  /** The light it sheds (Capability API 1.294): a fire elemental, a will-o'-wisp, or bandits with
   *  torches. Read where `combat.sight.darkness` makes the dark real. */
  light: lightRadiusSchema.optional(),
  /** It begins the fight with its light out (Capability API 1.296), until one of its actions that
   *  `sheds` lights it: a magmin not yet ablaze. */
  unlit: z.literal(true).optional(),
  /** Its own light sheds nothing while one of these conditions is on it (Capability API 1.298), and
   *  comes back when it ends: a will-o'-wisp invisible, its light with it. */
  lightOutWhile: z.array(sheetId).min(1).max(8).optional(),
  /** Its own attack rolls rolled twice (Capability API 1.293), where it says, as `checkModes` hold:
   *  5e's Sunlight Sensitivity `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }`. */
  attackModes: z
    .array(
      z
        .object({
          mode: z.enum(["advantage", "disadvantage"]),
          sight: z.literal(true).optional(),
          light: z
            .array(z.enum(["sunlight", "bright", "dim", "dark"]))
            .min(1)
            .max(4)
            .optional(),
          terrain: z.array(promptSafeText(40)).min(1).max(12).optional(),
        })
        .strict()
        .refine((rule) => rule.sight || rule.light || rule.terrain, {
          message: "A mode on attacks says where it holds: sight, light or terrain",
        }),
    )
    .min(1)
    .max(8)
    .optional(),
  /** Its passive Perception as printed (Capability API 1.291), where it is not the ruleset's
   *  `hiding.passive` plus its Perception check. */
  passive: z.number().int().min(0).max(100).optional(),
  /** Its own ways of hiding and finding the hidden (Capability API 1.292), as a catalog entry's
   *  `hiding` says, and `starts`. */
  hiding: creatureHidingTraitsSchema.optional(),
  /** What it soaks in a `dice-pool` fight: `all` for any harm, and `byKind` for one kind of the
   *  health track, which wins over `all` for that kind. Nothing it does not name is soaked. */
  soak: z
    .object({
      all: z.number().int().min(0).max(100).optional(),
      byKind: z.record(z.number().int().min(0).max(100)).optional(),
    })
    .strict()
    .optional(),
  /** In a pool fight where a style spends initiative: a spending blow whose dice are below this lands
   *  and does nothing. */
  hardness: z.number().int().min(0).max(100).optional(),
  /** Its hands are not free: an action's `twoHanded` alternative does not hold (Capability API 1.102),
   *  as a 5e hobgoblin with a shield swings its longsword one-handed. */
  shield: z.literal(true).optional(),
  /** One of `combat.sizes`, by id (Capability API 1.103). A creature written as a sheet that names one
   *  is that size whatever its sheet reads. */
  size: sheetId.optional(),
  /** One of `combat.creatureTypes.types`, by id, and its tags (Capability API 1.168): a 5e dragon,
   *  a fiend tagged "devil", a humanoid tagged "goblinoid". What a target test reads. */
  type: sheetId.optional(),
  tags: z.array(sheetId).min(1).max(8).optional(),
  /** Damage types, matched without case: half, double, none at all. A resistance or an immunity may
   *  say what gets through it (`{ "type": "cut", "except": ["silver"] }`): a blow from a weapon item
   *  with any of those tags is taken as it comes. */
  resist: z.array(creatureHideEntrySchema).max(30).optional(),
  vulnerable: z.array(promptSafeText(40)).max(30).optional(),
  immune: z.array(creatureHideEntrySchema).max(30).optional(),
  /** The sheet's own condition ids this creature is never in. */
  conditionImmunities: z.array(sheetId).max(40).optional(),
  /** Conditions it has on through every fight (Capability API 1.263), as a sheet's `keepsOn` entry
   *  gives them: an aura it spreads. */
  keepsOn: uniqueIds(4).optional(),
  /** What it holds that is no action of its own (Capability API 1.267): a printed shield. A condition
   *  whose `drops` names one of its `tags` lets it fall, and its `defense` goes with it. */
  held: z
    .array(
      z
        .object({
          label: promptSafeText(40),
          tags: uniqueIds(4),
          defense: z.number().int().min(-20).max(20).optional(),
        })
        .strict(),
    )
    .min(1)
    .max(4)
    .optional(),
  /** How far it senses with each of `combat.senses`, in the ruleset's distance (Capability API
   *  1.178): a 5e goblin's `{ "darkvision": 60 }`. */
  senses: z.record(sheetId, z.number().finite().gt(0).max(10000)).optional(),
  /** The rung of `combat.threat` it was filed under. */
  tier: sheetId,
  /** Short lines the Game Master is shown and the Engine never resolves: a trait is fiction here,
   *  not a rule, so anything with numbers in it belongs in an action. */
  traits: z
    .array(z.object({ name: promptSafeText(60), text: promptSafeText(400) }).strict())
    .max(8)
    .optional(),
  /** Points given back at the start of its own turn, spent on `signature` actions. */
  signaturePoints: z.number().int().min(1).max(20).optional(),
  /** The count its `lair` actions are taken on (Capability API 1.315), losing ties: 20 when left
   *  out. */
  lairInitiative: z.number().int().min(-100).max(1000).optional(),
  /** How many failed saves it may turn into successes (Capability API 1.317), each fight: 5e's
   *  Legendary Resistance (3/Day). */
  legendaryResistance: z.number().int().min(1).max(20).optional(),
  /** Dropping to 0 hit points, it is left at 1 instead, `uses` times a fight, and with `extraTurn`
   *  takes a turn of its own straight after the one it happened in (Capability API 1.320): the
   *  showcase's Miller of Hours and its Hourglass. Not against what slays outright. */
  hangsOn: z
    .object({
      uses: z.number().int().min(1).max(10),
      extraTurn: z.literal(true).optional(),
      label: promptSafeText(60).optional(),
    })
    .strict()
    .optional(),
  /** It does not move while any of its cells is in one of these lights (Capability API 1.319): the
   *  showcase's Lantern-Shy, `["bright", "sunlight"]`. */
  stillIn: z
    .array(z.enum(["sunlight", "bright", "dim", "dark"]))
    .min(1)
    .max(4)
    .optional(),
  actions: z.array(creatureActionSchema).min(1).max(RULESET_CREATURE_MAX_ACTIONS),
  /** Catalog spells cast without spending anything off a sheet (Capability API 1.123). Omitted
   *  uses means at will; a coven spell shares its uses while enough members stand nearby. */
  spellcasting: creatureSpellcastingSchema.optional(),
  /** What this creature adds to the first qualifying hit of a period, all by itself. */
  riders: z.array(creatureRiderSchema).min(1).max(RULESET_CREATURE_MAX_RIDERS).optional(),
};

function creatureSignatureIssues(
  creature: {
    signaturePoints?: number;
    lairInitiative?: number;
    actions: Array<{ signature?: { cost: number }; lair?: true }>;
  },
  ctx: z.RefinementCtx,
): void {
  if (creature.lairInitiative !== undefined && !creature.actions.some((action) => action.lair)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lairInitiative"],
      message: "A lair's count is for its lair actions, so the creature has one",
    });
  }
  if (creature.signaturePoints === undefined && creature.actions.some((action) => action.signature)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["signaturePoints"],
      message: "An action bought with points needs signaturePoints for it to be bought from",
    });
  }
  // The points only ever come back to their maximum, so a price above it is never affordable.
  creature.actions.forEach((action, index) => {
    if (
      action.signature &&
      creature.signaturePoints !== undefined &&
      action.signature.cost > creature.signaturePoints
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions", index, "signature", "cost"],
        message: `This costs ${action.signature.cost} and the creature only ever has ${creature.signaturePoints}`,
      });
    }
  });
}

/** The keys a Game Master's sheet makes redundant. Dropped rather than refused, because a model that
 *  wrote a sheet AND a number beside it meant the creature, and the sheet is the one that says it in
 *  the ruleset's own terms. */
export const RULESET_PROPOSED_SHEET_REPLACES: readonly string[] = CREATURE_SHEET_REPLACES;

/** A creature the Game Master invents for one fight, checked against exactly this before it is held
 *  to its tier. Either the plain block, or a `sheet` in the ruleset's own terms, so an invented mage
 *  has slots and spells. The sheet is read leniently, the way a character's is, because it is a
 *  model's writing rather than an author's: what the ruleset does not have is dropped by name later,
 *  against the definition this file cannot see. */
const rulesetProposedCreatureBaseSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const creature = value as Record<string, unknown>;
    if (!creature.sheet || typeof creature.sheet !== "object") return value;
    return Object.fromEntries(
      Object.entries(creature).filter(([key]) => !RULESET_PROPOSED_SHEET_REPLACES.includes(key)),
    );
  },
  z
    .object({
      ...creatureFields,
      health: creatureFields.health.optional(),
      defense: creatureFields.defense.optional(),
      initiativeModifier: creatureFields.initiativeModifier.optional(),
      actions: z.array(creatureActionSchema).max(RULESET_CREATURE_MAX_ACTIONS).default([]),
      /** Where its live tracks stand as the fight begins, by the sheet's track ids (1.115): a bandit
       *  two levels into exhaustion. */
      tracks: z.record(sheetId, z.number().int().min(0).max(1000)).optional(),
      // Declared further down this file, so read lazily.
      sheet: z.lazy(() => rulesetSheetBuildSchema).optional(),
    })
    .strict()
    .superRefine((creature, ctx) => {
      creatureSignatureIssues(creature, ctx);
      if (creature.sheet) return;
      for (const key of CREATURE_PLAIN_NEEDS) {
        if (creature[key] !== undefined) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `A creature without a sheet needs its ${key}`,
        });
      }
      if (creature.actions.length === 0 && !creature.spellcasting) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actions"],
          message: "A creature without a sheet needs at least one action, or it has nothing to do",
        });
      }
    }),
);

/** A creature the Game Master invents for one fight: the plain block, or a sheet in the ruleset's terms.
 *  Named, so a schema built around it stays short enough for the compiler to write. */
export type RulesetProposedCreature = z.infer<typeof rulesetProposedCreatureBaseSchema>;
export const rulesetProposedCreatureSchema: z.ZodType<RulesetProposedCreature, z.ZodTypeDef, unknown> =
  rulesetProposedCreatureBaseSchema;

/** A creature a bestiary ships: the plain block, or a `sheet` in the ruleset's own terms. With a
 *  sheet it is built the way a party member is, so the numbers the sheet gives are not also given
 *  here, and there is one place each of them comes from. */
const rulesetCreatureBaseSchema = z
  .object({
    ...creatureFields,
    health: creatureFields.health.optional(),
    defense: creatureFields.defense.optional(),
    initiativeModifier: creatureFields.initiativeModifier.optional(),
    // A creature whose sheet gives it abilities may have no block actions of its own at all.
    actions: z.array(creatureActionSchema).max(RULESET_CREATURE_MAX_ACTIONS).default([]),
    sheet: creatureSheetSchema.optional(),
    /** The loot table a won fight rolls for it, by the id `items.lootTables` gives it. */
    loot: sheetId.optional(),
  })
  .strict()
  .superRefine((creature, ctx) => {
    creatureSignatureIssues(creature, ctx);
    if (creature.sheet) {
      for (const key of CREATURE_SHEET_REPLACES) {
        if (creature[key] === undefined) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `A creature with a sheet takes its ${key} from the sheet, so it does not also give it here`,
        });
      }
      return;
    }
    for (const key of CREATURE_PLAIN_NEEDS) {
      if (creature[key] !== undefined) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `A creature without a sheet needs its ${key}`,
      });
    }
    if (creature.actions.length === 0 && !creature.spellcasting) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions"],
        message: "A creature without a sheet needs at least one action, or it has nothing to do",
      });
    }
  });

/** Named, so the whole definition's inferred type stays short enough for the compiler to write. */
export type RulesetCreatureDeclaration = z.infer<typeof rulesetCreatureBaseSchema>;
export const rulesetCreatureSchema: z.ZodType<RulesetCreatureDeclaration, z.ZodTypeDef, unknown> =
  rulesetCreatureBaseSchema;

// ── Items: the vocabulary every item of the ruleset is written in ──

/** A category, rarity or tag: a name the ruleset's items use, and what it is shown as. */
const itemWordSchema = z.object({ id: sheetId, label }).strict();

/** A number or word every item may carry, declared exactly like a list column. `promptVisible` says
 *  whether the Game Master is shown it beside the item. */
const itemStatBase = { id: sheetId, label, promptVisible: z.boolean().default(true) };
export const rulesetItemStatSchema = z.discriminatedUnion("type", [
  z.object({ ...itemStatBase, ...numberFieldShape }).strict(),
  z.object({ ...itemStatBase, ...textFieldShape }).strict(),
  z.object({ ...itemStatBase, ...booleanFieldShape }).strict(),
  z.object({ ...itemStatBase, ...enumFieldShape }).strict(),
  z.object({ ...itemStatBase, ...diceFieldShape }).strict(),
]);

/** Where an item is worn or held, and how many a character has of it: one body, two hands. */
const itemSlotSchema = z.object({ id: sheetId, label, count: z.number().int().min(1).max(20) }).strict();

/** One coin of a family. `value` is how many of the family's smallest unit it is worth. */
const currencyUnitSchema = z
  .object({
    id: sheetId,
    /** The coin's name for any number of them but one ("pennies"). */
    label: promptSafeText(40),
    /** Its name for exactly one ("penny"), Capability API 1.89. `label` stands for one too without it. */
    one: promptSafeText(40).optional(),
    value: z.number().int().min(1).max(1_000_000),
  })
  .strict();

/** An amount of a coin as said: "1 penny", "3 pennies". A coin that names no `one` says its `label` for
 *  one too, as it always has. */
export function rulesetCoinAmount(unit: { label: string; one?: string }, amount: number): string {
  return `${amount} ${amount === 1 && unit.one ? unit.one : unit.label}`;
}

/** Coins that change into each other by value. Two families never do: a second nation's coin, or a
 *  setting's favours, is a family of its own. `perWeight` is how many of its coins weigh one unit of
 *  the carry stat. */
const currencyFamilySchema = z
  .object({
    id: sheetId,
    label,
    perWeight: z.number().finite().gt(0).optional(),
    units: z.array(currencyUnitSchema).min(1).max(10),
  })
  .strict();

/** One line of a loot table: one of the ruleset's items (`<catalog>/<entry>`), or any of its items a
 *  `filter` names, with how likely it is against the table's other lines and how many drop. */
const lootEntrySchema = z
  .object({
    item: z
      .string()
      .max(81)
      .regex(/^[a-z][a-z0-9_]{0,39}\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "An item is named as <catalog>/<entry>")
      .optional(),
    filter: z
      .object({ rarity: sheetId.optional(), category: sheetId.optional(), tag: sheetId.optional() })
      .strict()
      .optional(),
    /** One of the ruleset's coins, by its id: a purse's worth rather than an item. */
    coins: sheetId.optional(),
    weight: z.number().int().min(1).max(1000).default(1),
    count: z.union([z.number().int().min(1).max(999), catalogDice]).default(1),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if ([entry.item, entry.filter, entry.coins].filter((kind) => kind !== undefined).length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A loot line names an item, a filter or coins, one of them",
      });
    }
    if (entry.filter && Object.keys(entry.filter).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filter"],
        message: "A filter names a rarity, a category or a tag",
      });
    }
  });

/** One of the ruleset's items, named as `<catalog>/<entry>`. */
const rulesetItemRefSchema = z
  .string()
  .max(81)
  .regex(/^[a-z][a-z0-9_]{0,39}\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "An item is named as <catalog>/<entry>");

/** One line of starting gear (Capability API 1.78): one of the ruleset's items, coins, one item the
 *  player picks from a fixed list, or a plain item the ruleset's catalogs do not have. */
const startingGearLineSchema = z
  .object({
    item: rulesetItemRefSchema.optional(),
    coins: sheetId.optional(),
    oneOf: z.array(rulesetItemRefSchema).min(2).max(48).optional(),
    /** A plain item by name, where the ruleset lets items be plain (`freeform`). It becomes a stack's
     *  name the Game Master reads, so it is held to the ruleset's label rules. */
    name: promptSafeText(80).optional(),
    count: z.number().int().min(1).max(999).default(1),
    /** Coins rolled when the gear is taken, never again (Capability API 1.157): OSE's 3d6 x 10 gold. */
    roll: catalogDice.optional(),
    /** Coins read off the holder's sheet when the gear is taken (1.157): cash by Credit Rating. */
    countFrom: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
    /** What a rolled or read amount is multiplied by (1.157). */
    times: z.number().int().min(1).max(10000).optional(),
    /** Put on as it is taken, where its slots are free: armor and a shield are worn from the start. */
    equip: z.literal(true).optional(),
  })
  .strict()
  .superRefine((line, ctx) => {
    if (
      (line.roll !== undefined || line.countFrom !== undefined || line.times !== undefined) &&
      line.coins === undefined
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coins"],
        message: "Only coins are rolled or read off the sheet",
      });
    if (line.roll !== undefined && line.countFrom !== undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roll"],
        message: "Coins are rolled or read off the sheet, not both",
      });
    if (line.times !== undefined && line.roll === undefined && line.countFrom === undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["times"],
        message: "times multiplies a rolled or read amount",
      });
    if (line.equip && line.item === undefined && line.oneOf === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["equip"],
        message: "Only one of the ruleset's items is put on",
      });
    }
    if ([line.item, line.coins, line.oneOf, line.name].filter((kind) => kind !== undefined).length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A starting gear line names an item, coins, a list to pick one from or a plain item, one of them",
      });
    }
  });

/** Gear a character may take into their bag at the start (Capability API 1.78), never on their own:
 *  the player asks for it, once for each `group` (a class's gear beside a background's). `fits` says
 *  which characters it is for, read off the sheet; it orders the list and refuses nobody. */
const startingGearSchema = z
  .object({
    id: sheetId,
    label,
    summary: z.string().trim().max(300).optional(),
    group: sheetId.optional(),
    fits: z.object({ value: rulesetValueRefSchema, atLeast: z.number().finite() }).strict().optional(),
    lines: z.array(startingGearLineSchema).max(40).default([]),
    choices: z
      .array(
        z
          .object({
            label,
            options: z
              .array(z.object({ label, lines: z.array(startingGearLineSchema).min(1).max(40) }).strict())
              .min(2)
              .max(6),
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict()
  .superRefine((gear, ctx) => {
    if (gear.lines.length === 0 && gear.choices.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Starting gear gives something: lines or choices" });
    }
  });

/** What a treasure hoard or a creature's pockets hold: `rolls` picks (a number or dice, none at all
 *  allowed), each a line drawn by weight. */
const lootTableSchema = z
  .object({
    id: sheetId,
    label,
    rolls: z.union([z.number().int().min(0).max(20), catalogDice]).default(1),
    entries: z.array(lootEntrySchema).min(1).max(48),
  })
  .strict();

/** Which of the ruleset's items a rule or a seller means: every word it names must match. */
const itemFilterSchema = z
  .object({ rarity: sheetId.optional(), category: sheetId.optional(), tag: sheetId.optional() })
  .strict();

/** How many of something a place keeps on hand in a day (#6934): a number, or dice rolled for the day. */
const marketCountSchema = z.union([z.number().int().min(1).max(999), catalogDice]);

/** A rule or an item's own word on where it is sold: the smallest place that sells it, how many a place
 *  keeps on hand in a day (#6934), or both. */
const marketSoldShape = { place: sheetId.optional(), limited: marketCountSchema.optional() };
const soldNamesSomething = (sold: { place?: string; limited?: unknown }) =>
  sold.place !== undefined || sold.limited !== undefined;

/** What a place sells and at what price (#6917, Capability API 1.65). Buying is the Game Master's
 *  `buy`, answered with the price the Engine works out. A market day (#6934, 1.69) adds rare stock,
 *  limited items, and selling back up to a place's purse. */
const marketSchema = z
  .object({
    /** Price levels, each a multiplier on an item's cost: cheap, fair and dear, say. One is the
     *  default, the level a buy is at when the Game Master names none. */
    prices: z
      .array(
        z
          .object({
            id: sheetId,
            label,
            times: z.number().finite().gt(0).max(100),
            default: z.literal(true).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    /** Place sizes, smallest first: a hamlet, a town, a city, in the ruleset's own words. `purse` is
     *  the most a place's sellers pay out in a day for what the party sells them (#6934); without it,
     *  they buy without limit. */
    places: z
      .array(
        z
          .object({
            id: sheetId,
            label,
            purse: z
              .object({ amount: z.number().int().min(1).max(1_000_000_000), unit: sheetId })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    /** Where what a filter picks is sold: the smallest place (the first matching rule that names one
     *  deciding), and how many a place keeps on hand in a day (likewise). An item no rule reaches is
     *  sold anywhere, as many as wanted. */
    sold: z
      .array(
        z
          .object({ filter: itemFilterSchema, ...marketSoldShape })
          .strict()
          .refine(soldNamesSomething, "A rule names a place, a limit or both"),
      )
      .max(48)
      .optional(),
    /** The share of an item's default price a seller pays for it (#6934). Without it nobody here
     *  buys anything back. */
    buyBack: z.number().finite().gt(0).max(1).optional(),
    /** Kinds of seller, each with what it sells, the smallest place that has one, and who it sells
     *  to: a value on the buyer's sheet at least so high, said to the Game Master as `label`. */
    sellers: z
      .array(
        z
          .object({
            id: sheetId,
            label,
            sells: z.array(itemFilterSchema).min(1).max(12),
            place: sheetId.optional(),
            /** One of the ruleset's loot tables, rolled once a market day for what this seller has in
             *  stock on top of what they sell (#6934). */
            stock: z.object({ table: sheetId }).strict().optional(),
            /** A dishonest seller (Capability API 1.79) passes fakes off as what they pass for, from
             *  their stock, and buys a fake as what it seems. Sellers are honest unless they say so. */
            honest: z.literal(false).optional(),
            only: z
              .object({ value: rulesetValueRefSchema, atLeast: z.number().finite(), label: promptSafeText(80) })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(24)
      .optional(),
  })
  .strict();

const itemsSchema = z
  .object({
    categories: z.array(itemWordSchema).min(1).max(24),
    rarities: z.array(itemWordSchema).max(12).optional(),
    tags: z.array(itemWordSchema).max(48).optional(),
    stats: z.array(rulesetItemStatSchema).max(24).optional(),
    slots: z.array(itemSlotSchema).max(12).optional(),
    /** Attunement, investiture and the like: how many items one character may have bound at once,
     *  read off their sheet. */
    binding: z
      .object({ label: promptSafeText(40), max: rulesetValueRefSchema })
      .strict()
      .optional(),
    /** Which stat is an item's weight, and what a character carries before they are encumbered and
     *  at most, read off their sheet. Without it weight means nothing and nobody is encumbered. */
    carry: z
      .object({ stat: sheetId, encumberedAbove: rulesetValueRefSchema, limit: rulesetValueRefSchema.optional() })
      .strict()
      .optional(),
    currencies: z.array(currencyFamilySchema).max(6).optional(),
    /** The most an item the Game Master invents may give at each rarity: the largest value of each
     *  number stat, and the largest flat bonus one of its worn or carried modifiers may add (`bonus`).
     *  The ruleset's own catalog items are its author's and are never capped. */
    rarityCaps: z
      .array(
        z
          .object({
            rarity: sheetId,
            stats: z.record(z.number().finite()).optional(),
            bonus: z.number().int().min(0).max(100).optional(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    /** False forbids the Game Master to invent items of this ruleset. */
    propose: z.boolean().default(true),
    /** False turns Game Mode's own untyped items off in this ruleset's games. */
    native: z.boolean().default(true),
    /** Tables a won fight's creatures and the Game Master's `[loot:]` roll. A ruleset that declares
     *  any drops its own items instead of Game Mode's native loot. */
    lootTables: z.array(lootTableSchema).max(24).optional(),
    /** What an item the player types in becomes: a plain item, or nothing at all. */
    freeform: z.enum(["plain", "refuse"]).default("plain"),
    market: marketSchema.optional(),
    /** Gear a character may take at the start, never given on its own (Capability API 1.78). */
    startingGear: z.array(startingGearSchema).min(1).max(40).optional(),
  })
  .strict();

/** What a catalog entry of `holds: "items"` is. Every name in it is one the `items` block declares. */
/** A number or a word an item's attack reads off the item's own stat instead of writing it down, so an
 *  item made like another and given other stats fights with its own. */
const itemStatReadSchema = z.object({ stat: sheetId }).strict();
const orItemStat = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, itemStatReadSchema]);
/** Abilities an attack may use, the best of them: listed, or read from an enum stat of ability ids. */
const itemAttackAbilitiesSchema = orItemStat(z.array(sheetId).min(1).max(6));
/** A distance in the ruleset's own unit, as a combat block's attack rows measure one. */
const itemAttackDistanceSchema = orItemStat(z.number().finite().min(0).max(10000));

/**
 * What a weapon does while it is held, in the shape a combat block's attack rows have, with values in
 * place of columns: the budget it spends, what it adds to hit (the best of its `abilities`, a
 * `skill`, the proficiency bonus where `proficiency` reads above 0 off the holder's sheet, a
 * `bonus`, and in a pool fight its own per-die `target`), what it deals (`dice`, the best of its
 * `abilities`, a `bonus`, a `type`), how far it reaches and carries (a weapon with both is thrown),
 * the dice it deals with a hand free beside it (`versatile`), and how many strikes one spend buys.
 */
/** What an item adds to hit: the best of some `abilities`, a `skill`, the proficiency bonus where
 *  `proficiency` reads above 0 off the holder's sheet, a `bonus`, what `sheetBonus` reads off the
 *  holder's sheet (Capability API 1.95), and in a pool fight its own per-die `target`. A weapon's attack
 *  reads it, and so does an item's use that rolls to hit. */
// Named, so the whole definition's type stays short enough to write down (the builder's rows do the same).
const itemToHitValueRefSchema = rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>;
const itemToHitSchema = z
  .object({
    abilities: itemAttackAbilitiesSchema.optional(),
    skill: orItemStat(sheetId).optional(),
    proficiency: itemToHitValueRefSchema.optional(),
    bonus: orItemStat(z.number().int().min(-100).max(100)).optional(),
    /** A number read off the holder's sheet and added as it stands (whole numbers; a fraction is cut
     *  toward zero): what the holder brings to every weapon of a kind rather than what the weapon is,
     *  as 5e's Archery fighting style adds +2 to attacks with ranged weapons through a derived value
     *  that is 2 for an archer and 0 for anyone else (Capability API 1.95). */
    sheetBonus: itemToHitValueRefSchema.optional(),
    target: orItemStat(z.number().int().min(1).max(100)).optional(),
  })
  .strict();

/** A weapon's damage: its dice, the best of its abilities, a bonus, a type, and what its holder's sheet
 *  adds (1.97) or rerolls (1.98). Typed by name, so the definition's own type stays short enough to
 *  write down. */
const itemAttackDamageBaseSchema = z
  .object({
    dice: orItemStat(catalogDice).optional(),
    abilities: itemAttackAbilitiesSchema.optional(),
    bonus: orItemStat(z.number().int().min(-100).max(100)).optional(),
    type: orItemStat(promptSafeText(40)).optional(),
    /** A number read off the holder's sheet and added to the damage as it stands, as `toHit`'s is
     *  (Capability API 1.97): 5e's Dueling +2 through a derived value. */
    sheetBonus: itemToHitValueRefSchema.optional(),
    /** The sheet bonus counts only while the weapon is held in one hand: not a versatile weapon
     *  wielded two-handed (its hands are free for it) and not one that takes two of a slot. */
    oneHanded: z.literal(true).optional(),
    /** Read off the holder's sheet: damage dice at or below it are thrown again once, the new face
     *  standing, only while the weapon is wielded two-handed (a versatile weapon with its hands
     *  free, or one that takes two of a slot) and only in a summed fight (Capability API 1.98):
     *  5e's Great Weapon Fighting through a derived value that is 2 for the style and 0 without. */
    rerollUpTo: itemToHitValueRefSchema.optional(),
    /** The least damage dice after soak (1.146), from the holder or this item's stat. */
    minimum: orItemStat(itemToHitValueRefSchema).optional(),
  })
  .strict();
/** One more amount on an item's blow (Capability API 1.169; named for 1.190, which gives a weapon's
 *  mode its own). */
const itemPlusClauseSchema: z.ZodType<RulesetItemPlusClause, z.ZodTypeDef, unknown> = z
  .object({
    dice: catalogDice.optional(),
    flat: z.number().int().min(-1000).max(10000).optional(),
    type: promptSafeText(40).optional(),
    save: z
      .object({
        save: sheetId,
        difficulty: z.number().int().min(0).max(1000),
        onSuccess: z.enum(["none", "half"]),
      })
      .strict()
      .optional(),
    targetIs: targetIsSchema.optional(),
    /** Not dealt to a target that is this (Capability API 1.187): a sword of life stealing's
     *  necrotic, which constructs and undead do not feed. */
    not: targetIsSchema.optional(),
    when: z.enum(["always", "critical", "toggled"]).optional(),
    /** Only on a blow struck in reach, or thrown or shot (Capability API 1.187): a dwarven
     *  thrower's extra when it is hurled. */
    blow: z.enum(["melee", "ranged"]).optional(),
    /** Its holder gains temporary points equal to what this clause dealt (Capability API
     *  1.187): a sword of life stealing. */
    tempHp: z.literal(true).optional(),
    /** Only on a target carrying this condition from the wielder (Capability API 1.189): an
     *  oathbow's 3d6 against its sworn enemy. */
    marked: sheetId.optional(),
  })
  .strict()
  .superRefine((clause, ctx) => {
    if (clause.dice === undefined && clause.flat === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A clause names dice, a flat amount, or both" });
    }
  });

/** One clause of an item's blow (1.169), named so the schemas that carry it stay short enough for
 *  the compiler to write. */
export interface RulesetItemPlusClause {
  dice?: string;
  flat?: number;
  type?: string;
  save?: { save: string; difficulty: number; onSuccess: "none" | "half" };
  targetIs?: RulesetTargetIs;
  not?: RulesetTargetIs;
  when?: "always" | "critical" | "toggled";
  blow?: "melee" | "ranged";
  tempHp?: true;
  marked?: string;
}

/** Another way to make an item's attack, named for the same reason. */
export interface RulesetItemAttackMode {
  id: string;
  label: string;
  ammo?: number;
  toHit?: number;
  target?: number;
  targets?: number;
  range?: { normal: number; long?: number };
  plus?: RulesetItemPlusClause[];
  line?: {
    dice?: string;
    flat?: number;
    type?: string;
    save: { save: string; difficulty: number; onSuccess: "none" | "half" };
  };
  charges?: number;
  aroundHit?: RulesetItemAroundHit;
}
/** What a hit in a mode sets off around whoever it hit (1.312): a Hammer of Thunderbolts' clap. */
export interface RulesetItemAroundHit {
  within: number;
  save: { save: string; difficulty: number };
  condition: string;
  rounds?: number;
  of?: "source";
}
const itemAttackModeSchema: z.ZodType<RulesetItemAttackMode, z.ZodTypeDef, unknown> = z
  .object({
    id: sheetId,
    label: promptSafeText(40),
    ammo: z.number().int().min(1).max(100).optional(),
    toHit: z.number().int().min(-20).max(20).optional(),
    target: z.number().int().min(-10).max(10).optional(),
    targets: z.number().int().min(1).max(20).optional(),
    /** How far it reaches in this mode, in the ruleset's own distance (Capability API 1.190):
     *  a javelin of lightning hurled as a bolt to 120 feet. */
    range: z
      .object({
        normal: z.number().finite().gt(0).max(10000),
        long: z.number().finite().gt(0).max(10000).optional(),
      })
      .strict()
      .optional(),
    /** More on a hit in this mode (Capability API 1.190): the javelin's 4d6 lightning. */
    plus: z.array(itemPlusClauseSchema).min(1).max(RULESET_DAMAGE_MAX_PLUS).optional(),
    /** A bolt on the way (Capability API 1.190): everybody on the cells between the wielder
     *  and the target, neither of them, saves or takes this, before the attack is rolled. */
    line: z
      .object({
        dice: catalogDice.optional(),
        flat: z.number().int().min(0).max(10000).optional(),
        type: promptSafeText(40).optional(),
        save: z
          .object({
            save: sheetId,
            difficulty: z.number().int().min(0).max(1000),
            onSuccess: z.enum(["none", "half"]),
          })
          .strict(),
      })
      .strict()
      .refine((line) => line.dice !== undefined || line.flat !== undefined, {
        message: "A line deals dice, a flat amount, or both",
      })
      .optional(),
    /** The item's own charges one attack in this mode spends (Capability API 1.190); with
     *  fewer left the mode is not offered. */
    charges: z.number().int().min(1).max(100).optional(),
    /** A hit in this mode makes the one it hit, and everybody within `within` of them (the ruleset's
     *  own distance), wielder included, save or take `condition` for `rounds` of their own turns,
     *  or with `of: "source"` of the wielder's (Capability API 1.312): a Hammer of Thunderbolts
     *  hurled, "every creature within 30 feet of it ... or be stunned until the end of your next
     *  turn". */
    aroundHit: z
      .object({
        within: z.number().finite().min(0).max(10000),
        save: z.object({ save: sheetId, difficulty: z.number().int().min(0).max(1000) }).strict(),
        condition: sheetId,
        rounds: z.number().int().min(1).max(10000).optional(),
        of: z.literal("source").optional(),
      })
      .strict()
      .refine((around) => around.of === undefined || around.rounds !== undefined, {
        message: '"of" says whose turns its "rounds" count, so it goes with "rounds"',
      })
      .optional(),
  })
  .strict();

/** A value written on the item, or read from one of its own stats. */
type OrItemStat<T> = T | { stat: string };
export interface RulesetItemAttackDamage {
  dice?: OrItemStat<string>;
  abilities?: OrItemStat<string[]>;
  bonus?: OrItemStat<number>;
  type?: OrItemStat<string>;
  sheetBonus?: RulesetValueRef;
  oneHanded?: true;
  rerollUpTo?: RulesetValueRef;
  minimum?: OrItemStat<RulesetValueRef>;
}
const itemAttackDamageSchema: z.ZodType<RulesetItemAttackDamage, z.ZodTypeDef, unknown> = itemAttackDamageBaseSchema;

/** Charges its wielder may spend on a hit with the weapon (Capability API 1.273): a Staff of Power's
 *  Power Strike, a Staff of Striking's 1d6 force a charge, a Staff of Withering's 2d10 necrotic and
 *  its Constitution save. Typed by hand, as the last-charge die is. */
export interface RulesetItemAttackSpend {
  label: string;
  charges: number;
  amount: { dice?: string; flat?: number };
  type?: string;
  blow?: "melee" | "ranged";
  chargeStep?: { max: number; amount: { dice?: string; flat?: number } };
  onHit?: Array<{
    condition: string;
    rounds?: number;
    save?: { save: string; difficulty: number };
    saveEnds?: { save: string; difficulty: number; at: "turn-end" | "turn-start" | "damaged" };
  }>;
}
const itemAttackSpendSchema: z.ZodType<RulesetItemAttackSpend, z.ZodTypeDef, unknown> = z
  .object({
    label: promptSafeText(40),
    charges: z.number().int().min(1).max(100),
    amount: z.object(catalogAmountShape).strict(),
    type: promptSafeText(40).optional(),
    /** Only on a blow of this kind: a Staff of Striking's melee attack. */
    blow: z.enum(["melee", "ranged"]).optional(),
    /** Up to `max` more charges spent on the same hit, each adding `amount`: a Staff of Striking's
     *  three. */
    chargeStep: z
      .object({ max: z.number().int().min(1).max(20), amount: z.object(catalogAmountShape).strict() })
      .strict()
      .optional(),
    /** Conditions the one it hit takes, each kept off by a made `save` where it names one. */
    onHit: z
      .array(
        z
          .object({
            condition: sheetId,
            rounds: z.number().int().min(1).max(10000).optional(),
            save: z
              .object({ save: sheetId, difficulty: z.number().int().min(0).max(1000) })
              .strict()
              .optional(),
            saveEnds: z
              .object({
                save: sheetId,
                difficulty: z.number().int().min(0).max(1000),
                at: z.enum(["turn-end", "turn-start", "damaged"]),
              })
              .strict()
              .optional(),
          })
          .strict()
          .refine((entry) => entry.saveEnds === undefined || entry.rounds === undefined, {
            message: "A condition that ends on a save lasts until it is made, not some rounds",
            path: ["rounds"],
          }),
      )
      .min(1)
      .max(2)
      .optional(),
  })
  .strict()
  .refine((spend) => spend.amount.dice !== undefined || spend.amount.flat !== undefined, {
    message: "What spending charges on a hit adds is dice, a flat amount, or both",
    path: ["amount"],
  })
  .refine(
    (spend) =>
      !spend.chargeStep || spend.chargeStep.amount.dice !== undefined || spend.chargeStep.amount.flat !== undefined,
    { message: "A charge more adds dice, a flat amount, or both", path: ["chargeStep", "amount"] },
  );

export const rulesetItemAttackSchema = z
  .object({
    budget: sheetId,
    toHit: itemToHitSchema.default({}),
    damage: itemAttackDamageSchema,
    reach: itemAttackDistanceSchema.optional(),
    range: z
      .object({ normal: itemAttackDistanceSchema, long: itemAttackDistanceSchema.optional() })
      .strict()
      .optional(),
    versatile: z
      .object({ dice: orItemStat(catalogDice) })
      .strict()
      .optional(),
    strikes: rulesetValueRefSchema.optional(),
    /** What it shoots: `perAttack` of a carried item with this tag goes with each attack (one when it
     *  says nothing), and after a fight the party wins, `recover` of what was shot comes back, a share
     *  rounded down. */
    ammo: z
      .object({
        tag: sheetId,
        perAttack: z.number().int().min(1).max(100).optional(),
        recover: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    /** A loaded count kept on the weapon itself: attacks spend what is loaded, and a reload on the
     *  `reload` budget fills it to `max`, out of what it shoots where it shoots anything. */
    clip: z
      .object({ max: orItemStat(z.number().int().min(1).max(1000)), reload: sheetId })
      .strict()
      .optional(),
    /** Other ways to make this attack, offered beside it: how many one shoots (`ammo`), what it adds
     *  to hit (dice in a pool fight), a pool fight's per-die `target` moved by this much, and how
     *  many it may be aimed at. */
    modes: z.array(itemAttackModeSchema).min(1).max(6).optional(),
    /** Held beside another weapon marked so, it may strike again on the ruleset's off-hand budget
     *  once its holder has attacked with the other this turn. */
    offHand: z.literal(true).optional(),
    /** The least a hit deals, before a resistance halves it: a pool fight's harm after soak, a summed
     *  fight's damage. */
    floor: orItemStat(z.number().int().min(1).max(100)).optional(),
    /** A condition the target takes when the harm the blow dealt reaches `atLeast`, for `rounds` of
     *  their own turns or until something takes it off. */
    onHit: z
      .array(
        z
          .object({
            condition: sheetId,
            atLeast: z.number().int().min(1).max(100),
            rounds: z.number().int().min(1).max(100).optional(),
            /** The target saves against it, and a success keeps it off (Capability API 1.169). */
            save: z
              .object({ save: sheetId, difficulty: z.number().int().min(0).max(1000) })
              .strict()
              .optional(),
            /** It lasts until its holder makes this save, rolled at the start or end of each of their
             *  turns or on damage above zero (Capability API 1.169): a sword of wounding's wound, Con 15
             *  at the turn's start. */
            saveEnds: z
              .object({
                save: sheetId,
                difficulty: z.number().int().min(0).max(1000),
                at: z.enum(["turn-end", "turn-start", "damaged"]),
              })
              .strict()
              .optional(),
            /** Only on a target that is this (Capability API 1.187): a giant slayer's knockdown of a
             *  giant. */
            targetIs: targetIsSchema.optional(),
            /** At most once in any one turn, the holder's or anybody else's (Capability API 1.187): a
             *  sword of wounding's wound. */
            oncePerTurn: z.literal(true).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4)
      .optional(),
    /** More to hit against a target that is this (Capability API 1.187): a mace of smiting's +2 more
     *  against constructs. Its damage is a `plus` clause with the same `targetIs`. Since Capability
     *  API 1.189 the target may instead be one carrying a condition the wielder put on it
     *  (`marked`), and the attack may roll twice (`mode`), ignore cover short of total
     *  (`ignoresCover`) and long range (`ignoresLongRange`): an oathbow's sworn enemy. */
    against: z
      .array(
        z
          .object({
            is: targetIsSchema.optional(),
            marked: sheetId.optional(),
            toHit: z.number().int().min(-20).max(20).optional(),
            mode: z.enum(["advantage", "disadvantage"]).optional(),
            ignoresCover: z.literal(true).optional(),
            ignoresLongRange: z.literal(true).optional(),
          })
          .strict()
          .superRefine((entry, ctx) => {
            if (entry.is === undefined && entry.marked === undefined) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'An "against" names who it is against: "is", "marked" or both',
              });
            }
            if (
              entry.toHit === undefined &&
              entry.mode === undefined &&
              !entry.ignoresCover &&
              !entry.ignoresLongRange
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'An "against" changes something: toHit, mode, ignoresCover or ignoresLongRange',
              });
            }
          }),
      )
      .min(1)
      .max(4)
      .optional(),
    /** A hit that leaves its target at `healthAtMost` or less kills it outright, on a failed `save`
     *  where it has one (Capability API 1.187): a mace of disruption against fiends and undead, a
     *  mace of smiting's construct, a nine lives stealer (on a `critical`, spending a `charges` of
     *  the item's own when it slays), a vorpal sword's beheading. `is` and `not` say who it can kill,
     *  and a target immune to one of `immuneTo` is spared. */
    slay: z
      .array(
        z
          .object({
            when: z.enum(["always", "critical"]).optional(),
            is: targetIsSchema.optional(),
            not: targetIsSchema.optional(),
            immuneTo: z.array(promptSafeText(40)).min(1).max(8).optional(),
            healthAtMost: z.number().int().min(0).max(100000).optional(),
            save: z
              .object({ save: sheetId, difficulty: z.number().int().min(0).max(1000) })
              .strict()
              .optional(),
            charges: z.number().int().min(1).max(100).optional(),
            /** What a target that makes the save takes instead (Capability API 1.192): a mace of
             *  disruption's fiend or undead, frightened of the wielder until the end of the
             *  wielder's next turn. Needs a `save`. */
            saved: z.array(catalogAppliesSchema).min(1).max(2).superRefine(linkedApplies).optional(),
          })
          .strict()
          .refine((entry) => entry.saved === undefined || entry.save !== undefined, {
            message: 'A slay that leaves "saved" conditions needs a "save" to make',
            path: ["saved"],
          }),
      )
      .min(1)
      .max(3)
      .optional(),
    /** Its damage ignores the target's resistance to its own damage type (Capability API 1.192),
     *  resistance to every kind of harm included: a vorpal sword's slashing. */
    ignoresResistance: z.literal(true).optional(),
    /** Who it fells on Held Ground is reaped there and then (Capability API 1.323): the showcase's
     *  Reaping Hook. */
    reaps: z.literal(true).optional(),
    /** What its damage takes off the target's health comes back only with a rest, never from a heal
     *  (Capability API 1.193): a sword of wounding. Written to a sheet's pool, so it holds after the
     *  fight until any rest. */
    healedOnlyByRest: z.literal(true).optional(),
    /** While a creature the wielder put this condition on still stands, the wielder's attacks with
     *  every OTHER weapon roll with `mode`, or only the ranged ones with `ranged` (Capability API
     *  1.192): an oathbow's disadvantage while its sworn enemy lives. */
    othersWhileMarked: z
      .object({ condition: sheetId, mode: z.enum(["advantage", "disadvantage"]), ranged: z.literal(true).optional() })
      .strict()
      .optional(),
    /** More damage on the same blow, each rolled and typed on its own (Capability API 1.169): a
     *  javelin of lightning's lightning, a dragon slayer's dice against dragons (`targetIs`), a
     *  sword of sharpness's extra on a critical hit only (`when: "critical"`). A clause's save names
     *  its own difficulty: an item's blow has no save of its own to borrow one from. */
    plus: z.array(itemPlusClauseSchema).min(1).max(RULESET_DAMAGE_MAX_PLUS).optional(),
    /** Charges its wielder may spend once it hits (Capability API 1.273), each entry its own choice
     *  at that moment: more damage, more for each charge more, and conditions with their saves. The
     *  item holds charges. */
    spends: z.array(itemAttackSpendSchema).min(1).max(4).optional(),
  })
  .strict();
export type RulesetItemAttack = z.infer<typeof rulesetItemAttackSchema>;

/**
 * What an item does when it is used, in the words a catalog entry's `mechanics` has (heal, harm, a
 * save, conditions, temporary points, range and area, and since Capability API 1.174 concentration
 * and an area that stays, as a spell scroll's spell has), less what only a sheet row can mean: a
 * cost off a pool, a check, a reaction, scaling and a turn's economy. It spends its own
 * `budget` (unless `free`), rolls to hit with its own `toHit` where it rolls, and asks its own
 * `saveDifficulty` where it asks a save. It may take the item off its stack (`consumes`) or spend the
 * item's `charges`, and may `restore` a pool of whoever it lands on.
 */
/** The most charges an item holds, written down or read off a stat, and so the most one use spends. */
export const RULESET_ITEM_CHARGES_MAX = 100;

/** An item's last-charge die (Capability API 1.61; `regains`, and `atMost` optional, 1.271). Typed
 *  by hand: written out, its inferred type is too long for the definition schema around it to emit. */
export interface RulesetItemLastCharge {
  die: number;
  atMost?: number;
  regains?: { atLeast: number; amount: { dice?: string; flat?: number } };
  /** On the faces that would break it, it becomes this item instead (Capability API 1.272): a Staff
   *  of Striking's nonmagical quarterstaff. */
  becomes?: string;
}
const itemLastChargeSchema: z.ZodType<RulesetItemLastCharge, z.ZodTypeDef, unknown> = z
  .object({
    die: z.number().int().min(2).max(100),
    atMost: z.number().int().min(1).max(100).optional(),
    regains: z
      .object({
        atLeast: z.number().int().min(1).max(100),
        amount: z.object(catalogAmountShape).strict(),
      })
      .strict()
      .optional(),
    becomes: rulesetItemRefSchema.optional(),
  })
  .strict()
  .superRefine((breaks, ctx) => {
    if (breaks.becomes !== undefined && breaks.atMost === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["becomes"],
        message: 'An item becomes another on the faces that would break it, so "becomes" goes with "atMost"',
      });
    }
    if (breaks.atMost !== undefined && breaks.atMost > breaks.die) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["atMost"],
        message: "A break is at most the die's own faces",
      });
    }
    if (breaks.atMost === undefined && !breaks.regains) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["atMost"],
        message: 'The last charge\'s die breaks the item ("atMost"), gives charges back ("regains"), or both',
      });
    }
    const regains = breaks.regains;
    if (
      regains &&
      (regains.atLeast > breaks.die || (breaks.atMost !== undefined && regains.atLeast <= breaks.atMost))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["regains", "atLeast"],
        message: "Charges come back on faces the die has, above any that break it",
      });
    }
    if (regains && regains.amount.dice === undefined && regains.amount.flat === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["regains", "amount"],
        message: "Charges given back say how many",
      });
    }
  });

/** More charges a use may spend (Capability API 1.269; `push`, 1.271). Typed by hand, as above. */
export interface RulesetItemChargeStep {
  max: number;
  amount?: { dice?: string; flat?: number };
  targets?: number;
  push?: number;
}
const itemChargeStepSchema: z.ZodType<RulesetItemChargeStep, z.ZodTypeDef, unknown> = z
  .object({
    max: z.number().int().min(1).max(20),
    amount: z.object(catalogAmountShape).strict().optional(),
    targets: z.number().int().min(1).max(10).optional(),
    /** Farther pushed for each, in the ruleset's distance (Capability API 1.271): a Ring of the
     *  Ram's 5 feet a charge. */
    push: z.number().finite().gt(0).max(10000).optional(),
  })
  .strict();

export const rulesetItemUseSchema = catalogMechanicsObject
  .omit({
    kind: true,
    // Sense needs belong to catalog entries and creature actions (1.127).
    needs: true,
    needsAny: true,
    cost: true,
    perCostStep: true,
    targetsPerCostStep: true,
    check: true,
    summons: true,
    scales: true,
    conjures: true,
    repeats: true,
    standard: true,
    rider: true,
  })
  .extend({
    /** `utility` (Capability API 1.181) is a use that only leaves an area standing: a scroll of Fog
     *  Cloud, Darkness or Silence; or one that teleports (1.276): a cape's Dimension Door. */
    kind: z.enum(["attack", "heal", "buff", "debuff", "utility"]),
    // A wall's thickness and a ring are a wand's or a scroll's too (1.177), and a line's width
    // (1.184): a scroll of Gust of Wind.
    area: z
      .object({
        shape: z.enum(["burst", "cone", "line", "box", "wall"]),
        size: z.number().finite().gt(0),
        width: z.number().finite().gt(0).optional(),
        ring: z.number().finite().gt(0).optional(),
        copies: z.number().int().min(2).max(10).optional(),
        // Its copies spaced out (1.301): a scroll of Dancing Lights.
        copiesWithin: z.number().finite().gt(0).max(10000).optional(),
      })
      .strict()
      .refine((area) => area.copiesWithin === undefined || area.copies !== undefined, {
        message: '"copiesWithin" spaces out its copies, so it has "copies"',
        path: ["copiesWithin"],
      })
      .refine((area) => area.copies === undefined || area.shape === "burst" || area.shape === "box", {
        message: "Only a burst or a box is set down several times",
        path: ["copies"],
      })
      .refine((area) => area.width === undefined || area.shape === "wall" || area.shape === "line", {
        message: "Only a line or a wall carries width on an item's use",
        path: ["width"],
      })
      .refine((area) => area.ring === undefined || area.shape === "wall", {
        message: "Only a wall is a ring",
        path: ["ring"],
      })
      .optional(),
    toHit: itemToHitSchema.optional(),
    saveDifficulty: orItemStat(z.number().int().min(0).max(100)).optional(),
    /** The save difficulty read off its holder's own sheet instead (Capability API 1.269): a staff
     *  cast "using your spell save DC". */
    sheetDifficulty: itemToHitValueRefSchema.optional(),
    /** Added to `amount`, read off its holder's own sheet as the fight begins (Capability API 1.271):
     *  a Staff of Healing's Cure Wounds plus its holder's spellcasting modifier. Needs an amount. */
    amountAdd: itemToHitValueRefSchema.optional(),
    /** What the menu calls it beside the item's name (Capability API 1.271), as a `moreUses` label
     *  is: a staff's first spell. */
    label: promptSafeText(60).optional(),
    /** More charges its user may spend on it (Capability API 1.269), up to `max` beyond `charges`:
     *  each adds `amount` and `targets`, and counts as one step of a higher cost (a Staff of Power's
     *  spell cast at a higher level, a Staff of Striking's 1d6 force a charge). */
    chargeStep: itemChargeStepSchema.optional(),
    consumes: z.literal(true).optional(),
    /** Using it casts an entry of this catalog (Capability API 1.180), as a scroll or a wand does: a
     *  condition that ends when its holder casts from that catalog ends when they use it. */
    casts: sheetId.optional(),
    /** Only a creature this size or smaller is a target (Capability API 1.317), one of
     *  `combat.sizes`: a scroll of Resilient Sphere's "Large size or smaller". */
    targetsUpTo: sheetId.optional(),
    /** Takes growth off the cells its area covers (Capability API 1.318): pruning shears. */
    clears: z.literal("growth").optional(),
    charges: z.number().int().min(1).max(RULESET_ITEM_CHARGES_MAX).optional(),
    /** A pool of the user's sheet it gives back some of, as a blood bag gives back blood. */
    restore: z
      .object({ pool: sheetId, amount: z.object(catalogAmountShape).strict() })
      .strict()
      .optional(),
    /** A check its user passes before it works, as a scroll above the reader's own spells asks for
     *  one, unless a value on their sheet is high enough. A failed check uses the item up for
     *  nothing. `check` names what is rolled: a skill, an ability, or a value off the sheet. */
    gate: z
      .object({
        check: z.union([
          z.object({ skill: sheetId }).strict(),
          z.object({ ability: sheetId }).strict(),
          z.object({ value: rulesetValueRefSchema }).strict(),
        ]),
        difficulty: orItemStat(z.number().int().min(1).max(100)),
        unless: z.object({ value: rulesetValueRefSchema, atLeast: z.number().finite() }).strict().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((use, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (use.plus && !use.amount) issue("plus", "A clause needs an amount beside it");
    if (use.plus && use.kind === "heal") issue("plus", "A heal carries no damage clauses");
    // A scroll of Acid Arrow (1.257), as the spell's own entry does (1.255).
    if (use.halfOnMiss && (!use.attackRoll || !use.amount || use.kind === "heal")) {
      issue("halfOnMiss", '"halfOnMiss" is on a use that rolls to hit ("attackRoll") and deals an "amount"');
    }
    if (use.free && use.budget !== undefined) issue("free", "Something free spends no budget, so it names none");
    // Taken as a reaction (Capability API 1.322): Liesl's Coffin, the Straw Proxy. It says what it answers.
    if (use.reaction === true) issue("reaction", "An item's use taken as a reaction says the moment it answers");
    if (use.consumes && use.charges !== undefined) {
      issue("charges", "A use that uses the item up spends no charges of it");
    }
    if (use.sheetDifficulty && use.saveDifficulty !== undefined) {
      issue("sheetDifficulty", "A save difficulty is the item's own or read off the sheet, not both");
    }
    if (use.chargeStep && use.charges === undefined) {
      issue("chargeStep", 'More charges go beside the "charges" a use spends');
    }
    // Where a teleport goes is picked as it is used (Capability API 1.276), never aimed.
    if (use.teleport && use.area) issue("teleport", "A teleport goes where its user picks, so it is not an area");
    if (use.teleport?.strike)
      issue(
        "teleport",
        "A teleport's strike is one of a creature's own actions, so only a creature's teleport names one",
      );
    // A kind named as it is used (Capability API 1.274), as a spell names one (1.270): a scroll of
    // Antipathy/Sympathy.
    if (use.kindChoice && !use.applies?.length) {
      issue("kindChoice", 'The kind chosen is remembered by what it puts on, so "kindChoice" goes with "applies"');
    }
    if (
      use.chargeStep &&
      !use.chargeStep.targets &&
      !use.chargeStep.push &&
      !use.chargeStep.amount?.dice &&
      !use.chargeStep.amount?.flat
    ) {
      issue("chargeStep", "A charge more adds an amount, targets, a push, or some of them");
    }
    if (use.amountAdd && !use.amount) issue("amountAdd", "amountAdd adds to an amount: give the amount too");
    if (use.restore && use.restore.amount.dice === undefined && use.restore.amount.flat === undefined) {
      issue("restore", "A restore says how much it gives back");
    }
    // Giving back is help: a use aimed to harm restores nobody's pool.
    if (use.restore && use.kind !== "heal" && use.kind !== "buff") {
      issue("restore", "A restore is on a use that helps, a heal or a buff");
    }
    if (use.kind === "utility" && !use.teleport && !use.clears && (!use.zone || !use.area)) {
      issue(
        "kind",
        "A utility use leaves an area standing, clears growth or teleports, so it has an area and a zone, clears, or a teleport",
      );
    }
    // A scroll's or a wand's beams and darts (Capability API 1.308), as the spell's own (1.305).
    for (const key of ["targetsScale", "targetsRepeat"] as const) {
      if (use[key] && (use.targets === "self" || use.area)) {
        issue(key, `"${key}" is on a use pointed at creatures, not an area or its user`);
      }
    }
    // An area that stays, as a scroll of the spell leaves one (1.174).
    const zone = zoneIssue(use);
    if (zone) issue("zone", zone);
  });
export type RulesetItemUse = z.infer<typeof rulesetItemUseSchema>;
/** One more thing an item does when used (1.267), named for the menu. Typed by hand, as written out
 *  its inferred type is too long for the item schema around it to emit. */
export interface RulesetItemMoreUse {
  label: string;
  use: RulesetItemUse;
}
const itemMoreUseSchema: z.ZodType<RulesetItemMoreUse, z.ZodTypeDef, unknown> = z
  .object({ label: promptSafeText(40), use: rulesetItemUseSchema })
  .strict();

const catalogItemObjectSchema = z
  .object({
    category: sheetId,
    rarity: sheetId.optional(),
    tags: z.array(sheetId).max(16).optional(),
    /** Values for the declared stats, each one its stat could hold. */
    stats: z.record(sheetScalar).optional(),
    /** How many of each slot the item takes while worn or held. */
    slots: z.record(z.number().int().min(1).max(20)).optional(),
    /** The most one stack holds. Without it a stack holds as many as any Game Mode stack. */
    stack: z.number().int().min(1).max(GAME_INVENTORY_MAX_QUANTITY).optional(),
    cost: z
      .object({ amount: z.number().int().min(0).max(1_000_000_000), unit: sheetId })
      .strict()
      .optional(),
    /** The smallest of the market's places that sells it, over any rule that would say otherwise. */
    sold: z
      .object(marketSoldShape)
      .strict()
      .refine(soldNamesSomething, "Sold names a place, a limit or both")
      .optional(),
    /** Lodging, passage, a blessing: bought like an item, never carried. Buying it only pays. */
    service: z.literal(true).optional(),
    /** What an honest seller warns of before selling it, for an item whose chance can turn on the
     *  buyer (Capability API 1.79). */
    risky: promptSafeText(160).optional(),
    /** A fake (Capability API 1.79): the ruleset item it passes for, "<catalog>/<entry>". A dishonest
     *  seller sells it as that item, at that item's price; an honest one never sells it. */
    passesFor: rulesetItemRefSchema.optional(),
    /** The item has to be bound (attuned, invested) before it does anything while worn. */
    binds: z
      .object({
        restriction: catalogText(200).optional(),
        cursed: z.boolean().optional(),
        /** Items its bearer must have worn to bind it, one of each group's `anyOf`, each bound where
         *  it binds (Capability API 1.313): a Hammer of Thunderbolts needs a belt of giant strength
         *  and the gauntlets of ogre power. It is unbound as soon as one comes off. */
        needsWorn: z
          .array(z.object({ anyOf: z.array(rulesetItemRefSchema).min(1).max(12) }).strict())
          .min(1)
          .max(4)
          .optional(),
      })
      .strict()
      .optional(),
    /** What it does while worn: on, and bound where it binds. */
    worn: z.lazy(() => rulesetItemEffectSchema).optional(),
    /** What it does while it is only carried. */
    carried: z.lazy(() => rulesetItemEffectSchema).optional(),
    /** What it asks of whoever wears it, and what applies while they fall short. */
    requires: z.lazy(() => z.array(rulesetItemRequirementSchema).min(1).max(4)).optional(),
    /** What it does as a weapon in a fight, while it is worn. */
    attack: rulesetItemAttackSchema.optional(),
    /** What it does when it is used: from the bag, or while worn where it takes a slot or binds. */
    use: rulesetItemUseSchema.optional(),
    /** Other things it does when used, each its own choice on the menu named by `label` and paid
     *  from the same charges (Capability API 1.267): a wand of fear's Command beside its cone, a
     *  staff's spells. Only beside a `use`. */
    moreUses: z.array(itemMoreUseSchema).min(1).max(8).optional(),
    /** How many charges it holds, which its use spends. The count is kept on its stack. */
    charges: z
      .object({
        max: orItemStat(z.number().int().min(1).max(RULESET_ITEM_CHARGES_MAX)),
        /** Which of the ruleset's rests bring them back, and how many: all of them, or an amount. */
        recharge: z
          .object({
            rests: z.array(sheetId).min(1).max(12),
            amount: z.union([z.literal("max"), z.object(catalogAmountShape).strict()]),
          })
          .strict()
          .optional(),
        /** A die rolled when a use spends the last charge: at or under `atMost`, the item breaks; at or
         *  over `regains.atLeast` (Capability API 1.271), it gets back `regains.amount` charges, a
         *  Staff of the Magi's 1d12 + 1 on a 20. Either, or both. */
        breaksOn: itemLastChargeSchema.optional(),
      })
      .strict()
      .optional(),
    /** A switch its holder turns on and off (Capability API 1.170), a command word: `label` says what
     *  it does ("Ignite"), and turning it either way in a fight spends `budget`. Kept on its stack, so
     *  it stays as it was left; it starts off. A weapon's `plus` clause `when: "toggled"` is dealt
     *  only while it is on: 5e's flame tongue. */
    toggle: z
      .object({
        label: promptSafeText(40),
        budget: sheetId,
        /** The light it sheds while switched off (Capability API 1.296), in place of its effect's:
         *  a hooded lantern with its hood down, dim light 5 feet. */
        offLight: lightRadiusSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Typed by its own name (1.271): written out, the item's inferred type is too long for the
 *  definition schema around it to emit. */
export type RulesetCatalogItem = z.infer<typeof catalogItemObjectSchema>;
const catalogItemSchema: z.ZodType<RulesetCatalogItem, z.ZodTypeDef, unknown> = catalogItemObjectSchema;

/** What a catalog entry gives a character when it is picked through the guided builder (Capability API
 *  1.86), and takes back when it is unpicked. The catalog picker ignores it. */
export interface RulesetCatalogGrants {
  ratings?: RulesetBuilderRatingGrant[];
  abilities?: {
    add?: Record<string, number>;
    choose?: (RulesetBuilderChoice & {
      amount: number;
      from?: string[];
      except?: string[];
      repeat?: boolean;
      upTo?: number;
      partialFrom?: number;
    })[];
  };
  trained?: { skills?: string[]; saves?: string[]; choose?: RulesetBuilderTrainedChoice[]; tier?: string };
  sets?: Record<string, number | string | boolean>;
  itemAccess?: string[];
  entries?: {
    choose: (RulesetBuilderChoice &
      RulesetBuilderCatalogLimits & { catalog: string; filters?: Record<string, number | string>; ids?: string[] })[];
  };
}
const catalogGrantsSchema: z.ZodType<RulesetCatalogGrants, z.ZodTypeDef, unknown> = z
  .object({
    ratings: z.array(builderRatingGrantSchema).min(1).max(120).optional(),
    abilities: z
      .object({
        add: z.record(z.number().int().min(-20).max(20)).optional(),
        /** Scores of the player's choosing, `amount` each, never one twice and never one in `except`. */
        choose: z
          .array(
            z
              .object({
                ...builderChoiceBase,
                from: z.array(sheetId).min(1).max(20).optional(),
                count: z.number().int().min(1).max(6),
                amount: z.number().int().min(-20).max(20),
                except: z.array(sheetId).max(20).optional(),
                /** A score may be chosen more than once, `amount` each time (Capability API 1.93): count 2
                 *  and amount 1 is +2 to one score or +1 to two, as an ability score improvement. */
                repeat: z.boolean().optional(),
                /** No score goes past this through the choice (Capability API 1.96): an ability score
                 *  improvement's "you can't increase an ability score above 20 using this feature".
                 *  What other grants add counts first. */
                upTo: z.number().int().min(1).max(99).optional(),
                /** A score already at or above this when the choice comes gets a partial increase
                 *  (Capability API 1.211): two partials give `amount` once. Pathfinder 2e's boost to a
                 *  +4 modifier. Choices count in the order the builder makes them. */
                partialFrom: z.number().int().min(-20).max(99).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(3)
          .optional(),
      })
      .strict()
      .optional(),
    trained: z
      .object({
        skills: z.array(sheetId).max(40).optional(),
        saves: z.array(sheetId).max(20).optional(),
        choose: z.array(builderTrainedChoiceSchema).min(1).max(4).optional(),
        /** The tier they are trained to: the first one above untrained when left out. */
        tier: sheetId.optional(),
      })
      .strict()
      .optional(),
    /** Field values (a class's hit die, its spellcasting ability). */
    sets: z.record(z.union([z.number().finite(), z.string().max(200), z.boolean()])).optional(),
    /** Items the character may take without carrying them from the start (Capability API 1.215): a
     *  Blades playbook's items, chosen as load when a score begins. Nothing goes in the bag. */
    itemAccess: z.array(rulesetItemRefSchema).min(1).max(48).optional(),
    /** Entries of another catalog of rows for the player to choose, `count` of them, among those that
     *  match `filters` and, when given, are one of `ids` (a language of your choice, one of three
     *  artisan's tools; Capability API 1.91). Chosen at the builder's `choices` step for that catalog,
     *  and their rows go on the sheet. */
    entries: z
      .object({
        choose: z
          .array(
            z
              .object({
                ...builderChoiceBase,
                ...builderCatalogLimits,
                catalog: sheetId,
                count: z.number().int().min(1).max(20),
                filters: z.record(z.union([z.number().finite(), z.string().max(80)])).optional(),
                ids: z.array(z.string().max(80)).min(1).max(120).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(6),
      })
      .strict()
      .optional(),
  })
  .strict();

const catalogEntrySchema = z
  .object({
    id: z.string().max(80).regex(RULESET_ID_PATTERN, "An entry id is lowercase letters, digits and single hyphens"),
    label: promptSafeText(120),
    summary: catalogText(300).optional(),
    icon: artIconRef.optional(),
    /** Values for the catalog's declared filters: a number, one word, or a list of words. */
    filters: z
      .record(z.union([z.number().finite(), z.string().max(80), z.array(z.string().max(80)).max(24)]))
      .optional(),
    /** What picking the entry writes. One entry may fill several lists: a feature plus the counter
     *  that tracks its uses is one pick, not two. */
    rows: z.array(catalogEntryRowSchema).min(1).max(6).optional(),
    mechanics: catalogMechanicsSchema.optional(),
    /** An opponent instead of rows. An entry is one or the other, never both: rows are picked onto
     *  a character sheet and a creature is put on the other side of a fight. */
    creature: rulesetCreatureSchema.optional(),
    /** A thing to carry instead: it goes into Game Mode's inventory, not onto a sheet or into a fight. */
    item: catalogItemSchema.optional(),
    /** What a pick through the guided builder gives (1.86). An entry that grants may write no rows. */
    grants: catalogGrantsSchema.optional(),
    /** A group this entry shares with others a builder step offers (Capability API 1.94): a step keeps
     *  one pick of a group, so picking one drops the other ("a feat in place of an ability score
     *  improvement"). */
    exclusive: sheetId.optional(),
    /** Read off the sheet as it stands: a builder step offers this entry only while it reads above 0
     *  (Capability API 1.99), as 5e offers a second class only when its prerequisites are met. A pick
     *  that later reads 0 counts for nothing and is kept. An entry of an `exclusive` group is read on
     *  the sheet without the step's picks of that group (1.100). */
    offeredWhen: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const kinds = [entry.rows, entry.creature, entry.item].filter((kind) => kind !== undefined).length;
    if (kinds > 1 || (kinds === 0 && !entry.grants)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An entry has exactly one of "rows", "creature" or "item", or only "grants"',
      });
    }
    if (entry.grants && (entry.creature || entry.item)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grants"],
        message: "Only an entry for a sheet grants anything; a creature or an item is never picked onto one",
      });
    }
    if (entry.creature && entry.mechanics) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mechanics"],
        message: "A creature says what it does in its own actions, so it carries no mechanics",
      });
    }
    if (entry.item && entry.mechanics) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mechanics"],
        message: "An item is written only in its item block, so it carries no mechanics",
      });
    }
  });

const catalogSchema = z
  .object({
    id: sheetId,
    label,
    /** What this catalog's entries are. `rows` is the picker's own kind, offered on every list the
     *  catalog feeds; `creatures` is a bestiary and `items` the things a party carries. Neither of
     *  those writes anything onto a sheet, so the picker never offers them at all. */
    holds: z.enum(["rows", "creatures", "items"]).default("rows"),
    /** The sheet lists this catalog's entries may write rows into. */
    feeds: z.array(sheetId).min(1).max(8).optional(),
    filters: z.array(catalogFilterSchema).max(8).optional(),
    /** What a `mechanics.range` or `area.size` number means here, for the later combat bridge. */
    units: z
      .object({
        distance: z
          .object({ label: promptSafeText(12), perCell: z.number().finite().gt(0) })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    entries: z.array(catalogEntrySchema).max(RULESET_CATALOG_MAX_ENTRIES).optional(),
    /** A package asset instead, for a list too long to sit inside the 512 KB ruleset file. */
    // The shape is checked here so an author's editor flags a wrong path; that it names THIS
    // catalog's id is the refinement below.
    asset: z
      .string()
      .max(240)
      .regex(RULESET_CATALOG_ASSET_PATTERN, "A catalog asset is catalogs/<catalog id>.json")
      .optional(),
    /** Or another installed ruleset's catalog, borrowed whole (Capability API 1.220): a D&D 5e
     *  ruleset may fight the SRD's creatures, and cast its spells, out of the Engine's own 5e. Its entries are
     *  read against THIS ruleset, so one that names what this ruleset lacks is left out (and logged),
     *  and a borrowed creature's art is matched as the lender's. `entries` beside it add to the
     *  borrowed ones or replace one of the same id. */
    from: z
      .object({
        ruleset: z
          .string()
          .max(64)
          .regex(RULESET_ID_PATTERN, "A ruleset id is lowercase letters, digits and single hyphens"),
        catalog: sheetId,
        /** How a borrowed entry, written in the lender's ids, reads in this ruleset's: a creature's
         *  field under another id (`null` leaves it out), a field's values, and proficiency tiers (a
         *  creature's, and those an entry grants or asks for); a
         *  lender's derived value read as one of this ruleset's values (`refs`: an item's to-hit
         *  proficiency, a scroll's spell slot), and an item's slot under another id. */
        sheet: z
          .object({
            fields: z.record(sheetId, sheetId.nullable()).optional(),
            values: z.record(sheetId, z.record(z.string().max(80), z.string().max(80))).optional(),
            tiers: z.record(sheetId, sheetId).optional(),
            refs: z.record(sheetId, rulesetValueRefSchema).optional(),
            slots: z.record(sheetId, sheetId).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    // Borrowed entries may sit beside the catalog's own (1.220), which add to them or replace one of
    // the same id; a package asset stands alone.
    if (
      catalog.from !== undefined
        ? catalog.asset !== undefined
        : (catalog.entries === undefined) === (catalog.asset === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A catalog has exactly one of "entries" or "asset", or "from" with its own "entries" beside it',
      });
    }
    // The picker offers a catalog on the lists it feeds, so a bestiary or an item catalog declaring
    // feeds would be offered on a sheet it can write nothing into.
    if (catalog.holds !== "rows") {
      if (catalog.feeds !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["feeds"],
          message: `A catalog of ${catalog.holds} writes no rows, so it feeds no list`,
        });
      }
    } else if (
      catalog.feeds === undefined &&
      !(catalog.entries?.length && catalog.entries.every((entry) => entry.grants && !entry.rows))
    ) {
      // Only a catalog whose entries all just grant through the guided builder (1.86, a class) writes
      // no rows; an asset's entries are checked against no feeds when they are read.
      if (catalog.entries) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["feeds"],
          message: 'A catalog of rows names the lists it "feeds"',
        });
      }
    }
    // The path is derived from the id rather than chosen, so the route can find the file from the
    // catalog alone and two catalogs can never name each other's asset.
    if (catalog.asset !== undefined && catalog.asset !== rulesetCatalogAssetPath(catalog.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["asset"],
        message: `A catalog asset is "${rulesetCatalogAssetPath(catalog.id)}"`,
      });
    }
  });

// ── Battles: what a fight may read from the sheet ──

/** One live pool, named. Its own object so the block reads the same wherever a pool is wanted. */
const battlePoolSchema = z.object({ pool: sheetId }).strict();

/** What a fight takes away: one live POOL, or one WOUND TRACK. A pool counts points down; a track
 *  is marked, and "out of it" is the track being full rather than a number reaching zero. Both
 *  shapes are read through `rulesetCombatHealth`, which reports a track as the levels it has LEFT,
 *  so every rule that already asks "is this combatant still above zero" keeps its own words. */
const combatHealthSchema = z.union([battlePoolSchema, z.object({ track: sheetId }).strict()]);

/**
 * How a fight's damage reaches a wound track: which kind of harm it is, and how a rolled amount
 * becomes marks. Declared rather than assumed, because only the ruleset knows whether its fire is a
 * bruise or a wound, and `default` is what anything unmapped lands as, including a blow that carries
 * no type at all. `marks` has no safe default either, because the two answers are opposite and each
 * is right for half the systems: where a damage roll counts health levels, a blow for three ticks
 * three boxes (`per-point`); where a blow either lands or does not, it ticks one however hard it
 * hit (`per-blow`). A ruleset says which, rather than the Engine guessing.
 */
const combatDamageKindsSchema = z
  .object({
    default: sheetId,
    byType: z.record(sheetId).optional(),
    marks: z.enum(["per-blow", "per-point"]),
    /** First matching target rule wins, before soak (Capability API 1.148). */
    remap: z
      .array(
        z
          .object({
            when: rulesetValueRefSchema,
            from: sheetId,
            to: sheetId,
            tags: z.array(sheetId).min(1).max(16).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .optional(),
  })
  .strict();

/** A sheet list that contributes combat skills. Only rows carrying the `_catalog` mark count, and
 *  only when the entry they came from has `mechanics`: a hand-typed row says nothing in numbers.
 *  `onlyWhen` is the boolean column a row must have set (5e's "prepared"); `alwaysWhen` lets a row
 *  through whatever that boolean says (5e's cantrips, which are never prepared). */
const battleSkillsSchema = z
  .object({
    list: sheetId,
    onlyWhen: sheetId.optional(),
    alwaysWhen: z.object({ column: sheetId, equals: sheetScalar }).strict().optional(),
  })
  .strict();

/** Optional, and absent rather than empty when a ruleset does not opt in: with no `battle` block a
 *  battle behaves exactly as it did before the block existed. It does NOT make combat follow the
 *  ruleset. It lends the Engine's own combat model the sheet's numbers: hit points, an energy pool,
 *  slots, and the catalog-marked rows that become skills. The damage math stays the Engine's, which
 *  is why `coverage.combat` keeps its own meaning and nothing here reads it. */
const battleSchema = z
  .object({
    health: combatHealthSchema,
    energy: battlePoolSchema.optional(),
    slots: z
      .array(z.object({ pool: sheetId, level: z.number().int().min(1).max(9) }).strict())
      .max(12)
      .optional(),
    skills: z.array(battleSkillsSchema).max(8).optional(),
  })
  .strict();

// ── Combat: the fight the ruleset's own numbers resolve ──
//
// Where `battle` lends the Engine's own combat model a few of the sheet's numbers, this block says
// how a fight is RESOLVED: what is rolled, against what, what a hit costs and what a turn may hold.
// It parameterises an Engine-owned combat kind exactly as `resolution` parameterises a check kind,
// and it is just as free of system words: the dice, the defense, the budgets, the conditions and
// the damage types are all named by the ruleset.

/** What the extreme faces of a single attack die do. `hit` is for a system whose top face always
 *  lands without being worth more, and `none` is pure arithmetic. */
const combatNaturalsSchema = z
  .object({ max: z.enum(["critical", "hit", "none"]).default("none"), min: z.enum(["miss", "none"]).default("none") })
  .strict();

/** The tones a budget's pip may take on the fight screen (Capability API 1.375), in the order a
 *  budget without one takes them by its place. */
export const RULESET_BUDGET_TONES = ["rose", "amber", "violet", "teal", "sky", "lime", "orange", "slate"] as const;

/** One budget of the action economy: how many times a turn may spend that kind of thing. The first
 *  declared budget is the main one, and is what a standard action spends. */
const combatBudgetSchema = z
  .object({
    id: sheetId,
    label,
    /** `turn` refills at the start of the holder's own turn; `round` when a new round begins. */
    per: z.enum(["turn", "round"]),
    /** How many a turn (or round) hands out. 0 (Capability API 1.76) is a budget only a condition's
     *  `budgets` fills, as Haste's extra action is. */
    count: z.number().int().min(0).max(10).default(1),
    /** How the fight screen marks it (Capability API 1.375): up to two letters on its pip, and one of
     *  the screen's tones. Without them the pip takes the label's first letter and the tone of its place. */
    short: z.string().trim().min(1).max(2).optional(),
    tone: z.enum(RULESET_BUDGET_TONES).optional(),
  })
  .strict();

/** A number that comes from one column of the row it belongs to. Its own object so a later slice
 *  can add another source beside `column` without rewriting the rules that read one. */
const combatColumnSchema = z.object({ column: sheetId }).strict();

/** A distance one row of an attack list carries: a number column of that same list, or the same
 *  number for every row. Both are in the ruleset's own distance unit. */
const combatDistanceSourceSchema = z.union([
  combatColumnSchema,
  z.object({ const: z.number().finite().min(0).max(10000) }).strict(),
]);

/** A sheet list whose rows are attacks, and the columns each number comes from. */
const combatAttackSourceSchema = z
  .object({
    list: sheetId,
    budget: sheetId,
    /** The text column the attack is named by. */
    name: sheetId,
    /** How far one of these rows reaches to strike, in the ruleset's own distance unit. A row with
     *  none reaches one cell, which is the smallest step a board has. A column that reads 0 on a
     *  row is that row saying it carries no such distance. */
    reach: combatDistanceSourceSchema.optional(),
    /** How far one of these rows is thrown or shot. `long` is what it still carries beyond `normal`,
     *  which a ruleset may make harder through `combat.ranged`. A row whose `normal` column reads 0
     *  is not thrown or shot at all, and swings at its `reach` instead. */
    range: z
      .object({ normal: combatDistanceSourceSchema, long: combatDistanceSourceSchema.optional() })
      .strict()
      .optional(),
    /** How many strikes ONE spend of this list's budget buys, read off the sheet or written down.
     *  A row taken with no strikes in hand spends the budget and puts the rest in hand; while any
     *  are in hand every row of a list that declares this costs no budget at all. A list that says
     *  nothing buys one strike a spend, which is what every fight did before this existed. */
    strikes: rulesetValueRefSchema.optional(),
    /** A boolean column that holds ITS OWN row to a single strike, whatever `strikes` says. Some
     *  weapons are one shot a turn however many attacks their wielder has: SRD 5.1's Loading is
     *  exactly this sentence, "you can fire only one piece of ammunition when you use an action ...
     *  regardless of the number of attacks you can normally make". Without a column the whole list
     *  shares one count, which is right for swords and wrong for a crossbow. Meaningless without
     *  `strikes`, and refused there, because a list that buys one strike already caps every row. */
    strikesCappedBy: combatColumnSchema.optional(),
    toHit: z
      .object({
        /** An enum column holding an ability id. Another value adds nothing, exactly as
         *  `abilityModFromField` reads one. */
        ability: combatColumnSchema.optional(),
        /** An enum column holding a skill id: the row adds what a check of that skill adds, with the
         *  row's own `ability` in place of the skill's when it names one, exactly as a check's
         *  `with=` swaps it. Another value adds nothing. */
        skill: combatColumnSchema.optional(),
        /** A boolean column: where it is set, the ruleset's own proficiency bonus is added. */
        proficiency: combatColumnSchema.optional(),
        /** A number column, added as it stands. */
        bonus: combatColumnSchema.optional(),
      })
      .strict()
      .default({}),
    damage: z
      .object({
        /** A dice column ("1d8", "2d6+1"). */
        dice: combatColumnSchema,
        ability: combatColumnSchema.optional(),
        bonus: combatColumnSchema.optional(),
        /** A text or enum column naming one of `damageTypes`. */
        type: combatColumnSchema.optional(),
      })
      .strict(),
    /** Rows every sheet's fight has as well as its own, written in this list's columns (Capability
     *  API 1.244): 5e's unarmed strike, which everybody makes. A sheet row of the same name is used
     *  in its place. */
    always: z
      .array(z.record(sheetId, z.union([promptSafeText(200), z.number().finite(), z.boolean()])))
      .min(1)
      .max(4)
      .optional(),
  })
  .strict();

/** A sheet list whose catalog-marked rows are abilities, filtered exactly as `battle.skills` are.
 *  What each one DOES is the entry's own `mechanics`; this says what its rows roll with by default. */
const combatAbilitySourceSchema = battleSkillsSchema.extend({
  /** What a row of this list spends unless its own `mechanics.budget` says otherwise. */
  budget: sheetId,
  /** The bonus an entry that rolls to hit adds. */
  toHit: rulesetValueRefSchema.optional(),
  /** The difficulty an entry's save is rolled against. */
  saveDifficulty: rulesetValueRefSchema.optional(),
  /** A row's column selects its own spellcasting references (1.108); other rows keep the source's. */
  byColumn: (
    z
      .object({
        column: sheetId,
        values: z
          .record(
            z
              .object({
                toHit: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
                saveDifficulty: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
              })
              .strict(),
          )
          .refine((values) => Object.keys(values).length >= 1 && Object.keys(values).length <= 20, {
            message: "A column selects 1 to 20 spellcasting entries",
          }),
      })
      .strict() as z.ZodType<
      {
        column: string;
        values: Record<string, { toHit?: RulesetValueRef; saveDifficulty?: RulesetValueRef }>;
      },
      z.ZodTypeDef,
      unknown
    >
  ).optional(),
});

/** What a condition DOES, from a closed list the kind implements. A ruleset maps its own condition
 *  ids onto them, so the sheet's conditions and the fight's are one record and a poisoned character
 *  is still poisoned when the fight ends. */
const combatConditionEffectSchema = z.enum([
  "own-attacks-advantage",
  "own-attacks-disadvantage",
  "attacks-against-advantage",
  "attacks-against-disadvantage",
  /** By distance, so they wait for the slice that gives a fight positions. */
  "attacks-against-adjacent-advantage",
  "attacks-against-far-disadvantage",
  "attacks-from-adjacent-critical",
  "cannot-act",
  /** Reactions and movement are later slices; both are validated now so a ruleset can say it once. */
  "cannot-react",
  "speed-zero",
  "half-move-to-stand",
  /** Any damage ends it. */
  "ends-on-damage",
  /** The holder's own saves, scoped by `saves` when the condition names any. */
  "own-saves-advantage",
  "own-saves-disadvantage",
  /** The holder's own side of a contest, rolled twice and the better or worse kept, where the
   *  ruleset rolls twice at all. */
  "own-checks-advantage",
  "own-checks-disadvantage",
  /** Half of every kind of harm, whatever the hide underneath already said. */
  "resist-all",
  /** The holder may not point anything at whoever put this on them. */
  "cannot-target-source",
  /** Nor at anybody on that one's side (Capability API 1.278), unless the holder is on it too: 5e's
   *  Calm Emotions, indifferent to the creatures its caster chose. */
  "cannot-target-source-side",
  /** And may not walk to a cell nearer them than the one they stand in. Read only by a fight with
   *  a board, exactly as the three effects above it are, so a ruleset may say it either way. */
  "cannot-approach-source",
  /** Its holder regains nothing from any heal while it holds (Capability API 1.191): 5e's Chill
   *  Touch. */
  "cannot-heal",
  /** Its holder regains nothing from a heal that is not magical while it holds (Capability API
   *  1.261), in a fight or out of it, a rest included: a diseased giant rat's bite. A heal is
   *  magical when its action's qualities say "magical" (a spell, a potion tagged so). */
  "cannot-heal-nonmagical",
]);
export const RULESET_COMBAT_CONDITION_EFFECTS = combatConditionEffectSchema.options;

/** The two effects `saves` narrows. Anything else ignores it, so naming saves without one of these
 *  (or a modifier to saves) is an author saying something the fight could never read. */
export const RULESET_SAVE_SCOPED_EFFECTS = ["own-saves-advantage", "own-saves-disadvantage"] as const;

/** The numbers a condition may change, from a closed list. `defense` is what an attack against the
 *  holder has to reach; `attacks`, `saves` and `checks` are the holder's own rolls; `speed` is how far
 *  the holder walks, in the ruleset's own distance unit. */
/** `health-max` (Capability API 1.115) halves the health maximum, as 5e's fourth level of exhaustion does. */
export const RULESET_COMBAT_MODIFIER_TARGETS = [
  "defense",
  "attacks",
  "saves",
  "checks",
  "speed",
  "health-max",
  "damage",
  "damage-taken",
  /** Attacks made against the holder (Capability API 1.185), rolled twice by `mode`, from attackers
   *  that are `from`: 5e's Protection from Evil and Good. */
  "attacks-taken",
  /** Checks made to find the holder (Capability API 1.290), rolled twice by `mode`, narrowed by
   *  `skills` to the skill rolled: an opponent's Search for them and its passive Perception
   *  against their hiding. 5e's Cloak of Elvenkind, disadvantage on Perception to see its wearer. */
  "checks-taken",
  /** The difficulty of the saves the holder makes others roll (Capability API 1.328), by a flat
   *  amount: the Miller of Hours' Un-age, a spell save DC 2 lower. */
  "save-difficulty",
] as const;
/** The ones that are ROLLED, so dice may be added to them and are rolled every time. */
export const RULESET_ROLLED_MODIFIER_TARGETS: readonly string[] = [
  "attacks",
  "saves",
  "checks",
  "damage",
  "damage-taken",
];

/** Whether a roll is thrown twice with the better or the worse kept. */
export const RULESET_ROLL_MODES = ["advantage", "disadvantage"] as const;

/** What a save a modifier changes is against (Capability API 1.134). Typed by hand: inferred, the
 *  combat schema around it grows too long for the compiler to emit. */
export interface RulesetModifierAgainst {
  conditions?: string[];
  damage?: string[];
  magic?: true;
  from?: RulesetTargetIs;
  actions?: string[];
  casts?: string[];
}
const modifierAgainstSchema: z.ZodType<RulesetModifierAgainst, z.ZodTypeDef, unknown> = z
  .object({
    conditions: z.array(sheetId).min(1).max(24).optional(),
    damage: z.array(promptSafeText(40)).min(1).max(24).optional(),
    magic: z.literal(true).optional(),
    /** A save against something a creature that is this does (Capability API 1.185): 5e's
     *  Dragon Scale Mail, against a dragon's breath and its Frightful Presence. */
    from: targetIsSchema.optional(),
    /** Only a save against one of these actions (Capability API 1.191), by id, name or shared
     *  recharge group, case-insensitively, AND whatever else it names: Dragon Scale Mail's
     *  dragons' breath and Frightful Presence, never their Wing Attack. */
    actions: z.array(promptSafeText(80)).min(1).max(12).optional(),
    /** Only a save against an entry of one of these catalogs, or an item's use that casts from
     *  one (Capability API 1.265), AND whatever else it names: Holy Nimbus, against spells cast
     *  by fiends or undead. */
    casts: z.array(sheetId).min(1).max(8).optional(),
  })
  .strict()
  .refine((against) => Object.keys(against).length > 0, "Against names conditions, damage, magic, from or actions");

/** One number a condition changes, and by how much: a flat number (with its own sign), dice rolled
 *  each time the number is used (`minus` takes them away instead), or `times` half or double on speed
 *  and damage (the health maximum only halves), applied after additions. A change to checks may name
 *  the `skills` it is about, and one to saves the `saves`; either may roll twice (`mode`) where the
 *  ruleset rolls twice at all. */
const combatModifierSchema = z
  .object({
    to: z.enum(RULESET_COMBAT_MODIFIER_TARGETS),
    /** Damage dealt or taken on an attack hit (Capability API 1.133): narrowed to its kind,
     *  reach or ability, typed on its own, and, on the target, only from the applying source. Since
     *  Capability API 1.247 `attacks` and `blow` narrow a change to attacks too: 5e's Reckless
     *  Attack, advantage on melee weapon attacks with Strength. */
    attacks: z.enum(["weapon", "spell", "any"]).optional(),
    blow: z.enum(["melee", "ranged"]).optional(),
    /** Damage or, since Capability API 1.188, attacks made with this ability: 5e's Strength-based
     *  attacks under a gold dragon's Weakening Breath. */
    ability: sheetId.optional(),
    /** Narrows a change to checks to ability checks made with one of these, contests included
     *  (Capability API 1.188): a barbarian's Rage, advantage on Strength checks. */
    abilities: z.array(sheetId).min(1).max(12).optional(),
    damageType: z.string().trim().min(1).max(80).optional(),
    fromSource: z.literal(true).optional(),
    flat: z.number().int().min(-100).max(100).optional(),
    dice: catalogDice.optional(),
    minus: z.literal(true).optional(),
    times: z.union([z.literal(0.5), z.literal(2)]).optional(),
    /** The blow's own damage dice this many times over, its flat part as it was (Capability API
     *  1.197): an enlarged duergar's war pick, 1d8 + 2 as 2d8 + 2. Damage dealt only. */
    diceTimes: z.number().int().min(2).max(4).optional(),
    /** On a critical hit only, this many more of the blow's own damage dice, not doubled
     *  (Capability API 1.247): 5e's Brutal Critical and Savage Attacks. Damage dealt only. */
    criticalDice: z.number().int().min(1).max(6).optional(),
    skills: z.array(sheetId).min(1).max(24).optional(),
    saves: z.array(sheetId).min(1).max(12).optional(),
    /** What this save is against (Capability API 1.134): any named condition, damage type or
     *  magic qualifies; `saves` still narrows which save. Nothing matches a save with no source. */
    against: modifierAgainstSchema.optional(),
    mode: z.enum(RULESET_ROLL_MODES).optional(),
    /** Narrows a change to attacks-taken to attackers that are this (Capability API 1.185). */
    from: targetIsSchema.optional(),
    /** Narrows a change to the holder's own attacks to those against whoever put this on them
     *  (Capability API 1.185): 5e's Chill Touch, an undead's attacks against the caster. */
    atSource: z.literal(true).optional(),
    /** Held back until the holder's own attack, save or check falls short, then added only where
     *  its most could make up the difference, and the condition it came from is spent (Capability
     *  API 1.249): 5e's Bardic Inspiration, Guidance and Resistance, added after seeing the roll. */
    rescue: z.literal(true).optional(),
  })
  .strict()
  .superRefine((modifier, ctx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (
      modifier.flat === undefined &&
      modifier.dice === undefined &&
      modifier.times === undefined &&
      modifier.diceTimes === undefined &&
      modifier.criticalDice === undefined &&
      modifier.mode === undefined
    ) {
      add(
        "to",
        "A modifier changes its number by a flat amount, by dice, for speed, health-max or damage by times, or for checks and saves by a mode",
      );
    }
    if (modifier.skills !== undefined && modifier.to !== "checks" && modifier.to !== "checks-taken")
      add("skills", '"skills" narrows a change to checks');
    if (modifier.against !== undefined && modifier.to !== "saves")
      add("against", '"against" narrows a change to saves');
    if (modifier.saves !== undefined && modifier.to !== "saves") add("saves", '"saves" narrows a change to saves');
    if (
      modifier.mode !== undefined &&
      modifier.to !== "checks" &&
      modifier.to !== "saves" &&
      modifier.to !== "attacks" &&
      modifier.to !== "attacks-taken" &&
      modifier.to !== "checks-taken"
    ) {
      add("mode", '"mode" rolls checks, saves or attacks twice, so it changes nothing else');
    }
    if (
      modifier.to === "attacks-taken" &&
      (modifier.mode === undefined || modifier.flat !== undefined || modifier.dice !== undefined)
    ) {
      add("to", '"attacks-taken" rolls attacks against the holder twice, so it takes a "mode" and nothing else');
    }
    if (
      modifier.to === "checks-taken" &&
      (modifier.mode === undefined || modifier.flat !== undefined || modifier.dice !== undefined)
    ) {
      add("to", '"checks-taken" rolls checks to find the holder twice, so it takes a "mode" and nothing else');
    }
    if (
      modifier.to === "save-difficulty" &&
      (modifier.flat === undefined || modifier.dice !== undefined || modifier.times !== undefined)
    ) {
      add("to", '"save-difficulty" moves the difficulty of the saves the holder calls for by a flat amount only');
    }
    if (modifier.from !== undefined && modifier.to !== "attacks-taken")
      add("from", '"from" narrows attacks-taken only');
    if (modifier.atSource && modifier.to !== "attacks")
      add("atSource", '"atSource" narrows the holder\'s own attacks only');
    const damage = modifier.to === "damage" || modifier.to === "damage-taken";
    for (const key of ["damageType", "fromSource"] as const) {
      if (modifier[key] !== undefined && !damage) add(key, `"${key}" narrows damage only`);
    }
    for (const key of ["attacks", "blow"] as const) {
      if (modifier[key] !== undefined && !damage && modifier.to !== "attacks")
        add(key, `"${key}" narrows damage or attacks only`);
    }
    if (modifier.ability !== undefined && !damage && modifier.to !== "attacks") {
      add("ability", '"ability" narrows damage or attacks only');
    }
    if (modifier.abilities !== undefined && modifier.to !== "checks") {
      add("abilities", '"abilities" narrows a change to checks');
    }
    if (modifier.fromSource && modifier.to !== "damage-taken") {
      add("fromSource", '"fromSource" narrows damage-taken only');
    }
    if (modifier.flat === 0) add("flat", "A flat change of 0 changes nothing");
    if (modifier.dice !== undefined && !RULESET_ROLLED_MODIFIER_TARGETS.includes(modifier.to)) {
      add("dice", `Dice are rolled, so they change ${RULESET_ROLLED_MODIFIER_TARGETS.join(", ")} and nothing else`);
    }
    if (modifier.minus && modifier.dice === undefined) add("minus", '"minus" takes dice away, so it needs "dice"');
    if (modifier.times !== undefined && modifier.to !== "speed" && modifier.to !== "health-max" && !damage) {
      add("times", '"times" changes speed, the health maximum and damage only');
    }
    if (modifier.diceTimes !== undefined && modifier.to !== "damage") {
      add("diceTimes", '"diceTimes" changes the damage a blow deals only');
    }
    if (modifier.criticalDice !== undefined && modifier.to !== "damage") {
      add("criticalDice", '"criticalDice" changes the damage a blow deals only');
    }
    if (
      modifier.rescue &&
      ((modifier.to !== "attacks" && modifier.to !== "saves" && modifier.to !== "checks") ||
        (modifier.flat === undefined && modifier.dice === undefined) ||
        (modifier.flat !== undefined && modifier.flat < 0) ||
        modifier.minus ||
        modifier.mode !== undefined)
    ) {
      add(
        "rescue",
        '"rescue" adds dice or a positive flat number to the holder\'s own attack, save or check, and nothing else',
      );
    }
    if (modifier.to === "health-max" && (modifier.times !== 0.5 || modifier.flat !== undefined)) {
      add("times", 'The health maximum is only halved: "times": 0.5 and nothing else');
    }
  });

/** What a condition does to saves has to be about saves: `saves` narrows the save effects and the
 *  modifiers to saves, and nothing else reads it. */
function savesNeedSomethingToNarrow(
  entry: { saves?: string[]; effects?: string[]; modifiers?: Array<{ to: string }> },
  ctx: z.RefinementCtx,
): void {
  if (!entry.saves) return;
  const effect = (entry.effects ?? []).some((one) => (RULESET_SAVE_SCOPED_EFFECTS as readonly string[]).includes(one));
  const modifier = entry.modifiers?.some((one) => one.to === "saves") ?? false;
  if (!effect && !modifier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["saves"],
      message: `"saves" narrows ${RULESET_SAVE_SCOPED_EFFECTS.join(" and ")} and modifiers to saves, so it needs one of them beside it`,
    });
  }
}

/** The two effects `skills` narrows. */
export const RULESET_CHECK_SCOPED_EFFECTS = ["own-checks-advantage", "own-checks-disadvantage"] as const;

/** And `skills` narrows the check effects and the modifiers to checks, so it needs one beside it. */
function skillsNeedSomethingToNarrow(
  entry: { skills?: string[]; effects?: string[]; modifiers?: Array<{ to: string }> },
  ctx: z.RefinementCtx,
): void {
  if (!entry.skills) return;
  const effect = (entry.effects ?? []).some((one) => (RULESET_CHECK_SCOPED_EFFECTS as readonly string[]).includes(one));
  const modifier = entry.modifiers?.some((one) => one.to === "checks") ?? false;
  if (!effect && !modifier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["skills"],
      message: `"skills" narrows ${RULESET_CHECK_SCOPED_EFFECTS.join(" and ")} and modifiers to checks, so it needs one of them beside it`,
    });
  }
}

/** The effects a LEVEL may not have: a level is not something anybody put on its holder, so it has
 *  no source to be kept from, and it ends only when the track goes down, not by standing up or being
 *  hurt. */
export const RULESET_LEVEL_REFUSED_EFFECTS = [
  "half-move-to-stand",
  "ends-on-damage",
  "cannot-target-source",
  "cannot-target-source-side",
  "cannot-approach-source",
] as const;

/**
 * A level of a live track: while the holder's track is at `at` or more, this counts as one of their
 * conditions, so levels add up as the track climbs. How exhaustion is said, and any other track whose
 * rungs make things worse.
 */
const combatLevelSchema = z
  .object({
    /** Harm and conditions kept off while this applies (Capability API 1.132), as on a creature. */
    resist: z.array(creatureHideEntrySchema).min(1).max(30).optional(),
    vulnerable: z.array(promptSafeText(40)).min(1).max(30).optional(),
    immune: z.array(creatureHideEntrySchema).min(1).max(30).optional(),
    conditionImmunities: z.array(sheetId).min(1).max(40).optional(),
    /** A plain live track, read by where it stands... */
    track: sheetId.optional(),
    /** ...or a derived value, worked out with the holder's live state and items. One of the two. */
    derived: sheetId.optional(),
    at: z.number().int().min(1).max(1000),
    effects: z.array(combatConditionEffectSchema).max(12).default([]),
    modifiers: z.array(combatModifierSchema).min(1).max(6).optional(),
    failsSaves: z.array(sheetId).min(1).max(12).optional(),
    saves: z.array(sheetId).min(1).max(12).optional(),
    skills: z.array(sheetId).min(1).max(24).optional(),
    /** Saves among these, against something that deals half on a success, take nothing on a
     *  success and half on a failure (Capability API 1.250): 5e's Evasion, on Dexterity saves. */
    evasion: z.array(sheetId).min(1).max(12).optional(),
    /** Reaching it takes the holder out of the fight for good (Capability API 1.115): 5e's sixth
     *  level of exhaustion. */
    defeats: z.literal(true).optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if ((entry.track === undefined) === (entry.derived === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["track"],
        message: "A level reads a live track or a derived value: one of them",
      });
    }
    entry.effects.forEach((effect, index) => {
      if ((RULESET_LEVEL_REFUSED_EFFECTS as readonly string[]).includes(effect)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effects", index],
          message: `A level cannot have "${effect}": nobody put it on, and it ends only when what it reads goes down`,
        });
      }
    });
    if (
      entry.effects.length === 0 &&
      !entry.modifiers &&
      !entry.failsSaves &&
      !entry.evasion &&
      !entry.defeats &&
      !entry.resist &&
      !entry.vulnerable &&
      !entry.immune &&
      !entry.conditionImmunities
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effects"],
        message:
          "A level does something: effects, modifiers, saves it fails, defeating its holder, or harm or conditions it keeps off",
      });
    }
    savesNeedSomethingToNarrow(entry, ctx);
    skillsNeedSomethingToNarrow(entry, ctx);
  });

const combatConditionDelaysBase = z
  .object({
    catalogs: z.array(sheetId).min(1).max(12),
    budget: sheetId,
    chance: z
      .object({ sides: z.number().int().min(2).max(100), atLeast: z.number().int().min(1).max(100) })
      .strict()
      .refine((chance) => chance.atLeast <= chance.sides, {
        message: "A delay that needs more than its die can show never happens",
      }),
  })
  .strict();
/** Named, so the condition schema stays short enough for the compiler to write. */
export type RulesetConditionDelays = z.infer<typeof combatConditionDelaysBase>;
const combatConditionDelaysSchema: z.ZodType<RulesetConditionDelays, z.ZodTypeDef, unknown> = combatConditionDelaysBase;

/** A sense that sees where eyes cannot (1.178). */
export interface RulesetCombatSense {
  id: string;
  label: string;
  sheet?: RulesetValueRef;
  blind?: true;
}
/** Conditions kept off when a creature that is `from` puts them on (1.191). */
export interface RulesetConditionImmunityFrom {
  conditions: string[];
  from: RulesetTargetIs;
}
const combatSenseSchema: z.ZodType<RulesetCombatSense, z.ZodTypeDef, unknown> = z
  .object({ id: sheetId, label, sheet: rulesetValueRefSchema.optional(), blind: z.literal(true).optional() })
  .strict();

/** The dark keeping eyes from seeing (1.294): see `combat.sight.darkness`. */
export interface RulesetCombatDarkness {
  seeIn: string[];
  pierced?: string[];
  carried?: RulesetLightRadius & { label?: string; budget?: string };
}
/** What seeing does in a fight (1.178). */
export interface RulesetCombatSight {
  unseenAttacks?: true;
  eyes?: string;
  darkness?: RulesetCombatDarkness;
}
const combatSightSchema: z.ZodType<RulesetCombatSight, z.ZodTypeDef, unknown> = z
  .object({
    unseenAttacks: z.literal(true).optional(),
    eyes: sheetId.optional(),
    /** The light a fight is fought in keeps eyes from seeing (Capability API 1.294). Somebody in
     *  darkness is not seen, and in dim light not seen clearly, except by a sense of `seeIn` within
     *  its range (darkvision), which sees darkness as dim light and dim light as bright, or by a
     *  `blind` sense or one of `pierced` (truesight) within its range, which see whatever the light.
     *  What lights the dark is `light` on a condition, an item's effect or a creature, and `carried`:
     *  the light everybody fighting from a sheet carries, unless one of `seeIn` reaches for them. */
    darkness: z
      .object({
        seeIn: z.array(sheetId).min(1).max(8),
        pierced: z.array(sheetId).min(1).max(8).optional(),
        /** Put out and lit again in a fight (Capability API 1.295), as a switch on the menu named
         *  `label` ("Torch"), on `budget`, or once a turn for nothing where it names none. */
        carried: z
          .object({
            bright: z.number().finite().min(0).max(10000),
            dim: z.number().finite().min(0).max(10000),
            label: promptSafeText(40).optional(),
            budget: sheetId.optional(),
          })
          .strict()
          .refine((light) => light.bright + light.dim > 0, { message: "A light reaches somewhere" })
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** What a condition leaves behind when it ends (combat C6d). */
export interface RulesetConditionOnEnd {
  applies?: RulesetCatalogApplies[];
  tracks?: Array<{ track: string; by: number }>;
  harm?: RulesetConditionEndHarm;
}
const conditionOnEndSchema: z.ZodType<RulesetConditionOnEnd, z.ZodTypeDef, unknown> = z
  .object({
    applies: z
      .array(
        catalogAppliesSchema.refine((applied) => typeof applied.duration === "object", {
          message: "What a condition leaves behind lasts some rounds",
          path: ["duration"],
        }),
      )
      .min(1)
      .max(4)
      .superRefine(linkedApplies)
      .optional(),
    /** Its holder's live tracks moved by levels as it ends (Capability API 1.239): 5e's Frenzy
     *  leaves a level of exhaustion when the rage is over. */
    tracks: catalogTracksSchema.optional(),
    /** Damage its holder takes as it ends (Capability API 1.245), from whoever put it on, unless
     *  the holder is what `unless` names: Hurl Through Hell's 10d10 psychic, which a fiend
     *  never takes. */
    harm: conditionEndHarmSchema.optional(),
  })
  .strict()
  .refine((ending) => ending.applies || ending.tracks || ending.harm, {
    message: '"onEnd" names "applies", "tracks" or "harm"',
  });

/** What a condition makes its holder do with their turn (Capability API 1.264): 5e's Turn Undead,
 *  Command, Confusion. */
export interface RulesetConditionBehavior {
  only?: string[];
  onlyWhenStuck?: string[] | "any";
  moves?: "away" | "toward";
  keepsOut?: number;
  keepsIn?: number;
  drops?: RulesetBehaviorDrops;
  table?: { dice: string; rows: Array<{ atMost: number; does: "wander" | "nothing" | "strike" | "normal" }> };
}
/** What its holder lets fall from their hands (1.266): Command's "drop", Fear. */
export interface RulesetBehaviorDrops {
  slots?: string[];
  tags?: string[];
  at: "applied" | "turn-start";
  pickUp?: string;
}
/** What a turn may hold besides walking: breaking free, and the standard actions. */
export const RULESET_BEHAVIOR_ONLY = ["move", "escape", ...RULESET_COMBAT_STANDARD_ACTIONS] as const;
const conditionBehaviorSchema: z.ZodType<RulesetConditionBehavior, z.ZodTypeDef, unknown> = z
  .object({
    /** All its holder's turn may hold, besides ending it: walking (`move`, getting up included),
     *  breaking free of what holds them (`escape`), and the standard actions named. Empty, nothing:
     *  Command's "halt". */
    only: z
      .array(z.enum(RULESET_BEHAVIOR_ONLY))
      .max(8)
      .refine((only) => new Set(only).size === only.length, { message: "Name each once" })
      .optional(),
    /** Standard actions it may take only while there is nowhere it may walk to: Turn Undead's Dodge.
     *  `"any"` (Capability API 1.266): a turn that starts with nowhere to walk is its holder's own,
     *  whatever `only` says: Fear's "unless there is nowhere to move". */
    onlyWhenStuck: z
      .union([
        z
          .array(z.enum(RULESET_COMBAT_STANDARD_ACTIONS))
          .min(1)
          .max(6)
          .refine((only) => new Set(only).size === only.length, { message: "Name each once" }),
        z.literal("any"),
      ])
      .optional(),
    /** It walks only away from whoever put it on, never a step nearer, and stops only further off
     *  than it began; or only toward them, never a step further, stopping nearer (Command's
     *  "approach" and "flee", Turn Undead, Antipathy and Sympathy). */
    moves: z.enum(["away", "toward"]).optional(),
    /** It never walks to a place within this distance of whoever put it on unless it is getting
     *  further off, and stops only outside it while there is anywhere outside it to stop (Capability
     *  API 1.266): Turn Undead's "can't willingly move to a space within 30 feet of you". */
    keepsOut: z.number().int().min(1).max(1000).optional(),
    /** Once within this distance of whoever put it on, it never walks farther off than this
     *  (Capability API 1.274): Sympathy's "can't willingly move away from the target". */
    keepsIn: z.number().int().min(1).max(1000).optional(),
    /** It lets fall what it holds (Capability API 1.266): each worn item taking one of `slots`
     *  (a hand), each item and each stat block action carrying one of `tags`, as the condition goes
     *  on or as each of its holder's turns starts. What falls lies where they stood: it does nothing
     *  for them, and none of its actions are theirs, until they pick it up from that place or beside
     *  it, once a turn for nothing or for `pickUp`'s budget. Command's "drop", Fear's "drops
     *  whatever it is holding". */
    drops: z
      .object({
        slots: z.array(sheetId).min(1).max(4).optional(),
        tags: z.array(sheetId).min(1).max(8).optional(),
        at: z.enum(["applied", "turn-start"]),
        pickUp: sheetId.optional(),
      })
      .strict()
      .refine((drops) => drops.slots || drops.tags, { message: '"drops" names "slots", "tags" or both' })
      .optional(),
    /** Rolled as each of its holder's turns starts, the first row the roll is at most deciding the
     *  turn: `wander` walks every bit of their speed one way the dice pick and ends the turn,
     *  `nothing` ends it, `strike` allows only a melee attack at a creature in reach the dice pick
     *  (nothing, with nobody in reach), `normal` leaves it alone, as does a roll above every row.
     *  5e's Confusion and Mindfire. */
    table: z
      .object({
        dice: catalogDice,
        rows: z
          .array(
            z
              .object({
                atMost: z.number().int().min(1).max(100),
                does: z.enum(["wander", "nothing", "strike", "normal"]),
              })
              .strict(),
          )
          .min(1)
          .max(10)
          .superRefine((rows, ctx) => {
            for (let index = 1; index < rows.length; index++) {
              if (rows[index]!.atMost <= rows[index - 1]!.atMost) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: [index, "atMost"],
                  message: "Rows run strictly up",
                });
              }
            }
          }),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((behavior) => Object.keys(behavior).length > 0, "A behavior says at least one thing")
  .refine((behavior) => !behavior.onlyWhenStuck || behavior.only?.includes("move"), {
    message: '"onlyWhenStuck" goes with "only" naming "move"',
    path: ["onlyWhenStuck"],
  });

/** Conditions a condition's holder spreads around them (1.263): 5e's Aura of Protection. */
export interface RulesetConditionAura {
  distance: number;
  side: "allies" | "enemies" | "all";
  self?: true;
  conditions?: string[];
  when?: { value: RulesetValueRef; atLeast?: number; atMost?: number };
  needs?: string[];
  targetTypes?: {
    is?: RulesetTargetIs;
    not?: RulesetTargetIs;
    abilityAtMost?: Record<string, number>;
    abilityAtLeast?: Record<string, number>;
    notImmuneTo?: string[];
  };
  sourcesOf?: string[];
  chosenKind?: true;
  orSeen?: true;
  harms?: { dice?: string; flat?: number; type?: string; on?: "holder-turn" | "their-turn" };
  grows?: { by: number; upTo: number };
  lingers?: true;
  feeds?: number;
  save?: {
    save: string;
    difficulty: number;
    appliedDifficulty?: true;
    applies: RulesetCatalogApplies[];
    seen?: true;
    immuneOnSuccess?: true;
    immuneWhenEnds?: true;
    failedBy?: { atLeast: number; applies: RulesetCatalogApplies[] };
    avert?: true;
  };
}
const conditionAuraSchema: z.ZodType<RulesetConditionAura, z.ZodTypeDef, unknown> = z
  .object({
    /** How far from its holder, in the ruleset's own distance, nearest cell to nearest cell. A fight
     *  with no board measures nothing, so there it reaches everybody it names. */
    distance: z.number().finite().gt(0).max(10000),
    /** Whom: the holder's own side, the other side, or both. */
    side: z.enum(["allies", "enemies", "all"]),
    /** The holder too, where `side` names their own side. */
    self: z.literal(true).optional(),
    conditions: uniqueIds(8).optional(),
    /** Only while this value off the holder's own sheet stands within the bounds: a paladin's
     *  Charisma modifier for Aura of Protection's bonus, their level for its 30 feet. */
    when: sheetBoundsSchema("when", "spread").optional(),
    /** Only to whoever has these senses (Capability API 1.265), with neither of them standing where
     *  a zone takes them away: Countercharm's "can hear you", which Silence stops. */
    needs: combatSensesSchema.optional(),
    /** Only to whoever is this (Capability API 1.268), as an entry's `targetTypes` reads: a sea
     *  hag's Horrific Appearance, humanoids only. */
    targetTypes: catalogTargetTypesSchema.optional(),
    /** Only to whoever has put one of these conditions on its holder (Capability API 1.268): a
     *  barbed devil's Barbed Hide, harming whoever grapples it. */
    sourcesOf: uniqueIds(4).optional(),
    /** Only to the creature type named as what put it on its holder was used (`kindChoice`,
     *  Capability API 1.270): Antipathy/Sympathy's chosen kind. */
    chosenKind: z.literal(true).optional(),
    /** Also to whoever can see its holder, however far off (Capability API 1.270): Antipathy's
     *  "can see the target or comes within 60 feet". */
    orSeen: z.literal(true).optional(),
    /** It reaches `by` further as each of its holder's turns starts, to no more than `upTo`, in the
     *  ruleset's distance (Capability API 1.320): Frost Debt, 20 feet growing by 10 to 40. */
    grows: z
      .object({ by: z.number().finite().gt(0).max(10000), upTo: z.number().finite().gt(0).max(10000) })
      .strict()
      .optional(),
    /** Its holder regains this many hit points whenever somebody it reaches is felled, goes down or
     *  is slain (Capability API 1.331): The Owed's Collector, 15. */
    feeds: z.number().int().min(1).max(10000).optional(),
    /** What it spreads stays on whoever it no longer reaches until their next turn starts
     *  (Capability API 1.320): Frost Debt's no healing. */
    lingers: z.literal(true).optional(),
    /** Dealt by the holder to everybody it reaches as each of the holder's own turns starts
     *  (Capability API 1.265): a balor's Fire Aura, 3d6 fire. */
    harms: z
      .object({
        dice: catalogDice.optional(),
        flat: z.number().int().min(0).max(1000).optional(),
        type: promptSafeText(40).optional(),
        /** As each of the holder's own turns starts (the default), or as each turn of whoever it
         *  reaches starts (Capability API 1.320): The Owed's Frost Debt. */
        on: z.enum(["holder-turn", "their-turn"]).optional(),
      })
      .strict()
      .refine((harm) => harm.dice !== undefined || harm.flat !== undefined, {
        message: "What it harms with names dice, a flat amount, or both",
      })
      .optional(),
    /** A save everybody it reaches makes as their own turn starts (Capability API 1.265), against
     *  `difficulty`, with `applies` put on by the holder on a failure: a pit fiend's Fear Aura, a
     *  gibbering mouther's Gibbering. `seen`: only while the two can see each other (a basilisk's
     *  gaze). `immuneOnSuccess`: a success keeps that holder's aura off them for the rest of the
     *  fight. */
    save: z
      .object({
        save: sheetId,
        difficulty: z.number().int().min(1).max(100),
        /** Against the save difficulty of whatever put the aura's condition on its holder, fixed as
         *  it went on, in place of `difficulty` (Capability API 1.274): Antipathy/Sympathy's
         *  caster's. `difficulty` stays for an aura nothing put on. */
        appliedDifficulty: z.literal(true).optional(),
        applies: z.array(catalogAppliesSchema).min(1).max(4),
        seen: z.literal(true).optional(),
        immuneOnSuccess: z.literal(true).optional(),
        /** Once what a failure put on ends, however it ends (a save, its clock, a cure), that holder's
         *  aura stays off them for the rest of the fight too (Capability API 1.269): a sea hag's
         *  "or the effect ends for it". */
        immuneWhenEnds: z.literal(true).optional(),
        /** A failure by at least `atLeast` puts these on instead (Capability API 1.268): a
         *  medusa's gaze, petrified outright on a failure by 5 or more. */
        failedBy: z
          .object({
            atLeast: z.number().int().min(1).max(50),
            applies: z.array(catalogAppliesSchema).min(1).max(4),
          })
          .strict()
          .optional(),
        /** Whoever it reaches may avert their eyes from its holder on their turn (Capability API
         *  1.268): until they look again they skip this save and cannot see the holder (a
         *  basilisk's gaze). Only with `seen`. */
        avert: z.literal(true).optional(),
      })
      .strict()
      .refine((save) => !save.avert || save.seen, {
        message: 'Averting the eyes goes with a "seen" save',
      })
      .optional(),
  })
  .strict()
  .refine((aura) => !!aura.conditions || !!aura.harms || !!aura.save || !!aura.feeds, {
    message: "An aura spreads conditions, harms, asks for a save, or feeds",
  })
  .refine((aura) => !aura.grows || aura.grows.upTo > aura.distance, {
    message: "An aura grows to more than its distance",
    path: ["grows", "upTo"],
  })
  .refine((aura) => !aura.lingers || !!aura.conditions, {
    message: "Only what an aura spreads lingers",
    path: ["lingers"],
  });

/** What a condition does on the rests it names (1.260). */
export interface RulesetConditionOnRest {
  rests: string[];
  lowersMax: { dice?: string; flat?: number };
  lasting?: true;
  restoredWhenCured?: true;
  save?: { save: string; difficulty: number; cures?: true };
}
const conditionOnRestSchema: z.ZodType<RulesetConditionOnRest, z.ZodTypeDef, unknown> = z
  .object({
    rests: z
      .array(sheetId)
      .min(1)
      .max(8)
      .refine((rests) => new Set(rests).size === rests.length, { message: "Rests must be unique" }),
    lowersMax: z
      .object({ dice: catalogDice.optional(), flat: z.number().int().min(1).max(1000).optional() })
      .strict()
      .refine((amount) => amount.dice !== undefined || amount.flat !== undefined, {
        message: '"lowersMax" rolls "dice", a "flat" amount, or both',
      }),
    lasting: z.literal(true).optional(),
    /** With `lasting`, what its rests took comes back when it is cured (Capability API 1.261),
     *  however it comes off: Mummy Rot lifted by Remove Curse. */
    restoredWhenCured: z.literal(true).optional(),
    /** A save its holder makes at each such rest first (the otyugh's, the death dog's): only a
     *  failure lowers the maximum, and with `cures` a success ends the condition. Rolled as the
     *  ruleset's checks are, with the sheet's own modifier for that save. */
    save: z
      .object({
        save: sheetId,
        difficulty: z.number().int().min(1).max(100),
        cures: z.literal(true).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((onRest) => !onRest.restoredWhenCured || onRest.lasting, {
    message: '"restoredWhenCured" gives back a lasting loss, so it goes with "lasting"',
    path: ["restoredWhenCured"],
  });

/** What a condition puts on its holder each time they take damage (1.261). */
export interface RulesetConditionOnDamaged {
  applies: RulesetCatalogApplies[];
}
const conditionOnDamagedSchema: z.ZodType<RulesetConditionOnDamaged, z.ZodTypeDef, unknown> = z
  .object({
    applies: z
      .array(
        catalogAppliesSchema.refine((applied) => typeof applied.duration === "object", {
          message: "What damage puts on lasts some rounds",
          path: ["duration"],
        }),
      )
      .min(1)
      .max(4),
  })
  .strict();

const combatConditionSchema = z
  .object({
    /** Harm and conditions kept off while this applies (Capability API 1.132), as on a creature. */
    resist: z.array(creatureHideEntrySchema).min(1).max(30).optional(),
    vulnerable: z.array(promptSafeText(40)).min(1).max(30).optional(),
    immune: z.array(creatureHideEntrySchema).min(1).max(30).optional(),
    conditionImmunities: z.array(sheetId).min(1).max(40).optional(),
    /** Conditions kept off only when a creature that is `from` would put them on (Capability API
     *  1.191): 5e's Protection from Evil and Good, no charm or fright from a fiend or undead. One
     *  already on stays. */
    conditionImmunitiesFrom: z
      .array(
        z.object({ conditions: z.array(sheetId).min(1).max(40), from: targetIsSchema }).strict() as z.ZodType<
          RulesetConditionImmunityFrom,
          z.ZodTypeDef,
          unknown
        >,
      )
      .min(1)
      .max(10)
      .optional(),
    condition: sheetId,
    /** Saves among these, against something that deals half on a success, take nothing on a
     *  success and half on a failure (Capability API 1.250): 5e's Evasion, on Dexterity saves. */
    evasion: z.array(sheetId).min(1).max(12).optional(),
    /** Senses its holder does not have while it lasts (Capability API 1.127). */
    lacks: combatSensesSchema.optional(),
    /** Nobody sees its holder while it lasts (Capability API 1.178) but with one of the senses
     *  `pierced` names, within its range: 5e's invisible, which blindsight and truesight see. */
    unseen: seenThroughSchema.optional(),
    /** Nothing needing these components is used while it holds (Capability API 1.179): gagged. */
    forbids: forbidsSchema.optional(),
    /** How far its holder senses with each of `combat.senses` while it holds, in the ruleset's
     *  distance (Capability API 1.180): 5e's Darkvision spell, True Seeing's truesight. Their own
     *  reach stands where it is longer; `{ "add": N }` (1.182) adds to it. */
    senses: senseRangesSchema.optional(),
    /** The light its holder sheds while it holds (Capability API 1.294): 5e's Light cantrip, a lit
     *  torch. Read where `combat.sight.darkness` makes the dark real. */
    light: lightRadiusSchema.optional(),
    /** Whoever moves unseen this near its holder is given away while it holds (Capability API 1.319),
     *  in the ruleset's distance: an alarm, a wind-chime. */
    alerts: z.number().finite().gt(0).max(10000).optional(),
    /** A condition's `unseen` hides its holder from nobody while this holds (Capability API 1.180):
     *  5e's Faerie Fire, under which the invisible are outlined. */
    cancelsUnseen: z.literal(true).optional(),
    effects: z.array(combatConditionEffectSchema).max(12).default([]),
    /** The numbers it changes while it holds. */
    modifiers: z.array(combatModifierSchema).min(1).max(6).optional(),
    /** Saves this condition fails without rolling. */
    failsSaves: z.array(sheetId).min(1).max(12).optional(),
    /** Which saves the save effects above are about. All of them when this is left out. */
    saves: z.array(sheetId).min(1).max(12).optional(),
    /** Which skills the check effects and the modifiers to checks are about, where a modifier names
     *  none of its own. Every check when this is left out; a fight's contests only then. */
    skills: z.array(sheetId).min(1).max(24).optional(),
    /**
     * Only while whoever applied this is in sight. `true` gates the whole condition; a list gates
     * only the effects it names and leaves the rest standing, which is what a fright that stops you
     * walking closer whether or not you can see it needs. Without a board it is always in sight: a
     * fight that measures nothing has no line to break.
     */
    whileSourceInSight: z.union([z.literal(true), z.array(combatConditionEffectSchema).min(1).max(12)]).optional(),
    /** Or while its holder stands within this distance of whoever applied it, in the ruleset's own
     *  distance, seen or not (Capability API 1.275). Out of both it is held off, not ended, and it
     *  holds again the moment either is true: Antipathy's fright, within 60 feet or in sight. */
    orSourceWithin: z.number().finite().gt(0).max(10000).optional(),
    /** Only while its holder stands within `within` (the ruleset's own distance) of a standing prop
     *  of the board whose label is `prop` (Capability API 1.331); held off, not ended, anywhere else.
     *  A fight with no board holds it. The Wheel's Favour, within 10 feet of the Year-Wheel. */
    whileNearProp: z
      .object({ prop: z.string().trim().min(1).max(60), within: z.number().finite().gt(0).max(10000) })
      .strict()
      .optional(),
    /** While this holds, these conditions on its holder are held off, not ended (Capability API
     *  1.275): what they do stops and their clocks run on, and they hold again once this ends.
     *  Calm Emotions' charm and fright, Mindless Rage's. */
    suppresses: uniqueIds(12).optional(),
    /** It comes off the moment whoever applied it goes down. */
    endsWhenSourceDown: z.boolean().optional(),
    /** What ends this condition (Capability API 1.125): any damage, or harm from whoever applied
     *  it or their side. Source-side harm finishes resolving before the condition ends. Or
     *  (Capability API 1.278) an attack roll at its holder, from anybody, or harm to one of its
     *  holder's friends that its holder sees: 5e's Calm Emotions. Those too wait for the step. */
    endsWhen: z
      .array(z.enum(["damaged", "harmed-by-source-side", "attacked", "ally-harmed-in-sight"]))
      .min(1)
      .max(4)
      .refine((entries) => new Set(entries).size === entries.length, { message: "Condition endings must be unique" })
      .optional(),
    /** Harm from anything cast out of these catalogs ends it, from anybody (Capability API 1.278),
     *  a scroll's spell and a standing zone's included: 5e's Calm Emotions, harmed by a spell. It
     *  waits for the step, as source-side harm does. */
    endsWhenHarmedFrom: uniqueIds(8).optional(),
    /** Damage above zero repeats the applies' saveEnds with its stored DC (Capability API 1.125).
     *  A holder with no saveEnds or DC has nothing to roll. */
    saveWhenDamaged: z.literal(true).optional(),
    /** Another combatant on the holder's side can spend this budget on their turn to end it
     *  (Capability API 1.125). Reach is in the ruleset's unit; omitted, it is one cell. `self`: its
     *  holder may too (Capability API 1.320), with no check: the showcase's Seed Hopper, torn free
     *  with an action by the held or an ally. */
    shakeOff: z
      .object({
        budget: sheetId,
        reach: z.number().finite().gt(0).max(10000).optional(),
        self: z.literal(true).optional(),
      })
      .strict()
      .optional(),
    /** What its holder uses out of these catalogs, paid with this budget, may be held over to their
     *  next turn (Capability API 1.120): a die of `sides`, and at `atLeast` or more it waits, to be
     *  completed with the same budget then or lost. 5e's Slow, against a spell cast as an action. */
    delays: combatConditionDelaysSchema.optional(),
    /** Its holder takes no damage from these entries while it holds (Capability API 1.117), whatever
     *  kind of harm they deal: 5e's Shield, under which Magic Missile does nothing. */
    noDamageFrom: z.array(catalogEntryRef).min(1).max(12).optional(),
    /** Its holder is shut away from everybody else while it holds (Capability API 1.314): 5e's
     *  Resilient Sphere. Nobody else aims anything at its holder or catches them in an area, nothing
     *  from anybody else harms, heals or puts a condition on them, and nothing of theirs reaches
     *  anybody else. Their own movement is none, but for `rolls`: spending that budget moves them up
     *  to `share` of their speed. With `lifted`, somebody standing next to them may spend that budget
     *  to pick them up, and then they go wherever their bearer goes until put down. `brokenBy` are
     *  the entries that may still be aimed at them, and end it instead of doing what they do:
     *  Disintegrate. */
    sealed: z
      .object({
        rolls: z
          .object({ budget: sheetId, share: z.number().finite().gt(0).max(1) })
          .strict()
          .optional(),
        lifted: z.object({ budget: sheetId }).strict().optional(),
        brokenBy: z.array(catalogEntryRef).min(1).max(8).optional(),
      })
      .strict()
      .optional(),
    /** Catalog entries its holder may use while it holds (Capability API 1.236), paying nothing for
     *  them but the budget each spends, with their own numbers as their spells': 5e's Dispel Evil and
     *  Good, whose caster may Break Enchantment or Dismiss. */
    actions: z.array(catalogEntryRef).min(1).max(6).optional(),
    /** Its holder is never surprised (Capability API 1.237): 5e's Foresight. Read as the fight
     *  begins. */
    cannotBeSurprised: z.literal(true).optional(),
    /** Its holder takes no falling damage and is not left prone by a fall (Capability API 1.124):
     *  5e's Feather Fall. */
    fallsSafely: z.literal(true).optional(),
    /**
     * The action economy while it holds (Capability API 1.76, combat C6d), as Haste and Slow change it:
     * - `budgets`: how many of a turn budget its holder gets, more or fewer, never below none;
     * - `grants`: what a budget (often one declared with a count of 0, which only this fills) may be
     *   spent on: the standard actions it names, an attack of one strike (`attacks`), an item's use
     *   (`items`);
     * - `exclusive`: two budgets of which a turn may spend only one: spending either empties the other;
     * - `attacksPerTurn`: how many attacks its holder makes in a turn, whatever an action would give;
     * - `onEnd`: what it leaves behind when it ends for good (not when it is put on again), as Haste's
     *   lethargy is.
     */
    budgets: z
      .array(z.object({ budget: sheetId, flat: z.number().int().min(-10).max(10) }).strict())
      .min(1)
      .max(4)
      .optional(),
    grants: z
      .object({
        budget: sheetId,
        standard: z.array(combatStandardActionSchema).min(1).max(7).optional(),
        attacks: z.literal(true).optional(),
        /** Any item's use, or only the use of an item with one of these tags (5e's Use an Object is a
         *  mundane item's, never a magic item's activation). */
        items: z.union([z.literal(true), z.object({ tags: z.array(sheetId).min(1).max(8) }).strict()]).optional(),
        /** With `attacks`, only a weapon that strikes in reach, and only within it (Capability API
         *  1.239): 5e's Frenzy, a melee weapon attack as a bonus action. A thrown weapon is swung. */
        melee: z.literal(true).optional(),
        /** With `attacks`, only the attacks named so (Capability API 1.242). */
        names: attackNamesSchema.optional(),
        /** With `attacks`, only once the attack action has been taken this turn (Capability API 1.242). */
        afterAttack: afterAttackSchema.optional(),
      })
      .strict()
      .refine((grants) => !grants.melee || grants.attacks, {
        message: '"melee" narrows "attacks", so the grant gives attacks',
        path: ["melee"],
      })
      .refine((grants) => (!grants.names && !grants.afterAttack) || grants.attacks, {
        message: '"names" and "afterAttack" narrow "attacks", so the grant gives attacks',
        path: ["names"],
      })
      .optional(),
    exclusive: z.tuple([sheetId, sheetId]).optional(),
    attacksPerTurn: z.number().int().min(0).max(10).optional(),
    /** Damage its holder takes as each of their turns starts or ends (Capability API 1.189), from
     *  whoever put it on: a sword of wounding's 1d4 necrotic, before the save that ends it. */
    harms: conditionHarmsSchema.optional(),
    /** Temporary points its holder gains as each of their turns starts or ends (Capability API
     *  1.274), lost as it ends where it says so: 5e's Heroism. */
    temporary: conditionTemporarySchema.optional(),
    /** Put on again while it holds, it stacks up to this many times rather than starting over
     *  (Capability API 1.189), and its `harms` is dealt once for each: a sword of wounding's wounds.
     *  Ending it ends them all. */
    stacks: z.number().int().min(2).max(20).optional(),
    /** One holder at a time from any one source (Capability API 1.189): put on somebody else, it
     *  leaves whoever had it from the same source. An oathbow's sworn enemy. */
    onePerSource: z.literal(true).optional(),
    /** One of the conditions sharing this name at a time (Capability API 1.256): put on while its
     *  holder has another of them, it does not go on. 5e's Bardic Inspiration dice, one at a time
     *  whatever their size. */
    oneAtATime: sheetId.optional(),
    /** The kinds it is (Capability API 1.258), which a cure's `ends` and an immunity may name in
     *  place of the conditions themselves: 5e's diseases, "one disease" ended by Lesser Restoration
     *  and kept off by Divine Health. A kind is never a condition's own id. */
    kinds: z
      .array(sheetId)
      .min(1)
      .max(4)
      .refine((kinds) => new Set(kinds).size === kinds.length, { message: "Kinds must be unique" })
      .optional(),
    /** What it does to its holder each time they take one of these rests while it is on them
     *  (Capability API 1.260): health's maximum lowered by this much, rolled where the rest is
     *  taken, as a sealed loss that the next rest gives back, or with `lasting` none does, only
     *  something that unseals. 5e's Mummy Rot, 3d6 a day, lasting. Only health kept in points. */
    onRest: conditionOnRestSchema.optional(),
    /** Its holder is this many of `combat.sizes` bigger, or smaller, while it holds (Capability API
     *  1.195), never past the first or the last: 5e's Enlarge/Reduce. On a board it fills what its
     *  new size fills where there is room, and grows only as big as there is room for. */
    size: z
      .object({
        steps: z
          .number()
          .int()
          .min(-5)
          .max(5)
          .refine((steps) => steps !== 0, "A size change is at least one step"),
      })
      .strict()
      .optional(),
    /** What it puts on its holder each time they take damage while it holds (Capability API
     *  1.261), on a clock of their turns as `onEnd`'s is: 5e's Slimy Doom, stunned until the end of
     *  the holder's next turn. */
    onDamaged: conditionOnDamagedSchema.optional(),
    /** What it spreads to whoever is near its holder while it holds (Capability API 1.263), for as
     *  long as they stay near and the holder is up and able to act: 5e's Aura of Protection,
     *  Devotion and Courage, a Holy Nimbus's radiant harm on enemies (the condition it puts on
     *  `harms` them as their turn starts, from the holder), Countercharm. What it puts on is
     *  nobody's to cure or save against: it comes off only as they leave, or the aura goes. */
    auras: z.array(conditionAuraSchema).min(1).max(4).optional(),
    /** What it makes its holder do with their turn (Capability API 1.264): what the turn may hold,
     *  which way they walk from whoever put it on, or a table rolled as the turn starts. */
    behavior: conditionBehaviorSchema.optional(),
    /** Run out on its clock, it turns into this condition, with no clock of its own (Capability API
     *  1.261): an aboleth's Tentacle disease after its minute. Ended any other way, it does not. A
     *  fight that ends first lets the clock run out. */
    expires: z.object({ becomes: sheetId }).strict().optional(),
    /** It comes off its holder, and off their sheet, once they move (`moves`) or do anything at all,
     *  reactions included (`acts`), however it was put on (Capability API 1.311): a ranger's
     *  camouflage for Hide in Plain Sight, made before the fight, gone on the first step. */
    endsWhenHolder: z
      .object({ moves: z.literal(true).optional(), acts: z.literal(true).optional() })
      .strict()
      .refine((ends) => ends.moves || ends.acts, { message: 'Say what ends it: "moves", "acts" or both' })
      .optional(),
    /** Only a cure from one of these catalogs, at this level or higher as it is paid, ends it
     *  (Capability API 1.261): the aboleth's later disease, only by a 6th-level spell. */
    curedOnlyBy: z
      .object({ catalogs: z.array(sheetId).min(1).max(8).optional(), minLevel: z.number().int().min(1).max(20) })
      .strict()
      .optional(),
    /** What it leaves behind is on a clock of its holder's turns: nothing rolls a save against it (it
     *  has no difficulty) and an instant one would never come off. */
    onEnd: conditionOnEndSchema.optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    savesNeedSomethingToNarrow(entry, ctx);
    skillsNeedSomethingToNarrow(entry, ctx);
    if (entry.suppresses?.includes(entry.condition)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suppresses"],
        message: "A condition holds off others, not itself",
      });
    }
    if (entry.orSourceWithin !== undefined && entry.whileSourceInSight === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["orSourceWithin"],
        message: '"orSourceWithin" widens "whileSourceInSight", so the condition names that too',
      });
    }
    if (entry.grants && !entry.grants.standard && !entry.grants.attacks && !entry.grants.items) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grants"],
        message: "A grant says what its budget may be spent on: standard actions, attacks or items",
      });
    }
    if (entry.exclusive && entry.exclusive[0] === entry.exclusive[1]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exclusive"], message: "Two different budgets" });
    }
    if (entry.stacks !== undefined && !entry.harms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stacks"],
        message: "Stacks multiply what a condition harms with, so it names harms",
      });
    }
  });

/** The effects an item may have while worn or carried: every effect a condition may have but the ones
 *  a level cannot, since nobody put an item on its holder and it never ends by itself. A check outside
 *  a fight reads the check and save effects among them; a fight reads all of them. */
const itemEffectSchema = combatConditionEffectSchema.exclude([...RULESET_LEVEL_REFUSED_EFFECTS]);
export const RULESET_ITEM_EFFECTS = itemEffectSchema.options;
/** The effects a check outside a fight reads, which were all an item had before Capability API 1.56. */
export const RULESET_ITEM_CHECK_EFFECTS = [...RULESET_CHECK_SCOPED_EFFECTS, ...RULESET_SAVE_SCOPED_EFFECTS] as const;
/** And the numbers a check outside a fight reads: the rest are a fight's. */
export const RULESET_ITEM_CHECK_MODIFIER_TARGETS = ["checks", "saves"] as const;

/**
 * What an item does while worn (`worn`) or while it is only carried (`carried`), in the condition
 * vocabulary: advantage or disadvantage on its holder's checks and saves, modifiers to them, and saves
 * it makes them fail, narrowed by `skills` and `saves` as a condition's are.
 */
/** What an item does to one ability while it applies: `set` it to at least a number (a higher score
 *  stays), or `add` to it. */
const itemAbilityChangeSchema = z.union([
  z.object({ set: z.number().int() }).strict(),
  z
    .object({
      add: z.number().int().min(-100).max(100),
      /** It goes on top of whatever the score is after every item's `set`, and lifts it to no more
       *  than this (Capability API 1.313): an Ioun Stone of Strength's +2 to at most 20, a Hammer of
       *  Thunderbolts' +4 to at most 30. A score already above it stays. Without `max` an add goes on
       *  the character's own score, a set higher still winning, as before. */
      max: z.number().int().min(-1000).max(1000).optional(),
    })
    .strict(),
]);

/** A catalog entry's effect on one roll it is applied to (Capability API 1.156): the check and save
 *  part of the condition vocabulary, a pool check's own dice, and what applying it spends. */
export const rulesetContextualSchema = z
  .object({
    effects: z
      .array(z.enum(RULESET_ITEM_CHECK_EFFECTS as unknown as [string, ...string[]]))
      .min(1)
      .max(4)
      .optional(),
    modifiers: z.array(combatModifierSchema).min(1).max(6).optional(),
    skills: z.array(sheetId).min(1).max(24).optional(),
    saves: z.array(sheetId).min(1).max(12).optional(),
    check: contextualCheckSchema.optional(),
    cost: contextualCostSchema.optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (!entry.effects && !entry.modifiers && !entry.check)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An applied effect does something: effects, modifiers or check",
      });
    entry.modifiers?.forEach((modifier, index) => {
      if (modifier.to !== "checks" && modifier.to !== "saves")
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["modifiers", index, "to"],
          message: "An applied effect changes checks or saves",
        });
    });
  });
export type RulesetContextual = z.infer<typeof rulesetContextualSchema>;

export const rulesetItemEffectSchema = z
  .object({
    effects: z.array(itemEffectSchema).min(1).max(6).optional(),
    modifiers: z.array(combatModifierSchema).min(1).max(6).optional(),
    failsSaves: z.array(sheetId).min(1).max(12).optional(),
    saves: z.array(sheetId).min(1).max(12).optional(),
    skills: z.array(sheetId).min(1).max(24).optional(),
    /** Abilities it sets or raises, by ability id, applied before the sheet is worked out. */
    abilities: z.record(sheetId, itemAbilityChangeSchema).optional(),
    /** Kinds of harm its holder takes half of, double, or none of in a fight. Exceptions name
     *  what gets through, as on a creature (Capability API 1.132). */
    resist: z.array(creatureHideEntrySchema).min(1).max(30).optional(),
    vulnerable: z.array(promptSafeText(40)).min(1).max(30).optional(),
    immune: z.array(creatureHideEntrySchema).min(1).max(30).optional(),
    /** The sheet's own conditions a fight never puts on its holder. */
    conditionImmunities: z.array(sheetId).min(1).max(40).optional(),
    /** How far its holder senses with each of `combat.senses`, in the ruleset's distance (Capability
     *  API 1.180): 5e's goggles of night give darkvision. Their own reach stands where it is longer. */
    senses: senseRangesSchema.optional(),
    /** The light it sheds for its holder (Capability API 1.294): a lantern, a sun blade. */
    light: lightRadiusSchema.optional(),
    /** It gives away whoever moves unseen this near its holder (Capability API 1.319), in the
     *  ruleset's distance: the showcase's Wind-Chime, `15`. */
    alerts: z.number().finite().gt(0).max(10000).optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const abilities = Object.entries(entry.abilities ?? {});
    const hide = entry.resist ?? entry.vulnerable ?? entry.immune ?? entry.conditionImmunities;
    if (
      !entry.effects &&
      !entry.modifiers &&
      !entry.failsSaves &&
      abilities.length === 0 &&
      !hide &&
      !entry.senses &&
      !entry.light &&
      !entry.alerts
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effects"],
        message:
          "An item's effect does something: effects, modifiers, saves it fails, abilities it changes, senses it gives, light it sheds, movers it gives away, or harm or conditions it keeps off",
      });
    }
    if (abilities.length > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["abilities"],
        message: "An item changes at most 12 abilities",
      });
    }
    for (const [id, change] of abilities) {
      if ("add" in change && change.add === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["abilities", id, "add"],
          message: "Adding 0 changes nothing",
        });
      }
    }
    savesNeedSomethingToNarrow(entry, ctx);
    skillsNeedSomethingToNarrow(entry, ctx);
  });
export type RulesetItemEffect = z.infer<typeof rulesetItemEffectSchema>;

/** Something an item asks of whoever wears it: a value off their sheet, the least it may be, and what
 *  applies while it falls short. What applies cannot change an ability, since the value may read one. */
export const rulesetItemRequirementSchema = z
  .object({
    value: rulesetValueRefSchema,
    atLeast: z.number().finite(),
    otherwise: rulesetItemEffectSchema,
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.otherwise.abilities !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["otherwise", "abilities"],
        message: "An unmet requirement cannot change an ability, since what it asks may read one",
      });
    }
  });
export type RulesetItemRequirement = z.infer<typeof rulesetItemRequirementSchema>;

/** A number a contest reads for whoever takes part in it: a value off the sheet, read once when the
 *  fight begins, the way a defense or a save is. A creature written in plain numbers gives its own. */
const combatCheckSchema = z.object({ id: sheetId, label, value: rulesetValueRefSchema }).strict();

/** A CONTEST: both sides throw the fight's own attack dice and add a check, the higher total wins,
 *  and the winner changes what holds the loser or where the loser stands. How grabbing somebody,
 *  shoving them over or away, and breaking free are said, in the ruleset's own words. */
const combatContestBaseSchema = z
  .object({
    id: sheetId,
    label,
    budget: sheetId,
    /** It may take the place of one strike when an action buys several, the way an attack does. */
    strike: z.literal(true).optional(),
    /** How far it reaches, in the ruleset's own distance unit. One cell when left out. */
    reach: z.number().finite().gt(0).max(10000).optional(),
    /** Each side rolls the best of the checks it may use here. */
    attacker: z.object({ checks: z.array(sheetId).min(1).max(4) }).strict(),
    /** Left out where the contest is rolled against a fixed `difficulty` instead. */
    defender: z
      .object({ checks: z.array(sheetId).min(1).max(4) })
      .strict()
      .optional(),
    /** A number the actor's check meets to win, in place of anybody rolling against it (Capability
     *  API 1.193): 5e's DC 15 Wisdom (Medicine) check that closes a sword of wounding's wounds, or
     *  the DC 10 one that stabilizes the dying. One of this and `defender`. */
    difficulty: z.number().int().min(0).max(1000).optional(),
    /** Who it may be taken on (Capability API 1.193): the other side, the actor's own, or anybody,
     *  the actor included. The other side when left out. */
    targets: z.enum(["enemy", "ally", "any"]).optional(),
    /** Offered only on a target that holds this condition (Capability API 1.193): the wounded. */
    targetHolds: sheetId.optional(),
    /** Offered only on a target that is dying and not yet stable (Capability API 1.193). */
    targetDying: z.literal(true).optional(),
    /** Who takes a tie. */
    ties: z.enum(["defender", "attacker"]).default("defender"),
    /** Aimed only at whoever put this condition on the actor, and offered only while it holds: how
     *  breaking free is said. */
    from: z
      .object({
        holding: sheetId,
        /** Offered only against a hold that names an escape DC (Capability API 1.175), so the
         *  restraint of a web is broken and petrification is not. */
        escapable: z.literal(true).optional(),
      })
      .strict()
      .optional(),
    /** Not taken against a target more than this many of `combat.sizes` larger than the one taking it
     *  (Capability API 1.103): 5e's grapple and shove are `1`. A combatant whose size nothing says is
     *  never refused. */
    maxSizeAbove: z.number().int().min(0).max(9).optional(),
    onWin: z
      .object({
        /** On the loser, with the winner as its source, so a condition that ends when its source goes
         *  down ends when the one holding on does. `rounds` gives it a clock; without one it lasts
         *  until something ends it. */
        applies: z
          .array(z.object({ condition: sheetId, rounds: z.number().int().min(1).max(100).optional() }).strict())
          .min(1)
          .max(4)
          .optional(),
        /** Conditions it takes off the actor or the target. */
        ends: z
          .array(z.object({ condition: sheetId, on: z.enum(["actor", "target"]) }).strict())
          .min(1)
          .max(4)
          .optional(),
        /** How far the loser is pushed straight away from the winner, in the ruleset's own distance
         *  unit. Only a fight on a board moves anybody. */
        push: z.number().finite().gt(0).max(10000).optional(),
        /** The target, if dying, is stable (Capability API 1.193). */
        stabilizes: z.literal(true).optional(),
      })
      .strict()
      .refine((onWin) => !!(onWin.applies || onWin.ends || onWin.push || onWin.stabilizes), {
        message: "A contest's onWin applies, ends, pushes or stabilizes something",
      }),
  })
  .strict()
  .refine((contest) => (contest.defender === undefined) !== (contest.difficulty === undefined), {
    message: 'A contest is rolled against a "defender" or a fixed "difficulty": one of them',
    path: ["difficulty"],
  });

/** Named, so the whole definition's inferred type stays short enough for the compiler to write. */
export type RulesetCombatContestDeclaration = z.infer<typeof combatContestBaseSchema>;
const combatContestSchema: z.ZodType<RulesetCombatContestDeclaration, z.ZodTypeDef, unknown> = combatContestBaseSchema;

/** How big a combatant is, smallest first (Capability API 1.103). A creature names one by id; a sheet
 *  reads a number off itself, 1 for the first, which is rounded and held to the list; whoever nothing
 *  says is `default`, or no size at all. */
export interface RulesetCombatSizes {
  order: Array<{ id: string; label: string; cells?: number }>;
  sheet?: RulesetValueRef;
  default?: string;
}
const combatSizesSchema: z.ZodType<RulesetCombatSizes, z.ZodTypeDef, unknown> = z
  .object({
    order: z
      .array(
        z
          .object({
            id: sheetId,
            label,
            /** How many cells a side a creature of this size fills on a board (Capability API 1.194):
             *  5e's Large is 2, Huge 3 and Gargantuan 4. One when left out. */
            cells: z.number().int().min(1).max(6).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(10),
    sheet: rulesetValueRefSchema.optional(),
    default: sheetId.optional(),
  })
  .strict();

/** Holding an effect together while the fight goes on. The text field is where it is written down,
 *  so the sheet shows what a character is holding after the battle as well as during it. */
const combatConcentrationSchema = z
  .object({
    text: sheetId,
    save: sheetId,
    /** The lowest difficulty damage can force. */
    floor: z.number().int().min(0).max(100),
    /** The share of the damage taken that sets the difficulty when it beats the floor. */
    fromDamage: z.number().gt(0).max(1),
  })
  .strict();

/** What happens to a character at zero. A ruleset without this block simply has them go down. */
const combatDyingSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("saves"),
      /** The two tracks that count the rolls. How many it takes is each track's own maximum. */
      successes: sheetId,
      failures: sheetId,
      dice: combatDiceSchema,
      succeedAt: z.number().int().min(1).max(1000),
      naturals: z
        .object({
          max: z.enum(["revive-1", "success", "none"]).default("none"),
          min: z.enum(["two-failures", "one-failure", "none"]).default("none"),
        })
        .strict()
        .default({}),
      damageWhileDown: z.enum(["one-failure", "two-failures", "none"]).default("none"),
      criticalWhileDown: z.enum(["one-failure", "two-failures", "none"]).default("none"),
      /** The condition a character is in while they are down, when the sheet declares one. */
      condition: sheetId.optional(),
    })
    .strict(),
]);

/** One rung of the scale a Game Master picks an opponent from. Validated here and read when
 *  creatures arrive, so a proposed opponent can be clamped into the ruleset's own numbers. */
const combatThreatTierSchema = z
  .object({
    id: sheetId,
    label,
    /** `[lowest, highest]` for a creature of this tier. */
    health: z.tuple([z.number().int().min(1).max(100000), z.number().int().min(1).max(100000)]),
    defense: z.number().int().min(0).max(100),
    toHit: z.number().int().min(-20).max(50),
    damagePerRound: z.tuple([z.number().int().min(0).max(10000), z.number().int().min(0).max(10000)]),
    saveDifficulty: z.number().int().min(0).max(100),
  })
  .strict();

/** Whether a fight's initiative is a number attacks move with a style that spends it, which is the one
 *  blow hardness stops. */
export function rulesetSpendsInitiative(combat: {
  initiative: { resource?: { styles: Array<{ spends?: unknown }> } };
}) {
  return !!combat.initiative.resource?.styles.some((style) => style.spends !== undefined);
}
const HARDNESS_NEEDS_SPENDING =
  "Hardness stops a spending blow, so initiative is a number attacks move with a style that spends it";

/** One way any attack may be made when initiative is a number attacks move. `takes`: on a hit the
 *  damage successes come off the target's number instead of their health, and the attacker gains them
 *  plus `gain`. `spends`: the damage is the attacker's own number in dice, and the number resets to the
 *  base; a miss costs what `onMiss` says, read at the number. Exactly one of the two. */
const combatInitiativeStyleSchema = z
  .object({
    id: sheetId,
    label,
    takes: z
      .object({ gain: z.number().int().min(0).max(20).default(0) })
      .strict()
      .optional(),
    spends: z.object({ onMiss: stepTableSchema.optional() }).strict().optional(),
  })
  .strict()
  .refine((style) => (style.takes === undefined) !== (style.spends === undefined), {
    message: "A style either takes or spends",
  });

/** Initiative as a number attacks move: what a spending attack resets it to, the ways an attack may be
 *  made, and what happens to whoever is taken down to the line. */
const combatInitiativeResourceSchema = z
  .object({
    base: z.number().int().min(0).max(100),
    styles: z.array(combatInitiativeStyleSchema).min(1).max(4),
    crash: z
      .object({
        /** At or below this, a combatant has crashed and cannot make a spending attack. */
        at: z.number().int().min(-100).max(100).default(0),
        /** One of the sheet's own conditions, put on whoever crashes for as long as they are crashed. */
        condition: sheetId.optional(),
        /** What the attacker who crashed them gains. */
        bonus: z.number().int().min(0).max(100).default(0),
        /** How many of their own turns a crashed combatant waits before the number goes back to base. */
        recoverAfter: z.number().int().min(1).max(20).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Optional, and absent rather than empty, for the same reason as `catalogs`: a ruleset that says
 *  nothing about combat is read exactly as it was before this block existed. A ruleset may carry
 *  both `combat` and `battle`; the bridge simply never runs for one whose fights follow its own
 *  rules, so an author can keep the older block for an Engine that lacks this one. */
const combatObjectSchema = z
  .object({
    /** The closed registry of combat kinds. Adding one is an Engine PR with regressions.
     *  `attack-vs-defense` adds dice up and compares them with a number; `dice-pool` throws the
     *  ruleset's own pools and counts successes, so every number a roll adds is dice and every number
     *  it meets is successes, exactly as the ruleset's `dice-pool` checks read the sheet. */
    kind: z.enum(["attack-vs-defense", "dice-pool"]),
    health: combatHealthSchema,
    /** What an attack is rolled against: a total to reach, or under `dice-pool` the successes an
     *  attack needs, never fewer than one. */
    defense: rulesetValueRefSchema,
    initiative: z
      .object({
        /** The dice thrown and added up, with `modifier`. Or, under `dice-pool`, `pool`: dice thrown as
         *  a pool, whose successes plus `plus` are the number. Exactly one of the two. */
        dice: combatDiceSchema.optional(),
        modifier: rulesetValueRefSchema.optional(),
        pool: rulesetValueRefSchema.optional(),
        plus: z.number().int().min(0).max(100).optional(),
        /** `round` throws everybody's initiative again as each new round begins, and the order
         *  follows it. Once for the whole fight when left out. */
        each: z.enum(["fight", "round"]).optional(),
        /** Initiative is a check made with this ability (Capability API 1.240): what rolls such a
         *  check twice rolls `dice` twice, the better or the worse kept. 5e's Dexterity: Foresight's
         *  advantage on checks, Enhance Ability's Cat's Grace. Thrown dice only. */
        checkAbility: sheetId.optional(),
        /** The number is kept and moved by attacks rather than thrown again, and the order follows it
         *  as each round begins. `dice-pool` fights only. */
        resource: combatInitiativeResourceSchema.optional(),
      })
      .strict(),
    /** How an `attack-vs-defense` attack is rolled. Required there, and refused under `dice-pool`,
     *  whose die, target and face rules are the ruleset's own `resolution`. */
    attackRoll: z
      .object({
        dice: combatDiceSchema,
        /** Whether a fight may roll twice and keep one. */
        advantage: z.boolean().default(false),
        naturals: combatNaturalsSchema.default({}),
        /** What a critical hit does to the damage: roll the dice twice, or add their highest faces. */
        critical: z.enum(["double-dice", "max-dice", "none"]).default("none"),
        /** The lowest natural face of the attack die that is a critical, read off the attacker's sheet
         *  (Capability API 1.81): 19 for a 5e Champion. The die's highest face when left out, or when
         *  the sheet reads higher; never below 2. Needs `naturals.max: "critical"` and a single die. */
        criticalFrom: rulesetValueRefSchema.optional(),
      })
      .strict()
      .describe("Required when kind is attack-vs-defense, and refused when it is dice-pool.")
      .optional(),
    /** What a `dice-pool` fight rolls beyond the ruleset's own check rules. Required there, and
     *  refused under `attack-vs-defense`. */
    pool: z
      .object({
        /** Whether a fight may throw a pool twice and keep the one with more successes. */
        advantage: z.boolean().default(false),
        /** The per-die target damage and soak are thrown against. The ruleset's default target when
         *  left out. Damage and soak count each die at or above it once, and nothing else: no face
         *  doubles, explodes, cancels or botches on them. */
        damageTarget: z.number().int().min(2).max(100).optional(),
        /** What a target takes off the harm a hit does, by kind. `roll` throws that many dice
         *  against the damage target and each success takes one off; without it the number comes
         *  off the damage dice before they are thrown. `byKind` names kinds of the health track and
         *  wins over `all` for its kind. A creature gives its own numbers. */
        soak: z
          .object({
            roll: z.boolean(),
            all: rulesetValueRefSchema.optional(),
            byKind: z.record(rulesetValueRefSchema).optional(),
          })
          .strict()
          .optional(),
        /** A fighter's hardness, read off their sheet as the fight begins (their armor's, through
         *  `itemStat`): a spending blow whose dice are below it lands and does nothing. Only where
         *  initiative is a number attacks move and a style spends it. A creature gives its own. */
        hardness: rulesetValueRefSchema.optional(),
      })
      .strict()
      .describe("Required when kind is dice-pool, and refused when it is attack-vs-defense.")
      .optional(),
    /** A pool's least damage dice after soak, read off the attacker (1.146). */
    damage: z.object({ minimum: rulesetValueRefSchema.optional() }).strict().optional(),
    /** One hit above the target's number costs their next turn (1.147). */
    daze: z
      .object({
        over: rulesetValueRefSchema,
        measure: z.literal("damage"),
        condition: sheetId.optional(),
        text: promptSafeText(500).optional(),
      })
      .strict()
      .optional(),
    economy: z
      .object({
        budgets: z.array(combatBudgetSchema).min(1).max(8),
        /** How far a turn may move, in the ruleset's own distance unit. */
        movement: rulesetValueRefSchema.optional(),
        /** How far a turn may move other than walking, off the sheet (Capability API 1.113): a race's
         *  swim speed, a fly speed a spell or a feature grants. Nought is not moving that way. */
        movementModes: z
          .object({
            fly: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
            swim: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
            climb: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
            burrow: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    /** How the fight screen shows this system (Capability API 1.375). `defense.short` heads its
     *  column ("AC"), and `defense.hide` drops the column where the number says nothing (a dice pool's
     *  one success needed). `pools` names the sheet pools shown under a turn, in order; without it the
     *  ones the turn's options spend are shown. */
    display: z
      .object({
        defense: z
          .object({ short: z.string().trim().min(1).max(6).optional(), hide: z.boolean().optional() })
          .strict()
          .optional(),
        pools: z.array(sheetId).max(16).optional(),
      })
      .strict()
      .optional(),
    /** What one cell of a board is worth in this system's own distance, and what that distance is
     *  called. Declaring it is what makes a fight positionable at all: without it every fight stays
     *  theatre of the mind, and everything below is refused. */
    distance: z
      .object({ label: promptSafeText(12), perCell: z.number().finite().gt(0) })
      .strict()
      .optional(),
    /** What shooting past the ordinary distance does, and what shooting with a foe in the next cell
     *  does. A system where neither costs anything simply leaves this out. */
    ranged: z
      .object({
        long: z.enum(["disadvantage", "normal"]).default("normal"),
        adjacentFoe: z.enum(["disadvantage", "normal"]).default("normal"),
      })
      .strict()
      .optional(),
    /**
     * What standing behind something adds to the defense an attack is rolled against (Capability API
     * 1.74 for everything past `bonus`). Cover is graded by corner lines from the attacker (combat
     * C6a-2): `bonus` is half cover's, and `threeQuarters` the bigger one when the ruleset has it. A
     * target out of sight is total cover and cannot be aimed at, so it needs no number. `saves` names
     * the saves cover helps too, against an action's own save, from where the action comes; `creatures`
     * makes anybody standing in the way half cover, friend or foe.
     */
    cover: z
      .object({
        bonus: z.number().int().min(0).max(100),
        threeQuarters: z.number().int().min(0).max(100).optional(),
        saves: z.array(sheetId).min(1).max(12).optional(),
        creatures: z.literal(true).optional(),
      })
      .strict()
      .optional(),
    /**
     * What this system makes of a board's height (Capability API 1.75, combat C6b). Height is always
     * walked and seen by, whatever this says: climbing a level costs one more cell, nobody walks a step
     * of two levels or more, and ground higher than both ends blocks sight. This says what the system
     * adds: how high one level is in its own distance (`levelHeight`), what striking down from higher
     * ground gives (`highGround`: advantage, or a bonus taken off the defense the attack is rolled
     * against), how many cells further a shot carries from it (`rangeBonus`), and what a fall does
     * (`falling`): `dice` for every `per` of the drop, at most `max` of them, of `type`, and `prone`
     * after it when the system says so.
     */
    elevation: z
      .object({
        levelHeight: z.number().finite().gt(0),
        highGround: z
          .union([z.literal("advantage"), z.object({ bonus: z.number().int().min(1).max(100) }).strict()])
          .optional(),
        rangeBonus: z.number().int().min(1).max(10).optional(),
        falling: z
          .object({
            per: z.number().finite().gt(0),
            dice: combatDiceSchema,
            max: z.number().int().min(1).max(100),
            type: promptSafeText(40).optional(),
            prone: sheetId.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    /** The budget a strike at somebody leaving one's reach is paid out of. A ruleset that declares
     *  none has no such strikes. */
    opportunity: z.object({ budget: sheetId }).strict().optional(),
    /** The budget a second attack with a weapon in the other hand is paid out of, and whether its
     *  damage keeps a positive ability (`penalty-only` adds the ability only when it takes away, as
     *  5e's two-weapon fighting does). A ruleset that declares none has no off-hand attacks. */
    offHand: z
      .object({
        budget: sheetId,
        ability: z.enum(["full", "penalty-only"]).default("full"),
        /** Read off the fighter's sheet: above 0, that fighter's off hand keeps the full ability
         *  whatever `ability` says (Capability API 1.97), as 5e's Two-Weapon Fighting style does. */
        fullWhen: (rulesetValueRefSchema as z.ZodType<RulesetValueRef, z.ZodTypeDef, unknown>).optional(),
      })
      .strict()
      .optional(),
    attacks: z.array(combatAttackSourceSchema).max(8).optional(),
    abilities: z.array(combatAbilitySourceSchema).max(8).optional(),
    standard: z.array(combatStandardActionSchema).max(7).optional(),
    /**
     * What a standard action does BEYOND the flag it sets, for the ones where the flag is not the
     * whole rule. Only `dodge` has such a part today: many systems also make the dodger harder to
     * catch with the saves that are about getting out of the way. Kept in its own block rather than
     * on `standard`, which is a list of names every shipped ruleset already writes as strings.
     */
    standardEffects: z
      .object({
        dodge: z
          .object({ saves: z.array(sheetId).min(1).max(12) })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    conditions: z.array(combatConditionSchema).max(RULESET_CONDITIONS_MAX).optional(),
    /** Levels of live tracks that count as conditions while the track is high enough. */
    levels: z.array(combatLevelSchema).max(20).optional(),
    /** Every row adds comma-separated harm or condition words from this column (Capability API
     *  1.132). A damage word may say `except` and the tags that get through it. */
    sheetHides: z
      .array(
        z
          .object({
            list: sheetId,
            column: sheetId,
            kind: z.enum(["resist", "vulnerable", "immune", "conditionImmunities"]),
          })
          .strict(),
      )
      .max(8)
      .optional(),
    /** The numbers a contest reads, and the contests a combatant may take. */
    checks: z.array(combatCheckSchema).max(12).optional(),
    /**
     * Readying for real (Capability API 1.288). The `ready` standard action then readies one of its
     * user's other options taken with the same budget, or a move, to be taken with `budget` (5e's
     * reaction) when it happens: an opponent coming where it can reach them, or an opponent its
     * user sees using something. It waits until the start of its user's next turn. With
     * `concentrates`, a spell readied is paid for as it is readied and held by concentration: lost
     * with it, and spent if it never goes off. 5e: `{ "budget": "reaction", "concentrates": true }`.
     */
    readying: z
      .object({ budget: sheetId, concentrates: z.literal(true).optional() })
      .strict()
      .optional(),
    /**
     * Hiding for real (Capability API 1.287). The `hide` standard action throws `stealth` (one of
     * `checks`) on the fight's own dice, and its user is hidden from each opponent that does not see
     * them clearly and whose passive `perception` (`passive` plus that check) the total meets; one
     * who sees them only lightly obscured has `lightly` off it. Whoever they are hidden from does not
     * see them: cannot point anything at them, and is attacked by them as by somebody unseen. It
     * lasts until they attack, use something that needs one of the `noisy` components, or are seen
     * clearly by that opponent, and the `search` standard action (or a creature's `search` action)
     * finds them where its Perception check meets their total. 5e's Hide, Search and passive
     * Perception: `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }`.
     */
    hiding: z
      .object({
        stealth: sheetId,
        perception: sheetId,
        passive: z.number().int().min(0).max(100).optional(),
        lightly: z.number().int().min(0).max(100).optional(),
        noisy: componentIdsSchema.optional(),
        /** Added to a passive Perception rolled with advantage, and taken off one with disadvantage
         *  (Capability API 1.290): 5e's 5. Without it a passive reads no mode. */
        passiveMode: z.number().int().min(1).max(20).optional(),
      })
      .strict()
      .optional(),
    contests: z.array(combatContestSchema).max(12).optional(),
    /** How big a combatant is, smallest first: what a contest's `maxSizeAbove` reads (1.103). */
    sizes: combatSizesSchema.optional(),
    /** What a combatant is (Capability API 1.168): the types and tags a creature names and a target
     *  test reads. A character takes its type from `field` (a text or choice field holding a type id)
     *  or else `default`; a creature from its own `type` and `tags`. */
    creatureTypes: z
      .object({
        types: z
          .array(z.object({ id: sheetId, label }).strict())
          .min(1)
          .max(40),
        tags: z
          .array(z.object({ id: sheetId, label }).strict())
          .min(1)
          .max(60)
          .optional(),
        field: sheetId.optional(),
        default: sheetId.optional(),
      })
      .strict()
      .optional(),
    concentration: combatConcentrationSchema.optional(),
    /** Senses that see where eyes cannot (Capability API 1.178): darkvision, blindsight, truesight.
     *  A creature says its range; a character's is read off its sheet by `sheet`, nothing at zero.
     *  `blind` is one that works without eyes too: blindsight, tremorsense. */
    senses: z.array(combatSenseSchema).min(1).max(8).optional(),
    /** Seeing (1.178). `unseenAttacks` gives an attack advantage when its target cannot see the
     *  attacker, and disadvantage when the attacker cannot see its target. `eyes` is the sense (as a
     *  condition's `lacks` names it, 1.127) that is sight: whoever lacks it sees only by a `blind`
     *  sense, so a blinded caster picks no "creature you can see". */
    sight: combatSightSchema.optional(),
    /** What using something may need (Capability API 1.179): 5e's verbal, somatic and material. */
    components: combatComponentsSchema.optional(),
    dying: combatDyingSchema.optional(),
    /** The damage types this system has. Matched without case, so "Fire" and "fire" are one type. */
    damageTypes: z.array(promptSafeText(40)).max(40).optional(),
    /** Required when `health` names a wound track, and refused when it names a pool. Which of the
     *  two it is depends on the sheet the id points at, so no JSON Schema can decide it and the
     *  rule is said in words here for an author's editor and enforced at import. */
    damageKinds: combatDamageKindsSchema
      .describe(
        "Required when `health` names a wound track, and refused when it names a pool. The import check decides which, because it reads the sheet the id points at.",
      )
      .optional(),
    threat: z
      .object({ tiers: z.array(combatThreatTierSchema).min(1).max(40) })
      .strict()
      .optional(),
    /** How much of a live pool one combatant may spend in a fight per turn or per round. A cost past
     *  it is not affordable. Read once as the fight begins. An opponent written in plain numbers pays
     *  for nothing off a sheet, so it never binds one; one written as a sheet pays and is held to it. */
    spendLimits: z
      .array(z.object({ pool: sheetId, max: rulesetValueRefSchema, per: z.enum(["turn", "round"]) }).strict())
      .min(1)
      .max(12)
      .optional(),
  })
  .strict();

// Named so its type is written once, not inlined into the definition schema's (which grew past
// what the compiler will serialize).
type RulesetCombatDeclaration = z.output<typeof combatObjectSchema>;
const combatSchema: z.ZodType<RulesetCombatDeclaration, z.ZodTypeDef, unknown> = combatObjectSchema;

// ── Layers: variants a ruleset ships inside its own file ──

/** How many layers one ruleset may declare. They are toggles under the ruleset in the setup
 *  wizard, so this is a ceiling on a list a player has to read before a game starts. */
export const RULESET_LAYERS_MAX = 12;

/** How much Game Master text ONE layer may carry in total, check-time and world-generation
 *  together. A layer appends to the ruleset's own guidance rather than replacing it, so this is
 *  the ceiling on what a single toggle can add to a prompt. */
export const RULESET_LAYER_GUIDANCE_MAX = 4000;

/** What a layer takes out of an enum field. Values are only ever REMOVED. A value a layer added
 *  would be unknown to every other reader of the sheet, starting with the ruleset's own editor,
 *  and a character carrying it would stop making sense the moment the layer was turned off. */
const layerFieldSchema = z
  .object({
    id: sheetId,
    removeValues: z.array(z.string().min(1).max(80)).min(1).max(40),
    /** The value the field falls back to when the layer takes the declared default away. */
    default: z.string().max(80).optional(),
  })
  .strict();

/** Which entries the catalog picker leaves out under this layer. Exactly one comparison, against a
 *  filter the catalog declares, so a rule that could never match an entry is refused at import. */
const layerCatalogHideSchema = z
  .object({
    filter: sheetId,
    above: z.number().finite().optional(),
    below: z.number().finite().optional(),
    equals: z.string().max(80).optional(),
    notIn: z.array(z.string().max(80)).min(1).max(24).optional(),
  })
  .strict()
  .superRefine((hide, ctx) => {
    const present = (["above", "below", "equals", "notIn"] as const).filter((key) => hide[key] !== undefined);
    if (present.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A hide rule names exactly one of: above, below, equals, notIn",
      });
    }
  });

const layerCatalogSchema = z.object({ id: sheetId, hide: layerCatalogHideSchema }).strict();

const layerGmSchema = z
  .object({
    /** Appended to `gm.checkGuidance`, after the ruleset's own text and after earlier layers'. */
    guidance: promptSafeText(RULESET_LAYER_GUIDANCE_MAX).optional(),
    /** Appended to `gm.worldGuidance` the same way. */
    worldGuidance: promptSafeText(RULESET_LAYER_GUIDANCE_MAX).optional(),
  })
  .strict()
  .superRefine((gm, ctx) => {
    if ((gm.guidance?.length ?? 0) + (gm.worldGuidance?.length ?? 0) > RULESET_LAYER_GUIDANCE_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `One layer carries at most ${RULESET_LAYER_GUIDANCE_MAX} characters of guidance in total`,
      });
    }
  });

/** A variant of this ruleset the player turns on when a game is created (Low magic, Hard winter),
 *  frozen into the pin for that game's lifetime. The effects are a closed set and every one of them
 *  narrows or appends, so a layer can never teach the Engine a mechanic the ruleset itself could
 *  not declare: guidance is added, enum values are taken away, the ladder is swapped for another
 *  ladder of the same kind, and catalog entries are hidden from the picker. Layers shipped by
 *  OTHER authors are a later slice; these live in the ruleset's own file, so a pinned game can
 *  never lose one. */
const rulesetLayerSchema = z
  .object({
    id: sheetId,
    label,
    /** Shown beside the toggle in the setup wizard. */
    summary: promptSafeText(300).optional(),
    /** Layers that cannot be on together. Naming one side of the pair is enough. */
    conflicts: z.array(sheetId).max(RULESET_LAYERS_MAX).optional(),
    gm: layerGmSchema.optional(),
    fields: z.array(layerFieldSchema).max(24).optional(),
    /** REPLACES the ruleset's ladder, in the shape of its own resolution kind. */
    difficultyLadder: rulesetDifficultyLadderSchema.optional(),
    /** Several rules may name one catalog, so a layer can hide by level and by school at once. */
    catalogs: z.array(layerCatalogSchema).max(24).optional(),
    /** Coins this layer takes out of the ruleset's currencies: single coins, or whole families, as a
     *  setting without electrum does. A family's smallest coin goes only with its family. */
    currencies: z
      .object({
        removeUnits: z.array(sheetId).min(1).max(60).optional(),
        removeFamilies: z.array(sheetId).min(1).max(6).optional(),
      })
      .strict()
      .refine((currencies) => currencies.removeUnits || currencies.removeFamilies, {
        message: "A layer's currencies take out coins (removeUnits) or families (removeFamilies)",
      })
      .optional(),
  })
  .strict();

export interface RulesetParty {
  label: string;
  fields: z.infer<typeof rulesetFieldSchema>[];
  pools: z.infer<typeof livePoolSchema>[];
  lists?: z.infer<typeof listSchema>[];
  builder?: RulesetSheetBuilder;
  fromMembers?: Array<{ field: string; count?: true; sum?: string }>;
  advancement?: { fields?: string[]; text?: string };
  summary?: z.infer<typeof gmSchema>["sheetSummary"];
  text?: string;
}
const partySheetSchema: z.ZodType<RulesetParty, z.ZodTypeDef, unknown> = z
  .object({
    label,
    fields: z.array(rulesetFieldSchema).max(160).default([]),
    pools: z.array(livePoolSchema).max(60).default([]),
    /** Shared rows: a crew's upgrades and cohorts, a ship's systems (Capability API 1.163). */
    lists: z.array(listSchema).max(12).optional(),
    /** A guided setup for the shared sheet, saved once for the whole party (Capability API 1.163). */
    builder: sheetBuilderSchema.optional(),
    /** Party fields read off the party's own characters as they stand: how many there are, or what
     *  one number field of theirs adds up to (Totem dots, party size). */
    fromMembers: z
      .array(z.object({ field: sheetId, count: z.literal(true).optional(), sum: sheetId.optional() }).strict())
      .min(1)
      .max(8)
      .optional(),
    advancement: z
      .object({ fields: z.array(sheetId).max(24).optional(), text: promptSafeText(400).optional() })
      .strict()
      .optional(),
    summary: gmSchema.shape.sheetSummary.optional(),
    text: promptSafeText(400).optional(),
  })
  .strict()
  .refine((party) => party.fields.length + party.pools.length > 0, {
    message: "A party sheet needs at least one field or pool",
  });

const rulesetDefinitionBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().max(64).regex(RULESET_ID_PATTERN, "A ruleset id is lowercase letters, digits and single hyphens"),
    version: z.number().int().min(1),
    name: promptSafeText(80),
    edition: promptSafeText(160).optional(),
    license: z
      .object({ spdx: z.string().max(64).optional(), attribution: z.string().max(4000).optional() })
      .strict()
      .optional(),
    coverage: coverageSchema,
    resolution: rulesetResolutionSchema,
    sheet: rulesetSheetSchema,
    /** One shared sheet per game (Capability API 1.144). */
    party: partySheetSchema.optional(),
    /** Party/scene progress clocks (Capability API 1.143). */
    clocks: z
      .object({
        sizes: z
          .array(z.number().int().min(2).max(12))
          .min(1)
          .max(6)
          .refine((sizes) => new Set(sizes).size === sizes.length, "Clock sizes must be unique")
          .default([4, 6, 8]),
        max: z.number().int().min(1).max(12).default(8),
        text: promptSafeText(400).optional(),
      })
      .strict()
      .optional(),
    rests: z.array(restSchema).max(12).default([]),
    gm: gmSchema,
    /** The ruleset's full rules reference for the Game Master, in the cached system prompt. */
    gmReference: promptSafeText(16000).optional(),
    /** Optional, and absent rather than empty when the ruleset ships none, so a file that predates
     *  catalogs still parses to exactly the bytes it did before. */
    catalogs: z.array(catalogSchema).max(12).optional(),
    /** Optional, and absent rather than empty, for the same reason as `catalogs`. */
    items: itemsSchema.optional(),
    /** Optional, and absent rather than empty, for the same reason as `catalogs`. */
    battle: battleSchema.optional(),
    /** Optional, and absent rather than empty, for the same reason as `catalogs`. */
    combat: combatSchema.optional(),
    /** Optional, and absent rather than empty, for the same reason as `catalogs`. */
    layers: z.array(rulesetLayerSchema).max(RULESET_LAYERS_MAX).optional(),
  })
  .strict();

type RulesetDefinitionBase = z.infer<typeof rulesetDefinitionBaseSchema>;

// ── Cross-reference checks: everything a name points at must exist ──

/** Why `equals` is not a value this field or list column could hold, or null when it is. Shared by
 *  `hideWhen` and `battle.skills[].alwaysWhen`: a comparison that can never match is a typo. */
function equalsIssue(
  item: RulesetField | RulesetListColumn,
  equals: string | number | boolean,
  noun: "field" | "column",
  key = "equals",
): string | null {
  if (item.type === "enum") {
    return typeof equals === "string" && item.values.includes(equals)
      ? null
      : `${JSON.stringify(equals)} is not one of the values of "${item.id}"`;
  }
  if (item.type === "number") {
    return typeof equals === "number" ? null : `"${item.id}" is a number ${noun}, so ${key} must be a number`;
  }
  if (item.type === "boolean") {
    return typeof equals === "boolean" ? null : `"${item.id}" is a boolean ${noun}, so ${key} must be true or false`;
  }
  return typeof equals === "string" ? null : `"${item.id}" is a text ${noun}, so ${key} must be a string`;
}

/** The declared names a value reference may point at, gathered once per sheet. */
interface RulesetSheetNames {
  fields: ReadonlyMap<string, RulesetField>;
  abilities: ReadonlySet<string>;
  skills: ReadonlySet<string>;
  saves: ReadonlySet<string>;
  /** Every derived value the sheet declares, whatever a given reader may read. */
  derived: ReadonlySet<string>;
  pools: ReadonlySet<string>;
  tracks: ReadonlyMap<string, RulesetSheetSchema["live"]["tracks"][number]>;
  lists: ReadonlyMap<string, RulesetSheetSchema["lists"][number]>;
  /** What reads the live state, directly or through something else on the sheet. */
  live: RulesetLiveReaders;
  /** The ruleset's item words, which an `itemStat` names; absent without an items block. */
  items?: {
    stats: ReadonlyMap<string, { type: string }>;
    slots: ReadonlySet<string>;
    categories: ReadonlySet<string>;
    tags: ReadonlySet<string>;
  };
}

/** The values a derived value reads, in the one place that knows where each op keeps them. An enum
 *  table reads a field's or a state's VALUE rather than a number, so it has none. */
function derivedRefs(derived: z.infer<typeof rulesetDerivedSchema>): RulesetValueRef[] {
  if (derived.op === "enumTable") return [];
  return derived.op === "stepTable" ? [derived.from] : derived.op === "scale" ? [derived.of] : derived.of;
}

/** The item stats a value counts through `itemStat`, following the derived values it reads: which of
 *  an item's stats a defense, say, already adds up. */
export function rulesetItemStatsRead(definition: RulesetDefinition, ref: RulesetValueRef): string[] {
  const stats = new Set<string>();
  const seen = new Set<string>();
  const walk = (value: RulesetValueRef) => {
    if (value.itemStat?.stat) stats.add(value.itemStat.stat);
    if (value.derived === undefined || seen.has(value.derived)) return;
    seen.add(value.derived);
    const derived = definition.sheet.derived.find((entry) => entry.id === value.derived);
    if (derived) derivedRefs(derived).forEach(walk);
  };
  walk(ref);
  return [...stats];
}

interface RulesetLiveReaders {
  derived: ReadonlySet<string>;
  skills: ReadonlySet<string>;
  saves: ReadonlySet<string>;
}

/** The derived values, skills and saves whose number depends on the live state: a derived value
 *  that reads a live track or pool, follows a live state, or reads one of these; a skill or save
 *  capped by one. Derived
 *  values only read the ones above them, and a cap's own chain reads no skill or save (both refused
 *  at import), so one pass top to bottom finds every one. */
function rulesetLiveReaders(sheet: RulesetSheetSchema): RulesetLiveReaders {
  const derived = new Set<string>();
  const capReadsLive = (entries: ReadonlyArray<{ id: string; cap?: RulesetValueRef }>, id: string) => {
    const cap = entries.find((entry) => entry.id === id)?.cap;
    return !!cap && readsLive(cap);
  };
  function readsLive(ref: RulesetValueRef): boolean {
    return (
      ref.liveTrack !== undefined ||
      ref.livePool !== undefined ||
      ref.itemStat !== undefined ||
      (ref.derived !== undefined && derived.has(ref.derived)) ||
      (ref.skillMod !== undefined && capReadsLive(sheet.skills, ref.skillMod)) ||
      (ref.saveMod !== undefined && capReadsLive(sheet.saves, ref.saveMod))
    );
  }
  for (const entry of sheet.derived) {
    if (derivedRefs(entry).some(readsLive) || (entry.op === "enumTable" && entry.from.liveState !== undefined)) {
      derived.add(entry.id);
    }
  }
  return {
    derived,
    skills: new Set(sheet.skills.filter((skill) => capReadsLive(sheet.skills, skill.id)).map((skill) => skill.id)),
    saves: new Set(sheet.saves.filter((save) => capReadsLive(sheet.saves, save.id)).map((save) => save.id)),
  };
}

/** Whether a value adds up a list, directly or through what it reads: a derived value, a skill or
 *  save's cap, or the proficiency bonus inside a skill's number. Every one of those chains only
 *  reads upward (refused otherwise), so the walk ends; the depth bound is for a file that the rest
 *  of the checks already refuse. */
function refReadsListSum(
  def: Pick<RulesetDefinitionBase, "sheet" | "resolution">,
  ref: RulesetValueRef,
  depth = 0,
): boolean {
  if (depth > 64) return false;
  if (ref.listSum) return true;
  const next = (inner: RulesetValueRef) => refReadsListSum(def, inner, depth + 1);
  if (ref.derived !== undefined) {
    const derived = def.sheet.derived.find((entry) => entry.id === ref.derived);
    return !!derived && derivedRefs(derived).some(next);
  }
  const trained =
    ref.skillMod !== undefined
      ? def.sheet.skills.find((entry) => entry.id === ref.skillMod)
      : ref.saveMod !== undefined
        ? def.sheet.saves.find((entry) => entry.id === ref.saveMod)
        : undefined;
  if (!trained) return false;
  const bonus = def.resolution.proficiency?.bonus;
  return (!!trained.cap && next(trained.cap)) || (!!bonus && next(bonus));
}

/** What a value reads off the sheet, directly or through derived values: its abilities, fields, skills,
 *  saves and the lists it adds up. Conservative: a skill or save modifier reads every ability, its cap
 *  and the proficiency bonus, and a modifier off a field's ability reads that field and every ability. */
function refReadsSheet(
  def: Pick<RulesetDefinitionBase, "sheet" | "resolution">,
  ref: RulesetValueRef,
  into = {
    abilities: new Set<string>(),
    fields: new Set<string>(),
    skills: new Set<string>(),
    saves: new Set<string>(),
    lists: new Set<string>(),
  },
  depth = 0,
): typeof into {
  if (depth > 64) return into;
  const all = () => def.sheet.abilities.forEach((ability) => into.abilities.add(ability.id));
  // A skill or save modifier also reads its cap and the proficiency bonus, as refReadsListSum follows.
  const trainedReads = (trained: { cap?: RulesetValueRef } | undefined) => {
    if (!trained) return;
    if (trained.cap) refReadsSheet(def, trained.cap, into, depth + 1);
    const bonus = def.resolution.proficiency?.bonus;
    if (bonus) refReadsSheet(def, bonus, into, depth + 1);
  };
  if (ref.field !== undefined) into.fields.add(ref.field);
  if (ref.abilityScore !== undefined) into.abilities.add(ref.abilityScore);
  if (ref.abilityMod !== undefined) into.abilities.add(ref.abilityMod);
  if (ref.abilityModFromField !== undefined) {
    into.fields.add(ref.abilityModFromField);
    all();
  }
  if (ref.skillMod !== undefined) {
    into.skills.add(ref.skillMod);
    all();
    trainedReads(def.sheet.skills.find((entry) => entry.id === ref.skillMod));
  }
  if (ref.saveMod !== undefined) {
    into.saves.add(ref.saveMod);
    all();
    trainedReads(def.sheet.saves.find((entry) => entry.id === ref.saveMod));
  }
  if (ref.listSum) into.lists.add(ref.listSum.list);
  if (ref.derived !== undefined) {
    const derived = def.sheet.derived.find((entry) => entry.id === ref.derived);
    // An enum table reads its enum field, which derivedRefs leaves out as no number.
    if (derived?.op === "enumTable" && derived.from.field !== undefined) into.fields.add(derived.from.field);
    if (derived) for (const inner of derivedRefs(derived)) refReadsSheet(def, inner, into, depth + 1);
  }
  return into;
}

/** The abilities a value reads, exactly: a skill or save brings its own ability, its cap and the
 *  proficiency bonus, never every ability (Capability API 1.156). */
function abilityReads(
  def: Pick<RulesetDefinitionBase, "sheet" | "resolution">,
  ref: RulesetValueRef,
  into = new Set<string>(),
  depth = 0,
): Set<string> {
  if (depth > 64) return into;
  if (ref.abilityScore !== undefined) into.add(ref.abilityScore);
  if (ref.abilityMod !== undefined) into.add(ref.abilityMod);
  if (ref.abilityModFromField !== undefined) for (const ability of def.sheet.abilities) into.add(ability.id);
  const entry =
    ref.skillMod !== undefined
      ? def.sheet.skills.find((skill) => skill.id === ref.skillMod)
      : ref.saveMod !== undefined
        ? def.sheet.saves.find((save) => save.id === ref.saveMod)
        : undefined;
  if (entry) {
    if (entry.ability) into.add(entry.ability);
    if (entry.cap) abilityReads(def, entry.cap, into, depth + 1);
    if (def.resolution.proficiency) abilityReads(def, def.resolution.proficiency.bonus, into, depth + 1);
  }
  if (ref.derived !== undefined) {
    const derived = def.sheet.derived.find((each) => each.id === ref.derived);
    if (derived) for (const inner of derivedRefs(derived)) abilityReads(def, inner, into, depth + 1);
  }
  return into;
}

function rulesetSheetNames(
  sheet: RulesetSheetSchema,
  items?: {
    categories: ReadonlyArray<{ id: string }>;
    tags?: ReadonlyArray<{ id: string }>;
    stats?: ReadonlyArray<{ id: string; type: string }>;
    slots?: ReadonlyArray<{ id: string }>;
  },
): RulesetSheetNames {
  return {
    ...(items
      ? {
          items: {
            stats: new Map((items.stats ?? []).map((stat) => [stat.id, stat])),
            slots: new Set((items.slots ?? []).map((slot) => slot.id)),
            categories: new Set(items.categories.map((category) => category.id)),
            tags: new Set((items.tags ?? []).map((tag) => tag.id)),
          },
        }
      : {}),
    fields: new Map(sheet.fields.map((field) => [field.id, field])),
    abilities: new Set(sheet.abilities.map((ability) => ability.id)),
    skills: new Set(sheet.skills.map((skill) => skill.id)),
    saves: new Set(sheet.saves.map((save) => save.id)),
    derived: new Set(sheet.derived.map((derived) => derived.id)),
    pools: new Set(sheet.live.pools.map((pool) => pool.id)),
    tracks: new Map(sheet.live.tracks.map((track) => [track.id, track])),
    lists: new Map(sheet.lists.map((list) => [list.id, list])),
    live: rulesetLiveReaders(sheet),
  };
}

/** Why a value reference cannot be resolved against this sheet, one entry per key that is wrong.
 *  Shared on purpose: the sheet's own derived values, a live pool's maximum and a catalog entry's
 *  scaled column are all held to the same rule, so a reference that is good in one is good in all.
 *  `readable` is the derived values THIS reference may read: while the sheet's own derived list is
 *  checked that is the ones declared above the reader, which makes a cycle unrepresentable; every
 *  reader outside that order may name any declared one. `live` is false for a value worked out
 *  without a live state (a maximum, the proficiency bonus, a catalog's scaling), which then may not
 *  read one, directly or through anything that does. */
function rulesetValueRefIssues(
  ref: RulesetValueRef,
  names: RulesetSheetNames,
  readable: ReadonlySet<string>,
  live = true,
): Array<{ key: (typeof VALUE_REF_KEYS)[number] | "read"; message: string }> {
  const issues: Array<{ key: (typeof VALUE_REF_KEYS)[number] | "read"; message: string }> = [];
  const add = (key: (typeof VALUE_REF_KEYS)[number] | "read", message: string) => issues.push({ key, message });
  const noLive = "This value is worked out without the live state, so it cannot read a live track or pool";

  if (ref.field !== undefined) {
    const field = names.fields.get(ref.field);
    if (!field) add("field", `Unknown field "${ref.field}"`);
    else if (field.type !== "number") add("field", `Field "${ref.field}" is not a number`);
  }
  if (ref.derived !== undefined && !readable.has(ref.derived)) {
    add(
      "derived",
      names.derived.has(ref.derived)
        ? `Derived value "${ref.derived}" must be declared above the value that reads it`
        : `Unknown derived value "${ref.derived}"`,
    );
  }
  for (const key of ["abilityScore", "abilityMod"] as const) {
    const id = ref[key];
    if (id !== undefined && !names.abilities.has(id)) add(key, `Unknown ability "${id}"`);
  }
  if (ref.abilityModFromField !== undefined) {
    const field = names.fields.get(ref.abilityModFromField);
    if (!field) add("abilityModFromField", `Unknown field "${ref.abilityModFromField}"`);
    else if (field.type !== "enum") add("abilityModFromField", "The field must be an enum of ability ids");
  }
  if (ref.skillMod !== undefined && !names.skills.has(ref.skillMod)) {
    add("skillMod", `Unknown skill "${ref.skillMod}"`);
  }
  if (ref.saveMod !== undefined && !names.saves.has(ref.saveMod)) {
    add("saveMod", `Unknown save "${ref.saveMod}"`);
  }
  if (ref.liveTrack !== undefined) {
    const track = names.tracks.get(ref.liveTrack);
    if (!track) add("liveTrack", `Unknown track "${ref.liveTrack}"`);
    else if (!live) add("liveTrack", noLive);
    else if (ref.read === "penalty" && !track.levels && !track.boxes) {
      add("read", `"${ref.liveTrack}" is not a wound track, so it has no penalty to read`);
    }
  }
  if (ref.livePool !== undefined) {
    if (!names.pools.has(ref.livePool)) add("livePool", `Unknown pool "${ref.livePool}"`);
    else if (!live) add("livePool", noLive);
  }
  if (ref.itemStat !== undefined) {
    const { stat: statId, pick, slot, category, tag } = ref.itemStat;
    const items = names.items;
    if (!items) add("itemStat", "This ruleset has no items block, so there are no items to read");
    else {
      const stat = statId === undefined ? undefined : items.stats.get(statId);
      if (statId !== undefined && !stat) add("itemStat", `Unknown item stat "${statId}"`);
      else if (stat && pick !== "count" && stat.type !== "number") {
        add("itemStat", `Item stat "${statId}" is not a number`);
      }
      if (slot !== undefined && !items.slots.has(slot)) add("itemStat", `Unknown slot "${slot}"`);
      if (category !== undefined && !items.categories.has(category)) {
        add("itemStat", `Unknown item category "${category}"`);
      }
      if (tag !== undefined && !items.tags.has(tag)) add("itemStat", `Unknown item tag "${tag}"`);
    }
    if (!live) {
      add("itemStat", "This value is worked out without the live state, so it cannot read the items anyone holds");
    }
  }
  if (ref.listSum !== undefined) {
    const { list: listId, column: columnId, onlyWhen, where } = ref.listSum;
    const list = names.lists.get(listId);
    const column = columnId === undefined ? undefined : list?.columns.find((entry) => entry.id === columnId);
    const marker = onlyWhen === undefined ? undefined : list?.columns.find((entry) => entry.id === onlyWhen);
    const keyed = where === undefined ? undefined : list?.columns.find((entry) => entry.id === where.column);
    if ((columnId === undefined) === (ref.listSum.count === undefined))
      add("listSum", "A list sum adds up a column or counts rows, one of the two");
    else if (!list) add("listSum", `Unknown list "${listId}"`);
    else if (columnId !== undefined && !column) add("listSum", `"${listId}" has no column "${columnId}"`);
    else if (column && column.type !== "number") add("listSum", `Column "${columnId}" is not a number`);
    else if (onlyWhen !== undefined && !marker) add("listSum", `"${listId}" has no column "${onlyWhen}"`);
    else if (marker && marker.type !== "boolean") add("listSum", `Column "${onlyWhen}" is not a boolean`);
    else if (where && !keyed) add("listSum", `"${listId}" has no column "${where.column}"`);
    else if (
      where &&
      keyed &&
      (keyed.type === "number"
        ? typeof where.equals !== "number"
        : keyed.type === "boolean"
          ? typeof where.equals !== "boolean"
          : typeof where.equals !== "string")
    )
      add("listSum", `Column "${where.column}" never holds ${JSON.stringify(where.equals)}`);
  }
  if (!live) {
    if (ref.derived !== undefined && names.live.derived.has(ref.derived)) {
      add("derived", `Derived value "${ref.derived}" reads the live state, which this value cannot`);
    }
    if (ref.skillMod !== undefined && names.live.skills.has(ref.skillMod)) {
      add("skillMod", `Skill "${ref.skillMod}" is capped by the live state, which this value cannot read`);
    }
    if (ref.saveMod !== undefined && names.live.saves.has(ref.saveMod)) {
      add("saveMod", `Save "${ref.saveMod}" is capped by the live state, which this value cannot read`);
    }
  }
  return issues;
}

/** `layersApplied` is true for an EFFECTIVE definition, whose active layers have already been
 *  folded into it. Only one check changes: a layer that narrowed an enum field now names values
 *  the field no longer lists, which is the whole point, so re-running that one would refuse the
 *  Engine's own result. Everything else holds, because applying a layer does not change what the
 *  layer declared. */
function refineRulesetDefinition(def: RulesetDefinitionBase, ctx: z.RefinementCtx, layersApplied = false): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  if ((RESERVED_RULESET_IDS as readonly string[]).includes(def.id)) {
    issue(["id"], `"${def.id}" is an Engine-owned ruleset id`);
  }

  const { sheet, resolution } = def;
  // Checks that roll their own way (1.140): each override is read as the resolution it makes, and
  // that resolution is held to every rule below by checking the file again with it in place.
  resolution.overrides?.forEach((override, index) => {
    const path = ["resolution", "overrides", index];
    const known = {
      skills: new Set(sheet.skills.map((entry) => entry.id)),
      saves: new Set(sheet.saves.map((entry) => entry.id)),
      abilities: new Set(sheet.abilities.map((entry) => entry.id)),
    };
    if (!override.skills && !override.saves && !override.abilities) {
      issue(path, "An override names the skills, saves or abilities it changes");
    }
    for (const key of ["skills", "saves", "abilities"] as const) {
      override[key]?.forEach((id, at) => {
        if (!known[key].has(id)) issue([...path, key, at], `Unknown ${key.slice(0, -1)} "${id}"`);
        const earlier = resolution.overrides!.slice(0, index).find((other) => other[key]?.includes(id));
        if (earlier && !override.when && !earlier.when) {
          issue([...path, key, at], `"${id}" is already in the override "${earlier.id}"`);
        }
      });
    }
    if (resolution.overrides!.slice(0, index).some((other) => other.id === override.id)) {
      issue([...path, "id"], `Duplicate override id "${override.id}"`);
    }
    const locked = Object.keys(override.set).filter(
      (key) =>
        (RULESET_OVERRIDE_LOCKED_KEYS as readonly string[]).includes(key) ||
        (resolution.kind === "symbol-pool" && key === "dice"),
    );
    for (const key of locked) issue([...path, "set", key], `An override does not change ${key}`);
    if (locked.length > 0) return;
    const made = rulesetOverriddenResolution(resolution, override.set);
    if (!made.ok) {
      for (const found of made.issues) issue([...path, "set", ...found.path], found.message);
      return;
    }
    const nested: z.ZodIssue[] = [];
    const nestedCtx = {
      addIssue: (found: z.IssueData) => nested.push({ ...found, path: found.path ?? [] } as z.ZodIssue),
      path: [],
    } as unknown as z.RefinementCtx;
    refineRulesetDefinition({ ...def, resolution: made.resolution }, nestedCtx, layersApplied);
    for (const found of nested) {
      if (found.path[0] === "resolution") issue([...path, "set", ...found.path.slice(1)], found.message);
    }
  });
  const unique = (items: { id: string }[], path: (string | number)[], what: string): Set<string> => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id)) issue([...path, index, "id"], `Duplicate ${what} id "${item.id}"`);
      seen.add(item.id);
    });
    return seen;
  };

  const sections = unique(sheet.sections, ["sheet", "sections"], "section");
  const abilities = unique(sheet.abilities, ["sheet", "abilities"], "ability");
  const skills = unique(sheet.skills, ["sheet", "skills"], "skill");
  const saves = unique(sheet.saves, ["sheet", "saves"], "save");
  const fields = unique(sheet.fields, ["sheet", "fields"], "field");
  for (const [index, id] of (sheet.advancement?.fields ?? []).entries()) {
    const field = sheet.fields.find((entry) => entry.id === id);
    if (!field || !["number", "text", "longtext"].includes(field.type)) {
      issue(
        ["sheet", "advancement", "fields", index],
        field ? `Advancement field "${id}" must be number or text` : `Unknown advancement field "${id}"`,
      );
    }
  }
  const derivedIds = unique(sheet.derived, ["sheet", "derived"], "derived value");
  const lists = unique(sheet.lists, ["sheet", "lists"], "list");
  const pools = unique(sheet.live.pools, ["sheet", "live", "pools"], "pool");
  const tracks = unique(sheet.live.tracks, ["sheet", "live", "tracks"], "track");
  const liveText = unique(sheet.live.text, ["sheet", "live", "text"], "live text");
  const conditions = unique(sheet.live.conditions, ["sheet", "live", "conditions"], "condition");
  unique(sheet.live.states, ["sheet", "live", "states"], "state");
  const stateById = new Map(sheet.live.states.map((state) => [state.id, state]));
  const tiers = unique(resolution.proficiencyTiers, ["resolution", "proficiencyTiers"], "proficiency tier");
  unique(def.rests, ["rests"], "rest");
  const poolGroups = new Set(sheet.live.pools.map((pool) => pool.group).filter((group): group is string => !!group));

  // Rows that are checks of their own (1.161) read their own columns.
  sheet.lists.forEach((list, index) => {
    if (!list.checks) return;
    unique(list.checks, ["sheet", "lists", index, "checks"], "row check");
    list.checks.forEach((check, checkIndex) => {
      const at = ["sheet", "lists", index, "checks", checkIndex];
      const type = (id: string) => list.columns.find((each) => each.id === id)?.type;
      if (type(check.name) !== "text" && type(check.name) !== "enum")
        issue([...at, "name"], `No text column "${check.name}"`);
      if (type(check.rating) !== "number") issue([...at, "rating"], `No number column "${check.rating}"`);
      if (check.ability !== undefined && !sheet.abilities.some((ability) => ability.id === check.ability))
        issue([...at, "ability"], `Unknown ability "${check.ability}"`);
      if (list.checks!.length > 1 && !check.label)
        issue([...at, "label"], "Two checks on one list are told apart by their labels");
      if (
        check.stance !== undefined &&
        !(resolution.kind === "dice-pool" && resolution.stances?.some((stance) => stance.id === check.stance))
      )
        issue([...at, "stance"], `No resolution stance "${check.stance}"`);
    });
  });

  // Rows applied to a roll by name (1.156) read their own columns.
  sheet.lists.forEach((list, index) => {
    const contextual = list.contextual;
    if (!contextual) return;
    const at = ["sheet", "lists", index, "contextual"];
    const column = (key: "name" | "skill" | "bonus" | "dice", types: readonly string[]) => {
      const id = contextual[key];
      if (id === undefined) return;
      const found = list.columns.find((each) => each.id === id);
      if (!found) issue([...at, key], `Unknown column "${id}"`);
      else if (!types.includes(found.type)) issue([...at, key], `"${id}" is not a ${types.join(" or ")} column`);
    };
    column("name", ["text", "enum"]);
    column("skill", ["text", "enum"]);
    column("bonus", ["number"]);
    column("dice", ["dice"]);
    contextual.cost?.forEach((cost, costIndex) => {
      if ("track" in cost) {
        if (!sheet.live.tracks.some((track) => track.id === cost.track && !track.kinds && !track.boxes))
          issue([...at, "cost", costIndex, "track"], `No live track "${cost.track}" to mark`);
      } else if (!sheet.live.pools.some((pool) => pool.id === cost.pool || pool.group === cost.pool))
        issue([...at, "cost", costIndex, "pool"], `Unknown pool or pool group "${cost.pool}"`);
    });
    if (contextual.abilities && contextual.skill === undefined)
      issue([...at, "abilities"], 'An ability is named in the "skill" column, so it needs one');
    if (contextual.check)
      for (const found of contextualCheckIssues(resolution, contextual.check))
        issue([...at, "check", ...found.path], found.message);
  });

  // Sheet migrations (1.77). Each hop once and below this version. What a step writes to is on this
  // sheet, and what it reads from is not: an id moved away is never used again, which is what makes
  // every step safe to run again. A rename is followed through the renames after it to where it ends.
  if (sheet.migrations) {
    const hopPath = (index: number) => ["sheet", "migrations", index];
    const seenHops = new Set<number>();
    sheet.migrations.forEach((hop, index) => {
      if (hop.from >= sheet.version)
        issue([...hopPath(index), "from"], `A migration moves on from a version below ${sheet.version}`);
      if (seenHops.has(hop.from)) issue([...hopPath(index), "from"], `Duplicate migration from version ${hop.from}`);
      seenHops.add(hop.from);
    });
    const current = { ability: abilities, skill: skills, save: saves, field: fields, pool: pools, track: tracks };
    const ordered = sheet.migrations
      .map((hop, index) => ({ hop, index }))
      .sort((a, b) => a.hop.from - b.hop.from)
      .flatMap(({ hop, index }) =>
        hop.steps.map((step, stepIndex) => ({ step, path: [...hopPath(index), "steps", stepIndex] })),
      );
    // Where a field id ends up through the field renames after a step: a value routed to one, or
    // renamed into one, that a later hop renames again is still on the sheet.
    const fieldEnd = (id: string, position: number) => {
      let end = id;
      for (const later of ordered.slice(position + 1)) {
        if ("rename" in later.step && later.step.rename === "field" && later.step.from === end) end = later.step.to;
      }
      return end;
    };
    const fieldById = new Map(sheet.fields.map((field) => [field.id, field]));
    const renamedFields = new Set(
      ordered.flatMap(({ step }) => ("rename" in step && step.rename === "field" ? [step.from] : [])),
    );
    const isWound = (id: string) => {
      const track = sheet.live.tracks.find((entry) => entry.id === id);
      return !!track && (!!track.levels || !!track.boxes) && !!track.kinds;
    };
    ordered.forEach(({ step, path }, position) => {
      if ("rename" in step) {
        if (current[step.rename].has(step.from))
          issue([...path, "from"], `"${step.from}" is still a ${step.rename} of this sheet`);
        let end = step.to;
        for (const later of ordered.slice(position + 1)) {
          if ("rename" in later.step && later.step.rename === step.rename && later.step.from === end)
            end = later.step.to;
        }
        // A field renamed and then routed on by a later step has gone where the route sends it.
        const routedOn =
          step.rename === "field" &&
          ordered.slice(position + 1).some((later) => "route" in later.step && later.step.route === end);
        if (!current[step.rename].has(end) && !routedOn)
          issue([...path, "to"], `"${end}" is not a ${step.rename} of this sheet`);
      } else if ("route" in step) {
        // Read off the stored build, so `by` is a field the sheet has or one an earlier layout had.
        if (!fields.has(step.by) && !renamedFields.has(step.by)) issue([...path, "by"], `Unknown field "${step.by}"`);
        const targets: Array<[string, (string | number)[]]> = [
          ...step.cases.map((entry, caseIndex): [string, (string | number)[]] => [
            entry.to,
            [...path, "cases", caseIndex, "to"],
          ]),
          [step.else, [...path, "else"]],
        ];
        for (const [id, where] of targets) {
          const end = fieldEnd(id, position);
          const field = fieldById.get(end);
          if (!field) {
            issue(where, `Unknown field "${end}"`);
            continue;
          }
          // The routed value lands in one target and every other keeps its default, so a target
          // that is not empty by default would read as a level, a class or a name nobody gave it.
          const empty = field.default === undefined || field.default === 0 || field.default === "";
          if (!["number", "text", "longtext"].includes(field.type) || !empty) {
            issue(where, `"${end}" is a number or text field with no default, or a default of 0 or empty`);
          }
        }
      } else {
        const kind = step.routeLive;
        if (current[kind].has(step.from)) issue([...path, "from"], `"${step.from}" is still a ${kind} of this sheet`);
        const seen = new Set<string>();
        step.cases.forEach((id, caseIndex) => {
          if (seen.has(id)) issue([...path, "cases", caseIndex], `Duplicate case "${id}"`);
          seen.add(id);
          if (!current[kind].has(id)) issue([...path, "cases", caseIndex], `Unknown ${kind} "${id}"`);
        });
        if (!current[kind].has(step.else)) issue([...path, "else"], `Unknown ${kind} "${step.else}"`);
        // A wound track keeps marks and a plain one a number: the targets are all of one shape.
        if (kind === "track" && new Set([...step.cases, step.else].map(isWound)).size > 1) {
          issue([...path, "cases"], "The tracks a value goes to are all wound tracks or all plain tracks");
        }
      }
    });
  }

  // A skill and a save may not share an id: a check request names either, and the sheet command
  // addresses both, so one name must mean one thing.
  for (const [index, save] of sheet.saves.entries()) {
    if (skills.has(save.id)) issue(["sheet", "saves", index, "id"], `"${save.id}" is already a skill id`);
  }
  for (const [index, pool] of sheet.live.pools.entries()) {
    if (tracks.has(pool.id)) issue(["sheet", "live", "pools", index, "id"], `"${pool.id}" is already a track id`);
  }

  // Wound tracks. `kinds` says what a mark may be, so it needs `levels` or `boxes` for a mark to sit
  // on, and the severities have to be distinct or "the lowest-severity mark" would name two boxes.
  const woundTracks = new Set<string>();
  sheet.live.tracks.forEach((track, index) => {
    const path = ["sheet", "live", "tracks", index];
    const woundOnly = (["fill", "onFull", "extra"] as const).filter((key) => track[key] !== undefined);
    if (!track.levels && !track.boxes) {
      if (track.kinds) issue([...path, "kinds"], "kinds needs levels or boxes beside it: there is nothing to mark");
      woundOnly.forEach((key) => issue([...path, key], `${key} is for a wound track, which has levels or boxes`));
      return;
    }
    woundTracks.add(track.id);
    if (track.levels && track.boxes) issue([...path, "boxes"], "A wound track has levels or boxes, not both");
    if (!track.kinds) {
      issue(
        [...path, track.levels ? "levels" : "boxes"],
        `A track with ${track.levels ? "levels" : "boxes"} needs kinds beside it: a mark has to be of something`,
      );
    }
    // An indexed track puts a mark where it is told and never moves the others, so there is no
    // lightest mark at the bottom of the track to upgrade: a full one can only refuse.
    if (track.fill === "indexed" && track.onFull !== "refuse") {
      issue([...path, "onFull"], 'An indexed track refuses a mark it has no box for, so its onFull is "refuse"');
    }
    if (track.min !== 0) issue([...path, "min"], "A wound track starts unmarked, so its min is 0");
    if (track.boxes) {
      // A box track is as long as its own max, which may be a value the sheet works out.
      if (track.extra) issue([...path, "extra"], "A box track's length is its max; extra levels are for named levels");
      if (typeof track.max === "number" && (track.max < 0 || track.max > RULESET_WOUND_LEVELS_MAX)) {
        issue([...path, "max"], `A box track has from 0 to ${RULESET_WOUND_LEVELS_MAX} boxes`);
      }
    } else if (track.max !== track.levels!.length) {
      // A wound track's length is its levels, so the number beside them cannot say anything else.
      issue([...path, "max"], `A wound track holds one mark per level, so its max is ${track.levels!.length}`);
    }
    if (track.extra) {
      const list = sheet.lists.find((entry) => entry.id === track.extra!.list);
      const numberColumn = (id: string, key: "countColumn" | "penaltyColumn") => {
        const column = list?.columns.find((entry) => entry.id === id);
        if (!column) issue([...path, "extra", key], `"${track.extra!.list}" has no column "${id}"`);
        else if (column.type !== "number") issue([...path, "extra", key], `Column "${id}" is not a number`);
      };
      if (!list) issue([...path, "extra", "list"], `Unknown list "${track.extra.list}"`);
      else {
        numberColumn(track.extra.countColumn, "countColumn");
        numberColumn(track.extra.penaltyColumn, "penaltyColumn");
      }
    }
    // Rolls read its penalty and fights read it as health whatever the sheet shows, so a wound track
    // cannot be taken off the sheet by a field.
    if (track.hideWhen)
      issue([...path, "hideWhen"], "A wound track is read by rolls and fights, so it cannot be hidden");
    if (track.default !== undefined && track.default !== 0) {
      issue([...path, "default"], "A wound track starts unmarked, so it declares no default");
    }
    // Best first, worst last, which is the order the boxes are marked in and the order that makes
    // "the penalty on the lowest marked level" the worst one in force. A ladder that gets better as
    // it fills would read backwards on the sheet and surprise every rule that reads it.
    track.levels?.forEach((level, levelIndex) => {
      const before = track.levels?.[levelIndex - 1];
      if (before && level.penalty > before.penalty) {
        issue(
          [...path, "levels", levelIndex, "penalty"],
          "A wound track's levels run best first, so a level is never kinder than the one above it",
        );
      }
    });
    unique(track.kinds ?? [], [...path, "kinds"], "wound kind");
    const severities = new Set<number>();
    track.kinds?.forEach((kind, kindIndex) => {
      if (severities.has(kind.severity)) {
        issue([...path, "kinds", kindIndex, "severity"], `Duplicate severity ${kind.severity}`);
      }
      severities.add(kind.severity);
    });
  });

  // What a check may buy. Successes and dice are pool words: a summed roll has no successes to add
  // and no pool to add dice to, so a kind that cannot honour the rule is told here rather than
  // silently ignoring it in play.
  resolution.spend?.forEach((spend, index) => {
    const path = ["resolution", "spend", index];
    if (resolution.kind === "dice-highest" || resolution.kind === "symbol-pool") {
      // Keep-the-highest dice (1.138) count no successes and throw nothing again: only dice are bought.
      if (spend.successes || spend.reroll) issue(path, `A ${resolution.kind} ruleset buys only dice`);
    } else if (resolution.kind !== "dice-pool") {
      issue(path, `A ${resolution.kind} ruleset has no successes or pool dice to buy`);
    }
    if (!pools.has(spend.pool)) {
      issue([...path, "pool"], `Unknown live pool "${spend.pool}"`);
    } else if (sheet.live.pools.find((pool) => pool.id === spend.pool)?.start === "empty") {
      // A pool that counts UP has nothing in it to spend at the start of play, so buying from it
      // would be free for exactly as long as the character is unstressed.
      issue([...path, "pool"], `"${spend.pool}" starts empty, so there is nothing in it to spend`);
    }
  });
  if (resolution.spend && new Set(resolution.spend.map((spend) => spend.pool)).size !== resolution.spend.length) {
    issue(["resolution", "spend"], "Two spends on one pool: a check could not say which it meant");
  }

  // The track whose penalty rides on every roll. A plain track has no penalty to read, so naming
  // one is an author saying something the resolver could never honour.
  if (resolution.penaltyFrom !== undefined) {
    const path = ["resolution", "penaltyFrom"];
    if (!tracks.has(resolution.penaltyFrom)) issue(path, `Unknown track "${resolution.penaltyFrom}"`);
    else if (!woundTracks.has(resolution.penaltyFrom)) {
      issue(path, `"${resolution.penaltyFrom}" has no levels or boxes, so it carries no penalty to apply`);
    }
  }

  sheet.abilities.forEach((ability, index) => {
    if (ability.min > ability.max) issue(["sheet", "abilities", index, "min"], "min is above max");
    if (ability.default < ability.min || ability.default > ability.max) {
      issue(["sheet", "abilities", index, "default"], "default is outside min..max");
    }
  });
  const checkAbility = (list: "skills" | "saves") =>
    sheet[list].forEach((entry, index) => {
      if (entry.ability && !abilities.has(entry.ability)) {
        issue(["sheet", list, index, "ability"], `Unknown ability "${entry.ability}"`);
      }
    });
  checkAbility("skills");
  checkAbility("saves");
  for (const key of ["skillTiers", "saveTiers"] as const) {
    sheet[key]?.forEach((tier, index) => {
      if (!tiers.has(tier)) issue(["sheet", key, index], `Unknown proficiency tier "${tier}"`);
    });
  }
  if (sheet.bonusRange.min > sheet.bonusRange.max) issue(["sheet", "bonusRange", "min"], "min is above max");

  const fieldById = new Map(sheet.fields.map((field) => [field.id, field]));
  const checkTyped = (
    item:
      | z.infer<typeof rulesetFieldSchema>
      | z.infer<typeof rulesetListColumnSchema>
      | z.infer<typeof rulesetItemStatSchema>,
    path: (string | number)[],
  ) => {
    if (item.type === "number") {
      if (item.min > item.max) issue([...path, "min"], "min is above max");
      if (item.default !== undefined && (item.default < item.min || item.default > item.max)) {
        issue([...path, "default"], "default is outside min..max");
      }
    }
    if (item.type === "enum") {
      if (new Set(item.values).size !== item.values.length) issue([...path, "values"], "Duplicate enum value");
      if (item.default !== undefined && !item.values.includes(item.default)) {
        issue([...path, "default"], `default "${item.default}" is not one of the values`);
      }
      for (const key of Object.keys(item.valueLabels ?? {})) {
        if (!item.values.includes(key)) issue([...path, "valueLabels", key], `"${key}" is not one of the values`);
      }
    }
    if ((item.type === "text" || item.type === "longtext") && item.default && item.default.length > item.maxLength) {
      issue([...path, "default"], "default is longer than maxLength");
    }
  };
  // Every section an item names must be declared, so it always has a label to show.
  const checkSection = (section: string | undefined, path: (string | number)[]) => {
    if (section && !sections.has(section)) issue([...path, "section"], `Unknown section "${section}"`);
  };
  const checkHideWhen = (hideWhen: RulesetHideWhen | undefined, path: (string | number)[], fieldsById = fieldById) => {
    if (!hideWhen) return;
    const field = fieldsById.get(hideWhen.field);
    if (!field) return issue([...path, "hideWhen", "field"], `Unknown field "${hideWhen.field}"`);
    // Every value compared against must be one the field can actually hold, or the rule could never
    // match (or, for notEquals, could never fail to): checked one listed value at a time. For the two
    // comparisons 1.39 added that includes a number's range and a text's length. `equals` keeps its
    // old reading, so a file that loaded before still loads: there, an impossible value only ever
    // fails to hide.
    const holdable = (value: string | number | boolean, key: string): string | null => {
      const typed = equalsIssue(field, value, "field", key);
      if (typed || key === "equals") return typed;
      if (field.type === "number" && typeof value === "number" && (value < field.min || value > field.max)) {
        return `${value} is outside ${field.min}..${field.max}, the range of "${field.id}"`;
      }
      if ((field.type === "text" || field.type === "longtext") && typeof value === "string") {
        if (value.length > field.maxLength) return `"${field.id}" holds at most ${field.maxLength} characters`;
      }
      return null;
    };
    if (hideWhen.in) {
      hideWhen.in.forEach((value, index) => {
        const message = holdable(value, "in");
        if (message) issue([...path, "hideWhen", "in", index], message);
      });
      return;
    }
    const key = hideWhen.notEquals !== undefined ? "notEquals" : "equals";
    const value = hideWhen.notEquals ?? hideWhen.equals;
    const message = value === undefined ? null : holdable(value, key);
    if (message) issue([...path, "hideWhen", key], message);
  };
  // Abilities, skills and saves sit in sections too, and a skill, save or section may say what a check
  // does untrained. One step harder moves a pool's per-die target, so it needs a pool whose target
  // can move: anywhere else it could never change a roll.
  const harderIssue =
    resolution.kind !== "dice-pool"
      ? `A ${resolution.kind} ruleset has no per-die target, so "harder" cannot change a roll`
      : resolution.target.min >= resolution.target.max
        ? 'This ruleset\'s per-die target cannot move, so "harder" cannot change a roll'
        : null;
  sheet.abilities.forEach((ability, index) => checkSection(ability.section, ["sheet", "abilities", index]));
  for (const key of ["skills", "saves"] as const) {
    sheet[key].forEach((entry, index) => {
      checkSection(entry.section, ["sheet", key, index]);
      if (entry.untrained === "harder" && harderIssue) issue(["sheet", key, index, "untrained"], harderIssue);
    });
  }
  sheet.sections.forEach((section, index) => {
    if (section.untrained === "harder" && harderIssue) issue(["sheet", "sections", index, "untrained"], harderIssue);
  });

  if (def.party) {
    const party = def.party;
    const partyFields = new Map(party.fields.map((field) => [field.id, field]));
    const ids = new Set<string>();
    for (const key of ["fields", "pools"] as const)
      party[key].forEach((entry, index) => {
        if (ids.has(entry.id)) issue(["party", key, index, "id"], `Duplicate party id "${entry.id}"`);
        ids.add(entry.id);
      });
    party.fields.forEach((field, index) => {
      const path = ["party", "fields", index];
      checkTyped(field, path);
      if (field.section) issue([...path, "section"], "Party sheets have no sections");
      checkHideWhen(field.hideWhen, path, partyFields);
    });
    party.pools.forEach((pool, index) => {
      const path = ["party", "pools", index];
      if (
        pool.max.const === undefined &&
        (pool.max.field === undefined || partyFields.get(pool.max.field)?.type !== "number")
      )
        issue([...path, "max"], "A party pool maximum reads a constant or a numeric party field");
      checkHideWhen(pool.hideWhen, path, partyFields);
    });
    for (const [index, id] of (party.advancement?.fields ?? []).entries()) {
      if (!["number", "text", "longtext"].includes(partyFields.get(id)?.type ?? ""))
        issue(["party", "advancement", "fields", index], `Unknown or non-advanceable party field "${id}"`);
    }
    if (new Set(party.advancement?.fields).size !== (party.advancement?.fields?.length ?? 0))
      issue(["party", "advancement", "fields"], "Duplicate advancement field");
    party.summary?.fields.forEach((id, index) => {
      if (!partyFields.has(id)) issue(["party", "summary", "fields", index], `Unknown party field "${id}"`);
    });
    if (party.summary?.derived.length) issue(["party", "summary"], "Party sheets have no derived values");
    party.summary?.lists.forEach((entry, index) => {
      if (!party.lists?.some((list) => list.id === entry.list))
        issue(["party", "summary", "lists", index], `Unknown party list "${entry.list}"`);
    });
    party.lists?.forEach((list, index) => {
      if (ids.has(list.id)) issue(["party", "lists", index, "id"], `Duplicate party id "${list.id}"`);
      ids.add(list.id);
    });
    party.fromMembers?.forEach((from, index) => {
      const path = ["party", "fromMembers", index];
      if (partyFields.get(from.field)?.type !== "number")
        issue([...path, "field"], `No number party field "${from.field}"`);
      if ((from.count === undefined) === (from.sum === undefined))
        issue(path, "A party field is filled with count or sum, not both");
      if (from.sum !== undefined && sheet.fields.find((field) => field.id === from.sum)?.type !== "number")
        issue([...path, "sum"], `No number field "${from.sum}" on a character's sheet`);
    });
    // The shared setup (1.163) is held to every rule a character's builder is, on the party's own sheet.
    if (party.builder || party.lists) {
      let partyDefinition: RulesetDefinition | null = null;
      try {
        partyDefinition = rulesetPartyDefinition(def as RulesetDefinition);
      } catch {
        issue(["party"], "The party sheet does not make a sheet of its own");
      }
      if (partyDefinition) {
        const checked = (layersApplied ? rulesetEffectiveDefinitionSchema : rulesetDefinitionSchema).safeParse(
          partyDefinition,
        );
        // Only what the party's own sheet and the catalogs its steps read are checked here: the
        // copy keeps the character rules (resolution, items, combat), which name the character
        // sheet and are checked against it already.
        if (!checked.success)
          for (const found of checked.error.issues
            .filter((found) => found.path[0] === "sheet" || found.path[0] === "catalogs")
            .slice(0, 20)) {
            const [head, ...rest] = found.path;
            const path = head === "sheet" ? ["party", ...rest] : ["party", ...found.path];
            ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: found.message });
          }
      }
    }
  }

  sheet.fields.forEach((field, index) => {
    const path = ["sheet", "fields", index];
    checkTyped(field, path);
    checkSection(field.section, path);
    checkHideWhen(field.hideWhen, path);
  });

  // A value reference may read a derived value only when it is declared ABOVE the reader, which
  // makes a cycle unrepresentable and lets evaluation run once, top to bottom.
  const names: RulesetSheetNames = {
    ...rulesetSheetNames(sheet, def.items),
    fields: fieldById,
    abilities,
    skills,
    saves,
    derived: derivedIds,
  };
  const checkRef = (
    ref: RulesetValueRef,
    path: (string | number)[],
    derivedAbove: ReadonlySet<string>,
    live = true,
  ) => {
    for (const entry of rulesetValueRefIssues(ref, names, derivedAbove, live)) {
      issue([...path, entry.key], entry.message);
    }
  };
  const refsOf = derivedRefs;
  // What turns an override on reads the roller's sheet like any other value (1.140).
  resolution.overrides?.forEach((override, index) => {
    if (override.when) checkRef(override.when, ["resolution", "overrides", index, "when"], derivedIds);
  });

  const derivedAbove = new Set<string>();
  sheet.derived.forEach((derived, index) => {
    const path = ["sheet", "derived", index];
    if (fields.has(derived.id)) issue([...path, "id"], `"${derived.id}" is already a field id`);
    refsOf(derived).forEach((ref, refIndex) =>
      checkRef(
        ref,
        derived.op === "stepTable"
          ? [...path, "from"]
          : derived.op === "scale"
            ? [...path, "of"]
            : [...path, "of", refIndex],
        derivedAbove,
      ),
    );
    if (derived.op === "enumTable") {
      // What it is keyed on, and a number only for values that one can hold, so no row of the table
      // is one no sheet could ever read. A layered definition is not held to that: a layer may take a
      // value out of the field, and the base file already had its table checked against all of them.
      const { field: fieldId, liveState } = derived.from;
      const field = fieldId === undefined ? undefined : fieldById.get(fieldId);
      const state = liveState === undefined ? undefined : stateById.get(liveState);
      let values: readonly string[] | undefined;
      if (fieldId !== undefined) {
        if (!field) issue([...path, "from", "field"], `Unknown field "${fieldId}"`);
        else if (field.type !== "enum") issue([...path, "from", "field"], `Field "${fieldId}" is not an enum`);
        else if (!layersApplied) values = field.values;
      } else if (!state) issue([...path, "from", "liveState"], `Unknown state "${liveState}"`);
      else values = state.values;
      if (values) {
        for (const key of Object.keys(derived.table)) {
          if (!values.includes(key)) {
            issue([...path, "table", key], `"${key}" is not one of the values of "${fieldId ?? liveState}"`);
          }
        }
      }
    }
    checkSection(derived.section, path);
    checkHideWhen(derived.hideWhen, path);
    derivedAbove.add(derived.id);
  });

  // The proficiency bonus feeds every skill and save modifier, so the value it reads, and every
  // derived value above that one, cannot itself read a skill or save modifier.
  if (resolution.proficiency) {
    checkRef(resolution.proficiency.bonus, ["resolution", "proficiency", "bonus"], derivedIds, false);
    const bonus = resolution.proficiency.bonus;
    if (bonus.skillMod !== undefined || bonus.saveMod !== undefined) {
      issue(["resolution", "proficiency", "bonus"], "The proficiency bonus cannot read a skill or save modifier");
    }
    if (bonus.derived !== undefined) {
      const end = sheet.derived.findIndex((derived) => derived.id === bonus.derived);
      sheet.derived.slice(0, end + 1).forEach((derived, index) => {
        if (refsOf(derived).some((ref) => ref.skillMod !== undefined || ref.saveMod !== undefined)) {
          issue(
            ["sheet", "derived", index],
            `"${derived.id}" feeds the proficiency bonus and cannot read a skill or save modifier`,
          );
        }
      });
    }
  } else {
    resolution.proficiencyTiers.forEach((tier, index) => {
      if (tier.multiplier !== 0) {
        issue(
          ["resolution", "proficiencyTiers", index, "multiplier"],
          "A multiplier needs resolution.proficiency.bonus to multiply; use flat for a fixed bonus",
        );
      }
    });
  }
  /** A difficulty ladder, checked against the kind that has to read it. The base ruleset's own
   *  ladder and every ladder a layer swaps in go through this, so the file can never hold a rung
   *  the resolver could not answer. */
  const checkDifficultyLadder = (ladder: readonly RulesetDifficultyLadderStep[], path: (string | number)[]): void => {
    if (resolution.kind === "dice-sum") {
      ladder.forEach((step, index) => {
        if (!("dc" in step)) issue([...path, index], 'This ruleset sums dice, so a ladder step names "dc"');
        else if ("divide" in step) issue([...path, index, "divide"], "Only a roll-against ladder divides the target");
      });
      return;
    }
    if (resolution.kind === "symbol-pool") {
      ladder.forEach((step, index) => {
        if (!("dc" in step)) issue([...path, index], 'A symbol pool ladder names "dc" difficulty dice');
        else if ("divide" in step) issue([...path, index, "divide"], "Only a roll-against ladder divides the target");
        else if (step.dc < 0 || step.dc > resolution.difficulty.max)
          issue([...path, index, "dc"], `Difficulty dice are from 0 to ${resolution.difficulty.max}`);
      });
      return;
    }
    // A roll-against ladder's `dc` moves the target, and `divide` divides the sheet's number (1.139).
    if (resolution.kind === "roll-against") {
      ladder.forEach((step, index) => {
        if (!("dc" in step))
          issue([...path, index], 'This ruleset rolls against the sheet, so a ladder step names "dc"');
      });
      return;
    }
    // A highest-die ladder's `dc` is what the kept dice must reach, so it is a face (or the sum of
    // the kept faces) the dice can show.
    if (resolution.kind === "dice-highest") {
      const most = resolution.keep * resolution.die.sides;
      ladder.forEach((step, index) => {
        if (!("dc" in step)) issue([...path, index], 'This ruleset reads the highest die, so a ladder step names "dc"');
        else if ("divide" in step) issue([...path, index, "divide"], "Only a roll-against ladder divides the target");
        else if (step.dc < 1 || step.dc > most) issue([...path, index, "dc"], `The kept dice show 1 to ${most}`);
      });
      return;
    }
    const { target } = resolution;
    const reachable = rulesetPoolMaxSuccesses(resolution);
    const adjustable = target.min < target.max;
    ladder.forEach((step, index) => {
      if (!("successes" in step)) {
        issue([...path, index], 'This ruleset throws a pool, so a ladder step names "successes"');
        return;
      }
      if (step.successes > reachable) {
        issue([...path, index, "successes"], `The largest pool can count ${reachable} at most`);
      }
      if (step.target === undefined) return;
      const at = [...path, index, "target"];
      if (!adjustable) issue(at, "A step names a target only where target.min is below target.max");
      else if (step.target < target.min || step.target > target.max) {
        issue(at, `A step's target is inside ${target.min} to ${target.max}`);
      }
    });
  };

  // Outcome bands (1.135). A natural that shifts a band needs a single die to have a natural at all,
  // and it replaces the summed kind's own automatic success and failure rather than stacking on it.
  // On a pool the bands say what a critical is, so `exceptional` beside them would be a second answer.
  if (resolution.outcomes?.naturals === "shift") {
    if (resolution.kind !== "dice-sum" || resolution.dice.count !== 1) {
      issue(["resolution", "outcomes", "naturals"], "A natural shifts a band only where one die is rolled");
    } else if (resolution.naturals.check !== "none" || resolution.naturals.save !== "none") {
      issue(
        ["resolution", "outcomes", "naturals"],
        "Shifting bands on a natural replaces resolution.naturals, so set both of those to none",
      );
    }
  }
  // A fraction of the target (1.139) is a roll-against reading, and each band's atLeast a divisor.
  if (resolution.outcomes?.by === "fraction") {
    if (resolution.kind !== "roll-against") {
      issue(["resolution", "outcomes", "by"], "Only a roll-against ruleset reads a fraction of its target");
    }
    resolution.outcomes.tiers.forEach((tier, index) => {
      if (tier.atLeast !== undefined && tier.atLeast < 1) {
        issue(["resolution", "outcomes", "tiers", index, "atLeast"], "A fraction band divides the target by 1 or more");
      }
    });
  }
  if (resolution.outcomes && resolution.kind === "dice-pool" && resolution.exceptional) {
    issue(["resolution", "exceptional"], "The outcome bands say what a critical success is, so leave exceptional out");
  }

  if (resolution.kind === "dice-sum") {
    if (resolution.dice.count !== 1 && (resolution.naturals.check !== "none" || resolution.naturals.save !== "none")) {
      issue(["resolution", "naturals"], "Natural results need a single die; with several dice use none");
    }
    // Custom faces, open-ended rolls and unmodified faces (1.136).
    const { dice, openEnded, unmodified } = resolution;
    if (dice.faces && dice.faces.length !== dice.sides) {
      issue(["resolution", "dice", "faces"], `A d${dice.sides} has ${dice.sides} faces, so give ${dice.sides} values`);
    }
    if (openEnded) {
      if (dice.count !== 1) issue(["resolution", "openEnded"], "An open-ended roll needs a single die");
      if (dice.faces)
        issue(["resolution", "openEnded"], "An open-ended roll adds its die's own numbers, so it has no faces");
      if (openEnded.high === undefined && openEnded.low === undefined) {
        issue(["resolution", "openEnded"], "Give high, low or both");
      }
      if (openEnded.high !== undefined && (openEnded.high < 2 || openEnded.high > dice.sides)) {
        issue(["resolution", "openEnded", "high"], `A face of this die is from 2 to ${dice.sides}`);
      }
      if (openEnded.low !== undefined && openEnded.low >= (openEnded.high ?? dice.sides + 1)) {
        issue(["resolution", "openEnded", "low"], "low is at or above high, so a face would roll both ways");
      }
      if (openEnded.low !== undefined && openEnded.low >= dice.sides) {
        issue(["resolution", "openEnded", "low"], `A face of this die is from 1 to ${dice.sides - 1}`);
      }
    }
    if (unmodified) {
      if (dice.count !== 1) issue(["resolution", "unmodified"], "An unmodified face is a single die's");
      unmodified.forEach((face, index) => {
        if (face > dice.sides)
          issue(["resolution", "unmodified", index], `A face of this die is from 1 to ${dice.sides}`);
      });
    }
  } else if (resolution.kind === "symbol-pool") {
    if (resolution.allowOwnUpgrade && !resolution.pool.upgrade) {
      issue(["resolution", "allowOwnUpgrade"], "Own upgrades require pool.upgrade");
    }
    const symbols = unique(resolution.symbols, ["resolution", "symbols"], "symbol");
    const dice = unique(resolution.dice, ["resolution", "dice"], "die");
    const byId = new Map(resolution.symbols.map((symbol) => [symbol.id, symbol]));
    const paired = new Map<string, string>();
    resolution.symbols.forEach((symbol, index) => {
      for (const key of ["counts", "cancels"] as const) {
        const id = symbol[key];
        if (!id) continue;
        const path = ["resolution", "symbols", index, key];
        if (!symbols.has(id)) issue(path, `Unknown symbol "${id}"`);
        if (id === symbol.id) issue(path, "A symbol cannot count or cancel itself");
        if (key === "counts" && byId.get(id)?.counts) issue(path, "counts must name a symbol without counts");
        if (key === "cancels") {
          for (const [first, second] of [
            [symbol.id, id],
            [id, symbol.id],
          ]) {
            if (paired.has(first!) && paired.get(first!) !== second) issue(path, "A symbol cancels only one partner");
            paired.set(first!, second!);
          }
        }
      }
    });
    resolution.dice.forEach((die, index) =>
      die.faces.forEach((face, at) =>
        face.forEach((id, n) => {
          if (!symbols.has(id)) issue(["resolution", "dice", index, "faces", at, n], `Unknown symbol "${id}"`);
        }),
      ),
    );
    for (const key of ["pool", "difficulty", "boost", "setback"] as const) {
      const part = resolution[key];
      if (!part) continue;
      if (!dice.has(part.die)) issue(["resolution", key, "die"], `Unknown die "${part.die}"`);
      if ("upgrade" in part && part.upgrade && !dice.has(part.upgrade))
        issue(["resolution", key, "upgrade"], `Unknown die "${part.upgrade}"`);
    }
    if (!symbols.has(resolution.success.symbol)) issue(["resolution", "success", "symbol"], "Unknown success symbol");
    for (const key of ["criticalSuccess", "criticalFailure"] as const) {
      if (resolution[key] && !symbols.has(resolution[key])) issue(["resolution", key], "Unknown critical symbol");
    }
  } else if (resolution.kind === "roll-against") {
    // Rolling against the sheet's number (1.139).
    const { dice, tens, against } = resolution;
    const most = dice.count * dice.sides;
    if (tens && (dice.count !== 1 || dice.sides !== 100)) {
      issue(["resolution", "tens"], "Tens dice are thrown on a single d100");
    }
    for (const key of ["criticalSuccess", "criticalFailure"] as const) {
      resolution[key]?.forEach((rule, index) => {
        const at = ["resolution", key, index];
        const byFace = rule.from !== undefined || rule.to !== undefined;
        if (byFace === (rule.pastTarget !== undefined)) {
          issue(at, "A critical names faces (from, to) or pastTarget, one of the two");
        }
        if (rule.pastTarget !== undefined && key === "criticalSuccess") {
          issue([...at, "pastTarget"], "pastTarget is how far a roll failed, so it names a critical failure");
        }
        for (const end of ["from", "to"] as const) {
          const face = rule[end];
          if (face !== undefined && (face < dice.count || face > most)) {
            issue([...at, end], `${dice.count}d${dice.sides} shows ${dice.count} to ${most}`);
          }
        }
        if (rule.from !== undefined && rule.to !== undefined && rule.from > rule.to) {
          issue([...at, "from"], "from is above to");
        }
      });
    }
    if (resolution.outcomes?.by === "fraction" && against !== "at-most") {
      issue(["resolution", "outcomes", "by"], "A fraction of the target is read on a roll at most the target");
    }
  } else if (resolution.kind === "dice-highest") {
    // Keep-the-highest dice (1.138).
    const { die, pool, critical, keep } = resolution;
    if (pool.min > pool.max) issue(["resolution", "pool", "min"], "pool.min is above pool.max");
    if (critical?.face !== undefined && critical.face > die.sides) {
      issue(["resolution", "critical", "face"], `A face of this die is from 2 to ${die.sides}`);
    }
    if (
      critical &&
      critical.count >
        pool.max +
          (resolution.situationalDice?.max ?? 0) +
          (resolution.dark?.outcome === "light" ? 0 : (resolution.dark?.max ?? 0))
    ) {
      issue(["resolution", "critical", "count"], "No roll throws that many dice, so the critical could never happen");
    }
    if (keep > 1 && resolution.zeroDice === "lowest-of-two" && pool.min === 0) {
      issue(
        ["resolution", "zeroDice"],
        "Two dice kept lowest is one die, so it cannot be read with keep above 1; use fail",
      );
    }
  } else {
    const { die, pool, target } = resolution;
    // Every face a pool rule names has to be a face this die actually has, or the rule could never
    // fire and the author would find out in play rather than at import.
    const faceIssue = (value: number, path: (string | number)[]) => {
      if (value < 2 || value > die.sides) issue(path, `A face of this die is from 2 to ${die.sides}`);
    };
    if (pool.min > pool.max) issue(["resolution", "pool", "min"], "min is above max");
    faceIssue(target.min, ["resolution", "target", "min"]);
    faceIssue(target.max, ["resolution", "target", "max"]);
    faceIssue(target.default, ["resolution", "target", "default"]);
    if (target.min > target.max) issue(["resolution", "target", "min"], "min is above max");
    if (target.default < target.min || target.default > target.max) {
      issue(["resolution", "target", "default"], "default is outside min..max");
    }
    // A rule a check may move keeps its default at or above the lowest face it may move to, or the
    // default itself would be a face no check could ask for.
    for (const key of ["double", "explode"] as const) {
      const rule = resolution[key];
      if (!rule) continue;
      if (rule.from !== undefined) faceIssue(rule.from, ["resolution", key, "from"]);
      if (rule.min !== undefined) faceIssue(rule.min, ["resolution", key, "min"]);
      if (rule.from !== undefined && rule.min !== undefined && rule.from < rule.min) {
        issue(["resolution", key, "from"], "from is below min");
      }
    }
    // A face that both succeeds and cancels, or both succeeds and botches, would count itself
    // twice in opposite directions. The lowest target the GM can set is the line.
    for (const key of ["cancel", "botch"] as const) {
      const rule = resolution[key];
      if (rule && rule.upTo >= target.min) {
        issue(["resolution", key, "upTo"], `A ${key} face must be below the lowest target (${target.min})`);
      }
    }
    // The target off the sheet, stances and the exact face (1.137).
    if (target.from) checkRef(target.from, ["resolution", "target", "from"], derivedIds);
    if (resolution.stances) {
      unique(resolution.stances, ["resolution", "stances"], "stance");
      const claimed = new Set<string>();
      resolution.stances.forEach((stance, index) => {
        stance.skills.forEach((skill, at) => {
          const path = ["resolution", "stances", index, "skills", at];
          if (!skills.has(skill)) issue(path, `Unknown skill "${skill}"`);
          else if (claimed.has(skill)) issue(path, `"${skill}" is in two stances, so a check could not say which`);
          claimed.add(skill);
        });
      });
      // A face that explodes, doubles, cancels or botches is read against "at or above"; counting
      // below or above the target would make each of those mean something else.
      for (const key of ["explode", "double", "cancel", "botch"] as const) {
        if (resolution[key])
          issue(
            ["resolution", key],
            `A ruleset with stances counts dice below or above the target, so it has no ${key}`,
          );
      }
    }
    // A number above what the largest roll can count could never be reached at the table.
    const reachable = rulesetPoolMaxSuccesses(resolution);
    if (resolution.exceptional && resolution.exceptional.successes > reachable) {
      issue(["resolution", "exceptional", "successes"], `The largest pool can count ${reachable} at most`);
    }
  }
  // Every ladder in the file is held to the resolution kind's own rules, wherever it sits, so a
  // layer that swaps one in cannot declare a step the base ruleset would have been refused for.
  checkDifficultyLadder(resolution.difficultyLadder, ["resolution", "difficultyLadder"]);

  sheet.lists.forEach((list, index) => {
    const path = ["sheet", "lists", index];
    const columns = unique(list.columns, [...path, "columns"], "column");
    list.columns.forEach((column, columnIndex) => checkTyped(column, [...path, "columns", columnIndex]));
    // A rolled column's sides: another column of the row that reads as a number, or the sheet's.
    list.columns.forEach((column, columnIndex) => {
      if (column.type !== "number" || !column.roll || typeof column.roll.sides === "number") return;
      const at = [...path, "columns", columnIndex, "roll", "sides"];
      const sides = column.roll.sides;
      if ("column" in sides) {
        const other = list.columns.find((each) => each.id === sides.column);
        if (!other || other.id === column.id) issue(at, `"${sides.column}" is not another column of this list`);
        else if (other.type === "enum") {
          const unread = other.values.filter((value) => rulesetDieSides(value) === null);
          if (unread.length) issue(at, `"${unread[0]}" does not read as a die (d6, 8)`);
        } else if (other.type !== "number") issue(at, "Sides read a number column or an enum of dice");
      } else checkRef(sides, at, derivedIds, false);
    });
    // A worked-out column (1.210) adds up other number columns of the row that are typed, not worked out.
    list.columns.forEach((column, columnIndex) => {
      if (column.type !== "number" || !column.sum) return;
      const at = [...path, "columns", columnIndex, "sum"];
      if (column.roll) issue(at, "A worked-out column is not rolled");
      column.sum.forEach((id, idIndex) => {
        const other = list.columns.find((each) => each.id === id);
        if (!other || other.id === column.id || other.type !== "number")
          issue([...at, idIndex], `"${id}" is not another number column of this list`);
        else if (other.sum) issue([...at, idIndex], `"${id}" is itself worked out`);
        if (column.sum!.indexOf(id) !== idIndex) issue([...at, idIndex], `"${id}" is named twice`);
      });
    });
    checkSection(list.section, path);
    checkHideWhen(list.hideWhen, path);
    if (list.pools) {
      const typeOf = (id: string) => list.columns.find((column) => column.id === id)?.type;
      if (typeOf(list.pools.nameColumn) !== "text") issue([...path, "pools", "nameColumn"], "Must name a text column");
      if (typeOf(list.pools.maxColumn) !== "number")
        issue([...path, "pools", "maxColumn"], "Must name a number column");
      if (list.pools.rechargeColumn && typeOf(list.pools.rechargeColumn) !== "enum") {
        issue([...path, "pools", "rechargeColumn"], "Must name an enum column");
      }
    }
    void columns;
  });

  // A skill or save's cap feeds that skill's own number, so like the proficiency bonus it cannot
  // read a skill or save modifier, and neither can the derived value it reads or any declared above
  // that one: evaluation then still runs once, top to bottom.
  for (const key of ["skills", "saves"] as const) {
    sheet[key].forEach((entry, index) => {
      if (!entry.cap) return;
      const path = ["sheet", key, index, "cap"];
      checkRef(entry.cap, path, derivedIds);
      if (entry.cap.skillMod !== undefined || entry.cap.saveMod !== undefined) {
        issue(path, "A cap cannot read a skill or save modifier");
      }
      if (entry.cap.derived === undefined) return;
      const end = sheet.derived.findIndex((derived) => derived.id === entry.cap!.derived);
      sheet.derived.slice(0, end + 1).forEach((derived, derivedIndex) => {
        if (refsOf(derived).some((ref) => ref.skillMod !== undefined || ref.saveMod !== undefined)) {
          issue(
            ["sheet", "derived", derivedIndex],
            `"${derived.id}" feeds the cap on "${entry.id}" and cannot read a skill or save modifier`,
          );
        }
      });
    });
  }

  sheet.live.pools.forEach((pool, index) => {
    const path = ["sheet", "live", "pools", index];
    checkRef(pool.max, [...path, "max"], derivedIds, false);
    if (pool.level) checkRef(pool.level, [...path, "level"], derivedIds, false);
    if (pool.startFrom) checkRef(pool.startFrom, [...path, "startFrom"], derivedIds, false);
    (pool.pays ?? []).forEach((group, at) => {
      if (!sheet.live.pools.some((other) => other.group === group)) {
        issue([...path, "pays", at], `Unknown pool group "${group}"`);
      } else if (group === pool.group) {
        issue([...path, "pays", at], `"${pool.id}" already pays for its own group "${group}"`);
      }
    });
    checkHideWhen(pool.hideWhen, path);
  });

  // A spend's limit read off the sheet names something the sheet has, and a re-throw it buys is held
  // to the same die the ruleset throws as every other re-throw.
  const abilityIds = new Set(sheet.abilities.map((ability) => ability.id));
  const rerollIssue = (upTo: number, path: (string | number)[]) => {
    if (resolution.kind !== "dice-pool") return;
    if (upTo < 1 || upTo >= resolution.die.sides) {
      issue(
        [...path, "upTo"],
        `This ruleset throws d${resolution.die.sides}, so a re-throw is on a face from 1 to ${resolution.die.sides - 1}`,
      );
    }
  };
  resolution.spend?.forEach((spend, index) => {
    const path = ["resolution", "spend", index];
    if (typeof spend.perCheck === "object") checkRef(spend.perCheck, [...path, "perCheck"], derivedIds);
    if (spend.reroll) rerollIssue(spend.reroll.upTo, [...path, "reroll"]);
  });
  if (resolution.kind === "dice-pool") {
    unique(resolution.reroll ?? [], ["resolution", "reroll"], "re-throw");
    resolution.reroll?.forEach((reroll, index) => rerollIssue(reroll.upTo, ["resolution", "reroll", index]));
  }
  resolution.adjust?.forEach((adjust, index) => {
    const path = ["resolution", "adjust", index];
    checkRef(adjust.value, [...path, "value"], derivedIds);
    adjust.abilities?.forEach((id, abilityIndex) => {
      if (!abilityIds.has(id)) issue([...path, "abilities", abilityIndex], `Unknown ability "${id}"`);
    });
  });
  sheet.live.tracks.forEach((track, index) => {
    const path = ["sheet", "live", "tracks", index];
    checkHideWhen(track.hideWhen, path);
    if (track.startFrom) {
      if (track.levels || track.boxes) issue([...path, "startFrom"], "A wound track starts unmarked");
      else checkRef(track.startFrom, [...path, "startFrom"], derivedIds, false);
    }
    if (typeof track.max !== "number") {
      // A maximum the sheet works out is only known per character, so only the floor is checked here;
      // the live state holds a value inside whatever the character's own maximum turns out to be.
      checkRef(track.max, [...path, "max"], derivedIds, false);
      if (track.default !== undefined && track.default < track.min) issue([...path, "default"], "default is below min");
      return;
    }
    if (track.min > track.max) issue([...path, "min"], "min is above max");
    if (track.default !== undefined && (track.default < track.min || track.default > track.max)) {
      issue([...path, "default"], "default is outside min..max");
    }
  });
  sheet.live.states.forEach((state, index) => {
    const path = ["sheet", "live", "states", index];
    checkHideWhen(state.hideWhen, path);
    state.values.forEach((value, valueIndex) => {
      if (state.values.indexOf(value) !== valueIndex)
        issue([...path, "values", valueIndex], `Duplicate value "${value}"`);
    });
    if (state.default !== undefined && !state.values.includes(state.default)) {
      issue([...path, "default"], `default "${state.default}" is not one of the values`);
    }
    for (const key of Object.keys(state.valueLabels ?? {})) {
      if (!state.values.includes(key)) issue([...path, "valueLabels", key], `"${key}" is not one of the values`);
    }
  });

  const listById = new Map(sheet.lists.map((list) => [list.id, list]));
  // The pools the fight screen shows under a turn name the sheet's own pools, once each (1.375): a
  // pool a list's rows make has no single value to show.
  def.combat?.display?.pools?.forEach((id, index, named) => {
    const path = ["combat", "display", "pools", index];
    if (!pools.has(id)) {
      issue(
        path,
        listById.get(id)?.pools
          ? `"${id}" is a list; a pool its rows make has no single value to show`
          : `Unknown pool "${id}"`,
      );
    } else if (named.indexOf(id) !== index) issue(path, `Duplicate pool "${id}"`);
  });

  def.rests.forEach((rest, restIndex) => {
    rest.restore.forEach((op, opIndex) => {
      const path = ["rests", restIndex, "restore", opIndex];
      if (op.pool !== undefined && !pools.has(op.pool)) issue([...path, "pool"], `Unknown pool "${op.pool}"`);
      if (op.poolGroup !== undefined && !poolGroups.has(op.poolGroup)) {
        issue([...path, "poolGroup"], `No pool declares the group "${op.poolGroup}"`);
      }
      if (op.track !== undefined && !tracks.has(op.track)) issue([...path, "track"], `Unknown track "${op.track}"`);
      if (op.state !== undefined) {
        const state = stateById.get(op.state);
        if (!state) issue([...path, "state"], `Unknown state "${op.state}"`);
        else if (typeof op.to === "string" && op.to !== "default" && !state.values.includes(op.to)) {
          issue([...path, "to"], `"${op.to}" is not "default" or one of the values of "${op.state}"`);
        }
      }
      if (op.kind !== undefined && op.track !== undefined && tracks.has(op.track)) {
        const target = sheet.live.tracks.find((entry) => entry.id === op.track)!;
        if (!woundTracks.has(op.track))
          issue([...path, "kind"], `"${op.track}" is not a wound track, so it has no kinds`);
        else if (!target.kinds?.some((entry) => entry.id === op.kind)) {
          issue([...path, "kind"], `"${op.track}" declares no kind "${op.kind}"`);
        }
      }
      if (op.listPools !== undefined) {
        const list = listById.get(op.listPools);
        if (!list?.pools) issue([...path, "listPools"], `"${op.listPools}" is not a list with pools`);
        else if (op.recharge) {
          const column = list.columns.find((entry) => entry.id === list.pools!.rechargeColumn);
          if (!column || column.type !== "enum") {
            issue([...path, "recharge"], `List "${op.listPools}" declares no rechargeColumn to filter on`);
          } else {
            // A value the column cannot hold would make the step match no row, silently.
            op.recharge.forEach((value, index) => {
              if (!column.values.includes(value)) {
                issue([...path, "recharge", index], `"${value}" is not one of the values of "${column.id}"`);
              }
            });
          }
        }
      }
    });
    rest.clear.text.forEach((id, index) => {
      if (!liveText.has(id)) issue(["rests", restIndex, "clear", "text", index], `Unknown live text "${id}"`);
    });
    if (rest.clear.conditions !== "all") {
      rest.clear.conditions.forEach((id, index) => {
        if (!conditions.has(id)) issue(["rests", restIndex, "clear", "conditions", index], `Unknown condition "${id}"`);
      });
    }
  });

  const summary = def.gm.sheetSummary;
  summary.fields.forEach((id, index) => {
    if (!fields.has(id)) issue(["gm", "sheetSummary", "fields", index], `Unknown field "${id}"`);
  });
  summary.derived.forEach((id, index) => {
    if (!derivedIds.has(id)) issue(["gm", "sheetSummary", "derived", index], `Unknown derived value "${id}"`);
  });
  summary.lists.forEach((entry, index) => {
    const path = ["gm", "sheetSummary", "lists", index];
    const list = listById.get(entry.list);
    if (!list) return issue([...path, "list"], `Unknown list "${entry.list}"`);
    const typeOf = (id: string) => list.columns.find((column) => column.id === id)?.type;
    const nameType = typeOf(entry.nameColumn);
    if (nameType !== "text" && nameType !== "enum") issue([...path, "nameColumn"], "Must name a text or enum column");
    (entry.columns ?? []).forEach((id, columnIndex) => {
      if (typeOf(id) === undefined) issue([...path, "columns", columnIndex], `Unknown column "${id}"`);
    });
    if (entry.groupBy && typeOf(entry.groupBy) === undefined)
      issue([...path, "groupBy"], `Unknown column "${entry.groupBy}"`);
    if (entry.onlyWhen && typeOf(entry.onlyWhen) !== "boolean")
      issue([...path, "onlyWhen"], "Must name a boolean column");
  });

  if (def.items) {
    const items = def.items;
    const at = (...rest: (string | number)[]) => ["items", ...rest];
    unique(items.categories, at("categories"), "item category");
    unique(items.rarities ?? [], at("rarities"), "rarity");
    unique(items.tags ?? [], at("tags"), "item tag");
    unique(items.slots ?? [], at("slots"), "slot");
    unique(items.stats ?? [], at("stats"), "item stat");
    items.stats?.forEach((stat, index) => checkTyped(stat, at("stats", index)));
    // Worked out without the live state, as a pool's maximum is: what a character may bind or carry
    // is a number their sheet gives them, not one that moves with every blow.
    if (items.binding) checkRef(items.binding.max, at("binding", "max"), derivedIds, false);
    if (items.carry) {
      const weight = items.stats?.find((stat) => stat.id === items.carry!.stat);
      if (!weight) issue(at("carry", "stat"), `Unknown item stat "${items.carry.stat}"`);
      else if (weight.type !== "number") issue(at("carry", "stat"), `Item stat "${weight.id}" is not a number`);
      else if (weight.min < 0)
        issue(at("carry", "stat"), `Item stat "${weight.id}" is a weight, so its min is 0 or more`);
      checkRef(items.carry.encumberedAbove, at("carry", "encumberedAbove"), derivedIds, false);
      if (items.carry.limit) checkRef(items.carry.limit, at("carry", "limit"), derivedIds, false);
    }
    unique(items.currencies ?? [], at("currencies"), "currency");
    const rarities = new Set((items.rarities ?? []).map((rarity) => rarity.id));
    const capped = new Set<string>();
    items.rarityCaps?.forEach((cap, index) => {
      if (!rarities.has(cap.rarity)) {
        issue(
          at("rarityCaps", index, "rarity"),
          rarities.size ? `Unknown rarity "${cap.rarity}"` : "This ruleset declares no rarities",
        );
      } else if (capped.has(cap.rarity)) issue(at("rarityCaps", index, "rarity"), `Duplicate rarity "${cap.rarity}"`);
      capped.add(cap.rarity);
      for (const [id, most] of Object.entries(cap.stats ?? {})) {
        const stat = items.stats?.find((each) => each.id === id);
        if (!stat) issue(at("rarityCaps", index, "stats", id), `Unknown item stat "${id}"`);
        else if (stat.type !== "number")
          issue(at("rarityCaps", index, "stats", id), `Item stat "${id}" is not a number`);
        else if (most < stat.min || most > stat.max) {
          issue(at("rarityCaps", index, "stats", id), `Item stat "${id}" runs from ${stat.min} to ${stat.max}`);
        } else if (stat.integer && !Number.isInteger(most)) {
          issue(at("rarityCaps", index, "stats", id), `Item stat "${id}" takes whole numbers`);
        }
      }
    });
    // An item's cost names a unit alone, so a unit id means one coin across every family.
    const units = new Set<string>();
    items.currencies?.forEach((family, familyIndex) => {
      const path = at("currencies", familyIndex);
      const values = new Set<number>();
      family.units.forEach((unit, unitIndex) => {
        if (units.has(unit.id)) issue([...path, "units", unitIndex, "id"], `Duplicate currency unit id "${unit.id}"`);
        units.add(unit.id);
        // Two units of one value would be the same coin twice, and change could be given in either.
        if (values.has(unit.value)) {
          issue(
            [...path, "units", unitIndex, "value"],
            `Another unit of "${family.id}" is already worth ${unit.value}`,
          );
        }
        values.add(unit.value);
      });
      // Every value counts the family's smallest coin, so the smallest coin counts itself.
      if (!values.has(1)) issue([...path, "units"], `The smallest unit of "${family.id}" is worth 1`);
      if (family.perWeight !== undefined && !items.carry) {
        issue([...path, "perWeight"], "Coins weigh something only when the items block has a carry block");
      }
    });
    // A loot line names one of the ruleset's items, or the words its filter picks them by. An item
    // of a catalog kept in its own file is checked when that file is read. A layered definition may be
    // the browser's listing, whose catalogs come without their entries: its items were checked at import.
    unique(items.lootTables ?? [], at("lootTables"), "loot table");
    const words = { rarity: items.rarities ?? [], category: items.categories, tag: items.tags ?? [] };
    items.lootTables?.forEach((table, tableIndex) => {
      table.entries.forEach((entry, entryIndex) => {
        const path = at("lootTables", tableIndex, "entries", entryIndex);
        if (entry.item) {
          const [catalogId, entryId] = entry.item.split("/") as [string, string];
          const catalog = def.catalogs?.find((each) => each.id === catalogId);
          if (!catalog || catalog.holds !== "items") issue([...path, "item"], `No item catalog "${catalogId}"`);
          else if (
            !layersApplied &&
            catalog.entries &&
            !catalog.from &&
            !catalog.entries.some((each) => each.id === entryId && each.item)
          ) {
            issue([...path, "item"], `No item "${entryId}" in catalog "${catalogId}"`);
          }
        }
        if (entry.coins && !items.currencies?.some((family) => family.units.some((unit) => unit.id === entry.coins))) {
          issue([...path, "coins"], `Unknown currency unit "${entry.coins}"`);
        }
        for (const key of ["rarity", "category", "tag"] as const) {
          const id = entry.filter?.[key];
          if (id !== undefined && !words[key].some((word) => word.id === id)) {
            issue([...path, "filter", key], `Unknown item ${key} "${id}"`);
          }
        }
      });
    });
    // Starting gear (1.78): every item one of the ruleset's (a catalog kept in its own file is checked
    // when the gear is taken), never a service, and few enough stacks to fit a bag; coins it declares;
    // a plain item only where items may be plain; `fits` read off the sheet without the live state,
    // as carrying is.
    unique(items.startingGear ?? [], at("startingGear"), "starting gear");
    const checkGearItem = (ref: string, count: number, path: (string | number)[]) => {
      const [catalogId, entryId] = ref.split("/") as [string, string];
      const catalog = def.catalogs?.find((each) => each.id === catalogId);
      if (!catalog || catalog.holds !== "items") return issue(path, `No item catalog "${catalogId}"`);
      // A borrowed catalog's entries (1.220) are read with it, not here.
      if (layersApplied || !catalog.entries || catalog.from) return;
      const entry = catalog.entries.find((each) => each.id === entryId && each.item);
      if (!entry?.item) return issue(path, `No item "${entryId}" in catalog "${catalogId}"`);
      if (entry.item.service) issue(path, `"${entryId}" is a service, which is never carried`);
      if (entry.item.stack && Math.ceil(count / entry.item.stack) > GAME_INVENTORY_MAX_NEW_STACKS) {
        issue(path, `${count} of "${entryId}" is more stacks than one bag takes at once`);
      }
    };
    const checkGearLine = (line: z.infer<typeof startingGearLineSchema>, path: (string | number)[]) => {
      if (line.item) checkGearItem(line.item, line.count, [...path, "item"]);
      line.oneOf?.forEach((ref, refIndex) => checkGearItem(ref, line.count, [...path, "oneOf", refIndex]));
      if (line.coins && !items.currencies?.some((family) => family.units.some((unit) => unit.id === line.coins))) {
        issue([...path, "coins"], `Unknown currency unit "${line.coins}"`);
      }
      if (line.name !== undefined && items.freeform === "refuse") {
        issue([...path, "name"], "This ruleset refuses plain items, so starting gear names its own");
      }
    };
    items.startingGear?.forEach((gear, gearIndex) => {
      const path = at("startingGear", gearIndex);
      if (gear.fits) checkRef(gear.fits.value, [...path, "fits", "value"], derivedIds, false);
      gear.lines.forEach((line, lineIndex) => checkGearLine(line, [...path, "lines", lineIndex]));
      gear.choices.forEach((choice, choiceIndex) =>
        choice.options.forEach((option, optionIndex) =>
          option.lines.forEach((line, lineIndex) =>
            checkGearLine(line, [...path, "choices", choiceIndex, "options", optionIndex, "lines", lineIndex]),
          ),
        ),
      );
    });
    const market = items.market;
    if (market) {
      // A filter picks by the items block's own words, and says at least one of them.
      const checkFilter = (filter: { rarity?: string; category?: string; tag?: string }, path: (string | number)[]) => {
        if (Object.keys(filter).length === 0) issue(path, "A filter names a rarity, a category or a tag");
        for (const key of ["rarity", "category", "tag"] as const) {
          const id = filter[key];
          if (id !== undefined && !words[key].some((word) => word.id === id)) {
            issue([...path, key], `Unknown item ${key} "${id}"`);
          }
        }
      };
      const places = unique(market.places, at("market", "places"), "place");
      // A purse is counted in one of the ruleset's coins.
      market.places.forEach((place, index) => {
        if (
          place.purse &&
          !items.currencies?.some((family) => family.units.some((unit) => unit.id === place.purse!.unit))
        ) {
          issue(at("market", "places", index, "purse", "unit"), `Unknown currency unit "${place.purse.unit}"`);
        }
      });
      const checkPlace = (place: string | undefined, path: (string | number)[]) => {
        if (place !== undefined && !places.has(place)) issue(path, `Unknown place "${place}"`);
      };
      unique(market.prices, at("market", "prices"), "price level");
      if (market.prices.filter((level) => level.default).length !== 1) {
        issue(at("market", "prices"), "One price level is the default");
      }
      market.sold?.forEach((rule, index) => {
        checkFilter(rule.filter, at("market", "sold", index, "filter"));
        checkPlace(rule.place, at("market", "sold", index, "place"));
      });
      unique(market.sellers ?? [], at("market", "sellers"), "seller");
      market.sellers?.forEach((seller, index) => {
        seller.sells.forEach((filter, filterIndex) =>
          checkFilter(filter, at("market", "sellers", index, "sells", filterIndex)),
        );
        checkPlace(seller.place, at("market", "sellers", index, "place"));
        // A seller's stock is one of the ruleset's own loot tables.
        if (seller.stock && !items.lootTables?.some((table) => table.id === seller.stock!.table)) {
          issue(at("market", "sellers", index, "stock", "table"), `Unknown loot table "${seller.stock.table}"`);
        }
        // Read off the buyer's sheet with their live state, as a gate's `unless` is.
        if (seller.only) checkRef(seller.only.value, at("market", "sellers", index, "only", "value"), derivedIds);
      });
    }
  }

  const catalogs = def.catalogs ?? [];
  unique(catalogs, ["catalogs"], "catalog");
  // A catalog only the party's own setup reads (1.163) writes the party's lists and fields, so it is
  // checked against the party's sheet, with the party's builder, and not against a character's.
  const stepCatalogs = (steps: readonly RulesetBuilderStep[] | undefined) =>
    new Set(
      (steps ?? []).flatMap((step) =>
        step.kind === "catalog" || step.kind === "choices"
          ? [step.catalog]
          : step.kind === "rows" && step.from
            ? [step.from]
            : [],
      ),
    );
  const characterCatalogs = stepCatalogs(sheet.builder?.steps);
  const partyOnly = stepCatalogs(def.party?.builder?.steps);
  for (const id of characterCatalogs) partyOnly.delete(id);
  catalogs.forEach((catalog, index) => {
    const path = ["catalogs", index];
    if (partyOnly.has(catalog.id)) return;
    // A creature is written in the numbers a fight reads, and those numbers are the `combat` block's
    // own: its budgets, its saves, its damage types and its threat scale.
    if (catalog.holds === "creatures" && !def.combat) {
      issue([...path, "holds"], "A catalog of creatures needs a combat block for its creatures to be written in");
    }
    // An item names its category, rarity, stats and slots, and those are the `items` block's.
    if (catalog.holds === "items" && !def.items) {
      issue([...path, "holds"], "A catalog of items needs an items block for its items to be written in");
    }
    (catalog.feeds ?? []).forEach((listId, feedIndex) => {
      if (!listById.has(listId)) issue([...path, "feeds", feedIndex], `Unknown list "${listId}"`);
    });
    unique(catalog.filters ?? [], [...path, "filters"], "catalog filter");
    catalog.filters?.forEach((filter, filterIndex) => {
      if (filter.startFrom && !fieldById.has(filter.startFrom.field)) {
        issue([...path, "filters", filterIndex, "startFrom", "field"], `Unknown field "${filter.startFrom.field}"`);
      }
    });
    // Inline entries go through exactly the checks an asset file's entries go through at read time,
    // so a catalog can never write a row the sheet could not hold whichever way it ships.
    for (const entryIssue of rulesetCatalogEntryIssues(def, catalog, catalog.entries ?? [], layersApplied)) {
      issue([...path, "entries", ...entryIssue.path], entryIssue.message);
    }
  });

  // Worked-out scores (1.156) are worked out once the derived values are, which are then worked out
  // again, so anything may read one; but none reads another, even through a derived value or skill.
  const valued = new Set(sheet.abilities.filter((ability) => ability.value).map((ability) => ability.id));
  if (valued.size > 0) {
    const readsValued = (ref: RulesetValueRef) => [...abilityReads(def, ref)].some((id) => valued.has(id));
    sheet.abilities.forEach((ability, index) =>
      ability.value?.forEach((ref, refIndex) => {
        const at = ["sheet", "abilities", index, "value", refIndex];
        checkRef(ref, at, derivedIds, false);
        if (readsValued(ref)) issue(at, "A worked-out score cannot read another worked-out score");
      }),
    );
    sheet.builder?.steps.forEach((step, index) => {
      const targets =
        step.kind === "abilities"
          ? (step.abilities ?? [])
          : step.kind === "allocate"
            ? step.groups.flatMap((group) =>
                group.targets.flatMap((target) => ("ability" in target ? [target.ability] : [])),
              )
            : step.kind === "spend"
              ? step.offers.flatMap((offer) => ("ability" in offer.target ? [offer.target.ability] : []))
              : [];
      for (const id of targets)
        if (valued.has(id))
          issue(["sheet", "builder", "steps", index], `"${id}" is worked out, not set by the builder`);
    });
  }

  // The guided builder (1.86): its steps name this ruleset's own catalogs, fields, scores and skills.
  if (sheet.builder) {
    const stepPath = (index: number) => ["sheet", "builder", "steps", index];
    unique(sheet.builder.steps, ["sheet", "builder", "steps"], "builder step");
    const catalogSteps = new Map<string, string>();
    const tierTargets = new Set<string>();
    sheet.builder.ratingTiers?.forEach((mapping, index) => {
      const path = ["sheet", "builder", "ratingTiers", index];
      const key = rulesetBuilderRatingKey(mapping.target);
      if (tierTargets.has(key)) issue(path, "A rating target has one tier map");
      tierTargets.add(key);
      const what = "skill" in mapping.target ? "skills" : "saves";
      const id = "skill" in mapping.target ? mapping.target.skill : mapping.target.save;
      if (!sheet[what].some((entry) => entry.id === id)) issue(path, `Unknown rating target "${id}"`);
      const offered = what === "skills" ? sheet.skillTiers : sheet.saveTiers;
      let previous = -1;
      mapping.tiers.forEach((id, tierIndex) => {
        const at = resolution.proficiencyTiers.findIndex((tier) => tier.id === id);
        if (at <= previous || (tierIndex === 0 && at !== 0) || (offered && !offered.includes(id)))
          issue([...path, "tiers", tierIndex], "A rating map starts at untrained and uses increasing offered tiers");
        previous = at;
      });
    });
    unique(sheet.builder.pools ?? [], ["sheet", "builder", "pools"], "builder pool");
    unique(sheet.builder.profiles ?? [], ["sheet", "builder", "profiles"], "builder profile");
    sheet.builder.profiles?.forEach((profile, index) => {
      const path = ["sheet", "builder", "profiles", index];
      checkRef(profile.when, [...path, "when"], derivedIds, false);
      profile.steps?.forEach((id, stepIndex) => {
        if (!sheet.builder!.steps.some((step) => step.id === id))
          issue([...path, "steps", stepIndex], `Unknown builder step "${id}"`);
      });
      for (const [id, ref] of Object.entries(profile.budgets ?? {})) {
        if (!sheet.builder!.pools?.some((pool) => pool.id === id))
          issue([...path, "budgets", id], `Unknown builder pool "${id}"`);
        checkRef(ref, [...path, "budgets", id], derivedIds, false);
      }
    });
    sheet.builder.steps.forEach((step, index) => {
      if ((step.kind !== "catalog" && step.kind !== "initialize") || !step.reads) return;
      const at = sheet.builder!.steps.findIndex((other) => other.id === step.reads!.before);
      if (at < 0) issue([...stepPath(index), "reads", "before"], `Unknown builder step "${step.reads.before}"`);
      else if (at === 0) issue([...stepPath(index), "reads", "before"], "No step comes before the first");
    });
    // Priced picks and rows (1.159) name a pool and a price together.
    const pricedIssues = (step: { pool?: string; cost?: unknown }, path: (string | number)[]) => {
      if ((step.pool === undefined) !== (step.cost === undefined))
        issue([...path, step.pool === undefined ? "cost" : "pool"], "A priced step has pool and cost together");
      if (step.pool !== undefined && !sheet.builder!.pools?.some((pool) => pool.id === step.pool))
        issue([...path, "pool"], `Unknown builder pool "${step.pool}"`);
    };
    sheet.builder.pools?.forEach((pool, index) => {
      const path = ["sheet", "builder", "pools", index];
      checkRef(pool.budget, [...path, "budget"], derivedIds, false);
      if (pool.budget.const !== undefined && (pool.budget.const < 0 || pool.budget.const > 100000))
        issue(path, "A spending budget is between 0 and 100000");
      for (const cap of pool.caps ?? [])
        if (
          !sheet.builder!.steps.some(
            (step) =>
              step.kind === "spend" &&
              step.pool === pool.id &&
              step.offers.some((offer) => offer.credit && offer.tags?.includes(cap.filter)),
          )
        )
          issue(path, "A credit cap filter names a credit offer tag in this pool");
    });
    const spendTargets = sheet.builder.steps.flatMap((step) => (step.kind === "spend" ? step.offers : []));
    let abilitySteps = 0;
    sheet.builder.steps.forEach((step, index) => {
      const path = stepPath(index);
      if (step.when) checkRef(step.when, [...path, "when"], derivedIds, false);
      if (step.requiredWhen) checkRef(step.requiredWhen, [...path, "requiredWhen"], derivedIds, false);
      if (step.kind === "catalog") {
        const catalog = catalogs.find((each) => each.id === step.catalog);
        if (!catalog || (catalog.holds ?? "rows") !== "rows") {
          issue([...path, "catalog"], `No catalog of rows "${step.catalog}"`);
        }
        builderLimitsIssues(step, catalog, step.max, path, issue);
        pricedIssues(step, path);
        if (
          typeof step.cost === "object" &&
          catalog?.filters?.find((filter) => filter.id === (step.cost as { filter: string }).filter)?.type !== "number"
        )
          issue([...path, "cost", "filter"], `No number filter "${step.cost.filter}"`);
        for (const [column, value] of Object.entries(step.stamp ?? {})) {
          if (
            !catalog?.feeds?.length ||
            catalog.feeds.some(
              (id) => !sheet.lists.find((list) => list.id === id)?.columns.some((each) => each.id === column),
            )
          ) {
            issue([...path, "stamp", column], `Unknown column "${column}" in a target list`);
          }
          if (typeof value === "object") {
            if (!step.within) {
              issue([...path, "stamp", column], "A stamp from the offering pick needs the step's within");
            } else if (value.fromWithin !== "id" && value.fromWithin !== "label") {
              const parent = catalogs.find((each) => each.id === catalogSteps.get(step.within!.step));
              if (!parent?.filters?.some((filter) => filter.id === value.fromWithin)) {
                issue([...path, "stamp", column, "fromWithin"], `Unknown filter "${value.fromWithin}"`);
              }
            }
          }
        }
        if (step.min > step.max) issue([...path, "min"], "A step asks for at most its max");
        if (step.field !== undefined) {
          const field = fieldById.get(step.field);
          if (!field || (field.type !== "text" && field.type !== "enum")) {
            issue([...path, "field"], `No text or enum field "${step.field}"`);
          }
        }
        const filterOf = (id: string) => catalog?.filters?.find((filter) => filter.id === id);
        for (const [filterId, value] of Object.entries(step.filters ?? {})) {
          const filter = filterOf(filterId);
          if (!filter) issue([...path, "filters", filterId], `Unknown filter "${filterId}"`);
          else if ((filter.type === "number") !== (typeof value === "number")) {
            issue(
              [...path, "filters", filterId],
              `Filter "${filterId}" takes ${filter.type === "number" ? "a number" : "a word"}`,
            );
          }
        }
        if (step.upTo) {
          const filter = filterOf(step.upTo.filter);
          if (!filter || filter.type !== "number") {
            issue([...path, "upTo", "filter"], `No number filter "${step.upTo.filter}"`);
          }
          checkRef(step.upTo.value, [...path, "upTo", "value"], derivedIds, false);
        }
        if (step.countFrom) checkRef(step.countFrom, [...path, "countFrom"], derivedIds, false);
        if (step.within) {
          if (!catalogSteps.has(step.within.step)) {
            issue([...path, "within", "step"], `No catalog step "${step.within.step}" before this one`);
          }
          const filter = filterOf(step.within.filter);
          if (!filter || filter.type === "number") {
            issue([...path, "within", "filter"], `No text or tags filter "${step.within.filter}"`);
          }
        }
        catalogSteps.set(step.id, step.catalog);
      } else if (step.kind === "fields") {
        step.fields.forEach((id, fieldIndex) => {
          if (!fields.has(id)) issue([...path, "fields", fieldIndex], `Unknown field "${id}"`);
        });
        step.optional?.forEach((id, optionalIndex) => {
          if (!step.fields.includes(id))
            issue([...path, "optional", optionalIndex], `"${id}" is not one of this step's fields`);
        });
        for (const [id, ref] of Object.entries(step.shownWhen ?? {})) {
          const at = [...path, "shownWhen", id];
          if (!step.fields.includes(id)) issue(at, `"${id}" is not one of this step's fields`);
          checkRef(ref, at, derivedIds, false);
        }
        step.total?.fields.forEach((id, fieldIndex) => {
          const at = [...path, "total", "fields", fieldIndex];
          if (!step.fields.includes(id)) issue(at, `"${id}" is not one of this step's fields`);
          if (fieldById.get(id)?.type !== "number") issue(at, `No number field "${id}"`);
          if (step.total!.fields.indexOf(id) !== fieldIndex) issue(at, `"${id}" is named twice`);
        });
      } else if (step.kind === "roll") {
        unique(step.rolls, [...path, "rolls"], "roll");
        step.rolls.forEach((roll, rollIndex) => {
          const at = [...path, "rolls", rollIndex];
          if ((roll.field === undefined) === (roll.ability === undefined))
            issue(at, "A roll writes a field or an ability, exactly one");
          else if (roll.field !== undefined) {
            if (fieldById.get(roll.field)?.type !== "number")
              issue([...at, "field"], `No number field "${roll.field}"`);
          } else {
            const ability = sheet.abilities.find((each) => each.id === roll.ability);
            if (!ability) issue([...at, "ability"], `Unknown ability "${roll.ability}"`);
            else if (ability.value) issue([...at, "ability"], `"${roll.ability}" is worked out, not written`);
            if (step.rolls.some((other, otherIndex) => otherIndex < rollIndex && other.ability === roll.ability))
              issue([...at, "ability"], `"${roll.ability}" is rolled twice`);
          }
          if (typeof roll.floor === "object") checkRef(roll.floor, [...at, "floor"], derivedIds, false);
          if (roll.gain && roll.best) issue([...at, "best"], "An improvement check is rolled once");
        });
      } else if (step.kind === "initialize") {
        step.writes.forEach((write, writeIndex) => {
          const at = [...path, "writes", writeIndex];
          const field = fieldById.get(write.field);
          if (!field) issue([...at, "field"], `Unknown field "${write.field}"`);
          if (step.writes.findIndex((other) => other.field === write.field) !== writeIndex)
            issue([...at, "field"], `"${write.field}" is written twice`);
          if (write.remaining !== undefined) {
            if (!sheet.builder!.pools?.some((pool) => pool.id === write.remaining))
              issue([...at, "remaining"], `Unknown builder pool "${write.remaining}"`);
            if (field && field.type !== "number") issue([...at, "field"], `"${write.field}" is not a number field`);
          } else if (write.value !== null && typeof write.value === "object") {
            checkRef(write.value, [...at, "value"], derivedIds, false);
            if (field && field.type !== "number") issue([...at, "field"], `"${write.field}" is not a number field`);
          } else if (
            field &&
            typeof write.value !==
              (field.type === "boolean" ? "boolean" : field.type === "number" ? "number" : "string")
          ) {
            issue(
              [...at, "value"],
              `"${write.field}" takes a ${field.type === "boolean" ? "boolean" : field.type === "number" ? "number" : "text"} value`,
            );
          }
        });
      } else if (step.kind === "rows") {
        const list = listById.get(step.list);
        if (!list) issue([...path, "list"], `Unknown list "${step.list}"`);
        const columnIds = new Set(list?.columns.map((column) => column.id) ?? []);
        const edited = step.columns ?? [...columnIds];
        step.columns?.forEach((id, columnIndex) => {
          if (list && !columnIds.has(id)) issue([...path, "columns", columnIndex], `Unknown column "${id}"`);
          if (step.columns!.indexOf(id) !== columnIndex)
            issue([...path, "columns", columnIndex], `"${id}" is named twice`);
        });
        step.required?.forEach((id, requiredIndex) => {
          if (!edited.includes(id))
            issue([...path, "required", requiredIndex], `"${id}" is not one of this step's columns`);
        });
        if (list && step.defaults)
          for (const message of rulesetListRowIssues(list, step.defaults)) issue([...path, "defaults"], message);
        if (step.max !== undefined && list && step.max > list.maxItems)
          issue([...path, "max"], `"${step.list}" holds at most ${list.maxItems} rows`);
        if (step.min !== undefined && step.min > (step.max ?? list?.maxItems ?? 20))
          issue([...path, "min"], "The step asks for more rows than it lets the player add");
        pricedIssues(step, path);
        if (typeof step.cost === "object") {
          const cost = step.cost;
          if (cost.column === undefined && cost.add === undefined && !cost.overrides)
            issue([...path, "cost"], "A row price names a column, an amount or overrides");
          if (cost.times !== undefined && cost.column === undefined)
            issue([...path, "cost", "times"], "times scales a column");
          if (cost.column !== undefined) {
            const column = list?.columns.find((each) => each.id === cost.column);
            if (list && column?.type !== "number")
              issue([...path, "cost", "column"], `No number column "${cost.column}"`);
            else if (!edited.includes(cost.column) && !step.from)
              issue([...path, "cost", "column"], `"${cost.column}" is not one of this step's columns`);
          }
          cost.overrides?.forEach((override, overrideIndex) => {
            if ((override.cost === undefined) === (override.times === undefined))
              issue([...path, "cost", "overrides", overrideIndex], "An override gives a cost or a rate, exactly one");
            else if (override.times !== undefined && cost.column === undefined)
              issue([...path, "cost", "overrides", overrideIndex, "times"], "times scales a column");
            const at = [...path, "cost", "overrides", overrideIndex, "derived"];
            const cell = list?.columns.find((each) => each.id === override.derived.cell);
            if (list && !cell) issue([...at, "cell"], `"${step.list}" has no column "${override.derived.cell}"`);
            // An enum cell names every derived value it can read, and each must be on the sheet.
            if (cell?.type === "enum")
              for (const value of cell.values) {
                const id = `${override.derived.prefix}${value}`;
                if (!derivedIds.has(id)) issue(at, `No derived value "${id}" for "${value}"`);
              }
          });
        }
        if (step.from !== undefined) {
          const catalog = catalogs.find((each) => each.id === step.from);
          if (!catalog || (catalog.holds ?? "rows") !== "rows")
            issue([...path, "from"], `No catalog of rows "${step.from}"`);
          else if (!catalog.feeds?.includes(step.list))
            issue([...path, "from"], `"${step.from}" writes no rows to "${step.list}"`);
        }
      } else if (step.kind === "abilities") {
        abilitySteps += 1;
        if (sheet.abilities.length === 0) issue([...path, "kind"], "This sheet has no ability scores");
        step.abilities?.forEach((id, abilityIndex) => {
          if (!abilities.has(id)) issue([...path, "abilities", abilityIndex], `Unknown ability "${id}"`);
          if (step.abilities!.indexOf(id) !== abilityIndex) {
            issue([...path, "abilities", abilityIndex], `"${id}" is named twice`);
          }
        });
        if (step.default !== undefined && step.methods[step.default] === undefined) {
          issue([...path, "default"], `"${step.default}" is not one of this step's methods`);
        }
        const set = sheet.abilities.filter(
          (ability) => !ability.value && (!step.abilities || step.abilities.includes(ability.id)),
        );
        const array = step.methods.standardArray;
        if (array && array.length !== set.length) {
          issue(
            [...path, "methods", "standardArray"],
            `The array hands out one value to each of the ${set.length} scores`,
          );
        }
        // Every value a method gives is one each of its scores can hold, so what the step shows is what
        // the sheet keeps.
        const fits = (value: number) => set.every((ability) => value >= ability.min && value <= ability.max);
        array?.forEach((value, index) => {
          if (!fits(value)) issue([...path, "methods", "standardArray", index], `${value} is outside a score's bounds`);
        });
        const pointBuy = step.methods.pointBuy;
        pointBuy?.costs.forEach(([score], index) => {
          if (!fits(score))
            issue([...path, "methods", "pointBuy", "costs", index], `${score} is outside a score's bounds`);
        });
        if (pointBuy && pointBuy.budget > pointBuy.costs[pointBuy.costs.length - 1]![1] * set.length) {
          issue([...path, "methods", "pointBuy", "budget"], "The budget is more than buying every score up can spend");
        }
        const roll = step.methods.roll;
        if (roll && !(fits(roll.keep) && fits(roll.keep * roll.sides))) {
          issue([...path, "methods", "roll"], "A roll can come to a number outside a score's bounds");
        }
        if (step.methods.rolls) {
          const grouped = step.methods.rolls.flatMap((group) => group.abilities);
          step.methods.rolls.forEach((group, groupIndex) =>
            group.abilities.forEach((id, abilityIndex) => {
              const at = [...path, "methods", "rolls", groupIndex, "abilities", abilityIndex];
              if (!set.some((ability) => ability.id === id)) issue(at, `"${id}" is not one of this step's scores`);
              else if (grouped.indexOf(id) !== grouped.lastIndexOf(id)) issue(at, `"${id}" is rolled twice`);
            }),
          );
          for (const ability of set)
            if (!grouped.includes(ability.id))
              issue([...path, "methods", "rolls"], `"${ability.id}" is not rolled by any group`);
        }
      } else if (step.kind === "spend") {
        const pool = sheet.builder!.pools?.find((pool) => pool.id === step.pool);
        if (!pool) issue([...path, "pool"], "Unknown builder pool");
        unique(step.offers, [...path, "offers"], "spend offer");
        step.offers.forEach((offer, offerIndex) => {
          const at = [...path, "offers", offerIndex];
          builderRatingTargetIssues(def, offer.target, [...at, "target"], issue);
          const [low, high] = rulesetBuilderRatingBounds(def, offer.target);
          const field = "field" in offer.target ? fieldById.get(offer.target.field) : undefined;
          const integer = field?.type !== "number" || field.integer;
          if (
            offer.min > offer.max ||
            offer.min < low ||
            offer.max > high ||
            (integer && (!Number.isInteger(offer.min) || !Number.isInteger(offer.max)))
          )
            issue(at, "Spend bounds must fit the target's numeric bounds or tier map");
          const twoWay = offer.direction === "both";
          const owned = offer.effect === "ownership";
          const exchange = offer.exchange;
          if (offer.direction === "decrease" && offer.baseline === undefined)
            issue(at, "A reduction declares the baseline it lowers from");
          if (
            offer.baseline !== undefined &&
            !twoWay &&
            !owned &&
            offer.direction !== "increase" &&
            (!offer.credit || offer.baseline !== offer.max)
          )
            issue(at, "A signed reduction declares credit and its maximum as baseline");
          if (offer.baseline !== undefined && (offer.baseline < offer.min || offer.baseline > offer.max))
            issue([...at, "baseline"], "The baseline is inside the offer's bounds");
          if (twoWay || owned || exchange) {
            if (offer.credit) issue([...at, "credit"], "This offer earns no declared credit");
            if (offer.allowedRatings) issue([...at, "allowedRatings"], "This offer steps one rating at a time");
          }
          if (owned && (offer.direction === "both" || offer.direction === "decrease" || exchange))
            issue([...at, "effect"], "An owned level is only ever bought up");
          if (exchange) {
            builderRatingTargetIssues(def, exchange.from, [...at, "exchange", "from"], issue);
            if (rulesetBuilderRatingKey(exchange.from) === rulesetBuilderRatingKey(offer.target))
              issue([...at, "exchange", "from"], "An exchange trades out of another rating");
            const [fromLow, fromHigh] = rulesetBuilderRatingBounds(def, exchange.from);
            if (exchange.floor < fromLow || exchange.floor > fromHigh)
              issue([...at, "exchange", "floor"], "The floor fits the traded rating's bounds");
            if (offer.direction && offer.direction !== "increase")
              issue([...at, "direction"], "An exchange raises its target");
            if (!("flat" in offer.cost) || offer.cost.flat !== 0 || offer.overrides)
              issue([...at, "cost"], "An exchange costs the pool nothing; leave cost out");
          } else if ("flat" in offer.cost && offer.cost.flat === 0)
            issue([...at, "cost"], "A spend offer needs a cost");
          if (
            twoWay &&
            spendTargets.filter(
              (other) => rulesetBuilderRatingKey(other.target) === rulesetBuilderRatingKey(offer.target),
            ).length > 1
          )
            issue(at, "A two-way target has one offer, preventing buy/credit cycles");
          for (const key of ["when", "minFrom", "maxFrom"] as const)
            if (offer[key]) checkRef(offer[key]!, [...at, key], derivedIds, false);
          offer.allowedRatings?.forEach((rating, ratingIndex) => {
            const where = [...at, "allowedRatings", ratingIndex];
            if (rating < offer.min || rating > offer.max) issue(where, `${rating} is outside the offer's bounds`);
            if (integer && !Number.isInteger(rating)) issue(where, `${rating} is not a whole number`);
            if ("table" in offer.cost && !offer.cost.table.some(([each]) => each === rating))
              issue(where, `${rating} is not a rating of the cost table`);
            if (offer.allowedRatings!.indexOf(rating) !== ratingIndex) issue(where, `${rating} is named twice`);
          });
          if (offer.allowedRatings && offer.baseline !== undefined)
            issue([...at, "allowedRatings"], "A reduction from a baseline steps one rating at a time");
          if (offer.credit && !pool?.creditLimit) issue(at, "Credit offers need a positive pool creditLimit");
          if (
            offer.credit &&
            spendTargets.filter(
              (other) => rulesetBuilderRatingKey(other.target) === rulesetBuilderRatingKey(offer.target),
            ).length > 1
          )
            issue(at, "A credit target has one offer, preventing buy/credit cycles");
          const costs = exchange ? [] : [offer.cost, ...(offer.overrides ?? []).map((entry) => entry.cost)];
          for (const cost of costs) {
            const descending = !!offer.credit && offer.baseline === undefined;
            if ("flat" in cost && (descending ? cost.flat >= 0 : cost.flat <= 0))
              issue(at, "Only declared trait credits have negative prices");
            if ("perRank" in cost && (descending || offer.min < 0))
              issue(at, "Per-rank prices need nonnegative ratings and positive marginal prices");
            if ("table" in cost) {
              for (let n = 0; n < cost.table.length; n++) {
                const [rating, price] = cost.table[n]!;
                const previous = cost.table[n - 1];
                if (
                  (integer && !Number.isInteger(rating)) ||
                  rating < low ||
                  rating > high ||
                  (previous && (rating <= previous[0] || (descending ? price >= previous[1] : price <= previous[1])))
                )
                  issue(
                    at,
                    "Cost tables need increasing ratings and strictly signed marginal prices within target bounds",
                  );
              }
              if (
                !cost.table.some(([rating]) => rating === offer.min) ||
                !cost.table.some(([rating]) => rating === offer.max)
              )
                issue(at, "A cost table includes both offer bounds");
            }
          }
          offer.overrides?.forEach((override, overrideIndex) =>
            checkRef(override.when, [...at, "overrides", overrideIndex, "when"], derivedIds, false),
          );
        });
      } else if (step.kind === "allocate") {
        unique(step.groups, [...path, "groups"], "allocation group");
        if (step.priorities && step.priorities.length !== step.groups.length)
          issue([...path, "priorities"], "Priorities need one allotment per group");
        const targets = new Set<string>();
        step.groups.forEach((group, groupIndex) => {
          const at = [...path, "groups", groupIndex];
          if (!!step.priorities === !!group.budget)
            issue(at, "Use exactly one budget mode: priorities or a budget for every group");
          if (group.budget) checkRef(group.budget, [...at, "budget"], derivedIds, false);
          const budget = group.budget?.const;
          if (budget !== undefined && (!Number.isInteger(budget) || budget < 0 || budget > 1200000))
            issue([...at, "budget"], "An allocation budget is a whole number from 0 to 1200000");
          for (const bound of ["base", "min", "max"] as const) {
            const value = group[bound];
            if (typeof value === "object") checkRef(value, [...at, bound], derivedIds, false);
          }
          const constant = (value: number | RulesetValueRef | undefined) =>
            typeof value === "number" ? value : value?.const;
          const min = constant(group.min);
          const max = constant(group.max);
          if (min !== undefined && max !== undefined && min > max) issue(at, "Allocation min exceeds max");
          group.rows?.forEach((row, rowIndex) => {
            const list = sheet.lists.find((each) => each.id === row.list);
            if (!list) issue([...at, "rows", rowIndex, "list"], `Unknown list "${row.list}"`);
            else if (list.columns.find((each) => each.id === row.column)?.type !== "number")
              issue([...at, "rows", rowIndex, "column"], `No number column "${row.column}"`);
          });
          group.targets.forEach((target, targetIndex) => {
            const targetPath = [...at, "targets", targetIndex];
            builderRatingTargetIssues(def, target, targetPath, issue);
            const key = rulesetBuilderRatingKey(target);
            if (targets.has(key)) issue(targetPath, "Allocation groups need distinct, disjoint targets");
            targets.add(key);
            const [low, high] = rulesetBuilderRatingBounds(def, target);
            for (const bound of ["base", "min", "max"] as const) {
              const value = constant(group[bound]);
              if (
                value !== undefined &&
                (!Number.isInteger(value) || value < Math.max(0, low) || value > Math.min(10000, high))
              )
                issue([...at, bound], "Allocation rating is outside the target's bounds or tier map");
            }
          });
        });
      } else if (step.kind === "trained") {
        step.choose?.forEach((choice, choiceIndex) => {
          builderChoiceIssues(def, choice, [...path, "choose", choiceIndex], issue);
          const known = choice.what === "skills" ? skills : saves;
          choice.from?.forEach((id, idIndex) => {
            if (!known.has(id)) {
              issue(
                [...path, "choose", choiceIndex, "from", idIndex],
                `Unknown ${choice.what === "skills" ? "skill" : "save"} "${id}"`,
              );
            }
          });
        });
      } else if (step.kind === "startingGear" && !def.items?.startingGear) {
        issue([...path, "kind"], "This ruleset has no starting gear");
      } else if (step.kind === "choices") {
        const catalog = catalogs.find((each) => each.id === step.catalog);
        if (!catalog || (catalog.holds ?? "rows") !== "rows") {
          issue([...path, "catalog"], `No catalog of rows "${step.catalog}"`);
        }
      }
    });
    builderChoicesIssues(def, issue);
    if (abilitySteps > 1) issue(["sheet", "builder", "steps"], "A builder sets the scores in one step");
    // Creation rules (1.155) read the sheet as it stands and sit on a step's badge.
    unique(sheet.builder.constraints ?? [], ["sheet", "builder", "constraints"], "builder rule");
    sheet.builder.constraints?.forEach((rule, index) => {
      const path = ["sheet", "builder", "constraints", index];
      if (!sheet.builder!.steps.some((step) => step.id === rule.step))
        issue([...path, "step"], `Unknown step "${rule.step}"`);
      if (rule.when) checkRef(rule.when, [...path, "when"], derivedIds, false);
      if (rule.value) checkRef(rule.value, [...path, "value"], derivedIds, false);
      for (const key of ["min", "max"] as const) {
        const bound = rule[key];
        if (bound !== undefined && typeof bound !== "number") checkRef(bound, [...path, key], derivedIds, false);
      }
      const listColumn = (listId: string, columnId: string | undefined, at: (string | number)[]) => {
        const list = listById.get(listId);
        if (!list) {
          issue([...at, "list"], `Unknown list "${listId}"`);
          return undefined;
        }
        if (columnId === undefined) return undefined;
        const column = list.columns.find((each) => each.id === columnId);
        if (!column) issue(at, `Unknown column "${columnId}"`);
        return column;
      };
      if (rule.rows) {
        const filter = rule.rows.filter;
        const column = listColumn(rule.rows.list, filter?.column, [...path, "rows", "filter"]);
        if (filter && (filter.below !== undefined || filter.above !== undefined) && column && column.type !== "number")
          issue([...path, "rows", "filter"], "Only a number column is filtered by below or above");
        if (filter && filter.equals === undefined && filter.below === undefined && filter.above === undefined)
          issue([...path, "rows", "filter"], "A filter names equals, below or above");
        if (rule.rows.sum !== undefined) {
          const sum = listColumn(rule.rows.list, rule.rows.sum, [...path, "rows", "sum"]);
          if (sum && sum.type !== "number") issue([...path, "rows", "sum"], "Only a number column is added up");
        }
      }
      if (rule.distinct) listColumn(rule.distinct.list, rule.distinct.column, [...path, "distinct"]);
      if (rule.approved !== undefined && fieldById.get(rule.approved)?.type !== "boolean")
        issue([...path, "approved"], `No boolean field "${rule.approved}"`);
    });
    if (
      sheet.builder.tier !== undefined &&
      resolution.proficiencyTiers.findIndex((tier) => tier.id === sheet.builder!.tier) < 1
    ) {
      issue(["sheet", "builder", "tier"], `"${sheet.builder.tier}" is not a tier above untrained`);
    }
  }

  // A row pool belongs to a list row and is keyed by that row's name, so it can appear and vanish
  // as the player edits the sheet. A health, energy or slot pool is a declared one only.
  const declaredPool = (pool: string, path: (string | number)[]): void => {
    if (pools.has(pool)) return;
    issue(
      path,
      listById.get(pool)?.pools
        ? `"${pool}" is a list whose rows are pools, not a live pool`
        : `Unknown live pool "${pool}"`,
    );
  };

  /** A list whose catalog-marked rows are read by a fight, and the two columns that filter them.
   *  Shared by `battle.skills` and `combat.abilities`, which gate their rows the same way. */
  const checkRowSource = (
    source: z.infer<typeof battleSkillsSchema>,
    path: (string | number)[],
  ): RulesetList | null => {
    const list = listById.get(source.list);
    if (!list) {
      issue([...path, "list"], `Unknown list "${source.list}"`);
      return null;
    }
    const typeOf = (id: string) => list.columns.find((column) => column.id === id)?.type;
    if (source.onlyWhen && typeOf(source.onlyWhen) !== "boolean") {
      issue([...path, "onlyWhen"], "Must name a boolean column");
    }
    // `alwaysWhen` is the exception to `onlyWhen`. Alone it would gate nothing, which reads like
    // a filter and lets every row through.
    if (source.alwaysWhen && !source.onlyWhen) {
      issue([...path, "alwaysWhen"], "alwaysWhen is the exception to onlyWhen, so it needs onlyWhen beside it");
    }
    if (source.alwaysWhen) {
      const column = list.columns.find((entry) => entry.id === source.alwaysWhen!.column);
      if (!column) {
        issue([...path, "alwaysWhen", "column"], `Unknown column "${source.alwaysWhen.column}"`);
      } else {
        // `equals` must be a value the column can hold, or the rule could never match a row. The
        // same standard `hideWhen` is held to.
        const message = equalsIssue(column, source.alwaysWhen.equals, "column");
        if (message) issue([...path, "alwaysWhen", "equals"], message);
      }
    }
    return list;
  };

  /** A health block: one declared live POOL that counts down, or one WOUND TRACK that is marked.
   *  Returns the track id when it named one, so the rules that only make sense for a track can be
   *  checked against it. Shared by `battle` and `combat`, which mean the same thing by health. */
  const checkHealth = (health: { pool: string } | { track: string }, path: (string | number)[]): string | null => {
    if ("track" in health) {
      if (!tracks.has(health.track)) {
        issue([...path, "track"], `Unknown track "${health.track}"`);
        return null;
      }
      // A plain track is a bounded integer with no levels to fill, so "out of it" would be a number
      // the fight picked rather than one the ruleset declared.
      if (!woundTracks.has(health.track)) {
        issue([...path, "track"], `"${health.track}" has no levels, so a fight has nothing to mark on it`);
        return null;
      }
      return health.track;
    }
    declaredPool(health.pool, [...path, "pool"]);
    // A pool that starts empty counts UP (stress, corruption), so as health it would put every
    // fresh character into their first fight already down.
    if (sheet.live.pools.find((pool) => pool.id === health.pool)?.start === "empty") {
      issue([...path, "pool"], `"${health.pool}" starts empty, so it cannot be the health pool`);
    }
    return null;
  };

  if (def.battle) {
    const battle = def.battle;
    const battlePool = declaredPool;
    checkHealth(battle.health, ["battle", "health"]);
    const battleHealthId = "track" in battle.health ? battle.health.track : battle.health.pool;
    if (battle.energy) {
      battlePool(battle.energy.pool, ["battle", "energy", "pool"]);
      // Health is not spendable as energy: the Engine drains hit points as damage and spends the
      // energy pool as a cost, and one pool cannot be both.
      if (battle.energy.pool === battleHealthId) {
        issue(["battle", "energy", "pool"], "The energy pool cannot also be the health pool");
      }
    }
    const slotLevels = new Set<number>();
    const slotPools = new Set<string>();
    battle.slots?.forEach((slot, index) => {
      const path = ["battle", "slots", index];
      battlePool(slot.pool, [...path, "pool"]);
      if (slot.pool === battleHealthId || slot.pool === battle.energy?.pool) {
        issue([...path, "pool"], `"${slot.pool}" is already the health or energy pool`);
      }
      if (slotPools.has(slot.pool)) issue([...path, "pool"], `Duplicate slot pool "${slot.pool}"`);
      slotPools.add(slot.pool);
      if (slotLevels.has(slot.level)) issue([...path, "level"], `Duplicate slot level ${slot.level}`);
      slotLevels.add(slot.level);
    });
    battle.skills?.forEach((source, index) => {
      checkRowSource(source, ["battle", "skills", index]);
    });
  }

  // Combat. Everything the block names has to exist and be the right sort of thing, because a fight
  // runs on these numbers and a dangling name would be a missing attack bonus in the middle of a
  // turn rather than a message an author can act on.
  if (def.combat) {
    const combat = def.combat;
    const at = (...path: (string | number)[]) => ["combat", ...path];
    const healthTrack = checkHealth(combat.health, at("health"));
    checkRef(combat.defense, at("defense"), derivedIds);
    // Initiative is dice added up with a modifier, or a pool whose successes and a number are it. The
    // pool, and a number attacks move, are a pool fight's.
    const initiative = combat.initiative;
    if ((initiative.dice === undefined) === (initiative.pool === undefined)) {
      issue(at("initiative"), "Initiative is thrown as dice or as a pool: one of the two");
    }
    if (initiative.modifier) {
      checkRef(initiative.modifier, at("initiative", "modifier"), derivedIds);
      if (!initiative.dice)
        issue(at("initiative", "modifier"), "A modifier is added to initiative dice, and there are none");
    }
    if (initiative.pool) checkRef(initiative.pool, at("initiative", "pool"), derivedIds);
    // A check made with one of the sheet's abilities (1.240), and a check thrown twice is dice.
    if (initiative.checkAbility !== undefined) {
      if (!def.sheet.abilities.some((ability) => ability.id === initiative.checkAbility)) {
        issue(at("initiative", "checkAbility"), `Unknown ability "${initiative.checkAbility}"`);
      }
      if (!initiative.dice) {
        issue(at("initiative", "checkAbility"), "Initiative thrown twice is thrown dice, and there are none");
      }
    }
    if (initiative.plus !== undefined && !initiative.pool) {
      issue(at("initiative", "plus"), "plus is added to a pool's successes, and initiative is not a pool");
    }
    if (combat.kind !== "dice-pool") {
      if (initiative.pool) issue(at("initiative", "pool"), 'Initiative thrown as a pool is for a "dice-pool" fight');
      if (initiative.resource)
        issue(at("initiative", "resource"), 'Initiative that attacks move is for a "dice-pool" fight');
    }
    if (initiative.resource) {
      const resource = initiative.resource;
      // The number is a pool's successes, so it is thrown as one; summed dice are an order, not a number of dice.
      if (!initiative.pool) {
        issue(at("initiative", "resource"), "A number attacks move opens as a thrown pool, so initiative needs pool");
      }
      if (initiative.each !== undefined) {
        issue(
          at("initiative", "each"),
          "A number attacks move is kept, never thrown again, and orders every round by itself",
        );
      }
      unique(resource.styles, at("initiative", "resource", "styles"), "style");
      // Whoever has crashed, and every action made of several, attacks in a style that takes.
      if (!resource.styles.some((style) => style.takes)) {
        issue(at("initiative", "resource", "styles"), "At least one style takes: a crashed combatant attacks in one");
      }
      resource.styles.forEach((style, index) => {
        style.spends?.onMiss?.forEach(([, lose], stepIndex) => {
          if (lose < 0) {
            issue(
              at("initiative", "resource", "styles", index, "spends", "onMiss", stepIndex, 1),
              "A miss costs nothing or more",
            );
          }
        });
      });
      const crash = resource.crash;
      if (crash?.condition !== undefined && !conditions.has(crash.condition)) {
        issue(at("initiative", "resource", "crash", "condition"), `Unknown condition "${crash.condition}"`);
      }
      // A spent or recovered number goes back to the base, which would crash it again at once.
      if (crash && resource.base <= crash.at) {
        issue(
          at("initiative", "resource", "base"),
          `The base is what a number goes back to, so it is above ${crash.at}`,
        );
      }
    }
    // Each kind rolls with its own block and never the other's: an attack total needs attack dice,
    // and a pool fight throws the ruleset's own pools, so it has nothing to say about a total.
    // A keep-the-highest ruleset (1.138) has no fight of its own: its checks read one die, which no
    // attack, save or damage roll of a fight is written in. Fights stay with the Game Master.
    if (resolution.kind === "dice-highest" || resolution.kind === "symbol-pool") {
      issue(at("kind"), `A ${resolution.kind} ruleset has no fight of its own, so leave combat out`);
    }
    const pooled = combat.kind === "dice-pool";
    if (pooled) {
      if (resolution.kind !== "dice-pool") {
        issue(at("kind"), 'A "dice-pool" fight throws the ruleset\'s own pools, so resolution.kind is "dice-pool" too');
      }
      if (combat.attackRoll) issue(at("attackRoll"), 'A "dice-pool" fight throws pools, so it rolls no attack dice');
      if (!combat.pool) issue(at("pool"), 'A "dice-pool" fight says how it rolls damage in "pool"');
    } else {
      if (!combat.attackRoll) issue(at("attackRoll"), 'An "attack-vs-defense" fight says what an attack rolls');
      if (combat.pool) issue(at("pool"), '"pool" is for a "dice-pool" fight');
    }
    if (combat.damage?.minimum) {
      checkRef(combat.damage.minimum, at("damage", "minimum"), derivedIds);
      if (!pooled) issue(at("damage", "minimum"), 'Minimum damage dice need a "dice-pool" fight');
      if (combat.damage.minimum.const !== undefined && combat.damage.minimum.const < 0) {
        issue(at("damage", "minimum"), "Minimum damage dice cannot be negative");
      }
    }
    if (combat.daze) {
      checkRef(combat.daze.over, at("daze", "over"), derivedIds);
      if (!pooled) issue(at("daze"), 'Daze needs a "dice-pool" fight');
      if (combat.daze.condition && !conditions.has(combat.daze.condition)) {
        issue(at("daze", "condition"), `Unknown condition "${combat.daze.condition}"`);
      }
    }
    combat.damageKinds?.remap?.forEach((remap, index) => {
      const path = at("damageKinds", "remap", index);
      checkRef(remap.when, [...path, "when"], derivedIds);
      if (!pooled) issue(path, 'Damage kind remaps need a "dice-pool" fight');
      const health = combat.health;
      const kinds =
        "track" in health ? (sheet.live.tracks.find((track) => track.id === health.track)?.kinds ?? []) : [];
      for (const key of ["from", "to"] as const) {
        if (!kinds.some((kind) => kind.id === remap[key]))
          issue([...path, key], `"${remap[key]}" is not a kind of the health track`);
      }
      for (const tag of remap.tags ?? []) {
        if (!def.items?.tags?.some((entry) => entry.id === tag)) issue([...path, "tags"], `Unknown item tag "${tag}"`);
      }
    });
    // The same rule the check dice follow: an extreme face is only a face when one die was thrown.
    const naturals = combat.attackRoll?.naturals;
    if (combat.attackRoll?.criticalFrom) {
      checkRef(combat.attackRoll.criticalFrom, at("attackRoll", "criticalFrom"), derivedIds);
      if (naturals?.max !== "critical" || combat.attackRoll.dice.count !== 1) {
        issue(
          at("attackRoll", "criticalFrom"),
          'A critical range needs a single attack die whose highest face is a critical (naturals.max "critical")',
        );
      }
    }
    if (naturals && combat.attackRoll!.dice.count !== 1 && (naturals.max !== "none" || naturals.min !== "none")) {
      issue(at("attackRoll", "naturals"), "Natural results need a single die; with several dice use none");
    }
    if (combat.pool) {
      const sides = resolution.kind === "dice-pool" ? resolution.die.sides : undefined;
      if (combat.pool.damageTarget !== undefined && sides !== undefined && combat.pool.damageTarget > sides) {
        issue(at("pool", "damageTarget"), `A ${sides}-sided die never reaches ${combat.pool.damageTarget}`);
      }
      const soak = combat.pool.soak;
      if (soak?.all) checkRef(soak.all, at("pool", "soak", "all"), derivedIds);
      if (soak?.byKind) {
        // A kind is a kind of the health track, so soaking by kind needs a track that has kinds.
        const health = combat.health;
        const kinds =
          "track" in health
            ? new Set(
                (sheet.live.tracks.find((track) => track.id === health.track)?.kinds ?? []).map((kind) => kind.id),
              )
            : null;
        for (const [kind, ref] of Object.entries(soak.byKind)) {
          checkRef(ref, at("pool", "soak", "byKind", kind), derivedIds);
          if (!kinds) {
            issue(at("pool", "soak", "byKind", kind), "Soak by kind needs health to be a wound track with kinds");
          } else if (!kinds.has(kind)) {
            issue(at("pool", "soak", "byKind", kind), `"${kind}" is not a kind of the health track`);
          }
        }
      }
      if (soak && !soak.all && !soak.byKind) issue(at("pool", "soak"), "Soak soaks something: all, byKind or both");
      if (combat.pool.hardness) {
        checkRef(combat.pool.hardness, at("pool", "hardness"), derivedIds);
        if (!rulesetSpendsInitiative(combat)) issue(at("pool", "hardness"), HARDNESS_NEEDS_SPENDING);
      }
    }
    // What one combatant may spend of a pool per turn or round: a pool the sheet keeps, once each.
    const limited = new Set<string>();
    combat.spendLimits?.forEach((limit, index) => {
      const path = at("spendLimits", index);
      declaredPool(limit.pool, [...path, "pool"]);
      if (limited.has(limit.pool)) issue([...path, "pool"], `"${limit.pool}" is limited twice`);
      limited.add(limit.pool);
      checkRef(limit.max, [...path, "max"], derivedIds);
    });
    // A pool fight adds dice to a pool, so a condition's rolled number would be a number of dice
    // nobody could throw. Said per modifier, on conditions and on levels alike.
    if (pooled) {
      const diceModifiers = (
        entries: ReadonlyArray<{ modifiers?: Array<{ to: string; dice?: string }> }> | undefined,
        key: "conditions" | "levels",
      ) =>
        entries?.forEach((entry, index) =>
          entry.modifiers?.forEach((modifier, modifierIndex) => {
            if (modifier.dice !== undefined) {
              issue(
                at(key, index, "modifiers", modifierIndex, "dice"),
                'A "dice-pool" fight adds dice to a pool, so a modifier gives a flat number of dice',
              );
            }
          }),
        );
      diceModifiers(combat.conditions, "conditions");
      diceModifiers(combat.levels, "levels");
    }
    const budgets = unique(combat.economy.budgets, at("economy", "budgets"), "budget");
    if (combat.economy.movement) checkRef(combat.economy.movement, at("economy", "movement"), derivedIds);
    for (const [mode, ref] of Object.entries(combat.economy.movementModes ?? {})) {
      if (ref) checkRef(ref, at("economy", "movementModes", mode), derivedIds);
    }
    const checkBudget = (budget: string, path: (string | number)[]) => {
      if (!budgets.has(budget)) issue(path, `Unknown budget "${budget}"`);
    };

    // Everything below means nothing without a cell to measure in, so a ruleset that declares one
    // of them and no `distance` is told here rather than carrying a rule no fight could ever read.
    if (!combat.distance) {
      const needsDistance = (["ranged", "cover", "elevation", "opportunity"] as const).find(
        (key) => combat[key] !== undefined,
      );
      if (needsDistance) {
        issue(at(needsDistance), `"${needsDistance}" is measured in cells, so the block declares "distance" too`);
      }
      combat.attacks?.forEach((source, index) => {
        for (const key of ["reach", "range"] as const) {
          if (source[key] !== undefined) {
            issue(at("attacks", index, key), `"${key}" is measured in cells, so the block declares "distance" too`);
          }
        }
      });
    }
    if (combat.opportunity) checkBudget(combat.opportunity.budget, at("opportunity", "budget"));
    // Readying (1.288): released with a budget the fight has, and held by a concentration it keeps.
    if (combat.readying) {
      checkBudget(combat.readying.budget, at("readying", "budget"));
      if (combat.readying.concentrates && !combat.concentration)
        issue(at("readying", "concentrates"), "A spell held by concentration needs combat.concentration");
    }
    if (combat.offHand) checkBudget(combat.offHand.budget, at("offHand", "budget"));
    if (combat.offHand?.fullWhen) checkRef(combat.offHand.fullWhen, at("offHand", "fullWhen"), derivedIds);

    // Contests: the checks they read, the budget they spend and the conditions they touch all exist,
    // and what they measure in distance needs a cell to measure it in.
    const contestChecks = unique(combat.checks ?? [], at("checks"), "contest check");
    combat.checks?.forEach((check, index) => checkRef(check.value, at("checks", index, "value"), derivedIds));
    unique(combat.contests ?? [], at("contests"), "contest");
    if (combat.standard?.includes("search") && !combat.hiding)
      issue(at("standard"), "Search looks for whoever is hiding, so it needs combat.hiding");
    // The dark (1.294): the senses that see in it are the fight's own, and it needs eyes to keep.
    if (combat.sight?.darkness) {
      const senses = new Set((combat.senses ?? []).map((sense) => sense.id));
      for (const key of ["seeIn", "pierced"] as const) {
        combat.sight.darkness[key]?.forEach((sense, index) => {
          if (!senses.has(sense)) issue(at("sight", "darkness", key, index), `Unknown sense "${sense}"`);
        });
      }
      const switchBudget = combat.sight.darkness.carried?.budget;
      if (switchBudget !== undefined && !combat.economy.budgets.some((budget) => budget.id === switchBudget))
        issue(at("sight", "darkness", "carried", "budget"), `Unknown budget "${switchBudget}"`);
    }
    // Hiding (1.287): the checks it throws are the fight's own, and so are the components it hears.
    if (combat.hiding) {
      for (const key of ["stealth", "perception"] as const) {
        if (!contestChecks.has(combat.hiding[key]))
          issue(at("hiding", key), `Unknown contest check "${combat.hiding[key]}"`);
      }
      const components = new Set((combat.components ?? []).map((component) => component.id));
      combat.hiding.noisy?.forEach((component, index) => {
        if (!components.has(component))
          issue(
            at("hiding", "noisy", index),
            components.size ? `Unknown component "${component}"` : "This ruleset declares no combat components",
          );
      });
    }
    combat.contests?.forEach((contest, index) => {
      const path = at("contests", index);
      const checkId = (id: string, where: (string | number)[]) => {
        if (!contestChecks.has(id)) issue(where, `Unknown contest check "${id}"`);
      };
      const conditionId = (id: string, where: (string | number)[]) => {
        if (!conditions.has(id)) issue(where, `Unknown condition "${id}"`);
      };
      checkBudget(contest.budget, [...path, "budget"]);
      for (const side of ["attacker", "defender"] as const) {
        contest[side]?.checks.forEach((id, checkIndex) => {
          checkId(id, [...path, side, "checks", checkIndex]);
          if (contest[side]!.checks.indexOf(id) !== checkIndex) {
            issue([...path, side, "checks", checkIndex], `Duplicate check "${id}"`);
          }
        });
      }
      if (contest.from) conditionId(contest.from.holding, [...path, "from", "holding"]);
      if (contest.targetHolds) conditionId(contest.targetHolds, [...path, "targetHolds"]);
      // A fixed number is met on the fight's own dice, which a pool fight does not add up (1.193).
      if (contest.difficulty !== undefined && resolution.kind === "dice-pool") {
        issue(
          [...path, "difficulty"],
          "A pool fight counts successes, so a contest there is rolled against a defender",
        );
      }
      if (contest.maxSizeAbove !== undefined && !combat.sizes) {
        issue([...path, "maxSizeAbove"], '"maxSizeAbove" reads sizes, so the block declares "sizes" too');
      }
      contest.onWin.applies?.forEach((entry, entryIndex) => {
        conditionId(entry.condition, [...path, "onWin", "applies", entryIndex, "condition"]);
        // Breaking free of something and putting it on in the same breath says nothing a fight can do.
        if (contest.from && entry.condition === contest.from.holding) {
          issue(
            [...path, "onWin", "applies", entryIndex, "condition"],
            `A contest that breaks free of "${entry.condition}" cannot also apply it`,
          );
        }
      });
      contest.onWin.ends?.forEach((entry, entryIndex) =>
        conditionId(entry.condition, [...path, "onWin", "ends", entryIndex, "condition"]),
      );
      if (!combat.distance) {
        if (contest.reach !== undefined) {
          issue([...path, "reach"], '"reach" is measured in cells, so the block declares "distance" too');
        }
        if (contest.onWin.push !== undefined) {
          issue([...path, "onWin", "push"], '"push" is measured in cells, so the block declares "distance" too');
        }
      }
    });

    if (combat.sizes) {
      const sizeIds = unique(combat.sizes.order, at("sizes", "order"), "size");
      if (combat.sizes.default !== undefined && !sizeIds.has(combat.sizes.default)) {
        issue(at("sizes", "default"), `Unknown size "${combat.sizes.default}"`);
      }
      if (combat.sizes.sheet) checkRef(combat.sizes.sheet, at("sizes", "sheet"), derivedIds);
    }

    // Senses that see in the dark (1.178): unique, each read off a number on the sheet, and reaching
    // a distance that is only ever measured on a board.
    if (combat.components) unique(combat.components, at("components"), "component");
    if (combat.senses) {
      unique(combat.senses, at("senses"), "sense");
      combat.senses.forEach((sense, index) => {
        if (sense.sheet) checkRef(sense.sheet, at("senses", index, "sheet"), derivedIds);
      });
      if (!combat.distance) issue(at("senses"), 'A sense reaches a distance, so the block declares "distance" too');
    }

    if (combat.creatureTypes) {
      const kinds = combat.creatureTypes;
      const typeIds = unique(kinds.types, at("creatureTypes", "types"), "creature type");
      if (kinds.tags) unique(kinds.tags, at("creatureTypes", "tags"), "creature tag");
      if (kinds.default !== undefined && !typeIds.has(kinds.default)) {
        issue(at("creatureTypes", "default"), `Unknown creature type "${kinds.default}"`);
      }
      if (kinds.field !== undefined) {
        const field = sheet.fields.find((one) => one.id === kinds.field);
        if (!field) issue(at("creatureTypes", "field"), `Unknown field "${kinds.field}"`);
        else if (field.type !== "text" && field.type !== "enum") {
          issue(
            at("creatureTypes", "field"),
            `A character's type is read off a text or choice field, not "${field.type}"`,
          );
        }
      }
    }

    combat.attacks?.forEach((source, index) => {
      const path = at("attacks", index);
      checkBudget(source.budget, [...path, "budget"]);
      if (source.strikes) {
        checkRef(source.strikes, [...path, "strikes"], derivedIds);
        // A number written down can be read now. One that comes off a sheet is the player's, and a
        // row that says less than one strike is read as the one strike every spend already buys.
        if (source.strikes.const !== undefined && source.strikes.const < 1) {
          issue([...path, "strikes", "const"], "One spend buys at least one strike");
        }
      } else if (source.strikesCappedBy) {
        // A list that buys one strike a spend already holds every row to one, so a cap there is an
        // author saying something the fight could never read.
        issue(
          [...path, "strikesCappedBy"],
          "strikesCappedBy holds a row to one strike, and this list buys one strike a spend anyway",
        );
      }
      const list = listById.get(source.list);
      if (!list) return issue([...path, "list"], `Unknown list "${source.list}"`);
      const typeOf = (id: string) => list.columns.find((column) => column.id === id)?.type;
      /** One column of the attack row, held to the type the fight has to read out of it. */
      const column = (id: string | undefined, want: RulesetListColumn["type"] | "name", where: (string | number)[]) => {
        if (id === undefined) return;
        const type = typeOf(id);
        if (type === undefined) return issue(where, `Unknown column "${id}"`);
        if (want === "name") {
          if (type !== "text") issue(where, "Must name a text column");
        } else if (type !== want) issue(where, `Must name a ${want} column`);
      };
      column(source.name, "name", [...path, "name"]);
      // Rows every sheet has (1.244): in the list's own columns, each with a name to go by.
      source.always?.forEach((row, rowIndex) => {
        for (const key of Object.keys(row)) {
          if (typeOf(key) === undefined) issue([...path, "always", rowIndex, key], `Unknown column "${key}"`);
        }
        const name = row[source.name];
        if (typeof name !== "string" || !name.trim()) {
          issue([...path, "always", rowIndex, source.name], "A row every sheet has is named");
        }
      });
      // An ability column is an enum of ability ids; a value that is not one adds nothing, exactly
      // as `abilityModFromField` reads one.
      column(source.toHit.ability?.column, "enum", [...path, "toHit", "ability", "column"]);
      column(source.toHit.skill?.column, "enum", [...path, "toHit", "skill", "column"]);
      column(source.strikesCappedBy?.column, "boolean", [...path, "strikesCappedBy", "column"]);
      column(source.toHit.proficiency?.column, "boolean", [...path, "toHit", "proficiency", "column"]);
      column(source.toHit.bonus?.column, "number", [...path, "toHit", "bonus", "column"]);
      column(source.damage.dice.column, "dice", [...path, "damage", "dice", "column"]);
      column(source.damage.ability?.column, "enum", [...path, "damage", "ability", "column"]);
      column(source.damage.bonus?.column, "number", [...path, "damage", "bonus", "column"]);
      // A distance is a number, wherever it is read from: one column of this list, or the same
      // number on every row of it.
      const distance = (source: RulesetCombatDistanceSource | undefined, where: (string | number)[]) => {
        if (source && "column" in source) column(source.column, "number", [...where, "column"]);
      };
      distance(source.reach, [...path, "reach"]);
      distance(source.range?.normal, [...path, "range", "normal"]);
      distance(source.range?.long, [...path, "range", "long"]);
      // Two numbers that are both written down can be compared now. Two columns cannot, because the
      // rows are the player's; a row whose long distance is shorter is read as the ordinary one.
      const normal = source.range?.normal;
      const long = source.range?.long;
      if (normal && long && "const" in normal && "const" in long && long.const < normal.const) {
        issue([...path, "range", "long"], "The long distance is at least the ordinary one");
      }
      const typeColumn = source.damage.type?.column;
      if (typeColumn !== undefined) {
        const type = typeOf(typeColumn);
        if (type === undefined) issue([...path, "damage", "type", "column"], `Unknown column "${typeColumn}"`);
        else if (type !== "text" && type !== "enum") {
          issue([...path, "damage", "type", "column"], "Must name a text or enum column");
        }
      }
    });

    combat.abilities?.forEach((source, index) => {
      const path = at("abilities", index);
      checkBudget(source.budget, [...path, "budget"]);
      checkRowSource(source, path);
      if (source.toHit) checkRef(source.toHit, [...path, "toHit"], derivedIds);
      if (source.saveDifficulty) checkRef(source.saveDifficulty, [...path, "saveDifficulty"], derivedIds);
      if (source.byColumn) {
        if (
          !sheet.lists
            .find((list) => list.id === source.list)
            ?.columns.some((column) => column.id === source.byColumn!.column)
        ) {
          issue([...path, "byColumn", "column"], `Unknown column "${source.byColumn.column}"`);
        }
        for (const [value, refs] of Object.entries(source.byColumn.values)) {
          if (refs.toHit) checkRef(refs.toHit, [...path, "byColumn", "values", value, "toHit"], derivedIds);
          if (refs.saveDifficulty)
            checkRef(refs.saveDifficulty, [...path, "byColumn", "values", value, "saveDifficulty"], derivedIds);
        }
      }
    });

    const standard = new Set<string>();
    combat.standard?.forEach((action, index) => {
      if (standard.has(action)) issue(at("standard", index), `Duplicate standard action "${action}"`);
      standard.add(action);
    });
    // A part of a standard action nobody can take says nothing, and a save the sheet never declared
    // cannot be rolled with advantage.
    if (combat.standardEffects?.dodge) {
      if (!standard.has("dodge")) {
        issue(at("standardEffects", "dodge"), "This ruleset has no dodge for these saves to belong to");
      }
      combat.standardEffects.dodge.saves.forEach((save, index) => {
        if (!saves.has(save)) issue(at("standardEffects", "dodge", "saves", index), `Unknown save "${save}"`);
      });
    }
    combat.cover?.saves?.forEach((save, index) => {
      if (!saves.has(save)) issue(at("cover", "saves", index), `Unknown save "${save}"`);
    });
    const prone = combat.elevation?.falling?.prone;
    if (prone !== undefined && !conditions.has(prone)) {
      issue(at("elevation", "falling", "prone"), `Unknown condition "${prone}"`);
    }
    // A fall's harm is one of the ruleset's kinds, as every other harm is, or it misses what resists it.
    const fallType = combat.elevation?.falling?.type;
    if (
      fallType !== undefined &&
      combat.damageTypes &&
      !combat.damageTypes.some((type) => type.trim().toLowerCase() === fallType.trim().toLowerCase())
    ) {
      issue(at("elevation", "falling", "type"), `Unknown damage type "${fallType}"`);
    }
    // And thrown as any harm is: a pool fight counts successes on its own die, so a fall's die is that one.
    const fallDie = combat.elevation?.falling?.dice.sides;
    const poolDie = def.resolution.kind === "dice-pool" ? def.resolution.die.sides : undefined;
    if (fallDie !== undefined && poolDie !== undefined && fallDie !== poolDie) {
      issue(
        at("elevation", "falling", "dice", "sides"),
        `A "dice-pool" fight throws d${poolDie}s, so a fall's dice are d${poolDie}s`,
      );
    }

    combat.sheetHides?.forEach((source, index) => {
      const path = at("sheetHides", index);
      const list = sheet.lists.find((entry) => entry.id === source.list);
      if (!list) issue([...path, "list"], `Unknown list "${source.list}"`);
      const column = list?.columns.find((entry) => entry.id === source.column);
      if (!column || (column.type !== "text" && column.type !== "enum")) {
        issue([...path, "column"], "A sheet hide reads a text or enum column of its list");
      } else if (source.kind === "conditionImmunities" && column.type === "enum") {
        column.values.forEach((value) => {
          if (!conditions.has(value.trim().toLowerCase())) issue([...path, "column"], `Unknown condition "${value}"`);
        });
      }
    });

    const mapped = new Set<string>();
    combat.conditions?.forEach((entry, index) => {
      const path = at("conditions", index);
      if (!conditions.has(entry.condition)) issue([...path, "condition"], `Unknown condition "${entry.condition}"`);
      if (mapped.has(entry.condition)) issue([...path, "condition"], `Duplicate condition "${entry.condition}"`);
      mapped.add(entry.condition);
      entry.kinds?.forEach((kind, kindIndex) => {
        if (conditions.has(kind)) issue([...path, "kinds", kindIndex], `"${kind}" is a condition, so it is no kind`);
      });
      // A rest it names is one the ruleset has, and the maximum it lowers is health's in points (1.260).
      entry.onRest?.rests.forEach((rest, restIndex) => {
        if (!def.rests.some((one) => one.id === rest))
          issue([...path, "onRest", "rests", restIndex], `Unknown rest "${rest}"`);
      });
      if (entry.onRest?.save && !def.sheet.saves.some((one) => one.id === entry.onRest!.save!.save))
        issue([...path, "onRest", "save", "save"], `Unknown save "${entry.onRest.save.save}"`);
      if (entry.onRest?.save && def.resolution.kind !== "dice-sum")
        issue([...path, "onRest", "save"], "A save on a rest is rolled only where checks are a dice sum");
      if (entry.onRest && "track" in combat.health) {
        issue([...path, "onRest"], "Only health kept in points has a maximum to lower");
      }
      effectNameIssues(entry, skills, saves, abilityIds, def, path, issue);
      hideIssues(def, entry, path, issue);
      // Kept off by who puts them on (1.191): the ruleset's own conditions, from creatures it names.
      entry.conditionImmunitiesFrom?.forEach((ward, wardIndex) => {
        const where = [...path, "conditionImmunitiesFrom", wardIndex];
        ward.conditions.forEach((condition, conditionIndex) => {
          if (!conditions.has(condition))
            issue([...where, "conditions", conditionIndex], `Unknown condition "${condition}"`);
        });
        targetIsIssues(def, ward.from, [...where, "from"], issue);
      });
      // What it harms with is one of the ruleset's damage types (1.189).
      const harmType = entry.harms?.type;
      const damageTypes = combat.damageTypes?.map((type) => type.trim().toLowerCase());
      if (harmType && damageTypes && !damageTypes.includes(harmType.trim().toLowerCase())) {
        issue([...path, "harms", "type"], `Unknown damage type "${harmType}"`);
      }
      // What it deals as it ends (1.245): a damage type of the ruleset's, spared what it names.
      const endType = entry.onEnd?.harm?.type;
      if (endType && damageTypes && !damageTypes.includes(endType.trim().toLowerCase())) {
        issue([...path, "onEnd", "harm", "type"], `Unknown damage type "${endType}"`);
      }
      targetIsIssues(def, entry.onEnd?.harm?.unless, [...path, "onEnd", "harm", "unless"], issue);
      // Temporary points each turn (1.274) need health with a buffer to hold them.
      if (entry.temporary && "track" in combat.health) {
        issue(
          [...path, "temporary"],
          `Health is the wound track "${combat.health.track}", which carries no buffer for temporary points`,
        );
      }
      if (entry.unseen) sightIssues(def, entry.unseen.pierced, [...path, "unseen"], issue);
      senseRangeIssues(def, entry.senses, path, issue);
      if (entry.light && !combat.sight?.darkness)
        issue([...path, "light"], "Light is read where combat.sight.darkness makes the dark real");
      componentIssues(def, entry.forbids?.components, [...path, "forbids", "components"], issue);
      // The action economy it changes (1.76) is the ruleset's own: budgets it declares, conditions it has.
      entry.budgets?.forEach((change, changeIndex) => {
        const where = [...path, "budgets", changeIndex, "budget"];
        checkBudget(change.budget, where);
        // A turn's count is what a condition changes, as each turn begins; a budget that refills by the
        // round has no turn to change it at.
        const declared = combat.economy.budgets.find((budget) => budget.id === change.budget);
        if (declared && declared.per !== "turn") issue(where, `"${change.budget}" refills per round, not per turn`);
      });
      if (entry.grants) {
        const grants = entry.grants;
        checkBudget(grants.budget, [...path, "grants", "budget"]);
        // The checks a catalog's standard-action permission gets: actions this ruleset has, and not on
        // the budget every standard action is already taken with.
        if (grants.standard && grants.budget === combat.economy.budgets[0]?.id) {
          issue(
            [...path, "grants", "budget"],
            `Every standard action is already taken for "${grants.budget}", so this grant gives nothing`,
          );
        }
        grants.standard?.forEach((action, actionIndex) => {
          if (!(combat.standard ?? []).includes(action)) {
            issue(
              [...path, "grants", "standard", actionIndex],
              `This ruleset does not have the standard action "${action}"`,
            );
          }
        });
        if (typeof grants.items === "object") {
          const itemTags = new Set((def.items?.tags ?? []).map((tag) => tag.id));
          grants.items.tags.forEach((tag, tagIndex) => {
            if (!itemTags.has(tag)) issue([...path, "grants", "items", "tags", tagIndex], `Unknown item tag "${tag}"`);
          });
        }
      }
      entry.exclusive?.forEach((budget, budgetIndex) => checkBudget(budget, [...path, "exclusive", budgetIndex]));
      entry.onEnd?.tracks?.forEach((moved, movedIndex) => {
        const track = def.sheet.live.tracks.find((one) => one.id === moved.track);
        if (!track) issue([...path, "onEnd", "tracks", movedIndex, "track"], `Unknown track "${moved.track}"`);
        else if (track.kinds) {
          issue([...path, "onEnd", "tracks", movedIndex, "track"], "A wound track is marked, not moved by levels");
        }
      });
      entry.auras?.forEach((aura, auraIndex) => {
        const at = [...path, "auras", auraIndex];
        aura.conditions?.forEach((spread, spreadIndex) => {
          if (!conditions.has(spread)) issue([...at, "conditions", spreadIndex], `Unknown condition "${spread}"`);
          else if (spread === entry.condition)
            issue([...at, "conditions", spreadIndex], "A condition does not spread itself");
          else if (combat.conditions?.some((other) => other.condition === spread && other.auras))
            issue([...at, "conditions", spreadIndex], "What an aura spreads has no aura of its own");
        });
        if (aura.self && aura.side === "enemies")
          issue([...at, "self"], 'Its holder is no enemy of their own: "self" goes with "allies" or "all"');
        if (aura.save) {
          if (!def.sheet.saves.some((one) => one.id === aura.save!.save))
            issue([...at, "save", "save"], `Unknown save "${aura.save.save}"`);
          aura.save.applies.forEach((applied, appliedIndex) => {
            if (!conditions.has(applied.condition))
              issue([...at, "save", "applies", appliedIndex, "condition"], `Unknown condition "${applied.condition}"`);
          });
          aura.save.failedBy?.applies.forEach((applied, appliedIndex) => {
            if (!conditions.has(applied.condition))
              issue(
                [...at, "save", "failedBy", "applies", appliedIndex, "condition"],
                `Unknown condition "${applied.condition}"`,
              );
          });
        }
        if (aura.chosenKind && !combat.creatureTypes)
          issue([...at, "chosenKind"], "This ruleset has no creature types to choose from");
        aura.sourcesOf?.forEach((held, heldIndex) => {
          if (!conditions.has(held)) issue([...at, "sourcesOf", heldIndex], `Unknown condition "${held}"`);
        });
        targetIsIssues(def, aura.targetTypes?.is, [...at, "targetTypes", "is"], issue);
        targetIsIssues(def, aura.targetTypes?.not, [...at, "targetTypes", "not"], issue);
        if (aura.when) {
          const names = rulesetSheetNames(def.sheet, def.items);
          for (const found of rulesetValueRefIssues(aura.when.value, names, names.derived)) {
            issue([...at, "when", "value", found.key], found.message);
          }
        }
      });
      for (const key of ["only", "onlyWhenStuck"] as const) {
        const named = entry.behavior?.[key];
        (Array.isArray(named) ? named : []).forEach((named, namedIndex) => {
          if (named === "move" || named === "escape") return;
          if (!combat.standard?.includes(named as never))
            issue([...path, "behavior", key, namedIndex], `This ruleset has no standard action "${named}"`);
        });
      }
      const drops = entry.behavior?.drops;
      if (drops) {
        const at = [...path, "behavior", "drops"];
        const slots = new Set((def.items?.slots ?? []).map((slot) => slot.id));
        const tags = new Set((def.items?.tags ?? []).map((tag) => tag.id));
        drops.slots?.forEach((slot, slotIndex) => {
          if (!slots.has(slot)) issue([...at, "slots", slotIndex], `Unknown slot "${slot}"`);
        });
        drops.tags?.forEach((tag, tagIndex) => {
          if (!tags.has(tag)) issue([...at, "tags", tagIndex], `Unknown item tag "${tag}"`);
        });
        if (drops.pickUp !== undefined && !combat.economy.budgets.some((budget) => budget.id === drops.pickUp))
          issue([...at, "pickUp"], `Unknown budget "${drops.pickUp}"`);
      }
      if (entry.expires) {
        if (!conditions.has(entry.expires.becomes))
          issue([...path, "expires", "becomes"], `Unknown condition "${entry.expires.becomes}"`);
        else if (entry.expires.becomes === entry.condition)
          issue([...path, "expires", "becomes"], "A condition does not turn into itself");
      }
      entry.curedOnlyBy?.catalogs?.forEach((catalogId, catalogIndex) => {
        if (!def.catalogs?.some((catalog) => catalog.id === catalogId))
          issue([...path, "curedOnlyBy", "catalogs", catalogIndex], `Unknown catalog "${catalogId}"`);
      });
      entry.onDamaged?.applies.forEach((applied, appliedIndex) => {
        const at = [...path, "onDamaged", "applies", appliedIndex];
        if (!conditions.has(applied.condition)) issue([...at, "condition"], `Unknown condition "${applied.condition}"`);
        else if (applied.condition === entry.condition)
          issue([...at, "condition"], "A condition does not put itself on");
        if (applied.when) issue([...at, "when"], 'What damage puts on has no sheet to read "when" off');
      });
      entry.onEnd?.applies?.forEach((applied, appliedIndex) => {
        if (!conditions.has(applied.condition)) {
          issue([...path, "onEnd", "applies", appliedIndex, "condition"], `Unknown condition "${applied.condition}"`);
        }
        // What a condition leaves behind is nobody's doing: there is no applier's sheet to read.
        if (applied.when) {
          issue(
            [...path, "onEnd", "applies", appliedIndex, "when"],
            'What a condition leaves behind has no sheet to read "when" off',
          );
        }
      });
      if (entry.shakeOff) checkBudget(entry.shakeOff.budget, [...path, "shakeOff", "budget"]);
      if (entry.delays) {
        checkBudget(entry.delays.budget, [...path, "delays", "budget"]);
        entry.delays.catalogs.forEach((catalogId, catalogIndex) => {
          if (!def.catalogs?.some((catalog) => catalog.id === catalogId)) {
            issue([...path, "delays", "catalogs", catalogIndex], `Unknown catalog "${catalogId}"`);
          }
        });
      }
      entry.noDamageFrom?.forEach((ref, refIndex) => {
        const catalogId = ref.slice(0, ref.indexOf("/"));
        if (!def.catalogs?.some((catalog) => catalog.id === catalogId)) {
          issue([...path, "noDamageFrom", refIndex], `Unknown catalog "${catalogId}"`);
        }
      });
      // What moves or lifts it is a budget of the fight's, and what breaks it the ruleset's own (1.314).
      if (entry.sealed?.rolls) checkBudget(entry.sealed.rolls.budget, [...path, "sealed", "rolls", "budget"]);
      if (entry.sealed?.lifted) checkBudget(entry.sealed.lifted.budget, [...path, "sealed", "lifted", "budget"]);
      entry.sealed?.brokenBy?.forEach((ref, refIndex) => {
        const catalogId = ref.slice(0, ref.indexOf("/"));
        if (!def.catalogs?.some((catalog) => catalog.id === catalogId)) {
          issue([...path, "sealed", "brokenBy", refIndex], `Unknown catalog "${catalogId}"`);
        }
      });
      entry.actions?.forEach((ref, refIndex) => {
        const catalogId = ref.slice(0, ref.indexOf("/"));
        if (!def.catalogs?.some((catalog) => catalog.id === catalogId)) {
          issue([...path, "actions", refIndex], `Unknown catalog "${catalogId}"`);
        }
      });
      if (entry.size && !combat.sizes) {
        issue([...path, "size"], "A condition that changes size needs combat.sizes");
      }
      entry.endsWhenHarmedFrom?.forEach((catalogId, catalogIndex) => {
        if (!def.catalogs?.some((catalog) => catalog.id === catalogId)) {
          issue([...path, "endsWhenHarmedFrom", catalogIndex], `Unknown catalog "${catalogId}"`);
        }
      });
      entry.suppresses?.forEach((held, heldIndex) => {
        if (!conditions.has(held)) issue([...path, "suppresses", heldIndex], `Unknown condition "${held}"`);
      });
      // Gating an effect this condition does not have says nothing, and is nearly always a typo for
      // one it does.
      if (Array.isArray(entry.whileSourceInSight)) {
        entry.whileSourceInSight.forEach((effect, effectIndex) => {
          if (!entry.effects.includes(effect)) {
            issue(
              [...path, "whileSourceInSight", effectIndex],
              `This condition does not have the effect "${effect}" to gate`,
            );
          }
        });
      }
    });

    // A level reads a plain track by its number, or a derived value. A wound track is marked with
    // kinds rather than counted, so no rung of one could be read this way.
    const levelled = new Set<string>();
    combat.levels?.forEach((entry, index) => {
      const path = at("levels", index);
      const read = entry.track ?? entry.derived ?? "";
      if (entry.derived !== undefined) {
        if (!derivedIds.has(entry.derived)) issue([...path, "derived"], `Unknown derived value "${entry.derived}"`);
      } else if (!tracks.has(read)) issue([...path, "track"], `Unknown track "${read}"`);
      else if (woundTracks.has(read)) {
        issue([...path, "track"], `"${read}" is a wound track; a level reads a plain track's number`);
      } else {
        // A level above a fixed top is never reached, which is nearly always a typo for one that is.
        const top = sheet.live.tracks.find((track) => track.id === read)!.max;
        if (typeof top === "number" && entry.at > top) {
          issue([...path, "at"], `"${read}" goes up to ${top}, so level ${entry.at} is never reached`);
        }
      }
      // A track and a derived value may share an id; their levels are not the same level.
      const key = `${entry.derived !== undefined ? "derived" : "track"}:${read}@${entry.at}`;
      if (levelled.has(key)) issue([...path, "at"], `Level ${entry.at} of "${read}" is given twice`);
      levelled.add(key);
      effectNameIssues(entry, skills, saves, abilityIds, def, path, issue);
      hideIssues(def, entry, path, issue);
    });

    if (combat.concentration) {
      if (!liveText.has(combat.concentration.text)) {
        issue(at("concentration", "text"), `Unknown live text "${combat.concentration.text}"`);
      }
      if (!saves.has(combat.concentration.save)) {
        issue(at("concentration", "save"), `Unknown save "${combat.concentration.save}"`);
      }
    }

    if (combat.dying) {
      const dying = combat.dying;
      for (const key of ["successes", "failures"] as const) {
        if (!tracks.has(dying[key])) issue(at("dying", key), `Unknown track "${dying[key]}"`);
        // These two count rolls, and the fight sets them by number. A wound track is marked with
        // kinds instead, so it could never hold a count of successful death saves.
        else if (woundTracks.has(dying[key]))
          issue(at("dying", key), `"${dying[key]}" is a wound track, not a counter`);
        else {
          // Every fight counts to this track's top, so the top is the rules' own number with room to
          // count in, and the track is always on the sheet. A top the sheet works out could come to
          // nothing for one character, and a hidden track reads as nothing at all: either way one
          // roll would settle a death save that the rules say takes several.
          const track = sheet.live.tracks.find((entry) => entry.id === dying[key])!;
          if (typeof track.max !== "number") {
            issue(
              at("dying", key),
              `"${dying[key]}" counts death saves, so its max is a number rather than the sheet's`,
            );
          } else if (track.max <= track.min || track.max < 1) {
            // Room to count, and at least one to count to: a top of 0 is reached by the first roll
            // whatever the floor under it.
            issue(at("dying", key), `"${dying[key]}" counts death saves, so its max is at least 1 and above its min`);
          }
          if (track.hideWhen) issue(at("dying", key), `"${dying[key]}" counts death saves, so it cannot be hidden`);
        }
      }
      if (dying.successes === dying.failures) {
        issue(at("dying", "failures"), "Successes and failures are counted on two different tracks");
      }
      if (dying.condition !== undefined && !conditions.has(dying.condition)) {
        issue(at("dying", "condition"), `Unknown condition "${dying.condition}"`);
      }
      // The same rule the attack roll has: a natural result is one face of one die.
      if (dying.dice.count !== 1 && (dying.naturals.max !== "none" || dying.naturals.min !== "none")) {
        issue(at("dying", "naturals"), "Natural results need a single die; with several dice use none");
      }
    }

    const damageTypes = new Set<string>();
    combat.damageTypes?.forEach((type, index) => {
      // Trimmed as well as lowered, which is how a creature's resistances and a fight's own lookup
      // read a type: a declaration written with a stray space would otherwise be a type nothing
      // could name, including the block's own `damageKinds.byType`.
      const key = type.trim().toLowerCase();
      if (damageTypes.has(key)) issue(at("damageTypes", index), `Duplicate damage type "${type}"`);
      damageTypes.add(key);
    });

    // How a fight's damage type becomes a mark. Only a wound track has kinds, so the mapping and
    // the track go together in both directions: without it a fight would have to guess what kind
    // of harm a blow is, and with a pool there is nothing for it to say.
    if (healthTrack) {
      const kinds = new Set(
        (sheet.live.tracks.find((track) => track.id === healthTrack)?.kinds ?? []).map((kind) => kind.id),
      );
      if (!combat.damageKinds) {
        issue(
          at("damageKinds"),
          `Health is the wound track "${healthTrack}", so the block says what kind of harm its damage is`,
        );
      } else {
        if (!kinds.has(combat.damageKinds.default)) {
          issue(at("damageKinds", "default"), `"${combat.damageKinds.default}" is not a kind of "${healthTrack}"`);
        }
        // A damage type is matched without case, so "Fire" and "fire" are one type here as they are
        // everywhere else. Two keys that say the same type would map one blow onto two kinds of
        // harm, and whichever won would be whichever the file happened to list second.
        const mapped = new Set<string>();
        for (const [type, kind] of Object.entries(combat.damageKinds.byType ?? {})) {
          const wanted = type.trim().toLowerCase();
          if (mapped.has(wanted)) issue(at("damageKinds", "byType", type), `Duplicate damage type "${type}"`);
          mapped.add(wanted);
          // Only checked where the ruleset says what its types are, exactly as a creature's
          // resistances are: one that declares none reads a type as free text.
          if (damageTypes.size > 0 && !damageTypes.has(wanted)) {
            issue(at("damageKinds", "byType", type), `Unknown damage type "${type}"`);
          }
          if (!kinds.has(kind)) {
            issue(at("damageKinds", "byType", type), `"${kind}" is not a kind of "${healthTrack}"`);
          }
        }
      }
    } else if ("pool" in combat.health && combat.damageKinds) {
      // Only when health really IS a pool. `checkHealth` also answers null for a track it could not
      // read at all, and that file has already been told what is wrong with the track; telling its
      // author to point health at a wound track, which is what they did, would send them looking in
      // the wrong place.
      issue(
        at("damageKinds"),
        "damageKinds maps damage onto a wound track's kinds, and health is a pool, which has nowhere to keep one: point health at a wound track if what KIND a wound was still matters after the blow",
      );
    }

    if (combat.threat) {
      unique(combat.threat.tiers, at("threat", "tiers"), "threat tier");
      combat.threat.tiers.forEach((tier, index) => {
        for (const key of ["health", "damagePerRound"] as const) {
          if (tier[key][0] > tier[key][1])
            issue(at("threat", "tiers", index, key, 0), "The lowest is above the highest");
        }
      });
    }
  }

  // Layers. Every effect is checked against the thing it narrows, because a layer that named
  // something the ruleset does not have would leave a toggle in the wizard that changes nothing.
  const layers = def.layers ?? [];
  const layerIds = unique(layers, ["layers"], "layer");
  const catalogById = new Map(catalogs.map((catalog) => [catalog.id, catalog]));
  layers.forEach((layer, index) => {
    const path = ["layers", index];
    layer.conflicts?.forEach((other, conflictIndex) => {
      const at = [...path, "conflicts", conflictIndex];
      if (other === layer.id) issue(at, "A layer cannot conflict with itself");
      else if (!layerIds.has(other)) issue(at, `Unknown layer "${other}"`);
    });

    if (!layersApplied) {
      unique(layer.fields ?? [], [...path, "fields"], "narrowed field");
      layer.fields?.forEach((entry, fieldIndex) => {
        const at = [...path, "fields", fieldIndex];
        const field = fieldById.get(entry.id);
        if (!field) return issue([...at, "id"], `Unknown field "${entry.id}"`);
        if (field.type !== "enum") return issue([...at, "id"], `Field "${entry.id}" is not an enum`);
        entry.removeValues.forEach((value, valueIndex) => {
          if (!field.values.includes(value)) {
            issue([...at, "removeValues", valueIndex], `"${value}" is not one of the values of "${entry.id}"`);
          }
        });
        // Something on the sheet shows or hides on one of this field's values. With that value gone
        // the rule could never match again, the layered ruleset would not validate, and the layer
        // would be skipped in play with nobody told. Said here, while the author is looking.
        const watched = [
          ...sheet.fields,
          ...sheet.derived,
          ...sheet.lists,
          ...sheet.live.pools,
          ...sheet.live.tracks,
          ...sheet.live.states,
        ].flatMap((item) => (item.hideWhen?.field === entry.id ? [item] : []));
        entry.removeValues.forEach((value, valueIndex) => {
          const user = watched.find((item) => rulesetHideWhenValues(item.hideWhen!).includes(value));
          if (user) {
            issue(
              [...at, "removeValues", valueIndex],
              user.hideWhen!.notEquals === undefined
                ? `"${user.id}" is hidden when "${entry.id}" is "${value}", so a layer cannot remove that value`
                : `"${user.id}" is shown only when "${entry.id}" is "${value}", so a layer cannot remove that value`,
            );
          }
        });
        const remaining = field.values.filter((value) => !entry.removeValues.includes(value));
        if (remaining.length === 0) {
          return issue([...at, "removeValues"], `A layer must leave "${entry.id}" at least one value`);
        }
        // A field whose default is gone would open every sheet on a value the field no longer
        // lists, so the layer either keeps the default or names one that survives it.
        if (entry.default !== undefined) {
          if (!remaining.includes(entry.default)) {
            issue([...at, "default"], `default "${entry.default}" is not one of the values this layer leaves`);
          }
        } else if (field.default !== undefined && !remaining.includes(field.default)) {
          issue(
            [...at, "removeValues"],
            `Removing "${field.default}" takes the default of "${entry.id}" away; name a new default`,
          );
        }
      });
    }

    if (layer.difficultyLadder) checkDifficultyLadder(layer.difficultyLadder, [...path, "difficultyLadder"]);

    if (layer.currencies) {
      const families = def.items?.currencies ?? [];
      const gone = new Set(layer.currencies.removeFamilies ?? []);
      layer.currencies.removeFamilies?.forEach((id, familyIndex) => {
        if (!families.some((family) => family.id === id)) {
          issue([...path, "currencies", "removeFamilies", familyIndex], `Unknown currency "${id}"`);
        }
      });
      layer.currencies.removeUnits?.forEach((id, unitIndex) => {
        const at = [...path, "currencies", "removeUnits", unitIndex];
        const family = families.find((each) => each.units.some((unit) => unit.id === id));
        if (!family) return issue(at, `Unknown currency unit "${id}"`);
        // Every coin's value counts the smallest, so without it nothing could be paid or given in change.
        if (family.units.find((unit) => unit.id === id)!.value === 1 && !gone.has(family.id)) {
          issue(at, `"${id}" is the smallest coin of "${family.id}", which goes only with its whole family`);
        }
      });
    }

    layer.catalogs?.forEach((entry, catalogIndex) => {
      const at = [...path, "catalogs", catalogIndex];
      const catalog = catalogById.get(entry.id);
      if (!catalog) return issue([...at, "id"], `Unknown catalog "${entry.id}"`);
      const filter = (catalog.filters ?? []).find((candidate) => candidate.id === entry.hide.filter);
      if (!filter) {
        return issue([...at, "hide", "filter"], `Catalog "${entry.id}" declares no filter "${entry.hide.filter}"`);
      }
      // A number is compared with above or below and a word with equals or notIn. The other way
      // round the rule would match no entry, and the author would find out in the picker.
      const numeric = entry.hide.above !== undefined || entry.hide.below !== undefined;
      if (numeric !== (filter.type === "number")) {
        issue(
          [...at, "hide"],
          filter.type === "number"
            ? `Filter "${filter.id}" holds a number, so hide uses above or below`
            : `Filter "${filter.id}" holds words, so hide uses equals or notIn`,
        );
      }
    });
  });
  void lists;
}

/** The whole `ruleset.json` document. Strict on purpose: a ruleset this Engine only partly
 *  understands would silently change a game's arithmetic, so an unknown key refuses the file. */
export const rulesetDefinitionSchema: z.ZodEffects<typeof rulesetDefinitionBaseSchema> =
  rulesetDefinitionBaseSchema.superRefine(refineRulesetDefinition);

/** How long guidance may be once the layers a game turned on have been appended to it. A layer
 *  ADDS to the ruleset's own text, so the merged string routinely passes the 1500 characters one
 *  file may declare, and it stays bounded all the same: the base plus every layer's own ceiling
 *  and the one separator each appended layer brings.
 *  The file schema keeps the tighter cap, because nothing writes an effective definition back. */
export const RULESET_EFFECTIVE_GUIDANCE_MAX = 1500 + RULESET_LAYERS_MAX * (RULESET_LAYER_GUIDANCE_MAX + 1);

/** The definition as the Engine HOLDS it rather than as an author wrote it: a `ruleset.json` with
 *  the game's active layers applied, and, for a community ruleset, re-keyed under its namespaced
 *  id. Two relaxations, both because this document is never written back to a file. Everything
 *  else is the file's own rule, which is what makes it safe to hand a layered definition to the
 *  prompt, the resolver, the sheet editor and the battle bridge unchanged. */
export const rulesetEffectiveDefinitionSchema: z.ZodEffects<typeof rulesetDefinitionBaseSchema> =
  rulesetDefinitionBaseSchema
    .extend({
      id: z.string().max(140).regex(RULESET_REF_ID_PATTERN),
      gm: gmSchema.extend({
        checkGuidance: promptSafeText(RULESET_EFFECTIVE_GUIDANCE_MAX),
        worldGuidance: promptSafeText(RULESET_EFFECTIVE_GUIDANCE_MAX).optional(),
      }),
    })
    .superRefine((def, ctx) => refineRulesetDefinition(def, ctx, true));

export type RulesetDefinition = z.infer<typeof rulesetDefinitionSchema>;
/** One declared layer. Absent on every ruleset written before layers existed. */
export type RulesetLayer = NonNullable<RulesetDefinition["layers"]>[number];
export type RulesetLayerCatalogRule = NonNullable<RulesetLayer["catalogs"]>[number];
export type RulesetLayerCatalogHide = RulesetLayerCatalogRule["hide"];
/** The one field type a layer can narrow. */
export type RulesetEnumField = Extract<z.infer<typeof rulesetFieldSchema>, { type: "enum" }>;
export type RulesetResolution = RulesetDefinition["resolution"];
/** The two kinds, narrowed. Every reader of a field only one kind has takes one of these, so the
 *  compiler finds the readers a third kind would break. */
export type RulesetDiceSumResolution = Extract<RulesetResolution, { kind: "dice-sum" }>;
export type RulesetDicePoolResolution = Extract<RulesetResolution, { kind: "dice-pool" }>;

/** The most successes one roll of this pool can ever count: the largest pool, as many exploded dice
 *  again (the roller's own cap), every one of them doubled. One answer for the schema's "could this
 *  ever be reached" check and for the ceiling of a check's difficulty, so the two cannot disagree
 *  about a ladder step the file was allowed to declare. */
export function rulesetPoolMaxSuccesses(
  resolution: Pick<RulesetDicePoolResolution, "pool" | "explode" | "double">,
): number {
  return (resolution.pool.max + (resolution.explode ? resolution.pool.max : 0)) * (resolution.double ? 2 : 1);
}
export type RulesetSheetSchema = RulesetDefinition["sheet"];
/** A party sheet uses the existing sheet math and renderer with its own field namespace. */
export function rulesetPartyDefinition(definition: RulesetDefinition): RulesetDefinition | null {
  const party = definition.party;
  if (!party) return null;
  return {
    ...definition,
    party: undefined,
    sheet: rulesetSheetSchema.parse({
      version: definition.sheet.version,
      fields: party.fields,
      live: { pools: party.pools },
      ...(party.lists ? { lists: party.lists } : {}),
      ...(party.builder ? { builder: party.builder } : {}),
      ...(party.advancement?.fields?.length ? { advancement: party.advancement } : {}),
    }),
    // A shared setup reads only the catalogs its own steps name (1.163), which feed the party's lists.
    ...(party.builder
      ? {
          catalogs: definition.catalogs?.filter((catalog) =>
            party.builder!.steps.some(
              (step) =>
                ((step.kind === "catalog" || step.kind === "choices") && step.catalog === catalog.id) ||
                (step.kind === "rows" && step.from === catalog.id),
            ),
          ),
        }
      : {}),
    rests: [],
    gm: {
      ...definition.gm,
      sheetSummary: party.summary ?? { fields: party.fields.map((field) => field.id), derived: [], lists: [] },
    },
  };
}

/** Punctuation cannot occur in a normalized character name, so this snapshot key cannot collide. */
export const RULESET_PARTY_KEY = "$party";

export type RulesetField = z.infer<typeof rulesetFieldSchema>;
export type RulesetListColumn = z.infer<typeof rulesetListColumnSchema>;

/** A die's sides as a list cell writes them: 8, "8" or "d8" (any case). Null for anything else. */
export function rulesetDieSides(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 2 && value <= 100 ? value : null;
  if (typeof value !== "string") return null;
  const match = /^\s*d?(\d{1,3})\s*$/i.exec(value);
  const sides = match ? Number(match[1]) : NaN;
  return Number.isInteger(sides) && sides >= 2 && sides <= 100 ? sides : null;
}
export type RulesetDerived = z.infer<typeof rulesetDerivedSchema>;
export type RulesetLiveTrack = RulesetSheetSchema["live"]["tracks"][number];
/** One rung of a wound track. Absent on a plain track, which is a bounded integer. */
export type RulesetTrackLevel = z.infer<typeof liveTrackLevelSchema>;
/** One kind of harm a wound track may take. The DEFINITION holds kinds; a MARK is one of them
 *  sitting on the track in play, and lives in the live state. */
export type RulesetTrackKind = z.infer<typeof liveTrackKindSchema>;
export type RulesetRest = RulesetDefinition["rests"][number];
/** The opt-in battle block. Absent on a ruleset that does not lend its sheet to battles. */
export type RulesetBattle = NonNullable<RulesetDefinition["battle"]>;
export type RulesetBattleSlot = NonNullable<RulesetBattle["slots"]>[number];
export type RulesetBattleSkills = NonNullable<RulesetBattle["skills"]>[number];
/** The opt-in combat block. Absent on a ruleset whose fights are not its own. */
export type RulesetCombat = NonNullable<RulesetDefinition["combat"]>;
export type RulesetCombatDice = RulesetCombat["initiative"]["dice"];
export type RulesetCombatBudget = RulesetCombat["economy"]["budgets"][number];
export type RulesetCombatAttackSource = NonNullable<RulesetCombat["attacks"]>[number];
export type RulesetCombatAbilitySource = NonNullable<RulesetCombat["abilities"]>[number];
export type RulesetCombatStandardAction = NonNullable<RulesetCombat["standard"]>[number];
export type RulesetCombatCondition = NonNullable<RulesetCombat["conditions"]>[number];
export type RulesetCombatConditionEffect = RulesetCombatCondition["effects"][number];
/** What one cell is worth, and what this system calls that distance. */
export type RulesetCombatDistance = NonNullable<RulesetCombat["distance"]>;
/** A distance carried by one column of an attack list, or the same on every row of it. */
export type RulesetCombatDistanceSource = z.infer<typeof combatDistanceSourceSchema>;
export type RulesetCombatConcentration = NonNullable<RulesetCombat["concentration"]>;
export type RulesetCombatDying = NonNullable<RulesetCombat["dying"]>;
export type RulesetCombatThreatTier = NonNullable<RulesetCombat["threat"]>["tiers"][number];
/** Where a community ruleset was imported from. `url` is null for a file the user picked. */
export type CommunityRulesetSource = { kind: "repository" | "local"; url: string | null };

/** One installed ruleset as the API lists it: the whole definition plus the package that supplied
 *  it. A community ruleset has no package and carries `source` instead, which is what lets the
 *  client tell an imported ruleset from an official one.
 *
 *  `definition` is the RESOLVED definition: its `id` is the id the Engine knows the ruleset by, which
 *  for a community ruleset is the namespaced one (`local/my-5e`). It was validated as a file, with
 *  its bare id, before the registry re-keyed it, so it is never parsed with
 *  `rulesetDefinitionSchema` again: that schema describes the FILE and would refuse the slash. */
export type InstalledRuleset = {
  packageId: string | null;
  definition: ListedRulesetDefinition;
  source?: CommunityRulesetSource;
  /** Community only, ascending: every stored version, so the UI can say what removing one costs.
   *  `definition` is the highest of them. */
  versions?: number[];
};

/** A catalog as the LIST reports it: the header, with how many entries an inline catalog holds in
 *  place of the entries themselves. The list is read whenever a sheet editor opens, and a catalog
 *  is the one part of a ruleset that can be large, so the entries come from the catalog route. */
export type RulesetCatalogSummary = Omit<RulesetCatalogHeader, "entries"> & { entryCount?: number };

/** A definition as the list carries it. Assignable to `RulesetDefinition`, so everything rendered
 *  from a definition keeps working; only a catalog picker needs to know the difference. */
export type ListedRulesetDefinition = Omit<RulesetDefinition, "catalogs"> & { catalogs?: RulesetCatalogSummary[] };

/** One catalog's entries, as `GET /capability-packages/rulesets/catalog` answers. `catalog` is the
 *  header without the two keys that say where the entries live, because they are right here. */
export type RulesetCatalogPayload = {
  rulesetId: string;
  version: number;
  catalog: Omit<RulesetCatalogHeader, "entries" | "asset">;
  entries: RulesetCatalogEntry[];
};

/** Authors may annotate any object with `$comment`, and the document root with `$schema` for
 *  editor support. Both are dropped before validation so the strict schema never sees them. */
export function stripRulesetComments(input: unknown, isRoot = true): unknown {
  if (Array.isArray(input)) return input.map((entry) => stripRulesetComments(entry, false));
  if (!input || typeof input !== "object") return input;
  // `Object.fromEntries` defines own properties, so a `__proto__` key stays an ordinary key the
  // strict schema then refuses, instead of becoming the copy's prototype and slipping past it.
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key]) => key !== "$comment" && !(isRoot && key === "$schema"))
      .map(([key, value]) => [key, stripRulesetComments(value, false)]),
  );
}

export type RulesetParseResult = { ok: true; definition: RulesetDefinition } | { ok: false; issues: string[] };

/** The deepest a ruleset document nests: far past any real file (a creature's riders sit a dozen deep). */
const RULESET_MAX_DEPTH = 64;

/**
 * Why a document cannot be a ruleset or a catalog by its shape alone, or null: nested deeper than one
 * ever is, or a list (or an object) longer than any one has. Walked without recursion and before the
 * schema, so a hostile document neither overflows the stack nor makes the schema check every item of a
 * list longer than any it allows (it reads each one even after the length has failed).
 */
export function rulesetShapeIssue(input: unknown): string | null {
  const stack: Array<[unknown, number, string]> = [[input, 0, ""]];
  while (stack.length) {
    const [value, depth, path] = stack.pop()!;
    if (!value || typeof value !== "object") continue;
    const where = path || "(root)";
    if (depth > RULESET_MAX_DEPTH) return `${where}: nested deeper than a ruleset ever is`;
    // Counted before any of it is copied out.
    const count = Array.isArray(value) ? value.length : Object.keys(value).length;
    if (count > RULESET_CATALOG_MAX_ENTRIES) {
      return `${where}: ${count} ${Array.isArray(value) ? "items" : "keys"}, more than any part of a ruleset has`;
    }
    const items = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value);
    for (const [key, item] of items) {
      if (item && typeof item === "object") stack.push([item, depth + 1, path ? `${path}.${key}` : key]);
    }
  }
  return null;
}

/** Parse a ruleset document. Never throws: a file the Engine cannot use comes back as a list of
 *  plain `path: message` lines an author can act on. */
export function parseRulesetDefinition(input: unknown): RulesetParseResult {
  const shape = rulesetShapeIssue(input);
  if (shape) return { ok: false, issues: [shape] };
  const parsed = rulesetDefinitionSchema.safeParse(stripRulesetComments(input));
  if (parsed.success) return { ok: true, definition: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.slice(0, 40).map((entry) => `${entry.path.join(".") || "(root)"}: ${entry.message}`),
  };
}

// ── Catalog helpers ──

export type RulesetCatalogHeader = z.infer<typeof catalogSchema>;
export type RulesetCatalogEntry = z.infer<typeof catalogEntrySchema>;

/** One item as a catalog entry writes it, for reading an invented item back off a game. */
export const rulesetCatalogItemSchema = catalogItemSchema;
export type RulesetItems = z.infer<typeof itemsSchema>;
export type RulesetStartingGear = z.infer<typeof startingGearSchema>;
export type RulesetStartingGearLine = z.infer<typeof startingGearLineSchema>;
export type RulesetItemStat = z.infer<typeof rulesetItemStatSchema>;
export type RulesetCurrencyFamily = z.infer<typeof currencyFamilySchema>;
export type RulesetCatalogEntryRow = z.infer<typeof catalogEntryRowSchema>;
/** The columns of one entry row the ruleset sets, keyed by column id. */
export type RulesetCatalogScaled = z.infer<typeof catalogScaledSchema>;
export type RulesetCatalogScaledColumn = z.infer<typeof catalogScaledColumnSchema>;
export type RulesetCatalogFilter = z.infer<typeof catalogFilterSchema>;
export type RulesetCatalogMechanics = z.infer<typeof catalogMechanicsSchema>;
/** What a catalog's entries are: rows for the sheet's lists, or a bestiary of creatures. */
export type RulesetCatalogHolds = RulesetCatalogHeader["holds"];
/** One opponent, exactly as a bestiary entry writes it. */
export type RulesetCreature = z.infer<typeof rulesetCreatureSchema>;
export type RulesetCreatureAction = RulesetCreature["actions"][number];
export type RulesetCreatureDamage = NonNullable<RulesetCreatureAction["damage"]>;
export type RulesetCreatureTrait = NonNullable<RulesetCreature["traits"]>[number];
export type RulesetList = RulesetSheetSchema["lists"][number];

/** The entries of every catalog the caller fetched, keyed by catalog id. Fetching is the caller's
 *  job: a catalog may live in an asset behind a route, and nothing that reads this does I/O. It sits
 *  here rather than beside one of its readers because the combat bridge, the scaled-row recompute
 *  and the `use` command all take it. */
export type RulesetCatalogEntriesById = Record<string, readonly RulesetCatalogEntry[]>;

/** Whether a row of values could be stored in a list, column by column. Shared on purpose: the
 *  schema runs it over every catalog entry, and the client runs it again over the rows a player
 *  picked, so the picker can never splice in something the editor would then refuse. A sheet's
 *  fields have the same shapes as a list's columns, so a creature's fields are read by it too, and
 *  `noun` says which of the two a message is about. */
export function rulesetListRowIssues(
  list: { columns: ReadonlyArray<RulesetListColumn | RulesetField | RulesetItemStat> },
  values: Record<string, unknown>,
  noun: "Column" | "Field" | "Stat" = "Column",
): string[] {
  const issues: string[] = [];
  const columns = new Map(list.columns.map((column) => [column.id, column]));
  for (const [key, value] of Object.entries(values)) {
    const column = columns.get(key);
    if (!column) {
      issues.push(`Unknown ${noun.toLowerCase()} "${key}"`);
      continue;
    }
    if (column.type === "number") {
      if (typeof value !== "number") issues.push(`${noun} "${key}" takes a number`);
      else if (column.integer && !Number.isInteger(value)) issues.push(`${noun} "${key}" takes a whole number`);
      else if (value < column.min || value > column.max) {
        issues.push(`${noun} "${key}" is outside ${column.min} to ${column.max}`);
      }
    } else if (column.type === "boolean") {
      if (typeof value !== "boolean") issues.push(`${noun} "${key}" takes true or false`);
    } else if (column.type === "enum") {
      if (typeof value !== "string" || !column.values.includes(value)) {
        issues.push(`${noun} "${key}" takes one of its declared values`);
      }
    } else if (column.type === "dice") {
      if (typeof value !== "string" || value.length > 40) issues.push(`${noun} "${key}" takes dice text`);
    } else if (typeof value !== "string") {
      issues.push(`${noun} "${key}" takes text`);
    } else if (value.length > column.maxLength) {
      issues.push(`${noun} "${key}" is longer than ${column.maxLength} characters`);
    }
  }
  for (const column of list.columns) {
    if ("required" in column && column.required && values[column.id] === undefined) {
      issues.push(`${noun} "${column.id}" is required`);
    }
  }
  return issues;
}

/** Where an issue sits inside the entries array, so the same check can be reported as a zod path
 *  inside `ruleset.json` and as a `path: message` line for a catalog asset. */
export type RulesetCatalogEntryIssue = { path: (string | number)[]; message: string };

/** A creature's sheet, against the ruleset's own names: every id on it is one the ruleset's sheet
 *  declares, and every value is one that field or column can hold. What the sheet adds up to, its health
 *  above all, is read when a fight is built rather than here, because reading it needs the sheet's
 *  own arithmetic and this file is the one everything else imports. */
function creatureSheetIssues(
  definition: RulesetDefinition,
  sheet: NonNullable<RulesetCreature["sheet"]>,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
  narrowedByLayers: boolean,
): void {
  const known = (kind: string, ids: readonly { id: string }[], values: Record<string, unknown>, key: string) => {
    const names = new Set(ids.map((entry) => entry.id));
    for (const id of Object.keys(values)) {
      if (!names.has(id)) add([...at, key, id], `Unknown ${kind} "${id}"`);
    }
  };
  known("ability", definition.sheet.abilities, sheet.abilities, "abilities");
  // A score is a whole number inside the range the ruleset gives it, exactly as the sheet editor keeps
  // a character's.
  for (const ability of definition.sheet.abilities) {
    const score = sheet.abilities[ability.id];
    if (score !== undefined && (!Number.isInteger(score) || score < ability.min || score > ability.max)) {
      add(
        [...at, "abilities", ability.id],
        `Ability "${ability.id}" takes a whole number from ${ability.min} to ${ability.max}`,
      );
    }
  }
  known("skill", definition.sheet.skills, sheet.skills, "skills");
  known("save", definition.sheet.saves, sheet.saves, "saves");
  // What a skill or a save is set to is one of the ruleset's own proficiency tiers, and one of the
  // tiers it offers for that kind when it narrows them.
  const tierIds = definition.resolution.proficiencyTiers.map((tier) => tier.id);
  const tiers = new Set(tierIds);
  const offered = {
    skills: new Set(definition.sheet.skillTiers ?? tierIds),
    saves: new Set(definition.sheet.saveTiers ?? tierIds),
  };
  for (const key of ["skills", "saves"] as const) {
    for (const [id, tier] of Object.entries(sheet[key])) {
      if (!tiers.has(tier)) add([...at, key, id], `Unknown proficiency tier "${tier}"`);
      else if (!offered[key].has(tier)) add([...at, key, id], `This ruleset does not offer "${tier}" for ${key}`);
    }
  }
  // A field holds what that field holds: a number in its range, one of its values, and so on. A layer
  // narrows an enum field for what a PLAYER may pick; a creature written against the ruleset keeps its
  // value, which then reads as the field's default exactly as a character's does. So a definition
  // whose layers are applied does not hold a creature to the values a layer took out.
  const enums = new Map(
    definition.sheet.fields.flatMap((field) => (field.type === "enum" ? [[field.id, field] as const] : [])),
  );
  const plain = Object.fromEntries(Object.entries(sheet.fields).filter(([id]) => !enums.has(id)));
  const others = definition.sheet.fields.filter((field) => !enums.has(field.id));
  for (const message of rulesetListRowIssues({ columns: others }, plain, "Field")) add([...at, "fields"], message);
  for (const [id, field] of enums) {
    const value = sheet.fields[id];
    if (value === undefined) continue;
    // The values a layer took out of this field are still the field's own; nothing else is. A layered
    // definition keeps its `layers`, so exactly those can be read back.
    const removed = narrowedByLayers
      ? (definition.layers ?? []).flatMap((layer) =>
          (layer.fields ?? []).flatMap((entry) => (entry.id === id ? entry.removeValues : [])),
        )
      : [];
    if (typeof value !== "string" || !(field.values.includes(value) || removed.includes(value))) {
      add([...at, "fields"], `Field "${id}" takes one of its declared values`);
    }
  }
  // A bonus is on a skill or a save, and a whole number inside the range the ruleset gives bonuses,
  // exactly as a character's is.
  known("skill or save", [...definition.sheet.skills, ...definition.sheet.saves], sheet.bonuses, "bonuses");
  const { min: bonusMin, max: bonusMax } = definition.sheet.bonusRange;
  for (const [id, bonus] of Object.entries(sheet.bonuses)) {
    if (!Number.isInteger(bonus) || bonus < bonusMin || bonus > bonusMax) {
      add([...at, "bonuses", id], `Bonus "${id}" takes a whole number from ${bonusMin} to ${bonusMax}`);
    }
  }
  const lists = new Map(definition.sheet.lists.map((list) => [list.id, list]));
  for (const [listId, rows] of Object.entries(sheet.lists)) {
    const list = lists.get(listId);
    if (!list) {
      add([...at, "lists", listId], `Unknown list "${listId}"`);
      continue;
    }
    if (rows.length > list.maxItems) add([...at, "lists", listId], `"${listId}" holds at most ${list.maxItems} rows`);
    rows.forEach((row, index) => {
      // Held to exactly what a catalog's row is held to, less the mark that says which entry it is.
      const { [RULESET_CATALOG_ROW_KEY]: _mark, ...values } = row;
      for (const message of rulesetListRowIssues(list, values)) add([...at, "lists", listId, index], message);
      // A row picked out of a catalog says which entry it is, which is what a fight reads its price
      // and its mechanics from. The catalog has to be one that holds rows and feeds this list; when
      // it is written inline, the entry has to be in it too.
      const ref = row[RULESET_CATALOG_ROW_KEY];
      if (ref === undefined) return;
      const where = [...at, "lists", listId, index, RULESET_CATALOG_ROW_KEY];
      const slash = typeof ref === "string" ? ref.indexOf("/") : -1;
      if (typeof ref !== "string" || slash <= 0 || slash === ref.length - 1) {
        add(where, `"${String(ref)}" is not a <catalog>/<entry> reference`);
        return;
      }
      const catalogId = ref.slice(0, slash);
      const catalog = definition.catalogs?.find((candidate) => candidate.id === catalogId);
      // A bestiary declares no feeds, so it is never one of these.
      if (!catalog?.feeds?.includes(listId)) {
        add(where, `No catalog "${catalogId}" feeds the list "${listId}"`);
        return;
      }
      const entryId = ref.slice(slash + 1);
      if (catalog.entries && !catalog.from && !catalog.entries.some((entry) => entry.id === entryId)) {
        add(where, `Catalog "${catalogId}" has no entry "${entryId}"`);
      }
    });
  }
}

/** A character's build held to the same rule as a creature's sheet: every id is one the ruleset
 *  declares and every value is one it can hold. One `path: message` line per problem. Professor Mari
 *  checks what she writes onto a sheet with it, so she can never store what the editor would refuse. */
export function rulesetSheetBuildIssues(definition: RulesetDefinition, build: RulesetSheetBuild): string[] {
  const issues: string[] = [];
  creatureSheetIssues(
    definition,
    build,
    [],
    (path, message) => issues.push(path.length > 0 ? `${path.join(".")}: ${message}` : message),
    false,
  );
  return issues;
}

/** The die a `dice-pool` ruleset throws, which is the die every damage roll of its fights throws. */
function poolDieSides(definition: RulesetDefinition): number | undefined {
  return definition.resolution.kind === "dice-pool" ? definition.resolution.die.sides : undefined;
}

/** Everything a creature must satisfy against the ruleset that declares it: every name it carries
 *  is one the `combat` block or the sheet already has. Shared by the inline catalogs in
 *  `ruleset.json` and by a `catalogs/<id>.json` asset, so both are held to one rule. */
/** An escape DC is what breaking free of a condition is rolled against, so the fight has a contest
 *  that breaks free of it, and it is a number a summed roll can meet: a pool fight counts successes. */
/** What is wrong with a target test (1.168): every type and tag it names is the ruleset's own. */
function targetIsIssues(
  definition: RulesetDefinition,
  test: RulesetTargetIs | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  if (!test) return;
  const kinds = definition.combat?.creatureTypes;
  if (!kinds) {
    add(at, "This ruleset declares no creature types for a target to be");
    return;
  }
  test.types?.forEach((type, index) => {
    if (!kinds.types.some((one) => one.id === type)) add([...at, "types", index], `Unknown creature type "${type}"`);
  });
  test.tags?.forEach((tag, index) => {
    if (!kinds.tags?.some((one) => one.id === tag)) add([...at, "tags", index], `Unknown creature tag "${tag}"`);
  });
}

/** The target tests one action, entry or use carries (1.168): on its extra clauses, the conditions it
 *  applies, and who it may be pointed at. */
function targetTestIssues(
  definition: RulesetDefinition,
  carrier: {
    plus?: ReadonlyArray<{ targetIs?: RulesetTargetIs }>;
    applies?: ReadonlyArray<{
      targetIs?: RulesetTargetIs;
      destroysUpTo?: RulesetDestroysUpTo[];
      value?: RulesetValueRef;
    }>;
    targetTypes?: {
      is?: RulesetTargetIs;
      not?: RulesetTargetIs;
      abilityAtMost?: Record<string, number>;
      abilityAtLeast?: Record<string, number>;
      notImmuneTo?: string[];
    };
    save?: RulesetSaveExtras;
    maxAgainst?: RulesetTargetIs;
  },
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  saveExtrasIssues(definition, carrier.save, [...at, "save"], add);
  carrier.plus?.forEach((clause, index) =>
    targetIsIssues(definition, clause.targetIs, [...at, "plus", index, "targetIs"], add),
  );
  carrier.applies?.forEach((entry, index) =>
    targetIsIssues(definition, entry.targetIs, [...at, "applies", index, "targetIs"], add),
  );
  // Destroyed by tier (1.266): the tiers are the threat scale's, and the bounds read off a sheet.
  carrier.applies?.forEach((entry, index) =>
    entry.destroysUpTo?.forEach((row, rowIndex) => {
      const where = [...at, "applies", index, "destroysUpTo", rowIndex];
      const tiers = definition.combat?.threat?.tiers;
      if (!tiers) add([...where, "tier"], "This ruleset has no threat tiers to destroy by");
      else if (!tiers.some((tier) => tier.id === row.tier))
        add([...where, "tier"], `Unknown threat tier "${row.tier}"`);
      if (row.when) {
        const names = rulesetSheetNames(definition.sheet, definition.items);
        for (const found of rulesetValueRefIssues(row.when.value, names, names.derived)) {
          add([...where, "when", "value", found.key], found.message);
        }
      }
    }),
  );
  // The value it is put on with (1.274) is read off its applier's sheet.
  carrier.applies?.forEach((entry, index) => {
    if (!entry.value) return;
    const names = rulesetSheetNames(definition.sheet, definition.items);
    for (const found of rulesetValueRefIssues(entry.value, names, names.derived)) {
      add([...at, "applies", index, "value", found.key], found.message);
    }
  });
  targetIsIssues(definition, carrier.targetTypes?.is, [...at, "targetTypes", "is"], add);
  targetIsIssues(definition, carrier.targetTypes?.not, [...at, "targetTypes", "not"], add);
  targetIsIssues(definition, carrier.maxAgainst, [...at, "maxAgainst"], add);
  const abilities = new Set(definition.sheet.abilities.map((ability) => ability.id));
  for (const key of ["abilityAtMost", "abilityAtLeast"] as const) {
    for (const id of Object.keys(carrier.targetTypes?.[key] ?? {})) {
      if (!abilities.has(id)) add([...at, "targetTypes", key, id], `Unknown ability "${id}"`);
    }
  }
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  carrier.targetTypes?.notImmuneTo?.forEach((id, index) => {
    if (!conditions.has(id)) add([...at, "targetTypes", "notImmuneTo", index], `Unknown condition "${id}"`);
  });
}

/** What a save says it is against, and who passes it outright (1.181), are the ruleset's own:
 *  its conditions, its damage types where it declares them, and its creature types. */
function saveExtrasIssues(
  definition: RulesetDefinition,
  save: RulesetSaveExtras | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  if (!save) return;
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const declared = definition.combat?.damageTypes;
  const types = declared ? new Set(declared.map((type) => type.trim().toLowerCase())) : null;
  const condition = (list: string[] | undefined, path: (string | number)[]) =>
    list?.forEach((id, index) => {
      if (!conditions.has(id)) add([...path, index], `Unknown condition "${id}"`);
    });
  const damage = (list: string[] | undefined, path: (string | number)[]) =>
    list?.forEach((type, index) => {
      if (types && !types.has(type.trim().toLowerCase())) add([...path, index], `Unknown damage type "${type}"`);
    });
  condition(save.against?.conditions, [...at, "against", "conditions"]);
  damage(save.against?.damage, [...at, "against", "damage"]);
  condition(save.succeeds?.conditionImmune, [...at, "succeeds", "conditionImmune"]);
  damage(save.succeeds?.immune, [...at, "succeeds", "immune"]);
  targetIsIssues(definition, save.succeeds?.is, [...at, "succeeds", "is"], add);
  save.modes?.forEach((entry, index) => targetIsIssues(definition, entry.is, [...at, "modes", index, "is"], add));
}

/** What a lowered maximum names (1.203, 1.235): a save and a damage type the ruleset has, and health
 *  in points to lower. */
function reducesMaxIssues(
  definition: RulesetDefinition,
  reduces: RulesetReducesMax,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  if (reduces.save !== undefined && !definition.sheet.saves.some((save) => save.id === reduces.save)) {
    add([...at, "save"], `Unknown save "${reduces.save}"`);
  }
  const types = definition.combat?.damageTypes?.map((type) => type.trim().toLowerCase());
  if (reduces.damageType && types && !types.includes(reduces.damageType.trim().toLowerCase())) {
    add([...at, "damageType"], `Unknown damage type "${reduces.damageType}"`);
  }
  if (!definition.combat || "track" in definition.combat.health) {
    add(at, "Only health kept in points has a maximum to lower");
  }
}

/** What a target must hold to be picked (1.235): conditions the sheet has. */
function targetHoldsIssues(
  definition: RulesetDefinition,
  holds: RulesetTargetHolds | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  for (const key of ["conditions", "fromSelf"] as const) {
    holds?.[key]?.forEach((condition, index) => {
      if (!conditions.has(condition)) add([...at, key, index], `Unknown condition "${condition}"`);
    });
  }
}

/** The kinds the fight's conditions are (1.258), which a cure or an immunity may name. */
export function rulesetConditionKindIds(definition: RulesetDefinition): Set<string> {
  return new Set((definition.combat?.conditions ?? []).flatMap((entry) => entry.kinds ?? []));
}

/** What a cure names (1.176): conditions the sheet has, or their kinds (1.258), and a dying rule for
 *  steadying to stop. */
function cureIssues(
  definition: RulesetDefinition,
  mechanics: {
    ends?: { conditions: string[]; count?: number };
    stabilizes?: true;
    tracks?: Array<{ track: string; by: number }>;
    unseals?: true;
  },
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const kinds = rulesetConditionKindIds(definition);
  mechanics.ends?.conditions.forEach((condition, index) => {
    if (!conditions.has(condition) && !kinds.has(condition))
      add([...at, "ends", "conditions", index], `Unknown condition "${condition}"`);
  });
  if (
    mechanics.ends?.count !== undefined &&
    mechanics.ends.count > mechanics.ends.conditions.length &&
    // A kind may be any number of conditions (1.258).
    !mechanics.ends.conditions.some((condition) => kinds.has(condition))
  ) {
    add([...at, "ends", "count"], "A cure ends at most as many conditions as it names");
  }
  if (mechanics.stabilizes && !definition.combat?.dying) {
    add([...at, "stabilizes"], "Steadying the dying needs a combat block with a dying rule");
  }
  // A plain track is moved by levels (1.201); a wound track is marked with kinds instead.
  mechanics.tracks?.forEach((entry, index) => {
    const track = definition.sheet.live.tracks.find((one) => one.id === entry.track);
    if (!track) add([...at, "tracks", index, "track"], `Unknown track "${entry.track}"`);
    else if (track.kinds) add([...at, "tracks", index, "track"], "A wound track is marked, not moved by levels");
  });
  if (mechanics.unseals && (!definition.combat || "track" in definition.combat.health)) {
    add(
      [...at, "unseals"],
      "Only health kept in points is sealed, so giving it back needs a combat block that keeps it",
    );
  }
}

/** The senses an obscuring zone or an unseen condition lets through are the fight's own (1.178). */
/** The components something needs, or a zone or condition stops, are the fight's own (1.179). */
function componentIssues(
  definition: RulesetDefinition,
  components: string[] | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const known = new Set((definition.combat?.components ?? []).map((component) => component.id));
  components?.forEach((component, index) => {
    if (!known.has(component)) {
      add(
        [...at, index],
        known.size ? `Unknown component "${component}"` : "This ruleset declares no combat components",
      );
    }
  });
}

/** What a zone does to whoever stands in it, stops, or wards off names the ruleset's own words (1.179). */
function zoneInsideIssues(
  definition: RulesetDefinition,
  zone: RulesetCatalogZone | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  if (!zone) return;
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  zone.inside?.conditions?.forEach((condition, index) => {
    if (!conditions.has(condition)) add([...at, "inside", "conditions", index], `Unknown condition "${condition}"`);
  });
  const types = definition.combat?.damageTypes?.map((type) => type.trim().toLowerCase());
  zone.inside?.immune?.forEach((type, index) => {
    if (types && !types.includes(type.trim().toLowerCase())) {
      add([...at, "inside", "immune", index], `Unknown damage type "${type}"`);
    }
  });
  componentIssues(definition, zone.forbids?.components, [...at, "forbids", "components"], add);
  zone.burns?.by.forEach((type, index) => {
    if (types && !types.includes(type.trim().toLowerCase()))
      add([...at, "burns", "by", index], `Unknown damage type "${type}"`);
  });
  const sections = zone.sections;
  for (const key of ["vulnerable", "resist", "immune"] as const) {
    sections?.[key]?.forEach((type, index) => {
      if (types && !types.includes(type.trim().toLowerCase()))
        add([...at, "sections", key, index], `Unknown damage type "${type}"`);
    });
  }
  const brokenType = sections?.broken?.damageType;
  if (brokenType && types && !types.includes(brokenType.trim().toLowerCase())) {
    add([...at, "sections", "broken", "damageType"], `Unknown damage type "${brokenType}"`);
  }
  const brokenSave = sections?.broken?.save;
  if (brokenSave && !definition.sheet.saves.some((save) => save.id === brokenSave)) {
    add([...at, "sections", "broken", "save"], `Unknown save "${brokenSave}"`);
  }
  if (zone.damageType && types && !types.includes(zone.damageType.trim().toLowerCase())) {
    add([...at, "damageType"], `Unknown damage type "${zone.damageType}"`);
  }
  const burnType = zone.burns?.damageType;
  if (burnType && types && !types.includes(burnType.trim().toLowerCase())) {
    add([...at, "burns", "damageType"], `Unknown damage type "${burnType}"`);
  }
  const catalogs = new Set((definition.catalogs ?? []).map((catalog) => catalog.id));
  zone.wards?.catalogs.forEach((catalog, index) => {
    if (!catalogs.has(catalog)) add([...at, "wards", "catalogs", index], `Unknown catalog "${catalog}"`);
  });
}

function sightIssues(
  definition: RulesetDefinition,
  pierced: string[] | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const senses = new Set((definition.combat?.senses ?? []).map((sense) => sense.id));
  pierced?.forEach((sense, index) => {
    if (!senses.has(sense)) {
      add(
        [...at, "pierced", index],
        senses.size ? `Unknown sense "${sense}"` : "This ruleset declares no combat senses to see through it",
      );
    }
  });
}

/** The senses something gives are the fight's own (1.180), each with its range. */
function senseRangeIssues(
  definition: RulesetDefinition,
  senses: Record<string, RulesetSenseGrant> | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const known = new Set((definition.combat?.senses ?? []).map((sense) => sense.id));
  Object.keys(senses ?? {}).forEach((sense) => {
    if (!known.has(sense)) {
      add(
        [...at, "senses", sense],
        known.size ? `Unknown sense "${sense}"` : "This ruleset declares no combat senses to give",
      );
    }
  });
}

/** The catalogs casting from which ends something are the ruleset's own (1.180). */
function castsIssues(
  definition: RulesetDefinition,
  catalogs: string[] | undefined,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const known = new Set((definition.catalogs ?? []).map((catalog) => catalog.id));
  catalogs?.forEach((catalog, index) => {
    if (!known.has(catalog)) add([...at, index], `Unknown catalog "${catalog}"`);
  });
}

function escapeDcIssues(
  definition: RulesetDefinition,
  applies: {
    condition: string;
    escapeDc?: number | "save";
    escapeChecks?: string[];
    endsWhenHolder?: { casts?: string[] };
    checkEnds?: { check: string };
  },
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  // The check that ends it (1.313) is one of the fight's own.
  if (applies.checkEnds && !definition.combat?.checks?.some((one) => one.id === applies.checkEnds!.check)) {
    add([...at, "checkEnds", "check"], `Unknown contest check "${applies.checkEnds.check}"`);
  }
  // What ends it when its holder casts (1.180) is cast from the ruleset's own catalogs.
  castsIssues(definition, applies.endsWhenHolder?.casts, [...at, "endsWhenHolder", "casts"], add);
  // The checks that may break it (1.175) are contest checks, and only mean something with an escape DC.
  applies.escapeChecks?.forEach((check, index) => {
    if (!definition.combat?.checks?.some((one) => one.id === check)) {
      add([...at, "escapeChecks", index], `Unknown contest check "${check}"`);
    }
  });
  if (applies.escapeChecks && applies.escapeDc === undefined) {
    add([...at, "escapeChecks"], 'Checks that break a hold go with the "escapeDc" they are rolled against');
  }
  if (applies.escapeDc === undefined) return;
  const combat = definition.combat;
  if (!combat?.contests?.some((contest) => contest.from?.holding === applies.condition)) {
    add([...at, "escapeDc"], `No contest breaks free of "${applies.condition}" for an escape DC to be rolled against`);
  } else if (combat.kind === "dice-pool") {
    add([...at, "escapeDc"], 'A "dice-pool" fight counts successes, so it has no escape DC to meet');
  }
}

function creatureIssues(
  definition: RulesetDefinition,
  creature: RulesetCreature,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
  narrowedByLayers: boolean,
): void {
  const combat = definition.combat;
  if (!combat) {
    return add(at, "This ruleset has no combat block, so there is nothing for a creature to be written in");
  }
  creature.keepsOn?.forEach((kept, keptIndex) => {
    if (!definition.sheet.live.conditions.some((condition) => condition.id === kept))
      add([...at, "keepsOn", keptIndex], `Unknown condition "${kept}"`);
  });
  const heldTags = new Set((definition.items?.tags ?? []).map((tag) => tag.id));
  creature.held?.forEach((thing, thingIndex) => {
    thing.tags.forEach((tag, tagIndex) => {
      if (!heldTags.has(tag)) add([...at, "held", thingIndex, "tags", tagIndex], `Unknown item tag "${tag}"`);
    });
  });
  if (creature.loot !== undefined && !definition.items?.lootTables?.some((table) => table.id === creature.loot)) {
    add([...at, "loot"], `Unknown loot table "${creature.loot}"`);
  }
  const budgets = new Set(combat.economy.budgets.map((budget) => budget.id));
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const abilities = new Set(definition.sheet.abilities.map((ability) => ability.id));
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  // Only checked where the ruleset says what its types are. One that declares none reads a type as
  // free text, exactly as a fight matches it.
  const damageTypes = combat.damageTypes ? new Set(combat.damageTypes.map((type) => type.trim().toLowerCase())) : null;

  const tiers = combat.threat?.tiers ?? [];
  if (tiers.length === 0) add([...at, "tier"], "This ruleset declares no threat tiers for a creature to sit on");
  else if (!tiers.some((tier) => tier.id === creature.tier)) {
    add([...at, "tier"], `Unknown threat tier "${creature.tier}"`);
  }

  for (const ability of Object.keys(creature.abilities ?? {})) {
    if (!abilities.has(ability)) add([...at, "abilities", ability], `Unknown ability "${ability}"`);
  }
  for (const save of Object.keys(creature.saves ?? {})) {
    if (!saves.has(save)) add([...at, "saves", save], `Unknown save "${save}"`);
  }
  const checks = new Set((combat.checks ?? []).map((check) => check.id));
  for (const check of Object.keys(creature.checks ?? {})) {
    if (!checks.has(check)) add([...at, "checks", check], `Unknown contest check "${check}"`);
  }
  if (creature.hiding) hidingTraitsIssues(definition, creature.hiding, [...at, "hiding"], add);
  if (creature.light && !combat.sight?.darkness)
    add([...at, "light"], "Light is read where combat.sight.darkness makes the dark real");
  creature.actions.forEach((action, index) => {
    if (action.sheds !== undefined && !combat.sight?.darkness)
      add([...at, "actions", index, "sheds"], "Light is read where combat.sight.darkness makes the dark real");
  });
  if (creature.unlit && !creature.actions.some((action) => action.sheds !== undefined && action.sheds !== "out"))
    add([...at, "unlit"], "A creature that begins with its light out needs an action that lights it");
  creature.lightOutWhile?.forEach((id, index) => {
    if (!conditions.has(id)) add([...at, "lightOutWhile", index], `Unknown condition "${id}"`);
  });
  if (creature.lightOutWhile && !creature.light && !creature.actions.some((action) => action.sheds !== undefined))
    add([...at, "lightOutWhile"], "A creature whose light goes out while a condition is on it sheds a light");
  // Its own modes on checks (1.291) name the sheet's skills.
  const skills = new Set(definition.sheet.skills.map((skill) => skill.id));
  creature.checkModes?.forEach((rule, ruleIndex) => {
    rule.skills.forEach((skill, skillIndex) => {
      if (!skills.has(skill)) add([...at, "checkModes", ruleIndex, "skills", skillIndex], `Unknown skill "${skill}"`);
    });
  });
  if (creature.passive !== undefined && !combat.hiding) {
    add([...at, "passive"], "A printed passive Perception is read by hiding, so it needs combat.hiding");
  }
  // What it may take as a standard action with another budget (1.291) is one the fight has.
  creature.actions.forEach((action, index) => {
    action.standard?.actions.forEach((name, nameIndex) => {
      if (!combat.standard?.includes(name)) {
        add([...at, "actions", index, "standard", "actions", nameIndex], `Unknown standard action "${name}"`);
      }
    });
  });
  if (creature.hover && !creature.speeds?.fly) add([...at, "hover"], "A creature that hovers has a fly speed");
  if (creature.type !== undefined || creature.tags) {
    const kinds = combat.creatureTypes;
    if (!kinds) add([...at, creature.type !== undefined ? "type" : "tags"], "This ruleset declares no creature types");
    else {
      if (creature.type !== undefined && !kinds.types.some((one) => one.id === creature.type)) {
        add([...at, "type"], `Unknown creature type "${creature.type}"`);
      }
      creature.tags?.forEach((tag, index) => {
        if (!kinds.tags?.some((one) => one.id === tag)) add([...at, "tags", index], `Unknown creature tag "${tag}"`);
      });
    }
  }
  if (creature.size !== undefined) {
    if (!combat.sizes) add([...at, "size"], "This ruleset declares no sizes for a creature to be");
    else if (!combat.sizes.order.some((size) => size.id === creature.size)) {
      add([...at, "size"], `Unknown size "${creature.size}"`);
    }
  }
  const itemTags = new Set((definition.items?.tags ?? []).map((tag) => tag.id));
  for (const key of ["resist", "vulnerable", "immune"] as const) {
    creature[key]?.forEach((entry, index) => {
      const type = typeof entry === "string" ? entry : entry.type;
      const path = typeof entry === "string" ? [...at, key, index] : [...at, key, index, "type"];
      if (damageTypes && !damageTypes.has(type.trim().toLowerCase())) add(path, `Unknown damage type "${type}"`);
      // What gets through is a weapon item's tags, so they are the ruleset's item tags.
      if (typeof entry === "string") return;
      entry.except.forEach((tag, tagIndex) => {
        if (!itemTags.has(tag)) {
          add(
            [...at, key, index, "except", tagIndex],
            itemTags.size ? `Unknown item tag "${tag}"` : "This ruleset declares no item tags for a blow to carry",
          );
        }
      });
    });
  }
  // A track some level reads is shrugged off the same way (1.115): 5e's immunity to exhaustion.
  const leveled = new Set((combat.levels ?? []).flatMap((level) => (level.track ? [level.track] : [])));
  // A creature's senses are the fight's own (1.178), each with its range.
  const senses = new Set((combat.senses ?? []).map((sense) => sense.id));
  Object.keys(creature.senses ?? {}).forEach((sense) => {
    if (!senses.has(sense)) {
      add(
        [...at, "senses", sense],
        senses.size ? `Unknown sense "${sense}"` : "This ruleset declares no combat senses for a creature to have",
      );
    }
  });
  // And what sees through a teleport's smoke (1.279).
  creature.actions?.forEach((action, index) => {
    if (action.teleport?.smoke)
      sightIssues(definition, action.teleport.smoke.pierced, [...at, "actions", index, "teleport", "smoke"], add);
  });
  const kinds = rulesetConditionKindIds(definition);
  creature.conditionImmunities?.forEach((condition, index) => {
    if (!conditions.has(condition) && !leveled.has(condition) && !kinds.has(condition)) {
      add([...at, "conditionImmunities", index], `Unknown condition "${condition}"`);
    }
  });
  if (creature.hardness !== undefined && !rulesetSpendsInitiative(combat)) {
    add([...at, "hardness"], HARDNESS_NEEDS_SPENDING);
  }
  // Soak is a pool fight's, by the health track's own kinds.
  if (creature.soak) {
    if (combat.kind !== "dice-pool") add([...at, "soak"], 'Soak is for a "dice-pool" fight');
    // How soak is taken, thrown or off the dice, is the ruleset's to say, never the Engine's guess.
    else if (!combat.pool?.soak)
      add([...at, "soak"], 'This fight\'s "pool" says nothing about soak, so there is no way to take it');
    const health = combat.health;
    const kinds =
      "track" in health
        ? new Set(
            (definition.sheet.live.tracks.find((track) => track.id === health.track)?.kinds ?? []).map(
              (kind) => kind.id,
            ),
          )
        : null;
    for (const kind of Object.keys(creature.soak.byKind ?? {})) {
      if (!kinds) add([...at, "soak", "byKind", kind], "Soak by kind needs health to be a wound track with kinds");
      else if (!kinds.has(kind)) add([...at, "soak", "byKind", kind], `"${kind}" is not a kind of the health track`);
    }
  }
  // A pool fight throws damage dice of the ruleset's own die, so dice of another size would be a
  // number nobody could count successes on.
  const poolDie = combat.kind === "dice-pool" ? poolDieSides(definition) : undefined;
  const wrongDie = (dice: string | undefined, where: (string | number)[]) => {
    if (poolDie === undefined || dice === undefined) return;
    const sides = Number(/d(\d+)/.exec(dice)?.[1]);
    if (sides !== poolDie) add(where, `A "dice-pool" fight throws d${poolDie}s, so damage dice are d${poolDie}s`);
  };

  if (creature.sheet) creatureSheetIssues(definition, creature.sheet, [...at, "sheet"], add, narrowedByLayers);

  const catalogIds = new Set((definition.catalogs ?? []).map((catalog) => catalog.id));
  const byId = new Map<string, RulesetCreatureAction>();
  creature.actions.forEach((action, index) => {
    if (byId.has(action.id)) add([...at, "actions", index, "id"], `Duplicate action id "${action.id}"`);
    byId.set(action.id, action);
  });
  creature.actions.forEach((action, index) => {
    const path = [...at, "actions", index];
    if (!budgets.has(action.budget)) add([...path, "budget"], `Unknown budget "${action.budget}"`);
    if (action.brokenNextLair !== undefined) {
      if (!action.concentration)
        add([...path, "brokenNextLair"], "Only a creature action held by its concentration is broken");
      else {
        const ids = typeof action.brokenNextLair === "string" ? [action.brokenNextLair] : action.brokenNextLair;
        ids.forEach((id, entry) => {
          const at = typeof action.brokenNextLair === "string" ? [] : [entry];
          if (!byId.get(id)?.lair) add([...path, "brokenNextLair", ...at], `"${id}" is not one of its lair actions`);
          else if (ids.indexOf(id) !== entry) add([...path, "brokenNextLair", ...at], `"${id}" is listed twice`);
        });
      }
    }
    if (action.draws && !budgets.has(action.draws.spends)) {
      add([...path, "draws", "spends"], `Unknown budget "${action.draws.spends}"`);
    }
    if (action.ability !== undefined && !definition.sheet.abilities.some((one) => one.id === action.ability)) {
      add([...path, "ability"], `Unknown ability "${action.ability}"`);
    }
    componentIssues(definition, action.components, [...path, "components"], add);
    if (action.damage?.type && damageTypes && !damageTypes.has(action.damage.type.trim().toLowerCase())) {
      add([...path, "damage", "type"], `Unknown damage type "${action.damage.type}"`);
    }
    action.damage?.qualities?.forEach((tag, tagIndex) => {
      if (!itemTags.has(tag)) {
        add(
          [...path, "damage", "qualities", tagIndex],
          itemTags.size ? `Unknown item tag "${tag}"` : "This ruleset declares no item tags for a blow to carry",
        );
      }
    });
    action.qualities?.forEach((tag, tagIndex) => {
      if (!itemTags.has(tag)) {
        add(
          [...path, "qualities", tagIndex],
          itemTags.size ? `Unknown item tag "${tag}"` : "This ruleset declares no item tags for an action to carry",
        );
      }
    });
    wrongDie(action.damage?.dice, [...path, "damage", "dice"]);
    action.damage?.alternatives?.forEach((alternative, alternativeIndex) =>
      wrongDie(alternative.dice, [...path, "damage", "alternatives", alternativeIndex, "dice"]),
    );
    action.damage?.plus?.forEach((clause, clauseIndex) =>
      wrongDie(clause.dice, [...path, "damage", "plus", clauseIndex, "dice"]),
    );
    // Every second amount on the blow is held to the same names the first one is, and a save of its
    // own needs a number to be rolled against: the clause's, the action's, or nothing at all.
    action.damage?.plus?.forEach((clause, clauseIndex) => {
      const where = [...path, "damage", "plus", clauseIndex];
      if (clause.type && damageTypes && !damageTypes.has(clause.type.trim().toLowerCase())) {
        add([...where, "type"], `Unknown damage type "${clause.type}"`);
      }
      if (!clause.save) return;
      if (!saves.has(clause.save.save)) add([...where, "save", "save"], `Unknown save "${clause.save.save}"`);
      if (clause.save.difficulty === undefined && !action.save && action.saveDifficulty === undefined) {
        add([...where, "save", "difficulty"], "This clause's save has no difficulty to be rolled against");
      }
    });
    if (action.save && !saves.has(action.save.save)) {
      add([...path, "save", "save"], `Unknown save "${action.save.save}"`);
    }
    // A lowered maximum (1.203) is a save against a blow, and only health in points has one to lower.
    if (action.reducesMax) {
      reducesMaxIssues(definition, action.reducesMax, [...path, "reducesMax"], add);
      if (action.reducesMax.onFailedSave && !action.save) {
        add([...path, "reducesMax", "onFailedSave"], '"onFailedSave" follows the action\'s own save, so it has one');
      }
      if (!action.damage) add([...path, "reducesMax"], "A maximum is lowered by the damage taken, so it has damage");
    }
    if (action.drain && !action.damage)
      add([...path, "drain"], "A drain gives back what the blow dealt, so it deals damage");
    targetHoldsIssues(definition, action.targetHolds, [...path, "targetHolds"], add);
    targetTestIssues(definition, { plus: action.damage?.plus }, [...path, "damage"], add);
    targetTestIssues(definition, { applies: action.applies, save: action.save }, path, add);
    // What it ends is held to the names a catalog entry's cures are (1.261).
    if (action.ends) cureIssues(definition, { ends: action.ends }, path, add);
    action.applies?.forEach((applies, appliesIndex) => {
      const where = [...path, "applies", appliesIndex];
      if (!conditions.has(applies.condition)) add([...where, "condition"], `Unknown condition "${applies.condition}"`);
      escapeDcIssues(definition, applies, where, add);
      // A stat block has no sheet: what it applies is written down, never read off one.
      if (applies.when) add([...where, "when"], 'A creature has no sheet to read "when" off');
      if (applies.saveEnds && !saves.has(applies.saveEnds.save)) {
        add([...where, "saveEnds", "save"], `Unknown save "${applies.saveEnds.save}"`);
      }
    });
    // A charge's clauses, save and conditions are held to the same names the blow's own are (1.186).
    const charge = action.charge;
    if (charge) {
      const where = [...path, "charge"];
      charge.plus?.forEach((clause, clauseIndex) => {
        wrongDie(clause.dice, [...where, "plus", clauseIndex, "dice"]);
        if (clause.type && damageTypes && !damageTypes.has(clause.type.trim().toLowerCase())) {
          add([...where, "plus", clauseIndex, "type"], `Unknown damage type "${clause.type}"`);
        }
        if (clause.save && !saves.has(clause.save.save)) {
          add([...where, "plus", clauseIndex, "save", "save"], `Unknown save "${clause.save.save}"`);
        }
        if (clause.save && clause.save.difficulty === undefined && !charge.save && !action.save) {
          add(
            [...where, "plus", clauseIndex, "save", "difficulty"],
            "This clause's save has no difficulty to be rolled against",
          );
        }
      });
      targetTestIssues(definition, { plus: charge.plus, applies: charge.applies }, where, add);
      if (charge.save && !saves.has(charge.save.save))
        add([...where, "save", "save"], `Unknown save "${charge.save.save}"`);
      charge.applies?.forEach((applies, appliesIndex) => {
        const at = [...where, "applies", appliesIndex];
        if (!conditions.has(applies.condition)) add([...at, "condition"], `Unknown condition "${applies.condition}"`);
        if (applies.when) add([...at, "when"], 'A creature has no sheet to read "when" off');
        if (applies.saveEnds && !saves.has(applies.saveEnds.save)) {
          add([...at, "saveEnds", "save"], `Unknown save "${applies.saveEnds.save}"`);
        }
        if (applies.saveEnds && !charge.save && !action.save && action.saveDifficulty === undefined) {
          add(
            [...at, "saveEnds"],
            "A condition that ends on a save needs a difficulty for that save to be rolled against",
          );
        }
      });
    }
    // What a reaction answers is named by catalog, so it has to be one this ruleset has.
    if (action.reaction?.cancelSave && !saves.has(action.reaction.cancelSave.save))
      add([...path, "reaction", "cancelSave", "save"], `Unknown save "${action.reaction.cancelSave.save}"`);
    if (action.reaction) reactionAgainstIssues(catalogIds, action.reaction, [...path, "reaction"], add);
    // A creature has no sheet to read a check off, so its own number is written down (1.116).
    if (action.reaction?.above) {
      if (combat.kind === "dice-pool") {
        add(
          [...path, "reaction", "above"],
          'A "dice-pool" fight counts successes, so it has no DC for a check to meet',
        );
      }
      if (!creature.sheet && action.reaction.above.check.const === undefined) {
        add([...path, "reaction", "above", "check"], 'A creature without a sheet writes its check as { "const": n }');
      }
    }
    action.sequence?.forEach((step, stepIndex) => {
      const where: (string | number)[] = [...path, "sequence", stepIndex, "action"];
      const named = byId.get(step.action);
      if (!named) return add(where, `Unknown action "${step.action}"`);
      if (named.id === action.id) return add(where, "A sequence cannot name itself");
      // A reaction waits for its moment, so it is never one of the strikes a turn's action makes.
      if (named.reaction) return add(where, `"${step.action}" is a reaction, so no sequence can make it`);
      // One budget, one list of strikes. A sequence of sequences would spend one budget on a tree,
      // and there would be nothing left to say how deep it may go.
      if (named.sequence) add(where, `"${step.action}" is a sequence, and a sequence cannot name another`);
      // A signature action is bought with points while somebody else is acting. Inside a sequence it
      // would be had for a budget on the creature's own turn, which is neither.
      if (named.signature) add(where, `"${step.action}" is bought with points, so a sequence cannot name it`);
      // Nor a lair's (1.315), taken on its own count.
      if (named.lair) add(where, `"${step.action}" is a lair action, so a sequence cannot name it`);
    });
    // A blink dog's bite before or after its teleport (1.280): one of its other plain actions.
    const strike = action.teleport?.strike;
    if (strike) {
      const where: (string | number)[] = [...path, "teleport", "strike"];
      const named = byId.get(strike);
      if (!named) add(where, `Unknown action "${strike}"`);
      else if (named.id === action.id) add(where, "A teleport's strike is another action, not the teleport itself");
      else if (named.reaction || named.sequence || named.teleport || named.signature || named.lair)
        add(
          where,
          `"${strike}" is a reaction, a sequence, a teleport or bought with points, so it is no teleport's strike`,
        );
    }
  });

  // Actions that recharge together roll one set of dice for it (1.186), so they all name the same.
  const groups = new Map<string, NonNullable<RulesetCreatureAction["recharge"]>>();
  creature.actions.forEach((action, index) => {
    const group = action.recharge?.group;
    if (!group) return;
    const first = groups.get(group);
    if (!first) return void groups.set(group, action.recharge!);
    const same =
      first.from === action.recharge!.from &&
      first.dice.count === action.recharge!.dice.count &&
      first.dice.sides === action.recharge!.dice.sides;
    if (!same)
      add(
        [...at, "actions", index, "recharge"],
        `Actions recharging as "${group}" roll the same dice from the same number`,
      );
  });
  for (const [group] of groups) {
    if (creature.actions.filter((action) => action.recharge?.group === group).length < 2) {
      add([...at, "actions"], `Only one action recharges as "${group}": a group shares its roll with another`);
    }
  }

  // Every rider names this block's own actions and this ruleset's own damage types.
  const riderIds = new Set<string>();
  creature.riders?.forEach((rider, index) => {
    const path = [...at, "riders", index];
    wrongDie(rider.amount.dice, [...path, "amount", "dice"]);
    if (riderIds.has(rider.id)) add([...path, "id"], `Duplicate rider id "${rider.id}"`);
    riderIds.add(rider.id);
    if (rider.type && damageTypes && !damageTypes.has(rider.type.trim().toLowerCase())) {
      add([...path, "type"], `Unknown damage type "${rider.type}"`);
    }
    rider.actions?.forEach((id, actionIndex) => {
      if (!byId.has(id)) add([...path, "actions", actionIndex], `Unknown action "${id}"`);
    });
  });
}

/** The skills and saves a condition, a level or an item's effect names, each one the sheet declares:
 *  its own `skills`, `saves` and `failsSaves`, and each modifier's `skills` and `saves`. */
function effectNameIssues(
  entry: {
    skills?: string[];
    saves?: string[];
    failsSaves?: string[];
    evasion?: string[];
    modifiers?: Array<{
      skills?: string[];
      saves?: string[];
      ability?: string;
      abilities?: string[];
      against?: { conditions?: string[]; damage?: string[]; from?: RulesetTargetIs };
      from?: RulesetTargetIs;
    }>;
  },
  skills: ReadonlySet<string>,
  saves: ReadonlySet<string>,
  abilities: ReadonlySet<string>,
  definition: RulesetDefinition,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const each = (ids: string[] | undefined, known: ReadonlySet<string>, path: (string | number)[], what: string) =>
    ids?.forEach((id, index) => {
      if (!known.has(id)) add([...path, index], `Unknown ${what} "${id}"`);
    });
  each(entry.skills, skills, [...at, "skills"], "skill");
  each(entry.saves, saves, [...at, "saves"], "save");
  each(entry.failsSaves, saves, [...at, "failsSaves"], "save");
  each(entry.evasion, saves, [...at, "evasion"], "save");
  entry.modifiers?.forEach((modifier, index) => {
    if (modifier.ability !== undefined && !abilities.has(modifier.ability)) {
      add([...at, "modifiers", index, "ability"], `Unknown ability "${modifier.ability}"`);
    }
    each(modifier.skills, skills, [...at, "modifiers", index, "skills"], "skill");
    each(modifier.abilities, abilities, [...at, "modifiers", index, "abilities"], "ability");
    each(modifier.saves, saves, [...at, "modifiers", index, "saves"], "save");
    targetIsIssues(definition, modifier.from, [...at, "modifiers", index, "from"], add);
    targetIsIssues(definition, modifier.against?.from, [...at, "modifiers", index, "against", "from"], add);
    const against = [...at, "modifiers", index, "against"];
    each(
      modifier.against?.conditions,
      new Set(definition.sheet.live.conditions.map((one) => one.id)),
      [...against, "conditions"],
      "condition",
    );
    if (definition.combat?.damageTypes) {
      each(
        modifier.against?.damage?.map((type) => type.trim().toLowerCase()),
        new Set(definition.combat.damageTypes.map((type) => type.trim().toLowerCase())),
        [...against, "damage"],
        "damage type",
      );
    }
  });
}

/** Why a fake cannot pass for its target (Capability API 1.79), or null when it can: the target is
 *  another real, sellable item of the same kind, worn the same way. `target` undefined is an item the
 *  ruleset does not have. Read at import (inline and same-file targets), at install (every catalog
 *  file) and when a market offers the fake (a target a layer hides is never offered). */
export function rulesetFakeIssue(
  fakeRef: string,
  fake: RulesetCatalogItem,
  target: RulesetCatalogItem | undefined,
): string | null {
  const to = fake.passesFor!;
  if (to === fakeRef) return "A fake does not pass for itself";
  if (!target) return `No item "${to}" for it to pass for`;
  if (target.passesFor !== undefined || target.binds?.cursed) return `"${to}" is itself a fake or cursed`;
  if (target.service) return `"${to}" is a service, which is never carried`;
  if (!target.cost) return `"${to}" has no cost, so it is never sold`;
  if (target.category !== fake.category) return `"${to}" is a different kind of item`;
  const slots = (item: RulesetCatalogItem) =>
    JSON.stringify(Object.entries(item.slots ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  if (slots(target) !== slots(fake)) return `"${to}" is worn in other slots`;
  if (Boolean(target.binds) !== Boolean(fake.binds))
    return `"${to}" ${target.binds ? "binds" : "does not bind"} and the fake ${fake.binds ? "does" : "does not"}`;
  return null;
}

/** Everything an entry must satisfy against the ruleset that declares it. */
/** An item against the ruleset's `items` block: every name it uses is one the block declares, and
 *  every stat value is one that stat could hold. */
function itemIssues(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const items = definition.items;
  if (!items) return add(at, "This ruleset has no items block, so there is nothing for an item to be written in");
  if (!items.categories.some((category) => category.id === item.category)) {
    add([...at, "category"], `Unknown item category "${item.category}"`);
  }
  if (item.rarity !== undefined) {
    if (!items.rarities?.length) add([...at, "rarity"], "This ruleset declares no rarities");
    else if (!items.rarities.some((rarity) => rarity.id === item.rarity)) {
      add([...at, "rarity"], `Unknown rarity "${item.rarity}"`);
    }
  }
  const tags = new Set((items.tags ?? []).map((tag) => tag.id));
  const tagged = new Set<string>();
  item.tags?.forEach((tag, index) => {
    if (!tags.has(tag)) add([...at, "tags", index], `Unknown item tag "${tag}"`);
    else if (tagged.has(tag)) add([...at, "tags", index], `Duplicate item tag "${tag}"`);
    tagged.add(tag);
  });
  for (const message of rulesetListRowIssues({ columns: items.stats ?? [] }, item.stats ?? {}, "Stat")) {
    add([...at, "stats"], message);
  }
  const slots = new Map((items.slots ?? []).map((slot) => [slot.id, slot]));
  for (const [id, count] of Object.entries(item.slots ?? {})) {
    const slot = slots.get(id);
    if (!slot) add([...at, "slots", id], `Unknown slot "${id}"`);
    else if (count > slot.count) add([...at, "slots", id], `A character has ${slot.count} of slot "${id}"`);
  }
  if (
    item.cost &&
    !(items.currencies ?? []).some((family) => family.units.some((unit) => unit.id === item.cost!.unit))
  ) {
    add(
      [...at, "cost", "unit"],
      items.currencies?.length ? `Unknown currency unit "${item.cost.unit}"` : "This ruleset declares no currencies",
    );
  }
  if (item.binds && !items.binding) add([...at, "binds"], "This ruleset declares no binding, so nothing is bound");
  if (item.sold) {
    if (!items.market) add([...at, "sold"], "This ruleset declares no market, so nothing is sold anywhere");
    else if (item.sold.place !== undefined && !items.market.places.some((place) => place.id === item.sold!.place)) {
      add([...at, "sold", "place"], `Unknown place "${item.sold.place}"`);
    }
  }
  if (item.passesFor !== undefined && item.service) add([...at, "passesFor"], "A service is never a fake");
  if (item.service) {
    // Bought and never carried: it costs something, and nothing about carrying or using it applies.
    if (!item.cost) add([...at, "service"], "A service is bought, so it has a cost");
    for (const key of ["slots", "stack", "binds", "worn", "carried", "requires", "attack", "use", "charges"] as const) {
      if (item[key] !== undefined) add([...at, key], "A service is never carried, so it has no " + key);
    }
  }
  const skills = new Set(definition.sheet.skills.map((skill) => skill.id));
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const abilities = new Map(definition.sheet.abilities.map((ability) => [ability.id, ability]));
  for (const key of ["worn", "carried"] as const) {
    const effect = item[key];
    if (!effect) continue;
    effectNameIssues(effect, skills, saves, new Set(abilities.keys()), definition, [...at, key], add);
    itemHideIssues(definition, effect, [...at, key], add);
    senseRangeIssues(definition, effect.senses, [...at, key], add);
    for (const [id, change] of Object.entries(effect.abilities ?? {})) {
      const ability = abilities.get(id);
      if (!ability) add([...at, key, "abilities", id], `Unknown ability "${id}"`);
      else if ("set" in change && (change.set < ability.min || change.set > ability.max)) {
        add([...at, key, "abilities", id, "set"], `"${id}" runs from ${ability.min} to ${ability.max}`);
      }
    }
  }
  if (item.requires) {
    // Read off the wearer's sheet with their live state and items, as anything worked out in play is.
    const names = rulesetSheetNames(definition.sheet, definition.items);
    item.requires.forEach((requirement, index) => {
      const path = [...at, "requires", index];
      for (const issue of rulesetValueRefIssues(requirement.value, names, names.derived, true)) {
        add([...path, "value", issue.key], issue.message);
      }
      effectNameIssues(
        requirement.otherwise,
        skills,
        saves,
        new Set(abilities.keys()),
        definition,
        [...path, "otherwise"],
        add,
      );
      itemHideIssues(definition, requirement.otherwise, [...path, "otherwise"], add);
      senseRangeIssues(definition, requirement.otherwise.senses, [...path, "otherwise"], add);
    });
  }
  if (item.attack) attackIssues(definition, item, item.attack, [...at, "attack"], add);
  const toggle = item.toggle;
  if (toggle && definition.combat && !definition.combat.economy.budgets.some((one) => one.id === toggle.budget)) {
    add([...at, "toggle", "budget"], `Unknown budget "${toggle.budget}"`);
  }
  item.attack?.plus?.forEach((clause, index) => {
    if (clause.when === "toggled" && !toggle) {
      add([...at, "attack", "plus", index, "when"], 'A clause dealt while the item is on needs the item\'s "toggle"');
    }
  });
  if (item.use) useIssues(definition, item, item.use, [...at, "use"], add);
  item.moreUses?.forEach((more, index) =>
    useIssues(definition, item, more.use, [...at, "moreUses", index, "use"], add),
  );
  if (item.moreUses && !item.use) add([...at, "moreUses"], 'More uses go beside a "use"');
  item.moreUses?.forEach((more, index) => {
    if (more.use.label !== undefined)
      add([...at, "moreUses", index, "use", "label"], "A further use is named by its own label");
  });
  if (item.charges) {
    itemValueChecker(definition, add)(item.charges.max, "number", [...at, "charges", "max"]);
    // Or by its weapon slaying (1.187): a nine lives stealer's.
    // Or by one of its weapon's modes (1.190): a javelin of lightning's bolt.
    if (
      item.use?.charges === undefined &&
      !item.attack?.slay?.some((entry) => entry.charges !== undefined) &&
      !item.attack?.modes?.some((mode) => mode.charges !== undefined) &&
      !item.attack?.spends
    ) {
      add(
        [...at, "charges"],
        "An item's charges are spent by its use, its weapon's slay, one of its weapon's modes or its hits, so one of them spends some",
      );
    }
    // Charges are one item's, so a stack of several would hold none of its own.
    if (item.stack !== 1) add([...at, "stack"], "An item that holds charges is one to a stack, so its stack is 1");
    // Read off a stat, the item's own number is what it holds: fewer than one is an item never used.
    const max = item.charges.max;
    const given = typeof max === "object" ? item.stats?.[max.stat] : undefined;
    if (typeof given === "number" && given < 1) {
      add([...at, "stats", (max as { stat: string }).stat], "An item that holds charges holds at least one");
    }
    const recharge = item.charges.recharge;
    recharge?.rests.forEach((rest, index) => {
      if (!definition.rests.some((entry) => entry.id === rest)) {
        add([...at, "charges", "recharge", "rests", index], `Unknown rest "${rest}"`);
      }
    });
    if (
      recharge &&
      recharge.amount !== "max" &&
      recharge.amount.dice === undefined &&
      recharge.amount.flat === undefined
    ) {
      add([...at, "charges", "recharge", "amount"], 'A recharge says how many come back, or "max"');
    }
  }
}

/** The kinds of harm and the conditions an item's effect keeps off its holder are the ruleset's own:
 *  damage types checked against `combat.damageTypes` where it declares any, as a creature's are. */
function itemHideIssues(
  definition: RulesetDefinition,
  effect: RulesetItemEffect,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  // A pool fight adds dice to a pool, so a rolled number on an attack would be a number of dice
  // nobody could throw, as it is for a condition's.
  if (definition.combat?.kind === "dice-pool") {
    effect.modifiers?.forEach((modifier, index) => {
      if (modifier.to === "attacks" && modifier.dice !== undefined) {
        add(
          [...at, "modifiers", index, "dice"],
          'A "dice-pool" fight adds dice to a pool, so a modifier gives a flat number of dice',
        );
      }
    });
  }
  hideIssues(definition, effect, at, add);
}

/** Typed hides share a creature's damage words and exception tags (Capability API 1.132). */
function hideIssues(
  definition: RulesetDefinition,
  effect: Pick<RulesetItemEffect, "resist" | "vulnerable" | "immune" | "conditionImmunities">,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const declared = definition.combat?.damageTypes;
  const types = declared ? new Set(declared.map((type) => type.trim().toLowerCase())) : null;
  for (const key of ["resist", "vulnerable", "immune"] as const) {
    effect[key]?.forEach((entry, index) => {
      const type = typeof entry === "string" ? entry : entry.type;
      if (typeof entry !== "string")
        entry.except.forEach((tag, tagIndex) => {
          if (!definition.items?.tags?.some((one) => one.id === tag))
            add([...at, key, index, "except", tagIndex], `Unknown item tag "${tag}"`);
        });
      if (types && !types.has(type.trim().toLowerCase())) add([...at, key, index], `Unknown damage type "${type}"`);
    });
  }
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const leveled = new Set((definition.combat?.levels ?? []).flatMap((level) => (level.track ? [level.track] : [])));
  const kinds = rulesetConditionKindIds(definition);
  effect.conditionImmunities?.forEach((condition, index) => {
    if (!conditions.has(condition) && !leveled.has(condition) && !kinds.has(condition)) {
      add([...at, "conditionImmunities", index], `Unknown condition "${condition}"`);
    }
  });
}

/** What is wrong with what an item adds to hit: every id it names and every stat it reads, the
 *  proficiency read off the holder's sheet, and a per-die target only where a pool's target moves. */
function toHitIssues(
  definition: RulesetDefinition,
  toHit: z.infer<typeof itemToHitSchema>,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
  whose: string,
): void {
  const value = itemValueChecker(definition, add);
  value(toHit.abilities, "abilities", [...at, "abilities"]);
  value(toHit.skill, "skill", [...at, "skill"]);
  value(toHit.bonus, "number", [...at, "bonus"]);
  value(toHit.target, "number", [...at, "target"]);
  for (const key of ["proficiency", "sheetBonus"] as const) {
    const ref = toHit[key];
    if (!ref) continue;
    const names = rulesetSheetNames(definition.sheet, definition.items);
    for (const issue of rulesetValueRefIssues(ref, names, names.derived, true)) {
      add([...at, key, issue.key], issue.message);
    }
  }
  if (toHit.target !== undefined) {
    const target = definition.resolution.kind === "dice-pool" ? definition.resolution.target : undefined;
    if (!target) {
      add([...at, "target"], `${whose} own target is a pool fight's; in this ruleset its bonus says the same`);
    } else if (target.min >= target.max) {
      add([...at, "target"], `${whose} own target moves the pool's, so target.min is below target.max`);
    }
  }
}

/** What is wrong with an item's use: the saves, damage types and conditions it names are the
 *  ruleset's, a save has a number to be rolled against, the charges it spends are the item's, and
 *  where the ruleset has fights, the budget it spends and what it adds to hit. */
function useIssues(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  use: RulesetItemUse,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const declared = definition.combat?.damageTypes;
  const types = declared ? new Set(declared.map((type) => type.trim().toLowerCase())) : null;
  const value = itemValueChecker(definition, add);
  if (use.save && !saves.has(use.save.save)) add([...at, "save", "save"], `Unknown save "${use.save.save}"`);
  if (use.sheetDifficulty) {
    const names = rulesetSheetNames(definition.sheet, definition.items);
    for (const issue of rulesetValueRefIssues(use.sheetDifficulty, names, names.derived, true)) {
      add([...at, "sheetDifficulty", issue.key], issue.message);
    }
  }
  if (use.amountAdd) {
    const names = rulesetSheetNames(definition.sheet, definition.items);
    for (const issue of rulesetValueRefIssues(use.amountAdd, names, names.derived, true)) {
      add([...at, "amountAdd", issue.key], issue.message);
    }
  }
  // Read off its user's sheet (1.308): a scroll's eldritch blast by its reader's level.
  if (use.targetsScale) {
    const names = rulesetSheetNames(definition.sheet, definition.items);
    for (const issue of rulesetValueRefIssues(use.targetsScale.from, names, names.derived, true)) {
      add([...at, "targetsScale", "from", issue.key], issue.message);
    }
  }
  if (use.damageType && types && !types.has(use.damageType.trim().toLowerCase())) {
    add([...at, "damageType"], `Unknown damage type "${use.damageType}"`);
  }
  use.plus?.forEach((clause, index) => {
    if (clause.type && types && !types.has(clause.type.trim().toLowerCase())) {
      add([...at, "plus", index, "type"], `Unknown damage type "${clause.type}"`);
    }
    if (clause.save && !saves.has(clause.save.save)) {
      add([...at, "plus", index, "save", "save"], `Unknown save "${clause.save.save}"`);
    }
  });
  targetTestIssues(definition, use, at, add);
  cureIssues(definition, use, at, add);
  if (use.zone?.obscures) sightIssues(definition, use.zone.obscures.pierced, [...at, "zone", "obscures"], add);
  if (use.teleport?.smoke) sightIssues(definition, use.teleport.smoke.pierced, [...at, "teleport", "smoke"], add);
  zoneInsideIssues(definition, use.zone, [...at, "zone"], add);
  componentIssues(definition, use.components, [...at, "components"], add);
  if (use.casts !== undefined)
    castsIssues(definition, [use.casts], at, (_path, message) => add([...at, "casts"], message));
  // The biggest it reaches is one of the fight's sizes, and it is aimed at somebody (1.317).
  if (use.targetsUpTo !== undefined) {
    if (!definition.combat?.sizes?.order.some((one) => one.id === use.targetsUpTo)) {
      add(
        [...at, "targetsUpTo"],
        definition.combat?.sizes
          ? `Unknown size "${use.targetsUpTo}"`
          : '"targetsUpTo" reads combat.sizes, so the block declares "sizes" too',
      );
    }
    if (use.area) add([...at, "targetsUpTo"], '"targetsUpTo" is on a use pointed at a creature, not an area');
  }
  if (use.clears && !use.area)
    add([...at, "clears"], '"clears" takes growth off the cells of an area, so the use has one');
  // What it puts on its own reader (1.311): a scroll of Sunbeam's mote.
  use.appliesSelf?.forEach((applies, index) => {
    if (!conditions.has(applies.condition)) {
      add([...at, "appliesSelf", index, "condition"], `Unknown condition "${applies.condition}"`);
    }
  });
  use.applies?.forEach((applies, index) => {
    if (!conditions.has(applies.condition)) {
      add([...at, "applies", index, "condition"], `Unknown condition "${applies.condition}"`);
    }
    escapeDcIssues(definition, applies, [...at, "applies", index], add);
    if (applies.when) {
      const names = rulesetSheetNames(definition.sheet, definition.items);
      for (const issue of rulesetValueRefIssues(applies.when.value, names, names.derived)) {
        add([...at, "applies", index, "when", "value", issue.key], issue.message);
      }
    }
    if (applies.saveEnds && !saves.has(applies.saveEnds.save)) {
      add([...at, "applies", index, "saveEnds", "save"], `Unknown save "${applies.saveEnds.save}"`);
    }
  });
  // An item has no sheet row to read a save's number off, so it says its own.
  const asksForSave =
    !!use.save ||
    !!use.applies?.some((applies) => applies.saveEnds) ||
    !!use.plus?.some((clause) => clause.save && clause.save.difficulty === undefined);
  if (asksForSave && use.saveDifficulty === undefined && !use.sheetDifficulty) {
    add([...at, "saveDifficulty"], "A use that asks for a save says the number it is saved against");
  }
  value(use.saveDifficulty, "number", [...at, "saveDifficulty"]);
  if (use.charges !== undefined && !item.charges) {
    add([...at, "charges"], "A use that spends charges is on an item that holds some");
  }
  if (use.restore) {
    const pool = definition.sheet.live.pools.find((entry) => entry.id === use.restore!.pool);
    const health = definition.combat?.health ?? definition.battle?.health;
    if (!pool) add([...at, "restore", "pool"], `Unknown pool "${use.restore.pool}"`);
    else if (health && "pool" in health && health.pool === pool.id) {
      add([...at, "restore", "pool"], "Health comes back with a heal, not a restore");
    }
  }
  if (use.toHit && !use.attackRoll) add([...at, "toHit"], "A to-hit is for a use that rolls to hit");
  if (use.gate) {
    const { check, unless } = use.gate;
    const names = rulesetSheetNames(definition.sheet, definition.items);
    if ("skill" in check && !definition.sheet.skills.some((skill) => skill.id === check.skill)) {
      add([...at, "gate", "check", "skill"], `Unknown skill "${check.skill}"`);
    }
    if ("ability" in check && !definition.sheet.abilities.some((ability) => ability.id === check.ability)) {
      add([...at, "gate", "check", "ability"], `Unknown ability "${check.ability}"`);
    }
    // Both are read off the user's sheet with their live state and items, as a requirement is.
    if ("value" in check) {
      for (const issue of rulesetValueRefIssues(check.value, names, names.derived, true)) {
        add([...at, "gate", "check", "value", issue.key], issue.message);
      }
    }
    if (unless) {
      for (const issue of rulesetValueRefIssues(unless.value, names, names.derived, true)) {
        add([...at, "gate", "unless", "value", issue.key], issue.message);
      }
    }
    value(use.gate.difficulty, "number", [...at, "gate", "difficulty"]);
  }
  // A wound track has boxes and no buffer, as an ability's temporary points are refused there too.
  const health = definition.combat?.health ?? definition.battle?.health;
  const track =
    health && "track" in health ? definition.sheet.live.tracks.find((one) => one.id === health.track) : null;
  if (use.kindChoice && !definition.combat?.creatureTypes)
    add([...at, "kindChoice"], "This ruleset has no creature types to choose from");
  if (use.teleport && !definition.combat?.distance)
    add([...at, "teleport"], '"teleport" is measured in cells, so the combat block declares "distance" too');
  if (use.temporary && (track?.levels?.length || track?.boxes)) {
    add([...at, "temporary"], `Health is the wound track "${track.id}", which carries no buffer for temporary points`);
  }
  // Where the ruleset has no fight, the rest is read by nothing.
  const combat = definition.combat;
  if (!combat) return;
  if (!use.free && use.budget === undefined) add([...at, "budget"], "A use spends a budget, or is free");
  if (use.budget !== undefined && !combat.economy.budgets.some((budget) => budget.id === use.budget)) {
    add([...at, "budget"], `Unknown budget "${use.budget}"`);
  }
  // A worn item's rescue (1.259) takes a budget of the fight's own, as an entry's does.
  const rescueBudget = use.rescue?.budget;
  if (rescueBudget !== undefined && !combat.economy.budgets.some((budget) => budget.id === rescueBudget)) {
    add([...at, "rescue", "budget"], `Unknown budget "${rescueBudget}"`);
  }
  if (use.toHit) toHitIssues(definition, use.toHit, [...at, "toHit"], add, "An item's");
  // A pool fight throws harm with the ruleset's own die; healing is an amount and keeps its dice.
  const poolDie = combat.kind === "dice-pool" ? poolDieSides(definition) : undefined;
  if (poolDie !== undefined && use.kind !== "heal") {
    const wrongDie = (dice: string | undefined, path: (string | number)[]) => {
      if (dice === undefined || Number(/d(\d+)/.exec(dice)?.[1]) === poolDie) return;
      add(path, `A "dice-pool" fight throws d${poolDie}s, so damage dice are d${poolDie}s`);
    };
    wrongDie(use.amount?.dice, [...at, "amount", "dice"]);
    use.plus?.forEach((clause, index) => wrongDie(clause.dice, [...at, "plus", index, "dice"]));
  }
}

/** A checker for one value an item's attack or use writes down or reads off a stat: a stat of the
 *  kind the value is, every word an enum stat may hold one the value could be, and a written ability,
 *  skill or damage type one this ruleset has. */
function itemValueChecker(
  definition: RulesetDefinition,
  add: (path: (string | number)[], message: string) => void,
): (read: unknown, kind: "number" | "dice" | "abilities" | "skill" | "type", where: (string | number)[]) => void {
  const stats = new Map((definition.items?.stats ?? []).map((stat) => [stat.id, stat]));
  const abilities = new Set(definition.sheet.abilities.map((ability) => ability.id));
  const skills = new Set(definition.sheet.skills.map((skill) => skill.id));
  const declared = definition.combat?.damageTypes;
  const damageTypes = declared ? new Set(declared.map((type) => type.trim().toLowerCase())) : null;
  type Kind = "number" | "dice" | "abilities" | "skill" | "type";
  /** One value, written down or read off a stat: a stat of the kind the value is, and every word an
   *  enum stat may hold one the value could be. */
  return (read: unknown, kind: Kind, where: (string | number)[]) => {
    if (read === undefined) return;
    if (typeof read === "object" && read !== null && "stat" in read) {
      const id = (read as { stat: string }).stat;
      const stat = stats.get(id);
      if (!stat) return add([...where, "stat"], `Unknown item stat "${id}"`);
      const wanted = kind === "abilities" || kind === "skill" ? "enum" : kind;
      const fits = kind === "type" ? stat.type === "text" || stat.type === "enum" : stat.type === wanted;
      if (!fits) {
        return add(
          [...where, "stat"],
          kind === "type" ? `Item stat "${id}" must be text or enum` : `Item stat "${id}" must be ${wanted}`,
        );
      }
      if (stat.type !== "enum") return;
      const known = kind === "abilities" ? abilities : kind === "skill" ? skills : kind === "type" ? damageTypes : null;
      const unknown = known
        ? stat.values.find((word) => !known.has(kind === "type" ? word.trim().toLowerCase() : word))
        : undefined;
      if (unknown !== undefined) {
        const what = kind === "abilities" ? "an ability" : kind === "skill" ? "a skill" : "a damage type";
        add([...where, "stat"], `Item stat "${id}" holds "${unknown}", which is not ${what}`);
      }
      return;
    }
    if (kind === "abilities") {
      (read as string[]).forEach((id, index) => {
        if (!abilities.has(id)) add([...where, index], `Unknown ability "${id}"`);
      });
    } else if (kind === "skill" && !skills.has(read as string)) {
      add(where, `Unknown skill "${read as string}"`);
    } else if (kind === "type" && damageTypes && !damageTypes.has((read as string).trim().toLowerCase())) {
      add(where, `Unknown damage type "${read as string}"`);
    }
  };
}

/** What is wrong with a weapon's attack: every id it names is the ruleset's, every stat it reads is
 *  one of the item's own kind, and it asks only for what this ruleset's fights can do. */
function attackIssues(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  attack: RulesetItemAttack,
  at: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  // A ruleset without a combat block has no fight, so a weapon there is carried and read by nothing,
  // exactly as a catalog entry's `budget` is.
  const combat = definition.combat;
  if (!combat) return;
  // Used while worn, so an item that could never be worn could never be used.
  const takesSlots = Object.values(item.slots ?? {}).some((count) => count > 0);
  if (!takesSlots && !item.binds) add(at, "A weapon is used while it is worn, so it takes a slot or binds");
  if (!combat.economy.budgets.some((budget) => budget.id === attack.budget)) {
    add([...at, "budget"], `Unknown budget "${attack.budget}"`);
  }
  const value = itemValueChecker(definition, add);
  toHitIssues(definition, attack.toHit, [...at, "toHit"], add, "A weapon's");
  value(attack.damage.dice, "dice", [...at, "damage", "dice"]);
  value(attack.damage.abilities, "abilities", [...at, "damage", "abilities"]);
  value(attack.damage.bonus, "number", [...at, "damage", "bonus"]);
  value(attack.damage.type, "type", [...at, "damage", "type"]);
  if (attack.damage.sheetBonus) {
    const sheetNames = rulesetSheetNames(definition.sheet, definition.items);
    for (const issue of rulesetValueRefIssues(attack.damage.sheetBonus, sheetNames, sheetNames.derived, true)) {
      add([...at, "damage", "sheetBonus", issue.key], issue.message);
    }
  }
  if (attack.damage.rerollUpTo) {
    const sheetNames = rulesetSheetNames(definition.sheet, definition.items);
    for (const issue of rulesetValueRefIssues(attack.damage.rerollUpTo, sheetNames, sheetNames.derived, true)) {
      add([...at, "damage", "rerollUpTo", issue.key], issue.message);
    }
  }
  if (attack.damage.oneHanded && !attack.damage.sheetBonus) {
    add([...at, "damage", "oneHanded"], "oneHanded says when the damage's sheetBonus counts, so it needs one");
  }
  value(attack.reach, "number", [...at, "reach"]);
  value(attack.range?.normal, "number", [...at, "range", "normal"]);
  value(attack.range?.long, "number", [...at, "range", "long"]);
  value(attack.versatile?.dice, "dice", [...at, "versatile", "dice"]);
  // Read off the holder's sheet as the fight finds it.
  const names = rulesetSheetNames(definition.sheet, definition.items);
  if (attack.strikes) {
    for (const issue of rulesetValueRefIssues(attack.strikes, names, names.derived, true)) {
      add([...at, "strikes", issue.key], issue.message);
    }
  }
  if (attack.damage.minimum) {
    const minimum = attack.damage.minimum;
    if ("stat" in minimum) value(minimum, "number", [...at, "damage", "minimum"]);
    else {
      for (const issue of rulesetValueRefIssues(minimum, names, names.derived, true)) {
        add([...at, "damage", "minimum", issue.key], issue.message);
      }
      if (minimum.const !== undefined && minimum.const < 0)
        add([...at, "damage", "minimum"], "Minimum damage dice cannot be negative");
    }
    if (combat.kind !== "dice-pool") add([...at, "damage", "minimum"], 'Minimum damage dice need a "dice-pool" fight');
  }
  if (attack.strikes?.const !== undefined && attack.strikes.const < 1) {
    add([...at, "strikes", "const"], "One spend buys at least one strike");
  }
  const pooled = definition.resolution.kind === "dice-pool";
  // A summed fight's hit already deals its dice; a pool fight's deals its successes, and dice on top.
  if (!pooled && attack.damage.dice === undefined) add([...at, "damage", "dice"], "A weapon deals dice");
  if (pooled && attack.damage.rerollUpTo) {
    add([...at, "damage", "rerollUpTo"], "A pool fight's damage is successes, not faces, so it has nothing to reroll");
  }
  if (!combat.distance) {
    for (const key of ["reach", "range"] as const) {
      if (attack[key] !== undefined) {
        add([...at, key], `"${key}" is measured in cells, so the combat block declares "distance" too`);
      }
    }
  }
  const normal = attack.range?.normal;
  const long = attack.range?.long;
  if (typeof normal === "number" && typeof long === "number" && long < normal) {
    add([...at, "range", "long"], "The long distance is at least the ordinary one");
  }
  if (attack.versatile && !takesSlots) {
    add([...at, "versatile"], "Versatile dice are for a hand free beside the weapon, so it takes a slot");
  }
  if (attack.ammo && !(definition.items?.tags ?? []).some((tag) => tag.id === attack.ammo!.tag)) {
    add([...at, "ammo", "tag"], `Unknown item tag "${attack.ammo.tag}"`);
  }
  if (attack.clip) {
    value(attack.clip.max, "number", [...at, "clip", "max"]);
    if (!combat.economy.budgets.some((budget) => budget.id === attack.clip!.reload)) {
      add([...at, "clip", "reload"], `Unknown budget "${attack.clip.reload}"`);
    }
    // What was loaded and fired is not picked up again: a share comes back only of what was shot
    // straight out of the bag.
    if (attack.ammo?.recover !== undefined) {
      add(
        [...at, "ammo", "recover"],
        "A clip's rounds are not picked up after a fight, so recover is for a weapon without one",
      );
    }
    if (typeof attack.clip.max === "number" && (attack.ammo?.perAttack ?? 1) > attack.clip.max) {
      add([...at, "ammo", "perAttack"], "One attack would shoot more than the clip holds");
    }
  }
  const modeIds = new Set<string>();
  attack.modes?.forEach((mode, index) => {
    const where = [...at, "modes", index];
    if (modeIds.has(mode.id)) add([...where, "id"], `The mode "${mode.id}" is listed twice`);
    modeIds.add(mode.id);
    if (mode.ammo !== undefined) {
      if (!attack.ammo && !attack.clip) {
        add([...where, "ammo"], "A mode's ammo is what one attack in it shoots, so the weapon shoots something");
      } else if (typeof attack.clip?.max === "number" && mode.ammo > attack.clip.max) {
        add([...where, "ammo"], "One attack in this mode would shoot more than the clip holds");
      }
    }
    if (mode.target !== undefined) {
      const target = definition.resolution.kind === "dice-pool" ? definition.resolution.target : undefined;
      if (!target || target.min >= target.max) {
        add([...where, "target"], "A mode's target moves a pool fight's own, so the pool's target can move");
      }
    }
    // Its own reach, bolt and charges (1.190).
    if (mode.range && !combat.distance) {
      add([...where, "range"], '"range" is measured in cells, so the combat block declares "distance" too');
    }
    if (mode.range?.long !== undefined && mode.range.long < mode.range.normal) {
      add([...where, "range", "long"], "The long distance is at least the ordinary one");
    }
    if (mode.line) {
      if (!combat.distance)
        add([...where, "line"], 'A line runs across the board, so the combat block declares "distance" too');
      if (!definition.sheet.saves.some((save) => save.id === mode.line!.save.save)) {
        add([...where, "line", "save", "save"], `Unknown save "${mode.line.save.save}"`);
      }
      const types = combat.damageTypes?.map((type) => type.trim().toLowerCase());
      if (mode.line.type && types && !types.includes(mode.line.type.trim().toLowerCase())) {
        add([...where, "line", "type"], `Unknown damage type "${mode.line.type}"`);
      }
    }
    mode.plus?.forEach((clause, index) => plusClauseIssues(definition, clause, [...where, "plus", index], add));
    if (mode.charges !== undefined && !item.charges) {
      add([...where, "charges"], "A mode that spends charges is on an item that holds some");
    }
  });
  if (attack.offHand && !combat.offHand) {
    add([...at, "offHand"], "An off-hand attack spends combat.offHand's budget, so the combat block declares one");
  }
  value(attack.floor, "number", [...at, "floor"]);
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const damageTypes = definition.combat?.damageTypes?.map((type) => type.trim().toLowerCase());
  attack.onHit?.forEach((entry, index) => {
    if (!conditions.has(entry.condition))
      add([...at, "onHit", index, "condition"], `Unknown condition "${entry.condition}"`);
    for (const key of ["save", "saveEnds"] as const) {
      const save = entry[key]?.save;
      if (save !== undefined && !saves.has(save)) add([...at, "onHit", index, key, "save"], `Unknown save "${save}"`);
    }
    // One that ends on a save has no clock of its own to run beside it.
    if (entry.saveEnds && entry.rounds !== undefined) {
      add([...at, "onHit", index, "rounds"], "A condition that ends on a save lasts until it is made, not some rounds");
    }
    targetIsIssues(definition, entry.targetIs, [...at, "onHit", index, "targetIs"], add);
  });
  attack.against?.forEach((entry, index) => {
    targetIsIssues(definition, entry.is, [...at, "against", index, "is"], add);
    if (entry.marked !== undefined && !conditions.has(entry.marked))
      add([...at, "against", index, "marked"], `Unknown condition "${entry.marked}"`);
    if (entry.mode && !(combat.attackRoll?.advantage ?? combat.pool?.advantage)) {
      add([...at, "against", index, "mode"], "A fight that never rolls twice has no mode to change");
    }
  });
  attack.slay?.forEach((entry, index) => {
    const where = [...at, "slay", index];
    targetIsIssues(definition, entry.is, [...where, "is"], add);
    targetIsIssues(definition, entry.not, [...where, "not"], add);
    if (entry.save && !saves.has(entry.save.save)) add([...where, "save", "save"], `Unknown save "${entry.save.save}"`);
    entry.immuneTo?.forEach((type, typeIndex) => {
      if (damageTypes && !damageTypes.includes(type.trim().toLowerCase()))
        add([...where, "immuneTo", typeIndex], `Unknown damage type "${type}"`);
    });
    // What it spends is the item's own count, so the item has one.
    if (entry.charges !== undefined && !item.charges) {
      add([...where, "charges"], "A slay that spends charges is on an item that holds some");
    }
    // What a made save leaves instead (1.192) is the ruleset's own conditions.
    entry.saved?.forEach((applies, appliesIndex) => {
      if (!conditions.has(applies.condition))
        add([...where, "saved", appliesIndex, "condition"], `Unknown condition "${applies.condition}"`);
      escapeDcIssues(definition, applies, [...where, "saved", appliesIndex], add);
    });
  });
  // Charges spent on a hit (1.273) are the item's own, and what they put on the target is the
  // ruleset's.
  attack.spends?.forEach((spend, index) => {
    const where = [...at, "spends", index];
    if (!item.charges) add([...where, "charges"], "Charges spent on a hit are the item's own, so it holds some");
    if (spend.type !== undefined && damageTypes && !damageTypes.includes(spend.type.trim().toLowerCase()))
      add([...where, "type"], `Unknown damage type "${spend.type}"`);
    spend.onHit?.forEach((entry, entryIndex) => {
      if (!conditions.has(entry.condition))
        add([...where, "onHit", entryIndex, "condition"], `Unknown condition "${entry.condition}"`);
      for (const key of ["save", "saveEnds"] as const) {
        const save = entry[key]?.save;
        if (save !== undefined && !saves.has(save))
          add([...where, "onHit", entryIndex, key, "save"], `Unknown save "${save}"`);
      }
    });
  });
  // An oathbow's other weapons (1.192): a condition the ruleset has, in a fight that rolls twice.
  if (attack.othersWhileMarked) {
    const rule = attack.othersWhileMarked;
    if (!conditions.has(rule.condition))
      add([...at, "othersWhileMarked", "condition"], `Unknown condition "${rule.condition}"`);
    if (!(combat.attackRoll?.advantage ?? combat.pool?.advantage)) {
      add([...at, "othersWhileMarked", "mode"], "A fight that never rolls twice has no mode to change");
    }
  }
  attack.plus?.forEach((clause, index) => plusClauseIssues(definition, clause, [...at, "plus", index], add));
}

/** One clause of an item's blow, or of one of its modes (1.190), against the ruleset's names. */
function plusClauseIssues(
  definition: RulesetDefinition,
  clause: z.infer<typeof itemPlusClauseSchema>,
  where: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const damageTypes = definition.combat?.damageTypes?.map((type) => type.trim().toLowerCase());
  if (clause.type && damageTypes && !damageTypes.includes(clause.type.trim().toLowerCase())) {
    add([...where, "type"], `Unknown damage type "${clause.type}"`);
  }
  if (clause.save && !saves.has(clause.save.save))
    add([...where, "save", "save"], `Unknown save "${clause.save.save}"`);
  targetIsIssues(definition, clause.targetIs, [...where, "targetIs"], add);
  targetIsIssues(definition, clause.not, [...where, "not"], add);
  if (clause.marked !== undefined && !conditions.has(clause.marked))
    add([...where, "marked"], `Unknown condition "${clause.marked}"`);
}

/** What is wrong with one item against the ruleset's `items` block, as plain lines. An item the Game
 *  Master invented is read back through this, exactly as a catalog entry is checked. */
export function rulesetItemIssues(definition: RulesetDefinition, item: RulesetCatalogItem): string[] {
  const found: string[] = [];
  itemIssues(definition, item, [], (_path, message) => found.push(message));
  return found;
}

/** Stable keys also separate a skill's tier from its numeric bonus. */
export function rulesetBuilderRatingKey(target: RulesetBuilderRatingTarget): string {
  const [kind, id] = Object.entries(target)[0]!;
  return `${kind}/${id}`;
}

export function rulesetBuilderRatingBounds(
  definition: RulesetDefinition,
  target: RulesetBuilderRatingTarget,
): [number, number] {
  if ("ability" in target) {
    const ability = definition.sheet.abilities.find((entry) => entry.id === target.ability);
    return [ability?.min ?? 0, ability?.max ?? 0];
  }
  if ("field" in target) {
    const field = definition.sheet.fields.find((entry) => entry.id === target.field);
    return field?.type === "number" ? [field.min, field.max] : [0, 0];
  }
  if ("bonus" in target) return [definition.sheet.bonusRange.min, definition.sheet.bonusRange.max];
  const map = definition.sheet.builder?.ratingTiers?.find(
    (entry) => rulesetBuilderRatingKey(entry.target) === rulesetBuilderRatingKey(target),
  );
  return [0, (map?.tiers.length ?? 1) - 1];
}

function builderRatingTargetIssues(
  definition: RulesetDefinition,
  target: RulesetBuilderRatingTarget,
  path: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const { sheet } = definition;
  const exists =
    "ability" in target
      ? sheet.abilities.some((entry) => entry.id === target.ability)
      : "field" in target
        ? sheet.fields.some((entry) => entry.id === target.field && entry.type === "number")
        : "skill" in target
          ? sheet.skills.some((entry) => entry.id === target.skill)
          : "save" in target
            ? sheet.saves.some((entry) => entry.id === target.save)
            : [...sheet.skills, ...sheet.saves].some((entry) => entry.id === target.bonus);
  if (!exists) add(path, "Unknown or nonnumeric rating target");
  if (
    ("skill" in target || "save" in target) &&
    !sheet.builder?.ratingTiers?.some(
      (entry) => rulesetBuilderRatingKey(entry.target) === rulesetBuilderRatingKey(target),
    )
  )
    add(path, "Skill and save ratings require an explicit tier map");
}

/** Choice constraints use declared catalog filters and bounded counts, never predicates. */
function builderLimitsIssues(
  limits: RulesetBuilderCatalogLimits,
  catalog: RulesetCatalogHeader | undefined,
  max: number,
  path: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const filterOf = (id: string) => catalog?.filters?.find((filter) => filter.id === id);
  limits.quotas?.forEach((quota, index) => {
    const at = [...path, "quotas", index];
    const filter = filterOf(quota.filter);
    if (!filter || (filter.type === "number") !== (typeof quota.value === "number"))
      add(at, "A quota needs an existing filter and a value of its type");
    if (quota.min > quota.max || quota.max > max) add(at, "A quota needs 0 <= min <= max <= the choice maximum");
  });
  if (limits.distinctBy && !filterOf(limits.distinctBy)) add([...path, "distinctBy"], "Unknown distinctness filter");
  if (limits.quotaBelow && filterOf(limits.quotaBelow.filter)?.type !== "number")
    add([...path, "quotaBelow"], "A pyramid needs a number filter");
}

function builderChoiceIssues(
  definition: RulesetDefinition,
  choice: RulesetBuilderChoice & {
    tier?: string;
    held?: string;
    what?: "skills" | "saves";
    onDuplicate?: "replace";
    replacementFrom?: string[];
  },
  path: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
  grantedTier?: string,
): void {
  if (choice.replacementFrom) {
    if (choice.onDuplicate !== "replace")
      add([...path, "replacementFrom"], "Only a choice that replaces duplicates names what replaces them");
    const known = new Set(definition.sheet[choice.what ?? "skills"].map((entry) => entry.id));
    choice.replacementFrom.forEach((id, index) => {
      if (!known.has(id))
        add([...path, "replacementFrom", index], `Unknown ${choice.what === "saves" ? "save" : "skill"} "${id}"`);
    });
  }
  if (choice.countFrom && choice.max === undefined) add([...path, "max"], "A counted choice declares its maximum");
  if (choice.max !== undefined && choice.count > choice.max) add([...path, "count"], "Count exceeds the maximum");
  if (choice.countFrom) {
    const names = rulesetSheetNames(definition.sheet, definition.items);
    for (const issue of rulesetValueRefIssues(choice.countFrom, names, names.derived, false))
      add([...path, "countFrom", issue.key], issue.message);
  }
  if (choice.tier !== undefined) {
    const offered = choice.what === "skills" ? definition.sheet.skillTiers : definition.sheet.saveTiers;
    if (
      definition.resolution.proficiencyTiers.findIndex((tier) => tier.id === choice.tier) < 1 ||
      (offered && !offered.includes(choice.tier))
    )
      add([...path, "tier"], "A choice needs an offered tier above untrained");
  }
  if (choice.held !== undefined) {
    const tiers = definition.resolution.proficiencyTiers;
    const sheet = definition.sheet;
    const held = tiers.findIndex((tier) => tier.id === choice.held);
    // The tier the choice trains to, as the builder reads it: its own, the builder's, else the first.
    const named = tiers.findIndex((tier) => tier.id === (choice.tier ?? grantedTier ?? definition.sheet.builder?.tier));
    const offered = choice.what === "skills" ? sheet.skillTiers : sheet.saveTiers;
    const first = tiers.findIndex((tier, at) => at >= 1 && (!offered || offered.includes(tier.id)));
    const own = named >= 1 ? named : first >= 1 ? first : 1;
    if (held < 1) {
      add([...path, "held"], `"${choice.held}" is not a tier above untrained`);
    } else if (held >= own) {
      add(
        [...path, "held"],
        `"${choice.held}" is not below the tier this choice trains to, so nothing it builds on could be raised`,
      );
    }
  }
}

/** Forward-only choice references and sheet reads keep a change from enabling its own prerequisite.
 * Catalog files are checked with their entries substituted; unknown later files are conservative. */
function builderChoicesIssues(
  definition: RulesetDefinition,
  add: (path: (string | number)[], message: string) => void,
): void {
  const steps = definition.sheet.builder?.steps ?? [];
  // A free grant can deactivate paid dots across a group's shared budget, including earlier stages.
  const ratingGroups = steps.flatMap((step) => (step.kind === "allocate" ? step.groups : []));
  const ratingPeers = new Map<string, RulesetBuilderRatingTarget[]>();
  const freeRatingTargets = (target: RulesetBuilderRatingTarget): RulesetBuilderRatingTarget[] => {
    const key = rulesetBuilderRatingKey(target);
    const cached = ratingPeers.get(key);
    if (cached) return cached;
    const found = new Map([[key, target]]);
    let size = 0;
    while (size !== found.size) {
      size = found.size;
      for (const group of ratingGroups) {
        if (group.targets.some((target) => found.has(rulesetBuilderRatingKey(target))))
          for (const target of group.targets) found.set(rulesetBuilderRatingKey(target), target);
      }
    }
    const peers = [...found.values()];
    for (const key of found.keys()) ratingPeers.set(key, peers);
    return peers;
  };
  const seen = new Map<string, string>();
  const changes = steps.map((step) => {
    const writes = {
      abilities: new Set<string>(),
      fields: new Set<string>(),
      skills: new Set<string>(),
      saves: new Set<string>(),
      lists: new Set<string>(),
    };
    const ratingWrites = (target: RulesetBuilderRatingTarget) => {
      if ("ability" in target) writes.abilities.add(target.ability);
      else if ("field" in target) writes.fields.add(target.field);
      else if ("skill" in target) writes.skills.add(target.skill);
      else if ("save" in target) writes.saves.add(target.save);
      else {
        writes.skills.add(target.bonus);
        writes.saves.add(target.bonus);
      }
    };
    if (step.kind === "spend")
      for (const offer of step.offers) {
        ratingWrites(offer.target);
        if (offer.exchange) ratingWrites(offer.exchange.from);
      }
    if (step.kind === "allocate")
      for (const group of step.groups) for (const target of group.targets) ratingWrites(target);
    if (step.kind === "abilities") for (const ability of definition.sheet.abilities) writes.abilities.add(ability.id);
    if (step.kind === "fields") for (const id of step.fields) writes.fields.add(id);
    if (step.kind === "rows") writes.lists.add(step.list);
    if (step.kind === "trained")
      for (const choice of step.choose ?? [])
        for (const id of choice.onDuplicate
          ? definition.sheet[choice.what].map((entry) => entry.id)
          : (choice.from ?? definition.sheet[choice.what].map((entry) => entry.id)))
          writes[choice.what].add(id);
    if (step.kind === "catalog") {
      if (step.field) writes.fields.add(step.field);
      const catalog = definition.catalogs?.find((entry) => entry.id === step.catalog);
      for (const entry of catalog?.entries ?? []) {
        const grants = entry.grants;
        const freeRatingWrites = (target: RulesetBuilderRatingTarget) => {
          for (const peer of freeRatingTargets(target)) ratingWrites(peer);
        };
        for (const grant of grants?.ratings ?? []) freeRatingWrites(grant.target);
        for (const id of Object.keys(grants?.abilities?.add ?? {})) freeRatingWrites({ ability: id });
        for (const choice of grants?.abilities?.choose ?? [])
          for (const ability of definition.sheet.abilities)
            if ((!choice.from || choice.from.includes(ability.id)) && !choice.except?.includes(ability.id))
              freeRatingWrites({ ability: ability.id });
        for (const id of Object.keys(grants?.sets ?? {})) freeRatingWrites({ field: id });
        for (const what of ["skills", "saves"] as const)
          for (const id of grants?.trained?.[what] ?? [])
            freeRatingWrites(what === "skills" ? { skill: id } : { save: id });
        for (const choice of grants?.trained?.choose ?? [])
          for (const id of choice.onDuplicate
            ? definition.sheet[choice.what].map((entry) => entry.id)
            : (choice.from ?? definition.sheet[choice.what].map((entry) => entry.id)))
            freeRatingWrites(choice.what === "skills" ? { skill: id } : { save: id });
        for (const row of entry.rows ?? []) writes.lists.add(row.list);
        for (const choice of grants?.entries?.choose ?? [])
          for (const id of definition.catalogs?.find((catalog) => catalog.id === choice.catalog)?.feeds ?? [])
            writes.lists.add(id);
      }
    }
    return writes;
  });
  // A conditional host also controls the choices displayed there, even when an earlier pick grants them.
  steps.forEach((step, hostIndex) => {
    if (!step.when) return;
    for (const catalog of definition.catalogs ?? [])
      for (const entry of catalog.entries ?? []) {
        if (step.kind === "trained" && steps.find((each) => each.kind === "trained") === step)
          for (const choice of entry.grants?.trained?.choose ?? [])
            for (const id of choice.onDuplicate
              ? definition.sheet[choice.what].map((entry) => entry.id)
              : (choice.from ?? definition.sheet[choice.what].map((entry) => entry.id)))
              changes[hostIndex]![choice.what].add(id);
        if (
          step.kind === "choices" &&
          steps.find((each) => each.kind === "choices" && each.catalog === step.catalog) === step
        )
          for (const choice of entry.grants?.entries?.choose ?? [])
            if (choice.catalog === step.catalog)
              for (const id of definition.catalogs?.find((each) => each.id === choice.catalog)?.feeds ?? [])
                changes[hostIndex]!.lists.add(id);
      }
  });
  steps.forEach((step, index) => {
    const path = ["sheet", "builder", "steps", index];
    const checkRead = (ref: RulesetValueRef | undefined, at: (string | number)[], choiceCount = false) => {
      if (!ref) return;
      const reads = refReadsSheet(definition, ref);
      for (const what of ["skills", "saves"] as const)
        for (const id of reads[what]) {
          const cap = definition.sheet[what].find((entry) => entry.id === id)?.cap;
          if (cap) refReadsSheet(definition, cap, reads);
        }
      if ((reads.skills.size || reads.saves.size) && definition.resolution.proficiency?.bonus)
        refReadsSheet(definition, definition.resolution.proficiency.bonus, reads);
      // Step conditions are declared in the definition and checked again with each catalog file.
      // A count inside a catalog file cannot inspect another later file's writes.
      if (
        choiceCount &&
        Object.values(reads).some((ids) => ids.size > 0) &&
        steps
          .slice(index)
          .some(
            (step) =>
              step.kind === "catalog" &&
              definition.catalogs?.some(
                (catalog) => catalog.id === step.catalog && ((catalog.asset && !catalog.entries) || catalog.from),
              ),
          )
      ) {
        add(at, "A choice count cannot depend on unread later catalog files");
      }
      for (const writes of changes.slice(index)) {
        for (const key of Object.keys(reads) as (keyof typeof reads)[])
          if ([...reads[key]].some((id) => writes[key].has(id))) {
            add(at, "Builder conditions and counts may only read values changed by earlier steps");
            return;
          }
      }
    };
    if (step.kind === "spend") {
      const checkSpendRead = (ref: RulesetValueRef | undefined, at: (string | number)[]) => {
        checkRead(ref, at, true);
        if (!ref) return;
        const reads = refReadsSheet(definition, ref);
        for (const what of ["skills", "saves"] as const)
          for (const id of reads[what]) {
            const cap = definition.sheet[what].find((entry) => entry.id === id)?.cap;
            if (cap) refReadsSheet(definition, cap, reads);
          }
        if ((reads.skills.size || reads.saves.size) && definition.resolution.proficiency?.bonus)
          refReadsSheet(definition, definition.resolution.proficiency.bonus, reads);
        steps.forEach((other, otherIndex) => {
          if (other.kind !== "spend") return;
          for (const key of Object.keys(reads) as (keyof typeof reads)[])
            if ([...reads[key]].some((id) => changes[otherIndex]![key].has(id)))
              add(at, "Spending budgets and conditions cannot read purchased targets");
        });
      };
      checkSpendRead(definition.sheet.builder?.pools?.find((pool) => pool.id === step.pool)?.budget, [...path, "pool"]);
      checkSpendRead(step.when, [...path, "when"]);
      step.offers.forEach((offer, offerIndex) => {
        offer.overrides?.forEach((override, overrideIndex) =>
          checkSpendRead(override.when, [...path, "offers", offerIndex, "overrides", overrideIndex, "when"]),
        );
        for (const key of ["when", "minFrom", "maxFrom"] as const)
          checkSpendRead(offer[key], [...path, "offers", offerIndex, key]);
      });
    }
    checkRead(step.when, [...path, "when"]);
    if (step.kind === "allocate")
      step.groups.forEach((group, groupIndex) => {
        for (const key of ["base", "min", "max", "budget"] as const) {
          const ref = group[key];
          if (typeof ref === "object") checkRead(ref, [...path, "groups", groupIndex, key], true);
        }
      });
    // requiredWhen only changes a badge, so it cannot cause a grant cycle.
    if (step.kind === "catalog" && (step.quotas || step.distinctBy || step.quotaBelow))
      checkRead(step.countFrom, [...path, "countFrom"]);
    const groups: {
      choices: (RulesetBuilderChoice & { what?: string; catalog?: string })[];
      kind: string;
      path: (string | number)[];
    }[] = [];
    if (step.kind === "trained")
      groups.push({ choices: step.choose ?? [], kind: "trained", path: [...path, "choose"] });
    if (step.kind === "catalog") {
      const catalogIndex = definition.catalogs?.findIndex((catalog) => catalog.id === step.catalog) ?? -1;
      const catalog = definition.catalogs?.[catalogIndex];
      if (steps.some((step) => step.kind === "allocate")) {
        checkRead(step.countFrom, [...path, "countFrom"], true);
        checkRead(step.upTo?.value, [...path, "upTo", "value"], true);
      }
      for (const [entryIndex, entry] of (catalog?.entries ?? []).entries()) {
        if (entry.grants?.ratings || steps.some((step) => step.kind === "allocate"))
          checkRead(entry.offeredWhen, ["catalogs", catalogIndex, "entries", entryIndex, "offeredWhen"], true);
        for (const kind of ["abilities", "trained", "entries"] as const) {
          groups.push({
            choices: entry.grants?.[kind]?.choose ?? [],
            kind,
            path: ["catalogs", catalogIndex, "entries", entryIndex, "grants", kind, "choose"],
          });
        }
      }
    }
    for (const group of groups)
      group.choices.forEach((choice, choiceIndex) => {
        const at = [...group.path, choiceIndex];
        const kind =
          group.kind === "trained" ? choice.what! : group.kind === "entries" ? `entries:${choice.catalog}` : group.kind;
        checkRead(choice.countFrom, [...at, "countFrom"], true);
        // ponytail: references resolve within the definition or this catalog file; cross-file
        // exclusions need a bundle validation pass with every catalog loaded.
        for (const ref of choice.excludeChoices ?? [])
          if (seen.get(ref) !== kind) add([...at, "excludeChoices"], `No earlier choice "${ref}" of the same kind`);
        if (choice.id) {
          const key = `${step.id}/${choice.id}`;
          if (seen.has(key)) add([...at, "id"], `Duplicate builder choice "${key}"`);
          seen.set(key, kind);
        }
      });
  });
}

/** A builder grant names the sheet's own scores, skills, saves, tiers and fields, and a field's value
 *  is one it can hold. */
function grantsIssues(
  definition: RulesetDefinition,
  grants: z.infer<typeof catalogGrantsSchema>,
  path: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const { sheet } = definition;
  grants.ratings?.forEach((grant, index) => {
    const at = [...path, "ratings", index];
    builderRatingTargetIssues(definition, grant.target, [...at, "target"], add);
    const [min, max] = rulesetBuilderRatingBounds(definition, grant.target);
    if ("set" in grant && (grant.set < min || grant.set > max))
      add(at, "Rating grant is outside the target's bounds or tier map");
  });
  const abilities = new Set(sheet.abilities.map((ability) => ability.id));
  for (const id of Object.keys(grants.abilities?.add ?? {})) {
    if (!abilities.has(id)) add([...path, "abilities", "add", id], `Unknown ability "${id}"`);
  }
  grants.abilities?.choose?.forEach((choice, index) => {
    builderChoiceIssues(definition, choice, [...path, "abilities", "choose", index], add);
    choice.from?.forEach((id) => {
      if (!abilities.has(id)) add([...path, "abilities", "choose", index, "from"], `Unknown ability "${id}"`);
    });
    if (choice.max !== undefined && choice.max > 6)
      add([...path, "abilities", "choose", index, "max"], "At most six ability picks");
    choice.except?.forEach((id, idIndex) => {
      if (!abilities.has(id))
        add([...path, "abilities", "choose", index, "except", idIndex], `Unknown ability "${id}"`);
    });
    const open = sheet.abilities.filter((ability) => !choice.except?.includes(ability.id)).length;
    if (choice.repeat ? open < 1 : choice.count > open)
      add([...path, "abilities", "choose", index, "count"], `Only ${open} scores are left to choose`);
  });
  const known = {
    skills: new Set(sheet.skills.map((skill) => skill.id)),
    saves: new Set(sheet.saves.map((save) => save.id)),
  };
  for (const what of ["skills", "saves"] as const) {
    grants.trained?.[what]?.forEach((id, index) => {
      if (!known[what].has(id))
        add([...path, "trained", what, index], `Unknown ${what === "skills" ? "skill" : "save"} "${id}"`);
    });
  }
  grants.trained?.choose?.forEach((choice, index) => {
    builderChoiceIssues(definition, choice, [...path, "trained", "choose", index], add, grants.trained?.tier);
    choice.from?.forEach((id, idIndex) => {
      if (!known[choice.what].has(id)) {
        add(
          [...path, "trained", "choose", index, "from", idIndex],
          `Unknown ${choice.what === "skills" ? "skill" : "save"} "${id}"`,
        );
      }
    });
  });
  const tiers = definition.resolution.proficiencyTiers;
  if (grants.trained && tiers.length < 2) add([...path, "trained"], "This ruleset has no tier above untrained");
  if (grants.trained?.tier !== undefined) {
    const at = tiers.findIndex((tier) => tier.id === grants.trained!.tier);
    if (at < 1) add([...path, "trained", "tier"], `"${grants.trained.tier}" is not a tier above untrained`);
  }
  for (const [id, value] of Object.entries(grants.sets ?? {})) {
    const field = sheet.fields.find((each) => each.id === id);
    if (!field) {
      add([...path, "sets", id], `Unknown field "${id}"`);
      continue;
    }
    const fits =
      field.type === "number"
        ? typeof value === "number" && value >= field.min && value <= field.max
        : field.type === "boolean"
          ? typeof value === "boolean"
          : field.type === "enum"
            ? typeof value === "string" && field.values.includes(value)
            : field.type === "text" || field.type === "longtext"
              ? typeof value === "string" && value.length <= field.maxLength
              : typeof value === "string";
    if (!fits) add([...path, "sets", id], `Field "${id}" cannot hold ${JSON.stringify(value)}`);
  }
  // Items open to the character (1.215): each one of the ruleset's items, never a service. A catalog
  // kept in its own file is checked when its entries are read.
  grants.itemAccess?.forEach((ref, index) => {
    const at = [...path, "itemAccess", index];
    const [catalogId, entryId] = ref.split("/") as [string, string];
    const catalog = definition.catalogs?.find((each) => each.id === catalogId);
    if (!catalog || catalog.holds !== "items") return add(at, `No item catalog "${catalogId}"`);
    if (!catalog.entries || catalog.from) return;
    const entry = catalog.entries.find((each) => each.id === entryId && each.item);
    if (!entry?.item) add(at, `No item "${entryId}" in catalog "${catalogId}"`);
    else if (entry.item.service) add(at, `"${entryId}" is a service, which is never carried`);
    if (grants.itemAccess!.indexOf(ref) !== index) add(at, `"${ref}" is named twice`);
  });
  // Entries to choose (1.91) are chosen at a `choices` step, which is what loads their catalog.
  grants.entries?.choose.forEach((choice, index) => {
    const at = [...path, "entries", "choose", index];
    builderChoiceIssues(definition, choice, at, add);
    builderLimitsIssues(
      choice,
      definition.catalogs?.find((catalog) => catalog.id === choice.catalog),
      choice.max ?? choice.count,
      at,
      add,
    );
    const hosted = sheet.builder?.steps.some((step) => step.kind === "choices" && step.catalog === choice.catalog);
    if (!hosted) add([...at, "catalog"], `No builder "choices" step for catalog "${choice.catalog}"`);
    const catalog = definition.catalogs?.find((each) => each.id === choice.catalog);
    for (const [filterId, value] of Object.entries(choice.filters ?? {})) {
      const filter = catalog?.filters?.find((each) => each.id === filterId);
      if (!filter) add([...at, "filters", filterId], `Unknown filter "${filterId}" of catalog "${choice.catalog}"`);
      else if ((filter.type === "number") !== (typeof value === "number")) {
        add(
          [...at, "filters", filterId],
          `Filter "${filterId}" takes ${filter.type === "number" ? "a number" : "a word"}`,
        );
      }
    }
  });
}

/** The column a list's rows are told apart by: its pools' name column, else its first text column. */
export function rulesetListNameColumn(list: RulesetList): string | undefined {
  return list.pools?.nameColumn ?? list.columns.find((column) => column.type === "text")?.id;
}

/** What a reaction answers, at its first moment and at every one it is `also` taken at: catalogs
 *  this ruleset has, and entries of them. Whether the entry itself is there is read with the catalog's
 *  own file, which may be kept apart; one that is not simply never opens the moment. */
function reactionAgainstIssues(
  catalogIds: ReadonlySet<string>,
  reaction: RulesetReactionMomentDeclaration,
  path: (string | number)[],
  add: (path: (string | number)[], message: string) => void,
): void {
  const one = (against: RulesetReactionMomentDeclaration["against"], at: (string | number)[]) => {
    against?.catalogs?.forEach((id, index) => {
      if (!catalogIds.has(id)) add([...at, "catalogs", index], `Unknown catalog "${id}"`);
    });
    against?.entries?.forEach((ref, index) => {
      const id = ref.slice(0, ref.indexOf("/"));
      if (!catalogIds.has(id)) add([...at, "entries", index], `Unknown catalog "${id}"`);
    });
  };
  one(reaction.against, [...path, "against"]);
  reaction.also?.forEach((moment, index) => one(moment.against, [...path, "also", index, "against"]));
}

/** What a pool check effect a row or entry applies (1.156) may ask of this ruleset's dice: a pool, and
 *  faces it lets a check move, as `mechanics.check` is held to. */
function contextualCheckIssues(
  resolution: RulesetDefinitionBase["resolution"],
  check: RulesetContextualCheck,
): { path: string[]; message: string }[] {
  // A highest-die check (1.217) may only take the best rating; everything else changes a pool.
  if (resolution.kind === "dice-highest" && Object.keys(check).every((key) => key === "best")) return [];
  if (resolution.kind !== "dice-pool")
    return [{ path: [], message: `A ${resolution.kind} ruleset has no pool for a check effect to change` }];
  const found: { path: string[]; message: string }[] = [];
  for (const key of ["explode", "double"] as const) {
    const face = check[key];
    if (face === undefined) continue;
    const min = resolution[key]?.min;
    if (min === undefined)
      found.push({ path: [key], message: `This ruleset gives resolution.${key} no min, so no check may move it` });
    else if (face < min || face > resolution.die.sides)
      found.push({
        path: [key],
        message: `This ruleset lets a check move ${key} from ${min} to ${resolution.die.sides}`,
      });
  }
  if (check.cancel === false && !resolution.cancel)
    found.push({ path: ["cancel"], message: "This ruleset has no resolution.cancel to switch off" });
  return found;
}

export function rulesetCatalogEntryIssues(
  definition: RulesetDefinition,
  catalog: RulesetCatalogHeader,
  entries: readonly RulesetCatalogEntry[],
  /** True when `definition` may have its layers applied (see `creatureSheetIssues`). */
  narrowedByLayers = false,
): RulesetCatalogEntryIssue[] {
  const issues: RulesetCatalogEntryIssue[] = [];
  const add = (path: (string | number)[], message: string) => issues.push({ path, message });
  if (catalog.asset)
    builderChoicesIssues(
      {
        ...definition,
        catalogs: definition.catalogs?.map((each) =>
          each.id === catalog.id ? { ...each, entries: [...entries] } : each,
        ),
      },
      (path, message) => {
        const catalogIndex = definition.catalogs?.findIndex((each) => each.id === catalog.id);
        if (path[0] === "catalogs" && path[1] === catalogIndex && path[2] === "entries") add(path.slice(3), message);
        else add([], `${path.join(".")}: ${message}`);
      },
    );
  const listById = new Map(definition.sheet.lists.map((list) => [list.id, list]));
  const names = rulesetSheetNames(definition.sheet, definition.items);
  const feeds = new Set(catalog.feeds ?? []);
  const filterById = new Map((catalog.filters ?? []).map((filter) => [filter.id, filter]));
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const liveConditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  // A budget can only be checked against a ruleset that declares an action economy. One without a
  // `combat` block has none, so `budget` is carried and read by nothing, exactly like `reaction`.
  const budgets = definition.combat ? new Set(definition.combat.economy.budgets.map((budget) => budget.id)) : null;
  // A cost names a live pool or a pool GROUP, because a system whose slots are one group per level
  // should be able to say "one slot of this group" without naming every pool.
  const costTargets = new Set(
    definition.sheet.live.pools.flatMap((pool) => [pool.id, ...(pool.group ? [pool.group] : [])]),
  );

  // A header read straight from a file, rather than through the schema, has no default filled in.
  const holds = catalog.holds ?? "rows";

  // What a fake may pass for, where it can be read now: this catalog's items and every inline one's.
  // A target in another catalog file is checked at install and when a market offers the fake.
  const itemsByRef = new Map<string, RulesetCatalogItem>();
  for (const other of definition.catalogs ?? []) {
    if (other.id === catalog.id) continue;
    for (const each of other.entries ?? []) if (each.item) itemsByRef.set(`${other.id}/${each.id}`, each.item);
  }
  for (const each of entries) if (each.item) itemsByRef.set(`${catalog.id}/${each.id}`, each.item);
  const readable = (ref: string) => {
    const catalogId = ref.slice(0, ref.indexOf("/"));
    return (
      catalogId === catalog.id || (definition.catalogs ?? []).some((each) => each.id === catalogId && each.entries)
    );
  };

  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) add([index, "id"], `Duplicate entry id "${entry.id}"`);
    // What it becomes on its last charge (1.272) is another item, where it can be read now.
    const becomes = entry.item?.charges?.breaksOn?.becomes;
    if (becomes !== undefined && becomes === `${catalog.id}/${entry.id}`) {
      add([index, "item", "charges", "breaksOn", "becomes"], "An item becomes another item");
    } else if (becomes !== undefined && readable(becomes) && !itemsByRef.has(becomes)) {
      add([index, "item", "charges", "breaksOn", "becomes"], `Unknown item "${becomes}"`);
    }
    // What its binding needs worn (1.313) are other items, each worn in its own right.
    entry.item?.binds?.needsWorn?.forEach((group, groupIndex) =>
      group.anyOf.forEach((ref, refIndex) => {
        const at = [index, "item", "binds", "needsWorn", groupIndex, "anyOf", refIndex];
        if (ref === `${catalog.id}/${entry.id}`) add(at, "An item's binding needs other items worn, not itself");
        else if (readable(ref) && !itemsByRef.has(ref)) add(at, `Unknown item "${ref}"`);
      }),
    );
    if (entry.item?.passesFor !== undefined && readable(entry.item.passesFor)) {
      const issue = rulesetFakeIssue(`${catalog.id}/${entry.id}`, entry.item, itemsByRef.get(entry.item.passesFor));
      if (issue) add([index, "item", "passesFor"], issue);
    }
    seen.add(entry.id);

    // One catalog, one kind of entry: the picker reads a catalog of rows, a fight a catalog of
    // creatures and the inventory a catalog of items, and none of them reads the others' entries.
    const kind = entry.creature ? "creatures" : entry.item ? "items" : "rows";
    if (kind === "rows" && holds !== "rows") {
      add(
        [index, holds === "creatures" ? "creature" : "item"],
        `Catalog "${catalog.id}" holds ${holds}, so every entry carries one`,
      );
    } else if (kind !== "rows" && kind !== holds) {
      add(
        [index, kind === "creatures" ? "creature" : "item"],
        `Catalog "${catalog.id}" holds ${holds}, so an entry cannot carry ${kind === "creatures" ? "a creature" : "an item"}`,
      );
    }
    if (entry.creature?.spellcasting) {
      const creature = entry.creature;
      const casting = creature.spellcasting!;
      // Components said in place of the entries' own (1.181) are the fight's own.
      componentIssues(definition, casting.components, [index, "creature", "spellcasting", "components"], add);
      casting.spells.forEach((spell, spellIndex) => {
        componentIssues(
          definition,
          spell.components,
          [index, "creature", "spellcasting", "spells", spellIndex, "components"],
          add,
        );
        const path = [index, "creature", "spellcasting", "spells", spellIndex, "entry"];
        const [catalogId, entryId] = spell.entry.split("/");
        const header = definition.catalogs?.find((other) => other.id === catalogId);
        if (!header) {
          add(path, `Unknown spell catalog "${catalogId}"`);
          return;
        }
        // A borrowed catalog's entries (1.220) are read with it, not here.
        const available = catalogId === catalog.id ? entries : header.from ? undefined : header.entries;
        // Another catalog file is checked once the import has read all its entries.
        if (!available) return;
        const target = available.find((other) => other.id === entryId);
        if (!target) {
          add(path, `Unknown spell entry "${spell.entry}"`);
          return;
        }
        const mechanics = target.mechanics;
        if (!mechanics) {
          add(path, `Spell entry "${spell.entry}" needs mechanics`);
          return;
        }
        if (creature.sheet) return;
        if (mechanics.attackRoll && casting.toHit === undefined)
          add(path, `Spell "${spell.entry}" needs spellcasting.toHit`);
        const needsSave =
          mechanics.save ||
          mechanics.plus?.some((part) => part.save && part.save.difficulty === undefined) ||
          mechanics.applies?.some((applies) => applies.saveEnds);
        if (needsSave && casting.saveDifficulty === undefined)
          add(path, `Spell "${spell.entry}" needs spellcasting.saveDifficulty`);
      });
    }
    if (entry.creature) creatureIssues(definition, entry.creature, [index, "creature"], add, narrowedByLayers);
    if (entry.item) itemIssues(definition, entry.item, [index, "item"], add);

    for (const [filterId, value] of Object.entries(entry.filters ?? {})) {
      const filter = filterById.get(filterId);
      if (!filter) {
        add([index, "filters", filterId], `Unknown filter "${filterId}"`);
        continue;
      }
      const matches =
        filter.type === "number"
          ? typeof value === "number"
          : filter.type === "text"
            ? typeof value === "string"
            : Array.isArray(value);
      if (!matches) {
        const wanted = filter.type === "tags" ? "a list of words" : filter.type === "text" ? "one word" : "a number";
        add([index, "filters", filterId], `Filter "${filterId}" takes ${wanted}`);
      }
    }

    if (entry.grants) grantsIssues(definition, entry.grants, [index, "grants"], add);
    if (entry.mechanics?.usableWhen) {
      for (const issue of rulesetValueRefIssues(entry.mechanics.usableWhen.value, names, names.derived)) {
        add([index, "mechanics", "usableWhen", "value", issue.key], issue.message);
      }
    }
    entry.mechanics?.attackRows?.forEach((rule, ruleIndex) => {
      for (const [key, ref] of [
        ["die", rule.die?.from],
        ["when", rule.when?.value],
      ] as const) {
        if (!ref) continue;
        for (const issue of rulesetValueRefIssues(ref, names, names.derived)) {
          add([index, "mechanics", "attackRows", ruleIndex, key, issue.key], issue.message);
        }
      }
    });
    if (entry.mechanics?.grantsStrike?.when) {
      for (const issue of rulesetValueRefIssues(entry.mechanics.grantsStrike.when.value, names, names.derived)) {
        add([index, "mechanics", "grantsStrike", "when", "value", issue.key], issue.message);
      }
    }
    if (entry.offeredWhen) {
      for (const issue of rulesetValueRefIssues(entry.offeredWhen, names, names.derived, false)) {
        add([index, "offeredWhen", issue.key], issue.message);
      }
      // The entry's own pick may not change what decides whether it is offered: that would offer it,
      // take it back, and offer it again, and no number of passes settles that.
      const reads = refReadsSheet(definition, entry.offeredWhen);
      const grants = entry.grants;
      const changed = [
        ...(grants?.ratings ?? [])
          .filter(({ target }) =>
            "ability" in target
              ? reads.abilities.has(target.ability)
              : "field" in target
                ? reads.fields.has(target.field)
                : "skill" in target
                  ? reads.skills.has(target.skill)
                  : "save" in target
                    ? reads.saves.has(target.save)
                    : reads.skills.has(target.bonus) || reads.saves.has(target.bonus),
          )
          .map(({ target }) => rulesetBuilderRatingKey(target)),
        ...Object.keys(grants?.abilities?.add ?? {}).filter((id) => reads.abilities.has(id)),
        ...(grants?.abilities?.choose ?? []).flatMap((choice) =>
          definition.sheet.abilities
            .map((ability) => ability.id)
            .filter((id) => !choice.except?.includes(id) && reads.abilities.has(id)),
        ),
        ...Object.keys(grants?.sets ?? {}).filter((id) => reads.fields.has(id)),
        ...(grants?.trained?.skills ?? []).filter((id) => reads.skills.has(id)),
        ...(grants?.trained?.saves ?? []).filter((id) => reads.saves.has(id)),
        ...(grants?.trained?.choose ?? []).flatMap((choice) =>
          [...(choice.what === "skills" ? reads.skills : reads.saves)].filter(
            (id) => !choice.from || choice.from.includes(id),
          ),
        ),
        ...(entry.rows ?? []).map((row) => row.list).filter((list) => reads.lists.has(list)),
      ];
      if (changed.length) {
        add([index, "offeredWhen"], `offeredWhen reads "${changed[0]}", which picking this entry changes`);
      }
    }

    // How many rows this entry writes into each list, because a row the ruleset keeps up to date is
    // matched to its spec from a marked row on a sheet: the entry's only row there, or (1.92) one of
    // several that each carry their own name in the list's name column.
    const rowsPerList = new Map<string, number>();
    for (const row of entry.rows ?? []) rowsPerList.set(row.list, (rowsPerList.get(row.list) ?? 0) + 1);
    const namedApart = (listId: string) => {
      const list = listById.get(listId);
      const nameColumn = list ? rulesetListNameColumn(list) : undefined;
      if (!nameColumn) return false;
      const names = (entry.rows ?? []).filter((row) => row.list === listId).map((row) => row.values[nameColumn]);
      return (
        names.every((name) => typeof name === "string" && name.trim() !== "") && new Set(names).size === names.length
      );
    };

    (entry.rows ?? []).forEach((row, rowIndex) => {
      const path = [index, "rows", rowIndex];
      if (!feeds.has(row.list)) return add([...path, "list"], `"${row.list}" is not one of this catalog's feeds`);
      const list = listById.get(row.list);
      if (!list) return add([...path, "list"], `Unknown list "${row.list}"`);
      for (const message of rulesetListRowIssues(list, row.values)) add([...path, "values"], message);
      if (!row.scaled) return;
      if ((rowsPerList.get(row.list) ?? 0) > 1 && !namedApart(row.list)) {
        add(
          [...path, "scaled"],
          `A scaled row must be this entry's only row for the list "${row.list}", or every row there must have its own name`,
        );
      }
      for (const [columnId, scaled] of Object.entries(row.scaled)) {
        const column = list.columns.find((candidate) => candidate.id === columnId);
        if (!column) add([...path, "scaled", columnId], `Unknown column "${columnId}"`);
        else if (column.type !== "number") add([...path, "scaled", columnId], `Column "${columnId}" is not a number`);
        // `values` holds what the row starts as, because an entry is picked before anything knows
        // which sheet it lands on. Without it a picked row would sit incomplete until the first
        // recompute, and a reader without the catalog would never see a number at all.
        else if (!Object.prototype.hasOwnProperty.call(row.values, columnId)) {
          add([...path, "values"], `Scaled column "${columnId}" needs a starting value in values`);
        }
        // A list may hold scaled cells, its own included, so a scaled column that added one up would
        // read numbers the same recompute is rewriting: itself, or another column that reads it back,
        // and never settle. Catalog files are checked one at a time, so no narrower rule could see
        // every such loop; a scaled column reads no list sum at all, however many steps away.
        if (refReadsListSum(definition, scaled.from)) {
          add(
            [...path, "scaled", columnId, "from"],
            "A scaled column cannot read a list sum: the lists it adds up hold scaled cells the same recompute rewrites",
          );
        }
        // A scaled column reads the sheet exactly as a live pool's maximum does, so any declared
        // derived value is fair game: there is no top-to-bottom order to sit inside out here.
        for (const refIssue of rulesetValueRefIssues(scaled.from, names, names.derived, false)) {
          add([...path, "scaled", columnId, "from", refIssue.key], refIssue.message);
        }
      }
    });

    const mechanics = entry.mechanics;
    if (mechanics?.reducesMax)
      reducesMaxIssues(definition, mechanics.reducesMax, [index, "mechanics", "reducesMax"], add);
    targetHoldsIssues(definition, mechanics?.targetHolds, [index, "mechanics", "targetHolds"], add);
    mechanics?.healthPoolSkips?.conditions?.forEach((condition, conditionIndex) => {
      if (!liveConditions.has(condition))
        add([index, "mechanics", "healthPoolSkips", "conditions", conditionIndex], `Unknown condition "${condition}"`);
    });
    // What a reaction answers is named by catalog, so it has to be one this ruleset has.
    if (mechanics?.reaction && typeof mechanics.reaction === "object") {
      const known = new Set((definition.catalogs ?? []).map((one) => one.id));
      reactionAgainstIssues(known, mechanics.reaction, [index, "mechanics", "reaction"], add);
      if (mechanics.reaction.cancelSave && !saves.has(mechanics.reaction.cancelSave.save))
        add(
          [index, "mechanics", "reaction", "cancelSave", "save"],
          `Unknown save "${mechanics.reaction.cancelSave.save}"`,
        );
    }
    if (mechanics?.save && !saves.has(mechanics.save.save)) {
      add([index, "mechanics", "save", "save"], `Unknown save "${mechanics.save.save}"`);
    }
    // The same names the first amount is held to. A clause's damage type is checked where the
    // ruleset says what its types are, exactly as a creature's is.
    const declaredTypes = definition.combat?.damageTypes
      ? new Set(definition.combat.damageTypes.map((type) => type.trim().toLowerCase()))
      : null;
    // The entry's OWN damage type is held to the same names its clauses are. It was not, which read
    // as the first amount being freer than the second one on the very same blow.
    if (mechanics?.damageType && declaredTypes && !declaredTypes.has(mechanics.damageType.trim().toLowerCase())) {
      add([index, "mechanics", "damageType"], `Unknown damage type "${mechanics.damageType}"`);
    }
    // What the harm carries past an exception is what a weapon's tags carry, so it is the ruleset's
    // own item tags, exactly as an exception's names are.
    if (mechanics?.qualities) {
      const itemTags = new Set((definition.items?.tags ?? []).map((tag) => tag.id));
      mechanics.qualities.forEach((tag, tagIndex) => {
        if (!itemTags.has(tag)) {
          add(
            [index, "mechanics", "qualities", tagIndex],
            itemTags.size ? `Unknown item tag "${tag}"` : "This ruleset declares no item tags for a blow to carry",
          );
        }
      });
    }
    mechanics?.plus?.forEach((clause, clauseIndex) => {
      const path = [index, "mechanics", "plus", clauseIndex];
      if (clause.type && declaredTypes && !declaredTypes.has(clause.type.trim().toLowerCase())) {
        add([...path, "type"], `Unknown damage type "${clause.type}"`);
      }
      if (clause.save && !saves.has(clause.save.save)) {
        add([...path, "save", "save"], `Unknown save "${clause.save.save}"`);
      }
    });
    // A pool fight throws damage dice of the ruleset's own die. Healing is an amount, not a roll
    // against anything, so it keeps whatever dice it names.
    const poolDie = definition.combat?.kind === "dice-pool" ? poolDieSides(definition) : undefined;
    if (poolDie !== undefined && mechanics && mechanics.kind !== "heal") {
      const wrongDie = (dice: string | undefined, path: (string | number)[]) => {
        if (dice === undefined || Number(/d(\d+)/.exec(dice)?.[1]) === poolDie) return;
        add(path, `A "dice-pool" fight throws d${poolDie}s, so damage dice are d${poolDie}s`);
      };
      wrongDie(mechanics.amount?.dice, [index, "mechanics", "amount", "dice"]);
      wrongDie(mechanics.perCostStep?.dice, [index, "mechanics", "perCostStep", "dice"]);
      mechanics.plus?.forEach((clause, clauseIndex) =>
        wrongDie(clause.dice, [index, "mechanics", "plus", clauseIndex, "dice"]),
      );
      wrongDie(mechanics.rider?.amount.dice, [index, "mechanics", "rider", "amount", "dice"]);
    }
    if (mechanics?.restore) {
      // A live pool by id is checked here; any other name is a list row's, which only a sheet holds.
      const pool = definition.sheet.live.pools.find((entry) => entry.id === mechanics.restore!.pool);
      const health = definition.combat?.health ?? definition.battle?.health;
      if (pool && health && "pool" in health && health.pool === pool.id) {
        add([index, "mechanics", "restore", "pool"], "Health comes back with a heal, not a restore");
      }
    }
    mechanics?.cost?.forEach((cost, costIndex) => {
      if (!costTargets.has(cost.pool)) {
        add([index, "mechanics", "cost", costIndex, "pool"], `Unknown pool or pool group "${cost.pool}"`);
      }
    });
    // A condition an entry applies is one of the sheet's own, so a fight and the sheet keep one
    // record of what is wrong with a character.
    if (mechanics) targetTestIssues(definition, mechanics, [index, "mechanics"], add);
    // What it puts on its own user (1.307) is one of the sheet's conditions too.
    mechanics?.appliesSelf?.forEach((applies, appliesIndex) => {
      if (!liveConditions.has(applies.condition)) {
        add([index, "mechanics", "appliesSelf", appliesIndex, "condition"], `Unknown condition "${applies.condition}"`);
      }
    });
    mechanics?.applies?.forEach((applies, appliesIndex) => {
      const path = [index, "mechanics", "applies", appliesIndex];
      if (!liveConditions.has(applies.condition)) {
        add([...path, "condition"], `Unknown condition "${applies.condition}"`);
      }
      escapeDcIssues(definition, applies, path, add);
      if (applies.saveEnds && !saves.has(applies.saveEnds.save)) {
        add([...path, "saveEnds", "save"], `Unknown save "${applies.saveEnds.save}"`);
      }
      const becomes = applies.saveEnds?.failures?.becomes;
      if (becomes !== undefined && !liveConditions.has(becomes)) {
        add([...path, "saveEnds", "failures", "becomes"], `Unknown condition "${becomes}"`);
      }
      if (applies.when) {
        for (const issue of rulesetValueRefIssues(applies.when.value, names, names.derived)) {
          add([...path, "when", "value", issue.key], issue.message);
        }
      }
    });
    // A save needs something to be rolled against. In a fight that number comes from the abilities
    // source of the list the entry lands in, so an entry that asks for a save (its own, or one that
    // ends a condition) in a list whose source declares no `saveDifficulty` would be saved against
    // nothing, and everybody would always succeed.
    const asksForSave =
      !!mechanics?.save ||
      !!mechanics?.applies?.some((applies) => applies.saveEnds) ||
      !!mechanics?.plus?.some((clause) => clause.save && clause.save.difficulty === undefined);
    if (asksForSave && definition.combat) {
      const lists = new Set((entry.rows ?? []).map((row) => row.list));
      (definition.combat.abilities ?? []).forEach((source) => {
        if (lists.has(source.list) && source.saveDifficulty === undefined) {
          add(
            [
              index,
              "mechanics",
              mechanics?.save ? "save" : mechanics?.applies?.some((applies) => applies.saveEnds) ? "applies" : "plus",
            ],
            `The combat abilities source for "${source.list}" declares no saveDifficulty for this save to be rolled against`,
          );
        }
      });
    }
    // What an entry does to a CHECK. Successes, pool dice, a per-die target and a re-throw are all
    // pool words, so a summed ruleset can honour none of them, and each number is held to the same
    // range the ruleset's own dice are.
    if (mechanics?.contextual) {
      const contextual = mechanics.contextual;
      const path = [index, "mechanics", "contextual"];
      if (contextual.check)
        for (const found of contextualCheckIssues(definition.resolution, contextual.check))
          add([...path, "check", ...found.path], found.message);
      contextual.cost?.forEach((cost, costIndex) => {
        if ("track" in cost) {
          if (!definition.sheet.live.tracks.some((track) => track.id === cost.track && !track.kinds && !track.boxes))
            add([...path, "cost", costIndex, "track"], `No live track "${cost.track}" to mark`);
        } else if (!costTargets.has(cost.pool))
          add([...path, "cost", costIndex, "pool"], `Unknown pool or pool group "${cost.pool}"`);
      });
      contextual.saves?.forEach((id, saveIndex) => {
        if (!saves.has(id)) add([...path, "saves", saveIndex], `Unknown save "${id}"`);
      });
      contextual.skills?.forEach((id, skillIndex) => {
        if (!definition.sheet.skills.some((skill) => skill.id === id))
          add([...path, "skills", skillIndex], `Unknown skill "${id}"`);
      });
    }
    if (mechanics?.check) {
      const check = mechanics.check;
      const path = [index, "mechanics", "check"];
      const resolution = definition.resolution;
      if (resolution.kind !== "dice-pool") {
        add(path, `A ${resolution.kind} ruleset has no pool for a check effect to change`);
      } else {
        if (check.reroll && (check.reroll.upTo < 1 || check.reroll.upTo >= resolution.die.sides)) {
          // At the top face it would throw the whole pool again for ever, which is a different
          // rule wearing this one's name.
          add(
            [...path, "reroll", "upTo"],
            `This ruleset throws d${resolution.die.sides}, so a re-throw is on a face from 1 to ${resolution.die.sides - 1}`,
          );
        }
        if (
          check.threshold !== undefined &&
          (check.threshold < resolution.target.min || check.threshold > resolution.target.max)
        ) {
          add([...path, "threshold"], `This ruleset counts on ${resolution.target.min} to ${resolution.target.max}`);
        }
        // An entry may move a face rule only as far as a check may: the ruleset has to say how low it
        // goes, and the entry has to stay on the die.
        for (const key of ["explode", "double"] as const) {
          const face = check[key];
          if (face === undefined) continue;
          const min = resolution[key]?.min;
          if (min === undefined) {
            add([...path, key], `This ruleset gives resolution.${key} no min, so no check may move it`);
          } else if (face < min || face > resolution.die.sides) {
            add([...path, key], `This ruleset lets a check move ${key} from ${min} to ${resolution.die.sides}`);
          }
        }
      }
    }
    // Temporary points are a buffer damage drains first, and a wound track has no buffer: it has
    // boxes, and a box is either marked or it is not. Rather than invent a meaning (a free level? a
    // mark that clears itself?) a ruleset whose fights are fought on a track is refused the key.
    // Either block may point health at one: `battle` lends the Engine's own fights the sheet's
    // numbers and reads a track as the levels still clear, with no buffer either.
    // Only a track this sheet really declares WITH levels: health pointed at a name the sheet does
    // not have, or at a plain bounded number, is a broken file that has already been told so, and
    // calling it a wound track here would send its author looking in the wrong place.
    const woundTrack = (health: { pool: string } | { track: string } | undefined) => {
      if (!health || !("track" in health)) return null;
      const declared = definition.sheet.live.tracks.find((track) => track.id === health.track);
      return declared?.levels?.length || declared?.boxes ? health.track : null;
    };
    const trackHealth = woundTrack(definition.combat?.health) ?? woundTrack(definition.battle?.health);
    if (mechanics?.temporary && trackHealth) {
      add(
        [index, "mechanics", "temporary"],
        `Health is the wound track "${trackHealth}", which carries no buffer for temporary points`,
      );
    }
    if (mechanics?.alters) {
      const alters = mechanics.alters;
      const path = [index, "mechanics", "alters"];
      alters.catalogs.forEach((catalogId, catalogIndex) => {
        if (!definition.catalogs?.some((catalog) => catalog.id === catalogId)) {
          add([...path, "catalogs", catalogIndex], `Unknown catalog "${catalogId}"`);
        }
      });
      for (const key of ["spares", "rerolls"] as const) {
        const ref = alters[key];
        if (!ref) continue;
        for (const refIssue of rulesetValueRefIssues(ref, names, names.derived, false)) {
          add([...path, key, refIssue.key], refIssue.message);
        }
      }
      if (alters.budget && budgets) {
        for (const side of ["from", "to"] as const) {
          if (!budgets.has(alters.budget[side])) {
            add([...path, "budget", side], `Unknown budget "${alters.budget[side]}"`);
          }
        }
      }
      componentIssues(definition, alters.drops, [...path, "drops"], add);
    }
    if (mechanics?.budget !== undefined && budgets && !budgets.has(mechanics.budget)) {
      add([index, "mechanics", "budget"], `Unknown budget "${mechanics.budget}"`);
    }
    if (mechanics?.rescue?.budget !== undefined && budgets && !budgets.has(mechanics.rescue.budget)) {
      add([index, "mechanics", "rescue", "budget"], `Unknown budget "${mechanics.rescue.budget}"`);
    }
    if (mechanics) cureIssues(definition, mechanics, [index, "mechanics"], add);
    targetIsIssues(definition, mechanics?.ends?.from, [index, "mechanics", "ends", "from"], add);
    if (mechanics?.dismisses && mechanics.dismisses !== true) {
      targetIsIssues(definition, mechanics.dismisses.gone, [index, "mechanics", "dismisses", "gone"], add);
    }
    if (mechanics?.kindChoice && !definition.combat?.creatureTypes)
      add([index, "mechanics", "kindChoice"], "This ruleset has no creature types to choose from");
    if (mechanics?.teleport && !definition.combat?.distance)
      add(
        [index, "mechanics", "teleport"],
        '"teleport" is measured in cells, so the combat block declares "distance" too',
      );
    mechanics?.keepsOn?.forEach((kept, keptIndex) => {
      if (!liveConditions.has(kept)) add([index, "mechanics", "keepsOn", keptIndex], `Unknown condition "${kept}"`);
    });
    // The weapon bound out of the fight is named in a live text field (1.309).
    const boundIn = mechanics?.conjures?.boundIn;
    if (boundIn !== undefined && !definition.sheet.live.text.some((one) => one.id === boundIn)) {
      add([index, "mechanics", "conjures", "boundIn"], `Unknown live text "${boundIn}"`);
    }
    mechanics?.conjures?.items.forEach((ref, refIndex) => {
      const catalogId = ref.slice(0, ref.indexOf("/"));
      const catalog = definition.catalogs?.find((one) => one.id === catalogId);
      // A catalog kept in its own file has no entries here yet: the whole ruleset's pass checks it.
      if (!catalog) return add([index, "mechanics", "conjures", "items", refIndex], `Unknown entry "${ref}"`);
      if (!catalog.entries || catalog.from) return;
      const attack = catalog.entries.find((one) => `${catalogId}/${one.id}` === ref)?.item?.attack;
      if (!attack) add([index, "mechanics", "conjures", "items", refIndex], `"${ref}" is not a weapon`);
      // A thrown weapon strikes in reach too (1.308): a dagger, a javelin, a trident.
      else if ((attack.range && attack.reach === undefined) || attack.ammo || attack.clip)
        add([index, "mechanics", "conjures", "items", refIndex], `"${ref}" is not a melee weapon`);
    });
    if (
      mechanics?.repeats &&
      definition.combat &&
      !definition.combat.economy.budgets.some((one) => one.id === mechanics.repeats!.budget)
    ) {
      add([index, "mechanics", "repeats", "budget"], `Unknown budget "${mechanics.repeats.budget}"`);
    }
    // The biggest it reaches is one of the fight's sizes (1.314).
    if (mechanics?.targetsUpTo && !definition.combat?.sizes?.order.some((one) => one.id === mechanics.targetsUpTo)) {
      add(
        [index, "mechanics", "targetsUpTo"],
        definition.combat?.sizes
          ? `Unknown size "${mechanics.targetsUpTo}"`
          : '"targetsUpTo" reads combat.sizes, so the block declares "sizes" too',
      );
    }
    if (mechanics?.oncePerTarget && !definition.rests.some((one) => one.id === mechanics.oncePerTarget!.until)) {
      add([index, "mechanics", "oncePerTarget", "until"], `Unknown rest "${mechanics.oncePerTarget.until}"`);
    }
    if (mechanics?.endsCondition && !liveConditions.has(mechanics.endsCondition)) {
      add([index, "mechanics", "endsCondition"], `Unknown condition "${mechanics.endsCondition}"`);
    }
    mechanics?.amends?.forEach((amend, amendIndex) => {
      const catalogId = amend.entry.slice(0, amend.entry.indexOf("/"));
      const catalog = definition.catalogs?.find((one) => one.id === catalogId);
      // A catalog kept in its own file has no entries here yet: the whole ruleset's pass checks it.
      if (
        !catalog ||
        (catalog.entries && !catalog.from && !catalog.entries.some((one) => `${catalogId}/${one.id}` === amend.entry))
      )
        add([index, "mechanics", "amends", amendIndex, "entry"], `Unknown entry "${amend.entry}"`);
      if ((amend.range !== undefined || amend.push !== undefined) && !definition.combat?.distance)
        add(
          [index, "mechanics", "amends", amendIndex],
          'A range or a push is measured in cells, so the combat block declares "distance" too',
        );
    });
    if (mechanics?.ignoresSurpriseWith) {
      const catalogId = mechanics.ignoresSurpriseWith.slice(0, mechanics.ignoresSurpriseWith.indexOf("/"));
      if (!definition.catalogs?.some((catalog) => catalog.id === catalogId)) {
        add([index, "mechanics", "ignoresSurpriseWith"], `Unknown catalog "${catalogId}"`);
      }
    }
    if (mechanics?.zone?.obscures) {
      sightIssues(definition, mechanics.zone.obscures.pierced, [index, "mechanics", "zone", "obscures"], add);
    }
    // What sees through a teleport's smoke (1.279) is the ruleset's own senses.
    if (mechanics?.teleport?.smoke) {
      sightIssues(definition, mechanics.teleport.smoke.pierced, [index, "mechanics", "teleport", "smoke"], add);
    }
    zoneInsideIssues(definition, mechanics?.zone, [index, "mechanics", "zone"], add);
    componentIssues(definition, mechanics?.components, [index, "mechanics", "components"], add);
    if (mechanics?.zone?.whileHeld && !liveConditions.has(mechanics.zone.whileHeld.condition)) {
      add(
        [index, "mechanics", "zone", "whileHeld", "condition"],
        `Unknown condition "${mechanics.zone.whileHeld.condition}"`,
      );
    }
    if (mechanics?.zone?.move && !budgets?.has(mechanics.zone.move.budget)) {
      add([index, "mechanics", "zone", "move", "budget"], `Unknown budget "${mechanics.zone.move.budget}"`);
    }
    if (mechanics?.zone?.turn && !budgets?.has(mechanics.zone.turn.budget)) {
      add([index, "mechanics", "zone", "turn", "budget"], `Unknown budget "${mechanics.zone.turn.budget}"`);
    }
    if (mechanics?.summons && !budgets?.has(mechanics.summons.budget)) {
      add([index, "mechanics", "summons", "budget"], `Unknown budget "${mechanics.summons.budget}"`);
    }
    // A strike bought with a budget the fight declares, rows changed by abilities the sheet has (1.242).
    // A hit answered only when a strike from a budget the fight declares made it (1.248).
    const reaction = mechanics?.reaction && mechanics.reaction !== true ? mechanics.reaction : undefined;
    if (reaction && budgets) {
      [reaction, ...(reaction.also ?? [])].forEach((moment, at) => {
        if (moment.budget !== undefined && !budgets.has(moment.budget)) {
          add(
            [index, "mechanics", "reaction", ...(at === 0 ? [] : ["also", at - 1]), "budget"],
            `Unknown budget "${moment.budget}"`,
          );
        }
      });
    }
    if (mechanics?.grantsStrike && budgets && !budgets.has(mechanics.grantsStrike.budget)) {
      add([index, "mechanics", "grantsStrike", "budget"], `Unknown budget "${mechanics.grantsStrike.budget}"`);
    }
    mechanics?.attackRows?.forEach((rule, ruleIndex) => {
      rule.abilities?.forEach((ability, abilityIndex) => {
        if (!definition.sheet.abilities.some((one) => one.id === ability)) {
          add([index, "mechanics", "attackRows", ruleIndex, "abilities", abilityIndex], `Unknown ability "${ability}"`);
        }
      });
    });
    // What a use hands back, and what it lets its holder buy with another budget. Both name the
    // combat block's own words, so both are checked against the block that declares them.
    mechanics?.gives?.forEach((gift, giftIndex) => {
      if (budgets && !budgets.has(gift.budget)) {
        add([index, "mechanics", "gives", giftIndex, "budget"], `Unknown budget "${gift.budget}"`);
      }
    });
    // A rider names the attack lists it comes off and, when it is choosier still, one column of
    // their rows. Both are the combat block's own words, and a name it does not have would be a
    // rider that silently never fired.
    if (mechanics?.rider && definition.combat) {
      const path = [index, "mechanics", "rider"];
      const attackLists = new Set((definition.combat.attacks ?? []).map((source) => source.list));
      mechanics.rider.sources?.forEach((list, listIndex) => {
        if (!attackLists.has(list)) {
          add([...path, "sources", listIndex], `"${list}" is not one of this ruleset's attack lists`);
        }
      });
      const column = mechanics.rider.requires?.column;
      if (column !== undefined) {
        const named = mechanics.rider.sources ?? [...attackLists];
        const holders = named.filter((list) => listById.get(list)?.columns.some((entry) => entry.id === column));
        if (holders.length === 0) {
          add([...path, "requires", "column"], `No attack list this rider reads has a column "${column}"`);
        }
      }
      // A held weapon's tags are the items block's own.
      mechanics.rider.weapons?.tags.forEach((tag, tagIndex) => {
        if (!definition.items?.tags?.some((each) => each.id === tag)) {
          add([...path, "weapons", "tags", tagIndex], `Unknown item tag "${tag}"`);
        }
      });
      const types = definition.combat.damageTypes
        ? new Set(definition.combat.damageTypes.map((type) => type.trim().toLowerCase()))
        : null;
      if (mechanics.rider.type && types && !types.has(mechanics.rider.type.trim().toLowerCase())) {
        add([...path, "type"], `Unknown damage type "${mechanics.rider.type}"`);
      }
    }
    if (mechanics?.hiding) hidingTraitsIssues(definition, mechanics.hiding, [index, "mechanics", "hiding"], add);
    if (mechanics?.standard && definition.combat) {
      const path = [index, "mechanics", "standard"];
      if (!budgets?.has(mechanics.standard.budget)) {
        add([...path, "budget"], `Unknown budget "${mechanics.standard.budget}"`);
      } else if (mechanics.standard.budget === definition.combat.economy.budgets[0]?.id) {
        // A standard action is already bought with the first budget, so a permission naming that one
        // grants nothing and would put the same thing on the menu twice, once at each id.
        add(
          [...path, "budget"],
          `Every standard action is already taken for "${mechanics.standard.budget}", so this permission grants nothing`,
        );
      }
      const declared = new Set<string>(definition.combat.standard ?? []);
      mechanics.standard.actions.forEach((action, actionIndex) => {
        if (!declared.has(action)) {
          add([...path, "actions", actionIndex], `This ruleset does not have the standard action "${action}"`);
        }
      });
    }
    if (mechanics?.reaction && typeof mechanics.reaction === "object" && mechanics.reaction.above) {
      const where = [index, "mechanics", "reaction", "above"];
      if (definition.combat?.kind === "dice-pool") {
        add(where, 'A "dice-pool" fight counts successes, so it has no DC for a check to meet');
      }
      for (const refIssue of rulesetValueRefIssues(mechanics.reaction.above.check, names, names.derived, false)) {
        add([...where, "check", refIssue.key], refIssue.message);
      }
    }
    if (mechanics?.amountAdd) {
      if (!mechanics.amount) add([index, "mechanics", "amountAdd"], "amountAdd adds to an amount: give the amount too");
      for (const refIssue of rulesetValueRefIssues(mechanics.amountAdd, names, names.derived, false)) {
        add([index, "mechanics", "amountAdd", refIssue.key], refIssue.message);
      }
    }
    if (mechanics?.targetsScale) {
      for (const refIssue of rulesetValueRefIssues(mechanics.targetsScale.from, names, names.derived, false)) {
        add([index, "mechanics", "targetsScale", "from", refIssue.key], refIssue.message);
      }
    }
    if (mechanics?.scales) {
      // A scaling amount reads the sheet exactly as a scaled column does, so any declared derived
      // value is fair game.
      for (const refIssue of rulesetValueRefIssues(mechanics.scales.from, names, names.derived, false)) {
        add([index, "mechanics", "scales", "from", refIssue.key], refIssue.message);
      }
    }
  });
  return issues;
}

/** What the reserved row key holds, so the picker can tell which entry a row came from. */
export function catalogRowRef(catalogId: string, entryId: string): string {
  return `${catalogId}/${entryId}`;
}

export type RulesetCatalogRow = { list: string; row: Record<string, string | number | boolean> };

/** An entry as rows the sheet can hold. The rows are COPIES: the player may edit them afterwards,
 *  the sheet stays self-contained while its ruleset is uninstalled, and an updated ruleset never
 *  rewrites a character. The mark only says where the row came from. A creature entry writes
 *  nothing onto a sheet, so it comes back as no rows at all. */
export function rowsFromCatalogEntry(catalogId: string, entry: RulesetCatalogEntry): RulesetCatalogRow[] {
  const ref = catalogRowRef(catalogId, entry.id);
  return (entry.rows ?? []).map((row) => ({ list: row.list, row: { ...row.values, [RULESET_CATALOG_ROW_KEY]: ref } }));
}

/** A `catalogs/<id>.json` asset. `$comment` is allowed anywhere, exactly as in `ruleset.json`. */
const rulesetCatalogFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    catalog: sheetId,
    entries: z.array(catalogEntrySchema).max(RULESET_CATALOG_MAX_ENTRIES),
  })
  .strict();

export type RulesetCatalogParseResult = { ok: true; entries: RulesetCatalogEntry[] } | { ok: false; issues: string[] };

/** Every `{ derived: id }` reference in a borrowed entry that `refs` names, read as the borrower's value. */
function borrowedRefs(value: unknown, refs: Record<string, RulesetValueRef>): unknown {
  if (Array.isArray(value)) return value.map((item) => borrowedRefs(item, refs));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length === 1 &&
    typeof record.derived === "string" &&
    Object.prototype.hasOwnProperty.call(refs, record.derived)
  ) {
    return { ...refs[record.derived] };
  }
  return Object.fromEntries(keys.map((key) => [key, borrowedRefs(record[key], refs)]));
}

function renamedBorrowedSheet(
  lent: RulesetCatalogEntry,
  rename: NonNullable<NonNullable<RulesetCatalogHeader["from"]>["sheet"]>,
): RulesetCatalogEntry {
  let entry = rename.refs ? (borrowedRefs(lent, rename.refs) as RulesetCatalogEntry) : lent;
  // A tier a borrowed entry grants or asks for ("expertise" in skills held at "proficient").
  if (rename.tiers && entry.grants) {
    const tiers = rename.tiers;
    const walk = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(walk);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          (key === "tier" || key === "held") && typeof item === "string" ? (tiers[item] ?? item) : walk(item),
        ]),
      );
    };
    entry = { ...entry, grants: walk(entry.grants) as typeof entry.grants };
  }
  const slots = entry.item?.slots;
  if (rename.slots && slots) {
    const moved: Record<string, number> = {};
    for (const [id, count] of Object.entries(slots)) {
      const to = rename.slots[id] ?? id;
      moved[to] = (moved[to] ?? 0) + count;
    }
    entry = { ...entry, item: { ...entry.item!, slots: moved as typeof slots } };
  }
  const sheet = entry.creature?.sheet;
  if (!sheet) return entry;
  const fields: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(sheet.fields ?? {})) {
    const to = rename.fields && id in rename.fields ? rename.fields[id] : id;
    if (to === null || to === undefined) continue;
    const mapped = rename.values?.[id]?.[String(value)];
    fields[to] = mapped ?? value;
  }
  const tiers = (record: Record<string, string> | undefined) =>
    record && Object.fromEntries(Object.entries(record).map(([id, tier]) => [id, rename.tiers?.[tier] ?? tier]));
  return {
    ...entry,
    creature: {
      ...entry.creature!,
      sheet: {
        ...sheet,
        fields: fields as typeof sheet.fields,
        ...(sheet.skills ? { skills: tiers(sheet.skills) } : {}),
        ...(sheet.saves ? { saves: tiers(sheet.saves) } : {}),
      },
    },
  };
}

/** A bestiary borrowed from another ruleset (Capability API 1.220): what the lender's catalog file
 *  holds, read against the borrower. The borrower's header takes the lender's filters and units where
 *  it names none, and a creature that does not fit the borrower (a condition, tier or sense it never
 *  declares) is left out and named in `dropped`, so one stray entry never costs the whole bestiary. */
export function parseBorrowedRulesetCatalog(
  definition: RulesetDefinition,
  catalogId: string,
  lender: Pick<RulesetCatalogHeader, "filters" | "units">,
  input: unknown,
  narrowedByLayers = false,
): { ok: true; entries: RulesetCatalogEntry[]; dropped: string[] } | { ok: false; issues: string[] } {
  const own = definition.catalogs?.find((entry) => entry.id === catalogId);
  if (!own?.from) return { ok: false, issues: [`(root): "${catalogId}" borrows no catalog`] };
  const shape = rulesetShapeIssue(input);
  if (shape) return { ok: false, issues: [shape] };
  const parsed = rulesetCatalogFileSchema.safeParse(stripRulesetComments(input));
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 40).map((entry) => `${entry.path.join(".") || "(root)"}: ${entry.message}`),
    };
  }
  if (parsed.data.catalog !== own.from.catalog) {
    return { ok: false, issues: [`catalog: this file is for "${parsed.data.catalog}", not "${own.from.catalog}"`] };
  }
  // A creature's sheet is written in the lender's ids; `from.sheet` says how they read here.
  const rename = own.from.sheet;
  const lent = rename ? parsed.data.entries.map((entry) => renamedBorrowedSheet(entry, rename)) : parsed.data.entries;
  // The catalog's own entries add to the borrowed ones, or stand in for one of the same id.
  const mine = new Map((own.entries ?? []).map((entry) => [entry.id, entry]));
  const borrowed = [
    ...lent.map((entry) => mine.get(entry.id) ?? entry),
    ...(own.entries ?? []).filter((entry) => !parsed.data.entries.some((other) => other.id === entry.id)),
  ];
  const header: RulesetCatalogHeader = {
    ...own,
    ...(own.filters === undefined && lender.filters ? { filters: lender.filters } : {}),
    ...(own.units === undefined && lender.units ? { units: lender.units } : {}),
  };
  const effective: RulesetDefinition = {
    ...definition,
    catalogs: (definition.catalogs ?? []).map((entry) => (entry.id === catalogId ? header : entry)),
  };
  const issues = rulesetCatalogEntryIssues(effective, header, borrowed, narrowedByLayers);
  const bad = new Map<number, string[]>();
  for (const issue of issues) {
    const index = issue.path[0];
    if (typeof index === "number")
      bad.set(index, [...(bad.get(index) ?? []), `${issue.path.slice(1).join(".")}: ${issue.message}`]);
  }
  // An issue that is no one entry's (a duplicate id across the file) leaves the file unread.
  const loose = issues.filter((issue) => typeof issue.path[0] !== "number");
  if (loose.length)
    return {
      ok: false,
      issues: loose.slice(0, 40).map((issue) => `entries.${issue.path.join(".")}: ${issue.message}`),
    };
  const entries = borrowed.filter((_, index) => !bad.has(index));
  const dropped = [...bad].map(([index, why]) => `${borrowed[index]!.id} (${why.join("; ")})`);
  return { ok: true, entries, dropped };
}

/** Read a catalog asset against the ruleset that declares it. Never throws: an asset the Engine
 *  cannot use comes back as plain `path: message` lines, the same way a ruleset file does. */
export function parseRulesetCatalogFile(
  definition: RulesetDefinition,
  catalogId: string,
  input: unknown,
  /** True when `definition` may have its layers applied: a game's, rather than the file as written. */
  narrowedByLayers = false,
): RulesetCatalogParseResult {
  const catalog = definition.catalogs?.find((entry) => entry.id === catalogId);
  if (!catalog) return { ok: false, issues: [`(root): "${catalogId}" is not a catalog of this ruleset`] };
  const shape = rulesetShapeIssue(input);
  if (shape) return { ok: false, issues: [shape] };
  const parsed = rulesetCatalogFileSchema.safeParse(stripRulesetComments(input));
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 40).map((entry) => `${entry.path.join(".") || "(root)"}: ${entry.message}`),
    };
  }
  if (parsed.data.catalog !== catalogId) {
    return { ok: false, issues: [`catalog: this file is for "${parsed.data.catalog}", not "${catalogId}"`] };
  }
  const issues = rulesetCatalogEntryIssues(definition, catalog, parsed.data.entries, narrowedByLayers);
  if (issues.length > 0) {
    return {
      ok: false,
      issues: issues.slice(0, 40).map((issue) => `entries.${issue.path.join(".")}: ${issue.message}`),
    };
  }
  return { ok: true, entries: parsed.data.entries };
}

// ── Stored sheets ──

/** A sheet as it is stored on a card, a persona or a game. Deliberately loose: it is read
 *  tolerantly against the ruleset's CURRENT schema (unknown keys kept, missing keys defaulted,
 *  out-of-range values clamped on edit and never on read). A layout that moves values to new ids
 *  says how in `sheet.migrations`, which every read applies (`readRulesetSheetEnvelope`). */
export const rulesetSheetBuildSchema = z
  .object({
    abilities: z.record(z.number().finite()).default({}),
    skills: z.record(z.string().max(40)).default({}),
    saves: z.record(z.string().max(40)).default({}),
    /** Free per-skill and per-save bonuses, keyed by skill or save id. */
    bonuses: z.record(z.number().finite()).default({}),
    fields: z.record(sheetScalar).default({}),
    lists: z.record(z.array(z.record(sheetScalar)).max(500)).default({}),
  })
  .passthrough();

export const rulesetSheetEnvelopeSchema = z
  .object({ v: z.number().int().min(1), build: rulesetSheetBuildSchema })
  .passthrough();

export type RulesetSheetBuild = z.infer<typeof rulesetSheetBuildSchema>;
export type RulesetSheetEnvelope = z.infer<typeof rulesetSheetEnvelopeSchema>;
export type RulesetSheetMigration = z.infer<typeof sheetMigrationSchema>;
export type RulesetSheetMigrationStep = z.infer<typeof sheetMigrationStepSchema>;

// ── Sheets as they travel on a character card or a persona ──

/** How many rulesets one card or persona may hold a sheet for. */
export const RULESET_SHEETS_MAX = 32;

function storedRulesetSheetIssue(rulesetId: string, sheet: unknown): string | null {
  if (!RULESET_REF_ID_PATTERN.test(rulesetId) || rulesetId.length > 140) return `"${rulesetId}" is not a ruleset id`;
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet))
    return `The sheet for "${rulesetId}" is not an object`;
  let bytes: number;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(sheet)).length;
  } catch {
    return `The sheet for "${rulesetId}" cannot be serialized`;
  }
  return bytes > RULESET_SHEET_MAX_BYTES
    ? `The sheet for "${rulesetId}" is ${bytes} bytes, over the ${RULESET_SHEET_MAX_BYTES}-byte limit`
    : null;
}

/** `rulesetSheets`: starting builds keyed by ruleset id, on `character.data.extensions` and on
 *  `persona.personaStats`. The boundary checks only what must hold for ANY ruleset (a usable key, an
 *  object, the size cap), never the sheet's shape: a sheet for a ruleset this install lacks is kept
 *  dormant under its key and validated against that ruleset only once it is installed and used.
 *  Dropping it would destroy the sheet for everyone downstream of a re-export. */
export const storedRulesetSheetsSchema = z.record(z.unknown()).superRefine((sheets, ctx) => {
  const ids = Object.keys(sheets);
  if (ids.length > RULESET_SHEETS_MAX) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `At most ${RULESET_SHEETS_MAX} ruleset sheets can be stored`,
    });
  }
  for (const id of ids) {
    const message = storedRulesetSheetIssue(id, sheets[id]);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [id], message });
  }
});

export type StoredRulesetSheets = Record<string, unknown>;

/** For importers: keep every sheet the boundary would accept and drop the rest, so one oversized
 *  or malformed sheet costs the import that sheet and not the whole card. Returns what was dropped
 *  so the caller can say so. Anything that is not a plain object reads as no sheets at all, and so
 *  does a map with nothing left in it, so a caller never writes an empty key. */
export function capImportedRulesetSheets(value: unknown): {
  sheets: StoredRulesetSheets | undefined;
  dropped: string[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { sheets: undefined, dropped: value === undefined || value === null ? [] : ["(not an object)"] };
  }
  const sheets: StoredRulesetSheets = {};
  const dropped: string[] = [];
  for (const [id, sheet] of Object.entries(value as Record<string, unknown>)) {
    const message =
      Object.keys(sheets).length >= RULESET_SHEETS_MAX ? "too many sheets" : storedRulesetSheetIssue(id, sheet);
    if (message) dropped.push(id.slice(0, 140));
    else sheets[id] = sheet;
  }
  return { sheets: Object.keys(sheets).length > 0 ? sheets : undefined, dropped };
}

/** What is wrong with somebody's own ways of hiding (1.292): read only where hiding is real, behind
 *  somebody larger only where there are sizes, and lost only with conditions the sheet has. */
function hidingTraitsIssues(
  definition: RulesetDefinition,
  traits: { behindLarger?: true; aware?: { lostWith?: string[] }; stillWhile?: { holds?: string } },
  path: Array<string | number>,
  add: (path: Array<string | number>, message: string) => void,
): void {
  if (!definition.combat?.hiding) {
    add(path, "A way of hiding is read where combat.hiding hides for real, so it needs combat.hiding");
    return;
  }
  if (traits.behindLarger && !definition.combat.sizes) {
    add([...path, "behindLarger"], "Hiding behind somebody larger reads combat.sizes");
  }
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  // The camouflage Hide in Plain Sight needs (1.309) is one of the sheet's conditions.
  const holds = traits.stillWhile?.holds;
  if (holds !== undefined && !conditions.has(holds))
    add([...path, "stillWhile", "holds"], `Unknown condition "${holds}"`);
  traits.aware?.lostWith?.forEach((condition, conditionIndex) => {
    if (!conditions.has(condition)) {
      add([...path, "aware", "lostWith", conditionIndex], `Unknown condition "${condition}"`);
    }
  });
}
