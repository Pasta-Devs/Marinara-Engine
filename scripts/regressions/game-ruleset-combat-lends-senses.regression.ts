/**
 * Seeing through another's eyes (Capability API 1.481).
 *
 *   - A condition with `lendsSenses`: whoever put it on sees what its holder sees, as well as what
 *     they see themselves. A dazzled warlock sees a goblin through its familiar; not through one it
 *     put nothing on, one somebody else put it on, one that cannot see either, or one that is gone.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCanSee,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lends-senses-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 481);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (lend: Record<string, unknown> = { lendsSenses: true }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sight = { eyes: "sight", unseenAttacks: true };
    doc.sheet.live.conditions.push({ id: "dazzled", label: "Dazzled" }, { id: "seen_through", label: "Seen through" });
    doc.combat.conditions.push(
      { condition: "dazzled", effects: [], lacks: ["sight"] },
      { condition: "seen_through", effects: [], ...lend },
    );
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({
      health: 10,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 2, damage: { flat: 1 }, reach: 5 }],
    }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "lock",
          name: "Lock",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 30 },
          }),
        },
        { id: "imp", name: "Imp", side: "party", block: block() },
        { id: "goblin", name: "Goblin", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) },
        placements: { lock: { x: 0, y: 1 }, imp: { x: 4, y: 1 }, goblin: { x: 6, y: 1 } },
      },
    });
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const sees = (state: RulesetEncounterState) =>
    rulesetCanSee(definition, state, who(state, "lock"), who(state, "goblin"));

  // ── Dazzled, the warlock sees the goblin only through its familiar ──
  {
    const state = fight();
    assert.equal(sees(state), true, "its own eyes");
    who(state, "lock").tracked.push({ condition: "dazzled", rounds: null });
    assert.equal(sees(state), false, "dazzled");
    who(state, "imp").tracked.push({ condition: "seen_through", rounds: null, source: "lock" });
    assert.equal(sees(state), true, "through the imp's eyes");
    // Not the other way round: the imp sees through nobody.
    who(state, "imp").tracked.push({ condition: "dazzled", rounds: null });
    assert.equal(rulesetCanSee(definition, state, who(state, "imp"), who(state, "goblin")), false);
    assert.equal(sees(state), false, "the imp dazzled too");
    who(state, "imp").tracked = who(state, "imp").tracked.filter((one) => one.condition !== "dazzled");
    who(state, "imp").defeated = true;
    assert.equal(sees(state), false, "the imp gone");
  }
  // ── Put on by somebody else, it lends nothing to the warlock ──
  {
    const state = fight();
    who(state, "lock").tracked.push({ condition: "dazzled", rounds: null });
    who(state, "imp").tracked.push({ condition: "seen_through", rounds: null, source: "goblin" });
    assert.equal(sees(state), false);
  }

  // ── Refusals ──
  refused(fiveE({ lendsSenses: false }), /lendsSenses/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions lend their holder's senses to whoever put them on (lendsSenses) requires schemaVersion 2 and capabilityApi 1.481 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(480) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(481) as never, fiveE()), gate);
  }

  console.log(
    "Lends senses: a dazzled warlock sees through its familiar's eyes, and through nobody else's; gated at 1.481.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
