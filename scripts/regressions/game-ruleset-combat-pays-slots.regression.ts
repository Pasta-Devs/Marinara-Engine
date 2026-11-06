/**
 * A worn item's charges paying for a spell, a charge a level (Capability API 1.572): a Rod of
 * Absorption's "convert energy in the rod into spell slots".
 *
 *   - `worn.paysSlots`: with no 3rd-level slot left, the bolt is offered paid out of the rod at 3rd
 *     level or higher, each a charge a level, and casting it spends them; with too few left, that
 *     way is gone.
 *   - Only pools its holder has some of, none past `paysSlotsMax` (Capability API 1.590): the Rod's
 *     "equal to or lower than your own spell slots, up to a maximum of 5th level".
 *   - Refusals and the install gates.
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
  RULESET_ITEM_SLOT_PREFIX,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-pays-slots-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 572);
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
              worn: {
                absorbs: { catalogs: ["spells"], maxLevel: 9, charges: "gains", lifetime: 5 },
                paysSlots: "slots",
              },
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
        slots_max_4: 1,
        slots_max_5: 1,
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

  // ── The mage holds the rod, with no 3rd-level slot of their own left ──
  const withRod = (charges: number) => {
    const state = fight({}, definition);
    const mage = rulesetCombatant(state, "mage")!;
    mage.sheet!.items = [held("rod", charges)];
    // Their own slots spent.
    mage.sheet!.live = {
      ...mage.sheet!.live,
      pools: {
        ...mage.sheet!.live.pools,
        slots_3: { value: 0 },
        slots_4: { value: 0 },
        slots_5: { value: 0 },
        slots_7: { value: 0 },
      },
    };
    return state;
  };
  const via = (pool: string) => `${RULESET_ITEM_SLOT_PREFIX}0:${pool}`;
  {
    const state = withRod(5);
    const bolt = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Bolt")!;
    assert.ok(bolt, "offered out of the rod");
    assert.equal(bolt.upcastOnly, true);
    assert.deepEqual(
      bolt.payWith?.filter((one) => one.startsWith(RULESET_ITEM_SLOT_PREFIX)),
      [via("slots_3"), via("slots_4"), via("slots_5")],
      "a charge a level, as high as its 5 reach",
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: bolt.id, targetIds: ["foe"], payWith: via("slots_3") },
      () => 10,
    );
    assert.ok(!step.events.some((one) => one.type === "refused"), JSON.stringify(step.events));
    assert.equal(rulesetCombatant(step.state, "mage")!.charges?.["0"], 2, "3 of its 5 spent");
    assert.equal(hp(step.state), 95, "the bolt went off");
    // With 2 left, no 3rd-level bolt comes out of it.
    const after = rulesetCombatOptions(definition, withRod(2), "mage").find((one) => one.label === "Bolt");
    assert.equal(after, undefined);
  }

  // ── Only the holder's own pools, and none past the most (1.590) ──
  {
    const rodOf = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].item;
    const offered = (most?: string) => {
      const capped = parsed(
        document((doc) => {
          rodOf(doc).charges.max = 10;
          if (most) rodOf(doc).worn.paysSlotsMax = most;
        }),
      );
      const rodBook = rulesetItemBook(capped, { gear: capped.catalogs!.find((one) => one.id === "gear")!.entries! });
      const state = fight({}, capped);
      const mage = rulesetCombatant(state, "mage")!;
      mage.sheet!.items = [{ ...held("rod", 10), item: rodBook.itemOf("gear/rod")!.entry.item! }];
      const bolt = rulesetCombatOptions(capped, state, "mage").find((one) => one.label === "Bolt")!;
      return bolt.payWith?.filter((one) => one.startsWith(RULESET_ITEM_SLOT_PREFIX));
    };
    // Ten charges reach 10th, but the mage has no 6th-level slots, nor any past 7th.
    assert.deepEqual(
      offered(),
      [via("slots_3"), via("slots_4"), via("slots_5"), via("slots_7")],
      "only pools the mage has some of",
    );
    assert.deepEqual(offered("slots_5"), [via("slots_3"), via("slots_4"), via("slots_5")], "none past 5th");
    refusedDoc(
      document((doc) => (rodOf(doc).worn.paysSlotsMax = "hit_dice")),
      /No pool "hit_dice" is of the group "slots"/,
    );
    refusedDoc(
      document((doc) => {
        delete rodOf(doc).worn.paysSlots;
        rodOf(doc).worn.paysSlotsMax = "slots_5";
      }),
      /"paysSlotsMax" caps "paysSlots"/,
    );
    const gate =
      "A ruleset with an item whose charges pay for slots up to a most (paysSlotsMax) requires schemaVersion 2 and capabilityApi 1.590 or newer";
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
    const capped = document((doc) => (rodOf(doc).worn.paysSlotsMax = "slots_5"));
    assert.equal(getCapabilityPackageInstallIssue(manifest(589) as never, capped), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(590) as never, capped), gate);
  }

  // ── Refusals ──
  refusedDoc(
    document((doc) => (doc.catalogs.at(-1).entries[0].item.worn.paysSlots = "prayers")),
    /No pool is of the group "prayers"/,
  );
  refusedDoc(
    document((doc) => (doc.catalogs.at(-1).entries[0].item.carried = { paysSlots: "slots" })),
    /Only a worn item's charges pay for a use/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item whose charges pay for uses of a pool group (paysSlots) requires schemaVersion 2 and capabilityApi 1.572 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(571) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(572) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(571) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Pays slots: a rod's charges pay for a bolt with no slot left, a charge a level, and run out, only at pools of the holder's own up to a most (gated at 1.590); gated at 1.572.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
