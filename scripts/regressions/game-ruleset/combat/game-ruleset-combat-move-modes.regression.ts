/**
 * Moving other ways than walking (Capability API 1.113).
 *
 *   - A creature's `speeds` (fly, swim, climb, burrow) and `hover`, and a sheet's
 *     `combat.economy.movementModes`, are read as the fight begins. `speed` stays the walk.
 *   - On a board a flier crosses water and steps of any height, a swimmer crosses water, a climber
 *     takes steps of any height, and a burrower moves as a walk. Each step is taken the cheapest way
 *     that has enough left.
 *   - The allowance is the fastest way they move, and every cell moved comes off every way at once,
 *     as 5e's "subtract the distance already moved from the new speed": walk 30 and fly 60 can walk
 *     10 and fly 40, and never walk past 30. A dash adds each way's own again.
 *   - The walk spends exactly what the menu said; the director's distances read the mover's ways.
 *   - Somebody who only walks moves exactly as before; import and the install gate (1.113).
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RULESET_MOVE_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  rulesetWalkingDistances,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
  type TacticalTerrain,
} from "../../../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-move-modes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (document: unknown, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(document);
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const creatureOf = (doc: Record<string, any>, entryId: string) =>
    doc.catalogs
      .find((one: { id: string }) => one.id === "creatures")
      .entries.find((one: { id: string }) => one.id === entryId).creature;

  // ── Import ──
  {
    parsedOrThrow(
      fiveE((doc) => {
        creatureOf(doc, "cinder-hound").speeds = { fly: 60, swim: 30 };
        creatureOf(doc, "cinder-hound").hover = true;
        doc.combat.economy.movementModes = { fly: { const: 0 }, swim: { field: "speed" } };
      }),
      "speeds, hover and a sheet's ways of moving",
    );
    refused(
      fiveE((doc) => (creatureOf(doc, "cinder-hound").hover = true)),
      /hover: .*fly speed/,
      "hover alone",
    );
    refused(
      fiveE((doc) => (creatureOf(doc, "cinder-hound").speeds = {})),
      /speeds/,
      "no way at all",
    );
    refused(
      fiveE((doc) => (creatureOf(doc, "cinder-hound").speeds = { teleport: 30 })),
      /speeds/,
      "an unknown way",
    );
    refused(
      fiveE((doc) => (creatureOf(doc, "cinder-hound").speeds = { fly: 0 })),
      /speeds\.fly/,
      "a fly of nought",
    );
    refused(
      fiveE((doc) => (doc.combat.economy.movementModes = { fly: { field: "wings" } })),
      /movementModes\.fly/,
      "a sheet value that is not there",
    );
  }

  // ── On a board ──
  {
    const definition = parsedOrThrow(fiveE(), "the 5e example");
    const TERRAIN: Record<string, TacticalTerrain> = { ".": "plains", ",": "forest", "#": "wall", "~": "water" };
    const drawn = (rows: string[], heights?: string[]): TacticalGrid => ({
      width: rows[0]!.length,
      height: rows.length,
      tiles: rows.map((row) => [...row].map((glyph) => TERRAIN[glyph]!)),
      ...(heights ? { elevation: heights.map((row) => [...row].map(Number)) } : {}),
    });
    /** One mover, a far-off fighter to keep the fight going. Speeds in feet: six cells is 30. */
    const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
      health: 20,
      defense: 12,
      initiativeModifier: 20,
      speed: 30,
      actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 3, damage: { count: 1, sides: 6, flat: 0 } }],
      ...extra,
    });
    const fight = (grid: TacticalGrid, extra: Partial<RulesetStatBlock> = {}): RulesetEncounterState =>
      createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: [
          { id: "mover", name: "Mover", side: "enemy", block: block(extra) } as RulesetCombatantInput,
          {
            id: "brenna",
            name: "Brenna",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
              fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
            }),
            catalogs: {},
          } as RulesetCombatantInput,
        ],
        board: { grid, placements: { mover: { x: 0, y: 0 }, brenna: { x: grid.width - 1, y: grid.height - 1 } } },
      });
    const costs = (state: RulesetEncounterState) =>
      new Map(rulesetReachableCells(definition, state, "mover").map((cell) => [`${cell.x},${cell.y}`, cell.cost]));

    // A channel two cells wide. Nobody walks into water; a flier and a swimmer cross it.
    const channel = drawn(["..~~....", "..~~....", "........".replace(/./g, "#")]);
    const walker = costs(fight(channel));
    assert.ok(!walker.has("2,0") && !walker.has("4,0"), "on foot the water stops it");
    const flier = costs(fight(channel, { speeds: { fly: 60 } }));
    assert.equal(flier.get("2,0"), 2, "over the water");
    assert.equal(flier.get("4,0"), 4, "and across it");
    const swimmer = costs(fight(channel, { speeds: { swim: 30 } }));
    assert.equal(swimmer.get("3,1"), 3, "a swimmer crosses for a cell a step");
    assert.equal(swimmer.get("5,0"), 5, "and walks out the far side");
    // A short swim runs out in the middle: everything moved comes off it too.
    const paddler = costs(fight(channel, { speeds: { swim: 10 } }));
    assert.equal(paddler.get("2,0"), 2, "a walk and a two-cell swim");
    assert.ok(!paddler.has("3,0"), "with nothing left of the swim to take the next one");
    const hound = fight(channel, { speeds: { swim: 10 } });
    assert.deepEqual(
      rulesetCombatant(hound, "mover")!.modeLeft,
      { walk: 6, swim: 2 },
      "each way's own allowance, in cells",
    );

    // Flying: the allowance is the fastest way, and walking never goes past its own.
    const field = drawn([".".repeat(16), ",".repeat(16)]);
    const wings = costs(fight(field, { speeds: { fly: 60 } }));
    assert.equal(wings.get("12,0"), 12, "a flier goes its whole flight");
    assert.ok(!wings.has("13,0"));
    const woods = drawn([",".repeat(8)]);
    assert.equal(costs(fight(woods, { speeds: { fly: 60 } })).get("6,0"), 6, "and over rough ground for a cell a step");
    assert.equal(costs(fight(woods)).get("3,0"), 6, "which on foot is two a step");
    const state = fight(field, { speeds: { fly: 60 } });
    const mover = rulesetCombatant(state, "mover")!;
    assert.equal(mover.movement, 12);
    assert.deepEqual(mover.modeLeft, { walk: 6, fly: 12 });
    // A walk spends what the menu said, off every way at once.
    const moved = applyRulesetCombatChoice(definition, state, {
      actorId: "mover",
      optionId: RULESET_MOVE_OPTION,
      targetIds: [],
      to: { x: 4, y: 1 },
    });
    const step = moved.events.find((event) => event.type === "move") as
      Extract<RulesetCombatEvent, { type: "move" }> | undefined;
    assert.equal(step?.cost, 4, "four cells, flown over the forest");
    assert.deepEqual(rulesetCombatant(moved.state, "mover")!.modeLeft, { walk: 2, fly: 8 });
    assert.equal(rulesetCombatant(moved.state, "mover")!.movementLeft, 8);
    // Two cells of walk left: along plain ground it walks them and then flies, never walks past 30.
    const after = new Map(
      rulesetReachableCells(definition, moved.state, "mover").map((cell) => [`${cell.x},${cell.y}`, cell.cost]),
    );
    assert.equal(after.get("12,0"), 8, "the flight that is left");

    // Height: a cliff of three levels stops a walk; a climber and a flier take it.
    const cliff = drawn(["......"], ["003000"]);
    assert.ok(!costs(fight(cliff)).has("2,0"), "a cliff nobody walks");
    assert.equal(costs(fight(cliff, { speeds: { climb: 30 } })).get("2,0"), 2, "climbed for the ground's cost");
    assert.equal(costs(fight(cliff, { speeds: { fly: 30 } })).get("3,0"), 3, "flown over");
    assert.ok(!costs(fight(cliff, { speeds: { burrow: 30 } })).has("2,0"), "a burrower walks");

    // The director's distances read the mover's ways: across the channel for a flier, not on foot.
    const across = [{ x: 5, y: 0 }];
    assert.equal(rulesetWalkingDistances(channel, across).get("0,0"), undefined, "on foot, no way round");
    assert.equal(
      rulesetWalkingDistances(channel, across, rulesetCombatant(fight(channel, { speeds: { fly: 60 } }), "mover")).get(
        "0,0",
      ),
      4,
    );

    // Somebody who only walks has no ways to keep: the same fight as before.
    assert.equal(rulesetCombatant(fight(field), "mover")!.modeLeft, undefined);
    assert.equal(rulesetCombatant(fight(field), "mover")!.speeds, undefined);

    // A party member's come off the sheet; nought is not moving that way.
    const winged = parsedOrThrow(
      fiveE((doc) => (doc.combat.economy.movementModes = { fly: { field: "speed" }, swim: { const: 0 } })),
      "a sheet that flies at its walking speed",
    );
    const party = createRulesetEncounter({
      definition: winged,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "brenna",
          name: "Brenna",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
          }),
          catalogs: {},
        } as RulesetCombatantInput,
        { id: "mover", name: "Mover", side: "enemy", block: block() } as RulesetCombatantInput,
      ],
      board: { grid: channel, placements: { brenna: { x: 0, y: 0 }, mover: { x: 7, y: 1 } } },
    });
    assert.deepEqual(rulesetCombatant(party, "brenna")!.speeds, { fly: 30 });
    const brennaCells = new Map(
      rulesetReachableCells(winged, party, "brenna").map((cell) => [`${cell.x},${cell.y}`, cell.cost]),
    );
    assert.equal(brennaCells.get("4,0"), 4, "she flies the channel");

    // A bestiary creature carries its own ways onto the block a fight builds.
    const hounds = parsedOrThrow(
      fiveE((doc) => {
        creatureOf(doc, "cinder-hound").speeds = { fly: 60 };
        creatureOf(doc, "cinder-hound").hover = true;
      }),
      "a flying hound",
    );
    const bestiary = Object.fromEntries((hounds.catalogs ?? []).map((one) => [one.id, one.entries ?? []]));
    const houndFight = createRulesetEncounter({
      definition: hounds,
      seed: 1,
      roller: () => 4,
      bestiary,
      combatants: [
        { id: "hound", name: "Hound", side: "enemy", creature: { catalogId: "creatures", entryId: "cinder-hound" } },
      ],
    });
    const flying = rulesetCombatant(houndFight, "hound")!;
    assert.deepEqual({ speeds: flying.speeds, hover: flying.hover }, { speeds: { fly: 60 }, hover: true });

    // A dash adds each way's own allowance again.
    const dashed = applyRulesetCombatChoice(definition, fight(field, { speeds: { fly: 60 } }), {
      actorId: "mover",
      optionId: "standard:dash",
      targetIds: [],
    });
    assert.ok(!dashed.events.some((event) => event.type === "refused"), JSON.stringify(dashed.events));
    assert.deepEqual(rulesetCombatant(dashed.state, "mover")!.modeLeft, { walk: 12, fly: 24 });
  }

  // ── The install gate: 1.113, in the ruleset file and in a catalog file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-move-modes",
      name: "Move modes",
      version: "0.1.0",
      description: "A packaged ruleset whose creatures fly.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gate = /fly, swim, climb or burrow.*capabilityApi 1\.113/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    const speedsOnly = (doc: Record<string, any>) => (creatureOf(doc, "cinder-hound").speeds = { fly: 60 });
    const sheetOnly = (doc: Record<string, any>) => (doc.combat.economy.movementModes = { swim: { const: 30 } });
    for (const [what, edit] of [
      ["speeds", speedsOnly],
      ["a sheet's ways", sheetOnly],
    ] as const) {
      assert.match(issue(112, fiveE(edit)) ?? "", gate, what);
      assert.doesNotMatch(issue(113, fiveE(edit)) ?? "", gate, what);
    }
    assert.doesNotMatch(issue(112, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
    const document = fiveE(speedsOnly);
    const creatures = document.catalogs.find((one: { id: string }) => one.id === "creatures");
    const inFile = {
      ...document,
      catalogs: document.catalogs.map((one: { id: string }) =>
        one.id === "creatures" ? { ...one, entries: undefined, asset: "catalogs/creatures.json" } : one,
      ),
    };
    const paths = ["ruleset.json", "catalogs/creatures.json"];
    const files = new Map<string, unknown>([["catalogs/creatures.json", { entries: creatures.entries }]]);
    assert.match(issue(112, inFile, paths, files) ?? "", gate, "a catalog file");
    assert.doesNotMatch(issue(113, inFile, paths, files) ?? "", gate);
  }

  console.log("Move modes: fliers, swimmers and climbers on the board, one allowance between them, gated at 1.113.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
