import {
  normalizeGameDifficulty,
  combatAiScoreNoise,
  type CombatWeather,
  type WorldElementSet,
  forecastTacticalAttack,
  marinaraUsable,
  hasLineOfSight,
} from "@marinara-engine/shared";
import {
  type MarinaraItemPlace,
  assignCombatTactics,
  combatAiHash,
  shiftCombatTemperament,
  createTacticalCombat,
  MARINARA_BOARD_NARROWING,
  marinaraHelpless,
  currentTacticalActor,
  getMovementRange,
  canTraverseTile,
  validateTacticalUnitAction,
  performTacticalUnitAction,
  tickTacticalRound,
  summarizeTacticalBattlefield,
  decideTacticalAction,
  decideProfileAction,
  marinaraLoadAmmo,
  marinaraCanChannel,
  marinaraChannelElement,
  type CombatAiScoreParts,
  type Combatant,
  type CombatSkill,
  type CombatPlayerAction,
  type TacticalAction,
  type TacticalCoord,
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
import {
  absorbItemResult,
  createMarinaraDirectorState,
  marinaraActionChoices,
  marinaraActionProblem,
  marinaraAiAction,
  marinaraPickReasons,
  keepMarinaraReasons,
  MARINARA_AI_REASONS_KEPT,
  marinaraTacticalTurnStart,
  performMarinaraTacticalAction,
  marinaraItemPower,
  marinaraAfterItem,
  marinaraBoardAiAction,
  marinaraFighter,
  mirrorMarinaraUnits,
  nextMarinaraTurn,
  performMarinaraAction,
  type MarinaraDirectorState,
} from "./marinara-director.service.js";
import { marinaraEnemyFamily, type MarinaraFighter } from "@marinara-engine/shared";

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
/** An action the AI chose (its own turn, or a by-hand unit's auto or fallback turn) is played as the AI
 *  plays it: a Channeler-tree caster channels and a Marksman loads ammunition for it (Sonnet panel r4:
 *  a companion the AI ran never channeled, because the by-hand setting came back before the action
 *  resolved; every harness Tactical caster struck raw arcane). */
function aiPlays(s: CombatDirectorState, unitId: string, source: Source | undefined): void {
  if (source !== "ai" && source !== "fallback") return;
  const fighter = s.marinara ? marinaraFighter(s.marinara, unitId) : undefined;
  if (!fighter || fighter.side !== "party") return;
  if (marinaraCanChannel(fighter)) fighter.channelManual = false;
  if (fighter.ammoOwned) fighter.ammoAuto = true;
}
/** A Classic foe throws down its arms only below this share of its HP. */
export const MARINARA_YIELD_BELOW_HP = 0.5;

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
  /** Classic Marinara on a board: allies commanded to an extra action, and whether each had already
   *  taken its own turn this round (one that hadn't keeps it). */
  marinaraOwed?: Record<string, boolean>;
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
    {
      score?: number;
      leader?: true;
      surprised?: true;
      checked?: MoraleTrigger[];
      routed?: true;
      /** Threw down its arms (Classic Marinara): out of the fight's turns, the party's to spare or finish. */
      yielded?: true;
      /** Only runs, never surrenders (a dragon, a fiend). */
      runsOnly?: true;
    }
  >;
  /** Opponents out of the fight alive (combat AI E1): run off the board, or given up to the party. */
  gone?: Array<{ id: string; name: string; hp: number; maxHp: number; left: "fled" | "surrendered" | "tamed" }>;
  /** A game on Marinara's own classes (Classic Marinara): every fighter, its timeline and its credit
   *  for XP. Its turns come off the timeline, and its math is the shared Classic Marinara math. */
  marinara?: MarinaraDirectorState;
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
  s.marinara
    ? !k.unavailable
    : (u.skillCooldowns?.[cooldownKey(s, k)] ?? 0) <= 0 &&
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
  // Room for the AI's reasons too (one line per AI pick).
  s.log = s.log.slice(-360);
}
/** A Classic Marinara fight still going after this many rounds is called off. */
const MARINARA_ROUND_LIMIT = 60;
/** The log a Classic Marinara step writes to. */
const marinaraLog = (s: CombatDirectorState) => (text: string, kind: string, actorId?: string, source?: string) =>
  log(s, text, kind, actorId, source as Source | undefined);
/** Classic Marinara's own turn, for a unit the Engine plays: what its combat AI picks with the shared math. */
function marinaraTurn(s: CombatDirectorState, u: Unit): CombatPlayerAction {
  return marinaraAiAction(
    s.marinara!,
    u as Combatant,
    s.round,
    normalizeGameDifficulty(s.difficulty),
    !!s.tactical,
    undefined,
    (ranking) => logMarinaraReasons(s, u.id, ranking),
  );
}
/** The log kind of the AI's reasons for a Classic Marinara pick: shown only with Debug on. */
export const MARINARA_REASONING_KIND = "marinara:reasoning";
/** Why the Engine's AI picked a Classic Marinara action, on the log (Debug only in the client). */
function logMarinaraReasons(
  s: CombatDirectorState,
  unitId: string,
  ranking: Parameters<typeof marinaraPickReasons>[2],
): void {
  const text = marinaraPickReasons(s.marinara!, unitId, ranking);
  if (text) log(s, text, MARINARA_REASONING_KIND, unitId, "ai");
}
/**
 * Classic Marinara on a board, AI turn: the board AI picks where to stand, the Marinara AI what to
 * do from there. When that leaves it nothing better than a guard, it steps instead to the tile in
 * its move that brings a foe nearest into reach and chooses again from there. When the Marinara
 * pick doesn't pass the board's checks, the board AI's own action stands.
 */
export function marinaraBoardTurn(
  s: CombatDirectorState,
  tu: TacticalUnit,
): Extract<TacticalAction, { unitId: string }> {
  const t = s.tactical!;
  const board = decideTacticalAction(t, tu) as Extract<TacticalAction, { unitId: string }>;
  const boardTo = board.type === "move" ? board.to : "to" in board ? board.to : undefined;
  // A foe that has yielded or is running can't be targeted (marinaraTargetsFor): walking at it or
  // standing beside it is no approach (playtest r39: Quill held beside a fleeing Scavenger while the
  // Hold Guard that challenged it stood two tiles off).
  const targetable = (one: TacticalUnit) => one.hp > 0 && !s.marinara?.fighters.find((f) => f.id === one.id)?.yielded;
  const foes = t.units.filter((one) => one.side !== tu.side && targetable(one));
  const from = (at: TacticalCoord) => (id: string) => {
    const other = t.units.find((one) => one.id === id);
    return other ? Math.abs(other.x - at.x) + Math.abs(other.y - at.y) : Infinity;
  };
  // Provoked or challenged: bound to the one who drew it, which it walks toward and strikes, and no other
  // foe (the skill's text; Sonnet panel r5: six testers called Provoke "a lie" when foes out of the
  // tank's reach struck the back line instead).
  const me = s.marinara?.fighters.find((one) => one.id === tu.id);
  const boundIds = !me
    ? []
    : me.tauntTurns > 0 && me.tauntedBy
      ? [me.tauntedBy]
      : s
          .marinara!.fighters.filter((one) => one.side !== me.side && one.provoking > 0 && one.hp > 0)
          .map((one) => one.id);
  const bound = foes.filter((one) => boundIds.includes(one.id)).sort((a, b) => from(tu)(a.id) - from(tu)(b.id))[0];
  const goals = bound ? [bound] : foes;
  // Steps the unit would walk from a tile to stand beside its nearest foe, round walls and terrain (a
  // breadth-first fill from the foes): closer by the board's own paths, not as the crow flies (playtest
  // r38: 0.8% of party turns walked away from, or no nearer to, a foe out of reach).
  const walk = (() => {
    const steps = new Map<string, number>();
    const queue: TacticalCoord[] = [];
    for (const foe of goals) {
      steps.set(`${foe.x},${foe.y}`, 0);
      queue.push({ x: foe.x, y: foe.y });
    }
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i]!;
      const d = steps.get(`${at.x},${at.y}`)!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const next = { x: at.x + dx, y: at.y + dy };
        const key = `${next.x},${next.y}`;
        if (steps.has(key)) continue;
        if (!(next.x === tu.x && next.y === tu.y) && !canTraverseTile(t, tu, next)) continue;
        steps.set(key, d + 1);
        queue.push(next);
      }
    }
    return (at: TacticalCoord) =>
      steps.get(`${at.x},${at.y}`) ?? 1000 + Math.min(...goals.map((foe) => from(at)(foe.id)));
  })();
  // A fighter with a foe within a move and its longest reach: one an extra action isn't wasted on.
  const reaches = (fromId: string, toId: string) => {
    const one = t.units.find((u) => u.id === fromId);
    const other = t.units.find((u) => u.id === toId);
    if (!one || !other || one.hp <= 0) return false;
    const range = Math.max(one.attackRange.max, ...(one.skills ?? []).map((k) => k.range ?? 0));
    return Math.abs(other.x - one.x) + Math.abs(other.y - one.y) <= one.movement + range;
  };
  const canStrike = (id: string) => {
    const one = t.units.find((u) => u.id === id);
    return !!one && t.units.some((foe) => foe.side !== one.side && targetable(foe) && reaches(id, foe.id));
  };
  let boundHit: boolean | undefined;
  let boundTile: TacticalCoord | undefined;
  const hitsBound = () => {
    if (!bound) return false;
    if (boundHit !== undefined) return boundHit;
    const here = { x: tu.x, y: tu.y };
    const tiles = tu.hasMoved ? [here] : [here, ...getMovementRange(t, tu.id)];
    const damaging = new Set(
      (me ? marinaraUsable(me, s.marinara!.fighters) : [])
        .filter((o) => o.effect.kind === "damage" && o.id !== null)
        .map((o) => o.id as string),
    );
    const blows: Array<Extract<TacticalAction, { unitId: string }>> = [
      { type: "attack", unitId: tu.id, targetId: bound.id },
      ...(tu.skills ?? [])
        .filter((k) => damaging.has(k.id))
        .map(
          (k) =>
            ({ type: "skill", unitId: tu.id, skillName: k.name, targetId: bound.id }) as Extract<
              TacticalAction,
              { unitId: string }
            >,
        ),
    ];
    boundTile = tiles.find((at) =>
      blows.some(
        (blow) =>
          !validateTacticalUnitAction(
            t,
            tu,
            at.x === tu.x && at.y === tu.y ? blow : ({ ...blow, to: at } as typeof blow),
          ),
      ),
    );
    boundHit = !!boundTile;
    return boundHit;
  };
  // The reasons of the pick that stands (a second look from a closer tile replaces the first).
  let reasons: { at: TacticalCoord; ranking: Parameters<typeof marinaraPickReasons>[2] } | undefined;
  const choose = (at: TacticalCoord) => {
    let ranked: Parameters<typeof marinaraPickReasons>[2] | undefined;
    const picked = marinaraBoardAiAction(
      s.marinara!,
      tu as unknown as Combatant,
      s.round,
      normalizeGameDifficulty(s.difficulty),
      from(at),
      tu.attackRange.max,
      canStrike,
      reaches,
      (ranking) => (ranked = ranking),
      (optionId, targetId) => {
        const where = at.x === tu.x && at.y === tu.y ? {} : { to: at };
        const skill = optionId === null ? undefined : tu.skills?.find((one) => one.id === optionId);
        if (optionId !== null && !skill) return false;
        const action: Extract<TacticalAction, { unitId: string }> = skill
          ? { type: "skill", unitId: tu.id, skillName: skill.name, targetId, ...where }
          : { type: "attack", unitId: tu.id, targetId, ...where };
        return !validateTacticalUnitAction(t, tu, action);
      },
      // Provoke variant (b), test only: bound only when a blow on its provoker validates from a tile it
      // can move to this turn; otherwise it strikes what it can reach, and with nothing to strike still
      // walks toward the provoker.
      !!bound && hitsBound(),
      // A readied blow lands only if its target is still in reach when it goes off (Alyssa 2026-11-06):
      // the chance a target stays is the reach it would have to clear over its move, more if it can't
      // move (asleep, stunned) or is a melee fighter already locked in beside the unit.
      // An area blow goes off at the tile it was aimed at and hits every foe still within a tile of it
      // (d5302c1ae): it is lost only if all of them leave.
      (option, target) => {
        const one = t.units.find((u) => u.id === target.id);
        if (!one) return 1;
        const skill = option.id === null ? undefined : tu.skills?.find((k) => k.id === option.id);
        const range = skill?.range ?? tu.attackRange.max;
        const stays = (unit: TacticalUnit, reach: number) => {
          const fighter = s.marinara!.fighters.find((f) => f.id === unit.id);
          if (fighter && marinaraHelpless(fighter)) return 1;
          const move = Math.max(0, unit.movement ?? 0);
          const near = Math.abs(unit.x - at.x) + Math.abs(unit.y - at.y);
          const odds = Math.min(1, (reach + 0.5) / (reach + move + 0.5));
          return unit.attackRange.max <= 1 && near <= 1 ? Math.max(odds, 0.5) : odds;
        };
        if (option.effect.target === "all-enemies" || option.effect.target === "front-row") {
          const inArea = t.units.filter(
            (u) => u.side === one.side && u.hp > 0 && Math.abs(u.x - one.x) + Math.abs(u.y - one.y) <= 1,
          );
          return 1 - inArea.reduce((gone, u) => gone * (1 - stays(u, 1)), 1);
        }
        return stays(one, range);
      },
    );
    return { picked, ranked };
  };
  const decide = (at: TacticalCoord) => {
    const { picked, ranked } = choose(at);
    if (ranked) reasons = { at, ranking: ranked };
    return picked;
  };
  let to = boardTo;
  let picked = decide(to ?? { x: tu.x, y: tu.y });
  // Bound, and a blow on the provoker lands from a tile it can reach this turn but not from the board's
  // pick: strike from that tile rather than brace and walk off (slice s11 2026-11-06: Ironbristle B left
  // two targets beside it to "close in" on a provoker it could have struck).
  if (picked?.type === "defend" && bound && hitsBound() && boundTile && !tu.hasMoved) {
    const kept = reasons;
    const tried = decide(boundTile);
    if (tried && tried.type !== "defend") {
      picked = tried;
      to = boundTile.x === tu.x && boundTile.y === tu.y ? undefined : boundTile;
    } else reasons = kept;
  }
  // A Guard weighs covering each friend from a tile beside that friend, not only from where the board's
  // walk puts it (r53: Rook covered the evasive scout from turn 1, "no other choice", while two foes
  // tore into the caster two tiles out of its reach; 91% of Tactical deaths with a Guard covering
  // someone else were of a friend taking more than the one covered).
  const covers = me
    ? marinaraUsable(me, s.marinara!.fighters)
        .filter((o) => o.effect.kind === "cover" && o.id !== null)
        .map((o) => o.id)
    : [];
  if (covers.length && !tu.hasMoved && picked) {
    const tiles = [{ x: tu.x, y: tu.y }, ...getMovementRange(t, tu.id)];
    let best = { score: reasons?.ranking[0]?.score ?? -Infinity, at: to, picked, reasons };
    for (const friend of t.units.filter((u) => u.side === tu.side && u.id !== tu.id && u.hp > 0)) {
      const near = tiles.filter((at) => from(at)(friend.id) <= 2);
      if (!near.length) continue;
      // Of the tiles beside the friend, the one nearest the foes.
      const at = near.reduce((b, a) => (walk(a) < walk(b) ? a : b));
      const tried = decide(at);
      const score = reasons?.ranking[0]?.score ?? -Infinity;
      if (tried?.type === "skill" && covers.includes(tried.skillId) && score > best.score)
        best = { score, at: at.x === tu.x && at.y === tu.y ? undefined : at, picked: tried, reasons };
    }
    picked = best.picked;
    to = best.at;
    reasons = best.reasons;
  }
  // A blow that barely scratches its foe (armour, a resisted element) while another foe it could do real
  // harm to is a move away: look from the tile nearest each other foe too, and strike there when that is
  // clearly worth more (slice tester s2 2026-11-06: a Headsman hit a Siege Walker for 1 a turn, regen 7,
  // four rounds running, with the caster boss a few tiles off).
  const scratch = 0.03;
  const pickedScore = () => reasons?.ranking[0]?.score ?? -Infinity;
  if (
    picked &&
    (picked.type === "attack" || picked.type === "skill") &&
    picked.targetId !== tu.id &&
    !bound &&
    !tu.hasMoved &&
    pickedScore() < scratch &&
    foes.length > 1
  ) {
    const tiles = [{ x: tu.x, y: tu.y }, ...getMovementRange(t, tu.id)];
    let best: {
      score: number;
      at: TacticalCoord | undefined;
      picked: ReturnType<typeof decide>;
      reasons: typeof reasons;
    } = {
      score: pickedScore(),
      at: to,
      picked,
      reasons,
    };
    for (const foe of foes) {
      if (foe.id === picked.targetId) continue;
      const at = tiles.reduce((b, a) => (from(a)(foe.id) < from(b)(foe.id) ? a : b));
      const tried = decide(at);
      const score = pickedScore();
      if (tried && tried.type !== "defend" && score > best.score + 0.02)
        best = { score, at: at.x === tu.x && at.y === tu.y ? undefined : at, picked: tried, reasons };
    }
    picked = best.picked;
    to = best.at;
    reasons = best.reasons;
  }
  // A self skill worth nothing (a mindless golem's Harden, an ooze's Regenerate: their kind weighs only
  // blows) is no reason to stand still: it is treated as nothing to do, so the unit looks for a tile to
  // strike from and otherwise walks in (r65 2026-11-06: 2.5% of Tactical foe turns were "Harden (0.00); no
  // other choice").
  let idle = false;
  if (
    picked?.type === "skill" &&
    picked.targetId === tu.id &&
    (reasons?.ranking[0]?.score ?? 0) < 0.005 &&
    foes.length &&
    !bound
  ) {
    picked = { type: "defend" };
    idle = true;
  }
  const firstReasons = reasons;
  if (picked?.type === "defend" && !tu.hasMoved && foes.length) {
    // Closest approach: a tile with a foe in reach (the farthest such tile for a ranged unit), else
    // the tile nearest any foe.
    const range = Math.max(tu.attackRange.max, ...(tu.skills ?? []).map((k) => k.range ?? 0));
    const nearest = (at: TacticalCoord) => Math.min(...goals.map((foe) => from(at)(foe.id)));
    const tiles = [{ x: tu.x, y: tu.y }, ...getMovementRange(t, tu.id)];
    const score = (at: TacticalCoord) => {
      const d = nearest(at);
      return d <= range ? 1000 + d : -d;
    };
    const step = tiles.reduce((best, at) => (score(at) > score(best) ? at : best));
    // Where it stands, then the tiles nearest a foe in reach (the farthest first for a ranged unit), until
    // one has something to do: one look from the farthest tile alone missed a foe right beside it behind
    // a wall or out of sight, and the board's walk led away (reasons audit r37: 6.5% of party turns after
    // contact were "advances" with a foe next to the unit).
    const key = (at: TacticalCoord) => `${at.x},${at.y}`;
    const looked = new Set([key(to ?? { x: tu.x, y: tu.y })]);
    const order = [{ x: tu.x, y: tu.y }, ...[...tiles].sort((a, b) => score(b) - score(a))].filter((at) => {
      if (looked.has(key(at))) return false;
      looked.add(key(at));
      return true;
    });
    let again: ReturnType<typeof decide> = null;
    let at = step;
    for (const tile of order.slice(0, 8)) {
      if (score(tile) < 1000 && tile !== order[0]) break;
      const tried = decide(tile);
      // The same worthless self skill from another tile is still nothing to do.
      const worthless =
        idle && tried?.type === "skill" && tried.targetId === tu.id && (reasons?.ranking[0]?.score ?? 0) < 0.005;
      if (tried && tried.type !== "defend" && !worthless) {
        again = tried;
        at = tile;
        break;
      }
    }
    if (again) {
      picked = again;
      to = at.x === tu.x && at.y === tu.y ? undefined : at;
      // Nothing in reach from anywhere it can stand: the board's own walk, which paths round walls
      // (a straight-line step stopped both sides at a wall for 60 rounds, playtest 2026-11-01) - unless
      // that walk doesn't close in and the straight step does: the board's walk for a self buff or a
      // kite drifted both sides of a duel round the edges for 60 rounds (stall logs 2026-11-03).
    } else {
      reasons = firstReasons;
      // Nothing to do from anywhere it can stand: the tile its walk brings nearest a foe, or stay put
      // rather than drift. A tile in reach is no better when nothing lands from it (a wall or cover in
      // the way): the farthest one led ranged units away from the foe (ai-audit 2026-11-03).
      const here = { x: tu.x, y: tu.y };
      const walkIn = tiles.reduce((best, at) => (walk(at) < walk(best) ? at : best), here);
      const goal = walk(walkIn) < walk(here) ? walkIn : here;
      to = goal.x === tu.x && goal.y === tu.y ? undefined : goal;
    }
  }
  if (!picked) return board;
  // A pick on the unit itself (a self or party buff) with every foe out of reach: walk in as Defend
  // does, rather than the board's drift (stall logs 2026-11-03: a boss cast Rally and wandered the
  // edges while the last party member did the same).
  // Reach counts only its blows (Alyssa 2026-11-04: foes play to win; one that buffed or healed in place
  // because a support skill's range reached a foe never closed in to strike it).
  const strikeRange = Math.max(
    tu.attackRange.max,
    ...(me ? marinaraUsable(me, s.marinara!.fighters) : [])
      .filter((o) => o.effect.kind === "damage" && o.id !== null)
      .map((o) => tu.skills?.find((k) => k.id === o.id)?.range ?? 0),
  );
  if (picked.type === "skill" && picked.targetId === tu.id && !tu.hasMoved && foes.length) {
    const nearest = (at: TacticalCoord) => Math.min(...goals.map((foe) => from(at)(foe.id)));
    const range = strikeRange;
    const here = { x: tu.x, y: tu.y };
    if (nearest(to ?? here) > range) {
      const step = [here, ...getMovementRange(t, tu.id)].reduce((best, at) => (walk(at) < walk(best) ? at : best));
      if (walk(step) < walk(here) && (!to || walk(to) >= walk(here)))
        to = step.x === tu.x && step.y === tu.y ? undefined : step;
    }
  }
  // Bracing where it stands with nothing in reach to strike: foes play to win, so it closes in and
  // braces there (Alyssa 2026-11-04: out-of-range foes looped Defend, Harden and Self-Repair in place).
  if (
    picked.type === "defend" &&
    !bound &&
    foes.length &&
    !tu.hasMoved &&
    (reasons?.ranking[0]?.candidate.support ?? 0) > 0
  ) {
    const here = { x: tu.x, y: tu.y };
    const nearest = (at: TacticalCoord) => Math.min(...goals.map((foe) => from(at)(foe.id)));
    if (nearest(to ?? here) > strikeRange) {
      const step = [here, ...getMovementRange(t, tu.id)].reduce((best, at) => (walk(at) < walk(best) ? at : best));
      if (walk(step) < walk(to ?? here)) to = step.x === tu.x && step.y === tu.y ? undefined : step;
    }
  }
  const where = to ? { to } : {};
  let action: Extract<TacticalAction, { unitId: string }> | undefined;
  // Defend only to brace against real blows (Alyssa 2026-11-03); a Defend the AI fell back on with
  // nothing to strike and nothing to brace against is a walk: the unit moves in and waits.
  const braces = !idle && (reasons?.ranking[0]?.candidate.support ?? 0) > 0;
  // Bound to a provoker or challenger it can't strike, from here or with any ranged blow: it closes in
  // as far as it can and defends (Alyssa 2026-11-03).
  if (picked.type === "defend" && bound) {
    const text = `AI: ${tu.name} is drawn to ${bound.name} but can't strike it yet: it closes in and defends.`;
    const m = s.marinara!;
    m.aiReasons = [...(m.aiReasons ?? []), { unitId: tu.id, round: s.round, text }].slice(-MARINARA_AI_REASONS_KEPT);
    log(s, text, MARINARA_REASONING_KIND, tu.id, "ai");
    // Closer by path if it can still step (r50: a fast foe's second action came here without the walk-in
    // and defended where it stood).
    // With no board path to it (its own side boxes it in), as near as it can stand by the crow's flight:
    // the pull never lets go (Alyssa 2026-11-04: a provoked foe works toward its provoker even when it
    // can't reach it this turn, and does its best to be ready; it doesn't act freely).
    const here = { x: tu.x, y: tu.y };
    const step = to
      ? undefined
      : getMovementRange(t, tu.id).reduce<TacticalCoord | undefined>(
          (best, at) => (walk(at) < walk(best ?? here) ? at : best),
          undefined,
        );
    const closer = step ? { type: "defend" as const, unitId: tu.id, to: step } : undefined;
    if (closer && !validateTacticalUnitAction(t, tu, closer)) return closer;
    const guard = { type: "defend" as const, unitId: tu.id, ...where };
    if (!validateTacticalUnitAction(t, tu, guard)) return guard;
  }
  if (picked.type === "defend" && !braces && foes.length) {
    const wait = { type: "wait" as const, unitId: tu.id, ...where };
    if (!validateTacticalUnitAction(t, tu, wait)) {
      const text = `AI: ${tu.name} ${to ? "advances" : "holds"}: nothing to strike or brace against from here.`;
      const m = s.marinara!;
      m.aiReasons = [...(m.aiReasons ?? []), { unitId: tu.id, round: s.round, text }].slice(-MARINARA_AI_REASONS_KEPT);
      log(s, text, MARINARA_REASONING_KIND, tu.id, "ai");
      return wait;
    }
  }
  if (picked.type === "defend") action = { type: "defend", unitId: tu.id, ...where };
  else if (picked.type === "attack") action = { type: "attack", unitId: tu.id, targetId: picked.targetId, ...where };
  else if (picked.type === "skill") {
    const skill = tu.skills?.find((one) => one.id === picked.skillId);
    // The board can't aim at the fallen: a revive is aimed at the user and resolution finds them.
    const fallen = t.units.find((one) => one.id === picked.targetId)?.hp === 0;
    if (skill)
      action = {
        type: "skill",
        unitId: tu.id,
        skillName: skill.name,
        targetId: fallen ? tu.id : picked.targetId,
        ...where,
      };
  }
  const problem = action ? validateTacticalUnitAction(t, tu, action) : { error: "unknown skill" };
  if (!action || problem) {
    log(
      s,
      `AI: ${tu.name} takes the board AI's own move (its Marinara pick didn't fit the board).`,
      MARINARA_REASONING_KIND,
      tu.id,
      "ai",
    );
    return board;
  }
  if (reasons) {
    keepMarinaraReasons(s.marinara!, tu.id, s.round, reasons.ranking);
    logMarinaraReasons(s, tu.id, reasons.ranking);
  }
  return keepingDistance(s, tu, action) ?? action;
}

/**
 * A unit that fights from range (a Marksman, a caster, a back-row Herald) shoots from the tile in its
 * move that keeps its target in reach and stands farthest from every foe. On a board nothing else
 * shields the back line: a party with no Guard lost its back-liners and won only 62% of Normal fights
 * at level 25+ (playtest 2026-11-01).
 */
function keepingDistance(
  s: CombatDirectorState,
  tu: TacticalUnit,
  action: Extract<TacticalAction, { unitId: string }>,
): Extract<TacticalAction, { unitId: string }> | null {
  const t = s.tactical!;
  if (tu.hasMoved || (action.type !== "attack" && action.type !== "skill") || !action.targetId) return null;
  const target = t.units.find((one) => one.id === action.targetId);
  if (!target || target.side === tu.side) return null;
  const skill = action.type === "skill" ? tu.skills?.find((one) => one.name === action.skillName) : undefined;
  const reach = action.type === "skill" ? (skill?.range ?? Math.max(tu.attackRange.max, 2)) : tu.attackRange.max;
  if (reach < 2) return null;
  const foes = t.units.filter((one) => one.side !== tu.side && one.hp > 0);
  const gap = (at: TacticalCoord, unit: TacticalUnit) => Math.abs(unit.x - at.x) + Math.abs(unit.y - at.y);
  const safety = (at: TacticalCoord) => Math.min(...foes.map((foe) => gap(at, foe)));
  const now = action.to ?? { x: tu.x, y: tu.y };
  let best: TacticalCoord | null = null;
  for (const at of [{ x: tu.x, y: tu.y }, ...getMovementRange(t, tu.id)]) {
    const d = gap(at, target);
    if (d > reach || d < (action.type === "attack" ? tu.attackRange.min : 1)) continue;
    if (safety(at) <= safety(best ?? now)) continue;
    const moved = at.x === tu.x && at.y === tu.y ? { ...action, to: undefined } : { ...action, to: at };
    if (!validateTacticalUnitAction(t, tu, moved)) best = at;
  }
  if (!best) return null;
  const { to: _to, ...rest } = action;
  return best.x === tu.x && best.y === tu.y ? rest : { ...rest, to: best };
}
/** What the Game Master is told of a ruleset fight's board: as a tactical one, its scene when painted. */
function rulesetBoardSummary(board: RulesetCombatBoard | undefined, seed: number): string | undefined {
  if (!board?.battlefield) return undefined;
  const scene = board.battlefield.kind === "hand-made" ? board.battlefield.scene : undefined;
  return summarizeTacticalBattlefield({ ...board, seed, ...(scene ? { environment: scene } : {}) });
}
function sync(s: CombatDirectorState) {
  if (s.marinara) {
    // A beast a Tracker tamed leaves the fight at once, the keeper's companion now (Alyssa 2026-11-01).
    for (const fighter of s.marinara.fighters.filter((one) => one.tamedBy && one.hp > 0)) {
      const u = get(s, fighter.id);
      if (u) leaveFight(s, u, "tamed", true);
    }
    // A Marksman the AI runs loads its own ammunition, shot by shot; one the player runs, by hand.
    for (const u of s.tactical ? s.tactical.units : s.party) {
      const fighter = side(u as Unit) === "party" ? marinaraFighter(s.marinara, u.id) : undefined;
      if (fighter?.ammoOwned) fighter.ammoAuto = !manual(s, u as Unit);
      // A Channeler-tree caster the AI runs channels the element each foe fears; one the player runs, by hand.
      if (fighter && marinaraCanChannel(fighter)) fighter.channelManual = manual(s, u as Unit);
    }
    mirrorMarinaraUnits(
      s.marinara,
      s.tactical ? (s.tactical.units as unknown as Combatant[]) : [...s.party, ...s.enemies],
      !!s.tactical,
    );
  }
  if (s.tactical) {
    const convert = (u: TacticalUnit): Combatant => ({ ...u, side: side(u) === "party" ? "player" : "enemy" });
    s.party = s.tactical.units.filter((u) => u.side === "party").map(convert);
    s.enemies = s.tactical.units.filter((u) => u.side === "enemy").map(convert);
    s.tactical.log = s.log.map((e) => ({
      // The AI's reasons keep their kind, so the board shows them only with Debug on.
      kind: e.kind === MARINARA_REASONING_KIND ? ("reasoning" as const) : ("status" as const),
      text: e.text,
      actorId: e.actorId,
      message: e.message,
    }));
  }
  // A ruleset fight's outcome is the ruleset's own (syncRulesetCombatants): a hero at 0 who is still
  // rolling to live keeps it going, though no unit has hit points left (cloud re-test 2026-10-26).
  if (s.style !== "ruleset") {
    // Foes who yielded are spared once no one fights on: they leave as surrendered and pay as the beaten.
    // The party chooses (Alyssa 2026-11-01): the fight waits on its `mercy` command, spare or finish.
    const yielded = (u: Unit) => !!s.morale?.[u.id]?.yielded;
    const enemiesLeft = living(s).filter((u) => side(u) === "enemy");
    if (!s.outcome && enemiesLeft.length && enemiesLeft.every(yielded) && living(s).some((u) => side(u) === "party")) {
      s.mercy = { foeIds: enemiesLeft.map((u) => u.id) };
      // Nobody's turn while the party decides.
      s.actorId = undefined;
      if (s.stage === "action") s.stage = "select";
    } else delete s.mercy;
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
      // What the party took from a Classic Marinara fight: XP, level-ups, a promotion open, the fallen.
      ...(s.marinara?.growth?.length ? { marinara: s.marinara.growth } : {}),
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
    mercy,
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
    ...(mercy ? { mercy } : {}),
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
  /** Classic Marinara fighters, one per unit by id: a game on Marinara's own classes. */
  marinara?: MarinaraFighter[];
  /** Where a Classic fight is, so Steal can name what it takes as it happens. */
  marinaraPlace?: MarinaraItemPlace;
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
      const mind = marinaraMind(input.marinara, u.id);
      const base = mind === "none" ? undefined : moraleScore(u);
      // An elite is a hardened fighter: harder to shake (playtest 2026-11-01: elites gave up at half HP).
      const score = base === undefined ? undefined : Math.min(12, base + (mind === "elite" ? 2 : 0));
      s.morale[u.id] = {
        ...(score !== undefined ? { score } : {}),
        ...(mind === "runs" ? { runsOnly: true as const } : {}),
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
      // Classic Marinara fights a narrower board (overnight playtest 2026-11-06: less walking up).
      ...(input.marinara?.length ? { narrow: MARINARA_BOARD_NARROWING } : {}),
    });
  if (input.marinara?.length && s.style !== "ruleset") {
    s.marinara = createMarinaraDirectorState(input.marinara, s.seed);
    if (input.marinaraPlace) {
      s.marinara.place = input.marinaraPlace;
      // The seed the fight's loot rolls with (combat-director.routes.ts), so a steal named now is what it pays.
      s.marinara.lootSeed = `${s.id}:${s.seed}:loot`;
    }
    // Bosses act on the timeline like everyone else; extra actions come from their own skills.
    for (const u of directorUnits(s)) if (u.boss) u.boss = { ...u.boss, points: 0 };
    // Each party member's passives are named as the fight starts: the always-on ones (Fleet, Tailwind,
    // Deep Well) have no moment of their own in the log (Sonnet panel r6: testers never saw them work).
    for (const fighter of s.marinara.fighters.filter((one) => one.side === "party")) {
      const passives = fighter.skills.filter((one) => one.kind === "passive").map((one) => one.label);
      if (passives.length) log(s, `${fighter.name}'s passives in play: ${passives.join(", ")}.`, "status", fighter.id);
    }
    // Tamed companions say what they lend, as the fight starts (Sonnet panel r6: the bonus went unseen).
    for (const fighter of s.marinara.fighters) {
      const beast = fighter.companion;
      if (!beast?.lends) continue;
      const stat = beast.stat === "hp" ? "HP" : `${beast.stat[0]!.toUpperCase()}${beast.stat.slice(1)}`;
      const pct = (share: number) => Math.round(share * 100);
      log(
        s,
        `${fighter.name}'s ${beast.name} lends +${pct(beast.lends)}% ${stat}${beast.bond ? ` (Bond: the rest of the party +${pct(beast.bond)}%)` : ""}.`,
        "status",
        fighter.id,
      );
    }
    sync(s);
  }
  for (const u of directorUnits(s))
    s.budgets[u.id] = { legendary: side(u) === "enemy" ? (u.boss?.points ?? 0) : 0, reaction: 1 };
  if (s.style === "classic" && !s.marinara) s.order = rollInitiative([...party, ...enemies]).map((e) => e.id);
  advanceCombatDirector(s);
  return s;
}
/**
 * An opponent's morale score (combat AI E1), on the old games' 2 to 12 scale: the story's, else read
 * off its mind (an animal's nerve is its nature, a planner's is steadier) and its temperament, one
 * more for a leader. None for a boss, whose story decides when it gives up, nor for the mindless.
 */
/**
 * Who in a Classic Marinara fight may lose heart (Alyssa 2026-11-01): only foes who would realistically
 * run or give up. People and giants may do both; dragons and fiends may run but never give up; beasts,
 * the dead, oozes, constructs and the like never break, and a treasure foe leaves only by its own flight.
 */
function marinaraMind(
  fighters: readonly MarinaraFighter[] | undefined,
  id: string,
): "none" | "runs" | "elite" | "person" | undefined {
  const fighter = fighters?.find((one) => one.id === id);
  if (!fighter) return undefined;
  if (fighter.windfall) return "none";
  const kind = fighter.familyId ? marinaraEnemyFamily(fighter.familyId)?.kind : "humanoid";
  if (kind === "dragon" || kind === "fiend") return "runs";
  if (kind !== "humanoid" && kind !== "giant") return "none";
  return fighter.tier === "elite" ? "elite" : "person";
}
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
function leaveFight(s: CombatDirectorState, u: Unit, left: "fled" | "surrendered" | "tamed", quiet = false) {
  (s.gone ??= []).push({ id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, left });
  // Off the Classic Marinara timeline too, kept aside for the XP it pays when the fight is won.
  if (s.marinara) {
    const fighter = s.marinara.fighters.find((one) => one.id === u.id);
    if (fighter) {
      s.marinara.fighters = s.marinara.fighters.filter((one) => one !== fighter);
      (s.marinara.left ??= []).push(fighter);
    }
  }
  if (s.tactical) s.tactical.units = s.tactical.units.filter((one) => one.id !== u.id);
  else s.enemies = s.enemies.filter((one) => one.id !== u.id);
  s.order = s.order.filter((id) => id !== u.id);
  s.defending = s.defending.filter((id) => id !== u.id);
  s.tasks = s.tasks.filter((task) => !("unitId" in task) || task.unitId !== u.id);
  if (s.actorId === u.id) s.actorId = undefined;
  if (quiet) return;
  const key = left === "fled" ? "game.combat.event.fled" : "game.combat.event.surrendered";
  const text = left === "fled" ? `${u.name} gets away from the fight.` : `${u.name} throws down its arms and gives up.`;
  log(s, text, "status", u.id, undefined, { key, params: { actor: u.name } });
}
/** The party's word on foes who yielded: spared, they leave as surrendered; finished, they fall. */
/** A commanded ally (or one Double Dose gave an extra action) takes its extra action next on a board, by
 *  side or by initiative alike, and keeps its own turn this round if it hadn't taken it yet. */
function queueMarinaraBonusTurns(s: CombatDirectorState) {
  if (!s.marinara || !s.tactical) return;
  // In the order they were granted: a commanded ally before its commander's own bonus action.
  const owed = [...s.marinara.fighters].sort((a, b) => (a.bonusAt ?? 0) - (b.bonusAt ?? 0));
  for (const fighter of owed)
    if ((fighter.bonusTurns ?? 0) > 0 && fighter.hp > 0 && s.marinaraOwed?.[fighter.id] === undefined) {
      const unit = s.tactical.units.find((one) => one.id === fighter.id);
      if (!unit) continue;
      (s.marinaraOwed ??= {})[fighter.id] = !!unit.hasActed;
      unit.hasActed = false;
      unit.hasMoved = false;
      s.tasks.push({ kind: "activate", unitId: unit.id });
    }
}
function resolveMercy(s: CombatDirectorState, choice: "spare" | "finish") {
  const ids = s.mercy?.foeIds ?? [];
  delete s.mercy;
  for (const id of ids) {
    const u = get(s, id);
    if (!u || u.hp <= 0) continue;
    if (choice === "spare") {
      log(s, `${u.name} is spared.`, "status", u.id, "manual", {
        key: "game.combat.event.spared",
        params: { actor: u.name },
      });
      leaveFight(s, u, "surrendered", true);
    } else {
      u.hp = 0;
      const fighter = s.marinara?.fighters.find((one) => one.id === id);
      if (fighter) fighter.hp = 0;
      log(s, `${u.name} is finished off.`, "status", u.id, "manual", {
        key: "game.combat.event.finished",
        params: { actor: u.name },
      });
    }
  }
  sync(s);
}
/** Treasure foes (marinara-bestiary.ts) still standing after their rounds get away, paying nothing. */
function treasureFlees(s: CombatDirectorState) {
  for (const fighter of [...(s.marinara?.fighters ?? [])]) {
    if (!fighter.windfall || fighter.side === "party" || fighter.hp <= 0) continue;
    if (s.round <= fighter.windfall.fleeAfterRounds) continue;
    const unit = get(s, fighter.id);
    if (unit) leaveFight(s, unit, "fled");
  }
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
  if (!mine || side(u) !== "enemy") return false;
  // One that gave up waits on the party: its turns pass.
  if (mine.yielded) {
    if (s.tactical) (u as TacticalUnit).hasActed = true;
    return true;
  }
  if (mine.score === undefined) return false;
  // A treasure foe never breaks or surrenders: it leaves only by running off after its rounds.
  if (s.marinara?.fighters.some((one) => one.id === u.id && one.windfall)) return false;
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
    if ((u.tactics?.mind ?? "tactical") !== "instinct" && pinned && !mine.runsOnly) {
      // Classic Marinara (Alyssa 2026-11-01): it throws down its arms and waits on the party, who may spare
      // it (it pays as beaten when the fight is won) or finish it off.
      if (s.marinara) {
        // Not while it is still mostly whole (Sonnet panel 2026-11-02: a Bastion at 315/315 yielded when a
        // partner fell). The broken nerve waits: the same roll lands once it drops under half HP.
        if (u.hp >= u.maxHp * MARINARA_YIELD_BELOW_HP) {
          mine.checked = mine.checked.filter((one) => one !== trigger);
          continue;
        }
        mine.yielded = true;
        const fighter = s.marinara.fighters.find((one) => one.id === u.id);
        if (fighter) fighter.yielded = true;
        if (s.tactical) (u as TacticalUnit).hasActed = true;
        log(s, `${u.name} throws down its arms and begs for mercy.`, "status", u.id, undefined, {
          key: "game.combat.event.yields",
          params: { actor: u.name },
        });
        return true;
      }
      leaveFight(s, u, "surrendered");
      return true;
    }
    // Nor does a Classic Marinara foe run while still mostly whole, as it doesn't yield (Sonnet panel r5:
    // a Reflex Champion at 230/230 ran): it is most sure of winning then (Alyssa 2026-11-04). A coward, and
    // a treasure foe that only ever runs, still may. A dragon or fiend, which runs rather than yields, holds
    // too (Sonnet panel r6: a Crater Wyrm ran at 89% HP); a treasure foe never reaches this check.
    if (s.marinara && u.tactics?.adjective !== "cowardly" && u.hp >= u.maxHp * MARINARA_YIELD_BELOW_HP) {
      mine.checked = mine.checked.filter((one) => one !== trigger);
      continue;
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
    let board = a.tactical;
    // The board can't aim at the fallen, so a Marinara revive aimed at a downed ally is checked by its
    // own rules plus support range, and the rest of the board's checks run as if aimed at the user
    // (Sonnet panel r6: hand play got "Invalid skill target." for Revive).
    if (s.marinara && board.type === "skill" && board.targetId) {
      const fallen = get(s, board.targetId);
      if (fallen && fallen.hp <= 0 && side(fallen) === side(u)) {
        const skillName = board.skillName;
        const skill = u.skills?.find((k) => k.name === skillName);
        const problem = skill
          ? marinaraActionProblem(s.marinara, u.id, { type: "skill", skillId: skill.id, targetId: fallen.id })
          : "Skill unavailable.";
        if (problem) throw new Error(problem);
        const from = board.to ?? (u as TacticalUnit);
        const at = fallen as TacticalUnit;
        if (Math.abs(at.x - from.x) + Math.abs(at.y - from.y) > (skill!.range ?? 2))
          throw new Error(`${fallen.name} is out of support range.`);
        board = { ...board, targetId: u.id };
      }
    }
    // An attack its rules refuse (a provoker drawing the blows) is refused with the reason, not played
    // as a Defend (slice tester s8).
    // Only when the provoker can be struck from where it will stand: one out of reach lets the blow go to
    // a foe in reach (performMarinaraTacticalAction).
    if (s.marinara && board.type === "attack") {
      const problem = marinaraActionProblem(s.marinara, u.id, { type: "attack", targetId: board.targetId });
      const from = board.to ?? (u as TacticalUnit);
      const max = (u as TacticalUnit).attackRange.max;
      const reachable = s.tactical.units.some(
        (one) =>
          one.side !== (u as TacticalUnit).side &&
          one.hp > 0 &&
          (marinaraFighter(s.marinara!, one.id)?.provoking ?? 0) > 0 &&
          Math.abs(one.x - from.x) + Math.abs(one.y - from.y) <= max,
      );
      if (problem && reachable) throw new Error(problem);
    }
    // A Marinara skill that isn't usable now (cooling down, its cost unpaid, used up) is refused, not
    // played as a basic attack (slice tester s1, 2026-11-06: Vanish on cooldown came out as a hit).
    if (s.marinara && board.type === "skill") {
      const skillName = board.skillName;
      const skillId = u.skills?.find((k) => k.name === skillName)?.id;
      const fighter = marinaraFighter(s.marinara, u.id);
      if (!skillId || !fighter || !marinaraUsable(fighter, s.marinara.fighters).some((one) => one.id === skillId))
        throw new Error(`${skillName} can't be used now.`);
      // Its target by Marinara's rules too (Tame below 30% HP, a challenge), so it can't come out as a
      // Defend (slice tester s5). Aimed at the user, it's a self, party or area skill, or the AI's revive.
      if (board.targetId && board.targetId !== u.id) {
        // Provoke variant (b), test only: on the board a provoke or challenge doesn't refuse a blow on
        // another foe; resolution sends it to the one who drew it when that one is in reach.
        const lifted: Array<() => void> = [];
        const aimed = marinaraFighter(s.marinara, board.targetId);
        if (aimed && aimed.side !== fighter.side) {
          for (const one of s.marinara.fighters)
            if (one.side !== fighter.side && one.provoking > 0) {
              const turns = one.provoking;
              one.provoking = 0;
              lifted.push(() => (one.provoking = turns));
            }
          if (fighter.tauntTurns > 0) {
            const turns = fighter.tauntTurns;
            fighter.tauntTurns = 0;
            lifted.push(() => (fighter.tauntTurns = turns));
          }
        }
        let problem: string | null;
        try {
          problem = marinaraActionProblem(s.marinara, u.id, {
            type: "skill",
            skillId,
            targetId: board.targetId,
          });
        } finally {
          for (const restore of lifted) restore();
        }
        if (problem) throw new Error(problem);
      }
    }
    const invalid = validateTacticalUnitAction(s.tactical, u as TacticalUnit, board);
    if (invalid) throw new Error(invalid.error);
  } else if (a.classic && s.marinara) {
    if (a.classic.type === "flee") throw new Error("Unsupported action in this window.");
    const problem = marinaraActionProblem(s.marinara, u.id, a.classic);
    if (problem) throw new Error(problem);
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
  if (s.marinara && !s.tactical) {
    if (legendary) return [];
    return marinaraActionChoices(s.marinara, u.id)
      .slice(0, 24)
      .map(({ action, label }, index) => ({
        id: String(index),
        kind: action.type === "defend" ? "defend" : action.type === "skill" ? "skill" : "attack",
        actorId: u.id,
        ...("targetId" in action && action.targetId ? { targetId: action.targetId } : {}),
        ...(action.type === "skill" ? { skillName: label, skillId: action.skillId } : {}),
        mpCost: action.type === "skill" ? (u.skills?.find((k) => k.id === action.skillId)?.mpCost ?? 0) : 0,
        legendaryCost: 0,
        action: { unitId: u.id, classic: action },
      }));
  }
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
    } else if (s.marinara) {
      marinaraAiAction(
        structuredClone(s.marinara),
        structuredClone(u) as Combatant,
        s.round,
        normalizeGameDifficulty(s.difficulty),
        false,
        (ranked) => {
          ranking = ranked.map(({ candidate, parts }) => ({
            action:
              candidate.action.optionId === "defend"
                ? { type: "defend" }
                : candidate.action.optionId === null
                  ? { type: "attack", targetId: candidate.action.targetIds[0] }
                  : { type: "skill", targetId: candidate.action.targetIds[0], skillId: candidate.action.optionId },
            parts,
          }));
        },
      );
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
    prevented: `keeps ${target ?? "a foe"} from striking its side`,
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
  // A Classic Marinara skill is paid for as it resolves, by the shared math.
  if (skill && !s.marinara) pay(s, u, skill);
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
      action.classic.itemEffect = failed?.failed
        ? { ...does, failed: failed.failed }
        : s.marinara
          ? marinaraItemPower(s.marinara, u.id, does)
          : does;
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
      : s.marinara
        ? marinaraTurn(s, u)
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
          itemEffect:
            effect && failed
              ? { ...effect, failed }
              : s.marinara
                ? marinaraItemPower(s.marinara, u.id, effect)
                : effect,
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
      if (s.marinara) {
        absorbItemResult(s.marinara, s.tactical.units as unknown as Combatant[]);
        if (!failed && marinaraAfterItem(s.marinara, u.id, marinaraLog(s))) {
          (u as TacticalUnit).hasActed = true;
          queueMarinaraBonusTurns(s);
        }
      }
    } else if (
      s.tactical &&
      s.marinara &&
      p.action.tactical &&
      (p.action.tactical.type === "attack" || p.action.tactical.type === "skill" || p.action.tactical.type === "defend")
    ) {
      // Classic Marinara on a board: the board moves the unit, the shared math resolves what it does.
      const a = p.action.tactical;
      const tu = u as TacticalUnit;
      const events: TacticalCombatState["log"] = [];
      if (a.to) performTacticalUnitAction(s.tactical, tu, { type: "move", unitId: tu.id, to: a.to }, events);
      for (const e of events) log(s, e.text, e.kind, e.actorId, p.source, e.message);
      const units = s.tactical.units;
      const near = (id: string) => {
        const at = units.find((one) => one.id === id);
        return at
          ? units
              .filter((one) => one.id !== id && Math.max(Math.abs(one.x - at.x), Math.abs(one.y - at.y)) <= 1)
              .map((one) => one.id)
          : [];
      };
      const skillId = a.type === "skill" ? u.skills?.find((k) => k.name === a.skillName)?.id : undefined;
      const action: CombatPlayerAction =
        a.type === "defend"
          ? { type: "defend" }
          : a.type === "skill" && skillId
            ? { type: "skill", skillId, targetId: a.targetId ?? tu.id }
            : { type: "attack", targetId: a.targetId ?? tu.id };
      const skillRange = a.type === "skill" ? u.skills?.find((k) => k.name === a.skillName)?.range : undefined;
      const range = a.type === "skill" ? (skillRange ?? Math.max(tu.attackRange.max, 2)) : tu.attackRange.max;
      const reach = (id: string) => {
        const at = units.find((one) => one.id === id);
        return !!at && Math.abs(at.x - tu.x) + Math.abs(at.y - tu.y) <= range;
      };
      const apart = (a: string, b: string) => {
        const one = units.find((x) => x.id === a);
        const two = units.find((x) => x.id === b);
        return one && two ? Math.abs(one.x - two.x) + Math.abs(one.y - two.y) : Infinity;
      };
      aiPlays(s, tu.id, p.source);
      const rangeOf = (id: string) =>
        (units.find((one) => one.id === id) as TacticalUnit | undefined)?.attackRange.max ?? 1;
      performMarinaraTacticalAction(
        s.marinara,
        tu.id,
        action,
        s.seed,
        marinaraLog(s),
        near,
        reach,
        p.source,
        apart,
        rangeOf,
      );
      // A blow readied on the board remembers the tile it was aimed at: an area goes off there.
      const readier = s.marinara.fighters.find((one) => one.id === tu.id);
      if (readier?.charging && !readier.charging.at) {
        const mark = units.find((one) => one.id === readier.charging!.targetId);
        if (mark) readier.charging.at = { x: mark.x, y: mark.y };
      }
      tu.hasActed = true;
      if (a.type === "defend") tu.defending = true;
      queueMarinaraBonusTurns(s);
      sync(s);
    } else if (s.tactical && p.action.tactical) {
      const guarded = (p.guarded ?? []).map((id) => get(s, id) as TacticalUnit).filter(Boolean);
      const prior = guarded.map((x) => x.defending);
      guarded.forEach((x) => (x.defending = true));
      const events: TacticalCombatState["log"] = [];
      performTacticalUnitAction(s.tactical, u as TacticalUnit, p.action.tactical, events, !!p.skillId);
      guarded.forEach((x, i) => (x.defending = prior[i]!));
      for (const e of events) log(s, e.text, e.kind, e.actorId, p.source, e.message);
    } else if (p.action.classic && s.marinara && p.action.classic.type !== "item") {
      aiPlays(s, u.id, p.source);
      performMarinaraAction(s.marinara, u.id, p.action.classic, s.seed, false, marinaraLog(s), p.source);
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
      // An item changed HP the old way: the Classic Marinara fighters take the new numbers.
      if (s.marinara) {
        absorbItemResult(s.marinara, [...s.party, ...s.enemies]);
        const used = p.action.classic.type === "item" && !(p.action.classic.itemEffect as { failed?: string })?.failed;
        if (used) marinaraAfterItem(s.marinara, u.id, marinaraLog(s));
      }
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
    // A commanded ally's extra action done: one that hadn't had its own turn this round still has it.
    const owed = p.action.tactical?.type !== "move" ? s.marinaraOwed?.[u.id] : undefined;
    if (owed !== undefined) {
      delete s.marinaraOwed![u.id];
      if (!owed) {
        (u as TacticalUnit).hasActed = false;
        (u as TacticalUnit).hasMoved = false;
      }
    }
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
    if (s.outcome || s.window || s.mercy) return;
    const task = s.tasks.shift();
    if (!task) {
      s.actorId = undefined;
      if (s.tactical) {
        // By initiative (combat C6c) the next unit is the order's, whoever commands it; by side the
        // party chooses among its own first, then everybody else goes by speed.
        const remaining = living(s).filter((u) => !(u as TacticalUnit).hasActed);
        const party = remaining.filter((u) => side(u) === "party");
        // Classic Marinara: a party member who is asleep or stunned can't be begun, so its turn is
        // taken for it (its statuses still count down) before the party chooses.
        const held = s.marinara && !s.tactical.initiative ? party.find((u) => u.hp > 0 && !canAct(u)) : undefined;
        if (held) {
          s.tasks.push({ kind: "activate", unitId: held.id });
          continue;
        }
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
        delete s.marinaraOwed;
        s.round++;
        s.skipParty = false;
        s.gmCalls = 0;
        treasureFlees(s);
        // Classic Marinara on a board stops at the same round limit as Classic.
        if (s.marinara && s.round > MARINARA_ROUND_LIMIT && !s.outcome) {
          s.stalled = true;
          s.outcome = "flee";
          log(s, "Neither side can break the other; the fight breaks off.", "stalled");
          sync(s);
          continue;
        }
      } else if (s.marinara) {
        // Classic Marinara: one fighter at a time off the timeline; its turn starts here (damage over
        // time, effects counting down), and one asleep or stunned spends it without acting.
        const turn = nextMarinaraTurn(s.marinara, s.seed, false, marinaraLog(s));
        if (turn.round > s.round) {
          s.round = turn.round;
          s.gmCalls = 0;
        }
        // A treasure foe still standing after its rounds runs off on its turn, windfall and all.
        const runner = turn.actor?.windfall && turn.actor.side !== "party" ? get(s, turn.actor.id) : undefined;
        if (runner && s.round > turn.actor!.windfall!.fleeAfterRounds) {
          leaveFight(s, runner, "fled");
          sync(s);
          continue;
        }
        // Neither side can finish the other: the fight is called off with both standing.
        if (s.round > MARINARA_ROUND_LIMIT) {
          s.stalled = true;
          s.outcome = "flee";
          log(s, "Neither side can break the other; the fight breaks off.", "stalled");
          sync(s);
          continue;
        }
        sync(s);
        if (turn.actor) s.tasks.push({ kind: "activate", unitId: turn.actor.id });
        else if (!s.outcome) {
          s.stalled = true;
          s.outcome = "defeat";
          sync(s);
        }
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
    // Classic Marinara on a board: a held fighter's turn still starts (below), so it can wake.
    const boardTurn = task.kind === "activate" && !!s.marinara && !!s.tactical && !!u && u.hp > 0;
    if (!u || (!canAct(u) && !boardTurn)) {
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
      // Classic Marinara on a board: the fighter's own turn starts (statuses tick, stamina back); one
      // asleep, stunned or letting a charge go spends it there.
      const board = s.tactical && {
        reaches: (targetId: string, skillId: string) => {
          const from = u as TacticalUnit;
          const at = s.tactical?.units.find((one) => one.id === targetId);
          if (!at) return true;
          const range = from.skills?.find((k) => k.id === skillId)?.range ?? from.attackRange.max;
          return Math.abs(at.x - from.x) + Math.abs(at.y - from.y) <= range;
        },
        // A readied area goes off at the tile it was aimed at, over that tile and the ones next to it
        // (the board's area, as performMarinaraTacticalAction strikes it).
        around: (tile: { x: number; y: number } | undefined, targetId: string) => {
          const center = tile ?? s.tactical?.units.find((one) => one.id === targetId);
          if (!center) return [];
          return (s.tactical?.units ?? [])
            .filter((one) => Math.max(Math.abs(one.x - center.x), Math.abs(one.y - center.y)) <= 1)
            .map((one) => one.id);
        },
      };
      if (
        s.marinara &&
        s.tactical &&
        !marinaraTacticalTurnStart(s.marinara, u.id, s.seed, marinaraLog(s), board || undefined)
      ) {
        (u as TacticalUnit).hasActed = true;
        s.actorId = undefined;
        sync(s);
        continue;
      }
      if (s.marinara && s.tactical) sync(s);
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
            tactical: s.marinara
              ? marinaraBoardTurn(s, u as TacticalUnit)
              : (decideTacticalAction(s.tactical, u as TacticalUnit) as Extract<TacticalAction, { unitId: string }>),
          }
        : s.marinara
          ? { unitId: u.id, classic: marinaraTurn(s, u) }
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
  // A Marksman's ammunition is switched by hand at any time, as a free action (Alyssa 2026-11-01).
  if (command.type === "loadAmmo") {
    const u = get(s, command.unitId);
    const fighter = s.marinara ? marinaraFighter(s.marinara, command.unitId) : undefined;
    if (!u || side(u) !== "party" || !fighter || fighter.hp <= 0)
      throw new Error("Only a Marksman of the party loads ammunition.");
    if (!marinaraLoadAmmo(fighter, command.ammo)) throw new Error("The party owns no such ammunition.");
    log(s, `${u.name} loads ${command.ammo} ammunition.`, "marinara:ammo", u.id, source);
    sync(s);
    return;
  }
  // Channel Element: a bonus action, once between the caster's turns (Alyssa 2026-11-02).
  if (command.type === "channelElement") {
    const u = get(s, command.unitId);
    const fighter = s.marinara ? marinaraFighter(s.marinara, command.unitId) : undefined;
    if (!u || side(u) !== "party" || !fighter || fighter.hp <= 0 || !marinaraCanChannel(fighter))
      throw new Error("Only a Channeler of the party channels an element.");
    if (!marinaraChannelElement(fighter, command.element))
      throw new Error("They already channeled this turn, or that is not an element.");
    log(
      s,
      command.element === "arcane"
        ? `${u.name} unchannels, back to raw magic.`
        : `${u.name} channels ${command.element}.`,
      "marinara:channel",
      u.id,
      source,
    );
    sync(s);
    return;
  }
  // Foes who yielded wait on the party's word; a fallback or a carry-on spares them.
  if (s.mercy) {
    const choice =
      command.type === "mercy"
        ? command.choice
        : command.type === "fallback" || command.type === "continue"
          ? "spare"
          : undefined;
    if (!choice) throw new Error("Decide first whether to spare the foes who yielded.");
    resolveMercy(s, choice);
    return;
  }
  if (command.type === "mercy") throw new Error("No foe is waiting on mercy.");
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
    // Who channels and loads ammunition follows who now runs the companion.
    const fighter = s.marinara ? marinaraFighter(s.marinara, u.id) : undefined;
    if (fighter?.ammoOwned) fighter.ammoAuto = !manual(s, u);
    if (fighter && marinaraCanChannel(fighter)) fighter.channelManual = manual(s, u);
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
    // An action the caller says the AI chose (a harness or an auto turn) is played as the AI plays it.
    declare(s, a, source === "ai" ? "ai" : "manual");
  } else if (command.type === "continue") {
    if (s.stage === "action" || (s.stage === "select" && s.tactical) || s.window) return;
  }
  s.stage = "select";
  advanceCombatDirector(s);
}
