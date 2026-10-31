/**
 * Actions that never hinder a creature (Capability API 1.704): a giant spider's Web Walker,
 * "ignores movement restrictions caused by webbing".
 *
 *   - A web's lasting area is hard going for a fighter, and none for the spider: it never catches it.
 *   - A Web attack restrains the fighter, and not the spider, logged as immune.
 *   - Refused empty; the install gate.
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
  rulesetSlowedCells,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetSyncSpeeds } from "../../packages/shared/src/features/ruleset-combat/encounter.js";
import { rulesetZoneCatches } from "../../packages/shared/src/features/ruleset-combat/grid.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-unhindered-by-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 704);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "web_walker", label: "Web Walker" });
    doc.combat.conditions.push({ condition: "web_walker", effects: [], unhinderedBy: ["Web"] });
    doc.catalogs
      .find((one: { id: string }) => one.id === "creatures")
      .entries[0].creature.actions.push({
        id: "web",
        name: "Web",
        budget: "action",
        toHit: 30,
        damage: { dice: "1d4", type: "bludgeoning" },
        reach: 30,
        applies: [{ condition: "restrained", duration: { rounds: 1 } }],
      });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const weaver = rulesetStatBlockFromCreature(definition, creature)!;
  const plain = (): RulesetStatBlock =>
    ({ health: 80, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "weaver", name: "Weaver", side: "enemy", block: { ...weaver, health: 80 } },
        { id: "spider", name: "Spider", side: "party", block: plain() },
        { id: "fighter", name: "Fighter", side: "party", block: plain() },
      ],
      board: {
        grid: { width: 12, height: 6, tiles: Array.from({ length: 6 }, () => Array(12).fill("plains")) },
        placements: { weaver: { x: 1, y: 1 }, spider: { x: 5, y: 2 }, fighter: { x: 5, y: 4 } },
      },
    } as never);
    // A web spell's lasting area over columns 6 and 7.
    const weaverOne = rulesetCombatant(state, "weaver")!;
    weaverOne.actions.push({
      id: "web_spell",
      label: "Web",
      budget: "action",
      targets: { side: "enemy" },
      zone: { difficult: true },
    } as never);
    const cells = [2, 3, 4].flatMap((y) => [6, 7].map((x) => ({ x, y })));
    weaverOne.zones = [
      { actionId: "web_spell", label: "Web", rounds: 10, anchor: "point", triggers: [], at: { x: 6, y: 3 }, cells },
    ];
    rulesetCombatant(state, "spider")!.tracked.push({ condition: "web_walker", rounds: null } as never);
    rulesetSyncSpeeds(definition, state);
    state.order = ["weaver", "spider", "fighter"];
    state.turn = 0;
    return state;
  };

  // ── The web's ground: hard going for the fighter, none for the spider ──
  {
    const state = fight();
    assert.deepEqual(rulesetCombatant(state, "spider")!.unhinderedBy, ["web"]);
    const weaverOne = rulesetCombatant(state, "weaver")!;
    const zone = weaverOne.zones![0]!;
    const action = weaverOne.actions.find((one) => one.id === "web_spell")!;
    assert.equal(rulesetZoneCatches(weaverOne, zone, action, rulesetCombatant(state, "fighter")!), true);
    assert.equal(rulesetZoneCatches(weaverOne, zone, action, rulesetCombatant(state, "spider")!), false);
    assert.equal(rulesetSlowedCells(state, rulesetCombatant(state, "fighter")!).get("6,3")?.times, 2);
    assert.equal(rulesetSlowedCells(state, rulesetCombatant(state, "spider")!).size, 0);
  }

  // ── The Web attack: the fighter is restrained, the spider is not ──
  const webAt = (targetId: string) => {
    const step = applyRulesetCombatChoice(
      definition,
      fight(),
      { actorId: "weaver", optionId: "web", targetIds: [targetId] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return {
      restrained: rulesetCombatant(step.state, targetId)!.tracked.some((one) => one.condition === "restrained"),
      immune: of(step.events, "condition").some(
        (one) => one.targetId === targetId && one.condition === "restrained" && one.reason === "immune",
      ),
    };
  };
  assert.deepEqual(webAt("fighter"), { restrained: true, immune: false });
  assert.deepEqual(webAt("spider"), { restrained: false, immune: true });

  // ── Refused empty ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "web_walker").unhinderedBy = [];
      }),
    );
    assert.equal(result.ok, false);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose holder some actions never hinder (unhinderedBy) requires schemaVersion 2 and capabilityApi 1.704 or newer";
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
    const without = fiveE((doc) => {
      delete doc.combat.conditions.find((one: { condition: string }) => one.condition === "web_walker").unhinderedBy;
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(703) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(704) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(703) as never, without), gate);
  }

  console.log(
    "Unhindered by: a web's ground slows the fighter and not the spider, a Web attack restrains the fighter and not the spider; gated at 1.704.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
