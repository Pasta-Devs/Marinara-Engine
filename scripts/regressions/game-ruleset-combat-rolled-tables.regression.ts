/**
 * Rolled tables (Capability API 1.559).
 *
 *   - A Wand of Wonder: its use rolls on its `useTable`, each row as likely as its weight. A row with
 *     an area is centred on whom it was aimed, a `self` row lands on its user, and a row with no use
 *     is only told. The rows are never on the menu themselves.
 *   - A rolled call: an Efreeti Bottle's efreeti that serves, turns on its caller (`hostile`), or
 *     grants wishes and calls nobody (`none`).
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rolled-tables-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 559);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const efreeti = {
    id: "efreeti",
    label: "Efreeti",
    creature: {
      health: 200,
      defense: 17,
      initiativeModifier: 1,
      speed: 40,
      tier: "cr_1",
      actions: [{ id: "scimitar", name: "Scimitar", budget: "action", toHit: 10, damage: { flat: 13 }, reach: 5 }],
    },
  };
  const wand = () => ({
    category: "wand",
    stack: 1,
    charges: { max: 7 },
    use: { kind: "utility", targets: "any", budget: "action", range: 120, charges: 1, rollsTable: true },
    useTable: [
      {
        weight: 1,
        label: "Fireball",
        use: {
          kind: "attack",
          budget: "action",
          range: 120,
          amount: { dice: "6d6" },
          damageType: "fire",
          save: { save: "dex_save", onSuccess: "half" },
          saveDifficulty: 15,
          area: { shape: "burst", size: 20 },
        },
      },
      { weight: 1, label: "Butterflies" },
      {
        weight: 2,
        label: "Gems",
        use: {
          kind: "attack",
          budget: "action",
          range: 120,
          attackRoll: true,
          toHit: { bonus: 5 },
          amount: { dice: "2d6" },
          damageType: "piercing",
        },
      },
    ],
  });
  const bottle = (more: Record<string, unknown> = {}) => ({
    category: "bottle",
    stack: 1,
    use: {
      kind: "utility",
      targets: "self",
      budget: "action",
      calls: {
        rolled: true,
        options: [
          { creature: "creatures/efreeti", count: { flat: 1 }, weight: 1, hostile: true, label: "It attacks you" },
          { creature: "creatures/efreeti", count: { flat: 1 }, weight: 8, label: "It serves you" },
          { none: true, weight: 1, label: "It grants three wishes" },
        ],
        ...more,
      },
    },
  });
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = {
      categories: [
        { id: "wand", label: "Wand" },
        { id: "bottle", label: "Bottle" },
      ],
    };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(efreeti));
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        { id: "wand", label: "Wand of Wonder", item: wand() },
        { id: "bottle", label: "Efreeti Bottle", item: bottle() },
      ],
    });
    edit(doc);
    return doc;
  };
  const gear = (doc: Record<string, any>, id: string) =>
    doc.catalogs.find((one: { id: string }) => one.id === "gear").entries.find((one: { id: string }) => one.id === id)
      .item;
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const foe = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 1,
      initiativeModifier: 0,
      speed: 30,
      saves: { dex_save: 0, con_save: 0 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });
  const definition = parsed(document());
  const entries: Record<string, RulesetCatalogEntry[]> = {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  };
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const book = rulesetItemBook(definition, entries);
  const held = (id: string, name: string) =>
    ({ item: book.itemOf(`gear/${id}`)!.entry.item!, quantity: 1, name }) as RulesetSheetItem;
  const fight = () => {
    const width = 30;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 3,
      bestiary,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: {},
          items: [held("wand", "Wand of Wonder"), held("bottle", "Efreeti Bottle")],
        },
        { id: "near", name: "Near", side: "enemy", block: foe() },
        { id: "beside", name: "Beside", side: "enemy", block: foe() },
        { id: "far", name: "Far", side: "enemy", block: foe() },
      ],
      board: {
        grid: { width, height: 1, tiles: [Array(width).fill("plains")], elevation: [Array(width).fill(0)] } as never,
        placements: { hero: { x: 0, y: 0 }, near: { x: 10, y: 0 }, beside: { x: 11, y: 0 }, far: { x: 22, y: 0 } },
      },
    });
    state.order = ["hero", "near", "beside", "far"];
    state.turn = 0;
    return state;
  };
  // The table's die (4 for the wand's weights, 10 for the bottle's) comes up as asked; others 3.
  const rolling = (table: number, face: number) => (sides: number) => (sides === table ? face : 3);
  const use = (label: string, targetIds: string[], roll: (sides: number) => number) => {
    const state = fight();
    const options = rulesetCombatOptions(definition, state, "hero");
    const option = options.find((one) => one.label === label);
    assert.ok(option, JSON.stringify(options.map((one) => one.label)));
    assert.ok(
      !options.some((one) => /Fireball|Gems|Butterflies/.test(one.label)),
      "the table's rows are never on the menu",
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option!.id, targetIds } as RulesetCombatChoice,
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };

  // ── Wand of Wonder: a fireball centred on whom it was aimed ──
  {
    const step = use("Wand of Wonder", ["near"], rolling(4, 1));
    assert.deepEqual(
      of(step.events, "rolledTable").map((one) => [one.roll, one.of, one.result]),
      [[1, 4, "Fireball"]],
    );
    const burnt = new Set(of(step.events, "damage").map((one) => one.targetId));
    assert.ok(burnt.has("near") && burnt.has("beside"), "the burst at the one aimed at");
    assert.ok(!burnt.has("far") && !burnt.has("hero"), "and nobody past it");
    const hero = rulesetCombatant(step.state, "hero")!;
    assert.equal(hero.budgets.action, 0, "one action");
  }

  // ── Butterflies: told, nothing else ──
  {
    const step = use("Wand of Wonder", ["near"], rolling(4, 2));
    assert.deepEqual(
      of(step.events, "rolledTable").map((one) => one.result),
      ["Butterflies"],
    );
    assert.deepEqual(of(step.events, "damage"), []);
  }

  // ── Gems: at whom it was aimed alone, twice as likely ──
  {
    const step = use("Wand of Wonder", ["far"], rolling(4, 4));
    assert.deepEqual(
      of(step.events, "rolledTable").map((one) => one.result),
      ["Gems"],
    );
    assert.deepEqual([...new Set(of(step.events, "damage").map((one) => one.targetId))], ["far"]);
  }

  // ── Efreeti Bottle: serves, attacks, or grants wishes ──
  {
    const serves = use("Efreeti Bottle", [], rolling(10, 5));
    assert.deepEqual(
      of(serves.events, "rolledTable").map((one) => one.result),
      ["It serves you"],
    );
    const served = serves.state.combatants.find((one) => one.calledBy === "hero")!;
    assert.equal(served.side, "party");

    const attacks = use("Efreeti Bottle", [], rolling(10, 1));
    const turned = attacks.state.combatants.find((one) => one.calledBy === "hero")!;
    assert.equal(turned.side, "enemy", "against whoever let it out");
    assert.ok(turned.calledTurned);
    assert.deepEqual(
      of(attacks.events, "turnedOn").map((one) => one.ids),
      [[turned.id]],
    );

    const wishes = use("Efreeti Bottle", [], rolling(10, 10));
    assert.deepEqual(
      of(wishes.events, "rolledTable").map((one) => one.result),
      ["It grants three wishes"],
    );
    assert.ok(!wishes.state.combatants.some((one) => one.calledBy === "hero"), "nobody called");
  }

  // ── Refusals ──
  refused(
    document((doc) => delete gear(doc, "wand").useTable),
    /A use that rolls has its item's "useTable"/,
  );
  refused(
    document((doc) => delete gear(doc, "wand").use.rollsTable),
    /A table is rolled by the item's "use", which says "rollsTable"/,
  );
  refused(
    document((doc) => (gear(doc, "wand").useTable[0].use.charges = 1)),
    /A row is paid for by the use that rolled it/,
  );
  refused(
    document((doc) => delete gear(doc, "bottle").use.calls.rolled),
    /"weight", "hostile" and "none" are for an option a call is "rolled" among/,
  );
  refused(
    document((doc) => (gear(doc, "bottle").use.calls.options[2].creature = "creatures/efreeti")),
    /An option that calls nobody names no creature/,
  );
  refused(
    document(
      (doc) => (gear(doc, "bottle").use.calls.options[1] = { from: { catalog: "creatures" }, count: { flat: 1 } }),
    ),
    /Each option of a rolled call names one "creature", or calls nobody/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a call or an item's use rolled for (calls.rolled, useTable, rollsTable) requires schemaVersion 2 and capabilityApi 1.559 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(558) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(559) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(558) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Rolled tables: a Wand of Wonder rolls its table (a burst at whom it was aimed, a row only told, a weighted row), an Efreeti Bottle serves, turns on its caller or grants wishes; refusals and the gate at 1.559.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
