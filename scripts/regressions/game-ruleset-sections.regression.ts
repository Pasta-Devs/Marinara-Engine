/**
 * Sections on abilities, skills and saves, and what a check does untrained (issue #6655).
 * Capability API 1.41.
 *
 * What is pinned here:
 *   - `section` on an ability, skill or save, checked against the sheet's sections; the grouping
 *     helper (the sheet's own order, then the unsectioned; one plain group when nothing names one).
 *   - The Game Master's sheet block groups the ability and Trained lines under their headings, and a
 *     sheet with no sections reads exactly as it did.
 *   - `untrained` on a skill, a save or a section, the entry's own winning: `by` in the sheet's own
 *     number (dice on a pool, flat on a sum, before a cap); `harder` one more on a pool's per-die
 *     target; `refuse` not rolled at all, written back with `reason="untrained"`, which the parser
 *     reads and nothing rolls later; a stranger has no training to read. The endpoint answers 400
 *     `skill_check_untrained`, and the branch arm keeps neither half.
 *   - Every import refusal, the reminder's untrained line, and the 1.41 gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheetLive,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  renderRulesetSheetBlock,
  rulesetSectionGroups,
  rulesetUntrainedRule,
  serializeResolvedSkillCheckTag,
  serializeSparseSkillCheckTag,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type SkillCheckResult,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-sections-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [
    {
      buildSkillCheckRulesetContext,
      resolveSkillCheckTagsInContent,
      resolveSkillCheckWithContext,
      SkillCheckUntrainedError,
    },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
    { createGameTurnChanceSession, resolveGameTurnBranches },
    { resolveGameDiceRequests },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/server/src/services/game/one-request-dice.js"),
    import("../../packages/server/src/services/game/dice.service.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");

  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const variant = (base: string, edit: (doc: Record<string, any>) => void, what = "the variant") => {
    const doc = JSON.parse(base) as Record<string, any>;
    edit(doc);
    return parsedOrThrow(doc, what);
  };
  const refuses = (base: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const doc = JSON.parse(base) as Record<string, any>;
    edit(doc);
    const parsed = parseRulesetDefinition(doc);
    assert.ok(!parsed.ok, `${why}: it should have been refused`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
    );
  };
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "the pool example");
  const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");
  const skillOf = (doc: Record<string, any>, id: string) => doc.sheet.skills.find((skill: any) => skill.id === id);

  const contextFor = (
    definition: RulesetDefinition,
    build: RulesetSheetBuild = defaultRulesetSheetBuild(definition),
  ) => {
    const party = [{ name: "Mira", rulesetSheet: { v: 1, build } }];
    return {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(definition, party, party[0]),
    } satisfies SkillCheckModifierContext;
  };
  const trainedIn = (definition: RulesetDefinition, skills: Record<string, string>) => {
    const build = defaultRulesetSheetBuild(definition);
    build.skills = { ...build.skills, ...skills };
    return build;
  };

  // ── Refused at import ──
  {
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.abilities[0].section = "nowhere"),
      /sheet\.abilities\.0\.section: Unknown section "nowhere"/,
      "an ability in a section the sheet does not have",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.saves[0].section = "nowhere"),
      /sheet\.saves\.0\.section: Unknown section "nowhere"/,
      "a save in one",
    );
    refuses(
      emberText,
      (doc) => (skillOf(doc, "sneak").untrained = "harder"),
      /A dice-sum ruleset has no per-die target, so "harder" cannot change a roll/,
      "one step harder on a summed roll",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.resolution.target = { default: 7, min: 7, max: 7 }),
      /sheet\.skills\.2\.untrained: This ruleset's per-die target cannot move/,
      "one step harder on a target that cannot move",
    );
    refuses(
      gravewatchText,
      (doc) => {
        doc.resolution.target = { default: 7, min: 7, max: 7 };
        delete skillOf(doc, "listen").untrained;
        doc.sheet.sections[3].untrained = "harder";
      },
      /sheet\.sections\.3\.untrained: This ruleset's per-die target cannot move/,
      "and on a section",
    );
    refuses(gravewatchText, (doc) => (skillOf(doc, "ward").untrained = { by: -21 }), /untrained/, "too much off");
    refuses(gravewatchText, (doc) => (skillOf(doc, "ward").untrained = "never"), /untrained/, "a rule that is not one");
  }

  // ── Grouping ──
  {
    const groups = rulesetSectionGroups(gravewatch, gravewatch.sheet.skills);
    assert.deepEqual(
      groups.map((group) => [group.section?.label ?? null, group.entries.map((entry) => entry.id)]),
      [
        ["Labour", ["dig", "wrestle"]],
        ["The watch", ["listen", "ward"]],
        ["Company", ["soothe", "barter"]],
      ],
    );
    const mixed = variant(gravewatchText, (doc) => delete skillOf(doc, "barter").section);
    assert.deepEqual(
      rulesetSectionGroups(mixed, mixed.sheet.skills).map((group) => group.section?.id ?? null),
      ["labour", "watch", "company", null],
      "the unsectioned last, under no heading",
    );
    assert.deepEqual(
      rulesetSectionGroups(ember, ember.sheet.skills).map((group) => [group.section, group.entries.length]),
      [[null, 4]],
      "nothing sectioned is one plain group",
    );
    assert.deepEqual(rulesetSectionGroups(ember, []), []);
  }

  // ── The Game Master's sheet block ──
  {
    const build = trainedIn(gravewatch, { ward: "rating_2", barter: "rating_1" });
    const block = renderRulesetSheetBlock(gravewatch, { name: "Mira", build }, {});
    assert.match(block, /^Trained: The watch: Ward 4 dice; Company: Barter 3 dice$/m);
    assert.match(block, /^SIN 2 dice, NRV 2 dice, WRM 2 dice$/m, "abilities in no section read as they did");
    const sectionedAbilities = variant(gravewatchText, (doc) => {
      doc.sheet.sections.push({ id: "body", label: "Body" }, { id: "spirit", label: "Spirit" });
      doc.sheet.abilities[0].section = "body";
      doc.sheet.abilities[1].section = "spirit";
      doc.sheet.abilities[2].section = "spirit";
    });
    assert.match(
      renderRulesetSheetBlock(sectionedAbilities, { name: "Mira", build }, {}),
      /^Body: SIN 2 dice; Spirit: NRV 2 dice, WRM 2 dice$/m,
    );
    // A file with no sections at all renders byte for byte as before: the 5e reference file. The
    // expected block is what staging rendered for this build before sections existed.
    const fiveE = parsedOrThrow(JSON.parse(fiveEText), "the 5e reference");
    const fiveEBuild = defaultRulesetSheetBuild(fiveE);
    fiveEBuild.skills = { ...fiveEBuild.skills, stealth: "expertise" };
    const fiveEBlock = renderRulesetSheetBlock(fiveE, { name: "Vex", build: fiveEBuild }, {});
    assert.equal(
      fiveEBlock,
      [
        "Vex",
        "STR +0, DEX +0, CON +0, INT +0, WIS +0, CHA +0",
        "Trained: Stealth +4",
        "Level 1, Armor Class 10, Speed (ft) 30, Proficiency bonus 2, Passive Perception 10",
        "Hit points 8/8, Hit dice 1/1",
      ].join("\n"),
    );
  }

  // ── Untrained: a number added, the entry's own rule winning ──
  {
    const blank = evaluateRulesetSheetLive(gravewatch, defaultRulesetSheetBuild(gravewatch));
    assert.equal(blank.skillMods.wrestle, 1, "Sinew 2, untrained in Labour: one die off");
    assert.equal(blank.skillMods.dig, 2, "Dig's own rule (refuse) replaces its section's");
    assert.equal(blank.skillMods.ward, 2, "The watch says nothing untrained");
    const trained = evaluateRulesetSheetLive(gravewatch, trainedIn(gravewatch, { wrestle: "rating_1" }));
    assert.equal(trained.skillMods.wrestle, 3, "trained, the section's rule is gone: 2 + 1");
    assert.deepEqual(
      rulesetUntrainedRule(gravewatch, gravewatch.sheet.skills[1]!),
      { by: -1 },
      "Wrestle takes its section's rule",
    );
    const emberBlank = evaluateRulesetSheetLive(ember, defaultRulesetSheetBuild(ember));
    assert.equal(emberBlank.skillMods.tinker, -2, "a flat two off on a summed roll");
    // Before any cap: a Soothe capped at a Resolve of 1 is still 1 with two off it, not -1.
    const cappedByOne = variant(gravewatchText, (doc) => (skillOf(doc, "soothe").untrained = { by: -2 }));
    const capped = evaluateRulesetSheetLive(cappedByOne, defaultRulesetSheetBuild(cappedByOne), {
      pools: { resolve: { value: 1 } },
    });
    assert.deepEqual(capped.skillCaps.soothe, { cap: 1, uncapped: 0 });
    assert.equal(capped.skillMods.soothe, 0);
  }

  // ── Untrained: refused, and one step harder ──
  {
    const context = contextFor(gravewatch);
    assert.throws(() => resolveSkillCheckWithContext(context, { skill: "Dig", dc: 1 }), SkillCheckUntrainedError);
    assert.throws(
      () => resolveSkillCheckWithContext(context, { skill: "dig", dc: 1, who: "Mira" }),
      SkillCheckUntrainedError,
    );
    const trainedDig = contextFor(gravewatch, trainedIn(gravewatch, { dig: "rating_1" }));
    assert.equal(resolveSkillCheckWithContext(trainedDig, { skill: "Dig", dc: 1 }).skill, "Dig", "trained, it rolls");
    const stranger = resolveSkillCheckWithContext(context, { skill: "Dig", dc: 1, who: "Nobody" });
    assert.equal(stranger.modifier, 0, "a stranger has no sheet to say what they were trained in, so it rolls");

    // Listen untrained counts at one more than the target it would have: 7 by default, 6 where a
    // ladder step names it, and a tag's own threshold moves up with it, inside the ruleset's range.
    const listen = (request: Record<string, unknown>, sheet = context) =>
      resolveSkillCheckWithContext(sheet, { skill: "Listen", dc: 2, ...request } as never).threshold;
    assert.equal(listen({}), 8);
    assert.equal(listen({ dc: 1 }), 7, "Plain work counts at 6, so 7");
    assert.equal(listen({ threshold: 9 }), 9, "held to the top of the range");
    assert.equal(listen({}, contextFor(gravewatch, trainedIn(gravewatch, { listen: "rating_1" }))), 7, "trained");

    // Through a generated turn: written back as the ask with the reason, which settles it.
    const turn = await resolveSkillCheckTagsInContent(`Soil. [skill_check: skill="Dig" dc="1" who="Mira"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(turn.content, `Soil. [skill_check: skill="Dig" dc="1" who="Mira" reason="untrained"]`);
    assert.deepEqual([turn.resolved, turn.left, turn.sparse, turn.untrained], [0, 1, 1, 1]);
    const settled = parseSkillCheckTagBody(` skill="Dig" dc="1" who="Mira" reason="untrained"`)!;
    assert.equal(settled.reason, "untrained");
    // The general dice pass that runs next in the same turn leaves the settled ask exactly as it is.
    const next = resolveGameDiceRequests(turn.content, []);
    assert.deepEqual([next.content, next.unresolved, next.rolled], [turn.content, [], 0]);
    assert.equal(
      serializeSparseSkillCheckTag({ skill: "Dig", dc: 1 }, { reason: "untrained" }),
      `[skill_check: skill="Dig" dc="1" reason="untrained"]`,
    );
    // The Engine decides, not the Game Master: a reason written on a check this sheet may roll is
    // rolled anyway.
    const forged = await resolveSkillCheckTagsInContent(`[skill_check: skill="Ward" dc="1" reason="untrained"]`, {
      loadContext: async () => context,
      rulesetPinned: true,
    });
    assert.equal(forged.resolved, 1);
    assert.doesNotMatch(forged.content, /reason=/);

    // The one-request branch arm keeps neither half, and writes the record.
    const d20 = parsedOrThrow(
      (() => {
        const doc = JSON.parse(emberText);
        doc.resolution.dice = { count: 1, sides: 20 };
        skillOf(doc, "sneak").untrained = "refuse";
        return doc;
      })(),
      "a d20 Ember Roads that refuses an untrained Sneak",
    );
    const branched = await resolveGameTurnBranches(
      [
        `Before. [skill_check: skill="Sneak" dc="10" branch="door"]`,
        `[branch: door]`,
        `[on success] It opens.`,
        `[on failure] It holds.`,
        `[/branch]`,
      ].join("\n"),
      createGameTurnChanceSession({
        db: null as never,
        chatId: "lane",
        roll: () => 15,
        loadModifierContext: () => Promise.resolve(contextFor(d20)),
      }),
    );
    assert.match(branched.content, /\[skill_check: skill="Sneak" dc="10" reason="untrained"\]/);
    assert.doesNotMatch(branched.content, /It opens\.|It holds\./, "neither half happened");
    // A branch check for someone else is that member's check, whoever the player is: Mira untrained
    // is refused while the player is trained, and a trained Tomas rolls while the player is not.
    const twoOf = (player: string) => {
      const cards = [
        { name: "Mira", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(d20) } },
        { name: "Tomas", rulesetSheet: { v: 1, build: trainedIn(d20, { sneak: "trained" }) } },
      ];
      return {
        skills: null,
        attributes: null,
        sheetAttributes: {},
        ruleset: buildSkillCheckRulesetContext(
          d20,
          cards,
          cards.find((card) => card.name === player),
        ),
      } satisfies SkillCheckModifierContext;
    };
    const branchFor = (who: string, player: string) =>
      resolveGameTurnBranches(
        [
          `[skill_check: skill="Sneak" dc="10" who="${who}" branch="door"]`,
          `[branch: door]`,
          `[on success] It opens.`,
          `[on failure] It holds.`,
          `[/branch]`,
        ].join("\n"),
        createGameTurnChanceSession({
          db: null as never,
          chatId: "lane",
          roll: () => 15,
          loadModifierContext: () => Promise.resolve(twoOf(player)),
        }),
      );
    const miraForTomas = await branchFor("Mira", "Tomas");
    assert.match(
      miraForTomas.content,
      /\[skill_check: skill="Sneak" dc="10"[^\]]*who="Mira"[^\]]*reason="untrained"\]/,
    );
    assert.doesNotMatch(miraForTomas.content, /It opens\.|It holds\./, "Mira's own training decides");
    const tomasForMira = await branchFor("Tomas", "Mira");
    assert.doesNotMatch(tomasForMira.content, /reason=/, "Tomas is trained, so it is rolled");
    assert.match(tomasForMira.content, /It opens\./, "15 on a d20 against 10: one half kept");
    assert.match(tomasForMira.content, /who="Tomas"/, "the record says whose check it was");

    // A complete record the Game Master wrote itself is no way round it, however well it adds up:
    // the same record is kept where the ruleset lets an untrained Sneak be tried, and refused here.
    const letsTry = variant(emberText, (doc) => (doc.resolution.dice = { count: 1, sides: 20 }), "a d20 Ember Roads");
    const written = serializeResolvedSkillCheckTag(
      resolveSkillCheckWithContext(contextFor(letsTry), { skill: "Sneak", dc: 10 }, () => 12) as SkillCheckResult,
    );
    const kept = await resolveSkillCheckTagsInContent(written, {
      loadContext: async () => contextFor(letsTry),
      rulesetPinned: true,
    });
    assert.deepEqual([kept.trusted, kept.content], [1, written], "the record adds up, so it is kept");
    const claimed = await resolveSkillCheckTagsInContent(written, {
      loadContext: async () => contextFor(d20),
      rulesetPinned: true,
    });
    assert.equal(claimed.trusted, 0);
    // Nor is a difficulty nothing can read, which would otherwise leave the ask standing unrolled.
    const unreadable = await resolveSkillCheckTagsInContent(`[skill_check: skill="Dig" difficulty="Unheard of"]`, {
      loadContext: async () => contextFor(gravewatch),
      rulesetPinned: true,
    });
    assert.equal(unreadable.content, `[skill_check: skill="Dig" difficulty="Unheard of" reason="untrained"]`);
    assert.equal(unreadable.untrained, 1);
    assert.match(claimed.content, /^\[skill_check: skill="Sneak" dc="10"[^\]]*reason="untrained"\]$/);

    // A summed ruleset's untrained number is in the roll's modifier.
    const tinker = resolveSkillCheckWithContext(contextFor(ember), { skill: "Tinker", dc: 8 }) as SkillCheckResult;
    assert.equal(tinker.modifier, -2);
  }

  // ── The endpoint a client falls back on answers a refused check as not there to roll ──
  {
    const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
    const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
    const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
    const { createGameRulesetsStorage } =
      await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
    const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
    const db = await getDB();
    const app = Fastify();
    app.decorate("db", db);
    await app.register(gameRoutes, { prefix: "/api/game" });
    try {
      await createGameRulesetsStorage(db).put({
        rulesetId: "local/gravewatch",
        version: gravewatch.version,
        sourceKind: "local",
        definition: gravewatchText,
      });
      const chats = createChatsStorage(db);
      const chat = await chats.create({ name: "Sections", mode: "game", characterIds: [] } as never);
      assert.ok(chat);
      await chats.patchMetadata(chat.id, {
        gameRuleset: { id: "local/gravewatch", version: gravewatch.version, packageId: null, options: {} },
      });
      const refused = await app.inject({
        method: "POST",
        url: "/api/game/skill-check",
        payload: { chatId: chat.id, skill: "Dig", dc: 1 },
      });
      assert.equal(refused.statusCode, 400, refused.body);
      assert.equal((refused.json() as { code: string }).code, "skill_check_untrained");
      const rolled = await app.inject({
        method: "POST",
        url: "/api/game/skill-check",
        payload: { chatId: chat.id, skill: "Ward", dc: 1 },
      });
      assert.equal(rolled.statusCode, 200, rolled.body);
    } finally {
      await app.close();
      await closeDB();
    }
  }

  // ── The reminder ──
  {
    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: [], playerName: "Mira" };
    const pool = buildGmFormatReminder({ ...base, ruleset: gravewatch });
    assert.match(
      pool,
      /Untrained checks: Labour \(-1 die\), Dig \(cannot be attempted\), Listen \(one step harder\)\. A check the engine marks reason="untrained" was not rolled: the character could not attempt it\./,
    );
    const summed = buildGmFormatReminder({ ...base, ruleset: ember });
    assert.match(summed, /Untrained checks: Tinker \(-2\)\./);
    assert.doesNotMatch(summed, /reason="untrained"/, "only where something is refused");
    const plain = buildGmFormatReminder({ ...base, ruleset: parsedOrThrow(JSON.parse(fiveEText), "5e") });
    assert.doesNotMatch(plain, /Untrained checks/);
  }

  // ── Every new key needs 1.41 to install ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-test",
      name: "Test",
      version: "0.1.0",
      description: "A packaged ruleset.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const issue = /requires schemaVersion 2 and capabilityApi 1\.41 or newer/;
    const documents = [
      { sheet: { abilities: [{ id: "a", label: "A", min: 1, max: 5, default: 2, section: "s" }] } },
      { sheet: { skills: [{ id: "k", label: "K", section: "s" }] } },
      { sheet: { saves: [{ id: "v", label: "V", section: "s" }] } },
      { sheet: { skills: [{ id: "k", label: "K", untrained: "refuse" }] } },
      { sheet: { saves: [{ id: "v", label: "V", untrained: { by: -1 } }] } },
      { sheet: { sections: [{ id: "s", label: "S", untrained: "harder" }] } },
    ];
    for (const document of documents) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(40) as never, document) ?? "",
        issue,
        JSON.stringify(document),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(41) as never, document), null);
    }
    // Sections that only fields use are what every file before 1.41 could say.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(40) as never, {
        sheet: {
          sections: [{ id: "s", label: "S" }],
          fields: [{ id: "f", label: "F", type: "text", maxLength: 9, section: "s" }],
        },
      }),
      null,
    );
  }

  console.info("game ruleset section regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
