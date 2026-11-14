/**
 * Areas that stay (Capability API 1.172): a zone held where it was cast (Cloudkill), and one carried
 * by its caster (Spirit Guardians).
 *
 *   - The cast catches who is in it unless `atCast: false`, and that counts as their catch this turn.
 *   - `turn-start` and `turn-end` catch whoever starts or ends a turn in it; `enter` whoever walks in,
 *     and whoever a carried zone reaches. Once a turn, whatever the trigger.
 *   - It lasts its rounds of the caster's turns, not counting the casting one, and ends with the
 *     concentration that holds it or the caster's defeat. Casting again replaces it.
 *   - A carried zone never catches its caster, and `friendlyFire: false` leaves their side out.
 *   - Off a board it holds whom it was cast on.
 *   - The view lists it with its cells; import refusals and the install gate.
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
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zones-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 167);
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
      mechanics: { kind: "attack", autoHit: true, damageType: "poison", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Cloudkill, small: a one-cell burst that stays two of its caster's turns.
  const cloud = spell("cloud", {
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 5 },
    concentration: true,
    zone: { rounds: 2, triggers: ["enter", "turn-start"] },
  });
  // Spirit Guardians, small: around its caster, enemies only, nothing as it appears.
  const guard = spell("guard", {
    area: { shape: "burst", size: 5 },
    range: 0,
    friendlyFire: false,
    amount: { flat: 3 },
    damageType: "radiant",
    concentration: true,
    zone: { rounds: 10, anchor: "caster", triggers: ["enter", "turn-end"], atCast: false },
  });
  // A zone nothing concentrates on.
  const mire = spell("mire", {
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 1 },
    zone: { rounds: 10, triggers: ["turn-start"] },
  });
  const other = spell("other", { amount: { flat: 1 }, concentration: true, range: 60 });
  const spells = [cloud, guard, mire, other];
  const block: RulesetStatBlock = { health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  const fight = (board = true): RulesetEncounterState => {
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
        {
          id: "friend",
          name: "Friend",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 10, speed: 30, hp_max: 100 },
          }),
          live: {},
        },
      ],
      ...(board
        ? {
            board: {
              grid: grid(),
              placements: { mage: { x: 2, y: 7 }, a: { x: 8, y: 7 }, b: { x: 11, y: 7 }, friend: { x: 3, y: 7 } },
            },
          }
        : {}),
    });
    state.order = ["mage", "a", "b", "friend"];
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
  const cast = (state: RulesetEncounterState, label: string, at: { x: number; y: number }, targetIds: string[] = []) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, "mage", label).id, targetIds, at },
      roll,
    );
  const walk = (state: RulesetEncounterState, actorId: string, to: { x: number; y: number }) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to }, roll);
  const end = (state: RulesetEncounterState) => advanceRulesetTurn(definition, state, roll);
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const zoneEvents = (step: RulesetCombatStep) =>
    step.events.filter((one): one is Extract<RulesetCombatEvent, { type: "zone" }> => one.type === "zone");
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");

  // ── Cloudkill: the cast, a turn started in it, a walk in, once a turn, and its rounds ──
  {
    let step = cast(fight(), "Cloud", { x: 8, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "a"), 95, "the cast catches A");
    assert.deepEqual(
      zoneEvents(step).map((one) => one.outcome),
      ["appeared"],
    );
    assert.deepEqual(rulesetZonesShown(step.state)[0]!.cells.length, 9, "a one-cell burst is nine squares");
    step = end(step.state); // A's turn starts in it.
    assert.equal(hp(step.state, "a"), 90, "a turn started in it");
    assert.deepEqual(
      zoneEvents(step).map((one) => [one.outcome, one.targetId, one.trigger]),
      [["struck", "a", "turn-start"]],
    );
    // A walks out and back in on the same turn: caught once a turn already.
    step = walk(step.state, "a", { x: 8, y: 10 });
    step = walk(step.state, "a", { x: 8, y: 8 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.deepEqual(rulesetCombatant(step.state, "a")!.x, 8);
    assert.equal(hp(step.state, "a"), 90, "not again this turn");
    step = end(step.state); // B's turn: B walks in.
    step = walk(step.state, "b", { x: 9, y: 7 });
    assert.equal(hp(step.state, "b"), 95, "walking in");
    assert.equal(zoneEvents(step)[0]?.trigger, "enter");
    step = end(step.state); // Friend.
    step = end(step.state); // The mage's turn: the cast turn did not count, this is the first of two.
    step = end(step.state); // A starts in it again.
    assert.equal(hp(step.state, "a"), 85);
    step = end(step.state); // B.
    step = end(step.state); // Friend.
    step = end(step.state); // Mage: its second turn ends next.
    assert.equal(rulesetZonesShown(step.state).length, 1);
    step = end(step.state);
    assert.equal(rulesetZonesShown(step.state).length, 0, "two of its caster's turns");
    assert.ok(zoneEvents(step).some((one) => one.outcome === "ended"));
    assert.equal(hp(step.state, "a"), 85, "gone before A's turn");
  }

  // ── Whoever the cast caught counts as caught on the casting turn; casting it again replaces it ──
  {
    const step = cast(fight(), "Cloud", { x: 8, y: 7 });
    assert.deepEqual(rulesetCombatant(step.state, "mage")!.zones![0]!.struck, { a: "1:0" });
    let later = step;
    for (let turn = 0; turn < 4; turn++) later = end(later.state);
    const again = cast(later.state, "Cloud", { x: 11, y: 7 });
    assert.equal(refused(again), undefined, JSON.stringify(refused(again)));
    assert.equal(rulesetCombatant(again.state, "mage")!.zones!.length, 1, "replaced");
    assert.ok(zoneEvents(again).some((one) => one.outcome === "ended"));
  }

  // ── One without concentration is replaced by casting it again too ──
  {
    let step = cast(fight(), "Mire", { x: 8, y: 7 });
    for (let turn = 0; turn < 4; turn++) step = end(step.state);
    step = cast(step.state, "Mire", { x: 11, y: 7 });
    assert.equal(rulesetCombatant(step.state, "mage")!.zones!.length, 1, "replaced");
    assert.equal(
      rulesetZonesShown(step.state)[0]!.cells.some((cell) => cell.x === 11),
      true,
    );
  }

  // ── Concentration on something else ends it ──
  {
    let step = cast(fight(), "Cloud", { x: 8, y: 7 });
    for (let turn = 0; turn < 4; turn++) step = end(step.state);
    step = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "mage", optionId: optionOf(step.state, "mage", "Other").id, targetIds: ["b"] },
      roll,
    );
    assert.equal(rulesetZonesShown(step.state).length, 0, "its concentration went to another spell");
  }

  // ── Spirit Guardians: around the caster, nothing as it appears, enemies only, carried onto them ──
  {
    let step = cast(fight(), "Guard", { x: 2, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "friend"), 100);
    assert.equal(hp(step.state, "mage"), hp(fight(), "mage"), "never its caster");
    const shown = rulesetZonesShown(step.state)[0]!;
    assert.ok(shown.cells.some((cell) => cell.x === 3 && cell.y === 7));
    step = walk(step.state, "mage", { x: 7, y: 7 }); // Carried onto A.
    assert.equal(hp(step.state, "a"), 97, "carried onto A");
    assert.equal(hp(step.state, "friend"), 100, "its own side left out");
    assert.ok(
      rulesetZonesShown(step.state)[0]!.cells.some((cell) => cell.x === 8 && cell.y === 7),
      "it moved",
    );
    step = end(step.state);
    assert.equal(hp(step.state, "mage"), hp(fight(), "mage"));
    assert.equal(hp(step.state, "a"), 97, "starting a turn in it is not one of its triggers");
    step = end(step.state); // A ends its turn in it.
    assert.equal(hp(step.state, "a"), 94, "a turn ended in it");
    step = end(step.state); // B ends: Friend's turn.
    step = walk(step.state, "friend", { x: 7, y: 8 }); // Friend walks in.
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "friend"), 100, "its own side walks in untouched");
  }

  // ── Nothing as it appears, even with an enemy beside its caster ──
  {
    const near = walk(fight(), "mage", { x: 7, y: 7 });
    const step = cast(near.state, "Guard", { x: 7, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "a"), 100, "atCast: false");
  }

  // ── Off a board it holds whom it was cast on ──
  {
    let step = applyRulesetCombatChoice(
      definition,
      fight(false),
      { actorId: "mage", optionId: optionOf(fight(false), "mage", "Cloud").id, targetIds: ["a"] },
      roll,
    );
    assert.equal(hp(step.state, "a"), 95);
    step = end(step.state);
    assert.equal(hp(step.state, "a"), 90, "held: its turn starts in it");
    step = end(step.state);
    assert.equal(hp(step.state, "b"), 100, "not held");
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
    refusedDoc({ kind: "attack", amount: { flat: 1 }, zone: { rounds: 1, triggers: ["enter"] } }, /needs an area/);
    refusedDoc(
      {
        kind: "attack",
        area: { shape: "box", size: 15 },
        amount: { flat: 1 },
        zone: { rounds: 1, anchor: "caster", triggers: ["enter"] },
      },
      /burst around them/,
    );
    refusedDoc(
      { kind: "attack", area: { shape: "burst", size: 5 }, zone: { rounds: 1, triggers: ["enter", "enter"] } },
      /named once/,
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
    const gate = "A ruleset with lasting zones requires schemaVersion 2 and capabilityApi 1.172 or newer";
    const withCloud = fiveE((doc) => {
      doc.catalogs.push({ id: "zones", label: "Zones", entries: [cloud] });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(171) as never, withCloud), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(172) as never, withCloud), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(171) as never, fiveE()), gate, "nothing without the key");
  }

  console.log(
    "Zones: Cloudkill catches at the cast, a turn's start and a walk in, once a turn; Spirit Guardians goes with its caster; gated at 1.172.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
