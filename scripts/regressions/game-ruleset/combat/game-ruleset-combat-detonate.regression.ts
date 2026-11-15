/**
 * Zones that go off later or burn away (Capability API 1.183).
 *
 *   - `zone.detonates`: nothing as it is cast or while it stands; when it ends it does the entry's own
 *     effect once, grown by `grows` for each of its caster's turns that ended, and `touched` sets it
 *     off when somebody steps onto its middle and fails the save (5e's Delayed Blast Fireball).
 *   - `zone.burns`: damage of a named type reaching it sets it alight; it burns whoever starts a turn
 *     in it and is gone, spell and all, when its caster's turn comes round (5e's Web).
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-detonate-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 178);
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
  const spell = (id: string, mechanics: Record<string, unknown>, level = 1) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // Delayed Blast Fireball, small: 2d6 fire in a burst, a Dex save for half, 1d6 more each turn.
  const beadMechanics = (zone: Record<string, unknown> = {}) => ({
    kind: "attack",
    area: { shape: "burst", size: 20 },
    range: 150,
    amount: { dice: "2d6" },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
    concentration: true,
    zone: { rounds: 10, triggers: [], detonates: { grows: { dice: "1d6" }, touched: true }, ...zone },
  });
  const bead = spell("bead", beadMechanics());
  const shortBead = spell("shortbead", beadMechanics({ rounds: 1 }));
  // Web, burning for 2d4 fire.
  const web = spell("web", {
    kind: "debuff",
    area: { shape: "burst", size: 10 },
    range: 60,
    concentration: true,
    zone: {
      rounds: 10,
      triggers: [],
      terrain: { difficult: true },
      burns: { by: ["fire"], amount: { dice: "2d4" }, damageType: "fire" },
    },
  });
  const firebolt = spell("firebolt", {
    kind: "attack",
    autoHit: true,
    range: 120,
    amount: { flat: 5 },
    damageType: "fire",
  });
  const frost = spell("frost", { kind: "attack", autoHit: true, range: 120, amount: { flat: 5 }, damageType: "cold" });
  const flame = spell("flame", {
    kind: "attack",
    area: { shape: "burst", size: 5 },
    range: 120,
    amount: { flat: 1 },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
  });
  const spells = [bead, shortBead, web, firebolt, frost, flame];
  const definition = parsed(
    fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { dex_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 24,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")),
  });
  // A d20 shows 10; every damage die shows 3.
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const fight = (
    options: {
      placements?: Record<string, { x: number; y: number }>;
      a?: Partial<RulesetStatBlock>;
      b?: Partial<RulesetStatBlock>;
    } = {},
  ): RulesetEncounterState => {
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
              level: 9,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 9,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block: block(options.a) },
        { id: "b", name: "B", side: "enemy", block: block(options.b) },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 10, y: 7 }, b: { x: 20, y: 7 }, ...options.placements },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const cast = (
    state: RulesetEncounterState,
    label: string,
    choice: { at?: RulesetCombatCell; targetIds?: string[] },
  ) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `the mage has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: choice.targetIds ?? [], ...choice },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };
  const untilTurnOf = (state: RulesetEncounterState, id: string, events: RulesetCombatEvent[] = []) => {
    let next = state;
    do {
      const step = advanceRulesetTurn(definition, next, roll);
      events.push(...step.events);
      next = step.state;
    } while (next.order[next.turn] !== id);
    return next;
  };
  const zoneEvents = (events: RulesetCombatEvent[], outcome: string) =>
    events.filter((one) => one.type === "zone" && one.outcome === outcome);

  // ── Delayed Blast Fireball: nothing at the cast, grows, goes off when it ends ──
  {
    const step = cast(fight(), "Shortbead", { at: { x: 10, y: 7 } });
    assert.equal(hp(step.state, "a"), 100, "nothing as it is cast");
    assert.ok(!step.events.some((one) => one.type === "save"));
    const events: RulesetCombatEvent[] = [];
    let state = untilTurnOf(step.state, "mage", events);
    assert.equal(who(state, "mage").zones?.[0]?.grown, 1, "it grew as the mage's turn ended");
    assert.equal(hp(state, "a"), 100, "and still nothing");
    // Its one round runs out as the mage's next turn ends: 2d6 + 2d6 grown, all threes.
    state = untilTurnOf(state, "a", events);
    assert.equal(zoneEvents(events, "detonated").length, 1);
    assert.equal(hp(state, "a"), 100 - 12, "four threes, a failed save");
    assert.equal(who(state, "mage").zones, undefined, "and it is gone");
    // Its concentration ending sets it off too: a fresh bead, let go by casting another.
    const held = cast(fight(), "Bead", { at: { x: 10, y: 7 } });
    const again = untilTurnOf(held.state, "mage");
    const recast = cast(again, "Shortbead", { at: { x: 18, y: 2 } });
    assert.equal(zoneEvents(recast.events, "detonated").length, 1, "letting go of it sets it off");
    assert.equal(hp(recast.state, "a"), 100 - 9, "2d6 and the 1d6 it grew");
  }

  // ── Touching the bead ──
  {
    const touch = (b: Partial<RulesetStatBlock>) => {
      const step = cast(fight({ placements: { a: { x: 4, y: 12 }, b: { x: 10, y: 9 } }, b }), "Bead", {
        at: { x: 10, y: 7 },
      });
      const state = untilTurnOf(step.state, "b");
      return applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "b", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 10, y: 7 } },
        roll,
      );
    };
    const failed = touch({});
    assert.equal(refused(failed), undefined);
    assert.equal(zoneEvents(failed.events, "detonated").length, 1, "B steps on it and fails");
    assert.equal(hp(failed.state, "b"), 100 - 9);
    assert.equal(who(failed.state, "mage").concentrating, null, "the spell is over");
    assert.ok(
      failed.events.some((one) => one.type === "concentration" && one.state === "ended" && one.reason === "spent"),
    );
    const caught = touch({ saves: { dex_save: 30 } });
    assert.equal(zoneEvents(caught.events, "detonated").length, 0, "B saves and it holds");
    assert.equal(who(caught.state, "mage").zones?.length, 1);
  }

  // ── Fire burns a web away ──
  {
    const webbed = (placements: Record<string, { x: number; y: number }> = {}) => {
      const step = cast(fight({ placements }), "Web", { at: { x: 10, y: 7 } });
      who(step.state, "mage").budgets.action = 1;
      return step.state;
    };
    // Cold does nothing to it.
    const cold = cast(webbed(), "Frost", { targetIds: ["a"] });
    assert.equal(zoneEvents(cold.events, "burning").length, 0);
    // Fire on somebody inside sets it alight.
    const lit = cast(webbed(), "Firebolt", { targetIds: ["a"] });
    assert.equal(zoneEvents(lit.events, "burning").length, 1);
    assert.equal(who(lit.state, "mage").zones?.[0]?.burning, true);
    const events: RulesetCombatEvent[] = [];
    let state = untilTurnOf(lit.state, "a", events);
    assert.equal(hp(state, "a"), 100 - 5 - 6, "A starts its turn in the fire: 2d4, all threes, no save");
    state = untilTurnOf(state, "b", events);
    assert.equal(hp(state, "b"), 100, "B, outside it, is not");
    state = untilTurnOf(state, "mage", events);
    assert.equal(who(state, "mage").zones, undefined, "burned away as the mage's turn comes round");
    assert.equal(who(state, "mage").concentrating, null);
    assert.equal(zoneEvents(events, "ended").length, 1);
    // Fire landing on the web where nobody stands.
    const empty = cast(webbed(), "Flame", { at: { x: 12, y: 9 } });
    assert.equal(zoneEvents(empty.events, "burning").length, 1, "an area of fire on its edge");
    const missed = cast(webbed(), "Flame", { at: { x: 16, y: 2 } });
    assert.equal(zoneEvents(missed.events, "burning").length, 0, "and not one that misses it");
    // A bead going off on a web sets it alight.
    const both = webbed({ a: { x: 20, y: 2 } });
    who(both, "mage").concentrating = null;
    const placed = cast(both, "Shortbead", { at: { x: 10, y: 7 } });
    const blasted: RulesetCombatEvent[] = [];
    untilTurnOf(untilTurnOf(placed.state, "mage", blasted), "a", blasted);
    assert.equal(zoneEvents(blasted, "detonated").length, 1);
    assert.equal(zoneEvents(blasted, "burning").length, 1, "the blast lights the web");
  }

  // ── Import refusals ──
  {
    const refusedDoc = (mechanics: Record<string, unknown>, message: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell("x", mechanics)] });
        }),
      );
      assert.equal(result.ok, false, `expected a refusal matching ${message}`);
      assert.ok(
        !result.ok && result.issues.some((issue) => message.test(issue)),
        !result.ok ? result.issues.join("; ") : "",
      );
    };
    const withZone = (zone: Record<string, unknown>, rest: Record<string, unknown> = {}) => ({
      ...beadMechanics(),
      zone: { rounds: 1, triggers: [], ...zone },
      ...rest,
    });
    refusedDoc(
      withZone({ anchor: "caster", detonates: { touched: true } }),
      /A zone that goes off stays where it is cast/,
    );
    refusedDoc(withZone({ detonates: {} }), /"detonates" says how it/);
    refusedDoc(withZone({ detonates: { grows: {} } }), /"grows" names dice/);
    refusedDoc(withZone({ detonates: { grows: { dice: "1d8" } } }), /"grows" rolls the same dice/);
    refusedDoc(
      withZone({ detonates: { grows: { dice: "1d6" } } }, { amount: undefined }),
      /What "grows" is the entry's own amount/,
    );
    refusedDoc(withZone({ detonates: { touched: true } }, { save: undefined }), /Whoever touches it rolls/);
    refusedDoc(withZone({ burns: { by: ["glitter"] } }), /Unknown damage type "glitter"/);
    refusedDoc(withZone({ burns: { by: ["fire"], amount: { dice: "2d4" } } }), /has a "damageType"/);
    refusedDoc(
      withZone({ burns: { by: ["fire"], amount: { dice: "2d4" }, damageType: "glitter" } }),
      /Unknown damage type "glitter"/,
    );
    // A flat growth needs no dice of its own.
    parsed(
      fiveE((doc) => {
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [spell("x", withZone({ detonates: { grows: { flat: 2 } } }))],
        });
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
      "A ruleset with zones that go off later or burn away requires schemaVersion 2 and capabilityApi 1.183 or newer";
    const withEntries = (entries: unknown[]) =>
      fiveE((doc) => {
        doc.catalogs.push({ id: "x", label: "X", entries });
      });
    const docs: Array<[string, Record<string, any>]> = [
      ["detonates", withEntries([bead])],
      ["burns", withEntries([web])],
      [
        "item use",
        withEntries([
          {
            id: "i",
            label: "I",
            item: { category: "gear", use: { kind: "utility", zone: { rounds: 1, burns: { by: ["fire"] } } } },
          },
        ]),
      ],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(182) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(183) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(182) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset detonations: a bead grows each turn and goes off when its spell ends or somebody steps on it, and fire burns a web away, burning whoever starts a turn in it.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
