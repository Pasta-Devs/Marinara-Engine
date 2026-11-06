/**
 * Double damage to objects (Capability API 1.560): 5e's Siege Monster.
 *
 *   - A creature with `doubleToObjects` deals twice its damage to a board's prop, struck as a wall's
 *     section is; one without deals it as rolled. Creatures are dealt it as rolled either way.
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
  rulesetCombatOptions,
  supportedCapabilityApi,
  type RulesetBoardPropInput,
  type RulesetCombatEvent,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-siege-monster-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 560);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsed = parseRulesetDefinition(JSON.parse(fiveEText));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  const elemental = (siege: boolean): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      ...(siege ? { doubleToObjects: true } : {}),
      actions: [
        {
          id: "slam",
          name: "Slam",
          budget: "action",
          toHit: 8,
          damage: { count: 1, sides: 6, flat: 2, type: "bludgeoning" },
        },
      ],
    }) as unknown as RulesetStatBlock;
  const foe = { health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] } as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 10,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(10).fill("plains")),
  });
  const door: RulesetBoardPropInput = { id: "door", label: "Door", cells: [{ x: 5, y: 4 }], health: 50, defense: 5 };
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const fight = (siege: boolean) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "e", name: "Elemental", side: "enemy", block: elemental(siege) },
        { id: "hero", name: "Hero", side: "party", block: foe },
      ],
      board: { grid: grid(), placements: { e: { x: 5, y: 5 }, hero: { x: 4, y: 5 } }, props: [door] },
    });
    state.order = ["e", "hero"];
    state.turn = 0;
    return state;
  };
  const slam = (siege: boolean, at: { wall?: { x: number; y: number }; targetIds: string[] }) => {
    const state = fight(siege);
    const option = rulesetCombatOptions(definition, state, "e").find((one) => one.label === "Slam")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "e", optionId: option.id, ...at } as never,
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const doorHealth = (step: ReturnType<typeof slam>) =>
    step.state.board!.props!.find((one) => one.id === "door")!.health;

  // ── A door: twice as much from a siege monster ──
  assert.equal(doorHealth(slam(false, { wall: { x: 5, y: 4 }, targetIds: [] })), 45, "1d6 + 2 as rolled");
  assert.equal(doorHealth(slam(true, { wall: { x: 5, y: 4 }, targetIds: [] })), 40, "twice that to an object");

  // ── A creature: as rolled ──
  {
    const step = slam(true, { targetIds: ["hero"] });
    assert.deepEqual(
      of(step.events, "damage").map((one) => one.dealt),
      [5],
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature that deals double damage to objects (doubleToObjects) requires schemaVersion 2 and capabilityApi 1.560 or newer";
    const document = () => {
      const doc = JSON.parse(fiveEText);
      doc.catalogs
        .find((catalog: { holds?: string }) => catalog.holds === "creatures")
        .entries.push({
          id: "earth-elemental",
          label: "Earth Elemental",
          creature: {
            ...elemental(true),
            tier: "cr_1",
            actions: [{ id: "slam", name: "Slam", budget: "action", toHit: 8, damage: { flat: 5 }, reach: 5 }],
          },
        });
      return doc;
    };
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
    const checked = parseRulesetDefinition(document());
    assert.ok(checked.ok, checked.ok ? "" : checked.issues.join("; "));
    assert.equal(getCapabilityPackageInstallIssue(manifest(559) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(560) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(559) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Siege monster: twice its damage to a door, as rolled to a creature; gated at 1.560.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
