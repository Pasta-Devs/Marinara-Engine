// ──────────────────────────────────────────────
// The ruleset builder: a small form's worth of rules, written out as a ruleset
//
// A ruleset is a large document, and most tables never need most of it. The builder asks for the
// part a freeform sheet needs (how a check rolls and what it is rolled against, the stats and skills
// it reads, the pools and tracks play spends and fills, a few written fields and a notes list) and
// writes the ruleset from that, so everything a ruleset gets (the sheet, the Engine's dice, the
// narrator's teaching, the Sheet Keeper, Game Mode) comes with it. Anything rarer is still written
// as JSON. A ruleset the builder wrote carries its draft, so the builder can open it again.
// ──────────────────────────────────────────────

/** How a check rolls: the common families, each written out as the resolution kind that plays it. */
export type RulesetBuilderDicePreset =
  /** d20 + modifier against a difficulty (5e, Pathfinder, Shadowdark, Mörk Borg, Cosmere). */
  | "d20"
  /** 2d6 + stat read in bands: 10+ a full hit, 7–9 a hit at a cost, 6- a miss (Powered by the Apocalypse). */
  | "2d6-bands"
  /** A pool of dice, counting each die at or over a target (World of Darkness, Year Zero, Shadowrun). */
  | "pool"
  /** A pool of d6s read by its highest die: 6 a full success, 4–5 a cost, 1–3 a miss (Forged in the Dark). */
  | "highest"
  /** d100 rolled under the sheet's number (Call of Cthulhu, Delta Green). */
  | "percentile"
  /** 2d12, Hope and Fear: the total against a difficulty, and which die showed more (Daggerheart). */
  | "duality"
  /** No dice (1.825): the narrator judges outcomes from the sheets, and nothing is ever rolled. */
  | "diceless";

export interface RulesetBuilderDraft {
  /** Lowercase letters, digits and dashes; the ruleset's id. */
  id: string;
  name: string;
  /** One line on what the rules are, for the narrator and the ruleset list. */
  summary?: string;
  /** How and when to ask for a check, in the table's own words. */
  checkGuidance?: string;
  /** How the sheets are kept: read by the narrator, or by the Sheet Keeper when one runs. */
  sheetGuidance?: string;
  /** House rules and anything else the narrator should always know about these rules. */
  rulesReference?: string;
  /** For a Game Mode game's world, made once at setup: what the world should be like under these rules. */
  worldGuidance?: string;
  dice: {
    preset: RulesetBuilderDicePreset;
    /** For "pool": the die's sides (6 or 10) and the face a die must reach to count. */
    sides?: number;
    target?: number;
  };
  /** Named difficulties, easiest first: a number to beat, or for a pool, successes needed. */
  ladder: Array<{ label: string; value: number }>;
  /** The stats a check adds (or, for a pool, the dice it throws). */
  abilities: Array<{ label: string; short?: string; min: number; max: number; default: number }>;
  /** Skills by name, each rolled with one of the abilities (by its label). */
  skills: Array<{ label: string; ability: string; group?: string }>;
  /** A skill's ranks above untrained, lowest first, each with what it adds: to the total on a sum,
   *  dice on a pool, points on a percentile. The sheet sets each skill's rank. */
  ranks: Array<{ label: string; bonus: number }>;
  /** What play spends and gets back: hit points, willpower, luck. */
  pools: Array<{ label: string; max: number; bar?: boolean }>;
  /** What play fills: stress, harm, heat. `bar` draws it as a fill bar as well as a number. */
  tracks: Array<{ label: string; min: number; max: number; bar?: boolean }>;
  /** Written lines on the sheet: a calling, a look, a drive. */
  fields: Array<{ label: string; type: "text" | "number" }>;
  /** Lists on the sheet (gear, moves, scars): every row has a name and these columns, and a list
   *  with a tab shows on a tab of that name rather than on the overview. */
  lists: RulesetBuilderList[];
}

export type RulesetBuilderColumnType = "text" | "number" | "check";
export interface RulesetBuilderList {
  label: string;
  tab?: string;
  columns: Array<{ label: string; type: RulesetBuilderColumnType }>;
}

/** The notes list every starter has. */
const NOTES_LIST: RulesetBuilderList = { label: "Notes", columns: [{ label: "Notes", type: "text" }] };
/** The longest one-line guidance a ruleset holds, and the longest rules reference. */
export const RULESET_BUILDER_GUIDANCE_MAX = 1500;
export const RULESET_BUILDER_REFERENCE_MAX = 16000;

/** The comment a builder-made ruleset carries, so the builder knows it can open it. */
export const RULESET_BUILDER_MARK = "Made with the Marinara Engine ruleset builder.";
/** The edition a builder-made ruleset names, which is what marks it once it has been read back. */
export const RULESET_BUILDER_EDITION = "Made with the ruleset builder";

/** A ruleset id from a name: lowercase, dashes, nothing else. */
export function rulesetBuilderId(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "my-ruleset"
  );
}

function slug(label: string, used: Set<string>, fallback: string): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || fallback;
  const stem = /^[a-z]/.test(base) ? base : `${fallback}_${base}`;
  let id = stem;
  let n = 2;
  while (used.has(id)) id = `${stem}_${n++}`;
  used.add(id);
  return id;
}

/** A starting draft for a preset, with that family's usual stats, so a new ruleset is playable at once. */
export function rulesetBuilderStarter(preset: RulesetBuilderDicePreset, name = "My Ruleset"): RulesetBuilderDraft {
  const base = {
    id: rulesetBuilderId(name),
    name,
    lists: [NOTES_LIST],
    fields: [{ label: "Concept", type: "text" as const }],
  };
  switch (preset) {
    case "2d6-bands":
      return {
        ...base,
        dice: { preset },
        ladder: [{ label: "Roll", value: 7 }],
        abilities: ["Cool", "Hard", "Hot", "Sharp", "Weird"].map((label) => ({ label, min: -2, max: 3, default: 0 })),
        skills: [],
        ranks: [],
        pools: [],
        tracks: [{ label: "Harm", min: 0, max: 6, bar: true }],
      };
    case "pool":
      return {
        ...base,
        dice: { preset, sides: 10, target: 6 },
        ladder: [
          { label: "Standard", value: 1 },
          { label: "Hard", value: 2 },
          { label: "Very hard", value: 3 },
        ],
        abilities: ["Strength", "Dexterity", "Wits"].map((label) => ({ label, min: 1, max: 5, default: 2 })),
        skills: [],
        ranks: [1, 2, 3, 4, 5].map((dots) => ({ label: `${dots} dot${dots > 1 ? "s" : ""}`, bonus: dots })),
        pools: [{ label: "Willpower", max: 5 }],
        tracks: [{ label: "Health", min: 0, max: 7, bar: true }],
      };
    case "highest":
      return {
        ...base,
        dice: { preset },
        ladder: [{ label: "Roll", value: 4 }],
        abilities: ["Insight", "Prowess", "Resolve"].map((label) => ({ label, min: 0, max: 4, default: 1 })),
        skills: [],
        ranks: [1, 2, 3].map((rating) => ({ label: `Rating ${rating}`, bonus: rating })),
        pools: [],
        tracks: [{ label: "Stress", min: 0, max: 9, bar: true }],
      };
    case "percentile":
      return {
        ...base,
        dice: { preset },
        ladder: [{ label: "Regular", value: 0 }],
        abilities: ["Strength", "Dexterity", "Intelligence", "Power"].map((label) => ({
          label,
          min: 1,
          max: 99,
          default: 50,
        })),
        skills: [],
        ranks: [
          { label: "Trained", bonus: 20 },
          { label: "Expert", bonus: 40 },
        ],
        pools: [
          { label: "Hit points", max: 10, bar: true },
          { label: "Sanity", max: 50, bar: true },
        ],
        tracks: [],
      };
    case "diceless":
      return {
        ...base,
        dice: { preset },
        ladder: [],
        abilities: ["Body", "Mind", "Spirit"].map((label) => ({ label, min: 0, max: 5, default: 1 })),
        skills: [],
        ranks: [
          { label: "Novice", bonus: 1 },
          { label: "Adept", bonus: 2 },
          { label: "Master", bonus: 3 },
        ],
        pools: [],
        tracks: [{ label: "Health", min: 0, max: 5, bar: true }],
        lists: [
          {
            label: "Abilities",
            columns: [
              { label: "Rank", type: "number" },
              { label: "Notes", type: "text" },
            ],
          },
          NOTES_LIST,
        ],
      };
    case "duality":
      return {
        ...base,
        dice: { preset },
        ladder: [
          { label: "Easy", value: 10 },
          { label: "Moderate", value: 13 },
          { label: "Hard", value: 16 },
        ],
        abilities: ["Agility", "Strength", "Finesse", "Instinct", "Presence", "Knowledge"].map((label) => ({
          label,
          min: -1,
          max: 4,
          default: 0,
        })),
        skills: [],
        ranks: [{ label: "Experience", bonus: 2 }],
        pools: [{ label: "Hope", max: 6 }],
        tracks: [
          { label: "Hit points", min: 0, max: 6, bar: true },
          { label: "Stress", min: 0, max: 6, bar: true },
        ],
      };
    default:
      return {
        ...base,
        dice: { preset: "d20" },
        ladder: [
          { label: "Easy", value: 10 },
          { label: "Medium", value: 15 },
          { label: "Hard", value: 20 },
        ],
        abilities: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"].map((label) => ({
          label,
          min: -5,
          max: 5,
          default: 0,
        })),
        skills: [],
        ranks: [
          { label: "Trained", bonus: 2 },
          { label: "Expert", bonus: 4 },
        ],
        pools: [{ label: "Hit points", max: 10, bar: true }],
        tracks: [],
        lists: [
          {
            label: "Gear",
            columns: [
              { label: "Qty", type: "number" },
              { label: "Notes", type: "text" },
            ],
          },
          NOTES_LIST,
        ],
      };
  }
}

/** The resolution for a preset: what the Engine throws and what it reads off the throw. */
function resolutionFor(draft: RulesetBuilderDraft): Record<string, unknown> {
  const tiers = [
    { id: "untrained", label: "Untrained" },
    ...(draft.ranks ?? [])
      .filter((rank) => rank.label.trim())
      .slice(0, 11)
      .map((rank, index) => ({ id: `rank_${index + 1}`, label: rank.label.trim(), flat: Math.trunc(rank.bonus) })),
  ];
  const ladder = draft.ladder.map((step) => ({ label: step.label, dc: step.value }));
  const flat = { abilityModifier: { op: "identity" }, proficiencyTiers: tiers };
  switch (draft.dice.preset) {
    case "2d6-bands":
      return {
        kind: "dice-sum",
        dice: { count: 2, sides: 6 },
        ...flat,
        advantage: false,
        difficultyLadder: ladder.length ? ladder : [{ label: "Roll", dc: 7 }],
        outcomes: {
          by: "total",
          tiers: [
            { id: "strong_hit", label: "Strong hit", atLeast: 10, success: true },
            {
              id: "weak_hit",
              label: "Weak hit",
              atLeast: 7,
              success: true,
              text: "It works, at a cost or a hard choice.",
            },
            { id: "miss", label: "Miss" },
          ],
        },
      };
    case "pool": {
      const sides = draft.dice.sides === 6 ? 6 : 10;
      const target = Math.min(sides, Math.max(2, draft.dice.target ?? (sides === 6 ? 6 : 6)));
      return {
        kind: "dice-pool",
        die: { sides },
        ...flat,
        pool: { min: 1, max: 20 },
        target: { min: target, max: target, default: target },
        // A pool's difficulty is how many successes it needs.
        difficultyLadder: (ladder.length ? ladder : [{ label: "Standard", dc: 1 }]).map((step) => ({
          label: step.label,
          successes: step.dc,
        })),
      };
    }
    case "highest":
      return {
        kind: "dice-highest",
        die: { sides: 6 },
        ...flat,
        pool: { min: 0, max: 6 },
        keep: 1,
        difficultyLadder: [{ label: "Roll", dc: 4 }],
        outcomes: {
          by: "total",
          tiers: [
            { id: "critical", label: "Critical", success: true, critical: true, on: "critical-success" },
            { id: "full", label: "Full success", atLeast: 6, success: true },
            {
              id: "partial",
              label: "Partial success",
              atLeast: 4,
              success: true,
              text: "It works, with a consequence.",
            },
            { id: "bad", label: "Bad outcome" },
          ],
        },
        critical: { count: 2, face: 6 },
      };
    case "percentile":
      return {
        kind: "roll-against",
        dice: { count: 1, sides: 100 },
        ...flat,
        against: "at-most",
        difficultyLadder: ladder.length ? ladder : [{ label: "Regular", dc: 0 }],
      };
    case "duality":
      return {
        kind: "dice-sum",
        dice: { count: 2, sides: 12 },
        ...flat,
        advantage: false,
        difficultyLadder: ladder.length ? ladder : [{ label: "Moderate", dc: 13 }],
        duality: {
          dice: [
            { id: "hope", label: "Hope" },
            { id: "fear", label: "Fear" },
          ],
          text: "With Hope, things lean the player's way; with Fear, the world gets a turn.",
        },
      };
    default:
      return {
        kind: "dice-sum",
        dice: { count: 1, sides: 20 },
        ...flat,
        advantage: true,
        difficultyLadder: ladder.length ? ladder : [{ label: "Medium", dc: 15 }],
      };
  }
}

/** What a builder-made ruleset tells the narrator about checks when its author wrote nothing. */
export function rulesetBuilderDefaultCheckGuidance(name: string, diceless = false): string {
  if (diceless) {
    return `This game uses the ${name.trim() || "My Ruleset"} rules and has no dice. Never ask for a check or roll anything. Decide each outcome yourself from the character sheets: what a character's stats, skills, ranks and lists say they can do, and what the story makes hard.`;
  }
  return `This game uses the ${name.trim() || "My Ruleset"} rules. Call for a check when the outcome is uncertain and matters, with one of the sheet's skills or stats, and pick a difficulty from the ladder. The Engine rolls it and reports what happened. Never write dice or results yourself.`;
}
/** And about keeping the sheets. */
export const RULESET_BUILDER_DEFAULT_SHEET_GUIDANCE =
  "The character sheets below are kept by the Engine. Record each change with a sheet command.";

/** The ruleset document a draft makes, ready for the importer (which validates it). */
export function rulesetFromBuilderDraft(draft: RulesetBuilderDraft, version = 1): Record<string, unknown> {
  const diceless = draft.dice.preset === "diceless";
  const used = new Set<string>();
  const abilities = draft.abilities
    .filter((ability) => ability.label.trim())
    .map((ability) => ({
      id: slug(ability.label, used, "stat"),
      label: ability.label.trim().slice(0, 40),
      short: (ability.short?.trim() || ability.label.trim().slice(0, 3)).toUpperCase().slice(0, 4),
      min: ability.min,
      max: ability.max,
      default: Math.min(ability.max, Math.max(ability.min, ability.default)),
    }));
  const abilityByLabel = new Map(abilities.map((ability) => [ability.label.toLowerCase(), ability.id]));
  // Sections are one id space with everything else, and two groups that differ only in case are one.
  const sections: Array<{ id: string; label: string }> = [];
  const sectionFor = (label: string) => {
    const name = label.trim().slice(0, 40);
    const known = sections.find((section) => section.label.toLowerCase() === name.toLowerCase());
    if (known) return known.id;
    const section = { id: slug(name, used, "section"), label: name };
    sections.push(section);
    return section.id;
  };
  const skills = draft.skills
    .filter((skill) => skill.label.trim() && abilityByLabel.has(skill.ability.trim().toLowerCase()))
    .map((skill) => ({
      id: slug(skill.label, used, "skill"),
      label: skill.label.trim().slice(0, 40),
      ability: abilityByLabel.get(skill.ability.trim().toLowerCase())!,
      ...(skill.group?.trim() ? { section: sectionFor(skill.group) } : {}),
    }));
  const about = draft.fields.some((field) => field.label.trim()) ? sectionFor("About") : undefined;
  const fields = draft.fields
    .filter((field) => field.label.trim())
    .map((field) =>
      field.type === "number"
        ? {
            id: slug(field.label, used, "field"),
            label: field.label.trim().slice(0, 40),
            type: "number",
            min: 0,
            max: 999,
            default: 0,
            section: about,
          }
        : {
            id: slug(field.label, used, "field"),
            label: field.label.trim().slice(0, 40),
            type: "text",
            maxLength: 200,
            section: about,
          },
    );
  const pools = draft.pools
    .filter((pool) => pool.label.trim() && pool.max > 0)
    .map((pool) => ({
      id: slug(pool.label, used, "pool"),
      label: pool.label.trim().slice(0, 40),
      max: { const: pool.max },
      ...(pool.bar ? { display: "bar" } : {}),
    }));
  const tracks = draft.tracks
    .filter((track) => track.label.trim() && track.max > track.min)
    .map((track) => ({
      id: slug(track.label, used, "track"),
      label: track.label.trim().slice(0, 40),
      min: track.min,
      max: track.max,
      default: track.min,
      alwaysShow: true,
      ...(track.bar ? { display: "bar" } : {}),
    }));
  // Every row is named by its first column, so the narrator and the sheet can tell rows apart.
  const lists = draft.lists
    .filter((list) => list.label.trim())
    .slice(0, 12)
    .map((list) => {
      const columnIds = new Set<string>(["name"]);
      const columns = list.columns
        .filter((column) => column.label.trim())
        .slice(0, 11)
        .map((column) => {
          const id = slug(column.label, columnIds, "column");
          const label = column.label.trim().slice(0, 40);
          return column.type === "number"
            ? { id, label, type: "number", min: -999, max: 999, default: 0 }
            : column.type === "check"
              ? { id, label, type: "boolean", default: false }
              : { id, label, type: "text", maxLength: 300 };
        });
      // The sheet shows a list only on a tab, so a list without one gets a tab named after it.
      const tab = (list.tab?.trim() || list.label.trim()).slice(0, 24);
      // A list's first checkbox column is drawn as a tick beside each name (Equipped, Prepared).
      const mark = columns.find((column) => column.type === "boolean")?.id;
      return {
        id: slug(list.label, used, "list"),
        label: list.label.trim().slice(0, 40),
        section: sectionFor(list.label),
        display: { tab, ...(mark ? { mark } : {}) },
        maxItems: 60,
        columns: [{ id: "name", label: "Name", type: "text", maxLength: 80, required: true }, ...columns],
      };
    });
  /** One line, held to the ruleset's limit: a prompt line may not break. */
  const line = (text: string | undefined, max: number) =>
    text
      ?.replace(/\s*[\r\n\u0085\u2028\u2029]+\s*/g, " ")
      .trim()
      .slice(0, max) || undefined;
  const sheetGuidance = line(draft.sheetGuidance, RULESET_BUILDER_GUIDANCE_MAX);
  const worldGuidance = line(draft.worldGuidance, RULESET_BUILDER_GUIDANCE_MAX);
  const rulesReference = line(draft.rulesReference, RULESET_BUILDER_REFERENCE_MAX);
  const summary = draft.summary?.trim() || `${draft.name} rules, made with the ruleset builder.`;
  return {
    $comment: RULESET_BUILDER_MARK,
    schemaVersion: 1,
    id: rulesetBuilderId(draft.id || draft.name),
    version,
    name: draft.name.trim().slice(0, 80) || "My Ruleset",
    edition: RULESET_BUILDER_EDITION,
    license: { spdx: "CC0-1.0", attribution: "Written with the Marinara Engine ruleset builder." },
    coverage: {
      checks: !diceless,
      saves: false,
      sheet: true,
      resources: pools.length > 0 || tracks.length > 0,
      rests: true,
      combat: false,
      summary: summary.slice(0, 300),
    },
    resolution: resolutionFor(draft),
    sheet: {
      version: 1,
      sections,
      abilities,
      skills,
      fields,
      derived: [],
      lists,
      live: { pools, tracks, conditions: [], states: [] },
    },
    rests: [
      {
        id: "rest",
        label: "Rest",
        restore: [
          ...pools.map((pool) => ({ pool: pool.id, to: "max" })),
          ...tracks.map((track) => ({ track: track.id, to: "min" })),
        ],
      },
    ],
    ...(rulesReference ? { gmReference: rulesReference } : {}),
    gm: {
      // A diceless ruleset keeps a resolution, which the schema needs, and never rolls it.
      ...(diceless ? { diceless: true } : {}),
      checkGuidance:
        line(draft.checkGuidance, RULESET_BUILDER_GUIDANCE_MAX) ??
        rulesetBuilderDefaultCheckGuidance(draft.name, diceless),
      sheetGuidance: sheetGuidance ?? RULESET_BUILDER_DEFAULT_SHEET_GUIDANCE,
      ...(worldGuidance ? { worldGuidance } : {}),
      sheetSummary: {
        fields: fields.map((field) => field.id),
        derived: [],
        lists: lists.map((list) => ({
          list: list.id,
          nameColumn: "name",
          ...(list.columns.length > 1 ? { columns: list.columns.slice(1, 4).map((column) => column.id) } : {}),
        })),
      },
    },
  };
}

/** The draft a builder-made ruleset was written from, read back off the ruleset itself; null for a
 *  ruleset the builder did not write, which the builder leaves to its own author. */
export function rulesetBuilderDraftFrom(definition: {
  id: string;
  name: string;
  edition?: string;
  resolution: Record<string, any>;
  sheet: Record<string, any>;
  gm?: Record<string, any>;
  gmReference?: string;
  coverage?: Record<string, any>;
}): RulesetBuilderDraft | null {
  if (definition.edition !== RULESET_BUILDER_EDITION) return null;
  const resolution = definition.resolution;
  const preset: RulesetBuilderDicePreset = definition.gm?.diceless
    ? "diceless"
    : resolution.kind === "dice-pool"
      ? "pool"
      : resolution.kind === "dice-highest"
        ? "highest"
        : resolution.kind === "roll-against"
          ? "percentile"
          : resolution.duality
            ? "duality"
            : resolution.outcomes
              ? "2d6-bands"
              : "d20";
  const sheet = definition.sheet;
  const abilityLabel = new Map<string, string>(
    (sheet.abilities ?? []).map((ability: { id: string; label: string }) => [ability.id, ability.label]),
  );
  const sectionLabel = new Map<string, string>(
    (sheet.sections ?? []).map((section: { id: string; label: string }) => [section.id, section.label]),
  );
  // Text the builder filled in itself reads back as blank, so the form shows its default as a hint.
  const own = (value: unknown, fallback: string) =>
    typeof value === "string" && value && value !== fallback ? value : undefined;
  return {
    id: definition.id.replace(/^local\//, ""),
    name: definition.name,
    summary: own(definition.coverage?.summary, `${definition.name} rules, made with the ruleset builder.`),
    checkGuidance: own(
      definition.gm?.checkGuidance,
      rulesetBuilderDefaultCheckGuidance(definition.name, preset === "diceless"),
    ),
    sheetGuidance: own(definition.gm?.sheetGuidance, RULESET_BUILDER_DEFAULT_SHEET_GUIDANCE),
    worldGuidance: own(definition.gm?.worldGuidance, ""),
    rulesReference: own(definition.gmReference, ""),
    dice: {
      preset,
      ...(preset === "pool" ? { sides: resolution.die?.sides, target: resolution.target?.default } : {}),
    },
    // A diceless ruleset's ladder is the unrolled resolution's, which the builder never shows.
    ladder: (preset === "diceless" ? [] : (resolution.difficultyLadder ?? [])).map(
      (step: { label: string; dc?: number; successes?: number }) => ({
        label: step.label,
        value: step.dc ?? step.successes ?? 0,
      }),
    ),
    abilities: (sheet.abilities ?? []).map(
      (ability: { label: string; short?: string; min: number; max: number; default: number }) => ({
        label: ability.label,
        short: ability.short,
        min: ability.min,
        max: ability.max,
        default: ability.default,
      }),
    ),
    skills: (sheet.skills ?? []).map((skill: { label: string; ability: string; section?: string }) => ({
      label: skill.label,
      ability: abilityLabel.get(skill.ability) ?? "",
      ...(skill.section && sectionLabel.has(skill.section) ? { group: sectionLabel.get(skill.section) } : {}),
    })),
    ranks: (resolution.proficiencyTiers ?? []).slice(1).map((tier: { label: string; flat?: number }) => ({
      label: tier.label,
      bonus: tier.flat ?? 0,
    })),
    pools: (sheet.live?.pools ?? []).map((pool: { label: string; max: { const?: number }; display?: string }) => ({
      label: pool.label,
      max: pool.max?.const ?? 1,
      ...(pool.display === "bar" ? { bar: true } : {}),
    })),
    tracks: (sheet.live?.tracks ?? []).map((track: { label: string; min: number; max: number; display?: string }) => ({
      label: track.label,
      min: track.min,
      max: track.max,
      ...(track.display === "bar" ? { bar: true } : {}),
    })),
    fields: (sheet.fields ?? []).map((field: { label: string; type: string }) => ({
      label: field.label,
      type: field.type === "number" ? ("number" as const) : ("text" as const),
    })),
    lists: (sheet.lists ?? []).map(
      (list: {
        label: string;
        display?: { tab?: string };
        columns: Array<{ id: string; label: string; type: string }>;
      }) => ({
        label: list.label,
        ...(list.display?.tab && list.display.tab !== list.label.slice(0, 24) ? { tab: list.display.tab } : {}),
        columns: list.columns
          .filter((column) => column.id !== "name")
          .map((column) => ({
            label: column.label,
            type: column.type === "number" ? "number" : column.type === "boolean" ? "check" : "text",
          })),
      }),
    ),
  };
}
