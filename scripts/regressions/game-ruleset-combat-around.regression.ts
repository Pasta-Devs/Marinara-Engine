/**
 * Bursts centred on their user (Capability API 1.282).
 *
 *   - `area.around` on a creature's action: a mummy lord's Channel Negative Energy, bought with
 *     points between turns. Never aimed: everybody within its size of the mummy lord is caught, the
 *     mummy lord is not, and what it puts on lasts until the end of its next turn.
 *   - `area.throughWalls`: "including ones behind barriers and around corners". Without it a wall
 *     keeps a creature out of the burst.
 *   - `friendlyFire: false` spares its own side; off a board it catches everybody.
 *   - The same on a catalog entry, used on its user's turn.
 *   - The director weighs one by whom it catches: a creature stomps when that beats its slam.
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
  currentRulesetActor,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  defaultRulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import { rulesetZoneCells } from "../../packages/shared/src/features/ruleset-combat/grid.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-around-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 277);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "unhealing", label: "Negative energy" });
    doc.combat.conditions.push({ condition: "unhealing", effects: ["cannot-heal"] });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(fiveE(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // A catalog burst around its caster that spares the caster's own side.
  const nova = spell("nova", {
    kind: "attack",
    autoHit: true,
    amount: { flat: 4 },
    damageType: "radiant",
    area: { shape: "burst", size: 10, around: true },
    friendlyFire: false,
  });
  const spells = [nova];
  const definition = parsed(
    fiveE((doc) => doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells })),
  );
  const channel = (extra: Record<string, unknown> = {}) => ({
    id: "channel",
    name: "Channel Negative Energy",
    budget: "action",
    signature: { cost: 2 },
    area: { shape: "burst", size: 60, around: true, throughWalls: true },
    applies: [{ condition: "unhealing", duration: { rounds: 1, of: "source" } }],
    ...extra,
  });
  const slam = { id: "slam", name: "Slam", budget: "action", toHit: 9, reach: 5, damage: { count: 1, sides: 6 } };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  // A wall down column 10, so the far hero stands behind it.
  const grid: TacticalGrid = {
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array.from({ length: 30 }, (_, x) => (x === 10 ? "wall" : "plains"))),
  };
  const fight = (options: { board?: false; action?: Record<string, unknown> } = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        { id: "near", name: "Near", side: "party", build, live: {}, catalogs: { spells } },
        { id: "behind", name: "Behind", side: "party", build, live: {} },
        { id: "far", name: "Far", side: "party", build, live: {} },
        {
          id: "mummy",
          name: "Mummy Lord",
          side: "enemy",
          block: {
            health: 97,
            defense: 17,
            initiativeModifier: 0,
            speed: 20,
            signaturePoints: 3,
            actions: [slam, options.action ?? channel()],
          } as unknown as RulesetStatBlock,
        },
        {
          id: "ghoul",
          name: "Ghoul",
          side: "enemy",
          block: { health: 22, defense: 12, initiativeModifier: 0, speed: 30, actions: [slam] } as never,
        },
      ],
      ...(options.board === false
        ? {}
        : {
            board: {
              grid,
              // Twelve cells is sixty feet.
              placements: {
                near: { x: 6, y: 7 },
                behind: { x: 12, y: 7 },
                far: { x: 25, y: 0 },
                mummy: { x: 8, y: 7 },
                ghoul: { x: 8, y: 11 },
              },
            },
          }),
    });
    state.order = ["near", "behind", "far", "mummy", "ghoul"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const holds = (state: RulesetEncounterState, id: string) =>
    who(state, id).tracked.some((entry) => entry.condition === "unhealing");
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const channelled = (state: RulesetEncounterState) => {
    const ended = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "near", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(ended.state.window?.kind, "signature");
    const offered = rulesetWindowOptions(definition, ended.state, "mummy").find((one) => one.id === "channel");
    assert.ok(offered, "the mummy lord may channel between turns");
    assert.deepEqual(offered!.targets, { side: "self", count: 0 }, "aimed at nobody");
    const step = applyRulesetCombatChoice(
      definition,
      ended.state,
      { actorId: "mummy", optionId: "channel", targetIds: [], window: ended.state.window!.id },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };

  // ── Channel Negative Energy: everybody within 60 feet, behind walls too, never the mummy lord ──
  {
    const step = channelled(fight());
    assert.ok(holds(step.state, "near"), "the hero beside it");
    assert.ok(holds(step.state, "behind"), "the hero behind the wall");
    assert.ok(holds(step.state, "ghoul"), "its own side too");
    assert.ok(!holds(step.state, "far"), "not the hero past 60 feet");
    assert.ok(!holds(step.state, "mummy"), "not the mummy lord itself");
    assert.equal(who(step.state, "mummy").signature!.points, 1, "two points spent");
  }

  // ── Bought between turns, what stays is laid: a kraken's Ink Cloud, doing nothing as it appears ──
  for (const anchor of ["caster", undefined]) {
    const step = channelled(
      fight({
        action: channel({
          zone: { rounds: 1, triggers: ["turn-end"], atCast: false, ...(anchor ? { anchor } : {}) },
        }),
      }),
    );
    assert.ok(!holds(step.state, "near"), "nobody caught as it appears");
    const mummy = who(step.state, "mummy");
    assert.deepEqual(
      (mummy.zones ?? []).map((one) => one.actionId),
      ["channel"],
      "the zone is laid",
    );
    // Around where the mummy lord stands, sixty feet every way, as on its own turn.
    const cells = rulesetZoneCells(step.state, mummy, mummy.zones![0]!);
    const has = (x: number, y: number) => cells.some((cell) => cell.x === x && cell.y === y);
    assert.ok(has(8, 7) && has(6, 7) && has(12, 7) && has(8, 11), `${anchor ?? "point"}: its cells are laid`);
    assert.ok(!has(25, 0), "and not past sixty feet");
    // And whoever ends a turn in it from then on is caught: the hero behind the wall, next up.
    assert.equal(currentRulesetActor(step.state)?.id, "behind");
    const ended = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "behind", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.ok(holds(ended.state, "behind"), `${anchor ?? "point"}: caught as its turn ends there`);
  }

  // ── Without throughWalls, the wall keeps the hero behind it out ──
  {
    const step = channelled(fight({ action: channel({ area: { shape: "burst", size: 60, around: true } }) }));
    assert.ok(holds(step.state, "near"));
    assert.ok(!holds(step.state, "behind"), "the wall stops it");
  }

  // ── Sparing its own side, and off a board everybody ──
  {
    const spared = channelled(
      fight({
        action: channel({ area: { shape: "burst", size: 60, around: true, throughWalls: true, friendlyFire: false } }),
      }),
    );
    assert.ok(holds(spared.state, "near"));
    assert.ok(!holds(spared.state, "ghoul"), "its own side spared");
    const plain = channelled(fight({ board: false }));
    for (const id of ["near", "behind", "far", "ghoul"]) assert.ok(holds(plain.state, id), `${id}, off a board`);
    assert.ok(!holds(plain.state, "mummy"));
  }

  // ── A catalog entry around its caster, on the caster's turn ──
  {
    const state = fight();
    // The mummy lord beside the caster, the ghoul out of 10 feet, and a friend beside the caster.
    who(state, "behind").x = 5;
    const option = rulesetCombatOptions(definition, state, "near").find((one) => one.label === "Nova");
    assert.ok(option, "offered");
    assert.deepEqual(option!.targets, { side: "self", count: 0 });
    assert.equal(option!.area, undefined, "nothing to aim");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "near", optionId: option!.id, targetIds: [] },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    const hurt = (id: string) => step.events.some((one) => one.type === "damage" && one.targetId === id);
    assert.ok(hurt("mummy"), "the mummy lord two cells off");
    assert.ok(!hurt("ghoul"), "not the ghoul past 10 feet");
    assert.ok(!hurt("near"), "nor the caster");
    assert.ok(!hurt("behind"), "nor the friend beside it");
  }

  // ── The director stomps when the burst around it does more than its slam ──
  {
    const withLord = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const lord = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        lord.id = "lord";
        lord.label = "Mummy Lord";
        lord.creature.actions = [
          { ...slam, damage: { dice: "1d4" } },
          {
            id: "stomp",
            name: "Stomp",
            budget: "action",
            autoHit: true,
            damage: { dice: "3d6", flat: 4, type: "thunder" },
            area: { shape: "burst", size: 15, around: true },
          },
        ];
        creatures.entries.push(lord);
      }),
    );
    const bestiary = Object.fromEntries(
      (withLord.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (withLord.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition: withLord,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "lord", name: "Mummy Lord", creature: `${creaturesId}/lord` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(withLord) } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "Ada", "player")],
      enemies: [unit("lord", "Mummy Lord", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    syncRulesetCombatants(withLord, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(withLord, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(withLord, state, { type: "continue" }).ok);
    }
    const events = state.rulesetFight!.events.map((entry) => entry.event);
    assert.ok(
      events.some((event) => event.type === "damage" && event.targetId === "ada" && event.label === "Stomp"),
      "the creature stomped",
    );
  }

  // ── Import refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [spell("t", mechanics)] });
    };
    refusedDoc(
      withSpell({ kind: "attack", amount: { flat: 1 }, area: { shape: "cone", size: 15, around: true } }),
      /Only a single burst is centred on its user/,
    );
    refusedDoc(
      withSpell({ kind: "attack", amount: { flat: 1 }, area: { shape: "burst", size: 15, around: true, copies: 2 } }),
      /Only a single burst is centred on its user/,
    );
    refusedDoc(
      withSpell({ kind: "attack", amount: { flat: 1 }, area: { shape: "burst", size: 15, throughWalls: true } }),
      /Only a burst centred on its user goes through walls/,
    );
    refusedDoc(
      withSpell({
        kind: "utility",
        area: { shape: "burst", size: 15, around: true },
        zone: { rounds: 10, triggers: ["enter"] },
      }),
      /A burst centred on its user lands at once, so it leaves no zone/,
    );
    const withCreature = (area: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [
          {
            id: "d",
            label: "D",
            creature: {
              health: 10,
              defense: 10,
              initiativeModifier: 0,
              speed: 30,
              tier: "cr_0",
              actions: [{ id: "a", name: "A", budget: "action", area, damage: { dice: "1d6" }, autoHit: true }],
            },
          },
        ],
      });
    };
    parsed(fiveE(withCreature({ shape: "burst", size: 60, around: true, throughWalls: true })));
    refusedDoc(withCreature({ shape: "line", size: 60, around: true }), /Only a single burst is centred on its user/);
    refusedDoc(
      withCreature({ shape: "burst", size: 60, throughWalls: true }),
      /Only a burst centred on its user goes through walls/,
    );
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
    const gate = "A ruleset with a burst centred on its user requires schemaVersion 2 and capabilityApi 1.282 or newer";
    const docs: Array<[string, Record<string, any>]> = [
      ["spell", fiveE((doc) => doc.catalogs.push({ id: "x", label: "X", entries: [nova] }))],
      [
        "creature",
        fiveE((doc) =>
          doc.catalogs.push({
            id: "x",
            label: "X",
            entries: [{ id: "a", label: "A", creature: { actions: [channel()] } }],
          }),
        ),
      ],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(281) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(282) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(281) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset bursts around their user: a mummy lord's Channel Negative Energy catches everybody within 60 feet, behind walls too, but never itself; a wall stops one that does not go through; a spell around its caster spares its side.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
