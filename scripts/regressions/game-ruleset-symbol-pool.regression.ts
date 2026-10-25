/** Narrative dice (Capability API 1.141): bounded, validated pools; cancelling symbols and
 *  independent critical markers; the resolver, saved record, card text and package boundary. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  formatSkillCheckResultSummary,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  rollSymbolPoolCheck,
  rulesetSymbolPoolRatings,
  matchRulesetCheckTarget,
  serializeResolvedSkillCheckTag,
  skillCheckDiceSumToTotal,
  skillCheckSymbolText,
  type RulesetDefinition,
  type SkillCheckResult,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-symbol-pool-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;
try {
  const [resolver, { buildGmFormatReminder }, { getCapabilityPackageInstallIssue }, { rulesetRulesSummary }] =
    await Promise.all([
      import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
      import("../../packages/server/src/services/game/gm-prompts.js"),
      import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
      import("../../packages/client/src/lib/ruleset-resolution.js"),
    ]);
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const ember = JSON.parse(read("../../docs/examples/rulesets/ember-roads.json"));
  // Test the guide's actual six narrative dice and symbols, including its strict schema shape.
  const guide = read("../../docs/extending/writing-rulesets.md").split("#### `symbol-pool`")[1]!;
  const example = JSON.parse(`{${guide.split("```json\n")[1]!.split("```")[0]}}`).resolution;
  const doc = (edit?: (document: any) => void) => {
    const document = structuredClone(ember);
    delete document.combat;
    delete document.layers;
    document.catalogs = document.catalogs.filter((catalog: any) => catalog.holds !== "creatures");
    document.resolution = { ...structuredClone(example), proficiencyTiers: ember.resolution.proficiencyTiers };
    edit?.(document);
    return document;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refuses = (edit: (document: any) => void, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc(edit));
    assert.ok(!result.ok, "bad symbol pool must be refused");
    assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(doc());
  const faces = (...values: number[]) => {
    let at = 0;
    return (sides: number) => {
      assert.ok(at < values.length, "unexpected extra die");
      const value = values[at++]!;
      assert.ok(value >= 1 && value <= sides, `face ${value} on d${sides}`);
      return value;
    };
  };
  const roll = (ability: number, rank: number, difficulty: number, values: number[], extra = {}) =>
    rollSymbolPoolCheck(definition, { ability, rank, difficulty, isSave: false, ...extra }, faces(...values));

  // Every referenced symbol and die, uniqueness, hard bounds, cancellation ambiguity and overrides.
  refuses((d) => d.resolution.symbols.push(d.resolution.symbols[0]), /Duplicate symbol/);
  refuses((d) => d.resolution.dice.push(d.resolution.dice[0]), /Duplicate die/);
  refuses((d) => (d.resolution.dice[0].faces[0] = ["missing"]), /Unknown symbol/);
  refuses((d) => (d.resolution.symbols[0].counts = "missing"), /Unknown symbol/);
  refuses((d) => (d.resolution.symbols[0].cancels = "s"), /itself/);
  refuses((d) => (d.resolution.symbols[0].counts = "t"), /without counts/);
  refuses((d) => (d.resolution.symbols[2].cancels = "s"), /only one partner/);
  refuses((d) => (d.resolution.pool.die = "missing"), /Unknown die/);
  refuses((d) => (d.resolution.difficulty.upgrade = "missing"), /Unknown die/);
  refuses((d) => (d.resolution.boost.die = "missing"), /Unknown die/);
  refuses((d) => (d.resolution.success.symbol = "missing"), /Unknown success symbol/);
  refuses((d) => (d.resolution.criticalFailure = "missing"), /Unknown critical symbol/);
  refuses((d) => (d.resolution.pool.max = 13), /resolution\.pool\.max: Too big: expected number to be <=12/);
  refuses((d) => (d.resolution.dice[0].faces[0] = ["s", "s", "s", "s"]), /Too big: expected array to have <=3 items/);
  refuses((d) => (d.resolution.difficultyLadder[0].dc = -1), /Difficulty dice/);
  refuses((d) => (d.resolution.difficultyLadder[0].dc = 6), /Difficulty dice/);
  refuses((d) => (d.combat = ember.combat), /fights as a "symbol-pool" fight/);
  refuses((d) => (d.resolution.spend = [{ pool: "luck", amount: 1, successes: 1, perCheck: 1 }]), /buys only dice/);
  for (const key of ["symbols", "dice"]) {
    refuses(
      (d) =>
        (d.resolution.overrides = [
          { id: "bad", label: "Bad", abilities: ["wits"], set: { [key]: d.resolution[key] } },
        ]),
      /does not change/,
    );
  }
  refuses(
    (d) =>
      (d.resolution.overrides = [
        { id: "bad", label: "Bad", abilities: ["wits"], set: { difficulty: { die: "missing" } } },
      ]),
    /Unknown die/,
  );
  parsed(doc((d) => (d.resolution.symbols[0].cancels = "f"))); // Reciprocal pair is harmless.

  const mixed = roll(3, 2, 2, [12, 7, 4, 12, 2], { upgrades: 1 });
  assert.deepEqual(mixed.thrown, ["proficiency", "proficiency", "ability", "challenge", "difficulty"]);
  assert.deepEqual(mixed.symbols, { t: 1, s: 2, a: 1, d: 1 });
  assert.deepEqual([mixed.total, mixed.success, mixed.criticalSuccess, mixed.criticalFailure], [2, true, true, true]);
  const cancelled = roll(1, 1, 1, [12, 3]);
  assert.deepEqual(cancelled.symbols, { t: 1, f: 1 });
  assert.equal(cancelled.success, false);
  assert.equal(cancelled.criticalSuccess, true, "triumph survives a failed check");
  assert.equal(roll(2, 0, 1, [4, 4, 12], { upgrades: 1 }).criticalFailure, true, "despair survives success");
  assert.deepEqual(roll(1, 0, 1, [8, 7]).symbols, {}, "advantage cancels threat");
  assert.deepEqual(roll(0, 0, 0, []).rolls, []);
  assert.equal(roll(0, 0, 0, []).success, false);
  assert.deepEqual(roll(1, 0, 1, [2, 3, 1], { bonusDice: 1 }).thrown, ["ability", "boost", "difficulty"]);
  assert.deepEqual(roll(1, 0, 1, [2, 1, 3], { bonusDice: -1 }).thrown, ["ability", "difficulty", "setback"]);
  const capped = rollSymbolPoolCheck(
    definition,
    { ability: 999, rank: 999, difficulty: 999, upgrades: 999, bonusDice: -999, isSave: false },
    () => 1,
  );
  assert.deepEqual(
    [
      capped.thrown.filter((id) => id === "proficiency").length,
      capped.thrown.filter((id) => id === "challenge").length,
      capped.thrown.filter((id) => id === "setback").length,
    ],
    [6, 5, 3],
  );
  assert.equal(
    rollSymbolPoolCheck(
      definition,
      { ability: NaN, rank: Infinity, difficulty: NaN, bonusDice: Infinity, isSave: false },
      faces(),
    ).rolls.length,
    0,
  );
  const summed = parsed(doc((d) => (d.resolution.pool.build = "sum")));
  assert.deepEqual(rollSymbolPoolCheck(summed, { ability: 2, rank: 1, difficulty: 0, isSave: false }, () => 1).thrown, [
    "ability",
    "ability",
    "ability",
  ]);
  assert.deepEqual(roll(1, 0, 0, [1, 1], { bought: { dice: 1 } }).thrown, ["ability", "ability"]);
  const bands = parsed(
    doc(
      (d) =>
        (d.resolution.outcomes = {
          by: "margin",
          tiers: [
            { id: "strong", label: "Strong", atLeast: 2, success: true },
            { id: "pass", label: "Pass", atLeast: 1, success: true },
            { id: "fail", label: "Fail" },
          ],
        }),
    ),
  );
  assert.equal(
    rollSymbolPoolCheck(bands, { ability: 1, rank: 0, difficulty: 0, isSave: false }, faces(2)).outcome,
    "Pass",
  );
  assert.equal(
    rollSymbolPoolCheck(bands, { ability: 1, rank: 1, difficulty: 0, isSave: false }, faces(12)).criticalSuccess,
    true,
  );

  // 1.150: independent setbacks and opt-in upgrades beyond a fully upgraded pool.
  const ownDoc = () =>
    doc((d) => {
      d.resolution.allowOwnUpgrade = true;
    });
  const own = parsed(ownDoc());
  const ownRoll = (ability: number, rank: number, upgradeOwn: number, extra = {}) =>
    rollSymbolPoolCheck(own, { ability, rank, difficulty: 0, isSave: false, upgradeOwn, ...extra }, () => 1);
  refuses((d) => {
    d.resolution.allowOwnUpgrade = "yes";
  }, /boolean/);
  refuses((d) => {
    d.resolution.allowOwnUpgrade = true;
    delete d.resolution.pool.upgrade;
  }, /require pool.upgrade/);
  parsed(
    doc((d) => {
      d.resolution.allowOwnUpgrade = false;
      delete d.resolution.pool.upgrade;
    }),
  );
  const both = roll(1, 0, 0, [2, 3, 4], { bonusDice: 1, setback: 1 });
  assert.deepEqual(both.thrown, ["ability", "boost", "setback"]);
  assert.deepEqual(both.symbols, { s: 1 });
  assert.equal(both.setback, 1);
  const negative = roll(0, 0, 0, [1, 1, 1], { bonusDice: -2, setback: 2 });
  assert.deepEqual(negative.thrown, ["setback", "setback", "setback"]);
  assert.equal(negative.setback, 1, "only the additional setback that fits is recorded");
  const bothCapped = rollSymbolPoolCheck(
    definition,
    { ability: 0, rank: 0, difficulty: 0, isSave: false, bonusDice: 999, setback: 999 },
    () => 1,
  );
  assert.deepEqual(bothCapped.thrown, ["boost", "boost", "boost", "setback", "setback", "setback"]);
  assert.deepEqual(ownRoll(3, 1, 1).thrown, ["proficiency", "proficiency", "ability"]);
  assert.deepEqual(ownRoll(2, 2, 2).thrown, Array(4).fill("proficiency"));
  assert.deepEqual(ownRoll(3, 1, 4).thrown, Array(5).fill("proficiency"), "crossing full first replaces and then adds");
  assert.deepEqual(ownRoll(0, 0, 2).thrown, Array(2).fill("proficiency"));
  assert.equal(ownRoll(6, 6, 999).upgradeOwn, undefined, "no claimed upgrade past pool.max");
  assert.equal(ownRoll(2, 2, 999).upgradeOwn, 4);
  assert.equal(ownRoll(2, 2, 999).thrown.length, 6);
  assert.deepEqual(ownRoll(2, 2, 1, { bought: { dice: 1 } }).thrown, Array(3).fill("proficiency"));
  const ownSum = parsed(
    doc((d) => {
      d.resolution.allowOwnUpgrade = true;
      d.resolution.pool.build = "sum";
    }),
  );
  assert.deepEqual(
    rollSymbolPoolCheck(ownSum, { ability: 1, rank: 1, difficulty: 0, isSave: false, upgradeOwn: 3 }, () => 1).thrown,
    Array(3).fill("proficiency"),
  );
  assert.deepEqual(roll(1, 0, 0, [1], { upgradeOwn: 999 }).thrown, ["ability"], "own upgrades are disabled by default");
  assert.deepEqual(ownRoll(1, 0, Infinity, { setback: NaN }).thrown, ["ability"]);
  for (const attribute of ["setback", "upgradeOwn"]) {
    for (const value of ["-1", "1.5", "no", "Infinity", ""]) {
      const tag = parseSkillCheckTagBody(`skill="Wits" dc="0" ${attribute}="${value}"`)!;
      assert.equal(tag[attribute as "setback" | "upgradeOwn"], undefined);
    }
    assert.equal(
      parseSkillCheckTagBody(`skill="Wits" dc="0" ${attribute}="2"`)?.[attribute as "setback" | "upgradeOwn"],
      2,
    );
  }

  // A record of mixed results, blank faces, no dice and escaped author labels survives reloading.
  const record = (rolled: ReturnType<typeof rollSymbolPoolCheck>): SkillCheckResult => ({
    skill: "Wits",
    dc: 2,
    modifier: 0,
    resolution: "sum",
    ...rolled,
  });
  for (const rolled of [both, negative, ownRoll(2, 2, 2), mixed, cancelled, roll(0, 0, 0, []), roll(1, 0, 0, [1])]) {
    const result = record(rolled);
    const text = serializeResolvedSkillCheckTag(result);
    const back = parseSkillCheckTagBody(text.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual(back, result);
    assert.equal(skillCheckDiceSumToTotal(result), false);
  }
  assert.match(serializeResolvedSkillCheckTag(record(mixed)), /symbols="1t 2s 1a 1d"/);
  assert.match(formatSkillCheckResultSummary(record(mixed)), /2 Success/);
  assert.match(skillCheckSymbolText(record(mixed)), /1 Triumph/);
  assert.match(formatSkillCheckResultSummary(record(cancelled)), /Failure\.$/);
  const quoted = { ...record(mixed), symbolLabels: { ...mixed.symbolLabels, s: 'Success "yes" [ok] & café' } };
  assert.deepEqual(
    parseSkillCheckTagBody(serializeResolvedSkillCheckTag(quoted).slice(13, -1))?.resolvedResult?.symbolLabels,
    quoted.symbolLabels,
  );
  assert.equal(parseSkillCheckTagBody('skill="Wits" dc="2" upgrade="1.5"')?.upgrades, undefined);
  assert.equal(parseSkillCheckTagBody('skill="Wits" dc="2" upgrade="2"')?.upgrades, 2);
  const corrupt = serializeResolvedSkillCheckTag(record(mixed)).replace('thrown="proficiency|', 'thrown="');
  assert.equal(parseSkillCheckTagBody(corrupt.slice(13, -1))?.resolvedResult, undefined);

  // The sheet supplies characteristic and rank separately, including who=, with= and an override.
  const skill = definition.sheet.skills[0]!;
  const build = defaultRulesetSheetBuild(definition);
  build.abilities[skill.ability!] = 3;
  build.abilities.wits = 2;
  build.skills[skill.id] = "expert";
  const cards = [{ name: "Wren", rulesetSheet: { v: definition.sheet.version, build } }];
  const context = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: resolver.buildSkillCheckRulesetContext(definition, cards, cards[0]),
  };
  assert.deepEqual(
    rulesetSymbolPoolRatings(
      definition,
      evaluateRulesetSheet(definition, build),
      matchRulesetCheckTarget(definition, skill.label),
    ),
    { ability: build.abilities[skill.ability!], rank: 2, bonusDice: 0 },
  );
  const result = resolver.resolveSkillCheckWithContext(context as any, {
    skill: skill.label,
    dc: 2,
    upgrades: 1,
    bonusDice: 1,
  });
  assert.equal(result.thrown?.filter((id) => id === "proficiency").length, 2);
  assert.ok(result.thrown?.includes("boost"));
  assert.ok(result.thrown?.includes("challenge"));
  assert.equal(result.modifier, 0);
  const stranger = resolver.resolveSkillCheckWithContext(context as any, {
    skill: skill.label,
    dc: 0,
    who: "Stranger",
  });
  assert.deepEqual(stranger.thrown, []);
  const override = parsed(
    doc(
      (d) =>
        (d.resolution.overrides = [
          { id: "sum", label: "Sum", abilities: ["wits"], set: { pool: { die: "ability", build: "sum", max: 1 } } },
        ]),
    ),
  );
  const changed = { ...context, ruleset: resolver.buildSkillCheckRulesetContext(override, cards, cards[0]) };
  assert.deepEqual(resolver.resolveSkillCheckWithContext(changed as any, { skill: "Wits", dc: 0 }).thrown, ["ability"]);
  assert.equal(resolver.isResolvableSkillCheckRequest({ skill: "Wits", dc: 0 }, definition), true);
  assert.equal(resolver.isResolvableSkillCheckRequest({ skill: "Wits", dc: 6 }, definition), false);

  const rewritten = await resolver.resolveSkillCheckTagsInContent(
    `[skill_check: skill="${skill.label}" difficulty="Average" upgrade="1" bonus="-1"]`,
    { rulesetPinned: true, loadContext: async () => context as any },
  );
  assert.equal(rewritten.resolved, 1);
  assert.ok(rewritten.results?.[0]?.thrown?.includes("challenge"));
  assert.ok(rewritten.results?.[0]?.thrown?.includes("setback"));
  const ownContext = { ...context, ruleset: resolver.buildSkillCheckRulesetContext(own, cards, cards[0]) };
  const together = await resolver.resolveSkillCheckTagsInContent(
    '[skill_check: skill="Wits" dc="0" bonus="1" setback="2" upgradeOwn="3"]',
    { rulesetPinned: true, loadContext: async () => ownContext as any },
  );
  assert.equal(together.resolved, 1);
  assert.deepEqual(together.results?.[0]?.thrown, [
    "proficiency",
    "proficiency",
    "proficiency",
    "boost",
    "setback",
    "setback",
  ]);
  assert.match(together.content, /setback="2"/);
  assert.match(together.content, /upgradeOwn="3"/);
  const reloaded = parseSkillCheckTagBody(together.content.slice(13, -1))?.resolvedResult;
  assert.equal(reloaded?.upgradeOwn, 3);
  assert.equal(reloaded?.setback, 2);
  const fallback = await resolver.resolveSkillCheckTagsInContent(
    '[skill_check: skill="Wits" dc="0" setback="2" upgradeOwn="3"]',
    {
      rulesetPinned: true,
      loadContext: async () => {
        throw new Error("unavailable");
      },
    },
  );
  assert.match(fallback.content, /setback="2"/);
  assert.match(fallback.content, /upgradeOwn="3"/);
  const legacy = parsed(ember);
  const legacyContext = { ...context, ruleset: resolver.buildSkillCheckRulesetContext(legacy, cards, cards[0]) };
  const ignored = resolver.resolveSkillCheckWithContext(legacyContext as any, {
    skill: "Wits",
    dc: 4,
    setback: 999,
    upgradeOwn: 999,
  });
  assert.equal(ignored.setback, undefined);
  assert.equal(ignored.upgradeOwn, undefined);
  const purchased = parsed(doc((d) => (d.resolution.spend = [{ pool: "luck", amount: 1, dice: 1, perCheck: 1 }])));
  const paidContext = { ...context, ruleset: resolver.buildSkillCheckRulesetContext(purchased, cards, cards[0]) };
  let paid = false;
  const paidRoll = resolver.resolveSkillCheckWithContext(
    paidContext as any,
    { skill: "Wits", dc: 0, spend: { pool: "luck", amount: 1 } },
    undefined,
    () => {
      paid = true;
    },
  );
  assert.equal(paid, true);
  assert.equal(paidRoll.thrown?.length, 3);
  assert.deepEqual(paidRoll.spent, { pool: "luck", amount: 1 });
  assert.equal(
    resolver.resolveSkillCheckWithContext(paidContext as any, {
      skill: "Wits",
      dc: 0,
      spend: { pool: "luck", amount: 1 },
    }).thrown?.length,
    2,
    "no persistence means no purchase",
  );
  const swapped = resolver.resolveSkillCheckWithContext(context as any, {
    skill: skill.label,
    dc: 0,
    withAbility: "Heart",
  });
  assert.deepEqual(swapped.thrown, ["ability", "ability"], "zero characteristic and rank two upgrades none");
  const emptyBand = parsed(
    doc(
      (d) =>
        (d.resolution.outcomes = {
          by: "margin",
          tiers: [
            { id: "pass", label: "Pass", atLeast: 0, success: true },
            { id: "fail", label: "Fail" },
          ],
        }),
    ),
  );
  const emptySuccess = record(
    rollSymbolPoolCheck(emptyBand, { ability: 0, rank: 0, difficulty: 0, isSave: false }, faces()),
  );
  assert.equal(emptySuccess.success, true);
  assert.deepEqual(
    parseSkillCheckTagBody(serializeResolvedSkillCheckTag(emptySuccess).slice(13, -1))?.resolvedResult,
    emptySuccess,
  );

  const reminder = buildGmFormatReminder({
    turnNumber: 2,
    gameActiveState: "exploration",
    partyNames: ["Wren"],
    playerName: "Wren",
    ruleset: definition,
  });
  for (const expected of [
    /larger of the character's ability and skill rank/,
    /upgrade="N"/,
    /bonus="-N"/,
    /Failure cancels Success one for one/,
    /Triumph also counts as Success/,
    /1 net Success/,
    /symbols="/,
  ])
    assert.match(reminder, expected);
  const ownReminder = buildGmFormatReminder({
    turnNumber: 2,
    gameActiveState: "exploration",
    partyNames: ["Wren"],
    playerName: "Wren",
    ruleset: own,
  });
  assert.match(ownReminder, /upgradeOwn="N"/);
  assert.match(ownReminder, /each extra upgrade adds one upgraded die/);
  assert.match(ownReminder, /setback="N" independently/);
  assert.doesNotMatch(reminder, /upgradeOwn=/);
  const english = JSON.parse(read("../../packages/client/src/localization/locales/en.json"));
  const summary = rulesetRulesSummary(definition, ((key: string) => english[key] ?? key) as any).join(" ");
  assert.match(summary, /upgrading the smaller/);
  assert.match(summary, /opposing dice/);
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-symbol-pool",
    name: "Symbol pool",
    version: "0.1.0",
    description: "Narrative dice.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = /requires schemaVersion 2 and capabilityApi 1\.141/;
  assert.match(getCapabilityPackageInstallIssue(manifest(140) as any, doc()) ?? "", gate);
  assert.equal(getCapabilityPackageInstallIssue(manifest(141) as any, doc()), null);
  assert.match(getCapabilityPackageInstallIssue(manifest(149) as any, ownDoc()) ?? "", /capabilityApi 1\.150/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(150) as any, ownDoc()), null);
  assert.match(
    getCapabilityPackageInstallIssue(
      manifest(149) as any,
      doc((d) => {
        d.resolution.allowOwnUpgrade = false;
      }),
    ) ?? "",
    /capabilityApi 1\.150/,
  );
  const ownOverride = doc((d) => {
    d.resolution.overrides = [{ id: "own", label: "Own", abilities: ["wits"], set: { allowOwnUpgrade: true } }];
  });
  parsed(ownOverride);
  assert.match(getCapabilityPackageInstallIssue(manifest(149) as any, ownOverride) ?? "", /capabilityApi 1\.150/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(150) as any, ownOverride), null);
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
