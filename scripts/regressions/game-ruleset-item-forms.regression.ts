/**
 * An item that changes form (Capability API 1.575): a Rod of Lordly Might.
 *
 *   - `forms`: in a fight, its holder turns it into another form on its budget, and it strikes as
 *     that form's item from then; turned back, it strikes as it was made. The form goes back to its
 *     stack after the fight, and a sheet reads the stack in that form.
 *   - The inventory turns it, one item only, and only into a form it has.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyGameInventoryOps,
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  rulesetSheetItems,
  supportedCapabilityApi,
  type GameInventoryItemRules,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-forms-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 575);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const forms = {
    label: "Mace",
    budget: "bonus",
    into: [
      { label: "Flame tongue", item: "gear/tongue" },
      { label: "Battering ram", item: "gear/ram" },
    ],
  };
  const document = (edit: (rod: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    const rod: Record<string, any> = {
      category: "gear",
      slots: { hands: 1 },
      stack: 1,
      attack: { budget: "action", toHit: { bonus: 3 }, damage: { dice: "1d6", bonus: 3 } },
      forms: structuredClone(forms),
    };
    edit(rod);
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        { id: "rod", label: "Rod of Lordly Might", item: rod },
        {
          id: "tongue",
          label: "Flame Tongue",
          item: {
            category: "gear",
            slots: { hands: 1 },
            stack: 1,
            attack: { budget: "action", toHit: { bonus: 0 }, damage: { dice: "1d6", bonus: 20 } },
          },
        },
        { id: "ram", label: "Ram", item: { category: "gear", slots: { hands: 2 }, stack: 1 } },
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const entries: Record<string, RulesetCatalogEntry[]> = {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  };
  const book = rulesetItemBook(definition, entries);
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
    lists: {},
  });
  const foe = (): RulesetStatBlock =>
    ({ health: 200, defense: 1, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (stacks: GameInventoryStack[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: (sides: number) => (sides === 20 ? 15 : 1),
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: {},
          items: rulesetSheetItems(book, stacks, undefined),
          catalogs: entries,
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: foe() },
      ],
    });
    state.order = ["hero", "ogre"];
    state.turn = 0;
    return state;
  };
  const choose = (state: RulesetEncounterState, label: string, targetIds: string[] = []) => {
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "hero").map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds },
      (sides: number) => (sides === 20 ? 15 : 1),
    );
    assert.ok(!step.events.some((one) => one.type === "refused"), JSON.stringify(step.events));
    return step;
  };
  const hpOf = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, "ogre")!).value;
  const stacks: GameInventoryStack[] = [
    { id: "st", name: "Rod of Lordly Might", item: "gear/rod", quantity: 1, equipped: true },
  ];

  // ── In a fight: made a flame tongue on the bonus action, it strikes as one ──
  {
    const state = fight(stacks);
    const labels = rulesetCombatOptions(definition, state, "hero").map((one) => one.label);
    assert.ok(labels.includes("Rod of Lordly Might: Flame tongue"), labels.join(", "));
    assert.ok(!labels.includes("Rod of Lordly Might: Mace"), "not into what it is now");
    const turned = choose(state, "Rod of Lordly Might: Flame tongue");
    const said = turned.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "reformed" }> => one.type === "reformed",
    );
    assert.deepEqual([said?.label, said?.form], ["Rod of Lordly Might", "Flame tongue"]);
    assert.equal(rulesetCombatant(turned.state, "hero")!.budgets.bonus, 0, "its bonus action spent");
    // Back to a mace is what it may turn into now, once a bonus action is there again.
    const now = rulesetCombatant(turned.state, "hero")!.actions.map((one) => one.id);
    assert.ok(now.includes("form:0:0") && !now.includes("form:0:1"), now.join(", "));
    const before = hpOf(turned.state);
    const struck = choose(turned.state, "Rod of Lordly Might", ["ogre"]);
    assert.equal(before - hpOf(struck.state), 21, "the flame tongue's 1 + 20");
    // Its form goes back to the stack.
    const changes = rulesetFightItemChanges(state, struck.state);
    assert.equal(changes[0]?.form, 1);
    const written = applyRulesetFightItemChanges(stacks, changes)!;
    const kept = normalizeGameInventoryStacks(JSON.parse(JSON.stringify(written.stacks)))[0]!;
    assert.equal(kept.form, 1);
    // And the next fight reads it in that form, and turns it back.
    const next = fight([kept]);
    const backLabels = rulesetCombatOptions(definition, next, "hero").map((one) => one.label);
    assert.ok(backLabels.includes("Rod of Lordly Might: Mace"), backLabels.join(", "));
    const back = choose(next, "Rod of Lordly Might: Mace");
    const mace = hpOf(back.state);
    const hit = choose(back.state, "Rod of Lordly Might", ["ogre"]);
    assert.equal(mace - hpOf(hit.state), 4, "the mace's 1 + 3");
    const undone = applyRulesetFightItemChanges([kept], rulesetFightItemChanges(next, hit.state))!;
    assert.equal(normalizeGameInventoryStacks(JSON.parse(JSON.stringify(undone.stacks)))[0]!.form, undefined);
  }

  // ── The inventory turns it, into a form it has ──
  {
    const rules = {
      itemNamed: () => undefined,
      itemOf: (item: string) => (item === "gear/rod" ? { forms: ["Mace", "Flame tongue", "Battering ram"] } : {}),
      offers: () => true,
    } as unknown as GameInventoryItemRules;
    const ram = applyGameInventoryOps(stacks, [{ op: "form", id: "st", form: 2 }], undefined, rules);
    assert.equal(ram.results[0]?.ok, true);
    assert.equal(ram.stacks[0]!.form, 2);
    assert.equal(
      applyGameInventoryOps(ram.stacks, [{ op: "form", id: "st", form: 0 }], undefined, rules).stacks[0]!.form,
      undefined,
    );
    assert.equal(
      applyGameInventoryOps(stacks, [{ op: "form", id: "st", form: 3 }], undefined, rules).results[0]?.ok,
      false,
    );
    assert.ok(!rulesetSheetItems(book, ram.stacks, undefined)[0]!.item.attack, "a ram strikes as nothing");
  }

  // ── Refusals ──
  refused(
    document((rod) => (rod.forms.into[0].item = "gear/rod")),
    /An item changes into other items/,
  );
  refused(
    document((rod) => (rod.forms.into[0].item = "gear/axe")),
    /Unknown item "gear\/axe"/,
  );
  refused(
    document((rod) => (rod.stack = 2)),
    /An item that changes form is one to a stack/,
  );
  refused(
    document((rod) => (rod.forms.budget = "breath")),
    /Unknown budget "breath"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item that changes form (forms) requires schemaVersion 2 and capabilityApi 1.575 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(574) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(575) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(574) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Item forms: a rod turned into a flame tongue on its bonus action strikes as one, keeps that form on its stack, turns back; the inventory turns it too; gated at 1.575.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
