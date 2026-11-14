/**
 * A second turn in a fight's first round (Capability API 1.238): 5e's Thief's Reflexes.
 *
 *   - A sheet row whose entry has `extraFirstTurn` takes a second turn in round 1, at its own
 *     initiative plus the entry's number, after everybody at that number or above it.
 *   - Each turn is a whole turn: what is counted per turn comes back for it (5e's reaction).
 *   - From round 2 on, one turn a round again. One down by then simply misses the second.
 *   - `unlessSurprised`: none for one who begins the fight surprised.
 *   - The log line, import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-extra-turn-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 233);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const reflexesOf = (extraFirstTurn: Record<string, unknown>) =>
    ({
      id: "reflexes",
      label: "Thief's Reflexes",
      rows: [{ list: "features", values: { name: "Thief's Reflexes" } }],
      mechanics: { kind: "utility", extraFirstTurn },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (reflexes: RulesetCatalogEntry, edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "rogue", label: "Rogue", feeds: ["features"], entries: [structuredClone(reflexes)] });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const goblin: RulesetStatBlock = {
    health: 10,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "slash", label: "Slash", kind: "attack", toHit: 4, damage: { dice: "1d6", bonus: 2 } }],
  } as unknown as RulesetStatBlock;
  const person = (id: string, name: string, dex: number, entries: RulesetCatalogEntry[]) => ({
    id,
    name,
    side: "party" as const,
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex, con: 12, int: 10, wis: 10, cha: 10 },
      fields: { level: 17, ac: 14, speed: 30, hp_max: 40 },
      lists: { features: entries.flatMap((entry) => rowsFromCatalogEntry("rogue", entry).map((row) => row.row)) },
    }),
    live: {},
    catalogs: { rogue: entries },
  });
  const fight = (reflexes: RulesetCatalogEntry, surprised: string[] = []) => {
    const definition = parsed(fiveE(reflexes));
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        person("rogue", "Rogue", 18, [reflexes]),
        person("fighter", "Fighter", 10, []),
        { id: "goblin", name: "Goblin", side: "enemy", block: goblin },
      ],
      surprised,
    });
    return { definition, state };
  };
  const endTurn = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    const actor = currentRulesetActor(state)!;
    const end = rulesetCombatOptions(definition, state, actor.id).find((one) => one.kind === "end-turn")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor.id, optionId: end.id, targetIds: [] },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const turns = (definition: RulesetDefinition, state: RulesetEncounterState, count: number) => {
    const seen: string[] = [];
    let now = state;
    for (let step = 0; step < count; step++) {
      const next = endTurn(definition, now);
      seen.push(...of(next.events, "turn").map((one) => `${one.round}:${one.actorId}`));
      now = next.state;
    }
    return { seen, state: now };
  };
  const reflexes = reflexesOf({ initiative: -10, unlessSurprised: true });

  // ── Two turns in the first round, the second at 14 - 10 ──
  {
    const { definition, state } = fight(reflexes);
    assert.equal(rulesetCombatant(state, "rogue")!.initiative, 14);
    assert.deepEqual(state.order, ["rogue", "fighter", "goblin", "rogue"]);
    assert.deepEqual(of(state.opening, "extraTurn"), [
      { type: "extraTurn", actorId: "rogue", initiative: 4, label: "Thief's Reflexes" },
    ]);
    // Initiative is told once for each of them.
    assert.deepEqual(
      of(state.opening, "initiative")[0]!.entries.map((one) => one.actorId),
      ["rogue", "fighter", "goblin"],
    );
    // Spent on the first turn,
    rulesetCombatant(state, "rogue")!.budgets.reaction = 0;
    rulesetCombatant(state, "rogue")!.budgets.action = 0;
    const { seen, state: after } = turns(definition, state, 5);
    assert.deepEqual(seen, ["1:fighter", "1:goblin", "1:rogue", "2:rogue", "2:fighter"]);
    // the second starts with them back: 5e's reaction returns at the start of a turn.
    const third = turns(definition, state, 3).state;
    assert.equal(currentRulesetActor(third)!.id, "rogue");
    assert.equal(rulesetCombatant(third, "rogue")!.budgets.action, 1);
    assert.equal(rulesetCombatant(third, "rogue")!.budgets.reaction, 1);
    // One turn a round from round 2 on.
    assert.deepEqual(after.order, ["rogue", "fighter", "goblin"]);
    assert.deepEqual(turns(definition, after, 3).seen, ["2:goblin", "3:rogue", "3:fighter"]);
  }

  // ── Down before the second turn comes: it is simply missed ──
  {
    const { definition, state } = fight(reflexes);
    const next = turns(definition, state, 1).state;
    const rogue = rulesetCombatant(next, "rogue")!;
    rogue.defeated = true;
    assert.deepEqual(turns(definition, next, 2).seen, ["1:goblin", "2:fighter"]);
  }

  // ── At a number somebody else holds, after them ──
  {
    const { state } = fight(reflexesOf({ initiative: -4 }));
    assert.deepEqual(state.order, ["rogue", "fighter", "goblin", "rogue"]);
    const { state: first } = fight(reflexesOf({ initiative: -3 }));
    assert.deepEqual(first.order, ["rogue", "rogue", "fighter", "goblin"]);
  }

  // ── Surprised: none, when the entry says so ──
  {
    const { state } = fight(reflexes, ["rogue"]);
    assert.deepEqual(state.order, ["rogue", "fighter", "goblin"]);
    assert.deepEqual(of(state.opening, "extraTurn"), []);
    const { state: anyway } = fight(reflexesOf({ initiative: -10 }), ["rogue"]);
    assert.deepEqual(anyway.order, ["rogue", "fighter", "goblin", "rogue"]);
  }

  // ── Import refusals ──
  {
    for (const bad of [{ initiative: -200 }, { initiative: -10, whenSurprised: true }, { initiative: 1.5 }]) {
      assert.equal(parseRulesetDefinition(fiveE(reflexesOf(bad))).ok, false, JSON.stringify(bad));
    }
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
      "A ruleset with uses that give a second turn in a fight's first round requires schemaVersion 2 and capabilityApi 1.238 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    const giving = fiveE(reflexes);
    assert.equal(issue(237, giving), gate);
    assert.notEqual(issue(238, giving), gate);
    assert.notEqual(issue(237, without), gate);
    assert.equal(issue(237, without, new Map([["rogue.json", { entries: [reflexes] }]])), gate);
  }

  console.log(
    "Ruleset extra turn: Thief's Reflexes takes a second first-round turn at initiative - 10, not when surprised, one turn a round after; gated at 1.238.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
