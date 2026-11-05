/**
 * A condition that puts others on with it (Capability API 1.765).
 *
 *   - `alsoApplies` on a `combat.conditions` entry: each named condition goes on with it, lasting until
 *     it comes off on its own, and stays when the first one ends. 5e's unconscious, prone.
 *   - One its holder is immune to stays off; one it already holds is not put on again.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-also-applies-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 765);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const conditionOf = (doc: Record<string, any>, id: string) =>
    (doc.combat.conditions as Array<Record<string, any>>).find((one) => one.condition === id)!;
  const withProne = (doc: Record<string, any>) => {
    conditionOf(doc, "unconscious").alsoApplies = ["prone"];
  };
  const parse = (document: unknown) => parseRulesetDefinition(document);
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parse(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE(withProne));

  const nap = {
    id: "nap",
    label: "Nap",
    rows: [{ list: "spells", values: { name: "Nap", level: 1, prepared: true } }],
    mechanics: { kind: "debuff", range: 60, applies: [{ condition: "unconscious", duration: { rounds: 1 } }] },
  } as unknown as RulesetCatalogEntry;
  const spells = [nap];
  const block: RulesetStatBlock = { health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block },
        { id: "b", name: "B", side: "enemy", block: { ...block, conditionImmunities: ["prone"] } },
      ],
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const napAt = (state: RulesetEncounterState, targetId: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Nap");
    assert.ok(option, "the mage can cast Nap");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [targetId] },
      roll,
    );
  };
  const holds = (state: RulesetEncounterState, id: string) =>
    rulesetCombatant(state, id)!
      .tracked.map((entry) => entry.condition)
      .sort();

  // ── Unconscious puts prone on too, and prone stays once it ends ──
  {
    let step = napAt(fight(), "a");
    assert.deepEqual(holds(step.state, "a"), ["prone", "unconscious"]);
    assert.deepEqual(
      step.events.filter((one) => one.type === "condition").map((one) => (one as { condition: string }).condition),
      ["unconscious", "prone"],
    );
    for (let turn = 0; turn < 6 && holds(step.state, "a").includes("unconscious"); turn++)
      step = advanceRulesetTurn(definition, step.state, roll);
    assert.deepEqual(holds(step.state, "a"), ["prone"], "still prone after it wakes");
  }

  // ── Immune to prone, only unconscious goes on; already prone, prone is not put on again ──
  {
    const step = napAt(fight(), "b");
    assert.deepEqual(holds(step.state, "b"), ["unconscious"]);
    const state = fight();
    rulesetCombatant(state, "a")!.tracked.push({ condition: "prone", rounds: null });
    const again = napAt(state, "a");
    assert.deepEqual(
      again.events.filter((one) => one.type === "condition").map((one) => (one as { condition: string }).condition),
      ["unconscious"],
    );
    assert.deepEqual(holds(again.state, "a"), ["prone", "unconscious"]);
  }

  // ── Refusals ──
  {
    const refusedWith = (alsoApplies: string[], pattern: RegExp) => {
      const result = parse(
        fiveE((doc) => {
          conditionOf(doc, "unconscious").alsoApplies = alsoApplies;
        }),
      );
      assert.equal(result.ok, false);
      assert.match(result.ok ? "" : result.issues.join("; "), pattern);
    };
    refusedWith(["unconscious"], /does not put itself on/);
    refusedWith(["sleepy"], /Unknown condition "sleepy"/);
  }

  // ── The gate ──
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
      "A ruleset with a condition that puts others on with it (alsoApplies) requires schemaVersion 2 and capabilityApi 1.765 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(764) as never, fiveE(withProne)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(765) as never, fiveE(withProne)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(764) as never, fiveE()), gate, "nothing without the key");
  }

  console.log(
    "alsoApplies: unconscious puts prone on, which stays once it wakes; an immunity keeps it off, a held one is not doubled; refusals; gated at 1.765.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
