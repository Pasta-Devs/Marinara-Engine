/**
 * More from auras (Capability API 1.265).
 *
 *   - `needs`: Countercharm reaches only allies who can hear: not a deafened one, and not across
 *     Silence, whichever of the two stands in it.
 *   - `harms`: a balor's Fire Aura burns everybody within 5 feet as the balor's own turn starts.
 *   - `save`: a pit fiend's Fear Aura asks a save as a creature starts its turn within 20 feet,
 *     frightening on a failure and, made once, never again this fight; a basilisk's gaze asks only
 *     while the two can see each other.
 *   - `against.casts`: Holy Nimbus's advantage only against spells, and only from fiends.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSaveAgainstMatches,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-aura-turns-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 260);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const silence = {
    id: "silence",
    label: "Silence",
    rows: [{ list: "spells", values: { name: "Silence", level: 2, prepared: true } }],
    mechanics: {
      kind: "utility",
      area: { shape: "burst", size: 10 },
      range: 120,
      zone: { rounds: 10, triggers: [], inside: { conditions: ["deafened"] } },
    },
  } as unknown as RulesetCatalogEntry;
  const conditionsOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(silence)] });
    // Blinded takes the eyes away, so a blinded creature sees nobody (a gaze's "see each other").
    doc.combat.sight = { eyes: "sight" };
    for (const entry of doc.combat.conditions) if (entry.condition === "blinded") entry.lacks = ["sight"];
    for (const [id, label] of [
      ["countercharm", "Countercharm"],
      ["steady", "Steadied"],
      ["fire_aura", "Fire Aura"],
      ["fear_aura", "Fear Aura"],
      ["gaze", "Petrifying Gaze"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      { condition: "deafened", effects: [], lacks: ["hearing"] },
      { condition: "steady", modifiers: [{ to: "saves", flat: 1 }] },
      {
        condition: "countercharm",
        effects: [],
        auras: [{ distance: 30, side: "allies", conditions: ["steady"], needs: ["hearing"] }],
      },
      {
        condition: "fire_aura",
        effects: [],
        auras: [{ distance: 5, side: "all", harms: { dice: "3d6", type: "fire" } }],
      },
      {
        condition: "fear_aura",
        effects: [],
        auras: [
          {
            distance: 20,
            side: "enemies",
            save: {
              save: "wis_save",
              difficulty: 15,
              applies: [{ condition: "frightened", duration: { rounds: 1, at: "turn-start" } }],
              immuneOnSuccess: true,
            },
          },
        ],
      },
      {
        condition: "gaze",
        effects: [],
        auras: [
          {
            distance: 30,
            side: "enemies",
            save: {
              save: "con_save",
              difficulty: 12,
              applies: [{ condition: "restrained", duration: "instant" }],
              seen: true,
            },
          },
        ],
      },
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
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    fields: { level: 6, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "cha", slots_max_2: 3 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: 0, con_save: 0 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  let d20 = 10;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  type Spot = { x: number; y: number };
  const fight = (
    foe: Partial<RulesetStatBlock>,
    at: { bard: Spot; ally: Spot; foe: Spot },
    width = 20,
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "bard", name: "Bard", side: "party", build, live: {}, catalogs: { spells } },
        { id: "ally", name: "Ally", side: "party", build, live: {}, catalogs: { spells } },
        { id: "foe", name: "Foe", side: "enemy", block: block(foe) },
      ],
      board: {
        grid: { width, height: 15, tiles: Array.from({ length: 15 }, () => Array(width).fill("plains")) },
        placements: at,
      },
    });
    state.order = ["bard", "ally", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const pass = (state: RulesetEncounterState, id: string) =>
    act(state, { actorId: id, optionId: "end-turn", targetIds: [] });

  // ── Countercharm: only allies who can hear ──
  {
    const place = { bard: { x: 2, y: 7 }, ally: { x: 6, y: 7 }, foe: { x: 18, y: 7 } };
    const state = fight({}, place);
    who(state, "bard").tracked.push({ condition: "countercharm", rounds: null, kept: true });
    const heard = pass(state, "bard");
    assert.ok(has(heard.state, "ally", "steady"));
    // A deafened ally hears nothing.
    const deaf = fight({}, place);
    who(deaf, "bard").tracked.push({ condition: "countercharm", rounds: null, kept: true });
    who(deaf, "ally").tracked.push({ condition: "deafened", rounds: 10 });
    assert.equal(has(pass(deaf, "bard").state, "ally", "steady"), false);
    // Silence around the ally stops it, and Silence around the bard does too.
    for (const center of [place.ally, place.bard]) {
      const quiet = fight({}, place);
      who(quiet, "bard").tracked.push({ condition: "countercharm", rounds: null, kept: true });
      const option = rulesetCombatOptions(definition, quiet, "bard").find((one) => one.label === "Silence");
      assert.ok(option, "Silence is offered");
      const cast = act(quiet, { actorId: "bard", optionId: option.id, targetIds: [], at: center });
      assert.equal(has(cast.state, "ally", "steady"), false, `Silence at ${center.x}`);
    }
  }

  // ── Fire Aura: the holder's own turn start burns everybody within 5 feet ──
  {
    const state = fight({}, { bard: { x: 5, y: 7 }, ally: { x: 9, y: 7 }, foe: { x: 6, y: 7 } });
    who(state, "foe").tracked.push({ condition: "fire_aura", rounds: null, kept: true });
    // The bard's turn starts nothing; the foe's does.
    let step = pass(state, "bard");
    assert.deepEqual(of(step.events, "damage"), []);
    step = pass(step.state, "ally");
    const burns = of(step.events, "damage");
    assert.deepEqual(
      burns.map((one) => [one.targetId, one.amount, one.damageType, one.sourceId]),
      [["bard", 9, "fire", "foe"]],
      JSON.stringify(step.events),
    );
  }

  // ── Fear Aura: a save as their own turn starts, and proof against it once made ──
  {
    const state = fight({}, { bard: { x: 2, y: 7 }, ally: { x: 14, y: 7 }, foe: { x: 6, y: 7 } });
    who(state, "foe").tracked.push({ condition: "fear_aura", rounds: null, kept: true });
    state.order = ["foe", "bard", "ally"];
    d20 = 5;
    const failed = pass(state, "foe");
    assert.ok(has(failed.state, "bard", "frightened"), "a failure frightens");
    assert.equal(who(failed.state, "bard").tracked.find((one) => one.condition === "frightened")!.source, "foe");
    const saves = of(failed.events, "save");
    assert.deepEqual(
      saves.map((one) => [one.actorId, one.save]),
      [["bard", "wis_save"]],
    );
    // The ally, 30 feet off, is asked nothing as their turn starts.
    assert.deepEqual(of(pass(failed.state, "bard").events, "save"), []);
    // Made once, never again this fight.
    d20 = 20;
    const made = pass(state, "foe");
    assert.equal(has(made.state, "bard", "frightened"), false);
    assert.deepEqual(who(made.state, "bard").auraSafe, ["foe/fear_aura"]);
    d20 = 1;
    let again = pass(made.state, "bard");
    again = pass(again.state, "ally");
    const later = pass(again.state, "foe");
    assert.deepEqual(of(later.events, "save"), [], "never asked again");
    d20 = 10;
  }

  // ── A gaze asks only while the two can see each other ──
  {
    const state = fight({}, { bard: { x: 2, y: 7 }, ally: { x: 14, y: 7 }, foe: { x: 6, y: 7 } });
    who(state, "foe").tracked.push({ condition: "gaze", rounds: null, kept: true });
    state.order = ["foe", "bard", "ally"];
    d20 = 2;
    assert.ok(has(pass(state, "foe").state, "bard", "restrained"));
    const blind = fight({}, { bard: { x: 2, y: 7 }, ally: { x: 14, y: 7 }, foe: { x: 6, y: 7 } });
    who(blind, "foe").tracked.push({ condition: "gaze", rounds: null, kept: true });
    who(blind, "bard").tracked.push({ condition: "blinded", rounds: 10 });
    blind.order = ["foe", "bard", "ally"];
    const unseen = pass(blind, "foe");
    assert.deepEqual(of(unseen.events, "save"), []);
    assert.equal(has(unseen.state, "bard", "restrained"), false);
    d20 = 10;
  }

  // ── Holy Nimbus: only spells, and only from fiends ──
  {
    const against = { casts: ["spells"], from: { types: ["fiend"] } };
    assert.equal(rulesetSaveAgainstMatches(against, { catalog: "spells", from: { type: "fiend", tags: [] } }), true);
    assert.equal(rulesetSaveAgainstMatches(against, { catalog: "spells", from: { type: "beast", tags: [] } }), false);
    assert.equal(rulesetSaveAgainstMatches(against, { magic: true, from: { type: "fiend", tags: [] } }), false);
    assert.equal(rulesetSaveAgainstMatches({ casts: ["spells"] }, { catalog: "spells" }), true);
    assert.equal(rulesetSaveAgainstMatches({ casts: ["spells"] }, { catalog: "powers" }), false);
    // An action's catalog, or what an item's use casts from, reaches the save.
    const doc = document((edit) => {
      edit.combat.conditions.push({
        condition: "nimbus_ward",
        modifiers: [{ to: "saves", mode: "advantage", against: { casts: ["spells"] } }],
      });
      edit.sheet.live.conditions.push({ id: "nimbus_ward", label: "Holy Nimbus" });
      edit.catalogs.at(-1).entries.push({
        id: "sting",
        label: "Sting",
        rows: [{ list: "spells", values: { name: "Sting", level: 0, prepared: true } }],
        mechanics: {
          kind: "attack",
          range: 60,
          save: { save: "con_save", onSuccess: "none" },
          amount: { flat: 4 },
          damageType: "poison",
        },
      });
    });
    const warded = parsed(doc);
    const entries = warded.catalogs!.find((entry) => entry.id === "spells")!.entries!;
    const casterBuild = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      fields: { level: 6, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "cha", slots_max_2: 3 },
      lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
    const state = createRulesetEncounter({
      definition: warded,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "bard", name: "Bard", side: "party", build: casterBuild, live: {}, catalogs: { spells: entries } },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    state.order = ["bard", "foe"];
    state.turn = 0;
    const sting = (holds: boolean) => {
      const from = structuredClone(state);
      if (holds) rulesetCombatant(from, "foe")!.tracked.push({ condition: "nimbus_ward", rounds: null });
      const option = rulesetCombatOptions(warded, from, "bard").find((one) => one.label === "Sting")!;
      const step = applyRulesetCombatChoice(
        warded,
        from,
        { actorId: "bard", optionId: option.id, targetIds: ["foe"] },
        roll,
      );
      return of(step.events, "save")[0]!;
    };
    assert.equal(sting(false).rolls.length, 1);
    assert.equal(sting(true).rolls.length, 2, "rolled twice against a spell");
  }

  // ── Import ──
  {
    refused(
      document((doc) => delete conditionsOf(doc, "countercharm").auras[0].conditions),
      /An aura spreads conditions, harms, asks for a save, or feeds/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "fear_aura").auras[0].save.save = "luck_save")),
      /Unknown save "luck_save"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "fear_aura").auras[0].save.applies[0].condition = "nope")),
      /Unknown condition "nope"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "fire_aura").auras[0].harms = { type: "fire" })),
      /What it harms with names dice, a flat amount, or both/,
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
      "A ruleset with auras that need senses, harm as their holder's turn starts or ask for a save, or saves changed against what a catalog casts, requires schemaVersion 2 and capabilityApi 1.265 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    for (const key of ["needs", "harms", "save"]) {
      const one = document((doc) => {
        for (const id of ["countercharm", "fire_aura", "fear_aura", "gaze"]) {
          const aura = conditionsOf(doc, id).auras[0];
          if (!(key in aura))
            doc.combat.conditions = doc.combat.conditions.filter((entry: any) => entry !== conditionsOf(doc, id));
        }
      });
      assert.equal(issue(264, one), gate, key);
      assert.notEqual(issue(265, one), gate);
    }
    const casts = {
      ...without,
      extra: { ward: { modifiers: [{ to: "saves", flat: 1, against: { casts: ["spells"] } }] } },
    };
    assert.equal(issue(264, casts), gate);
    assert.notEqual(issue(264, without), gate);
    assert.equal(issue(264, without, new Map([["extra.json", casts.extra]])), gate);
  }

  console.log(
    "Ruleset aura turns: Countercharm only to allies who can hear (Silence either side), Fire Aura burns at the holder's turn start, Fear Aura and a gaze ask saves as turns start (proof once made, sight for a gaze), Holy Nimbus only against spells; gated at 1.265.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
