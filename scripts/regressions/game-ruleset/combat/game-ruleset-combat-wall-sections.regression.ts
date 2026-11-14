/**
 * Walls in sections, struck and broken (Capability API 1.200), as 5e's Wall of Ice has them.
 *
 *   - `zone.sections`: the wall is cut into sections `every` long, each with its own defense and
 *     health, shown with what each has left.
 *   - An attack's option lists the section cells it may strike as `walls`; a choice's `wall` strikes
 *     one: the attack is rolled as at a creature, with the section's vulnerabilities, and the log
 *     says what it took and has left.
 *   - A section at 0 is broken: it stops blocking, and whoever enters it is caught by `broken`,
 *     once a turn, saving with its save against the entry's own difficulty.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_MOVE_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetZonesShown,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wall-sections-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 195);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());

  // Wall of Ice, small: 20 ft long in 10-ft sections of 10 hit points and defense 12, fire doing
  // double; a broken one leaves 4 cold to whoever walks in, half on a Constitution save.
  const iceZone = {
    rounds: 10,
    triggers: [],
    blocks: ["move", "sight"],
    sections: {
      every: 10,
      health: 10,
      defense: 12,
      vulnerable: ["fire"],
      broken: { triggers: ["enter"], amount: { flat: 4 }, damageType: "cold", save: "con_save", onSave: "half" },
    },
  };
  const iceMechanics = {
    kind: "attack",
    autoHit: true,
    area: { shape: "wall", size: 20 },
    range: 60,
    amount: { flat: 5 },
    damageType: "cold",
    save: { save: "dex_save", onSuccess: "half" },
    zone: iceZone,
  };
  const ice = {
    id: "ice",
    label: "Ice",
    rows: [{ list: "spells", values: { name: "Ice", level: 1, prepared: true } }],
    mechanics: iceMechanics,
  } as unknown as RulesetCatalogEntry;
  // The same paid for with a slot, its frigid air 3 more a step above it (1.201).
  const iceUp = {
    id: "ice-up",
    label: "Ice Up",
    rows: [{ list: "spells", values: { name: "Ice Up", level: 1, prepared: true } }],
    mechanics: {
      ...iceMechanics,
      cost: [{ pool: "slots_1", amount: 1 }],
      zone: {
        ...iceZone,
        sections: { ...iceZone.sections, broken: { ...iceZone.sections.broken, perCostStep: { flat: 3 } } },
      },
    },
  } as unknown as RulesetCatalogEntry;
  const spells = [ice, iceUp];
  // A brute with a club and a burning brand, a heal for its friends and a spit saved against.
  const brute: RulesetStatBlock = {
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "club",
        name: "Club",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "bludgeoning" },
      },
      { id: "brand", name: "Brand", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 2, type: "fire" } },
      { id: "heal", name: "Heal", budget: "action", targets: "ally", heal: { count: 1, sides: 4, flat: 0 } },
      {
        id: "spit",
        name: "Spit",
        budget: "action",
        save: { save: "dex_save", difficulty: 12 },
        damage: { count: 1, sides: 6, flat: 0, type: "acid" },
      },
    ],
  } as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 5,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 4,
              slots_max_2: 2,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block: brute },
      ],
      board: { grid: grid(), placements: { mage: { x: 2, y: 7 }, a: { x: 6, y: 7 } } },
    });
    state.order = ["mage", "a"];
    state.turn = 0;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    return option;
  };
  const keys = (cells: RulesetCombatCell[] | undefined) => (cells ?? []).map((cell) => `${cell.x},${cell.y}`).sort();
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const sectionOf = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "section");
    assert.ok(event && event.type === "section", JSON.stringify(events));
    return event;
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  // The wall across the mage's line at x 5: rows 6 and 7 one section, 8 and 9 the other.
  const walled = (label = "Ice", payWith?: string): RulesetEncounterState => {
    const state = fight();
    const step = applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "mage",
        optionId: optionOf(state, "mage", label).id,
        targetIds: [],
        at: { x: 5, y: 7 },
        ...(payWith ? { payWith } : {}),
      },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return advanceRulesetTurn(definition, step.state, roll).state;
  };
  const strike = (state: RulesetEncounterState, label: string, wall: RulesetCombatCell, extra = {}) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "a", optionId: optionOf(state, "a", label).id, targetIds: [], wall, ...extra },
      roll,
    );
  const again = (state: RulesetEncounterState) => {
    rulesetCombatant(state, "a")!.budgets.action = 1;
    return state;
  };

  // ── The wall stands in two sections, each shown at full health ──
  {
    const state = walled();
    const shown = rulesetZonesShown(state)[0]!;
    assert.deepEqual(
      shown.sections?.map((section) => [keys(section.cells), section.health, section.max]),
      [
        [["5,6", "5,7"], 10, 10],
        [["5,8", "5,9"], 10, 10],
      ],
    );
    // The club reaches the three wall cells next to the brute, the heal none.
    assert.deepEqual(keys(optionOf(state, "a", "Club").walls), ["5,6", "5,7", "5,8"]);
    assert.equal(optionOf(state, "a", "Heal").walls, undefined);
    // Nor what is saved against rather than rolled to hit.
    assert.equal(optionOf(state, "a", "Spit").walls, undefined);
    // Nothing to strike without a wall.
    const open = fight();
    open.turn = 1;
    assert.equal(optionOf(open, "a", "Club").walls, undefined);
  }

  // ── Struck: hit, missed, doubled by fire, and broken ──
  {
    d20 = 15;
    const hit = strike(walled(), "Club", { x: 5, y: 7 });
    assert.equal(refused(hit), undefined, JSON.stringify(hit.events));
    const said = sectionOf(hit.events);
    assert.deepEqual(
      [said.outcome, said.dealt, said.health, said.broken, said.wall, said.label],
      ["hit", 5, 5, undefined, "Ice", "Club"],
    );
    assert.ok(!hit.events.some((one) => "targetId" in one && one.targetId === "wall-section"), "no stand-in left");
    assert.ok(!hit.state.combatants.some((one) => one.object), "the stand-in is gone");
    assert.equal(rulesetCombatant(hit.state, "a")!.budgets.action, 0, "the attack's budget is spent");
    assert.deepEqual(
      rulesetZonesShown(hit.state)[0]!.sections!.map((section) => section.health),
      [5, 10],
    );
    // A miss leaves it as it was.
    d20 = 2;
    const missed = sectionOf(strike(walled(), "Club", { x: 5, y: 6 }).events);
    assert.deepEqual([missed.outcome, missed.dealt, missed.health], ["miss", 0, 10]);
    // Fire does double: 10, and the section is broken, closing nothing more.
    d20 = 15;
    const burnt = strike(walled(), "Brand", { x: 5, y: 6 });
    const broke = sectionOf(burnt.events);
    assert.deepEqual([broke.dealt, broke.health, broke.broken], [10, 0, true]);
    const walls = burnt.state.board!.grid.walls ?? {};
    assert.equal(walls["5,6"], undefined);
    assert.equal(walls["5,7"], undefined);
    assert.equal(walls["5,8"], 3, "the other section still blocks both");
    // A broken section is struck at no more.
    assert.deepEqual(keys(optionOf(again(burnt.state), "a", "Club").walls), ["5,8"]);
    // Two blows in a row: 5 and 5.
    const twice = strike(again(hit.state), "Club", { x: 5, y: 6 });
    assert.deepEqual([sectionOf(twice.events).health, sectionOf(twice.events).broken], [0, true]);
  }

  // ── Refused: a cell out of reach, not a wall, a broken section, or with a mode ──
  {
    d20 = 15;
    assert.equal(refused(strike(walled(), "Club", { x: 5, y: 9 }))?.type, "refused", "two cells off");
    assert.ok(refused(strike(walled(), "Club", { x: 7, y: 7 })), "not a wall");
    assert.ok(refused(strike(walled(), "Club", { x: 5, y: 7 }, { mode: "thrown" })), "with a mode");
    const burnt = strike(walled(), "Brand", { x: 5, y: 6 }).state;
    assert.ok(refused(strike(again(burnt), "Club", { x: 5, y: 7 })), "already broken");
  }

  // ── Frigid air: walking into the broken section, once a turn, half on a save ──
  {
    d20 = 15;
    const burnt = again(strike(walled(), "Brand", { x: 5, y: 6 }).state);
    // Its own cells are open now: the brute walks in.
    d20 = 2;
    const into = applyRulesetCombatChoice(
      definition,
      burnt,
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 7 } },
      roll,
    );
    assert.equal(refused(into), undefined, JSON.stringify(into.events));
    assert.equal(hp(into.state, "a"), 96, "4 cold, the save failed");
    assert.ok(into.events.some((one) => one.type === "damage" && one.targetId === "a" && one.damageType === "cold"));
    // Moving on inside it the same turn is not caught again.
    const on = applyRulesetCombatChoice(
      definition,
      into.state,
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 6 } },
      roll,
    );
    assert.equal(hp(on.state, "a"), 96);
    // Saved: half.
    d20 = 20;
    const saved = applyRulesetCombatChoice(
      definition,
      burnt,
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 7 } },
      roll,
    );
    assert.equal(hp(saved.state, "a"), 98);
    // The standing section is still closed to walking.
    const blocked = applyRulesetCombatChoice(
      definition,
      burnt,
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 8 } },
      roll,
    );
    assert.ok(refused(blocked));
    // A wall that is whole catches nobody walking beside it.
    d20 = 2;
    const beside = applyRulesetCombatChoice(
      definition,
      again(walled()),
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 6, y: 6 } },
      roll,
    );
    assert.equal(hp(beside.state, "a"), 100);
  }

  // ── Frigid air grows with the slot (1.201): 3 more a step above the cast's base ──
  {
    const walkIn = (payWith?: string) => {
      d20 = 15;
      const burnt = again(strike(walled("Ice Up", payWith), "Brand", { x: 5, y: 6 }).state);
      d20 = 2;
      const into = applyRulesetCombatChoice(
        definition,
        burnt,
        { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 7 } },
        roll,
      );
      assert.equal(refused(into), undefined, JSON.stringify(into.events));
      return hp(into.state, "a");
    };
    assert.equal(walkIn("slots_2"), 93, "4 and 3 for the step");
    assert.equal(walkIn(), 96, "at its base, only the 4");
  }

  // ── Import refusals ──
  {
    const refusedDoc = (change: (mechanics: Record<string, any>) => void, pattern: RegExp) => {
      const mechanics = structuredClone(iceMechanics) as Record<string, any>;
      change(mechanics);
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({ id: "walls", label: "Walls", feeds: ["spells"], entries: [{ ...ice, mechanics }] });
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    refusedDoc((m) => delete m.zone.blocks, /A wall in "sections" is one that "blocks"/);
    refusedDoc((m) => delete m.save, /A broken section's save is rolled against the entry's own difficulty/);
    refusedDoc((m) => delete m.zone.sections.broken.save, /"onSave" says what a "save" does/);
    refusedDoc((m) => (m.zone.sections.broken.amount = {}), /What a broken section deals names dice or a flat number/);
    refusedDoc((m) => (m.zone.sections.vulnerable = ["frost"]), /Unknown damage type "frost"/);
    refusedDoc((m) => (m.zone.sections.broken.damageType = "frost"), /Unknown damage type "frost"/);
    refusedDoc((m) => (m.zone.sections.broken.save = "luck_save"), /Unknown save "luck_save"/);
    refusedDoc((m) => (m.zone.sections.every = 0), /every/);
    refusedDoc((m) => (m.zone.sections.health = 0), /health/);
    refusedDoc((m) => (m.area = { shape: "burst", size: 10 }), /Only a wall "blocks"/);
  }

  // ── The install gate ──
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
      "A ruleset with walls in sections that are struck and broken requires schemaVersion 2 and capabilityApi 1.200 or newer";
    const withIce = fiveE((doc) => {
      doc.catalogs.push({ id: "walls", label: "Walls", feeds: ["spells"], entries: [ice] });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(199) as never, withIce), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(200) as never, withIce), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(199) as never, fiveE()), gate);
    const files = new Map([["walls.json", { entries: [ice] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(199) as never, fiveE(), files as never), gate);
  }

  console.log(
    "Ruleset wall sections: Wall of Ice stands in sections struck like creatures, fire doing double; a broken one opens and leaves frigid air; gated at 1.200.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
