/**
 * Conditions that end with another one put on with them (Capability API 1.202).
 *
 *   - An applied condition's `endsWith` names another of the same list: 5e's Hypnotic Pattern,
 *     whose incapacitation ends whenever its charm does, by a cure, a save, or the fight ending.
 *   - Only the one put on by the same use goes with it.
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
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-linked-conditions-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 197);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // Hypnotic Pattern: charmed, shaken off on a save when hurt, and incapacitated for as long.
  const pattern = spell("pattern", "Pattern", {
    kind: "debuff",
    targets: "enemy",
    targetCount: 2,
    save: { save: "wis_save", onSuccess: "negates" },
    concentration: true,
    applies: [
      { condition: "charmed", duration: { rounds: 10 }, saveEnds: { save: "wis_save", at: "damaged" } },
      { condition: "incapacitated", duration: "instant", endsWith: "charmed" },
    ],
  });
  const calm = spell("calm", "Calm", { kind: "utility", targets: "any", ends: { conditions: ["charmed"] } });
  const bolt = spell("bolt", "Bolt", {
    kind: "attack",
    targets: "enemy",
    autoHit: true,
    amount: { flat: 1 },
    damageType: "force",
  });
  const spells = [pattern, calm, bolt];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock => ({ health: 40, defense: 5, initiativeModifier: 0, speed: 30, actions: [] });
  let d20 = 2;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
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
        { id: "a", name: "A", side: "enemy", block: block() },
        { id: "b", name: "B", side: "enemy", block: block() },
        {
          id: "c",
          name: "C",
          side: "enemy",
          block: {
            ...block(),
            actions: [
              { id: "bite", name: "Bite", budget: "action", toHit: 30, damage: { count: 1, sides: 6, flat: 5 } },
            ],
          } as RulesetStatBlock,
        },
      ],
    });
    state.order = ["mage", "a", "b", "c"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds: string[]) => {
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId: "mage", optionId: option.id, targetIds }, roll);
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).sort();
  const offs = (events: RulesetCombatEvent[], id: string) =>
    events.flatMap((one) =>
      one.type === "condition" && !one.active && one.targetId === id ? [[one.condition, one.reason]] : [],
    );
  const patterned = () => {
    d20 = 2;
    const step = cast(fight(), "Pattern", ["a", "b"]);
    assert.deepEqual(holds(step.state, "a"), ["charmed", "incapacitated"]);
    assert.deepEqual(holds(step.state, "b"), ["charmed", "incapacitated"]);
    assert.equal(
      rulesetCombatant(step.state, "a")!.tracked.find((one) => one.condition === "incapacitated")!.endsWith,
      "charmed",
    );
    return step.state;
  };

  // ── Cured of the charm, the incapacitation goes with it ──
  {
    const cured = cast(patterned(), "Calm", ["a"]);
    assert.deepEqual(holds(cured.state, "a"), []);
    assert.deepEqual(offs(cured.events, "a"), [
      ["charmed", "cured"],
      ["incapacitated", "linked"],
    ]);
    // The other is still under it.
    assert.deepEqual(holds(cured.state, "b"), ["charmed", "incapacitated"]);
  }

  // ── Shaken off on a save when hurt, the same ──
  {
    const held = patterned();
    d20 = 20;
    const hurt = cast(held, "Bolt", ["a"]);
    assert.deepEqual(holds(hurt.state, "a"), []);
    assert.deepEqual(offs(hurt.events, "a"), [
      ["charmed", "save"],
      ["incapacitated", "linked"],
    ]);
  }

  // ── The caster's concentration broken: both go, each said once ──
  {
    const state = patterned();
    state.turn = 3;
    const bite = rulesetCombatOptions(definition, state, "c").find((one) => one.label === "Bite");
    assert.ok(bite, "no Bite");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "c", optionId: bite.id, targetIds: ["mage"] },
      roll,
    );
    assert.deepEqual(offs(step.events, "a"), [
      ["charmed", "concentration"],
      ["incapacitated", "linked"],
    ]);
    assert.deepEqual(holds(step.state, "b"), []);
  }

  // ── The incapacitation alone ending leaves the charm ──
  {
    const state = patterned();
    const a = rulesetCombatant(state, "a")!;
    a.tracked = a.tracked.filter((one) => one.condition !== "incapacitated");
    const cured = cast(state, "Calm", ["a"]);
    assert.deepEqual(offs(cured.events, "a"), [["charmed", "cured"]]);
  }

  // ── Only what the same use put on goes with it ──
  {
    const state = patterned();
    const a = rulesetCombatant(state, "a")!;
    const other = a.tracked.find((one) => one.condition === "incapacitated")!;
    other.source = "b";
    const cured = cast(state, "Calm", ["a"]);
    assert.deepEqual(holds(cured.state, "a"), ["incapacitated"]);
  }

  // ── The fight ending takes it off, clock or none, and says so once ──
  {
    const state = patterned();
    const events = liftRulesetFightEffects(definition, state);
    assert.deepEqual(holds(state, "a"), []);
    assert.deepEqual(offs(events, "a"), [
      ["charmed", "expired"],
      ["incapacitated", "linked"],
    ]); // One with a clock of its own goes once, with the charm.
    const timed = patterned();
    rulesetCombatant(timed, "a")!.tracked.find((one) => one.condition === "incapacitated")!.rounds = 10;
    assert.deepEqual(offs(liftRulesetFightEffects(definition, timed), "a"), [
      ["charmed", "expired"],
      ["incapacitated", "linked"],
    ]);
  }

  // ── Import refusals ──
  {
    const refused = (applies: unknown[], pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.at(-1).entries.push({ ...spell("x", "X", { ...pattern_, applies }) });
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const pattern_ = { kind: "debuff", targets: "enemy", save: { save: "wis_save", onSuccess: "negates" } };
    refused(
      [{ condition: "charmed", duration: "instant", endsWith: "charmed" }],
      /A condition ends with another one, not with itself/,
    );
    refused(
      [
        { condition: "charmed", duration: "instant" },
        { condition: "incapacitated", duration: "instant", endsWith: "frightened" },
      ],
      /"endsWith" names a condition put on in the same list, and "frightened" is not one/,
    );
    // In a condition's onEnd list too.
    const onEnd = parseRulesetDefinition(
      fiveE((doc) => {
        const rule = doc.combat.conditions[0];
        rule.onEnd = {
          applies: [{ condition: "incapacitated", duration: { rounds: 1 }, endsWith: "stunned" }],
        };
      }),
    );
    assert.equal(onEnd.ok, false);
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
      "A ruleset with conditions that end with another condition put on with them requires schemaVersion 2 and capabilityApi 1.202 or newer";
    const withPattern = fiveE();
    assert.equal(getCapabilityPackageInstallIssue(manifest(201) as never, withPattern), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(202) as never, withPattern), gate);
    const without = JSON.parse(fiveEText);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(201) as never, without), gate);
    const files = new Map([["spells.json", { entries: [pattern] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(201) as never, without, files as never), gate);
  }

  console.log(
    "Ruleset linked conditions: Hypnotic Pattern's incapacitation ends with its charm, by a cure, a save or the fight ending, only for the same use; gated at 1.202.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
