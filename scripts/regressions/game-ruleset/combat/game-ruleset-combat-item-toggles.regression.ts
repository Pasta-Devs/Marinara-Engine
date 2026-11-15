/** An item's switch (Capability API 1.170): a flame tongue turned on with a bonus action deals its
 *  fire only while it is on, and the stack keeps it on between fights. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addToGameInventoryNamed,
  applyGameInventoryOps,
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  rulesetAverageDamage,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemAttackText,
  rulesetItemFacts,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type GameInventoryItemRules,
  type GameInventoryStack,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-toggles-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 165);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const tongueItem = {
    category: "gear",
    toggle: { label: "Flames", budget: "bonus" },
    attack: {
      budget: "action",
      toHit: { abilities: ["str"] },
      damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
      plus: [{ dice: "2d6", type: "fire", when: "toggled" }],
    },
  } as RulesetCatalogItem;
  const tongue = (extra: Partial<RulesetSheetItem> = {}): RulesetSheetItem => ({
    name: "Flame Tongue",
    quantity: 1,
    worn: true,
    item: tongueItem,
    stack: { id: "s1", ref: "gear/tongue" },
    ...extra,
  });
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
  });
  const fight = (items: RulesetSheetItem[]) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items },
        {
          id: "wolf",
          name: "wolf",
          side: "enemy",
          block: {
            health: 200,
            defense: 5,
            initiativeModifier: -20,
            actions: [
              { id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } },
            ],
          },
        },
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const optionsOf = (state: RulesetEncounterState) => rulesetCombatOptions(definition, state, "hero");
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = optionsOf(state).find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${optionsOf(state).map((one) => one.label)}`);
    return option;
  };
  // Every d20 shows a 10, every other die a 2.
  const roll = (sides: number) => (sides === 20 ? 10 : 2);
  const choose = (state: RulesetEncounterState, label: string, targetIds: string[] = []) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: optionOf(state, label).id, targetIds },
      roll,
    );
  const dealt = (events: RulesetCombatEvent[]) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .reduce((total, one) => total + one.dealt, 0);

  // Off, the blade is a plain blade; the switch is offered on its budget.
  {
    const state = fight([tongue()]);
    const option = optionOf(state, "Flame Tongue: Flames");
    assert.equal(option.kind, "switch");
    assert.equal(option.budget, "bonus");
    assert.equal(option.on, false);
    assert.equal(optionOf(state, "Flame Tongue").forecast?.averageDamage, 4.5 + 4, "the forecast leaves the fire out");
    assert.equal(dealt(choose(state, "Flame Tongue", ["wolf"]).events), 2 + 4, "1d8+4 and no fire");
  }

  // Turned on, it spends the bonus action and the next hit burns.
  {
    const before = fight([tongue()]);
    const switched = choose(before, "Flame Tongue: Flames");
    assert.ok(switched.events.some((one) => one.type === "switch" && one.on === true));
    const hero = rulesetCombatant(switched.state, "hero")!;
    assert.equal(hero.on?.[0], true);
    assert.equal(hero.budgets.bonus ?? 0, 0, "the switch spent the bonus action");
    assert.equal(optionOf(switched.state, "Flame Tongue").forecast?.averageDamage, 4.5 + 4 + 7, "and counts the fire");
    const struck = choose(switched.state, "Flame Tongue", ["wolf"]);
    assert.equal(dealt(struck.events), 2 + 4 + 4, "1d8+4 and 2d6 fire");
    assert.ok(struck.events.some((one) => one.type === "damage" && one.damageType === "fire"));

    // The fight writes it back to the stack, which keeps it.
    const changes = rulesetFightItemChanges(before, struck.state);
    assert.deepEqual(
      changes.map((one) => one.on),
      [true],
    );
    const stacks: GameInventoryStack[] = normalizeGameInventoryStacks([
      { id: "s1", name: "Flame Tongue", item: "gear/tongue", quantity: 1 },
    ]);
    const written = applyRulesetFightItemChanges(stacks, changes)!;
    assert.equal(written.stacks[0]!.on, true);
    assert.equal(normalizeGameInventoryStacks(JSON.parse(JSON.stringify(written.stacks)))[0]!.on, true);
  }

  // A stack left on starts the next fight on, and turning it off stops the fire.
  {
    const state = fight([tongue({ on: true })]);
    assert.equal(optionOf(state, "Flame Tongue: Flames").on, true);
    const off = choose(state, "Flame Tongue: Flames");
    assert.ok(off.events.some((one) => one.type === "switch" && one.on === false));
    assert.equal(dealt(choose(off.state, "Flame Tongue", ["wolf"]).events), 2 + 4);
    assert.deepEqual(
      rulesetFightItemChanges(state, off.state).map((one) => one.on),
      [false],
    );
  }

  // A switch is on only one item: none for a stack of two.
  assert.ok(!optionsOf(fight([tongue({ quantity: 2 })])).some((one) => one.kind === "switch"));

  // An average that nobody aimed leaves the toggled clause out.
  assert.equal(
    rulesetAverageDamage({ count: 1, sides: 8, flat: 0, plus: [{ count: 2, sides: 6, flat: 0, whileOn: 0 }] }),
    4.5,
  );

  // The inventory's switch.
  {
    const rules = {
      itemNamed: () => undefined,
      itemOf: (item: string) => (item === "gear/tongue" ? { toggle: { label: "Flames" } } : {}),
      offers: () => true,
    } as unknown as GameInventoryItemRules;
    const stacks = normalizeGameInventoryStacks([
      { id: "s1", name: "Flame Tongue", item: "gear/tongue", quantity: 1 },
      { id: "s2", name: "Flame Tongue", item: "gear/tongue", quantity: 2, holder: "Ann" },
      { id: "s3", name: "Club", item: "gear/club", quantity: 1 },
    ]);
    const on = applyGameInventoryOps(stacks, [{ op: "switch", id: "s1", on: true }], undefined, rules);
    assert.deepEqual(on.results, [{ ok: true, id: "s1" }]);
    assert.equal(on.stacks.find((one) => one.id === "s1")!.on, true);
    const off = applyGameInventoryOps(on.stacks, [{ op: "switch", id: "s1", on: false }], undefined, rules);
    // One switched on stays one item: more of it goes beside it, unswitched.
    const more = applyGameInventoryOps(on.stacks, [{ op: "set", id: "s1", quantity: 3 }], undefined, rules).stacks;
    assert.deepEqual(
      more.filter((one) => one.item === "gear/tongue" && !one.holder).map((one) => [one.quantity, one.on]),
      [
        [1, true],
        [2, undefined],
      ],
    );
    // A spent one keeps its own charges; the one added beside it is fresh.
    const spent = on.stacks.map((one) => (one.id === "s1" ? { ...one, charges: 1, loaded: 0 } : one));
    const fresh = applyGameInventoryOps(spent, [{ op: "set", id: "s1", quantity: 2 }], undefined, rules).stacks;
    assert.deepEqual(
      fresh
        .filter((one) => one.item === "gear/tongue" && !one.holder)
        .map((one) => [one.quantity, one.on, one.charges, one.loaded]),
      [
        [1, true, 1, 0],
        [1, undefined, undefined, undefined],
      ],
    );
    const added = addToGameInventoryNamed(on.stacks, "Flame Tongue", 1, () => "s4")!.stacks;
    assert.deepEqual(
      added.filter((one) => one.item === "gear/tongue" && !one.holder).map((one) => [one.quantity, one.on]),
      [
        [1, true],
        [1, undefined],
      ],
    );
    assert.equal(off.stacks.find((one) => one.id === "s1")!.on, undefined);
    assert.deepEqual(
      applyGameInventoryOps(stacks, [{ op: "switch", id: "s2", on: true }], undefined, rules).results,
      [{ ok: false, reason: "refused" }],
      "not on a stack of two",
    );
    assert.deepEqual(
      applyGameInventoryOps(stacks, [{ op: "switch", id: "s3", on: true }], undefined, rules).results,
      [{ ok: false, reason: "refused" }],
      "not on an item without one",
    );
  }

  // What the item says.
  {
    const facts = rulesetItemFacts(definition, tongueItem);
    assert.match(rulesetItemAttackText(facts.attack!), /\+2d6 fire while Flames is on/);
    assert.equal(facts.toggle?.label, "Flames");
  }

  // Import refusals.
  {
    const refused = (item: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        document((doc) => {
          doc.catalogs.push({ id: "gear", label: "Gear", entries: [{ id: "blade", label: "Blade", item }] });
        }),
      );
      assert.ok(!result.ok, `must refuse ${pattern}`);
      assert.match(result.issues.join("; "), pattern);
    };
    refused({ ...tongueItem, toggle: { label: "Flames", budget: "nap" } }, /Unknown budget "nap"/);
    const { toggle: _, ...noSwitch } = tongueItem as RulesetCatalogItem & { toggle: unknown };
    refused(noSwitch, /toggle/);
  }

  // The gate.
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
    const gate = "A ruleset whose items switch on and off requires schemaVersion 2 and capabilityApi 1.170 or newer";
    const withItem = (item: Record<string, unknown>) =>
      document((doc) => {
        doc.catalogs.push({ id: "gear", label: "Gear", entries: [{ id: "blade", label: "Blade", item }] });
      });
    const lantern = { category: "gear", toggle: { label: "Lit", budget: "action" } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(169) as never, withItem(lantern)), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(169) as never, withItem(tongueItem as never)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(170) as never, withItem(tongueItem as never)), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(169) as never, withItem({ category: "gear" })),
      gate,
      "nothing without the keys",
    );
  }

  console.log(
    "Item toggles: a flame tongue switched on its bonus action burns only while on, kept on its stack, gated at 1.170.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
