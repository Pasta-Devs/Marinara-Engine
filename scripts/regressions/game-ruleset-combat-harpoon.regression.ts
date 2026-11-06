/**
 * A creature's action whose riders wait on a contest (Capability API 1.695): a merrow's Harpoon, "a
 * Strength contest against the merrow or be pulled up to 20 feet toward the merrow".
 *
 *   - Hit, its damage lands either way; the pull only where the creature wins the contest.
 *   - A tie is the target's.
 *   - Copied from a catalog creature to its block; refused beside a save or with an unknown check.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-harpoon-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 695);
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
    reach: 10,
    pull: 20,
    contest: { attacker: ["might"], defender: ["might"] },
    ...more,
  });
  const withHarpoon = (action: Record<string, unknown> = harpoon()) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.actions.push(action);
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
  const lurker = rulesetStatBlockFromCreature(definition, creature)!;
  assert.deepEqual(
    (lurker.actions.find((one) => one.id === "harpoon") as unknown as { contest: unknown }).contest,
    { attacker: ["might"], defender: ["might"] },
    "copied to the block",
  );
  // The lurker throws 10 + 1; the hero 10 + their might.
  const throwAt = (might: number) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "lurker", name: "Thorn Lurker", side: "enemy", block: { ...lurker, health: 50 } },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          block: {
            health: 50,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
            checks: { might },
          } as unknown as RulesetStatBlock,
        },
        {
          id: "friend",
          name: "Friend",
          side: "party",
          block: {
            health: 50,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
        placements: { lurker: { x: 2, y: 4 }, hero: { x: 4, y: 4 }, friend: { x: 15, y: 8 } },
      },
    } as never);
    state.order = ["lurker", "hero", "friend"];
    state.turn = 0;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "lurker", optionId: "harpoon", targetIds: ["hero"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    const hero = rulesetCombatant(step.state, "hero")!;
    return {
      at: { x: hero.x, y: hero.y },
      damaged: of(step.events, "damage").some((one) => one.targetId === "hero"),
      contests: of(step.events, "contest").map((one) => [one.attacker.total, one.defender.total, one.winner]),
    };
  };

  // ── Won: struck and pulled beside the lurker ──
  {
    const won = throwAt(0);
    assert.equal(won.damaged, true);
    assert.deepEqual(won.contests, [[11, 10, "actor"]]);
    assert.deepEqual(won.at, { x: 3, y: 4 }, "pulled beside it");
  }
  // ── Lost: struck, not pulled ──
  {
    const lost = throwAt(5);
    assert.equal(lost.damaged, true, "the damage lands either way");
    assert.deepEqual(lost.contests, [[11, 15, "target"]]);
    assert.deepEqual(lost.at, { x: 4, y: 4 });
  }
  // ── A tie: the target's ──
  {
    const tie = throwAt(1);
    assert.deepEqual(tie.contests, [[11, 11, "target"]]);
    assert.deepEqual(tie.at, { x: 4, y: 4 });
  }

  // ── Refused ──
  refused(
    withHarpoon(harpoon({ save: { save: "str_save", difficulty: 12, onSuccess: "none" } })),
    /A "contest" decides what goes on after the blow, so it has no "save" beside it/,
  );
  refused(withHarpoon(harpoon({ contest: { attacker: ["lore"], defender: ["might"] } })), /Unknown check "lore"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's action whose riders wait on a contest (actions[].contest) requires schemaVersion 2 and capabilityApi 1.695 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(694) as never, withHarpoon()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(695) as never, withHarpoon()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(694) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Harpoon: struck either way, pulled beside the lurker only on a contest it wins, a tie the target's; gated at 1.695.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
