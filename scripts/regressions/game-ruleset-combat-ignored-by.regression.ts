/**
 * A worn item that keeps creatures of some bestiary entries from aiming at its wearer (Capability API
 * 1.619): 5e's Pipes of the Sewers, "ordinary rats and giant rats are indifferent toward you and will
 * not attack you unless you threaten or harm them".
 *
 *   - A rat never aims at the piper while the pipes are worn, but still at the piper's friend.
 *   - Not worn, or a creature of another entry: aimed at as ever.
 *   - `untilHarmed`: the rat the piper attacks aims at them again; another rat still does not.
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ignored-by-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 619);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "pipes",
          label: "Pipes of the Sewers",
          item: {
            category: "gear",
            worn: {
              ignoredBy: { entries: ["creatures/rat", "creatures/giant-rat"], untilHarmed: true },
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
  const pipes = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const bite = {
    name: "Bite",
    budget: "action",
    toHit: 4,
    damage: { count: 1, sides: 4, flat: 0 },
    reach: 5,
  };
  const block = {
    health: 10,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [bite],
  } as unknown as RulesetStatBlock;
  const fight = (worn = true): RulesetEncounterState => {
    const character = (id: string, name: string, items: unknown[] = []) => ({
      id,
      name,
      side: "party" as const,
      build: rulesetSheetBuildSchema.parse({
        abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
        fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
      }),
      live: {},
      catalogs: {},
      items: items as never,
    });
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        character("piper", "Piper", [{ item: pipes, quantity: 1, worn, name: "Pipes of the Sewers" }]),
        character("bard", "Bard"),
        { id: "rat", name: "Rat", side: "enemy", block },
        { id: "rat2", name: "Rat", side: "enemy", block },
        { id: "wolf", name: "Wolf", side: "enemy", block },
      ],
    });
    rulesetCombatant(state, "rat")!.creature = { catalogId: "creatures", entryId: "rat" };
    rulesetCombatant(state, "rat2")!.creature = { catalogId: "creatures", entryId: "giant-rat" };
    rulesetCombatant(state, "wolf")!.creature = { catalogId: "creatures", entryId: "wolf" };
    state.order = ["piper", "rat", "rat2", "wolf", "bard"];
    state.turn = 0;
    return state;
  };
  const aimsAt = (state: RulesetEncounterState, actorId: string) => {
    state = structuredClone(state);
    state.turn = state.order.indexOf(actorId);
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === "Bite")!;
    assert.ok(option, "no Bite");
    return rulesetOptionTargets(definition, state, actorId, option).sort();
  };

  // ── Worn: the rats leave the piper alone, never the bard; a wolf does not ──
  {
    const state = fight();
    assert.deepEqual(aimsAt(state, "rat"), ["bard"]);
    assert.deepEqual(aimsAt(state, "rat2"), ["bard"]);
    assert.deepEqual(aimsAt(state, "wolf"), ["bard", "piper"]);
  }
  // ── Not worn: aimed at as ever ──
  assert.deepEqual(aimsAt(fight(false), "rat"), ["bard", "piper"]);
  // ── Shoved by the piper: that rat aims at them again, the other does not ──
  {
    let state = fight();
    const strike = rulesetCombatOptions(definition, state, "piper").find((one) => one.label === "Shove prone");
    assert.ok(
      strike,
      rulesetCombatOptions(definition, state, "piper")
        .map((one) => `${one.kind}:${one.label}`)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "piper", optionId: strike.id, targetIds: ["rat"] },
      () => 15,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    state = step.state;
    assert.deepEqual(rulesetCombatant(state, "piper")!.provoked, ["rat"]);
    assert.deepEqual(aimsAt(state, "rat"), ["bard", "piper"]);
    assert.deepEqual(aimsAt(state, "rat2"), ["bard"]);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item that keeps creatures of some entries from aiming at its wearer (ignoredBy) requires schemaVersion 2 and capabilityApi 1.619 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(618) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(619) as never, document()), gate);
  }

  console.log(
    "worn.ignoredBy: rats leave the piper alone but not the bard, a wolf does not; one the piper attacks aims at them again; gated at 1.619.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
