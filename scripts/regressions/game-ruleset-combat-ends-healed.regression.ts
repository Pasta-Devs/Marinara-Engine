/**
 * A condition that ends when its holder regains health (Capability API 1.684).
 *
 *   - `endsWhen: ["healed"]`: caltrops' slowed walk ends on any heal that gives back at least one
 *     point, magical or not; a heal at full health ends nothing.
 *   - `endsWhen: ["healed-by-magic"]`: an Infernal Wound ends on a magical heal only.
 *   - Import refusals, and the install gate.
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
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ends-healed-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 684);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (endsWhen: unknown = ["healed-by-magic"]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items ??= { categories: [{ id: "gear", label: "Gear" }] };
    doc.items.tags = [...(doc.items.tags ?? []), { id: "magical", label: "Magical" }];
    doc.sheet.live.conditions.push(
      { id: "infernal_wound", label: "Infernal Wound" },
      { id: "caltropped", label: "Caltropped" },
    );
    doc.combat.conditions.push(
      { condition: "infernal_wound", effects: [], endsWhen },
      { condition: "caltropped", effects: [], endsWhen: ["healed"] },
    );
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
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({
      health: 40,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "cure", name: "Cure", budget: "action", heal: { flat: 6 }, qualities: ["magical"], targets: "ally" },
        { id: "bandage", name: "Bandage", budget: "action", heal: { flat: 6 }, targets: "ally" },
      ],
    }) as unknown as RulesetStatBlock;
  /** The cleric tends the fighter, at `health`, with `optionId`; what the fighter still holds. */
  const tend = (optionId: string, health = 20) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "cleric", name: "Cleric", side: "party", block: block() },
        { id: "fighter", name: "Fighter", side: "party", block: block() },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    state.order = ["cleric", "fighter", "foe"];
    state.turn = 0;
    const fighter = rulesetCombatant(state, "fighter")!;
    fighter.health!.value = health;
    fighter.tracked.push({ condition: "infernal_wound", rounds: null }, { condition: "caltropped", rounds: null });
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId, targetIds: ["fighter"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return rulesetCombatant(step.state, "fighter")!
      .tracked.map((one) => one.condition)
      .sort();
  };

  assert.deepEqual(tend("cure"), [], "a magical heal closes the wound and frees the walk");
  assert.deepEqual(tend("bandage"), ["infernal_wound"], "a plain heal frees the walk only");
  assert.deepEqual(tend("cure", 40), ["caltropped", "infernal_wound"], "nothing regained, nothing ended");

  // ── Refusals ──
  refused(fiveE(["healed", "healed"]), /Condition endings must be unique/);
  refused(fiveE(["mended"]), /endsWhen/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that ends when its holder regains health (endsWhen healed, healed-by-magic) requires schemaVersion 2 and capabilityApi 1.684 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(683) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(684) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(683) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Ends healed: any heal frees a slowed walk, only magic closes an Infernal Wound; gated at 1.684.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
