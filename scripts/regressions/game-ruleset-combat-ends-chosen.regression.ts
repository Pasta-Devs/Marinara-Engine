/**
 * Picking what endsSpells ends, ending a lasting area, and endsSpells on an item (Capability API 1.427).
 *
 *   - Cleansing Touch (`chosen`): the menu offers each of the target's spells, and the one picked ends
 *     rather than the highest; nothing picked, the highest.
 *   - Dispel Magic (`zones`) aimed at a lasting area: a 1st-level fog ends outright, a 5th-level wall
 *     held by concentration on a check against 10 + 5, its concentration with it.
 *   - A scroll of Dispel Magic: endsSpells on an item's use.
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
  type RulesetCatalogItem,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ends-chosen-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 427);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>, level = 1) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
    mechanics: {
      kind: "utility",
      ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
      ...mechanics,
    },
  });
  const above = { check: { abilityMod: "int" }, dc: 10 };
  const spells = [
    spell(
      "dispel",
      "Dispel",
      {
        targets: "any",
        range: 120,
        endsSpells: { catalogs: ["spells"], upTo: "paid", above, zones: true },
      },
      3,
    ),
    spell("fog", "Fog", {
      range: 120,
      area: { shape: "burst", size: 5 },
      zone: { rounds: 10, triggers: ["turn-start"], atCast: false },
    }),
    spell(
      "wall",
      "Wall",
      {
        range: 120,
        concentration: true,
        area: { shape: "burst", size: 5 },
        zone: { rounds: 10, triggers: ["turn-start"], atCast: false },
      },
      5,
    ),
  ] as unknown as RulesetCatalogEntry[];
  const wizard = [
    {
      id: "cleansing",
      label: "Cleansing Touch",
      rows: [{ list: "features", values: { name: "Cleansing Touch" } }],
      mechanics: {
        kind: "utility",
        targets: "ally",
        range: 30,
        endsSpells: { catalogs: ["spells"], count: 1, chosen: true },
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const scrollItem = {
    category: "gear",
    use: {
      kind: "utility",
      budget: "action",
      targets: "any",
      range: 120,
      endsSpells: { catalogs: ["spells"], upTo: 3 },
      consumes: true,
    },
  } as unknown as RulesetCatalogItem;
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    for (const id of ["blessed", "held_fast"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push({ condition: "blessed", effects: [] }, { condition: "held_fast", effects: [] });
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
  const sheet = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
      fields: {
        level: 14,
        ac: 12,
        speed: 30,
        hp_max: 90,
        spellcasting_ability: "int",
        slots_max_1: 4,
        slots_max_3: 2,
        slots_max_5: 1,
      },
      lists: {
        spells: rows("spells", spells, "spells"),
        features: rows("wizard", wizard, "features"),
        counters: rows("wizard", wizard, "counters"),
      },
    });
  const block = (): RulesetStatBlock =>
    ({ health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")),
  });
  let checks: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (checks.shift() ?? 1) : 1);
  const scroll: RulesetSheetItem = {
    name: "Scroll of Dispel",
    quantity: 1,
    item: scrollItem,
    stack: { id: "scroll", ref: "gear/scroll" },
  };
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "wiz",
          name: "Wizard",
          side: "party",
          build: sheet(),
          live: {},
          catalogs: { spells, wizard },
          items: [scroll],
        },
        { id: "ally", name: "Ally", side: "party", block: block() },
        { id: "a", name: "A", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { wiz: { x: 2, y: 7 }, ally: { x: 4, y: 7 }, a: { x: 20, y: 7 } } },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const optionOf = (state: RulesetEncounterState, label: string) => {
    state.turn = 0;
    who(state, "wiz").budgets.action = 1;
    const options = rulesetCombatOptions(definition, state, "wiz");
    const option = options.find((one) => one.label === label) ?? options.find((one) => one.label.includes(label));
    assert.ok(option, `no ${label}`);
    return option;
  };
  const act = (
    state: RulesetEncounterState,
    label: string,
    choice: Partial<RulesetCombatChoice>,
    d20s: number[] = [],
  ) => {
    checks = [...d20s];
    const option = optionOf(state, label);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wiz", optionId: option.id, targetIds: [], ...choice },
      roll,
    );
  };
  const ok = (step: ReturnType<typeof act>) => {
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  type Tracked = RulesetEncounterState["combatants"][number]["tracked"][number];
  const put = (state: RulesetEncounterState, id: string, entry: Partial<Tracked> & { condition: string }) =>
    who(state, id).tracked.push({ rounds: null, ...entry } as Tracked);
  const holds = (state: RulesetEncounterState, id: string) =>
    who(state, id)
      .tracked.map((one) => one.condition)
      .sort();
  const loaded = () => {
    const state = fight();
    put(state, "ally", { condition: "blessed", catalog: "spells", level: 1, source: "wiz" });
    put(state, "ally", { condition: "held_fast", catalog: "spells", level: 5, source: "wiz" });
    return state;
  };

  // ── Cleansing Touch picks its spell ──
  {
    const state = loaded();
    const option = optionOf(state, "Cleansing Touch");
    assert.deepEqual(
      option.endsChoices?.ally?.map((one) => [one.condition, one.level]),
      [
        ["blessed", 1],
        ["held_fast", 5],
      ],
    );
    const picked = ok(act(state, "Cleansing Touch", { targetIds: ["ally"], ends: ["blessed"] }));
    assert.deepEqual(holds(picked.state, "ally"), ["held_fast"], "the one picked, not the highest");
    const unpicked = ok(act(loaded(), "Cleansing Touch", { targetIds: ["ally"] }));
    assert.deepEqual(holds(unpicked.state, "ally"), ["blessed"], "nothing picked, the highest");
    const wrong = act(loaded(), "Cleansing Touch", { targetIds: ["ally"], ends: ["poisoned"] });
    assert.deepEqual(
      of(wrong.events, "refused").map((one) => one.reason),
      ["bad-target"],
    );
    const many = act(loaded(), "Cleansing Touch", { targetIds: ["ally"], ends: ["blessed", "held_fast"] });
    assert.deepEqual(
      of(many.events, "refused").map((one) => one.reason),
      ["bad-target"],
      "no more than its count",
    );
  }

  // ── Dispel Magic on a lasting area ──
  {
    const fogged = ok(act(fight(), "Fog", { at: { x: 12, y: 7 } })).state;
    assert.equal(who(fogged, "wiz").zones?.length, 1);
    const offered = optionOf(fogged, "Dispel").dispels;
    assert.deepEqual(
      offered?.map((one) => [one.casterId, one.label]),
      [["wiz", "Fog"]],
    );
    const ended = ok(act(fogged, "Dispel", { dispel: { casterId: "wiz", actionId: offered![0]!.actionId } }));
    assert.ok(of(ended.events, "zone").some((one) => one.label === "Fog" && one.outcome === "dispelled"));
    assert.equal(who(ended.state, "wiz").zones?.length ?? 0, 0, "the 1st-level fog ends outright");
    // A 5th-level wall, held by concentration: on a check of d20 + 3 against 15.
    const walled = () => ok(act(fight(), "Wall", { at: { x: 12, y: 7 } })).state;
    const wallId = () => optionOf(walled(), "Dispel").dispels![0]!.actionId;
    const failed = act(walled(), "Dispel", { dispel: { casterId: "wiz", actionId: wallId() } }, [2]);
    assert.deepEqual(
      of(failed.events, "counter").map((one) => [one.level, one.success]),
      [[5, false]],
    );
    assert.equal(who(failed.state, "wiz").zones?.length, 1, "a failed check leaves it");
    const made = ok(act(walled(), "Dispel", { dispel: { casterId: "wiz", actionId: wallId() } }, [12]));
    assert.equal(who(made.state, "wiz").zones?.length ?? 0, 0, "a made check ends it");
    assert.equal(who(made.state, "wiz").concentrating, null, "and the concentration that held it");
    // Only a zone the menu offered.
    const unoffered = act(fogged, "Dispel", { dispel: { casterId: "wiz", actionId: "nothing" } });
    assert.deepEqual(
      of(unoffered.events, "refused").map((one) => one.reason),
      ["bad-target"],
    );
  }

  // ── A scroll of Dispel Magic ──
  {
    const read = ok(act(loaded(), "Scroll of Dispel", { targetIds: ["ally"] }, [2]));
    assert.deepEqual(holds(read.state, "ally"), ["held_fast"], "the scroll ends the 1st-level spell, not the 5th");
  }

  // ── Parsing a scroll, and refusals ──
  {
    const withScroll = (use: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }] };
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [{ id: "scroll", label: "Scroll", item: { category: "gear", use } }],
        });
      });
    parsed(withScroll(structuredClone(scrollItem.use) as Record<string, unknown>));
    refused(
      withScroll({ ...structuredClone(scrollItem.use), endsSpells: { catalogs: ["nothing_here"] } }),
      /Unknown catalog "nothing_here"/,
    );
    refused(
      withScroll({
        ...structuredClone(scrollItem.use),
        endsSpells: { catalogs: ["spells"], upTo: 3, above: { check: { derived: "no_such" }, dc: 10 } },
      }),
      /no_such/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries end a spell their user picks (endsSpells chosen) or a lasting area (endsSpells zones) requires schemaVersion 2 and capabilityApi 1.427 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(426) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(427) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(426) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Ends chosen: Cleansing Touch ends the spell picked, the highest when none is; Dispel Magic ends a lasting area, outright or on a check, with its concentration; a scroll ends spells too; gated at 1.427.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
