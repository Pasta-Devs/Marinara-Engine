/**
 * Items a cast makes (Capability API 1.721): 5e's Goodberry.
 *
 *   - A character's entry with `makesItems` puts that many of the item into their hand as it is cast;
 *     each is used there by the item's own `use`, and what is left is written to their bag.
 *   - Into a stack of it they already carry, where they carry one.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-makes-items-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 721);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (makes: unknown = { item: "food/goodberry", count: 10 }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "food", label: "Food" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.catalogs.push(
      {
        id: "food",
        label: "Food",
        holds: "items",
        entries: [
          {
            id: "goodberry",
            label: "Goodberry",
            item: {
              category: "food",
              use: { kind: "heal", targets: "self", budget: "action", amount: { flat: 1 }, consumes: true },
            },
          },
        ],
      },
      {
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [
          {
            id: "goodberry",
            label: "Goodberry",
            rows: [{ list: "spells", values: { name: "Goodberry", level: 1, prepared: true } }],
            mechanics: { kind: "utility", targets: "self", budget: "action", makesItems: makes },
          },
        ],
      },
    );
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const spells = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const berry = definition.catalogs!.find((catalog) => catalog.id === "food")!.entries![0]!.item as RulesetCatalogItem;
  const block = (): RulesetStatBlock =>
    ({ health: 20, defense: 10, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (items: RulesetSheetItem[] = [], bag: { holder?: string | null } = { holder: "Druid" }) => {
    const holder = bag.holder;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: { pools: { hp: { value: 15 } } },
          catalogs: { spells },
          items,
          ...(holder !== undefined ? { holder } : {}),
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    state.order = ["druid", "foe"];
    state.turn = 0;
    return state;
  };
  const choose = (state: RulesetEncounterState, label: string) => {
    rulesetCombatant(state, "druid")!.budgets.action = 1;
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "druid").find(
      (one) => one.label.startsWith(label) && !one.id.startsWith("use:"),
    );
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "druid").map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "druid", optionId: option.id, targetIds: ["druid"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const eatOffered = (state: RulesetEncounterState) => {
    rulesetCombatant(state, "druid")!.budgets.action = 1;
    state.turn = 0;
    return rulesetCombatOptions(definition, state, "druid").some((one) => one.id.startsWith("use:"));
  };

  // ── Cast: ten berries in hand, each eaten heals 1, the rest written to the bag ──
  {
    const start = fight();
    assert.equal(eatOffered(start), false, "nothing to eat before the cast");
    const cast = choose(start, "Goodberry");
    assert.deepEqual(of(cast.events, "itemsMade"), [
      { type: "itemsMade", actorId: "druid", label: "Goodberry", count: 10 },
    ]);
    assert.equal(eatOffered(cast.state), true, "a berry to eat");
    const eat = (state: RulesetEncounterState) => {
      rulesetCombatant(state, "druid")!.budgets.action = 1;
      state.turn = 0;
      const option = rulesetCombatOptions(definition, state, "druid").find((one) => one.id.startsWith("use:"))!;
      return applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "druid", optionId: option.id, targetIds: ["druid"] },
        () => 10,
      );
    };
    const ate = eat(cast.state);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(ate.state, "druid")!).value, 16);
    const changes = rulesetFightItemChanges(start, ate.state);
    assert.equal(changes.length, 1);
    assert.equal(changes[0]!.taken, -9);
    assert.deepEqual(changes[0]!.stack, { id: "st-made-druid-food-goodberry", ref: "food/goodberry", holder: "Druid" });
    const written = applyRulesetFightItemChanges([], changes)!;
    assert.deepEqual(written.stacks, [
      { id: "st-made-druid-food-goodberry", name: "Goodberry", item: "food/goodberry", quantity: 9, holder: "Druid" },
    ]);
    // The player's own: no holder.
    const own = choose(fight([], { holder: null }), "Goodberry");
    assert.equal(rulesetFightItemChanges(undefined, own.state)[0]!.stack.holder, undefined);
    // Whose bag unknown: used in the fight, written nowhere.
    const nowhere = choose(fight([], {}), "Goodberry");
    assert.equal(eatOffered(nowhere.state), true);
    assert.deepEqual(rulesetFightItemChanges(undefined, nowhere.state), []);
  }

  // ── Into a stack they already carry ──
  {
    const carried: RulesetSheetItem = {
      item: berry,
      quantity: 2,
      worn: false,
      name: "Goodberry",
      stack: { id: "st-1", ref: "food/goodberry", holder: "Druid" },
    };
    const start = fight([carried]);
    assert.equal(rulesetCombatant(start, "druid")!.sheet!.items!.length, 1, "no second place for it");
    const cast = choose(start, "Goodberry");
    const changes = rulesetFightItemChanges(start, cast.state);
    assert.deepEqual(
      changes.map((one) => [one.stack.id, one.taken]),
      [["st-1", -10]],
    );
  }

  // ── Refusals and the install gate ──
  {
    refused(fiveE({ item: "food/nothing", count: 10 }), /Unknown entry "food\/nothing"/);
    refused(fiveE({ item: "spells/goodberry", count: 10 }), /"spells\/goodberry" is not an item/);
    refused(fiveE({ item: "food/goodberry", count: 0 }), /makesItems/);
    const gate =
      "A ruleset with an entry that makes items (makesItems) requires schemaVersion 2 and capabilityApi 1.721 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(720) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(721) as never, fiveE()), gate);
  }

  console.log(
    "Goodberry: ten berries into the caster's hand, each eaten heals 1, the rest written to their bag or the stack they carry; gated at 1.721.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
