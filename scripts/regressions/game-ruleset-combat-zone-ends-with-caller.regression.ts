/**
 * An area that ends as its maker is incapacitated (Capability API 1.741): an ice devil's Wall of Ice,
 * "until the devil is incapacitated or dies".
 *
 *   - `zone.endsWithCaller: "incapacitated"`: stunned, the devil's wall is gone; without it, it stays.
 *   - Refused beside `outlasts` on an entry; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatOptions,
  rulesetZonesShown,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-ends-with-caller-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 741);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const wallOfIce = (ends: unknown = "incapacitated") => ({
    id: "wall_of_ice",
    name: "Wall of Ice",
    budget: "action",
    range: 60,
    area: { shape: "wall", size: 30 },
    zone: {
      rounds: 10,
      triggers: [],
      blocks: ["move", "sight"],
      ...(ends !== null ? { endsWithCaller: ends } : {}),
    },
  });
  const fiveE = (ends: unknown = "incapacitated"): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((one: { id: string }) => one.id === "creatures")
      .entries[0].creature.actions.push(wallOfIce(ends));
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const fight = (ends: unknown): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "devil",
          name: "Ice Devil",
          side: "enemy",
          block: {
            health: 180,
            defense: 18,
            initiativeModifier: 0,
            speed: 40,
            actions: [wallOfIce(ends)],
          } as unknown as RulesetStatBlock,
        },
        {
          id: "monk",
          name: "Monk",
          side: "party",
          block: {
            health: 50,
            defense: 16,
            initiativeModifier: 0,
            speed: 30,
            actions: [
              {
                id: "stun",
                name: "Stunning Strike",
                budget: "action",
                autoHit: true,
                damage: { count: 0, sides: 0, flat: 1 },
                applies: [{ condition: "incapacitated", duration: { rounds: 1 } }],
                reach: 1,
              },
            ],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: {
          width: 15,
          height: 15,
          tiles: Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => "plains")),
        } as never,
        placements: { devil: { x: 2, y: 7 }, monk: { x: 3, y: 7 } },
      },
    });
    state.order = ["devil", "monk"];
    state.turn = 0;
    return state;
  };
  const run = (ends: unknown) => {
    let state = fight(ends);
    const option = rulesetCombatOptions(definition, state, "devil").find((one) => one.label === "Wall of Ice")!;
    const laid = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "devil", optionId: option.id, targetIds: [], at: { x: 9, y: 7 } },
      () => 10,
    );
    assert.equal(
      laid.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(laid.events),
    );
    state = laid.state;
    assert.equal(rulesetZonesShown(state).length, 1, "laid");
    state.turn = 1;
    const struck = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "monk", optionId: "stun", targetIds: ["devil"] },
      () => 10,
    );
    assert.equal(
      struck.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(struck.events),
    );
    return rulesetZonesShown(struck.state).length;
  };

  // ── Stunned, the devil's wall is gone; without endsWithCaller it stays ──
  assert.equal(run("incapacitated"), 0);
  assert.equal(run(null), 1);

  // ── Refusals and the install gate ──
  assert.equal(parseRulesetDefinition(fiveE("asleep")).ok, false);
  const gate =
    "A ruleset with an area that ends as its maker is incapacitated (zone.endsWithCaller) requires schemaVersion 2 and capabilityApi 1.741 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(740) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(741) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(740) as never, fiveE(null)), gate);

  console.log("Zone ends with caller: an ice devil's Wall of Ice ends as the devil is stunned; gated at 1.741.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
