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

/** How many automatic successes, or extra dice, one purchase may be worth. An Engine ceiling rather
 *  than an author's choice: past this the roll stops being a roll. */
const SPEND_EFFECT_MAX = 10;

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
    perCheck: z.number().int().min(1).max(SPEND_EFFECT_MAX),
  })
  .strict()
  .superRefine((spend, ctx) => {
    if (spend.successes === undefined && spend.dice === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A spend buys successes, dice, or both" });
    }
  });

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
   *  stops a full pool buying an unlosable roll. */
  spend: z.array(resolutionSpendSchema).max(2).optional(),
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
    /** The per-die success threshold. `min` below `max` lets the GM set it per check. */
    target: z.object({ default: poolFace, min: poolFace, max: poolFace }).strict(),
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

/** How many levels one wound track may have. A track is a column of boxes on a sheet, so this is a
 *  ceiling on something a player reads at a glance rather than on anything the Engine computes. */
export const RULESET_TRACK_LEVELS_MAX = 16;
/** How many kinds of harm one wound track may take. Three (bashing, lethal, aggravated) is the
 *  usual number; six leaves room without turning a track into a table. */
export const RULESET_TRACK_KINDS_MAX = 6;

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
    levels: z.array(liveTrackLevelSchema).min(1).max(RULESET_TRACK_LEVELS_MAX).optional(),
    kinds: z.array(liveTrackKindSchema).min(1).max(RULESET_TRACK_KINDS_MAX).optional(),
    /** Printed in the sheet block even at its default, for a rating that matters every turn. */
    alwaysShow: z.boolean().optional(),
    /** Off the sheet while a field says so, as a pool can be. Never on a wound track, which rolls
     *  and fights read whatever the sheet shows. */
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

/** One more amount on the same blow, rolled and typed on its own: "and 2d6 fire", "and 1d6 poison
 *  the target may shake off". Never a second attack roll: a clause rides the blow that carried it. */
const catalogPlusClauseSchema = z
  .object({
    dice: catalogDice.optional(),
    flat: z.number().int().min(-1000).max(10000).optional(),
    type: promptSafeText(40).optional(),
    save: catalogClauseSaveSchema.optional(),
  })
  .strict()
  .superRefine((clause, ctx) => {
    if (clause.dice === undefined && clause.flat === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A clause names dice, a flat amount, or both" });
    }
  });

/** The generic actions the kind implements, named once so a ruleset opts into the ones it has. Up
 *  here rather than beside the combat block because a catalog entry names them too: an ability that
 *  lets its holder buy one of them with another budget says which ones. */
const combatStandardActionSchema = z.enum(["dash", "disengage", "dodge", "help", "hide", "ready"]);
export const RULESET_COMBAT_STANDARD_ACTIONS = combatStandardActionSchema.options;

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

/** What a rider is, minus where it comes from. A rider is PASSIVE: nobody takes it, and it adds one
 *  more damage clause to the first qualifying hit of its period, automatically.
 *
 *  `when` is any-of: one of the listed things being true is enough. "advantage" is how the attack
 *  roll finally leaned, and "ally-adjacent" is a standing ally of the attacker who can act, within
 *  one cell of the target on a board and anywhere at all without one. */
const riderCoreShape = {
  /** The one moment a rider fires. More of them arrive with the slice that builds windows. */
  on: z.literal("hit"),
  when: z
    .array(z.enum(["advantage", "ally-adjacent"]))
    .min(1)
    .max(2)
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
 *  weapons says which without the Engine knowing one word of what a weapon is. */
const catalogRiderSchema = z
  .object({
    ...riderCoreShape,
    sources: z.array(sheetId).min(1).max(8).optional(),
    requires: z.object({ column: sheetId }).strict().optional(),
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
  "damageType",
  "plus",
  "attackRoll",
  "save",
  "cost",
  "perCostStep",
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

/** What an entry DOES. The Engine does not act on it in this slice: it validates it and the client
 *  shows one compact line. A later combat bridge turns it into the Engine's own `CombatSkill`, so
 *  the vocabulary is closed and strict, and a typo is refused now rather than ignored then. */
const catalogMechanicsSchema = z
  .object({
    kind: z.enum(["attack", "heal", "buff", "debuff", "utility", "rider"]),
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
    /** More amounts on the same blow, beside `amount`, each rolled and typed on its own. */
    plus: z.array(catalogPlusClauseSchema).max(RULESET_DAMAGE_MAX_PLUS).optional(),
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
    /** What using this entry does to a CHECK the character is about to make, rather than to a
     *  fight. A charm that lets a roll be re-thrown, or that simply hands out successes. Only a
     *  pool ruleset can honour any of it, and the cross-checks say so at import. */
    check: z
      .object({
        /** Throw the dice at or below `upTo` again. `once` replaces each of them one time and
         *  lets the new face stand; `until` keeps going, under the Engine's own hard ceiling. */
        reroll: z
          .object({ upTo: z.number().int().min(1).max(999), mode: z.enum(["once", "until"]) })
          .strict()
          .optional(),
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
      })
      .optional(),
    concentration: z.boolean().optional(),
    /** Something taken at a MOMENT rather than on a turn. `true` says only that much, and an entry
     *  that says only that much is on no menu: nothing knows which moment it waits for. An object
     *  names the moment, and then the entry is offered in the window that moment opens.
     *
     *  `on` is a closed list because the Engine has to be the one that notices the moment:
     *  - `aimed`: somebody is about to do something to the holder. The window opens BEFORE it
     *    resolves, and what is taken there may `cancel` it.
     *  - `harmed`: something has just hurt the holder. The window opens AFTER it resolves, because
     *    the amount is what the moment is about, and nothing taken there unmakes it.
     *
     *  `at` says whom what is taken may be aimed at. `source` is whoever caused the moment, which
     *  is the only target most of these have, and is filled in rather than picked. */
    reaction: z
      .union([
        // `false` has been legal since the key existed and says the entry is not a reaction at all,
        // which is what leaving it out says. A package that ships one is not broken by this.
        z.literal(false),
        z.literal(true),
        z
          .object({
            on: z.enum(["aimed", "harmed"]),
            at: z.enum(["source", "chosen"]).default("source"),
            /** Stops what opened the window from happening at all. Only an `aimed` reaction may:
             *  a moment that has already happened cannot be called off. */
            cancels: z.literal(true).optional(),
          })
          .strict()
          .superRefine((reaction, ctx) => {
            if (reaction.cancels && reaction.on !== "aimed") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Only an "aimed" reaction cancels: what has already happened cannot be called off',
              });
            }
          }),
      ])
      .optional(),
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
      .object({ actions: z.array(combatStandardActionSchema).min(1).max(6), budget: sheetId })
      .strict()
      .optional(),
    /** What this adds to the first qualifying hit of a period, all by itself. */
    rider: catalogRiderSchema.optional(),
  })
  .strict()
  .superRefine((mechanics, ctx) => {
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

/** What one action does to what it reaches: the same amount shape a catalog entry uses, plus the
 *  type the target's own hide is checked against. */
const creatureDamageSchema = z
  .object({
    dice: catalogDice.optional(),
    flat: z.number().int().min(-1000).max(10000).optional(),
    type: promptSafeText(40).optional(),
    /** More amounts on the same blow, each rolled and typed on its own. */
    plus: z.array(catalogPlusClauseSchema).max(RULESET_DAMAGE_MAX_PLUS).optional(),
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

const creatureActionSchema = z
  .object({
    id: sheetId,
    name: promptSafeText(80),
    budget: sheetId,
    toHit: z.number().int().min(-50).max(100).optional(),
    /** The amount simply lands: no roll to make. */
    autoHit: z.boolean().optional(),
    damage: creatureDamageSchema.optional(),
    save: creatureSaveSchema.optional(),
    /** What a save that ENDS one of `applies` is rolled against, when the action has no save of its
     *  own to borrow the number from. */
    saveDifficulty: z.number().int().min(0).max(1000).optional(),
    applies: z.array(catalogAppliesSchema).max(4).optional(),
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
        shape: z.enum(["burst", "cone", "line"]),
        size: z.number().finite().gt(0).max(10000),
        /** False spares the creature's own side, as a catalog entry's does. */
        friendlyFire: z.boolean().optional(),
      })
      .strict()
      .optional(),
    /** How many times it can be done at all, and over what stretch. */
    uses: z
      .object({ per: z.enum(["encounter", "day"]), count: z.number().int().min(1).max(20) })
      .strict()
      .optional(),
    /** Spent when it is used, and rolled for at the start of the creature's own turn: `from` or
     *  higher on these dice brings it back. It starts the fight available. */
    recharge: z
      .object({ dice: combatDiceSchema, from: z.number().int().min(1).max(1000) })
      .strict()
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
  })
  .strict()
  .superRefine((action, ctx) => {
    if (action.sequence) {
      // A sequence is a container. Anything else on it would be a second thing the one budget also
      // did, with nothing to say when it happened.
      for (const key of [
        "toHit",
        "autoHit",
        "damage",
        "save",
        "saveDifficulty",
        "applies",
        "targetCount",
        "area",
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
] as const;
/** The keys a creature WITHOUT a sheet cannot go without. */
export const RULESET_CREATURE_PLAIN_NEEDS = ["health", "defense", "initiativeModifier"] as const;
const CREATURE_SHEET_REPLACES = RULESET_CREATURE_SHEET_REPLACES;
const CREATURE_PLAIN_NEEDS = RULESET_CREATURE_PLAIN_NEEDS;

const creatureFields = {
  health: creatureHealthSchema,
  defense: z.number().int().min(0).max(1000),
  /** In the ruleset's own distance unit, read by the slice that gives a fight positions. */
  speed: z.number().finite().min(0).max(10000).optional(),
  initiativeModifier: z.number().int().min(-50).max(100),
  /** Scores, keyed by the sheet's own ability ids. Shown to the Game Master; a later slice asks a
   *  creature for a check with them. */
  abilities: z.record(z.number().int().min(-1000).max(1000)).optional(),
  /** What it adds when it saves, keyed by the sheet's own save ids. One it does not name is zero. */
  saves: z.record(z.number().int().min(-50).max(50)).optional(),
  /** Damage types, matched without case: half, double, none at all. */
  resist: z.array(promptSafeText(40)).max(30).optional(),
  vulnerable: z.array(promptSafeText(40)).max(30).optional(),
  immune: z.array(promptSafeText(40)).max(30).optional(),
  /** The sheet's own condition ids this creature is never in. */
  conditionImmunities: z.array(sheetId).max(40).optional(),
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
  actions: z.array(creatureActionSchema).min(1).max(RULESET_CREATURE_MAX_ACTIONS),
  /** What this creature adds to the first qualifying hit of a period, all by itself. */
  riders: z.array(creatureRiderSchema).min(1).max(RULESET_CREATURE_MAX_RIDERS).optional(),
};

function creatureSignatureIssues(
  creature: { signaturePoints?: number; actions: Array<{ signature?: { cost: number } }> },
  ctx: z.RefinementCtx,
): void {
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
export const rulesetProposedCreatureSchema = z.preprocess(
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
      if (creature.actions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actions"],
          message: "A creature without a sheet needs at least one action, or it has nothing to do",
        });
      }
    }),
);

/** A creature a bestiary ships: the plain block, or a `sheet` in the ruleset's own terms. With a
 *  sheet it is built the way a party member is, so the numbers the sheet gives are not also given
 *  here, and there is one place each of them comes from. */
export const rulesetCreatureSchema = z
  .object({
    ...creatureFields,
    health: creatureFields.health.optional(),
    defense: creatureFields.defense.optional(),
    initiativeModifier: creatureFields.initiativeModifier.optional(),
    // A creature whose sheet gives it abilities may have no block actions of its own at all.
    actions: z.array(creatureActionSchema).max(RULESET_CREATURE_MAX_ACTIONS).default([]),
    sheet: creatureSheetSchema.optional(),
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
    if (creature.actions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions"],
        message: "A creature without a sheet needs at least one action, or it has nothing to do",
      });
    }
  });

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
    rows: z.array(catalogEntryRowSchema).min(1).max(6).optional(),
    mechanics: catalogMechanicsSchema.optional(),
    /** An opponent instead of rows. An entry is one or the other, never both: rows are picked onto
     *  a character sheet and a creature is put on the other side of a fight. */
    creature: rulesetCreatureSchema.optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if ((entry.rows === undefined) === (entry.creature === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'An entry has exactly one of "rows" or "creature"' });
    }
    if (entry.creature && entry.mechanics) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mechanics"],
        message: "A creature says what it does in its own actions, so it carries no mechanics",
      });
    }
  });

const catalogSchema = z
  .object({
    id: sheetId,
    label,
    /** What this catalog's entries are. `rows` is the picker's own kind, offered on every list the
     *  catalog feeds; `creatures` is a bestiary, which writes nothing onto a sheet and is never
     *  offered by the picker at all. */
    holds: z.enum(["rows", "creatures"]).default("rows"),
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
    // The picker offers a catalog on the lists it feeds, so a bestiary declaring feeds would be
    // offered on a sheet it can write nothing into.
    if (catalog.holds === "creatures") {
      if (catalog.feeds !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["feeds"],
          message: "A catalog of creatures writes no rows, so it feeds no list",
        });
      }
    } else if (catalog.feeds === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["feeds"],
        message: 'A catalog of rows names the lists it "feeds"',
      });
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
  .object({ default: sheetId, byType: z.record(sheetId).optional(), marks: z.enum(["per-blow", "per-point"]) })
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
  /** Half of every kind of harm, whatever the hide underneath already said. */
  "resist-all",
  /** The holder may not point anything at whoever put this on them. */
  "cannot-target-source",
  /** And may not walk to a cell nearer them than the one they stand in. Read only by a fight with
   *  a board, exactly as the three effects above it are, so a ruleset may say it either way. */
  "cannot-approach-source",
]);
export const RULESET_COMBAT_CONDITION_EFFECTS = combatConditionEffectSchema.options;

/** The two effects `saves` narrows. Anything else ignores it, so naming saves without one of these
 *  is an author saying something the fight could never read. */
const SAVE_SCOPED_EFFECTS = ["own-saves-advantage", "own-saves-disadvantage"] as const;

const combatConditionSchema = z
  .object({
    condition: sheetId,
    effects: z.array(combatConditionEffectSchema).max(12).default([]),
    /** Saves this condition fails without rolling. */
    failsSaves: z.array(sheetId).min(1).max(12).optional(),
    /** Which saves the save effects above are about. All of them when this is left out. */
    saves: z.array(sheetId).min(1).max(12).optional(),
    /**
     * Only while whoever applied this is in sight. `true` gates the whole condition; a list gates
     * only the effects it names and leaves the rest standing, which is what a fright that stops you
     * walking closer whether or not you can see it needs. Without a board it is always in sight: a
     * fight that measures nothing has no line to break.
     */
    whileSourceInSight: z.union([z.literal(true), z.array(combatConditionEffectSchema).min(1).max(12)]).optional(),
    /** It comes off the moment whoever applied it goes down. */
    endsWhenSourceDown: z.boolean().optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.saves && !entry.effects.some((effect) => (SAVE_SCOPED_EFFECTS as readonly string[]).includes(effect))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["saves"],
        message: `"saves" narrows ${SAVE_SCOPED_EFFECTS.join(" and ")}, so it needs one of them beside it`,
      });
    }
  });

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
    health: combatHealthSchema,
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
        /** How far a turn may move, in the ruleset's own distance unit. */
        movement: rulesetValueRefSchema.optional(),
      })
      .strict(),
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
    /** What standing behind something adds to the defense an attack is rolled against. */
    cover: z
      .object({ bonus: z.number().int().min(0).max(100) })
      .strict()
      .optional(),
    /** The budget a strike at somebody leaving one's reach is paid out of. A ruleset that declares
     *  none has no such strikes. */
    opportunity: z.object({ budget: sheetId }).strict().optional(),
    attacks: z.array(combatAttackSourceSchema).max(8).optional(),
    abilities: z.array(combatAbilitySourceSchema).max(8).optional(),
    standard: z.array(combatStandardActionSchema).max(6).optional(),
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
    conditions: z.array(combatConditionSchema).max(80).optional(),
    concentration: combatConcentrationSchema.optional(),
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

  // Wound tracks. `kinds` says what a mark may be, so it needs `levels` for a mark to sit on, and
  // the severities have to be distinct or "the lowest-severity mark" would name two boxes at once.
  const woundTracks = new Set<string>();
  sheet.live.tracks.forEach((track, index) => {
    const path = ["sheet", "live", "tracks", index];
    if (!track.levels) {
      if (track.kinds) issue([...path, "kinds"], "kinds needs levels beside it: there is nothing to mark");
      return;
    }
    woundTracks.add(track.id);
    if (!track.kinds) {
      issue([...path, "levels"], "A track with levels needs kinds beside it: a mark has to be of something");
    }
    // A wound track's length is its levels, so the two numbers beside them cannot say anything else.
    if (track.min !== 0) issue([...path, "min"], "A wound track starts unmarked, so its min is 0");
    if (track.max !== track.levels.length) {
      issue([...path, "max"], `A wound track holds one mark per level, so its max is ${track.levels.length}`);
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
    if (resolution.kind !== "dice-pool") {
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
      issue(path, `"${resolution.penaltyFrom}" has no levels, so it carries no penalty to apply`);
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
    checkHideWhen(track.hideWhen, path);
    if (typeof track.max !== "number") {
      // A maximum the sheet works out is only known per character, so only the floor is checked here;
      // the live state holds a value inside whatever the character's own maximum turns out to be.
      checkRef(track.max, [...path, "max"], derivedIds);
      if (track.default !== undefined && track.default < track.min) issue([...path, "default"], "default is below min");
      return;
    }
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

  const catalogs = def.catalogs ?? [];
  unique(catalogs, ["catalogs"], "catalog");
  catalogs.forEach((catalog, index) => {
    const path = ["catalogs", index];
    // A creature is written in the numbers a fight reads, and those numbers are the `combat` block's
    // own: its budgets, its saves, its damage types and its threat scale.
    if (catalog.holds === "creatures" && !def.combat) {
      issue([...path, "holds"], "A catalog of creatures needs a combat block for its creatures to be written in");
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

    // Everything below means nothing without a cell to measure in, so a ruleset that declares one
    // of them and no `distance` is told here rather than carrying a rule no fight could ever read.
    if (!combat.distance) {
      const needsDistance = (["ranged", "cover", "opportunity"] as const).find((key) => combat[key] !== undefined);
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
      // An ability column is an enum of ability ids; a value that is not one adds nothing, exactly
      // as `abilityModFromField` reads one.
      column(source.toHit.ability?.column, "enum", [...path, "toHit", "ability", "column"]);
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

    const mapped = new Set<string>();
    combat.conditions?.forEach((entry, index) => {
      const path = at("conditions", index);
      if (!conditions.has(entry.condition)) issue([...path, "condition"], `Unknown condition "${entry.condition}"`);
      if (mapped.has(entry.condition)) issue([...path, "condition"], `Duplicate condition "${entry.condition}"`);
      mapped.add(entry.condition);
      for (const key of ["failsSaves", "saves"] as const) {
        entry[key]?.forEach((save, saveIndex) => {
          if (!saves.has(save)) issue([...path, key, saveIndex], `Unknown save "${save}"`);
        });
      }
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
        ].flatMap((item) =>
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
/** What a catalog's entries are: rows for the sheet's lists, or a bestiary of creatures. */
export type RulesetCatalogHolds = RulesetCatalogHeader["holds"];
/** One opponent, exactly as a bestiary entry writes it. */
export type RulesetCreature = z.infer<typeof rulesetCreatureSchema>;
/** A creature the Game Master invents for one fight: the plain block, or a sheet in the ruleset's terms. */
export type RulesetProposedCreature = z.infer<typeof rulesetProposedCreatureSchema>;
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
  list: { columns: ReadonlyArray<RulesetListColumn | RulesetField> },
  values: Record<string, unknown>,
  noun: "Column" | "Field" = "Column",
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
      if (catalog.entries && !catalog.entries.some((entry) => entry.id === entryId)) {
        add(where, `Catalog "${catalogId}" has no entry "${entryId}"`);
      }
    });
  }
}

/** Everything a creature must satisfy against the ruleset that declares it: every name it carries
 *  is one the `combat` block or the sheet already has. Shared by the inline catalogs in
 *  `ruleset.json` and by a `catalogs/<id>.json` asset, so both are held to one rule. */
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
  for (const key of ["resist", "vulnerable", "immune"] as const) {
    creature[key]?.forEach((type, index) => {
      if (damageTypes && !damageTypes.has(type.trim().toLowerCase())) {
        add([...at, key, index], `Unknown damage type "${type}"`);
      }
    });
  }
  creature.conditionImmunities?.forEach((condition, index) => {
    if (!conditions.has(condition)) add([...at, "conditionImmunities", index], `Unknown condition "${condition}"`);
  });

  if (creature.sheet) creatureSheetIssues(definition, creature.sheet, [...at, "sheet"], add, narrowedByLayers);

  const byId = new Map<string, RulesetCreatureAction>();
  creature.actions.forEach((action, index) => {
    if (byId.has(action.id)) add([...at, "actions", index, "id"], `Duplicate action id "${action.id}"`);
    byId.set(action.id, action);
  });
  creature.actions.forEach((action, index) => {
    const path = [...at, "actions", index];
    if (!budgets.has(action.budget)) add([...path, "budget"], `Unknown budget "${action.budget}"`);
    if (action.damage?.type && damageTypes && !damageTypes.has(action.damage.type.trim().toLowerCase())) {
      add([...path, "damage", "type"], `Unknown damage type "${action.damage.type}"`);
    }
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
    action.applies?.forEach((applies, appliesIndex) => {
      const where = [...path, "applies", appliesIndex];
      if (!conditions.has(applies.condition)) add([...where, "condition"], `Unknown condition "${applies.condition}"`);
      if (applies.saveEnds && !saves.has(applies.saveEnds.save)) {
        add([...where, "saveEnds", "save"], `Unknown save "${applies.saveEnds.save}"`);
      }
    });
    action.sequence?.forEach((step, stepIndex) => {
      const where: (string | number)[] = [...path, "sequence", stepIndex, "action"];
      const named = byId.get(step.action);
      if (!named) return add(where, `Unknown action "${step.action}"`);
      if (named.id === action.id) return add(where, "A sequence cannot name itself");
      // One budget, one list of strikes. A sequence of sequences would spend one budget on a tree,
      // and there would be nothing left to say how deep it may go.
      if (named.sequence) add(where, `"${step.action}" is a sequence, and a sequence cannot name another`);
      // A signature action is bought with points while somebody else is acting. Inside a sequence it
      // would be had for a budget on the creature's own turn, which is neither.
      if (named.signature) add(where, `"${step.action}" is bought with points, so a sequence cannot name it`);
    });
  });

  // Every rider names this block's own actions and this ruleset's own damage types.
  const riderIds = new Set<string>();
  creature.riders?.forEach((rider, index) => {
    const path = [...at, "riders", index];
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

/** Everything an entry must satisfy against the ruleset that declares it. */
export function rulesetCatalogEntryIssues(
  definition: RulesetDefinition,
  catalog: RulesetCatalogHeader,
  entries: readonly RulesetCatalogEntry[],
  /** True when `definition` may have its layers applied (see `creatureSheetIssues`). */
  narrowedByLayers = false,
): RulesetCatalogEntryIssue[] {
  const issues: RulesetCatalogEntryIssue[] = [];
  const add = (path: (string | number)[], message: string) => issues.push({ path, message });
  const listById = new Map(definition.sheet.lists.map((list) => [list.id, list]));
  const names = rulesetSheetNames(definition.sheet);
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

  const holdsCreatures = catalog.holds === "creatures";

  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) add([index, "id"], `Duplicate entry id "${entry.id}"`);
    seen.add(entry.id);

    // One catalog, one kind of entry: the picker reads a catalog of rows and a fight reads a
    // catalog of creatures, and neither has anything to do with the other's entries.
    if (holdsCreatures && !entry.creature) {
      add([index, "creature"], `Catalog "${catalog.id}" holds creatures, so every entry carries one`);
    } else if (!holdsCreatures && entry.creature) {
      add([index, "creature"], `Catalog "${catalog.id}" holds rows, so an entry cannot carry a creature`);
    }
    if (entry.creature) creatureIssues(definition, entry.creature, [index, "creature"], add, narrowedByLayers);

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
    for (const row of entry.rows ?? []) rowsPerList.set(row.list, (rowsPerList.get(row.list) ?? 0) + 1);

    (entry.rows ?? []).forEach((row, rowIndex) => {
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
    mechanics?.plus?.forEach((clause, clauseIndex) => {
      const path = [index, "mechanics", "plus", clauseIndex];
      if (clause.type && declaredTypes && !declaredTypes.has(clause.type.trim().toLowerCase())) {
        add([...path, "type"], `Unknown damage type "${clause.type}"`);
      }
      if (clause.save && !saves.has(clause.save.save)) {
        add([...path, "save", "save"], `Unknown save "${clause.save.save}"`);
      }
    });
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
      return declared?.levels?.length ? health.track : null;
    };
    const trackHealth = woundTrack(definition.combat?.health) ?? woundTrack(definition.battle?.health);
    if (mechanics?.temporary && trackHealth) {
      add(
        [index, "mechanics", "temporary"],
        `Health is the wound track "${trackHealth}", which carries no buffer for temporary points`,
      );
    }
    if (mechanics?.budget !== undefined && budgets && !budgets.has(mechanics.budget)) {
      add([index, "mechanics", "budget"], `Unknown budget "${mechanics.budget}"`);
    }
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
      const types = definition.combat.damageTypes
        ? new Set(definition.combat.damageTypes.map((type) => type.trim().toLowerCase()))
        : null;
      if (mechanics.rider.type && types && !types.has(mechanics.rider.type.trim().toLowerCase())) {
        add([...path, "type"], `Unknown damage type "${mechanics.rider.type}"`);
      }
    }
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
