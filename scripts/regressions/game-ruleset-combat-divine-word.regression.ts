/**
 * What lands by the health its target has left (Capability API 1.450).
 *
 *   - Divine Word: on a failed save, deafened at 50 or fewer, blinded too at 40, stunned too at 30,
 *     and killed outright at 20; one with more than 50 left takes nothing. A fiend that fails is
 *     also sent out of the fight; a humanoid is not.
 *   - A save made: nothing.
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
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-divine-word-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 450);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const planar = { types: ["celestial", "elemental", "fey", "fiend"] };
  const divineWord = (more: Record<string, unknown> = {}) => ({
    id: "divine-word",
    label: "Divine Word",
    rows: [{ list: "spells", values: { name: "Divine Word", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      targetCount: 4,
      range: 30,
      budget: "bonus",
      save: { save: "cha_save", onSuccess: "negates" },
      applies: [
        { condition: "deafened", duration: { rounds: 10 }, targetHealthAtMost: 50 },
        { condition: "blinded", duration: { rounds: 100 }, targetHealthAtMost: 40 },
        { condition: "stunned", duration: { rounds: 600 }, targetHealthAtMost: 30 },
      ],
      killsAtMost: 20,
      dismisses: true,
      dismissesIs: planar,
      ...more,
    },
  });
  const fiveE = (more: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [divineWord(more)] });
    doc.combat.creatureTypes = {
      types: ["humanoid", "celestial", "elemental", "fey", "fiend"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    for (const id of ["deafened", "blinded", "stunned"]) {
      if (!doc.sheet.live.conditions.some((one: { id: string }) => one.id === id)) {
        doc.sheet.live.conditions.push({ id, label: id });
      }
      if (!doc.combat.conditions.some((one: { condition: string }) => one.condition === id)) {
        doc.combat.conditions.push({ condition: id, effects: [] });
      }
    }
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
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = (health: number, type = "humanoid"): RulesetStatBlock =>
    ({ health, defense: 5, initiativeModifier: 0, speed: 30, actions: [], type }) as unknown as RulesetStatBlock;
  const fight = (d20: number): { state: RulesetEncounterState; roll: (sides: number) => number } => {
    const roll = (sides: number) => (sides === 20 ? d20 : 3);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 20, cha: 10 },
            fields: { level: 13, ac: 16, speed: 30, hp_max: 90, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: block(60) },
        { id: "knight", name: "Knight", side: "enemy", block: block(45) },
        { id: "thug", name: "Thug", side: "enemy", block: block(35) },
        { id: "imp", name: "Imp", side: "enemy", block: block(25, "fiend") },
        { id: "rat", name: "Rat", side: "enemy", block: block(10) },
      ],
    });
    state.order = ["cleric", "ogre", "knight", "thug", "imp", "rat"];
    state.turn = 0;
    return { state, roll };
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const speak = (d20: number, targetIds: string[]) => {
    const { state, roll } = fight(d20);
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === "Divine Word");
    assert.ok(option, "offered");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: option.id, targetIds },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string) =>
    who(state, id)
      .tracked.map((one) => one.condition)
      .filter((one) => ["deafened", "blinded", "stunned"].includes(one))
      .sort();

  // ── Divine Word, every save failed ──
  {
    const step = speak(1, ["ogre", "knight", "thug", "imp"]);
    assert.deepEqual(holds(step.state, "ogre"), [], "over 50: nothing");
    assert.deepEqual(holds(step.state, "knight"), ["deafened"], "45: deafened");
    assert.deepEqual(holds(step.state, "thug"), ["blinded", "deafened"], "35: blinded too");
    assert.ok(who(step.state, "imp").dismissed || who(step.state, "imp").defeated, "the fiend is gone");
    assert.deepEqual(
      of(step.events, "dismissed").map((one) => one.targetId),
      ["imp"],
      "sent away, a fiend",
    );
    assert.deepEqual(holds(step.state, "imp"), ["blinded", "deafened", "stunned"], "25: all three, then away");
    const low = speak(1, ["rat", "thug"]);
    assert.ok(who(low.state, "rat").defeated && !who(low.state, "rat").dismissed, "10: killed outright");
    assert.deepEqual(holds(low.state, "rat"), [], "and nothing else");
    assert.ok(!who(low.state, "thug").dismissed, "a humanoid is not sent away");
  }

  // ── Saved: nothing ──
  {
    const step = speak(20, ["knight", "rat"]);
    assert.deepEqual(holds(step.state, "knight"), []);
    assert.ok(!who(step.state, "rat").defeated);
  }

  // ── Refusals ──
  refused(fiveE({ dismisses: undefined }), /"dismissesIs" narrows/);
  refused(fiveE({ save: undefined }), /"killsAtMost" kills whoever fails its save/);
  refused(fiveE({ dismissesIs: { types: ["dragon"] } }), /dragon/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries act by the health their target has left (targetHealthAtMost, killsAtMost) or send away only some (dismissesIs) requires schemaVersion 2 and capabilityApi 1.450 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(449) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(450) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(449) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Divine Word: deafened, blinded and stunned by the health left, killed at 20 or fewer, fiends sent away; gated at 1.450.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
