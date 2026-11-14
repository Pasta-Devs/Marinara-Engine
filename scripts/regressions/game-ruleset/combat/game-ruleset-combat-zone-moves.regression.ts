/**
 * Zones that move and change the ground (Capability API 1.173).
 *
 *   - `move`: its caster moves a zone held at a point on their turn, for a budget, to a cell within
 *     its distance (Moonbeam). Whoever it now covers is caught as `enter` says; the budget is spent.
 *   - `drift`: it moves straight away from its caster as their turn starts (Cloudkill), stopping at
 *     the board's edge, catching whoever it reaches.
 *   - `terrain.difficult`: its cells cost double to move into for whoever it catches, without
 *     doubling ground that is already hard going. `terrain.perDistance`: harm for every distance
 *     moved inside, counted across walks (Spike Growth). A ground-only zone names no triggers.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-moves-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 168);
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
  // Moonbeam, small: a one-cell burst its caster moves 15 feet for an action.
  const beam = spell("beam", {
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 5 },
    concentration: true,
    zone: { rounds: 10, triggers: ["enter", "turn-start"], move: { budget: "action", distance: 15 } },
  });
  // Cloudkill, small: drifts 10 feet away each of its caster's turns.
  const cloud = spell("cloud", {
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 4 },
    damageType: "poison",
    concentration: true,
    zone: { rounds: 10, triggers: ["enter"], drift: { distance: 10 } },
  });
  // Spike Growth, small: hard going, 2 for every 5 feet moved inside, nothing else.
  const spikes = spell("spikes", {
    area: { shape: "burst", size: 5 },
    range: 60,
    damageType: "piercing",
    concentration: true,
    zone: {
      rounds: 10,
      triggers: [],
      atCast: false,
      terrain: { difficult: true, perDistance: { every: 5, amount: { flat: 2 } } },
    },
  });
  // Brambles: 3 for every 10 feet moved inside, and no slower going.
  const brambles = spell("brambles", {
    area: { shape: "burst", size: 5 },
    range: 60,
    damageType: "piercing",
    zone: { rounds: 10, triggers: [], atCast: false, terrain: { perDistance: { every: 10, amount: { flat: 3 } } } },
  });
  const spells = [beam, cloud, spikes, brambles];
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

  // ── Moonbeam: moved on a later turn, for the action, onto B ──
  {
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(fight(), "Beam", { x: 8, y: 7 });
    assert.equal(refused(step as RulesetCombatStep), undefined);
    assert.equal(hp(step.state, "a"), 95, "the cast catches A");
    assert.equal(movesZone(step.state, "mage", "Beam"), false, "the cast spent the action that moves it");
    step = toMage(step.state);
    assert.equal(hp(step.state, "a"), 90, "A started a turn in it");
    const move = rulesetCombatOptions(definition, step.state, "mage").find(
      (one) => one.id === zoneOption(step.state, "Beam"),
    );
    assert.ok(move, "moving it is on the menu");
    assert.equal(move.kind, "move");
    assert.equal(move.budget, "action");
    assert.equal(move.label, "Beam");
    assert.ok(move.cells?.some((cell) => cell.x === 11 && cell.y === 7 && cell.cost === 3));
    assert.equal(
      move.cells?.some((cell) => cell.x === 8 && cell.y === 7),
      false,
      "not onto where it is",
    );
    assert.equal(
      move.cells?.some((cell) => cell.x === 12 && cell.y === 7),
      false,
      "not beyond 15 feet",
    );
    assert.ok(move.cells?.some((cell) => cell.x === 8 && cell.y === 4));
    assert.equal(
      move.cells?.some((cell) => cell.x === 8 && cell.y === 3),
      false,
      "not beyond 15 feet upward either",
    );
    assert.equal(refused(shift(step.state, "Beam", { x: 12, y: 7 }))?.reason, "unreachable");
    const moved = shift(step.state, "Beam", { x: 11, y: 7 });
    assert.equal(refused(moved), undefined, JSON.stringify(refused(moved)));
    assert.deepEqual(
      zoneEvents(moved).map((one) => [one.outcome, one.targetId, one.trigger]),
      [
        ["moved", undefined, undefined],
        ["struck", "b", "enter"],
      ],
    );
    assert.deepEqual(zoneEvents(moved)[0]!.to, { x: 11, y: 7 });
    assert.equal(hp(moved.state, "b"), 95, "it moved onto B");
    assert.equal(hp(moved.state, "a"), 90, "A was left behind");
    assert.equal(rulesetCombatant(moved.state, "mage")!.budgets.action, 0, "the action is spent");
    assert.deepEqual(
      rulesetZonesShown(moved.state)[0]!.cells.some((cell) => cell.x === 11 && cell.y === 7),
      true,
      "the board shows it where it went",
    );
    assert.equal(refused(shift(moved.state, "Beam", { x: 12, y: 7 }))?.reason, "no-budget");
    // A walking back into where it was is caught by nothing.
    let after = end(moved.state);
    after = walk(after.state, "a", { x: 8, y: 8 });
    assert.equal(hp(after.state, "a"), 90);
    // Nobody but its caster moves it, and nothing moves a zone that is gone.
    assert.equal(movesZone(after.state, "a", "Beam"), false);
  }

  // ── Cloudkill: drifts as its caster's turn starts, onto A, and stops at the board's edge ──
  {
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(fight(), "Cloud", {
      x: 5,
      y: 7,
    });
    assert.equal(hp(step.state, "a"), 100, "A is out of it at the cast");
    step = toMage(step.state);
    assert.deepEqual(
      zoneEvents(step).map((one) => [one.outcome, one.targetId]),
      [
        ["drifted", undefined],
        ["struck", "a"],
      ],
    );
    assert.deepEqual(zoneEvents(step)[0]!.to, { x: 7, y: 7 }, "two cells straight away from the mage");
    assert.equal(hp(step.state, "a"), 96, "it drifted onto A");
    step = toMage(step.state);
    assert.deepEqual(zoneEvents(step)[0]!.to, { x: 9, y: 7 });
    assert.equal(hp(step.state, "a"), 96, "A was already in it");
    // Diagonally, and clamped to the board.
    let edge: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(
      fight({ mage: { x: 12, y: 12 } }),
      "Cloud",
      { x: 13, y: 13 },
    );
    edge = toMage(edge.state);
    assert.deepEqual(zoneEvents(edge)[0]!.to, { x: 14, y: 14 }, "stopped at the edge");
    edge = toMage(edge.state);
    assert.equal(
      zoneEvents(edge).some((one) => one.outcome === "drifted"),
      false,
      "nowhere further to go",
    );
    // Centred on its caster it has no "away" and stays.
    let still: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(fight(), "Cloud", {
      x: 2,
      y: 7,
    });
    still = toMage(still.state);
    assert.equal(
      zoneEvents(still).some((one) => one.outcome === "drifted"),
      false,
    );
    // A cloud cannot be moved by hand.
    assert.equal(movesZone(step.state, "mage", "Cloud"), false);
  }

  // ── Spike Growth: hard going and harm for every step inside ──
  {
    const state = fight({ a: { x: 8, y: 6 } });
    const plain = walkCost(end(fight({ a: { x: 8, y: 6 } })).state, "a", { x: 8, y: 9 });
    assert.equal(plain, 3, "three plain steps");
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(state, "Spikes", {
      x: 8,
      y: 7,
    });
    assert.equal(refused(step as RulesetCombatStep), undefined, JSON.stringify(step.events));
    assert.equal(hp(step.state, "a"), 100, "nothing at the cast");
    assert.equal(
      zoneEvents(step)
        .map((one) => one.outcome)
        .join(),
      "appeared",
    );
    step = end(step.state);
    assert.equal(hp(step.state, "a"), 100, "nothing at a turn's start");
    // (8,7) and (8,8) are inside: 2 + 2 + 1.
    assert.equal(walkCost(step.state, "a", { x: 8, y: 9 }), 5, "its cells cost double");
    assert.equal(walkCost(step.state, "a", { x: 8, y: 7 }), 2, "one step into it");
    const walked = walk(step.state, "a", { x: 8, y: 9 });
    assert.equal(refused(walked as RulesetCombatStep), undefined);
    assert.equal(hp(walked.state, "a"), 96, "two steps inside, two each");
    const moved = walked.events.find((one) => one.type === "move");
    assert.equal(moved && moved.type === "move" ? moved.cost : -1, 5, "the walk costs what the menu said");
    assert.deepEqual(
      zoneEvents(walked).map((one) => [one.outcome, one.targetId, one.trigger]),
      [
        ["struck", "a", "moving"],
        ["struck", "a", "moving"],
      ],
    );
    const damage = walked.events.filter((one) => one.type === "damage");
    assert.equal(damage.length, 2);
    // Ground that is already hard going is not doubled again.
    const rough = grid();
    rough.tiles[7]![8] = "forest";
    const roughState = fight({ a: { x: 8, y: 6 } }, rough);
    const roughPlain = walkCost(end(fight({ a: { x: 8, y: 6 } }, rough)).state, "a", { x: 8, y: 7 });
    const roughCast = cast(roughState, "Spikes", { x: 8, y: 7 });
    const roughTurn = end(roughCast.state);
    assert.ok((roughPlain ?? 0) >= 2, "forest is hard going");
    assert.equal(walkCost(roughTurn.state, "a", { x: 8, y: 7 }), roughPlain, "not doubled again");
    // The caster's own side is caught too, as the cast's own area would.
    const own = cast(fight({ mage: { x: 6, y: 7 } }), "Spikes", { x: 8, y: 7 });
    assert.equal(walkCost(own.state, "mage", { x: 7, y: 7 }), 2);
  }

  // ── Brambles: counted across walks ──
  {
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = cast(fight(), "Brambles", {
      x: 8,
      y: 7,
    });
    step = end(step.state);
    assert.equal(walkCost(step.state, "a", { x: 8, y: 8 }), 1, "no slower going");
    step = walk(step.state, "a", { x: 8, y: 8 });
    assert.equal(hp(step.state, "a"), 100, "five feet is not ten");
    step = walk(step.state, "a", { x: 8, y: 6 });
    assert.equal(hp(step.state, "a"), 97, "the next five feet inside makes ten");
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
      {
        kind: "attack",
        area,
        amount: { flat: 1 },
        zone: { rounds: 1, anchor: "caster", triggers: ["enter"], move: { budget: "action", distance: 30 } },
      },
      /Only a burst held at a point/,
    );
    refusedDoc(
      {
        kind: "attack",
        area: { shape: "cone", size: 15 },
        amount: { flat: 1 },
        zone: { rounds: 1, triggers: ["enter"], drift: { distance: 10 } },
      },
      /Only a burst held at a point/,
    );
    refusedDoc(
      { kind: "attack", area, amount: { flat: 1 }, zone: { rounds: 1, triggers: [] } },
      /at least one trigger/,
    );
    refusedDoc({ kind: "attack", area, zone: { rounds: 1, triggers: [], terrain: {} } }, /"terrain" says/);
    refusedDoc(
      { kind: "attack", area, zone: { rounds: 1, triggers: ["enter"], move: { budget: "nope", distance: 30 } } },
      /Unknown budget "nope"/,
    );
    refusedDoc({ kind: "attack", area, zone: { rounds: 1, triggers: ["enter"], drift: { distance: 0 } } }, /0/);
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
      "A ruleset with zones that move or change the ground requires schemaVersion 2 and capabilityApi 1.173 or newer";
    for (const entry of [beam, cloud, spikes]) {
      const withEntry = fiveE((doc) => {
        doc.catalogs.push({ id: "zones", label: "Zones", entries: [entry] });
      });
      assert.equal(getCapabilityPackageInstallIssue(manifest(172) as never, withEntry), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(173) as never, withEntry), gate, entry.id);
    }
    const plainZone = fiveE((doc) => {
      doc.catalogs.push({
        id: "zones",
        label: "Zones",
        entries: [spell("still", { area: { shape: "burst", size: 5 }, zone: { rounds: 1, triggers: ["enter"] } })],
      });
    });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(172) as never, plainZone), gate, "a zone that stays put");
  }

  console.log(
    "Zone moves: Moonbeam moves for an action onto B, Cloudkill drifts and stops at the edge, Spike Growth slows and cuts per step, counted across walks; gated at 1.173.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
