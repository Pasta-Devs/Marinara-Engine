/**
 * Lowered maximums with no save of their own, a floor, and whom a blow may target (Capability API 1.235).
 *
 *   - A vampire's Bite: only on a creature it grapples or one incapacitated or restrained
 *     (`targetHolds`); its necrotic part lowers the maximum with no save (`reducesMax.damageType`),
 *     and the vampire regains as much (`heals`).
 *   - A succubus's Draining Kiss: the maximum is lowered by what it takes, whatever the save.
 *   - Harm: the maximum lowered only on the spell's own failed save (`onFailedSave`), and never
 *     taken below 1 hit point (`leavesAtLeast`).
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
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-drains-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 230);
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
  // 14d6 necrotic, Con save for half; a failed save lowers the maximum too, never below 1.
  const harm = spell("harm", "Harm", {
    kind: "attack",
    targets: "enemy",
    amount: { dice: "14d6" },
    damageType: "necrotic",
    save: { save: "con_save", onSuccess: "half" },
    reducesMax: { onFailedSave: true },
    leavesAtLeast: 1,
  });
  const hold = spell("hold", "Hold", {
    kind: "attack",
    targets: "enemy",
    autoHit: true,
    amount: { flat: 1 },
    damageType: "force",
    targetHolds: { conditions: ["restrained"] },
  });
  const spells = [harm, hold];
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
  const bite = {
    id: "bite",
    name: "Bite",
    budget: "action",
    toHit: 30,
    targets: "any",
    // 1d6 + 4 piercing and 1d6 necrotic on a 3: 7 and 3.
    damage: {
      count: 1,
      sides: 6,
      flat: 4,
      type: "piercing",
      plus: [{ count: 1, sides: 6, flat: 0, type: "necrotic" }],
    },
    reducesMax: { damageType: "necrotic", heals: true },
    targetHolds: { conditions: ["incapacitated", "restrained"], fromSelf: ["grappled"] },
  };
  const kiss = {
    id: "kiss",
    name: "Kiss",
    budget: "action",
    targets: "any",
    save: { save: "con_save", difficulty: 15, onSuccess: "half" },
    // 2d6 + 4 psychic on 3s: 10, 5 on a made save.
    damage: { count: 2, sides: 6, flat: 4, type: "psychic" },
    reducesMax: {},
  };
  const vampire = {
    health: 100,
    defense: 13,
    initiativeModifier: 0,
    speed: 30,
    actions: [bite, kiss],
  } as unknown as RulesetStatBlock;
  let d20 = 2;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 40 },
  });
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
        { id: "brenna", name: "Brenna", side: "party", build, live: {}, catalogs: {} } as RulesetCombatantInput,
        { id: "v", name: "Vampire", side: "enemy", block: structuredClone(vampire) },
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: { health: 40, defense: 5, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
    });
    state.order = ["v", "mage", "brenna", "a"];
    state.turn = 0;
    rulesetCombatant(state, "v")!.health!.value = 50;
    return state;
  };
  const hold_ = (state: RulesetEncounterState, id: string, condition: string, source = "a") =>
    rulesetCombatant(state, id)!.tracked.push({ condition, source, rounds: null });
  const option = (state: RulesetEncounterState, actorId: string, label: string) => {
    const found = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(found, `no ${label}`);
    return found;
  };
  const use = (state: RulesetEncounterState, actorId: string, label: string, target: string) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option(state, actorId, label).id, targetIds: [target] },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const hp = (state: RulesetEncounterState) => {
    const brenna = rulesetCombatant(state, "brenna")!;
    const pool = readRulesetLive(definition, build, brenna.sheet!.live).pools.find((one) => one.key === "hp")!;
    return [pool.value, pool.sealed];
  };

  // ── Bite: only on somebody it grapples, or incapacitated or restrained ──
  {
    const targets = (state: RulesetEncounterState) =>
      rulesetOptionTargets(definition, state, "v", option(state, "v", "Bite"));
    const free = fight();
    assert.deepEqual(targets(free), []);
    const step = applyRulesetCombatChoice(
      definition,
      free,
      { actorId: "v", optionId: option(free, "v", "Bite").id, targetIds: ["brenna"] },
      roll,
    );
    assert.ok(step.events.some((one) => one.type === "refused"));
    // Grappled by somebody else is not enough.
    const other = fight();
    hold_(other, "brenna", "grappled");
    assert.deepEqual(targets(other), []);
    const grappled = fight();
    hold_(grappled, "brenna", "grappled", "v");
    assert.deepEqual(targets(grappled), ["brenna"]);
    const restrained = fight();
    hold_(restrained, "mage", "restrained");
    assert.deepEqual(targets(restrained), ["mage"]);
  }

  // ── Bite: the necrotic part lowers the maximum with no save, and the vampire regains it ──
  {
    d20 = 2;
    const state = fight();
    hold_(state, "brenna", "grappled", "v");
    const step = use(state, "v", "Bite", "brenna");
    assert.ok(!step.events.some((one) => one.type === "save"), "no save");
    assert.deepEqual(hp(step.state), [30, 3]);
    assert.equal(rulesetCombatant(step.state, "v")!.health!.value, 53);
  }

  // ── Draining Kiss: lowered by what it takes, whatever the save ──
  {
    d20 = 2;
    assert.deepEqual(hp(use(fight(), "v", "Kiss", "brenna").state), [30, 10]);
    d20 = 19;
    const made = use(fight(), "v", "Kiss", "brenna");
    assert.ok(made.events.some((one) => one.type === "save" && one.success));
    assert.deepEqual(hp(made.state), [35, 5]);
    // No heal of its own.
    assert.equal(rulesetCombatant(made.state, "v")!.health!.value, 50);
  }

  // ── Harm: lowered only on a failed save, and never below 1 ──
  {
    const cast = () => {
      const state = fight();
      state.turn = 1;
      return rulesetCombatant(use(state, "mage", "Harm", "a").state, "a")!.health!;
    };
    d20 = 2;
    const failed = cast();
    assert.deepEqual([failed.value, failed.sealed], [1, 39]);
    // Made: half of 42, nothing lowered.
    d20 = 19;
    const made = cast();
    assert.deepEqual([made.value, made.sealed ?? 0], [19, 0]);
  }

  // ── A catalog entry's targetHolds ──
  {
    const state = fight();
    state.turn = 1;
    const targets = () => rulesetOptionTargets(definition, state, "mage", option(state, "mage", "Hold"));
    assert.deepEqual(targets(), []);
    hold_(state, "a", "restrained", "brenna");
    assert.deepEqual(targets(), ["a"]);
  }

  // ── A catalog creature carries it onto its block ──
  {
    const doc = fiveE((one) => {
      const creature = one.catalogs
        .find((catalog: { id: string }) => catalog.id === "creatures")
        .entries.find((entry: { creature?: unknown }) => entry.creature).creature;
      creature.actions[0].reducesMax = { damageType: "necrotic", heals: true };
      creature.actions[0].targetHolds = { fromSelf: ["grappled"] };
    });
    const read = parsed(doc);
    const creature = read
      .catalogs!.find((catalog) => catalog.id === "creatures")!
      .entries.find((entry) => entry.creature)!.creature!;
    const block = rulesetStatBlockFromCreature(read, creature)!;
    assert.deepEqual(block.actions[0]!.reducesMax, { damageType: "necrotic", heals: true });
    assert.deepEqual(block.actions[0]!.targetHolds, { fromSelf: ["grappled"] });
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const action = (doc: Record<string, any>) =>
      doc.catalogs
        .find((one: { id: string }) => one.id === "creatures")
        .entries.find((one: { creature?: unknown }) => one.creature).creature.actions[0];
    const entry = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].mechanics;
    refused((doc) => (action(doc).reducesMax = { save: "con_save" }), /comes with the "difficulty"/);
    refused(
      (doc) => (action(doc).reducesMax = { save: "con_save", difficulty: 12, onFailedSave: true }),
      /its own "save" or follows the entry's, not both/,
    );
    refused((doc) => (action(doc).reducesMax = { onFailedSave: true }), /onFailedSave/);
    refused((doc) => (action(doc).reducesMax = { damageType: "sorrow" }), /sorrow/);
    refused((doc) => (action(doc).targetHolds = { conditions: ["dazzled"] }), /dazzled/);
    refused((doc) => (action(doc).targetHolds = {}), /"targetHolds" names "conditions", "fromSelf" or both/);
    refused(
      (doc) => (entry(doc).reducesMax = { save: "con_save", difficulty: 12 }),
      /An entry's lowered maximum has no save of its own/,
    );
    refused((doc) => delete entry(doc).save, /"onFailedSave" follows the entry's own save, so it has one/);
    refused((doc) => delete entry(doc).amount, /It works on the entry's damage, so it has an amount/);
    refused((doc) => (entry(doc).leavesAtLeast = 0), /leavesAtLeast/);
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
      "A ruleset with lowered health maximums that need no save of their own, damage that leaves some health, or actions whose targets must hold a condition, requires schemaVersion 2 and capabilityApi 1.235 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const one of [
      { reducesMax: {} },
      { reducesMax: { save: "con_save", difficulty: 12, heals: true } },
      { reducesMax: { save: "con_save", difficulty: 12, onFailedSave: true } },
      { reducesMax: { save: "con_save", difficulty: 12, damageType: "necrotic" } },
      { leavesAtLeast: 1 },
      { targetHolds: { conditions: ["restrained"] } },
    ]) {
      const document = { ...without, extra: { creature: { actions: [one] } } };
      assert.equal(issue(234, document), gate, JSON.stringify(one));
      assert.notEqual(issue(235, document), gate);
    }
    // 1.203's own save, and a contest's targetHolds word, are not this.
    assert.notEqual(
      issue(234, {
        ...without,
        extra: { creature: { actions: [{ reducesMax: { save: "con_save", difficulty: 12 } }] } },
      }),
      gate,
    );
    assert.notEqual(issue(234, { ...without, extra: { contest: { targetHolds: "grappled" } } }), gate);
    assert.notEqual(issue(234, without), gate);
    assert.equal(issue(234, without, new Map([["spells.json", { entries: [harm] }]])), gate);
  }

  console.log(
    "Ruleset drains: a vampire's Bite lowers the maximum and heals on whom it grapples, Draining Kiss whatever the save, Harm on a failed save leaving 1; gated at 1.235.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
