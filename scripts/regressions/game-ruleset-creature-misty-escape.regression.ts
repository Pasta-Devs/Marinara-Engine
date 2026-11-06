/**
 * Hanging on as one of its forms (Capability API 1.548).
 *
 *   - A vampire's Misty Escape: dropped to 0, it hangs on at 1 and is at once in its mist form, as its
 *     Change Shape puts it on, fighting with the mist's actions; once, and then it falls.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-misty-escape-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 548);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const entries = [
    {
      id: "smite",
      label: "Smite",
      rows: [{ list: "spells", values: { name: "Smite", level: 0, prepared: true } }],
      mechanics: {
        kind: "attack",
        targets: "enemy",
        range: 120,
        autoHit: true,
        amount: { flat: 30 },
        damageType: "radiant",
      },
    },
  ].map((entry) => entry as unknown as RulesetCatalogEntry);
  const misty = { uses: 1, label: "Misty Escape", becomes: { action: "change", form: "creatures/vampire-mist" } };
  const fiveE = (hangsOn: unknown = misty): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "shapechanged", label: "Shapechanged" });
    doc.combat.conditions.push({ condition: "shapechanged", effects: [], shape: { health: "own" } });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries;
    creatures.push(
      {
        id: "vampire-mist",
        label: "Vampire Mist",
        creature: {
          health: 1,
          defense: 16,
          initiativeModifier: 0,
          speed: 0,
          tier: "cr_0",
          speeds: { fly: 20 },
          actions: [{ id: "drift", name: "Drift", budget: "action", toHit: 0, damage: { flat: 0 }, reach: 5 }],
        },
      },
      {
        id: "vampire",
        label: "Vampire",
        creature: {
          health: 20,
          defense: 16,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_5",
          actions: [
            { id: "bite", name: "Bite", budget: "action", toHit: 9, damage: { flat: 7 }, reach: 5 },
            {
              id: "change",
              name: "Shapechanger",
              budget: "action",
              applies: [{ condition: "shapechanged", duration: "until-dispelled" }],
              forms: { into: ["creatures/vampire-mist"] },
            },
          ],
          hangsOn,
        },
      },
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const vampire = rulesetCreatureBlock(
    definition,
    definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "vampire"),
  );
  assert.ok(vampire);
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "cleric",
        name: "Cleric",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis" },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "vampire", name: "Vampire", side: "enemy", block: vampire },
    ],
  });
  state.order = ["cleric", "vampire"];
  state.turn = 0;
  const smite = (from: RulesetEncounterState) => {
    from.turn = 0;
    rulesetCombatant(from, "cleric")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, from, "cleric").find((one) => one.label === "Smite");
    assert.ok(option);
    const step = applyRulesetCombatChoice(
      definition,
      from,
      { actorId: "cleric", optionId: option.id, targetIds: ["vampire"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const first = smite(state);
  {
    const self = rulesetCombatant(first.state, "vampire")!;
    assert.deepEqual(
      of(first.events, "hangsOn").map((one) => one.label),
      ["Misty Escape"],
    );
    assert.equal(rulesetCombatHealth(definition, definition.combat!, self).value, 1, "left at 1");
    assert.equal(self.shape?.form.entryId, "vampire-mist", "in its mist");
    assert.ok(self.tracked.some((one) => one.condition === "shapechanged"));
    assert.ok(!self.actions.some((one) => one.label === "Bite"), "the mist's actions, not its own");
    assert.ok(!self.defeated);
  }
  const second = smite(first.state);
  assert.ok(rulesetCombatant(second.state, "vampire")!.defeated, "once: the next blow ends it");

  // ── Refusals ──
  refused(fiveE({ ...misty, becomes: { action: "change", form: "vampire-mist" } }), /A form is a catalog\/entry/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset that hangs on at 1 in one of its forms (hangsOn becomes) requires schemaVersion 2 and capabilityApi 1.548 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(547) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(548) as never, fiveE()), gate);
  }

  console.log(
    "Misty Escape: a vampire dropped to 0 hangs on at 1 in its mist form, as its Shapechanger puts it on, once; refused for a form not named by catalog; gated at 1.548.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
