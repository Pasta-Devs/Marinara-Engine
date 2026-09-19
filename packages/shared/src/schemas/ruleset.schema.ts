import { z } from "zod";

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

/** Byte ceiling checked against the manifest's declared `files[].bytes` BEFORE the asset is read. */
export const RULESET_MAX_BYTES = 256 * 1024;

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
function promptSafeText(max: number) {
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
] as const;

/** Exactly one key. `abilityModFromField` names an enum field whose VALUE is an ability id (a
 *  caster's chosen spellcasting ability); any other value, such as "none", reads as 0. */
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
  });

export type RulesetValueRef = z.infer<typeof rulesetValueRefSchema>;

/** `[[threshold, value], …]`, ascending: the value of the highest threshold at or below the input.
 *  An input below the first threshold reads as the first value. */
const stepTableSchema = z
  .array(z.tuple([z.number().finite(), z.number().finite()]))
  .min(1)
  .max(100)
  .superRefine((table, ctx) => {
    for (let i = 1; i < table.length; i++) {
      if (table[i]![0] <= table[i - 1]![0]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 0],
          message: "Step table thresholds must be strictly ascending",
        });
      }
    }
  });

const roundingSchema = z.enum(["down", "up", "nearest"]);

const hideWhenSchema = z
  .object({ field: sheetId, equals: z.union([z.string().max(80), z.number().finite(), z.boolean()]) })
  .strict();

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
      .object({ count: z.number().int().min(1).max(10), sides: z.number().int().min(2).max(1000) })
      .strict()
      .default({ count: 1, sides: 20 }),
    ...sheetMathShape,
    /** Whether the GM may ask for advantage or disadvantage (roll the dice twice, keep one). */
    advantage: z.boolean().default(false),
    naturals: z
      .object({ check: naturalPolicySchema.default("none"), save: naturalPolicySchema.default("none") })
      .strict()
      .default({}),
    difficultyLadder: diceSumLadderSchema,
  })
  .strict();

/** How many dice one pool check may throw, exploded dice included, whatever a ruleset asks for.
 *  An Engine ceiling rather than an author's choice: the roll runs inside a turn. */
export const RULESET_POOL_MAX_DICE = 100;

/** How many faces a pool die may have. A pool counts faces one by one, so a percentile die here
 *  would be a roll-under system wearing the wrong kind. */
const POOL_DIE_MAX_SIDES = 100;

const poolFace = z.number().int().min(2).max(POOL_DIE_MAX_SIDES);

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
      })
      .strict()
      .default({ min: 1, max: 40 }),
    /** The per-die success threshold. `min` below `max` lets the GM set it per check. */
    target: z.object({ default: poolFace, min: poolFace, max: poolFace }).strict(),
    /** Optional: a face at or above this counts twice. */
    double: z.object({ from: poolFace }).strict().optional(),
    /** Optional: a face at or above this rolls one more die, chained, up to the Engine's ceiling. */
    explode: z.object({ from: poolFace }).strict().optional(),
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
    /** Optional: no die succeeded AND a face at or below this showed, which is worse than failing. */
    botch: z
      .object({
        upTo: z
          .number()
          .int()
          .min(1)
          .max(POOL_DIE_MAX_SIDES - 1),
      })
      .strict()
      .optional(),
    /** Optional: this many net successes or more is a critical success. */
    exceptional: z
      .object({ successes: z.number().int().min(1).max(RULESET_POOL_MAX_DICE) })
      .strict()
      .optional(),
    /** Optional: lets the GM add or take dice for one check (a stunt, a wound, bad light). */
    situationalDice: z
      .object({ min: z.number().int().min(-20).max(0), max: z.number().int().min(0).max(20) })
      .strict()
      .optional(),
    difficultyLadder: dicePoolLadderSchema,
  })
  .strict();

/** A ladder in either kind's shape. A layer declares one of these and the cross-checks hold it to
 *  the base ruleset's own kind, so the two can never mean different things by "difficulty". */
export const rulesetDifficultyLadderSchema = z.union([diceSumLadderSchema, dicePoolLadderSchema]);
export type RulesetDiceSumLadderStep = z.infer<typeof diceSumLadderStepSchema>;
export type RulesetDicePoolLadderStep = z.infer<typeof dicePoolLadderStepSchema>;
export type RulesetDifficultyLadderStep = RulesetDiceSumLadderStep | RulesetDicePoolLadderStep;
export type RulesetDifficultyLadder = z.infer<typeof rulesetDifficultyLadderSchema>;

/** Closed registry of resolution kinds. Adding a kind is an Engine PR with regressions. */
export const rulesetResolutionSchema = z.discriminatedUnion("kind", [
  diceSumResolutionSchema,
  dicePoolResolutionSchema,
]);
export const RULESET_RESOLUTION_KINDS = Object.freeze(["dice-sum", "dice-pool"] as const);

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
export const rulesetListColumnSchema = z.discriminatedUnion("type", [
  z.object({ ...columnBase, ...numberFieldShape }).strict(),
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
  })
  .strict();

/** A skill names the ability it rolls with. A system whose skills stand alone omits it. */
const skillSchema = z.object({ id: sheetId, label, ability: sheetId.optional() }).strict();
const saveSchema = skillSchema;

const derivedBase = { id: sheetId, label, section: sheetId.optional(), hideWhen: hideWhenSchema.optional() };
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
  z.object({ ...derivedBase, op: z.literal("min"), of: z.array(rulesetValueRefSchema).min(2).max(12) }).strict(),
  z.object({ ...derivedBase, op: z.literal("max"), of: z.array(rulesetValueRefSchema).min(2).max(12) }).strict(),
]);
export const RULESET_DERIVED_OPS = Object.freeze(["sum", "stepTable", "scale", "min", "max"] as const);

const listSchema = z
  .object({
    id: sheetId,
    label,
    section: sheetId.optional(),
    hideWhen: hideWhenSchema.optional(),
    maxItems: z.number().int().min(1).max(500),
    columns: z.array(rulesetListColumnSchema).min(1).max(12),
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
    /** `full` starts at the maximum (hit points); `empty` starts at zero (stress, corruption). */
    start: z.enum(["full", "empty"]).default("full"),
    hideWhen: hideWhenSchema.optional(),
  })
  .strict();

const liveTrackSchema = z
  .object({ id: sheetId, label, min: z.number().int(), max: z.number().int(), default: z.number().int().optional() })
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
      .array(z.object({ id: sheetId, label }).strict())
      .max(80)
      .default([]),
  })
  .strict();

export const rulesetSheetSchema = z
  .object({
    /** Bumped by the author when the sheet's shape changes. Stored sheets record it as `v`. */
    version: z.number().int().min(1),
    sections: z
      .array(z.object({ id: sheetId, label }).strict())
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
    fields: z.array(rulesetFieldSchema).max(160).default([]),
    derived: z.array(rulesetDerivedSchema).max(60).default([]),
    lists: z.array(listSchema).max(20).default([]),
    live: liveSchema.default({}),
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
    ...restAmountShape,
  })
  .strict()
  .superRefine((op, ctx) => {
    const targets = (["pool", "poolGroup", "listPools", "track"] as const).filter((key) => op[key] !== undefined);
    if (targets.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A restore step names exactly one of: pool, poolGroup, listPools, track",
      });
    }
    if ((op.to === undefined) === (op.by === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A restore step has exactly one of "to" or "by"' });
    }
    if (op.recharge && op.listPools === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recharge"], message: '"recharge" only filters listPools' });
    }
  });

const restSchema = z
  .object({
    id: sheetId,
    label,
    restore: z.array(restRestoreSchema).max(40).default([]),
    clear: z
      .object({
        text: z.array(sheetId).max(12).default([]),
        conditions: z.union([z.literal("all"), z.array(sheetId).max(80)]).default([]),
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
                nameColumn: sheetId,
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

// ── Catalogs: ready-made entries an author ships with the ruleset ──

/** The reserved key a picked row carries, recording `<catalogId>/<entryId>` so the picker can mark
 *  what a sheet already has. A column id starts with a letter, so this can never be one. */
export const RULESET_CATALOG_ROW_KEY = "_catalog";

/** Byte ceiling for one `catalogs/<id>.json` asset, checked against the manifest's declared
 *  `files[].bytes` BEFORE the asset is read. Larger than a ruleset because a spell list is long. */
export const RULESET_CATALOG_MAX_BYTES = 1024 * 1024;

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
 *  the later combat bridge has to read this, not just print it. */
const catalogDice = z
  .string()
  .max(40)
  .regex(/^\d{1,3}d\d{1,4}(?:[+-]\d{1,4})?$/, "Dice look like 2d6 or 1d8+3");

const catalogAmountShape = { dice: catalogDice.optional(), flat: z.number().int().optional() };

/** How long a condition an entry applies lasts. `until-save` has no clock of its own, so it needs
 *  the save that ends it beside it, or nothing would ever take it off again. */
const catalogDurationSchema = z.union([
  z.literal("instant"),
  z.literal("until-save"),
  z.object({ rounds: z.number().int().min(1).max(1000) }).strict(),
]);

const catalogAppliesSchema = z
  .object({
    condition: sheetId,
    duration: catalogDurationSchema,
    saveEnds: z
      .object({ save: sheetId, at: z.enum(["turn-end", "turn-start"]) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((applies, ctx) => {
    if (applies.duration === "until-save" && !applies.saveEnds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["saveEnds"],
        message: '"until-save" needs the save that ends it',
      });
    }
  });

/** What an entry DOES. The Engine does not act on it in this slice: it validates it and the client
 *  shows one compact line. A later combat bridge turns it into the Engine's own `CombatSkill`, so
 *  the vocabulary is closed and strict, and a typo is refused now rather than ignored then. */
const catalogMechanicsSchema = z
  .object({
    kind: z.enum(["attack", "heal", "buff", "debuff", "utility"]),
    /** In the catalog's own distance unit. 0 is self or touch. */
    range: z.number().finite().min(0).optional(),
    area: z
      .object({ shape: z.enum(["burst", "cone", "line"]), size: z.number().finite().gt(0) })
      .strict()
      .optional(),
    targets: z.enum(["self", "ally", "enemy", "any"]).optional(),
    friendlyFire: z.boolean().optional(),
    amount: z.object(catalogAmountShape).strict().optional(),
    damageType: promptSafeText(40).optional(),
    attackRoll: z.boolean().optional(),
    save: z
      .object({ save: sheetId, onSuccess: z.enum(["none", "half", "negates"]) })
      .strict()
      .optional(),
    /** What using the entry spends, named by a live pool or by a pool group. */
    cost: z
      .array(z.object({ pool: sheetId, amount: z.number().int().min(1) }).strict())
      .max(4)
      .optional(),
    /** What one step of a higher cost adds, for systems that let a player pay more. */
    perCostStep: z.object(catalogAmountShape).strict().optional(),
    concentration: z.boolean().optional(),
    reaction: z.boolean().optional(),
    /** How many targets one use may take. One unless it says otherwise. */
    targetCount: z.number().int().min(1).max(20).optional(),
    /** The amount simply lands: no roll and no save. */
    autoHit: z.boolean().optional(),
    /** Conditions a use puts on the targets it affects. */
    applies: z.array(catalogAppliesSchema).max(4).optional(),
    /** An amount granted as temporary points on the health pool, which damage drains first. */
    temporary: z.object(catalogAmountShape).strict().optional(),
    /** An amount that grows with the sheet: the table gives the EXTRA dice at each step of the
     *  value it reads, so a trick that grows with a level needs no second entry. */
    scales: z.object({ from: rulesetValueRefSchema, table: stepTableSchema }).strict().optional(),
    /** Which budget of the action economy a use spends, instead of the list's own default. */
    budget: sheetId.optional(),
  })
  .strict();

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

const catalogEntrySchema = z
  .object({
    id: z.string().max(80).regex(RULESET_ID_PATTERN, "An entry id is lowercase letters, digits and single hyphens"),
    label: promptSafeText(120),
    summary: catalogText(300).optional(),
    /** Values for the catalog's declared filters: a number, one word, or a list of words. */
    filters: z
      .record(z.union([z.number().finite(), z.string().max(80), z.array(z.string().max(80)).max(24)]))
      .optional(),
    /** What picking the entry writes. One entry may fill several lists: a feature plus the counter
     *  that tracks its uses is one pick, not two. */
    rows: z.array(catalogEntryRowSchema).min(1).max(6),
    mechanics: catalogMechanicsSchema.optional(),
  })
  .strict();

const catalogSchema = z
  .object({
    id: sheetId,
    label,
    /** The sheet lists this catalog's entries may write rows into. */
    feeds: z.array(sheetId).min(1).max(8),
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
    /** A package asset instead, for a list too long to sit inside the 256 KB ruleset file. */
    // The shape is checked here so an author's editor flags a wrong path; that it names THIS
    // catalog's id is the refinement below.
    asset: z
      .string()
      .max(240)
      .regex(RULESET_CATALOG_ASSET_PATTERN, "A catalog asset is catalogs/<catalog id>.json")
      .optional(),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    if ((catalog.entries === undefined) === (catalog.asset === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A catalog has exactly one of "entries" or "asset"' });
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
    health: battlePoolSchema,
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

/** A handful of dice a fight rolls. Its own object because an attack roll, an initiative roll and
 *  a roll against death are the same shape. */
const combatDiceSchema = z
  .object({ count: z.number().int().min(1).max(10), sides: z.number().int().min(2).max(1000) })
  .strict();

/** What the extreme faces of a single attack die do. `hit` is for a system whose top face always
 *  lands without being worth more, and `none` is pure arithmetic. */
const combatNaturalsSchema = z
  .object({ max: z.enum(["critical", "hit", "none"]).default("none"), min: z.enum(["miss", "none"]).default("none") })
  .strict();

/** One budget of the action economy: how many times a turn may spend that kind of thing. The first
 *  declared budget is the main one, and is what a standard action spends. */
const combatBudgetSchema = z
  .object({
    id: sheetId,
    label,
    /** `turn` refills at the start of the holder's own turn; `round` when a new round begins. */
    per: z.enum(["turn", "round"]),
    count: z.number().int().min(1).max(10).default(1),
  })
  .strict();

/** A number that comes from one column of the row it belongs to. Its own object so a later slice
 *  can add another source beside `column` without rewriting the rules that read one. */
const combatColumnSchema = z.object({ column: sheetId }).strict();

/** A sheet list whose rows are attacks, and the columns each number comes from. */
const combatAttackSourceSchema = z
  .object({
    list: sheetId,
    budget: sheetId,
    /** The text column the attack is named by. */
    name: sheetId,
    toHit: z
      .object({
        /** An enum column holding an ability id. Another value adds nothing, exactly as
         *  `abilityModFromField` reads one. */
        ability: combatColumnSchema.optional(),
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
  })
  .strict();

/** A sheet list whose catalog-marked rows are abilities, filtered exactly as `battle.skills` are.
 *  What each one DOES is the entry's own `mechanics`; this says what the whole list rolls with. */
const combatAbilitySourceSchema = battleSkillsSchema.extend({
  /** What a row of this list spends unless its own `mechanics.budget` says otherwise. */
  budget: sheetId,
  /** The bonus an entry that rolls to hit adds. */
  toHit: rulesetValueRefSchema.optional(),
  /** The difficulty an entry's save is rolled against. */
  saveDifficulty: rulesetValueRefSchema.optional(),
});

/** The generic actions the kind implements, named once so a ruleset opts into the ones it has. */
const combatStandardActionSchema = z.enum(["dash", "disengage", "dodge", "help", "hide", "ready"]);
export const RULESET_COMBAT_STANDARD_ACTIONS = combatStandardActionSchema.options;

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
]);
export const RULESET_COMBAT_CONDITION_EFFECTS = combatConditionEffectSchema.options;

const combatConditionSchema = z
  .object({
    condition: sheetId,
    effects: z.array(combatConditionEffectSchema).max(12).default([]),
    /** Saves this condition fails without rolling. */
    failsSaves: z.array(sheetId).min(1).max(12).optional(),
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

/** Optional, and absent rather than empty, for the same reason as `catalogs`: a ruleset that says
 *  nothing about combat is read exactly as it was before this block existed. A ruleset may carry
 *  both `combat` and `battle`; the bridge simply never runs for one whose fights follow its own
 *  rules, so an author can keep the older block for an Engine that lacks this one. */
const combatSchema = z
  .object({
    /** The closed registry of combat kinds. Adding one is an Engine PR with regressions. */
    kind: z.literal("attack-vs-defense"),
    health: battlePoolSchema,
    /** What an attack is rolled against. */
    defense: rulesetValueRefSchema,
    initiative: z.object({ dice: combatDiceSchema, modifier: rulesetValueRefSchema.optional() }).strict(),
    attackRoll: z
      .object({
        dice: combatDiceSchema,
        /** Whether a fight may roll twice and keep one. */
        advantage: z.boolean().default(false),
        naturals: combatNaturalsSchema.default({}),
        /** What a critical hit does to the damage: roll the dice twice, or add their highest faces. */
        critical: z.enum(["double-dice", "max-dice", "none"]).default("none"),
      })
      .strict(),
    economy: z
      .object({
        budgets: z.array(combatBudgetSchema).min(1).max(8),
        /** How far a turn may move, in the catalogs' own distance unit. Read from the slice that
         *  gives a fight positions; declared now so a ruleset states it once. */
        movement: rulesetValueRefSchema.optional(),
      })
      .strict(),
    attacks: z.array(combatAttackSourceSchema).max(8).optional(),
    abilities: z.array(combatAbilitySourceSchema).max(8).optional(),
    standard: z.array(combatStandardActionSchema).max(6).optional(),
    conditions: z.array(combatConditionSchema).max(80).optional(),
    concentration: combatConcentrationSchema.optional(),
    dying: combatDyingSchema.optional(),
    /** The damage types this system has. Matched without case, so "Fire" and "fire" are one type. */
    damageTypes: z.array(promptSafeText(40)).max(40).optional(),
    threat: z
      .object({ tiers: z.array(combatThreatTierSchema).min(1).max(40) })
      .strict()
      .optional(),
  })
  .strict();

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
  })
  .strict();

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
    rests: z.array(restSchema).max(12).default([]),
    gm: gmSchema,
    /** Optional, and absent rather than empty when the ruleset ships none, so a file that predates
     *  catalogs still parses to exactly the bytes it did before. */
    catalogs: z.array(catalogSchema).max(12).optional(),
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
): string | null {
  if (item.type === "enum") {
    return typeof equals === "string" && item.values.includes(equals)
      ? null
      : `${JSON.stringify(equals)} is not one of the values of "${item.id}"`;
  }
  if (item.type === "number") {
    return typeof equals === "number" ? null : `"${item.id}" is a number ${noun}, so equals must be a number`;
  }
  if (item.type === "boolean") {
    return typeof equals === "boolean" ? null : `"${item.id}" is a boolean ${noun}, so equals must be true or false`;
  }
  return typeof equals === "string" ? null : `"${item.id}" is a text ${noun}, so equals must be a string`;
}

/** The declared names a value reference may point at, gathered once per sheet. */
interface RulesetSheetNames {
  fields: ReadonlyMap<string, RulesetField>;
  abilities: ReadonlySet<string>;
  skills: ReadonlySet<string>;
  saves: ReadonlySet<string>;
  /** Every derived value the sheet declares, whatever a given reader may read. */
  derived: ReadonlySet<string>;
}

function rulesetSheetNames(sheet: RulesetSheetSchema): RulesetSheetNames {
  return {
    fields: new Map(sheet.fields.map((field) => [field.id, field])),
    abilities: new Set(sheet.abilities.map((ability) => ability.id)),
    skills: new Set(sheet.skills.map((skill) => skill.id)),
    saves: new Set(sheet.saves.map((save) => save.id)),
    derived: new Set(sheet.derived.map((derived) => derived.id)),
  };
}

/** Why a value reference cannot be resolved against this sheet, one entry per key that is wrong.
 *  Shared on purpose: the sheet's own derived values, a live pool's maximum and a catalog entry's
 *  scaled column are all held to the same rule, so a reference that is good in one is good in all.
 *  `readable` is the derived values THIS reference may read: while the sheet's own derived list is
 *  checked that is the ones declared above the reader, which makes a cycle unrepresentable; every
 *  reader outside that order may name any declared one. */
function rulesetValueRefIssues(
  ref: RulesetValueRef,
  names: RulesetSheetNames,
  readable: ReadonlySet<string>,
): Array<{ key: (typeof VALUE_REF_KEYS)[number]; message: string }> {
  const issues: Array<{ key: (typeof VALUE_REF_KEYS)[number]; message: string }> = [];
  const add = (key: (typeof VALUE_REF_KEYS)[number], message: string) => issues.push({ key, message });

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
  const derivedIds = unique(sheet.derived, ["sheet", "derived"], "derived value");
  const lists = unique(sheet.lists, ["sheet", "lists"], "list");
  const pools = unique(sheet.live.pools, ["sheet", "live", "pools"], "pool");
  const tracks = unique(sheet.live.tracks, ["sheet", "live", "tracks"], "track");
  const liveText = unique(sheet.live.text, ["sheet", "live", "text"], "live text");
  const conditions = unique(sheet.live.conditions, ["sheet", "live", "conditions"], "condition");
  const tiers = unique(resolution.proficiencyTiers, ["resolution", "proficiencyTiers"], "proficiency tier");
  unique(def.rests, ["rests"], "rest");
  const poolGroups = new Set(sheet.live.pools.map((pool) => pool.group).filter((group): group is string => !!group));

  // A skill and a save may not share an id: a check request names either, and the sheet command
  // addresses both, so one name must mean one thing.
  for (const [index, save] of sheet.saves.entries()) {
    if (skills.has(save.id)) issue(["sheet", "saves", index, "id"], `"${save.id}" is already a skill id`);
  }
  for (const [index, pool] of sheet.live.pools.entries()) {
    if (tracks.has(pool.id)) issue(["sheet", "live", "pools", index, "id"], `"${pool.id}" is already a track id`);
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
    item: z.infer<typeof rulesetFieldSchema> | z.infer<typeof rulesetListColumnSchema>,
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
  const checkHideWhen = (hideWhen: z.infer<typeof hideWhenSchema> | undefined, path: (string | number)[]) => {
    if (!hideWhen) return;
    const field = fieldById.get(hideWhen.field);
    if (!field) return issue([...path, "hideWhen", "field"], `Unknown field "${hideWhen.field}"`);
    // `equals` must be a value the field can actually hold, or the item could never hide.
    const message = equalsIssue(field, hideWhen.equals, "field");
    if (message) issue([...path, "hideWhen", "equals"], message);
  };
  sheet.fields.forEach((field, index) => {
    const path = ["sheet", "fields", index];
    checkTyped(field, path);
    checkSection(field.section, path);
    checkHideWhen(field.hideWhen, path);
  });

  // A value reference may read a derived value only when it is declared ABOVE the reader, which
  // makes a cycle unrepresentable and lets evaluation run once, top to bottom.
  const names: RulesetSheetNames = { fields: fieldById, abilities, skills, saves, derived: derivedIds };
  const checkRef = (ref: RulesetValueRef, path: (string | number)[], derivedAbove: ReadonlySet<string>) => {
    for (const entry of rulesetValueRefIssues(ref, names, derivedAbove)) {
      issue([...path, entry.key], entry.message);
    }
  };
  const refsOf = (derived: z.infer<typeof rulesetDerivedSchema>): RulesetValueRef[] =>
    derived.op === "stepTable" ? [derived.from] : derived.op === "scale" ? [derived.of] : derived.of;

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
    checkSection(derived.section, path);
    checkHideWhen(derived.hideWhen, path);
    derivedAbove.add(derived.id);
  });

  // The proficiency bonus feeds every skill and save modifier, so the value it reads, and every
  // derived value above that one, cannot itself read a skill or save modifier.
  if (resolution.proficiency) {
    checkRef(resolution.proficiency.bonus, ["resolution", "proficiency", "bonus"], derivedIds);
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

  if (resolution.kind === "dice-sum") {
    if (resolution.dice.count !== 1 && (resolution.naturals.check !== "none" || resolution.naturals.save !== "none")) {
      issue(["resolution", "naturals"], "Natural results need a single die; with several dice use none");
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
    if (resolution.double) faceIssue(resolution.double.from, ["resolution", "double", "from"]);
    if (resolution.explode) faceIssue(resolution.explode.from, ["resolution", "explode", "from"]);
    // A face that both succeeds and cancels, or both succeeds and botches, would count itself
    // twice in opposite directions. The lowest target the GM can set is the line.
    for (const key of ["cancel", "botch"] as const) {
      const rule = resolution[key];
      if (rule && rule.upTo >= target.min) {
        issue(["resolution", key, "upTo"], `A ${key} face must be below the lowest target (${target.min})`);
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

  sheet.live.pools.forEach((pool, index) => {
    const path = ["sheet", "live", "pools", index];
    checkRef(pool.max, [...path, "max"], derivedIds);
    checkHideWhen(pool.hideWhen, path);
  });
  sheet.live.tracks.forEach((track, index) => {
    const path = ["sheet", "live", "tracks", index];
    if (track.min > track.max) issue([...path, "min"], "min is above max");
    if (track.default !== undefined && (track.default < track.min || track.default > track.max)) {
      issue([...path, "default"], "default is outside min..max");
    }
  });

  const listById = new Map(sheet.lists.map((list) => [list.id, list]));
  def.rests.forEach((rest, restIndex) => {
    rest.restore.forEach((op, opIndex) => {
      const path = ["rests", restIndex, "restore", opIndex];
      if (op.pool !== undefined && !pools.has(op.pool)) issue([...path, "pool"], `Unknown pool "${op.pool}"`);
      if (op.poolGroup !== undefined && !poolGroups.has(op.poolGroup)) {
        issue([...path, "poolGroup"], `No pool declares the group "${op.poolGroup}"`);
      }
      if (op.track !== undefined && !tracks.has(op.track)) issue([...path, "track"], `Unknown track "${op.track}"`);
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
    if (typeOf(entry.nameColumn) !== "text") issue([...path, "nameColumn"], "Must name a text column");
    if (entry.groupBy && typeOf(entry.groupBy) === undefined)
      issue([...path, "groupBy"], `Unknown column "${entry.groupBy}"`);
    if (entry.onlyWhen && typeOf(entry.onlyWhen) !== "boolean")
      issue([...path, "onlyWhen"], "Must name a boolean column");
  });

  const catalogs = def.catalogs ?? [];
  unique(catalogs, ["catalogs"], "catalog");
  catalogs.forEach((catalog, index) => {
    const path = ["catalogs", index];
    catalog.feeds.forEach((listId, feedIndex) => {
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
    for (const entryIssue of rulesetCatalogEntryIssues(def, catalog, catalog.entries ?? [])) {
      issue([...path, "entries", ...entryIssue.path], entryIssue.message);
    }
  });

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

  if (def.battle) {
    const battle = def.battle;
    const battlePool = declaredPool;
    battlePool(battle.health.pool, ["battle", "health", "pool"]);
    // A pool that starts empty counts UP (stress, corruption), so as health it would put every
    // fresh character into their first fight already down.
    if (sheet.live.pools.find((pool) => pool.id === battle.health.pool)?.start === "empty") {
      issue(["battle", "health", "pool"], `"${battle.health.pool}" starts empty, so it cannot be the health pool`);
    }
    if (battle.energy) {
      battlePool(battle.energy.pool, ["battle", "energy", "pool"]);
      // Health is not spendable as energy: the Engine drains hit points as damage and spends the
      // energy pool as a cost, and one pool cannot be both.
      if (battle.energy.pool === battle.health.pool) {
        issue(["battle", "energy", "pool"], "The energy pool cannot also be the health pool");
      }
    }
    const slotLevels = new Set<number>();
    const slotPools = new Set<string>();
    battle.slots?.forEach((slot, index) => {
      const path = ["battle", "slots", index];
      battlePool(slot.pool, [...path, "pool"]);
      if (slot.pool === battle.health.pool || slot.pool === battle.energy?.pool) {
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
    declaredPool(combat.health.pool, at("health", "pool"));
    // A pool that starts empty counts UP (stress, corruption), so as health it would put every
    // fresh character into their first fight already down.
    if (sheet.live.pools.find((pool) => pool.id === combat.health.pool)?.start === "empty") {
      issue(at("health", "pool"), `"${combat.health.pool}" starts empty, so it cannot be the health pool`);
    }
    checkRef(combat.defense, at("defense"), derivedIds);
    if (combat.initiative.modifier) checkRef(combat.initiative.modifier, at("initiative", "modifier"), derivedIds);
    // The same rule the check dice follow: an extreme face is only a face when one die was thrown.
    const naturals = combat.attackRoll.naturals;
    if (combat.attackRoll.dice.count !== 1 && (naturals.max !== "none" || naturals.min !== "none")) {
      issue(at("attackRoll", "naturals"), "Natural results need a single die; with several dice use none");
    }
    const budgets = unique(combat.economy.budgets, at("economy", "budgets"), "budget");
    if (combat.economy.movement) checkRef(combat.economy.movement, at("economy", "movement"), derivedIds);
    const checkBudget = (budget: string, path: (string | number)[]) => {
      if (!budgets.has(budget)) issue(path, `Unknown budget "${budget}"`);
    };

    combat.attacks?.forEach((source, index) => {
      const path = at("attacks", index);
      checkBudget(source.budget, [...path, "budget"]);
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
      // An ability column is an enum of ability ids; a value that is not one adds nothing, exactly
      // as `abilityModFromField` reads one.
      column(source.toHit.ability?.column, "enum", [...path, "toHit", "ability", "column"]);
      column(source.toHit.proficiency?.column, "boolean", [...path, "toHit", "proficiency", "column"]);
      column(source.toHit.bonus?.column, "number", [...path, "toHit", "bonus", "column"]);
      column(source.damage.dice.column, "dice", [...path, "damage", "dice", "column"]);
      column(source.damage.ability?.column, "enum", [...path, "damage", "ability", "column"]);
      column(source.damage.bonus?.column, "number", [...path, "damage", "bonus", "column"]);
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
    });

    const standard = new Set<string>();
    combat.standard?.forEach((action, index) => {
      if (standard.has(action)) issue(at("standard", index), `Duplicate standard action "${action}"`);
      standard.add(action);
    });

    const mapped = new Set<string>();
    combat.conditions?.forEach((entry, index) => {
      const path = at("conditions", index);
      if (!conditions.has(entry.condition)) issue([...path, "condition"], `Unknown condition "${entry.condition}"`);
      if (mapped.has(entry.condition)) issue([...path, "condition"], `Duplicate condition "${entry.condition}"`);
      mapped.add(entry.condition);
      entry.failsSaves?.forEach((save, saveIndex) => {
        if (!saves.has(save)) issue([...path, "failsSaves", saveIndex], `Unknown save "${save}"`);
      });
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
      const key = type.toLowerCase();
      if (damageTypes.has(key)) issue(at("damageTypes", index), `Duplicate damage type "${type}"`);
      damageTypes.add(key);
    });

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
        const watched = [...sheet.fields, ...sheet.derived, ...sheet.lists, ...sheet.live.pools].flatMap((item) =>
          item.hideWhen?.field === entry.id && typeof item.hideWhen.equals === "string" ? [item] : [],
        );
        entry.removeValues.forEach((value, valueIndex) => {
          const user = watched.find((item) => item.hideWhen!.equals === value);
          if (user) {
            issue(
              [...at, "removeValues", valueIndex],
              `"${user.id}" is hidden when "${entry.id}" is "${value}", so a layer cannot remove that value`,
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
export const rulesetDefinitionSchema = rulesetDefinitionBaseSchema.superRefine(refineRulesetDefinition);

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
export const rulesetEffectiveDefinitionSchema = rulesetDefinitionBaseSchema
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
export type RulesetField = z.infer<typeof rulesetFieldSchema>;
export type RulesetListColumn = z.infer<typeof rulesetListColumnSchema>;
export type RulesetDerived = z.infer<typeof rulesetDerivedSchema>;
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
export type RulesetCombatConcentration = NonNullable<RulesetCombat["concentration"]>;
export type RulesetCombatDying = NonNullable<RulesetCombat["dying"]>;
export type RulesetCombatThreatTier = NonNullable<RulesetCombat["threat"]>["tiers"][number];
/** One condition a catalog entry puts on what it touches. */
export type RulesetCatalogApplies = NonNullable<RulesetCatalogMechanics["applies"]>[number];
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

/** Parse a ruleset document. Never throws: a file the Engine cannot use comes back as a list of
 *  plain `path: message` lines an author can act on. */
export function parseRulesetDefinition(input: unknown): RulesetParseResult {
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
export type RulesetCatalogEntryRow = z.infer<typeof catalogEntryRowSchema>;
/** The columns of one entry row the ruleset sets, keyed by column id. */
export type RulesetCatalogScaled = z.infer<typeof catalogScaledSchema>;
export type RulesetCatalogScaledColumn = z.infer<typeof catalogScaledColumnSchema>;
export type RulesetCatalogFilter = z.infer<typeof catalogFilterSchema>;
export type RulesetCatalogMechanics = z.infer<typeof catalogMechanicsSchema>;
export type RulesetList = RulesetSheetSchema["lists"][number];

/** The entries of every catalog the caller fetched, keyed by catalog id. Fetching is the caller's
 *  job: a catalog may live in an asset behind a route, and nothing that reads this does I/O. It sits
 *  here rather than beside one of its readers because the combat bridge, the scaled-row recompute
 *  and the `use` command all take it. */
export type RulesetCatalogEntriesById = Record<string, readonly RulesetCatalogEntry[]>;

/** Whether a row of values could be stored in a list, column by column. Shared on purpose: the
 *  schema runs it over every catalog entry, and the client runs it again over the rows a player
 *  picked, so the picker can never splice in something the editor would then refuse. */
export function rulesetListRowIssues(list: RulesetList, values: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const columns = new Map(list.columns.map((column) => [column.id, column]));
  for (const [key, value] of Object.entries(values)) {
    const column = columns.get(key);
    if (!column) {
      issues.push(`Unknown column "${key}"`);
      continue;
    }
    if (column.type === "number") {
      if (typeof value !== "number") issues.push(`Column "${key}" takes a number`);
      else if (column.integer && !Number.isInteger(value)) issues.push(`Column "${key}" takes a whole number`);
      else if (value < column.min || value > column.max) {
        issues.push(`Column "${key}" is outside ${column.min} to ${column.max}`);
      }
    } else if (column.type === "boolean") {
      if (typeof value !== "boolean") issues.push(`Column "${key}" takes true or false`);
    } else if (column.type === "enum") {
      if (typeof value !== "string" || !column.values.includes(value)) {
        issues.push(`Column "${key}" takes one of its declared values`);
      }
    } else if (column.type === "dice") {
      if (typeof value !== "string" || value.length > 40) issues.push(`Column "${key}" takes dice text`);
    } else if (typeof value !== "string") {
      issues.push(`Column "${key}" takes text`);
    } else if (value.length > column.maxLength) {
      issues.push(`Column "${key}" is longer than ${column.maxLength} characters`);
    }
  }
  for (const column of list.columns) {
    if (column.required && values[column.id] === undefined) issues.push(`Column "${column.id}" is required`);
  }
  return issues;
}

/** Where an issue sits inside the entries array, so the same check can be reported as a zod path
 *  inside `ruleset.json` and as a `path: message` line for a catalog asset. */
export type RulesetCatalogEntryIssue = { path: (string | number)[]; message: string };

/** Everything an entry must satisfy against the ruleset that declares it. */
export function rulesetCatalogEntryIssues(
  definition: RulesetDefinition,
  catalog: RulesetCatalogHeader,
  entries: readonly RulesetCatalogEntry[],
): RulesetCatalogEntryIssue[] {
  const issues: RulesetCatalogEntryIssue[] = [];
  const add = (path: (string | number)[], message: string) => issues.push({ path, message });
  const listById = new Map(definition.sheet.lists.map((list) => [list.id, list]));
  const names = rulesetSheetNames(definition.sheet);
  const feeds = new Set(catalog.feeds);
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

  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) add([index, "id"], `Duplicate entry id "${entry.id}"`);
    seen.add(entry.id);

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

    // How many rows this entry writes into each list, because a row the ruleset keeps up to date
    // has to be the entry's only one there: a marked row on a sheet is then matched to its spec
    // without guessing which of two identical marks it came from.
    const rowsPerList = new Map<string, number>();
    for (const row of entry.rows) rowsPerList.set(row.list, (rowsPerList.get(row.list) ?? 0) + 1);

    entry.rows.forEach((row, rowIndex) => {
      const path = [index, "rows", rowIndex];
      if (!feeds.has(row.list)) return add([...path, "list"], `"${row.list}" is not one of this catalog's feeds`);
      const list = listById.get(row.list);
      if (!list) return add([...path, "list"], `Unknown list "${row.list}"`);
      for (const message of rulesetListRowIssues(list, row.values)) add([...path, "values"], message);
      if (!row.scaled) return;
      if ((rowsPerList.get(row.list) ?? 0) > 1) {
        add([...path, "scaled"], `A scaled row must be this entry's only row for the list "${row.list}"`);
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
        // A scaled column reads the sheet exactly as a live pool's maximum does, so any declared
        // derived value is fair game: there is no top-to-bottom order to sit inside out here.
        for (const refIssue of rulesetValueRefIssues(scaled.from, names, names.derived)) {
          add([...path, "scaled", columnId, "from", refIssue.key], refIssue.message);
        }
      }
    });

    const mechanics = entry.mechanics;
    if (mechanics?.save && !saves.has(mechanics.save.save)) {
      add([index, "mechanics", "save", "save"], `Unknown save "${mechanics.save.save}"`);
    }
    mechanics?.cost?.forEach((cost, costIndex) => {
      if (!costTargets.has(cost.pool)) {
        add([index, "mechanics", "cost", costIndex, "pool"], `Unknown pool or pool group "${cost.pool}"`);
      }
    });
    // A condition an entry applies is one of the sheet's own, so a fight and the sheet keep one
    // record of what is wrong with a character.
    mechanics?.applies?.forEach((applies, appliesIndex) => {
      const path = [index, "mechanics", "applies", appliesIndex];
      if (!liveConditions.has(applies.condition)) {
        add([...path, "condition"], `Unknown condition "${applies.condition}"`);
      }
      if (applies.saveEnds && !saves.has(applies.saveEnds.save)) {
        add([...path, "saveEnds", "save"], `Unknown save "${applies.saveEnds.save}"`);
      }
    });
    // A save needs something to be rolled against. In a fight that number comes from the abilities
    // source of the list the entry lands in, so an entry that asks for a save (its own, or one that
    // ends a condition) in a list whose source declares no `saveDifficulty` would be saved against
    // nothing, and everybody would always succeed.
    const asksForSave = !!mechanics?.save || !!mechanics?.applies?.some((applies) => applies.saveEnds);
    if (asksForSave && definition.combat) {
      const lists = new Set(entry.rows.map((row) => row.list));
      (definition.combat.abilities ?? []).forEach((source) => {
        if (lists.has(source.list) && source.saveDifficulty === undefined) {
          add(
            [index, "mechanics", mechanics?.save ? "save" : "applies"],
            `The combat abilities source for "${source.list}" declares no saveDifficulty for this save to be rolled against`,
          );
        }
      });
    }
    if (mechanics?.budget !== undefined && budgets && !budgets.has(mechanics.budget)) {
      add([index, "mechanics", "budget"], `Unknown budget "${mechanics.budget}"`);
    }
    if (mechanics?.scales) {
      // A scaling amount reads the sheet exactly as a scaled column does, so any declared derived
      // value is fair game.
      for (const refIssue of rulesetValueRefIssues(mechanics.scales.from, names, names.derived)) {
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
 *  rewrites a character. The mark only says where the row came from. */
export function rowsFromCatalogEntry(catalogId: string, entry: RulesetCatalogEntry): RulesetCatalogRow[] {
  const ref = catalogRowRef(catalogId, entry.id);
  return entry.rows.map((row) => ({ list: row.list, row: { ...row.values, [RULESET_CATALOG_ROW_KEY]: ref } }));
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

/** Read a catalog asset against the ruleset that declares it. Never throws: an asset the Engine
 *  cannot use comes back as plain `path: message` lines, the same way a ruleset file does. */
export function parseRulesetCatalogFile(
  definition: RulesetDefinition,
  catalogId: string,
  input: unknown,
): RulesetCatalogParseResult {
  const catalog = definition.catalogs?.find((entry) => entry.id === catalogId);
  if (!catalog) return { ok: false, issues: [`(root): "${catalogId}" is not a catalog of this ruleset`] };
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
  const issues = rulesetCatalogEntryIssues(definition, catalog, parsed.data.entries);
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
 *  out-of-range values clamped on edit and never on read), so there are no migration scripts. */
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
