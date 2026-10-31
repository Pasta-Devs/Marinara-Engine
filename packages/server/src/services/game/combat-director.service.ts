import {
  normalizeGameDifficulty,
  combatAiScoreNoise,
  type CombatWeather,
  type WorldElementSet,
  forecastTacticalAttack,
  hasLineOfSight,
} from "@marinara-engine/shared";
import {
  assignCombatTactics,
  combatAiHash,
  shiftCombatTemperament,
  createTacticalCombat,
  currentTacticalActor,
  getMovementRange,
  validateTacticalUnitAction,
  performTacticalUnitAction,
  tickTacticalRound,
  summarizeTacticalBattlefield,
  decideTacticalAction,
  decideProfileAction,
  type CombatAiScoreParts,
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
  type TacticalMadeBattlefield,
  type TacticalTurnOrder,
  type RulesetCombatBoard,
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
  /** What the win dropped into the party's bags, once it is won: set on the step that wins, so a fight
   *  drops its loot once. Empty when it dropped nothing. */
  loot?: Array<{ name: string; quantity: number; left?: number }>;
  anchor: string;
  gm: boolean;
  /** The Game Master plays the named and the brilliant opponents as well as the bosses (combat AI P9). */
  gmNamed?: boolean;
  /** The Game Master plays every opponent (1.774): the game's ruleset gives it the opposition. */
  gmAll?: boolean;
  /** The game lets a cruel opponent strike those already down (combat AI T3). */
  cruel?: boolean;
  /** The party gave itself up to honourable opponents (combat AI T6): a defeat nobody died of. */
  yielded?: true;
  /** Called off with both sides standing, after rounds in which nothing changed (K8). */
  stalled?: true;
  difficulty: string;
  weather?: CombatWeather;
  /** The game's elements (worldgen W6c); the classic six when absent. */
  elements?: WorldElementSet;
  seed: number;
  serial: number;
  tasks: Task[];
  pending: Record<string, Pending>;
  choices: Candidate[];
  order: string[];
  defending: string[];
  skipParty: boolean;
  mechanics: CombatMechanic[];
  /** One line per item, shown by `name`. `ownName` is the item's own name when `name` is a nickname:
   *  what a spend is taken by, so a nickname never spends another item. */
  /** One line per item the fight offers. `item` names one of the ruleset's items; one that holds
   *  charges counts its uses in `quantity` (#6909). */
  inventory: Array<{ name: string; quantity: number; description?: string; ownName?: string; item?: string }>;
  itemEffects: CombatItemEffect[];
  itemSpends: Record<string, number>;
  /** How many times each item drawn as it is used (1.808) was used, by its line's name: each new use
   *  draws one of it as the step is saved. Absent in a save from before it. */
  itemDraws?: Record<string, number>;
  requests: string[];
  gmCalls: number;
  /** The `ruleset` style's whole fight. Present exactly when the style is `ruleset`; everything
   *  that reads or changes it lives in `ruleset-combat-director.service.ts`. */
  rulesetFight?: RulesetFightState;
  /** How each opponent takes a fight turning against it (combat AI E1), read as the fight starts: its
   *  morale score (none for a boss or the mindless, which never break), whether its side follows it,
   *  whether it was caught unaware, what has shaken it already, and whether it is running. Absent on
   *  fights saved before morale, which nobody breaks in. */
  morale?: Record<
    string,
    { score?: number; leader?: true; surprised?: true; checked?: MoraleTrigger[]; routed?: true }
  >;
  /** Opponents out of the fight alive (combat AI E1): run off the board, or given up to the party. */
  gone?: Array<{ id: string; name: string; hp: number; maxHp: number; left: "fled" | "surrendered" }>;
}
/** What shakes an opponent (combat AI E1), each checked once, in this order, as one of its turns
 *  starts: being caught unaware, its leader falling, half its side down, the first of its side down,
 *  and being hurt below half its health. */
const MORALE_TRIGGERS = ["surprised", "leader-down", "half-down", "first-fall", "hurt"] as const;
type MoraleTrigger = (typeof MORALE_TRIGGERS)[number];
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
/** Whether the Game Master plays this opponent's turns: a boss, and in a game that asks for it a named
 *  or a brilliant one (combat AI P9), or every one where the ruleset gives it the opposition (1.774). */
const gmPlays = (s: CombatDirectorState, u: Unit) =>
  s.gm &&
  (!!u.boss ||
    (!!s.gmAll && side(u) === "enemy") ||
    (!!s.gmNamed &&
      side(u) === "enemy" &&
      (("aiHints" in u && u.aiHints?.named === true) || u.tactics?.mind === "genius")));
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
/** What the Game Master is told of a ruleset fight's board: as a tactical one, its scene when painted. */
function rulesetBoardSummary(board: RulesetCombatBoard | undefined, seed: number): string | undefined {
  if (!board?.battlefield) return undefined;
  const scene = board.battlefield.kind === "hand-made" ? board.battlefield.scene : undefined;
  return summarizeTacticalBattlefield({ ...board, seed, ...(scene ? { environment: scene } : {}) });
}
function sync(s: CombatDirectorState) {
  if (s.tactical) {
    const convert = (u: TacticalUnit): Combatant => ({ ...u, side: side(u) === "party" ? "player" : "enemy" });
    s.party = s.tactical.units.filter((u) => u.side === "party").map(convert);
    s.enemies = s.tactical.units.filter((u) => u.side === "enemy").map(convert);
    s.tactical.log = s.log.map((e) => ({ kind: "status", text: e.text, actorId: e.actorId, message: e.message }));
  }
  // A ruleset fight's outcome is the ruleset's own (syncRulesetCombatants): a hero at 0 who is still
  // rolling to live keeps it going, though no unit has hit points left (cloud re-test 2026-10-26).
  if (s.style !== "ruleset") {
    if (!living(s).some((u) => side(u) === "enemy")) s.outcome = "victory";
    else if (!living(s).some((u) => side(u) === "party")) s.outcome = "defeat";
  }
  if (s.outcome) {
    s.stage = "finished";
    s.window = undefined;
    s.tasks = [];
    s.pending = {};
    if (s.tactical) s.tactical.outcome = s.outcome === "flee" ? "fled" : s.outcome;
    s.summary = {
      outcome: s.outcome,
      rounds: s.round,
      ...(s.yielded ? { yielded: true as const } : {}),
      ...(s.stalled ? { stalled: true as const } : {}),
      // The board fought on, either style's: a ruleset's is the tactical style's own board.
      battlefieldSummary: s.tactical
        ? (summarizeTacticalBattlefield(s.tactical) ?? undefined)
        : rulesetBoardSummary(s.rulesetFight?.encounter.board, s.seed),
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
      enemies: [
        ...s.enemies.map((u) => ({ name: u.name, hp: u.hp, maxHp: u.maxHp, defeated: u.hp <= 0 })),
        // Out of it alive (combat AI E1): neither beaten nor still standing.
        ...(s.gone ?? []).map((u) => ({ name: u.name, hp: u.hp, maxHp: u.maxHp, defeated: false, left: u.left })),
      ],
      // Once a won fight has dropped its loot, even none, the summary says so: nothing drops it again.
      ...(s.loot ? { loot: s.loot.map((drop) => ({ ...drop })) } : {}),
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
  gmNamed?: boolean;
  gmAll?: boolean;
  cruel?: boolean;
  difficulty: string;
  weather?: CombatWeather;
  elements?: WorldElementSet;
  seed: number;
  environment?: string;
  formation?: string;
  battlefield?: TacticalBattlefieldBrief;
  /** A board painted for the fight's place (worldgen W9g), fought on as painted. */
  made?: TacticalMadeBattlefield;
  /** One unit at a time in a rolled order (combat C6c); by side when absent. */
  turnOrder?: TacticalTurnOrder;
  itemEffects?: CombatItemEffect[];
  mechanics?: CombatMechanic[];
  inventory?: CombatDirectorState["inventory"];
  /** Who the scene caught unaware: an opponent among them checks its morale on its first turn. */
  surprised?: string[];
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
    ...(input.gm && input.gmNamed ? { gmNamed: true } : {}),
    ...(input.gm && input.gmAll ? { gmAll: true } : {}),
    ...(input.cruel ? { cruel: true } : {}),
    difficulty: normalizeGameDifficulty(input.difficulty),
    weather: input.weather,
    ...(input.elements ? { elements: input.elements } : {}),
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
  if (s.style !== "ruleset") {
    s.morale = {};
    for (const u of enemies) {
      const score = moraleScore(u);
      s.morale[u.id] = {
        ...(score !== undefined ? { score } : {}),
        ...(u.aiHints?.leader || u.boss ? { leader: true as const } : {}),
        ...(input.surprised?.includes(u.id) ? { surprised: true as const } : {}),
      };
    }
  }
  if (s.style === "tactical")
    s.tactical = createTacticalCombat(party, enemies, {
      seed: s.seed,
      difficulty: s.difficulty,
      weather: s.weather,
      ...(s.elements ? { elements: s.elements } : {}),
      environment: input.environment,
      formation: input.formation,
      battlefield: input.battlefield,
      ...(input.made ? { made: input.made } : {}),
      ...(input.turnOrder ? { turnOrder: input.turnOrder } : {}),
    });
  for (const u of directorUnits(s))
    s.budgets[u.id] = { legendary: side(u) === "enemy" ? (u.boss?.points ?? 0) : 0, reaction: 1 };
  if (s.style === "classic") s.order = rollInitiative([...party, ...enemies]).map((e) => e.id);
  advanceCombatDirector(s);
  return s;
}
/**
 * An opponent's morale score (combat AI E1), on the old games' 2 to 12 scale: the story's, else read
 * off its mind (an animal's nerve is its nature, a planner's is steadier) and its temperament, one
 * more for a leader. None for a boss, whose story decides when it gives up, nor for the mindless.
 */
function moraleScore(u: Combatant): number | undefined {
  // Nor for a fanatic (combat AI T2), who never breaks.
  if (u.boss || u.tactics?.mind === "mindless" || u.tactics?.adjective === "fanatical") return undefined;
  if (u.aiHints?.morale !== undefined) return u.aiHints.morale;
  const mind = u.tactics?.mind ?? "tactical";
  const base = mind === "instinct" || mind === "cunning" ? 7 : mind === "genius" ? 9 : 8;
  const adjective = u.tactics?.adjective;
  const by =
    adjective === "cowardly"
      ? -3
      : adjective === "cautious"
        ? -1
        : adjective === "reckless" || adjective === "disciplined"
          ? 2
          : adjective === "protective"
            ? 1
            : 0;
  return Math.max(2, Math.min(12, base + by + (u.aiHints?.leader ? 1 : 0)));
}
/** Whether a unit stands on the tactical board's edge, where one running gets away. */
function atBoardEdge(s: CombatDirectorState, u: Unit): boolean {
  if (!s.tactical) return true;
  const t = u as TacticalUnit;
  const { width, height } = s.tactical.grid;
  return t.x <= 0 || t.y <= 0 || t.x >= width - 1 || t.y >= height - 1;
}
/** Out of the fight alive (combat AI E1): kept for the story, gone from the board and the turn order. */
function leaveFight(s: CombatDirectorState, u: Unit, left: "fled" | "surrendered") {
  (s.gone ??= []).push({ id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, left });
  if (s.tactical) s.tactical.units = s.tactical.units.filter((one) => one.id !== u.id);
  else s.enemies = s.enemies.filter((one) => one.id !== u.id);
  s.order = s.order.filter((id) => id !== u.id);
  s.defending = s.defending.filter((id) => id !== u.id);
  s.tasks = s.tasks.filter((task) => !("unitId" in task) || task.unitId !== u.id);
  if (s.actorId === u.id) s.actorId = undefined;
  const key = left === "fled" ? "game.combat.event.fled" : "game.combat.event.surrendered";
  const text = left === "fled" ? `${u.name} gets away from the fight.` : `${u.name} throws down its arms and gives up.`;
  log(s, text, "status", u.id, undefined, { key, params: { actor: u.name } });
}
/** One running walks for the board's edge, as far from the party as the way allows. */
function runForTheEdge(s: CombatDirectorState, u: Unit) {
  const t = u as TacticalUnit;
  const grid = s.tactical!.grid;
  const edge = (x: number, y: number) => Math.min(x, y, grid.width - 1 - x, grid.height - 1 - y);
  const foes = living(s).filter((one) => side(one) === "party") as TacticalUnit[];
  const room = (x: number, y: number) => Math.min(99, ...foes.map((one) => Math.abs(one.x - x) + Math.abs(one.y - y)));
  const best = getMovementRange(s.tactical!, u.id)
    .filter((cell) => edge(cell.x, cell.y) < edge(t.x, t.y))
    .sort((a, b) => edge(a.x, a.y) - edge(b.x, b.y) || room(b.x, b.y) - room(a.x, a.y) || a.y - b.y || a.x - b.x)[0];
  try {
    declare(s, asAction(s, u, "wait", undefined, undefined, best ? { x: best.x, y: best.y } : undefined), "ai");
  } catch {
    declare(s, asAction(s, u, "wait"), "fallback");
  }
}
/**
 * Whether an opponent loses heart as its turn starts (combat AI E1), as the old games' morale rule
 * has it: each trigger it has not yet been checked for and that has happened is checked now with two
 * dice, and a roll over its score breaks it. One that thinks at all gives up where it cannot get away
 * (an opponent beside it, or no board to run across); an animal, or one with room to run, runs, off
 * the board once a turn of its starts at the edge. True when its turn went on that.
 */
/** Turns its temperament as the story's `shifts` say (combat AI T7), as a turn of its starts. */
function shiftTurn(s: CombatDirectorState, u: Unit): void {
  // A board's units carry no story hints: those stay on the party and the opponents as given.
  const hintsOf = (one: Unit) => [...s.party, ...s.enemies].find((given) => given.id === one.id)?.aiHints;
  const ours = directorUnits(s).filter((one) => side(one) === side(u) && one.id !== u.id);
  // Only opponents leave a fight alive.
  const gone = side(u) === "enemy" ? (s.gone ?? []) : [];
  const at = u as TacticalUnit;
  const beside =
    !s.tactical ||
    living(s).some(
      (one) =>
        side(one) !== side(u) &&
        Math.abs((one as TacticalUnit).x - at.x) + Math.abs((one as TacticalUnit).y - at.y) <= 1,
    );
  shiftCombatTemperament(u.tactics, hintsOf(u)?.shifts, (trigger) =>
    trigger === "bloodied"
      ? u.hp < u.maxHp / 2
      : trigger === "ally-down"
        ? ours.some((one) => one.hp <= 0) || gone.length > 0
        : trigger === "leader-down"
          ? ours.some((one) => one.hp <= 0 && (!!hintsOf(one)?.leader || !!s.morale?.[one.id]?.leader))
          : u.hp < u.maxHp / 4 && beside,
  );
}
function moraleTurn(s: CombatDirectorState, u: Unit): boolean {
  const mine = s.morale?.[u.id];
  if (!mine || mine.score === undefined || side(u) !== "enemy") return false;
  if (mine.routed) {
    if (atBoardEdge(s, u)) leaveFight(s, u, "fled");
    else runForTheEdge(s, u);
    return true;
  }
  const ours = directorUnits(s).filter((one) => side(one) === "enemy");
  const fallen = [...ours.filter((one) => one.hp <= 0).map((one) => one.id), ...(s.gone ?? []).map((one) => one.id)];
  const total = ours.length + (s.gone?.length ?? 0);
  const happened = (trigger: MoraleTrigger) =>
    trigger === "surprised"
      ? !!mine.surprised
      : trigger === "leader-down"
        ? fallen.some((id) => id !== u.id && !!s.morale?.[id]?.leader)
        : trigger === "half-down"
          ? total > 1 && fallen.length * 2 >= total
          : trigger === "first-fall"
            ? fallen.length > 0
            : u.hp < u.maxHp / 2;
  for (const trigger of MORALE_TRIGGERS) {
    if (mine.checked?.includes(trigger) || !happened(trigger)) continue;
    mine.checked = [...(mine.checked ?? []), trigger];
    const hash = combatAiHash(`morale:${s.seed}:${u.id}:${trigger}`);
    const roll = (hash % 6) + 1 + ((hash >>> 8) % 6) + 1;
    if (roll <= mine.score) {
      log(s, `${u.name} holds its nerve.`, "status", u.id, undefined, {
        key: "game.combat.event.moraleHeld",
        params: { actor: u.name },
      });
      continue;
    }
    const at = u as TacticalUnit;
    const pinned =
      !s.tactical ||
      living(s).some(
        (one) =>
          side(one) === "party" &&
          Math.abs((one as TacticalUnit).x - at.x) + Math.abs((one as TacticalUnit).y - at.y) <= 1,
      );
    if ((u.tactics?.mind ?? "tactical") !== "instinct" && pinned) {
      leaveFight(s, u, "surrendered");
      return true;
    }
    log(s, `${u.name} loses heart and runs.`, "status", u.id, undefined, {
      key: "game.combat.event.moraleBreaks",
      params: { actor: u.name },
    });
    if (atBoardEdge(s, u)) {
      leaveFight(s, u, "fled");
      return true;
    }
    mine.routed = true;
    runForTheEdge(s, u);
    return true;
  }
  return false;
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
          s.elements,
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
  if (kind === "ordinary" && !manual(s, u)) suggestChoices(s, u);
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
/**
 * The Engine's own top picks for a Game Master's ordinary turn in Classic or Tactical (the same
 * suggestions a ruleset fight's Game Master is shown): the unit's own tactics' best three, each
 * marked on the matching choice with a short reason. The Game Master still chooses.
 */
function suggestChoices(s: CombatDirectorState, u: Unit): void {
  if (!u.tactics || u.tactics.adjective === "mindless") return;
  let ranking: Array<{ action: { type: string; targetId?: string; skillId?: string }; parts: CombatAiScoreParts }> = [];
  try {
    if (s.tactical) {
      const t = structuredClone(s.tactical);
      const unit = t.units.find((one) => one.id === u.id);
      if (!unit?.tactics) return;
      decideProfileAction(t, { ...unit, tactics: unit.tactics }, (ranked) => {
        ranking = ranked.map(({ candidate, parts }) => ({ action: candidate.action, parts }));
      });
    } else {
      const copy = structuredClone(u) as Combatant;
      chooseClassicAction(
        copy,
        living(s).filter((x) => side(x) === side(u)) as Combatant[],
        living(s).filter((x) => side(x) !== side(u)) as Combatant[],
        s.round,
        s.difficulty,
        s.weather,
        s.elements,
        (ranked) => {
          ranking = ranked.map(({ candidate, parts }) => ({ action: candidate.action, parts }));
        },
      );
    }
  } catch {
    return;
  }
  const marked = new Set<Candidate>();
  for (const { action, parts } of ranking) {
    if (marked.size >= 3) break;
    const match = s.choices.find(
      (c) =>
        !marked.has(c) &&
        c.kind === action.type &&
        (action.targetId === undefined || c.targetId === action.targetId) &&
        (action.skillId === undefined || c.skillId === action.skillId),
    );
    if (!match) continue;
    marked.add(match);
    const target = action.targetId ? get(s, action.targetId)?.name : undefined;
    match.suggested = { rank: marked.size, reason: combatSuggestionReason(parts, target, match.skillName) };
  }
}

/** Why the Engine would pick this, in a few words: the biggest parts of its score, largest first. */
function combatSuggestionReason(parts: CombatAiScoreParts, target?: string, skill?: string): string {
  const said: Record<keyof CombatAiScoreParts, string> = {
    damage: `damage${target ? ` to ${target}` : ""}`,
    finish: `likely takes ${target ?? "its target"} out of the fight`,
    healing: `heals ${target ?? "a friend"}`,
    support: `helps ${target ?? "its side"}`,
    setup: `weakens ${target ?? "the other side"} for what comes next`,
    risk: "puts itself in danger",
    cost: `spends ${skill ? `what ${skill} costs` : "a limited resource"}`,
    protection: "stands up for a friend under attack",
    coordination: `joins its side's attack${target ? ` on ${target}` : ""}`,
    focus: `${target ?? "its target"} is the one it most wants down`,
  };
  const reasons = (Object.entries(parts) as Array<[keyof CombatAiScoreParts, number]>)
    .filter(([, part]) => Math.abs(part) >= 0.05)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([key]) => said[key]);
  return reasons.length ? reasons.join("; ") : "holds its ground for a better moment";
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
    // One of the ruleset's items that holds charges is spent a use at a time, as one used up is.
    if (effect.consumes !== false || effect.charges) {
      item.quantity--;
      s.itemSpends[itemName] = (s.itemSpends[itemName] ?? 0) + 1;
    }
    // Drawn as it is used (1.808): put on as the step is saved.
    if (effect.draws) (s.itemDraws ??= {})[itemName] = (s.itemDraws[itemName] ?? 0) + 1;
    // The route rolled its gate for its user and says here when they failed it (#6909), and what the use
    // truly does when it comes out of a fake (1.79).
    const failed = (action.classic ?? action.tactical) as { failed?: string; truly?: CombatItemEffect } | undefined;
    const does = failed?.truly ?? effect;
    if (action.classic?.type === "item")
      action.classic.itemEffect = failed?.failed ? { ...does, failed: failed.failed } : does;
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
        Math.abs((u as TacticalUnit).x - center.x) + Math.abs((u as TacticalUnit).y - center.y) <= skill.areaRadius! &&
        // The blast spreads only as far as it sees from where it lands, as the engine resolves it.
        hasLineOfSight(s.tactical!.grid, center, u as TacticalUnit),
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
        // A reaction needs sight of its target, by the Engine's one sight test (combat C6).
        if (!hasLineOfSight(s.tactical.grid, a, b)) continue;
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
      // An area's cover is read from where it lands, as the engine rolls it.
      const action = p.action.tactical;
      const aimed =
        skill?.areaRadius && action && "targetId" in action && action.targetId ? get(s, action.targetId) : undefined;
      const forecast = s.tactical
        ? forecastTacticalAttack(s.tactical, caster as TacticalUnit, target as TacticalUnit, caster as TacticalUnit, {
            power: skill ? Math.max(1, skill.power) : 1,
            element: skill?.element ?? caster.element,
            traits: skill ?? caster,
            ...(aimed ? { coverFrom: { x: (aimed as TacticalUnit).x, y: (aimed as TacticalUnit).y } } : {}),
          })
        : undefined;
      const estimate = forecast
        ? { damage: forecast.damage, hitProbability: forecast.hitChance / 100 }
        : estimateClassicAttack(caster, target, skill, s.difficulty, s.weather, s.elements);
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
          s.elements,
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
      const effect =
        (action as { truly?: CombatItemEffect }).truly ?? s.itemEffects.find((i) => i.name === action.itemName);
      // A gate failed, or a fake that does nothing a fight can use (1.79): spent, and the log says why.
      const failed = (action as { failed?: string }).failed ?? effect?.failed;
      const combatants = s.tactical.units.map((c) => ({
        ...c,
        side: side(c) === "party" ? ("player" as const) : ("enemy" as const),
      }));
      resolveCombatRound(combatants, s.round, s.difficulty, s.elements, undefined, undefined, undefined, undefined, {
        weather: s.weather,
        actorId: u.id,
        action: {
          type: "item",
          itemId: action.itemName,
          targetId: action.targetId,
          itemEffect: effect && failed ? { ...effect, failed } : effect,
        },
        defendingIds: new Set(),
      });
      for (const c of combatants) {
        const target = get(s, c.id)!;
        target.hp = c.hp;
        target.statusEffects = c.statusEffects;
      }
      if (failed) log(s, failed, "item", u.id, p.source);
      else
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
          s.elements,
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
        if (a.note) log(s, a.note, "item", u.id, p.source);
        else
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
        // By initiative (combat C6c) the next unit is the order's, whoever commands it; by side the
        // party chooses among its own first, then everybody else goes by speed.
        const remaining = living(s).filter((u) => !(u as TacticalUnit).hasActed);
        const party = remaining.filter((u) => side(u) === "party");
        if (!s.tactical.initiative && !s.skipParty && party.some((u) => manual(s, u))) {
          s.tactical.phase = "player";
          s.stage = "select";
          return;
        }
        const next = s.tactical.initiative
          ? currentTacticalActor(s.tactical)
          : (party.length ? party : remaining).sort((a, b) => b.speed - a.speed || a.id.localeCompare(b.id))[0];
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
          s.elements,
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
      if (task.kind === "activate" && u && s.tactical) {
        (u as TacticalUnit).hasActed = true;
        // Its turn came and went: a guard lasts until its holder's own turn, taken or not (combat C6c).
        (u as TacticalUnit).defending = false;
        s.defending = s.defending.filter((id) => id !== u.id);
      }
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
      // Its temperament turned by what has happened (combat AI T7), before it decides anything.
      shiftTurn(s, u);
      // Losing heart comes first (combat AI E1): a broken opponent runs or gives up instead of fighting.
      if (moraleTurn(s, u)) continue;
      if (manual(s, u) && !s.skipParty) {
        s.stage = "action";
        return;
      }
      if (manual(s, u) && s.skipParty) {
        declare(s, asAction(s, u, "wait"), "ai");
        continue;
      }
      if (gmPlays(s, u)) {
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
              s.elements,
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
      if (manual(s, u) || gmPlays(s, u)) return;
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
  if (command.type === "yield") throw new Error("Only a ruleset fight's party may yield.");
  if (command.type === "controlCompanions") throw new Error("Only a ruleset fight hands over every companion at once.");
  if (command.type === "draw" || command.type === "ammo")
    throw new Error("Only a ruleset fight takes things in hand or picks ammunition.");
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
  if (command.type === "orders") {
    const u = get(s, command.unitId);
    if (!u || side(u) !== "party") throw new Error("Only a companion takes orders.");
    const charge = command.orders?.protectId ? get(s, command.orders.protectId) : undefined;
    if (command.orders?.protectId && (!charge || side(charge) !== "party" || charge.id === u.id))
      throw new Error("A companion protects somebody else of the party.");
    if (command.orders) u.orders = command.orders;
    else delete u.orders;
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
    // By side it ends the party's phase; by initiative only the turn of the unit whose turn it is.
    if (!s.tactical?.initiative) s.skipParty = true;
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
