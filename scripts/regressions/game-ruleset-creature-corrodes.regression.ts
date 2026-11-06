/**
 * Weapons that corrode on hitting a creature (Capability API 1.551).
 *
 *   - A rust monster's Rust Metal: a metal sword that hits it deals its damage, then deals 1 less from
 *     then on; the penalty is written back to its stack and read again in the next fight; at 5 the
 *     sword is destroyed, its blow gone, and the stack loses it.
 *   - A magical metal sword and a wooden club are spared.
 *   - Metal arrows that hit it are not won back; wooden ones are.
 *   - The install gate.
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
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-corrodes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 551);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const rust = { tags: ["metal"], sparesMagical: true as const, ammunition: true as const };
  const document = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "rust-monster",
        label: "Rust Monster",
        creature: {
          health: 27,
          defense: 14,
          initiativeModifier: 0,
          speed: 40,
          tier: "cr_5",
          actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 3, damage: { flat: 5 }, reach: 5 }],
          corrodesWeapons: rust,
        },
      });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const weapon = (tags: string[]): RulesetCatalogItem =>
    ({
      category: "gear",
      tags,
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
      },
    }) as RulesetCatalogItem;
  const bow = {
    category: "gear",
    attack: {
      budget: "action",
      toHit: { abilities: ["dex"] },
      damage: { dice: "1d8", abilities: ["dex"], type: "piercing" },
      range: { normal: 80 },
      ammo: { tag: "arrow", recover: 0.5 },
    },
  } as unknown as RulesetCatalogItem;
  const held = (name: string, item: RulesetCatalogItem, extra: Partial<RulesetSheetItem> = {}): RulesetSheetItem => ({
    name,
    quantity: 1,
    worn: true,
    item,
    stack: { id: name.toLowerCase().replace(/ /g, "-"), ref: `gear/${name.toLowerCase().replace(/ /g, "-")}` },
    ...extra,
  });
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
  });
  const monster: RulesetStatBlock = {
    health: 500,
    defense: 1,
    initiativeModifier: -20,
    actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    corrodesWeapons: rust,
  } as RulesetStatBlock;
  const fight = (items: RulesetSheetItem[]) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items },
        { id: "rust", name: "Rust Monster", side: "enemy", block: monster },
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  // Every d20 shows a 10, every other die a 2.
  const roll = (sides: number) => (sides === 20 ? 10 : 2);
  const swing = (state: RulesetEncounterState, label: string) => {
    state.turn = state.order.indexOf("hero");
    rulesetCombatant(state, "hero")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["rust"] },
      roll,
    );
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const dealt = (events: RulesetCombatEvent[]) => of(events, "damage").reduce((total, one) => total + one.dealt, 0);

  // ── It deals its damage, then less ──
  const first = swing(fight([held("Longsword", weapon(["metal"]))]), "Longsword");
  assert.equal(dealt(first.events), 2 + 3, "1d8+3 in full");
  assert.deepEqual(
    of(first.events, "corroded").map((one) => [one.label, one.penalty, one.destroyed]),
    [["Longsword", 1, undefined]],
  );
  const second = swing(first.state, "Longsword");
  assert.equal(dealt(second.events), 4, "1 less");

  // ── Written back to its stack, and read in the next fight ──
  const changes = rulesetFightItemChanges(undefined, second.state);
  assert.deepEqual(
    changes.map((one) => [one.stack.id, one.corroded, one.taken]),
    [["longsword", 2, 0]],
  );
  const stacks = normalizeGameInventoryStacks([
    { id: "longsword", name: "Longsword", item: "gear/longsword", quantity: 1 },
  ]);
  const written = applyRulesetFightItemChanges(stacks, changes);
  assert.equal(written?.stacks[0]?.corroded, 2);
  assert.equal(normalizeGameInventoryStacks(written!.stacks)[0]?.corroded, 2, "kept as it is read again");
  const later = swing(fight([held("Longsword", weapon(["metal"]), { corroded: 2 })]), "Longsword");
  assert.equal(dealt(later.events), 2 + 3 - 2, "the next fight reads it");

  // ── At 5 it is destroyed ──
  {
    const broken = swing(fight([held("Longsword", weapon(["metal"]), { corroded: 4 })]), "Longsword");
    assert.deepEqual(
      of(broken.events, "corroded").map((one) => [one.penalty, one.destroyed]),
      [[5, true]],
    );
    assert.ok(
      !rulesetCombatOptions(definition, broken.state, "hero").some((one) => one.label === "Longsword"),
      "its blow is gone",
    );
    const lost = rulesetFightItemChanges(undefined, broken.state);
    assert.deepEqual(
      lost.map((one) => [one.taken, one.broke]),
      [[1, true]],
    );
    const after = applyRulesetFightItemChanges(
      normalizeGameInventoryStacks([{ id: "longsword", name: "Longsword", item: "gear/longsword", quantity: 1 }]),
      lost,
    );
    assert.deepEqual(after?.stacks, [], "the stack loses it");
  }

  // ── Spared: a magical sword, a wooden club ──
  for (const [name, tags] of [
    ["Flame Blade", ["metal", "magical"]],
    ["Club", ["wood"]],
  ] as const) {
    const spared = swing(fight([held(name, weapon([...tags]))]), name);
    assert.deepEqual(of(spared.events, "corroded"), [], name);
    assert.equal(rulesetCombatant(spared.state, "hero")!.corroded, undefined);
  }

  // ── Metal arrows are not won back; wooden ones are ──
  for (const [tags, back] of [
    [["arrow", "metal"], 0],
    [["arrow", "wood"], 0.5],
  ] as const) {
    const arrows = { category: "gear", tags: [...tags] } as unknown as RulesetCatalogItem;
    const state = fight([held("Longbow", bow), held("Arrows", arrows, { quantity: 20, worn: false })]);
    const shot = swing(state, "Longbow");
    assert.equal(rulesetCombatant(shot.state, "hero")!.recoverable?.[1], back, tags.join(","));
    assert.equal(of(shot.events, "corroded").length, back ? 0 : 1);
    assert.equal(rulesetCombatant(shot.state, "hero")!.corroded, undefined, "the bow is not the arrow");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature that corrodes the weapons hitting it (corrodesWeapons) requires schemaVersion 2 and capabilityApi 1.551 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(550) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(551) as never, document()), gate);
  }

  console.log(
    "Corrodes weapons: a metal sword deals its damage then 1 less, kept on its stack into the next fight, destroyed at 5; magical and wooden ones are spared; metal arrows are not won back; gated at 1.551.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
