/**
 * Commands broken at a cost (Capability API 1.644): 5e's Geas.
 *
 *   - A condition whose `harms` comes `at` "defies" stops nothing it commands: what its
 *     "cannot-harm" would stop is offered, marked with the condition it breaks, and doing it deals
 *     the harm once the choice is done; `once` deals it only the first time. Without "defies" it
 *     is not offered at all.
 *   - Its `forbids.components`: a spoken spell cast against it.
 *   - Its `behavior.keepsIn`: a walk to a cell it may not go to is marked and harms; one inside it
 *     breaks nothing.
 *   - What import refuses, and the install gate.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-defies-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 644);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (rule: Record<string, unknown>) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "geased", label: "Geased" });
    doc.combat.components = [{ id: "verbal", label: "Verbal" }];
    doc.combat.conditions.push({ condition: "geased", effects: [], ...rule });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block = (attacks: boolean): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: attacks
        ? [
            { id: "club", name: "Club", budget: "action", toHit: 10, damage: { count: 1, sides: 6, flat: 0 } },
            {
              id: "bolt",
              name: "Bolt",
              budget: "action",
              components: ["verbal"],
              toHit: 10,
              damage: { count: 1, sides: 6, flat: 0 },
            },
          ]
        : [],
    }) as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const board = {
    grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) },
    placements: { ogre: { x: 1, y: 1 }, cleric: { x: 2, y: 1 }, friend: { x: 8, y: 1 } },
  };
  const fight = (definition: RulesetDefinition, positioned = false) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", block: block(true) },
        { id: "cleric", name: "Cleric", side: "party", block: block(false) },
        { id: "friend", name: "Friend", side: "party", block: block(false) },
      ],
      ...(positioned ? { board } : {}),
    });
    state.order = ["ogre", "cleric", "friend"];
    state.turn = 0;
    rulesetCombatant(state, "ogre")!.tracked.push({ condition: "geased", source: "cleric" } as never);
    return state;
  };
  const option = (definition: RulesetDefinition, state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "ogre").find((one) => one.label === label);
  const act = (definition: RulesetDefinition, state: RulesetEncounterState, choice: Record<string, unknown>) => {
    const step = applyRulesetCombatChoice(definition, state, { actorId: "ogre", ...choice } as never, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const ogreHarm = (events: RulesetCombatEvent[]) =>
    of(events, "damage")
      .filter((one) => one.targetId === "ogre")
      .map((one) => one.dealt);
  const geas = { at: "defies", dice: "5d10", type: "psychic", once: true };

  // ── "cannot-harm" broken: offered, marked, harmed once ──
  {
    const definition = parsed(document({ effects: ["cannot-harm"], harms: geas }));
    let state = fight(definition);
    const club = option(definition, state, "Club")!;
    assert.deepEqual(club.defies, { conditions: ["geased"] });
    const first = act(definition, state, { optionId: club.id, targetIds: ["friend"] });
    assert.ok(of(first.events, "attack").length > 0, "the blow is made");
    assert.deepEqual(ogreHarm(first.events), [15], "5d10 psychic for breaking it");
    state = first.state;
    state.turn = 0;
    rulesetCombatant(state, "ogre")!.budgets.action = 1;
    const again = act(definition, state, { optionId: club.id, targetIds: ["friend"] });
    assert.deepEqual(ogreHarm(again.events), [], "no more than once");
    // Nothing it commands, nothing broken.
    const plain = option(definition, fight(definition), "Club");
    assert.ok(plain?.defies, "still marked while it holds");
  }
  {
    const definition = parsed(document({ effects: ["cannot-harm"] }));
    assert.equal(option(definition, fight(definition), "Club"), undefined, "a command not to be broken");
  }

  // ── "forbids.components": the spoken bolt cast against it, the club not ──
  {
    const definition = parsed(
      document({ forbids: { components: ["verbal"] }, harms: { at: "defies", flat: 4, type: "psychic" } }),
    );
    const state = fight(definition);
    assert.equal(option(definition, state, "Club")!.defies, undefined);
    const bolt = option(definition, state, "Bolt")!;
    assert.deepEqual(bolt.defies, { conditions: ["geased"] });
    assert.deepEqual(
      ogreHarm(act(definition, fight(definition), { optionId: "club", targetIds: ["friend"] }).events),
      [],
    );
    assert.deepEqual(ogreHarm(act(definition, state, { optionId: bolt.id, targetIds: ["friend"] }).events), [4]);
  }

  // ── "behavior.keepsIn": only a walk out of the ring breaks it ──
  {
    const definition = parsed(
      document({ behavior: { keepsIn: 5 }, harms: { at: "defies", flat: 4, type: "psychic" } }),
    );
    const state = fight(definition, true);
    const walk = rulesetCombatOptions(definition, state, "ogre").find((one) => one.id === "move:walk")!;
    const cells = walk.defies?.cells ?? [];
    assert.ok(cells.length > 0, "cells out of the ring are offered, marked");
    assert.ok(cells.every((cell) => Math.max(Math.abs(cell.x - 2), Math.abs(cell.y - 1)) > 1));
    const inside = walk.cells!.find((cell) => !cells.some((one) => one.x === cell.x && one.y === cell.y))!;
    assert.ok(inside, "and the ones inside it too");
    assert.deepEqual(
      ogreHarm(
        act(definition, fight(definition, true), { optionId: walk.id, to: { x: inside.x, y: inside.y } }).events,
      ),
      [],
    );
    const out = act(definition, fight(definition, true), { optionId: walk.id, to: { x: cells[0]!.x, y: cells[0]!.y } });
    assert.deepEqual(ogreHarm(out.events), [4]);
    assert.equal(rulesetCombatant(out.state, "ogre")!.x, cells[0]!.x, "and it went");
  }

  // ── What import refuses ──
  {
    const result = parseRulesetDefinition(document({ harms: geas }));
    assert.ok(!result.ok);
    assert.ok(
      result.issues.some((issue) => issue.includes("says what it commands")),
      result.issues.join("; "),
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose commands its holder may break at a cost (harms.at defies) requires schemaVersion 2 and capabilityApi 1.644 or newer";
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
    const doc = () => document({ effects: ["cannot-harm"], harms: { at: "defies", dice: "5d10" } });
    assert.equal(getCapabilityPackageInstallIssue(manifest(643) as never, doc()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(644) as never, doc()), gate);
  }

  console.log(
    "Defies: a Geas's commands broken at a cost (a blow, a spell, a walk out of its ring), harmed once where it says; refused with nothing commanded; gated at 1.644.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
