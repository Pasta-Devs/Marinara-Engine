/**
 * An item that hovers (Capability API 1.706): 5e's Animated Shield, "it hovers in your space to
 * protect you as if you were wielding it, leaving your hands free".
 *
 *   - Beside a shield, a versatile longsword deals its one-handed die; with the shield switched on
 *     to hover it deals its versatile die, and back again when it goes off.
 *   - It goes off by itself after its `rounds` of its holder's turns, and as the fight ends.
 *   - Going off with no room for it (a greatsword in both hands), it falls.
 *   - The inventory has room for a greatsword while it hovers.
 *   - Refused on an item that takes no slots; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyGameInventoryOps,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type GameInventoryItemRules,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-slots-freed-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 706);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shieldItem = {
    category: "gear",
    slots: { hand: 1 },
    toggle: { label: "Animate", budget: "bonus", freesSlots: true, rounds: 2 },
  } as RulesetCatalogItem;
  const longswordItem = {
    category: "gear",
    slots: { hand: 1 },
    attack: {
      budget: "action",
      toHit: { abilities: ["str"] },
      damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
      versatile: { dice: "1d10" },
    },
  } as RulesetCatalogItem;
  const greatswordItem = {
    category: "gear",
    slots: { hand: 2 },
    attack: {
      budget: "action",
      toHit: { abilities: ["str"] },
      damage: { dice: "2d6", abilities: ["str"], type: "slashing" },
    },
  } as RulesetCatalogItem;
  const held = (name: string, item: RulesetCatalogItem, id: string, extra: Partial<RulesetSheetItem> = {}) =>
    ({ name, quantity: 1, worn: true, item, stack: { id, ref: `gear/${id}` }, ...extra }) as RulesetSheetItem;
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
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
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const options = rulesetCombatOptions(definition, state, "hero");
    const option = options.find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${options.map((one) => one.label)}`);
    return option;
  };
  const roll = (sides: number) => (sides === 20 ? 10 : 2);
  const choose = (state: RulesetEncounterState, label: string, targetIds: string[] = []) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: optionOf(state, label).id, targetIds },
      roll,
    );
  const sword = (state: RulesetEncounterState) => optionOf(state, "Longsword").forecast?.averageDamage;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  // ── The longsword beside the shield, then with it hovering ──
  const start = fight([held("Longsword", longswordItem, "longsword"), held("Animated Shield", shieldItem, "shield")]);
  assert.equal(sword(start), 4.5 + 4, "one hand: 1d8+4");
  const on = choose(start, "Animated Shield: Animate");
  assert.ok(of(on.events, "switch").some((one) => one.on));
  assert.deepEqual(rulesetCombatant(on.state, "hero")!.onFor, { 1: 2 });
  assert.equal(sword(on.state), 5.5 + 4, "hands free: 1d10+4");
  assert.deepEqual(
    rulesetFightItemChanges(start, on.state).map((one) => one.on),
    [true],
  );

  // ── It goes off after two of the hero's turns, the longsword one-handed again ──
  {
    let state = on.state;
    const events: RulesetCombatEvent[] = [];
    for (let at = 0; at < 3; at += 1) {
      const step = advanceRulesetTurn(definition, state, roll);
      state = step.state;
      events.push(...step.events);
      if (at < 2) assert.equal(rulesetCombatant(state, "hero")!.on?.[1], true, `still on after ${at + 1}`);
    }
    assert.equal(rulesetCombatant(state, "hero")!.on?.[1], false);
    assert.equal(rulesetCombatant(state, "hero")!.onFor, undefined);
    assert.deepEqual(of(events, "letFall"), [], "room in a hand for it");
    state.turn = state.order.indexOf("hero");
    assert.equal(sword(state), 4.5 + 4);
  }

  // ── Turned off by hand: the longsword one-handed again, the clock gone ──
  {
    const again = structuredClone(on.state);
    rulesetCombatant(again, "hero")!.budgets = { ...rulesetCombatant(start, "hero")!.budgets };
    const off = choose(again, "Animated Shield: Animate");
    assert.ok(of(off.events, "switch").some((one) => !one.on));
    assert.equal(rulesetCombatant(off.state, "hero")!.onFor, undefined);
  }

  // ── Left on with a greatsword in both hands: it falls when its time is up ──
  {
    let state = fight([
      held("Greatsword", greatswordItem, "greatsword"),
      held("Animated Shield", shieldItem, "shield", { on: true }),
    ]);
    assert.deepEqual(rulesetCombatant(state, "hero")!.onFor, { 1: 2 }, "its clock starts with the fight");
    const events: RulesetCombatEvent[] = [];
    for (let at = 0; at < 3; at += 1) {
      const step = advanceRulesetTurn(definition, state, roll);
      state = step.state;
      events.push(...step.events);
    }
    assert.deepEqual(
      of(events, "letFall").map((one) => one.labels),
      [["Animated Shield"]],
    );
    assert.ok(rulesetCombatant(state, "hero")!.dropped?.some((one) => one.key === "item:1"));
  }

  // ── The inventory has room for the greatsword while the shield hovers ──
  {
    const rules = {
      itemNamed: () => undefined,
      itemOf: (item: string) =>
        item === "gear/shield"
          ? { slots: { hand: 1 }, toggle: { label: "Animate", freesSlots: true } }
          : item === "gear/greatsword"
            ? { slots: { hand: 2 } }
            : {},
      slots: [{ id: "hand", label: "Hand", count: 2 }],
      offers: () => true,
    } as unknown as GameInventoryItemRules;
    const stacks = normalizeGameInventoryStacks([
      { id: "s1", name: "Animated Shield", item: "gear/shield", quantity: 1, equipped: true },
      { id: "s2", name: "Greatsword", item: "gear/greatsword", quantity: 1 },
    ]);
    assert.deepEqual(applyGameInventoryOps(stacks, [{ op: "equip", id: "s2" }], undefined, rules).results, [
      { ok: false, reason: "no-slot" },
    ]);
    const hovering = stacks.map((one) => (one.id === "s1" ? { ...one, on: true as const } : one));
    assert.deepEqual(applyGameInventoryOps(hovering, [{ op: "equip", id: "s2" }], undefined, rules).results, [
      { ok: true, id: "s2" },
    ]);
  }

  // ── Refused on an item that takes no slots ──
  {
    const result = parseRulesetDefinition(
      document((doc) => {
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          entries: [{ id: "charm", label: "Charm", item: { ...shieldItem, slots: undefined } }],
        });
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /frees its slots while on takes some/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item switch that frees its slots or stays on only so long (toggle.freesSlots or toggle.rounds) requires schemaVersion 2 and capabilityApi 1.706 or newer";
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
    const withShield = (toggle: Record<string, unknown>) =>
      document((doc) => {
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          entries: [{ id: "shield", label: "Shield", item: { ...shieldItem, toggle } }],
        });
      });
    assert.equal(getCapabilityPackageInstallIssue(manifest(705) as never, withShield(shieldItem.toggle!)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(706) as never, withShield(shieldItem.toggle!)), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(705) as never, withShield({ label: "Animate", budget: "bonus" })),
      gate,
    );
  }

  console.log(
    "Slots freed: the hovering shield frees a hand for the longsword's versatile die, goes off after its rounds, falls with no room, leaves the inventory room; gated at 1.706.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
