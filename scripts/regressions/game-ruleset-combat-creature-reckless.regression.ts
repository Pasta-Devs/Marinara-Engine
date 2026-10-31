/**
 * A creature's free trait taken before it attacks (Capability API 1.606): a berserker's Reckless.
 *
 *   - A stat-block action may say `free` and `beforeAttack`: offered on its own turn before it has
 *     attacked, costing no budget, and gone once it has.
 *   - The Engine-run creature takes it as it makes a melee weapon attack, landing on itself.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-reckless-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 606);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const reckless = {
    id: "reckless",
    name: "Reckless",
    budget: "action",
    free: true,
    beforeAttack: true,
    self: true,
    applies: [
      { condition: "reckless", duration: { rounds: 1 } },
      { condition: "exposed", duration: { rounds: 1, at: "turn-start" } },
    ],
  };
  const greataxe = {
    id: "greataxe",
    name: "Greataxe",
    budget: "action",
    toHit: 5,
    damage: { dice: "1d12", flat: 3, type: "slashing" },
    reach: 5,
  };
  const fiveE = (actions: unknown[] = [greataxe, reckless]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "reckless", label: "Reckless" }, { id: "exposed", label: "Exposed" });
    doc.combat.conditions.push(
      { condition: "reckless", effects: ["own-attacks-advantage"] },
      { condition: "exposed", effects: ["attacks-against-advantage"] },
    );
    const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
    const berserker = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
    berserker.id = "berserker";
    berserker.label = "Berserker";
    berserker.creature.actions = actions;
    creatures.entries.push(berserker);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const creatures = definition.catalogs!.find((catalog) => catalog.holds === "creatures")!;
  const block = creatures.entries!.find((one) => one.id === "berserker")!.creature as unknown as RulesetStatBlock;

  // ── Offered free before it attacks, gone once it has ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "berserker", name: "Berserker", side: "enemy", block },
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 10, speed: 30, hp_max: 60 },
          }),
        },
      ],
      board: {
        grid: { width: 6, height: 4, tiles: Array.from({ length: 4 }, () => Array(6).fill("plains")) },
        placements: { berserker: { x: 1, y: 1 }, ada: { x: 2, y: 1 } },
      },
    });
    state.order = ["berserker", "ada"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "berserker").find((one) => one.label === "Reckless");
    assert.ok(option, "offered before it attacks");
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "berserker", optionId: option.id, targetIds: ["berserker"] },
      () => 10,
    );
    assert.deepEqual(
      taken.events.filter((one) => one.type === "refused"),
      [],
    );
    const after = rulesetCombatant(taken.state, "berserker")!;
    assert.ok(after.tracked.some((one) => one.condition === "reckless"));
    assert.ok(after.tracked.some((one) => one.condition === "exposed"));
    assert.equal(after.budgets.action, 1, "no budget spent");
    const axe = rulesetCombatOptions(definition, taken.state, "berserker").find((one) => one.label === "Greataxe")!;
    const struck = applyRulesetCombatChoice(
      definition,
      taken.state,
      { actorId: "berserker", optionId: axe.id, targetIds: ["ada"] },
      () => 10,
    );
    assert.equal(
      rulesetCombatOptions(definition, struck.state, "berserker").find((one) => one.label === "Reckless"),
      undefined,
      "not after an attack",
    );
  }

  // ── The Engine-run berserker takes it as it swings ──
  {
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const built = createRulesetFight({
      definition,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "berserker", name: "Berserker", creature: `${creatures.id}/berserker` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
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
      enemies: [unit("berserker", "Berserker", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    }
    const events = state.rulesetFight!.events.map((entry) => entry.event);
    const first = events.findIndex((event) => event.type === "attack" && event.actorId === "berserker");
    assert.ok(first >= 0, "the berserker swung");
    const reckoned = events.findIndex(
      (event) =>
        event.type === "condition" &&
        (event as { targetId?: string }).targetId === "berserker" &&
        (event as { condition?: string }).condition === "reckless",
    );
    assert.ok(reckoned >= 0 && reckoned < first, "Reckless first");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature action that is free or taken before it attacks (free, beforeAttack) requires schemaVersion 2 and capabilityApi 1.606 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(605) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(606) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(605) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Creature Reckless: offered free before it attacks, taken by the Engine as it swings; gated at 1.606.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
