/**
 * Diseases (Capability API 1.258).
 *
 *   - A combat condition's `kinds`: a cure's `ends` may name a kind for any condition of it ("one
 *     disease": Lesser Restoration, Lay on Hands), and an immunity may name one (Divine Health).
 *   - `saveEnds.successes` and `saveEnds.failures`: Contagion's saves at each turn's end, three
 *     successes ending it and three failures setting the disease in, with no clock, so it outlasts
 *     the fight.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-diseases-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 253);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { range: 30, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Contagion: saves at the end of each of the target's turns, three either way.
  const contagion = spell("contagion", {
    kind: "debuff",
    targets: "enemy",
    applies: [
      {
        condition: "infected",
        duration: "until-save",
        saveEnds: {
          save: "con_save",
          at: "turn-end",
          successes: 3,
          failures: { count: 3, becomes: "blinding_sickness" },
        },
      },
    ],
  });
  // Lesser Restoration's "one disease", and a cure of every disease at once.
  const restoration = spell("restoration", {
    kind: "utility",
    targets: "any",
    ends: { conditions: ["disease", "blinded"], count: 1 },
  });
  const purge = spell("purge", { kind: "utility", targets: "any", ends: { conditions: ["disease"] } });
  const spells = [contagion, restoration, purge];
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    for (const [id, label] of [
      ["infected", "Infected"],
      ["blinding_sickness", "Blinding Sickness"],
      ["filth_fever", "Filth Fever"],
      ["divine_health", "Divine Health"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      { condition: "infected", effects: [] },
      { condition: "blinding_sickness", effects: [], kinds: ["disease"] },
      { condition: "filth_fever", effects: [], kinds: ["disease"] },
      { condition: "divine_health", effects: [], conditionImmunities: ["disease"] },
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
  // The d20s in the order they are thrown; every other die shows 3.
  let d20s: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : 3);
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 50,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { con_save: 0 },
    actions: [],
    ...extra,
  });
  const fight = (foe: Partial<RulesetStatBlock> = {}): RulesetEncounterState => {
    const entries = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
    const state = createRulesetEncounter({
      definition,
      bestiary: { spells: entries },
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          // Int 16 at level 3: spells saved against at 13.
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "int" },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block(foe) },
      ],
    });
    state.order = ["corwin", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id = "foe") => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, condition: string, id = "foe") =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds = ["foe"]) => {
    state.turn = 0;
    who(state, "corwin").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "corwin").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return act(state, { actorId: "corwin", optionId: option.id, targetIds });
  };
  /** The foe's turn, ended: its save against Contagion is rolled with this d20. */
  const foeTurn = (state: RulesetEncounterState, face: number) => {
    state.turn = 1;
    d20s = [face];
    return act(state, { actorId: "foe", optionId: "end-turn", targetIds: [] });
  };

  // ── Contagion: three failures set the disease in ──
  {
    let state = cast(fight(), "Contagion").state;
    assert.ok(has(state, "infected"));
    const tracked = () => who(state).tracked.find((entry) => entry.condition === "infected");
    assert.deepEqual(tracked()?.saveEnds, {
      save: "con_save",
      at: "turn-end",
      successes: 3,
      failures: { count: 3, becomes: "blinding_sickness" },
    });
    state = foeTurn(state, 2).state;
    assert.equal(tracked()?.fails, 1);
    // A success between them does not undo a failure.
    state = foeTurn(state, 18).state;
    assert.equal(tracked()?.passes, 1);
    assert.ok(has(state, "infected"), "one success of three");
    state = foeTurn(state, 2).state;
    const third = foeTurn(state, 2);
    state = third.state;
    assert.equal(has(state, "infected"), false);
    assert.ok(has(state, "blinding_sickness"), "the disease set in");
    const conditions = of(third.events, "condition");
    assert.deepEqual(
      conditions.map((one) => [one.condition, one.active, one.reason]),
      [
        ["infected", false, "worsened"],
        ["blinding_sickness", true, "applied"],
      ],
    );
    // No clock: it outlasts the fight.
    assert.equal(who(state).tracked.find((entry) => entry.condition === "blinding_sickness")?.rounds, null);
    liftRulesetFightEffects(definition, state);
    assert.ok(has(state, "blinding_sickness"), "still there once the fight is over");
    // And no more saves are made.
    const after = foeTurn(state, 2);
    assert.equal(of(after.events, "save").length, 0);
  }

  // ── Three successes end it ──
  {
    let state = cast(fight(), "Contagion").state;
    state = foeTurn(state, 18).state;
    state = foeTurn(state, 18).state;
    assert.ok(has(state, "infected"), "two of three");
    const ended = foeTurn(state, 18);
    assert.equal(has(ended.state, "infected"), false);
    assert.equal(of(ended.events, "condition")[0]?.reason, "save");
  }

  // ── A cure naming a kind ──
  {
    const state = fight();
    who(state).tracked.push(
      { condition: "blinding_sickness", rounds: null },
      { condition: "filth_fever", rounds: null },
      { condition: "blinded", rounds: null },
    );
    const one = cast(state, "Restoration");
    assert.deepEqual(
      of(one.events, "condition").map((event) => event.condition),
      ["blinding_sickness"],
      "one disease, the first of the kind",
    );
    assert.ok(has(one.state, "filth_fever"));
    assert.ok(has(one.state, "blinded"), "one condition in all");
    const all = cast(one.state, "Purge");
    assert.equal(has(all.state, "filth_fever"), false);
    assert.ok(has(all.state, "blinded"), "not a disease");
    // Nothing of the kind on them: not a target for it.
    const clean = fight();
    const option = rulesetCombatOptions(definition, clean, "corwin").find((one) => one.label === "Purge")!;
    assert.deepEqual(rulesetOptionTargets(definition, clean, "corwin", option), [], "nobody to cure");
  }

  // ── Immune to a kind ──
  {
    const state = fight({ conditionImmunities: ["disease"] });
    let next = cast(state, "Contagion").state;
    for (let failed = 0; failed < 3; failed += 1) next = foeTurn(next, 2).state;
    assert.equal(has(next, "blinding_sickness"), false, "a creature immune to disease");
    const holy = fight();
    who(holy).tracked.push({ condition: "divine_health", rounds: null });
    let fails = cast(holy, "Contagion").state;
    for (let failed = 0; failed < 3; failed += 1) fails = foeTurn(fails, 2).state;
    assert.equal(has(fails, "blinding_sickness"), false, "Divine Health");
    assert.equal(has(fails, "infected"), false);
  }

  // ── An opponent nobody wrote keeps an immunity to a kind ──
  {
    const held = clampRulesetStatBlock(
      definition,
      {
        health: 6,
        defense: 10,
        initiativeModifier: 0,
        conditionImmunities: ["disease", "plague"],
        actions: [],
      } as never,
      "cr_1",
    );
    assert.deepEqual(held.block.conditionImmunities, ["disease"], "a kind kept, a name it does not have dropped");
  }

  // ── Import ──
  {
    const condition = (doc: Record<string, any>, id: string) =>
      doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
    const entry = (doc: Record<string, any>, id: string) =>
      doc.catalogs
        .find((one: { id: string }) => one.id === "spells")
        .entries.find((one: { id: string }) => one.id === id);
    refused(
      document((doc) => (condition(doc, "filth_fever").kinds = ["blinded"])),
      /"blinded" is a condition, so it is no kind/,
    );
    refused(
      document((doc) => (entry(doc, "contagion").mechanics.applies[0].saveEnds.failures.becomes = "nope")),
      /Unknown condition "nope"/,
    );
    refused(
      document((doc) => (entry(doc, "contagion").mechanics.applies[0].saveEnds.successes = 1)),
      /successes/,
    );
    refused(
      document((doc) => (entry(doc, "purge").mechanics.ends.conditions = ["plague"])),
      /Unknown condition "plague"/,
    );
    refused(
      document((doc) => (condition(doc, "divine_health").conditionImmunities = ["plague"])),
      /Unknown condition "plague"/,
    );
    // A kind may be any number of conditions, so its count is not held to the names.
    parsed(document((doc) => (entry(doc, "purge").mechanics.ends.count = 2)));
    refused(
      document((doc) => {
        entry(doc, "purge").mechanics.ends = { conditions: ["blinded"], count: 2 };
      }),
      /at most as many conditions as it names/,
    );
  }

  // ── The install gate: 1.258 ──
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
      "A ruleset with condition kinds, or saves counted to end a condition or to worsen it, requires schemaVersion 2 and capabilityApi 1.258 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    for (const extra of [
      { condition: "plague", kinds: ["disease"] },
      { saveEnds: { save: "con_save", at: "turn-end", successes: 3 } },
      { saveEnds: { save: "con_save", at: "turn-end", failures: { count: 3, becomes: "x" } } },
    ]) {
      const doc = structuredClone(without);
      doc.extra = { entry: extra };
      assert.equal(issue(257, doc), gate, JSON.stringify(extra));
      assert.notEqual(issue(258, doc), gate);
    }
    // A wound track's kinds are older.
    const older = structuredClone(without);
    older.extra = { track: { id: "wounds", kinds: [{ id: "bashing" }] } };
    assert.notEqual(issue(257, older), gate);
    assert.notEqual(issue(257, without), gate);
    assert.equal(issue(257, without, new Map([["spells.json", { entries: [contagion] }]])), gate);
  }

  console.log(
    "Ruleset diseases: condition kinds cured one at a time or all and kept off by an immunity, and Contagion's saves counted to an end or to the disease; gated at 1.258.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
