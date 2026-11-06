/**
 * Death saves as saves, and healing at its most (Capability API 1.500).
 *
 *   - A condition's `deathSaves: "advantage"` rolls its holder's dying rolls twice: Beacon of Hope.
 *   - `dying.asSave`: what adds to every save adds to the dying roll (Bless), and what rolls every
 *     save twice rolls it twice; what is narrowed to one save does not.
 *   - A condition's `healedMax`: healing its holder gets is the most its dice come to.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-beacon-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 500);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "beacon", label: "Beacon of Hope" },
      { id: "blessed", label: "Blessed" },
      { id: "warded", label: "Warded" },
      { id: "cursed", label: "Cursed" },
    );
    doc.combat.conditions.push(
      {
        condition: "beacon",
        effects: ["own-saves-advantage"],
        saves: ["wis_save"],
        deathSaves: "advantage",
        healedMax: true,
      },
      { condition: "blessed", effects: [], modifiers: [{ to: "saves", flat: 3 }] },
      { condition: "warded", effects: [], modifiers: [{ to: "saves", flat: 5, saves: ["wis_save"] }] },
      { condition: "cursed", effects: ["own-saves-disadvantage"] },
    );
    edit(doc);
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
  const plain = parsed(fiveE());
  const asSave = parsed(fiveE((doc) => (doc.combat.dying.asSave = true)));
  const healer: RulesetStatBlock = {
    health: 30,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "mend", name: "Mend", budget: "action", targets: "ally", heal: { count: 1, sides: 8, flat: 3 } }],
  } as unknown as RulesetStatBlock;
  const ogre: RulesetStatBlock = { health: 30, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  const fight = (definition: RulesetDefinition, held: string[], hp = 0): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "c", name: "Cleric", side: "party", block: healer },
        {
          id: "f",
          name: "Fighter",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 16, speed: 30, hp_max: 44 },
          }),
          live: { pools: { hp: { value: hp } } },
        },
        { id: "e", name: "Ogre", side: "enemy", block: ogre },
      ],
    });
    state.order = ["c", "f", "e"];
    state.turn = 0;
    for (const condition of held) rulesetCombatant(state, "f")!.tracked.push({ condition, rounds: null });
    return state;
  };
  const deathRoll = (definition: RulesetDefinition, held: string[], faces: number[]) => {
    let at = 0;
    const step = advanceRulesetTurn(definition, fight(definition, held), () => faces[at++ % faces.length]!);
    const dying = step.events.filter(
      (one): one is Extract<RulesetCombatEvent, { type: "dying" }> => one.type === "dying",
    );
    assert.equal(dying.length, 1, JSON.stringify(step.events));
    return dying[0]!;
  };

  // ── Beacon of Hope: twice, the higher kept, with or without asSave ──
  {
    const rolled = deathRoll(plain, ["beacon"], [5, 15]);
    assert.equal(rolled.mode, "advantage");
    assert.deepEqual(rolled.rolls, [5, 15]);
    assert.equal(rolled.kept, 15);
    assert.equal(rolled.result, "success");
    assert.equal(deathRoll(asSave, ["beacon"], [5, 15]).result, "success");
    // A 20 on either die is the one kept, and revives.
    assert.equal(deathRoll(plain, ["beacon"], [3, 20]).result, "revived");
    // Without it, once.
    assert.equal(deathRoll(plain, [], [5, 15]).result, "failure");
  }

  // ── As a save: Bless adds to it, a ward to Wisdom saves does not, and a curse rolls it twice ──
  {
    const blessed = deathRoll(asSave, ["blessed"], [7]);
    assert.equal(blessed.total, 10, JSON.stringify(blessed));
    assert.equal(blessed.bonuses?.[0]?.condition, "blessed");
    assert.equal(blessed.result, "success");
    assert.equal(deathRoll(plain, ["blessed"], [7]).result, "failure", "not a save without asSave");
    assert.equal(deathRoll(asSave, ["warded"], [7]).result, "failure", "narrowed to Wisdom");
    const cursed = deathRoll(asSave, ["cursed"], [15, 5]);
    assert.equal(cursed.mode, "disadvantage");
    assert.equal(cursed.kept, 5);
    assert.equal(deathRoll(plain, ["cursed"], [15, 5]).mode, undefined, "not a save without asSave");
    // Beacon's own-saves-advantage is narrowed to Wisdom: only its deathSaves counts, and a curse
    // on top of it cancels it out.
    assert.equal(deathRoll(asSave, ["beacon", "cursed"], [15, 5]).mode, undefined);
  }

  // ── Healing at its most ──
  {
    const heal = (held: string[]) => {
      const state = fight(plain, held, 10);
      const step = applyRulesetCombatChoice(
        plain,
        state,
        { actorId: "c", optionId: "mend", targetIds: ["f"] },
        () => 1,
      );
      return rulesetCombatHealth(plain, plain.combat!, rulesetCombatant(step.state, "f")!).value - 10;
    };
    assert.equal(heal([]), 4, "a 1 and 3");
    assert.equal(heal(["beacon"]), 11, "8 and 3");
  }

  // ── Refusals ──
  refused(
    fiveE(
      (doc) =>
        (doc.combat.conditions.find((one: { condition: string }) => one.condition === "beacon").deathSaves = "twice"),
    ),
    /deathSaves/,
  );
  refused(
    fiveE(
      (doc) =>
        (doc.combat.conditions.find((one: { condition: string }) => one.condition === "beacon").healedMax = false),
    ),
    /healedMax/,
  );
  refused(
    fiveE((doc) => (doc.combat.dying.asSave = false)),
    /asSave/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose dying rolls are saves, or whose conditions change them or healing (dying asSave, deathSaves, healedMax), requires schemaVersion 2 and capabilityApi 1.500 or newer";
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
    const doc = (edit: (one: Record<string, any>) => void) => {
      const one = JSON.parse(fiveEText) as Record<string, any>;
      edit(one);
      return one;
    };
    const save = doc((one) => (one.combat.dying.asSave = true));
    assert.equal(getCapabilityPackageInstallIssue(manifest(499) as never, save), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(500) as never, save), gate);
    const lean = doc((one) => (one.combat.conditions[0].deathSaves = "advantage"));
    assert.equal(getCapabilityPackageInstallIssue(manifest(499) as never, lean), gate);
    const most = doc((one) => (one.combat.conditions[0].healedMax = true));
    assert.equal(getCapabilityPackageInstallIssue(manifest(499) as never, most), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(499) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Beacon: dying rolls with advantage, as saves they take Bless and curses but not what is narrowed to one save, healing at its most; gated at 1.500.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
