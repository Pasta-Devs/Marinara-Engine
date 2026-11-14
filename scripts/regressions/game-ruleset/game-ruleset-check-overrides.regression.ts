/**
 * Checks that roll their own way: `resolution.overrides` (Capability API 1.140).
 *
 * What is pinned here:
 *   - The schema refuses an override that names nothing, an unknown skill, a skill two overrides
 *     without `when` both claim, a locked key, a key the kind does not have, a resolution the
 *     override makes that its own rules refuse, and a `when` the sheet cannot read.
 *   - An old-school game rolled under: a d20 for most checks, a d100 for the thief's skill.
 *   - A pool whose 1s do not cancel on a favored skill, only for the character whose sheet says so.
 *   - The Game Master is told, and a packaged ruleset with overrides declares 1.140.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  rollDicePoolCheck,
  rulesetCheckOverride,
  rulesetDefinitionForCheck,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-check-overrides-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext, rulesetCheckValueFor },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../../packages/server/src/services/game/gm-prompts.js"),
    import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../../docs/examples/rulesets/ember-roads.json");
  const gravewatchText = read("../../../docs/examples/rulesets/gravewatch.json");
  const strip = (document: Record<string, any>) => {
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? []).filter(
      (catalog: { holds?: string }) => catalog.holds !== "creatures",
    );
    return document;
  };
  /** Ember Roads rolled under a d20, with Sneak a thief's d100 skill. */
  const underDoc = (edit?: (doc: Record<string, any>) => void) => {
    const document = strip(JSON.parse(emberText));
    document.sheet.bonusRange = { min: -20, max: 99 };
    const old = document.resolution;
    document.resolution = {
      kind: "roll-against",
      dice: { count: 1, sides: 20 },
      abilityModifier: old.abilityModifier,
      proficiencyTiers: old.proficiencyTiers,
      difficultyLadder: [{ label: "Normal", dc: 0 }],
      overrides: [
        {
          id: "thief",
          label: "Thief skills",
          text: "a percentage on the sheet.",
          skills: ["sneak"],
          set: { dice: { count: 1, sides: 100 }, criticalFailure: [{ from: 100 }] },
        },
      ],
    };
    edit?.(document);
    return document;
  };
  /** Gravewatch, with 1s that do not cancel on Ward for a warden whose sheet favors it. */
  const poolDoc = (edit?: (doc: Record<string, any>) => void) => {
    const document = strip(JSON.parse(gravewatchText));
    document.sheet.fields.push({ id: "favored_ward", label: "Ward is favored", type: "number", min: 0, max: 1 });
    document.resolution.overrides = [
      {
        id: "favored",
        label: "Favored",
        skills: ["ward"],
        when: { field: "favored_ward" },
        set: { cancel: null, botch: null },
      },
    ];
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
  {
    parsed(underDoc());
    parsed(poolDoc());
    refuses(
      underDoc((d) => delete d.resolution.overrides[0].skills),
      /names the skills, saves or abilities/,
      "an override that names nothing",
    );
    refuses(
      underDoc((d) => (d.resolution.overrides[0].skills = ["pickpocket"])),
      /Unknown skill "pickpocket"/,
      "an unknown skill",
    );
    refuses(
      underDoc((d) => d.resolution.overrides.push({ id: "other", label: "Other", skills: ["sneak"], set: {} })),
      /already in the override "thief"/,
      "a skill in two overrides",
    );
    refuses(
      underDoc((d) => (d.resolution.overrides[0].set = { difficultyLadder: [{ label: "x", dc: 0 }] })),
      /does not change difficultyLadder/,
      "a locked key",
    );
    refuses(
      underDoc((d) => (d.resolution.overrides[0].set = { explode: { from: 10 } })),
      /explode/,
      "a key the kind does not have",
    );
    refuses(
      underDoc((d) => (d.resolution.overrides[0].set = { tens: { max: 1 } })),
      /resolution\.overrides\.0\.set\.tens: Tens dice are thrown on a single d100/,
      "a resolution its own rules refuse",
    );
    refuses(
      poolDoc((d) => (d.resolution.overrides[0].when = { field: "nothing" })),
      /nothing/,
      "a when the sheet cannot read",
    );
  }

  // ── Through the resolver ──
  {
    const under = parsed(underDoc());
    const build = defaultRulesetSheetBuild(under);
    const cards = [{ name: "Kit", rulesetSheet: { v: under.sheet.version, build } }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(under, cards, cards[0]),
    };
    for (let i = 0; i < 40; i += 1) {
      const sneak = resolveSkillCheckWithContext(context as any, { skill: "Sneak", dc: 0 });
      assert.equal(sneak.dice, "1d100");
      const sway = resolveSkillCheckWithContext(context as any, { skill: "Sway", dc: 0 });
      assert.equal(sway.dice, "1d20");
    }

    const pool = parsed(poolDoc());
    const wardenBuild = defaultRulesetSheetBuild(pool);
    const favored = { ...wardenBuild, fields: { ...wardenBuild.fields, favored_ward: 1 } };
    const poolCards = [
      { name: "Bram", rulesetSheet: { v: pool.sheet.version, build: favored } },
      { name: "Ivo", rulesetSheet: { v: pool.sheet.version, build: wardenBuild } },
    ];
    const poolContext = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(pool, poolCards, poolCards[0]),
    };
    // Whose sheet favors Ward is read per roller.
    const ward = matchRulesetCheckTarget(pool, "Ward");
    const meetsFor = (who: string) => (ref: any) => (rulesetCheckValueFor(poolContext.ruleset, ref, who) ?? 0) !== 0;
    assert.equal(rulesetCheckOverride(pool, ward, meetsFor("Bram"))?.id, "favored");
    assert.equal(rulesetCheckOverride(pool, ward, meetsFor("Ivo")), null);
    assert.equal(rulesetCheckOverride(pool, matchRulesetCheckTarget(pool, "Dig"), meetsFor("Bram")), null);
    // A 1 cancels a success on Ivo's Ward and on nobody's favored one.
    const favoredPool = rulesetDefinitionForCheck(pool, rulesetCheckOverride(pool, ward, meetsFor("Bram")));
    const faces = (...values: number[]) => {
      let at = 0;
      return () => values[at++]!;
    };
    assert.equal(rollDicePoolCheck(pool, { modifier: 3, required: 1, isSave: false }, faces(1, 8, 3)).total, 0);
    assert.equal(rollDicePoolCheck(favoredPool, { modifier: 3, required: 1, isSave: false }, faces(1, 8, 3)).total, 1);
    const botch = rollDicePoolCheck(pool, { modifier: 2, required: 1, isSave: false }, faces(1, 3));
    const none = rollDicePoolCheck(favoredPool, { modifier: 2, required: 1, isSave: false }, faces(1, 3));
    assert.deepEqual([botch.criticalFailure, none.criticalFailure], [true, false]);
    // And through the resolver: Bram's favored Ward never botches.
    for (let i = 0; i < 60; i += 1) {
      const rolled = resolveSkillCheckWithContext(poolContext as any, { skill: "Ward", dc: 1, who: "Bram" });
      assert.equal(rolled.criticalFailure, false);
    }

    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: ["Kit"], playerName: "Kit" };
    assert.match(
      buildGmFormatReminder({ ...base, ruleset: under }),
      /These checks roll their own way, and the engine rolls them so: Thief skills \(Sneak\): a percentage on the sheet\./,
    );
    assert.match(
      buildGmFormatReminder({ ...base, ruleset: pool }),
      /Favored \(Ward for a character whose .* is not 0\)/,
    );

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-check-overrides",
      name: "Check overrides",
      version: "0.1.0",
      description: "A packaged ruleset with checks of their own.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /whose checks roll their own way requires schemaVersion 2 and capabilityApi 1\.140/;
    assert.match(getCapabilityPackageInstallIssue(manifest(139) as any, poolDoc()) ?? "", gate);
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(140) as any, poolDoc()) ?? "", gate);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
