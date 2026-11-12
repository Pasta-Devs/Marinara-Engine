/**
 * Two named dice on a summed check (Capability API 1.821): Daggerheart's Hope and Fear.
 *
 * What is pinned here:
 *   - The schema takes 2d12 with two named dice, and refuses them on another count, beside advantage,
 *     and under one id.
 *   - The roll adds the two dice as before and records which one showed more; a tie is a critical
 *     success whatever the total, unless `tieIsCritical` is false.
 *   - Through the resolver, the record and the Game Master; a packaged ruleset declares 1.821.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-duality-"));
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
  /** Ember Roads thrown on Hope and Fear, its fight and layers left out. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    document.resolution.dice = { count: 2, sides: 12 };
    document.resolution.duality = {
      dice: [
        { id: "hope", label: "Hope" },
        { id: "fear", label: "Fear" },
      ],
      text: "Hope gives the player a Hope token; Fear gives the Game Master one.",
    };
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
  const daggerheart = parsed(doc());
  {
    refuses(
      doc((d) => (d.resolution.dice = { count: 3, sides: 12 })),
      /dice\.count 2/,
      "three dice",
    );
    refuses(
      doc((d) => (d.resolution.advantage = true)),
      /advantage is false/,
      "advantage",
    );
    refuses(
      doc((d) => (d.resolution.duality.dice[1].id = "hope")),
      /share an id/,
      "one id twice",
    );
    refuses(
      doc((d) => (d.resolution.duality.dice[1].label = " hope ")),
      /share a label/,
      "one label twice",
    );
    refuses(
      doc((d) => ((d.resolution.duality.dice[0].label = 'Hope"'), (d.resolution.duality.dice[1].label = "Hope'"))),
      /share a label/,
      "labels the record writes alike",
    );
    refuses(
      doc((d) => (d.resolution.duality.dice[0].label = "   ")),
      /needs a label the record can write/,
      "a label of spaces",
    );
    refuses(
      doc((d) => (d.resolution.duality.dice[1].label = "Tie")),
      /labelled "tie"/,
      "a die labelled tie",
    );
  }

  // ── The roll ──
  {
    const roll = (definition: RulesetDefinition, modifier: number, dc: number, ...thrown: number[]) =>
      rollDiceSumCheck(definition, { modifier, dc, isSave: false }, faces(...thrown));
    const hope = roll(daggerheart, 1, 12, 9, 4);
    assert.deepEqual([hope.total, hope.success, hope.duality, hope.criticalSuccess], [14, true, "Hope", false]);
    const fear = roll(daggerheart, 1, 12, 3, 8);
    assert.deepEqual([fear.total, fear.success, fear.duality], [12, true, "Fear"]);
    assert.equal(roll(daggerheart, 0, 12, 2, 5).success, false, "the total is still read against the dc");
    assert.equal(roll(daggerheart, 0, 12, 2, 5).duality, "Fear", "a failure still says which die showed more");
    // A tie is a critical success whatever the total.
    const tie = roll(daggerheart, 0, 15, 5, 5);
    assert.deepEqual(
      [tie.total, tie.duality, tie.success, tie.criticalSuccess, tie.criticalFailure],
      [10, "tie", true, true, false],
    );
    const plainTie = roll(parsed(doc((d) => (d.resolution.duality.tieIsCritical = false))), 0, 15, 5, 5);
    assert.deepEqual([plainTie.duality, plainTie.success, plainTie.criticalSuccess], ["tie", false, false]);
    // A ruleset without the key rolls exactly as it did.
    const plain = parsed(doc((d) => delete d.resolution.duality));
    const before = roll(plain, 1, 12, 5, 5);
    assert.deepEqual([before.duality, before.criticalSuccess, before.success], [undefined, false, false]);

    // The record says the die and reads back.
    const record = serializeResolvedSkillCheckTag({ skill: "Scrap", dc: 12, modifier: 1, resolution: "sum", ...hope });
    assert.match(record, /duality="Hope"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([back?.duality, back?.total, back?.success], ["Hope", 14, true]);
    assert.match(formatSkillCheckResultSummary(back!), /With Hope\.$/);
    const tieRecord = serializeResolvedSkillCheckTag({
      skill: "Scrap",
      dc: 15,
      modifier: 0,
      resolution: "sum",
      ...tie,
    });
    const tieBack = parseSkillCheckTagBody(tieRecord.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([tieBack?.duality, tieBack?.criticalSuccess], ["tie", true]);
    assert.match(formatSkillCheckResultSummary(tieBack!), /The two named dice tied\.$/);
  }

  // ── Through the resolver, the Game Master and the package gate ──
  {
    const cards = [
      { name: "Wren", rulesetSheet: { v: daggerheart.sheet.version, build: defaultRulesetSheetBuild(daggerheart) } },
    ];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(daggerheart, cards, cards[0]),
    };
    const result = resolveSkillCheckWithContext(context as any, { skill: "Scrap", dc: 12 });
    assert.equal(result.rolls.length, 2);
    const [a, b] = result.rolls;
    assert.equal(result.duality, a! > b! ? "Hope" : b! > a! ? "Fear" : "tie");

    // A record the Game Master wrote, with the sheet's own modifier and a tidy sum, cannot say which
    // die led, so a check on two named dice is always the Engine's own roll.
    const written = `[skill_check: skill="Scrap" dc="12" rolls="7,5" used="12" modifier="${result.modifier}" total="${12 + result.modifier}" result="${12 + result.modifier >= 12 ? "success" : "failure"}" mode="normal" resolution="sum" dice="2d12"]`;
    const again = await resolveSkillCheckTagsInContent(written, {
      loadContext: async () => context as any,
      rulesetPinned: true,
    });
    assert.deepEqual([again.trusted, again.results?.length], [0, 1], "a written record is rolled again");
    assert.ok(again.results![0]!.duality, "the Engine's roll says which die led");

    // The Engine's own record from a branch is the exception: the tag pass that follows the branch arm
    // leaves it alone, because rolling it again could contradict the half of the branch already kept.
    const { createGameTurnChanceSession, resolveGameTurnBranches } =
      await import("../../packages/server/src/services/game/one-request-dice.js");
    const session = createGameTurnChanceSession({
      db: null as never,
      chatId: "duality-branch",
      loadModifierContext: () => Promise.resolve(context as any),
    });
    const branched = await resolveGameTurnBranches(
      [
        `Before. [skill_check: skill="Scrap" dc="12" branch="door"]`,
        `[branch: door]`,
        `[on success] It opens.`,
        `[on failure] It holds.`,
        `[/branch]`,
      ].join("\n"),
      session,
    );
    assert.match(branched.content, /duality="(Hope|Fear|tie)"/, "the branch arm rolled the two named dice");
    // The branch arm's roller stands in for a d20 only, so the two d12s are thrown at their own size:
    // a roller that always says 20 never reaches the record, which reads back as a result.
    for (let turn = 0; turn < 40; turn++) {
      const loud = createGameTurnChanceSession({
        db: null as never,
        chatId: "duality-branch",
        roll: () => 20,
        loadModifierContext: () => Promise.resolve(context as any),
      });
      const rolled = await resolveGameTurnBranches(
        `[skill_check: skill="Scrap" dc="12" branch="door"]\n[branch: door]\n[on success] Yes.\n[on failure] No.\n[/branch]`,
        loud,
      );
      const [record] = [...loud.engineRecords];
      const back = parseSkillCheckTagBody(record!.slice("[skill_check:".length, -1))?.resolvedResult;
      assert.ok(back, `the branch record reads back: ${rolled.content}`);
      assert.ok(
        back.rolls.length === 2 && back.rolls.every((face) => face >= 1 && face <= 12),
        `faces of a d12: ${back.rolls}`,
      );
    }
    assert.equal(session.engineRecords.size, 1);
    const after = await resolveSkillCheckTagsInContent(branched.content, {
      loadContext: async () => context as any,
      rulesetPinned: true,
      engineRecords: session.engineRecords,
    });
    assert.deepEqual([after.resolved, after.trusted, after.content], [0, 1, branched.content]);
    // The same record with nobody naming it as the Engine's is rolled again, as any written one is.
    const unnamed = await resolveSkillCheckTagsInContent(branched.content, {
      loadContext: async () => context as any,
      rulesetPinned: true,
    });
    assert.equal(unnamed.resolved, 1);

    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: ["Wren"],
      playerName: "Wren",
      ruleset: daggerheart,
    });
    assert.match(reminder, /The two dice are Hope and Fear; the engine marks duality="\.\.\."/);
    assert.match(reminder, /duality="tie", which is a critical success/);

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-duality",
      name: "Duality",
      version: "0.1.0",
      description: "A packaged ruleset that throws two named dice.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(820) as any, doc()) ?? "", /capabilityApi 1\.821/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(821) as any, doc()), null);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
