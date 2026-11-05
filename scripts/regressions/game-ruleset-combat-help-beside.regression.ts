/**
 * Help against an opponent beside the helper (Capability API 1.771): `combat.standardEffects.help`.
 *
 *   - With `beside: true`, Help is not offered while the helper has no opponent beside them.
 *   - Given beside an opponent, it counts only for an attack against that opponent, and only such an
 *     attack spends it.
 *   - Without the key, help counts against anybody.
 *   - The validation refusal and the install gate.
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
  rulesetOptionTargets,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetUnaimableKey } from "../../packages/client/src/lib/ruleset-combat-menu.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-help-beside-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 771);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: any) => void = (doc) => (doc.combat.standardEffects.help = { beside: true })) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const block = (initiativeModifier: number): RulesetStatBlock =>
    ({
      health: 50,
      defense: 12,
      initiativeModifier,
      speed: 30,
      actions: [
        { id: "slam", name: "Slam", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 3 }, reach: 1 },
      ],
    }) as unknown as RulesetStatBlock;
  const dice = (...faces: number[]) => {
    let at = 0;
    return () => faces[at++ % faces.length]!;
  };
  /** Pell helps Juno; Snag stands beside both, Rot beside Juno only. Snag starts away when `alone`; Juno when `far`. */
  const fight = (definition: RulesetDefinition, alone = false, far = false): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: dice(20, 15, 5, 1),
      combatants: [
        { id: "pell", name: "Pell", side: "party", block: block(9) },
        { id: "juno", name: "Juno", side: "party", block: block(8) },
        { id: "snag", name: "Snag", side: "enemy", block: block(0) },
        { id: "rot", name: "Rot", side: "enemy", block: block(-1) },
      ],
      board: {
        grid: {
          width: 8,
          height: 3,
          tiles: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => "plains" as const)),
        },
        placements: {
          pell: { x: 1, y: 1 },
          snag: alone ? { x: 7, y: 0 } : { x: 1, y: 0 },
          juno: far ? { x: 6, y: 2 } : { x: 2, y: 1 },
          rot: { x: 3, y: 1 },
        },
      },
    } as never);
  const helpTargets = (definition: RulesetDefinition, state: RulesetEncounterState) =>
    rulesetOptionTargets(definition, state, "pell", { id: "standard:help", targets: { side: "ally", count: 1 } });
  const choose = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    actorId: string,
    optionId: string,
    targetIds: string[],
  ) => applyRulesetCombatChoice(definition, state, { actorId, optionId, targetIds }, dice(4, 16, 3));
  const slamOf = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    const slam = rulesetCombatOptions(definition, state, "juno").find((option) => option.label === "Slam");
    assert.ok(slam, "Juno's slam is on the menu");
    return slam.id;
  };
  const attackMode = (events: RulesetCombatEvent[]) => {
    const attack = events.find((event) => event.type === "attack") as { mode?: string } | undefined;
    assert.ok(attack, "an attack was rolled");
    return attack.mode;
  };
  const helped = (definition: RulesetDefinition) => {
    let state = fight(definition);
    assert.equal(state.order[0], "pell");
    assert.ok(helpTargets(definition, state).includes("juno"), "help is offered beside an opponent");
    state = choose(definition, state, "pell", "standard:help", ["juno"]).state;
    return choose(definition, state, "pell", "end-turn", []).state;
  };

  const beside = parsed(fiveE());
  // ── Nobody beside the helper, no help ──
  assert.deepEqual(helpTargets(beside, fight(beside, true)), [], "no opponent beside the helper, no help");
  // A greyed Help says why: no opponent beside (re-test 10), not that nobody is in sight.
  const greyed = rulesetCombatOptions(beside, fight(beside, true), "pell").find((one) => one.id === "standard:help");
  assert.equal(greyed?.besideOnly, true);
  assert.equal(rulesetUnaimableKey({ ...greyed!, targetIds: [] } as never), "game.combat.ruleset.menu.noFoeBeside");
  // ── The helped ally can stand anywhere: only the opponent must be beside the helper ──
  assert.ok(helpTargets(beside, fight(beside, false, true)).includes("juno"), "help reaches an ally across the field");
  // ── Help counts only against the opponent beside the helper ──
  {
    let state = helped(beside);
    assert.deepEqual(rulesetCombatant(state, "juno")!.flags.helpedAgainst, ["snag"]);
    const atRot = choose(beside, state, "juno", slamOf(beside, state), ["rot"]);
    assert.equal(attackMode(atRot.events), "normal", "Rot was not beside the helper");
    assert.equal(rulesetCombatant(atRot.state, "juno")!.flags.helped, true, "and that attack did not spend the help");
    state = choose(beside, atRot.state, "juno", "end-turn", []).state;
    for (const id of ["snag", "rot", "pell"]) state = choose(beside, state, id, "end-turn", []).state;
    assert.equal(rulesetCombatant(state, "juno")!.flags.helped, true, "the help survives Juno's next turn starting");
    const atSnag = choose(beside, state, "juno", slamOf(beside, state), ["snag"]);
    assert.equal(attackMode(atSnag.events), "advantage", "Snag was beside the helper");
    assert.equal(rulesetCombatant(atSnag.state, "juno")!.flags.helped, false, "the attack at Snag spent it");
    assert.equal(rulesetCombatant(atSnag.state, "juno")!.flags.helpedAgainst, undefined);
  }
  // ── Without the key, help counts against anybody, wherever the helper stands ──
  {
    const anywhere = parsed(fiveE(() => {}));
    assert.ok(helpTargets(anywhere, fight(anywhere, true)).includes("juno"), "help offered with nobody beside");
    const plain = rulesetCombatOptions(anywhere, fight(anywhere, true), "pell").find(
      (one) => one.id === "standard:help",
    );
    assert.equal(plain?.besideOnly, undefined);
    const state = helped(anywhere);
    assert.equal(rulesetCombatant(state, "juno")!.flags.helpedAgainst, undefined);
    assert.equal(attackMode(choose(anywhere, state, "juno", slamOf(anywhere, state), ["rot"]).events), "advantage");
  }

  // ── Refused without help to belong to ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.combat.standardEffects.help = { beside: true };
        doc.combat.standard = doc.combat.standard.filter((one: string) => one !== "help");
      }),
    );
    assert.ok(!result.ok && result.issues.some((one) => one.includes("no help for this to belong to")));
  }

  // ── The install gate ──
  {
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
    const gate =
      "A ruleset whose help is against an opponent beside the helper (standardEffects.help) requires schemaVersion 2 and capabilityApi 1.771 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(770) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(771) as never, fiveE()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(770) as never,
        fiveE(() => {}),
      ),
      gate,
    );
  }

  console.log(
    "Help beside: offered only beside an opponent, counting and spent only against one who was beside the helper; gated at 1.771.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
