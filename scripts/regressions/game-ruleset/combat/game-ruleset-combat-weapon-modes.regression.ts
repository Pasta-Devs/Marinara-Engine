/**
 * Weapon modes of their own (Capability API 1.190): a javelin of lightning.
 *
 *   - A mode's `range` is how far it reaches, in place of the weapon's: aimed, rolled and refused by it.
 *   - Its `plus` clauses are added to a hit in that mode only.
 *   - Its `line` is a bolt everybody between the wielder and the target saves against first.
 *   - Its `charges` are the item's: spent by the attack, and the mode is not offered without them.
 *   - Import refusals, and the install gate.
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
  rulesetPathCells,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-weapon-modes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 185);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const bolt = {
    id: "bolt",
    label: "Bolt",
    range: { normal: 120 },
    plus: [{ dice: "4d6", type: "lightning" }],
    line: { dice: "4d6", type: "lightning", save: { save: "dex_save", difficulty: 13, onSuccess: "half" } },
    charges: 1,
  };
  const javelinItem = (mode: Record<string, unknown> = bolt, item: Record<string, unknown> = {}) =>
    ({
      category: "gear",
      slots: { hands: 1 },
      stack: 1,
      charges: { max: 1 },
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "1d6", abilities: ["str"], type: "piercing" },
        reach: 5,
        range: { normal: 20, long: 60 },
        modes: [mode],
      },
      ...item,
    }) as RulesetCatalogItem;
  const javelin = (charges?: number) =>
    ({
      name: "Javelin",
      quantity: 1,
      worn: true,
      item: javelinItem(),
      ...(charges !== undefined ? { charges } : {}),
    }) as RulesetSheetItem;
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
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
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
  });
  const creature = (id: string, dex = -20) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 200,
      defense: 5,
      initiativeModifier: -20,
      saves: { dex_save: dex },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    } as RulesetStatBlock,
  });
  const grid = (): TacticalGrid => ({
    width: 40,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(40).fill("plains")),
  });
  let d20 = 10;
  const roller = (sides: number) => (sides === 20 ? d20 : 2);
  const fight = (
    items: RulesetSheetItem[] = [javelin()],
    at: Record<string, { x: number; y: number }> = { foe: { x: 10, y: 5 }, mid: { x: 6, y: 5 }, off: { x: 6, y: 8 } },
    midDex = -20,
  ) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items },
        ...Object.keys(at).map((id) => creature(id, id === "mid" ? midDex : -20)),
      ],
      board: { grid: grid(), placements: { hero: { x: 2, y: 5 }, ...at } },
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const option = (state: RulesetEncounterState) => {
    const found = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Javelin");
    assert.ok(found, "no Javelin");
    return found;
  };
  const throwIt = (state: RulesetEncounterState, mode?: string, target = "foe") => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option(state).id, targetIds: [target], ...(mode ? { mode } : {}) },
      roller,
    );
    Object.assign(state, step.state);
    return step.events;
  };
  const damageTo = (events: RulesetCombatEvent[], id: string, type?: string) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .filter((one) => one.targetId === id && (type === undefined || one.damageType === type))
      .reduce((total, one) => total + one.dealt, 0);
  const attackOf = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "attack");
    assert.ok(event && event.type === "attack", JSON.stringify(events));
    return event;
  };

  // ── The path between two cells ──
  assert.deepEqual(rulesetPathCells({ x: 2, y: 5 }, { x: 6, y: 5 }), [
    { x: 3, y: 5 },
    { x: 4, y: 5 },
    { x: 5, y: 5 },
  ]);
  assert.deepEqual(rulesetPathCells({ x: 0, y: 0 }, { x: 3, y: 3 }), [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ]);
  assert.deepEqual(rulesetPathCells({ x: 0, y: 0 }, { x: 1, y: 0 }), [], "side by side, nothing between");

  // ── Hurled plainly: its own reach, no bolt ──
  {
    const state = fight();
    assert.deepEqual(
      option(state).modes?.map((mode) => mode.id),
      ["bolt"],
      "the bolt is offered while the charge is there",
    );
    const plain = throwIt(state);
    assert.equal(attackOf(plain).mode, "disadvantage", "40 feet is past the javelin's 20");
    assert.equal(damageTo(plain, "foe", "lightning"), 0);
    assert.equal(damageTo(plain, "mid"), 0, "nobody on the way is touched");
    assert.ok(!plain.some((one) => one.type === "uses"), "no charge spent");
  }

  // ── As a bolt ──
  {
    const state = fight();
    const events = throwIt(state, "bolt");
    assert.equal(attackOf(events).mode, "normal", "120 feet of its own: 40 is no long shot");
    assert.equal(attackOf(events).outcome, "hit");
    assert.equal(damageTo(events, "foe", "lightning"), 8, "4d6 more on the hit, every die a 2");
    assert.equal(damageTo(events, "foe", "piercing"), 6, "and the javelin's own 1d6 + 4");
    const saved = events.find((one) => one.type === "save");
    assert.ok(saved && saved.type === "save" && saved.actorId === "mid", "whoever stands between saves");
    assert.equal(damageTo(events, "mid", "lightning"), 8, "a failed save takes all of it");
    assert.equal(damageTo(events, "off"), 0, "off the line, untouched");
    assert.ok(!events.some((one) => one.type === "save" && one.actorId === "off"));
    assert.ok(!events.some((one) => one.type === "save" && one.actorId === "foe"), "the target makes no save");
    // The bolt goes off before the attack is rolled.
    assert.ok(
      events.findIndex((one) => one.type === "save") < events.findIndex((one) => one.type === "attack"),
      "the line first",
    );
    const used = events.find((one) => one.type === "uses");
    assert.ok(used && used.type === "uses" && used.left === 0 && used.of === 1, "its charge spent");
    assert.equal(who(state, "hero").charges?.[0], 0);
    // Spent, it is not offered, and asked for anyway it is refused.
    who(state, "hero").budgets.action = 1;
    assert.equal(option(state).modes, undefined, "no bolt without a charge");
    const again = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option(state).id, targetIds: ["foe"], mode: "bolt" },
      roller,
    );
    assert.ok(again.events.some((one) => one.type === "refused" && one.reason === "unknown-mode"));
    // A javelin whose stack kept no charge has no bolt either.
    assert.equal(option(fight([javelin(0)])).modes, undefined);
  }

  // ── Half on a made save ──
  {
    const events = throwIt(fight(undefined, undefined, 20), "bolt");
    assert.equal(damageTo(events, "mid", "lightning"), 4, "half of 8"); // A bolt that a made save turns aside entirely.
    const dodged = {
      name: "Javelin",
      quantity: 1,
      worn: true,
      item: javelinItem({ ...bolt, line: { ...bolt.line, save: { ...bolt.line.save, onSuccess: "none" } } }),
    } as RulesetSheetItem;
    assert.equal(damageTo(throwIt(fight([dodged], undefined, 20), "bolt"), "mid"), 0, "none of it");
    assert.equal(damageTo(throwIt(fight([dodged]), "bolt"), "mid", "lightning"), 8, "all of it on a failure");
    // Somebody standing a row below the run is off it.
    const below = throwIt(fight(undefined, { foe: { x: 10, y: 5 }, mid: { x: 6, y: 6 } }), "bolt");
    assert.equal(damageTo(below, "mid"), 0, "a row off the line");
    // An item that holds no charges never offers a mode that spends them.
    const uncharged = { name: "Javelin", quantity: 1, worn: true, item: javelinItem(bolt, { charges: undefined }) };
    assert.equal(option(fight([uncharged as RulesetSheetItem])).modes, undefined, "nothing to spend");
  }

  // ── Its own reach: far beyond the javelin's, within the bolt's ──
  {
    const far = { foe: { x: 22, y: 5 } };
    const plain = applyRulesetCombatChoice(
      definition,
      fight(undefined, far),
      { actorId: "hero", optionId: "item:0", targetIds: ["foe"] },
      roller,
    );
    assert.ok(
      plain.events.some((one) => one.type === "refused" && one.reason === "out-of-reach"),
      "100 feet: no",
    );
    const state = fight(undefined, far);
    assert.equal(attackOf(throwIt(state, "bolt")).outcome, "hit", "but the bolt reaches it");
    const beyond = applyRulesetCombatChoice(
      definition,
      fight(undefined, { foe: { x: 30, y: 5 } }),
      { actorId: "hero", optionId: "item:0", targetIds: ["foe"], mode: "bolt" },
      roller,
    );
    assert.ok(
      beyond.events.some((one) => one.type === "refused" && one.reason === "out-of-reach"),
      "140 feet: no",
    );
  }

  // ── The forecast reads the mode ──
  {
    const state = fight();
    const javelinOption = option(state);
    const boltForecast = javelinOption.modes?.find((mode) => mode.id === "bolt")?.forecast;
    assert.ok(boltForecast && javelinOption.forecast);
    assert.ok((boltForecast.hitChance ?? 0) > (javelinOption.forecast.hitChance ?? 0), "no long-shot penalty");
    assert.ok((boltForecast.averageDamage ?? 0) > (javelinOption.forecast.averageDamage ?? 0), "and 4d6 more");
  }

  // ── Refusals ──
  {
    const withItem = (item: RulesetCatalogItem) =>
      document((doc) => {
        doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [{ id: "j", label: "J", item }] });
      });
    parse(withItem(javelinItem()));
    refused(
      withItem(javelinItem({ ...bolt, line: { ...bolt.line, save: { ...bolt.line.save, save: "luck" } } })),
      /Unknown save "luck"/,
    );
    refused(withItem(javelinItem({ ...bolt, line: { ...bolt.line, type: "sorrow" } })), /Unknown damage type/);
    refused(withItem(javelinItem({ ...bolt, line: { save: bolt.line.save } })), /A line deals dice/);
    refused(withItem(javelinItem({ ...bolt, plus: [{ dice: "1d6", type: "sorrow" }] })), /Unknown damage type/);
    refused(withItem(javelinItem({ ...bolt, range: { normal: 120, long: 60 } })), /at least the ordinary one/);
    refused(
      withItem(javelinItem(bolt, { charges: undefined, stack: undefined })),
      /A mode that spends charges is on an item that holds some/,
    );
    // A javelin whose only spender is its mode may hold charges.
    const { use: _use, ...plainItem } = javelinItem() as RulesetCatalogItem & { use?: unknown };
    parse(withItem(plainItem));
    refused(
      withItem(javelinItem({ id: "bolt", label: "Bolt" })),
      /charges are spent by its use, its weapon's slay, one of its weapon's modes or its hits/,
    );
  }

  // ── The gate ──
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
    const gate =
      "A ruleset with weapon modes that reach their own distance, add damage, send a bolt along the way, or spend charges requires schemaVersion 2 and capabilityApi 1.190 or newer";
    const withMode = (mode: Record<string, unknown>) => {
      const doc = JSON.parse(fiveE);
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [{ id: "j", label: "J", item: javelinItem({ id: "m", label: "M", ...mode }) }],
      });
      return doc;
    };
    for (const [label, mode] of [
      ["range", { range: { normal: 120 } }],
      ["plus", { plus: bolt.plus }],
      ["line", { line: bolt.line }],
      ["charges", { charges: 1 }],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(189) as never, withMode(mode)), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(190) as never, withMode(mode)), gate, label);
    }
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(189) as never, withMode({ toHit: 1 })),
      gate,
      "an older mode",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(189) as never, JSON.parse(fiveE)), gate, "plain 5e");
  }

  console.log(
    "Ruleset weapon modes: a javelin of lightning's bolt reaches 120 feet, strikes everybody on the way, adds its lightning to the hit and spends its charge.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
