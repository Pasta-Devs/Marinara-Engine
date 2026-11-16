/**
 * Pushes, winds and goggles (Capability API 1.182).
 *
 *   - `push` on an entry: whoever it lands on and does not save against is pushed away from its
 *     maker, at the cast and each time its zone catches them (5e's Gust of Wind, 15 feet).
 *   - A line or cone zone held by its caster: it points the way it was cast, goes where they go, and
 *     `zone.turn` lets them spend a budget to face it another way, catching whoever it now covers.
 *   - `terrain.towardCaster`: its hard going counts only for a step nearer its caster.
 *   - A sense given as `{ add }`: added to the holder's own range (goggles of night), or given plain.
 *   - Import refusals, and the install gate.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetReachableCells,
  rulesetSenseRanges,
  rulesetSheetBuildSchema,
  rulesetZoneCells,
  supportedCapabilityApi,
  RULESET_MOVE_OPTION,
  RULESET_ZONE_TURN_OPTION_PREFIX,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-gust-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 177);
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
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        withRules(doc);
        edit(doc);
      }),
    );
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  const spell = (id: string, mechanics: Record<string, unknown>, level = 2) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // Gust of Wind: a line 60 feet long and 10 wide from the caster, a Strength save or pushed 15 feet,
  // again for whoever starts a turn in it; walking toward the caster costs double; turned on a bonus
  // action.
  const gust = spell("gust", {
    kind: "debuff",
    area: { shape: "line", size: 60, width: 10 },
    range: 60,
    save: { save: "str_save", onSuccess: "negates" },
    push: 15,
    zone: {
      rounds: 10,
      anchor: "caster",
      triggers: ["turn-start"],
      turn: { budget: "bonus" },
      terrain: { difficult: true, towardCaster: true },
    },
  });
  // A cone its caster carries that catches whoever it is turned onto.
  const breath = spell("breath", {
    kind: "attack",
    autoHit: true,
    area: { shape: "cone", size: 15 },
    range: 15,
    amount: { flat: 5 },
    damageType: "fire",
    zone: { rounds: 10, anchor: "caster", triggers: ["enter"], turn: { budget: "bonus" } },
  });
  const spells = [gust, breath];
  const withRules = (doc: Record<string, any>) => {
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.combat.senses = [
      { id: "darkvision", label: "Darkvision" },
      { id: "truesight", label: "Truesight" },
    ];
    doc.sheet.live.conditions.push({ id: "keen", label: "Keen-eyed" });
    doc.combat.conditions.push({ condition: "keen", senses: { darkvision: { add: 30 } } });
  };
  const definition = parsed(
    fiveE((doc) => {
      withRules(doc);
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { str_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const fight = (
    options: {
      placements?: Record<string, { x: number; y: number }>;
      a?: Partial<RulesetStatBlock>;
      items?: RulesetSheetItem[];
    } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 9,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 9,
              slots_max_2: 3,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells },
          ...(options.items ? { items: options.items } : {}),
        },
        { id: "a", name: "A", side: "enemy", block: block(options.a) },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 6, y: 7 }, b: { x: 2, y: 2 }, ...options.placements },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const at = (state: RulesetEncounterState, id: string) => ({ x: who(state, id).x, y: who(state, id).y });
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const cast = (state: RulesetEncounterState, label: string, aim: RulesetCombatCell) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label && !one.cells);
    assert.ok(option, `the mage has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: aim },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const turnOption = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "mage").find((one) => one.id.startsWith(RULESET_ZONE_TURN_OPTION_PREFIX));
  const turn = (state: RulesetEncounterState, to: RulesetCombatCell) => {
    const option = turnOption(state);
    assert.ok(option, "the mage may turn the zone");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], to },
      roll,
    );
  };
  const cellsOf = (state: RulesetEncounterState) => {
    const mage = who(state, "mage");
    return new Set(rulesetZoneCells(state, mage, mage.zones![0]!).map((cell) => `${cell.x},${cell.y}`));
  };

  // ── Gust of Wind: cast, carried, pushes ──
  {
    const step = cast(fight(), "Gust", { x: 10, y: 7 });
    assert.deepEqual(at(step.state, "a"), { x: 9, y: 7 }, "pushed 15 feet straight away from the mage");
    assert.ok(step.events.some((one) => one.type === "pushed" && one.targetId === "a"));
    const zone = who(step.state, "mage").zones![0]!;
    assert.deepEqual(zone.facing, { dx: 1, dy: 0 }, "it faces the way it was cast");
    assert.ok(cellsOf(step.state).has("5,7") && cellsOf(step.state).has("13,7"), "a line from the mage");
    assert.ok(!cellsOf(step.state).has("1,7") && !cellsOf(step.state).has("2,3"), "and only that way");
    // A creature that saves stays where it is.
    const strong = cast(fight({ a: { saves: { str_save: 20 } } }), "Gust", { x: 10, y: 7 });
    assert.deepEqual(at(strong.state, "a"), { x: 6, y: 7 });
    assert.ok(!strong.events.some((one) => one.type === "pushed"));
    // It goes where its caster goes.
    const moved = structuredClone(step.state);
    who(moved, "mage").y = 9;
    assert.ok(cellsOf(moved).has("5,9") && !cellsOf(moved).has("5,6"), "the line moves with the mage");
    // A starts its turn in the line, fails again and is pushed on.
    let next = step.state;
    do next = advanceRulesetTurn(definition, next, roll).state;
    while (next.order[next.turn] !== "a");
    assert.deepEqual(at(next, "a"), { x: 12, y: 7 }, "pushed again as its turn starts");
    // Walking back toward the mage costs double; away or across costs a plain step.
    const reach = new Map(
      rulesetReachableCells(definition, next, "a").map((cell) => [`${cell.x},${cell.y}`, cell.cost]),
    );
    assert.equal(reach.get("11,7"), 2, "a step nearer the mage is hard going");
    assert.equal(reach.get("13,7"), 1, "a step away is not");
    assert.equal(reach.get("12,8"), 1, "nor a step across it");
    const left = who(next, "a").movementLeft!;
    const walked = applyRulesetCombatChoice(
      definition,
      next,
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 11, y: 7 } },
      roll,
    );
    assert.equal(refused(walked), undefined);
    assert.equal(who(walked.state, "a").movementLeft, left - 2, "the walk pays what the menu showed");
    // Somebody it does not catch walks it as plain ground: the mage, and a friend it spares.
    const mageReach = new Map(
      rulesetReachableCells(definition, step.state, "mage").map((cell) => [`${cell.x},${cell.y}`, cell.cost]),
    );
    assert.equal(mageReach.get("3,7"), 1);
  }

  // ── Turning ──
  {
    const step = cast(fight({ placements: { a: { x: 14, y: 2 } } }), "Gust", { x: 10, y: 7 });
    const turned = turn(step.state, { x: 2, y: 6 });
    assert.equal(refused(turned), undefined);
    assert.deepEqual(who(turned.state, "mage").zones![0]!.facing, { dx: 0, dy: -1 }, "now it faces north");
    assert.ok(turned.events.some((one) => one.type === "zone" && one.outcome === "turned"));
    assert.ok(cellsOf(turned.state).has("2,3") && !cellsOf(turned.state).has("5,7"));
    assert.equal(who(turned.state, "mage").budgets.bonus, 0, "it spent the bonus action");
    assert.equal(turnOption(turned.state), undefined, "and cannot turn again this turn");
    // Gust catches only at the start of a turn, so turning it onto B does nothing yet.
    assert.deepEqual(at(turned.state, "b"), { x: 2, y: 2 });
    // The way it already faces is not offered.
    assert.ok(!turnOption(step.state)!.cells!.some((cell) => cell.x === 3 && cell.y === 7));
    // A cone that catches whoever moves into it catches whoever it is turned onto.
    const breath = cast(fight({ placements: { a: { x: 3, y: 9 }, b: { x: 3, y: 5 } } }), "Breath", { x: 3, y: 8 });
    const hp = (state: RulesetEncounterState) =>
      rulesetCombatHealth(definition, definition.combat!, who(state, "b")).value;
    const before = hp(breath.state);
    const swung = turn(breath.state, { x: 3, y: 6 });
    assert.ok(
      swung.events.some(
        (one) => one.type === "zone" && one.outcome === "struck" && one.targetId === "b" && one.trigger === "enter",
      ),
    );
    assert.equal(hp(swung.state), before - 5, "B is burned");
    // A refused cell: not one the menu offered.
    const option = turnOption(step.state)!;
    const wrong = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "mage", optionId: option.id, targetIds: [], to: { x: 9, y: 9 } },
      roll,
    );
    assert.ok(refused(wrong));
  }

  // ── Senses that add ──
  {
    const gogglesItem = {
      category: "gear",
      worn: { senses: { darkvision: { add: 60 } } },
    } as unknown as RulesetCatalogItem;
    const goggles: RulesetSheetItem = {
      name: "goggles",
      quantity: 1,
      worn: true,
      item: gogglesItem,
      stack: { id: "goggles", ref: "gear/goggles" },
    };
    const state = fight({ items: [goggles], a: { senses: { darkvision: 60 } } });
    // Nobody with none of their own: 60 feet, 12 cells.
    assert.equal(rulesetSenseRanges(definition, who(state, "mage"), state).darkvision, 12);
    // With 30 feet of their own, 90.
    who(state, "mage").senses = { darkvision: 6 };
    assert.equal(rulesetSenseRanges(definition, who(state, "mage"), state).darkvision, 18);
    // A condition adds 30 to A's 60; added to their own, never to another grant.
    who(state, "a").tracked.push({ condition: "keen", rounds: null });
    assert.equal(rulesetSenseRanges(definition, who(state, "a"), state).darkvision, 18);
  }

  // ── Import refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell("x", mechanics)] });
    };
    const zoned = (area: Record<string, unknown>, zone: Record<string, unknown>) =>
      withSpell({ kind: "debuff", area, range: 60, zone: { rounds: 1, triggers: ["enter"], ...zone } });
    refusedDoc(
      zoned({ shape: "box", size: 10 }, { anchor: "caster" }),
      /A zone that moves with its caster is a burst around them, or a line or cone from them/,
    );
    refusedDoc(
      zoned({ shape: "burst", size: 10 }, { anchor: "caster", turn: { budget: "bonus" } }),
      /Only a line or cone that moves with its caster is turned/,
    );
    refusedDoc(
      zoned({ shape: "line", size: 30 }, { turn: { budget: "bonus" } }),
      /Only a line or cone that moves with its caster is turned/,
    );
    refusedDoc(
      zoned({ shape: "line", size: 30 }, { anchor: "caster", turn: { budget: "swift" } }),
      /Unknown budget "swift"/,
    );
    refusedDoc(
      zoned({ shape: "line", size: 30 }, { anchor: "caster", terrain: { halvesSpeed: true, towardCaster: true } }),
      /"towardCaster" says when its hard going counts/,
    );
    refusedDoc(withSpell({ kind: "debuff", range: 60, push: 0 }), /push/);
    refusedDoc((doc) => {
      doc.combat.conditions.find((entry: any) => entry.condition === "keen").senses = { darkvision: { add: 0 } };
    }, /add/);
    refusedDoc((doc) => {
      doc.combat.conditions.find((entry: any) => entry.condition === "keen").senses = { xray: { add: 30 } };
    }, /Unknown sense "xray"/);
    // A cone its caster carries, with no turning, is fine; so is a burst.
    parsed(
      fiveE((doc) => {
        withRules(doc);
        zoned({ shape: "cone", size: 15 }, { anchor: "caster" })(doc);
      }),
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
      "A ruleset with senses that add to the holder's own, actions that push, lines or cones that move with their caster and turn, or hard going only toward a caster, requires schemaVersion 2 and capabilityApi 1.182 or newer";
    const withEntries = (entries: unknown[]) =>
      fiveE((doc) => {
        doc.catalogs.push({ id: "x", label: "X", entries });
      });
    const docs: Array<[string, Record<string, any>]> = [
      [
        "sense add",
        fiveE((doc) => {
          doc.combat.conditions.push({ condition: "x", senses: { darkvision: { add: 60 } } });
        }),
      ],
      ["push", withEntries([spell("p", { kind: "debuff", range: 60, push: 15 })])],
      [
        "carried line",
        withEntries([
          spell("l", { kind: "debuff", area: { shape: "line", size: 30 }, zone: { rounds: 1, anchor: "caster" } }),
        ]),
      ],
      [
        "turn",
        withEntries([
          spell("t", { kind: "debuff", area: { shape: "line", size: 30 }, zone: { turn: { budget: "b" } } }),
        ]),
      ],
      [
        "toward caster",
        withEntries([
          spell("w", { kind: "debuff", area: { shape: "burst", size: 30 }, zone: { terrain: { towardCaster: true } } }),
        ]),
      ],
      [
        "item use push",
        withEntries([{ id: "i", label: "I", item: { category: "gear", use: { kind: "debuff", push: 10 } } }]),
      ],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(181) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(182) as never, doc), gate, label);
    }
    // A plain sense, a burst its caster carries and a contest's push are older keys.
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(181) as never, fiveE()), gate, "the plain 5e example");
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(181) as never,
        withEntries([
          spell("s", { kind: "debuff", area: { shape: "burst", size: 15 }, zone: { rounds: 1, anchor: "caster" } }),
        ]),
      ),
      gate,
      "a carried burst",
    );
    // A sense given as a plain range is 1.178's and 1.180's, whoever carries it.
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(181) as never,
        fiveE((doc) => {
          doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
          doc.sheet.live.conditions.push({ id: "x", label: "X" });
          doc.combat.conditions.push({ condition: "x", senses: { darkvision: 60 } });
        }),
      ),
      gate,
      "a plain sense range",
    );
  }

  console.log(
    "Ruleset gusts: an action pushes whoever fails its save, a line its caster carries points the way it was cast and turns on a bonus action, walking toward its caster costs double, and goggles add to darkvision already had.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
