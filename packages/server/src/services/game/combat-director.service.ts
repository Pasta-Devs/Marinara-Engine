import {
  normalizeGameDifficulty,
  combatAiScoreNoise,
  type CombatWeather,
  forecastTacticalAttack,
} from "@marinara-engine/shared";
import {
  assignCombatTactics,
  combatAiHash,
  createTacticalCombat,
  getMovementRange,
  validateTacticalUnitAction,
  performTacticalUnitAction,
  tickTacticalRound,
  summarizeTacticalBattlefield,
  decideTacticalAction,
  type Combatant,
  type CombatSkill,
  type CombatPlayerAction,
  type TacticalAction,
  type TacticalUnit,
  type TacticalCombatState,
  type CombatDecisionOption,
  type CombatDecisionWindow,
  type DirectedCombatView,
  type DirectedCommand,
  type CombatMechanic,
  type CombatItemEffect,
  type TacticalBattlefieldBrief,
} from "@marinara-engine/shared";
import { chooseClassicAction, estimateClassicAttack } from "./combat-ai.service.js";
import { resolveCombatRound, rollInitiative, canCombatantAct } from "./combat.service.js";
import type { RulesetFightState } from "./ruleset-combat-director.service.js";

type Unit = Combatant | TacticalUnit;
type Action = { unitId: string; classic?: CombatPlayerAction; tactical?: Extract<TacticalAction, { unitId: string }> };
type Candidate = CombatDecisionOption & {
  action?: Action;
  reaction?: "counterspell" | "guard";
  skillId?: string;
  pendingId?: string;
};
type Pending = {
  id: string;
  action: Action;
  skillId?: string;
  cancelled?: boolean;
  guarded?: string[];
  reaction?: Candidate["reaction"];
  parentId?: string;
  source: Source;
  flags?: [boolean, boolean];
};
type Task =
  | { kind: "activate" | "act" | "end"; unitId: string }
  | { kind: "anticipation" | "legendary"; unitId: string; triggerId: string }
  | { kind: "react"; unitId: string; pendingId: string }
  | { kind: "effect"; pendingId: string };
type Source = "gm" | "ai" | "manual" | "fallback";
export interface CombatDirectorState extends DirectedCombatView {
  schemaVersion: 1;
  anchor: string;
  gm: boolean;
  difficulty: string;
  weather?: CombatWeather;
  seed: number;
  serial: number;
  tasks: Task[];
  pending: Record<string, Pending>;
  choices: Candidate[];
  order: string[];
  defending: string[];
  skipParty: boolean;
  mechanics: CombatMechanic[];
  inventory: Array<{ name: string; quantity: number; description?: string }>;
  itemEffects: CombatItemEffect[];
  itemSpends: Record<string, number>;
  requests: string[];
  gmCalls: number;
  /** The `ruleset` style's whole fight. Present exactly when the style is `ruleset`; everything
   *  that reads or changes it lives in `ruleset-combat-director.service.ts`. */
  rulesetFight?: RulesetFightState;
}
const side = (unit: Unit) => (unit.side === "enemy" ? "enemy" : "party");
export const directorUnits = (s: CombatDirectorState): Unit[] => s.tactical?.units ?? [...s.party, ...s.enemies];
const living = (s: CombatDirectorState) => directorUnits(s).filter((u) => u.hp > 0);
const get = (s: CombatDirectorState, id: string) => directorUnits(s).find((u) => u.id === id);
const skillFor = (s: CombatDirectorState, a: Action) => {
  const u = get(s, a.unitId);
  return u?.skills?.find((k) =>
    a.classic?.type === "skill"
      ? k.id === a.classic.skillId
      : a.tactical?.type === "skill" && k.name === a.tactical.skillName,
  );
};
const cooldownKey = (s: CombatDirectorState, skill: CombatSkill) => (s.style === "tactical" ? skill.name : skill.id);
const ready = (s: CombatDirectorState, u: Unit, k: CombatSkill) =>
  (u.skillCooldowns?.[cooldownKey(s, k)] ?? 0) <= 0 &&
  (k.slotLevel ? (u.spellSlots?.[String(k.slotLevel)] ?? 0) > 0 : (u.mp ?? 0) >= k.mpCost);
const canAct = (u: Unit) => canCombatantAct(u);
const manual = (s: CombatDirectorState, u: Unit) =>
  side(u) === "party" &&
  (living(s).find((c) => side(c) === "party")?.id === u.id ||
    (u.controller ?? (s.style === "classic" ? "ai" : "manual")) === "manual");
function log(
  s: CombatDirectorState,
  text: string,
  kind: string,
  actorId?: string,
  source?: Source,
  message?: DirectedCombatView["log"][number]["message"],
) {
  s.log.push({ id: ++s.serial, text, kind, actorId, source, message });
  s.log = s.log.slice(-240);
}
function sync(s: CombatDirectorState) {
  if (s.tactical) {
    const convert = (u: TacticalUnit): Combatant => ({ ...u, side: side(u) === "party" ? "player" : "enemy" });
    s.party = s.tactical.units.filter((u) => u.side === "party").map(convert);
    s.enemies = s.tactical.units.filter((u) => u.side === "enemy").map(convert);
    s.tactical.log = s.log.map((e) => ({ kind: "status", text: e.text, actorId: e.actorId, message: e.message }));
  }
  if (!living(s).some((u) => side(u) === "enemy")) s.outcome = "victory";
  else if (!living(s).some((u) => side(u) === "party")) s.outcome = "defeat";
  if (s.outcome) {
    s.stage = "finished";
    s.window = undefined;
    s.tasks = [];
    s.pending = {};
    if (s.tactical) s.tactical.outcome = s.outcome === "flee" ? "fled" : s.outcome;
    s.summary = {
      outcome: s.outcome,
      rounds: s.round,
      battlefieldSummary: s.tactical ? (summarizeTacticalBattlefield(s.tactical) ?? undefined) : undefined,
      party: s.party.map((u) => ({
        name: u.name,
        hp: u.hp,
        maxHp: u.maxHp,
        ko: u.hp <= 0,
        mp: u.mp,
        maxMp: u.maxMp,
        spellSlots: u.spellSlots,
        statusEffects: (u.statusEffects ?? []).map((e) => e.name),
      })),
      enemies: s.enemies.map((u) => ({ name: u.name, hp: u.hp, maxHp: u.maxHp, defeated: u.hp <= 0 })),
    };
  }
}
export function combatDirectorView(s: CombatDirectorState): DirectedCombatView {
  sync(s);
  const {
    id,
    instanceId,
    revision,
    style,
    round,
    stage,
    actorId,
    party,
    enemies,
    inventory,
    tactical,
    weather,
    window,
    budgets,
    log: entries,
    outcome,
    summary,
  } = s;
  return {
    id,
    instanceId,
    revision,
    style,
    round,
    stage,
    actorId,
    party,
    enemies,
    inventory,
    tactical,
    weather,
    window,
    budgets,
    log: entries,
    outcome,
    summary,
  };
}
export function createCombatDirector(input: {
  id: string;
  anchor: string;
  party: Combatant[];
  enemies: Combatant[];
  style: "classic" | "tactical" | "ruleset";
  gm: boolean;
  difficulty: string;
  weather?: CombatWeather;
  seed: number;
  environment?: string;
  formation?: string;
  battlefield?: TacticalBattlefieldBrief;
  itemEffects?: CombatItemEffect[];
  mechanics?: CombatMechanic[];
  inventory?: CombatDirectorState["inventory"];
}): CombatDirectorState {
  const party = structuredClone(input.party),
    enemies = structuredClone(input.enemies);
  for (const u of [...party, ...enemies]) {
    u.tactics = assignCombatTactics(u, input.seed);
    u.skillCooldowns ??= {};
    if (u.side === "player") delete u.boss;
  }
  const s: CombatDirectorState = {
    schemaVersion: 1,
    id: input.id,
    anchor: input.anchor,
    revision: 0,
    style: input.style,
    round: 1,
    stage: "select",
    party,
    enemies,
    budgets: {},
    log: [],
    gm: input.gm,
    difficulty: normalizeGameDifficulty(input.difficulty),
    weather: input.weather,
    seed: input.seed,
    serial: 0,
    tasks: [],
    pending: {},
    choices: [],
    order: [],
    defending: [],
    skipParty: false,
    mechanics: input.mechanics ?? [],
    inventory: input.inventory ?? [],
    itemEffects: input.itemEffects ?? [],
    itemSpends: {},
    requests: [],
    gmCalls: 0,
  };
  if (s.style === "tactical")
    s.tactical = createTacticalCombat(party, enemies, {
      seed: s.seed,
      difficulty: s.difficulty,
      weather: s.weather,
      environment: input.environment,
      formation: input.formation,
      battlefield: input.battlefield,
    });
  for (const u of directorUnits(s))
    s.budgets[u.id] = { legendary: side(u) === "enemy" ? (u.boss?.points ?? 0) : 0, reaction: 1 };
  if (s.style === "classic") s.order = rollInitiative([...party, ...enemies]).map((e) => e.id);
  advanceCombatDirector(s);
  return s;
}
function asAction(
  s: CombatDirectorState,
  u: Unit,
  kind: "attack" | "skill" | "defend" | "wait" | "move",
  targetId?: string,
  skill?: CombatSkill,
  to?: { x: number; y: number },
): Action {
  if (s.style === "classic")
    return {
      unitId: u.id,
      classic:
        kind === "skill"
          ? { type: "skill", skillId: skill!.id, targetId: targetId! }
          : kind === "attack"
            ? { type: "attack", targetId: targetId! }
            : { type: "defend" },
    };
  return {
    unitId: u.id,
    tactical:
      kind === "skill"
        ? { type: "skill", unitId: u.id, skillName: skill!.name, targetId, to }
        : kind === "attack"
          ? { type: "attack", unitId: u.id, targetId: targetId!, to }
          : kind === "move"
            ? { type: "move", unitId: u.id, to: to! }
            : { type: kind, unitId: u.id, to },
  };
}
function validate(s: CombatDirectorState, a: Action): void {
  const u = get(s, a.unitId);
  if (!u || !canAct(u)) throw new Error("Combatant cannot act.");
  if (a.tactical && s.tactical) {
    const invalid = validateTacticalUnitAction(s.tactical, u as TacticalUnit, a.tactical);
    if (invalid) throw new Error(invalid.error);
  } else if (a.classic) {
    if (a.classic.type === "flee") throw new Error("Unsupported action in this window.");
    const skill = skillFor(s, a);
    if (a.classic.type === "skill" && (!skill || skill.reaction || !ready(s, u, skill)))
      throw new Error("Skill unavailable.");
    if (a.classic.type === "skill" || a.classic.type === "attack") {
      const target = get(s, a.classic.targetId);
      const allied = skill?.type === "heal" || skill?.type === "buff";
      if (!target || target.hp <= 0 || (side(target) === side(u)) !== !!allied) throw new Error("Invalid target.");
    }
  } else throw new Error("Missing action.");
  const itemName =
    a.classic?.type === "item" ? a.classic.itemId : a.tactical?.type === "item" ? a.tactical.itemName : undefined;
  if (itemName) {
    const item = s.inventory.find((i) => i.name === itemName && i.quantity > 0),
      effect = s.itemEffects.find((i) => i.name === itemName);
    const targetId =
      a.classic?.type === "item" ? a.classic.targetId : a.tactical?.type === "item" ? a.tactical.targetId : undefined;
    const target = get(s, targetId ?? u.id);
    if (!item || !effect || !target || target.hp <= 0 || side(u) !== "party") throw new Error("Item unavailable.");
    if (
      (effect.target === "self" && target.id !== u.id) ||
      (effect.target === "enemy" && side(target) === side(u)) ||
      (effect.target === "ally" && side(target) !== side(u))
    )
      throw new Error("Invalid item target.");
  }
}
function options(s: CombatDirectorState, u: Unit, legendary = false): Candidate[] {
  const all: Candidate[] = [];
  const add = (
    action: Action,
    kind: Candidate["kind"],
    targetId?: string,
    skill?: CombatSkill,
    to?: { x: number; y: number },
  ) => {
    const cost = !legendary
      ? 0
      : (skill?.legendaryCost ??
        (kind === "attack"
          ? u.boss?.attackCost
          : kind === "defend"
            ? u.boss?.defendCost
            : kind === "move"
              ? u.boss?.moveCost
              : undefined));
    if (cost === undefined || cost > (s.budgets[u.id]?.legendary ?? 0)) return;
    try {
      validate(s, action);
    } catch {
      return;
    }
    all.push({
      id: String(all.length),
      kind,
      actorId: u.id,
      targetId,
      skillName: skill?.name,
      mpCost: skill?.slotLevel ? 0 : (skill?.mpCost ?? 0),
      slotLevel: skill?.slotLevel,
      legendaryCost: cost,
      action,
      skillId: skill?.id,
      to,
    });
  };
  const t = s.tactical;
  const savedMoved = t ? (u as TacticalUnit).hasMoved : false;
  if (legendary && t) (u as TacticalUnit).hasMoved = false;
  const tiles = t
    ? savedMoved && !legendary
      ? [{ x: (u as TacticalUnit).x, y: (u as TacticalUnit).y }]
      : getMovementRange(t, u.id)
    : [undefined];
  // Keep useful action families, with the current tile first and at most one destination per target/skill.
  if (t)
    tiles.sort(
      (a, b) =>
        Math.abs(a!.x - (u as TacticalUnit).x) +
        Math.abs(a!.y - (u as TacticalUnit).y) -
        Math.abs(b!.x - (u as TacticalUnit).x) -
        Math.abs(b!.y - (u as TacticalUnit).y),
    );
  for (const skill of [undefined, ...(u.skills ?? []).filter((k) => !k.reaction && ready(s, u, k))]) {
    for (const target of living(s)) {
      const allied = skill?.type === "heal" || skill?.type === "buff";
      if ((side(target) === side(u)) !== !!allied) continue;
      for (const tile of tiles) {
        const before = all.length;
        add(
          asAction(s, u, skill ? "skill" : "attack", target.id, skill, tile),
          skill ? "skill" : "attack",
          target.id,
          skill,
          tile,
        );
        if (all.length > before) break;
      }
    }
  }
  add(asAction(s, u, "defend"), "defend");
  if (t && !legendary) {
    const approach = decideTacticalAction(structuredClone(t), structuredClone(u as TacticalUnit));
    if (approach.type === "wait" || approach.type === "move")
      add({ unitId: u.id, tactical: approach }, "wait", undefined, undefined, approach.to);
  }
  if (t && legendary) {
    for (const tile of tiles
      .filter(Boolean)
      .filter((p) => p!.x !== (u as TacticalUnit).x || p!.y !== (u as TacticalUnit).y)
      .filter((_, i, a) => i === 0 || i === a.length - 1 || i === Math.floor(a.length / 2)))
      add(asAction(s, u, "move", undefined, undefined, tile), "move", undefined, undefined, tile);
  }
  if (t) (u as TacticalUnit).hasMoved = savedMoved;
  if (u.tactics?.adjective === "mindless") {
    const expected = t
      ? decideTacticalAction(structuredClone(t), structuredClone(u as TacticalUnit))
      : chooseClassicAction(
          u as Combatant,
          living(s).filter((c) => side(c) === side(u)) as Combatant[],
          living(s).filter((c) => side(c) !== side(u)) as Combatant[],
          s.round,
          s.difficulty,
          s.weather,
        );
    if (t && !legendary && (expected.type === "wait" || expected.type === "move")) {
      return [
        {
          id: "approach",
          kind: "wait",
          actorId: u.id,
          mpCost: 0,
          legendaryCost: 0,
          to: expected.to,
          action: { unitId: u.id, tactical: expected },
        },
      ];
    }
    const targetId = "targetId" in expected ? expected.targetId : undefined;
    return all.filter((c) => c.kind === "attack" && c.targetId === targetId).slice(0, 1);
  }
  // Preserve at least one option from every skill family before additional targets.
  const first = new Map<string, Candidate>();
  for (const c of all) if (!first.has(c.skillId ?? c.kind)) first.set(c.skillId ?? c.kind, c);
  return [...new Set([...first.values(), ...all])].slice(0, 16);
}
function pay(s: CombatDirectorState, u: Unit, k: CombatSkill) {
  if (!ready(s, u, k)) throw new Error("Resource or cooldown unavailable.");
  if (k.slotLevel) u.spellSlots![String(k.slotLevel)]!--;
  else u.mp = (u.mp ?? 0) - k.mpCost;
  u.skillCooldowns ??= {};
  u.skillCooldowns[cooldownKey(s, k)] = Math.max(0, k.cooldown ?? 0);
}
function open(
  s: CombatDirectorState,
  kind: CombatDecisionWindow["kind"],
  u: Unit,
  choices: Candidate[],
  triggerId?: string,
  pendingId?: string,
) {
  const id = `${s.id}:${++s.serial}`;
  const pass: Candidate = { id: "pass", kind: "pass", actorId: u.id, mpCost: 0, legendaryCost: 0 };
  s.choices = kind === "ordinary" ? choices : [...choices, pass];
  if (!s.choices.length) s.choices = [{ ...pass, kind: "wait", action: asAction(s, u, "wait") }];
  s.window = {
    id,
    kind,
    actorId: u.id,
    triggerActorId: triggerId,
    triggerSkillName: pendingId ? skillFor(s, s.pending[pendingId]!.action)?.name : undefined,
    controller: manual(s, u) ? "manual" : "gm",
    options: s.choices.map(({ action: _a, reaction: _r, skillId: _k, pendingId: _p, ...c }) => c),
  };
  s.stage = "decision";
}
function legendaryTasks(s: CombatDirectorState, trigger: Unit, kind: "anticipation" | "legendary"): Task[] {
  return living(s)
    .filter(
      (u) => u.id !== trigger.id && side(u) === "enemy" && u.boss && (kind !== "anticipation" || u.boss.anticipation),
    )
    .map((u) => ({ kind, unitId: u.id, triggerId: trigger.id }));
}
function declare(s: CombatDirectorState, action: Action, source: Source, reaction?: Candidate) {
  const u = get(s, action.unitId)!;
  const skill = reaction ? u.skills?.find((k) => k.id === reaction.skillId) : skillFor(s, action);
  if (!reaction) validate(s, action);
  // Move before declaring a spell so the reaction sees its actual casting location.
  if (s.tactical && action.tactical && "to" in action.tactical && action.tactical.to) {
    const to = action.tactical.to,
      tu = u as TacticalUnit;
    if (to.x !== tu.x || to.y !== tu.y)
      performTacticalUnitAction(s.tactical, tu, { type: "move", unitId: u.id, to }, []);
    action = structuredClone(action);
    delete (action.tactical as { to?: unknown }).to;
  }
  if (skill) pay(s, u, skill);
  const itemName =
    action.classic?.type === "item"
      ? action.classic.itemId
      : action.tactical?.type === "item"
        ? action.tactical.itemName
        : undefined;
  if (itemName) {
    const item = s.inventory.find((i) => i.name === itemName)!,
      effect = s.itemEffects.find((i) => i.name === itemName)!;
    if (effect.consumes !== false) {
      item.quantity--;
      s.itemSpends[itemName] = (s.itemSpends[itemName] ?? 0) + 1;
    }
    if (action.classic?.type === "item") action.classic.itemEffect = effect;
  }
  const id = `p${++s.serial}`;
  s.pending[id] = {
    id,
    action,
    skillId: skill?.id,
    source,
    reaction: reaction?.reaction,
    parentId: reaction?.pendingId,
  };
  const reacts: Task[] =
    Object.keys(s.pending).length > 40
      ? []
      : living(s)
          .filter((r) => r.id !== u.id && (s.budgets[r.id]?.reaction ?? 0) > 0)
          .map((r) => ({ kind: "react", unitId: r.id, pendingId: id }));
  s.tasks.unshift(...reacts, { kind: "effect", pendingId: id });
  log(
    s,
    skill ? `${u.name} begins ${skill.name}.` : `${u.name} prepares an action.`,
    "declaration",
    u.id,
    source,
    skill
      ? { key: "game.combat.event.beginSkill", params: { actor: u.name, skill: skill.name } }
      : { key: "game.combat.event.prepare", params: { actor: u.name } },
  );
}
function threatenedTargets(s: CombatDirectorState, p: Pending): Unit[] {
  const caster = get(s, p.action.unitId)!;
  const skill = caster.skills?.find((k) => k.id === p.skillId);
  const action = p.action.classic ?? p.action.tactical!;
  const target = "targetId" in action && action.targetId ? get(s, action.targetId) : undefined;
  if (!target) return [];
  if (!s.tactical && skill?.type === "attack" && skill.targetScope === "all-enemies")
    return living(s).filter((u) => side(u) !== side(caster));
  if (s.tactical && skill?.type === "attack" && skill.areaRadius) {
    const center = target as TacticalUnit;
    return living(s).filter(
      (u) =>
        (skill.friendlyFire || side(u) !== side(caster)) &&
        Math.abs((u as TacticalUnit).x - center.x) + Math.abs((u as TacticalUnit).y - center.y) <= skill.areaRadius!,
    );
  }
  return [target];
}
function reactionOptions(s: CombatDirectorState, u: Unit, p: Pending): Candidate[] {
  const caster = get(s, p.action.unitId),
    skill = caster?.skills?.find((k) => k.id === p.skillId);
  if (!caster || p.cancelled || !canAct(u) || (s.budgets[u.id]?.reaction ?? 0) <= 0) return [];
  const choices: Candidate[] = [];
  for (const k of (u.skills ?? []).filter((k) => k.reaction && ready(s, u, k))) {
    const action = p.action.classic ?? p.action.tactical!;
    const targets =
      k.reaction === "counterspell"
        ? skill?.spell && side(caster) !== side(u)
          ? [caster]
          : []
        : !p.reaction && (action.type === "attack" || skill?.type === "attack") && side(caster) !== side(u)
          ? threatenedTargets(s, p).filter((t) => side(t) === side(u))
          : [];
    for (const target of targets) {
      if (s.tactical) {
        const a = u as TacticalUnit,
          b = target as TacticalUnit;
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > (k.range ?? 2)) continue;
        // Reactions require an unobstructed grid ray; ordinary ranged attacks retain legacy rules.
        const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        let blocked = false;
        for (let i = 1; i < steps; i++)
          if (
            s.tactical.grid.tiles[Math.round(a.y + ((b.y - a.y) * i) / steps)]?.[
              Math.round(a.x + ((b.x - a.x) * i) / steps)
            ] === "wall"
          )
            blocked = true;
        if (blocked) continue;
      }
      choices.push({
        id: String(choices.length),
        kind: "skill",
        actorId: u.id,
        targetId: target.id,
        skillId: k.id,
        skillName: k.name,
        mpCost: k.slotLevel ? 0 : k.mpCost,
        slotLevel: k.slotLevel,
        legendaryCost: 0,
        reaction: k.reaction,
        pendingId: p.id,
        action: asAction(s, u, "skill", target.id, k),
      });
    }
  }
  return choices;
}
// Positive values mean harm to this reactor's side. Countering a counter reverses that harm.
function reactionThreat(
  s: CombatDirectorState,
  p: Pending,
  u: Unit,
  targetId?: string,
  depth = 0,
): { value: number; lethal: boolean } {
  if (depth > 40 || p.cancelled) return { value: 0, lethal: false };
  if (p.reaction === "counterspell" && p.parentId && s.pending[p.parentId]) {
    const parent = reactionThreat(s, s.pending[p.parentId]!, u, undefined, depth + 1);
    return { value: -parent.value, lethal: parent.value < 0 && parent.lethal };
  }
  const caster = get(s, p.action.unitId)!;
  const skill = caster.skills?.find((k) => k.id === p.skillId);
  let value = 0,
    lethal = false;
  for (const target of threatenedTargets(s, p).filter((t) => !targetId || t.id === targetId)) {
    const allied = side(target) === side(u);
    if (skill?.type === "heal") {
      const heal = Math.min(target.maxHp - target.hp, caster.attack * skill.power + caster.level * 2);
      value += ((allied ? -1 : 1) * heal) / Math.max(1, target.hp);
    } else if (skill?.type === "buff" || skill?.type === "debuff") {
      value += (allied === (skill.type === "debuff") ? 1 : -1) * 0.5;
    } else {
      const forecast = s.tactical
        ? forecastTacticalAttack(s.tactical, caster as TacticalUnit, target as TacticalUnit, caster as TacticalUnit, {
            power: skill ? Math.max(1, skill.power) : 1,
            element: skill?.element ?? caster.element,
            traits: skill ?? caster,
          })
        : undefined;
      const estimate = forecast
        ? { damage: forecast.damage, hitProbability: forecast.hitChance / 100 }
        : estimateClassicAttack(caster, target, skill, s.difficulty, s.weather);
      value += (allied ? 1 : -1) * Math.min(2, estimate.damage / Math.max(1, target.hp)) * estimate.hitProbability;
      lethal ||= allied && estimate.damage >= target.hp && estimate.hitProbability > 0;
    }
  }
  return { value, lethal: value > 0 && lethal };
}
export function chooseDirectorFallback(s: CombatDirectorState): string {
  const w = s.window!;
  const u = get(s, w.actorId)!;
  if (w.kind === "ordinary") {
    const desired = s.tactical
      ? decideTacticalAction(s.tactical, u as TacticalUnit)
      : chooseClassicAction(
          u as Combatant,
          living(s).filter((x) => side(x) === side(u)) as Combatant[],
          living(s).filter((x) => side(x) !== side(u)) as Combatant[],
          s.round,
          s.difficulty,
          s.weather,
        );
    const match = s.choices.find(
      (c) =>
        c.kind === desired.type &&
        (!("targetId" in desired) || c.targetId === desired.targetId) &&
        (!("skillId" in desired) || c.skillId === desired.skillId) &&
        (!("skillName" in desired) || c.skillName === desired.skillName),
    );
    return (match ?? s.choices.find((c) => c.kind === "attack") ?? s.choices[0])!.id;
  }
  if (w.kind !== "reaction") return "pass";
  const style = u.tactics?.adjective;
  const threshold = style === "reckless" ? 0.15 : style === "patient" || style === "cautious" ? 0.65 : 0.35;
  const difficulty = side(u) === "enemy" ? normalizeGameDifficulty(s.difficulty) : "normal";
  const noise = (index: number) => (u.tactics ? combatAiScoreNoise(u.tactics, u.id, w.id, index, difficulty) : 0);
  let best = { id: "pass", score: threshold + noise(0) };
  let candidateIndex = 0;
  for (const c of s.choices.filter((c) => c.reaction)) {
    const p = s.pending[c.pendingId!]!;
    const threat = reactionThreat(s, p, u, c.reaction === "guard" ? c.targetId : undefined);
    if (threat.value <= 0) continue;
    const scarcity = c.slotLevel
      ? 1 / Math.max(1, u.spellSlots?.[String(c.slotLevel)] ?? 0)
      : c.mpCost / Math.max(1, u.mp ?? 0);
    const score =
      threat.value +
      (threat.lethal ? 2 : 0) +
      (style === "protective" && threat.value > 0 ? 0.35 : 0) -
      scarcity * 0.3 +
      noise(++candidateIndex);
    if (score > best.score) best = { id: c.id, score };
  }
  return best.id;
}
function takeChoice(s: CombatDirectorState, id: string, source: Source) {
  const w = s.window!,
    c = s.choices.find((c) => c.id === id);
  if (!c) throw new Error("Unknown decision option.");
  const u = get(s, w.actorId)!;
  if (!canAct(u)) throw new Error("Combatant cannot react.");
  s.window = undefined;
  s.choices = [];
  s.stage = "select";
  if (c.kind === "pass") {
    log(s, `${u.name} holds its response.`, w.kind, u.id, source, {
      key: "game.combat.event.hold",
      params: { actor: u.name },
    });
    return;
  }
  if (c.reaction) {
    if (
      !reactionOptions(s, u, s.pending[c.pendingId!]!).some((k) => k.skillId === c.skillId && k.targetId === c.targetId)
    )
      throw new Error("Reaction no longer available.");
    s.budgets[u.id]!.reaction--;
    declare(s, c.action!, source, c);
  } else if (w.kind === "ordinary") declare(s, c.action!, source);
  else {
    if (c.legendaryCost > (s.budgets[u.id]?.legendary ?? 0)) throw new Error("Legendary budget exhausted.");
    s.budgets[u.id]!.legendary -= c.legendaryCost;
    const tu = s.tactical ? (u as TacticalUnit) : undefined;
    const moved = tu?.hasMoved,
      acted = tu?.hasActed;
    if (tu) {
      tu.hasMoved = false;
      tu.hasActed = false;
    }
    // Restore ordinary flags after the extra action, including when it is countered.
    declare(s, c.action!, source);
    const pending = Object.values(s.pending).at(-1)!;
    pending.flags = tu ? [moved!, acted!] : undefined;
    log(s, `${u.name} spends ${c.legendaryCost} legendary point(s).`, w.kind, u.id, source, {
      key: "game.combat.event.legendary",
      params: { actor: u.name, count: c.legendaryCost },
    });
  }
}
function effect(s: CombatDirectorState, p: Pending) {
  const u = get(s, p.action.unitId)!;
  if (!p.cancelled && canAct(u)) {
    if (p.reaction) {
      const parent = s.pending[p.parentId!];
      if (parent && !parent.cancelled) {
        if (p.reaction === "counterspell") {
          const caster = get(s, parent.action.unitId)!;
          const chance = Math.max(0.2, Math.min(0.95, 0.65 + (u.level - caster.level) * 0.03));
          const success = combatAiHash(`${s.seed}:counter:${++s.serial}`) / 0x100000000 < chance;
          parent.cancelled = success;
          log(
            s,
            `${u.name}'s counter ${success ? "interrupts the spell" : "fails"}.`,
            "reaction",
            u.id,
            p.source,
            success
              ? { key: "game.combat.event.counterSuccess", params: { actor: u.name } }
              : { key: "game.combat.event.counterFailure", params: { actor: u.name } },
          );
        } else {
          const a = p.action;
          const target =
            a.classic && "targetId" in a.classic
              ? a.classic.targetId
              : a.tactical && "targetId" in a.tactical
                ? a.tactical.targetId
                : undefined;
          if (target) (parent.guarded ??= []).push(target);
          log(s, `${u.name} guards an ally.`, "reaction", u.id, p.source, {
            key: "game.combat.event.guard",
            params: { actor: u.name },
          });
        }
      }
    } else if (s.tactical && p.action.tactical?.type === "item") {
      const action = p.action.tactical;
      const combatants = s.tactical.units.map((c) => ({
        ...c,
        side: side(c) === "party" ? ("player" as const) : ("enemy" as const),
      }));
      resolveCombatRound(combatants, s.round, s.difficulty, undefined, undefined, undefined, undefined, undefined, {
        weather: s.weather,
        actorId: u.id,
        action: {
          type: "item",
          itemId: action.itemName,
          targetId: action.targetId,
          itemEffect: s.itemEffects.find((i) => i.name === action.itemName),
        },
        defendingIds: new Set(),
      });
      for (const c of combatants) {
        const target = get(s, c.id)!;
        target.hp = c.hp;
        target.statusEffects = c.statusEffects;
      }
      log(s, `${u.name} uses ${action.itemName}.`, "item", u.id, p.source, {
        key: "game.combat.event.item",
        params: { actor: u.name, item: action.itemName },
      });
    } else if (s.tactical && p.action.tactical) {
      const guarded = (p.guarded ?? []).map((id) => get(s, id) as TacticalUnit).filter(Boolean);
      const prior = guarded.map((x) => x.defending);
      guarded.forEach((x) => (x.defending = true));
      const events: TacticalCombatState["log"] = [];
      performTacticalUnitAction(s.tactical, u as TacticalUnit, p.action.tactical, events, !!p.skillId);
      guarded.forEach((x, i) => (x.defending = prior[i]!));
      for (const e of events) log(s, e.text, e.kind, e.actorId, p.source, e.message);
    } else if (p.action.classic) {
      const defended = new Set([...s.defending, ...(p.guarded ?? [])]);
      const skill = u.skills?.find((k) => k.id === p.skillId);
      const targets =
        p.action.classic.type === "skill" && skill?.type === "attack" && skill.targetScope === "all-enemies"
          ? living(s)
              .filter((c) => side(c) !== side(u))
              .map((c) => c.id)
          : [undefined];
      const results = targets.map((targetId) =>
        resolveCombatRound(
          [...s.party, ...s.enemies],
          s.round,
          s.difficulty,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            weather: s.weather,
            actorId: u.id,
            action:
              targetId && p.action.classic?.type === "skill" ? { ...p.action.classic, targetId } : p.action.classic!,
            defendingIds: defended,
            prepaid: !!p.skillId,
          },
        ),
      );
      const result = { actions: results.flatMap((r) => r.actions) };
      if (p.action.classic.type === "defend") {
        if (!s.defending.includes(u.id)) s.defending.push(u.id);
        log(s, `${u.name} braces for impact.`, "defend", u.id, p.source, {
          key: "game.combat.event.defend",
          params: { actor: u.name },
        });
      }
      for (const a of result.actions)
        log(
          s,
          `${u.name}: ${a.skillName ?? p.action.classic.type} → ${get(s, a.defenderId)?.name ?? a.defenderId} (${a.isHeal ? "+" : "−"}${a.finalDamage} HP).`,
          "action",
          u.id,
          p.source,
          {
            key: a.skillName ? "game.combat.event.action" : "game.combat.event.attack",
            params: {
              actor: u.name,
              skill: a.skillName ?? "",
              target: get(s, a.defenderId)?.name ?? a.defenderId,
              amount: `${a.isHeal ? "+" : "−"}${a.finalDamage}`,
            },
          },
        );
    }
  } else
    log(s, `${u.name}'s action is interrupted.`, "interrupted", u.id, p.source, {
      key: "game.combat.event.interrupted",
      params: { actor: u.name },
    });
  if (s.tactical && !p.reaction) {
    const flags = p.flags;
    if (flags) {
      (u as TacticalUnit).hasMoved = flags[0];
      (u as TacticalUnit).hasActed = flags[1];
    } else if (p.action.tactical?.type !== "move") (u as TacticalUnit).hasActed = true;
  }
  delete s.pending[p.id];
  sync(s);
}
export function advanceCombatDirector(s: CombatDirectorState) {
  // A ruleset fight has no task queue of its own: one command resolves one step through the shared
  // resolver, and the whole of it lives in `ruleset-combat-director.service.ts`.
  if (s.style === "ruleset") return;
  for (let guard = 0; guard < 20000 && !s.outcome; guard++) {
    sync(s);
    if (s.outcome || s.window) return;
    const task = s.tasks.shift();
    if (!task) {
      s.actorId = undefined;
      if (s.tactical) {
        const remaining = living(s).filter((u) => !(u as TacticalUnit).hasActed);
        const party = remaining.filter((u) => side(u) === "party");
        if (!s.skipParty && party.some((u) => manual(s, u))) {
          s.tactical.phase = "player";
          s.stage = "select";
          return;
        }
        const next = (party.length ? party : remaining).sort(
          (a, b) => b.speed - a.speed || a.id.localeCompare(b.id),
        )[0];
        if (next) {
          s.tasks.push({ kind: "activate", unitId: next.id });
          continue;
        }
        const events: TacticalCombatState["log"] = [];
        tickTacticalRound(s.tactical, events);
        for (const e of events) log(s, e.text, e.kind, e.actorId, undefined, e.message);
        s.tactical.round++;
        s.round++;
        s.skipParty = false;
        s.gmCalls = 0;
      } else {
        const next = s.order.shift();
        if (next) {
          s.tasks.push({ kind: "activate", unitId: next });
          continue;
        }
        const roundResult = resolveCombatRound(
          [...s.party, ...s.enemies],
          s.round,
          s.difficulty,
          undefined,
          undefined,
          s.mechanics,
          undefined,
          undefined,
          {
            actorId: "",
            action: { type: "defend" },
            defendingIds: new Set(s.defending),
            finishRound: true,
            weather: s.weather,
          },
        );
        for (const action of roundResult.actions)
          log(
            s,
            `${get(s, action.attackerId)?.name ?? action.attackerId}: ${action.skillName ?? "round effect"} → ${get(s, action.defenderId)?.name ?? action.defenderId} (${action.finalDamage} HP).`,
            "mechanic",
            action.attackerId,
            undefined,
            {
              key: "game.combat.event.roundEffect",
              params: {
                actor: get(s, action.attackerId)?.name ?? action.attackerId,
                effect: action.skillName ?? "",
                target: get(s, action.defenderId)?.name ?? action.defenderId,
                amount: action.finalDamage,
              },
            },
          );
        for (const tick of roundResult.statusTicks)
          log(
            s,
            `${get(s, tick.id)?.name ?? tick.id}: ${tick.effect} ${tick.expired ? "ends" : "continues"}.`,
            "status",
            tick.id,
            undefined,
            tick.expired
              ? {
                  key: "game.combat.event.statusEnds",
                  params: { actor: get(s, tick.id)?.name ?? tick.id, effect: tick.effect },
                }
              : {
                  key: "game.combat.event.statusContinues",
                  params: { actor: get(s, tick.id)?.name ?? tick.id, effect: tick.effect },
                },
          );
        s.round++;
        s.defending = [];
        s.gmCalls = 0;
        s.order = rollInitiative(living(s) as Combatant[]).map((e) => e.id);
        if (!living(s).some(canAct)) {
          s.stage = "select";
          return;
        }
      }
      continue;
    }
    if (task.kind === "effect") {
      if (s.pending[task.pendingId]) effect(s, s.pending[task.pendingId]!);
      continue;
    }
    const u = get(s, task.unitId);
    if (!u || !canAct(u)) {
      if (task.kind === "activate" && u && s.tactical) (u as TacticalUnit).hasActed = true;
      continue;
    }
    if (task.kind === "activate") {
      s.actorId = u.id;
      s.budgets[u.id] = { reaction: 1, legendary: u.boss?.points ?? 0 };
      s.defending = s.defending.filter((id) => id !== u.id);
      if (s.tactical) {
        s.tactical.phase = side(u) === "party" ? "player" : "enemy";
        (u as TacticalUnit).defending = false;
      }
      s.tasks.unshift(
        ...legendaryTasks(s, u, "anticipation"),
        { kind: "act", unitId: u.id },
        { kind: "end", unitId: u.id },
      );
    } else if (task.kind === "end") {
      s.actorId = undefined;
      s.tasks.unshift(...legendaryTasks(s, u, "legendary"));
    } else if (task.kind === "act") {
      if (manual(s, u) && !s.skipParty) {
        s.stage = "action";
        return;
      }
      if (manual(s, u) && s.skipParty) {
        declare(s, asAction(s, u, "wait"), "ai");
        continue;
      }
      if (u.boss && s.gm) {
        open(s, "ordinary", u, options(s, u));
        if (s.choices.length === 1) {
          takeChoice(s, s.choices[0]!.id, "ai");
          continue;
        }
        return;
      }
      const action = s.tactical
        ? {
            unitId: u.id,
            tactical: decideTacticalAction(s.tactical, u as TacticalUnit) as Extract<
              TacticalAction,
              { unitId: string }
            >,
          }
        : {
            unitId: u.id,
            classic: chooseClassicAction(
              u as Combatant,
              living(s).filter((x) => side(x) === side(u)) as Combatant[],
              living(s).filter((x) => side(x) !== side(u)) as Combatant[],
              s.round,
              s.difficulty,
              s.weather,
            ) as CombatPlayerAction,
          };
      try {
        declare(s, action, "ai");
      } catch {
        declare(s, asAction(s, u, "wait"), "fallback");
      }
    } else if (task.kind === "react") {
      const p = s.pending[task.pendingId];
      if (!p) continue;
      const choices = reactionOptions(s, u, p);
      if (!choices.length) continue;
      open(s, "reaction", u, choices, p.action.unitId, p.id);
      if (manual(s, u) || (u.boss && s.gm)) return;
      takeChoice(s, chooseDirectorFallback(s), "ai");
    } else if ((task.kind === "anticipation" || task.kind === "legendary") && (s.budgets[u.id]?.legendary ?? 0) > 0) {
      const choices = options(s, u, true);
      if (!choices.length) continue;
      open(s, task.kind, u, choices, task.triggerId);
      if (s.gm) return;
      takeChoice(s, "pass", "fallback");
    }
  }
  if (!s.outcome) throw new Error("Combat transition budget exceeded.");
}
export function commandCombatDirector(s: CombatDirectorState, command: DirectedCommand, source: Source = "manual") {
  // The third style is commanded through its own service, which needs the ruleset this fight is
  // resolved by. Nothing here could answer for it.
  if (s.style === "ruleset") throw new Error("A ruleset fight is commanded through its own service.");
  if (s.outcome) throw new Error("Battle already finished.");
  if ((command.type === "classic" || command.type === "tactical") && command.type !== s.style)
    throw new Error("Action does not match this combat mode.");
  if (command.type === "flee") {
    s.outcome = "flee";
    sync(s);
    return;
  }
  if (command.type === "control") {
    const u = get(s, command.unitId);
    if (!u || side(u) !== "party" || s.window || s.actorId === u.id)
      throw new Error("Controller cannot change during an activation.");
    if (living(s).find((c) => side(c) === "party")?.id === u.id && command.controller === "ai")
      throw new Error("The leader stays manual.");
    u.controller = command.controller;
    if (s.stage !== "action") advanceCombatDirector(s);
    sync(s);
    return;
  }
  if (command.type === "choose" || command.type === "fallback") {
    if (!s.window) throw new Error("No decision is pending.");
    takeChoice(
      s,
      command.type === "fallback" ? chooseDirectorFallback(s) : command.candidateId,
      command.type === "fallback" ? "fallback" : source,
    );
  } else if (command.type === "begin") {
    if (s.stage !== "select" || !s.tactical) throw new Error("An activation is already committed.");
    const u = get(s, command.unitId);
    if (!u || side(u) !== "party" || (u as TacticalUnit).hasActed || !canAct(u)) throw new Error("Unit unavailable.");
    s.tasks.push({ kind: "activate", unitId: u.id });
  } else if (command.type === "tactical" && command.action.type === "endTurn") {
    if (s.window) throw new Error("Resolve the interruption first.");
    s.skipParty = true;
    if (s.actorId) declare(s, asAction(s, get(s, s.actorId)!, "wait"), "manual");
  } else if (command.type === "classic" || command.type === "tactical") {
    if (s.stage !== "action" || s.window || !s.actorId) throw new Error("Wait for the active unit.");
    const a: Action =
      command.type === "classic"
        ? { unitId: s.actorId, classic: command.action }
        : { unitId: s.actorId, tactical: command.action as Extract<TacticalAction, { unitId: string }> };
    if (a.tactical?.unitId !== undefined && a.tactical.unitId !== s.actorId) throw new Error("Another unit is active.");
    validate(s, a);
    if (a.tactical?.type === "move") {
      performTacticalUnitAction(s.tactical!, get(s, s.actorId) as TacticalUnit, a.tactical, []);
      sync(s);
      return;
    }
    declare(s, a, "manual");
  } else if (command.type === "continue") {
    if (s.stage === "action" || (s.stage === "select" && s.tactical) || s.window) return;
  }
  s.stage = "select";
  advanceCombatDirector(s);
}
