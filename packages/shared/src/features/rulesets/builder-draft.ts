// ──────────────────────────────────────────────
// The ruleset builder: a small form's worth of rules, written out as an ordinary ruleset
//
// A ruleset is a large document, and most tables never need most of it. The builder asks for the
// part a freeform sheet needs (how a check rolls and what it is rolled against, the stats and skills
// it reads, the pools and tracks play spends and fills, a few written fields and lists) and writes
// the same ruleset JSON the Ruleset Creator's Guide teaches. Nothing marks a file as the builder's:
// the builder opens any ruleset it could write back exactly as it is, and leaves every other one to
// its author, so it never drops what it cannot show.
//
// Every row keeps the id it was first written with. A sheet stores values by id, so renaming a stat,
// a pool or a list column changes its label and nothing a character has.
// ──────────────────────────────────────────────
import { parseRulesetDefinition } from "../../schemas/ruleset.schema.js";

/** How the sheet draws a pool or track beyond its number (1.828); none is the number alone. */
export type RulesetBuilderDisplay = "bar" | "dots";

/** How many rows of each kind the form adds, so what it writes is a ruleset the Engine takes: ranks
 *  above untrained, columns after the name, lists as many as the narrator's sheet summary names, and
 *  pools and tracks as many as one rest can restore (40 together). */
export const RULESET_BUILDER_MAX = {
  abilities: 20,
  skills: 120,
  ladder: 12,
  ranks: 11,
  pools: 20,
  tracks: 20,
  fields: 24,
  lists: 8,
  columns: 11,
  /** Groups on the sheet: each stat or skill group, one per list, and one for the fields. */
  sections: 20,
} as const;

/** How a check rolls: the common families, each written out as the resolution kind that plays it. */
export type RulesetBuilderDicePreset =
  /** d20 + modifier against a difficulty. */
  | "d20"
  /** 2d6 + stat read in bands: 10+ a full hit, 7–9 a hit at a cost, 6- a miss. */
  | "2d6-bands"
  /** A pool of dice, counting each die at or over a target. */
  | "pool"
  /** A pool of d6s read by its highest die: 6 a full success, 4–5 a cost, 1–3 a miss. */
  | "highest"
  /** d100 rolled under the sheet's number. */
  | "percentile"
  /** 2d12, Hope and Fear: the total against a difficulty, and which die showed more. */
  | "duality"
  /** No dice (1.825): the sheet's own number against the difficulty. */
  | "no-dice";

/** A row's identity in the form (`key`, never written) and in the file (`id`, kept once written). */
interface RulesetBuilderRow {
  /** The form's handle on the row, so a skill can name its stat before either has an id. */
  key: string;
  /** The id the row was first written with. A new row gets one from its label when it is first saved. */
  id?: string;
}

export interface RulesetBuilderDraft {
  /** Lowercase letters, digits and dashes; the ruleset's id. */
  id: string;
  name: string;
  /** One line on what the rules are, for the narrator and the ruleset list. */
  summary?: string;
  /** How and when to ask for a check, in the table's own words. */
  checkGuidance?: string;
  /** How the sheets are kept. */
  sheetGuidance?: string;
  /** House rules and anything else the narrator should always know about these rules. */
  rulesReference?: string;
  /** For a Game Mode game's world, made once at setup: what the world should be like under these rules. */
  worldGuidance?: string;
  /** Kept from a file its author wrote, so opening it in the builder does not rewrite them. */
  edition?: string;
  license?: { spdx: string; attribution?: string };
  dice: {
    preset: RulesetBuilderDicePreset;
    /** For "pool": the die's sides (6 or 10) and the face a die must reach to count. */
    sides?: number;
    target?: number;
  };
  /** Named difficulties, easiest first: a number to beat, or for a pool, successes needed. */
  ladder: Array<{ label: string; value: number }>;
  /** The stats a check adds (or, for a pool, the dice it throws). */
  abilities: Array<
    RulesetBuilderRow & { label: string; short?: string; min: number; max: number; default: number; group?: string }
  >;
  /** Skills by name, each rolled with one of the abilities (by its `key`). */
  skills: Array<RulesetBuilderRow & { label: string; ability: string; group?: string }>;
  /** The rank every skill starts at, kept from the file; "Untrained" when left out. */
  untrained?: { id: string; label: string };
  /** A skill's ranks above untrained, lowest first, each with what it adds: to the total on a sum,
   *  dice on a pool, points on a percentile. The sheet sets each skill's rank. */
  ranks: Array<RulesetBuilderRow & { label: string; bonus: number }>;
  /** A practice meter on every trained skill (1.829): progress toward its next rank, started over on a rank-up. */
  practice?: boolean;
  /** Skill groups that keep no practice (Knowledge bought rather than learned by use). */
  practiceExcept?: string[];
  /** What play spends and gets back: hit points, willpower, luck. `display` draws a fill bar or dots (1.828). */
  pools: Array<RulesetBuilderRow & { label: string; max: number; display?: RulesetBuilderDisplay }>;
  /** What play fills: stress, harm, heat. */
  tracks: Array<RulesetBuilderRow & { label: string; min: number; max: number; display?: RulesetBuilderDisplay }>;
  /** Written lines on the sheet: a calling, a look, a drive. */
  fields: Array<RulesetBuilderRow & { label: string; type: "text" | "number" }>;
  /** Lists on the sheet (gear, moves, scars): every row has a name and these columns. */
  lists: RulesetBuilderList[];
  /** False for a file whose sheet the narrator may not advance (no `sheet.advancement`); a new ruleset lets it. */
  advancement?: boolean;
  /** The ids the file gave its groups (sections), by lowercase label, so a group keeps its id. */
  groupIds?: Record<string, string>;
  /** Every sheet-wide id and rank id the file had. A row removed in the form leaves its values on the
   *  sheets, so a new row never takes its id and shows them. */
  reservedIds?: string[];
  reservedRanks?: string[];
}

export type RulesetBuilderColumnType = "text" | "number" | "check";
export interface RulesetBuilderList extends RulesetBuilderRow {
  label: string;
  tab?: string;
  columns: Array<RulesetBuilderRow & { label: string; type: RulesetBuilderColumnType }>;
  /** Every column id the file had, so a new column never takes a removed one's id (and its values). */
  reservedColumns?: string[];
}

/** The longest one-line guidance a ruleset holds, and the longest rules reference. */
export const RULESET_BUILDER_GUIDANCE_MAX = 1500;
export const RULESET_BUILDER_REFERENCE_MAX = 16000;
/** What the builder writes as a new ruleset's edition and license; a file's own are kept. */
export const RULESET_BUILDER_EDITION = "Made with the ruleset builder";
const BUILDER_LICENSE = { spdx: "CC0-1.0", attribution: "Written with the Marinara Engine ruleset builder." };

let keyCount = 0;
/** A new form key, unique in this page. */
export function rulesetBuilderKey(): string {
  keyCount += 1;
  return `new-${keyCount}`;
}

/** Lowercase letters and digits from a name, every other run of characters one `separator`, held to
 *  `max` with no separator at either end. The ends are trimmed by hand, not by an anchored regex,
 *  which runs in polynomial time on a long run of separators in an untrusted name. */
function idText(text: string, separator: string, max: number): string {
  const joined = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, separator)
    .slice(0, max + 1);
  let start = 0;
  let end = Math.min(joined.length, max + 1);
  while (start < end && joined[start] === separator) start++;
  const cut = joined.slice(start, start + max);
  end = cut.length;
  while (end > 0 && cut[end - 1] === separator) end--;
  return cut.slice(0, end);
}

/** A ruleset id from a name: lowercase, dashes, nothing else. */
export function rulesetBuilderId(name: string): string {
  return idText(name, "-", 48) || "my-ruleset";
}

/** Four random base-36 characters for a new ruleset's id. */
function randomIdTag(): string {
  const draw = new Uint32Array(1);
  globalThis.crypto.getRandomValues(draw);
  return (draw[0]! % 36 ** 4).toString(36).padStart(4, "0");
}

/**
 * A ruleset id from a name that none of `taken` uses, so a new ruleset never becomes a version of another.
 * The random tag keeps it off a removed ruleset's id too: removing a ruleset leaves its sheets on cards and
 * its chats pinned, so reusing the id would hand the new ruleset those old sheets and chats.
 */
export function rulesetBuilderFreeId(name: string, taken: Iterable<string>, tag = randomIdTag()): string {
  const used = new Set([...taken].map((id) => id.replace(/^local\//, "")));
  // 38 + "-" + tag + a "-n" for n < 100 stays inside the 48 characters rulesetBuilderId keeps, so the id
  // checked here is the id the writer stores.
  const stem = `${idText(name, "-", 38) || "my-ruleset"}-${tag}`;
  let id = stem;
  for (let n = 2; used.has(id); n++) id = `${stem}-${n}`;
  return id;
}

const SHEET_ID = /^[a-z][a-z0-9_]{0,39}$/;

/** The row's own id where it has a usable one nobody else took, or a new one from its label. */
function idFor(row: { id?: string; label: string }, used: Set<string>, fallback: string): string {
  if (row.id && SHEET_ID.test(row.id) && !used.has(row.id)) {
    used.add(row.id);
    return row.id;
  }
  const base = idText(row.label, "_", 36) || fallback;
  const stem = /^[a-z]/.test(base) ? base : `${fallback}_${base}`;
  let id = stem;
  for (let n = 2; used.has(id); n++) id = `${stem}_${n}`;
  used.add(id);
  return id;
}

const row = <T extends object>(fields: T) => ({ key: rulesetBuilderKey(), ...fields });
const stats = (labels: string[], min: number, max: number, start: number) =>
  labels.map((label) => row({ label, min, max, default: start }));
const NOTES = () =>
  row({ label: "Notes", columns: [row({ label: "Notes", type: "text" as RulesetBuilderColumnType })] });

/**
 * A starting draft for a preset, so a new ruleset is playable at once. The stats are plain words,
 * not any published game's: the builder is for rules Marinara does not already have, and a system
 * it ships should be installed rather than copied here.
 */
export function rulesetBuilderStarter(preset: RulesetBuilderDicePreset, name = "My Ruleset"): RulesetBuilderDraft {
  const base = {
    id: rulesetBuilderId(name),
    name,
    lists: [NOTES()],
    fields: [row({ label: "Concept", type: "text" as const })],
    skills: [],
  };
  switch (preset) {
    case "2d6-bands":
      return {
        ...base,
        dice: { preset },
        ladder: [{ label: "Roll", value: 7 }],
        abilities: stats(["Force", "Grace", "Wits", "Heart"], -2, 3, 0),
        ranks: [],
        pools: [],
        tracks: [row({ label: "Harm", min: 0, max: 6, display: "bar" })],
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
        abilities: stats(["Body", "Mind", "Spirit"], 1, 5, 2),
        ranks: [1, 2, 3, 4, 5].map((dots) => row({ label: `${dots} dot${dots > 1 ? "s" : ""}`, bonus: dots })),
        pools: [row({ label: "Willpower", max: 5 })],
        tracks: [row({ label: "Health", min: 0, max: 7, display: "bar" })],
      };
    case "highest":
      return {
        ...base,
        dice: { preset },
        ladder: [{ label: "Roll", value: 4 }],
        abilities: stats(["Act", "Know", "Sway"], 0, 4, 1),
        ranks: [1, 2, 3].map((rating) => row({ label: `Rating ${rating}`, bonus: rating })),
        pools: [],
        tracks: [row({ label: "Stress", min: 0, max: 9, display: "bar" })],
      };
    case "percentile":
      return {
        ...base,
        dice: { preset },
        ladder: [{ label: "Regular", value: 0 }],
        abilities: stats(["Body", "Mind", "Will"], 1, 99, 50),
        ranks: [row({ label: "Trained", bonus: 20 }), row({ label: "Expert", bonus: 40 })],
        pools: [row({ label: "Health", max: 10, display: "bar" })],
        tracks: [],
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
        abilities: stats(["Body", "Mind", "Heart", "Spirit"], -1, 4, 0),
        ranks: [row({ label: "Experienced", bonus: 2 })],
        pools: [row({ label: "Hope", max: 6 })],
        tracks: [row({ label: "Stress", min: 0, max: 6, display: "bar" })],
      };
    case "no-dice":
      return {
        ...base,
        dice: { preset },
        ladder: [
          { label: "Easy", value: 2 },
          { label: "Hard", value: 4 },
          { label: "Very hard", value: 6 },
        ],
        abilities: stats(["Body", "Mind", "Spirit"], 0, 5, 1),
        ranks: [row({ label: "Adept", bonus: 1 }), row({ label: "Master", bonus: 2 })],
        pools: [],
        tracks: [row({ label: "Health", min: 0, max: 5, display: "bar" })],
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
        abilities: stats(["Might", "Agility", "Wits", "Presence"], -3, 5, 0),
        ranks: [row({ label: "Trained", bonus: 2 }), row({ label: "Expert", bonus: 4 })],
        pools: [row({ label: "Health", max: 10, display: "bar" })],
        tracks: [],
        lists: [
          row({
            label: "Gear",
            columns: [
              row({ label: "Qty", type: "number" as RulesetBuilderColumnType }),
              row({ label: "Notes", type: "text" as RulesetBuilderColumnType }),
            ],
          }),
          NOTES(),
        ],
      };
  }
}

/** The preset a resolution plays, or null for one the builder cannot write. */
export function rulesetBuilderPresetOf(resolution: Record<string, any>): RulesetBuilderDicePreset | null {
  const dice = resolution.dice as { count?: number; sides?: number } | undefined;
  switch (resolution.kind) {
    case "dice-pool":
      return "pool";
    case "dice-highest":
      return "highest";
    case "roll-against":
      return dice?.count === 1 && dice.sides === 100 ? "percentile" : null;
    case "dice-sum":
      if (dice?.count === 0) return "no-dice";
      if (resolution.duality) return "duality";
      if (dice?.count === 2 && dice.sides === 6) return "2d6-bands";
      if (dice?.count === 1 && dice.sides === 20) return "d20";
      return null;
    default:
      return null;
  }
}

/** The resolution for a preset: what the Engine throws and what it reads off the throw. */
function resolutionFor(draft: RulesetBuilderDraft, tiers: Array<Record<string, unknown>>): Record<string, unknown> {
  // Blank rows are left out, and a ladder holds twelve steps at most.
  const ladder = draft.ladder
    .filter((step) => step.label.trim())
    .slice(0, RULESET_BUILDER_MAX.ladder)
    .map((step) => ({ label: step.label.trim().slice(0, 80), dc: step.value }));
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
      const target = Math.min(sides, Math.max(2, draft.dice.target ?? 6));
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
    case "no-dice":
      return {
        kind: "dice-sum",
        dice: { count: 0, sides: 6 },
        ...flat,
        advantage: false,
        difficultyLadder: ladder.length ? ladder : [{ label: "Hard", dc: 4 }],
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

/** What a builder ruleset tells the narrator about checks when its author wrote nothing. */
export function rulesetBuilderDefaultCheckGuidance(name: string): string {
  return `This game uses the ${name.trim() || "My Ruleset"} rules. Call for a check when the outcome is uncertain and matters, with one of the sheet's skills or stats, and pick a difficulty from the ladder. The Engine rolls it and reports what happened. Never write dice or results yourself.`;
}
/** And about keeping the sheets. */
export const RULESET_BUILDER_DEFAULT_SHEET_GUIDANCE =
  "The character sheets below are kept by the Engine. Record each change with a sheet command.";
const defaultSummary = (name: string) => `${name} rules, made with the ruleset builder.`;

/** Why a draft cannot be saved as the form shows it. Each is something the writer would otherwise drop
 *  without a word (a skill whose stat is gone, a pool or track with no room) or the schema would refuse. */
export type RulesetBuilderProblem = "orphanSkill" | "emptyPool" | "emptyTrack" | "unsafeText" | "tooManySections";

const UNSAFE_LABEL = /[\u0000-\u001F\u007F\[\]]|\{\{|\}\}/;
const UNSAFE_PROMPT = /[\[\]]|\{\{|\}\}/;
/** Draft keys that hold ids or choices rather than text a person typed. */
const NOT_TEXT = new Set([
  "key",
  "id",
  "ability",
  "preset",
  "type",
  "display",
  "spdx",
  // A file's own license line: the form never shows or writes it, so it is not the player's to fix.
  "attribution",
  "reservedIds",
  "reservedRanks",
  "reservedColumns",
]);
const PROMPT_KEYS = new Set(["checkGuidance", "sheetGuidance", "rulesReference", "worldGuidance"]);

export function rulesetBuilderProblems(draft: RulesetBuilderDraft): RulesetBuilderProblem[] {
  const problems: RulesetBuilderProblem[] = [];
  const stats = new Set(draft.abilities.filter((ability) => ability.label.trim()).map((ability) => ability.key));
  if (draft.skills.some((skill) => skill.label.trim() && !stats.has(skill.ability))) problems.push("orphanSkill");
  if (draft.pools.some((pool) => pool.label.trim() && !(pool.max > 0))) problems.push("emptyPool");
  if (draft.tracks.some((track) => track.label.trim() && !(track.max > track.min))) problems.push("emptyTrack");
  // The prompt boxes may break lines (the writer joins them); every other text is one line as typed.
  const unsafe = (value: unknown, key: string): boolean => {
    if (NOT_TEXT.has(key)) return false;
    if (typeof value === "string") return (PROMPT_KEYS.has(key) ? UNSAFE_PROMPT : UNSAFE_LABEL).test(value);
    if (Array.isArray(value)) return value.some((entry) => unsafe(entry, key));
    if (value && typeof value === "object") return Object.entries(value).some(([inner, entry]) => unsafe(entry, inner));
    return false;
  };
  if (unsafe(draft, "")) problems.push("unsafeText");
  // Counted on what the writer makes, so a list, the fields' group and a group two rows share all count
  // the way they are written.
  const written = rulesetFromBuilderDraft(draft) as { sheet: { sections: unknown[] } };
  if (written.sheet.sections.length > RULESET_BUILDER_MAX.sections) problems.push("tooManySections");
  return problems;
}

/** The ruleset document a draft makes, ready for the importer (which validates it). */
export function rulesetFromBuilderDraft(draft: RulesetBuilderDraft, version = 1): Record<string, unknown> {
  // Ids are one space across the sheet. Rows that already have one claim it first, so a new row named
  // like an old one never takes the old one's id.
  const used = new Set<string>();
  const keep = (rows: Array<{ id?: string }>) =>
    rows.forEach((entry) => entry.id && SHEET_ID.test(entry.id) && used.add(entry.id));
  for (const rows of [draft.abilities, draft.skills, draft.pools, draft.tracks, draft.fields, draft.lists]) keep(rows);
  draft.reservedIds?.forEach((id) => used.add(id));
  Object.values(draft.groupIds ?? {}).forEach((id) => SHEET_ID.test(id) && used.add(id));
  const claim = (entry: { id?: string; label: string }, fallback: string) => {
    if (entry.id && SHEET_ID.test(entry.id)) used.delete(entry.id);
    return idFor(entry, used, fallback);
  };

  const namedAbilities = draft.abilities.filter((ability) => ability.label.trim());
  const abilityIds = new Map<string, string>();
  const abilities = namedAbilities.map((ability) => {
    const id = claim({ id: ability.id, label: ability.label.trim() }, "stat");
    abilityIds.set(ability.key, id);
    return {
      id,
      label: ability.label.trim().slice(0, 40),
      short: (ability.short?.trim() || ability.label.trim().slice(0, 3)).toUpperCase().slice(0, 4),
      min: ability.min,
      max: ability.max,
      default: Math.min(ability.max, Math.max(ability.min, ability.default)),
    };
  });
  // Sections are one id space with everything else, and two groups that differ only in case are one.
  const sections: Array<{ id: string; label: string }> = [];
  const sectionFor = (label: string) => {
    const name = label.trim().slice(0, 40);
    const known = sections.find((section) => section.label.toLowerCase() === name.toLowerCase());
    if (known) return known.id;
    const own = draft.groupIds?.[name.toLowerCase()];
    if (own && SHEET_ID.test(own)) used.delete(own);
    const section = { id: idFor({ id: own, label: name }, used, "section"), label: name };
    sections.push(section);
    return section.id;
  };
  // Stats with the same group show under one heading.
  const groupedAbilities = abilities.map((ability, index) => {
    const group = namedAbilities[index]!.group?.trim();
    return group ? { ...ability, section: sectionFor(group) } : ability;
  });
  const skills = draft.skills
    .filter((skill) => skill.label.trim() && abilityIds.has(skill.ability))
    .map((skill) => ({
      id: claim({ id: skill.id, label: skill.label.trim() }, "skill"),
      label: skill.label.trim().slice(0, 40),
      ability: abilityIds.get(skill.ability)!,
      ...(skill.group?.trim() ? { section: sectionFor(skill.group) } : {}),
    }));
  const about = draft.fields.some((field) => field.label.trim()) ? sectionFor("About") : undefined;
  const fields = draft.fields
    .filter((field) => field.label.trim())
    .map((field) => {
      const id = claim({ id: field.id, label: field.label.trim() }, "field");
      const label = field.label.trim().slice(0, 40);
      return field.type === "number"
        ? { id, label, type: "number", min: 0, max: 99999, default: 0, section: about }
        : { id, label, type: "text", maxLength: 200, section: about };
    });
  const pools = draft.pools
    .filter((pool) => pool.label.trim() && pool.max > 0)
    .map((pool) => ({
      id: claim({ id: pool.id, label: pool.label.trim() }, "pool"),
      label: pool.label.trim().slice(0, 40),
      max: { const: pool.max },
      ...(pool.display ? { display: pool.display } : {}),
    }));
  const tracks = draft.tracks
    .filter((track) => track.label.trim() && track.max > track.min)
    .map((track) => ({
      id: claim({ id: track.id, label: track.label.trim() }, "track"),
      label: track.label.trim().slice(0, 40),
      min: track.min,
      max: track.max,
      default: track.min,
      alwaysShow: true,
      ...(track.display ? { display: track.display } : {}),
    }));
  // Every row is named by its first column, so the narrator and the sheet can tell rows apart.
  const lists = draft.lists
    .filter((list) => list.label.trim())
    .slice(0, RULESET_BUILDER_MAX.lists)
    .map((list) => {
      const named = list.columns.filter((column) => column.label.trim()).slice(0, RULESET_BUILDER_MAX.columns);
      // A list's columns are their own id space, beside the name column every row has.
      const columnIds = new Set<string>(["name", ...(list.reservedColumns ?? [])]);
      named.forEach((column) => column.id && SHEET_ID.test(column.id) && columnIds.add(column.id));
      const columns = named.map((column) => {
        if (column.id && SHEET_ID.test(column.id)) columnIds.delete(column.id);
        const id = idFor({ id: column.id, label: column.label.trim() }, columnIds, "column");
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
        id: claim({ id: list.id, label: list.label.trim() }, "list"),
        label: list.label.trim().slice(0, 40),
        section: sectionFor(list.label),
        display: { tab, ...(mark ? { mark } : {}) },
        maxItems: 60,
        columns: [{ id: "name", label: "Name", type: "text", maxLength: 80, required: true }, ...columns],
      };
    });
  // Rank ids are their own space, and a new rank takes the next free `rank_N`.
  const untrained = draft.untrained ?? { id: "untrained", label: "Untrained" };
  const tierIds = new Set<string>([untrained.id, ...(draft.reservedRanks ?? [])]);
  const named = draft.ranks.filter((rank) => rank.label.trim()).slice(0, RULESET_BUILDER_MAX.ranks);
  named.forEach((rank) => rank.id && tierIds.add(rank.id));
  const tiers = [
    untrained,
    ...named.map((rank) => {
      let id = rank.id;
      if (!id) {
        let n = 1;
        while (tierIds.has(`rank_${n}`)) n++;
        id = `rank_${n}`;
        tierIds.add(id);
      }
      return { id, label: rank.label.trim(), flat: Math.trunc(rank.bonus) };
    }),
  ];

  /** One line, held to the ruleset's limit: a prompt line may not break. */
  const line = (text: string | undefined, max: number) =>
    text
      ?.replace(/\s*[\u0000-\u001F\u007F\u0085\u2028\u2029]+\s*/g, " ")
      .trim()
      .slice(0, max) || undefined;
  const name = draft.name.trim().slice(0, 80) || "My Ruleset";
  const sheetGuidance = line(draft.sheetGuidance, RULESET_BUILDER_GUIDANCE_MAX);
  const worldGuidance = line(draft.worldGuidance, RULESET_BUILDER_GUIDANCE_MAX);
  const rulesReference = line(draft.rulesReference, RULESET_BUILDER_REFERENCE_MAX);
  const summary = draft.summary?.trim() || defaultSummary(name);
  const practiceExcept = (draft.practiceExcept ?? []).flatMap((group) => {
    const section = sections.find((entry) => entry.label.toLowerCase() === group.trim().toLowerCase());
    return section && skills.some((skill) => skill.section === section.id) ? [section.id] : [];
  });
  return {
    schemaVersion: 1,
    id: rulesetBuilderId(draft.id || draft.name),
    version,
    name,
    edition: draft.edition ?? RULESET_BUILDER_EDITION,
    license: draft.license ?? BUILDER_LICENSE,
    coverage: {
      checks: true,
      saves: false,
      sheet: true,
      resources: pools.length > 0 || tracks.length > 0,
      rests: pools.length + tracks.length > 0,
      combat: false,
      summary: summary.slice(0, 300),
    },
    resolution: resolutionFor(draft, tiers),
    sheet: {
      version: 1,
      sections,
      abilities: groupedAbilities,
      skills,
      fields,
      derived: [],
      lists,
      live: { pools, tracks, conditions: [], states: [] },
      ...(draft.practice && skills.length > 0
        ? { progress: practiceExcept.length > 0 ? { except: practiceExcept } : {} }
        : {}),
      // The narrator may raise stats, set skill ranks and change fields as the story earns them;
      // without this a builder ruleset's sheet could only spend and restore.
      ...(draft.advancement !== false && (abilities.length > 0 || skills.length > 0 || fields.length > 0)
        ? {
            advancement: {
              ...(abilities.length > 0 ? { abilities: true } : {}),
              ...(skills.length > 0 ? { skills: true } : {}),
              ...(fields.length > 0 ? { fields: fields.map((field) => field.id) } : {}),
            },
          }
        : {}),
    },
    // A rest refills the pools and empties the tracks; a sheet with neither has no rest to offer.
    rests:
      pools.length + tracks.length > 0
        ? [
            {
              id: "rest",
              label: "Rest",
              restore: [
                ...pools.map((pool) => ({ pool: pool.id, to: "max" })),
                ...tracks.map((track) => ({ track: track.id, to: "min" })),
              ],
            },
          ]
        : [],
    ...(rulesReference ? { gmReference: rulesReference } : {}),
    gm: {
      checkGuidance:
        line(draft.checkGuidance, RULESET_BUILDER_GUIDANCE_MAX) ?? rulesetBuilderDefaultCheckGuidance(name),
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

/** Read a ruleset into the form's draft, without asking whether the form can hold all of it. */
function readDraft(definition: Record<string, any>, preset: RulesetBuilderDicePreset): RulesetBuilderDraft {
  const resolution = definition.resolution ?? {};
  const sheet = definition.sheet ?? {};
  const sectionLabel = new Map<string, string>(
    (sheet.sections ?? []).map((section: { id: string; label: string }) => [section.id, section.label]),
  );
  const groupOf = (section: string | undefined) =>
    section && sectionLabel.has(section) ? { group: sectionLabel.get(section)! } : {};
  // Text the builder fills in itself reads back as blank, so the form shows its default as a hint.
  const own = (value: unknown, fallback: string) =>
    typeof value === "string" && value && value !== fallback ? value : undefined;
  const [untrained, ...ranks] = (resolution.proficiencyTiers ?? []) as Array<{
    id: string;
    label: string;
    flat?: number;
  }>;
  return {
    id: String(definition.id ?? "").replace(/^local\//, ""),
    name: definition.name,
    summary: own(definition.coverage?.summary, defaultSummary(definition.name)),
    checkGuidance: own(definition.gm?.checkGuidance, rulesetBuilderDefaultCheckGuidance(definition.name)),
    sheetGuidance: own(definition.gm?.sheetGuidance, RULESET_BUILDER_DEFAULT_SHEET_GUIDANCE),
    worldGuidance: own(definition.gm?.worldGuidance, ""),
    rulesReference: own(definition.gmReference, ""),
    edition: definition.edition,
    license: definition.license,
    dice: {
      preset,
      ...(preset === "pool" ? { sides: resolution.die?.sides, target: resolution.target?.default } : {}),
    },
    ladder: (resolution.difficultyLadder ?? []).map((step: { label: string; dc?: number; successes?: number }) => ({
      label: step.label,
      value: step.dc ?? step.successes ?? 0,
    })),
    abilities: (sheet.abilities ?? []).map(
      (ability: {
        id: string;
        label: string;
        short?: string;
        min: number;
        max: number;
        default: number;
        section?: string;
      }) => ({
        key: ability.id,
        id: ability.id,
        label: ability.label,
        // A short name the writer would make anyway is left to follow the name when it changes.
        ...(ability.short && ability.short !== ability.label.trim().slice(0, 3).toUpperCase()
          ? { short: ability.short }
          : {}),
        min: ability.min,
        max: ability.max,
        default: ability.default,
        ...groupOf(ability.section),
      }),
    ),
    skills: (sheet.skills ?? []).map((skill: { id: string; label: string; ability: string; section?: string }) => ({
      key: skill.id,
      id: skill.id,
      label: skill.label,
      ability: skill.ability,
      ...groupOf(skill.section),
    })),
    ...(untrained ? { untrained: { id: untrained.id, label: untrained.label } } : {}),
    ranks: ranks.map((tier) => ({ key: tier.id, id: tier.id, label: tier.label, bonus: tier.flat ?? 0 })),
    ...(sheet.progress ? { practice: true } : {}),
    ...(sheet.progress?.except?.length
      ? {
          practiceExcept: sheet.progress.except.flatMap((id: string) =>
            sectionLabel.has(id) ? [sectionLabel.get(id)!] : [],
          ),
        }
      : {}),
    pools: (sheet.live?.pools ?? []).map(
      (pool: { id: string; label: string; max: { const?: number }; display?: string }) => ({
        key: pool.id,
        id: pool.id,
        label: pool.label,
        max: pool.max?.const ?? 1,
        ...(pool.display === "bar" || pool.display === "dots" ? { display: pool.display } : {}),
      }),
    ),
    tracks: (sheet.live?.tracks ?? []).map(
      (track: { id: string; label: string; min: number; max: number; display?: string }) => ({
        key: track.id,
        id: track.id,
        label: track.label,
        min: track.min,
        max: track.max,
        ...(track.display === "bar" || track.display === "dots" ? { display: track.display } : {}),
      }),
    ),
    fields: (sheet.fields ?? []).map((field: { id: string; label: string; type: string }) => ({
      key: field.id,
      id: field.id,
      label: field.label,
      type: field.type === "number" ? ("number" as const) : ("text" as const),
    })),
    lists: (sheet.lists ?? []).map(
      (list: {
        id: string;
        label: string;
        display?: { tab?: string };
        columns: Array<{ id: string; label: string; type: string }>;
      }) => ({
        key: list.id,
        id: list.id,
        label: list.label,
        ...(list.display?.tab && list.display.tab !== list.label.slice(0, 24) ? { tab: list.display.tab } : {}),
        reservedColumns: list.columns.map((column) => column.id),
        columns: list.columns
          .filter((column) => column.id !== "name")
          .map((column) => ({
            key: column.id,
            id: column.id,
            label: column.label,
            type: (column.type === "number"
              ? "number"
              : column.type === "boolean"
                ? "check"
                : "text") as RulesetBuilderColumnType,
          })),
      }),
    ),
    ...(sheet.advancement ? {} : { advancement: false }),
    groupIds: Object.fromEntries([...sectionLabel].map(([id, label]) => [label.toLowerCase(), id])),
    reservedIds: [
      ...[sheet.abilities, sheet.skills, sheet.live?.pools, sheet.live?.tracks, sheet.fields, sheet.lists].flatMap(
        (rows: Array<{ id: string }> | undefined) => (rows ?? []).map((row) => row.id),
      ),
      ...sectionLabel.keys(),
    ],
    reservedRanks: ranks.map((rank) => rank.id),
  };
}

/** The top-level keys the builder writes; a file with any other is not one the form can hold. */
const BUILDER_KEYS = new Set([
  "schemaVersion",
  "id",
  "version",
  "name",
  "edition",
  "license",
  "coverage",
  "resolution",
  "sheet",
  "rests",
  "gmReference",
  "gm",
]);

/** A parsed ruleset as one string, keys sorted, for comparing two of them. */
function canonical(document: unknown): string | null {
  const parsed = parseRulesetDefinition(document);
  if (!parsed.ok) return null;
  // `display: "counter"` is what no display means, so a file that spells it out still compares equal.
  return JSON.stringify(parsed.definition, (key, value) =>
    key === "display" && value === "counter"
      ? undefined
      : value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
  );
}

/**
 * The form's draft of a ruleset, or null when the form cannot hold all of it. The test is the honest
 * one: the draft must write the ruleset back exactly, so saving it unchanged changes nothing. A
 * hand-written file passes when it uses only what the form shows; anything more (a combat block, a
 * derived value, a comment) and the builder leaves it to its author.
 */
export function rulesetBuilderDraftFrom(definition: Record<string, any>): RulesetBuilderDraft | null {
  // A quick no first, so a large ruleset (combat, catalogs) is never parsed just to be turned away.
  if (Object.keys(definition).some((key) => !BUILDER_KEYS.has(key))) return null;
  // A comment is the author's note; the form has nowhere to keep one, so saving would lose it.
  if (JSON.stringify(definition).includes('"$comment"')) return null;
  const preset = rulesetBuilderPresetOf(definition.resolution ?? {});
  if (!preset) return null;
  const draft = readDraft(definition, preset);
  const own = canonical({ ...definition, id: draft.id });
  return own !== null && own === canonical(rulesetFromBuilderDraft(draft, definition.version)) ? draft : null;
}
