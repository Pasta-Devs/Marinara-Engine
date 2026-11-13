/**
 * A summed check's plot die (Capability API 1.822): the Cosmere RPG's d20 with a d6 whose faces carry
 * complications (+2, +4) and opportunities.
 *
 * What is pinned here:
 *   - The schema takes the plot die, and refuses a face the die lacks and a face listed twice.
 *   - It is thrown only on `plot="true"`, after the check's own dice; its face adds only its `bonus`,
 *     and a face it does not list is blank.
 *   - The record keeps the d20 as the one roll and the bonus inside `modifier`, so the d20 audit still
 *     holds, and says the face, symbol and bonus apart; the Game Master is taught `plot=`; a packaged
 *     ruleset declares 1.822.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-plot-die-"));
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
  /** Ember Roads thrown on a d20 with the Cosmere plot die, its fight and layers left out. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    document.resolution.dice = { count: 1, sides: 20 };
    document.resolution.plotDie = {
      label: "Plot die",
      sides: 6,
      faces: [
        { face: 1, symbol: "complication", bonus: 2 },
        { face: 2, symbol: "complication", bonus: 4 },
        { face: 5, symbol: "opportunity" },
        { face: 6, symbol: "opportunity" },
      ],
      text: "A complication goes wrong alongside the result; an opportunity offers something more.",
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
  const cosmere = parsed(doc());
  {
    refuses(
      doc((d) => (d.resolution.plotDie.faces[0].face = 7)),
      /A face of this die is from 1 to 6/,
      "a face the die lacks",
    );
    refuses(
      doc((d) => (d.resolution.plotDie.faces[1].face = 1)),
      /Face 1 is listed twice/,
      "a face listed twice",
    );
  }

  // ── The roll ──
  {
    const roll = (plot: boolean, modifier: number, dc: number, ...thrown: number[]) =>
      rollDiceSumCheck(cosmere, { modifier, dc, isSave: false, plot }, faces(...thrown));
    // A +4 complication lifts 12 + 1 over 15.
    const complication = roll(true, 1, 15, 12, 2);
    assert.deepEqual(
      [complication.rolls, complication.total, complication.success, complication.plot],
      [[12], 17, true, { face: 2, symbol: "complication", bonus: 4, label: "Plot die" }],
    );
    const opportunity = roll(true, 1, 15, 12, 6);
    assert.deepEqual([opportunity.total, opportunity.success, opportunity.plot?.symbol], [13, false, "opportunity"]);
    const blank = roll(true, 0, 10, 12, 3);
    assert.deepEqual(blank.plot, { face: 3, bonus: 0, label: "Plot die" });
    // Not asked for: one die thrown, and nothing said.
    const unasked = roll(false, 0, 10, 12);
    assert.deepEqual([unasked.rolls, unasked.plot], [[12], undefined]);
    // A ruleset without the key ignores the ask.
    const plain = parsed(doc((d) => delete d.resolution.plotDie));
    assert.equal(
      rollDiceSumCheck(plain, { modifier: 0, dc: 10, isSave: false, plot: true }, faces(12)).plot,
      undefined,
    );
  }

  // ── Through the resolver, the record, the Game Master and the package gate ──
  {
    assert.equal(parseSkillCheckTagBody('skill="Scrap" dc="10" plot="true"')?.plot, true);
    const cards = [
      { name: "Wren", rulesetSheet: { v: cosmere.sheet.version, build: defaultRulesetSheetBuild(cosmere) } },
    ];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(cosmere, cards, cards[0]),
    };
    for (let i = 0; i < 12; i++) {
      const result = resolveSkillCheckWithContext(context as any, { skill: "Scrap", dc: 10, plot: true }, () => 12);
      assert.equal(result.rolls.length, 1, "the plot die is not one of the rolls");
      assert.ok(result.plotFace! >= 1 && result.plotFace! <= 6);
      assert.equal(result.plotLabel, "Plot die");
      assert.equal(result.rolls[0]! + result.modifier, result.total, "the bonus is inside the modifier");
      // The record survives the d20 audit and reads back what the plot die did.
      const back = parseSkillCheckTagBody(
        serializeResolvedSkillCheckTag(result).slice("[skill_check:".length, -1),
      )?.resolvedResult;
      assert.ok(back, "the record is read back as a roll");
      assert.deepEqual(
        [back.plotFace, back.plotSymbol, back.plotBonus, back.total],
        [result.plotFace, result.plotSymbol, result.plotBonus, result.total],
      );
    }
    const record = serializeResolvedSkillCheckTag({
      skill: "Scrap",
      dc: 15,
      rolls: [12],
      usedRoll: 12,
      modifier: 5,
      total: 17,
      success: true,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution: "sum",
      dice: "1d20",
      plotFace: 2,
      plotSymbol: "complication",
      plotBonus: 4,
      plotLabel: "Plot die",
    });
    assert.match(record, /plotFace="2" plotSymbol="complication" plotBonus="4" plotLabel="Plot die"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.match(formatSkillCheckResultSummary(back!), /Plot die 2: complication \(\+4\)\.$/);

    // A check inside a branch throws the plot die too, and the tag pass that follows leaves the branch
    // arm's record alone: rolling it again could contradict the half of the branch already kept.
    const { createGameTurnChanceSession, resolveGameTurnBranches } =
      await import("../../packages/server/src/services/game/one-request-dice.js");
    const session = createGameTurnChanceSession({
      db: null as never,
      chatId: "plot-branch",
      roll: () => 12,
      loadModifierContext: () => Promise.resolve(context as any),
    });
    const branched = await resolveGameTurnBranches(
      [
        `Before. [skill_check: skill="Scrap" dc="10" plot="true" branch="door"]`,
        `[branch: door]`,
        `[on success] It opens.`,
        `[on failure] It holds.`,
        `[/branch]`,
      ].join("\n"),
      session,
    );
    assert.match(branched.content, /plotFace="\d"/, "the branch arm threw the plot die");
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

    // With no ruleset there is no plot die, so a record that names one is the model's claim and the
    // Engine rolls the check: the saved record has no plot die on it.
    const noRuleset = await resolveSkillCheckTagsInContent(
      '[skill_check: skill="Stealth" dc="5" rolls="14" used="14" modifier="0" total="14" result="success" mode="normal" resolution="sum" dice="1d20" plotFace="6" plotSymbol="opportunity" plotLabel="Plot die"]',
      { loadContext: async () => ({ skills: null, attributes: null, sheetAttributes: {} }) as any, rollD20: () => 3 },
    );
    assert.deepEqual(
      [noRuleset.trusted, noRuleset.results?.[0]?.rolls, noRuleset.results?.[0]?.plotFace],
      [0, [3], undefined],
    );
    assert.doesNotMatch(noRuleset.content, /plotFace|plotSymbol/);
    // The same holds for a record that only asks for the plot die: its written numbers are not kept.
    const askedLoose = await resolveSkillCheckTagsInContent(
      '[skill_check: skill="Stealth" dc="5" plot="true" rolls="14" used="14" modifier="0" total="14" result="success" mode="normal" resolution="sum" dice="1d20"]',
      { loadContext: async () => ({ skills: null, attributes: null, sheetAttributes: {} }) as any, rollD20: () => 3 },
    );
    assert.deepEqual([askedLoose.trusted, askedLoose.results?.[0]?.rolls], [0, [3]]);
    // A bare ask claims nothing, so it is rolled as any check is.
    const bareLoose = await resolveSkillCheckTagsInContent('[skill_check: skill="Stealth" dc="5" plot="true"]', {
      loadContext: async () => ({ skills: null, attributes: null, sheetAttributes: {} }) as any,
      rollD20: () => 3,
    });
    assert.deepEqual([bareLoose.resolved, bareLoose.results?.[0]?.rolls], [1, [3]]);

    // A 20-sided plot die is still not the check's own d20: an injected d20 is spent on the check alone.
    const wide = parsed(doc((d) => (d.resolution.plotDie.sides = 20)));
    const wideContext = { ...context, ruleset: buildSkillCheckRulesetContext(wide, cards, cards[0]) };
    let d20s = 0;
    resolveSkillCheckWithContext(wideContext as any, { skill: "Scrap", dc: 10, plot: true }, () => ((d20s += 1), 12));
    assert.equal(d20s, 1, "the plot die did not take a second injected d20");

    // A record the Game Master wrote is vouched for when its numbers are the sheet's. One that names
    // a plot die, or asks for one, is not: nobody threw that die, so the Engine rolls the check.
    const sheetModifier = resolveSkillCheckWithContext(context as any, { skill: "Scrap", dc: 10 }, () => 12).modifier;
    const written = (extra: string) =>
      `[skill_check: skill="Scrap" dc="10" rolls="12" used="12" modifier="${sheetModifier}" total="${12 + sheetModifier}" result="success" mode="normal" resolution="sum" dice="1d20"${extra}]`;
    const resolve = (content: string) =>
      resolveSkillCheckTagsInContent(content, {
        loadContext: async () => context as any,
        rulesetPinned: true,
        rollD20: () => 12,
      });
    assert.equal((await resolve(written(""))).trusted, 1, "a plain written record is vouched for");
    const forged = await resolve(written(' plotFace="6" plotSymbol="opportunity" plotLabel="Plot die"'));
    assert.deepEqual([forged.trusted, forged.results?.length], [0, 1], "a written plot die is rolled again");
    assert.equal(forged.results![0]!.plotFace, undefined, "nobody asked for the plot die, so the record has none");
    const asked = await resolve(written(' plot="true"'));
    assert.deepEqual([asked.trusted, asked.results?.length], [0, 1], "full numbers do not stand in for the plot die");
    assert.ok(asked.results![0]!.plotFace! >= 1, "the Engine threw the plot die");

    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: ["Wren"],
      playerName: "Wren",
      ruleset: cosmere,
    });
    assert.match(reminder, /Add plot="true" to throw the Plot die with the check/);

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-plot-die",
      name: "Plot die",
      version: "0.1.0",
      description: "A packaged ruleset with a plot die.",
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
