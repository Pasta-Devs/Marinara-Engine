/**
 * Diseases between fights (Capability API 1.260).
 *
 *   - A combat condition's `onRest`: each rest it names lowers health's maximum while it is on its
 *     holder (5e's Mummy Rot, 3d6 a long rest), rolled where the rest is taken or its average
 *     without dice; `lasting` keeps it past the next rest. A save first (the otyugh's): only a
 *     failure lowers, and with `cures` a success ends it.
 *   - Counted saves (1.258) rolled out as the fight ends, won or fled: Contagion is shaken off or
 *     sets in by then. A save made only on damage waits, and nobody fallen rolls.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  settleRulesetFledFight,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetTrackedCondition,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-disease-progress-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 255);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const mummyRot = { rests: ["long"], lowersMax: { dice: "3d6" }, lasting: true };
  const bolt = {
    id: "bolt",
    label: "Bolt",
    rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
    mechanics: { kind: "attack", targets: "enemy", range: 30, autoHit: true, amount: { flat: 3 }, damageType: "fire" },
  } as unknown as RulesetCatalogEntry;
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(bolt)] });
    for (const [id, label] of [
      ["mummy_rot", "Mummy Rot"],
      ["fading", "Fading"],
      ["otyugh_fever", "Otyugh Fever"],
      ["dog_fever", "Dog Fever"],
      ["infected", "Infected"],
      ["blinding_sickness", "Blinding Sickness"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      { condition: "mummy_rot", effects: [], kinds: ["disease"], onRest: mummyRot },
      { condition: "fading", effects: [], onRest: { rests: ["long"], lowersMax: { flat: 4 } } },
      {
        condition: "otyugh_fever",
        effects: [],
        onRest: {
          rests: ["long"],
          lowersMax: { dice: "1d10" },
          save: { save: "con_save", difficulty: 15, cures: true },
        },
      },
      {
        condition: "dog_fever",
        effects: [],
        onRest: { rests: ["long"], lowersMax: { dice: "1d10" }, save: { save: "con_save", difficulty: 12 } },
      },
      { condition: "infected", effects: [] },
      { condition: "blinding_sickness", effects: [], kinds: ["disease"] },
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
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "int" },
    lists: { spells: rowsFromCatalogEntry("spells", bolt).map((row) => row.row) },
  });
  const pool = (live: unknown) => readRulesetLive(definition, build, live).pools.find((one) => one.key === "hp")!;
  const rest = (live: unknown, id: string, roll?: (sides: number) => number) => {
    const result = applyRulesetSheetOp(definition, build, live, { op: "rest", rest: id }, roll);
    assert.ok(result.ok, JSON.stringify(result));
    return result;
  };

  // ── Mummy Rot: each long rest takes 3d6 off the maximum, and no rest gives it back ──
  {
    const rotting = { conditions: ["mummy_rot"] };
    const first = rest(rotting, "long", () => 4);
    assert.deepEqual([pool(first.live).value, pool(first.live).sealed, pool(first.live).lasting], [18, 12, 12]);
    assert.ok(/Mummy Rot lowers .*maximum by 12/.test(first.now), first.now);
    // Still on them: the next one takes more, without dice its average (10).
    const second = rest(first.live, "long");
    assert.deepEqual([pool(second.live).value, pool(second.live).sealed, pool(second.live).lasting], [8, 22, 22]);
    // Never past the whole maximum.
    const third = rest(second.live, "long", () => 6);
    assert.deepEqual([pool(third.live).value, pool(third.live).sealed], [0, 30]);
    assert.match(third.now, /maximum by 8\b/, "what was left to lower");
    // A rest it does not name does nothing.
    assert.equal(pool(rest(rotting, "short", () => 4).live).sealed, 0);
    // Cured, the next rest lowers nothing, and what it took stays until something unseals it.
    const cured = { ...(first.live as Record<string, unknown>), conditions: [] };
    const after = rest(cured, "long", () => 4);
    assert.deepEqual([pool(after.live).value, pool(after.live).sealed], [18, 12]);
    // Nobody with it: nothing.
    assert.equal(pool(rest({}, "long", () => 4).live).sealed, 0);
  }

  // ── Without `lasting`, the next rest gives it back before taking it again ──
  {
    const first = rest({ conditions: ["fading"] }, "long");
    assert.deepEqual([pool(first.live).sealed, pool(first.live).lasting], [4, 0]);
    const second = rest(first.live, "long");
    assert.deepEqual([pool(second.live).value, pool(second.live).sealed], [26, 4], "4, not 8");
  }

  // ── A save at each rest first: failed, it lowers; made, it cures or only spares ──
  {
    const faces = (d20: number, other: number) => (sides: number) => (sides === 20 ? d20 : other);
    const failed = rest({ conditions: ["otyugh_fever"] }, "long", faces(14, 5));
    assert.deepEqual([pool(failed.live).value, pool(failed.live).sealed], [25, 5]);
    assert.match(failed.now, /Otyugh Fever: .* 14 against 15, failed/);
    assert.deepEqual((failed.live as { conditions?: string[] }).conditions, ["otyugh_fever"]);
    const made = rest(failed.live, "long", faces(15, 5));
    assert.equal(pool(made.live).sealed, 0, "nothing lowered, and the last loss given back");
    assert.match(made.now, /15 against 15, cured/);
    assert.deepEqual((made.live as { conditions?: string[] }).conditions ?? [], [], "cured");
    // Without `cures` a made save only spares that day.
    const spared = rest({ conditions: ["dog_fever"] }, "long", faces(12, 5));
    assert.equal(pool(spared.live).sealed, 0);
    assert.deepEqual((spared.live as { conditions?: string[] }).conditions, ["dog_fever"]);
    // Without dice, the average: 10 fails 12.
    assert.equal(pool(rest({ conditions: ["dog_fever"] }, "long").live).sealed, 5);
  }

  // ── Counted saves rolled out as the fight ends ──
  let d20s: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : 3);
  const infected = (at: "turn-end" | "damaged" = "turn-end"): RulesetTrackedCondition =>
    ({
      condition: "infected",
      rounds: null,
      source: "foe",
      difficulty: 13,
      saveEnds: { save: "con_save", at, successes: 3, failures: { count: 3, becomes: "blinding_sickness" } },
    }) as RulesetTrackedCondition;
  const fight = (foeHealth = 50): RulesetEncounterState => {
    const entries = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
    const state = createRulesetEncounter({
      definition,
      bestiary: { spells: entries },
      seed: 1,
      roller: roll,
      combatants: [
        { id: "corwin", name: "Corwin", side: "party", build, live: {}, catalogs: { spells: entries } },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: foeHealth,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            saves: { con_save: 0 },
            actions: [],
          },
        },
      ],
    });
    state.order = ["corwin", "foe"];
    state.turn = 0;
    return state;
  };
  const has = (state: RulesetEncounterState, condition: string, id: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  // Won with Contagion on the party's own: its saves are made as the fight ends.
  {
    const state = fight(1);
    rulesetCombatant(state, "corwin")!.tracked.push(infected());
    const option = rulesetCombatOptions(definition, state, "corwin").find((one) => one.label === "Bolt")!;
    assert.ok(option, "no Bolt");
    d20s = [];
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "corwin", optionId: option.id, targetIds: ["foe"] },
      (sides) => (sides === 20 ? (d20s.shift() ?? 2) : 3),
    );
    assert.equal(of(step.events, "outcome")[0]?.outcome, "victory", JSON.stringify(step.events));
    assert.equal(of(step.events, "save").length, 3, "three failed saves");
    assert.equal(has(step.state, "infected", "corwin"), false);
    assert.ok(has(step.state, "blinding_sickness", "corwin"), "the disease set in");
    const outcomeAt = step.events.findIndex((one) => one.type === "outcome");
    const worsened = step.events.findIndex((one) => one.type === "condition" && one.reason === "worsened");
    assert.ok(worsened >= 0 && worsened < outcomeAt, "settled before the outcome");
  }

  // Fled from with it on the foe: shaken off at the third success, the dice counted.
  {
    const state = fight();
    rulesetCombatant(state, "foe")!.tracked.push(infected());
    d20s = [18, 2, 18, 18];
    const settled = settleRulesetFledFight(definition, state, roll);
    assert.equal(has(settled.state, "infected", "foe"), false);
    assert.equal(has(settled.state, "blinding_sickness", "foe"), false);
    assert.equal(of(settled.events, "save").length, 4);
    assert.equal(settled.state.cursor, state.cursor + 4);
    assert.ok(has(state, "infected", "foe"), "a working copy");
  }

  // A save made only on damage waits for damage; nobody fallen rolls.
  {
    const state = fight();
    rulesetCombatant(state, "foe")!.tracked.push(infected("damaged"));
    d20s = [2, 2, 2];
    const waits = settleRulesetFledFight(definition, state, roll);
    assert.equal(of(waits.events, "save").length, 0);
    assert.ok(has(waits.state, "infected", "foe"), "no clock, still on");
    const fallen = fight();
    const foe = rulesetCombatant(fallen, "foe")!;
    foe.tracked.push(infected());
    foe.defeated = true;
    d20s = [2, 2, 2];
    assert.equal(of(settleRulesetFledFight(definition, fallen, roll).events, "save").length, 0);
  }

  // ── Import ──
  {
    const condition = (doc: Record<string, any>) =>
      doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "mummy_rot");
    refused(
      document((doc) => (condition(doc).onRest.rests = ["nap"])),
      /Unknown rest "nap"/,
    );
    refused(
      document((doc) => (condition(doc).onRest.lowersMax = {})),
      /"lowersMax" rolls "dice", a "flat" amount, or both/,
    );
    refused(
      document((doc) => (condition(doc).onRest.rests = ["long", "long"])),
      /Rests must be unique/,
    );
    const otyugh = (doc: Record<string, any>) =>
      doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "otyugh_fever");
    refused(
      document((doc) => (otyugh(doc).onRest.save.save = "luck_save")),
      /Unknown save "luck_save"/,
    );
    // Gravewatch throws pools, and keeps its health on a track.
    const gravewatch = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../../docs/examples/rulesets/gravewatch.json", import.meta.url)), "utf8"),
    );
    gravewatch.combat.conditions[0].onRest = {
      rests: ["vigil"],
      lowersMax: { flat: 1 },
      save: { save: "steel", difficulty: 2 },
    };
    refused(gravewatch, /A save on a rest is rolled only where checks are a dice sum/);
    refused(gravewatch, /Only health kept in points has a maximum to lower/);
    refused(
      document((doc) => (doc.combat.health = { track: "exhaustion" })),
      /Only health kept in points has a maximum to lower/,
    );
  }

  // ── The install gate: 1.260 ──
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
      "A ruleset with conditions that lower a maximum on a rest requires schemaVersion 2 and capabilityApi 1.260 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const doc = structuredClone(without);
    doc.extra = { entry: { condition: "mummy_rot", onRest: mummyRot } };
    assert.equal(issue(259, doc), gate);
    assert.notEqual(issue(260, doc), gate);
    assert.notEqual(issue(259, without), gate);
    assert.equal(
      issue(259, without, new Map([["conditions.json", { entries: [{ condition: "mummy_rot", onRest: mummyRot }] }]])),
      gate,
    );
  }

  console.log(
    "Ruleset disease progress: Mummy Rot lowers the maximum each long rest, lasting or not, and counted saves are rolled out as a fight ends, won or fled; gated at 1.260.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
