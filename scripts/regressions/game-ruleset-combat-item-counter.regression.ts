/**
 * An item's use at its own level, and one that stops what it answers (Capability API 1.730): a scroll
 * of Counterspell.
 *
 *   - An item's `use.level` is the level it casts at: what reads an entry's paid level reads it.
 *   - A `"utility"` use may be a `reaction` that cancels, with `upTo: "paid"` and `above` as a
 *     catalog entry's Counterspell (1.116): it stops a spell at or below its level outright, a higher
 *     one on its reader's check against 10 plus that level.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemUseSchema,
  rulesetPaidLevel,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-counter-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 730);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(JSON.parse(fiveEText));
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  const scrollUse = (extra: Record<string, unknown> = {}) => ({
    kind: "utility",
    budget: "reaction",
    consumes: true,
    level: 3,
    reaction: {
      on: "used",
      cancels: true,
      against: { catalogs: ["spells"] },
      upTo: "paid",
      above: { check: { abilityModFromField: "spellcasting_ability" }, dc: 10 },
    },
    ...extra,
  });
  const scroll = (use: Record<string, unknown> = scrollUse()): RulesetSheetItem =>
    ({ name: "Scroll of Counterspell", quantity: 1, worn: false, item: { category: "gear", use } }) as never;
  const bolt = {
    id: "bolt",
    label: "Bolt",
    rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      amount: { flat: 3 },
      damageType: "fire",
      cost: [{ pool: "slots_1", amount: 1 }],
      perCostStep: { flat: 1 },
    },
  } as unknown as RulesetCatalogEntry;
  const sheet = (int: number, spells: RulesetCatalogEntry[]) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 10, con: 12, int, wis: 12, cha: 10 },
      fields: {
        level: 9,
        ac: 12,
        speed: 30,
        hp_max: 40,
        spellcasting_ability: "int",
        slots_max_1: 4,
        slots_max_2: 3,
        slots_max_3: 3,
        slots_max_4: 3,
        slots_max_5: 1,
      },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  /** The mage casts; Corwin, Int 18, reads the scroll. */
  const fight = (item: RulesetSheetItem = scroll()): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells: [bolt] },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "enemy",
          block: { sheet: sheet(16, [bolt]), actions: [] },
        } as RulesetCombatantInput,
        { id: "corwin", name: "Corwin", side: "party", build: sheet(18, []), live: {}, items: [item] },
      ],
    });
    state.order = ["mage", "corwin"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, payWith?: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((entry) => entry.label === "Bolt");
    assert.ok(option, "the mage has its bolt");
    const held = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["corwin"], ...(payWith ? { payWith } : {}) },
      dice(),
    );
    assert.ok(held.state.window, JSON.stringify(held.events));
    return held;
  };
  const read = (held: ReturnType<typeof cast>, ...faces: number[]) => {
    const option = rulesetWindowOptions(definition, held.state, "corwin").find(
      (entry) => entry.label === "Scroll of Counterspell",
    );
    assert.ok(option, "Corwin may read the scroll");
    return applyRulesetCombatChoice(
      definition,
      held.state,
      { actorId: "corwin", optionId: option.id, targetIds: [], window: held.state.window!.id },
      dice(...faces),
    );
  };

  // ── Its level ──
  {
    const state = fight();
    const corwin = rulesetCombatant(state, "corwin")!;
    const action = corwin.actions.find((one) => one.label === "Scroll of Counterspell")!;
    assert.equal(rulesetPaidLevel(definition, corwin, action), 3, "the level it casts at");
    assert.deepEqual(action.reaction?.above, { modifier: 4, dc: 10 }, "its reader's check");
  }
  // ── At or below it, stopped outright, and the scroll is gone ──
  for (const payWith of [undefined, "slots_3"]) {
    const stopped = read(cast(fight(), payWith));
    assert.deepEqual(of(stopped.events, "counter"), [], "no roll");
    assert.equal(of(stopped.events, "cancelled").length, 1);
    assert.deepEqual(of(stopped.events, "damage"), []);
    assert.deepEqual(rulesetCombatant(stopped.state, "corwin")!.itemsUsed, { 0: 1 }, "read once");
  }
  // ── Above it, the reader's check against 10 plus the level ──
  {
    const made = read(cast(fight(), "slots_5"), 11);
    const [counter] = of(made.events, "counter");
    assert.deepEqual([counter?.level, counter?.reach, counter?.total, counter?.difficulty], [5, 3, 15, 15]);
    assert.equal(of(made.events, "cancelled").length, 1);
    const missed = read(cast(fight(), "slots_5"), 10);
    assert.deepEqual(of(missed.events, "cancelled"), [], "one short lets it through");
    assert.equal(of(missed.events, "damage")[0]?.targetId, "corwin");
  }

  // ── Refusals ──
  assert.ok(rulesetItemUseSchema.safeParse(scrollUse()).success);
  const refusedUse = (use: unknown, pattern: RegExp) => {
    const checked = rulesetItemUseSchema.safeParse(use);
    assert.equal(checked.success, false, `should be refused: ${pattern}`);
    if (!checked.success) assert.match(checked.error.issues.map((one) => one.message).join("; "), pattern);
  };
  refusedUse(scrollUse({ level: undefined }), /reads the level it casts at, so it has "level"/);
  refusedUse(scrollUse({ reaction: { on: "used", against: { catalogs: ["spells"] } } }), /A utility use leaves/);
  refusedUse(scrollUse({ level: 21 }), /Too big: expected number to be <=20/);

  // ── The install gate ──
  const gate =
    "A ruleset with an item's use that casts at a level (use.level) or a utility use that stops what it answers requires schemaVersion 2 and capabilityApi 1.730 or newer";
  const withScroll = (use: Record<string, unknown> = scrollUse()) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "scrolls",
      label: "Scrolls",
      entries: [{ id: "scroll_of_counterspell", label: "Scroll of Counterspell", item: { category: "gear", use } }],
    });
    return doc;
  };
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(729) as never, withScroll()), gate);
  const levelOnly = withScroll({ kind: "attack", budget: "action", level: 1, autoHit: true, amount: { flat: 3 } });
  assert.equal(getCapabilityPackageInstallIssue(manifest(729) as never, levelOnly), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(730) as never, withScroll()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(729) as never, JSON.parse(fiveEText)), gate);

  console.log(
    "Scroll of Counterspell: an item's use casts at its own level and stops a spell up to it, or above on its reader's check; gated at 1.730.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
