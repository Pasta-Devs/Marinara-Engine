/**
 * Away under a condition its holder may take off at will (Capability API 1.627): 5e's Robe of Stars,
 * "use an action to enter the Astral Plane ... You remain there until you use an action to return".
 *
 *   - Used, its wearer leaves the fight and still takes turns, on which only "End" and ending the
 *     turn are offered; taken, they are back where they left.
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
  rulesetEncounterOutcome,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-away-at-will-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 627);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "astral", label: "On the Astral Plane" });
    doc.combat.conditions.push({ condition: "astral", effects: [], endable: { budget: "action" } });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "robe",
          label: "Robe of Stars",
          item: {
            category: "gear",
            use: {
              kind: "buff",
              budget: "action",
              label: "Enter the Astral Plane",
              targets: "self",
              applies: [{ condition: "astral", duration: "until-dispelled" }],
              dismisses: { while: "astral", turns: true },
            },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const robe = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const start = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
            fields: { level: 9, ac: 13, speed: 30, hp_max: 40 },
          }),
          items: [{ item: robe, quantity: 1, worn: true, name: "Robe of Stars" }],
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 20,
            defense: 12,
            initiativeModifier: 0,
            speed: 40,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["mage", "wolf"];
    state.turn = 0;
    return state;
  };
  const mage = (state: RulesetEncounterState) => rulesetCombatant(state, "mage")!;
  const labels = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "mage").map((one) => one.label);
  const take = (state: RulesetEncounterState, label: RegExp) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => label.test(one.label));
    assert.ok(option, labels(state).join(", "));
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["mage"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const pass = (state: RulesetEncounterState) => {
    for (const id of ["mage", "wolf"]) {
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: id, optionId: "end-turn", targetIds: [] },
        () => 10,
      );
      state = step.state;
    }
    return state;
  };

  // ── Gone, still taking turns, and back at will ──
  {
    let state = start();
    const before = { x: mage(state).x, y: mage(state).y };
    state = take(state, /Enter the Astral Plane/).state;
    assert.ok(mage(state).defeated && mage(state).away?.while === "astral", JSON.stringify(mage(state).away));
    assert.equal(rulesetEncounterOutcome(state), "ongoing", "the fight goes on while they may come back");
    state = pass(state);
    assert.equal(rulesetCombatant(state, state.order[state.turn]!)?.id, "mage", "still takes its turns");
    assert.deepEqual(labels(state), ["End On the Astral Plane", "End turn"]);
    const step = take(state, /^End On the Astral Plane$/);
    assert.ok(
      step.events.some((one) => one.type === "returned"),
      JSON.stringify(step.events),
    );
    assert.ok(!mage(step.state).defeated);
    assert.equal(mage(step.state).away, undefined);
    assert.deepEqual({ x: mage(step.state).x, y: mage(step.state).y }, before);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset that sends its holder away under a condition they may take off at will (dismisses with endable) requires schemaVersion 2 and capabilityApi 1.627 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(626) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(627) as never, document()), gate);
  }

  console.log(
    "away at will: the Robe of Stars takes its wearer out of the fight, still taking turns with only End on offer, and back where they left; gated at 1.627.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
