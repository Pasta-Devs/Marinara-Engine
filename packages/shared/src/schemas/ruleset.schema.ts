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

/** The pin written once by game creation (`chat.metadata.gameRuleset`). Read tolerantly: this is
 *  persisted data, so a field a newer Engine added must not make the pin unreadable here. */
export const rulesetRefSchema = z
  .object({
    id: z.string().max(140).regex(RULESET_REF_ID_PATTERN),
    version: z.number().int().min(1),
    /** The capability package that supplied the definition, or null for a community file/repository. */
    packageId: z.string().max(128).nullable().default(null),
    /** Where a community ruleset came from, so a recipient without it can be told where to get it. */
    source: z.string().url().max(300).optional(),
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

const sheetId = z
  .string()
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/, "An id is lowercase letters, digits and underscores, starting with a letter");
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

/** Roll dice, add the sheet's modifiers, meet or beat a difficulty. The first resolution kind.
 *  The dice are a parameter so a 2d6+stat system does not need its own kind. */
const diceSumResolutionSchema = z
  .object({
    kind: z.literal("dice-sum"),
    dice: z
      .object({ count: z.number().int().min(1).max(10), sides: z.number().int().min(2).max(1000) })
      .strict()
      .default({ count: 1, sides: 20 }),
    abilityModifier: abilityModifierSchema,
    /** Where the proficiency bonus comes from. Omit it for a system with no such number; its tiers
     *  then use `flat` only. */
    proficiency: z.object({ bonus: rulesetValueRefSchema }).strict().optional(),
    /** The first tier is the untrained default for a skill or save the sheet does not mention. */
    proficiencyTiers: z.array(proficiencyTierSchema).min(1).max(12),
    /** Whether the GM may ask for advantage or disadvantage (roll the dice twice, keep one). */
    advantage: z.boolean().default(false),
    naturals: z
      .object({ check: naturalPolicySchema.default("none"), save: naturalPolicySchema.default("none") })
      .strict()
      .default({}),
    difficultyLadder: z
      .array(z.object({ label, dc: z.number().int().min(-100).max(1000) }).strict())
      .min(1)
      .max(12),
  })
  .strict();

/** Closed registry of resolution kinds. Adding a kind is an Engine PR with regressions. */
export const rulesetResolutionSchema = z.discriminatedUnion("kind", [diceSumResolutionSchema]);
export const RULESET_RESOLUTION_KINDS = Object.freeze(["dice-sum"] as const);

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
  })
  .strict();

type RulesetDefinitionBase = z.infer<typeof rulesetDefinitionBaseSchema>;

// ── Cross-reference checks: everything a name points at must exist ──

function refineRulesetDefinition(def: RulesetDefinitionBase, ctx: z.RefinementCtx): void {
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
    const equalsPath = [...path, "hideWhen", "equals"];
    const { equals } = hideWhen;
    if (field.type === "enum") {
      if (typeof equals !== "string" || !field.values.includes(equals)) {
        issue(equalsPath, `${JSON.stringify(equals)} is not one of the values of "${field.id}"`);
      }
    } else if (field.type === "number") {
      if (typeof equals !== "number") issue(equalsPath, `"${field.id}" is a number field, so equals must be a number`);
    } else if (field.type === "boolean") {
      if (typeof equals !== "boolean")
        issue(equalsPath, `"${field.id}" is a boolean field, so equals must be true or false`);
    } else if (typeof equals !== "string") {
      issue(equalsPath, `"${field.id}" is a text field, so equals must be a string`);
    }
  };
  sheet.fields.forEach((field, index) => {
    const path = ["sheet", "fields", index];
    checkTyped(field, path);
    checkSection(field.section, path);
    checkHideWhen(field.hideWhen, path);
  });

  // A value reference may read a derived value only when it is declared ABOVE the reader, which
  // makes a cycle unrepresentable and lets evaluation run once, top to bottom.
  const checkRef = (ref: RulesetValueRef, path: (string | number)[], derivedAbove: Set<string>) => {
    if (ref.field !== undefined) {
      const field = fieldById.get(ref.field);
      if (!field) issue([...path, "field"], `Unknown field "${ref.field}"`);
      else if (field.type !== "number") issue([...path, "field"], `Field "${ref.field}" is not a number`);
    }
    if (ref.derived !== undefined && !derivedAbove.has(ref.derived)) {
      issue(
        [...path, "derived"],
        derivedIds.has(ref.derived)
          ? `Derived value "${ref.derived}" must be declared above the value that reads it`
          : `Unknown derived value "${ref.derived}"`,
      );
    }
    for (const key of ["abilityScore", "abilityMod"] as const) {
      const id = ref[key];
      if (id !== undefined && !abilities.has(id)) issue([...path, key], `Unknown ability "${id}"`);
    }
    if (ref.abilityModFromField !== undefined) {
      const field = fieldById.get(ref.abilityModFromField);
      if (!field) issue([...path, "abilityModFromField"], `Unknown field "${ref.abilityModFromField}"`);
      else if (field.type !== "enum")
        issue([...path, "abilityModFromField"], "The field must be an enum of ability ids");
    }
    if (ref.skillMod !== undefined && !skills.has(ref.skillMod))
      issue([...path, "skillMod"], `Unknown skill "${ref.skillMod}"`);
    if (ref.saveMod !== undefined && !saves.has(ref.saveMod))
      issue([...path, "saveMod"], `Unknown save "${ref.saveMod}"`);
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
  if (resolution.dice.count !== 1 && (resolution.naturals.check !== "none" || resolution.naturals.save !== "none")) {
    issue(["resolution", "naturals"], "Natural results need a single die; with several dice use none");
  }

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
  void lists;
}

/** The whole `ruleset.json` document. Strict on purpose: a ruleset this Engine only partly
 *  understands would silently change a game's arithmetic, so an unknown key refuses the file. */
export const rulesetDefinitionSchema = rulesetDefinitionBaseSchema.superRefine(refineRulesetDefinition);

export type RulesetDefinition = z.infer<typeof rulesetDefinitionSchema>;
export type RulesetResolution = RulesetDefinition["resolution"];
export type RulesetSheetSchema = RulesetDefinition["sheet"];
export type RulesetField = z.infer<typeof rulesetFieldSchema>;
export type RulesetListColumn = z.infer<typeof rulesetListColumnSchema>;
export type RulesetDerived = z.infer<typeof rulesetDerivedSchema>;
export type RulesetRest = RulesetDefinition["rests"][number];

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

// ── Stored sheets ──

const sheetScalar = z.union([z.number().finite(), z.string().max(4000), z.boolean()]);

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
