/**
 * A creature's action kept up on its later turns (Capability API 1.727): a harpy's Luring Song.
 *
 *   - A creature action's `sustains`, as a catalog entry's (1.431): once what it put on is on, a
 *     bonus action keeps it up, its rounds started again, with no save.
 *   - Copied off its catalog entry into its block; import refusals and the install gate.
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
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-sustains-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 727);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const song = (sustains: unknown = { budget: "bonus" }) => ({
    id: "luring_song",
    name: "Luring Song",
    budget: "action",
    saveDifficulty: 11,
    applies: [{ condition: "charmed", duration: { rounds: 2 }, saveEnds: { save: "wis_save", at: "turn-end" } }],
    sustains,
  });
  const fiveE = (sustains?: unknown): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.actions.push(song(sustains));
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const harpyBlock = rulesetStatBlockFromCreature(definition, creature)!;
  assert.deepEqual(
    harpyBlock.actions.find((one) => one.id === "luring_song")?.sustains,
    { budget: "bonus" },
    "copied into its block",
  );
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 1,
      combatants: [
        { id: "harpy", name: "Harpy", side: "enemy", block: { ...harpyBlock, health: 40 } },
        {
          id: "sailor",
          name: "Sailor",
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
    });
    state.order = ["harpy", "sailor"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const find = (state: RulesetEncounterState, sustain: boolean) =>
    rulesetCombatOptions(definition, state, "harpy").find(
      (one) => one.label === "Luring Song" && !!one.sustain === sustain,
    );
  const charmed = (state: RulesetEncounterState) =>
    who(state, "sailor").tracked.find((one) => one.condition === "charmed");

  let state = fight();
  assert.equal(find(state, true), undefined, "nothing to keep up yet");
  const sung = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "harpy", optionId: find(state, false)!.id, targetIds: ["sailor"] },
    () => 1,
  );
  state = sung.state;
  assert.ok(charmed(state), "a failed save charms");
  state.round += 1;
  state.turn = 0;
  charmed(state)!.rounds = 1;
  const keep = find(state, true);
  assert.ok(keep, "kept up on a later turn");
  assert.equal(keep.budget, "bonus");
  const kept = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "harpy", optionId: keep.id, targetIds: ["sailor"] },
    () => 1,
  );
  assert.equal(of(kept.events, "save").length, 0, "no save again");
  assert.deepEqual(
    of(kept.events, "sustained").map((one) => [one.targetId, one.condition]),
    [["sailor", "charmed"]],
  );
  assert.equal(charmed(kept.state)!.rounds, 2, "started again");

  // ── An area's kept up on everybody still holding it, aimed at nobody ──
  {
    const doc = fiveE();
    Object.assign(
      doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.actions.at(-1),
      {
        area: { shape: "burst", size: 300, around: true },
      },
    );
    const area = parsed(doc);
    const block = rulesetStatBlockFromCreature(
      area,
      area.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!,
    )!;
    let wide = createRulesetEncounter({
      definition: area,
      seed: 1,
      roller: () => 1,
      combatants: [
        { id: "harpy", name: "Harpy", side: "enemy", block: { ...block, health: 40 } },
        {
          id: "sailor",
          name: "Sailor",
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
    });
    wide.order = ["harpy", "sailor"];
    wide.turn = 0;
    const options = () => rulesetCombatOptions(area, wide, "harpy").filter((one) => one.label === "Luring Song");
    const cast = applyRulesetCombatChoice(
      area,
      wide,
      { actorId: "harpy", optionId: options().find((one) => !one.sustain)!.id, targetIds: [] },
      () => 1,
    );
    assert.deepEqual(of(cast.events, "refused"), [], JSON.stringify(cast.events));
    wide = cast.state;
    assert.ok(charmed(wide), "the song charms");
    wide.round += 1;
    wide.turn = 0;
    charmed(wide)!.rounds = 1;
    const again = applyRulesetCombatChoice(
      area,
      wide,
      { actorId: "harpy", optionId: options().find((one) => one.sustain)!.id, targetIds: [] },
      () => 1,
    );
    assert.deepEqual(of(again.events, "refused"), [], JSON.stringify(again.events));
    assert.deepEqual(
      of(again.events, "sustained").map((one) => [one.targetId, one.condition]),
      [["sailor", "charmed"]],
    );
    assert.equal(charmed(again.state)!.rounds, 2, "started again");
  }

  // ── Refusals and the install gate ──
  refused(fiveE({ budget: "nothing_here" }), /Unknown budget "nothing_here"/);
  {
    const doc = fiveE();
    doc.catalogs
      .find((one: { id: string }) => one.id === "creatures")
      .entries[0].creature.actions.at(-1).applies[0].duration = "instant";
    refused(doc, /"sustains" starts again the rounds of what it puts on/);
  }
  const gate =
    "A ruleset with a creature's action kept up on later turns (actions[].sustains) requires schemaVersion 2 and capabilityApi 1.727 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(726) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(727) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(726) as never, JSON.parse(fiveEText)), gate);

  console.log(
    "Luring Song: a creature's action kept up with a bonus action, its rounds started again, no save; gated at 1.727.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
