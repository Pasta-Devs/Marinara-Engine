/**
 * A natural total that is a critical, and a band the Game Master moves (Capability API 1.822): Draw
 * Steel's 2d10 power roll, a natural 19 or 20, and the tier a double edge or double bane shifts.
 *
 * What is pinned here:
 *   - The schema takes `naturalTotal` and `tierShift`, and refuses a total the dice cannot show, an
 *     `atMost` at or above `atLeast`, and a shift with no bands to shift.
 *   - A natural total at or above `atLeast` (before the modifier) is a critical success in the best
 *     band; at or below `atMost` a critical failure in the worst.
 *   - `shift=` moves the band, held to `tierShift.max` and the ends of the bands.
 *   - Through the resolver, the record and the Game Master; a packaged ruleset declares 1.822.
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
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-natural-total-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext, resolveSkillCheckTagsInContent },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const emberText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  /** Ember Roads thrown as a Draw Steel power roll, its fight and layers left out. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    document.resolution.dice = { count: 2, sides: 10 };
    document.resolution.outcomes = {
      by: "total",
      tiers: [
        { id: "tier3", label: "Tier 3", atLeast: 17, success: true },
        { id: "tier2", label: "Tier 2", atLeast: 12, success: true },
        { id: "tier1", label: "Tier 1" },
      ],
    };
    document.resolution.naturalTotal = { atLeast: 19 };
    document.resolution.tierShift = { max: 1, text: "A double edge is +1, a double bane -1." };
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
  const faces = (...values: number[]) => {
    let at = 0;
    return () => {
      assert.ok(at < values.length, "the roll threw more dice than the test planned");
      return values[at++]!;
    };
  };

  // ── The schema ──
  const drawSteel = parsed(doc());
  {
    refuses(
      doc((d) => (d.resolution.naturalTotal = { atLeast: 21 })),
      /2d10 shows 2 to 20/,
      "a total the dice cannot show",
    );
    refuses(
      doc((d) => (d.resolution.naturalTotal = { atLeast: 19, atMost: 19 })),
      /atMost is at or above atLeast/,
      "a roll that would be both",
    );
    refuses(
      doc((d) => (d.resolution.naturalTotal = {})),
      /Give atLeast, atMost or both/,
      "an empty natural total",
    );
    refuses(
      doc((d) => delete d.resolution.outcomes),
      /Shifting a band needs outcomes/,
      "a shift with no bands",
    );
  }

  // ── The roll ──
  {
    const roll = (definition: RulesetDefinition, modifier: number, shift: number | undefined, ...thrown: number[]) =>
      rollDiceSumCheck(definition, { modifier, dc: 12, isSave: false, shift }, faces(...thrown));
    const natural = roll(drawSteel, -3, undefined, 10, 9);
    assert.deepEqual(
      [natural.total, natural.criticalSuccess, natural.success, natural.outcome],
      [16, true, true, "Tier 3"],
      "a natural 19 is the best tier whatever the modifier",
    );
    assert.equal(roll(drawSteel, 3, undefined, 9, 9).criticalSuccess, false, "18 and a modifier is not natural");
    assert.equal(roll(drawSteel, 4, undefined, 5, 4).outcome, "Tier 2");
    const edged = roll(drawSteel, 4, 1, 5, 4);
    assert.deepEqual([edged.outcome, edged.shift, edged.total], ["Tier 3", 1, 13]);
    assert.deepEqual([roll(drawSteel, 4, -1, 5, 4).outcome, roll(drawSteel, 4, -1, 5, 4).success], ["Tier 1", false]);
    assert.deepEqual(
      [roll(drawSteel, 4, 5, 5, 4).shift, roll(drawSteel, 4, 5, 5, 4).outcome],
      [1, "Tier 3"],
      "held to max",
    );
    assert.equal(roll(drawSteel, 10, 1, 9, 5).outcome, "Tier 3", "never past the best band");
    const fumbling = parsed(doc((d) => (d.resolution.naturalTotal = { atLeast: 19, atMost: 2 })));
    const fumble = roll(fumbling, 20, undefined, 1, 1);
    assert.deepEqual([fumble.criticalFailure, fumble.success, fumble.outcome], [true, false, "Tier 1"]);
    // A ruleset without the keys rolls exactly as it did.
    const plain = parsed(doc((d) => (delete d.resolution.naturalTotal, delete d.resolution.tierShift)));
    const before = roll(plain, -3, 1, 10, 9);
    assert.deepEqual([before.criticalSuccess, before.outcome, before.shift], [false, "Tier 2", undefined]);

    // An ask that moves nothing is not on the record: past the best band, or on a natural 19.
    assert.deepEqual([roll(drawSteel, 9, 1, 5, 4).outcome, roll(drawSteel, 9, 1, 5, 4).shift], ["Tier 3", undefined]);
    assert.deepEqual(
      [roll(drawSteel, 0, -1, 10, 9).outcome, roll(drawSteel, 0, -1, 10, 9).shift],
      ["Tier 3", undefined],
    );
    // A floor under a single die lifts its natural, so it lifts it out of `atMost` too.
    const floored = parsed(
      doc(
        (d) => (
          (d.resolution.dice = { count: 1, sides: 20 }),
          (d.resolution.naturalTotal = { atMost: 1 }),
          delete d.resolution.tierShift
        ),
      ),
    );
    const lifted = rollDiceSumCheck(floored, { modifier: 0, dc: 12, isSave: false, faceFloor: 10 }, faces(1));
    assert.deepEqual([lifted.usedRoll, lifted.criticalFailure], [10, false]);

    // The record says the shift and reads it back.
    const record = serializeResolvedSkillCheckTag({ skill: "Scrap", dc: 12, modifier: 4, resolution: "sum", ...edged });
    assert.match(record, /shift="\+1"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([back?.shift, back?.outcome], [1, "Tier 3"]);
    assert.match(formatSkillCheckResultSummary(back!), /Moved 1 band better\.$/);

    // On one d20 a shift can make a total below the dc a success, or one above it a failure. The
    // plain d20 audit keeps the Engine's record of either when the message is read back.
    const d20 = parsed(doc((d) => ((d.resolution.dice = { count: 1, sides: 20 }), delete d.resolution.naturalTotal)));
    const readBack = (shift: number, face: number) => {
      const rolled = rollDiceSumCheck(d20, { modifier: 0, dc: 12, isSave: false, shift }, faces(face));
      const written = serializeResolvedSkillCheckTag({
        skill: "Scrap",
        dc: 12,
        modifier: 0,
        resolution: "sum",
        ...rolled,
      });
      const read = parseSkillCheckTagBody(written.slice("[skill_check:".length, -1))?.resolvedResult;
      return [rolled.success, read?.success, read?.shift, read?.outcome];
    };
    assert.deepEqual(readBack(1, 10), [true, true, 1, "Tier 2"]);
    assert.deepEqual(readBack(-1, 13), [false, false, -1, "Tier 1"]);
    // With no shift, a result its total contradicts is still refused.
    assert.equal(
      parseSkillCheckTagBody(
        'skill="Scrap" dc="12" rolls="10" used="10" modifier="0" total="10" result="success" mode="normal" resolution="sum" dice="1d20" outcome="Tier 2"',
      )?.resolvedResult,
      undefined,
    );
  }

  // ── Through the resolver, the Game Master and the package gate ──
  {
    assert.equal(parseSkillCheckTagBody('skill="Scrap" dc="12" shift="-1"')?.shift, -1);
    const cards = [
      { name: "Wren", rulesetSheet: { v: drawSteel.sheet.version, build: defaultRulesetSheetBuild(drawSteel) } },
    ];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(drawSteel, cards, cards[0]),
    };
    const result = resolveSkillCheckWithContext(context as any, { skill: "Scrap", dc: 12, shift: -1 });
    // The record says the band moved only when it did: not from the worst band, and not on a critical.
    assert.ok(result.shift === -1 || result.shift === undefined);
    if (result.outcome === "Tier 3") assert.equal(result.shift, undefined);

    // A game with no ruleset has no bands, so a written record that claims a shift is rolled again.
    const loose = await resolveSkillCheckTagsInContent(
      '[skill_check: skill="Stealth" dc="15" rolls="3" used="3" modifier="0" total="3" result="success" shift="+1" outcome="Slips by"]',
      { loadContext: async () => ({ skills: null, attributes: null, sheetAttributes: {} }) as any, rollD20: () => 3 },
    );
    assert.deepEqual([loose.trusted, loose.results?.length], [0, 1], "a claimed shift is not kept");
    assert.deepEqual([loose.results![0]!.success, loose.results![0]!.shift], [false, undefined]);
    assert.equal(parseSkillCheckTagBody('skill="Scrap" dc="12" shift="1000000"')?.shift, 3);
    const natural = result.rolls[0]! + result.rolls[1]!;
    if (natural >= 19) assert.equal(result.outcome, "Tier 3", "a natural 19 or 20 is the best band, shifted or not");

    // A record the Game Master wrote cannot stand in for a roll whose critical is read off the dice,
    // or for a shift, so the Engine rolls these itself even with no bands in play.
    const bare = parsed(doc((d) => (delete d.resolution.outcomes, delete d.resolution.tierShift)));
    const bareContext = { ...context, ruleset: buildSkillCheckRulesetContext(bare, cards, cards[0]) };
    const { modifier } = resolveSkillCheckWithContext(bareContext as any, { skill: "Scrap", dc: 12 });
    const again = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Scrap" dc="12" rolls="10,9" used="19" modifier="${modifier}" total="${19 + modifier}" result="success" mode="normal" resolution="sum" dice="2d10"]`,
      { loadContext: async () => bareContext as any, rulesetPinned: true },
    );
    assert.deepEqual([again.trusted, again.results?.length], [0, 1], "a written record is rolled again");

    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: ["Wren"],
      playerName: "Wren",
      ruleset: drawSteel,
    });
    assert.match(reminder, /The dice showing 19 or more before anything is added is a critical success/);
    assert.match(
      reminder,
      /Add shift="\+1" or shift="-1" to move the outcome that many bands better or worse, up to 1/,
    );

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-natural-total",
      name: "Natural total",
      version: "0.1.0",
      description: "A packaged ruleset whose natural total is a critical.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(821) as any, doc()) ?? "", /capabilityApi 1\.822/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(822) as any, doc()), null);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
