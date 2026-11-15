/**
 * Drawn toward a creature on one's own reaction (Capability API 1.326): The Owed's Whisper a Name.
 *
 *   - `draws: { spends }` on a creature's action: whoever it lands on (on a failed save) spends that
 *     budget to walk up to their speed toward it there and then, by the open way to the nearest
 *     cell they can reach, drawing no strikes.
 *   - Nothing is spent, and nobody moves, on a made save, with none of the budget left, or when
 *     they could come no nearer.
 *   - Read off the bestiary; an unknown budget is refused; the install gate.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-whisper-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 326);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const whisper = (difficulty: number) => ({
    id: `whisper_${difficulty}`,
    name: "Whisper a Name",
    budget: "action",
    range: 120,
    save: { save: "wis_save", difficulty, onSuccess: "negates" },
    draws: { spends: "reaction" },
  });
  const owed = {
    id: "the-owed",
    label: "The Owed",
    creature: {
      health: 200,
      defense: 15,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_5",
      actions: [whisper(30), whisper(1)],
    },
  };
  const withOwed = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(owed);
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(withOwed());
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const roll = (sides: number) => Math.min(sides, 10);
  const fight = (ada = { x: 2, y: 4 }): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {} },
        { id: "owed", name: "The Owed", side: "enemy", creature: { catalogId: "creatures", entryId: "the-owed" } },
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { ada, owed: { x: 12, y: 4 } },
      },
    });
    state.order = ["owed", "ada"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const speak = (state: RulesetEncounterState, difficulty = 30) => {
    state.turn = 0;
    who(state, "owed").budgets.action = 1;
    const id = `whisper_${difficulty}`;
    assert.ok(
      rulesetCombatOptions(definition, state, "owed").some((one) => one.id === id),
      rulesetCombatOptions(definition, state, "owed")
        .map((one) => one.id)
        .join(),
    );
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "owed", optionId: id, targetIds: ["ada"] },
      roll,
    );
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };

  // ── Failed: Ada spends her reaction and walks her 30 feet toward the Owed ──
  {
    const heard = speak(fight());
    const [drawn] = of(heard.events, "drawn");
    assert.ok(drawn, JSON.stringify(heard.events));
    assert.deepEqual(
      [drawn.actorId, drawn.targetId, drawn.from, drawn.to],
      ["owed", "ada", { x: 2, y: 4 }, { x: 8, y: 4 }],
    );
    assert.equal(drawn.path.length, 6, "six cells, her speed");
    assert.deepEqual([who(heard.state, "ada").x, who(heard.state, "ada").y], [8, 4]);
    assert.equal(who(heard.state, "ada").budgets.reaction, 0, "her reaction spent");
    // With no reaction left, a second whisper moves her no further.
    const again = speak(heard.state);
    assert.deepEqual(of(again.events, "drawn"), []);
    assert.deepEqual([who(again.state, "ada").x, who(again.state, "ada").y], [8, 4]);
  }

  // ── A made save, or nowhere nearer to go: nothing spent ──
  {
    const kept = speak(fight(), 1);
    assert.deepEqual(of(kept.events, "drawn"), []);
    assert.equal(who(kept.state, "ada").budgets.reaction, 1);
    const close = speak(fight({ x: 11, y: 4 }));
    assert.deepEqual(of(close.events, "drawn"), [], "already beside it");
    assert.equal(who(close.state, "ada").budgets.reaction, 1);
    // Round a stream, the open way: never through it.
    const walled = fight();
    for (let y = 0; y < 9; y++) walled.board!.grid.tiles[y]![5] = "water";
    const round = speak(walled);
    const [way] = of(round.events, "drawn");
    assert.ok(way, JSON.stringify(round.events));
    assert.ok(
      way.path.every((cell) => walled.board!.grid.tiles[cell.y]![cell.x] !== "water"),
      "never through the stream",
    );
    assert.ok(way.to.y > 4, "toward the gap at the bottom");
  }

  // ── Refused, and the gate ──
  {
    const bad = parseRulesetDefinition(
      withOwed((doc) => {
        const entry = doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.find((one: { id: string }) => one.id === "the-owed");
        entry.creature.actions = [{ ...whisper(15), draws: { spends: "nerve" } }];
      }),
    );
    assert.equal(bad.ok, false);
    if (!bad.ok)
      assert.ok(
        bad.issues.some((issue) => /Unknown budget "nerve"/.test(issue)),
        bad.issues.join("; "),
      );
    const gate =
      "A ruleset with a creature action that draws whoever it lands on toward it requires schemaVersion 2 and capabilityApi 1.326 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(325) as never, withOwed()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(326) as never, withOwed()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(325) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Whisper a Name: a failed save spends the reaction to walk the speed toward the Owed, round walls, and nothing on a made save, no reaction or nowhere nearer.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
