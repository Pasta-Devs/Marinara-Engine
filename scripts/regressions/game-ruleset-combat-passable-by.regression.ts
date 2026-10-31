/**
 * A creature moved through only by the strong, and filling none of its space (Capability API
 * 1.600): 5e's Arcane Hand.
 *
 *   - `passableBy: {ability: "str", above: 26, difficult: true}`: a foe of Strength 19 cannot walk
 *     through it; one of 27 can, as hard going, and may stop there.
 *   - `fillsSpace: false`: a friend may stop in its space; without it, only walk past.
 *   - Read off a creature entry; an unknown ability refused; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCreatureBlock,
  rulesetReachableCells,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-passable-by-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 600);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hand = (more: Record<string, unknown> = {}) => ({
    id: "arcane-hand",
    label: "Arcane Hand",
    creature: {
      health: 40,
      defense: 20,
      initiativeModifier: 0,
      speed: 60,
      tier: "cr_0",
      abilities: { str: 26 },
      actions: [{ id: "slam", name: "Slam", budget: "action", toHit: 10, damage: { flat: 4 }, reach: 5 }],
      passableBy: { ability: "str", above: 26, difficult: true },
      fillsSpace: false,
      ...more,
    },
  });
  const document = (more?: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(hand(more));
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const handBlock = (definition: RulesetDefinition) => {
    const block = rulesetCreatureBlock(
      definition,
      definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "arcane-hand"),
    );
    assert.ok(block);
    return block!;
  };
  const definition = parsed(document());
  const block = handBlock(definition);
  assert.deepEqual(block.passableBy, { ability: "str", above: 26, difficult: true });
  assert.equal(block.fillsSpace, false);
  const brute = (str: number): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str },
      actions: [],
    }) as unknown as RulesetStatBlock;
  // A corridor one cell high: the hand at 4, a foe at 2, a friend at 7.
  const fight = (def: RulesetDefinition, foeStr: number, handOf: RulesetStatBlock): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: def,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hand", name: "Hand", side: "party", block: handOf },
        { id: "squire", name: "Squire", side: "party", block: brute(10) },
        { id: "foe", name: "Foe", side: "enemy", block: brute(foeStr) },
      ],
      board: {
        grid: { width: 10, height: 1, tiles: [Array(10).fill("plains")] } as never,
        placements: { hand: { x: 4, y: 0 }, squire: { x: 7, y: 0 }, foe: { x: 2, y: 0 } },
      },
    });
    state.order = ["hand", "squire", "foe"];
    return state;
  };
  const reach = (def: RulesetDefinition, state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    rulesetCombatant(state, id)!.movementLeft = 6;
    return new Map(rulesetReachableCells(def, state, id).map((cell) => [cell.x, cell.cost]));
  };

  // ── Strength 19: stopped at the hand ──
  {
    const goes = reach(definition, fight(definition, 19, block), "foe");
    assert.ok(goes.has(3), "up to it");
    assert.ok(!goes.has(4) && !goes.has(5), "never through it");
  }
  // ── Strength 27: through as hard going, and may stop in it ──
  {
    const goes = reach(definition, fight(definition, 27, block), "foe");
    assert.equal(goes.get(3), 1);
    assert.equal(goes.get(4), 3, "its space costs double");
    assert.equal(goes.get(5), 4);
  }
  // ── A friend stops in its space; filling it, only walks past ──
  {
    const goes = reach(definition, fight(definition, 19, block), "squire");
    assert.ok(goes.has(4), "stops in the hand's space");
    const { fillsSpace: _, ...filling } = block;
    const past = reach(definition, fight(definition, 19, filling as RulesetStatBlock), "squire");
    assert.ok(!past.has(4) && past.has(3), "walks past, never stops");
  }

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(document({ passableBy: { ability: "might", above: 26 } }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Unknown ability "might"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature moved through only by the strong or filling none of its space (passableBy, fillsSpace) requires schemaVersion 2 and capabilityApi 1.600 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(599) as never, document()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(599) as never, document({ passableBy: undefined })),
      gate,
      "fillsSpace alone",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(600) as never, document()), gate);
  }

  console.log(
    "Passable by: a foe of Strength 19 stopped, one of 27 through as hard going; a friend stops in a space it does not fill; gated at 1.600.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
