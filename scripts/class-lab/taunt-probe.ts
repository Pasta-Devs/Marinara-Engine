/**
 * Taunt probe (thread "Review Classic AI action weighing", 2026-11-03): how the party AI spends its turns
 * against a foe group with Guard-kit taunters, e.g. 1920s L30: 2 shieldbearers, a shooter and a captain.
 *
 *   tsx scripts/class-lab/taunt-probe.ts [fights]   (GROUP=shieldbearer:standard,shieldbearer:standard,shooter:standard,captain:elite LEVEL=30 SETTING=the_1920s)
 */
import {
  commandCombatDirector,
  createCombatDirector,
} from "../../packages/server/src/services/game/combat-director.service.js";
import { marinaraAiAction, marinaraCombatant } from "../../packages/server/src/services/game/marinara-director.service.js";
import { marinaraEnemySpec } from "../../packages/shared/src/features/marinara-bestiary.js";
import { enemyFighter, referenceParty, REFERENCE_PARTIES, seedOf } from "./bestiary-units.js";
import { keepFightReasons } from "./reasons-log.js";

const fights = Number(process.argv[2] ?? 4);
const level = Number(process.env.LEVEL ?? 30);
const setting = (process.env.SETTING ?? "the_1920s") as never;
const group = (process.env.GROUP ?? "shieldbearer:standard,shieldbearer:standard,shooter:standard,captain:elite")
  .split(",")
  .map((x) => x.split(":") as [string, string]);
const bump = (m: Record<string, number>, k: string, n = 1) => (m[k] = (m[k] ?? 0) + n);
const picks: Record<string, number> = {};
const foePicks: Record<string, number> = {};
let wins = 0,
  played = 0,
  rounds = 0;
for (const partyName of Object.keys(REFERENCE_PARTIES))
  for (let k = 0; k < fights; k++) {
    const seed = seedOf(`taunt:${partyName}:${k}`);
    const party = referenceParty(partyName, level, `taunt:${k}`);
    const foes = group.map(([familyId, tier], j) =>
      enemyFighter(marinaraEnemySpec({ familyId, setting, level, tier: tier as never, id: `e${j}` })),
    );
    const fam = new Map(foes.map((f, j) => [f.id, group[j]![0]]));
    const s = createCombatDirector({
      id: `tp${seed}`,
      anchor: "a",
      party: party.map((f) => marinaraCombatant(f)),
      enemies: foes.map((f) => marinaraCombatant(f)),
      style: "classic",
      gm: false,
      difficulty: "normal",
      seed,
      marinara: [...party, ...foes],
    });
    for (let step = 0; step < 4000 && !s.outcome; step++) {
      if (s.mercy) {
        commandCombatDirector(s, { type: "mercy", choice: "spare" });
        continue;
      }
      if (s.stage === "action" && s.actorId) {
        const unit = [...s.party, ...s.enemies].find((u) => u.id === s.actorId)!;
        const me = s.marinara!.fighters.find((f) => f.id === unit.id)!;
        const action = marinaraAiAction(s.marinara!, unit, s.round, "normal", false) as {
          type: string;
          skillId?: string;
          targetId?: string;
        };
        const what = action.type === "skill" ? action.skillId : action.type;
        const tgt = action.targetId ? (fam.get(action.targetId) ?? "ally") : "-";
        if (me.side === "party") {
          const locked = me.tauntTurns > 0 ? "taunted" : s.marinara!.fighters.some((f) => f.side === "enemy" && f.hp > 0 && f.provoking > 0) ? "provoked" : "free";
          bump(picks, `${locked} ${me.classId} ${what}>${tgt}`);
        } else bump(foePicks, `${fam.get(me.id)} ${what}>${tgt}`);
        commandCombatDirector(s, { type: "classic", action: action as never });
      } else if (s.window) commandCombatDirector(s, { type: "fallback" }, "fallback");
      else commandCombatDirector(s, { type: "continue" });
    }
    for (const e of (s as unknown as { log: Array<{ kind?: string; text: string; actorId?: string }> }).log ?? [])
      if (e.actorId && fam.has(e.actorId) && e.kind?.startsWith("marinara:")) bump(foePicks, `${fam.get(e.actorId)} ${e.kind}`);
    for (const f of s.marinara!.fighters) if (f.side === "party" && f.hp <= 0) bump(foePicks, `party downed`);
    // The AI reasons log is on for every run (Alyssa 2026-11-03).
    keepFightReasons("taunt-probe", `${partyName}:${k}`, s);
    played++;
    rounds += s.round;
    if (s.outcome === "victory") wins++;
  }
console.log(`wins ${wins}/${played}, rounds ${(rounds / played).toFixed(1)}`);
const top = (m: Record<string, number>, n: number) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `  ${v} ${k}`)
    .join("\n");
console.log("party picks:\n" + top(picks, 45));
console.log("foe picks:\n" + top(foePicks, 25));
