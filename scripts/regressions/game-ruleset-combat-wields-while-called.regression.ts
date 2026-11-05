/**
 * Weapons an item's call lends while it stands (Capability API 1.739): a Figurine of Wondrous
 * Power's goat of terror, whose horns become a +1 lance and a +2 longsword, removing one an action.
 *
 *   - Nothing to wield before the goat comes; once it stands, each horn is taken on an action and
 *     then wielded; once it is gone, so are they.
 *   - They count toward no slot and carry no inventory stack.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wields-while-called-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 739);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const goat = {
    id: "goat-of-terror",
    label: "Goat of Terror",
    filters: { challenge: "CR 1/2", kind: "Beast", places: ["Anywhere"] },
    creature: {
      health: 19,
      defense: 11,
      initiativeModifier: 0,
      speed: 40,
      tier: "cr_1_2",
      actions: [{ id: "ram", name: "Ram", budget: "action", toHit: 5, damage: { dice: "1d4", flat: 3 }, reach: 5 }],
    },
  };
  const lends = { items: ["magic_items/horn-lance", "magic_items/horn-longsword"], takes: "action" };
  const figurine = (wields: unknown = lends) => ({
    kind: "utility",
    targets: "self",
    budget: "action",
    calls: { creature: "creatures/goat-of-terror", count: { flat: 1 }, initiative: "after", rounds: 1800 },
    ...(wields !== null ? { wieldsWhileCalled: wields } : {}),
  });
  const horn = (bonus: number, dice: string, type: string) => ({
    category: "gear",
    slots: { hands: 1 },
    attack: { budget: "action", toHit: { bonus }, damage: { dice, bonus, type }, reach: 5 },
  });
  const document = (wields: unknown = lends): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(goat));
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.catalogs.push({
      id: "magic_items",
      label: "Magic items",
      holds: "items",
      entries: [
        { id: "goat-figurine", label: "Ivory Goat of Terror", item: { category: "gear", use: figurine(wields) } },
        { id: "horn-lance", label: "Goat Horn Lance", item: horn(1, "1d12", "piercing") },
        { id: "horn-longsword", label: "Goat Horn Longsword", item: horn(2, "1d8", "slashing") },
      ],
    });
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
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const brute = {
    health: 500,
    defense: 1,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
  } as unknown as RulesetStatBlock;
  let state: RulesetEncounterState = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    bestiary: { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! },
    combatants: [
      {
        id: "hero",
        name: "Hero",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
        }),
        live: {},
        items: [
          {
            name: "Ivory Goat of Terror",
            quantity: 1,
            worn: false,
            item: { category: "gear", use: figurine() } as unknown as RulesetCatalogItem,
            stack: { id: "st-goat", ref: "magic_items/goat-figurine" },
          },
        ],
      },
      { id: "brute", name: "Brute", side: "enemy", block: brute },
    ],
  });
  state.order = ["hero", "brute"];
  state.turn = 0;
  const step = (choice: Partial<RulesetCombatChoice> & { optionId: string; actorId: string }) => {
    const result = applyRulesetCombatChoice(definition, state, { targetIds: [], ...choice }, () => 10);
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    state = result.state;
    return result.events;
  };
  const hero = () => rulesetCombatant(state, "hero")!;
  const offered = () =>
    rulesetCombatOptions(definition, state, "hero")
      .map((one) => one.id)
      .filter((id) => /^(item|take):[12]$/.test(id))
      .sort();
  const until = (id: string) => {
    step({ actorId: state.order[state.turn]!, optionId: "end-turn" });
    for (let guard = 0; guard < 6 && state.order[state.turn] !== id; guard++)
      step({ actorId: state.order[state.turn]!, optionId: "end-turn" });
    assert.equal(state.order[state.turn], id);
  };

  // ── The horns are lent, stackless and handless, and nothing until the goat comes ──
  assert.deepEqual(
    hero().sheet!.items!.map((one) => [one.name, one.lent?.by ?? null, one.stack?.id ?? null]),
    [
      ["Ivory Goat of Terror", null, "st-goat"],
      ["Goat Horn Lance", "use:0", null],
      ["Goat Horn Longsword", "use:0", null],
    ],
  );
  assert.deepEqual(offered(), []);

  // ── The goat comes: each horn is taken on an action ──
  const called = of(step({ actorId: "hero", optionId: "use:0" }), "called");
  assert.equal(called[0]?.ids.length, 1, JSON.stringify(called));
  const goatId = called[0]!.ids[0]!;
  until("hero");
  assert.deepEqual(offered(), ["take:1", "take:2"]);
  step({ actorId: "hero", optionId: "take:2" });
  assert.equal(hero().budgets.action, 0, "taking a horn is an action");
  assert.deepEqual(hero().lentTaken, { 2: goatId });
  until("hero");
  assert.deepEqual(offered(), ["item:2", "take:1"]);
  const sword = hero().actions.find((one) => one.id === "item:2")!;
  assert.equal(sword.label, "Goat Horn Longsword");
  step({ actorId: "hero", optionId: "item:2", targetIds: ["brute"] });

  // ── The goat gone, so are the horns ──
  rulesetCombatant(state, goatId)!.dismissed = true;
  assert.deepEqual(offered(), []);

  // ── Refusals ──
  refused(document({ items: ["magic_items/goat-figurine"] }), /is not a weapon/);
  refused(document({ items: ["magic_items/nowhere"] }), /Unknown entry "magic_items\/nowhere"/);
  refused(document({ ...lends, takes: "nap" }), /Unknown budget "nap"/);
  {
    const doc = document();
    delete doc.catalogs.at(-1).entries[0].item.use.calls;
    refused(doc, /come with a "calls"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item use whose call lends weapons while it stands (use.wieldsWhileCalled) requires schemaVersion 2 and capabilityApi 1.739 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(738) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(739) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(738) as never, document(null)), gate);
  }

  console.log(
    "Wields while called: a goat of terror's horns are taken on an action once the goat stands, wielded, and gone with it; gated at 1.739.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
