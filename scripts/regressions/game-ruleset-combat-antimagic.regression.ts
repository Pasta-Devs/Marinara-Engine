/**
 * Zones that suppress magic (Capability API 1.521).
 *
 *   - An antimagic field: inside it, a spell's condition does nothing, a magical ring's worn effect
 *     stops, a magical wand's use is not offered, and a +1 sword strikes as a plain one (also at
 *     somebody inside); nothing of the spells catalog is cast from inside it (a zone's `forbids.casts`).
 *   - Outside it all of that works; refusals and the install gate.
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
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetPositionOf,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-antimagic-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 521);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", range: 120, amount: { flat: 5 }, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const field = (zone: Record<string, unknown> = {}) =>
    spell("field", {
      kind: "utility",
      area: { shape: "burst", size: 10 },
      range: 60,
      amount: undefined,
      zone: {
        rounds: 100,
        triggers: [],
        suppresses: { catalogs: ["spells"], tags: ["magical"] },
        forbids: { casts: ["spells"] },
        ...zone,
      },
    });
  const bolt = spell("bolt", {});
  const document = (zone: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "blessed", label: "Blessed" }, { id: "warded", label: "Warded" });
    doc.combat.conditions.push(
      { condition: "blessed", effects: ["own-attacks-advantage"] },
      { condition: "warded", effects: ["attacks-against-disadvantage"] },
    );
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      tags: [{ id: "magical", label: "Magical" }],
      slots: [
        { id: "hand", label: "Hand", count: 2 },
        { id: "finger", label: "Finger", count: 2 },
      ],
    };
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: [field(zone), bolt] },
      {
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "sword",
            label: "Sword +1",
            item: {
              category: "gear",
              tags: ["magical"],
              slots: { hand: 1 },
              attack: { budget: "action", toHit: { bonus: 1 }, damage: { dice: "1d8", bonus: 1, type: "slashing" } },
            },
          },
          {
            id: "ring",
            label: "Ring",
            item: { category: "gear", tags: ["magical"], slots: { finger: 1 }, worn: { keepsOn: ["warded"] } },
          },
          {
            id: "wand",
            label: "Wand",
            item: {
              category: "gear",
              tags: ["magical"],
              use: { kind: "heal", targets: "self", budget: "action", amount: { flat: 3 } },
            },
          },
        ],
      },
    );
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
  const spells = definition.catalogs!.find((one) => one.id === "spells")!.entries!;
  const book = rulesetItemBook(definition, {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  });
  const itemOf = (id: string, worn: boolean): RulesetSheetItem => ({
    item: book.itemOf(`gear/${id}`)!.entry.item!,
    quantity: 1,
    worn,
    name: id,
  });
  const build = (more: Record<string, unknown> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis" },
      ...more,
    });
  const block = (): RulesetStatBlock =>
    ({ health: 100, defense: 1, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (knightAt: { x: number; y: number }, foeAt: { x: number; y: number }): RulesetEncounterState => {
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
        {
          id: "knight",
          name: "Knight",
          side: "party",
          build: build(),
          items: [itemOf("sword", true), itemOf("ring", true), itemOf("wand", false)],
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 30, height: 5, tiles: Array.from({ length: 5 }, () => Array(30).fill("plains")) } as never,
        placements: { mage: { x: 1, y: 2 }, knight: knightAt, foe: foeAt },
      },
    });
    state.order = ["mage", "knight", "foe"];
    state.turn = 0;
    // A spell's blessing on the knight.
    rulesetCombatant(state, "knight")!.tracked.push({
      condition: "blessed",
      rounds: 10,
      source: "mage",
      catalog: "spells",
    });
    // The field, cast around (10, 2).
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Field")!;
    const cast = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 10, y: 2 } },
      () => 10,
    );
    assert.ok(!cast.events.some((one) => one.type === "refused"), JSON.stringify(cast.events));
    cast.state.turn = 1;
    return cast.state;
  };
  const conditionsOf = (state: RulesetEncounterState, id: string) =>
    rulesetActiveConditions(definition, definition.combat!, rulesetCombatant(state, id)!, state).map(
      (entry) => entry.condition,
    );
  const swing = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "knight").find((one) => one.id === "item:0")!;
    assert.ok(option, "the sword");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "knight", optionId: option.id, targetIds: ["foe"] },
      () => 4,
    );
    const attack = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "attack" }> => one.type === "attack",
    );
    const harm = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage",
    );
    assert.ok(attack && harm, JSON.stringify(step.events));
    return { damage: harm.amount, modifier: attack.modifier };
  };

  let plainModifier = 0;
  // ── Outside, it all works ──
  {
    const state = fight({ x: 20, y: 2 }, { x: 21, y: 2 });
    for (const id of ["blessed", "warded", "ring"]) assert.ok(conditionsOf(state, "knight").includes(id), id);
    assert.ok(rulesetCombatOptions(definition, state, "knight").some((one) => one.id.startsWith("use:2")));
    const hit = swing(state);
    assert.equal(hit.damage, 4 + 1, "the sword's +1");
    plainModifier = hit.modifier - 1;
  }
  // ── Inside, none of it ──
  {
    const state = fight({ x: 10, y: 2 }, { x: 11, y: 2 });
    assert.ok(rulesetPositionOf(rulesetCombatant(state, "knight")!));
    for (const id of ["blessed", "warded", "ring"])
      assert.ok(!conditionsOf(state, "knight").includes(id), `${id} does nothing`);
    assert.ok(!rulesetCombatOptions(definition, state, "knight").some((one) => one.id.startsWith("use:2")));
    const plain = swing(state);
    assert.equal(plain.damage, 4, "a plain sword");
    assert.equal(plain.modifier, plainModifier, "without its +1 to hit");
    // Nor at somebody inside, from outside.
    const into = fight({ x: 13, y: 2 }, { x: 12, y: 2 });
    assert.ok(conditionsOf(into, "knight").includes("warded"), "outside the field");
    assert.equal(swing(into).damage, 4, "plain at somebody inside");
    // Nothing of the spells is cast from inside.
    const mage = rulesetCombatant(state, "mage")!;
    mage.position = { x: 10, y: 3 };
    state.turn = 0;
    assert.ok(
      !rulesetCombatOptions(definition, state, "mage").some((one) => one.label === "Bolt"),
      "no casting inside",
    );
  }

  // ── Refusals ──
  refusedDoc(document({ suppresses: {} }), /Say what it suppresses/);
  refusedDoc(document({ suppresses: { catalogs: ["prayers"] } }), /Unknown catalog "prayers"/);
  refusedDoc(document({ forbids: { casts: ["prayers"] } }), /Unknown catalog "prayers"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones suppress conditions or items inside them (a zone's suppresses or forbids casts) requires schemaVersion 2 and capabilityApi 1.521 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(520) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(521) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(520) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Antimagic: inside the field a spell's condition and a magic ring do nothing, a wand is not offered, a +1 sword strikes plain (also at somebody inside), and no spell is cast from inside; all of it works outside; gated at 1.521.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
