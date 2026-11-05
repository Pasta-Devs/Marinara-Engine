/**
 * What an item takes in over its whole existence (Capability API 1.571): a Rod of Absorption's 50.
 *
 *   - `absorbs.lifetime`: a rod with room left takes the bolt in and counts its levels for good; the
 *     count goes back to its stack after the fight and is read again next time. Spending charges never
 *     makes room again: one at its total lets the bolt through, empty or not.
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
  rulesetItemBook,
  applyRulesetFightItemChanges,
  normalizeGameInventoryStacks,
  rulesetFightItemChanges,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-absorbs-lifetime-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 571);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>, level: number) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        damageType: "fire",
        range: 120,
        amount: { flat: 5 },
        cost: [{ pool: `slots_${level}`, amount: 1 }],
        ...mechanics,
      },
    }) as unknown as RulesetCatalogEntry;
  const spells = [
    spell("bolt", {}, 3),
    spell("great", {}, 7),
    spell("burst", { area: { shape: "burst", size: 5 } }, 3),
  ];
  const document = (
    edit: (doc: Record<string, any>) => void = () => {},
    absorbs: Record<string, unknown> = { catalogs: ["spells"], maxLevel: 6 },
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "drinks_magic", label: "Drinks Magic" });
    doc.combat.conditions.push({ condition: "drinks_magic", effects: [], absorbs });
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: spells },
      {
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "rod",
            label: "Rod of Absorption",
            item: {
              category: "gear",
              stack: 1,
              slots: { hand: 1 },
              charges: { max: 5 },
              worn: { absorbs: { catalogs: ["spells"], maxLevel: 9, charges: "gains", lifetime: 5 } },
            },
          },
          {
            id: "stone",
            label: "Ioun Stone",
            item: {
              category: "gear",
              stack: 1,
              slots: { hand: 1 },
              charges: { max: 4 },
              worn: { absorbs: { catalogs: ["spells"], maxLevel: 4, charges: "spends" } },
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
  const refusedDoc = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const book = rulesetItemBook(definition, {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  });
  const held = (id: string, charges?: number, absorbedEver?: number): RulesetSheetItem => ({
    item: book.itemOf(`gear/${id}`)!.entry.item!,
    quantity: 1,
    worn: true,
    name: id,
    stack: { id: "s1", ref: `gear/${id}` },
    ...(charges !== undefined ? { charges } : {}),
    ...(absorbedEver !== undefined ? { absorbedEver } : {}),
  });
  const build = (more: Record<string, unknown> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: {
        level: 13,
        ac: 12,
        speed: 30,
        hp_max: 60,
        spellcasting_ability: "wis",
        slots_max_3: 4,
        slots_max_7: 1,
      },
      ...more,
    });
  const fight = (
    foe: { keepsOn?: string[]; items?: RulesetSheetItem[] },
    definition: RulesetDefinition,
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: build({
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        foe.items
          ? { id: "foe", name: "Foe", side: "enemy", build: build(), live: {}, items: foe.items }
          : {
              id: "foe",
              name: "Foe",
              side: "enemy",
              block: {
                health: 100,
                defense: 5,
                initiativeModifier: 0,
                speed: 30,
                actions: [],
                ...(foe.keepsOn ? { keepsOn: foe.keepsOn } : {}),
              } as unknown as RulesetStatBlock,
            },
      ],
      board: {
        grid: { width: 20, height: 5, tiles: Array.from({ length: 5 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, foe: { x: 10, y: 2 } },
      },
    });
    // A sheet always walks in on the party's side; this one stands against the mage.
    const foeCombatant = state.combatants.find((one) => one.id === "foe")!;
    foeCombatant.side = "enemy";
    state.order = ["mage", "foe"];
    state.turn = 0;
    return state;
  };
  const hp = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, "foe")!).value;
  const cast = (
    state: RulesetEncounterState,
    label: string,
    definition: RulesetDefinition,
    choice: Record<string, unknown> = { targetIds: ["foe"] },
  ) => {
    const before = hp(state);
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], ...choice },
      () => 10,
    );
    assert.ok(!step.events.some((one) => one.type === "refused"), JSON.stringify(step.events));
    const absorbed = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "absorbed" }> => one.type === "absorbed",
    );
    return { step, absorbed, lost: before - hp(step.state) };
  };

  // ── Room left: taken in, and counted for good ──
  {
    const state = fight({ items: [held("rod", 0)] }, definition);
    const first = cast(state, "Bolt", definition);
    assert.equal(first.lost, 0, "taken in");
    assert.equal(rulesetCombatant(first.step.state, "foe")!.absorbedEver?.["0"], 3);
    // The count goes back to the stack, and is read again: only a party member's are written, so
    // this foe stands as one here.
    for (const one of [state, first.step.state]) rulesetCombatant(one, "foe")!.side = "party";
    const changes = rulesetFightItemChanges(state, first.step.state);
    assert.equal(changes[0]?.absorbedEver, 3);
    const bag = [{ id: "s1", name: "rod", item: "gear/rod", quantity: 1, equipped: true }];
    const written = applyRulesetFightItemChanges(bag, changes)!;
    const kept = normalizeGameInventoryStacks(JSON.parse(JSON.stringify(written.stacks)))[0]!;
    assert.equal(kept.absorbedEver, 3);
    assert.equal(kept.charges, 3);
  }
  // ── Spent down but at its total: the bolt gets through ──
  {
    const full = cast(fight({ items: [held("rod", 0, 3)] }, definition), "Bolt", definition);
    assert.equal(full.lost, 5, "3 more would pass its 5");
    assert.equal(full.absorbed, undefined);
    const room = cast(fight({ items: [held("rod", 0, 2)] }, definition), "Bolt", definition);
    assert.equal(room.lost, 0, "exactly to its 5");
    assert.equal(rulesetCombatant(room.step.state, "foe")!.absorbedEver?.["0"], 5);
  }

  // ── Refusals ──
  refusedDoc(
    document(undefined, { catalogs: ["spells"], maxLevel: 6, lifetime: 5 }),
    /Only an item's worn effect counts what it ever took in/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item that takes in only so much over its whole existence (absorbs.lifetime) requires schemaVersion 2 and capabilityApi 1.571 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(570) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(571) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(570) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Absorbs lifetime: a rod counts what it takes in for good, writes it back to its stack, and lets a bolt through once it would pass its total; gated at 1.571.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
