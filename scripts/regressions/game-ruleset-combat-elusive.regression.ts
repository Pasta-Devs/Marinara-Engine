/**
 * Held off while, saves against what is seen, and no advantage against (Capability API 1.417).
 *
 *   - Elusive: no attack roll against its holder has advantage, a disadvantage still counts, and not
 *     while they cannot act.
 *   - Danger Sense: advantage on Dexterity saves against what its holder can see, held off while
 *     blinded, deafened or incapacitated; a hidden source's save is rolled once.
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
  rulesetAttackMode,
  rulesetCombatant,
  rulesetSaveMode,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-elusive-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 417);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.derived.push({ id: "class_level", label: "Class level", op: "sum", of: [{ field: "level" }] });
    doc.combat.levels = [
      ...(doc.combat.levels ?? []),
      { derived: "class_level", at: 18, effects: ["attacks-against-no-advantage"] },
      {
        derived: "class_level",
        at: 2,
        effects: ["own-saves-advantage"],
        saves: ["dex_save"],
        whenSeen: true,
        notWhile: ["blinded", "deafened", "cannot-act"],
      },
    ];
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
  const definition = parsed(document());
  const combat = definition.combat!;
  const block = (): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      { id: "stab", name: "Stab", budget: "action", toHit: 5, damage: { count: 1, sides: 4, flat: 0 } },
      {
        id: "sweep",
        name: "Sweep",
        budget: "action",
        damage: { count: 1, sides: 4, flat: 0 },
        save: { save: "dex_save", difficulty: 12, onSuccess: "half" },
      },
    ],
  });
  let queue: number[] = [];
  const roller = (sides: number) => (sides === 20 ? (queue.shift() ?? 10) : 1);
  const fight = (level: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "foe", name: "Foe", side: "enemy", block: block() },
        {
          id: "rogue",
          name: "Rogue",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
            fields: { level, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
        },
      ],
    });
    state.order = ["foe", "rogue"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const put = (state: RulesetEncounterState, id: string, condition: string) =>
    who(state, id).tracked.push({ condition, rounds: null } as never);
  const mode = (state: RulesetEncounterState) =>
    rulesetAttackMode(definition, combat, who(state, "foe"), who(state, "rogue"), {
      state,
      optionId: "stab",
    });

  // ── Elusive ──
  {
    const seventeen = fight(17);
    put(seventeen, "rogue", "blinded");
    assert.equal(mode(seventeen), "advantage", "below 18th level, blinded is advantage");
    const eighteen = fight(18);
    put(eighteen, "rogue", "blinded");
    assert.equal(mode(eighteen), "normal", "Elusive takes the advantage away");
    put(eighteen, "foe", "poisoned");
    assert.equal(mode(eighteen), "disadvantage", "a disadvantage still counts");
    const stunned = fight(18);
    put(stunned, "rogue", "stunned");
    assert.equal(mode(stunned), "advantage", "not while they cannot act");
  }

  // ── Danger Sense ──
  {
    const state = fight(2);
    const saveMode = (seen: boolean, save = "dex_save") =>
      rulesetSaveMode(definition, combat, who(state, "rogue"), save, state, undefined, undefined, seen);
    assert.equal(saveMode(true), "advantage");
    assert.equal(saveMode(false), "normal", "only against what is seen");
    assert.equal(saveMode(true, "con_save"), "normal", "Dexterity saves only");
    for (const condition of ["deafened", "incapacitated", "blinded"]) {
      const held = fight(2);
      put(held, "rogue", condition);
      assert.equal(
        rulesetSaveMode(definition, combat, who(held, "rogue"), "dex_save", held),
        "normal",
        `held off while ${condition}`,
      );
    }
    const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
      events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
    const sweep = (target: RulesetEncounterState) => {
      queue = [18, 4];
      const step = applyRulesetCombatChoice(
        definition,
        target,
        { actorId: "foe", optionId: "sweep", targetIds: ["rogue"] },
        roller,
      );
      assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
      return of(step.events, "save")[0]!;
    };
    const seen = sweep(fight(2));
    assert.deepEqual([seen.mode, seen.rolls], ["advantage", [18, 4]], JSON.stringify(seen));
    const hidden = fight(2);
    who(hidden, "foe").hiding = { from: ["rogue"] } as never;
    const unseen = sweep(hidden);
    assert.deepEqual([unseen.mode ?? "normal", unseen.rolls], ["normal", [18]], JSON.stringify(unseen));
  }

  // ── Refusals ──
  {
    const withLevel = (level: Record<string, unknown>) =>
      document((doc) => {
        doc.combat.levels.push({ derived: "class_level", at: 5, ...level });
      });
    refused(withLevel({ effects: ["cannot-react"], notWhile: ["nothing_here"] }), /Unknown condition "nothing_here"/);
    refused(withLevel({ effects: ["cannot-react"], whenSeen: true }), /"whenSeen" scopes save effects/);
    parsed(withLevel({ effects: ["cannot-react"], notWhile: ["cannot-act", "prone"] }));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions or levels are held off by others (notWhile), make saves only against what is seen (whenSeen), or keep advantage off attacks against them (attacks-against-no-advantage) requires schemaVersion 2 and capabilityApi 1.417 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(416) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(417) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(416) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Elusive and Danger Sense: no advantage against while able to act; Dexterity saves with advantage against what is seen, held off while blinded, deafened or incapacitated; gated at 1.417.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
