/**
 * Durations and concentration set by the cost paid (Capability API 1.470).
 *
 *   - Bestow Curse, as a 1st-level entry here: ten rounds and concentration on a 1st-level slot, a
 *     hundred and concentration on a 2nd, 4800 and no concentration on a 3rd.
 *   - Conditions picked by the steps paid (1.517): Magic Weapon's +1, +2 and +3 as three conditions.
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
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-duration-by-steps-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 470);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const curse = (duration: Record<string, unknown>, more: Record<string, unknown>) => ({
    id: "bestow-curse",
    label: "Bestow Curse",
    rows: [{ list: "spells", values: { name: "Bestow Curse", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      range: 5,
      autoHit: true,
      budget: "action",
      concentration: true,
      concentrationBelowStep: 2,
      cost: [{ pool: "slots_1", amount: 1 }],
      applies: [{ condition: "cursed", duration }],
      ...more,
    },
  });
  const fiveE = (
    duration: Record<string, unknown> = { rounds: 10, bySteps: [100, 4800] },
    more: Record<string, unknown> = {},
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "cursed", label: "Cursed" },
      { id: "keen_1", label: "Keen +1" },
      { id: "keen_2", label: "Keen +2" },
      { id: "keen_3", label: "Keen +3" },
    );
    doc.combat.conditions.push(
      { condition: "cursed", effects: [] },
      { condition: "keen_1", effects: [] },
      { condition: "keen_2", effects: [] },
      { condition: "keen_3", effects: [] },
    );
    doc.catalogs.push({ id: "ranger", label: "Ranger", feeds: ["spells"], entries: [curse(duration, more)] });
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
  const lasts = (definition: RulesetDefinition, payWith: string | undefined) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "ranger")!.entries! as RulesetCatalogEntry[];
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
            fields: {
              level: 9,
              ac: 15,
              speed: 30,
              hp_max: 70,
              spellcasting_ability: "wis",
              slots_max_1: 4,
              slots_max_2: 3,
              slots_max_3: 2,
            },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("ranger", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { ranger: entries },
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: { health: 11, defense: 13, initiativeModifier: 0, speed: 40, actions: [] } as never,
        },
      ],
    });
    state.order = ["ranger", "wolf"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "ranger").find((one) => one.label === "Bestow Curse");
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "ranger")
        .map((one) => one.label)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ranger", optionId: option.id, targetIds: ["wolf"], ...(payWith ? { payWith } : {}) },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    lastWolf = rulesetCombatant(step.state, "wolf")!.tracked.map((one) => one.condition);
    return [
      rulesetCombatant(step.state, "wolf")!.tracked.find((one) => one.condition === "cursed")?.rounds,
      rulesetCombatant(step.state, "ranger")!.concentrating?.label ?? null,
    ];
  };
  let lastWolf: string[] = [];

  // ── Bestow Curse ──
  {
    const definition = parsed(fiveE());
    assert.deepEqual(lasts(definition, undefined), [10, "Bestow Curse"], "the lowest slot: a minute, held");
    assert.deepEqual(lasts(definition, "slots_2"), [100, "Bestow Curse"], "one higher: ten, held");
    assert.deepEqual(lasts(definition, "slots_3"), [4800, null], "two higher: eight hours, unheld");
    const always = parsed(fiveE({ rounds: 10, bySteps: [100] }, { concentrationBelowStep: undefined }));
    assert.deepEqual(lasts(always, "slots_3"), [100, "Bestow Curse"], "the last step holds beyond");
    // Until dispelled (1.482): no clock at all from that step up.
    const forever = parsed(fiveE({ rounds: 10, bySteps: [100, "until-dispelled"] }));
    assert.deepEqual(lasts(forever, "slots_2"), [100, "Bestow Curse"]);
    assert.deepEqual(lasts(forever, "slots_3"), [null, null], "two higher: until dispelled, unheld");
    // A day of rounds (1.482): Aid's eight hours, as written.
    const aid = parsed(fiveE({ rounds: 4800 }, { concentrationBelowStep: undefined, concentration: undefined }));
    assert.deepEqual(lasts(aid, undefined), [4800, null]);
    // Until dispelled, said plainly (1.485): Continual Flame, no clock at all.
    const flame = parsed(
      fiveE("until-dispelled" as never, { concentrationBelowStep: undefined, concentration: undefined }),
    );
    assert.deepEqual(lasts(flame, undefined), [null, null]);
  }

  // ── Conditions picked by the steps paid (1.517) ──
  {
    const keen = [
      { condition: "cursed", duration: { rounds: 10 } },
      { condition: "keen_1", duration: { rounds: 10 }, paidSteps: { atMost: 0 } },
      { condition: "keen_2", duration: { rounds: 10 }, paidSteps: { atLeast: 1, atMost: 1 } },
      { condition: "keen_3", duration: { rounds: 10 }, paidSteps: { atLeast: 2 } },
    ];
    const definition = parsed(fiveE(undefined, { applies: keen, concentrationBelowStep: undefined }));
    const keenOf = () => lastWolf.filter((id) => id.startsWith("keen")).join(",");
    lasts(definition, undefined);
    assert.equal(keenOf(), "keen_1", "the lowest slot");
    assert.ok(lastWolf.includes("cursed"), "one with no paidSteps always");
    lasts(definition, "slots_2");
    assert.equal(keenOf(), "keen_2", "one higher");
    lasts(definition, "slots_3");
    assert.equal(keenOf(), "keen_3", "two higher");
    refused(
      fiveE(undefined, { applies: [{ condition: "keen_1", duration: { rounds: 10 }, paidSteps: {} }] }),
      /paidSteps says atLeast, atMost or both/,
    );
    refused(
      fiveE(undefined, {
        applies: [{ condition: "keen_1", duration: { rounds: 10 }, paidSteps: { atLeast: 3, atMost: 1 } }],
      }),
      /atLeast is no more than atMost/,
    );
    const gate =
      "A ruleset whose entries put conditions on by the steps paid for them (an applies entry's paidSteps) requires schemaVersion 2 and capabilityApi 1.517 or newer";
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
    const doc = fiveE(undefined, { applies: keen, concentrationBelowStep: undefined });
    assert.equal(getCapabilityPackageInstallIssue(manifest(516) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(517) as never, doc), gate);
  }

  // ── Refusals ──
  refused(fiveE({ rounds: 10, perStep: 10, bySteps: [100] }), /"perStep" and "bySteps"/);
  refused(fiveE({ rounds: 14401 }), /duration/);
  refused(fiveE({ rounds: 10, bySteps: ["forever"] }), /duration/);
  refused(fiveE(undefined, { concentration: undefined }), /"concentrationBelowStep" says when its concentration stops/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose durations are set by the cost paid, or whose concentration holds only below a step (bySteps, concentrationBelowStep), requires schemaVersion 2 and capabilityApi 1.470 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(469) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(469) as never, fiveE({ rounds: 10 })),
      gate,
      "concentrationBelowStep alone",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(470) as never, fiveE()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(469) as never,
        fiveE({ rounds: 10 }, { concentrationBelowStep: undefined }),
      ),
      gate,
    );
    // Past 1000 rounds, or until dispelled (1.482).
    const later =
      "A ruleset whose durations run past 1000 rounds, or end only when dispelled once paid high enough (bySteps until-dispelled), requires schemaVersion 2 and capabilityApi 1.482 or newer";
    for (const duration of [{ rounds: 4800 }, { rounds: 10, bySteps: [100, "until-dispelled"] }]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(481) as never, fiveE(duration)), later);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(482) as never, fiveE(duration)), later);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(481) as never, fiveE({ rounds: 1000 })), later);
    const plain =
      'A ruleset whose durations are "until-dispelled" requires schemaVersion 2 and capabilityApi 1.485 or newer';
    const flameDoc = fiveE("until-dispelled" as never, { concentrationBelowStep: undefined });
    assert.equal(getCapabilityPackageInstallIssue(manifest(484) as never, flameDoc), plain);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(485) as never, flameDoc), plain);
  }

  console.log(
    "Duration by steps: Bestow Curse lasts a minute, ten, then eight hours by the slot spent, held by concentration only below its step, and conditions are picked by the steps paid; gated at 1.470 and 1.517.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
