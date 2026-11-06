/**
 * The evocation wizard's features (Capability API 1.414).
 *
 *   - Empowered Evocation: the Intelligence modifier added to one damage roll of every evocation
 *     spell, an amend by the spells catalog's `school` filter; every target of a roll they share takes
 *     it, a necromancy spell does not.
 *   - Potent Cantrip: a cantrip's save that would leave nothing leaves half.
 *   - Sculpt Spells: an alteration of evocation spells only that spares 1 + the spell's level of the
 *     caster's side, who take nothing where a success leaves half.
 *   - Refusals and the install gate.
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
  type RulesetCombatantInput,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-evocation-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 414);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, school: string, mechanics: Record<string, unknown>, level = 1) => ({
    id,
    label,
    filters: { school, level },
    rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      damageType: "fire",
      ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
      ...mechanics,
    },
  });
  const burst = { range: 60, area: { shape: "burst", size: 10 }, amount: { flat: 10 } };
  const spells = [
    spell("burst", "Burst", "evocation", { ...burst, save: { save: "dex_save", onSuccess: "half" } }),
    spell("chill", "Chill", "necromancy", { ...burst, save: { save: "dex_save", onSuccess: "half" } }),
    spell("ray", "Ray", "evocation", { range: 60, autoHit: false, attackRoll: true, amount: { flat: 5 } }),
    spell(
      "spark",
      "Spark",
      "evocation",
      { range: 60, amount: { flat: 8 }, save: { save: "dex_save", onSuccess: "negates" } },
      0,
    ),
    spell(
      "frost",
      "Frost",
      "conjuration",
      { range: 60, amount: { flat: 8 }, save: { save: "dex_save", onSuccess: "negates" } },
      0,
    ),
  ] as unknown as RulesetCatalogEntry[];
  const evocation = { filter: "school", equals: "evocation" };
  const feature = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "features", values: { name: label } }],
    mechanics: { kind: "utility", ...mechanics },
  });
  const wizard = [
    feature("sculpt", "Sculpt Spells", {
      alters: { catalogs: ["spells"], where: evocation, spares: { const: 1 }, sparesByLevel: true, sparesWhole: true },
    }),
    feature("potent", "Potent Cantrip", {
      amends: [{ catalogs: ["spells"], where: { filter: "level", equals: 0 }, halfOnSave: true }],
    }),
    feature("empowered", "Empowered Evocation", {
      amends: [{ catalogs: ["spells"], where: evocation, damageOnce: { abilityMod: "int" } }],
    }),
  ] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push(
      {
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        filters: [
          { id: "school", label: "School", type: "text" },
          { id: "level", label: "Level", type: "number" },
        ],
        entries: structuredClone(spells),
      },
      { id: "wizard", label: "Wizard", feeds: ["features"], entries: structuredClone(wizard) },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const rows = (catalog: string, entries: RulesetCatalogEntry[], list: string) =>
    entries.flatMap((entry) =>
      rowsFromCatalogEntry(catalog, entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const sheet = (features: RulesetCatalogEntry[], spellList = spells) =>
    rulesetSheetBuildSchema.parse({
      // Int 16: +3.
      abilities: { str: 8, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
      fields: {
        level: 14,
        ac: 12,
        speed: 30,
        hp_max: 80,
        spellcasting_ability: "int",
        slots_max_1: 4,
        slots_max_2: 3,
      },
      lists: { spells: rows("spells", spellList, "spells"), features: rows("wizard", features, "features") },
    });
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: { dex_save: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")),
  });
  let d20s: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : 3);
  const friend = (id: string) =>
    ({ id, name: id.toUpperCase(), side: "party", build: sheet([], []), live: {} }) as RulesetCombatantInput;
  const fight = (features = wizard): RulesetEncounterState => {
    // Initiative is thrown off a queue of its own: the d20s set are for the cast.
    const queued = d20s;
    d20s = [];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "wiz",
          name: "Wizard",
          side: "party",
          build: sheet(features),
          live: {},
          catalogs: { spells, wizard: features },
        },
        friend("p1"),
        friend("p2"),
        friend("p3"),
        { id: "a", name: "A", side: "enemy", block: block() },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: {
          wiz: { x: 2, y: 7 },
          p1: { x: 10, y: 6 },
          p2: { x: 11, y: 6 },
          p3: { x: 10, y: 8 },
          a: { x: 10, y: 7 },
          b: { x: 11, y: 7 },
        },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    d20s = queued;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const cast = (
    state: RulesetEncounterState,
    label: string,
    choice: Partial<RulesetCombatChoice> = {},
    alters: string[] = [],
  ) => {
    const option = rulesetCombatOptions(definition, state, "wiz").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "wiz",
        optionId: option.id,
        targetIds: [],
        ...choice,
        ...(alters.length
          ? { alters: alters.map((one) => who(state, "wiz").actions.find((action) => action.label === one)!.id) }
          : {}),
      },
      roll,
    );
  };
  const ok = (step: ReturnType<typeof cast>) => {
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const dealt = (step: ReturnType<typeof cast>) =>
    Object.fromEntries(of(step.events, "damage").map((one) => [one.targetId, one.dealt]));
  const at = { x: 10, y: 7 };

  // ── Empowered Evocation: one roll, every target that shares it ──
  {
    d20s = Array(8).fill(1);
    const step = ok(cast(fight(), "Burst", { at }));
    assert.deepEqual(dealt(step), { a: 13, b: 13, p1: 13, p2: 13, p3: 13 }, JSON.stringify(step.events));
    d20s = Array(8).fill(1);
    assert.deepEqual(dealt(ok(cast(fight(), "Chill", { at }))), { a: 10, b: 10, p1: 10, p2: 10, p3: 10 });
    d20s = [15];
    assert.deepEqual(dealt(ok(cast(fight(), "Ray", { targetIds: ["a"] }))), { a: 8 });
    d20s = Array(8).fill(1);
    assert.deepEqual(dealt(ok(cast(fight([]), "Burst", { at }))).a, 10, "without the feature");
  }

  // ── Potent Cantrip ──
  {
    d20s = [20];
    const sparked = ok(cast(fight(), "Spark", { targetIds: ["a"] }));
    assert.deepEqual(dealt(sparked), { a: 5 }, JSON.stringify(sparked.events));
    d20s = [1];
    assert.deepEqual(dealt(ok(cast(fight(), "Spark", { targetIds: ["a"] }))), { a: 11 });
    d20s = [20];
    assert.deepEqual(dealt(ok(cast(fight(), "Frost", { targetIds: ["a"] }))), { a: 4 }, "any cantrip");
    d20s = [20];
    assert.deepEqual(dealt(ok(cast(fight([]), "Spark", { targetIds: ["a"] }))), {}, "without it, nothing");
  }

  // ── Sculpt Spells: 1 + the level, spared whole ──
  {
    d20s = Array(8).fill(1);
    const step = ok(cast(fight(), "Burst", { at, spares: ["p1", "p2"] }, ["Sculpt Spells"]));
    assert.deepEqual(dealt(step), { a: 13, b: 13, p3: 13 }, JSON.stringify(step.events));
    assert.deepEqual(
      of(step.events, "evaded")
        .map((one) => one.targetId)
        .sort(),
      ["p1", "p2"],
    );
    // Three at a 1st-level slot is one too many; a 2nd-level slot spares three.
    assert.deepEqual(
      of(cast(fight(), "Burst", { at, spares: ["p1", "p2", "p3"] }, ["Sculpt Spells"]).events, "refused").map(
        (one) => one.reason,
      ),
      ["bad-alter"],
    );
    d20s = Array(8).fill(1);
    const higher = ok(
      cast(fight(), "Burst", { at, spares: ["p1", "p2", "p3"], payWith: "slots_2" }, ["Sculpt Spells"]),
    );
    assert.deepEqual(Object.keys(dealt(higher)).sort(), ["a", "b"]);
    // Evocation only.
    assert.deepEqual(
      of(cast(fight(), "Chill", { at, spares: ["p1"] }, ["Sculpt Spells"]).events, "refused").map((one) => one.reason),
      ["bad-alter"],
    );
  }

  // ── Refusals ──
  {
    const withWizard = (edit: (entries: Record<string, any>[]) => void) =>
      fiveE((doc) => edit(doc.catalogs.at(-1).entries));
    refused(
      withWizard((entries) => {
        entries[2].mechanics.amends[0].where = { filter: "colour", equals: "red" };
      }),
      /no filter "colour"/,
    );
    refused(
      withWizard((entries) => {
        entries[2].mechanics.amends[0].entry = "spells/burst";
      }),
      /An amend names one "entry" or "catalogs"/,
    );
    refused(
      withWizard((entries) => {
        delete entries[0].mechanics.alters.spares;
      }),
      /"sparesWhole" changes "spares"/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries amend or alter by a catalog's filter, add to one damage roll (damageOnce), leave half on a save (halfOnSave) or spare whole or by level requires schemaVersion 2 and capabilityApi 1.414 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(413) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(414) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(413) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Evocation: Empowered Evocation's +3 on every target of a burst's one roll, not a necromancy spell's; Potent Cantrip's half on a save; Sculpt Spells spares 1 + the slot's level whole, evocation only; gated at 1.414.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
