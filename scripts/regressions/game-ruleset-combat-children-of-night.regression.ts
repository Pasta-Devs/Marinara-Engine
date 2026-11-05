/**
 * A call offered only where it says, and called creatures that arrive after their caller's turns
 * (Capability API 1.614): a vampire's Children of the Night, "calls 2d4 swarms of bats or rats,
 * provided that the sun isn't up. While outdoors, the vampire can call 3d6 wolves instead. The
 * called creatures arrive in 1d4 rounds".
 *
 *   - Under the sun nothing is offered; at night outdoors, all three; at night in a dungeon, no
 *     wolves.
 *   - Called, they are on their way, and arrive as the vampire's second turn after starts.
 *   - Refusals; the install gate.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-children-of-night-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 614);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const night = { notLight: ["sunlight"] };
  const children: Record<string, unknown> = {
    options: [
      { creature: "creatures/bats", count: { flat: 2 }, label: "Bats", onlyWhere: night },
      { creature: "creatures/rats", count: { flat: 2 }, label: "Rats", onlyWhere: night },
      { creature: "creatures/wolf", count: { flat: 3 }, label: "Wolves", onlyWhere: { ...night, outdoors: true } },
    ],
    arrivesIn: { flat: 2 },
    rounds: 600,
  };
  const bite = { id: "bite", name: "Bite", budget: "action", toHit: 4, reach: 5, damage: { flat: 3 } };
  const creature = (actions: unknown[]) => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    tier: "cr_1",
    actions,
  });
  const fiveE = (calls: Record<string, unknown> = children): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(
        {
          id: "vampire",
          label: "Vampire",
          creature: creature([
            bite,
            { id: "children", name: "Children of the Night", budget: "action", uses: { per: "day", count: 1 }, calls },
          ]),
        },
        { id: "bats", label: "Swarm of Bats", creature: creature([bite]) },
        { id: "rats", label: "Swarm of Rats", creature: creature([bite]) },
        { id: "wolf", label: "Wolf", creature: creature([bite]) },
      );
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const roll = (sides: number) => Math.min(sides, 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const fight = (light: "sunlight" | "dark", environment?: string): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
          }),
          live: {},
        },
        { id: "vampire", name: "Vampire", side: "enemy", creature: { catalogId: "creatures", entryId: "vampire" } },
      ],
      board: {
        grid: { width: 20, height: 10, tiles: Array.from({ length: 10 }, () => Array(20).fill("plains")) },
        placements: { ada: { x: 2, y: 2 }, vampire: { x: 14, y: 5 } },
        light,
        ...(environment ? { environment } : {}),
      },
    });
    for (const one of state.combatants) one.initiative = { ada: 5, vampire: 20 }[one.id]!;
    state.order = ["vampire", "ada"];
    state.turn = 0;
    return state;
  };
  const offered = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "vampire")
      .find((one) => one.id === "children")
      ?.modes?.map((one) => one.label);

  // ── Where it is offered ──
  assert.equal(offered(fight("sunlight")), undefined, "not under the sun");
  assert.deepEqual(offered(fight("dark")), ["Bats", "Rats", "Wolves"]);
  assert.deepEqual(offered(fight("dark", "dungeon")), ["Bats", "Rats"], "no wolves indoors");
  assert.deepEqual(offered(fight("dark", "forest")), ["Bats", "Rats", "Wolves"]);
  // Wolves asked for indoors are refused.
  {
    const taken = applyRulesetCombatChoice(
      definition,
      fight("dark", "dungeon"),
      { actorId: "vampire", optionId: "children", targetIds: [], mode: "call-2" },
      roll,
    );
    assert.ok(of(taken.events, "refused").length > 0);
  }

  // ── On their way, and arriving two of the vampire's turns on ──
  {
    let state = applyRulesetCombatChoice(
      definition,
      fight("dark"),
      { actorId: "vampire", optionId: "children", targetIds: [], mode: "call-2" },
      roll,
    ).state;
    const wolves = state.combatants.filter((one) => one.calledBy === "vampire");
    assert.equal(wolves.length, 3);
    assert.ok(
      wolves.every((one) => one.defeated && one.away?.arriving === 2),
      "on their way",
    );
    const arrivedAt: number[] = [];
    for (let step = 0; step < 12 && arrivedAt.length === 0; step += 1) {
      const taken = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] },
        roll,
      );
      state = taken.state;
      if (of(taken.events, "arrived").length) arrivedAt.push(state.round);
      else
        assert.ok(
          state.combatants.filter((one) => one.calledBy === "vampire").every((one) => one.defeated),
          "not yet",
        );
    }
    const here = state.combatants.filter((one) => one.calledBy === "vampire");
    assert.ok(
      here.every((one) => !one.defeated && !one.away && one.x !== undefined),
      "arrived, on the board",
    );
    assert.equal(arrivedAt.length, 1);
    assert.equal(state.order[state.turn], "vampire", "as the vampire's turn starts");
  }

  // ── Refusals ──
  refused(fiveE({ ...children, arrivesIn: { flat: 0 } }), /They arrive after one turn at least/);
  refused(
    fiveE({
      ...children,
      options: [
        { creature: "creatures/bats", count: { flat: 1 }, onlyWhere: {} },
        ...(children.options as unknown[]).slice(1),
      ],
    }),
    /Say where: "notLight", "outdoors" or "indoors"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a call offered only where it says (onlyWhere), or whose creatures arrive after their caller's turns (calls.arrivesIn), requires schemaVersion 2 and capabilityApi 1.614 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(613) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(613) as never, fiveE({ ...children, arrivesIn: undefined })),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(614) as never, fiveE()), gate);
  }

  console.log("Children of the Night: offered by light and place, arriving after the vampire's turns; gated at 1.614.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
