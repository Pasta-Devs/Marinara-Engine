/**
 * What a higher cost adds only every so many steps, and on what a condition gives (Capability API
 * 1.300).
 *
 *   - `perCostStepsEvery`: `perCostStep` once for every that many steps of a higher cost.
 *   - An action a condition gives (1.236) grows by the cost the spell that put the condition on was
 *     paid at: 5e's Flame Blade, 3d6 and 1d6 more for every two slot levels above 2nd.
 *   - Import refusals and the install gate.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-steps-every-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 295);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: { ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}), ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // A bolt of 1d6, and 1d6 more for every two slot levels above 1st.
  const bolt = spell("bolt", 1, {
    kind: "attack",
    range: 60,
    autoHit: true,
    amount: { dice: "1d6" },
    damageType: "fire",
    perCostStep: { dice: "1d6" },
    perCostStepsEvery: 2,
  });
  // Flame Blade: a blade of fire in hand, struck with as an action.
  const flame = spell("flame", 2, {
    kind: "buff",
    targets: "self",
    applies: [{ condition: "flaming", duration: { rounds: 100 } }],
  });
  const strike = spell("strike", 0, {
    kind: "attack",
    range: 5,
    autoHit: true,
    amount: { dice: "3d6" },
    damageType: "fire",
    perCostStep: { dice: "1d6" },
    perCostStepsEvery: 2,
  });
  // The same blade, growing with every slot level.
  const plain = spell("plain", 0, {
    kind: "attack",
    range: 5,
    autoHit: true,
    amount: { dice: "1d6" },
    damageType: "fire",
    perCostStep: { dice: "1d6" },
  });
  const spells = [bolt, flame, strike, plain];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "flaming", label: "Flaming" });
    doc.combat.conditions.push({ condition: "flaming", effects: [], actions: ["spells/strike", "spells/plain"] });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const fields: Record<string, number> = { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: 0 };
  for (let level = 1; level <= 5; level++) fields[`slots_max_${level}`] = 4;
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { ...fields, spellcasting_ability: "wis" },
      lists: { spells: [bolt, flame].flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 1,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: {
            health: 500,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
          },
        },
      ],
      board: {
        grid: { width: 10, height: 5, tiles: Array.from({ length: 5 }, () => Array(10).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, a: { x: 3, y: 2 } },
      },
    });
    state.order = ["mage", "a"];
    state.turn = 0;
    return state;
  };
  const use = (
    state: RulesetEncounterState,
    label: string,
    targetIds: string[],
    payWith?: string,
  ): RulesetCombatStep => {
    state.turn = 0;
    const mage = rulesetCombatant(state, "mage")!;
    for (const key of Object.keys(mage.budgets)) mage.budgets[key] = 9;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds, ...(payWith ? { payWith } : {}) },
      () => 1,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const dice = (step: RulesetCombatStep) =>
    step.events.flatMap((one) => (one.type === "damage" && one.targetId === "a" ? [one.rolls.length] : []))[0];

  // ── Once for every two steps ──
  {
    assert.equal(dice(use(fight(), "Bolt", ["a"])), 1, "1st level");
    assert.equal(dice(use(fight(), "Bolt", ["a"], "slots_2")), 1, "one step: nothing more");
    assert.equal(dice(use(fight(), "Bolt", ["a"], "slots_3")), 2, "two steps: 1d6 more");
    assert.equal(dice(use(fight(), "Bolt", ["a"], "slots_5")), 3, "four steps: 2d6 more");
  }

  // ── Flame Blade grows by the slot it was cast with ──
  {
    const at = (payWith?: string) => {
      const lit = use(fight(), "Flame", ["mage"], payWith);
      const held = rulesetCombatant(lit.state, "mage")!.tracked.find((one) => one.condition === "flaming");
      assert.ok(held, "the blade is called up");
      return lit.state;
    };
    assert.equal(dice(use(at(), "Strike", ["a"])), 3, "2nd level: 3d6");
    assert.equal(dice(use(at("slots_3"), "Strike", ["a"])), 3, "3rd level: still 3d6");
    assert.equal(dice(use(at("slots_4"), "Strike", ["a"])), 4, "4th level: 4d6");
    assert.equal(dice(use(at("slots_4"), "Plain", ["a"])), 3, "every step, without perCostStepsEvery");
    assert.equal(rulesetCombatant(at("slots_4"), "mage")!.tracked.find((one) => one.condition === "flaming")!.steps, 2);
  }

  // ── Refusals ──
  refusedDoc(
    fiveE((doc) => {
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "spells")
        .entries.push(spell("odd", 1, { kind: "attack", range: 5, amount: { dice: "1d6" }, perCostStepsEvery: 2 }));
    }),
    /perCostStepsEvery/,
  );

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
      "A ruleset with what a higher cost adds only every so many steps requires schemaVersion 2 and capabilityApi 1.300 or newer";
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [bolt] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(299) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(300) as never, doc), gate);
  }

  console.log(
    "Steps every: a bolt's 1d6 more every two slot levels, Flame Blade's strike grown by the slot it was cast with; refusals; gated at 1.300.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
