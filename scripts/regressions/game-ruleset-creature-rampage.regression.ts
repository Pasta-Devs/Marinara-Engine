/**
 * A gnoll's Rampage (Capability API 1.545).
 *
 *   - Dropping a creature to 0 with a melee attack on its own turn: its bonus action spent, half its
 *     speed more to move, and its bite once more this turn, at whoever else is there.
 *   - A shot that fells one, or a fall with no bonus action left: nothing.
 *   - Refusals and the install gate.
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
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rampage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 545);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const rampage = { action: "bite", budget: "bonus", move: 0.5 };
  const fiveE = (rule: unknown = rampage): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "gnoll",
        label: "Gnoll",
        creature: {
          health: 22,
          defense: 15,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_1_2",
          actions: [
            { id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { flat: 10 }, reach: 5 },
            { id: "longbow", name: "Longbow", budget: "action", toHit: 3, damage: { flat: 10 }, range: 150 },
          ],
          rampage: rule,
        },
      });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const gnoll = rulesetCreatureBlock(
    definition,
    definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "gnoll"),
  );
  assert.ok(gnoll);
  const rat = (health: number): RulesetStatBlock =>
    ({ health, defense: 5, initiativeModifier: 0, speed: 20, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (ratAt = { x: 4, y: 3 }) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "gnoll", name: "Gnoll", side: "enemy", block: gnoll },
        { id: "rat", name: "Rat", side: "party", block: rat(5) },
        { id: "boar", name: "Boar", side: "party", block: rat(30) },
      ],
      board: {
        grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
        placements: { gnoll: { x: 3, y: 3 }, rat: ratAt, boar: { x: 3, y: 8 } },
      },
    });
    state.order = ["gnoll", "rat", "boar"];
    state.turn = 0;
    return state;
  };
  const use = (state: RulesetEncounterState, label: string, targetId: string) => {
    const option = rulesetCombatOptions(definition, state, "gnoll").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "gnoll", optionId: option.id, targetIds: [targetId] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };

  // ── Bitten down: rampage, half its speed more, and a bite again ──
  {
    const state = fight();
    const before = rulesetCombatant(state, "gnoll")!.movementLeft ?? 0;
    const step = use(state, "Bite", "rat");
    assert.deepEqual(
      of(step.events, "rampage").map((one) => [one.actorId, one.label, one.cells]),
      [["gnoll", "Bite", 3]],
    );
    const after = rulesetCombatant(step.state, "gnoll")!;
    assert.equal(after.budgets.bonus, 0, "its bonus action spent");
    assert.equal(after.movementLeft, before + 3, "15 feet more");
    assert.equal(after.budgets.action, 0);
    assert.ok(
      rulesetCombatOptions(definition, step.state, "gnoll").some((one) => one.label === "Bite"),
      "a bite again",
    );
  }

  // ── Shot down, or no bonus action left: no rampage ──
  {
    const shot = use(fight({ x: 9, y: 3 }), "Longbow", "rat");
    assert.deepEqual(
      of(shot.events, "defeated").map((one) => one.actorId),
      ["rat"],
    );
    assert.deepEqual(of(shot.events, "rampage"), [], "a shot, not a melee attack");
    const spent = fight();
    rulesetCombatant(spent, "gnoll")!.budgets.bonus = 0;
    assert.deepEqual(of(use(spent, "Bite", "rat").events, "rampage"), [], "no bonus action left");
  }

  // ── Refusals ──
  refused(fiveE({ ...rampage, action: "claws" }), /Unknown action "claws"/);
  refused(fiveE({ ...rampage, budget: "luck" }), /Unknown budget "luck"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature that rampages on after felling one (rampage) requires schemaVersion 2 and capabilityApi 1.545 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(544) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(545) as never, fiveE()), gate);
  }

  console.log(
    "Rampage: a gnoll that bites one down spends its bonus action for half its speed more and a bite again; not on a shot or with no bonus action left; refusals; gated at 1.545.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
