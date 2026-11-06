/**
 * A condition that ends through its source (Capability API 1.584): Enthrall.
 *
 *   - `endsWhenSource.effects`: off once its source is incapacitated.
 *   - `endsWhenSource.components`: off once its source is stopped from speaking.
 *   - `endsWhenSource.holderLacks`: off once its holder cannot hear.
 *   - `endsWhenSource.conditions`: off once its source holds one.
 *   - Unknown names refused, and the install gate.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ends-when-source-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 584);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const rule = {
    effects: ["cannot-act"],
    components: ["verbal"],
    holderLacks: ["hearing"],
    conditions: ["invisible_bard"],
  };
  const document = (edit: (doc: any) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    // `hearing` is no declared sense: it is what deafness `lacks` (5e's own shape).
    doc.combat.components = [{ id: "verbal", label: "Verbal" }];
    for (const id of ["enthralled", "silenced", "deaf", "invisible_bard"])
      doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push(
      { condition: "enthralled", effects: [], endsWhenSource: structuredClone(rule) },
      { condition: "silenced", effects: [], forbids: { components: ["verbal"] } },
      { condition: "deaf", effects: [], lacks: ["hearing"] },
      { condition: "invisible_bard", effects: [] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const block = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "bard",
          name: "Bard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 30 },
          }),
          live: {},
        },
        { id: "orc", name: "Orc", side: "enemy", block },
      ],
    });
    state.order = ["bard", "orc"];
    state.turn = 0;
    rulesetCombatant(state, "orc")!.tracked.push({ condition: "enthralled", rounds: 10, source: "bard" });
    return state;
  };
  const step = (state: RulesetEncounterState) =>
    applyRulesetCombatChoice(definition, state, { actorId: "bard", optionId: "end-turn", targetIds: [] }, () => 10)
      .state;
  const enthralled = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "orc")!.tracked.some((one) => one.condition === "enthralled");

  // Untouched, it holds.
  assert.ok(enthralled(step(fight())));
  // The bard incapacitated, silenced, or holding the named condition; the orc deafened.
  for (const [who, condition] of [
    ["bard", "incapacitated"],
    ["bard", "silenced"],
    ["bard", "invisible_bard"],
    ["orc", "deaf"],
  ] as const) {
    const state = fight();
    rulesetCombatant(state, who)!.tracked.push({ condition, rounds: null });
    assert.ok(!enthralled(step(state)), `${who} ${condition} ends it`);
  }
  // Silence on the orc, not the bard, leaves it.
  {
    const state = fight();
    rulesetCombatant(state, "orc")!.tracked.push({ condition: "silenced", rounds: null });
    assert.ok(enthralled(step(state)), "the orc's own silence is nothing to it");
  }

  // ── Refusals ──
  const swap = (key: string, value: string[]) =>
    document((doc) => {
      const entry = doc.combat.conditions.find((one: any) => one.condition === "enthralled");
      entry.endsWhenSource = { [key]: value };
    });
  refused(swap("components", ["mime"]), /Unknown component "mime"/);
  refused(swap("holderLacks", ["smell"]), /Unknown sense "smell"/);
  refused(swap("conditions", ["nope"]), /Unknown condition "nope"/);
  refused(
    document((doc) => (doc.combat.conditions.find((one: any) => one.condition === "enthralled").endsWhenSource = {})),
    /Say what ends it/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that ends when its source is stopped or unheard (endsWhenSource) requires schemaVersion 2 and capabilityApi 1.584 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(583) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(584) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(583) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Ends when source: Enthrall ends as its caster is incapacitated, silenced or holds the named condition, or its holder goes deaf; gated at 1.584.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
