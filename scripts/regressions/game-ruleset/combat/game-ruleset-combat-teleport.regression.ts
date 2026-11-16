/**
 * Teleports (Capability API 1.276).
 *
 *   - `teleport` on an entry: Misty Step goes up to 30 feet to a place its caster can see, with no
 *     step between, so nobody standing beside them gets a strike at them leaving. Its option offers
 *     the cells it may go to, and the choice names one as `at`.
 *   - `seen`: a wall or blindness keeps the cells behind it off the list; without `seen` (Dimension
 *     Door) they are offered.
 *   - `carries` and `carriesWithin`: Dimension Door takes one willing creature of its caster's side,
 *     no bigger than them, from within 5 feet, who lands as near them as there is room.
 *   - A creature's own `teleport` (a blink dog's), and none off a board.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-teleport-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetMenu } = await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 271);
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
  const spell = (id: string, mechanics: Record<string, unknown>, level = 2) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const misty = spell("misty", { kind: "utility", budget: "bonus", teleport: { distance: 30, seen: true } });
  const door = spell("door", { kind: "utility", teleport: { distance: 500, carries: 1, carriesWithin: 5 } }, 4);
  // A burst that stays and burns whoever walks into it.
  const embers = spell("embers", {
    kind: "attack",
    autoHit: true,
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 5 },
    damageType: "fire",
    zone: { rounds: 10, triggers: ["enter"] },
  });
  const spells = [misty, door, embers];
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(fiveE(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  const definition = parsed(
    fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
      // Blinded takes the eyes away.
      doc.combat.sight = { eyes: "sight" };
      for (const entry of doc.combat.conditions) if (entry.condition === "blinded") entry.lacks = ["sight"];
      // A bestiary creature that teleports, as a blink dog does.
      const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
      const blinker = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
      blinker.id = "blinker";
      blinker.label = "Blinker";
      blinker.creature.actions = [
        { id: "blink", name: "Teleport", budget: "action", teleport: { distance: 40, seen: true } },
      ];
      creatures.entries.push(blinker);
    }),
  );
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (wallX?: number): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array.from({ length: 20 }, (_, x) => (x === wallX ? "wall" : "plains"))),
  });
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: {
      level: 9,
      ac: 12,
      speed: 30,
      hp_max: 60,
      spellcasting_ability: "int",
      slots_max_1: 4,
      slots_max_2: 3,
      slots_max_3: 3,
      slots_max_4: 3,
    },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const fight = (
    options: {
      placements?: Record<string, { x: number; y: number }>;
      wallX?: number;
      board?: false;
      a?: Partial<RulesetStatBlock>;
    } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {}, catalogs: { spells } },
        { id: "friend", name: "Friend", side: "party", build, live: {} },
        { id: "far", name: "Far", side: "party", build, live: {} },
        { id: "a", name: "A", side: "enemy", block: block(options.a) },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      ...(options.board === false
        ? {}
        : {
            board: {
              grid: grid(options.wallX),
              placements: {
                mage: { x: 2, y: 7 },
                friend: { x: 2, y: 8 },
                far: { x: 2, y: 12 },
                a: { x: 6, y: 7 },
                b: { x: 3, y: 7 },
                ...options.placements,
              },
            },
          }),
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const at = (state: RulesetEncounterState, id: string) => ({ x: who(state, id).x, y: who(state, id).y });
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const optionOf = (state: RulesetEncounterState, label: string, actor = "mage") =>
    rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
  const keys = (cells: Array<{ x: number; y: number }> | undefined) =>
    new Set((cells ?? []).map((cell) => `${cell.x},${cell.y}`));
  const go = (state: RulesetEncounterState, label: string, extra: Partial<RulesetCombatChoice>, actor = "mage") => {
    const option = optionOf(state, label, actor);
    assert.ok(option, `${actor} has no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: option.id, targetIds: [], ...extra },
      roll,
    );
  };

  // ── Misty Step: 30 feet to a place its caster sees, no strike at them leaving ──
  {
    const state = fight();
    const option = optionOf(state, "Misty");
    assert.ok(option?.teleport, "Misty Step offers where it may go");
    const cells = keys(option!.teleport!.cells);
    assert.ok(cells.has("8,7") && cells.has("2,1") && cells.has("8,13"), "anywhere within 6 cells");
    assert.ok(!cells.has("9,7") && !cells.has("2,0"), "and no farther");
    assert.ok(!cells.has("2,7"), "never where its caster stands");
    assert.ok(!cells.has("6,7") && !cells.has("3,7") && !cells.has("2,8"), "never where somebody stands");
    assert.equal(option!.teleport!.carries, undefined, "it carries nobody");
    // A screen aims it as it aims a shape: at the cells it may go to, catching nobody.
    const aimed = rulesetMenu(definition, state, "mage").find((one) => one.id === option!.id)!;
    assert.deepEqual(keys(aimed.aim), cells, "the screen is sent every cell it may go to");
    assert.ok(
      aimed.aim!.every((one) => one.targetIds.length === 0),
      "and nobody caught",
    );
    const step = go(state, "Misty", { at: { x: 8, y: 7 } });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.deepEqual(at(step.state, "mage"), { x: 8, y: 7 });
    const moved = step.events.find((one) => one.type === "teleported");
    assert.ok(moved && moved.type === "teleported");
    assert.deepEqual(moved.from, { x: 2, y: 7 });
    assert.deepEqual(moved.to, { x: 8, y: 7 });
    assert.equal(moved.label, "Misty");
    assert.equal(moved.by, undefined);
    // B stood beside them and could strike at a walk away; a teleport is no walk.
    assert.equal(step.state.window, undefined, "nobody is asked for a strike");
    assert.ok(!step.events.some((one) => one.type === "window"), "no window opened");
    assert.equal(who(step.state, "mage").budgets.bonus, 0, "a bonus action spent");
    assert.equal(who(step.state, "mage").budgets.action, 1, "the action kept");
  }

  // ── Refusals: a cell it does not offer, none at all, or company it does not take ──
  {
    for (const extra of [{ at: { x: 9, y: 7 } }, { at: { x: 6, y: 7 } }, {}] as Array<Partial<RulesetCombatChoice>>) {
      const step = go(fight(), "Misty", extra);
      const why = refused(step);
      assert.ok(why && why.type === "refused" && why.reason === "bad-cell", JSON.stringify(extra));
      assert.deepEqual(at(step.state, "mage"), { x: 2, y: 7 });
    }
    const step = go(fight(), "Misty", { at: { x: 8, y: 7 }, carries: ["friend"] });
    const why = refused(step);
    assert.ok(why && why.type === "refused" && why.reason === "bad-target", "Misty Step takes nobody along");
  }

  // ── Seen: a wall hides what is behind it; Dimension Door goes there anyway ──
  {
    const state = fight({ wallX: 5 });
    const cells = keys(optionOf(state, "Misty")!.teleport!.cells);
    assert.ok(cells.has("4,7"), "this side of the wall");
    assert.ok(![...cells].some((key) => Number(key.split(",")[0]) >= 5), "nothing behind it, nor in it");
    const through = keys(optionOf(state, "Door")!.teleport!.cells);
    assert.ok(through.has("8,7") && through.has("19,0"), "Dimension Door goes where it is not seen");
    assert.ok(!through.has("5,7"), "but never into the wall");
    // Blinded, there is nowhere it sees, so Misty Step is not offered.
    const blind = fight();
    who(blind, "mage").tracked.push({ condition: "blinded", rounds: null } as never);
    assert.equal(optionOf(blind, "Misty"), undefined, "blind, nowhere to go");
    assert.ok(optionOf(blind, "Door"), "Dimension Door needs no eyes");
  }

  // ── Dimension Door: one willing creature within 5 feet goes along ──
  {
    const state = fight();
    const option = optionOf(state, "Door")!;
    assert.deepEqual(
      option.teleport!.carries,
      { count: 1, ids: ["friend"] },
      "the friend beside them, not the far one",
    );
    const step = go(state, "Door", { at: { x: 15, y: 3 }, carries: ["friend"] });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.deepEqual(at(step.state, "mage"), { x: 15, y: 3 });
    const friend = at(step.state, "friend");
    assert.ok(Math.max(Math.abs(friend.x! - 15), Math.abs(friend.y! - 3)) === 1, "landed beside the caster");
    const along = step.events.find((one) => one.type === "teleported" && one.actorId === "friend");
    assert.ok(along && along.type === "teleported" && along.by === "mage" && along.label === "Door");
    assert.deepEqual(at(step.state, "far"), { x: 2, y: 12 }, "the far one stays");
    // Only one, and only somebody it offers.
    for (const carries of [["friend", "far"], ["a"], ["friend", "friend"]]) {
      const why = refused(go(fight({ placements: { far: { x: 1, y: 8 } } }), "Door", { at: { x: 15, y: 3 }, carries }));
      assert.ok(why && why.type === "refused" && why.reason === "bad-target", carries.join(","));
    }
    const tooFar = refused(go(fight(), "Door", { at: { x: 15, y: 3 }, carries: ["far"] }));
    assert.ok(tooFar && tooFar.type === "refused" && tooFar.reason === "bad-target", "the far one is not beside them");
    // Taking more than one, each only once.
    const two = fight({ placements: { far: { x: 1, y: 8 } } });
    who(two, "mage").actions.find((one) => one.label === "Door")!.teleport!.carries = 2;
    const twice = refused(go(two, "Door", { at: { x: 15, y: 3 }, carries: ["friend", "friend"] }));
    assert.ok(twice && twice.type === "refused" && twice.reason === "bad-target", "the same friend twice");
    const both = go(two, "Door", { at: { x: 15, y: 3 }, carries: ["friend", "far"] });
    assert.equal(refused(both), undefined, "two friends, where it takes two");
    // `carriesWithin` is in the ruleset's distance: 10 feet reaches a friend two cells away.
    const doorRule = (door as unknown as { mechanics: { teleport: { carriesWithin: number } } }).mechanics.teleport;
    doorRule.carriesWithin = 10;
    try {
      const reach = fight({ placements: { far: { x: 2, y: 9 } } });
      assert.deepEqual(optionOf(reach, "Door")!.teleport!.carries!.ids.sort(), ["far", "friend"]);
    } finally {
      doorRule.carriesWithin = 5;
    }
    // Without anybody along, it goes alone.
    const alone = go(fight(), "Door", { at: { x: 15, y: 3 } });
    assert.equal(refused(alone), undefined);
    assert.deepEqual(at(alone.state, "friend"), { x: 2, y: 8 });
    // Somebody bigger than its caster is not taken.
    const big = fight();
    who(big, "friend").span = 2;
    assert.equal(optionOf(big, "Door")!.teleport!.carries, undefined, "too big to go along");
    // With no room right beside them, the friend lands at the nearest place there is.
    const crowded = fight({ placements: { a: { x: 14, y: 2 }, b: { x: 15, y: 2 } } });
    const packed = go(crowded, "Door", { at: { x: 15, y: 3 }, carries: ["friend"] });
    const there = at(packed.state, "friend");
    assert.ok(!(there.x === 14 && there.y === 2) && !(there.x === 15 && there.y === 2), "never on top of somebody");
  }

  // ── Landing in a zone catches as walking in would; landing on higher ground grounds a flier ──
  {
    const state = fight();
    const cast = go(state, "Embers", { at: { x: 8, y: 7 } });
    assert.equal(refused(cast), undefined, JSON.stringify(refused(cast)));
    const step = go(cast.state, "Misty", { at: { x: 8, y: 8 } });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.ok(
      step.events.some((one) => one.type === "zone" && one.targetId === "mage" && one.outcome === "struck"),
      "the embers catch the mage landing in them",
    );
    const high = fight();
    high.board!.grid.elevation = Array.from({ length: 15 }, (_, y) =>
      Array.from({ length: 20 }, (_, x) => (x === 8 && y === 7 ? 3 : 0)),
    );
    who(high, "mage").altitude = 2;
    const landed = go(high, "Misty", { at: { x: 8, y: 7 } });
    assert.equal(refused(landed), undefined, JSON.stringify(refused(landed)));
    assert.equal(who(landed.state, "mage").altitude, undefined, "on the ground up there");
  }

  // ── A creature's own teleport, and none off a board ──
  {
    const blink = { name: "Teleport", budget: "action", teleport: { distance: 40, seen: true } } as never;
    const state = fight({ a: { actions: [blink] } });
    state.turn = state.order.indexOf("a");
    const option = optionOf(state, "Teleport", "a");
    assert.ok(option?.teleport, "the blink dog may teleport");
    assert.deepEqual(option!.targets, { side: "self", count: 0 });
    const cells = keys(option!.teleport!.cells);
    assert.ok(cells.has("14,7") && !cells.has("15,7"), "40 feet is 8 cells");
    const step = go(state, "Teleport", { at: { x: 12, y: 2 } }, "a");
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.deepEqual(at(step.state, "a"), { x: 12, y: 2 });
    // Off a board there is nowhere to go, so nothing that only teleports is offered.
    const plain = fight({ board: false, a: { actions: [blink] } });
    assert.equal(optionOf(plain, "Misty"), undefined);
    assert.equal(optionOf(plain, "Door"), undefined);
    plain.turn = plain.order.indexOf("a");
    assert.equal(optionOf(plain, "Teleport", "a"), undefined);
  }

  // ── A bestiary creature's teleport reaches the fight ──
  {
    const creatures = definition.catalogs.find((one) => one.id === "creatures")!;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { creatures: creatures.entries },
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {}, catalogs: { spells } },
        { id: "dog", name: "Dog", side: "enemy", creature: { catalogId: "creatures", entryId: "blinker" } },
      ],
      board: { grid: grid(), placements: { mage: { x: 2, y: 7 }, dog: { x: 6, y: 7 } } },
    });
    state.order = ["mage", "dog"];
    state.turn = 1;
    const option = optionOf(state, "Teleport", "dog");
    assert.ok(option?.teleport, "the bestiary blinker may teleport");
    assert.deepEqual(option!.targets, { side: "self", count: 0 });
    const step = go(state, "Teleport", { at: { x: 12, y: 2 } }, "dog");
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.deepEqual(at(step.state, "dog"), { x: 12, y: 2 });
  }

  // ── Import refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [spell("t", mechanics)] });
    };
    refusedDoc(
      withSpell({ kind: "utility", teleport: { distance: 30, carriesWithin: 5 } }),
      /"carriesWithin" is how near those it "carries" stand/,
    );
    refusedDoc(
      withSpell({ kind: "debuff", area: { shape: "burst", size: 10 }, teleport: { distance: 30 } }),
      /A teleport goes where its user picks, so it is not an area or a reaction/,
    );
    refusedDoc(withSpell({ kind: "utility", teleport: { distance: 0 } }), /distance/);
    refusedDoc(withSpell({ kind: "utility", teleport: { distance: 30, carries: 9 } }), /carries/);
    refusedDoc((doc) => {
      withSpell({ kind: "utility", teleport: { distance: 30 } })(doc);
      delete doc.combat.distance;
    }, /"teleport" is measured in cells, so the combat block declares "distance" too/);
    const withItem =
      (use: Record<string, unknown>, edit: (doc: Record<string, any>) => void = () => {}) =>
      (doc: Record<string, any>) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }] };
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [{ id: "c", label: "Cape", item: { category: "gear", use: { budget: "action", ...use } } }],
        });
        edit(doc);
      };
    parsed(fiveE(withItem({ kind: "utility", teleport: { distance: 300 } })));
    refusedDoc(
      withItem({ kind: "debuff", area: { shape: "burst", size: 10 }, teleport: { distance: 30 } }),
      /A teleport goes where its user picks, so it is not an area/,
    );
    refusedDoc(
      withItem({ kind: "utility", teleport: { distance: 300 } }, (doc) => delete doc.combat.distance),
      /"teleport" is measured in cells, so the combat block declares "distance" too/,
    );
    const withCreature = (action: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [{ id: "d", label: "D", creature: { ...block({ actions: [action as never] }), tier: "cr_0" } }],
      });
    };
    parsed(fiveE(withCreature({ id: "blink", name: "Teleport", budget: "action", teleport: { distance: 40 } })));
    refusedDoc(
      withCreature({
        id: "blink",
        name: "Teleport",
        budget: "action",
        area: { shape: "burst", size: 10 },
        teleport: { distance: 40 },
      }),
      /A teleport goes where its user picks, so it is not an area, a reaction or a sequence/,
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
    const gate =
      "A ruleset with a spell, an item or a creature that teleports requires schemaVersion 2 and capabilityApi 1.276 or newer";
    const withEntries = (entries: unknown[]) =>
      fiveE((doc) => {
        doc.catalogs.push({ id: "x", label: "X", entries });
      });
    const docs: Array<[string, Record<string, any>]> = [
      ["spell", withEntries([spell("m", { kind: "utility", teleport: { distance: 30, seen: true } })])],
      [
        "item use",
        withEntries([
          { id: "i", label: "I", item: { category: "gear", use: { kind: "utility", teleport: { distance: 500 } } } },
        ]),
      ],
      [
        "creature",
        withEntries([
          {
            id: "dog",
            label: "Dog",
            creature: { actions: [{ id: "blink", name: "Teleport", budget: "action", teleport: { distance: 40 } }] },
          },
        ]),
      ],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(275) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(276) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(275) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset teleports: Misty Step goes to a place its caster sees with no strike at them leaving, Dimension Door goes past walls and takes one friend beside them along, a blink dog teleports, and nothing that only teleports is offered off a board.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
