import type {
  CombatManeuverProposal,
  CombatManeuverProposalEffect,
  CombatStatusEffect,
  TacticalCoord,
  TacticalTerrain,
} from "@marinara-engine/shared";

/**
 * Maneuver proposals come straight from a GM model, so their shape is a
 * lottery: flattened `x`/`y` instead of `tile`, `duration` instead of
 * `turnsLeft`, unit *names* instead of ids, difficulty as a percentage, extra
 * keys the schema never declared. The strict zod schema rejects the whole
 * proposal when any one of those appears, which is what made freeform maneuvers
 * silently do nothing.
 *
 * This normalizer salvages instead: it coerces what it can, drops individual
 * effects it cannot, and returns `null` only when nothing usable survives (the
 * caller then falls back to the deterministic keyword resolvers). It never
 * loosens engine rules — range, side, bounds and roll checks all still run.
 */

const MAX_EFFECTS = 6;
const DEFAULT_DIFFICULTY = 0.52;

const EFFECT_TYPES = ["damage", "heal", "status", "move", "cover", "terrain", "objective"] as const;
type EffectType = (typeof EFFECT_TYPES)[number];

const EFFECT_TYPE_SYNONYMS: Record<string, EffectType> = {
  attack: "damage",
  hit: "damage",
  strike: "damage",
  harm: "damage",
  damage: "damage",
  heal: "heal",
  healing: "heal",
  restore: "heal",
  cure: "heal",
  status: "status",
  buff: "status",
  debuff: "status",
  effect: "status",
  condition: "status",
  move: "move",
  push: "move",
  shove: "move",
  reposition: "move",
  teleport: "move",
  cover: "cover",
  shield: "cover",
  barrier: "cover",
  guard: "cover",
  terrain: "terrain",
  environment: "terrain",
  objective: "objective",
  goal: "objective",
};

const TERRAINS = ["plains", "forest", "mountain", "ruin", "water", "wall"] as const;

const TERRAIN_SYNONYMS: Record<string, TacticalTerrain> = {
  grass: "plains",
  field: "plains",
  open: "plains",
  tree: "forest",
  trees: "forest",
  wood: "forest",
  woods: "forest",
  brush: "forest",
  rock: "mountain",
  rocks: "mountain",
  hill: "mountain",
  boulder: "mountain",
  rubble: "ruin",
  debris: "ruin",
  broken: "ruin",
  crater: "ruin",
  sea: "water",
  river: "water",
  flood: "water",
  barrier: "wall",
  barricade: "wall",
  stone: "wall",
};

const STATS = ["attack", "defense", "speed", "hp"] as const;
type StatusStat = (typeof STATS)[number];

const SELF_ALIASES = new Set(["self", "me", "myself", "actor", "caster", "player", "user", "own", "you"]);

export interface ManeuverContextUnit {
  id: string;
  name: string;
  /** `ally` covers the actor's own side; `enemy` is everything else. */
  side: "ally" | "enemy";
  hp: number;
}

export interface ManeuverNormalizationContext {
  actorId: string;
  /** Classic has no grid, so tile-bearing effects are salvaged differently. */
  style: "classic" | "tactical";
  units: ManeuverContextUnit[];
  objectiveIds?: string[];
}

export interface ManeuverNormalizationReport {
  /** Field-level coercions applied to the envelope or an effect. */
  coerced: string[];
  /** Effects that could not be salvaged, with the reason they were dropped. */
  dropped: Array<{ index: number; reason: string }>;
  /** Why the whole proposal was unusable, when `proposal` is null. */
  fatal?: string;
}

export interface ManeuverNormalizationResult {
  proposal: CombatManeuverProposal | null;
  report: ManeuverNormalizationReport;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Unwraps `{proposal:{...}}` / `{maneuver:{...}}` / `{result:{...}}` envelopes. */
function unwrapEnvelope(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  if (Array.isArray(root.effects) || typeof root.narration === "string") return root;
  for (const key of ["proposal", "maneuver", "result", "output", "response", "data"]) {
    const nested = asRecord(root[key]);
    if (nested && (Array.isArray(nested.effects) || typeof nested.narration === "string")) return nested;
  }
  return root;
}

function normalizeTile(source: Record<string, unknown>): TacticalCoord | undefined {
  const nested = asRecord(source.tile) ?? asRecord(source.to) ?? asRecord(source.position) ?? asRecord(source.coord);
  const x = nested ? firstNumber(nested, ["x", "col", "column"]) : firstNumber(source, ["x", "tileX", "col"]);
  const y = nested ? firstNumber(nested, ["y", "row"]) : firstNumber(source, ["y", "tileY", "row"]);
  if (x === undefined || y === undefined) return undefined;
  return { x: Math.round(x), y: Math.round(y) };
}

function normalizeTerrain(value: unknown): TacticalTerrain | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  if ((TERRAINS as readonly string[]).includes(key)) return key as TacticalTerrain;
  for (const [synonym, terrain] of Object.entries(TERRAIN_SYNONYMS)) {
    if (key.includes(synonym)) return terrain;
  }
  return undefined;
}

function normalizeStat(value: unknown): StatusStat | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  if ((STATS as readonly string[]).includes(key)) return key as StatusStat;
  if (key.startsWith("def") || key.includes("armor") || key.includes("resist")) return "defense";
  if (key.startsWith("att") || key.includes("power") || key.includes("damage") || key.includes("str")) return "attack";
  if (key.includes("speed") || key.includes("agil") || key.includes("initiative")) return "speed";
  if (key === "health" || key.includes("hitpoint")) return "hp";
  return undefined;
}

function normalizeEffectType(value: unknown): EffectType | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if ((EFFECT_TYPES as readonly string[]).includes(key)) return key as EffectType;
  return EFFECT_TYPE_SYNONYMS[key];
}

function normalizeOutcome(value: unknown): CombatManeuverProposal["outcome"] {
  if (typeof value !== "string") return "partial";
  const key = value.trim().toLowerCase();
  if (key.startsWith("succ")) return "success";
  if (key.startsWith("fail")) return "failure";
  return "partial";
}

function normalizeDifficulty(value: unknown, report: ManeuverNormalizationReport): number {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(raw)) {
    report.coerced.push("difficulty defaulted");
    return DEFAULT_DIFFICULTY;
  }
  // Models regularly answer in percent ("difficulty": 60). Values just above 1
  // are an over-confident 1.0, not a percentage, so they clamp instead.
  const scaled = raw >= 2 && raw <= 100 ? raw / 100 : raw;
  const clamped = clamp(scaled, 0.05, 0.95);
  if (clamped !== raw) report.coerced.push("difficulty clamped");
  return clamped;
}

export function buildManeuverStatus(
  raw: Record<string, unknown> | null,
  fallbackName: string | undefined,
  targetIsAlly: boolean,
): CombatStatusEffect {
  const name = (raw ? firstString(raw, ["name", "status", "label"]) : undefined) ?? fallbackName ?? "Maneuver Effect";
  const modifierRaw = raw ? firstNumber(raw, ["modifier", "amount", "value", "power", "bonus"]) : undefined;
  const modifier = clamp(modifierRaw ?? (targetIsAlly ? 2 : -2), -5, 5);
  const turnsRaw = raw ? firstNumber(raw, ["turnsLeft", "duration", "turns", "rounds", "durationTurns"]) : undefined;
  return {
    name: name.trim().slice(0, 80) || "Maneuver Effect",
    // The engine still zeroes a modifier whose sign contradicts the target's
    // side; this only keeps the value inside the contract.
    modifier: targetIsAlly ? Math.abs(modifier) : -Math.abs(modifier),
    stat: (raw ? normalizeStat(raw.stat ?? raw.attribute) : undefined) ?? "defense",
    turnsLeft: clamp(Math.floor(turnsRaw ?? 1), 1, 3),
  };
}

/**
 * Coerces a GM-authored maneuver proposal into the engine contract, salvaging
 * individual effects rather than rejecting the whole payload. Returns `null`
 * when no effect survives, so the caller can fall back to keyword resolution.
 */
export function normalizeManeuverProposal(
  raw: unknown,
  context: ManeuverNormalizationContext,
): ManeuverNormalizationResult {
  const report: ManeuverNormalizationReport = { coerced: [], dropped: [] };
  const root = unwrapEnvelope(raw);
  if (!root) {
    report.fatal = "response was not a JSON object";
    return { proposal: null, report };
  }

  const byId = new Map<string, ManeuverContextUnit>();
  const byName = new Map<string, ManeuverContextUnit>();
  for (const unit of context.units) {
    byId.set(unit.id.trim().toLowerCase(), unit);
    const name = unit.name.trim().toLowerCase();
    if (name && !byName.has(name)) byName.set(name, unit);
  }
  const actor = byId.get(context.actorId.trim().toLowerCase());
  const livingEnemies = context.units.filter((unit) => unit.side === "enemy" && unit.hp > 0);

  const resolveTarget = (value: unknown): ManeuverContextUnit | undefined => {
    if (typeof value !== "string") return undefined;
    const key = value.trim().toLowerCase();
    if (!key) return undefined;
    if (SELF_ALIASES.has(key)) return actor;
    const direct = byId.get(key) ?? byName.get(key);
    if (direct) return direct;
    // Models often answer with "the goblin scout" or "Unit: goblin".
    for (const [name, unit] of byName) {
      if (key.includes(name) || name.includes(key)) return unit;
    }
    return undefined;
  };

  const objectiveIds = new Map((context.objectiveIds ?? []).map((id) => [id.trim().toLowerCase(), id]));
  const rawEffects = Array.isArray(root.effects) ? root.effects : [];
  if (!Array.isArray(root.effects) && root.effects !== undefined) report.coerced.push("effects was not an array");

  const effects: CombatManeuverProposalEffect[] = [];
  rawEffects.forEach((entry, index) => {
    if (effects.length >= MAX_EFFECTS) {
      report.dropped.push({ index, reason: "over the six-effect cap" });
      return;
    }
    const source = asRecord(entry);
    if (!source) {
      report.dropped.push({ index, reason: "effect was not an object" });
      return;
    }
    let type = normalizeEffectType(source.type ?? source.kind ?? source.effect);
    if (!type) {
      report.dropped.push({ index, reason: `unknown effect type ${String(source.type ?? source.kind ?? "")}` });
      return;
    }

    const tile = normalizeTile(source);
    // "Summon a shield" comes back as tile-less cover far more often than as a
    // grid feature. Treat it as the defensive buff the player actually asked
    // for instead of dropping an effect the engine cannot place.
    const coverAsStatus = type === "cover" && !tile;
    if (coverAsStatus) {
      type = "status";
      report.coerced.push(`effect ${index}: tile-less cover became a defense buff`);
    }
    if (tile && !asRecord(source.tile)) report.coerced.push(`effect ${index}: flattened tile coordinates`);
    const amount = firstNumber(source, ["amount", "value", "power", "magnitude", "hp"]);
    const named = firstString(source, ["targetId", "target", "targetName", "unitId", "unit", "id"]);
    let target = resolveTarget(named);
    if (named && !target) report.coerced.push(`effect ${index}: unresolved target ${named}`);

    // A GM that omits the target for a self-buff is the single most common
    // shape error; default those to the actor rather than dropping the effect.
    if (!target && (type === "heal" || type === "status" || type === "cover")) target = actor;
    if (!target && type === "damage" && livingEnemies.length === 1) target = livingEnemies[0];
    if (!target && type === "move") target = actor;

    const effect: CombatManeuverProposalEffect = { type };
    if (target) effect.targetId = target.id;
    if (tile) effect.tile = tile;
    if (amount !== undefined) effect.amount = Math.round(amount);

    if (type === "status") {
      const statusName = firstString(source, ["statusName", "name", "label"]) ?? (coverAsStatus ? "Shielded" : undefined);
      effect.status = buildManeuverStatus(asRecord(source.status), statusName, (target ?? actor)?.side !== "enemy");
    }
    if (type === "terrain") {
      effect.terrain = normalizeTerrain(source.terrain ?? source.to ?? source.name) ?? "ruin";
    }
    if (type === "objective") {
      const objectiveId = firstString(source, ["objectiveId", "objective", "goalId", "id"]);
      if (!objectiveId) {
        report.dropped.push({ index, reason: "objective effect without an objective id" });
        return;
      }
      effect.objectiveId = objectiveIds.get(objectiveId.trim().toLowerCase()) ?? objectiveId;
    }

    // Tactical positions these on the grid, so a missing tile is unresolvable.
    // Classic has no grid and narrates them instead, so they pass through.
    if (context.style === "tactical" && (type === "cover" || type === "terrain" || type === "move") && !effect.tile) {
      report.dropped.push({ index, reason: `${type} effect without a usable tile` });
      return;
    }
    if ((type === "damage" || type === "heal" || type === "status") && !effect.targetId) {
      report.dropped.push({ index, reason: `${type} effect without a resolvable target` });
      return;
    }
    effects.push(effect);
  });

  if (effects.length === 0) {
    report.fatal = rawEffects.length > 0 ? "no proposed effect survived normalization" : "proposal contained no effects";
    return { proposal: null, report };
  }

  const narration = firstString(root, ["narration", "narrative", "description", "text"]) ?? "";
  const rationale = firstString(root, ["rationale", "reason", "reasoning", "justification"]) ?? "";
  return {
    proposal: {
      outcome: normalizeOutcome(root.outcome),
      rationale: rationale.slice(0, 1000),
      difficulty: normalizeDifficulty(root.difficulty, report),
      effects,
      narration: narration.slice(0, 1200),
    },
    report,
  };
}

/** Compact, log-friendly rendering of what the normalizer had to fix. */
export function describeNormalizationReport(report: ManeuverNormalizationReport): string {
  const parts: string[] = [];
  if (report.fatal) parts.push(`fatal: ${report.fatal}`);
  if (report.coerced.length) parts.push(`coerced: ${report.coerced.join("; ")}`);
  if (report.dropped.length) {
    parts.push(`dropped: ${report.dropped.map((entry) => `#${entry.index} ${entry.reason}`).join("; ")}`);
  }
  return parts.join(" | ") || "clean";
}
