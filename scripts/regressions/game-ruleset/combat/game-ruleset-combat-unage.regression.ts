/**
 * Save difficulty moved by a condition (Capability API 1.328): the Miller of Hours' Un-age.
 *
 *   - `{ to: "save-difficulty", flat: -2 }` on a condition: every save its holder calls for while they
 *     hold it is 2 easier, its own and the save that ends what it put on; nothing else of theirs moves.
 *   - Off again once the condition is gone; the actions are as written after every step.
 *   - Refused with dice; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  rulesetOpenLairWindow,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetSaveDifficultyShift,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-unage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 328);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const miller = {
    id: "miller",
    label: "The Miller",
    creature: {
      health: 66,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_5",
      actions: [
        {
          id: "chill",
          name: "Hour Chill",
          budget: "action",
          range: 60,
          save: { save: "con_save", difficulty: 15, onSuccess: "negates" },
          applies: [
            {
              condition: "restrained",
              duration: { rounds: 10 },
              saveEnds: { save: "con_save", at: "turn-end" },
            },
          ],
        },
        // Taken in its lair, inside a choice of its own (1.315).
        {
          id: "frost",
          name: "Mill Frost",
          budget: "action",
          lair: true,
          range: 60,
          save: { save: "con_save", difficulty: 15, onSuccess: "negates" },
          damage: { dice: "1d4" },
        },
      ],
    },
  };
  const withMiller = (modifier: Record<string, unknown> = { to: "save-difficulty", flat: -2 }) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(miller);
    doc.sheet.live.conditions.push({ id: "unaged", label: "Un-aged" });
    doc.combat.conditions.push({ condition: "unaged", modifiers: [modifier] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(withMiller());
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  // Every d20 a 1: every save fails, and its difficulty is read off the log.
  const roll = (sides: number) => (sides === 20 ? 1 : Math.min(sides, 3));
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {} },
        { id: "miller", name: "The Miller", side: "enemy", creature: { catalogId: "creatures", entryId: "miller" } },
      ],
      board: {
        grid: { width: 12, height: 8, tiles: Array.from({ length: 8 }, () => Array(12).fill("plains")) },
        placements: { ada: { x: 2, y: 4 }, miller: { x: 8, y: 4 } },
      },
    });
    state.order = ["miller", "ada"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const chill = (state: RulesetEncounterState) => {
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "miller", optionId: "chill", targetIds: ["ada"] },
      roll,
    );
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const written = (state: RulesetEncounterState) => {
    const action = who(state, "miller").actions.find((one) => one.id === "chill")!;
    return [action.save?.difficulty, action.applies?.[0]?.saveEnds?.difficulty];
  };

  // ── As written ──
  {
    const state = fight();
    assert.equal(rulesetSaveDifficultyShift(definition, who(state, "miller")), 0);
    const plain = chill(state);
    assert.deepEqual(
      of(plain.events, "save").map((one) => one.difficulty),
      [15],
    );
    assert.equal(who(plain.state, "ada").tracked.find((one) => one.condition === "restrained")?.difficulty, 15);
  }

  // ── Un-aged: 2 easier, its own save and the one that ends what it put on ──
  {
    const state = fight();
    who(state, "miller").tracked.push({ condition: "unaged", rounds: 3 });
    assert.equal(rulesetSaveDifficultyShift(definition, who(state, "miller")), -2);
    const easier = chill(state);
    assert.deepEqual(
      of(easier.events, "save").map((one) => one.difficulty),
      [13],
    );
    assert.equal(who(easier.state, "ada").tracked.find((one) => one.condition === "restrained")?.difficulty, 13);
    // The action is as written after the step, and once the condition is gone it is as hard again.
    assert.deepEqual(written(easier.state), [15, undefined]);
    assert.deepEqual(written(state), [15, undefined], "the fight handed in is untouched");
    const again = fight();
    const restored = chill(again);
    assert.deepEqual(
      of(restored.events, "save").map((one) => one.difficulty),
      [15],
    );
  }

  // ── A lair action, a choice within a choice: moved once, not twice ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build, live: {} },
        { id: "miller", name: "The Miller", side: "enemy", creature: { catalogId: "creatures", entryId: "miller" } },
      ],
      inLair: ["miller"],
    });
    for (const one of state.combatants) one.initiative = one.id === "miller" ? 10 : 5;
    state.order = ["miller", "ada"];
    state.turn = 0;
    who(state, "miller").tracked.push({ condition: "unaged", rounds: 3 });
    const open = rulesetOpenLairWindow(definition, state);
    assert.ok(open.window, "its lair's count comes before everybody");
    const taken = applyRulesetCombatChoice(
      definition,
      open,
      { actorId: "miller", optionId: "lair>frost", targetIds: ["ada"], window: open.window!.id },
      roll,
    );
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    assert.deepEqual(
      of(taken.events, "save").map((one) => one.difficulty),
      [13],
    );
    const frost = who(taken.state, "miller").actions.find((one) => one.id === "frost")!;
    assert.equal(frost.save?.difficulty, 15, "as written after the step");
  }

  // ── Refused, and the gate ──
  {
    const bad = parseRulesetDefinition(withMiller({ to: "save-difficulty", dice: "1d4" }));
    assert.equal(bad.ok, false);
    if (!bad.ok)
      assert.ok(
        bad.issues.some((issue) => /"save-difficulty" moves the difficulty/.test(issue)),
        bad.issues.join("; "),
      );
    const gate =
      "A ruleset with a condition that moves the difficulty of the saves its holder calls for requires schemaVersion 2 and capabilityApi 1.328 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(327) as never, withMiller()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(328) as never, withMiller()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(327) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Un-age: a condition moves the difficulty of the saves its holder calls for, its own and the one that ends what it put on, for as long as it is held.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
