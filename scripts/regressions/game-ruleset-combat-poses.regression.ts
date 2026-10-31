/**
 * Fight poses (Capability API 1.786), the marks before the art:
 *
 *   - `combat.poses` parses; a `divine` with neither `entries` nor `column` and `values` is refused, and
 *     so is a `hidden` condition the ruleset does not have.
 *   - What is cast by praying (marked `divine`, or named as a Channel Divinity) is listed on the
 *     fighter as `prays`; using it logs "prayed" and marks them Praying until their next turn.
 *   - A party member holding a `hidden` condition is told to the screen as hidden (sneaking).
 *   - Without `combat.poses` nothing of it is told; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-combat-poses-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const {
  commandRulesetCombatDirector,
  createRulesetFight,
  directedRulesetView,
  rulesetDirectorStage,
  syncRulesetCombatants,
} = await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 786);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const poses = { hidden: ["invisible"], divine: { column: "class", values: ["Cleric", "Paladin"] } };
  const fiveE = (with_?: unknown): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    if (with_ !== undefined) doc.combat.poses = with_;
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

  // ── The schema ──
  parsed(fiveE(poses));
  parsed(fiveE({ divine: { entries: ["spells/bless"] } }));
  refused(fiveE({ divine: { column: "class" } }), /column.*values|entries/i);
  refused(fiveE({ hidden: ["unseen"] }), /Unknown condition "unseen"/);

  // ── A fight: Ada, a cleric, beside a lurker ──
  const fightWith = (definition: RulesetDefinition) => {
    const creaturesId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const hero = defaultRulesetSheetBuild(definition);
    hero.fields = { ...hero.fields, hp_max: 40 };
    const built = createRulesetFight({
      definition,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "lurker", name: "Lurker", creature: `${creaturesId}/thorn-lurker` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: hero } }],
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
      enemies: [unit("lurker", "Lurker", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    const encounter = state.rulesetFight!.encounter;
    const ada = rulesetCombatant(encounter, "ada")!;
    const lurker = rulesetCombatant(encounter, "lurker")!;
    const grid = encounter.board!.grid!;
    ada.x = Math.floor(grid.width / 2);
    ada.y = Math.floor(grid.height / 2);
    lurker.x = ada.x + 1;
    lurker.y = ada.y;
    // Ada goes first. Her first attack stands in for a prayer marked `divine`; another option is
    // renamed a Channel Divinity, prayed by its name alone.
    encounter.order = ["ada", "lurker"];
    encounter.turn = 0;
    const strike = ada.actions.find((action) => action.targets.count > 0)!;
    assert.ok(strike, "Ada has something to aim");
    strike.divine = true;
    const turning = ada.actions.find((action) => action !== strike)!;
    turning.label = "Channel Divinity: Turn Undead";
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    return { state, strike, turning };
  };
  const fighter = (definition: RulesetDefinition, state: never, id: string) =>
    directedRulesetView(definition, state)!.combatants.find((combatant) => combatant.id === id)!;

  {
    const definition = parsed(fiveE(poses));
    const { state, strike, turning } = fightWith(definition);
    const before = fighter(definition, state as never, "ada");
    assert.deepEqual(before.prays?.slice().sort(), [strike.id, turning.id].sort(), "marked and named prayers");
    assert.ok(!before.stances?.includes("praying"));
    assert.equal(fighter(definition, state as never, "lurker").prays, undefined, "the lurker prays nothing");

    const done = commandRulesetCombatDirector(
      definition,
      state as never,
      {
        type: "ruleset",
        optionId: strike.id,
        targetIds: ["lurker"],
      } as never,
    );
    assert.ok(done.ok, JSON.stringify(done));
    const fight = (state as { rulesetFight: { events: Array<{ event: Record<string, unknown> }> } }).rulesetFight;
    const prayed = fight.events.find(({ event }) => event.type === "prayed");
    assert.deepEqual(prayed?.event, { type: "prayed", actorId: "ada", optionId: strike.id, label: strike.label });
    assert.ok(fighter(definition, state as never, "ada").stances?.includes("praying"), "praying after the cast");
    // Her next turn begins: no longer praying.
    fight.events.push({ seq: 1e9, event: { type: "turn", actorId: "ada", round: 9 } } as never);
    assert.ok(!fighter(definition, state as never, "ada").stances?.includes("praying"), "until her next turn");

    // Invisible, she sneaks; the lurker is never told hidden.
    const ada = rulesetCombatant((state as { rulesetFight: { encounter: never } }).rulesetFight.encounter, "ada")!;
    assert.equal(fighter(definition, state as never, "ada").hidden, undefined);
    ada.tracked.push({ condition: "invisible" } as never);
    const seen = fighter(definition, state as never, "ada");
    assert.equal(seen.hidden, true, "hidden while it holds");
    assert.ok(seen.stances?.includes("hidden"), "and marked Hidden");
    ada.tracked.pop();
    {
      const lurker = rulesetCombatant(
        (state as { rulesetFight: { encounter: never } }).rulesetFight.encounter,
        "lurker",
      )!;
      lurker.tracked.push({ condition: "invisible" } as never);
      assert.equal(fighter(definition, state as never, "lurker").hidden, undefined, "an opponent is never told");
      lurker.tracked.pop();
    }
  }

  // ── Without combat.poses nothing is told ──
  {
    const definition = parsed(fiveE());
    const { state, strike } = fightWith(definition);
    assert.equal(fighter(definition, state as never, "ada").prays, undefined);
    assert.ok(
      commandRulesetCombatDirector(
        definition,
        state as never,
        {
          type: "ruleset",
          optionId: strike.id,
          targetIds: ["lurker"],
        } as never,
      ).ok,
    );
    const fight = (state as { rulesetFight: { events: Array<{ event: { type: string } }> } }).rulesetFight;
    assert.ok(!fight.events.some(({ event }) => event.type === "prayed"));
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
    const gate = "A ruleset with fight poses (combat.poses) requires schemaVersion 2 and capabilityApi 1.786 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(785) as never, fiveE(poses)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(786) as never, fiveE(poses)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(785) as never, fiveE()), gate);
  }

  console.log(
    "Combat poses: parsed and refused; marked and named prayers listed, logged and shown until the next turn; a hidden party member sneaks; nothing without combat.poses; gated at 1.786.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
