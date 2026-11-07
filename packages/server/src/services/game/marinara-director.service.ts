// ──────────────────────────────────────────────
// Game: Classic Marinara fights, as the combat director runs them
//
// A fight of a game on Marinara's own classes (no ruleset) keeps every combatant's Classic Marinara
// fighter (marinara-combat.ts) beside the director's own units. The fighter is the truth: its HP,
// MP, statuses and timeline; the director's units mirror it for screens, morale and the Game Master.
// Turns come off the timeline one at a time (faster fighters act more often), each resolved by the
// shared math, and every unit the player doesn't command is played by the Engine's combat AI
// (marinara-ai.ts) with its own temperament.
// ──────────────────────────────────────────────

import {
  MARINARA_TAME,
  MARINARA_SKILL_EFFECTS,
  MARINARA_ENEMY_SKILLS,
  MARINARA_COATING_TURNS,
  MARINARA_WEAPON_COATINGS,
  beginMarinaraTurn,
  chooseMarinaraAction,
  marinaraCoat,
  marinaraCombatantView,
  marinaraDefend,
  marinaraOption,
  marinaraPassiveHooks,
  marinaraRandom,
  marinaraRoundAt,
  marinaraSkillCost,
  marinaraSkillEffect,
  marinaraSkillEstimate,
  marinaraStruck,
  marinaraTargetsFor,
  marinaraRuneNeedsChannel,
  marinaraStatusImmune,
  marinaraUsable,
  marinaraStandsFront,
  nextMarinaraActor,
  performMarinaraOption,
  marinaraChargeIsArea,
  releaseMarinaraCharge,
  startMarinaraClock,
  registerMarinaraEnemySkills,
  MARINARA_BESTIARY_ABILITIES,
  type MarinaraFightGrowth,
  marinaraClass,
  marinaraGrantBonus,
  marinaraItemName,
  marinaraRollSteal,
  marinaraTierForLevel,
  type MarinaraFoeRank,
  type MarinaraItemPlace,
  type CombatItemEffect,
  type CombatPlayerAction,
  type CombatSkill,
  type CombatStatusEffect,
  type Combatant,
  type GameDifficulty,
  type MarinaraChoice,
  type MarinaraEvent,
  type MarinaraEffect,
  type MarinaraFighter,
  type MarinaraFightContext,
  type MarinaraOption,
  type RankedCombatCandidate,
} from "@marinara-engine/shared";

// The bestiary's foe abilities join the Engine's own (marinara-bestiary.ts; the bestiary's win a clash).
registerMarinaraEnemySkills(
  Object.fromEntries(
    MARINARA_BESTIARY_ABILITIES.map((ability) => [ability.id, { ...ability.effect, label: ability.label }]),
  ),
);

/** What a director keeps of a Classic Marinara fight. Plain JSON, saved with the fight. */
export interface MarinaraDirectorState {
  fighters: MarinaraFighter[];
  /** How many random streams the fight has drawn, so a replay draws the same rolls. */
  draws: number;
  /** Who did what to whom, for XP: damage dealt to each foe, healing and support given. */
  credit: Record<string, { damage: number; support: number; foes: string[] }>;
  /** Fighters that left the fight alive (surrendered, fled), off the timeline. */
  left?: MarinaraFighter[];
  /** What the party took from the fight, once it ended (summary.marinara). */
  growth?: MarinaraFightGrowth[];
  /** Where the fight is, for what Steal takes (named in the log as it happens). */
  place?: MarinaraItemPlace;
  /** The fight's loot seed, so a stolen thing is the one the loot would have rolled. */
  lootSeed?: string;
  /**
   * Why the Engine's AI picked each action, newest last: ALWAYS kept, whoever asked for the pick
   * (Alyssa 2026-11-03: the AI reasons log MUST be on for ALL playtesting, sims and balance runs; a
   * harness can't forget it). The director also writes them to its log as "marinara:reasoning".
   */
  aiReasons?: Array<{ unitId: string; round: number; text: string }>;
  /** Lab and panel harnesses only: when set, every recorded event is copied here (who did what, with
   *  which skill, for how much) so a harness can measure skills without parsing log text. */
  eventTap?: MarinaraEvent[];
}

/** How many AI reasons a fight keeps. */
export const MARINARA_AI_REASONS_KEPT = 600;

/** Keeps one AI pick's reasons on the fight state. */
export function keepMarinaraReasons(
  state: MarinaraDirectorState,
  unitId: string,
  round: number,
  ranking: ReadonlyArray<RankedCombatCandidate<MarinaraChoice>>,
): string | undefined {
  const text = marinaraPickReasons(state, unitId, ranking);
  if (!text) return undefined;
  state.aiReasons = [...(state.aiReasons ?? []), { unitId, round, text }].slice(-MARINARA_AI_REASONS_KEPT);
  return text;
}

export type MarinaraLog = (text: string, kind: string, actorId?: string, source?: string) => void;

const living = (fighters: readonly MarinaraFighter[]) => fighters.filter((f) => f.hp > 0);

export function createMarinaraDirectorState(fighters: MarinaraFighter[], seed: number): MarinaraDirectorState {
  const state: MarinaraDirectorState = { fighters: structuredClone(fighters), draws: 0, credit: {} };
  startMarinaraClock(state.fighters, marinaraRandom(`${seed}:clock`));
  return state;
}

function context(state: MarinaraDirectorState, seed: number, tactical: boolean): MarinaraFightContext {
  return { random: marinaraRandom(`${seed}:draw:${++state.draws}`), tactical, events: [] };
}

export function marinaraFighter(state: MarinaraDirectorState, id: string): MarinaraFighter | undefined {
  return state.fighters.find((f) => f.id === id);
}

/** Whether a skill is aimed at the user's own side (heals, buffs, guards). */
function alliedAim(aims: string | undefined): boolean {
  return aims === "ally" || aims === "self" || aims === "party" || aims === "downed-ally";
}

/** The skills a fighter shows on its menu: every active it has, usable now or not. */
/**
 * Casters' skills reach 3 tiles on a board (their basic attack stays at 2). With 2 they spent a third
 * to half of their turns guarding behind their own front line, out of reach (playtest 2026-11-01).
 */
export const MARINARA_BOARD_SPELL_RANGE: Partial<Record<string, number>> = { channeler: 3, hexer: 3, mender: 3 };

/** What a skill is to the board: by whom it lands on (a foe or a friend), then by what it does. */
function boardSkillType(kind: string, target: MarinaraEffect["target"]): CombatSkill["type"] {
  const atFoes = target === "enemy" || target === "all-enemies" || target === "front-row";
  if (atFoes) return kind === "damage" ? "attack" : "debuff";
  return kind === "heal" || kind === "revive" ? "heal" : "buff";
}

export function marinaraCombatSkills(
  fighter: MarinaraFighter,
  all?: readonly MarinaraFighter[],
  tactical = false,
): CombatSkill[] {
  const usable = new Set(marinaraUsable(fighter, all).map((o) => o.id));
  const out: CombatSkill[] = [];
  for (const skill of fighter.skills) {
    if (skill.kind !== "active") continue;
    const effect = marinaraSkillEffect(fighter, skill);
    if (!effect) {
      // Sic without a tamed companion is shown, greyed, so the player knows what it waits on (Sonnet
      // panel r4, 2026-11-03: it simply wasn't there).
      const base = MARINARA_SKILL_EFFECTS[skill.id];
      if (base?.companion && !fighter.companion) {
        const { resource, cost } = marinaraSkillCost(fighter, skill);
        out.push({
          id: skill.id,
          name: skill.label,
          description: skill.summary,
          type: boardSkillType(base.kind, base.target),
          mpCost: resource === "mp" ? cost : 0,
          ...(resource === "stamina" ? { staminaCost: cost } : {}),
          power: base.power ?? 0,
          aims: base.target,
          unavailable: "companion",
        });
      }
      continue;
    }
    const { resource, cost } = marinaraSkillCost(fighter, skill);
    const cooldown = fighter.cooldowns[skill.id] ?? 0;
    const used =
      !!(effect.oncePerFight || effect.usesPerFight) &&
      fighter.used.filter((id) => id === skill.id).length >= (effect.usesPerFight ?? 1);
    // What it would do now, from the fighter's own stats against whoever is in the fight.
    const estimate = all ? marinaraSkillEstimate(fighter, effect, all, tactical) : null;
    out.push({
      id: skill.id,
      name: skill.label,
      description: skill.summary,
      type: boardSkillType(effect.kind, effect.target),
      mpCost: resource === "mp" ? cost : 0,
      ...(resource === "stamina" ? { staminaCost: cost } : {}),
      power: effect.power ?? 0,
      ...(effect.cooldown ? { cooldown: effect.cooldown } : {}),
      ...(effect.target === "all-enemies" || effect.target === "front-row"
        ? { targetScope: "all-enemies" as const }
        : {}),
      ...(effect.damage === "magic" ? { spell: true } : {}),
      aims: effect.target,
      ...(MARINARA_BOARD_SPELL_RANGE[fighter.archetype ?? ""]
        ? { range: MARINARA_BOARD_SPELL_RANGE[fighter.archetype ?? ""] }
        : {}),
      ...(cooldown > 0 ? { readyIn: cooldown } : {}),
      ...(effect.bonusAction && effect.kind !== "extra-turn" && fighter.commanded ? { takesAction: true } : {}),
      ...(estimate ? { estimate } : {}),
      ...(!usable.has(skill.id)
        ? {
            unavailable: used
              ? ("used" as const)
              : cooldown > 0
                ? ("cooldown" as const)
                : effect.frontOnly && !marinaraStandsFront(fighter, all)
                  ? ("row" as const)
                  : all && effect.kind === "status" && !marinaraTargetsFor(fighter, effect, all).length
                    ? ("immune" as const)
                    : marinaraRuneNeedsChannel(fighter, effect)
                      ? ("unchanneled" as const)
                      : ("cost" as const),
          }
        : {}),
    });
  }
  for (const id of fighter.enemySkills ?? []) {
    const ability = MARINARA_ENEMY_SKILLS[id];
    if (!ability) continue;
    const cooldown = fighter.cooldowns[`enemy:${id}`] ?? 0;
    out.push({
      id: `enemy:${id}`,
      name: ability.label ?? id,
      type: boardSkillType(ability.kind, ability.target),
      mpCost: 0,
      power: ability.power ?? 0,
      aims: ability.target,
      ...(ability.cooldown ? { cooldown: ability.cooldown } : {}),
      ...(cooldown > 0 ? { readyIn: cooldown, unavailable: "cooldown" as const } : {}),
    });
  }
  return out;
}

/** Copies every fighter onto the director's unit of the same id. */
export function mirrorMarinaraUnits(state: MarinaraDirectorState, units: readonly Combatant[], tactical = false): void {
  for (const unit of units) {
    const fighter = marinaraFighter(state, unit.id);
    if (!fighter) continue;
    unit.hp = Math.max(0, Math.round(fighter.hp));
    unit.maxHp = fighter.maxHp;
    unit.mp = fighter.mp;
    unit.maxMp = fighter.maxMp;
    unit.level = fighter.level;
    unit.attack = Math.round(Math.max(fighter.stats.strength, fighter.stats.magic));
    unit.defense = Math.round(fighter.stats.defense);
    // At least 1: the legacy turn check reads 0 Speed as immobilized; the timeline floors speed itself.
    unit.speed = Math.max(1, Math.round(fighter.stats.speed));
    unit.skills = marinaraCombatSkills(fighter, state.fighters, tactical);
    unit.statusEffects = fighter.statuses.map((s): CombatStatusEffect => ({
      name: s.status,
      modifier: 0,
      stat: "hp",
      turnsLeft: s.turns,
    }));
    unit.marinara = marinaraCombatantView(fighter, state.fighters);
  }
}

/** A fighter's unit and the units it can be compared with, after a step. */
function nameOf(state: MarinaraDirectorState, id: string | undefined): string {
  return (id && marinaraFighter(state, id)?.name) || id || "?";
}

/** What a skill is called in the log. */
function skillLabel(fighter: MarinaraFighter | undefined, id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id.startsWith("enemy:")) return MARINARA_ENEMY_SKILLS[id.slice(6)]?.label ?? id.slice(6);
  if (id === "follow-through") return "Follow Through";
  if (id === "ammo-serrated") return "serrated ammunition";
  return fighter?.skills.find((s) => s.id === id)?.label ?? marinaraSkillLabel(id);
}

function marinaraSkillLabel(id: string): string {
  for (const def of [marinaraClass(id)]) if (def) return def.label;
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const STAT_WORDS: Record<string, string> = {
  strength: "Strength",
  magic: "Magic",
  skill: "Skill",
  speed: "Speed",
  defense: "Defense",
  resistance: "Resistance",
  luck: "Luck",
  damage: "damage",
  "damage-taken": "damage taken",
};

const STATUS_WORDS: Record<string, string> = {
  sleep: "falls asleep",
  stun: "is stunned",
  poison: "is poisoned",
  wither: "withers",
  bleed: "bleeds",
  wound: "is wounded (healing halved)",
  confuse: "is confused",
  doom: "is doomed",
  slow: "is slowed",
  regen: "regenerates",
  burn: "burns (4% of max HP a turn)",
  freeze: "is frozen (Speed -15%)",
  shock: "is shocked (attacks on them crit more)",
  entangle: "is entangled (hit chance -15%)",
  crumble: "crumbles (Defense -15%)",
  soak: "is soaked (Resistance -15%)",
  rend: "is rent (damage dealt -15%)",
  windswept: "is windswept (easier to hit)",
  sear: "is seared (damage taken +10%)",
};

/** One line of the log for one event, in plain words. */
export function marinaraEventText(state: MarinaraDirectorState, event: MarinaraEvent): string {
  const actor = nameOf(state, event.actorId);
  const target = nameOf(state, event.targetId);
  const skill = skillLabel(marinaraFighter(state, event.actorId), event.skillId);
  const using = skill ? ` with ${skill}` : "";
  // The roll in words: a d100 roll lands when it is under the chance (Haiku panel: "(63 vs 34%)" had no legend).
  const roll = event.chance !== undefined ? ` (rolled ${event.roll}, needed under ${event.chance})` : "";
  const how =
    event.affinity === "weak"
      ? ", a weak spot"
      : event.affinity === "resist"
        ? ", resisted"
        : event.affinity === "immune"
          ? ", immune"
          : "";
  // The rules a hit went through, said out loud (Alyssa 2026-11-02: hidden rules made the back row "feel fake").
  const rules = [
    event.halved ? "halved, melee into the back row" : "",
    event.shielded
      ? `a shield absorbed ${event.shielded}${event.shieldLeft ? `, ${event.shieldLeft} left` : ", now broken"}`
      : "",
    ...(event.notes ?? []).map((note) =>
      note === "Hold Fast"
        ? "less from Hold Fast"
        : note === "Kill Zone"
          ? "more from Kill Zone"
          : [
                "Sanctified",
                "Aura of Warding",
                "Unstoppable",
                "Shield Wall",
                "Grave Skin",
                "Living Runes",
                "Warding Runes",
                "Shield Line",
              ].includes(note)
            ? `less from ${note}`
            : [
                  "Bloodrage",
                  "Read the Signs",
                  "Dead Eye",
                  "Attunement",
                  "Rallying Presence",
                  "Pack Tactics",
                  "Battle Rhythm",
                  "Heavy Draw",
                  "Exploit Weakness",
                ].includes(note)
              ? `more from ${note}`
              : note === "Steady"
                ? "armour partly ignored (Steady)"
                : note === "Grave Hunger"
                  ? "Grave Hunger shifting Defense and Resistance"
                  : note === "True Aim" || note === "Keen Eye"
                    ? `landed thanks to ${note}`
                    : note.endsWith(" crit")
                      ? `the critical from ${note.slice(0, -5)}`
                      : note === "Assassinate"
                        ? "finished off by Assassinate"
                        : note === "Grand Inscription"
                          ? "more from Grand Inscription"
                          : note === "Adaptive Grip"
                            ? "armour's resistance ignored (Adaptive Grip)"
                            : note === "rune"
                              ? `${event.type ?? "element"} lent by runes`
                              : note,
    ),
  ]
    .filter(Boolean)
    .map((rule) => `, ${rule}`)
    .join("");
  switch (event.kind) {
    case "hit":
      // Sic: the beast is the one striking, so the line names it (playtest 2026-11-05: testers couldn't
      // tell Sic did anything).
      if (event.skillId === "sic") {
        const beast = marinaraFighter(state, event.actorId)?.companion?.name;
        if (beast)
          return `${actor}'s ${beast} strikes ${target} (Sic) for ${event.amount}${event.type ? ` ${event.type}` : ""}${event.crit ? ", a critical hit" : ""}${how}${rules}${roll}.`;
      }
      return `${actor} hits ${target}${using} for ${event.amount}${event.type ? ` ${event.type}` : ""}${event.crit ? ", a critical hit" : ""}${how}${rules}${roll}.`;
    case "miss":
      return event.skillId === "steal"
        ? `${actor} fails to steal from ${target}${roll}.`
        : `${actor} misses ${target}${using}${event.notes?.includes("Light Feet") ? ", dodged thanks to Light Feet" : ""}${roll}.`;
    case "evade":
      return `${target} slips away from ${actor}'s attack.`;
    case "absorb":
      return `${target} absorbs ${actor}'s ${event.type ?? "attack"} and heals ${event.amount}.`;
    case "rider":
      return `The ${event.type} on ${actor}'s weapon burns ${target} for ${event.amount}.`;
    case "heal":
      return event.status === "regen"
        ? `${actor} regenerates ${event.amount} HP.`
        : event.notes?.includes("drain")
          ? `${actor} drains ${event.amount} HP${skill ? ` (${skill})` : " (gear)"}.`
          : `${actor} heals ${target}${using} for ${event.amount}${event.crit ? ", a blessed heal (Grace)" : ""}.`;
    case "status":
      return event.status === "confuse" && event.targetId && event.actorId !== event.targetId && skill === undefined
        ? `${actor} lashes out in confusion at ${target}.`
        : `${target} ${STATUS_WORDS[event.status ?? ""] ?? `is afflicted with ${event.status}`}${using ? ` (${skill})` : ""}.`;
    case "resist":
      return event.why === "immune"
        ? `${target} is immune to ${skill ?? "it"}.`
        : event.why === "morale"
          ? `${target} shrugs off ${skill ?? "it"}, steadied by morale.`
          : event.why === "chance"
            ? `${skill ?? "It"} fails to take hold on ${target}${roll}.`
            : `${target} shrugs off ${skill ?? "it"}.`;
    case "slowed":
      return `${actor}'s Slow Time slows ${target} (Speed -${event.amount}% until their next turn).`;
    case "tick":
      return `${actor} takes ${event.amount} from ${event.status}.`;
    case "buff":
      return `${actor} uses ${skill ?? "a boon"}${event.targetId && event.targetId !== event.actorId ? ` on ${target}` : ""}${
        event.notes?.length
          ? ` (${event.notes.map((note) => (note === "Encore" ? "Encore: a turn longer" : note === "Tempo" ? "Tempo: acts sooner" : note)).join("; ")})`
          : ""
      }.`;
    case "debuff":
      return event.notes?.includes("sap") && event.status
        ? `${actor} saps ${Math.abs(event.amount ?? 0)}% of ${target}'s ${STAT_WORDS[event.status] ?? event.status} with ${skill ?? "a hex"}, and gains it for themselves.`
        : event.status && STAT_WORDS[event.status] && event.amount
          ? `${actor} uses ${skill ?? "a hex"} on ${target}: ${STAT_WORDS[event.status]} ${event.amount > 0 ? "+" : ""}${event.amount}%.`
          : event.status && STATUS_WORDS[event.status]
            ? `${target} ${STATUS_WORDS[event.status]} (${skill ?? actor}).`
            : `${actor} uses ${skill ?? "a hex"} on ${target}.`;
    case "cleanse":
      // What it cleared, by name (Sonnet panel r6); an empty list means there was nothing to clear.
      return event.notes
        ? event.notes.length
          ? `${skill ?? actor} clears ${target}'s ${event.notes.join(", ")}.`
          : `${actor} cleanses ${target}${using}: nothing to clear.`
        : `${actor} cleanses ${target}${using}.`;
    case "shield":
      return `${actor} shields ${target}${using} (${event.amount}).`;
    case "down":
      return event.actorId === event.targetId ? `${actor} falls.` : `${target} falls.`;
    case "revive":
      return `${actor} brings ${target} back${using} with ${event.amount} HP.`;
    case "counter":
      return `${actor} strikes back at ${target}.`;
    case "cover":
      return event.skillId ? `${actor} covers ${target}.` : `${actor} steps in front of ${target} and takes the blow.`;
    case "ward":
      return event.skillId
        ? `${actor} swears to watch over ${target}.`
        : `${actor} strikes at ${target} for threatening a ward.`;
    case "taunt":
      return `${actor} challenges ${target}.`;
    case "provoke":
      return `${actor} draws every foe's attention.`;
    case "skip":
      return `${actor} can't act (${event.status}).`;
    case "defend":
      return `${actor} defends.`;
    case "charge":
      return `${actor} readies ${skill ?? "a heavy blow"} at ${target}.`;
    case "charge-lost":
      return event.status === "reach"
        ? `${actor}'s ${skill ?? "readied blow"} goes off at empty ground: ${target} moved out of reach.`
        : event.status === "area"
          ? `${actor}'s ${skill ?? "readied blow"} goes off at empty ground: nobody is left where it was aimed.`
          : `${actor}'s ${skill ?? "readied blow"} is lost (${event.status === "stun" ? "stunned" : "put to sleep"}).`;
    case "extra-turn": {
      // A bonus-action skill leaves the user their action; anything else grants one more.
      const effect = event.skillId ? MARINARA_SKILL_EFFECTS[event.skillId] : undefined;
      return effect?.bonusAction && effect.kind !== "extra-turn"
        ? `${skill} is a bonus action: ${actor} still acts this turn.`
        : `${actor} gains an extra action${skill ? ` (${skill})` : ""}.`;
    }
    case "command":
      return `On ${actor}'s command${skill ? ` (${skill})` : ""}, ${target} acts at once.`;
    case "last-stand":
      return `${actor} refuses to fall (Last Stand).`;
    case "passive":
      return event.skillId === "mana-tide"
        ? `${actor} regains ${event.amount} MP (Mana Tide).`
        : event.skillId === "hold-the-line"
          ? `${actor} steps up first (Hold the Line).`
          : event.skillId === "sundering"
            ? `${actor}'s blow lowers ${target}'s Defense (Sundering).`
            : event.status === "bonus-spent"
              ? `${actor} already used this turn's bonus action, so ${skill ?? "it"} takes the action.`
              : `${actor}'s ${skill ?? "passive"} takes effect.`;
    case "miracle":
      return `${actor}'s miracle keeps ${target} standing.`;
    case "hold-the-line":
      return `${actor} holds the line against ${target}.`;
    case "tame":
      return `${actor} tames ${target}${roll}: it follows ${actor} now.`;
    case "steal":
      return event.status === "empty"
        ? `${actor} finds nothing left on ${target}.`
        : event.item
          ? `${actor} steals ${/^[aeiou]/i.test(event.item) ? "an" : "a"} ${event.item} from ${target}${roll}.`
          : event.amount
            ? `${actor} steals ${event.amount} gold from ${target}${roll}.`
            : `${actor} steals from ${target}${roll}.`;
    case "decoy":
      return `A decoy takes ${actor}'s blow meant for ${target}${event.amount ? ` (${event.amount} left)` : " (the last one)"}.`;
    case "oath":
      return `${actor} keeps standing on the oath.`;
    case "siphon":
      return event.status
        ? `${actor} siphons ${target}'s ${event.status} boost.`
        : `${actor} drains ${event.amount} MP from ${target}.`;
    case "restore":
      return `${actor} uses ${skill ?? "a rallying word"} on ${target}: ${event.amount} ${event.status === "mp" ? "MP" : "stamina"} back.`;
    case "drain-resource":
      return `${actor} drains ${event.amount} ${event.notes?.[0] === "mp" ? "MP" : "stamina"} from ${target}${skill ? ` (${skill})` : ""}${
        event.notes?.[0] !== event.status ? `, gaining it as ${event.status === "mp" ? "MP" : "stamina"}` : ""
      }.`;
    case "channel":
      return event.type === "arcane"
        ? `${actor} lets their element go, back to raw magic.`
        : `${actor} channels ${event.type}.`;
  }
}

/**
 * Says when a side's back row becomes its front (its last front-liner fell) and when it steps behind
 * again (one is brought back): every row rule follows marinaraRowOf, and players had no way to tell
 * (Haiku panel 2026-11-01: Grave Tithe "front only" used from the back row).
 */
function rowNotices(state: MarinaraDirectorState, events: readonly MarinaraEvent[], log: MarinaraLog) {
  const told = new Set<string>();
  for (const event of events) {
    if (event.kind !== "down" && event.kind !== "revive") continue;
    const unit = marinaraFighter(state, event.targetId ?? event.actorId);
    if (!unit || unit.row !== "front") continue;
    const side = state.fighters.filter((one) => one.side === unit.side && one.hp > 0);
    const front = side.filter((one) => one.row === "front");
    const back = side.filter((one) => one.row === "back");
    if (!back.length || told.has(`${unit.side}:${event.kind}`)) continue;
    told.add(`${unit.side}:${event.kind}`);
    const whose = unit.side === "party" ? "the party's" : "the foes'";
    if (event.kind === "down" && !front.length)
      log(`Nobody stands in ${whose} front row now: its back row is the front.`, "marinara:row", unit.id);
    else if (event.kind === "revive" && front.length === 1 && front[0]!.id === unit.id)
      log(`${unit.name} is back in front: ${whose} back row is behind again.`, "marinara:row", unit.id);
  }
}

/** Logs a step's events and credits who helped, for XP. */
/** Steal: decides what was taken as it happens, so the log can name it (Alyssa 2026-11-02). */
function resolveSteal(state: MarinaraDirectorState, event: MarinaraEvent) {
  if (event.kind !== "steal" || event.status === "empty" || !state.place || !state.lootSeed) return;
  const foe = event.targetId ? marinaraFighter(state, event.targetId) : undefined;
  if (!foe) return;
  foe.stolen ??= marinaraRollSteal({
    tier: marinaraTierForLevel(foe.level),
    rank: (foe.tier ?? "standard") as MarinaraFoeRank,
    place: state.place,
    ...(foe.familyId ? { family: foe.familyId } : {}),
    seed: `${state.lootSeed}:${foe.id}`,
  });
  if ("item" in foe.stolen) event.item = marinaraItemName(foe.stolen.item, state.place);
  else event.amount = foe.stolen.gold;
}

/** A boon on several of one side at once (Rally, War Cry, Fortress) reads as one line, not one per
 *  friend (Sonnet panel 2026-11-02: "Rally -> Dagny" read as a single target). */
function boonGroupText(state: MarinaraDirectorState, group: readonly MarinaraEvent[]): string {
  const first = group[0]!;
  const actor = nameOf(state, first.actorId);
  const skill = skillLabel(marinaraFighter(state, first.actorId), first.skillId) ?? "a boon";
  const names = group.map((event) =>
    !event.targetId || event.targetId === event.actorId ? "themselves" : nameOf(state, event.targetId),
  );
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `${actor} uses ${skill} on their side: ${list}.`;
}

function record(state: MarinaraDirectorState, ctx: MarinaraFightContext, log: MarinaraLog, source?: string) {
  let grouped = 0;
  for (const [index, event] of ctx.events.entries()) {
    resolveSteal(state, event);
    if (grouped > 0) grouped--;
    else if (event.kind === "buff") {
      const group = [event];
      for (let at = index + 1; at < ctx.events.length; at++) {
        const next = ctx.events[at]!;
        if (next.kind !== "buff" || next.actorId !== event.actorId || next.skillId !== event.skillId) break;
        group.push(next);
      }
      if (group.length > 1) {
        grouped = group.length - 1;
        log(boonGroupText(state, group), `marinara:${event.kind}`, event.actorId, source);
      } else log(marinaraEventText(state, event), `marinara:${event.kind}`, event.actorId, source);
    } else log(marinaraEventText(state, event), `marinara:${event.kind}`, event.actorId, source);
    if (state.eventTap) state.eventTap.push({ ...event });
    const credit = (state.credit[event.actorId] ??= { damage: 0, support: 0, foes: [] });
    const target = event.targetId ? marinaraFighter(state, event.targetId) : undefined;
    const actor = marinaraFighter(state, event.actorId);
    if ((event.kind === "hit" || event.kind === "rider") && target && actor && target.side !== actor.side) {
      credit.damage += event.amount ?? 0;
      if (!credit.foes.includes(target.id)) credit.foes.push(target.id);
    } else if (
      (event.kind === "heal" && !event.notes?.includes("drain")) ||
      event.kind === "revive" ||
      event.kind === "shield"
    )
      credit.support += event.amount ?? 0;
    else if (
      ["buff", "debuff", "status", "cover", "ward", "taunt", "provoke", "command", "cleanse", "restore"].includes(
        event.kind,
      )
    )
      credit.support += 5;
  }
  rowNotices(state, ctx.events, log);
  ctx.events.length = 0;
}

/**
 * Takes fighters off the timeline until one may act: each one's turn starts (its damage over time
 * ticks, effects count down), and one asleep, stunned or charging spends its turn there. Returns the
 * fighter whose turn it is, or none when one side is down.
 */
export function nextMarinaraTurn(
  state: MarinaraDirectorState,
  seed: number,
  tactical: boolean,
  log: MarinaraLog,
): { actor?: MarinaraFighter; round: number } {
  for (let guard = 0; guard < 200; guard++) {
    const sides = new Set(living(state.fighters).map((f) => f.side));
    if (sides.size < 2) return { round: roundOf(state) };
    const actor = nextMarinaraActor(state.fighters);
    if (!actor) return { round: roundOf(state) };
    const round = marinaraRoundAt(actor.next);
    const ctx = context(state, seed, tactical);
    const start = beginMarinaraTurn(actor, state.fighters, ctx);
    record(state, ctx, log);
    if (start.release) {
      releaseMarinaraCharge(actor, start.release, state.fighters, ctx);
      record(state, ctx, log);
      continue;
    }
    if (start.acts) return { actor, round };
  }
  return { round: roundOf(state) };
}

function roundOf(state: MarinaraDirectorState): number {
  const soonest = nextMarinaraActor(state.fighters);
  return soonest ? marinaraRoundAt(soonest.next) : 1;
}

/** The fighters a target id stands for, checked against what the option can be aimed at. */
function aimedAt(
  state: MarinaraDirectorState,
  actor: MarinaraFighter,
  option: MarinaraOption,
  targetId: string | undefined,
): MarinaraFighter[] | string {
  const effect = option.effect;
  if (effect.target === "self" || effect.target === "party" || effect.target === "all-enemies")
    return marinaraTargetsFor(actor, effect, state.fighters).slice(0, 1);
  const target = targetId ? marinaraFighter(state, targetId) : undefined;
  if (!target) return "Invalid target.";
  const pool = marinaraTargetsFor(actor, effect, state.fighters);
  if (effect.target === "front-row") return pool.length ? [target] : "Invalid target.";
  if (!pool.includes(target)) {
    if (actor.tauntTurns > 0 && actor.tauntedBy && effect.target === "enemy")
      return `${nameOf(state, actor.tauntedBy)} has challenged ${actor.name}: it must be the target.`;
    // A provoker draws the blows (slice tester s8: an attack on another foe came out as Defend).
    const provokers = pool.filter((one) => one.provoking > 0);
    if (effect.target === "enemy" && provokers.length && provokers.length === pool.length)
      return `${provokers.map((one) => one.name).join(" or ")} draws ${actor.name}'s blows: strike ${provokers.length > 1 ? "one of them" : "it"} instead.`;
    // Said, not a wasted turn (slice tester s5, 2026-11-06: Tame on a whole beast came out as Defend).
    if (effect.kind === "tame")
      return target.tameable
        ? `${target.name} is too strong to tame: only below ${Math.round(MARINARA_TAME.belowHp * 100)}% HP.`
        : `${target.name} can't be tamed.`;
    return "Invalid target.";
  }
  return [target];
}

/** Why a Classic action can't be taken now, or null when it can. */
export function marinaraActionProblem(
  state: MarinaraDirectorState,
  unitId: string,
  action: CombatPlayerAction,
): string | null {
  const actor = marinaraFighter(state, unitId);
  if (!actor || actor.hp <= 0) return "Combatant cannot act.";
  if (action.type === "defend" || action.type === "flee") return null;
  if (action.type === "item") {
    const coating = MARINARA_WEAPON_COATINGS.find((c) => c.label === action.itemId || c.id === action.itemId);
    if (coating && actor.side !== "party") return "Item unavailable.";
    return null;
  }
  const option = marinaraOption(actor, action.type === "attack" ? null : action.skillId, state.fighters);
  if (!option) return action.type === "skill" ? "Skill unavailable." : "Combatant cannot attack.";
  const aimed = aimedAt(state, actor, option, action.targetId);
  return typeof aimed === "string" ? aimed : null;
}

/** Resolves one Classic action of a fighter's and logs it. Items are the director's, except a
 *  coating, which this applies. */
export function performMarinaraAction(
  state: MarinaraDirectorState,
  unitId: string,
  action: CombatPlayerAction,
  seed: number,
  tactical: boolean,
  log: MarinaraLog,
  source?: string,
): void {
  const actor = marinaraFighter(state, unitId);
  if (!actor) throw new Error("Combatant cannot act.");
  const ctx = context(state, seed, tactical);
  if (action.type === "defend") {
    marinaraDefend(actor, ctx);
  } else if (action.type === "item") {
    const coating = MARINARA_WEAPON_COATINGS.find((c) => c.label === action.itemId || c.id === action.itemId);
    if (coating) {
      marinaraCoat(actor, coating.rider, MARINARA_COATING_TURNS);
      log(`${actor.name} coats their weapon with ${coating.label}.`, "marinara:item", actor.id, source);
    }
  } else if (action.type === "attack" || action.type === "skill") {
    const option = marinaraOption(actor, action.type === "attack" ? null : action.skillId, state.fighters);
    if (!option) throw new Error("Skill unavailable.");
    const aimed = aimedAt(state, actor, option, action.targetId);
    if (typeof aimed === "string") throw new Error(aimed);
    performMarinaraOption(actor, option, aimed, state.fighters, ctx);
  }
  record(state, ctx, log, source);
}

/**
 * A Tactical fighter's turn starting (Classic Marinara on a board): its statuses tick, its stamina
 * comes back and its cooldowns count down. Returns whether it acts; one that was charging lets the
 * charge go instead, on the one it aimed at.
 */
export function marinaraTacticalTurnStart(
  state: MarinaraDirectorState,
  unitId: string,
  seed: number,
  log: MarinaraLog,
  /** On the board: whether a readied single-target blow still reaches its target from where the unit
   *  stands, and who stands in the area of a readied area blow where it goes off. */
  board?: {
    reaches: (targetId: string, skillId: string) => boolean;
    around: (at: { x: number; y: number } | undefined, targetId: string) => string[];
  },
): boolean {
  const actor = marinaraFighter(state, unitId);
  if (!actor || actor.hp <= 0) return false;
  const ctx = context(state, seed, true);
  const start = beginMarinaraTurn(actor, state.fighters, ctx);
  const release = start.release;
  if (release && board) {
    // A telegraphed blow lands only where its target still is (owner 2026-11-06). A single-target one
    // misses a target that walked out of reach; an area one goes off at the tile it was aimed at and
    // lands on every foe still standing in it (playtest r69: a Quake hit nobody once its mark moved).
    const area = marinaraChargeIsArea(actor, release.skillId);
    const aimed = marinaraFighter(state, release.targetId);
    const inArea = area
      ? board.around(release.at, release.targetId).filter((id) => {
          const one = marinaraFighter(state, id);
          return !!one && one.hp > 0 && one.side !== actor.side;
        })
      : undefined;
    const lost = area ? !inArea!.length : !!aimed && aimed.hp > 0 && !board.reaches(aimed.id, release.skillId);
    if (lost) {
      ctx.events.push({
        kind: "charge-lost",
        actorId: actor.id,
        targetId: release.targetId,
        skillId: release.skillId,
        status: area ? "area" : "reach",
      });
      record(state, ctx, log);
      return false;
    }
    record(state, ctx, log);
    const go = { ...context(state, seed, true), grouped: false };
    releaseMarinaraCharge(actor, release, state.fighters, go, inArea);
    record(state, go, log);
    return false;
  }
  record(state, ctx, log);
  if (release) {
    const go = { ...context(state, seed, true), grouped: false };
    releaseMarinaraCharge(actor, release, state.fighters, go);
    record(state, go, log);
    return false;
  }
  return start.acts;
}

/**
 * A Tactical action on Classic Marinara math. The board has already said who is in reach; an area
 * lands on the one aimed at and every foe of theirs within `areaRadius` tiles of them (decided
 * 2026-11-01: the board's area, not the whole side as in Classic). A skill that can't be used now
 * becomes a basic attack on the same target.
 */
export function performMarinaraTacticalAction(
  state: MarinaraDirectorState,
  unitId: string,
  action: CombatPlayerAction,
  seed: number,
  log: MarinaraLog,
  near: (id: string) => string[],
  reach: (id: string) => boolean,
  source?: string,
  /** Tiles between two units on the board. */
  apart?: (a: string, b: string) => number,
  /** A unit's attack reach on the board, in tiles. */
  rangeOf?: (id: string) => number,
): void {
  const actor = marinaraFighter(state, unitId);
  if (!actor) throw new Error("Combatant cannot act.");
  // On the board, what each fighter can reach is the foes next to it as they stand now (Grave
  // Hunger, Sworn Ward's strike back).
  for (const fighter of state.fighters)
    if (fighter.hp > 0) {
      fighter.nearFoes = near(fighter.id).filter((id) => marinaraFighter(state, id)?.side !== fighter.side);
      if (apart && fighter.skills.some((skill) => skill.id === "grave-hunger"))
        fighter.spellFoes = state.fighters
          .filter((foe) => foe.side !== fighter.side && apart(fighter.id, foe.id) <= MARINARA_BOARD_SPELL_RANGE.hexer!)
          .map((foe) => foe.id);
      // Return Fire answers only an attacker its own shots reach on the board (panel r7: across the map).
      if (apart && rangeOf && fighter.skills.some((skill) => skill.id === "return-fire"))
        fighter.shotFoes = state.fighters
          .filter((foe) => foe.side !== fighter.side && apart(fighter.id, foe.id) <= rangeOf(fighter.id))
          .map((foe) => foe.id);
    }
  const ctx = { ...context(state, seed, true), grouped: false };
  if (action.type === "defend") marinaraDefend(actor, ctx);
  else if (action.type === "attack" || action.type === "skill") {
    let option =
      (action.type === "skill" ? marinaraOption(actor, action.skillId, state.fighters) : undefined) ??
      marinaraOption(actor, null);
    if (!option) throw new Error("Combatant cannot attack.");
    const picked = action.targetId ? marinaraFighter(state, action.targetId) : undefined;
    // A skill for a friend aimed somewhere it can't land (a foe, the user itself for a guard, a
    // living one for a revive) goes to the friend who needs it most; with no such friend it becomes
    // a basic attack on a foe in reach, or a guard if there is none (playtest 2026-11-01: the board
    // AI aims these loosely, and a turn must never fail).
    if (option.effect.target === "ally" || option.effect.target === "downed-ally") {
      const friends = marinaraTargetsFor(actor, option.effect, state.fighters);
      if (!(picked && friends.includes(picked))) {
        const neediest = [...friends].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (neediest) action = { ...action, targetId: neediest.id };
        else {
          const basic = marinaraOption(actor, null);
          const foe = basic && marinaraTargetsFor(actor, basic.effect, state.fighters).find((one) => reach(one.id));
          if (!basic || !foe) {
            marinaraDefend(actor, ctx);
            record(state, ctx, log, source);
            return;
          }
          option = basic;
          action = { type: "attack", targetId: foe.id };
        }
      }
    }
    const effect = option.effect;
    const aimedAt = action.targetId ? marinaraFighter(state, action.targetId) : undefined;
    let struck: MarinaraFighter[];
    if (effect.target === "self" || effect.target === "party")
      struck = marinaraStruck(actor, effect, [], state.fighters);
    else {
      const pool = marinaraTargetsFor(actor, effect, state.fighters);
      const picked = aimedAt;
      let aim = picked && pool.includes(picked) ? picked : undefined;
      // An area blow from a provoked foe is centred on the provoker when it can reach it.
      if (effect.target === "all-enemies" || effect.target === "front-row") {
        const provoker = pool.find((one) => one.provoking > 0 && reach(one.id));
        if (provoker) aim = provoker;
      }
      // A challenge or a provoker forces the pick only when it can be reached from where the unit
      // stands; otherwise the board's pick stands (a foe it can't reach can't be made its target).
      if (!aim && picked && picked.hp > 0 && picked.side !== actor.side && effect.target !== "ally") {
        const anyFoe = marinaraTargetsFor(actor, { ...effect, target: "all-enemies" }, state.fighters);
        aim = pool.find((one) => reach(one.id)) ?? (anyFoe.includes(picked) ? picked : undefined);
      }
      // Nobody the board picked can be hit: a foe in reach, else a guard.
      aim ??= pool.find((one) => one.side !== actor.side && reach(one.id));
      if (!aim) {
        marinaraDefend(actor, ctx);
        record(state, ctx, log, source);
        return;
      }
      struck =
        effect.target === "all-enemies" || effect.target === "front-row"
          ? [aim, ...pool.filter((one) => one !== aim && near(aim.id).includes(one.id))]
          : [aim];
      // Every redirect is said (Sonnet panel r5, 2026-11-03: a Lull aimed at the boss landed on
      // another foe with no word why).
      if (picked && picked !== aim && picked.side !== actor.side && effect.target === "enemy") {
        const what = option.skill?.label ?? "attack";
        const why =
          actor.tauntTurns > 0 && actor.tauntedBy === aim.id
            ? `${aim.name}'s challenge holds ${actor.name}`
            : aim.provoking > 0
              ? `${aim.name} provokes and draws it`
              : `${picked.name} can't be reached from there`;
        log(
          `${actor.name}'s ${what} goes to ${aim.name} instead of ${picked.name}: ${why}.`,
          "marinara:redirect",
          actor.id,
        );
      }
    }
    performMarinaraOption(actor, option, struck, state.fighters, ctx);
  }
  record(state, ctx, log, source);
}

/** An item the director resolved its own way changed HP: the fighters take the new numbers. */
/** What an item does in a fighter's hands: Item Savant makes it work 50% better. */
export function marinaraItemPower<T extends CombatItemEffect | undefined>(
  state: MarinaraDirectorState,
  unitId: string,
  effect: T,
): T {
  const fighter = marinaraFighter(state, unitId);
  const pct = fighter ? (marinaraPassiveHooks(fighter.skills).itemPowerPct ?? 0) : 0;
  if (!effect || !pct || effect.power === undefined) return effect;
  return { ...effect, power: Math.round(effect.power * (1 + pct)) };
}

/** Double Dose: the first item a fighter uses in a round gives it another action. Returns whether it did. */
export function marinaraAfterItem(state: MarinaraDirectorState, unitId: string, log: MarinaraLog): boolean {
  const fighter = marinaraFighter(state, unitId);
  if (!fighter || fighter.hp <= 0 || fighter.freeItemUsed || fighter.commanded) return false;
  if (!marinaraPassiveHooks(fighter.skills).freeItem) return false;
  fighter.freeItemUsed = true;
  marinaraGrantBonus(fighter, state.fighters);
  log(`${fighter.name} gains an extra action (Double Dose).`, "marinara:extra-turn", fighter.id);
  return true;
}

export function absorbItemResult(state: MarinaraDirectorState, units: readonly Combatant[]): void {
  for (const unit of units) {
    const fighter = marinaraFighter(state, unit.id);
    if (!fighter) continue;
    if (fighter.hp <= 0 && unit.hp > 0) fighter.statuses = [];
    fighter.hp = Math.max(0, Math.min(fighter.maxHp, unit.hp));
    if (unit.mp !== undefined) fighter.mp = Math.max(0, Math.min(fighter.maxMp, unit.mp));
  }
}

/** The Classic action a choice stands for. */
export function marinaraChoiceAction(actor: MarinaraFighter, choice: MarinaraChoice): CombatPlayerAction {
  if (choice.optionId === "defend") return { type: "defend" };
  const targetId = choice.targetIds[0] ?? actor.id;
  return choice.optionId === null
    ? { type: "attack", targetId }
    : { type: "skill", skillId: choice.optionId, targetId };
}

/**
 * The AI plays this turn, so it channels and loads ammunition as an AI-run fighter does (review
 * 2026-11-02: a companion handed to the AI mid-fight, or any Tactical companion, kept the player's
 * by-hand setting and never channeled; every harness run played its casters unchanneled too).
 */
function aiRuns(actor: MarinaraFighter): void {
  if (actor.channelManual) actor.channelManual = false;
  if (actor.ammoOwned && !actor.ammoAuto) actor.ammoAuto = true;
}

/** What the Engine's combat AI does with this fighter's turn. */
export function marinaraAiAction(
  state: MarinaraDirectorState,
  unit: Combatant,
  round: number,
  difficulty: GameDifficulty,
  tactical: boolean,
  ranked?: (ranking: Array<RankedCombatCandidate<MarinaraChoice>>) => void,
  explain?: (ranking: Array<RankedCombatCandidate<MarinaraChoice>>) => void,
): CombatPlayerAction {
  const actor = marinaraFighter(state, unit.id);
  if (!actor || !unit.tactics) return { type: "defend" };
  aiRuns(actor);
  const choice = chooseMarinaraAction(actor, state.fighters, { ...unit, tactics: unit.tactics }, round, difficulty, {
    tactical,
    ...(ranked
      ? { ranked }
      : {
          // Always explained and kept (the reasons log is never off); the caller hears it too.
          explain: (ranking: Array<RankedCombatCandidate<MarinaraChoice>>) => {
            keepMarinaraReasons(state, unit.id, round, ranking);
            explain?.(ranking);
          },
        }),
  });
  return marinaraChoiceAction(actor, choice);
}

/**
 * What the Engine's Marinara AI does on a board, standing at `from` (where the board AI would move
 * it): the same ranking as Classic, with foes narrowed to those in reach from there (a basic attack
 * reaches the unit's attack range, a skill at least 2 tiles; a friend 2 tiles). The board AI keeps the moving (playtest 2026-11-01: the generic board AI
 * played Marinara kits badly: Steal spam, buffs first, casters idle).
 */
export function marinaraBoardAiAction(
  state: MarinaraDirectorState,
  unit: Combatant,
  round: number,
  difficulty: GameDifficulty,
  distance: (targetId: string) => number,
  attackRange: number,
  /** Whether a fighter could reach a foe with one more action (move and act) from where it stands. */
  canStrike?: (unitId: string) => boolean,
  /** Whether one fighter could reach another this round (a move and its reach). */
  reaches?: (fromId: string, toId: string) => boolean,
  explain?: (ranking: Array<RankedCombatCandidate<MarinaraChoice>>) => void,
  /** The board's own check: whether this option at this target passes from where the unit will stand
   *  (sight, minimum range, a skill's own range). Without it, distance alone. */
  fits?: (optionId: string | null, targetId: string) => boolean,
  /** Bound to its provoker or challenger: the lock holds wherever it stands (the board walks it in). */
  bind?: boolean,
  /** On the board: the chance a readied blow's target is still in reach when it goes off. */
  stays?: (option: MarinaraOption, target: MarinaraFighter) => number,
): CombatPlayerAction | null {
  const actor = marinaraFighter(state, unit.id);
  if (!actor || !unit.tactics) return null;
  aiRuns(actor);
  // Friends within the board's support range (2 tiles, a caster's 3); the user itself, a whole side and the
  // fallen (whom the board can't aim at; resolution finds them) anywhere.
  // With the board's check, also sight and minimum range (reasons audit 2026-11-03: 2% of Tactical
  // turns fell back on the board AI's own move, mostly marksmen aiming past cover or too close).
  const reach = (option: MarinaraOption, target: MarinaraFighter) =>
    target.id === actor.id ||
    option.effect.target === "party" ||
    option.effect.target === "downed-ally" ||
    (distance(target.id) <=
      (option.id === null
        ? attackRange
        : (MARINARA_BOARD_SPELL_RANGE[actor.archetype ?? ""] ??
          (target.side === actor.side ? 2 : Math.max(attackRange, 2)))) &&
      (!fits || fits(option.id, target.id)));
  // A challenge or a provoker forces the pick only when it can be reached (the board's resolution,
  // performMarinaraTacticalAction): one out of reach doesn't lock out the foes next to the unit
  // (Sonnet panel r3, 2026-11-02: casters beside a foe defended for rounds while a distant Warding
  // Stance foe was the only target they were offered).
  // Whether anything the unit can do lands on this foe from where it will stand. A lock on a foe it
  // can't strike (two tiles off a melee unit, past a wall or out of sight) leaves it nothing to do, and
  // resolution lets the blow go to a foe in reach instead (playtest r38: 0.19% of party turns were
  // "nothing to strike" beside a foe while a Provoker stood just out of reach).
  const options = marinaraUsable(actor, state.fighters).filter(
    (option) =>
      option.effect.target !== "self" &&
      option.effect.target !== "party" &&
      option.effect.target !== "ally" &&
      option.effect.target !== "downed-ally",
  );
  const strikes = (foe: MarinaraFighter) =>
    options.some((option) => reach(option, foe) && !marinaraStatusImmune(foe, option.effect));
  const unforced: Array<() => void> = [];
  for (const foe of state.fighters)
    if (!bind && foe.side !== actor.side && foe.provoking > 0 && !strikes(foe)) {
      const turns = foe.provoking;
      foe.provoking = 0;
      unforced.push(() => (foe.provoking = turns));
    }
  const taunter = actor.tauntTurns > 0 && actor.tauntedBy ? marinaraFighter(state, actor.tauntedBy) : undefined;
  if (!bind && actor.tauntTurns > 0 && actor.tauntedBy && (!taunter || !strikes(taunter))) {
    const turns = actor.tauntTurns;
    actor.tauntTurns = 0;
    unforced.push(() => (actor.tauntTurns = turns));
  }
  const tactics = unit.tactics;
  const pick = () => {
    let ranked: Array<RankedCombatCandidate<MarinaraChoice>> = [];
    const choice = chooseMarinaraAction(actor, state.fighters, { ...unit, tactics }, round, difficulty, {
      tactical: true,
      canStrike,
      reaches,
      stays,
      explain: (ranking) => (ranked = ranking),
      reach,
    });
    return { choice, ranked };
  };
  try {
    let { choice, ranked } = pick();
    // A lock that still leaves nothing but Defend (a provoker the board accepts but the AI can't take
    // as a target, playtest r39: Pell beside Kingpin while a Vanished Ghost Fixer drew fire): the
    // lock doesn't hold, as above.
    const locked = state.fighters.some((foe) => foe.side !== actor.side && foe.provoking > 0) || actor.tauntTurns > 0;
    if (!bind && locked && ranked.every((one) => one.candidate.action.optionId === "defend")) {
      for (const foe of state.fighters)
        if (foe.side !== actor.side && foe.provoking > 0) {
          const turns = foe.provoking;
          foe.provoking = 0;
          unforced.push(() => (foe.provoking = turns));
        }
      if (actor.tauntTurns > 0) {
        const turns = actor.tauntTurns;
        actor.tauntTurns = 0;
        unforced.push(() => (actor.tauntTurns = turns));
      }
      const again = pick();
      if (again.ranked.some((one) => one.candidate.action.optionId !== "defend")) ({ choice, ranked } = again);
    }
    explain?.(ranked);
    return marinaraChoiceAction(actor, choice);
  } catch {
    return null;
  } finally {
    for (const restore of unforced) restore();
  }
}

/** How small a part of a pick's score is too small to give as a reason. */
const MARINARA_REASON_FLOOR = 0.005;

/** A ranked choice in words: the option and who it is aimed at. */
function marinaraChoiceLabel(state: MarinaraDirectorState, actor: MarinaraFighter, choice: MarinaraChoice): string {
  const option =
    choice.optionId === "defend"
      ? "Defend"
      : choice.optionId === null
        ? "Attack"
        : (skillLabel(actor, choice.optionId) ?? choice.optionId);
  const targets =
    choice.optionId === "defend"
      ? []
      : choice.targetIds.map((id) => (id === actor.id ? "themselves" : nameOf(state, id)));
  return targets.length ? `${option} on ${targets.join(", ")}` : option;
}

/**
 * Why the Engine's AI picked what it did (Debug log; Alyssa's rule from the 5e playtests: every
 * playtest runs with the AI's reasons): the pick and its score, its two or three largest score parts
 * with their numbers, and the runner-up with its score. Read back from its own scoring, never a model.
 */
export function marinaraPickReasons(
  state: MarinaraDirectorState,
  actorId: string,
  ranking: ReadonlyArray<RankedCombatCandidate<MarinaraChoice>>,
): string | undefined {
  const actor = marinaraFighter(state, actorId);
  const pick = ranking[0];
  if (!actor || !pick) return undefined;
  // Every factor of the score, the weighed parts and what temperament, orders and wavering added, so the
  // line adds up to the score (reasons audit 2026-11-03: unnamed bonuses of up to 0.8).
  const parts = (Object.entries({ ...pick.parts, ...pick.extras }) as Array<[string, number]>)
    .filter(([, part]) => Math.abs(part) >= MARINARA_REASON_FLOOR)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, part]) => `${key} ${part >= 0 ? "+" : ""}${part.toFixed(2)}`);
  const runnerUp = ranking.find(
    (one) =>
      marinaraChoiceLabel(state, actor, one.candidate.action) !==
      marinaraChoiceLabel(state, actor, pick.candidate.action),
  );
  return (
    `AI: ${actor.name} picks ${marinaraChoiceLabel(state, actor, pick.candidate.action)} (${pick.score.toFixed(2)}` +
    `${parts.length ? `: ${parts.join(", ")}` : ""})` +
    (runnerUp
      ? `; runner-up ${marinaraChoiceLabel(state, actor, runnerUp.candidate.action)} (${runnerUp.score.toFixed(2)})`
      : "; no other choice") +
    "."
  );
}

/** Every Classic action a fighter could take now, one per option and target: a Game Master's menu. */
export function marinaraActionChoices(
  state: MarinaraDirectorState,
  unitId: string,
): Array<{ action: CombatPlayerAction; label?: string }> {
  const actor = marinaraFighter(state, unitId);
  if (!actor) return [];
  const out: Array<{ action: CombatPlayerAction; label?: string }> = [];
  for (const option of marinaraUsable(actor, state.fighters)) {
    const effect = option.effect;
    if (effect.target === "self" || effect.target === "party" || effect.target === "all-enemies") {
      const at = marinaraTargetsFor(actor, effect, state.fighters)[0];
      if (!at) continue;
      out.push({
        action:
          option.id === null
            ? { type: "attack", targetId: at.id }
            : { type: "skill", skillId: option.id, targetId: at.id },
        label: option.label,
      });
      continue;
    }
    for (const target of marinaraTargetsFor(actor, effect, state.fighters)) {
      out.push({
        action:
          option.id === null
            ? { type: "attack", targetId: target.id }
            : { type: "skill", skillId: option.id, targetId: target.id },
        label: option.label,
      });
    }
  }
  out.push({ action: { type: "defend" } });
  return out;
}

/** Whether a classic skill id of this fighter's aims at its own side. */
export function marinaraAimsAllied(state: MarinaraDirectorState, unitId: string, skillId: string): boolean {
  const actor = marinaraFighter(state, unitId);
  const skill = actor?.skills.find((s) => s.id === skillId);
  const effect = skill ? MARINARA_SKILL_EFFECTS[skill.id] : undefined;
  return alliedAim(effect?.target);
}

/** The director's unit for a fighter: the shell a fight's screens, morale and AI profile read. */
export function marinaraCombatant(fighter: MarinaraFighter, extra: Partial<Combatant> = {}): Combatant {
  const unit: Combatant = {
    id: fighter.id,
    name: fighter.name,
    side: fighter.side === "party" ? "player" : "enemy",
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    mp: fighter.mp,
    maxMp: fighter.maxMp,
    attack: Math.round(Math.max(fighter.stats.strength, fighter.stats.magic)),
    defense: Math.round(fighter.stats.defense),
    speed: Math.max(1, Math.round(fighter.stats.speed)),
    level: fighter.level,
    skills: marinaraCombatSkills(fighter),
    ...extra,
  };
  // On a board its reach and step follow its archetype, whatever the fight's setup guessed.
  if (fighter.archetype) unit.combatClass = MARINARA_BOARD_CLASSES[fighter.archetype];
  unit.marinara = marinaraCombatantView(fighter);
  return unit;
}

/** The Tactical class each archetype fights as on a board: its reach and its movement. */
const MARINARA_BOARD_CLASSES: Record<NonNullable<MarinaraFighter["archetype"]>, string> = {
  blade: "fighter",
  guard: "knight",
  scout: "rogue",
  marksman: "archer",
  channeler: "mage",
  hexer: "mage",
  mender: "healer",
  // A Herald lifts the party from behind it, as in its Classic back row: reach 1-2 (playtest 2026-11-01).
  herald: "mage",
};
