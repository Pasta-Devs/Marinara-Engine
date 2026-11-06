/**
 * Saves made as days pass (Capability API 1.526).
 *
 *   - Feeblemind's "at the end of every 30 days, the creature can repeat its saving throw": a
 *     condition whose `saveEnds` says `"at": "days"` is never saved against in a fight; once the
 *     fight is over its holder's sheet keeps the save and its difficulty, and each 30 days passed
 *     they make it again, ending it on the first success.
 *   - Abilities raised for good (1.516) are kept through another change to the sheet.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  raiseRulesetLiveAbilities,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-day-saves-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 526);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (saveEnds: Record<string, unknown> = { save: "int_save", at: "days", days: 30 }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "feebleminded", label: "Feebleminded" });
    doc.combat.conditions.push({ condition: "feebleminded", effects: [] });
    doc.catalogs.push({
      id: "minds",
      label: "Minds",
      feeds: ["spells"],
      entries: [
        {
          id: "feeblemind",
          label: "Feeblemind",
          rows: [{ list: "spells", values: { name: "Feeblemind", level: 8, prepared: true } }],
          mechanics: {
            kind: "debuff",
            save: { save: "int_save", onSuccess: "negates" },
            applies: [{ condition: "feebleminded", duration: "until-save", saveEnds }],
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });

  // ── The fight over, its save goes onto the sheet ──
  let live: RulesetLiveState;
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: { conditions: ["feebleminded"] } },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    });
    const hero = rulesetCombatant(state, "hero")!;
    hero.tracked.push({
      condition: "feebleminded",
      rounds: null,
      source: "foe",
      difficulty: 17,
      saveEnds: { save: "int_save", at: "days", days: 30 },
    });
    liftRulesetFightEffects(definition, state);
    live = hero.sheet!.live as RulesetLiveState;
    assert.deepEqual(live.daySaves, { feebleminded: { save: "int_save", difficulty: 17, every: 30 } });
    assert.deepEqual(live.conditions, ["feebleminded"], "still held");
  }

  const pass = (from: RulesetLiveState, days: number, rolled: number) => {
    const result = applyRulesetSheetOp(definition, build, from, { op: "pass", days }, () => rolled);
    assert.ok(result.ok, JSON.stringify(result));
    return result;
  };
  // ── Days pass: a failure every 30, then a success ends it ──
  {
    let step = pass(live, 29, 20);
    assert.deepEqual(step.live.conditions, ["feebleminded"], "29 days, no save yet");
    assert.equal(step.live.daySaves?.feebleminded?.waited, 29);
    step = pass(step.live, 1, 5);
    assert.match(step.now, /Feebleminded: .* 5 against 17, failed/);
    assert.deepEqual(step.live.conditions, ["feebleminded"]);
    assert.equal(step.live.daySaves?.feebleminded?.waited ?? 0, 0);
    // Sixty days at once: two saves, the first made.
    step = pass(step.live, 60, 17);
    assert.match(step.now, /17 against 17, ended/);
    assert.ok(!(step.live.conditions ?? []).includes("feebleminded"), "ended");
    assert.equal(step.live.daySaves, undefined, "its save goes with it");
  }
  // ── Taken off another way, its save goes too ──
  {
    const off = applyRulesetSheetOp(definition, build, live, {
      op: "condition",
      condition: "feebleminded",
      active: false,
    });
    assert.ok(off.ok);
    assert.equal(off.live.daySaves, undefined);
  }
  // ── Abilities raised for good stay through another change (1.516) ──
  {
    const raised = raiseRulesetLiveAbilities({}, { con: { by: 2, max: 2 } });
    const after = applyRulesetSheetOp(definition, build, raised, { op: "pass", days: 1 });
    assert.ok(after.ok);
    assert.deepEqual(after.live.abilities, { con: { score: 2, max: 2 } });
  }

  // ── Refusals ──
  refused(document({ save: "int_save", at: "days" }), /"days" says how often/);
  refused(document({ save: "int_save", at: "turn-end", days: 30 }), /"days" says how often/);
  refused(
    document({ save: "int_save", at: "days", days: 30, failures: { count: 2, dismisses: true } }),
    /ends it on its successes/,
  );

  // ── The install gate ──
  {
    const gate =
      'A ruleset with a save made as days pass (saveEnds "at": "days") requires schemaVersion 2 and capabilityApi 1.526 or newer';
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(525) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(526) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(525) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Day saves: Feeblemind's save goes onto the sheet as the fight ends, is made each 30 days passed until it ends it, and goes with the condition; raised abilities kept; gated at 1.526.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
