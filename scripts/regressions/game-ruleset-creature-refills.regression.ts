/**
 * Budgets that come back on every turn, not just the creature's own (Capability API 1.549).
 *
 *   - A marilith's Reactive: its spent reaction is back after any combatant's turn ends, so it can
 *     react on two different turns in one round; a creature without the key stays spent.
 *   - An unknown budget is refused.
 *   - The install gate.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-refills-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 549);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const creature = (id: string, label: string, refills?: string[]) => ({
    id,
    label,
    creature: {
      health: 189,
      defense: 18,
      initiativeModifier: 0,
      speed: 40,
      tier: "cr_5",
      actions: [{ id: "tail", name: "Tail", budget: "action", toHit: 9, damage: { flat: 15 }, reach: 10 }],
      ...(refills ? { refillsEveryTurn: refills } : {}),
    },
  });
  const fiveE = (refills: string[] = ["reaction"]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(creature("marilith", "Marilith", refills), creature("brute", "Brute"));
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block = (id: string) =>
    rulesetCreatureBlock(
      definition,
      definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === id),
    )!;
  assert.deepEqual(block("marilith").refillsEveryTurn, ["reaction"]);
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "marilith", name: "Marilith", side: "enemy", block: block("marilith") },
      { id: "brute", name: "Brute", side: "enemy", block: block("brute") },
      { id: "a", name: "A", side: "party", block: block("brute") },
      { id: "b", name: "B", side: "party", block: block("brute") },
    ],
    board: {
      grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
      placements: { marilith: { x: 1, y: 1 }, brute: { x: 3, y: 1 }, a: { x: 6, y: 6 }, b: { x: 8, y: 8 } },
    },
  });
  state.order = ["a", "b", "marilith", "brute"];
  state.turn = 0;
  const endTurn = (from: RulesetEncounterState, actorId: string) => {
    const option = rulesetCombatOptions(definition, from, actorId).find((one) => one.kind === "end-turn");
    assert.ok(option, "no end of turn");
    return applyRulesetCombatChoice(definition, from, { actorId, optionId: option.id }, () => 10).state;
  };
  const reaction = (from: RulesetEncounterState, id: string) => rulesetCombatant(from, id)!.budgets.reaction;

  // ── It reacted on A's turn; when A's turn ends its reaction is back, the brute's is not ──
  rulesetCombatant(state, "marilith")!.budgets.reaction = 0;
  rulesetCombatant(state, "brute")!.budgets.reaction = 0;
  const afterA = endTurn(state, "a");
  assert.equal(afterA.order[afterA.turn], "b");
  assert.equal(reaction(afterA, "marilith"), 1, "back for B's turn");
  assert.equal(reaction(afterA, "brute"), 0, "still spent");

  // ── It reacts again on B's turn; back again after B's ──
  rulesetCombatant(afterA, "marilith")!.budgets.reaction = 0;
  const afterB = endTurn(afterA, "b");
  assert.equal(reaction(afterB, "marilith"), 1);
  assert.equal(reaction(afterB, "brute"), 0);

  // ── An unknown budget ──
  {
    const result = parseRulesetDefinition(fiveE(["legendary"]));
    assert.ok(!result.ok);
    assert.ok(
      result.issues.some((issue) => issue.includes("Unknown budget")),
      result.issues.join("; "),
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature whose budgets come back every turn (refillsEveryTurn) requires schemaVersion 2 and capabilityApi 1.549 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(548) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(549) as never, fiveE()), gate);
  }

  console.log(
    "Refills every turn: a marilith's spent reaction is back after each other turn ends, a brute's stays spent; an unknown budget is refused; gated at 1.549.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
