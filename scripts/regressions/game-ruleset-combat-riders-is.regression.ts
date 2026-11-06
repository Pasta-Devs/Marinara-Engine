/**
 * A creature's action whose riders go only on some targets (Capability API 1.698): a merrow's
 * Harpoon, "If the target is Huge or smaller, it must succeed on a Strength contest against the
 * merrow or be pulled up to 20 feet toward the merrow".
 *
 *   - A Medium target: struck, the contest thrown, pulled on a loss.
 *   - A Gargantuan target: struck, no contest, not pulled.
 *   - What it puts on goes the same way.
 *   - Copied from a catalog creature; refused with nothing to narrow or an unknown size.
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
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-riders-is-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 698);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const harpoon = (more: Record<string, unknown> = {}) => ({
    id: "harpoon",
    name: "Harpoon",
    budget: "action",
    toHit: 4,
    damage: { dice: "1d4", flat: 1, type: "piercing" },
    reach: 30,
    pull: 20,
    contest: { attacker: ["might"], defender: ["might"] },
    applies: [{ condition: "prone", duration: { rounds: 1 } }],
    ridersIs: { upToSize: "huge" },
    ...more,
  });
  const withHarpoon = (action: Record<string, unknown> = harpoon(), sizes = true) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.actions.push(action);
    if (sizes)
      doc.combat.sizes = {
        order: [
          { id: "medium", label: "Medium" },
          { id: "huge", label: "Huge", cells: 3 },
          { id: "gargantuan", label: "Gargantuan", cells: 4 },
        ],
        default: "medium",
      };
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
  const definition = parsed(withHarpoon());
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const merrow = rulesetStatBlockFromCreature(definition, creature)!;
  assert.deepEqual(
    (merrow.actions.find((one) => one.id === "harpoon") as unknown as { ridersIs: unknown }).ridersIs,
    { upToSize: "huge" },
    "copied to the block",
  );
  const throwAt = (size: string) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "merrow", name: "Merrow", side: "enemy", block: { ...merrow, health: 50 } },
        {
          id: "target",
          name: "Target",
          side: "party",
          block: {
            health: 50,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
            checks: { might: 0 },
            size,
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 20, height: 12, tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")) },
        placements: { merrow: { x: 2, y: 4 }, target: { x: 6, y: 4 } },
      },
    } as never);
    state.order = ["merrow", "target"];
    state.turn = 0;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "merrow", optionId: "harpoon", targetIds: ["target"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    const target = rulesetCombatant(step.state, "target")!;
    return {
      at: { x: target.x, y: target.y },
      damaged: of(step.events, "damage").some((one) => one.targetId === "target"),
      contests: of(step.events, "contest").length,
      prone: target.tracked.some((one) => one.condition === "prone"),
    };
  };

  // ── Medium: the contest, lost, and pulled and knocked down ──
  {
    const medium = throwAt("medium");
    assert.equal(medium.damaged, true);
    assert.equal(medium.contests, 1);
    assert.deepEqual(medium.at, { x: 3, y: 4 }, "pulled beside it");
    assert.equal(medium.prone, true);
  }
  // ── Gargantuan: struck, nothing more ──
  {
    const big = throwAt("gargantuan");
    assert.equal(big.damaged, true, "the damage lands either way");
    assert.equal(big.contests, 0, "no contest");
    assert.deepEqual(big.at, { x: 6, y: 4 }, "not pulled");
    assert.equal(big.prone, false);
  }

  // ── Refused ──
  refused(
    withHarpoon({
      id: "bite",
      name: "Bite",
      budget: "action",
      toHit: 4,
      damage: { dice: "1d4", type: "piercing" },
      reach: 5,
      ridersIs: { upToSize: "huge" },
    }),
    /"ridersIs" narrows what goes on after the blow/,
  );
  refused(withHarpoon(harpoon({ ridersIs: { upToSize: "colossal" } })), /Unknown size "colossal"/);
  refused(withHarpoon(harpoon(), false), /"upToSize" reads combat.sizes/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's action whose riders go only on a target that is something (ridersIs) requires schemaVersion 2 and capabilityApi 1.698 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(697) as never, withHarpoon()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(698) as never, withHarpoon()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(697) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Riders by size: the Harpoon pulls a Medium target, only strikes a Gargantuan one; gated at 1.698.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
