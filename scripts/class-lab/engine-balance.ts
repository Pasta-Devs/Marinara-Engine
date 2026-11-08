/**
 * Engine balance: Classic Marinara fights run through the combat director with the Engine's own combat
 * AI playing both sides (the leader too), so encounter tiers are judged with what plays them.
 *
 *   node packages/server/node_modules/tsx/dist/cli.mjs scripts/class-lab/engine-balance.ts [fights] [style]
 */
import { keepFightReasons } from "./reasons-log.js";
import { marinaraFoeFighters, marinaraPartyFighter } from "../../packages/shared/src/features/marinara-party.js";
import {
  commandCombatDirector,
  createCombatDirector,
  marinaraBoardTurn,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  marinaraAiAction,
  marinaraCombatant,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import {
  MARINARA_ARCHETYPES,
  MARINARA_PARTY_TEMPERAMENTS,
  awardMarinaraXp,
  createMarinaraProgression,
  marinaraRandom,
  setMarinaraClass,
  marinaraOpenClasses,
  type MarinaraArchetype,
  type MarinaraProgression,
} from "../../packages/shared/src/features/marinara-classes.js";
import { decideTacticalAction } from "../../packages/shared/src/features/tactical-combat/index.js";
import type { TacticalUnit } from "../../packages/shared/src/features/tactical-combat/types.js";
import {
  MARINARA_ARCHETYPE_ROWS,
  MARINARA_PASSIVES,
  MARINARA_ENEMY_TIERS,
  buildMarinaraEnemy,
  type MarinaraEnemyTier,
} from "../../packages/shared/src/features/marinara-combat.js";

const count = Number(process.argv[2] ?? 40);
// Experiment knobs: BOSS_STATS / BOSS_HP override the boss tier; LEVELS=20,30 limits the rows.
if (process.env.BOSS_STATS) MARINARA_ENEMY_TIERS.boss.stats = Number(process.env.BOSS_STATS);
if (process.env.BOSS_HP) MARINARA_ENEMY_TIERS.boss.hp = Number(process.env.BOSS_HP);
if (process.env.HEX_FRONT) MARINARA_ARCHETYPE_ROWS.hexer = "front";
if (process.env.NO_HUNGER) MARINARA_PASSIVES["grave-hunger"] = {};
let hexFights = 0,
  hexDown = 0;
const style = (process.argv[3] ?? "classic") as "classic" | "tactical";

/** A character grown to a level in their primary tree, promoting at 10 and 20 to a random line. */
function grown(seed: string, primary: MarinaraArchetype, level: number): MarinaraProgression {
  const random = marinaraRandom(seed);
  const temperament = MARINARA_PARTY_TEMPERAMENTS[Math.floor(random() * MARINARA_PARTY_TEMPERAMENTS.length)]!;
  let p = createMarinaraProgression({ seed, primary, temperament });
  for (let at = 2; at <= level; at++) {
    p = awardMarinaraXp(p, 100, random).progression;
    const classLevel = p.classLevels[p.activeClass] ?? 1;
    if (classLevel === 10 || classLevel === 20) {
      const next = marinaraOpenClasses(p).filter(
        (def) => def.from === p.activeClass && def.archetype === primary && p.classLevels[def.id] === undefined,
      );
      if (next.length) p = setMarinaraClass(p, next[Math.floor(random() * next.length)]!.id);
    }
  }
  return p;
}

const PARTIES: MarinaraArchetype[][] = [
  ["blade", "guard", "channeler", "mender"],
  ["scout", "marksman", "hexer", "herald"],
  ["guard", "blade", "marksman", "mender"],
  ["blade", "scout", "channeler", "hexer"],
];
const FOE_KINDS: MarinaraArchetype[] = [...MARINARA_ARCHETYPES];

function fight(seed: number, level: number, tiers: MarinaraEnemyTier[]): CombatDirectorState {
  const kinds = PARTIES[process.env.PARTY ? Number(process.env.PARTY) : seed % PARTIES.length]!;
  const party = kinds.map((primary, i) =>
    // As the Engine builds a party member: their standard kit for their tier until they have gear.
    marinaraPartyFighter(`p${i}`, `${primary}${i}`, grown(`b:${seed}:${i}`, primary, level)),
  );
  const random = marinaraRandom(`foes:${seed}`);
  // As the Engine builds them at a fight's start (generic foes: tier floors and level growth).
  const foes = marinaraFoeFighters({
    foes: tiers.map((tier, i) => ({
      id: `e${i}`,
      name: `foe${i}`,
      marinara: {
        tier,
        archetype: FOE_KINDS[Math.floor(random() * FOE_KINDS.length)]!,
        // No ability given: each foe takes its archetype's, as the Game Master's invented foes do.
      },
    })),
    partyLevels: party.map((one) => one.level),
    partyAverageHp: party.reduce((sum, one) => sum + one.maxHp, 0) / party.length,
    difficulty: "normal",
    keepAll: true,
  }).fighters;
  return createCombatDirector({
    id: `b${seed}`,
    anchor: "a",
    party: party.map((f) => marinaraCombatant(f)),
    enemies: foes.map((f) => marinaraCombatant(f)),
    style,
    gm: false,
    difficulty: "normal",
    seed,
    ...(style === "tactical" ? { battlefield: { size: "small" } as never } : {}),
    marinara: [...party, ...foes],
  });
}

const USAGE: Record<string, Record<string, number>> | null = process.env.USAGE ? {} : null;

function playOut(s: CombatDirectorState) {
  for (let step = 0; step < 6000 && !s.outcome; step++) {
    if (s.mercy) {
      commandCombatDirector(s, { type: "mercy", choice: "spare" });
      continue;
    }
    if (s.tactical) {
      // On a board the Engine's Tactical AI plays both sides (the party begins its units in order).
      if (s.stage === "action" && s.actorId) {
        const unit = s.tactical.units.find((u) => u.id === s.actorId) as TacticalUnit;
        const action =
          process.env.BOARD_AI === "1" ? decideTacticalAction(s.tactical, unit) : marinaraBoardTurn(s, unit);
        commandCombatDirector(s, { type: "tactical", action: action as never });
      } else if (s.window) commandCombatDirector(s, { type: "fallback" }, "fallback");
      else if (s.stage === "select") {
        const next = s.tactical.units.find((u) => u.side === "party" && u.hp > 0 && !u.hasActed);
        commandCombatDirector(s, next ? { type: "begin", unitId: next.id } : { type: "continue" });
      } else commandCombatDirector(s, { type: "continue" });
      continue;
    }
    if (s.stage === "action" && s.actorId) {
      const unit = [...s.party, ...s.enemies].find((u) => u.id === s.actorId)!;
      const action = marinaraAiAction(s.marinara!, unit, s.round, "normal", false);
      if (USAGE && unit.side === "player") {
        // USAGE=1: what each party class spends its turns on.
        const fighter = s.marinara!.fighters.find((f) => f.id === unit.id)!;
        const what = action.type === "skill" ? action.skillId : action.type;
        const row = (USAGE[fighter.classId ?? fighter.archetype ?? "?"] ??= {});
        row[what] = (row[what] ?? 0) + 1;
      }
      commandCombatDirector(s, { type: "classic", action });
    } else if (s.window) commandCombatDirector(s, { type: "fallback" }, "fallback");
    else commandCombatDirector(s, { type: "continue" });
  }
  // The AI reasons log is always kept (Alyssa 2026-11-03: mandatory for every run).
  keepFightReasons("engine-balance", s.id, s);
  return s;
}

const ENCOUNTERS: Array<[string, MarinaraEnemyTier[]]> = [
  ["4 standard (Normal budget)", ["standard", "standard", "standard", "standard"]],
  ["2 elite (Normal budget)", ["elite", "elite"]],
  ["1 boss (Normal budget)", ["boss"]],
  ["boss + 2 minions (Hard)", ["boss", "minion", "minion"]],
  ["5 standard + 1 minion (Hard)", ["standard", "standard", "standard", "standard", "standard", "minion"]],
];
const rows: string[] = [
  "| Level | Encounter | Party wins | Rounds | Party HP lost | Downed |",
  "| --- | --- | --- | --- | --- | --- |",
];
const LEVELS = process.env.LEVELS ? process.env.LEVELS.split(",").map(Number) : [1, 5, 10, 20, 30];
for (const level of LEVELS) {
  for (const [label, tiers] of ENCOUNTERS) {
    let wins = 0,
      rounds = 0,
      lost = 0,
      downed = 0;
    for (let n = 0; n < count; n++) {
      const s = playOut(fight(level * 1000 + n, level, tiers));
      if (s.outcome === "victory") wins++;
      rounds += s.round;
      const max = s.party.reduce((sum, u) => sum + u.maxHp, 0);
      lost += s.party.reduce((sum, u) => sum + (u.maxHp - u.hp), 0) / max;
      downed += s.party.filter((u) => u.hp <= 0).length;
      const hex = s.party.find((u) => u.name.startsWith("hexer"));
      if (hex) (hexFights++, hex.hp <= 0 && hexDown++);
    }
    rows.push(
      `| ${level} | ${label} | ${((wins / count) * 100).toFixed(0)}% | ${(rounds / count).toFixed(1)} | ${((lost / count) * 100).toFixed(0)}% | ${(downed / count).toFixed(1)} |`,
    );
  }
}
console.log(rows.join("\n"));
console.log(`hexer downed ${hexDown}/${hexFights} = ${Math.round((hexDown / Math.max(1, hexFights)) * 100)}%`);
if (USAGE)
  for (const [cls, row] of Object.entries(USAGE).sort()) {
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    console.log(
      cls.padEnd(16),
      Object.entries(row)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`)
        .join(", "),
    );
  }
