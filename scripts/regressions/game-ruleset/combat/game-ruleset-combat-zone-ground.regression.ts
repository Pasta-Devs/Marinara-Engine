/**
 * Zones that ram, and ground that costs more or halves speed (Capability API 1.175).
 *
 *   - `move.ram`: moved a cell at a time, it stops on the first cell that reaches somebody new,
 *     catches them whatever its triggers say, and moves no more that turn (Flaming Sphere). Those who
 *     walk in are caught only by its triggers.
 *   - `terrain.costTimes`: a step into it costs that many plain steps, ground already hard going no
 *     more (Plant Growth). `terrain.halvesSpeed`: double again, on top of hard going (Spirit
 *     Guardians).
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
  RULESET_ZONE_OPTION_PREFIX,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetZonesShown,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-ground-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 170);
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

  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "radiant", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Flaming Sphere, small: rammed for a bonus action, and catching whoever ends a turn in it.
  const sphere = spell("sphere", {
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 5 },
    damageType: "fire",
    concentration: true,
    zone: {
      rounds: 10,
      triggers: ["turn-end"],
      atCast: false,
      move: { budget: "bonus", distance: 30, ram: true },
    },
  });
  // Plant Growth: four steps for every one.
  const plants = spell("plants", {
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], atCast: false, terrain: { costTimes: 4 } },
  });
  // Half speed on its own, and on top of hard going.
  const halving = spell("halving", {
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], atCast: false, terrain: { halvesSpeed: true } },
  });
  const mud = spell("mud", {
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], atCast: false, terrain: { difficult: true, halvesSpeed: true } },
  });
  const spells = [sphere, plants, halving, mud];
  const block: RulesetStatBlock = { health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  const fight = (
    placements: Record<string, { x: number; y: number }> = {},
    tiles?: TacticalGrid,
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
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block },
        { id: "b", name: "B", side: "enemy", block },
      ],
      board: {
        grid: tiles ?? grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 8, y: 7 }, b: { x: 11, y: 7 }, ...placements },
      },
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(
      option,
      `${actorId} has no ${label}: ${rulesetCombatOptions(definition, state, actorId).map((one) => one.label)}`,
    );
    return option;
  };
  const cast = (state: RulesetEncounterState, label: string, at: { x: number; y: number }) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, "mage", label).id, targetIds: [], at },
      roll,
    );
  const walk = (state: RulesetEncounterState, actorId: string, to: { x: number; y: number }) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to }, roll);
  /** The menu's id for moving the mage's zone of this label. */
  const zoneOption = (state: RulesetEncounterState, label: string) =>
    `${RULESET_ZONE_OPTION_PREFIX}${rulesetCombatant(state, "mage")!.zones?.find((one) => one.label === label)?.actionId}`;
  const movesZone = (state: RulesetEncounterState, actorId: string, label: string) =>
    rulesetCombatOptions(definition, state, actorId).some(
      (one) => one.id.startsWith(RULESET_ZONE_OPTION_PREFIX) && one.label === label,
    );
  const shift = (state: RulesetEncounterState, label: string, to: { x: number; y: number }) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: zoneOption(state, label), targetIds: [], to },
      roll,
    );
  const end = (state: RulesetEncounterState) => advanceRulesetTurn(definition, state, roll);
  /** Round the order back to the mage's next turn, collecting every event on the way. */
  const toMage = (state: RulesetEncounterState) => {
    const events: RulesetCombatEvent[] = [];
    let step: RulesetCombatStep = { state, events: [] };
    do {
      step = end(step.state);
      events.push(...step.events);
    } while (step.state.order[step.state.turn] !== "mage");
    return { state: step.state, events };
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const zoneEvents = (step: { events: RulesetCombatEvent[] }) =>
    step.events.filter((one): one is Extract<RulesetCombatEvent, { type: "zone" }> => one.type === "zone");
  const refused = (step: RulesetCombatStep) =>
    step.events.find((one): one is Extract<RulesetCombatEvent, { type: "refused" }> => one.type === "refused");
  const walkCost = (state: RulesetEncounterState, actorId: string, to: { x: number; y: number }) =>
    rulesetCombatOptions(definition, state, actorId)
      .find((one) => one.id === RULESET_MOVE_OPTION)
      ?.cells?.find((cell) => cell.x === to.x && cell.y === to.y)?.cost;

  // ── Flaming Sphere: rammed into A, stopped there for the turn ──
  {
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(fight(), "Sphere", {
      x: 5,
      y: 7,
    });
    assert.equal(refused(step as RulesetCombatStep), undefined, JSON.stringify(refused(step as RulesetCombatStep)));
    // Sent for B's square, it reaches A on the way and stops there.
    step = shift(step.state, "Sphere", { x: 10, y: 7 });
    assert.equal(refused(step as RulesetCombatStep), undefined, JSON.stringify(refused(step as RulesetCombatStep)));
    assert.deepEqual(
      zoneEvents(step).map((one) => [one.outcome, one.targetId, one.trigger]),
      [
        ["moved", undefined, undefined],
        ["struck", "a", "ram"],
      ],
    );
    assert.deepEqual(zoneEvents(step)[0]!.to, { x: 7, y: 7 }, "stopped where it first reached A");
    assert.equal(hp(step.state, "a"), 95);
    assert.equal(hp(step.state, "b"), 100);
    // Stopped for the turn, even with a bonus action to spare.
    rulesetCombatant(step.state, "mage")!.budgets.bonus = 1;
    assert.equal(movesZone(step.state, "mage", "Sphere"), false, "it moves no more this turn");
    assert.equal(refused(shift(step.state, "Sphere", { x: 5, y: 7 }) as RulesetCombatStep)?.reason, "unreachable");
    // Next turn it moves again; sent where it reaches nobody new it goes all the way.
    let next = toMage(step.state);
    assert.equal(movesZone(next.state, "mage", "Sphere"), true);
    next = shift(next.state, "Sphere", { x: 7, y: 10 });
    assert.deepEqual(zoneEvents(next)[0]!.to, { x: 7, y: 10 });
    assert.equal(
      zoneEvents(next).some((one) => one.outcome === "struck"),
      false,
    );
    // B walks into it: no ram, and no `enter` to catch them; ending the turn there does.
    let walkIn = end(next.state);
    walkIn = end(walkIn.state);
    walkIn = walk(walkIn.state, "b", { x: 7, y: 9 });
    assert.equal(refused(walkIn as RulesetCombatStep), undefined, JSON.stringify(refused(walkIn as RulesetCombatStep)));
    const bBefore = hp(walkIn.state, "b");
    assert.equal(
      zoneEvents(walkIn).some((one) => one.outcome === "struck"),
      false,
      "walking in is not being rammed",
    );
    const ended = end(walkIn.state);
    assert.equal(hp(ended.state, "b"), bBefore - 5, "ending a turn in it");
    assert.equal(zoneEvents(ended)[0]?.trigger, "turn-end");
  }

  // ── Plant Growth and halved speed ──
  {
    const forest = grid();
    forest.tiles[7]![8] = "forest";
    const costs = (label: string, tiles?: TacticalGrid) => {
      const placed = end(cast(fight({ a: { x: 8, y: 5 } }, tiles), label, { x: 8, y: 7 }).state);
      // Room to see every price.
      rulesetCombatant(placed.state, "a")!.movementLeft = 20;
      return {
        inside: walkCost(placed.state, "a", { x: 8, y: 6 }),
        deeper: walkCost(placed.state, "a", { x: 8, y: 7 }),
      };
    };
    const plain = end(fight({ a: { x: 8, y: 5 } }, forest));
    const forestStep = walkCost(plain.state, "a", { x: 8, y: 7 })! - walkCost(plain.state, "a", { x: 8, y: 6 })!;
    assert.ok(forestStep >= 2, "forest is hard going");
    assert.deepEqual(costs("Plants"), { inside: 4, deeper: 8 }, "four steps for every one");
    assert.deepEqual(costs("Plants", forest), { inside: 4, deeper: 8 }, "hard going costs no more than four");
    assert.deepEqual(costs("Halving"), { inside: 2, deeper: 4 }, "half speed");
    assert.equal(costs("Halving", forest).deeper, 2 + forestStep * 2, "half speed on top of the forest");
    assert.deepEqual(costs("Mud"), { inside: 4, deeper: 8 }, "hard going and half speed");
    // Two zones on one cell: the slowest price, and halved if either halves.
    let both: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(
      fight({ a: { x: 8, y: 5 } }),
      "Halving",
      { x: 8, y: 7 },
    );
    both = toMage(both.state);
    both = end(cast(both.state, "Plants", { x: 8, y: 7 }).state);
    rulesetCombatant(both.state, "a")!.movementLeft = 20;
    assert.equal(walkCost(both.state, "a", { x: 8, y: 6 }), 8, "four steps, halved");
    // The walk pays what the menu priced.
    const placed = end(cast(fight({ a: { x: 8, y: 5 } }), "Plants", { x: 8, y: 7 }).state);
    const walked = walk(placed.state, "a", { x: 8, y: 6 });
    const moved = walked.events.find((one) => one.type === "move");
    assert.equal(moved && moved.type === "move" ? moved.cost : -1, 4);
  }

  // ── Import refusals ──
  {
    const refusedDoc = (mechanics: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({ id: "zones", label: "Zones", entries: [{ id: "z", label: "Z", mechanics }] });
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const area = { shape: "burst", size: 5 };
    refusedDoc(
      { kind: "attack", area, zone: { rounds: 1, triggers: [], terrain: { difficult: true, costTimes: 4 } } },
      /its own price/,
    );
    refusedDoc({ kind: "attack", area, zone: { rounds: 1, triggers: [], terrain: { costTimes: 1 } } }, /2/);
    refusedDoc({ kind: "attack", area, zone: { rounds: 1, triggers: [], terrain: {} } }, /"terrain" says/);
    refusedDoc(
      {
        kind: "attack",
        area,
        zone: { rounds: 1, anchor: "caster", triggers: ["enter"], move: { budget: "bonus", distance: 30, ram: true } },
      },
      /Only a burst held at a point/,
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
      "A ruleset with zones that ram or hurt whom they hold, ground that costs more or halves speed, or holds broken only by their escape DC and checks requires schemaVersion 2 and capabilityApi 1.175 or newer";
    for (const entry of [sphere, plants, halving]) {
      const withEntry = fiveE((doc) => {
        doc.catalogs.push({ id: "zones", label: "Zones", entries: [entry] });
      });
      assert.equal(getCapabilityPackageInstallIssue(manifest(174) as never, withEntry), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(175) as never, withEntry), gate, entry.id);
    }
    const scroll = fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "kit",
        label: "Kit",
        entries: [
          {
            id: "scroll",
            label: "Scroll",
            item: {
              category: "gear",
              use: {
                kind: "attack",
                budget: "action",
                area: { shape: "burst", size: 5 },
                zone: { rounds: 1, triggers: [], terrain: { halvesSpeed: true } },
              },
            },
          },
        ],
      });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(174) as never, scroll), gate, "a scroll's ground");
    const moonbeam = fiveE((doc) => {
      doc.catalogs.push({
        id: "zones",
        label: "Zones",
        entries: [
          spell("beam", {
            area: { shape: "burst", size: 5 },
            zone: {
              rounds: 1,
              triggers: ["enter"],
              move: { budget: "action", distance: 30 },
              terrain: { difficult: true },
            },
          }),
        ],
      });
    });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(174) as never, moonbeam), gate, "1.173 keys alone");
  }

  console.log(
    "Zone ground: Flaming Sphere rams A and stops for the turn, walk-ins wait for its trigger; Plant Growth costs four, half speed doubles on top; gated at 1.175.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
