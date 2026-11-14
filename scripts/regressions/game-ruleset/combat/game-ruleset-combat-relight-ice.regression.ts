/**
 * Relighting, falling through ice, and a use only beside a prop (Capability API 1.332).
 *
 *   - A board prop's `relight {light, squares, budget?}`: somebody beside it may spend the budget to
 *     light every cell within `squares` of it again, offered only while one of them is not so lit.
 *   - A creature action's `ground.occupants: "stay"`: whoever stood where the ground turned to water
 *     stays in it; without it they are moved to the nearest open cell, as before.
 *   - A catalog entry's (or an item use's) `usableNear {prop, within}`: offered only within that
 *     distance of a standing prop named by id or label. Fennick's Hymnal at the Year-Wheel.
 *   - Refused shapes; the install gate; painted props carry `relight`.
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
  worldBattlefieldPropSchema,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-relight-ice-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 332);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hymn = {
    id: "hymn",
    label: "Sing a Verse",
    rows: [{ list: "features", values: { name: "Sing a Verse" } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      usableNear: { prop: "Year-Wheel", within: 5 },
      applies: [{ condition: "singing", duration: { rounds: 1 } }],
    },
  } as unknown as RulesetCatalogEntry;
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.live.conditions.push({ id: "singing", label: "Singing" });
    doc.combat.conditions.push({ condition: "singing", effects: [] });
    doc.catalogs.push({ id: "hymns", label: "Hymns", feeds: ["features"], entries: [structuredClone(hymn)] });
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
    lists: { features: rowsFromCatalogEntry("hymns", hymn).map((row) => row.row) },
  });
  const crack = (occupants?: "stay" | "shove") =>
    ({
      id: "crack",
      name: "Ice Cracks",
      budget: "action",
      range: 60,
      area: { shape: "burst", size: 5 },
      ground: { terrain: "water", ...(occupants ? { occupants } : {}) },
    }) as never;
  const block = (occupants?: "stay" | "shove"): RulesetStatBlock =>
    ({ health: 100, defense: 10, initiativeModifier: 0, speed: 30, actions: [crack(occupants)] }) as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (
    ada: { x: number; y: number },
    props: unknown[] = [],
    occupants?: "stay" | "shove",
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {}, catalogs: { hymns: [hymn] } },
        { id: "foe", name: "Foe", side: "enemy", block: block(occupants) },
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { ada, foe: { x: 14, y: 8 } },
        props: props as never,
      },
    });
    state.order = ["ada", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    state.turn = state.order.indexOf(choice.actorId);
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const ids = (state: RulesetEncounterState, id = "ada") =>
    rulesetCombatOptions(definition, state, id).map((one) => one.id);

  // ── The bonfire lit again ──
  {
    const bonfire = {
      id: "p1",
      label: "Bonfire",
      cells: [{ x: 5, y: 5 }],
      health: 10,
      relight: { light: "bright", squares: 1 },
    };
    const state = fight({ x: 4, y: 5 }, [bonfire]);
    // Lit as the board was handed it: nothing to light.
    assert.ok(!ids(state).includes("relight:p1"));
    // Bonfire Gutters: dark around it.
    state.board!.grid.ground = { "5,5": { light: "dark" }, "6,6": { light: "dark" } };
    assert.ok(ids(state).includes("relight:p1"));
    const option = rulesetCombatOptions(definition, state, "ada").find((one) => one.id === "relight:p1")!;
    assert.equal(option.label, "Light Bonfire again");
    assert.equal(option.budget, "action");
    const lit = act(state, { actorId: "ada", optionId: "relight:p1", targetIds: [] });
    assert.deepEqual(of(lit.events, "relit"), [
      { type: "relit", actorId: "ada", propId: "p1", label: "Bonfire", cells: 9 },
    ]);
    assert.equal(lit.state.board!.grid.ground?.["5,5"]?.light, "bright");
    assert.equal(lit.state.board!.grid.ground?.["6,6"]?.light, "bright");
    assert.equal(who(lit.state, "ada").budgets.action, 0);
    assert.ok(!ids(lit.state).includes("relight:p1"), "lit, and no action left");
    // Too far off to reach it.
    const far = fight({ x: 1, y: 1 }, [bonfire]);
    far.board!.grid.ground = { "5,5": { light: "dark" } };
    assert.ok(!ids(far).includes("relight:p1"));
    // Painted on a battlefield.
    assert.ok(worldBattlefieldPropSchema.safeParse(bonfire).success);
    assert.equal(
      worldBattlefieldPropSchema.safeParse({ ...bonfire, relight: { light: "dark", squares: 1 } }).success,
      false,
    );
  }

  // ── Through the ice: they stay in the water, or are moved off as before ──
  {
    const fallen = fight({ x: 6, y: 6 }, [], "stay");
    const cracked = act(fallen, { actorId: "foe", optionId: "crack", targetIds: [], at: { x: 6, y: 6 } });
    assert.equal(cracked.state.board!.grid.tiles[6]![6], "water");
    assert.deepEqual([who(cracked.state, "ada").x, who(cracked.state, "ada").y], [6, 6], "in the water");
    assert.equal(of(cracked.events, "boardEvent")[0]?.moved, undefined);
    const shoved = act(fight({ x: 6, y: 6 }), { actorId: "foe", optionId: "crack", targetIds: [], at: { x: 6, y: 6 } });
    assert.notDeepEqual([who(shoved.state, "ada").x, who(shoved.state, "ada").y], [6, 6]);
  }

  // ── A verse only at the Wheel ──
  {
    const wheel = { id: "p7", label: "Year-Wheel", cells: [{ x: 8, y: 5 }], health: 50 };
    const verse = (state: RulesetEncounterState) =>
      rulesetCombatOptions(definition, state, "ada").some((one) => one.label === "Sing a Verse");
    assert.ok(verse(fight({ x: 7, y: 5 }, [wheel])), "beside the Wheel");
    assert.ok(!verse(fight({ x: 5, y: 5 }, [wheel])), "three squares off");
    assert.ok(verse(fight({ x: 9, y: 6 }, [{ ...wheel, label: "Wheel" }])) === false, "another prop's label");
    const byId = parsed(
      document((doc) => {
        doc.catalogs.find((one: { id: string }) => one.id === "hymns").entries[0].mechanics.usableNear.prop = "p7";
      }),
    );
    // By its id: a Wheel under another label is still p7.
    const sungById = createRulesetEncounter({
      definition: byId,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build,
          live: {},
          catalogs: { hymns: byId.catalogs!.find((one) => one.id === "hymns")!.entries! },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { ada: { x: 7, y: 5 }, foe: { x: 14, y: 8 } },
        props: [{ ...wheel, label: "The Old Wheel" }] as never,
      },
    });
    sungById.order = ["ada", "foe"];
    sungById.turn = 0;
    assert.ok(
      rulesetCombatOptions(byId, sungById, "ada").some((one) => one.label === "Sing a Verse"),
      "by its id, whatever its label",
    );
    const broken = fight({ x: 7, y: 5 }, [wheel]);
    broken.board!.props![0]!.health = 0;
    assert.ok(!verse(broken), "the Wheel broken");
  }

  // ── Refused, and the gate ──
  {
    const bad = parseRulesetDefinition(
      document((doc) => {
        const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        creatures.entries[0].creature.actions[0].ground = { occupants: "stay" };
      }),
    );
    assert.equal(bad.ok, false);
    if (!bad.ok)
      assert.ok(
        bad.issues.some((issue) => /needs a "terrain"/.test(issue)),
        bad.issues.join("; "),
      );
    const gate =
      "A ruleset with a use only beside a prop, or a change to the ground that leaves whoever stands there in it, requires schemaVersion 2 and capabilityApi 1.332 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(331) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(332) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(331) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Relight, ice and the Wheel: a bonfire lit again from beside it, the ice gives way under whoever stands on it, and a verse is sung only at the Wheel.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
