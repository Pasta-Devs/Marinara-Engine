/**
 * Treasure foes in the lab: how often the party catches a treasure foe before it flees (its windfall's
 * fleeAfterRounds, FLEE= to override), two at a time, at a few levels, and what the party loses doing it.
 * Tuned to a catch rate of roughly a third to a half.
 *   tsx scripts/class-lab/bestiary-treasure.ts
 */
import { marinaraEnemySpec } from "../../packages/shared/src/features/marinara-bestiary.js";
import {
  commandCombatDirector,
  createCombatDirector,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  marinaraAiAction,
  marinaraCombatant,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import { enemyFighter, referenceParty, REFERENCE_PARTIES } from "./bestiary-units.js";
for (const fam of ["glimmerling", "hoardling"])
  for (const level of [3, 10, 18, 28]) {
    let killedBy3 = 0,
      total = 0,
      partyLost = 0,
      fights = 0;
    for (const pname of Object.keys(REFERENCE_PARTIES))
      for (let i = 0; i < 6; i++) {
        const party = referenceParty(pname, level, `${i}`);
        const foes = [0, 1].map((j) =>
          enemyFighter(
            marinaraEnemySpec({ familyId: fam, setting: "high_fantasy", level, tier: "standard", id: `e${j}` }),
          ),
        );
        const s = createCombatDirector({
          id: `t${i}`,
          anchor: "a",
          party: party.map((f) => marinaraCombatant(f)),
          enemies: foes.map((f) => marinaraCombatant(f)),
          style: "classic",
          gm: false,
          difficulty: "normal",
          seed: 77 + i * 13 + level,
          marinara: [...party, ...foes],
        });
        const turns: Record<string, number> = {};
        let seen = 0;
        const deadAt: Record<string, number> = {};
        for (let step = 0; step < 4000 && !s.outcome; step++) {
          for (const l of s.log)
            if (l.id > seen) {
              seen = l.id;
              if (
                l.actorId &&
                s.enemies.some((e) => e.id === l.actorId) &&
                /prepares an action|hits|misses/.test(l.text) &&
                !/strikes at/.test(l.text)
              ) {
                if (/prepares/.test(l.text)) turns[l.actorId] = (turns[l.actorId] ?? 0) + 1;
              }
            }
          if (s.round > Number(process.env.FLEE ?? 3)) break;
          if (s.stage === "action" && s.actorId) {
            const unit = [...s.party, ...s.enemies].find((u) => u.id === s.actorId)!;
            commandCombatDirector(s, {
              type: "classic",
              action: marinaraAiAction(s.marinara!, unit, s.round, "normal", false),
            });
          } else if (s.window) commandCombatDirector(s, { type: "fallback" }, "fallback");
          else commandCombatDirector(s, { type: "continue" });
          for (const e of s.enemies) if (e.hp <= 0 && deadAt[e.id] === undefined) deadAt[e.id] = turns[e.id] ?? 0;
        }
        for (const e of s.enemies) {
          total++;
          if (deadAt[e.id] !== undefined) killedBy3++;
        }
        if (process.env.DBG && fights < 3)
          console.log(
            JSON.stringify(turns),
            JSON.stringify(deadAt),
            s.round,
            s.outcome,
            s.enemies.map((e) => e.hp),
          );
        const max = s.party.reduce((a, u) => a + u.maxHp, 0),
          left = s.party.reduce((a, u) => a + Math.max(0, u.hp), 0);
        partyLost += (max - left) / max;
        fights++;
      }
    console.log(
      fam,
      "L" + level,
      "caught",
      ((killedBy3 / total) * 100).toFixed(0) + "%",
      "party HP lost",
      ((partyLost / fights) * 100).toFixed(0) + "%",
    );
  }
