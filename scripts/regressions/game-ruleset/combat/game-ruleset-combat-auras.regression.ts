/**
 * Auras (Capability API 1.263).
 *
 *   - A combat condition's `auras`: 5e's Aura of Protection spreads a save bonus to allies within
 *     10 feet, the paladin included, picked by the paladin's Charisma (`when`); it follows them as
 *     they move apart, and stops while the paladin is down or cannot act. A Holy Nimbus harms foes
 *     nearby as their turn starts. Without a board it reaches its whole side.
 *   - `keepsOn` on a catalog entry's mechanics and on a stat block: held for the whole fight, never
 *     written to a sheet, gone when the fight ends. The threat scale drops it from a block nobody
 *     wrote; a catalog creature carries it.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_MOVE_OPTION,
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  rulesetSyncAuras,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-auras-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 258);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const protection = {
    id: "protection",
    label: "Aura of Protection",
    rows: [{ list: "features", values: { name: "Aura of Protection" } }],
    mechanics: { kind: "utility", keepsOn: ["aura_holder"] },
  } as unknown as RulesetCatalogEntry;
  const conditionsOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "auras", label: "Auras", feeds: ["features"], entries: [structuredClone(protection)] });
    for (const [id, label] of [
      ["aura_holder", "Aura of Protection"],
      ["warded_1", "Warded +1"],
      ["warded_3", "Warded +3"],
      ["nimbus", "Holy Nimbus"],
      ["scorched", "Scorched"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    const ward = (condition: string, when: Record<string, number>) => ({
      distance: 10,
      side: "allies",
      self: true,
      conditions: [condition],
      when: { value: { abilityMod: "cha" }, ...when },
    });
    doc.combat.conditions.push(
      {
        condition: "aura_holder",
        effects: [],
        auras: [ward("warded_1", { atMost: 1 }), ward("warded_3", { atLeast: 3 })],
      },
      { condition: "warded_1", modifiers: [{ to: "saves", flat: 1 }] },
      { condition: "warded_3", modifiers: [{ to: "saves", flat: 3 }] },
      { condition: "nimbus", effects: [], auras: [{ distance: 30, side: "enemies", conditions: ["scorched"] }] },
      { condition: "scorched", effects: [], harms: { at: "turn-start", flat: 10, type: "radiant" } },
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const entries = definition.catalogs!.find((entry) => entry.id === "auras")!.entries!;
  const paladin = (cha: number, held = true) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha },
      fields: { level: 6, ac: 18, speed: 30, hp_max: 50 },
      lists: held
        ? { features: entries.flatMap((entry) => rowsFromCatalogEntry("auras", entry).map((row) => row.row)) }
        : {},
    });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 60,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { con_save: 0 },
    actions: [],
    ...extra,
  });
  const line = (width: number) => ({
    width,
    height: 1,
    tiles: [Array(width).fill("plains")],
    elevation: [Array(width).fill(0)],
  });
  const fight = (
    options: {
      cha?: number;
      held?: boolean;
      foe?: Partial<RulesetStatBlock>;
      at?: { paladin: number; ally: number; foe: number } | null;
    } = {},
  ): RulesetEncounterState => {
    const at = options.at === undefined ? { paladin: 0, ally: 2, foe: 11 } : options.at;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "paladin",
          name: "Paladin",
          side: "party",
          build: paladin(options.cha ?? 16, options.held ?? true),
          live: {},
          catalogs: { auras: entries },
        },
        { id: "ally", name: "Ally", side: "party", build: paladin(10, false), live: {}, catalogs: { auras: entries } },
        { id: "foe", name: "Foe", side: "enemy", block: block(options.foe) },
      ],
      ...(at
        ? {
            board: {
              grid: line(14),
              placements: { paladin: { x: at.paladin, y: 0 }, ally: { x: at.ally, y: 0 }, foe: { x: at.foe, y: 0 } },
            },
          }
        : {}),
    });
    state.order = ["paladin", "ally", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const step = applyRulesetCombatChoice(definition, state, choice, () => 10);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const pass = (state: RulesetEncounterState, id: string) =>
    act(state, { actorId: id, optionId: "end-turn", targetIds: [] });

  // ── Aura of Protection: kept on, spread to allies within 10 feet, the paladin too ──
  {
    const state = fight();
    const kept = who(state, "paladin").tracked.find((entry) => entry.condition === "aura_holder");
    assert.deepEqual(kept, { condition: "aura_holder", rounds: null, kept: true });
    assert.ok(has(state, "paladin", "warded_3"), "the paladin is in their own aura");
    assert.ok(has(state, "ally", "warded_3"), "an ally 10 feet off is in it");
    assert.equal(has(state, "ally", "warded_1"), false, "Charisma +3 picks the +3 aura only");
    assert.equal(has(state, "foe", "warded_3"), false, "never an enemy");
    assert.equal(who(state, "ally").tracked.find((entry) => entry.condition === "warded_3")!.aura, "paladin");
    // Never written to a sheet.
    const live = who(state, "paladin").sheet!.live as { conditions?: string[] };
    assert.equal(
      (live.conditions ?? []).some((one) => ["aura_holder", "warded_3"].includes(one)),
      false,
    );
    // A lower Charisma opens the other one.
    assert.ok(has(fight({ cha: 10 }), "ally", "warded_1"));
    assert.equal(has(fight({ cha: 10 }), "ally", "warded_3"), false);
    // Without the feature, nothing.
    const plain = fight({ held: false });
    assert.equal(has(plain, "paladin", "aura_holder"), false);
    assert.equal(has(plain, "ally", "warded_3"), false);
    // Too far from the start, it does not reach.
    assert.equal(has(fight({ at: { paladin: 0, ally: 3, foe: 11 } }), "ally", "warded_3"), false);
    // No board: it reaches the whole side.
    const anywhere = fight({ at: null });
    assert.ok(has(anywhere, "ally", "warded_3"));
    assert.equal(has(anywhere, "foe", "warded_3"), false);
  }

  // ── It follows them as they move apart and back ──
  {
    let state = pass(fight(), "paladin").state;
    const away = act(state, { actorId: "ally", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 0 } });
    assert.equal(has(away.state, "ally", "warded_3"), false, "out of reach");
    assert.ok(has(away.state, "paladin", "warded_3"), "the paladin keeps their own");
    assert.deepEqual(
      of(away.events, "condition").map((one) => [one.targetId, one.condition, one.active, one.reason]),
      [["ally", "warded_3", false, "parted"]],
    );
    const back = act(away.state, { actorId: "ally", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 2, y: 0 } });
    assert.ok(has(back.state, "ally", "warded_3"));
    assert.deepEqual(
      of(back.events, "condition").map((one) => [one.targetId, one.condition, one.active, one.reason]),
      [["ally", "warded_3", true, "aura"]],
    );
    state = back.state;
    // A cure that takes it off finds it back as the step ends: only parting ends it.
    who(state, "ally").tracked = who(state, "ally").tracked.filter((entry) => entry.condition !== "warded_3");
    assert.ok(has(pass(state, "ally").state, "ally", "warded_3"));
  }

  // ── Down or unable to act, the paladin spreads nothing ──
  {
    for (const fell of [
      (state: RulesetEncounterState) => who(state, "paladin").tracked.push({ condition: "unconscious", rounds: null }),
      (state: RulesetEncounterState) =>
        who(state, "paladin").tracked.push({ condition: "incapacitated", rounds: null }),
      (state: RulesetEncounterState) => void (who(state, "paladin").down = true),
    ]) {
      const state = fight();
      fell(state);
      const step = pass(state, "paladin");
      assert.equal(has(step.state, "ally", "warded_3"), false);
      assert.equal(has(step.state, "paladin", "warded_3"), false);
      assert.ok(has(step.state, "paladin", "aura_holder"), "the feature itself stays");
    }
  }

  // ── Holy Nimbus harms foes near the paladin as their turn starts ──
  {
    const state = fight({ at: { paladin: 0, ally: 2, foe: 6 } });
    who(state, "paladin").tracked.push({ condition: "nimbus", rounds: null });
    rulesetSyncAuras(definition, state);
    assert.ok(has(state, "foe", "scorched"), "30 feet off");
    assert.equal(has(state, "ally", "scorched"), false);
    assert.equal(has(state, "paladin", "scorched"), false, "no self without self");
    state.turn = 1;
    const step = pass(state, "ally");
    const hurt = of(step.events, "damage").filter((one) => one.targetId === "foe");
    assert.equal(hurt.length, 1, JSON.stringify(step.events));
    assert.equal(hurt[0]!.amount, 10);
    assert.equal(who(step.state, "foe").health!.value, 50);
  }

  // ── A stat block's keepsOn: a foe whose own nimbus scorches whoever is near it ──
  {
    const state = fight({ foe: { keepsOn: ["nimbus"] }, at: { paladin: 0, ally: 5, foe: 11 } });
    assert.ok(has(state, "foe", "nimbus"));
    assert.ok(has(state, "ally", "scorched"), "within 30 feet of the foe");
    assert.equal(has(state, "paladin", "scorched"), false, "beyond it");
    // Immune to what it keeps on, it is not kept.
    assert.equal(has(fight({ foe: { keepsOn: ["nimbus"], conditionImmunities: ["nimbus"] } }), "foe", "nimbus"), false);
  }

  // ── The fight's end takes them all away, quietly ──
  {
    const state = fight();
    const events = liftRulesetFightEffects(definition, state);
    assert.deepEqual(of(events, "condition"), []);
    for (const id of ["paladin", "ally"]) {
      assert.equal(
        who(state, id).tracked.some((entry) => entry.aura || entry.kept),
        false,
      );
    }
  }

  // ── Creatures: a written one carries keepsOn, the threat scale drops it ──
  {
    const written = parsed(
      document((doc) => {
        const creature = doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0];
        creature.creature.keepsOn = ["nimbus"];
      }),
    );
    const creature = written.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
    assert.deepEqual(rulesetStatBlockFromCreature(written, creature)!.keepsOn, ["nimbus"]);
    const clamped = clampRulesetStatBlock(definition, { ...block(), keepsOn: ["nimbus"] } as never, "cr_1");
    assert.equal((clamped.block as { keepsOn?: unknown }).keepsOn, undefined);
    assert.ok(clamped.adjusted.some((note) => /kept on through the fight were dropped/.test(note)));
  }

  // ── Import ──
  {
    refused(
      document((doc) => (conditionsOf(doc, "nimbus").auras[0].conditions = ["nope"])),
      /Unknown condition "nope"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "nimbus").auras[0].conditions = ["nimbus"])),
      /A condition does not spread itself/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "nimbus").auras[0].conditions = ["aura_holder"])),
      /What an aura spreads has no aura of its own/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "nimbus").auras[0].self = true)),
      /Its holder is no enemy of their own/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "aura_holder").auras[0].when.value = { abilityMod: "luck" })),
      /luck/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "aura_holder").auras[0].when = { value: { abilityMod: "cha" } })),
      /"when" says at least one of "atLeast" and "atMost"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "nimbus").auras[0].distance = 0)),
      /distance/,
    );
    refused(
      document((doc) => (doc.catalogs.at(-1).entries[0].mechanics.keepsOn = ["nope"])),
      /Unknown condition "nope"/,
    );
    refused(
      document((doc) => {
        doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.keepsOn = ["nope"];
      }),
      /Unknown condition "nope"/,
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
      "A ruleset with auras on a condition, or conditions kept on through a fight, requires schemaVersion 2 and capabilityApi 1.263 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const aura = document();
    assert.equal(issue(262, aura), gate);
    assert.notEqual(issue(263, aura), gate);
    // Auras alone, nothing kept on.
    const spreading = document((doc) => delete doc.catalogs.at(-1).entries[0].mechanics.keepsOn);
    assert.equal(issue(262, spreading), gate);
    const kept = { ...without, extra: { protection: { mechanics: { keepsOn: ["aura_holder"] } } } };
    assert.equal(issue(262, kept), gate);
    assert.notEqual(issue(263, kept), gate);
    assert.notEqual(issue(262, without), gate);
    assert.equal(issue(262, without, new Map([["auras.json", { entries: [protection] }]])), gate);
  }

  console.log(
    "Ruleset auras: Aura of Protection kept on and spread to allies within 10 feet by Charisma, following moves, stopped while the paladin is down; Holy Nimbus harms foes at turn start; block keepsOn; gone at fight end; gated at 1.263.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
