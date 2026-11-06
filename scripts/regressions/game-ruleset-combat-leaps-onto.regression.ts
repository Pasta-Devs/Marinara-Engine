/**
 * Leaping onto others (Capability API 1.725): a bulette's Deadly Leap.
 *
 *   - Offered as cells: jumps of at least `atLeast` on its own movement, landing where others stand.
 *   - Each it lands on saves: on a failure the damage and prone, on a success half; then each is set
 *     down beside it. One who saved with no room to be set down takes `noRoom` where it stands.
 *   - Import refusals and the install gate.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-leaps-onto-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 725);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const deadlyLeap = (leapsOnto: unknown = { atLeast: 15, noRoom: "prone" }) => ({
    id: "deadly-leap",
    name: "Deadly Leap",
    budget: "action",
    damage: { count: 0, sides: 0, flat: 10 },
    save: { save: "str_save", or: "dex_save", difficulty: 16, onSuccess: "half" },
    applies: [{ condition: "prone", duration: "instant" }],
    leapsOnto,
  });
  const fiveE = (leapsOnto?: unknown, jumping = true): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    if (jumping)
      doc.combat.jumping = {
        long: { ability: "str", of: "score" },
        high: { ability: "str", of: "modifier", plus: 3 },
        runUp: 10,
        standing: "half",
      };
    const creature = doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature;
    creature.jump = { long: 30, high: 15, withoutRunUp: true };
    creature.actions.push({
      ...deadlyLeap(leapsOnto),
      id: "deadly_leap",
      damage: { dice: "1d4", flat: 9, type: "bludgeoning" },
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
  // Copied off its catalog entry into its block.
  {
    const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
    const block = rulesetStatBlockFromCreature(definition, creature)!;
    assert.deepEqual(block.actions.find((one) => one.id === "deadly_leap")?.leapsOnto, {
      atLeast: 15,
      noRoom: "prone",
    });
  }
  const plain = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 50,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      saves: { str_save: 0, dex_save: 0 },
      actions: [],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const bulette = plain({ speed: 40, jump: { long: 30, high: 15, withoutRunUp: true }, actions: [deadlyLeap()] });
  const fight = (width: number, height: number, placements: Record<string, { x: number; y: number }>) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "bulette", name: "Bulette", side: "enemy", block: bulette },
        { id: "fighter", name: "Fighter", side: "party", block: plain() },
        ...(placements.rogue ? [{ id: "rogue", name: "Rogue", side: "party" as const, block: plain() }] : []),
        ...(placements.kobold ? [{ id: "kobold", name: "Kobold", side: "enemy" as const, block: plain() }] : []),
      ],
      board: {
        grid: {
          width,
          height,
          tiles: Array.from({ length: height }, () => Array.from({ length: width }, () => "plains")),
        } as never,
        placements,
      },
    });
    state.order = ["bulette", ...state.order.filter((id) => id !== "bulette")];
    state.turn = 0;
    return state;
  };
  const leap = (state: ReturnType<typeof fight>, d20: number, to: { x: number; y: number }) => {
    const option = rulesetCombatOptions(definition, state, "bulette").find((one) => one.label === "Deadly Leap");
    assert.ok(option, "no Deadly Leap");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "bulette", optionId: option.id, targetIds: [], to },
      (sides) => (sides === 20 ? d20 : 1),
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const prone = (state: { combatants: unknown[] }, id: string) =>
    rulesetCombatant(state as never, id)!.tracked.some((one) => one.condition === "prone");
  const health = (state: { combatants: unknown[] }, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state as never, id)!).value;

  // ── Offered only where it lands on somebody, at least 15 feet off ──
  {
    const state = fight(8, 3, { bulette: { x: 0, y: 1 }, fighter: { x: 4, y: 1 }, rogue: { x: 1, y: 0 } });
    const option = rulesetCombatOptions(definition, state, "bulette").find((one) => one.label === "Deadly Leap");
    assert.deepEqual(
      option?.cells?.map((cell) => [cell.x, cell.y]),
      [[4, 1]],
    );
    // Nobody far enough off: not offered.
    const near = fight(8, 3, { bulette: { x: 0, y: 1 }, fighter: { x: 2, y: 1 } });
    assert.equal(
      rulesetCombatOptions(definition, near, "bulette").some((one) => one.label === "Deadly Leap"),
      false,
    );
  }

  // ── Failed: the damage and prone, then set down beside it ──
  {
    const step = leap(fight(8, 3, { bulette: { x: 0, y: 1 }, fighter: { x: 4, y: 1 } }), 1, { x: 4, y: 1 });
    const bulettePos = rulesetCombatant(step.state, "bulette")!;
    assert.deepEqual([bulettePos.x, bulettePos.y], [4, 1]);
    assert.equal(
      of(step.events, "move").some((one) => one.jumped),
      true,
    );
    assert.equal(health(step.state, "fighter"), 40);
    assert.equal(prone(step.state, "fighter"), true);
    const fighter = rulesetCombatant(step.state, "fighter")!;
    assert.equal(Math.max(Math.abs(fighter.x! - 4), Math.abs(fighter.y! - 1)), 1, "beside it");
    assert.equal(of(step.events, "pushed").length, 1);
  }

  // ── Saved: half, not prone, set down beside it ──
  {
    const step = leap(fight(8, 3, { bulette: { x: 0, y: 1 }, fighter: { x: 4, y: 1 } }), 20, { x: 4, y: 1 });
    assert.equal(health(step.state, "fighter"), 45);
    assert.equal(prone(step.state, "fighter"), false);
    assert.equal(of(step.events, "pushed").length, 1);
  }

  // ── Saved with no room beside: prone where it stands ──
  {
    const state = fight(5, 1, { bulette: { x: 0, y: 0 }, kobold: { x: 3, y: 0 }, fighter: { x: 4, y: 0 } });
    const step = leap(state, 20, { x: 4, y: 0 });
    assert.equal(health(step.state, "fighter"), 45);
    assert.equal(prone(step.state, "fighter"), true);
    const fighter = rulesetCombatant(step.state, "fighter")!;
    assert.deepEqual([fighter.x, fighter.y], [4, 0]);
    assert.equal(of(step.events, "pushed").length, 0);
  }

  // ── Refusals and the install gate ──
  {
    refused(fiveE(undefined, false), /A leap is a jump, so the combat block has "jumping"/);
    refused(fiveE({ atLeast: 15, noRoom: "sprawled" }), /Unknown condition "sprawled"/);
    const gate =
      "A ruleset with a creature's leap onto others (leapsOnto) requires schemaVersion 2 and capabilityApi 1.725 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(724) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(725) as never, fiveE()), gate);
  }

  console.log(
    "Deadly Leap: offered only onto somebody 15 feet off; a failure takes the damage and prone, a save half, each set down beside it, or prone where it stands with no room; gated at 1.725.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
