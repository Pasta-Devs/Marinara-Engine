/**
 * Shade, a board's light rule, and chimes (Capability API 1.319).
 *
 *   - A light with `shade` sheds dim light as far as it reaches, and makes bright light and sunlight
 *     there dim: the showcase's Lantern of Dusk. Only a magical one shades magical darkness.
 *   - A board's `lightRule`: every `rounds` round ends spent wholly in one of its lights, its tracks
 *     move and its conditions go on; shade keeps it off; `spares` keeps it off its own creatures.
 *   - A creature's `stillIn`: it does not move while in one of those lights, Lantern-Shy.
 *   - `alerts`: whoever moves hidden near an opponent holding it is given away, the Wind-Chime.
 *   - A cell's own light (1.318) is read by sight too: a dark cell on a bright board hides.
 *   - Painted on a battlefield, the rule reaches the fight; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_MOVE_OPTION,
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetBoardShading,
  rulesetCanSee,
  rulesetCombatOptions,
  rulesetCombatant,
  rulesetCreatureBlock,
  rulesetLightAt,
  rulesetLightOf,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  worldBattlefieldBlankRows,
  worldBattlefieldMapSchema,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-shade-chimes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createRulesetFight } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 319);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.combat.creatureTypes = {
      types: ["humanoid", "elemental"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    doc.sheet.live.conditions.push(
      { id: "sunstruck", label: "Sunstruck" },
      { id: "dusky", label: "Dusky" },
      { id: "alarmed", label: "Alarmed" },
    );
    doc.combat.conditions.push(
      { condition: "sunstruck" },
      { condition: "dusky", light: { bright: 0, dim: 10, shade: true, magical: true } },
      { condition: "alarmed", alerts: 15 },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const issuesOf = (document: unknown) => {
    const result = parseRulesetDefinition(document);
    return result.ok ? [] : result.issues;
  };
  const definition = parsed(fiveE());
  // A catalog's Wind-Chime, whose effect only gives movers away, and Lantern of Dusk are read.
  const valley = parsed(
    fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "valley",
        label: "Valley",
        holds: "items",
        entries: [
          { id: "wind-chime", label: "Wind-Chime", item: { category: "gear", carried: { alerts: 15 } } },
          {
            id: "lantern-of-dusk",
            label: "Lantern of Dusk",
            item: { category: "gear", carried: { light: { bright: 0, dim: 15, shade: true } } },
          },
        ],
      });
    }),
  );
  const valleyItems = valley.catalogs!.find((catalog) => catalog.id === "valley")!.entries!;
  assert.equal(valleyItems[0]!.item?.carried?.alerts, 15);
  assert.equal(valleyItems[1]!.item?.carried?.light?.shade, true);
  const gear = (name: string, carried: Record<string, unknown>): RulesetSheetItem =>
    ({ name, quantity: 1, worn: false, item: { category: "gear", carried } }) as never;
  const lantern = gear("Lantern of Dusk", { light: { bright: 0, dim: 15, shade: true } });
  const chime = gear("Wind-Chime", { alerts: 15 });
  const build = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 10, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
    });
  const brute = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      checks: { look: 0, sneak: 3 },
      actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 6, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 16,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")),
  });
  const fight = (
    options: {
      items?: RulesetSheetItem[];
      light?: "bright" | "sunlight" | "dim" | "dark";
      lightRule?: Record<string, unknown>;
      ground?: Record<string, unknown>;
      at?: Record<string, { x: number; y: number }>;
      enemy?: Partial<RulesetStatBlock>;
    } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: build(),
          live: {},
          ...(options.items ? { items: options.items } : {}),
        },
        { id: "imp", name: "Imp", side: "enemy", block: brute(options.enemy) },
        { id: "rat", name: "Rat", side: "enemy", block: brute() },
      ],
      board: {
        grid: grid(),
        placements: options.at ?? { ada: { x: 2, y: 2 }, imp: { x: 12, y: 2 }, rat: { x: 14, y: 8 } },
        ...(options.light ? { light: options.light } : {}),
        ...(options.lightRule ? { lightRule: options.lightRule } : {}),
        ...(options.ground ? { ground: options.ground } : {}),
      } as never,
    });
    state.order = ["ada", "imp", "rat"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const light = (state: RulesetEncounterState, x: number, y: number) => rulesetLightAt(definition, state, { x, y });
  /** On to the next round: the last turn ends. */
  const nextRound = (state: RulesetEncounterState) => {
    state.turn = state.order.length - 1;
    return advanceRulesetTurn(definition, state, () => 10);
  };

  // ── Shade ──
  {
    // Read and refused.
    assert.equal(
      issuesOf(
        fiveE((doc) =>
          doc.combat.conditions.push({ condition: "sunstruck", light: { bright: 5, dim: 5, shade: true } }),
        ),
      ).some((issue) => issue.includes("A shade sheds no bright light")),
      true,
    );
    // In the noon sun: dim within three cells of the lantern, sunlight past it.
    const noon = fight({ items: [lantern], light: "sunlight" });
    assert.deepEqual(rulesetLightOf(definition, who(noon, "ada"), noon), { bright: 0, dim: 0, shade: { reach: 3 } });
    assert.equal(light(noon, 2, 2), "dim");
    assert.equal(light(noon, 5, 5), "dim", "three cells away");
    assert.equal(light(noon, 6, 2), "sunlight");
    assert.equal(rulesetBoardShading(definition, noon).light["5,2"], "dim");
    assert.equal(rulesetBoardShading(definition, noon).light["6,2"], "sunlight");
    // In the dark it lights as dim light.
    const night = fight({ items: [lantern], light: "dark" });
    assert.equal(light(night, 4, 2), "dim");
    assert.equal(light(night, 9, 2), "dark");
    // A bright light beside it is dimmed where the shade reaches too.
    const both = fight({ items: [lantern, gear("Torch", { light: { bright: 20, dim: 20 } })], light: "dark" });
    assert.equal(light(both, 3, 2), "dim", "shade beats a torch's bright light");
    assert.equal(light(both, 6, 2), "bright", "the torch past the shade");
    // A wall keeps the shade out, as it does light.
    const walled = fight({ items: [lantern], light: "sunlight" });
    walled.board!.grid.tiles[2]![3] = "wall";
    assert.equal(light(walled, 4, 2), "sunlight");
    // Out of sight in shade on a bright board: a cell's own darkness and shade are read by eyes too.
    const seen = fight({ light: "bright", ground: { "12,2": { light: "dark" } } });
    assert.equal(rulesetCanSee(definition, seen, who(seen, "ada"), who(seen, "imp")), false, "standing in a dark cell");
    assert.equal(rulesetCanSee(definition, seen, who(seen, "ada"), who(seen, "rat")), true);
    // A condition's shade works as an item's.
    const spelled = fight({ light: "sunlight" });
    who(spelled, "ada").tracked.push({ condition: "dusky", rounds: null } as never);
    assert.equal(light(spelled, 3, 3), "dim");
  }

  // ── A board's light rule ──
  {
    const rule = {
      label: "Noonfield",
      rounds: 2,
      tracks: [{ track: "exhaustion", by: 1 }],
      spares: { types: ["elemental"] },
    };
    // Every second round end in the sun: a level of exhaustion. The rat stands in the lantern's shade.
    const state = fight({
      items: [lantern],
      light: "sunlight",
      lightRule: rule,
      at: { ada: { x: 2, y: 2 }, imp: { x: 12, y: 2 }, rat: { x: 4, y: 3 } },
    });
    assert.deepEqual(state.board?.lightRule, {
      label: "Noonfield",
      in: ["bright", "sunlight"],
      rounds: 2,
      tracks: [{ track: "exhaustion", by: 1 }],
      spares: { types: ["elemental"] },
    });
    const first = nextRound(state);
    assert.equal(of(first.events, "lightRule").length, 0);
    assert.deepEqual(first.state.board?.exposed, { imp: 1 }, "Ada and the rat stand in its shade");
    const second = nextRound(first.state);
    assert.deepEqual(
      of(second.events, "lightRule").map((event) => [event.actorId, event.light, event.rounds, event.label]),
      [["imp", "sunlight", 2, "Noonfield"]],
    );
    assert.deepEqual(
      of(second.events, "track").map((event) => [event.targetId, event.track, event.from, event.to]),
      [["imp", "exhaustion", 0, 1]],
    );
    assert.equal(second.state.board?.exposed, undefined, "the count starts again");
    // A step into the shade starts it again too.
    const third = nextRound(second.state);
    assert.deepEqual(third.state.board?.exposed, { imp: 1 });
    who(third.state, "imp").x = 3;
    const fourth = nextRound(third.state);
    assert.equal(of(fourth.events, "lightRule").length, 0);
    assert.equal(fourth.state.board?.exposed, undefined);
    // Its own creatures are spared; a condition goes on as it says; nothing on a rule that does nothing.
    const native = fight({
      light: "bright",
      lightRule: { applies: ["sunstruck"], spares: { types: ["elemental"] } },
      enemy: { type: "elemental" },
    });
    const burnt = nextRound(native);
    assert.deepEqual(
      of(burnt.events, "lightRule").map((event) => event.actorId),
      ["ada", "rat"],
      "every round end when it does not say",
    );
    assert.ok(who(burnt.state, "rat").tracked.some((entry) => entry.condition === "sunstruck"));
    assert.ok(!who(burnt.state, "imp").tracked.some((entry) => entry.condition === "sunstruck"));
    assert.equal(fight({ lightRule: { tracks: [{ track: "nonsense", by: 1 }] } }).board?.lightRule, undefined);
    assert.equal(fight({ lightRule: { in: ["dark"], applies: ["sunstruck"] } }).board?.lightRule?.in[0], "dark");
    // The dark is safe.
    const dusk = nextRound(fight({ light: "dim", lightRule: { applies: ["sunstruck"] } }));
    assert.equal(of(dusk.events, "lightRule").length, 0);
    // Its save (1.321): made, nothing this time; a straw hat's advantage, against what it says it is
    // against. Exhaustion two at a time, but 3 at most.
    const hat = gear("Straw hat", {
      modifiers: [{ to: "saves", mode: "advantage", against: { conditions: ["sunstruck"] } }],
    });
    const noonfield = (difficulty: number) =>
      fight({
        items: [hat],
        light: "sunlight",
        lightRule: {
          label: "Noonfield",
          tracks: [{ track: "exhaustion", by: 2, upTo: 3 }],
          save: { save: "con_save", difficulty, against: { conditions: ["sunstruck", "nonsense"] } },
        },
      });
    assert.deepEqual(noonfield(12).board?.lightRule?.save, {
      save: "con_save",
      difficulty: 12,
      against: { conditions: ["sunstruck"] },
    });
    const shaded = nextRound(noonfield(12));
    assert.deepEqual(
      of(shaded.events, "save").map((event) => [event.actorId, event.mode, event.rolls.length, event.success]),
      [
        ["ada", "advantage", 2, true],
        ["imp", undefined, 1, false],
        ["rat", undefined, 1, false],
      ],
    );
    assert.deepEqual(
      of(shaded.events, "track").map((event) => [event.targetId, event.from, event.to]),
      [
        ["imp", 0, 2],
        ["rat", 0, 2],
      ],
      "Ada made it",
    );
    // Said with the light rule, each save as it went.
    assert.deepEqual(
      of(shaded.events, "lightRule").map((event) => [event.actorId, event.save?.saved, event.save?.total]),
      of(shaded.events, "save").map((event) => [event.actorId, event.success, event.total]),
    );
    assert.ok(
      of(shaded.events, "lightRule").every((event) => event.save),
      "every one with its save",
    );
    const later = nextRound(shaded.state);
    assert.deepEqual(
      of(later.events, "track").map((event) => [event.targetId, event.from, event.to]),
      [
        ["imp", 2, 3],
        ["rat", 2, 3],
      ],
      "to 3 and no further",
    );
    const most = nextRound(later.state);
    assert.deepEqual(of(most.events, "track"), []);
    // Already past its most, it takes nothing off.
    const past = noonfield(12);
    who(past, "imp").tracks = { exhaustion: 5 };
    const stays = nextRound(past);
    assert.equal(who(stays.state, "imp").tracks?.exhaustion, 5);
    // Missed, the hat's advantage or not: the exhaustion all the same.
    const missed = nextRound(noonfield(13));
    assert.deepEqual(
      of(missed.events, "track").map((event) => event.targetId),
      ["ada", "imp", "rat"],
    );
  }

  // ── Lantern-Shy: no moving in bright light ──
  {
    const moves = (state: RulesetEncounterState) =>
      rulesetCombatOptions(definition, state, "imp").some((option) => option.id === RULESET_MOVE_OPTION);
    const shy = fight({ light: "sunlight", enemy: { stillIn: ["bright"] }, items: [lantern] });
    shy.turn = 1;
    assert.equal(moves(shy), false, "sunlight is bright light");
    who(shy, "imp").x = 4;
    assert.equal(moves(shy), true, "in the lantern's shade");
    // Read off a bestiary creature as its block.
    const shyDoc = fiveE((doc) => {
      const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
      creatures.entries[0].creature.stillIn = ["bright"];
    });
    const shyDef = parsed(shyDoc);
    const creatures = shyDef.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries![0]!;
    assert.deepEqual(rulesetCreatureBlock(shyDef, creatures)?.stillIn, ["bright"]);
    const dusk = fight({ light: "dim", enemy: { stillIn: ["bright"] } });
    dusk.turn = 1;
    assert.equal(moves(dusk), true);
    assert.equal(
      issuesOf(fiveE((doc) => (doc.combat.conditions[0].stillIn = ["bright"]))).length > 0,
      true,
      "a creature's",
    );
  }

  // ── The Wind-Chime ── (in the dark, where nobody sees the hidden)
  {
    const state = fight({
      items: [chime],
      light: "dark",
      at: { ada: { x: 2, y: 2 }, imp: { x: 9, y: 2 }, rat: { x: 14, y: 8 } },
    });
    who(state, "imp").hiding = { from: ["ada"], total: 30 } as never;
    who(state, "rat").hiding = { from: ["ada"], total: 30 } as never;
    state.turn = 1;
    // Four cells off and more, still hidden; a walk to three cells, and the chime rings.
    const near = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "imp", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 2 } },
      () => 10,
    );
    assert.equal(
      near.events.find((event) => event.type === "refused"),
      undefined,
      JSON.stringify(near.events),
    );
    assert.deepEqual(
      of(near.events, "revealed").map((event) => [event.actorId, event.reason, event.alertedBy, event.byIds]),
      [["imp", "alerted", "ada", ["ada"]]],
    );
    assert.equal(who(near.state, "imp").hiding, undefined);
    // Standing still near it gives nobody away; nor does walking where it does not reach.
    near.state.turn = 2;
    const far = applyRulesetCombatChoice(
      definition,
      near.state,
      { actorId: "rat", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 12, y: 8 } },
      () => 10,
    );
    assert.equal(of(far.events, "revealed").length, 0);
    assert.ok(who(far.state, "rat").hiding);
    // Without the chime, the same step gives nobody away.
    const quiet = fight({ light: "dark", at: { ada: { x: 2, y: 2 }, imp: { x: 9, y: 2 }, rat: { x: 14, y: 8 } } });
    who(quiet, "imp").hiding = { from: ["ada"], total: 30 } as never;
    quiet.turn = 1;
    const silent = applyRulesetCombatChoice(
      definition,
      quiet,
      { actorId: "imp", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 2 } },
      () => 10,
    );
    assert.equal(of(silent.events, "revealed").length, 0);
    // Nor does one its own side holds: an alarm on the rat, by the imp's way.
    const own = fight({ light: "dark", at: { ada: { x: 2, y: 2 }, imp: { x: 9, y: 2 }, rat: { x: 6, y: 4 } } });
    who(own, "rat").tracked.push({ condition: "alarmed", rounds: null } as never);
    who(own, "imp").hiding = { from: ["ada"], total: 30 } as never;
    own.turn = 1;
    const friendly = applyRulesetCombatChoice(
      definition,
      own,
      { actorId: "imp", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 7, y: 2 } },
      () => 10,
    );
    assert.equal(of(friendly.events, "revealed").length, 0, "an alarm on its own side");
    // A condition that alerts, on Ada's side, rings as an item does.
    const spell = fight({ light: "dark", at: { ada: { x: 2, y: 2 }, imp: { x: 9, y: 2 }, rat: { x: 14, y: 8 } } });
    who(spell, "ada").tracked.push({ condition: "alarmed", rounds: null } as never);
    who(spell, "imp").hiding = { from: ["ada"], total: 30 } as never;
    spell.turn = 1;
    const rung = applyRulesetCombatChoice(
      definition,
      spell,
      { actorId: "imp", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 2 } },
      () => 10,
    );
    assert.equal(of(rung.events, "revealed")[0]?.reason, "alerted");
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
      "A ruleset with a light that sheds shade, something that alerts or a creature held still by light requires schemaVersion 2 and capabilityApi 1.319 or newer";
    const chimed = fiveE((doc) => {
      doc.combat.conditions = doc.combat.conditions.filter(
        (entry: { condition: string }) => entry.condition !== "dusky",
      );
      doc.combat.conditions.push({ condition: "dusky", alerts: 15 });
    });
    const shy = fiveE((doc) => {
      doc.combat.conditions = doc.combat.conditions.filter(
        (entry: { condition: string }) => entry.condition !== "dusky",
      );
      const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
      creatures.entries[0].creature.stillIn = ["bright"];
    });
    for (const doc of [fiveE(), chimed, shy]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(318) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(319) as never, doc), gate);
    }
    const plain = JSON.parse(fiveEText);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(318) as never, plain), gate, "the plain 5e example");
  }

  // ── Painted on a battlefield, and through the director ──
  {
    // Painted on a battlefield, and through the director.
    const map = {
      id: "b1",
      name: "Noonfield",
      size: "small",
      place: "p1",
      scene: "plains",
      rows: worldBattlefieldBlankRows("small"),
      lightRule: {
        label: "Noonfield",
        rounds: 3,
        tracks: [{ track: "exhaustion", by: 1, upTo: 3 }],
        save: { save: "con_save", difficulty: 12 },
      },
    };
    const read = worldBattlefieldMapSchema.safeParse(map);
    assert.ok(read.success, JSON.stringify(read.error?.issues));
    assert.equal(
      worldBattlefieldMapSchema.safeParse({ ...map, lightRule: { label: "Nothing" } }).success,
      false,
      "a light rule does something",
    );
    const built = createRulesetFight({
      definition,
      seed: 3,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "x", name: "X" }],
      bestiary: {},
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      positioned: true,
      made: {
        id: "b1",
        name: "Noonfield",
        size: "small",
        scene: "plains",
        grid: {
          width: map.rows[0]!.length,
          height: map.rows.length,
          tiles: map.rows.map((row) => Array(row.length).fill("plains")),
        },
        lightRule: map.lightRule,
      },
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const encounter = (built as { fight: { encounter: RulesetEncounterState } }).fight.encounter;
    assert.equal(encounter.board?.lightRule?.rounds, 3);
    assert.deepEqual(encounter.board?.lightRule?.save, { save: "con_save", difficulty: 12 });
    assert.equal(encounter.board?.lightRule?.tracks?.[0]?.upTo, 3);
  }

  console.log(
    "Shade and chimes: a Lantern of Dusk's shade dims the sun, a board's light rule exhausts whoever stands in it too long, and a Wind-Chime gives away whoever moves hidden near it.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
