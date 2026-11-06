/**
 * A walk magic may not lower, and slipping free (Capability API 1.486).
 *
 *   - Freedom of Movement: a spell's slowing and a spell's restraint leave its holder's walk whole;
 *     the same slowing from anything else still halves it.
 *   - Grappled to a stop, its holder slips free for 5 feet of the walk, with no check, and walks on
 *     with the rest; a creature's restraint the same, a spell's not; too dear a slip is not offered.
 *   - An item's effect may carry all of it. Refusals and the install gate.
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
  refreshRulesetMovement,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetMovementAllowance,
  rulesetSheetBuildSchema,
  rulesetSpeedZero,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-freedom-movement-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 486);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const slips = { conditions: ["grappled", "restrained"], cost: 5, unlessCatalogs: ["spells"] };
  const fiveE = (freed: Record<string, unknown> = { speedKeptFrom: { catalogs: ["spells"] }, slipsFree: slips }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "freed", label: "Freedom of Movement" }, { id: "slowed", label: "Slowed" });
    doc.combat.conditions.push(
      { condition: "freed", effects: [], ...freed },
      { condition: "slowed", effects: [], modifiers: [{ to: "speed", times: 0.5 }] },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [] });
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
  const ogre = {
    health: 60,
    defense: 8,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "club", name: "Club", budget: "action", reach: 5, toHit: 5, damage: { flat: 1 } }],
  } as unknown as RulesetStatBlock;
  const fight = (definition: RulesetDefinition, ...on: Array<{ condition: string; catalog?: string }>) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 10 },
            fields: { level: 5, ac: 15, speed: 30, hp_max: 40 },
          }),
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: ogre },
      ],
      board: {
        grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
        placements: { monk: { x: 1, y: 1 }, ogre: { x: 2, y: 1 } },
      },
    });
    state.order = ["monk", "ogre"];
    state.turn = 0;
    const monk = rulesetCombatant(state, "monk")!;
    for (const one of on) monk.tracked.push({ ...one, rounds: null, source: "ogre" });
    refreshRulesetMovement(definition, definition.combat!, monk, state);
    return state;
  };
  const walk = (definition: RulesetDefinition, state: RulesetEncounterState) =>
    rulesetMovementAllowance(definition, definition.combat!, rulesetCombatant(state, "monk")!, state);
  const slipOf = (definition: RulesetDefinition, state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "monk").filter((one) => one.slip);
  const definition = parsed(fiveE());
  const freed = { condition: "freed" };

  // ── A spell's slowing leaves the walk whole; another's halves it ──
  assert.equal(walk(definition, fight(definition, freed)), 6, "30 feet is six squares");
  assert.equal(walk(definition, fight(definition, freed, { condition: "slowed", catalog: "spells" })), 6);
  assert.equal(walk(definition, fight(definition, { condition: "slowed", catalog: "spells" })), 3, "unwarded");
  assert.equal(walk(definition, fight(definition, freed, { condition: "slowed" })), 3, "no spell's");

  // ── A spell's stop leaves them walking, and nothing to slip ──
  {
    const state = fight(definition, freed, { condition: "restrained", catalog: "spells" });
    assert.equal(rulesetSpeedZero(definition, definition.combat!, rulesetCombatant(state, "monk")!, state), false);
    assert.equal(walk(definition, state), 6);
    assert.equal(rulesetCombatant(state, "monk")!.movementLeft, 6);
    assert.ok(
      rulesetCombatOptions(definition, state, "monk").some((one) => one.kind === "move"),
      "may walk",
    );
    assert.deepEqual(slipOf(definition, state), [], "a spell's restraint is not slipped");
  }

  // ── Grappled to a stop: slips free for 5 feet, and walks on with the rest ──
  {
    const state = fight(definition, freed, { condition: "grappled" });
    assert.equal(walk(definition, state), 0);
    assert.equal(rulesetCombatant(state, "monk")!.movementLeft, 0);
    const [slip, ...more] = slipOf(definition, state);
    assert.ok(slip, "offered");
    assert.equal(more.length, 0);
    assert.equal(slip.label, "Grappled");
    assert.equal(slip.movementCost, 1, "5 feet is a square");
    const step = applyRulesetCombatChoice(definition, state, { actorId: "monk", optionId: slip.id, targetIds: [] });
    assert.deepEqual(of(step.events, "refused"), []);
    assert.deepEqual(
      of(step.events, "condition").map((one) => [one.condition, one.active, one.reason]),
      [["grappled", false, "slipped"]],
    );
    const monk = rulesetCombatant(step.state, "monk")!;
    assert.equal(
      monk.tracked.some((one) => one.condition === "grappled"),
      false,
    );
    assert.equal(monk.movementLeft, 5, "six back, one spent");
    assert.equal(monk.budgets.action, rulesetCombatant(state, "monk")!.budgets.action, "no action spent");
    assert.deepEqual(slipOf(definition, step.state), [], "nothing left to slip");
  }

  // ── A creature's restraint is slipped; without Freedom of Movement nothing is ──
  assert.equal(slipOf(definition, fight(definition, freed, { condition: "restrained" })).length, 1);
  assert.deepEqual(slipOf(definition, fight(definition, { condition: "grappled" })), [], "unwarded");

  // ── Too dear: 50 feet is more than the walk it would give back ──
  {
    const dear = parsed(fiveE({ slipsFree: { ...slips, cost: 50 } }));
    assert.deepEqual(slipOf(dear, fight(dear, freed, { condition: "grappled" })), []);
  }

  // ── On an item's effect ──
  {
    const doc = fiveE();
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
    };
    doc.catalogs.push({
      id: "rings",
      label: "Rings",
      holds: "items",
      entries: [
        {
          id: "ring",
          label: "Ring of Freedom of Movement",
          item: {
            category: "gear",
            worn: {
              conditionImmunitiesFrom: [{ conditions: ["paralyzed", "restrained"], catalogs: ["spells"] }],
              speedKeptFrom: { catalogs: ["spells"] },
              slipsFree: slips,
            },
          },
        },
      ],
    });
    const ringed = parsed(doc);
    const state = fight(ringed, { condition: "grappled" }, { condition: "slowed", catalog: "spells" });
    const monk = rulesetCombatant(state, "monk")!;
    monk.sheet!.items = [
      {
        name: "Ring of Freedom of Movement",
        quantity: 1,
        worn: true,
        item: doc.catalogs.at(-1).entries[0].item as never,
      },
    ];
    refreshRulesetMovement(ringed, ringed.combat!, monk, state);
    assert.equal(slipOf(ringed, state).length, 1, "the ring slips the grapple");
    const step = applyRulesetCombatChoice(ringed, state, {
      actorId: "monk",
      optionId: slipOf(ringed, state)[0]!.id,
      targetIds: [],
    });
    assert.equal(rulesetCombatant(step.state, "monk")!.movementLeft, 5, "and the spell's slowing does nothing");
    const bad = fiveE();
    bad.items = doc.items;
    bad.catalogs.push(structuredClone(doc.catalogs.at(-1)));
    bad.catalogs.at(-1).entries[0].item.worn.speedKeptFrom = { catalogs: ["scrolls"] };
    refused(bad, /Unknown catalog "scrolls"/);
  }

  // ── Refusals ──
  refused(fiveE({ speedKeptFrom: { catalogs: ["scrolls"] } }), /Unknown catalog "scrolls"/);
  refused(fiveE({ slipsFree: { ...slips, conditions: ["netted"] } }), /Unknown condition "netted"/);
  refused(fiveE({ slipsFree: { ...slips, unlessCatalogs: ["scrolls"] } }), /Unknown catalog "scrolls"/);
  refused(fiveE({ slipsFree: { ...slips, cost: -5 } }), /cost/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions or items keep a walk from being lowered or slip free (speedKeptFrom, slipsFree, or conditionImmunitiesFrom on an item) requires schemaVersion 2 and capabilityApi 1.486 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(485) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(486) as never, fiveE()), gate);
    const ring = fiveE({});
    ring.items = { categories: [{ id: "gear", label: "Gear" }] };
    ring.catalogs.push({
      id: "rings",
      label: "Rings",
      holds: "items",
      entries: [
        {
          id: "ring",
          label: "Ring",
          item: {
            category: "gear",
            worn: { conditionImmunitiesFrom: [{ conditions: ["restrained"], catalogs: ["spells"] }] },
          },
        },
      ],
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(485) as never, ring), gate, "a ring's immunities");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(485) as never, fiveE({})), gate, "nothing new");
  }

  console.log(
    "Freedom of movement: a spell's slowing and stop leave the walk whole, another's does not; grappled or a creature's restraint slipped for 5 feet with the walk given back, a spell's not, too dear not offered; on items too; refusals; gated at 1.486.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
