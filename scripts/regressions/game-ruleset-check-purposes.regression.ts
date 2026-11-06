/**
 * Changes to checks made only for some purposes (Capability API 1.752): 5e's Gloves of Swimming and
 * Climbing, "a +5 bonus to Strength (Athletics) checks made to climb or swim".
 *
 *   - A `checks` modifier with `for: ["climb", "swim"]` adds only to a check the Game Master's tag
 *     marks `for="climb"` or `for="swim"`: not to the same skill rolled for anything else, nor to a
 *     fight's grapple or shove, which are made for no such purpose.
 *   - The record keeps `for=`, and the Game Master is told the purposes the ruleset has.
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
  parseSkillCheckTagBody,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetLiveStates,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-check-purposes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [
  { buildSkillCheckRulesetContext, resolveSkillCheckTagsInContent },
  { buildGmFormatReminder },
  { getCapabilityPackageInstallIssue },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/gm-prompts.js"),
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
]);

try {
  assert.ok(supportedCapabilityApi.minor >= 752);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const gloves = { to: "checks", skills: ["athletics"], flat: 5, for: ["climb", "swim"] };
  const document = (modifier: Record<string, unknown> = gloves) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "gloved", label: "Gloves of Swimming and Climbing" });
    doc.combat.conditions.push({ condition: "gloved", effects: [], modifiers: [modifier] });
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
    abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skills: { athletics: "none" },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 12 },
  });
  const live: RulesetLiveStates = { mira: { conditions: ["gloved"] } };

  // ── Outside a fight, through the resolver a turn uses ──
  {
    const party = [{ name: "Mira", rulesetSheet: { v: 1, build } }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(definition, party, party[0], live),
    };
    const roll = async (tag: string) => {
      const rolled = await resolveSkillCheckTagsInContent(tag, {
        loadContext: async () => context,
        rulesetPinned: true,
      });
      assert.equal(rolled.resolved, 1, rolled.content);
      return { result: rolled.results![0]!, content: rolled.content };
    };
    // Strength +2, untrained.
    const climb = await roll(`[skill_check: skill="Athletics" dc="15" for="climb" rolls="10"]`);
    assert.equal(climb.result.total, 17, "climbing: +5");
    assert.match(climb.content, /for="climb"/, "the record says what it was for");
    const swim = await roll(`[skill_check: skill="Athletics" dc="15" for="Swim" rolls="10"]`);
    assert.equal(swim.result.total, 17, "swimming, whatever its case");
    assert.equal((await roll(`[skill_check: skill="Athletics" dc="15" rolls="10"]`)).result.total, 12, "for nothing");
    assert.equal(
      (await roll(`[skill_check: skill="Athletics" dc="15" for="jump" rolls="10"]`)).result.total,
      12,
      "for another purpose",
    );
    assert.equal(
      (await roll(`[skill_check: skill="Acrobatics" dc="15" for="climb" rolls="10"]`)).result.total,
      10,
      "another skill, climbing",
    );
    // A reloaded record reads the same purpose.
    assert.equal(parseSkillCheckTagBody(`skill="Athletics" dc="15" for="climb"`)?.purpose, "climb");
  }

  // ── In a fight: a shove is made for no purpose, so the gloves add nothing ──
  {
    const shove = (doc: RulesetDefinition) => {
      const state = createRulesetEncounter({
        definition: doc,
        seed: 1,
        roller: () => 10,
        combatants: [
          { id: "mira", name: "Mira", side: "party", build, live: { conditions: ["gloved"] } },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 40, defense: 12, initiativeModifier: 0, speed: 30, actions: [] } as RulesetStatBlock,
          },
        ],
      });
      state.order = ["mira", "foe"];
      state.turn = 0;
      const option = rulesetCombatOptions(doc, state, "mira").find((one) => one.label === "Shove away");
      assert.ok(option, "Mira can shove");
      const step = applyRulesetCombatChoice(
        doc,
        state,
        { actorId: "mira", optionId: option.id, targetIds: ["foe"] },
        () => 10,
      );
      const contest = step.events.find(
        (one): one is Extract<RulesetCombatEvent, { type: "contest" }> => one.type === "contest",
      );
      assert.ok(contest, JSON.stringify(step.events));
      return contest.attacker.total;
    };
    const { for: _for, ...anyAthletics } = gloves;
    assert.equal(shove(parsed(document(anyAthletics))) - shove(definition), 5, "without for, it would add");
  }

  // ── What the Game Master is told ──
  {
    const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
    assert.match(
      buildGmFormatReminder({ ...base, ruleset: definition }),
      /When a check is made for one of these, add for="\.\.\." to it: "climb", "swim"\./,
    );
    assert.doesNotMatch(
      buildGmFormatReminder({ ...base, ruleset: parsed(JSON.parse(fiveEText)) }),
      /add for="\.\.\."/,
      "said only where a ruleset has purposes",
    );
  }

  // ── Refusals ──
  refused(document({ to: "saves", flat: 5, for: ["climb"] }), /"for" narrows checks to their purpose/);
  refused(document({ ...gloves, for: [] }), /for/);

  // ── The install gate ──
  {
    const gate =
      'A ruleset with a change to checks made only for some purposes (a modifier\'s "for") requires schemaVersion 2 and capabilityApi 1.752 or newer';
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(751) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(752) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(751) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Check purposes: Gloves of Swimming and Climbing add +5 to Athletics only for a check marked for climb or swim, never for anything else or a fight's shove; the record keeps for=, the Game Master is told the purposes; gated at 1.752.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
