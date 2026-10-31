/**
 * Walking through other creatures and solid ground (Capability API 1.495).
 *
 *   - `combat.sizes.passing`: a foe two sizes apart is walked through, never stopped in, and every
 *     cell another creature fills costs as hard going; one of the same size still blocks.
 *   - `passesCreatures`: "larger" through a bigger foe (Halfling Nimbleness), "any" through anybody.
 *   - `passesObjects`: solid ground walked as hard going and stopped in, with its harm as the turn
 *     ends there (Incorporeal Movement).
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
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetReachableCells,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-passing-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 495);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const sizes = (passing?: Record<string, unknown>) => ({
    order: [
      { id: "tiny", label: "Tiny" },
      { id: "small", label: "Small" },
      { id: "medium", label: "Medium" },
      { id: "large", label: "Large" },
    ],
    default: "medium",
    ...(passing ? { passing } : {}),
  });
  const fiveE = (passing?: Record<string, unknown>, edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sizes = sizes(passing);
    for (const id of ["nimble", "incorporeal"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push(
      { condition: "nimble", effects: [], passesCreatures: "larger" },
      {
        condition: "incorporeal",
        effects: [],
        passesCreatures: "any",
        passesObjects: { harm: { dice: "1d10", damageType: "force" } },
      },
    );
    edit(doc);
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
  const block = (size: string, keepsOn?: string[]): RulesetStatBlock =>
    ({
      health: 30,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      size,
      actions: [],
      ...(keepsOn ? { keepsOn } : {}),
    }) as unknown as RulesetStatBlock;
  // A corridor one cell high, with a wall at x 6.
  const tiles = () => [
    ["plains", "plains", "plains", "plains", "plains", "plains", "wall", "plains", "plains", "plains"],
  ];
  const fight = (
    definition: RulesetDefinition,
    walker: RulesetStatBlock,
    foe: RulesetStatBlock,
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: (sides: number) => (sides === 10 ? 7 : 10),
      combatants: [
        { id: "walker", name: "Walker", side: "party", block: walker },
        { id: "foe", name: "Foe", side: "enemy", block: foe },
      ],
      board: {
        grid: { width: 10, height: 1, tiles: tiles() } as never,
        placements: { walker: { x: 1, y: 0 }, foe: { x: 3, y: 0 } },
      },
    });
    state.order = ["walker", "foe"];
    state.turn = 0;
    return state;
  };
  const stops = (definition: RulesetDefinition, state: RulesetEncounterState) =>
    Object.fromEntries(rulesetReachableCells(definition, state, "walker").map((cell) => [cell.x, cell.cost]));
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  // ── The core rule: two sizes apart, walked through, and a crowded cell costs double ──
  {
    const definition = parsed(fiveE({ apart: 2, crowded: 2 }));
    const tiny = fight(definition, block("medium"), block("tiny"));
    assert.deepEqual(stops(definition, tiny), { 0: 1, 2: 1, 4: 4, 5: 5 }, "through the tiny foe, not stopped on it");
    const walked = applyRulesetCombatChoice(
      definition,
      tiny,
      { actorId: "walker", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 4, y: 0 } },
      () => 10,
    );
    assert.deepEqual(of(walked.events, "refused"), [], JSON.stringify(walked.events));
    const walker = rulesetCombatant(walked.state, "walker")!;
    assert.deepEqual([walker.x, walker.y], [4, 0]);
    assert.equal(walker.movementLeft, 2, "six cells less the crowded one's two");
    const same = fight(definition, block("medium"), block("medium"));
    assert.deepEqual(stops(definition, same), { 0: 1, 2: 1 }, "a foe of the same size blocks");
    // Without the rule, nobody is walked through.
    const plain = parsed(fiveE(undefined));
    assert.deepEqual(stops(plain, fight(plain, block("medium"), block("tiny"))), { 0: 1, 2: 1 });
  }

  // ── Halfling Nimbleness: through a larger foe ──
  {
    const definition = parsed(fiveE(undefined));
    const state = fight(definition, block("small", ["nimble"]), block("medium"));
    assert.deepEqual(stops(definition, state), { 0: 1, 2: 1, 4: 3, 5: 4 });
    const smaller = fight(definition, block("small", ["nimble"]), block("tiny"));
    assert.deepEqual(stops(definition, smaller), { 0: 1, 2: 1 }, "never a smaller one");
  }

  // ── Incorporeal Movement: through anybody and the wall, hurt ending a turn inside it ──
  {
    const definition = parsed(fiveE(undefined));
    const state = fight(definition, block("medium", ["incorporeal"]), block("large"));
    assert.deepEqual(stops(definition, state), { 0: 1, 2: 1, 4: 3, 5: 4, 6: 6 }, "into the wall, at double cost");
    const inside = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "walker", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 6, y: 0 } },
      (sides: number) => (sides === 10 ? 7 : 10),
    );
    assert.deepEqual(of(inside.events, "refused"), [], JSON.stringify(inside.events));
    const ended = applyRulesetCombatChoice(
      definition,
      inside.state,
      { actorId: "walker", optionId: "end-turn", targetIds: [] },
      (sides: number) => (sides === 10 ? 7 : 10),
    );
    const hurt = of(ended.events, "damage").filter((one) => one.targetId === "walker");
    assert.equal(hurt.length, 1, JSON.stringify(ended.events));
    assert.equal(hurt[0]!.amount, 7);
    // Ending a turn on open ground, nothing.
    const outside = applyRulesetCombatChoice(
      definition,
      fight(definition, block("medium", ["incorporeal"]), block("large")),
      { actorId: "walker", optionId: "end-turn", targetIds: [] },
      () => 10,
    );
    assert.equal(of(outside.events, "damage").length, 0);
  }

  // ── Refusals ──
  refused(fiveE({}), /passing says how far apart/);
  refused(fiveE({ apart: 0 }), /apart/);
  refused(
    fiveE(undefined, (doc) => (doc.combat.conditions.at(-1).passesCreatures = "smaller")),
    /passesCreatures/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose movers walk through other creatures or solid ground (sizes passing, passesCreatures, passesObjects) requires schemaVersion 2 and capabilityApi 1.495 or newer";
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
    const onlyCore = fiveE({ apart: 2 }, (doc) => {
      doc.combat.conditions = doc.combat.conditions.filter(
        (one: { condition: string }) => one.condition !== "nimble" && one.condition !== "incorporeal",
      );
    });
    const none = fiveE(undefined, (doc) => {
      doc.combat.conditions = doc.combat.conditions.filter(
        (one: { condition: string }) => one.condition !== "nimble" && one.condition !== "incorporeal",
      );
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(494) as never, fiveE({ apart: 2 })), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(494) as never, onlyCore), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(495) as never, fiveE({ apart: 2 })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(494) as never, none), gate);
  }

  console.log(
    "Passing: a foe two sizes apart walked through, a crowded cell at double cost; Halfling Nimbleness through a larger foe; Incorporeal Movement through anybody and walls, hurt ending a turn inside one; gated at 1.495.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
