/**
 * Cheap-GM playtest 2026-10-26 (dice integrity): Game Masters wrote their own `rolls=`, `total=` and
 * `result=` on checks, copying the shape of the resolved records they read back in the history.
 * - In a ruleset game a complete record stands only on a die the player or a branch check threw this
 *   turn, never on the dice tool's: the GM is told never to roll a check with it, and could throw it
 *   again until the face suits it. Elsewhere the tool's d20 still counts, as that brief asks.
 * - The history the Game Master reads settled checks back in is a plain line saying what they came
 *   to, never a record it could copy; a check still owed stays an ask.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-cheap-gm-dice-history-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const {
    buildSkillCheckRulesetContext,
    checkIssuedD20s,
    checkRecordsAsHistoryNotes,
    engineIssuedD20Faces,
    resolveSkillCheckTagsInContent,
  } = await import("../../packages/server/src/services/game/skill-check-resolution.service.js");

  const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
  const parsed = parseRulesetDefinition(JSON.parse(readFileSync(fileURLToPath(exampleUrl), "utf8")));
  assert.ok(parsed.ok);
  const fiveE: RulesetDefinition = parsed.definition;
  const build = (overrides: Partial<RulesetSheetBuild>): RulesetSheetBuild => {
    const base = { ...defaultRulesetSheetBuild(fiveE), ...overrides };
    return { ...base, fields: { ...base.fields, level: 5 } };
  };
  const cards = [
    {
      name: "Mira",
      rulesetSheet: { v: 1, build: build({ abilities: { dex: 16 }, skills: { stealth: "expertise" } }) },
    },
  ];
  const context: SkillCheckModifierContext = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(fiveE, cards, cards[0]),
  };
  const scripted = (values: number[]) => {
    let index = 0;
    return () => {
      assert.ok(index < values.length, "asked for more d20s than scripted");
      return values[index++]!;
    };
  };

  // ── The dice a record may stand on ──
  {
    const tool = [
      { notation: "1d20+9", rolls: [18] },
      { notation: "2d6", rolls: [3, 4] },
    ];
    assert.deepEqual(checkIssuedD20s(true, [7], tool), [7], "a ruleset game: the player's and the branch's only");
    assert.deepEqual(checkIssuedD20s(false, [7], tool), [7, ...engineIssuedD20Faces(tool)]);

    // The GM threw the tool until it liked an 18, then wrote the record: the Engine rolls it again.
    const tidy = `She slips past. [skill_check: skill="Stealth" dc="15" rolls="18" used="18" modifier="9" total="27" result="success" mode="normal" resolution="sum" dice="1d20"]`;
    const rolled = await resolveSkillCheckTagsInContent(tidy, {
      loadContext: async () => context,
      rollD20: scripted([4]),
      rulesetPinned: true,
      issuedD20s: checkIssuedD20s(true, [], tool),
    });
    assert.equal(rolled.resolved, 1);
    assert.match(rolled.content, /rolls="4" used="4" modifier="9" total="13" result="failure"/);
    assert.match(rolled.content, /\(Correction: Stealth check is a failure \(13 against 15\)/);
    // The player's own 18 still stands.
    const theirs = await resolveSkillCheckTagsInContent(tidy, {
      loadContext: async () => context,
      rollD20: scripted([]),
      rulesetPinned: true,
      issuedD20s: checkIssuedD20s(true, [18], []),
    });
    assert.deepEqual([theirs.content, theirs.trusted], [tidy, 1]);
  }

  // ── What the Game Master reads back ──
  {
    const saved = [
      `Mira slips past. [skill_check: skill="Stealth" dc="15" rolls="12" used="12" modifier="9" total="21" result="success" mode="normal" resolution="sum" dice="1d20" who="Mira"]`,
      `Then the door. [skill_check: skill="Athletics" dc="12"]`,
      `[skill_check: skill="Arcana" dc="10" who="Mira" reason="untrained"]`,
      `[skill_check: skill="Insight" dc="10" who="Pip" reason="unknown-roller"]`,
      `[skill_check: nonsense]`,
    ].join("\n");
    const read = checkRecordsAsHistoryNotes(saved);
    assert.equal(
      read,
      [
        `Mira slips past. (Engine roll for Mira: Stealth check (DC 15): [12] +9 = 21. Success.)`,
        `Then the door. [skill_check: skill="Athletics" dc="12"]`,
        `(Engine: Mira's Arcana check not rolled: untrained.)`,
        `(Engine: Insight check not rolled: "Pip" does not name one party member.)`,
        `[skill_check: nonsense]`,
      ].join("\n"),
    );
    assert.doesNotMatch(read, /rolls=|total=|result=/, "no record left to copy");
    assert.equal(checkRecordsAsHistoryNotes("No checks here."), "No checks here.");
    // A note is never read as a check again.
    const again = await resolveSkillCheckTagsInContent(read.split("\n")[0]!, {
      loadContext: async () => context,
      rollD20: scripted([]),
      rulesetPinned: true,
    });
    assert.equal(again.resolved + again.left, 0);
  }

  console.info("cheap-GM dice and history regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
