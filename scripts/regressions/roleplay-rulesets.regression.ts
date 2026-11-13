/**
 * Roleplay played by a Game Mode ruleset.
 *
 * What is pinned here:
 *   - A saved Roleplay reply loses its sheet and clock commands (the sheet shows their result), and
 *     each settled check is lifted out with its place in what is left, so it shows as a dice card where
 *     it happened. A sparse check the Engine never settled simply goes.
 *   - The narrator of a ruleset chat is taught the ruleset's checks and sheet commands, with the
 *     sheets, and the rest command when the player asks for a rest by name.
 *   - Roleplay's [roll] stays for plain dice in a ruleset chat, never for a character's attempt.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import { extractRoleplayRulesetRecords } from "../../packages/client/src/lib/roleplay-ruleset-records.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-roleplay-rulesets-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext },
    { buildRulesetRoleplayReminder },
    { buildRoleplayCommandsReminder },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/generation/roleplay-commands.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const ember = parsed(JSON.parse(read("../../docs/examples/rulesets/ember-roads.json")));

  // ── The saved reply ──
  {
    const cards = [{ name: "Blake", rulesetSheet: null }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(ember, cards, cards[0]),
    };
    const skill = ember.sheet.skills[0]!.label;
    const result = resolveSkillCheckWithContext(context as any, { skill, dc: 8 });
    const record = serializeResolvedSkillCheckTag(result);
    const content = [
      `Blake reaches for the ledge.`,
      record,
      `[sheet: who="Blake" op="spend" pool="Grit" amount="1" now="2/3"]`,
      `He pulls himself up.`,
      `[skill_check: skill="${skill}" dc="8"]`,
      `[clock: name="Alarm raised" tick="1"]`,
      `The rest is quiet.`,
    ].join("\n");
    const extracted = extractRoleplayRulesetRecords(content);
    assert.doesNotMatch(extracted.text, /\[sheet:|\[clock:|\[skill_check:/, "no record is left in the prose");
    assert.match(extracted.text, /^Blake reaches for the ledge\.\n/);
    assert.match(extracted.text, /He pulls himself up\.[\s\S]*The rest is quiet\.$/);
    assert.equal(extracted.checks.length, 1, "only the settled check is shown; the sparse one goes");
    const check = extracted.checks[0]!;
    assert.equal(check.result.skill, result.skill);
    assert.equal(check.result.total, result.total, "the card shows the Engine's own total");
    assert.equal(
      extracted.text.slice(0, check.offset),
      "Blake reaches for the ledge.\n",
      "the card stands where the check was asked for",
    );
    const plain = "No tags here at all.";
    assert.deepEqual(extractRoleplayRulesetRecords(plain), { text: plain, checks: [] });
  }

  // ── The narrator ──
  {
    const sheetBlocks = [`<character_sheets>\n<sheet name="Blake">Grit 2/3</sheet>\n</character_sheets>`];
    const narrator = buildRulesetRoleplayReminder({ ruleset: ember, sheetBlocks });
    assert.match(narrator, new RegExp(`RULESET: ${ember.name}`));
    assert.match(narrator, /\[skill_check: /, "the narrator is taught the ruleset's checks");
    assert.match(narrator, /\[sheet: who="Name" op="spend"/, "and the sheet commands");
    assert.match(narrator, /Grit 2\/3/, "and sees the sheets");
    assert.doesNotMatch(narrator, /THE PLAYER ASKS TO REST/, "no rest is asked for unprompted");
    const resting = buildRulesetRoleplayReminder({ ruleset: ember, sheetBlocks, playerAsksRest: "Long rest" });
    assert.match(resting, /op="rest" rest="Long rest"/, "a rest the player names gets its command");
  }

  // ── Roleplay's own [roll] ──
  {
    const reminder = (metadata: Record<string, unknown>) =>
      buildRoleplayCommandsReminder({
        metadata: { ...metadata, roleplayCommandsEnabled: true, roleplayCommandToggles: { roll: true } },
        privateAvailable: false,
        availableAgentIds: new Set(),
        format: "xml",
        characterNames: ["Blake"],
        characterId: null,
      } as any);
    const free = reminder({});
    const ruled = reminder({ gameRuleset: { id: ember.id, version: ember.version, packageId: null, options: {} } });
    assert.match(free, /attribute="Strength"/, "outside a ruleset [roll] reads the chat's stats");
    assert.match(ruled, /\[roll: notation="2d6"/, "with one it is plain dice");
    assert.match(ruled, /never a roll/);
    assert.doesNotMatch(ruled, /attribute="Strength"/);
  }

  console.log("roleplay-rulesets regression passed");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
