/**
 * Squeezing, and moving as a smaller size (Capability API 1.681).
 *
 *   - `combat.sizes.squeezing`: a Large ogre goes down a corridor one cell wide as a Medium creature,
 *     each step there costing double, and stands squeezed in it holding the ruleset's condition,
 *     filling one cell; out of it, it is whole again and the condition is gone. Without the rule the
 *     corridor is closed to it.
 *   - A condition's `squeezesAs`: Amorphous, through the same corridor at a plain step's cost and
 *     with no condition.
 *   - Import refusals, and the install gate.
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
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetFootprint,
  rulesetReachableCells,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-squeezing-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { rankRulesetChoices } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 681);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (squeezing = true, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "squeezed", label: "Squeezed" }, { id: "amorphous", label: "Amorphous" });
    doc.combat.conditions.push(
      { condition: "squeezed", effects: ["own-attacks-disadvantage", "attacks-against-advantage"] },
      { condition: "amorphous", squeezesAs: "tiny" },
    );
    doc.combat.sizes = {
      order: [
        { id: "tiny", label: "Tiny" },
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
        { id: "huge", label: "Huge", cells: 3 },
      ],
      default: "medium",
      ...(squeezing ? { squeezing: { costs: 2, condition: "squeezed" } } : {}),
    };
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  // A wall from top to bottom, x 8 to 12, with a corridor one cell high through it on row 5.
  const grid = (): TacticalGrid => {
    const tiles = Array.from({ length: 15 }, () => Array(20).fill("plains"));
    for (let x = 8; x <= 12; x++) for (let y = 0; y < 15; y++) if (y !== 5) tiles[y]![x] = "wall";
    return { width: 20, height: 15, tiles } as TacticalGrid;
  };
  const fight = (definition: RulesetDefinition, keepsOn: string[] = []) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: {
            health: 59,
            defense: 11,
            initiativeModifier: 0,
            speed: 80,
            size: "large",
            keepsOn,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          block: {
            health: 20,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: { grid: grid(), placements: { ogre: { x: 5, y: 5 }, hero: { x: 18, y: 13 } } },
    });
    state.order = ["ogre", "hero"];
    state.turn = 0;
    return state;
  };
  const costTo = (definition: RulesetDefinition, state: RulesetEncounterState, cell: RulesetCombatCell) =>
    rulesetReachableCells(definition, state, "ogre").find((one) => one.x === cell.x && one.y === cell.y)?.cost;
  const walk = (definition: RulesetDefinition, state: RulesetEncounterState, to: RulesetCombatCell) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ogre", optionId: RULESET_MOVE_OPTION, targetIds: [], to },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
    );
    return step.state;
  };
  const holds = (state: RulesetEncounterState) => rulesetCombatant(state, "ogre")!.tracked.map((one) => one.condition);

  // ── Squeezed: double cost in the corridor, one cell, the condition; whole again out of it ──
  {
    const definition = parsed(fiveE());
    let state = fight(definition);
    assert.equal(costTo(definition, state, { x: 13, y: 5 }), 14, "two plain steps and six squeezed");
    assert.equal(costTo(definition, state, { x: 10, y: 5 }), 1 + 4 * 2);
    state = walk(definition, state, { x: 10, y: 5 });
    const ogre = rulesetCombatant(state, "ogre")!;
    assert.deepEqual(rulesetFootprint(ogre), [{ x: 10, y: 5 }], "one cell while squeezed");
    assert.deepEqual(holds(state), ["squeezed"]);
    // Onward, still paying the squeeze until it is out.
    ogre.movementLeft = 40;
    assert.equal(costTo(definition, state, { x: 13, y: 5 }), 2 * 2 + 1);
    state = walk(definition, state, { x: 13, y: 5 });
    assert.equal(rulesetFootprint(rulesetCombatant(state, "ogre")!).length, 4, "whole again");
    assert.deepEqual(holds(state), []);
  }
  // ── No squeezing rule: the corridor is closed ──
  {
    const definition = parsed(fiveE(false));
    const state = fight(definition);
    assert.equal(costTo(definition, state, { x: 10, y: 5 }), undefined);
  }
  // ── Amorphous: through at a plain step's cost, no condition ──
  {
    const definition = parsed(fiveE());
    let state = fight(definition, ["amorphous"]);
    assert.equal(costTo(definition, state, { x: 13, y: 5 }), 8);
    state = walk(definition, state, { x: 10, y: 5 });
    assert.deepEqual(holds(state), ["amorphous"]);
    assert.deepEqual(rulesetFootprint(rulesetCombatant(state, "ogre")!), [{ x: 10, y: 5 }]);
  }

  // ── Refusals ──
  refused(
    fiveE(true, (doc) => (doc.combat.sizes.squeezing.condition = "nosuch")),
    /Unknown condition "nosuch"/,
  );
  refused(
    fiveE(true, (doc) => {
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "amorphous").squeezesAs = "speck";
    }),
    /Unknown size "speck"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with squeezing, or a condition whose holder moves as a smaller size (sizes.squeezing, squeezesAs), requires schemaVersion 2 and capabilityApi 1.681 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(680) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(681) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(680) as never, JSON.parse(fiveEText)), gate);
  }

  // ── Getting away never into a gap it has to squeeze into, where it can stand whole (re-test 14) ──
  {
    const definition = parsed(fiveE());
    const hall = (): TacticalGrid => {
      const made = grid();
      for (let x = 0; x < 8; x++) for (let y = 0; y < 15; y++) if (y !== 4 && y !== 5) made.tiles[y]![x] = "wall";
      return made;
    };
    const claw = { id: "claw", name: "Claw", budget: "action", toHit: 4, reach: 1, damage: { count: 1, sides: 6 } };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: {
            health: 59,
            defense: 11,
            initiativeModifier: 0,
            speed: 30,
            size: "large",
            actions: [claw],
            behavior: { temperament: "cowardly" },
          } as unknown as RulesetStatBlock,
        },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          block: {
            health: 20,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [claw],
          } as unknown as RulesetStatBlock,
        },
      ],
      // A hall two cells high left of the wall, its corridor going on through it.
      board: { grid: hall(), placements: { ogre: { x: 6, y: 4 }, hero: { x: 5, y: 4 } } },
    });
    state.order = ["ogre", "hero"];
    state.turn = 0;
    const ogre = rulesetCombatant(state, "ogre")!;
    ogre.health = { ...ogre.health!, value: 10 };
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 20,
      maxHp: 20,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 9,
      skills: [],
      aiHints: { proficiency: "master" as const, temperament: "cowardly" as const },
    });
    const director = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("hero", "player")],
      enemies: [unit("ogre", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    director.enemies[0]!.tactics!.adjective = "cowardly";
    // Where its getaway would take it, as the Game Master's suggestions see it.
    const away = rankRulesetChoices(definition, director, state, "ogre", 50).find(
      (one) => one.candidate.action.defensive === "disengage",
    )?.candidate.action.to;
    assert.ok(away && !(away.y === 5 && away.x >= 8), `not into the corridor: ${JSON.stringify(away)}`);
  }

  // ── Squeezed beside its foe with open ground there too: it steps out to strike (re-test 17) ──
  {
    const definition = parsed(fiveE());
    let state = fight(definition);
    state = walk(definition, state, { x: 12, y: 5 });
    const claw = { id: "claw", name: "Claw", budget: "action", toHit: 4, reach: 1, damage: { count: 1, sides: 6 } };
    const ogre = rulesetCombatant(state, "ogre")!;
    ogre.actions.push(
      structuredClone(
        createRulesetEncounter({
          definition,
          seed: 1,
          roller: () => 10,
          combatants: [
            {
              id: "x",
              name: "x",
              side: "enemy",
              block: { health: 1, defense: 1, initiativeModifier: 0, speed: 30, actions: [claw] } as never,
            },
          ],
        }).combatants[0]!.actions.find((one) => one.id === "claw")!,
      ),
    );
    ogre.movementLeft = 30;
    const hero = rulesetCombatant(state, "hero")!;
    hero.x = 13;
    hero.y = 4;
    assert.deepEqual(holds(state), ["squeezed"]);
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 20,
      maxHp: 20,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 9,
      skills: [],
      aiHints: { proficiency: "master" as const },
    });
    const director = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("hero", "player")],
      enemies: [unit("ogre", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    const best = rankRulesetChoices(definition, director, state, "ogre", 5)[0]?.candidate.action;
    assert.equal(best?.choice.optionId, "claw", "it strikes");
    assert.ok(best?.to && best.to.x >= 13, `from open ground: ${JSON.stringify(best?.to)}`);
  }

  // ── A blow planned from a gap is reached from as much of it as fits there (cloud AI fights
  //    2026-10-25: a Draft Horse walked up to strike beside the water, squeezed on arriving, could not
  //    reach, and readied instead) ──
  {
    const definition = parsed(fiveE());
    const state = fight(definition);
    const claw = { id: "claw", name: "Claw", budget: "action", toHit: 4, reach: 1, damage: { count: 1, sides: 6 } };
    const ogre = rulesetCombatant(state, "ogre")!;
    ogre.actions.push(
      structuredClone(
        createRulesetEncounter({
          definition,
          seed: 1,
          roller: () => 10,
          combatants: [
            {
              id: "x",
              name: "x",
              side: "enemy",
              block: { health: 1, defense: 1, initiativeModifier: 0, speed: 30, actions: [claw] } as never,
            },
          ],
        }).combatants[0]!.actions.find((one) => one.id === "claw")!,
      ),
    );
    ogre.x = 3;
    ogre.y = 4;
    // In the corridor: whole, the ogre's nearest corner is in the wall, and squeezed it fills one cell.
    const hero = rulesetCombatant(state, "hero")!;
    hero.x = 10;
    hero.y = 5;
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 20,
      maxHp: 20,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 9,
      skills: [],
      aiHints: { proficiency: "master" as const },
    });
    const director = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("hero", "player")],
      enemies: [unit("ogre", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    const best = rankRulesetChoices(definition, director, state, "ogre", 5)[0]?.candidate.action;
    assert.equal(best?.choice.optionId, "claw", "it strikes");
    assert.ok(best?.to, "after a walk");
    const there = walk(definition, state, best.to);
    assert.deepEqual(holds(there), ["squeezed"]);
    const struck = applyRulesetCombatChoice(definition, there, { ...best.choice, actorId: "ogre" }, () => 10);
    assert.ok(
      struck.events.some((one) => one.type === "attack"),
      `the blow it walked for still reaches from ${JSON.stringify(best.to)}: ${JSON.stringify(struck.events)}`,
    );
  }

  console.log(
    "Squeezing: double steps between walls as one size smaller, squeezed while there; Amorphous freely; a getaway never into a squeeze; a blow planned from a gap reaches from what fits there; gated at 1.681.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
