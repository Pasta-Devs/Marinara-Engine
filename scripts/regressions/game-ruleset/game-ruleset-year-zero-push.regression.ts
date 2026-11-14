/**
 * A pool told apart by source and pushed (Capability API 1.826): the Year Zero Engine's base, skill
 * and gear dice, their 1s, and the push.
 *
 * What is pinned here:
 *   - The schema takes groups from ability, skill and gear, and refuses groups with no skill group,
 *     two from one source or one label, and a push or groups beside explode, stances or hunger.
 *   - The pool is laid out ability, skill, gear (in the groups' order); `gear=` adds dice; each
 *     counting group's 1s are recorded.
 *   - A push starts from the earlier roll and throws again, once, every die that neither succeeded
 *     nor shows a counted 1; a group whose 1s do not count has them thrown again; without groups
 *     every 1 stays. An earlier roll that does not fit the pool is not pushed.
 *   - `push="true"` takes that earlier roll from the record in the previous reply, by skill and
 *     roller, and a pushed roll is not pushed again.
 *   - Through the resolver, the record and the Game Master; a packaged ruleset declares 1.826.
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
  rollDicePoolCheck,
  serializeResolvedSkillCheckTag,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-year-zero-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    {
      buildSkillCheckRulesetContext,
      checkRecordsAsHistoryNotes,
      resolveSkillCheckWithContext,
      resolveSkillCheckTagsInContent,
      rulesetPushableRoll,
    },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../../packages/server/src/services/game/gm-prompts.js"),
    import("../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);
  const gravewatchText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url)),
    "utf8",
  );
  /** Gravewatch thrown as the Year Zero Engine: d6s, a success on a 6. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(gravewatchText) as Record<string, any>;
    delete document.combat;
    delete document.layers;
    document.catalogs = (document.catalogs ?? [])
      .filter((catalog: { holds?: string }) => catalog.holds !== "creatures")
      .map((catalog: Record<string, any>) => ({
        ...catalog,
        entries: (catalog.entries ?? []).filter((entry: any) => !entry.mechanics?.check),
      }));
    for (const skill of document.sheet.skills) if (skill.untrained === "harder") delete skill.untrained;
    const resolution = document.resolution;
    for (const key of ["explode", "cancel", "botch", "exceptional", "reroll"]) delete resolution[key];
    resolution.die = { sides: 6 };
    resolution.target = { default: 6, min: 6, max: 6 };
    for (const step of resolution.difficultyLadder) delete step.target;
    resolution.groups = [
      { id: "base", label: "Base", from: "ability" },
      { id: "skill", label: "Skill", from: "skill", banes: false },
      { id: "gear", label: "Gear", from: "gear" },
    ];
    resolution.push = { text: "Each 1 on a Base die costs a point of damage." };
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
  const yze = parsed(doc());
  {
    refuses(
      doc((d) => d.resolution.groups.splice(1, 1)),
      /A group from skill holds the dice/,
      "no skill group",
    );
    refuses(
      doc((d) => (d.resolution.groups[2].from = "ability")),
      /Two groups take their dice from ability/,
      "two groups from one source",
    );
    refuses(
      doc((d) => (d.resolution.groups[2].label = " Base ")),
      /Two groups share a label/,
      "two groups with one label",
    );
    refuses(
      doc((d) => (d.resolution.explode = { from: 6 })),
      /leave explode out/,
      "a push beside explode",
    );
    refuses(
      doc((d) => (d.resolution.hunger = { label: "Hunger", max: 2 })),
      /leave push or hunger out/,
      "a push beside special dice",
    );
  }

  // ── The roll ──
  {
    // Two Base dice, two Skill dice and one Gear die.
    const input = { modifier: 4, ability: 2, gear: 1, required: 1, isSave: false };
    const first = rollDicePoolCheck(yze, input, faces(6, 1, 3, 1, 1));
    assert.deepEqual(first.groups, [
      { label: "Base", dice: 2, banes: 1 },
      { label: "Skill", dice: 2 },
      { label: "Gear", dice: 1, banes: 1 },
    ]);
    assert.deepEqual([first.total, first.success, first.pushed], [1, true, undefined]);
    // Pushed: the Skill 3 and the Skill 1 (its 1s do not count) are thrown again; the 6 and the
    // counted 1s stay.
    const pushed = rollDicePoolCheck(
      yze,
      { ...input, pushOf: { rolls: first.rolls, groups: first.groups } },
      faces(6, 2),
    );
    assert.deepEqual(pushed.rolls, [6, 1, 6, 2, 1]);
    assert.deepEqual([pushed.total, pushed.pushed], [2, 2]);
    assert.deepEqual(pushed.groups, [
      { label: "Base", dice: 2, banes: 1 },
      { label: "Skill", dice: 2 },
      { label: "Gear", dice: 1, banes: 1 },
    ]);
    // A 1 the push threw up counts afterwards.
    const after = rollDicePoolCheck(
      yze,
      { ...input, pushOf: { rolls: [2, 6, 6, 6, 6], groups: first.groups } },
      faces(1),
    );
    assert.deepEqual([after.rolls, after.groups?.[0]], [[1, 6, 6, 6, 6], { label: "Base", dice: 2, banes: 1 }]);
    // A push that finds nothing to throw again is still a push, so it is not pushed a second time.
    const nothing = rollDicePoolCheck(
      yze,
      { ...input, pushOf: { rolls: [6, 1, 6, 6, 1], groups: first.groups } },
      faces(),
    );
    assert.deepEqual([nothing.pushed, nothing.total], [0, 3]);
    // A push counts against the target the earlier roll was counted against: a 5 that succeeded at
    // 5 stays, whatever this ruleset's default is.
    const atFive = rollDicePoolCheck(
      yze,
      { ...input, pushOf: { rolls: [5, 1, 3, 1, 1], threshold: 5, groups: first.groups } },
      faces(2, 2),
    );
    assert.deepEqual([atFive.rolls, atFive.threshold], [[5, 1, 2, 2, 1], 5]);
    // An earlier roll this pool could not have made is not pushed: the check is thrown afresh.
    for (const pushOf of [
      { rolls: [6, 1, 3, 1, 1] },
      { rolls: [6, 1, 3, 1, 1], groups: [{ label: "Base", dice: 5 }] },
      { rolls: [6, 1, 3, 1, 9], groups: first.groups },
      { rolls: [6, 1, 3, 1], groups: first.groups },
    ]) {
      const afresh = rollDicePoolCheck(yze, { ...input, pushOf }, faces(2, 2, 2, 2, 2));
      assert.deepEqual([afresh.rolls, afresh.pushed], [[2, 2, 2, 2, 2], undefined]);
    }
    // A penalty comes off the skill's dice; the ability's are held to the pool.
    const short = rollDicePoolCheck(yze, { ...input, modifier: 2 }, faces(6, 6, 6));
    assert.deepEqual(
      short.groups?.map((group) => group.dice),
      [2, 0, 1],
    );
    // Without groups every 1 stays on a push; without `push` the ask is ignored.
    const plainPush = parsed(doc((d) => delete d.resolution.groups));
    assert.deepEqual(
      rollDicePoolCheck(plainPush, { modifier: 3, required: 1, isSave: false, pushOf: { rolls: [1, 4, 6] } }, faces(5))
        .rolls,
      [1, 5, 6],
    );
    const unpushable = parsed(doc((d) => (delete d.resolution.push, delete d.resolution.groups)));
    const before = rollDicePoolCheck(
      unpushable,
      { modifier: 2, required: 1, isSave: false, pushOf: { rolls: [1, 1] }, gear: 3 },
      faces(3, 4),
    );
    assert.deepEqual([before.rolls, before.pushed, before.groups], [[3, 4], undefined, undefined]);

    // The record says the groups and the push, and reads back.
    const record = serializeResolvedSkillCheckTag({
      skill: "Wrestle",
      dc: 1,
      modifier: 0,
      resolution: "successes",
      ...pushed,
    });
    assert.match(record, /groups="Base:2:1\|Skill:2\|Gear:1:1" pushed="2"/);
    const back = parseSkillCheckTagBody(record.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([back?.groups, back?.pushed, back?.total], [pushed.groups, 2, 2]);
    assert.match(
      formatSkillCheckResultSummary(back!),
      /Base 2 \(1 showing 1\), Skill 2, Gear 1 \(1 showing 1\)\. Pushed: 2 dice thrown again\.$/,
    );
  }

  // ── Through the resolver, the Game Master and the package gate ──
  {
    const ask = parseSkillCheckTagBody('skill="Wrestle" dc="1" gear="2" push="true"');
    assert.deepEqual([ask?.gear, ask?.push], [2, true]);
    const build = defaultRulesetSheetBuild(yze);
    const cards = [{ name: "Wren", rulesetSheet: { v: yze.sheet.version, build } }];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(yze, cards, cards[0]),
    };
    const result = resolveSkillCheckWithContext(context as any, { skill: "Wrestle", dc: 1, gear: 2 });
    assert.equal(result.groups?.length, 3);
    assert.equal(
      result.groups!.reduce((sum, group) => sum + group.dice, 0),
      result.rolls.length,
      "every die is in one group",
    );
    assert.equal(result.groups![2]!.dice, 2, "the gear dice");

    // `push="true"` takes the earlier roll from the record in the previous reply, never from the tag.
    const lastReply = `Wren heaves at the gate. ${serializeResolvedSkillCheckTag(result)}`;
    assert.deepEqual(rulesetPushableRoll(yze, { skill: "wrestle", push: true }, lastReply), {
      rolls: result.rolls,
      dc: 1,
      threshold: result.threshold,
      groups: result.groups!.map(({ label, dice }) => ({ label, dice })),
    });
    assert.equal(rulesetPushableRoll(yze, { skill: "Wrestle" }, lastReply), undefined, "no push asked");
    assert.equal(rulesetPushableRoll(yze, { skill: "Sneak", push: true }, lastReply), undefined, "another check");
    assert.equal(rulesetPushableRoll(yze, { skill: "Wrestle", push: true }, undefined), undefined, "no reply");
    // The roller must match exactly: the player's own record names nobody, and another member's
    // record is never the player's to push, nor the player's theirs.
    const mira = lastReply.replace('skill="Wrestle"', 'skill="Wrestle" who="Mira"');
    assert.match(mira, /who="Mira"/);
    assert.equal(rulesetPushableRoll(yze, { skill: "Wrestle", push: true }, mira), undefined, "someone else's");
    assert.equal(rulesetPushableRoll(yze, { skill: "Wrestle", who: "Mira", push: true }, lastReply), undefined);
    assert.ok(rulesetPushableRoll(yze, { skill: "Wrestle", who: "mira", push: true }, mira), "the same member's");
    // A push declared only on one check's override still finds the earlier roll.
    const overridden = parsed(
      doc((d) => {
        delete d.resolution.push;
        d.resolution.overrides = [
          { id: "pushable", label: "Pushable", skills: ["wrestle"], set: { push: { text: "Push it." } } },
        ];
      }),
    );
    assert.ok(rulesetPushableRoll(overridden, { skill: "Wrestle", push: true }, lastReply));
    const resolve = (reply: string | undefined) =>
      resolveSkillCheckTagsInContent('[skill_check: skill="Wrestle" dc="1" push="true" rolls="6,6,6,6,6,6"]', {
        loadContext: async () => context as any,
        rulesetPinned: true,
        lastReply: () => reply,
      });
    const again = (await resolve(lastReply)).results![0]!;
    assert.ok(again.pushed !== undefined, "the roll was pushed");
    assert.equal(again.rolls.length, result.rolls.length, "a push throws no new dice");
    assert.deepEqual(
      again.groups!.map((group) => group.dice),
      result.groups!.map((group) => group.dice),
    );
    result.rolls.forEach((face, at) => {
      const counted =
        face === 1 && result.groups![1]!.dice > 0
          ? !(at >= result.groups![0]!.dice && at < result.groups![0]!.dice + result.groups![1]!.dice)
          : face === 1;
      if (face === 6 || counted) assert.equal(again.rolls[at], face, "a success or a counted 1 is kept");
    });
    // A push the Game Master wrote with no difficulty is rolled against the earlier roll's.
    const bare = await resolveSkillCheckTagsInContent('[skill_check: skill="Wrestle" push="true"]', {
      loadContext: async () => context as any,
      rulesetPinned: true,
      lastReply: () => lastReply,
    });
    assert.deepEqual([bare.resolved, bare.results?.[0]?.dc, bare.results?.[0]?.pushed !== undefined], [1, 1, true]);
    // A pushed roll is not pushed again, and with no earlier roll there is nothing to push: either
    // way the ask is settled as not pushed, never thrown afresh, which would beat a push.
    for (const reply of [`Again. ${serializeResolvedSkillCheckTag(again)}`, undefined, "No check here."]) {
      const refused = await resolve(reply);
      assert.equal(refused.results?.length ?? 0, 0, "nothing was rolled");
      assert.match(refused.content, /reason="not-pushable"/);
      assert.doesNotMatch(refused.content, /rolls="/);
      assert.equal(parseSkillCheckTagBody(refused.content.slice("[skill_check:".length, -1))?.reason, "not-pushable");
    }
    // A push spends, uses and adds nothing: it is the earlier roll thrown again.
    const bought = await resolveSkillCheckTagsInContent('[skill_check: skill="Wrestle" dc="1" push="true" gear="3"]', {
      loadContext: async () => context as any,
      rulesetPinned: true,
      lastReply: () => lastReply,
    });
    assert.equal(bought.results?.[0]?.rolls.length, result.rolls.length, "no gear dice join a push");
    // A push with no difficulty and nothing to push is settled too, not left as an ask.
    const bareNothing = await resolveSkillCheckTagsInContent('[skill_check: skill="Wrestle" push="true"]', {
      loadContext: async () => context as any,
      rulesetPinned: true,
      lastReply: () => "No check here.",
    });
    assert.match(bareNothing.content, /reason="not-pushable"/);
    assert.equal(bareNothing.results?.length ?? 0, 0);
    // A whole-party push has no one record to push.
    const party = await resolveSkillCheckTagsInContent(
      '[skill_check: skill="Wrestle" who="party" dc="1" push="true"]',
      {
        loadContext: async () => context as any,
        rulesetPinned: true,
        lastReply: () => lastReply,
      },
    );
    assert.match(party.content, /reason="not-pushable"/);
    assert.equal(party.results?.length ?? 0, 0);
    // The player's own record and a push naming the player's card are one roller.
    const named = await resolveSkillCheckTagsInContent('[skill_check: skill="Wrestle" who="Wren" dc="1" push="true"]', {
      loadContext: async () => context as any,
      rulesetPinned: true,
      lastReply: () => lastReply,
    });
    assert.ok(named.results?.[0]?.pushed !== undefined, "Wren's push of Wren's roll");
    // An earlier roll this pool could not have made is a push the roller declines: not kept.
    const tooMany = lastReply.replace(/rolls="[^"]*"/, 'rolls="9|9|9"');
    const declined = await resolveSkillCheckTagsInContent('[skill_check: skill="Wrestle" dc="1" push="true"]', {
      loadContext: async () => context as any,
      rulesetPinned: true,
      lastReply: () => tooMany,
    });
    assert.equal(declined.results?.length ?? 0, 0);
    assert.match(declined.content, /reason="not-pushable"/);
    // Read back to the Game Master as a plain line, never the raw ask.
    assert.match(checkRecordsAsHistoryNotes(declined.content), /Wrestle check not pushed: there was no earlier roll/);

    // With no ruleset there is no push: one that names no difficulty is left as written, unrolled
    // (the client sends no check that has no difficulty either).
    const loose = await resolveSkillCheckTagsInContent('[skill_check: skill="Wrestle" push="true"]', {
      loadContext: async () => ({ skills: null, attributes: null, sheetAttributes: {} }) as any,
      lastReply: () => lastReply,
    });
    assert.deepEqual([loose.content, loose.results?.length ?? 0], ['[skill_check: skill="Wrestle" push="true"]', 0]);

    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: ["Wren"],
      playerName: "Wren",
      ruleset: yze,
    });
    assert.match(reminder, /Add gear="N" for the dice the character's gear adds \(Gear\)/);
    assert.match(reminder, /how many of the Base, Gear dice show 1/);
    assert.match(
      reminder,
      /with the same dc and push="true" and no rolls or result: the engine takes the character's roll of it from your previous reply/,
    );

    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-year-zero",
      name: "Year Zero",
      version: "0.1.0",
      description: "A packaged ruleset whose pool may be pushed.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(825) as any, doc()) ?? "", /capabilityApi 1\.826/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(826) as any, doc()), null);
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
