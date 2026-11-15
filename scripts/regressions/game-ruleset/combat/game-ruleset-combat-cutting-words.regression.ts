/**
 * Cutting Words and Evasion (Capability API 1.250).
 *
 *   - `lowersRoll`: taken as somebody else's attack hits an ally, its die (sized by the bard's level)
 *     comes off the roll, which is checked again: a hit can become a miss; a natural one stays.
 *   - `evasion` on a condition or a level: against a save that halves, a made one takes nothing and
 *     a failed one half.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cutting-words-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 245);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const cutting = {
    id: "cutting-words",
    label: "Cutting Words",
    rows: [
      { list: "features", values: { name: "Cutting Words" } },
      { list: "counters", values: { name: "Bardic Inspiration", max: 3, recharge: "long" } },
    ],
    mechanics: {
      kind: "debuff",
      free: true,
      usesOf: "Bardic Inspiration",
      reaction: { on: "hit", for: "ally", within: 60 },
      lowersRoll: {
        die: {
          from: { field: "level" },
          table: [
            [1, 6],
            [5, 8],
            [10, 10],
            [15, 12],
          ],
        },
      },
    },
  };
  const features = [cutting] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "evasive", label: "Evasive" });
    doc.combat.conditions.push({ condition: "evasive", effects: [], evasion: ["dex_save"] });
    // Proficiency +3 from 5th level: the level a rogue's Evasion is standing in for here.
    doc.combat.levels.push({ derived: "proficiency_bonus", at: 3, evasion: ["dex_save"] });
    doc.catalogs.push({
      id: "lore",
      label: "Lore",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  let d20s: number[] = [];
  // The d20s in order; a bard's d8 shows 5 and every other die 3.
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : sides === 8 ? 5 : 3);
  const bite = {
    id: "bite",
    name: "Bite",
    budget: "action",
    toHit: 5,
    reach: 5,
    damage: { count: 0, sides: 0, flat: 4 },
  };
  const fire = {
    id: "fire",
    name: "Fire Breath",
    targets: "any" as const,
    budget: "action",
    range: 60,
    save: { save: "dex_save", difficulty: 15, onSuccess: "half" as const },
    damage: { count: 0, sides: 0, flat: 20, type: "fire" },
  };
  const blast = { ...fire, id: "blast", name: "Mind Blast", save: { ...fire.save, save: "wis_save" } };
  const spit = { ...fire, id: "spit", name: "Spit", save: { ...fire.save, onSuccess: "none" as const } };
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [bite, fire, blast, spit],
    }) as unknown as RulesetStatBlock;
  const sheet = (level: number, lists: Record<string, unknown[]> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      fields: { level, ac: 15, speed: 30, hp_max: 60 },
      lists,
    });
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("lore", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const fight = (bardLevel = 5, allyLevel = 1): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "bard",
          name: "Bard",
          side: "party",
          build: sheet(bardLevel, { features: rows("features"), counters: rows("counters") }),
          live: {},
          catalogs: { lore: features },
        },
        { id: "ally", name: "Ally", side: "party", build: sheet(allyLevel), live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    state.order = ["foe", "bard", "ally"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const choose = (state: RulesetEncounterState, actorId: string, optionId: string, targetIds: string[] = []) => {
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const bitten = (state: RulesetEncounterState, ...rolls: number[]) => {
    d20s = rolls;
    const option = rulesetCombatOptions(definition, state, "foe").find((one) => one.label === "Bite")!;
    return choose(state, "foe", option.id, ["ally"]);
  };
  const cut = (state: RulesetEncounterState) => {
    const option = rulesetWindowOptions(definition, state, "bard").find((one) => one.label === "Cutting Words");
    assert.ok(option, `no Cutting Words: ${rulesetWindowOptions(definition, state, "bard").map((one) => one.label)}`);
    return choose(state, "bard", option.id);
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const inspiration = (state: RulesetEncounterState) => {
    const bard = who(state, "bard");
    return readRulesetLive(definition, bard.sheet!.build, bard.sheet!.live).pools.find(
      (one) => one.key === "counters:bardic inspiration",
    )?.value;
  };

  // ── Cutting Words: a d8 at 5th level off the roll, which then misses ──
  {
    // 12 + 5 is 17 against 15: held, the bard answers.
    const held = bitten(fight(), 12);
    assert.equal(held.state.window?.trigger.kind, "hit");
    assert.deepEqual(held.state.window?.waiting, ["bard"]);
    const answered = cut(held.state);
    assert.deepEqual(of(answered.events, "lowered"), [
      {
        type: "lowered",
        actorId: "bard",
        targetId: "foe",
        label: "Cutting Words",
        to: "Bite",
        rolls: [5],
        by: 5,
        total: 12,
      },
    ]);
    assert.equal(of(answered.events, "recheck")[0]?.outcome, "miss");
    assert.equal(hp(answered.state, "ally"), 60, "no damage");
    assert.equal(inspiration(answered.state), 2);
    // A d6 at 1st level: 17 less 3 is 14, still short of 15.
    const low = cut(bitten(fight(1), 12).state);
    assert.equal(of(low.events, "lowered")[0]?.by, 3);
    assert.equal(of(low.events, "recheck")[0]?.outcome, "miss");
    // Not enough: 20 less 5 still hits.
    const strong = cut(bitten(fight(), 15).state);
    assert.equal(of(strong.events, "recheck")[0]?.outcome, "hit");
    assert.equal(hp(strong.state, "ally"), 56);
    // A natural 20 hits whatever comes off it.
    const natural = cut(bitten(fight(), 20).state);
    assert.notEqual(of(natural.events, "recheck")[0]?.outcome, "miss");
    // A pass takes nothing off.
    const passed = choose(bitten(fight(), 12).state, "bard", RULESET_PASS_OPTION);
    assert.equal(of(passed.events, "lowered").length, 0);
    assert.equal(hp(passed.state, "ally"), 56);
  }

  // ── Evasion: nothing on a made Dexterity half save, half on a failed one ──
  {
    const breathe = (state: RulesetEncounterState, ...rolls: number[]) => breatheWith("Fire Breath", state, ...rolls);
    const breatheWith = (label: string, state: RulesetEncounterState, ...rolls: number[]) => {
      d20s = rolls;
      const option = rulesetCombatOptions(definition, state, "foe").find((one) => one.label === label)!;
      return choose(state, "foe", option.id, ["ally"]);
    };
    const evasive = () => {
      const state = fight();
      who(state, "ally").tracked.push({ condition: "evasive", rounds: null });
      return state;
    };
    const made = breathe(evasive(), 18);
    assert.deepEqual(of(made.events, "evaded"), [{ type: "evaded", targetId: "ally", label: "Fire Breath" }]);
    assert.equal(hp(made.state, "ally"), 60);
    const failed = breathe(evasive(), 2);
    assert.equal(hp(failed.state, "ally"), 50, "half of 20");
    // Only Dexterity saves, and only against what halves.
    assert.equal(hp(breatheWith("Mind Blast", evasive(), 18).state, "ally"), 50);
    assert.equal(hp(breatheWith("Mind Blast", evasive(), 2).state, "ally"), 40);
    assert.equal(hp(breatheWith("Spit", evasive(), 18).state, "ally"), 40);
    assert.equal(of(breatheWith("Spit", evasive(), 18).events, "evaded").length, 0);
    // Without it: half on a made save, all on a failed one.
    assert.equal(hp(breathe(fight(), 18).state, "ally"), 50);
    assert.equal(hp(breathe(fight(), 2).state, "ally"), 40);
    // A level gives it too: a 5th-level ally.
    assert.equal(hp(breathe(fight(5, 5), 18).state, "ally"), 60);
    assert.equal(hp(breathe(fight(5, 5), 2).state, "ally"), 50);
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
    const mechanics = (doc: Record<string, any>) =>
      doc.catalogs.find((one: { id: string }) => one.id === "lore").entries[0].mechanics;
    refused((doc) => (mechanics(doc).reaction = { on: "hit", by: "self" }), /"lowersRoll" is taken as somebody else's/);
    refused((doc) => (mechanics(doc).lowersRoll.dice = "1d6"), /"lowersRoll" rolls "dice" or one "die"/);
    refused(
      (doc) =>
        (doc.combat.conditions.find((one: { condition: string }) => one.condition === "evasive").evasion = [
          "luck_save",
        ]),
      /Unknown save "luck_save"/,
    );
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
      "A ruleset with answers that take dice off a roll that hit, or saves evaded, requires schemaVersion 2 and capabilityApi 1.250 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [{ evasion: ["dex_save"] }, { mechanics: { lowersRoll: { dice: "1d6" } } }]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(249, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(250, document), gate);
    }
    assert.notEqual(issue(249, without), gate);
    assert.equal(issue(249, without, new Map([["lore.json", { entries: [cutting] }]])), gate);
  }

  console.log(
    "Ruleset cutting words: Cutting Words takes a bardic die off an attack that hit an ally and checks it again, and Evasion takes nothing from a made Dexterity half save and half from a failed one; gated at 1.250.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
