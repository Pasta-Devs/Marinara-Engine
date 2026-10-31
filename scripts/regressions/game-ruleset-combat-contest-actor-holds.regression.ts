/**
 * A contest offered only to an actor holding a condition (Capability API 1.578).
 *
 *   - The Grappler feat's pin, with `actorHolds: ["grappling"]`: offered to the one holding the
 *     feat's condition, and to nobody else, even with a creature grappled.
 *   - An unknown condition there is refused.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-actor-holds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 578);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const pin = {
    id: "pin",
    label: "Pin",
    budget: "action",
    attacker: { checks: ["might"] },
    defender: { checks: ["might", "agility"] },
    targetHolds: "grappled",
    targetHeldBySelf: true,
    actorHolds: ["grappling"],
    onWin: { both: { applies: ["restrained"], whileTargetHolds: "grappled" } },
  };
  const document = (edit: (doc: any) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.contests.push(structuredClone(pin));
    doc.sheet.live.conditions.push({ id: "grappling", label: "Grappler" });
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown) => parseRulesetDefinition(doc);
  const parsed = parse(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;

  const unknown = parse(document((doc) => (doc.combat.contests.at(-1).actorHolds = ["nonesuch"])));
  assert.ok(!unknown.ok && unknown.issues.some((one) => one.includes('Unknown condition "nonesuch"')));

  const creature = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      checks: { might: -5, agility: -5 },
      actions: [
        { id: "slam", name: "Slam", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 3 }, reach: 1 },
      ],
    }) as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 60 },
  });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {} },
        { id: "wolf", name: "Wolf", side: "enemy", block: creature() },
      ],
    });
    state.order = ["hero", "wolf"];
    state.turn = 0;
    rulesetCombatant(state, "wolf")!.tracked.push({ condition: "grappled", rounds: null, source: "hero" });
    return state;
  };
  const pinOf = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Pin");

  // ── Without the feat's condition, no pin, even on a creature they grapple ──
  assert.equal(pinOf(fight()), undefined, "no pin without the feat");

  // ── With it, the pin, and it restrains both ──
  {
    const state = fight();
    rulesetCombatant(state, "hero")!.tracked.push({ condition: "grappling", rounds: null, kept: true });
    const option = pinOf(state);
    assert.ok(option, "pin offered to the one with the feat");
    const pinned = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["wolf"] },
      () => 10,
    );
    const holds = (id: string) => rulesetCombatant(pinned.state, id)!.tracked.map((one) => one.condition);
    assert.ok(holds("wolf").includes("restrained"));
    assert.ok(holds("hero").includes("restrained"));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a contest offered only to an actor holding a condition (actorHolds) requires schemaVersion 2 and capabilityApi 1.578 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(577) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(578) as never, document()), gate);
  }

  console.log(
    "Contest actorHolds: the pin is offered only to the one holding the feat's condition; unknown conditions refused; gated at 1.578.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
