/**
 * Ending what a catalog's entries put on (Capability API 1.424).
 *
 *   - Dispel Magic at 3rd level: a 1st-level spell's condition ends outright, a 5th-level one on a
 *     check against 10 + 5, and what no spell put on stays; one held by its caster's concentration
 *     ends the whole spell, on everybody it held.
 *   - Cleansing Touch: one spell, the highest level first.
 *   - A spell's condition remembers its catalog as it goes on.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ends-spells-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 424);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>, level = 1) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      damageType: "fire",
      ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
      ...mechanics,
    },
  });
  const burst = {
    range: 60,
    area: { shape: "burst", size: 5 },
    amount: { dice: "2d6" },
    save: { save: "dex_save", onSuccess: "half" },
  };
  const spells = [
    spell(
      "dispel",
      "Dispel",
      {
        kind: "utility",
        targets: "any",
        range: 120,
        endsSpells: { catalogs: ["spells"], upTo: "paid", above: { check: { abilityMod: "int" }, dc: 10 } },
      },
      3,
    ),
    spell("hex", "Hex", {
      kind: "debuff",
      autoHit: false,
      targets: "enemy",
      range: 60,
      applies: [{ condition: "hexed", duration: { rounds: 10 } }],
    }),
  ] as unknown as RulesetCatalogEntry[];
  const wizard = [
    {
      id: "cleansing",
      label: "Cleansing Touch",
      rows: [{ list: "features", values: { name: "Cleansing Touch" } }],
      mechanics: { kind: "utility", targets: "ally", range: 30, endsSpells: { catalogs: ["spells"], count: 1 } },
    },
  ] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    for (const id of ["blessed", "held_fast", "hexed"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push(
      { condition: "blessed", effects: [] },
      { condition: "held_fast", effects: [] },
      { condition: "hexed", effects: [] },
    );
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) },
      { id: "wizard", label: "Wizard", feeds: ["features", "counters"], entries: structuredClone(wizard) },
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
  const sheet = (features: RulesetCatalogEntry[]) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
      fields: {
        level: 14,
        ac: 12,
        speed: 30,
        hp_max: 90,
        spellcasting_ability: "int",
        slots_max_1: 4,
        slots_max_2: 3,
        slots_max_3: 2,
      },
      lists: {
        spells: rows("spells", spells, "spells"),
        features: rows("wizard", features, "features"),
        counters: rows("wizard", features, "counters"),
      },
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
  // Saves fail on 1; every d12 is a 5, every d8 and d6 and d10 a 1.
  const roll = (sides: number) => (sides === 20 ? 1 : sides === 12 ? 5 : 1);
  const fight = (features = wizard): RulesetEncounterState => {
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
        { id: "ally", name: "Ally", side: "party", block: block() },
        { id: "a", name: "A", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { wiz: { x: 2, y: 7 }, ally: { x: 4, y: 7 }, a: { x: 12, y: 7 } } },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
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
    state.turn = 0;
    who(state, "wiz").budgets.action = 1;
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
  const refusedWith = (step: ReturnType<typeof cast>) => of(step.events, "refused").map((one) => one.reason);
  const dealtTo = (step: ReturnType<typeof cast>, id: string) =>
    of(step.events, "damage")
      .filter((one) => one.targetId === id)
      .map((one) => one.dealt);
  const at = { x: 12, y: 7 };

  void refusedWith;
  void dealtTo;
  void grid;
  void at;
  type Tracked = RulesetEncounterState["combatants"][number]["tracked"][number];
  const put = (state: RulesetEncounterState, id: string, entry: Partial<Tracked> & { condition: string }) =>
    who(state, id).tracked.push({ rounds: null, ...entry } as Tracked);
  const holds = (state: RulesetEncounterState, id: string) => who(state, id).tracked.map((one) => one.condition);
  const loaded = () => {
    const state = fight();
    put(state, "ally", { condition: "blessed", catalog: "spells", level: 1, source: "wiz" });
    put(state, "ally", { condition: "held_fast", catalog: "spells", level: 5, source: "a", concentration: true });
    put(state, "ally", { condition: "poisoned" });
    put(state, "wiz", { condition: "held_fast", catalog: "spells", level: 5, source: "a", concentration: true });
    who(state, "a").concentrating = { actionId: "hold", label: "Hold Fast" } as never;
    return state;
  };
  // d20s for checks from the queue.
  let checks: number[] = [];
  const checking = (sides: number) => (sides === 20 ? (checks.shift() ?? 1) : 1);
  const dispel = (state: RulesetEncounterState, d20: number) => {
    checks = [d20];
    state.turn = 0;
    who(state, "wiz").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "wiz").find((one) => one.label === "Dispel");
    assert.ok(option, "no Dispel");
    return ok(
      applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "wiz", optionId: option.id, targetIds: ["ally"] },
        checking,
      ),
    );
  };

  // ── Dispel Magic at 3rd level ──
  {
    const failed = dispel(loaded(), 2);
    assert.deepEqual(holds(failed.state, "ally").sort(), ["held_fast", "poisoned"], "the 1st-level spell ends");
    assert.deepEqual(
      of(failed.events, "counter").map((one) => [one.level, one.difficulty, one.success]),
      [[5, 15, false]],
      "2 + 3 against 10 + 5",
    );
    const made = dispel(loaded(), 12);
    assert.deepEqual(holds(made.state, "ally"), ["poisoned"], "12 + 3 makes it; what no spell put on stays");
    assert.deepEqual(holds(made.state, "wiz"), [], "the whole concentrated spell ends, on everybody");
    assert.equal(who(made.state, "a").concentrating, null);
    assert.ok(
      of(made.events, "concentration").some((one) => one.actorId === "a" && one.reason === "dispelled"),
      JSON.stringify(of(made.events, "concentration")),
    );
  }

  // ── Cleansing Touch: one spell, the highest first ──
  {
    const state = loaded();
    state.turn = 0;
    who(state, "wiz").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "wiz").find((one) => one.label === "Cleansing Touch");
    assert.ok(option, "no Cleansing Touch");
    const touched = ok(
      applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "wiz", optionId: option.id, targetIds: ["ally"] },
        checking,
      ),
    );
    assert.deepEqual(holds(touched.state, "ally").sort(), ["blessed", "poisoned"]);
  }

  // ── A spell's condition remembers its catalog ──
  {
    const state = fight();
    state.turn = 0;
    who(state, "wiz").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "wiz").find((one) => one.label === "Hex");
    assert.ok(option, "no Hex");
    const hexed = ok(
      applyRulesetCombatChoice(definition, state, { actorId: "wiz", optionId: option.id, targetIds: ["a"] }, checking),
    );
    const entry = who(hexed.state, "a").tracked.find((one) => one.condition === "hexed");
    assert.deepEqual([entry?.catalog, entry?.level], ["spells", 1], JSON.stringify(hexed.events));
  }

  // ── Refusals ──
  {
    const ending = (endsSpells: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics.endsSpells = endsSpells;
      });
    refused(ending({ catalogs: ["nothing_here"] }), /Unknown catalog "nothing_here"/);
    refused(ending({ catalogs: ["spells"], above: { check: { const: 3 }, dc: 10 } }), /"above" is a check past "upTo"/);
    refused(
      ending({ catalogs: ["spells"], upTo: 3, above: { check: { derived: "nothing_here" }, dc: 10 } }),
      /nothing_here/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries end what a catalog's entries put on (endsSpells) requires schemaVersion 2 and capabilityApi 1.424 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(423) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(424) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(423) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Ends spells: Dispel Magic ends a lower spell outright and a higher one on a check, the whole of a concentrated spell; Cleansing Touch ends one, the highest first; a spell's condition remembers its catalog; gated at 1.424.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
