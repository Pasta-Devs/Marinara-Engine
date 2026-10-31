/**
 * Why an answer out of turn was taken (laptop playtest 2026-10-23): one that harms nobody itself is
 * worth what it stops, which the score reads as harm or healing kept. A Counterspell (one that cancels,
 * whomever it is aimed at) says it stops what its caster was about to do, a Shield that it turns the
 * hit aside, and neither says it heals
 * or harms. One that harms (a Hellish Rebuke, a blow when somebody walks off) keeps its own reasons.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-answer-reasons-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { rulesetWindowReasons } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const candidate = (option: Record<string, unknown>) =>
    ({
      action: { option: { id: "x", kind: "cast", label: "X", targets: { side: "enemy", count: 1 }, ...option } },
    }) as never;
  const counter = rulesetWindowReasons(
    { kind: "used", sourceId: "mage", optionId: "fireball", label: "Fireball" },
    candidate({}),
    [{ why: "risk" }, { why: "damage", targetId: "mage", strength: "some" }],
    true,
  );
  assert.deepEqual(counter, [{ why: "risk" }, { why: "stops", targetId: "mage" }], "a Counterspell stops the cast");
  // The SRD's Counterspell is aimed at its own caster: what it does, not whom it names, says it stops.
  assert.deepEqual(
    rulesetWindowReasons(
      { kind: "used", sourceId: "mage", optionId: "fireball", label: "Fireball" },
      candidate({ targets: { side: "self", count: 0 } }),
      [{ why: "cost" }],
      true,
    ),
    [{ why: "cost" }, { why: "stops", targetId: "mage" }],
    "a Counterspell aimed at its own caster still stops the cast",
  );
  assert.deepEqual(
    rulesetWindowReasons(
      { kind: "aimed", sourceId: "mage", optionId: "missile", label: "Magic Missile", targetIds: ["ada"] },
      candidate({ targets: { side: "self", count: 0 } }),
      [{ why: "healing", targetId: "ada" }],
    ),
    [{ why: "wards" }],
    "a Shield against a Magic Missile wards it off",
  );
  const shield = rulesetWindowReasons(
    { kind: "hit", sourceId: "orc", optionId: "axe", label: "Axe", total: 15, defense: 13 },
    candidate({ targets: { side: "self", count: 0 } }),
    [{ why: "cost" }, { why: "healing", targetId: "ada" }],
  );
  assert.deepEqual(shield, [{ why: "cost" }, { why: "wards" }], "a Shield turns the hit aside");
  const rebuke = [{ why: "damage" as const, targetId: "orc", strength: "solid" as const }];
  assert.equal(
    rulesetWindowReasons(
      { kind: "hit", sourceId: "orc", optionId: "axe", label: "Axe", total: 15, defense: 13 },
      candidate({ forecast: { averageDamage: 9 } }),
      rebuke,
    ),
    rebuke,
    "one that harms keeps its reasons",
  );
  const walkOff = [{ why: "damage" as const, targetId: "orc", strength: "some" as const }];
  assert.equal(
    rulesetWindowReasons(
      { kind: "leaves-reach", moverId: "orc", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      candidate({}),
      walkOff,
    ),
    walkOff,
    "a blow at one walking off keeps its reasons",
  );
  console.log(
    "Answer reasons: a Counterspell stops the cast, a Shield turns the hit aside, a harming answer keeps its own.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
