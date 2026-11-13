/**
 * A summed check with no dice (Capability API 1.825): Amber and Nobilis compare the sheet's own
 * number with the difficulty.
 *
 * What is pinned here:
 *   - The schema takes `dice.count: 0` and refuses every key that needs a die there.
 *   - The roll throws nothing, totals the modifier alone, and reads the bands as a summed check does.
 *   - The record writes `rolls=""` and reads back; the summary says the comparison, not an empty roll.
 *   - A packaged ruleset declares 1.825, and the Game Master is not told to throw a die.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  formatSkillCheckResultSummary,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  rollDiceSumCheck,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-zero-dice-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../../packages/server/src/services/game/gm-prompts.js"),
    import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const emberText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  /** Ember Roads with no dice at all, its fight and layers left out. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    document.resolution.dice = { count: 0, sides: 6 };
    document.resolution.advantage = false;
    edit?.(document);
    return document;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refuses = (document: unknown, pattern: RegExp, why: string) => {
    const result = parseRulesetDefinition(document);
    assert.ok(!result.ok, `${why}: should have been refused`);
    assert.ok(
      result.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(result.issues)}`,
    );
  };

  // ── The schema ──
  const nobilis = parsed(doc());
  {
    assert.equal(nobilis.resolution.kind === "dice-sum" && nobilis.resolution.dice.count, 0);
    refuses(doc((d) => (d.resolution.advantage = true)), /nothing to roll twice/, "advantage");
    refuses(
      doc((d) => (d.resolution.openEnded = { high: 6 })),
      /An open-ended roll needs a die/,
      "an open-ended roll",
    );
    refuses(doc((d) => (d.resolution.unmodified = [6])), /An unmodified face is a die's/, "unmodified faces");
    refuses(
      doc((d) => (d.resolution.dice.faces = [1, 1, 1, 1, 1, 1])),
      /has no faces/,
      "custom faces",
    );
    refuses(
      doc(
        (d) =>
          (d.resolution.duality = {
            dice: [
              { id: "hope", label: "Hope" },
              { id: "fear", label: "Fear" },
            ],
          }),
      ),
      /Two named dice need dice\.count 2/,
      "two named dice",
    );
    refuses(
      doc((d) => (d.resolution.naturals = { check: "max-only", save: "none" })),
      /Natural results need a single die/,
      "a natural policy",
    );
    refuses(
      doc((d) => (d.resolution.plotDie = { label: "Plot die", sides: 6, faces: [{ face: 1, symbol: "complication" }] })),
      /A plot die is a die thrown beside/,
      "a plot die",
    );
    refuses(
      doc((d) => (d.resolution.naturalTotal = { atLeast: 20 })),
      /A natural total needs dice/,
      "a natural total",
    );
  }

  // ── The roll ──
  {
    // The total is the sheet's number alone, and it is read against the difficulty.
    const roll = (modifier: number, dc: number) =>
      rollDiceSumCheck(nobilis, { modifier, dc, isSave: false }, () => {
        throw new Error("a check with no dice threw one");
      });
    assert.deepEqual(
      [roll(4, 3).rolls, roll(4, 3).total, roll(4, 3).success, roll(4, 3).dice],
      [[], 4, true, "0d6"],
    );
    assert.deepEqual([roll(3, 3).total, roll(3, 3).success], [3, true], "a tie meets the difficulty");
    assert.deepEqual([roll(2, 3).total, roll(2, 3).success], [2, false]);
    assert.deepEqual([roll(4, 3).rollMode, roll(4, 3).criticalSuccess], ["normal", false]);
    // A floor under the total still holds, as it does on a rolled check.
    assert.equal(rollDiceSumCheck(nobilis, { modifier: 1, dc: 3, isSave: false, totalFloor: 5 }, () => 0).total, 5);

    // Bands are read from the margin, and a band the Game Master may move stays available.
    const banded = parsed(
      doc((d) => {
        d.resolution.outcomes = {
          by: "margin",
          tiers: [
            { id: "wins", label: "Wins", atLeast: 1, success: true },
            { id: "stalemate", label: "Stalemate", atLeast: 0, success: true },
            { id: "loses", label: "Loses" },
          ],
        };
        d.resolution.tierShift = { max: 1 };
      }),
    );
    const bandRoll = (modifier: number, dc: number) => rollDiceSumCheck(banded, { modifier, dc, isSave: false }, () => 0);
    assert.deepEqual([bandRoll(4, 3).outcome, bandRoll(3, 3).outcome, bandRoll(2, 3).outcome], [
      "Wins",
      "Stalemate",
      "Loses",
    ]);

    // The record says what it compared, reads back, and the summary never shows an empty roll.
    const result = resolveSkillCheckWithContext(
      {
        skills: null,
        attributes: null,
        sheetAttributes: {},
        ruleset: buildSkillCheckRulesetContext(nobilis, [], undefined),
      } as any,
      { skill: "Warfare", dc: 3 },
      () => {
        throw new Error("a check with no dice threw one");
      },
    );
    assert.deepEqual([result.rolls, result.total, result.dice], [[], 0, "0d6"]);
    const record = serializeResolvedSkillCheckTag(result);
    assert.match(record, /rolls="" used=/);
    assert.match(record, /dice="0d6"\]$/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.ok(back, "the record is read back as a result");
    assert.deepEqual([back.rolls, back.total], [[], result.total]);
    const said = formatSkillCheckResultSummary(back!);
    assert.match(said, /Warfare 0 vs 3/);
    assert.doesNotMatch(said, /\[\]|0d/, "neither an empty roll nor a die the check never threw");

    // A ruleset with no outcomes bands reads the plain success.
    const plain = formatSkillCheckResultSummary(
      parseSkillCheckTagBody(
        serializeResolvedSkillCheckTag({ ...result, total: 6, success: true } as typeof result).slice(
          "[skill_check:".length,
          -1,
        ),
      )!.resolvedResult!,
    );
    assert.match(plain, /Succeeds|Success/, `the outcome is still said: ${plain}`);

    // The Game Master is taught to compare, never to throw.
    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: ["Wren"],
      playerName: "Wren",
      ruleset: nobilis,
    });
    assert.match(reminder, /compares the character sheet's own number with the difficulty/);
    assert.doesNotMatch(reminder, /rolls 0d6/);

    // The package gate.
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-zero-dice",
      name: "Zero dice",
      version: "0.1.0",
      description: "A packaged ruleset whose checks throw no dice.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(824) as any, doc()) ?? "", /capabilityApi 1\.825/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(825) as any, doc()), null);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
