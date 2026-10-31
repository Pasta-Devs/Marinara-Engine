/**
 * A sense of presence only (Capability API 1.444).
 *
 *   - Primeval Awareness: said as it comes on, and again as its holder's turn starts, which of its
 *     kinds are within reach; nothing of where or how many, and a hidden fiend stays hidden.
 *   - Out of reach, or none of its kinds: it says none.
 *   - Refusals and the install gate.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-presence-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 444);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const awareness = { within: 60, of: { types: ["fiend", "undead"] } };
  const fiveE = (presence: unknown = awareness, types = true): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    if (types) {
      doc.combat.creatureTypes = {
        types: ["fiend", "undead", "humanoid"].map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
      };
    }
    doc.sheet.live.conditions.push({ id: "primeval", label: "Primeval Awareness" });
    doc.combat.conditions.push({ condition: "primeval", effects: [], presence });
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
  const definition = parsed(fiveE());
  const block = (type: string): RulesetStatBlock =>
    ({ health: 20, defense: 12, initiativeModifier: 0, speed: 30, type, actions: [] }) as unknown as RulesetStatBlock;
  const fight = (impAt: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "ranger",
          name: "Ranger",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
            fields: { level: 5, ac: 15, speed: 30, hp_max: 44 },
          }),
          live: {},
        },
        { id: "imp", name: "Imp", side: "enemy", block: block("fiend") },
        { id: "imp2", name: "Imp 2", side: "enemy", block: block("fiend") },
        { id: "goblin", name: "Goblin", side: "enemy", block: block("humanoid") },
      ],
      board: {
        grid: { width: 40, height: 3, tiles: Array.from({ length: 3 }, () => Array(40).fill("plains")) } as never,
        placements: {
          ranger: { x: 1, y: 1 },
          imp: { x: impAt, y: 1 },
          imp2: { x: impAt, y: 2 },
          goblin: { x: 3, y: 1 },
        },
      },
    });
    state.order = ["ranger", "imp", "imp2", "goblin"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const end = (state: RulesetEncounterState, actorId: string) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, () => 10);

  // ── Primeval Awareness ──
  {
    const state = fight(10);
    who(state, "imp").hiding = { total: 30, from: ["ranger"] } as never;
    who(state, "ranger").tracked.push({ condition: "primeval", rounds: 10 });
    const first = end(state, "ranger");
    assert.deepEqual(
      of(first.events, "presence").map((one) => one.kinds),
      [["Fiend"]],
      "said once as it comes on, one kind for two imps, no goblin",
    );
    assert.deepEqual(who(first.state, "imp").hiding?.from, ["ranger"], "the hidden imp stays hidden");
    // Not said again on the others' turns...
    let state2 = end(first.state, "imp");
    assert.equal(of(state2.events, "presence").length, 0);
    state2 = end(end(state2.state, "imp2").state, "goblin");
    // ...but as the ranger's own turn starts.
    assert.deepEqual(
      of(state2.events, "presence").map((one) => [one.actorId, one.kinds]),
      [["ranger", ["Fiend"]]],
    );
  }

  // ── Out of reach: none ──
  {
    const state = fight(30);
    who(state, "ranger").tracked.push({ condition: "primeval", rounds: 10 });
    assert.deepEqual(
      of(end(state, "ranger").events, "presence").map((one) => one.kinds),
      [[]],
    );
  }

  // ── Refusals ──
  refused(fiveE({ within: 60, of: { types: ["dragon"] } }), /dragon/);
  refused(fiveE(awareness, false), /creatureTypes/);
  refused(fiveE({ within: 60 }), /of/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions sense only the presence of some kinds of creature (presence) requires schemaVersion 2 and capabilityApi 1.444 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(443) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(444) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(443) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Presence: Primeval Awareness says which kinds are near as it comes on and at each of its holder's turns, never where or how many, and none out of reach; gated at 1.444.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
