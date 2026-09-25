import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { parseGmTags } from "../../packages/client/src/lib/game-tag-parser.js";

for (const attributes of [
  `enemies="Goblin:2:30:8:5:5" allies="Mari|Dottore"`,
  `ENEMIES = 'Goblin:2:30:8:5:5' ALLIES = 'Mari,Dottore'`,
]) {
  const encounter = parseGmTags(`[combat: ${attributes}]`).combatEncounter;
  assert.equal(encounter?.enemies[0]?.name, "Goblin");
  assert.deepEqual(encounter?.allies, ["Mari", "Dottore"]);
}
assert.equal(parseGmTags(`[combat: enemies="Goblin" allies=none]`).combatEncounter?.allies, null);
assert.equal(parseGmTags(`[combat: Goblin:2]`).combatEncounter?.enemies[0]?.level, 2);

// No equals sign: the old matcher retries the entire remaining word at each
// offset. Keep a generous linear budget, far below the old quadratic runtime.
const start = performance.now();
const result = parseGmTags(`[combat: ${"0".repeat(24_000)}]`);
const elapsed = performance.now() - start;
assert.equal(result.combatEncounter?.enemies.length, 1);
assert.ok(elapsed < 300, `24k malformed attribute body took ${elapsed.toFixed(1)}ms`);
console.log("Game tag attributes: quoted, legacy and bounded malformed input passed.");
