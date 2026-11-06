/**
 * A face rolled again (Capability API 1.408): a halfling's Lucky.
 *
 *   - A natural 1 on an attack, a save or a contest check is rolled again once, the new face kept.
 *   - `rolls` narrows it; without the condition nothing is rolled again.
 *   - On a level of a derived value, read off a sheet.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-reroll-face-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 408);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.derived.push({ id: "halfling", label: "Halfling", op: "sum", of: [{ const: 1 }] });
    doc.sheet.live.conditions.push({ id: "lucky", label: "Lucky" }, { id: "save_lucky", label: "Lucky Saves" });
    doc.combat.conditions.push(
      { condition: "lucky", effects: [], rerollsFace: { face: 1 } },
      { condition: "save_lucky", effects: [], rerollsFace: { face: 1, rolls: ["saves"] } },
    );
    edit(doc);
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const block = (): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    saves: { dex_save: 0, con_save: 0, str_save: 0 },
    checks: { might: 0, agility: 0 },
    actions: [
      { id: "blade", name: "Blade", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } },
      {
        id: "dust",
        name: "Dust",
        budget: "action",
        save: { save: "dex_save", difficulty: 12, onSuccess: "negates" },
        damage: { count: 0, sides: 0, flat: 5 },
      },
    ],
  });
  const fight = (def: RulesetDefinition = definition, pip?: Record<string, unknown>): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: def,
      seed: 1,
      roller: () => 10,
      combatants: [
        pip
          ? {
              id: "pip",
              name: "Pip",
              side: "party",
              build: rulesetSheetBuildSchema.parse({
                abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
              }),
              live: {},
            }
          : { id: "pip", name: "Pip", side: "party", block: block() },
        { id: "brute", name: "Brute", side: "enemy", block: block() },
      ],
    });
    state.order = ["pip", "brute"];
    state.turn = 0;
    return state;
  };
  const hold = (state: RulesetEncounterState, ...conditions: string[]) => {
    for (const condition of conditions)
      rulesetCombatant(state, "pip")!.tracked.push({ condition, rounds: null } as never);
  };
  /** These rolls in order, then 10s. */
  const queue =
    (...rolls: number[]): RulesetCombatRoller =>
    () =>
      rolls.shift() ?? 10;
  const act = (
    state: RulesetEncounterState,
    actorId: string,
    actionId: string,
    targetId: string,
    roller: RulesetCombatRoller,
    def: RulesetDefinition = definition,
  ) => {
    const option = rulesetCombatOptions(def, state, actorId).find(
      (one) => one.id === actionId || one.id.endsWith(`:${actionId}`),
    );
    assert.ok(option, `${actorId} has ${actionId}: ${rulesetCombatOptions(def, state, actorId).map((one) => one.id)}`);
    const done = applyRulesetCombatChoice(def, state, { actorId, optionId: option.id, targetIds: [targetId] }, roller);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };

  // ── An attack: the 1 is rolled again, and the 18 hits ──
  {
    const state = fight();
    hold(state, "lucky");
    const done = act(state, "pip", "blade", "brute", queue(1, 18));
    assert.deepEqual(of(done.events, "rerolled"), [
      { type: "rerolled", actorId: "pip", label: "Lucky", face: 1, to: 18 },
    ]);
    assert.equal(of(done.events, "attack")[0]!.outcome, "hit", JSON.stringify(done.events));
    // Without it, the 1 stands.
    const plain = act(fight(), "pip", "blade", "brute", queue(1, 18));
    assert.equal(of(plain.events, "rerolled").length, 0);
    assert.equal(of(plain.events, "attack")[0]!.outcome, "miss");
    // Only on saves: the attack's 1 stands.
    const narrowed = fight();
    hold(narrowed, "save_lucky");
    assert.equal(of(act(narrowed, "pip", "blade", "brute", queue(1, 18)).events, "rerolled").length, 0);
    // Rolled again only once: a second 1 is kept.
    const twice = fight();
    hold(twice, "lucky");
    const kept = act(twice, "pip", "blade", "brute", queue(1, 1, 18));
    assert.equal(of(kept.events, "rerolled").length, 1);
    assert.equal(of(kept.events, "attack")[0]!.outcome, "miss");
  }

  // ── A save: the 1 becomes 15, and the dust misses ──
  {
    const state = fight();
    hold(state, "save_lucky");
    state.turn = 1;
    const done = act(state, "brute", "dust", "pip", queue(1, 15));
    const save = of(done.events, "save")[0]!;
    assert.equal(save.actorId, "pip");
    assert.equal(save.success, true, JSON.stringify(done.events));
    assert.equal(of(done.events, "rerolled")[0]!.to, 15);
  }

  // ── A contest check: Pip's grapple ──
  {
    const state = fight();
    hold(state, "lucky");
    const done = act(state, "pip", "grapple", "brute", queue(1, 19, 5));
    const contest = of(done.events, "contest")[0]!;
    assert.deepEqual(contest.attacker.rolls, [19], JSON.stringify(contest));
    assert.equal(contest.winner, "actor");
  }

  // ── On a level of a derived value, off Pip's sheet ──
  {
    const def = parsed(
      document((doc) => doc.combat.levels.push({ derived: "halfling", at: 1, rerollsFace: { face: 1 } })),
    );
    const done = act(fight(def, {}), "pip", "grapple", "brute", queue(1, 19, 5), def);
    assert.deepEqual(
      of(done.events, "rerolled").map((one) => [one.label, one.to]),
      [["Halfling", 19]],
      JSON.stringify(done.events),
    );
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).rerollsFace = { face: 21 };
      }),
      /never shows 21/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).rerollsFace = { face: 1, rolls: ["saves", "saves"] };
      }),
      /named once/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset that rolls a face again (a condition's or a level's rerollsFace) requires schemaVersion 2 and capabilityApi 1.408 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(407) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(408) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(407) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Reroll a face: Lucky's natural 1 rolled again once on an attack, a save and a contest check, narrowed by rolls, on a condition or a derived level; gated at 1.408.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
